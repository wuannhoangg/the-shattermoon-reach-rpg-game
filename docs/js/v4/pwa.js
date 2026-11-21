/* PWA glue: registers the service worker (only over http/https) and, on iPhone/iPad Safari, shows a one-time hint on how to
 * install the game on the Home Screen. */
(function (g) {
  'use strict';
  const d = g.document, nav = g.navigator;
  const web = /^https?:$/.test(g.location.protocol);
  if (web && !g.VTN_TEST && 'serviceWorker' in nav) {
    g.addEventListener('load', () => { nav.serviceWorker.register('sw.js').catch(() => {}); });
  }
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  if (!ios || !web) return;   // matchMedia forces a full style recalc; only iOS needs the answer
  const standalone = nav.standalone === true || (g.matchMedia && g.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);
  let dismissed = false;
  try { dismissed = g.localStorage.getItem('vtn-install-hint') === '1'; } catch { /* ignore */ }
  if (standalone || dismissed) return;
  const bar = d.createElement('div');
  bar.id = 'install-hint';
  bar.setAttribute('role', 'note');
  bar.innerHTML = '<div><strong>Chơi toàn màn hình và không cần mạng</strong><span>Bấm nút Chia sẻ của Safari, chọn <b>Thêm vào Màn hình chính</b>. Hãy mở game từ biểu tượng mới đó để tiến trình được lưu đúng chỗ.</span></div><button type="button" aria-label="Đóng gợi ý">Đã hiểu</button>';
  bar.querySelector('button').addEventListener('click', () => {
    try { g.localStorage.setItem('vtn-install-hint', '1'); } catch { /* ignore */ }
    bar.remove();
  });
  g.addEventListener('load', () => setTimeout(() => { if (d.body.classList.contains('title-mode')) d.body.appendChild(bar); }, 1200));
})(window);
