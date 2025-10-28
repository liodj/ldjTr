// app.js
'use strict';

(() => {
  // === 기본값 ===
  const DEFAULTS = {
    model: 'gemini-2.5-flash',
    explainModel: 'gemini-2.0-flash-exp',  // 해설용 모델
    temperature: 0.2,
    topP: 0.95,
    maxTokens: 2048,
    explainMaxTokens: 4096,  // 해설용 maxTokens (길어진 응답 대비)
    tone: 'neutral',   // neutral | formal | casual
    variety: 'auto',   // auto | us | uk
    preserve: true,
    customPrompt: ''   // 사용자 정의 추가 프롬프트
  };

  const selected = new Set(); // 체크된 라인 인덱스 보관

  // === 셀렉터 ===
  const $ = (s) => document.querySelector(s);
  const el = {
    apiKey: $('#apiKey'), keyMsg: $('#keyMsg'), saveKey: $('#saveKey'), toggleKey: $('#toggleKey'), testKey: $('#testKey'),
    src: $('#srcLang'), tgt: $('#tgtLang'), note: $('#noteInput'), send: $('#sendBtn'),
    origList: $('#origList'), tranList: $('#tranList'), exportBtn: $('#exportBtn'), clearBtn: $('#clearBtn'), modelBadge: $('#modelBadge'),
    gSrc: $('#gSrc'), gTgt: $('#gTgt'), gWhole: $('#gWhole'), gAdd: $('#gAdd'), gClear: $('#gClear'), gList: $('#gList'), gCount: $('#glossCount'),
    installBtn: $('#installBtn'),
    stModel: $('#stModel'), stExplainModel: $('#stExplainModel'), stTone: $('#stTone'), stVariety: $('#stVariety'), stPreserve: $('#stPreserve'),
    stTemp: $('#stTemp'), stTopP: $('#stTopP'), stMaxTok: $('#stMaxTok'), stExplainMaxTok: $('#stExplainMaxTok'), stCustomPrompt: $('#stCustomPrompt'),
    stTempVal: $('#stTempVal'), stTopPVal: $('#stTopPVal'),
    btnSaveSettings: $('#btnSaveSettings'),
    explainModal: $('#explainModal'), explainContent: $('#explainContent'), explainClose: $('#explainClose'),
    layoutMode: $('#layoutMode'),
    resSplit: $('#resSplit'),
    resPair: $('#resPair'),
    pairList: $('#pairList'),
    copyMode: $('#copyMode'),
    btnCopySel: $('#btnCopySel'),
    btnDeleteSel: $('#btnDeleteSel'),
    btnSaveNote: $('#btnSaveNote'),
    btnLoadNote: $('#btnLoadNote'),
    selToggle: $('#selToggle'),
    // 탭 관련 요소들
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
  };

  // === localStorage 래퍼 ===
  const LS = {
    get k(){ return localStorage.getItem('gemini_key') || ''; },
    set k(v){ localStorage.setItem('gemini_key', v || ''); },
    get src(){ return localStorage.getItem('src') || 'auto'; },
    set src(v){ localStorage.setItem('src', v); },
    get tgt(){ return localStorage.getItem('tgt') || 'ko'; },
    set tgt(v){ localStorage.setItem('tgt', v); },
    get lines(){ try { return JSON.parse(localStorage.getItem('lines') || '[]'); } catch { return []; } },
    set lines(v){ localStorage.setItem('lines', JSON.stringify(v || [])); },
    get savedNotes(){ try { return JSON.parse(localStorage.getItem('saved_notes') || '{}'); } catch { return {}; } },
    set savedNotes(v){ localStorage.setItem('saved_notes', JSON.stringify(v || {})); },
    get glossary(){ try { return JSON.parse(localStorage.getItem('glossary') || '[]'); } catch { return []; } },
    set glossary(v){ localStorage.setItem('glossary', JSON.stringify(v || [])); },
    get settings(){ try { return JSON.parse(localStorage.getItem('settings') || 'null') || DEFAULTS; } catch { return DEFAULTS; } },
    set settings(v){ localStorage.setItem('settings', JSON.stringify(v || DEFAULTS)); },
    get layout(){ return localStorage.getItem('layout') || 'pair'; },
    set layout(v){ localStorage.setItem('layout', v); },
  };

  // === 초기 렌더 ===
  if (el.apiKey) el.apiKey.value = LS.k;
  if (el.src) el.src.value = LS.src;
  if (el.tgt) el.tgt.value = LS.tgt;
  renderLines(LS.lines);
  renderGlossary();
  loadSettingsToUI();

  if (el.layoutMode) el.layoutMode.value = LS.layout;
  applyLayout();

  // 탭 네비게이션 초기화
  initTabs();


  // === PWA 설치 & SW ===
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    if (el.installBtn) el.installBtn.style.display = '';
  });
  if (el.installBtn) {
    el.installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    });
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // === 이벤트 ===
  if (el.btnDeleteSel) el.btnDeleteSel.addEventListener('click', deleteSelected);
  if (el.btnSaveNote) el.btnSaveNote.addEventListener('click', saveNote);
  if (el.btnLoadNote) el.btnLoadNote.addEventListener('click', loadNote);

  if (el.toggleKey) el.toggleKey.addEventListener('click', () => {
    el.apiKey.type = (el.apiKey.type === 'password') ? 'text' : 'password';
    el.toggleKey.textContent = (el.apiKey.type === 'password') ? '표시' : '숨김';
  });
  if (el.saveKey) el.saveKey.addEventListener('click', () => { LS.k = (el.apiKey.value || '').trim(); keyMsg('저장됨'); });
  if (el.testKey) {
    el.testKey.addEventListener('click', () => handleApiAction(el.testKey, async () => {
      const apiKey = (el.apiKey.value || '').trim();
      await translateOnce(apiKey, 'ping', 'en', 'ko');
      keyMsg('키 정상', 'success'); // 성공 메시지 표시
    }, '테스트 중…'));
  }

  if (el.src) el.src.addEventListener('change', () => { LS.src = el.src.value; });
  if (el.tgt) el.tgt.addEventListener('change', () => { LS.tgt = el.tgt.value; });

  if (el.note) el.note.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }});
  if (el.send) el.send.addEventListener('click', send);

  if (el.exportBtn) el.exportBtn.addEventListener('click', exportCSV);
  if (el.clearBtn) el.clearBtn.addEventListener('click', () => { LS.lines = []; renderLines([]); });

  if (el.gAdd) el.gAdd.addEventListener('click', () => {
    const s = (el.gSrc.value || '').trim();
    const t = (el.gTgt.value || '').trim();
    if (!s || !t) return;
    const entry = { src: s, tgt: t, whole: !!(el.gWhole && el.gWhole.checked) };
    LS.glossary = LS.glossary.concat([entry]);
    el.gSrc.value = ''; el.gTgt.value = '';
    renderGlossary();
  });
  if (el.gClear) el.gClear.addEventListener('click', () => { LS.glossary = []; renderGlossary(); });

  // 탭 네비게이션 이벤트는 initTabs()에서 처리

  if (el.stTemp) el.stTemp.addEventListener('input', () => { el.stTempVal.textContent = String(el.stTemp.value); });
  if (el.stTopP) el.stTopP.addEventListener('input', () => { el.stTopPVal.textContent = String(el.stTopP.value); });
  if (el.btnSaveSettings) el.btnSaveSettings.addEventListener('click', () => { saveSettingsFromUI(); });
  if (el.layoutMode) el.layoutMode.addEventListener('change', () => {
    LS.layout = el.layoutMode.value;
    applyLayout();
  });

    // 선택 복사 & 전체선택
    if (el.btnCopySel) el.btnCopySel.addEventListener('click', copySelected);
    if (el.selToggle) el.selToggle.addEventListener('change', (e) => {
        const on = e.target.checked;
        const allItemCount = LS.lines.length;
        for (let i = 0; i < allItemCount; i++) {
            if (on) selected.add(i); else selected.delete(i);
        }
        // UI 업데이트를 위해 다시 렌더링
        renderLines(LS.lines);
    });

    // 해설 모달 닫기
    if (el.explainClose) el.explainClose.addEventListener('click', () => {
      if (el.explainModal) el.explainModal.classList.remove('show');
    });
    // 모달 바깥 클릭 시 닫기
    if (el.explainModal) el.explainModal.addEventListener('click', (e) => {
      if (e.target === el.explainModal) el.explainModal.classList.remove('show');
    });


  // === 탭 네비게이션 함수들 ===
  function initTabs() {
    // 탭 버튼 이벤트 리스너 추가
    el.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        switchTab(tabId);
      });
    });
    
    // 기본 탭 설정
    const savedTab = localStorage.getItem('activeTab') || 'translate';
    switchTab(savedTab);
  }

  function switchTab(tabId) {
    // 모든 탭 버튼과 콘텐츠 비활성화
    el.tabBtns.forEach(btn => btn.classList.remove('active'));
    el.tabContents.forEach(content => content.classList.remove('active'));
    
    // 선택된 탭 활성화
    const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
    const activeContent = document.getElementById(`${tabId}-tab`);
    
    if (activeBtn && activeContent) {
      activeBtn.classList.add('active');
      activeContent.classList.add('active');
      
      // 현재 탭을 localStorage에 저장
      localStorage.setItem('activeTab', tabId);
      
      // 탭별 특별 처리
      handleTabSwitch(tabId);
    }
  }

  function handleTabSwitch(tabId) {
    switch(tabId) {
      case 'settings':
        // 설정 탭으로 이동할 때 UI 새로고침
        loadSettingsToUI();
        break;
      case 'glossary':
        // 용어집 탭으로 이동할 때 렌더링 새로고침
        renderGlossary();
        break;
      case 'data':
        // 데이터 탭으로 이동할 때는 특별한 처리 없음
        break;
      case 'translate':
      default:
        // 번역 탭으로 이동할 때는 특별한 처리 없음
        break;
    }
  }

  // === 함수들 ===
  function keyMsg(msg, cls) {
    if (!el.keyMsg) return;
    el.keyMsg.textContent = msg;
    el.keyMsg.className = 'hint ' + (cls || '');
    if (msg) setTimeout(() => { el.keyMsg.textContent = ''; }, 3000);
  }

  function renderLines(lines){
    // 좌우 2열
    if (el.origList && el.tranList){
        el.origList.innerHTML = '';
        el.tranList.innerHTML = '';
        lines.forEach((l,i)=>{
        el.origList.appendChild(lineEl(l, i, false)); // 원문 라인
        el.tranList.appendChild(lineEl(l, i, true));  // 번역 라인
        });
    }
    // 세로(원문→번역)
    if (el.pairList){
        el.pairList.innerHTML = '';
        lines.forEach((l,i)=>{
        el.pairList.appendChild(pairItemEl(l, i));
        });
    }
    // 렌더 후 현재 레이아웃만 보이도록 한 번 더 보정
    applyLayout();
  }

  function toggleSelection(idx) {
    const isSelected = selected.has(idx);
    const elements = document.querySelectorAll(`.item[data-idx="${idx}"], .line[data-idx="${idx}"]`);
    
    if (isSelected) {
      selected.delete(idx);
      elements.forEach(e => e.classList.remove('selected'));
    } else {
      selected.add(idx);
      elements.forEach(e => e.classList.add('selected'));
    }

    // 전체 선택 체크박스 상태 업데이트
    if (el.selToggle) {
        const totalCount = LS.lines.length;
        el.selToggle.checked = totalCount > 0 && selected.size === totalCount;
    }
  }

  function pairItemEl(l, idx){
    const wrap = document.createElement('div');
    wrap.className = 'item';
    wrap.dataset.idx = idx;
    if (selected.has(idx)) wrap.classList.add('selected');

    wrap.addEventListener('click', (e) => {
        // 툴바 버튼 또는 편집 가능 영역 클릭 시에는 선택 토글 방지
        if (e.target.closest('.toolbar') || e.target.closest('.editable')) return;
        toggleSelection(idx);
    });

    const id = document.createElement('div');
    id.className = 'idx';
    id.textContent = idx + 1;

    const text = document.createElement('div');
    text.className = 'text';

    const o = document.createElement('div');
    o.className = 'orig editable'; o.contentEditable = 'true';
    o.textContent = String(l.orig);
    o.addEventListener('blur', () => {
        const lines = LS.lines; lines[idx].orig = o.textContent || ''; LS.lines = lines;
    });

    const t = document.createElement('div');
    t.className = 'tran editable'; t.contentEditable = 'true';
    t.textContent = String(l.tran);
    t.addEventListener('blur', () => {
        const lines = LS.lines; lines[idx].tran = t.textContent || ''; LS.lines = lines;
    });

    // 툴바 (복사/재번역/해설)
    const tools = document.createElement('div');
    tools.className = 'toolbar';

    const copy = document.createElement('button'); copy.textContent='복사';
    copy.setAttribute('aria-label', '복사');
    copy.addEventListener('click', ()=> {
        const mode = el.copyMode?.value || 'both';
        const txt = (mode==='orig') ? o.textContent :
                    (mode==='tran') ? t.textContent :
                    (o.textContent + '\n' + t.textContent);
        navigator.clipboard.writeText(txt || '');
    });
    const explain = document.createElement('button');
    explain.textContent = '해설';
    explain.setAttribute('aria-label', '해설');
    explain.addEventListener('click', () => handleApiAction(explain, async () => {
      const apiKey = (el.apiKey?.value || '').trim();
      const orig = o.textContent;
      const tran = t.textContent;
      const explanation = await getExplanation(apiKey, orig, tran, el.tgt?.value || 'ko', idx, false);
      showExplanation(explanation);
    }));

    // 해설 새로고침 버튼
    const explainRefresh = document.createElement('button');
    explainRefresh.textContent = '🔄';
    explainRefresh.title = '해설 새로고침';
    explainRefresh.setAttribute('aria-label', '해설 새로고침');
    explainRefresh.style.fontSize = '14px';
    explainRefresh.addEventListener('click', () => handleApiAction(explainRefresh, async () => {
      const apiKey = (el.apiKey?.value || '').trim();
      const orig = o.textContent;
      const tran = t.textContent;
      const explanation = await getExplanation(apiKey, orig, tran, el.tgt?.value || 'ko', idx, true);
      showExplanation(explanation);
    }, '⏳'));

    const rerun = document.createElement('button');
    rerun.textContent = '재번역';
    rerun.setAttribute('aria-label', '재번역');
    rerun.addEventListener('click', () => handleApiAction(rerun, async () => {
      const apiKey = (el.apiKey?.value || '').trim();
      const raw = await translateOnce(apiKey, (LS.lines[idx].orig || ''), (el.src?.value || 'auto'), (el.tgt?.value || 'ko'));
      const final = applyDeterministicGlossary(raw, LS.glossary);
      updateLines(lines => { lines[idx].tran = final; return lines; });
    }, '번역중…'));
    tools.appendChild(copy); tools.appendChild(explain); tools.appendChild(explainRefresh); tools.appendChild(rerun);

    text.appendChild(o); text.appendChild(t); text.appendChild(tools);
    wrap.appendChild(id); wrap.appendChild(text);
    return wrap;
  }

  function lineEl(line, idx, isTran){
    const text = isTran ? line.tran : line.orig;

    const div = document.createElement('div');
    div.className = 'line';
    div.dataset.idx = idx;
    if (selected.has(idx)) div.classList.add('selected');

    div.addEventListener('click', (e) => {
        if (e.target.closest('.toolbar') || e.target.closest('.editable')) return;
        toggleSelection(idx);
    });

    const num = document.createElement('div');
    num.textContent = idx + 1;
    num.className = 'badge';

    const body = document.createElement('div');
    body.className = isTran ? 'tran editable' : 'orig editable';
    body.contentEditable = 'true';
    body.textContent = String(text);

    // 편집 → 저장
    body.addEventListener('blur', () => {
        const val = body.textContent || '';
        const lines = LS.lines;
        if (isTran) lines[idx].tran = val;
        else        lines[idx].orig = val;
        LS.lines = lines;
    });

    const btns = document.createElement('div');
    btns.className = 'toolbar';

    // 복사
    const copy = document.createElement('button');
    copy.textContent = '복사';
    copy.setAttribute('aria-label', '복사');
    copy.addEventListener('click', () => navigator.clipboard.writeText(body.textContent || ''));
    btns.appendChild(copy);

    // 해설 (번역 쪽에만)
    if (isTran) {
      const explain = document.createElement('button');
      explain.textContent = '해설';
      explain.setAttribute('aria-label', '해설');
      explain.addEventListener('click', () => handleApiAction(explain, async () => {
        const apiKey = (el.apiKey?.value || '').trim();
        const orig = LS.lines[idx].orig || '';
        const tran = body.textContent || '';
        const explanation = await getExplanation(apiKey, orig, tran, el.tgt?.value || 'ko', idx, false);
        showExplanation(explanation);
      }));

      // 해설 새로고침 버튼
      const explainRefresh = document.createElement('button');
      explainRefresh.textContent = '🔄';
      explainRefresh.title = '해설 새로고침';
      explainRefresh.setAttribute('aria-label', '해설 새로고침');
      explainRefresh.style.fontSize = '14px';
      explainRefresh.addEventListener('click', () => handleApiAction(explainRefresh, async () => {
        const apiKey = (el.apiKey?.value || '').trim();
        const orig = LS.lines[idx].orig || '';
        const tran = body.textContent || '';
        const explanation = await getExplanation(apiKey, orig, tran, el.tgt?.value || 'ko', idx, true);
        showExplanation(explanation);
      }, '⏳'));

      btns.appendChild(explain);
      btns.appendChild(explainRefresh);
    }

    // 재번역 (원문 쪽에만)
    if (!isTran){
      const rerun = document.createElement('button');
      rerun.textContent = '재번역';
      rerun.setAttribute('aria-label', '재번역');
      rerun.addEventListener('click', () => handleApiAction(rerun, async () => {
        const apiKey = (el.apiKey?.value || '').trim();
        const raw = await translateOnce(apiKey, (LS.lines[idx].orig || ''), (el.src?.value || 'auto'), (el.tgt?.value || 'ko'));
        const final = applyDeterministicGlossary(raw, LS.glossary);
        updateLines(lines => { lines[idx].tran = final; return lines; });
      }, '번역중…'));
      btns.appendChild(rerun);
    }

    div.appendChild(num);
    div.appendChild(body);
    div.appendChild(btns);
    return div;
  }

  function exportCSV() {
    const rows = [['original','translation','src','tgt']].concat(
      LS.lines.map(l => [l.orig, l.tran, l.src, l.tgt])
    );
    const csv = rows
      .map(r => r.map(s => '"' + String(s).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'translations.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderGlossary() {
    if (!el.gList || !el.gCount) return;
    const list = LS.glossary;
    el.gList.innerHTML = ''; el.gCount.textContent = '(' + list.length + '개)';
    list.forEach((g, idx) => {
      const row = document.createElement('div'); row.className = 'row';
      const chip = document.createElement('span'); chip.className = 'pill';
      chip.innerHTML = '<b>' + escapeHTML(g.src) + '</b> → ' + escapeHTML(g.tgt) + (g.whole ? ' (word)' : '');
      const del = document.createElement('button'); del.textContent = '삭제';
      del.addEventListener('click', () => {
        const arr = LS.glossary; arr.splice(idx, 1); LS.glossary = arr; renderGlossary();
      });
      row.appendChild(chip); row.appendChild(del); el.gList.appendChild(row);
    });
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  }

  function loadSettingsToUI() {
  // 1) st를 먼저 준비
  const st = LS.settings;

  // 2) 모델 드롭다운: 저장된 값이 옵션에 없으면 동적 추가 후 선택
  if (el.stModel) {
    const v = st.model || DEFAULTS.model;
    const optValues = Array.from(el.stModel.options).map(o => o.value);
    if (!optValues.includes(v)) {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      el.stModel.appendChild(opt);
    }
    el.stModel.value = v; // 여기서 딱 한 번만 세팅
  }

  // 3) 나머지 설정 UI 반영
  if (el.stTone)     el.stTone.value = st.tone || DEFAULTS.tone;
  if (el.stVariety)  el.stVariety.value = st.variety || DEFAULTS.variety;
  if (el.stPreserve) el.stPreserve.checked = ('preserve' in st ? !!st.preserve : DEFAULTS.preserve);

  // 해설용 모델 드롭다운
  if (el.stExplainModel) {
    const explainV = st.explainModel || DEFAULTS.explainModel;
    const explainOptValues = Array.from(el.stExplainModel.options).map(o => o.value);
    if (!explainOptValues.includes(explainV)) {
      const opt = document.createElement('option');
      opt.value = explainV; opt.textContent = explainV;
      el.stExplainModel.appendChild(opt);
    }
    el.stExplainModel.value = explainV;
  }

  if (el.stTemp) {
    el.stTemp.value = String(st.temperature ?? DEFAULTS.temperature);
    if (el.stTempVal) el.stTempVal.textContent = String(el.stTemp.value);
  }
  if (el.stTopP) {
    el.stTopP.value = String(st.topP ?? DEFAULTS.topP);
    if (el.stTopPVal) el.stTopPVal.textContent = String(el.stTopP.value);
  }
  if (el.stMaxTok) el.stMaxTok.value = String(st.maxTokens ?? DEFAULTS.maxTokens);
  if (el.stExplainMaxTok) el.stExplainMaxTok.value = String(st.explainMaxTokens ?? DEFAULTS.explainMaxTokens);
  if (el.stCustomPrompt) el.stCustomPrompt.value = String(st.customPrompt || '');

  if (el.modelBadge) el.modelBadge.textContent = 'model: ' + (st.model || DEFAULTS.model);
}


  function saveSettingsFromUI() {
    const st = LS.settings;
    const next = {
      model: (el.stModel && el.stModel.value ? el.stModel.value.trim() : st.model || DEFAULTS.model),
      explainModel: (el.stExplainModel && el.stExplainModel.value ? el.stExplainModel.value.trim() : st.explainModel || DEFAULTS.explainModel),
      tone: el.stTone ? el.stTone.value : st.tone,
      variety: el.stVariety ? el.stVariety.value : st.variety,
      preserve: el.stPreserve ? !!el.stPreserve.checked : st.preserve,
      temperature: el.stTemp ? Number(el.stTemp.value) : st.temperature,
      topP: el.stTopP ? Number(el.stTopP.value) : st.topP,
      maxTokens: el.stMaxTok ? Number(el.stMaxTok.value) : st.maxTokens,
      explainMaxTokens: el.stExplainMaxTok ? Number(el.stExplainMaxTok.value) : (st.explainMaxTokens ?? DEFAULTS.explainMaxTokens),
      customPrompt: el.stCustomPrompt ? el.stCustomPrompt.value.trim() : (st.customPrompt || '')
    };
    LS.settings = next; loadSettingsToUI();
  }

  function styleDirectives(tgt) {
    const st = LS.settings;
    const lines = [];
    if (st.tone === 'formal') lines.push('Use a formal tone appropriate for professional documents.');
    if (st.tone === 'casual') lines.push('Use a natural conversational tone.');
    if ((tgt === 'en' || tgt === 'en-US' || tgt === 'en-GB') && st.variety === 'us') lines.push('Use American English conventions.');
    if ((tgt === 'en' || tgt === 'en-US' || tgt === 'en-GB') && st.variety === 'uk') lines.push('Use British English conventions.');
    if (st.preserve) lines.push('Preserve inline markup (Markdown, placeholders) exactly as given.');
    return lines.join(' ');
  }

  function buildPrompt(text, src, tgt) {
    const st = LS.settings;
    const from = (src === 'auto') ? 'auto-detect' : src;
    const gl = LS.glossary || [];
    let glossLines = '';
    if (gl.length) {
      const lines = gl.map(g => '- "' + g.src + '" -> "' + g.tgt + '"' + (g.whole ? ' (whole word)' : ''));
      glossLines = '\n\nGlossary (terms to enforce):\n' + lines.join('\n');
    }
    const customPrompt = (st.customPrompt || '').trim();
    const customPart = customPrompt ? '\n\n' + customPrompt : '';
    return 'You are a professional translation engine. ' + 
      'Translate the following text from ' + from + ' to ' + tgt + '. ' + 
      styleDirectives(tgt) + glossLines + 
      customPart + 
      '\n\nReturn only the translation with no quotes or extra commentary.' + 
      '\n\nText:\n' + text;
  }

  function applyDeterministicGlossary(out, glossary) {
    if (!glossary || !glossary.length) return out;
    const esc = (s) => String(s).replace(/[.*+?^${}()|[\]]/g, '\$&');
    let t = String(out);
    glossary.forEach((item) => {
      const escSrc = esc(item.src);
      const re = item.whole
        ? new RegExp('(^|\b)' + escSrc + '(?=\b|$)', 'g')
        : new RegExp(escSrc, 'g');
      t = t.replace(re, (m, p1) => (item.whole && p1 ? p1 : '') + String(item.tgt));
    });
    return t;
  }

  function deleteSelected() {
    const idxs = Array.from(selected).sort((a,b) => b-a); // 역순 정렬(높은 인덱스부터)
    if (!idxs.length) {
      alert('선택된 항목이 없습니다.');
      return;
    }
    if (!confirm(idxs.length + '개의 항목을 삭제하시겠습니까?')) return;
    updateLines(lines => {
      idxs.forEach(i => lines.splice(i, 1));
      selected.clear();
      if (el.selToggle) el.selToggle.checked = false;
      return lines;
    });
  }

  function saveNote() {
    const idxs = Array.from(selected).sort((a,b) => a-b);
    if (!idxs.length) {
      alert('선택된 항목이 없습니다.');
      return;
    }
    
    const name = prompt('저장할 노트의 이름을 입력하세요:');
    if (!name) return;
    
    const lines = LS.lines;
    const selectedLines = idxs.map(i => lines[i]).filter(l => l);
    
    const notes = LS.savedNotes;
    notes[name] = {
      date: new Date().toISOString(),
      lines: selectedLines
    };
    LS.savedNotes = notes;
    
    alert(`'${name}' 노트에 ${selectedLines.length}개 항목이 저장되었습니다.`);
  }

  function loadNote() {
    const notes = LS.savedNotes;
    const names = Object.keys(notes);
    
    if (!names.length) {
      alert('저장된 노트가 없습니다.');
      return;
    }
    
    const listText = names.map((name, i) => {
      const note = notes[name];
      const date = new Date(note.date).toLocaleString();
      const count = note.lines.length;
      return `${i+1}. ${name} (${count}개 항목, ${date})`;
    }).join('\n');
    
    const input = prompt(
      '불러올 노트의 번호를 입력하세요:\n\n' + listText + '\n\n' +
      '(삭제하려면 번호 앞에 "d"를 붙이세요. 예: d1)',
      '1'
    );
    
    if (!input) return;
    
    const isDelete = input.toLowerCase().startsWith('d');
    const num = parseInt(isDelete ? input.slice(1) : input) - 1;
    
    if (isNaN(num) || num < 0 || num >= names.length) {
      alert('잘못된 번호입니다.');
      return;
    }
    
    const name = names[num];
    
    if (isDelete) {
      if (!confirm(`'${name}' 노트를 삭제하시겠습니까?`)) return;
      delete notes[name];
      LS.savedNotes = notes;
      alert('노트가 삭제되었습니다.');
      return;
    }
    
    const note = notes[name];
    if (!confirm(
      `'${name}' 노트의 ${note.lines.length}개 항목을 불러옵니다.\n\n` +
      '현재 목록: ' + (LS.lines.length ? '\n - 유지 (기존 항목 뒤에 추가)' : '비어있음') + '\n' +
      '확인을 누르면 노트를 불러옵니다.'
    )) return;
    
    updateLines(lines => {
      lines.push(...note.lines);
      return lines;
    });
    
    alert(`${note.lines.length}개 항목을 불러왔습니다.`);
  }

  // 원자적 라인 업데이트 헬퍼
  function updateLines(mutator, opts) {
    opts = opts || {};
    const src = LS.lines || [];
    const copy = src.slice();
    const next = mutator(copy) || copy;
    LS.lines = next;
    if (opts.render !== false) renderLines(next);
    return next;
  }

  function applyLayout(){
    if (!el.resSplit || !el.resPair) return;
    const mode = LS.layout;
    if (el.layoutMode) el.layoutMode.value = mode;
    // set both hidden attribute and inline style to robustly control visibility
    if (mode === 'pair') {
      try { el.resSplit.hidden = true; } catch(e){}
      try { el.resPair.hidden = false; } catch(e){}
      el.resSplit.style.display = 'none';
      el.resPair.style.display = '';
    } else {
      try { el.resSplit.hidden = false; } catch(e){}
      try { el.resPair.hidden = true; } catch(e){}
      el.resSplit.style.display = '';
      el.resPair.style.display = 'none';
    }
  }

  function copySelected(){
    const mode = el.copyMode?.value || 'both';
    const lines = LS.lines;
    const idxs = Array.from(selected).sort((a,b)=>a-b).filter(i => i>=0 && i<lines.length);
    if (!idxs.length){ alert('선택된 항목이 없습니다.'); return; }
    const parts = idxs.map(i => {
        const L = lines[i];
        if (mode==='orig') return L.orig || '';
        if (mode==='tran') return L.tran || '';
        return (L.orig || '') + '\n' + (L.tran || '');
    });
    const text = parts.join('\n'); // 줄바꿈으로 연결
    navigator.clipboard.writeText(text);
  }

  async function translateOnce(apiKey, text, src, tgt) {
    const st = LS.settings;
    const body = {
      systemInstruction: {
        role: 'system',
        parts: [{ text: 'You translate text. Output ONLY the translation. If a glossary is supplied, obey it strictly.' }]
      },
      contents: [{ role: 'user', parts: [{ text: buildPrompt(text, src, tgt) }] }],
      generationConfig: {
        temperature: Number(st.temperature || 0),
        topP: Number(st.topP || 1),
        maxOutputTokens: Number(st.maxTokens || 2048)
      }
    };
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + 
                encodeURIComponent(st.model || DEFAULTS.model) + 
                ':generateContent';
    // timeout 지원 (기본 15s)
    const timeoutMs = Number(st.timeoutMs || 15000);
    const ac = new AbortController();
    const id = setTimeout(() => ac.abort(), timeoutMs);
    let data;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: ac.signal
      });
      if (!res.ok) {
        // 개발자용 콘솔에 상세 에러 출력
        const txt = await res.text().catch(() => '');
        console.error('translateOnce HTTP error', res.status, txt);
        throw new Error('서버 응답 오류 (' + res.status + ')');
      }
      data = await res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도하세요.');
      throw err;
    } finally {
      clearTimeout(id);
    }
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (data?.promptFeedback?.blockReason) throw new Error('Blocked by safety: ' + data.promptFeedback.blockReason);
    return out;
  }

  function send() {
    if (!el.send) return;
    handleApiAction(el.send, async () => {
      const apiKey = (el.apiKey.value || '').trim();
      const text = (el.note.value || '').trim();
      if (!text) return;

      const raw = await translateOnce(apiKey, text, (el.src?.value || 'auto'), (el.tgt?.value || 'ko'));
      const final = applyDeterministicGlossary(raw, LS.glossary);
      updateLines(lines => lines.concat([{ orig: text, tran: final, src: (el.src?.value || 'auto'), tgt: (el.tgt?.value || 'ko') }]));
      el.note.value = '';
    }, '번역 중…');
  }

  // 해설 기능
  async function getExplanation(apiKey, original, translation, targetLang, lineIndex, forceRefresh = false) {
    const st = LS.settings;
    
    // 저장된 해설이 있는지 확인 (forceRefresh가 false일 때만)
    const lines = LS.lines;
    if (!forceRefresh && lines[lineIndex] && lines[lineIndex].explain) {
      return lines[lineIndex].explain;
    }
    
    const prompt = `You are an expert translator and language teacher.

Original: "${original}"
Translation: "${translation}"

Please provide a detailed explanation in Korean with line breaks for readability:

1. 여러 표현 방식 비교: 
   - 이 번역이 자연스러운지, 다른 방식으로 표현할 수 있는지 비교해주세요.
   - 예를 들어, 더 구어적/격식있는 표현, 더 간결한/상세한 표현 등 다른 옵션을 제시해주세요.

2. 원어민 사용 판단 및 예시:
   - 이 번역을 원어민이 실제로 쓸 것 같은가요, 아니면 다른 표현을 쓸 것 같나요?
   - 더 자연스러운 대안 표현을 예시 문장으로 보여주세요.
   - 각 표현의 차이점과 사용 맥락을 설명해주세요.

Use line breaks between sections to improve readability. Answer can be somewhat longer if needed to be thorough.`;

    const body = {
      systemInstruction: {
        role: 'system',
        parts: [{ text: 'You are an expert translator and language teacher. Provide detailed explanations about translations, their naturalness, usage contexts, and cultural nuances.' }]
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: Number(st.explainMaxTokens || DEFAULTS.explainMaxTokens)
      }
    };

    const explainModel = st.explainModel || DEFAULTS.explainModel;
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + 
                encodeURIComponent(explainModel) + 
                ':generateContent';

    const ac = new AbortController();
    const id = setTimeout(() => ac.abort(), 15000);
    let data;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: ac.signal
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('getExplanation HTTP error', res.status, txt);
        throw new Error('해설 요청 실패 (' + res.status + ')');
      }
      data = await res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('요청 시간이 초과되었습니다.');
      throw err;
    } finally {
      clearTimeout(id);
    }

    // 안전한 응답 파싱
    if (data?.promptFeedback?.blockReason) {
      throw new Error('안전 필터에 의해 차단됨: ' + data.promptFeedback.blockReason);
    }
    
    // finishReason 체크
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      throw new Error('응답이 너무 길어 최대 토큰 한도에 도달했습니다. 더 짧은 텍스트로 다시 시도하거나 설정에서 최대 토큰을 늘려보세요.');
    }
    
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!out) {
      console.error('응답 데이터 구조:', JSON.stringify(data, null, 2));
      console.error('finishReason:', finishReason);
      throw new Error('해설을 받을 수 없습니다. (응답이 비어있거나 형식이 다릅니다)');
    }
    
    // 해설을 lines 배열에 저장
    if (lineIndex !== undefined && lineIndex >= 0) {
      updateLines(lines => {
        if (lines[lineIndex]) {
          lines[lineIndex].explain = out;
        }
        return lines;
      }, { render: false });
    }
    
    return out;
  }

  function showExplanation(text) {
    if (!el.explainContent) return;
    // 마크다운이나 줄바꿈을 보존하면서 표시
    el.explainContent.textContent = text;
    if (el.explainModal) el.explainModal.classList.add('show');
  }

  // API 호출 버튼의 반복 로직을 처리하는 고차 함수
  async function handleApiAction(button, actionFn, loadingText = '요청중…') {
    const apiKey = (el.apiKey?.value || '').trim();
    if (!apiKey) {
      alert('API 키를 먼저 저장하세요');
      keyMsg('API 키를 먼저 저장하세요', 'error'); // 더 잘 보이는 피드백
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = loadingText;

    try {
      await actionFn();
    } catch (err) {
      console.error('API Action Error:', err);
      // 타임아웃, API 차단 등 구체적인 오류 메시지를 alert로 보여줌
      alert('작업 실패: ' + (err?.message || String(err)));
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
})();
