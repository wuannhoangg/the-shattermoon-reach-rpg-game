(function (g) {
  'use strict';
  // Bảng thử nghiệm: chỉ hiện khi mở index.html?dev=1 (hoặc vfx-test.html). Không ảnh hưởng người chơi thường.
  if (!/[?&]dev=1/.test(g.location.search)) return;
  const $ = id => document.getElementById(id);
  const types = [['Hỏa', 'Hỏa'], ['Lôi', 'Lôi'], ['Băng', 'Băng'], ['Thủy', 'Thủy'], ['Huyết', 'Huyết (bóng tối)'], ['Quang', 'Quang (thánh)'], ['Độc', 'Độc'], ['Phong', 'Phong'], ['Thạch', 'Thạch'], ['Thú', 'Thú (vuốt)']];
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;width:250px;max-height:86vh;overflow:auto;background:#120d1cee;border:1px solid #8a6bd0;border-radius:8px;padding:8px;font:12px/1.4 sans-serif;color:#eee';
  el.innerHTML = '<b>Bảng thử nghiệm</b> <button data-x="hide" style="float:right">thu gọn</button><div data-body></div>';
  document.body.appendChild(el);
  const body = el.querySelector('[data-body]');
  const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'margin:2px;padding:3px 6px;cursor:pointer'; b.onclick = fn; return b; };
  const section = t => { const h = document.createElement('div'); h.textContent = t; h.style.cssText = 'margin-top:8px;color:#d6bd7a;font-weight:600'; body.appendChild(h); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  el.querySelector('[data-x="hide"]').onclick = () => { body.hidden = !body.hidden; };

  function started() { return !!g.VTNGame?.storyState?.(); }
  async function quickGame() {
    if (started()) return;
    g.VTNGame.act('new');
    document.querySelector('[data-create-step="3"]')?.click();
    $('skip-prologue')?.click();
    const n = $('name'); if (n) { n.value = 'Thử'; n.dispatchEvent(new Event('input', { bubbles: true })); }
    document.querySelector('[data-act="start"]')?.click();
    g.VTNGame.act('close');
    await sleep(500);
  }
  async function placeAt(mapId, x, y) {
    await quickGame();
    g.VTNGame.act('close');
    g.VTNGame.travel(mapId, true);
    await sleep(700);
    const s = g.VTNGame.storyState();
    s.mapId = 'region_01'; await sleep(120); // đặt lại điểm vẽ của hero để camera nhảy ngay
    s.x = x; s.y = y; s.mapId = mapId;
  }

  section('Hiệu ứng kỹ năng (mỗi lần bấm là một kỹ năng thật khác)');
  const fx = document.createElement('div'); body.appendChild(fx);
  const info = document.createElement('div'); info.style.cssText = 'margin:4px 2px;color:#9fd2ff'; 
  async function fire(filter, label) {
    await quickGame();
    if (!g.VTNGame.battle()) { g.VTNGame.act('close'); g.VTNGame.beginBattle('wild', [g.VTNRules.instantiate('M-001', 5)]); await sleep(900); }
    const pool = g.VTN_DATA.skills.filter(filter); if (!pool.length) return;
    const sk = pool[Math.floor(Math.random() * pool.length)], b = g.VTNGame.battle();
    document.dispatchEvent(new CustomEvent('vtn:skill', { detail: { uid: 'hero', targetUid: ['heal', 'guard', 'buff'].includes(sk.kind) ? 'hero' : b?.enemies?.[0]?.uid, skillId: sk.id, type: sk.type, kind: sk.kind, name: sk.name } }));
    await sleep(60);
    const l = g.VTNCombatVfx?.inspect?.().lastSkill; info.textContent = sk.name + ' · hệ ' + sk.type + ' · ' + (l?.motion || '') + ' · ' + (l?.preset || '') + ' · ' + (l?.recipe || '');
  }
  for (const [t, label] of types) fx.appendChild(btn(label, () => fire(s => s.type === t && s.kind === 'damage', label)));
  fx.appendChild(btn('Ngẫu nhiên (đòn đánh)', () => fire(s => s.kind === 'damage', '')));
  fx.appendChild(btn('Hồi phục / hỗ trợ', () => fire(s => ['heal', 'guard', 'buff'].includes(s.kind), '')));
  fx.appendChild(btn('Gây trạng thái (kèm hiệu ứng)', () => fire(s => !!s.status, '')));
  fx.appendChild(btn('Tuyệt kỹ', () => fire(s => s.kind === 'ultimate', '')));
  fx.appendChild(info);

  section('Thành quanh điểm neo');
  const city = document.createElement('div'); body.appendChild(city);
  for (let i = 1; i <= 10; i++) {
    const id = 'region_' + String(i).padStart(2, '0');
    city.appendChild(btn('Vùng ' + i, () => placeAt(id, 58, 37)));
  }
  city.appendChild(btn('Sân nội thành', () => { const m = g.VTNGame.storyState()?.mapId || 'region_06'; return placeAt(/^region_/.test(m) ? m : 'region_06', 58, 30); }));

  for (const [label, x, y] of [['Lâu đài Tây', 28, 41], ['Lâu đài Nam', 47, 54], ['Lâu đài Tây Nam', 11, 43]]) city.appendChild(btn(label, () => { const m = g.VTNGame.storyState()?.mapId || 'region_06'; return placeAt(/^region_/.test(m) ? m : 'region_06', x, y); }));

  section('Nội thất nhà (vùng 6)');
  const rooms = document.createElement('div'); body.appendChild(rooms);
  for (const [lot, label] of [['r06_house_a', 'Nhà dân'], ['r06_courthouse', 'Đại sảnh'], ['r06_archive', 'Thư viện'], ['r06_market', 'Chợ'], ['r06_theater', 'Nhà hát']]) {
    rooms.appendChild(btn(label, async () => {
      await placeAt('region_06', 58, 37);
      const p = g.VTNGame.points('region_06').find(v => v.id === lot);
      if (!p) return;
      const s = g.VTNGame.storyState(); s.x = p.x; s.y = p.y + 1;
      await sleep(150); g.VTNGame.act('interact');
    }));
  }
})(window);
