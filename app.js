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
      .map(r => r.map(s => `"${String(s || '').replace(/