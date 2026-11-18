// PROTOTYPE - NOT FOR PRODUCTION
// Question: 감독관 눈치를 보며 AI 안경으로 스캔하는 긴장감이, 장비와 시험이 함께 커지는 성장과 맞물려 엔딩까지 재밌나?
// Date: 2026-11-17
// 3D 세계: PSX풍 저해상도(640x360) 1인칭. 시험장(교실형·마주 앉는 방·고시원 노트북·허공), 감독관 여러 종, 수험생, 내 손과 시험지,
// CCTV·탐지 전파·드론·촛불·와인잔·Ω 같은 시험 장치, 허브인 고시원 방(노트북·일정표·폰으로 다가가는 카메라, 택배 상자),
// figures 줄 세우기. 그리기만 하고 규칙은 game.js가 정한다. 색은 줄이고 디더링하며, 정점은 화면 격자에 붙여 PSX처럼 떨리게 한다.
'use strict';

const WORLD = (() => {
  const RW = 640, RH = 360;
  const W = { ok: false, RW, RH };
  if (typeof THREE === 'undefined') return Object.assign(W, { init() { }, renderExam() { }, renderHub() { }, renderTitle() { }, renderFigures() { }, pickChoice: () => -1, pickHub: () => null, hubLabels: () => [], figureLabels: () => [], hubRect: () => null });

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
  const glowMat = color => new THREE.MeshBasicMaterial({ color, fog: false });
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

  // ---------- 감독관 ----------
  const SKIN = 0xdcae88;
  const STAFF_LOOK = {
    homeroom: { top: 0xd9705f, sleeve: 0xc8604f, leg: 0x2f3b62, skirt: true, shirt: 0xf6efe4, hair: 'bun', hairC: 0x3a2418, prop: 'book' },
    dean: { top: 0x33405f, sleeve: 0x2b3650, leg: 0x2a3350, shirt: 0xf3f3ee, tie: 0xb8362e, hair: 'bald', hairC: 0x33261f, glasses: 'metal', prop: 'clipboard' },
    suneung: { top: 0x7d8796, sleeve: 0xeeeeea, leg: 0x3b3f4a, shirt: 0xf1f1ec, hair: 'spiky', hairC: 0x1d1a22, prop: 'wand', badge: true },
    agent: { top: 0x1f2129, sleeve: 0x1b1d24, leg: 0x15161c, shirt: 0xf4f4f0, tie: 0x111216, hair: 'buzz', hairC: 0x2a2420, glasses: 'sun', prop: 'cross', ear: true },
    ta: { top: 0x5a6a8a, sleeve: 0x55657f, leg: 0x2a2f3a, shirt: 0x5a6a8a, hair: 'spiky', hairC: 0x221c1a, prop: 'clipboard', hood: true },
    prof: { top: 0x7a5a3a, sleeve: 0x6a4a2e, leg: 0x3a332c, shirt: 0xeee8da, tie: 0x2a4a3a, hair: 'bald', hairC: 0xb8b4ac, glasses: 'metal', prop: 'book' },
    teacher: { top: 0x3f7a5a, sleeve: 0x3a7052, leg: 0x3a4a62, shirt: 0xf0ece0, hair: 'bun', hairC: 0x7a4a2a, prop: 'mug', skin: 0xe8c4a0 },
    cnproctor: { top: 0xf2f2ee, sleeve: 0xe8e8e4, leg: 0x23262e, shirt: 0xf2f2ee, hair: 'buzz', hairC: 0x15131a, prop: 'wand', armband: 0xc0282a },
    don: { top: 0x15141a, sleeve: 0x1a1920, leg: 0x15141a, shirt: 0xf4f4f0, tie: 0xe8e8e4, robe: true, hair: 'bald', hairC: 0xd8d6d0, glasses: 'metal', skin: 0xe8c8b0 },
    don2: { top: 0x15141a, sleeve: 0x1a1920, leg: 0x15141a, shirt: 0xf4f4f0, robe: true, hair: 'bun', hairC: 0x8a6a4a, skin: 0xead0b8 },
    judge: { top: 0x1a1a1e, sleeve: 0x16161a, leg: 0x1a1a1e, shirt: 0xf4f4f0, tie: 0x7a1a2a, hair: 'buzz', hairC: 0x2a2420, prop: 'tastevin' },
    alien: { top: 0xa8b4c8, sleeve: 0x98a4b8, leg: 0x6a7488, shirt: 0xa8b4c8, hair: 'none', skin: 0x7ad06a, eyes3: true, antenna: true },
    reaper: { top: 0x101014, sleeve: 0x0c0c10, leg: 0x101014, shirt: 0x101014, robe: true, hair: 'none', skin: 0xd8d4cc, hat: 'gat' },
    yeomra: { top: 0x9a1a1a, sleeve: 0x8a1616, leg: 0x9a1a1a, shirt: 0xd8b04a, robe: true, hair: 'none', skin: 0xc89a7a, hat: 'crown', beard: 0x15131a, big: 1.25 },
  };
  function gazeCone() { // 시선 예측 장비가 그리는 시선: 머리에서 앞으로 퍼지는 반투명 원뿔
    const g = new THREE.ConeGeometry(0.25, 1, 14, 1, true); g.translate(0, -0.5, 0); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    m.visible = false; return m;
  }
  function makeHuman(o) {
    const root = new THREE.Group(), body = pivot(root, 0, 0, 0), legs = [], arms = [], skin = o.skin || SKIN;
    if (o.big) body.scale.setScalar(o.big);
    for (const s of [-1, 1]) {
      const p = pivot(body, s * 0.08, 0.84, 0);
      if (o.skirt) bx(p, 0.09, 0.6, 0.1, 0xc9a07e, 0, -0.52, 0); else if (!o.robe) bx(p, 0.12, 0.82, 0.14, o.leg, 0, -0.41, 0);
      bx(p, 0.13, 0.06, 0.22, 0x1b1b20, 0, -0.81, 0.04); legs.push(p);
    }
    if (o.skirt) bx(body, 0.36, 0.34, 0.26, o.leg, 0, 0.74, 0);
    if (o.robe) bx(body, 0.44, 0.84, 0.3, o.top, 0, 0.44, 0);
    bx(body, 0.4, 0.6, 0.22, o.top, 0, 1.12, 0);
    bx(body, 0.12, 0.34, 0.012, o.shirt, 0, 1.27, 0.112);
    if (o.tie) bx(body, 0.04, 0.26, 0.012, o.tie, 0, 1.25, 0.12);
    if (o.hood) bx(body, 0.3, 0.12, 0.1, o.top, 0, 1.42, -0.12);
    if (o.badge) { bx(body, 0.1, 0.12, 0.012, 0xffffff, 0.1, 1.12, 0.118); bx(body, 0.1, 0.03, 0.013, 0x3b6fd6, 0.1, 1.15, 0.12); }
    else if (!o.robe && !o.antenna) { bx(body, 0.08, 0.1, 0.012, 0xffffff, 0.11, 1.14, 0.118); bx(body, 0.08, 0.025, 0.013, 0x3b6fd6, 0.11, 1.16, 0.12); } // 감독관 명찰
    if (o.prop === 'tastevin') { bx(body, 0.07, 0.012, 0.07, 0xd8dce4, 0, 1.05, 0.125); bx(body, 0.01, 0.2, 0.01, 0xd8dce4, 0, 1.18, 0.12); }
    for (const s of [-1, 1]) {
      const p = pivot(body, s * 0.25, 1.38, 0);
      bx(p, 0.09, 0.56, 0.11, o.sleeve, 0, -0.28, 0); bx(p, 0.08, 0.1, 0.09, skin, 0, -0.6, 0);
      if (s < 0 && o.armband) bx(p, 0.1, 0.08, 0.12, o.armband, 0, -0.14, 0);
      if (s > 0 && o.prop === 'wand') { bx(p, 0.035, 0.32, 0.035, 0x1d1d22, 0, -0.68, 0.1); bx(p, 0.06, 0.08, 0.05, 0xe7c13a, 0, -0.84, 0.12); }
      if (s > 0 && o.prop === 'clipboard') { bx(p, 0.2, 0.26, 0.015, 0x8a5a32, 0, -0.62, 0.08); bx(p, 0.17, 0.2, 0.004, 0xf4f1e6, 0, -0.63, 0.09); }
      if (s > 0 && o.prop === 'mug') { bx(p, 0.07, 0.09, 0.07, 0xf4f4f0, 0, -0.66, 0.06); bx(p, 0.02, 0.05, 0.03, 0xf4f4f0, 0.045, -0.66, 0.06); }
      if (s < 0 && o.prop === 'book') { bx(p, 0.16, 0.22, 0.03, 0xf4efe2, 0, -0.62, 0.08); bx(p, 0.02, 0.22, 0.035, 0xc45f54, 0, -0.62, 0.08); }
      arms.push(p);
    }
    bx(body, 0.08, 0.06, 0.08, skin, 0, 1.45, 0);
    const head = pivot(body, 0, 1.6, 0);
    bx(head, 0.2, 0.24, 0.21, skin, 0, 0, 0);
    const H = o.hairC;
    if (o.hair === 'bald') { bx(head, 0.03, 0.08, 0.15, H, -0.105, 0.0, -0.02); bx(head, 0.03, 0.08, 0.15, H, 0.105, 0.0, -0.02); bx(head, 0.21, 0.08, 0.05, H, 0, -0.02, -0.09); }
    else if (o.hair === 'buzz') { bx(head, 0.21, 0.04, 0.22, H, 0, 0.12, 0); bx(head, 0.21, 0.14, 0.04, H, 0, 0.05, -0.095); }
    else if (o.hair !== 'none') {
      bx(head, 0.21, 0.07, 0.22, H, 0, 0.12, -0.005); bx(head, 0.21, 0.2, 0.05, H, 0, 0.02, -0.09);
      bx(head, 0.03, 0.12, 0.17, H, -0.105, 0.04, -0.02); bx(head, 0.03, 0.12, 0.17, H, 0.105, 0.04, -0.02);
      if (o.hair === 'bun') bx(head, 0.1, 0.1, 0.08, H, 0, 0.08, -0.15);
      if (o.hair === 'spiky') for (const sx of [-0.06, 0, 0.06]) bx(head, 0.05, 0.07, 0.07, H, sx, 0.17, 0.02);
    }
    const eyeC = o.eyeC || 0x15151a;
    for (const s of [-1, 1]) { bx(head, 0.035, 0.022, 0.01, eyeC, s * 0.048, 0.02, 0.108); if (o.hair !== 'none') bx(head, 0.05, 0.01, 0.01, H, s * 0.048, 0.055, 0.108); }
    if (o.eyes3) { bx(head, 0.04, 0.03, 0.01, 0x15151a, 0, 0.075, 0.108); bx(head, 0.02, 0.012, 0.012, 0xffffff, 0.006, 0.08, 0.11); }
    if (o.antenna) for (const s of [-1, 1]) { bx(head, 0.012, 0.14, 0.012, 0x4a7a3a, s * 0.06, 0.18, 0); bx(head, 0.035, 0.035, 0.035, 0xff5a8a, s * 0.06, 0.26, 0, glowMat(0xff6a9a)); }
    if (o.glasses === 'metal') { for (const s of [-1, 1]) { bx(head, 0.06, 0.008, 0.006, 0x8a8f99, s * 0.048, 0.04, 0.114); bx(head, 0.06, 0.006, 0.006, 0x8a8f99, s * 0.048, 0.0, 0.114); } bx(head, 0.03, 0.006, 0.006, 0x8a8f99, 0, 0.03, 0.114); }
    if (o.glasses === 'sun') { bx(head, 0.17, 0.045, 0.01, 0x15161c, 0, 0.02, 0.112); }
    if (o.ear) bx(head, 0.02, 0.03, 0.02, 0xe8e8e8, 0.108, -0.01, 0.0);
    if (o.hat === 'gat') { bx(head, 0.44, 0.012, 0.44, 0x0c0c10, 0, 0.13, 0); bx(head, 0.17, 0.15, 0.17, 0x0c0c10, 0, 0.21, 0); bx(head, 0.004, 0.2, 0.004, 0x3a3a40, 0.1, 0.02, 0.1); }
    if (o.hat === 'crown') { bx(head, 0.24, 0.12, 0.22, 0x15131a, 0, 0.17, 0); bx(head, 0.34, 0.02, 0.26, 0x15131a, 0, 0.24, 0); for (const sx of [-0.14, -0.07, 0, 0.07, 0.14]) bx(head, 0.012, 0.09, 0.012, 0xd8b04a, sx, 0.19, 0.13); }
    if (o.beard) bx(head, 0.16, 0.12, 0.06, o.beard, 0, -0.14, 0.08);
    else bx(head, 0.05, 0.012, 0.01, 0x9a5a4a, 0, -0.07, 0.108);
    const cone = gazeCone(); cone.position.set(0, 0.02, 0.11); head.add(cone);
    return { root, body, legs, arms, head, cone, look: o, yaw: Math.PI, headYaw: 0, headPitch: 0, last: 0 };
  }
  function makeRobot() {
    const root = new THREE.Group(), M = 0x9aa3b8, M2 = 0x6c7590;
    const glow = glowMat(0xff3048);
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
    const visorMat = glowMat(0x7a1f2c);
    bx(head, 0.26, 0.07, 0.02, 0, 0, 0.0, 0.145, visorMat);
    bx(head, 0.02, 0.16, 0.02, M2, 0.08, 0.2, 0); bx(head, 0.04, 0.04, 0.04, 0, 0.08, 0.29, 0, glow);
    const cone = gazeCone(); cone.position.set(0, 0, 0.15); head.add(cone);
    return { root, body, legs: [], arms, head, cone, robot: true, visorMat, yaw: Math.PI, headYaw: 0, headPitch: 0, last: 0 };
  }
  function makeOmega() { // 인류의 마지막 시험의 감독관: 떠 있는 거대한 눈
    const root = new THREE.Group(), head = pivot(root, 0, 0, 0);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), psx(new THREE.MeshLambertMaterial({ color: 0xe8e4ee, flatShading: true }))); head.add(ball);
    const irisMat = glowMat(0x3a6aff), pupilMat = glowMat(0x050508);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.46, 18), irisMat); iris.position.z = 0.97; head.add(iris);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14), pupilMat); pupil.position.z = 0.985; head.add(pupil);
    const rings = [];
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.45 + i * 0.28, 0.025, 4, 40), glowMat(i === 1 ? 0x45e5ee : 0x8a6cd6)); r.rotation.x = 1.2 + i * 0.5; root.add(r); rings.push(r); }
    const cone = gazeCone(); cone.position.set(0, 0, 1.0); head.add(cone);
    return { root, head, legs: [], arms: [], cone, omega: true, irisMat, rings, yaw: 0, headYaw: 0, headPitch: 0, last: 0 };
  }
  function makeStaff(type) { const m = type === 'robot' ? makeRobot() : type === 'omega' ? makeOmega() : type === 'webcam' ? null : makeHuman(STAFF_LOOK[type] || STAFF_LOOK.dean); if (m) m.type = type; return m; }
  function poseModel(m, o) { // o: {x, y, z, yaw, moving, walk, phase, now, headYaw, headPitch, coneLen, predict, away, hidden, seated}
    const dt = clamp(o.now - m.last, 0, 0.1); m.last = o.now;
    m.root.visible = !o.hidden;
    if (o.hidden) return;
    const rate = o.phase === 'tell' ? 3.0 : o.phase === 'watch' ? 9 : 6;
    m.yaw = angTo(m.yaw, o.yaw, Math.min(1, dt * rate));
    m.headYaw = angTo(m.headYaw, o.headYaw || 0, Math.min(1, dt * 8));
    m.headPitch = lerp(m.headPitch, o.headPitch || 0, Math.min(1, dt * 6));
    if (m.omega) {
      m.root.position.set(o.x, (o.y || 0) + Math.sin(o.now * 0.8) * 0.12, o.z);
      m.head.rotation.set(m.headPitch, m.yaw + m.headYaw, 0);
      m.rings.forEach((r, i) => { r.rotation.z = o.now * (0.3 + i * 0.2); });
      m.irisMat.color.setHex(o.asleep ? 0x0a0a12 : o.phase === 'watch' ? 0xff2e47 : o.phase === 'tell' ? 0xffa030 : 0x3a6aff);
      m.head.scale.y = lerp(m.head.scale.y, o.asleep ? 0.12 : 1, Math.min(1, dt * 3)); // 눈이 감긴다
    } else {
      const sw = o.moving ? Math.sin(o.walk * 7) : 0;
      const y = m.robot ? 0.06 + Math.sin(o.now * 4) * 0.03 : (o.seated ? -0.4 : o.moving ? Math.abs(sw) * 0.02 : 0);
      m.root.position.set(o.x, y + (o.y || 0), o.z);
      m.root.rotation.y = m.yaw; m.head.rotation.set(m.headPitch, m.headYaw, 0);
      if (m.legs.length) { const lk = o.seated ? -1.4 : 0; m.legs[0].rotation.x = lk + sw * 0.45; m.legs[1].rotation.x = lk - sw * 0.45; }
      const crossArms = m.look && m.look.prop === 'cross' && !o.moving;
      if (o.seated) { m.arms[0].rotation.set(-0.9, 0, 0.15); m.arms[1].rotation.set(o.phase === 'stand' ? -1.1 : -0.9, 0, -0.15); }
      else if (crossArms) { m.arms[0].rotation.set(-1.05, 0, 0.55); m.arms[1].rotation.set(-1.05, 0, -0.55); }
      else if (o.raise) { m.arms[0].rotation.set(-sw * 0.35, 0, 0); m.arms[1].rotation.set(-0.5, 0, 0); }
      else { m.arms[0].rotation.set(-sw * 0.35, 0, 0); m.arms[1].rotation.set(o.phase === 'watch' && !m.robot ? -0.35 : sw * 0.35, 0, 0); }
      if (m.visorMat) m.visorMat.color.setHex(o.phase === 'watch' ? 0xff2e47 : o.phase === 'tell' ? 0xc03040 : 0x7a1f2c);
    }
    const c = m.cone;
    c.visible = !!o.predict && !(o.phase === 'stand' && o.away);
    if (c.visible) {
      const col = o.phase === 'watch' ? 0xff3040 : o.phase === 'tell' ? 0xffa030 : 0xffffff;
      c.material.color.setHex(col); c.material.opacity = o.phase === 'watch' ? 0.2 : o.phase === 'tell' ? 0.16 : 0.05;
      const L = o.coneLen || 3.5; c.scale.set(L * 0.9, L * 0.9, L);
    }
  }

  // ---------- 시험장 ----------
  const SKY = {
    day: { amb: [0xfff2e0, 1.0], hemi: [0xfff0d4, 0x4a3a2e, 1.2], sun: [0xffe2b8, 2.5], fog: 0xb8ad96, glass: ['#9fd2f2', '#e8f4fb', '#7fae7a'] },
    dawn: { amb: [0xffe6dc, 0.95], hemi: [0xffe0d0, 0x4a3a3e, 1.1], sun: [0xffc8a0, 2.3], fog: 0xb8a39a, glass: ['#f2b49a', '#ffe1c4', '#8f7f86'] },
    dusk: { amb: [0xffd8b8, 0.85], hemi: [0xffcfa0, 0x3a2a2e, 1.0], sun: [0xff9a5a, 2.3], fog: 0x9a7f6a, glass: ['#e98a5a', '#f6c18a', '#5a4a5a'] },
    night: { amb: [0xc8d4ff, 0.75], hemi: [0xd0dcff, 0x1a1a2a, 0.9], sun: [0xdfe8ff, 1.5], fog: 0x1c2030, glass: ['#0d1430', '#1c2650', '#0a0d1c'] },
    space: { amb: [0xc8d0ff, 0.8], hemi: [0xb8c8ff, 0x1a1a30, 1.0], sun: [0xe8f0ff, 1.8], fog: 0x0a0c1a, glass: ['#02030a', '#0a0c22', '#2a1a4a'] },
    hell: { amb: [0xff9a8a, 0.55], hemi: [0xff7a6a, 0x1a0608, 0.8], sun: [0xff5a3a, 1.2], fog: 0x1a0a0e, glass: ['#3a0a0a', '#8a1a0a', '#1a0505'] },
    glitch: { amb: [0xd8c8ff, 0.8], hemi: [0xff8aff, 0x1a1a40, 1.0], sun: [0x8affff, 1.8], fog: 0x221a3a, glass: ['#ff3aa0', '#3affd0', '#2a1a5a'] },
    white: { amb: [0xffffff, 1.2], hemi: [0xffffff, 0x8a92a0, 1.2], sun: [0xffffff, 2.0], fog: 0xdfe4ea, glass: ['#e8f0f8', '#ffffff', '#c8d0d8'] },
    void: { amb: [0xb8c0ff, 0.7], hemi: [0xc8d0ff, 0x05050a, 0.9], sun: [0xffffff, 1.4], fog: 0x020208, glass: ['#000000', '#05050a', '#000000'] },
  };
  const ROOMS = {
    hs: { wall: 0xe6e0cc, wain: 0x9a8a6a, floor: 'wood', board: 'green', sky: 'day', tv: true },
    suneung: { wall: 0xe8e2d2, wain: 0xa58e6c, floor: 'wood', board: 'green', sky: 'dawn', tv: true },
    lecture: { wall: 0xe8dcc4, wain: 0xb59a74, floor: 'wood', board: 'white', sky: 'day' },
    toeic: { wall: 0xdfe6dc, wain: 0x8f9d8a, floor: 'wood', board: 'green', sky: 'day', speaker: true },
    history: { wall: 0xece0c0, wain: 0xa98b62, floor: 'wood', board: 'green', sky: 'day' },
    civil: { wall: 0xd3d9e0, wain: 0x7d8794, floor: 'tile', board: 'green', sky: 'day' },
    tax: { wall: 0xeef0f2, wain: 0x9aa1ab, floor: 'tile', board: 'white', sky: 'day', hall: true },
    cpa: { wall: 0xe4e8ee, wain: 0x8a93a3, floor: 'tile', board: 'white', sky: 'dusk', hall: true },
    leet: { wall: 0xc9b08e, wain: 0x6e5238, floor: 'darkwood', board: 'green', sky: 'dusk' },
    bar: { wall: 0x2c3550, wain: 0x1c2236, floor: 'darktile', board: 'screen', sky: 'night', hall: true, redLight: true },
    usclass: { wall: 0xd8e2ea, wain: 0x5a7a9a, floor: 'tile', board: 'white', sky: 'day', lockers: [0x3b6fb6, 0x3466a8] },
    gaokao: { wall: 0xf0ece0, wain: 0x9a3a2a, floor: 'tile', board: 'red', sky: 'day', banner: '诚信考试' },
    testcenter: { wall: 0xdadfe4, wain: 0x6a7480, floor: 'tile', board: 'white', sky: 'day', partitions: true },
    cfa: { wall: 0xe8e8ec, wain: 0x7a808c, floor: 'tile', board: 'white', sky: 'dusk', hall: true },
    convention: { wall: 0xc8ccd4, wain: 0x4a505a, floor: 'darktile', board: 'screen', sky: 'day', hall: true, huge: true },
    space: { wall: 0x9aa4b8, wain: 0x4a5468, floor: 'metal', board: 'screen', sky: 'space', floaty: true, ceil: 0x6a7488 },
    underworld: { wall: 0x3a1e22, wain: 0x1a0c10, floor: 'darkwood', board: 'red', sky: 'hell', candles: true, ceil: 0x1a0c10 },
    multiverse: { wall: 0x3a2c58, wain: 0x221a3a, floor: 'darktile', board: 'screen', sky: 'glitch', hall: true, ceil: 0x221a3a },
    server: { wall: 0xf2f4f6, wain: 0xc8ccd2, floor: 'tile', board: 'screen', sky: 'white', racks: true },
    void: { void: true, sky: 'void', floor: 'none', board: 'none' },
    oxford: { layout: 'table', wall: 0x6a4a32, wain: 0x4a3222, floor: 'darkwood', sky: 'dusk', shelves: true },
    tasting: { layout: 'table', wall: 0x2a2228, wain: 0x1a1418, floor: 'darkwood', sky: 'night', cloth: true, glasses: true },
    home: { layout: 'home' },
  };
  function floorTex(kind) {
    const T = canvasTex(64, 64, false), g = T.g;
    if (kind === 'wood' || kind === 'darkwood') {
      const a = kind === 'wood' ? ['#9c6c47', '#93633f', '#a3724c', '#7c5233'] : ['#6e4b33', '#654430', '#77523a', '#4f3524'];
      g.fillStyle = a[0]; g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? a[1] : a[2]; g.fillRect(0, i * 16, 64, 15); g.fillStyle = a[3]; g.fillRect(0, i * 16 + 15, 64, 1); g.fillRect((i * 23) % 64, i * 16, 1, 15); }
    } else if (kind === 'metal') {
      g.fillStyle = '#5a6272'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#6a7384'; g.fillRect(2, 2, 60, 60); g.fillStyle = '#4a5262';
      g.fillRect(0, 31, 64, 2); g.fillRect(31, 0, 2, 64); g.fillStyle = '#8a94a6'; for (const [x, y] of [[6, 6], [56, 6], [6, 56], [56, 56], [26, 26], [36, 36]]) g.fillRect(x, y, 2, 2);
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
    if (sky === 'space' || sky === 'void') { g.fillStyle = '#ffffff'; for (let i = 0; i < 14; i++) g.fillRect((i * 11) % 31, (i * 7) % 31, 1, 1); g.fillStyle = '#c87a4a'; g.fillRect(18, 18, 7, 7); g.fillStyle = '#e8a06a'; g.fillRect(19, 19, 4, 3); }
    else if (sky === 'hell') { g.fillStyle = '#ff6a2a'; for (let i = 0; i < 10; i++) g.fillRect((i * 7) % 30, 20 + (i * 3) % 10, 2, 12); }
    else if (sky === 'glitch') { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ff3aa0' : '#3affd0'; g.fillRect(0, i * 4, 32, 1); } g.fillStyle = c[2]; g.fillRect(4, 20, 24, 12); }
    else { g.fillStyle = c[2]; for (let i = 0; i < 8; i++) g.fillRect(i * 4, 22 + (i * 5) % 6, 3, 10); }
    if (sky === 'night') { g.fillStyle = '#f5cc4a'; for (let i = 0; i < 9; i++) g.fillRect((i * 7) % 30, 24 + (i * 3) % 7, 1, 1); g.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) g.fillRect((i * 11) % 31, (i * 5) % 14, 1, 1); }
    T.t.needsUpdate = true; return T.t;
  }
  function boardTex(kind, lines) {
    const T = canvasTex(512, 128, false), g = T.g, white = kind === 'white', screen = kind === 'screen', red = kind === 'red';
    g.fillStyle = white ? '#f2f2ee' : screen ? '#06080f' : red ? '#8a1a1a' : '#2f5a48'; g.fillRect(0, 0, 512, 128);
    const n = lines.length, fg = white ? '#24324a' : screen ? '#7ff6ff' : red ? '#ffd86a' : '#e9f1e8', fg2 = white ? '#c0392b' : screen ? '#ff5a6e' : red ? '#ffffff' : '#f2c4cf';
    g.textAlign = 'center';
    lines.forEach((ln, i) => { g.fillStyle = i === 0 ? fg : i === n - 1 && n > 1 ? fg2 : fg; g.font = `${i === 0 ? 800 : 700} ${i === 0 ? 28 : 21}px ${FONT}`; g.fillText(ln, 256, n === 2 ? 52 + i * 38 : n === 1 ? 72 : 36 + i * 36); });
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
  function bannerTex(text) {
    const T = canvasTex(256, 48, false), g = T.g;
    g.fillStyle = '#b81a1a'; g.fillRect(0, 0, 256, 48); g.fillStyle = '#ffe08a'; g.textAlign = 'center'; g.font = `800 30px ${FONT}`; g.fillText(text, 128, 36);
    T.t.needsUpdate = true; return T.t;
  }

  const EX = { scene: null, tier: -1, home: false };
  const VIEWS_ROOM = { front: { yaw: 0, pitch: -0.1, fov: 62 }, paper: { yaw: 0, pitch: -0.83, fov: 40 }, left: { yaw: 0.8, pitch: -0.1, fov: 58 }, right: { yaw: -0.8, pitch: -0.1, fov: 58 } };
  const VIEWS_VOID = { front: { yaw: 0.1, pitch: 0.18, fov: 60 }, paper: { yaw: 0, pitch: -0.83, fov: 40 }, left: { yaw: 0.1, pitch: 0.18, fov: 60 }, right: { yaw: 0.1, pitch: 0.18, fov: 60 } };
  const VIEWS_TABLE = { paper: { yaw: 0, pitch: -0.08, fov: 62 }, left: { yaw: 0, pitch: -0.08, fov: 62 }, right: { yaw: 0, pitch: -0.08, fov: 62 } };

  function lights(sc, S, sky) {
    sc.add(new THREE.AmbientLight(S.amb[0], S.amb[1])); sc.add(new THREE.HemisphereLight(S.hemi[0], S.hemi[1], S.hemi[2]));
    const sun = new THREE.DirectionalLight(S.sun[0], S.sun[1]); sun.position.set(sky === 'night' || sky === 'void' ? 0 : -6, 8, -1.5); sc.add(sun);
  }
  // 내 책상 위: 시험지(또는 태블릿), 수험표, 손, 사인펜, 스마트워치
  function myDesk(sc, MY, ti, device) {
    const tablet = device === 'tablet';
    const paperTex = canvasTex(PAPER_W, PAPER_H, true);
    const pw = tablet ? 0.27 : 0.31, ph = tablet ? 0.38 : 0.43;
    if (tablet) { const b = pivot(sc, MY.x, 0.744, MY.z - 0.02); bx(b, pw + 0.03, 0.012, ph + 0.03, 0x1a1c22, 0, 0, 0); }
    const paper = plane(sc, pw, ph, new THREE.MeshLambertMaterial({ map: paperTex.t }), MY.x, tablet ? 0.752 : 0.744, MY.z - 0.02, -Math.PI / 2);
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
    bx(watch, 0.06, 0.012, 0.05, 0x20303a, 0, 0, 0); bx(watch, 0.044, 0.004, 0.036, 0, 0, 0.007, 0, glowMat(0x45e5ee));
    const pen = pivot(sc, MY.x + 0.15, 0.772, MY.z + 0.13); pen.rotation.set(0.3, 0.75, 0);
    bx(pen, 0.009, 0.009, 0.1, 0x24242c, 0, 0, 0); bx(pen, 0.01, 0.01, 0.018, 0xdedee6, 0, 0, -0.058);
    return { paper, paperTex, watch, pen };
  }
  function secDevices(sc, tier, X1, HY, Z0, X0, MY) { // CCTV·탐지 전파 장치·드론
    let cctv = null, pulse = null, drone = null;
    if (tier.sec.includes('cctv')) {
      const g = pivot(sc, X1 - 0.25, HY - 0.32, Z0 + 1.9); bx(g, 0.06, 0.2, 0.06, 0x9b9eac, 0, 0.12, 0); bx(g, 0.2, 0.05, 0.2, 0x9b9eac, 0.1, 0.22, 0);
      const body = pivot(g, 0, 0, 0); bx(body, 0.16, 0.14, 0.32, 0xd4d6de, 0, 0, 0); bx(body, 0.1, 0.1, 0.02, 0x1b2030, 0, 0, 0.17);
      const led = glowMat(0x6b2a2a); bx(body, 0.03, 0.03, 0.02, 0, 0.05, 0.05, 0.165, led);
      const cone = gazeCone(); cone.position.set(0, 0, 0.18); body.add(cone);
      cctv = { body, led, cone, base: Math.atan2(MY.x - (X1 - 0.25), MY.z + 0.42 - (Z0 + 1.9)) };
    }
    if (tier.sec.includes('pulse')) {
      const g = pivot(sc, X1 - 1.4, 2.0, Z0 + 0.16); bx(g, 0.36, 0.26, 0.14, tier.pulse === 'screen' ? 0x2a3a5a : 0x3a3f4a, 0, 0, 0);
      const led = glowMat(0x5a2a2a); bx(g, 0.06, 0.06, 0.02, 0, -0.1, 0.04, 0.08, led);
      bx(g, 0.02, 0.3, 0.02, 0x2a2a30, 0.1, 0.28, 0); bx(g, 0.05, 0.05, 0.05, 0, 0.1, 0.44, 0, glowMat(0xff3048));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 48), new THREE.MeshBasicMaterial({ color: tier.pulse === 'screen' ? 0x45e5ee : 0xff3048, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(X1 - 1.4, 1.6, Z0 + 0.4); ring.visible = false; sc.add(ring);
      pulse = { led, ring };
      if (tier.pulse === 'drone') { // 창밖을 지나가는 드론
        drone = pivot(sc, X0 - 0.9, 2.2, 0); bx(drone, 0.34, 0.08, 0.34, 0x2a2c34, 0, 0, 0); bx(drone, 0.1, 0.06, 0.1, 0x111216, 0, -0.06, 0.1);
        for (const [dx, dz] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) { bx(drone, 0.03, 0.06, 0.03, 0x2a2c34, dx, 0.04, dz); bx(drone, 0.2, 0.008, 0.03, 0x8a8f99, dx, 0.08, dz); }
        bx(drone, 0.04, 0.04, 0.04, 0, 0, 0.02, 0.18, glowMat(0xff3048)); drone.visible = false;
      }
    }
    return { cctv, pulse, drone };
  }
  function buildClassroom(ti, tier, R) {
    const S = SKY[R.sky], big = !!R.hall, huge = !!R.huge, rnd = seeded(ti + 3), vd = !!R.void;
    const X1 = huge ? 8.6 : big ? 6.4 : 4.6, X0 = -X1, Z0 = huge ? -9.6 : big ? -7.6 : -6, Z1 = huge ? 7.6 : big ? 6.2 : 4.6, HY = huge ? 4.4 : big ? 3.6 : 3;
    const COLS = huge ? [-7.2, -5.4, -3.6, -1.2, 0.6, 2.4, 4.2, 6.0, 7.8] : big ? [-4.8, -3.0, -1.2, 0.6, 2.4, 4.2] : [-3.0, -1.2, 0.6, 2.4];
    const ROWS = huge ? [-8.4, -7.0, -5.6, -4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2, 5.6] : big ? [-5.6, -4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2] : [-4.2, -2.8, -1.4, 0, 1.4, 2.8];
    const MY = { x: 0.6, z: 0 }, sc = new THREE.Scene(), B = batch();
    let clockKeep = null;
    const fogC = R.fogC || S.fog;
    sc.background = new THREE.Color(fogC); sc.fog = new THREE.Fog(fogC, vd ? 6 : big ? 9 : 7, vd ? 40 : huge ? 30 : big ? 24 : 18);
    lights(sc, S, R.sky);
    if (R.redLight || R.board === 'screen' && R.sky === 'night') { const red = new THREE.PointLight(0xff2040, 6, 9, 1.5); red.position.set(0, 2.6, Z0 + 1.2); sc.add(red); }
    let candle = null, glowLamps = [];
    if (vd) { // 인류의 마지막 시험: 벽도 바닥도 없는 허공에 내 책상 하나
      const pts = [], r = seeded(77);
      for (let i = 0; i < 700; i++) { const a = r() * Math.PI * 2, b = (r() - 0.5) * Math.PI, d = 22 + r() * 10; pts.push(Math.cos(a) * Math.cos(b) * d, Math.sin(b) * d, Math.sin(a) * Math.cos(b) * d); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      sc.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));
      B.box(2.2, 0.06, 2.2, 0x1c1e2a, MY.x, -0.02, MY.z + 0.2);
    } else {
      const ft = floorTex(R.floor); ft.repeat.set((X1 - X0) / 1.3, (Z1 - Z0) / 1.3);
      plane(sc, X1 - X0, Z1 - Z0, psx(new THREE.MeshLambertMaterial({ map: ft })), 0, 0, (Z0 + Z1) / 2, -Math.PI / 2);
      B.box(X1 - X0, 0.05, Z1 - Z0, R.ceil || (R.sky === 'night' ? 0x2a2f40 : 0xe8e4d8), 0, HY, (Z0 + Z1) / 2);
      B.box(X1 - X0, HY, 0.1, R.wall, 0, HY / 2, Z0 - 0.05); B.box(X1 - X0, HY, 0.1, R.wall, 0, HY / 2, Z1 + 0.05);
      B.box(0.1, HY, Z1 - Z0, R.wall, X0 - 0.05, HY / 2, (Z0 + Z1) / 2); B.box(0.1, HY, Z1 - Z0, R.wall, X1 + 0.05, HY / 2, (Z0 + Z1) / 2);
      for (const [w, d, x, z] of [[X1 - X0, 0.04, 0, Z0 + 0.02], [X1 - X0, 0.04, 0, Z1 - 0.02], [0.04, Z1 - Z0, X0 + 0.02, (Z0 + Z1) / 2], [0.04, Z1 - Z0, X1 - 0.02, (Z0 + Z1) / 2]]) {
        B.box(w, 0.95, d, R.wain, x, 0.475, z); B.box(w + 0.01, 0.05, d + 0.01, 0x5a4330, x, 0.97, z);
      }
      if (!R.candles) for (let i = 0; i * 3 < Z1 - Z0 - 1; i++) for (let x = X0 + 2.2; x < X1 - 1; x += 2.4) B.box(0.5, 0.04, 1.2, R.sky === 'glitch' ? 0xd8a8ff : 0xfafaf4, x, HY - 0.03, Z0 + 2 + i * 3);
      // 창문 (왼쪽 벽)
      const skyMat = new THREE.MeshBasicMaterial({ map: skyTex(R.sky), fog: false });
      const shine = new THREE.MeshBasicMaterial({ color: R.sky === 'dusk' ? 0xff9a50 : 0xffeab0, transparent: true, opacity: ['night', 'space', 'hell', 'glitch', 'void'].includes(R.sky) ? 0 : 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      for (let z = Z0 + 1.8; z < Z1 - 1; z += 2.6) {
        plane(sc, 2.0, 1.5, skyMat, X0 + 0.02, 1.85, z, 0, Math.PI / 2);
        const fr = R.sky === 'space' ? 0x8a94a8 : R.candles ? 0x2a1010 : 0xf2efe6;
        for (const dz of [-1.04, 0, 1.04]) B.box(0.08, 1.62, 0.08, fr, X0 + 0.05, 1.85, z + dz);
        B.box(0.08, 0.08, 2.16, fr, X0 + 0.05, 2.64, z); B.box(0.16, 0.06, 2.16, fr, X0 + 0.08, 1.07, z);
        if (shine.opacity > 0) plane(sc, 1.9, 1.3, shine, X0 + 2.0, 0.012, z + 0.4, -Math.PI / 2);
      }
      // 앞: 칠판·시계, 오른쪽: 문·안내문, 뒤: 사물함
      if (R.board !== 'none') {
        B.box(5.6, 1.5, 0.08, R.board === 'screen' ? 0x0c0e16 : 0x6b4a30, 0, 1.6, Z0 + 0.06);
        plane(sc, 5.4, 1.32, psx(new THREE.MeshLambertMaterial({ map: boardTex(R.board, tier.lines.length ? tier.lines : [tier.name]), emissive: R.board === 'screen' ? 0x223344 : 0x000000 })), 0, 1.6, Z0 + 0.105);
        B.box(5.6, 0.05, 0.14, 0x6b4a30, 0, 0.84, Z0 + 0.12);
      }
      if (R.tv) B.box(1.1, 0.7, 0.1, 0x1c1d22, 3.6, 2.35, Z0 + 0.1);
      if (R.speaker) { B.box(0.4, 0.5, 0.2, 0x2a2a30, X1 - 0.3, HY - 0.5, Z0 + 2.6); B.box(0.3, 0.3, 0.02, 0x15151a, X1 - 0.41, HY - 0.5, Z0 + 2.6); }
      if (R.banner) plane(sc, 3.2, 0.6, new THREE.MeshBasicMaterial({ map: bannerTex(R.banner) }), 0, HY - 0.45, Z0 + 0.11);
      const clockT = canvasTex(64, 64, false);
      plane(sc, 0.42, 0.42, new THREE.MeshBasicMaterial({ map: clockT.t, transparent: true }), 0, HY - 0.38, Z0 + 0.11);
      clockKeep = clockT;
      B.box(0.08, 2.1, 1.0, 0x8a6a4a, X1 - 0.04, 1.05, Z0 + 1.4); B.box(0.1, 0.5, 0.36, 0xcfe8f5, X1 - 0.06, 1.55, Z0 + 1.25);
      plane(sc, 0.64, 0.48, psx(new THREE.MeshLambertMaterial({ map: noteTex(tier.lines[tier.lines.length - 1] || tier.name) })), X1 - 0.02, 1.6, Z0 + 3.6, 0, -Math.PI / 2);
      B.box(0.3, 0.3, 0.2, 0x3a3a40, X1 - 0.12, HY - 0.4, Z0 + 4.6);
      const LK = R.lockers || [0x9aa0a8, 0x8d939c];
      if (R.racks) for (let x = X0 + 1.3; x < X1 - 0.6; x += 1.32) { B.box(1.0, 2.0, 0.6, 0x2a2e36, x, 1.0, Z1 - 0.35); for (let k = 0; k < 6; k++) B.box(0.8, 0.04, 0.02, k % 2 ? 0x45e5ee : 0x62d84a, x, 0.4 + k * 0.28, Z1 - 0.65); }
      else for (let x = X0 + 1.3; x < X1 - 0.6; x += 1.32) B.box(1.1, 1.2, 0.5, (Math.round(x * 10) % 2) ? LK[0] : LK[1], x, 0.6, Z1 - 0.28);
      if (R.candles) { // 저승: 벽 등롱
        for (let z = Z0 + 1.5; z < Z1 - 1; z += 3) for (const x of [X0 + 0.2, X1 - 0.2]) { B.box(0.18, 0.3, 0.18, 0x8a1a1a, x, 2.2, z); const l = new THREE.PointLight(0xff5a2a, 2.2, 5, 1.6); l.position.set(x + (x < 0 ? 0.3 : -0.3), 2.1, z); sc.add(l); glowLamps.push(l); }
      }
    }
    // 책상·의자·수험생
    const TOP = R.floor === 'darktile' || R.floor === 'metal' ? 0x6a5a4a : R.candles ? 0x4a2a1a : 0xc89a64, METAL = 0x8c9099, SEAT = 0xb98a58;
    const CLOTH = R.sky === 'space' ? [0x6a8a5a, 0x5a6a9a, 0x8a5a9a, 0x4a8a8a] : R.candles ? [0xe8e4dc, 0xd8d4cc, 0xc8c4bc] : [0x3f4f78, 0x5a5f6b, 0x7a3b3b, 0x2f5d50, 0x4b4b4b, 0x6b5a46, 0x8a8f99, 0x3b3550, 0xb0a48c, 0x24324a];
    const SKINS = R.sky === 'space' ? [0x7ad06a, 0x6ac0d0, 0xb08ad0] : R.candles ? [0xd8d4cc] : [0xe2b48e];
    const HAIRS = [0x1f1a1c, 0x2b211c, 0x3a2a20, 0x161214, 0x4a3226];
    const desks = [];
    ROWS.forEach(z => COLS.forEach(x => {
      const mine = x === MY.x && z === MY.z;
      if (vd && !mine) return;
      const dz = z - 0.02, fy = R.floaty && !mine ? Math.sin(x * 3 + z * 2) * 0.06 : 0;
      B.box(0.62, 0.04, 0.44, TOP, x, 0.72 + fy, dz); B.box(0.56, 0.08, 0.36, METAL, x, 0.64 + fy, dz);
      B.box(0.03, 0.62, 0.4, METAL, x - 0.28, 0.31 + fy, dz); B.box(0.03, 0.62, 0.4, METAL, x + 0.28, 0.31 + fy, dz);
      B.box(0.4, 0.03, 0.38, SEAT, x, 0.44, z + 0.42); B.box(0.4, 0.26, 0.03, SEAT, x, 0.72, z + 0.62);
      B.box(0.03, 0.44, 0.36, METAL, x - 0.18, 0.22, z + 0.42); B.box(0.03, 0.44, 0.36, METAL, x + 0.18, 0.22, z + 0.42);
      if (R.partitions) { B.box(0.02, 0.5, 0.5, 0xb8c0c8, x - 0.33, 0.98, dz); B.box(0.62, 0.5, 0.02, 0xb8c0c8, x, 0.98, dz - 0.24); if (!mine) { B.box(0.3, 0.2, 0.02, 0x1a1c22, x, 0.9, dz - 0.15); } }
      if (mine) return;
      desks.push({ x, z });
      B.box(0.24, 0.004, 0.32, R.candles ? 0xe8d8b0 : 0xf4f1e6, x - 0.04, 0.743 + fy, dz + 0.02, 0, 0.1);
      const cl = CLOTH[Math.floor(rnd() * CLOTH.length)], hr = HAIRS[Math.floor(rnd() * HAIRS.length)], lean = 0.18 + rnd() * 0.12, sk = SKINS[Math.floor(rnd() * SKINS.length)];
      B.box(0.34, 0.14, 0.36, 0x2b2f3d, x, 0.52, z + 0.3);
      B.box(0.12, 0.42, 0.12, 0x2b2f3d, x - 0.08, 0.22, z + 0.12); B.box(0.12, 0.42, 0.12, 0x2b2f3d, x + 0.08, 0.22, z + 0.12);
      B.box(0.36, 0.46, 0.2, cl, x, 0.8, z + 0.44, -lean);
      B.box(0.09, 0.1, 0.34, cl, x - 0.17, 0.79, z + 0.16); B.box(0.09, 0.1, 0.34, cl, x + 0.17, 0.79, z + 0.16);
      B.box(0.19, 0.22, 0.2, sk, x, 1.08, z + 0.33, -lean * 0.6);
      if (R.candles) { B.box(0.21, 0.24, 0.22, 0xf0ece4, x, 1.1, z + 0.36, -lean * 0.6); } // 소복 입은 망자
      else if (R.sky !== 'space') { B.box(0.2, 0.09, 0.21, hr, x, 1.19, z + 0.34, -lean * 0.6); B.box(0.2, 0.17, 0.06, hr, x, 1.11, z + 0.44, -lean * 0.6); if (rnd() < 0.3) B.box(0.1, 0.1, 0.08, hr, x, 1.12, z + 0.5); }
      else { B.box(0.02, 0.12, 0.02, 0x4a7a3a, x, 1.25, z + 0.33); }
    }));
    sc.add(B.mesh());
    const D = myDesk(sc, MY, ti, tier.device);
    if (R.candles) { // 내 책상 촛불: 저승사자가 가까이 오면 흔들린다
      const g = pivot(sc, MY.x + 0.27, 0.744, MY.z - 0.2); bx(g, 0.035, 0.09, 0.035, 0xf4efe0, 0, 0.045, 0);
      const flame = new THREE.Mesh(UNIT, glowMat(0xffb04a)); flame.scale.set(0.02, 0.04, 0.02); flame.position.set(0, 0.11, 0); g.add(flame);
      const light = new THREE.PointLight(0xffa040, 0.8, 1.6, 2); light.position.set(0, 0.14, 0); g.add(light);
      candle = { flame, light };
    }
    const dev = secDevices(sc, tier, X1, HY, Z0, X0, MY);
    const staff = tier.staff.map(d => { const m = makeStaff(d.type); if (m) sc.add(m.root); return m; });
    // 손 드는 수험생 (다른 수험생 이벤트)
    const raise = pivot(sc, 0, 0, 0); bx(raise, 0.08, 0.36, 0.08, 0x3f4f78, 0, 0.18, 0); bx(raise, 0.07, 0.09, 0.07, 0xe2b48e, 0, 0.4, 0); raise.visible = false;
    // 염라대왕 책상
    if (tier.staff.some(s => s.type === 'yeomra')) { const b2 = batch(); b2.box(1.6, 0.82, 0.5, 0x4a0e0e, -1.8, 0.41, ROWS[0] - 1.15); b2.box(0.5, 0.06, 0.3, 0xe8d8b0, -1.8, 0.85, ROWS[0] - 1.15); sc.add(b2.mesh()); }
    const cam = new THREE.PerspectiveCamera(40, RW / RH, 0.03, 80); cam.rotation.order = 'YXZ';
    const eye = new THREE.Vector3(MY.x, 1.2, MY.z + 0.42); cam.position.copy(eye);
    Object.assign(EX, { scene: sc, tier: ti, paper: D.paper, paperTex: D.paperTex, paperSig: '', staff, ...dev, cam, eye, watch: D.watch, pen: D.pen, clock: clockKeep, clockSec: -1,
      AL: MY.x - 0.9, AR: MY.x + 0.9, zFront: ROWS[0] - 0.75, zBack: ROWS[ROWS.length - 1] + 0.75, my: MY, desks, raise, candle, lamps: glowLamps, views: vd ? VIEWS_VOID : VIEWS_ROOM,
      layout: 'room', floaty: !!R.floaty, glasses: null, X0, frontZ: ROWS[0] });
  }
  function buildTable(ti, tier, R) { // 마주 앉는 방: 면접관·심사위원이 테이블 건너편에
    const S = SKY[R.sky], sc = new THREE.Scene(), B = batch();
    sc.background = new THREE.Color(S.fog); sc.fog = new THREE.Fog(S.fog, 4, 12);
    lights(sc, S, R.sky);
    const warm = new THREE.PointLight(0xffd8a0, 2.4, 6, 1.5); warm.position.set(0, 2.4, -0.4); sc.add(warm);
    const X1 = 2.6, X0 = -2.6, Z0 = -2.4, Z1 = 2.2, HY = 2.8;
    const ft = floorTex(R.floor); ft.repeat.set(4, 4);
    plane(sc, X1 - X0, Z1 - Z0, psx(new THREE.MeshLambertMaterial({ map: ft })), 0, 0, (Z0 + Z1) / 2, -Math.PI / 2);
    B.box(X1 - X0, HY, 0.1, R.wall, 0, HY / 2, Z0); B.box(0.1, HY, Z1 - Z0, R.wall, X0, HY / 2, (Z0 + Z1) / 2); B.box(0.1, HY, Z1 - Z0, R.wall, X1, HY / 2, (Z0 + Z1) / 2);
    B.box(X1 - X0, 0.05, Z1 - Z0, 0x2a2018, 0, HY, (Z0 + Z1) / 2);
    B.box(X1 - X0, 0.9, 0.06, R.wain, 0, 0.45, Z0 + 0.05);
    if (R.shelves) for (const x of [-1.9, 1.9]) { B.box(1.1, 2.2, 0.36, 0x4a3020, x, 1.1, Z0 + 0.25); for (let k = 0; k < 5; k++) for (let j = 0; j < 9; j++) B.box(0.09, 0.3, 0.24, [0x7a2a2a, 0x2a4a6a, 0x6a5a2a, 0x2a5a3a][(j + k) % 4], x - 0.45 + j * 0.11, 0.3 + k * 0.42, Z0 + 0.32); }
    else for (const x of [-1.9, 1.9]) { B.box(1.0, 1.6, 0.4, 0x2a1418, x, 0.8, Z0 + 0.3); for (let k = 0; k < 4; k++) for (let j = 0; j < 6; j++) B.box(0.08, 0.3, 0.08, j % 2 ? 0x5a1a2a : 0x2a3a1a, x - 0.35 + j * 0.14, 0.25 + k * 0.38, Z0 + 0.35); }
    const win = new THREE.MeshBasicMaterial({ map: skyTex(R.sky), fog: false }); plane(sc, 1.0, 1.1, win, 0, 1.8, Z0 + 0.06);
    // 테이블
    B.box(2.6, 0.06, 0.95, R.cloth ? 0xf2f0ea : 0x5a3a24, 0, 0.74, -0.25); B.box(2.5, 0.7, 0.06, R.cloth ? 0xe8e6e0 : 0x4a3020, 0, 0.36, -0.68);
    if (R.cloth) B.box(2.62, 0.3, 0.02, 0xf2f0ea, 0, 0.6, 0.23);
    for (const x of [-0.9, 0, 0.9]) B.box(0.42, 0.9, 0.08, 0x2a1a12, x, 0.9, -1.12);
    if (!R.glasses) { B.box(0.3, 0.02, 0.22, 0xf4f1e6, -0.55, 0.78, -0.4, 0, 0.2); B.box(0.08, 0.07, 0.08, 0xf4f4f0, 0.6, 0.8, -0.3); }
    else { B.box(0.2, 0.18, 0.2, 0x8a8f99, 1.05, 0.86, -0.4); B.box(0.24, 0.02, 0.16, 0xd8b884, -1.05, 0.78, -0.4); }
    sc.add(B.mesh());
    // 심사위원·면접관 자리
    const staff = tier.staff.map(d => { const m = makeStaff(d.type); if (m) sc.add(m.root); return m; });
    // 와인잔 6개
    let glasses = null;
    if (R.glasses) {
      glasses = [];
      for (let i = 0; i < 6; i++) {
        const g = pivot(sc, -0.75 + i * 0.3, 0.77, 0.02);
        bx(g, 0.08, 0.01, 0.08, 0xe8eef4, 0, 0, 0); bx(g, 0.012, 0.09, 0.012, 0xe8eef4, 0, 0.05, 0);
        bx(g, 0.07, 0.08, 0.07, 0xdfe8f2, 0, 0.13, 0, new THREE.MeshBasicMaterial({ color: 0xdfe8f2, transparent: true, opacity: 0.35, fog: false }));
        const wine = new THREE.Mesh(UNIT, glowMat(0x6a0a1a)); wine.scale.set(0.06, 0.04, 0.06); wine.position.set(0, 0.11, 0); g.add(wine);
        glasses.push({ g, wine });
      }
    }
    const cam = new THREE.PerspectiveCamera(62, RW / RH, 0.03, 40); cam.rotation.order = 'YXZ';
    const eye = new THREE.Vector3(0, 1.17, 0.9); cam.position.copy(eye);
    Object.assign(EX, { scene: sc, tier: ti, paper: null, paperTex: null, paperSig: '', staff, cctv: null, pulse: null, drone: null, cam, eye, watch: null, pen: null, clock: null, clockSec: -1,
      AL: -0.9, AR: 0.9, zFront: -1, zBack: 1, my: { x: 0, z: 0.6 }, desks: [], raise: null, candle: null, lamps: [], views: VIEWS_TABLE, layout: 'table', floaty: false, glasses, frontZ: -1 });
  }
  function buildHomeExam(ti) { // 토플 홈에디션: 고시원 방 노트북 화면이 시험지
    buildHub();
    const screenTex = canvasTex(SCREEN_W, SCREEN_H, true);
    const c = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion();
    HUB.shopFace.getWorldPosition(c); HUB.shopFace.getWorldQuaternion(q); n.set(0, 0, 1).applyQuaternion(q);
    const eye = c.clone().addScaledVector(n, 0.36); eye.y += 0.04;
    const d = c.clone().sub(eye).normalize(), yaw = Math.atan2(-d.x, -d.z), pitch = Math.asin(d.y);
    const cam = new THREE.PerspectiveCamera(46, RW / RH, 0.02, 30); cam.rotation.order = 'YXZ'; cam.position.copy(eye);
    const views = { paper: { yaw, pitch, fov: 46 }, left: { yaw: yaw + 0.95, pitch: pitch + 0.25, fov: 60 }, right: { yaw: yaw - 0.95, pitch: pitch + 0.25, fov: 60 } };
    Object.assign(EX, { scene: HUB.scene, home: true, tier: ti, paper: HUB.shopFace, paperTex: screenTex, paperSig: '', staff: [], cctv: null, pulse: null, drone: null, cam, eye, watch: null, pen: null, clock: null, clockSec: -1,
      AL: 0, AR: 0, zFront: 0, zBack: 0, my: { x: 0, z: 0 }, desks: [], raise: null, candle: null, lamps: [], views, layout: 'home', floaty: false, glasses: null, frontZ: 0 });
  }
  function buildExam(ti) {
    if (EX.tier === ti && EX.scene) return;
    if (EX.home) { HUB.shopFace.material.map = HUB.shop.t; HUB.shopFace.material.needsUpdate = true; } else disposeScene(EX.scene);
    EX.scene = null; EX.home = false;
    const tier = CONFIG.tiers[ti], R = ROOMS[tier.room] || ROOMS.hs;
    if (R.layout === 'home') buildHomeExam(ti);
    else if (R.layout === 'table') buildTable(ti, tier, R);
    else buildClassroom(ti, tier, R);
  }
  const zOf = u => lerp(EX.zBack, EX.zFront, u);
  function drawClockFace(sec) {
    if (!EX.clock) return;
    const g = EX.clock.g; g.clearRect(0, 0, 64, 64);
    g.fillStyle = '#2a2838'; g.beginPath(); g.arc(32, 32, 31, 0, 7); g.fill(); g.fillStyle = '#fbfaf3'; g.beginPath(); g.arc(32, 32, 27, 0, 7); g.fill();
    g.strokeStyle = '#2a2838'; g.lineWidth = 3; const h = 0.55 * 6.283, m = (sec / 60) * 6.283;
    g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.sin(h) * 13, 32 - Math.cos(h) * 13); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.sin(m) * 20, 32 - Math.cos(m) * 20); g.stroke();
    EX.clock.t.needsUpdate = true;
  }
  const SEATS = { 1: [0], 2: [-0.45, 0.45], 3: [-0.9, 0, 0.9] };
  function staffPlace(s, i, E) { // 게임 규칙의 위치(왼쪽·오른쪽 통로, 앞뒤 u, 자리)를 방 좌표로
    const T = E.T;
    if (s.fixed) {
      const toMe = x => Math.atan2(EX.eye.x - x, EX.eye.z - (EX.layout === 'table' ? -0.95 : EX.frontZ - 1.55));
      const pitch = s.phase === 'stand' ? 0.55 : s.phase === 'tell' ? 0.22 : 0;
      if (EX.layout === 'table') { const fx = T.staff.map((d, j) => j).filter(j => T.staff[j].fixed), n = fx.length, k = fx.indexOf(i), x = (SEATS[n] || SEATS[3])[Math.max(0, k)];
        return { x, z: -0.95, yaw: toMe(x) * (s.phase === 'stand' ? 0.3 : 1), moving: false, headPitch: pitch, seated: true }; }
      if (s.type === 'omega') return { x: 0, y: 2.3, z: -5.5, yaw: s.asleep ? 0 : s.phase === 'stand' ? (s.away ? 0.7 : -0.7) : 0, headPitch: s.phase === 'stand' ? -0.2 : 0.18, moving: false };
      return { x: -1.8, z: EX.frontZ - 1.55, yaw: toMe(-1.8), moving: false, headPitch: pitch, seated: true };
    }
    let x = s.side === 'L' ? EX.AL : EX.AR, z = zOf(s.u), yaw, moving = s.phase === 'walk', headPitch = 0;
    if (s.phase === 'cross') { // 앞이나 뒤 끝으로 가서 반대편 통로로 건너간다
      const k = clamp(s.t / s.dur, 0, 1), fromX = s.from === 'L' ? EX.AL : EX.AR, toX = s.from === 'L' ? EX.AR : EX.AL;
      const endZ = zOf(s.crossEnd === 'back' ? 0.06 : 0.94), z0 = zOf(s.u), sp = clamp(s.crossSplit == null ? 0.35 : s.crossSplit, 0.05, 0.95);
      z = lerp(z0, endZ, clamp(k / sp, 0, 1)); x = lerp(fromX, toX, clamp((k - sp) / (1 - sp), 0, 1));
      yaw = k < sp ? (endZ < z0 ? Math.PI : 0) : (toX > fromX ? Math.PI / 2 : -Math.PI / 2); moving = true;
    } else if (s.phase === 'walk') yaw = s.dir > 0 ? Math.PI : 0;
    else if (s.phase === 'stand') yaw = s.away ? (s.side === 'L' ? -Math.PI / 2 : Math.PI / 2) : Math.PI;
    else if (s.phase === 'help' && s.help) { // 손 든 수험생 쪽으로 가서 그쪽을 본다
      const k = clamp(s.help.k, 0, 1), tz = zOf(s.help.u);
      z = lerp(zOf(s.help.u0), tz, ease(k)); moving = k < 1; yaw = k < 1 ? (tz < zOf(s.help.u0) ? Math.PI : 0) : (s.side === 'L' ? -Math.PI / 2 : Math.PI / 2); headPitch = 0.25;
    } else if (s.phase === 'peek' && s.peek) { // 책상 건너편 바닥에 쪼그려 앉아 책상 너머로 눈만 내밀고 올려다본다
      const up = s.peek.stage === 'stare' ? clamp((tune.peek_stare - s.peek.t) / 0.25, 0, 1) : 0;
      return { x: EX.my.x - 0.39, y: -1.1 + up * 0.28, z: EX.my.z + 0.04, yaw: 0.75, moving: false, headPitch: -0.7, hiddenNow: s.peek.stage !== 'stare' };
    } else if (s.phase === 'check' && s.check) { // 내 책상 앞으로 와서 수험표·계산기를 본다
      const ax = s.side === 'L' ? EX.AL : EX.AR, az = zOf(s.check.u0), tx = EX.my.x + (s.side === 'L' ? -0.3 : 0.3), tz = EX.my.z - 0.62, k = ease(clamp(s.check.k, 0, 1));
      x = lerp(ax, tx, k); z = lerp(az, tz, k); yaw = Math.atan2(EX.eye.x - x, EX.eye.z - z); moving = s.check.stage !== 'at'; headPitch = s.check.stage === 'at' ? 0.5 : 0;
    } else yaw = Math.atan2(EX.eye.x - x, EX.eye.z - z);
    return { x, z, yaw, moving, headPitch };
  }
  function renderExam(E, now) {
    if (!W.ok) return;
    buildExam(E.tier);
    const V = EX.views, a = V[E.prevView] || V.paper, b = V[E.view] || V.paper, k = ease(clamp(E.viewT, 0, 1)), cam = EX.cam;
    cam.position.copy(EX.eye); cam.position.y += Math.sin(now * 1.3) * 0.003;
    cam.rotation.y = lerp(a.yaw, b.yaw, k); cam.rotation.x = lerp(a.pitch, b.pitch, k) + Math.sin(now * 0.9) * 0.004;
    const fov = lerp(a.fov, b.fov, k); if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const predict = E.gear.predict > 0 || (E.gear.thirdeye > 0 && E.T.mech.includes('threeeyes'));
    // 평행우주: 늘어난 감독관 모델을 만든다
    while (EX.staff.length < E.staff.length) { const s = E.staff[EX.staff.length], m = makeStaff(s.type); if (m) { m.root.traverse(o => { if (o.material && o.material.color && o.material !== m.cone.material) { o.material = o.material.clone(); o.material.color.offsetHSL(0.1 * EX.staff.length, 0, 0); } }); EX.scene.add(m.root); } EX.staff.push(m); }
    let helping = null;
    for (let i = E.staff.length; i < EX.staff.length; i++) if (EX.staff[i]) EX.staff[i].root.visible = false;
    E.staff.forEach((s, i) => {
      let m = EX.staff[i];
      if (m && m.type !== s.type) { EX.scene.remove(m.root); m = EX.staff[i] = makeStaff(s.type); if (m) EX.scene.add(m.root); } // 블록마다 감독관 교대
      if (!m) return;
      const p = staffPlace(s, i, E), toMe = Math.atan2(EX.eye.x - p.x, EX.eye.z - p.z);
      const headYaw = s.phase === 'tell' && !s.fixed ? clamp(angTo(0, toMe - (m.yaw || 0), 1), -1.1, 1.1) : 0;
      const dist = Math.hypot(EX.eye.x - p.x, EX.eye.z - p.z);
      if (s.phase === 'help' && s.help && s.help.k >= 1) helping = s;
      poseModel(m, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, moving: p.moving, walk: s.walk, phase: s.phase === 'check' && s.check && s.check.stage === 'at' ? 'watch' : s.phase, now, headYaw, headPitch: p.headPitch,
        predict: predict && !s.asleep, asleep: s.asleep, away: s.away, hidden: s.out || s.blink > 0 || p.hiddenNow, seated: p.seated, coneLen: s.phase === 'watch' ? Math.max(0.6, dist - 0.55) : 3.5 });
    });
    if (EX.raise) { // 손 든 수험생
      EX.raise.visible = !!helping;
      if (helping) { const tx = (helping.side === 'L' ? EX.AL : EX.AR) + (helping.side === 'L' ? -0.6 : 0.6); EX.raise.position.set(tx, 1.05 + Math.sin(now * 5) * 0.02, zOf(helping.help.u) + 0.3); }
    }
    if (EX.cctv) {
      const c = EX.cctv, on = E.cctv && E.cctv.on, jammed = E.gear.cctvjam >= 3;
      c.body.rotation.y = c.base + (E.cctv ? E.cctv.a : 0) * 0.9;
      c.led.color.setHex(on && !jammed ? (Math.floor(now * 4) % 2 ? 0xff3048 : 0xff9a9a) : 0x6b2a2a);
      c.cone.visible = predict; c.cone.material.color.setHex(on && !jammed ? 0xff3040 : 0xff8080); c.cone.material.opacity = on && !jammed ? 0.16 : 0.05; c.cone.scale.set(6, 6, 7);
    }
    if (EX.pulse && E.pulse) {
      const p = EX.pulse, warn = E.pulse.warn > 0 && Math.floor(now * 8) % 2 === 0;
      p.led.color.setHex(warn || E.pulse.active > 0 ? 0xff3048 : 0x5a2a2a);
      p.ring.visible = E.pulse.active > 0 && E.T.pulse !== 'drone';
      if (p.ring.visible) { const kk = 1 - E.pulse.active / 0.6; p.ring.scale.setScalar(0.3 + kk * 16); p.ring.material.opacity = 0.6 * (1 - kk) + 0.1; }
      if (EX.drone) { const on = E.pulse.warn > 0 || E.pulse.active > 0; EX.drone.visible = on; if (on) { const kk = E.pulse.active > 0 ? 1 - E.pulse.active / 0.6 * 0.3 : 1 - E.pulse.warn / 1.6; EX.drone.position.set(EX.X0 - 0.9, 2.2 + Math.sin(now * 6) * 0.05, lerp(EX.zBack, EX.zFront, clamp(kk, 0, 1))); } }
    }
    if (EX.candle) { // 저승사자가 낌새를 보이거나 가까우면 촛불이 흔들린다
      const near = E.staff.some(s => s.type === 'reaper' && (s.phase === 'tell' || s.phase === 'watch' || Math.abs(zOf(s.u) - EX.my.z) < 1.2 && !s.blink));
      const f = near ? 0.6 + Math.abs(Math.sin(now * 23)) * 0.8 : 1 + Math.sin(now * 3) * 0.08;
      EX.candle.flame.scale.set(0.02 * (near ? 1.3 : 1), 0.04 * f, 0.02); EX.candle.flame.position.x = near ? Math.sin(now * 31) * 0.008 : 0; EX.candle.light.intensity = near ? 0.4 + Math.abs(Math.sin(now * 37)) * 0.8 : 0.8;
    }
    if (EX.glasses) EX.glasses.forEach((gl, i) => {
      const q = E.qs[i], cur = i === E.qi && !E.over;
      if (q) gl.wine.material.color.setHex(q.color === 'white' ? 0xe8d070 : 0x6a0a1a);
      gl.wine.visible = !!q; gl.g.position.y = 0.77 + (cur ? 0.06 + Math.sin(now * 2) * 0.01 : 0); gl.g.position.z = 0.02 + (cur ? 0.14 : 0);
    });
    if (EX.home) { // 토플: 노트북 웹캠 불
      const w = E.staff[0], led = HUB.camLed;
      if (w && led) led.color.setHex(w.phase === 'watch' ? 0xff2030 : w.phase === 'tell' ? (Math.floor(now * 8) % 2 ? 0xffa030 : 0x3a1a10) : 0x2a1010);
      HUB.shopFace.material.map = EX.paperTex.t; HUB.shopFace.material.needsUpdate = true;
    }
    if (EX.watch) EX.watch.visible = E.gear.watch > 0;
    if (EX.pen) EX.pen.position.y = 0.772 + (E.fb ? Math.sin(E.fb.t * 40) * 0.006 : 0);
    if (EX.paper && EX.floaty && !EX.home) { EX.paper.rotation.z = Math.sin(now * 0.7) * 0.08 * E.float; EX.paper.position.y = 0.744 + Math.max(0, Math.sin(now * 1.1)) * 0.03 * E.float; }
    const sec = Math.floor(now) % 60; if (sec !== EX.clockSec) { EX.clockSec = sec; drawClockFace(sec); }
    if (EX.paperTex) {
      const q = E.qs[Math.min(E.qi, E.qs.length - 1)];
      const sig = [E.qi, E.part, E.ar, E.finalQ && Math.floor(now * 12), Math.min(3, Math.floor(E.scan * 3 + 1e-6)), E.ai, E.answers[E.qi], !!E.fb, E.scan > 0, q && q.pre, E.start > 0, E.breakT > 0, Math.floor((E.listen || 0) * 10), E.pulse && E.pulse.active > 0, E.pulse && E.pulse.warn > 0].join();
      if (E.holding || sig !== EX.paperSig) { EX.paperSig = sig; (EX.home ? drawScreenTexture : drawPaperTexture)(EX.paperTex.g, E, now); EX.paperTex.t.needsUpdate = true; }
    }
    draw(EX.scene, cam, now);
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickChoice(x, y) { // 화면(640x360 좌표)에서 톡 친 자리 → 시험지 보기 번호
    if (!W.ok || !EX.scene || !EX.paper) return -1;
    ndc.set(x / RW * 2 - 1, -(y / RH * 2 - 1)); ray.setFromCamera(ndc, EX.cam);
    const hit = ray.intersectObject(EX.paper)[0]; if (!hit || !hit.uv) return -1;
    return EX.home ? screenRowAt(hit.uv.x * SCREEN_W, (1 - hit.uv.y) * SCREEN_H) : paperRowAt((1 - hit.uv.y) * PAPER_H);
  }

  // ---------- 허브: 고시원 방 ----------
  const HUB = { scene: null };
  function windowTex(act) {
    const T = canvasTex(64, 48, false), g = T.g;
    if (act === 3) { g.fillStyle = '#05040e'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#ffffff'; for (let i = 0; i < 26; i++) g.fillRect((i * 17) % 63, (i * 11) % 47, 1, 1); g.fillStyle = '#c87a4a'; g.fillRect(36, 10, 14, 14); g.fillStyle = '#e8a06a'; g.fillRect(38, 12, 7, 5); g.fillStyle = '#8a6cd6'; g.fillRect(30, 16, 26, 1); }
    else if (act === 2) { g.fillStyle = '#2a2a4a'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#c86a4a'; g.fillRect(0, 22, 64, 4); for (let i = 0; i < 7; i++) { g.fillStyle = '#14142a'; g.fillRect(i * 9 + 2, 16 + (i * 7) % 10, 7, 32); } g.fillStyle = '#14142a'; g.fillRect(26, 6, 4, 42); g.fillRect(22, 14, 12, 2); g.fillStyle = '#f5cc4a'; for (let i = 0; i < 16; i++) g.fillRect((i * 13) % 62, 28 + (i * 7) % 18, 1, 1); }
    else { g.fillStyle = '#0d1430'; g.fillRect(0, 0, 64, 48); for (let i = 0; i < 9; i++) { g.fillStyle = '#080b18'; g.fillRect(i * 7, 20 + (i * 5) % 12, 6, 30); } g.fillStyle = '#f5cc4a'; for (let i = 0; i < 18; i++) g.fillRect((i * 13) % 62, 26 + (i * 7) % 20, 1, 1); }
    T.t.needsUpdate = true; return T.t;
  }
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
    // 창문 (막마다 바깥 풍경이 바뀐다)
    const winMat = new THREE.MeshBasicMaterial({ map: windowTex(1), fog: false });
    plane(sc, 0.5, 0.38, winMat, 0.05, 1.16, Z0 + 0.01);
    B.box(0.56, 0.03, 0.03, 0xe8e4da, 0.05, 1.36, Z0 + 0.02); B.box(0.56, 0.03, 0.03, 0xe8e4da, 0.05, 0.96, Z0 + 0.02); B.box(0.03, 0.42, 0.03, 0xe8e4da, -0.22, 1.16, Z0 + 0.02); B.box(0.03, 0.42, 0.03, 0xe8e4da, 0.32, 1.16, Z0 + 0.02); B.box(0.02, 0.4, 0.02, 0xe8e4da, 0.05, 1.16, Z0 + 0.025);
    sc.add(B.mesh());
    // 누르는 물건들 (각자 재질을 따로 둬서 마우스를 올리면 밝아진다)
    const hot = { exams: [], gear: [], log: [], go: [], parcel: [] }, hm = (key, color, extra) => { const m = ownMat(color, extra); hot[key].push(m); return m; };
    const cork = canvasTex(256, 176, false);
    const board = pivot(sc, -0.74, 1.12, Z0 + 0.012); bx(board, 0.72, 0.5, 0.02, 0, 0, 0, 0, hm('exams', 0x8a6a46));
    const corkFace = plane(board, 0.66, 0.44, hm('exams', 0xffffff, { map: cork.t }), 0, 0, 0.012);
    const laptop = pivot(sc, -0.42, 0.76, -0.33); bx(laptop, 0.36, 0.02, 0.24, 0, 0, 0, 0, hm('gear', 0x3a3d46));
    const scr = pivot(laptop, 0, 0.0, -0.12); scr.rotation.x = -0.32; bx(scr, 0.36, 0.23, 0.012, 0, 0, 0.115, 0, hm('gear', 0x2c2f38));
    const shop = canvasTex(256, 160, false), shopFace = plane(scr, 0.33, 0.2, new THREE.MeshBasicMaterial({ map: shop.t, fog: false }), 0, 0.115, 0.008); hot.gear.push(shopFace.material);
    const camLed = glowMat(0x2a1010); bx(scr, 0.01, 0.006, 0.004, 0, 0, 0.222, 0.008, camLed); bx(scr, 0.016, 0.01, 0.003, 0x0a0a0e, 0.016, 0.222, 0.007);
    const phone = pivot(sc, 0.06, 0.765, -0.2); phone.rotation.set(-Math.PI / 2, 0, -0.25); bx(phone, 0.08, 0.15, 0.012, 0, 0, 0, 0, hm('log', 0x1a1a20));
    const phoneT = canvasTex(64, 120, false), phoneFace = plane(phone, 0.07, 0.135, new THREE.MeshBasicMaterial({ map: phoneT.t, fog: false }), 0, 0, 0.0065); hot.log.push(phoneFace.material);
    const door = pivot(sc, 0.84, 1.03, Z0 + 0.03);
    bx(door, 0.82, 2.06, 0.05, 0, 0, 0, 0, hm('go', 0x7a5a3c)); bx(door, 0.06, 0.06, 0.08, 0, -0.3, -0.02, 0.05, hm('go', 0xd4b25a));
    const sign = canvasTex(128, 96, false); plane(door, 0.36, 0.27, hm('go', 0xffffff, { map: sign.t }), 0.05, 0.35, 0.03);
    // 택배 상자 (문 앞)
    const parcel = pivot(sc, 0.22, 0.94, -0.5); parcel.rotation.y = 0.2; parcel.scale.setScalar(0.8); // 수험서 더미 위에 올려 둔 택배
    bx(parcel, 0.32, 0.2, 0.24, 0, 0, 0.1, 0, hm('parcel', 0xb98a56)); bx(parcel, 0.33, 0.012, 0.05, 0xd8c8a0, 0, 0.205, 0);
    const lidA = pivot(parcel, 0, 0.2, -0.12), lidB = pivot(parcel, 0, 0.2, 0.12);
    bx(lidA, 0.32, 0.012, 0.12, 0, 0, 0, 0.06, hm('parcel', 0xc89a62)); bx(lidB, 0.32, 0.012, 0.12, 0, 0, 0, -0.06, hm('parcel', 0xc89a62));
    const label = canvasTex(64, 32, false); { const g = label.g; g.fillStyle = '#fbf9f1'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#d9473f'; g.fillRect(0, 0, 64, 8); g.fillStyle = '#2a2838'; g.font = `800 11px ${FONT}`; g.fillText('AI마켓', 6, 22); label.t.needsUpdate = true; }
    plane(parcel, 0.12, 0.06, psx(new THREE.MeshLambertMaterial({ map: label.t })), 0.06, 0.12, 0.121);
    parcel.visible = false;
    // 산 장비가 책상과 선반에 놓인다
    const gear = {};
    const glasses = pivot(sc, -0.06, 0.745, -0.42); bx(glasses, 0.1, 0.012, 0.08, 0x2a2434, 0, 0.006, 0); bx(glasses, 0.012, 0.11, 0.012, 0x2a2434, 0, 0.06, 0);
    const lensM = glowMat(0x9fe0ff); lensM.transparent = true; lensM.opacity = 0.75;
    const gl = pivot(glasses, 0, 0.125, 0.01);
    for (const s of [-1, 1]) { bx(gl, 0.07, 0.05, 0.008, 0x2a2434, s * 0.042, 0, 0, hm('gear', 0x2a2434)); bx(gl, 0.058, 0.04, 0.009, 0, s * 0.042, 0, 0.001, lensM); bx(gl, 0.006, 0.006, 0.12, 0x2a2434, s * 0.078, 0.012, -0.06); }
    bx(gl, 0.016, 0.008, 0.008, 0x2a2434, 0, 0.012, 0);
    gear.predict = bx(gl, 0.01, 0.01, 0.01, 0, 0.075, 0.03, 0.006, glowMat(0xf6a234));
    gear.thirdeye = bx(gl, 0.02, 0.02, 0.008, 0, 0, 0.04, 0.004, glowMat(0x7ad06a));
    gear.wide = bx(gl, 0.16, 0.012, 0.01, 0x45e5ee, 0, -0.03, 0.005);
    const item = (id, x, y, z, parts) => { const p = pivot(sc, x, y, z); for (const [w, h, d, c, px, py, pz, glow] of parts) bx(p, w, h, d, c, px, py, pz, glow ? glowMat(c) : undefined); gear[id] = p; return p; };
    item('watch', -0.66, 0.75, -0.16, [[0.05, 0.012, 0.14, 0x3a3248, 0, 0, 0], [0.05, 0.016, 0.05, 0x20303a, 0, 0.006, 0], [0.04, 0.004, 0.04, 0x45e5ee, 0, 0.015, 0, 1]]);
    item('earbud', -0.2, 0.755, -0.16, [[0.06, 0.03, 0.045, 0xf2f2f4, 0, 0, 0], [0.008, 0.008, 0.004, 0x45e5ee, 0, 0.004, 0.024, 1]]);
    item('autoscan', -0.86, 0.746, -0.2, [[0.09, 0.006, 0.07, 0x1f6b3a, 0, 0, 0], [0.03, 0.01, 0.03, 0x111111, 0.01, 0.006, 0], [0.07, 0.002, 0.004, 0xe7c13a, 0, 0.004, 0.025]]);
    item('model', -0.98, 0.8, -0.58, [[0.18, 0.1, 0.12, 0x15161c, 0, 0, 0], [0.16, 0.01, 0.002, 0x8a5cff, 0, 0, 0.061, 1]]);
    item('cctvjam', -1.12, 0.79, -0.26, [[0.1, 0.08, 0.08, 0xd4d6de, 0, 0, 0], [0.01, 0.12, 0.01, 0x2a2a30, 0.03, 0.1, 0], [0.02, 0.02, 0.004, 0xea4540, -0.02, 0.01, 0.041, 1]]);
    item('jammer', -1.12, 0.79, -0.08, [[0.1, 0.07, 0.07, 0x3a3f4a, 0, 0, 0], [0.01, 0.16, 0.01, 0x2a2a30, -0.03, 0.12, 0], [0.02, 0.02, 0.004, 0x45e5ee, 0.02, 0.01, 0.036, 1]]);
    const coach = item('coach', -0.2, 0.8, -0.62, [[0.16, 0.11, 0.008, 0x1a1a20, 0, 0, 0], [0.14, 0.09, 0.002, 0x2f7a5a, 0, 0, 0.005, 1]]); coach.rotation.x = -0.25;
    item('deepcam', -0.42, 0.98, -0.47, [[0.04, 0.025, 0.02, 0x15151a, 0, 0, 0], [0.01, 0.01, 0.004, 0x62d84a, 0, 0, 0.011, 1]]);
    item('autooff', -0.74, 0.746, -0.12, [[0.05, 0.006, 0.05, 0x3a1f6b, 0, 0, 0], [0.02, 0.008, 0.02, 0xd8b04a, 0, 0.004, 0]]);
    // 2막·3막 장비는 선반 위에 한 줄로
    const shelf = [['glasscase', [[0.1, 0.04, 0.05, 0x7a5a3a, 0, 0.02, 0]]], ['gazefix', [[0.04, 0.02, 0.04, 0xe8eef4, 0, 0.01, 0], [0.04, 0.004, 0.04, 0x45e5ee, 0, 0.022, 0, 1]]],
      ['eyedrop', [[0.025, 0.07, 0.025, 0xf4f4f8, 0, 0.035, 0], [0.012, 0.02, 0.012, 0x2a8af0, 0, 0.08, 0]]], ['calccover', [[0.06, 0.012, 0.09, 0x2a2c34, 0, 0.006, 0], [0.05, 0.004, 0.025, 0x9ae0a0, 0, 0.014, -0.025, 1]]],
      ['screenfilm', [[0.03, 0.06, 0.03, 0xc8d0d8, 0, 0.03, 0]]], ['taste', [[0.05, 0.03, 0.03, 0x8a1a2a, 0, 0.015, 0], [0.01, 0.01, 0.01, 0xff5a8a, 0, 0.035, 0, 1]]],
      ['candle', [[0.025, 0.06, 0.025, 0xf4efe0, 0, 0.03, 0], [0.012, 0.022, 0.012, 0xffb04a, 0, 0.072, 0, 1]]], ['clone', [[0.06, 0.08, 0.01, 0x8a6a46, 0, 0.04, 0], [0.05, 0.06, 0.002, 0x8a6cd6, 0, 0.04, 0.006, 1]]],
      ['humanmod', [[0.05, 0.006, 0.05, 0x6b1f3a, 0, 0.003, 0], [0.02, 0.01, 0.02, 0xe8e8e8, 0, 0.008, 0]]], ['offbeat', [[0.05, 0.08, 0.04, 0x5a3a24, 0, 0.04, 0], [0.004, 0.07, 0.004, 0xe8e8e8, 0, 0.07, 0.022]]]];
    shelf.forEach(([id, parts], i) => item(id, 0.04 + i * 0.034 - 0.6, 1.475, -0.5 + (i % 2) * 0.02, parts));
    const bots = [];
    for (let i = 0; i < 8; i++) { const b = pivot(sc, -1.12 + i * 0.11, 1.475, -0.52); bx(b, 0.06, 0.05, 0.05, 0x9aa3b8, 0, 0.04, 0); bx(b, 0.05, 0.02, 0.006, 0, 0, 0.045, 0.026, glowMat(0x7ff6ff)); bx(b, 0.008, 0.03, 0.008, 0x2a2a30, 0, 0.08, 0); bx(b, 0.07, 0.03, 0.06, 0x8a5a32, 0, 0.01, 0); b.visible = false; bots.push(b); }
    const cam = new THREE.PerspectiveCamera(60, RW / RH, 0.02, 30); cam.rotation.order = 'YXZ';
    Object.assign(HUB, { scene: sc, cam, hot, cork, corkFace, shop, shopFace, camLed, phoneT, phone, sign, gear, bots, lensM, parcel, lidA, lidB, wallM, winMat, act: 1, sigs: {}, anchors: [
      ['exams', new THREE.Vector3(-0.74, 1.4, Z0 + 0.05)],
      ['gear', new THREE.Vector3(-0.42, 1.02, -0.38)],
      ['log', new THREE.Vector3(0.06, 0.84, -0.2)],
      ['go', new THREE.Vector3(0.84, 1.68, Z0 + 0.06)],
      ['parcel', new THREE.Vector3(0.22, 1.2, -0.5)],
    ], pickables: [board, laptop, phone, door, glasses, parcel].map((o, i) => { o.userData.action = ['exams', 'gear', 'log', 'go', 'gear', 'parcel'][i]; return o; }) });
    // 카메라가 다가가는 자리: 방 전체 · 노트북 화면 · 일정표 · 폰
    const c = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion();
    const poseAt = (obj, dist, lift = 0) => { obj.updateMatrixWorld(true); obj.getWorldPosition(c); obj.getWorldQuaternion(q); n.set(0, 0, 1).applyQuaternion(q); const p = c.clone().addScaledVector(n, dist); p.y += lift; return { pos: p, look: c.clone() }; };
    sc.updateMatrixWorld(true);
    HUB.poses = { laptop: poseAt(shopFace, 0.235, 0.0), board: poseAt(corkFace, 0.52, 0.0), phone: { pos: new THREE.Vector3(0.0, 1.12, 0.22), look: new THREE.Vector3(0.05, 0.77, -0.2) } };
  }
  function drawCork(G) { // 방에서 보이는 일정표: 이번 막에서 합격한 시험과 다음 시험만
    const g = HUB.cork.g, nt = nextTierIndex(G), act = CONFIG.tiers[nt].act;
    g.fillStyle = '#c79a62'; g.fillRect(0, 0, 256, 176); g.fillStyle = '#b98a54'; for (let i = 0; i < 60; i++) g.fillRect((i * 37) % 256, (i * 23) % 176, 2, 2);
    g.fillStyle = '#fbf9f1'; g.fillRect(12, 8, 232, 160); g.fillStyle = '#d9473f'; g.fillRect(12, 8, 232, 18);
    g.fillStyle = '#ffffff'; g.font = `800 12px ${FONT}`; g.textAlign = 'left'; g.fillText(`${CONFIG.acts[act - 1]} 시험 일정표`, 20, 22);
    const list = CONFIG.tiers.map((t, i) => ({ t, i })).filter(o => o.t.act === act && o.i <= nt);
    list.slice(-8).forEach(({ t, i }, k) => {
      const y = 42 + k * 16;
      g.fillStyle = i === nt ? '#ffe9a8' : 'rgba(0,0,0,0)'; g.fillRect(14, y - 11, 228, 15);
      g.fillStyle = '#2a2838'; g.font = `${i === nt ? 800 : 700} 11px ${FONT}`; g.fillText(t.name, 20, y);
      g.textAlign = 'right'; g.fillStyle = G.cleared[i] ? '#2f8a3a' : '#b8362e';
      g.fillText(G.cleared[i] ? '합격' : examFee(t) ? won(examFee(t)) + '원' : '무료', 236, y); g.textAlign = 'left';
    });
    HUB.cork.t.needsUpdate = true;
  }
  function drawShop(G) { // 방에서 보이는 노트북 화면: AI마켓, 새로 들어온 게 있으면 NEW
    const g = HUB.shop.g; g.fillStyle = '#0d1018'; g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#45e5ee'; g.font = `800 18px ${FONT}`; g.textAlign = 'left'; g.fillText('AI마켓', 12, 26); g.fillStyle = '#2a8f9a'; g.fillRect(12, 34, 232, 1);
    const fresh = shopNewCount();
    if (fresh) { g.fillStyle = '#ea4540'; g.fillRect(170, 10, 74, 22); g.fillStyle = '#ffffff'; g.font = `800 13px ${FONT}`; g.fillText(`NEW ${fresh}`, 180, 26); }
    g.fillStyle = '#c9f6fa'; g.font = `700 12px ${FONT}`; g.fillText('오늘의 특가 · 시험 전 총알배송', 12, 56);
    for (let i = 0; i < 3; i++) { g.fillStyle = '#1c2230'; g.fillRect(12 + i * 80, 70, 72, 70); g.fillStyle = '#f5cc4a'; g.fillText('주문', 30 + i * 80, 130); }
    HUB.shop.t.needsUpdate = true;
  }
  function drawPhone(G) {
    const g = HUB.phoneT.g; g.fillStyle = '#10131c'; g.fillRect(0, 0, 64, 120);
    g.fillStyle = '#8fa0b8'; g.font = `700 8px ${FONT}`; g.textAlign = 'center'; g.fillText('내 통장', 32, 16);
    g.fillStyle = '#f5cc4a'; g.font = `800 11px ${FONT}`; g.fillText(won(STATE.shown), 32, 34); g.font = `800 9px ${FONT}`; g.fillText('원', 32, 46);
    const unread = phoneUnread();
    if (unread) { g.fillStyle = '#ea4540'; g.beginPath(); g.arc(52, 10, 7, 0, 7); g.fill(); g.fillStyle = '#ffffff'; g.font = `800 8px ${FONT}`; g.fillText(String(Math.min(9, unread)), 52, 13); }
    g.fillStyle = '#45e5ee'; g.font = `700 7px ${FONT}`; g.fillText(fmtRun(runSecs()), 32, 64);
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
  function updateHub(G, now, hover, hv) {
    const sigs = HUB.sigs, examSig = G.unlocked + '|' + G.cleared.join() + '|' + nextTierIndex(G) + '|' + tune.fee_scale;
    if (sigs.cork !== examSig) { sigs.cork = examSig; drawCork(G); drawSign(G); }
    const shopSig = shopNewCount(); if (sigs.shop !== shopSig) { sigs.shop = shopSig; drawShop(G); }
    if (now - (sigs.phoneT || -9) > 0.25) { sigs.phoneT = now; drawPhone(G); }
    const act = CONFIG.tiers[nextTierIndex(G)].act;
    if (HUB.act !== act) { HUB.act = act; HUB.winMat.map = windowTex(act); HUB.winMat.needsUpdate = true; HUB.wallM.color.setHex(act === 3 ? 0xb8a8d8 : act === 2 ? 0xc8d4e0 : 0xffffff); }
    const g = G.gear, hid = (hv && hv.hidden) || {};
    for (const id in HUB.gear) { const lv = id === 'model' ? g.model : g[id]; HUB.gear[id].visible = lv > 0 && !hid[id]; }
    HUB.bots.forEach((b, i) => { b.visible = i < g.bot && !hid.bot; b.position.y = 1.475 + (i < g.bot ? Math.abs(Math.sin(now * 3 + i)) * 0.006 : 0); });
    HUB.lensM.color.setHex(g.stealth ? 0x8a6cd6 : [0xbfe8ff, 0x9fe0ff, 0x7fd6ff, 0x5fe0e8, 0x45e5ee][Math.min(4, Math.floor(g.lens / 2))]);
    const pc = hv && hv.parcel;
    HUB.parcel.visible = !!pc;
    if (pc) { const k = pc.phase === 'open' ? clamp(pc.t / 0.5, 0, 1) : 0, drop = pc.phase === 'arrive' ? clamp(1 - pc.t / 0.35, 0, 1) : 0; HUB.lidA.rotation.x = -k * 2.0; HUB.lidB.rotation.x = k * 2.0; HUB.parcel.position.y = 0.94 + drop * 0.4; }
    for (const key in HUB.hot) for (const m of HUB.hot[key]) if (m.emissive) m.emissive.setHex(key === hover ? 0x3a3424 : 0x000000);
  }
  const ROOM_POSE = { pos: new THREE.Vector3(-0.3, 1.18, 0.62), yaw: -0.12, pitch: -0.2, fov: 60 };
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _look = new THREE.Object3D();
  function renderHub(G, now, hover, hv) {
    if (!W.ok) return;
    buildHub();
    if (HUB.shopFace.material.map !== HUB.shop.t) { HUB.shopFace.material.map = HUB.shop.t; HUB.shopFace.material.needsUpdate = true; }
    updateHub(G, now, hover, hv);
    const c = HUB.cam, z = hv ? ease(clamp(hv.zoom, 0, 1)) : 0, target = hv && HUB.poses[hv.view];
    const roomYaw = ROOM_POSE.yaw + Math.sin(now * 0.3) * 0.01, roomPitch = ROOM_POSE.pitch + Math.sin(now * 0.45) * 0.006;
    _e.set(roomPitch, roomYaw, 0, 'YXZ'); _qa.setFromEuler(_e);
    if (target && z > 0) {
      _look.position.copy(target.pos); _look.lookAt(target.look); _qb.copy(_look.quaternion);
      // Object3D.lookAt는 +z가 대상을 향하게 돌리므로 카메라(-z가 앞)는 반 바퀴 돌린다
      _qb.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
      c.position.copy(ROOM_POSE.pos).lerp(target.pos, z); c.quaternion.copy(_qa).slerp(_qb, z);
      const fov = lerp(ROOM_POSE.fov, hv.view === 'phone' ? 55 : 50, z); if (Math.abs(c.fov - fov) > 0.01) { c.fov = fov; c.updateProjectionMatrix(); }
    } else {
      c.position.copy(ROOM_POSE.pos); c.quaternion.copy(_qa);
      if (c.fov !== ROOM_POSE.fov) { c.fov = ROOM_POSE.fov; c.updateProjectionMatrix(); }
    }
    c.updateMatrixWorld();
    draw(HUB.scene, c, now);
  }
  function renderTitle(G, now) { // 밤의 고시원: 책상 위 AI 안경을 천천히 비춘다
    if (!W.ok) return;
    buildHub(); updateHub(G, now, null, null);
    const c = HUB.cam; c.position.set(0.05 + Math.sin(now * 0.2) * 0.06, 1.0, 0.05); c.rotation.set(-0.3, 0.2 + Math.sin(now * 0.2) * 0.05, 0, 'YXZ');
    if (c.fov !== 50) { c.fov = 50; c.updateProjectionMatrix(); }
    c.updateMatrixWorld();
    draw(HUB.scene, c, now, 1.3);
  }
  const _p = new THREE.Vector3();
  function hubLabels() { // 물건 이름표 위치 (640x360 좌표)
    if (!W.ok || !HUB.scene) return [];
    return HUB.anchors.map(([action, v]) => { _p.copy(v).project(HUB.cam); return { action, x: (_p.x + 1) / 2 * RW, y: (1 - _p.y) / 2 * RH, show: _p.z < 1 && (action !== 'parcel' || HUB.parcel.visible) }; });
  }
  function hubRect(view) { // 다가간 노트북 화면·일정표가 화면에서 차지하는 사각형 (640x360 좌표)
    if (!W.ok || !HUB.scene) return null;
    const face = view === 'laptop' ? HUB.shopFace : view === 'board' ? HUB.corkFace : null; if (!face) return null;
    const w = face.geometry.parameters.width / 2, h = face.geometry.parameters.height / 2;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [px, py] of [[-w, -h], [w, -h], [w, h], [-w, h]]) { _p.set(px, py, 0); face.localToWorld(_p); _p.project(HUB.cam); const sx = (_p.x + 1) / 2 * RW, sy = (1 - _p.y) / 2 * RH; x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function pickHub(x, y) {
    if (!W.ok || !HUB.scene) return null;
    ndc.set(x / RW * 2 - 1, -(y / RH * 2 - 1)); ray.setFromCamera(ndc, HUB.cam);
    const hit = ray.intersectObjects(HUB.pickables.filter(o => o.visible), true)[0]; if (!hit) return null;
    let o = hit.object; while (o && !o.userData.action) o = o.parent;
    return o ? o.userData.action : null;
  }

  // ---------- figures: 감독관 줄 세우기 ----------
  const FIG = { scene: null };
  const FIG_TYPES = [['homeroom', 'dean', 'suneung', 'agent', 'robot', 'ta', 'prof', 'teacher'], ['cnproctor', 'don', 'don2', 'judge', 'alien', 'reaper', 'yeomra', 'omega']];
  function buildFigures() {
    if (FIG.scene) return;
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0xd8cdb4);
    sc.add(new THREE.AmbientLight(0xffffff, 1.3)); sc.add(new THREE.HemisphereLight(0xfff4dc, 0x5a4a3a, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0); sun.position.set(-3, 5, 6); sc.add(sun);
    const B = batch(); B.box(16, 0.02, 10, 0xbfae8c, 0, -0.01, -1.5); sc.add(B.mesh());
    const ms = [];
    FIG_TYPES.forEach((row, r) => row.forEach((t, i) => {
      const m = makeStaff(t), x = -4.55 + i * 1.3, z = r ? -3.4 : 0;
      if (m) { m.root.position.set(x, t === 'omega' ? 0.9 : 0, z); if (t === 'omega') m.root.scale.setScalar(0.4); m.root.rotation.y = 0; sc.add(m.root); }
      ms.push({ m, label: PROCTOR_NAME[t] || t, pose: 'watch', x, z, top: !!r });
    }));
    const cam = new THREE.PerspectiveCamera(30, RW / RH, 0.1, 60); cam.position.set(0, 4.6, 12.5); cam.lookAt(0, 0.7, -1.6);
    Object.assign(FIG, { scene: sc, cam, ms });
  }
  function renderFigures(now) {
    if (!W.ok) return;
    buildFigures();
    for (const f of FIG.ms) if (f.m && f.m.robot) f.m.root.position.y = 0.06 + Math.sin(now * 4) * 0.03;
    draw(FIG.scene, FIG.cam, now, 0.3);
  }
  function figureLabels() {
    if (!W.ok || !FIG.scene) return [];
    return FIG.ms.map(f => { _p.set(f.x, f.top ? 2.3 : -0.15, f.z).project(FIG.cam); return { text: f.label, x: (_p.x + 1) / 2 * RW, y: (1 - _p.y) / 2 * RH, pose: f.pose }; });
  }

  return Object.assign(W, { init, renderExam, renderHub, renderTitle, renderFigures, pickChoice, pickHub, hubLabels, figureLabels, hubRect, layout: () => EX.layout });
})();
