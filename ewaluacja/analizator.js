// Analizator projektów Camunda 8 (BPMN, DMN, formularze) — działa w całości w przeglądarce.
// Wynik: mapa konstrukcji { klucz -> { key, group, label, occ:[{file, where}] } },
// lista uwag technicznych oraz statystyki rozmiaru projektu.
(function (global) {
  'use strict';

  const NS_BPMN = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
  const NS_ZEEBE = 'http://camunda.org/schema/zeebe/1.0';

  const G = {
    STR: 'Struktura procesu',
    EVT: 'Zdarzenia',
    ACT: 'Zadania i aktywności',
    FLOW: 'Bramki i przepływ sterowania',
    DATA: 'Dane i mapowania zmiennych',
    COMM: 'Komunikacja, sygnały i błędy',
    INT: 'Integracje (konektory, job workery)',
    DMN: 'Reguły biznesowe (DMN)',
    FORM: 'Formularze',
  };
  const GROUP_ORDER = [G.STR, G.EVT, G.ACT, G.FLOW, G.DATA, G.COMM, G.INT, G.DMN, G.FORM];

  const EVENT_KIND = {
    startEvent: 'Zdarzenie początkowe',
    endEvent: 'Zdarzenie końcowe',
    intermediateCatchEvent: 'Zdarzenie pośrednie odbierające',
    intermediateThrowEvent: 'Zdarzenie pośrednie wysyłające',
    boundaryEvent: 'Zdarzenie brzegowe',
  };
  const EVENT_DEF = {
    none: 'zwykłe (none)', message: 'komunikat', timer: 'timer', error: 'błąd', signal: 'sygnał',
    escalation: 'eskalacja', conditional: 'warunek', compensate: 'kompensacja', link: 'łącze (link)',
    terminate: 'terminate', cancel: 'anulowanie', multiple: 'wielokrotne',
  };
  const ACTIVITY = {
    task: 'Zadanie ogólne (bez typu)',
    userTask: 'Zadanie użytkownika (user task)',
    serviceTask: 'Zadanie usługowe (service task)',
    scriptTask: 'Zadanie skryptowe (script task)',
    businessRuleTask: 'Zadanie reguły biznesowej (business rule task)',
    sendTask: 'Zadanie wysyłania (send task)',
    receiveTask: 'Zadanie odbierania (receive task)',
    manualTask: 'Zadanie manualne (manual task)',
    callActivity: 'Aktywność wywołująca (call activity)',
    subProcess: 'Podproces osadzony (embedded subprocess)',
    transaction: 'Transakcja',
    adHocSubProcess: 'Podproces ad-hoc',
  };
  const GATEWAY = {
    exclusiveGateway: 'Bramka XOR (rozłączna)',
    parallelGateway: 'Bramka AND (równoległa)',
    inclusiveGateway: 'Bramka OR (inkluzywna)',
    eventBasedGateway: 'Bramka oparta na zdarzeniach',
    complexGateway: 'Bramka złożona',
  };
  const FORM_FIELD = {
    textfield: 'pole tekstowe', textarea: 'pole wielowierszowe', number: 'liczba', radio: 'przyciski opcji (radio)',
    checkbox: 'pole wyboru (checkbox)', checklist: 'lista wyboru (checklist)', select: 'lista rozwijana (select)',
    taglist: 'lista tagów', datetime: 'data / czas', text: 'tekst statyczny', html: 'HTML', group: 'grupa pól',
    dynamiclist: 'lista dynamiczna', table: 'tabela', button: 'przycisk', separator: 'separator', spacer: 'odstęp',
    image: 'obraz', iframe: 'iframe', expression: 'pole wyrażenia', filepicker: 'wybór pliku',
    documentPreview: 'podgląd dokumentu',
  };

  // ---------- pomocnicze ----------
  const kids = (el) => Array.from(el.children || []);
  const ext = (el) => kids(el).find(c => c.localName === 'extensionElements' && c.namespaceURI === NS_BPMN);
  const zeebe = (el, name) => {
    const e = ext(el);
    return e ? Array.from(e.getElementsByTagNameNS(NS_ZEEBE, name)) : [];
  };
  const isTemplate = (el) => !!(el.getAttributeNS(NS_ZEEBE, 'modelerTemplate') || el.getAttribute('zeebe:modelerTemplate'));
  const label = (el) => {
    const n = el.getAttribute('name');
    const id = el.getAttribute('id');
    return n ? `${n.replace(/\s+/g, ' ').trim()} (${id})` : id || el.localName;
  };
  const eventDefs = (el) => kids(el).filter(c => /EventDefinition$/.test(c.localName));
  const defType = (el) => {
    const d = eventDefs(el);
    if (d.length === 0) return 'none';
    if (d.length > 1) return 'multiple';
    return d[0].localName.replace('EventDefinition', '');
  };
  const processOf = (el) => {
    let p = el;
    while (p && !(p.localName === 'process' && p.namespaceURI === NS_BPMN)) p = p.parentNode;
    return p;
  };
  const stripFeel = (s) => (s || '').trim().replace(/^=\s*/, '').replace(/^"(.*)"$/, '$1');

  function newResult() {
    return { features: new Map(), problems: [], stats: {}, files: [] };
  }
  function add(res, key, group, lbl, file, where, opts) {
    let f = res.features.get(key);
    if (!f) {
      f = { key, group, label: lbl, occ: [], desc: opts && opts.desc };
      res.features.set(key, f);
    }
    f.occ.push({ file, where });
  }
  const stat = (res, k, n) => { res.stats[k] = (res.stats[k] || 0) + (n === undefined ? 1 : n); };
  const problem = (res, file, msg) => res.problems.push({ file, msg });

  // ---------- rozpoznanie typu pliku ----------
  function classify(name, content) {
    const low = name.toLowerCase();
    if (low.endsWith('.bpmn')) return 'bpmn';
    if (low.endsWith('.dmn')) return 'dmn';
    if (low.endsWith('.form')) return 'form';
    const t = content.trimStart();
    if (t.startsWith('<') && t.includes(NS_BPMN)) return 'bpmn';
    if (t.startsWith('<') && /\/DMN\//.test(t.slice(0, 2000))) return 'dmn';
    if (t.startsWith('{') && t.includes('"components"')) return 'form';
    return null;
  }

  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const err = doc.getElementsByTagName('parsererror')[0];
    if (err) throw new Error('niepoprawny XML: ' + err.textContent.split('\n')[0].slice(0, 200));
    return doc;
  }

  // ---------- główna analiza ----------
  function analyze(files) {
    const res = newResult();
    const ctx = {
      bpmn: [], dmn: [], forms: [],
      formIdsUsed: new Map(),         // formId -> [where]
      decisionIdsUsed: [],
      calledProcessIds: [],
      processIds: new Set(),
      decisionIds: new Set(),
      formIds: new Map(),             // formId -> file
      msgThrown: [], msgCaught: [],   // {name, proc, file, where}
      sigThrown: [], sigCaught: [],
      errThrown: [], errCaught: [],   // {code, file, where}
    };

    for (const f of files) {
      const kind = classify(f.name, f.content);
      if (!kind) { problem(res, f.name, 'Nierozpoznany typ pliku — pominięto.'); continue; }
      try {
        if (kind === 'form') ctx.forms.push({ file: f.name, json: JSON.parse(f.content) });
        else ctx[kind].push({ file: f.name, doc: parseXml(f.content) });
        res.files.push({ name: f.name, kind });
      } catch (e) {
        problem(res, f.name, 'Błąd wczytywania: ' + e.message);
      }
    }

    ctx.bpmn.forEach(b => analyzeBpmn(res, ctx, b.file, b.doc));
    ctx.dmn.forEach(d => analyzeDmn(res, ctx, d.file, d.doc));
    ctx.forms.forEach(f => analyzeForm(res, ctx, f.file, f.json));
    crossChecks(res, ctx);
    return res;
  }

  function analyzeBpmn(res, ctx, file, doc) {
    const defs = doc.documentElement;
    const all = Array.from(doc.getElementsByTagNameNS(NS_BPMN, '*'));
    const byLocal = (ln) => all.filter(e => e.localName === ln);

    const messages = new Map(byLocal('message').map(m => [m.getAttribute('id'), m]));
    const signals = new Map(byLocal('signal').map(s => [s.getAttribute('id'), s]));
    const errors = new Map(byLocal('error').map(e => [e.getAttribute('id'), e]));

    // --- procesy / pule / tory
    const processes = kids(defs).filter(e => e.localName === 'process');
    processes.forEach(p => {
      const id = p.getAttribute('id');
      ctx.processIds.add(id);
      stat(res, 'Procesy');
      if (p.getAttribute('isExecutable') !== 'true') problem(res, file, `Proces ${label(p)} nie jest oznaczony jako wykonywalny (isExecutable).`);
      else add(res, 'str.executable', G.STR, 'Proces wykonywalny (isExecutable)', file, label(p));
    });
    const participants = byLocal('participant');
    participants.forEach(p => add(res, 'str.pool', G.STR, 'Pula (participant) w kolaboracji', file, label(p)));
    byLocal('collaboration').forEach(c => {
      if (kids(c).filter(e => e.localName === 'participant').length >= 2)
        add(res, 'str.multiPool', G.STR, 'Kilka pul w jednej kolaboracji', file, label(c));
    });
    byLocal('laneSet').forEach(ls => {
      const lanes = kids(ls).filter(e => e.localName === 'lane');
      if (lanes.length >= 2) add(res, 'str.lanes', G.STR, 'Tory (lanes) — podział odpowiedzialności', file, lanes.map(l => l.getAttribute('name') || l.getAttribute('id')).join(', '));
    });
    byLocal('childLaneSet').forEach(ls => add(res, 'str.nestedLanes', G.STR, 'Zagnieżdżone tory', file, label(ls.parentNode)));
    byLocal('messageFlow').forEach(mf => add(res, 'comm.messageFlow', G.COMM, 'Przepływ komunikatów (message flow) między pulami', file, label(mf)));

    // --- artefakty
    const ART = { textAnnotation: 'Adnotacja tekstowa', dataObjectReference: 'Obiekt danych', dataStoreReference: 'Magazyn danych', group: 'Grupa (artefakt)' };
    Object.keys(ART).forEach(ln => byLocal(ln).forEach(e => add(res, 'art.' + ln, G.STR, ART[ln], file, label(e))));

    // --- elementy przepływu w każdym zakresie (proces / podproces)
    const scopes = all.filter(e => e.localName === 'process' || ACTIVITY[e.localName] && /ubProcess$|^transaction$/.test(e.localName));
    scopes.forEach(scope => analyzeScope(res, ctx, file, scope, { messages, signals, errors }));
  }

  function analyzeScope(res, ctx, file, scope, refs) {
    const proc = processOf(scope);
    const procKey = file + '#' + (proc ? proc.getAttribute('id') : '?');
    const elems = kids(scope);
    const flows = elems.filter(e => e.localName === 'sequenceFlow');
    const nodes = elems.filter(e => e.localName !== 'sequenceFlow' && (EVENT_KIND[e.localName] || ACTIVITY[e.localName] || GATEWAY[e.localName]));
    const SKIP = new Set(['sequenceFlow', 'laneSet', 'extensionElements', 'documentation', 'incoming', 'outgoing',
      'textAnnotation', 'association', 'dataObject', 'dataObjectReference', 'dataStoreReference', 'group',
      'ioSpecification', 'property', 'dataInputAssociation', 'dataOutputAssociation', 'multiInstanceLoopCharacteristics',
      'standardLoopCharacteristics', 'category']);
    elems.forEach(e => {
      if (e.namespaceURI !== NS_BPMN || SKIP.has(e.localName) || EVENT_KIND[e.localName] || ACTIVITY[e.localName] || GATEWAY[e.localName]) return;
      add(res, 'bpmn.other.' + e.localName, G.STR, 'Element BPMN: ' + e.localName, file, label(e));
    });

    const outCount = new Map(), inCount = new Map();
    flows.forEach(f => {
      const s = f.getAttribute('sourceRef'), t = f.getAttribute('targetRef');
      outCount.set(s, (outCount.get(s) || 0) + 1);
      inCount.set(t, (inCount.get(t) || 0) + 1);
    });
    const byId = new Map(nodes.map(n => [n.getAttribute('id'), n]));

    const isEventSub = scope.localName === 'subProcess' && scope.getAttribute('triggeredByEvent') === 'true';

    nodes.forEach(n => {
      const ln = n.localName;
      const where = label(n);

      // ===== zdarzenia
      if (EVENT_KIND[ln]) {
        stat(res, 'Zdarzenia');
        const d = defType(n);
        let key = `evt.${ln}.${d}`;
        let lbl = `${EVENT_KIND[ln]} — ${EVENT_DEF[d] || d}`;
        if (ln === 'boundaryEvent') {
          const nonInt = n.getAttribute('cancelActivity') === 'false';
          key += nonInt ? '.nonint' : '.int';
          lbl = `Zdarzenie brzegowe ${nonInt ? 'nieprzerywające' : 'przerywające'} — ${EVENT_DEF[d] || d}`;
        }
        if (ln === 'startEvent' && isEventSub) {
          const nonInt = n.getAttribute('isInterrupting') === 'false';
          key += nonInt ? '.esp.nonint' : '.esp.int';
          lbl = `Start podprocesu zdarzeniowego (${nonInt ? 'nieprzerywający' : 'przerywający'}) — ${EVENT_DEF[d] || d}`;
        }
        add(res, key, G.EVT, lbl, file, where);

        eventDefs(n).forEach(def => {
          const t = def.localName;
          if (t === 'timerEventDefinition') {
            const TD = { timeDuration: 'czas trwania (timeDuration)', timeDate: 'data (timeDate)', timeCycle: 'cykl (timeCycle)' };
            kids(def).forEach(c => { if (TD[c.localName]) add(res, 'timer.' + c.localName, G.EVT, 'Timer: ' + TD[c.localName], file, where + ' = ' + c.textContent.trim()); });
          }
          if (t === 'messageEventDefinition') {
            const m = refs.messages.get(def.getAttribute('messageRef'));
            const name = m && m.getAttribute('name');
            const rec = { name, proc: procKey, file, where };
            if (ln === 'intermediateThrowEvent' || ln === 'endEvent') { if (name) ctx.msgThrown.push(rec); }
            else if (name) ctx.msgCaught.push(rec);
            else problem(res, file, `Zdarzenie ${where} odbiera komunikat, ale nie wskazuje definicji komunikatu (messageRef).`);
            if (m && ln !== 'startEvent' && ln !== 'intermediateThrowEvent' && ln !== 'endEvent') {
              const sub = zeebe(m, 'subscription')[0];
              if (!sub || !sub.getAttribute('correlationKey')) problem(res, file, `Komunikat „${name}” odbierany w ${where} nie ma klucza korelacji (correlationKey).`);
            }
          }
          if (t === 'signalEventDefinition') {
            const s = refs.signals.get(def.getAttribute('signalRef'));
            const rec = { name: s && s.getAttribute('name'), proc: procKey, file, where };
            if (ln === 'intermediateThrowEvent' || ln === 'endEvent') ctx.sigThrown.push(rec); else ctx.sigCaught.push(rec);
          }
          if (t === 'errorEventDefinition') {
            const er = refs.errors.get(def.getAttribute('errorRef'));
            const code = er ? (er.getAttribute('errorCode') || er.getAttribute('name')) : '*';
            if (ln === 'endEvent') ctx.errThrown.push({ code, file, where });
            else ctx.errCaught.push({ code, file, where });
          }
        });
      }

      // ===== aktywności
      if (ACTIVITY[ln]) {
        stat(res, 'Aktywności (zadania, podprocesy)');
        if (ln === 'subProcess' && n.getAttribute('triggeredByEvent') === 'true')
          add(res, 'act.eventSubProcess', G.ACT, 'Podproces zdarzeniowy (event subprocess)', file, where);
        else add(res, 'act.' + ln, G.ACT, ACTIVITY[ln], file, where);

        if (ln === 'userTask') {
          stat(res, 'Zadania użytkownika');
          if (zeebe(n, 'userTask').length) add(res, 'user.camunda', G.ACT, 'Zadanie użytkownika typu „Camunda user task”', file, where);
          const fd = zeebe(n, 'formDefinition')[0];
          if (fd && fd.getAttribute('formId')) {
            const fid = fd.getAttribute('formId');
            add(res, 'user.linkedForm', G.FORM, 'Formularz podpięty do zadania (formId)', file, where + ' → ' + fid);
            if (!ctx.formIdsUsed.has(fid)) ctx.formIdsUsed.set(fid, []);
            ctx.formIdsUsed.get(fid).push({ file, where });
          } else if (fd && fd.getAttribute('formKey')) {
            add(res, 'user.embeddedForm', G.FORM, 'Formularz osadzony (formKey)', file, where);
          } else if (fd && fd.getAttribute('externalReference')) {
            add(res, 'user.externalForm', G.FORM, 'Formularz zewnętrzny (externalReference)', file, where);
          } else problem(res, file, `Zadanie użytkownika ${where} nie ma przypisanego formularza.`);
          if (zeebe(n, 'assignmentDefinition').length) add(res, 'user.assignment', G.ACT, 'Przydział zadania (assignee / candidate groups)', file, where);
          if (zeebe(n, 'taskSchedule').length) add(res, 'user.schedule', G.ACT, 'Termin zadania (due date / follow-up)', file, where);
          if (zeebe(n, 'priorityDefinition').length) add(res, 'user.priority', G.ACT, 'Priorytet zadania użytkownika', file, where);
        }

        const td = zeebe(n, 'taskDefinition')[0];
        if (td) {
          const type = td.getAttribute('type') || '';
          if (type === 'io.camunda:http-json:1') add(res, 'int.http', G.INT, 'Konektor REST (HTTP JSON)', file, where);
          else if (type === 'io.camunda:sendMessage:1') { /* obsłużone niżej, wspólnie ze zdarzeniami */ }
          else if (type.startsWith('io.camunda:')) add(res, 'int.connector.' + type, G.INT, 'Konektor: ' + type, file, where);
          else add(res, 'int.worker', G.INT, 'Zadanie obsługiwane przez job worker (własny typ zadania)', file, where + ' — type: ' + type);
        }
        if (ln === 'scriptTask' && zeebe(n, 'script').length)
          add(res, 'act.script.feel', G.ACT, 'Skrypt jako wyrażenie FEEL z resultVariable', file, where);
        if (ln === 'businessRuleTask') {
          const cd = zeebe(n, 'calledDecision')[0];
          if (cd) {
            add(res, 'act.brt.dmn', G.DMN, 'Wywołanie decyzji DMN z procesu (calledDecision)', file, where + ' → ' + cd.getAttribute('decisionId'));
            ctx.decisionIdsUsed.push({ id: cd.getAttribute('decisionId'), file, where });
          }
        }
        if (ln === 'callActivity') {
          const ce = zeebe(n, 'calledElement')[0];
          if (ce) {
            ctx.calledProcessIds.push({ id: ce.getAttribute('processId'), file, where });
            const noProp = ce.getAttribute('propagateAllChildVariables') === 'false' || ce.getAttribute('propagateAllParentVariables') === 'false';
            if (noProp || zeebe(n, 'ioMapping').length)
              add(res, 'act.call.mapping', G.DATA, 'Jawne przekazywanie zmiennych do/z procesu wywoływanego', file, where);
          }
        }
        if (n.getAttribute('isForCompensation') === 'true') add(res, 'act.compensationHandler', G.ACT, 'Aktywność kompensująca', file, where);
        const mi = kids(n).find(c => c.localName === 'multiInstanceLoopCharacteristics');
        if (mi) {
          const seq = mi.getAttribute('isSequential') === 'true';
          add(res, seq ? 'act.mi.seq' : 'act.mi.par', G.ACT, seq ? 'Wielokrotne wystąpienie sekwencyjne (multi-instance)' : 'Wielokrotne wystąpienie równoległe (multi-instance)', file, where);
        }
        if (kids(n).some(c => c.localName === 'standardLoopCharacteristics')) add(res, 'act.loop', G.ACT, 'Pętla standardowa aktywności', file, where);
      }

      // ===== konektor wysyłania komunikatu (zadanie lub zdarzenie)
      const tdm = zeebe(n, 'taskDefinition')[0];
      if (tdm && tdm.getAttribute('type') === 'io.camunda:sendMessage:1') {
        add(res, 'int.sendMessage', G.INT, 'Konektor wysyłania komunikatu (Send Message)', file, where);
        const inp = zeebe(n, 'input').find(i => i.getAttribute('target') === 'messageName');
        if (inp) ctx.msgThrown.push({ name: stripFeel(inp.getAttribute('source')), proc: procKey, file, where });
      }
      if (ln === 'receiveTask') {
        const m = refs.messages.get(n.getAttribute('messageRef'));
        if (m) ctx.msgCaught.push({ name: m.getAttribute('name'), proc: procKey, file, where });
      }

      // ===== bramki
      if (GATEWAY[ln]) {
        stat(res, 'Bramki');
        const id = n.getAttribute('id');
        const out = outCount.get(id) || 0, inc = inCount.get(id) || 0;
        if (out >= 2) add(res, `gw.${ln}.split`, G.FLOW, GATEWAY[ln] + ' — rozwidlenie', file, where);
        if (inc >= 2) add(res, `gw.${ln}.join`, G.FLOW, GATEWAY[ln] + ' — złączenie', file, where);
        if (out < 2 && inc < 2) problem(res, file, `Bramka ${where} ma tylko jedno wejście i jedno wyjście.`);
        if (n.getAttribute('default')) add(res, 'flow.default', G.FLOW, 'Przepływ domyślny (default flow)', file, where);
      }

      // ===== mapowania zmiennych
      if (!isTemplate(n)) {
        if (zeebe(n, 'input').length) add(res, 'data.input', G.DATA, 'Mapowanie wejściowe zmiennych (input mapping)', file, where);
        if (zeebe(n, 'output').length) add(res, 'data.output', G.DATA, 'Mapowanie wyjściowe zmiennych (output mapping)', file, where);
        const exprs = [];
        zeebe(n, 'input').concat(zeebe(n, 'output')).forEach(m => exprs.push(m.getAttribute('source') || ''));
        zeebe(n, 'script').forEach(s => exprs.push(s.getAttribute('expression') || ''));
        if (exprs.some(x => /^=\s*\{|\bput\s*\(|context put\s*\(|put all\s*\(/.test(x.trim())))
          add(res, 'data.context', G.DATA, 'Zmienne złożone — konteksty FEEL ({…}, put())', file, where);
      }
    });

    // ===== przepływy warunkowe
    flows.forEach(f => {
      const cond = kids(f).find(c => c.localName === 'conditionExpression');
      if (!cond) return;
      const src = byId.get(f.getAttribute('sourceRef'));
      if (src && GATEWAY[src.localName]) add(res, 'flow.condition', G.FLOW, 'Przepływ warunkowy (warunek FEEL na bramce)', file, label(f) + ': ' + cond.textContent.trim());
      else add(res, 'flow.conditionActivity', G.FLOW, 'Przepływ warunkowy wychodzący z aktywności', file, label(f));
    });

    // ===== cykle (pętle) w przepływie — zdarzenie brzegowe traktowane jak wyjście z aktywności
    const adj = new Map();
    const edge = (a, b) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b); };
    flows.forEach(f => edge(f.getAttribute('sourceRef'), f.getAttribute('targetRef')));
    nodes.filter(n => n.localName === 'boundaryEvent').forEach(b => edge(b.getAttribute('attachedToRef'), b.getAttribute('id')));
    const color = new Map();
    const found = [];
    const dfs = (u) => {
      color.set(u, 1);
      for (const v of adj.get(u) || []) {
        if (color.get(v) === 1) found.push(v);
        else if (!color.get(v)) dfs(v);
      }
      color.set(u, 2);
    };
    nodes.forEach(n => { const id = n.getAttribute('id'); if (!color.get(id)) dfs(id); });
    [...new Set(found)].forEach(id => {
      const n = byId.get(id);
      add(res, 'flow.cycle', G.FLOW, 'Pętla w przepływie (powrót do wcześniejszego kroku)', file, 'powrót do: ' + (n ? label(n) : id));
    });
  }

  // ---------- DMN ----------
  function analyzeDmn(res, ctx, file, doc) {
    const ns = doc.documentElement.namespaceURI;
    const by = (ln) => Array.from(doc.getElementsByTagNameNS(ns, ln));
    const decisions = by('decision');
    if (decisions.length >= 2) add(res, 'dmn.multiDecision', G.DMN, 'Kilka decyzji w jednym modelu DMN', file, decisions.map(label).join(', '));
    if (by('informationRequirement').length) add(res, 'dmn.drd', G.DMN, 'Zależności między decyzjami (information requirement)', file, label(decisions[0] || doc.documentElement));
    by('businessKnowledgeModel').forEach(b => add(res, 'dmn.bkm', G.DMN, 'Model wiedzy biznesowej (BKM)', file, label(b)));
    by('inputData').forEach(b => add(res, 'dmn.inputData', G.DMN, 'Dane wejściowe w diagramie DRD (input data)', file, label(b)));
    decisions.forEach(d => {
      ctx.decisionIds.add(d.getAttribute('id'));
      stat(res, 'Decyzje DMN');
      const where = label(d);
      kids(d).forEach(c => {
        if (c.localName === 'literalExpression') add(res, 'dmn.literal', G.DMN, 'Decyzja jako wyrażenie (literal expression)', file, where);
        if (c.localName === 'context') add(res, 'dmn.contextBoxed', G.DMN, 'Decyzja jako kontekst (boxed context)', file, where);
        if (c.localName !== 'decisionTable') return;
        add(res, 'dmn.table', G.DMN, 'Tabela decyzyjna', file, where);
        const hp = c.getAttribute('hitPolicy') || 'UNIQUE';
        add(res, 'dmn.hit.' + hp, G.DMN, 'Polityka trafień: ' + hp, file, where);
        if (c.getAttribute('aggregation')) add(res, 'dmn.aggregation', G.DMN, 'Agregacja wyników (' + c.getAttribute('aggregation') + ')', file, where);
        const inputs = kids(c).filter(x => x.localName === 'input');
        const outputs = kids(c).filter(x => x.localName === 'output');
        const rules = kids(c).filter(x => x.localName === 'rule');
        stat(res, 'Reguły DMN', rules.length);
        if (inputs.length >= 2) add(res, 'dmn.multiInput', G.DMN, 'Tabela z wieloma wejściami', file, `${where}: ${inputs.length} wejść`);
        if (outputs.length >= 2) add(res, 'dmn.multiOutput', G.DMN, 'Tabela z wieloma wyjściami', file, `${where}: ${outputs.length} wyjść`);
        inputs.forEach(i => {
          const ie = kids(i).find(x => x.localName === 'inputExpression');
          const txt = ie ? ie.textContent.trim() : '';
          if (/[a-z]\s*\(/i.test(txt)) add(res, 'dmn.inputFn', G.DMN, 'Funkcja FEEL w wyrażeniu wejściowym', file, `${where}: ${txt}`);
          if (kids(i).some(x => x.localName === 'inputValues')) add(res, 'dmn.allowedValues', G.DMN, 'Dozwolone wartości wejścia/wyjścia', file, where);
        });
        outputs.forEach(o => { if (kids(o).some(x => x.localName === 'outputValues')) add(res, 'dmn.allowedValues', G.DMN, 'Dozwolone wartości wejścia/wyjścia', file, where); });
        let range = false, cmp = false, any = false;
        rules.forEach(r => kids(r).filter(x => x.localName === 'inputEntry').forEach(e => {
          const t = e.textContent.trim();
          if (t === '' || t === '-') any = true;
          if (/[\[\]()]?\s*[^\s]+\s*\.\.\s*[^\s]+\s*[\[\]()]/.test(t)) range = true;
          else if (/^(<|>|<=|>=|!=|not\s*\()/.test(t)) cmp = true;
        }));
        if (range) add(res, 'dmn.range', G.DMN, 'Przedziały w regułach ([a..b[)', file, where);
        if (cmp) add(res, 'dmn.compare', G.DMN, 'Porównania w regułach (<, >=, …)', file, where);
        if (any) add(res, 'dmn.any', G.DMN, 'Reguły z dowolną wartością wejścia („-”)', file, where);
      });
    });
  }

  // ---------- Formularze ----------
  function analyzeForm(res, ctx, file, json) {
    const fid = json.id || file;
    ctx.formIds.set(fid, file);
    stat(res, 'Formularze');
    add(res, 'form.file', G.FORM, 'Formularz Camunda (.form)', file, fid);
    const walk = (comps) => (comps || []).forEach(c => {
      const where = `${fid}: ${c.label || c.key || c.id || c.type}`;
      if (c.type) {
        add(res, 'form.field.' + c.type, G.FORM, 'Pole formularza: ' + (FORM_FIELD[c.type] || c.type), file, where);
        if (!['text', 'html', 'spacer', 'separator', 'group', 'image', 'iframe', 'button'].includes(c.type)) stat(res, 'Pola formularzy');
      }
      const v = c.validate || {};
      if (v.required) add(res, 'form.required', G.FORM, 'Walidacja: pole wymagane', file, where);
      if (v.min !== undefined || v.max !== undefined) add(res, 'form.minmax', G.FORM, 'Walidacja: zakres wartości (min / max)', file, where);
      if (v.minLength !== undefined || v.maxLength !== undefined) add(res, 'form.length', G.FORM, 'Walidacja: długość tekstu', file, where);
      if (v.pattern || v.validationType) add(res, 'form.pattern', G.FORM, 'Walidacja: wzorzec / typ (e-mail, telefon, regex)', file, where);
      if (c.readonly === true) add(res, 'form.readonly', G.FORM, 'Pole tylko do odczytu', file, where);
      if (typeof c.readonly === 'string' && c.readonly.trim().startsWith('=')) add(res, 'form.readonlyExpr', G.FORM, 'Tryb tylko-do-odczytu sterowany wyrażeniem FEEL', file, `${where} (${c.readonly})`);
      if (c.disabled === true) add(res, 'form.disabled', G.FORM, 'Pole wyłączone (disabled)', file, where);
      if (c.valuesExpression) add(res, 'form.valuesExpr', G.FORM, 'Opcje wyboru z wyrażenia FEEL (valuesExpression)', file, where);
      if (c.valuesKey) add(res, 'form.valuesKey', G.FORM, 'Opcje wyboru ze zmiennej procesu (valuesKey)', file, where);
      if (Array.isArray(c.values) && c.values.length) add(res, 'form.valuesStatic', G.FORM, 'Statyczna lista opcji wyboru', file, where);
      if (c.defaultValue !== undefined) add(res, 'form.default', G.FORM, 'Wartość domyślna pola', file, where);
      if ((c.key && c.key.includes('.')) || c.path) add(res, 'form.nestedKey', G.FORM, 'Pola powiązane ze zmienną złożoną (klucz z kropką / path)', file, where);
      if (c.conditional && c.conditional.hide) add(res, 'form.conditional', G.FORM, 'Warunkowe ukrywanie pola', file, where);
      if (c.decimalDigits !== undefined || c.increment !== undefined) add(res, 'form.numberCfg', G.FORM, 'Konfiguracja pola liczbowego (miejsca dziesiętne, krok)', file, where);
      if (c.components) walk(c.components);
    });
    walk(json.components);
  }

  // ---------- zależności między plikami ----------
  function crossChecks(res, ctx) {
    // formularze
    ctx.formIdsUsed.forEach((uses, fid) => {
      if (!ctx.formIds.has(fid)) uses.forEach(u => problem(res, u.file, `Zadanie ${u.where} wskazuje formularz „${fid}”, którego nie ma wśród wczytanych plików.`));
      if (uses.length >= 2) uses.forEach(u => add(res, 'form.reused', G.FORM, 'Ten sam formularz użyty w kilku zadaniach', u.file, u.where + ' → ' + fid));
    });
    ctx.formIds.forEach((file, fid) => {
      if (!ctx.formIdsUsed.has(fid)) problem(res, file, `Formularz „${fid}” nie jest podpięty pod żadne zadanie użytkownika.`);
    });
    ctx.decisionIdsUsed.forEach(u => {
      if (!ctx.decisionIds.has(u.id)) problem(res, u.file, `Zadanie ${u.where} wywołuje decyzję „${u.id}”, której nie ma we wczytanych plikach DMN.`);
    });
    ctx.calledProcessIds.forEach(u => {
      if (!ctx.processIds.has(u.id)) problem(res, u.file, `Aktywność ${u.where} wywołuje proces „${u.id}”, którego nie ma we wczytanych plikach.`);
    });

    // procesy
    if (ctx.processIds.size >= 2) add(res, 'str.multiProcess', G.STR, 'Kilka współpracujących procesów (osobne modele)', '', [...ctx.processIds].join(', '));

    // komunikaty między procesami
    const interPairs = [];
    ctx.msgThrown.forEach(t => ctx.msgCaught.forEach(c => {
      if (t.name && t.name === c.name && t.proc !== c.proc) interPairs.push({ t, c });
    }));
    interPairs.forEach(({ t, c }) => add(res, 'comm.interProcessMsg', G.COMM, 'Komunikacja między procesami za pomocą komunikatów', t.file, `„${t.name}”: ${t.where} → ${c.file}: ${c.where}`));
    interPairs.forEach(a => interPairs.forEach(b => {
      if (a.t.proc === b.c.proc && a.c.proc === b.t.proc && a !== b)
        add(res, 'comm.requestResponse', G.COMM, 'Wzorzec żądanie–odpowiedź między procesami', a.t.file, `„${a.t.name}” → „${b.t.name}”`);
    }));
    ctx.msgCaught.forEach(c => {
      if (!ctx.msgThrown.some(t => t.name === c.name))
        problem(res, c.file, `Komunikat „${c.name}” jest odbierany w ${c.where}, ale żaden wczytany model go nie wysyła (może wysyła go aplikacja/test).`);
    });
    // komunikat z kluczem korelacji (dla odbiorów pośrednich) – liczone z definicji komunikatów
    ctx.bpmn.forEach(b => Array.from(b.doc.getElementsByTagNameNS(NS_BPMN, 'message')).forEach(m => {
      const sub = zeebe(m, 'subscription')[0];
      if (sub && sub.getAttribute('correlationKey')) add(res, 'comm.correlationKey', G.COMM, 'Komunikat z kluczem korelacji (correlationKey)', b.file, `${m.getAttribute('name')}: ${sub.getAttribute('correlationKey')}`);
    }));

    // sygnały
    ctx.sigThrown.forEach(t => ctx.sigCaught.forEach(c => {
      if (t.name && t.name === c.name) add(res, 'comm.signal', G.COMM, 'Sygnał rozgłaszany i odbierany (np. anulowanie gałęzi)', t.file, `„${t.name}”: ${t.where} → ${c.where}`);
    }));

    // błędy
    ctx.errThrown.forEach(t => ctx.errCaught.forEach(c => {
      if (c.code === '*' || c.code === t.code) add(res, 'comm.errorHandled', G.COMM, 'Błąd zgłoszony zdarzeniem końcowym i obsłużony (zdarzenie brzegowe / podproces)', t.file, `${t.code}: ${t.where} → ${c.file}: ${c.where}`);
    }));
    ctx.errThrown.forEach(t => {
      if (!ctx.errCaught.some(c => c.code === '*' || c.code === t.code)) problem(res, t.file, `Błąd „${t.code}” zgłaszany w ${t.where} nie jest nigdzie obsłużony.`);
    });
  }

  // ---------- porównanie ----------
  function compare(ref, stu, cfg) {
    const skip = new Set((cfg && cfg.nieliczone) || []);
    const missing = [], common = [], extra = [];
    ref.features.forEach((f, k) => {
      const s = stu.features.get(k);
      const row = { key: k, group: f.group, label: f.label, ref: f.occ, stu: s ? s.occ : [], scored: !skip.has(k) };
      (s ? common : missing).push(row);
    });
    stu.features.forEach((f, k) => {
      if (!ref.features.has(k)) extra.push({ key: k, group: f.group, label: f.label, ref: [], stu: f.occ, scored: false });
    });
    const scoredTotal = missing.concat(common).filter(r => r.scored).length;
    const scoredHit = common.filter(r => r.scored).length;
    const pct = scoredTotal ? Math.round(1000 * scoredHit / scoredTotal) / 10 : 0;
    const progi = (cfg && cfg.progi) || [];
    const grade = (progi.find(p => pct >= p.min) || { ocena: '—' }).ocena;
    return { missing, common, extra, pct, grade, scoredTotal, scoredHit };
  }

  global.Analizator = { analyze, compare, classify, GROUP_ORDER };
})(window);
