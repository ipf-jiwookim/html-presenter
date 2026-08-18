// index.html 의 PURE CORE 구역만 잘라 실행한다 — 단일 파일 구조를 깨지 않고
// 순수 로직을 node --test 로 검증하기 위한 하네스.
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const m = html.match(/\/\* ==== PURE CORE START ==== \*\/([\s\S]*?)\/\* ==== PURE CORE END ==== \*\//);
if (!m) throw new Error('index.html 에서 PURE CORE 구역 주석을 찾지 못했습니다');

const PURE = new Function(`${m[1]}\nreturn PURE;`)();
export default PURE;
