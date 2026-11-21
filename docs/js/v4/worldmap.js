/* VTNWorldMap — parchment-style fantasy world map (assets: assets/ui/worldmap, from the Fantasy Map Assets Pack Lite).
 * draw(canvas, data) paints everything; hit(data, x, y) returns the region index under a canvas point. */
(function (g) {
  'use strict';
  const BASE = 'assets/ui/worldmap/';
  const imgs = {}, tinted = new Map();
  const NAMES = ['paper.jpg', 'island1.png', 'island2.png', 'island3.png', 'island4.png', 'compass.png', 'waves1.png', 'waves2.png', 'waves3.png',
    'b_village.png', 'b_open-city.png', 'b_home.png', 'b_watchtower.png', 'b_cave.png', 'i_boss.png', 'i_landmark.png', 'i_tower2.png', 'i_dungeons.png', 'i_home.png', 'i_shield.png', 'i_misc.png', 'i_bridge.png',
    ...Array.from({ length: 10 }, (_, i) => 'mount' + (i + 1) + '.png'), 'tree1.png', 'tree4.png', 'tree5.png', 'tree6.png', 'tree7.png', 'tree8.png', 'pine1.png', 'pine3.png', 'bush1.png', 'cactus1.png'];
  let loaded = 0, started = false, onReady = [];
  function load() {
    if (started) return; started = true;
    for (const n of NAMES) { const im = new Image(); im.onload = im.onerror = () => { if (++loaded === NAMES.length) { const cbs = onReady; onReady = []; cbs.forEach(f => f()); } }; im.src = BASE + n; imgs[n] = im; }
  }
  const ready = () => loaded >= NAMES.length;
  const whenReady = f => { load(); if (ready()) f(); else onReady.push(f); };
  const ok = n => imgs[n] && imgs[n].complete && imgs[n].naturalWidth > 0;

  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let s = hash(seed) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function tint(name, color) {
    const key = name + '|' + color; if (tinted.has(key)) return tinted.get(key);
    const im = imgs[name]; if (!ok(name)) return null;
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    tinted.set(key, c); return c;
  }
  function mix(a, b, t) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }

  /* region look: terrain feature mix */
  const LOOK = {
    region_01: { land: 'pine', n: 16, extra: ['tree1', 'tree4'] }, region_02: { land: 'wave', n: 5, extra: ['b_home'] }, region_03: { land: 'tree', n: 10, extra: ['tree5', 'tree7'] },
    region_04: { land: 'mount', n: 8, extra: ['pine3'] }, region_05: { land: 'cactus', n: 9, extra: ['mount3'] }, region_06: { land: 'city', n: 5, extra: ['tree6'] },
    region_07: { land: 'mount', n: 6, extra: ['b_cave'] }, region_08: { land: 'pine', n: 14, extra: ['mount2'] }, region_09: { land: 'tree', n: 8, extra: ['b_watchtower'] }, region_10: { land: 'mount', n: 5, extra: ['b_watchtower'] }
  };
  const ICON = { region_01: 'i_landmark.png', region_02: 'i_shield.png', region_03: 'i_misc.png', region_04: 'i_dungeons.png', region_05: 'i_misc.png', region_06: 'i_home.png', region_07: 'i_dungeons.png', region_08: 'i_landmark.png', region_09: 'i_tower2.png', region_10: 'i_boss.png' };

  function scatter(ctx, reg, cx, cy, rx, ry, seed) {
    const look = LOOK[reg.id] || { land: 'tree', n: 8, extra: [] }, R = rng(seed), dark = '#1d1418';
    const place = (name, x, y, size, color, alpha = 1) => { const t = tint(name, color); if (!t) return; ctx.globalAlpha = alpha; const w = size, h = size * t.height / t.width; ctx.drawImage(t, x - w / 2, y - h, w, h); ctx.globalAlpha = 1; };
    const pts = [];
    for (let i = 0; i < look.n * 3 && pts.length < look.n; i++) { const a = R() * 7, r = Math.sqrt(R()), x = cx + Math.cos(a) * rx * r * 0.82, y = cy + Math.sin(a) * ry * r * 0.7; if (pts.every(p => Math.hypot(p[0] - x, (p[1] - y) * 1.4) > 17) && Math.hypot((x - cx) / rx, (y - cy) / ry) > 0.25) pts.push([x, y]); }
    pts.sort((a, b) => a[1] - b[1]);
    pts.forEach(([x, y], i) => {
      if (look.land === 'mount') place('mount' + (1 + (hash(seed + i) % 10)) + '.png', x, y, 84 + R() * 34, dark);
      else if (look.land === 'pine') place(i % 3 ? 'pine1.png' : 'pine3.png', x, y, 24 + R() * 9, '#16201a');
      else if (look.land === 'tree') place(look.extra[i % look.extra.length] + '.png', x, y, 26 + R() * 9, '#16201a');
      else if (look.land === 'cactus') place('cactus1.png', x, y, 18 + R() * 6, '#3a2f2a');
      else if (look.land === 'wave') place('waves' + (1 + i % 3) + '.png', x, y + 10, 52, '#2c5a68', 0.75);
      else if (look.land === 'city') place(i % 2 ? 'b_village.png' : 'b_home.png', x, y, 36 + R() * 10, dark);
    });
    // special silhouettes
    const ex = look.extra.filter(n => n.startsWith('b_') || n.startsWith('mount'));
    ex.forEach((n, i) => { const a = 2.2 + i * 2.1; place(n.endsWith('.png') ? n : n + '.png', cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.45, n.startsWith('mount') ? 70 : 28, dark); });
    if (look.land === 'city') place('b_open-city.png', cx, cy + 6, 78, '#1d1620');
  }

  function curve(ctx, a, b, seed) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, k = ((hash(seed) % 100) / 100 - 0.5) * 0.28;
    return { cx: mx - dy * k, cy: my + dx * k };
  }

  function draw(canvas, data) {
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, t = performance.now() / 1000;
    ctx.clearRect(0, 0, W, H);
    // parchment
    if (ok('paper.jpg')) { const im = imgs['paper.jpg'], s = Math.max(W / im.naturalWidth, H / im.naturalHeight); ctx.drawImage(im, (W - im.naturalWidth * s) / 2, (H - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s); } else { ctx.fillStyle = '#d9c39a'; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = 'rgba(255,226,170,0.10)'; ctx.fillRect(0, 0, W, H);
    // faint topography / sea stains on the paper
    const R0 = rng('stains'); ctx.save(); for (let i = 0; i < 18; i++) { ctx.fillStyle = `rgba(110,140,150,${0.035 + R0() * 0.04})`; ctx.beginPath(); ctx.ellipse(R0() * W, R0() * H, 40 + R0() * 120, 18 + R0() * 50, R0() * 3, 0, 7); ctx.fill(); } ctx.restore();
    const P = data.regions.map(r => ({ ...r, x: r.px * W, y: r.py * H }));
    // roads (dashed, under the islands' icons)
    ctx.save(); ctx.lineCap = 'round';
    for (const [i, j] of data.links) {
      const a = P[i], b = P[j], c = curve(ctx, a, b, a.id + b.id); const onRoute = data.route && data.route.includes(a.id) && data.route.includes(b.id);
      ctx.strokeStyle = onRoute ? 'rgba(255,196,64,0.95)' : 'rgba(110,40,50,0.7)'; ctx.lineWidth = onRoute ? 5 : 2.6; ctx.setLineDash(onRoute ? [2, 9] : [8, 7]); ctx.lineDashOffset = onRoute ? -t * 14 : 0;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.cx, c.cy, b.x, b.y); ctx.stroke();
    }
    ctx.restore();
    // land masses
    const geom = r => { const sc = r.scale || 1, w = 360 * sc, h = w * 0.83; return { isl: 'island' + (1 + (hash(r.id) % 4)) + '.png', w, h }; };
    const BIOME = { region_01: '#9fb07a', region_02: '#9cc4c8', region_03: '#8fae86', region_04: '#b8a58a', region_05: '#e3bf86', region_06: '#cdb596', region_07: '#a89a8e', region_08: '#eef0ee', region_09: '#c9a8b8', region_10: '#8f8aa8' };
    // 1) coastline under everything so overlapping islands read as one continent
    P.forEach(r => { const { isl, w, h } = geom(r), edge = tint(isl, '#4a3018'); if (!edge) return; ctx.save(); ctx.translate(r.x, r.y); ctx.drawImage(edge, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12); ctx.restore(); });
    // 2) fills
    P.forEach(r => {
      const { isl, w, h } = geom(r), fogged = !r.visited && !r.current, base = mix('#e0c896', BIOME[r.id] || '#d9c39a', fogged ? 0.45 : 0.78);
      const fill = tint(isl, base), shade = tint(isl, mix(base, '#6a4a30', 0.5));
      ctx.save(); ctx.translate(r.x, r.y); ctx.globalAlpha = fogged ? 0.92 : 1;
      if (fill) ctx.drawImage(fill, -w / 2, -h / 2, w, h);
      if (shade) { ctx.globalAlpha = 0.25; ctx.drawImage(shade, -w / 2 + 8, -h / 2 + 10, w - 16, h - 16); }
      ctx.restore();
    });
    // 3) lakes + rivers
    const LAKES = { region_01: [[-.15, .1]], region_03: [[.12, .05], [-.2, -.05]], region_04: [[.1, -.15]], region_06: [[-.25, .1]], region_09: [[.2, .12]] };
    P.forEach(r => { const { w, h } = geom(r); for (const [lx, ly] of (LAKES[r.id] || [])) { ctx.save(); ctx.translate(r.x + lx * w, r.y + ly * h); ctx.fillStyle = '#4f9aa6'; ctx.strokeStyle = '#2d5a63'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 16, 9, .3, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); } });
    ctx.save(); ctx.strokeStyle = '#4f9aa6'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const id of ['region_01', 'region_03', 'region_04', 'region_08']) { const r = P.find(v => v.id === id); if (!r) continue; const { w, h } = geom(r); ctx.beginPath(); ctx.moveTo(r.x - w * .05, r.y - h * .2); ctx.bezierCurveTo(r.x + w * .08, r.y - h * .08, r.x - w * .06, r.y + h * .05, r.x + w * .06, r.y + h * .22); ctx.stroke(); }
    ctx.restore();
    // 4) terrain symbols in ink
    P.forEach(r => { const { w, h } = geom(r); scatter(ctx, r, r.x, r.y + 6, w * 0.36, h * 0.34, r.id); });
    // labels + pins
    ctx.textAlign = 'center';
    P.forEach((r, i) => {
      const sel = data.selected === r.id, hov = data.hover === r.id;
      const ico = ICON[r.id], pulse = 1 + 0.08 * Math.sin(t * 3 + i);
      // pin
      ctx.save(); ctx.translate(r.x, r.y - 6);
      if (r.current) { ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(0, 14, 30 * pulse, 13 * pulse, 0, 0, 7); ctx.stroke(); }
      if (sel || hov) { ctx.strokeStyle = '#fff4d2'; ctx.lineWidth = 2; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(0, 14, 38, 17, 0, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1; const col = r.resolved ? '#6a8a58' : r.current ? '#b0661e' : '#6d1f2b';
      ctx.fillStyle = col; ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.fill(); ctx.stroke();
      const t2 = tint(ico, '#f4e6c4'); if (t2) ctx.drawImage(t2, -11, -11, 22, 22);
      ctx.restore();
      // label banner
      const label = r.name, lv = 'Cấp ' + r.level.join('–');
      ctx.font = '700 17px "VTN Title",Georgia,serif'; const w = Math.max(ctx.measureText(label).width + 22, 96), y = r.y + 34;
      ctx.fillStyle = 'rgba(38,22,30,0.86)'; ctx.strokeStyle = r.current ? '#ffcf5a' : '#b79a66'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect?.(r.x - w / 2, y - 16, w, 38, 6); if (!ctx.roundRect) ctx.rect(r.x - w / 2, y - 16, w, 38); ctx.fill(); ctx.stroke();
      ctx.fillStyle = r.current ? '#ffe3a0' : '#f1e3c2'; ctx.fillText(label, r.x, y + 1);
      ctx.font = '500 11px "VTN UI",sans-serif'; ctx.fillStyle = '#c7b697'; ctx.fillText(lv + (r.current ? ' · bạn ở đây' : r.resolved ? ' · Bá Chủ đã giải quyết' : ''), r.x, y + 16);
      // quest badges
      if (r.badge) { const bx = r.x + w / 2 - 4, by = y - 18; ctx.fillStyle = r.badge === 'active' ? '#8fb8ff' : '#ffd776'; ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 11, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#2a1a14'; ctx.font = '800 14px "VTN UI",sans-serif'; ctx.fillText(r.badge === 'active' ? '?' : '!', bx, by + 5); }
    });
    ctx.save(); ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 14; ctx.strokeRect(0, 0, W, H); ctx.strokeStyle = '#8a6a3c'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, W - 20, H - 20); ctx.restore();
    // title + compass
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(38,22,30,0.88)'; ctx.fillRect(18, 16, 300, 54); ctx.strokeStyle = '#b79a66'; ctx.lineWidth = 2; ctx.strokeRect(18, 16, 300, 54);
    ctx.fillStyle = '#f4e6c4'; ctx.font = '700 22px "VTN Title",Georgia,serif'; ctx.fillText('Vực Tàn Nguyệt', 32, 44); ctx.font = '500 11px "VTN UI",sans-serif'; ctx.fillStyle = '#c7b697'; ctx.fillText('Mười miền dưới trăng vỡ', 32, 61);
    if (ok('compass.png')) { ctx.globalAlpha = 0.85; ctx.drawImage(imgs['compass.png'], W - 130, H - 140, 110, 110); ctx.globalAlpha = 1; }
  }
  function hit(data, canvas, cx, cy) {
    const W = canvas.width, H = canvas.height; let best = -1, d0 = 70;
    data.regions.forEach((r, i) => { const d = Math.hypot(r.px * W - cx, r.py * H - cy); if (d < d0) { d0 = d; best = i; } });
    return best;
  }
  g.VTNWorldMap = { draw, hit, whenReady, load, assets: { img: n => imgs[n], ok, tint, rng, hash, mix } };
})(typeof window !== 'undefined' ? window : globalThis);
