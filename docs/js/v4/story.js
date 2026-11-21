(function(g){
 'use strict';
 const D=g.VTN_DATA||{},R=g.VTNRules,DATA=D.story_prologue||{scenes:[],knownSpeakers:[]},known=new Set(DATA.knownSpeakers||[]);
 let root=null,active=null,typeTimer=null,typing=false,typedFull='',confirming=false;
 const by=(key,id)=>R?.by?.(key,id),game=()=>g.VTNGame,state=()=>game()?.storyState?.();
 function kingdomForRace(raceOrId){return R?.kingdomForRace?.(raceOrId)||'Vương quốc Hắc Tinh';}
 function raceGroup(s){return R?.raceGroup?.(s?.hero?.raceId)||'';}
 function starter(s){const id=s?.hero?.starterSpeciesId||s?.flags?.prologueStarter||s?.party?.[0]?.speciesId;return by('monsters',id)||{};}
 function bonded(s){const list=[...(s?.party||[])].sort((a,b)=>(b.bond||0)-(a.bond||0));const m=list[0];return m?(m.nickname||by('monsters',m.speciesId)?.name||'con thú'):'con thú';}
  const UNKNOWN_MEMORY={title:'Một ký ức không rõ',text:'Hình ảnh này đã mất nét, chỉ còn lại một khoảng trống.'},PV=D.prologue_vars||{};
  function memoryEntry(id){return D.memory_book?.find(v=>v.id===id)||UNKNOWN_MEMORY;}
  function currentMemory(s=state()){const id=active?.memoryId||D.maps_abyss?.memories?.[Number(s?.flags?.abyssMemoryIndex??-1)];return memoryEntry(id);}
  function values(s=state()){
   const race=by('races',s?.hero?.raceId)||{},mon=starter(s),map=by('maps',s?.mapId),reg=by('regions',map?.regionId),memory=currentMemory(s),kingdom=s?.kingdom||kingdomForRace(s?.hero?.raceId),kingdomVars=PV.kingdomVars?.[kingdom]||{},raceVars=PV.raceVars?.[race.id]||{},className=PV.classNames?.[s?.hero?.classId]||by('classes',s?.hero?.classId)?.name||'người lữ hành',khoiId=PV.khoiForStarter?.[mon.id]||PV.npcStarters?.khoi,khoi=by('monsters',khoiId)||{};
   const pages=PV.memoryPages||{};
   const result={TEN:s?.hero?.name||'Vô Danh',TOC:race.name||'người',VUONG_QUOC:kingdom,STARTER:mon.name||'con thú',STARTER_SPECIES:mon.name||'con thú',HE:mon.types?.[0]||'mộc',KHOI_TYPE:khoi.types?.[0]||'mộc',KHOI_STARTER:khoi.name||'con thú',HUY_STARTER:by('monsters',PV.npcStarters?.huy)?.name||'con thú',VY_STARTER:by('monsters',PV.npcStarters?.vy)?.name||'con thú',BAO_STARTER:by('monsters',PV.npcStarters?.bao)?.name||'con thú',FIRST_HEART_BEAST:by('monsters',PV.firstHeartBeast)?.name||'con thú',CAVE_HEART_BEAST:by('monsters',PV.caveHeartBeast)?.name||'con thú',COMPANION:bonded(s),HAND_FEATURE:raceVars.handFeature||'bàn tay giữ cấu trúc tương hợp với hình thể '+(race.name||'người'),BODY_MARK:raceVars.bodyMark||'những dấu hiệu cơ thể chưa được mô tả',KINGDOM_ARMOR:kingdomVars.armor||'giáp của vương quốc',KINGDOM_ARCHITECTURE:kingdomVars.architecture||'kiến trúc của vương quốc',RULER_TITLE:kingdomVars.rulerTitle||'Quốc chủ',PLAYER_CLASS:className,QUAI:bonded(s),VUNG:reg?.name||map?.name||'vùng này',MEMORY_TITLE:memory.title,MEMORY_TEXT:memory.text};
   for(let i=1;i<=3;i++){const page=pages[String(i)]||{};result[`MEMORY_0${i}_TITLE`]=page.title||PV.fallbacks?.memoryTitle||UNKNOWN_MEMORY.title;result[`MEMORY_0${i}_TEXT`]=page.text||PV.fallbacks?.memoryText||UNKNOWN_MEMORY.text;}
   return result;
  }
 function substitute(text,s=state()){const vars=values(s),f=s?.hero?.gender==='f';return String(text??'').replace(/\{([A-Z0-9_]+)\}/g,(_,key)=>Object.prototype.hasOwnProperty.call(vars,key)?vars[key]:`{${key}}`).replace(/\{VÙNG\}/g,vars.VUNG).replace(/\{anh\/chị\}/g,f?'chị':'anh').replace(/\{Anh\/[Cc]hị\}/g,f?'Chị':'Anh').replace(/\{cậu\/cô\}/g,f?'cô':'cậu').replace(/\{Cậu\/Cô\}/g,f?'Cô':'Cậu').replace(/\{em\}/g,f?'em':'em');}
 function condition(cond,s=state()){
  if(!cond)return true;
  if(typeof cond==='string')return g.VTNStoryFx?g.VTNStoryFx.test(cond,s,{selected:active?.selected}):true;
  if(cond.default===true)return true;
   if(cond.not!==undefined)return !condition(cond.not,s);
   if(Array.isArray(cond.and))return cond.and.every(v=>condition(v,s));
   if(Array.isArray(cond.or))return cond.or.some(v=>condition(v,s));
  if(cond.axis==='kingdom'&&cond.kingdom)return cond.kingdom==='*'||cond.kingdom===s?.kingdom;
  if(cond.axis==='raceGroup'&&cond.raceGroup)return cond.raceGroup==='*'||cond.raceGroup===raceGroup(s);
  if(cond.kingdom)return cond.kingdom==='*'||cond.kingdom===s?.kingdom;
  if(cond.raceGroup)return cond.raceGroup==='*'||cond.raceGroup===raceGroup(s);
  if(cond.flag)return !!s?.flags?.[cond.flag];
  if(cond.notFlag)return !s?.flags?.[cond.notFlag];
  if(Array.isArray(cond.all))return cond.all.every(v=>condition(v,s));
  if(Array.isArray(cond.any))return cond.any.some(v=>condition(v,s));
  return true;
 }
 function validate(data=DATA){
  const speakers=new Set(data.knownSpeakers||[]),scenes=Array.isArray(data.scenes)?data.scenes:[],errors=[];
  if(!scenes.length)errors.push('no scenes');
  for(const scene of scenes){if(!scene?.id||!Array.isArray(scene.lines))errors.push('invalid scene');for(const line of scene.lines||[]){if(!speakers.has(line.speaker))errors.push('unknown speaker '+line.speaker);if(line.choice&&!Array.isArray(line.choice))errors.push('invalid choice');for(const option of line.choice||[])for(const nested of option.lines||[])if(!speakers.has(nested.speaker))errors.push('unknown choice speaker '+nested.speaker);}}
  return {ok:errors.length===0,errors,sceneCount:scenes.length,speakers:[...speakers]};
 }
 function scene(id){const resolved=DATA.aliases?.[id]||id;return DATA.scenes.find(v=>v.id===resolved)||(D.questScenes||[]).find(v=>v.id===resolved);}
 const CAST_SPEAKERS={'KHÔI':'khoi','BẢO':'bao','MINH KHÔI':'khoi','TẠ MINH KHÔI':'khoi','GIA HUY':'huy','ĐÀM GIA HUY':'huy','THẢO VY':'vy','NGUYỄN THẢO VY':'vy','QUỐC BẢO':'bao','TRỊNH QUỐC BẢO':'bao','LÃO THỦ MỘ':'thumo'};
 const GENERIC_PORTRAIT_FALLBACKS={'MINH KHÔI':{raceId:'R-01',look:'m_young_a'},'TƯ TẾ':{raceId:'R-01',look:'m_adult_a'}};
 function ensure(){
  if(!g.document||root)return;
  root=g.document.createElement('div');root.id='story-overlay';root.className='story-overlay';root.setAttribute('aria-modal','true');root.setAttribute('role','dialog');root.innerHTML='<div class="story-backdrop" data-story-backdrop><img class="story-backdrop-art" data-story-backdrop-art alt="" aria-hidden="true" draggable="false"><div class="story-vignette"></div><section class="story-dialogue" data-story-dialogue><div class="story-portrait" data-story-portrait aria-hidden="true"></div><div class="story-copy"><div class="story-speaker" data-story-speaker></div><div class="story-text" data-story-text aria-live="polite"></div><div class="story-choices" data-story-choices></div><div class="story-controls"><button class="story-advance" data-story-advance type="button">Tiếp tục</button><span>Chạm hoặc nhấn Enter · Space</span><button class="story-back" data-story-back type="button" aria-label="Bỏ qua cảnh">Esc · Bỏ qua</button></div></div></section><div class="story-confirm" data-story-confirm hidden><h2>Bỏ qua cảnh?</h2><p>Phần mở đầu sẽ được đánh dấu đã xem và ngươi sẽ bước vào thế giới mở.</p><div class="story-confirm-actions"><button class="vtn-button danger" data-story-skip type="button">Bỏ qua cảnh</button><button class="vtn-button" data-story-cancel type="button">Ở lại</button></div></div></div>';
  g.document.body.appendChild(root);
  g.addEventListener('resize',fitBackdrop);
  root.addEventListener('click',event=>{const target=event.target.closest?.('[data-story-advance],[data-story-choice],[data-story-back],[data-story-skip],[data-story-cancel]');if(!target)return;event.preventDefault();event.stopPropagation();if(target.matches('[data-story-advance]'))advance();else if(target.matches('[data-story-choice]'))choose(target.dataset.storyChoice);else if(target.matches('[data-story-back]'))showConfirm();else if(target.matches('[data-story-skip]'))skip();else cancelConfirm();});
 }
 function hide(){if(!root)return;root.classList.remove('is-active');root.querySelector('[data-story-confirm]').hidden=true;g.document.body.classList.remove('story-mode');confirming=false;clearInterval(typeTimer);typing=false;}
 function showConfirm(){if(!active)return;if(typing)completeTyping();confirming=true;root.querySelector('[data-story-confirm]').hidden=false;root.querySelector('[data-story-cancel]').focus();}
 function cancelConfirm(){if(!root)return;confirming=false;root.querySelector('[data-story-confirm]').hidden=true;root.querySelector('[data-story-advance]')?.focus();}
 function skip(){const s=state();if(s){s.flags??={};s.flags.prologueDone=true;}active=null;hide();game()?.finishPrologue?.();}
 function currentScene(){return scene(active?.sceneId);}
 function slotOk(line){if(!line?.slot)return true;active.slots??=new Map();const used=active.slots.get(line.slot);if(used)return used===line||!!(line.pageGroup&&used.pageGroup===line.pageGroup);return active.slots.size<4;}
 function shown(line){return condition(line.cond)&&slotOk(line);}
 function currentLine(){if(!active)return null;const sc=currentScene();if(!sc)return null;while(active.queue.length&&!shown(active.queue[0])){active.queue.shift();}if(active.queue.length)return active.queue[0];while(active.index<sc.lines.length&&!shown(sc.lines[active.index]))active.index++;if(active.until&&(sc.lines[active.index]?.menuId===active.until||sc.lines[active.index]?.anchor===active.until))return null;return sc.lines[active.index]||null;}
 function currentKey(){return active?.queue.length?'queue:'+active.queue.length:'line:'+active?.index;}
 function speakerName(raw){return raw==='{STARTER}'?values().STARTER:substitute(raw);}
 function genericPortrait(raw,s){let src=null;if(raw==='TƯ TẾ'){const list=g.VTN_RACE_PEOPLE?.races?.[s?.hero?.raceId]||[],look=list.find(v=>v.key==='m_elder_a')||list.find(v=>v.gender==='m'&&v.age==='elder')||list[0];src=look?.front||null;}else if(raw==='{TEN}'&&(g.VTN_CLASS_PORTRAITS_PIXEL?.[s?.hero?.classId]||g.VTN_CLASS_PORTRAITS?.[s?.hero?.classId])){src=g.VTN_CLASS_PORTRAITS_PIXEL?.[s.hero.classId]||g.VTN_CLASS_PORTRAITS[s.hero.classId];}else if(raw==='{TEN}'){const list=g.VTN_RACE_PEOPLE?.races?.[s?.hero?.raceId]||[],look=list.find(v=>v.key===s?.hero?.storyLook&&(!s?.hero?.gender||v.gender===s.hero.gender))||list.find(v=>v.gender===(s?.hero?.gender||'m')&&v.age===(s?.hero?.age||'young'))||list[0];src=look?.front||null;}else{const spec=DATA.portraits?.[raw]||GENERIC_PORTRAIT_FALLBACKS[raw];if(!spec)return null;const list=g.VTN_RACE_PEOPLE?.races?.[spec.raceId]||[],look=list.find(v=>v.key===spec.look)||list.find(v=>v.gender==='m'&&v.age==='young')||list[0];src=look?.front||null;}return src;}
 function portraitState(slot,dialogue,empty){slot.classList.toggle('is-empty',empty);dialogue.classList.toggle('no-portrait',empty);}
 function mountPortrait(slot,dialogue,speaker,src,source,castKey,fallback){if(!src){portraitState(slot,dialogue,true);return;}portraitState(slot,dialogue,false);const image=g.document.createElement('img');image.src=src;image.alt=speaker;image.draggable=false;image.dataset.portraitSource=source;if(castKey)image.dataset.castKey=castKey;image.onerror=()=>{if(image.parentNode!==slot)return;image.remove();if(fallback&&fallback!==src)mountPortrait(slot,dialogue,speaker,fallback,'generic',null,null);else portraitState(slot,dialogue,true);};slot.appendChild(image);}
 function portrait(raw){const speaker=speakerName(raw),slot=root.querySelector('[data-story-portrait]'),dialogue=root.querySelector('[data-story-dialogue]');slot.innerHTML='';const empty=raw==='DẪN'||!raw||raw==='{STARTER}';portraitState(slot,dialogue,empty);if(empty)return;const s=state(),castKey=CAST_SPEAKERS[raw],spec=g.VTN_CAST?.[castKey],castFront=spec?.front||spec?.portrait,fallback=spec?.front||genericPortrait(currentLine()?.portrait||raw,s);if(castFront){mountPortrait(slot,dialogue,speaker,castFront,'cast',castKey,fallback);return;}mountPortrait(slot,dialogue,speaker,fallback,'generic',null,raw==='{TEN}'?g.VTN_CLASS_PORTRAITS?.[s?.hero?.classId]:null);}
 function fitBackdrop(){if(!root)return;const backdrop=root.querySelector('[data-story-backdrop]'),art=root.querySelector('[data-story-backdrop-art]');if(!backdrop||!art||!art.naturalWidth)return;const width=Math.max(1,backdrop.clientWidth),scale=art.naturalWidth<=width?Math.max(1,Math.floor(width/art.naturalWidth)):width/art.naturalWidth;art.style.width=`${Math.max(1,Math.round(art.naturalWidth*scale))}px`;art.style.height=`${Math.max(1,Math.round(art.naturalHeight*scale))}px`;art.style.display='block';}
 function background(sc){const backdrop=root.querySelector('[data-story-backdrop]'),art=root.querySelector('[data-story-backdrop-art]'),src=sc?.background||'';backdrop.style.setProperty('--story-backdrop-image',src?`url("${src}")`:'none');if(art.getAttribute('src')!==src){art.onload=fitBackdrop;art.removeAttribute('src');art.style.display='none';if(src)art.src=src;}else if(src)fitBackdrop();root.querySelector('[data-story-dialogue]').dataset.scene=sc?.id||'';}
 function completeTyping(){if(!typing)return;clearInterval(typeTimer);typing=false;root.querySelector('[data-story-text]').textContent=typedFull;root.querySelector('[data-story-advance]').textContent='Tiếp tục';}
 function beginTyping(text){clearInterval(typeTimer);typedFull=text;const el=root.querySelector('[data-story-text]');if(!text){typing=false;el.textContent='';return;}typing=true;let at=0;el.textContent='';const speed=Math.max(8,28/(Number(state()?.settings?.textSpeed)||1));typeTimer=setInterval(()=>{at=Math.min(text.length,at+1);el.textContent=text.slice(0,at);if(at>=text.length)completeTyping();},speed);root.querySelector('[data-story-advance]').textContent='Hiện hết';}
 function choices(line){return (line.choice||[]).filter(option=>(option.once===false||!active.selected.has(option.id))&&condition(option.cond));}
 function overlordBackground(ov){const rid=String(ov.region||'region_01').slice(-2);return {id:'overlord_'+ov.id,background:`assets/lairs/r${rid}_lair.png`};}
 function renderOverlord(){
  const ov=active?.overlord;if(!ov||!root)return;
  background(overlordBackground(ov));const speaker=root.querySelector('[data-story-speaker]'),dialogue=root.querySelector('[data-story-dialogue]'),choiceBox=root.querySelector('[data-story-choices]'),advanceButton=root.querySelector('[data-story-advance]');speaker.textContent=ov.name;speaker.dataset.speaker=ov.name;dialogue.dataset.speaker=ov.name;portraitState(root.querySelector('[data-story-portrait]'),dialogue,true);
  if(active.phase==='wake'){const line=ov.wakeLines?.[active.wakeIndex]||'';beginTyping(line);choiceBox.innerHTML='';choiceBox.hidden=true;advanceButton.hidden=false;root.querySelector('[data-story-back]').hidden=false;}
  else{beginTyping('Giấc ngủ đã nghe thấy ngươi. Quyết định số phận của vùng đất.');const status=option=>R?.overlordOptionStatus?.(state(),ov,option)||{ok:true,label:option.label,reason:''};choiceBox.innerHTML=(ov.options||[]).map(option=>{const st=status(option),reason=st.reason&&st.ok?' · '+st.reason:'';return `<button class="story-choice${st.ok?'':' is-locked'}" data-story-choice="${String(option.id).replace(/"/g,'&quot;')}" type="button" ${st.ok?'':'disabled'}>${String(st.label||option.label)}${st.ok?'':st.hidden?'':' · '+(st.reason||'Chưa đủ điều kiện')}</button>`;}).join('');choiceBox.hidden=false;advanceButton.hidden=true;root.querySelector('[data-story-back]').hidden=false;}
  root.classList.add('is-active');g.document.body.classList.add('story-mode');if(active.phase==='wake')advanceButton.focus();
 }
 function render(){
  if(!active||!root)return;if(active.kind==='overlord'){renderOverlord();return;}
  const sc=currentScene(),line=currentLine();if(!sc||!line){finishScene();return;}if(line.slot&&!active.slots?.has(line.slot)){active.slots??=new Map();active.slots.set(line.slot,line);}if(!active.entered){active.entered=true;const first=sc.lines.find(l=>l.enterEffect);if(first)runEffect(first.enterEffect);}background(sc);const speaker=root.querySelector('[data-story-speaker]');speaker.textContent=speakerName(line.speaker);speaker.dataset.speaker=line.speaker;root.querySelector('[data-story-dialogue]').dataset.speaker=line.speaker;portrait(line.speaker);const text=substitute(line.text);beginTyping(text);const choiceBox=root.querySelector('[data-story-choices]'),options=choices(line);choiceBox.innerHTML=options.map(option=>`<button class="story-choice" data-story-choice="${String(option.id).replace(/"/g,'&quot;')}" type="button">${substitute(option.text)}</button>`).join('');choiceBox.hidden=!options.length;root.querySelector('[data-story-advance]').hidden=!!options.length;root.querySelector('[data-story-back]').hidden=false;root.classList.add('is-active');g.document.body.classList.add('story-mode');if(!options.length)root.querySelector('[data-story-advance]').focus();if(!text&&!options.length&&line.effect){const expected=active;setTimeout(()=>{if(active===expected&&!active.paused)advance();},0);}}
  function runEffect(effect){if(!effect)return {pause:false};const s=state();switch(effect.type){case'gd7':{const d=g.VTNStoryFx?.apply(effect.list,{selected:active?.selected})||[];if(active){active.deferred??=[];active.deferred.push(...d);}break;}case'flag':s.flags??={};s.flags[effect.key]=true;break;case'quest':g.VTNGame?.quests?.applyEffects(effect.effects||{});break;case'enterMap':game()?.storyMap?.(effect.mapId,{silent:true,time:0});break;case'whiteFlash':root.classList.add('story-flash');setTimeout(()=>root?.classList.remove('story-flash'),Number(effect.duration)||450);break;case'startAbyssTutorial':game()?.startAbyssTutorial?.();return {pause:true};case'startAbyssPlay':active=null;hide();game()?.storyMap?.('abyss_ash',{silent:true,shrine:false,time:0});game()?.startAbyssFirstBattle?.();return {handledEnd:true};case'collectMemory':{const index=Number(s?.flags?.abyssMemoryIndex??0),id=(D.maps_abyss?.memories||[])[index]||`home_abyss_page_${index+1}`;if(active)active.memoryId=id;s.homeMemoriesSeen??=[];if(!s.homeMemoriesSeen.includes(index)){s.homeMemoriesSeen.push(index);if(s.hero?.memories&&!s.hero.memories.includes(id)&&s.hero.memories.length<12)s.hero.memories.push(id);}break;}case'collectNameTag':s.flags.abyssNameTag=true;game()?.markStoryClue?.('name_tag');break;case'startLinhChu':game()?.startLinhChu?.();return {pause:true};case'startAbyssBoss':game()?.startAbyssBoss?.();return {pause:true};case'startScene9':setTimeout(()=>startScene('scene_9'),0);return {handledEnd:true};case'endPrologue':active=null;hide();game()?.finishPrologue?.();return {handledEnd:true};}return {pause:!!effect.pause};}
 function runEffect(effect){
  if(!effect)return {pause:false};
  const s=state();if(!s)return {pause:false};
  if(effect.type==='sequence'){
   let at=0;
   const next=()=>{for(;at<(effect.effects||[]).length;at++){const result=runEffect(effect.effects[at]);if(result.wait){at++;return result.wait.then(next);}if(result.handledEnd)return result;}return {pause:false};};
   const result=next();return result?.then?{wait:result}:result;
  }
  if(effect.type==='flag'){s.flags??={};s.flags[effect.key]=effect.value!==false;return {pause:false};}
  if(effect.type==='item'){
   s.flags??={};s.storyItems??={};const once=effect.onceKey;
   if(once&&s.flags[once])return {pause:false};
   if(once)s.flags[once]=true;const count=Number(effect.count)||1;
   if(by('items',effect.id)&&s.hero?.bag)s.hero.bag[effect.id]=(s.hero.bag[effect.id]||0)+count;else s.storyItems[effect.id]=(s.storyItems[effect.id]||0)+count;
   return {pause:false};
  }
  if(effect.type==='memory'){
   s.flags??={};s.hero??={};s.hero.memories??=[];s.homeMemoriesSeen??=[];const index=Number(effect.index)||0,once=effect.onceKey||`p5_memory_${String(index).padStart(2,'0')}`,id=`home_abyss_page_${index}`;
   if(s.flags[once])return {pause:false};s.flags[once]=true;if(!s.homeMemoriesSeen.includes(index))s.homeMemoriesSeen.push(index);if(!s.hero.memories.includes(id)&&s.hero.memories.length<12)s.hero.memories.push(id);if(active)active.memoryId=id;return {pause:false};
  }
  if(effect.type==='card'){
   const api=g.VTNCharCards;if(typeof api?.show!=='function')return {pause:false};
   return {wait:Promise.resolve(api.show(effect.id,{grantTitle:!!effect.grantTitle}))};
  }
  if(effect.type==='hook'){
   const hook=g.VTNPrologueHooks?.[effect.name];
   if(typeof hook!=='function'){console.info('[VTNPrologue] Hook chưa nối, bỏ qua:',effect.name);return {pause:false};}
   try{const result=hook(s,effect);return result?.then?{wait:Promise.resolve(result)}:{pause:false};}catch(error){console.warn('[VTNPrologue] Hook lỗi, bỏ qua:',effect.name,error);return {pause:false};}
  }
  switch(effect.type){case'gd7':{const d=g.VTNStoryFx?.apply(effect.list,{selected:active?.selected})||[];if(active){active.deferred??=[];active.deferred.push(...d);}break;}case'quest':g.VTNGame?.quests?.applyEffects(effect.effects||{});break;case'enterMap':game()?.storyMap?.(effect.mapId,{silent:true,time:0});break;case'whiteFlash':root.classList.add('story-flash');setTimeout(()=>root?.classList.remove('story-flash'),Number(effect.duration)||450);break;case'startAbyssTutorial':game()?.startAbyssTutorial?.();return {pause:true};case'startAbyssPlay':active=null;hide();game()?.storyMap?.('abyss_ash',{silent:true,shrine:false,time:0});game()?.startAbyssFirstBattle?.();return {handledEnd:true};case'collectMemory':{const index=Number(s?.flags?.abyssMemoryIndex??0),id=(D.maps_abyss?.memories||[])[index]||`home_abyss_page_${index+1}`;if(active)active.memoryId=id;s.homeMemoriesSeen??=[];if(!s.homeMemoriesSeen.includes(index)){s.homeMemoriesSeen.push(index);if(s.hero?.memories&&!s.hero.memories.includes(id)&&s.hero.memories.length<12)s.hero.memories.push(id);}break;}case'collectNameTag':s.flags.abyssNameTag=true;game()?.markStoryClue?.('name_tag');break;case'startLinhChu':game()?.startLinhChu?.();return {pause:true};case'startAbyssBoss':game()?.startAbyssBoss?.();return {pause:true};case'startScene9':setTimeout(()=>startScene('scene_9'),0);return {handledEnd:true};case'endPrologue':active=null;hide();game()?.finishPrologue?.();return {handledEnd:true};}return {pause:!!effect.pause};
 }
 function consumeLine(){if(active.queue.length){active.queue.shift();if(active.queue.length)return false;const choiceIndex=active.returnChoice,shouldExit=active.returnExit;active.returnChoice=null;active.returnExit=false;if(choiceIndex!=null){const line=currentScene().lines[choiceIndex],remaining=choices(line);if(!shouldExit&&(line.choiceMode==='repeat'||line.choiceMode==='menu'||active.returnStay)&&remaining.length){active.returnStay=false;return false;}active.returnStay=false;active.index=choiceIndex+1;return true;}return true;}active.index++;return true;}
 function advance(){if(!active||confirming||active.paused)return;if(active.kind==='overlord'){if(typing){completeTyping();return;}if(active.phase==='wake'){if(active.wakeIndex+1<(active.overlord.wakeLines||[]).length){active.wakeIndex++;renderOverlord();}else{active.phase='choices';renderOverlord();}}return;}if(typing){completeTyping();return;}const line=currentLine();if(!line)return finishScene();if(line.choice?.length&&choices(line).length)return;const key=currentKey();let effectResult={pause:false};if(!active.effects.has(key)){active.effects.add(key);effectResult=runEffect(line.effect);}if(effectResult.handledEnd)return;consumeLine();if(effectResult.pause){active.paused=true;hide();return;}render();}
 function advance(){
  if(!active||confirming||active.paused||active.waiting)return;
  if(active.kind==='overlord'){if(typing){completeTyping();return;}if(active.phase==='wake'){if(active.wakeIndex+1<(active.overlord.wakeLines||[]).length){active.wakeIndex++;renderOverlord();}else{active.phase='choices';renderOverlord();}}return;}
  if(typing){completeTyping();return;}
  const line=currentLine();if(!line)return finishScene();if(line.choice?.length&&choices(line).length)return;
  const key=currentKey();let effectResult={pause:false};if(!active.effects.has(key)){active.effects.add(key);effectResult=runEffect(line.effect);}
  if(effectResult.handledEnd)return;
  if(effectResult.wait){const expected=active;active.waiting=true;Promise.resolve(effectResult.wait).catch(error=>console.warn('[VTNStory] Hiệu ứng chờ lỗi:',error)).then(()=>{if(active!==expected)return;active.waiting=false;consumeLine();render();});return;}
  consumeLine();if(effectResult.pause){active.paused=true;hide();return;}render();
 }
 function choose(id){
  if(!active||active.paused||active.waiting)return;if(typing)completeTyping();
  if(active.kind==='overlord'){const ov=active.overlord,option=ov?.options?.find(v=>v.id===id),status=R?.overlordOptionStatus?.(state(),ov,option)||{ok:true};if(!option||!status.ok)return;active=null;hide();game()?.resolveOverlordChoice?.(ov.id,option.id);return;}
  const line=currentLine(),option=choices(line).find(v=>v.id===id);if(!option)return;if(option.once!==false){active.selected.add(id);if(/^p5_/.test(active.sceneId||'')){const st=state();if(st){st.flags??={};st.flags['p5sel_'+active.sceneId]=[...active.selected];}}}if(option.unchoose){active.selected.delete(option.unchoose);active.selected.delete(id);}
  let wait=null;if(option.effect){const result=runEffect(option.effect);if(result.wait)wait=Promise.resolve(result.wait);}for(const ce of option.conditionalEffects||[])if(condition(ce.when))runEffect({type:'gd7',list:ce.effects});
  const expected=active,continueChoice=()=>{if(active!==expected)return;active.queue=(option.lines||[]).slice();active.returnChoice=active.index;active.returnExit=!!option.exit;active.returnStay=!!option.stay;if(!active.queue.length){active.returnChoice=null;if(option.exit||(line.choiceMode!=='repeat'&&line.choiceMode!=='menu'&&!option.stay)||!choices(line).length)active.index++;active.returnExit=false;active.returnStay=false;}root.querySelector('[data-story-choices]').hidden=true;root.querySelector('[data-story-advance]').hidden=false;render();};
  if(wait){active.waiting=true;wait.catch(error=>console.warn('[VTNStory] Lựa chọn chờ lỗi:',error)).then(()=>{active.waiting=false;continueChoice();});return;}continueChoice();
 }
 function finishScene(){if(active?.kind==='overlord'){active=null;hide();return;}const sc=currentScene();if(!sc)return;g.VTNStoryFx?.markSeen(sc.id);const deferred=active.deferred||[];if(deferred.length)setTimeout(()=>g.VTNStoryFx?.runDeferred(deferred),0);const next=sc.next,onEnd=active.onEnd;if(next){active={sceneId:next,index:0,queue:[],returnChoice:null,returnExit:false,selected:new Set(),effects:new Set(),paused:false,waiting:false,onEnd};render();return;}active=null;hide();if(onEnd){try{onEnd();}catch(e){console.warn(e);}}}
 function persistedSel(id){const s=state();return new Set(/^p5_/.test(id)?(s?.flags?.['p5sel_'+id]||[]):[]);}
 function startScene(id,opts={}){const resolved=DATA.aliases?.[id]||id;const sc0=scene(resolved);if(!sc0)return false;ensure();clearInterval(typeTimer);
  let index=0;if(opts?.from){const at=sc0.lines.findIndex(l=>l.menuId===opts.from||l.anchor===opts.from);if(at>=0)index=at;}
  active={sceneId:resolved,index,queue:[],returnChoice:null,returnExit:false,selected:persistedSel(resolved),effects:new Set(),paused:false,waiting:false,onEnd:opts?.onEnd||null,until:opts?.until||null};cancelConfirm();render();return true;}   // from: start at a menu, until: finish before a menu; "once" answers are remembered across visits for p5_ scenes
 function startOverlord(overlordId){const ov=D.overlords?.find(v=>v.id===overlordId);if(!ov)return false;ensure();clearInterval(typeTimer);active={kind:'overlord',overlord:ov,phase:'wake',wakeIndex:0,paused:false};cancelConfirm();renderOverlord();return true;}
 function startPrologue(){const s=state();if(!s||s.flags?.prologueDone)return false;s.kingdom??=kingdomForRace(s.hero?.raceId);s.flags??={};for(const key of DATA.primaryFlags||[])if(s.flags[key]===undefined)s.flags[key]=false;s.flags.prologueStarter??=s.hero?.starterSpeciesId||s.party?.[0]?.speciesId;return startScene('p5_01');}
 function resume(){if(!active)return false;active.paused=false;render();return true;}
 if(g.document)g.addEventListener('keydown',event=>{if(!active)return;if(event.key==='Escape'||event.key==='Backspace'){event.preventDefault();event.stopImmediatePropagation();showConfirm();return;}if(event.key==='Enter'||event.key===' '){if(event.target.closest?.('[data-story-choice]'))return;event.preventDefault();event.stopImmediatePropagation();advance();}},true);
 g.VTNStory={data:DATA,validate,kingdomForRace,substitute,condition,startPrologue,startScene,startOverlord,resume,advance,isActive:()=>!!active,inspect:()=>active?{sceneId:active.sceneId||null,overlordId:active.overlord?.id||null,phase:active.phase||null,index:active.index??active.wakeIndex??0,queueLength:active.queue?.length||0,choiceCount:active.kind==='overlord'?(active.overlord?.options?.length||0):choices(currentLine()).length,typing,paused:!!active.paused}:null};
 g.VTNPrologue={data:DATA,triggers:DATA.triggers||[],play:(id,opts)=>startScene(id,opts),start:startPrologue,inspect:()=>g.VTNStory.inspect()};
})(globalThis);
