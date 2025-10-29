// js/ui.js
'use strict';

import { DEFAULTS } from './config.js';
import { LS, selected, updateLines } from './store.js';
import { getExplanation, translateOnce, applyDeterministicGlossary } from './api.js';

// === 셀렉터 ===
export const $ = (s) => document.querySelector(s);
export const el = {
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
  pairItemTemplate: $('#pair-item-template'),
  lineItemTemplate: $('#line-item-template'),
};

// === UI 함수들 ===

export function keyMsg(msg, cls) {
  if (!el.keyMsg) return;
  el.keyMsg.textContent = msg;
  el.keyMsg.className = 'hint ' + (cls || '');
  if (msg) setTimeout(() => { el.keyMsg.textContent = ''; }, 3000);
}

export function renderLines(lines){
  if (el.origList && el.tranList){
      el.origList.innerHTML = '';
      el.tranList.innerHTML = '';
      lines.forEach((l,i)=>{
      el.origList.appendChild(lineEl(l, i, false));
      el.tranList.appendChild(lineEl(l, i, true));
      });
  }
  if (el.pairList){
      el.pairList.innerHTML = '';
      lines.forEach((l,i)=>{
      el.pairList.appendChild(pairItemEl(l, i));
      });
  }
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

  if (el.selToggle) {
      const totalCount = LS.lines.length;
      el.selToggle.checked = totalCount > 0 && selected.size === totalCount;
  }
}

function pairItemEl(l, idx){
  const frag = el.pairItemTemplate.content.cloneNode(true);
  const wrap = frag.querySelector('.item');
  wrap.dataset.idx = idx;
  if (selected.has(idx)) wrap.classList.add('selected');

  wrap.addEventListener('click', (e) => {
      if (e.target.closest('.toolbar') || e.target.closest('.editable')) return;
      toggleSelection(idx);
  });

  frag.querySelector('.idx').textContent = idx + 1;
  const o = frag.querySelector('.orig');
  const t = frag.querySelector('.tran');
  o.textContent = String(l.orig);
  t.textContent = String(l.tran);

  o.addEventListener('blur', () => {
      const lines = LS.lines; lines[idx].orig = o.textContent || ''; LS.lines = lines;
  });
  t.addEventListener('blur', () => {
      const lines = LS.lines; lines[idx].tran = t.textContent || ''; LS.lines = lines;
  });

  frag.querySelector('.copy-btn').addEventListener('click', ()=> {
      const mode = el.copyMode?.value || 'both';
      const txt = (mode==='orig') ? o.textContent :
                  (mode==='tran') ? t.textContent :
                  (o.textContent + '\n' + t.textContent);
      navigator.clipboard.writeText(txt || '');
  });

  frag.querySelector('.explain-btn').addEventListener('click', () => handleApiAction(frag.querySelector('.explain-btn'), async () => {
    const apiKey = (el.apiKey?.value || '').trim();
    const explanation = await getExplanation(apiKey, o.textContent, t.textContent, el.tgt?.value || 'ko', idx, false);
    showExplanation(explanation);
  }));

  frag.querySelector('.explain-refresh-btn').addEventListener('click', () => handleApiAction(frag.querySelector('.explain-refresh-btn'), async () => {
    const apiKey = (el.apiKey?.value || '').trim();
    const explanation = await getExplanation(apiKey, o.textContent, t.textContent, el.tgt?.value || 'ko', idx, true);
    showExplanation(explanation);
  }, '⏳'));

  frag.querySelector('.rerun-btn').addEventListener('click', () => handleApiAction(frag.querySelector('.rerun-btn'), async () => {
    const apiKey = (el.apiKey?.value || '').trim();
    const raw = await translateOnce(apiKey, (LS.lines[idx].orig || ''), (el.src?.value || 'auto'), (el.tgt?.value || 'ko'));
    const final = applyDeterministicGlossary(raw, LS.glossary);
    const newLines = updateLines(lines => {
      lines[idx].tran = final;
      return lines;
    }, { render: false });
    renderLines(newLines);
  }, '번역중…'));

  return frag;
}

function lineEl(line, idx, isTran){
  const frag = el.lineItemTemplate.content.cloneNode(true);
  const div = frag.querySelector('.line');
  div.dataset.idx = idx;
  if (selected.has(idx)) div.classList.add('selected');

  div.addEventListener('click', (e) => {
      if (e.target.closest('.toolbar') || e.target.closest('.editable')) return;
      toggleSelection(idx);
  });

  frag.querySelector('.badge').textContent = idx + 1;
  const body = frag.querySelector('.editable');
  body.textContent = String(isTran ? line.tran : line.orig);
  body.className = isTran ? 'tran editable' : 'orig editable';

  body.addEventListener('blur', () => {
      const val = body.textContent || '';
      const lines = LS.lines;
      if (isTran) lines[idx].tran = val;
      else        lines[idx].orig = val;
      LS.lines = lines;
  });

  frag.querySelector('.copy-btn').addEventListener('click', () => navigator.clipboard.writeText(body.textContent || ''));

  const toolbar = frag.querySelector('.toolbar');

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

    toolbar.appendChild(explain);
    toolbar.appendChild(explainRefresh);
  } else {
    const rerun = document.createElement('button');
    rerun.textContent = '재번역';
    rerun.setAttribute('aria-label', '재번역');
    rerun.addEventListener('click', () => handleApiAction(rerun, async () => {
      const apiKey = (el.apiKey?.value || '').trim();
      const raw = await translateOnce(apiKey, (LS.lines[idx].orig || ''), (el.src?.value || 'auto'), (el.tgt?.value || 'ko'));
      const final = applyDeterministicGlossary(raw, LS.glossary);
      const newLines = updateLines(lines => {
        lines[idx].tran = final;
        return lines;
      }, { render: false });
      renderLines(newLines);
    }, '번역중…'));
    toolbar.appendChild(rerun);
  }

  return frag;
}

export function exportCSV() {
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

export function renderGlossary() {
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

export function loadSettingsToUI() {
  const st = LS.settings;

  if (el.stModel) {
    const v = st.model || DEFAULTS.model;
    const optValues = Array.from(el.stModel.options).map(o => o.value);
    if (!optValues.includes(v)) {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      el.stModel.appendChild(opt);
    }
    el.stModel.value = v;
  }

  if (el.stTone)     el.stTone.value = st.tone || DEFAULTS.tone;
  if (el.stVariety)  el.stVariety.value = st.variety || DEFAULTS.variety;
  if (el.stPreserve) el.stPreserve.checked = ('preserve' in st ? !!st.preserve : DEFAULTS.preserve);

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

export function saveSettingsFromUI() {
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

export function applyLayout(){
  if (!el.resSplit || !el.resPair) return;
  const mode = LS.layout;
  if (el.layoutMode) el.layoutMode.value = mode;
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

export function copySelected(){
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
  const text = parts.join('\n');
  navigator.clipboard.writeText(text);
}

export function showExplanation(text) {
  if (!el.explainContent) return;
  el.explainContent.textContent = text;
  if (el.explainModal) el.explainModal.classList.add('show');
}

export async function handleApiAction(button, actionFn, loadingText = '요청중…') {
  const apiKey = (el.apiKey?.value || '').trim();
  if (!apiKey) {
    alert('API 키를 먼저 저장하세요');
    keyMsg('API 키를 먼저 저장하세요', 'error');
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = loadingText;

  try {
    await actionFn();
  } catch (err) {
    console.error('API Action Error:', err);
    alert('작업 실패: ' + (err?.message || String(err)));
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// === 탭 네비게이션 함수들 ===
export function initTabs() {
  el.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });
  
  const savedTab = localStorage.getItem('activeTab') || 'translate';
  switchTab(savedTab);
}

function switchTab(tabId) {
  el.tabBtns.forEach(btn => btn.classList.remove('active'));
  el.tabContents.forEach(content => content.classList.remove('active'));
  
  const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
  const activeContent = document.getElementById(`${tabId}-tab`);
  
  if (activeBtn && activeContent) {
    activeBtn.classList.add('active');
    activeContent.classList.add('active');
    
    localStorage.setItem('activeTab', tabId);
    
    handleTabSwitch(tabId);
  }
}

function handleTabSwitch(tabId) {
  switch(tabId) {
    case 'settings':
      loadSettingsToUI();
      break;
    case 'glossary':
      renderGlossary();
      break;
    case 'data':
      break;
    case 'translate':
    default:
      break;
  }
}
