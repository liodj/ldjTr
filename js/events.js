
// js/events.js
'use strict';

import { LS, selected, updateLines, deleteSelected, saveNote, loadNote } from './store.js';
import { translateOnce, applyDeterministicGlossary } from './api.js';
import { el, keyMsg, renderLines, exportCSV, renderGlossary, loadSettingsToUI, saveSettingsFromUI, applyLayout, copySelected, handleApiAction } from './ui.js';

export function initEventListeners() {
  if (el.btnDeleteSel) el.btnDeleteSel.addEventListener('click', () => {
    const newLines = deleteSelected(el.selToggle);
    if (newLines) renderLines(newLines);
  });
  if (el.btnSaveNote) el.btnSaveNote.addEventListener('click', saveNote);
  if (el.btnLoadNote) el.btnLoadNote.addEventListener('click', () => {
    const newLines = loadNote();
    if (newLines) renderLines(newLines);
  });

  if (el.toggleKey) el.toggleKey.addEventListener('click', () => {
    el.apiKey.type = (el.apiKey.type === 'password') ? 'text' : 'password';
    el.toggleKey.textContent = (el.apiKey.type === 'password') ? '표시' : '숨김';
  });
  if (el.saveKey) el.saveKey.addEventListener('click', () => { LS.k = (el.apiKey.value || '').trim(); keyMsg('저장됨'); });
  if (el.testKey) {
    el.testKey.addEventListener('click', () => handleApiAction(el.testKey, async () => {
      const apiKey = (el.apiKey.value || '').trim();
      await translateOnce(apiKey, 'ping', 'en', 'ko');
      keyMsg('키 정상', 'success');
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

  if (el.stTemp) el.stTemp.addEventListener('input', () => { el.stTempVal.textContent = String(el.stTemp.value); });
  if (el.stTopP) el.stTopP.addEventListener('input', () => { el.stTopPVal.textContent = String(el.stTopP.value); });
  if (el.btnSaveSettings) el.btnSaveSettings.addEventListener('click', saveSettingsFromUI);
  if (el.layoutMode) el.layoutMode.addEventListener('change', () => {
    LS.layout = el.layoutMode.value;
    applyLayout();
  });

    if (el.btnCopySel) el.btnCopySel.addEventListener('click', copySelected);
    if (el.selToggle) el.selToggle.addEventListener('change', (e) => {
        const on = e.target.checked;
        const allItemCount = LS.lines.length;
        for (let i = 0; i < allItemCount; i++) {
            if (on) selected.add(i); else selected.delete(i);
        }
        renderLines(LS.lines);
    });

    if (el.explainClose) el.explainClose.addEventListener('click', () => {
      if (el.explainModal) el.explainModal.classList.remove('show');
    });
    if (el.explainModal) el.explainModal.addEventListener('click', (e) => {
      if (e.target === el.explainModal) el.explainModal.classList.remove('show');
    });
}

function send() {
  if (!el.send) return;
  handleApiAction(el.send, async () => {
    const apiKey = (el.apiKey.value || '').trim();
    const text = (el.note.value || '').trim();
    if (!text) return;

    const raw = await translateOnce(apiKey, text, (el.src?.value || 'auto'), (el.tgt?.value || 'ko'));
    const final = applyDeterministicGlossary(raw, LS.glossary);
    const newLines = updateLines(lines => lines.concat([{ orig: text, tran: final, src: (el.src?.value || 'auto'), tgt: (el.tgt?.value || 'ko') }]), { render: false });
    renderLines(newLines);
    el.note.value = '';
  }, '번역 중…');
}
