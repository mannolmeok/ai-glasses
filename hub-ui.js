// PROTOTYPE - NOT FOR PRODUCTION
// Question: 감독관 눈치를 보며 AI 안경으로 스캔하는 긴장감이, 장비와 시험이 함께 커지는 성장과 맞물려 엔딩까지 재밌나?
// Date: 2026-11-18
// 고시원 방에서 물건에 다가갔을 때의 화면: 노트북의 쇼핑몰 "AI마켓"(신상·안경·AI 기기·AI 모델 구독),
// 벽의 시험 일정표(막별 시험 접수), 폰(알림·기록·설정). 640x360 도트 층에 그리고, 누를 수 있는 곳을 돌려준다.
// 규칙과 숫자는 game.js, 여기서는 그리기만 한다.
'use strict';

const HUBUI = (() => {
  const SHOP_TABS = [['new', '신상'], ['glass', '안경'], ['device', 'AI 기기'], ['model', 'AI 모델 구독']];
  const PHONE_TABS = [['news', '알림'], ['log', '기록'], ['set', '설정']];
  let btns = [], hover = null;
  const inR = (b, p) => p && p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h;
  function btn(k, x, y, w, h, label, key, o = {}) { // 누르는 칸 하나
    const hot = !o.off && inR({ x, y, w, h }, hover), col = o.col || PAL.hud;
    k.R(x, y, w, h, o.off ? '#1a1820' : o.on ? col : hot ? '#17505a' : (o.bg || '#0f3238'));
    k.frame(x, y, w, h, o.off ? '#3a3548' : hot ? PAL.white : col, 1);
    let size = o.size || 11; while (k.TW(label, size, 800) > w - 6 && size > 8) size--;
    k.T(label, x + w / 2, y + h / 2, size, o.off ? '#6d6880' : o.on ? PAL.dark : (o.fg || '#dcfdff'), 'center', 800);
    if (!o.off && key) btns.push({ x, y, w, h, key });
  }
  function fitText(k, str, maxW, size, min = 8) { while (k.TW(str, size, 700) > maxW && size > min) size--; return size; }
  function wrap(k, str, maxW, size) {
    const out = []; let cur = '';
    for (const w of String(str).split(' ')) { const t = cur ? cur + ' ' + w : w; if (k.TW(t, size, 700) <= maxW || !cur) cur = t; else { out.push(cur); cur = w; } }
    if (cur) out.push(cur); return out;
  }

  // ---- 노트북: 3D 화면 표면에 직접 그린다 (400x240, 큰 글자, 한 화면에 상품 2개) ----
  const LW = 400, LH = 240;
  function lapHead(k, title, col, bg) { k.R(0, 0, LW, 26, bg); k.T(title, 10, 13, 15, col, 'left', 800); k.T(`${won(STATE.shown)}원`, LW - 8, 13, 13, PAL.gold, 'right', 800); }
  function lapFoot(k, hv, backLabel, bg, pages, pkey) {
    k.R(0, LH - 28, LW, 28, bg);
    const out = !!(G.flags.sold || G.black); // 품절·협박 사건 전에는 바탕화면이 없는 것처럼: 뒤로 = 방으로
    btn(k, 6, LH - 24, 92, 20, out ? backLabel : '< 방으로', 'back', { bg: '#1d2433', col: '#4a5a6a', fg: '#ffffff', size: 12 });
    if (out && !G.flags.deskSeen && Math.floor(now * 2) % 2 === 0) k.disc(96, LH - 23, 5, '#e8453e'); // 바탕화면에 새 소식: 빨간 점이 깜빡인다
    if (pages > 1) { const pg = hv.page;
      btn(k, LW / 2 - 62, LH - 24, 34, 20, '<', pg > 0 ? pkey + ':-1' : null, { off: pg <= 0, bg: '#1d2433', col: '#4a5a6a', fg: '#ffffff', size: 13 });
      k.T(`${pg + 1} / ${pages}`, LW / 2, LH - 14, 12, '#5a6474', 'center', 800);
      btn(k, LW / 2 + 28, LH - 24, 34, 20, '>', pg < pages - 1 ? pkey + ':1' : null, { off: pg >= pages - 1, bg: '#1d2433', col: '#4a5a6a', fg: '#ffffff', size: 13 }); }
    const n = hv.order.length; if (n) k.T(`주문 ${n}건 · 방에 택배 옴`, LW - 8, LH - 14, 11, '#c0392b', 'right', 800);
  }
  function drawDesk(k, hv, now) {
    const { R, T } = k, C = PAL;
    for (let i = 0; i < 8; i++) R(0, i * 30, LW, 30, ['#16324a', '#183a52', '#1a425a', '#1c4a60', '#1e5266', '#205a6a', '#22626c', '#24686c'][i]);
    T('고시원 노트북', 10, 13, 12, '#c9e6f0', 'left', 700); T(`${won(STATE.shown)}원`, LW - 8, 13, 13, C.gold, 'right', 800);
    const icon = (ix, label, key, col, glyph, badge) => {
      const iy = 54, hot = inR({ x: ix, y: iy, w: 120, h: 126 }, hover);
      if (hot) { k.b.globalAlpha = 0.25; R(ix, iy, 120, 126, '#ffffff'); k.b.globalAlpha = 1; }
      R(ix + 24, iy + 8, 72, 72, C.dark); R(ix + 27, iy + 11, 66, 66, col); glyph(ix + 60, iy + 44);
      T(label, ix + 60, iy + 102, 16, C.white, 'center', 800);
      if (badge) { k.disc(ix + 94, iy + 12, 11, '#e8453e'); T(String(badge), ix + 94, iy + 12, 13, C.white, 'center', 800); }
      btns.push({ x: ix, y: iy, w: 120, h: 126, key });
    };
    const tgBadge = G.black || (G.flags.sold && soldOut(gearDef('lens'))) ? 1 : 0;
    icon(60, 'AI마켓', 'app:shop', '#0f1722', (cx, cy) => T('AI', cx, cy, 30, C.hud, 'center', 800), shopNewCount());
    icon(220, '텔레그램', 'app:tg', '#2aa3e0', (cx, cy) => k.poly([[cx - 22, cy], [cx + 22, cy - 18], [cx + 11, cy + 19], [cx - 3, cy + 7]], '#ffffff'), tgBadge);
    lapFoot(k, hv, '< 방으로', '#0d1f2c', 1);
  }
  function drawTg(k, hv, now) {
    const { R, T } = k, C = PAL;
    R(0, 0, LW, LH, '#0e1621'); lapHead(k, '텔레그램', '#5eb5f7', '#17212b');
    const want = G.flags.sold && soldOut(gearDef('lens')), done = !!G.flags.cam, bl = G.black;
    let by = 34;
    const bubble = (text, mine) => { const ls = wrap(k, text, 250, 12), bw = Math.max(...ls.map(l => k.TW(l, 12, 700))) + 16, bh = ls.length * 15 + 8, bx = mine ? LW - 10 - bw : 10;
      R(bx, by, bw, bh, mine ? '#2b5278' : '#182533'); ls.forEach((l, i) => T(l, bx + 8, by + 12 + i * 15, 12, C.white, 'left', 700)); by += bh + 5; };
    if (!want && !done && !bl) { T('새 대화가 없습니다', LW / 2, 100, 15, '#6d7f8f', 'center', 800); T('모르는 사람의 메시지는 조심하세요', LW / 2, 124, 11, '#4a5a6a', 'center', 700); }
    else if (bl) { // 다시 연락 온 브로커: 입막음비를 내거나, 제보당하거나
      bubble('사장님 오랜만. 요즘 단속 심해진 거 아시죠?', false);
      bubble(`구매자 명단이 저한테 있어요. ${won(bl.amount)}원 보내면 지워 드림. 안 보내면 제보합니다`, false);
      if (bl.seen) T('다음 시험이 끝날 때까지 답이 없으면 제보한다', LW / 2, 158, 11, PAL.warn, 'center', 800);
      const ok = G.money >= bl.amount;
      btn(k, 10, LH - 62, 150, 26, '무시 (제보당함)', 'refuse', { bg: '#2a1218', col: PAL.bad, fg: '#ffd6da', size: 12 });
      btn(k, LW - 10 - 210, LH - 62, 210, 26, ok ? `송금 · ${won(bl.amount)}원` : `${won(bl.amount - G.money)}원 모자람`, ok ? 'hush' : null, { off: !ok, bg: '#2b5278', col: '#5eb5f7', fg: '#ffffff', size: 13 });
    } else {
      bubble('초소형 카메라 찾으시죠? 한국은 다 품절이라던데', false);
      bubble('재고 있어요?', true);
      bubble(`해외 창고에 딱 남았음. 값은 좀 올랐어요. ${won(brokerCost())}원, 선입금`, false);
      if (done) { bubble('입금했어요', true); bubble('확인. 택배 보냄. 우린 모르는 사이', false); }
      else { const ok = G.money >= brokerCost(); btn(k, LW - 10 - 220, LH - 62, 220, 26, ok ? `입금하기 · ${won(brokerCost())}원` : `${won(brokerCost() - G.money)}원 모자람`, ok ? 'broker' : null, { off: !ok, bg: '#2b5278', col: '#5eb5f7', fg: '#ffffff', size: 13 }); }
    }
    lapFoot(k, hv, '< 바탕화면', '#17212b', 1);
  }
  function drawShop(k, hv, now) {
    const { R, T } = k, C = PAL;
    R(0, 0, LW, LH, '#f3f4f7'); lapHead(k, 'AI마켓', C.hud, '#0f1722');
    const fresh = shopNewCount(), tw = Math.floor((LW - 12) / 4);
    SHOP_TABS.forEach(([key, name], i) => {
      const on = hv.tab === key, bx = 6 + i * tw, label = key === 'new' && fresh ? `신상 ${fresh}` : key === 'model' ? 'AI 모델' : name;
      R(bx, 30, tw - 4, 22, on ? '#ffffff' : '#dfe3ea'); if (on) R(bx, 30, tw - 4, 3, '#e8453e');
      T(label, bx + (tw - 4) / 2, 42, 13, on ? '#1d2433' : '#5a6474', 'center', 800);
      btns.push({ x: bx, y: 30, w: tw - 4, h: 22, key: 'tab:' + key });
    });
    const list = shopItems(hv.tab), per = 2, pages = Math.max(1, Math.ceil(list.length / per)); hv.page = Math.max(0, Math.min(pages - 1, hv.page));
    const items = list.slice(hv.page * per, hv.page * per + per), top = 58, cw = 190, ch = 150;
    if (!list.length) { T(hv.tab === 'new' ? '새로 들어온 상품이 없어요' : '아직 입고된 상품이 없어요', LW / 2, 120, 15, '#5a6474', 'center', 800); T('시험에 처음 합격하면 신상이 들어와요', LW / 2, 144, 11, '#8a94a4', 'center', 700); }
    items.forEach((it, i) => {
      const cx = 6 + i * (cw + 8), cy = top, isModel = hv.tab === 'model';
      let id, name, sub, eff, isNew, label, key, off, state = '';
      if (isModel) {
        const m = it.m, cur = G.gear.model === it.i, owned = G.gear.model > it.i, next = G.gear.model + 1 === it.i, cost = modelCost(it.i), ok = G.money >= cost;
        id = 'model'; name = m.name; sub = `지능 ${it.i + 1}단계 · ${m.note}`; eff = `지금 시험 AI 정답률 ${Math.round(aiAccuracyAt(CONFIG.tiers[nextTierIndex()], it.i) * 100)}%`; isNew = it.fresh; if (isNew) markShown('model');
        if (cur) { label = '구독 중'; off = true; } else if (owned) { label = '이전 모델'; off = true; } else if (!next) { label = '앞 모델부터'; off = true; } else { label = ok ? `구독 · ${won(cost)}원` : `${won(cost - G.money)}원 모자람`; key = ok ? 'model' : null; off = !ok; }
      } else {
        const d = it, lv = G.gear[d.id], cap = gearCap(d), count = d.kind === 'count', maxed = lv >= cap, cost = gearCost(d.id), ok = !maxed && G.money >= cost, so = soldOut(d), gone = so && G.flags.sold;
        id = d.id; name = count ? botName(lv + 1) : maxed ? gearName(d.id, lv) : gearName(d.id, lv + 1); sub = count ? `${d.name} · 지금 ${lv}명` : `${d.name} · ${lv ? '지금 ' + gearName(d.id, lv) : '아직 없음'}`;
        eff = GEAR_TEXT[d.id](maxed ? lv : lv + 1); isNew = !!G.fresh[d.id]; if (isNew) markShown(d.id);
        if (so) state = gone ? '품절' : '남은 재고 1개';
        if (gone) { label = '품절 · 재입고 미정'; off = true; } else if (maxed) { label = cap >= gearMax(d) ? '최고 사양 보유 중' : '다음 막에 신형 입고'; off = true; } else { label = ok ? `주문 · ${won(cost)}원` : `${won(cost - G.money)}원 모자람`; key = ok ? 'buy:' + d.id : null; off = !ok; }
      }
      R(cx, cy, cw, ch, '#ffffff'); k.frame(cx, cy, cw, ch, off ? '#d0d5de' : '#2a8f9a', 2);
      R(cx + 8, cy + 8, 46, 46, '#eef1f6'); drawGear(k, id, cx + 31, cy + 31, 38, 3);
      if (isNew) { R(cx + cw - 42, cy + 4, 38, 14, '#e8453e'); T('NEW', cx + cw - 23, cy + 11, 10, C.white, 'center', 800); }
      // 이름은 그림 오른쪽에 크게, 구분선 아래 효과는 검은 글씨로 또렷하게, 지금 가진 것은 맨 아래 작게
      const nl = wrap(k, name, cw - 70, 15).slice(0, 2); nl.forEach((ln, j) => T(ln, cx + 62, cy + (nl.length > 1 ? 24 : 32) + j * 18, 15, '#12161f', 'left', 800));
      if (state) { const sw2 = k.TW(state, 10, 800) + 10; R(cx + 8, cy + 58, sw2, 14, state === '품절' ? '#5a6474' : '#e8453e'); T(state, cx + 8 + sw2 / 2, cy + 65, 10, C.white, 'center', 800); }
      R(cx + 8, cy + 60 + (state ? 16 : 0), cw - 16, 1, '#dfe3ea');
      const ty = cy + 74 + (state ? 16 : 0);
      wrap(k, eff, cw - 16, 12).slice(0, state ? 1 : 2).forEach((ln, j) => T(ln, cx + 8, ty + j * 15, 12, '#12161f', 'left', 700));
      T(sub, cx + 8, cy + ch - 40, fitText(k, sub, cw - 16, 10, 8), '#7a8494', 'left', 700);
      btn(k, cx + 6, cy + ch - 30, cw - 12, 24, label, key, { off, bg: '#e8453e', col: '#e8453e', fg: '#ffffff', size: 13 });
    });
    lapFoot(k, hv, '< 바탕화면', '#e3e6ec', pages, 'page');
  }
  function laptop(k, hv, now, hoverXY) { // 노트북 화면 한 장을 그리고 누를 수 있는 칸을 돌려준다 (화면 좌표 400x240)
    btns = []; hover = hoverXY;
    (hv.app === 'shop' ? drawShop : hv.app === 'tg' ? drawTg : drawDesk)(k, hv, now);
    const b = k.b; b.globalAlpha = 0.06; b.fillStyle = '#000000'; for (let y = 0; y < LH; y += 2) b.fillRect(0, y, LW, 0.5); // 주사선
    b.globalAlpha = 0.05; b.fillStyle = '#ffffff'; b.fillRect(0, ((now * 30) % (LH + 60)) - 30, LW, 18); b.globalAlpha = 1;
    if (hover) { const [mx, my] = hover; k.poly([[mx, my], [mx, my + 13], [mx + 4, my + 10], [mx + 10, my + 10]], '#101018'); k.poly([[mx + 1, my + 2], [mx + 1, my + 10], [mx + 3, my + 8], [mx + 7, my + 8]], '#ffffff'); }
    return btns;
  }

  // ---- 벽: 시험 일정표 ----
  function drawBoard(k, r, hv, now) {
    const { R, T } = k, C = PAL, x = Math.round(r.x), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h);
    R(x, y, w, h, '#c79a62'); R(x + 6, y + 6, w - 12, h - 12, '#fbf9f1');
    const maxAct = CONFIG.tiers[G.unlocked - 1].act; hv.act = Math.max(1, Math.min(maxAct, hv.act || maxAct));
    R(x + 6, y + 6, w - 12, 22, '#d9473f'); T(`${CONFIG.acts[hv.act - 1]} 시험 일정표`, x + 14, y + 17, 13, C.white, 'left', 800);
    for (let a = 1; a <= maxAct; a++) btn(k, x + w - 12 - (maxAct - a + 1) * 46, y + 9, 42, 16, `${a}막`, 'act:' + a, { on: a === hv.act, bg: '#8a2a24', col: '#ffffff', fg: '#ffffff', size: 10 });
    const rows = CONFIG.tiers.map((t, i) => ({ t, i })).filter(o => o.t.act === hv.act && o.i <= G.unlocked);
    const top = y + 32, bottom = y + h - 30, rh = 42, per = Math.max(1, Math.floor((bottom - top) / rh)), pages = Math.max(1, Math.ceil(rows.length / per));
    if (hv.bpage == null) hv.bpage = Math.floor(rows.findIndex(o => o.i === nextTierIndex()) / per); // 처음엔 다음 시험이 있는 쪽
    hv.bpage = Math.max(0, Math.min(pages - 1, hv.bpage < 0 ? 0 : hv.bpage));
    const nt = nextTierIndex();
    rows.slice(hv.bpage * per, hv.bpage * per + per).forEach(({ t, i }, n) => {
      const ry = top + n * rh, locked = i > G.unlocked - 1;
      R(x + 10, ry, w - 20, rh - 4, i === nt ? '#fff3c8' : '#f1ede0'); k.frame(x + 10, ry, w - 20, rh - 4, i === nt ? '#d9a02a' : '#d8d2c0', 1);
      R(x + 14, ry + 4, 18, 14, '#2b5f8a'); T(String(i + 1), x + 23, ry + 11, 10, C.white, 'center', 800);
      if (locked) { T('? ? ?', x + 38, ry + 12, 12, '#8a8676', 'left', 800); T('앞 시험에 합격하면 공개', x + 38, ry + 27, 10, '#a09a88', 'left', 700); return; }
      T(t.name + (t.boss ? ' [보스]' : ''), x + 38, ry + 11, 12, '#2a2838', 'left', 800);
      const mech = [...t.mech.filter(m => m !== 'tutorial').map(m => m === 'idcheck' && t.check === 'calc' ? MECH_NAME.calc : MECH_NAME[m]), ...t.sec.map(s => s === 'pulse' && t.pulse ? SEC_NAME[t.pulse] : SEC_NAME[s])];
      const info = `${t.subject} · ${t.qn * (t.parts ? t.parts.length : 1)}문항` + (mech.length ? ` · 유의: ${mech.join(', ')}` : '');
      T(info, x + 38, ry + 27, fitText(k, info, w - 280, 10, 7), mech.length ? '#a04a1a' : '#6c6a80', 'left', 700);
      const fee = examFee(t), ok = G.money >= fee, bw = 124, bx = x + w - 16 - bw;
      const day = new Date(2026, 10, 19 + i * 9); T(`${day.getMonth() + 1}월 ${day.getDate()}일 시행`, bx - 6, ry + 11, 10, '#6c6a80', 'right', 700);
      if (G.cleared[i]) { k.b.save(); k.b.translate(bx - 96, ry + 19); k.b.rotate(-0.12); k.frame(-22, -10, 44, 20, '#d0282a', 2); T('합격', 0, 0, 12, '#d0282a', 'center', 800); k.b.restore(); }
      btn(k, bx, ry + 5, bw, 28, ok ? (G.cleared[i] ? '재응시 접수' : '응시 접수') : '응시료 부족', ok ? 'exam:' + i : null, { off: !ok, bg: '#2b5f8a', col: '#2b5f8a', fg: '#ffffff' });
      T(fee ? `응시료 ${won(fee)}원` : '응시료 없음', bx - 6, ry + 27, 9, '#6c6a80', 'right', 700);
    });
    btn(k, x + 12, y + h - 26, 74, 18, '< 방으로', 'back', { bg: '#2a2838', col: '#2a2838', fg: '#ffffff' });
    if (pages > 1) {
      btn(k, x + w / 2 - 56, y + h - 26, 24, 18, '<', hv.bpage > 0 ? 'bpage:-1' : null, { off: hv.bpage <= 0, bg: '#2a2838', col: '#2a2838', fg: '#ffffff' });
      T(`${hv.bpage + 1} / ${pages}`, x + w / 2, y + h - 17, 10, '#2a2838', 'center', 800);
      btn(k, x + w / 2 + 32, y + h - 26, 24, 18, '>', hv.bpage < pages - 1 ? 'bpage:1' : null, { off: hv.bpage >= pages - 1, bg: '#2a2838', col: '#2a2838', fg: '#ffffff' });
    }
    T(`합격 기준: ${Math.round(tune.pass_mark * 100)}점 이상 · 부정행위 시 무효`, x + w - 14, y + h - 17, 10, '#6c6a80', 'right', 700);
  }

  // ---- 폰: 알림 · 기록 · 설정 ----
  function drawPhone(k, L, hv, now, rise) {
    const { R, T } = k, C = PAL, w = 270, h = 340, x = Math.round(L.W / 2 - w / 2), y = Math.round(10 + (1 - rise) * 360);
    R(x - 6, y - 6, w + 12, h + 12, '#0a0a0e'); R(x - 4, y - 4, w + 8, h + 8, '#1a1a20'); R(x, y, w, h, '#10131c');
    R(x, y, w, 20, '#0a0c12'); T(fmtRun(runSecs()), x + 8, y + 10, 10, C.hud, 'left', 800); T(`${won(STATE.shown)}원`, x + w - 8, y + 10, 11, C.gold, 'right', 800);
    const tw = Math.floor(w / 3), unread = phoneUnread();
    PHONE_TABS.forEach(([key, name], i) => {
      const on = hv.ptab === key, bx = x + i * tw;
      R(bx, y + h - 26, tw, 26, on ? '#1c2230' : '#0a0c12'); if (on) R(bx, y + h - 26, tw, 2, C.hud);
      T(key === 'news' && unread ? `${name} ${unread}` : name, bx + tw / 2, y + h - 13, 11, on ? C.white : '#8fa0b8', 'center', 800);
      btns.push({ x: bx, y: y + h - 26, w: tw, h: 26, key: 'ptab:' + key });
    });
    const top = y + 26, bottom = y + h - 52;
    if (hv.ptab === 'news') {
      const per = 6, list = G.news.slice().reverse(), pages = Math.max(1, Math.ceil(list.length / per)); hv.npage = Math.max(0, Math.min(pages - 1, hv.npage || 0));
      if (!list.length) T('아직 알림이 없어요', x + w / 2, top + 60, 11, '#8fa0b8', 'center', 700);
      list.slice(hv.npage * per, hv.npage * per + per).forEach((n, i) => {
        const ry = top + i * 42, col = { bank: '#f5cc4a', tg: '#5eb5f7', reg: '#f6a234', shop: '#e8453e', model: '#8a5cff', exam: '#2f8a3a', act: '#f5cc4a', bot: '#45e5ee' }[n.kind] || '#8fa0b8';
        R(x + 6, ry, w - 12, 38, '#1a1f2c'); R(x + 6, ry, 3, 38, col);
        T({ bank: '은행', tg: '텔레그램', reg: '뉴스 속보', shop: 'AI마켓', model: 'AI 속보', exam: '시험', act: '새 막', bot: '대리 응시' }[n.kind] || '알림', x + 14, ry + 9, 9, col, 'left', 800);
        T(fmtRun(n.t), x + w - 12, ry + 9, 9, '#5a6474', 'right', 700);
        const ls = wrap(k, n.text, w - 28, 10).slice(0, 2); ls.forEach((ln, j) => T(ln, x + 14, ry + 21 + j * 11, 10, C.white, 'left', 700));
      });
      if (pages > 1) { btn(k, x + 8, bottom + 4, 40, 18, '<', hv.npage > 0 ? 'npage:-1' : null, { off: hv.npage <= 0 }); T(`${hv.npage + 1} / ${pages}`, x + w / 2, bottom + 13, 10, '#8fa0b8', 'center', 700); btn(k, x + w - 48, bottom + 4, 40, 18, '>', hv.npage < pages - 1 ? 'npage:1' : null, { off: hv.npage >= pages - 1 }); }
    } else if (hv.ptab === 'log') {
      const s = G.stats, recs = loadRecords(); let ry = top + 4;
      const row = (a, b, col) => { T(a, x + 12, ry, 10, '#8fa0b8', 'left', 700); T(b, x + w - 12, ry, 10, col || C.white, 'right', 800); ry += 15; };
      T('타임어택', x + 12, ry, 11, C.hud, 'left', 800); ry += 16;
      row(G.run.done ? '이번 기록 (완주)' : '지금까지 걸린 시간', fmtRun(runSecs()), C.gold);
      for (let a = 1; a <= 3; a++) { const sp = actSplit(a); row(CONFIG.acts[a - 1], sp.done ? fmtRun(sp.t) : `${sp.n} / ${sp.total}`, sp.done ? C.white : '#8fa0b8'); }
      row('내 최고 기록', recs.length ? `${recs[0].name} ${fmtRun(recs[0].t)}` : '아직 없음', recs.length ? C.gold : '#8fa0b8');
      ry += 4; T('기록', x + 12, ry, 11, C.hud, 'left', 800); ry += 16;
      row('시험 응시', `${s.exams}번`); row('합격 · 불합격 · 적발', `${s.passes} · ${s.fails} · ${s.caught}`); row('수석 합격(만점)', `${s.tops}번`);
      row('직접 고른 답 · AI가 고른 답', `${s.selfQ} · ${s.aiQ}`); row('낸 응시료', `${won(s.fees)}원`); row('지금까지 번 돈', `${won(s.earned)}원`, C.gold);
      row('AI 모델', CONFIG.models[G.gear.model].name, C.hud);
      row('전수조사 의심', `${Math.round(G.heat * 100)}%`, G.heat >= 0.66 ? C.bad : G.heat >= 0.33 ? C.warn : C.white);
      if (botRate() > 0) row('대리 응시 수입', `초당 ${won(botRate())}원`, C.gold);
    } else {
      let ry = top + 2; const bw = w - 20, b = (label, key, o) => { btn(k, x + 10, ry, bw, 24, label, key, o); ry += 29; };
      b(muted ? '소리 켜기' : '소리 끄기', 'opt:mute');
      if (canFullscreen()) b(isFullscreen() ? '전체 화면 끄기' : '전체 화면 켜기 (F)', 'opt:fs');
      b(G.opts.timer ? '시험 중 타임어택 시계: 켜짐' : '시험 중 타임어택 시계: 꺼짐', 'opt:timer');
      b('저장 코드 복사 (다른 기기로 옮기기)', 'save:export');
      b('저장 코드 붙여넣기', 'save:import');
      b(STATE.wipeArm > 0 ? '정말 지울까요? 한 번 더 누르기' : '저장 지우고 처음부터', 'wipe', { bg: '#2a1218', col: PAL.bad, fg: '#ffd6da' });
      T('← → 고개 · Space 스캔 · 1~4 마킹 · P 일시정지 · M 소리', x + w / 2, ry + 8, 9, '#6f7a8c', 'center', 700);
      T(STATE.standalone ? '홈 화면 앱으로 실행 중' : STATE.ios ? '아이폰: 공유 → 홈 화면에 추가 = 전체 화면' : '', x + w / 2, ry + 22, 9, '#6f7a8c', 'center', 700);
    }
    btn(k, x + w / 2 - 36, y + 2, 72, 16, '< 방으로', 'back', { bg: '#1c2230', col: '#4a5a6a', fg: '#ffffff', size: 10 });
    return { x: x - 6, y: y - 6, w: w + 12, h: h + 12 };
  }

  function screenFx(k, r, now) { // 모니터 느낌: 주사선, 화소 격자, 비스듬한 반사, 가장자리 어둠, 깜빡임
    const x = Math.round(r.x), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h), b = k.b;
    b.save(); b.beginPath(); b.rect(x, y, w, h); b.clip();
    b.globalAlpha = 0.07; b.fillStyle = '#000000'; for (let yy = y; yy < y + h; yy += 2) b.fillRect(x, yy, w, 0.6);
    b.globalAlpha = 0.035; for (let xx = x; xx < x + w; xx += 3) b.fillRect(xx, y, 0.5, h);
    const roll = y + ((now * 46) % (h + 80)) - 40; b.globalAlpha = 0.05; b.fillStyle = '#ffffff'; b.fillRect(x, roll, w, 26); // 천천히 내려가는 밝은 띠
    let gr = b.createLinearGradient(x, y, x + w * 0.7, y + h); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.02)'); gr.addColorStop(0.36, 'rgba(255,255,255,0)'); b.globalAlpha = 1; b.fillStyle = gr; b.fillRect(x, y, w, h);
    gr = b.createRadialGradient(x + w / 2, y + h / 2, h * 0.45, x + w / 2, y + h / 2, w * 0.72); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,10,0.38)'); b.fillStyle = gr; b.fillRect(x, y, w, h);
    b.globalAlpha = 0.02 + 0.015 * Math.sin(now * 50); b.fillStyle = '#9fd0ff'; b.fillRect(x, y, w, h);
    b.restore(); b.globalAlpha = 1;
    if (hover && inR({ x, y, w, h }, hover)) { const [mx, my] = hover; k.poly([[mx, my], [mx, my + 11], [mx + 3, my + 8], [mx + 8, my + 8]], '#101018'); k.poly([[mx + 1, my + 2], [mx + 1, my + 8], [mx + 3, my + 6], [mx + 5, my + 6]], '#ffffff'); } // 마우스 커서
  }
  function paperFx(k, r) { // 종이 느낌: 결, 압정, 접힌 그림자
    const x = Math.round(r.x), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h), b = k.b;
    b.save(); b.beginPath(); b.rect(x, y, w, h); b.clip();
    b.globalAlpha = 0.05; b.fillStyle = '#5a4020'; for (let i = 0; i < 260; i++) b.fillRect(x + (i * 97) % w, y + (i * 61) % h, 2 + (i % 5), 0.6);
    let gr = b.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, 'rgba(0,0,0,0.10)'); gr.addColorStop(0.12, 'rgba(0,0,0,0)'); gr.addColorStop(0.9, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,30,0,0.14)'); b.globalAlpha = 1; b.fillStyle = gr; b.fillRect(x, y, w, h);
    b.globalAlpha = 0.06; b.fillStyle = '#000000'; b.fillRect(x + w / 2 - 0.5, y + 6, 1, h - 12);
    b.restore(); b.globalAlpha = 1;
    for (const px of [x + 16, x + w - 16]) { k.disc(px + 1, y + 9, 5, 'rgba(0,0,0,0.35)'); k.disc(px, y + 8, 5, '#c0392b'); k.disc(px - 1, y + 7, 2, '#f08a7a'); }
  }
  function drawMail(k, L, z) { // 우편으로 온 성적 통지표를 집어 들어 본다
    if (!G.mail) return null;
    if (!STATE.mailImg) { const c = document.createElement('canvas'); c.width = PAPER_W; c.height = PAPER_H; drawResultPaper(c.getContext('2d'), G.mail); STATE.mailImg = c; }
    const h = 336, w = Math.round(h * PAPER_W / PAPER_H), x = Math.round(L.W / 2 - w / 2), y = Math.round(12 + (1 - z) * 360), b = k.b;
    b.save(); b.translate(x + w / 2, y + h / 2); b.rotate(-0.025); b.fillStyle = 'rgba(0,0,0,0.4)'; b.fillRect(-w / 2 + 5, -h / 2 + 6, w, h);
    b.imageSmoothingEnabled = true; b.drawImage(STATE.mailImg, -w / 2, -h / 2, w, h); b.imageSmoothingEnabled = false; b.restore();
    return { x, y, w, h };
  }
  function draw(k, L, hv, now, hoverXY) {
    btns = []; hover = hoverXY; let rect = null;
    const z = hv.zoom * hv.zoom * (3 - 2 * hv.zoom);
    if (hv.view === 'laptop') rect = WORLD.hubRect('laptop'); // 노트북은 3D 화면 표면에 그린다 (laptop)
    else if (hv.view === 'board') { if (hv.zoom >= 1) { rect = WORLD.hubRect('board'); if (rect) { drawBoard(k, rect, hv, now); paperFx(k, rect); } } }
    else if (hv.view === 'mail') rect = drawMail(k, L, z);
    else if (hv.view === 'phone') { rect = drawPhone(k, L, hv, now, z); if (z >= 1) screenFx(k, { x: rect.x + 6, y: rect.y + 6, w: rect.w - 12, h: rect.h - 12 }, now); }
    return { btns, rect };
  }
  return { draw, laptop, LW, LH };
})();
