/* VTNSkillIcon — picks a skill icon (assets/ui/skillicons, from 500 Free Skill Icons) whose colour fits the skill's element, stable per skill id. */
(function(g){
 'use strict';
 const icons=g.VTN_SKILL_ICONS||[],cache=new Map();
 function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function hsv(hex){const n=parseInt(String(hex||'#888888').slice(1),16),r=(n>>16&255)/255,gg=(n>>8&255)/255,b=(n&255)/255,mx=Math.max(r,gg,b),mn=Math.min(r,gg,b),d=mx-mn;let h=0;if(d){h=mx===r?((gg-b)/d)%6:mx===gg?(b-r)/d+2:(r-gg)/d+4;h=(h/6+1)%1;}return {h,s:mx?d/mx:0,v:mx};}
 function pool(type,color){
  const key=type+'|'+color;if(cache.has(key))return cache.get(key);
  const t=hsv(color),neutral=t.s<.22;
  const scored=icons.filter(i=>i[4]>.03||neutral).map(i=>{const dh=Math.min(Math.abs(i[1]-t.h),1-Math.abs(i[1]-t.h));return {n:i[0],score:neutral?Math.abs(i[2]-.12)*3+Math.abs(i[3]-.7):dh*2+(1-Math.min(1,i[4]*8))*.25};}).sort((a,b)=>a.score-b.score).slice(0,48).map(x=>x.n);
  cache.set(key,scored);return scored;
 }
 function url(skill,color){
  if(!icons.length||!skill)return '';
  const p=pool(skill.type||'',color||'#888888'),n=p[hash(skill.id||skill.name)%p.length]||1;
  return 'assets/ui/skillicons/'+String(n).padStart(3,'0')+'.webp';
 }
 function img(skill,color,cls='skill-ico'){const u=url(skill,color);return u?`<img class="${cls}" src="${u}" alt="" width="36" height="36" loading="lazy" decoding="async">`:'';}
 g.VTNSkillIcon={url,img};
})(window);
