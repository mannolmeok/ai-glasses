// PROTOTYPE - NOT FOR PRODUCTION
// Question: 감독관 눈치를 보며 AI 안경으로 스캔하는 긴장감이, 장비와 시험이 함께 커지는 성장과 맞물려 엔딩까지 재밌나?
// Date: 2026-11-17
// 시험 중 안경 HUD(3D 화면 위에 겹치는 640x360 도트 층: 시계, 스캔 진행, 렌즈 가장자리 경고, 안내, 적발)와
// 3D 시험지·태블릿·노트북 화면에 그리는 그림(문제, 보기, 마킹, 안경이 비추는 AR: 지운 오답·AI 답·초점 틀),
// 마주 앉는 시험(면접·테이스팅)에서 안경이 띄우는 AR 카드.
'use strict';

const EXAM_LAYOUT = { W: 640, H: 360, zone: 0.17, clock: [592, 40], hintY: 22 };

// ---- 시험지 (3D 종이·태블릿에 붙는 그림) ----
const PAPER_W = 720, PAPER_H = 1000;
const PAPER_ROW = i => 548 + i * 106;
function paperRowAt(py) { for (let i = 0; i < 4; i++) if (py > PAPER_ROW(i) - 76 && py < PAPER_ROW(i) + 30) return i; return -1; }
function wrapCanvas(g, str, maxW) {
  const out = []; let cur = '';
  for (const w of String(str).split(' ')) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width <= maxW) { cur = t; continue; }
    if (cur) out.push(cur);
    if (g.measureText(w).width <= maxW) { cur = w; continue; }
    let part = ''; for (const ch of w) { if (g.measureText(part + ch).width > maxW) { out.push(part); part = ch; } else part += ch; } cur = part;
  }
  if (cur) out.push(cur);
  return out;
}
const TABLET_BAR = { sat: '#2b4c9a', usmle: '#34343e', calbar: '#5a1f2a' };
function glyphCanvas(g, seed, x, y, s, col, lw) { // 외계 문자 한 자를 캔버스에
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = lw; g.lineCap = 'square';
  for (const [x0, y0, x1, y1] of glyph(seed)) {
    if (x0 === x1 && y0 === y1) g.fillRect(x + x0 * s - lw, y + y0 * s - lw, lw * 2, lw * 2);
    else { g.beginPath(); g.moveTo(x + x0 * s, y + y0 * s); g.lineTo(x + x1 * s, y + y1 * s); g.stroke(); }
  }
}
function glyphRow(g, seed, n, x, y, s, col, lw) { alienWord(seed, n).forEach((gl, i) => glyphCanvas(g, gl, x + i * (s * 1.25), y, s, col, lw)); }
function captchaIcon(g, id, cx, cy, s) { // 로봇 확인 그림 6종 (신호등·자동차·나무·버스·자전거·소화전)
  const u = s / 20, R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(cx + x * u, cy + y * u, w * u, h * u); };
  const C = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(cx + x * u, cy + y * u, r * u, 0, 7); g.fill(); };
  if (id === 0) { R(-4, -9, 8, 18, '#26262e'); C(0, -5, 2.4, '#e8453e'); C(0, 0, 2.4, '#f2c13a'); C(0, 5, 2.4, '#4ac24a'); R(-1, 9, 2, 3, '#26262e'); }
  else if (id === 1) { R(-9, -1, 18, 6, '#d6403a'); R(-5, -5, 10, 4, '#d6403a'); R(-4, -4, 3, 3, '#bfe8ff'); R(1, -4, 3, 3, '#bfe8ff'); C(-5, 5, 2.6, '#1c1c22'); C(5, 5, 2.6, '#1c1c22'); }
  else if (id === 2) { R(-1.5, 2, 3, 8, '#7a4a2a'); C(0, -3, 7, '#3f9a3a'); C(-3, -5, 3, '#55b04a'); }
  else if (id === 3) { R(-10, -6, 20, 11, '#f2b23a'); for (let i = 0; i < 4; i++) R(-8.5 + i * 4.4, -4.5, 3.4, 3.4, '#bfe8ff'); C(-6, 5.5, 2.4, '#1c1c22'); C(6, 5.5, 2.4, '#1c1c22'); }
  else if (id === 4) { g.strokeStyle = '#26262e'; g.lineWidth = 1.6 * u; for (const sx of [-5.5, 5.5]) { g.beginPath(); g.arc(cx + sx * u, cy + 3 * u, 4.2 * u, 0, 7); g.stroke(); }
    g.beginPath(); g.moveTo(cx - 5.5 * u, cy + 3 * u); g.lineTo(cx - 1 * u, cy - 3 * u); g.lineTo(cx + 5.5 * u, cy + 3 * u); g.moveTo(cx - 1 * u, cy - 3 * u); g.lineTo(cx + 3 * u, cy - 3 * u); g.stroke(); }
  else { R(-4, -4, 8, 13, '#d6403a'); R(-5, -6, 10, 3, '#b8302a'); R(-2, -9, 4, 3, '#b8302a'); R(-7, -1, 3, 3, '#b8302a'); R(4, -1, 3, 3, '#b8302a'); R(-5, 8, 10, 2, '#8a2a24'); }
}
function drawPaperTexture(g, E, now) {
  const F = FONT_KO, tier = E.T, q = E.qs[Math.min(E.qi, E.qs.length - 1)], tablet = tier.device === 'tablet';
  const head = [tier.head[0], tier.parts ? tier.parts[E.part] : tier.head[1]];
  const ink = '#2a2838', cyan = '#2fd3dd', bg = tablet ? '#fbfcfe' : '#f6f2e6';
  g.textBaseline = 'alphabetic'; g.fillStyle = bg; g.fillRect(0, 0, PAPER_W, PAPER_H);
  if (tablet) { g.fillStyle = TABLET_BAR[tier.id] || '#2b4c9a'; g.fillRect(0, 0, PAPER_W, 150); }
  g.fillStyle = tablet ? '#ffffff' : ink; g.textAlign = 'center';
  let hs = 30; g.font = `800 ${hs}px ${F}`; while (g.measureText(head[0]).width > PAPER_W - 80 && hs > 20) { hs -= 2; g.font = `800 ${hs}px ${F}`; }
  g.fillText(head[0], PAPER_W / 2, 62);
  g.font = `800 30px ${F}`; const sw = g.measureText(head[1]).width + 48;
  g.lineWidth = 3; g.strokeStyle = tablet ? '#ffffff' : ink; g.strokeRect(PAPER_W / 2 - sw / 2, 86, sw, 52); g.fillText(head[1], PAPER_W / 2, 123);
  g.font = `700 24px ${F}`; g.textAlign = 'right'; g.fillStyle = tablet ? '#c8d4f0' : '#6c6a80'; g.fillText(`${E.qi + 1} / ${E.qs.length}`, PAPER_W - 44, 123);
  g.fillStyle = ink; if (!tablet) { g.fillRect(40, 164, PAPER_W - 80, 4); g.fillRect(40, 172, PAPER_W - 80, 1); }
  if (E.breakT > 0) { g.textAlign = 'center'; g.fillStyle = '#6c6a80'; g.font = `800 44px ${F}`; g.fillText('쉬는 시간', PAPER_W / 2, 420); return; }
  // 문제: 길면 글자를 줄여서
  g.textAlign = 'left'; g.fillStyle = ink;
  const room = q.kind === 'captcha' ? 70 : q.kind === 'alien' ? 150 : q.kind === 'listen' ? 120 : 260;
  let size = 50, lines = [];
  for (;;) { g.font = `800 ${size}px ${F}`; lines = wrapCanvas(g, `${E.qi + 1}. ${q.q}`, PAPER_W - 110); if (lines.length * (size + 14) <= room || size <= (q.kind === 'captcha' ? 38 : 28)) break; size -= 4; }
  lines.slice(0, 6).forEach((ln, i) => g.fillText(ln, 56, 236 + i * (size + 14)));
  const below = 236 + lines.length * (size + 14);
  if (q.kind === 'captcha') { // 3x3 칸
    const cell = 66, x0 = PAPER_W / 2 - cell * 1.5, y0 = Math.max(262, below - 26);
    for (let i = 0; i < 9; i++) { const cx = x0 + (i % 3) * cell, cy = y0 + Math.floor(i / 3) * cell; g.fillStyle = '#e8ecf2'; g.fillRect(cx + 2, cy + 2, cell - 4, cell - 4); captchaIcon(g, q.grid[i], cx + cell / 2, cy + cell / 2, 50); }
    g.strokeStyle = '#8a92a0'; g.lineWidth = 2; g.strokeRect(x0, y0, cell * 3, cell * 3);
  } else if (q.kind === 'alien') { // 외계어 번역문
    glyphRow(g, q.seed, 9, 60, below - 20, 36, '#5a4a8a', 3);
  } else if (q.kind === 'listen') { // 방송 듣기: 사진 자리와 스피커
    g.fillStyle = '#d8d4c8'; g.fillRect(56, below - 30, 220, 140); g.fillStyle = '#8a8676'; g.font = `800 28px ${F}`; g.textAlign = 'center'; g.fillText('사진', 166, below + 50); g.textAlign = 'left';
    g.fillStyle = ink; g.fillRect(320, below + 10, 28, 40); g.beginPath(); g.moveTo(348, below + 10); g.lineTo(380, below - 14); g.lineTo(380, below + 74); g.lineTo(348, below + 50); g.fill();
    g.strokeStyle = ink; g.lineWidth = 5; for (let i = 0; i < 3; i++) { if (Math.floor(now * 3) % 3 < i) continue; g.beginPath(); g.arc(384, below + 30, 22 + i * 18, -0.7, 0.7); g.stroke(); }
  }
  // 보기
  let cs = 54; g.font = `700 ${cs}px ${F}`;
  const text = c => (q.kind === 'alien' ? '' : String(c));
  const widest = Math.max(...q.choices.map(c => g.measureText(text(c)).width));
  if (widest > PAPER_W - 230) { cs = Math.max(28, Math.floor(cs * (PAPER_W - 230) / widest)); }
  q.choices.forEach((t, i) => {
    const y = PAPER_ROW(i), marked = E.answers[E.qi] === i;
    g.lineWidth = 3; g.strokeStyle = ink;
    if (tablet) { g.strokeRect(66, y - 44, 52, 52); if (marked) { g.fillStyle = '#1f3d7a'; g.fillRect(66, y - 44, 52, 52); } }
    else { g.beginPath(); g.arc(92, y - 18, 25, 0, 7); g.stroke(); if (marked) { g.fillStyle = '#1c1c26'; g.beginPath(); g.arc(92, y - 18, 25, 0, 7); g.fill(); } }
    g.fillStyle = marked ? '#f6f2e6' : ink; g.textAlign = 'center'; g.font = `800 30px ${F}`; g.fillText(tablet ? 'ABCD'[i] : String(i + 1), 92, y - 7);
    g.fillStyle = ink; g.textAlign = 'left';
    if (q.kind === 'alien') glyphRow(g, t, 5, 144, y - 48, 40, '#3a2a6a', 3);
    else { g.font = `700 ${cs}px ${F}`; g.fillText(text(t), 140, y); }
  });
  g.textAlign = 'center'; g.font = `700 24px ${F}`; g.fillStyle = '#6c6a80'; g.fillText(`- ${E.qi + 1} -`, PAPER_W / 2, PAPER_H - 26);
  if (E.start > 0) return;
  if (q.final && E.ai) { // 마지막 문제: 모든 보기에 AI 100%, 화면이 깨진다
    for (let i = 0; i < 4; i++) {
      const y = PAPER_ROW(i), jx = Math.round(Math.sin(now * 31 + i * 2.1) * 7), jy = Math.round(Math.sin(now * 23 + i) * 3);
      g.lineWidth = 6; g.strokeStyle = i % 2 ? '#ff3a8a' : cyan; g.strokeRect(46 + jx, y - 70 + jy, PAPER_W - 92, 92);
      g.fillStyle = '#ff3a8a'; g.textAlign = 'right'; g.font = `800 40px ${F}`; g.fillText('AI 100%', PAPER_W - 58 + jx, y - 8 + jy);
      g.fillStyle = cyan; g.fillText('AI 100%', PAPER_W - 62 - jx, y - 8);
    }
    for (let i = 0; i < 9; i++) { const h = Math.abs(Math.sin(i * 12.9898 + Math.floor(now * 14) * 78.233) * 43758.5453) % 1; g.globalAlpha = 0.5; g.fillStyle = i % 3 ? cyan : '#ff3a8a'; g.fillRect(0, Math.floor(h * PAPER_H), PAPER_W, 3 + Math.floor(((h * 7) % 1) * 14)); } g.globalAlpha = 1;
    return;
  }
  if (!E.ar) return; // 안경 전 단계: 시험지 위에는 아무것도 뜨지 않는다 (답은 소매 속 액정에)
  // 안경이 종이 위에 비추는 AR: 1/3, 2/3에서 지운 오답, 끝나면 AI가 고른 보기, 스캔 중엔 초점 틀
  const strikes = Math.min(2, q.pre ? 2 : Math.floor(E.scan * 3 + 1e-6));
  for (let j = 0; j < strikes; j++) {
    const i = q.elim[j], y = PAPER_ROW(i); g.font = `700 ${cs}px ${F}`; const tw = q.kind === 'alien' ? 300 : g.measureText(text(q.choices[i])).width;
    g.globalAlpha = 0.35; g.fillStyle = '#0f3238'; g.fillRect(56, y - 60, tw + 112, 76); g.globalAlpha = 1;
    g.fillStyle = cyan; g.fillRect(132, y - 24, tw + 16, 7);
  }
  if (E.ai && !E.fb) {
    const y = PAPER_ROW(q.aiPick);
    g.lineWidth = 6; g.strokeStyle = cyan; g.strokeRect(46, y - 70, PAPER_W - 92, 92);
    g.fillStyle = cyan; g.textAlign = 'right'; g.font = `800 40px ${F}`; g.fillText(`AI ${q.conf}%`, PAPER_W - 62, y - 8);
  }
  if ((E.holding || E.scan > 0) && !E.ai && !E.fb) {
    const x0 = 36, y0 = 186, x1 = PAPER_W - 36, y1 = PAPER_ROW(3) + 44, L = 46;
    g.fillStyle = cyan;
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      g.fillRect(sx > 0 ? cx : cx - L, cy - (sy > 0 ? 0 : 6), L, 6); g.fillRect(cx - (sx > 0 ? 0 : 6), sy > 0 ? cy : cy - L, 6, L);
    }
    if (E.holding) { g.globalAlpha = 0.6; g.fillRect(x0, y0 + ((now * 520) % (y1 - y0)), x1 - x0, 4); g.globalAlpha = 1; }
  }
  if (E.pulse && E.T.pulse === 'screen' && (E.pulse.warn > 0 || E.pulse.active > 0)) { // 화면 검사: 태블릿 화면이 깜빡인다
    g.globalAlpha = E.pulse.active > 0 ? 0.35 : 0.12; g.fillStyle = '#ff3048'; g.fillRect(0, 0, PAPER_W, PAPER_H); g.globalAlpha = 1;
    g.fillStyle = '#ff3048'; g.textAlign = 'center'; g.font = `800 34px ${F}`; g.fillText('SCREEN CHECK', PAPER_W / 2, 196);
  }
}

// ---- 성적 통지표: 시험이 끝나면 책상 위 시험지가 채점된 종이로 바뀐다 ----
function drawResultPaper(g, Rz) {
  const F = FONT_KO, ink = '#2a2838', red = '#d0282a';
  g.textBaseline = 'alphabetic'; g.fillStyle = '#f6f2e6'; g.fillRect(0, 0, PAPER_W, PAPER_H);
  g.fillStyle = ink; g.textAlign = 'center'; g.font = `800 44px ${F}`; g.fillText('성 적 통 지 표', PAPER_W / 2, 78);
  let ns = 34; g.font = `700 ${ns}px ${F}`; while (g.measureText(Rz.tierName).width > PAPER_W - 100 && ns > 22) { ns -= 2; g.font = `700 ${ns}px ${F}`; }
  g.fillText(Rz.tierName, PAPER_W / 2, 128); g.fillRect(40, 150, PAPER_W - 80, 4);
  // 문항별 채점: 빨간 색연필 동그라미와 빗금. 밑줄은 AI가 고른 답
  const n = Rz.marks.length, per = n > 20 ? 12 : n > 10 ? 9 : n, rows = Math.ceil(n / per), cw = Math.min(64, (PAPER_W - 100) / per), x0 = PAPER_W / 2 - cw * per / 2;
  Rz.marks.forEach((m, i) => {
    const cx = x0 + (i % per) * cw + cw / 2, cy = 214 + Math.floor(i / per) * 92;
    g.fillStyle = '#6c6a80'; g.font = `700 20px ${F}`; g.fillText(String(i + 1), cx, cy - 26);
    g.lineWidth = 6; g.strokeStyle = Rz.caught ? '#8a8676' : red; g.lineCap = 'round';
    if (m.r === 'O' && !Rz.caught) { g.beginPath(); g.ellipse(cx, cy + 6, 20, 17, -0.3, 0.2, 6.6); g.stroke(); }
    else if (m.r === 'X' || Rz.caught) { g.beginPath(); g.moveTo(cx - 16, cy + 22); g.lineTo(cx + 16, cy - 10); g.stroke(); }
    else { g.fillStyle = '#8a8676'; g.fillRect(cx - 10, cy + 4, 20, 4); }
    if (m.via === 'ai' || m.via === 'auto') { g.fillStyle = '#2fd3dd'; g.fillRect(cx - 18, cy + 34, 36, 5); }
  });
  let y = 214 + rows * 92 + 30;
  g.fillStyle = ink; g.font = `800 40px ${F}`; g.fillText(Rz.caught ? '부정행위 · 0점 처리' : `정답 ${Rz.correct} / ${Rz.qn}   합격선 ${Rz.pass}점`, PAPER_W / 2, y); y += 40;
  if (!Rz.caught) { g.fillStyle = red; g.font = `800 120px ${F}`; g.save(); g.translate(PAPER_W / 2 + 180, y + 70); g.rotate(-0.12); g.fillText(String(Rz.score), 0, 0); g.fillRect(-90, 14, 180, 6); g.fillRect(-90, 26, 180, 6); g.restore(); }
  // 도장
  g.save(); g.translate(PAPER_W / 2 - 150, y + 60); g.rotate(-0.16); g.strokeStyle = Rz.passed ? red : '#3a3a48'; g.fillStyle = g.strokeStyle; g.lineWidth = 8; g.globalAlpha = 0.85;
  const st = Rz.stamp, sw = st.length > 3 ? 300 : 210; g.strokeRect(-sw / 2, -52, sw, 96); g.font = `800 ${st.length > 5 ? 46 : 64}px ${F}`; g.fillText(st, 0, 18); g.restore(); g.globalAlpha = 1;
  // 아래는 진짜 통지표처럼: 수험번호와 발급 기관만. 돈과 뉴스는 종이에 적히지 않는다
  y = PAPER_H - 150; g.fillStyle = ink; g.fillRect(40, y - 40, PAPER_W - 80, 2);
  g.textAlign = 'left'; g.font = `700 24px ${F}`; g.fillStyle = '#4a4860'; g.fillText(`수험번호  ${31000000 + Rz.tier * 1234567}`, 56, y); g.fillText('성      명  김수험', 56, y + 34);
  g.textAlign = 'center'; g.font = `700 22px ${F}`; g.fillText('위와 같이 채점 결과를 통지합니다.', PAPER_W / 2, y + 84);
  g.font = `800 26px ${F}`; g.fillStyle = ink; g.fillText('시 험 관 리 위 원 회', PAPER_W / 2, y + 122);
}

// ---- 토플 홈에디션: 고시원 노트북 화면 ----
const SCREEN_W = 990, SCREEN_H = 600;
const SCREEN_ROW = i => 170 + i * 108;
function screenRowAt(px, py) { if (px < 500) return -1; for (let i = 0; i < 4; i++) if (Math.abs(py - SCREEN_ROW(i)) < 52) return i; return -1; }
function drawScreenTexture(g, E, now) {
  const F = FONT_KO, q = E.qs[Math.min(E.qi, E.qs.length - 1)], cyan = '#2fd3dd';
  g.textBaseline = 'alphabetic'; g.fillStyle = '#f4f6fa'; g.fillRect(0, 0, SCREEN_W, SCREEN_H);
  g.fillStyle = '#1d3557'; g.fillRect(0, 0, SCREEN_W, 74);
  g.fillStyle = '#ffffff'; g.font = `800 30px ${F}`; g.textAlign = 'left'; g.fillText('TOEFL iBT  |  Reading', 28, 48);
  g.textAlign = 'center'; g.fillText(`Question ${E.qi + 1} of ${E.qs.length}`, SCREEN_W / 2 + 60, 48);
  const sec = Math.max(0, Math.ceil(E.timeLeft)); g.textAlign = 'right'; g.fillText(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, SCREEN_W - 28, 48);
  g.fillStyle = '#dfe4ec'; g.fillRect(488, 92, 4, SCREEN_H - 120);
  g.fillStyle = '#c8ced8'; for (let i = 0; i < 7; i++) g.fillRect(36, 330 + i * 34, 400 - (i * 53) % 140, 14); // 지문(흐릿한 줄)
  g.fillStyle = '#1d2433'; g.textAlign = 'left';
  let size = 44, lines; for (;;) { g.font = `800 ${size}px ${F}`; lines = wrapCanvas(g, q.q, 420); if (lines.length * (size + 12) <= 200 || size <= 26) break; size -= 4; }
  lines.forEach((ln, i) => g.fillText(ln, 36, 140 + i * (size + 12)));
  q.choices.forEach((t, i) => {
    const y = SCREEN_ROW(i), marked = E.answers[E.qi] === i;
    g.strokeStyle = '#1d3557'; g.lineWidth = 3; g.beginPath(); g.arc(540, y, 20, 0, 7); g.stroke();
    if (marked) { g.fillStyle = '#1d3557'; g.beginPath(); g.arc(540, y, 12, 0, 7); g.fill(); }
    g.fillStyle = '#1d2433'; g.font = `700 40px ${F}`; g.fillText(String(t), 580, y + 14);
  });
  if (E.start > 0) return;
  const strikes = Math.min(2, q.pre ? 2 : Math.floor(E.scan * 3 + 1e-6));
  for (let j = 0; j < strikes; j++) { const y = SCREEN_ROW(q.elim[j]); g.fillStyle = cyan; g.fillRect(574, y - 4, 360, 6); }
  if (E.ai && !E.fb) { const y = SCREEN_ROW(q.aiPick); g.lineWidth = 6; g.strokeStyle = cyan; g.strokeRect(506, y - 48, SCREEN_W - 530, 96); g.fillStyle = cyan; g.textAlign = 'right'; g.font = `800 32px ${F}`; g.fillText(`AI ${q.conf}%`, SCREEN_W - 36, y - 18); }
  if ((E.holding || E.scan > 0) && !E.ai && !E.fb) { g.fillStyle = cyan; g.globalAlpha = 0.7; g.fillRect(500, 112 + ((now * 380) % 440), SCREEN_W - 520, 4); g.globalAlpha = 1; g.lineWidth = 4; g.strokeStyle = cyan; g.strokeRect(500, 110, SCREEN_W - 520, 446); }
}

// ---- 마주 앉는 시험: 안경이 띄우는 AR 카드 (문제·보기 넷) ----
function arCardRect(E, k) {
  const q = E.qs[Math.min(E.qi, E.qs.length - 1)], lines = q ? wrapKit(k, q.q, 560, 12) : [''];
  const h = 16 + lines.length * 16 + 40, w = 584, x = (640 - w) / 2, y = 346 - h;
  return { x, y, w, h, lines };
}
function wrapKit(k, str, maxW, size) {
  const out = []; let cur = '';
  for (const w of String(str).split(' ')) { const t = cur ? cur + ' ' + w : w; if (k.TW(t, size, 800) <= maxW || !cur) cur = t; else { out.push(cur); cur = w; } }
  if (cur) out.push(cur); return out.slice(0, 3);
}
function drawArCard(k, L, E, now, H) {
  const { R, T } = k, C = PAL, q = E.qs[Math.min(E.qi, E.qs.length - 1)];
  E.arRows = [];
  if (!q || E.breakT > 0) return;
  const c = arCardRect(E, k);
  k.b.globalAlpha = 0.78; R(c.x, c.y, c.w, c.h, '#06161a'); k.b.globalAlpha = 1; k.frame(c.x, c.y, c.w, c.h, H.c, 1);
  R(c.x, c.y, 10, 2, H.c); R(c.x, c.y, 2, 10, H.c); R(c.x + c.w - 10, c.y + c.h - 2, 10, 2, H.c); R(c.x + c.w - 2, c.y + c.h - 10, 2, 10, H.c);
  if (q.kind === 'wine') { const red = q.color === 'red'; R(c.x + 10, c.y + 8, 8, 10, red ? '#8a1a2a' : '#e8d070'); k.frame(c.x + 9, c.y + 7, 10, 12, '#dfe8f2', 1); }
  c.lines.forEach((ln, i) => T(ln, c.x + (q.kind === 'wine' ? 26 : 12), c.y + 14 + i * 16, 12, C.white, 'left', 800));
  const bw = Math.floor((c.w - 24 - 18) / 4), by = c.y + c.h - 34;
  const strikes = E.start > 0 ? 0 : Math.min(2, q.pre ? 2 : Math.floor(E.scan * 3 + 1e-6)), struck = q.elim.slice(0, strikes);
  q.choices.forEach((t, i) => {
    const bx = c.x + 12 + i * (bw + 6), marked = E.answers[E.qi] === i, ai = E.ai && !E.fb && q.aiPick === i, gone = struck.includes(i);
    R(bx, by, bw, 26, marked ? H.c : ai ? '#0f3a40' : '#141a24'); k.frame(bx, by, bw, 26, ai ? H.c : gone ? '#2a3a40' : '#4a5a6a', ai ? 2 : 1);
    let size = 11; while (k.TW(t, size, 800) > bw - 22 && size > 8) size--;
    T(String(i + 1), bx + 8, by + 13, 10, marked ? C.dark : '#8fa0b8', 'center', 800);
    T(t, bx + 16, by + 13, size, marked ? C.dark : gone ? '#4a5a62' : C.white, 'left', 800);
    if (gone) R(bx + 14, by + 13, Math.min(bw - 18, k.TW(t, size, 800) + 4), 2, H.c);
    if (ai) { k.TO(`AI ${q.conf}%`, bx + bw - 2, by - 8, 10, H.c, 'right', '#06161a'); }
    E.arRows.push({ x: bx, y: by, w: bw, h: 26, i });
  });
  if ((E.holding || E.scan > 0) && !E.ai && !E.fb && E.start <= 0) { k.b.globalAlpha = 0.6; R(c.x + 4, c.y + 4 + ((now * 90) % (c.h - 8)), c.w - 8, 1, H.c); k.b.globalAlpha = 1; }
}
function arRowAt(E, x, y) { for (const r of E.arRows || []) if (x >= r.x && x <= r.x + r.w && y >= r.y - 4 && y <= r.y + r.h + 4) return r.i; return -1; }

// ---- 렌즈 가장자리 빛 (경고·의심도용, 방향·색마다 한 번 계산) ----
const GLOW_CACHE = {};
function lensGlow(side, hex) {
  const id = side + hex;
  if (GLOW_CACHE[id]) return GLOW_CACHE[id];
  const L = LAYOUTS.land, c = document.createElement('canvas'); c.width = L.W; c.height = L.H;
  const g = c.getContext('2d'), img = g.createImageData(L.W, L.H), d = img.data, [r, gg, bb] = hexRgb(hex);
  for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
    if (side === 'L' && x > L.W * 0.4) continue;
    if (side === 'R' && x < L.W * 0.6) continue;
    if (side === 'T' && y > L.H * 0.4) continue;
    const f = lensF(L.lenses, x + 0.5, y + 0.5);
    if (f >= 1 || f < 0.6) continue;
    const a = (f - 0.6) / 0.4, i = (y * L.W + x) * 4;
    if (((x + y) & 1) && a < 0.55) continue;
    d[i] = r; d[i + 1] = gg; d[i + 2] = bb; d[i + 3] = Math.round(255 * Math.min(1, a * 1.15));
  }
  g.putImageData(img, 0, 0);
  return (GLOW_CACHE[id] = c);
}

// ---- 시험 중 안경 HUD ----
function drawExamHud(k, L, E, now, H) {
  const X = EXAM_LAYOUT, C = PAL, { R, T, TO } = k, tier = E.T;
  const live = E.start <= 0 && !E.over && !E.caught && !(E.breakT > 0), onPaper = E.view === 'paper' && E.viewT >= 1;
  const q = E.qs[Math.min(E.qi, E.qs.length - 1)];
  if (E.ar) { k.b.globalAlpha = 0.06; for (let y = 1; y < L.H; y += 3) R(0, y, L.W, 1, H.c); k.b.globalAlpha = 1; } // 렌즈 스캔라인 (안경을 쓴 뒤부터)
  if (E.pulse && (E.pulse.warn > 0 || E.pulse.active > 0) && E.pulseCut > 0) { // 탐지 전파·드론: 렌즈에 잡음
    const strong = E.pulse.active > 0, n = strong ? 26 : 9;
    for (let i = 0; i < n; i++) {
      const hsh = Math.abs(Math.sin(i * 12.9898 + Math.floor(now * 30) * 78.233) * 43758.5453) % 1;
      k.b.globalAlpha = (strong ? 0.5 : 0.25) * Math.min(1, E.pulseCut * 1.5);
      R(Math.floor(((hsh * 13) % 1) * L.W), Math.floor(hsh * L.H), 30 + Math.floor(((hsh * 7) % 1) * (L.W * 0.6)), 1, strong ? C.bad : H.c);
    }
    k.b.globalAlpha = 1;
  }
  const pl = E.gear.predict; // 시선 예측: 그쪽 렌즈 가장자리가 경고 (3단계부터 쳐다볼 때도 빨갛게)
  if (pl >= 3 && live && E.layout === 'room') { // 후방 카메라: 등 뒤 감독관을 위쪽 작은 화면에
    const back = E.staff.filter(s => !s.fixed && !s.out && !(s.blink > 0) && s.phase !== 'help' && s.u < 0.37), bx = L.W / 2 - 46, by = 8;
    k.b.globalAlpha = 0.8; R(bx, by, 92, 18, '#06161a'); k.b.globalAlpha = 1; k.frame(bx, by, 92, 18, H.c2, 1);
    T('후방', bx + 46, by + 9, 8, H.c2, 'center', 700);
    for (const s of back) { const col = s.phase === 'watch' ? C.bad : s.phase === 'tell' ? C.warn : '#c9c4d8', x = s.side === 'L' ? bx + 14 : bx + 78; k.disc(x, by + 9, 4, col); if (s.phase === 'watch') k.ring(x, by + 9, 6, C.bad); }
  }
  if (pl > 0 && live && E.layout === 'room') {
    for (const sd of ['L', 'R']) {
      const st = E.staff.filter(s => s.side === sd && s.phase !== 'cross' && !s.out && !(s.blink > 0) && !s.fixed);
      if (pl >= 3 && st.some(s => s.phase === 'watch')) { k.b.globalAlpha = 0.75; k.b.drawImage(lensGlow(sd, C.bad), 0, 0); }
      else if (st.some(s => s.phase === 'tell' || (s.phase === 'check' && s.check && s.check.stage === 'go'))) { k.b.globalAlpha = Math.floor(now * 6) % 2 ? 0.85 : 0.45; k.b.drawImage(lensGlow(sd, C.warn), 0, 0); }
      k.b.globalAlpha = 1;
    }
    const fx = E.staff.filter(s => s.fixed && s.type !== 'webcam');
    if (fx.some(s => s.phase === 'tell')) { k.b.globalAlpha = Math.floor(now * 6) % 2 ? 0.8 : 0.4; k.b.drawImage(lensGlow('T', C.warn), 0, 0); k.b.globalAlpha = 1; }
  }
  if (E.sus > 0.02 || E.rising) { // 의심도: 렌즈 둘레가 붉어지고, 보는 중에 스캔하면 깜빡인다
    const base = Math.min(0.85, 0.12 + E.sus * 0.9), a = E.rising ? Math.min(1, base + 0.35 + 0.3 * Math.sin(now * 16)) : base;
    k.b.globalAlpha = Math.max(0, a); k.b.drawImage(lensGlow('A', C.bad), 0, 0); k.b.globalAlpha = 1;
  }
  if (E.layout === 'table' && !E.result) drawArCard(k, L, E, now, H);
  if (!E.ar && live && E.view === 'paper' && (E.scan > 0 || E.ai)) { // 안경 전 단계: 소매 속 초소형 액정 (lens 0은 허벅지 폰)
    const lx = 44, ly = 262, lw = 104, lh = 50, small = E.gear.lens >= 2;
    R(lx - 6, ly - 4, lw + 12, lh + 30, '#2f3e66'); R(lx - 2, ly - 2, lw + 4, lh + 4, '#0a0a0e'); R(lx, ly, lw, lh, '#0c1a12');
    T(small ? '소매 속 액정' : '허벅지 위 폰', lx + lw / 2, ly + lh + 12, 8, '#c9c4d8', 'center', 700);
    if (E.ai && !E.fb) { T(`답 ${q.aiPick + 1}번`, lx + lw / 2, ly + 17, 16, '#7dff9a', 'center', 800); T(`AI ${q.conf}%`, lx + lw / 2, ly + 38, 10, '#4ac27a', 'center', 800); }
    else if (!E.ai) { T('문제 전송 중…', lx + lw / 2, ly + 14, 9, '#4ac27a', 'center', 700); R(lx + 8, ly + 26, lw - 16, 4, '#143a24'); R(lx + 8, ly + 26, Math.round((lw - 16) * E.scan), 4, '#7dff9a');
      const st = Math.min(2, Math.floor(E.scan * 3 + 1e-6)); if (st > 0) T(`${q.elim.slice(0, st).map(i => i + 1).join('·')}번 아님`, lx + lw / 2, ly + 40, 9, '#7dff9a', 'center', 700); }
  }
  if (E.finalQ) { // 마지막 문제: 렌즈가 깨진다
    const n = Math.round(6 + E.glitch * 26);
    for (let i = 0; i < n; i++) { const h = Math.abs(Math.sin(i * 12.9898 + Math.floor(now * 18) * 78.233) * 43758.5453) % 1; k.b.globalAlpha = 0.25 + E.glitch * 0.4; R(Math.floor(((h * 13) % 1) * L.W) - 60, Math.floor(h * L.H), 60 + Math.floor(((h * 7) % 1) * 260), 1 + Math.floor(((h * 5) % 1) * 3), i % 3 === 0 ? '#ff3a8a' : i % 3 === 1 ? H.c : '#ffffff'); }
    k.b.globalAlpha = 1;
    if (E.ai && Math.floor(now * 3) % 2) T('ERR: 응답자 확인 불가', L.W / 2 + Math.round(Math.sin(now * 40) * 3), 52, 11, '#ff3a8a', 'center', 800);
  }
  if (E.ar && live && (onPaper || E.layout !== 'room') && E.scan > 0 && !E.ai && !E.fb) { // 스캔 진행 막대 (1/3, 2/3 눈금)
    const bx = 200, bw = 240, by = 34;
    R(bx - 1, by - 1, bw + 2, 5, '#0d2a30'); R(bx, by, bw, 3, H.c3); R(bx, by, Math.round(bw * E.scan), 3, H.c);
    for (const f of [1 / 3, 2 / 3]) R(bx + Math.round(bw * f) - 1, by - 2, 2, 7, '#0d2a30');
  }
  // 시험마다 다른 장치: 꼭 필요할 때만
  if (live && q && q.kind === 'listen' && !E.ai && !E.fb) {
    const has = E.gear.earbud > 0, txt = has ? `AI 이어폰이 받아쓰는 중 ${Math.round(E.listen * 100)}%` : '듣기 문항: AI 이어폰이 없어요 · 직접 고르기';
    const w = k.TW(txt, 11, 800) + 34, x = L.W / 2 - w / 2, y = 50;
    k.b.globalAlpha = 0.8; R(x, y - 9, w, 18, '#06161a'); k.b.globalAlpha = 1; k.frame(x, y - 9, w, 18, has ? H.c : C.warn, 1);
    R(x + 8, y - 3, 4, 6, has ? H.c : C.warn); R(x + 12, y - 5, 3, 10, has ? H.c : C.warn); // 스피커
    T(txt, x + 22, y, 11, has ? H.c : C.warn, 'left', 800);
    if (has) R(x + 2, y + 7, Math.round((w - 4) * E.listen), 1, H.c);
  }
  const cam = E.staff.find(s => s.type === 'webcam');
  if (cam && live) { // 원격 감독 웹캠 불
    const on = cam.phase === 'watch', tell = cam.phase === 'tell', blink = Math.floor(now * 8) % 2;
    const col = on ? C.bad : tell ? (blink ? C.warn : '#5a3a1a') : '#3a3340';
    k.b.globalAlpha = 0.8; R(L.W / 2 - 44, 46, 88, 16, '#0d0b13'); k.b.globalAlpha = 1;
    k.disc(L.W / 2 - 30, 54, 4, col); T(on ? '웹캠 LIVE' : tell ? '웹캠 ...' : '웹캠 꺼짐', L.W / 2 - 20, 54, 10, on ? C.bad : tell ? C.warn : '#8f89a3', 'left', 800);
  }
  const chk = E.staff.find(s => s.phase === 'check' && s.check && s.check.stage === 'at');
  if (chk && live) { // 감독관이 내 책상 앞에
    const off = E.gear.autooff > 0;
    k.b.globalAlpha = 0.35; R(0, 0, L.W, 26, '#1a0608'); k.b.globalAlpha = 1;
    TO(tier.check === 'calc' ? '계산기 검사 중! 스캔 금지' : '신분 확인 중! 스캔 금지', L.W / 2, 64, 13, C.bad);
    if (off) T(E.gear.autooff >= 2 ? '자동 소등: 렌즈 꺼짐 · 스캔 멈춤' : '자동 소등: 렌즈 꺼짐', L.W / 2, 80, 10, H.c, 'center', 800);
  }
  if (tier.mech.includes('human') && live) { // 인간 인증: AI 의심도
    const x = 24, y = 300, w = 120;
    T('AI 사용 감지', x, y - 10, 10, E.aiSus > 0.6 ? C.bad : '#c9c4d8', 'left', 800);
    R(x - 1, y - 1, w + 2, 6, '#0d0b13'); R(x, y, w, 4, '#3a2a30'); R(x, y, Math.round(w * E.aiSus), 4, E.aiSus > 0.6 ? C.bad : C.warn);
  }
  if (live && E.staff.some(s => s.phase === 'peek' && s.peek.stage === 'sneak') && E.gear.predict >= 2) { k.b.globalAlpha = Math.floor(now * 8) % 2 ? 0.9 : 0.4; TO('발소리가 사라졌다…', L.W / 2, 96, 12, C.warn); k.b.globalAlpha = 1; } // 시선 예측 2단계부터 경고
  if (E.flash && E.flash.t < 1.6) { const a = E.flash.t < 1.2 ? 1 : (1.6 - E.flash.t) / 0.4; k.b.globalAlpha = a; TO(E.flash.text, L.W / 2, 96, 14, E.flash.col || C.warn); k.b.globalAlpha = 1; }
  const sec = Math.max(0, Math.ceil(E.timeLeft));
  TO(E.finalQ ? '--:--' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, X.clock[0], X.clock[1], 12, E.timeLeft < 10 ? C.bad : H.c, 'right', '#0d2a30');
  if (tier.parts) T(tier.parts[E.part], X.clock[0] + 2, X.clock[1] + 14, 9, H.c2, 'right', 700);
  if (E.runShown) T(fmtRun(E.runShown), 48, 40, 10, H.c2, 'left', 700);
  if (E.ar) k.b.drawImage(rimFor('land'), 0, 0); // 안경테는 안경을 쓴 뒤부터
  drawExamOverlays(k, L, E, now, H);
}

function drawExamOverlays(k, L, E, now, H) {
  const { R, T, TO } = k, C = PAL, X = EXAM_LAYOUT, tier = E.T;
  if (E.result) return; // 결과는 책상 위 성적 통지표로 본다
  if (E.hint && !E.caught && !E.over) {
    const tw = k.TW(E.hint, 12, 800) + 20, y = X.hintY + 34;
    R(L.W / 2 - tw / 2, y - 10, tw, 20, C.white); k.frame(L.W / 2 - tw / 2, y - 10, tw, 20, C.ol, 1);
    T(E.hint, L.W / 2, y, 12, C.ink, 'center', 800);
  }
  if (E.showZones && E.view === 'front' && !E.caught && !E.over && E.start <= 0 && E.layout === 'room') {
    const zw = Math.round(L.W * X.zone);
    k.b.globalAlpha = 0.14; R(0, 0, zw, L.H, C.white); R(L.W - zw, 0, zw, L.H, C.white); k.b.globalAlpha = 1;
    if (Math.floor(now * 2) % 2 === 0) { TO('<', zw / 2 + 8, L.H / 2, 22, C.white); TO('>', L.W - zw / 2 - 8, L.H / 2, 22, C.white); }
  }
  if (E.breakT > 0 && !E.caught) {
    k.b.globalAlpha = 0.6; R(0, L.H / 2 - 34, L.W, 70, C.dark); k.b.globalAlpha = 1;
    TO('쉬는 시간', L.W / 2, L.H / 2 - 12, 22, C.white);
    T(`다음: ${tier.parts[E.part]} · ${Math.ceil(E.breakT)}`, L.W / 2, L.H / 2 + 14, 12, H.c, 'center', 800);
  }
  if (E.start > 0) {
    const notes = E.startNotes || [], h = 66 + notes.length * 16;
    k.b.globalAlpha = 0.6; R(0, L.H / 2 - 44, L.W, h, C.dark); k.b.globalAlpha = 1;
    TO(tier.boss ? '보스 시험' : tier.parts ? `시험 시작 · ${tier.parts[E.part]}` : '시험 시작', L.W / 2, L.H / 2 - 22, 22, tier.boss ? C.gold : C.white);
    T(`${tier.name} · 감독: ${[...new Set(tier.staff.map(s => s.name))].join(' · ')}`, L.W / 2, L.H / 2 + 4, 11, H.c, 'center', 700);
    notes.forEach((n, i) => T(n.text, L.W / 2, L.H / 2 + 22 + i * 16, 11, n.col || C.warn, 'center', 800));
  }
  if (E.over && !E.caught) TO(E.all ? '답안 제출' : '시험 종료', L.W / 2, L.H / 2, 26, E.all ? C.gold : C.warn);
  if (E.caught) {
    k.b.globalAlpha = 0.8; R(0, 0, L.W, L.H, '#170810'); k.b.globalAlpha = 1;
    const who = E.caughtBy || tier.staff[0];
    TO(E.T.mech.includes('tutorial') ? '걸렸다!' : '적발!', L.W / 2, L.H / 2 - 50, 44, C.bad);
    TO(CAUGHT_LINE[who.type] || CAUGHT_LINE.dean, L.W / 2, L.H / 2 + 2, 15, C.white);
    const why = { peek: '책상 밑에서 올려다보던 눈과 마주침', alert: '재난문자에 폰이 울림', emp: 'EMP에 기기가 드러남', cctv: 'CCTV에 찍힘', pulse: 'AI 탐지 전파에 걸림', drone: '드론 전파에 걸림', screen: '화면 검사에 걸림', check: '책상 앞 검사에 걸림',
      webcam: '웹캠에 찍힘', ai: 'AI 사용이 감지됨', omega: 'Ω가 스캔 박자를 읽음' }[E.caughtHow] || `${who.name}에게 걸림`;
    T(E.T.mech.includes('tutorial') ? `${why} · 혼나고 끝 (모의고사라 다행)` : `${why} · 이번 시험 0점`, L.W / 2, L.H / 2 + 30, 12, '#d6d2e0', 'center', 700);
  }
}
