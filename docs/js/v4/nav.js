/* VTNNav — whole-world guide + route follower.
 * - planner: BFS over portals between maps, A* (8-dir, no corner cutting) inside a map
 * - follower: survives overlays / battles / dialogue, detects being stuck, re-plans, tries alternative targets
 * - guide: dotted breadcrumb, goal ring and an edge arrow with distance drawn on an overlay canvas
 * Pure helpers (findPath, mapRoute) are exported for node tests. */
(function (g) {
  'use strict';
  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const key = (x, y) => x + ',' + y;
  const octile = (x, y, tx, ty) => { const dx = Math.abs(tx - x), dy = Math.abs(ty - y); return Math.max(dx, dy) + 0.41421356 * Math.min(dx, dy); };

  /* ---------- tiny binary heap ---------- */
  function Heap() { const a = []; return {
    get size() { return a.length; },
    push(n) { a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } },
    pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  }; }

  /* ---------- A* on a tile grid ----------
   * grid: rows of tile ids (1 and 3 = solid). start {x,y}. goals: array of {x,y} (any is fine).
   * opts.blocked: Set of "x,y" that cannot be entered (goals are always enterable). opts.habitatCost: extra cost of tile 2. */
  function findPath(grid, start, goals, opts = {}) {
    const H = grid.length, W = grid[0]?.length || 0, blocked = opts.blocked || new Set(), hab = opts.habitatCost ?? 3;
    if (!goals.length) return null;
    const goalSet = new Set(goals.map(p => key(p.x, p.y)));
    const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || grid[y][x] === 1 || grid[y][x] === 3;
    const enter = (x, y) => !solid(x, y) && (!blocked.has(key(x, y)) || goalSet.has(key(x, y)));
    if (goalSet.has(key(start.x, start.y))) return [];
    const h = (x, y) => { let best = Infinity; for (const p of goals) { const d = octile(x, y, p.x, p.y); if (d < best) best = d; } return best; };
    const open = Heap(), came = new Map(), cost = new Map([[key(start.x, start.y), 0]]), closed = new Set();
    open.push({ x: start.x, y: start.y, g: 0, f: h(start.x, start.y) });
    let guard = 0;
    while (open.size && guard++ < 60000) {
      const cur = open.pop(), k = key(cur.x, cur.y);
      if (closed.has(k)) continue; closed.add(k);
      if (goalSet.has(k)) { const out = []; let c = k; while (came.has(c)) { const [x, y] = c.split(',').map(Number); out.push({ x, y }); c = came.get(c); } return out.reverse(); }
      for (const [dx, dy] of DIRS) {
        const x = cur.x + dx, y = cur.y + dy, nk = key(x, y);
        if (closed.has(nk) || !enter(x, y)) continue;
        if (dx && dy && (!enter(cur.x + dx, cur.y) || !enter(cur.x, cur.y + dy))) continue;
        const gc = cur.g + (dx && dy ? 1.41421356 : 1) + (grid[y][x] === 2 ? hab : 0), old = cost.get(nk);
        if (old !== undefined && gc >= old) continue;
        cost.set(nk, gc); came.set(nk, k); open.push({ x, y, g: gc, f: gc + h(x, y) });
      }
    }
    return null;
  }
  const around = (p, grid, blocked) => DIRS.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).filter(q => grid[q.y]?.[q.x] !== undefined && grid[q.y][q.x] !== 1 && grid[q.y][q.x] !== 3 && !(blocked && blocked.has(key(q.x, q.y))));

  /* ---------- map graph over portals ---------- */
  function buildGraph(maps, portalsOf) {
    const adj = new Map(maps.map(m => [m.id, []]));
    for (const m of maps) for (const p of portalsOf(m)) if (p.target && adj.has(p.target)) adj.get(m.id).push({ to: p.target, portal: p });
    return adj;
  }
  /* shortest hop route; returns [{mapId, portal}] where portal = the portal to take in that map (null for the last) */
  function mapRoute(adj, from, to) {
    if (from === to) return [{ mapId: from, portal: null }];
    const prev = new Map([[from, null]]), q = [from];
    for (let i = 0; i < q.length; i++) {
      const id = q[i];
      for (const e of adj.get(id) || []) { if (prev.has(e.to)) continue; prev.set(e.to, { from: id, portal: e.portal }); if (e.to === to) { i = q.length; break; } q.push(e.to); }
    }
    if (!prev.has(to)) return null;
    const out = [{ mapId: to, portal: null }]; let cur = to;
    while (prev.get(cur)) { const p = prev.get(cur); out.unshift({ mapId: p.from, portal: p.portal }); cur = p.from; }
    return out;
  }

  function create(c) {
    const D = c.D, by = c.by || ((k, id) => D[k].find(v => v.id === id));
    const L = () => g.VTN_MAP_LAYOUTS;
    let graph = null;
    const portalsOf = m => { try { return (L()?.pointAnchors?.(m) || []).filter(p => p.type === 'portal' || p.type === 'door'); } catch { return []; } };
    const adjacency = () => graph || (graph = buildGraph(D.maps, portalsOf));
    let route = null; // {dest:{mapId,pointId,npcId,x,y,alts}, label, arrive, source, fails, lastPos, lastMoveAt, paused, startedAt, leg}
    const preview = { key: '', path: [], at: 0, goal: null };
    let lastTickAt = 0, overlayCanvas = null, arrivedNote = null;

    const busy = () => !!(c.battle() || g.VTNStory?.isActive?.() || document.getElementById('overlay')?.classList.contains('open'));

    /* blocked set like the game: rivals and fixed objects; NPCs are interaction points */
    function blockedFor(mapId, keep = []) {
      const set = new Set(), s = c.state();
      for (const p of c.points(mapId)) { if (p.type === 'npc') continue; const px = Math.round(p.renderX ?? p.x), py = Math.round(p.renderY ?? p.y); set.add(key(px, py)); }
      for (const k of g.VTNWorldLibrary?.blockedCells?.(mapId) || []) set.add(k);   // walls, houses, statues, tree trunks
      if (s && s.mapId === mapId) set.delete(key(s.x, s.y));
      for (const k of keep) set.delete(k);
      return set;
    }

    /* resolve the live goal of the destination on its own map: returns {x,y,point|null} or null */
    function resolveDest(dest) {
      const pts = c.points(dest.mapId);
      let p = null;
      if (dest.pointId) p = pts.find(v => v.id === dest.pointId || v.npc?.id === dest.pointId);
      if (!p && dest.npcId) p = pts.find(v => v.npc?.id === dest.npcId || v.id === dest.npcId);
      if (!p && dest.type) p = pts.find(v => v.type === dest.type);
      if (p) return { x: Math.round(p.renderX ?? p.x), y: Math.round(p.renderY ?? p.y), point: p, interactId: p.npc?.id || p.id };
      if (Number.isFinite(dest.x) && Number.isFinite(dest.y)) return { x: dest.x, y: dest.y, point: null, interactId: null };
      return null;
    }

    function legsFor(fromMapId, dest) {
      const room = D.interiorMaps?.find(m => m.id === fromMapId);
      if (room && dest.mapId !== fromMapId) { // inside a building: leave through its door first
        const rest = legsFor(room.parentId, dest);
        return rest ? { legs: [{ mapId: fromMapId, portal: { target: room.parentId, type: 'exit', id: room.id + '|exit' } }, ...rest.legs], viaLinks: false } : null;
      }
      const adj = adjacency();
      let r = mapRoute(adj, fromMapId, dest.mapId);
      let viaLinks = false;
      if (!r) { // legacy fallback: map `links`
        const idx = new Map(D.maps.map(m => [m.id, m])), prev = new Map([[fromMapId, null]]), q = [fromMapId];
        for (let i = 0; i < q.length; i++) for (const id of idx.get(q[i])?.links || []) { if (prev.has(id)) continue; prev.set(id, q[i]); q.push(id); }
        if (prev.has(dest.mapId)) { const ids = []; let cur = dest.mapId; while (cur) { ids.unshift(cur); cur = prev.get(cur); } r = ids.map((id, i) => ({ mapId: id, portal: i < ids.length - 1 ? { target: ids[i + 1], type: 'portal' } : null })); viaLinks = true; }
      }
      return r ? { legs: r, viaLinks } : null;
    }

    /* current waypoint (on the hero's map) the follower is heading to */
    function currentGoal() {
      const s = c.state(); if (!s || !route) return null;
      if (s.mapId === route.dest.mapId) {
        const goal = resolveDest(route.dest); if (!goal) return null;
        return { ...goal, final: true };
      }
      const plan = legsFor(s.mapId, route.dest); if (!plan) return null;
      const portal = plan.legs[0].portal;
      const live = c.points(s.mapId).find(p => (p.type === 'portal' || p.type === 'exit') && p.target === portal.target) || portal;
      return { x: live.x, y: live.y, point: live, interactId: live.id, final: false, legsLeft: plan.legs.length - 1 };
    }

    function pathTo(goal, from) {
      const s = c.state(), mapId = s.mapId, grid = c.grid(mapId);
      const keep = [key(goal.x, goal.y)];
      const blocked = blockedFor(mapId, keep);
      const isInteract = !!goal.interactId;
      const goals = isInteract ? around(goal, grid, blocked) : [{ x: goal.x, y: goal.y }];
      return findPath(grid, from || { x: s.x, y: s.y }, goals, { blocked });
    }

    function setPreview() {
      const s = c.state(); if (!s || !route) { preview.path = []; preview.goal = null; return; }
      const now = performance.now(), mv = c.movement?.();
      const here = mv?.path?.[mv.index] || { x: s.x, y: s.y };
      const goal = currentGoal();
      const k = [s.mapId, here.x, here.y, goal ? goal.x + ',' + goal.y : '-'].join('|');
      if (k === preview.key && now - preview.at < 700) return;
      preview.key = k; preview.at = now; preview.goal = goal;
      preview.path = goal ? (pathTo(goal, here) || []) : [];
    }

    function cancel(quiet = false, reason = '') {
      const had = !!route; route = null; preview.path = []; preview.goal = null; arrivedNote = null;
      c.stopMovement?.(); c.routeLabel?.('');
      if (!quiet && had) c.toast(reason || 'Đã dừng tự tìm đường.');
    }

    /* dest: {mapId, pointId|npcId|type|x,y, alts?:[dest...]}; options {label, arrive:'interact'|'stop'|'prompt', source} */
    function goTo(dest, opt = {}) {
      const s = c.state(); if (!s || c.battle() || g.VTNStory?.isActive?.()) return false;
      if (!by('maps', dest.mapId)) { c.toast('Điểm đến không tồn tại.'); return false; }
      const plan = legsFor(s.mapId, dest);
      if (!plan) { c.toast('Chưa tìm thấy đường nối tới nơi này.'); return false; }
      c.stopMovement?.();
      route = { dest, label: opt.label || 'Điểm đến', arrive: opt.arrive || 'interact', source: opt.source || 'manual', fails: 0, altIndex: 0, lastPos: null, lastMoveAt: performance.now(), startedAt: performance.now(), paused: false, legsTotal: plan.legs.length - 1, onArrive: opt.onArrive || null };
      arrivedNote = null; preview.key = '';
      c.close?.(); c.routeLabel?.('Đang tìm đường: ' + route.label);
      lastTickAt = 0; tick(); return true;
    }

    function fail(reason) {
      if (route && route.dest.alts && route.altIndex < route.dest.alts.length) {
        const alt = route.dest.alts[route.altIndex++]; route.dest = { ...alt, alts: route.dest.alts }; route.fails = 0; preview.key = '';
        c.toast('Thử đường khác tới ' + route.label + '…'); return;
      }
      cancel(true); c.toast(reason);
    }

    function arrive(goal) {
      const label = route.label, mode = route.arrive, cb = route.onArrive, id = goal.interactId;
      cancel(true);
      if (cb) { try { cb(goal); } catch (e) { console.warn(e); } }
      if (mode === 'interact' && id) { c.toast('Đã đến ' + label + '.'); c.interact(id); }
      else if (mode === 'prompt' && id) { arrivedNote = { id, label, at: performance.now() }; c.toast('Đã đến ' + label + ' · nhấn E để tương tác.'); }
      else c.toast('Đã đến ' + label + '.');
    }

    function tick() {
      if (!route) return;
      const nowMs = performance.now();
      if (nowMs - lastTickAt < 180) return; lastTickAt = nowMs;
      const s = c.state(); if (!s) return;
      if (busy()) { route.paused = true; route.lastMoveAt = nowMs; return; }
      if (route.paused) { route.paused = false; route.lastMoveAt = nowMs; route.lastPos = null; preview.key = ''; }
      if (c.movement()) { route.lastMoveAt = nowMs; return; }
      const goal = currentGoal();
      if (!goal) { fail('Không xác định được vị trí điểm đến (có thể người đó đã rời đi).'); return; }
      const near = Math.max(Math.abs(s.x - goal.x), Math.abs(s.y - goal.y)) <= 1 && (goal.interactId || (s.x === goal.x && s.y === goal.y));
      if (near || (!goal.interactId && s.x === goal.x && s.y === goal.y)) {
        if (goal.final) { arrive(goal); return; }
        const before = s.mapId; route.travelTry = (route.travelTry || 0) + 1;
        c.interact(goal.interactId);
        const after = c.state()?.mapId;
        if (after === before) { if (route.travelTry >= 3) fail('Cổng này chưa mở được: ' + (goal.point?.name || 'lối đi bị khóa') + '.'); }
        else { route.travelTry = 0; route.fails = 0; preview.key = ''; c.routeLabel?.('Đang tìm đường: ' + route.label + ' (' + Math.max(0, (goal.legsLeft || 1) - 1) + ' chặng nữa)'); }
        return;
      }
      /* stuck detection */
      const pos = s.mapId + ':' + s.x + ',' + s.y;
      if (route.lastPos === pos && nowMs - route.lastMoveAt > 2600) { route.fails++; route.lastMoveAt = nowMs; if (route.fails >= 4) { fail('Đường đi bị chặn. Hãy mở bản đồ và chọn một điểm khác.'); return; } }
      if (route.lastPos !== pos) { route.lastPos = pos; route.lastMoveAt = nowMs; }
      const ok = c.move(goal.x, goal.y);
      if (!ok) { route.fails++; if (route.fails >= 4) fail('Không tìm thấy lối đi tới ' + route.label + '.'); }
      announce();
    }
    let lastText = '';
    function announce() {
      if (!route) return; const st = status(); if (!st) return;
      const text = 'Dẫn đường: ' + st.label + (st.tiles ? ' · ' + st.tiles + ' ô' : '') + (st.dirText ? ' ' + st.dirText : '') + (st.legsLeft > 0 ? ' · còn ' + st.legsLeft + ' chặng qua cổng' : '');
      if (text !== lastText) { lastText = text; c.routeLabel?.(text); }
    }

    /* ---------- status for the tracker ---------- */
    function status() {
      const s = c.state(); if (!route || !s) return null;
      setPreview();
      const goal = preview.goal, tiles = preview.path.length;
      let dirText = '';
      if (goal) { const dx = goal.x - s.x, dy = goal.y - s.y; const ang = Math.atan2(dy, dx) * 180 / Math.PI; dirText = ['phía đông', 'đông nam', 'phía nam', 'tây nam', 'phía tây', 'tây bắc', 'phía bắc', 'đông bắc'][Math.round(((ang + 360) % 360) / 45) % 8]; }
      return { label: route.label, mapId: route.dest.mapId, here: s.mapId, tiles, dirText, legsLeft: goal?.legsLeft ?? 0, paused: route.paused, final: !!goal?.final, source: route.source };
    }

    /* ---------- guide overlay ---------- */
    function ensureOverlay() {
      const world = document.getElementById('world'); if (!world) return null;
      if (!overlayCanvas) {
        overlayCanvas = document.createElement('canvas'); overlayCanvas.id = 'nav-guide'; overlayCanvas.setAttribute('aria-hidden', 'true');
        overlayCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3';
        world.parentElement.insertBefore(overlayCanvas, world.nextSibling);
      }
      if (overlayCanvas.width !== world.width || overlayCanvas.height !== world.height) { overlayCanvas.width = world.width; overlayCanvas.height = world.height; }
      return overlayCanvas;
    }
    function drawGuide(extra) {
      const cv = ensureOverlay(); if (!cv) return;
      const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height);
      const s = c.state(); if (!s || c.battle()) return;
      const markers = [];
      if (route) { setPreview(); if (preview.goal) markers.push({ goal: preview.goal, path: preview.path, main: true }); }
      if (extra) for (const m of extra(s.mapId) || []) markers.push({ goal: m, path: null, main: false, kind: m.kind });
      if (!markers.length) return;
      const dbg = g.VTNWorldLibrary?.debug?.(); const cam = dbg?.camera; if (!cam) return;
      const Z = cam.zoom, T = 32, t = performance.now() / 1000;
      const toScreen = (tx, ty) => [((tx * T + T / 2) - cam.x) * Z, ((ty * T + T / 2) - cam.y) * Z];
      const hero = g.VTNGame?.heroVisual?.(); const [hx, hy] = hero ? toScreen(hero.x, hero.y) : [cv.width / 2, cv.height / 2];
      for (const m of markers) {
        if (m.main && m.path?.length) {
          ctx.save(); ctx.fillStyle = '#ffe9a8'; const n = Math.min(m.path.length, 28);
          for (let i = 0; i < n; i += 2) { const [px, py] = toScreen(m.path[i].x, m.path[i].y); const a = 0.85 - i / (n * 1.4) + 0.12 * Math.sin(t * 5 - i * 0.6); ctx.globalAlpha = Math.max(0.15, Math.min(1, a)); ctx.beginPath(); ctx.arc(px, py + 8 * Z * 0.5, Math.max(2, 3 * Z * 0.8), 0, 7); ctx.fill(); }
          ctx.restore();
        }
        const [gx, gy] = toScreen(m.goal.x, m.goal.y);
        const inside = gx > 24 && gy > 24 && gx < cv.width - 24 && gy < cv.height - 24;
        const color = m.main ? '#ffd776' : m.kind === 'turnin' ? '#8fe6a2' : m.kind === 'available' ? '#ffd776' : '#c8b9ff';
        if (inside) {
          ctx.save(); const pulse = 1 + 0.12 * Math.sin(t * 4);
          ctx.strokeStyle = color; ctx.globalAlpha = 0.9; ctx.lineWidth = Math.max(2, 2 * Z * 0.7);
          ctx.beginPath(); ctx.ellipse(gx, gy + 6 * Z * 0.5, 16 * Z * 0.8 * pulse, 8 * Z * 0.8 * pulse, 0, 0, 7); ctx.stroke();
          const by0 = gy - 44 * Z * 0.7 - 5 * Math.sin(t * 3); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(gx, by0 + 14); ctx.lineTo(gx - 9, by0); ctx.lineTo(gx + 9, by0); ctx.closePath(); ctx.fill();
          ctx.restore();
        } else if (m.main) {
          const ang = Math.atan2(gy - hy, gx - hx), padX = 40, top = 90, bottom = 80, cx = cv.width / 2, cy = (top + cv.height - bottom) / 2, halfH = (cv.height - bottom - top) / 2;
          const dx = Math.cos(ang), dy = Math.sin(ang), kx = dx ? (cv.width / 2 - padX) / Math.abs(dx) : Infinity, ky = dy ? halfH / Math.abs(dy) : Infinity, kk = Math.min(kx, ky);
          const ax = cx + dx * kk, ay = cy + dy * kk;
          ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); ctx.fillStyle = color; ctx.strokeStyle = '#1a1424'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
          const dist = Math.max(1, Math.round(Math.hypot(m.goal.x - s.x, m.goal.y - s.y))); ctx.font = '600 ' + Math.round(13 * Math.max(1, Z * 0.8)) + 'px "VTN UI",sans-serif'; ctx.textAlign = 'center';
          const lx = Math.max(40, Math.min(cv.width - 40, ax - dx * 26)), ly = Math.max(18, Math.min(cv.height - 10, ay - dy * 26 + 4));
          ctx.lineWidth = 4; ctx.strokeStyle = '#120e1b'; ctx.strokeText(dist + ' ô', lx, ly); ctx.fillStyle = color; ctx.fillText(dist + ' ô', lx, ly);
        }
      }
    }

    return { goTo, cancel, tick, status, drawGuide, route: () => route, isRouting: () => !!route, previewPath: () => preview.path.slice(), legsFor, graph: adjacency, arrivedNote: () => arrivedNote, clearArrived: () => { arrivedNote = null; } };
  }

  g.VTNNav = { create, findPath, mapRoute, buildGraph, around };
})(typeof window !== 'undefined' ? window : globalThis);
