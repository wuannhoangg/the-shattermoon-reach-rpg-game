/* VTNQuests — data-driven quest engine (spec: docs/design/QUEST_SCHEMA_V5.md).
 * Core logic works on a plain state object so it can be tested in node (see tests/quests.test.mjs).
 * UI parts (tracker, quest log, offer / choice modals) only run when ctx.show exists. */
(function (g) {
  'use strict';
  const RANKS = ['D', 'C', 'B', 'A', 'S', 'S+', 'S++'];
  const KIND_LABEL = { main: 'Chính tuyến', cast: 'Đồng hành', region: 'Vùng đất', race: 'Bi kịch tộc', monster: 'Dấu vết', side: 'Phụ', event: 'Sự kiện', lore: 'Truyền thuyết' };
  const CAST_NAME = { khoi: 'Tạ Minh Khôi', huy: 'Đàm Gia Huy', vy: 'Nguyễn Thảo Vy', bao: 'Trịnh Quốc Bảo' };
  const TAB_DEFS = [['main', 'Chính tuyến'], ['cast', 'Đồng hành'], ['region', 'Vùng đất'], ['side', 'Phụ & sự kiện'], ['clues', 'Dấu vết'], ['done', 'Đã xong']];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, k => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[k]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rankIndex = r => Math.max(0, RANKS.indexOf(r));
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  function create(ctx) {
    const D = ctx.D;
    const quests = new Map(), scenes = new Map(), clueDefs = new Map();
    for (const q of D.questsV5 || []) quests.set(q.id, q);
    for (const s of D.questScenes || []) scenes.set(s.id, s);
    for (const pack of Object.values(D.storyRegions || {})) for (const s of pack.scenes || []) scenes.set(s.id, s);
    for (const c of D.clues_v5 || []) clueDefs.set(c.id, c);
    const S = () => ctx.state();
    let dirty = true, lastEval = 0, evaluating = false, openTab = 'main', openRegion = '', modalQuest = null, bypass = null;

    /* ---------- state ---------- */
    function ensure(s = S()) {
      if (!s) return null;
      s.q ??= { active: {}, done: {}, failed: {}, tracked: null, seen: {}, offered: {} };
      s.q.active ??= {}; s.q.done ??= {}; s.q.failed ??= {}; s.q.seen ??= {}; s.q.offered ??= {};
      s.clues2 ??= { T1: [], T2: [], T3: [] };
      s.reveals ??= { T1: false, T2: false, T3: false };
      s.overlordState ??= {}; s.overlordsResolved ??= 0; s.heartsReturned ??= [];
      s.cast ??= { khoi: { state: 'unknown', meetCount: 0, relationship: 0 }, huy: { state: 'unknown', meetCount: 0, relationship: 0 }, vy: { state: 'unknown', meetCount: 0, relationship: 0 }, bao: { state: 'unknown', meetCount: 0, relationship: 0 } };
      s.worldWave ??= 0; s.flags ??= {};
      return s.q;
    }
    const qs = () => ensure(S());
    const isDone = id => !!qs()?.done[id];
    const isActive = id => !!qs()?.active[id];
    const clueCount = k => (S()?.clues2?.[k] || []).length;
    const rankOf = () => ctx.rank ? ctx.rank(S()) : (S()?.hero?.talent?.rank || 'D');

    /* ---------- prerequisites ---------- */
    function prereqMet(q) {
      const s = S(), p = q.prereq; if (!s) return false; if (!p) return true;
      for (const f of p.flags || []) if (!s.flags[f]) return false;
      for (const f of p.notFlags || []) if (s.flags[f]) return false;
      for (const r of p.quests || []) { const d = s.q.done[r.id]; if (!d) return false; if (r.outcome && d.outcome !== r.outcome) return false; }
      for (const r of p.notQuests || []) if (s.q.done[r] || s.q.active[r]) return false;
      if (p.talentRank && rankIndex(rankOf()) < rankIndex(p.talentRank)) return false;
      if ((p.overlordsResolved || 0) > (s.overlordsResolved || 0)) return false;
      if ((p.heartsReturned || 0) > (s.heartsReturned || []).length) return false;
      for (const [k, n] of Object.entries(p.clues || {})) if (clueCount(k) < n) return false;
      if ((p.worldWave || 0) > (s.worldWave || 0)) return false;
      if ((p.minDay || 0) > (s.day || 1)) return false;
      if ((p.level || 0) > (s.hero?.level || 1)) return false;
      if (p.region && ctx.regionOf?.(s.mapId) !== p.region) return false;
      return true;
    }
    const isAvailable = q => !isDone(q.id) && !isActive(q.id) && !qs().failed[q.id] && !q.giver?.auto && prereqMet(q);

    /* ---------- goals ---------- */
    const stageOf = (q, id) => q.stages.find(st => st.id === id);
    const curStage = q => { const a = qs().active[q.id]; return a ? stageOf(q, a.stage) : null; };
    function touched(a, id) { return !!(id && a.data.touched?.[id]); }
    function goalMet(q, a, goal) {
      const s = S(); if (!goal) return true;
      switch (goal.type) {
        case 'goto': { let t = goal.target || curStage(q)?.target; if (!t) return true; if (t.npcId || t.pointId) t = { ...t, ...(ctx.points?.(t.mapId) || []).find(p => p.id === (t.npcId || t.pointId)) }; else if (t.placeKey) t = g.VTNBeats?.locate(t) || t; return s.mapId === t.mapId && t.x != null && cheb(s, t) <= (t.radius ?? 1); }
        case 'enterMap': return s.mapId === goal.mapId;
        case 'talk': case 'interact': case 'deliver': {
          const id = goal.npcId || goal.pointId; if (!touched(a, id)) return false;
          if (goal.scene && !a.data.sceneDone?.[goal.scene]) return false;
          if (goal.type === 'deliver' && (s.hero.bag[goal.itemId] || 0) < (goal.count || 1)) return false;
          return true;
        }
        case 'defeat': return (a.data.kills || 0) >= (goal.count || 1);
        case 'capture': return (s.caught || []).includes(goal.speciesId);
        case 'collect': return (s.hero.bag[goal.itemId] || 0) >= (goal.count || 1);
        case 'investigate': return (s.clues2[(goal.clueId || '').slice(0, 2)] || []).includes(goal.clueId);
        case 'scene': return !!a.data.sceneDone?.[goal.scene] || (s.scenesSeen || []).includes(goal.scene);
        case 'choice': return !!a.data.chosen?.[curStage(q)?.id];
        case 'wait': { const start = a.data.stageDay ?? s.day; const days = (s.day - start) + ((s.minutes || 0) >= (goal.untilHour ? goal.untilHour * 60 : 0) ? 0 : 0); return days >= (goal.days || 0) && (goal.untilHour == null || (s.minutes || 0) / 60 >= goal.untilHour || days > (goal.days || 0)); }
        case 'flag': return !!s.flags[goal.flag];
        case 'rank': return rankIndex(rankOf()) >= rankIndex(goal.talentRank);
        case 'resolveOverlord': return ['sealed', 'heartRestored', 'permanentlyDead', 'temporarilyFreed'].includes(s.overlordState[goal.region]);
        case 'any': return (goal.goals || []).some(x => goalMet(q, a, x));
        case 'all': return (goal.goals || []).every(x => goalMet(q, a, x));
        default: return false;
      }
    }

    /* ---------- effects ---------- */
    function addClue(id, quiet) {
      const s = S(), k = id.slice(0, 2); if (!s.clues2[k]) return false;
      if (s.clues2[k].includes(id)) return false;
      s.clues2[k].push(id);
      const def = clueDefs.get(id);
      if (!quiet) ctx.toast?.('Manh mối mới · ' + (def?.title || id));
      ctx.log?.('Dấu vết ' + id + (def ? ': ' + def.title : ''));
      const n = s.clues2[k].length;
      if (n === 2 && !s.reveals[k]) ctx.toast?.('Một nghi vấn đang hình thành (' + k + ').');
      if (n >= 3 && !s.reveals[k]) { s.reveals[k] = true; s.flags['reveal_' + k] = true; }
      if (n >= 5) s.flags['full_' + k] = true;
      return true;
    }
    function setOverlord(region, state) {
      const s = S(); s.overlordState[region] = state;
      s.overlordsResolved = Object.values(s.overlordState).filter(v => ['sealed', 'heartRestored', 'permanentlyDead', 'temporarilyFreed'].includes(v)).length;
      if (state === 'heartRestored' && !s.heartsReturned.includes(region)) s.heartsReturned.push(region);
    }
    function applyEffects(e, src = {}) {
      const s = S(); if (!e || !s) return;
      ensure(s);
      for (const f of e.setFlags || []) s.flags[f] = true;
      for (const f of e.clearFlags || []) delete s.flags[f];
      if (e.addClue) for (const id of [].concat(e.addClue)) addClue(id);
      if (e.gold) s.hero.gold = Math.max(0, s.hero.gold + e.gold);
      if (e.exp) ctx.heroExp?.(e.exp);
      for (const [id, n] of Object.entries(e.items || {})) s.hero.bag[id] = (s.hero.bag[id] || 0) + n;
      for (const [id, n] of Object.entries(e.takeItems || {})) s.hero.bag[id] = Math.max(0, (s.hero.bag[id] || 0) - n);
      for (const [f, n] of Object.entries(e.rep || {})) if (s.factions && f in s.factions) s.factions[f] = clamp(s.factions[f] + n, -100, 100);
      if (e.corruption) s.hero.corruption = clamp((s.hero.corruption || 0) + e.corruption, 0, 100);
      if (e.memory) { const m = String(e.memory); if (m[0] === '-') { const id = m.slice(1); const i = id ? s.hero.memories.indexOf(id) : s.hero.memories.length - 1; if (i >= 0) s.hero.lostMemories.push(s.hero.memories.splice(i, 1)[0]); } else { const id = m[0] === '+' ? m.slice(1) : m; if (!s.hero.memories.includes(id) && s.hero.memories.length < 12) s.hero.memories.push(id); } }
      if (e.unlockRace) ctx.unlockRace?.(e.unlockRace);
      if (e.overlord) setOverlord(e.overlord.region, e.overlord.state);
      if (e.rank && rankIndex(e.rank) > rankIndex(rankOf())) { s.hero.talent ??= { id: 'khe_hon', rank: 'D', xp: 0 }; s.hero.talent.rank = e.rank; ctx.toast?.('Khế Hồn đạt hạng ' + e.rank + '.'); }
      for (const [k, v] of Object.entries(e.castState || {})) { const c = s.cast[k] ??= { state: 'unknown', meetCount: 0, relationship: 0 }; for (const [kk, vv] of Object.entries(v)) { if (typeof vv === 'string' && /^[+-]\d+$/.test(vv)) c[kk] = (Number(c[kk]) || 0) + Number(vv); else c[kk] = vv; } }
      if (e.worldWave) s.worldWave = typeof e.worldWave === 'string' && /^[+-]/.test(e.worldWave) ? s.worldWave + Number(e.worldWave) : Number(e.worldWave);
      if (e.unlockMap && !s.visited.includes(e.unlockMap)) s.flags['open_' + e.unlockMap] = true;
      if (e.teleport) ctx.teleport?.(e.teleport.mapId, e.teleport);
      if (e.toast) ctx.toast?.(e.toast);
      if (e.log) ctx.log?.(e.log);
      if (e.startQuest) for (const id of [].concat(e.startQuest)) startQuest(id, true);
      if (e.completeQuest) finishQuest(e.completeQuest.id, e.completeQuest.outcome || 'done', true);
      dirty = true;
    }

    /* ---------- lifecycle ---------- */
    function startQuest(id, silent) {
      const q = quests.get(id), s = S(); if (!q || !s) return false; ensure(s);
      if (s.q.active[id] || s.q.done[id]) return false;
      const first = q.stages[0];
      s.q.active[id] = { stage: first?.id, startedDay: s.day, data: { touched: {}, sceneDone: {}, chosen: {}, kills: 0, stageDay: s.day } };
      s.q.seen[id] = true;
      if (!s.q.tracked || (q.kind === 'main' && quests.get(s.q.tracked)?.kind !== 'main') || !s.q.active[s.q.tracked]) s.q.tracked = id;
      if (!silent) ctx.toast?.('Lời hứa mới · ' + q.title);
      ctx.log?.('Nhận: ' + q.title);
      applyEffects(q.onStart);
      enterStage(q, first, true);
      dirty = true; return true;
    }
    function enterStage(q, stage, first) {
      const s = S(), a = s.q.active[q.id]; if (!a || !stage) return;
      a.stage = stage.id; a.data.touched = {}; a.data.kills = 0; a.data.stageDay = s.day;
      if (!first) ctx.toast?.('Mục tiêu · ' + stage.label);
      applyEffects(stage.onEnter);
      const sc = stage.scene || (['scene', 'choice'].includes(stage.goal?.type) ? stage.goal.scene : null);
      if (sc && !stage.goal?.external && (stage.scenePhase || 'enter') === 'enter' && !['talk', 'interact', 'deliver'].includes(stage.goal?.type)) playScene(q, sc);
      if (stage.goal?.type === 'choice' && !sc) queueMicrotask(() => { if (curStage(q)?.id === stage.id) showChoice(q, stage); });
      dirty = true;
    }
    function playScene(q, sceneId, then) {
      const a = S().q.active[q.id];
      const done = () => { const aa = S().q.active[q.id]; if (aa) { aa.data.sceneDone[sceneId] = true; } dirty = true; if (then) then(); evaluate(true); };
      if (!ctx.startScene || !ctx.startScene(sceneId, { onEnd: done })) done();
    }
    function advance(q, via) {
      const s = S(), a = s.q.active[q.id]; if (!a) return;
      const stage = stageOf(q, a.stage); if (!stage) return;
      if (stage.scene && stage.scenePhase === 'complete' && !a.data.sceneDone[stage.scene]) { playScene(q, stage.scene, () => advance(q, via)); return; }
      applyEffects(stage.onComplete);
      const next = (via && via.next) || stage.next, fin = (via && via.finish) || stage.finish;
      if (fin) { finishQuest(q.id, fin); return; }
      if (next) { const ns = stageOf(q, next); if (ns) { enterStage(q, ns); return; } }
      const i = q.stages.indexOf(stage), ns = q.stages[i + 1];
      if (ns) enterStage(q, ns); else finishQuest(q.id, 'done');
    }
    function finishQuest(id, outcome, silent) {
      const q = quests.get(id), s = S(); if (!q || !s) return; ensure(s);
      if (s.q.done[id]) return;
      const out = q.outcomes?.[outcome];
      delete s.q.active[id]; s.q.done[id] = { outcome, day: s.day };
      if (out?.effects) applyEffects(out.effects);
      applyEffects(q.onFinish);
      if (!silent) ctx.toast?.('Hoàn thành · ' + q.title + (out?.label ? ' — ' + out.label : ''));
      ctx.log?.('Xong: ' + q.title + (out?.log ? ' · ' + out.log : ''));
      if (s.q.tracked === id) s.q.tracked = nextTracked();
      dirty = true; ctx.save?.();
    }
    function abandon(id) { const q = quests.get(id), s = S(); if (!q || q.kind === 'main' || q.kind === 'cast' || !s.q.active[id]) return false; delete s.q.active[id]; delete s.q.seen[id]; if (s.q.tracked === id) s.q.tracked = nextTracked(); dirty = true; return true; }
    function nextTracked() {
      const act = Object.keys(S().q.active).map(id => quests.get(id)).filter(Boolean);
      return (act.find(q => q.kind === 'main') || act[0])?.id || null;
    }
    function failCheck(q) {
      const f = q.failure; if (!f) return;
      if ((f.when || []).some(w => w.startsWith('flag:') && S().flags[w.slice(5)])) finishQuest(q.id, f.outcome || 'failed');
    }

    /* ---------- evaluation ---------- */
    function evaluate(force) {
      const s = S(); if (!s || evaluating) return; ensure(s);
      const now = Date.now(); if (!force && !dirty && now - lastEval < 400) return;
      evaluating = true; lastEval = now; dirty = false;
      try {
        for (let pass = 0; pass < 6; pass++) {
          let changed = false;
          for (const q of quests.values()) {
            if (s.q.done[q.id] || s.q.active[q.id]) continue;
            if (q.giver?.auto && !s.q.failed[q.id] && prereqMet(q)) { startQuest(q.id); changed = true; }
          }
          for (const id of Object.keys(s.q.active)) {
            const q = quests.get(id); if (!q) continue; failCheck(q); if (!s.q.active[id]) { changed = true; continue; }
            const a = s.q.active[id], st = stageOf(q, a.stage);
            if (st && goalMet(q, a, st.goal) && !(st.goal?.type === 'choice' && !a.data.chosen[st.id])) {
              if (st.goal?.type === 'choice') { const opt = (st.goal.options || []).find(o => o.id === a.data.chosen[st.id]); advance(q, opt); } else advance(q);
              changed = true;
            }
          }
          if (!changed) break;
        }
      } finally { evaluating = false; }
    }

    /* ---------- events ---------- */
    function onBattleWon(info) {
      if (info.ref === 'KHOI_SPP') { S().flags.battle_KHOI_SPP_won = true; }
      const s = S(); if (!s) return; ensure(s);
      for (const id of Object.keys(s.q.active)) {
        const q = quests.get(id), a = s.q.active[id], st = q && stageOf(q, a.stage); if (!st) continue;
        for (const goal of flat(st.goal)) {
          if (goal.type !== 'defeat') continue;
          const hitSpecies = !goal.speciesId || (info.species || []).includes(goal.speciesId);
          const hitNpc = !goal.npcId || info.ref === goal.npcId;
          const hitMap = !goal.inMap || goal.inMap === info.mapId;
          if (hitSpecies && hitNpc && hitMap) a.data.kills = (a.data.kills || 0) + 1;
        }
      }
      dirty = true;
    }
    const flat = goal => !goal ? [] : (goal.goals ? goal.goals.flatMap(flat) : [goal]);
    function activeGoalsFor(id) {
      const s = S(), out = []; if (!s) return out;
      for (const qid of Object.keys(s.q.active)) { const q = quests.get(qid), a = s.q.active[qid], st = q && stageOf(q, a.stage); if (!st) continue; for (const goal of flat(st.goal)) if ((goal.npcId === id || goal.pointId === id) && ['talk', 'interact', 'deliver'].includes(goal.type)) out.push({ q, a, st, goal }); }
      return out;
    }
    /* returns true when the interaction was consumed by a quest */
    function intercept(point) {
      const s = S(); if (!s) return false; ensure(s);
      const id = point.npc?.id || point.id;
      const matches = activeGoalsFor(id);
      let consumed = false;
      for (const m of matches) {
        if (m.goal.type === 'deliver' && (s.hero.bag[m.goal.itemId] || 0) < (m.goal.count || 1)) { ctx.toast?.('Cần ' + (m.goal.itemName || m.goal.itemId) + ' để trao.'); consumed = true; continue; }
        if (m.goal.type === 'deliver' && m.goal.consume !== false) s.hero.bag[m.goal.itemId] = Math.max(0, (s.hero.bag[m.goal.itemId] || 0) - (m.goal.count || 1));
        m.a.data.touched[id] = true; dirty = true;
        if (m.goal.scene) { consumed = true; playScene(m.q, m.goal.scene); }
        else if (m.goal.lines) { consumed = true; showLines(m.goal.lines, m.goal.speaker || point.name, () => { evaluate(true); }); }
        else { /* touch only: let the normal behaviour continue when the point is a regular NPC/clue */ if (point.questPoint) { consumed = true; ctx.toast?.('Đã xong việc ở đây.'); } }
      }
      if (consumed) { evaluate(true); return true; }
      if (matches.length) { evaluate(true); return false; }
      if (bypass === id) { bypass = null; return false; }
      const offer = Array.from(quests.values()).find(q => isAvailable(q) && q.giver && (q.giver.npcId === id || q.giver.pointId === id));
      if (offer) { showOffer(offer, id); return true; }
      if (point.questPoint) { ctx.toast?.(point.text || 'Chưa có gì để làm ở đây.'); return true; }
      return false;
    }
    function onFlag() { dirty = true; }
    function touchGeneric() { dirty = true; }

    /* ---------- dynamic world points ---------- */
    function dynamicPoints(mapId) {
      const s = S(); if (!s?.q) return [];
      const out = [];
      for (const id of Object.keys(s.q.active)) {
        const q = quests.get(id), a = s.q.active[id], st = q && stageOf(q, a.stage); if (!st?.points) continue;
        for (const p of st.points) {
          if (p.mapId !== mapId) continue;
          const pos = g.VTNBeats?.locate(p) || p;
          const dp = { id: p.id, type: p.type === 'quest-npc' ? 'npc' : (p.type || 'quest-object'), questPoint: true, x: pos.x, y: pos.y, name: p.name || '', text: p.text, sprite: p.sprite, blocking: p.blocking !== false };
          if (p.type === 'quest-npc') { dp.npc = { id: p.id, name: p.name, raceId: p.npcLook?.raceId || 'R-01', castKey: p.npcLook?.castKey || null, gender: p.npcLook?.gender, age: p.npcLook?.age, build: p.npcLook?.build, static: true, quest: true, wander: 'static' }; dp.questNpc = true; dp.type = 'npc'; }
          out.push(dp);
        }
      }
      return out;
    }

    /* ---------- objective for guidance ---------- */
    function targetOf(goal, stage) {
      let t = stage.target;
      if (t?.placeKey) t = g.VTNBeats?.locate(t) || t;
      if (t) return { mapId: t.mapId, pointId: t.pointId, npcId: t.npcId, x: t.x, y: t.y, alts: (t.alt || []).map(v => ({ mapId: v.mapId, pointId: v.pointId, npcId: v.npcId, x: v.x, y: v.y })) };
      for (const gl of flat(goal)) {
        if (gl.npcId) { const npc = (D.npcs || []).find(n => n.id === gl.npcId); if (npc) return { mapId: npc.mapId, npcId: gl.npcId }; }
        if (gl.mapId) return { mapId: gl.mapId };
        if (gl.target) return gl.target;
      }
      return null;
    }
    function objective(id) {
      const s = S(); if (!s?.q) return null;
      const qid = id || s.q.tracked, q = quests.get(qid), a = s.q.active[qid];
      if (!q || !a) return null;
      const st = stageOf(q, a.stage); if (!st) return null;
      const dest = targetOf(st.goal, st);
      return { questId: q.id, stageId: st.id, title: q.title, label: st.label, hint: st.hint, dest, mapId: dest?.mapId, point: dest?.pointId ? { id: dest.pointId } : dest?.npcId ? { id: dest.npcId, npc: { id: dest.npcId } } : null };
    }
    function giverDest(q) {
      const gv = q.giver || {}; const npc = gv.npcId ? (D.npcs || []).find(n => n.id === gv.npcId) : null;
      return { mapId: gv.mapId || npc?.mapId, npcId: gv.npcId, pointId: gv.pointId };
    }
    function markersForMap(mapId) {
      const s = S(); if (!s?.q) return []; const out = [], pts = ctx.points?.(mapId) || [];
      const find = d => pts.find(p => (d.npcId && (p.npc?.id === d.npcId || p.id === d.npcId)) || (d.pointId && p.id === d.pointId));
      for (const q of quests.values()) {
        if (isAvailable(q)) { const d = giverDest(q); if (d.mapId === mapId) { const p = find(d); if (p) out.push({ x: Math.round(p.renderX ?? p.x), y: Math.round(p.renderY ?? p.y), kind: 'available', questId: q.id }); } }
      }
      for (const id of Object.keys(s.q.active)) {
        if (id === s.q.tracked) continue;
        const o = objective(id); if (o?.dest?.mapId === mapId) { const p = o.dest.x != null && !o.dest.pointId && !o.dest.npcId ? { x: o.dest.x, y: o.dest.y } : find(o.dest); if (p) out.push({ x: Math.round(p.renderX ?? p.x), y: Math.round(p.renderY ?? p.y), kind: 'active', questId: id }); }
      }
      return out;
    }

    /* ---------- final gate (Story Bible s.33) ---------- */
    function finalGate() {
      const s = S(); ensure(s);
      const t3 = clueCount('T3'), lamps = (s.heartsReturned || []).length + 3; // 3 Lived Witnesses from the prologue always count
      const resolved = s.overlordsResolved || 0;
      if (t3 >= 3 && lamps >= 3) return { road: 'evidence', ok: true, missing: [] };
      if (resolved >= 6 && t3 >= 2 && lamps >= 3) return { road: 'confront', ok: true, missing: [] };
      const missing = []; if (t3 < 3) missing.push('Cần ít nhất 3/5 manh mối T3 (đang có ' + t3 + ')'); if (resolved < 6) missing.push('Hoặc giải quyết 6 Bá Chủ (đang có ' + resolved + ')');
      return { road: 'reckless', ok: true, missing };
    }

    /* ---------- UI ---------- */
    const hasUI = () => typeof ctx.show === 'function';
    const kindTag = q => `<span class="vtn-tag qk qk-${q.kind}">${esc(KIND_LABEL[q.kind] || q.kind)}</span>`;
    function stageChecklist(q) {
      const s = S(), a = s.q.active[q.id], d = s.q.done[q.id];
      const idx = a ? q.stages.findIndex(st => st.id === a.stage) : q.stages.length;
      return `<ol class="qstages">${q.stages.filter(st => !st.hidden || d || q.stages.indexOf(st) <= idx).map(st => { const i = q.stages.indexOf(st); const cls = d || i < idx ? 'is-done' : i === idx ? 'is-now' : 'is-later'; const label = !d && i > idx ? (st.hidden ? '???' : st.label) : st.label; return `<li class="${cls}">${esc(label)}${st.optional ? ' <em>(tùy chọn)</em>' : ''}</li>`; }).join('')}</ol>`;
    }
    function questCard(q, mode) {
      const s = S(), d = s.q.done[q.id], act = s.q.active[q.id], reg = q.region ? ctx.regionName?.(q.region) : '';
      const out = d ? q.outcomes?.[d.outcome] : null;
      const buttons = act ? `<button data-act="q-track" data-id="${esc(q.id)}" ${s.q.tracked === q.id ? 'disabled' : ''}>${s.q.tracked === q.id ? 'Đang theo dõi' : 'Theo dõi'}</button><button data-act="q-go" data-id="${esc(q.id)}">Dẫn đường</button>${q.kind === 'main' || q.kind === 'cast' ? '' : `<button data-act="q-abandon" data-id="${esc(q.id)}" class="route-cancel">Bỏ</button>`}`
        : mode === 'available' ? `<button data-act="q-giver" data-id="${esc(q.id)}">Tìm người giao việc</button>` : '';
      return `<article class="card qcard ${act ? 'is-active' : ''} ${d ? 'is-done' : ''}"><div class="qhead">${kindTag(q)}${reg ? `<span class="qreg">${esc(reg)}</span>` : ''}${q.level ? `<span class="qlvl">Cấp ${q.level[0]}–${q.level[1]}</span>` : ''}</div><h3>${esc(q.title)}</h3><p>${esc(q.summary || '')}</p>${act || d ? stageChecklist(q) : ''}${d ? `<p class="good">${esc(out?.label || 'Đã hoàn thành')}${out?.log ? ' · ' + esc(out.log) : ''}</p>` : ''}<div class="row qbtn">${buttons}</div></article>`;
    }
    function listFor(tab) {
      const s = S(), all = Array.from(quests.values()); let items;
      if (tab === 'done') return all.filter(q => s.q.done[q.id]);
      const inTab = q => tab === 'main' ? q.kind === 'main' : tab === 'cast' ? q.kind === 'cast' : tab === 'region' ? (q.kind === 'region' || q.kind === 'race' || q.kind === 'monster') : (q.kind === 'side' || q.kind === 'event' || q.kind === 'lore');
      items = all.filter(q => inTab(q) && !s.q.done[q.id] && (s.q.active[q.id] || isAvailable(q)));
      if (tab === 'region' && openRegion) items = items.filter(q => q.region === openRegion);
      return items.sort((a, b) => (s.q.active[b.id] ? 1 : 0) - (s.q.active[a.id] ? 1 : 0));
    }
    function clueBoard() {
      const s = S(), names = { T1: 'Đồ tế · ai trả giá cho đêm triệu hồi?', T2: 'Trăng và cửa · Trăng Nguyên là gì?', T3: 'Uyên Nhãn · ai đang dắt mọi chuyện?' };
      return ['T1', 'T2', 'T3'].map(k => { const have = s.clues2[k] || []; return `<section class="clue-board"><h3>${esc(names[k])}</h3><p class="small">${have.length}/5 · ${have.length >= 5 ? 'Đủ chứng cứ để đối chất' : have.length >= 3 ? 'Đã xác nhận được bí mật' : have.length >= 2 ? 'Có nghi vấn, chưa thể kết luận' : 'Mới là những mảnh rời'}</p><div class="clue-slots">${[1, 2, 3, 4, 5].map(n => { const id = k + '-C' + n, got = have.includes(id), def = clueDefs.get(id); return `<div class="clue-slot ${got ? 'is-found' : ''}"><b>${n}</b><span>${got ? esc(def?.title || id) : '???'}</span>${got && def?.text ? `<small>${esc(def.text)}</small>` : ''}</div>`; }).join('')}</div></section>`; }).join('');
    }
    function openLog(tab) {
      if (!hasUI()) return; const s = S(); ensure(s); if (tab) openTab = tab;
      const counts = Object.fromEntries(TAB_DEFS.map(([k]) => [k, k === 'clues' ? (s.clues2.T1.length + s.clues2.T2.length + s.clues2.T3.length) : listFor(k).length + (['region','done'].includes(k) ? (g.VTNBeats?.chains(null, k === 'done')?.length || 0) : 0)]));
      const tabs = TAB_DEFS.map(([k, label]) => `<button data-act="q-tab" data-id="${k}" class="${openTab === k ? 'is-on' : ''}">${label}${counts[k] ? ` <i>${counts[k]}</i>` : ''}</button>`).join('');
      let body;
      if (openTab === 'clues') body = clueBoard();
      else {
        const list = listFor(openTab);
        const regionFilter = openTab === 'region' ? `<div class="row"><select id="q-region" data-q-region><option value="">Mọi vùng</option>${(D.regions || []).map(r => `<option value="${r.id}" ${openRegion === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>` : '';
        const beatList = ['region','done'].includes(openTab) ? (g.VTNBeats?.chains(openTab === 'region' ? openRegion || null : null, openTab === 'done') || []) : [];
        const beatsHtml = beatList.length ? `<section class="qbeats"><h3>Chuy\u1ec7n trong v\u00f9ng \u00b7 ${beatList.length}</h3><div class="qlist">${beatList.map(chain => { const b = chain.current; return `<article class="card qcard ${chain.done ? 'is-done' : ''}"><h3>${esc(chain.title)}</h3><p>${chain.played}/${chain.total} c\u1ea3nh \u0111\u00e3 tr\u1ea3i qua</p>${b ? `<p>${esc(b.title)} \u00b7 ${esc(b.place)} \u00b7 ${esc(b.actor)}</p><div class="row qbtn"><button data-act="beat-go" data-id="${esc(b.scene)}">T\u1ef1 \u0111i t\u1edbi</button></div>` : `<p>${chain.done ? '\u0110\u00e3 ho\u00e0n th\u00e0nh' : 'Ch\u1edd tin m\u1edbi ho\u1eb7c \u0111i\u1ec1u ki\u1ec7n ti\u1ebfp theo.'}</p>`}</article>`; }).join('')}</div></section>` : '';
        body = regionFilter + beatsHtml + (list.length ? `<div class="qlist">${list.map(q => questCard(q, s.q.done[q.id] ? 'done' : s.q.active[q.id] ? 'active' : 'available')).join('')}</div>` : `<p class="small qempty">${openTab === 'done' ? 'Chưa hoàn thành lời hứa nào.' : 'Chưa có lời hứa nào ở mục này. Hãy đi, nghe và hỏi chuyện người dân.'}</p>`);
      }
      const gate = finalGate();
      ctx.show('Sổ Nhiệm Vụ · Lời Hứa và Dấu Vết', `<div class="intro qintro"><p>Ngày ${s.daysSinceSummon || s.day} từ khi bị triệu hồi · ${s.overlordsResolved}/9 Bá Chủ đã giải quyết · Khế Hồn hạng ${esc(rankOf())}</p><p class="small">Lối tới khe trời: ${gate.road === 'evidence' ? 'đường chứng cứ' : gate.road === 'confront' ? 'đường đối đầu' : 'đường liều lĩnh'}${gate.missing.length ? ' — ' + esc(gate.missing.join('; ')) : ''}</p></div><div class="row qmemory"><button data-act="memory-book">Sổ Ký Ức · ${(s.hero.memories || []).length} ký ức còn giữ</button></div><div class="qtabs">${tabs}</div>${body}<div class="row"><button data-act="journal-legacy">Ký ức · phe phái · mười chương</button></div>`, 'quests');
      const sel = document.getElementById('q-region'); if (sel) sel.onchange = () => { openRegion = sel.value; openLog(); };
    }
    function renderTracker() {
      const el = document.getElementById('objective'); if (!el) return false;
      const s = S(); if (!s?.q) return false;
      const q = quests.get(s.q.tracked), a = q && s.q.active[q.id];
      if (!q || !a) {
        const avail = Array.from(quests.values()).filter(isAvailable);
        el.innerHTML = avail.length ? `<b>Có ${avail.length} lời hứa đang chờ</b><span class="tk-sub">Mở Sổ Nhiệm Vụ để xem người giao việc.</span>` : '<b>Hãy khám phá</b><span class="tk-sub">Nói chuyện với người dân để nhận lời hứa mới.</span>';
        return true;
      }
      const st = stageOf(q, a.stage), i = q.stages.indexOf(st) + 1;
      const ex = a.data.kills && st?.goal?.count ? ` (${a.data.kills}/${st.goal.count})` : st?.goal?.type === 'collect' ? ` (${Math.min(s.hero.bag[st.goal.itemId] || 0, st.goal.count || 1)}/${st.goal.count || 1})` : '';
      el.innerHTML = `<b>${esc(q.title)}</b> <span class="tk-kind">${esc(KIND_LABEL[q.kind] || '')}</span><span class="tk-sub">${esc(st?.label || '')}${esc(ex)}</span><span class="tk-step">Bước ${i}/${q.stages.length}</span>`;
      return true;
    }
    function showOffer(q, giverId) {
      if (!hasUI()) return; const gv = q.giver || {};
      ctx.show(q.title, `<div class="intro"><small>${esc(KIND_LABEL[q.kind] || '')}${q.region ? ' · ' + esc(ctx.regionName?.(q.region) || '') : ''}</small><h2>${esc(q.title)}</h2><p>${esc(q.offer || q.summary || '')}</p>${q.level ? `<p class="small">Cấp gợi ý ${q.level[0]}–${q.level[1]}</p>` : ''}</div>${stageChecklist({ ...q, id: '__preview', stages: q.stages.map((st, i) => ({ ...st, hidden: i > 1 })) })}<div class="row"><button data-act="q-accept" data-id="${esc(q.id)}">Nhận lời hứa</button><button data-act="q-talk" data-id="${esc(giverId || '')}">Nói chuyện thường</button><button data-act="close">Để sau</button></div>`, 'quest-offer');
      modalQuest = q.id;
    }
    function showLines(lines, speaker, done) {
      if (!hasUI()) { done?.(); return; }
      ctx.show(speaker || '…', `<div class="lore">${lines.map(l => `<p>${l.speaker ? `<b>${esc(l.speaker)}:</b> ` : ''}${esc(ctx.subst ? ctx.subst(l.text) : l.text)}</p>`).join('')}</div><div class="row"><button data-act="q-lines-ok">Tiếp tục</button></div>`, 'quest-lines');
      modalQuest = { done };
    }
    function optionStatus(o) {
      const s = S(), why = [];
      if (o.cond) { const c = o.cond; if (c.flag && !s.flags[c.flag]) why.push('Chưa đủ điều kiện'); if (c.notFlag && s.flags[c.notFlag]) why.push('Không còn khả dụng'); if (c.minCHA && (ctx.stats?.(s)?.CHA || 0) < c.minCHA) why.push('Cần CHA ' + c.minCHA); if (c.minINT && (ctx.stats?.(s)?.INT || 0) < c.minINT) why.push('Cần INT ' + c.minINT); if (c.rank && rankIndex(rankOf()) < rankIndex(c.rank)) why.push('Cần Khế Hồn hạng ' + c.rank); if (c.item && (s.hero.bag[c.item] || 0) < (c.itemCount || 1)) why.push('Cần ' + (c.itemName || c.item)); }
      if (o.costGold && s.hero.gold < o.costGold) why.push('Cần ' + o.costGold + ' vàng');
      if (o.costMemory && !s.hero.memories.length) why.push('Cần một ký ức thật để đánh đổi');
      return { ok: !why.length, why };
    }
    function showChoice(q, stage) {
      if (!hasUI()) return; const goal = stage.goal;
      ctx.show(q.title, `<div class="intro"><small>Lựa chọn</small><h2>${esc(goal.prompt || stage.label)}</h2>${goal.context ? `<p>${esc(goal.context)}</p>` : ''}</div><div class="qchoices">${(goal.options || []).map(o => { const st = optionStatus(o); return `<button class="qchoice" data-act="q-choose" data-id="${esc(q.id + '|' + o.id)}" ${st.ok ? '' : 'disabled'}><b>${esc(o.label)}</b>${o.consequence ? `<small>${esc(o.consequence)}</small>` : ''}${st.ok ? '' : `<em>${esc(st.why.join(' · '))}</em>`}</button>`; }).join('')}</div>${goal.cancelable ? '<div class="row"><button data-act="close">Nghĩ thêm</button></div>' : ''}`, 'quest-choice');
    }
    function choose(qid, optId) {
      const q = quests.get(qid), s = S(), a = s?.q.active[qid]; if (!q || !a) return false;
      const st = stageOf(q, a.stage), o = (st?.goal?.options || []).find(v => v.id === optId); if (!o || !optionStatus(o).ok) return false;
      if (o.costGold) s.hero.gold -= o.costGold;
      if (o.costMemory) { const m = s.hero.memories.pop(); if (m) s.hero.lostMemories.push(m); }
      a.data.chosen[st.id] = optId; s.flags['q_' + qid + '_' + st.id + '_' + optId] = true;
      applyEffects(o.effects);
      ctx.close?.(); dirty = true; evaluate(true); ctx.save?.(); ctx.hud?.(); return true;
    }
    function handle(action, id) {
      const s = S(); if (!s) return false; ensure(s);
      switch (action) {
        case 'journal': openLog(); return true;
        case 'q-tab': openTab = id; openLog(); return true;
        case 'q-track': s.q.tracked = id; renderTracker(); openLog(); return true;
        case 'q-go': { const o = objective(id); if (o?.dest) ctx.goDest?.(o.dest, o.title + ' — ' + o.label, { source: 'quest', arrive: 'interact' }); else ctx.toast?.('Mục tiêu này không có điểm đến cụ thể.'); return true; }
        case 'q-giver': { const q = quests.get(id), d = q && giverDest(q); if (d?.mapId) ctx.goDest?.(d, 'Tìm người giao việc: ' + q.title, { source: 'quest', arrive: 'interact' }); return true; }
        case 'q-accept': { const q = quests.get(id); ctx.close?.(); if (q && isAvailable(q)) { startQuest(id); evaluate(true); renderTracker(); ctx.save?.(); } return true; }
        case 'q-talk': { bypass = id; ctx.close?.(); ctx.interact?.(id); return true; }
        case 'q-abandon': abandon(id); openLog(); renderTracker(); return true;
        case 'q-choose': { const [qid, oid] = String(id).split('|'); choose(qid, oid); return true; }
        case 'q-lines-ok': { const m = modalQuest; ctx.close?.(); if (m?.done) m.done(); return true; }
        case 'quest-route': { if (!s.flags.prologueDone) return false; const o = objective(); if (o?.dest) ctx.goDest?.(o.dest, o.title + ' — ' + o.label, { source: 'quest', arrive: 'interact' }); else ctx.toast?.('Chưa có lời hứa nào đang theo dõi. Hãy nói chuyện với người dân.'); return true; }
        default: return false;
      }
    }

    /* ---------- misc API ---------- */
    function validate() {
      const errs = [], ids = new Set();
      for (const q of quests.values()) {
        if (ids.has(q.id)) errs.push('duplicate id ' + q.id); ids.add(q.id);
        if (!q.stages?.length) errs.push(q.id + ': no stages');
        const sid = new Set((q.stages || []).map(s => s.id));
        for (const st of q.stages || []) {
          if (st.next && !sid.has(st.next)) errs.push(`${q.id}.${st.id}: next ${st.next} missing`);
          if (st.finish && !q.outcomes?.[st.finish]) errs.push(`${q.id}.${st.id}: finish ${st.finish} missing`);
          if (st.scene && !scenes.has(st.scene)) errs.push(`${q.id}.${st.id}: scene ${st.scene} missing`);
          for (const gl of flat(st.goal)) {
            if (gl.scene && !scenes.has(gl.scene)) errs.push(`${q.id}.${st.id}: goal scene ${gl.scene} missing`);
            for (const o of gl.options || []) { if (o.next && !sid.has(o.next)) errs.push(`${q.id}.${st.id}.${o.id}: next missing`); if (o.finish && !q.outcomes?.[o.finish]) errs.push(`${q.id}.${st.id}.${o.id}: finish missing`); }
          }
          for (const e of [st.onEnter, st.onComplete]) for (const id of [].concat(e?.startQuest || [])) if (!quests.has(id)) errs.push(`${q.id}.${st.id}: startQuest ${id} missing`);
        }
        for (const [k, o] of Object.entries(q.outcomes || {})) for (const id of [].concat(o.effects?.startQuest || [])) if (!quests.has(id)) errs.push(`${q.id}.${k}: startQuest ${id} missing`);
        for (const r of q.prereq?.quests || []) if (!quests.has(r.id)) errs.push(`${q.id}: prereq quest ${r.id} missing`);
      }
      return errs;
    }

    return { ensure, evaluate, startQuest, finishQuest, applyEffects, addClue, setOverlord, onBattleWon, onFlag, touch: touchGeneric, intercept, dynamicPoints, objective, markersForMap, finalGate, openLog, renderTracker, handle, choose, abandon, validate, isDone, isActive, isAvailable, prereqMet, goalMet, scene: id => scenes.get(id), quest: id => quests.get(id), all: () => Array.from(quests.values()), available: () => Array.from(quests.values()).filter(isAvailable), active: () => Object.keys(qs().active).map(id => quests.get(id)).filter(Boolean), stageOf, clueDefs: () => Array.from(clueDefs.values()), markDirty: () => { dirty = true; } };
  }

  g.VTNQuests = { create, RANKS, KIND_LABEL, CAST_NAME };
})(typeof window !== 'undefined' ? window : globalThis);
