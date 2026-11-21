/* Chế độ điện thoại: chỉ chơi ngang. Trình duyệt dùng khung thiết kế 1024px rồi tự co vừa chiều rộng điện thoại
   (giống bản máy tính thu nhỏ, mọi bảng vừa màn hình ngang). Màn hình tiêu đề có nút bật/tắt chế độ này.
   Kiểu dáng nằm trong css/phone.css dưới body.phone. */
(function (g) {
  'use strict';
  const doc = g.document;
  if (!doc) return;
  const DESIGN_WIDTH = 1024;
  const mm = q => !!(g.matchMedia && g.matchMedia(q).matches);
  const prefs = () => (g.VTNPrefs && g.VTNPrefs.get()) || {};
  const MODES = ['auto', 'on', 'off'], MODE_NAME = {auto: 'Tự động', on: 'Bật', off: 'Tắt'};
  let pad = null, rotate = null, toggle = null, timer = 0, lastActive = null;

  // Điện thoại: màn hình cảm ứng có cạnh ngắn <= 520 (dùng kích thước thiết bị, không phụ thuộc khung thiết kế)
  function detect() {
    const touch = mm('(pointer:coarse)') || ('ontouchstart' in g && !mm('(pointer:fine)')) || (g.navigator && g.navigator.maxTouchPoints > 0 && !mm('(pointer:fine)'));
    const s = g.screen || {};
    const short = Math.min(s.width || g.innerWidth, s.height || g.innerHeight);
    return !!touch && short <= 520;
  }
  function active() {
    const mode = prefs().phoneMode || 'auto';
    return mode === 'on' || (mode !== 'off' && detect());
  }

  function setViewport(on) {
    const meta = doc.querySelector('meta[name=viewport]');
    if (meta) meta.setAttribute('content', on ? 'width=' + DESIGN_WIDTH + ',viewport-fit=cover' : 'width=device-width,initial-scale=1,viewport-fit=cover');
  }

  function buildPad() {
    pad = doc.createElement('div');
    pad.id = 'phone-pad';
    pad.innerHTML = '<div class="pp-zoom"><button type="button" data-pp="out" aria-label="Thu nhỏ bản đồ">−</button><button type="button" data-pp="in" aria-label="Phóng to bản đồ">+</button></div>' +
      '<button type="button" id="pp-act" data-pp="act" hidden><b></b><small></small></button>';
    doc.body.appendChild(pad);
    pad.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-pp]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const kind = b.dataset.pp;
      if (kind === 'in') g.VTNPrefs?.stepRange?.(-1);
      else if (kind === 'out') g.VTNPrefs?.stepRange?.(1);
      else if (kind === 'act') g.VTNGame?.act?.('interact');
    });
  }

  function buildRotate() {
    rotate = doc.createElement('div');
    rotate.id = 'phone-rotate';
    rotate.setAttribute('role', 'dialog');
    rotate.innerHTML = '<div class="pr-box"><div class="pr-icon" aria-hidden="true"></div><h2>Xoay ngang điện thoại để chơi</h2><p>Chế độ điện thoại chỉ chơi ở màn hình ngang. Hãy xoay máy ngang (và khóa xoay màn hình nếu muốn).</p><button type="button" data-pr="off">Tắt chế độ điện thoại</button></div>';
    doc.body.appendChild(rotate);
    rotate.addEventListener('click', e => { if (e.target.closest('[data-pr="off"]')) g.VTNPrefs?.set?.({phoneMode: 'off'}); });
  }

  // Nút bật/tắt ở màn hình chính: Tự động -> Bật -> Tắt. Chỉ hiện trên thiết bị cảm ứng hoặc khi đã đổi khỏi Tự động.
  function buildToggle() {
    toggle = doc.createElement('button');
    toggle.id = 'phone-toggle'; toggle.type = 'button';
    doc.body.appendChild(toggle);
    toggle.addEventListener('click', () => {
      const cur = MODES.indexOf(prefs().phoneMode || 'auto');
      g.VTNPrefs?.set?.({phoneMode: MODES[(cur + 1) % MODES.length]});
    });
  }
  function paintToggle() {
    if (!toggle) return;
    const mode = prefs().phoneMode || 'auto', touchy = !!(g.navigator && g.navigator.maxTouchPoints > 0) || 'ontouchstart' in g;
    toggle.hidden = !(doc.body.classList.contains('title-mode') && (touchy || mode !== 'auto'));
    toggle.innerHTML = '<span>Chế độ điện thoại</span><b>' + MODE_NAME[mode] + (mode === 'auto' ? (detect() ? ' · đang bật' : ' · đang tắt') : '') + '</b>';
    toggle.setAttribute('aria-label', 'Chế độ điện thoại: ' + MODE_NAME[mode] + '. Chạm để đổi.');
  }

  const KIND = {npc: 'Nói chuyện', building: 'Vào', exit: 'Ra ngoài', portal: 'Đi tiếp', anchor: 'Chạm điểm neo', shrine: 'Nghỉ ngơi', 'boss-gate': 'Vào hang', clue: 'Xem dấu vết'};
  const overlayOpen = () => !!doc.getElementById('overlay')?.classList.contains('open') || !!doc.getElementById('story-overlay')?.classList.contains('is-active');
  const playing = () => doc.body.classList.contains('phone') && !doc.body.classList.contains('title-mode') && !!g.VTNGame?.nearbyPoint;

  function tick() {
    paintToggle();
    if (!pad) return;
    const on = playing() && prefs().padButtons !== false && !overlayOpen() && doc.body.dataset.screen !== 'battle';
    pad.classList.toggle('on', on);
    const act = pad.querySelector('#pp-act');
    if (!on) { act.hidden = true; return; }
    let p = null;
    try { p = g.VTNGame.nearbyPoint(); } catch { p = null; }
    if (!p) { act.hidden = true; return; }
    act.hidden = false;
    act.querySelector('b').textContent = KIND[p.type] || 'Tương tác';
    act.querySelector('small').textContent = p.name || '';
  }

  function refresh() {
    if (!doc.body) return;
    const on = active();
    if (on !== lastActive) { setViewport(on); lastActive = on; }
    doc.body.classList.toggle('phone', on);
    doc.body.style.setProperty('--ps', String(prefs().phoneText || 1));
    doc.documentElement.dataset.phone = on ? '1' : '0';
    if (on && !pad) buildPad();
    if (on && !rotate) buildRotate();
    if (!toggle) buildToggle();
    // đang quay dọc: chặn chơi (chế độ điện thoại chỉ hỗ trợ ngang)
    if (rotate) rotate.classList.toggle('on', on && g.innerHeight > g.innerWidth);
    clearInterval(timer);
    timer = setInterval(tick, 250);
    tick();
  }

  // Android/PWA: xin toàn màn hình rồi khóa hướng ngang. iPhone Safari không cho phép, lúc đó dùng lời nhắc xoay ngang.
  function lockLandscape() {
    if (!active()) return;
    try {
      const el = doc.documentElement, o = g.screen && g.screen.orientation;
      const lock = () => o && o.lock && o.lock('landscape').catch(() => {});
      if (!doc.fullscreenElement && el.requestFullscreen) el.requestFullscreen().then(lock).catch(lock); else lock();
    } catch { /* không hỗ trợ */ }
  }

  // thêm lớp creating khi đang ở màn hình tạo nhân vật để bố cục giữ dáng máy tính
  function watchCreation() {
    const content = doc.getElementById('content');
    if (!content) return;
    const upd = () => doc.body.classList.toggle('creating', !!content.querySelector('.creation-shell,.creation-layout'));
    new MutationObserver(upd).observe(content, {childList: true, subtree: true}); upd();
  }

  function init() {
    refresh(); watchCreation();
    g.addEventListener('resize', refresh);
    g.addEventListener('orientationchange', () => setTimeout(refresh, 250));
    g.VTNPrefs?.onChange?.((v, patch) => { if ('phoneMode' in patch || 'phoneText' in patch || 'padButtons' in patch) refresh(); });
    doc.addEventListener('pointerdown', lockLandscape, {once: true, passive: true});
    doc.addEventListener('gesturestart', e => { if (doc.body.classList.contains('phone')) e.preventDefault(); }, {passive: false});
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  g.VTNPhone = {active, detect, refresh, DESIGN_WIDTH, inspect: () => ({on: doc.body.classList.contains('phone'), pad: !!pad, rotateShown: !!rotate?.classList.contains('on'), actVisible: pad ? !pad.querySelector('#pp-act').hidden : false, toggleShown: !!toggle && !toggle.hidden, viewport: doc.querySelector('meta[name=viewport]')?.getAttribute('content')})};
})(window);
