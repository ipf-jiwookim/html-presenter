import { test } from 'node:test';
import assert from 'node:assert/strict';
import PURE from './core.mjs';

test('sanitizeName / noteFileName: 확장자 제거와 금지문자 치환', () => {
  assert.equal(PURE.sanitizeName('발표자료.html'), '발표자료');
  assert.equal(PURE.sanitizeName('a/b:c*d.htm'), 'a_b_c_d');
  assert.equal(PURE.sanitizeName(''), 'deck');
  assert.equal(PURE.noteFileName('쇼케이스.html', '2026-08-18'), '2026-08-18_쇼케이스_대본.md');
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
  assert.match(md, /^# 쇼케이스\.html 발표 대본\n/);
  assert.match(md, /html-presenter notes v1 · 21장, 2026-08-18/);
  assert.match(md, /## 8 \/ 21 · "다섯 스킬"\n<!-- slide: 7c1a9f -->\n질문 받기/);
  assert.match(md, /## 10 \/ 21 · "\(제목 없음\)"/);
  assert.match(md, /## 미배정\n\n<!-- unassigned: 5 \/ 21 · 옛 제목 -->\n예전 멘트/);
});

test('serializeNotes: 미배정이 없으면 미배정 섹션도 없다', () => {
  const md = PURE.serializeNotes({ deckName: 'a.html', total: 2, today: '2026-08-18',
    notes: [{ anchor: 'aa', index: 0, title: '제목', text: '본문' }], orphans: [] });
  assert.ok(!md.includes('## 미배정'));
});

test('parseNotes: 헤더가 없으면 거부', () => {
  const r = PURE.parseNotes('# 그냥 마크다운\n내용');
  assert.equal(r.ok, false);
  assert.deepEqual(r.anchors, {});
});

test('parseNotes: 왕복 — 직렬화한 것을 그대로 되읽는다', () => {
  const src = { deckName: 'a.html', total: 3, today: '2026-08-18',
    notes: [{ anchor: 'aa11bb', index: 0, title: '표지', text: '오프닝 멘트' },
            { anchor: 'cc22dd', index: 2, title: '끝', text: '마무리\n두 줄' }],
    orphans: [{ text: '떠도는 노트', hint: '9 / 21 · 옛 장' }] };
  const r = PURE.parseNotes(PURE.serializeNotes(src));
  assert.equal(r.ok, true);
  assert.deepEqual(r.anchors, { aa11bb: '오프닝 멘트', cc22dd: '마무리\n두 줄' });
  assert.equal(r.orphans.length, 1);
  assert.equal(r.orphans[0].text, '떠도는 노트');
  assert.equal(r.orphans[0].hint, '9 / 21 · 옛 장');
});

test('parseNotes: 노트 본문의 ## 줄은 살아남는다', () => {
  const md = PURE.serializeNotes({ deckName: 'a.html', total: 2, today: '2026-08-18',
    notes: [{ anchor: 'aa', index: 0, title: 't', text: '앞줄\n## 정리\n뒷줄' },
            { anchor: 'bb', index: 1, title: 't2', text: '둘째' }], orphans: [] });
  const r = PURE.parseNotes(md);
  assert.equal(r.anchors.aa, '앞줄\n## 정리\n뒷줄');
  assert.equal(r.anchors.bb, '둘째');
});

test('parseNotes: 미배정으로 내보낸 위치 기반 메모도 왕복한다', () => {
  const md = PURE.serializeNotes({ deckName: 'a.html', total: 3, today: '2026-08-18',
    notes: [{ anchor: 'aa11bb', index: 0, title: '표지', text: '앵커 노트' }],
    orphans: [{ text: '위치 기반 메모', hint: '2번째 장 (위치 기반 메모)' }] });
  const r = PURE.parseNotes(md);
  assert.equal(r.ok, true);
  assert.deepEqual(r.anchors, { aa11bb: '앵커 노트' });
  assert.equal(r.orphans.length, 1);
  assert.equal(r.orphans[0].text, '위치 기반 메모');
  assert.equal(r.orphans[0].hint, '2번째 장 (위치 기반 메모)');
});

test('parseNotes: 같은 앵커가 두 번 나오면 이어 붙인다', () => {
  const md = '<!-- html-presenter notes v1 -->\n'
    + '<!-- slide: aa -->\n첫 번째\n\n'
    + '<!-- slide: aa -->\n두 번째\n';
  assert.equal(PURE.parseNotes(md).anchors.aa, '첫 번째\n\n두 번째');
});
