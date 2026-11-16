/* Skill VFX engine. Pure canvas, no dependencies, file:// friendly.
 *
 *   const vfx = VTNVfx.create({ reducedMotion });
 *   // every frame (the battle stage owns the loop):
 *   vfx.update(dtMs);  vfx.drawFields(ctx, W, H);  ... sprites ...  vfx.draw(ctx);
 *   // when a skill is used (returns a Promise that resolves when the effect has finished):
 *   await vfx.play(skill.vfx, { from:{x,y}, targets:[{x,y},...], category, onImpact(i,point) });
 *   vfx.getShake() -> {x,y} offset to apply to the stage this frame
 *
 * Data: window.VTN_VFX_ATLAS (assets/vfx/atlases.js), VTN_VFX_LIBRARY (vfx_library.js), VTN_VFX_OBJECTS (objects.js).
 * Coordinates are in stage pixels. `scale` is the pixel-art zoom (default 2).
 */
(function (g) {
  'use strict';
  const ATLAS = () => g.VTN_VFX_ATLAS || {};
  const LIB = () => g.VTN_VFX_LIBRARY || { families: {}, special: {}, presets: {} };
  const OBJ = () => g.VTN_VFX_OBJECTS || {};
  const imgCache = new Map();
  const tintCache = new Map();
  const headingCache = new Map();

  function image(src) {
    let i = imgCache.get(src);
    if (!i) { i = new Image(); i.src = src; imgCache.set(src, i); }
    return i;
  }
  const ready = (i) => i && i.complete && i.naturalWidth > 0;
  const hex = (c) => { c = (c || '#ffffff').replace('#', ''); if (c.length === 3) c = c.split('').map((x) => x + x).join(''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
  const rgba = (c, a) => { const [r, gg, b] = hex(c); return `rgba(${r},${gg},${b},${a})`; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = { out: (t) => 1 - (1 - t) * (1 - t), in: (t) => t * t, io: (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) };

  function sheet(name) {
    const s = ATLAS()[name];
    if (!s) return null;
    s.image = s.image || image(s.img);
    return s;
  }
  function frames(sheetName, anim) {
    const s = sheet(sheetName);
    if (!s) return null;
    return s.anims[anim] || s.anims[sheetName] || null;
  }
  function tinted(s, color) {
    if (!color) return s.image;
    const key = s.img + '|' + color;
    let c = tintCache.get(key);
    if (c && c._src === s.image) return c;
    if (!ready(s.image)) return s.image;
    c = document.createElement('canvas');
    c.width = s.image.naturalWidth; c.height = s.image.naturalHeight; c._src = s.image;
    const x = c.getContext('2d');
    x.drawImage(s.image, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = rgba(color, .38);
    x.fillRect(0, 0, c.width, c.height);
    tintCache.set(key, c);
    return c;
  }
  /* direction a projectile frame is travelling (radians), measured from pixels: head = brightest mass */
  function heading(sheetName, anim) {
    const pre = (sheet(sheetName) || {}).heading;
    if (pre && pre[anim] != null) return pre[anim];
    const key = sheetName + '|' + anim;
    if (headingCache.has(key)) return headingCache.get(key);
    const s = sheet(sheetName), fr = frames(sheetName, anim);
    if (!s || !fr || !ready(s.image)) return null;
    const f = fr[Math.min(2, fr.length - 1)];
    const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    const x = c.getContext('2d'); x.drawImage(s.image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    let d; try { d = x.getImageData(0, 0, f.w, f.h).data; } catch (e) { headingCache.set(key, null); return null; } /* file:// taints canvases */
    let n = 0, cx = 0, cy = 0; const px = [];
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) {
      const o = (j * f.h * 0 + (j * f.w + i)) * 4; if (d[o + 3] < 90) continue;
      const l = d[o] * .3 + d[o + 1] * .59 + d[o + 2] * .11; n++; cx += i; cy += j; px.push([i, j, l]);
    }
    if (!n) return null;
    cx /= n; cy /= n; px.sort((a, b) => b[2] - a[2]);
    const top = px.slice(0, Math.max(6, Math.floor(px.length * .12)));
    let hx = 0, hy = 0; top.forEach((p) => { hx += p[0]; hy += p[1]; }); hx /= top.length; hy /= top.length;
    const a = Math.atan2(hy - cy, hx - cx);
    headingCache.set(key, a);
    return a;
  }
  const angleDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

  const FIELD_KIND = [
    [/fog|mist|shroud|smoke|purple_mist|moisture/, 'fog'], [/rain|flood|tide|water/, 'rain'], [/ash|ember|burn|coal|fire|heat|brick|slag|lava/, 'embers'],
    [/frost|snow|ice|blizzard|aurora|cold/, 'snow'], [/dark|shadow|night|half_dark|void|unborn/, 'dark'], [/star|nebula|orbit|gravity|cosmic/, 'stars'],
    [/spore|pollen|dream|sap|leaf|fern|vine/, 'spore'], [/salt|brine|sand|dust|quake/, 'dust'], [/bell|echo|sonar|voice|silence|song/, 'rings'],
  ];
  const fieldKind = (id) => { id = String(id || ''); for (const [rx, k] of FIELD_KIND) if (rx.test(id)) return k; return 'fog'; };

  function create(options) {
    const opt = Object.assign({ scale: 2, speed: 1, reducedMotion: false }, options || {});
    const fx = [];                 // active effects
    const fields = new Map();      // id -> field
    let shakeAmp = 0, shakeUntil = 0, now = 0, seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const wait = (ms) => new Promise((r) => { add({ dur: ms, draw() {}, end: r }); });

    function add(e) { e.t = 0; e.dur = e.dur || 400; fx.push(e); return e; }

    function shake(amp, ms) { if (opt.reducedMotion) return; shakeAmp = Math.max(shakeAmp, amp); shakeUntil = now + (ms || 220); }

    /* ---- frame animation helper ---- */
    function anim(sheetName, name, x, y, o) {
      o = o || {};
      const fr = frames(sheetName, name), s = sheet(sheetName);
      if (!fr || !s) return Promise.resolve();
      const total = fr.reduce((a, f) => a + f.d, 0) / (o.speed || 1);
      const sc = o.scale || opt.scale;
      return new Promise((resolve) => {
        add({
          dur: o.loop ? o.loop : total, end: resolve,
          draw(ctx, t, e) {
            if (!ready(s.image)) return;
            let k = (e.t * (o.speed || 1)) % (o.loop ? total * (o.speed || 1) : 1e9), acc = 0, f = fr[fr.length - 1];
            for (const q of fr) { acc += q.d; if (k < acc) { f = q; break; } }
            const img = tinted(s, o.color);
            const px = typeof x === 'function' ? x(e) : x, py = typeof y === 'function' ? y(e) : y;
            ctx.save(); ctx.translate(Math.round(px), Math.round(py));
            if (o.rot) ctx.rotate(o.rot);
            if (o.flip) ctx.scale(-1, 1);
            ctx.globalAlpha = o.alpha == null ? 1 : o.alpha * (o.fade ? 1 - e.t / e.dur : 1);
            if (o.add) ctx.globalCompositeOperation = 'lighter';
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, f.x, f.y, f.w, f.h, -f.ax * sc, -f.ay * sc, f.w * sc, f.h * sc);
            ctx.restore();
          },
        });
      });
    }
    function object(name, x, y, o) {
      o = o || {};
      const src = OBJ()[String(name).replace(/^obj_/, '')]; if (!src) return;
      const im = image(src), sc = o.scale || 2;
      add({
        dur: o.dur || 500,
        draw(ctx, t, e) {
          if (!ready(im)) return;
          const p = typeof x === 'function' ? x(e) : x, q = typeof y === 'function' ? y(e) : y;
          const a = o.alphaFn ? o.alphaFn(e) : 1;
          ctx.save(); ctx.translate(Math.round(p), Math.round(q)); if (o.rotFn) ctx.rotate(o.rotFn(e));
          if (o.glow) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(o.glow, .35 * a); ctx.beginPath(); ctx.arc(0, 0, im.naturalWidth * sc * .7, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
          ctx.globalAlpha = a; ctx.imageSmoothingEnabled = false;
          const s2 = o.scaleFn ? o.scaleFn(e) * sc : sc;
          ctx.drawImage(im, -im.naturalWidth * s2 / 2, -im.naturalHeight * s2 / 2, im.naturalWidth * s2, im.naturalHeight * s2);
          ctx.restore();
        },
      });
    }
    function particles(x, y, n, color, o) {
      o = o || {}; const ps = [];
      for (let i = 0; i < n; i++) { const a = rnd() * 6.283, v = (o.v || .12) * (.4 + rnd()); ps.push({ x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), s: 2 + Math.floor(rnd() * 3) }); }
      add({ dur: o.dur || 500, draw(ctx, t, e) {
        ctx.save(); ctx.globalCompositeOperation = o.add === false ? 'source-over' : 'lighter';
        ps.forEach((p) => { const k = e.t; ctx.fillStyle = rgba(color, (1 - e.t / e.dur) * .9); ctx.fillRect(Math.round(x + p.vx * k + (o.gx || 0) * k * k * .0006), Math.round(y + p.vy * k + (o.g || 0) * k * k * .0006), p.s, p.s); });
        ctx.restore(); } });
    }
    function ring(x, y, color, o) {
      o = o || {};
      add({ dur: o.dur || 450, draw(ctx, t, e) {
        const k = e.t / e.dur; ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(color, (1 - k) * .85); ctx.lineWidth = o.w || 3;
        ctx.beginPath(); ctx.ellipse(x, y, (o.r || 70) * ease.out(k), (o.r || 70) * (o.squash || .45) * ease.out(k), 0, 0, 7); ctx.stroke(); ctx.restore(); } });
    }
    function flash(color, ms, a) {
      add({ dur: ms || 120, draw(ctx, t, e) { ctx.save(); ctx.globalAlpha = (a || .35) * (1 - e.t / e.dur); ctx.fillStyle = color || '#fff'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); } });
    }

    /* ---- resolve library info for a skill vfx ---- */
    function resolve(v) {
      const L = LIB(), pre = L.presets[v.preset] || { family: 'shadow' };
      const fam = L.families[pre.family] || { sheet: 'shadow-spells' };
      return { pre, fam, sheet: fam.sheet, color: v.color || pre.tint, objName: pre.object };
    }

    /* ---- impact at a point ---- */
    function impact(v, R, p) {
      const big = (v.shake || 0) >= 4;
      const s = sheet(R.sheet);
      const jobs = [];
      if (R.pre.meteor || /explosion|fireball|ember|ash/.test(v.impact || '') && R.pre.family === 'fire') {
        jobs.push(anim(big ? 'fire-explosion' : 'explosion', big ? 'fire-explosion' : 'explosion', p.x, p.y + 10, { scale: big ? 2.2 : 1.6 }));
      } else if (s && s.anims.impact) {
        jobs.push(anim(R.sheet, 'impact', p.x, p.y, { color: R.color, scale: opt.scale * (big ? 1.4 : 1) }));
      } else if (R.fam.impact) {
        const [sh, an] = String(R.fam.impact).split(':'); jobs.push(anim(sh, an || sh, p.x, p.y + 6, { scale: opt.scale, color: R.color }));
      } else jobs.push(anim('slash-hit', 'slash-hit', p.x, p.y, { color: R.color }));
      if (R.pre.ring || /bell/.test(v.preset || '')) { ring(p.x, p.y + 12, R.color || '#ccaf79', { r: 60 }); ring(p.x, p.y + 12, R.color || '#ccaf79', { r: 95, dur: 600 }); }
      particles(p.x, p.y, 10, R.color || '#fff', { v: .14, dur: 420 });
      shake(v.shake || 0, 90 + (v.shake || 0) * 25);
      return Promise.all(jobs);
    }

    /* ---- motions ---- */
    const MOTION = {
      projectile(v, R, o) {
        const to = o.targets[0], from = o.from; const dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        const dur = clamp(dist / .9, 260, 800);
        const names = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => 'projectile-' + a);
        let best = null, bd = 9;
        names.forEach((nm) => { const h = heading(R.sheet, nm); if (h != null) { const dd = angleDiff(h, ang); if (dd < bd) { bd = dd; best = nm; } } });
        const frs = best && frames(R.sheet, best);
        const objName = R.objName;
        return new Promise((resolve) => {
          const s = sheet(R.sheet);
          const lastTrail = { t: 0 };
          add({ dur, end: resolve, draw(ctx, t, e) {
            const k = ease.in(clamp(e.t / e.dur, 0, 1)) * .35 + clamp(e.t / e.dur, 0, 1) * .65;
            const arc = o.category === 'physical' && o.arc !== false ? -Math.sin(k * Math.PI) * Math.min(60, dist * .18) : 0;
            const x = from.x + dx * k, y = from.y + dy * k + arc;
            if (e.t - lastTrail.t > 35) { lastTrail.t = e.t; particles(x, y, 2, R.color || '#fff', { v: .03, dur: 260 }); }
            if (frs && s && ready(s.image)) {
              const f = frs[Math.floor(e.t / 60) % frs.length], sc = opt.scale * (o.size || 1);
              ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.imageSmoothingEnabled = false;
              ctx.drawImage(tinted(s, R.color), f.x, f.y, f.w, f.h, -f.ax * sc, -f.ay * sc, f.w * sc, f.h * sc); ctx.restore();
            } else {
              ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(R.color || '#fff', .5); ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill(); ctx.restore();
            }
            if (objName) { const im = image(OBJ()[objName.replace(/^obj_/, '')] || ''); if (ready(im)) { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(e.t * .012); ctx.imageSmoothingEnabled = false; ctx.drawImage(im, -im.naturalWidth * 1.4, -im.naturalHeight * 1.4, im.naturalWidth * 2.8, im.naturalHeight * 2.8); ctx.restore(); } }
          } });
        }).then(() => Promise.all(o.targets.map((p, i) => { o.onImpact && o.onImpact(i, p); return impact(v, R, p); })));
      },
      rain(v, R, o) {
        const n = v.count || 5, jobs = [];
        o.targets.forEach((p, ti) => {
          for (let i = 0; i < n; i++) {
            const delay = (i * 110 + ti * 60), ox = (rnd() - .5) * 90, oy = (rnd() - .5) * 40;
            jobs.push(wait(delay).then(() => new Promise((resolve) => {
              const tx = p.x + ox, ty = p.y + oy, sx = tx + 170, sy = ty - 360, dur = 380;
              if (R.pre.meteor && i === 0) { /* the meteor sheet already contains fall + impact */
                anim('meteor', 'meteor', tx - 60, ty - 8, { scale: 3 }).then(resolve); shake(v.shake || 6, 400); setTimeout(() => o.onImpact && o.onImpact(ti, p), 330); return;
              }
              if (R.pre.meteor) { resolve(); return; }
              const fr = frames(R.sheet, 'projectile-90') || frames(R.sheet, 'projectile-270'); const s = sheet(R.sheet);
              add({ dur, end: resolve, draw(ctx, t, e) {
                const k = ease.in(clamp(e.t / e.dur, 0, 1)); const x = sx + (tx - sx) * k, y = sy + (ty - sy) * k;
                if (R.objName) { const im = image(OBJ()[R.objName.replace(/^obj_/, '')] || ''); if (ready(im)) { ctx.save(); ctx.translate(x, y); ctx.rotate(k * 3); ctx.imageSmoothingEnabled = false; ctx.drawImage(im, -im.naturalWidth, -im.naturalHeight, im.naturalWidth * 2, im.naturalHeight * 2); ctx.restore(); } }
                else if (fr && s && ready(s.image)) { const f = fr[Math.floor(e.t / 60) % fr.length]; ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.imageSmoothingEnabled = false; ctx.drawImage(tinted(s, R.color), f.x, f.y, f.w, f.h, -f.ax * 2, -f.ay * 2, f.w * 2, f.h * 2); ctx.restore(); }
              } });
            }).then(() => { if (R.pre.meteor) return; o.onImpact && o.onImpact(ti, { x: p.x, y: p.y }); return impact(v, R, { x: p.x + (rnd() - .5) * 60, y: p.y + (rnd() - .5) * 24 }); })));
          }
        });
        return Promise.all(jobs);
      },
      beam(v, R, o) {
        const from = o.from; const jobs = [];
        o.targets.forEach((to, i) => {
          const isBolt = /lightning|thunder|copper|electric/.test(v.preset || '') || R.pre.family === 'lightning';
          if (isBolt) { jobs.push(anim('lightning-strike', 'lightning-strike', to.x, to.y + 30, { scale: 2.2 })); setTimeout(() => o.onImpact && o.onImpact(i, to), 120); shake(v.shake || 4, 200); return; }
          jobs.push(new Promise((resolve) => {
            const jag = []; for (let k = 0; k < 9; k++) jag.push((rnd() - .5) * 14);
            add({ dur: 420, end: resolve, draw(ctx, t, e) {
              const k = e.t / e.dur, a = k < .2 ? k / .2 : 1 - (k - .2) / .8; const dx = to.x - from.x, dy = to.y - from.y;
              ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
              [[16, .18], [9, .4], [3, .95]].forEach(([w, al]) => { ctx.strokeStyle = rgba(R.color || '#fff', al * a); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(from.x, from.y);
                for (let j = 1; j < 9; j++) ctx.lineTo(from.x + dx * j / 9 + (-dy / Math.hypot(dx, dy)) * jag[j] * (w < 5 ? 1 : .3), from.y + dy * j / 9 + (dx / Math.hypot(dx, dy)) * jag[j] * (w < 5 ? 1 : .3)); ctx.lineTo(to.x, to.y); ctx.stroke(); });
              ctx.restore(); } });
          }).then(() => { o.onImpact && o.onImpact(i, to); return impact(v, R, to); }));
        });
        return Promise.all(jobs);
      },
      slash(v, R, o) { return Promise.all(o.targets.map((p, i) => { o.onImpact && o.onImpact(i, p); const cl = R.objName === 'obj_claw';
        shake(v.shake || 2, 160);
        if (cl) return new Promise((resolve) => add({ dur: 380, end: resolve, draw(ctx, t, e) { const k = e.t / e.dur; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
          [-14, 0, 14].forEach((d, j) => { const kk = clamp(k * 1.6 - j * .15, 0, 1); ctx.strokeStyle = rgba(R.color || '#ff4a4a', (1 - k) * .95); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x - 30 + d, p.y - 38); ctx.lineTo(p.x - 30 + d + 56 * kk, p.y - 38 + 70 * kk); ctx.stroke(); }); ctx.restore(); } }));
        return anim('slash-hit', 'slash-hit', p.x, p.y, { scale: opt.scale * 1.2, color: R.color }); })); },
      bite(v, R, o) { return MOTION.slash(v, R, o); },
      strike(v, R, o) { return Promise.all(o.targets.map((p, i) => { o.onImpact && o.onImpact(i, p); return impact(v, R, p); })); },
      burst(v, R, o) { return Promise.all(o.targets.map((p, i) => { o.onImpact && o.onImpact(i, p); ring(p.x, p.y + 14, R.color || '#fff', { r: 80 }); return impact(v, R, p); })); },
      aura(v, R, o) {
        return Promise.all(o.targets.map((p, i) => { o.onImpact && o.onImpact(i, p);
          const heal = o.category === 'heal' || /heal|holy/.test(v.preset || '');
          if (heal) anim('healing-circle', 'healing-circle', p.x, p.y + 20, { scale: 1.6, color: R.color });
          particles(p.x, p.y + 10, 14, R.color || '#9fe', { v: .05, up: .08, dur: 800 });
          const s = sheet(R.sheet); if (s && s.anims.buff) return anim(R.sheet, 'buff', p.x, p.y + 6, { color: R.color, scale: opt.scale });
          return anim('shield', 'shield', p.x, p.y, { scale: 1.5, color: R.color }); })); },
      field(v, R, o) {
        const id = v.field || v.preset; setField(id, v, R);
        o.onImpact && o.onImpact(0, o.targets[0] || o.from);
        const c = o.from; ring(c.x, c.y + 14, R.color || '#fff', { r: 140, dur: 700 });
        return anim('magic-swirl', 'magic-swirl', c.x, c.y - 20, { scale: 2, color: R.color });
      },
      sweep(v, R, o) {
        const W = o.stage.w, H = o.stage.h, dir = (o.from.x < (o.targets[0] || o.from).x) ? 1 : -1;
        (v.clears || []).forEach((id) => clearField(id, dir)); if (!v.clears || !v.clears.length) fields.forEach((f, id) => { if (/fog|smoke/.test(f.kind)) clearField(id, dir); });
        o.onImpact && o.targets.forEach((p, i) => o.onImpact(i, p));
        return new Promise((resolve) => { const lines = []; for (let i = 0; i < 18; i++) lines.push({ y: H * (.18 + rnd() * .62), l: 90 + rnd() * 140, d: rnd() * .4 });
          add({ dur: 780, end: resolve, draw(ctx, t, e) { const k = e.t / e.dur; ctx.save(); ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
            lines.forEach((q) => { const kk = clamp((k - q.d) / .6, 0, 1); if (kk <= 0) return; const x = dir > 0 ? -q.l + (W + q.l * 2) * kk : W + q.l - (W + q.l * 2) * kk;
              ctx.strokeStyle = rgba(R.color || '#cfe', .55 * (1 - Math.abs(kk - .5) * 1.6)); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, q.y); ctx.quadraticCurveTo(x - dir * q.l * .5, q.y - 14, x - dir * q.l, q.y + 4); ctx.stroke(); });
            ctx.restore(); } }); });
      },
      summon(v, R, o) {
        return Promise.all(o.targets.map((p, i) => { o.onImpact && o.onImpact(i, p);
          if (R.objName) object(R.objName, p.x, p.y - 8, { scale: 3, dur: 900, glow: R.color || '#fff', alphaFn: (e) => Math.min(1, e.t / 150) * (e.t > e.dur * .72 ? 1 - (e.t - e.dur * .72) / (e.dur * .28) : 1), scaleFn: (e) => .5 + ease.out(Math.min(1, e.t / 260)) * .5 });
          ring(p.x, p.y + 16, R.color || '#fff', { r: 55, dur: 700 });
          const s = sheet(R.sheet); if (s && s.anims.area) return anim(R.sheet, 'area', p.x, p.y + 16, { color: R.color, scale: opt.scale });
          return wait(800); })); },
    };
    MOTION.buff = MOTION.aura;

    /* ---- fields (persistent stage layers) ---- */
    function setField(id, v, R) {
      const kind = fieldKind((v && (v.field || v.preset)) || id), W = 960, H = 400, ps = [];
      for (let i = 0; i < (kind === 'fog' ? 22 : 70); i++) ps.push({ x: rnd() * W, y: kind === 'fog' ? H * (.3 + rnd() * .6) : rnd() * H, r: 40 + rnd() * 80, s: .02 + rnd() * .05, p: rnd() * 6 });
      fields.set(id, { kind, color: (v && v.color) || '#ccd', t: 0, ps, fade: 0, dir: 0, life: ((v && v.turns) || 3) });
    }
    function clearField(id, dir) { const f = fields.get(id); if (f) { f.dir = dir || 1; f.clearing = 700; } }

    function drawFields(ctx, W, H) {
      fields.forEach((f, id) => {
        const a = f.clearing != null ? clamp(f.clearing / 700, 0, 1) : clamp(f.t / 500, 0, 1);
        ctx.save(); ctx.globalAlpha = a * .55;
        const drift = f.clearing != null ? f.dir * (700 - f.clearing) * .55 : 0;
        if (f.kind === 'fog') { f.ps.forEach((p) => { const x = ((p.x + f.t * p.s * .1 + drift) % (W + 200)) - 100; const gr = ctx.createRadialGradient(x, p.y, 0, x, p.y, p.r * 1.6); gr.addColorStop(0, rgba(f.color, .28)); gr.addColorStop(1, rgba(f.color, 0)); ctx.fillStyle = gr; ctx.fillRect(x - p.r * 2, p.y - p.r * 2, p.r * 4, p.r * 4); }); }
        else if (f.kind === 'dark') { const gr = ctx.createRadialGradient(W / 2, H / 2, H * .2, W / 2, H / 2, H * .9); gr.addColorStop(0, 'rgba(8,4,24,0)'); gr.addColorStop(1, 'rgba(8,4,24,.7)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
        else if (f.kind === 'rings') { for (let i = 0; i < 3; i++) { const k = ((f.t / 1400) + i / 3) % 1; ctx.strokeStyle = rgba('#ccaf79', (1 - k) * .4); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(W / 2 + drift, H * .72, W * .5 * k, H * .12 * k, 0, 0, 7); ctx.stroke(); } }
        else f.ps.forEach((p) => {
          let x = p.x, y = p.y; const t = f.t;
          if (f.kind === 'rain') { x = (p.x - t * .06 + drift) % W; y = (p.y + t * .5 * (1 + p.s * 6)) % H; ctx.strokeStyle = rgba('#9cc7e8', .55); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); ctx.stroke(); }
          else if (f.kind === 'snow') { x = (p.x + Math.sin(t * .001 + p.p) * 20 + drift) % W; y = (p.y + t * .05 * (1 + p.s * 10)) % H; ctx.fillStyle = 'rgba(235,245,255,.85)'; ctx.fillRect(Math.round(x), Math.round(y), 3, 3); }
          else if (f.kind === 'embers') { x = (p.x + Math.sin(t * .002 + p.p) * 14 + drift) % W; y = H - ((t * .04 * (1 + p.s * 12) + p.y) % H); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#ff8a30', .8); ctx.fillRect(Math.round(x), Math.round(y), 3, 3); ctx.globalCompositeOperation = 'source-over'; }
          else if (f.kind === 'spore') { x = (p.x + Math.sin(t * .0015 + p.p) * 30 + drift) % W; y = H * .35 + ((p.y * .6 + t * .02) % (H * .6)); ctx.fillStyle = rgba('#a4e87a', .6); ctx.fillRect(Math.round(x), Math.round(y), 3, 3); }
          else if (f.kind === 'stars') { const tw = .5 + .5 * Math.sin(t * .004 + p.p * 3); ctx.fillStyle = rgba('#e8e0ff', tw); ctx.fillRect(Math.round(p.x), Math.round(p.y * .9), 2 + (p.p > 4.5 ? 1 : 0), 2 + (p.p > 4.5 ? 1 : 0)); }
          else { x = (p.x + t * .03 + drift) % W; y = H * .5 + ((p.y * .5 + Math.sin(t * .002 + p.p) * 10) % (H * .5)); ctx.fillStyle = rgba('#d9c9a0', .5); ctx.fillRect(Math.round(x), Math.round(y), 2, 2); }
        });
        ctx.restore();
      });
    }

    /* ---- public ---- */
    function update(dt) {
      now += dt;
      dt *= opt.speed;
      for (let i = fx.length - 1; i >= 0; i--) { const e = fx[i]; e.t += dt; if (e.t >= e.dur) { fx.splice(i, 1); e.end && e.end(); } }
      fields.forEach((f, id) => { f.t += dt; if (f.clearing != null) { f.clearing -= dt; if (f.clearing <= 0) fields.delete(id); } });
    }
    function draw(ctx) { for (let i = 0; i < fx.length; i++) { const e = fx[i]; ctx.save(); e.draw(ctx, e.t / e.dur, e); ctx.restore(); } }
    function getShake() {
      if (now >= shakeUntil || !shakeAmp) { shakeAmp = 0; return { x: 0, y: 0 }; }
      const k = (shakeUntil - now) / 260, a = Math.min(shakeAmp, 8) * Math.min(1, k);
      return { x: Math.round((rnd() - .5) * 2 * a), y: Math.round((rnd() - .5) * 2 * a * .6) };
    }
    function play(v, o) {
      o = o || {}; v = v || { motion: 'strike', preset: 'shadow', shake: 1 };
      o.targets = (o.targets && o.targets.length ? o.targets : [o.from || { x: 480, y: 300 }]);
      o.from = o.from || o.targets[0];
      o.stage = o.stage || { w: 960, h: 400 };
      const R = resolve(v);
      if (R.pre.smoke || (v.field && v.motion !== 'field')) { /* skills that also leave a lingering field */ setField(v.field || v.preset, v, R); }
      const m = MOTION[v.motion] || MOTION.strike;
      const p = m(v, R, o);
      if (opt.reducedMotion) return p;
      if (o.flash !== false && (v.shake || 0) >= 3) flash(rgba(R.color || '#fff', 1), 110, .22);
      return p;
    }
    return { play, update, draw, drawFields, getShake, setField, clearField, hasFields: () => fields.size, activeCount: () => fx.length, fieldIds: () => [...fields.keys()],
      clear() { fx.length = 0; fields.clear(); }, setSpeed(s) { opt.speed = s; }, get speed() { return opt.speed; } };
  }
  g.VTNVfx = { create, fieldKind };
})(window);
