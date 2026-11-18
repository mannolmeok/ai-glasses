// PROTOTYPE - NOT FOR PRODUCTION
// Question: 감독관 눈치를 보며 AI 안경으로 스캔하는 긴장감이, 장비와 시험이 함께 커지는 성장과 맞물려 엔딩까지 재밌나?
// Date: 2026-11-17
// 게임 규칙·장면·경제·저장. 시험 25개의 장치(입실 검사, 불시 순시, 듣기, 웹캠, 손 드는 수험생, 신분 확인, 교시, 적응형, 면접,
// 눈 피로, 테이스팅, 세 눈, 무중력, 순간이동, 늘어나는 감독관, AI 사용 감지, Ω의 박자 읽기), 합격할 때마다 풀리는 신상과 AI 모델,
// 고시원의 노트북·일정표·폰, 택배, 타임어택 기록, 전체 화면, 저장 코드.
// 스타터의 점검 고리(고정 스텝, 시계, window.game, play·figures 장면)를 그대로 둔다.
'use strict';

// ---- Built to be checked ----------------------------------------------------------------
const params = new URLSearchParams(location.search);
const tune = new Proxy({}, { get: (_, k) => CONFIG[k].value }); // live: tune.scan_time is CONFIG.scan_time.value
const STEP = 1 / 60;            // simulation step in seconds; motion is per second, never per frame
const PIXEL = true;             // pixel look: whole-number buffer, no smoothing
const FONT = FONT_KO;
const TITLE = 'AI 안경';
const CONTROLS = ['양옆·위·가운데 톡 / ← → ↑ ↓: 왼쪽·오른쪽·정면·책상 보기', '책상을 꾹 / Space: AI 스캔', '보기 누르기 / 1~4: 마킹', 'P: 일시정지', 'M: 소리', 'F: 전체 화면'];
const clock = window.GAME_CLOCK || { now: () => performance.now() / 1000 }; // a check may inject one
const CHEAP = params.get('render') === 'cheap';
const CHECKED = !!(window.GAME_CLOCK || params.get('manual') || params.get('scene') || navigator.webdriver); // 점검 중에는 전체 화면을 청하지 않는다
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
const UA = navigator.userAgent || '';
const STATE = { shown: 0, pops: [], wipeArm: 0, away: null, note: null, hv: null, shownIds: new Set(),
  ios: /iPhone|iPod|iPad/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1),
  standalone: !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches)) };
function newHubView() { return { view: 'room', target: 'room', zoom: 0, app: 'desk', tab: 'new', page: 0, act: 0, bpage: null, ptab: 'news', npage: 0, order: [], hidden: {}, parcel: null, parcelT: 0 }; }

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
function fmtRun(sec) { // 타임어택 시계: 1:02:03 또는 12:34
  sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
const between = (a, b) => a + rng() * (b - a);

// ---- Economy ---------------------------------------------------------------------------
const TIERS = CONFIG.tiers, LAST = TIERS.length - 1;
function rewardAt(x) { // x번째 시험의 문제당 상금. 사이 값은 등비로 잇고, 범위 밖은 끝의 비율로 늘인다
  const r = i => TIERS[i].reward;
  if (x <= 0) return r(0) * Math.pow(r(1) / r(0), x);
  if (x >= LAST) return r(LAST) * Math.pow(r(LAST) / r(LAST - 1), x - LAST);
  const i = Math.floor(x); return r(i) * Math.pow(r(i + 1) / r(i), x - i);
}
function gearDef(id) { return CONFIG.gear.find(g => g.id === id); }
function actIndex() { return TIERS[G.unlocked - 1].act - 1; }      // 지금 도달한 막 (0부터)
function gearCap(d) { return d.caps[actIndex()]; }                 // 이번 막에서 살 수 있는 최고 단계
function gearMax(d) { return d.caps[d.caps.length - 1]; }
function gearOpen(d) { return d.unlock < 0 || !!G.cleared[d.unlock]; }
function gearName(id, lv) { const d = gearDef(id); return d.ladder ? d.ladder[clamp(lv, 1, d.ladder.length) - 1] : d.name; }
function botName(n) { let name = CONFIG.bot_names[0][1]; for (const [m, nm] of CONFIG.bot_names) if (n >= m) name = nm; return name; }
function bestReward() { let r = 0; G.cleared.forEach((c, i) => { if (c) r = Math.max(r, TIERS[i].reward); }); return r * tune.reward_scale; }
function gearCost(id, lv = G.gear[id]) {
  const d = gearDef(id);
  if (d.kind === 'count') return Math.ceil(tune.bot_cost * Math.max(bestReward(), TIERS[0].reward) * Math.pow(tune.bot_grow, lv) * tune.cost_scale);
  return Math.ceil(d.mult * rewardAt(d.unlock + d.step * lv) * tune.cost_scale);
}
function modelOpen(i) { const m = CONFIG.models[i]; return !!m && (m.rel < 0 || !!G.cleared[m.rel]); }
function modelCost(i) { return Math.ceil(tune.model_cost * TIERS[Math.min(LAST, CONFIG.models[i].rel + 1)].reward * tune.cost_scale); }
function examFee(tier) { return Math.round((tier.fee != null ? tier.fee : tier.reward * tier.qn * (tier.parts ? tier.parts.length : 1) * tune.fee_ratio) * tune.fee_scale); }
function scanSecondsAt(lv) { return tune.scan_time / (1 + tune.lens_bonus * lv); }
function botMult(lv) { return Math.pow(2, CONFIG.bot_milestones.filter(m => lv >= m).length); }
function botRateAt(lv) { return lv * tune.bot_rate * bestReward() * botMult(lv); }
function botRate() { return botRateAt(G.gear.bot); }
function earbudNeedAt(lv) { return Math.max(50, tune.earbud_threshold - tune.earbud_step * (lv - 1)); }
function autoDelayAt(lv) { return tune.autoscan_delay / Math.pow(2, Math.max(0, lv - 1)); }
function jamFactor(lv, max) { return lv <= 0 ? 1 : lv >= max ? 0 : (1 - tune.jam_cut) * (max - lv) / Math.max(1, max - 1); }
function gearCut(lv) { return Math.max(0, 1 - lv * tune.gear_cut); } // 시험 전용 장비: 그 장치가 남는 비율
function coachMult(lv = G.gear.coach) { return 1 + lv * tune.coach_bonus; }
function aiAccuracyAt(tier, model) { return clamp(tune.ai_base - tune.ai_drop * Math.max(0, tier.ai - model), tune.ai_floor, 0.99); }
function aiAccuracy(tier) {
  let p = aiAccuracyAt(tier, G.gear.model);
  if (tier.mech.includes('tasting')) p = clamp(p - tune.taste_need + G.gear.taste * tune.taste_bonus, tune.ai_floor, 0.99);
  if (tier.mech.includes('human')) p = tune.ai_floor;
  return p;
}
function nextTierIndex(g = G) { const i = g.cleared.findIndex(c => !c); return i < 0 ? LAST : Math.min(i, g.unlocked - 1); }
function addMoney(v, tag, text, col) {
  if (!(v > 0)) return;
  G.money += v; G.stats.earned += v;
  if (tag) STATE.pops.push({ v, t: 0, scene: tag, text, col });
}
// AI마켓 진열: 탭에 맞는 상품 목록
function shopItems(tab) {
  if (tab === 'model') return CONFIG.models.map((m, i) => ({ m, i, fresh: !!G.fresh.model && i === G.gear.model + 1 })).filter(o => modelOpen(o.i)).reverse();
  const open = CONFIG.gear.filter(d => gearOpen(d) && gearCap(d) > 0);
  return tab === 'new' ? open.filter(d => G.fresh[d.id]) : open.filter(d => d.group === tab);
}
function shopNewCount() { return Object.keys(G.fresh).length; }
function phoneUnread() { return Math.max(0, G.news.length - G.seen); }
function markShown(id) { STATE.shownIds.add(id); }
function addNews(kind, text) { G.news.push({ kind, text, t: Math.floor(G.run.t) }); if (G.news.length > 60) { const cut = G.news.length - 60; G.news.splice(0, cut); G.seen = Math.max(0, G.seen - cut); } }
function runSecs() { return G.run.t; }
function actSplit(a) { // 그 막의 구간 기록: 막의 마지막 시험에 처음 합격한 시각
  const idx = TIERS.map((t, i) => i).filter(i => TIERS[i].act === a), n = idx.filter(i => G.cleared[i]).length, lastI = idx[idx.length - 1];
  return { n, total: idx.length, done: G.run.splits[lastI] != null, t: G.run.splits[lastI] || 0 };
}

// ---- Save ------------------------------------------------------------------------------
const SAVE_KEY = 'ai-glasses-save-v4', REC_KEY = 'ai-glasses-records';
function newGame() {
  const gear = { model: 0 }; for (const g of CONFIG.gear) gear[g.id] = 0;
  return { v: 4, heat: 0, black: null, money: 0, gear, unlocked: 1, cleared: TIERS.map(() => false), best: TIERS.map(() => 0),
    ended: false, endSeen: false, stats: { exams: 0, caught: 0, passes: 0, fails: 0, tops: 0, selfQ: 0, aiQ: 0, playT: 0, earned: 0, fees: 0, scans: 0 },
    hints: {}, flags: {}, pending: 0, mail: null, fresh: {}, news: [], seen: 0, run: { t: 0, splits: [], done: false, rec: 0 }, opts: { timer: false }, last: 0 };
}
function adopt(s) { // 저장된 값을 새 게임 틀에 얹는다 (빠진 칸은 기본값)
  const g = newGame(), b = newGame();
  Object.assign(g, s); g.gear = Object.assign(b.gear, s.gear || {}); g.stats = Object.assign(b.stats, s.stats || {});
  g.run = Object.assign(b.run, s.run || {}); g.opts = Object.assign(b.opts, s.opts || {});
  for (const k of ['cleared', 'best']) { g[k] = TIERS.map((_, i) => (s[k] && s[k][i]) || b[k][i]); }
  g.fresh = s.fresh || {}; g.news = Array.isArray(s.news) ? s.news : []; g.hints = s.hints || {}; g.flags = s.flags || {}; g.seen = s.seen || 0;
  g.pending = Number(s.pending) || 0; g.mail = s.mail || null; g.heat = clamp(Number(s.heat) || 0, 0, 1); g.black = s.black || null;
  g.unlocked = clamp(Math.floor(g.unlocked) || 1, 1, TIERS.length); g.money = Number(g.money) || 0;
  return g;
}
function save() { try { G.last = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (_) { } }
function load() { try { const raw = localStorage.getItem(SAVE_KEY); return raw ? adopt(JSON.parse(raw)) : null; } catch (_) { return null; } }
function awayEarnings() { // 저장해 둔 마지막 시각과 지금의 차이만큼 대리 응시가 번 돈 (불러올 때 한 번)
  if (!G.last || !(G.gear.bot > 0)) return;
  const secs = clamp((Date.now() - G.last) / 1000, 0, tune.away_cap);
  const gain = Math.floor(botRate() * secs * tune.away_rate);
  if (secs > 30 && gain >= 1) { addMoney(gain); STATE.away = { gain, secs, t: 0 }; }
}
// 저장 코드: 아이폰은 사파리와 홈 화면 앱의 저장소가 따로라서, 글자로 옮긴다
function saveCode() { const g = Object.assign({}, G, { news: G.news.slice(-8), seen: Math.min(G.seen, 8) }); return 'AIG4.' + btoa(unescape(encodeURIComponent(JSON.stringify(g)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function readCode(str) {
  try {
    const m = String(str).trim().match(/AIG4\.([A-Za-z0-9_-]+)/); if (!m) return null;
    const s = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
    return s && s.v === 4 && s.gear && Array.isArray(s.cleared) ? adopt(s) : null;
  } catch (_) { return null; }
}
// 타임어택 기록 (이 기기에만)
function loadRecords() { try { const a = JSON.parse(localStorage.getItem(REC_KEY) || '[]'); return Array.isArray(a) ? a.filter(r => r && r.t > 0).sort((x, y) => x.t - y.t) : []; } catch (_) { return []; } }
function writeRecords(a) { try { localStorage.setItem(REC_KEY, JSON.stringify(a.sort((x, y) => x.t - y.t).slice(0, 20))); } catch (_) { } }
function addRecord() { // 엔딩에 처음 닿은 순간의 기록
  const a = loadRecords(), id = Date.now(), last = a.find(r => r.name && r.name !== '나');
  a.push({ id, name: (last && last.name) || '나', t: Math.round(G.run.t), date: new Date().toISOString().slice(0, 10), exams: G.stats.exams, caught: G.stats.caught });
  writeRecords(a); G.run.done = true; G.run.rec = id;
}
function endingInfo() {
  const recs = loadRecords(), rank = recs.findIndex(r => r.id === G.run.rec) + 1;
  return { time: fmtRun(G.run.t), rank, splits: [1, 2, 3].map(a => ({ name: CONFIG.acts[a - 1], time: fmtRun(actSplit(a).t) })),
    records: recs.map(r => ({ name: r.name, time: fmtRun(r.t), me: r.id === G.run.rec })) };
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
  const hs = Math.min(k, 4); // 글자가 선명하도록 HUD 층도 화면 픽셀 수로 그린다
  if (hs !== HUD_SCALE || B.c.width !== B.L.W * hs) { HUD_SCALE = hs; TEXT_CACHE.clear(); B.c.width = B.L.W * hs; B.c.height = B.L.H * hs; }
  B.k.b.setTransform(hs, 0, 0, hs, 0, 0); B.k.b.imageSmoothingEnabled = false;
  screen.style.width = Math.floor(B.L.W * s) + 'px'; screen.style.height = Math.floor(B.L.H * s) + 'px';
  canvas.style.imageRendering = 'auto';
}
addEventListener('resize', () => { fitSig = ''; });
function hudSet() { const h = PAL.hud; return { c: h, c2: mix(h, '#0d0b13', 0.3), c3: mix(h, '#0d0b13', 0.78) }; }

// ---- 전체 화면: PC·안드로이드는 첫 입력에, 아이폰은 홈 화면 앱으로 ----------------------------
const fsRoot = document.documentElement;
function canFullscreen() { return !!(fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen) && !STATE.standalone; }
function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function enterFullscreen() {
  try {
    const p = fsRoot.requestFullscreen ? fsRoot.requestFullscreen({ navigationUI: 'hide' }) : fsRoot.webkitRequestFullscreen ? fsRoot.webkitRequestFullscreen() : null;
    const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { }); } catch (_) { } };
    if (p && p.then) p.then(lock).catch(() => { }); else lock();
  } catch (_) { }
}
function exitFullscreen() { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (_) { } }
function toggleFullscreen() { if (isFullscreen()) { STATE.fsOff = true; exitFullscreen(); } else { STATE.fsOff = false; enterFullscreen(); } }
let wake = null;
function keepAwake() { try { if (navigator.wakeLock && !wake && document.visibilityState === 'visible') navigator.wakeLock.request('screen').then(w => { wake = w; w.addEventListener('release', () => { wake = null; }); }).catch(() => { }); } catch (_) { } }
function firstGesture() { // 손을 뗄 때(브라우저가 허락하는 순간)에 전체 화면을 청한다
  if (CHECKED) return;
  keepAwake();
  if (!STATE.fsOff && canFullscreen() && !isFullscreen() && !dlgOpen()) enterFullscreen();
}
addEventListener('pointerup', firstGesture, true);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !CHECKED) keepAwake(); });

// ---- 글자를 받는 작은 창 (저장 코드, 기록에 남길 이름) ----------------------------------------
const dlg = document.getElementById('dlg'), dlgTitle = document.getElementById('dlgTitle'), dlgText = document.getElementById('dlgText'),
  dlgInput = document.getElementById('dlgInput'), dlgArea = document.getElementById('dlgArea'), dlgOk = document.getElementById('dlgOk'), dlgCancel = document.getElementById('dlgCancel');
let dlgDone = null;
function dlgOpen() { return !!dlg && !dlg.hidden; }
function openDialog(o) {
  if (!dlg) return;
  dlgTitle.textContent = o.title; dlgText.textContent = o.text || '';
  dlgInput.hidden = !o.input; dlgArea.hidden = !o.area; dlgInput.value = o.value || ''; dlgArea.value = o.value || ''; dlgArea.readOnly = !!o.readOnly;
  dlgOk.textContent = o.okLabel || '확인'; dlgDone = o.ok || null; dlg.hidden = false; down.clear(); ptrs.clear();
  const f = o.input ? dlgInput : o.area ? dlgArea : dlgOk; setTimeout(() => { try { f.focus(); if (f.select) f.select(); } catch (_) { } }, 30);
}
function closeDialog() { if (dlg) dlg.hidden = true; dlgDone = null; }
if (dlg) {
  dlgOk.addEventListener('click', () => { const fn = dlgDone, v = dlgInput.hidden ? dlgArea.value : dlgInput.value; closeDialog(); if (fn) fn(v); });
  dlgCancel.addEventListener('click', closeDialog);
  dlg.addEventListener('pointerdown', e => { if (e.target === dlg) closeDialog(); });
  dlgInput.addEventListener('keydown', e => { if (e.key === 'Enter') dlgOk.click(); });
}
function exportSave() {
  save(); const code = saveCode();
  const show = copied => openDialog({ title: '저장 코드', text: copied ? '복사했어요. 다른 기기(또는 홈 화면 앱)의 폰 → 설정 → 저장 코드 붙여넣기에 넣으세요.' : '아래 글자를 전부 복사해서 다른 기기의 폰 → 설정 → 저장 코드 붙여넣기에 넣으세요.', area: true, value: code, readOnly: true, okLabel: '닫기' });
  try { navigator.clipboard.writeText(code).then(() => show(true), () => show(false)); } catch (_) { show(false); }
}
function importSave() {
  openDialog({ title: '저장 코드 붙여넣기', text: '다른 기기에서 복사한 저장 코드를 붙여넣으세요. 지금 이 기기의 진행은 덮어써요.', area: true, okLabel: '불러오기', ok: v => {
    const g = readCode(v);
    if (!g) { STATE.note = { text: '저장 코드를 읽지 못했어요', t: 0 }; sfx.no(); return; }
    G = g; state = makeState(); E = null; RZ = null; STATE.shown = G.money; STATE.hv = newHubView(); save(); scene = 'hub'; sfx.buy();
    STATE.note = { text: '저장 코드를 불러왔어요', t: 0 };
  } });
}
function askName() {
  const recs = loadRecords(), me = recs.find(r => r.id === G.run.rec); if (!me) return;
  openDialog({ title: '기록에 남길 이름', text: `타임어택 ${fmtRun(me.t)} · 이 기기의 내 기록에 남아요.`, input: true, value: me.name === '나' ? '' : me.name, ok: v => { me.name = String(v).trim().slice(0, 10) || '나'; writeRecords(recs); } });
}

// ---- Input: keys by position (event.code), OS key repeat ignored ------------------------
const down = new Set(), hit = new Set();
const pressed = code => hit.has(code); // true for one step after the key goes down
let lastLookKey = null;
addEventListener('keydown', e => {
  if (dlgOpen()) { if (e.code === 'Escape') closeDialog(); return; } // 글자 창이 열려 있으면 게임은 키를 받지 않는다
  startAudio();
  if (!e.repeat) {
    down.add(e.code); hit.add(e.code);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') lastLookKey = 'left';
    if (e.code === 'ArrowRight' || e.code === 'KeyD') lastLookKey = 'right';
    if (e.code === 'KeyF' && !CHECKED && (canFullscreen() || isFullscreen())) toggleFullscreen();
    else if (!CHECKED && e.code !== 'Escape') firstGesture();
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
  ptrs.set(e.pointerId, { x, y, t0: performance.now() / 1000, moved: 0, zone: x < W * z ? 'L' : x > W * (1 - z) ? 'R' : y < EXAM_LAYOUT.H * 0.2 ? 'T' : 'C' });
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
  const wide = E && E.layout !== 'room'; // 마주 앉는 시험·노트북 시험은 화면 어디든 톡 쳐서 고른다
  if (e.type === 'pointerup' && (p.zone === 'C' || wide) && performance.now() / 1000 - p.t0 < 0.22 && p.moved < 14) releases.push([p.x, p.y]);
};
canvas.addEventListener('pointerup', ptrUp); canvas.addEventListener('pointercancel', ptrUp);
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => { down.clear(); ptrs.clear(); });
function takeTaps() { const t = ptr.taps; ptr.taps = []; return t; }
function takeReleases() { const r = releases; releases = []; return r; }
function hitBtn(btns, x, y) { return (btns || []).find(b => x >= b.x && x <= b.x + b.w && y >= b.y - 2 && y <= b.y + b.h + 2); }
function scanHeld() { return down.has('Space') || scanPointer(); }
function setView(v) { // 고개를 그쪽으로 돌려 둔다 (다시 바꿀 때까지 그대로)
  if (!E || v === E.view) return;
  const side = x => x === 'left' || x === 'right';
  if (!side(v) && side(E.view) && E.looks > 0) G.hints.back = true;
  if (v === 'paper') G.hints.desk = true;
  E.prevView = E.view; E.view = v; E.viewT = 0; sfx.turn();
  if (side(v)) { E.looks++; G.hints.look = true; E.showZones = false; }
}
function viewInput(taps) { // 화면 왼쪽·오른쪽·위를 누르고 있는 동안만 그쪽을 본다. 떼면 시험지로 돌아온다
  if (E.layout === 'table') return;
  if (FORCE_VIEW) { setView(FORCE_VIEW); return; }
  const front = E.layout === 'room' ? 'front' : 'paper'; let z = null;
  for (const p of ptrs.values()) if (p.zone === 'L' || p.zone === 'R' || p.zone === 'T') z = p.zone;
  setView(z === 'L' || down.has('ArrowLeft') || down.has('KeyA') ? 'left' : z === 'R' || down.has('ArrowRight') || down.has('KeyD') ? 'right' : z === 'T' || down.has('ArrowUp') || down.has('KeyW') ? front : 'paper');
}
function scanPointer() { for (const p of ptrs.values()) if (p.zone === 'C' || (E && E.layout === 'table')) return true; return false; }

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
function setMuted(m) { muted = m; if (audio) audio.out.gain.value = m ? 0 : tune.volume; }
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
  door: () => { toneAt(140, 0.12, 'sawtooth', 0.07); toneAt(110, 0.2, 'triangle', 0.09, 0.1); },
  knock: () => { for (let i = 0; i < 3; i++) toneAt(170, 0.05, 'square', 0.14, i * 0.16); },
  open: () => { toneAt(300, 0.08, 'sawtooth', 0.05); [660, 880, 1320].forEach((f, i) => toneAt(f, 0.1, 'square', 0.08, 0.15 + i * 0.07)); },
  creak: () => { toneAt(210, 0.18, 'sawtooth', 0.05); toneAt(160, 0.25, 'sawtooth', 0.05, 0.12); toneAt(120, 0.2, 'triangle', 0.06, 0.3); },
  zoom: () => { toneAt(320, 0.05, 'triangle', 0.05); toneAt(480, 0.06, 'triangle', 0.04, 0.04); },
  news: () => { toneAt(1175, 0.08, 'sine', 0.1); toneAt(1568, 0.14, 'sine', 0.1, 0.09); },
  hand: () => { toneAt(700, 0.05, 'triangle', 0.06, 0, -0.4); toneAt(840, 0.07, 'triangle', 0.06, 0.07, -0.4); },
  warp: () => { toneAt(900, 0.12, 'sine', 0.05); toneAt(300, 0.16, 'sine', 0.05, 0.05); },
  radio: () => { for (let i = 0; i < 4; i++) toneAt(440 + (i % 2) * 110, 0.07, 'triangle', 0.03, i * 0.1); },
};

// ---- Exam ------------------------------------------------------------------------------
function procDur(range) { return between(range[0], range[1]) * tune.proctor_pace; }
function newStaff(d, i, T, extra) {
  const s = Object.assign({ type: d.type, name: d.name, side: i % 2 ? 'R' : 'L', u: 0.2 + rng() * 0.6, dir: rng() < 0.5 ? -1 : 1, phase: 'stand', t: 0,
    dur: procDur(T.stand) + i * 0.7, walk: 0, stepT: 0, away: rng() < 0.5, from: null, fixed: !!d.fixed, visit: d.visit || null, out: false, blink: 0, help: null, check: null }, extra || {});
  if (s.visit === 'drop') { s.out = true; s.outT = between(tune.visit_out_min, tune.visit_out_max) * 0.6; } // 밖에 있다가 불쑥 들어온다
  if (s.visit === 'coffee') s.inT = between(tune.visit_in_min, tune.visit_in_max);                          // 있다가 커피 가지러 나간다
  if (s.type === 'webcam') s.dur = between(tune.webcam_off_min, tune.webcam_off_max);
  return s;
}
function makeStaff(T, ti) { const a = T.staff.map((d, i) => newStaff(d, i, T)); if (ti === 0) a[0].dur += 1.5; return a; }
function flash(text, col) { if (E) E.flash = { text, t: 0, col }; }
function assignAI(qs, firstEver) { // AI의 판단: 맞으면 정답, 틀리면 오답 하나. 스캔 중에 지우는 두 보기는 언제나 오답
  let p = aiAccuracy(E.T);
  if (E.adaptHard) p = clamp(p - tune.adaptive_drop, tune.ai_floor, 0.99);
  for (const q of qs) {
    const right = firstEver || rng() < p, wrongs = [0, 1, 2, 3].filter(i => i !== q.answer);
    q.aiPick = right ? q.answer : wrongs[Math.floor(rng() * 3)];
    const rest = wrongs.filter(i => i !== q.aiPick);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    q.elim = rest.slice(0, 2);
    q.conf = clamp(Math.round(p * 100 + (rng() - 0.5) * 8), 30, 99);
  }
  E.aiP = p;
}
function beginPart(p, firstEver) { // 교시·모듈·블록 하나를 시작
  const T = E.T;
  E.part = p; E.qs = makeQuestions(rng, T, p);
  if (E.tier === LAST && p === E.parts - 1 && !G.ended) E.qs[E.qs.length - 1] = { kind: 'text', q: '이 시험을 본 건 너인가, 나인가?', choices: ['나', '너', '우리', '모르겠다'], answer: -1, human: false, final: true }; // 마지막 문제
  assignAI(E.qs, firstEver);
  E.qi = 0; E.answers = []; E.via = []; E.scan = 0; E.ai = false; E.fb = null; E.listen = 0; E.earbudT = 0; E.unsafeT = 0;
  E.timeLeft = E.timeTotal; E.partOver = false;
  if (p > 0) {
    E.sus *= tune.session_keep; E.breakT = tune.break_time;
    if (T.swap && T.swap[p]) { E.staff = T.swap[p].map((type, i) => newStaff({ type, name: PROCTOR_NAME[type] }, i, T)); flash('감독관 교대', PAL.hud); } // 블록마다 새 감독관
  }
}
function startExam(ti) {
  ti = clamp(ti, 0, G.unlocked - 1);
  const T = TIERS[ti], fee = examFee(T);
  if (G.money < fee) { sfx.no(); STATE.note = { text: `응시료 ${won(fee)}원이 모자라요`, t: 0 }; return false; }
  G.money -= fee; G.stats.fees += fee; STATE.shown = Math.min(STATE.shown, G.money);
  const g = G.gear, firstEver = ti === 0 && G.stats.exams === 0, R = WORLD_LAYOUT(T);
  const total = T.time * tune.time_scale + g.watch * tune.watch_bonus;
  E = { tier: ti, T, layout: R, parts: T.parts ? T.parts.length : 1, part: 0, done: [], leftSum: 0, qs: [], qi: 0, answers: [], via: [], selfN: 0, aiN: 0, fee,
    timeLeft: total, timeTotal: total, sus: 0, aiSus: 0, caught: false, caughtBy: null, caughtHow: null, over: false, all: false, endT: 0, start: T.boss ? 2.6 : 1.8, breakT: 0,
    holding: false, autoHolding: false, rising: false, scan: 0, ai: false, fb: null, earbudT: 0, unsafeT: 0, tick: 0, beat: 0, listen: 0, float: 0, clockT: 0,
    danger: false, hint: null, gear: g, view: R === 'room' ? 'front' : 'paper', prevView: R === 'room' ? 'front' : 'paper', viewT: 1, downT: 0, ar: R !== 'room' || g.lens >= tune.glass_level, finalQ: false, glitch: 0, looks: 0, showZones: firstEver && !G.hints.look, flash: null, startNotes: [],
    staff: makeStaff(T, ti), adaptHard: false, pulseCut: 1, runShown: 0, wasHold: false, lastScanT: null, lastGap: null, arRows: [], source: null,
    crowdT: T.mech.includes('crowd') ? between(tune.crowd_gap_min, tune.crowd_gap_max) * 0.6 : 0,
    peekT: T.mech.includes('peek') ? between(tune.peek_gap_min, tune.peek_gap_max) : 0,
    checkT: T.mech.includes('idcheck') ? between(tune.check_gap_min, tune.check_gap_max) * 0.6 : 0,
    cloneT: T.mech.includes('clones') ? tune.clone_gap : 0, clones: 0,
    cctv: T.sec.includes('cctv') ? { ph: rng() * 6.28, a: 1, on: false } : null,
    pulse: T.sec.includes('pulse') ? { next: 3 + rng() * 3, warn: 0, active: 0 } : null };
  E.pulseCut = T.pulse === 'screen' ? gearCut(g.screenfilm) : jamFactor(g.jammer, 3);
  E.stickerSlow = T.mech.includes('sticker') && g.lens < tune.glass_level ? tune.sticker_slow : 1;
  // 입실 검사: 시작부터 의심을 안고 들어간다
  const stealth = Math.pow(1 - tune.stealth_cut, g.stealth), N = E.startNotes;
  if (T.mech.includes('metal')) { E.sus = tune.metal_sus * stealth; N.push({ text: `입실 금속탐지기 삑! 의심도 ${Math.round(E.sus * 100)}%에서 시작`, col: PAL.bad }); }
  if (T.mech.includes('glasscheck')) { E.sus = tune.glass_sus * stealth * gearCut(g.glasscase); N.push({ text: E.sus > 0.01 ? `안경을 물에 담갔다! 의심도 ${Math.round(E.sus * 100)}%에서 시작` : '안경 물 검사 통과 (위장 케이스)', col: E.sus > 0.01 ? PAL.bad : PAL.good }); }
  if (T.mech.includes('sticker')) N.push({ text: E.stickerSlow > 1 ? '옷 단추마다 스티커! 단추 카메라가 가려져 스캔이 느려진다' : '옷 단추마다 스티커 (안경이라 상관없음)', col: E.stickerSlow > 1 ? PAL.bad : PAL.good });
  const names = [...T.mech.filter(m => !['tutorial', 'metal', 'glasscheck', 'sticker'].includes(m)).map(m => m === 'idcheck' && T.check === 'calc' ? MECH_NAME.calc : MECH_NAME[m]), ...T.sec.map(s => s === 'pulse' && T.pulse ? SEC_NAME[T.pulse] : SEC_NAME[s])];
  if (names.length) N.push({ text: names.join(' · '), col: PAL.warn });
  if (T.noAuto) N.push({ text: 'AI 감독관이 이어폰·자동 스캔을 막는다', col: PAL.bad });
  beginPart(0, firstEver);
  ptrs.clear(); releases = [];
  if (!G.run.done) G.run.started = true;
  scene = 'play';
  events.push({ type: 'exam', tier: ti, fee });
  return true;
}
function WORLD_LAYOUT(T) { return T.room === 'home' ? 'home' : T.layout === 'table' ? 'table' : 'room'; }
function setPhase(s, ph, dur) { s.phase = ph; s.t = 0; s.dur = dur; }
function tellTime(s, T) { return T.tell + G.gear.predict * tune.predict_bonus + (s.type === 'reaper' ? G.gear.candle * tune.candle_bonus : 0); }
function footstep(s, near1) {
  if (s.type === 'reaper' || s.type === 'omega' || s.type === 'webcam') return; // 저승사자는 발소리가 없다
  let pan = s.side === 'L' ? -0.75 : 0.75;
  if (s.phase === 'cross') pan = (s.from === 'L' ? -0.75 : 0.75) * (1 - 2 * clamp(s.t / s.dur, 0, 1));
  const near = near1 != null ? near1 : 1 - Math.min(1, Math.abs(s.u - 0.5) * 1.6);
  sfx.foot(pan, 0.04 + 0.08 * near);
}
function teleport(s, T) { s.blink = 0.5; s.side = rng() < 0.5 ? 'L' : 'R'; s.u = 0.1 + rng() * 0.8; setPhase(s, 'stand', procDur(T.stand) * 0.7); s.away = rng() < 0.5; sfx.warp(); }
function stepWebcam(s, T, dt) { // 원격 감독: 꺼짐 → 깜빡(예고) → LIVE
  if (s.t < s.dur) return;
  if (s.phase === 'stand') setPhase(s, 'tell', tune.webcam_tell + G.gear.predict * tune.predict_bonus);
  else if (s.phase === 'tell') { if (rng() < T.feint) setPhase(s, 'stand', between(tune.webcam_off_min, tune.webcam_off_max) * 0.5); else { setPhase(s, 'watch', between(tune.webcam_live_min, tune.webcam_live_max)); sfx.cctv(); } }
  else setPhase(s, 'stand', between(tune.webcam_off_min, tune.webcam_off_max));
}
function stepFixed(s, T, dt) { // 앞에 앉은 면접관·심사위원·염라대왕·Ω: 걷지 않고, 한 번에 한 명씩 고개를 든다
  if (s.t < s.dur) return;
  const r = rng(), busy = E.staff.some(o => o !== s && o.fixed && (o.phase === 'tell' || o.phase === 'watch'));
  if (s.phase === 'stand') { if (!busy && r < 0.6) setPhase(s, 'tell', tellTime(s, T)); else { setPhase(s, 'stand', procDur(T.stand) * (busy ? 0.5 : 1)); s.away = !s.away; } }
  else if (s.phase === 'tell') { if (r < T.feint) setPhase(s, 'stand', procDur(T.stand) * 0.6); else setPhase(s, 'watch', T.watch); }
  else { setPhase(s, 'stand', procDur(T.stand)); s.away = rng() < 0.5; }
}
function stepStaff(s, T, dt) {
  if (s.blink > 0) { s.blink -= dt; return; }
  if (s.visit) { // 교수님은 불쑥 들어오고, 선생님은 커피 가지러 나간다
    if (s.out) { s.outT -= dt; if (s.outT <= 0) { s.out = false; s.inT = between(tune.visit_in_min, tune.visit_in_max); s.u = 0.94; s.dir = -1; setPhase(s, 'walk', procDur(T.walk)); sfx.door(); flash(`${s.name} 들어옴`, PAL.bad); } return; }
    s.inT -= dt;
    if (s.inT <= 0 && (s.phase === 'stand' || s.phase === 'walk')) { s.out = true; s.outT = between(tune.visit_out_min, tune.visit_out_max); sfx.door(); flash(`${s.name} 나감`, PAL.good); return; }
  }
  s.t += dt;
  if (s.type === 'webcam') return stepWebcam(s, T, dt);
  if (s.phase === 'help') { // 손 든 수험생에게 가 있는 동안은 나를 못 본다
    const h = s.help;
    if (h.k < 1) { h.k = Math.min(1, h.k + dt / h.go); s.walk += dt; s.stepT += dt; if (s.stepT >= tune.footstep_gap) { s.stepT = 0; footstep(s); } }
    else { h.stay -= dt; if (h.stay <= 0) { s.u = h.u; s.help = null; setPhase(s, 'stand', procDur(T.stand)); s.away = rng() < 0.5; } }
    return;
  }
  if (s.phase === 'peek') { // 통로에서 사라졌다가 내 책상 밑에서 올려다본다. 이때 스캔하면 끝
    const p = s.peek; p.t -= dt;
    if (p.stage === 'sneak' && p.t <= 0) { p.stage = 'stare'; p.t = tune.peek_stare; }
    else if (p.stage === 'stare' && p.t <= 0) { s.peek = null; setPhase(s, 'stand', procDur(T.stand)); s.away = rng() < 0.5; }
    return;
  }
  if (s.phase === 'check') { // 내 책상 앞으로 와서 수험표·계산기를 본다
    const c = s.check;
    if (c.stage === 'go') { c.k = Math.min(1, c.k + dt / 1.1); s.walk += dt; s.stepT += dt; if (s.stepT >= tune.footstep_gap) { s.stepT = 0; footstep(s, 1); } if (c.k >= 1) { c.stage = 'at'; c.t = tune.check_time; sfx.beep(); } }
    else if (c.stage === 'at') {
      c.t -= dt;
      if (c.t <= 0) {
        if (T.check === 'calc') { const add = tune.calc_sus * gearCut(G.gear.calccover); if (add > 0.005) { E.sus = Math.min(1, E.sus + add); E.source = { how: 'check', by: s }; flash(`계산기가 수상하다! 의심도 +${Math.round(add * 100)}%`, PAL.bad); } else flash('계산기 검사 통과', PAL.good); }
        c.stage = 'back';
      }
    } else { c.k -= dt / 1.1; s.walk += dt; if (c.k <= 0) { s.check = null; setPhase(s, 'stand', procDur(T.stand)); s.away = rng() < 0.5; } }
    return;
  }
  if (s.fixed) return stepFixed(s, T, dt);
  if (s.phase === 'walk' || s.phase === 'cross') { // 걸을 때만 발소리가 난다
    s.walk += dt; s.stepT += dt;
    if (s.phase === 'walk') {
      s.u += s.dir * T.speed * tune.proctor_speed * dt;
      if (s.u < 0.06) { s.u = 0.06; s.dir = 1; } else if (s.u > 0.94) { s.u = 0.94; s.dir = -1; }
    }
    if (s.stepT >= tune.footstep_gap) { s.stepT = 0; footstep(s); }
  }
  if (s.t < s.dur) return;
  const r = rng(), tell = tellTime(s, T), warp = T.mech.includes('teleport') && s.type === 'reaper';
  if (s.phase === 'stand') {
    if (r < 0.38) setPhase(s, 'tell', tell);
    else if (warp) teleport(s, T);
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
    if (r < 0.5 || warp) { setPhase(s, 'stand', procDur(T.stand)); s.away = rng() < 0.5; }
    else { setPhase(s, 'walk', procDur(T.walk)); s.dir = rng() < 0.5 ? -1 : 1; }
  } else if (s.phase === 'cross') {
    s.side = s.side === 'L' ? 'R' : 'L'; s.u = s.crossEnd === 'back' ? 0.06 : 0.94; s.dir = s.u > 0.5 ? -1 : 1; s.from = null;
    setPhase(s, 'stand', procDur(T.stand)); s.away = rng() < 0.5;
  }
}
function stepCctv(c, dt) {
  const was = c.on;
  c.ph += dt * Math.PI * 2 / tune.cctv_period; c.a = Math.sin(c.ph); c.on = Math.abs(c.a) < 0.28;
  if (c.on && !was && G.gear.cctvjam < 3) sfx.cctv();
}
function stepPulse(p, dt) {
  if (p.active > 0) { p.active -= dt; return; }
  if (p.warn > 0) {
    const before = Math.ceil(p.warn); p.warn -= dt;
    if (p.warn <= 0) { p.warn = 0; p.active = 0.6; sfx.pulse(); if (E.T.pulse === 'emp' && !E.ai && E.pulseCut > 0) { E.scan *= 1 - tune.emp_wipe * E.pulseCut; flash('EMP! 스캔이 날아갔다', PAL.bad); } }
    else if (Math.ceil(p.warn) !== before) sfx.beep();
    return;
  }
  p.next -= dt;
  if (p.next <= 0) { p.warn = 1.6; p.next = tune.pulse_gap * (0.7 + rng() * 0.6); sfx.beep(); if (E.T.pulse === 'alert') flash('폰이 떤다... 재난문자가 온다! 손 떼기', PAL.warn); else if (E.T.pulse === 'emp') flash('EMP 충전 중! 손 떼기', PAL.warn); }
}
function stepEvents(T, dt) { // 시험마다 다른 사건: 손 드는 수험생, 신분 확인, 늘어나는 감독관
  const free = s => !s.fixed && !s.out && !(s.blink > 0) && (s.phase === 'stand' || s.phase === 'walk');
  if (T.mech.includes('crowd')) {
    E.crowdT -= dt;
    if (E.crowdT <= 0) {
      E.crowdT = between(tune.crowd_gap_min, tune.crowd_gap_max);
      const c = E.staff.filter(free), s = c[Math.floor(rng() * c.length)];
      if (s) { const u = clamp(s.u + (rng() < 0.5 ? -1 : 1) * (0.25 + rng() * 0.3), 0.08, 0.92); s.help = { u0: s.u, u, k: 0, go: Math.max(0.5, Math.abs(u - s.u) / Math.max(0.05, T.speed * tune.proctor_speed * 1.6)), stay: tune.crowd_time }; s.phase = 'help'; s.t = 0; sfx.hand(); flash('"저기요, 감독관님!"', PAL.good); }
    }
  }
  if (T.mech.includes('idcheck')) {
    E.checkT -= dt;
    if (E.checkT <= 0) {
      E.checkT = between(tune.check_gap_min, tune.check_gap_max);
      const c = E.staff.filter(free), s = c[Math.floor(rng() * c.length)];
      if (s) { s.check = { stage: 'go', k: 0, t: 0, u0: s.u }; s.phase = 'check'; s.t = 0; flash(T.check === 'calc' ? '계산기 검사하러 온다!' : '신분 확인하러 온다!', PAL.warn); }
    }
  }
  if (T.mech.includes('peek')) {
    E.peekT -= dt;
    if (E.peekT <= 0) {
      E.peekT = between(tune.peek_gap_min, tune.peek_gap_max);
      const c = E.staff.filter(free), s = c[Math.floor(rng() * c.length)];
      if (s) { s.peek = { stage: 'sneak', t: tune.peek_sneak }; s.phase = 'peek'; s.t = 0; sfx.creak(); }
    }
  }
  if (T.mech.includes('clones') && E.staff.length < tune.clone_max) {
    E.cloneT -= dt;
    if (E.cloneT <= 0) {
      E.cloneT = tune.clone_gap; E.clones++;
      const blocked = E.clones <= G.gear.clone;
      E.staff.push(newStaff({ type: 'agent', name: `평행우주 ${E.clones + 1}번 관리관` }, E.staff.length, T, { clone: E.clones, blocked }));
      sfx.warp(); flash(blocked ? `감독관이 한 명 더! (내 분신이 맡는다)` : `감독관이 한 명 더! 이제 ${E.staff.length}명`, blocked ? PAL.good : PAL.bad);
    }
  }
}
function threat() { // 지금 스캔하면 초당 오르는 의심도와, 스캔하지 않아도 오르는 의심도
  const T = E.T, g = G.gear, base = T.sus * tune.sus_scale, table = E.layout === 'table';
  let r = 0, idle = 0, src = null;
  const add = (v, how, by) => { if (v > 0) { r += v; if (!src || v > src.v) src = { v, how, by }; } };
  for (const s of E.staff) {
    if (s.out || s.blink > 0 || s.blocked || s.asleep || s.phase === 'help' || s.phase === 'peek') continue;
    let k = 0;
    if (s.phase === 'watch') k = 1; else if (s.phase === 'tell') k = tune.tell_ratio;
    else if (s.phase === 'check') k = s.check.stage === 'at' ? tune.check_rate : s.check.stage === 'go' ? tune.tell_ratio : 0;
    else if (T.mech.includes('threeeyes') && s.type === 'alien') k = tune.peripheral * gearCut(g.thirdeye); // 세 번째 눈은 등을 돌려도 본다
    if (s.type === 'webcam') k *= gearCut(g.deepcam);
    else if (table && s.fixed) k *= Math.max(0, 1 - g.gazefix * tune.gaze_cut);
    add(base * k, s.phase === 'check' ? 'check' : s.type === 'webcam' ? 'webcam' : 'watch', s);
    if (s.phase === 'check' && s.check.stage === 'at' && E.ai && !E.fb && g.autooff < 1) idle += base * tune.glow_rate;          // 렌즈에 뜬 AI 답이 보인다
    if (s.type === 'webcam' && s.phase === 'watch' && E.view !== 'paper') idle += base * tune.look_away_rate * gearCut(g.deepcam); // 웹캠 앞에서 딴 데 보기
  }
  if (E.cctv && E.cctv.on) add(base * tune.cctv_rate * jamFactor(g.cctvjam, 3), 'cctv', null);
  r *= Math.pow(1 - tune.stealth_cut, g.stealth); idle *= Math.pow(1 - tune.stealth_cut, g.stealth);
  if (E.pulse && E.pulse.active > 0) { const v = tune.pulse_rate * E.pulseCut; r += v; if (v > 0 && (!src || v > src.v)) src = { v, how: T.pulse || 'pulse', by: null }; }
  return { r, idle, src };
}
function markAnswer(i, how) { // 정답인지는 시험이 끝날 때까지 모른다
  if (!E || E.fb || E.caught || E.over || E.start > 0 || E.breakT > 0 || i < 0 || i > 3) return;
  if (how !== 'auto' && (E.view !== 'paper' || E.viewT < 1)) { if (how === 'key' && E.layout !== 'table') setView('paper'); return; } // 시험지를 보고 있어야 마킹 (숫자 키는 먼저 고개를 숙인다)
  const q = E.qs[E.qi], viaAI = how === 'auto' || (E.ai && i === q.aiPick);
  if (q.final) { if (E.ai && how !== 'auto') finishFinal(i); return; } // 마지막 문제: 무엇을 골라도 채점 없이 엔딩으로
  E.answers[E.qi] = i; E.via[E.qi] = how === 'auto' ? 'auto' : viaAI ? 'ai' : 'self';
  E.fb = { pick: i, t: 0, how };
  if (viaAI) { E.aiN++; G.stats.aiQ++; } else { E.selfN++; G.stats.selfQ++; }
  if (E.T.mech.includes('human')) { // AI가 고른 답만 내면 AI라는 걸 들킨다
    E.aiSus = clamp(E.aiSus + (viaAI ? tune.ai_sus_gain * gearCut(G.gear.humanmod) : -tune.ai_sus_drop), 0, 1);
    if (E.aiSus >= 1) { E.source = { how: 'ai', by: E.staff[0] }; getCaught(); }
  }
  G.hints.pick = true;
  sfx.pencil();
  events.push({ type: 'mark', q: E.qi, pick: i, how }); loop('act');
}
function completeScan() {
  E.scan = 1; E.ai = true; E.earbudT = 0; G.hints.scan = true; sfx.ai(); G.stats.scans++; E.downT = Math.max(E.downT, tune.answer_keep);
  if (E.qs[E.qi].final) { E.glitch = 1; sfx.pulse(); sfx.warp(); }
  for (let j = 1; j <= G.gear.wide; j++) { const nq = E.qs[E.qi + j]; if (nq && nq.kind !== 'listen') nq.pre = true; } // 광각 렌즈: 다음 문제도 미리 읽음
  events.push({ type: 'scan', q: E.qi });
}
function closePart() { // 이번 교시의 답안을 걷는다
  E.qs.forEach((q, i) => E.done.push(E.answers[i] == null ? { r: '-' } : { r: E.answers[i] === q.answer ? 'O' : 'X', via: E.via[i] }));
  E.leftSum += Math.max(0, E.timeLeft);
}
function endPart(all) {
  const T = E.T, right = E.qs.filter((q, i) => E.answers[i] === q.answer).length;
  closePart();
  if (E.part + 1 >= E.parts) { E.over = true; E.all = all; E.endT = 0; if (!all) sfx.bell(); return; }
  if (T.mech.includes('adaptive') && E.part === 0 && right / E.qs.length >= 0.8) E.adaptHard = true; // 1모듈을 잘 보면 2모듈이 어려워진다
  sfx.bell(); beginPart(E.part + 1, false);
  if (E.adaptHard && E.part === 1) flash('Module 2: 어려운 문제 배정 (AI 정답률 하락)', PAL.warn);
}
function nextQuestion() {
  E.fb = null; E.scan = 0; E.ai = false; E.earbudT = 0; E.unsafeT = 0; E.listen = 0;
  if (E.qi + 1 >= E.qs.length) { endPart(true); return; }
  E.qi++; sfx.flip();
  if (E.qs[E.qi].pre) { E.scan = 1; E.ai = true; }
  if (E.qs[E.qi].kind === 'listen') sfx.radio();
  if (E.qs[E.qi].final) { E.finalQ = true; E.sus = 0; for (const st of E.staff) { st.phase = 'stand'; st.asleep = true; st.away = true; } sfx.warp(); } // 감독관의 눈이 감기고 시계가 멈춘다
}
function getCaught() {
  if (E.caught) return;
  E.caught = true; E.endT = 0; G.stats.caught++; ptrs.clear();
  const src = E.source, w = E.staff.find(s => s.phase === 'watch' && !s.out) || E.staff.find(s => s.phase === 'tell' && !s.out);
  if (src && src.how !== 'watch') { E.caughtHow = src.how; E.caughtBy = src.by || E.staff[0]; }
  else { E.caughtBy = (src && src.by) || w || E.staff[0]; E.caughtHow = 'watch'; }
  sfx.caught(); events.push({ type: 'caught', how: E.caughtHow });
}
function examHint() { // 첫 시험(모의평가)에서만, 한 번에 하나
  if (E.tier !== 0 || G.stats.exams > 0) return null;
  if (E.rising) return '누가 보고 있어요! 손 떼기';
  if (!G.hints.look) return '화면 양옆을 꾹: 누르는 동안 고개 돌려 감독관 보기 (← →)';
  if (E.view === 'left' || E.view === 'right') return G.hints.desk ? null : '떼면 시험지로 돌아옵니다 · 위를 꾹: 정면 (↑)';
  if (E.view === 'front') return G.hints.scan ? null : '떼면 시험지로 돌아옵니다';
  if (!E.ai && !G.hints.scan) return E.holding ? null : '아무도 안 볼 때 책상을 꾹: AI 스캔 (Space). 떼면 처음부터';
  if (E.ai && !E.fb && !G.hints.pick) return E.ar ? 'AI가 고른 보기를 눌러 마킹 (1~4)' : '소매 속 액정의 번호를 보고, 그 보기를 눌러 마킹 (1~4)';
  return null;
}
function pickAt(x, y) { return E.layout === 'table' ? arRowAt(E, x, y) : WORLD.pickChoice(x, y); }
function updateExam(dt) {
  const T = E.T, g = G.gear;
  const taps = takeTaps();
  if (E.flash) E.flash.t += dt;
  E.runShown = G.opts.timer ? G.run.t : 0;
  if (E.caught || E.over) { E.endT += dt; takeReleases(); if (E.endT > (E.caught ? 2.0 : 0.9)) finishExam(); return; }
  if (pressed('KeyP') || pressed('Escape')) { scene = 'pause'; return; }
  // 고개 돌리기 (돌아보는 것만으로는 의심받지 않는다)
  if (E.start > 0 || E.breakT > 0) { if (E.layout === 'room' && E.view !== 'front' && !FORCE_VIEW) setView('front'); } else viewInput(taps);
  const held = E.start <= 0 && !(E.breakT > 0) && E.view === 'paper' && E.viewT >= 1 && scanHeld(); // 책상을 보는 채로 꾹 눌러야 스캔
  E.viewT = Math.min(1, E.viewT + dt / tune.look_time);
  const onPaper = E.view === 'paper' && E.viewT >= 1;
  for (const [x, y] of takeReleases()) { const i = pickAt(x, y); if (i >= 0) markAnswer(i, 'tap'); }
  for (let i = 0; i < 4; i++) if (pressed('Digit' + (i + 1)) || pressed('Numpad' + (i + 1))) markAnswer(i, 'key');
  if (E.caught) return;
  if (E.start > 0) { E.start -= dt; E.holding = false; E.hint = null; if (E.start <= 0 && E.qs[0].kind === 'listen') sfx.radio(); return; }
  if (E.breakT > 0) { E.breakT -= dt; E.holding = false; E.sus = Math.max(0, E.sus - tune.sus_decay * dt); if (E.breakT <= 0) E.start = 1.0; return; }
  if (E.finalQ) { // 마지막 문제: 아무도 보지 않는다. 스캔하면 모든 보기에 100%
    const q = E.qs[E.qi], hold = onPaper && held && !E.ai;
    E.holding = hold; E.rising = false; E.danger = false; E.hint = null; E.glitch = Math.max(E.ai ? 0.55 : 0.15, E.glitch - dt * 0.4);
    if (hold) { E.scan += dt / scanSecondsAt(g.lens); E.tick += dt; if (E.tick > 0.12) { E.tick = 0; sfx.scan(); } if (E.scan >= 1) completeScan(); }
    if (E.ai) E.downT = Math.max(E.downT, 1);
    return;
  }
  E.timeLeft -= dt; E.clockT += dt;
  if (E.timeLeft <= 0) { E.timeLeft = 0; endPart(false); return; }
  for (const s of E.staff) stepStaff(s, T, dt);
  if (E.cctv) stepCctv(E.cctv, dt);
  if (E.pulse) stepPulse(E.pulse, dt);
  stepEvents(T, dt);
  E.float = T.mech.includes('float') ? 0.5 + 0.5 * Math.sin(E.clockT * 1.1) : 0;
  const q = E.qs[E.qi], th = threat(), listen = q.kind === 'listen';
  E.danger = th.r > 0.02;
  const atDesk = E.staff.some(s => s.phase === 'check' && s.check.stage === 'at');
  const manual = onPaper && !listen && held && !(atDesk && g.autooff >= 2); // 자동 소등 2단계: 책상 앞이면 스캔도 멈춘다
  let autoHold = false;
  if (g.autoscan > 0 && !T.noAuto && !listen && !E.ai && !E.fb && !atDesk && !E.staff.some(s => s.phase === 'peek') && (E.view === 'paper' || E.view === 'front')) { // 자동 스캔 칩: 아무도 안 볼 때 알아서 고개를 숙이고 스캔
    const safe = th.r === 0 && !(E.pulse && E.pulse.warn > 0 && E.pulse.warn < 0.45);
    if (safe) { E.unsafeT = 0; if (E.view === 'front') setView('paper'); } else E.unsafeT += dt;
    autoHold = onPaper && (safe || E.unsafeT < autoDelayAt(g.autoscan));
  }
  const hold = (manual || autoHold) && !E.ai && !E.fb;
  if (hold && !E.wasHold && T.mech.includes('omega') && E.scan < 0.05) { // Ω는 스캔 박자를 읽는다: 지난번과 같은 간격이면 들킨다
    const t = E.clockT, gap = E.lastScanT == null ? null : t - E.lastScanT, win = tune.omega_window * gearCut(g.offbeat);
    if (gap != null && E.lastGap != null && Math.abs(gap - E.lastGap) < win) { E.sus = Math.min(1, E.sus + tune.omega_jump); E.source = { how: 'omega', by: E.staff[0] }; flash('Ω가 박자를 읽었다! 간격을 바꿔라', PAL.bad); sfx.pulse(); }
    E.lastGap = gap; E.lastScanT = t;
  }
  const peeker = E.staff.find(s => s.phase === 'peek' && s.peek.stage === 'stare');
  if (peeker && hold) { E.sus = 1; E.source = { how: 'peek', by: peeker }; getCaught(); return; } // 올려다보는 눈과 마주친 채 스캔하면 끝
  if (!hold && !E.ai && !E.fb && E.scan > 0) E.scan = tune.scan_drop >= 10 ? 0 : Math.max(0, E.scan - tune.scan_drop * dt); // 손을 떼면 스캔이 처음으로 돌아간다
  E.wasHold = hold; E.holding = hold; E.autoHolding = autoHold && !manual;
  E.rising = (hold && th.r > 0) || th.idle > 0;
  if (hold && th.r > 0) { E.sus += th.r * dt; E.source = th.src; }
  if (th.idle > 0) { E.sus += th.idle * dt; if (!(hold && th.r > 0)) E.source = { how: atDesk ? 'check' : 'webcam', by: E.staff.find(s => s.phase === 'check') || E.staff[0] }; }
  if (!E.rising) E.sus -= tune.sus_decay * dt;
  E.sus = clamp(E.sus, 0, 1);
  if (E.sus >= 1) { getCaught(); return; }
  if (listen && !E.ai && !E.fb && g.earbud > 0) { E.listen += dt / tune.listen_time; if (E.listen >= 1) { E.listen = 1; completeScan(); } } // 이어폰이 방송을 받아쓴다
  if (hold) { // 스캔: 1/3, 2/3에서 오답이 하나씩 지워지고, 끝나면 AI의 답
    const before = Math.floor(E.scan * 3 + 1e-6);
    const secs = scanSecondsAt(g.lens) * E.stickerSlow * (T.mech.includes('long') ? tune.long_scan : 1) * (T.mech.includes('fatigue') ? 1 + tune.fatigue_step * E.part * gearCut(g.eyedrop) : 1);
    E.scan += dt / secs * (1 - tune.float_wobble * E.float);
    E.tick += dt; if (E.tick > 0.12) { E.tick = 0; sfx.scan(); }
    if (E.scan >= 1) completeScan();
    else if (Math.floor(E.scan * 3 + 1e-6) > before) sfx.elim();
  }
  if (E.ai && !E.fb && g.earbud > 0 && !T.noAuto && q.conf >= earbudNeedAt(g.earbud)) { E.earbudT += dt; if (E.earbudT >= tune.earbud_delay) markAnswer(q.aiPick, 'auto'); }
  if (E.fb) { E.fb.t += dt; if (E.fb.t >= 0.35 && !E.caught) nextQuestion(); }
  if (E.sus > 0.3) { E.beat -= dt; if (E.beat <= 0) { E.beat = 1 - 0.55 * E.sus; sfx.beat(0.08 + 0.12 * E.sus); } } else E.beat = 0;
  E.hint = examHint();
}
function finishFinal(pick) {
  G.stats.exams++; G.stats.passes++; G.cleared[LAST] = true; G.best[LAST] = 100;
  if (G.run.splits[LAST] == null && !G.run.done) G.run.splits[LAST] = Math.round(G.run.t);
  if (!G.ended) { G.ended = true; addRecord(); }
  G.endSeen = true; events.push({ type: 'result', passed: true, final: true, pick }); loop('result');
  save(); STATE.endT = 0; scene = 'ending';
}
function reportByBroker(line) { // 브로커의 제보: 전수조사 의심이 크게 오른다
  G.heat = clamp(G.heat + tune.black_heat, 0, 0.99); G.black = null;
  addNews('reg', `익명 제보 접수: "초소형 카메라 구매자 명단이 있다". 당국이 고득점자부터 들여다본다 (의심 +${Math.round(tune.black_heat * 100)}%)`);
  STATE.note = { text: `브로커: "${line}"`, t: 0 }; sfx.caught(); save();
}
function unlockNews(ti) { // 처음 합격: 신상 입고, 새 AI 모델, 다음 시험, 새 막
  const T = TIERS[ti], out = [];
  addNews('exam', `${T.name} 합격! ${T.pay} 입금`);
  if (T.news) { addNews('reg', T.news); out.push('뉴스 속보'); }
  const gear = CONFIG.gear.filter(d => d.unlock === ti && d.caps[T.act - 1] > 0);
  for (const d of gear) { G.fresh[d.id] = true; addNews('shop', `신상 입고: ${d.name}${d.ladder ? ` "${d.ladder[0]}"` : ''} · ${GEAR_BLURB[d.id]}`); }
  if (gear.length) out.push(`신상 입고 ${gear.length}종`);
  CONFIG.models.forEach((m, i) => { if (m.rel === ti) { G.fresh.model = true; addNews('model', `속보: ${m.name} 출시! ${m.note}. AI마켓에서 구독하세요`); out.push(`${m.name} 출시`); } });
  const nx = TIERS[ti + 1];
  if (nx && nx.act !== T.act) { // 새 막: 가진 장비의 다음 단계가 풀린다
    const up = CONFIG.gear.filter(d => gearOpen(d) && d.caps[nx.act - 1] > d.caps[T.act - 1]);
    for (const d of up) G.fresh[d.id] = true;
    addNews('act', `${CONFIG.acts[nx.act - 1]} 개막! 장비 ${up.length}종의 신형이 AI마켓에 풀렸어요`); out.push(`${CONFIG.acts[nx.act - 1]} 개막`);
  }
  if (nx) addNews('exam', `다음 시험 접수 시작: ${nx.name}`);
  return out;
}
function finishExam() {
  const T = E.T, pass = Math.round(tune.pass_mark * 100);
  if (E.caught && E.done.length < E.parts * T.qn) { closePart(); while (E.done.length < E.parts * T.qn) E.done.push({ r: '-' }); }
  const marks = E.done, qn = marks.length, correct = marks.filter(m => m.r === 'O').length, score = Math.round(correct / qn * 100);
  let passed = !E.caught && correct / qn >= tune.pass_mark - 1e-9, perfect = passed && correct === qn, audited = false;
  const heat0 = G.heat, tut = T.mech.includes('tutorial');
  if (!tut) { // 너무 잘 보면 시험이 끝난 뒤에 의심이 쌓인다. 꽉 차면 전수조사로 합격 취소
    if (perfect) G.heat += tune.heat_perfect; else if (passed && score >= 90) G.heat += tune.heat_high; else G.heat -= tune.heat_cool;
    G.heat = clamp(G.heat, 0, 1);
    if (passed && G.heat >= 1) { audited = true; passed = false; perfect = false; G.heat = tune.heat_after; addNews('reg', `전수조사: ${T.name} 고득점자 답안 재검증. 합격이 취소됐다`); }
  }
  const bonus = passed ? tune.time_bonus * (E.leftSum / (E.timeTotal * E.parts)) : 0, coach = passed ? coachMult() : 1;
  const reward = passed ? Math.round(correct * T.reward * tune.reward_scale * (1 + bonus) * coach * (perfect ? tune.jackpot_mult : 1)) : 0;
  G.stats.exams++; if (passed) G.stats.passes++; else if (!E.caught) G.stats.fails++; if (perfect) G.stats.tops++;
  if (G.black && G.black.seen) reportByBroker('답이 없으시네. 그럼 제보합니다'); else if (G.black) G.black.seen = true; // 협박을 시험 한 번 넘기도록 내버려 두면 제보당한다
  let unlock = '';
  const final = passed && E.tier === LAST;
  if (passed) {
    const first = !G.cleared[E.tier];
    G.cleared[E.tier] = true; G.best[E.tier] = Math.max(G.best[E.tier], score);
    if (E.tier + 1 < TIERS.length && G.unlocked < E.tier + 2) G.unlocked = E.tier + 2;
    if (first) {
      if (G.run.splits[E.tier] == null && !G.run.done) G.run.splits[E.tier] = Math.round(G.run.t);
      unlock = unlockNews(E.tier).join(' · '); if (unlock) sfx.news();
      if (G.flags.cam && !G.black && (T.id === 'tax' || T.id === 'bar' || T.id === 'calbar')) { // 브로커가 다시 연락한다
        G.black = { amount: Math.ceil(tune.black_mult * T.reward * tune.reward_scale), n: (G.flags.blackN || 0) + 1 }; G.flags.blackN = G.black.n;
        addNews('tg', '텔레그램 새 메시지: "사장님, 요즘 단속 심한 거 아시죠?"');
      }
    }
  }
  G.pending = (G.pending || 0) + reward; loop('result'); if (reward > 0) loop('reward'); // 돈은 고시원에 돌아갈 때 입금 문자로 들어온다
  if (reward > 0) addNews('bank', `[입금] ${T.pay} ${won(reward)}원${perfect ? ` (수석 x${tune.jackpot_mult})` : ''}`);
  if (!tut && G.heat - heat0 > 0.01 && !audited) addNews('reg', `수험생 커뮤니티: "${T.name} 고득점자 수상하다" (전수조사 의심 ${Math.round(G.heat * 100)}%)`);
  if (!tut) G.mail = { tier: E.tier, tierName: T.name, marks, correct, qn, pass, score, caught: E.caught, passed, stamp: audited ? '합격 취소' : E.caught ? '부정행위' : perfect ? '수석 합격' : passed ? '합격' : '불합격' };
  if (final && !G.ended) { G.ended = true; addRecord(); }
  RZ = { tier: E.tier, tierName: T.name, passed, perfect, caught: E.caught, correct, qn, score, pass, reward, bonus, coach, pay: T.pay, fee: E.fee,
    marks, self: E.selfN, ai: E.aiN, heat0, heat: G.heat, audited, tut, unlock, final, next: passed ? (final ? 'end' : E.tier + 1) : null, focus: passed ? 'next' : 'retry', canRetry: true, canNext: true };
  perfect ? sfx.top() : passed ? sfx.pass() : sfx.fail();
  RZ.stamp = audited ? '합격 취소' : E.caught ? '부정행위' : perfect ? '수석 합격' : passed ? '합격' : '불합격';
  E.result = RZ; E.holding = false; E.scan = 0; E.rising = false; E.sus = Math.min(E.sus, 0.4); // 가채점은 기기 화면에, 통지표는 우편으로
  events.push({ type: 'result', passed, perfect, caught: E.caught, correct, reward, fee: E.fee });
  save(); scene = 'results';
}

// ---- 고시원: 방 · 노트북(AI마켓) · 일정표 · 폰 · 택배 ------------------------------------------
function settle() { if (G.pending > 0) { addMoney(G.pending); G.pending = 0; sfx.news(); save(); } } // 밀린 입금
function goHub(view) { scene = 'hub'; const hv = STATE.hv; hv.view = 'room'; hv.target = 'room'; hv.zoom = 0; hv.bpage = null; if (view) enterView(view, true); }
const deskOpen = () => !!(G.flags.sold || G.black); // 바탕화면으로 나갈 수 있는가
function enterView(v, instant) {
  const hv = STATE.hv; hv.view = v; hv.target = v; hv.zoom = instant ? 1 : 0;
  if (v === 'laptop') { hv.app = deskOpen() && !G.flags.deskSeen ? 'desk' : 'shop'; if (hv.app === 'desk') G.flags.deskSeen = true; hv.page = 0; hv.tab = shopItems('new').length ? 'new' : G.fresh.model ? 'model' : hv.tab === 'new' ? 'glass' : hv.tab; G.hints.shop = true; STATE.shownIds.clear(); }
  if (v === 'board') { hv.act = 0; hv.bpage = null; }
  if (v === 'mail') { STATE.mailImg = null; }
  if (v === 'phone') { hv.ptab = phoneUnread() ? 'news' : hv.ptab; hv.npage = 0; }
  if (!instant) sfx.zoom();
}
function leaveView() { // 방으로 물러난 뒤: 본 신상은 NEW를 떼고, 주문한 게 있으면 택배가 온다
  const hv = STATE.hv, v = hv.view;
  if (v === 'laptop') { for (const id of STATE.shownIds) delete G.fresh[id]; STATE.shownIds.clear(); if (hv.order.length && !hv.parcel) hv.parcelT = 0.7; }
  if (v === 'phone') G.seen = G.news.length;
  if (v === 'mail') G.mail = null; // 읽은 통지표는 치운다
  hv.view = 'room'; save();
}
function soldOut(d) { return d.id === 'lens' && G.gear.lens === 0 && !G.flags.cam; } // 초소형 카메라는 품절: 텔레그램 브로커에게서만
function brokerCost() { return Math.ceil(gearCost('lens', 0) * tune.broker_markup); }
function buyGear(id, viaBroker) {
  const d = gearDef(id), lv = G.gear[id], cost = viaBroker ? brokerCost() : gearCost(id), hv = STATE.hv;
  if (d && soldOut(d) && !viaBroker) { sfx.no(); if (!G.flags.sold) { G.flags.sold = true; addNews('reg', '초소형 카메라 전국 품절. 쇼핑몰들 판매 중단 · 텔레그램에 "구해 드림" 글이 돈다'); } STATE.note = { text: '품절되었습니다', t: 0 }; save(); return; }
  if (viaBroker) G.flags.cam = true;
  if (!d || !gearOpen(d) || lv >= gearCap(d) || G.money < cost) { sfx.no(); return; }
  G.money -= cost; G.gear[id]++; delete G.fresh[id];
  const name = d.kind === 'count' ? `${botName(G.gear[id])} (대리 응시 ${G.gear[id]}명)` : gearName(id, G.gear[id]);
  hv.order.push({ id, name }); hv.hidden[id] = true;
  sfx.buy(); STATE.pops.push({ v: 0, t: 0, scene: 'hub', text: `주문 완료: ${name}`, col: PAL.hud });
  if (d.kind === 'count' && CONFIG.bot_milestones.includes(G.gear[id])) addNews('bot', `대리 응시 ${G.gear[id]}명 돌파! 수입 x2 · 이제 "${botName(G.gear[id])}"`);
  events.push({ type: 'buy', id, lv: G.gear[id] }); save();
}
function buyModel() {
  const i = G.gear.model + 1;
  if (!modelOpen(i) || G.money < modelCost(i)) { sfx.no(); return; }
  G.money -= modelCost(i); G.gear.model = i; delete G.fresh.model;
  if (modelOpen(i + 1)) G.fresh.model = true;
  sfx.buy(); STATE.pops.push({ v: 0, t: 0, scene: 'hub', text: `구독 시작: ${CONFIG.models[i].name}`, col: '#b89cff' });
  events.push({ type: 'buy', id: 'model', lv: i }); save();
}
function hubKey(key) { // 다가간 화면에서 누른 칸
  const hv = STATE.hv, [a, b] = key.split(':');
  if (a === 'back') { if (hv.view === 'laptop' && hv.app !== 'desk' && deskOpen()) { hv.app = 'desk'; G.flags.deskSeen = true; sfx.flip(); } else { hv.target = 'room'; sfx.zoom(); } }
  else if (a === 'app') { hv.app = b; hv.page = 0; sfx.flip(); if (b === 'shop') hv.tab = shopItems('new').length ? 'new' : G.fresh.model ? 'model' : hv.tab === 'new' ? 'glass' : hv.tab; }
  else if (a === 'hush') { if (G.black && G.money >= G.black.amount) { G.money -= G.black.amount; G.black = null; sfx.buy(); STATE.pops.push({ v: 0, t: 0, scene: 'hub', text: '입막음비 송금 완료', col: PAL.warn }); save(); } else sfx.no(); }
  else if (a === 'refuse') { if (G.black) reportByBroker('후회하실 텐데'); }
  else if (a === 'broker') { if (G.money >= brokerCost()) buyGear('lens', true); else sfx.no(); }
  else if (a === 'tab') { hv.tab = b; hv.page = 0; sfx.flip(); }
  else if (a === 'page') hv.page += Number(b);
  else if (a === 'bpage') hv.bpage += Number(b);
  else if (a === 'npage') hv.npage += Number(b);
  else if (a === 'act') { hv.act = Number(b); hv.bpage = 0; sfx.flip(); }
  else if (a === 'ptab') { hv.ptab = b; sfx.flip(); }
  else if (a === 'buy') buyGear(b);
  else if (a === 'model') buyModel();
  else if (a === 'exam') { leaveView(); hv.zoom = 0; hv.target = 'room'; startExam(Number(b)); }
  else if (a === 'opt' && b === 'mute') setMuted(!muted);
  else if (a === 'opt' && b === 'fs') toggleFullscreen();
  else if (a === 'opt' && b === 'timer') { G.opts.timer = !G.opts.timer; save(); }
  else if (a === 'save' && b === 'export') exportSave();
  else if (a === 'save' && b === 'import') importSave();
  else if (a === 'wipe') { if (STATE.wipeArm > 0) wipe(); else STATE.wipeArm = 3; }
}
function hubAction(a) { // 방에서 누른 물건
  const hv = STATE.hv;
  if (a === 'go') startExam(nextTierIndex());
  else if (a === 'exams') enterView('board');
  else if (a === 'gear') enterView('laptop');
  else if (a === 'log') enterView('phone');
  else if (a === 'mail' && G.mail) enterView('mail');
  else if (a === 'parcel' && hv.parcel && hv.parcel.phase === 'wait') { hv.parcel.phase = 'open'; hv.parcel.t = 0; sfx.open(); }
}
function openParcels() { // 상자를 열지 않고 시험 보러 가도 장비는 쓴다
  const hv = STATE.hv; hv.hidden = {}; hv.order = []; hv.parcel = null; hv.parcelT = 0;
}
function updateHub(dt) {
  const hv = STATE.hv;
  STATE.wipeArm = Math.max(0, STATE.wipeArm - dt);
  if (hv.view !== 'room') {
    if (hv.target === 'room') { hv.zoom -= dt / tune.zoom_time; if (hv.zoom <= 0) { hv.zoom = 0; leaveView(); } }
    else hv.zoom = Math.min(1, hv.zoom + dt / tune.zoom_time);
  }
  if (hv.parcelT > 0) { hv.parcelT -= dt; if (hv.parcelT <= 0) { hv.parcel = { phase: 'arrive', t: 0, items: hv.order.slice() }; hv.order = []; sfx.knock(); } }
  if (hv.parcel) {
    const p = hv.parcel; p.t += dt;
    if (p.phase === 'arrive' && p.t > 0.35) { p.phase = 'wait'; p.t = 0; }
    else if (p.phase === 'open' && p.t > 0.9) { p.items.slice(0, 4).forEach((it, i) => STATE.pops.push({ v: 0, t: -i * 0.35, scene: 'hub', text: `설치 완료: ${it.name}`, col: PAL.gold })); hv.hidden = {}; hv.parcel = null; }
  }
  const taps = takeTaps(); takeReleases();
  if (scene !== 'hub') return;
  if (hv.view === 'room') {
    for (const [x, y] of taps) { hubAction(WORLD.pickHub(x, y)); if (scene !== 'hub') return; }
    if (pressed('Enter')) hubAction('go');
    else if (pressed('Digit1')) hubAction('exams'); else if (pressed('Digit2')) hubAction('gear'); else if (pressed('Digit3')) hubAction('log');
    STATE.hoverAct = STATE.hover ? WORLD.pickHub(STATE.hover[0], STATE.hover[1]) : null;
    if (STATE.hoverAct === 'parcel' && !(hv.parcel && hv.parcel.phase === 'wait')) STATE.hoverAct = null;
    if (STATE.hoverAct === 'mail' && !G.mail) STATE.hoverAct = null;
  } else {
    STATE.hoverAct = null;
    if (hv.zoom >= 1 && hv.target !== 'room') {
      for (let [x, y] of taps) {
        if (hv.view === 'laptop') { const lp = lapPoint([x, y]); if (!lp) { hv.target = 'room'; sfx.zoom(); continue; } [x, y] = lp; }
        const b = hitBtn(BTNS, x, y);
        if (b) { hubKey(b.key); if (scene !== 'hub' || hv.view === 'room') return; }
        else if (hv.view === 'mail') { hv.target = 'room'; sfx.flip(); }
        else if (hv.view !== 'laptop' && HUB_RECT && (x < HUB_RECT.x - 6 || x > HUB_RECT.x + HUB_RECT.w + 6 || y < HUB_RECT.y - 6 || y > HUB_RECT.y + HUB_RECT.h + 6)) { hv.target = 'room'; sfx.zoom(); } // 바깥을 누르면 방으로
      }
      if (pressed('Escape') || pressed('Backspace')) hubKey('back');
      if (hv.view === 'laptop' && hv.app === 'desk') { if (pressed('Digit1')) hubKey('app:shop'); else if (pressed('Digit2')) hubKey('app:tg'); }
      else if (hv.view === 'laptop' && hv.app === 'shop') { const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].findIndex(pressed); if (n >= 0) hubKey('tab:' + ['new', 'glass', 'device', 'model'][n]); }
      if (pressed('ArrowRight')) hubKey(hv.view === 'laptop' ? 'page:1' : hv.view === 'board' ? 'bpage:1' : 'npage:1');
      if (pressed('ArrowLeft')) hubKey(hv.view === 'laptop' ? 'page:-1' : hv.view === 'board' ? 'bpage:-1' : 'npage:-1');
    }
  }
  const hp = hv.view === 'laptop' ? lapPoint(STATE.hover) : STATE.hover;
  const over = hv.view === 'room' ? STATE.hoverAct : hp && hitBtn(BTNS, hp[0], hp[1]);
  const cur = over ? 'pointer' : ''; if (canvas.style.cursor !== cur) canvas.style.cursor = cur;
  if (STATE.away) { STATE.away.t += dt; if (STATE.away.t > 6) STATE.away = null; }
}

// ---- Scenes ------------------------------------------------------------------------------
let BTNS = [], HUB_RECT = null, LAPKIT = null;
function lapPoint(p) { const uv = p && WORLD.hubUV(p[0], p[1]); return uv ? [uv[0] * HUBUI.LW, uv[1] * HUBUI.LH] : null; }
function drawLaptop() { // 노트북 화면을 3D 표면에 그린다
  if (!LAPKIT) { const c = WORLD.laptopCanvas(); LAPKIT = makeKit(c.getContext('2d')); LAPKIT.S = c.width / HUBUI.LW; LAPKIT.b.setTransform(LAPKIT.S, 0, 0, LAPKIT.S, 0, 0); }
  BTNS = HUBUI.laptop(LAPKIT, STATE.hv, now, STATE.hv.zoom >= 1 ? lapPoint(STATE.hover) : null);
}
const ENDING_STATS = END_T.stats; // 엔딩: 문구가 지나가고 기록 화면이 뜨는 시각(초)
function reset() {
  seed = Number(params.get('seed')) || CONFIG.seed;
}
function makeState() {
  return {
    t: 0,
    get score() { return Math.floor(G.money); }, get money() { return G.money; }, get level() { return G.unlocked; },
    get goal() { return G.ended; }, get exam() { return E; }, get gear() { return G.gear; }, get game() { return G; }, get hub() { return STATE.hv; },
    get margin() { return E && scene === 'play' ? 1 - E.sus : 1; }, get gained() { return RZ && RZ.reward > 0 ? won(RZ.reward) + '원' : ''; },
  };
}
function drawNote(B) { // 화면 아래 짧은 알림 (응시료 부족, 자리 비움 수입)
  const msg = STATE.note ? STATE.note.text : STATE.away && scene === 'hub' ? `자리 비운 동안 대리 응시가 ${won(STATE.away.gain)}원 벌었어요` : null;
  if (!msg) return;
  const k = B.k, L = B.L, w = k.TW(msg, 12, 800) + 24, y = L.H - 26, col = STATE.note ? PAL.warn : PAL.gold;
  k.R(L.W / 2 - w / 2, y - 11, w, 22, PAL.dark); k.frame(L.W / 2 - w / 2, y - 11, w, 22, col, 1);
  k.T(msg, L.W / 2, y, 12, col, 'center', 800);
}
function hubLabel(action) {
  const hv = STATE.hv, n = shopNewCount(), u = phoneUnread();
  if (action === 'exams') return { text: '시험 일정표' };
  if (action === 'gear' && G.black) return { text: '노트북 · 텔레그램 새 메시지', hot: true };
  if (action === 'gear') return n ? { text: `AI마켓 · 신상 ${n}`, hot: true } : { text: 'AI마켓 (노트북)', hot: !G.hints.shop && G.stats.exams > 0 };
  if (action === 'log') return u ? { text: `폰 · 알림 ${u}`, hot: true } : { text: '폰' };
  if (action === 'go') { const t = TIERS[nextTierIndex()], fee = examFee(t); return { text: `시험 보러 가기: ${t.name}${fee ? ` (${won(fee)}원)` : ''}` }; }
  if (action === 'mail') return G.mail ? { text: '우편: 성적 통지표', hot: true } : null;
  if (action === 'parcel') return hv.parcel && hv.parcel.phase === 'wait' ? { text: '택배 왔어요! 눌러서 열기', hot: true } : null;
  return null;
}
function drawHubHud(B) { // 고시원 방: 물건 이름표, 돈, 타임어택 시계. 다가가면 그 물건의 화면
  const k = B.k, L = B.L, H = hudSet(), hv = STATE.hv, hover = STATE.hoverAct;
  if (hv.view !== 'laptop') BTNS = []; // 노트북 화면의 버튼은 drawLaptop이 채운 것을 그대로 쓴다
  HUB_RECT = null;
  if (hv.view === 'room') {
    const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches; // 터치 기기는 마우스를 올릴 수 없으니 이름표를 계속 보여 준다
    for (const l of WORLD.hubLabels()) {
      const info = l.show && hubLabel(l.action); if (!info) continue;
      const hot = l.action === hover; if (!hot && !info.hot && !touch) continue; // 이름표는 마우스를 올렸을 때와 알릴 게 있을 때만
      const bob = info.hot ? Math.round(Math.sin(now * 5) * 2) : 0, w = k.TW(info.text, 10, 800) + 14;
      const x = Math.round(clamp(l.x, w / 2 + 4, L.W - w / 2 - 4)), y = Math.round(clamp(l.y, 14, L.H - 12)) + bob;
      k.b.globalAlpha = hot || info.hot ? 0.96 : 0.6; k.R(x - w / 2, y - 8, w, 16, hot ? PAL.hud : info.hot ? '#e8453e' : PAL.dark); k.b.globalAlpha = 1;
      k.T(info.text, x, y, 10, hot ? PAL.dark : PAL.white, 'center', 800);
    }
  } else {
    const ui = HUBUI.draw(k, L, hv, now, STATE.hover); if (hv.view !== 'laptop') BTNS = ui.btns; HUB_RECT = ui.rect;
  }
  if (hv.view === 'mail' && hv.zoom >= 1 && hv.target !== 'room') k.TO('아무 데나 눌러 내려놓기', L.W / 2, L.H - 8, 9, '#c9c4d8');
  for (const p of STATE.pops) if (p.scene === 'hub' && p.t >= 0) k.TO(p.text || ('+' + won(p.v) + '원'), L.W / 2, 62 - p.t * 14, 12, p.col || PAL.gold);
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
      k.TO('감독관 16종', B.L.W / 2, 18, 12, PAL.white);
      for (const f of WORLD.figureLabels()) k.TO(f.text, f.x, f.y, 9, PAL.white);
    },
  },
  title: {
    update() {
      takeReleases();
      const start = () => { if (G.stats.exams > 0) goHub(null); else startExam(0); };
      if (takeTaps().length) { start(); return; }
      if (pressed('Enter') || pressed('Space')) start();
    },
    draw(B) {
      WORLD.renderTitle(G, now);
      const recs = loadRecords();
      BTNS = drawTitle(B.k, B.L, now, G.stats.exams > 0, { best: recs.length ? `${recs[0].name} ${fmtRun(recs[0].t)}` : '', ios: STATE.ios && !STATE.standalone });
    },
  },
  hub: {
    update(dt) { updateHub(dt); },
    draw(B) { if (STATE.hv.view === 'laptop' && WORLD.ok) drawLaptop(); STATE.hv.mail = !!G.mail; WORLD.renderHub(G, now, STATE.hoverAct, STATE.hv); drawHubHud(B); },
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
        openParcels(); settle();
        if (key === 'retry') { if (!startExam(RZ.tier)) goHub('board'); }
        else if (key === 'next' && RZ.next != null) { if (RZ.final) scene = 'ending'; else if (!startExam(RZ.next)) goHub('board'); }
        else if (key === 'hub') { if (RZ.final && !G.endSeen) scene = 'ending'; else goHub(null); }
      };
      for (const [x, y] of takeTaps()) { const b = hitBtn(BTNS, x, y); if (b) { act(b.key); return; } }
      if (pressed('KeyR')) act('retry');
      else if (pressed('KeyN')) act('next');
      else if (pressed('Enter') || pressed('Space')) act('hub');
    },
    draw(B) {
      const have = G.money + (G.pending || 0);
      RZ.canRetry = have >= examFee(TIERS[RZ.tier]);
      RZ.canNext = RZ.next != null && !RZ.final && have >= examFee(TIERS[RZ.next]);
      WORLD.renderExam(E, now); drawExamHud(B.k, B.L, E, now, hudSet()); BTNS = drawResultHud(B.k, B.L, RZ, now, hudSet()); drawNote(B);
    },
  },
  ending: {
    update(dt) {
      takeReleases();
      STATE.endT = (STATE.endT || 0) + dt;
      STATE.wipeArm = Math.max(0, STATE.wipeArm - dt);
      const ready = STATE.endT > ENDING_STATS, taps = takeTaps();
      if (!ready) { if ((taps.length || pressed('Enter') || pressed('Space')) && STATE.endT > 1.5) STATE.endT = ENDING_STATS; return; }
      const act = key => {
        if (key === 'continue') { G.endSeen = true; save(); goHub(null); }
        else if (key === 'name') askName();
        else if (key === 'wipe') { if (STATE.wipeArm > 0) wipe(); else STATE.wipeArm = 2.5; }
      };
      for (const [x, y] of taps) { const b = hitBtn(BTNS, x, y); if (b) { act(b.key); return; } }
      if (pressed('Enter') || pressed('Space')) act('continue');
      else if (pressed('KeyN')) act('name');
      if (pressed('KeyX')) act('wipe');
    },
    draw(B) {
      const et = STATE.endT || 0, shot = endShotAt(et);
      if (WORLD.ok) { if (shot) WORLD.renderTableau(shot.kind, now); else WORLD.renderEnding(et - END_T.me + 1.2, now); }
      BTNS = drawEnding(B.k, B.L, G, now, hudSet(), Object.assign(endingInfo(), { t: STATE.endT || 0, world: WORLD.ok }));
      if (STATE.wipeArm > 0) B.k.TO('한 번 더 누르면 저장을 지우고 새 타임어택 (기록은 남아요)', B.L.W / 2, B.L.H - 58, 11, PAL.warn);
    },
  },
};
function wipe() { // 저장만 지운다. 타임어택 기록은 남는다
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { }
  G = newGame(); state = makeState(); E = null; RZ = null; STATE.shown = 0; STATE.pops = []; STATE.wipeArm = 0; STATE.hv = newHubView();
  reset(); scene = 'title';
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
    if (G.run.started && !G.run.done && scene !== 'ending' && !dlgOpen()) G.run.t += STEP; // 타임어택: 타이틀·일시정지를 뺀 진행 시간
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
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(B.c, 0, 0, canvas.width, canvas.height);
}
function frame() { tick(); requestAnimationFrame(frame); }
function timer() { if (document.visibilityState === 'visible' && clock.now() - last > 0.1) tick(); }

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
STATE.hv = newHubView();
if (params.get('tier')) { G.unlocked = clamp(Number(params.get('tier')) + 1, 1, TIERS.length); for (let i = 0; i < G.unlocked - 1; i++) G.cleared[i] = true; }
if (params.get('gear')) { const lv = Number(params.get('gear')); for (const d of CONFIG.gear) G.gear[d.id] = gearOpen(d) ? Math.min(gearCap(d), lv) : 0; let m = 0; while (modelOpen(m + 1)) m++; G.gear.model = m; }
if (params.get('money')) G.money = Number(params.get('money'));
state = makeState();
awayEarnings();
STATE.shown = G.money;
scene = params.get('scene') || 'title';
if (!scenes[scene]) scene = 'title';
if (scene === 'play' || scene === 'pause' || scene === 'results') {
  const ti = Number(params.get('tier')) || 0;
  G.money = Math.max(G.money, examFee(TIERS[ti])); G.stats.exams = ti > 0 ? 1 : G.stats.exams;
  startExam(ti);
  if (params.get('t')) { const n = Math.round(Number(params.get('t')) / STEP); for (let i = 0; i < n && scene === 'play'; i++) step(); }
  if (params.get('peek')) { const st = E.staff[0]; st.phase = 'peek'; st.peek = { stage: 'stare', t: 0.5 }; E.view = 'paper'; E.viewT = 1; }
  if (params.get('final')) { E.qi = E.qs.length - 2; E.start = 0; E.answers[E.qi] = 0; nextQuestion(); if (params.get('final') === '2') { E.view = 'paper'; E.viewT = 1; completeScan(); } }
  if (params.get('scene') === 'results') { while (!E.over) { E.qs.forEach((q, i) => { E.answers[i] = (i + E.part) % 4 === 3 ? (q.answer + 1) % 4 : q.answer; E.via[i] = i % 2 ? 'ai' : 'self'; }); endPart(true); E.breakT = 0; } finishExam(); }
}
if (scene === 'ending') { STATE.endT = Number(params.get('t')) || 0; G.stats.scans = 214; G.run.t = 5025; G.run.splits = TIERS.map((_, i) => 200 * (i + 1)); G.cleared = TIERS.map(() => true); G.unlocked = TIERS.length; G.run.rec = -1; }
if (scene === 'hub' && params.get('scene')) {
  if (G.stats.exams === 0) G.stats.exams = 1;
  if (params.get('news')) for (let i = 0; i < G.unlocked - 1; i++) unlockNews(i);
  const v = params.get('hv'); if (['laptop', 'board', 'phone', 'mail'].includes(v)) { enterView(v, true); if (params.get('tab')) { if (v === 'phone') STATE.hv.ptab = params.get('tab'); else { STATE.hv.tab = params.get('tab'); STATE.hv.app = 'shop'; } }
    if (params.get('app')) { STATE.hv.app = params.get('app'); if (params.get('sold')) G.flags.sold = true; if (params.get('black')) { G.flags.cam = true; G.gear.lens = Math.max(1, G.gear.lens); G.black = { amount: 6400000, n: 1 }; } } }
  if (params.get('mail')) G.mail = { tier: 8, tierName: TIERS[8].name, marks: [0,1,2,3,4,5,6,7,8,9].map(i => ({ r: i % 4 === 3 ? 'X' : 'O', via: i % 2 ? 'ai' : 'self' })), correct: 8, qn: 10, pass: 60, score: 80, caught: false, passed: true, stamp: '합격' };
  if (params.get('parcel')) STATE.hv.parcel = { phase: 'wait', t: 0, items: [{ id: 'lens', name: gearName('lens', 1) }] };
  for (let i = 0; i < 6; i++) step(); // 화면 확인용: 방을 한 번 비춘 뒤
}
last = clock.now();
if (params.get('manual') === '1') drawFrame();
else { requestAnimationFrame(frame); setInterval(timer, 50); }
