'use strict';

import { DEFAULTS } from './config.js';
import { LS, updateLines } from './store.js';

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

export async function translateOnce(apiKey, text, src, tgt) {
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

export async function getExplanation(apiKey, original, translation, targetLang, lineIndex, forceRefresh = false) {
  const st = LS.settings;
  
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

  if (data?.promptFeedback?.blockReason) {
    throw new Error('안전 필터에 의해 차단됨: ' + data.promptFeedback.blockReason);
  }
  
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

export function applyDeterministicGlossary(out, glossary) {
  if (!glossary || !glossary.length) return out;
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\\]/g, '\\$&');
  let t = String(out);
  glossary.forEach((item) => {
    const escSrc = esc(item.src);
    const re = item.whole
      ? new RegExp('(^|\\b)' + escSrc + '(?=\\b|$)', 'g')
      : new RegExp(escSrc, 'g');
    t = t.replace(re, (m, p1) => (item.whole && p1 ? p1 : '') + String(item.tgt));
  });
  return t;
}
