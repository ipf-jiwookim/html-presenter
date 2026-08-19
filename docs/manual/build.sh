#!/usr/bin/env bash
# 사용 설명서 PDF 를 다시 만든다.
#
#   ./build.sh
#
# 스크린샷은 실제 index.html 을 띄워 찍는다. 가짜 UI 를 그리지 않기 위해서고,
# 본체가 바뀌면 스크린샷도 자동으로 따라오게 하기 위해서다.
# 화면 상태(자료 로드·장 이동·대본 입력·청중 연결)는 아래 하네스가 만든다.
set -euo pipefail
cd "$(dirname "$0")"

ROOT=../..
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8199
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"; [ -n "${SRV:-}" ] && kill "$SRV" 2>/dev/null || true' EXIT

[ -x "$CHROME" ] || { echo "크롬이 필요합니다: $CHROME"; exit 1; }

cp "$ROOT/index.html" deck.html manual.html "$TMP/"
cp -R shots "$TMP/shots"

# 본체에 화면 상태를 만드는 스크립트를 덧붙여 하네스를 만든다(사본을 커밋하지 않는다)
mk(){ python3 -c "
import sys
src = open('$TMP/index.html', encoding='utf-8').read()
assert src.count('</body>') == 1
open('$TMP/$1', 'w', encoding='utf-8').write(
    src.replace('</body>', '<script>\n' + sys.stdin.read() + '\n</script>\n</body>'))
"; }

mk shot-start.html <<'JS'
(async () => {
  const t = await (await fetch('deck.html')).text();
  staged.deck = { text: t, name: '예시_발표자료.html' };
  renderDeckThumb(); renderSetup();
  document.querySelector('#resumeBtn').hidden = true;
})();
JS

mk shot-console.html <<'JS'
(async () => {
  const t = await (await fetch('deck.html')).text();
  __ptLoad(t, '예시_발표자료.html');
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-9999px;width:1280px;height:720px';
  document.body.appendChild(f);
  setTimeout(() => {
    jumpTo(3);
    audience = f.contentWindow; writeDoc(audience);      // 청중 연결됨 상태를 만든다
    const n = document.querySelector('#note');
    n.value = '여기서 잠깐 멈추고 질문 받기.\n\n네 칸을 하나씩 읽지 말 것. 파란 칸만 짚고\n나머지는 "비슷한 방식"이라고만 넘어간다.\n\n시간이 남으면 두 번째 칸 예시 이야기.';
    n.oninput();
    pauseTimer(); acc = 12 * 60000 + 15000; startTimer();  // 발표 중처럼 보이게
  }, 1400);
})();
JS

cat > "$TMP/shot-audience.html" <<'HTML'
<!doctype html><meta charset="utf-8"><title>청중 화면</title>
<style>html,body{margin:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%}</style>
<iframe id="d" src="deck.html"></iframe>
<script>
document.querySelector('#d').onload = () => {
  const d = document.querySelector('#d').contentDocument;
  const st = d.createElement('style');
  st.textContent = '#ptFsBtn{position:fixed;right:18px;bottom:18px;z-index:2147483647;' +
    'font:600 16px/1 -apple-system,"Apple SD Gothic Neo",sans-serif;letter-spacing:.02em;' +
    'padding:16px 22px;border-radius:10px;border:2px solid rgba(255,255,255,.5);' +
    'background:rgba(10,12,15,.72);color:#fff;opacity:.92}';
  d.head.appendChild(st);
  const b = d.createElement('button');
  b.id = 'ptFsBtn'; b.textContent = '⛶  전체화면 (F)';
  d.body.appendChild(b);
};
</script>
HTML

(cd "$TMP" && python3 -m http.server $PORT >/dev/null 2>&1) & SRV=$!
sleep 1

for s in start console audience; do
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=1440,810 --virtual-time-budget=9000 \
    --screenshot="$TMP/shots/$s.png" "http://localhost:$PORT/shot-$s.html" >/dev/null 2>&1
done

python3 - "$TMP" <<'PY'
import sys, os
from PIL import Image
t = os.path.join(sys.argv[1], 'shots')
for f in ('start', 'console', 'audience'):
    p = os.path.join(t, f + '.png')
    im = Image.open(p); im.thumbnail((2000, 2000), Image.LANCZOS); im.save(p)
im = Image.open(os.path.join(t, 'console.png')); w, h = im.size
im.crop((int(w*.712), int(h*.452), w, int(h*.893))).save(os.path.join(t, 'notes.png'))
s = Image.open(os.path.join(t, 'start.png')); w, h = s.size
s.convert('RGB').crop((0, int(h*.13), w, int(h*.87))).save(os.path.join(t, 'start.jpg'), quality=90)
os.remove(os.path.join(t, 'start.png'))
PY

# QR (segno 가 있을 때만 다시 만든다. 없으면 커밋된 것을 그대로 쓴다)
python3 -c "
import segno
segno.make('https://ipf-jiwookim.github.io/html-presenter/', error='m').save(
    '$TMP/shots/qr.svg', scale=10, border=0, dark='#16181c', light=None)
" 2>/dev/null || echo "segno 없음. 커밋된 qr.svg 를 그대로 씁니다 (pip install segno)"

cp "$TMP"/shots/* shots/
"$CHROME" --headless --disable-gpu --no-pdf-header-footer --virtual-time-budget=6000 \
  --print-to-pdf="$PWD/발표자콘솔_사용설명서.pdf" "http://localhost:$PORT/manual.html" >/dev/null 2>&1

python3 -c "
d = open('발표자콘솔_사용설명서.pdf','rb').read()
n = d.count(b'/Type /Page') - d.count(b'/Type /Pages')
print(f'완료: 발표자콘솔_사용설명서.pdf · {n}쪽 · {len(d)/1024/1024:.2f}MB')
assert n == 6, f'쪽 수가 {n} 입니다. 레이아웃이 넘쳤는지 확인하세요.'
"
