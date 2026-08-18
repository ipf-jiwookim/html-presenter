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
