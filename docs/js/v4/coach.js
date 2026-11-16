/* Hand-holding tutorial ("coach marks"): dims the screen, leaves one pulsing hole around the thing to use,
   shows a short card, and moves on only when the player really does it.
   Design notes (from tutorial UX research):
   - one hint at a time, short text; make the player perform the real action;
   - always skippable and replayable; chapters are short and taught just-in-time;
   - targets are polled (the UI is rebuilt often); a step whose target never shows is skipped or falls back,
     so the overlay can never trap the player. */
(function (g) {
  'use strict';
  const d = document;
  let ctx = null, run = null, ui = null, timer = null;
  const now = () => performance.now();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, k => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[k]));

  /* ---------- target helpers ---------- */
  function rectOf(target) {
    let t = typeof target === 'function' ? target() : target;
    if (!t) return null;
    if (typeof t === 'string') t = d.querySelector(t);
    if (!t) return null;
    if (t.getBoundingClientRect) {
      const b = t.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) return null;
      const cs = getComputedStyle(t);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return null;
      if (b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) return null;
      return {x: b.left, y: b.top, w: b.width, h: b.height, el: t};
    }
    return {x: t.x, y: t.y, w: t.w, h: t.h, el: null};
  }
  const q = sel => d.querySelector(sel);
  const exists = sel => !!rectOf(sel);

  /* ---------- DOM ---------- */
  function build() {
    if (ui) return ui;
    const root = d.createElement('div');
    root.id = 'coach'; root.hidden = true;
    root.innerHTML = `<div class="coach-block" data-b="t"></div><div class="coach-block" data-b="b"></div><div class="coach-block" data-b="l"></div><div class="coach-block" data-b="r"></div><div class="coach-block" data-b="c"></div><div class="coach-ring"></div><div class="coach-card" role="dialog" aria-live="polite"><i class="coach-arrow"></i><small class="coach-count"></small><h3 class="coach-title"></h3><p class="coach-text"></p><div class="coach-hint"></div><div class="coach-actions"></div></div>`;
    d.body.appendChild(root);
    ui = {root, blocks: {t: root.querySelector('[data-b=t]'), b: root.querySelector('[data-b=b]'), l: root.querySelector('[data-b=l]'), r: root.querySelector('[data-b=r]'), c: root.querySelector('[data-b=c]')}, ring: root.querySelector('.coach-ring'), card: root.querySelector('.coach-card'), arrow: root.querySelector('.coach-arrow'), count: root.querySelector('.coach-count'), title: root.querySelector('.coach-title'), text: root.querySelector('.coach-text'), hint: root.querySelector('.coach-hint'), actions: root.querySelector('.coach-actions')};
    for (const k of Object.keys(ui.blocks)) ui.blocks[k].addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); nudge(); });
    ui.actions.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !run) return;
      e.stopPropagation();
      const a = b.dataset.coach;
      if (a === 'next') { try { run.cur.onNext?.(); } catch (er) { console.error(er); } advance(); }
      else if (a === 'skip') stop('skipped');
      else if (a === 'custom') { const st = run.cur, fn = st.buttons?.[Number(b.dataset.i)]?.run; if (fn) fn(); }
    });
    return ui;
  }
  function nudge() { if (!ui) return; ui.card.classList.remove('is-nudge'); void ui.card.offsetWidth; ui.card.classList.add('is-nudge'); }
  function setBlocks(hole, full) {
    const W = innerWidth, H = innerHeight, b = ui.blocks, px = v => Math.round(v) + 'px';
    const set = (el, x, y, w, h) => { el.style.cssText = `left:${px(x)};top:${px(y)};width:${px(Math.max(0, w))};height:${px(Math.max(0, h))};display:${w > 0 && h > 0 ? 'block' : 'none'}`; };
    if (!hole || full === 'all') { set(b.t, 0, 0, W, H); set(b.b, 0, 0, 0, 0); set(b.l, 0, 0, 0, 0); set(b.r, 0, 0, 0, 0); set(b.c, 0, 0, 0, 0); return; }
    set(b.t, 0, 0, W, hole.y);
    set(b.b, 0, hole.y + hole.h, W, H - hole.y - hole.h);
    set(b.l, 0, hole.y, hole.x, hole.h);
    set(b.r, hole.x + hole.w, hole.y, W - hole.x - hole.w, hole.h);
    if (full === 'hole') set(b.c, hole.x, hole.y, hole.w, hole.h); else set(b.c, 0, 0, 0, 0);
  }
  function placeCard(hole, pref) {
    const c = ui.card, W = innerWidth, H = innerHeight, m = 10;
    c.style.maxWidth = Math.min(380, W - 2 * m) + 'px';
    c.style.left = '0px'; c.style.top = '0px';
    const cw = c.offsetWidth, ch = c.offsetHeight;
    if (!hole) { c.style.left = Math.round((W - cw) / 2) + 'px'; c.style.top = Math.round(Math.max(m, (H - ch) / 2)) + 'px'; ui.arrow.style.display = 'none'; return; }
    if (hole.w * hole.h > .5 * W * H) { c.style.left = Math.round(Math.max(m, Math.min(W - cw - m, hole.x + hole.w / 2 - cw / 2))) + 'px'; c.style.top = Math.round(Math.max(m, Math.min(H - ch - m, hole.y + hole.h - ch - 14))) + 'px'; ui.arrow.style.display = 'none'; return; }
    const space = {b: H - (hole.y + hole.h), t: hole.y, r: W - (hole.x + hole.w), l: hole.x};
    const fits = {b: space.b >= ch + 22, t: space.t >= ch + 22, r: space.r >= cw + 22, l: space.l >= cw + 22};
    let side = pref && pref !== 'auto' && fits[pref[0]] ? pref[0] : null;
    if (!side) side = ['b', 't', 'r', 'l'].find(s => fits[s]) || (space.b >= space.t ? 'b' : 't');
    let x, y;
    const cx = hole.x + hole.w / 2, cy = hole.y + hole.h / 2;
    if (side === 'b') { x = cx - cw / 2; y = hole.y + hole.h + 16; }
    else if (side === 't') { x = cx - cw / 2; y = hole.y - ch - 16; }
    else if (side === 'r') { x = hole.x + hole.w + 16; y = cy - ch / 2; }
    else { x = hole.x - cw - 16; y = cy - ch / 2; }
    x = Math.max(m, Math.min(W - cw - m, x)); y = Math.max(m, Math.min(H - ch - m, y));
    c.style.left = Math.round(x) + 'px'; c.style.top = Math.round(y) + 'px';
    const a = ui.arrow; a.style.display = 'block'; a.dataset.side = side;
    if (side === 'b' || side === 't') a.style.left = Math.round(Math.max(18, Math.min(cw - 18, cx - x))) + 'px', a.style.top = '';
    else a.style.top = Math.round(Math.max(18, Math.min(ch - 18, cy - y))) + 'px', a.style.left = '';
  }
  function drawStep(st, rect, idx, total) {
    build();
    const showHole = !!rect, pad = st.pad ?? 7;
    ui.root.hidden = false; ui.root.dataset.mode = st.mode;
    let hole = null;
    if (rect) hole = {x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), w: Math.min(innerWidth, rect.w + 2 * pad), h: Math.min(innerHeight, rect.h + 2 * pad)};
    const dimless = !!st.dimless;
    // blockers: info steps block everything; click steps leave the hole open; wait steps block nothing
    if (st.mode === 'wait' && dimless) { for (const k of Object.keys(ui.blocks)) ui.blocks[k].style.display = 'none'; }
    else if (!hole) setBlocks(null, 'all');
    else setBlocks(hole, st.mode === 'click' ? 'open' : 'hole');
    const ring = ui.ring;
    if (hole) {
      const round = Math.min(hole.w, hole.h) < 96 && hole.w / hole.h > .6 && hole.w / hole.h < 1.7;
      ring.style.cssText = `display:block;left:${Math.round(hole.x)}px;top:${Math.round(hole.y)}px;width:${Math.round(hole.w)}px;height:${Math.round(hole.h)}px;border-radius:${round ? '50%' : '14px'}`;
      ring.classList.toggle('no-dim', dimless || !showHole);
      ring.classList.toggle('is-click', st.mode === 'click' || st.mode === 'wait');
    } else { ring.style.display = 'none'; }
    ui.count.textContent = total > 1 ? `Bước ${idx + 1} / ${total}` : ''; ui.count.style.display = total > 1 ? '' : 'none';
    const tv = typeof st.title === 'function' ? st.title() : st.title, xv = typeof st.text === 'function' ? st.text() : st.text;
    ui.title.textContent = tv || ''; ui.title.style.display = tv ? '' : 'none';
    ui.text.innerHTML = xv || '';
    ui.hint.textContent = st.hint || '';
    ui.hint.style.display = ui.hint.textContent ? '' : 'none';
    const btn = (label, a, i, cls = '') => `<button type="button" class="coach-btn ${cls}" data-coach="${a}" ${i !== undefined ? `data-i="${i}"` : ''}>${esc(label)}</button>`;
    let acts = '';
    if (st.buttons) acts = st.buttons.map((b, i) => btn(b.label, 'custom', i, b.primary ? 'primary' : '')).join('');
    else { if (st.mode === 'info') acts += btn(st.nextLabel || 'Tiếp →', 'next', undefined, 'primary'); }
    if (st.mode === 'wait' && !st.buttons) acts += btn('Bỏ qua bước này', 'next', undefined, 'ghost');
    if (!st.noSkip) acts = btn('Bỏ qua hướng dẫn', 'skip', undefined, 'ghost') + acts;
    if (ui.actions.dataset.k !== acts) { ui.actions.innerHTML = acts; ui.actions.dataset.k = acts; }
    placeCard(showHole ? hole : null, st.place);
  }
  function hideUi() { if (ui) { ui.root.hidden = true; ui.actions.dataset.k = ''; } }

  /* ---------- engine ---------- */
  function advance() { if (!run) return; run.i++; enter(); }
  function enter() {
    if (!run) return;
    while (run.i < run.steps.length) {
      const st = run.steps[run.i];
      if (st.skipIf && st.skipIf()) { run.i++; continue; }
      break;
    }
    if (run.i >= run.steps.length) { stop('done'); return; }
    const st = run.cur = run.steps[run.i];
    run.t0 = now(); run.clicked = null; run.lastSeen = now(); run.scrolled = false; run.fell = false; run.shown = false; run.lostAt = null; run.triedScroll = false; hideUi();
    try { st.enter?.(); } catch (e) { console.error(e); }
  }
  function tick() {
    if (!run) return;
    const st = run.cur; if (!st) return;
    const t = now();
    if (run.clicked && t - run.clicked > 90) { run.clicked = null; advance(); return; }
    if (st.done && st.done()) { advance(); return; }
    const ready = !st.ready || st.ready();
    let rect = st.target !== undefined && st.target !== null ? rectOf(st.target) : null;
    let needsTarget = st.target !== undefined && st.target !== null;
    if (needsTarget && !rect && st.fallbackCenter && now() - run.t0 > (st.timeout ?? 2500)) needsTarget = false;
    if (ready && needsTarget && !rect && !run.triedScroll) {
      run.triedScroll = true;
      try { let el = typeof st.target === 'function' ? st.target() : st.target; if (typeof el === 'string') el = d.querySelector(el); if (el && el.scrollIntoView) el.scrollIntoView({block: 'center', inline: 'center'}); } catch {}
    }
    if (!ready || (needsTarget && !rect)) {
      if (run.shown) { if (t - run.lastSeen > (st.grace ?? 700)) { hideUi(); run.shown = false; run.lostAt = t; } }
      else hideUi();
      const waited = t - (run.lostAt ?? run.t0), limit = run.lostAt ? Math.min(st.timeout ?? 5000, 2500) : (st.timeout ?? 5000);
      if (waited > limit) {
        if (st.fallback && !run.fell) { run.fell = true; run.lostAt = null; run.t0 = t; try { st.fallback(); } catch (e) { console.error(e); } }
        else { run.i++; enter(); }
      }
      return;
    }
    run.lostAt = null;
    if (st.silent) { hideUi(); run.shown = false; if (st.maxWait && t - run.t0 > st.maxWait) advance(); return; }
    run.lastSeen = t; run.shown = true;
    if (rect?.el && !run.scrolled) { run.scrolled = true; try { rect.el.scrollIntoView({block: 'nearest', inline: 'nearest'}); } catch {} }
    drawStep(st, rect, run.shownIdx(), run.total);
  }
  function onClick(e) {
    if (!run || !run.cur || run.cur.mode !== 'click' || !run.shown) return;
    if (e.target?.closest?.('#coach')) return;
    const st = run.cur, r = rectOf(st.target);
    if (!r) return;
    const px = e.clientX, py = e.clientY, hasPoint = px || py;
    const onTarget = r.el ? (r.el === e.target || r.el.contains(e.target)) : (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
    // the spotlight hole is a little bigger than the thing to press: a tap in that margin must never reach what is underneath
    const pad = st.pad ?? 7, inHole = hasPoint && px >= r.x - pad && px <= r.x + r.w + pad && py >= r.y - pad && py <= r.y + r.h + pad;
    if (!onTarget) { if (inHole) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); nudge(); } return; }
    if (!st.done) run.clicked = now();
  }
  function onKey(e) {
    if (!run || !run.cur) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); stop('skipped'); return; }
    if (!run.shown || run.cur.mode === 'wait' || e.target?.closest?.('#coach')) return;
    if (['Tab', 'F5', 'F11', 'F12'].includes(e.key) || e.ctrlKey || e.metaKey) return;
    e.stopPropagation(); e.preventDefault();
  }
  function start(id, opts = {}) {
    if (!ctx || run) return false;
    if (d.body.classList.contains('title-mode') || g.VTNStory?.isActive?.() || d.querySelector('#story-overlay.is-active')) return false;
    const ch = chapters()[id]; if (!ch) return false;
    const steps = ch.steps(ctx).filter(Boolean);
    const visible = steps.filter(s => !s.silent);
    run = {id, steps, i: 0, total: visible.length, opts, shown: false, shownIdx() { return Math.max(0, steps.slice(0, this.i).filter(s => !s.silent).length); }};
    build();
    ctx.onStart?.(id);
    enter();
    timer = setInterval(tick, 90);
    tick();
    return true;
  }
  function stop(reason) {
    if (!run) return;
    const r = run; run = null;
    clearInterval(timer); timer = null; hideUi();
    try { ctx.onStop?.(r.id, reason); } catch (e) { console.error(e); }
  }
  const active = () => !!run;

  /* ---------- chapters ---------- */
  const click = (sel, title, text, extra = {}) => ({mode: 'click', target: sel, title, text, ...extra});
  const info = (sel, title, text, extra = {}) => ({mode: 'info', target: sel, title, text, ...extra});
  const modalOpen = () => d.getElementById('overlay')?.classList.contains('open');
  const modalTitle = () => d.getElementById('modal-title')?.textContent || '';
  const navTarget = act => `#nav [data-act="${act}"]`;
  const fallbackAct = (a, id) => () => ctx.act(a, id);
  const extraOpen = () => exists('#nav-extra button');
  const more = what => click('#nav .nav-more', 'Mở thêm menu', 'Các mục còn lại nằm trong <b>☰ Thêm</b>. Bấm vào đó để mở (' + what + ').', {skipIf: extraOpen, ready: () => exists('#nav .nav-more'), fallback: () => d.querySelector('#nav .nav-more')?.click(), timeout: 2500, done: extraOpen});

  function chapters() {
    return {
      basics: {
        title: 'Cơ bản', blurb: 'Di chuyển, nhiệm vụ, đội hình, menu.', steps: c => [
          {mode: 'info', title: 'Hướng dẫn cơ bản', text: 'Di chuyển, nhiệm vụ, đội hình và menu.', target: null, skipIf: () => c.chain(),
            buttons: [{label: 'Bắt đầu', primary: true, run: () => advance()}, {label: 'Để sau', run: () => stop('skipped')}], noSkip: true},
          info('#objective', 'Nhiệm vụ', 'Nhiệm vụ hiện tại. Bấm <b>Tự tìm đường</b> để nhân vật tự đi tới đó.', {pad: 10, target: () => q('#objective')?.closest('section')}),
          {mode: 'wait', target: () => c.heroRect(), dimless: true, title: 'Di chuyển', text: 'Bấm vào mặt đất hoặc dùng <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> để đi.', place: 't',
            enter() { const s = c.S(); this.x0 = s.x; this.y0 = s.y; this.m0 = s.mapId; }, done() { const s = c.S(); return s.mapId !== this.m0 || Math.abs(s.x - this.x0) + Math.abs(s.y - this.y0) >= 3; }, timeout: 8000},
          click(navTarget('journal'), 'Hành trình', 'Bấm <b>Hành trình</b>.', {fallback: fallbackAct('journal'), timeout: 3500, done: () => modalOpen() && /Hành Trình/i.test(modalTitle())}),
          info('#content > :first-child', 'Sổ Hành Trình', 'Nhiệm vụ, manh mối và nút <b>Tự tìm đường</b> cho từng việc.', {place: 'top', ready: () => modalOpen()}),
          click('#close-modal', null, 'Bấm <b>Đóng</b>.', {fallback: () => c.act('close'), timeout: 3000, done: () => !modalOpen()}),
          click(navTarget('party'), 'Đội hình', 'Bấm <b>Đội hình</b>.', {fallback: fallbackAct('party'), timeout: 3500, done: () => modalOpen() && /Đội hình/i.test(modalTitle())}),
          info('#content [data-act="manage"]', 'Quản lý khế thú', 'Xem chỉ số, đổi kỹ năng, cho ăn, tiến hóa.', {ready: () => modalOpen()}),
          click('#close-modal', null, 'Bấm <b>Đóng</b>.', {fallback: () => c.act('close'), timeout: 3000, done: () => !modalOpen()}),
          info('#hunt-card', 'Khu săn', 'Quái trong vùng và tỉ lệ gặp. Bấm nút tự tìm để đi săn.', {skipIf: () => !exists('#hunt-card'), place: 'l'}),
          more('Lưu và thoát'),
          info(navTarget('saves'), 'Lưu và thoát', 'Trò chơi tự lưu. <b>Lưu / Tải</b> để lưu thủ công, <b>Thoát</b> để về menu chính.'),
          {mode: 'info', title: 'Trận luyện tập', text: 'Học ra đòn, dùng vật phẩm và thu phục trong một trận không thể thua.', target: null, noSkip: true, skipIf: () => c.chain(),
            buttons: [{label: 'Bắt đầu', primary: true, run: () => { stop('done'); setTimeout(() => c.startLesson(), 60); }}, {label: 'Để sau', run: () => stop('done')}]},
        ]
      },
      first: {
        hidden: true, title: 'Trận đầu tiên', blurb: '', steps: c => [
          {mode: 'info', title: 'Trận đầu tiên', text: 'Một sinh linh mất tim chặn đường. Hãy lập <b>Khế Hồn</b> để trả lại trái tim cho nó.', target: null,
            buttons: [{label: 'Chiến đấu', primary: true, run: () => { stop('done'); setTimeout(() => c.startLesson(), 60); }}]},
        ]
      },
      tour: {
        hidden: true, title: 'Làm quen', blurb: '', steps: c => [
          info('#objective', 'Nhiệm vụ', 'Nhiệm vụ hiện tại. Bấm <b>Tự tìm đường</b> để nhân vật tự đi tới đó.', {pad: 10, target: () => q('#objective')?.closest('section')}),
          {mode: 'wait', target: () => c.heroRect(), dimless: true, title: 'Di chuyển', text: 'Bấm vào mặt đất hoặc dùng <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> để đi.', place: 't',
            enter() { const s = c.S(); this.x0 = s.x; this.y0 = s.y; this.m0 = s.mapId; }, done() { const s = c.S(); return s.mapId !== this.m0 || Math.abs(s.x - this.x0) + Math.abs(s.y - this.y0) >= 3; }, timeout: 8000},
          click(navTarget('party'), 'Đội hình', 'Bấm <b>Đội hình</b> để xem khế thú vừa thu phục.', {fallback: fallbackAct('party'), timeout: 3500, done: () => modalOpen() && /Đội hình/i.test(modalTitle())}),
          info('#content [data-act="manage"]', 'Quản lý khế thú', 'Xem chỉ số, đổi kỹ năng, cho ăn, tiến hóa.', {ready: () => modalOpen(), nextLabel: 'Tiếp →', onNext: () => c.act('close')}),
          more('Lưu và thoát'),
          info(navTarget('saves'), 'Lưu và thoát', 'Trò chơi tự lưu. <b>Lưu / Tải</b> để lưu thủ công, <b>Thoát</b> để về menu chính.'),
          {mode: 'info', title: 'Hoàn tất', text: 'Hướng dẫn chi tiết hơn ở <b>☰ Thêm → Hướng dẫn</b>.', target: null, nextLabel: 'Xong', noSkip: true},
        ]
      },
      battle: {
        title: 'Chiến đấu và thu phục', blurb: 'Ra đòn, vật phẩm, thu phục trong một trận luyện tập.', practice: true, steps: c => {
          const B = () => c.B(), mine = () => B() && !B().acted && B().waitingUid && B().panel !== 'iteminfo';
          const heroTurn = () => mine() && B().waitingUid === 'hero';
          const list = [
            info('.battle-party-panel', 'Đội hình', 'Bấm một thẻ để chọn người ra đòn. Từ hai đối thủ trở lên, cả đội đều được đi.', {ready: () => B() && mine() && !!q('.battle-party-panel'), place: 'r'}),
            click('.battle-command-row [data-id="skills"]', 'Tấn công', 'Bấm <b>Tấn công</b>.', {ready: mine, done: () => B()?.panel === 'skills'}),
            click(() => q('.battle-skill-card:not(.is-empty):not(.is-disabled):not(.battle-basic-strike)') || q('.battle-basic-strike'), 'Kỹ năng', 'Chọn một kỹ năng. <b>Hiệu quả ×2</b> là khắc hệ. <b>Đòn thường</b> không tốn MP.', {ready: () => B()?.panel === 'skills' && mine(), place: 't'}),
            {mode: 'wait', target: null, silent: true, ready: () => true, done: () => mine() || !B(), timeout: 9000, text: '', dimless: true},
            click('.battle-party-card[data-id="actor|hero"]', 'Chọn nhân vật', 'Bấm thẻ nhân vật. Chỉ nhân vật dùng được vật phẩm và Khế Hồn.', {skipIf: () => !B() || B().waitingUid === 'hero', ready: () => mine(), done: () => B()?.waitingUid === 'hero' || !B()}),
            click('.battle-command-row [data-id="items"]', 'Vật phẩm', 'Bấm <b>Vật phẩm</b>.', {enter: () => c.battleRoot(), ready: heroTurn, done: () => B()?.panel === 'items'}),
            click('.battle-info-button', 'Chi tiết', 'Bấm <b>i</b> để xem tác dụng.', {ready: () => B()?.panel === 'items', done: () => B()?.panel === 'iteminfo'}),
            info('.battle-item-info', 'Mô tả vật phẩm', 'Tác dụng, số lượng và nút Dùng.', {ready: () => B()?.panel === 'iteminfo', place: 't', nextLabel: 'Tiếp →', onNext: () => c.battleRoot()}),
            click('.battle-command-row [data-id="capture"]', 'Khế Hồn', 'Bấm <b>Khế Hồn</b> để thu phục kẻ địch.', {enter: () => c.battleRoot(), ready: () => heroTurn() && B()?.panel === 'root', done: () => B()?.panel === 'capture'}),
            click('.battle-item-cell > button:first-child:not(:disabled)', 'Phong ấn', () => B()?.practice ? 'Tỉ lệ thành công ghi trên mỗi nút. Lần này chắc chắn thành công, hãy bấm một phong ấn.' : 'Tỉ lệ thành công ghi trên mỗi nút. Bấm một phong ấn để ném.', {ready: () => B()?.panel === 'capture', place: 't', done: () => !B()}),
            info('#content .collectible', 'Thu phục thành công', 'Khế thú mới đã vào đội.', {skipIf: () => !!B() || !(modalOpen() && q('#content .collectible')), ready: () => modalOpen() && !!q('#content .collectible'), place: 'l', timeout: 4000, nextLabel: 'Tiếp →', onNext: () => c.act('close')}),
            {mode: 'info', title: 'Hoàn tất', text: 'Còn <b>Đổi vị trí</b>, <b>Phòng thủ</b> và <b>Thêm</b> (Quan sát, Bỏ chạy). Nút <b>?</b> trong trận nhắc lại cách chơi.', target: null, nextLabel: 'Xong', noSkip: true, skipIf: () => c.chain()},
          ];
          const cut = list.findIndex(x => x.title === 'Thu phục thành công');
          list.forEach((x, i) => { if (i < cut) { const o = x.skipIf; x.skipIf = o ? () => !B() || o() : () => !B(); } });
          return list;
        }
      },
      manage: {
        title: 'Quản lý khế thú', blurb: 'Chỉ số, bốn kỹ năng, nuôi dưỡng, tiến hóa.', steps: c => [
          click(navTarget('party'), 'Đội hình', 'Bấm <b>Đội hình</b>.', {fallback: fallbackAct('party'), timeout: 3500, done: () => modalOpen() && /Đội hình/i.test(modalTitle())}),
          info('#content [data-act="party-tab"]', 'Mang theo và kho', 'Mang theo tối đa 5 khế thú, còn lại ở kho.', {ready: () => modalOpen(), place: 'b'}),
          click('#content [data-act="manage"]', 'Quản lý', 'Bấm <b>Quản lý</b>.', {done: () => /Quản lý/.test(modalTitle())}),
          info('#content .mg-head', 'Hồ sơ', 'Cấp, kinh nghiệm, tính cách, tiềm lực và gắn kết.', {ready: () => !!q('#content .mg-head')}),
          info('#content .mg-stats', 'Chỉ số', 'HP, MP và tám chỉ số sức mạnh.', {place: 'b'}),
          info('#content .mg-slots', 'Bốn kỹ năng', 'Bấm một ô rồi chọn kỹ năng đã học để đổi. Không đổi được trong trận.', {place: 'b'}),
          info('#content .mg-learned', 'Kỹ năng đã học', 'Kỹ năng mới học khi lên cấp.', {place: 't', skipIf: () => !exists('#content .mg-learned')}),
          info('#content .mg-feed', 'Nuôi dưỡng', 'Thức ăn tăng gắn kết, vật phẩm kinh nghiệm giúp lên cấp.', {skipIf: () => !exists('#content .mg-feed'), place: 't'}),
          info('#content .mg-evo', 'Tiến hóa', 'Nút Tiến hóa sáng lên khi đủ điều kiện.', {skipIf: () => !exists('#content .mg-evo'), place: 't'}),
          click('#close-modal', null, 'Bấm <b>Đóng</b>.', {fallback: () => c.act('close'), timeout: 3000, done: () => !modalOpen()}),
        ]
      },
      hero: {
        title: 'Nhân vật và hành trang', blurb: 'Chỉ số, kỹ năng, vật phẩm, cửa hàng, Bảo Vật Chí.', steps: c => [
          more('Nhân vật'),
          click(navTarget('hero'), 'Nhân vật', 'Bấm <b>Nhân vật</b>.', {fallback: fallbackAct('hero'), timeout: 3500, done: () => modalOpen() && /Nhân vật/i.test(modalTitle())}),
          info('#content [data-act="stat"]', 'Điểm chỉ số', 'Mỗi cấp nhận điểm chỉ số. Bấm <b>+1</b> vào chỉ số muốn tăng.', {ready: () => modalOpen(), place: 'b'}),
          info('#content [data-act="loadout-menu"]', 'Bộ kỹ năng', 'Chọn bốn kỹ năng mang vào trận.', {skipIf: () => !exists('#content [data-act="loadout-menu"]'), place: 'b'}),
          click('#close-modal', null, 'Bấm <b>Đóng</b>.', {fallback: () => c.act('close'), timeout: 3000, done: () => !modalOpen()}),
          click(navTarget('bag'), 'Hành trang', 'Bấm <b>Hành trang</b>.', {fallback: fallbackAct('bag'), timeout: 3500, done: () => modalOpen() && /Hành Trang/i.test(modalTitle())}),
          info('#content [data-act="use"]', 'Dùng vật phẩm', 'Bấm <b>Sử dụng</b> để dùng, <b>Chi tiết</b> để xem tác dụng.', {ready: () => modalOpen(), skipIf: () => !exists('#content [data-act="use"]'), place: 'b'}),
          info('#content [data-act="shop"]', 'Cửa hàng', 'Mua phong ấn và thuốc bằng tro vàng.', {skipIf: () => !exists('#content [data-act="shop"]'), place: 't'}),
          click('#close-modal', null, 'Bấm <b>Đóng</b>.', {fallback: () => c.act('close'), timeout: 3000, done: () => !modalOpen()}),
          more('Bảo Vật Chí'),
          click(navTarget('items-codex'), 'Bảo Vật Chí', 'Bấm <b>Bảo Vật Chí</b>.', {fallback: fallbackAct('items-codex'), timeout: 3500, done: () => modalOpen() && /Bảo Vật/i.test(modalTitle())}),
          info('#content .codex-card', 'Chi tiết vật phẩm', 'Bấm một thẻ để xem tác dụng. Trang bị có thể mặc, rèn, khảm ngọc.', {ready: () => modalOpen(), place: 'b'}),
          click('#close-modal', null, 'Bấm <b>Đóng</b>.', {fallback: () => c.act('close'), timeout: 3000, done: () => !modalOpen()}),
          {mode: 'info', title: 'Hoàn tất hướng dẫn', text: 'Mở lại bất cứ lúc nào ở <b>☰ Thêm → Hướng dẫn</b>.', target: null, nextLabel: 'Xong', noSkip: true, skipIf: () => !c.chain()},
        ]
      },
    };
  }
  const list = () => Object.entries(chapters()).filter(([, ch]) => !ch.hidden).map(([id, ch]) => ({id, title: ch.title, blurb: ch.blurb, practice: !!ch.practice}));
  function init(c) { ctx = c; d.addEventListener('click', onClick, true); d.addEventListener('keydown', onKey, true); }
  g.VTNCoach = {init, start, stop, active, list, current: () => run?.id || null};
})(window);
