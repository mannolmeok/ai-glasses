// PROTOTYPE - NOT FOR PRODUCTION
// Question: 감독관 눈치를 보며 AI 안경으로 스캔하는 긴장감이, 장비와 시험이 함께 커지는 성장과 맞물려 엔딩까지 재밌나?
// Date: 2026-11-17
// Every tuning value lives here, each with value, min, max and step. The game reads them live
// through tune.<name> (game.js); the tweak panel, an add-on, writes them back here.
// tiers와 gear는 표(슬라이더 없음): 시험 8단계와 장비 12종의 숫자도 전부 여기서 고친다.
window.CONFIG = {
  seed: 1, // every gameplay random call reads rng(), seeded from this (or ?seed= in the address)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },

  // ---- 시험 ----
  pass_mark: { value: 0.6, min: 0.3, max: 1, step: 0.05 },        // 합격선: 정답 비율
  time_scale: { value: 1, min: 0.5, max: 2, step: 0.05 },          // 모든 시험 시간 배율
  time_bonus: { value: 0.5, min: 0, max: 2, step: 0.05 },          // 남은 시간 비율 x 이 값만큼 보상 추가
  reward_scale: { value: 1, min: 0.1, max: 10, step: 0.1 },        // 모든 보상 배율
  fee_scale: { value: 1, min: 0, max: 3, step: 0.05 },             // 모든 응시료 배율 (0이면 무료)
  jackpot_mult: { value: 3, min: 1, max: 10, step: 0.5 },          // 만점(수석 합격) 보상 배율

  // ---- 스캔과 AI ----
  scan_time: { value: 1.6, min: 0.3, max: 4, step: 0.1 },          // 장비 없을 때 스캔 시간(초)
  lens_bonus: { value: 0.18, min: 0, max: 0.6, step: 0.01 },       // 렌즈 스캐너 레벨당 스캔 속도 +
  ai_base: { value: 0.97, min: 0.5, max: 1, step: 0.01 },          // 시험 난이도 = AI 모델 레벨일 때 정확도
  ai_drop: { value: 0.1, min: 0, max: 0.3, step: 0.01 },           // 난이도가 모델보다 1 높을 때마다 정확도 -
  ai_floor: { value: 0.35, min: 0.25, max: 0.9, step: 0.01 },      // AI 정확도 최저치

  // ---- 감독관과 의심도 ----
  sus_scale: { value: 1, min: 0.2, max: 3, step: 0.05 },           // 의심도 증가 배율 (시험별 sus에 곱함)
  sus_decay: { value: 0.12, min: 0, max: 1, step: 0.01 },          // 스캔 안 할 때 초당 의심도 감소
  tell_ratio: { value: 0.25, min: 0, max: 1, step: 0.05 },         // 낌새 중 스캔 = 주시 중 스캔의 몇 배
  proctor_speed: { value: 1, min: 0.3, max: 3, step: 0.05 },       // 감독관 걸음 속도 배율
  proctor_pace: { value: 1, min: 0.3, max: 3, step: 0.05 },        // 서 있기·걷기 시간 배율 (작을수록 자주 돌아봄)
  look_time: { value: 0.16, min: 0.05, max: 0.6, step: 0.01 },      // 고개를 돌리는 데 걸리는 시간(초)
  footstep_gap: { value: 0.42, min: 0.2, max: 1, step: 0.02 },     // 감독관 발소리 간격(초)
  cctv_period: { value: 7, min: 2, max: 20, step: 0.5 },           // CCTV 한 번 훑는 시간(초)
  cctv_rate: { value: 0.7, min: 0, max: 3, step: 0.05 },           // CCTV에 찍힐 때 스캔 = 주시의 몇 배
  pulse_gap: { value: 8.5, min: 3, max: 20, step: 0.5 },           // AI 탐지 전파 평균 간격(초)
  pulse_rate: { value: 1.4, min: 0, max: 5, step: 0.1 },           // 전파가 지나갈 때 스캔하면 초당 의심도

  // ---- 장비 효과 ----
  stealth_cut: { value: 0.15, min: 0, max: 0.4, step: 0.01 },      // 스텔스 코팅 레벨당 의심도 증가 x(1-값)
  predict_bonus: { value: 0.12, min: 0, max: 0.5, step: 0.01 },    // 시선 예측 레벨당 낌새 시간 +초
  coach_bonus: { value: 0.25, min: 0, max: 1, step: 0.05 },        // AI 면접 코치 레벨당 합격 보상 +배율
  watch_bonus: { value: 4, min: 0, max: 15, step: 0.5 },           // 스마트워치 레벨당 시험 시간 +초
  earbud_threshold: { value: 85, min: 40, max: 100, step: 1 },     // 이어폰 1레벨: 이 신뢰도(%) 이상이면 자동 제출
  earbud_step: { value: 5, min: 0, max: 15, step: 1 },             // 이어폰 레벨당 자동 제출 기준 -%
  earbud_delay: { value: 0.35, min: 0, max: 2, step: 0.05 },       // 이어폰이 답을 대신 내기까지(초)
  autoscan_delay: { value: 0.35, min: 0, max: 1.5, step: 0.05 },   // 자동 스캔 칩 1레벨의 반응 지연(초), 레벨마다 절반
  jam_cut: { value: 0.6, min: 0, max: 1, step: 0.05 },             // 재머 1레벨이 줄이는 비율 (2레벨이면 완전 차단)

  // ---- 경제 ----
  cost_scale: { value: 1, min: 0.1, max: 10, step: 0.1 },          // 모든 장비 가격 배율
  bot_rate: { value: 0.006, min: 0, max: 0.2, step: 0.001 },       // 봇 1레벨 초당 수입 = 값 x 통과한 최고 시험의 문제당 보상
  away_cap: { value: 3600, min: 0, max: 28800, step: 300 },        // 자리 비움 보상 최대 시간(초)
  away_rate: { value: 0.5, min: 0, max: 1, step: 0.05 },           // 자리 비움 동안 봇 효율
  count_speed: { value: 6, min: 1, max: 20, step: 0.5 },           // 숫자 카운트업 속도

  // 시험 8단계 (실제 시험). staff: 감독관(종류·이름), 왼쪽·오른쪽 통로를 나눠 맡는다.
  // stand: 다른 수험생을 보며 서 있는 시간 범위(초), walk: 통로를 걷는 시간 범위(초), tell: 나를 향해 돌아보는 낌새(초),
  // watch: 나를 쳐다보는 시간(초), speed: 걷는 속도(통로 길이 비율/초, 교실 통로는 약 8.5m), cross: 반대편 통로로 건너갈 확률,
  // feint: 돌아보다 마는 확률, sus: 쳐다볼 때 스캔하면 초당 의심도, ai: AI가 느끼는 난이도(모델 레벨과 비교),
  // reward: 문제당 보상(원), fee: 응시료(원, 시험 볼 때마다 냄), sec: 추가 보안, noAuto: AI 감독관이 이어폰·자동 스캔을 막음, room: 교실 그림
  tiers: [
    { id: 'univ', name: '대학교 교양 중간고사', subject: '교양 국어', gen: 'spell', qn: 5, time: 55, reward: 300, fee: 0, room: 0, sec: [],
      staff: [{ type: 'homeroom', name: '조교' }],
      stand: [3.4, 5.0], walk: [1.6, 2.6], tell: 1.2, watch: 1.5, speed: 0.1, cross: 0.15, feint: 0, sus: 0.7, ai: 0, pay: '장학금' },
    { id: 'toeic', name: '토익(TOEIC)', subject: 'Reading Part 5', gen: 'toeic', qn: 6, time: 55, reward: 1200, fee: 1500, room: 1, sec: [],
      staff: [{ type: 'dean', name: '토익 감독관' }],
      stand: [3.0, 4.4], walk: [1.4, 2.4], tell: 1.0, watch: 1.7, speed: 0.11, cross: 0.25, feint: 0.05, sus: 0.8, ai: 1, pay: '용돈' },
    { id: 'history', name: '한국사능력검정시험', subject: '한국사', gen: 'history', qn: 8, time: 55, reward: 9000, fee: 15000, room: 2, sec: [],
      staff: [{ type: 'dean', name: '감독관' }],
      stand: [2.2, 3.4], walk: [1.2, 2.0], tell: 0.8, watch: 2.0, speed: 0.12, cross: 0.35, feint: 0.1, sus: 0.95, ai: 2, pay: '용돈' },
    { id: 'suneung', name: '대학수학능력시험', subject: '수학 영역', gen: 'eq', qn: 10, time: 65, reward: 70000, fee: 150000, room: 3, sec: [],
      staff: [{ type: 'suneung', name: '정감독관' }, { type: 'homeroom', name: '부감독관' }],
      stand: [2.4, 3.8], walk: [1.2, 2.2], tell: 0.75, watch: 2.1, speed: 0.12, cross: 0.2, feint: 0.15, sus: 1.0, ai: 3, pay: '장학금' },
    { id: 'civil', name: '9급 공무원 공채', subject: '국어·한국사', gen: 'civil', qn: 10, time: 65, reward: 550000, fee: 1200000, room: 4, sec: ['cctv'],
      staff: [{ type: 'agent', name: '시험 관리관' }, { type: 'dean', name: '감독관' }],
      stand: [2.2, 3.4], walk: [1.1, 2.0], tell: 0.7, watch: 2.2, speed: 0.13, cross: 0.25, feint: 0.2, sus: 1.1, ai: 4, pay: '첫 월급' },
    { id: 'leet', name: '법학적성시험(LEET)', subject: '추리논증', gen: 'logic', qn: 10, time: 70, reward: 4500000, fee: 10000000, room: 5, sec: ['cctv', 'pulse'],
      staff: [{ type: 'agent', name: '시험 관리관' }, { type: 'suneung', name: '감독관' }],
      stand: [2.0, 3.2], walk: [1.0, 1.8], tell: 0.65, watch: 2.3, speed: 0.13, cross: 0.3, feint: 0.2, sus: 1.2, ai: 5.5, pay: '로스쿨 장학금' },
    { id: 'tax', name: '세무사 2차 시험', subject: '회계·세법', gen: 'tax', qn: 10, time: 70, reward: 35000000, fee: 80000000, room: 6, sec: ['cctv', 'pulse'],
      staff: [{ type: 'dean', name: '감독관' }, { type: 'agent', name: '시험 관리관' }, { type: 'homeroom', name: '감독관' }],
      stand: [1.8, 3.0], walk: [1.0, 1.7], tell: 0.6, watch: 2.4, speed: 0.1, cross: 0.3, feint: 0.25, sus: 1.3, ai: 7, pay: '첫 수임료' },
    { id: 'bar', name: '변호사시험', subject: '전 과목', gen: 'mix', qn: 12, time: 80, reward: 300000000, fee: 800000000, room: 7, sec: ['cctv', 'pulse'], noAuto: true,
      staff: [{ type: 'robot', name: 'AI 감독관' }, { type: 'agent', name: '시험 관리관' }],
      stand: [1.4, 2.4], walk: [0.8, 1.4], tell: 0.45, watch: 2.6, speed: 0.12, cross: 0.35, feint: 0.3, sus: 1.5, ai: 9, pay: '첫 연봉' },
  ],

  // 장비 12종. base: 첫 가격(원), grow: 레벨마다 가격 배수, max: 최대 레벨, need: 몇 번째 시험(0부터)에 도달하면 상점에 뜨는지
  gear: [
    { id: 'lens', name: '렌즈 스캐너', group: '안경', base: 400, grow: 2.5, max: 10, need: 0 },
    { id: 'model', name: 'AI 모델', group: '안경', base: 2500, grow: 3.3, max: 10, need: 1 },
    { id: 'stealth', name: '스텔스 코팅', group: '안경', base: 3000, grow: 3.0, max: 10, need: 1 },
    { id: 'predict', name: '시선 예측', group: '안경', base: 2000, grow: 3.0, max: 8, need: 1 },
    { id: 'wide', name: '광각 렌즈', group: '안경', base: 80000, grow: 8, max: 3, need: 2 },
    { id: 'watch', name: 'AI 스마트워치', group: 'AI 장비', base: 1500, grow: 2.7, max: 10, need: 1 },
    { id: 'bot', name: '대리 응시 봇', group: 'AI 장비', base: 4000, grow: 1.32, max: 200, need: 1 },
    { id: 'earbud', name: 'AI 이어폰', group: 'AI 장비', base: 30000, grow: 5, max: 6, need: 2 },
    { id: 'coach', name: 'AI 면접 코치', group: 'AI 장비', base: 15000, grow: 3.2, max: 8, need: 2 },
    { id: 'autoscan', name: '자동 스캔 칩', group: 'AI 장비', base: 500000, grow: 12, max: 3, need: 3 },
    { id: 'cctvjam', name: 'CCTV 재머', group: 'AI 장비', base: 300000, grow: 10, max: 2, need: 4 },
    { id: 'jammer', name: '전파 위장기', group: 'AI 장비', base: 3500000, grow: 10, max: 2, need: 5 },
  ],
  bot_milestones: [10, 25, 50, 100], // 대리 응시 봇이 이 레벨을 넘을 때마다 수입 x2
};
