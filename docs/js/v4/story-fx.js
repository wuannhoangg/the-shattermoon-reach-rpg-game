(function (g) {
  'use strict';
  /* VTNStoryFx — condition atoms and effect lists of the finished regional dialogue (cot_truyen GĐ7 format).
   * Conditions:  "flag:x" "flag:x=v" "notFlag:x" "stat:CHA>=12" "stat:KHE_HON=S" "rep:faction_02>=5" "race:R-05" "raceGroup:g" "class:class_09"
   *              "item:x" "region:region_01=burned" "tag:h_mercy:dominant" "scene:ID" "quest:id" "corruption>=40" "hasMonster:M-002"
   *              "day>=12" "ending:x" "chosen:id" (inside the running scene), plus {all:[..]} / {any:[..]}.
   * Effects:     [{set:[..]},{unset:[..]},{aff:'npc:+2'},{tag:'h_truth'},{heroExp:'+'},{item:'+id'|'-id*2'},{gold:'+60'},{rep:{faction_02:-3}},
   *              {pact:'M-019=welcome'},{corruption:'+2'},{time:'+1d'},{battle:'M019_x'|'M-020'},{unlock:'T1-C1'},{name:'+a,+b'},
   *              {region:'region_01=burned'},{delayed:{id,after:'4d'}},{loot:'M-019'},{journal:'A,B'},{memory:'choose'},{lock:'flag'},
   *              {overlord:'overlord_r01:option'}].  World actions (battle, overlord, time) are deferred until the scene closes. */
  const R = () => g.VTNRules, D = () => g.VTN_DATA || {}, game = () => g.VTNGame, S = () => game()?.storyState?.();
  const num = v => Number(String(v).replace(/[^\d.+-]/g, '')) || 0;
  const RANKS = ['D', 'C', 'B', 'A', 'S', 'S+', 'S++'];
  function ensure(s) {
    s.flags ??= {}; s.scenesSeen ??= []; s.storyAff ??= {}; s.heroTags ??= {}; s.storyItems ??= {}; s.storyNames ??= []; s.storyJournal ??= [];
    s.storyCounters ??= {}; s.regionEnergy ??= {}; s.storyResources ??= {}; s.pacts ??= {}; s.storyTimers ??= []; s.regionStates ??= {};
    s.cast ??= {};
    const khoi=s.cast.khoi ??= {state:'unknown',relationship:0};
    khoi.trust ??= 4; khoi.wound ??= 3; khoi.bond ??= 0; khoi.lifeState ??= ['dead','sacrificed'].includes(khoi.state)?'dead':'alive';
    // basic supplies the regional dialogue expects (salt for the camp, two Ash Echoes for the Cây Mẹ questions)
    if (!s.flags.storySuppliesGiven && s.hero?.bag) { s.flags.storySuppliesGiven = true; s.hero.bag.muoi = (s.hero.bag.muoi || 0) + 2; s.hero.bag.ash_echo = (s.hero.bag.ash_echo || 0) + 2; }
    sync(s);
    return s;
  }
  function sync(s) {
    const f = s.flags, c = s.storyCounters;
    const khoi=s.cast?.khoi;
    if(khoi){f.khoiTrust=khoi.trust;f.khoiWound=khoi.wound;f.khoiBond=khoi.bond;
      if(['dead','sacrificed'].includes(khoi.state))khoi.lifeState='dead';
      f.khoi_life=khoi.lifeState || 'alive';}
    c.namesBrought = Math.max(c.namesBrought || 0, s.storyNames.length);
    c.tClues = new Set(Object.values(s.clues2 || {}).flat()).size;
    for (const [id, value] of Object.entries(f)) {
      const m = id.match(/^r(\d\d)_energy$/);
      if (m && ['weapon','people','nature'].includes(value)) s.regionEnergy['region_' + m[1]] = value;
    }
    f.r02_evidence = !!(f.r02_slavers_known || f.r02_old_flag_read);
    f.r02_gates_two = ['tide','port','red'].filter(k => f['r02_gate_' + k + '_talk']).length >= 2;
    f.r40_route_chosen = ['rock','cave','market'].some(k => f['r40_route_' + k]);
    const materials = Number(hasItem(s,'giot_thuy_tinh_le_pha')) + Number(hasItem(s,'manh_dong_diem_chung')) + Number(!!f.r08_lullaby_known);
    f.r08_materials_three = materials === 3; f.r08_materials_two = materials >= 2;
    for (const who of ['khoi','huy','vy','bao']) {
      const ally = ['ally','joined','trusted'].includes(s.cast?.[who]?.state) && (who!=='khoi'||(!f.cut_khoi && !f.khoi_tanguyet && f.khoi_life==='alive'));
      f['companion_' + who] = ally; if (who === 'bao') f.bao_in_party = ally;
    }
    f.lt_confessed = !!f.keeperConfessed;
    f.t1_c4_known = (s.clues2?.T1 || []).includes('T1-C4');
    if (f.r01_energy === 'nature') {
      const n = c.r01_supplies || 0;
      f.r01_supply_full = n >= 6; f.r01_supply_part = n > 0 && n < 6; f.r01_supply_none = n === 0;
    }
  }
  function cmp(a, op, b) { switch (op) { case '>=': return a >= b; case '<=': return a <= b; case '>': return a > b; case '<': return a < b; case '!=': return a !== b; default: return a === b; } }
  function rankAt(s) { return RANKS.indexOf(s?.hero?.talent?.rank || 'D'); }
    const ALIAS = { luong_thuc: 'food', com: 'food', so_ten: 'so_ten_rua', giot_thuy_tinh_le_pha: 'glass_slow_drop' };
  function hasItem(s, id) {
    const [rawId, count] = String(id).split('*'); id = ALIAS[rawId] || rawId; const need = Math.max(1, Number(count) || 1);
    if (id === 'home_anchor') return (s.homeMemories || 0) > 0;
    if (id.startsWith('name_')) return s.storyNames.includes(id.slice(5));
    return (s.storyItems[id] || 0) + (s.hero?.bag?.[id] || 0) >= need;
  }
  function monsters(s) { return [...(s.party || []), ...(s.storage || [])]; }
  function atom(raw, s, ctx = {}) {
    const t = String(raw).replace(/[()]/g, '').trim();
    if (!t) return true;
    const clueCount = tier => (s.clues2?.[tier] || []).length;
    const metrics = {gold:s.hero?.gold ?? s.gold ?? 0, day:s.day || 1, corruption:s.hero?.corruption || 0,
      routeCount:['route_cat','route_tunnel','route_mask','route_paper'].filter(k=>s.flags[k]).length,
      tClues:s.storyCounters.tClues || 0,t3Clues:clueCount('T3'),overlordsResolved:s.overlordsResolved || 0,
      namesBrought:s.storyCounters.namesBrought || 0,namesReadable:s.storyCounters.namesReadable ?? s.storyNames.length,
      childNames:s.storyCounters.childNames || 0,homeAnchor:s.homeMemories || 0,
      lampSources:Object.values(s.regionEnergy).filter(v=>v==='people'||v==='nature').length};
    let m=t.match(/^(\w+)\s*(>=|<=|==|!=|>|<|=)\s*([\w.+-]+)$/);
    if(m){const a=metrics[m[1]] ?? s.storyCounters[m[1]] ?? s.flags[m[1]] ?? 0;
      const b=Number.isFinite(Number(m[3]))?Number(m[3]):(s.storyCounters[m[3]] ?? s.flags[m[3]] ?? Infinity);
      return cmp(Number(a),m[2],Number(b));}
    if(t==='t3Confirmed')return !!s.reveals?.T3;
    m = t.match(/^([a-zA-Z]+):(.*)$/); if (!m) return !!s.flags[t];
    const [, k, v] = m;
    switch (k) {
      case 'flag': { const [f, val] = v.split('='); return val === undefined ? !!s.flags[f] : String(s.flags[f]) === val; }
      case 'notFlag': { const [f, val] = v.split('='); return val === undefined ? !s.flags[f] : String(s.flags[f]) !== val; }
      case 'stat': {
        const x = v.match(/^([A-Z_]+)\s*(>=|<=|!=|>|<|=)\s*(.+)$/); if (!x) return false;
        if (x[1] === 'KHE_HON') return cmp(rankAt(s), x[2] === '=' ? '>=' : x[2], RANKS.indexOf(x[3]));
        const st = R()?.heroStats?.(s)?.[x[1]] ?? s.hero?.stats?.[x[1]] ?? 0; return cmp(Number(st), x[2], Number(x[3]));
      }
      case 'rep': { const x = v.match(/^([\w]+)\s*(>=|<=|!=|>|<|=)\s*(-?\d+)$/); return x ? cmp(Number(s.factions?.[x[1]] || 0), x[2], Number(x[3])) : false; }
      case 'race': return s.hero?.raceId === v;
      case 'raceGroup': return (R()?.raceGroup?.(s.hero?.raceId) || '') === v || R()?.by?.('races',s.hero?.raceId)?.group === v;
      case 'class': return s.hero?.classId === v;
      case 'item': return hasItem(s, v);
      case 'region': { const [r, st] = v.split('='); return st === undefined ? !!s.regionStates[r] : s.regionStates[r] === st; }
      case 'tag': {
        const [tag, mode] = v.split(':'), n = s.heroTags[tag] || 0;
        if (mode === 'dominant') return n > 0 && Object.values(s.heroTags).every(o => o <= n);
        return n > 0;
      }
      case 'scene': return s.scenesSeen.includes(v) || (v==='LTM_L3' && !!s.flags.keeperConfessed);
      case 'quest': return (v==='bell_puzzle_r01' && !!s.flags.puzzle_region_01_area_1) || !!s.flags[v] || !!s.flags['quest_' + v] || !!s.q?.done?.[v];
      case 'clue': return Object.values(s.clues2 || {}).some(list=>list.includes(v));
      case 'soulPact': return rankAt(s)>=RANKS.indexOf(v);
      case 'summoned': { const [id,rule]=v.split(':'), c=s.cast?.[id]; if(!c)return false;
        if(rule==='alive')return !['dead','sacrificed'].includes(c.state) && c.lifeState!=='dead';
        if(rule==='available')return !['dead','sacrificed','missing','enemy','unknown','imprisoned'].includes(c.state) && !['dead','imprisoned'].includes(c.lifeState);
        return rule==='ally' && ['ally','joined','trusted'].includes(c.state); }
      case 'state': { const [id,st]=v.split('='); const m=id.match(/^overlord_M(\d+)$/); return s.flags[id]===st || s.overlordState?.[m ? 'region_'+String(Math.ceil(Number(m[1])/20)).padStart(2,'0') : id]===st; }
      case 'event': return !!s.flags[v];
      case 'battle': return !!s.flags['battle_'+v+'_won'] || !!s.flags['defeated_'+v.replace(/^M(\d)/,'M-$1')];
      case 'hasMonster': return monsters(s).some(mo => mo.speciesId === v);
      case 'ending': { const aliases={repair:'han_nguyet',eclipse:'nguyet_thuc',sacrifice:'tan_nguyet',shatter:'toai_tan',nameless:'vo_danh',HN:'han_nguyet',NT:'nguyet_thuc',TN:'tan_nguyet',TT:'toai_tan',VD:'vo_danh','Hàn Nguyệt':'han_nguyet','Nguyệt Thực':'nguyet_thuc','Tân Nguyệt':'tan_nguyet','Toái Tận':'toai_tan','Vô Danh':'vo_danh'}; return (aliases[s.ending]||s.ending)===(aliases[v]||v); }
      case 'chosen': return !!ctx.selected?.has?.(v);
      case 'pact': { const [sp, val] = v.split('='); return val === undefined ? !!s.pacts[sp] : s.pacts[sp] === val; }
      default: return !!s.flags[t];
    }
  }
  function test(cond, s = S(), ctx = {}) {
    if (!cond) return true; if (!s) return false; ensure(s);
    if (typeof cond === 'string') {
      cond = cond.trim();
      const split = op => { let depth = 0, start = 0; const parts = []; for (let i=0;i<cond.length;i++) { if(cond[i]==='(')depth++; if(cond[i]===')')depth--; if(!depth&&cond[i]===op){parts.push(cond.slice(start,i));start=i+1;} } parts.push(cond.slice(start)); return parts; };
      const or = split('|'); if (or.length > 1) return or.some(c => test(c,s,ctx));
      const and = split('&'); if (and.length > 1) return and.every(c => test(c,s,ctx));
      if (cond.startsWith('(') && cond.endsWith(')')) return test(cond.slice(1,-1),s,ctx);
      return atom(cond, s, ctx);
    }
    if (Array.isArray(cond.all)) return cond.all.every(c => test(c, s, ctx));
    if (Array.isArray(cond.any)) return cond.any.some(c => test(c, s, ctx));
    return false;
  }
  function regionLevel(s) {
    const map = R()?.by?.('maps', s.mapId), reg = R()?.by?.('regions', map?.regionId || 'region_01');
    return Math.max(2, reg?.recommendedLevel?.[1] || 5);
  }
  function speciesOf(code) { const m = String(code).match(/M-?(\d{3})/); return m ? 'M-' + m[1] : null; }
  function itemName(id) { return R()?.by?.('items', id)?.name || id.replace(/_/g, ' '); }
  // returns a list of deferred world actions
  function apply(list, ctx = {}) {
    const s = S(); if (!s || !Array.isArray(list)) return [];
    ensure(s);
    const Q = game()?.quests, deferred = [], toast = msg => game()?.toast?.(msg) ?? Q?.applyEffects?.({ toast: msg });
    for (const e of list) for (const [k, v] of Object.entries(e)) {
      switch (k) {
        case 'cast': {
          Q?.applyEffects?.({castState:v});
          const c=s.cast?.khoi;
          if(c)for(const key of ['trust','wound','bond'])c[key]=Math.max(key==='wound'&&s.flags.khoi_grave_harm?1:0,Math.min(10,Number(c[key])||0));
          break;
        }
        case 'defaults': for(const [key,value] of Object.entries(v))s.flags[key] ??= value; break;
        case 'castResolve': {
          if(v!=='convoy')break;
          const c=s.cast.khoi;
          if(['dead','imprisoned'].includes(c.lifeState)){s.flags.khoi_convoy_decided=true;break;}
          const stance=s.flags.khoi_convoy_route?'defiant':s.flags.khoi_dai_khe_committed?'tan_nguyet':'inside';
          c.stance=stance;s.flags.khoi_convoy_decided=true;
          s.flags.khoi_tanguyet=stance==='tan_nguyet';
          if(stance==='tan_nguyet'){c.state='enemy';s.flags.faction_07_branch='tan_nguyet';}
          else if(stance==='defiant'){c.state='met';s.flags.khoi_lost_title=true;}
          break;
        }
        case 'questChoice': { const [qid,option]=v.split(':'); Q?.choose?.(qid,option); break; }
        case 'value': Object.assign(s.flags,v); break;
        case 'counter': { const [id,d]=String(v).split(':');s.storyCounters[id]=(s.storyCounters[id]||0)+num(d);break; }
        case 'namesBrought': s.storyCounters.namesBrought=(s.storyCounters.namesBrought||0)+num(v);break;
        case 'regionEnergy': { const [id,val]=String(v).split(':');s.regionEnergy[id]=val;break; }
        case 'resource': { const [id,d]=String(v).split(':');if(id==='homeAnchor')s.homeMemories=Math.max(0,(s.homeMemories||0)+num(d));else s.storyResources[id]=Math.max(0,(s.storyResources[id]||0)+num(d));break; }
        case 'clock': case 'schedule': { const [id,d]=String(v).split(':'); const at=Number(s.day||1)+num(d);s.storyCounters[id]=at;if(!s.storyTimers.some(t=>t.id===id&&!t.done))s.storyTimers.push({id,at,done:false});break; }
        case 'worldClock': deferred.push({time:v});break;
        case 'bond': for(const m of s.party||[])m.bond=Math.max(0,Math.min(100,(m.bond||0)+num(v)));break;
        case 'next': deferred.push({next:v});break;
        case 'lateHeart': deferred.push({lateHeart:v});break;
        case 'endings': deferred.push({endings:true});break;
        case 'overlordState': { const rid=R()?.by?.('maps',s.mapId)?.regionId || 'region_01';s.overlordState??={};
          const entries=typeof v==='string'?[[rid,v]]:Object.entries(v);
          for(const [id,val] of entries){const region=id.startsWith('M-')?'region_'+String(Math.ceil(Number(id.slice(2))/20)).padStart(2,'0'):id;s.overlordState[region]=val;s.flags['overlord_'+id.replace('-','')]=val;s.flags['overlord_r'+region.slice(-2)+'_resolved']=val!=='sleeping';}
          s.overlordsResolved=Object.values(s.overlordState).filter(v=>['sealed','heartRestored','permanentlyDead','temporarilyFreed'].includes(v)).length;break; }
        case 'set': for (const f of [].concat(v)) { const [a, b] = String(f).split('='); s.flags[a] = b === undefined ? (s.flags[a] || true) : b; } break;
        case 'unset': for (const f of [].concat(v)) delete s.flags[String(f).split('=')[0]]; break;
        case 'lock': s.flags['locked_' + v] = true; break;
        case 'aff': { const [who, d] = String(v).split(':'); s.storyAff[who] = (s.storyAff[who] || 0) + num(d); break; }
        case 'tag': s.heroTags[v] = (s.heroTags[v] || 0) + 1; break;
        case 'heroExp': Q?.applyEffects?.({ exp: v === '+' || !num(v) ? 40 + regionLevel(s) * 18 : num(v) }); break;
        case 'gold': Q?.applyEffects?.({ gold: num(v) }); break;
        case 'rep': { const value=typeof v==='string'?{[v.split(':')[0]]:num(v.split(':')[1])}:v;Q?.applyEffects?.({ rep:value }); } break;
        case 'corruption': Q?.applyEffects?.({ corruption: num(v) }); break;
        case 'item': for (const part of String(v).split(',')) {
          const m = part.trim().match(/^([+-])([\p{L}\p{N}_-]+)(?:\*(\d+))?$/u); if (!m) continue;
          const id = ALIAS[m[2]] || m[2], n = Number(m[3] || 1) * (m[1] === '-' ? -1 : 1);
          if (R()?.by?.('items', id)) { s.hero.bag[id] = Math.max(0, (s.hero.bag[id] || 0) + n); } else s.storyItems[id] = Math.max(0, (s.storyItems[id] || 0) + n);
          if (n > 0) toast('Nhận: ' + itemName(id));
        } break;
        case 'name': for (const part of String(v).split(',')) { const id = part.trim().replace(/^\+/, ''); if (id && !s.storyNames.includes(id)) s.storyNames.push(id); } toast('Sổ Tên có thêm tên mới.'); break;
        case 'journal': for (const n of String(v).split(',')) { const t = n.trim(); if (t && !s.storyJournal.includes(t)) { s.storyJournal.push(t); if (/^T[123]-C[1-5]$/.test(t)) Q?.applyEffects?.({addClue:t}); } } break;
        case 'pact': { const [sp, val] = String(v).split('='); s.pacts[sp] = val; break; }
        case 'region': { const [r, st] = String(v).split('='); s.regionStates[r] = st; break; }
        case 'unlock': Q?.applyEffects?.({ addClue: v }); break;
        case 'memory': s.flags.pendingMemoryChoice = true; break;
        case 'loot': { const sp = speciesOf(v); if (sp) { s.hero.bag['loot_' + sp] = (s.hero.bag['loot_' + sp] || 0) + 1; toast('Nhận: chiến lợi phẩm ' + (R()?.by?.('monsters', sp)?.name || sp)); } break; }
        case 'delayed': { const raw=typeof v==='string'?{id:v.split('@')[0],after:v.split('@')[1]}:v;const d=num(raw.after);const rid=R()?.by?.('maps',s.mapId)?.regionId;if(raw.id&&!s.storyTimers.some(t=>t.id===raw.id&&!t.done))s.storyTimers.push({id:raw.id,at:Number(s.day||1)+d,done:false,regionId:rid});break; }
        case 'countdown_after_accept': break;   // the timer starts with the "accept" choice (delayed r01_deadline)
        case 'overlord': { if(typeof v==='string'&&v.includes('=')){const [id,val]=v.split('=');apply([{overlordState:{[id]:val}}],ctx);}else deferred.push({overlord:v});break; }
        case 'time': case 'battle': deferred.push({ [k]: v }); break;
        case 'stay': break;
        default: console.warn('[story-fx] unknown effect', k, v);
      }
    }
    sync(s); game()?.save?.();
    return deferred;
  }
  function runDeferred(list) {
    const s = S(); if (!s) return;
    for (const d of list || []) {
      if(d.next)setTimeout(()=>g.VTNStory?.startScene(d.next),0);
      if (d.time) { const n = num(d.time) || 1; s.day = Number(s.day || 1) + n; s.daysSinceSummon = Number(s.daysSinceSummon || 1) + n; tick(); }
      if (d.overlord) { const [ov, opt] = String(d.overlord).split(':'); game()?.resolveOverlordChoice?.(ov, opt); }
      if (d.lateHeart) game()?.act?.('overlord-heart',d.lateHeart);
      if (d.endings) game()?.act?.('endings');
      if (d.battle) {
        if(d.battle==='KHOI_SPP'){
          const opponent=g.VTNAdventure?.humanOpponent?.(R(),'rival',null,s,{name:'Tạ Minh Khôi',level:55});
          if(opponent){opponent.castKey='khoi';opponent.talentRank='S++';game()?.beginBattle?.('human',[],'KHOI_SPP',{opponent,storyBattle:'KHOI_SPP'});}
          continue;
        }
        const human={r13_guards:{npc:'npc_R-13_0',name:'Lính giữ phường dệt'},R34_LUU_TINH:{npc:'npc_R-34_0',name:'Lưu Tinh'}}[d.battle];
        if(human){const opponent=g.VTNAdventure?.humanOpponent?.(R(),'human',human.npc,s,{name:human.name,level:regionLevel(s)});if(opponent)game()?.beginBattle?.('human',[],human.npc,{opponent,storyBattle:d.battle});continue;}
        const sp = speciesOf(d.battle); if (!sp || sp === 'M-020') continue;
        if (sp === 'M-200') { game()?.beginBattle?.('boss', [R().spawnBoss(sp, Math.max(45, regionLevel(s)))], 'region_10', {finalBoss:true,battleBackgroundRegion:'region_10'}); continue; }
        const lvl = regionLevel(s), enemies = [R().spawnWild(sp, Math.max(2, lvl - 1))];
        if (/fight|siege|hunted|loop|trail/.test(d.battle)) enemies.push(R().spawnWild(sp, Math.max(2, lvl - 2)));
        setTimeout(() => game()?.beginBattle?.('wild', enemies), 60);
      }
    }
  }
  // timers that became due: scene ids become playable, other ids become flags
  function tick() {
    const s = S(); if (!s) return; ensure(s);
    for (const t of s.storyTimers) if (!t.done && (!t.regionId || t.regionId===R()?.by?.('maps',s.mapId)?.regionId) && Number(s.day || 1) >= t.at) { t.done = true; s.flags[t.id + '_due'] = true; if (!/^[A-Z]/.test(t.id)) s.flags[t.id] = true; }
  }
  function markSeen(id) { const s = S(); if (!s) return; ensure(s); if (!s.scenesSeen.includes(id)) { s.scenesSeen.push(id); const sc = Object.values(D().storyRegions || {}).flatMap(p => p.scenes || []).find(sc => sc.id === id); if (sc?.completionEffects) runDeferred(apply(sc.completionEffects)); } sync(s); game()?.quests?.markDirty?.(); }
  g.VTNStoryFx = { test, atom, apply, runDeferred, tick, markSeen, ensure };
})(globalThis);
