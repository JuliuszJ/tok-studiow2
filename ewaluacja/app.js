// Interfejs strony ewaluacji: wczytywanie projektu studenta, porównanie ze wzorcem, prezentacja.
(function () {
  'use strict';
  const A = window.Analizator;
  const W = window.Wspolne;
  const CFG = window.KONFIGURACJA || { progi: [] };
  const $ = (id) => document.getElementById(id);
  const esc = W.esc;

  const IGNORED_PATH = /(^|\/)(target|build|out|node_modules|\.git|\.idea|\.mvn|bin)\//i;
  const TEST_PATH = /(^|\/)src\/test\//i;

  const state = {
    ref: { name: '', files: [], pomijane: [], wagi: {} },
    stu: [],                                   // [{name, path, content, include, note}]
  };

  function addStudentFiles(list) {
    const seen = new Map(state.stu.map(f => [f.content, f]));
    list.forEach(f => {
      const rec = { name: f.path.split('/').pop(), path: f.path, content: f.content, include: true, note: '' };
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

  const refGroups = W.collapsibleGroups($('refFeatures'), 'index.wzorzec.zwiniete');

  function featureRows(rows, kind, opts) {
    const where = kind === 'miss' ? 'Gdzie we wzorcu' : kind === 'ref' ? 'Gdzie we wzorcu' : 'Gdzie w projekcie';
    const cls = kind === 'ref' ? 'ok' : kind;
    const showW = kind !== 'extra' && Object.keys(state.ref.wagi).length > 0;
    return W.groupedRows(rows, r => {
      const occ = kind === 'miss' || kind === 'ref' ? r.ref : r.stu;
      const badge = showW ? `<span class="badge">waga ${W.formatWaga(W.waga(state.ref.wagi, r.key))}</span>` : '';
      return `<div class="feat ${cls}"><div class="name" title="${esc(r.key)}">${esc(r.label)}${badge}</div>` +
        `<details><summary>${where} (${occ.length})</summary>${W.occList(occ)}</details></div>`;
    }, opts);
  }

  function renderRef(refRes) {
    const skip = new Set(state.ref.pomijane);
    const rows = [...refRes.features.values()].filter(f => !skip.has(f.key))
      .map(f => ({ key: f.key, group: f.group, label: f.label, ref: f.occ }));
    const skipped = refRes.features.size - rows.length;
    const sumAll = rows.reduce((a, r) => a + W.waga(state.ref.wagi, r.key), 0);
    $('refInfo').textContent = `${state.ref.name} — ${state.ref.files.length} plików, ${rows.length} konstrukcji liczonych` +
      `, suma wag ${W.formatWaga(sumAll)}` +
      (skipped ? `, ${skipped} pominiętych (ustawienia w edytorze wzorca).` : '.');
    fileList($('refFiles'), state.ref.files, false);
    const sumW = (l) => W.formatWaga(l.reduce((a, r) => a + W.waga(state.ref.wagi, r.key), 0));
    $('refFeatures').innerHTML = featureRows(rows, 'ref', { collapsed: refGroups.collapsed, groupInfo: (g, l) => `${l.length} konstrukcji · suma wag ${sumW(l)}` });
  }

  function render() {
    const refRes = A.analyze(state.ref.files);
    renderRef(refRes);

    fileList($('stuFiles'), state.stu, true);
    const included = state.stu.filter(f => f.include);
    $('stuInfo').textContent = state.stu.length ? `Uwzględniono ${included.length} z ${state.stu.length} plików` : '';
    if (!included.length) { $('results').classList.add('hidden'); return; }

    const stuRes = A.analyze(included.map(f => ({ name: f.name, content: f.content })));
    const cmp = A.compare(refRes, stuRes, CFG, state.ref.pomijane, state.ref.wagi);
    $('results').classList.remove('hidden');
    $('tGrade').textContent = cmp.grade;
    $('tPct').textContent = cmp.pct.toLocaleString('pl-PL') + '%';
    $('tBar').style.width = cmp.pct + '%';
    $('tMiss').textContent = cmp.missing.length;
    $('tExtra').textContent = cmp.extra.length;
    $('cMiss').textContent = `(${cmp.missing.length})`;
    $('cExtra').textContent = `(${cmp.extra.length})`;
    $('cOk').textContent = `(${cmp.common.length})`;
    $('cProb').textContent = `(${stuRes.problems.length})`;
    $('tPctLabel').textContent = cmp.weighted ? 'Pokrycie konstrukcji wzorca (ważone)' : 'Pokrycie konstrukcji wzorca';
    $('pMiss').innerHTML = `<p class="muted">Konstrukcje występujące we wzorcu, których nie znaleziono w projekcie (obecnych ${cmp.scoredHit} z ${cmp.scoredTotal}` +
      (cmp.weighted ? `; suma wag ${W.formatWaga(cmp.weightHit)} z ${W.formatWaga(cmp.weightTotal)}` : '') + ').</p>' + featureRows(cmp.missing, 'miss');
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

  // ---------- wzorzec ----------
  function setRef(w) {
    const n = W.normalizeWzorzec(w);
    state.ref = { name: n.nazwa, pomijane: n.pomijane, wagi: n.wagi, files: n.pliki.map(f => ({ name: f.name, path: f.name, content: f.content })) };
  }
  const setDefaultRef = () => setRef(window.WZORZEC || { nazwa: 'Brak wzorca (brak pliku wzorzec.js)' });

  // ---------- zdarzenia UI ----------
  $('inFiles').addEventListener('change', async (e) => { addStudentFiles(await W.collect(e.target.files)); e.target.value = ''; });
  $('inDir').addEventListener('change', async (e) => { addStudentFiles(await W.collect(e.target.files)); e.target.value = ''; });
  $('btnClear').addEventListener('click', () => { state.stu = []; render(); });
  $('stuFiles').addEventListener('change', (e) => {
    const i = e.target.dataset.i;
    if (i !== undefined) { state.stu[+i].include = e.target.checked; render(); }
  });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', async (e) => addStudentFiles(await W.collect(await W.filesFromDrop(e.dataTransfer))));

  $('inRef').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    const js = files.find(f => /\.js$/i.test(f.name));
    try {
      if (js) setRef(W.parseWzorzecJs(await js.text()));
      else {
        const list = await W.collect(files);
        if (list.length) setRef({ nazwa: 'Wzorzec wczytany z plików modeli', pliki: list.map(f => ({ name: f.path.split('/').pop(), content: f.content })) });
      }
    } catch (err) { alert('Nie udało się wczytać wzorca: ' + err.message); }
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
