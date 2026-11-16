(function(g){
  'use strict';

  const AXES=[
    ['STR','Sức mạnh'],['DEX','Khéo léo'],['CON','Thể chất'],['DEF','Phòng thủ'],
    ['SPD','Tốc độ'],['INT','Trí lực'],['WIS','Tinh thần'],['CHA','Mị lực']
  ];
  const CX=180,CY=166,RADIUS=105,OUTER_LABEL_RADIUS=145,RING_COUNT=4;
  const previous=new Map(),inspectState=new Map();
  let uid=0;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const reduced=()=>!!g.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const numberMap=value=>{try{return JSON.parse(value||'{}')}catch{return {}}};
  const valueOf=(map,key)=>Number.isFinite(Number(map?.[key]))?Number(map[key]):0;
  const angleAt=index=>-Math.PI/2+index*Math.PI*2/AXES.length;
  const pointAt=(index,radius)=>{
    const angle=angleAt(index);return [CX+Math.cos(angle)*radius,CY+Math.sin(angle)*radius];
  };
  const pointsFor=(values,min,max,radius=RADIUS)=>AXES.map(([key])=>{
    const raw=valueOf(values,key),ratio=Math.max(0,Math.min(1,(raw-min)/Math.max(1,max-min))),[x,y]=pointAt(AXES.findIndex(axis=>axis[0]===key),radius*ratio);return [x,y];
  });
  const polygon=points=>points.map(([x,y])=>`${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const interpolate=(from,to,t)=>Object.fromEntries(AXES.map(([key])=>[key,valueOf(from,key)+(valueOf(to,key)-valueOf(from,key))*t]));
  const displayValue=(raw,min,max)=>raw>max?`${max}+`:raw<min?`${min}−`:String(Math.round(raw));
  const anchorFor=index=>{const x=Math.cos(angleAt(index));return x>.24?'start':x<-.24?'end':'middle';};
  const labelYFor=index=>{const y=Math.sin(angleAt(index));return y>.55?'start':y<-.55?'end':'middle';};
  const gridPoints=scale=>polygon(AXES.map((_,i)=>pointAt(i,RADIUS*scale)));

  function build(el){
    if(el.dataset.radarReady==='true')return;
    const id=`vtn-radar-${++uid}`;
    const title=el.dataset.radarTitle||'Biểu đồ chỉ số';
    const hasBase=!!el.dataset.radarBase;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.classList.add('stat-radar-svg');svg.setAttribute('viewBox','0 0 360 330');svg.setAttribute('role','img');svg.setAttribute('aria-labelledby',`${id}-title`);
    svg.innerHTML=`<title id="${id}-title">${esc(title)}</title><defs><linearGradient id="${id}-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#aa75d4" stop-opacity=".48"/><stop offset=".58" stop-color="#c89b52" stop-opacity=".48"/><stop offset="1" stop-color="#f2d48c" stop-opacity=".6"/></linearGradient><linearGradient id="${id}-base" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#8455b3" stop-opacity=".18"/><stop offset="1" stop-color="#8d9ee9" stop-opacity=".3"/></linearGradient></defs><g class="radar-grid" aria-hidden="true">${Array.from({length:RING_COUNT},(_,i)=>`<polygon points="${gridPoints((i+1)/RING_COUNT)}"></polygon>`).join('')}</g><g class="radar-axes" aria-hidden="true">${AXES.map((_,i)=>{const [x,y]=pointAt(i,RADIUS);return `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"></line>`;}).join('')}</g>${hasBase?`<polygon class="radar-shape radar-shape-base" data-radar-layer="base" fill="url(#${id}-base)"></polygon>`:''}<polygon class="radar-shape radar-shape-value" data-radar-layer="value" fill="url(#${id}-fill)"></polygon><g class="radar-vertices" aria-hidden="true">${AXES.map((_,i)=>{const [x,y]=pointAt(i,RADIUS);return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.2"></circle>`;}).join('')}</g><g class="radar-axis-labels">${AXES.map(([key,label],i)=>{const [x,y]=pointAt(i,OUTER_LABEL_RADIUS);return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="${anchorFor(i)}" dominant-baseline="${labelYFor(i)}" data-radar-axis="${key}"><tspan class="radar-axis-code">${key} <tspan data-radar-number="${key}">0</tspan></tspan><tspan class="radar-axis-name" x="${x.toFixed(2)}" dy="12">${esc(label)}</tspan></text>`;}).join('')}</g>`;
    const legend=hasBase?'<div class="radar-legend"><span class="radar-legend-item radar-legend-base"><i></i>Lớp</span><span class="radar-legend-item radar-legend-value"><i></i>Cuối cùng</span></div>':'';
    const table=`<table class="sr-only stat-radar-table"><caption>${esc(title)}</caption><thead><tr><th>Mã</th><th>Chỉ số</th><th>Giá trị</th></tr></thead><tbody>${AXES.map(([key,label])=>`<tr data-radar-row="${key}"><th scope="row">${key}</th><td>${esc(label)}</td><td data-radar-cell="${key}">0</td></tr>`).join('')}</tbody></table>`;
    el.innerHTML='';el.append(svg);if(legend)el.insertAdjacentHTML('beforeend',legend);el.insertAdjacentHTML('beforeend',table);el.dataset.radarReady='true';
  }

  function render(el,fromValue,fromBase,toValue,toBase,t){
    const min=Number(el.dataset.radarMin||0),max=Number(el.dataset.radarMax||16);
    const value=interpolate(fromValue,toValue,t),base=interpolate(fromBase,toBase,t);
    const valuePath=el.querySelector('[data-radar-layer="value"]'),basePath=el.querySelector('[data-radar-layer="base"]');
    if(valuePath)valuePath.setAttribute('points',polygon(pointsFor(value,min,max)));
    if(basePath)basePath.setAttribute('points',polygon(pointsFor(base,min,max)));
    for(const [key] of AXES){
      const raw=valueOf(value,key),number=el.querySelector(`[data-radar-number="${key}"]`),cell=el.querySelector(`[data-radar-cell="${key}"]`);
      if(number)number.textContent=displayValue(raw,min,max);
      if(cell)cell.textContent=raw>max?`${Math.round(raw)} (hiển thị ${max}+)`:raw<min?`${Math.round(raw)} (dưới ${min})`:String(Math.round(raw));
    }
  }

  function mount(root=document){
    const nodes=root.querySelectorAll?.('[data-stat-radar]')||[];
    for(const el of nodes){
      build(el);
      const key=el.dataset.radarKey||el.id||`radar-${uid}`;
      const toValue=numberMap(el.dataset.radarValues),toBase=numberMap(el.dataset.radarBase),prior=previous.get(key);
      const fromValue=prior?.value||toValue,fromBase=prior?.base||toBase;
      const changed=JSON.stringify(fromValue)!==JSON.stringify(toValue)||JSON.stringify(fromBase)!==JSON.stringify(toBase);
      previous.set(key,{value:toValue,base:toBase});
      inspectState.set(key,{values:toValue,base:toBase,min:Number(el.dataset.radarMin||0),max:Number(el.dataset.radarMax||16)});
      if(!changed||reduced()){render(el,toValue,toBase,toValue,toBase,1);continue;}
      const start=performance.now(),duration=200;
      const step=now=>{if(!el.isConnected)return;const t=Math.min(1,(now-start)/duration),smooth=t*(2-t);render(el,fromValue,fromBase,toValue,toBase,smooth);if(t<1)(g.requestAnimationFrame||((fn)=>setTimeout(()=>fn(performance.now()),16)))(step);};
      render(el,fromValue,fromBase,toValue,toBase,0);(g.requestAnimationFrame||((fn)=>setTimeout(()=>fn(performance.now()),16)))(step);
    }
    return [...inspectState.values()];
  }

  g.VTNStatRadar={mount,inspect:()=>Object.fromEntries(inspectState)};
})(window);
