// PROTOTYPE - NOT FOR PRODUCTION
// Question: 감독관 눈치를 보며 AI 안경으로 스캔하는 긴장감이, 장비와 시험이 함께 커지는 성장과 맞물려 엔딩까지 재밌나?
// Date: 2026-11-17
// 2D 층: 도트 도구(사각형만 씀), 안경테, 장비 아이콘·대리 응시 봇(패널용), 결과·타이틀·엔딩 화면.
// 세상은 world3d.js(3D), 시험 중 안경 HUD는 exam-art.js. 이 층은 640x360 버퍼에 그리고 3D 위에 겹친다.
'use strict';

const FONT_KO = '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","Noto Sans CJK KR","NanumGothic",sans-serif';
const PAL = {
  ol: '#1c1726', white: '#ffffff', dark: '#0d0b13',
  skin: '#f3caa1', skin2: '#d9a57c',
  paper: '#fbf9f1', paper2: '#e2dcc8', ink: '#2a2838', ink2: '#6c6a80',
  desk: '#c98e59', desk2: '#b07645', desk3: '#93603a', deskHi: '#e2ab76',
  uni: '#4c6194', uni2: '#3b4c77', chair: '#7a5a3c', chair2: '#5e4430',
  warn: '#f6a234', bad: '#ea4540', good: '#62d84a', gold: '#f5cc4a',
  rim: '#2a2434', rim2: '#5a5168',
  hud: '#45e5ee', hud2: '#2a8f9a', hud3: '#0f3238',
};

// ---- 화면 배치: 가로 한 가지 (모바일도 가로로 돌려서). 안경테 모양만 여기, 시험 화면 배치는 exam-art.js ----
const LAYOUTS = {
  land: {
    W: 640, H: 360,
    lenses: [{ cx: 165, cy: 184, aL: 163, aR: 225, b: 181 }, { cx: 475, cy: 184, aL: 225, aR: 163, b: 181 }], bridge: [284, 72],
  },
};

// ---- 도트 도구 ----
const TEXT_CACHE = new Map();
let HUD_SCALE = 1; // HUD 층을 화면 실제 픽셀 수로 그리는 배율 (game.js fit()이 정한다)
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(h1, h2, k) { const a = hexRgb(h1), z = hexRgb(h2); return '#' + a.map((v, i) => Math.round(v + (z[i] - v) * k).toString(16).padStart(2, '0')).join(''); }

function makeKit(b) {
  const K = { b };
  K.R = (x, y, w, h, c) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  K.disc = (cx, cy, r, c) => {
    b.fillStyle = c; cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.6)); b.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
  };
  K.ring = (cx, cy, r, c) => {
    b.fillStyle = c; cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    let x = r, y = 0, e = 1 - r;
    while (x >= y) {
      for (const [p, q] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) b.fillRect(cx + p, cy + q, 1, 1);
      y++; if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; }
    }
  };
  K.poly = (pts, c) => {
    b.fillStyle = c;
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    y0 = Math.ceil(y0); y1 = Math.floor(y1);
    for (let y = y0; y <= y1; y++) {
      let xl = Infinity, xr = -Infinity; const yc = y + 0.5;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((yc >= ay && yc < by) || (yc >= by && yc < ay)) { const x = ax + (yc - ay) * (bx - ax) / (by - ay); xl = Math.min(xl, x); xr = Math.max(xr, x); }
      }
      if (xl <= xr) b.fillRect(Math.round(xl), y, Math.max(1, Math.round(xr) - Math.round(xl)), 1);
    }
  };
  K.line = (x0, y0, x1, y1, c, t = 1) => {
    b.fillStyle = c; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy; const o = t >> 1;
    for (let n = 0; n < 3000; n++) {
      b.fillRect(x0 - o, y0 - o, t, t);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  K.polyEdge = (pts, c) => { for (let i = 0; i < pts.length; i++) { const a = pts[i], z = pts[(i + 1) % pts.length]; K.line(a[0], a[1], z[0], z[1], c, 1); } };
  K.frame = (x, y, w, h, c, t = 1) => { K.R(x, y, w, t, c); K.R(x, y + h - t, w, t, c); K.R(x, y, t, h, c); K.R(x + w - t, y, t, h, c); };
  K.dither = (hex, alpha) => {
    const p = document.createElement('canvas'); p.width = 2; p.height = 2;
    const g = p.getContext('2d'); g.globalAlpha = alpha; g.fillStyle = hex; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
    return b.createPattern(p, 'repeat');
  };
  // 글자: 시스템 한글 글꼴을 버퍼 크기로 찍고 반투명 경계를 잘라 도트 글자로
  K.T = (str, x, y, size, col, align = 'left', weight = 700) => {
    str = String(str);
    const S = K.S || HUD_SCALE, key = str + '|' + size + '|' + col + '|' + weight + '|' + S;
    let c = TEXT_CACHE.get(key);
    if (!c) { // 화면 실제 해상도로 찍어서 글자가 깨지지 않게 (S = 화면 배율)
      const m = document.createElement('canvas'), g = m.getContext('2d');
      const f = `${weight} ${size * S}px ${FONT_KO}`; g.font = f;
      const w = Math.max(1, Math.ceil(g.measureText(str).width) + 4 * S), h = Math.ceil(size * 1.5 * S);
      m.width = w; m.height = h;
      g.font = f; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(str, 2 * S, h / 2);
      c = m; if (TEXT_CACHE.size > 900) TEXT_CACHE.clear(); TEXT_CACHE.set(key, c);
    }
    const w = c.width / S, h = c.height / S, r = v => Math.round(v * S) / S;
    const dx = align === 'center' ? x - w / 2 : align === 'right' ? x - w + 2 : x - 2;
    b.drawImage(c, r(dx), r(y - h / 2), w, h);
    return w - 4;
  };
  K.TW = (str, size, weight = 700) => { // 글자 폭만 잼
    const g = K._m || (K._m = document.createElement('canvas').getContext('2d'));
    g.font = `${weight} ${size}px ${FONT_KO}`; return Math.ceil(g.measureText(String(str)).width);
  };
  K.TO = (str, x, y, size, col, align = 'center', oc = PAL.ol) => {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1], [0, 2], [1, 2], [-1, 2]]) K.T(str, x + ox, y + oy, size, oc, align, 800);
    return K.T(str, x, y, size, col, align, 800);
  };
  K.glyphAt = (seed, x, y, s, col) => {
    for (const [x0, y0, x1, y1] of glyph(seed)) {
      if (x0 === x1 && y0 === y1) K.R(x + x0 * s - 1, y + y0 * s - 1, 2, 2, col);
      else K.line(x + x0 * s, y + y0 * s, x + x1 * s, y + y1 * s, col, 2);
    }
  };
  K.alienRow = (seed, n, x, y, s, col) => { alienWord(seed, n).forEach((g, i) => K.glyphAt(g, x + i * (s + 5), y, s, col)); };
  K.shape = (id, cx, cy, s, col) => { // 외계 신호 모양 6종
    const r = Math.round(s / 2);
    if (id === 0) { K.ring(cx, cy, r, col); K.ring(cx, cy, r - 1, col); }
    else if (id === 1) K.poly([[cx, cy - r], [cx + r, cy + r], [cx - r, cy + r]], col);
    else if (id === 2) { K.frame(cx - r, cy - r, r * 2, r * 2, col, 2); }
    else if (id === 3) K.poly([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]], col);
    else if (id === 4) { K.R(cx - r, cy - 1, r * 2, 3, col); K.R(cx - 1, cy - r, 3, r * 2, col); }
    else { for (let i = -1; i <= 1; i++) K.R(cx - r, cy + i * Math.round(r * 0.7) - 1, r * 2, 2, col); }
  };
  K.button = (x, y, w, h, label, hot, col = PAL.hud) => {
    K.R(x, y + 2, w, h, PAL.dark); K.R(x, y, w, h, hot ? col : '#26212f'); K.frame(x, y, w, h, hot ? PAL.white : col, 1);
    K.T(label, x + w / 2, y + h / 2, 12, hot ? PAL.dark : PAL.white, 'center', 800);
    return { x, y, w, h };
  };
  return K;
}

// ---- 안경테 (배치마다 한 번 계산) ----
function lensF(lenses, x, y) {
  let f = Infinity;
  for (const L of lenses) {
    const ax = x < L.cx ? L.aL : L.aR, dx = (x - L.cx) / ax, dy = (y - L.cy) / L.b;
    f = Math.min(f, dx * dx * dx * dx + dy * dy * dy * dy);
  }
  return f;
}
const RIM_CACHE = {};
function rimFor(key) {
  if (RIM_CACHE[key]) return RIM_CACHE[key];
  const L = LAYOUTS[key], c = document.createElement('canvas'); c.width = L.W; c.height = L.H;
  const g = c.getContext('2d'), id = g.createImageData(L.W, L.H), d = id.data;
  const c1 = hexRgb(PAL.rim2), c2 = hexRgb(PAL.rim), c3 = hexRgb(PAL.dark);
  for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
    const f = lensF(L.lenses, x + 0.5, y + 0.5);
    if (f < 1) continue;
    const cc = f < 1.03 ? c1 : f < 1.13 ? c2 : c3, i = (y * L.W + x) * 4;
    d[i] = cc[0]; d[i + 1] = cc[1]; d[i + 2] = cc[2]; d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  const [bx, bw] = L.bridge;
  g.fillStyle = PAL.rim; g.fillRect(bx, 0, bw, 12); g.fillRect(bx + 8, 12, bw - 16, 4);
  g.fillStyle = PAL.rim2; g.fillRect(bx + 8, 15, bw - 16, 1); g.fillRect(bx + 2, 2, bw - 4, 1);
  return (RIM_CACHE[key] = c);
}

// ---- 대리 응시 봇 ----
function drawBot(k, x, y, t, i) {
  const { R } = k, C = PAL, bob = (Math.floor(t * 3 + i) % 2);
  R(x - 9, y + 6, 18, 9, C.ol); R(x - 8, y + 7, 16, 7, '#8a5a32'); R(x - 6, y + 5, 9, 3, C.paper);
  R(x - 7, y - 8 + bob, 14, 13, C.ol); R(x - 6, y - 7 + bob, 12, 11, '#9aa3b8'); R(x - 5, y - 6 + bob, 10, 6, '#13202e');
  R(x - 4, y - 4 + bob, 2, 2, '#7ff6ff'); R(x + 2, y - 4 + bob, 2, 2, '#7ff6ff'); R(x - 1, y - 11 + bob, 2, 4, C.ol); R(x - 2, y - 13 + bob, 4, 2, PAL.bad);
  const arm = Math.floor(t * 8 + i) % 2;
  R(x + 5, y + 2 + arm, 4, 2, '#6c7590'); R(x + 3 - arm, y + 4, 2, 3, '#f2c13a');
}

// ---- 장비 그림 (상점 아이콘·허브 진열·HUD 공용) ----
function drawGear(k, id, cx, cy, s, lv) {
  const { R, disc, ring, line, poly } = k, C = PAL, u = s / 24;
  const X = v => Math.round(cx + v * u), Y = v => Math.round(cy + v * u), S = v => Math.max(1, Math.round(v * u));
  if (id === 'lens' || id === 'stealth') {
    const tint = id === 'stealth' ? '#6b4fa0' : ['#bfe8ff', '#9fe0ff', '#7fd6ff', '#5fe0e8', '#45e5ee'][Math.min(4, Math.floor(lv / 2))];
    for (const sx of [-6, 6]) { disc(X(sx), Y(0), S(6), C.ol); disc(X(sx), Y(0), S(5), tint); R(X(sx - 3), Y(-3), S(2), S(1), C.white); }
    R(X(-1), Y(-1), S(2), S(1), C.ol); R(X(-12), Y(-2), S(2), S(1), C.ol); R(X(11), Y(-2), S(2), S(1), C.ol);
    if (id === 'stealth') { R(X(-9), Y(-9), S(1), S(3), C.white); R(X(-10), Y(-8), S(3), S(1), C.white); }
  } else if (id === 'model') {
    R(X(-8), Y(-8), S(16), S(16), C.ol); R(X(-7), Y(-7), S(14), S(14), '#203040');
    for (let i = -6; i <= 6; i += 4) { R(X(i), Y(-10), S(1), S(2), C.gold); R(X(i), Y(9), S(1), S(2), C.gold); R(X(-10), Y(i), S(2), S(1), C.gold); R(X(9), Y(i), S(2), S(1), C.gold); }
    k.T('AI', X(0), Y(0), Math.max(8, S(8)), '#7ff6ff', 'center', 800);
  } else if (id === 'predict') {
    poly([[X(-10), Y(0)], [X(0), Y(-6)], [X(10), Y(0)], [X(0), Y(6)]], C.ol); poly([[X(-8), Y(0)], [X(0), Y(-5)], [X(8), Y(0)], [X(0), Y(5)]], '#fdfdf2');
    disc(X(0), Y(0), S(3), '#2a8f9a'); R(X(-1), Y(-1), S(1), S(1), C.white);
    line(X(4), Y(-10), X(10), Y(-10), C.warn, S(1)); line(X(10), Y(-10), X(10), Y(-5), C.warn, S(1));
  } else if (id === 'watch') {
    R(X(-4), Y(-11), S(8), S(22), C.ol); R(X(-3), Y(-11), S(6), S(22), '#3a3248');
    R(X(-7), Y(-6), S(14), S(12), C.ol); R(X(-6), Y(-5), S(12), S(10), '#0c2228'); k.T('AI', X(0), Y(0), Math.max(7, S(7)), '#7ff6ff', 'center', 800);
  } else if (id === 'earbud') {
    disc(X(-2), Y(-3), S(7), C.ol); disc(X(-2), Y(-3), S(6), '#f4f4f6'); R(X(-1), Y(2), S(4), S(9), C.ol); R(X(0), Y(2), S(2), S(8), '#e2e2ea');
    disc(X(-3), Y(-4), S(2), '#45e5ee');
    for (let i = 0; i < 3; i++) ring(X(4), Y(-4), S(8 + i * 3), i === 1 ? '#45e5ee' : '#2a8f9a');
    R(X(4), Y(-14), S(10), S(22), 'rgba(0,0,0,0)');
  } else if (id === 'bot') {
    drawBot(k, X(0), Y(-2), 0, 0);
  } else if (id === 'autoscan') {
    R(X(-10), Y(-8), S(20), S(16), C.ol); R(X(-9), Y(-7), S(18), S(14), '#1f6b3a');
    line(X(-7), Y(-4), X(-2), Y(-4), C.gold, S(1)); line(X(-2), Y(-4), X(-2), Y(3), C.gold, S(1)); line(X(2), Y(-5), X(7), Y(4), C.gold, S(1));
    R(X(1), Y(-2), S(6), S(5), '#111'); R(X(-9), Y(1), S(18), S(1), '#7ff6ff');
  } else if (id === 'wide') { // 광각 렌즈: 넓적한 렌즈 두 개
    for (const sx of [-6, 6]) { R(X(sx - 6), Y(-4), S(12), S(9), C.ol); R(X(sx - 5), Y(-3), S(10), S(7), '#7fd6ff'); R(X(sx - 4), Y(-2), S(3), S(1), C.white); }
    R(X(-1), Y(-1), S(2), S(1), C.ol); line(X(-11), Y(7), X(11), Y(7), '#45e5ee', S(1));
  } else if (id === 'coach') { // AI 면접 코치: 태블릿과 말풍선
    R(X(-9), Y(-6), S(14), S(16), C.ol); R(X(-8), Y(-5), S(12), S(14), '#2f7a5a'); R(X(-6), Y(-2), S(8), S(1), '#c9f6e0'); R(X(-6), Y(1), S(6), S(1), '#c9f6e0');
    R(X(2), Y(-11), S(10), S(7), C.ol); R(X(3), Y(-10), S(8), S(5), C.white); R(X(4), Y(-4), S(2), S(2), C.white);
  } else if (id === 'cctvjam' || id === 'jammer') {
    if (id === 'cctvjam') { R(X(-9), Y(-5), S(16), S(9), C.ol); R(X(-8), Y(-4), S(14), S(7), '#d4d6de'); R(X(6), Y(-3), S(5), S(5), '#9b9eac'); R(X(-6), Y(-2), S(3), S(3), C.bad); }
    else { R(X(-7), Y(-2), S(14), S(11), C.ol); R(X(-6), Y(-1), S(12), S(9), '#3a3f4a'); line(X(0), Y(-2), X(0), Y(-11), C.ol, S(2)); disc(X(0), Y(-11), S(2), C.bad); ring(X(0), Y(-11), S(5), '#45e5ee'); }
    line(X(-11), Y(9), X(11), Y(-9), C.bad, S(2));
  } else if (id === 'deepcam') { // 딥페이크 웹캠: 카메라와 웃는 얼굴 사진
    R(X(-9), Y(-7), S(18), S(13), C.ol); R(X(-8), Y(-6), S(16), S(11), '#f3caa1'); R(X(-4), Y(-3), S(2), S(2), C.ol); R(X(2), Y(-3), S(2), S(2), C.ol); R(X(-3), Y(1), S(6), S(1), C.ol);
    R(X(-3), Y(7), S(6), S(3), C.ol); disc(X(7), Y(-7), S(2), C.good);
  } else if (id === 'autooff') { // 자동 소등 칩
    R(X(-7), Y(-7), S(14), S(14), C.ol); R(X(-6), Y(-6), S(12), S(12), '#3a1f6b'); disc(X(0), Y(0), S(3), C.gold); line(X(-9), Y(9), X(9), Y(-9), C.ol, S(2));
  } else if (id === 'glasscase') {
    R(X(-10), Y(-5), S(20), S(11), C.ol); R(X(-9), Y(-4), S(18), S(9), '#7a5a3a'); R(X(-9), Y(0), S(18), S(1), '#5a4028'); R(X(-1), Y(-1), S(2), S(3), C.gold);
  } else if (id === 'gazefix') {
    disc(X(0), Y(0), S(9), C.ol); disc(X(0), Y(0), S(8), '#e8eef4'); disc(X(0), Y(0), S(4), '#2a8f9a'); disc(X(0), Y(0), S(2), C.ol); R(X(-2), Y(-2), S(1), S(1), C.white);
  } else if (id === 'eyedrop') {
    R(X(-4), Y(-4), S(8), S(13), C.ol); R(X(-3), Y(-3), S(6), S(11), '#f4f4f8'); R(X(-2), Y(-9), S(4), S(5), '#2a8af0'); R(X(-3), Y(1), S(6), S(3), '#2a8af0'); R(X(6), Y(4), S(2), S(3), '#7fd6ff');
  } else if (id === 'calccover') {
    R(X(-7), Y(-10), S(14), S(20), C.ol); R(X(-6), Y(-9), S(12), S(18), '#2a2c34'); R(X(-4), Y(-7), S(8), S(4), '#9ae0a0');
    for (let i = 0; i < 9; i++) R(X(-4 + (i % 3) * 3), Y(-1 + Math.floor(i / 3) * 3), S(2), S(2), '#c9c4d8');
  } else if (id === 'screenfilm') {
    R(X(-10), Y(-7), S(20), S(13), C.ol); R(X(-9), Y(-6), S(18), S(11), '#1c2230'); line(X(-7), Y(3), X(1), Y(-5), '#7fd6ff', S(1)); line(X(-2), Y(4), X(7), Y(-5), '#7fd6ff', S(1)); R(X(-4), Y(7), S(8), S(2), C.ol);
  } else if (id === 'taste') { // 와인잔
    poly([[X(-6), Y(-9)], [X(6), Y(-9)], [X(3), Y(0)], [X(-3), Y(0)]], C.ol); poly([[X(-4), Y(-5)], [X(4), Y(-5)], [X(2), Y(-1)], [X(-2), Y(-1)]], '#8a1a2a');
    R(X(-1), Y(0), S(2), S(7), C.ol); R(X(-5), Y(7), S(10), S(2), C.ol); disc(X(7), Y(4), S(2), '#ff5a8a');
  } else if (id === 'thirdeye') {
    for (const [ex, ey] of [[-6, 3], [6, 3], [0, -6]]) { disc(X(ex), Y(ey), S(4), C.ol); disc(X(ex), Y(ey), S(3), '#7ad06a'); disc(X(ex), Y(ey), S(1), C.ol); }
  } else if (id === 'candle') {
    R(X(-3), Y(-2), S(6), S(12), C.ol); R(X(-2), Y(-1), S(4), S(10), '#f4efe0'); poly([[X(0), Y(-11)], [X(3), Y(-4)], [X(-3), Y(-4)]], C.warn); R(X(-1), Y(-6), S(2), S(2), C.gold); R(X(-6), Y(10), S(12), S(2), C.ol);
  } else if (id === 'clone') {
    for (const [ox, c] of [[-6, '#5a4a8a'], [0, '#8a6cd6'], [6, '#c9b8ff']]) { disc(X(ox), Y(-4), S(4), C.ol); disc(X(ox), Y(-4), S(3), c); R(X(ox - 4), Y(1), S(8), S(9), C.ol); R(X(ox - 3), Y(2), S(6), S(8), c); }
  } else if (id === 'humanmod') { // 하트 달린 칩
    R(X(-8), Y(-7), S(16), S(14), C.ol); R(X(-7), Y(-6), S(14), S(12), '#6b1f3a'); disc(X(-2), Y(-1), S(2), '#ff8aa8'); disc(X(2), Y(-1), S(2), '#ff8aa8'); poly([[X(-5), Y(0)], [X(5), Y(0)], [X(0), Y(5)]], '#ff8aa8');
  } else if (id === 'offbeat') { // 메트로놈
    poly([[X(-3), Y(-10)], [X(3), Y(-10)], [X(8), Y(10)], [X(-8), Y(10)]], C.ol); poly([[X(-2), Y(-8)], [X(2), Y(-8)], [X(6), Y(8)], [X(-6), Y(8)]], '#5a3a24'); line(X(0), Y(6), X(5), Y(-7), '#e8e8e8', S(1)); disc(X(4), Y(-4), S(2), C.gold);
  } else { R(X(-7), Y(-7), S(14), S(14), C.ol); R(X(-6), Y(-6), S(12), S(12), '#3a3248'); }
}

// ======================= 공용 판 =======================
function plate(k, x, y, w, h, H) {
  k.b.globalAlpha = 0.74; k.R(x, y, w, h, PAL.dark); k.b.globalAlpha = 1;
  k.frame(x, y, w, h, H.c3, 1); k.R(x, y, 6, 1, H.c); k.R(x, y, 1, 6, H.c);
}

// ======================= 결과 · 허브 · 타이틀 · 엔딩 · figures =======================
function drawResultHud(k, L, Rz, now, H) { // 결과 화면: 창 대신 기기 화면에 뜨는 글자. 녹화 중인 카메라처럼 구석에만
  const { R, T, TO } = k, C = PAL, blink = Math.floor(now * 2) % 2 === 0, dark = '#0d2a30';
  if (blink) k.disc(30, 26, 4, C.bad); TO('REC', 40, 26, 11, C.white, 'left', dark);
  TO(`${Rz.tierName} · 채점 수신`, 74, 26, 10, H.c, 'left', dark);
  if (!Rz.onPaper) { // 책상에 종이가 없는 시험(면접·원격): 결과도 기기 화면에
    const col = Rz.passed ? C.good : C.bad;
    TO(Rz.stamp, L.W / 2, 70, 26, col, 'center', dark); TO(Rz.caught ? '0점 처리' : `${Rz.score}점 · 정답 ${Rz.correct}/${Rz.qn} · 합격선 ${Rz.pass}점`, L.W / 2, 98, 12, C.white, 'center', dark);
  }
  const lines = [];
  if (Rz.reward > 0) lines.push([`입금  ${Rz.pay} +${won(Rz.reward)}원${Rz.perfect ? `  (만점 x${tune.jackpot_mult})` : ''}`, C.gold]);
  if (Rz.fee > 0) lines.push([`출금  응시료 -${won(Rz.fee)}원`, '#d6a0a0']);
  if (!Rz.tut) { const d = Math.round((Rz.heat - Rz.heat0) * 100); lines.push([Rz.audited ? '전수조사  합격 취소 · 너무 완벽했다' : `전수조사 의심  ${Math.round(Rz.heat * 100)}% (${d >= 0 ? '+' : ''}${d})`, Rz.audited || Rz.heat >= 0.66 ? C.bad : Rz.heat >= 0.33 ? C.warn : H.c]); }
  if (Rz.unlock) lines.push([`알림  ${Rz.unlock}`, H.c]);
  lines.forEach(([t, col], i) => { let sz = 10; while (k.TW(t, sz, 800) > 330 && sz > 8) sz--; TO(t, 26, L.H - 28 - (lines.length - 1 - i) * 15, sz, col, 'left', dark); });
  // 오른쪽 아래: 다음에 할 일 (글자만)
  const defs = [['Enter 귀가', 'hub', true]];
  if (Rz.next != null) defs.unshift([Rz.final ? 'N 엔딩' : Rz.canNext ? 'N 다음 시험' : 'N 응시료 부족', 'next', Rz.final || Rz.canNext]);
  defs.unshift([Rz.canRetry ? 'R 재응시' : 'R 응시료 부족', 'retry', Rz.canRetry]);
  const btns = []; let x = L.W - 24;
  for (let i = defs.length - 1; i >= 0; i--) { const [label, key, ok] = defs[i], w = k.TW(label, 11, 800) + 14, bx = x - w, by = L.H - 38, focus = ok && key === Rz.focus;
    if (focus && blink) R(bx, by + 21, w, 1, H.c);
    TO(label, bx + w / 2, by + 11, 11, !ok ? '#6b6680' : focus ? C.white : H.c, 'center', dark);
    if (ok) btns.push({ x: bx, y: by - 4, w, h: 30, key }); x = bx - 8; }
  return btns;
}
function drawResults(k, L, Rz, now, H) {
  const extras = (Rz.perfect ? 1 : 0) + (Rz.coach > 1 ? 1 : 0) + (Rz.bonus > 0 ? 1 : 0);
  const { R, T, TO } = k, C = PAL, w = Math.min(L.W - 40, 420), x = (L.W - w) / 2;
  const h = 138 + (Rz.fee > 0 ? 18 : 0) + 19 + (extras ? 16 : 0) + 16 + (Rz.tut ? 0 : 16) + (Rz.unlock ? 16 : 0) + 50, y = Math.round((L.H - h) / 2);
  k.b.globalAlpha = 0.6; R(0, 0, L.W, L.H, PAL.dark); k.b.globalAlpha = 1;
  const edge = Rz.caught || Rz.audited ? C.bad : Rz.perfect ? C.gold : Rz.passed ? C.good : C.warn;
  R(x, y + 3, w, h, PAL.dark); R(x, y, w, h, '#1d1926'); k.frame(x, y, w, h, edge, 2);
  TO(Rz.audited ? '전수조사: 합격 취소' : Rz.caught ? '적발!' : Rz.perfect ? '수석 합격!' : Rz.passed ? '합격!' : '불합격', L.W / 2, y + 26, Rz.audited ? 22 : 28, edge);
  T(Rz.tierName, L.W / 2, y + 52, 12, '#c9c4d8', 'center', 700);
  // 채점표: 문항마다 O·X, 파란 밑줄은 AI가 고른 답
  const n = Rz.marks.length, cw = Math.min(30, Math.floor((w - 40) / n)), mx = L.W / 2 - (n * cw) / 2, my = y + 86;
  Rz.marks.forEach((m, i) => {
    const cx = mx + i * cw + cw / 2;
    T(String(i + 1), cx, my - 15, 9, '#8f89a3', 'center', 700);
    const col = Rz.caught || m.r === '-' ? '#6b6680' : m.r === 'O' ? C.good : C.bad;
    TO(m.r, cx, my, 16, col, 'center');
    if (m.via === 'ai' || m.via === 'auto') R(cx - 6, my + 12, 12, 2, H.c);
  });
  T(Rz.caught ? '적발 · 0점 처리' : `정답 ${Rz.correct}/${Rz.qn} · ${Rz.score}점 (합격선 ${Rz.pass}점)`, L.W / 2, y + 116, 13, C.white, 'center', 800);
  let ly = y + 138;
  if (Rz.fee > 0) { T(`응시료 -${won(Rz.fee)}원`, L.W / 2, ly, 11, '#d6a0a0', 'center', 700); ly += 18; }
  T(Rz.reward > 0 ? `${Rz.pay} +${won(Rz.reward)}원` : '보상 없음', L.W / 2, ly, 15, Rz.reward > 0 ? C.gold : '#8f89a3', 'center', 800); ly += 19;
  const extra = [];
  if (Rz.perfect) extra.push(`만점 x${tune.jackpot_mult}`);
  if (Rz.coach > 1) extra.push(`면접 x${Rz.coach.toFixed(2)}`);
  if (Rz.bonus > 0) extra.push(`시간 x${(1 + Rz.bonus).toFixed(2)}`);
  if (extra.length) { T(extra.join(' · '), L.W / 2, ly, 11, H.c, 'center', 700); ly += 16; }
  T(`직접 고른 답 ${Rz.self} · AI가 고른 답 ${Rz.ai}`, L.W / 2, ly, 11, '#c9c4d8', 'center', 700); ly += 16;
  if (!Rz.tut) { const d = Math.round((Rz.heat - Rz.heat0) * 100), hc = Rz.audited || Rz.heat >= 0.66 ? C.bad : Rz.heat >= 0.33 ? C.warn : '#8f89a3';
    T(Rz.audited ? '점수가 너무 완벽했다. 가끔은 일부러 틀려야 한다' : `전수조사 의심 ${Math.round(Rz.heat * 100)}% (${d >= 0 ? '+' : ''}${d}%)${Rz.perfect ? ' · 만점은 눈에 띈다' : ''}`, L.W / 2, ly, 11, hc, 'center', 800); ly += 16; }
  if (Rz.unlock) { let us = 12; while (k.TW(Rz.unlock, us, 800) > w - 20 && us > 9) us--; T(Rz.unlock, L.W / 2, ly, us, H.c, 'center', 800); }
  const btns = [], by = y + h - 38, gap = 8;
  const defs = [[Rz.canRetry ? 'R 다시 응시' : '응시료 부족', 'retry', Rz.canRetry]];
  if (Rz.next != null) defs.push([Rz.final ? 'N 엔딩 보기' : Rz.canNext ? 'N 다음 시험' : '응시료 부족', 'next', Rz.final || Rz.canNext]);
  defs.push(['Enter 고시원으로', 'hub', true]);
  const bw = Math.floor((w - 24 - gap * (defs.length - 1)) / defs.length);
  defs.forEach(([label, key, ok], i) => { const b = k.button(x + 12 + i * (bw + gap), by, bw, 26, label, ok && key === Rz.focus, ok ? PAL.hud : '#5a5468'); if (ok) btns.push({ ...b, key }); });
  return btns;
}

function drawTitle(k, L, now, hasSave, info) {
  const { R, T, TO } = k, C = PAL;
  k.b.globalAlpha = 0.45; R(0, 0, L.W, L.H, '#0b0910'); k.b.globalAlpha = 1; // 뒤로 밤의 고시원 3D가 비친다
  const cx = L.W / 2, cy = L.H * 0.3, lw = 86, lh = 52, gx = 56;
  for (const sx of [-1, 1]) {
    k.R(cx + sx * gx - lw / 2 - 4, cy - lh / 2 - 4, lw + 8, lh + 8, C.ol); k.R(cx + sx * gx - lw / 2 - 2, cy - lh / 2 - 2, lw + 4, lh + 4, '#3a3248');
    k.R(cx + sx * gx - lw / 2, cy - lh / 2, lw, lh, '#0f3238');
    k.b.globalAlpha = 0.5; for (let y = 0; y < lh; y += 3) k.R(cx + sx * gx - lw / 2, cy - lh / 2 + y, lw, 1, C.hud); k.b.globalAlpha = 1;
  }
  k.R(cx - gx + lw / 2, cy - lh / 2 + 4, 2 * gx - lw, 6, C.ol); k.R(cx - gx + lw / 2, cy - lh / 2 + 5, 2 * gx - lw, 3, '#3a3248');
  TO('AI 안경', cx, cy + 2, 46, C.hud);
  T('모의평가부터 인류의 마지막 시험까지, 들키지 말고 통과하라', cx, cy + lh / 2 + 24, 13, '#d8d3e6', 'center', 700);
  const lines = ['화면 양옆 꾹 / ← → : 고개 돌려 감독관 보기', '가운데 꾹 / Space : 고개 숙여 AI 스캔', '보기 누르기 / 1~4 : 마킹 · P 일시정지 · M 소리 · F 전체 화면'];
  lines.forEach((s2, i) => T(s2, cx, cy + lh / 2 + 50 + i * 17, 12, '#a9a3bd', 'center', 700));
  if (info && info.best) T(`내 최고 기록 ${info.best}`, cx, cy + lh / 2 + 106, 12, C.gold, 'center', 800);
  if (info && info.ios) { // 아이폰 사파리: 홈 화면에 추가하면 전체 화면
    const w = 372, x = cx - w / 2, y = L.H - 104;
    k.b.globalAlpha = 0.85; R(x, y, w, 34, '#101822'); k.b.globalAlpha = 1; k.frame(x, y, w, 34, C.hud2, 1);
    T('아이폰은 공유 버튼 → "홈 화면에 추가"로 열면 전체 화면이에요', cx, y + 11, 11, C.white, 'center', 800);
    T('진행 상황은 폰 → 설정 → 저장 코드로 옮겨요', cx, y + 25, 10, '#a9a3bd', 'center', 700);
  }
  const label = hasSave ? 'Enter · 탭  이어서 하기' : 'Enter · 탭  첫 시험 보기';
  const bw = 200, b = k.button(cx - bw / 2, L.H - 60, bw, 30, label, Math.floor(now * 2) % 2 === 0);
  return [{ ...b, key: 'start' }];
}

const END_SHOTS = [ // 엔딩 앞 장면: CCTV에 찍힌 세상
  { kind: 'doctor', cam: 'CAM 02 · 종합병원 진료실', cap: '"잠시만요. 안경이... AI가 응답을 안 하네요."' },
  { kind: 'court', cam: 'CAM 05 · 지방법원 301호 법정', cap: '"재판장님, 배터리가 없어서... 휴정을 요청합니다."' },
  { kind: 'school', cam: 'CAM 11 · 고등학교 2학년 3반', cap: '"선생님, 그걸 왜 외워요? 안경이 풀어 주는데."' },
];
const END_T = { shot0: 1.4, shotLen: 4, me: 13.4, line1: 17.4, line2: 19.2, stats: 23 };
function endShotAt(t) { const i = Math.floor((t - END_T.shot0) / END_T.shotLen); return t < END_T.me ? END_SHOTS[Math.max(0, Math.min(END_SHOTS.length - 1, i))] : null; }
function drawEnding(k, L, G, now, H, info) {
  const { R, T, TO } = k, C = PAL, cx = L.W / 2, t = info.t, st = G.stats, E2 = END_T;
  if (!info.world) R(0, 0, L.W, L.H, '#07060d'); // 3D를 못 쓰면 검은 바탕
  const fade = (t0, t1) => Math.max(0, Math.min(1, (t - t0) / 0.8)) * (t1 ? Math.max(0, Math.min(1, (t1 - t) / 0.8)) : 1);
  const line = (str, y, size, col, a) => { if (a <= 0) return; k.b.globalAlpha = a; T(str, cx, y, size, col, 'center', 800); k.b.globalAlpha = 1; };
  const shot = endShotAt(t);
  if (shot) { // CCTV 화면: 녹화 표시, 카메라 이름, 시각, 자막
    const i = END_SHOTS.indexOf(shot), lt = t - E2.shot0 - i * E2.shotLen, sec = 7 + Math.floor(now) % 50;
    k.b.globalAlpha = 0.08; for (let y = 0; y < L.H; y += 3) R(0, y, L.W, 1, '#000000'); k.b.globalAlpha = 1;
    if (Math.floor(now * 2) % 2) k.disc(24, 20, 4, C.bad); TO('REC', 34, 20, 11, C.white, 'left', '#101010');
    TO(shot.cam, 24, 38, 10, C.white, 'left', '#101010'); TO(`2031-03-${14 + i} 10:4${i}:${String(sec).padStart(2, '0')}`, L.W - 24, 20, 10, C.white, 'right', '#101010');
    k.b.globalAlpha = 0.6; R(0, L.H - 58, L.W, 34, '#000000'); k.b.globalAlpha = 1;
    if (lt > 0.6) T(shot.cap, cx, L.H - 41, 13, C.white, 'center', 800);
    if (lt < 0.25 || lt > E2.shotLen - 0.2) { k.b.globalAlpha = 0.85; R(0, 0, L.W, L.H, '#000000'); k.b.globalAlpha = 1; } // 화면 전환
  }
  if (t < 1.4) { k.b.globalAlpha = Math.max(0, 1 - t / 1.4); R(0, 0, L.W, L.H, '#ffffff'); k.b.globalAlpha = 1; } // 하얗게 날아간 화면이 걷힌다
  if (t < E2.stats) {
    if (!shot) { const ly = info.world ? L.H - 74 : L.H / 2 - 16;
      if (info.world && t > E2.line1 - 1) { k.b.globalAlpha = 0.55 * fade(E2.line1 - 1, E2.stats - 0.3); R(0, ly - 22, L.W, 76, '#05050a'); k.b.globalAlpha = 1; }
      line('AI는 답을 알려 줍니다.', ly, 20, C.white, fade(E2.line1, E2.stats - 0.3));
      line('어디에 쓸지는 알려 주지 않습니다.', ly + 32, 20, C.hud, fade(E2.line2, E2.stats - 0.3)); }
    return [];
  }
  const a = Math.min(1, (t - E2.stats) / 0.8);
  if (info.world) { k.b.globalAlpha = 0.82 * a; R(0, 0, L.W, L.H, '#05050a'); }
  k.b.globalAlpha = a;
  let y = 28;
  T('AI는 답을 알려 줍니다. 어디에 쓸지는 알려 주지 않습니다.', cx, y, 12, C.white, 'center', 800); y += 30;
  TO(`타임어택 ${info.time}`, cx, y, 20, C.hud); y += 20;
  T(info.rank ? `내 기록 ${info.rank}위${info.rank === 1 ? ' · 신기록!' : ''}` : '', cx, y, 11, C.gold, 'center', 800); y += 16;
  const lx = cx - 150, rx = cx + 150; let ly = y + 6, ry = y + 6;
  T('구간 기록', lx, ly, 11, H.c, 'center', 800); ly += 16;
  for (const sp of info.splits) { T(`${sp.name}  ${sp.time}`, lx, ly, 11, '#c9c4d8', 'center', 700); ly += 15; }
  T('내 기록 (이 기기)', rx, ry, 11, H.c, 'center', 800); ry += 16;
  info.records.slice(0, 4).forEach((r, i) => { T(`${i + 1}. ${r.name}  ${r.time}`, rx, ry, 11, r.me ? C.gold : '#c9c4d8', 'center', r.me ? 800 : 700); ry += 15; });
  y = Math.max(ly, ry) + 14;
  T(`시험 ${st.exams}번 · 스캔 ${st.scans}회 · 적발 ${st.caught}번`, cx, y, 11, '#c9c4d8', 'center', 700); y += 17;
  T(`AI가 고른 답 ${st.aiQ}개 · 내가 직접 고른 답 ${st.selfQ}개`, cx, y, 12, C.white, 'center', 800); y += 24;
  T('이 게임은 AI와 함께 만들었습니다.', cx, y, 11, '#8f89a3', 'center', 700);
  k.b.globalAlpha = 1;
  const bw = 130, by = L.H - 44;
  const b1 = k.button(cx - bw * 1.5 - 8, by, bw, 28, 'Enter 계속하기', Math.floor(now * 2) % 2 === 0);
  const b3 = k.button(cx - bw / 2, by, bw, 28, 'N 이름 바꾸기', false);
  const b2 = k.button(cx + bw / 2 + 8, by, bw, 28, 'X 새 타임어택', false, C.warn);
  return [{ ...b1, key: 'continue' }, { ...b3, key: 'name' }, { ...b2, key: 'wipe' }];
}
