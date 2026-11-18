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

  // ---- 노트북: AI마켓 ----
  function drawShop(k, r, hv, now) {
    const { R, T } = k, C = PAL, x = Math.round(r.x), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h);
    R(x, y, w, h, '#f3f4f7');
    R(x, y, w, 24, '#0f1722'); T('AI마켓', x + 10, y + 12, 14, C.hud, 'left', 800);
    R(x + 78, y + 5, 150, 14, '#1c2634'); T('시험 전 총알배송 · 부품 검색', x + 84, y + 12, 9, '#6f8094', 'left', 700);
    T(`내 통장 ${won(STATE.shown)}원`, x + w - 8, y + 12, 11, C.gold, 'right', 800);
    // 탭
    const fresh = shopNewCount(), tw = Math.floor((w - 16) / 4);
    SHOP_TABS.forEach(([key, name], i) => {
      const on = hv.tab === key, bx = x + 8 + i * tw, label = key === 'new' && fresh ? `${name} ${fresh}` : name;
      R(bx, y + 28, tw - 4, 18, on ? '#ffffff' : '#dfe3ea'); if (on) R(bx, y + 28, tw - 4, 2, '#e8453e');
      T(label, bx + (tw - 4) / 2, y + 37, 11, on ? '#1d2433' : '#5a6474', 'center', 800);
      if (key === 'new' && fresh && !on) R(bx + tw - 12, y + 31, 4, 4, '#e8453e');
      btns.push({ x: bx, y: y + 28, w: tw - 4, h: 18, key: 'tab:' + key });
    });
    const top = y + 50, bottom = y + h - 26, list = shopItems(hv.tab), per = hv.tab === 'model' ? 4 : 4;
    const pages = Math.max(1, Math.ceil(list.length / per)); hv.page = Math.max(0, Math.min(pages - 1, hv.page));
    const items = list.slice(hv.page * per, hv.page * per + per);
    if (!list.length) {
      T(hv.tab === 'new' ? '새로 들어온 상품이 없어요' : '아직 입고된 상품이 없어요', x + w / 2, (top + bottom) / 2 - 8, 12, '#5a6474', 'center', 800);
      T('시험에 처음 합격하면 신상이 입고돼요', x + w / 2, (top + bottom) / 2 + 10, 10, '#8a94a4', 'center', 700);
    } else if (hv.tab === 'model') {
      const rh = Math.floor((bottom - top) / 4);
      items.forEach((it, i) => {
        const ry = top + i * rh, m = it.m, cur = G.gear.model === it.i, owned = G.gear.model > it.i, next = G.gear.model + 1 === it.i;
        R(x + 8, ry, w - 16, rh - 4, cur ? '#e6fbfd' : '#ffffff'); k.frame(x + 8, ry, w - 16, rh - 4, cur ? '#2a8f9a' : '#d0d5de', 1);
        drawGear(k, 'model', x + 28, ry + (rh - 4) / 2, 26, it.i);
        T(m.name, x + 50, ry + 14, fitText(k, m.name, w - 240, 13), '#1d2433', 'left', 800);
        T(`지능 ${it.i + 1}단계 · ${m.note}`, x + 50, ry + 30, 10, '#5a6474', 'left', 700);
        if (rh > 54) T(`지금 시험에서 AI 정답률 ${Math.round(aiAccuracyAt(CONFIG.tiers[nextTierIndex()], it.i) * 100)}%`, x + 50, ry + 44, 10, '#2a8f9a', 'left', 700);
        if (it.fresh) { R(x + w - 46, ry + 3, 30, 12, '#e8453e'); T('NEW', x + w - 31, ry + 9, 9, C.white, 'center', 800); markShown('model'); }
        const bw = 128, bx = x + w - 16 - bw, by = ry + rh - 4 - 26;
        if (cur) btn(k, bx, by, bw, 20, '구독 중', null, { on: true });
        else if (owned) btn(k, bx, by, bw, 20, '이전 모델', null, { off: true });
        else if (next) { const cost = modelCost(it.i), ok = G.money >= cost; btn(k, bx, by, bw, 20, ok ? `구독 ${won(cost)}원` : `${won(cost)}원 모자람`, ok ? 'model' : null, { off: !ok, bg: '#e8453e', col: '#e8453e', fg: '#ffffff' }); }
        else btn(k, bx, by, bw, 20, '앞 모델부터', null, { off: true });
      });
    } else {
      const cw = Math.floor((w - 24) / 2), ch = Math.floor((bottom - top - 4) / 2);
      items.forEach((d, i) => {
        const cx = x + 8 + (i % 2) * (cw + 8), cy = top + Math.floor(i / 2) * (ch + 4), lv = G.gear[d.id], cap = gearCap(d), count = d.kind === 'count';
        const maxed = lv >= cap, cost = gearCost(d.id), ok = !maxed && G.money >= cost, isNew = !!G.fresh[d.id];
        R(cx, cy, cw, ch, '#ffffff'); k.frame(cx, cy, cw, ch, ok ? '#2a8f9a' : '#d0d5de', 1);
        R(cx + 6, cy + 6, 34, 34, '#eef1f6'); drawGear(k, d.id, cx + 23, cy + 23, 28, lv + 1);
        const name = count ? botName(lv + 1) : maxed ? gearName(d.id, lv) : gearName(d.id, lv + 1);
        T(name, cx + 46, cy + 13, fitText(k, name, cw - 52 - (isNew ? 30 : 0), 12, 9), '#1d2433', 'left', 800);
        T(count ? `${d.name} · 지금 ${lv}명` : `${d.name} · ${lv ? `지금 ${gearName(d.id, lv)}` : '아직 없음'}`, cx + 46, cy + 28, fitText(k, `${d.name} · 지금 ${lv ? gearName(d.id, lv) : '아직 없음'}`, cw - 52, 10), '#6a7484', 'left', 700);
        if (isNew) { R(cx + cw - 34, cy + 5, 28, 12, '#e8453e'); T('NEW', cx + cw - 20, cy + 11, 9, C.white, 'center', 800); markShown(d.id); }
        const eff = maxed ? GEAR_TEXT[d.id](lv) : GEAR_TEXT[d.id](lv + 1), el = wrap(k, eff, cw - 14, 10).slice(0, 2);
        el.forEach((ln, j) => T(ln, cx + 8, cy + 50 + j * 13, 10, '#17616a', 'left', 800));
        if (ch > 112) T(GEAR_REVIEW[d.id] || '', cx + 8, cy + 50 + el.length * 13 + 2, 9, '#9a8a5a', 'left', 700);
        const by = cy + ch - 26;
        if (maxed) btn(k, cx + 6, by, cw - 12, 20, cap >= gearMax(d) ? '최고 사양 보유 중' : '다음 막에서 신형 입고', null, { off: true });
        else btn(k, cx + 6, by, cw - 12, 20, ok ? `주문하기 · ${won(cost)}원` : `${won(cost)}원 · ${won(cost - G.money)}원 모자람`, ok ? 'buy:' + d.id : null, { off: !ok, bg: '#e8453e', col: '#e8453e', fg: '#ffffff' });
      });
    }
    // 아래 줄
    R(x, y + h - 22, w, 22, '#e3e6ec');
    btn(k, x + 6, y + h - 19, 74, 16, '< 방으로', 'back', { bg: '#1d2433', col: '#1d2433', fg: '#ffffff' });
    if (pages > 1) {
      btn(k, x + w / 2 - 56, y + h - 19, 24, 16, '<', hv.page > 0 ? 'page:-1' : null, { off: hv.page <= 0, bg: '#1d2433', col: '#1d2433', fg: '#ffffff' });
      T(`${hv.page + 1} / ${pages}`, x + w / 2, y + h - 11, 10, '#1d2433', 'center', 800);
      btn(k, x + w / 2 + 32, y + h - 19, 24, 16, '>', hv.page < pages - 1 ? 'page:1' : null, { off: hv.page >= pages - 1, bg: '#1d2433', col: '#1d2433', fg: '#ffffff' });
    }
    const n = hv.order.length;
    T(n ? `주문 ${n}건 · 방으로 나가면 택배가 와요` : botRate() > 0 ? `대리 응시 초당 ${won(botRate())}원` : '', x + w - 8, y + h - 11, 10, n ? '#c0392b' : '#5a6474', 'right', 800);
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
      const info = `${t.qn * (t.parts ? t.parts.length : 1)}문제 · 감독 ${t.staff.length}명` + (mech.length ? ` · ${mech.join(' · ')}` : '');
      T(info, x + 38, ry + 27, fitText(k, info, w - 280, 10, 7), mech.length ? '#a04a1a' : '#6c6a80', 'left', 700);
      const fee = examFee(t), ok = G.money >= fee, bw = 124, bx = x + w - 16 - bw;
      T(G.cleared[i] ? `합격 ${G.best[i]}점` : `AI 정답률 ${Math.round(aiAccuracy(t) * 100)}%`, bx - 6, ry + 11, 10, G.cleared[i] ? '#2f8a3a' : '#17616a', 'right', 800);
      btn(k, bx, ry + 5, bw, 28, ok ? (fee ? `응시 · ${won(fee)}원` : '응시 · 무료') : `응시료 ${won(fee)}원 모자람`, ok ? 'exam:' + i : null, { off: !ok, bg: '#2b5f8a', col: '#2b5f8a', fg: '#ffffff' });
      T(`문제당 ${won(t.reward * tune.reward_scale)}원`, bx - 6, ry + 27, 9, '#9a7a1a', 'right', 800);
    });
    btn(k, x + 12, y + h - 26, 74, 18, '< 방으로', 'back', { bg: '#2a2838', col: '#2a2838', fg: '#ffffff' });
    if (pages > 1) {
      btn(k, x + w / 2 - 56, y + h - 26, 24, 18, '<', hv.bpage > 0 ? 'bpage:-1' : null, { off: hv.bpage <= 0, bg: '#2a2838', col: '#2a2838', fg: '#ffffff' });
      T(`${hv.bpage + 1} / ${pages}`, x + w / 2, y + h - 17, 10, '#2a2838', 'center', 800);
      btn(k, x + w / 2 + 32, y + h - 26, 24, 18, '>', hv.bpage < pages - 1 ? 'bpage:1' : null, { off: hv.bpage >= pages - 1, bg: '#2a2838', col: '#2a2838', fg: '#ffffff' });
    }
    T(`만점이면 상금 x${tune.jackpot_mult} · 합격선 ${Math.round(tune.pass_mark * 100)}점`, x + w - 14, y + h - 17, 10, '#6c6a80', 'right', 700);
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
        const ry = top + i * 42, col = { shop: '#e8453e', model: '#8a5cff', exam: '#2f8a3a', act: '#f5cc4a', bot: '#45e5ee' }[n.kind] || '#8fa0b8';
        R(x + 6, ry, w - 12, 38, '#1a1f2c'); R(x + 6, ry, 3, 38, col);
        T({ shop: 'AI마켓', model: 'AI 속보', exam: '시험', act: '새 막', bot: '대리 응시' }[n.kind] || '알림', x + 14, ry + 9, 9, col, 'left', 800);
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

  function draw(k, L, hv, now, hoverXY) {
    btns = []; hover = hoverXY; let rect = null;
    const z = hv.zoom * hv.zoom * (3 - 2 * hv.zoom);
    if (hv.view === 'laptop') { if (hv.zoom >= 1) { rect = WORLD.hubRect('laptop'); if (rect) drawShop(k, rect, hv, now); } }
    else if (hv.view === 'board') { if (hv.zoom >= 1) { rect = WORLD.hubRect('board'); if (rect) drawBoard(k, rect, hv, now); } }
    else if (hv.view === 'phone') rect = drawPhone(k, L, hv, now, z);
    return { btns, rect };
  }
  return { draw };
})();
