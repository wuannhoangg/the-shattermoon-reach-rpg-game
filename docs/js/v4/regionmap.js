/* VTNRegionMap — parchment-style map of one region (same asset kit as the world map: assets/ui/worldmap).
 * draw(canvas, state) -> {scale, ox, oy, pad}. Terrain is painted once per map and cached; markers are redrawn every call.
 * state = { map, grid, points, roadCells:Set("x,y"), hero:{x,y}, selected:{x,y}|null, time } */
(function (g) {
  'use strict';
  const PAD = 2;                                  // cells of open sea drawn around the region, so the coast is inked all the way round
  const cache = new Map();
  const BIOME = { region_01: '#9fb07a', region_02: '#9cc4c8', region_03: '#8fae86', region_04: '#b8a58a', region_05: '#e3bf86', region_06: '#cdb596', region_07: '#a89a8e', region_08: '#eef0ee', region_09: '#c9a8b8', region_10: '#8f8aa8' };
  const TREES = { region_01: ['pine1', 'pine3'], region_04: ['pine3', 'pine1'], region_08: ['pine1', 'pine3'], region_05: ['cactus1', 'bush1'], region_07: ['bush1', 'tree8'], region_10: ['bush1', 'tree8'], region_02: ['tree1', 'tree4'], region_09: ['tree5', 'tree7', 'tree6'] };
  const ICON = { portal: 'i_bridge.png', 'boss-gate': 'i_boss.png', boss: 'i_boss.png', overlord: 'i_boss.png', lair: 'i_boss.png', anchor: 'i_landmark.png', shrine: 'i_landmark.png', clue: 'i_misc.png', chest: 'i_misc.png', dungeon: 'b_cave.png', entrance: 'b_cave.png', exit: 'i_bridge.png' };
  const INK = '#33221a', PAPER = '#f1e3bd';

  const A = () => g.VTNWorldMap?.assets;
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const noise = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) & 255) / 255; };

  function cityRects(map) {
    const c = g.VTN_MAP_LAYOUTS?.citadelOf?.(map);
    return c ? c : null;
  }

  function buildBase(S, key) {
    const { map, grid, roadCells } = S, w = grid[0].length, h = grid.length;
    const CW = S.cw, CH = S.ch, sc = S.scale, ox = S.ox, oy = S.oy, W = A();
    const base = document.createElement('canvas'); base.width = CW; base.height = CH;
    const bx = base.getContext('2d');
    // paper
    if (W.ok('paper.jpg')) { const im = W.img('paper.jpg'), k = Math.max(CW / im.naturalWidth, CH / im.naturalHeight); bx.drawImage(im, 0, 0, im.naturalWidth * k, im.naturalHeight * k); }
    else { bx.fillStyle = PAPER; bx.fillRect(0, 0, CW, CH); }
    bx.fillStyle = 'rgba(236,214,160,.30)'; bx.fillRect(0, 0, CW, CH);

    const city = cityRects(map), inCity = (x, y) => !!city && [city.outer, ...(city.keeps || [])].some(o => o.poly ? g.VTN_MAP_LAYOUTS.wardContains(o, x, y) : x >= o.x - 1 && y >= o.y - 1 && x < o.x + o.w + 1 && y < o.y + o.h + 1);
    // coarse masks, one pixel per cell (+ sea padding); the browser's bilinear upscale + a threshold gives smooth organic coasts
    const mw = w + PAD * 2, mh = h + PAD * 2, small = document.createElement('canvas'); small.width = mw; small.height = mh;
    const sx = small.getContext('2d'), sd = sx.createImageData(mw, mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const gx = x - PAD, gy = y - PAD, inside = gx >= 0 && gy >= 0 && gx < w && gy < h, v = inside ? grid[gy][gx] : 3, i = (y * mw + x) * 4;
      sd.data[i] = v === 3 ? 0 : 255;                               // land
      sd.data[i + 1] = v === 2 ? 255 : 0;                           // wild habitat (forest)
      sd.data[i + 2] = v === 1 && !inCity(gx, gy) ? 255 : 0;       // rock / impassable
      sd.data[i + 3] = 255;
    }
    sx.putImageData(sd, 0, 0);
    const big = document.createElement('canvas'); big.width = CW; big.height = CH;
    const gx2 = big.getContext('2d', { willReadFrequently: true }); gx2.imageSmoothingEnabled = true; gx2.imageSmoothingQuality = 'high';
    gx2.drawImage(small, 0, 0, mw, mh, ox - PAD * sc, oy - PAD * sc, mw * sc, mh * sc);
    const src = gx2.getImageData(0, 0, CW, CH).data;
    const land = new Uint8Array(CW * CH);
    for (let i = 0; i < CW * CH; i++) land[i] = src[i * 4 + 3] > 200 && src[i * 4] > 127 ? 1 : 0;

    // distance to the coast (chamfer) so shading, ink line and water ripples hug the shore
    const INF = 1e9, dist = new Float32Array(CW * CH);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = y * CW + x, v = land[i];
      const edge = (x + 1 < CW && land[i + 1] !== v) || (y + 1 < CH && land[i + CW] !== v) || (x > 0 && land[i - 1] !== v) || (y > 0 && land[i - CW] !== v);
      dist[i] = edge ? 0 : INF;
    }
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const i = y * CW + x; let d = dist[i]; if (x > 0) d = Math.min(d, dist[i - 1] + 1); if (y > 0) { d = Math.min(d, dist[i - CW] + 1); if (x > 0) d = Math.min(d, dist[i - CW - 1] + 1.414); if (x + 1 < CW) d = Math.min(d, dist[i - CW + 1] + 1.414); } dist[i] = d; }
    for (let y = CH - 1; y >= 0; y--) for (let x = CW - 1; x >= 0; x--) { const i = y * CW + x; let d = dist[i]; if (x + 1 < CW) d = Math.min(d, dist[i + 1] + 1); if (y + 1 < CH) { d = Math.min(d, dist[i + CW] + 1); if (x + 1 < CW) d = Math.min(d, dist[i + CW + 1] + 1.414); if (x > 0) d = Math.min(d, dist[i + CW - 1] + 1.414); } dist[i] = d; }

    const baseCol = hex(BIOME[map.regionId] || '#b9ab8a'), LAND = lerp(baseCol, hex('#eadbb0'), .5), FOREST = lerp(baseCol, hex('#4f7a4a'), .62), ROCK = hex('#9a8670'), WATER = hex('#86b0b8'), SHORE = hex('#3f2c1e');
    const terr = document.createElement('canvas'); terr.width = CW; terr.height = CH; const tx = terr.getContext('2d'), out = tx.createImageData(CW, CH), od = out.data;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = y * CW + x, p = i * 4, d = dist[i], n = (noise(x >> 1, y >> 1) - .5) * 10;
      let col, a;
      if (land[i]) {
        const ss = v => { const t = clamp((v - 90) / 90); return t * t * (3 - 2 * t); }, gF = ss(src[p + 1]) * .72, gR = ss(src[p + 2]);
        col = lerp(lerp(LAND, FOREST, gF), ROCK, gR * .8);
        const shade = clamp(1 - d / 10); col = col.map(v => v * (1 - .2 * shade));
        a = .9;
        if (d < 1.5) { col = lerp(col, SHORE, .88); a = 1; }
      } else {
        col = WATER; a = .1 + .52 * Math.exp(-d / 17);
        if (Math.abs(d - 7) < .6 || Math.abs(d - 15) < .5) { col = hex('#476f7c'); a = Math.max(a, .42); }
        if (d < 1.5) { col = SHORE; a = .9; }
      }
      od[p] = col[0] + n; od[p + 1] = col[1] + n; od[p + 2] = col[2] + n; od[p + 3] = Math.round(clamp(a) * 255);
    }
    tx.putImageData(out, 0, 0); bx.drawImage(terr, 0, 0);

    const place = (name, x, y, size, color, alpha = 1) => { const t = W.tint(name + (name.endsWith('.png') ? '' : '.png'), color); if (!t) return; bx.globalAlpha = alpha; const ww = size, hh = size * t.height / t.width; bx.drawImage(t, x - ww / 2, y - hh, ww, hh); bx.globalAlpha = 1; };
    const cell = (x, y) => [ox + (x + .5) * sc, oy + (y + .5) * sc];
    const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? grid[y][x] : 3);

    // roads: inked verge, then a sandy band
    if (roadCells && roadCells.size) {
      const cells = [...roadCells].map(k => k.split(',').map(Number)).filter(([x, y]) => at(x, y) !== 3);
      bx.save(); bx.lineCap = 'round';
      for (const [col, wd] of [['rgba(90,58,34,.55)', sc * 1.5], ['rgba(226,200,146,.95)', sc * 1.05]]) {
        bx.fillStyle = col;
        for (const [x, y] of cells) { const [cx, cy] = cell(x, y), r = wd * .56; bx.beginPath(); bx.roundRect ? bx.roundRect(cx - r, cy - r, r * 2, r * 2, r * .6) : bx.rect(cx - r, cy - r, r * 2, r * 2); bx.fill(); }
      }
      bx.restore();
    }

    // forest + rock sprites (sorted by y so that nearer ones overlap)
    const sprites = [], list = TREES[map.regionId] || ['tree1', 'tree4', 'tree5', 'tree6'];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = grid[y][x], r = noise(x * 7 + 3, y * 13 + 5), r2 = noise(x * 17 + 9, y * 5 + 1);
      if (!land[Math.round(cell(x, y)[1]) * CW + Math.round(cell(x, y)[0])] || inCity(x, y)) continue;
      if (v === 2 && r < .42) sprites.push({ k: 't', x: x + r2, y: y + r, n: list[Math.floor(r2 * list.length) % list.length] });
      if (v === 1) {
        let wallN = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === 1) wallN++;
        if (wallN >= 6 && r < .24 && (x + y) % 2 === 0) sprites.push({ k: 'm', x: x + r2, y: y + 1, n: 'mount' + (1 + Math.floor(r2 * 10) % 10) });
      }
    }
    sprites.sort((a, b) => a.y - b.y);
    for (const s of sprites) { const [px, py] = [ox + s.x * sc, oy + s.y * sc]; if (s.k === 'm') place(s.n, px, py + sc * .6, sc * 5.2, '#3a2b24', .9); else place(s.n, px, py, sc * 2.0 + (noise(s.x * 9, s.y * 9) * sc * .7), '#2c4a2e', .9); }

    // the walled city
    if (city) {
      const O = city.outer, I = city.inner, X = x => ox + x * sc, Y = y => oy + y * sc;
      bx.save();
      const path = R => { bx.beginPath(); R.poly.forEach(([x, y], i) => i ? bx.lineTo(X(x), Y(y)) : bx.moveTo(X(x), Y(y))); bx.closePath(); };
      const ground = R => {
        if (!R.poly && !city.water?.length) { bx.fillRect(X(R.x), Y(R.y), R.w * sc, R.h * sc); return; }
        bx.save(); if (R.poly) { path(R); bx.clip(); }
        for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) if (at(x, y) !== 3 && g.VTN_MAP_LAYOUTS.wardContains(R, x, y)) bx.fillRect(X(x), Y(y), sc, sc);
        bx.restore();
      };
      const stroke = (R, th) => { if (R.poly) { path(R); bx.stroke(); } else bx.strokeRect(X(R.x) + th / 2, Y(R.y) + th / 2, R.w * sc - th, R.h * sc - th); };
      const gaps = q => { if (!q.cells) return false; bx.fillStyle = 'rgb(226,200,146)'; for (const [x, y] of q.cells) bx.fillRect(X(x) - 1, Y(y) - 1, sc + 2, sc + 2); return true; };
      bx.fillStyle = 'rgba(244,228,186,.78)'; ground(O);
      bx.fillStyle = 'rgba(250,238,204,.9)'; ground(I);
      // avenue
      const gate = (city.gates || []).find(q => q.ward === 'outer');
      for (const [R, th, wardName] of [[O, 3.2, 'outer'], [I, 4.2, 'inner']]) {
        bx.lineJoin = 'miter'; bx.strokeStyle = INK; bx.lineWidth = th; stroke(R, th);
        bx.strokeStyle = 'rgba(232,210,160,.9)'; bx.lineWidth = th * .35; bx.setLineDash([sc * .5, sc * .5]); stroke(R, th); bx.setLineDash([]);
        for (const q of (city.gates || []).filter(q => q.ward === wardName)) {
          if (gaps(q)) continue;
          const half = q.width * sc / 2 + 1, c = q.at * sc + sc / 2; bx.fillStyle = 'rgb(226,200,146)';
          if (q.side === 'S') bx.fillRect(X(0) + c - half, Y(R.y + R.h) - th - 1, half * 2, th + 3);
          else if (q.side === 'N') bx.fillRect(X(0) + c - half, Y(R.y) - 1, half * 2, th + 3);
          else if (q.side === 'W') bx.fillRect(X(R.x) - 1, Y(0) + c - half, th + 3, half * 2);
          else bx.fillRect(X(R.x + R.w) - th - 1, Y(0) + c - half, th + 3, half * 2);
        }
      }
      for (const K of city.keeps || []) {
        bx.fillStyle = 'rgba(248,234,198,.86)'; ground(K);
        const th = 3.6; bx.lineJoin = 'miter'; bx.strokeStyle = INK; bx.lineWidth = th; stroke(K, th);
        bx.strokeStyle = 'rgba(232,210,160,.9)'; bx.lineWidth = th * .35; bx.setLineDash([sc * .5, sc * .5]); stroke(K, th); bx.setLineDash([]);
        for (const q of K.gates || []) {
          if (gaps(q)) continue;
          const half = q.width * sc / 2 + 1, c = q.at * sc + sc / 2; bx.fillStyle = 'rgb(226,200,146)';
          if (q.side === 'S') bx.fillRect(X(0) + c - half, Y(K.y + K.h) - th - 1, half * 2, th + 3);
          else if (q.side === 'N') bx.fillRect(X(0) + c - half, Y(K.y) - 1, half * 2, th + 3);
          else if (q.side === 'W') bx.fillRect(X(K.x) - 1, Y(0) + c - half, th + 3, half * 2);
          else bx.fillRect(X(K.x + K.w) - th - 1, Y(0) + c - half, th + 3, half * 2);
        }
      }
      for (const t of city.towers || []) { const [cx, cy] = cell(t.x, t.y), s = t.ward === 'inner' ? sc * 1.5 : sc * 1.2; bx.fillStyle = INK; bx.fillRect(cx - s / 2, cy - s / 2, s, s); bx.fillStyle = 'rgba(232,210,160,.95)'; bx.fillRect(cx - s / 2 + 1.5, cy - s / 2 + 1.5, s - 3, s - 3); }
      bx.restore();
      for (const l of (city.lots || []).slice().sort((a, b) => a.y - b.y)) {
        const [cx, cy] = [X(l.x + l.w / 2), Y(l.y + l.h) + sc * .2], big = l.w >= 9 || /palace|pagoda|hall_a|hall_b|library|sanctum/.test(l.asset || '');
        place(big ? 'b_open-city' : 'b_home', cx, cy, big ? Math.min(sc * 5.2, l.w * sc * .9) : sc * 2.4, '#3a281d', .92);
      }
    }

    // frame (double brown rule) + compass
    bx.save(); bx.strokeStyle = 'rgba(86,58,36,.9)'; bx.lineWidth = 3; bx.strokeRect(6, 6, CW - 12, CH - 12); bx.lineWidth = 1; bx.strokeRect(12, 12, CW - 24, CH - 24); bx.restore();
    if (W.ok('compass.png')) { const t = W.tint('compass.png', '#3a281d'); if (t) { bx.globalAlpha = .75; bx.drawImage(t, CW - 108, CH - 108, 84, 84 * t.height / t.width); bx.globalAlpha = 1; } }
    // vignette
    const gr = bx.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * .45, CW / 2, CH / 2, Math.max(CW, CH) * .75); gr.addColorStop(0, 'rgba(60,36,18,0)'); gr.addColorStop(1, 'rgba(60,36,18,.34)'); bx.fillStyle = gr; bx.fillRect(0, 0, CW, CH);
    return base;
  }

  // interiors: a floor plan instead of a landscape
  function buildPlan(S) {
    const { grid } = S, w = grid[0].length, h = grid.length, CW = S.cw, CH = S.ch, sc = S.scale, ox = S.ox, oy = S.oy, W = A();
    const base = document.createElement('canvas'); base.width = CW; base.height = CH; const bx = base.getContext('2d');
    if (W.ok('paper.jpg')) { const im = W.img('paper.jpg'), k = Math.max(CW / im.naturalWidth, CH / im.naturalHeight); bx.drawImage(im, 0, 0, im.naturalWidth * k, im.naturalHeight * k); } else { bx.fillStyle = PAPER; bx.fillRect(0, 0, CW, CH); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = grid[y][x]; if (v === 1) { bx.fillStyle = '#4a3322'; bx.fillRect(ox + x * sc, oy + y * sc, Math.ceil(sc), Math.ceil(sc)); } else { bx.fillStyle = (x + y) % 2 ? 'rgba(226,200,146,.55)' : 'rgba(214,186,130,.55)'; bx.fillRect(ox + x * sc, oy + y * sc, Math.ceil(sc), Math.ceil(sc)); } }
    bx.strokeStyle = 'rgba(86,58,36,.9)'; bx.lineWidth = 3; bx.strokeRect(6, 6, CW - 12, CH - 12);
    return base;
  }

  function marker(ctx, W, name, x, y, size, halo) {
    if (halo) { ctx.fillStyle = 'rgba(241,227,189,.94)'; ctx.strokeStyle = 'rgba(70,46,28,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, size * .78, 0, 7); ctx.fill(); ctx.stroke(); }
    const t = W.tint(name, '#2a1a14'); if (t) { const ww = size, hh = size * t.height / t.width; ctx.drawImage(t, x - ww / 2, y - hh / 2, ww, hh); }
  }

  function draw(canvas, S) {
    const W = A(); if (!W || !S?.grid) return null;
    const ctx = canvas.getContext('2d'), CW = canvas.width, CH = canvas.height, h = S.grid.length, w = S.grid[0].length;
    const interior = S.map?.kind === 'interior' || String(S.map?.id || '').startsWith('int|');
    const pad = interior ? 0 : PAD, sc = Math.min((CW - 40) / (w + pad * 2), (CH - 40) / (h + pad * 2), interior ? 34 : 99), ox = (CW - w * sc) / 2, oy = (CH - h * sc) / 2;
    const lay = { scale: sc, ox, oy, pad, cw: CW, ch: CH };
    const key = S.map.id + '|' + CW + 'x' + CH;
    let base = cache.get(key);
    if (!base) { base = interior ? buildPlan({ ...S, ...lay }) : buildBase({ ...S, ...lay }, key); cache.set(key, base); if (cache.size > 6) cache.delete(cache.keys().next().value); }
    ctx.clearRect(0, 0, CW, CH); ctx.drawImage(base, 0, 0);
    const t = (S.time ?? performance.now()) / 1000, pts = S.points || [], here = S.hero;
    const cell = (x, y) => [ox + (x + .5) * sc, oy + (y + .5) * sc];
    const city = interior ? null : cityRects(S.map), inCityLot = new Set((city?.lots || []).map(l => l.name));
    // route / selection line
    if (S.selected && here) { const [a, b] = cell(here.x, here.y), [c, d] = cell(S.selected.x, S.selected.y); ctx.save(); ctx.strokeStyle = 'rgba(150,40,40,.85)'; ctx.lineWidth = 3; ctx.setLineDash([9, 7]); ctx.lineDashOffset = -t * 18; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); ctx.restore(); }
    ctx.font = '600 12px "VTN UI",Georgia,serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    const labelled = [];
    for (const p of pts) {
      if (!Number.isFinite(p.x)) continue;
      const [x, y] = cell(p.x, p.y);
      if (p.type === 'npc' && p.npc?.civilian) continue;
      if (p.type === 'npc') { ctx.fillStyle = 'rgba(52,34,24,.8)'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); continue; }
      if (p.type === 'building') { if (city && inCityLot.has(p.id || p.name)) continue; if (!city) marker(ctx, W, 'b_home.png', x, y - 2, sc * 2.6, false); else continue; }
      else marker(ctx, W, ICON[p.type] || 'i_misc.png', x, y, p.type === 'anchor' ? 28 : 21, true);
      const label = p.name || p.type, ly = y + (y > CH * .75 ? -19 : 24);
      if (labelled.some(q => Math.abs(q.x - x) < 108 && Math.abs(q.y - ly) < 16)) continue;
      const text = label.length > 28 ? label.slice(0, 26) + '…' : label;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(243,229,192,.95)'; ctx.strokeText(text, x, ly); ctx.fillStyle = /boss|overlord|lair/.test(p.type) ? '#7a1f22' : '#2b1b12'; ctx.fillText(text, x, ly); labelled.push({ x, y: ly });
    }
    if (S.selected) { const [x, y] = cell(S.selected.x, S.selected.y), r = 12 + 2 * Math.sin(t * 4); ctx.strokeStyle = '#8a1f24'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - r - 4, y); ctx.lineTo(x - r + 5, y); ctx.moveTo(x + r - 5, y); ctx.lineTo(x + r + 4, y); ctx.moveTo(x, y - r - 4); ctx.lineTo(x, y - r + 5); ctx.moveTo(x, y + r - 5); ctx.lineTo(x, y + r + 4); ctx.stroke(); }
    if (here) {
      const [x, y] = cell(here.x, here.y), pulse = 1 + .12 * Math.sin(t * 3.2);
      ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(255,214,110,.35)'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill();
      ctx.fillStyle = '#f6c850'; ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 0); ctx.lineTo(0, 10); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    return lay;
  }

  g.VTNRegionMap = { draw, clear: () => cache.clear(), PAD };
})(typeof window !== 'undefined' ? window : globalThis);
