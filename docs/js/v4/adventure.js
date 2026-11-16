(function(g){
 'use strict';
 const PARTY_LIMIT=5;
 function effectiveness(factor,support=false){
  if(support)return {factor:1,key:'support',label:'Hỗ trợ'};
  if(factor===0)return {factor,key:'immune',label:'Không tác dụng'};
  if(factor<1)return {factor,key:'weak',label:'Tác dụng yếu'};
  if(factor>=4)return {factor,key:'super',label:'Siêu hiệu quả'};
  if(factor>1)return {factor,key:'effective',label:'Hiệu quả'};
  return {factor:1,key:'normal',label:'Bình thường'};
 }
 function mapRoute(maps,from,to){
  if(from===to)return [from];
  const byId=new Map(maps.map(m=>[m.id,m])),queue=[[from]],seen=new Set([from]);
  for(let i=0;i<queue.length;i++)for(const id of byId.get(queue[i].at(-1))?.links||[]){
   if(seen.has(id))continue;const next=[...queue[i],id];if(id===to)return next;seen.add(id);queue.push(next);
  }
  return null;
 }
 function humanOpponent(R,mode,ref,state,options={}){
  if(options.opponent===false||!['leader','duel','rival','bandit','arena','human'].includes(mode))return null;
  const D=R.D,npc=R.by('npcs',ref)||D.npcs.find(n=>n.id===D.chapters.find(c=>c.regionId===ref)?.leaderId);
  const level=options.level||Math.max(2,mode==='rival'?state.hero.level:Number(R.by('regions',ref)?.recommendedLevel?.[1])||state.hero.level);
  const index=npc?D.npcs.indexOf(npc):mode==='bandit'?2:0,cls=D.classes.filter(c=>!c.hidden)[Math.abs(index)%10];
  const hero={raceId:npc?.raceId||'R-01',classId:cls.id,stats:Object.fromEntries(Object.entries(cls.baseStats).map(([k,v])=>[k,v+Math.floor(level*.65)])),equipment:{},learned:cls.skillIds.filter(id=>R.by('skills',id)?.level<=level),level};
  const stats=R.heroStats({hero}),castKey=mode==='rival'?'khoi':null;
  return {uid:'opponent',human:true,name:options.name||npc?.name||(mode==='rival'?'Tạ Minh Khôi':mode==='bandit'?'Kẻ chặn đường':'Lữ khách'),raceId:hero.raceId,classId:cls.id,level,hp:stats.hp,mp:stats.mp,combatStats:stats,types:[],skillIds:hero.learned.filter(id=>R.by('skills',id)?.kind!=='passive'),castKey};
 }
 function create(c){
  const {R,D}=c,by=R.by,esc=v=>String(v??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
  const state=()=>c.state(),battle=()=>c.battle(),button=(text,act,id='',disabled=false)=>`<button data-act="${act}" data-id="${esc(id)}" ${disabled?'disabled':''}>${text}</button>`;
  let route=null,issuing=false,lastRouteTick=0,atlasMode='local',atlasSelection=null,storageTab='party',storageQuery='',storageType='',storagePage=0,adminQuery='';
  function cancelRoute(quiet=false){route=null;c.stopMovement?.();c.routeLabel?.('');if(!quiet)c.toast('Đã dừng tự tìm đường.');}
  function go(mapId,point=null,label='Điểm đến'){
   const s=state();if(!s||battle()||g.VTNStory?.isActive?.())return false;
   if(!mapRoute(D.maps,s.mapId,mapId)){c.toast('Chưa tìm thấy đường nối tới nơi này.');return false;}
   c.stopMovement?.();route={mapId,point,label,paused:false};c.close();c.routeLabel?.('Đang tìm đường: '+label);lastRouteTick=0;tick();return true;
  }
  function tick(){
   if(!route||!state()||performance.now()-lastRouteTick<220)return;lastRouteTick=performance.now();
   if(battle()||g.VTNStory?.isActive?.()||document.getElementById('overlay').classList.contains('open'))return;
   if(c.movement())return;
   const s=state(),map=by('maps',s.mapId);let point=route.point;
   if(s.mapId!==route.mapId){const chain=mapRoute(D.maps,s.mapId,route.mapId);if(!chain){cancelRoute(true);c.toast('Đường đi hiện không còn thông.');return;}point=c.points(map.id).find(p=>p.type==='portal'&&p.target===chain[1]);if(!point){cancelRoute(true);c.toast('Không tìm thấy cổng trên bản đồ hiện tại.');return;}}
   else if(point&&(point.npc?.id||point.id)){const live=c.points(map.id).find(p=>(p.npc?.id||p.id)===(point.npc?.id||point.id));if(live)point=live;}
   else{cancelRoute(true);c.toast('Đã đến '+map.name+'.');return;}
   const near=Math.max(Math.abs(s.x-point.x),Math.abs(s.y-point.y))<=1;
   if(near){const isDestination=s.mapId===route.mapId;const id=point.npc?.id||point.id;if(isDestination){const label=route.label;cancelRoute(true);c.toast('Đã đến '+label+'.');if(id)c.interact(id);return;}if(id)c.interact(id);else{cancelRoute(true);c.toast('Cổng này chưa có lối tương tác.');}return;}
   issuing=true;const ok=c.move(point.x,point.y);issuing=false;if(!ok){cancelRoute(true);c.toast('Lối đi bị chặn. Hãy mở bản đồ để chọn một điểm khác.');}
  }
  function objective(){
   const s=state();if(!s)return null;
   if(!s.flags.prologueDone){
    let id=s.mapId,type='abyss-boss';if(!s.flags.abyssFirstBattleDone){id='abyss_ash';type=null;}else if(!s.flags.abyssBossDefeated){id='abyss_core';type='abyss-boss';}else{id='abyss_tomb';type='npc';}
    return {mapId:id,point:c.points(id).find(p=>p.type===type)||null,label:by('maps',id)?.name||'Uyên Khẩu'};
   }
   const current=by('maps',s.mapId)?.regionId,chapter=D.chapters.find(ch=>ch.regionId===current&&!s.shards.includes(current))||D.chapters.find(ch=>!s.shards.includes(ch.regionId));
   if(!chapter)return null;const mapId=chapter.regionId,pts=c.points(mapId),point=pts.find(p=>p.type===(!s.clues.includes(mapId)?'clue':'boss-gate'))||pts.find(p=>p.type==='clue');
   return {mapId,point,label:point?.name||by('regions',mapId).name};
  }
  function questRoute(id){const q=by('quests',id);if(!q)return false;const pts=c.points(q.regionId),point=q.type==='race'?pts.find(p=>p.npc?.questId===id):pts.find(p=>p.type==='clue');return go(q.regionId,point,q.title||q.name||'Dấu vết nhiệm vụ');}
  const colors={0:'#323b3c',1:'#13121d',2:'#426747',3:'#264c68'};
  const poiColor=p=>p.type==='portal'?'#99bfd9':p.type==='npc'?'#f3dab0':/boss|overlord|lair/.test(p.type)?'#ec8588':p.type==='shrine'?'#f1bc6c':'#bd9ddd';
  function localMap(){
   const s=state(),map=by('maps',s.mapId),a=c.grid(map.id),pts=c.points(map.id),habitats=R.D&&g.VTN_MAP_LAYOUTS?.habitats?.(a)||[];
   c.show('Địa đồ · '+map.name,`<div class="atlas-tabs">${button('Bản đồ khu vực','atlas-local')}${button('Thế giới','atlas-world')}</div><div class="atlas-heading"><div><h3>${esc(map.name)}</h3><p>Chạm dấu mốc để tự đi tới. Đường màu cát an toàn; vùng màu xanh có quái.</p></div>${button('Tới nhiệm vụ đang theo dõi','quest-route')}</div><div class="atlas-canvas-wrap"><canvas class="atlas-canvas" id="local-atlas" width="960" height="640" aria-label="Bản đồ địa hình, vùng quái và các điểm tương tác"></canvas></div><div class="atlas-legend"><span><i style="--mark:#cfaa73"></i>Đường an toàn</span><span><i style="--mark:#426747"></i>Khu gặp quái (${habitats.length})</span><span><i style="--mark:#e8cf7e"></i>Vị trí của bạn</span><span><i style="--mark:#99bfd9"></i>Cổng</span><span><i style="--mark:#ec8588"></i>Bá Chủ</span></div><div class="atlas-selection" id="atlas-selection">${route?'Đang tìm đường tới '+esc(route.label):'Chọn một dấu mốc hoặc một ô đất trên bản đồ.'}</div>${route?button('Dừng tìm đường','route-stop'):''}${speciesPanel(map)}`,'atlas');
   const cv=document.getElementById('local-atlas'),ctx=cv.getContext('2d'),w=a[0].length,h=a.length,pad=20,scale=Math.min((cv.width-pad*2)/w,(cv.height-pad*2)/h),ox=(cv.width-w*scale)/2,oy=(cv.height-h*scale)/2;
   const zones=g.VTN_MAP_LAYOUTS.zoneModel(map,a,pts),roads=zones.roadCells;ctx.fillStyle='#110f1a';ctx.fillRect(0,0,cv.width,cv.height);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){ctx.fillStyle=roads.has(`${x},${y}`)?'#b89766':colors[a[y][x]]||'#30313b';ctx.fillRect(ox+x*scale,oy+y*scale,Math.ceil(scale),Math.ceil(scale));}
   ctx.font='600 13px "VTN UI",sans-serif';ctx.textAlign='center';
   const labelled=[];for(const p of pts){if(!Number.isFinite(p.x))continue;const x=ox+(p.x+.5)*scale,y=oy+(p.y+.5)*scale;ctx.fillStyle='#090811';ctx.fillRect(x-5,y-5,10,10);ctx.fillStyle=poiColor(p);ctx.fillRect(x-3,y-3,6,6);if(p.type==='npc')continue;const label=p.name||p.type,ly=y+(y>cv.height*.7?-12:20);if(labelled.some(q=>Math.abs(q.x-x)<100&&Math.abs(q.y-ly)<18))continue;const text=label.length>28?label.slice(0,26)+'…':label;ctx.lineWidth=4;ctx.strokeStyle='#100d19';ctx.strokeText(text,x,ly);ctx.fillStyle=poiColor(p);ctx.fillText(text,x,ly);labelled.push({x,y:ly});}
   ctx.fillStyle='#ffe6a5';ctx.beginPath();ctx.arc(ox+(s.x+.5)*scale,oy+(s.y+.5)*scale,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff3d0';ctx.lineWidth=2;ctx.stroke();
   cv.onclick=e=>{const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)*cv.width/r.width,y=(e.clientY-r.top)*cv.height/r.height,tx=Math.floor((x-ox)/scale),ty=Math.floor((y-oy)/scale);if(tx<0||ty<0||tx>=w||ty>=h)return;const p=pts.slice().sort((l,r)=>Math.hypot(l.x-tx,l.y-ty)-Math.hypot(r.x-tx,r.y-ty))[0],close=p&&Math.hypot(p.x-tx,p.y-ty)<2.5;atlasSelection={mapId:map.id,point:close?p:{x:tx,y:ty},label:close?p.name:`Ô ${tx}, ${ty}`};document.getElementById('atlas-selection').innerHTML=`<strong>${esc(atlasSelection.label)}</strong> ${button('Tự đi tới','atlas-go')}`;};
  }
  const worldPositions=[[.18,.68],[.1,.38],[.34,.82],[.38,.33],[.54,.69],[.51,.44],[.68,.47],[.75,.24],[.79,.76],[.88,.42]];
  function worldMap(){
   const s=state(),regions=D.regions,maps=regions.map(r=>by('maps',r.id));c.show('Địa đồ · Vực Tàn Nguyệt',`<div class="atlas-tabs">${button('Bản đồ khu vực','atlas-local')}${button('Thế giới','atlas-world')}</div><div class="atlas-heading"><div><h3>Mười miền dưới trăng vỡ</h3><p>Chọn một miền để xem cấp độ và tự tìm đường qua các cổng.</p></div></div><div class="atlas-canvas-wrap"><canvas class="atlas-canvas" id="world-atlas" width="1120" height="680" aria-label="Địa đồ thế giới với mười vùng và đường nối"></canvas></div><div class="atlas-selection" id="atlas-selection">${esc(by('regions',by('maps',s.mapId).regionId)?.name||'')} · Bạn đang ở đây.</div>`,'atlas');
   const cv=document.getElementById('world-atlas'),ctx=cv.getContext('2d');ctx.fillStyle='#141322';ctx.fillRect(0,0,cv.width,cv.height);ctx.strokeStyle='#342c43';ctx.lineWidth=1;for(let i=0;i<17;i++){ctx.beginPath();ctx.ellipse(560,340,130+i*32,30+i*18,-.15,0,7);ctx.stroke();}
   const links=new Set();maps.forEach((map,i)=>{for(const id of map?.links||[]){const j=maps.findIndex(m=>m?.id===id);if(j<0||links.has([i,j].sort().join('|')))continue;links.add([i,j].sort().join('|'));const [x,y]=worldPositions[i],[xx,yy]=worldPositions[j];ctx.strokeStyle='#8a745355';ctx.lineWidth=3;ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(x*1120,y*680);ctx.lineTo(xx*1120,yy*680);ctx.stroke();}});ctx.setLineDash([]);
   regions.forEach((reg,i)=>{const [xx,yy]=worldPositions[i],x=xx*1120,y=yy*680,visited=s.visited.some(id=>by('maps',id)?.regionId===reg.id),current=by('maps',s.mapId).regionId===reg.id;ctx.beginPath();for(let n=0;n<12;n++){const angle=n*Math.PI/6,r=32+(g.VTN_MAP_LAYOUTS.hash(reg.id+n)%22),px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r*.7;n?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fillStyle=reg.palette?.[1]||'#3a3d46';ctx.fill();ctx.strokeStyle=current?'#ffe2a0':visited?'#b69562':'#625669';ctx.lineWidth=current?3:1;ctx.stroke();ctx.fillStyle=current?'#ffe4aa':visited?'#e0cfb1':'#a294ae';ctx.font='600 18px "VTN Title",Georgia,serif';ctx.textAlign='center';ctx.fillText(reg.name,x,y+65);ctx.font='11px "VTN UI",sans-serif';ctx.fillText('Cấp '+reg.recommendedLevel.join('–')+(current?' · Bạn ở đây':''),x,y+82);});
   ctx.fillStyle='#c5b28a';ctx.font='italic 22px "VTN Title",serif';ctx.textAlign='center';ctx.fillText('Vực Tàn Nguyệt',560,48);
   cv.onclick=e=>{const rect=cv.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;let best=0,dist=Infinity;worldPositions.forEach(([xx,yy],i)=>{const d=Math.hypot((xx-x)*1120,(yy-y)*680);if(d<dist){dist=d;best=i;}});if(dist>100)return;const reg=regions[best];atlasSelection={mapId:reg.id,point:null,label:reg.name};document.getElementById('atlas-selection').innerHTML=`<strong>${esc(reg.name)}</strong> · Cấp ${reg.recommendedLevel.join('–')}<p>${esc(reg.theme)}</p>${button('Tự tìm đường tới vùng','atlas-go')}`;};
  }

  /* ---- Hunting guide: which monsters live where, with their chance, and auto-path to the habitat ---- */
  const WHEN={dawn:'rạng đông',dusk:'hoàng hôn',night:'ban đêm',day:'ban ngày',bloodmoon:'trăng máu',meteor:'mưa sao băng',ash:'mưa tro',snow:'tuyết',mist:'sương mù'};
  function spawnTable(regionId){
   const pool=by('encounters',regionId);if(!pool)return [];const out=[];
   for(const e of pool.normal){const group=pool.normal.filter(x=>x.time==='any'||x.time===e.time),sum=group.reduce((v,x)=>v+x.weight,0)||1;out.push({id:e.speciesId,chance:Math.max(1,Math.round(e.weight/sum*88)),when:e.time==='any'?'':(WHEN[e.time]||e.time),rare:false});}
   const rare=pool.rare||[];for(const e of rare)out.push({id:e.speciesId,chance:Math.max(1,Math.round(12/rare.length)),when:WHEN[e.weather]||e.weather||'',rare:true});
   return out.sort((a,b)=>b.chance-a.chance);
  }
  function nearestHabitat(mapId){
   const a=c.grid(mapId);if(!a||!a.length)return null;const s=state(),w=a[0].length,h=a.length;let sx=s.x,sy=s.y;
   if(s.mapId!==mapId){const sp=c.points(mapId).find(p=>p.type==='portal')||c.points(mapId)[0];sx=sp?.x??Math.floor(w/2);sy=sp?.y??Math.floor(h/2);}
   const q=[[sx,sy]],seen=new Set([sx+','+sy]);
   for(let i=0;i<q.length;i++){const [x,y]=q[i];if(a[y]?.[x]===2)return {x,y};for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const k=nx+','+ny;if(seen.has(k))continue;const t=a[ny][nx];if(t===1||t===3)continue;seen.add(k);q.push([nx,ny]);}}
   return null;
  }
  function hunt(speciesId){
   const s=state(),sp=by('monsters',speciesId);if(!s||!sp)return false;
   const options=D.encounters.map(p=>({reg:p.regionId,row:spawnTable(p.regionId).find(r=>r.id===speciesId)})).filter(o=>o.row);
   if(!options.length){c.toast('Sinh linh này không xuất hiện ở khu săn thường. Hãy tìm qua nhiệm vụ, sự kiện hoặc Bá Chủ.');return false;}
   const here=by('maps',s.mapId)?.regionId,pick=options.find(o=>o.reg===here)||options.sort((a,b)=>b.row.chance-a.row.chance)[0];
   const mapId=pick.reg,spot=nearestHabitat(mapId);if(!spot){c.toast('Chưa tìm được khu gặp quái ở vùng này.');return false;}
   c.close();go(mapId,{id:'habitat|'+speciesId,type:'habitat',x:spot.x,y:spot.y,name:sp.name},'khu săn '+sp.name+' ('+pick.row.chance+'%)');return true;
  }
  function speciesPanel(map){
   const rows=spawnTable(map.regionId);if(!rows.length)return '';const s=state();
   return `<section class="atlas-species"><h4>Sinh linh trong vùng · bấm để tự đi tới khu săn</h4><div class="species-grid">${rows.map(r=>{const m=by('monsters',r.id);if(!m)return '';const seen=s.seen.includes(r.id),got=s.caught.includes(r.id);return `<button class="species-card ${got?'is-caught':''}" data-act="atlas-hunt" data-id="${esc(r.id)}">${c.sprite(r.id,'',false,!seen,64)}<strong>${seen?esc(m.name):'???'}</strong><span class="chance">${r.chance}%</span>${r.when?`<small>${esc(r.when)}</small>`:''}${r.rare?'<small class="rare">Hiếm</small>':''}<small>${got?'Đã lập khế':seen?'Đã gặp':'Chưa gặp'}</small></button>`;}).join('')}</div></section>`;
  }
  function whereHtml(id){
   const rows=D.encounters.map(p=>({reg:p.regionId,row:spawnTable(p.regionId).find(r=>r.id===id)})).filter(o=>o.row);
   if(!rows.length)return '<div class="lore"><b>Nơi bắt gặp</b><p>Không có trong khu săn thường: tìm qua nhiệm vụ, sự kiện hoặc Bá Chủ.</p></div>';
   return `<div class="lore"><b>Nơi bắt gặp</b>${rows.map(o=>`<p>${esc(by('regions',o.reg)?.name||o.reg)} · khoảng <b>${o.row.chance}%</b>${o.row.when?' · '+esc(o.row.when):''}${o.row.rare?' · hiếm':''}</p>`).join('')}${button('Tự đi tới khu săn','hunt',id)}</div>`;
  }

  /* ---- Auto hunt: walk around the habitat forever (until stopped), the target only biases which monster shows up ---- */
  const auto={on:false,target:null,mapId:null,next:0,open:false,lastSig:''};
  const regionMapOf=map=>{const reg=map?.regionId;return D.maps.find(m=>m.id===reg)?map.regionId:map?.id;};
  function wildCells(mapId){const a=c.grid(mapId),out=[];if(!a)return out;for(let y=0;y<a.length;y++)for(let x=0;x<a[0].length;x++)if(a[y][x]===2)out.push({x,y});return out;}
  function huntStart(target){
   const s=state();if(!s||battle())return;const map=by('maps',s.mapId);const here=wildCells(s.mapId).length?s.mapId:regionMapOf(map);
   auto.on=true;auto.target=target===undefined?auto.target:target;auto.mapId=here;auto.next=0;cancelRoute(true);renderHunt(true);
   c.toast(auto.target?'Auto tìm '+(by('monsters',auto.target)?.name||'quái')+': nhân vật sẽ đi quanh khu săn.':'Auto tìm quái: nhân vật sẽ đi quanh khu săn.');
  }
  function huntStop(quiet){if(!auto.on)return;auto.on=false;c.stopMovement?.();renderHunt(true);if(!quiet)c.toast('Đã dừng auto tìm quái.');}
  function huntTick(now){
   if(!auto.on)return;const s=state();if(!s)return;
   if(battle()){return;}
   const ov=document.getElementById('overlay');
   if(ov?.classList.contains('open')){if(ov.querySelector('.collectible')){if(!auto.closeAt)auto.closeAt=now+1.6;else if(now>=auto.closeAt){auto.closeAt=0;c.close();}}return;}
   auto.closeAt=0;if(document.querySelector('#story-overlay.is-active')||document.body.classList.contains('title-mode'))return;
   if(now<auto.next)return;
   if(s.mapId!==auto.mapId){if(!route){const spot=nearestHabitat(auto.mapId);if(spot){issuing=true;go(auto.mapId,{id:'habitat|hunt',type:'habitat',x:spot.x,y:spot.y,name:'khu săn'},'khu săn');issuing=false;}else huntStop(true);auto.next=now+2;}return;}
   if(route||c.movement())return;
   const grid=c.grid(s.mapId),cells=wildCells(s.mapId);if(!cells.length){huntStop(true);c.toast('Bản đồ này không có khu gặp quái.');return;}
   let spot;
   if(grid[s.y]?.[s.x]!==2){spot=nearestHabitat(s.mapId);}
   else{const seen=new Set([s.x+','+s.y]),q=[{x:s.x,y:s.y}];for(let i=0;i<q.length&&q.length<400;i++){const p=q[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=p.x+dx,ny=p.y+dy,k=nx+','+ny;if(seen.has(k)||grid[ny]?.[nx]!==2)continue;seen.add(k);q.push({x:nx,y:ny});}}
    const far=q.filter(p=>Math.hypot(p.x-s.x,p.y-s.y)>=3),pool=far.length?far:q;spot=pool[Math.floor(Math.random()*pool.length)];}
   if(!spot){huntStop(true);return;}
   issuing=true;const ok=c.move(spot.x,spot.y);issuing=false;auto.next=now+(ok?.25:1);
  }
  /* the target monster appears more often (about 40%) while hunting; everything else stays as normal */
  function huntPick(normal,rare){
   if(!auto.on||!auto.target)return null;const inN=normal.some(e=>e.speciesId===auto.target),inR=rare.some(e=>e.speciesId===auto.target);
   return (inN||inR)&&Math.random()<.4?auto.target:null;
  }
  function renderHunt(force){
   const aside=document.querySelector('#game-ui>main>aside');if(!aside)return;let el=document.getElementById('hunt-card');
   if(!el){el=document.createElement('section');el.id='hunt-card';aside.appendChild(el);el.addEventListener('click',e=>{const b=e.target.closest('[data-hunt]');if(!b)return;e.stopPropagation();const k=b.dataset.hunt,v=b.dataset.id;if(k==='toggle')auto.on?huntStop():huntStart(auto.target);else if(k==='open'){auto.open=!auto.open;renderHunt(true);}else if(k==='pick'){auto.target=auto.target===v?null:v;if(auto.on){auto.next=0;}renderHunt(true);}});}
   const s=state();if(!s||document.body.classList.contains('title-mode')){el.hidden=true;return;}
   const map=by('maps',s.mapId),regionId=map?.regionId,rows=spawnTable(regionId),sig=[s.mapId,auto.on,auto.target,auto.open,s.seen.length,s.caught.length].join('|');
   if(!force&&sig===auto.lastSig)return;auto.lastSig=sig;el.hidden=false;
   const regionName=by('regions',regionId)?.name||'';
   const uniq=[];for(const r of rows){if(!uniq.some(u=>u.id===r.id))uniq.push(r);}
   const chip=r=>{const m=by('monsters',r.id),seen=s.seen.includes(r.id);return `<button class="hunt-chip ${auto.target===r.id?'is-target':''}" data-hunt="pick" data-id="${esc(r.id)}" title="${esc(seen?m.name:'Chưa gặp')} · ${r.chance}%">${c.sprite(r.id,'',false,!seen,44)}<small>${r.chance}%</small></button>`;};
   el.innerHTML=`<button class="hunt-head" data-hunt="open" aria-expanded="${auto.open}"><small>KHU SĂN · ${esc(regionName)}</small><span>${auto.open?'▴ Thu gọn':'▾ Mở rộng'}</span></button>`+
    (auto.open?`<div class="hunt-list">${uniq.map(r=>{const m=by('monsters',r.id),seen=s.seen.includes(r.id),got=s.caught.includes(r.id);return `<button class="hunt-row ${auto.target===r.id?'is-target':''}" data-hunt="pick" data-id="${esc(r.id)}">${c.sprite(r.id,'',false,!seen,40)}<span><b>${seen?esc(m.name):'???'}</b><small>${r.chance}%${r.when?' · '+esc(r.when):''}${r.rare?' · hiếm':''} · ${got?'đã lập khế':seen?'đã gặp':'chưa gặp'}</small></span></button>`;}).join('')}</div>`:`<div class="hunt-chips">${uniq.slice(0,6).map(chip).join('')}</div>`)+
    `<div class="hunt-foot"><small>${auto.target?'Mục tiêu: <b>'+esc(by('monsters',auto.target)?.name||'')+'</b>':'Mục tiêu: bất kỳ'}</small><button class="hunt-toggle ${auto.on?'is-on':''}" data-hunt="toggle">${auto.on?'■ Dừng auto tìm':'▶ Bật auto tìm'}</button></div>`;
   for(const cv of el.querySelectorAll('canvas[data-species]')){const sp=by('monsters',cv.dataset.species);if(sp)g.VTNArt?.draw(cv,{...sp,stage:0,variant:false,frame:0});}
  }
  setInterval(()=>{try{huntTick(performance.now()/1000);renderHunt(false);}catch(e){console.error(e);}},300);
  function atlas(){atlasMode==='world'?worldMap():localMap();}
  function monsterCard(m,inStorage=false){const sp=by('monsters',m.speciesId),st=R.monsterStats(m),form=by('evolutions',m.formId),index=state().party.indexOf(m);return `<article class="card collectible">${c.sprite(m.speciesId,m.formId,m.variant,false,112,m.uid,m.look)}<h3>${esc(form?.name||sp.name)}</h3><p>${esc(sp.id)} · Cấp ${m.level} · ${esc(sp.types.join(' / '))}<br>HP ${m.hp}/${st.hp} · MP ${m.mp}/${st.mp}<br>Tiềm lực ${esc(m.potential)} · Gắn kết ${Math.round(m.bond)}<br>${inStorage?'Trong kho':index<2?'Đang đứng sân':'Dự bị'}</p><div class="row">${inStorage?button('Mang theo','withdraw',m.uid,state().party.length>=PARTY_LIMIT):button('Gửi vào kho','store',m.uid,state().party.length<=1)}${!inStorage&&index>=2?button('Đưa lên sân','lead',m.uid):''}${button('Kỹ năng','loadout-menu',m.uid)}${button('Hồ sơ','monster',m.speciesId)}${button('Cho ăn','feed',m.uid,!(state().hero.bag.food>0))}${R.canEvolve(state(),m).length?button('Tiến hóa','evolve',m.uid):''}</div></article>`;}
  function storage(tab=storageTab){
   storageTab=tab;const s=state(),all=tab==='party'?s.party:s.storage,query=storageQuery.toLocaleLowerCase('vi'),filtered=all.filter(m=>{const sp=by('monsters',m.speciesId),name=by('evolutions',m.formId)?.name||sp.name;return (!query||`${name} ${sp.id} ${sp.englishName}`.toLocaleLowerCase('vi').includes(query))&&(!storageType||sp.types.includes(storageType));}),pages=Math.max(1,Math.ceil(filtered.length/24));storagePage=Math.min(storagePage,pages-1);
   c.show(tab==='party'?'Đội hình Khế Hồn':'Kho Khế Hồn',`<div class="storage-tabs">${button(`Mang theo · ${s.party.length}/${PARTY_LIMIT}`,'party-tab','party')}${button(`Trong kho · ${s.storage.length}`,'party-tab','storage')}${button('Bộ kỹ năng của người chơi','loadout-menu','hero')}</div><p class="storage-count">${tab==='party'?s.party.length+'/'+PARTY_LIMIT+' khế thú mang theo':s.storage.length+' khế thú trong kho'}</p><p>Hai khế thú đầu tiên đứng sân; tối đa ba dự bị. Khi đội đủ năm, quái thu phục thêm sẽ tự về kho.</p><div class="storage-toolbar"><input id="storage-search" type="search" value="${esc(storageQuery)}" placeholder="Tìm tên hoặc mã loài" aria-label="Tìm khế thú"><select id="storage-type" aria-label="Lọc theo hệ"><option value="">Mọi hệ</option>${D.types.entries.map(t=>`<option ${t.id===storageType?'selected':''}>${esc(t.id)}</option>`).join('')}</select></div><div class="storage-grid">${filtered.slice(storagePage*24,storagePage*24+24).map(m=>monsterCard(m,tab==='storage')).join('')||'<p>Chưa có khế thú phù hợp. Quái mới sẽ được đưa vào đây khi đội đầy.</p>'}</div><div class="row">${button('Trang trước','storage-page',storagePage-1,storagePage===0)}<span>Trang ${storagePage+1}/${pages} · ${filtered.length} khế thú</span>${button('Trang sau','storage-page',storagePage+1,storagePage>=pages-1)}</div>`,'party');
   const input=document.getElementById('storage-search');input.onchange=()=>{storageQuery=input.value;storagePage=0;storage();};document.getElementById('storage-type').onchange=e=>{storageType=e.target.value;storagePage=0;storage();};
  }
  function grant(id,level){
   const s=state();if(!s?.admin?.enabled||!by('monsters',id))return false;const m=R.instantiate(id,level);m.bond=100;m.heart='with';m.potential='SS';const st=R.monsterStats(m);m.hp=st.hp;m.mp=st.mp;(s.party.length<PARTY_LIMIT?s.party:s.storage).push(m);for(const list of ['seen','caught'])if(!s[list].includes(id))s[list].push(id);if(!s.collectedForms.includes(m.formId))s.collectedForms.push(m.formId);return true;
  }

  /* ---- Admin item workshop: browse every item / piece of equipment and grant it ---- */
  let adminItemTab='items',adminItemQuery='',adminItemKind='';
  const SLOT_VI={weapon:'Vũ khí',head:'Mũ',body:'Giáp',hands:'Găng',feet:'Giày',cloak:'Áo choàng',ring1:'Nhẫn trái',ring2:'Nhẫn phải',amulet:'Bùa hộ mệnh'};
  const KIND_VI={heal:'Hồi phục',mp:'Hồi MP',candle:'Nến Hồn',food:'Thức ăn',cleanse:'Giải trạng thái',capture:'Khế hồn',material:'Nguyên liệu',weakness:'Khắc chế',evolution:'Tiến hóa',gem:'Ngọc',exp:'Kinh nghiệm',level:'Tăng cấp'};
  function adminItems(){
   const s=state();if(!s?.admin?.enabled)return;const q=adminItemQuery.toLocaleLowerCase('vi');
   const iconOf=id=>g.VTN_ITEM_ICONS?.[id]?`<img src="${esc(g.VTN_ITEM_ICONS[id])}" alt="" width="40" height="40" style="image-rendering:pixelated">`:'<span class="admin-noicon">◇</span>';
   let rows;
   if(adminItemTab==='items'){
    const kinds=[...new Set(D.items.map(i=>i.kind))];
    rows=D.items.filter(i=>(!adminItemKind||i.kind===adminItemKind)&&(!q||`${i.id} ${i.name}`.toLocaleLowerCase('vi').includes(q)));
    var kindSel=`<select id="admin-item-kind"><option value="">Mọi loại</option>${kinds.map(k=>`<option value="${esc(k)}" ${k===adminItemKind?'selected':''}>${esc(KIND_VI[k]||k)}</option>`).join('')}</select>`;
    var cards=rows.slice(0,48).map(i=>`<article class="card admin-item"><div class="admin-item-icon">${iconOf(i.id)}</div><div><h3>${esc(i.name)}</h3><small>${esc(KIND_VI[i.kind]||i.kind)} · có ${s.hero.bag[i.id]||0}</small></div><div class="admin-item-actions">${button('+1','admin-item',i.id+'|1')}${button('+10','admin-item',i.id+'|10')}${button('+99','admin-item',i.id+'|99')}</div></article>`).join('');
   }else{
    rows=D.equipment.filter(e=>(!adminItemKind||e.slot===adminItemKind)&&(!q||`${e.id} ${e.name}`.toLocaleLowerCase('vi').includes(q)));
    var kindSel=`<select id="admin-item-kind"><option value="">Mọi vị trí</option>${Object.keys(SLOT_VI).map(k=>`<option value="${k}" ${k===adminItemKind?'selected':''}>${SLOT_VI[k]}</option>`).join('')}</select>`;
    var cards=rows.slice(0,48).map(e=>`<article class="card admin-item"><div class="admin-item-icon">${iconOf(e.id)}</div><div><h3>${esc(e.name)}</h3><small>${esc(SLOT_VI[e.slot]||e.slot)} · ${esc(e.rarity||'')} · sức mạnh ${e.power??'–'} · có ${(s.hero.ownedEquipment||[]).filter(x=>x.id===e.id).length+(Object.values(s.hero.equipment||{}).some(x=>x&&x.id===e.id)?1:0)}</small></div><div class="admin-item-actions">${button('Nhận','admin-equip',e.id)}${button('Nhận và mặc','admin-equip',e.id+'|wear')}</div></article>`).join('');
   }
   c.show('Quản trị · Kho vật phẩm',`<div class="admin-toolbar">${button('← Bảng quản trị','admin')}${button('Vật phẩm ('+D.items.length+')','admin-item-tab','items')}${button('Trang bị ('+D.equipment.length+')','admin-item-tab','equip')}<input id="admin-item-search" type="search" placeholder="Tìm theo tên hoặc mã" value="${esc(adminItemQuery)}">${kindSel}</div><p class="small">Đang hiển thị ${Math.min(48,rows.length)}/${rows.length}. Nhận vào hành trang của bản lưu hiện tại.</p><div class="admin-grid admin-items-grid">${cards||'<p>Không có kết quả.</p>'}</div>`);
   const input=document.getElementById('admin-item-search');if(input)input.onchange=()=>{adminItemQuery=input.value;adminItems();};
   const sel=document.getElementById('admin-item-kind');if(sel)sel.onchange=()=>{adminItemKind=sel.value;adminItems();};
  }

  /* ---- Admin: fight any boss to showcase the boss encounters ---- */
  function bossMarkup(){
   const s=state(),god=!!s.admin?.god;
   const regionBoss=D.chapters.map(ch=>{const m=by('monsters',ch.bossId),reg=by('regions',ch.regionId);return button((m?.name||ch.bossId)+' · '+(reg?.name||''),'admin-boss',ch.id);}).join('');
   const overlords=D.overlords.map(o=>button(o.name,'admin-overlord',o.id)).join('');
   return `<section class="admin-boss"><h3>Khiêu chiến trùm</h3><p class="small">${button(god?'Chế độ bất tử: BẬT':'Chế độ bất tử: TẮT','admin-god')} Khi bật, nhân vật và khế thú của bạn không bị hạ gục.</p><div class="admin-tele-maps"><b class="admin-boss-label">Trùm từng vùng</b>${regionBoss}</div><div class="admin-tele-maps"><b class="admin-boss-label">Bá Chủ (kèm hội thoại đánh thức)</b>${overlords}</div><div class="admin-tele-maps"><b class="admin-boss-label">Đặc biệt</b>${button('Rễ Vô Danh Căn Vương (vực sâu)','admin-abyss-boss')}${button('Hộ vệ truyền kỳ M-195','admin-guard')}</div></section>`;
  }
  let adminTele='region_01';
  const KIND_LABEL={region:'Vùng chính',area:'Khu vực',dungeon:'Hầm',realm:'Cõi Bá Chủ',wonder:'Kỳ cảnh',lair:'Hang Bá Chủ',abyss:'Vực sâu'};
  function teleportGroups(){
   const lairs=D.maps_lairs?.maps||[],abyss=D.maps_abyss?.maps||[],special=new Set([...lairs,...abyss].map(m=>m.id)),groups=D.regions.map(r=>({id:r.id,label:r.name,maps:D.maps.filter(m=>m.regionId===r.id&&!special.has(m.id)).map(m=>({id:m.id,name:m.name,kind:m.kind}))}));
   if(lairs.length)groups.push({id:'lairs',label:'Hang Bá Chủ',maps:lairs.map(m=>({id:m.id,name:m.name,kind:'lair'}))});
   if(abyss.length)groups.push({id:'abyss',label:'Vực sâu',maps:abyss.map(m=>({id:m.id,name:m.name,kind:'abyss'}))});
   return groups;
  }
  function teleportMarkup(){
   const groups=teleportGroups(),cur=groups.find(g=>g.id===adminTele)||groups[0];
   return `<section class="admin-tele"><h3>Dịch chuyển tức thì</h3><div class="admin-tele-groups">${groups.map(g=>`<button class="vtn-button ${g.id===cur.id?'is-on':'secondary'}" data-act="admin-tele-group" data-id="${esc(g.id)}">${esc(g.label)}</button>`).join('')}</div><div class="admin-tele-maps">${cur.maps.map(m=>`<button class="vtn-button secondary" data-act="admin-teleport" data-id="${esc(m.id)}"><b>${esc(m.name)}</b><small>${esc(KIND_LABEL[m.kind]||m.kind||'')}</small></button>`).join('')||'<p>Chưa có bản đồ.</p>'}</div></section>`;
  }
  function admin(){
   const s=state();s.admin??={enabled:false};const enabled=s.admin.enabled,query=adminQuery.toLocaleLowerCase('vi'),list=D.monsters.filter(m=>`${m.id} ${m.name} ${m.englishName}`.toLocaleLowerCase('vi').includes(query));
   c.show('Quản trị',`<div class="admin-note">Công cụ quản trị cho bản lưu này: xem toàn bộ 200 loài và 40 tộc, nhận quái, vật phẩm, trang bị, dịch chuyển và khiêu chiến trùm. ${button(enabled?'Tắt quản trị':'Bật quản trị','admin-toggle')}</div>${enabled?`<div class="admin-toolbar"><label>Cấp quái nhận <input id="admin-level" type="number" min="1" max="60" value="10"></label>${button('Sở hữu đủ 200 loài','admin-all')}${button('Mở đầy đủ hai sách','admin-reveal')}${button('Hồi phục toàn đội','admin-heal')}${button('Nhận vật phẩm luyện cấp','admin-growth')}${button('Kho vật phẩm · trang bị','admin-items')}${button('Kho Khế Hồn','party-tab','storage')}${button('Bách Quái Lục','dex')}${button('Vạn Tộc Chí','races')}</div><div class="admin-toolbar">${button('Giao đấu với người có quái','admin-battle','trainer')}${button('Giao đấu với người đi một mình','admin-battle','solo')}${button('Gặp quái hoang dã','admin-battle','wild')}</div>${teleportMarkup()}${bossMarkup()}<label>Tìm trong 200 loài <input id="admin-search" type="search" placeholder="Mã hoặc tên" value="${esc(adminQuery)}"></label><div class="admin-grid">${list.slice(0,40).map(m=>`<article class="card">${c.sprite(m.id,'',false,false,96)}<h3>${esc(m.name)}</h3><p>${m.id} · ${esc(m.types.join(' / '))}</p>${button('Nhận quái','admin-grant',m.id)}${button('Xem đầy đủ','admin-monster',m.id)}</article>`).join('')}</div>${list.length>40?'<p>Tìm theo tên hoặc mã để xem các loài còn lại.</p>':''}`:''}`,'admin');
   const input=document.getElementById('admin-search');if(input)input.onchange=()=>{adminQuery=input.value;admin();};
  }
  function handle(action,id){
   const s=state();if(!s)return false;
   if(action==='quest-route'){const target=objective();if(target)go(target.mapId,target.point,target.label);else c.toast('Đã hoàn tất các nhiệm vụ đang theo dõi.');return true;}
   if(action==='quest-navigate'){questRoute(id);return true;}
   if(action==='route-stop'){cancelRoute();return true;}
   if(action==='atlas-local'||action==='atlas-world'){atlasMode=action==='atlas-world'?'world':'local';atlas();return true;}
   if(action==='atlas-hunt'||action==='hunt'){hunt(id);return true;}
   if(action==='atlas-go'){if(atlasSelection)go(atlasSelection.mapId,atlasSelection.point,atlasSelection.label);return true;}
   if(action==='party-tab'){storagePage=0;storage(id);return true;}
   if(action==='storage-page'){storagePage=Math.max(0,Number(id)||0);storage();return true;}
   if(action==='admin'){admin();return true;}
   if(action==='admin-toggle'){s.admin??={};s.admin.enabled=!s.admin.enabled;c.save();admin();return true;}
   if(!action.startsWith('admin-'))return false;
   if(!s.admin?.enabled||battle())return true;
   const level=R.clamp(Math.round(Number(document.getElementById('admin-level')?.value)||10),1,60);
   if(action==='admin-all'){const owned=new Set([...s.party,...s.storage].map(m=>m.speciesId));let n=0;for(const m of D.monsters)if(!owned.has(m.id)){grant(m.id,level);n++;}c.save();c.hud();c.toast(`Đã nhận ${n} loài còn thiếu. Đội tối đa năm con; phần còn lại ở kho.`);return true;}
   if(action==='admin-grant'){grant(id,level);c.save();c.hud();c.toast('Đã nhận '+by('monsters',id)?.name+'.');return true;}
   if(action==='admin-reveal'){s.seen=D.monsters.map(m=>m.id);s.caught=s.seen.slice();s.discoveredWeaknesses=s.seen.slice();s.seenRaces=D.races.map(r=>r.id);s.looksCaught={};for(const id of s.seen){const looks=(R.availableLooks?.(id)||[]).filter(l=>l!=='primary');if(looks.length)s.looksCaught[id]=looks.slice();}s.collectedForms=D.evolutions.map(e=>e.id);c.save();c.toast('Đã mở toàn bộ Bách Quái Lục (kể cả biến thể và mọi dạng tiến hóa) và Vạn Tộc Chí.');return true;}
   if(action==='admin-tele-group'){adminTele=id;admin();return true;}
   if(action==='admin-teleport'){const m=by('maps',id)||(D.maps_lairs?.maps||[]).concat(D.maps_abyss?.maps||[]).find(v=>v.id===id);if(c.teleport(id)){c.toast('Đã dịch chuyển tới '+(m?.name||id)+'.');}else c.toast('Không dịch chuyển được tới nơi này.');return true;}
   if(action==='admin-growth'){const bag=s.hero.bag;bag.exp_cake=(bag.exp_cake||0)+20;bag.exp_feast=(bag.exp_feast||0)+10;bag.level_fruit=(bag.level_fruit||0)+10;c.save();c.hud();c.toast('Đã nhận 20 Bánh Tro, 10 Yến Tiệc, 10 Quả Nguyệt Thụ. Dùng trong Hành trang.');return true;}
   if(action==='admin-items'){adminItems();return true;}
   if(action==='admin-item-tab'){adminItemTab=id;adminItemKind='';adminItems();return true;}
   if(action==='admin-item'){const [iid,qty]=id.split('|'),n=Math.max(1,Number(qty)||1);if(by('items',iid)){s.hero.bag[iid]=(s.hero.bag[iid]||0)+n;c.save();c.hud();c.toast('Đã nhận '+by('items',iid).name+' × '+n+'.');adminItems();}return true;}
   if(action==='admin-equip'){const [eid,mode]=id.split('|'),spec=by('equipment',eid);if(spec){const entry={id:eid,plus:0,gems:0};s.hero.ownedEquipment=s.hero.ownedEquipment||[];if(mode==='wear'){const old=s.hero.equipment[spec.slot];if(old)s.hero.ownedEquipment.push(old);s.hero.equipment[spec.slot]=entry;}else s.hero.ownedEquipment.push(entry);c.save();c.hud();c.toast('Đã nhận '+spec.name+(mode==='wear'?' và mặc vào.':'.'));adminItems();}return true;}
   if(action==='admin-god'){s.admin.god=!s.admin.god;c.save();admin();return true;}
   if(action==='admin-boss'){const ch=D.chapters.find(x=>x.id===id);if(!ch)return true;const reg=by('regions',ch.regionId),lv=reg.recommendedLevel[1];const enemy=R.spawnBoss(ch.bossId,lv);c.close();c.teleport(ch.regionId);c.beginBattle('boss',[enemy],ch.regionId,ch.bossId==='M-200'?{finalBoss:true}:{});return true;}
   if(action==='admin-overlord'){const ov=D.overlords.find(x=>x.id===id);if(!ov)return true;delete s.flags['overlord_resolved_'+ov.id];c.close();c.teleport(ov.region);g.VTNGame.startOverlordWake(ov.id);return true;}
   if(action==='admin-abyss-boss'){c.close();g.VTNGame.startAbyssBoss();return true;}
   if(action==='admin-guard'){c.close();const e=R.spawnWild('M-195',Math.max(12,s.hero.level+2),Math.random,{heartlessChance:1});e.captureLocked=true;c.beginBattle('wild',[e],'abyss_core',{legendaryGuard:true});return true;}
   if(action==='admin-heal'){s.hero.hp=R.heroStats(s).hp;s.hero.mp=R.heroStats(s).mp;for(const m of [...s.party,...s.storage]){const st=R.monsterStats(m);m.hp=st.hp;m.mp=st.mp;m.status=null;}c.save();c.hud();c.toast('Đã hồi đầy HP và MP.');return true;}
   if(action==='admin-monster'){if(!s.caught.includes(id))s.caught.push(id);if(!s.seen.includes(id))s.seen.push(id);c.monster(id);return true;}
   if(action==='admin-battle'){if(id==='wild')c.beginBattle('wild',[R.spawnWild('M-005',Math.min(level,5))]);else c.beginBattle('human',id==='solo'?[]:[R.instantiate('M-005',level)],null,{opponent:humanOpponent(R,'human',null,s,{level,name:'Lữ khách'})});return true;}
   return true;
  }
  document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.code==='KeyA'&&state()&&!battle()){e.preventDefault();admin();}});
  return {handle,atlas,storage,admin,go,tick,hunt,huntPick,huntStop,huntStart,huntState:()=>({...auto}),whereHtml,spawnTable,questRoute,objective,cancelRoute,isRouting:()=>!!route,onInteract:id=>{if(route&&state()?.mapId===route.mapId&&(route.point?.npc?.id||route.point?.id)===id)cancelRoute(true);},manualMove:()=>{if(auto.on&&!issuing)huntStop();if(route&&!issuing)cancelRoute(true);},inspect:()=>route&&JSON.parse(JSON.stringify(route))};
 }
 g.VTNAdventure={PARTY_LIMIT,effectiveness,mapRoute,humanOpponent,create};
})(typeof window!=='undefined'?window:globalThis);
