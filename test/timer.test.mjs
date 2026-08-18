import { test } from 'node:test';
import assert from 'node:assert/strict';
import PURE from './core.mjs';

test('fmtClock: 시간 단위는 필요할 때만', () => {
  assert.equal(PURE.fmtClock(0), '00:00');
  assert.equal(PURE.fmtClock(59), '00:59');
  assert.equal(PURE.fmtClock(600), '10:00');
  assert.equal(PURE.fmtClock(3661), '1:01:01');
});
