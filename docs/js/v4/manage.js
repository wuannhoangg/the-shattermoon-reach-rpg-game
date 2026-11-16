/* Quản lý khế thú: one screen per monster with current stats, level, skills, feeding and evolution.
 * Opened from the party / storage cards ("Quản lý") and from profiles of owned monsters. */
(function (g) {
  'use strict';
  const STAT_VI = {STR: 'Sức mạnh', DEX: 'Khéo léo', CON: 'Thể chất', DEF: 'Phòng thủ', SPD: 'Tốc độ', INT: 'Trí lực', WIS: 'Tinh thần', CHA: 'Mị lực'};
  const FEEDS = [
    {id: 'food', label: 'Bữa Ăn Ấm', note: '+15 gắn kết · +45 HP', kind: 'food'},
    {id: 'exp_cake', label: 'Bánh Tro Dưỡng Hồn', note: '+160 EXP', kind: 'grow'},
    {id: 'stone', label: 'Đá Thức Hồn', note: '+400 EXP', kind: 'grow'},
    {id: 'exp_feast', label: 'Yến Tiệc Nguyệt Quang', note: '+800 EXP', kind: 'grow'},
    {id: 'level_fruit', label: 'Quả Nguyệt Thụ', note: '+1 cấp', kind: 'grow'}
  ];

  function create(c) {
    const {R, D} = c, by = R.by, esc = c.esc, L = () => g.VTNLoadouts;
    const slotSel = {}, skillQuery = {};

    const find = uid => [...c.state().party, ...c.state().storage].find(m => String(m.uid) === String(uid));
    const admin = () => !!c.state().admin?.enabled;

    function skillCard(id, opts = {}) {
      const sk = by('skills', id);
      if (!sk) return '';
      const label = c.plain ? c.plain(sk.name) : sk.name;
      return `<button class="mg-skill ${opts.cls || ''}" data-act="${opts.act || ''}" data-id="${esc(opts.token || '')}" ${opts.act ? '' : 'disabled'}>
        <span class="mg-skill-top">${c.typeTags([sk.type])}<b>${sk.mpCost} MP</b></span>
        <strong>${esc(label)}</strong>
        <small>${esc(opts.note || ('Uy lực ' + sk.power + ' · ' + (sk.scale || 'WIS')))}</small>
        ${opts.desc ? `<small class="mg-desc">${esc(c.plain ? c.plain(sk.description || '') : (sk.description || ''))}</small>` : ''}</button>`;
    }

    function open(uid) {
      const s = c.state(), m = find(uid);
      if (!m) { c.toast('Không tìm thấy khế thú này.'); return; }
      const sp = by('monsters', m.speciesId), form = by('evolutions', m.formId), st = R.monsterStats(m), tier = D.tiers[sp.tierIndex];
      const nature = by('natures', m.natureId), need = m.level * 65, pct = Math.min(100, Math.round(100 * m.exp / need));
      const inParty = s.party.includes(m), idx = s.party.indexOf(m);
      const eq = L().equipped(s, m.uid), learned = L().available(s, m.uid);
      const sel = slotSel[m.uid] ?? Math.max(0, eq.findIndex(x => !x));
      const upcoming = (sp.learnset || []).filter(e => e.level > m.level && by('skills', e.skillId)?.kind !== 'passive').slice(0, 6);
      const evo = R.canEvolve(s, m)[0], nextForms = D.evolutions.filter(f => f.speciesId === m.speciesId && f.stage === (form?.stage ?? 0) + 1);
      const bag = s.hero.bag;
      const feeds = FEEDS.filter(f => (bag[f.id] || 0) > 0 || s.admin?.creative).map(f => `<button class="mg-feed" data-act="${f.kind === 'food' ? 'mg-food' : 'growth-apply'}" data-id="${f.kind === 'food' ? esc(m.uid) : esc(f.id + '|' + m.uid)}" ${m.level >= 60 && f.kind === 'grow' ? 'disabled' : ''}><span>${c.itemSlot ? c.itemSlot(f.id, f.label) : ''}</span><b>${esc(f.label)} <small>× ${bag[f.id] || 0}</small></b><small>${esc(f.note)}</small></button>`).join('');
      const evoHtml = nextForms.length ? `<div class="mg-evo"><h4>Tiến hóa</h4>${nextForms.map(f => {
        const can = evo && evo.id === f.id;
        const reqs = [`Cấp ${f.requiredLevel}`, `gắn kết ${f.bondRequired}`, f.moonRule ? (f.moonRule === 'full' ? 'trăng tròn' : 'trăng khuyết') : '', f.lootRequired ? 'cần 1 ' + f.lootRequired : ''].filter(Boolean).join(' · ');
        return `<div class="mg-evo-row ${can ? 'is-ready' : ''}"><div><strong>${esc(f.name)}</strong><small>${esc(reqs)}</small></div>${can ? c.button('Tiến hóa ngay', 'evolve', m.uid) : '<small>Chưa đủ điều kiện</small>'}</div>`;
      }).join('')}</div>` : '<div class="mg-evo"><h4>Tiến hóa</h4><p class="small">Đây là dạng cuối của loài.</p></div>';

      const adminHtml = admin() ? `<section class="mg-admin"><h3>Quản trị</h3>
        <div class="mg-admin-row"><span>Cấp ${m.level}</span>${[[-10, '−10'], [-1, '−1'], [1, '+1'], [10, '+10']].map(([d, t]) => c.button(t, 'mg-level', m.uid + '|' + d)).join('')}${c.button('Đặt cấp 60', 'mg-level', m.uid + '|set60')}${c.button('Hồi đầy', 'mg-heal', m.uid)}${c.button('Gắn kết 100', 'mg-bond', m.uid)}</div>
        <label>Học thêm kỹ năng <input id="mg-skill-search" type="search" placeholder="Tìm tên hoặc hệ" value="${esc(skillQuery[m.uid] || '')}"></label>
        <div class="mg-admin-skills">${(D.skills || []).filter(x => x.kind !== 'passive' && !learned.includes(x.id) && (!skillQuery[m.uid] || (x.name + ' ' + x.type).toLocaleLowerCase('vi').includes(skillQuery[m.uid].toLocaleLowerCase('vi')))).slice(0, 18).map(x => c.button(esc((c.plain ? c.plain(x.name) : x.name)) + ' · ' + esc(x.type), 'mg-learn', m.uid + '|' + x.id)).join('') || '<small>Không có kết quả.</small>'}</div></section>` : '';

      c.show('Quản lý · ' + (form?.name || sp.name), `<div class="manage">
        <section class="card mg-head">
          <div class="mg-art">${c.sprite(m.speciesId, m.formId, m.variant, false, 168, m.uid, m.look)}</div>
          <div class="mg-id">
            <h2>${esc(form?.name || sp.name)}</h2>
            <p class="small">${esc(sp.id)} · ${esc(sp.englishName || '')} · ${inParty ? (idx < (s.party.length > 2 ? 2 : s.party.length) ? 'Đang đứng sân' : 'Dự bị') : 'Trong kho'}</p>
            <div class="type-row">${c.typeTags(st.types || sp.types)} ${c.tierBadge ? c.tierBadge(tier) : ''}</div>
            <div class="mg-level"><strong>Cấp ${m.level}</strong><span>${m.level >= 60 ? 'Tối đa' : 'EXP ' + m.exp + ' / ' + need}</span></div>
            <div class="mg-bar"><i style="width:${m.level >= 60 ? 100 : pct}%"></i></div>
            <div class="mg-facts"><span>Tính cách <b>${esc(nature?.name || '–')}</b></span><span>Tiềm lực <b>${esc(m.potential)}</b></span><span>Gắn kết <b>${Math.round(m.bond)}</b>/100</span>${m.variant ? '<span><b>Biến thể Nguyệt Thực</b></span>' : ''}</div>
          </div>
        </section>
        <section class="card mg-stats"><h3>Chỉ số hiện tại</h3>
          <div class="mg-vitals"><div><small>HP</small><b>${m.hp} / ${st.hp}</b><div class="mg-bar hp"><i style="width:${Math.min(100, Math.round(100 * m.hp / st.hp))}%"></i></div></div><div><small>MP</small><b>${m.mp} / ${st.mp}</b><div class="mg-bar mp"><i style="width:${Math.min(100, Math.round(100 * m.mp / st.mp))}%"></i></div></div></div>
          <div class="stat-chip-grid">${Object.keys(STAT_VI).map(k => `<span class="stat-chip"><b>${k}</b><strong>${st[k]}</strong><small>${STAT_VI[k]}</small></span>`).join('')}</div>
        </section>
        <section class="card mg-skills"><h3>Kỹ năng mang vào trận <small>(bốn ô)</small></h3>
          <div class="mg-slots">${Array.from({length: 4}, (_, i) => eq[i] ? skillCard(eq[i], {act: 'mg-slot', token: m.uid + '|' + i, cls: 'is-slot ' + (sel === i ? 'is-selected' : ''), note: 'Ô ' + (i + 1) + ' · uy lực ' + by('skills', eq[i]).power, desc: true}) : `<button class="mg-skill is-slot is-empty ${sel === i ? 'is-selected' : ''}" data-act="mg-slot" data-id="${esc(m.uid + '|' + i)}"><strong>Ô ${i + 1} trống</strong><small>Chọn một kỹ năng bên dưới</small></button>`).join('')}</div>
          <h4>Đã học · bấm để đặt vào ô ${sel + 1}</h4>
          <div class="mg-learned">${learned.map(id => skillCard(id, {act: 'mg-skill', token: m.uid + '|' + id, cls: eq.includes(id) ? 'is-equipped' : '', note: (eq.includes(id) ? 'Đang mang · ' : '') + 'uy lực ' + by('skills', id).power})).join('') || '<p class="small">Chưa học kỹ năng chủ động nào.</p>'}</div>
          ${upcoming.length ? `<h4>Sắp học</h4><div class="mg-upcoming">${upcoming.map(e => `<span class="mg-up"><b>Cấp ${e.level}</b> ${esc(c.plain ? c.plain(by('skills', e.skillId).name) : by('skills', e.skillId).name)}</span>`).join('')}</div>` : ''}
        </section>
        <section class="card mg-grow"><h3>Nâng cấp và nuôi dưỡng</h3>
          <div class="mg-feeds">${feeds || '<p class="small">Bạn chưa có vật phẩm nuôi dưỡng. Thắng trận, mua ở cửa hàng hoặc nhận từ phần thưởng để có Bánh Tro, Bữa Ăn Ấm, Đá Thức Hồn…</p>'}</div>
          ${evoHtml}
        </section>
        ${adminHtml}
        <div class="row">${c.canBack && c.canBack() ? c.button('← Quay lại', 'back') : c.button('Về đội hình', 'party')}${c.button('Hồ sơ loài', 'monster', m.speciesId)}${inParty && s.party.length > 1 ? c.button('Gửi vào kho', 'store', m.uid) : ''}</div>
      </div>`, 'party');
      const q = document.getElementById('mg-skill-search');
      if (q) q.onchange = () => { skillQuery[m.uid] = q.value; open(m.uid); };
      g.VTNStatRadar?.mount(document);
    }

    function handle(action, id) {
      const s = c.state();
      if (!s) return false;
      if (action === 'manage') { open(id); return true; }
      const [uid, arg] = String(id).split('|');
      if (action === 'mg-slot') { slotSel[uid] = Number(arg); open(uid); return true; }
      if (action === 'mg-skill') {
        const slot = slotSel[uid] ?? 0;
        if (!L().set(s, uid, slot, arg)) c.toast('Không đặt được kỹ năng này.');
        else { slotSel[uid] = (slot + 1) % 4; c.save(); }
        open(uid); return true;
      }
      if (action === 'mg-food') {
        const m = find(id), h = s.hero;
        if (!m || !(h.bag.food > 0)) return true;
        h.bag.food--; const nat = by('natures', m.natureId);
        m.bond = R.clamp(m.bond + 15 * (nat?.bondMultiplier || 1), 0, 100);
        m.hp = Math.min(R.monsterStats(m).hp, m.hp + 45);
        c.toast('Gắn kết tăng, hồi 45 HP.'); c.save(); c.hud(); open(id); return true;
      }
      if (!admin()) return false;
      const m = find(uid);
      if (action === 'mg-level' && m) {
        const lv = arg === 'set60' ? 60 : R.clamp(m.level + Number(arg), 1, 60);
        m.level = lv; m.exp = 0; const st = R.monsterStats(m); m.hp = st.hp; m.mp = st.mp;
        c.save(); c.hud(); open(uid); return true;
      }
      if (action === 'mg-heal' && m) { const st = R.monsterStats(m); m.hp = st.hp; m.mp = st.mp; m.status = null; c.save(); open(id); return true; }
      if (action === 'mg-bond' && m) { m.bond = 100; c.save(); open(id); return true; }
      if (action === 'mg-learn' && m) {
        m.learnedSkills = Array.isArray(m.learnedSkills) ? m.learnedSkills : [];
        if (!m.learnedSkills.includes(arg)) m.learnedSkills.push(arg);
        c.save(); c.toast('Đã học ' + (by('skills', arg)?.name || arg) + '.'); open(uid); return true;
      }
      return false;
    }
    return {open, handle};
  }
  g.VTNManage = {create};
})(window);
