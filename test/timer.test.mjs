import { test } from 'node:test';
import assert from 'node:assert/strict';
import PURE from './core.mjs';

test('fmtClock: 시간 단위는 필요할 때만', () => {
  assert.equal(PURE.fmtClock(0), '00:00');
  assert.equal(PURE.fmtClock(59), '00:59');
  assert.equal(PURE.fmtClock(600), '10:00');
  assert.equal(PURE.fmtClock(3661), '1:01:01');
});

test('validateGoal: 빈 값은 해제, 1~600 만 허용', () => {
  assert.deepEqual(PURE.validateGoal('45'), { ok: true, min: 45 });
  assert.deepEqual(PURE.validateGoal(' 90 '), { ok: true, min: 90 });
  assert.deepEqual(PURE.validateGoal(''), { ok: 'clear' });
  assert.deepEqual(PURE.validateGoal('   '), { ok: 'clear' });
  assert.deepEqual(PURE.validateGoal(null), { ok: 'clear' });
  assert.deepEqual(PURE.validateGoal('0'), { ok: false });
  assert.deepEqual(PURE.validateGoal('601'), { ok: false });
  assert.deepEqual(PURE.validateGoal('-5'), { ok: false });
  assert.deepEqual(PURE.validateGoal('45분'), { ok: false });
});

test('goalDisplay: 남은 → 5분 경고 → 초과는 양수 표기', () => {
  assert.deepEqual(PURE.goalDisplay(45, 0), { label: '남은', text: '45:00', state: 'ok' });
  assert.deepEqual(PURE.goalDisplay(45, 40 * 60 * 1000), { label: '남은', text: '05:00', state: 'warn' });
  assert.deepEqual(PURE.goalDisplay(45, 45 * 60 * 1000), { label: '남은', text: '00:00', state: 'warn' });
  assert.deepEqual(PURE.goalDisplay(45, 47 * 60 * 1000 + 20000), { label: '초과', text: '02:20', state: 'over' });
});
