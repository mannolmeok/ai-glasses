// PROTOTYPE - NOT FOR PRODUCTION
// Question: 감독관 눈치를 보며 AI 안경으로 스캔하는 긴장감이, 장비와 시험이 함께 커지는 성장과 맞물려 엔딩까지 재밌나?
// Date: 2026-11-17
// 게임 규칙·장면·경제·저장·옆 패널. 스타터의 점검 고리(고정 스텝, 시계, window.game, play·figures 장면)를 그대로 둔다.
'use strict';

// ---- Built to be checked ----------------------------------------------------------------
const params = new URLSearchParams(location.search);
const tune = new Proxy({}, { get: (_, k) => CONFIG[k].value }); // live: tune.scan_time is CONFIG.scan_time.value
const STEP = 1 / 60;            // simulation step in seconds; motion is per second, never per frame
const PIXEL = true;             // pixel look: whole-number buffer, no smoothing
const FONT = FONT_KO;
const TITLE = 'AI 안경';
const CONTROLS = ['화면 양옆 꾹 / ← →: 고개 돌리기', '가운데 꾹 / Space: AI 스캔', '보기 누르기 / 1~4: 마킹', 'P: 일시정지', 'M: 소리'];
const clock = window.GAME_CLOCK || { now: () => performance.now() / 1000 }; // a check may inject one
const CHEAP = params.get('render') === 'cheap';
let seed;
function rng() { // mulberry32; every gameplay random call reads this, never Math.random
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const events = []; // window.game.events
function loop(step) { events.push({ kind: 'loop', step }); } // the core loop's beats, for the check
const FORCE_VIEW = params.get('view'); // check only: hold the head turned (left|right) for a screenshot
let scene = 'title', state, G, E = null, RZ = null, now = 0;
const STATE = { shown: 0, pops: [], wipeArm: 0, away: null, tab: params.get('tab') || 'exams', note: null };

// ---- Numbers ---------------------------------------------------------------------------
function won(n) { // 큰 숫자는 한국식 단위로 짧게
  n = Math.floor(n);
  const t = x => (x >= 100 ? String(Math.floor(x)) : x.toFixed(x >= 10 ? 1 : 2).replace(/\.?0+$/, ''));
  if (n >= 1e20) return t(n / 1e20) + '해';
  if (n >= 1e16) return t(n / 1e16) + '경';
  if (n >= 1e12) return t(n / 1e12) + '조';
  if (n >= 1e8) return t(n / 1e8) + '억';
  if (n >= 1e4) return Math.floor(n / 1e4).toLocaleString('ko-KR') + '만';
  return n.toLocaleString('ko-KR');
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- Economy ---------------------------------------------------------------------------
function gearDef(id) { return CONFIG.gear.find(g => g.id === id); }
function gearCost(id, lv = G.gear[id]) { const d = gearDef(id); return Math.ceil(d.base * Math.pow(d.grow, lv) * tune.cost_scale); }
function examFee(tier) { return Math.round((tier.fee || 0) * tune.fee_scale); }
function scanSecondsAt(lv) { return tune.scan_time / (1 + tune.lens_bonus * lv); }
function bestReward() { let r = 0; G.cleared.forEach((c, i) => { if (c) r = Math.max(r, CONFIG.tiers[i].reward); }); return r * tune.reward_scale; }
function botMult(lv) { return Math.pow(2, CONFIG.bot_milestones.filter(m => lv >= m).length); }
function botRateAt(lv) { return lv * tune.bot_rate * bestReward() * botMult(lv); }
function botRate() { return botRateAt(G.gear.bot); }
function earbudNeedAt(lv) { return Math.max(50, tune.earbud_threshold - tune.earbud_step * (lv - 1)); }
function autoDelayAt(lv) { return tune.autoscan_delay / Math.pow(2, Math.max(0, lv - 1)); }
function jamFactor(lv) { return lv >= 2 ? 0 : lv === 1 ? 1 - tune.jam_cut : 1; }
function coachMult(lv = G.gear.coach) { return 1 + lv * tune.coach_bonus; }
function aiAccuracy(tier) { return clamp(tune.ai_base - tune.ai_drop * Math.max(0, tier.ai - G.gear.model), tune.ai_floor, 0.99); }
function nextTierIndex(g = G) { const i = g.cleared.findIndex(c => !c); return i < 0 ? CONFIG.tiers.length - 1 : Math.min(i, g.unlocked - 1); }
function addMoney(v, tag, text, col) {
  if (!(v > 0)) return;
  G.money += v; G.stats.earned += v;
  if (tag) STATE.pops.push({ v, t: 0, scene: tag, text, col });
}

// ---- Save ------------------------------------------------------------------------------
const SAVE_KEY = 'ai-glasses-save-v2';
function newGame() {
  const gear = {}; for (const g of CONFIG.gear) gear[g.id] = 0;
  return { v: 2, money: 0, gear, unlocked: 1, cleared: CONFIG.tiers.map(() => false), best: CONFIG.tiers.map(() => 0),
    ended: false, endSeen: false, stats: { exams: 0, caught: 0, passes: 0, fails: 0, tops: 0, selfQ: 0, aiQ: 0, playT: 0, earned: 0, fees: 0 }, hints: {}, last: 0 };
}
function save() { try { G.last = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (_) { } }
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
    const s = JSON.parse(raw), g = newGame();
    Object.assign(g, s); g.gear = Object.assign(newGame().gear, s.gear || {}); g.stats = Object.assign(newGame().stats, s.stats || {});
    return g;
  } catch (_) { return null; }
}
function awayEarnings() { // 저장해 둔 마지막 시각과 지금의 차이만큼 봇이 번 돈 (불러올 때 한 번)
  if (!G.last || !(G.gear.bot > 0)) return;
  const secs = clamp((Date.now() - G.last) / 1000, 0, tune.away_cap);
  const gain = Math.floor(botRate() * secs * tune.away_rate);
  if (secs > 30 && gain >= 1) { addMoney(gain); STATE.away = { gain, secs, t: 0 }; }
}

// ---- Screen: 3D(world3d.js) 위에 640x360 HUD 층. 가로 한 가지, 모바일 세로는 "가로로 돌려 주세요" ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const worldCanvas = document.getElementById('world');
WORLD.init(worldCanvas);
let BUF = null;
function buffer() {
  if (!BUF) {
    const L = LAYOUTS.land, c = document.createElement('canvas'); c.width = L.W; c.height = L.H;
    const k = makeKit(c.getContext('2d'));
    k.pat = { bad: k.dither(PAL.bad, 0.85), warn: k.dither(PAL.warn, 0.7), faint: k.dither('#ffffff', 0.35), faintRed: k.dither(PAL.bad, 0.3) };
    BUF = { c, k, L, key: 'land' };
  }
  return BUF;
}
const rotateMQ = window.matchMedia ? matchMedia('(orientation: portrait) and (pointer: coarse)') : { matches: false };
function needRotate() { return rotateMQ.matches; }
let fitSig = '';
function fit() {
  if (document.body.dataset.scene !== scene) document.body.dataset.scene = scene;
  const B = buffer(), stage = document.getElementById('stage'), screen = document.getElementById('screen');
  const sw = stage.clientWidth, sh = stage.clientHeight, dpr = devicePixelRatio || 1;
  const sig = sw + 'x' + sh + '|' + dpr;
  if (sig === fitSig) return;
  fitSig = sig;
  const s = Math.max(0.1, Math.min(sw / B.L.W, sh / B.L.H));
  const k = Math.max(1, Math.ceil(s * dpr - 0.01));
  canvas.width = B.L.W * k; canvas.height = B.L.H * k;
  screen.style.width = Math.floor(B.L.W * s) + 'px'; screen.style.height = Math.floor(B.L.H * s) + 'px';
  canvas.style.imageRendering = Math.abs(s * dpr - Math.round(s * dpr)) < 0.01 ? 'pixelated' : 'auto';
}
addEventListener('resize', () => { fitSig = ''; });
function hudSet() { const h = PAL.hud; return { c: h, c2: mix(h, '#0d0b13', 0.3), c3: mix(h, '#0d0b13', 0.78) }; }

// ---- Input: keys by position (event.code), OS key repeat ignored ------------------------
const down = new Set(), hit = new Set();
const pressed = code => hit.has(code); // true for one step after the key goes down
let lastLookKey = null;
addEventListener('keydown', e => {
  startAudio();
  if (e.target && e.target.closest && e.target.closest('#sheet') && (e.code === 'Space' || e.code === 'Enter')) return; // 창 안의 버튼은 창이 처리
  if (!e.repeat) {
    down.add(e.code); hit.add(e.code);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') lastLookKey = 'left';
    if (e.code === 'ArrowRight' || e.code === 'KeyD') lastLookKey = 'right';
  }
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => down.delete(e.code));
// 포인터: 누른 자리로 왼쪽·가운데·오른쪽을 정한다. 양옆을 누르고 있으면 고개를 돌리고,
// 가운데를 누르고 있으면 스캔, 가운데를 짧게 톡 치면 그 자리 보기에 마킹.
const ptr = { taps: [] }, ptrs = new Map();
let releases = [];
function toBuf(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * EXAM_LAYOUT.W, (e.clientY - r.top) / r.height * EXAM_LAYOUT.H]; }
canvas.addEventListener('pointerdown', e => {
  startAudio();
  const [x, y] = toBuf(e), W = EXAM_LAYOUT.W, z = EXAM_LAYOUT.zone;
  ptr.taps.push([x, y]);
  ptrs.set(e.pointerId, { x, y, t0: performance.now() / 1000, moved: 0, zone: x < W * z ? 'L' : x > W * (1 - z) ? 'R' : 'C' });
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
  const [x, y] = toBuf(e); STATE.hover = [x, y];
  const p = ptrs.get(e.pointerId); if (p) p.moved = Math.max(p.moved, Math.hypot(x - p.x, y - p.y));
});
canvas.addEventListener('pointerleave', () => { STATE.hover = null; });
const ptrUp = e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  ptrs.delete(e.pointerId);
  if (e.type === 'pointerup' && p.zone === 'C' && performance.now() / 1000 - p.t0 < 0.22 && p.moved < 14) releases.push([p.x, p.y]);
};
canvas.addEventListener('pointerup', ptrUp); canvas.addEventListener('pointercancel', ptrUp);
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => { down.clear(); ptrs.clear(); });
function takeTaps() { const t = ptr.taps; ptr.taps = []; return t; }
function takeReleases() { const r = releases; releases = []; return r; }
function hitBtn(btns, x, y) { return (btns || []).find(b => x >= b.x && x <= b.x + b.w && y >= b.y - 2 && y <= b.y + b.h + 2); }
function lookWanted() {
  if (FORCE_VIEW === 'left' || FORCE_VIEW === 'right') return FORCE_VIEW;
  let best = null;
  for (const p of ptrs.values()) if ((p.zone === 'L' || p.zone === 'R') && (!best || p.t0 > best.t0)) best = p;
  if (best) return best.zone === 'L' ? 'left' : 'right';
  const l = down.has('ArrowLeft') || down.has('KeyA'), r = down.has('ArrowRight') || down.has('KeyD');
  if (l && r) return lastLookKey || 'left';
  return l ? 'left' : r ? 'right' : 'paper';
}
function scanPointer() { for (const p of ptrs.values()) if (p.zone === 'C') return true; return false; }

// ---- Audio: started on first input, mute on M --------------------------------------------
let audio = null, muted = false;
function startAudio() {
  try {
    if (!audio) {
      const ac = window.GAME_AUDIO || new (window.AudioContext || window.webkitAudioContext)(); // a check may inject one
      const out = ac.createGain(); out.gain.value = muted ? 0 : tune.volume;
      out.connect(ac.destination); audio = { ac, out };
    }
    if (audio.ac.state === 'suspended') audio.ac.resume();
  } catch (_) { }
}
function setMuted(m) { muted = m; if (audio) audio.out.gain.value = m ? 0 : tune.volume; renderPanel(); }
addEventListener('tune', () => setMuted(muted));
function toneAt(freq, dur, type = 'square', vol = 0.3, delay = 0, pan = 0) {
  if (!audio || muted) return;
  try {
    const t = audio.ac.currentTime + delay, o = audio.ac.createOscillator(), g = audio.ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); let tail = g;
    if (pan && audio.ac.createStereoPanner) { const p = audio.ac.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
    tail.connect(audio.out); o.start(t); o.stop(t + dur + 0.02);
  } catch (_) { }
}
function tone(freq, dur, type = 'square', vol = 0.3) { toneAt(freq, dur, type, vol, 0); }
const sfx = {
  scan: () => tone(1500, 0.02, 'square', 0.02),
  elim: () => { toneAt(980, 0.03, 'square', 0.06); toneAt(740, 0.05, 'square', 0.05, 0.03); },
  ai: () => { toneAt(1320, 0.07, 'square', 0.1); toneAt(1760, 0.09, 'square', 0.1, 0.07); },
  pencil: () => { for (let i = 0; i < 3; i++) toneAt(2600 - i * 300, 0.025, 'sawtooth', 0.025, i * 0.035); },
  flip: () => { toneAt(420, 0.05, 'triangle', 0.05); toneAt(620, 0.04, 'triangle', 0.04, 0.04); },
  turn: () => toneAt(180, 0.06, 'triangle', 0.04),
  foot: (pan, vol) => { toneAt(92, 0.045, 'square', vol, 0, pan); toneAt(70, 0.05, 'triangle', vol * 0.8, 0.02, pan); },
  beat: vol => { toneAt(58, 0.09, 'sine', vol); toneAt(52, 0.1, 'sine', vol * 0.8, 0.13); },
  cctv: () => { toneAt(2200, 0.02, 'square', 0.03, 0, 0.8); toneAt(1800, 0.03, 'square', 0.03, 0.05, 0.8); },
  beep: () => tone(980, 0.06, 'square', 0.08),
  pulse: () => { toneAt(300, 0.4, 'sine', 0.16); toneAt(240, 0.3, 'sine', 0.12, 0.1); },
  caught: () => { for (let i = 0; i < 4; i++) toneAt(i % 2 ? 660 : 880, 0.16, 'square', 0.15, i * 0.17); },
  pass: () => { [523, 659, 784, 1046].forEach((f, i) => toneAt(f, 0.14, 'square', 0.12, i * 0.1)); },
  top: () => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => toneAt(f, 0.16, 'square', 0.12, i * 0.09)); toneAt(2093, 0.5, 'triangle', 0.1, 0.6); },
  fail: () => { [392, 349, 311].forEach((f, i) => toneAt(f, 0.22, 'triangle', 0.15, i * 0.2)); },
  buy: () => { toneAt(1046, 0.05, 'square', 0.1); toneAt(1568, 0.08, 'square', 0.1, 0.05); },
  no: () => { toneAt(220, 0.08, 'square', 0.08); toneAt(180, 0.1, 'square', 0.08, 0.08); },
  bell: () => { toneAt(880, 0.3, 'sine', 0.15); toneAt(660, 0.4, 'sine', 0.15, 0.25); },
};

// ---- Exam ------------------------------------------------------------------------------
function procDur(range) { return (range[0] + rng() * (range[1] - range[0])) * tune.proctor_pace; }
function makeStaff(T, ti) { // 감독관은 왼쪽·오른쪽 통로를 나눠 맡고, 가끔 반대편으로 건너간다
  return T.staff.map((d, i) => ({ type: d.type, name: d.name, side: i % 2 ? 'R' : 'L', u: 0.2 + rng() * 0.6, dir: rng() < 0.5 ? -1 : 1,
    phase: 'stand', t: 0, dur: procDur(T.stand) + (ti === 0 ? 1.5 : 0) + i * 0.7, walk: 0, stepT: 0, away: rng() < 0.5, from: null }));
}
function startExam(ti) {
  ti = clamp(ti, 0, G.unlocked - 1);
  const T = CONFIG.tiers[ti], fee = examFee(T);
  if (G.money < fee) { sfx.no(); STATE.note = { text: `응시료 ${won(fee)}원이 모자라요`, t: 0 }; return false; }
  G.money -= fee; G.stats.fees += fee; STATE.shown = Math.min(STATE.shown, G.money);
  const qs = makeQuestions(rng, T), p = aiAccuracy(T), firstEver = ti === 0 && G.stats.exams === 0;
  for (const q of qs) { // AI의 판단: 맞으면 정답, 틀리면 오답 하나. 스캔 중에 지우는 두 보기는 언제나 오답 (맨 첫 시험은 AI가 다 맞힌다)
    const roll = rng(), right = firstEver || roll < p, wrongs = [0, 1, 2, 3].filter(i => i !== q.answer);
    q.aiPick = right ? q.answer : wrongs[Math.floor(rng() * 3)];
    const rest = wrongs.filter(i => i !== q.aiPick);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    q.elim = rest.slice(0, 2);
    q.conf = clamp(Math.round(p * 100 + (rng() - 0.5) * 8), 30, 99);
  }
  const total = T.time * tune.time_scale + G.gear.watch * tune.watch_bonus, first = ti === 0 && G.stats.exams === 0;
  E = { tier: ti, T, qs, qi: 0, answers: [], via: [], selfN: 0, aiN: 0, fee, timeLeft: total, timeTotal: total, sus: 0,
    caught: false, caughtBy: null, caughtHow: null, over: false, all: false, endT: 0, start: 1.4,
    holding: false, autoHolding: false, rising: false, scan: 0, ai: false, fb: null, earbudT: 0, unsafeT: 0, tick: 0, beat: 0,
    danger: false, hint: null, gear: G.gear, view: 'paper', prevView: 'paper', viewT: 1, looks: 0, showZones: first && !G.hints.look,
    staff: makeStaff(T, ti),
    cctv: T.sec.includes('cctv') ? { ph: rng() * 6.28, a: 1, on: false } : null,
    pulse: T.sec.includes('pulse') ? { next: 3 + rng() * 3, warn: 0, active: 0 } : null };
  ptrs.clear(); releases = []; closeSheet();
  scene = 'play'; renderPanel();
  events.push({ type: 'exam', tier: ti, fee });
  return true;
}
function setPhase(s, ph, dur) { s.phase = ph; s.t = 0; s.dur = dur; }
function footstep(s) {
  let pan = s.side === 'L' ? -0.75 : 0.75;
  if (s.phase === 'cross') pan = (s.from === 'L' ? -0.75 : 0.75) * (1 - 2 * clamp(s.t / s.dur, 0, 1));
  const near = 1 - Math.min(1, Math.abs(s.u - 0.5) * 1.6);
  sfx.foot(pan, 0.04 + 0.08 * near);
}
function stepStaff(s, T, dt) {
  s.t += dt;
  if (s.phase === 'walk' || s.phase === 'cross') { // 걸을 때만 발소리가 난다
    s.walk += dt; s.stepT += dt;
    if (s.phase === 'walk') {
      s.u += s.dir * T.speed * tune.proctor_speed * dt;
      if (s.u < 0.06) { s.u = 0.06; s.dir = 1; } else if (s.u > 0.94) { s.u = 0.94; s.dir = -1; }
    }
    if (s.stepT >= tune.footstep_gap) { s.stepT = 0; footstep(s); }
  }
  if (s.t < s.dur) return;
  const r = rng(), tell = T.tell + G.gear.predict * tune.predict_bonus;
  if (s.phase === 'stand') {
    if (r < 0.38) setPhase(s, 'tell', tell);
    else if (r < 0.38 + 0.62 * T.cross) { // 가까운 끝(앞·뒤)까지 걸어가서 반대편 통로로 건너간다
      s.from = s.side; s.crossEnd = s.u > 0.42 ? 'front' : 'back';
      const along = Math.abs((s.crossEnd === 'front' ? 0.94 : 0.06) - s.u), across = 0.22;
      s.crossSplit = along / (along + across); setPhase(s, 'cross', (along + across) / Math.max(0.05, T.speed * tune.proctor_speed));
    }
    else { setPhase(s, 'walk', procDur(T.walk)); if (rng() < 0.5) s.dir *= -1; }
  } else if (s.phase === 'walk') {
    if (r < 0.5) setPhase(s, 'tell', tell);
    else { setPhase(s, 'stand', procDur(T.stand)); s.away = rng() < 0.5; }
  } else if (s.phase === 'tell') {
    if (r < T.feint) { setPhase(s, 'stand', procDur(T.stand) * 0.6); s.away = rng() < 0.5; }
    else { setPhase(s, 'watch', T.watch); if (E && E.tier === 0) G.hints.tell = true; }
  } else if (s.phase === 'watch') {
    if (r < 0.5) { setPhase(s, 'stand', procDur(T.stand)); s.away = rng() < 0.5; }
    else { setPhase(s, 'walk', procDur(T.walk)); s.dir = rng() < 0.5 ? -1 : 1; }
  } else if (s.phase === 'cross') {
    s.side = s.side === 'L' ? 'R' : 'L'; s.u = s.crossEnd === 'back' ? 0.06 : 0.94; s.dir = s.u > 0.5 ? -1 : 1; s.from = null;
    setPhase(s, 'stand', procDur(T.stand)); s.away = rng() < 0.5;
  }
}
function stepCctv(c, dt) {
  const was = c.on;
  c.ph += dt * Math.PI * 2 / tune.cctv_period; c.a = Math.sin(c.ph); c.on = Math.abs(c.a) < 0.28;
  if (c.on && !was && G.gear.cctvjam < 2) sfx.cctv();
}
function stepPulse(p, dt) {
  if (p.active > 0) { p.active -= dt; return; }
  if (p.warn > 0) {
    const before = Math.ceil(p.warn); p.warn -= dt;
    if (p.warn <= 0) { p.warn = 0; p.active = 0.6; sfx.pulse(); }
    else if (Math.ceil(p.warn) !== before) sfx.beep();
    return;
  }
  p.next -= dt;
  if (p.next <= 0) { p.warn = 1.6; p.next = tune.pulse_gap * (0.7 + rng() * 0.6); sfx.beep(); }
}
function threatRate() { // 지금 스캔하면 초당 오르는 의심도
  const T = E.T, g = G.gear, base = T.sus * tune.sus_scale;
  let r = 0;
  for (const s of E.staff) { if (s.phase === 'watch') r += base; else if (s.phase === 'tell') r += base * tune.tell_ratio; }
  if (E.cctv && E.cctv.on) r += base * tune.cctv_rate * jamFactor(g.cctvjam);
  r *= Math.pow(1 - tune.stealth_cut, g.stealth);
  if (E.pulse && E.pulse.active > 0) r += tune.pulse_rate * jamFactor(g.jammer);
  return r;
}
function markAnswer(i, how) { // 정답인지는 시험이 끝날 때까지 모른다
  if (!E || E.fb || E.caught || E.over || E.start > 0 || i < 0 || i > 3) return;
  if (how !== 'auto' && (E.view !== 'paper' || E.viewT < 1)) return; // 시험지를 보고 있어야 마킹
  const q = E.qs[E.qi], viaAI = how === 'auto' || (E.ai && i === q.aiPick);
  E.answers[E.qi] = i; E.via[E.qi] = how === 'auto' ? 'auto' : viaAI ? 'ai' : 'self';
  E.fb = { pick: i, t: 0, how };
  if (viaAI) { E.aiN++; G.stats.aiQ++; } else { E.selfN++; G.stats.selfQ++; }
  G.hints.pick = true;
  sfx.pencil();
  events.push({ type: 'mark', q: E.qi, pick: i, how }); loop('act');
}
function completeScan() {
  E.scan = 1; E.ai = true; E.earbudT = 0; G.hints.scan = true; sfx.ai();
  for (let j = 1; j <= G.gear.wide; j++) { const nq = E.qs[E.qi + j]; if (nq) nq.pre = true; } // 광각 렌즈: 다음 문제도 미리 읽음
  events.push({ type: 'scan', q: E.qi });
}
function nextQuestion() {
  E.fb = null; E.scan = 0; E.ai = false; E.earbudT = 0; E.unsafeT = 0;
  if (E.qi + 1 >= E.qs.length) { E.over = true; E.all = true; E.endT = 0; return; }
  E.qi++; sfx.flip();
  if (E.qs[E.qi].pre) { E.scan = 1; E.ai = true; }
}
function getCaught() {
  E.caught = true; E.endT = 0; G.stats.caught++; ptrs.clear();
  const w = E.staff.find(s => s.phase === 'watch') || E.staff.find(s => s.phase === 'tell');
  if (w) { E.caughtBy = w; E.caughtHow = 'watch'; }
  else { E.caughtBy = E.T.staff[0]; E.caughtHow = E.cctv && E.cctv.on ? 'cctv' : 'pulse'; }
  sfx.caught(); events.push({ type: 'caught', how: E.caughtHow });
}
function examHint() { // 첫 시험에서만, 한 번에 하나
  if (E.tier !== 0 || G.stats.exams > 0) return null;
  if (E.rising) return '누가 보고 있어요! 손 떼기';
  if (!G.hints.look) return '화면 양옆을 꾹: 고개 돌려 감독관 보기 (← →)';
  if (E.view !== 'paper') return G.hints.back ? null : '나를 정면으로 보면 위험. 손을 떼면 시험지로';
  if (!E.ai && !G.hints.scan) return E.holding ? null : '안 볼 때 가운데를 꾹: AI 스캔 (Space)';
  if (E.ai && !E.fb && !G.hints.pick) return 'AI가 고른 보기를 눌러 마킹 (1~4)';
  return null;
}
function updateExam(dt) {
  const T = E.T, g = G.gear;
  takeTaps();
  if (E.caught || E.over) { E.endT += dt; takeReleases(); if (E.endT > (E.caught ? 2.0 : 0.9)) finishExam(); return; }
  if (pressed('KeyP') || pressed('Escape')) { scene = 'pause'; return; }
  // 고개 돌리기 (돌아보는 것만으로는 의심받지 않는다)
  const want = E.start > 0 ? 'paper' : lookWanted();
  if (want !== E.view) {
    if (want === 'paper' && E.view !== 'paper' && E.looks > 0) G.hints.back = true;
    E.prevView = E.view; E.view = want; E.viewT = 0; sfx.turn();
    if (want !== 'paper') { E.looks++; G.hints.look = true; E.showZones = false; }
  }
  E.viewT = Math.min(1, E.viewT + dt / tune.look_time);
  const onPaper = E.view === 'paper' && E.viewT >= 1;
  for (const [x, y] of takeReleases()) { const i = WORLD.pickChoice(x, y); if (i >= 0) markAnswer(i, 'tap'); }
  for (let i = 0; i < 4; i++) if (pressed('Digit' + (i + 1)) || pressed('Numpad' + (i + 1))) markAnswer(i, 'key');
  if (E.start > 0) { E.start -= dt; E.holding = false; E.hint = null; return; }
  E.timeLeft -= dt;
  if (E.timeLeft <= 0) { E.timeLeft = 0; E.over = true; E.endT = 0; sfx.bell(); return; }
  for (const s of E.staff) stepStaff(s, T, dt);
  if (E.cctv) stepCctv(E.cctv, dt);
  if (E.pulse) stepPulse(E.pulse, dt);
  const q = E.qs[E.qi], threat = threatRate();
  E.danger = threat > 0.02;
  const manual = onPaper && (down.has('Space') || scanPointer());
  let autoHold = false;
  if (g.autoscan > 0 && !T.noAuto && onPaper && !E.ai && !E.fb) { // 자동 스캔 칩: 아무도 안 볼 때 알아서
    const safe = threat === 0 && !(E.pulse && E.pulse.warn > 0 && E.pulse.warn < 0.45);
    if (safe) E.unsafeT = 0; else E.unsafeT += dt;
    autoHold = safe || E.unsafeT < autoDelayAt(g.autoscan);
  }
  const hold = (manual || autoHold) && !E.ai && !E.fb;
  E.holding = hold; E.autoHolding = autoHold && !manual;
  E.rising = hold && threat > 0;
  if (E.rising) E.sus += threat * dt; else E.sus -= tune.sus_decay * dt;
  E.sus = clamp(E.sus, 0, 1);
  if (E.sus >= 1) { getCaught(); return; }
  if (hold) { // 스캔: 1/3, 2/3에서 오답이 하나씩 지워지고, 끝나면 AI의 답
    const before = Math.floor(E.scan * 3 + 1e-6);
    E.scan += dt / scanSecondsAt(g.lens);
    E.tick += dt; if (E.tick > 0.12) { E.tick = 0; sfx.scan(); }
    if (E.scan >= 1) completeScan();
    else if (Math.floor(E.scan * 3 + 1e-6) > before) sfx.elim();
  }
  if (E.ai && !E.fb && g.earbud > 0 && !T.noAuto && q.conf >= earbudNeedAt(g.earbud)) { E.earbudT += dt; if (E.earbudT >= tune.earbud_delay) markAnswer(q.aiPick, 'auto'); }
  if (E.fb) { E.fb.t += dt; if (E.fb.t >= 0.35) nextQuestion(); }
  if (E.sus > 0.3) { E.beat -= dt; if (E.beat <= 0) { E.beat = 1 - 0.55 * E.sus; sfx.beat(0.08 + 0.12 * E.sus); } } else E.beat = 0;
  E.hint = examHint();
}
function finishExam() {
  const T = E.T, qn = E.qs.length, pass = Math.round(tune.pass_mark * 100);
  const marks = E.qs.map((q, i) => E.answers[i] == null ? { r: '-' } : { r: E.answers[i] === q.answer ? 'O' : 'X', via: E.via[i] });
  const correct = marks.filter(m => m.r === 'O').length, score = Math.round(correct / qn * 100);
  const passed = !E.caught && correct / qn >= tune.pass_mark - 1e-9, perfect = passed && correct === qn;
  const bonus = passed ? tune.time_bonus * (E.timeLeft / E.timeTotal) : 0, coach = passed ? coachMult() : 1;
  const reward = passed ? Math.round(correct * T.reward * tune.reward_scale * (1 + bonus) * coach * (perfect ? tune.jackpot_mult : 1)) : 0;
  G.stats.exams++; if (passed) G.stats.passes++; else if (!E.caught) G.stats.fails++; if (perfect) G.stats.tops++;
  let unlock = '';
  if (passed) {
    const first = !G.cleared[E.tier];
    G.cleared[E.tier] = true; G.best[E.tier] = Math.max(G.best[E.tier], score);
    if (E.tier + 1 < CONFIG.tiers.length && G.unlocked < E.tier + 2) { G.unlocked = E.tier + 2; unlock = `다음 시험 접수 가능: ${CONFIG.tiers[E.tier + 1].name}`; }
    const ng = first ? CONFIG.gear.filter(d => d.need === E.tier + 1).map(d => d.name) : [];
    if (ng.length) unlock += (unlock ? ' · ' : '') + '새 장비 ' + ng.length + '종';
  }
  addMoney(reward); loop('result'); if (reward > 0) loop('reward');
  const final = passed && E.tier === CONFIG.tiers.length - 1;
  if (final) G.ended = true;
  RZ = { tier: E.tier, tierName: T.name, passed, perfect, caught: E.caught, correct, qn, score, pass, reward, bonus, coach, pay: T.pay, fee: E.fee,
    marks, self: E.selfN, ai: E.aiN, unlock, final, next: passed ? (final ? 'end' : E.tier + 1) : null, focus: passed ? 'next' : 'retry', canRetry: true, canNext: true };
  perfect ? sfx.top() : passed ? sfx.pass() : sfx.fail();
  events.push({ type: 'result', passed, perfect, caught: E.caught, correct, reward, fee: E.fee });
  save(); scene = 'results'; renderPanel();
}
function goHub(tab) { // 고시원 방으로. tab을 주면 그 창(시험 접수·장비몰·기록)을 바로 연다
  scene = 'hub';
  if (tab) openSheet(tab); else closeSheet();
}
function hubAction(a) { if (a === 'go') startExam(nextTierIndex()); else if (a) openSheet(a); }

// ---- Scenes ------------------------------------------------------------------------------
let BTNS = [];
function reset() {
  seed = Number(params.get('seed')) || CONFIG.seed;
}
function makeState() {
  return {
    t: 0,
    get score() { return Math.floor(G.money); }, get money() { return G.money; }, get level() { return G.unlocked; },
    get goal() { return G.ended; }, get exam() { return E; }, get gear() { return G.gear; }, get game() { return G; },
    get margin() { return E && scene === 'play' ? 1 - E.sus : 1; }, get gained() { return RZ && RZ.reward > 0 ? won(RZ.reward) + '원' : ''; },
  };
}
function drawNote(B) { // 화면 아래 짧은 알림 (응시료 부족, 자리 비움 수입)
  const msg = STATE.note ? STATE.note.text : STATE.away && scene === 'hub' ? `자리 비운 동안 봇이 ${won(STATE.away.gain)}원 벌었어요` : null;
  if (!msg) return;
  const k = B.k, L = B.L, w = k.TW(msg, 12, 800) + 24, y = L.H - 26, col = STATE.note ? PAL.warn : PAL.gold;
  k.R(L.W / 2 - w / 2, y - 11, w, 22, PAL.dark); k.frame(L.W / 2 - w / 2, y - 11, w, 22, col, 1);
  k.T(msg, L.W / 2, y, 12, col, 'center', 800);
}
function drawHubHud(B) { // 고시원 방: 물건 이름표, 돈, 산 장비 알림
  const k = B.k, L = B.L, H = hudSet(), hover = STATE.hoverAct;
  if (!STATE.sheet) for (const l of WORLD.hubLabels()) {
    if (!l.show) continue;
    const hot = l.action === hover, w = k.TW(l.text, 10, 800) + 14, x = Math.round(clamp(l.x, w / 2 + 4, L.W - w / 2 - 4)), y = Math.round(clamp(l.y, 12, L.H - 12));
    k.b.globalAlpha = hot ? 0.96 : 0.72; k.R(x - w / 2, y - 8, w, 16, hot ? PAL.hud : PAL.dark); k.b.globalAlpha = 1;
    k.T(l.text, x, y, 10, hot ? PAL.dark : PAL.white, 'center', 800);
  }
  plate(k, L.W / 2 - 90, 6, 180, 36, H);
  k.TO(won(STATE.shown) + '원', L.W / 2, 18, 14, PAL.gold);
  k.T(botRate() > 0 ? `대리 응시 봇 초당 ${won(botRate())}원` : '대리 응시 봇 없음', L.W / 2, 34, 9, H.c2, 'center', 700);
  for (const p of STATE.pops) if (p.scene === 'hub') k.TO(p.text || ('+' + won(p.v) + '원'), L.W / 2, 58 - p.t * 14, 12, p.col || PAL.gold);
  drawNote(B);
}
function drawNo3D(B) { // WebGL을 못 쓰는 기기
  const k = B.k, L = B.L;
  k.R(0, 0, L.W, L.H, '#0d0b13');
  k.TO('이 기기에서는 3D 화면을 열 수 없어요', L.W / 2, L.H / 2 - 10, 16, PAL.warn);
  k.T('WebGL을 켜거나 다른 브라우저에서 열어 주세요', L.W / 2, L.H / 2 + 16, 11, '#c9c4d8', 'center', 700);
}
const scenes = {
  figures: {
    update(dt) { state.t += dt; },
    draw(B) {
      WORLD.renderFigures(now);
      const k = B.k;
      k.TO('감독관 5종(주시) · 한 감독관의 네 자세', B.L.W / 2, 18, 12, PAL.white);
      for (const f of WORLD.figureLabels()) k.TO(f.text, f.x, f.y, 10, f.pose === 'watch' ? '#ff9aa4' : f.pose === 'tell' ? PAL.warn : PAL.white);
    },
  },
  title: {
    update() {
      takeReleases();
      const start = () => { if (G.stats.exams > 0) goHub(null); else startExam(0); };
      if (takeTaps().length) { start(); return; }
      if (pressed('Enter') || pressed('Space')) start();
    },
    draw(B) { WORLD.renderTitle(G, now); BTNS = drawTitle(B.k, B.L, now, G.stats.exams > 0); },
  },
  hub: {
    update(dt) {
      const open = !!STATE.sheet;
      for (const [x, y] of takeTaps()) { if (!open) hubAction(WORLD.pickHub(x, y)); }
      takeReleases();
      if (open) { if (pressed('Escape')) closeSheet(); }
      else {
        if (pressed('Enter')) hubAction('go');
        if (pressed('Digit1')) hubAction('exams'); else if (pressed('Digit2')) hubAction('gear'); else if (pressed('Digit3')) hubAction('log');
      }
      STATE.hoverAct = !STATE.sheet && STATE.hover ? WORLD.pickHub(STATE.hover[0], STATE.hover[1]) : null;
      const cur = STATE.hoverAct ? 'pointer' : ''; if (canvas.style.cursor !== cur) canvas.style.cursor = cur;
      if (STATE.away) { STATE.away.t += dt; if (STATE.away.t > 6) STATE.away = null; }
    },
    draw(B) { WORLD.renderHub(G, now, STATE.hoverAct); drawHubHud(B); },
  },
  play: {
    update(dt) { state.t += dt; updateExam(dt); },
    draw(B) { WORLD.renderExam(E, now); drawExamHud(B.k, B.L, E, now, hudSet()); },
  },
  pause: {
    update() {
      takeReleases();
      if (needRotate()) { takeTaps(); return; } // 세로로 들고 있는 동안은 멈춰 둔다
      if (takeTaps().length || pressed('KeyP') || pressed('Escape') || pressed('Enter')) { ptrs.clear(); scene = 'play'; }
    },
    draw(B) {
      WORLD.renderExam(E, now); drawExamHud(B.k, B.L, E, now, hudSet());
      const k = B.k, L = B.L;
      k.b.globalAlpha = 0.7; k.R(0, 0, L.W, L.H, PAL.dark); k.b.globalAlpha = 1;
      k.TO('일시정지', L.W / 2, L.H / 2 - 14, 28, PAL.white);
      k.T('P · 탭: 계속', L.W / 2, L.H / 2 + 18, 12, PAL.hud, 'center', 700);
    },
  },
  results: {
    update() {
      takeReleases();
      const act = key => {
        if (key === 'retry') { if (!startExam(RZ.tier)) goHub('exams'); }
        else if (key === 'next' && RZ.next != null) { if (RZ.final) scene = 'ending'; else if (!startExam(RZ.next)) goHub('exams'); }
        else if (key === 'hub') { if (RZ.final && !G.endSeen) scene = 'ending'; else goHub('gear'); }
      };
      for (const [x, y] of takeTaps()) { const b = hitBtn(BTNS, x, y); if (b) { act(b.key); return; } }
      if (pressed('KeyR')) act('retry');
      else if (pressed('KeyN')) act('next');
      else if (pressed('Enter') || pressed('Space')) act('hub');
    },
    draw(B) {
      RZ.canRetry = G.money >= examFee(CONFIG.tiers[RZ.tier]);
      RZ.canNext = RZ.next != null && !RZ.final && G.money >= examFee(CONFIG.tiers[RZ.next]);
      WORLD.renderExam(E, now); drawExamHud(B.k, B.L, E, now, hudSet()); BTNS = drawResults(B.k, B.L, RZ, now, hudSet()); drawNote(B);
    },
  },
  ending: {
    update(dt) {
      takeReleases();
      STATE.wipeArm = Math.max(0, STATE.wipeArm - dt);
      const act = key => {
        if (key === 'continue') { G.endSeen = true; save(); goHub(null); }
        else if (key === 'wipe') { if (STATE.wipeArm > 0) wipe(); else STATE.wipeArm = 2.5; }
      };
      for (const [x, y] of takeTaps()) { const b = hitBtn(BTNS, x, y); if (b) { act(b.key); return; } }
      if (pressed('Enter') || pressed('Space')) act('continue');
      if (pressed('KeyX')) act('wipe');
    },
    draw(B) {
      BTNS = drawEnding(B.k, B.L, G, now, hudSet());
      if (STATE.wipeArm > 0) B.k.TO('한 번 더 누르면 저장을 지우고 처음부터', B.L.W / 2, B.L.H - 82, 12, PAL.warn);
    },
  },
};
function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { }
  G = newGame(); state = makeState(); E = null; RZ = null; STATE.shown = 0; STATE.pops = []; STATE.wipeArm = 0;
  reset(); closeSheet(); scene = 'title';
}

// ---- Loop: fixed step, frame time clamped ---------------------------------------------
let saveT = 0;
function step() {
  if (pressed('KeyM')) { setMuted(!muted); hit.delete('KeyM'); }
  if (scene === 'play' && needRotate()) scene = 'pause';
  now += STEP;
  if (scene !== 'title' && scene !== 'pause' && scene !== 'figures') {
    if (G.gear.bot > 0) addMoney(botRate() * STEP);
    G.stats.playT += STEP;
    saveT += STEP; if (saveT > 5) { saveT = 0; save(); }
  }
  const diff = G.money - STATE.shown;
  STATE.shown = diff < 0 || Math.abs(diff) < 1 ? G.money : STATE.shown + diff * Math.min(1, STEP * tune.count_speed);
  for (const p of STATE.pops) p.t += STEP;
  STATE.pops = STATE.pops.filter(p => p.t < 1.4);
  if (STATE.note) { STATE.note.t += STEP; if (STATE.note.t > 2.5) STATE.note = null; }
  scenes[scene].update(STEP); hit.clear();
}
let last, acc = 0, ALPHA = 1;
function tick() {
  const t = clock.now();
  acc += Math.min(t - last, 0.25); last = t; // a stall never fast-forwards the game
  while (acc >= STEP) { step(); acc -= STEP; }
  ALPHA = acc / STEP;
  drawFrame();
}
function drawFrame() {
  fit();
  const B = buffer();
  B.k.b.clearRect(0, 0, B.L.W, B.L.H); // HUD 층은 투명하게 비우고 그 아래로 3D가 보인다
  if (!WORLD.ok && scene !== 'ending') drawNo3D(B); else scenes[scene].draw(B);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(B.c, 0, 0, canvas.width, canvas.height);
  refreshPanel();
}
function frame() { tick(); requestAnimationFrame(frame); }
function timer() { if (document.visibilityState === 'visible' && clock.now() - last > 0.1) tick(); }

// ---- 방 안 물건을 누르면 뜨는 창: 일정표=시험 접수, 노트북=AI 장비몰, 폰=기록 ----------------
const sheet = document.getElementById('sheet'), pMoney = document.getElementById('pMoney'), pRate = document.getElementById('pRate'), pBody = document.getElementById('pBody'), pTabs = document.getElementById('pTabs'), pTitle = document.getElementById('pTitle');
let panelMode = '', panelT = 0, affordSig = '';
const SHEET_TITLE = { exams: '시험 접수 · 2026 시험 일정표', gear: 'AI 장비몰', log: '내 폰 · 기록과 설정' };
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function gearVisible(d) { return G.unlocked - 1 >= d.need; }
function examAffordSig() { return CONFIG.tiers.map(t => G.money >= examFee(t) ? 1 : 0).join(''); }
function openSheet(tab) { STATE.sheet = tab; STATE.tab = tab; if (sheet) sheet.hidden = false; renderPanel(); }
function closeSheet() { STATE.sheet = null; if (sheet) sheet.hidden = true; panelMode = ''; }
function renderPanel() {
  if (!pBody || !G || !STATE.sheet || scene !== 'hub') return;
  pTabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === STATE.tab));
  if (pTitle) pTitle.textContent = SHEET_TITLE[STATE.tab] || '';
  pBody.innerHTML = STATE.tab === 'exams' ? examsHTML() : STATE.tab === 'gear' ? gearHTML() : introHTML() + logHTML();
  pBody.querySelectorAll('canvas.ico').forEach(c => { const k = makeKit(c.getContext('2d')); drawGear(k, c.dataset.id, 12, 12, 22, Number(c.dataset.lv)); });
  panelMode = scene + STATE.tab; affordSig = examAffordSig();
  refreshPanel(true);
}
function refreshPanel(force) {
  if (!pMoney || !G || !STATE.sheet || scene !== 'hub') return;
  if (panelMode !== scene + STATE.tab) { renderPanel(); return; }
  const m = won(STATE.shown) + '원';
  if (pMoney.textContent !== m) pMoney.textContent = m;
  const r = botRate() > 0 ? `대리 응시 봇 · 초당 ${won(botRate())}원` : '대리 응시 봇 없음';
  if (pRate.textContent !== r) pRate.textContent = r;
  panelT += 1;
  if (!force && panelT % 10) return;
  if (STATE.tab === 'exams' && examAffordSig() !== affordSig) { renderPanel(); return; }
  pBody.querySelectorAll('button[data-buy]').forEach(b => {
    const id = b.dataset.buy, d = gearDef(id), lv = G.gear[id], maxed = lv >= d.max, cost = gearCost(id);
    const dis = maxed || G.money < cost;
    if (b.disabled !== dis) b.disabled = dis;
    b.closest('.card').classList.toggle('afford', !dis);
  });
}
function introHTML() {
  return `<div class="card"><div class="gn">이렇게 해요</div>
  <p>화면 <b>양옆</b>을 꾹 누르면 고개를 돌려 감독관을 봐요. 나를 정면으로 보고 있으면 위험.</p>
  <p>아무도 안 볼 때 <b>가운데</b>를 꾹 누르면 AI 안경이 스캔해요. 오답이 하나씩 지워지고, 끝나면 AI가 고른 답이 떠요.</p>
  <p>보기를 눌러 마킹. 맞았는지는 시험이 끝나야 알아요. 시험마다 응시료를 내고, 합격하면 장학금·월급을 받아요.</p>
  <p>대학 중간고사부터 변호사시험까지 통과하면 엔딩.</p>
  <p class="dim">키보드: ← → 고개 · Space 스캔 · 1~4 마킹 · P 일시정지 · M 소리</p></div>`;
}
function examsHTML() {
  const nt = nextTierIndex();
  return CONFIG.tiers.map((t, i) => {
    const locked = i > G.unlocked - 1, cleared = G.cleared[i], fee = examFee(t), afford = G.money >= fee;
    const secs = t.sec.length ? t.sec.map(s => SEC_NAME[s]).join(' · ') : '없음';
    const acc = Math.round(aiAccuracy(t) * 100), label = cleared ? '다시 응시' : '응시하기';
    return `<div class="card exam ${locked ? 'locked' : ''} ${i === nt && !locked ? 'next' : ''}">
      <div class="gn"><span class="no">${i + 1}</span>${esc(t.name)} ${cleared ? `<span class="badge">통과 ${G.best[i]}점</span>` : ''}</div>
      ${locked ? '<div class="gd">이전 시험을 통과하면 접수할 수 있어요</div>' : `
      <div class="gd">${esc(t.subject)} · ${t.qn}문제 · ${Math.round(t.time * tune.time_scale + G.gear.watch * tune.watch_bonus)}초 · 감독: ${esc(t.staff.map(s => s.name).join(', '))}</div>
      <div class="gd">보안: <span class="${t.sec.length ? 'warn' : ''}">${secs}</span> · AI 정확도 <b>${acc}%</b></div>
      <div class="ge">응시료 <b>${fee ? won(fee) + '원' : '무료'}</b> · 문제당 <b class="gold">${won(t.reward * tune.reward_scale)}원</b> · 만점이면 x${tune.jackpot_mult}</div>
      <button class="go" data-exam="${i}" ${afford ? '' : 'disabled'}>${afford ? label + (fee ? ` · 응시료 ${won(fee)}원` : '') : `응시료 ${won(fee)}원 모자람`}</button>`}
    </div>`;
  }).join('');
}
function gearHTML() {
  const list = CONFIG.gear.filter(gearVisible), hidden = CONFIG.gear.length - list.length;
  let html = '';
  for (const grp of ['안경', 'AI 장비']) {
    const items = list.filter(d => d.group === grp);
    if (!items.length) continue;
    html += `<div class="grp">${grp === '안경' ? 'AI 안경 업그레이드' : '안경 밖 AI 장비'}</div>`;
    html += items.map(d => {
      const lv = G.gear[d.id], maxed = lv >= d.max, cost = gearCost(d.id);
      const nowTxt = GEAR_TEXT[d.id](lv), nextTxt = maxed ? '' : GEAR_TEXT[d.id](lv + 1);
      const ms = d.id === 'bot' ? CONFIG.bot_milestones.find(m => lv < m) : null;
      const first = d.id === 'lens' && lv === 0 && G.stats.exams > 0;
      return `<div class="card gear ${first ? 'first' : ''}">
        <canvas class="ico" width="24" height="24" data-id="${d.id}" data-lv="${lv}"></canvas>
        <div class="gi"><div class="gn">${esc(d.name)} <span class="lv">Lv.${lv}${maxed ? ' MAX' : ''}</span></div>
        <div class="gd">${esc(GEAR_BLURB[d.id])}</div>
        <div class="ge">${lv ? esc(nowTxt) : '<span class="dim">없음</span>'}${maxed ? '' : ` → <b>${esc(nextTxt)}</b>`}</div>
        ${ms ? `<div class="gd">Lv.${ms}에서 수입 x2 (${lv}/${ms})</div>` : ''}</div>
        <button class="buy" data-buy="${d.id}" ${maxed ? 'disabled' : ''}>${maxed ? '최대' : won(cost) + '원'}</button>
      </div>`;
    }).join('');
  }
  if (hidden) html += `<div class="card locked"><div class="gd">다음 시험에 도달하면 장비 ${hidden}종이 더 나와요</div></div>`;
  return html;
}
function logHTML() {
  const s = G.stats, m = Math.floor(s.playT / 60);
  return `<div class="card"><div class="gn">기록</div>
    <div class="row"><span>플레이 시간</span><b>${m}분</b></div>
    <div class="row"><span>시험 응시</span><b>${s.exams}번</b></div>
    <div class="row"><span>합격 · 불합격 · 적발</span><b>${s.passes} · ${s.fails} · ${s.caught}</b></div>
    <div class="row"><span>수석 합격(만점)</span><b>${s.tops}번</b></div>
    <div class="row"><span>직접 고른 답</span><b>${s.selfQ}개</b></div>
    <div class="row"><span>AI가 고른 답</span><b>${s.aiQ}개</b></div>
    <div class="row"><span>낸 응시료</span><b>${won(s.fees)}원</b></div>
    <div class="row"><span>지금까지 번 돈</span><b class="gold">${won(s.earned)}원</b></div></div>
    <div class="card"><div class="gn">설정</div>
    <button class="go" data-act="mute">${muted ? '소리 켜기' : '소리 끄기'}</button>
    <button class="go danger" data-act="wipe">${STATE.wipeArm > 0 ? '정말 지울까요? 한 번 더' : '저장 지우고 처음부터'}</button></div>`;
}
if (pTabs) pTabs.addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (!b) return; startAudio(); openSheet(b.dataset.tab); });
const sheetClose = document.getElementById('sheetClose');
if (sheetClose) sheetClose.addEventListener('click', () => closeSheet());
if (sheet) sheet.addEventListener('pointerdown', e => { if (e.target === sheet) closeSheet(); }); // 창 바깥을 누르면 닫힘
if (pBody) pBody.addEventListener('click', e => {
  startAudio();
  const buy = e.target.closest('button[data-buy]'), go = e.target.closest('button[data-exam]'), act = e.target.closest('button[data-act]');
  if (buy) {
    const id = buy.dataset.buy, d = gearDef(id), cost = gearCost(id);
    if (G.gear[id] >= d.max || G.money < cost) return;
    G.money -= cost; G.gear[id]++;
    sfx.buy(); STATE.pops.push({ v: 0, t: 0, scene: 'hub', text: `${d.name} Lv.${G.gear[id]}!`, col: PAL.hud });
    events.push({ type: 'buy', id, lv: G.gear[id] });
    save(); renderPanel();
  } else if (go) { startExam(Number(go.dataset.exam)); }
  else if (act && act.dataset.act === 'mute') setMuted(!muted);
  else if (act && act.dataset.act === 'wipe') { if (STATE.wipeArm > 0) wipe(); else { STATE.wipeArm = 3; renderPanel(); setTimeout(() => { STATE.wipeArm = 0; renderPanel(); }, 3000); } }
});

// ---- What a check can read and drive (?manual=1 stops the loop; players never see it) ----
window.game = {
  get scene() { return scene; },
  get state() { return state; },
  press(code) { hit.add(code); },
  hold(code, on) { on ? down.add(code) : down.delete(code); },
  get events() { return events; },
  step(n = 1, draw = true, alpha = 1) {
    for (let i = 0; i < n; i++) step();
    if (draw) { ALPHA = alpha; drawFrame(); }
  },
};

reset();
G = (params.get('fresh') === '1' || params.get('scene')) ? newGame() : (load() || newGame());
if (params.get('gear')) { const lv = Number(params.get('gear')); for (const d of CONFIG.gear) G.gear[d.id] = Math.min(d.max, lv); }
if (params.get('tier')) { G.unlocked = clamp(Number(params.get('tier')) + 1, 1, CONFIG.tiers.length); for (let i = 0; i < G.unlocked - 1; i++) G.cleared[i] = true; }
if (params.get('money')) G.money = Number(params.get('money'));
state = makeState();
awayEarnings();
STATE.shown = G.money;
scene = params.get('scene') || 'title';
if (!scenes[scene]) scene = 'title';
if (scene === 'play' || scene === 'pause' || scene === 'results') {
  const ti = Number(params.get('tier')) || 0;
  G.money = Math.max(G.money, examFee(CONFIG.tiers[ti])); G.stats.exams = ti > 0 ? 1 : G.stats.exams;
  startExam(ti);
  if (params.get('t')) { const n = Math.round(Number(params.get('t')) / STEP); for (let i = 0; i < n; i++) step(); }
  if (params.get('scene') === 'results') { E.qs.forEach((q, i) => { E.answers[i] = i % 4 === 3 ? (q.answer + 1) % 4 : q.answer; E.via[i] = i % 2 ? 'ai' : 'self'; }); finishExam(); }
}
if (scene === 'hub' && params.get('tab')) { G.stats.exams = Math.max(1, G.stats.exams); openSheet(params.get('tab')); }
if (scene === 'hub' && params.get('scene') && G.stats.exams === 0) G.stats.exams = 1;
if (params.get('scene') === 'hub') for (let i = 0; i < 6; i++) step(); // 화면 확인용: 방을 한 번 비춘 뒤
renderPanel();
last = clock.now();
if (params.get('manual') === '1') drawFrame();
else { requestAnimationFrame(frame); setInterval(timer, 50); }
