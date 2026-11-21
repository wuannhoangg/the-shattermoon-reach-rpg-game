(function (g) {
  'use strict';
  // Building interiors: small self-contained rooms (ERW interior kit, graded to the game's palette).
  // A building door in a region map leads to a map of kind 'interior'; collisions are baked into the grid so
  // movement and auto-pathing treat furniture like any other solid tile.
  const T = 32, WALL = 3;
  const kit = g.VTN_INTERIOR_KIT || { floors: {}, walls: {}, deco: {}, furn: {} };
  const data = () => g.VTN_DATA?.interiors || { templates: {}, byLot: {}, regionStyle: {} };
  const images = new Map();
  const plans = new Map();
  let camera = { x: 0, y: 0, zoom: 1, mapId: null };
  let lightCanvas = null;

  function img(file) {
    if (!file) return null;
    let e = images.get(file);
    if (e) return e;
    e = { file, ok: false, bad: false, image: null };
    if (typeof Image !== 'undefined') {
      const im = new Image();
      e.image = im;
      im.onload = () => { e.ok = true; };
      im.onerror = () => { e.bad = true; };
      im.src = file;
    } else e.bad = true;
    images.set(file, e);
    return e;
  }
  const ready = e => !!e && e.ok && e.image.naturalWidth > 0;

  function style(map, t) {
    const s = data().regionStyle?.[map.regionId];
    if (s && (t.id === 'home_a' || t.id === 'home_b')) return { wall: s[0], floor: s[1] };
    return { wall: t.wall, floor: t.floor };
  }
  const sizeOf = t => ({ width: t.w + 2, height: t.h + WALL + 1 });
  const hash = v => { let h = 2166136261; for (const c of String(v ?? '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

  function footprint(it) {
    const f = kit.furn[it[0]];
    if (!f || !f.fw || !f.fh) return [];
    const out = [];
    for (let i = 0; i < f.fw; i++) for (let j = 0; j < f.fh; j++) out.push([it[1] + i, it[2] - j]);
    return out;
  }

  function gridFor(map) {
    const t = data().templates[map.template];
    if (!t) return Array.from({ length: 8 }, () => Array(8).fill(1));
    const { width, height } = sizeOf(t);
    const a = Array.from({ length: height }, () => Array(width).fill(1));
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) a[WALL + y][1 + x] = 0;
    a[height - 1][1 + t.door] = 0; // threshold
    for (const it of t.furn) for (const [x, y] of footprint(it)) if (a[WALL + y]?.[1 + x] !== undefined) a[WALL + y][1 + x] = 1;
    return a;
  }

  function buildPlan(map) {
    const t = data().templates[map.template];
    if (!t) return null;
    const st = style(map, t), { width, height } = sizeOf(t), ox = T, oy = WALL * T;
    const files = new Set([kit.floors[st.floor], kit.walls[st.wall]]);
    const furn = [], lights = [], ceiling = [], windows = [];
    for (const it of t.furn) {
      const f = kit.furn[it[0]];
      if (!f) continue;
      files.add(f.file);
      if (it[0] === 'chandelier') { ceiling.push({ f, x: ox + it[1] * T + 16, y: oy + it[2] * T + 16 }); lights.push({ x: ox + it[1] * T + 16, y: oy + it[2] * T + 8, r: f.light, c: '255,205,130', seed: hash(it.join()) }); continue; }
      const px = ox + it[1] * T, py = oy + (it[2] + 1) * T - f.h;
      furn.push({ f, px, py, sortY: oy + (it[2] + 1) * T, id: it[0] });
      if (f.light) lights.push({ x: px + (f.fw || 1) * T / 2, y: oy + (it[2] + 1) * T - 30, r: f.light, c: '255,168,84', seed: hash(it.join()) });
    }
    for (const [id, x] of t.windows) {
      const d = kit.deco[id]; if (!d) continue;
      files.add(d.file); windows.push({ d, px: ox + x * T, py: 24 });
      lights.push({ x: ox + x * T + d.w / 2, y: oy + 40, r: 120, c: '140,170,255', seed: hash(id + x), moon: true });
    }
    const decor = [];
    for (const [id, x] of t.decor) { const f = kit.furn[id]; if (!f) continue; files.add(f.file); decor.push({ f, px: ox + x * T, py: id === 'shield_wall' || id === 'weapons' || id === 'weapons2' ? 26 : 22 }); }
    for (const l of t.lights) lights.push({ x: ox + l[0] * T + 16, y: oy + l[1] * T + 16, r: l[2] || 100, c: '255,168,84', seed: hash(l.join()) });
    const door = kit.deco.door_a; if (door) files.add(door.file);
    return { map, t, st, width, height, ox, oy, files: [...files].filter(Boolean), furn: furn.sort((a, b) => a.sortY - b.sortY), lights, ceiling, windows, decor, base: null };
  }

  function bakeBase(plan) {
    const { t, st, width, height } = plan;
    const c = document.createElement('canvas'); c.width = width * T; c.height = height * T;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#07060b'; x.fillRect(0, 0, c.width, c.height);
    const fl = img(kit.floors[st.floor]).image, wl = img(kit.walls[st.wall]).image;
    for (let yy = 0; yy < t.h; yy++) for (let xx = 0; xx < t.w; xx++) x.drawImage(fl, (1 + xx) * T, (WALL + yy) * T);
    for (let xx = 0; xx < t.w; xx++) x.drawImage(wl, (1 + xx) * T, 0);
    // side posts + wall base shadow
    x.fillStyle = '#120d12'; x.fillRect(0, 0, T, (WALL + t.h) * T); x.fillRect((1 + t.w) * T, 0, T, (WALL + t.h) * T);
    x.fillStyle = 'rgba(60,40,28,.9)'; x.fillRect(T - 4, WALL * T - 24, 4, (t.h) * T + 24); x.fillRect((1 + t.w) * T, WALL * T - 24, 4, t.h * T + 24);
    const sh = x.createLinearGradient(0, WALL * T, 0, WALL * T + 26); sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = sh; x.fillRect(T, WALL * T, t.w * T, 26);
    for (const w of plan.windows) { const im = img(w.d.file).image; x.drawImage(im, w.px, w.py); }
    for (const d of plan.decor) { const im = img(d.f.file).image; x.drawImage(im, d.px, d.py); }
    // threshold strip, door mat, a cold spill of moonlight from the door
    const ty = (height - 1) * T, dx = (1 + t.door) * T;
    x.fillStyle = '#1a1210'; x.fillRect(T, ty, t.w * T, T);
    x.fillStyle = '#4a2d22'; x.fillRect(dx, ty, T, T); x.fillStyle = '#6b4330'; x.fillRect(dx + 3, ty + 4, T - 6, T - 8);
    x.fillStyle = '#8a5a3c'; for (let i = 0; i < 4; i++) x.fillRect(dx + 5, ty + 7 + i * 5, T - 10, 2);
    const door = kit.deco.door_a;
    const spill = x.createLinearGradient(0, ty - 90, 0, ty); spill.addColorStop(0, 'rgba(150,175,255,0)'); spill.addColorStop(1, 'rgba(150,175,255,.14)');
    x.fillStyle = spill; x.fillRect(dx - 16, ty - 90, T + 32, 90);
    plan.base = c;
  }

  function getPlan(map) {
    let plan = plans.get(map.id);
    if (!plan) { plan = buildPlan(map); if (!plan) return null; plans.set(map.id, plan); for (const f of plan.files) img(f); }
    if (!plan.base && plan.files.every(f => ready(img(f)))) bakeBase(plan);
    return plan;
  }

  function light(plan, ctx, canvas, Z, camX, camY, now, heroX, heroY) {
    if (!lightCanvas) lightCanvas = document.createElement('canvas');
    if (lightCanvas.width !== canvas.width || lightCanvas.height !== canvas.height) { lightCanvas.width = canvas.width; lightCanvas.height = canvas.height; }
    const l = lightCanvas.getContext('2d');
    l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
    l.fillStyle = 'rgba(7,5,14,.50)'; l.fillRect(0, 0, lightCanvas.width, lightCanvas.height);
    l.globalCompositeOperation = 'destination-out';
    const punch = (x, y, r, a) => {
      const sx = (x - camX) * Z, sy = (y - camY) * Z, sr = r * Z, gr = l.createRadialGradient(sx, sy, sr * .08, sx, sy, sr);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(.55, `rgba(0,0,0,${a * .55})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = gr; l.beginPath(); l.arc(sx, sy, sr, 0, Math.PI * 2); l.fill();
    };
    for (const L of plan.lights) {
      const fl = L.moon ? 1 : 1 + .05 * Math.sin(now * 6.3 + L.seed % 17) + .03 * Math.sin(now * 11.1 + L.seed % 5);
      punch(L.x, L.y, L.r * fl, L.moon ? .35 : .9);
    }
    punch(heroX * T + 16, heroY * T + 14, 84, .55);
    ctx.drawImage(lightCanvas, 0, 0);
    // warm additive glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const L of plan.lights) {
      if (L.moon) continue;
      const fl = 1 + .05 * Math.sin(now * 6.3 + L.seed % 17), sx = (L.x - camX) * Z, sy = (L.y - camY) * Z, sr = L.r * Z * .9 * fl;
      const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr); gr.addColorStop(0, `rgba(${L.c},.16)`); gr.addColorStop(1, `rgba(${L.c},0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function render(ctx, canvas, info, cb = {}) {
    const map = info.map, plan = getPlan(map), now = performance.now() / 1000;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#050409'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!plan || !plan.base) return true;
    const Z = Math.max(1, Math.min(2, Math.floor(Math.min(canvas.width / 480, canvas.height / 320)))), VW = canvas.width / Z, VH = canvas.height / Z;
    const mw = plan.width * T, mh = plan.height * T;
    const heroX = Number.isFinite(info.heroRenderX) ? info.heroRenderX : info.px, heroY = Number.isFinite(info.heroRenderY) ? info.heroRenderY : info.py;
    const camX = mw <= VW ? Math.round((mw - VW) / 2) : Math.round(Math.max(0, Math.min(mw - VW, heroX * T + 16 - VW / 2)));
    const camY = mh <= VH ? Math.round((mh - VH) / 2) : Math.round(Math.max(0, Math.min(mh - VH, heroY * T + 16 - VH / 2)));
    camera = { x: camX, y: camY, zoom: Z, mapId: map.id };
    ctx.save(); ctx.scale(Z, Z); ctx.translate(-camX, -camY);
    ctx.drawImage(plan.base, 0, 0);
    const list = plan.furn.map(f => ({ sortY: f.sortY, pri: 1, f }));
    for (const p of info.points || []) if (p.type === 'npc') list.push({ sortY: (p.renderY ?? p.y) * T + T - 1, pri: 3, p });
    list.push({ sortY: heroY * T + T - 1, pri: 4, hero: true });
    list.sort((a, b) => a.sortY - b.sortY || a.pri - b.pri);
    for (const d of list) {
      if (d.f) ctx.drawImage(img(d.f.f.file).image, d.f.px, d.f.py);
      else if (d.p) { const dx = (d.p.renderX ?? d.p.x) * T, dy = (d.p.renderY ?? d.p.y) * T; if (!cb.drawNpc?.(ctx, d.p, dx, dy, info.S, now)) info.hero?.(dx, dy, '#9da47e'); }
      else if (d.hero) {
        const frame = info.heroMoving ? 1 + (Math.floor((info.heroWalkDistance || 0) * 3) % 2) : 0;
        if (!cb.drawHero?.(ctx, info, heroX * T, heroY * T, frame)) info.hero?.(heroX * T, heroY * T, '#a96652');
      }
    }
    for (const c of plan.ceiling) ctx.drawImage(img(c.f.file).image, Math.round(c.x - c.f.w / 2), Math.round(c.y - c.f.h + 18));
    ctx.restore();
    light(plan, ctx, canvas, Z, camX, camY, now, heroX, heroY);
    ctx.save(); ctx.scale(Z, Z); ctx.translate(-camX, -camY);
    ctx.font = `600 ${Math.round(13 / Z * 10) / 10}px 'VTN UI',sans-serif`; ctx.textAlign = 'center';
    for (const p of info.points || []) {
      const rx = p.renderX ?? p.x, ry = p.renderY ?? p.y;
      if (Math.abs(rx - info.px) + Math.abs(ry - info.py) >= 6) continue;
      const ly = ry * T + (p.type === 'npc' ? -6 : -4);
      ctx.fillStyle = '#070b0dcc'; ctx.fillText(p.name, rx * T + 17, ly + 1 / Z); ctx.fillStyle = '#ead9a5'; ctx.fillText(p.name, rx * T + 16, ly);
    }
    ctx.restore();
    return true;
  }

  // Interior maps -------------------------------------------------------------------------------
  function buildingTitle(lotName, t) {
    const n = g.VTNWorld?.buildingName?.({ name: lotName });
    return n && n !== 'Công trình' ? n : t.name;
  }
  function register(D) {
    const d = data(), out = [];
    D.interiorMaps = out;
    for (const [lot, info] of Object.entries(d.byLot || {})) {
      const t = d.templates[info.template]; if (!t) continue;
      const { width, height } = sizeOf(t), id = 'int|' + lot, region = (D.regions || []).find(r => r.id === info.regionId);
      const doorX = 1 + t.door;
      const map = {
        id, kind: 'interior', architecture: 'interior', regionId: info.regionId, parentId: info.regionId, lotName: lot, template: info.template,
        name: buildingTitle(lot, t), width, height, spawn: { x: doorX, y: height - 2 }, recommendedLevel: region?.recommendedLevel || [1, 5], links: [],
        points: [{ id: id + '|exit', type: 'exit', name: 'Cửa ra', x: doorX, y: height - 1, target: info.regionId }]
      };
      out.push(map);
    }
    return out;
  }
  const mapForLot = (D, lot) => (D.interiorMaps || []).find(m => m.lotName === lot) || null;
  function blocked() { return false; }

  g.VTNInteriors = { register, render, gridFor, mapForLot, isBlocked: blocked, camera: () => camera, templates: () => data().templates, reset: id => { if (id) plans.delete(id); else plans.clear(); } };
})(window);
