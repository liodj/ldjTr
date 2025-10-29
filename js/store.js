// js/store.js
'use strict';

import { DEFAULTS } from './config.js';

// === 상태 관리 ===
export const selected = new Set(); // 체크된 라인 인덱스 보관

// === localStorage 래퍼 ===
export const LS = {
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

// === 데이터 조작 함수 ===

// 원자적 라인 업데이트 헬퍼
export function updateLines(mutator, opts) {
  opts = opts || {};
  const src = LS.lines || [];
  const copy = src.slice();
  const next = mutator(copy) || copy;
  LS.lines = next;
  // renderLines는 이제 ui.js에 있으므로 여기서 직접 호출하지 않음
  // 대신 이벤트를 발생시키거나, 이 함수를 호출하는 쪽에서 렌더링을 책임져야 함.
  // 여기서는 일단 next를 반환하여 호출자가 후속 조치를 하도록 함.
  return next;
}

export function deleteSelected(selToggle) {
  const idxs = Array.from(selected).sort((a,b) => b-a); // 역순 정렬(높은 인덱스부터)
  if (!idxs.length) {
    alert('선택된 항목이 없습니다.');
    return null;
  }
  if (!confirm(idxs.length + '개의 항목을 삭제하시겠습니까?')) return null;
  
  const newLines = updateLines(lines => {
    idxs.forEach(i => lines.splice(i, 1));
    selected.clear();
    if (selToggle) selToggle.checked = false;
    return lines;
  }, { render: false }); // 렌더링은 외부에서 처리

  return newLines;
}

export function saveNote() {
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

export function loadNote() {
  const notes = LS.savedNotes;
  const names = Object.keys(notes);
  
  if (!names.length) {
    alert('저장된 노트가 없습니다.');
    return null;
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
  
  if (!input) return null;
  
  const isDelete = input.toLowerCase().startsWith('d');
  const num = parseInt(isDelete ? input.slice(1) : input) - 1;
  
  if (isNaN(num) || num < 0 || num >= names.length) {
    alert('잘못된 번호입니다.');
    return null;
  }
  
  const name = names[num];
  
  if (isDelete) {
    if (!confirm(`'${name}' 노트를 삭제하시겠습니까?`)) return null;
    delete notes[name];
    LS.savedNotes = notes;
    alert('노트가 삭제되었습니다.');
    return null;
  }
  
  const note = notes[name];
  if (!confirm(
    `'${name}' 노트의 ${note.lines.length}개 항목을 불러옵니다.\n\n` +
    '현재 목록: ' + (LS.lines.length ? '\n - 유지 (기존 항목 뒤에 추가)' : '비어있음') + '\n' +
    '확인을 누르면 노트를 불러옵니다.'
  )) return null;
  
  const newLines = updateLines(lines => {
    lines.push(...note.lines);
    return lines;
  }, { render: false }); // 렌더링은 외부에서 처리
  
  alert(`${note.lines.length}개 항목을 불러왔습니다.`);
  return newLines;
}
