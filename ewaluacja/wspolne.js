// Kod wspólny dla index.html i edytor-wzorca.html:
// wczytywanie plików (także ZIP i folderów), odczyt/zapis wzorzec.js, wspólne fragmenty widoku.
(function (global) {
  'use strict';

  const SUPPORTED = /\.(bpmn|dmn|form)$/i;
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- ZIP (bez bibliotek: DecompressionStream) ----------
  async function inflateRaw(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
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
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      const data = u8.subarray(start, start + csize);
      let raw;
      if (method === 0) raw = data;
      else if (method === 8) raw = await inflateRaw(data);
      else continue;
      out.push({ path: name, content: dec.decode(raw) });
    }
    return out;
  }

  // ---------- zbieranie plików modeli ----------
  async function collect(fileList) {
    const out = [];
    for (const f of fileList) {
      const path = (f.webkitRelativePath || f._path || f.name).replace(/\\/g, '/');
      try {
        if (/\.zip$/i.test(f.name)) {
          (await readZip(await f.arrayBuffer())).forEach(e => out.push({ path: f.name + '/' + e.path, content: e.content }));
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

  // ---------- wzorzec.js ----------
  // Format: window.WZORZEC = { nazwa, pomijane: [klucz, ...], wagi: { klucz: liczba }, pliki: [{name, content}] };
  // Wagi: 0,0–99,9 z jednym miejscem po przecinku; brak wpisu = waga domyślna 1,0.
  const WAGA_DOMYSLNA = 1;
  const WAGA_MAX = 99.9;
  const roundWaga = (n) => Math.round(n * 10) / 10;
  // "2,5" / "2.5" / "2" -> 2.5; niepoprawny tekst -> null
  function parseWaga(s) {
    const t = String(s).trim().replace('.', ',');
    if (!/^\d{1,2}(,\d)?$/.test(t)) return null;
    const n = roundWaga(parseFloat(t.replace(',', '.')));
    return n >= 0 && n <= WAGA_MAX ? n : null;
  }
  const formatWaga = (n) => roundWaga(n).toFixed(1).replace('.', ',');
  const waga = (wagi, key) => (wagi && Object.prototype.hasOwnProperty.call(wagi, key) ? wagi[key] : WAGA_DOMYSLNA);

  function normalizeWagi(w) {
    const out = {};
    if (w && typeof w === 'object') Object.keys(w).sort().forEach(k => {
      const n = Number(w[k]);
      if (Number.isFinite(n) && n >= 0 && n <= WAGA_MAX && roundWaga(n) !== WAGA_DOMYSLNA) out[k] = roundWaga(n);
    });
    return out;
  }
  function normalizeWzorzec(w) {
    w = w || {};
    return {
      nazwa: w.nazwa || 'Wzorzec',
      pliki: Array.isArray(w.pliki) ? w.pliki.filter(f => f && f.name && typeof f.content === 'string') : [],
      pomijane: Array.isArray(w.pomijane) ? w.pomijane.filter(k => typeof k === 'string') : [],
      wagi: normalizeWagi(w.wagi),
    };
  }
  // Odczyt pliku wzorzec.js bez wykonywania kodu: wycinamy literał JSON.
  function parseWzorzecJs(text) {
    const at = text.indexOf('window.WZORZEC');
    const start = text.indexOf('{', at < 0 ? 0 : at);
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('nie znaleziono definicji window.WZORZEC');
    return normalizeWzorzec(JSON.parse(text.slice(start, end + 1)));
  }
  function serializeWzorzec(w) {
    const data = normalizeWzorzec(w);
    return '// Wzorzec projektu dla strony ewaluacji (index.html).\n' +
      '// Edytuj za pomocą edytor-wzorca.html albo wygeneruj: node ewaluacja/narzedzia/generuj-wzorzec.mjs\n' +
      '// Zapisano: ' + new Date().toISOString() + '\n' +
      'window.WZORZEC = ' + JSON.stringify({ nazwa: data.nazwa, pomijane: data.pomijane, wagi: data.wagi, pliki: data.pliki }, null, 1) + ';\n';
  }

  // ---------- widok konstrukcji ----------
  function occList(occ, max) {
    max = max || 30;
    const items = occ.slice(0, max).map(o => `<li>${o.file ? esc(o.file) + ' — ' : ''}${esc(o.where)}</li>`).join('');
    const more = occ.length > max ? `<li>… i ${occ.length - max} więcej</li>` : '';
    return `<ul>${items}${more}</ul>`;
  }
  // Grupuje wiersze { group, label, ... } wg kolejności grup analizatora; rowHtml(r) zwraca HTML jednego wiersza.
  // opts.collapsed (Set nazw grup) włącza zwijane grupy; opts.groupInfo(g, rows) dodaje tekst w nagłówku grupy.
  function groupedRows(rows, rowHtml, opts) {
    if (!rows.length) return '<p class="empty">Brak pozycji.</p>';
    const order0 = global.Analizator.GROUP_ORDER;
    const groups = new Map();
    rows.forEach(r => { if (!groups.has(r.group)) groups.set(r.group, []); groups.get(r.group).push(r); });
    const order = order0.filter(g => groups.has(g)).concat([...groups.keys()].filter(g => !order0.includes(g)));
    return order.map(g => {
      const list = groups.get(g).sort((a, b) => a.label.localeCompare(b.label, 'pl'));
      const body = list.map(rowHtml).join('');
      if (!opts || !opts.collapsed) return `<h3>${esc(g)}</h3>` + body;
      const info = opts.groupInfo ? opts.groupInfo(g, list) : `${list.length}`;
      return `<details class="fgroup" data-group="${esc(g)}"${opts.collapsed.has(g) ? '' : ' open'}>` +
        `<summary><h3>${esc(g)}</h3><span class="ginfo">${info}</span></summary>${body}</details>`;
    }).join('');
  }

  // Zwijane grupy: zapamiętywanie stanu (localStorage, jeśli dostępny) i przyciski „zwiń/rozwiń wszystkie”.
  function collapsibleGroups(container, storageKey, onChange) {
    let collapsed;
    try { collapsed = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch (e) { collapsed = new Set(); }
    const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify([...collapsed])); } catch (e) { /* brak dostępu */ } };
    container.addEventListener('toggle', (e) => {
      const d = e.target;
      if (!d.classList || !d.classList.contains('fgroup')) return;
      if (d.open) collapsed.delete(d.dataset.group); else collapsed.add(d.dataset.group);
      persist();
    }, true);
    const setAll = (open) => {
      container.querySelectorAll('details.fgroup').forEach(d => {
        d.open = open;
        if (open) collapsed.delete(d.dataset.group); else collapsed.add(d.dataset.group);
      });
      persist();
      if (onChange) onChange();
    };
    return { collapsed, expandAll: () => setAll(true), collapseAll: () => setAll(false) };
  }

  global.Wspolne = { SUPPORTED, esc, readZip, collect, filesFromDrop, normalizeWzorzec, parseWzorzecJs, serializeWzorzec, occList, groupedRows, collapsibleGroups,
    WAGA_DOMYSLNA, parseWaga, formatWaga, waga, normalizeWagi };
})(window);
