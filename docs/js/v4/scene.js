(function(){
// Tileset-based world renderer. Region 01 is eager; other region scripts are
// injected on first entry so this remains usable from file:// as well as HTTP.
const T = 32;
const loaded = {};
const scriptStates = {};
let lastWorldDebug = { regionId: null, scriptState: null, tilesetLoaded: false, assetsReady: false, tallAvailable: 0, propAvailable: 0, tallSprites: 0, fallbackTrees: 0, smallProps: 0, alphaAnchors: 0, tallPlaced: 0, tallCap: 0, tallRestricted: 0 };

const tilesets = () => window.VTN_TILESETS || {};
const propSets = () => window.VTN_PROPS || {};
for (const regionId of Object.keys(tilesets())) scriptStates[regionId] = 'loaded';

function tilesetKey(map,regionId){return map?.tileSetId||(map?.layout==='abyss_cave'?'abyss':regionId);}
function requestTileset(regionId,map=null){
  const key=tilesetKey(map,regionId);
  if (tilesets()[key]) { scriptStates[key] = 'loaded'; return true; }
  if (scriptStates[key]) return false;
  if (!/^(region_\d{2}|abyss)$/.test(key || '') || typeof document === 'undefined') {
    scriptStates[key] = 'error';
    return false;
  }
  scriptStates[key] = 'loading';
  const script = document.createElement('script');
  script.src = `assets/tiles/${key}/tiles.js`;
  script.async = false;
  script.dataset.vtnTileset = key;
  script.onload = () => { scriptStates[key] = tilesets()[key] ? 'loaded' : 'error'; };
  script.onerror = () => { scriptStates[key] = 'error'; };
  (document.head || document.documentElement).appendChild(script);
  return false;
}

const image = src => { const i = new Image(); i.src = src; return i; };
const imageReady = i => !!(i && i.complete && i.naturalWidth);
const optionalCache = new Map();
function optional(src){
  if(!src)return {status:'missing',image:null};
  let entry=optionalCache.get(src);if(entry)return entry;
  const i=new Image();entry={status:'loading',image:i};i.onload=()=>{entry.status='ready';};i.onerror=()=>{entry.status='missing';};i.src=src;optionalCache.set(src,entry);return entry;
}
function load(regionId,map=null){
  const requested=tilesetKey(map,regionId),key=tilesets()[requested]?requested:regionId,cacheKey=`${map?.id||regionId}|${key}`;
  if (loaded[cacheKey]) return loaded[cacheKey];
  const meta = tilesets()[key];
  if (!meta) return null;
  const props = propSets()[key] || {};
  loaded[cacheKey] = {
    meta,
    ground: image(meta.base + 'ground.png'),
    tiles: image(meta.base + 'tiles.png'),
    trees: image(meta.base + 'trees.png'),
    wild: image(meta.base + 'wild.png'),
    wisp: image(meta.base + 'wisp.png'),
    tall: (props.tall || []).map(src => ({ src, image: image(src), anchor: null, bounds: null })),
    prop: (props.prop || []).map(src => ({ src, image: image(src) })),
    propsPrepared: false,
    tallLayouts: new Map(),
  };
  return loaded[cacheKey];
}
const ready = (r) => ['ground', 'tiles', 'trees', 'wild', 'wisp'].every(k => r[k].complete && r[k].naturalWidth);
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const stringSeed = value => { let h = 2166136261; for (const c of String(value || '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// Generated tall sprites are transparent canvases. Their real foot is the
// bottom-centre of the non-transparent alpha bounds, not necessarily the
// canvas centre or last row.
function alphaAnchor(item){
  if (item.anchor) return item.anchor;
  const src = item.image;
  if (!imageReady(src)) return null;
  try {
    const c = document.createElement('canvas'); c.width = src.naturalWidth; c.height = src.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, 0, 0);
    const pixels = g.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (pixels[(y * c.width + x) * 4 + 3] <= 8) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    if (maxX < 0) return (item.anchor = [c.width / 2, c.height - 1]);
    item.bounds = [minX, minY, maxX, maxY];
    item.anchor = [(minX + maxX) / 2, maxY];
  } catch {
    // A failed read (for example a browser's unusual file-origin policy) is
    // still safe: the generated sprites are designed around this fallback.
    item.anchor = [src.naturalWidth / 2, src.naturalHeight - 1];
  }
  return item.anchor;
}

function prepareProps(r){
  if (r.propsPrepared) return;
  for (const item of r.tall) alphaAnchor(item);
  r.propsPrepared = r.tall.every(item => !!item.anchor);
}

function tallName(item){ return String(item?.src || '').split('/').pop().replace(/\.png$/i, ''); }
function boxesOverlap(a, b){ return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
function tallLayout(r, info, availableTall){
  const regionId = info.map.regionId, mapId = info.map.id || regionId, cached = r.tallLayouts.get(mapId);
  if (cached) return cached;
  const a = info.grid, H = a.length, W = a[0].length, mapSeed = stringSeed(mapId);
  let walkable = 0;
  for (const row of a) for (const tile of row) if (tile !== 1 && tile !== 3) walkable++;
  const cap = Math.max(1, Math.floor(walkable / 40)), candidates = [];
  const restricted = item => regionId === 'region_04' && (tallName(item) === 'tall_skull' || tallName(item) === 'tall_bone');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (a[y][x] !== 1 || hash(x, y, mapSeed + 6) > 0.62) continue;
    const item = availableTall[Math.floor(hash(x, y, mapSeed + 2) * availableTall.length)], bounds = item.bounds || [0, 0, item.image.naturalWidth - 1, item.image.naturalHeight - 1], anchor = item.anchor || [item.image.naturalWidth / 2, item.image.naturalHeight - 1], jx = Math.round((hash(x, y, 11) - 0.5) * 10), dx = Math.round(x * T + T / 2 - anchor[0] + jx), dy = Math.round(y * T + T - anchor[1] - 2);
    candidates.push({ item, tx: x, ty: y, dx, dy, ySort: y * T + T - 1, box: { left: dx + bounds[0], top: dy + bounds[1], right: dx + bounds[2] + 1, bottom: dy + bounds[3] + 1 }, priority: hash(x, y, mapSeed + 17), restricted: restricted(item) });
  }
  const spawn = info.map.spawn || { x: info.px ?? 8, y: info.py ?? 10 }, focusX = Number(info.px ?? spawn.x ?? 8), focusY = Number(info.py ?? spawn.y ?? 10), distanceToSpawn = candidate => Math.max(Math.abs(candidate.tx - focusX), Math.abs(candidate.ty - focusY)), nearFocus = candidate => candidate.tx >= focusX - 12 && candidate.tx <= focusX + 12 && candidate.ty >= focusY - 7 && candidate.ty <= focusY + 10;
  candidates.sort((a, b) => a.priority - b.priority);
  const placements = [], selectedRestricted = { count: 0 };
  const nearestPool = candidates.filter(nearFocus), nearest = (nearestPool.length ? nearestPool : candidates).slice().sort((a, b) => distanceToSpawn(a) - distanceToSpawn(b) || a.priority - b.priority)[0];
  if (nearest) { placements.push(nearest); if (nearest.restricted) selectedRestricted.count++; }
  for (const candidate of candidates) {
    if (candidate === nearest) continue;
    if (placements.length >= cap || candidate.restricted && selectedRestricted.count >= 2) continue;
    if (placements.some(other => Math.max(Math.abs(candidate.tx - other.tx), Math.abs(candidate.ty - other.ty)) < 3 || boxesOverlap(candidate.box, other.box))) continue;
    placements.push(candidate); if (candidate.restricted) selectedRestricted.count++;
  }
  const result = { placements, walkable, cap, restricted: selectedRestricted.count };
  r.tallLayouts.set(mapId, result);
  return result;
}

function loadingScreen(ctx, canvas, regionId){
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0a0f0d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#d8c38a'; ctx.font = "16px 'VTN Body',serif"; ctx.textAlign = 'center';
  ctx.fillText(`Đang gọi bản đồ · ${regionId}`, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

// ---------------------------------------------------------------- fog ----
let fogCanvas = null;
function fog(){
  if (fogCanvas) return fogCanvas;
  const w = 128, h = 64, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  const cell = (x, y) => hash(((x % 16) + 16) % 16, ((y % 8) + 8) % 8, 9);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / 8, fy = y / 8, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const s = (t) => t * t * (3 - 2 * t);
    const v = (cell(x0, y0) * (1 - s(tx)) + cell(x0 + 1, y0) * s(tx)) * (1 - s(ty)) + (cell(x0, y0 + 1) * (1 - s(tx)) + cell(x0 + 1, y0 + 1) * s(tx)) * s(ty);
    const i = (y * w + x) * 4;
    img.data[i] = 170; img.data[i + 1] = 182; img.data[i + 2] = 168; img.data[i + 3] = Math.max(0, (v - 0.35) * 2.2) * 255;
  }
  g.putImageData(img, 0, 0);
  return (fogCanvas = c);
}

// -------------------------------------------------------------- lights ----
let lightCanvas = null;
function lights(canvas){
  if (!lightCanvas || lightCanvas.width !== canvas.width || lightCanvas.height !== canvas.height) {
    lightCanvas = document.createElement('canvas'); lightCanvas.width = canvas.width; lightCanvas.height = canvas.height;
  }
  return lightCanvas;
}

// --------------------------------------------------------------- ash ------
// ------------------------------------------------------------ people -----
const racePeople = window.VTN_RACE_PEOPLE || null, racePeopleWalkImg = {};
if (racePeople?.races) for (const [raceId, looks] of Object.entries(racePeople.races)) for (const look of looks || []) {
  if (!look?.key || !look.walk) continue;
  const i = new Image(); i.src = look.walk; racePeopleWalkImg[`${raceId}:${look.key}`] = i;
}
const cast = window.VTN_CAST || null, castWalk = {w:54,h:62,dirs:['down','left','right','up'],frames:3}, castWalkImg = {};
if (cast) for (const [key, spec] of Object.entries(cast)) {
  if (!spec?.walk) continue;
  const i = new Image(); i.src = spec.walk; castWalkImg[key] = i;
}
const classSprites = window.VTN_CLASS_SPRITES || null, classWalkImg = {};
if (classSprites?.classes) for (const [k, spec] of Object.entries(classSprites.classes)) {
  if (!spec?.walk) continue;
  const i = new Image(); i.src = spec.walk; classWalkImg[k] = i;
}
const raceSprites = window.VTN_RACE_SPRITES || null, raceWalkImg = {}, raceBattleAltImg = {};
if (raceSprites?.races) for (const [k, spec] of Object.entries(raceSprites.races)) {
  if (spec?.walk) { const i = new Image(); i.src = spec.walk; raceWalkImg[k] = i; }
  if (spec?.battleAlt) { const i = new Image(); i.src = spec.battleAlt; raceBattleAltImg[k] = i; }
}
const NPC_LOOKS = ['elder', 'pilgrim', 'warden', 'healer'];
const raceFrontImg = {};
if (racePeople?.races) for (const [raceId, looks] of Object.entries(racePeople.races)) for (const look of looks || []) {
  if (!look?.key || !look.front) continue;
  const i = new Image(); i.src = look.front; raceFrontImg[`${raceId}:${look.key}`] = i;
}
// World sprites are rendered at the same nearest-neighbour scale.  The map
// canvas still uses integer zoom, while this actor scale removes the old
// oversized hero/NPC presentation without introducing interpolation blur.
const ACTOR_SCALE = 0.85;
const scaled = value => Math.max(1,Math.round(value*ACTOR_SCALE));
const facingRow = dir => { const value=String(dir||'down'); if(value.includes('right'))return 'right'; if(value.includes('left'))return 'left'; if(value.includes('up'))return 'up'; return 'down'; };
let heroState = { x: null, y: null, dir: 'down', movedAt: 0 };
let lastHeroSprite = null;
let lastNpcSprites = [];
function classPerson(ctx, state, dir, frame, dx, dy){
  if (state?.hero?.corruption >= 60) return false;
  const id = state?.hero?.classId, spec = classSprites?.classes?.[id], sheet = classSprites?.walk, image = classWalkImg[id];
  if (!spec?.walk || !sheet?.w || !sheet?.h || !sheet?.frames || !image || !image.complete || !image.naturalWidth) return false;
  const row = Math.max(0, sheet.dirs.indexOf(facingRow(dir))), fr = Math.max(0, Math.min(sheet.frames - 1, frame));
  const targetW=scaled(sheet.w),targetH=scaled(sheet.h),footX = dx + T / 2, footY = dy + T, drawX = Math.round(footX - targetW / 2), drawY = Math.round(footY - targetH);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath(); ctx.ellipse(footX, footY - 2, 8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(image, fr * sheet.w, row * sheet.h, sheet.w, sheet.h, drawX, drawY, targetW, targetH);
  lastHeroSprite = { kind: 'class-walk', classId: id, path: spec.walk, source: image.src, dir:facingRow(dir), frame: fr, sourceW: sheet.w, sourceH: sheet.h, w: targetW, h: targetH, scale:ACTOR_SCALE, left: drawX, top: drawY, right: drawX + targetW, bottom: drawY + targetH, feetX:footX, feetY:footY };
  return true;
}
function racePerson(ctx, point, frame, dx, dy, state){
  const raceId = point?.npc?.raceId, appearance = point?.npcAppearance, peopleLook = appearance?.people, castKey = appearance?.castKey, castLook = castKey && cast?.[castKey], peopleWalk = castLook ? castWalk : racePeople?.walk, peopleImage = peopleLook && (castLook ? castWalkImg[castKey] : racePeopleWalkImg[`${raceId}:${peopleLook.key}`]);
  if (peopleLook && !appearance.useRaceSheet && peopleWalk?.w && peopleWalk?.h && peopleWalk?.frames && peopleImage?.complete && peopleImage.naturalWidth) {
    const dirs = peopleWalk.dirs || ['down', 'left', 'right', 'up'], row = Math.max(0, dirs.indexOf(facingRow(point?.dir || 'down'))), sourceFrame = Math.max(0, Math.min(peopleWalk.frames - 1, frame));
    const targetW = scaled(peopleWalk.w), targetH = scaled(peopleWalk.h), footX = dx + T / 2, footY = dy + T, drawX = Math.round(footX - targetW / 2), drawY = Math.round(footY - targetH);
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(footX, footY - 2, 8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(peopleImage, sourceFrame * peopleWalk.w, row * peopleWalk.h, peopleWalk.w, peopleWalk.h, drawX, drawY, targetW, targetH);
    lastNpcSprites.push({ kind: castLook ? 'cast-walk' : 'race-people-walk', form: 'human', npcId: point.npc?.id || null, raceId, castKey: castKey || null, lookKey: peopleLook.key, path: peopleLook.walk, source: peopleImage.src, dir: facingRow(point?.dir || 'down'), row, frame: sourceFrame, sourceW: peopleWalk.w, sourceH: peopleWalk.h, w: targetW, h: targetH, scale:ACTOR_SCALE, left: drawX, top: drawY, right: drawX + targetW, bottom: drawY + targetH, feetX: footX, feetY: footY });
    return true;
  }
  const spec = raceSprites?.races?.[raceId], walkSheet = raceSprites?.walk, wolf = raceId === 'R-19' && state?.moon === 4 && !!spec?.battleAlt;
  const sheet = wolf ? raceSprites?.battle : walkSheet, image = wolf ? raceBattleAltImg[raceId] : raceWalkImg[raceId];
  if (!spec?.walk || !walkSheet?.w || !walkSheet?.h || !walkSheet?.frames || !sheet?.w || !sheet?.h || !image || !image.complete || !image.naturalWidth) return false;
  const dir = facingRow(point?.dir || 'down'), row = wolf ? 0 : Math.max(0, (walkSheet.dirs || ['down', 'left', 'right', 'up']).indexOf(dir)), sourceFrame = wolf ? 0 : Math.max(0, Math.min(1, frame, walkSheet.frames - 1));
  const targetW = scaled(walkSheet.w), targetH = scaled(walkSheet.h), footX = dx + T / 2, footY = dy + T, drawX = Math.round(footX - targetW / 2), drawY = Math.round(footY - targetH);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath(); ctx.ellipse(footX, footY - 2, 8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(image, sourceFrame * sheet.w, row * sheet.h, sheet.w, sheet.h, drawX, drawY, targetW, targetH);
  lastNpcSprites.push({ kind: wolf ? 'race-battle' : 'race-walk', form: wolf ? 'wolf' : 'human', npcId: point.npc?.id || null, raceId, path: wolf ? spec.battleAlt : spec.walk, source: image.src, dir, row, frame: sourceFrame, sourceW: sheet.w, sourceH: sheet.h, w: targetW, h: targetH, scale:ACTOR_SCALE, left: drawX, top: drawY, right: drawX + targetW, bottom: drawY + targetH, feetX: footX, feetY: footY });
  return true;
}
 function raceFrontPerson(ctx, state, dx, dy, raceId=state?.hero?.raceId){
   const list=racePeople?.races?.[raceId]||[],look=list.find(v=>v.key===state?.hero?.storyLook)||list[0],img=look&&raceFrontImg[`${raceId}:${look.key}`];
   if(!look?.front||!img?.complete||!img.naturalWidth)return false;
   const w=scaled(racePeople?.front?.w||80),h=scaled(racePeople?.front?.h||92),footX=dx+T/2,footY=dy+T,drawX=Math.round(footX-w/2),drawY=Math.round(footY-h);
   ctx.fillStyle='rgba(0,0,0,0.38)';ctx.beginPath();ctx.ellipse(footX,footY-2,8,2.5,0,0,Math.PI*2);ctx.fill();ctx.drawImage(img,0,0,img.naturalWidth,img.naturalHeight,drawX,drawY,w,h);lastHeroSprite={kind:'race-people-front',raceId,look:look.key,path:look.front,source:img.src,w,h,left:drawX,top:drawY,right:drawX+w,bottom:drawY+h,feetX:footX,feetY:footY};return true;
 }
function drawNpc(ctx, point, dx, dy, state, now = performance.now() / 1000){
  const bob = dy + Math.round(Math.sin(now * 2 + (point.x || 0)) * 0.6), frame = point.walkFrame ?? (point.moving ? 1 + (Math.floor((point.walkDistance || 0) * 3) % 2) : 0);
  if (point.type === 'npc' && racePerson(ctx, point, frame, dx, bob, state)) return true;
   if (raceFrontPerson(ctx, state, dx, bob, point.npc?.raceId)) {
     lastNpcSprites.push({ kind:'race-people-front-fallback',npcId:point.npc?.id||null,raceId:point.npc?.raceId||null });
     return true;
   }
   return false;
}

const flakes = Array.from({ length: 70 }, (_, i) => ({ x: hash(i, 1) , y: hash(i, 2), s: 0.4 + hash(i, 3) * 0.8, e: hash(i, 4) < 0.08 }));

function drawBuilding(ctx,p){
  const lot=p?.lot;if(!lot)return false;const x=Number(lot.x)*T,y=Number(lot.y)*T,w=Math.max(2,Number(lot.w)||6)*T,h=Math.max(2,Number(lot.h)||5)*T,asset=optional(`assets/tiles/${p.regionId||''}/buildings/${lot.name}.png`),gate=p.type==='boss-gate';
  if(asset.status==='ready'){ctx.drawImage(asset.image,x,y,w,h);return true;}
  ctx.save();ctx.fillStyle=gate?'#4b2730':'#3b3430';ctx.fillRect(x+T/2,y+T,w-T,h-T);ctx.fillStyle=gate?'#9b4d4d':'#71513d';ctx.beginPath();ctx.moveTo(x,y+T);ctx.lineTo(x+w/2,y);ctx.lineTo(x+w,y+T);ctx.closePath();ctx.fill();ctx.fillStyle=gate?'#d79b62':'#29211e';const door=Array.isArray(lot.door)?lot.door:[lot.x+Math.floor((lot.w||6)/2),lot.y+(lot.h||5)-1];ctx.fillRect(Number(door[0])*T+T*.25,Number(door[1])*T,T*.5,T);if(gate){ctx.strokeStyle='rgba(238,196,116,.85)';ctx.lineWidth=2;ctx.strokeRect(x+T/2,y+T,w-T,h-T);}ctx.restore();return false;
}

 function renderLair(ctx,canvas,info){
  const map=info.map,layout=window.VTN_MAP_LAYOUTS||{},geometry=layout.lairGeometry?.(map)||{width:36,height:17,asset:{rid:map.lairId||'r01',image:'assets/lairs/built/'+(map.lairId||'r01')+'.png',emptyImage:'assets/lairs/built/'+(map.lairId||'r01')+'_empty.png'}},asset=geometry.asset||{},rid=geometry.rid||map.lairId||String(map.regionId||'region_01').slice(-2),regionState=info.S?.regionStates?.[map.regionId],choiceId=info.S?.choices?.[map.regionId],overlord=map.overlordId&&window.VTNRules?.overlordById?.(map.overlordId),choice=overlord?.options?.find(option=>option.id===choiceId),restored=regionState==='restored'||choice?.regionConsequenceKey==='restored'||!!info.S?.overlordAllies?.includes?.(map.overlordId),resolved=!!regionState||!!choiceId||!!info.S?.flags?.['overlord_resolved_'+map.overlordId],empty=resolved&&!restored,kind=empty?'empty':'full',path=empty?(asset.emptyImage||'assets/lairs/built/'+rid+'_empty.png'):(asset.image||'assets/lairs/built/'+rid+'.png'),art=optional(path),now=performance.now()/1000,W=Number(geometry.width)||36,H=Number(geometry.height)||17,mapW=W*T,mapH=H*T,fit=Math.max(canvas.width/mapW,canvas.height/mapH),displayScale=Math.abs(fit-Math.round(fit))<1e-9?Math.round(fit):fit,drawW=mapW*displayScale,drawH=mapH*displayScale,ox=(canvas.width-drawW)/2,oy=(canvas.height-drawH)/2;
  ctx.imageSmoothingEnabled=false;ctx.fillStyle='#080a10';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();ctx.translate(ox,oy);ctx.scale(displayScale,displayScale);
  if(art.status==='ready'){
   const iw=art.image.naturalWidth||Number(asset.size?.[0])||1136,ih=art.image.naturalHeight||Number(asset.size?.[1])||538;
   ctx.drawImage(art.image,0,0,iw,ih,0,0,mapW,mapH);
  }else{
   const grad=ctx.createLinearGradient(0,0,0,mapH);grad.addColorStop(0,'#121a27');grad.addColorStop(1,'#080a10');ctx.fillStyle=grad;ctx.fillRect(0,0,mapW,mapH);ctx.fillStyle='#263345';ctx.beginPath();ctx.ellipse(mapW*.5,mapH*.66,mapW*.38,mapH*.23,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#121a25';ctx.fillRect(mapW*.45,mapH*.85,mapW*.1,mapH*.15);
  }
  if(!empty){
   const pulse=.035+.018*(.5+.5*Math.sin(now*.72)),glow=ctx.createRadialGradient(mapW*.5,mapH*.36,Math.max(8,mapW*.035),mapW*.5,mapH*.36,mapW*.28);
   glow.addColorStop(0,'rgba(255,226,169,'+pulse+')');glow.addColorStop(.55,'rgba(224,205,153,'+(pulse*.35)+')');glow.addColorStop(1,'rgba(224,205,153,0)');ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=glow;ctx.fillRect(mapW*.18,mapH*.08,mapW*.64,mapH*.52);ctx.restore();
  }
  if(restored){ctx.save();ctx.globalCompositeOperation='screen';const tint=ctx.createRadialGradient(mapW*.5,mapH*.42,0,mapW*.5,mapH*.42,mapW*.82);tint.addColorStop(0,'rgba(183,239,173,.12)');tint.addColorStop(1,'rgba(183,239,173,.025)');ctx.fillStyle=tint;ctx.fillRect(0,0,mapW,mapH);ctx.restore();}
  const heroX=(Number(info.heroRenderX??info.px)+.5)*T,heroY=(Number(info.heroRenderY??info.py)+.5)*T;
  if(info.hero){ctx.save();ctx.globalAlpha=.96;info.hero(heroX-T/2,heroY-T,info.S?.hero?.corruption>=60?'#715276':'#a96652');ctx.restore();}
  const spawn=layout.lairSpawn?.(map)||{x:Math.floor(W/2),y:H-1},entranceX=(spawn.x+.5)*T,entranceY=(spawn.y+.5)*T;
  ctx.save();ctx.globalAlpha=.78;ctx.strokeStyle='rgba(213,179,105,.72)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(entranceX,entranceY,8+Math.sin(now*2.8)*1.5,0,Math.PI*2);ctx.stroke();ctx.restore();
  ctx.restore();
  const consequence=regionState==='burned'?'rgba(54,7,7,.16)':restored?'rgba(151,224,146,.08)':regionState==='frozen'?'rgba(80,140,196,.12)':'rgba(0,0,0,0)';if(consequence!=='rgba(0,0,0,0)'){ctx.fillStyle=consequence;ctx.fillRect(0,0,canvas.width,canvas.height);}
  const walkable=layout.lairWalkable?Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>layout.lairWalkable(map,x,y)?1:0)).flat().reduce((sum,value)=>sum+value,0):0;
  lastWorldDebug={regionId:map.regionId,scriptState:'lair',tilesetLoaded:false,assetsReady:art.status==='ready',lairArt:art.status,tallAvailable:0,propAvailable:0,tallSprites:0,fallbackTrees:0,smallProps:0,alphaAnchors:0,tallPlaced:0,tallCap:0,tallRestricted:0,lairId:rid,lairPath:path,lairKind:kind,lairRestored:restored,empty,width:W,height:H,walkable};
  return true;
 }

 function render(ctx, canvas, info){
  lastHeroSprite = null;
  lastNpcSprites = [];
  const regionId = info.map.regionId;
  if(info.map.kind==='lair')return renderLair(ctx,canvas,info);
   const stateNow=performance.now()/1000;
   if(info.heroDir) heroState.dir=facingRow(info.heroDir);
   if(heroState.x!==info.px||heroState.y!==info.py){
    if(heroState.x!==null){const dx=info.px-heroState.x,dy=info.py-heroState.y;heroState.dir=facingRow(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));heroState.movedAt=stateNow;}
    heroState.x=info.px;heroState.y=info.py;
   }
   requestTileset(regionId,info.map);
   if(window.VTNWorldLibrary?.render(ctx,canvas,info,{
    drawNpc,
    landmark:info.landmark,
    drawHero:(drawCtx,renderInfo,dx,dy,frame)=>classPerson(drawCtx,renderInfo.S,heroState.dir,frame,dx,dy)||raceFrontPerson(drawCtx,renderInfo.S,dx,dy)
   })){
    lastWorldDebug={...window.VTNWorldLibrary.debug?.()};
    return true;
   }
  const r = load(regionId,info.map);
  if (!r || !ready(r)) {
    lastWorldDebug = { regionId, scriptState: scriptStates[regionId] || 'missing', tilesetLoaded: !!tilesets()[regionId], assetsReady: false, tallAvailable: 0, propAvailable: 0, tallSprites: 0, fallbackTrees: 0, smallProps: 0, alphaAnchors: 0, tallPlaced: 0, tallCap: 0, tallRestricted: 0 };
    loadingScreen(ctx, canvas, regionId);
    return true;
  }
  prepareProps(r);
  const { meta } = r;
  const a = info.grid, H = a.length, W = a[0].length;
  const now = performance.now() / 1000;
  const mapSeed = stringSeed(info.map.id || regionId);
  const availableTall = r.tall.filter(item => imageReady(item.image) && !!alphaAnchor(item));
  const tallPlan = availableTall.length ? tallLayout(r, info, availableTall) : { placements: [], walkable: 0, cap: 0, restricted: 0 };
  const worldDebug = { regionId, scriptState: scriptStates[regionId] || 'loaded', tilesetLoaded: true, assetsReady: true, tallAvailable: r.tall.length, propAvailable: r.prop.length, tallSprites: 0, fallbackTrees: 0, smallProps: 0, alphaAnchors: r.tall.filter(item => !!item.anchor).length, tallPlaced: tallPlan.placements.length, tallCap: tallPlan.cap, tallRestricted: tallPlan.restricted };
  // integer zoom so pixel art reads at a comfortable size
  const Z = Math.max(1, Math.min(2, Math.floor(Math.min(canvas.width / 480, canvas.height / 320))));
  const VW = canvas.width / Z, VH = canvas.height / Z;
  const heroRenderX=Number.isFinite(info.heroRenderX)?info.heroRenderX:info.px,heroRenderY=Number.isFinite(info.heroRenderY)?info.heroRenderY:info.py;
  const camX = Math.round(Math.max(0,Math.min(heroRenderX*T-VW/2+16,Math.max(0,W*T-VW)))), camY = Math.round(Math.max(0,Math.min(heroRenderY*T-VH/2+16,Math.max(0,H*T-VH))));
  const pts = info.points;
  const occupied = new Set(pts.map(p => p.x + ',' + p.y));
  const at = (x, y) => (y < 0 || y >= H || x < 0 || x >= W) ? 1 : a[y][x];
  const tileRect = (name) => meta.tiles[name];
  const blit = (name, dx, dy) => { const t = tileRect(name); if (t) ctx.drawImage(r.tiles, t[0], t[1], t[2], t[3], dx, dy, t[2], t[3]); };

  if (info.heroDir) heroState.dir=facingRow(info.heroDir);
  if (heroState.x !== info.px || heroState.y !== info.py) {
    if (heroState.x !== null) {
      const dx = info.px - heroState.x, dy = info.py - heroState.y;
      heroState.dir = facingRow(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      heroState.movedAt = now;
    }
    heroState.x = info.px; heroState.y = info.py;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0a0f0d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(Z, Z);
  ctx.translate(-camX, -camY);
  // the view may extend past the map: out-of-bounds cells render as dense forest
  const x0 = Math.floor(camX / T) - 2, x1 = Math.ceil((camX + VW) / T) + 2;
  const y0 = Math.floor(camY / T) - 2, y1 = Math.ceil((camY + VH) / T) + 4;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const gs = meta.ground.size, waterFrame = Math.floor(now * 1.6) % 2;
  const decor = [], drawables = [], lightsList = [];
  const tallAt = new Map(tallPlan.placements.map(item => [item.tx + ',' + item.ty, item]));
  const actors = [{ x: heroRenderX, y: heroRenderY }, ...pts.filter(p => p.type === 'npc' || p.type === 'rival').map(p => ({ x: p.renderX ?? p.x, y: p.renderY ?? p.y }))];

  // ---- base layer: ground / brush / water
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = at(x, y), dx = x * T, dy = y * T;
    if (t === 1) { blit('brush_' + (hash(x, y, 1) < .5 ? 0 : 1), dx, dy); continue; }
    ctx.drawImage(r.ground, ((x * T) % gs + gs) % gs, ((y * T) % gs + gs) % gs, T, T, dx, dy, T, T);
    if (t === 3) {
      blit('water_' + waterFrame, dx, dy);
      // shores: wet soil band and a pale ash rim where water meets land
      const n = at(x, y - 1) !== 3, s = at(x, y + 1) !== 3, w = at(x - 1, y) !== 3, e = at(x + 1, y) !== 3;
      ctx.fillStyle = '#1f2422';
      if (n) ctx.fillRect(dx, dy, T, 3); if (s) ctx.fillRect(dx, dy + T - 2, T, 2);
      if (w) ctx.fillRect(dx, dy, 3, T); if (e) ctx.fillRect(dx + T - 3, dy, 3, T);
      ctx.fillStyle = '#5d7d78';
      if (n) ctx.fillRect(dx + (w ? 3 : 0), dy + 3, T - (w ? 3 : 0) - (e ? 3 : 0), 1);
      if (w) ctx.fillRect(dx + 3, dy + (n ? 3 : 0), 1, T - (n ? 3 : 0) - (s ? 2 : 0));
      ctx.fillStyle = '#2b312c';
      for (const [cx, cy, on] of [[dx, dy, n && w], [dx + T - 6, dy, n && e], [dx, dy + T - 6, s && w], [dx + T - 6, dy + T - 6, s && e]])
        if (on) ctx.fillRect(cx, cy, 6, 6);
      if (hash(x, y, 7) < 0.12) lightsList.push({ x: dx + 16, y: dy + 10, r: 46, cool: true, wisp: true, ph: hash(x, y, 8) * 6 });
    } else if (t === 0 && !occupied.has(x + ',' + y)) {
      const h = hash(x, y, 3);
      const nearWall = at(x, y - 1) === 1 || at(x - 1, y) === 1 || at(x + 1, y) === 1;
      const pick = h < 0.035 ? 'grave_' + (h < 0.018 ? 0 : 1) : h < 0.06 ? 'mushrooms' : h < 0.07 ? 'bones' : (nearWall && h < 0.1) ? 'stump' : h < 0.103 ? 'candles' : null;
      if (pick) decor.push({ tile: pick, dx, dy });
      else if (r.prop.length && hash(x, y, mapSeed + 13) < 0.08) {
        const prop = r.prop[Math.floor(hash(x, y, mapSeed + 14) * r.prop.length)];
        decor.push({ prop, dx, dy });
      }
      if (pick === 'candles') lightsList.push({ x: dx + 16, y: dy + 20, r: 38, warm: true, ph: h * 9 });
      if (pick && pick.startsWith('grave') && hash(x, y, 4) < 0.25) lightsList.push({ x: dx + 16, y: dy + 2, r: 40, cool: true, wisp: true, ph: h * 7 });
    }
  }
  for (const d of decor) {
    if (d.tile) blit(d.tile, d.dx, d.dy);
    else if (imageReady(d.prop?.image)) {
      const w = d.prop.image.naturalWidth, h = d.prop.image.naturalHeight;
      ctx.drawImage(d.prop.image, 0, 0, w, h, d.dx, d.dy, T, T);
      worldDebug.smallProps++;
    }
  }

  // ---- grass overlays (tips poke into the tile above)
  const wildN = meta.wild.count, wh = meta.wild.h;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (at(x, y) === 2) {
    const v = Math.floor(hash(x, y, 5) * wildN);
    ctx.drawImage(r.wild, v * T, 0, T, wh, x * T, y * T - (wh - T), T, wh);
  }

  if (info.moveTarget && info.moveTarget.mapId === info.map.id) {
    const targetX=info.moveTarget.x*T+16,targetY=info.moveTarget.y*T+16,pulse=2+Math.sin(now*7)*1.5;
    ctx.save();ctx.strokeStyle='rgba(238,211,126,.95)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(targetX,targetY,5+pulse,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(238,211,126,.8)';ctx.beginPath();ctx.moveTo(targetX,targetY-4);ctx.lineTo(targetX+4,targetY);ctx.lineTo(targetX,targetY+4);ctx.lineTo(targetX-4,targetY);ctx.closePath();ctx.fill();ctx.restore();
  }

  // ---- depth-sorted tall things: trees, landmarks, NPCs, hero
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const planned = tallAt.get(x + ',' + y);
    if (planned) {
      const tall = planned.item;
      drawables.push({ y: planned.ySort, tree: { image: tall.image, sx: 0, sy: 0, w: tall.image.naturalWidth, h: tall.image.naturalHeight, tall: true, src: tall.src }, dx: planned.dx, dy: planned.dy, tx: x, ty: y });
      continue;
    }
    if (availableTall.length || at(x, y) !== 1 || hash(x, y, 6) > (inside(x, y) ? 0.62 : 0.9)) continue;
    const tr = meta.trees[Math.floor(hash(x, y, 2) * meta.trees.length)];
    drawables.push({ y: y * T + T - 1, tree: { image: r.trees, sx: tr[0], sy: tr[1], w: tr[2], h: tr[3], tall: false, src: r.trees.src }, dx: Math.round(x * T + T / 2 - tr[4] + Math.round((hash(x, y, 11) - 0.5) * 10)), dy: Math.round(y * T + T - tr[5] - 2), tx: x, ty: y });
  }
  for (const p of pts) {
    const dx = (p.renderX ?? p.x) * T, dy = (p.renderY ?? p.y) * T;
    drawables.push({ y: dy + T - 1, point: p, dx, dy });
    if (p.type !== 'npc' && p.type !== 'rival') lightsList.push({ x: dx + 17, y: dy - 2, r: p.type === 'portal' ? 70 : 96, warm: p.type !== 'portal', cool: p.type === 'portal', ph: p.x });
  }
  drawables.push({ y: heroRenderY * T + T - 1, hero: true, dx: heroRenderX * T, dy: heroRenderY * T });
  drawables.sort((a, b) => a.y - b.y);

  for (const d of drawables) {
    if (d.tree) {
      // trees right in front of the hero fade so the hero stays visible
      const front = actors.some(a => d.ty > a.y && d.ty - a.y <= 2 && Math.abs(d.tx - a.x) <= 1);
      ctx.globalAlpha = front ? 0.45 : 1;
      const t = d.tree;
      ctx.drawImage(t.image, t.sx, t.sy, t.w, t.h, d.dx, d.dy, t.w, t.h);
      if (t.tall) worldDebug.tallSprites++; else worldDebug.fallbackTrees++;
      ctx.globalAlpha = 1;
    } else if (d.point) {
      const p = d.point;
      if (p.type === 'npc' || p.type === 'rival') {
        if (!drawNpc(ctx, p, d.dx, d.dy, info.S, now)) info.hero(d.dx, d.dy, p.type === 'rival' ? '#788da0' : '#9da47e');
      }
       else if(p.type==='building'||p.type==='boss-gate')drawBuilding(ctx,p);
       else info.landmark(ctx, d.dx, d.dy, { type: p.type === 'boss' || p.type === 'arena' || p.type === 'final-boss' ? 'boss_altar' : p.type === 'portal' || p.type==='legendary' ? 'portal' : p.type === 'shop' ? 'shop' : p.type === 'clue' || p.type === 'abyss-memory' ? 'clue' : p.type === 'puzzle' ? 'rune' : 'shrine' }, info.mapArt, info.tick);
    } else if (d.hero) {
      const moving = !!info.heroMoving || now - heroState.movedAt < 0.28;
      const fr = moving ? 1 + (Math.floor(now * 7) % 2) : 0;
       if (!classPerson(ctx, info.S, heroState.dir, fr, d.dx, d.dy) && !raceFrontPerson(ctx, info.S, d.dx, d.dy)) {
        lastHeroSprite = { kind: 'procedural', classId: info.S?.hero?.classId || null };
        info.hero(d.dx, d.dy, info.S?.hero.corruption >= 60 ? '#715276' : '#a96652');
      }
      // grass in front of the hero's feet
      if (at(Math.floor(heroRenderX), Math.floor(heroRenderY)) === 2) {
        const v = Math.floor(hash(Math.floor(heroRenderX), Math.floor(heroRenderY), 5) * wildN);
        ctx.drawImage(r.wild, v * T, wh - 12, T, 12, d.dx, d.dy + T - 12, T, 12);
      }
    }
  }
  // names of nearby points
  ctx.font = `600 ${Math.round(13 / Z * 10) / 10}px 'VTN UI',sans-serif`; ctx.textAlign = 'center';
  for (const p of pts) if (Math.abs((p.renderX ?? p.x) - info.px) + Math.abs((p.renderY ?? p.y) - info.py) < 6) {
    const rx = p.renderX ?? p.x, ry = p.renderY ?? p.y, ly = ry * T + (p.type === 'npc' || p.type === 'rival' ? -6 : -30);
    ctx.fillStyle = '#0a0d0bcc'; ctx.fillText(p.name, rx * T + 16 + 1 / Z, ly + 1 / Z);
    ctx.fillStyle = p.type === 'rival' ? '#c9d4dc' : '#e8dcae'; ctx.fillText(p.name, rx * T + 16, ly);
  }
  ctx.textAlign = 'start';

  // ---- wisps (world space, above everything)
  for (const l of lightsList) if (l.wisp) {
    const f = Math.floor(now * 3 + l.ph) % 2;
    const bob = Math.sin(now * 1.7 + l.ph) * 4;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(r.wisp, f * 16, 0, 16, 16, Math.round(l.x - 8), Math.round(l.y - 8 + bob), 16, 16);
    ctx.globalAlpha = 1;
    l.y += bob;
  }
  ctx.restore();

  // ---- fog: two parallax layers drifting at different speeds
  const fc = fog();
  ctx.save(); ctx.imageSmoothingEnabled = true;
  for (const [k, sp, al, sc] of [[0, 9, 0.11, 6], [1, 15, 0.08, 9]]) {
    const fw = fc.width * sc, fh = fc.height * sc;
    const ox = -(((camX * Z * (1 + k * 0.25) + now * sp) % fw) + fw) % fw, oy = -(((camY * Z * (1 + k * 0.25)) % fh) + fh) % fh;
    ctx.globalAlpha = al;
    for (let yy = oy; yy < canvas.height; yy += fh) for (let xx = ox; xx < canvas.width; xx += fw) ctx.drawImage(fc, xx, yy, fw, fh);
  }
  ctx.restore();

  // ---- darkness with light pools
  const lc = lights(canvas), lg = lc.getContext('2d');
  lg.globalCompositeOperation = 'source-over';
  lg.clearRect(0, 0, lc.width, lc.height);
  lg.fillStyle = 'rgba(3,6,9,0.48)'; lg.fillRect(0, 0, lc.width, lc.height);
  lg.globalCompositeOperation = 'destination-out';
  const hole = (sx, sy, rad, strength) => {
    const g = lg.createRadialGradient(sx, sy, 0, sx, sy, rad);
    g.addColorStop(0, `rgba(0,0,0,${strength})`); g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lg.fillStyle = g; lg.beginPath(); lg.arc(sx, sy, rad, 0, Math.PI * 2); lg.fill();
  };
  hole((heroRenderX * T + 16 - camX) * Z, (heroRenderY * T + 12 - camY) * Z, 120 * Z, 0.95);
  for (const l of lightsList) {
    const fl = l.warm ? 1 + Math.sin(now * 9 + l.ph) * 0.06 + Math.sin(now * 23 + l.ph * 2) * 0.03 : 1;
    hole((l.x - camX) * Z, (l.y - camY) * Z, l.r * fl * Z, l.warm ? 0.9 : 0.7);
  }
  ctx.drawImage(lc, 0, 0);
  // coloured glow on top
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const l of lightsList) {
    const sx = (l.x - camX) * Z, sy = (l.y - camY) * Z, rad = l.r * 0.8 * Z;
    if (sx < -rad || sy < -rad || sx > canvas.width + rad || sy > canvas.height + rad) continue;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
    g.addColorStop(0, l.warm ? 'rgba(242,170,60,0.22)' : 'rgba(110,170,255,0.20)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
  }
  ctx.restore();

  // ---- falling ash and a few embers (screen space, slight parallax)
  for (const f of flakes) {
    const x = ((f.x * canvas.width + now * 8 * f.s - camX * 0.3 + Math.sin(now * 0.8 + f.y * 9) * 12) % canvas.width + canvas.width) % canvas.width;
    const y = ((f.y * canvas.height + now * 14 * f.s - camY * 0.3) % canvas.height + canvas.height) % canvas.height;
    ctx.fillStyle = f.e ? 'rgba(240,150,70,0.85)' : `rgba(200,204,190,${0.25 + f.s * 0.3})`;
    const fs = (f.s > 0.9 ? 2 : 1) * Z;
    ctx.fillRect(Math.round(x), Math.round(y), fs, fs);
  }
  // vignette
  const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.25, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.7);
  vg.addColorStop(0, 'rgba(4,8,7,0)'); vg.addColorStop(1, 'rgba(4,8,7,0.62)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  lastWorldDebug = worldDebug;
  return true;
}

window.VTNScene = { render, drawNpc, has: (regionId) => !!tilesets()[regionId], inspect: () => ({ hero: lastHeroSprite, npcs: lastNpcSprites.slice(), world: { ...lastWorldDebug }, ...lastWorldDebug }) };
})();
