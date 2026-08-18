import { test } from 'node:test';
import assert from 'node:assert/strict';
import PURE from './core.mjs';

test('fnv1a: 같은 입력은 같은 6자리 hex, 다른 입력은 다른 값', () => {
  const a = PURE.fnv1a('hello world');
  assert.match(a, /^[0-9a-f]{6}$/);
  assert.equal(a, PURE.fnv1a('hello world'));
  assert.notEqual(a, PURE.fnv1a('hello worlds'));
});
