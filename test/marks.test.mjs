import { test } from 'node:test';
import assert from 'node:assert/strict';
import PURE from './core.mjs';

const strong = (cls, da, ac) => PURE.isCurrentMark('strong', cls, da, ac);
const loose = cls => PURE.isCurrentMark('loose', cls);

test('markWords: 공백·하이픈·밑줄을 모두 구분자로 본다', () => {
  assert.deepEqual(PURE.markWords('slide is-active'), ['slide', 'is', 'active']);
  assert.deepEqual(PURE.markWords('swiper-slide-active'), ['swiper', 'slide', 'active']);
  assert.deepEqual(PURE.markWords('slide_active'), ['slide', 'active']);
  assert.deepEqual(PURE.markWords(''), []);
  assert.deepEqual(PURE.markWords(null), []);
});

test('현재 장으로 인식해야 하는 표기', () => {
  assert.ok(strong('slide active'));
  assert.ok(strong('slide current'));
  assert.ok(strong('present'));                 // Reveal.js
  assert.ok(strong('swiper-slide swiper-slide-active'));  // Swiper
  assert.ok(strong('slide is-active'));
  assert.ok(strong('slide', 'true'));           // data-active
  assert.ok(strong('slide', null, 'true'));     // aria-current
  assert.ok(strong('slide', null, 'page'));     // aria-current=page 도 현재를 뜻한다
  assert.ok(loose('slide visible'));
  assert.ok(loose('slide on'));
  assert.ok(loose('slide selected'));
});

test('오판하면 안 되는 표기 — 이게 깨지면 자동 정렬이 청중 화면을 망친다', () => {
  assert.ok(!strong('slide inactive'), 'inactive 를 active 로 봐선 안 된다');
  assert.ok(!loose('slide inactive'));
  assert.ok(!strong('slide deactivated'));
  assert.ok(!strong('slide'));
  assert.ok(!strong('slide past'));             // Reveal 의 지난 장
  assert.ok(!strong('slide future'));           // Reveal 의 다음 장
  assert.ok(!strong('slide', 'false'));         // data-active="false"
  assert.ok(!strong('slide', ''));              // 빈 값은 표시가 아니다
  assert.ok(!strong('slide', null, 'false'));   // aria-current="false"
  assert.ok(!strong('overview'));               // current 를 품고 있지 않다
  assert.ok(!strong('nonactive'));
});

test('강한 표기와 느슨한 표기는 서로 섞이지 않는다', () => {
  assert.ok(!loose('slide active'), '느슨한 검사는 active 를 보지 않는다(우선순위 유지)');
  assert.ok(!strong('slide visible'), '강한 검사는 visible 을 보지 않는다');
});
