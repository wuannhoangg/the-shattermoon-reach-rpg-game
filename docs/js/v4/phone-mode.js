/* Chế độ điện thoại: bố cục ngang (iPhone 14 Pro = 852x393), chữ lớn, nút tương tác nổi, nhắc xoay ngang.
   Bật bằng Cài đặt > Chế độ điện thoại (Tự động / Bật / Tắt). Mọi kiểu dáng nằm trong css/phone.css dưới body.phone. */
(function (g) {
  'use strict';
  const doc = g.document;
  if (!doc) return;
  const mm = q => !!(g.matchMedia && g.matchMedia(q).matches);
  const prefs = () => (g.VTNPrefs && g.VTNPrefs.get()) || {};
  let rotateDismissed = false, pad = null, rotate = null, timer = 0;

  // Máy cảm ứng có cạnh ngắn <= 520px (điện thoại). Máy tính bảng và máy tính để chuột giữ bố cục thường.
  function detect() {
    const touch = mm('(pointer:coarse)') || ('ontouchstart' in g && !mm('(pointer:fine)'));
    return touch && Math.min(g.innerWidth, g.innerHeight) <= 520;
  }
  function active() {
    const mode = prefs().phoneMode || 'auto';
    return mode === 'on' || (mode !== 'off' && detect());
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
    rotate.innerHTML = '<div class="pr-box"><div class="pr-icon" aria-hidden="true"></div><h2>Xoay ngang điện thoại để chơi</h2><p>Trò chơi được thiết kế cho màn hình ngang. Hãy khóa xoay màn hình ở chế độ ngang cho đỡ phải xoay lại.</p><button type="button" data-pr="stay">Vẫn chơi dọc</button></div>';
    doc.body.appendChild(rotate);
    rotate.addEventListener('click', e => { if (e.target.closest('[data-pr="stay"]')) { rotateDismissed = true; refresh(); } });
  }

  const KIND = {npc: 'Nói chuyện', building: 'Vào', exit: 'Ra ngoài', portal: 'Đi tiếp', anchor: 'Chạm điểm neo', shrine: 'Nghỉ ngơi', 'boss-gate': 'Vào hang', clue: 'Xem dấu vết'};

  function overlayOpen() { return !!doc.getElementById('overlay')?.classList.contains('open') || !!doc.getElementById('story-overlay')?.classList.contains('is-active'); }
  function playing() {
    const b = doc.body;
    return b.classList.contains('phone') && !b.classList.contains('title-mode') && !!g.VTNGame?.nearbyPoint && !!doc.getElementById('game-ui') && doc.getElementById('game-ui').offsetParent !== null;
  }

  function tick() {
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
    doc.body.classList.toggle('phone', on);
    doc.body.style.setProperty('--ps', String(prefs().textScale || 1.15));
    doc.documentElement.dataset.phone = on ? '1' : '0';
    if (on && !g.VTN_TEST) { try { if (!g.localStorage.getItem('vtn4-phone-init')) { g.localStorage.setItem('vtn4-phone-init', '1'); if (prefs().viewRange === 'far') g.VTNPrefs.set({viewRange: 'mid'}); } } catch { /* bộ nhớ bị chặn */ } }   // ô bản đồ đủ to cho ngón tay, đổi bằng nút +/−
    if (on && !pad) buildPad();
    if (on && !rotate) buildRotate();
    if (rotate) rotate.classList.toggle('on', on && g.innerHeight > g.innerWidth && !rotateDismissed);
    clearInterval(timer);
    if (on) timer = setInterval(tick, 250);
    tick();
  }

  // Khóa hướng ngang khi trình duyệt cho phép (Android/PWA); iPhone Safari bỏ qua.
  function lockLandscape() {
    try { const o = g.screen && g.screen.orientation; if (o && o.lock && active()) o.lock('landscape').catch(() => {}); } catch { /* không hỗ trợ */ }
  }

  function init() {
    refresh();
    g.addEventListener('resize', refresh);
    g.addEventListener('orientationchange', () => setTimeout(refresh, 200));
    g.VTNPrefs?.onChange?.((v, patch) => { if ('phoneMode' in patch || 'textScale' in patch || 'padButtons' in patch) refresh(); });
    doc.addEventListener('pointerdown', () => { lockLandscape(); }, {once: true, passive: true});
    // iOS: chặn thu phóng bằng hai ngón và nhấn đúp trong lúc chơi
    doc.addEventListener('gesturestart', e => { if (doc.body.classList.contains('phone')) e.preventDefault(); }, {passive: false});
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  g.VTNPhone = {active, detect, refresh, inspect: () => ({on: doc.body.classList.contains('phone'), pad: !!pad, rotateShown: !!rotate?.classList.contains('on'), actVisible: pad ? !pad.querySelector('#pp-act').hidden : false})};
})(window);
