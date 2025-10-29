// app.js (main entry point)
'use strict';

import { LS } from './js/store.js';
import { el, renderLines, renderGlossary, loadSettingsToUI, applyLayout, initTabs } from './js/ui.js';
import { initEventListeners } from './js/events.js';

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

// === 이벤트 리스너 초기화 ===
initEventListeners();