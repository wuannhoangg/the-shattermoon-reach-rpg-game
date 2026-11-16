import { WORLD_MAPS } from './maps_landmarks.js';
import { MONSTERS_200 } from './monsters_data.js';
import { RACES_40 } from './races_data.js';
import { NPCS_DATA, KY_NGO_EVENTS } from './npcs_events.js';
import { EQUIPMENT_DB } from './items_classes.js';
export const EVENT_SPECIES = new Set(MONSTERS_200.filter(m=>m.num%20===19).map(m=>m.id));
const sites=[
 ['Lâu Đài Huyết Khuyết','Lâu đài · Quý tộc suy tàn',6,'castle'],
 ['Hầm Mộ Người Giữ Tên','Hầm mộ · Tầng B2',5,'crypt'],
 ['Nghĩa Trang Không Bình Minh','Nghĩa trang · Oán linh',1,'grave'],
 ['Hang Trong Núi Xương','Hang trong núi · Tầng B1',3,'cave'],
 ['Tháp Cao Mười Ba Chuông','Tháp · Tầng 1',6,'tower'],
 ['Đỉnh Tháp Không Bóng','Tháp · Tầng 13',6,'tower'],
 ['Bến Sông Ký Ức','Sông ngòi · Cầu đá',0,'river'],
 ['Hang Dưới Sông Lệ','Hang dưới sông · Tầng B3',2,'cave'],
 ['Thành Phố Rễ Sâu','Thành phố dưới lòng đất',5,'city'],
 ['Thiên Thành Lưu Đày','Thành phố trên không',3,'sky'],
 ['Vực Sâu Không Tiếng','Vực sâu · Tầng B7',9,'abyss'],
 ['Cổng Địa Ngục Muối Đen','Địa ngục · Quỷ dữ',7,'hell'],
 ['Thiên Đàng Tượng Vỡ','Thiên đàng · Thiên thần sa ngã',3,'sky'],
 ['Núi Lửa Tim Tắt','Núi lửa · Dung nham',7,'volcano'],
 ['Băng Nguyên Hóa Thạch','Băng nguyên · Tuyết',3,'snow'],
 ['Núi Băng Gãy Đôi','Núi băng · Hang băng',3,'snow'],
 ['Thung Lũng Gương Câm','Thung lũng gương · Ảo ảnh',8,'mirror'],
 ['Bình Nguyên Mộ Cỏ','Bình nguyên · Đường hành hương',0,'plain'],
 ['Đồi Ma Trơi Tím','Đồi ma trơi · Linh hồn',1,'grave'],
 ['Đồi Xác Chiến Tranh','Đồi xác chết · Tàn tích',1,'grave'],
 ['Vùng Đất Quỷ Khóc','Quỷ dữ · Giáo phái',7,'hell'],
 ['Miền Ô Nhiễm Hắc Dịch','Ô nhiễm · Đầm độc',1,'swamp'],
 ['Làng Bị Ám Tên','Vùng đất bị ám · Nhà hoang',4,'city'],
 ['Vườn Xuân Không Tàn','Mùa xuân · Linh thú',0,'spring'],
 ['Xứ Mười Mùa','Mười mùa · Dị giới',9,'wonder'],
 ['Rạp Xiếc Trăng Méo','Chú hề · Kỳ diệu · Ảo tưởng',9,'circus'],
 ['Biển Băng Sao Chìm','Biển băng · Xác tàu',2,'snow']
];
const regions=[...new Set(MONSTERS_200.map(m=>m.region))];
export function expandWorld(){
 const families=[/hươu|nai |kỳ lân|ngựa/,/chồn|cáo|rái/,/hổ |báo|miêu/,/sói|chó/,/nhện/,/cú |chim |gà |quạ|ưng|hạc/,/bướm|ong|ruồi/,/rết|bọ /,/lợn|heo/,/trâu|bò |dê/,/gấu/,/ếch|cóc/,/rồng|long /,/cá |lươn|mực|sứa/];
 for(const m of MONSTERS_200){
  const family=families.find(f=>f.test(m.name.toLowerCase()));
  if(!m.evolveTo)continue;
  const target=family?MONSTERS_200.find(n=>n.num>m.num&&n.num%20!==0&&!EVENT_SPECIES.has(n.id)&&family.test(n.name.toLowerCase())):null;
  m.evolveTo=target?.id||null;m.evolveLevel=Math.max(10,8+Math.floor(m.num/20)*2);
 }

 // Link the original thirteen maps as a traversable pilgrimage; the old atlas
 // allowed arbitrary teleportation and hid disconnected portal chains.
 const original=[...WORLD_MAPS];
 original.forEach((m,i)=>{const next=original[(i+1)%original.length];m.landmarks.push({name:'???ng H?nh H??ng ? '+next.name,x:28,y:28,type:'portal',targetMap:next.id,tx:8,ty:8});});
 sites.forEach(([name,biome,ri,architecture],i)=>{
  const parent=WORLD_MAPS.find(m=>m.monsterRegion===regions[ri])||WORLD_MAPS[0],id=`map_exp_${i+1}`,x=3+(i%7)*4,y=3+Math.floor(i/7)*6;
  parent.landmarks.push({name:`Lối đến ${name}`,x,y,type:'portal',targetMap:id,tx:16,ty:27});
  const lv=Math.max(2,parent.levelRange[0]+(i%3)*2);
  const palette={...parent.palette};
  if(architecture==='snow')Object.assign(palette,{ground:'#495b65',wild:'#344c59',wildAccent:'#a5c9cd',water:'#233f57',wallTop:'#8dacae'});
  if(architecture==='spring')Object.assign(palette,{ground:'#293a2a',wild:'#2d4730',wildAccent:'#d2afbe',water:'#345e60'});
  if(['hell','volcano'].includes(architecture))Object.assign(palette,{ground:'#32272b',wild:'#3f2228',wildAccent:'#a85843',water:'#8d3c2e',wallTop:'#5b3b38'});
  if(architecture==='sky')Object.assign(palette,{ground:'#4a5054',wild:'#414d56',wildAccent:'#d6cda4',water:'#567286',wallTop:'#b1b9ae'});
  WORLD_MAPS.push({id,name:`${14+i}. ${name}`,biomeTag:biome,architecture,monsterRegion:regions[ri],levelRange:[lv,lv+6],dangerRate:.20,banditChance:.07,anomalyChance:.08,palette,landmarks:[
   {name:`Trở về ${parent.name.split(':')[0]}`,x:16,y:29,type:'portal',targetMap:parent.id,tx:x,ty:y+1},
   {name:'Đài Lửa Lữ Hành',x:16,y:25,type:'shrine'},
   {name:'Thương Nhân Khế Ước',x:9,y:17,type:'shop'},
   {name:'Di Tích Niêm Phong',x:23,y:7,type:'boss_altar',bossCode:MONSTERS_200[ri*20+19].id}
  ]});
 });
 WORLD_MAPS.forEach((map,i)=>{
  const race=RACES_40[i%40],rare=MONSTERS_200.find(m=>m.region===map.monsterRegion&&EVENT_SPECIES.has(m.id))||MONSTERS_200[18];
  NPCS_DATA.push({id:`keeper_${i}`,mapId:map.id,x:18,y:18,name:['Người Giữ Đèn','Kẻ Chép Tên','Thợ Khâu Bóng','Người Canh Mộ','Nhạc Công Câm'][i%5]+' '+race.name.split(' ').slice(-1),raceCode:race.code,raceName:race.name,personality:['Dịu dàng nhưng đa nghi','Tham vọng, giữ chữ tín','Kiêu hãnh và cô độc','Thực dụng, sợ lãng quên','Nhân hậu, che giấu tội lỗi'][i%5],color:race.cloakColor,duelSquad:MONSTERS_200.filter(m=>m.region===map.monsterRegion).slice(1,3).map(m=>m.id),duelLevel:map.levelRange[0]+2,
   greeting:`${map.name.split('. ').slice(1).join('. ')} vẫn giữ món nợ từ đêm Trăng Vỡ. ${race.questHook.split('.')[0]}. Một khế thú ${rare.name} đang canh giữ ký ức ấy. Ngươi sẽ cứu người đang sống hay lấy quyền lực của người chết?`,
   choices:[
    {label:'Giữ lời hứa: dành 80 tro vàng giúp cư dân (Thiện cảm +2)',costGold:80,reputation:2,branch:'mercy',outcomeText:'Ngọn đèn được thắp lại. Cư dân ghi nhớ lòng tốt; linh thú hiếm chấp nhận thử thách ngươi.',reward:{expPlayer:90,hearts:1},rareSpecies:rare.id},
    {label:'[INT ≥ 14] Giải khế cổ, chia sẻ tri thức (Thiện cảm +1)',reqStat:{stat:'INT',min:14},reputation:1,branch:'knowledge',outcomeText:'Ngươi tìm được tên thật trong cổ ngữ. Bí mật được trả lại cho người giữ đèn.',reward:{gold:150,silverSeals:2},rareSpecies:rare.id},
    {label:'Chiếm di vật: nhận 300 tro vàng (Thiện cảm −2)',reputation:-2,branch:'power',outcomeText:'Ngọn đèn tắt. Ngươi có được di vật, nhưng người canh mộ không còn tin ngươi.',reward:{gold:300,expPlayer:60}},
    {label:'Khiêu chiến người giữ di tích',isDuel:true,outcomeText:'Lời hứa phải được chứng minh bằng sức mạnh.'}
   ]});
 });
 for(let i=0;i<10;i++){
  const sp=MONSTERS_200[i*20+18];
  KY_NGO_EVENTS.push({id:`event_${i}`,title:`KỲ NGỘ · ${sp.region}`,desc:sp.questHook,choices:[
   {label:`Lần theo dấu vết ${sp.name} (khế thú sự kiện)`,rareSpecies:sp.id,spawnRareTier:Math.max(4,sp.defaultTier),resultText:sp.appearance.split('.')[0]},
   {label:'Giúp người lạc đường, nhận trái tim và kinh nghiệm',reward:{hearts:1,expPlayer:120},resultText:'Một lời hứa mới giúp linh hồn ngươi tìm lại hơi ấm.'}
  ]});
 }
 const names=['Thương Gác Mộ','Song Đao Tro Trắng','Trượng Nhện Câm','Nỏ Gương Vỡ','Chùy Khắc Tội','Kiếm Nguyệt Thực','Giáp Nghĩa Binh','Áo Lụa Ma Trơi','Giáp Long Cốt','Pháp Bào Mười Mùa','Ấn Thiên Thành','Vương Miện Mộ Sâu','Đèn Dẫn Hồn','Nhẫn Giao Ước','Mặt Dây Cổ Thần','Giáp Băng Vĩnh Cửu','Lưỡi Hái Bình Minh','Vương Trượng Không Tên','Khiên Tượng Vỡ','Đại Đao Dung Nham'];
 names.forEach((name,i)=>{const slot=i<6||i===16||i===17||i===19?'weapon':i<10||i===15||i===18?'armor':'relic',stat=['STR','DEX','INT','WIS','CON','CHA'][i%6];EQUIPMENT_DB.push({id:`eq_exp_${i}`,name,slot,rarity:['Rare','Elite','Super Rare','Epic','Mythical','Legend'][i%6],scaleStat:stat,power:22+i*2,defBonus:16+i,hpBonus:50+i*8,bonuses:{[stat]:5+i%8,SPD:i%3===0?-3:2},price:280+i*65,desc:`Di vật ${regions[i%10].toLowerCase()}. Sức mạnh theo ${stat}; ${i%3===0?'nặng: −3 SPD':'nhẹ: +2 SPD'}.`});});
}
export const QUESTS=[
 {id:'first_bond',title:'01 · Khế ước đầu tiên',desc:'Thu phục thêm một loài khế thú ngoài người bạn khởi đầu.',type:'capture',target:2,reward:180},
 {id:'wanderer',title:'02 · Bên kia Thánh Điện',desc:'Đặt chân đến ba vùng đất khác nhau.',type:'explore',target:3,reward:250},
 {id:'hunter',title:'03 · Giữ lửa qua đêm',desc:'Chiến thắng năm trận giao tranh.',type:'win',target:5,reward:350},
 {id:'rare',title:'04 · Người trong truyền thuyết',desc:'Gặp một khế thú dành riêng cho sự kiện, rồi lập khế thành công.',type:'rare',target:1,reward:550},
 {id:'pilgrim',title:'05 · Người vá bản đồ',desc:'Khám phá mười vùng đất, từ hang sâu tới thành trên không.',type:'explore',target:10,reward:800},
 {id:'archive',title:'06 · Người giữ sinh linh',desc:'Sưu tầm hai mươi loài khế thú.',type:'capture',target:20,reward:1000},
 {id:'moon',title:'07 · Những mảnh Trăng Vỡ',desc:'Đánh bại hoặc lập khế với mười trùm sinh thái khác nhau, rồi quyết định số phận Vực Tàn Nguyệt.',type:'boss',target:10,reward:2000}
];
