(function(){
// Hand-made sprite sheets override the procedural concepts form by form.
// A form without an entry in VTN_SPRITE_MANIFEST keeps the old drawing, so the
// art can be replaced gradually without breaking any screen.
const manifest = window.VTN_SPRITE_MANIFEST || {};
const images = {};
const procedural = window.VTNArt.draw;
let tick = 0;

function variantKey(baseKey, uid){
  const candidates = [baseKey, `${baseKey}_v2`, `${baseKey}_v3`]
    .filter(key => Object.prototype.hasOwnProperty.call(manifest, key));
  if (candidates.length <= 1) return candidates[0] || baseKey;
  let hash = 2166136261;
  for (const char of String(uid ?? '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return candidates[(hash >>> 0) % candidates.length];
}

const lookNames = ['primary', 'v2', 'v3'];
function lookKey(baseKey, look){ return look === 'primary' ? baseKey : `${baseKey}_${look}`; }
function availableLooks(baseKey){ return lookNames.filter(look => Object.prototype.hasOwnProperty.call(manifest, lookKey(baseKey, look))); }

function formKey(m){
  if (m.formId) return m.formId;
  const stage = m.stage || 0;
  return `${m.id}_${stage}${stage >= 2 && m.branch ? '_' + m.branch : ''}`;
}

function lookOf(m){
  const key = formKey(m);
  if (!/_0$/.test(key)) return null;
  const available = availableLooks(key);
  if (typeof m.look === 'string' && available.includes(m.look)) return m.look;
  if (m.uid == null || m.uid === '') return 'primary';
  const hashed = variantKey(key, m.uid);
  return available.find(look => lookKey(key, look) === hashed) || 'primary';
}

function spriteKey(m){
  const key = formKey(m);
  if (!/_0$/.test(key)) return key;
  if (typeof m.look === 'string' && availableLooks(key).includes(m.look)) return lookKey(key, m.look);
  return m.uid != null && m.uid !== '' ? variantKey(key, m.uid) : key;
}

function fitCanvas(canvas, entry){
  // canvases are created square (144 / 240 px) for the old concepts; give
  // sprite forms an exact integer-scaled 3:2 surface instead
  if (!canvas.dataset.base) canvas.dataset.base = canvas.width;
  const base = Number(canvas.dataset.base);
  // Large bosses keep their native frame dimensions. Pick the largest whole
  // scale that fits the original concept surface, with 1x as the floor when
  // the frame itself is wider than that surface.
  const k = entry.w > 96
    ? Math.max(1, Math.floor(Math.min(base / entry.w, base / entry.h)))
    : (base >= 220 ? 3 : 2);
  const w = entry.w * k, h = (entry.h + 2) * k;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    canvas.style.width = w + 'px'; canvas.style.height = 'auto'; canvas.style.maxWidth = '100%';
  }
}

function drawSprite(canvas, m, entry, img){
  fitCanvas(canvas, entry);
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.imageSmoothingEnabled = false;
  const k = Math.max(1, Math.floor(Math.min(canvas.width / entry.w, canvas.height / entry.h)));
  const w = entry.w * k, h = entry.h * k;
  const dx = Math.round((canvas.width - w) / 2);
  const dy = canvas.height - h - k;
  const [ax, ay] = entry.anchor || [entry.w / 2, entry.h - 1];
  // soft contact shadow under the feet
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.beginPath();
  c.ellipse(dx + ax * k, dy + (ay + 1) * k, entry.w * k * 0.32, Math.max(2, k * 2), 0, 0, Math.PI * 2);
  c.fill();
  const frame = tick % (entry.frames || 1);
  if (m.variant) c.filter = 'hue-rotate(150deg) saturate(1.35) brightness(1.05)';
  c.drawImage(img, frame * entry.w, 0, entry.w, entry.h, dx, dy, w, h);
  c.filter = 'none';
}

function draw(canvas, m, scale){
  if (!canvas || !m) return;
  const key = spriteKey(m);
  const entry = manifest[key], img = entry ? ensureImage(key) : null;
  if (!entry || !img || !img.complete || !img.naturalWidth) {
    delete canvas.dataset.vtnSprite;
    return procedural(canvas, m, scale);
  }
  canvas.dataset.vtnSprite = key;
  canvas._vtnMonster = m;
  drawSprite(canvas, m, entry, img);
}

function redrawAll(){
  for (const canvas of document.querySelectorAll('canvas[data-species]')) {
    if (canvas._vtnMonster) draw(canvas, canvas._vtnMonster);
  }
}

/* Images are loaded on demand (never 1000+ at once) and retried when a request fails, so no monster is stuck on the procedural fallback. */
let redrawQueued = false;
function scheduleRedraw(){ if (redrawQueued) return; redrawQueued = true; requestAnimationFrame(() => { redrawQueued = false; redrawAll(); }); }
function ensureImage(key){
  let img = images[key];
  if (img) return img;
  const entry = manifest[key];
  if (!entry) return null;
  img = new Image(); img._tries = 0;
  img.onload = scheduleRedraw;
  img.onerror = () => { if (img._tries++ < 5) setTimeout(() => { img.src = entry.file + (entry.file.includes('?') ? '&' : '?') + 'retry=' + img._tries; }, 250 * img._tries); };
  img.src = entry.file;
  images[key] = img;
  return img;
}
window.VTNSpriteLoader = { ensure: ensureImage };

// Remember every monster passed to draw so late-loading sheets can replace the fallback.
const wrapped = (canvas, m, scale) => { if (canvas && m) canvas._vtnMonster = m; return draw(canvas, m, scale); };

setInterval(() => {
  tick++;
  for (const canvas of document.querySelectorAll('canvas[data-vtn-sprite]')) {
    if (canvas.isConnected && canvas._vtnMonster) draw(canvas, canvas._vtnMonster);
  }
}, 200);

window.VTNArt.draw = wrapped;
window.VTNArt.variantKey = variantKey;
window.VTNArt.lookKey = lookKey;
window.VTNArt.availableLooks = availableLooks;
window.VTNArt.lookOf = lookOf;
window.VTNArt.spriteKey = spriteKey;
window.VTNArt.hasSprite = (m) => !!manifest[spriteKey(m)];
})();
