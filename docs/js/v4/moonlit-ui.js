(function(){
 'use strict';
 const D=window.VTN_DATA,game=()=>window.VTNGame,content=document.getElementById('content');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const iconNames={journal:'journal',dex:'bestiary',races:'races','items-codex':'inventory',album:'album',party:'party',hero:'character',bag:'inventory',atlas:'map',saves:'save',settings:'settings','loadout-menu':'character'};
 const nav=document.getElementById('nav');
 const skills=document.createElement('button');skills.dataset.act='loadout-menu';skills.dataset.id='hero';skills.textContent='Bộ kỹ năng';nav.insertBefore(skills,nav.querySelector('[data-act=bag]'));
 for(const b of nav.querySelectorAll('button')){
  const label=b.textContent.replace(/[JBRPCIM]$/,'').trim();b.setAttribute('aria-label',label);b.title=label;
  b.innerHTML=`<img src="assets/ui/icons/${iconNames[b.dataset.act]||'journal'}.png" alt=""><span class="nav-label">${esc(label)}</span>`;
 }
 /* P10-V: three primary buttons with visible labels + a "Thêm" button that expands the rest (labels always visible). */
 {
  const primary=['journal','party','bag'],extra=document.createElement('div');extra.className='nav-extra';extra.id='nav-extra';
  [...nav.querySelectorAll(':scope>button')].forEach(b=>{if(!primary.includes(b.dataset.act))extra.appendChild(b);});
  const more=document.createElement('button');more.type='button';more.className='nav-more';more.setAttribute('aria-controls','nav-extra');more.innerHTML='<span class="nav-more-icon" aria-hidden="true">☰</span><span class="nav-label">Thêm</span><span class="nav-caret" aria-hidden="true">▾</span>';
  nav.appendChild(more);nav.appendChild(extra);
  const set=open=>{nav.classList.toggle('is-open',open);more.setAttribute('aria-expanded',String(open));more.querySelector('.nav-caret').textContent=open?'▴':'▾';try{localStorage.setItem('vtn-nav-open',open?'1':'0');}catch{}};
  let saved=false;try{saved=localStorage.getItem('vtn-nav-open')==='1';}catch{}
  set(saved);more.addEventListener('click',e=>{e.stopPropagation();set(!nav.classList.contains('is-open'));});
  extra.addEventListener('click',e=>{if(e.target.closest('button')&&window.matchMedia('(max-width:700px) and (orientation:portrait)').matches)set(false);});
 }
 const minimap=document.createElement('button');minimap.className='world-minimap';minimap.dataset.act='atlas';minimap.setAttribute('aria-label','Mở địa đồ thế giới');minimap.innerHTML='<canvas width="144" height="144" aria-hidden="true"></canvas><span>Địa đồ</span>';document.getElementById('viewport').appendChild(minimap);
 let mapId=null,mapGrid=null;
 function drawMinimap(){
  if(document.hidden||document.body.classList.contains('title-mode'))return;
  const state=game()?.storyState?.();if(!state)return;
  if(mapId!==state.mapId){mapId=state.mapId;mapGrid=game().grid(mapId);}
  const c=minimap.querySelector('canvas'),ctx=c.getContext('2d'),w=mapGrid[0].length,h=mapGrid.length,k=Math.min(136/w,136/h),ox=(144-w*k)/2,oy=(144-h*k)/2;
  ctx.fillStyle='#e9d8ae';ctx.fillRect(0,0,144,144);
  const colors=['#d8c18f','#8a7660','#9db487','#8fb2b8'];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){ctx.fillStyle=colors[mapGrid[y][x]]||'#272236';ctx.fillRect(ox+x*k,oy+y*k,Math.ceil(k),Math.ceil(k));}
  const position=game().heroVisual?.()||state;ctx.fillStyle='#f6c850';ctx.strokeStyle='#33221a';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(ox+(position.x+.5)*k,oy+(position.y+.5)*k,3.5,0,Math.PI*2);ctx.fill();ctx.stroke();
 }
 function decorate(){
  const modal=document.querySelector('#overlay .modal');modal.classList.toggle('npc-dialogue',!!content.querySelector('[data-typewriter]'));
  window.VTNStatRadar?.mount(content);
  for(const card of content.querySelectorAll('#race-grid .choice-card:not([data-portrait])')){
   if(card.querySelector('.race-avatar'))continue;
   card.dataset.portrait='true';const id=card.dataset.selectId,spec=window.VTN_RACE_SPRITES?.races?.[id],look=window.VTN_RACE_PEOPLE?.races?.[id]?.[0];
   const avatar=document.createElement('span');avatar.className='race-avatar';
   if(look?.front)avatar.innerHTML=`<img src="${esc(look.front)}" alt="" loading="lazy">`;
   else if(spec?.battle)avatar.innerHTML=`<img class="sheet-avatar" src="${esc(spec.battle)}" alt="" loading="lazy">`;
   else avatar.textContent='☾';card.prepend(avatar);
  }
 }
 new MutationObserver(decorate).observe(content,{childList:true});
 setInterval(drawMinimap,300);decorate();drawMinimap();
 window.VTNMoonlitUI={inspect:()=>({minimap:!!mapGrid,mapId,theme:'moonlit-manuscript',commands:content.querySelectorAll('.battle-main-actions button').length})};
})();
