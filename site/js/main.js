import { RACES_40 } from './data/races_data.js';
import { MONSTERS_200 } from './data/monsters_data.js';
import { MONSTER_TIERS, IV_RANKS, MONSTER_PERSONALITIES, getElementMultiplier, PLAYER_CLASSES, EQUIPMENT_DB, CONSUMABLES_DB } from './data/items_classes.js';
import { WORLD_MAPS } from './data/maps_landmarks.js';
import { NPCS_DATA, KY_NGO_EVENTS, BANDIT_ENCOUNTERS } from './data/npcs_events.js';
import { drawHeroSprite } from './engine/sprites.js';
import { audio } from './engine/audio.js';
import { drawConcept } from './engine/concepts.js';
import { expandWorld, EVENT_SPECIES, QUESTS } from './data/expansion.js';
import { encodeSave, decodeSave, saveLocal, readLocal, connectMap, initiativeProbability, questProgress } from './engine/systems.js';
import { drawWorldTile, drawLandmark, drawAtmosphere } from './engine/world-art.js';
expandWorld();
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const MAP_W = 32;
const MAP_H = 32;
const TILE = 32;

const state = {
  started: false,
  tick: 0,
  selectedRaceId: 'r_01',
  selectedClassId: 'covenant_knight',
  selectedStarterId: 'm_001',
  hero: {
    name: 'Wuann',
    race: RACES_40[0],
    cls: PLAYER_CLASSES[0],
    level: 1,
    exp: 0,
    nextExp: 100,
    statPoints: 4,
    stats: { STR: 14, CON: 14, DEF: 13, SPD: 8, DEX: 9, INT: 7, WIS: 9, CHA: 10 },
    hp: 150,
    maxHp: 150,
    mp: 45,
    maxMp: 45,
    hearts: 3,
    maxHearts: 5,
    gold: 200,
    equip: {
      weapon: { ...EQUIPMENT_DB[0], plus: 0 },
      armor: { ...EQUIPMENT_DB[8], plus: 0 },
      relic: null
    },
    bag: {
      item_ash_potion: 3,
      item_ether_dew: 2,
      item_beast_salve: 3,
      item_seal_basic: 5,
      item_seal_silver: 2,
      item_seal_crimson: 1,
      item_ash_heart: 1
    },
    materials: {}
  },
  party: [],
  storage: [], visited: ['map_central_ash'], wins: 0, bosses: [],
  claimed: [], decisions: {}, reputation: 0, questClaims: [], steps: 0, lastAnomaly: -100, ending: null,
  seenMonsters: new Set(['m_001', 'm_002', 'm_004']),
  caughtMonsters: new Set(),
  currentMapId: 'map_central_ash',
  px: 9,
  py: 9,
  dir: 'down',
  mapTiles: {},
  battle: null
};

function createMonsterInstance(speciesId, level = 2, forcedTier = null) {
  const sp = MONSTERS_200.find(m => m.id === speciesId) || MONSTERS_200[0];
  let tierIdx = forcedTier !== null ? forcedTier : sp.defaultTier;
  if (forcedTier === null && Math.random() < 0.22) {
    tierIdx = Math.min(9, tierIdx + (Math.random() < 0.3 ? 2 : 1));
  }
  const tier = MONSTER_TIERS[tierIdx];
  const iv = IV_RANKS[Math.floor(Math.random() * IV_RANKS.length)];
  const pers = MONSTER_PERSONALITIES[Math.floor(Math.random() * MONSTER_PERSONALITIES.length)];

  const growth = tier.growthMult * iv.mult * (1 + (pers.growthBonus || 0));
  const calc = (base, multPerLv, pMult) => Math.max(5, Math.round((base + (level - 1) * multPerLv * growth) * pMult));

  const maxHp = calc(sp.baseHp, 14, pers.hp);
  return {
    uid: 'mon_' + Math.random().toString(36).slice(2, 9),
    speciesId: sp.id,
    code: sp.code,
    name: sp.name,
    element: sp.element,
    level,
    exp: 0,
    nextExp: level * 65,
    tierIdx,
    tier,
    iv,
    personality: pers,
    maxHp,
    hp: maxHp,
    atk: calc(sp.baseAtk, 4.2, pers.atk),
    def: calc(sp.baseDef, 3.8, pers.def),
    mag: calc(sp.baseMag, 4.2, pers.mag),
    spd: calc(sp.baseSpd, 3.6, pers.spd)
  };
}

function getEffectiveHeroStats() {
  const s = { ...state.hero.stats };
  const rMods = state.hero.race.statMods || {};
  for (const k of Object.keys(s)) s[k] += (rMods[k] || 0);
  for (const slot of ['weapon', 'armor', 'relic']) {
    const eq = state.hero.equip[slot];
    if (eq && eq.bonuses) {
      for (const [k, v] of Object.entries(eq.bonuses)) {
        s[k] = (s[k] || 0) + v + (eq.plus || 0);
      }
    }
  }
  return s;
}

function recalcHeroVitals(full = false) {
  const s = getEffectiveHeroStats();
  const armHp = state.hero.equip.armor ? (state.hero.equip.armor.hpBonus + state.hero.equip.armor.plus * 18) : 0;
  state.hero.maxHp = 60 + s.CON * 9 + state.hero.level * 14 + armHp;
  state.hero.maxMp = 20 + s.WIS * 4 + s.INT * 2 + state.hero.level * 5;
  if (full) {
    state.hero.hp = state.hero.maxHp;
    state.hero.mp = state.hero.maxMp;
  } else {
    state.hero.hp = Math.min(state.hero.hp, state.hero.maxHp);
    state.hero.mp = Math.min(state.hero.mp, state.hero.maxMp);
  }
}

function buildMapGrid(mapDef) {
  if (state.mapTiles[mapDef.id]) return state.mapTiles[mapDef.id];
  const grid = Array.from({ length: MAP_H }, (_, y) =>
    Array.from({ length: MAP_W }, (_, x) => {
      if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) return 1;
      const n = Math.sin(x * 0.45 + y * 0.31 + mapDef.id.length) + Math.cos(x * 0.22 - y * 0.48);
      if (n > 1.35) return 3;
      if (n > 0.25) return 2;
      return 0;
    })
  );
  for (const lm of mapDef.landmarks) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const ny = lm.y + dy, nx = lm.x + dx;
        if (ny > 0 && ny < MAP_H - 1 && nx > 0 && nx < MAP_W - 1) grid[ny][nx] = 0;
      }
    }
  }
  for (const npc of NPCS_DATA.filter(n => n.mapId === mapDef.id)) {
    grid[npc.y][npc.x] = 0;
  }
  connectMap(grid, [...mapDef.landmarks,...NPCS_DATA.filter(n=>n.mapId===mapDef.id)]);
  state.mapTiles[mapDef.id] = grid;
  return grid;
}

function logMsg(html) {
  const feed = document.getElementById('event-feed');
  if (!feed) return;
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = html;
  feed.prepend(div);
  while (feed.children.length > 45) feed.removeChild(feed.lastChild);
}

function updateHUD() {
  recalcHeroVitals(false);
  const mapDef = WORLD_MAPS.find(m => m.id === state.currentMapId) || WORLD_MAPS[0];
  document.getElementById('hud-identity').textContent = `${state.hero.name} • ${state.hero.race.code} ${state.hero.race.name} • ${state.hero.cls.name}`;
  const fullH = '♥'.repeat(state.hero.hearts);
  const emptyH = '♡'.repeat(Math.max(0, state.hero.maxHearts - state.hero.hearts));
  document.getElementById('hud-hearts').textContent = fullH + emptyH;
  document.getElementById('hud-gold').textContent = state.hero.gold;
  document.getElementById('hud-map').textContent = mapDef.name;

  document.getElementById('side-hero-name').textContent = `${state.hero.name} (${state.hero.cls.name})`;
  document.getElementById('side-hero-lv').textContent = `LV.${state.hero.level} (${state.hero.exp}/${state.hero.nextExp})`;
  document.getElementById('side-hero-hp').textContent = `${state.hero.hp}/${state.hero.maxHp}`;
  document.getElementById('side-hero-mp').textContent = `${state.hero.mp}/${state.hero.maxMp}`;
  document.getElementById('side-hero-hp-bar').style.width = `${Math.max(0, (state.hero.hp / state.hero.maxHp) * 100)}%`;
  document.getElementById('side-hero-mp-bar').style.width = `${Math.max(0, (state.hero.mp / state.hero.maxMp) * 100)}%`;

  const alertEl = document.getElementById('side-stat-pts-alert');
  if (state.hero.statPoints > 0) {
    alertEl.style.display = 'block';
    alertEl.textContent = `★ Có ${state.hero.statPoints} Điểm Tiềm Năng chưa cộng [C]!`;
  } else {
    alertEl.style.display = 'none';
  }

  const lead = state.party[0];
  if (lead) {
    document.getElementById('side-mon-info').innerHTML = `
      <b style="color:${lead.tier.color}">[${lead.tier.en}] ${lead.code} ${lead.name}</b> (LV.${lead.level})<br/>
      HP: ${lead.hp}/${lead.maxHp} • IV: <b>${lead.iv.rank}</b> • Tính cách: <b>${lead.personality.name}</b>
    `;
  }
}

window.Game = {
  startNewGame() {
    const nameInput = document.getElementById('inp-hero-name').value.trim();
    state.hero.name = (nameInput || 'Lữ Khách').replace(/[<>&"']/g,'').slice(0,24);
    state.hero.race = RACES_40.find(r => r.id === state.selectedRaceId) || RACES_40[0];
    state.hero.cls = PLAYER_CLASSES.find(c => c.id === state.selectedClassId) || PLAYER_CLASSES[0];
    state.hero.stats = { ...state.hero.cls.baseStats };
    recalcHeroVitals(true);

    const starter = createMonsterInstance(state.selectedStarterId, 3, 1);
    state.party = [starter];
    state.caughtMonsters.add(starter.speciesId);
    state.seenMonsters.add(starter.speciesId);
    state.started = true;

    window.UI.closeDynamicModal();
    window.Game.save();
    audio.playHeal();
    document.getElementById('modal-create').classList.remove('active');
    updateHUD();
    logMsg(`☾ Lữ khách <b>${state.hero.name}</b> (${state.hero.race.name} — ${state.hero.cls.name}) cùng Khế Thú <b>${starter.name}</b> thức tỉnh tại Thánh Điện Tro Tàn!`);
  },

  movePlayer(dx, dy) {
    if (!state.started || state.battle || document.getElementById('modal-dynamic').classList.contains('active')) return;
    if (dx < 0) state.dir = 'left';
    else if (dx > 0) state.dir = 'right';
    else if (dy < 0) state.dir = 'up';
    else if (dy > 0) state.dir = 'down';

    const nx = state.px + dx;
    const ny = state.py + dy;
    const mapDef = WORLD_MAPS.find(m => m.id === state.currentMapId);
    const grid = buildMapGrid(mapDef);
    if (nx <= 0 || ny <= 0 || nx >= MAP_W - 1 || ny >= MAP_H - 1) return;
    if (grid[ny][nx] === 1 || grid[ny][nx] === 3) return;

    state.px = nx;
    state.py = ny;
    state.steps++;

    const lm = mapDef.landmarks.find(l => l.x === nx && l.y === ny);
    if (lm) {
      this.interactLandmark(lm);
      return;
    }

    if (grid[ny][nx] === 2) {
      const roll = Math.random();
      if (roll < mapDef.anomalyChance * 0.45) {
        this.triggerRandomAnomaly();
      } else if (roll < (mapDef.anomalyChance * 0.45) + mapDef.banditChance * 0.5) {
        this.triggerBanditAmbush();
      } else if (roll < mapDef.dangerRate) {
        this.triggerWildBattle(mapDef);
      }
    }
  },

  interactNearby() {
    if (!state.started || state.battle || document.getElementById('modal-dynamic').classList.contains('active')) return;
    const mapDef = WORLD_MAPS.find(m => m.id === state.currentMapId);
    for (const npc of NPCS_DATA.filter(n => n.mapId === state.currentMapId)) {
      if (Math.abs(npc.x - state.px) + Math.abs(npc.y - state.py) <= 1) {
        window.UI.openNpcDialogue(npc);
        return;
      }
    }
    for (const lm of mapDef.landmarks) {
      if (Math.abs(lm.x - state.px) + Math.abs(lm.y - state.py) <= 1) {
        this.interactLandmark(lm);
        return;
      }
    }
    logMsg('Không có đối tượng tương tác ngay bên cạnh. Hãy tiến lại gần NPC, Đài Lửa, Cổng Dịch Chuyển hoặc Tế Đàn Trùm!');
  },

  interactLandmark(lm) {
    if (lm.type === 'shrine') {
      audio.playHeal();
      recalcHeroVitals(true);
      state.party.forEach(m => m.hp = m.maxHp);
      updateHUD();
      logMsg(`🕯 Bạn cầu nguyện tại <b>${lm.name}</b>. Toàn bộ HP, MP của bạn và Khế Thú đã hồi đầy!`);
    } else if (lm.type === 'shop') {
      window.UI.openShopModal();
    } else if (lm.type === 'portal') {
      state.currentMapId = lm.targetMap;
      if(!state.visited.includes(lm.targetMap)) state.visited.push(lm.targetMap);
      state.px = lm.tx;
      state.py = lm.ty;
      const nextMap = WORLD_MAPS.find(m => m.id === lm.targetMap);
      updateHUD();
      logMsg(`🌀 Bước qua <b>${lm.name}</b> → Tiến vào <b>${nextMap.name}</b> (${nextMap.biomeTag})!`);
    } else if (lm.type === 'boss_altar') {
      const bossSp = MONSTERS_200.find(m => m.id === lm.bossCode);
      const mapDef = WORLD_MAPS.find(m => m.id === state.currentMapId);
      const bossInst = createMonsterInstance(bossSp.id, mapDef.levelRange[1] + 2, bossSp.defaultTier);
      this.startBattle('boss', `TRÙM KHU VỰC: ${bossInst.name}`, [bossInst], null);
    }
  },

  triggerWildBattle(mapDef, forcedTier = null) {
    const pool = MONSTERS_200.filter(m => m.region === mapDef.monsterRegion && m.num % 20 !== 0 && !EVENT_SPECIES.has(m.id));
    const chosen = pool[Math.floor(Math.random() * pool.length)] || MONSTERS_200[0];
    const lv = Math.floor(Math.random() * (mapDef.levelRange[1] - mapDef.levelRange[0] + 1)) + mapDef.levelRange[0];
    const inst = createMonsterInstance(chosen.id, lv, forcedTier);
    this.startBattle('wild', `Quái Vật Hoang Dã: ${inst.name}`, [inst], null);
  },

  triggerRandomAnomaly() {
    if(!state.started || state.battle || document.getElementById('modal-dynamic').classList.contains('active')) return;
    if(state.steps-state.lastAnomaly<30){logMsg('Dấu vết kỳ ngộ đã tắt. Tiếp tục khám phá ít nhất 30 bước để tìm dấu vết mới.');return;}
    state.lastAnomaly=state.steps;
    const pool=KY_NGO_EVENTS.filter(e=>!state.claimed.includes(e.id));
    if(!pool.length){logMsg('Những kỳ ngộ đã được giải quyết. Hãy tìm người giữ di tích để mở câu chuyện khác.');return;}
    const ev = pool[Math.floor(Math.random() * pool.length)];
    window.UI.openAnomalyModal(ev);
  },

  triggerBanditAmbush() {
    const b = BANDIT_ENCOUNTERS[Math.floor(Math.random() * BANDIT_ENCOUNTERS.length)];
    window.UI.openBanditModal(b);
  },

  startBattle(mode, title, enemySquad, npcRef) {
    if(!state.started || state.battle) return;
    window.UI.closeDynamicModal();
    audio.playEncounter();
    enemySquad.forEach(e => state.seenMonsters.add(e.speciesId));
    state.battle = {
      mode,
      title,
      enemies: enemySquad,
      enemyIdx: 0,
      npcRef,
      logs: [`⚔ ${title} xuất hiện!`]
    };
    document.getElementById('modal-battle').classList.add('active');
    window.UI.renderBattle();
  },

  computeFirstStrikeProb(playerSpd, enemySpd) {
    return initiativeProbability(playerSpd, enemySpd);
  },

  executeBattleTurn(actionType, param) {
    const b = state.battle;
    if (!b || !['weapon','skill','seal','flee','item','switch'].includes(actionType)) return;
    if(actionType==='switch'){const idx=Number(param);if(!Number.isInteger(idx)||idx<1||!state.party[idx]||state.party[idx].hp<=0)return;const [mon]=state.party.splice(idx,1);state.party.unshift(mon);}
    if(actionType==='item' && !(state.hero.bag[param]>0))return;
    const enemy = b.enemies[b.enemyIdx];
    const lead = state.party[0];
    const hStats = getEffectiveHeroStats();

    if (actionType === 'flee') {
      if (b.mode !== 'wild') {
        b.logs.unshift('🚫 Không thể bỏ chạy khỏi trận quyết đấu Trùm / NPC!');
        window.UI.renderBattle();
        return;
      }
      if (Math.random() < 0.65) {
        logMsg('🏃 Bạn đã rút lui an toàn khỏi trận chiến.');
        this.endBattle();
        return;
      } else {
        b.logs.unshift('⚠ Chạy trốn thất bại! Kẻ địch nhân cơ hội tấn công!');
      }
    }

    if (actionType === 'seal') {
      if (b.mode !== 'wild' && b.mode !== 'boss') {
        b.logs.unshift('🚫 Không thể ném Khế Ấn vào Khế Thú đã có chủ nhân!');
        window.UI.renderBattle();
        return;
      }
      const item = CONSUMABLES_DB.find(i => i.id === param);
      if (!item || (state.hero.bag[item.id] || 0) <= 0) return;
      state.hero.bag[item.id]--;
      audio.playSealThrow();
      const hpFactor = 1 - (enemy.hp / enemy.maxHp) * 0.65;
      const chaBonus = hStats.CHA * 0.012 + (state.hero.race.captureBonus || 0);
      const tierPenalty = enemy.tierIdx * 0.045;
      const catchProb = Math.min(0.95, Math.max(0.08, item.catchPower + hpFactor * 0.35 + chaBonus - tierPenalty));
      if (Math.random() < catchProb) {
        audio.playCaptureSuccess();
        state.caughtMonsters.add(enemy.speciesId);
        enemy.hp = enemy.maxHp;
        if (state.party.length < 6) state.party.push(enemy);
        else {state.storage.push(enemy);logMsg('Đội hình đầy: khế thú đã chuyển an toàn vào Kho Khế Ước [P].');}
        if(b.mode==='boss' && !state.bosses.includes(enemy.speciesId))state.bosses.push(enemy.speciesId);
        logMsg(`🔮 Thành công! Bạn đã thu phục <b style="color:${enemy.tier.color}">[${enemy.tier.en}] ${enemy.code} ${enemy.name}</b> (IV ${enemy.iv.rank} • ${enemy.personality.name})!`);
        this.endBattle();
        window.UI.showCaptureCard(enemy);
        return;
      } else {
        b.logs.unshift(`💥 ${enemy.name} phá vỡ ${item.name}! (Tỷ lệ thu phục: ${Math.round(catchProb * 100)}%)`);
      }
    }

    const teamSpd = Math.round((hStats.SPD + (lead ? lead.spd : hStats.SPD)) / 2);
    const firstProb = this.computeFirstStrikeProb(teamSpd, enemy.spd);
    const playerGoesFirst = Math.random() < firstProb;

    const runAllyPhase = () => {
      if (enemy.hp <= 0 || state.hero.hp <= 0) return;
      if (actionType === 'weapon') {
        audio.playHit();
        const wpn = state.hero.equip.weapon;
        const scaleVal = wpn ? (hStats[wpn.scaleStat] || hStats.STR) : hStats.STR;
        const wpnPow = wpn ? (wpn.power + wpn.plus * 5) : 10;
        const crit = Math.random() < Math.min(0.55, 0.08 + hStats.DEX * 0.008);
        let dmg = Math.max(6, Math.round((scaleVal * 1.45 + wpnPow - enemy.def * 0.45) * (crit ? 1.65 : 1.0)));
        enemy.hp = Math.max(0, enemy.hp - dmg);
        b.logs.unshift(`🗡 <b>${state.hero.name}</b> vung ${wpn ? wpn.name : 'Tay Không'} gây <b>${dmg}</b> sát thương${crit ? ' (CHÍ MẠNG!)' : ''}!`);
      } else if (actionType === 'skill') {
        const sk = state.hero.cls.skills[param];
        if (sk && state.hero.mp >= sk.mpCost) {
          audio.playHit();
          state.hero.mp -= sk.mpCost;
          const stVal = hStats[sk.scaleStat] || 10;
          const eMult = getElementMultiplier(sk.elem, enemy.element);
          let dmg = Math.max(8, Math.round((stVal * sk.mult * 1.6 - enemy.def * 0.35) * eMult));
          enemy.hp = Math.max(0, enemy.hp - dmg);
          b.logs.unshift(`✨ <b>${state.hero.name}</b> thi triển <b>${sk.name}</b> gây <b>${dmg}</b> sát thương (${eMult > 1 ? 'Khắc Chế!' : 'Chuẩn'})!`);
          if (sk.healRatio) {
            const hAmt = Math.round(state.hero.maxHp * sk.healRatio);
            state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + hAmt);
            b.logs.unshift(`💚 ${state.hero.name} hồi phục +${hAmt} HP!`);
          }
          if (sk.healLeadMon && lead) {
            const mAmt = Math.round(lead.maxHp * sk.healLeadMon);
            lead.hp = Math.min(lead.maxHp, lead.hp + mAmt);
            b.logs.unshift(`💚 Khế Thú ${lead.name} hồi phục +${mAmt} HP!`);
          }
        } else {
          b.logs.unshift('⚠ Không đủ MP! Chuyển sang đánh thường.');
          const dmg = Math.max(5, Math.round(hStats.STR * 1.2 - enemy.def * 0.4));
          enemy.hp = Math.max(0, enemy.hp - dmg);
        }
      } else if (actionType === 'item') {
        const it = CONSUMABLES_DB.find(i => i.id === param);
        if (it && (state.hero.bag[it.id] || 0) > 0) {
          audio.playHeal();
          state.hero.bag[it.id]--;
          if (it.type === 'heal_player') {
            state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + it.value);
            b.logs.unshift(`🧪 Dùng ${it.name}, hồi +${it.value} HP cho nhân vật!`);
          } else if (it.type === 'heal_mp') {
            state.hero.mp = Math.min(state.hero.maxMp, state.hero.mp + it.value);
            b.logs.unshift(`🧪 Dùng ${it.name}, hồi +${it.value} MP!`);
          } else if (it.type === 'restore_heart') {
            state.hero.hearts = Math.min(state.hero.maxHearts,state.hero.hearts+it.value);
          } else if (it.type === 'heal_mon' && lead) {
            lead.hp = Math.min(lead.maxHp, lead.hp + it.value);
            b.logs.unshift(`🧪 Dùng ${it.name}, hồi +${it.value} HP cho ${lead.name}!`);
          }
        }
      }

      if (enemy.hp > 0 && lead && lead.hp > 0) {
        const sp = MONSTERS_200.find(m => m.id === lead.speciesId);
        const mv = sp.moves[Math.floor(Math.random() * sp.moves.length)];
        const eMult = getElementMultiplier(mv.type, enemy.element);
        const rawAtk = mv.kind === 'mag' ? lead.mag : lead.atk;
        const mDmg = Math.max(5, Math.round(((rawAtk * 1.15 + mv.power * 0.45) - enemy.def * 0.4) * eMult));
        enemy.hp = Math.max(0, enemy.hp - mDmg);
        b.logs.unshift(`🐺 <b>${lead.name}</b> tung chiêu <i>${mv.name}</i> gây <b>${mDmg}</b> sát thương!`);
      }
    };

    const runEnemyPhase = () => {
      if (enemy.hp <= 0) return;
      audio.playHit();
      const sp = MONSTERS_200.find(m => m.id === enemy.speciesId);
      const mv = sp.moves[Math.floor(Math.random() * sp.moves.length)];
      const hitLead = lead && lead.hp > 0 && Math.random() < 0.62;
      if (hitLead) {
        const eMult = getElementMultiplier(mv.type, lead.element);
        const dmg = Math.max(4, Math.round((((mv.kind === 'mag' ? enemy.mag : enemy.atk) * 1.1 + mv.power * 0.4) - lead.def * 0.45) * eMult));
        lead.hp = Math.max(0, lead.hp - dmg);
        b.logs.unshift(`🔥 Địch <b>${enemy.name}</b> tấn công <b>${lead.name}</b> mất <b>${dmg}</b> HP!`);
      } else {
        const armDef = state.hero.equip.armor ? (state.hero.equip.armor.defBonus + state.hero.equip.armor.plus * 3) : 0;
        const totDef = mv.kind === 'mag' ? hStats.WIS * 1.3 + armDef * 0.4 : hStats.DEF + armDef;
        const dmg = Math.max(4, Math.round(((mv.kind === 'mag' ? enemy.mag : enemy.atk) * 1.1 + mv.power * 0.4) - totDef * 0.55));
        state.hero.hp = Math.max(0, state.hero.hp - dmg);
        b.logs.unshift(`🩸 Địch <b>${enemy.name}</b> đánh trúng <b>${state.hero.name}</b> mất <b>${dmg}</b> HP!`);
      }
    };

    if (playerGoesFirst) {
      b.logs.unshift(`⚡ Phe ta giành quyền ra đòn trước! (Xác suất SPD: ${Math.round(firstProb * 100)}%)`);
      runAllyPhase();
      runEnemyPhase();
    } else {
      b.logs.unshift(`⏳ Địch ra đòn trước dù xác suất của ta là ${Math.round(firstProb * 100)}%!`);
      runEnemyPhase();
      runAllyPhase();
    }

    state.hero.mp = Math.min(state.hero.maxMp, state.hero.mp + Math.max(2, Math.floor(hStats.WIS / 5)));

    if (enemy.hp <= 0) {
      const goldGain = Math.round((35 + enemy.level * 14 + enemy.tierIdx * 20) * (lead?.personality.id==='covetous'?1.35:1));
      const expGain = 45 + enemy.level * 18 + enemy.tierIdx * 25;
      state.hero.gold += goldGain;
      this.grantPlayerExp(expGain);
      if (lead && lead.hp > 0) this.grantMonsterExp(lead, Math.round(expGain * lead.personality.expMult));

      const sp = MONSTERS_200.find(m => m.id === enemy.speciesId);
      state.hero.materials[sp.dropItem] = (state.hero.materials[sp.dropItem] || 0) + 1;

      if (b.enemyIdx + 1 < b.enemies.length) {
        b.enemyIdx++;
        const nextE = b.enemies[b.enemyIdx];
        state.seenMonsters.add(nextE.speciesId);
        b.logs.unshift(`💀 Đã hạ gục ${enemy.name}! Đối thủ tiếp theo: <b>${nextE.name}</b>!`);
      } else {
        logMsg(`🏆 Chiến thắng <b>${b.title}</b>! Nhận +${goldGain} Tro Vàng, +${expGain} EXP và vật liệu <i>${sp.dropItem}</i>.`);
        state.wins++;
        if(b.mode==='boss' && !state.bosses.includes(enemy.speciesId))state.bosses.push(enemy.speciesId);
        this.endBattle();
        return;
      }
    }

    if (state.hero.hp <= 0) {
      state.hero.hearts = Math.max(0, state.hero.hearts - 1);
      if (state.hero.hearts === 0) {
        const lostGold = Math.floor(state.hero.gold * 0.3);
        state.hero.gold -= lostGold;
        state.hero.hearts = 2;
        logMsg(`💀 Bạn đã cạn sạch Tim! Nghi thức Trăng Vỡ hồi sinh bạn với 2 Tim (mất ${lostGold} Tro Vàng).`);
      } else {
        logMsg(`💔 Bạn gục ngã trong chiến đấu và mất <b>1 Tim</b>! (Còn lại ${state.hero.hearts}/${state.hero.maxHearts} Tim).`);
      }
      state.currentMapId='map_central_ash';state.px=9;state.py=9;
      recalcHeroVitals(true);
      state.party.forEach(m => m.hp = m.maxHp);
      this.endBattle();
      return;
    }

    updateHUD();
    window.UI.renderBattle();
  },

  endBattle() {
    state.battle = null;
    document.getElementById('modal-battle').classList.remove('active');
    this.save();
    updateHUD();
  },

  grantPlayerExp(amt) {
    state.hero.exp += amt;
    while (state.hero.exp >= state.hero.nextExp) {
      state.hero.exp -= state.hero.nextExp;
      state.hero.level++;
      state.hero.nextExp = Math.round(state.hero.nextExp * 1.32);
      state.hero.statPoints += 4;
      recalcHeroVitals(true);
      logMsg(`⬆ <b>${state.hero.name}</b> thăng lên <b>LV.${state.hero.level}</b>! Nhận <b>+4 Điểm Tiềm Năng</b> để phân bổ chỉ số [C]!`);
    }
  },

  grantMonsterExp(mon, amt) {
    mon.exp += amt;
    while (mon.exp >= mon.nextExp) {
      mon.exp -= mon.nextExp;
      mon.level++;
      mon.nextExp = mon.level * 65;
      const g = mon.tier.growthMult * mon.iv.mult * (1 + (mon.personality.growthBonus || 0));
      mon.maxHp += Math.round(14 * g * mon.personality.hp);
      mon.hp = mon.maxHp;
      mon.atk += Math.round(4.2 * g * mon.personality.atk);
      mon.def += Math.round(3.8 * g * mon.personality.def);
      mon.mag += Math.round(4.2 * g * mon.personality.mag);
      mon.spd += Math.round(3.6 * g * mon.personality.spd);
      logMsg(`🐺 Khế Thú <b>${mon.name}</b> (${mon.tier.name}) lên <b>LV.${mon.level}</b>!`);

      const sp = MONSTERS_200.find(m => m.id === mon.speciesId);
      if (sp && sp.evolveTo && mon.level >= sp.evolveLevel) {
        const evoSp = MONSTERS_200.find(m => m.id === sp.evolveTo);
        if (evoSp) {
          audio.playEvolve();
          mon.speciesId = evoSp.id;
          mon.code = evoSp.code;
          mon.name = evoSp.name;
          mon.element = evoSp.element;
          mon.maxHp+=Math.max(0,evoSp.baseHp-sp.baseHp);mon.hp=mon.maxHp;
          for(const [stat,base] of [['atk','baseAtk'],['def','baseDef'],['mag','baseMag'],['spd','baseSpd']])mon[stat]+=Math.max(0,evoSp[base]-sp[base]);
          state.seenMonsters.add(evoSp.id);
          state.caughtMonsters.add(evoSp.id);
          logMsg(`✨ TIẾN HÓA! Khế thú của bạn đã tiến hóa thành <b>${evoSp.code} ${evoSp.name}</b>!`);
        }
      }
    }
  }
};

window.UI = {
  renderRaceChoices() {
    const grp = document.getElementById('sel-race-group').value;
    const list = grp === 'ALL' ? RACES_40 : RACES_40.filter(r => r.group === grp);
    const box = document.getElementById('create-race-list');
    box.innerHTML = list.map(r => {
      const active = r.id === state.selectedRaceId ? 'border-color:var(--accent-gold);background:#262036;' : '';
      const mods = Object.entries(r.statMods).filter(([,v]) => v > 0).map(([k,v]) => `+${v} ${k}`).join(', ');
      return `
        <div class="dex-card" style="${active}" onclick="window.UI.selectRace('${r.id}')">
          <div style="font-size:11px;color:var(--accent-gold);">${r.code} • ${r.group}</div>
          <div style="font-weight:bold;margin:2px 0;">${r.name}</div>
          <div style="font-size:11px;color:var(--accent-cyan);">${mods}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${r.appearance.slice(0, 75)}...</div>
        </div>
      `;
    }).join('');
  },

  selectRace(id) { state.selectedRaceId = id; this.renderRaceChoices(); },

  renderClassAndStarters() {
    document.getElementById('create-class-list').innerHTML = PLAYER_CLASSES.map(c => {
      const active = c.id === state.selectedClassId ? 'border-color:var(--accent-violet);background:#262036;' : '';
      return `
        <div class="dex-card" style="${active}" onclick="window.UI.selectClass('${c.id}')">
          <div style="font-weight:bold;color:var(--accent-violet);">${c.name}</div>
          <div style="font-size:11px;color:var(--accent-gold);">Ưu thế: ${c.favoredStats.join(', ')}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${c.desc}</div>
        </div>
      `;
    }).join('');

    const starters = ['m_001', 'm_002', 'm_004'].map(id => MONSTERS_200.find(m => m.id === id));
    document.getElementById('create-starter-list').innerHTML = starters.map(m => {
      const active = m.id === state.selectedStarterId ? 'border-color:var(--accent-emerald);background:#1b2b22;' : '';
      return `
        <div class="dex-card" style="${active}" onclick="window.UI.selectStarter('${m.id}')">
          <canvas id="starter-${m.id}" width="144" height="144" style="display:block;margin:auto"></canvas><div style="font-weight:bold;color:var(--accent-emerald);">${m.code} • ${m.name}</div>
          <div style="font-size:11px;color:var(--accent-gold);">Hệ: ${m.element} • Vai trò: ${m.role}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${m.appearance.slice(0, 80)}...</div>
        </div>
      `;
    }).join('');
    starters.forEach(m=>drawConcept(document.getElementById('starter-'+m.id),m));
  },

  selectClass(id) { state.selectedClassId = id; this.renderClassAndStarters(); },
  selectStarter(id) { state.selectedStarterId = id; this.renderClassAndStarters(); },

  openDynamicModal(title, html) {
    document.getElementById('dyn-title').textContent = title;
    document.getElementById('dyn-body').innerHTML = html;
    document.getElementById('modal-dynamic').classList.add('active');
  },

  closeDynamicModal() {
    document.getElementById('modal-dynamic').classList.remove('active');
  },

  openMonsterCodex() {
    const regions = [...new Set(MONSTERS_200.map(m => m.region))];
    this.openDynamicModal(`📖 SÁCH BÁCH KHOA 200 QUÁI VẬT VỰC TÀN NGUYỆT (Đã Gặp: ${state.seenMonsters.size}/200 • Đã Thu Phục: ${state.caughtMonsters.size}/200)`, `
      <div class="filter-bar">
        <input id="dex-m-search" placeholder="Tìm mã M-001..M-200 hoặc tên quái..." oninput="window.UI.filterMonsterCodex()" style="flex:1;" />
        <select id="dex-m-region" onchange="window.UI.filterMonsterCodex()">
          <option value="ALL">Tất cả 10 Vùng Sinh Thái</option>
          ${regions.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
        <select id="dex-m-tier" onchange="window.UI.filterMonsterCodex()">
          <option value="ALL">Tất cả 10 Thứ Bậc (Normal → Extraordinary)</option>
          ${MONSTER_TIERS.map(t => `<option value="${t.id}">${t.code}: ${t.name} (${t.vi})</option>`).join('')}
        </select>
      </div>
      <div id="dex-m-grid" class="grid-cards"></div>
    `);
    this.filterMonsterCodex();
  },

  filterMonsterCodex() {
    const q = (document.getElementById('dex-m-search')?.value || '').toLowerCase();
    const reg = document.getElementById('dex-m-region')?.value || 'ALL';
    const tier = document.getElementById('dex-m-tier')?.value || 'ALL';
    const list = MONSTERS_200.filter(m => {
      if (reg !== 'ALL' && m.region !== reg) return false;
      if (tier !== 'ALL' && String(m.defaultTier) !== tier) return false;
      if (q && !m.name.toLowerCase().includes(q) && !m.code.toLowerCase().includes(q)) return false;
      return true;
    });

    const grid = document.getElementById('dex-m-grid');
    grid.innerHTML = list.map(m => {
      const t = MONSTER_TIERS[m.defaultTier];
      const caught = state.caughtMonsters.has(m.id);
      const seen = state.seenMonsters.has(m.id);
      const badge = caught ? '<span style="color:#69db7c;">★ Đã Thu Phục</span>' : (seen ? '<span style="color:#ffd43b;">👁 Đã Gặp</span>' : '<span style="color:#888;">• Hồ Sơ Cổ</span>');
      return `
        <div class="dex-card" style="border-color:${t.border}" onclick="window.UI.inspectMonsterDetail('${m.id}')">
          <div style="display:flex;justify-content:space-between;font-size:11px;">
            <b style="color:${t.color}">${m.code} • ${t.en}</b>
            ${badge}
          </div>
          <div style="font-weight:bold;font-size:14px;margin:3px 0;">${m.name}</div>
          <div style="font-size:11px;color:var(--accent-cyan);">${m.category} • Đe dọa ${m.threat}/5 • ${m.region}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${m.appearance.slice(0, 85)}...</div>
        </div>
      `;
    }).join('');
  },

  inspectMonsterDetail(id) {
    const m = MONSTERS_200.find(x => x.id === id);
    const t = MONSTER_TIERS[m.defaultTier];
    const evoSp = m.evolveTo ? MONSTERS_200.find(x => x.id === m.evolveTo) : null;
    this.openDynamicModal(`📖 HỒ SƠ CHI TIẾT: ${m.code} | ${m.name}`, `
      <div style="display:grid;grid-template-columns:260px 1fr;gap:16px;">
        <div class="gothic-collectible" style="border-color:${t.color}">
          <div style="font-size:11px;color:${t.color};font-weight:bold;">${t.code} • ${t.name.toUpperCase()} (${t.vi})</div>
          <div style="font-size:16px;font-weight:bold;margin:4px 0;">${m.code} ${m.name}</div>
          <canvas id="inspect-mon-canvas" width="144" height="144" style="margin:6px auto;display:block;background:#0b0912;border-radius:6px;"></canvas>
          <div style="font-size:12px;color:var(--accent-gold);">Hệ: ${m.element} • Đe Dọa: ${m.threat}/5</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Hệ số tăng trưởng mỗi Level: <b>×${t.growthMult.toFixed(2)}</b></div>
          <div class="stat-grid" style="grid-template-columns:1fr 1fr;margin-top:8px;font-size:11px;">
            <div class="stat-cell">HP Gốc: <b>${m.baseHp}</b></div>
            <div class="stat-cell">ATK Gốc: <b>${m.baseAtk}</b></div>
            <div class="stat-cell">DEF Gốc: <b>${m.baseDef}</b></div>
            <div class="stat-cell">SPD Gốc: <b>${m.baseSpd}</b></div>
          </div>
          ${evoSp ? `<div style="margin-top:8px;font-size:11px;color:var(--accent-emerald);">Tiến hóa ở LV.${m.evolveLevel} → <b>${evoSp.code} ${evoSp.name}</b></div>` : ''}
          <button class="btn-gothic" style="margin-top:10px;width:100%;" onclick="window.UI.openMonsterCodex()">← Quay lại Sách 200 Quái Vật</button>
        </div>
        <div>
          <div class="lore-section"><b>Phân loại & Vùng sinh thái:</b> ${m.category} • Vai trò: ${m.role} • Vùng: ${m.region}</div>
          ${m.num<=7?`<details class="lore-section"><summary>Ảnh concept gốc bạn cung cấp · mở hồ sơ đầy đủ</summary><a href="assets/reference/${m.id}.png" target="_blank"><img src="assets/reference/${m.id}.png" style="width:100%;margin-top:12px" alt="Concept gốc ${m.name}"></a></details>`:''}
          <div class="lore-section"><b>Nhận diện và tạo hình:</b> ${m.appearance}</div>
          <div class="lore-section"><b>Tính khí và tập tính:</b> ${m.temperament}</div>
          <div class="lore-section"><b>Sinh cảnh, phân bố và vòng đời:</b> ${m.habitat}</div>
          <div class="lore-section"><b>Năng lực và chiến thuật:</b> ${m.tactics}</div>
          <div class="lore-section" style="border-left-color:#ff6b6b;"><b>Điểm yếu và cách khắc chế:</b> ${m.weakness}</div>
          <div class="lore-section" style="border-left-color:#ffd43b;"><b>Dấu vết và vật phẩm rơi ra:</b> ${m.drops}</div>
          <div class="lore-section" style="border-left-color:#4dabf7;"><b>Móc nhiệm vụ:</b> ${m.questHook}</div>
        </div>
      </div>
    `);
    setTimeout(() => drawConcept(document.getElementById('inspect-mon-canvas'), m, 8), 20);
  },

  openRaceCodex() {
    this.openDynamicModal('📜 CẨM NANG 40 CHỦNG TỘC VỰC TÀN NGUYỆT (R-01 → R-40)', `
      <div class="filter-bar">
        <input id="dex-r-search" placeholder="Tìm mã R-01..R-40 hoặc tên chủng tộc..." oninput="window.UI.filterRaceCodex()" style="flex:1;" />
        <select id="dex-r-group" onchange="window.UI.filterRaceCodex()">
          <option value="ALL">Tất Cả 5 Nhóm Nguồn Gốc</option>
          <option value="HẬU DUỆ HUYẾT THỊT">01. Hậu Duệ Huyết Thịt</option>
          <option value="HẬU DUỆ MỘC VÀ THẠCH">02. Hậu Duệ Mộc Và Thạch</option>
          <option value="HẬU DUỆ THỦY VÀ SƯƠNG">03. Hậu Duệ Thủy Và Sương</option>
          <option value="HẬU DUỆ BÓNG VÀ TỬ">04. Hậu Duệ Bóng Và Tử</option>
          <option value="HẬU DUỆ DỊ GIỚI VÀ LONG MẠCH">05. Hậu Duệ Dị Giới Và Long Mạch</option>
        </select>
      </div>
      <div id="dex-r-grid" class="grid-cards"></div>
    `);
    this.filterRaceCodex();
  },

  filterRaceCodex() {
    const q = (document.getElementById('dex-r-search')?.value || '').toLowerCase();
    const grp = document.getElementById('dex-r-group')?.value || 'ALL';
    const list = RACES_40.filter(r => {
      if (grp !== 'ALL' && r.group !== grp) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.code.toLowerCase().includes(q)) return false;
      return true;
    });
    document.getElementById('dex-r-grid').innerHTML = list.map(r => `
      <div class="dex-card" onclick="window.UI.inspectRaceDetail('${r.id}')">
        <div style="font-size:11px;color:var(--accent-gold);">${r.code} • ${r.group}</div>
        <div style="font-weight:bold;font-size:14px;margin:3px 0;">${r.name}</div>
        <div style="font-size:11px;color:var(--accent-cyan);">Cư trú: ${r.habitat}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${r.appearance.slice(0, 85)}...</div>
      </div>
    `).join('');
  },

  inspectRaceDetail(id) {
    const r = RACES_40.find(x => x.id === id);
    const mods = Object.entries(r.statMods).filter(([,v]) => v > 0).map(([k,v]) => `+${v} ${k}`).join(', ');
    this.openDynamicModal(`📜 HỒ SƠ CHỦNG TỘC: ${r.code} | ${r.name}`, `
      <div class="lore-section"><b>Nhóm nguồn gốc:</b> ${r.group} &nbsp;|&nbsp; <b>Cư trú trọng tâm:</b> ${r.habitat} &nbsp;|&nbsp; <b>Ưu tiên gameplay:</b> ${r.priority} &nbsp;|&nbsp; <b>Thưởng chỉ số:</b> <span style="color:var(--accent-gold)">${mods}</span></div>
      <div class="lore-section"><b>Diện mạo và giải phẫu:</b> ${r.appearance}</div>
      <div class="lore-section"><b>Thân thể và vòng đời:</b> ${r.lifecycle}</div>
      <div class="lore-section"><b>Địa lý, sinh kế và tổ chức:</b> ${r.geography}</div>
      <div class="lore-section"><b>Văn hóa và thế giới quan:</b> ${r.culture}</div>
      <div class="lore-section" style="border-left-color:#ffd43b;"><b>Năng lực và giới hạn:</b> ${r.abilities}</div>
      <div class="lore-section"><b>Chính trị, liên minh và thành kiến:</b> ${r.politics}</div>
      <div class="lore-section"><b>Vai trò nhân vật và gameplay:</b> ${r.gameplay}</div>
      <div class="lore-section" style="border-left-color:#4dabf7;"><b>Móc truyện và lựa chọn:</b> ${r.questHook}</div>
      <button class="btn-gothic" onclick="window.UI.openRaceCodex()">← Quay lại Sách 40 Chủng Tộc</button>
    `);
  },

  openHeroSheet() {
    const eff = getEffectiveHeroStats();
    const statDescriptions = {
      STR: 'Tăng sát thương vũ khí & kỹ năng vật lý',
      CON: 'Tăng HP tối đa của nhân vật (+9 HP/điểm)',
      DEF: 'Giảm sát thương nhận vào (không tăng SPD)',
      SPD: 'Tăng XÁC SUẤT ra đòn trước mỗi lượt',
      DEX: 'Tăng tỷ lệ chí mạng & sát thương cung/đao',
      INT: 'Tăng sát thương phép thuật & ma kiếm',
      WIS: 'Tăng MP tối đa & hồi MP mỗi lượt',
      CHA: 'Tăng tỷ lệ Khế Ấn & mở khóa đối thoại NPC'
    };
    const wpn = state.hero.equip.weapon;
    const arm = state.hero.equip.armor;
    const rel = state.hero.equip.relic;

    this.openDynamicModal(`⚔ NHÂN VẬT: ${state.hero.name} (LV.${state.hero.level}) — ĐIỂM TIỀM NĂNG: ${state.hero.statPoints}`, `
      <div style="margin-bottom:10px;font-size:13px;">
        Chủng tộc: <b>${state.hero.race.code} ${state.hero.race.name}</b> • Class hiện tại: <b style="color:var(--accent-violet)">${state.hero.cls.name}</b>
        <select onchange="window.UI.switchHeroClass(this.value)" style="margin-left:8px;background:#1a1724;color:#fff;border:1px solid var(--border-gold);padding:4px;border-radius:4px;">
          ${PLAYER_CLASSES.map(c => `<option value="${c.id}" ${c.id === state.hero.cls.id ? 'selected' : ''}>Đổi Class: ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="stat-grid" style="margin-bottom:14px;">
        ${Object.keys(eff).map(k => `
          <div class="stat-cell">
            <div style="font-size:12px;color:var(--accent-gold);font-weight:bold;">${k}: <span style="font-size:16px;color:#fff;">${eff[k]}</span></div>
            <div style="font-size:10px;color:var(--text-muted);margin:3px 0;">${statDescriptions[k]}</div>
            ${state.hero.statPoints > 0 ? `<button class="btn-gothic" style="padding:2px 8px;margin-top:3px;" onclick="window.UI.addStatPoint('${k}')">+1 ${k}</button>` : ''}
          </div>
        `).join('')}
      </div>
      <h4 style="color:var(--accent-cyan);margin-bottom:6px;">Trang Bị Đang Mặc:</h4>
      <div class="grid-cards" style="grid-template-columns:repeat(3,1fr);">
        <div class="dex-card">
          <div style="font-size:11px;color:var(--accent-gold);">VŨ KHÍ</div>
          <b>${wpn ? `${wpn.name} (+${wpn.plus})` : 'Chưa trang bị'}</b>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${wpn ? `Hệ số ${wpn.scaleStat} • Sức mạnh ${wpn.power + wpn.plus * 5}` : ''}</div>
        </div>
        <div class="dex-card">
          <div style="font-size:11px;color:var(--accent-gold);">ÁO GIÁP</div>
          <b>${arm ? `${arm.name} (+${arm.plus})` : 'Chưa trang bị'}</b>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${arm ? `Thủ +${arm.defBonus + arm.plus * 3} • HP +${arm.hpBonus + arm.plus * 18}` : ''}</div>
        </div>
        <div class="dex-card">
          <div style="font-size:11px;color:var(--accent-gold);">CỔ VẬT / NHẪN</div>
          <b>${rel ? `${rel.name}` : 'Chưa trang bị'}</b>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${rel ? rel.desc : ''}</div>
        </div>
      </div>
    `);
  },

  addStatPoint(statKey) {
    if (state.hero.statPoints <= 0) return;
    state.hero.statPoints--;
    state.hero.stats[statKey]++;
    recalcHeroVitals(false);
    updateHUD();
    this.openHeroSheet();
  },

  switchHeroClass(clsId) {
    const c = PLAYER_CLASSES.find(x => x.id === clsId);
    if (c) {
      state.hero.cls = c;
      updateHUD();
      this.openHeroSheet();
    }
  },

  openPartyModal() {
    this.openDynamicModal(`🐺 ĐỘI HÌNH KHẾ THÚ (${state.party.length}/6) — 10 THỨ BẬC & TÍNH CÁCH`, `
      <div class="grid-cards">
        ${state.party.map((m, idx) => `
          <div class="gothic-collectible" style="border-color:${m.tier.color}">
            <div style="font-size:11px;color:${m.tier.color};font-weight:bold;">${m.tier.code}: ${m.tier.name} (${m.tier.vi})</div>
            <div style="font-weight:bold;font-size:15px;margin:3px 0;">${m.code} ${m.name} (LV.${m.level})</div>
            <div style="font-size:11px;color:var(--accent-cyan);">Tiềm Lực IV: <b>${m.iv.rank}</b> • Tính cách: <b>${m.personality.name}</b></div>
            <div style="font-size:10px;color:var(--text-muted);margin:3px 0;">${m.personality.desc}</div>
            <div style="font-size:12px;margin:6px 0;">HP: ${m.hp}/${m.maxHp} | ATK: ${m.atk} | DEF: ${m.def} | MAG: ${m.mag} | SPD: ${m.spd}</div>
            ${idx === 0 ? '<span style="color:var(--accent-emerald);font-size:12px;font-weight:bold;">★ ĐANG LÀ TIÊN PHONG</span>' : `<button class="btn-gothic" onclick="window.UI.setLeadMonster(${idx})">Đưa Lên Tiên Phong</button>`}
          </div>
        `).join('')}
      </div>
    `);
  },

  setLeadMonster(idx) {
    const [chosen] = state.party.splice(idx, 1);
    state.party.unshift(chosen);
    updateHUD();
    this.openPartyModal();
  },

  openWorldAtlas() {
    this.openDynamicModal('🗺 BẢN ĐỒ ĐẠI THẾ GIỚI & CÁC TẦNG NGỤC (40 KHU VỰC KIẾN TRÚC)', `
      <div class="grid-cards">
        ${WORLD_MAPS.map(m => `
          <div class="dex-card" style="${m.id === state.currentMapId ? 'border-color:var(--accent-emerald);' : ''}">
            <div style="font-weight:bold;color:var(--accent-gold);">${m.name}</div>
            <div style="font-size:11px;color:var(--accent-cyan);margin:3px 0;">${m.biomeTag}</div>
            <div style="font-size:11px;color:var(--text-muted);">Vùng sinh thái: ${m.monsterRegion} (LV.${m.levelRange[0]}–${m.levelRange[1]})</div>
            <button class="btn-gothic" style="margin-top:8px;width:100%;" ${state.visited.includes(m.id)?'':'disabled'} onclick="window.UI.teleportToMap('${m.id}')">${state.visited.includes(m.id)?'🌀 Trở lại vùng đã khám phá':'◇ Khám phá qua cổng trên bản đồ'}</button>
          </div>
        `).join('')}
      </div>
    `);
  },

  teleportToMap(mapId) {
    if(state.battle || !state.started || !state.visited.includes(mapId))return;
    state.currentMapId = mapId;
    state.px = 8;
    state.py = 8;
    const m = WORLD_MAPS.find(x => x.id === mapId);
    this.closeDynamicModal();
    updateHUD();
    logMsg(`🌀 Dịch chuyển thành công tới <b>${m.name}</b>!`);
  },

  openShopModal() {
    const wpn = state.hero.equip.weapon;
    const arm = state.hero.equip.armor;
    const upgCostW = wpn ? (wpn.plus + 1) * 90 : 0;
    const upgCostA = arm ? (arm.plus + 1) * 80 : 0;

    this.openDynamicModal(`⚒ LÒ RÈN CƯỜNG HÓA & THƯƠNG HỘI (Tro Vàng: ${state.hero.gold})`, `
      <div class="side-box" style="margin-bottom:12px;">
        <h4 style="color:var(--accent-gold);margin-bottom:6px;">Cường Hóa Trang Bị Đang Mặc:</h4>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${wpn ? `<button class="btn-gothic" onclick="window.UI.upgradeEquip('weapon')">🔨 Rèn ${wpn.name} → +${wpn.plus + 1} (${upgCostW} Vàng)</button>` : ''}
          ${arm ? `<button class="btn-gothic" onclick="window.UI.upgradeEquip('armor')">🛡 Rèn ${arm.name} → +${arm.plus + 1} (${upgCostA} Vàng)</button>` : ''}
        </div>
      </div>

      <h4 style="color:var(--accent-cyan);margin-bottom:6px;">Vật Phẩm, Khế Ấn & Trái Tim Tro Hồn:</h4>
      <div class="grid-cards" style="margin-bottom:12px;">
        ${CONSUMABLES_DB.map(it => `
          <div class="dex-card">
            <b>${it.name}</b> (Đang có: ${state.hero.bag[it.id] || 0})
            <div style="font-size:11px;color:var(--text-muted);margin:3px 0;">${it.desc}</div>
            <button class="btn-gothic" onclick="window.UI.buyConsumable('${it.id}')">Mua (${it.price} Vàng)</button>
          </div>
        `).join('')}
      </div>

      <h4 style="color:var(--accent-violet);margin-bottom:6px;">Kho Vũ Khí, Áo Giáp & Cổ Vật Truyền Kỳ:</h4>
      <div class="grid-cards">
        ${EQUIPMENT_DB.map(eq => `
          <div class="dex-card">
            <div style="font-size:10px;color:var(--accent-gold);">${eq.rarity.toUpperCase()} • ${eq.slot.toUpperCase()}</div>
            <b>${eq.name}</b>
            <div style="font-size:11px;color:var(--text-muted);margin:3px 0;">${eq.desc}</div>
            <button class="btn-gothic" onclick="window.UI.buyEquipment('${eq.id}')">Mua & Trang Bị (${eq.price} Vàng)</button>
          </div>
        `).join('')}
      </div>
    `);
  },

  upgradeEquip(slot) {
    const eq = state.hero.equip[slot];
    if (!eq || eq.plus >= 10 || state.battle) return;
    const cost = (eq.plus + 1) * (slot === 'weapon' ? 90 : 80);
    if (state.hero.gold < cost) { alert('Không đủ Tro Vàng!'); return; }
    state.hero.gold -= cost;
    eq.plus++;
    updateHUD();
    this.openShopModal();
  },

  buyConsumable(id) {
    const it = CONSUMABLES_DB.find(x => x.id === id);
    if (!it || state.hero.gold < it.price) { alert('Không đủ Tro Vàng!'); return; }
    if(it.type==='restore_heart' && state.hero.hearts>=state.hero.maxHearts){logMsg('Tim đang đầy. Hãy giữ tro vàng cho hành trình.');return;}
    state.hero.gold -= it.price;
    if (it.type === 'restore_heart') {
      state.hero.hearts = Math.min(state.hero.maxHearts, state.hero.hearts + 1);
      logMsg('♥ Bạn đã dùng Trái Tim Tro Hồn, hồi phục +1 Mạng Sống!');
    } else {
      state.hero.bag[id] = (state.hero.bag[id] || 0) + 1;
    }
    updateHUD();
    this.openShopModal();
  },

  buyEquipment(id) {
    const eq = EQUIPMENT_DB.find(x => x.id === id);
    if (!eq || state.hero.gold < eq.price) { alert('Không đủ Tro Vàng!'); return; }
    state.hero.gold -= eq.price;
    state.hero.equip[eq.slot] = { ...eq, plus: 0 };
    updateHUD();
    this.openShopModal();
  },

  openNpcDialogue(npc) {
    const eff = getEffectiveHeroStats();
    this.openDynamicModal(`💬 ${npc.name} (${npc.raceCode} ${npc.raceName} — Tính cách: ${npc.personality})`, `
      <div class="lore-section" style="font-size:14px;">"${npc.greeting}"</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
        ${npc.choices.map((ch, idx) => {
          const locked = ch.reqStat && (eff[ch.reqStat.stat] || 0) < ch.reqStat.min;
          return `
            <button class="btn-gothic" ${locked ? 'disabled style="opacity:0.45;"' : ''} onclick="window.UI.resolveNpcChoice('${npc.id}', ${idx})">
              ${ch.label} ${locked ? `(Chưa đủ ${ch.reqStat.stat} ${ch.reqStat.min})` : ''}
            </button>
          `;
        }).join('')}
      </div>
    `);
  },

  resolveNpcChoice(npcId, choiceIdx) {
    const npc = NPCS_DATA.find(n => n.id === npcId);
    const ch = npc?.choices[choiceIdx];
    if(!ch || state.battle || !state.started) return;
    if(ch.reqStat && getEffectiveHeroStats()[ch.reqStat.stat]<ch.reqStat.min)return;
    const key=npcId+':'+choiceIdx;
    if(!ch.isDuel && (state.claimed.includes(key) || (ch.branch && state.decisions[npcId]))){logMsg('Câu chuyện này đã được ghi vào nhật ký. Người giữ đèn nhớ lựa chọn của ngươi.');return;}
    if(ch.costGold && state.hero.gold<ch.costGold){logMsg('Chưa đủ tro vàng để thực hiện lời hứa.');return;}
    if(ch.costGold)state.hero.gold-=ch.costGold;
    if(!ch.isDuel)state.claimed.push(key);
    if(ch.branch){state.decisions[npcId]=ch.branch;state.reputation+=ch.reputation||0;}
    this.closeDynamicModal();
    logMsg(`💬 <b>${npc.name}</b>: "${ch.outcomeText}"`);

    if (ch.reward) {
      if (ch.reward.gold) state.hero.gold += ch.reward.gold;
      if (ch.reward.hearts) state.hero.hearts = Math.min(state.hero.maxHearts, state.hero.hearts + ch.reward.hearts);
      if (ch.reward.fullHearts) state.hero.hearts = state.hero.maxHearts;
      if (ch.reward.seals) state.hero.bag.item_seal_basic = (state.hero.bag.item_seal_basic || 0) + ch.reward.seals;
      if (ch.reward.silverSeals) state.hero.bag.item_seal_silver = (state.hero.bag.item_seal_silver || 0) + ch.reward.silverSeals;
      if (ch.reward.crimsonSeals) state.hero.bag.item_seal_crimson = (state.hero.bag.item_seal_crimson || 0) + ch.reward.crimsonSeals;
      if (ch.reward.expPlayer) window.Game.grantPlayerExp(ch.reward.expPlayer);
      updateHUD();
    }
    if(ch.rareSpecies){window.Game.startRare(ch.rareSpecies);return;}
    window.Game.save();
    if (ch.triggerAnomaly) {
      window.Game.triggerRandomAnomaly();
      return;
    }
    if (ch.isDuel) {
      const squad = npc.duelSquad.map(id => createMonsterInstance(id, npc.duelLevel, 3));
      window.Game.startBattle('duel', `Khiêu Chiến NPC: ${npc.name}`, squad, npc);
    }
  },

  openAnomalyModal(ev) {
    this.openDynamicModal(ev.title, `
      <div class="lore-section" style="font-size:14px;">${ev.desc}</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
        ${ev.choices.map((c, idx) => `
          <button class="btn-gothic btn-crimson" onclick="window.UI.resolveAnomaly('${ev.id}', ${idx})">${c.label}</button>
        `).join('')}
      </div>
    `);
  },

  resolveAnomaly(evId, idx) {
    const ev = KY_NGO_EVENTS.find(e => e.id === evId);
    const c = ev?.choices[idx];
    if(!c || state.battle || !state.started || state.claimed.includes(evId))return;
    state.claimed.push(evId);
    if (c.costGold && state.hero.gold < c.costGold) { state.claimed.pop(); logMsg('Không đủ Tro Vàng!'); return; }
    if (c.costGold) state.hero.gold -= c.costGold;
    this.closeDynamicModal();
    logMsg(`✦ <b>Kỳ Ngộ:</b> ${c.resultText}`);

    if (c.reward) {
      if (c.reward.fullHeal) { recalcHeroVitals(true); state.party.forEach(m => m.hp = m.maxHp); }
      if (c.reward.hearts) state.hero.hearts = Math.min(state.hero.maxHearts, state.hero.hearts + c.reward.hearts);
      if (c.reward.gold) state.hero.gold += c.reward.gold;
      if (c.reward.crimsonSeals) state.hero.bag.item_seal_crimson = (state.hero.bag.item_seal_crimson || 0) + c.reward.crimsonSeals;
      if (c.reward.statPoints) state.hero.statPoints += c.reward.statPoints;
      if (c.reward.expPlayer) window.Game.grantPlayerExp(c.reward.expPlayer);
      if (c.reward.expMon && state.party[0]) window.Game.grantMonsterExp(state.party[0], c.reward.expMon);
      updateHUD();
    }
    window.Game.save();
    if(c.rareSpecies){window.Game.startRare(c.rareSpecies,c.spawnRareTier);return;}
    if (c.spawnRareTier !== undefined) {
      const mapDef = WORLD_MAPS.find(m => m.id === state.currentMapId);
      window.Game.triggerWildBattle(mapDef, c.spawnRareTier);
    }
  },

  openBanditModal(b) {
    const eff = getEffectiveHeroStats();
    this.openDynamicModal(`🏴‍☠️ PHỤC KÍCH: ${b.name}`, `
      <div class="lore-section" style="font-size:14px;">${b.desc}</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
        <button class="btn-gothic btn-crimson" onclick="window.UI.resolveBandit('${b.name}', 'fight')">⚔ Rút Vũ Khí Chiến Đấu Với Băng Cướp!</button>
        <button class="btn-gothic" ${eff.CHA < 14 && eff.STR < 16 ? 'disabled style="opacity:0.45;"' : ''} onclick="window.UI.resolveBandit('${b.name}', 'intimidate')">
          🔥 [Đe Dọa • CHA ≥ 14 hoặc STR ≥ 16] Khiến chúng khiếp sợ bỏ chạy
        </button>
        <button class="btn-gothic" onclick="window.UI.resolveBandit('${b.name}', 'pay')">💰 Nộp ${b.goldDemand} Tro Vàng để đi qua an toàn</button>
      </div>
    `);
  },

  resolveBandit(bName, mode) {
    const b = BANDIT_ENCOUNTERS.find(x => x.name === bName);
    this.closeDynamicModal();
    if (mode === 'intimidate') {
      const eff=getEffectiveHeroStats();if(eff.CHA<14&&eff.STR<16)return;
      logMsg(`🔥 Khí thế áp đảo của bạn khiến <b>${b.name}</b> bỏ chạy tán loạn!`);
    } else if (mode === 'pay') {
      if(state.hero.gold<b.goldDemand){logMsg('Không đủ lộ phí. Băng cướp không chấp nhận mặc cả.');this.openBanditModal(b);return;}
      const paid = b.goldDemand;
      state.hero.gold -= paid;
      updateHUD();
      logMsg(`💰 Bạn nộp ${paid} Tro Vàng cho <b>${b.name}</b> để mở đường.`);
    } else {
      const mapDef = WORLD_MAPS.find(m => m.id === state.currentMapId);
      const squad = b.squad.map(id => createMonsterInstance(id, mapDef.levelRange[0] + 1, 2));
      window.Game.startBattle('bandit', `Băng Cướp: ${b.name}`, squad, null);
    }
  },

  renderBattle() {
    const b = state.battle;
    if (!b) return;
    const enemy = b.enemies[b.enemyIdx];
    const lead = state.party[0];
    const hStats = getEffectiveHeroStats();
    const teamSpd = Math.round((hStats.SPD + (lead ? lead.spd : hStats.SPD)) / 2);
    const odds = Math.round(window.Game.computeFirstStrikeProb(teamSpd, enemy.spd) * 100);

    document.getElementById('battle-title').textContent = `⚔ ${b.title}`;
    document.getElementById('battle-speed-odds').textContent = `Tốc Độ Phe Ta: ${teamSpd} vs Địch: ${enemy.spd} → Xác suất ra đòn trước: ${odds}%`;

    const sk0 = state.hero.cls.skills[0];
    const sk1 = state.hero.cls.skills[1];

    document.getElementById('battle-body').innerHTML = `
      <div class="battle-arena">
        <div class="combatant-box">
          <div style="font-size:12px;color:var(--accent-gold);font-weight:bold;">PHE TA: ${state.hero.name} (LV.${state.hero.level})</div>
          <div style="font-size:12px;margin-top:4px;">Nhân Vật HP: ${state.hero.hp}/${state.hero.maxHp} | MP: ${state.hero.mp}/${state.hero.maxMp}</div>
          <div class="bar-wrap"><div class="bar-fill" style="width:${(state.hero.hp/state.hero.maxHp)*100}%;background:#d43540;"></div></div>
          <div class="bar-wrap"><div class="bar-fill" style="width:${(state.hero.mp/state.hero.maxMp)*100}%;background:#4dabf7;"></div></div>
          <hr style="border-color:var(--border-dim);margin:8px 0;" />
          ${lead ? `
            <div style="font-size:12px;color:${lead.tier.color};font-weight:bold;">Khế Thú: [${lead.tier.en}] ${lead.name} (LV.${lead.level} • IV ${lead.iv.rank})</div>
            <div style="font-size:11px;">HP: ${lead.hp}/${lead.maxHp} | ATK:${lead.atk} DEF:${lead.def} SPD:${lead.spd}</div>
            <div class="bar-wrap"><div class="bar-fill" style="width:${(lead.hp/lead.maxHp)*100}%;background:#69db7c;"></div></div>
          ` : ''}
        </div>

        <div class="combatant-box" style="border-color:${enemy.tier.color};text-align:center;">
          <div style="font-size:11px;color:${enemy.tier.color};font-weight:bold;">${enemy.tier.code}: ${enemy.tier.name.toUpperCase()} (${enemy.tier.vi})</div>
          <div style="font-size:15px;font-weight:bold;">${enemy.code} ${enemy.name} (LV.${enemy.level})</div>
          <canvas id="battle-enemy-canvas" width="112" height="112" style="margin:4px auto;display:block;background:#0b0912;border-radius:6px;"></canvas>
          <div style="font-size:11px;color:var(--accent-cyan);">Hệ: ${enemy.element} • IV: ${enemy.iv.rank} • Tính cách: ${enemy.personality.name}</div>
          <div style="font-size:12px;margin-top:3px;">HP Địch: ${enemy.hp}/${enemy.maxHp} | ATK:${enemy.atk} DEF:${enemy.def} SPD:${enemy.spd}</div>
          <div class="bar-wrap"><div class="bar-fill" style="width:${(enemy.hp/enemy.maxHp)*100}%;background:#ff4d5e;"></div></div>
        </div>
      </div>

      <div class="battle-actions">
        <button class="btn-gothic btn-crimson" onclick="window.Game.executeBattleTurn('weapon')">⚔ Đánh Vũ Khí (${state.hero.equip.weapon ? state.hero.equip.weapon.scaleStat : 'STR'})</button>
        <button class="btn-gothic" onclick="window.Game.executeBattleTurn('skill', 0)">✦ ${sk0.name} (${sk0.mpCost} MP)</button>
        <button class="btn-gothic" onclick="window.Game.executeBattleTurn('skill', 1)">✦ ${sk1.name} (${sk1.mpCost} MP)</button>
        <button class="btn-gothic" onclick="window.Game.executeBattleTurn('seal', 'item_seal_basic')">🧿 Khế Ấn Tro (${state.hero.bag.item_seal_basic || 0})</button>
        <button class="btn-gothic" onclick="window.Game.executeBattleTurn('seal', 'item_seal_silver')">🧿 Ấn Muối Bạc (${state.hero.bag.item_seal_silver || 0})</button>
        <button class="btn-gothic" onclick="window.Game.executeBattleTurn('seal', 'item_seal_crimson')">🧿 Ấn Huyết Nguyệt (${state.hero.bag.item_seal_crimson || 0})</button>
        <button class="btn-gothic" onclick="window.Game.executeBattleTurn('item', 'item_ash_potion')">🧪 Bình Huyết Tro (${state.hero.bag.item_ash_potion || 0})</button>
        <button class="btn-gothic" onclick="window.Game.executeBattleTurn('item', 'item_beast_salve')">🌿 Cao Chữa Thú (${state.hero.bag.item_beast_salve || 0})</button>
        <button class="btn-gothic" onclick="window.Game.executeBattleTurn('flee')">🏃 Rút Lui</button>
      </div>

      <div style="margin-top:10px;background:#100e17;border:1px solid var(--border-dim);padding:8px;border-radius:5px;max-height:115px;overflow-y:auto;font-size:12px;">
        ${b.logs.map(l => `<div style="margin-bottom:3px;">${l}</div>`).join('')}
      </div>
    `;
    const sp = MONSTERS_200.find(m => m.id === enemy.speciesId);
    setTimeout(() => drawConcept(document.getElementById('battle-enemy-canvas'), sp, 6), 15);
  }
};

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function renderLoop(){renderFrame();requestAnimationFrame(renderLoop);}
function renderFrame() {
  state.tick++;
  const mapDef = WORLD_MAPS.find(m => m.id === state.currentMapId) || WORLD_MAPS[0];
  const grid = buildMapGrid(mapDef);
  const pal = mapDef.palette;

  ctx.fillStyle = '#09080c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const camX = state.px * TILE - canvas.width / 2 + TILE / 2;
  const camY = state.py * TILE - canvas.height / 2 + TILE / 2;

  ctx.save();
  ctx.translate(-camX, -camY);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = grid[y][x];
      const rx = x * TILE, ry = y * TILE;
      drawWorldTile(ctx,rx,ry,t,mapDef,state.tick,x,y);
    }
  }

  ctx.font = '11px sans-serif';
  for (const lm of mapDef.landmarks) {
    const lx = lm.x * TILE, ly = lm.y * TILE;
    drawLandmark(ctx,lx,ly,lm,mapDef,state.tick);
    if(Math.abs(lm.x-state.px)+Math.abs(lm.y-state.py)<5){ctx.fillStyle='#eee0b6';ctx.fillText(lm.name.split('→')[0].trim(),lx-24,ly-42);}

  }

  for (const npc of NPCS_DATA.filter(n => n.mapId === state.currentMapId)) {
    const nx = npc.x * TILE, ny = npc.y * TILE;
    drawHeroSprite(ctx,nx,ny,TILE,'down',state.tick,{cloakColor:npc.color,skinColor:'#bea382'});
    ctx.fillStyle='#d4be80';ctx.fillText('!',nx+12,ny-10);
    ctx.fillStyle = '#ffd43b';
    ctx.fillText(npc.name, nx - 18, ny - 4);
  }

  drawHeroSprite(ctx, state.px * TILE, state.py * TILE, TILE, state.dir, state.tick, state.hero.race);
  ctx.restore();
  drawAtmosphere(ctx,canvas,state,mapDef);

}

window.addEventListener('keydown', e => {
  if(e.target.matches('input,select,textarea'))return;
  const k=e.key.toLowerCase();
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
  if(e.key==='Escape'){window.UI.closeDynamicModal();return;}
  if(!state.started || state.battle)return;
  if(k==='j'){window.UI.openJournal();return;}
  if(k==='i'){window.UI.openInventory();return;}
  const actions={b:'openMonsterCodex',r:'openRaceCodex',c:'openHeroSheet',p:'openPartyModal',m:'openWorldAtlas',k:'openShopModal'};
  if(actions[k]){window.UI[actions[k]]();return;}
  if(document.getElementById('modal-dynamic').classList.contains('active'))return;
  if(k==='w'||e.key==='ArrowUp')window.Game.movePlayer(0,-1);
  if(k==='s'||e.key==='ArrowDown')window.Game.movePlayer(0,1);
  if(k==='a'||e.key==='ArrowLeft')window.Game.movePlayer(-1,0);
  if(k==='d'||e.key==='ArrowRight')window.Game.movePlayer(1,0);
  if(k===' '||k==='enter'||k==='e')window.Game.interactNearby();
});

Object.assign(window.Game,{
 toggleAudio(){return audio.toggle();},
 save(silent=true){try{const ok=saveLocal(state);if(!silent)logMsg(ok?'Đã ghi hành trình tại vùng đất hiện tại.':'Hãy kết thúc giao tranh trước khi lưu.');return ok;}catch(e){logMsg('Không thể lưu: bộ nhớ trình duyệt đã đầy hoặc bị chặn. Hãy xuất bản lưu JSON.');return false;}},
 load(raw=readLocal()){
  if(state.battle)return;
  try{if(!raw){logMsg('Chưa có bản lưu trên trình duyệt này.');return;}const restored=decodeSave(raw,MONSTERS_200,RACES_40,PLAYER_CLASSES,WORLD_MAPS);Object.assign(state,restored);document.getElementById('modal-create').classList.remove('active');window.UI.closeDynamicModal();updateHUD();logMsg('Ngọn đèn còn cháy. Hành trình đã được khôi phục.');}catch(e){logMsg('Không thể đọc bản lưu: '+escapeHTML(e.message));}
 },
 startRare(id,tier=5){const map=WORLD_MAPS.find(m=>m.id===state.currentMapId);this.startBattle('wild','DẤU VẾT HIẾM · Khế ước bị quên',[createMonsterInstance(id,map.levelRange[0]+2,tier)],null);},
 exportSave(){if(!state.started||state.battle)return;const blob=new Blob([encodeSave(state)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Vuc-Tan-Nguyet-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
 claimQuest(id){if(state.battle)return;const q=QUESTS.find(q=>q.id===id);if(!q||state.questClaims.includes(id)||questProgress(q,state)<q.target)return;state.questClaims.push(id);state.hero.gold+=q.reward;state.hero.bag.item_seal_silver+=2;this.grantPlayerExp(q.reward/2);this.save();updateHUD();window.UI.openJournal();},
 chooseEnding(choice){if(state.bosses.length<10||state.ending||!['restore','rule','free'].includes(choice))return;state.ending=choice;this.save();window.UI.openJournal();}
});
const baseParty=window.UI.openPartyModal.bind(window.UI);
Object.assign(window.UI,{
 showCaptureCard(mon){const sp=MONSTERS_200.find(m=>m.id===mon.speciesId);this.openDynamicModal('KHẾ ƯỚC ĐÃ THÀNH · Thẻ sưu tầm mới',`<div class="capture-layout"><article class="gothic-collectible" style="border-color:${mon.tier.color};max-width:330px"><small style="color:${mon.tier.color}">${mon.tier.code} · ${mon.tier.name.toUpperCase()}</small><h2 style="font:28px Georgia;margin:14px 0">${mon.name}</h2><canvas id="capture-art" width="240" height="240"></canvas><p>${mon.code} · ${mon.element} · Lv.${mon.level}</p><p>IV ${mon.iv.rank} · ${mon.personality.name}</p><div class="stat-grid" style="grid-template-columns:1fr 1fr;margin:16px 0"><div>HP ${mon.maxHp}</div><div>ATK ${mon.atk}</div><div>DEF ${mon.def}</div><div>SPD ${mon.spd}</div></div><small>MỘT LỜI HỨA ĐƯỢC GHI VÀO TRO</small></article><div class="chapter-intro"><small>${sp.region}</small><h2>Một sinh linh, một câu chuyện.</h2><p>${sp.temperament}</p><p>${mon.personality.desc}</p><p>Tiềm lực tăng trưởng: ×${(mon.tier.growthMult*mon.iv.mult*(1+(mon.personality.growthBonus||0))).toFixed(2)} trước hệ số từng thuộc tính.</p><button class="btn-gothic" onclick="UI.closeDynamicModal()">Tiếp tục hành trình →</button></div></div>`);drawConcept(document.getElementById('capture-art'),sp);},
 openJournal(){
  const endings={restore:'Ngươi vá lại Trăng Vỡ. Khế thú được bảo hộ bởi lời hứa mới, và các thành phố cùng thắp đèn.',rule:'Ngươi giữ mảnh trăng cho mình. Vực Tàn Nguyệt yên lặng dưới quyền lực của người lập khế.',free:'Ngươi giải phóng tên thật. Không còn lời khế trói buộc; con người phải học cách sống cùng sinh linh.'};
  this.openDynamicModal('NHẬT KÝ · Những lời hứa còn dang dở',`<div class="chapter-intro"><small>CHƯƠNG ${Math.min(7,1+state.bosses.length)} / TRĂNG VỠ</small><h2>Ngọn đèn cuối cùng</h2><p>Đêm mặt trăng vỡ, bốn mươi chủng tộc đánh mất tên người chết. Mười kẻ giữ mảnh trăng canh các vùng sinh thái. Hãy kết khế, tìm người giữ di tích và quyết định cái giá của việc cứu thế giới.</p><p>Đã đến ${state.visited.length}/40 vùng · ${state.wins} chiến thắng · ${state.bosses.length}/10 mảnh trăng · Thiện cảm: ${state.reputation}</p></div><div class="grid-cards">${QUESTS.map(q=>{const p=questProgress(q,state),done=state.questClaims.includes(q.id);return `<article class="dex-card"><small>${done?'ĐÃ HOÀN TẤT':p===q.target?'CÓ THỂ NHẬN THƯỞNG':'ĐANG THỰC HIỆN'}</small><h3>${q.title}</h3><p>${q.desc}</p><progress value="${p}" max="${q.target}"></progress><p>${p}/${q.target} · ${q.reward} tro vàng · 2 ấn bạc</p><button class="btn-gothic" ${done||p<q.target?'disabled':''} onclick="Game.claimQuest('${q.id}')">${done?'Đã nhận':'Nhận thưởng'}</button></article>`;}).join('')}</div><div class="lore-section"><b>Những lựa chọn được ghi nhớ</b>${Object.entries(state.decisions).map(([id,branch])=>`<p>${NPCS_DATA.find(n=>n.id===id)?.name}: ${{mercy:'Giữ lời hứa',knowledge:'Chia sẻ tri thức',power:'Chiếm di vật'}[branch]}</p>`).join('')||'<p>Chưa có lời hứa nào được viết.</p>'}</div>${state.ending?`<div class="chapter-intro"><h2>KẾT CỤC</h2><p>${endings[state.ending]}</p><p>Ngươi vẫn có thể tiếp tục khám phá và hoàn thành bộ sưu tập.</p></div>`:state.bosses.length>=10?`<h3>Mười mảnh trăng đã về tay ngươi</h3><p>Mỗi lựa chọn dưới đây sẽ ghi một kết cục vào bản lưu.</p>${[['restore','Vá lại mặt trăng'],['rule','Giữ quyền lực'],['free','Giải phóng mọi tên thật']].map(([id,t])=>`<button class="btn-gothic" onclick="Game.chooseEnding('${id}')">${t}</button>`).join('')}`:''}`);
 },
 openPartyModal(){baseParty();const body=document.getElementById('dyn-body');state.party.forEach((m,i)=>{const card=body.querySelectorAll('.gothic-collectible')[i],can=document.createElement('canvas');can.width=192;can.height=192;card.prepend(can);drawConcept(can,MONSTERS_200.find(s=>s.id===m.speciesId));if(state.party.length>1)card.insertAdjacentHTML('beforeend',`<button class="btn-gothic" onclick="UI.storeMonster(${i})">Gửi vào kho</button>`);});body.insertAdjacentHTML('beforeend',`<h3 style="margin:24px 0">KHO KHẾ ƯỚC · ${state.storage.length} cá thể</h3><div class="grid-cards">${state.storage.map((m,i)=>`<div class="gothic-collectible" style="border-color:${m.tier.color}"><canvas id="stored-${i}" width="144" height="144"></canvas><h3>${m.name} · Lv.${m.level}</h3><p>${m.tier.name} · IV ${m.iv.rank} · ${m.personality.name}</p><button class="btn-gothic" ${state.party.length>=6?'disabled':''} onclick="UI.withdrawMonster(${i})">Đưa vào đội hình</button></div>`).join('')}</div>`);state.storage.forEach((m,i)=>drawConcept(document.getElementById('stored-'+i),MONSTERS_200.find(s=>s.id===m.speciesId)));},
 storeMonster(i){if(state.battle||state.party.length<=1||!state.party[i])return;state.storage.push(state.party.splice(i,1)[0]);Game.save();updateHUD();this.openPartyModal();},
 withdrawMonster(i){if(state.battle||state.party.length>=6||!state.storage[i])return;state.party.push(state.storage.splice(i,1)[0]);Game.save();updateHUD();this.openPartyModal();},
 openInventory(){this.openDynamicModal('TÚI ĐỒ · Hành trang lữ khách',`<div class="grid-cards">${CONSUMABLES_DB.filter(i=>i.type!=='seal').map(i=>`<article class="dex-card"><h3>${i.name}</h3><p>${i.desc}</p><p>Đang có: ${state.hero.bag[i.id]||0}</p><button class="btn-gothic" ${(state.hero.bag[i.id]||0)<1?'disabled':''} onclick="UI.useItem('${i.id}')">Sử dụng</button></article>`).join('')}</div><h3 style="margin-top:22px">Vật liệu thu thập</h3>${Object.entries(state.hero.materials).map(([k,v])=>`<p>${k} × ${v}</p>`).join('')||'<p>Chưa có vật liệu.</p>'}<button class="btn-gothic" onclick="Game.exportSave()">Xuất bản lưu JSON</button><label class="btn-gothic">Nhập bản lưu JSON<input type="file" accept="application/json" id="save-file" hidden></label>`);document.getElementById('save-file').onchange=async e=>{const f=e.target.files[0];if(f&&f.size<5e6)Game.load(await f.text());};},
 useItem(id){if(state.battle||!state.started)return;const i=CONSUMABLES_DB.find(i=>i.id===id);if(!i||!(state.hero.bag[id]>0)||i.type==='seal')return;if(i.type==='restore_heart'){if(state.hero.hearts>=state.hero.maxHearts)return;state.hero.hearts++;}else if(i.type==='heal_player')state.hero.hp=Math.min(state.hero.maxHp,state.hero.hp+i.value);else if(i.type==='heal_mp')state.hero.mp=Math.min(state.hero.maxMp,state.hero.mp+i.value);else if(i.type==='heal_mon'&&state.party[0])state.party[0].hp=Math.min(state.party[0].maxHp,state.party[0].hp+i.value);state.hero.bag[id]--;audio.playHeal();updateHUD();Game.save();this.openInventory();}
});
const oldUpdate=updateHUD;
updateHUD=function(){oldUpdate();const map=WORLD_MAPS.find(m=>m.id===state.currentMapId);document.getElementById('location-name').textContent=map.name.replace(/^\d+[A-Z]?\. /,'').split(':').pop();document.getElementById('location-biome').textContent=map.biomeTag;document.getElementById('zone-level').textContent=`LV ${map.levelRange.join(' — ')}`;document.getElementById('collection-count').textContent=state.caughtMonsters.size+' / 200';const q=QUESTS.find(q=>!state.questClaims.includes(q.id));document.getElementById('tracked-quest').textContent=q?`${q.title} · ${questProgress(q,state)}/${q.target}`:'Những lời hứa đã hoàn tất';};
const baseBattle=UI.renderBattle.bind(UI);
UI.renderBattle=function(){baseBattle();const options=state.party.map((m,i)=>i>0&&m.hp>0?`<button class="btn-gothic" onclick="Game.executeBattleTurn('switch',${i})">Đổi sang ${m.name} (${m.hp} HP)</button>`:'').join('');document.querySelector('.battle-actions').insertAdjacentHTML('beforeend',`<button class="btn-gothic" onclick="Game.executeBattleTurn('item','item_ether_dew')">Hồi MP (${state.hero.bag.item_ether_dew||0})</button>${options}`);};
for(const name of ['openHeroSheet','openPartyModal','openWorldAtlas','openShopModal','openJournal','openInventory','openMonsterCodex','openRaceCodex']){const fn=UI[name].bind(UI);UI[name]=function(...args){if(!state.started||state.battle)return;return fn(...args);};}
for(const name of ['buyEquipment','buyConsumable','addStatPoint','switchHeroClass','setLeadMonster']){const fn=UI[name].bind(UI);UI[name]=function(...args){if(!state.started||state.battle)return;const result=fn(...args);Game.save();return result;};}
setInterval(()=>{if(state.started&&!state.battle)Game.save();},12000);
window.addEventListener('pagehide',()=>Game.save());
document.getElementById('btn-load').disabled=!readLocal();
for(const btn of document.querySelectorAll('[data-move]')){const go=()=>{const [x,y]=btn.dataset.move.split(',').map(Number);Game.movePlayer(x,y);};let timer;btn.onpointerdown=e=>{e.preventDefault();go();timer=setInterval(go,145);btn.setPointerCapture(e.pointerId);};btn.onpointerup=btn.onpointercancel=()=>clearInterval(timer);}

window.UI.renderRaceChoices();
window.UI.renderClassAndStarters();
renderLoop();

const intro=document.getElementById('prologue-art'),introCtx=intro.getContext('2d');
for(let y=0;y<6;y++)for(let x=0;x<10;x++)drawWorldTile(introCtx,x*32,y*32,(x+y)%4===0?2:0,WORLD_MAPS[0],0,x,y);
drawLandmark(introCtx,140,96,{type:'portal'},WORLD_MAPS[0],0);
drawHeroSprite(introCtx,140,140,32,'up',0,RACES_40[0]);
// Keep the map at native pixel scale when the layout or orientation changes.
new ResizeObserver(()=>{const w=Math.floor(canvas.clientWidth),h=Math.floor(canvas.clientHeight);if(w>0&&h>0&&(canvas.width!==w||canvas.height!==h)){canvas.width=w;canvas.height=h;renderFrame();}}).observe(canvas);
