// PROTOTYPE - NOT FOR PRODUCTION
// Question: 감독관 눈치를 보며 AI 안경으로 스캔하는 긴장감이, 장비와 시험이 함께 커지는 성장과 맞물려 엔딩까지 재밌나?
// Date: 2026-11-17
// 시험 중 안경 HUD(3D 화면 위에 겹치는 640x360 도트 층: 시계, 스캔 진행, 렌즈 가장자리 경고, 안내, 적발)와
// 3D 시험지에 그리는 종이(문제, 보기, 사인펜 마킹, 안경이 비추는 AR 표시: 지운 오답·AI 답·초점 틀).
'use strict';

const EXAM_LAYOUT = { W: 640, H: 360, zone: 0.17, clock: [592, 40], hintY: 22 };

// ---- 시험지 (3D 종이에 붙는 그림) ----
const PAPER_W = 720, PAPER_H = 1000;
const PAPER_HEAD = {
  univ: ['2026학년도 2학기 중간고사', '교양 국어'], toeic: ['TOEIC 정기시험', 'READING · Part 5'],
  history: ['제80회 한국사능력검정시험', '한국사 (심화)'], suneung: ['2026학년도 대학수학능력시험 문제지', '수학 영역'],
  civil: ['2026년도 국가공무원 9급 필기시험', '국어 · 한국사'], leet: ['2027학년도 법학적성시험 문제지', '추리논증'],
  tax: ['제63회 세무사 제2차 시험', '회계학 1부'], bar: ['제16회 변호사시험', '선택형 · 전 과목'],
};
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
function drawPaperTexture(g, E, now) {
  const F = FONT_KO, tier = CONFIG.tiers[E.tier], q = E.qs[Math.min(E.qi, E.qs.length - 1)], head = PAPER_HEAD[tier.id] || [tier.name, tier.subject];
  const ink = '#2a2838', cyan = '#2fd3dd';
  g.textBaseline = 'alphabetic'; g.fillStyle = '#f6f2e6'; g.fillRect(0, 0, PAPER_W, PAPER_H);
  g.fillStyle = ink; g.textAlign = 'center';
  let hs = 30; g.font = `800 ${hs}px ${F}`; while (g.measureText(head[0]).width > PAPER_W - 80 && hs > 20) { hs -= 2; g.font = `800 ${hs}px ${F}`; }
  g.fillText(head[0], PAPER_W / 2, 62);
  g.font = `800 30px ${F}`; const sw = g.measureText(head[1]).width + 48;
  g.lineWidth = 3; g.strokeStyle = ink; g.strokeRect(PAPER_W / 2 - sw / 2, 86, sw, 52); g.fillText(head[1], PAPER_W / 2, 123);
  g.font = `700 24px ${F}`; g.textAlign = 'right'; g.fillStyle = '#6c6a80'; g.fillText(`${E.qi + 1} / ${E.qs.length}`, PAPER_W - 44, 123);
  g.fillStyle = ink; g.fillRect(40, 164, PAPER_W - 80, 4); g.fillRect(40, 172, PAPER_W - 80, 1);
  // 문제: 길면 글자를 줄여서 네 줄 안에
  g.textAlign = 'left';
  let size = 50, lines = [];
  for (;;) { g.font = `800 ${size}px ${F}`; lines = wrapCanvas(g, `${E.qi + 1}. ${q.q}`, PAPER_W - 110); if (lines.length * (size + 14) <= 260 || size <= 30) break; size -= 4; }
  lines.slice(0, 6).forEach((ln, i) => g.fillText(ln, 56, 236 + i * (size + 14)));
  // 보기
  let cs = 54; g.font = `700 ${cs}px ${F}`;
  const widest = Math.max(...q.choices.map(c => g.measureText(c).width));
  if (widest > PAPER_W - 230) { cs = Math.max(30, Math.floor(cs * (PAPER_W - 230) / widest)); }
  q.choices.forEach((t, i) => {
    const y = PAPER_ROW(i), marked = E.answers[E.qi] === i;
    g.lineWidth = 3; g.strokeStyle = ink; g.beginPath(); g.arc(92, y - 18, 25, 0, 7); g.stroke();
    if (marked) { g.fillStyle = '#1c1c26'; g.beginPath(); g.arc(92, y - 18, 25, 0, 7); g.fill(); }
    g.fillStyle = marked ? '#f6f2e6' : ink; g.textAlign = 'center'; g.font = `800 30px ${F}`; g.fillText(String(i + 1), 92, y - 7);
    g.fillStyle = ink; g.textAlign = 'left'; g.font = `700 ${cs}px ${F}`; g.fillText(t, 140, y);
  });
  g.textAlign = 'center'; g.font = `700 24px ${F}`; g.fillStyle = '#6c6a80'; g.fillText(`- ${E.qi + 1} -`, PAPER_W / 2, PAPER_H - 26);
  if (E.start > 0) return;
  // 안경이 종이 위에 비추는 AR: 1/3, 2/3에서 지운 오답, 끝나면 AI가 고른 보기, 스캔 중엔 초점 틀
  const strikes = Math.min(2, q.pre ? 2 : Math.floor(E.scan * 3 + 1e-6));
  for (let j = 0; j < strikes; j++) {
    const i = q.elim[j], y = PAPER_ROW(i); g.font = `700 ${cs}px ${F}`; const tw = g.measureText(q.choices[i]).width;
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
}

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
  const X = EXAM_LAYOUT, C = PAL, { R, TO } = k;
  const live = E.start <= 0 && !E.over && !E.caught, onPaper = E.view === 'paper' && E.viewT >= 1;
  k.b.globalAlpha = 0.06; for (let y = 1; y < L.H; y += 3) R(0, y, L.W, 1, H.c); k.b.globalAlpha = 1; // 렌즈 스캔라인
  if (E.pulse && (E.pulse.warn > 0 || E.pulse.active > 0) && E.gear.jammer < 2) { // 탐지 전파: 렌즈에 잡음
    const strong = E.pulse.active > 0, n = strong ? 26 : 9;
    for (let i = 0; i < n; i++) {
      const hsh = Math.abs(Math.sin(i * 12.9898 + Math.floor(now * 30) * 78.233) * 43758.5453) % 1;
      k.b.globalAlpha = (strong ? 0.5 : 0.25) * (E.gear.jammer === 1 ? 0.5 : 1);
      R(Math.floor(((hsh * 13) % 1) * L.W), Math.floor(hsh * L.H), 30 + Math.floor(((hsh * 7) % 1) * (L.W * 0.6)), 1, strong ? C.bad : H.c);
    }
    k.b.globalAlpha = 1;
  }
  const pl = E.gear.predict; // 시선 예측: 그쪽 렌즈 가장자리가 경고 (3레벨부터 쳐다볼 때도 빨갛게)
  if (pl > 0 && live) {
    for (const sd of ['L', 'R']) {
      const st = E.staff.filter(s => s.side === sd && s.phase !== 'cross');
      if (pl >= 3 && st.some(s => s.phase === 'watch')) { k.b.globalAlpha = 0.75; k.b.drawImage(lensGlow(sd, C.bad), 0, 0); }
      else if (st.some(s => s.phase === 'tell')) { k.b.globalAlpha = Math.floor(now * 6) % 2 ? 0.85 : 0.45; k.b.drawImage(lensGlow(sd, C.warn), 0, 0); }
      k.b.globalAlpha = 1;
    }
  }
  if (E.sus > 0.02 || E.rising) { // 의심도: 렌즈 둘레가 붉어지고, 보는 중에 스캔하면 깜빡인다
    const base = Math.min(0.85, 0.12 + E.sus * 0.9), a = E.rising ? Math.min(1, base + 0.35 + 0.3 * Math.sin(now * 16)) : base;
    k.b.globalAlpha = Math.max(0, a); k.b.drawImage(lensGlow('A', C.bad), 0, 0); k.b.globalAlpha = 1;
  }
  if (live && onPaper && E.scan > 0 && !E.ai && !E.fb) { // 스캔 진행 막대 (1/3, 2/3 눈금)
    const bx = 200, bw = 240, by = 34;
    R(bx - 1, by - 1, bw + 2, 5, '#0d2a30'); R(bx, by, bw, 3, H.c3); R(bx, by, Math.round(bw * E.scan), 3, H.c);
    for (const f of [1 / 3, 2 / 3]) R(bx + Math.round(bw * f) - 1, by - 2, 2, 7, '#0d2a30');
  }
  const sec = Math.max(0, Math.ceil(E.timeLeft));
  TO(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, X.clock[0], X.clock[1], 12, E.timeLeft < 10 ? C.bad : H.c, 'right', '#0d2a30');
  k.b.drawImage(rimFor('land'), 0, 0);
  drawExamOverlays(k, L, E, now, H);
}

function drawExamOverlays(k, L, E, now, H) {
  const { R, T, TO } = k, C = PAL, X = EXAM_LAYOUT, tier = CONFIG.tiers[E.tier];
  if (E.hint && !E.caught && !E.over) {
    const tw = k.TW(E.hint, 12, 800) + 20, y = X.hintY + 34;
    R(L.W / 2 - tw / 2, y - 10, tw, 20, C.white); k.frame(L.W / 2 - tw / 2, y - 10, tw, 20, C.ol, 1);
    T(E.hint, L.W / 2, y, 12, C.ink, 'center', 800);
  }
  if (E.showZones && E.view === 'paper' && !E.caught && !E.over && E.start <= 0) {
    const zw = Math.round(L.W * X.zone);
    k.b.globalAlpha = 0.14; R(0, 0, zw, L.H, C.white); R(L.W - zw, 0, zw, L.H, C.white); k.b.globalAlpha = 1;
    if (Math.floor(now * 2) % 2 === 0) { TO('<', zw / 2 + 8, L.H / 2, 22, C.white); TO('>', L.W - zw / 2 - 8, L.H / 2, 22, C.white); }
  }
  if (E.start > 0) {
    k.b.globalAlpha = 0.55; R(0, L.H / 2 - 40, L.W, 84, C.dark); k.b.globalAlpha = 1;
    TO('시험 시작', L.W / 2, L.H / 2 - 16, 24, C.white);
    T(`${tier.name} · 감독: ${tier.staff.map(s => s.name).join(' · ')}`, L.W / 2, L.H / 2 + 12, 11, H.c, 'center', 700);
    if (tier.noAuto) T('AI 감독관이 이어폰·자동 스캔을 막는다', L.W / 2, L.H / 2 + 28, 11, C.bad, 'center', 800);
  }
  if (E.over && !E.caught) TO(E.all ? '답안 제출' : '시험 종료', L.W / 2, L.H / 2, 26, E.all ? C.gold : C.warn);
  if (E.caught) {
    k.b.globalAlpha = 0.8; R(0, 0, L.W, L.H, '#170810'); k.b.globalAlpha = 1;
    const who = E.caughtBy || tier.staff[0];
    TO('적발!', L.W / 2, L.H / 2 - 50, 44, C.bad);
    TO(CAUGHT_LINE[who.type], L.W / 2, L.H / 2 + 2, 15, C.white);
    const why = E.caughtHow === 'cctv' ? 'CCTV에 찍힘' : E.caughtHow === 'pulse' ? 'AI 탐지 전파에 걸림' : `${who.name}에게 걸림`;
    T(`${why} · 이번 시험 0점`, L.W / 2, L.H / 2 + 30, 12, '#d6d2e0', 'center', 700);
  }
}
