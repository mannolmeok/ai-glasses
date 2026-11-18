// PROTOTYPE - NOT FOR PRODUCTION
// Question: 감독관 눈치를 보며 AI 안경으로 스캔하는 긴장감이, 장비와 시험이 함께 커지는 성장과 맞물려 엔딩까지 재밌나?
// Date: 2026-11-17
// 문제 만들기: 시험 종류마다 4지선다를 자동으로 만든다 (정답은 언제나 하나). 대사와 문구도 여기.
'use strict';

// 맞춤법: [맞는 말, 틀린 말]. 문맥에 따라 둘 다 맞을 수 있는 짝은 넣지 않는다.
const SPELL = [
  ['며칠', '몇일'], ['설거지', '설겆이'], ['역할', '역활'], ['금세', '금새'], ['왠지', '웬지'],
  ['웬일', '왠일'], ['어떡해', '어떻해'], ['희한하다', '희안하다'], ['일부러', '일부로'], ['오랜만', '오랫만'],
  ['굳이', '구지'], ['곰곰이', '곰곰히'], ['깨끗이', '깨끗히'], ['틈틈이', '틈틈히'], ['됐다', '됬다'],
  ['육개장', '육계장'], ['찌개', '찌게'], ['베개', '베게'], ['떡볶이', '떡볶기'], ['핑계', '핑게'],
  ['할게', '할께'], ['눈곱', '눈꼽'], ['숟가락', '숫가락'], ['무릅쓰다', '무릎쓰다'], ['짜깁기', '짜집기'],
  ['일찍이', '일찌기'], ['개수', '갯수'], ['설렘', '설레임'], ['헤매다', '헤메다'], ['치러야', '치뤄야'],
  ['담가', '담궈'], ['잠가', '잠궈'], ['어이없다', '어의없다'], ['대가', '댓가'], ['내로라하는', '내노라하는'],
  ['돌멩이', '돌맹이'], ['알맞은', '알맞는'], ['걸맞은', '걸맞는'], ['웃어른', '윗어른'], ['위층', '윗층'],
  ['휴게실', '휴계실'], ['웬만하면', '왠만하면'], ['봬요', '뵈요'], ['우레', '우뢰'],
];

const CIPHER_WORDS = ['HELLO', 'WORLD', 'BRAIN', 'GLASS', 'SMART', 'CHEAT', 'SPACE', 'ROBOT', 'LIGHT', 'MONEY',
  'PIXEL', 'TIGER', 'APPLE', 'LEMON', 'MUSIC', 'DREAM', 'OCEAN', 'PLANT', 'CLOUD', 'STORM', 'HEART', 'QUEEN',
  'NIGHT', 'POWER', 'CHAIR', 'PIANO', 'RIVER', 'STONE', 'TRAIN', 'WATCH'];

const ALIEN_Q = ['다음 중 가장 무거운 별은?', '블랙홀의 맛으로 옳은 것은?', '은하 3번 국도의 제한 속도는?',
  '외계 급식 중 가장 매운 것은?', '토성 고리를 세는 단위는?', '지구인의 주식(主食)은?', '혜성의 꼬리는 몇 개인가?',
  '빛보다 빠른 것을 고르시오.', '안드로메다로 가는 버스 번호는?', '우주 화장실 사용법으로 옳은 것은?'];

// 토익 Part 5: [빈칸 문장, 정답, 오답 3개]
const TOEIC = [
  ['The meeting has been ____ until next Monday.', 'postponed', ['postpone', 'postponing', 'postpones']],
  ['Please submit the report ____ Friday.', 'by', ['until', 'since', 'during']],
  ['Ms. Kim is responsible ____ training new staff.', 'for', ['to', 'with', 'of']],
  ['The new policy will take ____ next month.', 'effect', ['affect', 'effective', 'effectively']],
  ['All employees must ____ their ID badges.', 'wear', ['wearing', 'wore', 'worn']],
  ['The manager asked us to work more ____.', 'efficiently', ['efficient', 'efficiency', 'efficiencies']],
  ['Neither the CEO ____ the CFO attended.', 'nor', ['or', 'and', 'but']],
  ['The package arrived ____ than expected.', 'earlier', ['early', 'earliest', 'more early']],
  ['If the client ____ earlier, we would have finished.', 'had called', ['called', 'calls', 'has called']],
  ['The conference room is ____ this afternoon.', 'available', ['availability', 'avail', 'availably']],
  ['Mr. Park has worked here ____ 2019.', 'since', ['for', 'at', 'during']],
  ['Sales were ____ higher this quarter.', 'significantly', ['significant', 'significance', 'signify']],
  ['Applicants need three years of ____ experience.', 'relevant', ['relevance', 'relevantly', 'relate']],
  ['The store will be closed ____ the holiday.', 'during', ['while', 'when', 'as']],
  ['Thank you for ____ our survey.', 'completing', ['complete', 'completed', 'completes']],
  ['The proposal was approved ____ the board.', 'by', ['to', 'at', 'on']],
  ['Each of the participants ____ a certificate.', 'receives', ['receive', 'receiving', 'have received']],
  ['We look forward to ____ from you.', 'hearing', ['hear', 'heard', 'be heard']],
  ['The shipment was delayed ____ bad weather.', 'due to', ['because', 'so that', 'although']],
  ['She is the most ____ candidate for the job.', 'qualified', ['qualify', 'qualification', 'qualifies']],
  ['Items can be returned ____ 30 days.', 'within', ['between', 'among', 'above']],
  ['The report must be reviewed ____ it is sent.', 'before', ['during', 'despite', 'unless']],
];
// 한국사: [문제, 정답, 오답 3개]
const HISTORY = [
  ['훈민정음을 창제한 왕은?', '세종', ['태종', '세조', '정조']],
  ['고려를 세운 인물은?', '왕건', ['궁예', '견훤', '이성계']],
  ['조선을 세운 인물은?', '이성계', ['왕건', '이방원', '정몽주']],
  ['임진왜란이 일어난 해는?', '1592년', ['1636년', '1392년', '1910년']],
  ['3·1 운동이 일어난 해는?', '1919년', ['1910년', '1945년', '1905년']],
  ['대한민국 임시정부가 처음 수립된 곳은?', '상하이', ['충칭', '베이징', '도쿄']],
  ['팔만대장경을 보관한 절은?', '해인사', ['불국사', '법주사', '통도사']],
  ['발해를 세운 인물은?', '대조영', ['주몽', '온조', '김춘추']],
  ['광개토대왕은 어느 나라의 왕인가?', '고구려', ['백제', '신라', '가야']],
  ['삼국 통일을 이룬 나라는?', '신라', ['고구려', '백제', '발해']],
  ['백제의 마지막 수도는?', '사비', ['웅진', '한성', '경주']],
  ['6·25 전쟁이 일어난 해는?', '1950년', ['1945년', '1953년', '1960년']],
  ['직지심체요절이 만들어진 시대는?', '고려', ['조선', '통일 신라', '고구려']],
  ['거북선과 관련이 가장 깊은 장군은?', '이순신', ['권율', '강감찬', '을지문덕']],
  ['살수 대첩을 이끈 장군은?', '을지문덕', ['강감찬', '이순신', '김유신']],
  ['귀주 대첩을 이끈 장군은?', '강감찬', ['을지문덕', '서희', '윤관']],
  ['동학 농민 운동이 일어난 해는?', '1894년', ['1919년', '1876년', '1905년']],
  ['강화도 조약이 체결된 해는?', '1876년', ['1894년', '1910년', '1866년']],
  ['경국대전을 완성해 반포한 왕은?', '성종', ['세종', '태조', '영조']],
  ['대동법을 처음 시행한 왕은?', '광해군', ['숙종', '영조', '세종']],
  ['탕평책을 펼친 왕은?', '영조', ['연산군', '광해군', '세조']],
  ['현존하는 세계에서 가장 오래된 금속 활자본은?', '직지심체요절', ['팔만대장경', '훈민정음', '동의보감']],
];
const NAMES = ['민수', '지영', '하늘', '도윤', '서연', '준호', '유나', '태민'];

const SIGNAL_SHAPES = 6; // 신호 모양 개수 (그림은 art.js)

function shuffleChoices(rng, correct, wrongs) {
  const choices = [correct, ...wrongs];
  for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
  return { choices, answer: choices.indexOf(correct) };
}
function pickDistinct(rng, n, k) {
  const out = [];
  while (out.length < k) { const i = Math.floor(rng() * n); if (!out.includes(i)) out.push(i); }
  return out;
}
function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
function numWrongs(rng, ans, cands) {
  const out = [];
  const pool = cands.filter(v => Number.isFinite(v) && v !== ans && v >= 0);
  while (out.length < 3 && pool.length) { const v = pool.splice(Math.floor(rng() * pool.length), 1)[0]; if (!out.includes(v)) out.push(v); }
  let k = 1;
  while (out.length < 3) { const v = ans + k * (k % 2 ? 3 : -3); if (v !== ans && v >= 0 && !out.includes(v)) out.push(v); k++; }
  return out;
}
function numQ(rng, q, ans, cands) {
  const { choices, answer } = shuffleChoices(rng, ans, numWrongs(rng, ans, cands));
  return { kind: 'text', q, choices: choices.map(String), answer, human: true };
}

const GEN = {
  spell(rng) {
    const idx = pickDistinct(rng, SPELL.length, 4);
    const { choices, answer } = shuffleChoices(rng, SPELL[idx[0]][0], idx.slice(1).map(i => SPELL[i][1]));
    return { kind: 'text', q: '다음 중 맞춤법이 바른 것은?', choices, answer, human: true };
  },
  add(rng) {
    const sub = rng() < 0.4;
    let a = ri(rng, 14, 89), b = ri(rng, 11, 79);
    if (sub && b > a) [a, b] = [b, a];
    if (sub && a === b) a += 7;
    const ans = sub ? a - b : a + b;
    const sw = Number(String(ans).split('').reverse().join(''));
    return numQ(rng, `${a} ${sub ? '-' : '+'} ${b} = ?`, ans, [ans + 1, ans - 1, ans + 10, ans - 10, ans + 2, sw]);
  },
  mulseq(rng, hard) {
    if (rng() < 0.5) {
      const a = ri(rng, hard ? 23 : 12, hard ? 79 : 39), b = ri(rng, 3, 9), ans = a * b;
      return numQ(rng, `${a} × ${b} = ?`, ans, [ans + a, ans - a, ans + b, ans - b, ans + 10, ans - 10]);
    }
    if (rng() < 0.55) {
      const s = ri(rng, 2, 20), k = ri(rng, 3, hard ? 19 : 13), t = [0, 1, 2, 3].map(i => s + i * k), ans = s + 4 * k;
      return numQ(rng, `${t.join(', ')}, ( ? )`, ans, [ans + k, ans - 1, ans + 1, ans - k, ans + 2]);
    }
    const s = ri(rng, 2, 5), r = ri(rng, 2, 3), t = [0, 1, 2, 3].map(i => s * r ** i), ans = s * r ** 4;
    return numQ(rng, `${t.join(', ')}, ( ? )`, ans, [t[3] + (t[3] - t[2]), ans * 2, ans - s, ans + r, t[3] * (r + 1)]);
  },
  eq(rng, hard) {
    if (rng() < 0.25) {
      const n = ri(rng, hard ? 8 : 5, hard ? 14 : 11), ans = 2 ** n;
      return numQ(rng, `2의 ${n}제곱 = ?`, ans, [ans / 2, ans * 2, 2 * n, ans - 2, ans + 2]);
    }
    const a = ri(rng, 2, 9), x = ri(rng, 2, hard ? 29 : 15), b = ri(rng, 1, 40), c = a * x + b;
    return numQ(rng, `${a}x + ${b} = ${c},  x = ?`, x, [x + 1, x - 1, x + 2, c - b, Math.round(c / a), x + 3]);
  },
  cipher(rng, hard) {
    const idx = pickDistinct(rng, CIPHER_WORDS.length, 4), word = CIPHER_WORDS[idx[0]], k = ri(rng, 1, hard ? 7 : 4);
    const enc = word.split('').map(ch => String.fromCharCode(65 + (ch.charCodeAt(0) - 65 + k) % 26)).join('');
    const { choices, answer } = shuffleChoices(rng, word, idx.slice(1).map(i => CIPHER_WORDS[i]));
    return { kind: 'text', q: `암호 '${enc}' 를 ${k}칸 되돌리면?`, choices, answer, human: true };
  },
  signal(rng, hard) {
    const L = ri(rng, 2, hard ? 4 : 3), unit = [];
    for (let i = 0; i < L; i++) unit.push(Math.floor(rng() * SIGNAL_SHAPES));
    if (unit.every(v => v === unit[0])) unit[L - 1] = (unit[0] + 1) % SIGNAL_SHAPES;
    const seq = []; for (let i = 0; i < 7; i++) seq.push(unit[i % L]);
    const ans = unit[7 % L], wrongs = [];
    while (wrongs.length < 3) { const v = Math.floor(rng() * SIGNAL_SHAPES); if (v !== ans && !wrongs.includes(v)) wrongs.push(v); }
    const { choices, answer } = shuffleChoices(rng, ans, wrongs);
    return { kind: 'signal', q: '다음에 올 신호는?', seq, choices, answer, human: true };
  },
  alien(rng) {
    const seed = ri(rng, 100, 99999), choices = [0, 1, 2, 3].map(() => ri(rng, 100, 99999));
    return { kind: 'alien', q: seed, choices, answer: ri(rng, 0, 3), human: false, translation: ALIEN_Q[ri(rng, 0, ALIEN_Q.length - 1)] };
  },
  toeic(rng) {
    const it = TOEIC[Math.floor(rng() * TOEIC.length)];
    const { choices, answer } = shuffleChoices(rng, it[1], it[2]);
    return { kind: 'text', q: it[0], choices, answer, human: true };
  },
  history(rng) {
    const it = HISTORY[Math.floor(rng() * HISTORY.length)];
    const { choices, answer } = shuffleChoices(rng, it[1], it[2]);
    return { kind: 'text', q: it[0], choices, answer, human: true };
  },
  civil(rng) { return rng() < 0.5 ? GEN.spell(rng) : GEN.history(rng); },
  logic(rng) { // 추리논증: 이웃한 쌍의 비교 세 개로 순서가 하나로 정해진다
    const idx = pickDistinct(rng, NAMES.length, 4), p = idx.map(i => NAMES[i]);
    const facts = [[p[0], p[1]], [p[1], p[2]], [p[2], p[3]]];
    for (let i = facts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [facts[i], facts[j]] = [facts[j], facts[i]]; }
    const tall = rng() < 0.5, ask = Math.floor(rng() * 3); // 0: 가장 ~, 1: 가장 덜 ~, 2: 두 번째로 ~
    const askText = tall ? ['가장 키가 큰 사람은?', '가장 키가 작은 사람은?', '두 번째로 키가 큰 사람은?']
      : ['점수가 가장 높은 사람은?', '점수가 가장 낮은 사람은?', '점수가 두 번째로 높은 사람은?'];
    const ans = ask === 0 ? p[0] : ask === 1 ? p[3] : p[1];
    const q = `${tall ? '키' : '점수'} 비교: ${facts.map(([a, b]) => `${a} > ${b}`).join(', ')}. ${askText[ask]}`;
    const { choices, answer } = shuffleChoices(rng, ans, p.filter(x => x !== ans));
    return { kind: 'text', q, choices, answer, human: true };
  },
  tax(rng) {
    const won0 = v => v.toLocaleString('ko-KR') + '원';
    const k = Math.floor(rng() * 4);
    if (k === 0) { const base = ri(rng, 12, 98) * 100000, v = base / 10;
      return { kind: 'text', q: `공급가액 ${won0(base)}의 부가가치세(10%)는?`, ...shuffleChoices(rng, won0(v), [won0(v / 10), won0(base + v), won0(base - v)]), human: true }; }
    if (k === 1) { const sales = ri(rng, 9, 30) * 1000000, cost = Math.round(sales * (0.4 + rng() * 0.2) / 100000) * 100000, sga = ri(rng, 5, 25) * 100000, op = sales - cost - sga;
      return { kind: 'text', q: `매출 ${won0(sales)}, 매출원가 ${won0(cost)}, 판관비 ${won0(sga)}일 때 영업이익은?`, ...shuffleChoices(rng, won0(op), [won0(sales - cost), won0(op + sga * 2), won0(sales - sga)]), human: true }; }
    if (k === 2) { const c = ri(rng, 4, 20) * 1000000, y = [4, 5, 8, 10][ri(rng, 0, 3)], v = c / y;
      return { kind: 'text', q: `취득원가 ${won0(c)}, 잔존가치 0, 내용연수 ${y}년. 정액법 연 감가상각비는?`, ...shuffleChoices(rng, won0(v), [won0(v * 2), won0(Math.round(c / (y + 1) / 1000) * 1000), won0(Math.round(v / 2))]), human: true }; }
    const inc = ri(rng, 10, 90) * 100000, v = Math.round(inc * 0.033);
    return { kind: 'text', q: `사업소득 ${won0(inc)}의 원천징수액(3.3%)은?`, ...shuffleChoices(rng, won0(v), [won0(Math.round(inc * 0.0033)), won0(Math.round(inc * 0.03)), won0(Math.round(inc * 0.33))]), human: true };
  },
  mix(rng) {
    const kinds = ['logic', 'tax', 'history', 'eq', 'toeic', 'logic', 'tax'];
    return GEN[kinds[Math.floor(rng() * kinds.length)]](rng, true);
  },
};

function makeQuestions(rng, tier) {
  const out = [];
  for (let i = 0; i < tier.qn; i++) out.push(GEN[tier.gen](rng, false));
  return out;
}

// 외계 문자 한 자: 단위 칸 [0,1] 안의 획 목록 [x0,y0,x1,y1] (점은 시작=끝)
function glyph(seed) {
  let s = (seed * 2654435761) >>> 0;
  const r = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / 16777216; };
  const out = [], n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(r() * 5);
    if (k === 0) { const x = 0.15 + r() * 0.7; out.push([x, 0.08, x, 0.92]); }
    else if (k === 1) { const y = 0.15 + r() * 0.7; out.push([0.08, y, 0.92, y]); }
    else if (k === 2) out.push(r() < 0.5 ? [0.1, 0.1, 0.9, 0.9] : [0.9, 0.1, 0.1, 0.9]);
    else if (k === 3) { const x = 0.2 + r() * 0.6; out.push([x, 0.2, x, 0.6]); out.push([x, 0.6, x + 0.3 > 0.95 ? x - 0.3 : x + 0.3, 0.6]); }
    else { const x = 0.25 + r() * 0.5, y = 0.25 + r() * 0.5; out.push([x, y, x, y]); }
  }
  return out;
}
function alienWord(seed, len) { const a = []; for (let i = 0; i < len; i++) a.push(seed + i * 17); return a; }

// 감독관 대사 (적발될 때)
const CAUGHT_LINE = {
  homeroom: '"잠깐만요, 그 안경 좀 볼게요."',
  dean: '"수험생, 그 안경 잠깐 벗어 보세요."',
  suneung: '"금속탐지기에 반응이 있네요?"',
  agent: '"부정행위로 퇴실 조치합니다."',
  cadet: '"그 렌즈, 어디서 났습니까?"',
  alien: '"삐빅. 반칙 전파 감지."',
  robot: '"AI가 AI를 못 알아볼 줄 알았나?"',
};
const PROCTOR_NAME = { homeroom: '조교', dean: '감독관', suneung: '수능 감독관', agent: '시험 관리관', cadet: '교관', alien: '외계인 교수', robot: 'AI 감독관' };

// 장비 효과 문구: lv에서의 효과
const GEAR_TEXT = {
  lens: lv => `스캔 ${scanSecondsAt(lv).toFixed(2)}초`,
  model: lv => { const t = CONFIG.tiers[nextTierIndex()], p = Math.max(tune.ai_floor, Math.min(0.99, tune.ai_base - tune.ai_drop * Math.max(0, t.ai - lv))); return `v${lv + 1} · 다음 시험 정확도 ${Math.round(p * 100)}%`; },
  stealth: lv => `들킬 때 의심도 ${Math.round(Math.pow(1 - tune.stealth_cut, lv) * 100)}%`,
  predict: lv => lv ? `돌아보면 렌즈 경고${lv >= 3 ? ' + 주시도 표시' : ''} · 낌새 +${(lv * tune.predict_bonus).toFixed(2)}초` : '시험지 보는 동안 양옆 감독관을 감지',
  watch: lv => `시험 시간 +${(lv * tune.watch_bonus).toFixed(0)}초`,
  wide: lv => lv ? `한 번 스캔에 ${lv + 1}문제` : '한 번 스캔으로 다음 문제까지 읽음',
  coach: lv => lv ? `합격 보상 x${(1 + lv * tune.coach_bonus).toFixed(2)}` : '면접에서 합격 보상을 더 받음',
  bot: lv => `초당 ${won(botRateAt(lv))}원`,
  earbud: lv => lv ? `신뢰도 ${earbudNeedAt(lv)}% 이상 자동 제출` : '스캔 끝나면 AI가 답을 대신 냄',
  autoscan: lv => lv ? `안 볼 때 알아서 스캔 (반응 ${autoDelayAt(lv).toFixed(2)}초)` : '감독관이 안 볼 때 알아서 스캔',
  cctvjam: lv => lv >= 2 ? 'CCTV에 안 찍힘' : lv ? `CCTV 의심도 ${Math.round((1 - tune.jam_cut) * 100)}%` : 'CCTV 시선 무력화',
  jammer: lv => lv >= 2 ? '탐지 전파 완전 차단' : lv ? `전파 의심도 ${Math.round((1 - tune.jam_cut) * 100)}%` : 'AI 탐지 전파 무력화',
};
const GEAR_BLURB = {
  lens: '안경 렌즈를 바꿔 시험지를 더 빨리 읽는다',
  model: '어려운 시험일수록 AI가 틀린다. 모델이 좋으면 덜 틀린다',
  stealth: '렌즈 빛 반사를 줄여 들켜도 덜 수상하다',
  predict: '시험지를 보는 동안에도 양옆 감독관이 돌아보면 렌즈 가장자리가 경고한다',
  watch: '손목에서 시간을 늘려 주는 수상한 시계',
  wide: '시야가 넓은 렌즈로 시험지를 한꺼번에 읽는다',
  coach: 'AI가 면접 답변을 귀띔해서 장학금·연봉이 오른다',
  bot: '통과한 시험을 AI가 대신 응시해서 돈을 번다',
  earbud: 'AI가 귓속말로 답을 불러 줘서 손이 알아서 고른다',
  autoscan: '안경이 감독관 시선을 읽고 혼자 스캔한다',
  cctvjam: '교실 CCTV 화면에 내 자리만 지운다',
  jammer: 'AI 탐지 전파를 평범한 와이파이로 위장한다',
};
const SEC_NAME = { cctv: 'CCTV 회전', pulse: 'AI 탐지 전파' };
