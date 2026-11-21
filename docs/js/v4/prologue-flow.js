/* Nối kịch bản mở đầu V5 (cảnh p5_13..p5_21) vào gameplay Uyên Khẩu: điểm tương tác, trận hướng dẫn, đồng hành, mở thế giới.
   Cảnh chạy bằng VTNStory.startScene(id,{from,until}); trận đấu bắt đầu từ hook và quay lại cảnh khi thắng (VTNPrologueFlow.afterBattle). */
(function (g) {
  'use strict';
  const G = () => g.VTNGame, S = () => G()?.storyState?.(), R = () => g.VTNRules, D = () => g.VTN_DATA;
  const flag = k => !!S()?.flags?.['p5_' + k];
  const setFlag = (k, v = true) => { const s = S(); if (s) { s.flags ??= {}; s.flags['p5_' + k] = v; } };
  const PV = () => D()?.prologue_vars || {};
  const play = (id, opts = {}) => g.VTNStory?.startScene?.(id, opts);
  const toast = t => G()?.act?.('toast', t);
  const say = t => { try { document.getElementById('toast').textContent = t; document.getElementById('toast').style.display = 'block'; setTimeout(() => { document.getElementById('toast').style.display = 'none'; }, 3200); } catch { /* không có giao diện */ } };

  // ---- thêm đồng hành (một lần, không nhân đôi, hết chỗ thì vào kho)
  function joinHeart(which) {
    const s = S(), r = R(); if (!s || !r) return;
    const key = 'p5_joined_' + which; if (s.flags[key]) return; s.flags[key] = true;
    const species = which === 'first' ? PV().firstHeartBeast : PV().caveHeartBeast;
    const id = species || (which === 'first' ? 'M-005' : 'M-001');
    if (!r.by?.('monsters', id)) return;
    const m = r.instantiate(id, Math.max(1, Math.min(4, s.hero.level || 1)));
    m.bond = 40; m.heart = 'restored';
    const st = r.monsterStats(m); m.hp = st.hp; m.mp = st.mp;
    if (!s.caught.includes(id)) s.caught.push(id);
    if (!s.seen.includes(id)) s.seen.push(id);
    if (s.party.length < 5) s.party.push(m); else (s.storage ??= []).push(m);
    G()?.save?.();
    say('Dấu khế mới: ' + (r.by('monsters', id)?.name || id) + (s.party.includes(m) ? '' : ' (đã vào kho khế thú).'));
  }

  // ---- hook của engine hội thoại
  const hooks = {
    enterAbyssTomb() { setFlag('TOMB_ENTERED'); },
    joinHeart(s, e) { joinHeart(e.which); },
    startCaveBattle() { setFlag('CAVE_BATTLE_PENDING'); },
    startLinhChu() { setFlag('LINH_BATTLE_PENDING'); },
    startRootBattle() { setFlag('ROOT_BATTLE_PENDING'); },
    talentRankUpPrologue() {
      const s = S(); if (!s || s.flags.p5_talent_up) return; s.flags.p5_talent_up = true;
      try { R().talentRankUp(s); } catch (err) { console.warn(err); }
    },
    unlockWorld() {
      const s = S(); if (!s) return; s.flags.prologueDone = true; setFlag('WORLD_UNLOCKED');
      G()?.act?.('travel-force', 'region_01');
    }
  };
  g.VTNPrologueHooks = Object.assign(g.VTNPrologueHooks || {}, hooks);

  // sau khi một cảnh kết thúc: nếu cảnh đặt cờ chờ trận thì mở trận
  function afterScene() {
    const s = S(); if (!s) return;
    if (s.flags.p5_CAVE_BATTLE_PENDING) { s.flags.p5_CAVE_BATTLE_PENDING = false; G().act('p5-battle', 'cave'); }
    else if (s.flags.p5_LINH_BATTLE_PENDING) { s.flags.p5_LINH_BATTLE_PENDING = false; G().act('p5-battle', 'linh'); }
    else if (s.flags.p5_ROOT_BATTLE_PENDING) { s.flags.p5_ROOT_BATTLE_PENDING = false; G().act('p5-battle', 'root'); }
  }
  const run = (id, opts = {}) => play(id, { ...opts, onEnd: () => { try { opts.onEnd?.(); } catch (e) { console.warn(e); } afterScene(); } });

  // ---- sau trận thắng
  function afterBattle(kind) {
    const s = S(); if (!s) return;
    if (kind === 'cave') { setFlag('CAVE_TUTORIAL_DONE'); run('p5_15', { from: 'P15_Q01', until: 'P15_Q03' }); }
    else if (kind === 'linh') { setFlag('LINH_CHU_DEFEATED'); run('p5_18', { from: 'P18_WIN' }); }
    else if (kind === 'root') { run('p5_19', { from: 'P19_WIN' }); }
  }

  // ---- điểm tương tác
  function interact(point) {
    const s = S(); if (!s) return;
    const f = point.flow || point.id;
    if (f === 'tomb_door') {
      if (!flag('FIRST_HEART_EVENT')) { setFlag('FIRST_HEART_EVENT'); run('p5_14', {}); return; }
      if (flag('FIRST_HEART_FREED') && !flag('FIRST_HEART_JOINED')) { setFlag('P14_REVISIT'); run('p5_14', { from: 'P14_REVISIT' }); return; }
      if (!flag('FIRST_HEART_FREED')) { run('p5_14', { from: 'P14_RETRY' }); return; }
      say('Con thú đang nằm nghỉ cạnh bát nước.'); return;
    }
    if (f === 'cave_enter') {
      if (!flag('CAVE_INTRO_DONE')) { setFlag('CAVE_INTRO_DONE'); run('p5_15', { until: 'P15_Q01' }); return; }
      if (flag('CAVE_TUTORIAL_DONE') && !flag('CAVE_HEART_FREED') && !flag('CAVE_HEART_DEPARTED') && !flag('CAVE_HEART_JOINED')) { run('p5_15', { from: 'P15_Q01', until: 'P15_Q03' }); return; }
      say('Hang Tro im lặng. Tro vẫn rơi.'); return;
    }
    if (f === 'tamho') {
      if (flag('TAMHO_SEEN')) { say('Khe đá chỉ còn tro lạnh.'); return; }
      setFlag('TAMHO_SEEN'); run('p5_15', { from: 'P15_Q03', until: 'P15_Q04' }); return;
    }
    if (f === 'name_tag') {
      if (flag('NAM_CARD_FOUND') || flag('NAM_CARD_SEEN')) { say('Thẻ tên đã nằm trong hành trang của bạn.'); return; }
      setFlag('NAM_CARD_SEEN'); run('p5_17', { until: 'P17_Q02' }); return;
    }
    if (f === 'linh_chu') {
      if (flag('LINH_CHU_DEFEATED')) { say('Linh Chu đã lùi sâu vào bóng tối.'); return; }
      run('p5_18', { until: 'P18_WIN' }); return;
    }
    if (f === 'root_core') {
      if (flag('ROOT_CLEARED')) { say('Búi rễ đã im.'); return; }
      run('p5_19', { until: 'P19_WIN' }); return;
    }
    if (f === 'tomb_exit') {
      if (!flag('FAREWELL_DONE')) { say('Bạn chưa chào ông Thủ Mộ. Hãy nói chuyện với ông trước khi đi.'); return; }
      run('p5_21', {}); return;
    }
  }

  // ---- Lão Thủ Mộ: tuỳ giai đoạn chạy cảnh chia tay, hoặc menu chủ đề
  function talk() {
    const s = S(); if (!s) return false;
    if (flag('ROOT_CLEARED') && !flag('FAREWELL_DONE')) { run('p5_20', { until: 'P20_REVISIT', onEnd: () => {} }); return true; }
    if (flag('FAREWELL_DONE')) { play('p5_20', { from: 'P20_REVISIT' }); return true; }
    const topics = [];
    topics.push(['Hỏi chuyện ông lão', () => play('p5_15', { from: 'P15_Q04' })]);
    if (flag('NAM_CARD_FOUND') && !flag('NAM_CARD_SHOWN')) topics.push(['Cho ông xem chiếc thẻ học sinh', () => play('p5_17', { from: 'P17_Q02' })]);
    else if (flag('NAM_CARD_FOUND')) topics.push(['Chuyện chiếc thẻ học sinh', () => play('p5_17', { from: 'P17_Q03' })]);
    if (flag('MEMORY_01') || flag('MEMORY_02') || flag('MEMORY_03')) topics.push(['Kể về những trang giấy', () => play('p5_16', { from: 'P16_Q04' })]);
    g.VTNPrologueFlow._topics = topics;
    return topics;
  }

  g.VTNPrologueFlow = {interact, talk, afterBattle, hooks, run, state: () => ({flags: Object.fromEntries(Object.entries(S()?.flags || {}).filter(([k]) => /^p5_/.test(k)))})};
})(window);
