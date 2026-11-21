(function (g) {
  'use strict';

  // P9-D uses the approved native library for the world layer.  The old
  // generated tilesets remain in scene.js and are deliberately used while a
  // library set is loading or if a hand-edited override points at a missing
  // file.
  const TILE = 32;
  const CHUNK_TILES = 16;
  // camera height: how many 32-px tiles fit across the longer side of the screen (player setting "Tầm nhìn")
  const VIEW_RANGES = { near: 20, mid: 30, far: 40, vfar: 54, ultra: 84 };
  g.VTNViewZoom = (canvas, map) => {
    const mode = g.VTNPrefs?.get?.().viewRange;
    if (mode === 'whole' && map?.width) return Math.max(.08, Math.min(1, Math.min(canvas.width / (map.width * 32), canvas.height / (map.height * 32))));   // the whole region in one frame
    const r = VIEW_RANGES[mode] || VIEW_RANGES.far;
    return Math.max(.12, Math.min(3, Math.max(canvas.width, canvas.height) / (r * 32)));
  };
  g.VTNViewZoom.ranges = VIEW_RANGES;
  const CHUNK_PX = TILE * CHUNK_TILES;
  const library = g.VTN_WORLD || {};
  const imageCache = new Map();
  const plans = new Map();
  const metadataByFile = new Map();
  const opaqueMaskCache = new Map();
  const GROUND_EDGE_THRESHOLD = 34;
  const DITHER_4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];
  let blendScratch = null;
  let lastDebug = {
    worldLibrary: false,
    worldLibraryState: 'idle',
    worldImagesTotal: 0,
    worldImagesLoaded: 0,
    worldImagesMissing: 0,
    staticChunks: 0,
    buildingsPlaced: 0,
    propsPlaced: 0,
    tallPlaced: 0,
    sharedPropRatio: 0,
    pathTiles: 0,
    liquidPathTiles: 0,
    groundEdgeContrast: { threshold: GROUND_EDGE_THRESHOLD, borders: 0, highContrast: 0, ratio: 0 },
    collisionProps: 0,
    doorsClear: true,
    frameRenderMs: 0
  };
  let cameraState = { mapId: null, x: 0, y: 0, vx: 0, vy: 0, lastAt: 0, renderX: null, renderY: null };

  for (const [setName, set] of Object.entries(library)) {
    for (const kind of ['buildings', 'props', 'tiles']) {
      for (const asset of set?.[kind] || []) {
        if (asset?.file) metadataByFile.set(asset.file, { ...asset, set: setName, kind });
      }
    }
  }

  const terrainData = () => g.VTN_DATA?.world_terrain || {};
  const setForMap = map => {
    if (map?.layout === 'abyss_cave') return 'abyss';
    if (map?.architecture === 'hell' || String(map?.id || '').startsWith('hell_')) return 'hell';
    return map?.regionId || 'region_01';
  };
  const configForMap = map => {
    const data = terrainData();
    const special = data.special?.[setForMap(map)];
    if (special) return special;
    return data.regions?.[map?.regionId] || data.regions?.region_01 || null;
  };
  const mapSize = map => ({
    width: Number(map?.width) || (map?.kind === 'region' ? 80 : 40),
    height: Number(map?.height) || (map?.kind === 'region' ? 60 : 30)
  });
  const key = (x, y) => `${x},${y}`;
  const hash = value => {
    const str = String(value ?? ''); let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  // integer mix for per-pixel noise (no string building in hot loops)
  const mix3 = (h, a, b) => { h = Math.imul(h ^ (a * 374761393), 668265263); h = Math.imul(h ^ (b * 1274126177), 2246822519); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  const unit = value => hash(value) / 4294967296;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const boxesOverlap = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const distance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const inside = (x, y, width, height) => x >= 0 && y >= 0 && x < width && y < height;
  const walkable = tile => tile === 0 || tile === 2;
  const isSharedProp = prop => prop?.sourceSet === 'shared' || prop?.sourceSet === 'shared_wet';

  function assetMeta(file) {
    return metadataByFile.get(file) || { file, w: TILE, h: TILE, shape: 'small' };
  }

  function imageFor(file) {
    if (!file) return null;
    let entry = imageCache.get(file);
    if (entry) return entry;
    entry = { file, status: 'loading', image: null };
    if (typeof Image !== 'undefined') {
      const image = new Image();
      entry.image = image;
      // decode off the main thread before anything draws it (a first drawImage would decode synchronously)
      image.decoding = 'async';
      image.onload = () => { const done = () => { entry.status = 'ready'; }; if (image.decode) image.decode().then(done, done); else done(); };
      image.onerror = () => { entry.status = 'missing'; };
      image.src = file;
    } else {
      entry.status = 'missing';
    }
    imageCache.set(file, entry);
    return entry;
  }

  function imageReady(entry) {
    return !!entry && entry.status === 'ready' && entry.image?.complete && entry.image.naturalWidth > 0;
  }

  function setNamesForMap(map, config) {
    const names = [config?.set || setForMap(map), ...(config?.sharedSets || ['shared'])];
    if (['region_01', 'region_02', 'region_03'].includes(map?.regionId) && !names.includes('shared_wet')) names.push('shared_wet');
    return [...new Set(names)].filter(name => library[name]);
  }

  function filesForConfig(config) {
    const tiles = config?.tiles || {};
    return [...(tiles.ground || []), ...(tiles.path || []), ...(tiles.plaza || []), tiles.liquid, tiles.wild, tiles.cliff].filter(Boolean);
  }

  function oldPropsCounts(regionId) {
    const props = g.VTN_PROPS?.[regionId] || {};
    return { tall: (props.tall || []).length, prop: (props.prop || []).length };
  }

  // Smooth value noise is intentionally coarse.  It avoids the visible
  // checkerboard that a per-cell random tile choice creates in pixel art.
  function valueNoise(x, y, seed, scale = 8) {
    const gx = Math.floor(x / scale), gy = Math.floor(y / scale);
    const tx = (x - gx * scale) / scale, ty = (y - gy * scale) / scale;
    const fade = value => value * value * (3 - 2 * value);
    const v = (ix, iy) => unit(`${seed}|${ix}|${iy}`);
    const a = v(gx, gy), b = v(gx + 1, gy), c = v(gx, gy + 1), d = v(gx + 1, gy + 1);
    const sx = fade(tx), sy = fade(ty);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function colorFromHex(value, fallback) {
    const raw = String(value || '').trim().replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(raw)) return fallback.slice();
    return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
  }

  function mixColor(a, b, amount) {
    const t = clamp(amount, 0, 1);
    return [
      Math.round(a[0] * (1 - t) + b[0] * t),
      Math.round(a[1] * (1 - t) + b[1] * t),
      Math.round(a[2] * (1 - t) + b[2] * t)
    ];
  }

  function toneColors(tone, fallback) {
    if (Array.isArray(tone)) {
      const colors = tone.map(color => colorFromHex(color, fallback));
      return { shadow: colors[0] || fallback, base: colors[1] || colors[0] || fallback, light: colors[2] || colors[1] || fallback };
    }
    const safe = tone || {};
    return {
      shadow: colorFromHex(safe.shadow, fallback),
      base: colorFromHex(safe.base, fallback),
      light: colorFromHex(safe.light, fallback)
    };
  }

  function tintedTile(file, tone, mode = 'ground') {
    const key = `${file}|native-pixel-tile|${mode}`;
    if (imageCache.has(`canvas:${key}`)) return imageCache.get(`canvas:${key}`);
    const resource = imageFor(file);
    if (!imageReady(resource) || typeof document === 'undefined') return resource?.image || null;
    const canvas = document.createElement('canvas');
    canvas.width = mode==='ground'?Math.max(TILE,resource.image.naturalWidth):TILE;
    canvas.height = mode==='ground'?Math.max(TILE,resource.image.naturalHeight):TILE;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    // The P9-F palette composite made the cleaned source sheets look foggy and
    // flattened.  Keep the source pixels and contrast intact; region palette
    // values are reserved for borders/decals, never for averaging the art.
    context.drawImage(resource.image, 0, 0, canvas.width, canvas.height);
    imageCache.set(`canvas:${key}`, canvas);
    return canvas;
  }

  const materialPatches=new WeakMap();
  function materialPatch(texture,x,y){
    if(!texture||texture.width<=TILE)return texture;
    let cache=materialPatches.get(texture);if(!cache){cache=new Map();materialPatches.set(texture,cache);}
    const cols=Math.max(1,Math.floor(texture.width/TILE)),rows=Math.max(1,Math.floor(texture.height/TILE)),sx=((x%cols)+cols)%cols,sy=((y%rows)+rows)%rows,key=sx+','+sy;
    if(cache.has(key))return cache.get(key);
    const patch=document.createElement('canvas');patch.width=TILE;patch.height=TILE;patch.getContext('2d').drawImage(texture,sx*TILE,sy*TILE,TILE,TILE,0,0,TILE,TILE);cache.set(key,patch);return patch;
  }
  function scratch() {
    if (blendScratch || typeof document === 'undefined') return blendScratch;
    const make = () => { const canvas = document.createElement('canvas'); canvas.width = TILE; canvas.height = TILE; return canvas; };
    blendScratch = { mask: make(), layer: make() };
    blendScratch.maskContext = blendScratch.mask.getContext('2d');
    blendScratch.layerContext = blendScratch.layer.getContext('2d');
    blendScratch.maskContext.imageSmoothingEnabled = false;
    blendScratch.layerContext.imageSmoothingEnabled = false;
    return blendScratch;
  }

  function drawDithered(context, texture, x, y, amountAt, seed) {
    if (!texture) return;
    // fast path: the blend amount varies smoothly, so 9 samples tell a fully covered / fully empty tile apart
    let lo = 1, hi = 0;
    for (const sy of [0, 15, 31]) for (const sx of [0, 15, 31]) { const v = Number(amountAt(sx, sy)) || 0; if (v < lo) lo = v; if (v > hi) hi = v; }
    if (lo >= .995) { context.drawImage(texture, x, y); return; }
    if (hi <= .01) return;
    let allVisible = true, anyVisible = false;
    const mask = new Uint8ClampedArray(TILE * TILE * 4), base = hash(seed);
    for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
      const amount = clamp(Number(amountAt(px, py)) || 0, 0, 1);
      // A hashed threshold keeps the seam dither organic at game scale; a
      // pure 4x4 Bayer pattern would itself read as another square grid.
      const threshold = mix3(base, px, py) * .78 + ((DITHER_4[py & 3][px & 3] + .5) / 16) * .22;
      const visible = amount >= .995 || (amount > .01 && threshold < amount);
      if (visible) { anyVisible = true; mask[(py * TILE + px) * 4 + 3] = 255; }
      else allVisible = false;
    }
    if (!anyVisible) return;
    if (allVisible) { context.drawImage(texture, x, y); return; }
    const state = scratch();
    state.maskContext.putImageData(new ImageData(mask, TILE, TILE), 0, 0);
    state.layerContext.clearRect(0, 0, TILE, TILE);
    state.layerContext.globalCompositeOperation = 'source-over';
    state.layerContext.drawImage(texture, 0, 0);
    state.layerContext.globalCompositeOperation = 'destination-in';
    state.layerContext.drawImage(state.mask, 0, 0);
    state.layerContext.globalCompositeOperation = 'source-over';
    context.drawImage(state.layer, x, y);
  }

  function edgeFade(value) {
    return clamp((value + 2) / 8, 0, 1);
  }

  function softCellMask(grid, x, y, isActive, neighborActive, px, py) {
    if (!isActive) return 0;
    let amount = 1;
    if (!neighborActive.top) amount = Math.min(amount, edgeFade(py));
    if (!neighborActive.bottom) amount = Math.min(amount, edgeFade(TILE - 1 - py));
    if (!neighborActive.left) amount = Math.min(amount, edgeFade(px));
    if (!neighborActive.right) amount = Math.min(amount, edgeFade(TILE - 1 - px));
    return amount;
  }

  function adjacent(grid, x, y, predicate) {
    return {
      top: !!predicate(grid[y - 1]?.[x]),
      bottom: !!predicate(grid[y + 1]?.[x]),
      left: !!predicate(grid[y]?.[x - 1]),
      right: !!predicate(grid[y]?.[x + 1])
    };
  }

  function priorityQueuePush(queue, item) {
    queue.push(item);
    let i = queue.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (queue[parent][0] <= item[0]) break;
      queue[i] = queue[parent];
      i = parent;
      queue[i] = item;
    }
  }

  function priorityQueuePop(queue) {
    if (!queue.length) return null;
    const first = queue[0], last = queue.pop();
    if (queue.length) {
      let i = 0;
      while (true) {
        const left = i * 2 + 1, right = left + 1;
        let small = i;
        if (left < queue.length && queue[left][0] < queue[small][0]) small = left;
        if (right < queue.length && queue[right][0] < queue[small][0]) small = right;
        if (small === i) break;
        queue[i] = queue[small];
        i = small;
      }
      queue[i] = last;
    }
    return first;
  }

  function routePath(grid, start, goal) {
    const height = grid.length, width = grid[0]?.length || 0;
    if (!width || !height) return [];
    const valid = point => inside(point.x, point.y, width, height);
    if (!valid(start) || !valid(goal)) return [];
    const startKey = key(start.x, start.y), goalKey = key(goal.x, goal.y);
    const dist = new Map([[startKey, 0]]), previous = new Map(), queue = [];
    priorityQueuePush(queue, [0, start.x, start.y]);
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    while (queue.length) {
      const [cost, x, y] = priorityQueuePop(queue), current = key(x, y);
      if (cost !== dist.get(current)) continue;
      if (current === goalKey) break;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (!inside(nx, ny, width, height)) continue;
        const tile = grid[ny][nx], step = tile === 1 ? 14 : tile === 3 ? 5 : 1;
        const next = cost + step, nextKey = key(nx, ny);
        if (next < (dist.get(nextKey) ?? Infinity)) {
          dist.set(nextKey, next);
          previous.set(nextKey, current);
          priorityQueuePush(queue, [next, nx, ny]);
        }
      }
    }
    if (!dist.has(goalKey)) return [];
    const path = [];
    let current = goalKey;
    while (current) {
      const [x, y] = current.split(',').map(Number);
      path.push({ x, y });
      if (current === startKey) break;
      current = previous.get(current);
    }
    return path.reverse();
  }

  function pathNetwork(map, grid, points, buildings) {
    const layout = g.VTN_MAP_LAYOUTS;
    if (layout?.zoneModel) {
      const zoneModel = layout.zoneModel(map, grid, points, {
        extraEndpoints: (buildings || []).map(building => building.door),
        plazaSources: buildings || [],
        carveRoads: true
      });
      return {
        cells: new Set(zoneModel.roadCells),
        renderCells: new Set(zoneModel.roadCells),
        routes: zoneModel.routes,
        zones: zoneModel
      };
    }
    const spawn = map?.spawn || { x: 8, y: 8 };
    const endpoints = [];
    const add = point => {
      const x = clamp(Math.round(Number(point?.x)), 1, (grid[0]?.length || 2) - 2);
      const y = clamp(Math.round(Number(point?.y)), 1, grid.length - 2);
      if (!endpoints.some(other => other.x === x && other.y === y)) endpoints.push({ x, y });
    };
    add(spawn);
    for (const point of points || []) {
      if (point.type === 'npc' || point.type === 'rival') continue;
      add(point);
    }
    for (const building of buildings) add(building.door);
    const routes = [];
    let from = endpoints[0] || { x: 8, y: 8 };
    for (const endpoint of endpoints.slice(1)) {
      const route = routePath(grid, from, endpoint);
      if (route.length) routes.push(route);
      from = endpoint;
    }
    const cells = new Set();
    for (const route of routes) for (const cell of route) if (grid[cell.y]?.[cell.x] !== 2) cells.add(key(cell.x, cell.y));

    // The route itself remains the gameplay/pathing contract.  The visual
    // ribbon is widened to two or three cells only on non-encounter terrain,
    // so encounter coverage and walkability are unchanged.
    const renderCells = new Set(cells);
    for (const route of routes) for (let i = 0; i < route.length; i++) {
      const cell = route[i], previous = route[Math.max(0, i - 1)], next = route[Math.min(route.length - 1, i + 1)];
      const horizontal = Math.abs(next.x - previous.x) >= Math.abs(next.y - previous.y);
      const offsets = horizontal ? [[0, -1], [0, 0], [0, 1]] : [[-1, 0], [0, 0], [1, 0]];
      const turn = previous.x !== next.x && previous.y !== next.y;
      if (turn) offsets.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      for (const [dx, dy] of offsets) {
        const x = cell.x + dx, y = cell.y + dy, value = grid[y]?.[x];
        if (value === 0 || value === 3) renderCells.add(key(x, y));
      }
    }
    return { cells, renderCells, routes };
  }

  function gateOverride(map, config, lot) {
    const list = terrainData().gateOverrides || [];
    const entry = list.find(value => value.regionId === map?.regionId && value.lot === lot?.name);
    if (entry?.file) return entry;
    if (config?.gate?.lot === lot?.name && config.gate.file) return config.gate;
    return null;
  }

  function buildingScore(asset, lot) {
    const targetW = Math.max(TILE * 2, Number(lot?.w || 6) * TILE * 0.88);
    const targetH = Math.max(TILE * 2, Number(lot?.h || 5) * TILE * 0.72);
    const foot = asset.foot || [0, Math.max(0, asset.h - 12), asset.w, 12];
    const widthCost = Math.abs(Number(foot[2]) - targetW) / targetW;
    const heightCost = Math.abs(Number(foot[3]) - targetH) / targetH;
    const oversize = Number(foot[2]) > Number(lot?.w || 6) * TILE * 1.35 ? 0.45 : 0;
    return widthCost + heightCost + oversize;
  }

  function chooseBuilding(setName, lot, map, config, used) {
    const override = lot?.kind === 'gate' ? gateOverride(map, config, lot) : null;
    const candidates = (library[setName]?.buildings || []).slice();
    if (override?.file) {
      const exact = candidates.find(asset => asset.file === override.file) || metadataByFile.get(override.file);
      if (exact) return { ...exact, gate: true, override: true };
    }
    if (!candidates.length) return null;
    const ranked = candidates
      .filter(asset => !used.has(asset.file) || candidates.length < 12)
      .sort((a, b) => buildingScore(a, lot) - buildingScore(b, lot) || hash(`${map?.id}|${a.file}`) - hash(`${map?.id}|${b.file}`));
    const choice = ranked[Math.min(ranked.length - 1, hash(`${map?.id}|${lot?.name}`) % Math.min(4, ranked.length))] || ranked[0];
    if (choice) used.add(choice.file);
    return choice ? { ...choice, gate: lot?.kind === 'gate' } : null;
  }

  function generatedLots(map, grid, points) {
    if (map?.architecture === 'hell' || map?.id?.startsWith('hell_')) return [];
    const { width, height } = mapSize(map);
    if (map?.kind === 'region') return g.VTN_MAP_LAYOUTS?.buildingLots?.(map) || g.VTN_DATA?.buildings?.regions?.[map.regionId]?.lots || [];
    const count = map?.layout === 'abyss_cave' ? 2 : map?.kind === 'area' ? 3 : map?.kind === 'realm' ? 2 : 2;
    const out = [];
    const candidates = [
      [5, 5, 7, 5], [15, 4, 8, 5], [25, 7, 7, 5], [6, 16, 8, 5], [20, 17, 9, 5], [width - 12, height - 9, 8, 6]
    ];
    for (let i = 0; i < candidates.length && out.length < count; i++) {
      const [x0, y0, w, h] = candidates[(hash(`${map?.id}|lot|${i}`) + i) % candidates.length];
      const x = clamp(x0, 2, Math.max(2, width - w - 2)), y = clamp(y0, 2, Math.max(2, height - h - 2));
      const door = { x: x + Math.floor(w / 2), y: y + h - 1 };
      if ((points || []).some(point => distance(point, door) <= 2)) continue;
      if (out.some(lot => Math.abs(lot.x - x) < w && Math.abs(lot.y - y) < h)) continue;
      out.push({ name: `${map?.id || 'map'}_structure_${out.length + 1}`, x, y, w, h, door: [door.x, door.y] });
    }
    return out;
  }

  function buildingName(point) {
    const lot = point?.lot || point;
    const raw = String(lot?.name || point?.name || '').toLowerCase();
    if (point?.type === 'boss-gate' || lot?.kind === 'gate' || raw.includes('gate')) return 'Cổng Luyện Ngục';
    if (/shop|market|caravan|dock|boathouse|inn|tavern/.test(raw)) return raw.includes('market') || raw.includes('shop') ? 'Chợ vùng' : 'Quán trọ';
    if (/shrine|temple|chapel|altar|bell|pact|tide/.test(raw)) return 'Miếu';
    if (/tower|lighthouse|observatory|watch/.test(raw)) return 'Tháp canh';
    if (/smithy|forge|workshop/.test(raw)) return 'Xưởng';
    if (/hall|court|theater|archive|palace|castle|seventh/.test(raw)) return 'Đại sảnh';
    if (/hut|house|home|shelter|camp|shed/.test(raw)) return 'Nhà dân';
    return 'Công trình';
  }

  const lotIsLandmark = lot => /shrine|temple|chapel|altar|tower|lighthouse|observatory|watch|archive|hall|palace|theater|court|forge|smithy|bell|pact|mirror|seventh/.test(String(lot?.name || '').toLowerCase());

  function makeBuildings(map, grid, points, config) {
    const setName = config?.set || setForMap(map), lots = generatedLots(map, grid, points), used = new Set(), buildings = [];
    const lotKit = regionKit(g.VTN_MAP_LAYOUTS?.citadelOf?.(map));
    for (const lot of lots) {
      const asset = (lot.asset && lotKit?.buildings?.[lot.asset]) ? { ...lotKit.buildings[lot.asset], gate: false } : chooseBuilding(setName, lot, map, config, used);
      if (!asset) continue;
      const door = Array.isArray(lot.door) ? { x: Number(lot.door[0]), y: Number(lot.door[1]) } : { x: Number(lot.x) + Math.floor(Number(lot.w || 6) / 2), y: Number(lot.y) + Number(lot.h || 5) - 1 };
      const assetDoor = asset.door || [asset.w / 2, asset.h - 1];
      const drawX = Math.round((door.x + 0.5) * TILE - Number(assetDoor[0]));
      const drawY = Math.round((door.y + 1) * TILE - Number(assetDoor[1]));
      const foot = asset.collider || asset.foot || [0, Math.max(0, asset.h - 12), asset.w, 12];
      const fullBox = { left: drawX, top: drawY, right: drawX + asset.w, bottom: drawY + asset.h };
      const footBox = { left: drawX + foot[0], top: drawY + foot[1], right: drawX + foot[0] + foot[2], bottom: drawY + foot[1] + foot[3] };
      buildings.push({
        id: lot.name,
        lot,
        asset,
        image: imageFor(asset.file),
        drawX,
        drawY,
        door,
        name: buildingName({ lot, type: lot.kind === 'gate' ? 'boss-gate' : 'building' }),
        fullBox,
        footBox,
        sortY: footBox.bottom,
        gate: !!asset.gate || lot.kind === 'gate',
        district: asset.district || (map.regionId === 'region_06' && Number(lot.x) >= 48 && Number(lot.y) <= 13 ? 'night' : null),
        landmark: lotIsLandmark(lot)
      });
    }

    // A few POIs become proper landmark buildings instead of the old generic
    // altar silhouette.  Their door remains the original interaction tile.
    const landmarks = (points || []).filter(point => ['boss', 'shrine', 'puzzle', 'arena'].includes(point.type));
    for (const point of (lotKit ? [] : landmarks).slice(0, map?.kind === 'region' ? 3 : 1)) {
      if (buildings.some(building => distance(building.door, point) <= 5)) continue;
      const lot = {
        name: `${map?.id || 'map'}|landmark|${point.id || point.type}`,
        x: clamp(Number(point.x) - 4, 2, Math.max(2, mapSize(map).width - 11)),
        y: clamp(Number(point.y) - 6, 2, Math.max(2, mapSize(map).height - 9)),
        w: 9,
        h: 7,
        door: [Number(point.x), Number(point.y)]
      };
      const asset = chooseBuilding(setName, lot, map, config, used);
      if (!asset) continue;
      const assetDoor = asset.door || [asset.w / 2, asset.h - 1];
      const drawX = Math.round((lot.door[0] + 0.5) * TILE - Number(assetDoor[0]));
      const drawY = Math.round((lot.door[1] + 1) * TILE - Number(assetDoor[1]));
      const foot = asset.foot || [0, Math.max(0, asset.h - 12), asset.w, 12];
      const fullBox = { left: drawX, top: drawY, right: drawX + asset.w, bottom: drawY + asset.h };
      const footBox = { left: drawX + foot[0], top: drawY + foot[1], right: drawX + foot[0] + foot[2], bottom: drawY + foot[1] + foot[3] };
      buildings.push({ id: lot.name, lot, asset, image: imageFor(asset.file), drawX, drawY, door: { x: lot.door[0], y: lot.door[1] }, name: point.name || buildingName(lot), fullBox, footBox, sortY: footBox.bottom, gate: false, district: asset.district || null, landmark: true, pointId: point.id });
    }
    const markedLandmarks = buildings.filter(building => building.landmark);
    for (const building of markedLandmarks.slice(4)) building.landmark = false;
    return buildings;
  }

  // Walled anchor city: towers, gatehouse and courtyard props are building-like sprites (kit from CastleKingdom, graded).
  const regionKit = c => (c?.kit && g.VTN_KINGDOM_KITS?.[c.kit]) || null;
  function makeStructures(map) {
    const geo = g.VTN_MAP_LAYOUTS?.citadelGeometry?.(map), rk = regionKit(geo?.c), kit = rk || g.VTN_KINGDOM;
    if (!geo || !kit) return [];
    const out = [];
    for (const s of [...(geo.c.towers || []), ...(geo.c.props || [])]) {
      const asset = (rk && rk.structures?.[s.t]) || kit.buildings?.[s.t] || kit.props?.[s.t];
      if (!asset) continue;
      const door = { x: s.x, y: s.y }, foot = asset.collider || asset.foot, drawX = Math.round((door.x + 0.5) * TILE - asset.door[0]), drawY = Math.round((door.y + 1) * TILE - asset.door[1]);
      const fullBox = { left: drawX, top: drawY, right: drawX + asset.w, bottom: drawY + asset.h };
      const footBox = Array.isArray(s.foot) ? { left: (s.x + s.foot[0]) * TILE, top: (s.y + s.foot[1]) * TILE, right: (s.x + s.foot[0] + s.foot[2]) * TILE, bottom: (s.y + s.foot[1] + s.foot[3]) * TILE }
        : { left: drawX + foot[0], top: drawY + foot[1], right: drawX + foot[0] + foot[2], bottom: drawY + foot[1] + foot[3] };
      out.push({
        noCollide: s.solid === false || (asset.noCollider && !Array.isArray(s.foot) && s.solid !== true),
        dataFoot: Array.isArray(s.foot),
        id: `cit|${s.t}|${s.x},${s.y}`, lot: { name: '', x: s.x, y: s.y, w: 1, h: 1 }, asset, image: imageFor(asset.file), drawX, drawY, door, name: s.t === 'gatehouse' ? 'Cổng Nội Thành' : s.t.startsWith('tower') ? 'Tháp canh' : 'Quảng trường',
        fullBox, footBox, sortY: footBox.bottom, gate: false, structure: true, solidDoor: asset.kind !== 'gate', noFade: asset.kind === 'prop', district: null, landmark: false, ward: s.ward
      });
    }
    return out;
  }

  function propCandidates(map, config, seed) {
    const names = setNamesForMap(map, config), all = [];
    for (const setName of names) {
      for (const prop of library[setName]?.props || []) all.push({ ...prop, sourceSet: setName });
    }
    const byShape = shape => all.filter(prop => prop.shape === shape).sort((a, b) => hash(`${seed}|${shape}|${a.file}`) - hash(`${seed}|${shape}|${b.file}`));
    const pools = {};
    for (const shape of ['tall', 'wide', 'medium', 'small']) pools[shape] = byShape(shape);
    // Keep the pool small enough that entering a map never starts hundreds of
    // image requests, but retain several silhouettes for handmade variety.
    return Object.fromEntries(Object.entries(pools).map(([shape, values]) => [shape, values.slice(0, shape === 'tall' ? 16 : 24)]));
  }

  function chooseProp(pool, shape, seed, index) {
    const values = pool[shape] || pool.medium || pool.small || [];
    if (!values.length) return null;
    return values[hash(`${seed}|prop|${shape}|${index}`) % values.length];
  }

  function makePropPlacement(prop, cell, index, buildings, points, state) {
    if (!prop || !cell) return null;
    const ward = state.ward?.(cell.x, cell.y);
    if (ward === 'inner' || ward === 'keep' || (ward === 'outer' && prop.shape === 'tall')) return null;
    const w = Number(prop.w) || TILE, h = Number(prop.h) || TILE;
    const drawX = Math.round((cell.x + 0.5) * TILE - w / 2), drawY = Math.round((cell.y + 1) * TILE - h);
    const box = { left: drawX, top: drawY, right: drawX + w, bottom: drawY + h };
    if (state.boxes.some(other => boxesOverlap(box, other))) return null;
    if (buildings.some(building => boxesOverlap(box, building.fullBox))) return null;
    if ((points || []).some(point => distance(point, cell) <= 1)) return null;
    if (state.pathCells.has(key(cell.x, cell.y)) || state.encounterCells.has(key(cell.x, cell.y))) return null;
    if (prop.shape === 'tall' && state.tallCells.some(other => distance(other, cell) < 3)) return null;
    if (isSharedProp(prop) && (state.sharedPlaced + 1) / (state.placed + 1) > (terrainData().sharedPropLimit || 0.3)) return null;
    state.boxes.push(box);
    state.placed++;
    if (isSharedProp(prop)) state.sharedPlaced++;
    if (prop.shape === 'tall') state.tallCells.push(cell);
    const collision = h > 48 && !state.pathCells.has(key(cell.x, cell.y)) && !state.encounterCells.has(key(cell.x, cell.y));
    if (collision) state.collisionCells.add(key(cell.x, cell.y));
    const placement = { id: `${prop.file}|${index}`, prop, image: imageFor(prop.file), cell, drawX, drawY, box, sortY: drawY + h, dynamic: prop.shape === 'tall' || h > 48, collision };
    state.placements.push(placement);
    return placement;
  }

  function makeProps(map, grid, points, buildings, config, path) {
    const wardOf = g.VTN_MAP_LAYOUTS?.citadelOf?.(map) ? (x, y) => g.VTN_MAP_LAYOUTS.citadelZone(map, x, y) : null;
    const seed = `${map?.id || 'map'}|${config?.set || setForMap(map)}`, pool = propCandidates(map, config, seed);
    const state = {
      pathCells: new Set([...(path.cells || []), ...(path.renderCells || [])]),
      encounterCells: new Set(),
      boxes: [],
      tallCells: [],
      placements: [],
      collisionCells: new Set(),
      placed: 0,
      sharedPlaced: 0,
      ward: wardOf
    };
    for (let y = 0; y < grid.length; y++) for (let x = 0; x < (grid[0]?.length || 0); x++) if (grid[y][x] === 2) state.encounterCells.add(key(x, y));
    let index = 0;
    const add = (shape, x, y) => {
      const width = grid[0]?.length || 0, height = grid.length;
      if (!inside(x, y, width, height) || grid[y][x] === 1 || grid[y][x] === 2 || path.cells.has(key(x, y))) return null;
      return makePropPlacement(chooseProp(pool, shape, seed, index), { x, y }, index++, buildings, points, state);
    };

    // Tall silhouettes flank routes at a deliberately irregular 5–9 tile
    // cadence, then recur in small wild clusters.
    for (const route of path.routes) {
      for (let i = 3; i < route.length; i += 5 + (hash(`${seed}|route|${i}`) % 5)) {
        const current = route[i], previous = route[Math.max(0, i - 1)], next = route[Math.min(route.length - 1, i + 1)];
        const dx = Math.sign(next.x - previous.x), dy = Math.sign(next.y - previous.y);
        const choices = Math.abs(dx) > Math.abs(dy) ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
        const side = choices[hash(`${seed}|side|${i}`) % choices.length];
        add('tall', current.x + side[0], current.y + side[1]);
      }
    }
    for (let y = 1; y < grid.length - 1; y++) for (let x = 1; x < (grid[0]?.length || 1) - 1; x++) {
      if (grid[y][x] !== 2) continue;
      if (unit(`${seed}|wild|${x}|${y}`) < 0.035) add('tall', x + (hash(`${seed}|wx|${x}|${y}`) % 3) - 1, y + (hash(`${seed}|wy|${x}|${y}`) % 3) - 1);
      if (unit(`${seed}|clutter|${x}|${y}`) < 0.02) add('medium', x - 1, y);
    }

    // A bridge is a wide prop centered on a one-to-three-tile liquid crossing.
    for (const route of path.routes) {
      let run = [];
      const flush = () => {
        if (run.length && run.length <= 3) add('wide', run[Math.floor(run.length / 2)].x, run[Math.floor(run.length / 2)].y);
        run = [];
      };
      for (const cell of route) {
        if (grid[cell.y]?.[cell.x] === 3) run.push(cell); else flush();
      }
      flush();
    }
    // Wide silhouettes read as settlement fences, railings, and cliff edging.
    // Keep the cadence sparse so they frame routes without turning into walls.
    for (const building of buildings) {
      if (building.structure) continue;
      const lot = building.lot || {};
      const candidates = [
        [Number(lot.x) - 1, Number(lot.y) + Math.floor(Number(lot.h || 5) / 2)],
        [Number(lot.x) + Number(lot.w || 6), Number(lot.y) + Math.floor(Number(lot.h || 5) / 2)],
        [Number(lot.x) + Math.floor(Number(lot.w || 6) / 2), Number(lot.y) - 1],
        [Number(lot.x) + Math.floor(Number(lot.w || 6) / 2), Number(lot.y) + Number(lot.h || 5)]
      ];
      for (const [x, y] of candidates) if (unit(`${seed}|settlement-edge|${building.id}|${x}|${y}`) < 0.72) add('wide', x, y);
    }
    for (let y = 1; y < grid.length - 1; y++) for (let x = 1; x < (grid[0]?.length || 1) - 1; x++) {
      if (grid[y][x] !== 0) continue;
      const nearLiquid = grid[y - 1]?.[x] === 3 || grid[y + 1]?.[x] === 3 || grid[y]?.[x - 1] === 3 || grid[y]?.[x + 1] === 3;
      if (nearLiquid && unit(`${seed}|liquid-edge|${x}|${y}`) < 0.22) add('wide', x, y);
    }
    for (const building of buildings) {
      if (building.structure) continue;
      const door = building.door;
      const offsets = [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1]];
      for (let i = 0; i < offsets.length; i++) {
        const [dx, dy] = offsets[(hash(`${seed}|door|${building.id}|${i}`) % offsets.length)];
        if (add(i % 3 === 0 ? 'small' : 'medium', door.x + dx, door.y + dy)) break;
      }
    }
    const spawn = map?.spawn || { x: 8, y: 8 };
    for (const [dx, dy] of [[-2, -1], [2, -1], [-2, 2], [2, 2]]) add('small', spawn.x + dx, spawn.y + dy);

    const cap = Math.min(120, Math.max(14, Math.floor(state.placed + ((grid.length * (grid[0]?.length || 0)) / 170))));
    for (let y = 1; y < grid.length - 1 && state.placed < cap; y++) for (let x = 1; x < (grid[0]?.length || 1) - 1 && state.placed < cap; x++) {
      if (grid[y][x] !== 0 || path.cells.has(key(x, y))) continue;
      if (unit(`${seed}|filler|${x}|${y}`) < 0.025) add(unit(`${seed}|filler-shape|${x}|${y}`) < 0.65 ? 'small' : 'medium', x, y);
    }
    return { placements: state.placements, collisionCells: state.collisionCells, sharedPlaced: state.sharedPlaced, placed: state.placed, tallPlaced: state.tallCells.length, cap };
  }

  function drawTile(ctx, file, x, y, alpha = 1) {
    const resource = imageFor(file);
    if (!imageReady(resource)) return false;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(resource.image, x, y);
    if (alpha !== 1) ctx.globalAlpha = 1;
    return true;
  }

  const zoneNames = () => g.VTN_MAP_LAYOUTS?.ZONES || { ROAD: 'ROAD', PLAZA: 'PLAZA', GROUND: 'GROUND', WILD: 'WILD', SHORE: 'SHORE', LIQUID: 'LIQUID', WALL: 'WALL' };
  const planZone = (plan, x, y) => plan.zoneGrid?.[y]?.[x] || zoneNames().WALL;
  const roadNeighbor = (plan, x, y) => planZone(plan, x, y) === zoneNames().ROAD;
  function roadMask(plan, x, y) {
    return (roadNeighbor(plan, x, y - 1) ? 1 : 0) | (roadNeighbor(plan, x + 1, y) ? 2 : 0) | (roadNeighbor(plan, x, y + 1) ? 4 : 0) | (roadNeighbor(plan, x - 1, y) ? 8 : 0);
  }
  function roadAngle(orientation) {
    if (orientation === 'vertical' || orientation === 'cap-n' || orientation === 'cap-s' || orientation === 't-junction-n' || orientation === 't-junction-s') return Math.PI / 2;
    if (orientation === 'corner-se') return Math.PI / 2;
    if (orientation === 'corner-sw') return Math.PI;
    if (orientation === 'corner-nw') return Math.PI * 1.5;
    return 0;
  }
  function roadMaskPath(ctx, mask) {
    const core = 11, arm = 15;
    ctx.beginPath();
    ctx.rect(-core, -core, core * 2, core * 2);
    if (mask & 1) ctx.rect(-arm, -16, arm * 2, 16 - core);
    if (mask & 2) ctx.rect(core, -arm, 16 - core, arm * 2);
    if (mask & 4) ctx.rect(-arm, core, arm * 2, 16 - core);
    if (mask & 8) ctx.rect(-16, -arm, 16 - core, arm * 2);
  }
  function drawRoadTexture(ctx, texture, mask, angle, dx, dy) {
    if (!mask) return;
    ctx.save();
    ctx.translate(dx + TILE / 2, dy + TILE / 2);
    roadMaskPath(ctx, mask);
    ctx.clip();
    ctx.rotate(angle);
    ctx.drawImage(texture, -TILE / 2, -TILE / 2);
    ctx.restore();
  }
  function drawRoadTile(ctx, plan, x, y, dx, dy) {
    const texture = plan.pathTexture;
    if (!texture) return;
    const mask = roadMask(plan, x, y), orientation = plan.orientationGrid?.[y]?.[x] || 'horizontal', angle = roadAngle(orientation), horizontalMask = mask & 10, verticalMask = mask & 5;
    // Keep the road shape in map space.  On bends/junctions each arm gets the
    // appropriate quarter-turn variant of the same straight source tile.
    if (horizontalMask && verticalMask) {
      drawRoadTexture(ctx, texture, horizontalMask, 0, dx, dy);
      drawRoadTexture(ctx, texture, verticalMask, Math.PI / 2, dx, dy);
    } else drawRoadTexture(ctx, texture, mask, verticalMask ? Math.PI / 2 : angle, dx, dy);
    ctx.save();ctx.translate(dx+16,dy+16);roadMaskPath(ctx,mask||15);ctx.clip();ctx.fillStyle='rgba(215,181,123,.19)';ctx.fillRect(-16,-16,32,32);ctx.restore();
  }
  function drawRoadCurb(ctx, plan, x, y, dx, dy) {

    const palette = plan.config.palette || {}, color = colorFromHex(palette.roadCurb || palette.cliffShadow, [38, 36, 32]), light = colorFromHex(palette.roadCurbLight || palette.decalDark, [96, 88, 70]);
    const open = { top: !roadNeighbor(plan, x, y - 1), bottom: !roadNeighbor(plan, x, y + 1), left: !roadNeighbor(plan, x - 1, y), right: !roadNeighbor(plan, x + 1, y) };
    ctx.fillStyle = `rgb(${color.join(',')})`;
    if (open.top) ctx.fillRect(dx + 2, dy + 1, TILE - 4, 2);
    if (open.bottom) ctx.fillRect(dx + 2, dy + TILE - 3, TILE - 4, 2);
    if (open.left) ctx.fillRect(dx + 1, dy + 2, 2, TILE - 4);
    if (open.right) ctx.fillRect(dx + TILE - 3, dy + 2, 2, TILE - 4);
    ctx.fillStyle = `rgba(${light.join(',')},.38)`;
    if (open.top) ctx.fillRect(dx + 4, dy + 3, TILE - 8, 1);
    if (open.left) ctx.fillRect(dx + 3, dy + 4, 1, TILE - 8);
  }
  function drawPlazaTile(ctx, plan, x, y, dx, dy) {
    const texture = plan.plazaTexture || plan.pathTexture;
    if (texture) ctx.drawImage(texture, dx, dy);
    const palette = plan.config.palette || {};
    if ((x + y) & 1) { ctx.fillStyle = `rgba(${colorFromHex(palette.plazaLight || palette.decalLight, [190, 177, 140]).join(',')},.10)`; ctx.fillRect(dx, dy, TILE, TILE); }
    const border = colorFromHex(palette.plazaBorder || palette.cliffShadow, [42, 39, 34]);
    ctx.fillStyle = `rgb(${border.join(',')})`;
    const z = zoneNames().PLAZA;
    if (planZone(plan, x, y - 1) !== z) ctx.fillRect(dx + 1, dy, TILE - 2, 2);
    if (planZone(plan, x, y + 1) !== z) ctx.fillRect(dx + 1, dy + TILE - 2, TILE - 2, 2);
    if (planZone(plan, x - 1, y) !== z) ctx.fillRect(dx, dy + 1, 2, TILE - 2);
    if (planZone(plan, x + 1, y) !== z) ctx.fillRect(dx + TILE - 2, dy + 1, 2, TILE - 2);
  }
  function edgeSides(plan, x, y, liquid) {
    const z = zoneNames(), same = side => {
      const [dx, dy] = side === 'top' ? [0, -1] : side === 'bottom' ? [0, 1] : side === 'left' ? [-1, 0] : [1, 0];
      return planZone(plan, x + dx, y + dy) === (liquid ? z.LIQUID : z.LIQUID);
    };
    return { top: same('top'), bottom: same('bottom'), left: same('left'), right: same('right') };
  }
  function drawRotatedEdgePiece(ctx, dx, dy, side, width, height) {
    const angle = side === 'right' ? Math.PI / 2 : side === 'bottom' ? Math.PI : side === 'left' ? Math.PI * 1.5 : 0;
    ctx.save();
    ctx.translate(dx + TILE / 2, dy + TILE / 2);
    ctx.rotate(angle);
    ctx.fillRect(-TILE / 2 + 2, -TILE / 2 + 1, width, height);
    ctx.restore();
  }
  function drawRotatedEdgeMark(ctx, dx, dy, side, along) {
    const angle = side === 'right' ? Math.PI / 2 : side === 'bottom' ? Math.PI : side === 'left' ? Math.PI * 1.5 : 0;
    ctx.save();
    ctx.translate(dx + TILE / 2, dy + TILE / 2);
    ctx.rotate(angle);
    ctx.fillRect(-TILE / 2 + along, -TILE / 2 + 1, 4, 1);
    ctx.restore();
  }
  function drawLiquidShore(ctx, plan, x, y, dx, dy) {
    const z = zoneNames(), zone = planZone(plan, x, y), palette = plan.config.palette || {}, shore = colorFromHex(palette.shoreShadow, [30, 36, 36]), foam = colorFromHex(palette.foam, [164, 202, 188]);
    const sides = edgeSides(plan, x, y, zone === z.LIQUID);
    const edge = zone === z.LIQUID ? side => !sides[side] : side => sides[side];
    ctx.fillStyle = `rgb(${shore.join(',')})`;
    for (const side of ['top', 'bottom', 'left', 'right']) if (edge(side)) {
      drawRotatedEdgePiece(ctx, dx, dy, side, TILE - 4, 3);
    }
    ctx.fillStyle = `rgb(${foam.join(',')})`;
    for (const side of ['top', 'bottom', 'left', 'right']) if (edge(side)) {
      const along = 4 + (hash(`${plan.map.id}|shore|${x}|${y}|${side}`) % 21);
      drawRotatedEdgeMark(ctx, dx, dy, side, along);
    }
  }

  function pathMask(plan, x, y, px, py) {
    const cells = plan.path.renderCells || plan.path.cells;
    const active = cells.has(key(x, y));
    const neighbours = {
      top: cells.has(key(x, y - 1)),
      bottom: cells.has(key(x, y + 1)),
      left: cells.has(key(x - 1, y)),
      right: cells.has(key(x + 1, y))
    };
    return softCellMask(plan.grid, x, y, active, neighbours, px, py);
  }

  function wildMask(plan, x, y, px, py) {
    const z = zoneNames(), zone = planZone(plan, x, y);
    if (zone !== z.WILD) return 0;
    let amount = 1;
    for (const [side, dx, dy, edge] of [['top', 0, -1, py], ['bottom', 0, 1, TILE - 1 - py], ['left', -1, 0, px], ['right', 1, 0, TILE - 1 - px]]) {
      if (planZone(plan, x + dx, y + dy) === z.GROUND) amount = Math.min(amount, edgeFade(edge));
    }
    return amount;
  }

  function preparePlanTextures(plan) {
    if (plan.groundTextures) return;
    const palette = plan.config.palette || {};
    const tiles = plan.config.tiles || {};
    plan.groundTextures = (tiles.ground || []).slice(0, 3).map(file => tintedTile(file, palette.ground, 'ground'));
    plan.pathTexture = tintedTile((tiles.path || [])[0], palette.path, 'path');
    plan.plazaTexture = tintedTile((tiles.plaza || tiles.path || [])[0], palette.plaza || palette.path, 'plaza');
    plan.wildTexture = tintedTile(tiles.wild, palette.wild, 'wild');
    plan.cliffTexture = tintedTile(tiles.cliff || (tiles.ground || [])[0], palette.cliff, 'cliff');
  }

  function groundVariant(plan, x, y) {
    const textures = plan.groundTextures || [];
    if (textures.length < 2) return null;
    const patchTiles = clamp(Number(plan.config.groundPatchTiles) || 8, 6, 14);
    const patch = valueNoise(x, y, `${plan.map.id}|ground-patch`, patchTiles);
    const amount = smoothstep(.34, .66, patch);
    if (amount <= .02) return null;
    const variantNoise = valueNoise(x + 4, y - 3, `${plan.map.id}|ground-variant`, 11);
    const index = 1 + Math.min(textures.length - 2, Math.floor(variantNoise * (textures.length - 1)));
    return { texture: textures[index], amount, index };
  }

  function groundDecal(ctx, plan, x, y) {
    if (planZone(plan, x, y) !== zoneNames().GROUND) return;
    const seed = `${plan.map.id}|decal|${x}|${y}`;
    if (hash(seed) % 23 !== 0) return;
    const palette = plan.config.palette || {};
    const dark = colorFromHex(palette.decalDark, [36, 43, 41]);
    const light = colorFromHex(palette.decalLight, [131, 137, 111]);
    const px = x * TILE + 4 + (hash(`${seed}|x`) % 23), py = y * TILE + 7 + (hash(`${seed}|y`) % 21);
    if (hash(`${seed}|kind`) % 2 === 0) {
      ctx.fillStyle = `rgba(${dark.join(',')},.55)`;
      ctx.fillRect(px, py, 2, 1);
      ctx.fillRect(px + 1, py - 1, 1, 1);
      if (hash(`${seed}|extra`) % 3 === 0) ctx.fillRect(px + 3, py + 2, 1, 1);
    } else {
      ctx.fillStyle = `rgba(${light.join(',')},.48)`;
      ctx.fillRect(px, py, 1, 3);
      ctx.fillRect(px - 1, py + 1, 1, 1);
      ctx.fillRect(px + 1, py, 1, 1);
    }
  }

  /* Make monster habitats readable at a glance: a coloured wash, bright grass tufts and a dotted edge where the habitat ends. */
  function wildAccent(ctx, plan, x, y) {
    const z = zoneNames();
    if (planZone(plan, x, y) !== z.WILD) return;
    const colors = toneColors(plan.config.palette?.wild, [74, 92, 78]), light = colors.light;
    const dx = x * TILE, dy = y * TILE;
    ctx.fillStyle = `rgba(${light.join(',')},.30)`; ctx.fillRect(dx, dy, TILE, TILE);
    for (let i = 0; i < 4; i++) {
      const seed = `${plan.map.id}|accent|${x}|${y}|${i}`, px = dx + 3 + (hash(seed + 'x') % 26), py = dy + 5 + (hash(seed + 'y') % 22);
      ctx.fillStyle = `rgba(${light.join(',')},.85)`; ctx.fillRect(px, py, 1, 4); ctx.fillRect(px - 2, py + 1, 1, 3); ctx.fillRect(px + 2, py + 1, 1, 3);
      ctx.fillStyle = 'rgba(8,14,10,.55)'; ctx.fillRect(px - 1, py + 4, 3, 1);
    }
    const open = {top: planZone(plan, x, y - 1) !== z.WILD, bottom: planZone(plan, x, y + 1) !== z.WILD, left: planZone(plan, x - 1, y) !== z.WILD, right: planZone(plan, x + 1, y) !== z.WILD};
    ctx.fillStyle = `rgba(${light.join(',')},.7)`;
    for (let i = 0; i < TILE; i += 4) {
      if (open.top) ctx.fillRect(dx + i, dy, 2, 2);
      if (open.bottom) ctx.fillRect(dx + i, dy + TILE - 2, 2, 2);
      if (open.left) ctx.fillRect(dx, dy + i, 2, 2);
      if (open.right) ctx.fillRect(dx + TILE - 2, dy + i, 2, 2);
    }
  }
  function wildDecal(ctx, plan, x, y) {
    if (planZone(plan, x, y) !== zoneNames().WILD) return;
    const seed = `${plan.map.id}|wild-decal|${x}|${y}`;
    if (hash(seed) % 3 === 0) return;
    const colors = toneColors(plan.config.palette?.wild, [74, 92, 78]);
    const light = colors.light, shadow = colors.shadow;
    const px = x * TILE + 5 + (hash(`${seed}|x`) % 20);
    const py = y * TILE + 6 + (hash(`${seed}|y`) % 19);
    ctx.fillStyle = `rgba(${shadow.join(',')},.58)`;
    ctx.fillRect(px, py + 2, 1, 4);
    ctx.fillRect(px - 1, py + 5, 3, 1);
    ctx.fillStyle = `rgba(${light.join(',')},.72)`;
    ctx.fillRect(px, py, 1, 3);
    ctx.fillRect(px - 1, py + 1, 1, 1);
    ctx.fillRect(px + 1, py + 1, 1, 1);
    if (hash(`${seed}|second`) % 2 === 0) {
      const sx = x * TILE + 18 + (hash(`${seed}|sx`) % 8);
      const sy = y * TILE + 12 + (hash(`${seed}|sy`) % 11);
      ctx.fillStyle = `rgba(${light.join(',')},.48)`;
      ctx.fillRect(sx, sy, 1, 4);
      ctx.fillRect(sx - 1, sy + 1, 3, 1);
    }
  }

  function computeGroundEdgeContrast(plan, chunks) {
    const snapshots = new Map();
    for (const [id, chunk] of chunks) {
      snapshots.set(id, { data: chunk.ctx.getImageData(0, 0, chunk.canvas.width, chunk.canvas.height).data, width: chunk.canvas.width, height: chunk.canvas.height });
    }
    const pixel = (x, y, px, py) => {
      const cx = Math.floor(x / CHUNK_TILES), cy = Math.floor(y / CHUNK_TILES), snapshot = snapshots.get(`${cx},${cy}`);
      if (!snapshot) return [0, 0, 0];
      const lx = (x - cx * CHUNK_TILES) * TILE + px, ly = (y - cy * CHUNK_TILES) * TILE + py;
      const offset = (ly * snapshot.width + lx) * 4;
      return [snapshot.data[offset], snapshot.data[offset + 1], snapshot.data[offset + 2]];
    };
    const width = plan.size.width, height = plan.size.height;
    const inCity = (x, y) => !!plan.citadel && g.VTN_MAP_LAYOUTS.inCitadel(plan.map, x, y);
    const isGround = (x, y) => planZone(plan, x, y) === zoneNames().GROUND && !inCity(x, y);
    let borders = 0, highContrast = 0;
    const compare = (x, y, nx, ny, horizontal) => {
      if (!isGround(x, y) || !isGround(nx, ny)) return;
      borders++;
      let total = 0, count = 0;
      for (let i = 4; i < TILE - 4; i++) {
        const a = horizontal ? pixel(x, y, TILE - 1, i) : pixel(x, y, i, TILE - 1);
        const b = horizontal ? pixel(nx, ny, 0, i) : pixel(nx, ny, i, 0);
        total += (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
        count++;
      }
      if (total / Math.max(1, count) > GROUND_EDGE_THRESHOLD) highContrast++;
    };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (x + 1 < width) compare(x, y, x + 1, y, true);
      if (y + 1 < height) compare(x, y, x, y + 1, false);
    }
    return { threshold: GROUND_EDGE_THRESHOLD, borders, highContrast, ratio: borders ? highContrast / borders : 0 };
  }

  function citadelFiles(map) {
    const kit = g.VTN_KINGDOM, c = g.VTN_MAP_LAYOUTS?.citadelOf?.(map), rk = regionKit(c);
    if (rk) return [rk.wall.cap.file, rk.wall.body.file, ...(rk.wall.caps || []).map(t => t.file), ...(rk.wall.bodies || []).map(t => t.file), ...Object.values(rk.floor).flat()];
    if (!kit || !c) return [];
    return [kit.wall.inner.file, kit.wall.outer.file, kit.courtyard.file];
  }
  function blobKey(isWall, x, y) {
    const n = (dx, dy) => isWall(x + dx, y + dy);
    const T_ = n(0, -1), R = n(1, 0), B = n(0, 1), L = n(-1, 0);
    const TR = T_ && R && n(1, -1), BR = B && R && n(1, 1), BL = B && L && n(-1, 1), TL = T_ && L && n(-1, -1);
    return [T_, TR, R, BR, B, BL, L, TL].map(v => v ? 1 : 2).join(',');
  }
  // Ground of the two wards: paved cobbles in the outer ward, flagstone slabs (with a cobbled avenue) in the inner ward.
  function drawCitadelGround(plan, chunkFor, scope = null) {
    const geo = plan.citadel, rk = regionKit(geo?.c);
    if (rk) {
      const I0 = geo.c.inner, O0 = geo.c.outer, paving = geo.c.paving || [];
      // later zones win; a zone with `every` only claims every n-th cell (medallions along an avenue)
      const pavingAt = (x, y, base) => {
        let out = base;
        for (const z of paving) {
          const inside = z.poly ? g.VTN_MAP_LAYOUTS.wardContains(z, x, y) : (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);
          if (!inside || !rk.floor[z.floor]) continue;
          if (z.every && ((x - z.x) % z.every || (y - z.y) % z.every)) continue;
          out = { list: rk.floor[z.floor], dim: z.dim ?? (out?.dim ?? (rk.dim || [.42, .58])[0]) };
        }
        return out;
      };
      const paintFloor = (ctx, dx, dy, x, y, f) => {
        if (!f) return;
        const img = imageFor(f.list[hash(`${x},${y}|f`) % f.list.length])?.image; if (img) ctx.drawImage(img, dx, dy);
        if (f.dim) { ctx.fillStyle = `rgba(14,8,30,${f.dim})`; ctx.fillRect(dx, dy, 32, 32); }
      };
      for (let y = O0.y; y < O0.y + O0.h; y++) for (let x = O0.x; x < O0.x + O0.w; x++) {
        if (scope && !scope(x, y)) continue;
        if ((geo.wall.has(key(x, y)) && !rk.wall.pieces) || plan.grid[y]?.[x] === 3 || !g.VTN_MAP_LAYOUTS.wardContains(O0, x, y)) continue;   // edge-drawn walls stand on paving
        const cx = Math.floor(x / CHUNK_TILES), cy = Math.floor(y / CHUNK_TILES), ctx = chunkFor(cx, cy).ctx, dx = (x - cx * CHUNK_TILES) * TILE, dy = (y - cy * CHUNK_TILES) * TILE;
        const inner = g.VTN_MAP_LAYOUTS.wardContains(I0, x, y), avenue = !paving.length && Math.abs(x - 58) <= 2 && (inner || y >= I0.y + I0.h);
        const street = paving.length && rk.floor.avenue && plan.path?.renderCells?.has(key(x, y));
        const base = street ? { list: rk.floor.avenue, dim: .12 } : { list: (inner || avenue) ? rk.floor.slab : rk.floor.cobble, dim: avenue ? .05 : inner ? (rk.dim || [.42, .58])[0] : (rk.dim || [.42, .58])[1] };
        paintFloor(ctx, dx, dy, x, y, pavingAt(x, y, base));
      }
      // canals, ponds and moat: kit water tiles with a stone rim where they meet land
      if (rk.floor.water && geo.water?.size) for (const k of geo.water) {
        const [x, y] = k.split(',').map(Number); if (scope && !scope(x, y)) continue; const cx = Math.floor(x / CHUNK_TILES), cy = Math.floor(y / CHUNK_TILES), ctx = chunkFor(cx, cy).ctx, dx = (x - cx * CHUNK_TILES) * TILE, dy = (y - cy * CHUNK_TILES) * TILE;
        const img = imageFor(rk.floor.water[hash(`${x},${y}|w`) % rk.floor.water.length])?.image; if (img) ctx.drawImage(img, dx, dy);
        ctx.fillStyle = 'rgba(10,6,30,.25)'; ctx.fillRect(dx, dy, 32, 32);
        const dry = (ax, ay) => !geo.water.has(key(ax, ay));
        ctx.fillStyle = '#3a2c4a';
        if (dry(x, y - 1)) ctx.fillRect(dx, dy, 32, 5);
        if (dry(x, y + 1)) ctx.fillRect(dx, dy + 29, 32, 3);
        if (dry(x - 1, y)) ctx.fillRect(dx, dy, 3, 32);
        if (dry(x + 1, y)) ctx.fillRect(dx + 29, dy, 3, 32);
        ctx.fillStyle = 'rgba(190,160,220,.35)';
        if (dry(x, y - 1)) ctx.fillRect(dx, dy + 5, 32, 1);
      }
      // paving zones that run outside the walls (approach avenues, plazas in front of gates)
      for (const z of paving) if (z.outside) for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) {
        if (scope && !scope(x, y)) continue;
        if (g.VTN_MAP_LAYOUTS.inCitadel(plan.map, x, y) || geo.wall.has(key(x, y)) || plan.grid[y]?.[x] === 3 || plan.grid[y]?.[x] === undefined) continue;
        const cx = Math.floor(x / CHUNK_TILES), cy = Math.floor(y / CHUNK_TILES), ctx = chunkFor(cx, cy).ctx, dx = (x - cx * CHUNK_TILES) * TILE, dy = (y - cy * CHUNK_TILES) * TILE;
        paintFloor(ctx, dx, dy, x, y, pavingAt(x, y, null));
      }
      for (const K of geo.c.keeps || []) for (let y = K.y; y < K.y + K.h; y++) for (let x = K.x; x < K.x + K.w; x++) {
        if (scope && !scope(x, y)) continue;
        if (geo.wall.has(key(x, y)) || plan.grid[y]?.[x] === 3 || !g.VTN_MAP_LAYOUTS.wardContains(K, x, y)) continue;
        const cx = Math.floor(x / CHUNK_TILES), cy = Math.floor(y / CHUNK_TILES), ctx = chunkFor(cx, cy).ctx, dx = (x - cx * CHUNK_TILES) * TILE, dy = (y - cy * CHUNK_TILES) * TILE;
        paintFloor(ctx, dx, dy, x, y, pavingAt(x, y, { list: rk.floor.slab, dim: (rk.dim || [.42, .58])[0] }));
      }
      return;
    }
    const kit = g.VTN_KINGDOM;
    if (!geo || !kit) return;
    const court = imageFor(kit.courtyard.file)?.image, I = geo.c.inner, O = geo.c.outer;
    for (let y = O.y; y < O.y + O.h; y++) for (let x = O.x; x < O.x + O.w; x++) {
      if (scope && !scope(x, y)) continue;
      if (geo.wall.has(key(x, y)) || plan.grid[y]?.[x] === 3 || !g.VTN_MAP_LAYOUTS.wardContains(O, x, y)) continue;
      const cx = Math.floor(x / CHUNK_TILES), cy = Math.floor(y / CHUNK_TILES), ctx = chunkFor(cx, cy).ctx, dx = (x - cx * CHUNK_TILES) * TILE, dy = (y - cy * CHUNK_TILES) * TILE;
      const inner = g.VTN_MAP_LAYOUTS.wardContains(I, x, y);
      const avenue = inner && (Math.abs(x - 58) <= 3 || y >= I.y + I.h - 3);
      ctx.drawImage(court, (hash(`${x},${y}|c`) % 2) * 32, (inner ? (avenue ? 1 : 0) : 1) * 32, 32, 32, dx, dy, 32, 32);
      if (!inner) { ctx.fillStyle = 'rgba(12,8,24,.34)'; ctx.fillRect(dx, dy, 32, 32); }
    }
  }
  // Sprite walls (per-region kit): a front-facing battlement tile along the north/south bands, a body tile down the side bands.
  // Polygon wards: walk every edge and lay the wall piece that matches its direction (front run, end-on run, "/" or "\" run).
  function edgeWallPieces(geo, R, t, ward, rk, outer) {
    const P = R.poly, pcs = rk.wall.pieces, caps = rk.wall.caps || [rk.wall.cap], out = [], shift = (t - 1) / 2;
    const onOuter = (x, y) => { if (!outer || outer === R) return false; const Q = outer.poly; for (let i = 0; i < Q.length; i++) { const [ax, ay] = Q[i], [bx, by] = Q[(i + 1) % Q.length], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)); if (Math.hypot(ax + u * dx - x, ay + u * dy - y) < .35) return true; } return false; };
    const gateNear = (px, py, r = 1) => { const cx = Math.floor(px / TILE), cy = Math.floor(py / TILE); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (geo.open.has(key(cx + dx, cy + dy))) return true; return false; };
    for (let i = 0; i < P.length; i++) {
      const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
      if (len < .01 || onOuter((ax + bx) / 2, (ay + by) / 2)) continue;
      let nx = -dy / len, ny = dx / len;                                    // inward normal (tested against the ward itself)
      if (!g.VTN_MAP_LAYOUTS.wardContains(R, Math.floor((ax + bx) / 2 + nx * .7), Math.floor((ay + by) / 2 + ny * .7))) { nx = -nx; ny = -ny; }
      const A = [(ax + nx * shift) * TILE, (ay + ny * shift) * TILE], B = [(bx + nx * shift) * TILE, (by + ny * shift) * TILE];
      const drop = shift * TILE;                                           // pieces stand on the near (lower) half of the band
      if (Math.abs(dy) < 1e-6) {                                            // east-west run: front-facing battlements, one 32-px column per tile
        const baseY = Math.round(Math.max(A[1], B[1]) + drop), c0 = Math.round(Math.min(ax, bx)), c1 = Math.round(Math.max(ax, bx));
        for (let cx = c0; cx < c1; cx++) { if (gateNear(cx * TILE + 16, baseY - 8, 0)) continue; const f = caps[((cx % caps.length) + caps.length) % caps.length]; out.push({ f, x: cx * TILE, y: baseY - f.h, by: Math.floor((baseY - 1) / TILE), sortY: baseY - 1, ward }); }
        continue;
      }
      if (Math.abs(dx) < 1e-6) {                                            // north-south run seen end-on: stack the side pieces
        const f = pcs.v, x = A[0], y0 = Math.min(A[1], B[1]), y1 = Math.max(A[1], B[1]);
        for (let y = y0 + TILE; y <= y1 + 1; y += TILE) { if (gateNear(x, y - 16, 1)) continue; out.push({ f, x: Math.round(x - f.ax), y: Math.round(y + drop * .25 - f.ay), by: Math.floor((y - 1) / TILE), sortY: y - 1, ward }); }
        continue;
      }
      const L = A[0] <= B[0] ? A : B, Rt = A[0] <= B[0] ? B : A, rising = Rt[1] < L[1], f = rising ? pcs.d1 : pcs.d2;
      const n = Math.max(1, Math.round((Rt[0] - L[0]) / (f.run[0] * .8)));
      for (let k = 0; k < n; k++) {
        const px = L[0] + (Rt[0] - L[0]) * (k + .5) / n, py = L[1] + (Rt[1] - L[1]) * (k + .5) / n + drop * .5;
        if (gateNear(px, py - 16, 1)) continue;
        out.push({ f, x: Math.round(px - f.ax), y: Math.round(py - f.ay), by: Math.floor(py / TILE), sortY: py, ward });
      }
    }
    return out;
  }
  function drawSpriteWalls(plan, chunkFor, rk) {
    const geo = plan.citadel, c = geo.c, draws = [];
    const bands = [[c.outer, c.outerThickness || 1, 'outer'], [c.inner, c.innerThickness || 2, 'inner'], ...(c.keeps || []).map((K, i) => [K, K.thickness || 2, 'keep' + i])];
    const pickTile = (list, one, x) => (list && list.length ? list[((x % list.length) + list.length) % list.length] : one);
    for (const [R, t, ward] of bands) if (R?.poly && rk.wall.pieces) draws.push(...edgeWallPieces(geo, R, t, ward, rk, c.outer));
    for (const [R, t, ward] of bands) {
      if (R?.poly && rk.wall.pieces) continue;
      for (const cell of geo.wall.keys()) {
        if (geo.wall.get(cell) !== ward) continue;
        const [x, y] = cell.split(',').map(Number), top = y - R.y < t, bottom = R.y + R.h - 1 - y < t;
        if (R.poly) { const cap = geo.wall.get(key(x, y + 1)) !== ward, f = cap ? pickTile(rk.wall.caps, rk.wall.cap, x) : pickTile(rk.wall.bodies, rk.wall.body, y); draws.push({ f, x: x * TILE, y: (y + 1) * TILE - f.h, by: y }); }
        else if (top || bottom) { if ((top && y === R.y + t - 1) || (bottom && y === R.y + R.h - 1)) { const f = pickTile(rk.wall.caps, rk.wall.cap, x); draws.push({ f, x: x * TILE, y: (y + 1) * TILE - f.h, by: y }); } }
        else { const f = pickTile(rk.wall.bodies, rk.wall.body, y); draws.push({ f, x: x * TILE, y: (y + 1) * TILE - f.h, by: y }); }
      }
    }
    draws.sort((a, b) => (a.sortY ?? a.by * TILE) - (b.sortY ?? b.by * TILE) || a.x - b.x);
    if (!chunkFor) { plan.wallDraws = draws; for (const d of draws) imageFor(d.f.file); return; }   // drawn y-sorted with the actors
    const cols = Math.ceil(plan.size.width / CHUNK_TILES), rows = Math.ceil(plan.size.height / CHUNK_TILES);
    for (const d of draws) {
      const im = imageFor(d.f.file)?.image; if (!im) continue;
      const minCx = Math.max(0, Math.floor(d.x / CHUNK_PX)), maxCx = Math.min(cols - 1, Math.floor((d.x + d.f.w - 1) / CHUNK_PX)), minCy = Math.max(0, Math.floor(d.y / CHUNK_PX)), maxCy = Math.min(rows - 1, Math.floor((d.y + d.f.h - 1) / CHUNK_PX));
      for (let cy = minCy; cy <= maxCy; cy++) for (let cx = minCx; cx <= maxCx; cx++) chunkFor(cx, cy).ctx.drawImage(im, d.x - cx * CHUNK_PX, d.y - cy * CHUNK_PX);
    }
  }
  function drawCitadel(plan, chunkFor) {
    const geo = plan.citadel, rk0 = regionKit(geo?.c);
    if (rk0) { if (!plan.wallDraws) { plan.wallDraws = []; drawSpriteWalls(plan, null, rk0); } return; }
    const kit = g.VTN_KINGDOM;
    if (!geo || !kit) return;
    for (const [cell, ward] of geo.wall) {
      const [x, y] = cell.split(',').map(Number), def = kit.wall[ward], sheet = imageFor(def.file)?.image;
      const k = blobKey((xx, yy) => geo.wall.get(key(xx, yy)) === ward, x, y), id = def.map[k] ?? 0;
      const cx = Math.floor(x / CHUNK_TILES), cy = Math.floor(y / CHUNK_TILES), ctx = chunkFor(cx, cy).ctx;
      ctx.drawImage(sheet, (id % def.cols) * 32, Math.floor(id / def.cols) * 32, 32, 32, (x - cx * CHUNK_TILES) * TILE, (y - cy * CHUNK_TILES) * TILE, 32, 32);
    }
  }

  // Chunks are baked on demand (Unity-style streaming): `ids` = the chunk ids to bake now; others are skipped.
  const NOOP_CHUNK = { ctx: new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } }) };
  function chunkIdsAround(plan, tx, ty, rx = 2, ry = 2) {
    const cols = Math.ceil(plan.size.width / CHUNK_TILES), rows = Math.ceil(plan.size.height / CHUNK_TILES), cx = Math.floor(tx / CHUNK_TILES), cy = Math.floor(ty / CHUNK_TILES), out = [];
    for (let y = Math.max(0, cy - ry); y <= Math.min(rows - 1, cy + ry); y++) for (let x = Math.max(0, cx - rx); x <= Math.min(cols - 1, cx + rx); x++) out.push(`${x},${y}`);
    return out;
  }
  function allChunkIds(plan) { return chunkIdsAround(plan, 0, 0, 999, 999); }
  function buildChunks(plan, ids = null) {
    if (typeof document === 'undefined') return;
    const { width, height } = plan.size, cols = Math.ceil(width / CHUNK_TILES), rows = Math.ceil(height / CHUNK_TILES);
    plan.chunks ??= new Map();
    const chunks = plan.chunks, want = new Set((ids || allChunkIds(plan)).filter(id => !chunks.has(id)));
    if (!want.size) return;
    const scope = (x, y) => want.has(`${Math.floor(x / CHUNK_TILES)},${Math.floor(y / CHUNK_TILES)}`);
    const fresh = new Map();
    const chunkFor = (cx, cy) => {
      const id = `${cx},${cy}`;
      if (!want.has(id)) return NOOP_CHUNK;
      if (fresh.has(id)) return fresh.get(id);
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(CHUNK_TILES, width - cx * CHUNK_TILES) * TILE;
      canvas.height = Math.min(CHUNK_TILES, height - cy * CHUNK_TILES) * TILE;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      fresh.set(id, { canvas, ctx, cx, cy });
      return fresh.get(id);
    };
    preparePlanTextures(plan);
    const grid = plan.grid, cfg = plan.config, tiles = cfg.tiles, ground = tiles.ground || [];
    const cells = [];
    for (const id of want) { const [cx, cy] = id.split(',').map(Number); for (let y = cy * CHUNK_TILES; y < Math.min(height, (cy + 1) * CHUNK_TILES); y++) for (let x = cx * CHUNK_TILES; x < Math.min(width, (cx + 1) * CHUNK_TILES); x++) cells.push(x, y); }
    for (let n = 0; n < cells.length; n += 2) {
      const x = cells[n], y = cells[n + 1];
      const cx = Math.floor(x / CHUNK_TILES), cy = Math.floor(y / CHUNK_TILES), chunk = chunkFor(cx, cy), ctx = chunk.ctx;
      const dx = (x - cx * CHUNK_TILES) * TILE, dy = (y - cy * CHUNK_TILES) * TILE, tile = grid[y]?.[x] ?? 1;
      const baseGround = materialPatch(plan.groundTextures?.[0] || imageFor(ground[0])?.image,x,y);
      if (baseGround) ctx.drawImage(baseGround, dx, dy);
      const variant = groundVariant(plan, x, y);
      if (variant?.texture) drawDithered(ctx, materialPatch(variant.texture,x,y), dx, dy, () => variant.amount, `${plan.map.id}|ground-blend|${x}|${y}`);
      if (tile === 1) {
        if (plan.cliffTexture) ctx.drawImage(plan.cliffTexture, dx, dy);
        const cliffBase = colorFromHex(cfg.palette?.cliff?.base, [42, 54, 49]);
        ctx.fillStyle = `rgba(${cliffBase.join(',')},.30)`;
        ctx.fillRect(dx, dy, TILE, TILE);
        const cliff = colorFromHex(cfg.palette?.cliffShadow, [7, 10, 15]);
        ctx.fillStyle = `rgba(${cliff.join(',')},.24)`;
        ctx.fillRect(dx, dy, TILE, TILE);
        const edge = colorFromHex(cfg.palette?.cliffEdge, [150, 143, 116]);
        ctx.fillStyle = `rgba(${edge.join(',')},.50)`;
        for (let i = 0; i < 6; i++) {
          const rx = dx + 4 + (hash(`${plan.map.id}|rock|${x}|${y}|${i}|x`) % 23);
          const ry = dy + 4 + (hash(`${plan.map.id}|rock|${x}|${y}|${i}|y`) % 23);
          ctx.fillRect(rx, ry, 2 + (i % 3), 1 + (i % 2));
          if (i % 2 === 0) ctx.fillRect(rx + 1, ry - 1, 1, 1);
        }
        for (const [side, open] of Object.entries({
          top: grid[y - 1]?.[x] !== 1,
          bottom: grid[y + 1]?.[x] !== 1,
          left: grid[y]?.[x - 1] !== 1,
          right: grid[y]?.[x + 1] !== 1
        })) if (open) {
          for (let i = 3; i < TILE - 3; i += 5 + (hash(`${plan.map.id}|cliff|${x}|${y}|${side}|${i}`) % 4)) {
            if (side === 'top') ctx.fillRect(dx + i, dy + (hash(`${x}|${y}|${i}`) % 3), 2, 1);
            if (side === 'bottom') ctx.fillRect(dx + i, dy + TILE - 1 - (hash(`${x}|${y}|${i}`) % 3), 2, 1);
            if (side === 'left') ctx.fillRect(dx + (hash(`${x}|${y}|${i}`) % 3), dy + i, 1, 2);
            if (side === 'right') ctx.fillRect(dx + TILE - 1 - (hash(`${x}|${y}|${i}`) % 3), dy + i, 1, 2);
          }
        }
      } else if (tile === 3) {
        drawTile(ctx, tiles.liquid, dx, dy);
      } else if (tile === 2) {
        if (plan.wildTexture) drawDithered(ctx, plan.wildTexture, dx, dy, (px, py) => wildMask(plan, x, y, px, py), `${plan.map.id}|wild-edge|${x}|${y}`);
        else drawTile(ctx, tiles.wild, dx, dy);
      }
      groundDecal(ctx, plan, x, y);
      wildDecal(ctx, plan, x, y);
      wildAccent(ctx, plan, x, y);
    }
    drawCitadelGround(plan, chunkFor, scope);
    // Transitions are a separate deterministic pass: no ground variant or
    // decal can leak into a road/plaza, and a bridge can cleanly cover water.
    for (let n = 0; n < cells.length; n += 2) {
      const x = cells[n], y = cells[n + 1];
      const cx = Math.floor(x / CHUNK_TILES), cy = Math.floor(y / CHUNK_TILES), chunk = chunkFor(cx, cy), ctx = chunk.ctx;
      const dx = (x - cx * CHUNK_TILES) * TILE, dy = (y - cy * CHUNK_TILES) * TILE, zone = planZone(plan, x, y);
      if (zone === zoneNames().LIQUID || zone === zoneNames().SHORE) drawLiquidShore(ctx, plan, x, y, dx, dy);
      if (plan.citadel && (regionKit(plan.citadel.c) ? g.VTN_MAP_LAYOUTS.citadelZone(plan.map, x, y) !== 'rim' : g.VTN_MAP_LAYOUTS.citadelZone(plan.map, x, y) === 'inner')) continue;
      if (zone === zoneNames().PLAZA) drawPlazaTile(ctx, plan, x, y, dx, dy);
      if (zone === zoneNames().ROAD) { drawRoadTile(ctx, plan, x, y, dx, dy); drawRoadCurb(ctx, plan, x, y, dx, dy); }
    }
    drawCitadel(plan, chunkFor);
    for (const prop of plan.props.placements.filter(item => !item.dynamic)) {
      const resource = imageFor(prop.prop.file);
      if (!imageReady(resource)) continue;
      const minCx = Math.max(0, Math.floor(prop.box.left / CHUNK_PX)), maxCx = Math.min(cols - 1, Math.floor((prop.box.right - 1) / CHUNK_PX));
      const minCy = Math.max(0, Math.floor(prop.box.top / CHUNK_PX)), maxCy = Math.min(rows - 1, Math.floor((prop.box.bottom - 1) / CHUNK_PX));
      for (let cy = minCy; cy <= maxCy; cy++) for (let cx = minCx; cx <= maxCx; cx++) {
        const chunk = chunkFor(cx, cy);
        chunk.ctx.drawImage(resource.image, prop.drawX - cx * CHUNK_PX, prop.drawY - cy * CHUNK_PX);
      }
    }
    for (const [id, chunk] of fresh) chunks.set(id, chunk);
    plan.groundEdgeContrast = null;   // QA-only metric, computed lazily by edgeContrastOf()
  }
  // bake a few more chunks within a time budget (called once per frame after drawing)
  function streamChunks(plan, budgetMs = 5) {
    if (!plan.pendingChunks?.length) return;
    const t0 = performance.now();
    while (plan.pendingChunks.length && performance.now() - t0 < budgetMs) buildChunks(plan, [plan.pendingChunks.shift()]);
  }
  function bakeAll(plan) { if (plan.pendingChunks?.length) { buildChunks(plan, plan.pendingChunks); plan.pendingChunks = []; } }

  function edgeContrastOf(plan) {
    if (plan.groundEdgeContrast || !plan.chunks) return plan.groundEdgeContrast;
    bakeAll(plan);
    try { plan.groundEdgeContrast = computeGroundEdgeContrast(plan, plan.chunks); }
    catch (error) { plan.groundEdgeContrast = { threshold: GROUND_EDGE_THRESHOLD, borders: 1, highContrast: 0, ratio: 0, unavailable: true }; }
    return plan.groundEdgeContrast;
  }
  function allAssetsReady(plan) {
    const entries = plan.files.map(file => imageFor(file));
    const missing = entries.filter(entry => entry.status === 'missing').length;
    const ready = entries.filter(imageReady).length;
    plan.assetStats = { total: entries.length, ready, missing };
    const bake = (plan.bakeFiles || plan.files).map(file => imageFor(file));
    return bake.every(entry => imageReady(entry) || entry.status === 'missing');
  }

  const forestSilhouettes=['J049','J053','J054','J055'].map(id=>'assets/world/region_01/props/'+id+'.png');
  const markerSprites={portal:'J029',clue:'J082',puzzle:'J081',legendary:'J082',shrine:'J006','abyss-memory':'J083'};
  function nativeMarker(ctx,point,dx,dy){
    const id=markerSprites[point.type];if(!id)return false;
    const resource=imageFor('assets/world/region_01/props/'+id+'.png');if(!imageReady(resource))return false;
    const im=resource.image,w=im.naturalWidth,h=im.naturalHeight;
    ctx.drawImage(im,Math.round(dx+16-w/2),dy+32-h,w,h);return true;
  }
  function forestCanopies(map,grid,buildings){
    if(map.regionId!=='region_01')return [];
    const result=[];
    for(let y=1;y<grid.length-1;y+=2)for(let x=1;x<grid[0].length-1;x+=2){
      if(grid[y][x]!==1||hash(map.id+'|canopy|'+x+','+y)%4===0)continue;
      if(buildings.some(b=>x*32>=b.drawX-32&&x*32<b.drawX+b.asset.w+32&&y*32>=b.drawY-16&&y*32<b.drawY+b.asset.h+16))continue;
      result.push({x,y,file:forestSilhouettes[hash(x+','+y)%forestSilhouettes.length]});
    }
    return result;
  }
  // occ = coarse opacity grid of a sprite (tools/art/compute_colliders.py): hex per row, bit c = column c
  function occAt(occ, c, r) {
    if (c < 0 || r < 0 || c >= occ.w || r >= occ.h) return 0;
    const row = occ.rows[r], d = row.length - 1 - (c >> 2);
    return d < 0 ? 0 : (parseInt(row[d], 16) >> (c & 3)) & 1;
  }
  // every tile whose area is at least half covered by the opaque picture
  function coveredTiles(occ, drawX, drawY, out, minShare = .5) {
    const S8 = occ.s, x0 = Math.floor(drawX / TILE), y0 = Math.floor(drawY / TILE), x1 = Math.floor((drawX + occ.w * S8 - 1) / TILE), y1 = Math.floor((drawY + occ.h * S8 - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      let hit = 0;
      for (let py = ty * TILE; py < (ty + 1) * TILE; py += S8) for (let px = tx * TILE; px < (tx + 1) * TILE; px += S8)
        hit += occAt(occ, Math.floor((px + S8 / 2 - drawX) / S8), Math.floor((py + S8 / 2 - drawY) / S8));
      if (hit / ((TILE / S8) * (TILE / S8)) >= minShare) out.push([tx, ty]);
    }
    return out;
  }
  // Colliders must never cut a door, NPC or portal off from the spawn: open the fewest collider cells along a grid path.
  function ensureReachable(map, grid, points, cells, protectedCells = new Set()) {
    const H = grid.length, W = grid[0]?.length || 0, spawn = map?.spawn || g.VTN_MAP_LAYOUTS?.SPAWN || { x: 8, y: 8 };
    const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && grid[y][x] !== 1 && grid[y][x] !== 3;
    const flood = () => { const seen = new Uint8Array(W * H), q = [spawn.y * W + spawn.x]; seen[q[0]] = 1; for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!free(nx, ny)) continue; const j = ny * W + nx; if (seen[j] || cells.has(key(nx, ny))) continue; seen[j] = 1; q.push(j); } } return seen; };
    let reach = flood(); const relieved = [];
    for (const p of points || []) {
      const px = Math.round(p.x), py = Math.round(p.y); if (!free(px, py)) continue;
      const targets = [[px, py], [px, py + 1], [px - 1, py], [px + 1, py], [px, py - 1]].filter(([x, y]) => free(x, y));
      if (targets.some(([x, y]) => reach[y * W + x])) continue;
      // grid-only BFS from the point back to the reachable area, then clear colliders on that path
      const prev = new Int32Array(W * H).fill(-1), start = py * W + px, q = [start]; prev[start] = start; let hit = -1;
      for (let i = 0; i < q.length && hit < 0; i++) { const c = q[i], x = c % W, y = (c - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!free(nx, ny) || protectedCells.has(key(nx, ny))) continue; const j = ny * W + nx; if (prev[j] >= 0) continue; prev[j] = c; if (reach[j]) { hit = j; break; } q.push(j); } }
      if (hit < 0) continue;
      for (let c = hit; c !== start; c = prev[c]) { const x = c % W, y = (c - x) / W; if (cells.delete(key(x, y))) relieved.push(key(x, y)); }
      if (cells.delete(key(px, py))) relieved.push(key(px, py));
      reach = flood();
    }
    cells.relieved = relieved;
    return cells;
  }
  function createPlan(info) {
    const map = info.map, config = configForMap(map);
    if (!config?.tiles) return null;
    const grid = info.grid, points = info.points || [], lotBuildings = makeBuildings(map, grid, points, config), structures = makeStructures(map), buildings = lotBuildings.concat(structures);
    const path = pathNetwork(map, grid, points, lotBuildings), zoneModel = path.zones || g.VTN_MAP_LAYOUTS?.zoneModel?.(map, grid, points, { extraEndpoints: lotBuildings.map(building => building.door), plazaSources: lotBuildings, carveRoads: true });
    if (zoneModel) { path.zones = zoneModel; path.cells = new Set(zoneModel.roadCells); path.renderCells = new Set(zoneModel.roadCells); }
    const props = makeProps(map, grid, points, buildings, config, path),canopies=forestCanopies(map,grid,buildings);
    let wallDraws = null;
    const files = [...new Set([
      ...filesForConfig(config),
      ...buildings.map(building => building.asset.file), ...citadelFiles(map),
      ...props.placements.map(prop => prop.prop.file),...canopies.map(tree=>tree.file),...Object.values(markerSprites).map(id=>'assets/world/region_01/props/'+id+'.png')
    ])];
    for (const file of files) imageFor(file);
    // only what gets baked into the static chunks gates "ready"; buildings and tall props pop in as their images arrive
    const bakeFiles = [...new Set([...filesForConfig(config), ...citadelFiles(map), ...props.placements.filter(prop => !prop.dynamic).map(prop => prop.prop.file)])];
    return {
      bakeFiles,
      map,
      config,
      grid,
      points,
      size: grid?.length ? { width: grid[0].length, height: grid.length } : mapSize(map),
      buildings,
      path,
      zoneModel,
      zoneGrid: zoneModel?.zones || null,
      orientationGrid: zoneModel?.orientations || null,
      props,canopies,citadel: g.VTN_MAP_LAYOUTS?.citadelGeometry?.(map) || null,
      get wallDraws() { return this._wallDraws ?? wallDraws; }, set wallDraws(v) { this._wallDraws = v; },
      files,
      chunks: null,
      ready: false,
      assetStats: { total: files.length, ready: 0, missing: 0 },
      doorCells: new Set(buildings.filter(building => !building.solidDoor).map(building => key(building.door.x, building.door.y))),
      collisionCells: (() => {
        const cells = new Set(), soft = new Set(), T2 = TILE * TILE;
        for (const building of buildings) {
          if (building.noCollide) continue;
          // decor (trees, lamps, statues, forest dressing) may be opened to keep a door or NPC reachable; houses, towers and walls never
          const hard = !building.structure || building.asset.kind === 'tower' || building.asset.kind === 'gate' || building.asset.kind === 'building';
          const b = building.footBox, x0 = Math.floor(b.left / TILE), x1 = Math.floor((b.right - 1) / TILE), y0 = Math.floor(b.top / TILE), y1 = Math.floor((b.bottom - 1) / TILE);
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const ow = Math.min(b.right, (x + 1) * TILE) - Math.max(b.left, x * TILE), oh = Math.min(b.bottom, (y + 1) * TILE) - Math.max(b.top, y * TILE);
            if (ow * oh < T2 * .35) continue;          // a sliver of a footprint does not block a whole tile
            if (building.solidDoor || key(x, y) !== key(building.door.x, building.door.y)) { cells.add(key(x, y)); if (!hard) soft.add(key(x, y)); }
          }
        }
        const geo = g.VTN_MAP_LAYOUTS?.citadelGeometry?.(map), rkw = regionKit(geo?.c);
        if (geo && rkw) {
          const tmp = { citadel: geo, size: { width: grid[0].length, height: grid.length } };
          drawSpriteWalls(tmp, null, rkw); wallDraws = tmp.wallDraws || [];
          for (const d of wallDraws) { if (d.f.occ) { for (const [x, y] of coveredTiles(d.f.occ, d.x, d.y, [])) cells.add(key(x, y)); continue; } const tx = Math.floor(d.x / TILE); for (let ty = Math.floor(d.y / TILE); ty <= d.by; ty++) { const cover = Math.min((ty + 1) * TILE, d.y + d.f.h) - Math.max(ty * TILE, d.y); if (cover >= TILE / 2) cells.add(key(tx, ty)); } }
        }
        const protectedCells = new Set([...cells].filter(k => !soft.has(k)));
        for (const k of props.collisionCells) cells.add(k);
        for (const tree of canopies || []) cells.add(key(Math.round(tree.x), Math.round(tree.y)));
        if (geo) { for (const k of geo.open) cells.delete(k); for (const [hx, hy] of geo.hubs || []) cells.delete(key(hx, hy)); }
        for (const building of buildings) cells.delete(key(building.door.x, building.door.y + 1));   // the step in front of every door
        return ensureReachable(map, grid, points, cells, protectedCells);
      })()
    };
  }

  function getPlan(info) {
    const mapId = info?.map?.id;
    if (!mapId) return null;
    let plan = plans.get(mapId);
    if (!plan) {
      const t0 = performance.now(); plan = createPlan(info); if (plan) plan.timing = { plan: Math.round(performance.now() - t0) };
      if (plan) plans.set(mapId, plan);
    }
    if (!plan) return null;
    plan.points = info.points || plan.points;
    plan.grid = info.grid || plan.grid;
    if (!plan.ready && allAssetsReady(plan)) {
      const t1 = performance.now(), hx = Number(info.px) || 0, hy = Number(info.py) || 0;
      buildChunks(plan, chunkIdsAround(plan, hx, hy, 1, 1));
      const hcx = Math.floor(hx / CHUNK_TILES), hcy = Math.floor(hy / CHUNK_TILES);
      plan.pendingChunks = allChunkIds(plan).filter(id => !plan.chunks.has(id)).sort((a, b) => { const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number); return Math.hypot(ax - hcx, ay - hcy) - Math.hypot(bx - hcx, by - hcy); });
      plan.timing = { ...(plan.timing || {}), chunks: Math.round(performance.now() - t1) };
      plan.ready = !!plan.chunks;
    }
    return plan;
  }

  function opaqueMaskFor(building) {
    const file = building?.asset?.file;
    if (!file || typeof document === 'undefined') return null;
    if (opaqueMaskCache.has(file)) return opaqueMaskCache.get(file);
    const resource = building.image;
    if (!imageReady(resource)) return null;
    const width = Math.max(1, Math.round(Number(building.asset.w) || resource.image.naturalWidth || TILE)), height = Math.max(1, Math.round(Number(building.asset.h) || resource.image.naturalHeight || TILE));
    try {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false; context.drawImage(resource.image, 0, 0, width, height);
      const alpha = context.getImageData(0, 0, width, height).data, mask = new Uint8Array(width * height); let maxAlpha = 0;
      for (let i = 0; i < mask.length; i++) { mask[i] = alpha[i * 4 + 3]; if (mask[i] > maxAlpha) maxAlpha = mask[i]; }
      const result = { width, height, mask, maxAlpha, unavailable: false }; opaqueMaskCache.set(file, result); return result;
    } catch {
      const result = { width, height, mask: null, maxAlpha: 255, unavailable: true }; opaqueMaskCache.set(file, result); return result;
    }
  }
  function buildingHasOpaqueOverlap(building, heroBox) {
    if (!boxesOverlap(building.fullBox, heroBox)) return false;
    const mask = opaqueMaskFor(building); if (!mask?.mask) return true;
    const left = Math.max(building.fullBox.left, Math.floor(heroBox.left)), right = Math.min(building.fullBox.right, Math.ceil(heroBox.right)), top = Math.max(building.fullBox.top, Math.floor(heroBox.top)), bottom = Math.min(building.fullBox.bottom, Math.ceil(heroBox.bottom));
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) { const ix = Math.floor((x - building.drawX) * mask.width / Math.max(1, building.fullBox.right - building.fullBox.left)), iy = Math.floor((y - building.drawY) * mask.height / Math.max(1, building.fullBox.bottom - building.fullBox.top)); if (mask.mask[iy * mask.width + ix] > 8) return true; }
    return false;
  }
  function fadeBuildingFor(plan, heroBox, heroFeetY, heroCenterX, heroCenterY, heroHeight, now) {
    plan.fadeState ||= new Map();
    const radius = Math.max(1, heroHeight * 1.5), candidates = plan.buildings.filter(building => !building.noFade && heroFeetY < building.sortY && buildingHasOpaqueOverlap(building, heroBox)).map(building => ({ building, distance: Math.hypot((building.fullBox.left + building.fullBox.right) / 2 - heroCenterX, (building.fullBox.top + building.fullBox.bottom) / 2 - heroCenterY) })).filter(value => value.distance <= radius).sort((a, b) => a.distance - b.distance);
    const active = candidates[0]?.building || null;
    const audit = [];
    for (const building of plan.buildings) {
      const state = plan.fadeState.get(building.id) || { alpha: 1, last: now };
      const distance = active === building ? candidates[0].distance : radius * 2;
      const soft = active === building ? 1 - smoothstep(radius * .55, radius, distance) : 0;
      const target = active === building ? 1 - .45 * soft : 1;
      const step = clamp((now - state.last) / .15, 0, 1); state.alpha += (target - state.alpha) * step; state.last = now; state.target = target; plan.fadeState.set(building.id, state);
      const mask = opaqueMaskFor(building); audit.push({ id: building.id, alpha: state.alpha, target, sourceSampleAlpha: mask?.maxAlpha ?? 255, maskUnavailable: !!mask?.unavailable, fadeActive: active === building });
    }
    plan.buildingFadeAudit = audit; return active;
  }
  function drawDynamicProp(ctx, placement) {
    const resource = imageFor(placement.prop.file);
    if (!imageReady(resource)) return false;
    ctx.save();
    // Tall props are opaque and sharp.  Only a building can enter the
    // deliberate hero-behind-building fade path below.
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.drawImage(resource.image, placement.drawX, placement.drawY);
    ctx.restore();
    return true;
  }

  function drawBuilding(ctx, building, alpha = 1) {
    if (!imageReady(building.image)) return false;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = 'none';
    if (building.asset.frames > 1) { const fw = building.asset.w, frame = Math.floor(performance.now() / 160) % building.asset.frames; ctx.drawImage(building.image.image, frame * fw, 0, fw, building.asset.h, building.drawX, building.drawY, fw, building.asset.h); }
    else ctx.drawImage(building.image.image, building.drawX, building.drawY);
    ctx.restore();
    return true;
  }

  function renderAtmosphere(ctx, canvas, info, now) {
    // Atmosphere is particle-only.  A post-map fog/vignette changed source
    // building pixels and made the P9-F terrain look washed out.
    for (let i = 0; i < 22; i++) {
      const x = (i * 137 + now * 3) % canvas.width;
      const y = (i * 79 + Math.sin(now * .8 + i) * 7) % canvas.height;
      ctx.fillStyle = i % 5 === 0 ? 'rgba(235,184,104,.48)' : 'rgba(207,224,199,.20)';
      ctx.fillRect(Math.round(x), Math.round(y), i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
    }
  }

  // Camera, Cinemachine-style: critically damped follow (Unity SmoothDamp) + look-ahead along the hero's velocity + a HARD ZONE
  // that never lets the hero leave the middle of the screen (so a fast auto-run can not outrun the view) + centring when the whole
  // map fits in the viewport ("Toàn cảnh").
  const smoothDamp = (cur, target, vel, smoothTime, dt) => {
    const omega = 2 / smoothTime, x = omega * dt, e = 1 / (1 + x + .48 * x * x + .235 * x * x * x), change = cur - target, temp = (vel + omega * change) * dt;
    return [target + (change + temp) * e, (vel - omega * temp) * e];
  };
  function smoothCamera(map, targetX, targetY, now) {
    const VW = targetX.viewportW, VH = targetY.viewportH, mapW = (Number(map.width) || 40) * TILE, mapH = (Number(map.height) || 30) * TILE;
    const place = (pos, view, total) => (total <= view ? -(view - total) / 2 : clamp(pos, 0, total - view));
    if (mapW <= VW + 1 && mapH <= VH + 1) {                                  // the whole map is on screen: the camera stays put, centred
      cameraState = { ...cameraState, mapId: map.id, lastAt: now, hx: targetX.x + VW / 2, hy: targetY.y + VH / 2, x: 0, y: 0, vx: 0, vy: 0, lx: 0, ly: 0, hvx: 0, hvy: 0, renderX: Math.round(place(0, VW, mapW)), renderY: Math.round(place(0, VH, mapH)) };
      return { x: cameraState.renderX, y: cameraState.renderY };
    }
    const hcx = targetX.x + VW / 2, hcy = targetY.y + VH / 2;               // hero centre in world px
    const st = cameraState;
    if (st.mapId !== map.id || !st.lastAt || Math.hypot(hcx - st.hx, hcy - st.hy) > Math.max(VW, VH)) {
      cameraState = { mapId: map.id, x: targetX.x, y: targetY.y, vx: 0, vy: 0, lastAt: now, hx: hcx, hy: hcy, hvx: 0, hvy: 0, lx: 0, ly: 0 };
      const x = place(targetX.x, VW, mapW), y = place(targetY.y, VH, mapH);
      cameraState.renderX = Math.round(x); cameraState.renderY = Math.round(y);
      return { x: cameraState.renderX, y: cameraState.renderY };
    }
    const dt = clamp(now - st.lastAt, 1 / 240, .1);
    st.lastAt = now;
    const k = Math.min(1, dt * 14);
    st.hvx += ((hcx - st.hx) / dt - st.hvx) * k; st.hvy += ((hcy - st.hy) / dt - st.hvy) * k; st.hx = hcx; st.hy = hcy;
    const lookX = clamp(st.hvx * .2, -.17 * VW, .17 * VW), lookY = clamp(st.hvy * .2, -.17 * VH, .17 * VH), kl = Math.min(1, dt * 6);
    st.lx += (lookX - st.lx) * kl; st.ly += (lookY - st.ly) * kl;
    const wantX = hcx + st.lx - VW / 2, wantY = hcy + st.ly - VH / 2;
    [st.x, st.vx] = smoothDamp(st.x, wantX, st.vx, .075, dt);
    [st.y, st.vy] = smoothDamp(st.y, wantY, st.vy, .075, dt);
    // hard zone: hero stays within 26% of the half-size from the screen centre, whatever the speed
    const limX = .26 * VW, limY = .26 * VH, offX = hcx - (st.x + VW / 2), offY = hcy - (st.y + VH / 2);
    if (offX > limX) st.x = hcx - limX - VW / 2; else if (offX < -limX) st.x = hcx + limX - VW / 2;
    if (offY > limY) st.y = hcy - limY - VH / 2; else if (offY < -limY) st.y = hcy + limY - VH / 2;
    cameraState.renderX = Math.round(place(st.x, VW, mapW)); cameraState.renderY = Math.round(place(st.y, VH, mapH));
    return { x: cameraState.renderX, y: cameraState.renderY };
  }

  // Built once per plan; anything costly is a getter so it only runs when QA reads it (inspect/debug), never per frame.
  function updateDebug(plan, info) {
    if (plan.debugInfo) { lastDebug = plan.debugInfo; return lastDebug; }
    const old = oldPropsCounts(info.map.regionId), total = plan.props.placed || 0;
    lastDebug = plan.debugInfo = {
      regionId: info.map.regionId,
      mapId: info.map.id,
      scriptState: 'loaded',
      tilesetLoaded: true,
      assetsReady: true,
      tallAvailable: old.tall,
      propAvailable: old.prop,
      tallSprites: plan.props.tallPlaced,
      fallbackTrees: info.map.regionId === 'region_01' ? 1 : 0,
      alphaAnchors: old.tall,
      tallPlaced: plan.props.tallPlaced,
      tallCap: plan.props.cap,
      tallRestricted: 0,
      worldLibrary: true,
      worldLibraryState: 'ready',
      librarySet: setForMap(info.map),
      worldImagesTotal: plan.assetStats.total,
      worldImagesLoaded: plan.assetStats.ready,
      worldImagesMissing: plan.assetStats.missing,
      staticChunks: plan.chunks?.size || 0,
      buildingsPlaced: plan.buildings.length,
      propsPlaced: total,
      sharedProps: plan.props.sharedPlaced,
      sharedPropRatio: total ? plan.props.sharedPlaced / total : 0,
      pathTiles: (plan.path.renderCells || plan.path.cells).size,
      zoneStats: plan.zoneModel?.stats || {},
      roadOrientations: plan.orientationGrid || [],
      buildingFadeAudit: plan.buildingFadeAudit || [],
      collisionProps: plan.props.collisionCells.size,
    };
    return lastDebug;
  }

  function render(ctx, canvas, info, callbacks = {}) {
    const plan = getPlan(info);
    if (!plan) {
      lastDebug = { ...lastDebug, worldLibrary: false, worldLibraryState: 'unconfigured' };
      return false;
    }
    if (!plan.ready) {
      const entries = plan.files.map(imageFor), ready = entries.filter(imageReady).length;
      lastDebug = {
        ...lastDebug,
        worldLibrary: true,
        worldLibraryState: entries.some(entry => entry.status === 'missing') ? 'missing' : 'loading',
        librarySet: setForMap(info.map),
        worldImagesTotal: entries.length,
        worldImagesLoaded: ready,
        worldImagesMissing: entries.filter(entry => entry.status === 'missing').length,
        assetsReady: false
      };
      return false;
    }
    const frameStart = performance.now();
    const now = frameStart / 1000;
    const Z = g.VTNViewZoom(canvas, info.map);
    const VW = canvas.width / Z, VH = canvas.height / Z;
    const heroX = Number.isFinite(info.heroRenderX) ? info.heroRenderX : info.px;
    const heroY = Number.isFinite(info.heroRenderY) ? info.heroRenderY : info.py;
    const camera = smoothCamera(info.map, {x: heroX*TILE-VW/2+16, viewportW: VW}, {y: heroY*TILE-VH/2+16, viewportH: VH}, now), camX = camera.x, camY = camera.y;
    const x0 = Math.floor(camX / CHUNK_PX) - 1, x1 = Math.ceil((camX + VW) / CHUNK_PX) + 1;
    const y0 = Math.floor(camY / CHUNK_PX) - 1, y1 = Math.ceil((camY + VH) / CHUNK_PX) + 1;
    ctx.imageSmoothingEnabled = Z < .85;   // zoomed out: smooth down-scaling instead of aliased pixels
    ctx.imageSmoothingQuality = 'medium';
    ctx.fillStyle = '#080d12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(Z, Z);
    ctx.translate(-camX, -camY);
    { // streaming: anything on screen is baked now, the rest a few chunks per frame
      const cols = Math.ceil(plan.size.width / CHUNK_TILES), rows = Math.ceil(plan.size.height / CHUNK_TILES), missing = [];
      for (let cy = Math.max(0, y0); cy <= Math.min(rows - 1, y1); cy++) for (let cx = Math.max(0, x0); cx <= Math.min(cols - 1, x1); cx++) if (!plan.chunks.has(`${cx},${cy}`)) missing.push(`${cx},${cy}`);
      if (missing.length) {
        // nearest first; a wide view (many chunks missing) is baked over several frames instead of one long stall
        const ccx = (camX + VW / 2) / CHUNK_PX, ccy = (camY + VH / 2) / CHUNK_PX;
        missing.sort((a, b) => { const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number); return Math.hypot(ax + .5 - ccx, ay + .5 - ccy) - Math.hypot(bx + .5 - ccx, by + .5 - ccy); });
        buildChunks(plan, missing.slice(0, missing.length > 10 ? 6 : 10));
        plan.pendingChunks = (plan.pendingChunks || []).filter(id => !plan.chunks.has(id));
      } else streamChunks(plan, 4);
    }
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const chunk = plan.chunks.get(`${cx},${cy}`);
      if (chunk) ctx.drawImage(chunk.canvas, cx * CHUNK_PX, cy * CHUNK_PX);
    }

    const actorX = heroX * TILE + 16, actorY = heroY * TILE + TILE;
    const heroBox = { left: actorX - 13, top: actorY - 50, right: actorX + 13, bottom: actorY + 3 };
    fadeBuildingFor(plan, heroBox, actorY, actorX, actorY - (heroBox.bottom - heroBox.top) / 2, heroBox.bottom - heroBox.top, now);
    const drawables = [];
    for (const building of plan.buildings) {
      if (building.drawX + building.asset.w < camX - 80 || building.drawX > camX + VW + 80 || building.drawY + building.asset.h < camY - 80 || building.drawY > camY + VH + 80) continue;
      drawables.push({ sortY: building.sortY, priority: 2, building });
    }
    for (const prop of plan.props.placements.filter(item => item.dynamic)) {
      if (prop.box.right < camX - 80 || prop.box.left > camX + VW + 80 || prop.box.bottom < camY - 80 || prop.box.top > camY + VH + 80) continue;
      drawables.push({ sortY: prop.sortY, priority: 1, prop });
    }
    for (const point of info.points || []) {
      if (point.type === 'building' || point.type === 'boss-gate' || point.type === 'anchor') continue;
      drawables.push({ sortY: (point.renderY ?? point.y) * TILE + TILE - 1, priority: 3, point });
    }
    for (const wall of plan.wallDraws || []) {
      if (wall.x + wall.f.w < camX - 40 || wall.x > camX + VW + 40 || wall.y + wall.f.h < camY - 40 || wall.y > camY + VH + 40) continue;
      drawables.push({ sortY: wall.sortY ?? (wall.by + 1) * TILE - 1, priority: 0, wall });
    }
    for(const tree of plan.canopies||[])if(tree.x*TILE>camX-100&&tree.x*TILE<camX+VW+100&&tree.y*TILE>camY-100&&tree.y*TILE<camY+VH+100)drawables.push({sortY:tree.y*TILE+TILE,priority:1,canopy:tree});
    drawables.push({ sortY: heroY * TILE + TILE - 1, priority: 4, hero: true });
    drawables.sort((a, b) => a.sortY - b.sortY || a.priority - b.priority);
    for (const drawable of drawables) {
      if (drawable.wall) { const r = imageFor(drawable.wall.f.file); if (imageReady(r)) ctx.drawImage(r.image, drawable.wall.x, drawable.wall.y); continue; }
      if(drawable.canopy){
        const tree=drawable.canopy,resource=imageFor(tree.file);
        if(imageReady(resource)){const im=resource.image,x=tree.x*TILE+16,y=tree.y*TILE+32;ctx.save();if(Math.abs(heroX-tree.x)<1.2&&heroY<tree.y&&heroY>tree.y-2)ctx.globalAlpha=.5;ctx.drawImage(im,Math.round(x-im.naturalWidth/2),y-im.naturalHeight,im.naturalWidth,im.naturalHeight);ctx.restore();}
      } else if (drawable.building) {
        drawBuilding(ctx, drawable.building, plan.fadeState?.get(drawable.building.id)?.alpha ?? 1);
      } else if (drawable.prop) {
        drawDynamicProp(ctx, drawable.prop);
      } else if (drawable.point) {
        const point = drawable.point, dx = (point.renderX ?? point.x) * TILE, dy = (point.renderY ?? point.y) * TILE;
        if (point.type === 'npc' || point.type === 'rival') {
          if (!callbacks.drawNpc?.(ctx, point, dx, dy, info.S, now)) info.hero?.(dx, dy, point.type === 'rival' ? '#788da0' : '#9da47e');
        } else {
          if(!nativeMarker(ctx,point,dx,dy))callbacks.landmark?.(ctx, dx, dy, {
            type: point.type === 'boss' || point.type === 'arena' || point.type === 'final-boss' || point.type === 'abyss-boss' ? 'boss_altar' : point.type === 'portal' || point.type === 'legendary' ? 'portal' : point.type === 'shop' ? 'shop' : 'shrine'
          }, info.mapArt, info.tick);
        }
      } else if (drawable.hero) {
        const moving = !!info.heroMoving;
        const frame = moving ? 1 + (Math.floor((info.heroWalkDistance || 0) * 3) % 2) : 0;
        if (!callbacks.drawHero?.(ctx, info, heroX * TILE, heroY * TILE, frame)) info.hero?.(heroX * TILE, heroY * TILE, info.S?.hero?.corruption >= 60 ? '#715276' : '#a96652');
      }
    }
    ctx.font = `600 ${Math.round(13 / Z * 10) / 10}px 'VTN UI',sans-serif`;
    ctx.textAlign = 'center';
    for (const point of info.points || []) {
      const rx = point.renderX ?? point.x, ry = point.renderY ?? point.y;
      if (Math.abs(rx - info.px) + Math.abs(ry - info.py) >= 6) continue;
      const labelY = ry * TILE + (point.type === 'npc' || point.type === 'rival' ? -6 : -30);
      ctx.fillStyle = '#070b0dcc'; ctx.fillText(point.name, rx * TILE + 17, labelY + 1 / Z);
      ctx.fillStyle = point.type === 'rival' ? '#c9d4dc' : '#ead9a5'; ctx.fillText(point.name, rx * TILE + 16, labelY);
    }
    ctx.textAlign = 'start';
    ctx.restore();
    renderAtmosphere(ctx, canvas, info, now);
    updateDebug(plan, info);
    lastDebug.camera={x:camX,y:camY,zoom:Z};
    lastDebug.cameraX=camX; lastDebug.cameraY=camY;
    lastDebug.heroWorldX=heroX*TILE+16; lastDebug.heroWorldY=heroY*TILE+TILE;
    lastDebug.heroScreenX=Math.round((heroX*TILE+16-camX)*Z); lastDebug.heroScreenY=Math.round((heroY*TILE+TILE-camY)*Z);
    lastDebug.frameRenderMs = performance.now() - frameStart;
    return true;
  }

  // QA-only numbers that cost real time; never computed per frame
  function heavyDebug(mapId) {
    const plan = plans.get(mapId); if (!plan?.ready) return {};
    allAssetsReady(plan);
    return {
      smallProps: plan.props.placements.filter(prop => !prop.dynamic).length,
      landmarkBuildings: plan.buildings.filter(building => building.landmark).length,
      liquidPathTiles: [...(plan.path.renderCells || plan.path.cells)].filter(cell => { const [x, y] = cell.split(',').map(Number); return plan.grid[y]?.[x] === 3; }).length,
      groundEdgeContrast: edgeContrastOf(plan) || { threshold: GROUND_EDGE_THRESHOLD, borders: 0, highContrast: 0, ratio: 0 },
      doorsClear: plan.buildings.every(building => !plan.props.placements.some(prop => boxesOverlap(prop.box, { left: building.door.x * TILE, top: building.door.y * TILE, right: (building.door.x + 1) * TILE, bottom: (building.door.y + 1) * TILE }))),
      worldImagesLoaded: plan.assetStats.ready, worldImagesMissing: plan.assetStats.missing, staticChunks: plan.chunks?.size || 0
    };
  }
  function inspect(mapId) {
    const plan = plans.get(mapId);
    if (!plan) return { ...lastDebug };
    return {
      ...lastDebug,
      ...heavyDebug(mapId),
      worldLibraryState: plan.ready ? 'ready' : 'loading',
      mapId: plan.map.id,
      librarySet: setForMap(plan.map),
       buildings: plan.buildings.map(building => ({ id: building.id, name: building.name, gate: building.gate, landmark: building.landmark, door: building.door, foot: building.footBox, file: building.asset.file, district: building.district, alpha: plan.fadeState?.get(building.id)?.alpha ?? 1, sourceSampleAlpha: opaqueMaskFor(building)?.maxAlpha ?? 255 })),
      props: plan.props.placements.map(prop => ({ file: prop.prop.file, shape: prop.prop.shape, cell: prop.cell, collision: prop.collision, dynamic: prop.dynamic, box: prop.box })),
      pathTiles: [...(plan.path.renderCells || plan.path.cells)].map(value => value.split(',').map(Number)),
       zoneGrid: plan.zoneGrid || [],
       roadOrientations: plan.orientationGrid || [],
       zoneStats: plan.zoneModel?.stats || {},
       buildingFadeAudit: plan.buildingFadeAudit || [],
      groundEdgeContrast: edgeContrastOf(plan) || { threshold: GROUND_EDGE_THRESHOLD, borders: 0, highContrast: 0, ratio: 0 },
      collisionCells: [...plan.collisionCells],
      encounterRatio: (() => { let walk = 0, encounter = 0; for (let y = 0; y < plan.grid.length; y++) for (let x = 0; x < plan.grid[y].length; x++) { if (plan.citadel && g.VTN_MAP_LAYOUTS.inCitadel(plan.map, x, y)) continue; const tile = plan.grid[y][x]; if (walkable(tile)) walk++; if (tile === 2) encounter++; } return walk ? encounter / walk : 0; })()
    };
  }

  // QA helper: render a tile rectangle (static chunks + buildings + props) to a PNG data URL.
  function snapshot(mapId, rect = {}) {
    const plan = plans.get(mapId);
    if (!plan || !plan.ready) return null;
    const x0 = (rect.x ?? 0) * TILE, y0 = (rect.y ?? 0) * TILE, w = (rect.w ?? plan.size.width) * TILE, h = (rect.h ?? plan.size.height) * TILE, scale = rect.scale || 1;
    const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.scale(scale, scale); ctx.translate(-x0, -y0);
    bakeAll(plan);
    for (const chunk of plan.chunks.values()) ctx.drawImage(chunk.canvas, chunk.cx * CHUNK_PX, chunk.cy * CHUNK_PX);
    const list = [...plan.buildings.map(b => ({ y: b.sortY, b })), ...plan.props.placements.filter(p => p.dynamic).map(p => ({ y: p.sortY, p })), ...(plan.wallDraws || []).map(w => ({ y: w.sortY ?? (w.by + 1) * TILE - 1, w }))].sort((a, b) => a.y - b.y);
    for (const d of list) { if (d.w) { const r = imageFor(d.w.f.file); if (imageReady(r)) ctx.drawImage(r.image, d.w.x, d.w.y); } else if (d.b) drawBuilding(ctx, d.b, 1); else drawDynamicProp(ctx, d.p); }
    return c.toDataURL('image/png');
  }

  function isTileBlocked(map, x, y) {
    const plan = plans.get(map?.id);
    if (!plan) return false;
    const cell = key(Math.round(x), Math.round(y));
    if (plan.doorCells.has(cell)) return false;
    return plan.collisionCells.has(cell);
  }

  const previousWorld = g.VTNWorld || {};
  g.VTNWorld = Object.assign(previousWorld, { buildingName, worldLibrary: true });
  g.VTNWorldLibrary = {
    ready: mapId => !!plans.get(mapId)?.ready,
    blockedCells: mapId => plans.get(mapId)?.collisionCells || null,
    heavyDebug,
    timing: mapId => plans.get(mapId)?.timing || null,
    render,
    inspect,
    isTileBlocked,
    snapshot,
    buildingName,
    reset(mapId) { if (mapId) plans.delete(mapId); else plans.clear(); cameraState = { mapId: null, x: 0, y: 0, vx: 0, vy: 0, lastAt: 0, renderX: null, renderY: null }; },
    debug: () => ({ ...lastDebug })
  };
})(typeof window !== 'undefined' ? window : globalThis);
