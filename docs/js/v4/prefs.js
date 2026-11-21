/* Global player preferences (independent of save slots), persisted in localStorage. */
(function (g) {
  'use strict';
  const KEY = (g.VTN_TEST ? 'qa-' : '') + 'vtn4-prefs';
  const DEFAULTS = {
    musicOn: true, musicTrack: 'auto', musicVolume: .5,
    sfxOn: true, sfxVolume: .5,
    difficulty: 'normal',
    textSpeed: 1, battleSpeed: 1,
    vfx: 'full', shake: true, numbers: true,
    pathSpeed: 'rapid', motion: 'full', layout: 'auto', viewRange: 'far', phoneMode: 'auto', phoneText: 1, padButtons: true
  };
  const DIFFICULTY = {
    easy: {name:'Dễ', audience:'theo dõi cốt truyện', foe:.65, hero:1.25, exp:1, gold:1, capture:.10, goldLoss:0, candleLoss:0, bondLoss:0, permanentBelow:0},
    normal: {name:'Thường', audience:'hành trình cân bằng', foe:1, hero:1, exp:1, gold:1, capture:0, goldLoss:.10, candleLoss:0, bondLoss:0, permanentBelow:0},
    hard: {name:'Khó', audience:'tính toán đội hình', foe:1.3, hero:.92, exp:1.15, gold:1.15, capture:-.05, goldLoss:.10, candleLoss:1, bondLoss:10, permanentBelow:0},
    nightmare: {name:'Ác mộng', audience:'chấp nhận mất khế thú vĩnh viễn', foe:1.65, hero:.82, exp:1.3, gold:1.3, capture:-.10, goldLoss:.20, candleLoss:2, bondLoss:20, permanentBelow:30}
  };
  // Display text is derived from the same numeric fields used by battle rules.
  const diffNumber = n => String(Number(n.toFixed(4))).replace('.', ',');
  for (const [id, d] of Object.entries(DIFFICULTY)) {
    d.id = id;
    d.summary = 'Phù hợp với: ' + d.audience + '.';
    d.note = `Địch ×${diffNumber(d.foe)} sát thương · đội bạn ×${diffNumber(d.hero)}.`;
    d.rules = [
      `Sát thương đòn đánh của địch ×${diffNumber(d.foe)}; của nhân vật và khế thú ×${diffNumber(d.hero)}. HP và các chỉ số nền giữ nguyên.`,
      `Thưởng chiến thắng: kinh nghiệm ×${diffNumber(d.exp)}, tro vàng ×${diffNumber(d.gold)}; nhiệm vụ, vật phẩm rơi và giá cửa hàng giữ nguyên.`,
      `Tỉ lệ lập khế ${d.capture < 0 ? 'giảm' : 'tăng'} ${diffNumber(Math.abs(d.capture)*100)} điểm phần trăm; giới hạn 1–92%. Phong ấn huyền thoại và điều kiện cấm bắt giữ nguyên.`,
      `Thua trận: tỉnh ở đền gần nhất, hồi đầy HP và MP; mất ${diffNumber(d.goldLoss*100)}% tro vàng (làm tròn xuống), ${d.candleLoss} Nến Hồn (còn ít nhất 1); khế thú gục mất ${d.bondLoss} gắn kết.`,
      ...(d.permanentBelow ? [`Khế thú trong đội về 0 HP khi gắn kết dưới ${d.permanentBelow}: mất vĩnh viễn ngay trong trận, chết không thể hồi sinh; gắn kết từ ${d.permanentBelow} trở lên được giữ lại. Trận tập được miễn.`] : ['Khế thú gục được giữ lại; không mất cấp hay ký ức.']),
      'Nghỉ ở đền hồi đầy HP, MP và thêm 1 Nến Hồn (tối đa 9), tốn 2 giờ; không thêm giới hạn vật phẩm trong trận.',
      'Đổi độ khó áp dụng từ trận kế tiếp. Trận mở đầu vẫn có trợ lực riêng; Cửu Mạng vẫn cứu tại chỗ một lần mỗi vùng.',
      'Chế độ Hardcore: chết là mất nhân vật khi thua trận và hết Nến Hồn; mỗi lần thua mất 1 nến, không áp dụng hình phạt độ khó. Đây là lựa chọn riêng khi tạo nhân vật.'
    ];
    Object.freeze(d.rules); Object.freeze(d);
  }
  Object.freeze(DIFFICULTY);
  const PATH_SPEED = {slow: .45, normal: .65, fast: 1, rapid: 1.7, turbo: 2.6, blitz: 4};
  let value = {...DEFAULTS};
  try { value = {...DEFAULTS, ...JSON.parse(g.localStorage.getItem(KEY) || '{}')}; } catch { /* storage may be blocked */ }
  const listeners = new Set();
  function save() { try { g.localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* ignore */ } }
  /* another tab/window changed the settings: follow it, so music switched off in one place is off everywhere */
  g.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    let incoming = {}; try { incoming = JSON.parse(e.newValue || '{}'); } catch { return; }
    const next = {...DEFAULTS, ...incoming}, patch = {};
    for (const k of Object.keys(next)) if (next[k] !== value[k]) patch[k] = next[k];
    if (!Object.keys(patch).length) return;
    value = next; if ('layout' in patch) applyLayout(); listeners.forEach(fn => { try { fn(value, patch); } catch (err) { console.error(err); } });
  });
  /* Layout mode: on phones and tablets the viewport width decides which layout the page uses. */
  const VIEWPORT = {auto: 'width=device-width,initial-scale=1,viewport-fit=cover', desktop: 'width=1180,viewport-fit=cover', phone: 'width=640,viewport-fit=cover'};
  function applyLayout() {
    const mode = 'auto', meta = g.document && g.document.querySelector('meta[name=viewport]');
    if (meta) meta.setAttribute('content', VIEWPORT[mode]);
    if (g.document && g.document.documentElement) g.document.documentElement.dataset.layout = mode;
  }
  /* camera height: mouse wheel over the map or +/- keys step through Gần / Vừa / Xa / Rất xa */
  const RANGE_ORDER = ['near', 'mid', 'far', 'vfar', 'ultra', 'whole'], RANGE_NAME = {near: 'Gần', mid: 'Vừa', far: 'Xa', vfar: 'Rất xa', ultra: 'Siêu xa', whole: 'Toàn cảnh'};
  function stepRange(dir) {
    const i = Math.max(0, RANGE_ORDER.indexOf(value.viewRange)), next = RANGE_ORDER[Math.max(0, Math.min(RANGE_ORDER.length - 1, i + dir))];
    if (next === value.viewRange) return;
    g.VTNPrefs.set({viewRange: next});
    const hint = g.document?.getElementById('view-range-hint') || Object.assign(g.document.createElement('div'), {id: 'view-range-hint'});
    hint.style.cssText = 'position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:50;padding:6px 14px;border:1px solid #947344;background:#151020e6;color:#f0debc;font:600 14px sans-serif;pointer-events:none;transition:opacity .4s';
    hint.textContent = 'Tầm nhìn: ' + RANGE_NAME[next]; hint.style.opacity = '1'; if (!hint.isConnected) g.document.body.appendChild(hint);
    clearTimeout(stepRange.t); stepRange.t = setTimeout(() => { hint.style.opacity = '0'; }, 900);
  }
  if (g.document) {
    g.addEventListener('wheel', e => { if (e.target?.id !== 'world' || g.document.body.classList.contains('title-mode')) return; e.preventDefault(); stepRange(e.deltaY > 0 ? 1 : -1); }, {passive: false});
    g.addEventListener('keydown', e => { if (/input|select|textarea/i.test(e.target?.tagName || '') || g.document.getElementById('overlay')?.classList.contains('open')) return; if (e.key === '+' || e.key === '=') stepRange(-1); else if (e.key === '-' || e.key === '_') stepRange(1); });
  }
  g.VTNPrefs = {
    DEFAULTS, DIFFICULTY, PATH_SPEED, stepRange,
    get: () => value,
    set(patch) { value = {...value, ...patch}; save(); if ('layout' in patch) applyLayout(); listeners.forEach(fn => { try { fn(value, patch); } catch (e) { console.error(e); } }); return value; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    difficulty: () => DIFFICULTY[value.difficulty] || DIFFICULTY.normal,
    pathFactor: () => PATH_SPEED[value.pathSpeed] || PATH_SPEED.normal
  };
  applyLayout();
})(window);
