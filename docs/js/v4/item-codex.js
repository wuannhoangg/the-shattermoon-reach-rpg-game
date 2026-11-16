/* Bảo Vật Chí: encyclopedia of every item, weapon and piece of armour, plus the descriptions the shop uses.
 * The text is generated from the real item data, so what is written here is exactly what the rules do. */
(function (g) {
  'use strict';
  const FAMILY = {sword: 'Kiếm', greatsword: 'Đại kiếm', dagger: 'Dao găm', spear: 'Thương', axe: 'Rìu', hammer: 'Búa', scythe: 'Liềm', bow: 'Cung', crossbow: 'Nỏ', staff: 'Trượng', spellbook: 'Sách phép', bell: 'Chuông', chainWhip: 'Roi xích', warFan: 'Quạt chiến', trident: 'Đinh ba', claw: 'Vuốt', spiritCage: 'Lồng hồn'};
  const SLOT = {weapon: 'Vũ khí', head: 'Mũ', body: 'Giáp thân', hands: 'Găng tay', feet: 'Giày', cloak: 'Áo choàng', ring1: 'Nhẫn trái', ring2: 'Nhẫn phải', amulet: 'Bùa hộ mệnh'};
  const KIND = {heal: 'Hồi phục', mp: 'Hồi MP', candle: 'Nến Hồn', food: 'Thức ăn', cleanse: 'Giải trạng thái', capture: 'Phong ấn Khế Hồn', material: 'Nguyên liệu', weakness: 'Dụng cụ khảo sát', gem: 'Ngọc khắc hồn', exp: 'Kinh nghiệm', level: 'Tăng cấp'};
  const STAT = {STR: 'Sức mạnh', DEX: 'Khéo léo', CON: 'Thể chất', DEF: 'Phòng thủ', SPD: 'Tốc độ', INT: 'Trí lực', WIS: 'Tinh thần', CHA: 'Mị lực'};
  const RARITY_ORDER = ['Phàm', 'Tinh', 'Hiếm', 'Sử Thi', 'Huyền Thoại', 'Truyền Kỳ', 'Thần Khí'];
  const TABS = [
    {id: 'all', label: 'Tất cả'},
    {id: 'consumable', label: 'Hồi phục & hỗ trợ'},
    {id: 'capture', label: 'Phong ấn'},
    {id: 'growth', label: 'Luyện cấp'},
    {id: 'material', label: 'Nguyên liệu'},
    {id: 'weapon', label: 'Vũ khí'},
    {id: 'armour', label: 'Giáp & trang sức'}
  ];
  const PAGE = 40;

  function create(c) {
    const {R, D} = c, by = R.by, esc = c.esc;
    let tab = 'all', query = '', page = 0, rarity = '';

    const num = v => Number(v).toLocaleString('vi-VN');
    const statList = obj => Object.entries(obj || {}).filter(([, v]) => v).map(([k, v]) => `${STAT[k] || k} ${v > 0 && !String(v).includes('.') ? '+' : ''}${v}`).join(' · ');
    const weaponFamily = e => { const idx = String(e.id).split('_')[1]; return FAMILY[D.weights?.weaponFamilyByIndex?.[idx]] || 'Vũ khí'; };
    const monster = id => by('monsters', id);
    const regionOfMonster = id => by('regions', monster(id)?.regionId)?.name || '';

    /** Returns {type, title, kindLabel, rarity, summary, effects[], where[], price, lore, icon} for any item or equipment id. */
    function describe(id) {
      const it = by('items', id);
      if (it) return describeItem(it);
      const eq = by('equipment', id);
      return eq ? describeEquip(eq) : null;
    }

    function describeItem(i) {
      const out = {type: 'item', id: i.id, title: i.name, kindLabel: KIND[i.kind] || i.kind, rarity: '', price: i.price, effects: [], where: [], lore: ''};
      out.lore = i.lore || '';
      if (i.legendary) { out.kindLabel = 'Vật phẩm huyền thoại'; out.summary = 'Thu phục chắc chắn một Bá Chủ đã mất trái tim và trả lại trái tim cho nó.'; out.effects = ['Chỉ dùng được trong trận với Bá Chủ của các vùng, không dùng với con mắt cuối cùng.', 'Chỉ có một, không thể mua hay chế tạo.']; out.where = ['Nhận được qua cốt truyện, khi bạn đã đủ điều kiện về Khế Hồn.']; return out; }
      if (i.kind === 'quest') { out.kindLabel = 'Vật phẩm cốt truyện'; out.summary = i.lore || 'Một vật quan trọng của câu chuyện.'; out.effects = ['Vật phẩm cốt truyện: không thể bán hoặc dùng trực tiếp.', 'Được dùng tự động khi đến đúng thời điểm của nhiệm vụ.']; out.where = ['Nhận được khi tiến triển cốt truyện.']; return out; }
      switch (i.kind) {
        case 'heal':
          out.summary = `Hồi ít nhất ${i.value} HP cho nhân vật, hoặc 30% HP tối đa nếu con số này lớn hơn.`;
          out.effects = ['Dùng được ngoài trận (Hành trang) và trong trận (mục Vật phẩm, tốn một lượt).', 'Đồng Khôi Nhân không dùng được: tộc này phải sửa thân bằng kim loại.'];
          break;
        case 'mp': out.summary = `Hồi ${i.value} MP cho nhân vật.`; out.effects = ['Dùng được ngoài trận và trong trận.']; break;
        case 'candle':
          out.summary = 'Thắp thêm một Nến Hồn (tối đa 9).';
          out.effects = ['Mỗi Nến Hồn cho phép bạn gục ngã một lần và trở về đền gần nhất.', 'Khi hết Nến Hồn, gục ngã sẽ mất 25% tro vàng và một ký ức.'];
          break;
        case 'food':
          out.summary = 'Bữa ăn nóng cho khế thú đứng đầu đội.';
          out.effects = ['+15 gắn kết (nhân với tính cách của khế thú).', 'Hồi 45 HP.', 'Gắn kết cao giúp khế thú nghe lệnh và tiến hóa.'];
          break;
        case 'cleanse':
          out.summary = 'Xóa mọi trạng thái xấu của nhân vật và các khế thú đang trên sân.';
          out.effects = ['Dùng được ngoài trận và trong trận.']; break;
        case 'weakness':
          out.summary = 'Bộ dụng cụ để khai thác điểm yếu đã quan sát của sinh linh.';
          out.effects = ['Dùng trong trận ở mục Quan sát sau khi đã tìm ra điểm yếu: địch lộ sơ hở và chịu thêm sát thương trong vài lượt.', 'Mỗi lần dùng tốn 1 bộ.'];
          break;
        case 'gem':
          out.summary = 'Viên ngọc khảm vào trang bị để tăng phòng thủ.';
          out.effects = ['Khảm vào một trang bị đang mặc: +2 Phòng thủ mỗi viên, tối đa 3 viên cho mỗi món.', 'Có thể chế từ 2 nguyên liệu của cùng một loài.'];
          break;
        case 'capture':
          out.summary = `Phong ấn thu phục sinh linh, nền tảng ${Math.round(i.power * 100)}% mỗi lần ném.`;
          out.effects = [`Thêm 15% nếu sinh linh thuộc hệ ${i.affinity}.`, i.category ? `Thêm 15% nếu sinh linh thuộc nhóm ${i.category}.` : null, 'Cộng thêm theo máu còn lại của đối thủ (càng yếu càng dễ), Mị lực của bạn, trạng thái bất lợi và đòn khắc chế.', 'Chỉ dùng được với sinh linh hoang dã, trong trận.'].filter(Boolean);
          break;
        case 'exp':
          out.summary = i.desc || `Cho nhân vật hoặc khế thú ăn để nhận ${i.value} kinh nghiệm.`;
          out.effects = [`+${i.value} kinh nghiệm cho một thành viên tùy chọn (nhân vật, đội hình hoặc kho).`, 'Dùng trong Hành trang, bấm "Cho ăn…". Khế thú cùng cấp cần ít kinh nghiệm hơn nhân vật.', 'Có thể lên nhiều cấp cùng lúc.'];
          break;
        case 'level':
          out.summary = i.desc || 'Tăng đúng một cấp.';
          out.effects = ['Dùng trong Hành trang, bấm "Tăng 1 cấp cho…" rồi chọn nhân vật hoặc khế thú.', 'Không dùng được khi đã đạt cấp 60.'];
          break;
        case 'material': {
          const sp = monster(i.speciesId), reg = regionOfMonster(i.speciesId);
          out.summary = `Chiến lợi phẩm lấy từ ${sp?.name || 'sinh linh'}${sp?.loot ? ': ' + sp.loot : ''}.`;
          const uses = ['Chế di vật: 2 nguyên liệu cùng loài đổi lấy 1 Ngọc khắc hồn và giảm 20% sát thương nhận từ loài này (Hành trang).'];
          const evo = (D.evolutions || []).filter(e => e.speciesId === i.speciesId && e.lootRequired);
          if (evo.length) uses.push(`Cần 1 cái cho lần tiến hóa lên dạng cuối của ${sp?.name || 'loài này'}.`);
          out.effects = uses;
          out.where = [`Rơi khi đánh bại hoặc thu phục ${sp?.name || 'sinh linh này'}${reg ? ' (vùng ' + reg + ')' : ''}.`];
          if (sp?.dexQuote) out.lore = String(sp.dexQuote);
          break;
        }
        default: out.summary = i.desc || ''; break;
      }
      out.effects = out.effects.filter(Boolean);
      if (!out.where.length) out.where = whereToGet(i);
      return out;
    }

    function whereToGet(i) {
      const w = [];
      if (i.price && i.kind !== 'material') w.push(`Bán ở Thương Hội & Lò Rèn với giá gốc ${num(i.price)} tro vàng (giảm theo Mị lực và danh tiếng).`);
      if (i.id === 'exp_cake') w.push('Thỉnh thoảng rơi sau trận thắng (khoảng 18% trận quái hoang, 10% các trận khác).');
      if (i.id === 'exp_feast') w.push('Phần thưởng khi thắng trùm vùng hoặc trận đấu trường.');
      if (i.id === 'level_fruit') w.push('Phần thưởng khi hạ Bá Chủ của một vùng.');
      return w;
    }

    function describeEquip(e) {
      const slot = SLOT[e.slot] || e.slot, out = {type: 'equipment', id: e.id, title: e.name, kindLabel: e.slot === 'weapon' ? weaponFamily(e) : slot, rarity: e.rarity, price: e.price, effects: [], where: [], lore: e.lore || ''};
      if (e.slot === 'weapon') {
        const scale = Object.entries(e.scale || {}).map(([k, v]) => `${STAT[k] || k} ×${v}`).join(' · ');
        out.summary = `${weaponFamily(e)} phẩm ${e.rarity}: sức đánh cơ bản ${e.power}.`;
        out.effects.push(`Đòn thường gây sát thương theo ${scale}.`);
        if (e.bonuses && Object.values(e.bonuses).some(Boolean)) out.effects.push('Khi cầm: ' + statList(e.bonuses) + '.');
        if (g.VTN_WEIGHT_NOTE) out.effects.push(g.VTN_WEIGHT_NOTE);
        out.effects.push('Mỗi cấp rèn (+1) cộng 4 sức đánh và cộng thêm vào chỉ số thưởng.');
      } else {
        const b = statList(e.bonuses);
        out.summary = `${slot} phẩm ${e.rarity}${b ? ': ' + b : ''}.`;
        out.effects.push(b ? 'Khi mặc: ' + b + '.' : 'Không cộng chỉ số, chỉ dùng cho bộ đồ.');
        if (e.setId) out.effects.push('Mặc từ 3 món cùng bộ trở lên: Phòng thủ tổng +12%.');
      }
      out.effects.push('Có thể khảm tối đa 3 Ngọc khắc hồn (+2 Phòng thủ mỗi viên).');
      if (e.requirements && Object.keys(e.requirements).length) out.effects.push('Yêu cầu: ' + Object.entries(e.requirements).map(([k, v]) => `${STAT[k] || k} ${v}`).join(', ') + '.');
      if (e.curse) out.effects.push(`Lời nguyền: mỗi lượt mất ${Math.round(e.curse.hpDrain * 100)}% HP tối đa và ${e.curse.corruption} điểm Sa Đọa. Giải nguyền bằng một ký ức.`);
      if (e.questRequired) out.effects.push('Chỉ mua được sau khi hoàn thành chương ' + String(e.questRequired).split('_')[1] + '.');
      out.where = [`Bán ở Thương Hội & Lò Rèn với giá gốc ${num(e.price)} tro vàng.`];
      return out;
    }

    const iconOf = (id, name, cls) => c.itemSlot(id, name, cls || 'item-slot');
    const chips = d => `<span class="codex-chip">${esc(d.kindLabel)}</span>${d.rarity ? `<span class="codex-chip rarity-${RARITY_ORDER.indexOf(d.rarity)}">${esc(d.rarity)}</span>` : ''}`;

    /** Compact HTML used by the shop cards: what the thing does, at a glance. */
    function shopInfo(id) {
      const d = describe(id);
      if (!d) return '';
      const eff = d.effects.slice(0, d.type === 'equipment' ? 3 : 2);
      return `<div class="item-info"><div class="codex-chips">${chips(d)}</div><p class="item-summary">${esc(d.summary || '')}</p>${eff.length ? `<ul class="item-effects">${eff.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<button class="item-more" data-act="item-detail" data-id="${esc(id)}">Xem chi tiết</button></div>`;
    }

    /* ---- list ---- */
    function entries() {
      const s = c.state(), q = query.toLocaleLowerCase('vi');
      const items = D.items.filter(i => !i.hidden || (c.state().hero.bag[i.id] || 0) > 0).map(i => ({id: i.id, type: 'item', name: i.name, kind: i.kind, rarity: ''}));
      const eq = D.equipment.map(e => ({id: e.id, type: 'equipment', name: e.name, kind: e.slot, rarity: e.rarity, e}));
      let list = [...items, ...eq];
      list = list.filter(x => {
        if (tab === 'consumable' && !['heal', 'mp', 'candle', 'food', 'cleanse', 'weakness', 'gem'].includes(x.kind)) return false;
        if (tab === 'capture' && x.kind !== 'capture') return false;
        if (tab === 'growth' && !['exp', 'level'].includes(x.kind)) return false;
        if (tab === 'material' && x.kind !== 'material') return false;
        if (tab === 'weapon' && x.kind !== 'weapon') return false;
        if (tab === 'armour' && !(x.type === 'equipment' && x.kind !== 'weapon')) return false;
        if (rarity && x.rarity !== rarity) return false;
        if (q && !(x.name + ' ' + x.id).toLocaleLowerCase('vi').includes(q)) return false;
        return true;
      });
      return list;
    }
    const known = (x, s) => { if (x.kind !== 'material') return true; const sp = by('items', x.id)?.speciesId; return s.seen.includes(sp) || s.admin?.enabled; };
    const owned = (id, s) => by('items', id) ? (s.hero.bag[id] || 0) : ((s.hero.ownedEquipment || []).filter(x => x.id === id).length + (Object.values(s.hero.equipment || {}).filter(x => x && x.id === id).length));

    function menu() {
      const s = c.state(); if (!s) return;
      const list = entries(), pages = Math.max(1, Math.ceil(list.length / PAGE));
      page = Math.min(page, pages - 1);
      const cards = list.slice(page * PAGE, (page + 1) * PAGE).map(x => {
        const ok = known(x, s), d = ok ? describe(x.id) : null, n = owned(x.id, s);
        return `<article class="card codex-card ${ok ? '' : 'locked'}" data-act="item-detail" data-id="${esc(x.id)}" tabindex="0" role="button">${iconOf(x.id, ok ? x.name : '???')}<div><h3>${ok ? esc(x.name) : '???'}</h3><div class="codex-chips">${ok ? chips(d) : '<span class="codex-chip">Chưa gặp</span>'}</div><p>${ok ? esc((d.summary || '').slice(0, 96)) + ((d.summary || '').length > 96 ? '…' : '') : 'Đánh bại hoặc thu phục sinh linh này để mở trang.'}</p>${n ? `<small class="codex-own">Đang có ${n}</small>` : ''}</div></article>`;
      }).join('');
      c.show('Bảo Vật Chí · Codex of Relics',
        `<div class="intro"><h2>Mọi vật đều có một công dụng và một cái giá.</h2><p>${D.items.length} vật phẩm và ${D.equipment.length} món trang bị. Bấm vào một món để xem tác dụng, nơi có được và cách dùng.</p></div>` +
        `<div class="codex-tabs" role="tablist">${TABS.map(t => `<button role="tab" class="${t.id === tab ? 'is-on' : ''}" data-act="items-codex-tab" data-id="${t.id}">${t.label}</button>`).join('')}</div>` +
        `<div class="toolbar"><input id="codex-search" type="search" placeholder="Tìm theo tên hoặc mã" value="${esc(query)}" aria-label="Tìm vật phẩm"><select id="codex-rarity" aria-label="Độ hiếm"><option value="">Mọi độ hiếm</option>${RARITY_ORDER.map(r => `<option ${r === rarity ? 'selected' : ''}>${r}</option>`).join('')}</select><span class="codex-count">${list.length} mục</span></div>` +
        `<div class="grid codex-grid">${cards || '<p>Không có mục nào khớp.</p>'}</div>` +
        (pages > 1 ? `<div class="codex-pager"><button data-act="items-codex-page" data-id="${page - 1}" ${page === 0 ? 'disabled' : ''}>← Trước</button><span>Trang ${page + 1}/${pages}</span><button data-act="items-codex-page" data-id="${page + 1}" ${page >= pages - 1 ? 'disabled' : ''}>Sau →</button></div>` : ''));
      const si = document.getElementById('codex-search'); if (si) si.onchange = () => { query = si.value; page = 0; menu(); };
      const sr = document.getElementById('codex-rarity'); if (sr) sr.onchange = () => { rarity = sr.value; page = 0; menu(); };
    }

    function detail(id) {
      const s = c.state(), d = describe(id); if (!d) return;
      const n = owned(id, s);
      const sp = by('items', id)?.speciesId;
      c.show(d.title,
        `<div class="codex-detail"><article class="card codex-hero">${iconOf(id, d.title, 'item-slot codex-big')}<h2>${esc(d.title)}</h2><div class="codex-chips">${chips(d)}</div><p class="codex-own">Đang có: <b>${n}</b></p>${d.price ? `<p>Giá gốc: <b>${num(d.price)}</b> tro vàng</p>` : ''}</article>` +
        `<div><div class="lore"><b>Tác dụng</b><p>${esc(d.summary || '')}</p>${d.effects.length ? `<ul class="codex-list">${d.effects.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>` +
        (d.where.length ? `<div class="lore"><b>Nơi có được</b><ul class="codex-list">${d.where.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '') +
        (d.lore ? `<div class="lore"><b>Lai lịch</b><p>${esc(d.lore)}</p></div>` : '') +
        `<div class="row">${sp ? c.button('Xem hồ sơ ' + (monster(sp)?.name || 'sinh linh'), 'monster', sp) : ''}${c.button('Về Bảo Vật Chí', 'items-codex')}</div></div></div>`);
    }

    function handle(action, id) {
      if (action === 'items-codex') { menu(); return true; }
      if (action === 'items-codex-tab') { tab = id; page = 0; menu(); return true; }
      if (action === 'items-codex-page') { page = Math.max(0, Number(id) || 0); menu(); return true; }
      if (action === 'item-detail') { detail(id); return true; }
      return false;
    }
    document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target?.classList?.contains('codex-card')) { e.preventDefault(); detail(e.target.dataset.id); } });
    return {describe, shopInfo, handle, menu, detail};
  }
  g.VTNItemCodex = {create, SLOT, FAMILY};
})(window);
