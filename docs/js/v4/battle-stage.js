(function(){
'use strict';
// A read-only presentation layer. Combat rules publish impact notifications;
// the stage keeps them across UI redraws, including the final blow.
const D=window.VTN_DATA,R=window.VTNRules,manifest=window.VTN_SPRITE_MANIFEST||{},racePeople=window.VTN_RACE_PEOPLE||null,classSprites=window.VTN_CLASS_SPRITES||null,battleBackgrounds=window.VTN_BATTLE_BG||{};
const facingRight=new Set((window.VTN_FACING?.right||[]).map(String));
const heartText=heart=>heart==='heartless'?'Mất tim':heart==='restored'?'Đã được trả lại tim':'Còn tim';
const by=(k,id)=>(Array.isArray(D[k])?D[k]:D[k].entries).find(v=>v.id===id);
const variantKey=window.VTNArt?.variantKey||((baseKey)=>baseKey),artSpriteKey=window.VTNArt?.spriteKey;
function spriteKey(m){if(m.human)return m.uid;if(artSpriteKey)return artSpriteKey(m);const base=m.formId||m.speciesId+'_0',form=m.formId&&by('evolutions',m.formId),stage=form?.stage??(/_0$/.test(base)?0:1);return stage===0&&m.uid!=null&&m.uid!==''?variantKey(base,m.uid):base;}
 function enemyName(m){if(m.human)return m.name;const name=m.displayName||by('evolutions',m.formId)?.name||by('monsters',m.speciesId).name;return R.isRareLook?.(m.speciesId,window.VTNArt?.lookOf?.(m)||m.look||'primary')?name+' · Biến thể hiếm':name;}
const imgCache={},loadImg=(src,tries)=>{const i=new Image();i.onerror=()=>{if(tries<3)setTimeout(()=>{imgCache[src]=loadImg(src,tries+1);},250*(tries+1));};i.src=tries?src+(src.includes('?')?'&':'?')+'retry='+tries:src;return i;},img=src=>{if(!imgCache[src])imgCache[src]=loadImg(src,0);return imgCache[src];},ok=i=>i&&i.complete&&i.naturalWidth;
function optionalBattleBackground(regionId,kind){const rid=String(regionId||'region_01').slice(-2),paths=[`assets/battle_bg/extra/r${rid}_${kind}.png`,`assets/battle_bg/extra/${regionId}_${kind}.png`,`assets/battle_bg/extra/r${rid}_${kind}_bg.png`,`assets/battle_bg/extra/${regionId}_${kind}_bg.png`];for(const path of paths){if(ok(img(path)))return path;}return null;}
const motion=matchMedia('(prefers-reduced-motion: reduce)');
let stage=null,raf=0,last=null,token=null,ending=null,fx=[],impacts=[],totalImpacts=0,totalFrames=0,lastBackground=null;
const hits=new Map(),fallbackCache={},surfaces=new Map();
  let lastEnemyFrame=null,lastEnemyFrames=[],lastEnemyPlate=null,lastEnemyPlates=[],lastHeroFrame=null,lastHeroPlates=[],lastPlates=[],lastAllyFrames=[],lastLayout=null;
const clock=()=>performance.now()/1000;
const opaqueAnchorCache=new Map();
function opaqueAnchor(source,w,h,frame=0,fallback=[w/2,h-1]){
  const key=`${source?.src||''}|${w}|${h}|${frame}`;if(opaqueAnchorCache.has(key))return opaqueAnchorCache.get(key);
  if(!source||!ok(source)||typeof document==='undefined')return fallback;
  try{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});g.clearRect(0,0,w,h);g.drawImage(source,frame*w,0,w,h,0,0,w,h);const p=g.getImageData(0,0,w,h).data;let minX=w,minY=h,maxX=-1,maxY=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(p[(y*w+x)*4+3]>8){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}const anchor=maxX<0?fallback:[(minX+maxX)/2,maxY];opaqueAnchorCache.set(key,anchor);return anchor;}catch{return fallback;}
}
function speciesId(m){return String(m?.speciesId||m?.formId||'').match(/^M-\d{3}/)?.[0]||String(m?.speciesId||'');}
function flipFor(m,side){if(m.human)return side==='enemy'?(window.VTN_FACING?.classes?.[m.classId]||'left')==='right':false;const key=spriteKey(m),native=manifest[key]?.sourceFacing||window.VTN_FACING?.forms?.[key]||(facingRight.has(speciesId(m))?'right':'left'),right=native==='right';return native==='front'?false:side==='enemy'?right:!right;}
 function fallback(speciesId,formId,variant,uid){const key=[speciesId,formId,variant,uid].join('|');if(fallbackCache[key])return fallbackCache[key];const c=document.createElement('canvas');c.width=96;c.height=64;const sp=by('monsters',speciesId),form=by('evolutions',formId),tmp=document.createElement('canvas');tmp.width=64;tmp.height=64;tmp.dataset.base=64;window.VTNArt.draw(tmp,{...sp,stage:form?.stage||0,branch:form?.branch,variant,uid});c.getContext('2d').drawImage(tmp,0,0,tmp.width,tmp.height,16,0,64,64);return fallbackCache[key]=c;}
  function drawMon(ctx,m,x,y,flip,t,scale=1,side='ally'){if(!m)return null;if(m.human)return drawOpponent(ctx,m,x,y,t,scale,side);const key=spriteKey(m),entry=manifest[key],source=entry&&ok(img(entry.file))?img(entry.file):null,w=source?entry.w:96,h=source?entry.h:64,baseAnchor=source?(entry.anchor||opaqueAnchor(img(entry.file),w,h,0,[w/2,h-1])):[48,62],large=h>96,heartless=m.heart==='heartless',age=t-(hits.get(m.uid)?.time??-99),strength=motion.matches?0:Math.max(0,1-age/.22)**2;
   const jitter=Math.sin(age*95)*3*strength,stageW=ctx.canvas.width,drawW=Math.max(1,Math.round(w*scale)),drawH=Math.max(1,Math.round(h*scale)),anchor=[baseAnchor[0]*scale,baseAnchor[1]*scale],drawY=Math.round(y);
   // The x anchor remains the sprite's centre/opaque anchor when mirrored;
   // only the visual side changes, so impact numbers stay on the same actor.
   const leftExtent=flip?drawW-anchor[0]:anchor[0],rightExtent=flip?anchor[0]:drawW-anchor[0],minX=leftExtent+2,maxX=stageW-rightExtent-2,desiredX=Math.round(x+jitter),drawX=minX<=maxX?Math.max(minX,Math.min(maxX,desiredX)):Math.round(stageW/2);
   const frameRect=flip?{left:drawX+anchor[0]-drawW,right:drawX+anchor[0]}:{left:drawX-anchor[0],right:drawX+drawW-anchor[0]};
   const frameInfo={uid:m.uid,spriteKey:key,w,h,drawW,drawH,scale,anchor:[baseAnchor[0],baseAnchor[1]],x:drawX,y:drawY,baseline:drawY,opaqueBottom:drawY,left:frameRect.left,right:frameRect.right,top:drawY-anchor[1],bottom:drawY,large,flip,side,stageW};
    if(side==='enemy'){lastEnemyFrame=frameInfo;lastEnemyFrames.push(frameInfo);}else lastAllyFrames.push(frameInfo);
   ctx.save();ctx.translate(drawX,drawY);if(flip)ctx.scale(-1,1);
   const platformW=large?Math.max(48,Math.min(92,drawW*.48)):29*scale;
   ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(0,2,platformW,large?6:4,0,0,Math.PI*2);ctx.fill();
   if(large){ctx.fillStyle='#343a37';ctx.beginPath();ctx.ellipse(0,1,platformW,6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4e5346';ctx.beginPath();ctx.ellipse(0,-1,platformW-6,3,0,0,Math.PI*2);ctx.fill();}
  let surface=surfaces.get(m.uid);if(!surface){surface=document.createElement('canvas');surfaces.set(m.uid,surface);}if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;}const sc=surface.getContext('2d');sc.clearRect(0,0,w,h);sc.globalCompositeOperation='source-over';sc.imageSmoothingEnabled=false;
   sc.filter=heartless?'saturate(.82) brightness(.97) contrast(1.04)':'none';if(source){const f=Math.floor(t*(entry.fps||5))%(entry.frames||1);sc.drawImage(source,f*w,0,w,h,0,0,w,h);}else sc.drawImage(fallback(m.speciesId,m.formId,m.variant,m.uid),0,0);sc.filter='none';
  // Mask on a transparent surface, never on the already-painted background.
  if(age>=0&&age<.11&&!motion.matches){sc.globalCompositeOperation='source-atop';sc.fillStyle=`rgba(255,245,235,${.85*(1-age/.11)})`;sc.fillRect(0,0,w,h);sc.globalCompositeOperation='source-over';}
   if(m.variant&&source)ctx.filter='hue-rotate(150deg) saturate(1.35)';ctx.drawImage(surface,-anchor[0],-anchor[1],drawW,drawH);ctx.filter='none';if(heartless){ctx.save();ctx.globalAlpha=.18;ctx.fillStyle='#171526';ctx.shadowColor='#0f0d1b';ctx.shadowBlur=12;ctx.beginPath();ctx.ellipse(0,-Math.round(anchor[1]*.45),Math.max(18,drawW*.38),Math.max(14,drawH*.32),0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=.58;ctx.fillStyle='#e6dfc2';const eyeY=-anchor[1]+Math.round(drawH*.32),eyeGap=Math.max(4,Math.round(drawW*.08));ctx.fillRect(-eyeGap-2,eyeY,3,2);ctx.fillRect(eyeGap-1,eyeY,3,2);ctx.restore();}ctx.restore();
   return frameInfo;
 }
 function heroLook(state){const list=racePeople?.races?.[state?.hero?.raceId]||[];return list.find(v=>v.key===state?.hero?.storyLook)?.key||list[0]?.key||null;}
  function drawHero(ctx,x,y,t,state){
   const id=state?.hero?.classId,spec=classSprites?.classes?.[id],sheet=classSprites?.battle,source=spec?.battle?img(spec.battle):null;
   const age=t-(hits.get('hero')?.time??-99),offset=motion.matches?0:Math.round(Math.sin(age*95)*2*Math.max(0,1-age/.22)**2),drawX=Math.round(x+offset),drawY=Math.round(y);
   if(source&&ok(source)&&sheet?.w&&sheet?.h&&sheet?.frames){
    const w=sheet.w,h=sheet.h,frame=Math.floor(t*5)%sheet.frames,baseAnchor=opaqueAnchor(source,w,h,frame,[w/2,h-1]),drawW=w,drawH=h;
    ctx.save();ctx.translate(drawX,drawY);if((window.VTN_FACING?.classes?.[id]||'left')==='left')ctx.scale(-1,1);ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(0,2,9,2.5,0,0,Math.PI*2);ctx.fill();ctx.drawImage(source,frame*w,0,w,h,-baseAnchor[0],-baseAnchor[1],drawW,drawH);if(age>=0&&age<.11&&!motion.matches){ctx.globalAlpha=.5*(1-age/.11);ctx.fillStyle='#fff0df';ctx.fillRect(-6,-25,12,17);}ctx.restore();
    lastHeroFrame={kind:'class-battle',flip:(window.VTN_FACING?.classes?.[id]||'left')==='left',classId:id,path:spec.battle,source:source.src,w,h,drawW,drawH,scale:1,anchor:baseAnchor,frame,x:drawX,y:drawY,baseline:drawY,opaqueBottom:drawY,left:drawX-baseAnchor[0],right:drawX+drawW-baseAnchor[0],top:drawY-baseAnchor[1],bottom:drawY,stageW:ctx.canvas.width,stageH:ctx.canvas.height};
    return;
   }
   const fallbackLook=heroLook(state),raceId=state?.hero?.raceId,list=racePeople?.races?.[raceId]||[],look=list.find(v=>v.key===fallbackLook)||list[0],fallbackSource=look?.front&&img(look.front);if(!ok(fallbackSource))return;const drawW=racePeople?.front?.w||80,drawH=racePeople?.front?.h||92,baseAnchor=opaqueAnchor(fallbackSource,fallbackSource.naturalWidth||drawW,fallbackSource.naturalHeight||drawH,0,[drawW/2,drawH-1]);ctx.save();ctx.translate(drawX,drawY);if((window.VTN_FACING?.classes?.[id]||'left')==='left')ctx.scale(-1,1);ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(0,2,9,2.5,0,0,Math.PI*2);ctx.fill();ctx.drawImage(fallbackSource,0,0,fallbackSource.naturalWidth||drawW,fallbackSource.naturalHeight||drawH,-baseAnchor[0],-baseAnchor[1],drawW,drawH);if(age>=0&&age<.11&&!motion.matches){ctx.globalAlpha=.5*(1-age/.11);ctx.fillStyle='#fff0df';ctx.fillRect(-6,-25,12,17);}ctx.restore();lastHeroFrame={kind:'race-people-front-fallback',raceId,look:fallbackLook,path:look?.front||null,source:fallbackSource.src,w:drawW,h:drawH,drawW,drawH,scale:1,anchor:baseAnchor,frame:0,x:drawX,y:drawY,baseline:drawY,opaqueBottom:drawY,left:drawX-baseAnchor[0],right:drawX+drawW-baseAnchor[0],top:drawY-baseAnchor[1],bottom:drawY,stageW:ctx.canvas.width,stageH:ctx.canvas.height};
    return;
  }
 function bar(ctx,x,y,w,frac,color,label,heart=null){ctx.font="600 12px 'VTN UI',system-ui,sans-serif";ctx.textAlign='left';const iconKey=heart==='heartless'?'none':heart==='restored'?'restored':heart==='with'?'with':null,iconSrc=iconKey&&window.VTN_EMBLEMS?.heart?.[iconKey]?img(window.VTN_EMBLEMS.heart[iconKey]):null;const textX=x+(iconSrc?18:0);let displayLabel=label;while(ctx.measureText(displayLabel).width>w-(iconSrc?18:0)&&displayLabel.length>2)displayLabel=displayLabel.slice(0,-2)+'…';const pw=Math.max(Math.round(w+6),Math.ceil(ctx.measureText(displayLabel).width)+(iconSrc?24:6)),ph=22,rect={x:Math.round(x-3),y:Math.round(y-16),w:pw,h:ph};ctx.fillStyle='rgba(10,9,13,.72)';ctx.fillRect(rect.x,rect.y,rect.w,rect.h);ctx.strokeStyle='#8c6d3f';ctx.lineWidth=1;ctx.strokeRect(rect.x+.5,rect.y+.5,rect.w-1,rect.h-1);ctx.fillStyle='#0d0b12';ctx.fillRect(x-1,y-1,w+2,5);ctx.fillStyle='#2a2438';ctx.fillRect(x,y,w,3);ctx.fillStyle=color;ctx.fillRect(x,y,Math.round(w*Math.max(0,Math.min(1,frac))),3);if(iconSrc&&ok(iconSrc))ctx.drawImage(iconSrc,x,y-16,14,14);ctx.fillStyle='#efe6cf';ctx.fillText(displayLabel,textX,y-4);return rect;}
// ---------------------------------------------------------- backgrounds
function isBossBattle(b){return b?.mode==='boss'||b?.boss===true||b?.isBoss===true||b?.flags?.boss===true;}
function backgroundVeil(ctx,W,H){
  // Keep the readability treatment behind the actors and their HP plates.
  ctx.fillStyle='rgba(7,8,12,.20)';ctx.fillRect(0,0,W,H);
  const v=ctx.createRadialGradient(W/2,H*.48,H*.25,W/2,H*.52,W*.78);
  v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(.72,'rgba(0,0,0,.10)');v.addColorStop(1,'rgba(0,0,0,.38)');
  ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
}
 function drawRegionBackground(ctx,W,H,regionId,t,battle){
   const boss=isBossBattle(battle),mapId=window.VTNGame?.state?.()?.mapId,custom=window.VTN_DATA?.maps_abyss?.backgrounds?.[mapId],set=custom?{normal:custom,boss:custom}:battleBackgrounds[regionId],kind=boss?'boss':'normal',path=optionalBattleBackground(regionId,kind)||set?.[kind],source=path&&img(path);
  if(source&&ok(source)){
    const sw=source.naturalWidth,sh=source.naturalHeight,scale=Math.max(W/sw,H/sh),dw=sw*scale,dh=sh*scale;
    // The source art's floor band is near its lower edge.  Keep it on the
    // existing actor ground line while preserving cover and a centred crop.
    const sourceFloorY=sh*.86,targetFloorY=H*.86;
    let dx=(W-dw)/2,dy=targetFloorY-sourceFloorY*scale;
    dy=Math.max(H-dh,Math.min(0,dy));
    dx=Math.round(dx);dy=Math.round(dy);
    const drawW=Math.round(dw),drawH=Math.round(dh);
    ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0,sw,sh,dx,dy,drawW,drawH);
    lastBackground={kind:'image',regionId,variant:kind,boss,path,src:source.src,naturalWidth:sw,naturalHeight:sh,floorY:Math.round(dy+sourceFloorY*scale),draw:{x:dx,y:dy,w:drawW,h:drawH}};
    return true;
  }
  lastBackground={kind:'procedural',regionId,variant:kind,boss,path:path||null,reason:set?'not-loaded':'missing'};
  return false;
}
function background(ctx, W, H, regionId, t, battle){
  ctx.imageSmoothingEnabled=false;
  if(drawRegionBackground(ctx,W,H,regionId,t,battle)){backgroundVeil(ctx,W,H);return;}
  const set = (window.VTN_TILESETS || {})[regionId];
  const reg = by('regions', regionId) || {};
  const pal = reg.palette || ['#2b312c', '#365136', '#73905a'];
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#07080c'); g.addColorStop(0.55, pal[0] || '#1a1d1a'); g.addColorStop(1, '#0b0c0e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // broken moon
  ctx.fillStyle = 'rgba(220,226,214,.85)'; ctx.beginPath(); ctx.arc(W * 0.5, 34, 9, 0.5, Math.PI * 1.75); ctx.fill();
  ctx.fillStyle = 'rgba(220,226,214,.6)'; ctx.fillRect(W * 0.5 + 9, 30, 3, 2); ctx.fillRect(W * 0.5 + 13, 35, 2, 2);
  const groundY = Math.round(H * 0.58);
  if (set) {
    const gi = img(set.base + 'ground.png'), ti = img(set.base + 'trees.png');
    if (ok(ti)) for (let i = 0, x = -20; x < W + 40; i++, x += 26) {
      const tr = set.trees[i % set.trees.length];
      ctx.globalAlpha = 0.55;
      ctx.drawImage(ti, tr[0], tr[1], tr[2], tr[3], x, groundY - tr[3] + 10 + (i % 3) * 3, tr[2], tr[3]);
    }
    ctx.globalAlpha = 1;
    if (ok(gi)) for (let y = groundY; y < H; y += 32) for (let x = 0; x < W; x += 32) ctx.drawImage(gi, x % 256, (y * 3) % 256, 32, 32, x, y, 32, 32);
  } else {
    ctx.fillStyle = pal[1] || '#24291f'; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 0; i < 9; i++) { const x = (i * 53) % W; ctx.fillRect(x, groundY - 18 - (i % 3) * 8, 10 + (i % 4) * 4, 20 + (i % 3) * 8); }
  }
  // horizon fog and depth darkening
  const f = ctx.createLinearGradient(0, groundY - 20, 0, groundY + 24);
  f.addColorStop(0, 'rgba(170,182,168,0)'); f.addColorStop(0.5, 'rgba(170,182,168,.18)'); f.addColorStop(1, 'rgba(170,182,168,0)');
  ctx.fillStyle = f; ctx.fillRect(0, groundY - 20, W, 44);
  // stone platforms
  for (const [px, py, rw] of [[W * 0.26, H * 0.84, 54], [W * 0.73, H * 0.66, 44]]) {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(px, py + 3, rw, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a4037'; ctx.beginPath(); ctx.ellipse(px, py, rw, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4e5346'; ctx.beginPath(); ctx.ellipse(px, py - 1, rw - 4, 5, 0, 0, Math.PI * 2); ctx.fill();
  }
  // falling ash
  for (let i = 0; i < 28; i++) {
    const x = ((i * 47 + t * (6 + i % 5)) % W), y = ((i * 31 + t * (9 + i % 7)) % H);
    ctx.fillStyle = i % 9 === 0 ? 'rgba(240,150,70,.8)' : 'rgba(205,208,196,.45)'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  backgroundVeil(ctx,W,H);
}


function sample(b,s){const enemy=b.enemies[b.index],members=[['hero',s.hero.hp],...s.party.slice(0,2).map(m=>[m.uid,m.hp]),[enemy.uid,enemy.hp]];return new Map(members);}
function drawOpponent(ctx,m,x,y,t,scale=1,side='enemy'){
 const spec=classSprites?.classes?.[m.classId],sheet=classSprites?.battle,source=spec?.battle&&img(spec.battle),castSrc=m.castKey&&window.VTN_CAST?.[m.castKey]?.front,castImage=castSrc&&img(castSrc),useCast=ok(castImage),w=useCast?castImage.naturalWidth:sheet?.w||80,h=useCast?castImage.naturalHeight:sheet?.h||92,src=useCast?castImage:source,frame=useCast?0:Math.floor(t*5)%(sheet?.frames||4),dw=Math.round(w*scale),dh=Math.round(h*scale),flip=!useCast&&(window.VTN_FACING?.classes?.[m.classId]||'left')==='right';
 if(ok(src)){ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);ctx.drawImage(src,frame*w,0,w,h,-dw/2,-dh,dw,dh);ctx.restore();}
 const f={uid:m.uid,human:true,side,classId:m.classId,w,h,drawW:dw,drawH:dh,scale,flip,x,y,left:x-dw/2,right:x+dw/2,top:y-dh,bottom:y,baseline:y};lastEnemyFrames.push(f);lastEnemyFrame=f;return f;
}
function spriteMetrics(m){if(m.human)return {w:80,h:92,anchorY:90};const entry=manifest[spriteKey(m)],source=entry&&ok(img(entry.file));return {w:source?entry.w:96,h:source?entry.h:64,anchorY:source?(entry.anchor?.[1]??entry.h-1):63};}
function effect(hit,t){if(!(hit.amount>0))return;const active=fx.filter(f=>f.uid===hit.uid&&t-f.start<.95);if(active.length>=3){const oldest=active.shift();fx=fx.filter(f=>f!==oldest);}const lane=[0,1,2].find(n=>!active.some(f=>f.lane===n))??0;fx.push({...hit,start:t,lane});if(hit.kind==='damage')hits.set(hit.uid,{time:t});totalImpacts++;}
function frame(now){raf=0;const live=window.VTNGame?.battle(),sLive=window.VTNGame?.state(),t=now/1000;
 if(!stage||!stage.isConnected){stage=null;return;}const useEnding=!live&&ending&&t<ending.until,b=live||(useEnding?ending.battle:null),s=live?sLive:useEnding?ending.state:null;
  if(!b||!s){if(stage.classList.contains('battle-finish'))stage.remove();stage=null;ending=null;last=null;fx=[];hits.clear();lastLayout=null;return;}
  const currentToken=b.index+':'+b.enemies.map(m=>m.uid).join('|');if(token!==currentToken){token=currentToken;last=null;fx=[];hits.clear();surfaces.clear();lastEnemyFrame=null;lastEnemyPlate=null;lastHeroFrame=null;lastHeroPlates=[];lastPlates=[];lastAllyFrames=[];lastLayout=null;size();}
 const current=sample(b,s),explicit=new Set(impacts.map(h=>h.uid));for(const impact of impacts)effect(impact,t);impacts=[];
 if(last)for(const [uid,hp] of current)if(last.has(uid)&&!explicit.has(uid)&&hp!==last.get(uid))effect({uid,amount:Math.abs(last.get(uid)-hp),kind:hp<last.get(uid)?'damage':'heal'},t);last=current;
  const ctx=stage.getContext('2d'),W=stage.width,H=stage.height,baseline=Math.round(H*.86),enemy=b.enemies[b.index],lead=s.party.slice(0,2),enemySize=spriteMetrics(enemy),enemyHeight=enemySize.h,enemyAnchor=enemySize.anchorY,largeEnemy=enemyHeight>96,enemyScale=largeEnemy?Math.min(1,Math.max(W<300?.42:.5,(baseline-28)/Math.max(1,enemyAnchor))):1,enemyHalf=enemySize.w*enemyScale/2,enemyX=Math.max(enemyHalf+2,Math.min(Math.round(W*.84),W-enemyHalf-2)),enemyTop=baseline-enemyAnchor*enemyScale,enemyBarY=Math.max(8,Math.min(24,Math.floor(enemyTop-15))),heroSheet=classSprites?.battle,heroW=heroSheet?.w??racePeople?.front?.w??24,heroX=Math.max(Math.ceil(heroW/2)+2,Math.round(W*.12)),enemyLeft=enemyX-enemyHalf,baseAllyWidth=lead.reduce((sum,m)=>sum+spriteMetrics(m).w,0),available=Math.max(44,enemyLeft-(heroX+heroW/2)-28),allyScale=Math.min(.72,available/Math.max(1,baseAllyWidth+6)),pos={hero:[heroX,baseline],[enemy.uid]:[enemyX,baseline]};
  let previousX=heroX,previousW=heroW;lead.forEach((m,i)=>{const w=spriteMetrics(m).w*allyScale,preferred=Math.round(W*(i?.39:.25)),minX=Math.round(previousX+previousW/2+w/2+6),maxX=Math.max(minX,enemyLeft-10-w/2),x=Math.min(Math.max(preferred,minX),maxX);pos[m.uid]=[x,baseline];previousX=x;previousW=w;});ctx.imageSmoothingEnabled=false;
  background(ctx,W,H,by('maps',s.mapId)?.regionId,motion.matches?0:t,b);
  lastAllyFrames=[];lastHeroFrame=null;lastHeroPlates=[];lastPlates=[];drawMon(ctx,enemy,...pos[enemy.uid],flipFor(enemy,'enemy'),t,enemyScale,'enemy');if(lead[1])drawMon(ctx,lead[1],...pos[lead[1].uid],flipFor(lead[1],'ally'),t,allyScale,'ally');if(lead[0])drawMon(ctx,lead[0],...pos[lead[0].uid],flipFor(lead[0],'ally'),t,allyScale,'ally');drawHero(ctx,...pos.hero,t,s);
    const ew=Math.min(175,Math.floor(W*.44)),lw=Math.min(125,Math.floor(W*.42));lastEnemyPlate=bar(ctx,W-ew-8,enemyBarY,ew,enemy.hp/R.monsterStats(enemy).hp,'#d43540',`${enemyName(enemy)} · ${enemy.level}`,enemy.heart);lastHeroPlates=[];lastPlates=[lastEnemyPlate];
    lastLayout={baseline,stage:{width:W,height:H},actors:{hero:{uid:'hero',baseline,flip:lastHeroFrame?.flip??true,frame:lastHeroFrame},enemy:{uid:enemy.uid,baseline,flip:flipFor(enemy,'enemy'),scale:enemyScale,frame:lastEnemyFrame},allies:lastAllyFrames.map(frame=>({uid:frame.uid,baseline,flip:frame.flip,scale:frame.scale,frame}))},feet:[lastHeroFrame?.bottom,lastEnemyFrame?.bottom,...lastAllyFrames.map(frame=>frame.bottom)].filter(value=>value!==undefined)};stage.lastLayout=lastLayout;
  fx=fx.filter(f=>t-f.start<.95);ctx.textAlign='center';for(const f of fx){const p=pos[f.uid],actor=f.uid==='hero'?lastHeroFrame:f.uid===enemy.uid?lastEnemyFrame:lastAllyFrames.find(frame=>frame.uid===f.uid),age=t-f.start;if(!p||age<0)continue;const x=Math.round(p[0]+f.lane*30*(p[0]<W/2?1:-1)),y=Math.round((actor?.top??p[1]-49)-8-age*20-f.lane*2),label=f.kind==='miss'?'TRƯỢT':(f.kind==='heal'?'+':'−')+Math.round(f.amount);ctx.globalAlpha=Math.min(1,(.95-age)*2.8);ctx.font=`${f.critical?18:16}px 'VTN Pixel','VTN UI',monospace`;ctx.fillStyle='#07080c';ctx.fillText(label,x+1,y+1);ctx.fillStyle=f.kind==='miss'?'#c9b9dd':f.kind==='heal'?'#87e4a6':f.uid===enemy.uid?'#ffe08a':'#ff9999';ctx.fillText(label,x,y);ctx.globalAlpha=1;
  if(f.kind==='damage'&&age<.28&&!motion.matches){ctx.fillStyle=f.critical?'#ffe8ac':'#e1bba4';for(let i=0;i<5;i++){const angle=i*1.7,dist=age*45;ctx.fillRect(Math.round(x+Math.cos(angle)*dist),Math.round(p[1]-28+Math.sin(angle)*dist),2,2);}}
 }
 totalFrames++;raf=requestAnimationFrame(frame);
}
 function size(){
  if(!stage||stage.classList.contains('battle-finish'))return;
  const host=document.querySelector('#content .battle-stage-wrap')||stage.parentElement,availW=Math.max(200,(host?.clientWidth||stage.parentElement.clientWidth)-2),availH=Math.max(110,(host?.clientHeight||0)-2),zoom=availW>=620&&availH>=300?2:1,w=Math.floor(availW/zoom),h=Math.floor(availH/zoom);
  if(stage.width!==w||stage.height!==h){stage.width=w;stage.height=h;}
  stage.style.width=w*zoom+'px';stage.style.height=h*zoom+'px';
 }
const resize=new ResizeObserver(()=>size());
 function mount(){const battle=window.VTNGame?.battle(),host=document.querySelector('#content .battle-stage-wrap')||document.querySelector('#content .battle-grid');if(!battle||!host)return;if(stage?.isConnected&&!stage.classList.contains('battle-finish'))return;if(stage?.classList.contains('battle-finish'))stage.remove();ending=null;stage=document.createElement('canvas');stage.className='battle-stage';stage.setAttribute('aria-label','Sân đấu: nhân vật cùng quái vật đồng hành đối mặt kẻ địch');host.appendChild(stage);resize.disconnect();resize.observe(host);size();if(!raf)raf=requestAnimationFrame(frame);}
document.addEventListener('vtn:battle-start',()=>{impacts=[];fx=[];hits.clear();surfaces.clear();last=null;token=null;if(stage?.classList.contains('battle-finish')){stage.remove();stage=null;}ending=null;});
document.addEventListener('vtn:impact',e=>{if(e.detail?.amount>0)impacts.push({...e.detail});});
document.addEventListener('vtn:battle-finish',e=>{if(!stage?.isConnected)return;const rect=stage.getBoundingClientRect(),ghost=document.createElement('canvas');ghost.width=stage.width;ghost.height=stage.height;ghost.className='battle-stage battle-finish';Object.assign(ghost.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',zIndex:60,pointerEvents:'none'});ghost.getContext('2d').drawImage(stage,0,0);document.body.appendChild(ghost);stage=ghost;ending={...e.detail,until:clock()+.6};if(!raf)raf=requestAnimationFrame(frame);});
new MutationObserver(mount).observe(document.getElementById('content'),{childList:true});window.addEventListener('resize',size);
  window.VTNBattleStage={inspect:()=>{const live=window.VTNGame?.battle(),current=live?.enemies?.[live.index];return {mounted:!!stage?.isConnected,ending:!!ending,totalImpacts,totalFrames,effects:fx.map(f=>({uid:f.uid,amount:f.amount,kind:f.kind,age:clock()-f.start})),reducedMotion:motion.matches,size:stage?{width:stage.width,height:stage.height}:null,lastBackground,backgroundDrawn:lastBackground?.kind==='image',heartlessVisual:current?.heart==='heartless',enemyHeart:current?.heart||'with',heroFrame:lastHeroFrame,heroPlates:lastHeroPlates,hpPlates:lastPlates,allyFrames:lastAllyFrames,enemyFrame:lastEnemyFrame,enemyFrames:lastEnemyFrames,enemyPlate:lastEnemyPlate,enemyPlates:lastEnemyPlates,lastLayout,flipFor:(actor,side)=>flipFor(actor,side)};}};
  function sampleStage(b,s){const members=[['hero',s.hero.hp],...s.party.slice(0,b.fieldCount??2).map(m=>[m.uid,m.hp]),...(b.enemies||[]).map(m=>[m.uid,m.hp])];return new Map(members);}
  function drawHero(ctx,x,y,t,state,side='ally'){
    const id=state?.hero?.classId,spec=classSprites?.classes?.[id],sheet=classSprites?.battle,source=spec?.battle?img(spec.battle):null;
    const age=t-(hits.get('hero')?.time??-99),offset=motion.matches?0:Math.round(Math.sin(age*95)*2*Math.max(0,1-age/.22)**2),drawX=Math.round(x+offset),drawY=Math.round(y),nativeFacing=window.VTN_FACING?.classes?.[id]||'left',flip=side==='enemy'?nativeFacing==='right':nativeFacing==='left';
    if(source&&ok(source)&&sheet?.w&&sheet?.h&&sheet?.frames){
      const w=sheet.w,h=sheet.h,frame=Math.floor(t*5)%sheet.frames,baseAnchor=opaqueAnchor(source,w,h,frame,[w/2,h-1]);
      ctx.save();ctx.translate(drawX,drawY);if(flip)ctx.scale(-1,1);ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(0,2,9,2.5,0,0,Math.PI*2);ctx.fill();ctx.drawImage(source,frame*w,0,w,h,-baseAnchor[0],-baseAnchor[1],w,h);if(age>=0&&age<.11&&!motion.matches){ctx.globalAlpha=.5*(1-age/.11);ctx.fillStyle='#fff0df';ctx.fillRect(-6,-25,12,17);}ctx.restore();
      const left=flip?drawX+baseAnchor[0]-w:drawX-baseAnchor[0],right=flip?drawX+baseAnchor[0]:drawX+w-baseAnchor[0];lastHeroFrame={kind:'class-battle',flip,side,classId:id,path:spec.battle,source:source.src,w,h,drawW:w,drawH:h,scale:1,anchor:baseAnchor,frame,x:drawX,y:drawY,baseline:drawY,opaqueBottom:drawY,left,right,top:drawY-baseAnchor[1],bottom:drawY,stageW:ctx.canvas.width,stageH:ctx.canvas.height};return;
    }
    const fallbackLook=heroLook(state),raceId=state?.hero?.raceId,list=racePeople?.races?.[raceId]||[],look=list.find(v=>v.key===fallbackLook)||list[0],fallbackSource=look?.front&&img(look.front);if(!ok(fallbackSource))return;
    const w=racePeople?.front?.w||80,h=racePeople?.front?.h||92,baseAnchor=opaqueAnchor(fallbackSource,fallbackSource.naturalWidth||w,fallbackSource.naturalHeight||h,0,[w/2,h-1]);ctx.save();ctx.translate(drawX,drawY);if(flip)ctx.scale(-1,1);ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(0,2,9,2.5,0,0,Math.PI*2);ctx.fill();ctx.drawImage(fallbackSource,0,0,fallbackSource.naturalWidth||w,fallbackSource.naturalHeight||h,-baseAnchor[0],-baseAnchor[1],w,h);ctx.restore();const left=flip?drawX+baseAnchor[0]-w:drawX-baseAnchor[0],right=flip?drawX+baseAnchor[0]:drawX+w-baseAnchor[0];lastHeroFrame={kind:'race-people-front-fallback',flip,side,raceId,look:fallbackLook,path:look?.front||null,source:fallbackSource.src,w,h,drawW:w,drawH:h,scale:1,anchor:baseAnchor,frame:0,x:drawX,y:drawY,baseline:drawY,opaqueBottom:drawY,left,right,top:drawY-baseAnchor[1],bottom:drawY,stageW:ctx.canvas.width,stageH:ctx.canvas.height};
  }
  function drawActing(ctx,b,t){
    const id=b.actingId;if(!id)return;let f=null;
    if(id==='hero')f=lastHeroFrame;else f=[...lastAllyFrames,...lastEnemyFrames].find(v=>String(v.uid)===String(id));
    if(!f)return;const cx=Math.round(f.x??((f.left+f.right)/2)),top=Math.max(6,Math.round((f.top??f.y-50)-12+(motion.matches?0:Math.sin(t*8)*2))),enemySide=(b.enemies||[]).some(m=>String(m.uid)===String(id));
    ctx.save();ctx.fillStyle=enemySide?'#ff8a7a':'#ffd978';ctx.strokeStyle='#07080c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,top+9);ctx.lineTo(cx-8,top-1);ctx.lineTo(cx+8,top-1);ctx.closePath();ctx.stroke();ctx.fill();
    ctx.globalAlpha=.35;ctx.fillStyle=enemySide?'#ff8a7a':'#ffd978';ctx.beginPath();ctx.ellipse(cx,Math.round((f.bottom??f.y)+2),Math.max(14,Math.round(((f.right??cx+16)-(f.left??cx-16))/2)),5,0,0,7);ctx.fill();ctx.restore();
  }
  /* Death: the unit flushes red, then shrinks into its own centre and vanishes (0.9 s). Skipped under reduced motion. */
  const deaths=new Map();
  function dyingDraw(ctx,m,p,t,draw){const key=String(m.uid);if(m.hp>0){deaths.delete(key);return draw();}let d=deaths.get(key);if(!d){d={start:t};deaths.set(key,d);}const k=motion.matches?1:(t-d.start)/.9;if(k>=1){ctx.save();ctx.globalAlpha=0;const r=draw();ctx.restore();return r;}
   const red=Math.min(1,k/.35),shrink=k<.35?1:1-Math.pow((k-.35)/.65,1.6),cx=p[0],cy=p[1]-34;ctx.save();ctx.translate(cx,cy);ctx.scale(Math.max(.02,shrink),Math.max(.02,shrink));ctx.translate(-cx,-cy);ctx.globalAlpha=k<.35?1:Math.max(0,1-(k-.35)/.65*.85);
   if('filter' in ctx&&red>0)ctx.filter=`sepia(1) saturate(${1+red*9}) hue-rotate(-${Math.round(red*40)}deg) brightness(${1+red*.25})`;const r=draw();ctx.restore();
   if(!motion.matches){ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(255,${Math.round(90-red*60)},70,${(1-k)*.35})`;ctx.beginPath();ctx.ellipse(cx,cy,26*(1-k*.6),30*(1-k*.6),0,0,7);ctx.fill();ctx.restore();}return r;}
  function drawEnemyPlate(ctx,m,x,y,w,selected){
    const max=R.monsterStats(m).hp,frac=Math.max(0,m.hp)/Math.max(1,max),rect=bar(ctx,x-w/2,y,w,frac,'#d64f58',`${enemyName(m)} · Lv. ${m.level} · ${Math.round(frac*100)}%`,m.heart),badges=[];let bx=rect.x+4,badgeY=rect.y+rect.h+3;
    const heart=m.human?'Lữ khách':heartText(m.heart),items=[...(m.status?[`Trạng thái: ${m.status.name}`]:[]),heart,...(by('monsters',m.speciesId)?.types||[])];ctx.font="9px 'VTN UI',sans-serif";for(const label of items.slice(0,4)){const width=Math.max(22,Math.ceil(ctx.measureText(label).width)+8);ctx.fillStyle=label===heart?'#382a48':label===m.status?.name?'#5a3137':'#243745';ctx.fillRect(bx,badgeY,width,13);ctx.strokeStyle='#80694b';ctx.strokeRect(bx+.5,badgeY+.5,width-1,12);ctx.fillStyle='#e9dfcb';ctx.fillText(label,bx+4,badgeY+9);badges.push({label,x:bx,y:badgeY,w:width,h:13});bx+=width+3;if(bx>ctx.canvas.width-w-4)break;}
    if(selected){const ay=Math.max(4,rect.y-9);ctx.fillStyle='#e6c36b';ctx.beginPath();ctx.moveTo(Math.round(x),ay+8);ctx.lineTo(Math.round(x-6),ay);ctx.lineTo(Math.round(x+6),ay);ctx.closePath();ctx.fill();}
    return {...rect,uid:m.uid,selected,badges,heart:m.heart,types:by('monsters',m.speciesId)?.types||[]};
  }
  function frame(now){raf=0;const live=window.VTNGame?.battle(),sLive=window.VTNGame?.state(),t=now/1000;if(!stage||!stage.isConnected){stage=null;return;}const useEnding=!live&&ending&&t<ending.until,b=live||(useEnding?ending.battle:null),s=live?sLive:useEnding?ending.state:null;if(!b||!s){if(stage.classList.contains('battle-finish'))stage.remove();stage=null;ending=null;last=null;fx=[];hits.clear();lastLayout=null;return;}const currentToken=b.index+':'+b.enemies.map(m=>m.uid).join('|');if(token!==currentToken){token=currentToken;last=null;fx=[];hits.clear();surfaces.clear();lastEnemyFrame=null;lastEnemyFrames=[];lastEnemyPlate=null;lastEnemyPlates=[];lastHeroFrame=null;lastHeroPlates=[];lastPlates=[];lastAllyFrames=[];lastLayout=null;size();}const current=sampleStage(b,s),explicit=new Set(impacts.map(h=>h.uid));for(const impact of impacts)effect(impact,t);impacts=[];if(last)for(const [uid,hp] of current)if(last.has(uid)&&!explicit.has(uid)&&hp!==last.get(uid))effect({uid,amount:Math.abs(last.get(uid)-hp),kind:hp<last.get(uid)?'damage':'heal'},t);last=current;
    const ctx=stage.getContext('2d'),W=stage.width,H=stage.height,baseline=Math.round(H*.86),enemies=(b.enemies||[]).filter(Boolean),enemy=b.enemies[b.index],lead=s.party.slice(0,b.fieldCount??2),metrics=enemies.map(m=>spriteMetrics(m)),enemyHeight=Math.max(64,...metrics.map(v=>v.h)),largeEnemy=enemyHeight>96,enemyScale=largeEnemy?Math.min(1,Math.max(W<300?.42:.5,(baseline-28)/Math.max(1,enemyHeight))):1,heroSheet=classSprites?.battle,heroW=heroSheet?.w??racePeople?.front?.w??24,heroX=Math.max(Math.ceil(heroW/2)+2,Math.round(W*.12));
    const enemyXs=enemies.map((m,i)=>{const spread=enemies.length>1?.22:0,ratio=enemies.length>1?i/(enemies.length-1):.5;return Math.max(52,Math.min(Math.round(W*.9),Math.round(W*(.78-spread/2+ratio*spread))));});
    const enemyLeft=Math.min(...enemyXs.map((x,i)=>x-metrics[i].w*enemyScale/2),W*.88),baseAllyWidth=lead.reduce((sum,m)=>sum+spriteMetrics(m).w,0),available=Math.max(44,enemyLeft-(heroX+heroW/2)-28),allyScale=Math.min(.72,available/Math.max(1,baseAllyWidth+6)),pos={hero:[heroX,baseline]};enemies.forEach((m,i)=>{pos[m.uid]=[enemyXs[i],baseline];});let previousX=heroX,previousW=heroW;lead.forEach((m,i)=>{const w=spriteMetrics(m).w*allyScale,preferred=Math.round(W*(i?.39:.25)),minX=Math.round(previousX+previousW/2+w/2+6),maxX=Math.max(minX,enemyLeft-10-w/2),x=Math.min(Math.max(preferred,minX),maxX);pos[m.uid]=[x,baseline];previousX=x;previousW=w;});ctx.imageSmoothingEnabled=false;background(ctx,W,H,by('maps',s.mapId)?.regionId,motion.matches?0:t,b);lastAllyFrames=[];lastEnemyFrames=[];lastHeroFrame=null;lastEnemyFrame=null;lastEnemyPlates=[];lastPlates=[];for(const m of enemies){const drawn=dyingDraw(ctx,m,pos[m.uid],t,()=>drawMon(ctx,m,...pos[m.uid],flipFor(m,'enemy'),t,enemyScale,'enemy'));if(m.uid===enemy.uid)lastEnemyFrame=drawn;}for(const m of lead)dyingDraw(ctx,m,pos[m.uid],t,()=>drawMon(ctx,m,...pos[m.uid],flipFor(m,'ally'),t,allyScale,'ally'));drawHero(ctx,...pos.hero,t,s,'ally');
    const enemyTop=baseline-enemyHeight*enemyScale,ew=Math.min(190,Math.floor(W*.3)),plateY=Math.max(18,Math.min(34,Math.floor(enemyTop-15)));lastEnemyPlates=enemies.map((m,i)=>drawEnemyPlate(ctx,m,Math.max(ew/2+6,Math.min(W-ew/2-6,enemyXs[i])),plateY+(i%2)*36,ew,m.uid===enemy.uid));lastEnemyPlate=lastEnemyPlates.find(plate=>plate.uid===enemy.uid)||lastEnemyPlates[0]||null;lastPlates=lastEnemyPlates;
    lastLayout={baseline,stage:{width:W,height:H},actors:{hero:{uid:'hero',baseline,flip:lastHeroFrame?.flip??true,frame:lastHeroFrame},enemy:{uid:enemy.uid,baseline,flip:flipFor(enemy,'enemy'),scale:enemyScale,frame:lastEnemyFrame},enemies:enemies.map((m,i)=>({uid:m.uid,baseline,flip:flipFor(m,'enemy'),scale:enemyScale,frame:lastEnemyFrames.find(v=>v.uid===m.uid),plate:lastEnemyPlates[i]})),allies:lastAllyFrames.map(frame=>({uid:frame.uid,baseline,flip:frame.flip,scale:frame.scale,frame}))},feet:[lastHeroFrame?.bottom,lastEnemyFrame?.bottom,...lastAllyFrames.map(frame=>frame.bottom)].filter(value=>value!==undefined)};stage.lastLayout=lastLayout;drawActing(ctx,b,t);
    fx=fx.filter(f=>t-f.start<.95);ctx.textAlign='center';for(const f of fx){const p=pos[f.uid],actor=f.uid==='hero'?lastHeroFrame:f.uid===enemy.uid?lastEnemyFrame:lastAllyFrames.find(frame=>frame.uid===f.uid)||lastEnemyFrames.find(frame=>frame.uid===f.uid),age=t-f.start;if(!p||age<0)continue;const x=Math.round(p[0]+f.lane*30*(p[0]<W/2?1:-1)),y=Math.round((actor?.top??p[1]-49)-8-age*20-f.lane*2),label=f.kind==='miss'?'TRƯỢT':(f.kind==='heal'?'+':'−')+Math.round(f.amount);ctx.globalAlpha=Math.min(1,(.95-age)*2.8);ctx.font=`${f.critical?18:16}px 'VTN Pixel','VTN UI',monospace`;ctx.fillStyle='#07080c';ctx.fillText(label,x+1,y+1);ctx.fillStyle=f.kind==='miss'?'#c9b9dd':f.kind==='heal'?'#87e4a6':f.uid===enemy.uid?'#ffe08a':'#ff9999';ctx.fillText(label,x,y);ctx.globalAlpha=1;if(f.kind==='damage'&&age<.28&&!motion.matches){ctx.fillStyle=f.critical?'#ffe8ac':'#e1bba4';for(let i=0;i<5;i++){const angle=i*1.7,dist=age*45;ctx.fillRect(Math.round(x+Math.cos(angle)*dist),Math.round(p[1]-28+Math.sin(angle)*dist),2,2);}}}totalFrames++;raf=requestAnimationFrame(frame);}
  mount();
})();
