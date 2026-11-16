import { MONSTER_TIERS, IV_RANKS, MONSTER_PERSONALITIES, EQUIPMENT_DB } from '../data/items_classes.js';
const SAVE_KEY=typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('test')?'vuc-tan-nguyet-v3-test':'vuc-tan-nguyet-v3';
export function encodeSave(state){return JSON.stringify({version:3,at:Date.now(),data:{...state,tick:0,mapTiles:{},battle:null,seenMonsters:[...state.seenMonsters],caughtMonsters:[...state.caughtMonsters]}});}
export function decodeSave(raw,monsters,races,classes,maps){
 const save=JSON.parse(raw);if(save.version!==3||!save.data||!save.data.started)throw Error('Định dạng bản lưu không hợp lệ.');
 const s=save.data;
 for(const key of ['visited','bosses','claimed','questClaims','seenMonsters','caughtMonsters'])if(!Array.isArray(s[key])||s[key].some(v=>typeof v!=='string'))throw Error('Tiến trình không hợp lệ.');
 if(!s.decisions||typeof s.decisions!=='object'||!Number.isFinite(s.wins)||s.wins<0||!s.hero.bag||!s.hero.equip)throw Error('Hành trang không hợp lệ.');
 for(const value of Object.values(s.hero.bag))if(!Number.isInteger(value)||value<0)throw Error('Số lượng vật phẩm không hợp lệ.');
 if((s.storage?.length||0)>2000)throw Error('Kho vượt giới hạn bản lưu.');
 if(!races.some(r=>r.id===s.hero?.race?.id)||!classes.some(c=>c.id===s.hero?.cls?.id)||!maps.some(m=>m.id===s.currentMapId))throw Error('Bản lưu chứa danh tính hoặc bản đồ không hợp lệ.');
 if(!Array.isArray(s.party)||s.party.length<1||s.party.length>6||!Array.isArray(s.storage))throw Error('Đội hình không hợp lệ.');
 for(const mon of [...s.party,...s.storage]){if(!monsters.some(m=>m.id===mon.speciesId)||!Number.isFinite(mon.hp)||!Number.isFinite(mon.maxHp)||mon.maxHp<=0||mon.hp<0||mon.hp>mon.maxHp||mon.level<1||mon.tierIdx<0||mon.tierIdx>9)throw Error('Khế thú không hợp lệ.');}
 for(const key of ['level','gold','hearts','statPoints','hp','mp'])if(!Number.isFinite(s.hero[key])||s.hero[key]<0)throw Error('Chỉ số bản lưu không hợp lệ.');
 for(const v of Object.values(s.hero.stats||{}))if(!Number.isFinite(v)||v<0)throw Error('Thuộc tính không hợp lệ.');
 if(!Number.isInteger(s.px)||!Number.isInteger(s.py)||s.px<1||s.px>30||s.py<1||s.py>30)throw Error('Vị trí không hợp lệ.');
 if(typeof s.hero.name!=='string')throw Error('Tên không hợp lệ.');
 s.hero.name=s.hero.name.replace(/[<>&"']/g,'').slice(0,24);
 for(const mon of [...s.party,...s.storage]){
  const sp=monsters.find(m=>m.id===mon.speciesId),iv=IV_RANKS.find(i=>i.rank===mon.iv?.rank),personality=MONSTER_PERSONALITIES.find(p=>p.id===mon.personality?.id);
  if(!iv||!personality||!['atk','def','mag','spd','exp','nextExp'].every(k=>Number.isFinite(mon[k])&&mon[k]>=0))throw Error('Tăng trưởng cá thể không hợp lệ.');
  Object.assign(mon,{name:sp.name,code:sp.code,element:sp.element,tier:MONSTER_TIERS[mon.tierIdx],iv,personality});
 }
 for(const slot of ['weapon','armor','relic']){const eq=s.hero.equip[slot];if(!eq)continue;const canonical=EQUIPMENT_DB.find(e=>e.id===eq.id&&e.slot===slot);if(!canonical||!Number.isInteger(eq.plus)||eq.plus<0||eq.plus>10)throw Error('Trang bị không hợp lệ.');s.hero.equip[slot]={...canonical,plus:eq.plus};}
 if(Object.keys(s.hero.stats).length!==8||!['STR','CON','DEF','SPD','DEX','INT','WIS','CHA'].every(k=>Number.isFinite(s.hero.stats[k])))throw Error('Thiếu thuộc tính nhân vật.');
 s.hero.race=races.find(r=>r.id===s.hero.race.id);s.hero.cls=classes.find(c=>c.id===s.hero.cls.id);
 s.seenMonsters=new Set(s.seenMonsters);s.caughtMonsters=new Set(s.caughtMonsters);s.battle=null;s.mapTiles={};return s;
}
export function saveLocal(state){if(!state.started||state.battle)return false;localStorage.setItem(SAVE_KEY,encodeSave(state));return true;}
export function readLocal(){try{return localStorage.getItem(SAVE_KEY);}catch{return null;}}
export function initiativeProbability(a,b){const p=Math.max(1,a)**1.25,e=Math.max(1,b)**1.25;return Math.min(.88,Math.max(.12,p/(p+e)));}
// Carve a connected, walkable road network to every landmark and NPC.
export function connectMap(grid,points){for(const {x,y} of [{x:8,y:8},{x:9,y:9},...points]){let cx=16,cy=16;grid[cy][cx]=0;while(cx!==x){cx+=Math.sign(x-cx);grid[cy][cx]=0;}while(cy!==y){cy+=Math.sign(y-cy);grid[cy][cx]=0;}for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(grid[y+dy]?.[x+dx]!==undefined&&y+dy>0&&y+dy<31&&x+dx>0&&x+dx<31)grid[y+dy][x+dx]=0;}return grid;}
export function questProgress(q,s){return Math.min(q.target,({capture:s.caughtMonsters.size,explore:s.visited.length,win:s.wins,rare:[...s.caughtMonsters].filter(x=>Number(x.slice(2))%20===19).length,boss:s.bosses.length})[q.type]||0);}
