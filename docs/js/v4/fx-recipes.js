(function (g) {
  'use strict';
  // Layered skill effects. Each skill gets a cast circle, a travel style, a primary impact, an accent impact and (for support
  // or status skills) its own recipe, picked from large tables by element + a stable hash of the skill. All pieces are tinted
  // textures (Cartoon FX Remaster, Magic effects pack, Free Quick Effects) drawn additively on the combat canvas.
  const texCache = new Map(), tintCache = new Map();
  function entry(key) {
    const m = g.VTN_FXTEX?.[key]; if (!m) return null;
    let e = texCache.get(key);
    if (!e) { const im = new Image(); e = { im, m, ok: false }; im.onload = () => { e.ok = true; }; im.src = m.file; texCache.set(key, e); }
    return e.ok ? e : null;
  }
  function tinted(key, color) {
    const e = entry(key); if (!e) return null;
    const id = key + color; let c = tintCache.get(id);
    if (!c) { c = document.createElement('canvas'); c.width = e.im.naturalWidth; c.height = e.im.naturalHeight; const x = c.getContext('2d'); x.drawImage(e.im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); tintCache.set(id, c); }
    return { c, m: e.m };
  }
  // S(ctx, texture, colour, x, y, size, rotation, alpha, {cell, squash, add})
  function S(ctx, key, color, x, y, size, rot, alpha, o = {}) {
    if (alpha <= .01 || size <= 1) return;
    size *= 1.4;
    const t = tinted(key, color); if (!t) return;
    const { c, m } = t, cw = c.width / m.cols, ch = c.height / m.rows, cell = o.cell || 0, col = cell % m.cols, row = Math.floor(cell / m.cols) % m.rows, w = size, h = size * ch / cw;
    ctx.save(); ctx.globalCompositeOperation = o.add === false ? 'source-over' : 'lighter';
    ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(1, o.squash || 1); ctx.globalAlpha = Math.min(1, alpha * (o.k || .74));
    ctx.drawImage(c, col * cw, row * ch, cw, ch, -w / 2, -h / 2, w, h); ctx.restore();
  }
  const hash = v => { let h = 2166136261; for (const ch of String(v ?? '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  const rnd = (seed, i) => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
  const ease = t => 1 - (1 - t) * (1 - t), pulse = t => Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
  const ACC = { fire: '#ffd07a', lightning: '#bfe6ff', ice: '#e6f9ff', water: '#c8f1ff', shadow: '#c9a6ff', holy: '#fff3c4', poison: '#d4ff9a', wind: '#e8fff5', stone: '#e8d2a6', slash: '#ffffff' };
  const HOT = '#fff3d6';

  // ---- impact recipes: f(c, b, kk, p, u)   kk = 0..1 progress of the impact, u = {col, acc, fade, R(i), seed}
  const IMPACT = [
    { id: 'starburst', fam: ['*'], f(c, b, kk, p, u) { S(c, 'burst', u.col, p.x, p.y, 40 + kk * 130, kk * .5, kk < .55 ? 1 - kk / .55 : 0); S(c, 'm_flash3', u.col, p.x, p.y, 60 + kk * 60, kk, u.fade * .8); S(c, 'rays', u.col, p.x, p.y, 24 + kk * 170, kk * .3, u.fade * .55); } },
    { id: 'shockrings', fam: ['*'], f(c, b, kk, p, u) { for (let i = 0; i < 3; i++) { const t = Math.max(0, kk - i * .12); S(c, 'm_circle2', u.col, p.x, p.y + 12, 30 + ease(t) * (130 + i * 30), 0, (1 - t) * .9, { squash: .42 }); } S(c, 'm_glow', u.acc, p.x, p.y, 70, 0, u.fade * .8); } },
    { id: 'slam', fam: ['stone', 'fire', 'slash', 'shadow'], f(c, b, kk, p, u) { S(c, 'm_crater', u.col, p.x, p.y + 14, 120, 0, u.fade, { squash: .4 }); S(c, 'm_crack', u.acc, p.x, p.y + 12, 130, u.R(1) * 6, Math.min(1, u.fade * 1.6), { squash: .45 }); for (let i = 0; i < 5; i++) { const a = -1.2 - i * .45; S(c, 'm_stone', u.acc, p.x + Math.cos(a) * kk * 60, p.y + Math.sin(a) * kk * 70 + kk * kk * 90, 22 + u.R(i) * 12, kk * 5 + i, u.fade, { add: false }); } S(c, 'm_smoke', '#8a7f93', p.x, p.y, 80 + kk * 60, 0, u.fade * .6, { add: false }); } },
    { id: 'xslash', fam: ['slash', 'wind', 'shadow', 'fire', 'ice'], f(c, b, kk, p, u) { const a = Math.min(1, kk * 4); for (const s of [-1, 1]) S(c, 'm_slash', u.col, p.x + s * (1 - a) * 30, p.y, 110 + kk * 40, s * .75 + (s < 0 ? 3.14 : 0), u.fade * a); S(c, 'hit_tri', u.acc, p.x, p.y, 40 + kk * 70, kk * 2, u.fade * .8); } },
    { id: 'claws', fam: ['slash', 'shadow', 'fire', 'poison'], f(c, b, kk, p, u) { for (let i = 0; i < 3; i++) { const t = Math.max(0, Math.min(1, (kk - i * .1) * 2)); S(c, 'streak', u.col, p.x - 24 + i * 24 + (1 - t) * 20, p.y - 22 + i * 3 + t * 20, 96, -.9, (1 - kk) * t, { cell: i % 2 }); } S(c, 'spark', u.acc, p.x, p.y, 60, kk * 3, u.fade); } },
    { id: 'pillar', fam: ['holy', 'lightning', 'fire', 'wind'], f(c, b, kk, p, u) { const h = Math.min(1, kk * 3); S(c, 'm_mask', u.col, p.x, p.y - 70 * h + 20, 60 + kk * 20, 0, u.fade, { squash: 3 }); S(c, 'm_flash1', u.acc, p.x, p.y + 6, 80 + kk * 60, kk, u.fade); S(c, 'flare', u.col, p.x, p.y, 150, 0, u.fade * .5); } },
    { id: 'vortex', fam: ['wind', 'water', 'shadow', 'holy'], f(c, b, kk, p, u) { S(c, 'g_swirl', u.col, p.x, p.y, 70 + kk * 90, kk * 7, u.fade * .95); S(c, 'g_dflare', u.acc, p.x, p.y, 60 + kk * 30, -kk * 4, u.fade * .6); for (let i = 0; i < 6; i++) { const a = i * 1.05 + kk * 6, r = 70 * (1 - kk) + 10; S(c, 'ember', u.acc, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .6, 16, 0, u.fade); } } },
    { id: 'inferno', fam: ['fire'], f(c, b, kk, p, u) { S(c, 'm_flash2', '#ff9a3c', p.x, p.y, 80 + kk * 110, kk * .5, kk < .6 ? 1 - kk / .6 : 0); S(c, 'g_flame', '#ff6a1f', p.x, p.y - 10 - kk * 20, 90 + kk * 40, 0, u.fade * .9); S(c, 'fire_anim', '#ffb04a', p.x, p.y - 8, 80 + kk * 30, 0, u.fade, { cell: Math.floor(kk * 8) % 4 }); for (let i = 0; i < 8; i++) S(c, 'ember', '#ffc45a', p.x + (u.R(i) - .5) * 80, p.y + 6 - kk * (40 + u.R(i + 9) * 60), 18 + u.R(i) * 10, 0, u.fade); } },
    { id: 'stormcell', fam: ['lightning'], f(c, b, kk, p, u) { const fl = Math.floor(kk * 22) % 2 ? 1 : .5; for (let i = 0; i < 3; i++) S(c, 'm_electro', u.col, p.x + (u.R(i) - .5) * 40, p.y + (u.R(i + 3) - .5) * 30, 110, u.R(i + 6) * 6.28, u.fade * fl, { cell: (i + Math.floor(kk * 12)) % 2 }); S(c, 'arcs', u.acc, p.x, p.y, 150, 0, u.fade * fl, { cell: Math.floor(kk * 14) % 4 }); S(c, 'ring_elec', u.col, p.x, p.y + 10, 40 + kk * 110, 0, u.fade, { squash: .5 }); } },
    { id: 'frost', fam: ['ice', 'water'], f(c, b, kk, p, u) { for (let i = 0; i < 6; i++) { const a = i * 1.047 + .3; S(c, 'm_snow', '#dff6ff', p.x + Math.cos(a) * kk * 62, p.y + Math.sin(a) * kk * 44, 30, kk * 3 + i, u.fade); } for (let i = 0; i < 4; i++) { const a = i * 1.57 + .5; S(c, 'shards', '#cfeeff', p.x + Math.cos(a) * kk * 54, p.y + Math.sin(a) * kk * 38 - kk * 10, 44, kk * 3 + i, u.fade, { cell: i }); } S(c, 'ring_ice', '#bfeaff', p.x, p.y + 12, 40 + kk * 120, 0, u.fade, { squash: .45 }); } },
    { id: 'gore', fam: ['shadow', 'slash', 'poison'], f(c, b, kk, p, u) { S(c, 'blood', '#c8325a', p.x, p.y, 70 + kk * 70, u.R(2) * 6, Math.min(1, u.fade * 1.4), { add: false }); S(c, 'm_splat', '#8b1d40', p.x, p.y + 8, 60 + kk * 40, u.R(3) * 6, u.fade, { add: false }); S(c, 'glow_star', u.acc, p.x, p.y, 50, 0, u.fade * .6); } },
    { id: 'toxic', fam: ['poison'], f(c, b, kk, p, u) { for (let i = 0; i < 4; i++) S(c, 'm_smoke', '#7fbf4a', p.x + (i - 1.5) * 22, p.y - kk * (20 + i * 8), 70 + kk * 40, kk * (i % 2 ? 1 : -1), u.fade * .8, { add: false }); for (let i = 0; i < 6; i++) S(c, 'bubble', '#d4ff9a', p.x + (u.R(i) - .5) * 70, p.y - kk * (30 + u.R(i + 4) * 50), 14 + u.R(i) * 10, 0, u.fade); S(c, 'smoke4', '#9ad45a', p.x, p.y - 10, 90 + kk * 30, 0, u.fade * .5, { cell: Math.floor(kk * 4) }); } },
    { id: 'crystals', fam: ['ice', 'holy', 'stone', 'lightning'], f(c, b, kk, p, u) { const up = ease(Math.min(1, kk * 2.2)); for (let i = 0; i < 5; i++) { const a = -1.57 + (i - 2) * .5; S(c, 'm_crystal', u.col, p.x + (i - 2) * 22, p.y + 14 - up * 46 + Math.abs(i - 2) * 8, 46 + (2 - Math.abs(i - 2)) * 16, a * .5 + 1.57 - 1.57, u.fade, { add: false, k: .9 }); } S(c, 'm_glow', u.acc, p.x, p.y, 90, 0, u.fade * .8); } },
    { id: 'tech', fam: ['lightning', 'holy', 'stone', 'water'], f(c, b, kk, p, u) { S(c, 'm_tech', u.col, p.x, p.y + 14, 120 + kk * 40, kk * 3, u.fade, { squash: .45 }); S(c, 'm_tech2', u.acc, p.x, p.y + 14, 80 + kk * 30, -kk * 2, u.fade * .8, { squash: .45 }); for (let i = 0; i < 3; i++) S(c, 'm_arrow', u.acc, p.x + (i - 1) * 24, p.y - kk * (30 + i * 10), 28, -1.57, u.fade); } },
    { id: 'arcane', fam: ['holy', 'shadow', 'wind', 'water', 'ice'], f(c, b, kk, p, u) { S(c, 'm_magic', u.col, p.x, p.y + 14, 130 + kk * 30, kk * 2.4, u.fade, { squash: .42 }); S(c, 'm_magic2', u.acc, p.x, p.y + 14, 100, -kk * 2.4, u.fade * .8, { squash: .42 }); S(c, 'star4', HOT, p.x, p.y - 8, 40 + kk * 24, kk, u.fade); } },
    { id: 'leafstorm', fam: ['poison', 'wind', 'holy'], f(c, b, kk, p, u) { for (let i = 0; i < 7; i++) { const a = i * .9 + kk * 5, r = 20 + kk * 60; S(c, 'petal', u.col, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .55 - kk * 24, 24 + u.R(i) * 10, a * 2, u.fade, { cell: i % 4, add: false, k: .9 }); } S(c, 'cloud', u.acc, p.x, p.y, 70 + kk * 40, 0, u.fade * .5); } },
    { id: 'aquaburst', fam: ['water', 'ice'], f(c, b, kk, p, u) { for (let i = 0; i < 8; i++) { const a = i * .785; S(c, 'bubble', '#bfeaff', p.x + Math.cos(a) * kk * 60, p.y + Math.sin(a) * kk * 40 - kk * 16, 14 + u.R(i) * 10, 0, u.fade); } S(c, 'water_splash', '#a8e4ff', p.x, p.y + 6, 110 + kk * 40, 0, u.fade, { squash: 1 }); S(c, 'm_circle', u.col, p.x, p.y + 12, 30 + kk * 120, 0, u.fade * .8, { squash: .42 }); } },
    { id: 'gravity', fam: ['shadow', 'holy', 'stone'], f(c, b, kk, p, u) { S(c, 'g_circle', u.col, p.x, p.y, 150 * (1 - kk * .7), 0, u.fade * .9); S(c, 'g_dflare', u.acc, p.x, p.y, 70, kk * 5, u.fade); for (let i = 0; i < 8; i++) { const a = i * .785, r = 70 * (1 - kk); S(c, 'm_glow', u.acc, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .6, 16, 0, u.fade); } } },
    { id: 'judgement', fam: ['holy', 'fire', 'lightning'], f(c, b, kk, p, u) { S(c, 'm_mask', '#fff3c4', p.x, p.y - 60, 80, 0, u.fade, { squash: 3.4 }); S(c, 'runic', u.col, p.x, p.y + 14, 100 + kk * 50, kk * 2.6, u.fade, { squash: .42 }); S(c, 'hit_tri', u.acc, p.x, p.y, 50 + kk * 50, 0, u.fade); S(c, 'star4', HOT, p.x, p.y - 10, 50, kk, u.fade); } },
    { id: 'comet', fam: ['fire', 'ice', 'stone', 'holy'], f(c, b, kk, p, u) { const t = Math.min(1, kk * 1.8); S(c, 'stretch_fire', u.col, p.x - 60 * (1 - t) - 10, p.y - 70 * (1 - t) - 8, 130, .6, 1 - kk, { add: true }); S(c, 'm_flash', u.acc, p.x, p.y, 60 + kk * 80, 0, kk > .3 ? u.fade : 0); S(c, 'm_crater', u.col, p.x, p.y + 14, 100, 0, kk > .3 ? u.fade : 0, { squash: .4 }); } },
    { id: 'sonic', fam: ['wind', 'lightning', 'water', 'holy'], f(c, b, kk, p, u) { for (let i = 0; i < 3; i++) { const t = Math.max(0, kk - i * .1); S(c, 'ring_arc', u.col, p.x, p.y, 40 + ease(t) * 150, i * 1.2 + kk, (1 - t) * .9); } S(c, 'streak', u.acc, p.x, p.y, 160, 0, u.fade * .7, { cell: 1 }); } },
    { id: 'shatter', fam: ['ice', 'stone', 'lightning'], f(c, b, kk, p, u) { S(c, 'm_crack', u.col, p.x, p.y, 120 + kk * 30, 0, u.fade); for (let i = 0; i < 6; i++) { const a = i * 1.05; S(c, 'shards', u.acc, p.x + Math.cos(a) * kk * 70, p.y + Math.sin(a) * kk * 50, 36, kk * 5 + i, u.fade, { cell: i % 4 }); } S(c, 'm_glow', u.col, p.x, p.y, 70, 0, u.fade * .8); } },
    { id: 'tendrils', fam: ['shadow', 'poison', 'wind'], f(c, b, kk, p, u) { for (let i = 0; i < 6; i++) { const a = i * 1.047 + .4, r = 20 + ease(kk) * 55; S(c, 'm_proj', u.col, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .65, 80, a, u.fade * .9); } S(c, 'g_swirl', u.acc, p.x, p.y, 50, kk * 5, u.fade * .8); } },
    { id: 'emberrain', fam: ['fire', 'lightning'], f(c, b, kk, p, u) { for (let i = 0; i < 14; i++) { const t = (kk * 1.4 + u.R(i)) % 1; S(c, 'ember', u.col, p.x + (u.R(i + 20) - .5) * 110, p.y - 80 + t * 90, 16 + u.R(i) * 10, 0, u.fade * (1 - Math.abs(t - .5))); } S(c, 'm_glow', u.acc, p.x, p.y, 80, 0, u.fade * .6); } },
    { id: 'spirit', fam: ['shadow', 'holy'], f(c, b, kk, p, u) { S(c, 'skull2', u.col, p.x, p.y - 14 - kk * 40, 40 + kk * 20, 0, pulse(kk) * .8); for (let i = 0; i < 4; i++) S(c, 'm_smoke', u.acc, p.x + (i - 1.5) * 20, p.y - kk * (30 + i * 12), 60, 0, u.fade * .6, { add: false }); S(c, 'g_flare', u.col, p.x, p.y, 120, 0, u.fade * .6); } },
    { id: 'bolt', fam: ['lightning'], f(c, b, kk, p, u) { const fl = Math.floor(kk * 24) % 2 ? 1 : .6; S(c, 'arcs', u.col, p.x, p.y - 40, 120, 1.57, u.fade * fl, { cell: Math.floor(kk * 12) % 4, squash: .5 }); S(c, 'm_flare', u.acc, p.x, p.y, 120, 0, u.fade); S(c, 'm_flash', u.col, p.x, p.y, 90 + kk * 40, 0, kk < .4 ? 1 - kk / .4 : 0); } },
    { id: 'voidmaw', fam: ['shadow'], f(c, b, kk, p, u) { S(c, 'g_circle', '#6a3fb0', p.x, p.y, 120 * (1 - kk * .5), 0, u.fade, { add: false, k: .9 }); S(c, 'm_magic2', u.col, p.x, p.y, 110, kk * 3, u.fade * .9); S(c, 'g_dflare', u.acc, p.x, p.y, 70, -kk * 3, u.fade * .7); } },
    { id: 'bloom', fam: ['holy', 'poison', 'wind'], f(c, b, kk, p, u) { S(c, 'm_flash3', u.col, p.x, p.y, 70 + kk * 90, kk * 1.5, u.fade); for (let i = 0; i < 4; i++) { const a = i * 1.57 + .8; S(c, 'm_star', u.acc, p.x + Math.cos(a) * kk * 50, p.y + Math.sin(a) * kk * 38, 22, kk * 4, u.fade); } S(c, 'petal', u.col, p.x, p.y - kk * 20, 90, kk, u.fade * .7, { cell: Math.floor(kk * 4), add: false }); } },
    { id: 'heartbreak', fam: ['shadow', 'poison', 'fire'], f(c, b, kk, p, u) { const sh = Math.sin(kk * 40) * 3 * u.fade; S(c, 'm_heart', '#b0305a', p.x + sh, p.y - 10, 50 + kk * 30, 0, u.fade, { add: false, k: .9 }); S(c, 'hit_tri', u.acc, p.x, p.y, 60 + kk * 60, kk * 2, u.fade); S(c, 'm_crack', '#ffd0e0', p.x + sh, p.y - 10, 70, 0, u.fade * .8); } },
  ];

  // ---- support recipes (own side)
  const SUPPORT = [
    { id: 'heal_runic', f(c, b, kk, p, u) { S(c, 'runic', u.col, p.x, p.y + 16, 90 + kk * 50, kk * 2.4, u.fade * .9, { squash: .42 }); S(c, 'star4', HOT, p.x, p.y - 26 - kk * 26, 26 + kk * 10, kk * 1.5, u.fade); for (let i = 0; i < 5; i++) S(c, 'ember', u.col, p.x - 30 + i * 15, p.y + 10 - kk * (46 + i * 8), 22, 0, u.fade); } },
    { id: 'hearts', f(c, b, kk, p, u) { for (let i = 0; i < 5; i++) { const t = (kk * 1.2 + i * .17) % 1; S(c, 'm_heart', '#ff8fb0', p.x + (i - 2) * 16 + Math.sin(t * 6 + i) * 6, p.y + 6 - t * 70, 20 + u.R(i) * 8, 0, Math.min(1, (1 - t) * 2), { add: false, k: .85 }); } S(c, 'm_glow', u.col, p.x, p.y, 90, 0, u.fade * .6); } },
    { id: 'dome', f(c, b, kk, p, u) { S(c, 'm_circle2', u.col, p.x, p.y, 110 + pulse(kk) * 14, 0, Math.min(1, kk * 5) * u.fade * 1.6); S(c, 'm_tech', u.acc, p.x, p.y, 96, kk * 2, u.fade, { }); S(c, 'm_glow', u.col, p.x, p.y, 100, 0, u.fade * .5); } },
    { id: 'rise', f(c, b, kk, p, u) { for (let i = 0; i < 3; i++) { const t = (kk * 1.3 + i * .25) % 1; S(c, 'm_arrow', u.col, p.x + (i - 1) * 26, p.y + 20 - t * 80, 34, -1.57, Math.min(1, (1 - t) * 2)); } S(c, 'ring_arc', u.acc, p.x, p.y + 16, 60 + kk * 60, kk * 4, u.fade, { squash: .45 }); } },
    { id: 'sparkles', f(c, b, kk, p, u) { for (let i = 0; i < 9; i++) { const t = (kk * 1.3 + u.R(i)) % 1; S(c, 'star4', u.col, p.x + (u.R(i + 9) - .5) * 90, p.y - 70 + t * 90, 14 + u.R(i) * 12, t * 4, Math.sin(t * Math.PI)); } S(c, 'm_glow', u.acc, p.x, p.y, 90, 0, u.fade * .5); } },
    { id: 'wings', f(c, b, kk, p, u) { const o = ease(Math.min(1, kk * 2)); S(c, 'm_slash', u.col, p.x - 24 - o * 16, p.y - 14, 90, 3.14 + .3, u.fade); S(c, 'm_slash', u.col, p.x + 24 + o * 16, p.y - 14, 90, -.3, u.fade); S(c, 'star4', HOT, p.x, p.y - 10, 36, kk, u.fade); } },
    { id: 'pulses', f(c, b, kk, p, u) { for (let i = 0; i < 3; i++) { const t = (kk * 1.5 + i * .3) % 1; S(c, 'ring_arc', u.col, p.x, p.y + 14 - t * 20, 50 + t * 80, t * 3, 1 - t, { squash: .45 }); } S(c, 'g_flare', u.acc, p.x, p.y, 90, 0, u.fade * .6); } },
    { id: 'cleanse', f(c, b, kk, p, u) { S(c, 'g_swirl', u.col, p.x, p.y - 6, 80 + kk * 30, -kk * 5, u.fade); for (let i = 0; i < 5; i++) { const a = i * 1.26 + kk * 4; S(c, 'petal', '#ffffff', p.x + Math.cos(a) * 36, p.y - kk * 34 + Math.sin(a) * 18, 20, a, u.fade, { cell: i % 4, add: false, k: .8 }); } } },
  ];

  // ---- status / debuff recipes (on the target)
  const DEBUFF = [
    { id: 'curse', f(c, b, kk, p, u) { S(c, 'm_magic2', u.col, p.x, p.y + 14, 110, kk * 2, u.fade, { squash: .42 }); S(c, 'skull2', u.acc, p.x, p.y - 20 - kk * 14, 34, 0, pulse(kk) * .8); } },
    { id: 'chains', f(c, b, kk, p, u) { S(c, 'm_tech', u.col, p.x, p.y + 14, 100, -kk * 2, u.fade, { squash: .42 }); for (let i = 0; i < 3; i++) S(c, 'm_arrow', u.acc, p.x + (i - 1) * 22, p.y - 40 + kk * 40, 30, 1.57, u.fade); } },
    { id: 'drain', f(c, b, kk, p, u) { for (let i = 0; i < 6; i++) { const a = i * 1.05, r = 60 * (1 - kk) + 6; S(c, 'm_glow', u.col, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .6, 18, 0, u.fade); } S(c, 'g_dflare', u.acc, p.x, p.y, 60, kk * 4, u.fade * .8); } },
    { id: 'slow', f(c, b, kk, p, u) { for (let i = 0; i < 6; i++) { const t = (kk * 1.2 + u.R(i)) % 1; S(c, 'water_drop', u.col, p.x + (u.R(i + 5) - .5) * 70, p.y - 60 + t * 70, 26, 0, Math.sin(t * Math.PI)); } S(c, 'm_circle', u.acc, p.x, p.y + 14, 30 + kk * 90, 0, u.fade, { squash: .42 }); } },
    { id: 'stun', f(c, b, kk, p, u) { for (let i = 0; i < 3; i++) { const a = i * 2.09 + kk * 8; S(c, 'm_star', '#ffe27a', p.x + Math.cos(a) * 26, p.y - 40 + Math.sin(a) * 8, 18, a, 1 - kk * .4); } S(c, 'm_glow', u.col, p.x, p.y - 30, 60, 0, u.fade * .5); } },
    { id: 'fear', f(c, b, kk, p, u) { for (let i = 0; i < 3; i++) { const t = (kk * 1.3 + i * .22) % 1; S(c, 'skull', u.col, p.x + (i - 1) * 24, p.y - 6 - t * 56, 24, 0, Math.sin(t * Math.PI) * .8); } S(c, 'm_smoke', '#4a2f7a', p.x, p.y, 90, 0, u.fade * .6, { add: false }); } },
    { id: 'poisonmark', f(c, b, kk, p, u) { S(c, 'm_splat', '#7fbf4a', p.x, p.y + 10, 80, u.R(1) * 6, u.fade * .8, { add: false }); for (let i = 0; i < 5; i++) S(c, 'bubble', '#d4ff9a', p.x + (u.R(i) - .5) * 50, p.y - kk * (20 + u.R(i + 3) * 50), 14, 0, u.fade); } },
    { id: 'blind', f(c, b, kk, p, u) { S(c, 'm_flash3', u.col, p.x, p.y - 20, 60 + kk * 100, kk * 2, u.fade); S(c, 'flare', '#ffffff', p.x, p.y - 20, 150, 0, u.fade * .7); } },
  ];

  // ---- cast (at the caster) and travel styles
  const CAST = [
    (c, b, k, p, u) => S(c, 'm_magic', u.col, p.x, p.y + 20, 90 + pulse(k) * 20, k * 3, pulse(k * 1.4), { squash: .42 }),
    (c, b, k, p, u) => S(c, 'm_tech', u.col, p.x, p.y + 20, 90, -k * 3, pulse(k * 1.4), { squash: .42 }),
    (c, b, k, p, u) => { S(c, 'm_circle2', u.col, p.x, p.y + 20, 120 - k * 70, 0, pulse(k * 1.4), { squash: .42 }); S(c, 'm_glow', u.acc, p.x, p.y, 60, 0, pulse(k * 1.4) * .6); },
    (c, b, k, p, u) => S(c, 'g_circle', u.col, p.x, p.y + 20, 110, 0, pulse(k * 1.4), { squash: .42 }),
    (c, b, k, p, u) => { for (let i = 0; i < 6; i++) { const a = i * 1.05 + k * 5, r = 40 * (1 - k) + 6; S(c, 'm_glow', u.acc, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .6, 14, 0, pulse(k * 1.2)); } },
    (c, b, k, p, u) => S(c, 'ring_arc', u.col, p.x, p.y + 20, 100 - k * 40, k * 5, pulse(k * 1.4), { squash: .42 }),
    (c, b, k, p, u) => S(c, 'runic', u.col, p.x, p.y + 20, 90, k * 2, pulse(k * 1.4), { squash: .42 }),
    (c, b, k, p, u) => S(c, 'g_dflare', u.col, p.x, p.y, 50 + k * 40, k * 4, pulse(k * 1.3)),
  ];
  const TRAVEL = [
    (c, b, t, at, ang, u) => { for (let i = 0; i < 6; i++) { const q = Math.max(0, t - i * .06); S(c, 'm_glow', u.col, at.x - Math.cos(ang) * i * 14, at.y - Math.sin(ang) * i * 14, 28 - i * 3, 0, 1 - i * .15); } },
    (c, b, t, at, ang, u) => S(c, 'm_trail', u.col, at.x - Math.cos(ang) * 40, at.y - Math.sin(ang) * 40, 110, ang, .95),
    (c, b, t, at, ang, u) => { S(c, 'g_flame', u.col, at.x, at.y, 56, ang + 1.57, 1); for (let i = 0; i < 5; i++) S(c, 'ember', u.acc, at.x - Math.cos(ang) * i * 12 + (u.R(i) - .5) * 8, at.y - Math.sin(ang) * i * 12 + (u.R(i + 5) - .5) * 8, 16, 0, 1 - i * .18); },
    (c, b, t, at, ang, u) => { for (let i = 0; i < 6; i++) { const a = i * 1.05 + t * 14; S(c, 'm_star', u.acc, at.x + Math.cos(a) * 14 - Math.cos(ang) * i * 8, at.y + Math.sin(a) * 14 - Math.sin(ang) * i * 8, 14, a, 1 - i * .12); } S(c, 'm_glow', u.col, at.x, at.y, 40, 0, 1); },
    (c, b, t, at, ang, u) => { S(c, 'arcs', u.col, at.x - Math.cos(ang) * 40, at.y - Math.sin(ang) * 40, 120, ang, Math.floor(t * 40) % 2 ? 1 : .5, { cell: Math.floor(t * 30) % 4 }); S(c, 'spark', u.acc, at.x, at.y, 36, t * 8, 1); },
    (c, b, t, at, ang, u) => { for (let i = 0; i < 4; i++) S(c, 'bubble', u.col, at.x - Math.cos(ang) * i * 14 + (u.R(i) - .5) * 10, at.y - Math.sin(ang) * i * 14 + (u.R(i + 3) - .5) * 10, 16 + u.R(i) * 8, 0, 1 - i * .2); S(c, 'm_glow', u.acc, at.x, at.y, 30, 0, 1); },
    (c, b, t, at, ang, u) => { S(c, 'm_proj', u.col, at.x - Math.cos(ang) * 30, at.y - Math.sin(ang) * 30, 100, ang, 1); S(c, 'g_flare', u.acc, at.x, at.y, 44, 0, .8); },
    (c, b, t, at, ang, u) => { for (let i = 0; i < 4; i++) S(c, 'shards', u.col, at.x - Math.cos(ang) * i * 14, at.y - Math.sin(ang) * i * 14, 28, t * 12 + i, 1 - i * .2, { cell: i }); },
  ];

  const pickFrom = (list, family, seed, salt, skip) => {
    const fit = list.filter(r => !r.fam || r.fam.includes('*') || r.fam.includes(family)), pool = fit.length ? fit : list;
    let r = pool[(seed + salt) % pool.length];
    if (skip && r === skip && pool.length > 1) r = pool[(seed + salt + 1) % pool.length];
    return r;
  };

  // Called once per skill use: returns a recipe set stored on the burst.
  function plan(detail, family, support) {
    const seed = hash(detail.skillId && detail.skillId !== 'x' ? detail.skillId : (detail.name || '') + '|' + (detail.type || ''));
    const kind = detail.kind || 'damage';
    let main, accent = null;
    if (support) main = SUPPORT[seed % SUPPORT.length];
    else if (['status', 'debuff', 'curse'].includes(kind)) main = DEBUFF[seed % DEBUFF.length];
    else { main = pickFrom(IMPACT, family, seed, 0); accent = pickFrom(IMPACT, family, (seed >>> 4), 3, main); if (accent === main) accent = null; }
    const sk = g.VTNRules?.by?.('skills', detail.skillId);
    let accent2 = null;
    if (!support && sk?.status) accent2 = DEBUFF[(seed >>> 8) % DEBUFF.length];            // skills that inflict a status also show it
    else if (kind === 'ultimate') accent2 = pickFrom(IMPACT, family, (seed >>> 9), 5, main);   // ultimates stack a third layer
    return { seed, main, accent, accent2, cast: CAST[(seed >>> 3) % CAST.length], travel: TRAVEL[(seed >>> 6) % TRAVEL.length], count: IMPACT.length + SUPPORT.length + DEBUFF.length };
  }

  function draw(ctx, b, k) {
    const pl = b.plan; if (!pl) return;
    const col = b.color, acc = ACC[b.family] || '#ffffff', R = i => rnd(pl.seed % 997, i), p = b.target, from = b.from;
    const u = { col, acc, R, seed: pl.seed, fade: 1 };
    // cast circle at the caster
    if (k < .34) pl.cast(ctx, b, k / .34, from, u);
    // travel
    if (!b.support && k < .45) {
      const t = k / .45, at = { x: from.x + (p.x - from.x) * t, y: from.y + (p.y - from.y) * t }, ang = Math.atan2(p.y - from.y, p.x - from.x);
      pl.travel(ctx, b, t, at, ang, u);
    }
    const kk = Math.max(0, Math.min(1, (k - (b.support ? .12 : .28)) / (b.support ? .88 : .72)));
    if (kk <= 0) return;
    u.fade = Math.max(0, 1 - kk);
    // shared core flash so every impact reads at once
    S(ctx, 'glow_star', col, p.x, p.y, 34 + kk * 40, 0, Math.min(1, u.fade * 1.2));
    pl.main.f(ctx, b, kk, p, u);
    if (pl.accent2) pl.accent2.f(ctx, { ...b, seed: pl.seed + 13 }, Math.min(1, kk * .95), { x: p.x, y: p.y }, { ...u, col: acc, acc: col, fade: u.fade * .5, R: i => rnd(pl.seed % 983 + 5, i) });
    if (pl.accent) { const v = { ...u, col: acc, acc: col }; pl.accent.f(ctx, { ...b, seed: pl.seed + 7 }, Math.min(1, kk * 1.05), { x: p.x + (u.R(40) - .5) * 14, y: p.y + (u.R(41) - .5) * 10 }, { ...v, fade: u.fade * .55, R: i => rnd(pl.seed % 991 + 3, i) }); }
  }
  g.VTNFxRecipes = { plan, draw, variants: () => IMPACT.length * Math.max(1, SUPPORT.length) * CAST.length * TRAVEL.length, counts: () => ({ impact: IMPACT.length, support: SUPPORT.length, debuff: DEBUFF.length, cast: CAST.length, travel: TRAVEL.length }) };
})(window);
