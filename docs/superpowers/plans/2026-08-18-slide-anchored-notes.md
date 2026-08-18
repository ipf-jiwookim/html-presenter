# 슬라이드 앵커 노트 · 내보내기/가져오기 · 발표 편의 기능 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노트를 페이지 번호가 아니라 슬라이드 내용에 붙여 덱 수정에도 안 밀리게 하고, 노트를 마크다운으로 내보내고 다시 가져올 수 있게 한다. 덤으로 조용한 실패 2건을 없애고 큐 시트 글씨 크기·목표 타이머를 추가한다.

**Architecture:** `index.html` 단일 파일 구조를 유지한다. 순수 로직(지문·직렬화·파싱·검증)은 파일 안의 `PURE CORE` 구역에 모으고 그 구역 끝의 `PURE` 객체로 공개한다. `test/core.mjs`가 `index.html`에서 그 구역만 정규식으로 잘라 `new Function`으로 실행하므로, 빌드 도구 없이 `node --test`로 순수 로직을 테스트할 수 있고 코드 중복도 없다. DOM 배선은 브라우저 패널(로컬 `python3 -m http.server 8123`)에서 스니펫으로 검증한다.

**Tech Stack:** 바닐라 JS(ES2020), Node 22 내장 `node:test`/`node:assert`(의존성 0), 로컬 정적 서버, Chrome.

**참조 스펙:** `docs/superpowers/specs/2026-08-18-slide-anchored-notes-design.md` (rev2)

**스펙 정정 1건:** 스펙 §1-1의 출력 예시 `["a3f9c1", "empty#1", …]`는 §1-1 절차 7·§1-2 예시(`empty#2`)와 모순된다. **첫 등장은 접미사 없음, 두 번째부터 `#2`** 규칙을 따른다.

---

## File Structure

| 파일 | 역할 |
|---|---|
| `index.html` (수정) | 도구 본체. `PURE CORE` 구역(순수 로직) + DOM 배선 |
| `test/core.mjs` (신규) | `index.html`의 PURE CORE 구역을 잘라 실행해 `PURE` 객체를 내보내는 하네스 |
| `test/anchors.test.mjs` (신규) | 지문·겹침·마이그레이션 테스트 |
| `test/notes-file.test.mjs` (신규) | 내보내기 직렬화·가져오기 파싱·파일명 테스트 |
| `test/timer.test.mjs` (신규) | 목표 시간 검증·표시 테스트 |
| `README.md` (수정) | 기능 표·테스트 실행법 한 줄 |

`index.html` 안 배치 순서(위→아래): 기존 상태 변수 → **PURE CORE 구역** → 덱 로드 → 프레임 → 내비게이션 → 청중 창 → 타이머 → 노트(레코드 계층) → 나머지.

---

## Task 1: 테스트 하네스와 PURE CORE 구역 만들기

**Files:**
- Modify: `index.html` (`<script>` 시작부, 현재 279행 `'use strict';` 직후)
- Create: `test/core.mjs`
- Test: `test/anchors.test.mjs`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/core.mjs`:

```js
// index.html 의 PURE CORE 구역만 잘라 실행한다 — 단일 파일 구조를 깨지 않고
// 순수 로직을 node --test 로 검증하기 위한 하네스.
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const m = html.match(/\/\* ==== PURE CORE START ==== \*\/([\s\S]*?)\/\* ==== PURE CORE END ==== \*\//);
if (!m) throw new Error('index.html 에서 PURE CORE 구역 주석을 찾지 못했습니다');

const PURE = new Function(`${m[1]}\nreturn PURE;`)();
export default PURE;
```

`test/anchors.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import PURE from './core.mjs';

test('fnv1a: 같은 입력은 같은 6자리 hex, 다른 입력은 다른 값', () => {
  const a = PURE.fnv1a('hello world');
  assert.match(a, /^[0-9a-f]{6}$/);
  assert.equal(a, PURE.fnv1a('hello world'));
  assert.notEqual(a, PURE.fnv1a('hello worlds'));
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/`
Expected: FAIL — `Error: index.html 에서 PURE CORE 구역 주석을 찾지 못했습니다`

- [ ] **Step 3: 최소 구현**

`index.html`의 `'use strict';` 다음 줄에 삽입:

```js
/* ==== PURE CORE START ==== */
/* DOM 을 만지지 않는 순수 로직만 둔다. test/core.mjs 가 이 구역을 그대로 읽어 실행하므로
   여기에 document·window 참조를 넣으면 테스트가 깨진다. */

function fnv1a(str){
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(-6);
}

const PURE = { fnv1a };
/* ==== PURE CORE END ==== */
if (typeof window !== 'undefined') window.__pt = PURE;   // 브라우저 검증용 훅
```

- [ ] **Step 4: 통과 확인**

Run: `node --test test/`
Expected: PASS 1

- [ ] **Step 5: 커밋**

```bash
git add index.html test/
git commit -m "test: PURE CORE 구역과 node 테스트 하네스 추가"
```

---

## Task 2: 토큰 정규화 — 숫자 포함 토큰 버리기

푸터의 `P.07 / 21`이 총장수 변화(21→22)로 전 슬라이드 지문을 무효화하는 것을 막는 핵심 단계.

**Files:**
- Modify: `index.html` (PURE CORE 구역)
- Test: `test/anchors.test.mjs`

- [ ] **Step 1: 실패하는 테스트 추가**

`test/anchors.test.mjs`에 추가:

```js
test('normTokens: 소문자화·구두점 제거, 숫자 포함 토큰은 버린다', () => {
  assert.deepEqual(PURE.normTokens('Hello, World!'), ['hello', 'world']);
  assert.deepEqual(PURE.normTokens('P.07 / 21'), []);
  assert.deepEqual(PURE.normTokens('01 LLM 비용'), ['llm', '비용']);
  assert.deepEqual(PURE.normTokens('2026.07.23 쇼케이스'), ['쇼케이스']);
  assert.deepEqual(PURE.normTokens(''), []);
  assert.deepEqual(PURE.normTokens(null), []);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/`
Expected: FAIL — `PURE.normTokens is not a function`

- [ ] **Step 3: 최소 구현**

PURE CORE에 `fnv1a` 다음으로 추가하고 `PURE` 객체에 등록:

```js
// 숫자를 포함한 토큰은 버린다 — 페이지 카운터(P.07 / 21)나 날짜가 지문에 섞이면
// 장 수가 바뀔 때 전 슬라이드의 지문이 함께 무효화된다.
function normTokens(text){
  return String(text == null ? '' : text)
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(t => t && !/\p{N}/u.test(t));
}
```

`const PURE = { fnv1a, normTokens };`

- [ ] **Step 4: 통과 확인**

Run: `node --test test/`
Expected: PASS 2

- [ ] **Step 5: 커밋**

```bash
git add index.html test/anchors.test.mjs
git commit -m "feat: 앵커용 토큰 정규화 — 숫자 토큰 제거"
```

---

## Task 3: 슬라이드 지문 — 공통 토큰 스톱워드와 짧은 덱 예외

**Files:**
- Modify: `index.html` (PURE CORE 구역)
- Test: `test/anchors.test.mjs`

- [ ] **Step 1: 실패하는 테스트 추가**

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/`
Expected: FAIL — `PURE.slideAnchors is not a function`

- [ ] **Step 3: 최소 구현**

```js
// 슬라이드 텍스트 배열 → 앵커 배열. 첫 등장은 접미사 없이, 같은 지문의 n번째는 `#n`.
function slideAnchors(texts){
  const per = (texts || []).map(normTokens);
  const stop = new Set();
  // 5장 미만에서는 공통 토큰 제거를 건너뛴다 — 짧은 덱은 본문 단어까지 공통으로 잡혀
  // 지문이 전멸한다.
  if (per.length >= 5) {
    const count = new Map();
    per.forEach(tokens => new Set(tokens).forEach(t => count.set(t, (count.get(t) || 0) + 1)));
    const limit = per.length * 0.8;
    count.forEach((c, t) => { if (c >= limit) stop.add(t); });
  }
  const seen = new Map();
  return per.map(tokens => {
    const body = tokens.filter(t => !stop.has(t)).join(' ');
    const base = body ? fnv1a(body) : 'empty';
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}
```

`const PURE = { fnv1a, normTokens, slideAnchors };`

- [ ] **Step 4: 통과 확인**

Run: `node --test test/`
Expected: PASS 5

- [ ] **Step 5: 커밋**

```bash
git add index.html test/anchors.test.mjs
git commit -m "feat: 슬라이드 지문 생성 — 공통 토큰 제거와 짧은 덱 예외"
```

---

## Task 4: 지문 — 삽입 시나리오와 중복 장

이 계획의 핵심 회귀 방어선이다.

**Files:**
- Test: `test/anchors.test.mjs` (구현 변경 없이 통과해야 한다)

- [ ] **Step 1: 테스트 추가**

```js
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
```

- [ ] **Step 2: 통과 확인 (구현 추가 없이)**

Run: `node --test test/`
Expected: PASS 8. 실패하면 Task 3 구현을 고친다 — 테스트를 고치지 말 것.

- [ ] **Step 3: 커밋**

```bash
git add test/anchors.test.mjs
git commit -m "test: 장 삽입·중복 장 앵커 회귀 테스트"
```

---

## Task 5: 앵커 겹침 비율과 구노트 마이그레이션

**Files:**
- Modify: `index.html` (PURE CORE 구역)
- Test: `test/anchors.test.mjs`

- [ ] **Step 1: 실패하는 테스트 추가**

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/`
Expected: FAIL — `PURE.anchorOverlap is not a function`

- [ ] **Step 3: 최소 구현**

```js
// 작은 쪽 집합 기준 — 노트 3개짜리 파일이 21장 덱과 온전히 일치할 수 있어야 한다.
function anchorOverlap(a, b){
  const A = new Set(a || []), B = new Set(b || []);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  A.forEach(x => { if (B.has(x)) hit++; });
  return hit / Math.min(A.size, B.size);
}

function migrateIndexed(oldMap, anchors){
  const out = { anchors: {}, byIndex: {} };
  Object.keys(oldMap || {}).forEach(k => {
    const text = oldMap[k];
    if (!text) return;
    const a = anchors && anchors[Number(k)];
    if (a) out.anchors[a] = text;
    else out.byIndex[String(Number(k))] = text;
  });
  return out;
}
```

`const PURE = { fnv1a, normTokens, slideAnchors, anchorOverlap, migrateIndexed };`

- [ ] **Step 4: 통과 확인**

Run: `node --test test/`
Expected: PASS 10

- [ ] **Step 5: 커밋**

```bash
git add index.html test/anchors.test.mjs
git commit -m "feat: 앵커 겹침 비율과 구노트 마이그레이션 로직"
```

---

## Task 6: deckState가 슬라이드 엘리먼트를 함께 반환하게

앵커 계산에 엘리먼트 목록이 필요하다. 기존 호출자는 `.i`/`.n`만 쓰므로 안전한 추가다.

**Files:**
- Modify: `index.html` — `deckState()` (현재 약 372행)

- [ ] **Step 1: 구현**

`deckState`의 `return { i, n: els.length };`를 다음으로 바꾼다:

```js
        if (i >= 0) return { i, n: els.length, els };
```

- [ ] **Step 2: 브라우저에서 회귀 확인**

서버 실행: `python3 -m http.server 8123` (프로젝트 폴더에서)
브라우저 패널에서 `http://localhost:8123/index.html` 열고 `sample-deck.html`을 로드한 뒤 스니펫 실행:

```js
new Promise(res=>{ fetch('sample-deck.html').then(r=>r.text()).then(t=>{
  window.__ptLoad(t,'sample-deck.html');
  setTimeout(()=>{ document.querySelector('#nextBtn').click();
    setTimeout(()=>{ const s=deckState(mirror.contentWindow);
      res({chip:document.getElementById('posChip').textContent, i:s.i, n:s.n, els:s.els.length}); },400); },1500); }); })
```

Expected: `{chip:"2 / 5", i:1, n:5, els:5}`

- [ ] **Step 3: 커밋**

```bash
git add index.html
git commit -m "refactor: deckState 가 슬라이드 엘리먼트 목록도 반환"
```

---

## Task 7: 노트 레코드 계층 — 통합 키·디바운스·저장공간 경고

**Files:**
- Modify: `index.html` — 노트 섹션 전체(현재 608~627행 `/* ---------- 페이지별 메모 ---------- */` 블록), `showNotice()`(현재 약 470행)

- [ ] **Step 1: showNotice에 버튼 표시 여부 인자 추가**

기존:

```js
function showNotice(msg){ $('#noticeMsg').textContent = msg; $('#notice').hidden = false; }
```

교체:

```js
function showNotice(msg, withAudienceBtn){
  $('#noticeMsg').textContent = msg;
  $('#noticeBtn').hidden = !withAudienceBtn;
  $('#notice').hidden = false;
}
```

기존 호출 두 곳(덱 교체 안내, 팝업 차단 안내)에 `true`를 넘긴다:

```js
    showNotice('발표 자료가 바뀌었습니다. 청중 화면을 다시 열어주세요.', true);
```

```js
    showNotice('팝업이 차단되었습니다. 주소창 오른쪽 팝업 아이콘에서 “항상 허용”을 선택한 뒤 다시 열어주세요.', true);
```

- [ ] **Step 2: 노트 섹션을 레코드 계층으로 교체**

현재 `/* ---------- 페이지별 메모 ---------- */` 부터 `loadNotes()` 끝까지를 다음으로 교체:

```js
/* ---------- 노트 레코드 ----------
   덱당 키 1개(ptnotes2:{deckName})에 앵커 노트·인덱스 폴백·미배정함·설정을 모아 둔다. */
const mem = {};
const store = {
  get(k){ try { const v = localStorage.getItem(k); return v === null ? (k in mem ? mem[k] : null) : v; } catch (_) { return k in mem ? mem[k] : null; } },
  set(k, v){ mem[k] = v; try { localStorage.setItem(k, v); return true; } catch (_) { return false; } },
  keys(){ try { return Object.keys(localStorage); } catch (_) { return Object.keys(mem); } }
};

let rec = blankRec(), warnedFull = false, saveT = null;
function blankRec(){ return { anchors: {}, byIndex: {}, orphans: [], fontSize: 16 }; }
const recKey = name => `ptnotes2:${name || deckName}`;

function saveRecNow(){
  if (!store.set(recKey(), JSON.stringify(rec)) && !warnedFull) {
    warnedFull = true;
    showNotice('브라우저 저장 공간이 꽉 차 메모를 영구 저장할 수 없습니다. 노트를 내보내 두세요.');
  }
}
function saveRec(){ clearTimeout(saveT); saveT = setTimeout(saveRecNow, 300); }

// 앵커는 미리 계산하지 않는다 — 덱 스크립트가 늦게 초기화되면 빈 지문이 캐시된다.
let anchorCache = null;
function deckAnchors(){
  try {
    const s = deckState(mirror.contentWindow);
    if (!s || !s.els) return null;
    const key = deckName + '|' + s.n;
    if (anchorCache && anchorCache.key === key) return anchorCache.list;
    const texts = s.els.map(el => el.textContent || '');
    if (!texts.some(t => t.trim())) return null;   // 아직 초기화 전 — 캐시하지 않고 재시도
    const list = slideAnchors(texts);
    anchorCache = { key, list };
    return list;
  } catch (_) { return null; }
}
function anchorFor(i){
  const list = deckAnchors();
  return (list && list[i]) || null;
}
function noteGet(i){
  const a = anchorFor(i);
  if (a && rec.anchors[a] != null) return rec.anchors[a];
  return rec.byIndex[String(i)] || '';
}
function noteSet(i, text){
  const a = anchorFor(i);
  if (a) { rec.anchors[a] = text; delete rec.byIndex[String(i)]; }
  else rec.byIndex[String(i)] = text;
  saveRec();
}

function loadRec(){
  anchorCache = null;
  const raw = store.get(recKey());
  if (raw) { try { rec = Object.assign(blankRec(), JSON.parse(raw)); return; } catch (_) {} }
  rec = blankRec();
  // 구키(ptnotes:{deckName}:{n}) 마이그레이션 — 구키는 롤백용으로 남긴다
  const old = {};
  store.keys().forEach(k => {
    const p = k.indexOf(`ptnotes:${deckName}:`);
    if (p === 0) old[k.slice(`ptnotes:${deckName}:`.length)] = store.get(k);
  });
  if (Object.keys(old).length) {
    const moved = migrateIndexed(old, deckAnchors());
    rec.anchors = moved.anchors; rec.byIndex = moved.byIndex;
    saveRecNow();
  }
}

$('#note').oninput = () => {
  noteSet(step, $('#note').value);
  const tag = $('#savedTag');
  tag.classList.add('show');
  clearTimeout($('#note')._t);
  $('#note')._t = setTimeout(() => tag.classList.remove('show'), 1200);
};
function loadNotes(){
  $('#note').value = noteGet(step);
  $('#nextnote').textContent = noteGet(step + 1);
  $('#savedTag').classList.remove('show');
  applyFontSize();
  renderOrphans();
}
```

- [ ] **Step 3: 덱 로드 시 레코드를 읽게 배선**

`loadDeck()`의 `updateStep(); loadNotes();` 앞에 `loadRec();`를 넣는다:

```js
  loadRec();
  updateStep(); loadNotes();
```

`fontSize`/`orphans` 렌더 함수는 Task 12·13에서 만든다. 지금은 임시 스텁을 PURE CORE 밖(노트 섹션 끝)에 둔다:

```js
function applyFontSize(){}
function renderOrphans(){}
```

- [ ] **Step 4: 브라우저 검증 — 마이그레이션과 앵커 저장**

```js
new Promise(res=>{
  localStorage.clear();
  localStorage.setItem('ptnotes:sample-deck.html:1','구노트 2페이지');
  fetch('sample-deck.html').then(r=>r.text()).then(t=>{
    window.__ptLoad(t,'sample-deck.html');
    setTimeout(()=>{ document.querySelector('#nextBtn').click();
      setTimeout(()=>{
        const migrated = document.getElementById('note').value;
        const note=document.getElementById('note');
        note.value='새 노트'; note.dispatchEvent(new Event('input'));
        setTimeout(()=>res({migrated, anchors:Object.keys(rec.anchors), saved:JSON.parse(localStorage.getItem('ptnotes2:sample-deck.html')).anchors}),500);
      },500); },1500); }); })
```

Expected: `migrated`가 `"구노트 2페이지"`, `anchors`가 6자리 hex 1개, `saved`에 `"새 노트"`가 들어있음.

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: 노트 레코드 계층 — 앵커 키·디바운스 저장·저장공간 경고·구키 마이그레이션"
```

---

## Task 8: 삽입 시나리오 브라우저 검증 (인수 조건)

**Files:** 없음 (검증만)

- [ ] **Step 1: 21장짜리 실덱을 임시 복사**

```bash
cp "/Users/kimjiwoo/Desktop/AI 깐부 준비/AI깐부_쇼케이스_발표자료.html" test-deck.html
```

- [ ] **Step 2: 노트 3개를 넣고, 8번 앞에 장을 끼운 사본으로 다시 로드**

브라우저 패널에서:

```js
new Promise(res=>{
  localStorage.clear();
  fetch('test-deck.html').then(r=>r.text()).then(t=>{
    window.__ptLoad(t,'deck.html');
    const type=(v)=>{const n=document.getElementById('note');n.value=v;n.dispatchEvent(new Event('input'));};
    setTimeout(()=>{
      type('1장 노트');
      for(let k=0;k<7;k++) document.querySelector('#nextBtn').click();
      setTimeout(()=>{
        type('8장 노트');
        for(let k=0;k<5;k++) document.querySelector('#nextBtn').click();
        setTimeout(()=>{
          type('13장 노트');
          // 8번째 슬라이드 앞에 새 장을 끼운 사본 만들기
          const doc=new DOMParser().parseFromString(t,'text/html');
          const slides=[...doc.querySelectorAll('.slide')];
          const clone=slides[0].cloneNode(true);
          clone.className='slide'; clone.textContent='새로 만든 장';
          slides[7].parentNode.insertBefore(clone, slides[7]);
          const grown='<!doctype html>'+doc.documentElement.outerHTML;
          window.__ptLoad(grown,'deck.html');
          setTimeout(()=>{
            const read=(i)=>{ step=i; loadNotes(); return document.getElementById('note').value; };
            res({총장수:deckState(mirror.contentWindow).n, '1장':read(0), '새장(8번째)':read(7), '밀려간 8장(9번째)':read(8), '밀려간 13장(14번째)':read(13)});
          },1800);
        },600);
      },900);
    },1600);
  }); })
```

Expected:
```
총장수: 22
1장: "1장 노트"
새장(8번째): ""
밀려간 8장(9번째): "8장 노트"
밀려간 13장(14번째): "13장 노트"
```

하나라도 어긋나면 진행하지 말고 Task 3의 스톱워드·숫자 제거를 점검한다.

- [ ] **Step 3: 임시 덱 삭제**

```bash
rm -f test-deck.html
```

- [ ] **Step 4: 커밋 (검증 기록만)**

```bash
git commit --allow-empty -m "test: 장 삽입 시 노트가 제자리를 지키는지 브라우저 검증 통과"
```

---

## Task 9: 이전 노트 복구 — 파일명이 바뀐 경우

**Files:**
- Modify: `index.html` — 노트 섹션(`loadRec` 뒤)

- [ ] **Step 1: 구현**

`loadRec()`의 `rec = blankRec();` 이후 마이그레이션 블록 **끝**에 이어서 붙인다(마이그레이션으로 노트를 얻지 못한 경우에만 복구 제안):

```js
  if (!Object.keys(rec.anchors).length && !Object.keys(rec.byIndex).length) offerRecovery();
```

노트 섹션 끝에 추가:

```js
// 파일명만 바뀐 경우(발표자료.html → 발표자료_최종.html) 앵커 겹침으로 이전 노트를 찾아 제안한다.
function offerRecovery(){
  const mine = deckAnchors();
  if (!mine) return;
  let best = null;
  store.keys().forEach(k => {
    if (k.indexOf('ptnotes2:') !== 0 || k === recKey() || k.endsWith(':undo')) return;
    let other;
    try { other = JSON.parse(store.get(k)); } catch (_) { return; }
    const keys = Object.keys((other && other.anchors) || {});
    if (!keys.length) return;
    const score = anchorOverlap(keys, mine);
    if (score >= 0.4 && (!best || score > best.score)) best = { key: k, score, count: keys.length, rec: other };
  });
  if (!best) return;
  const from = best.key.slice('ptnotes2:'.length);
  showNotice(`「${from}」에 쓴 노트 ${best.count}개가 있습니다. 이 자료의 것으로 보입니다.`);
  const btn = $('#noticeBtn');
  btn.hidden = false;
  btn.textContent = '불러오기';
  btn.onclick = () => {
    rec.anchors = Object.assign({}, best.rec.anchors);
    rec.byIndex = Object.assign({}, best.rec.byIndex || {});
    rec.orphans = (best.rec.orphans || []).slice();
    saveRecNow(); loadNotes();
    $('#notice').hidden = true;
    restoreNoticeBtn();
    flash(`노트 ${best.count}개를 불러왔습니다.`);
  };
}
// 알림 바 버튼을 기본(청중 화면 열기)으로 되돌린다
function restoreNoticeBtn(){
  const btn = $('#noticeBtn');
  btn.textContent = '청중 화면 열기';
  btn.onclick = function(){ this.blur(); openAudience(); };
}
```

기존 `$('#noticeBtn').onclick = …` 한 줄을 `restoreNoticeBtn();` 호출로 교체한다(중복 정의 방지):

```js
restoreNoticeBtn();
```

- [ ] **Step 2: 브라우저 검증**

```js
new Promise(res=>{
  localStorage.clear();
  fetch('sample-deck.html').then(r=>r.text()).then(t=>{
    window.__ptLoad(t,'원본.html');
    setTimeout(()=>{
      const n=document.getElementById('note'); n.value='복구 대상 노트'; n.dispatchEvent(new Event('input'));
      setTimeout(()=>{
        window.__ptLoad(t,'원본_최종.html');       // 같은 내용, 다른 파일명
        setTimeout(()=>{
          const shown=document.getElementById('noticeMsg').textContent;
          document.getElementById('noticeBtn').click();
          setTimeout(()=>res({shown, restored:document.getElementById('note').value, btn:document.getElementById('noticeBtn').textContent}),300);
        },1800);
      },500);
    },1600); }); })
```

Expected: `shown`에 `「원본.html」에 쓴 노트 1개`, `restored`가 `"복구 대상 노토"`가 아니라 `"복구 대상 노트"`, `btn`이 `"청중 화면 열기"`로 복구됨.

- [ ] **Step 3: 커밋**

```bash
git add index.html
git commit -m "feat: 파일명이 바뀐 덱의 이전 노트 복구 제안"
```

---

## Task 10: 내보내기 직렬화

**Files:**
- Modify: `index.html` (PURE CORE 구역)
- Create: `test/notes-file.test.mjs`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/notes-file.test.mjs`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/`
Expected: FAIL — `PURE.sanitizeName is not a function`

- [ ] **Step 3: 최소 구현**

PURE CORE에 추가:

```js
function sanitizeName(s){
  const out = String(s == null ? '' : s).replace(/\.html?$/i, '').replace(/[\/\\:*?"<>|]+/g, '_').trim();
  return out || 'deck';
}
function noteFileName(deckName, today){
  return `${today}_${sanitizeName(deckName)}_노트.md`;
}

// 사람이 읽을 수 있는 대본 겸 가져오기용 파일. 연결의 근거는 slide 주석뿐이고
// 페이지 번호는 참고값이다.
function serializeNotes(o){
  const L = [];
  L.push(`# ${o.deckName} — 발표 노트`);
  L.push(`<!-- html-presenter notes v1 · ${o.total}페이지 · ${o.today} -->`);
  L.push('<!-- 이 파일은 자유롭게 고쳐도 되지만, slide 주석은 지우지 마세요 —');
  L.push('     다시 가져올 때 노트가 제자리를 찾는 표시입니다. -->');
  (o.notes || []).forEach(n => {
    L.push('');
    L.push(`## ${n.index + 1} / ${o.total} · "${n.title || '(제목 없음)'}"`);
    L.push(`<!-- slide: ${n.anchor} -->`);
    L.push(n.text);
  });
  if ((o.orphans || []).length) {
    L.push('');
    L.push('## 미배정');
    o.orphans.forEach(p => {
      L.push('');
      L.push(`<!-- unassigned${p.hint ? ': ' + p.hint : ''} -->`);
      L.push(p.text);
    });
  }
  return L.join('\n') + '\n';
}
```

`PURE` 객체에 `sanitizeName, noteFileName, serializeNotes` 추가.

- [ ] **Step 4: 통과 확인**

Run: `node --test test/`
Expected: PASS 13

- [ ] **Step 5: 커밋**

```bash
git add index.html test/notes-file.test.mjs
git commit -m "feat: 노트 마크다운 직렬화와 파일명 규칙"
```

---

## Task 11: 가져오기 파싱

**Files:**
- Modify: `index.html` (PURE CORE 구역)
- Test: `test/notes-file.test.mjs`

- [ ] **Step 1: 실패하는 테스트 추가**

```js
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

test('parseNotes: 같은 앵커가 두 번 나오면 이어 붙인다', () => {
  const md = '<!-- html-presenter notes v1 -->\n'
    + '<!-- slide: aa -->\n첫 번째\n\n'
    + '<!-- slide: aa -->\n두 번째\n';
  assert.equal(PURE.parseNotes(md).anchors.aa, '첫 번째\n\n두 번째');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/`
Expected: FAIL — `PURE.parseNotes is not a function`

- [ ] **Step 3: 최소 구현**

```js
// 섹션 경계는 주석 마커만 신뢰한다 — 사용자가 노트 본문에 ## 를 쓸 수 있기 때문.
function parseNotes(md){
  const text = String(md == null ? '' : md);
  const out = { ok: false, anchors: {}, orphans: [] };
  if (!/html-presenter notes v1/.test(text)) return out;
  out.ok = true;
  const re = /<!--\s*(?:slide:\s*([A-Za-z0-9#]+)|unassigned(?::\s*([^>]*?))?)\s*-->/g;
  const marks = [];
  let m;
  while ((m = re.exec(text))) marks.push({ at: m.index, len: m[0].length, anchor: m[1] || null, hint: (m[2] || '').trim() });
  marks.forEach((mk, k) => {
    const to = k + 1 < marks.length ? marks[k + 1].at : text.length;
    let body = text.slice(mk.at + mk.len, to);
    // 다음 섹션의 제목 줄은 본문이 아니다. 우리가 만든 형태만 정확히 떼어낸다.
    body = body.replace(/\n## (?:\d+ \/ \d+ · .*|미배정)[ \t]*\n?\s*$/, '');
    body = body.replace(/^[ \t]*\n/, '').replace(/\s+$/, '');
    if (!body) return;
    if (mk.anchor) out.anchors[mk.anchor] = out.anchors[mk.anchor] ? out.anchors[mk.anchor] + '\n\n' + body : body;
    else out.orphans.push({ text: body, hint: mk.hint });
  });
  return out;
}
```

`PURE` 객체에 `parseNotes` 추가.

- [ ] **Step 4: 통과 확인**

Run: `node --test test/`
Expected: PASS 17

- [ ] **Step 5: 커밋**

```bash
git add index.html test/notes-file.test.mjs
git commit -m "feat: 노트 마크다운 파싱 — 주석 마커 기준 왕복"
```

---

## Task 12: 내보내기 버튼과 큐 시트 글씨 크기

**Files:**
- Modify: `index.html` — `.cue-head` 마크업(현재 254~258행), CSS, 노트 섹션

- [ ] **Step 1: 마크업 교체**

```html
      <div class="cue-head">
        <h2>큐 시트</h2>
        <span id="noteFor"></span>
        <span id="savedTag" aria-live="polite">저장됨</span>
        <button id="fontDown" class="ghost" aria-label="메모 글씨 작게">A−</button>
        <button id="fontUp" class="ghost" aria-label="메모 글씨 크게">A+</button>
        <button id="exportBtn" class="ghost">내보내기</button>
      </div>
```

- [ ] **Step 2: CSS — savedTag가 밀어내던 자리 정리**

`#savedTag{margin-left:auto;…}` 를 다음으로 바꾼다:

```css
#savedTag{margin-left:auto;font-size:12px;color:var(--ok);opacity:0;transition:opacity .25s ease}
.cue-head button{padding:4px 9px;font-size:12.5px}
```

- [ ] **Step 3: 글씨 크기 구현 (Task 7의 스텁 `applyFontSize` 교체)**

```js
const FONT_STEPS = [13, 16, 20, 24, 28];
function applyFontSize(){
  const px = FONT_STEPS.includes(rec.fontSize) ? rec.fontSize : 16;
  rec.fontSize = px;
  $('#note').style.fontSize = px + 'px';
  $('#nextnote').style.fontSize = Math.max(12, px - 3) + 'px';
  const at = FONT_STEPS.indexOf(px);
  $('#fontDown').disabled = at === 0;                      // 끝에서 눌러도 무반응인 상태를 만들지 않는다
  $('#fontUp').disabled = at === FONT_STEPS.length - 1;
}
function bumpFont(dir){
  const at = FONT_STEPS.indexOf(rec.fontSize);
  const next = FONT_STEPS[Math.min(FONT_STEPS.length - 1, Math.max(0, at + dir))];
  rec.fontSize = next; applyFontSize(); saveRec();
}
$('#fontDown').onclick = function(){ this.blur(); bumpFont(-1); };
$('#fontUp').onclick = function(){ this.blur(); bumpFont(1); };
```

- [ ] **Step 4: 내보내기 구현**

```js
function slideTitle(i){
  try {
    const s = deckState(mirror.contentWindow);
    const el = s && s.els && s.els[i];
    if (!el) return '';
    const line = (el.innerText || el.textContent || '').split('\n').map(x => x.trim()).find(x => x);
    return line ? line.slice(0, 40) : '';
  } catch (_) { return ''; }
}
function exportNotes(){
  const list = deckAnchors();
  const total = (deckState(mirror.contentWindow) || {}).n || 0;
  const notes = [];
  if (list) list.forEach((a, i) => { if (rec.anchors[a]) notes.push({ anchor: a, index: i, title: slideTitle(i), text: rec.anchors[a] }); });
  Object.keys(rec.byIndex).forEach(k => {
    const i = Number(k);
    if (rec.byIndex[k]) notes.push({ anchor: 'index-' + i, index: i, title: slideTitle(i), text: rec.byIndex[k] });
  });
  notes.sort((a, b) => a.index - b.index);
  const md = serializeNotes({
    deckName, total, today: new Date().toISOString().slice(0, 10),
    notes, orphans: rec.orphans || []
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
  a.download = noteFileName(deckName, new Date().toISOString().slice(0, 10));
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  flash(`노트 ${notes.length}개를 내보냈습니다.`);
}
$('#exportBtn').onclick = function(){ this.blur(); exportNotes(); };
function refreshExportBtn(){
  const has = Object.keys(rec.anchors).length || Object.keys(rec.byIndex).length || (rec.orphans || []).length;
  $('#exportBtn').disabled = !has;
  $('#exportBtn').title = has ? '' : '내보낼 메모가 없습니다';
}
```

`loadNotes()` 끝에 `refreshExportBtn();`을 추가하고, `$('#note').oninput` 안 `noteSet(...)` 다음 줄에도 `refreshExportBtn();`을 넣는다.

- [ ] **Step 5: 브라우저 검증**

```js
new Promise(res=>{
  localStorage.clear();
  fetch('sample-deck.html').then(r=>r.text()).then(t=>{
    window.__ptLoad(t,'sample-deck.html');
    setTimeout(()=>{
      const before = document.getElementById('exportBtn').disabled;
      const n=document.getElementById('note'); n.value='내보낼 노트'; n.dispatchEvent(new Event('input'));
      setTimeout(()=>{
        document.getElementById('fontUp').click(); document.getElementById('fontUp').click();
        document.getElementById('fontUp').click(); document.getElementById('fontUp').click();
        res({exportDisabledAtStart:before, exportDisabledNow:document.getElementById('exportBtn').disabled,
             fontSize:getComputedStyle(document.getElementById('note')).fontSize,
             upDisabledAtMax:document.getElementById('fontUp').disabled});
      },400);
    },1600); }); })
```

Expected: `{exportDisabledAtStart:true, exportDisabledNow:false, fontSize:"28px", upDisabledAtMax:true}`

- [ ] **Step 6: 커밋**

```bash
git add index.html
git commit -m "feat: 노트 내보내기 버튼과 큐 시트 글씨 크기 조절"
```

---

## Task 13: 미배정 노트함 UI

**Files:**
- Modify: `index.html` — `.cue` 마크업(현재 261행 `#nextnote` 뒤), CSS, 노트 섹션(`renderOrphans` 스텁 교체)

- [ ] **Step 1: 마크업 추가 (`<div id="nextnote"></div>` 다음)**

```html
      <details id="orphanBox" hidden>
        <summary id="orphanSum"></summary>
        <div id="orphanList"></div>
      </details>
```

- [ ] **Step 2: CSS 추가 (`#nextnote` 규칙 뒤)**

```css
#orphanBox{margin:0 14px 14px;border:1px solid var(--rule);border-radius:8px;background:#12151a}
#orphanSum{padding:9px 12px;cursor:pointer;font-family:var(--label);font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--next)}
.orphan{padding:10px 12px;border-top:1px solid var(--rule);display:flex;flex-direction:column;gap:7px}
.orphan .hint{font-size:11.5px;color:#6c7482}
.orphan .body{font-size:13px;line-height:1.6;white-space:pre-wrap;max-height:4.5em;overflow:auto}
.orphan .row{display:flex;gap:7px}
.orphan button{padding:5px 10px;font-size:12.5px}
```

- [ ] **Step 3: `renderOrphans` 구현 (Task 7 스텁 교체)**

```js
function renderOrphans(){
  const box = $('#orphanBox'), list = $('#orphanList');
  const items = rec.orphans || [];
  box.hidden = !items.length;
  if (!items.length) { list.textContent = ''; return; }
  $('#orphanSum').textContent = `자리를 못 찾은 노트 ${items.length}개`;
  list.textContent = '';
  items.forEach((o, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'orphan';
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = o.hint ? `원래 위치: ${o.hint}` : '원래 위치 정보 없음';
    const body = document.createElement('div');
    body.className = 'body';
    body.textContent = o.text;
    const row = document.createElement('div');
    row.className = 'row';
    const put = document.createElement('button');
    put.textContent = '이 페이지에 붙이기';
    put.onclick = () => {
      const cur = noteGet(step);
      noteSet(step, cur ? cur + '\n\n' + o.text : o.text);   // 덮지 않고 이어 붙인다
      rec.orphans.splice(idx, 1);
      saveRecNow(); loadNotes(); refreshExportBtn();
      flash(`${step + 1}페이지에 붙였습니다.`);
    };
    const del = document.createElement('button');
    del.textContent = '삭제';
    del.onclick = () => { rec.orphans.splice(idx, 1); saveRecNow(); renderOrphans(); refreshExportBtn(); };
    row.append(put, del);
    wrap.append(hint, body, row);
    list.append(wrap);
  });
}
```

- [ ] **Step 4: 브라우저 검증**

```js
new Promise(res=>{
  localStorage.clear();
  fetch('sample-deck.html').then(r=>r.text()).then(t=>{
    window.__ptLoad(t,'sample-deck.html');
    setTimeout(()=>{
      rec.orphans=[{text:'떠도는 멘트',hint:'9 / 21 · 옛 장'}]; renderOrphans();
      const shown=!document.getElementById('orphanBox').hidden;
      const sum=document.getElementById('orphanSum').textContent;
      document.querySelector('.orphan .row button').click();
      setTimeout(()=>res({shown, sum, note:document.getElementById('note').value,
        hiddenAfter:document.getElementById('orphanBox').hidden}),400);
    },1600); }); })
```

Expected: `{shown:true, sum:"자리를 못 찾은 노트 1개", note:"떠도는 멘트", hiddenAfter:true}`

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: 미배정 노트함 — 현재 페이지에 붙이기·삭제"
```

---

## Task 14: 가져오기 배선 — 확장자 분기·무손실 충돌·되돌리기

**Files:**
- Modify: `index.html` — `handleFile()`(현재 306~311행), `#fileInput` accept(229행), 드롭존 문구(226행), 노트 섹션

- [ ] **Step 1: 파일 입력이 .md도 받게**

```html
  <input type="file" id="fileInput" accept=".html,.htm,.md,text/html,text/markdown">
```

드롭존 안내문(`#dropzone` 안 첫 `<p>`) 끝에 한 문장을 덧붙인다:

```html
  <p>완성된 슬라이드 HTML 파일 하나를 끌어다 놓으면, 청중 화면과 분리된 발표자 콘솔이
     열립니다. 현재·다음 화면, 페이지별 메모, 경과 타이머가 함께 붙습니다.
     내보낸 노트(.md)를 놓으면 메모를 다시 불러옵니다.</p>
```

- [ ] **Step 2: `handleFile` 확장자 분기**

```js
function handleFile(file){
  if (!file) return;
  const isMd = /\.md$/i.test(file.name);
  if (isMd && !deckHTML) { flash('발표 자료를 먼저 열어주세요.'); return; }
  const r = new FileReader();
  r.onload = () => isMd ? importNotes(r.result) : loadDeck(r.result, file.name);
  r.readAsText(file);
}
```

- [ ] **Step 3: 가져오기 구현 (노트 섹션 끝)**

```js
// 어느 선택지를 골라도 노트가 사라지지 않는다 — 밀려난 쪽은 미배정함으로 간다.
function importNotes(text){
  const parsed = parseNotes(text);
  if (!parsed.ok) { flash('이 파일은 노트 내보내기 파일이 아닙니다.'); return; }
  const mine = deckAnchors();
  const fileKeys = Object.keys(parsed.anchors);
  if (mine && fileKeys.length && anchorOverlap(fileKeys, mine) < 0.2 &&
      !confirm('다른 자료에서 내보낸 노트로 보입니다. 계속할까요?')) return;

  const clash = fileKeys.filter(a => rec.anchors[a] && rec.anchors[a] !== parsed.anchors[a]);
  let replace = true;
  if (clash.length) {
    replace = confirm(`${clash.length}개 페이지에 이미 다른 노트가 있습니다.\n\n확인 = 파일 것으로 교체(기존 노트는 미배정함으로 이동)\n취소 = 기존 유지(파일 노트를 미배정함으로 이동)`);
  }

  store.set(recKey() + ':undo', JSON.stringify(rec));   // 되돌리기 스냅샷
  const orphans = (rec.orphans || []).slice();
  let placed = 0;
  fileKeys.forEach(a => {
    const incoming = parsed.anchors[a], existing = rec.anchors[a];
    const idx = mine ? mine.indexOf(a) : -1;
    const hint = idx >= 0 ? `${idx + 1}번째 장` : '';
    if (existing && existing !== incoming) {
      if (replace) { orphans.push({ text: existing, hint: (hint || '이전') + ' · 교체되기 전 노트' }); rec.anchors[a] = incoming; placed++; }
      else orphans.push({ text: incoming, hint: (hint || '가져온 노트') + ' · 기존 유지로 밀려난 노트' });
    } else if (mine && idx < 0) {
      orphans.push({ text: incoming, hint: '이 자료에서 위치를 찾지 못함' });
    } else { rec.anchors[a] = incoming; placed++; }
  });
  parsed.orphans.forEach(o => orphans.push(o));
  rec.orphans = orphans;
  saveRecNow(); loadNotes(); refreshExportBtn();

  const left = rec.orphans.length;
  flash(`노트 ${placed}개 연결${left ? ` · ${left}개는 미배정 노트함` : ''}.`);
  showUndo();
}
function showUndo(){
  const el = $('#flash');
  const btn = document.createElement('button');
  btn.textContent = '가져오기 되돌리기';
  btn.className = 'ghost';
  btn.style.marginLeft = '8px';
  btn.onclick = () => {
    const snap = store.get(recKey() + ':undo');
    if (!snap) return;
    try { rec = Object.assign(blankRec(), JSON.parse(snap)); } catch (_) { return; }
    saveRecNow(); loadNotes(); refreshExportBtn();
    el.textContent = '가져오기를 되돌렸습니다.';
  };
  el.append(btn);
  setTimeout(() => { if (btn.isConnected) btn.remove(); }, 30000);
}
```

`flash()`가 `textContent`로 지우므로 되돌리기 버튼도 함께 사라진다 — 의도된 동작이다.

- [ ] **Step 4: 브라우저 검증 — 왕복과 무손실 충돌**

```js
new Promise(res=>{
  localStorage.clear();
  fetch('sample-deck.html').then(r=>r.text()).then(t=>{
    window.__ptLoad(t,'sample-deck.html');
    setTimeout(()=>{
      const n=document.getElementById('note'); n.value='원래 노트'; n.dispatchEvent(new Event('input'));
      setTimeout(()=>{
        const list=deckAnchors();
        const md=serializeNotes({deckName:'sample-deck.html',total:5,today:'2026-08-18',
          notes:[{anchor:list[0],index:0,title:'표지',text:'파일에서 온 노트'}],orphans:[]});
        const realConfirm=window.confirm; window.confirm=()=>true;   // 교체 선택
        importNotes(md);
        window.confirm=realConfirm;
        setTimeout(()=>res({note:document.getElementById('note').value,
          orphans:rec.orphans.map(o=>o.text), flash:document.getElementById('flash').textContent}),400);
      },500);
    },1600); }); })
```

Expected: `note`가 `"파일에서 온 노트"`, `orphans`에 `"원래 노트"`가 살아있고, flash에 "1개 연결 · 1개는 미배정 노트함".

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: 노트 가져오기 — 확장자 분기·무손실 충돌 처리·되돌리기"
```

---

## Task 15: 조용한 실패 2건 없애기

**Files:**
- Modify: `index.html` — `nav()`(현재 약 400행), `loadDeck()`

- [ ] **Step 1: 키보드에 반응하지 않는 덱 안내**

`nav()` 안 `if (!moved) { endFlash(dir); settle(); return; }` 를 다음으로 교체:

```js
  if (!moved) { warnDeadDeck(dir); endFlash(dir); settle(); return; }
```

노트 섹션 밖(내비게이션 섹션 끝)에 추가:

```js
let deadWarned = false;
// 첫 [다음]이 먹지 않으면 안내한다. 구조 감지 여부는 조건에 넣지 않는다 —
// 클릭 전용 덱은 .slide 구조는 있으면서 키보드만 안 먹는 경우가 가장 흔하다.
function warnDeadDeck(dir){
  if (deadWarned || dir < 0 || step !== 0) return;
  const s = deckState(mirror.contentWindow);
  if (s && s.n <= 1) return;               // 한 장짜리는 넘길 곳이 없다
  deadWarned = true;
  showNotice('이 자료는 키보드 넘김에 반응하지 않는 것 같습니다. 자료를 만든 AI에게 "← → 방향키로 슬라이드가 넘어가게 해줘"라고 요청해 보세요.');
}
```

`loadDeck()`에 `deadWarned = false;`를 `step = 0;` 옆에 추가한다.

- [ ] **Step 2: 분리형 리소스 안내**

`loadDeck()`의 `reqWakeLock();` 앞에 추가:

```js
  if (/(?:<img[^>]+src|url\()\s*=?\s*["']?(?!https?:|data:|\/\/|#)[\w.][^"')>]*/i.test(deckHTML))
    flash('이미지가 별도 파일로 분리된 자료입니다 — 단일 HTML로 합쳐야 이미지가 표시됩니다.');
```

- [ ] **Step 3: 브라우저 검증**

```js
new Promise(res=>{
  localStorage.clear();
  // .slide 구조는 있지만 키보드를 안 받는 덱 (클릭 전용) + 상대경로 이미지
  const dead = '<!doctype html><html><body>'
    + '<div class="slide active">A <img src="pic.png"></div><div class="slide">B</div>'
    + '</body></html>';
  window.__ptLoad(dead,'dead.html');
  setTimeout(()=>{
    const imgFlash=document.getElementById('flash').textContent;
    document.querySelector('#nextBtn').click();
    setTimeout(()=>res({imgFlash, notice:document.getElementById('noticeMsg').textContent,
      noticeShown:!document.getElementById('notice').hidden}),500);
  },1600); })
```

Expected: `imgFlash`에 "이미지가 별도 파일로 분리된", `notice`에 "키보드 넘김에 반응하지 않는", `noticeShown:true`

- [ ] **Step 4: 커밋**

```bash
git add index.html
git commit -m "feat: 무반응 덱·분리형 이미지 안내로 조용한 실패 제거"
```

---

## Task 16: 목표 타이머 — 순수 로직

**Files:**
- Modify: `index.html` (PURE CORE 구역), 기존 `fmt()`(현재 582행)
- Create: `test/timer.test.mjs`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/timer.test.mjs`:

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/`
Expected: FAIL — `PURE.fmtClock is not a function`

- [ ] **Step 3: 최소 구현**

PURE CORE에 추가:

```js
function fmtClock(totalSec){
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor(s / 60) % 60).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${m}:${ss}` : `${m}:${ss}`;
}
function validateGoal(raw){
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return { ok: 'clear' };
  if (!/^\d{1,3}$/.test(s)) return { ok: false };
  const min = Number(s);
  if (min < 1 || min > 600) return { ok: false };
  return { ok: true, min };
}
// 초과는 음수(−02:20)로 쓰지 않는다 — 이중 부정이라 순간적으로 안 읽힌다.
function goalDisplay(goalMin, accMs){
  const left = goalMin * 60 - Math.floor(accMs / 1000);
  if (left < 0) return { label: '초과', text: fmtClock(-left), state: 'over' };
  return { label: '남은', text: fmtClock(left), state: left <= 300 ? 'warn' : 'ok' };
}
```

`PURE` 객체에 `fmtClock, validateGoal, goalDisplay` 추가.

기존 `fmt()`를 PURE CORE 밖에서 재사용하도록 바꾼다:

```js
function fmt(ms){ return fmtClock(Math.floor(ms / 1000)); }
```

- [ ] **Step 4: 통과 확인**

Run: `node --test test/`
Expected: PASS 20

- [ ] **Step 5: 커밋**

```bash
git add index.html test/timer.test.mjs
git commit -m "feat: 목표 시간 검증·표시 순수 로직"
```

---

## Task 17: 목표 타이머 — 화면 배선

**Files:**
- Modify: `index.html` — 랙 마크업(현재 209~211행), CSS, 타이머 섹션(588~602행)

- [ ] **Step 1: 마크업 — 남은/초과 계측 추가**

경과 계측 `<span class="meter">` 다음에 추가:

```html
  <span class="meter" id="goalMeter" hidden>
    <span class="meter-k" id="goalLabel">남은</span><span id="goalVal">00:00</span>
  </span>
```

경과 시간 숫자를 클릭 가능하게 바꾼다(같은 줄의 `#timer`):

```html
    <span class="meter-k">경과</span><span id="timer" role="button" tabindex="0"
      title="클릭해 발표 배정 시간(분)을 설정" aria-label="경과 시간 · 클릭해 목표 시간 설정">00:00</span>
```

- [ ] **Step 2: CSS 추가 (`#timer` 규칙 뒤)**

```css
#timer{cursor:pointer}
#timer:focus-visible{outline:2px solid var(--next);outline-offset:2px;border-radius:4px}
#goalVal{font-family:var(--data);font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;min-width:5.2ch;text-align:right}
#goalMeter.warn #goalVal,#goalMeter.warn .meter-k{color:var(--next)}
#goalMeter.over #goalVal,#goalMeter.over .meter-k{color:var(--live)}
#goalInput{width:5ch;font:700 20px var(--data);background:#0f1216;color:var(--ink);border:1px solid var(--next);border-radius:5px;padding:2px 5px;text-align:right}
@media (prefers-reduced-motion: no-preference){
  #goalMeter.pulse #goalVal{animation:goalHit .5s ease-out 2}
  @keyframes goalHit{50%{transform:scale(1.18)}}
}
```

- [ ] **Step 3: 타이머 섹션 배선**

`startTimer()`의 `setInterval` 콜백을 목표 표시까지 갱신하도록 바꾼다:

```js
  runT = setInterval(() => { acc = Date.now() - t0; $('#timer').textContent = fmt(acc); renderGoal(); }, 250);
```

타이머 섹션 끝(`$('#resetBtn').onclick` 뒤)에 추가:

```js
let goalHit = false;
function renderGoal(){
  const box = $('#goalMeter');
  if (!rec.goalMin) { box.hidden = true; return; }
  const d = goalDisplay(rec.goalMin, acc);
  box.hidden = false;
  $('#goalLabel').textContent = d.label;
  $('#goalVal').textContent = d.text;
  box.classList.toggle('warn', d.state === 'warn');
  box.classList.toggle('over', d.state === 'over');
  // 알림은 도달 순간 1회만 — 계속 깜빡이면 그게 더 방해다. 소리는 쓰지 않는다
  // (노트북 오디오가 강의장 스피커에 연결된 경우 청중에게 들린다).
  if (d.state === 'over' && !goalHit) {
    goalHit = true;
    flash('목표 시간에 도달했습니다.');
    box.classList.add('pulse');
    setTimeout(() => box.classList.remove('pulse'), 1200);
  }
}
function editGoal(){
  if ($('#goalInput')) return;
  const holder = $('#timer').parentNode;
  const input = document.createElement('input');
  input.id = 'goalInput';
  input.type = 'text';
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', '발표 배정 시간(분). 비우면 해제');
  input.value = rec.goalMin || '';
  input.placeholder = '분';
  holder.append(input);
  input.focus(); input.select();
  const done = commit => {
    if (commit) {
      const v = validateGoal(input.value);
      if (v.ok === true) { rec.goalMin = v.min; goalHit = false; saveRec(); flash(`목표 ${v.min}분으로 설정했습니다.`); }
      else if (v.ok === 'clear') { delete rec.goalMin; goalHit = false; saveRec(); flash('목표 시간을 해제했습니다.'); }
      else flash('1~600 사이의 분 단위 숫자를 입력해 주세요.');
    }
    input.remove(); renderGoal();
  };
  input.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); done(true); }
    else if (e.key === 'Escape') { e.preventDefault(); done(false); }
  };
  input.onblur = () => done(false);
}
$('#timer').onclick = editGoal;
$('#timer').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editGoal(); } };
```

`$('#resetBtn').onclick`에 목표는 유지하되 도달 플래그만 되돌리도록 `goalHit = false;`를 추가하고 `renderGoal()`을 호출한다:

```js
$('#resetBtn').onclick = function(){ this.blur(); pauseTimer(); acc = 0; started = false; goalHit = false; $('#timer').textContent = '00:00'; renderGoal(); flash('타이머를 리셋했습니다.'); };
```

`loadNotes()` 끝에 `renderGoal();`을 추가한다(덱을 바꿀 때 저장된 목표가 반영되도록).

- [ ] **Step 4: 브라우저 검증**

```js
new Promise(res=>{
  localStorage.clear();
  fetch('sample-deck.html').then(r=>r.text()).then(t=>{
    window.__ptLoad(t,'sample-deck.html');
    setTimeout(()=>{
      document.getElementById('timer').click();
      const inp=document.getElementById('goalInput'); inp.value='45';
      inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      const set={hidden:document.getElementById('goalMeter').hidden, val:document.getElementById('goalVal').textContent};
      acc=41*60*1000; renderGoal();
      const warn={label:document.getElementById('goalLabel').textContent, val:document.getElementById('goalVal').textContent, cls:document.getElementById('goalMeter').className};
      acc=47*60*1000+20000; renderGoal();
      const over={label:document.getElementById('goalLabel').textContent, val:document.getElementById('goalVal').textContent, flash:document.getElementById('flash').textContent};
      document.getElementById('timer').click();
      const inp2=document.getElementById('goalInput'); inp2.value='';
      inp2.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      res({set, warn, over, cleared:document.getElementById('goalMeter').hidden, goalMin:rec.goalMin});
    },1600); }); })
```

Expected: `set:{hidden:false,val:"45:00"}`, `warn.label:"남은"`·`warn.val:"04:00"`·클래스에 `warn`, `over:{label:"초과",val:"02:20",flash:"목표 시간에 도달했습니다."}`, `cleared:true`, `goalMin:undefined`

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: 타이머 목표 시간 — 남은/초과 표시·1회 알림·해제"
```

---

## Task 18: 전체 회귀와 문서 마무리

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-18-slide-anchored-notes.md` (체크박스 정리)

- [ ] **Step 1: 순수 로직 테스트 전체 통과 확인**

Run: `node --test test/`
Expected: PASS 20, FAIL 0

- [ ] **Step 2: 기존 기능 회귀 확인 (브라우저 패널)**

```js
new Promise(res=>{
  localStorage.clear();
  fetch('sample-deck.html').then(r=>r.text()).then(t=>{
    window.__ptLoad(t,'sample-deck.html');
    setTimeout(()=>{
      let n=0; const i=setInterval(()=>{ document.querySelector('#nextBtn').click();
        if(++n>=10){ clearInterval(i); setTimeout(()=>{
          const end={chip:document.getElementById('posChip').textContent, flash:document.getElementById('flash').textContent};
          document.getElementById('resync').click();
          setTimeout(()=>{ document.querySelector('#prevBtn').click();
            setTimeout(()=>res({end, back:{chip:document.getElementById('posChip').textContent,
              mirror:deckState(mirror.contentWindow).i, preview:deckState(preview.contentWindow).i}}),600); },1700);
        },500);} },140);
    },1600); }); })
```

Expected: `end.chip:"5 / 5"`·flash에 "마지막 슬라이드", `back:{chip:"4 / 5", mirror:3, preview:4}`

- [ ] **Step 3: 청중 창 회귀 — 실제 Chrome에서 독립 창 확인**

`claude-in-chrome`으로 `http://localhost:8123/index.html`을 열고 `sample-deck.html`을 로드한 뒤 **실제 클릭**으로 [청중 화면 열기]를 눌러 다음을 확인한다:

```js
(()=>({ open: !!(audience && !audience.closed), size: audience && audience.outerWidth+'x'+audience.outerHeight }))()
```

Expected: `open:true`, 별도 창 크기 반환(탭이 아니라 창). 확인 후 `audience.close()`.

- [ ] **Step 4: README에 기능·테스트 반영**

기능 표의 발표자 화면 열에 두 줄을 추가한다:

```markdown
| **페이지별 메모** — 내용 기준으로 붙어서 자료를 고쳐도 안 밀림 | 4초 뒤 마우스 커서 자동 숨김 |
| 메모 내보내기·가져오기(.md) · 글씨 크기 조절 | 화면 꺼짐 방지 (Wake Lock) |
| 현재 시각 · 경과 · 남은 시간(목표 설정 시) | 발표자 화면과 실시간 동기화 |
```

기능 목록 아래에 한 줄을 추가한다:

```markdown
- **메모 보관** — 큐 시트의 [내보내기]로 마크다운 파일 저장. 그 파일을 다시 끌어다 놓으면
  자료를 고쳤어도 각 노트가 제자리를 찾아갑니다(못 찾은 노트는 미배정 노트함에 남습니다)
```

라이선스 섹션 앞에 개발자용 섹션을 추가한다:

```markdown
## 개발

순수 로직(지문 계산·노트 파일 왕복·타이머 계산)은 `index.html` 안 `PURE CORE` 구역에 있고,
빌드 없이 Node 내장 러너로 테스트합니다.

```bash
node --test test/
```
```

- [ ] **Step 5: 커밋과 배포**

```bash
git add README.md docs/
git commit -m "docs: 앵커 노트·내보내기·목표 타이머 반영과 테스트 실행법"
git push origin main
```

GitHub Pages 반영 확인:

```bash
sleep 45 && curl -s -o /dev/null -w "%{http_code}\n" https://ipf-jiwookim.github.io/html-presenter/
```

Expected: `200`

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 | 태스크 |
|---|---|
| §1-1 지문(공통토큰·숫자·empty·중복·지연계산) | 2, 3, 4, 7(deckAnchors) |
| §1-2 저장 구조·디바운스·용량 경고 | 7 |
| §1-3 마이그레이션 | 5(순수), 7(배선) |
| §1-4 이전 노트 복구 | 9 |
| §1-5 앵커 불가 폴백 | 7(noteGet/noteSet byIndex), 14(가져오기 시 미배정 처리) |
| §2-1 내보내기 형식·파일명·비활성화 | 10, 12 |
| §2-2 가져오기·배정·겹침 경고·충돌 무손실·되돌리기 | 11, 14 |
| §2-3 미배정 노트함 | 13 |
| §3-1 무반응 덱 / §3-2 분리형 리소스 | 15 |
| §4-1 글씨 크기 | 12 |
| §4-2 목표 타이머 전체 | 16, 17 |
| 스펙 테스트 계획 1~14 | 4, 8(삽입), 3(짧은 덱·푸터), 4(중복·안정성), 7(마이그레이션), 9(파일명 복구), 14(왕복·충돌), 11(## 본문), 15(안내), 12·17(글씨·타이머), 18(회귀) |

**2. 플레이스홀더 스캔:** 모든 코드 단계에 실제 코드가 있고 TBD/TODO/"적절히 처리" 표현은 없다.

**3. 타입·이름 일관성 확인**
- `deckState()` → `{i, n, els}` (Task 6에서 확장, Task 7·10·12·15에서 `.els` 사용)
- 레코드 필드: `anchors` / `byIndex` / `orphans` / `fontSize` / `goalMin` — Task 7 정의, 이후 동일하게 사용
- 미배정 항목 모양: `{text, hint}` — Task 10(직렬화), 11(파싱), 13(렌더), 14(생성) 모두 동일
- 함수명: `loadRec`/`saveRec`/`saveRecNow`/`recKey`/`noteGet`/`noteSet`/`deckAnchors`/`anchorFor`/`applyFontSize`/`renderOrphans`/`refreshExportBtn`/`renderGoal` — Task 7에서 스텁 포함 선언, 이후 교체·호출 지점 명시
- `showNotice(msg, withAudienceBtn)` — Task 7에서 시그니처 변경, Task 9·15는 인자 없이 호출(버튼 숨김)
- PURE 공개 목록 최종: `fnv1a, normTokens, slideAnchors, anchorOverlap, migrateIndexed, sanitizeName, noteFileName, serializeNotes, parseNotes, fmtClock, validateGoal, goalDisplay`
