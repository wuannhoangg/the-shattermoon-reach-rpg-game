// Pixel concepts use anatomy, element and a stable species seed. No external assets.
const palettes={MỘC:['#18251d','#354733','#68754c','#b5b88b','#e9dcb3'],TRO:['#291b1e','#633739','#a65941','#df9b58','#ffe0a0'],THỦY:['#122b34','#285568','#498a91','#92c6bd','#e2f5d0'],THẠCH:['#292630','#514957','#8d7e79','#c0ab89','#f1ddb6'],BĂNG:['#172c40','#355c78','#71a5b1','#b0d9dc','#f2f4df'],TỬ:['#251e35','#50405d','#867092','#bea8bc','#efe0ce'],HUYẾT:['#2c1824','#643041','#a64c55','#ce8b80','#f6dfbe'],'HƯ VÔ':['#201e3c','#49406b','#80608a','#bba0bb','#f4dab9']};
export function drawConcept(canvas,m,scale=4){
 if(!canvas||!m)return;
 const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.imageSmoothingEnabled=false;
 const p=palettes[m.element]||palettes.TRO, s=m.num||1;
 const k=Math.min(canvas.width,canvas.height)/48,ox=(canvas.width-48*k)/2,oy=(canvas.height-48*k)/2;
 c.save();c.translate(ox,oy);c.scale(k,k);
 const r=(x,y,w,h,col)=>{c.fillStyle=typeof col==='number'?p[col]:col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
 const line=(x,y,xx,yy,col)=>{const n=Math.max(Math.abs(xx-x),Math.abs(yy-y));for(let i=0;i<=n;i++)r(x+(xx-x)*i/n,y+(yy-y)*i/n,1,1,col);};
 r(8,41,32,2,'#00000050');
 const name=m.name.toLowerCase(),cat=m.category||'';
 const dragon=/rồng|long |sừng gãy/.test(name),bird=/ĐIỂU|CÔN TRÙNG/.test(cat)||/cú |chim |bướm |gà /.test(name),spider=/CHÂN KHỚP|VÔ XƯƠNG|GIÁP XÁC/.test(cat),ghost=/LINH THỂ/.test(cat)||m.archetype==='eldritch';
 if(dragon){
  for(let i=0;i<13;i++){r(4+i,12+i/2,2,18-i,1);r(42-i,12+i/2,2,18-i,1);}line(4,12,18,26,3);line(43,12,30,26,3);
  r(18,21,13,15,2);r(22,12,11,12,2);r(26,16,12,7,3);r(28,17,2,2,4);line(22,13,19,5,4);line(30,12,34,6,4);r(17,35,5,7,1);r(28,35,5,7,1);line(19,32,7,37,2);line(7,37,3,30,3);
 }else if(spider){
  for(let i=0;i<4;i++){line(20,24+i*2,8-i,13+i*7,2);line(8-i,13+i*7,4,19+i*6,3);line(29,24+i*2,39+i,13+i*7,2);line(39+i,13+i*7,44,19+i*6,3);}
  r(16,20,18,12,1);r(19,18,12,14,2);r(21,30,8,7,3);r(21,32,2,2,4);r(27,32,2,2,4);line(24,18,24,6,'#c7bba0');r(22,14,5,4,3);
 }else if(bird){
  const moth=/bướm|CÔN TRÙNG/.test(name+' '+cat);
  for(let i=0;i<14;i++){r(4+i,16+i/3,2,17-i/2,2);r(42-i,16+i/3,2,17-i/2,2);}
  r(20,19,10,16,1);r(22,15,9,10,3);r(20,13,2,6,2);r(30,13,2,6,2);r(24,18,2,2,4);r(29,18,2,2,4);r(27,22,3,3,'#c79d62');line(23,35,21,40,3);line(28,35,30,40,3);
  if(moth){r(10,22,5,5,4);r(34,22,5,5,4);}
 }else if(ghost){
  for(let y=13;y<38;y++)r(23-(y-13)*.42,y,5+(y-13)*.84,1,y%4===0?1:2);
  r(19,10,12,13,3);r(21,15,3,3,0);r(27,15,3,3,0);r(24,20,3,4,0);line(17,24,7,30,3);line(32,24,41,30,3);
  for(let i=0;i<4;i++)line(13+i*7,36,10+i*8,42-i%2*3,2);
 }else{
  const deer=/hươu|nai |trâu|dê |ngựa|kỳ lân/.test(name),small=/chồn|cáo|miêu|chuột|rái/.test(name),fish=/THỦY|LƯỠNG/.test(cat)&&!deer;
  r(11,24,24,11,1);r(12,23,21,9,2);r(14,24,16,4,3);
  if(fish){line(11,26,3,19,3);line(3,19,3,37,2);line(3,37,11,31,3);r(32,23,8,10,2);r(35,25,2,2,4);line(20,23,23,16,3);}
  else{
   const leg=deer?12:7;for(const x of [13,18,28,32]){r(x,32,3,leg,1);r(x,32+leg-2,4,2,3);}
   r(28,15,deer?5:8,15,2);r(27,12,12,9,3);r(35,16,2,2,deer?'#b53839':4);r(37,19,5,3,2);
   if(deer){for(const x of [29,36]){line(x,14,x-2,3,4);line(x-1,8,x-7,4,3);line(x-2,5,x+2,1,3);}line(31,13,35,21,'#7b3035');for(let i=0;i<3;i++)line(31,15+i*2,35,16+i*2,'#4a202c');}
   else{r(28,8,3,6,1);r(36,9,3,5,1);line(11,26,5,small?17:23,2);line(5,small?17:23,4,29,3);}
   if(small){r(19,27,8,6,'#81c9ad');r(21,28,3,4,'#e0f4bf');line(8,29,3,36,3);line(8,29,2,32,2);}
  }
 }
 // Unique scars, fungus, rune halo and highlights, stable across all views.
 for(let i=0;i<7;i++){const x=13+(s*7+i*11)%21,y=23+(s*3+i*7)%9;r(x,y,1+(s+i)%2,1,(s+i)%4);}
 if(s%5===0||m.threat>=4){for(let i=0;i<13;i++){const a=i*Math.PI*2/13;r(24+Math.cos(a)*18,23+Math.sin(a)*18,1,1,3);}}
 c.restore();
}
export function anatomyLabel(m){return `${m.category.toLowerCase()} · ${m.element.toLowerCase()} · dị thể ${String(m.num).padStart(3,'0')}`;}
