(function(){
 'use strict';
 const world=document.getElementById('world'),host=document.getElementById('touch');
 if(host){host.hidden=true;host.replaceChildren();}
 if(!world)return;
 world.style.touchAction='none';
 let pointer=null,last=null,timer=null;
 const available=()=>!!window.VTNGame?.state()?.started&&!window.VTNGame.battle()&&!document.getElementById('overlay')?.classList.contains('open');
 function stop(){if(timer){clearInterval(timer);timer=null;}const old=pointer;pointer=null;last=null;if(old!==null&&world.hasPointerCapture?.(old))world.releasePointerCapture(old);}
 function move(){if(!available()||!last){if(!available())stop();return;}window.VTNGame.moveToPointer(last.x,last.y);}
 function begin(e){if(pointer!==null||!available()||e.button>0)return;e.preventDefault();pointer=e.pointerId;last={x:e.clientX,y:e.clientY};world.setPointerCapture?.(pointer);move();if(e.pointerType==='touch'||e.pointerType==='pen')timer=setInterval(move,260);}
 function update(e){if(pointer!==e.pointerId)return;e.preventDefault();last={x:e.clientX,y:e.clientY};}
 function end(e){if(pointer===e.pointerId){e.preventDefault();stop();}}
 world.addEventListener('pointerdown',begin,{passive:false});world.addEventListener('pointermove',update,{passive:false});for(const event of ['pointerup','pointercancel','lostpointercapture'])world.addEventListener(event,end,{passive:false});
 window.addEventListener('blur',stop);window.addEventListener('pagehide',stop);window.addEventListener('resize',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 const overlay=document.getElementById('overlay');if(overlay)new MutationObserver(()=>{if(overlay.classList.contains('open'))stop();}).observe(overlay,{attributes:true,attributeFilter:['class']});
 window.VTNTouchControls={stop,inspect:()=>({active:pointer!==null,repeating:timer!==null,pointer:pointer!==null})};
})();
