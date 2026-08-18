import { test } from 'node:test';
import assert from 'node:assert/strict';
import PURE from './core.mjs';

test('sanitizeName / noteFileName: 확장자 제거와 금지문자 치환', () => {
  assert.equal(PURE.sanitizeName('발표자료.html'), '발표자료');
  assert.equal(PURE.sanitizeName('a/b:c*d.htm'), 'a_b_c_d');
  assert.equal(PURE.sanitizeName(''), 'deck');
  assert.equal(PURE.noteFileName('쇼케이스.html', '2026-08-18'), '2026-08-18_쇼케이스_노트.md');
});

test('serializeNotes: 헤더·앵커 주석·제목 폴백·미배정 섹션', () => {
  const md = PURE.serializeNotes({
    deckName: '쇼케이스.html', total: 21, today: '2026-08-18',
    notes: [
      { anchor: '7c1a9f', index: 7, title: '다섯 스킬', text: '질문 받기' },
      { anchor: 'empty#2', index: 9, title: '', text: '이미지 장 멘트' }
    ],
    orphans: [{ text: '예전 멘트', hint: '5 / 21 · 옛 제목' }]
  });
  assert.match(md, /^# 쇼케이스\.html — 발표 노트\n/);
  assert.match(md, /html-presenter notes v1 · 21페이지 · 2026-08-18/);
  assert.match(md, /## 8 \/ 21 · "다섯 스킬"\n<!-- slide: 7c1a9f -->\n질문 받기/);
  assert.match(md, /## 10 \/ 21 · "\(제목 없음\)"/);
  assert.match(md, /## 미배정\n\n<!-- unassigned: 5 \/ 21 · 옛 제목 -->\n예전 멘트/);
});

test('serializeNotes: 미배정이 없으면 미배정 섹션도 없다', () => {
  const md = PURE.serializeNotes({ deckName: 'a.html', total: 2, today: '2026-08-18',
    notes: [{ anchor: 'aa', index: 0, title: '제목', text: '본문' }], orphans: [] });
  assert.ok(!md.includes('## 미배정'));
});
