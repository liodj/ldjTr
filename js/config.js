
// js/config.js
'use strict';

// === 기본값 ===
export const DEFAULTS = {
  model: 'gemini-1.5-flash',
  explainModel: 'gemini-1.5-flash',  // 해설용 모델
  temperature: 0.2,
  topP: 0.95,
  maxTokens: 2048,
  explainMaxTokens: 4096,  // 해설용 maxTokens (길어진 응답 대비)
  tone: 'neutral',   // neutral | formal | casual
  variety: 'auto',   // auto | us | uk
  preserve: true,
  customPrompt: ''   // 사용자 정의 추가 프롬프트
};
