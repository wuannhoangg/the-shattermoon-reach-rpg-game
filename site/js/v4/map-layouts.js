(function(g){
 'use strict';

 const WIDTH=40,HEIGHT=30,LAIR_WIDTH=36,LAIR_HEIGHT=17,REGION_WIDTH=80,REGION_HEIGHT=60,SPAWN={x:8,y:8};
  const DIRECTIONS=[[1,0],[0,1],[-1,0],[0,-1]];
  const ZONES=Object.freeze({ROAD:'ROAD',PLAZA:'PLAZA',GROUND:'GROUND',WILD:'WILD',SHORE:'SHORE',LIQUID:'LIQUID',WALL:'WALL'});
 const NPC_HOME_OFFSETS=(()=>{const out=[];for(let r=0;r<=4;r++)for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(Math.abs(x)+Math.abs(y)===r)out.push([x,y]);return out;})();

 const styles={
  region_01:{shrine:[8,9],clue:[14,5],boss:[32,22],puzzle:[22,13],rival:[5,6],portals:[[4,25],[11,25],[18,25],[27,25],[35,24],[31,14],[15,17],[26,6]]},
  region_02:{shrine:[5,23],clue:[30,5],boss:[34,21],puzzle:[20,14],rival:[7,7],portals:[[4,24],[13,23],[21,25],[31,23],[35,14],[29,5],[17,5],[8,13]]},
  region_03:{shrine:[32,6],clue:[7,22],boss:[34,23],puzzle:[20,15],rival:[6,6],portals:[[4,25],[12,26],[20,25],[29,26],[35,18],[34,9],[20,4],[8,6]]},
  region_04:{shrine:[34,24],clue:[6,5],boss:[31,6],puzzle:[19,14],rival:[5,24],portals:[[4,26],[11,23],[18,26],[27,23],[35,26],[34,15],[8,10],[25,5]]},
  region_05:{shrine:[7,22],clue:[29,6],boss:[33,21],puzzle:[20,14],rival:[6,7],portals:[[4,25],[13,26],[22,25],[31,26],[35,13],[28,5],[16,5],[8,13]]},
  region_06:{shrine:[20,15],clue:[6,7],shop:[12,15],boss:[34,22],puzzle:[28,9],rival:[5,24],arena:[31,8],portals:[[3,26],[10,26],[17,26],[25,26],[34,26],[35,15],[28,4],[8,4]]},
  region_07:{shrine:[31,7],clue:[7,23],boss:[34,21],puzzle:[20,14],rival:[5,6],portals:[[4,25],[12,25],[20,26],[29,25],[35,18],[34,7],[20,4],[8,13]]},
  region_08:{shrine:[11,23],clue:[31,6],boss:[33,21],puzzle:[20,14],rival:[5,7],portals:[[4,25],[13,26],[22,25],[31,26],[35,14],[29,5],[16,5],[8,14]]},
  region_09:{shrine:[20,6],clue:[7,23],boss:[33,22],puzzle:[20,16],rival:[5,7],portals:[[4,25],[12,25],[20,26],[29,25],[35,18],[34,7],[20,4],[8,7]]},
  region_10:{shrine:[30,6],clue:[8,22],boss:[34,22],puzzle:[20,15],rival:[5,6],portals:[[4,24],[13,23],[21,25],[30,23],[35,15],[29,5],[17,5],[8,13]]}
 };

 function hash(value){let h=2166136261;for(const c of String(value??'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function unit(value){return hash(value)/4294967296;}
 function rng(value){let state=hash(value)||0x9e3779b9;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
 function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
 function cellKey(x,y){return `${x},${y}`;}
 function dimensions(map=null,raw=null){
  const width=raw?.[0]?.length||(map?.kind==='region'?REGION_WIDTH:map?.kind==='lair'?LAIR_WIDTH:Number(map?.width)||WIDTH);
  const height=raw?.length||(map?.kind==='region'?REGION_HEIGHT:map?.kind==='lair'?LAIR_HEIGHT:Number(map?.height)||HEIGHT);
  return {width,height};
 }
 function inBounds(x,y,raw=null){const {width,height}=dimensions(null,raw);return x>0&&x<width-1&&y>0&&y<height-1;}
 function walkable(tile){return tile===0||tile===2;}

 function empty(fill=0,size=null){
  const {width,height}=dimensions(size&&typeof size==='object'&&!Array.isArray(size)?size:null,Array.isArray(size)?size:null);
  return Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||y===0||x===width-1||y===height-1?1:fill));
 }
 function setTile(a,x,y,value){const {width,height}=dimensions(null,a);if(x>0&&x<width-1&&y>0&&y<height-1&&a[y])a[y][x]=value;}
 function rect(a,x,y,w,h,value=0){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)setTile(a,xx,yy,value);}
 function ellipse(a,cx,cy,rx,ry,value=0){for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++)if(((x-cx)/(rx||1))**2+((y-cy)/(ry||1))**2<=1)setTile(a,x,y,value);}
 function line(a,x1,y1,x2,y2,value=0,width=1){
  const dx=Math.abs(x2-x1),sx=x1<x2?1:-1,dy=-Math.abs(y2-y1),sy=y1<y2?1:-1;let err=dx+dy,x=x1,y=y1;
  while(true){for(let oy=-width+1;oy<width;oy++)for(let ox=-width+1;ox<width;ox++)setTile(a,x+ox,y+oy,value);if(x===x2&&y===y2)break;const e2=2*err;if(e2>=dy){err+=dy;x+=sx;}if(e2<=dx){err+=dx;y+=sy;}}
 }
 function tunnel(a,points,width=1){for(let i=1;i<points.length;i++){const [x1,y1]=points[i-1],[x2,y2]=points[i];if(i%2)line(a,x1,y1,x2,y1,0,width);else line(a,x1,y1,x1,y2,0,width);line(a,i%2?x2:x1,i%2?y1:y2,x2,y2,0,width);}}
 function winding(a,points,width=1,phase=0){
  for(let i=1;i<points.length;i++){
   const [x1,y1]=points[i-1],[x2,y2]=points[i],steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
   for(let s=0;s<=steps;s++){
    const t=steps?s/steps:0,x=Math.round(x1+(x2-x1)*t),y=Math.round(y1+(y2-y1)*t+Math.sin(t*Math.PI*2+phase+i)*1.2);
    for(let oy=-width+1;oy<width;oy++)for(let ox=-width+1;ox<width;ox++)setTile(a,x+ox,y+oy,0);
   }
  }
 }

 function forest(map,random){
  const a=empty(0),avoid=(x,y)=>Math.abs(x-SPAWN.x)+Math.abs(y-SPAWN.y)<5;
  for(let i=0;i<30;i++){
   const cx=3+Math.floor(random()*34),cy=3+Math.floor(random()*23);if(avoid(cx,cy))continue;
   ellipse(a,cx,cy,1+Math.floor(random()*3),1+Math.floor(random()*3),1);
  }
  // Root-held graveyard clearings interrupt the dense canopy.
  for(const [x,y,rx,ry] of [[10,20,4,3],[27,19,4,3],[31,9,3,2]])ellipse(a,x,y,rx,ry,0);
  const creek=[];for(let y=2;y<28;y++){const x=Math.round(18+4*Math.sin(y*.43+random()*2)+1.3*Math.sin(y*.19));setTile(a,x,y,3);setTile(a,x+1,y,3);creek.push([x,y]);}
  for(const y of [7,15,23])line(a,12,y,25,y,0,1);
  winding(a,[[5,26],[10,21],[15,22],[17,16],[12,12],[18,8],[27,10],[34,5]],1,random()*6.28);
  // Keep the creek small and winding rather than turning it into a lake.
  for(const [x,y] of creek)if([7,15,23].includes(y)){setTile(a,x,y,0);setTile(a,x+1,y,0);}
  return a;
 }

 function islands(map,random,voidTile=3){
  const a=empty(voidTile),centers=map.regionId==='region_10'?[[5,5,2,2],[18,9,2,2],[33,5,3,2],[12,22,3,2],[31,22,3,2]]:[[7,7,4,3],[20,6,5,3],[32,8,4,4],[10,20,5,4],[25,21,7,4]];
  for(const [x,y,rx,ry] of centers)ellipse(a,x+Math.floor(random()*3)-1,y+Math.floor(random()*3)-1,rx,ry,0);
  if(map.regionId==='region_02'){
   // Broad salt beaches and the old wreck sit on the largest southern island.
   ellipse(a,25,21,8,5,0);rect(a,23,18,7,4,1);rect(a,25,19,3,2,0);line(a,20,20,25,20,0,1);
   for(const [x1,y1,x2,y2] of [[7,7,20,6],[20,6,32,8],[7,7,10,20],[10,20,25,21],[25,21,32,8]])line(a,x1,y1,x2,y2,0,2);
  }else{
   // Hắc Tinh keeps only hairline bridges between the floating rocks.
   for(const [x1,y1,x2,y2] of [[7,7,20,6],[20,6,32,8],[7,7,10,20],[10,20,25,21]])line(a,x1,y1,x2,y2,0,1);
   rect(a,25,5,8,7,1);rect(a,27,7,4,3,0);setTile(a,28,11,0);
  }
  return a;
 }

 function swamp(map,random){
  const a=empty(0);
  for(let i=0;i<20;i++){
   const x=4+Math.floor(random()*31),y=3+Math.floor(random()*23),rx=2+Math.floor(random()*3),ry=1+Math.floor(random()*3);
   ellipse(a,x,y,rx,ry,3);if(i%5===0)ellipse(a,x+1,y,Math.max(1,rx-1),Math.max(1,ry-1),0);
  }
  // Raised boardwalks cut across the shallow ponds.
  for(const x of [7,19,31])line(a,x,2,x,27,0,1);
  for(const y of [8,20,25])line(a,2,y,37,y,0,1);
  for(const [x,y] of [[10,5],[26,5],[11,15],[28,17]]){rect(a,x-2,y-2,5,5,1);rect(a,x-1,y-1,3,3,0);setTile(a,x,y+2,0);}
  return a;
 }

 function mountain(map,random){
  const a=empty(0),bands=[4,10,16,22];
  bands.forEach((y,i)=>{const gap=5+(i*9+Math.floor(random()*6))%27;for(let x=2;x<38;x++)if(Math.abs(x-gap)>1)setTile(a,x,y,1);for(let x=2;x<38;x++)if(Math.abs(x-gap)>1)setTile(a,x,y+1,1);});
  for(const [x,y,w,h] of [[12,2,4,4],[28,2,5,3],[4,13,4,4],[24,18,5,4],[13,24,6,3]])rect(a,x,y,w,h,1);
  winding(a,[[8,26],[31,24],[9,18],[29,14],[8,8],[31,4]],1,random()*6.28);
  for(let y=2;y<28;y++){const x=Math.round(27+2*Math.sin(y*.38+random()));setTile(a,x,y,3);if(y%7===0)setTile(a,x,y,0);}
  return a;
 }

 function desert(map,random){
  const a=empty(0);
  // Crystal clusters break the dunes without turning the map into a forest.
  for(let i=0;i<11;i++){const x=3+Math.floor(random()*33),y=3+Math.floor(random()*23);rect(a,x,y,1+Math.floor(random()*2),1+Math.floor(random()*2),1);}
  // Ruined palace: solid outer block, open courtyard, and one broken gate.
  rect(a,21,7,14,14,1);rect(a,24,10,8,8,0);rect(a,27,7,2,3,1);rect(a,27,18,2,3,0);setTile(a,27,21,0);
  ellipse(a,9,7,3,2,3);ellipse(a,34,7,2,3,3);ellipse(a,13,23,3,2,3);
  line(a,7,23,27,21,0,1);
  return a;
 }

 function city(map,random){
  const a=empty(1);
  const streetsX=[4,10,16,23,29,35],streetsY=[4,10,16,22,26];
  for(const x of streetsX)line(a,x,2,x,27,0,1);for(const y of streetsY)line(a,2,y,37,y,0,1);
  for(const [x,y,w,h] of [[6,5,3,3],[12,11,3,3],[25,5,3,3],[31,11,3,3],[6,17,3,3],[25,17,3,3],[12,23,3,2]]){rect(a,x-1,y-1,w+2,h+2,0);rect(a,x,y,w,h,1);}
  for(const [x,y,w,h] of [[6,5,5,4],[25,5,5,4],[6,17,5,4],[25,17,5,4]])rect(a,x,y,w,h,0);
  // The canal has deliberate bridge crossings and a gate opening on the south wall.
  for(let y=2;y<27;y++){setTile(a,20,y,3);setTile(a,21,y,3);}for(const y of [4,10,16,22,26])for(let x=18;x<=23;x++)setTile(a,x,y,0);
  rect(a,17,25,7,3,0);rect(a,18,27,5,1,0);
  return a;
 }

 function cave(map,random){
  const a=empty(1);
  for(let y=1;y<HEIGHT-1;y++)for(let x=1;x<WIDTH-1;x++)a[y][x]=random()<.45?0:1;
  for(let pass=0;pass<4;pass++){
   const next=empty(1);
   for(let y=1;y<HEIGHT-1;y++)for(let x=1;x<WIDTH-1;x++){
    let walls=0;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++)if(a[y+oy][x+ox]===1)walls++;
    next[y][x]=walls>=5?1:0;
   }
   for(let x=0;x<WIDTH;x++){next[0][x]=1;next[HEIGHT-1][x]=1;}for(let y=0;y<HEIGHT;y++){next[y][0]=1;next[y][WIDTH-1]=1;}
   for(let y=0;y<HEIGHT;y++)a[y]=next[y];
  }
  // Rail corridors and crystal caverns are the intentional long connections.
  line(a,3,7,36,7,0,1);line(a,3,22,36,22,0,1);line(a,11,7,11,22,0,1);line(a,29,7,29,22,0,1);
  for(const [x,y,rx,ry] of [[6,14,3,2],[20,11,4,3],[34,16,3,3]])ellipse(a,x,y,rx,ry,0);
  return a;
 }

 function snow(map,random){
  const a=empty(0);
  // Pine groves form rough edges; the middle remains a broad snowfield.
  for(let i=0;i<22;i++){const x=random()<.5?2+Math.floor(random()*7):31+Math.floor(random()*6),y=2+Math.floor(random()*25);ellipse(a,x,y,1+Math.floor(random()*2),1+Math.floor(random()*2),1);}
  // Fortress ruin and a frozen lake: the lake centre is floor, its dark rim is water.
  rect(a,4,5,14,10,1);rect(a,7,8,8,5,0);setTile(a,10,14,0);setTile(a,10,15,0);
  ellipse(a,27,15,9,6,3);ellipse(a,27,15,7,4,0);
  line(a,18,23,27,19,0,1);
  return a;
 }

 function ceremonial(map,random){
  const a=empty(0);
  for(let i=0;i<20;i++){const x=random()<.5?2+Math.floor(random()*5):33+Math.floor(random()*5),y=2+Math.floor(random()*25);ellipse(a,x,y,1+Math.floor(random()*2),1+Math.floor(random()*2),1);}
  rect(a,18,1,5,28,0);
  for(const y of [5,12,19,25]){for(let x=3;x<37;x++)if(x<17||x>24)setTile(a,x,y,1);for(let x=17;x<=24;x++)setTile(a,x,y,0);}
  for(const [x,y] of [[9,6],[27,6],[9,14],[27,14],[9,21],[27,21]]){rect(a,x-3,y-2,7,5,1);rect(a,x-2,y-1,5,3,0);setTile(a,x,y-2,0);}
  ellipse(a,14,10,2,2,3);ellipse(a,26,18,2,2,3);ellipse(a,11,24,2,1,3);
  return a;
 }

 function roomDungeon(map,random){
  const voidBase=map.regionId==='region_10'?3:1,a=empty(voidBase),rooms=[];
  const count=map.kind==='area'?4:map.kind==='wonder'||map.kind==='realm'?4:5+(hash(map.id)%3);
  const addRoom=(x,y,w,h)=>{rect(a,x,y,w,h,0);rooms.push({x,y,w,h,cx:Math.floor(x+w/2),cy:Math.floor(y+h/2)});};
  addRoom(3,4,8,7);
  for(let i=1;i<count;i++){
   let placed=false;
   for(let tries=0;tries<30&&!placed;tries++){
    const w=4+Math.floor(random()*6),h=3+Math.floor(random()*5),x=2+Math.floor(random()*(36-w)),y=2+Math.floor(random()*(26-h));
    if(rooms.every(r=>x>r.x+r.w+1||x+w<r.x-1||y>r.y+r.h+1||y+h<r.y-1)){addRoom(x,y,w,h);placed=true;}
   }
   if(!placed)addRoom(5+(i*7)%27,18+(i*5)%8,5,4);
  }
  for(let i=1;i<rooms.length;i++){
   const from=rooms[i-1],to=rooms[i];
   if(i%2)tunnel(a,[[from.cx,from.cy],[to.cx,to.cy]],1);else tunnel(a,[[from.cx,from.cy],[to.cx,to.cy]],2);
  }
  if(map.regionId==='region_02')for(const [x,y,rx,ry] of [[30,5,2,1],[8,22,2,2]])ellipse(a,x,y,rx,ry,3);
  if(map.regionId==='region_03')for(const [x,y,rx,ry] of [[15,8,2,1],[31,20,2,2]])ellipse(a,x,y,rx,ry,3);
  if(map.regionId==='region_04')for(const [y,gap] of [[9,8],[18,29]])for(let x=2;x<38;x++)if(Math.abs(x-gap)>1)setTile(a,x,y,1);
  return a;
 }

 function regionalTerrain(map,random){
  const region=map?.regionId||'region_01';
  switch(region){
   case 'region_01':return forest(map,random);
   case 'region_02':return islands(map,random,3);
   case 'region_03':return swamp(map,random);
   case 'region_04':return mountain(map,random);
   case 'region_05':return desert(map,random);
   case 'region_06':return city(map,random);
   case 'region_07':return cave(map,random);
   case 'region_08':return snow(map,random);
   case 'region_09':return ceremonial(map,random);
   case 'region_10':return islands(map,random,3);
   default:return roomDungeon(map,random);
  }
 }
 function buildingLots(map){return g.VTN_DATA?.buildings?.regions?.[map?.regionId]?.lots||[];}
 function applyBuildingLots(a,map){
  for(const lot of buildingLots(map)){
   const x=Math.round(Number(lot.x)),y=Math.round(Number(lot.y)),w=Math.max(2,Math.round(Number(lot.w)||6)),h=Math.max(2,Math.round(Number(lot.h)||5));
   rect(a,x,y,w,h,1);
   const door=Array.isArray(lot.door)?lot.door:[x+Math.floor(w/2),y+h-1];
   setTile(a,Math.round(door[0]),Math.round(door[1]),0);
   // A one-tile apron prevents a large lot from becoming a sealed island.
   setTile(a,Math.round(door[0]),Math.round(door[1])+1,0);
  }
  return a;
 }
 function scaleGrid(source,width,height){
  const sourceHeight=source.length,sourceWidth=source[0]?.length||WIDTH;
  return Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>{
   const sx=Math.min(sourceWidth-1,Math.floor(x*sourceWidth/width)),sy=Math.min(sourceHeight-1,Math.floor(y*sourceHeight/height));
   return x===0||y===0||x===width-1||y===height-1?1:source[sy]?.[sx]??0;
  }));
 }
 function largeRegionalTerrain(map,random){
  const source=regionalTerrain({...map,kind:'region'},random),a=scaleGrid(source,REGION_WIDTH,REGION_HEIGHT),region=map.regionId;
  // The scaled silhouette is deliberately sparse; these broad additions give each
  // 80x60 region its own second layer of landmarks without sealing the route network.
  if(region==='region_02'||region==='region_10'){
   for(let i=0;i<10;i++){const x=8+Math.floor(random()*64),y=8+Math.floor(random()*38);ellipse(a,x,y,2+Math.floor(random()*4),1+Math.floor(random()*3),0);}
   for(const [x1,y1,x2,y2] of [[12,14,28,12],[28,12,47,19],[47,19,66,13],[17,43,40,47],[40,47,64,42]])line(a,x1,y1,x2,y2,0,1);
  }else if(region==='region_06'){
   for(const x of [8,18,29,40,51,62,72])line(a,x,4,x,54,0,1);
   for(const y of [8,18,29,40,51])line(a,4,y,75,y,0,1);
   for(let i=0;i<18;i++){const x=5+Math.floor(random()*66),y=5+Math.floor(random()*47);rect(a,x,y,3+Math.floor(random()*4),2+Math.floor(random()*4),1);}
  }else if(region==='region_04'||region==='region_07'){
   for(let i=0;i<12;i++){const x=6+Math.floor(random()*66),y=5+Math.floor(random()*46);ellipse(a,x,y,2+Math.floor(random()*4),2+Math.floor(random()*3),1);}
   winding(a,[[6,52],[20,42],[32,48],[44,30],[58,38],[73,8]],1,random()*6.28);
  }else{
   for(let i=0;i<18;i++){const x=5+Math.floor(random()*68),y=5+Math.floor(random()*48);ellipse(a,x,y,1+Math.floor(random()*3),1+Math.floor(random()*3),region==='region_03'?3:1);}
   winding(a,[[6,51],[19,42],[29,45],[39,33],[52,36],[73,8]],1,random()*6.28);
  }
  return applyBuildingLots(a,map);
 }
 function lairAsset(map){
  const rid=map?.lairId||String(map?.regionId||'region_01').slice(-2);
  const source=g.VTN_DATA?.lair_art?.[rid]||g.VTN_LAIR_ART?.[rid]||{};
  return {rid,...source,image:source.image||'assets/lairs/built/'+rid+'.png',emptyImage:source.emptyImage||'assets/lairs/built/'+rid+'_empty.png'};
 }
 function pointInPolygon(x,y,polygon){
  if(!Array.isArray(polygon)||polygon.length<3)return false;
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const ax=Number(polygon[i]?.[0]),ay=Number(polygon[i]?.[1]),bx=Number(polygon[j]?.[0]),by=Number(polygon[j]?.[1]);
   if(!Number.isFinite(ax)||!Number.isFinite(ay)||!Number.isFinite(bx)||!Number.isFinite(by))continue;
   const crosses=((ay>y)!==(by>y))&&x<(bx-ax)*(y-ay)/(by-ay||Number.EPSILON)+ax;
   if(crosses)inside=!inside;
  }
  return inside;
 }
 function lairGeometry(map){
  const {width,height}=dimensions(map),asset=lairAsset(map);
  return {width,height,rid:asset.rid,asset,floor:Array.isArray(asset.floor)?asset.floor:[],entrance:Array.isArray(asset.entrance)?asset.entrance:[]};
 }
 function lairWalkable(map,x,y){
  const {width,height,floor,entrance}=lairGeometry(map);
  if(x<0||x>=width||y<0||y>=height)return false;
  const px=(x+.5)/width,py=(y+.5)/height;
  return pointInPolygon(px,py,floor)||pointInPolygon(px,py,entrance);
 }
 function lairCenterColumn(map){
  const {width,height}=lairGeometry(map),x=Math.max(0,Math.min(width-1,Math.floor(width/2))),cells=[];
  for(let y=0;y<height;y++)if(lairWalkable(map,x,y))cells.push({x,y});
  return cells;
 }
 function lairWake(map){
  const cells=lairCenterColumn(map);
  return cells[0]||{x:Math.max(0,Math.floor(lairGeometry(map).width/2)),y:0};
 }
 function lairSpawn(map){
  const cells=lairCenterColumn(map);
  return cells.at(-1)||{x:Math.max(0,Math.floor(lairGeometry(map).width/2)),y:Math.max(0,lairGeometry(map).height-1)};
 }
 function lairTerrain(map){
  const {width,height}=lairGeometry(map);
  return Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>lairWalkable(map,x,y)?0:1));
 }
 function abyssCave(map,random){
  const width=Math.max(12,Number(map?.width)||30),height=Math.max(12,Number(map?.height)||24),a=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||y===0||x===width-1||y===height-1?1:random()<.18?1:0));
  const set=(x,y,value=0)=>{if(x>0&&x<width-1&&y>0&&y<height-1)a[y][x]=value;};
  const carve=(x1,y1,x2,y2,w=1)=>{let x=x1,y=y1,guard=0;while((x!==x2||y!==y2)&&guard++<width*height){for(let oy=-w;oy<=w;oy++)for(let ox=-w;ox<=w;ox++)set(x+ox,y+oy,0);if(x!==x2)x+=Math.sign(x2-x);if(y!==y2)y+=Math.sign(y2-y);}set(x2,y2,0);};
  const spawn=map?.spawn||SPAWN,anchors=[spawn,...(map?.points||[]).map(p=>({x:p.x,y:p.y}))];
  for(let i=1;i<anchors.length;i++){const from=anchors[i-1],to=anchors[i];if(i%2)carve(from.x,from.y,to.x,from.y,1);carve(i%2?to.x:from.x,i%2?from.y:to.y,to.x,to.y,1);}
  for(const p of anchors)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)set(p.x+x,p.y+y,0);
  return a;
 }
 function compactRegional(map,random){
  const a=regionalTerrain(map,random);
   const {width,height}=dimensions(map,a);
  // Areas keep the region silhouette but have a tighter playable envelope.
   for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++)if(x<3||x>width-4||y<3||y>height-4)a[y][x]=1;
  return a;
 }
 function terrainGrid(map){
  const random=rng(map?.id||'map'),region=map?.regionId||'region_01';
   if(map?.layout==='abyss_cave')return abyssCave(map,random);
   if(map?.layout==='lair')return lairTerrain(map);
  if(map?.kind==='area')return compactRegional(map,random);
  if(map?.kind!=='region')return region==='region_07'?cave(map,random):roomDungeon(map,random);
   return map?.kind==='region'||Number(map?.width||0)>=REGION_WIDTH||Number(map?.height||0)>=REGION_HEIGHT?largeRegionalTerrain(map,random):applyBuildingLots(regionalTerrain(map,random),map);
 }

 function chooseCoord(base,key,map,used){
   const {width,height}=dimensions(map),[bx,by]=base||[SPAWN.x,SPAWN.y],compact=map?.kind!=='region',seed=hash(`${map?.id||'map'}|${key}`),offsets=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2],[1,1],[-1,1],[1,-1],[-1,-1]];
  const start=compact?seed%offsets.length:0;
  for(let i=0;i<offsets.length;i++){
    const [dx,dy]=offsets[(start+i)%offsets.length],x=clamp(bx+dx,1,width-2),y=clamp(by+dy,1,height-2),key2=cellKey(x,y);if(!used.has(key2))return [x,y];
  }
   return [clamp(bx,1,width-2),clamp(by,1,height-2)];
 }
 function pointAnchors(map){
    if(map?.kind==='lair'){
     const spawn=lairSpawn(map),wake=lairWake(map),raw=Array.isArray(map?.points)?map.points:[],points=raw.length?raw:[{id:map.id+'_entrance',type:'portal',target:map.parentId,name:'Lối ra'},{id:map.id+'_overlord',type:map.finalBossId?'final-boss':'overlord',overlordId:map.overlordId,finalBossId:map.finalBossId,name:map.finalBossId?'Chung Dạ Uyên Nhãn':'Bá Chủ đang ngủ'}];
     return points.map((point,index)=>({...point,id:point.id||map.id+'|point|'+index,x:point.type==='portal'?spawn.x:wake.x,y:point.type==='portal'?spawn.y:wake.y,type:point.type||'point'}));
    }
   if(Array.isArray(map?.points))return map.points.map((point,index)=>({id:point.id||`${map.id}|point|${index}`,x:Math.round(Number(point.x)),y:Math.round(Number(point.y)),type:point.type||'point',...point}));
   const style=styles[map?.regionId]||styles.region_01,used=new Set(),out=[];
  const add=(type,base,key,extra={})=>{if(!base)return;const [x,y]=chooseCoord(base,key,map,used);used.add(cellKey(x,y));out.push({id:map.id+'|'+key,x,y,type,...extra});};
   if(map?.kind==='region')for(const lot of buildingLots(map)){
    const door=Array.isArray(lot.door)?lot.door:[Number(lot.x)+Math.floor(Number(lot.w||6)/2),Number(lot.y)+Number(lot.h||5)-1];
    const x=Math.round(door[0]),y=Math.round(door[1]),type=lot.kind==='gate'?'boss-gate':'building';
    used.add(cellKey(x,y));out.push({id:lot.name,x,y,type,name:lot.name,regionId:map.regionId,lot,target:type==='boss-gate'?`lair_${String(map.regionId).slice(-2)}`:undefined});
   }
  if(map?.kind==='region')add('shrine',style.shrine,'shrine');
  add('clue',style.clue,'clue');
  if(map?.id==='region_06')add('shop',style.shop,'shop');
  add('boss',style.boss,'boss');
  add('puzzle',style.puzzle,'puzzle');
  if(map?.id==='region_06')add('arena',style.arena,'arena');
  if(map?.kind==='region')add('rival',style.rival,'rival');
  const slots=style.portals||[[4,25],[20,25],[35,25]];
  (map?.links||[]).forEach((target,index)=>add('portal',slots[index%slots.length],`portal|${index}`,{target}));
  return out;
 }

 function npcHome(n,index,raw,blocked,occupied){
   const {width,height}=dimensions(null,raw),baseX=clamp(Math.round(Number.isFinite(Number(n?.x))?Number(n.x):5+(index%6)*5),1,width-2),baseY=clamp(Math.round(Number.isFinite(Number(n?.y))?Number(n.y):12+Math.floor(index/6)*5),1,height-2);
  const ordered=NPC_HOME_OFFSETS.slice().sort((a,b)=>unit(`${n?.id||index}|home|${a[0]},${a[1]}`)-unit(`${n?.id||index}|home|${b[0]},${b[1]}`));
  const usable=(x,y,rawOnly=true)=>inBounds(x,y,raw)&&!blocked.has(cellKey(x,y))&&!occupied.has(cellKey(x,y))&&(!rawOnly||!([1,3].includes(raw?.[y]?.[x])));
  for(const [dx,dy] of [[0,0],...ordered])if(usable(baseX+dx,baseY+dy))return {x:baseX+dx,y:baseY+dy};
  for(const [dx,dy] of [[0,0],...ordered])if(usable(baseX+dx,baseY+dy,false))return {x:baseX+dx,y:baseY+dy};
  return {x:baseX,y:baseY};
 }

 function heapPush(heap,item){heap.push(item);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][0]<=item[0])break;heap[i]=heap[p];i=p;heap[i]=item;}}
 function heapPop(heap){if(!heap.length)return null;const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let left=i*2+1,right=left+1,small=i;if(left<heap.length&&heap[left][0]<heap[small][0])small=left;if(right<heap.length&&heap[right][0]<heap[small][0])small=right;if(small===i)break;heap[i]=heap[small];i=small;}heap[i]=last;}return first;}
  function routePath(a,start,goal){
   const width=a?.[0]?.length||WIDTH,height=a?.length||HEIGHT,sx=clamp(Math.round(start.x),1,width-2),sy=clamp(Math.round(start.y),1,height-2),gx=clamp(Math.round(goal.x),1,width-2),gy=clamp(Math.round(goal.y),1,height-2);
   // Roads are deliberately carved corridors, not an A* trace over the old
   // terrain.  A single deterministic dog-leg keeps long routes readable and
   // prevents the one-cell staircase/zig-zag that made P9-F look patched.
   const path=[{x:sx,y:sy}],horizontalFirst=hash(`${sx},${sy}|${gx},${gy}|road`) % 2===0;
   const append=(x,y)=>{const last=path.at(-1);if(!last||last.x!==x||last.y!==y)path.push({x,y});};
   const horizontal=()=>{for(let x=sx+Math.sign(gx-sx);x!==gx+Math.sign(gx-sx);x+=Math.sign(gx-sx))append(x,sy);};
   const vertical=()=>{for(let y=sy+Math.sign(gy-sy);y!==gy+Math.sign(gy-sy);y+=Math.sign(gy-sy))append(gx,y);};
   if(sx===gx){for(let y=sy+Math.sign(gy-sy);y!==gy+Math.sign(gy-sy);y+=Math.sign(gy-sy))append(sx,y);}
   else if(sy===gy){for(let x=sx+Math.sign(gx-sx);x!==gx+Math.sign(gx-sx);x+=Math.sign(gx-sx))append(x,sy);}
   else if(horizontalFirst){horizontal();vertical();}
   else {for(let y=sy+Math.sign(gy-sy);y!==gy+Math.sign(gy-sy);y+=Math.sign(gy-sy))append(sx,y);for(let x=sx+Math.sign(gx-sx);x!==gx+Math.sign(gx-sx);x+=Math.sign(gx-sx))append(x,gy);}
   return path;
  }
  function roadNetwork(map,a,points=[],extraEndpoints=[],includeActors=false){
   const width=a?.[0]?.length||WIDTH,height=a?.length||HEIGHT,spawn=map?.spawn||SPAWN,endpoints=[];
   const add=point=>{const x=clamp(Math.round(Number(point?.x)),1,width-2),y=clamp(Math.round(Number(point?.y)),1,height-2);if(!endpoints.some(other=>other.x===x&&other.y===y))endpoints.push({x,y});};
   add(spawn);if(spawn.x!==SPAWN.x||spawn.y!==SPAWN.y)add(SPAWN);
   for(const point of points||[])if(!['npc','rival'].includes(point.type))add(point);
   for(const point of extraEndpoints||[])add(point);
   const routes=[];
   if(map?.kind==='region'){
    // Join nearby landmarks instead of laying one long road through every
    // landmark in data order. The resulting settlement has small courtyards
    // and branches, leaving large quiet habitat pockets between routes.
    const joined=[endpoints[0]||SPAWN],waiting=endpoints.slice(1);
    while(waiting.length){let best=null;for(const from of joined)for(let i=0;i<waiting.length;i++){const to=waiting[i],distance=Math.abs(from.x-to.x)+Math.abs(from.y-to.y);if(!best||distance<best.distance)best={from,to,index:i,distance};}const route=routePath(a,best.from,best.to);if(route.length)routes.push(route);joined.push(best.to);waiting.splice(best.index,1);}
   }else{let from=endpoints[0]||SPAWN;for(const endpoint of endpoints.slice(1)){const route=routePath(a,from,endpoint);if(route.length)routes.push(route);from=endpoint;}}
   if(includeActors)for(const point of points||[])if(['npc','rival'].includes(point.type)){
    const target={x:clamp(Math.round(Number(point.x)),1,width-2),y:clamp(Math.round(Number(point.y)),1,height-2)};
    if(endpoints.some(p=>p.x===target.x&&p.y===target.y))continue;
    const from=endpoints.reduce((best,p)=>Math.abs(p.x-target.x)+Math.abs(p.y-target.y)<Math.abs(best.x-target.x)+Math.abs(best.y-target.y)?p:best,endpoints[0]||SPAWN);
    const route=routePath(a,from,target);if(route.length)routes.push(route);endpoints.push(target);
   }
   const cells=new Set(),renderCells=new Set();
   const addCell=(x,y)=>{if(x>0&&x<width-1&&y>0&&y<height-1)renderCells.add(cellKey(x,y));};
   for(const route of routes){for(const cell of route)cells.add(cellKey(cell.x,cell.y));for(let i=0;i<route.length;i++){
     const cell=route[i],previous=route[Math.max(0,i-1)],next=route[Math.min(route.length-1,i+1)],horizontal=Math.abs(next.x-previous.x)>=Math.abs(next.y-previous.y);
     if(horizontal)for(let oy=-1;oy<=1;oy++)addCell(cell.x,cell.y+oy);else for(let ox=-1;ox<=1;ox++)addCell(cell.x+ox,cell.y);
     // A full three-cell junction closes the inside of an L turn without a
     // diagonal staircase, while keeping all long runs horizontal/vertical.
     if(previous.x!==next.x&&previous.y!==next.y)for(const [dx,dy] of [[-1,-1],[-1,1],[1,-1],[1,1]])addCell(cell.x+dx,cell.y+dy);
   }}
   return {cells,renderCells,routes,endpoints};
  }
  function sourceList(map,points=[],options={}){
   const sources=[];
   for(const lot of buildingLots(map))sources.push(lot);
   for(const source of options.plazaSources||[])sources.push(source?.lot||source);
   for(const point of points||[])if(['building','boss-gate','shrine','boss','puzzle','shop','arena','portal'].includes(point.type))sources.push(point);
   return sources;
  }
  function plazaCells(map,a,points=[],options={}){
   const width=a?.[0]?.length||WIDTH,height=a?.length||HEIGHT,cells=new Set();
   for(const source of sourceList(map,points,options)){
     const hasSize=Number.isFinite(Number(source?.w))&&Number.isFinite(Number(source?.h)),x=Number(source?.x),y=Number(source?.y);
     if(!Number.isFinite(x)||!Number.isFinite(y))continue;
     if(hasSize){const x0=Math.floor(x)-1,x1=Math.ceil(x+Number(source.w)),y0=Math.ceil(y+Number(source.h))-1,y1=y0+3;for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++){
       const insideLot=xx>=Math.floor(x)&&xx<Math.ceil(x+Number(source.w))&&yy>=Math.floor(y)&&yy<Math.ceil(y+Number(source.h));
       if(!insideLot&&xx>0&&xx<width-1&&yy>0&&yy<height-1&&a[yy]?.[xx]!==1&&a[yy]?.[xx]!==3)cells.add(cellKey(xx,yy));
     }}else{
       const radius=Math.max(2,Number(source?.radius)||2),cx=Math.round(x),cy=Math.round(y);for(let yy=cy-radius;yy<=cy+radius;yy++)for(let xx=cx-radius;xx<=cx+radius;xx++)if((map.regionId==='region_06'?Math.max(Math.abs(xx-cx),Math.abs(yy-cy))<=radius:Math.hypot(xx-cx,yy-cy)<=radius+.2)&&xx>0&&xx<width-1&&yy>0&&yy<height-1&&a[yy]?.[xx]!==1&&a[yy]?.[xx]!==3)cells.add(cellKey(xx,yy));
     }
   }
   return cells;
  }
  function countMaskNeighbours(mask,x,y){let count=0;for(const [dx,dy] of DIRECTIONS)if(mask.has(cellKey(x+dx,y+dy)))count++;return count;}
  function component(mask,width,height,start){const out=[],seen=new Set([cellKey(start[0],start[1])]),queue=[start];while(queue.length){const [x,y]=queue.shift();out.push([x,y]);for(const [dx,dy] of DIRECTIONS){const nx=x+dx,ny=y+dy,k=cellKey(nx,ny);if(nx>0&&nx<width-1&&ny>0&&ny<height-1&&mask.has(k)&&!seen.has(k)){seen.add(k);queue.push([nx,ny]);}}}return out;}
  function habitats(a){const height=a.length,width=a[0]?.length||0,seen=new Set(),groups=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++){const k=cellKey(x,y);if(a[y][x]!==2||seen.has(k))continue;const cells=[],queue=[[x,y]];seen.add(k);for(let i=0;i<queue.length;i++){const [cx,cy]=queue[i];cells.push({x:cx,y:cy});for(const [dx,dy] of DIRECTIONS){const nx=cx+dx,ny=cy+dy,nk=cellKey(nx,ny);if(a[ny]?.[nx]===2&&!seen.has(nk)){seen.add(nk);queue.push([nx,ny]);}}}groups.push({id:'habitat_'+(groups.length+1),cells,count:cells.length,center:{x:cells.reduce((v,c)=>v+c.x,0)/cells.length,y:cells.reduce((v,c)=>v+c.y,0)/cells.length}});}return groups;}
 function selectEncounterCells(a,reserved,seedValue){
  const height=a.length,width=a[0].length,cells=[],candidates=[],candidateSet=new Set();
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++)if(walkable(a[y][x])){cells.push({x,y});a[y][x]=0;if(!reserved.has(cellKey(x,y))){candidates.push({x,y});candidateSet.add(cellKey(x,y));}}
  const visited=new Set(),components=[];
  for(const cell of candidates){const k=cellKey(cell.x,cell.y);if(visited.has(k))continue;const group=[],queue=[cell];visited.add(k);for(let i=0;i<queue.length;i++){const c=queue[i];group.push(c);for(const [dx,dy] of DIRECTIONS){const x=c.x+dx,y=c.y+dy,nk=cellKey(x,y);if(candidateSet.has(nk)&&!visited.has(nk)){visited.add(nk);queue.push({x,y});}}}if(group.length>=16)components.push(group);}
  components.sort((a,b)=>b.length-a.length);const eligible=components.flat(),count=2+hash(seedValue+'|habitats')%3,seeds=[];
  const centroid=group=>{const cx=group.reduce((v,c)=>v+c.x,0)/group.length,cy=group.reduce((v,c)=>v+c.y,0)/group.length;return group.reduce((best,c)=>Math.hypot(c.x-cx,c.y-cy)<Math.hypot(best.x-cx,best.y-cy)?c:best,group[0]);};
  for(const group of components.slice(0,count))seeds.push(centroid(group));
  while(seeds.length<count&&eligible.length){let best=null,distance=-1;for(const cell of eligible){const d=Math.min(...seeds.map(seed=>Math.hypot(seed.x-cell.x,seed.y-cell.y)));if(d>distance){distance=d;best=cell;}}if(!best||distance<6)break;seeds.push(best);}
  const owners=new Map(),groups=seeds.map((seed,id)=>{owners.set(cellKey(seed.x,seed.y),id);return {id,seed,queue:[seed],at:0,size:1};}),target=Math.min(Math.round(cells.length*.25),eligible.length),allowed=new Set(eligible.map(c=>cellKey(c.x,c.y)));
  // Separate flood fills leave a safe one-cell boundary, so there are exactly
  // two to four contiguous habitats instead of scattered encounter tiles.
  let changed=true;while(owners.size<target&&changed){changed=false;for(const group of groups){if(owners.size>=target)break;while(group.at<group.queue.length){const cell=group.queue[group.at++];let grown=false;const dirs=DIRECTIONS.slice().sort((a,b)=>Math.hypot(cell.x+a[0]-group.seed.x,cell.y+a[1]-group.seed.y)-Math.hypot(cell.x+b[0]-group.seed.x,cell.y+b[1]-group.seed.y));for(const [dx,dy] of dirs){const x=cell.x+dx,y=cell.y+dy,k=cellKey(x,y);if(!allowed.has(k)||owners.has(k)||DIRECTIONS.some(([ox,oy])=>owners.has(cellKey(x+ox,y+oy))&&owners.get(cellKey(x+ox,y+oy))!==group.id))continue;owners.set(k,group.id);group.queue.push({x,y});group.size++;grown=true;changed=true;if(owners.size>=target)break;}if(grown)break;}}}
  // Very small isolated pockets stay safe terrain rather than fake habitats.
  const selected=new Set();for(const [k,id] of owners)if(groups[id].size>=12){const [x,y]=k.split(',').map(Number);a[y][x]=2;selected.add(k);}return {cells,selected,target:selected.size};
 }
 function normalizeEncounters(a,points,seedValue,spawn=SPAWN,options={}){
    if(options.noEncounters)return a;
    const reserved=new Set([cellKey(spawn.x,spawn.y)]);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)reserved.add(cellKey(spawn.x+dx,spawn.y+dy));for(const p of points||[])reserved.add(cellKey(p.x,p.y));for(const k of options.reservedCells||[])reserved.add(k);
    selectEncounterCells(a,reserved,seedValue);return a;
  }
  function zoneOrientation(zones,x,y){const road=ZONES.ROAD,up=zones[y-1]?.[x]===road,right=zones[y]?.[x+1]===road,down=zones[y+1]?.[x]===road,left=zones[y]?.[x-1]===road,mask=(up?1:0)|(right?2:0)|(down?4:0)|(left?8:0);if(mask===0)return 'cap';if(mask===5)return 'vertical';if(mask===10)return 'horizontal';if(mask===15)return 'crossing';if(mask===3)return 'corner-ne';if(mask===6)return 'corner-se';if(mask===12)return 'corner-sw';if(mask===9)return 'corner-nw';if(mask===7)return 't-junction-s';if(mask===11)return 't-junction-w';if(mask===13)return 't-junction-n';if(mask===14)return 't-junction-e';if(mask===1)return 'cap-n';if(mask===2)return 'cap-e';if(mask===4)return 'cap-s';return 'cap-w';}
  function cleanZoneComponents(zones,width,height){
   const cleanable=[ZONES.GROUND,ZONES.SHORE];
   for(let pass=0;pass<4;pass++){
    let changed=false;
    for(const zone of cleanable){
     const mask=new Set();for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++)if(zones[y]?.[x]===zone)mask.add(cellKey(x,y));
     const seen=new Set();
     for(const start of mask){if(seen.has(start))continue;const [sx,sy]=start.split(',').map(Number),group=component(mask,width,height,[sx,sy]);for(const [gx,gy] of group)seen.add(cellKey(gx,gy));if(group.length>=12)continue;
      const counts=new Map();for(const [gx,gy] of group)for(const [dx,dy] of DIRECTIONS){const neighbor=zones[gy+dy]?.[gx+dx];if(neighbor&&neighbor!==zone&&neighbor!==ZONES.WALL&&neighbor!==ZONES.LIQUID)counts.set(neighbor,(counts.get(neighbor)||0)+1);}
      let replacement=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];if(!replacement||replacement===zone)replacement=zone===ZONES.WILD?ZONES.GROUND:ZONES.PLAZA;
      for(const [gx,gy] of group)if(zones[gy][gx]!==replacement){zones[gy][gx]=replacement;changed=true;}
     }
    }
    if(!changed)break;
   }
   // A pocket enclosed by cliff cells has no natural neighbour to inherit.
   // Keep it paved rather than leaving a one-cell visual island.
   for(const zone of cleanable){const mask=new Set();for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++)if(zones[y]?.[x]===zone)mask.add(cellKey(x,y));const seen=new Set();for(const start of mask){if(seen.has(start))continue;const [sx,sy]=start.split(',').map(Number),group=component(mask,width,height,[sx,sy]);for(const [gx,gy] of group)seen.add(cellKey(gx,gy));if(group.length<12)for(const [gx,gy] of group)zones[gy][gx]=ZONES.PLAZA;}}
   return zones;
  }
  function zoneModel(map,a,points=[],options={}){
    const width=a?.[0]?.length||WIDTH,height=a?.length||HEIGHT,network=roadNetwork(map,a,points,options.extraEndpoints||[],!!options.includeActors),roadCells=network.renderCells,plazas=plazaCells(map,a,points,options);
    if(options.carveRoads)for(const k of roadCells){const [x,y]=k.split(',').map(Number);if(x>0&&x<width-1&&y>0&&y<height-1)a[y][x]=0;}
    const zones=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>{const k=cellKey(x,y),tile=a[y]?.[x];if(tile===1)return ZONES.WALL;if(roadCells.has(k))return ZONES.ROAD;if(plazas.has(k))return ZONES.PLAZA;if(tile===3)return ZONES.LIQUID;if(tile===2)return ZONES.WILD;const shore=DIRECTIONS.some(([dx,dy])=>a[y+dy]?.[x+dx]===3);if(shore)return ZONES.SHORE;return ZONES.GROUND;}));
    cleanZoneComponents(zones,width,height);const orientations=zones.map((row,y)=>row.map((zone,x)=>zone===ZONES.ROAD?zoneOrientation(zones,x,y):null));const counts={};for(const row of zones)for(const zone of row)counts[zone]=(counts[zone]||0)+1;
    return {zones,roadCells,plazaCells:plazas,routes:network.routes,endpoints:network.endpoints,orientations,stats:counts};
  }
   function connectMap(a,points,seedValue,layout={}){
    const width=a?.[0]?.length||WIDTH,height=a?.length||HEIGHT,spawn=layout?.spawn||SPAWN;
     if(layout?.kind==='lair'||layout?.layout==='lair')return a;
    for(let y=spawn.y-4;y<=spawn.y+4;y++)for(let x=spawn.x-4;x<=spawn.x+4;x++)if(x>0&&x<width-1&&y>0&&y<height-1)a[y][x]=0;
    const network=roadNetwork(layout,a,points,[],true),roadCells=network.renderCells;for(const k of roadCells){const [x,y]=k.split(',').map(Number);if(x>0&&x<width-1&&y>0&&y<height-1)a[y][x]=0;}
    const plazas=plazaCells(layout,a,points);for(const k of plazas){const [x,y]=k.split(',').map(Number);if(a[y]?.[x]===2)a[y][x]=0;}
    return normalizeEncounters(a,points,seedValue,spawn,{...layout,reservedCells:new Set([...roadCells,...plazas])});
  }
 function stats(a){let walkableTiles=0,encounterTiles=0;for(const row of a)for(const tile of row){if(walkable(tile)){walkableTiles++;if(tile===2)encounterTiles++;}}return {walkable:walkableTiles,encounters:encounterTiles,ratio:walkableTiles?encounterTiles/walkableTiles:0};}
 function build(map,npcs=[]){
   const a=terrainGrid(map),anchors=pointAnchors(map),blocked=new Set(anchors.map(p=>cellKey(p.x,p.y))),occupied=new Set(blocked),homes=[];
  npcs.forEach((n,index)=>{const home=npcHome(n,index,a,blocked,occupied);occupied.add(cellKey(home.x,home.y));homes.push({x:home.x,y:home.y,type:'npc',id:n.id});});
    const points=anchors.concat(homes);connectMap(a,points,map?.id||'map',map);const zones=zoneModel(map,a,points);return {grid:a,points,anchors,homes,zones:zones.zones,zoneModel:zones};
 }

  g.VTN_MAP_LAYOUTS={WIDTH,HEIGHT,LAIR_WIDTH,LAIR_HEIGHT,REGION_WIDTH,REGION_HEIGHT,SPAWN,ZONES,hash,unit,dimensions,walkable,terrainGrid,pointAnchors,npcHome,routePath,roadNetwork,plazaCells,zoneModel,habitats,connectMap,normalizeEncounters,stats,build,lairAsset,lairGeometry,lairWalkable,lairSpawn,lairWake};
})(typeof window!=='undefined'?window:globalThis);
