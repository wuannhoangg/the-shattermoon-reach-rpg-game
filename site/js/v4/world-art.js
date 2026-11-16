(function(){
// Native canvas pixel scenery. All art is bundled as source code.
function drawWorldTile(c,x,y,t,m,tick,gx,gy){
 const p=m.palette,seed=(gx*73+gy*37)%97;
 c.fillStyle=t===1?p.wall:t===3?p.water:t===2?p.wild:p.ground;c.fillRect(x,y,32,32);
 const rect=(a,b,w,h,col)=>{c.fillStyle=col;c.fillRect(x+a,y+b,w,h);};
 if(t===0){rect(0,0,32,1,'#ffffff06');for(let i=0;i<3;i++)rect((seed+i*11)%30,(seed*3+i*13)%30,2,1,'#afad8d18');}
 if(t===3){for(let i=0;i<3;i++)rect((gx*3+i*9+Math.floor(tick/15))%28,5+i*9,7,1,'#a8d6d426');if(m.architecture==='volcano'||m.architecture==='hell'){rect(4,4,20,3,'#e77b4255');rect(9,19,13,2,'#f4b45366');}}
 if(t===2){
  rect(2,29,28,3,'#00000028');
  for(let i=0;i<5;i++){const a=(seed+i*7)%27,b=8+(seed+i*9)%20;rect(a,b,2,5,p.wildAccent);rect(a-2,b+2,2,2,p.wildAccent);}
  if(seed%7===0){rect(23,22,2,6,'#c6b995');rect(20,20,8,3,m.architecture==='snow'?'#c2dae0':'#a47c64');}
  if(seed%5===0){rect(4,0,5,16,'#302b27');rect(0,-10,18,20,'#152a24');rect(2,-9,14,8,p.wildAccent+'66');rect(-2,-1,24,9,'#1b3427');rect(5,0,5,2,'#516447');}
 }
 if(t===1){rect(1,2,30,21,p.wallTop);for(let i=0;i<3;i++){rect(2,6+i*7,28,1,'#00000044');rect((i%2)*10+10,2+i*7,1,7,'#00000044');}rect(2,2,28,2,'#ffffff12');}
}
function drawLandmark(c,x,y,l,m,tick){
 const r=(a,b,w,h,col)=>{c.fillStyle=col;c.fillRect(x+a,y+b,w,h);};
 r(-14,25,60,6,'#00000055');

 const t=tick||0,pulse=.5+.5*Math.sin(t/9);
 const glow=(cx,cy,rad,col,al)=>{const gr=c.createRadialGradient(cx,cy,2,cx,cy,rad);gr.addColorStop(0,col.replace('A',al));gr.addColorStop(1,col.replace('A',0));c.fillStyle=gr;c.beginPath();c.arc(cx,cy,rad,0,7);c.fill();};
 if(l.type==='clue'){
  /* carved lectern with a floating open book and orbiting motes */
  r(-4,24,40,5,'#14101a');r(0,19,32,7,'#3b3541');r(2,19,28,2,'#5f5868');r(5,10,22,10,'#2d2933');r(6,10,3,10,'#4a4452');r(23,10,3,10,'#1e1b23');
  r(3,6,26,5,'#4c4656');r(3,6,26,1,'#7d7588');r(3,10,26,1,'#1a171e');
  r(9,13,3,5,'#8f7aa3');r(20,13,3,5,'#8f7aa3');r(14,12,4,7,'#b79fd0');
  const bob=Math.round(Math.sin(t/14)*2);
  glow(x+16,y-6+bob,34,'rgba(232,196,120,A)',.20+pulse*.14);
  const by=-14+bob;
  r(2,by+8,28,3,'#4b2f26');r(3,by+7,26,1,'#6a4233');
  r(4,by+1,12,8,'#efe2c3');r(16,by+1,12,8,'#e4d5b2');r(4,by,12,1,'#fff4d6');r(16,by,12,1,'#f4e6c3');
  r(15,by,2,10,'#5a3a2c');r(4,by+8,12,1,'#bfae88');r(16,by+8,12,1,'#b3a27c');
  for(let i=0;i<4;i++){r(6,by+2+i*2,8,1,'#b9a77d');r(18,by+2+i*2,8,1,'#a89669');}
  r(9,by+2,2,1,'#c9852f');r(21,by+4,2,1,'#6f5aa8');
  for(let i=0;i<4;i++){const ang=t/18+i*1.57,mx=16+Math.cos(ang)*(15+i),my=by-2+Math.sin(ang*1.3)*8;c.fillStyle=i%2?'#ffe9a8':'#d2b8ff';c.fillRect(x+Math.round(mx),y+Math.round(my),2,2);}
 }else if(l.type==='rune'){
  /* upright rune stone that cycles through glowing sigils */
  r(-2,24,36,5,'#14101a');r(4,22,24,5,'#3b3541');
  r(8,-14,16,38,'#34303b');r(10,-18,12,6,'#3f3a47');r(12,-21,8,4,'#4a4553');r(8,-14,2,38,'#524c5d');r(22,-14,2,38,'#221f27');
  const hue=['#8f7aa3','#7aa39a','#c9a363','#c77472'][Math.floor(t/60)%4];
  glow(x+16,y+4,30,'rgba(160,140,210,A)',.14+pulse*.12);
  r(14,-8,4,18,hue);r(10,-2,12,3,hue);r(12,-12,8,2,hue);r(13,14,6,2,hue);
  c.fillStyle='#ffffff';c.globalAlpha=.35+pulse*.4;c.fillRect(x+15,y-6,2,2);c.globalAlpha=1;
 }else if(l.type==='shrine'){
  /* stone fire bowl: layered flame, embers and a warm glow */
  r(-4,24,40,5,'#14101a');r(2,20,28,6,'#3f3a33');r(2,20,28,1,'#6a6455');r(6,14,20,7,'#2b2823');r(7,14,3,7,'#4c473d');r(22,14,3,7,'#1b1914');
  r(4,9,24,6,'#4d473d');r(4,9,24,1,'#8a8270');r(6,12,20,3,'#1d1a15');
  r(8,15,16,2,'#7a3a22');
  glow(x+16,y+2,44,'rgba(240,160,70,A)',.22+pulse*.12);
  const f=Math.floor(t/5)%3,h=15+f*2;
  r(11,9-h,10,h,'#b7421f');r(12,9-h-2,8,h,'#e17a2c');r(14,9-h+2,5,h-4,'#f6b94a');r(15,9-h+6,3,h-8,'#fff0b0');r(14+f%2,9-h-4,3,4,'#e17a2c');
  for(let i=0;i<3;i++){const ey=(Math.floor(t/3)+i*13)%30;c.fillStyle='#ffd37a';c.globalAlpha=1-ey/30;c.fillRect(x+10+i*6+(i%2?1:-1)*Math.round(Math.sin(t/7+i)*3),y+6-ey,1,1);c.globalAlpha=1;}
 }else if(l.type==='shop'){
  r(-16,-14,64,39,'#383933');r(-21,-18,74,7,'#6e4f48');r(-15,-25,62,8,'#82584a');r(-9,-31,50,7,'#704b43');r(6,5,12,20,'#151f1b');r(-8,-6,12,13,'#d2ad65');r(25,-6,12,13,'#d2ad65');r(8,-5,9,2,'#ddc994');r(44,-29,4,22,'#5c5750');
 }else if(l.type==='boss_altar'){
  r(-18,19,68,9,'#514451');r(-13,14,58,6,'#72666a');r(-4,-28,9,42,'#48404a');r(29,-28,9,42,'#48404a');r(-8,-31,17,5,'#897779');r(25,-31,17,5,'#897779');r(9,0,15,14,'#442d3c');r(12,-3,9,7,'#af5969');r(15,-11,3,12,'#f2b3a0');
 }else{
  const a=m.architecture||m.biomeTag;
  if(/castle|tower|city|Lâu Đài|Tháp|Đô Thành/.test(a)){
   for(const dx of [-25,43]){r(dx,-35,15,60,'#424b42');r(dx-3,-39,21,7,'#72806b');for(let i=0;i<3;i++)r(dx-3+i*8,-46,5,8,'#72806b');r(dx+5,-26,4,8,'#c9a363');r(dx+5,-10,4,8,'#282e26');}
   r(-12,-24,56,7,'#616b58');
  }
  if(/grave|crypt|Nghĩa|Hầm Mộ/.test(a))for(const dx of [-25,48]){r(dx,12,12,14,'#7e8170');r(dx+2,8,8,5,'#939483');r(dx+5,12,2,9,'#343e36');r(dx+2,15,8,2,'#343e36');}
  if(/snow|Băng|Tuyết/.test(a)){for(const dx of [-24,46]){r(dx,5,10,22,'#416779');r(dx+2,-3,6,26,'#a8d0d3');r(dx+4,-9,3,20,'#d2e2dc');}}
  if(/sky|Thiên Đàng|Trên Không/.test(a)){r(-24,28,80,6,'#b8b394');r(-17,34,65,5,'#737d74');r(-8,39,45,6,'#52645f');r(0,45,30,5,'#3c514c');}
  if(/circus|wonder|Xiếc|10 Mùa/.test(a)){for(let i=0;i<5;i++)r(-18+i*14,-28+Math.abs(2-i)*6,14,28-Math.abs(2-i)*6,i%2?'#866c87':'#897448');r(-22,-4,77,5,'#c2aa79');}

  const col=/雪|snow|sky/.test(a)?'#aab9b2':'#555c51';
  r(-13,0,10,27,col);r(34,0,10,27,col);r(-7,-10,45,12,col);r(0,-18,32,10,col);r(7,-23,18,6,col);r(0,-3,32,28,'#152923');r(6,1,20,24,'#1b3b39');r(13,4,7,19,'#7cb4a988');r(-16,25,62,5,'#8a8971');
  for(let i=0;i<3;i++)r(8+(i*7+Math.floor(tick/20))%17,8+i*5,2,2,'#b9ddc4');
 }
}
function drawAtmosphere(c,canvas,s,m){
 const grad=c.createRadialGradient(canvas.width/2,canvas.height/2,100,canvas.width/2,canvas.height/2,canvas.width*.65);grad.addColorStop(0,'#07121000');grad.addColorStop(1,'#030a0ade');c.fillStyle=grad;c.fillRect(0,0,canvas.width,canvas.height);
 for(let i=0;i<35;i++){const x=(i*131+s.tick*.16)%canvas.width,y=(i*73+Math.sin(s.tick/120+i)*14)%canvas.height;c.fillStyle=i%3?'#d6d7ba30':'#a7d9ad88';c.fillRect(x,y,2,2);}
 // Inset minimap: visited roads, landmarks and current location.
 if(canvas.width<500){c.font="10px Segoe UI";c.fillStyle="#e0d6b5";c.fillText("Di chuyển bằng phím mũi tên bên dưới",14,canvas.height-15);return;}
 const ox=canvas.width-122,oy=20;c.fillStyle='#101b18e6';c.fillRect(ox-8,oy-8,112,112);c.strokeStyle='#8c8156';c.strokeRect(ox-8,oy-8,112,112);
 const grid=s.mapTiles[m.id];if(grid)for(let y=0;y<32;y++)for(let x=0;x<32;x++){c.fillStyle=grid[y][x]===3?'#305664':grid[y][x]===2?'#314333':grid[y][x]===1?'#17231c':'#5b5c42';c.fillRect(ox+x*3,oy+y*3,3,3);}
 for(const l of m.landmarks){c.fillStyle=l.type==='portal'?'#8cc5b6':l.type==='boss_altar'?'#c77472':'#e4c786';c.fillRect(ox+l.x*3,oy+l.y*3,3,3);}c.fillStyle='#fff3bc';c.fillRect(ox+s.px*3-1,oy+s.py*3-1,5,5);
 c.font='12px Segoe UI';c.fillStyle='#e0d6b5';c.fillText('WASD  Di chuyển     E / Enter  Tương tác',22,canvas.height-20);
}

window.VTNWorld={tile:drawWorldTile,landmark:drawLandmark};})();