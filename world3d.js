// PROTOTYPE - NOT FOR PRODUCTION
// Question: 감독관 눈치를 보며 AI 안경으로 스캔하는 긴장감이, 장비와 시험이 함께 커지는 성장과 맞물려 엔딩까지 재밌나?
// Date: 2026-11-17
// 3D 세계: PSX풍 저해상도(640x360) 1인칭. 시험장 8곳, 감독관 5종, 수험생, 내 손과 시험지, CCTV·탐지 전파 장치,
// 허브인 고시원 방(노트북·일정표·폰·문을 눌러 쓴다), figures 줄 세우기. 그리기만 하고 규칙은 game.js가 정한다.
// 색은 줄이고 디더링하며, 정점은 화면 격자에 붙여 PSX처럼 살짝 떨리게 한다.
'use strict';

const WORLD = (() => {
  const RW = 640, RH = 360;
  const W = { ok: false, RW, RH };
  if (typeof THREE === 'undefined') return Object.assign(W, { init() { }, renderExam() { }, renderHub() { }, renderTitle() { }, renderFigures() { }, pickChoice: () => -1, pickHub: () => null, hubLabels: () => [], figureLabels: () => [] });

  let renderer = null, rt = null, post = null, postCam = null, postMat = null;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k * k * (3 - 2 * k);
  const angTo = (a, b, k) => { const d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * k; };
  const FONT = FONT_KO;

  // ---------- 렌더러: 640x360 + 비네트·잡티·디더링 ----------
  function init(canvas) {
    try {
      THREE.ColorManagement.enabled = false;
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.setPixelRatio(1); renderer.setSize(RW, RH, false);
      rt = new THREE.WebGLRenderTarget(RW, RH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      post = new THREE.Scene(); postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      postMat = new THREE.ShaderMaterial({
        uniforms: { tex: { value: rt.texture }, res: { value: new THREE.Vector2(RW, RH) }, time: { value: 0 }, vig: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `uniform sampler2D tex; uniform vec2 res; uniform float time; uniform float vig; varying vec2 vUv;
          float b2(vec2 p){ return mod(2.0 * p.x + 3.0 * p.y, 4.0); }
          float bayer4(vec2 p){ vec2 q = mod(p, 4.0); return (4.0 * b2(mod(q, 2.0)) + b2(floor(q / 2.0))) / 16.0; }
          void main(){
            vec2 px = floor(vUv * res);
            vec3 c = texture2D(tex, (px + 0.5) / res).rgb;
            float v = smoothstep(0.95, 0.25, length((vUv - 0.5) * vec2(1.25, 1.0)));
            c *= mix(1.0 - 0.5 * vig, 1.0, v);
            float n = fract(sin(dot(px + floor(time * 12.0) * 7.0, vec2(12.9898, 78.233))) * 43758.5453);
            c += (n - 0.5) * 0.035;
            c = floor(c * 22.0 + bayer4(px)) / 22.0;
            gl_FragColor = vec4(c, 1.0);
          }`,
        depthTest: false, depthWrite: false,
      });
      post.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
      W.ok = true;
    } catch (e) { W.ok = false; W.error = String(e && e.message || e); }
  }
  function draw(scene, cam, now, vig = 1) {
    if (!W.ok) return;
    postMat.uniforms.time.value = now; postMat.uniforms.vig.value = vig;
    renderer.setRenderTarget(rt); renderer.render(scene, cam);
    renderer.setRenderTarget(null); renderer.render(post, postCam);
  }

  // ---------- 재질·상자·한 덩어리 묶음 ----------
  const SNAP = new THREE.Vector2(RW / 2, RH / 2);
  function psx(m) {
    m.onBeforeCompile = sh => {
      sh.uniforms.snapRes = { value: SNAP };
      sh.vertexShader = 'uniform vec2 snapRes;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n  gl_Position.xy = floor(gl_Position.xy / gl_Position.w * snapRes + 0.5) / snapRes * gl_Position.w;');
    };
    m.customProgramCacheKey = () => 'psx';
    return m;
  }
  const MATS = new Map();
  function mat(color) { if (!MATS.has(color)) MATS.set(color, psx(new THREE.MeshLambertMaterial({ color, flatShading: true }))); return MATS.get(color); }
  function ownMat(color, extra) { return psx(new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, extra || {}))); }
  const UNIT = new THREE.BoxGeometry(1, 1, 1), UNI = UNIT.clone().toNonIndexed();
  function bx(parent, w, h, d, color, x, y, z, m) { const o = new THREE.Mesh(UNIT, m || mat(color)); o.scale.set(w, h, d); o.position.set(x, y, z); parent.add(o); return o; }
  function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
  function batch() {
    const P = [], N = [], C = [];
    return {
      box(w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) {
        _e.set(rx, ry, rz); _q.setFromEuler(_e); _m.compose(_v.set(x, y, z), _q, _s.set(w, h, d));
        const g = UNI.clone().applyMatrix4(_m), c = new THREE.Color(color), p = g.attributes.position.array, n = g.attributes.normal.array;
        for (let i = 0; i < p.length; i++) { P.push(p[i]); N.push(n[i]); }
        for (let i = 0; i < p.length / 3; i++) C.push(c.r, c.g, c.b);
        g.dispose();
      },
      mesh() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        return new THREE.Mesh(g, psx(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
      },
    };
  }
  function canvasTex(w, h, smooth) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const t = new THREE.CanvasTexture(c);
    t.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
    t.minFilter = smooth ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
    t.generateMipmaps = !!smooth; if (smooth) t.anisotropy = 4;
    return { c, g: c.getContext('2d'), t };
  }
  function plane(parent, w, h, material, x, y, z, rx = 0, ry = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); parent.add(m); return m; }
  function seeded(n) { let s = n * 9301 + 49297; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function disposeScene(sc) {
    if (!sc) return;
    sc.traverse(o => {
      if (o.geometry && o.geometry !== UNIT) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) { if ([...MATS.values()].includes(m)) continue; if (m.map) m.map.dispose(); m.dispose(); }
    });
  }

  // ---------- 감독관 5종 ----------
  const STAFF_LOOK = {
    homeroom: { top: 0xd9705f, sleeve: 0xc8604f, leg: 0x2f3b62, skirt: true, shirt: 0xf6efe4, hair: 'bun', hairC: 0x3a2418, prop: 'book' },
    dean: { top: 0x33405f, sleeve: 0x2b3650, leg: 0x2a3350, shirt: 0xf3f3ee, tie: 0xb8362e, hair: 'bald', hairC: 0x33261f, glasses: 'metal', prop: 'clipboard' },
    suneung: { top: 0x7d8796, sleeve: 0xeeeeea, leg: 0x3b3f4a, shirt: 0xf1f1ec, hair: 'spiky', hairC: 0x1d1a22, prop: 'wand', badge: true },
    agent: { top: 0x1f2129, sleeve: 0x1b1d24, leg: 0x15161c, shirt: 0xf4f4f0, tie: 0x111216, hair: 'buzz', hairC: 0x2a2420, glasses: 'sun', prop: 'cross', ear: true },
  };
  const SKIN = 0xdcae88;
  function gazeCone() { // 시선 예측 장비가 그리는 시선: 머리에서 앞으로 퍼지는 반투명 원뿔
    const g = new THREE.ConeGeometry(0.25, 1, 14, 1, true); g.translate(0, -0.5, 0); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    m.visible = false; return m;
  }
  function makeHuman(o) {
    const root = new THREE.Group(), legs = [], arms = [];
    for (const s of [-1, 1]) {
      const p = pivot(root, s * 0.08, 0.84, 0);
      if (o.skirt) bx(p, 0.09, 0.6, 0.1, 0xc9a07e, 0, -0.52, 0); else bx(p, 0.12, 0.82, 0.14, o.leg, 0, -0.41, 0);
      bx(p, 0.13, 0.06, 0.22, 0x1b1b20, 0, -0.81, 0.04); legs.push(p);
    }
    if (o.skirt) bx(root, 0.36, 0.34, 0.26, o.leg, 0, 0.74, 0);
    bx(root, 0.4, 0.6, 0.22, o.top, 0, 1.12, 0);
    bx(root, 0.12, 0.34, 0.012, o.shirt, 0, 1.27, 0.112);
    if (o.tie) bx(root, 0.04, 0.26, 0.012, o.tie, 0, 1.25, 0.12);
    if (o.badge) { bx(root, 0.1, 0.12, 0.012, 0xffffff, 0.1, 1.12, 0.118); bx(root, 0.1, 0.03, 0.013, 0x3b6fd6, 0.1, 1.15, 0.12); }
    else { bx(root, 0.08, 0.1, 0.012, 0xffffff, 0.11, 1.14, 0.118); bx(root, 0.08, 0.025, 0.013, 0x3b6fd6, 0.11, 1.16, 0.12); } // 감독관 명찰
    for (const s of [-1, 1]) {
      const p = pivot(root, s * 0.25, 1.38, 0);
      bx(p, 0.09, 0.56, 0.11, o.sleeve, 0, -0.28, 0); bx(p, 0.08, 0.1, 0.09, SKIN, 0, -0.6, 0);
      if (s > 0 && o.prop === 'wand') { bx(p, 0.035, 0.32, 0.035, 0x1d1d22, 0, -0.68, 0.1); bx(p, 0.06, 0.08, 0.05, 0xe7c13a, 0, -0.84, 0.12); }
      if (s > 0 && o.prop === 'clipboard') { bx(p, 0.2, 0.26, 0.015, 0x8a5a32, 0, -0.62, 0.08); bx(p, 0.17, 0.2, 0.004, 0xf4f1e6, 0, -0.63, 0.09); }
      if (s < 0 && o.prop === 'book') { bx(p, 0.16, 0.22, 0.03, 0xf4efe2, 0, -0.62, 0.08); bx(p, 0.02, 0.22, 0.035, 0xc45f54, 0, -0.62, 0.08); }
      arms.push(p);
    }
    bx(root, 0.08, 0.06, 0.08, SKIN, 0, 1.45, 0);
    const head = pivot(root, 0, 1.6, 0);
    bx(head, 0.2, 0.24, 0.21, SKIN, 0, 0, 0);
    const H = o.hairC;
    if (o.hair === 'bald') { bx(head, 0.03, 0.08, 0.15, H, -0.105, 0.0, -0.02); bx(head, 0.03, 0.08, 0.15, H, 0.105, 0.0, -0.02); bx(head, 0.21, 0.08, 0.05, H, 0, -0.02, -0.09); }
    else if (o.hair === 'buzz') { bx(head, 0.21, 0.04, 0.22, H, 0, 0.12, 0); bx(head, 0.21, 0.14, 0.04, H, 0, 0.05, -0.095); }
    else {
      bx(head, 0.21, 0.07, 0.22, H, 0, 0.12, -0.005); bx(head, 0.21, 0.2, 0.05, H, 0, 0.02, -0.09);
      bx(head, 0.03, 0.12, 0.17, H, -0.105, 0.04, -0.02); bx(head, 0.03, 0.12, 0.17, H, 0.105, 0.04, -0.02);
      if (o.hair === 'bun') bx(head, 0.1, 0.1, 0.08, H, 0, 0.08, -0.15);
      if (o.hair === 'spiky') for (const sx of [-0.06, 0, 0.06]) bx(head, 0.05, 0.07, 0.07, H, sx, 0.17, 0.02);
    }
    for (const s of [-1, 1]) { bx(head, 0.035, 0.022, 0.01, 0x15151a, s * 0.048, 0.02, 0.108); bx(head, 0.05, 0.01, 0.01, H, s * 0.048, 0.055, 0.108); }
    if (o.glasses === 'metal') { for (const s of [-1, 1]) { bx(head, 0.06, 0.008, 0.006, 0x8a8f99, s * 0.048, 0.04, 0.114); bx(head, 0.06, 0.006, 0.006, 0x8a8f99, s * 0.048, 0.0, 0.114); } bx(head, 0.03, 0.006, 0.006, 0x8a8f99, 0, 0.03, 0.114); }
    if (o.glasses === 'sun') { bx(head, 0.17, 0.045, 0.01, 0x15161c, 0, 0.02, 0.112); }
    if (o.ear) bx(head, 0.02, 0.03, 0.02, 0xe8e8e8, 0.108, -0.01, 0.0);
    bx(head, 0.05, 0.012, 0.01, 0x9a5a4a, 0, -0.07, 0.108);
    const cone = gazeCone(); cone.position.set(0, 0.02, 0.11); head.add(cone);
    return { root, legs, arms, head, cone, look: o, yaw: Math.PI, headYaw: 0, last: 0 };
  }
  function makeRobot() {
    const root = new THREE.Group(), M = 0x9aa3b8, M2 = 0x6c7590;
    const glow = new THREE.MeshBasicMaterial({ color: 0xff3048, fog: false });
    const base = pivot(root, 0, 0.18, 0);
    bx(base, 0.36, 0.1, 0.36, M2, 0, 0, 0); bx(base, 0.26, 0.03, 0.26, 0, 0, -0.06, 0, glow);
    const body = pivot(root, 0, 0, 0);
    bx(body, 0.46, 0.62, 0.3, M, 0, 0.62, 0); bx(body, 0.44, 0.06, 0.28, 0xc9d0e0, 0, 0.9, 0);
    bx(body, 0.16, 0.12, 0.02, 0x1a2133, 0, 0.7, 0.155); bx(body, 0.1, 0.03, 0.022, 0, 0, 0.7, 0.16, glow);
    const arms = [];
    for (const s of [-1, 1]) { const p = pivot(body, s * 0.3, 0.88, 0); bx(p, 0.1, 0.5, 0.12, M2, 0, -0.25, 0); bx(p, 0.12, 0.08, 0.12, M, 0, -0.52, 0); arms.push(p); }
    bx(body, 0.1, 0.08, 0.1, M2, 0, 0.98, 0);
    const head = pivot(body, 0, 1.12, 0);
    bx(head, 0.32, 0.24, 0.28, M, 0, 0, 0); bx(head, 0.3, 0.04, 0.26, 0xc9d0e0, 0, 0.12, 0);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x7a1f2c, fog: false });
    bx(head, 0.26, 0.07, 0.02, 0, 0, 0.0, 0.145, visorMat);
    bx(head, 0.02, 0.16, 0.02, M2, 0.08, 0.2, 0); bx(head, 0.04, 0.04, 0.04, 0, 0.08, 0.29, 0, glow);
    const cone = gazeCone(); cone.position.set(0, 0, 0.15); head.add(cone);
    return { root, legs: [], arms, head, cone, robot: true, body, visorMat, yaw: Math.PI, headYaw: 0, last: 0 };
  }
  function makeStaff(type) { return type === 'robot' ? makeRobot() : makeHuman(STAFF_LOOK[type] || STAFF_LOOK.dean); }
  function poseModel(m, o) { // o: {x, z, yaw, moving, walk, phase, now, coneLen, predict}
    const dt = clamp(o.now - m.last, 0, 0.1); m.last = o.now;
    const rate = o.phase === 'tell' ? 3.0 : o.phase === 'watch' ? 9 : 6;
    m.yaw = angTo(m.yaw, o.yaw, Math.min(1, dt * rate));
    m.headYaw = angTo(m.headYaw, o.headYaw || 0, Math.min(1, dt * 8));
    const sw = o.moving ? Math.sin(o.walk * 7) : 0;
    m.root.position.set(o.x, m.robot ? 0.06 + Math.sin(o.now * 4) * 0.03 : (o.moving ? Math.abs(sw) * 0.02 : 0), o.z);
    m.root.rotation.y = m.yaw; m.head.rotation.y = m.headYaw;
    if (m.legs.length) { m.legs[0].rotation.x = sw * 0.45; m.legs[1].rotation.x = -sw * 0.45; }
    const crossArms = m.look && m.look.prop === 'cross' && !o.moving;
    if (crossArms) { m.arms[0].rotation.set(-1.05, 0, 0.55); m.arms[1].rotation.set(-1.05, 0, -0.55); }
    else { m.arms[0].rotation.set(-sw * 0.35, 0, 0); m.arms[1].rotation.set(o.phase === 'watch' && !m.robot ? -0.35 : sw * 0.35, 0, 0); }
    if (m.visorMat) m.visorMat.color.setHex(o.phase === 'watch' ? 0xff2e47 : o.phase === 'tell' ? 0xc03040 : 0x7a1f2c);
    const c = m.cone;
    c.visible = !!o.predict && !(o.phase === 'stand' && o.away);
    if (c.visible) {
      const col = o.phase === 'watch' ? 0xff3040 : o.phase === 'tell' ? 0xffa030 : 0xffffff;
      c.material.color.setHex(col); c.material.opacity = o.phase === 'watch' ? 0.2 : o.phase === 'tell' ? 0.16 : 0.05;
      const L = o.coneLen || 3.5; c.scale.set(L * 0.9, L * 0.9, L);
    }
  }

  // ---------- 시험장 8곳 ----------
  const SKY = {
    day: { amb: [0xfff2e0, 1.0], hemi: [0xfff0d4, 0x4a3a2e, 1.2], sun: [0xffe2b8, 2.5], fog: 0xb8ad96, glass: ['#9fd2f2', '#e8f4fb', '#7fae7a'] },
    dawn: { amb: [0xffe6dc, 0.95], hemi: [0xffe0d0, 0x4a3a3e, 1.1], sun: [0xffc8a0, 2.3], fog: 0xb8a39a, glass: ['#f2b49a', '#ffe1c4', '#8f7f86'] },
    dusk: { amb: [0xffd8b8, 0.85], hemi: [0xffcfa0, 0x3a2a2e, 1.0], sun: [0xff9a5a, 2.3], fog: 0x9a7f6a, glass: ['#e98a5a', '#f6c18a', '#5a4a5a'] },
    night: { amb: [0xc8d4ff, 0.75], hemi: [0xd0dcff, 0x1a1a2a, 0.9], sun: [0xdfe8ff, 1.5], fog: 0x1c2030, glass: ['#0d1430', '#1c2650', '#0a0d1c'] },
  };
  const ROOM3D = [
    { wall: 0xe8dcc4, wain: 0xb59a74, floor: 'wood', board: 'white', sky: 'day', lines: ['교양 국어 중간고사', '휴대폰 전원 OFF · 가방은 앞으로'] },
    { wall: 0xdfe6dc, wain: 0x8f9d8a, floor: 'wood', board: 'green', sky: 'day', lines: ['TOEIC 정기시험', 'Reading Part 5 · 신분증 지참'] },
    { wall: 0xece0c0, wain: 0xa98b62, floor: 'wood', board: 'green', sky: 'day', lines: ['한국사능력검정시험 (심화)', '부정행위 시 응시 무효'] },
    { wall: 0xe8e2d2, wain: 0xa58e6c, floor: 'wood', board: 'green', sky: 'dawn', lines: ['2026학년도 대학수학능력시험', '4교시 수학 영역 · 10:30 ~ 12:10', '휴대전화 · 스마트기기 반입 금지'] },
    { wall: 0xd3d9e0, wain: 0x7d8794, floor: 'tile', board: 'green', sky: 'day', lines: ['국가공무원 9급 공개경쟁채용', '필기시험 · 전자기기 소지 = 부정행위'] },
    { wall: 0xc9b08e, wain: 0x6e5238, floor: 'darkwood', board: 'green', sky: 'dusk', lines: ['법학적성시험 (LEET)', '2교시 추리논증'] },
    { wall: 0xeef0f2, wain: 0x9aa1ab, floor: 'tile', board: 'white', sky: 'day', hall: true, lines: ['세무사 제2차 시험', '회계학 1부 · 계산기 외 반입 금지'] },
    { wall: 0x2c3550, wain: 0x1c2236, floor: 'darktile', board: 'screen', sky: 'night', hall: true, lines: ['변호사시험', 'AI 감독 시스템 가동 중'] },
  ];
  function floorTex(kind) {
    const T = canvasTex(64, 64, false), g = T.g;
    if (kind === 'wood' || kind === 'darkwood') {
      const a = kind === 'wood' ? ['#9c6c47', '#93633f', '#a3724c', '#7c5233'] : ['#6e4b33', '#654430', '#77523a', '#4f3524'];
      g.fillStyle = a[0]; g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? a[1] : a[2]; g.fillRect(0, i * 16, 64, 15); g.fillStyle = a[3]; g.fillRect(0, i * 16 + 15, 64, 1); g.fillRect((i * 23) % 64, i * 16, 1, 15); }
    } else {
      const a = kind === 'tile' ? ['#b9bec6', '#a3a9b2', '#c6cbd2'] : ['#3b3f4f', '#2c2f3b', '#454a5c'];
      g.fillStyle = a[0]; g.fillRect(0, 0, 64, 64); g.fillStyle = a[2]; g.fillRect(2, 2, 28, 28); g.fillRect(34, 34, 28, 28);
      g.fillStyle = a[1]; g.fillRect(0, 31, 64, 2); g.fillRect(31, 0, 2, 64);
    }
    T.t.wrapS = T.t.wrapT = THREE.RepeatWrapping; T.t.needsUpdate = true; return T.t;
  }
  function skyTex(sky) {
    const T = canvasTex(32, 32, false), g = T.g, c = SKY[sky].glass, gr = g.createLinearGradient(0, 0, 0, 32);
    gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    g.fillStyle = c[2]; for (let i = 0; i < 8; i++) g.fillRect(i * 4, 22 + (i * 5) % 6, 3, 10);
    if (sky === 'night') { g.fillStyle = '#f5cc4a'; for (let i = 0; i < 9; i++) g.fillRect((i * 7) % 30, 24 + (i * 3) % 7, 1, 1); g.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) g.fillRect((i * 11) % 31, (i * 5) % 14, 1, 1); }
    T.t.needsUpdate = true; return T.t;
  }
  function boardTex(R) {
    const T = canvasTex(512, 128, false), g = T.g, white = R.board === 'white', screen = R.board === 'screen';
    g.fillStyle = white ? '#f2f2ee' : screen ? '#06080f' : '#2f5a48'; g.fillRect(0, 0, 512, 128);
    const n = R.lines.length, fg = white ? '#24324a' : screen ? '#7ff6ff' : '#e9f1e8', fg2 = white ? '#c0392b' : screen ? '#ff5a6e' : '#f2c4cf';
    g.textAlign = 'center';
    R.lines.forEach((ln, i) => { g.fillStyle = i === 0 ? fg : i === n - 1 && n > 1 ? fg2 : fg; g.font = `${i === 0 ? 800 : 700} ${i === 0 ? 28 : 21}px ${FONT}`; g.fillText(ln, 256, n === 2 ? 52 + i * 38 : 36 + i * 36); });
    if (screen) { g.strokeStyle = '#1e3a4a'; g.lineWidth = 2; g.strokeRect(6, 6, 500, 116); }
    T.t.needsUpdate = true; return T.t;
  }
  function noteTex(str) {
    const T = canvasTex(128, 96, false), g = T.g;
    g.fillStyle = '#fbf9f1'; g.fillRect(0, 0, 128, 96); g.fillStyle = '#d9473f'; g.fillRect(0, 0, 128, 14);
    g.fillStyle = '#2a2838'; g.textAlign = 'center'; g.font = `800 13px ${FONT}`;
    const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > 112 && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur);
    lines.slice(0, 4).forEach((ln, i) => g.fillText(ln, 64, 40 + i * 17 - (lines.length - 1) * 6));
    T.t.needsUpdate = true; return T.t;
  }
  const NOTES = ['중간고사 · 휴대폰 OFF', 'TOEIC · 신분증 지참', '부정행위 시 응시 무효', '휴대전화 반입 금지', '전자기기 소지 = 부정행위', '감독관 지시에 따를 것', '계산기 외 반입 금지', 'AI 감독 시스템 가동 중'];

  const EX = { scene: null, tier: -1 };
  const VIEWS = { paper: { yaw: 0, pitch: -0.83, fov: 40 }, left: { yaw: 0.8, pitch: -0.1, fov: 58 }, right: { yaw: -0.8, pitch: -0.1, fov: 58 } };
  function buildExam(ti) {
    if (EX.tier === ti && EX.scene) return;
    disposeScene(EX.scene);
    const tier = CONFIG.tiers[ti], R = ROOM3D[tier.room] || ROOM3D[0], S = SKY[R.sky], big = !!R.hall, rnd = seeded(ti + 3);
    const X1 = big ? 6.4 : 4.6, X0 = -X1, Z0 = big ? -7.6 : -6, Z1 = big ? 6.2 : 4.6, HY = big ? 3.6 : 3;
    const COLS = big ? [-4.8, -3.0, -1.2, 0.6, 2.4, 4.2] : [-3.0, -1.2, 0.6, 2.4];
    const ROWS = big ? [-5.6, -4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2] : [-4.2, -2.8, -1.4, 0, 1.4, 2.8];
    const MY = { x: 0.6, z: 0 }, sc = new THREE.Scene(), B = batch();
    sc.background = new THREE.Color(S.fog); sc.fog = new THREE.Fog(S.fog, big ? 9 : 7, big ? 24 : 18);
    sc.add(new THREE.AmbientLight(S.amb[0], S.amb[1])); sc.add(new THREE.HemisphereLight(S.hemi[0], S.hemi[1], S.hemi[2]));
    const sun = new THREE.DirectionalLight(S.sun[0], S.sun[1]); sun.position.set(R.sky === 'night' ? 0 : -6, R.sky === 'night' ? 8 : 5, -1.5); sc.add(sun);
    if (R.board === 'screen') { const red = new THREE.PointLight(0xff2040, 6, 9, 1.5); red.position.set(0, 2.6, Z0 + 1.2); sc.add(red); }
    // 바닥·벽·천장
    const ft = floorTex(R.floor); ft.repeat.set((X1 - X0) / 1.3, (Z1 - Z0) / 1.3);
    plane(sc, X1 - X0, Z1 - Z0, psx(new THREE.MeshLambertMaterial({ map: ft })), 0, 0, (Z0 + Z1) / 2, -Math.PI / 2);
    B.box(X1 - X0, 0.05, Z1 - Z0, R.sky === 'night' ? 0x2a2f40 : 0xe8e4d8, 0, HY, (Z0 + Z1) / 2);
    B.box(X1 - X0, HY, 0.1, R.wall, 0, HY / 2, Z0 - 0.05); B.box(X1 - X0, HY, 0.1, R.wall, 0, HY / 2, Z1 + 0.05);
    B.box(0.1, HY, Z1 - Z0, R.wall, X0 - 0.05, HY / 2, (Z0 + Z1) / 2); B.box(0.1, HY, Z1 - Z0, R.wall, X1 + 0.05, HY / 2, (Z0 + Z1) / 2);
    for (const [w, d, x, z] of [[X1 - X0, 0.04, 0, Z0 + 0.02], [X1 - X0, 0.04, 0, Z1 - 0.02], [0.04, Z1 - Z0, X0 + 0.02, (Z0 + Z1) / 2], [0.04, Z1 - Z0, X1 - 0.02, (Z0 + Z1) / 2]]) {
      B.box(w, 0.95, d, R.wain, x, 0.475, z); B.box(w + 0.01, 0.05, d + 0.01, 0x5a4330, x, 0.97, z);
    }
    for (let i = 0; i * 3 < Z1 - Z0 - 1; i++) for (let x = X0 + 2.2; x < X1 - 1; x += 2.4) B.box(0.5, 0.04, 1.2, 0xfafaf4, x, HY - 0.03, Z0 + 2 + i * 3); // 형광등
    // 창문 (왼쪽 벽)
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex(R.sky), fog: false });
    const shine = new THREE.MeshBasicMaterial({ color: R.sky === 'dusk' ? 0xff9a50 : 0xffeab0, transparent: true, opacity: R.sky === 'night' ? 0 : 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    for (let z = Z0 + 1.8; z < Z1 - 1; z += 2.6) {
      plane(sc, 2.0, 1.5, skyMat, X0 + 0.02, 1.85, z, 0, Math.PI / 2);
      for (const dz of [-1.04, 0, 1.04]) B.box(0.08, 1.62, 0.08, 0xf2efe6, X0 + 0.05, 1.85, z + dz);
      B.box(0.08, 0.08, 2.16, 0xf2efe6, X0 + 0.05, 2.64, z); B.box(0.16, 0.06, 2.16, 0xf2efe6, X0 + 0.08, 1.07, z);
      if (R.sky !== 'night') plane(sc, 1.9, 1.3, shine, X0 + 2.0, 0.012, z + 0.4, -Math.PI / 2);
    }
    // 앞: 칠판·시계·TV, 오른쪽: 문·안내문·스피커, 뒤: 사물함
    B.box(5.6, 1.5, 0.08, R.board === 'screen' ? 0x0c0e16 : 0x6b4a30, 0, 1.6, Z0 + 0.06);
    plane(sc, 5.4, 1.32, psx(new THREE.MeshLambertMaterial({ map: boardTex(R), emissive: R.board === 'screen' ? 0x223344 : 0x000000 })), 0, 1.6, Z0 + 0.105);
    B.box(5.6, 0.05, 0.14, 0x6b4a30, 0, 0.84, Z0 + 0.12);
    if (!big) B.box(1.1, 0.7, 0.1, 0x1c1d22, 3.6, 2.35, Z0 + 0.1);
    const clock = canvasTex(64, 64, false);
    plane(sc, 0.42, 0.42, new THREE.MeshBasicMaterial({ map: clock.t, transparent: true }), 0, HY - 0.38, Z0 + 0.11);
    B.box(0.08, 2.1, 1.0, 0x8a6a4a, X1 - 0.04, 1.05, Z0 + 1.4); B.box(0.1, 0.5, 0.36, 0xcfe8f5, X1 - 0.06, 1.55, Z0 + 1.25);
    plane(sc, 0.64, 0.48, psx(new THREE.MeshLambertMaterial({ map: noteTex(NOTES[tier.room] || NOTES[0]) })), X1 - 0.02, 1.6, Z0 + 3.6, 0, -Math.PI / 2);
    B.box(0.3, 0.3, 0.2, 0x3a3a40, X1 - 0.12, HY - 0.4, Z0 + 4.6);
    for (let x = X0 + 1.3; x < X1 - 0.6; x += 1.32) B.box(1.1, 1.2, 0.5, (Math.round(x * 10) % 2) ? 0x9aa0a8 : 0x8d939c, x, 0.6, Z1 - 0.28);
    // 책상·의자·수험생
    const TOP = R.floor === 'darktile' ? 0x6a5a4a : 0xc89a64, METAL = 0x8c9099, SEAT = 0xb98a58;
    const CLOTH = [0x3f4f78, 0x5a5f6b, 0x7a3b3b, 0x2f5d50, 0x4b4b4b, 0x6b5a46, 0x8a8f99, 0x3b3550, 0xb0a48c, 0x24324a];
    const HAIRS = [0x1f1a1c, 0x2b211c, 0x3a2a20, 0x161214, 0x4a3226];
    ROWS.forEach(z => COLS.forEach(x => {
      const dz = z - 0.02;
      B.box(0.62, 0.04, 0.44, TOP, x, 0.72, dz); B.box(0.56, 0.08, 0.36, METAL, x, 0.64, dz);
      B.box(0.03, 0.62, 0.4, METAL, x - 0.28, 0.31, dz); B.box(0.03, 0.62, 0.4, METAL, x + 0.28, 0.31, dz);
      B.box(0.4, 0.03, 0.38, SEAT, x, 0.44, z + 0.42); B.box(0.4, 0.26, 0.03, SEAT, x, 0.72, z + 0.62);
      B.box(0.03, 0.44, 0.36, METAL, x - 0.18, 0.22, z + 0.42); B.box(0.03, 0.44, 0.36, METAL, x + 0.18, 0.22, z + 0.42);
      if (x === MY.x && z === MY.z) return;
      B.box(0.24, 0.004, 0.32, 0xf4f1e6, x - 0.04, 0.743, dz + 0.02, 0, 0.1);
      const cl = CLOTH[Math.floor(rnd() * CLOTH.length)], hr = HAIRS[Math.floor(rnd() * HAIRS.length)], lean = 0.18 + rnd() * 0.12;
      B.box(0.34, 0.14, 0.36, 0x2b2f3d, x, 0.52, z + 0.3);
      B.box(0.12, 0.42, 0.12, 0x2b2f3d, x - 0.08, 0.22, z + 0.12); B.box(0.12, 0.42, 0.12, 0x2b2f3d, x + 0.08, 0.22, z + 0.12);
      B.box(0.36, 0.46, 0.2, cl, x, 0.8, z + 0.44, -lean);
      B.box(0.09, 0.1, 0.34, cl, x - 0.17, 0.79, z + 0.16); B.box(0.09, 0.1, 0.34, cl, x + 0.17, 0.79, z + 0.16);
      B.box(0.19, 0.22, 0.2, 0xe2b48e, x, 1.08, z + 0.33, -lean * 0.6);
      B.box(0.2, 0.09, 0.21, hr, x, 1.19, z + 0.34, -lean * 0.6); B.box(0.2, 0.17, 0.06, hr, x, 1.11, z + 0.44, -lean * 0.6);
      if (rnd() < 0.3) B.box(0.1, 0.1, 0.08, hr, x, 1.12, z + 0.5);
    }));
    sc.add(B.mesh());
    // 내 자리: 시험지, 수험표, 손, 사인펜, 스마트워치
    const paperTex = canvasTex(PAPER_W, PAPER_H, true);
    const paper = plane(sc, 0.31, 0.43, new THREE.MeshLambertMaterial({ map: paperTex.t }), MY.x, 0.744, MY.z - 0.02, -Math.PI / 2);
    const ticket = canvasTex(128, 80, false);
    { const g = ticket.g; g.fillStyle = '#eef4f8'; g.fillRect(0, 0, 128, 80); g.fillStyle = '#2b5f8a'; g.fillRect(0, 0, 128, 16); g.fillStyle = '#ffffff'; g.font = `800 11px ${FONT}`; g.fillText('수 험 표', 44, 12); g.fillStyle = '#2a2838'; g.font = `700 10px ${FONT}`; g.fillText('수험번호 ' + (31000000 + ti * 1234567), 8, 36); g.fillText('성명  김수험', 8, 54); g.fillStyle = '#c9b8a6'; g.fillRect(92, 26, 28, 36); ticket.t.needsUpdate = true; }
    plane(sc, 0.11, 0.07, psx(new THREE.MeshLambertMaterial({ map: ticket.t })), MY.x - 0.24, 0.743, MY.z - 0.16, -Math.PI / 2);
    const HSK = 0xd9a57c, SLV = 0x3f5285, hands = pivot(sc, 0, 0, 0);
    const hand = (x, z, side) => {
      const g = pivot(hands, x, 0.752, z); g.rotation.y = side * 0.35;
      bx(g, 0.075, 0.026, 0.07, HSK, 0, 0, 0);
      for (let i = 0; i < 4; i++) bx(g, 0.015, 0.018, 0.045 - Math.abs(i - 1.5) * 0.006, HSK, -0.027 + i * 0.018, -0.002, -0.055);
      bx(g, 0.018, 0.018, 0.04, HSK, side * -0.045, 0, -0.02).rotation.y = side * 0.5;
      bx(g, 0.1, 0.07, 0.3, SLV, side * 0.01, 0.01, 0.18); bx(g, 0.104, 0.074, 0.03, 0x2f3e66, side * 0.01, 0.01, 0.045);
      return g;
    };
    const lh = hand(MY.x - 0.2, MY.z + 0.21, -1); hand(MY.x + 0.19, MY.z + 0.19, 1);
    const watch = pivot(lh, 0, 0.02, 0.06);
    bx(watch, 0.06, 0.012, 0.05, 0x20303a, 0, 0, 0); bx(watch, 0.044, 0.004, 0.036, 0, 0, 0.007, 0, new THREE.MeshBasicMaterial({ color: 0x45e5ee, fog: false }));
    const pen = pivot(sc, MY.x + 0.15, 0.772, MY.z + 0.13); pen.rotation.set(0.3, 0.75, 0);
    bx(pen, 0.009, 0.009, 0.1, 0x24242c, 0, 0, 0); bx(pen, 0.01, 0.01, 0.018, 0xdedee6, 0, 0, -0.058);
    // 감독관
    const staff = tier.staff.map(d => { const m = makeStaff(d.type); sc.add(m.root); return m; });
    // CCTV·탐지 전파 장치
    let cctv = null, pulse = null;
    if (tier.sec.includes('cctv')) {
      const g = pivot(sc, X1 - 0.25, HY - 0.32, Z0 + 1.9); bx(g, 0.06, 0.2, 0.06, 0x9b9eac, 0, 0.12, 0); bx(g, 0.2, 0.05, 0.2, 0x9b9eac, 0.1, 0.22, 0);
      const body = pivot(g, 0, 0, 0); bx(body, 0.16, 0.14, 0.32, 0xd4d6de, 0, 0, 0); bx(body, 0.1, 0.1, 0.02, 0x1b2030, 0, 0, 0.17);
      const led = new THREE.MeshBasicMaterial({ color: 0x6b2a2a, fog: false }); bx(body, 0.03, 0.03, 0.02, 0, 0.05, 0.05, 0.165, led);
      const cone = gazeCone(); cone.position.set(0, 0, 0.18); body.add(cone);
      cctv = { body, led, cone, base: Math.atan2(MY.x - (X1 - 0.25), MY.z + 0.42 - (Z0 + 1.9)) };
    }
    if (tier.sec.includes('pulse')) {
      const g = pivot(sc, X1 - 1.4, 2.0, Z0 + 0.16); bx(g, 0.36, 0.26, 0.14, 0x3a3f4a, 0, 0, 0);
      const led = new THREE.MeshBasicMaterial({ color: 0x5a2a2a, fog: false }); bx(g, 0.06, 0.06, 0.02, 0, -0.1, 0.04, 0.08, led);
      bx(g, 0.02, 0.3, 0.02, 0x2a2a30, 0.1, 0.28, 0); bx(g, 0.05, 0.05, 0.05, 0, 0.1, 0.44, 0, new THREE.MeshBasicMaterial({ color: 0xff3048, fog: false }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 48), new THREE.MeshBasicMaterial({ color: 0xff3048, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(X1 - 1.4, 1.6, Z0 + 0.4); ring.visible = false; sc.add(ring);
      pulse = { led, ring };
    }
    const cam = new THREE.PerspectiveCamera(40, RW / RH, 0.03, 60); cam.rotation.order = 'YXZ';
    const eye = new THREE.Vector3(MY.x, 1.2, MY.z + 0.42); cam.position.copy(eye);
    Object.assign(EX, { scene: sc, tier: ti, paper, paperTex, paperSig: '', staff, cctv, pulse, cam, eye, watch, pen, clock, clockSec: -1,
      AL: MY.x - 0.9, AR: MY.x + 0.9, zFront: ROWS[0] - 0.75, zBack: ROWS[ROWS.length - 1] + 0.75 });
  }
  const zOf = u => lerp(EX.zBack, EX.zFront, u);
  function drawClockFace(sec) {
    const g = EX.clock.g; g.clearRect(0, 0, 64, 64);
    g.fillStyle = '#2a2838'; g.beginPath(); g.arc(32, 32, 31, 0, 7); g.fill(); g.fillStyle = '#fbfaf3'; g.beginPath(); g.arc(32, 32, 27, 0, 7); g.fill();
    g.strokeStyle = '#2a2838'; g.lineWidth = 3; const h = 0.55 * 6.283, m = (sec / 60) * 6.283;
    g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.sin(h) * 13, 32 - Math.cos(h) * 13); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.sin(m) * 20, 32 - Math.cos(m) * 20); g.stroke();
    EX.clock.t.needsUpdate = true;
  }
  function staffPlace(s) { // 게임 규칙의 위치(왼쪽·오른쪽 통로, 앞뒤 u)를 교실 좌표로
    let x = s.side === 'L' ? EX.AL : EX.AR, z = zOf(s.u), yaw, moving = s.phase === 'walk';
    if (s.phase === 'cross') { // 앞이나 뒤 끝으로 가서 반대편 통로로 건너간다
      const k = clamp(s.t / s.dur, 0, 1), fromX = s.from === 'L' ? EX.AL : EX.AR, toX = s.from === 'L' ? EX.AR : EX.AL;
      const endZ = zOf(s.crossEnd === 'back' ? 0.06 : 0.94), z0 = zOf(s.u), sp = clamp(s.crossSplit == null ? 0.35 : s.crossSplit, 0.05, 0.95);
      z = lerp(z0, endZ, clamp(k / sp, 0, 1)); x = lerp(fromX, toX, clamp((k - sp) / (1 - sp), 0, 1));
      yaw = k < sp ? (endZ < z0 ? Math.PI : 0) : (toX > fromX ? Math.PI / 2 : -Math.PI / 2); moving = true;
    } else if (s.phase === 'walk') yaw = s.dir > 0 ? Math.PI : 0;
    else if (s.phase === 'stand') yaw = s.away ? (s.side === 'L' ? -Math.PI / 2 : Math.PI / 2) : Math.PI;
    else yaw = Math.atan2(EX.eye.x - x, EX.eye.z - z);
    return { x, z, yaw, moving };
  }
  function renderExam(E, now) {
    if (!W.ok) return;
    buildExam(E.tier);
    const a = VIEWS[E.prevView] || VIEWS.paper, b = VIEWS[E.view] || VIEWS.paper, k = ease(clamp(E.viewT, 0, 1)), cam = EX.cam;
    cam.position.copy(EX.eye); cam.position.y += Math.sin(now * 1.3) * 0.003;
    cam.rotation.y = lerp(a.yaw, b.yaw, k); cam.rotation.x = lerp(a.pitch, b.pitch, k) + Math.sin(now * 0.9) * 0.004;
    const fov = lerp(a.fov, b.fov, k); if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const predict = E.gear.predict > 0;
    E.staff.forEach((s, i) => {
      const m = EX.staff[i]; if (!m) return;
      const p = staffPlace(s), toMe = Math.atan2(EX.eye.x - p.x, EX.eye.z - p.z);
      const headYaw = s.phase === 'tell' ? clamp(angTo(0, toMe - (m.yaw || 0), 1), -1.1, 1.1) : 0;
      const dist = Math.hypot(EX.eye.x - p.x, EX.eye.z - p.z);
      poseModel(m, { x: p.x, z: p.z, yaw: p.yaw, moving: p.moving, walk: s.walk, phase: s.phase, now, headYaw, predict, away: s.away, coneLen: s.phase === 'watch' ? Math.max(0.6, dist - 0.55) : 3.5 });
    });
    if (EX.cctv) {
      const c = EX.cctv, on = E.cctv && E.cctv.on, jammed = E.gear.cctvjam >= 2;
      c.body.rotation.y = c.base + (E.cctv ? E.cctv.a : 0) * 0.9;
      c.led.color.setHex(on && !jammed ? (Math.floor(now * 4) % 2 ? 0xff3048 : 0xff9a9a) : 0x6b2a2a);
      c.cone.visible = predict; c.cone.material.color.setHex(on && !jammed ? 0xff3040 : 0xff8080); c.cone.material.opacity = on && !jammed ? 0.16 : 0.05; c.cone.scale.set(6, 6, 7);
    }
    if (EX.pulse && E.pulse) {
      const p = EX.pulse, warn = E.pulse.warn > 0 && Math.floor(now * 8) % 2 === 0;
      p.led.color.setHex(warn || E.pulse.active > 0 ? 0xff3048 : 0x5a2a2a);
      p.ring.visible = E.pulse.active > 0;
      if (p.ring.visible) { const kk = 1 - E.pulse.active / 0.6; p.ring.scale.setScalar(0.3 + kk * 16); p.ring.material.opacity = 0.6 * (1 - kk) + 0.1; }
    }
    EX.watch.visible = E.gear.watch > 0;
    EX.pen.position.y = 0.772 + (E.fb ? Math.sin(E.fb.t * 40) * 0.006 : 0);
    const sec = Math.floor(now) % 60; if (sec !== EX.clockSec) { EX.clockSec = sec; drawClockFace(sec); }
    const q = E.qs[Math.min(E.qi, E.qs.length - 1)];
    const sig = [E.qi, Math.min(3, Math.floor(E.scan * 3 + 1e-6)), E.ai, E.answers[E.qi], !!E.fb, E.scan > 0, q && q.pre, E.start > 0].join();
    if (E.holding || sig !== EX.paperSig) { EX.paperSig = sig; drawPaperTexture(EX.paperTex.g, E, now); EX.paperTex.t.needsUpdate = true; }
    draw(EX.scene, cam, now);
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickChoice(x, y) { // 화면(640x360 좌표)에서 톡 친 자리 → 시험지 보기 번호
    if (!W.ok || !EX.scene) return -1;
    ndc.set(x / RW * 2 - 1, -(y / RH * 2 - 1)); ray.setFromCamera(ndc, EX.cam);
    const hit = ray.intersectObject(EX.paper)[0]; if (!hit || !hit.uv) return -1;
    return paperRowAt((1 - hit.uv.y) * PAPER_H);
  }

  // ---------- 허브: 고시원 방 ----------
  const HUB = { scene: null };
  function buildHub() {
    if (HUB.scene) return;
    const sc = new THREE.Scene(), B = batch();
    sc.background = new THREE.Color(0x15131c); sc.fog = new THREE.Fog(0x15131c, 3, 7);
    sc.add(new THREE.AmbientLight(0xcfc4ff, 0.95)); sc.add(new THREE.HemisphereLight(0xffe2c0, 0x1c1620, 0.8));
    const lamp = new THREE.PointLight(0xffc888, 1.1, 2.4, 2); lamp.position.set(-0.85, 0.98, -0.3); sc.add(lamp);
    const tube = new THREE.PointLight(0xe8f0ff, 1.8, 5, 1.6); tube.position.set(0, 2.25, 0.6); sc.add(tube);
    const X0 = -1.25, X1 = 1.25, Z0 = -0.7, Z1 = 2.2, HY = 2.4;
    const wallT = canvasTex(32, 32, false); { const g = wallT.g; g.fillStyle = '#d6cfbf'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#cbc3b1'; for (let i = 0; i < 8; i++) g.fillRect(i * 4 + 1, 0, 1, 32); g.fillStyle = '#ddd6c8'; g.fillRect(0, 15, 32, 1); wallT.t.wrapS = wallT.t.wrapT = THREE.RepeatWrapping; wallT.t.repeat.set(8, 6); wallT.t.needsUpdate = true; }
    const wallM = psx(new THREE.MeshLambertMaterial({ map: wallT.t }));
    plane(sc, X1 - X0, HY, wallM, 0, HY / 2, Z0); plane(sc, Z1 - Z0, HY, wallM, X0, HY / 2, (Z0 + Z1) / 2, 0, Math.PI / 2); plane(sc, Z1 - Z0, HY, wallM, X1, HY / 2, (Z0 + Z1) / 2, 0, -Math.PI / 2);
    const fl = floorTex('tile'); fl.repeat.set(4, 5); plane(sc, X1 - X0, Z1 - Z0, psx(new THREE.MeshLambertMaterial({ map: fl, color: 0xb8a888 })), 0, 0, (Z0 + Z1) / 2, -Math.PI / 2);
    B.box(X1 - X0, 0.04, Z1 - Z0, 0xd8d2c6, 0, HY, (Z0 + Z1) / 2); B.box(0.6, 0.04, 0.12, 0xf4f4f0, 0, HY - 0.03, 0.6);
    B.box(X1 - X0, 0.08, 0.02, 0x8a7a64, 0, 0.04, Z0 + 0.01);
    // 책상과 위 선반
    B.box(1.62, 0.04, 0.62, 0xb08a5e, -0.43, 0.74, -0.38); B.box(0.04, 0.72, 0.58, 0x8c6a46, -1.21, 0.36, -0.38); B.box(0.04, 0.72, 0.58, 0x8c6a46, 0.35, 0.36, -0.38);
    B.box(1.62, 0.03, 0.26, 0x9c7a50, -0.43, 1.46, -0.56); B.box(0.03, 0.2, 0.26, 0x8c6a46, 0.36, 1.36, -0.56);
    const spines = [0xb8362e, 0x2b5f8a, 0xe7c13a, 0x3f7a4a, 0xd9705f, 0x24324a, 0x8a5a32];
    for (let i = 0; i < 8; i++) B.box(0.035, 0.22 + (i % 3) * 0.02, 0.18, spines[i % spines.length], -0.02 + i * 0.042, 1.585 + (i % 3) * 0.01, -0.58);
    for (let i = 0; i < 4; i++) B.box(0.22, 0.04, 0.3, spines[(i + 2) % spines.length], 0.22, 0.78 + i * 0.04, -0.52, 0, i * 0.12); // 수험서 더미
    B.box(0.05, 0.11, 0.05, 0x2a6ad9, 0.3, 0.815, -0.16); B.box(0.05, 0.11, 0.05, 0x22a058, 0.24, 0.815, -0.24); // 에너지 음료
    B.box(0.03, 0.34, 0.03, 0x2a2a30, -1.02, 0.93, -0.5); B.box(0.18, 0.08, 0.12, 0x2a2a30, -0.98, 1.1, -0.42); B.box(0.12, 0.02, 0.12, 0x2a2a30, -1.02, 0.77, -0.5); // 스탠드
    // 창문 (밤 도시)
    const win = canvasTex(64, 48, false); { const g = win.g; g.fillStyle = '#0d1430'; g.fillRect(0, 0, 64, 48); for (let i = 0; i < 9; i++) { g.fillStyle = '#080b18'; g.fillRect(i * 7, 20 + (i * 5) % 12, 6, 30); } g.fillStyle = '#f5cc4a'; for (let i = 0; i < 18; i++) g.fillRect((i * 13) % 62, 26 + (i * 7) % 20, 1, 1); win.t.needsUpdate = true; }
    plane(sc, 0.5, 0.38, new THREE.MeshBasicMaterial({ map: win.t, fog: false }), 0.05, 1.16, Z0 + 0.01);
    B.box(0.56, 0.03, 0.03, 0xe8e4da, 0.05, 1.36, Z0 + 0.02); B.box(0.56, 0.03, 0.03, 0xe8e4da, 0.05, 0.96, Z0 + 0.02); B.box(0.03, 0.42, 0.03, 0xe8e4da, -0.22, 1.16, Z0 + 0.02); B.box(0.03, 0.42, 0.03, 0xe8e4da, 0.32, 1.16, Z0 + 0.02); B.box(0.02, 0.4, 0.02, 0xe8e4da, 0.05, 1.16, Z0 + 0.025);
    sc.add(B.mesh());
    // 누르는 물건들 (각자 재질을 따로 둬서 마우스를 올리면 밝아진다)
    const hot = { exams: [], gear: [], log: [], go: [] }, hm = (key, color, extra) => { const m = ownMat(color, extra); hot[key].push(m); return m; };
    const cork = canvasTex(256, 176, false);
    const board = pivot(sc, -0.74, 1.12, Z0 + 0.012); bx(board, 0.72, 0.5, 0.02, 0, 0, 0, 0, hm('exams', 0x8a6a46));
    const corkFace = plane(board, 0.66, 0.44, hm('exams', 0xffffff, { map: cork.t }), 0, 0, 0.012);
    const laptop = pivot(sc, -0.42, 0.76, -0.33); bx(laptop, 0.36, 0.02, 0.24, 0, 0, 0, 0, hm('gear', 0x3a3d46));
    const scr = pivot(laptop, 0, 0.0, -0.12); scr.rotation.x = -0.32; bx(scr, 0.36, 0.23, 0.012, 0, 0, 0.115, 0, hm('gear', 0x2c2f38));
    const shop = canvasTex(256, 160, false), shopFace = plane(scr, 0.33, 0.2, new THREE.MeshBasicMaterial({ map: shop.t, fog: false }), 0, 0.115, 0.008); hot.gear.push(shopFace.material);
    const phone = pivot(sc, 0.06, 0.765, -0.2); phone.rotation.set(-Math.PI / 2, 0, -0.25); bx(phone, 0.08, 0.15, 0.012, 0, 0, 0, 0, hm('log', 0x1a1a20));
    const phoneT = canvasTex(64, 120, false), phoneFace = plane(phone, 0.07, 0.135, new THREE.MeshBasicMaterial({ map: phoneT.t, fog: false }), 0, 0, 0.0065); hot.log.push(phoneFace.material);
    const door = pivot(sc, 0.84, 1.03, Z0 + 0.03);
    bx(door, 0.82, 2.06, 0.05, 0, 0, 0, 0, hm('go', 0x7a5a3c)); bx(door, 0.06, 0.06, 0.08, 0, -0.3, -0.02, 0.05, hm('go', 0xd4b25a));
    const sign = canvasTex(128, 96, false), signFace = plane(door, 0.36, 0.27, hm('go', 0xffffff, { map: sign.t }), 0.05, 0.35, 0.03); void signFace;
    // 산 장비가 책상에 놓인다
    const gear = {};
    const glasses = pivot(sc, -0.06, 0.745, -0.42); bx(glasses, 0.1, 0.012, 0.08, 0x2a2434, 0, 0.006, 0); bx(glasses, 0.012, 0.11, 0.012, 0x2a2434, 0, 0.06, 0);
    const lensM = new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.75, fog: false });
    const gl = pivot(glasses, 0, 0.125, 0.01);
    for (const s of [-1, 1]) { bx(gl, 0.07, 0.05, 0.008, 0x2a2434, s * 0.042, 0, 0, hm('gear', 0x2a2434)); bx(gl, 0.058, 0.04, 0.009, 0, s * 0.042, 0, 0.001, lensM); bx(gl, 0.006, 0.006, 0.12, 0x2a2434, s * 0.078, 0.012, -0.06); }
    bx(gl, 0.016, 0.008, 0.008, 0x2a2434, 0, 0.012, 0);
    const pled = new THREE.MeshBasicMaterial({ color: 0xf6a234, fog: false }); gear.predict = bx(gl, 0.01, 0.01, 0.01, 0, 0.075, 0.03, 0.006, pled);
    gear.watch = pivot(sc, -0.66, 0.75, -0.16); bx(gear.watch, 0.05, 0.012, 0.14, 0x3a3248, 0, 0, 0); bx(gear.watch, 0.05, 0.016, 0.05, 0x20303a, 0, 0.006, 0); bx(gear.watch, 0.04, 0.004, 0.04, 0, 0, 0.015, 0, new THREE.MeshBasicMaterial({ color: 0x45e5ee, fog: false }));
    gear.earbud = pivot(sc, -0.2, 0.755, -0.16); bx(gear.earbud, 0.06, 0.03, 0.045, 0xf2f2f4, 0, 0, 0); bx(gear.earbud, 0.008, 0.008, 0.004, 0, 0, 0.004, 0.024, new THREE.MeshBasicMaterial({ color: 0x45e5ee, fog: false }));
    gear.autoscan = pivot(sc, -0.86, 0.746, -0.2); bx(gear.autoscan, 0.09, 0.006, 0.07, 0x1f6b3a, 0, 0, 0); bx(gear.autoscan, 0.03, 0.01, 0.03, 0x111111, 0.01, 0.006, 0); bx(gear.autoscan, 0.07, 0.002, 0.004, 0xe7c13a, 0, 0.004, 0.025);
    gear.model = pivot(sc, -0.98, 0.8, -0.58); bx(gear.model, 0.18, 0.1, 0.12, 0x15161c, 0, 0, 0); bx(gear.model, 0.16, 0.01, 0.002, 0, 0, 0.0, 0.061, new THREE.MeshBasicMaterial({ color: 0x8a5cff, fog: false }));
    gear.cctvjam = pivot(sc, -1.12, 0.79, -0.26); bx(gear.cctvjam, 0.1, 0.08, 0.08, 0xd4d6de, 0, 0, 0); bx(gear.cctvjam, 0.01, 0.12, 0.01, 0x2a2a30, 0.03, 0.1, 0); bx(gear.cctvjam, 0.02, 0.02, 0.004, 0, -0.02, 0.01, 0.041, new THREE.MeshBasicMaterial({ color: 0xea4540, fog: false }));
    gear.jammer = pivot(sc, -1.12, 0.79, -0.08); bx(gear.jammer, 0.1, 0.07, 0.07, 0x3a3f4a, 0, 0, 0); bx(gear.jammer, 0.01, 0.16, 0.01, 0x2a2a30, -0.03, 0.12, 0); bx(gear.jammer, 0.02, 0.02, 0.004, 0, 0.02, 0.01, 0.036, new THREE.MeshBasicMaterial({ color: 0x45e5ee, fog: false }));
    gear.coach = pivot(sc, -0.2, 0.8, -0.62); gear.coach.rotation.x = -0.25; bx(gear.coach, 0.16, 0.11, 0.008, 0x1a1a20, 0, 0, 0); bx(gear.coach, 0.14, 0.09, 0.002, 0, 0, 0, 0.005, new THREE.MeshBasicMaterial({ color: 0x2f7a5a, fog: false }));
    const bots = [];
    for (let i = 0; i < 8; i++) { const b = pivot(sc, -1.12 + i * 0.11, 1.475, -0.52); bx(b, 0.06, 0.05, 0.05, 0x9aa3b8, 0, 0.04, 0); bx(b, 0.05, 0.02, 0.006, 0, 0, 0.045, 0.026, new THREE.MeshBasicMaterial({ color: 0x7ff6ff, fog: false })); bx(b, 0.008, 0.03, 0.008, 0x2a2a30, 0, 0.08, 0); bx(b, 0.07, 0.03, 0.06, 0x8a5a32, 0, 0.01, 0); b.visible = false; bots.push(b); }
    const cam = new THREE.PerspectiveCamera(60, RW / RH, 0.03, 30); cam.rotation.order = 'YXZ';
    Object.assign(HUB, { scene: sc, cam, hot, cork, shop, phoneT, sign, gear, bots, lensM, sigs: {}, anchors: [
      ['exams', '일정표 · 시험 접수', new THREE.Vector3(-0.74, 1.4, Z0 + 0.05)],
      ['gear', '노트북 · AI 장비몰', new THREE.Vector3(-0.42, 1.02, -0.38)],
      ['log', '폰 · 기록', new THREE.Vector3(0.06, 0.84, -0.2)],
      ['go', '문 · 시험장 가기', new THREE.Vector3(0.84, 1.68, Z0 + 0.06)],
    ], pickables: [board, laptop, phone, door, glasses].map((o, i) => { o.userData.action = ['exams', 'gear', 'log', 'go', 'gear'][i]; return o; }) });
    void corkFace;
  }
  function drawCork(G) { // 시험 일정표: 지난 시험엔 합격, 다음 시험엔 응시료
    const g = HUB.cork.g, nt = nextTierIndex(G);
    g.fillStyle = '#c79a62'; g.fillRect(0, 0, 256, 176); g.fillStyle = '#b98a54'; for (let i = 0; i < 60; i++) g.fillRect((i * 37) % 256, (i * 23) % 176, 2, 2);
    g.fillStyle = '#fbf9f1'; g.fillRect(12, 8, 232, 160); g.fillStyle = '#d9473f'; g.fillRect(12, 8, 232, 18);
    g.fillStyle = '#ffffff'; g.font = `800 13px ${FONT}`; g.textAlign = 'left'; g.fillText('2026 시험 일정표', 20, 22);
    CONFIG.tiers.forEach((t, i) => {
      const y = 42 + i * 16, locked = i > G.unlocked - 1;
      g.fillStyle = i === nt ? '#ffe9a8' : 'rgba(0,0,0,0)'; g.fillRect(14, y - 11, 228, 15);
      g.fillStyle = locked ? '#a8a4b4' : '#2a2838'; g.font = `${i === nt ? 800 : 700} 11px ${FONT}`; g.fillText(t.name, 20, y);
      g.textAlign = 'right'; g.fillStyle = G.cleared[i] ? '#2f8a3a' : locked ? '#a8a4b4' : '#b8362e';
      g.fillText(G.cleared[i] ? '합격' : locked ? '-' : examFee(t) ? won(examFee(t)) + '원' : '무료', 236, y); g.textAlign = 'left';
    });
    HUB.cork.t.needsUpdate = true;
  }
  function drawShop() {
    const g = HUB.shop.g; g.fillStyle = '#0d1018'; g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#45e5ee'; g.font = `800 16px ${FONT}`; g.textAlign = 'left'; g.fillText('AI 장비몰', 12, 22); g.fillStyle = '#2a8f9a'; g.fillRect(12, 30, 232, 1);
    ['렌즈 스캐너', 'AI 모델', '스텔스 코팅', '시선 예측'].forEach((s, i) => { g.fillStyle = '#1c2230'; g.fillRect(12 + (i % 2) * 118, 40 + Math.floor(i / 2) * 56, 110, 48); g.fillStyle = '#c9f6fa'; g.font = `700 12px ${FONT}`; g.fillText(s, 20 + (i % 2) * 118, 60 + Math.floor(i / 2) * 56); g.fillStyle = '#f5cc4a'; g.fillText('BUY', 20 + (i % 2) * 118, 78 + Math.floor(i / 2) * 56); });
    HUB.shop.t.needsUpdate = true;
  }
  function drawPhone(G) {
    const g = HUB.phoneT.g; g.fillStyle = '#10131c'; g.fillRect(0, 0, 64, 120);
    g.fillStyle = '#8fa0b8'; g.font = `700 8px ${FONT}`; g.textAlign = 'center'; g.fillText('내 통장', 32, 16);
    g.fillStyle = '#f5cc4a'; g.font = `800 11px ${FONT}`; g.fillText(won(STATE.shown), 32, 34); g.font = `800 9px ${FONT}`; g.fillText('원', 32, 46);
    g.fillStyle = '#45e5ee'; g.font = `700 7px ${FONT}`; g.fillText(G.gear.bot ? '봇 초당 ' + won(botRate()) : '봇 없음', 32, 64);
    g.fillStyle = '#2a2f3c'; for (let i = 0; i < 3; i++) g.fillRect(8, 76 + i * 12, 48, 8);
    HUB.phoneT.t.needsUpdate = true;
  }
  function drawSign(G) {
    const g = HUB.sign.g, t = CONFIG.tiers[nextTierIndex(G)];
    g.fillStyle = '#fbf9f1'; g.fillRect(0, 0, 128, 96); g.fillStyle = '#2b5f8a'; g.fillRect(0, 0, 128, 16);
    g.fillStyle = '#ffffff'; g.font = `800 11px ${FONT}`; g.textAlign = 'center'; g.fillText('다음 시험', 64, 12);
    g.fillStyle = '#2a2838'; g.font = `800 12px ${FONT}`;
    const nm = t.name.length > 9 ? [t.name.slice(0, 9), t.name.slice(9)] : [t.name]; nm.forEach((s, i) => g.fillText(s, 64, 40 + i * 15));
    g.fillStyle = '#b8362e'; g.font = `700 10px ${FONT}`; g.fillText(examFee(t) ? `응시료 ${won(examFee(t))}원` : '응시료 무료', 64, 82);
    HUB.sign.t.needsUpdate = true;
  }
  function updateHub(G, now, hover) {
    const sigs = HUB.sigs, examSig = G.unlocked + '|' + G.cleared.join() + '|' + nextTierIndex(G) + '|' + tune.fee_scale;
    if (sigs.cork !== examSig) { sigs.cork = examSig; drawCork(G); drawSign(G); }
    if (!sigs.shop) { sigs.shop = 1; drawShop(); }
    if (now - (sigs.phoneT || -9) > 0.25) { sigs.phoneT = now; drawPhone(G); }
    const g = G.gear;
    HUB.gear.predict.visible = g.predict > 0;
    for (const id of ['watch', 'earbud', 'autoscan', 'model', 'cctvjam', 'jammer', 'coach']) HUB.gear[id].visible = g[id] > 0;
    HUB.bots.forEach((b, i) => { b.visible = i < g.bot; b.position.y = 1.475 + (i < g.bot ? Math.abs(Math.sin(now * 3 + i)) * 0.006 : 0); });
    HUB.lensM.color.setHex(g.stealth ? 0x8a6cd6 : [0xbfe8ff, 0x9fe0ff, 0x7fd6ff, 0x5fe0e8, 0x45e5ee][Math.min(4, Math.floor(g.lens / 2))]);
    for (const key in HUB.hot) for (const m of HUB.hot[key]) if (m.emissive) m.emissive.setHex(key === hover ? 0x3a3424 : 0x000000);
  }
  function renderHub(G, now, hover) {
    if (!W.ok) return;
    buildHub(); updateHub(G, now, hover);
    const c = HUB.cam; c.position.set(-0.3, 1.18, 0.62); c.rotation.y = -0.12 + Math.sin(now * 0.3) * 0.01; c.rotation.x = -0.2 + Math.sin(now * 0.45) * 0.006;
    if (c.fov !== 60) { c.fov = 60; c.updateProjectionMatrix(); }
    c.updateMatrixWorld();
    draw(HUB.scene, c, now);
  }
  function renderTitle(G, now) { // 밤의 고시원: 책상 위 AI 안경을 천천히 비춘다
    if (!W.ok) return;
    buildHub(); updateHub(G, now, null);
    const c = HUB.cam; c.position.set(0.05 + Math.sin(now * 0.2) * 0.06, 1.0, 0.05); c.rotation.y = 0.2 + Math.sin(now * 0.2) * 0.05; c.rotation.x = -0.3;
    if (c.fov !== 50) { c.fov = 50; c.updateProjectionMatrix(); }
    c.updateMatrixWorld();
    draw(HUB.scene, c, now, 1.3);
  }
  const _p = new THREE.Vector3();
  function hubLabels() { // 물건 이름표 위치 (640x360 좌표)
    if (!W.ok || !HUB.scene) return [];
    return HUB.anchors.map(([action, text, v]) => { _p.copy(v).project(HUB.cam); return { action, text, x: (_p.x + 1) / 2 * RW, y: (1 - _p.y) / 2 * RH, show: _p.z < 1 }; });
  }
  function pickHub(x, y) {
    if (!W.ok || !HUB.scene) return null;
    ndc.set(x / RW * 2 - 1, -(y / RH * 2 - 1)); ray.setFromCamera(ndc, HUB.cam);
    const hit = ray.intersectObjects(HUB.pickables, true)[0]; if (!hit) return null;
    let o = hit.object; while (o && !o.userData.action) o = o.parent;
    return o ? o.userData.action : null;
  }

  // ---------- figures: 감독관 줄 세우기 ----------
  const FIG = { scene: null };
  function buildFigures() {
    if (FIG.scene) return;
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0xd8cdb4);
    sc.add(new THREE.AmbientLight(0xffffff, 1.3)); sc.add(new THREE.HemisphereLight(0xfff4dc, 0x5a4a3a, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0); sun.position.set(-3, 5, 6); sc.add(sun);
    const B = batch(); B.box(14, 0.02, 6, 0xbfae8c, 0, -0.01, 0); sc.add(B.mesh());
    const types = ['homeroom', 'dean', 'suneung', 'agent', 'robot'], ms = [];
    types.forEach((t, i) => { const m = makeStaff(t); m.root.position.set(-4.4 + i * 1.0, 0, 0); m.root.rotation.y = 0; sc.add(m.root); ms.push({ m, label: PROCTOR_NAME[t], pose: 'watch', x: -4.4 + i * 1.0 }); });
    [['stand', '서 있기', Math.PI / 2], ['back', '등 돌림', Math.PI], ['tell', '낌새', 0.6], ['watch', '주시', 0]].forEach(([pose, label, yaw], i) => {
      const m = makeStaff('dean'); m.root.position.set(1.4 + i * 0.95, 0, 0); m.root.rotation.y = yaw; if (pose === 'tell') m.head.rotation.y = -0.5; sc.add(m.root); ms.push({ m, label, pose, x: 1.4 + i * 0.95 });
    });
    const cam = new THREE.PerspectiveCamera(30, RW / RH, 0.1, 60); cam.position.set(0, 1.4, 10.6); cam.lookAt(0, 0.95, 0);
    Object.assign(FIG, { scene: sc, cam, ms });
  }
  function renderFigures(now) {
    if (!W.ok) return;
    buildFigures();
    for (const f of FIG.ms) if (f.m.robot) f.m.root.position.y = 0.06 + Math.sin(now * 4) * 0.03;
    draw(FIG.scene, FIG.cam, now, 0.3);
  }
  function figureLabels() {
    if (!W.ok || !FIG.scene) return [];
    return FIG.ms.map(f => { _p.set(f.x, -0.12, 0).project(FIG.cam); return { text: f.label, x: (_p.x + 1) / 2 * RW, y: (1 - _p.y) / 2 * RH, pose: f.pose }; });
  }

  return Object.assign(W, { init, renderExam, renderHub, renderTitle, renderFigures, pickChoice, pickHub, hubLabels, figureLabels });
})();
