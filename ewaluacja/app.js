// Interfejs strony ewaluacji: wczytywanie plików (także ZIP i folderów), porównanie, prezentacja.
(function () {
  'use strict';
  const A = window.Analizator;
  const CFG = window.KONFIGURACJA || { progi: [], nieliczone: [] };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SUPPORTED = /\.(bpmn|dmn|form)$/i;
  const IGNORED_PATH = /(^|\/)(target|build|out|node_modules|\.git|\.idea|\.mvn|bin)\//i;
  const TEST_PATH = /(^|\/)src\/test\//i;

  const state = {
    ref: { name: '', files: [] },     // [{name, path, content, include}]
    stu: [],
  };

  // ---------- ZIP (bez bibliotek: DecompressionStream) ----------
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function readZip(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('to nie jest poprawne archiwum ZIP');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = [];
    const dec = new TextDecoder('utf-8');
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      if (name.endsWith('/') || !SUPPORTED.test(name)) continue;
      const lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lnlen + lelen;
      const data = u8.subarray(start, start + csize);
      let raw;
      if (method === 0) raw = data;
      else if (method === 8) raw = await inflateRaw(data);
      else continue;
      out.push({ path: name, content: dec.decode(raw) });
    }
    return out;
  }

  // ---------- zbieranie plików ----------
  async function collect(fileList) {
    const out = [];
    for (const f of fileList) {
      const path = (f.webkitRelativePath || f._path || f.name).replace(/\\/g, '/');
      try {
        if (/\.zip$/i.test(f.name)) {
          const entries = await readZip(await f.arrayBuffer());
          entries.forEach(e => out.push({ path: f.name + '/' + e.path, content: e.content }));
        } else if (SUPPORTED.test(f.name)) {
          out.push({ path, content: await f.text() });
        }
      } catch (e) {
        alert('Nie udało się wczytać ' + f.name + ': ' + e.message);
      }
    }
    return out;
  }
  // przeciąganie folderów (DataTransferItem.webkitGetAsEntry)
  async function filesFromDrop(dt) {
    const items = Array.from(dt.items || []).map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    if (!items.length) return Array.from(dt.files);
    const files = [];
    const walk = async (entry, prefix) => {
      if (entry.isFile) {
        const file = await new Promise((res, rej) => entry.file(res, rej));
        file._path = prefix + entry.name;
        files.push(file);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        let batch;
        do {
          batch = await new Promise((res, rej) => reader.readEntries(res, rej));
          for (const e of batch) await walk(e, prefix + entry.name + '/');
        } while (batch.length);
      }
    };
    for (const it of items) await walk(it, '');
    return files;
  }

  function addStudentFiles(list) {
    const seen = new Map(state.stu.map(f => [f.content, f]));
    list.forEach(f => {
      const name = f.path.split('/').pop();
      const rec = { name, path: f.path, content: f.content, include: true, note: '' };
      if (IGNORED_PATH.test(f.path)) { rec.include = false; rec.note = 'katalog wynikowy/techniczny'; }
      else if (TEST_PATH.test(f.path)) { rec.include = false; rec.note = 'zasób testowy'; }
      if (seen.has(f.content)) { rec.include = false; rec.note = 'duplikat ' + seen.get(f.content).path; }
      else seen.set(f.content, rec);
      state.stu.push(rec);
    });
    render();
  }

  // ---------- render ----------
  function fileList(ul, files, editable) {
    ul.innerHTML = '';
    files.forEach((f, i) => {
      const li = document.createElement('li');
      const kind = A.classify(f.name, f.content) || '?';
      li.innerHTML = (editable ? `<input type="checkbox" ${f.include ? 'checked' : ''} data-i="${i}" aria-label="Uwzględnij ${esc(f.name)}">` : '') +
        `<span class="tag">${esc(kind.toUpperCase())}</span><span><b>${esc(f.name)}</b>` +
        (f.path && f.path !== f.name ? ` <span class="path">${esc(f.path)}</span>` : '') +
        (f.note ? ` <span class="note">(${esc(f.note)})</span>` : '') + '</span>';
      ul.appendChild(li);
    });
  }

  function occList(occ, max) {
    const items = occ.slice(0, max || 30).map(o => `<li>${o.file ? esc(o.file) + ' — ' : ''}${esc(o.where)}</li>`).join('');
    const more = occ.length > (max || 30) ? `<li>… i ${occ.length - (max || 30)} więcej</li>` : '';
    return `<ul>${items}${more}</ul>`;
  }

  function featureRows(rows, kind) {
    if (!rows.length) return '<p class="empty">Brak pozycji.</p>';
    const groups = new Map();
    rows.forEach(r => { if (!groups.has(r.group)) groups.set(r.group, []); groups.get(r.group).push(r); });
    const order = A.GROUP_ORDER.filter(g => groups.has(g)).concat([...groups.keys()].filter(g => !A.GROUP_ORDER.includes(g)));
    return order.map(g => {
      const items = groups.get(g).sort((a, b) => a.label.localeCompare(b.label, 'pl')).map(r => {
        const badge = (kind !== 'extra' && !r.scored) ? '<span class="badge">nie liczona do oceny</span>' : '';
        let det = '';
        if (kind === 'miss') det = `<details><summary>Gdzie we wzorcu (${r.ref.length})</summary>${occList(r.ref)}</details>`;
        if (kind === 'extra') det = `<details><summary>Gdzie w projekcie (${r.stu.length})</summary>${occList(r.stu)}</details>`;
        if (kind === 'ok') det = `<details><summary>Gdzie w projekcie (${r.stu.length})</summary>${occList(r.stu)}</details>`;
        return `<div class="feat ${kind}${r.scored || kind === 'extra' ? '' : ' unscored'}"><div class="name" title="${esc(r.key)}">${esc(r.label)}${badge}</div>${det}</div>`;
      }).join('');
      return `<h3>${esc(g)}</h3>${items}`;
    }).join('');
  }

  function renderRef(refRes) {
    $('refInfo').textContent = `${state.ref.name} — ${state.ref.files.length} plików, ${refRes.features.size} konstrukcji. ` +
      'Domyślny wzorzec osadzony jest w pliku wzorzec.js (generowany skryptem narzedzia/generuj-wzorzec.mjs).';
    fileList($('refFiles'), state.ref.files, false);
    const skip = new Set(CFG.nieliczone || []);
    const rows = [...refRes.features.values()].map(f => ({ key: f.key, group: f.group, label: f.label, ref: f.occ, stu: f.occ, scored: !skip.has(f.key) }));
    $('refFeatures').innerHTML = featureRows(rows, 'ok').replace(/Gdzie w projekcie/g, 'Gdzie we wzorcu');
  }

  function render() {
    const refRes = A.analyze(state.ref.files);
    renderRef(refRes);

    fileList($('stuFiles'), state.stu, true);
    const included = state.stu.filter(f => f.include);
    $('stuInfo').textContent = state.stu.length ? `Uwzględniono ${included.length} z ${state.stu.length} plików` : '';
    if (!included.length) { $('results').classList.add('hidden'); return; }

    const stuRes = A.analyze(included.map(f => ({ name: f.name, content: f.content })));
    const cmp = A.compare(refRes, stuRes, CFG);
    $('results').classList.remove('hidden');
    $('tGrade').textContent = cmp.grade;
    $('tPct').textContent = cmp.pct.toLocaleString('pl-PL') + '%';
    $('tBar').style.width = cmp.pct + '%';
    $('tMiss').textContent = cmp.missing.filter(r => r.scored).length;
    $('tExtra').textContent = cmp.extra.length;
    $('cMiss').textContent = `(${cmp.missing.length})`;
    $('cExtra').textContent = `(${cmp.extra.length})`;
    $('cOk').textContent = `(${cmp.common.length})`;
    $('cProb').textContent = `(${stuRes.problems.length})`;
    $('pMiss').innerHTML = `<p class="muted">Konstrukcje występujące we wzorcu, których nie znaleziono w projekcie (${cmp.scoredHit} z ${cmp.scoredTotal} liczonych konstrukcji obecnych).</p>` + featureRows(cmp.missing, 'miss');
    $('pExtra').innerHTML = '<p class="muted">Konstrukcje użyte w projekcie, których nie ma we wzorcu.</p>' + featureRows(cmp.extra, 'extra');
    $('pOk').innerHTML = featureRows(cmp.common, 'ok');
    $('pProb').innerHTML = stuRes.problems.length
      ? '<ul class="problems">' + stuRes.problems.map(p => `<li>${esc(p.msg)} <span class="f">${esc(p.file)}</span></li>`).join('') + '</ul>'
      : '<p class="empty">Nie wykryto problemów.</p>';
    const keys = [...new Set(Object.keys(refRes.stats).concat(Object.keys(stuRes.stats)))];
    $('pSize').innerHTML = '<p class="muted">Informacyjnie — liczby wystąpień nie wpływają na ocenę.</p><table><thead><tr><th>Element</th><th class="num">Wzorzec</th><th class="num">Projekt</th></tr></thead><tbody>' +
      keys.map(k => `<tr><td>${esc(k)}</td><td class="num">${refRes.stats[k] || 0}</td><td class="num">${stuRes.stats[k] || 0}</td></tr>`).join('') + '</tbody></table>';
    $('progi').textContent = (CFG.progi || []).map(p => `${p.ocena} od ${p.min}%`).join(', ');
  }

  // ---------- zdarzenia UI ----------
  function setDefaultRef() {
    const w = window.WZORZEC || { nazwa: 'Brak wzorca', pliki: [] };
    state.ref = { name: w.nazwa, files: w.pliki.map(f => ({ name: f.name, path: f.name, content: f.content, include: true })) };
  }

  $('inFiles').addEventListener('change', async (e) => { addStudentFiles(await collect(e.target.files)); e.target.value = ''; });
  $('inDir').addEventListener('change', async (e) => { addStudentFiles(await collect(e.target.files)); e.target.value = ''; });
  $('btnClear').addEventListener('click', () => { state.stu = []; render(); });
  $('stuFiles').addEventListener('change', (e) => {
    const i = e.target.dataset.i;
    if (i !== undefined) { state.stu[+i].include = e.target.checked; render(); }
  });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', async (e) => addStudentFiles(await collect(await filesFromDrop(e.dataTransfer))));

  $('inRef').addEventListener('change', async (e) => {
    const list = await collect(e.target.files);
    if (list.length) state.ref = { name: 'Wzorzec wczytany ręcznie', files: list.map(f => ({ name: f.path.split('/').pop(), path: f.path, content: f.content, include: true })) };
    e.target.value = '';
    render();
  });
  $('btnRefReset').addEventListener('click', () => { setDefaultRef(); render(); });

  document.querySelectorAll('[role=tab]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[role=tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== b.dataset.tab));
  }));
  $('btnPrint').addEventListener('click', () => window.print());

  setDefaultRef();
  render();
})();
