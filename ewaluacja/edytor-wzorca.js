// Edytor wzorca: pliki modeli + lista konstrukcji pomijanych -> zapis wzorzec.js.
(function () {
  'use strict';
  const A = window.Analizator;
  const W = window.Wspolne;
  const $ = (id) => document.getElementById(id);
  const esc = W.esc;

  let wz = W.normalizeWzorzec(window.WZORZEC || { nazwa: 'Wzorzec', pliki: [], pomijane: [] });
  let skip = new Set(wz.pomijane);
  let dirty = false;
  let analysis = null;

  const setDirty = (v) => { dirty = v; $('dirty').classList.toggle('hidden', !v); };

  function renderFiles() {
    const ul = $('files');
    ul.innerHTML = wz.pliki.map((f, i) =>
      `<li><span class="tag">${esc((A.classify(f.name, f.content) || '?').toUpperCase())}</span><b>${esc(f.name)}</b>` +
      `<button type="button" class="rm" data-rm="${i}" aria-label="Usuń ${esc(f.name)}">Usuń</button></li>`).join('') ||
      '<li class="empty">Brak plików — dodaj modele wzorca.</li>';
    $('problems').innerHTML = analysis.problems.length
      ? '<h3>Uwagi techniczne dla wzorca</h3><ul class="problems">' + analysis.problems.map(p => `<li>${esc(p.msg)} <span class="f">${esc(p.file)}</span></li>`).join('') + '</ul>'
      : '';
  }

  function renderFeatures() {
    const rows = [...analysis.features.values()].map(f => ({ key: f.key, group: f.group, label: f.label, ref: f.occ }));
    $('features').innerHTML = W.groupedRows(rows, r => {
      const id = 'k_' + r.key.replace(/[^a-zA-Z0-9_-]/g, '_');
      const s = skip.has(r.key);
      return `<div class="feat ${s ? 'skipped' : 'ok'}" data-row="${esc(r.key)}"><div class="head">` +
        `<input type="checkbox" id="${id}" data-key="${esc(r.key)}" ${s ? 'checked' : ''}>` +
        `<label for="${id}"><span class="name">${esc(r.label)}</span><span class="key">${esc(r.key)}</span></label></div>` +
        `<details><summary>Gdzie we wzorcu (${r.ref.length})</summary>${W.occList(r.ref)}</details></div>`;
    });
    const stale = [...skip].filter(k => !analysis.features.has(k));
    $('stale').innerHTML = stale.length
      ? `<p class="muted">Pominięte klucze nieobecne w obecnych plikach (zostaną zachowane): ${stale.map(esc).join(', ')} <button type="button" id="btnStale">Usuń je z listy</button></p>`
      : '';
    updateSummary();
  }

  function updateSummary() {
    if (!wz.pliki.length) { $('summary').textContent = 'Wzorzec jest pusty — dodaj pliki modeli albo wczytaj wzorzec.js.'; return; }
    const total = analysis.features.size;
    const skipped = [...analysis.features.keys()].filter(k => skip.has(k)).length;
    $('summary').textContent = `${wz.pliki.length} plików · ${total} konstrukcji · pominiętych ${skipped} · liczonych ${total - skipped}`;
  }

  function render() {
    analysis = A.analyze(wz.pliki);
    $('nazwa').value = wz.nazwa;
    renderFiles();
    renderFeatures();
  }

  function addFiles(list) {
    if (!list.length) return;
    list.forEach(f => {
      const name = f.path.split('/').pop();
      const i = wz.pliki.findIndex(p => p.name === name);
      if (i >= 0) wz.pliki[i] = { name, content: f.content };
      else wz.pliki.push({ name, content: f.content });
    });
    setDirty(true);
    render();
  }

  // ---------- miejsce zapisu ----------
  // Przeglądarka nie zna ścieżki katalogu strony, dlatego zapamiętujemy uchwyt ostatnio
  // otwartego/zapisanego pliku wzorzec.js (IndexedDB) i otwieramy okno wyboru w jego katalogu.
  // Dodatkowo `id` okna sprawia, że Chrome/Edge pamiętają ostatnio użyty katalog.
  const PICKER = { id: 'wzorzec-js', types: [{ description: 'Wzorzec (JavaScript)', accept: { 'text/javascript': ['.js'] } }] };
  const FS_API = typeof window.showSaveFilePicker === 'function';
  let lastHandle = null;

  function idb(mode, fn) {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('edytor-wzorca', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('uchwyty');
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          try {
            const tx = req.result.transaction('uchwyty', mode);
            const r = fn(tx.objectStore('uchwyty'));
            tx.oncomplete = () => resolve(r && 'result' in r ? r.result : null);
            tx.onerror = () => resolve(null);
          } catch (e) { resolve(null); }
        };
      } catch (e) { resolve(null); }
    });
  }
  const loadHandle = () => idb('readonly', s => s.get('wzorzec'));
  const storeHandle = (h) => { lastHandle = h; showSaveInfo(); return idb('readwrite', s => s.put(h, 'wzorzec')); };

  // Pełna ścieżka wzorzec.js obok tej strony (tylko przy otwarciu z dysku, file://).
  function targetPath() {
    if (location.protocol !== 'file:') return null;
    let p = decodeURIComponent(location.pathname);
    p = p.slice(0, p.lastIndexOf('/') + 1) + 'wzorzec.js';
    if (/^\/[A-Za-z]:\//.test(p)) return p.slice(1).replace(/\//g, '\\');          // Windows: C:\...
    if (location.host) return '\\\\' + location.host + p.replace(/\//g, '\\');      // UNC: \\serwer\...
    return p;                                                                          // Linux / macOS
  }
  async function copyPath() {
    const p = targetPath();
    if (!p) return false;
    try { await navigator.clipboard.writeText(p); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = p; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove();
      if (!ok) return false;
    }
    $('copyInfo').textContent = '✓ skopiowano — wklej w pole „Nazwa pliku” okna zapisu';
    return true;
  }

  function showSaveInfo() {
    $('ffHelp').classList.toggle('hidden', FS_API);
    const p = targetPath();
    $('pathBox').classList.toggle('hidden', !p);
    if (p) $('targetPath').textContent = p;
    $('saveInfo').textContent = !FS_API
      ? 'Ta przeglądarka nie pozwala wybrać miejsca zapisu z poziomu strony — plik trafi do folderu pobranych, chyba że włączysz pytanie o miejsce zapisu (instrukcja poniżej). Wzorzec musi leżeć w katalogu ewaluacja.'
      : lastHandle
        ? `Okno zapisu otworzy się w katalogu ostatnio użytego pliku „${lastHandle.name}”. Wzorzec dla strony ewaluacji musi leżeć obok edytor-wzorca.html.`
        : 'Przy pierwszym zapisie (lub wczytaniu) wskaż katalog ewaluacja, w którym leży edytor-wzorca.html — kolejne okna otworzą się już w nim.';
  }

  async function openJs() {
    if (!FS_API) { $('inJs').click(); return; }
    let h;
    try {
      [h] = await window.showOpenFilePicker({ ...PICKER, startIn: lastHandle || undefined });
    } catch (e) {
      if (e.name !== 'AbortError') $('inJs').click();
      return;
    }
    await loadJsFile(await h.getFile());
    storeHandle(h);
  }

  async function loadJsFile(f) {
    if (dirty && !confirm('Porzucić niezapisane zmiany i wczytać ' + f.name + '?')) return;
    try {
      wz = W.parseWzorzecJs(await f.text());
      skip = new Set(wz.pomijane);
      setDirty(false);
      render();
    } catch (err) { alert('Nie udało się wczytać ' + f.name + ': ' + err.message); }
  }

  async function save() {
    wz.nazwa = $('nazwa').value.trim() || 'Wzorzec';
    wz.pomijane = [...skip].sort();
    const text = W.serializeWzorzec(wz);
    if (FS_API) {
      try {
        const h = await window.showSaveFilePicker({ ...PICKER, suggestedName: 'wzorzec.js', startIn: lastHandle || undefined });
        const w = await h.createWritable();
        await w.write(text);
        await w.close();
        setDirty(false);
        storeHandle(h);
        $('saveInfo').textContent = `Zapisano „${h.name}” (${new Date().toLocaleTimeString('pl-PL')}). Odśwież index.html, aby użyć nowego wzorca.`;
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
        // inny błąd (np. zablokowany katalog) — zwykłe pobranie
      }
    }
    await copyPath();   // Firefox/Safari: ścieżka do wklejenia w oknie zapisu
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
    a.download = 'wzorzec.js';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    setDirty(false);
  }

  // ---------- zdarzenia ----------
  $('features').addEventListener('change', (e) => {
    const k = e.target.dataset.key;
    if (!k) return;
    if (e.target.checked) skip.add(k); else skip.delete(k);
    const row = e.target.closest('.feat');
    row.classList.toggle('skipped', e.target.checked);
    row.classList.toggle('ok', !e.target.checked);
    setDirty(true);
    updateSummary();
  });
  $('stale').addEventListener('click', (e) => {
    if (e.target.id !== 'btnStale') return;
    skip = new Set([...skip].filter(k => analysis.features.has(k)));
    setDirty(true);
    renderFeatures();
  });
  $('btnAll').addEventListener('click', () => { analysis.features.forEach((_, k) => skip.add(k)); setDirty(true); renderFeatures(); });
  $('btnNone').addEventListener('click', () => { analysis.features.forEach((_, k) => skip.delete(k)); setDirty(true); renderFeatures(); });
  $('files').addEventListener('click', (e) => {
    const i = e.target.dataset.rm;
    if (i === undefined) return;
    wz.pliki.splice(+i, 1);
    setDirty(true);
    render();
  });
  $('btnClearFiles').addEventListener('click', () => {
    if (wz.pliki.length && !confirm('Usunąć wszystkie pliki z wzorca? (pliki na dysku pozostaną nietknięte)')) return;
    wz.pliki = [];
    setDirty(true);
    render();
  });
  $('nazwa').addEventListener('input', () => { wz.nazwa = $('nazwa').value; setDirty(true); });
  $('inFiles').addEventListener('change', async (e) => { addFiles(await W.collect(e.target.files)); e.target.value = ''; });
  $('inDir').addEventListener('change', async (e) => { addFiles(await W.collect(e.target.files)); e.target.value = ''; });
  $('inJs').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) await loadJsFile(f);
  });
  $('btnOpen').addEventListener('click', openJs);
  $('btnCopyPath').addEventListener('click', async () => {
    if (!(await copyPath())) $('copyInfo').textContent = 'nie udało się skopiować — zaznacz ścieżkę ręcznie';
  });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', async (e) => addFiles(await W.collect(await W.filesFromDrop(e.dataTransfer))));
  $('btnSave').addEventListener('click', save);
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  render();
  showSaveInfo();
  if (FS_API) loadHandle().then(h => { if (h) { lastHandle = h; showSaveInfo(); } });
})();
