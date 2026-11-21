/* Logic questions: save-local history, deterministic choice and native overlay UI. */
(function(g){
 'use strict';
 const D=g.VTN_DATA, levels=['Dễ','Trung bình','Khó'];
 const questions=()=>D.logic_questions?.questions||[];
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function migrate(state){
  if(!state)return state;
  const r=state.riddles&&typeof state.riddles==='object'?state.riddles:{};
  for(const key of ['seen','solved'])r[key]=Array.isArray(r[key])?[...new Set(r[key].filter(id=>questions().some(q=>q.id===id)))]:[];
  for(const id of r.solved)if(!r.seen.includes(id))r.seen.push(id);
  state.riddles=r;return state;
 }
 // Keep migration inside this owned module: rules.js is shared with other work.
 // Both old-save decode and new-game creation initialize persisted history.
 for(const method of ['decode','newState']){
  const base=g.VTNRules?.[method];
  if(base)g.VTNRules[method]=function(...args){return migrate(base.apply(this,args));};
 }
 function hash(s){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
 function difficulty(mapId,state){
  let map=D.maps.find(m=>m.id===mapId),guard=0;
  while(map&&!map.regionId&&map.parentId&&guard++<20)map=D.maps.find(m=>m.id===map.parentId);
  const region=Number(String(map?.regionId||mapId).match(/(?:region_|r)(\d+)/)?.[1]||1);
  const primary=region<=3?0:region<=7?1:2;
  // Four out of five draws prefer the region's tier; one uses a nearby tier.
  const count=state.riddles.seen.length;
  return levels[count%5===4?(primary===2?1:primary+1):primary];
 }
 function pick(mapId,state,requiredDifficulty){
  migrate(state);const r=state.riddles,seen=new Set(r.seen);
  const last=questions().find(q=>q.id===r.seen[r.seen.length-1]);
  const unused=questions().filter(q=>!seen.has(q.id));
  const counts=new Map();for(const q of unused)counts.set(q.category,(counts.get(q.category)||0)+1);
  const eligible=q=>{
   if(q.category===last?.category)return false;
   // Do not strand the final questions in a single category. After this draw,
   // there must still be a possible ordering beginning outside its category.
   const remaining=unused.length-1;
   return [...counts].every(([category,n])=>n-(category===q.category?1:0)<=
    (category===q.category?Math.floor(remaining/2):Math.ceil(remaining/2)));
  };
  let pool=unused.filter(q=>q.difficulty===(requiredDifficulty||difficulty(mapId,state))&&eligible(q));
  // A retry never silently changes difficulty. Fresh sites may use other tiers
  // when the preferred tier cannot preserve category alternation.
  if(!pool.length&&!requiredDifficulty)pool=unused.filter(eligible);
  if(!pool.length)return null;
  const q=pool[hash(mapId+'|'+r.seen.join('|'))%pool.length];
  r.seen.push(q.id);return q;
 }
 function open(mapId,state,ui){
  migrate(state);const r=state.riddles,map=D.maps.find(m=>m.id===mapId);
  if(state.flags['puzzle_'+mapId]){
   ui.show('Cơ quan đã mở',`<p>Đường tiếp theo đã được mở. Phần thưởng của cơ quan này chỉ nhận một lần.</p>${ui.btn('Trở lại hành trình','close')}`,'riddle');return;
  }
  let active=r.active;
  if(!active||active.mapId!==mapId){
   // Leaving an unanswered question does not allow rerolling the same site.
   r.sites??={};active=r.sites[mapId];
   if(!active){const q=pick(mapId,state);if(q)active={mapId,id:q.id,hinted:false};}
   r.active=active;
  }
  r.sites??={};if(active)r.sites[mapId]=active;
  const q=questions().find(q=>q.id===active?.id);
  const note=r.feedback?.mapId===mapId?`<div class="lore" role="status">${esc(r.feedback.text)}</div>`:'';
  const text=q?`<article class="intro" data-riddle-id="${esc(q.id)}"><small>${esc(q.difficulty)} · ${esc(q.category)}</small><h2>${esc(q.question)}</h2></article><div class="riddle-options">${q.choices.map((v,i)=>ui.btn(`${'ABCD'[i]} · ${v}`,'puzzle',q.id+':'+i)).join('')}</div>${ui.btn(active.hinted?'Đã dùng gợi ý':'Gợi ý · tốn 3 điểm phép','puzzle',q.id+':hint',active.hinted||state.hero.mp<3)}${active.hinted?`<p class="lore">Gợi ý: ${esc(q.hint)}</p>`:''}`:'<p>Không còn câu chưa gặp thuộc nhóm khác ở độ khó này. Bạn vẫn có thể quay về và khám phá nơi khác.</p>';
  ui.show('Câu đố cơ quan · '+(map?.name||'Di tích'),`${note}${text}<p class="small">Đúng: mở cơ quan và nhận 40 vàng một lần. Sai: mất tối đa 5 điểm phép, câu tiếp theo cùng độ khó. Phím 1–4 hoặc A–D chọn đáp án.</p><p>Lối quay về luôn còn mở. Đóng bảng không tốn gì.</p>${ui.btn('Trở lại hành trình','close')}`,'riddle');
  ui.save();
 }
 function answer(mapId,state,token,ui){
  migrate(state);const r=state.riddles,a=r.active;
  const [id,choice]=String(token).split(':');
  if(!a||a.mapId!==mapId||a.id!==id||state.flags['puzzle_'+mapId])return;
  const q=questions().find(q=>q.id===id);if(!q)return;
  if(choice==='hint'){
   if(a.hinted||state.hero.mp<3)return;
   state.hero.mp-=3;a.hinted=true;ui.save();ui.hud();open(mapId,state,ui);return;
  }
  if(!/^[0-3]$/.test(choice))return;
  r.sites??={};delete r.sites[mapId];delete r.active;
  if(Number(choice)===q.answer_index){
   state.flags['puzzle_'+mapId]=true;
   const reward=state.flags['puzzle_reward_'+mapId]?0:40;
   state.hero.gold+=reward;state.flags['puzzle_reward_'+mapId]=true;
   if(!r.solved.includes(q.id))r.solved.push(q.id);
   delete r.feedback;ui.save();ui.hud();
   ui.show('Đã giải được cơ quan',`<div class="intro"><h2>Đúng rồi. Cơ quan đã mở.</h2><p>${esc(q.explanation)}</p><p>${reward?'Bạn nhận 40 vàng.':'Phần thưởng này đã nhận trước đó.'} Đường tiếp theo không còn bị phong ấn.</p></div>${ui.btn('Trở lại hành trình','close')}`,'riddle');
  }else{
   const lost=Math.min(5,state.hero.mp);state.hero.mp-=lost;
   r.feedback={mapId,text:`Chưa đúng. Bạn chọn “${q.choices[Number(choice)]}”; đáp án đúng là “${q.answer}”. ${q.explanation} Gợi ý của câu vừa rồi: ${q.hint} Bạn mất ${lost} điểm phép. Hãy thử một câu khác cùng độ khó.`};
   const next=pick(mapId,state,q.difficulty);
   if(next)r.active=r.sites[mapId]={mapId,id:next.id,hinted:false};
   else r.active=r.sites[mapId]={mapId,id:null,hinted:false};
   ui.save();ui.hud();open(mapId,state,ui);
  }
 }
 g.VTNRiddles={pick,migrate,difficulty,open,answer};
 g.addEventListener?.('keydown',e=>{
  if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;
  const root=g.document?.querySelector('#overlay.open [data-riddle-id]');if(!root)return;
  const key=e.key.toUpperCase(),i=/^[1-4]$/.test(key)?Number(key)-1:'ABCD'.indexOf(key);
  if(i<0||i>3)return;
  const button=g.document.querySelectorAll('#overlay.open .riddle-options [data-act="puzzle"]')[i];
  if(button&&!button.disabled){e.preventDefault();e.stopImmediatePropagation();button.click();}
 },true);
})(window);
