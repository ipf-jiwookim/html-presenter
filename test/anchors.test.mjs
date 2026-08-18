import { test } from 'node:test';
import assert from 'node:assert/strict';
import PURE from './core.mjs';

test('fnv1a: 같은 입력은 같은 6자리 hex, 다른 입력은 다른 값', () => {
  const a = PURE.fnv1a('hello world');
  assert.match(a, /^[0-9a-f]{6}$/);
  assert.equal(a, PURE.fnv1a('hello world'));
  assert.notEqual(a, PURE.fnv1a('hello worlds'));
});

test('normTokens: 소문자화·구두점 제거, 숫자 포함 토큰은 버린다', () => {
  assert.deepEqual(PURE.normTokens('Hello, World!'), ['hello', 'world']);
  assert.deepEqual(PURE.normTokens('P.07 / 21'), []);
  assert.deepEqual(PURE.normTokens('01 LLM 비용'), ['llm', '비용']);
  assert.deepEqual(PURE.normTokens('2026.07.23 쇼케이스'), ['쇼케이스']);
  assert.deepEqual(PURE.normTokens(''), []);
  assert.deepEqual(PURE.normTokens(null), []);
});

test('slideAnchors: 장마다 다른 지문, 재실행 시 동일', () => {
  const texts = ['알파 내용', '베타 내용', '감마 내용', '델타 내용', '엡실론 내용'];
  const a = PURE.slideAnchors(texts);
  assert.equal(new Set(a).size, 5);
  assert.deepEqual(a, PURE.slideAnchors(texts));
});

test('slideAnchors: 공통 푸터는 지문에 영향을 주지 않는다 (5장 이상)', () => {
  const foot = 'AI 깐부 SHOWCASE';
  const base = ['알파', '베타', '감마', '델타', '엡실론'].map(t => `${t} 내용 ${foot} P.1 / 5`);
  const grown = ['알파', '베타', '감마', '델타', '엡실론', '신규'].map(t => `${t} 내용 ${foot} P.1 / 6`);
  const a = PURE.slideAnchors(base);
  const b = PURE.slideAnchors(grown);
  // 장이 늘어도 기존 5장의 지문은 그대로여야 한다
  assert.deepEqual(a, b.slice(0, 5));
});

test('slideAnchors: 5장 미만이면 스톱워드를 만들지 않아 지문이 살아남는다', () => {
  const a = PURE.slideAnchors(['공통 알파', '공통 베타', '공통 감마']);
  assert.equal(new Set(a).size, 3);
  assert.ok(!a.includes('empty'));
});

test('slideAnchors: 중간에 장을 끼워도 기존 장의 앵커는 그대로 (핵심)', () => {
  const before = ['1 표지', '2 아젠다', '3 목표', '4 흐름', '5 결과', '6 마무리'];
  const after = ['1 표지', '2 아젠다', '3 목표', '신규 장', '4 흐름', '5 결과', '6 마무리'];
  const a = PURE.slideAnchors(before);
  const b = PURE.slideAnchors(after);
  assert.deepEqual(b.filter(x => a.includes(x)).length, 6, '기존 6장 앵커가 모두 살아있어야 한다');
  assert.equal(a[3], b[4], '4번째 장의 앵커가 5번째 자리로 따라와야 한다');
});

test('slideAnchors: 텍스트 없는 장은 empty, 두 번째부터 #n', () => {
  const a = PURE.slideAnchors(['', '내용 하나', '', '내용 둘', '']);
  assert.equal(a[0], 'empty');
  assert.equal(a[2], 'empty#2');
  assert.equal(a[4], 'empty#3');
});

test('slideAnchors: 같은 내용 두 장은 순번으로 구분된다', () => {
  const a = PURE.slideAnchors(['질문 있나요', '본문', '질문 있나요', '본문 둘', '끝']);
  assert.notEqual(a[0], a[2]);
  assert.ok(a[2].endsWith('#2'));
});

test('anchorOverlap: 작은 쪽 기준 겹침 비율', () => {
  assert.equal(PURE.anchorOverlap(['a', 'b', 'c'], ['a', 'b', 'c']), 1);
  assert.equal(PURE.anchorOverlap(['a', 'b'], ['a', 'b', 'c', 'd']), 1);
  assert.equal(PURE.anchorOverlap(['a', 'x'], ['a', 'b', 'c', 'd']), 0.5);
  assert.equal(PURE.anchorOverlap([], ['a']), 0);
  assert.equal(PURE.anchorOverlap(['a'], []), 0);
});

test('migrateIndexed: 구 인덱스 노트를 앵커 키로 이관, 앵커 없으면 byIndex 유지', () => {
  const out = PURE.migrateIndexed({ '0': '첫장', '2': '셋째장', '3': '' }, ['aa', 'bb', 'cc']);
  assert.deepEqual(out.anchors, { aa: '첫장', cc: '셋째장' });
  assert.deepEqual(out.byIndex, {});

  const noAnchor = PURE.migrateIndexed({ '1': '노트' }, null);
  assert.deepEqual(noAnchor.anchors, {});
  assert.deepEqual(noAnchor.byIndex, { '1': '노트' });
});
