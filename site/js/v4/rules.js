(function(g){'use strict';
  const D=g.VTN_DATA,by=(key,id)=>D[key].find(v=>v.id===id||(key==='encounters'&&v.regionId===id)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),clone=v=>JSON.parse(JSON.stringify(v));
  const defaultWeights={
   weaponFamilyByIndex:{0:'sword',1:'greatsword',2:'dagger',3:'spear',4:'axe',5:'hammer',6:'scythe',7:'bow',8:'crossbow',9:'staff',10:'spellbook',11:'bell',12:'chainWhip',13:'warFan',14:'trident',15:'claw',16:'spiritCage'},
   weaponBase:{dagger:1.5,sword:3,greatsword:7,spear:4,axe:5,hammer:7,scythe:5,bow:2,crossbow:4,staff:2.5,spellbook:1.5,bell:2,chainWhip:3,warFan:1.5,trident:4.5,claw:2,spiritCage:2.5},
   armourBaseBySlot:{head:2,body:6,hands:1.5,feet:2.5,cloak:1.5,rings:.2,amulet:.2},
   capacity:{base:10,strength:1.2},speed:{baseWalkingSpeed:2.8,dexCap:40,dexBonusPerPoint:.006,minimumOverCapacityFactor:.45,overCapacityPenalty:.9}
  };
 function mergeAbyssData(){
  if(D.__abyssMerged)return;
  const pack=D.maps_abyss||{},maps=Array.isArray(pack)?pack:(pack.maps||[]);
  D.maps??=[];for(const map of maps)if(map?.id&&!D.maps.some(v=>v.id===map.id))D.maps.push(map);
  const surface=D.maps.find(v=>v.id==='region_01'),tomb=D.maps.find(v=>v.id==='abyss_tomb');
  if(surface&&tomb){surface.links??=[];if(!surface.links.includes(tomb.id))surface.links.push(tomb.id);tomb.links??=[];if(!tomb.links.includes(surface.id))tomb.links.push(surface.id);}
  D.dialogues??=[];for(const dialogue of pack.dialogues||[])if(dialogue?.id&&!D.dialogues.some(v=>v.id===dialogue.id))D.dialogues.push(dialogue);
  D.__abyssMerged=true;
 }
 mergeAbyssData();
 function mergeP9Data(){
  if(D.__p9Merged)return;
  const extra=Array.isArray(D.items_extra)?D.items_extra:[];
  D.items??=[];for(const item of extra)if(item?.id&&!D.items.some(v=>v.id===item.id))D.items.push(item);
  const pack=D.maps_lairs||{},maps=Array.isArray(pack)?pack:(pack.maps||[]);
  D.maps??=[];for(const map of maps)if(map?.id&&!D.maps.some(v=>v.id===map.id))D.maps.push(map);
  for(const map of maps){const surface=D.maps.find(v=>v.id===map.parentId);if(surface){surface.links??=[];if(!surface.links.includes(map.id))surface.links.push(map.id);}}
  for(const map of D.maps){
   if(map?.kind==='region'){map.width=80;map.height=60;}
   if(map?.kind==='lair'){map.width=36;map.height=17;map.spawn={x:18,y:16};}
  }
  D.overlords??=[];D.overlords=D.overlords.filter(v=>v?.id);
  D.__p9Merged=true;
 }
 mergeP9Data();
 function raceGroup(raceOrId){const race=typeof raceOrId==='object'?raceOrId:by('races',raceOrId),group=String(race?.group||raceOrId||'');if(group.startsWith('Nhân Loại'))return 'Nhân Loại';if(group.startsWith('Cõi Chết'))return 'Cõi Chết';if(group.startsWith('Quái Tộc'))return 'Quái Tộc';if(group.startsWith('Thú Duệ'))return 'Thú Duệ';if(group.startsWith('Cổ Đại')||group.startsWith('Sa Ngã')||group.startsWith('Dị Giới'))return 'Cổ Đại/Sa Ngã/Dị Giới';return group;}
 function kingdomForRace(raceOrId){return ({'Nhân Loại':'Vương quốc Cửu Khuyết','Cõi Chết':'Vương quốc Á Miếu','Quái Tộc':'Vương quốc Hồi Âm','Thú Duệ':'Vương quốc Diêm Chung','Cổ Đại/Sa Ngã/Dị Giới':'Vương quốc Hắc Tinh'})[raceGroup(raceOrId)]||'Vương quốc Hắc Tinh';}
 const abyssMap=id=>((D.maps_abyss?.maps||[]).find(v=>v.id===id)||by('maps',id)),abyssEncounter=id=>D.maps_abyss?.encounters?.[id]||null;
let sequence=0;
const effective=v=>Math.min(v,30)+Math.max(0,Math.min(v-30,30))*.5+Math.max(0,v-60)*.25;
function weighted(list,rng=Math.random){let n=rng()*list.reduce((a,x)=>a+x.weight,0);return list.find(x=>(n-=x.weight)<0)||list.at(-1);}
const lookNames=['primary','v2','v3'],spriteManifest=()=>g.VTN_SPRITE_MANIFEST||g.window?.VTN_SPRITE_MANIFEST||{};
const baseFormKey=id=>String(id).endsWith('_0')?String(id):String(id)+'_0';
function availableLooks(id){const base=baseFormKey(id),manifest=spriteManifest();return lookNames.filter(look=>Object.prototype.hasOwnProperty.call(manifest,look==='primary'?base:`${base}_${look}`));}
function lookWeights(idOrLooks){const looks=Array.isArray(idOrLooks)?idOrLooks:availableLooks(idOrLooks),weights=looks.length===3?[45,45,10]:looks.length===2?[50,50]:looks.map(()=>100);return looks.map((look,i)=>({look,weight:weights[i]??0}));}
function chooseLook(id,rng=Math.random,starter=false){if(starter)return 'primary';const options=lookWeights(id);return options.length?weighted(options,rng).look:'primary';}
function isRareLook(id,look){return look==='v3'&&availableLooks(id).length===3;}
 const heartStates=['with','heartless','restored'],rankOrder=()=>D.hearts?.talent?.rankOrder||['D','C','B','A','S','S+','S++'],starterSpecies=()=>D.hearts?.starterSpecies||['M-002','M-045','M-017'];
  function heartFor(id,tierIndex,rng=Math.random,options={}){if(options.boss)return 'heartless';if(starterSpecies().includes(id))return 'with';if(!options.wild)return 'with';const rates=D.hearts?.heartlessByTier||[],chance=options.heartlessChance==null?(rates[tierIndex]??0):Number(options.heartlessChance);return rng()<chance?'heartless':'with';}
  function learnedMonsterSkills(monster){const species=by('monsters',monster?.speciesId),fromSave=Array.isArray(monster?.learnedSkills)?monster.learnedSkills:[],byLevel=(species?.learnset||[]).filter(entry=>Number(entry.level)<=Number(monster?.level||1)).map(entry=>entry.skillId);return [...new Set([...fromSave,...byLevel])].filter(id=>{const skill=by('skills',id);return !!skill&&skill.kind!=='passive';});}
 function instantiate(id,level=1,starter=false,rng=Math.random,options={}){
  if(rng&&typeof rng==='object'){options=rng;rng=Math.random;}
  const sp=by('monsters',id),potentials=D.potential.filter(p=>!starter||D.potential.indexOf(p)>=4),iv=weighted(potentials,rng),nature=D.natures[Math.floor(rng()*D.natures.length)];
  const learnedSkills=(sp.learnset||[]).filter(entry=>Number(entry.level)<=Number(level)).map(entry=>entry.skillId).filter((skillId,index,list)=>list.indexOf(skillId)===index&&by('skills',skillId)?.kind!=='passive');
  const m={uid:'soul_'+Date.now().toString(36)+'_'+sequence++,speciesId:id,level,exp:0,potential:iv.rank,natureId:nature.id,bond:starter?45:20,formId:id+'_0',look:chooseLook(id,rng,starter),variant:rng()<.002,mark:rng()<.04?['Thủ Hộ','Minh Trí','Tật Phong'][Math.floor(rng()*3)]:null,status:null,neglect:0,learnedSkills,equippedSkills:learnedSkills.slice().reverse().slice(0,4),heart:heartFor(id,sp.tierIndex,rng,{...options,starter})};
 const s=monsterStats(m);m.hp=s.hp;m.mp=s.mp;return m;
}
 function spawnWild(id,level=1,rng=Math.random,options={}){return instantiate(id,level,false,rng,{wild:true,...options});}
 function spawnBoss(id,level=1,rng=Math.random){return instantiate(id,level,false,rng,{boss:true});}
function monsterStats(m){if(m.human)return m.combatStats;const sp=by('monsters',m.speciesId),tier=D.tiers[sp.tierIndex],iv=D.potential.find(p=>p.rank===m.potential)||D.potential[4],nature=by('natures',m.natureId)||D.natures[0],form=by('evolutions',m.formId)||by('evolutions',sp.id+'_0'),out={};
 for(const k of ['STR','DEX','CON','DEF','SPD','INT','WIS','CHA'])out[k]=Math.round((sp.baseStats[k]+(m.level-1)*tier.growth*iv.multiplier*nature.growthMultiplier*(k==='CON'?1.65:1.2))*form.statMultiplier*(nature.up===k?1.12:nature.down===k?.88:1)*(m.variant?1.04:1));
 out.hp=70+out.CON*7+m.level*8;out.mp=20+out.WIS*3+out.INT;out.types=[...sp.types];if(form.extraType&&!out.types.includes(form.extraType))out.types.push(form.extraType);if(m.mark==='Thủ Hộ')out.DEF=Math.round(out.DEF*1.1);if(m.mark==='Minh Trí')out.INT=Math.round(out.INT*1.1);if(m.mark==='Tật Phong')out.SPD=Math.round(out.SPD*1.1);if(Number.isFinite(m.statScale)&&m.statScale>0&&m.statScale!==1)for(const key of ['STR','DEX','CON','DEF','SPD','INT','WIS','CHA','hp','mp'])out[key]=Math.max(key==='hp'?1:0,Math.round(out[key]*m.statScale));return out;}
function heroStats(s){const h=s.hero,r=by('races',h.raceId),out={...h.stats};for(const [k,v] of Object.entries(r.statBonuses))out[k]=(out[k]||0)+v;for(const eq of Object.values(h.equipment)){if(!eq)continue;const spec=by('equipment',eq.id);for(const [k,v] of Object.entries(spec.bonuses))out[k]+=v+(v>0?eq.plus||0:0);}
 const cls=by('classes',h.classId);if(h.learned.includes(cls.skillIds[2]))for(const k of cls.primaryStats)out[k]=Math.round(out[k]*1.1);
 for(const k of Object.keys(out))out[k]=effective(Math.max(1,out[k]));out.hp=Math.round(70+9*out.CON+12*h.level);out.mp=Math.round(20+5*out.WIS+2*out.INT+3*h.level);const sets={};for(const e of Object.values(h.equipment)){const spec=e&&by('equipment',e.id);if(e?.gems)out.DEF+=e.gems*2;if(spec?.setId)sets[spec.setId]=(sets[spec.setId]||0)+1;}if(Object.values(sets).some(n=>n>=3))out.DEF=Math.round(out.DEF*1.12);return out;}
  const weightData=()=>({...defaultWeights,...(D.weights||{}),capacity:{...defaultWeights.capacity,...(D.weights?.capacity||{})},speed:{...defaultWeights.speed,...(D.weights?.speed||{})},weaponFamilyByIndex:{...defaultWeights.weaponFamilyByIndex,...(D.weights?.weaponFamilyByIndex||{})},weaponBase:{...defaultWeights.weaponBase,...(D.weights?.weaponBase||{})},armourBaseBySlot:{...defaultWeights.armourBaseBySlot,...(D.weights?.armourBaseBySlot||{})}});
  function equipmentTier(item){const match=String(item?.id||'').match(/_(\d+)$/);return Math.max(0,Number.isFinite(Number(item?.tier))?Number(item.tier):Number(match?.[1]||0));}
  function equipmentFamily(item){const match=String(item?.id||'').match(/^wpn_(\d+)_/);return match?weightData().weaponFamilyByIndex[match[1]]:null;}
  function armourSlot(slot){return String(slot||'').startsWith('ring')?'rings':slot;}
  function equipmentWeight(item){const spec=item?.slot?item:by('equipment',item?.id);if(!spec)return 0;const weights=weightData(),tier=equipmentTier(spec);if(spec.slot==='weapon'){const base=Number(weights.weaponBase[equipmentFamily(spec)]||0);return Number((base*(1+tier*.08)).toFixed(6));}const base=Number(weights.armourBaseBySlot[armourSlot(spec.slot)]||0);return Number((base*(1+tier*.1)).toFixed(6));}
  function attachEquipmentWeights(){for(const item of D.equipment||[])item.weight=equipmentWeight(item);}
  function equippedWeight(s){return Object.values(s?.hero?.equipment||{}).reduce((total,eq)=>total+equipmentWeight(by('equipment',eq?.id)),0);}
  function carryCapacity(sOrStrength){const strength=typeof sOrStrength==='number'?sOrStrength:heroStats(sOrStrength).STR,weights=weightData();return Number((weights.capacity.base+Math.max(0,strength)*weights.capacity.strength).toFixed(6));}
  function speedFactor(value,capacityValue,dexValue){let load,capacity,dex;if(value&&typeof value==='object'){if(value.hero){load=equippedWeight(value);capacity=carryCapacity(value);dex=heroStats(value).DEX;}else{load=Number(value.load);capacity=Number(value.capacity);dex=Number(value.dex??value.DEX);}}else{load=Number(value);capacity=Number(capacityValue);dex=Number(dexValue);}load=Number.isFinite(load)?load:0;capacity=Math.max(.000001,Number.isFinite(capacity)?capacity:10);dex=Number.isFinite(dex)?dex:0;const weights=weightData();if(load<=capacity)return 1+Math.min(Math.max(0,dex),weights.speed.dexCap)*weights.speed.dexBonusPerPoint;return Math.max(weights.speed.minimumOverCapacityFactor,1-(load-capacity)/capacity*weights.speed.overCapacityPenalty);}
  const BASE_WALK_SPEED=Number(weightData().speed.baseWalkingSpeed)||2.8;
  function movementSpeed(s,base=BASE_WALK_SPEED){return Number(base)*speedFactor(s);}
  attachEquipmentWeights();
const initiative=(a,b)=>clamp(Math.max(1,a)/(Math.max(1,a)+Math.max(1,b)),.1,.9);
function order(actors,rng=Math.random){const slowest=Math.max(1,Math.min(...actors.map(a=>a.spd))),pool=actors.map(a=>({...a,weight:Math.min(Math.max(1,a.spd),slowest*9)})),out=[];while(pool.length){if(pool.length===2){const index=rng()<initiative(pool[0].weight,pool[1].weight)?0:1;out.push(pool.splice(index,1)[0]);continue;}const chosen=weighted(pool.map((a,i)=>({weight:a.weight,i})),rng);out.push(pool.splice(chosen.i,1)[0]);}return out;}
const affinity=(type,targets)=>{const factor=targets.reduce((v,t)=>v*(D.types.matrix[type]?.[t]??1),1);return factor===0?0:clamp(factor,.25,4);};
function damage(attack,defense,power,modifier=1,rng=Math.random){return Math.max(2,Math.round((power+1.7*attack)*100/(100+1.8*defense)*modifier*(.9+rng()*.2)));}
function price(s,item){const cha=heroStats(s).CHA,rep=Math.max(...Object.values(s.factions),0);return Math.max(1,Math.round(item.price*clamp(1-cha*.004-rep*.001,.6,1.2)*(s.hero.raceId==='R-06'&&s.mapId==='region_06'?.9:1)));}
 const captureRefusal='Con quái này đã mất tim. Không ai thu phục được nó.';
 function talentInfo(s){const talent=s?.hero?.talent||{},ranks=D.hearts?.talent?.ranks||{},valid=talent.id==='khe_hon'&&!!ranks[talent.rank];return {id:valid?'khe_hon':talent.id||null,rank:valid?talent.rank:'D',config:valid?ranks[talent.rank]:{captureBonus:0,heartlessTierCap:-1}};}
 function canCaptureHeartless(s,mon){if(mon?.heart!=='heartless')return true;const talent=talentInfo(s);return talent.id==='khe_hon'&&by('monsters',mon.speciesId).tierIndex<=talent.config.heartlessTierCap;}
 function captureBlockReason(s,mon){return mon?.heart==='heartless'&&!canCaptureHeartless(s,mon)?captureRefusal:null;}
  function catchChance(s,mon,item,weak=false){if(item?.id==='nguyet_tam_an')return mon?.speciesId==='M-200'?0:1;const sp=by('monsters',mon.speciesId),st=monsterStats(mon),blocked=captureBlockReason(s,mon);if(blocked||!item)return 0;const talent=talentInfo(s);return clamp(item.power+(1-mon.hp/st.hp)*.35+heroStats(s).CHA*.005+(item.affinity&&sp.types.includes(item.affinity)?.15:0)+(item.category&&sp.category.includes(item.category)?.15:0)+(mon.status?.12:0)+(weak?.22:0)+((s.hero.raceId==='R-05'&&sp.types.includes('Mộc')||s.hero.raceId==='R-33'&&sp.types.includes('Long')||s.hero.raceId==='R-35'&&sp.types.includes('Quang'))?.15:0)+talent.config.captureBonus-sp.tierIndex*.045,.01,.92);}
  function talentRankUp(s){if(!s?.hero)return 'D';s.hero.talent??={id:'khe_hon',rank:'D',xp:0};s.hero.talent.id??='khe_hon';s.hero.talent.rank??='D';s.hero.talent.xp??=0;const order=rankOrder(),current=order.includes(s.hero.talent.rank)?s.hero.talent.rank:'D',shards=Array.isArray(s.shards)?s.shards.length:0,resolved=Math.max(shards,Number(s.overlordsResolved)||0),bosses=resolved+(s.flags?.abyssBossDefeated?1:0),target=bosses>=6?'S':bosses>=4?'A':bosses>=2?'B':bosses>=1?'C':'D';if(order.indexOf(target)>order.indexOf(current)&&order.indexOf(current)<order.indexOf('S+'))s.hero.talent.rank=target;if(s.hero.talent.rank==='S'||order.indexOf(s.hero.talent.rank)>order.indexOf('S'))s.flags.talentRevealed=true;return s.hero.talent.rank;}
  function requirementStatus(s,requires={}){
   if(requires.rank){const order=rankOrder(),rank=talentInfo(s).rank;if(order.indexOf(rank)<order.indexOf(requires.rank))return {ok:false,reason:`Cần Khế Hồn bậc ${requires.rank}.`};}
   if(requires.flag&&!s?.flags?.[requires.flag])return {ok:false,reason:'Chưa đủ điều kiện câu chuyện.'};
   if(requires.item){const item=by('items',requires.item),count=Number(requires.count||1);if((s?.hero?.bag?.[requires.item]||0)<count)return {ok:false,reason:`Cần ${item?.name||requires.item}.`};}
   return {ok:true,reason:''};
  }
  function overlordOptionStatus(s,overlord,option){
   const isHeart=option?.id==='return_heart'||option?.id==='restore_heart';
   if(isHeart&&talentInfo(s).rank!=='S'&&rankOrder().indexOf(talentInfo(s).rank)<rankOrder().indexOf('S'))return {ok:false,label:'Chạm vào nó',reason:'',hidden:true};
   const status=requirementStatus(s,option?.requires||{});if(status.ok&&isHeart&&(s.homeMemories||0)<1)return {ok:false,label:option.label,reason:'Không còn ký ức về nhà để trao.'};
   return {ok:status.ok,label:option?.label||'',reason:status.reason||''};
  }
  const overlordByRegion=region=>D.overlords?.find(v=>v.region===region)||null,overlordById=id=>D.overlords?.find(v=>v.id===id)||null;
function gainMonster(m,xp){const nature=by('natures',m.natureId);m.exp+=Math.round(xp*nature.experienceMultiplier);while(m.exp>=m.level*65&&m.level<60){m.exp-=m.level*65;m.level++;}const st=monsterStats(m);m.hp=Math.min(st.hp,m.hp);m.mp=Math.min(st.mp,m.mp);m.bond=clamp(m.bond+2*nature.bondMultiplier,0,100);}
  function newState(name,raceId,classId,starter,hardcore=false,ng=0){const cls=by('classes',classId),s={version:4,runId:"run_"+Date.now().toString(36)+"_"+sequence++,started:true,hero:{name:name.replace(/[<>&"']/g,'').slice(0,24)||'Vô Danh',raceId,classId,starterSpeciesId:starter,storyLook:'m_young_a',level:1,exp:0,stats:clone(cls.baseStats),statPoints:4,skillPoints:2,learned:cls.skillIds.slice(0,2),ownedEquipment:[],futureYears:100,equipment:{weapon:{id:'wpn_0_0',plus:0},body:{id:'armor_1_0',plus:0}},bag:{potion:5,ether:3,food:5,fieldkit:8,seal_0:10,seal_1:4,seal_4:2},gold:250,candles:5,corruption:0,memories:[],lostMemories:[],advancement:null,skillBranch:null,hp:1,mp:1,talent:{id:'khe_hon',rank:'D',xp:0}},kingdom:kingdomForRace(raceId),party:[instantiate(starter,3,true)],storage:[],seen:[starter],caught:[starter],looksCaught:{},seenRaces:[raceId],discoveredWeaknesses:[],collectedForms:[],visited:['region_01'],mapId:'region_01',x:8,y:9,steps:0,minutes:360,day:1,daysSinceSummon:1,moon:0,weather:'ash',lastShrine:{mapId:'region_01',x:8,y:9},quests:{},clues:[],storyClues:[],choices:{},flags:{talentRevealed:false,prologueDone:ng>0,finalAct:false,legendaryGuardDefeated:false,legendaryItemAcquired:false},homeMemories:10,homeMemoriesSeen:[],regionStates:{},overlordsResolved:0,overlordAllies:[],factions:Object.fromEntries(D.factions.map(f=>[f.id,0])),shards:[],seals:[],wins:0,rival:{relation:0,wins:0,speciesId:starter==='M-002'?'M-045':starter==='M-045'?'M-017':'M-002'},delayed:[],eventCooldown:0,wonder:null,companions:[],settings:{volume:.3,textSpeed:1,battleSpeed:1,keys:{up:'w',down:'s',left:'a',right:'d',interact:'e'}},hardcore,ng,ending:null};const st=heroStats(s);s.hero.hp=st.hp;s.hero.mp=st.mp;s.collectedForms=[s.party[0].formId];return s;}
function canEvolve(s,m){const form=by('evolutions',m.formId),candidates=D.evolutions.filter(f=>f.speciesId===m.speciesId&&f.stage===form.stage+1);return candidates.filter(f=>{const moonRuleOk=!f.moonRule||(f.moonRule==='full'?s.moon===4:f.moonRule==='waning'?s.moon!==4:false);return m.level>=f.requiredLevel&&m.bond>=f.bondRequired&&moonRuleOk&&(!f.moonPhaseRequired||s.moon===f.moonPhaseRequired)&&(!f.regionRequired||by('maps',s.mapId).regionId===f.regionRequired)&&(f.moonRule||!f.branch||f.branch===(s.hero.corruption>=50?'eclipse':'moon'))&&(f.stage===1||(s.hero.bag['loot_'+m.speciesId]||0)>=1);});}
function encode(s){return JSON.stringify({format:'vuc-tan-nguyet',version:4,date:Date.now(),state:s});}
 function migrate(s){if(!s||typeof s!=='object')return s;s.hero??={};if(Array.isArray(s.party)&&s.party.length>5&&s.party.length<=6){s.storage??=[];s.storage.push(...s.party.splice(5));}s.hero.talent??={id:'khe_hon',rank:'D',xp:0};s.hero.talent.id??='khe_hon';s.hero.talent.rank??='D';s.hero.talent.xp??=0;s.hero.starterSpeciesId??=s.party?.[0]?.speciesId;s.hero.storyLook??='m_young_a';s.flags??={};s.flags.talentRevealed??=false;s.flags.finalAct??=false;s.flags.legendaryGuardDefeated??=false;s.flags.legendaryItemAcquired??=false;if(!Object.prototype.hasOwnProperty.call(s.flags,'prologueDone'))s.flags.prologueDone=true;s.homeMemories??=10;s.homeMemoriesSeen??=[];s.regionStates??={};s.overlordsResolved??=0;s.overlordAllies??=[];s.storyClues??=[];s.clues??=[];s.kingdom??=kingdomForRace(s.hero.raceId);const legacyDay=Number(s.day);if(!Number.isFinite(Number(s.daysSinceSummon))||Number(s.daysSinceSummon)<1)s.daysSinceSummon=Math.max(1,Number.isFinite(legacyDay)?Math.floor(legacyDay):1);if(!Array.isArray(s.storyClues))s.storyClues=[];if(Array.isArray(s.clues.sacrifice))for(const clue of s.clues.sacrifice)if(!s.storyClues.includes(clue))s.storyClues.push(clue);s.clues.sacrifice=s.storyClues.slice();for(const m of [...(s.party||[]),...(s.storage||[])]){m.heart??='with';if(starterSpecies().includes(m.speciesId))m.heart='with';}for(const value of Object.values(s.flags)){if(value?.enemy?.speciesId)value.enemy.heart??='heartless';}return s;}
 function decode(raw){const wrap=JSON.parse(raw),s=migrate(wrap.state);if(wrap.version!==4||wrap.format!=='vuc-tan-nguyet'||!s||s.version!==4)throw Error('Chỉ đọc bản lưu v4; bản v3 dùng hệ chủng tộc khác.');
 const currentMap=by('maps',s.mapId);if(!by('races',s.hero?.raceId)||!by('classes',s.hero?.classId)||!currentMap)throw Error('Danh tính/bản đồ không hợp lệ.');
 for(const k of ['gold','candles','level','hp','mp','corruption','statPoints','skillPoints'])if(!Number.isFinite(s.hero[k])||s.hero[k]<0)throw Error('Chỉ số không hợp lệ.');
 if(s.hero.candles>9||s.hero.corruption>100||s.hero.level>60)throw Error('Chỉ số vượt giới hạn.');
 if(!Array.isArray(s.party)||!s.party.length||s.party.length>5||!Array.isArray(s.storage)||s.storage.length>3000)throw Error('Đội hình không hợp lệ.');
 const uids=new Set();for(const m of [...s.party,...s.storage]){if(!by('monsters',m.speciesId)||!by('evolutions',m.formId)||by('evolutions',m.formId).speciesId!==m.speciesId||!by('natures',m.natureId)||!D.potential.some(p=>p.rank===m.potential)||!Number.isFinite(m.hp)||m.hp<0||!Number.isInteger(m.level)||m.level<1||m.level>60||!Number.isFinite(m.bond)||m.bond<0||m.bond>100||uids.has(m.uid))throw Error('Quái vật đồng hành không hợp lệ.');uids.add(m.uid);}
 for(const a of [s.hero,...s.party,...s.storage])if(a.equippedSkills!==undefined){
  const isHero=a===s.hero,owned=isHero?a.learned:by('monsters',a.speciesId).learnset.filter(v=>v.level<=a.level).map(v=>v.skillId),slots=a.equippedSkills;
  if(!Array.isArray(slots)||slots.length>4||slots.some(id=>id!==null&&(!owned?.includes(id)||!by('skills',id)||by('skills',id).kind==='passive'))||new Set(slots.filter(Boolean)).size!==slots.filter(Boolean).length)throw Error('Bộ bốn kỹ năng không hợp lệ.');
 }
 for(const m of [...s.party,...s.storage])if(m.look!==undefined&&!lookNames.includes(m.look))throw Error('Biến thể không hợp lệ.');
 s.looksCaught??={};if(!s.looksCaught||typeof s.looksCaught!=='object'||Array.isArray(s.looksCaught))throw Error('Tiến trình biến thể không hợp lệ.');for(const [id,looks] of Object.entries(s.looksCaught))if(!by('monsters',id)||!Array.isArray(looks)||looks.some(look=>!['v2','v3'].includes(look)))throw Error('Tiến trình biến thể không hợp lệ.');
 for(const key of ['seen','caught','seenRaces','discoveredWeaknesses','collectedForms','visited','shards','seals','clues','delayed','companions'])if(!Array.isArray(s[key]))throw Error('Tiến trình không hợp lệ.');
 if(!['STR','DEX','CON','DEF','SPD','INT','WIS','CHA'].every(k=>Number.isFinite(s.hero.stats[k])&&s.hero.stats[k]>=1))throw Error('Thuộc tính không hợp lệ.');
 for(const key of ['flags','quests','choices','factions','settings','rival','lastShrine'])if(!s[key]||typeof s[key]!=='object'||Array.isArray(s[key]))throw Error('Thiếu trạng thái '+key);
 if(!s.hero.bag||!s.hero.equipment||!Array.isArray(s.hero.learned)||s.hero.learned.some(id=>!by('skills',id))||!Array.isArray(s.hero.memories)||!Array.isArray(s.hero.lostMemories))throw Error('Hành trang không hợp lệ.');
  for(const key of ['steps','minutes','day','wins'])if(!Number.isFinite(s[key])||s[key]<0)throw Error('Thời gian không hợp lệ.');if(!Number.isFinite(s.daysSinceSummon)||s.daysSinceSummon<1)throw Error('Ngày triệu hồi không hợp lệ.');if(!Number.isFinite(s.moon)||s.moon<0||s.moon>7)throw Error('Pha trăng không hợp lệ.');
 if(!s.settings.keys||new Set(Object.values(s.settings.keys)).size!==5||!Object.values(s.settings.keys).every(v=>typeof v==='string'&&v.length===1))throw Error('Phím không hợp lệ.');
 for(const f of D.factions)if(!Number.isFinite(s.factions[f.id])||Math.abs(s.factions[f.id])>100)throw Error('Danh tiếng không hợp lệ.');
  for(const m of [...s.party,...s.storage])if(!heartStates.includes(m.heart)||!Number.isFinite(m.mp)||m.mp<0||!Number.isFinite(m.exp)||m.exp<0||m.hp>monsterStats(m).hp||m.mp>monsterStats(m).mp)throw Error('Sinh lực quái vật đồng hành không hợp lệ.');
  if(!s.hero.talent||s.hero.talent.id!=='khe_hon'||!rankOrder().includes(s.hero.talent.rank)||!Number.isInteger(s.hero.talent.xp)||s.hero.talent.xp<0)throw Error('Thiên phú Khế Hồn không hợp lệ.');if(!Number.isInteger(s.homeMemories)||s.homeMemories<0)throw Error('Ký ức về nhà không hợp lệ.');if(typeof s.flags.talentRevealed!=='boolean')throw Error('Trạng thái Khế Hồn không hợp lệ.');
  if(s.hero.ownedEquipment!==undefined&&!Array.isArray(s.hero.ownedEquipment))throw Error('Kho trang bị không hợp lệ.');s.hero.ownedEquipment??=[];s.hero.futureYears??=100;
 for(const eq of [...Object.values(s.hero.equipment),...s.hero.ownedEquipment]){if(eq&&(!by('equipment',eq.id)||!Number.isInteger(eq.plus)||eq.plus<0||eq.plus>10))throw Error('Trang bị không hợp lệ.');}
 for(const v of Object.values(s.hero.bag))if(!Number.isInteger(v)||v<0)throw Error('Vật phẩm không hợp lệ.');
   const lair=currentMap.kind==='lair',width=Number(currentMap.width)||(currentMap.kind==='region'?80:40),height=Number(currentMap.height)||(currentMap.kind==='region'?60:30),min=lair?0:1,maxX=lair?width-1:width-2,maxY=lair?height-1:height-2;if(!Number.isInteger(s.x)||!Number.isInteger(s.y)||s.x<min||s.x>maxX||s.y<min||s.y>maxY)throw Error('Vị trí không hợp lệ.');s.hero.name=String(s.hero.name).replace(/[<>&"']/g,'').slice(0,24);return s;}
  g.VTNRules={D,by,clamp,clone,effective,weighted,availableLooks,lookWeights,chooseLook,isRareLook,heartStates,heartFor,instantiate,spawnWild,spawnBoss,monsterStats,heroStats,equipmentWeight,equippedWeight,carryCapacity,speedFactor,movementSpeed,BASE_WALK_SPEED,initiative,order,affinity,damage,price,captureRefusal,talentInfo,canCaptureHeartless,captureBlockReason,catchChance,talentRankUp,requirementStatus,overlordOptionStatus,overlordByRegion,overlordById,gainMonster,newState,canEvolve,encode,decode,raceGroup,kingdomForRace,abyssMap,abyssEncounter};
})(globalThis);
