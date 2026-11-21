(function (g) {
  'use strict';
  /* VTNBeats — places the finished regional scenes (data/story_regions/<region>.json) in the world.
   * beat: {scene, kind:'beat'|'hub'|'overlord'|'epilogue', mapId, x, y, actor, look, chain, repeat}
   * A beat shows up as an NPC (with the "!" marker) once its scene's `when` holds and it has not been played yet;
   * pressing E on it plays the scene.  Hubs replay an NPC's greeting once per day before the NPC's normal menu.
   * The overlord beat replaces the old wake menu inside the lair. Scenes delayed by a timer appear when the timer is due. */
  const D = () => g.VTN_DATA || {}, game = () => g.VTNGame, S = () => game()?.storyState?.(), FX = () => g.VTNStoryFx;
  const beats = [], scenes = new Map(), snapped = new Map(), grids = new Map();
  let registered = false, busy = false;
  function register() {
    if (registered) return; registered = true;
    const data = D(); data.questScenes ??= [];
    const portraits = g.VTNStory?.data ? (g.VTNStory.data.portraits ??= {}) : {};
    for (const [rid, pack] of [...Object.entries(data.storyRegions || {}), ...Object.values(data.storyCast || {}).map(p => [p.region, p])]) {
      for (const sc of pack.scenes || []) { scenes.set(sc.id, sc); if (!data.questScenes.some(v => v.id === sc.id)) data.questScenes.push(sc); }
      for (const [name, look] of Object.entries(pack.portraits || {})) portraits[name] ??= look;
      for (const [id, spec] of Object.entries(pack.npcLooks || {})) {
        const npc=(data.npcs||[]).find(n=>n.id===id);if(!npc)continue;
        const [gender,age,build]=spec.look.split('_');
        Object.assign(npc,{raceId:spec.raceId,gender,age,build,usePeopleLook:true});
      }
      for (const b of pack.beats || []) beats.push({ ...b, region: b.region || rid, castPack: !!pack.castKey });
    }
  }
  const seen = (s, id) => (s.scenesSeen || []).includes(id);
  const retries = { RG03_S4: 'shadowNamesSpoken', RG08_S5: 'r08_clock_ready', R40_4: 'rc_R40_freed_all', RG02_S5: 'riverGatesClosed' };
  const waiting = (s, id) => (s.storyTimers || []).some(t => t.id === id && !t.done);
  function open(b, s = S()) {
    if (!s) return false; register(); FX()?.ensure(s);
    const sc = scenes.get(b.scene); if (!sc) return false;
    if (!b.repeat && !['hub','overlord'].includes(b.kind) && seen(s, b.scene) && !(retries[b.scene] && !s.flags[retries[b.scene]])) return false;
    if (retries[b.scene] && b.scene.startsWith('RG') && seen(s,b.scene) && s.flags['overlord_resolved_overlord_r'+b.region.slice(-2)]) return false;
    if (b.kind === 'overlord' && s.flags['overlord_resolved_overlord_r' + b.region.slice(-2)]) return false;
    if (waiting(s, b.scene)) return false;
    if (s.storyTimers?.some(t => t.id === b.scene) && !s.flags[b.scene + '_due']) return false;
    if (FX() && !FX().test(sc.when, s)) return false;
    return sc.lines.some(l => (!l.cond || FX()?.test(l.cond, s)) && (l.text || l.choice));   // nothing to say yet: stay hidden
  }
  function grid(mapId) { if (!grids.has(mapId)) { const a = (game()?.gridRaw || game()?.grid)?.(mapId); if (!a) return null; grids.set(mapId, a); } return grids.get(mapId); }
  const takenCache = new Map(), reachCache = new Map();
  const locating = new Set();
  function locate(b) {
    const map = g.VTNRules?.by?.('maps', b.mapId);
    let a = null;
    if (grids.has(b.mapId)) a = grids.get(b.mapId);
    else if (!locating.has(b.mapId)) { locating.add(b.mapId); try { a = (game()?.gridRaw || game()?.grid)?.(b.mapId); if (a) grids.set(b.mapId, a); } finally { locating.delete(b.mapId); } }
    let { x, y } = b;
    const home = D().beat_homes?.[b.mapId]?.[b.scene];
    if (home) { x = home[0] + (b.placeOffset?.[0] || 0); y = home[1] + (b.placeOffset?.[1] || 0); }
    else if (b.placeKey) {
      const places = D().citadels?.regions?.[b.mapId]?.places || {};
      const p = places[b.placeKey] || places.plaza || [(a?.[0]?.length || map?.width || 200) >> 1, (a?.length || map?.height || 164) >> 1];
      x = p[0] + (b.placeOffset?.[0] || 0); y = p[1] + (b.placeOffset?.[1] || 0);
    }
    if (!a || !Number.isFinite(x) || !Number.isFinite(y)) return { ...b, x, y };
    const ok = (xx, yy) => (!b.id || ![...snapped.values()].some(p => Math.max(Math.abs(p.x-xx),Math.abs(p.y-yy))<=2)) && xx > 0 && yy > 0 && xx < a[0].length - 1 && yy < a.length - 1 && a[yy][xx] === 0 && !g.VTNWorldLibrary?.isTileBlocked?.(map, xx, yy) && !g.VTNWorldLibrary?.isTileBlocked?.(map, xx, yy + 1);
    for (let r = 0; r < Math.max(a.length, a[0].length); r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(x + dx, y + dy)) return { ...b, x: x + dx, y: y + dy };
    }
    return { ...b, x, y };
  }
  function hashOf(v) { let h = 2166136261; for (const c of String(v)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const planCache = new Map();
  // Once the world's colliders exist: give every scene of a capital its own walkable cell, as far as possible from every other NPC, near the anchor chosen offline
  function planHomes(mapId, a, reach, map, W, H, others) {
    if (planCache.has(mapId)) return planCache.get(mapId);
    const L = g.VTN_MAP_LAYOUTS, WL = g.VTNWorldLibrary, out = new Map(), cells = [];
    const walk = (x, y) => reach[y * W + x] && a[y][x] === 0 && !WL.isTileBlocked(map, x, y);
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (!walk(x, y) || !L.inCitadel(map, x, y) || WL.isTileBlocked(map, x, y + 1)) continue;
      let open = true; for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) if (!walk(x + dx, y + dy)) { open = false; break; }   // open ground only: one NPC can never wall off a dead-end alley
      if (open) cells.push([x, y]);
    }
    planCache.set(mapId, out); if (cells.length < 30) return out;
    const list = beats.filter(b => (b.kind === 'beat' || b.kind === 'epilogue') && b.mapId === mapId && b.placeKey && !/^wild|^camp|^gate/.test(b.placeKey)).sort((p, q) => hashOf(p.scene) - hashOf(q.scene));
    const mind = new Float32Array(cells.length).fill(16);
    const push = (px, py) => { for (let i = 0; i < cells.length; i++) { const d = Math.hypot(cells[i][0] - px, cells[i][1] - py); if (d < mind[i]) mind[i] = d; } };
    for (const o of others) push(o[0], o[1]);
    for (const b of list) {
      const home = D().beat_homes?.[mapId]?.[b.scene] || [b.x ?? 100, b.y ?? 80];
      let bi = -1, bs = -1e9;
      for (let i = 0; i < cells.length; i++) { if (mind[i] < 3) continue; const dh = Math.hypot(cells[i][0] - home[0], cells[i][1] - home[1]); if (dh > 22) continue; const sc = mind[i] - 0.12 * dh + (hashOf(b.scene + i) % 100) / 400; if (sc > bs) { bs = sc; bi = i; } }
      if (bi < 0) continue;
      out.set(b.scene, cells[bi]); push(cells[bi][0], cells[bi][1]);
    }
    return out;
  }
  function spot(b) {
    const k = b.scene; if (snapped.has(k)) return snapped.get(k);
    b = locate(b);
    // scatter: scenes sharing one place stand at different spots around it (never piled on one corner), inside the walls when the place is inside
    if (b.placeKey && !/^wild|^camp/.test(b.placeKey) && !D().beat_homes?.[b.mapId]?.[b.scene]) {
      const m0 = g.VTNRules?.by?.('maps', b.mapId), L = g.VTN_MAP_LAYOUTS, h = hashOf(k), inside = !!(L?.inCitadel && m0 && L.inCitadel(m0, b.x, b.y));
      for (let t = 0; t < 12; t++) {
        const ang = (((h >>> 3) + t * 2654435761) % 1000) / 1000 * Math.PI * 2, rad = Math.max(3, 15 - t) * (0.55 + ((h >>> 11) % 45) / 100);
        const nx = Math.round(b.x + Math.cos(ang) * rad), ny = Math.round(b.y + Math.sin(ang) * rad * 0.7);
        if (!inside || !L?.inCitadel || L.inCitadel(m0, nx, ny)) { b = { ...b, x: nx, y: ny }; break; }
      }
    }
    const a = grid(b.mapId); if (!a) return { x: b.x, y: b.y };
    if (!takenCache.has(b.mapId)) { const used = new Set(), others = []; for (const p of game()?.points?.(b.mapId) || []) if (!p.beat) { others.push([p.x, p.y]); for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)used.add((p.x+dx)+','+(p.y+dy)); } used.others = others; takenCache.set(b.mapId, used); }
    const map = g.VTNRules?.by?.('maps', b.mapId), W = a[0].length, H = a.length, taken = takenCache.get(b.mapId);
    // reachable from the region spawn with colliders applied (cached per map once the world plan is ready); a scene must never stand in a sealed pocket
    if (!reachCache.has(b.mapId) && g.VTNWorldLibrary?.ready?.(b.mapId)) {
      const sp = map?.spawn || g.VTN_MAP_LAYOUTS?.SPAWN || { x: 8, y: 8 }, seen = new Uint8Array(W * H), q = [sp.y * W + sp.x]; seen[q[0]] = 1;
      for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue; const j = ny * W + nx; if (seen[j] || a[ny][nx] === 1 || a[ny][nx] === 3 || g.VTNWorldLibrary.isTileBlocked(map, nx, ny)) continue; seen[j] = 1; q.push(j); } }
      reachCache.set(b.mapId, seen);
    }
    const reach = reachCache.get(b.mapId);
    if (reach && map?.kind === 'region' && g.VTNWorldLibrary?.ready?.(b.mapId) && D().citadels?.regions?.[b.mapId]) {
      const h = planHomes(b.mapId, a, reach, map, W, H, taken.others || []).get(k);
      if (h) { const cell = { x: h[0], y: h[1] }; snapped.set(k, cell); return cell; }
    }
    const ok = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && a[y][x] === 0 && (!reach || reach[y * W + x]) && !taken.has(x + ',' + y) && !g.VTNWorldLibrary?.isTileBlocked?.(map, x, y) && !g.VTNWorldLibrary?.isTileBlocked?.(map, x, y + 1);
    let best = { x: Math.max(1, Math.min(W - 2, b.x)), y: Math.max(1, Math.min(H - 2, b.y)) };
    outer: for (let r = 0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (ok(b.x + dx, b.y + dy)) { best = { x: b.x + dx, y: b.y + dy }; break outer; }
    }
    if (g.VTNWorldLibrary?.ready?.(b.mapId) || map?.kind !== 'region') { snapped.set(k, best); const sp = map?.kind === 'region' ? 5 : 2; for(let dy=-sp;dy<=sp;dy++)for(let dx=-sp;dx<=sp;dx++)taken.add((best.x+dx)+','+(best.y+dy)); }
    return best;
  }
  function title(name) { return String(name || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()); }
  function lookOf(b) {
    const key = b.look?.look || 'm_adult_a', [sex, age, build] = key.split('_');
    return { raceId: b.look?.raceId || 'R-29', gender: sex, age, build };
  }
  function points(mapId) {
    const s = S(); if (!s || busy) return []; register(); FX()?.tick();
    busy = true; try { return pointsInner(mapId, s); } finally { busy = false; }
  }
  function pointsInner(mapId, s) {
    const out = [];
    for (const b of beats) {
      if (!(b.kind === 'beat' || (b.kind === 'epilogue' && b.castPack)) || b.mapId !== mapId || !open(b, s)) continue;
      const p = spot(b), name = title(b.actor), id = 'beat|' + b.scene, lk = lookOf(b);
      out.push({ id, type: 'npc', beat: b.scene, questPoint: true, questNpc: true, x: p.x, y: p.y, name, blocking: true,
        npc: { id, name, raceId: lk.raceId, gender: lk.gender, age: lk.age, build: lk.build, castKey: b.castKey || null, usePeopleLook: true, static: true, quest: true, wander: 'static' } });
    }
    return out;
  }
  function markers(mapId) { return points(mapId).map(p => ({ x: p.x, y: p.y, kind: 'available', beat: p.beat })); }
  function play(id) {
    if (!g.VTNStory?.startScene(id, { onEnd: () => { game()?.save?.(); } })) return false;
    return true;
  }
  function intercept(p) {
    const s = S(); if (!s || !p) return false; register();
    if (p.beat) return play(p.beat);
    const map = g.VTNRules?.by?.('maps', s.mapId);
    if (p.type === 'npc' && p.npc?.id) {
      const hub = beats.find(b => b.kind === 'hub' && b.region === map?.regionId && b.npcId === p.npc.id && open(b, s));
      if (hub && s.flags['hub_' + hub.scene] !== s.day) { s.flags['hub_' + hub.scene] = s.day; return play(hub.scene); }
    }
    if (p.type === 'overlord' && map) {
      const ov = beats.find(b => b.kind === 'overlord' && b.region === map.regionId);
      if (ov && !s.flags['overlord_resolved_overlord_r' + map.regionId.slice(-2)]) {
        if (open(ov, s)) return play(ov.scene);
        g.VTNGame?.quests?.applyEffects?.({ toast: 'Chưa đủ điều kiện gặp Bá Chủ. Hãy tiếp tục những câu chuyện trong vùng.' });
        return true;
      }
    }
    return false;
  }
  // a list for the journal: what can be played now, where
  function available(regionId) {
    const s = S(); if (!s) return []; register();
    return beats.filter(b => (['beat','overlord'].includes(b.kind) || (b.kind==='epilogue'&&b.castPack)) && (!regionId || b.region === regionId) && open(b, s)).map(b => { const p = b.kind === 'overlord' ? (game()?.points?.(b.mapId) || []).find(p => p.type === 'overlord') || spot(b) : spot(b); return { pointId: b.kind === 'overlord' ? p.id : 'beat|'+b.scene, scene: b.scene, title: scenes.get(b.scene)?.title, place: scenes.get(b.scene)?.place, mapId: b.mapId, x: p.x, y: p.y, chain: b.chain, actor: title(b.actor) }; });
  }
  function chains(regionId, done = false) {
    register(); const s = S(); if (!s) return [];
    const groups = new Map(), av = new Map(available(regionId).map(b => [b.scene, b]));
    for (const b of beats) {
      if (!(['beat', 'overlord'].includes(b.kind) || (b.kind==='epilogue'&&b.castPack)) || (regionId && b.region !== regionId)) continue;
      const id = b.region + '|' + (b.chain || 'RG' + b.region.slice(-2));
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(b);
    }
    return [...groups.entries()].map(([id, list]) => {
      const first = list[0], played = list.filter(b => seen(s, b.scene)).length;
      // Mutually exclusive consequences stay in the total; completion means no
      // currently open scene and every core step has been visited or resolved.
      const current = list.map(b => av.get(b.scene)).find(Boolean);
      const terminal = list.find(b => b.kind === 'overlord') || list.find(b => /_DEC$|_FINAL$/.test(b.scene)) || list.at(-1);
      const complete = seen(s, terminal.scene) && !current && !list.some(b => retries[b.scene] && !s.flags[retries[b.scene]]); 
      return { id, region: first.region, title: scenes.get(first.scene)?.title, played, total: list.length, current, done: complete };
    }).filter(c => c.done === done && (done || c.played || c.current));
  }
  function epilogues(ending) { register(); const s=S(); return beats.filter(b => b.kind === 'epilogue').map(b => scenes.get(b.scene)).filter(sc => sc && (!sc.when || (FX()&&s ? FX().test(sc.when,{...s,ending}) : sc.when === 'ending:' + ending))); }
  g.VTNBeats = { register, points, markers, intercept, available, chains, locate, open, epilogues, play, inspect: () => ({ beats: beats.length, scenes: scenes.size }) };
})(globalThis);
