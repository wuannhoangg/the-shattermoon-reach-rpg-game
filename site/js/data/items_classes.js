// Hệ thống 10 Thứ Bậc Quái Vật, 8 Tính Cách Cá Thể, 8 Class Nhân Vật, Vũ Khí, Áo Giáp, Cổ Vật & Vật Phẩm

export const MONSTER_TIERS = [
  { id: 0, code: 'T-01', name: 'Normal', en: 'NORMAL', vi: 'Phàm Thể', growthMult: 1.00, color: '#8f8b99', border: '#4e4b57' },
  { id: 1, code: 'T-02', name: 'Uncommon', en: 'UNCOMMON', vi: 'Dị Biến', growthMult: 1.12, color: '#69db7c', border: '#2f6e3b' },
  { id: 2, code: 'T-03', name: 'Rare', en: 'RARE', vi: 'Hiếm Có', growthMult: 1.26, color: '#4dabf7', border: '#23598a' },
  { id: 3, code: 'T-04', name: 'Elite', en: 'ELITE', vi: 'Tinh Anh', growthMult: 1.42, color: '#3bc9db', border: '#1d6b75' },
  { id: 4, code: 'T-05', name: 'Super Rare', en: 'SUPER RARE', vi: 'Siêu Hiếm', growthMult: 1.60, color: '#b197fc', border: '#573b9e' },
  { id: 5, code: 'T-06', name: 'Special Super Rare', en: 'SSR', vi: 'Đặc Biệt Siêu Hiếm', growthMult: 1.80, color: '#e599f7', border: '#862e9c' },
  { id: 6, code: 'T-07', name: 'Epic', en: 'EPIC', vi: 'Sử Thi', growthMult: 2.02, color: '#ffa94d', border: '#a65614' },
  { id: 7, code: 'T-08', name: 'Mythical', en: 'MYTHICAL', vi: 'Thần Thoại', growthMult: 2.28, color: '#ff6b6b', border: '#9e232b' },
  { id: 8, code: 'T-09', name: 'Legend', en: 'LEGEND', vi: 'Truyền Kỳ', growthMult: 2.56, color: '#ffd43b', border: '#b58919' },
  { id: 9, code: 'T-10', name: 'Extraordinary', en: 'EXTRAORDINARY', vi: 'Siêu Việt Cổ Thần', growthMult: 2.90, color: '#ff4d94', border: '#c2185b' }
];

export const IV_RANKS = [
  { rank: 'D', mult: 0.86, label: 'Tạp Chất (D)' },
  { rank: 'C', mult: 0.95, label: 'Bình Thường (C)' },
  { rank: 'B', mult: 1.05, label: 'Ưu Tú (B)' },
  { rank: 'A', mult: 1.16, label: 'Kiệt Xuất (A)' },
  { rank: 'S', mult: 1.28, label: 'Thiên Phú (S)' },
  { rank: 'SS', mult: 1.42, label: 'Tuyệt Thế (SS)' }
];

export const MONSTER_PERSONALITIES = [
  { id: 'slothful', name: 'Lười Biếng', atk: 1.0, def: 1.0, mag: 1.0, spd: 0.82, hp: 1.05, expMult: 0.85, growthBonus: 0.10, desc: 'Tiềm lực trưởng thành +10%, nhưng lười vận động (-18% SPD, -15% EXP).' },
  { id: 'ferocious', name: 'Hung Hãn', atk: 1.18, def: 0.88, mag: 1.05, spd: 1.05, hp: 1.0, expMult: 1.0, growthBonus: 0.0, desc: '+18% ATK, +5% SPD nhưng lơ là phòng thủ (-12% DEF).' },
  { id: 'stoic', name: 'Kiên Cố', atk: 0.95, def: 1.20, mag: 1.0, spd: 0.88, hp: 1.12, expMult: 1.0, growthBonus: 0.0, desc: '+20% DEF, +12% HP, chậm chạp hơn (-12% SPD).' },
  { id: 'malevolent', name: 'Tà Ác', atk: 0.92, def: 0.95, mag: 1.20, spd: 1.05, hp: 0.96, expMult: 1.05, growthBonus: 0.0, desc: '+20% Ma Công, +5% EXP nhưng thể chất mỏng (-8% ATK).' },
  { id: 'skittish', name: 'Nhanh Nhẹn', atk: 0.95, def: 0.92, mag: 1.0, spd: 1.22, hp: 0.90, expMult: 1.0, growthBonus: 0.0, desc: '+22% SPD vượt trội nhưng sinh lực thấp (-10% HP).' },
  { id: 'covetous', name: 'Tham Lam', atk: 0.92, def: 0.95, mag: 1.0, spd: 1.05, hp: 1.0, expMult: 1.12, growthBonus: 0.0, desc: '+35% tỷ lệ rơi vật phẩm hiếm & vàng, -8% ATK.' },
  { id: 'devoted', name: 'Trung Thành', atk: 1.05, def: 1.12, mag: 1.05, spd: 0.94, hp: 1.10, expMult: 1.08, growthBonus: 0.04, desc: '+12% DEF, +10% HP, +8% EXP đồng hành cùng chủ nhân.' },
  { id: 'balanced', name: 'Cân Bằng', atk: 1.02, def: 1.02, mag: 1.02, spd: 1.02, hp: 1.02, expMult: 1.0, growthBonus: 0.0, desc: 'Phát triển hài hòa mọi chỉ số không có điểm trừ.' }
];

export const ELEMENTS = {
  TRO:    { label: 'Hỏa Tro', color: '#e85d35', strong: ['MỘC', 'BĂNG', 'TỬ'] },
  MỘC:    { label: 'Mộc Nguyền', color: '#5ca365', strong: ['THỦY', 'THẠCH'] },
  THỦY:   { label: 'Thủy Triều', color: '#4dabf7', strong: ['TRO', 'THẠCH'] },
  THẠCH:  { label: 'Thạch Cốt', color: '#b59d79', strong: ['TRO', 'BĂNG', 'HƯ VÔ'] },
  BĂNG:   { label: 'Băng Nguyên', color: '#74c0fc', strong: ['MỘC', 'THỦY'] },
  TỬ:     { label: 'Tử Linh', color: '#9c78e8', strong: ['HUYẾT', 'HƯ VÔ'] },
  HUYẾT:  { label: 'Huyết Quỷ', color: '#d43540', strong: ['MỘC', 'THỦY'] },
  'HƯ VÔ':{ label: 'Hư Vô Cổ Thần', color: '#f72585', strong: ['TỬ', 'TRO', 'HUYẾT'] }
};

export function getElementMultiplier(atkElem, defElem) {
  const e = ELEMENTS[atkElem];
  if (!e) return 1.0;
  if (e.strong.includes(defElem)) return 1.45;
  const d = ELEMENTS[defElem];
  if (d && d.strong.includes(atkElem)) return 0.72;
  return 1.0;
}

export const PLAYER_CLASSES = [
  {
    id: 'covenant_knight',
    name: 'Kỵ Sĩ Khắc Ước',
    favoredStats: ['STR', 'CON', 'DEF'],
    baseStats: { STR: 14, CON: 14, DEF: 13, SPD: 8, DEX: 9, INT: 7, WIS: 9, CHA: 10 },
    desc: 'Vệ binh mặc giáp sắt khắc lời thề. Càng tăng STR, CON, DEF càng bất khả xâm phạm, nhưng cần chú ý SPD để không bị đánh sau.',
    skills: [
      { id: 'oath_cleave', name: 'Trảm Khắc Lời Thề', mpCost: 10, scaleStat: 'STR', mult: 1.65, elem: 'THẠCH', desc: 'Chém mạnh dựa trên STR + DEF.' },
      { id: 'salt_bulwark', name: 'Tường Muối Hộ Mệnh', mpCost: 12, scaleStat: 'CON', mult: 1.2, elem: 'THỦY', healRatio: 0.28, desc: 'Hồi HP bản thân theo CON & tạo khiên muối.' }
    ]
  },
  {
    id: 'ash_stalker',
    name: 'Thợ Săn Tro Tàn',
    favoredStats: ['DEX', 'SPD'],
    baseStats: { STR: 10, CON: 10, DEF: 9, SPD: 15, DEX: 15, INT: 8, WIS: 9, CHA: 8 },
    desc: 'Sát thủ bóng tối chuyên dùng cung xương & song đao. Lợi thế lớn ở DEX và SPD giúp tăng xác suất ra đòn trước và chí mạng.',
    skills: [
      { id: 'shadow_volley', name: 'Mưa Tên Tro Đen', mpCost: 10, scaleStat: 'DEX', mult: 1.7, elem: 'TRO', desc: 'Xuyên giáp đối thủ dựa trên DEX + SPD.' },
      { id: 'phantom_step', name: 'Ảnh Bộ Đoạt Mệnh', mpCost: 14, scaleStat: 'SPD', mult: 1.85, elem: 'TỬ', desc: 'Đòn chớp nhoáng tỷ lệ chí mạng cực cao.' }
    ]
  },
  {
    id: 'blood_weaver',
    name: 'Pháp Sư Huyết Nguyệt',
    favoredStats: ['INT', 'WIS'],
    baseStats: { STR: 6, CON: 9, DEF: 8, SPD: 11, DEX: 9, INT: 16, WIS: 14, CHA: 11 },
    desc: 'Kẻ thi triển cấm thuật theo Luật Huyết. Sát thương phép bùng nổ theo INT và hồi MP/kháng phép theo WIS.',
    skills: [
      { id: 'crimson_nova', name: 'Huyết Nguyệt Bùng Nổ', mpCost: 14, scaleStat: 'INT', mult: 1.9, elem: 'HUYẾT', desc: 'Hắc pháp hủy diệt diện rộng theo INT.' },
      { id: 'soul_siphon', name: 'Hút Hồn Dưỡng Mệnh', mpCost: 12, scaleStat: 'WIS', mult: 1.45, elem: 'TỬ', healRatio: 0.25, desc: 'Gây sát thương Tử Linh và hút HP về cho bản thân.' }
    ]
  },
  {
    id: 'necro_binder',
    name: 'Triệu Hồi Sư Vong Hồn',
    favoredStats: ['CHA', 'WIS', 'INT'],
    baseStats: { STR: 7, CON: 10, DEF: 9, SPD: 10, DEX: 9, INT: 13, WIS: 13, CHA: 16 },
    desc: 'Bậc thầy Khế Ấn điều khiển linh hồn. CHA cao tăng mạnh tỷ lệ thu phục quái vật hiếm và mở khóa đối thoại bí mật.',
    skills: [
      { id: 'abyss_command', name: 'Hiệu Lệnh Vực Thẳm', mpCost: 12, scaleStat: 'CHA', mult: 1.6, elem: 'HƯ VÔ', desc: 'Đòn tâm linh uy hiếp khiến quái dễ bị Khế Ấn hơn.' },
      { id: 'spirit_mend', name: 'Khế Ước Cộng Sinh', mpCost: 14, scaleStat: 'WIS', mult: 1.0, elem: 'MỘC', healLeadMon: 0.45, desc: 'Hồi phục 45% HP cho Khế Thú Tiên Phong!' }
    ]
  },
  {
    id: 'void_blade',
    name: 'Kiếm Sĩ Hư Vô',
    favoredStats: ['STR', 'INT', 'SPD'],
    baseStats: { STR: 13, CON: 10, DEF: 9, SPD: 13, DEX: 11, INT: 13, WIS: 8, CHA: 7 },
    desc: 'Ma kiếm sĩ dung hợp kiếm thuật vật lý (STR) và ma năng vết nứt bầu trời (INT).',
    skills: [
      { id: 'rift_slash', name: 'Nhát Chém Khe Trời', mpCost: 13, scaleStat: 'STR', mult: 1.75, elem: 'HƯ VÔ', desc: 'Kết hợp STR + INT chém rách không gian.' },
      { id: 'star_fall', name: 'Hắc Tinh Giáng Thế', mpCost: 16, scaleStat: 'INT', mult: 1.95, elem: 'HƯ VÔ', desc: 'Triệu hồi mảnh sao vỡ nghiền nát kẻ thù.' }
    ]
  },
  {
    id: 'crimson_berserker',
    name: 'Chiến Binh Cuồng Huyết',
    favoredStats: ['STR', 'CON', 'SPD'],
    baseStats: { STR: 16, CON: 14, DEF: 8, SPD: 12, DEX: 10, INT: 6, WIS: 7, CHA: 9 },
    desc: 'Chiến binh hiến tế phòng thủ để đổi lấy sức mạnh bạo phát (STR + CON).',
    skills: [
      { id: 'blood_frenzy', name: 'Cuồng Nộ Phá Giáp', mpCost: 10, scaleStat: 'STR', mult: 1.9, elem: 'HUYẾT', desc: 'Đòn đánh tàn bạo theo STR + CON.' },
      { id: 'undying_roar', name: 'Tiếng Gầm Bất Khuất', mpCost: 12, scaleStat: 'CON', mult: 1.3, elem: 'TRO', healRatio: 0.30, desc: 'Hồi phục sinh lực và tăng sĩ khí.' }
    ]
  },
  {
    id: 'deep_forgesmith',
    name: 'Thợ Rèn Vỉa Vọng',
    favoredStats: ['STR', 'DEF', 'WIS'],
    baseStats: { STR: 14, CON: 13, DEF: 14, SPD: 8, DEX: 10, INT: 9, WIS: 12, CHA: 8 },
    desc: 'Nghệ nhân Thạch Mạch dùng búa cộng hưởng và cổ ngữ khắc đá.',
    skills: [
      { id: 'seismic_anvil', name: 'Chấn Động Vỉa Vọng', mpCost: 11, scaleStat: 'DEF', mult: 1.7, elem: 'THẠCH', desc: 'Gây sát thương lớn tỷ lệ thuận với DEF + STR.' },
      { id: 'runic_temper', name: 'Tôi Luyện Giáp Cổ', mpCost: 12, scaleStat: 'WIS', mult: 1.1, elem: 'TRO', healRatio: 0.25, desc: 'Gia cố giáp và hồi phục thể lực.' }
    ]
  },
  {
    id: 'mirror_illusionist',
    name: 'Ảo Thuật Gia Gương Vỡ',
    favoredStats: ['DEX', 'CHA', 'INT'],
    baseStats: { STR: 7, CON: 9, DEF: 8, SPD: 14, DEX: 13, INT: 14, WIS: 11, CHA: 14 },
    desc: 'Kẻ bước ra từ Thung Lũng Gương và Rạp Xiếc Chú Hề, thao túng ảo ảnh và xác suất.',
    skills: [
      { id: 'prism_shatter', name: 'Vỡ Gương Vạn Ảnh', mpCost: 12, scaleStat: 'INT', mult: 1.8, elem: 'HƯ VÔ', desc: 'Phóng mảnh kính phản chiếu cắt nát hàng thủ.' },
      { id: 'jester_gambit', name: 'Vũ Điệu Chú Hề', mpCost: 13, scaleStat: 'CHA', mult: 1.65, elem: 'TỬ', healRatio: 0.22, desc: 'Mê hoặc đối thủ và hồi phục bản thân.' }
    ]
  }
];

export const EQUIPMENT_DB = [
  { id: 'wpn_rust_sword', slot: 'weapon', name: 'Kiếm Sắt Khắc Muối', rarity: 'Normal', scaleStat: 'STR', power: 12, bonuses: { STR: 2 }, price: 60, desc: 'Thanh kiếm tiêu chuẩn của lính gác Cửu Khuyết.' },
  { id: 'wpn_birch_bow', slot: 'weapon', name: 'Cung Vỏ Bạch Dương', rarity: 'Uncommon', scaleStat: 'DEX', power: 16, bonuses: { DEX: 3, SPD: 2 }, price: 140, desc: 'Chế tác từ gỗ Rừng Lặng Tro, bắn chuẩn xác trong sương mù.' },
  { id: 'wpn_ash_staff', slot: 'weapon', name: 'Trượng Tro Tàn Âm', rarity: 'Uncommon', scaleStat: 'INT', power: 18, bonuses: { INT: 4, WIS: 2 }, price: 160, desc: 'Đầu trượng chứa than hồng không bao giờ tắt.' },
  { id: 'wpn_bell_censer', slot: 'weapon', name: 'Lư Hương Chuông Muối', rarity: 'Rare', scaleStat: 'CHA', power: 22, bonuses: { CHA: 5, WIS: 3 }, price: 280, desc: 'Khói hương làm dịu linh thú, tăng +10% tỷ lệ Khế Ấn.' },
  { id: 'wpn_deep_hammer', slot: 'weapon', name: 'Búa Chiến Vỉa Vọng', rarity: 'Elite', scaleStat: 'STR', power: 28, bonuses: { STR: 6, CON: 4 }, price: 420, desc: 'Vũ khí hợp kim rèn của Thạch dân Mạch Sâu.' },
  { id: 'wpn_vampire_scythe', slot: 'weapon', name: 'Lưỡi Hái Huyết Bá Tước', rarity: 'Epic', scaleStat: 'INT', power: 38, bonuses: { INT: 8, STR: 5, SPD: 4 }, price: 780, desc: 'Hút sinh lực mỗi nhát chém dưới ánh trăng vỡ.' },
  { id: 'wpn_dragon_greatsword', slot: 'weapon', name: 'Đại Kiếm Long Sừng Gãy', rarity: 'Legend', scaleStat: 'STR', power: 52, bonuses: { STR: 12, CON: 8, DEF: 5 }, price: 1500, desc: 'Rèn từ sừng của M-080 Long Sừng Gãy Khuyết. Uy lực kinh thiên.' },
  { id: 'wpn_abyss_blade', slot: 'weapon', name: 'Nhật Thực Kiếm Mắt Vực', rarity: 'Extraordinary', scaleStat: 'INT', power: 68, bonuses: { INT: 15, STR: 12, DEX: 10, SPD: 8 }, price: 3000, desc: 'Thần binh rèn từ mảnh vỡ Khe Trời Hắc Tinh.' },

  { id: 'arm_tattered_cloak', slot: 'armor', name: 'Áo Choàng Tro Bụi', rarity: 'Normal', defBonus: 6, hpBonus: 25, bonuses: { SPD: 1 }, price: 50, desc: 'Áo choàng vải thô chống sương lạnh.' },
  { id: 'arm_wolf_pelt', slot: 'armor', name: 'Giáp Da Lang Mốc Trăng', rarity: 'Rare', defBonus: 14, hpBonus: 65, bonuses: { CON: 3, SPD: 3 }, price: 240, desc: 'Nhẹ và bền, giữ trọn sự linh hoạt cho thợ săn.' },
  { id: 'arm_golem_plate', slot: 'armor', name: 'Giáp Đồng Cộng Hưởng', rarity: 'Elite', defBonus: 26, hpBonus: 120, bonuses: { DEF: 7, CON: 5, SPD: -2 }, price: 480, desc: 'Siêu cứng cáp nhưng nặng nề (-2 SPD).' },
  { id: 'arm_lich_robe', slot: 'armor', name: 'Áo Choàng Vua Cổng Lạc', rarity: 'Mythical', defBonus: 34, hpBonus: 165, bonuses: { INT: 10, WIS: 9, CHA: 6 }, price: 1100, desc: 'Dệt từ tơ bóng tối của Đô Thành Cửu Khuyết.' },
  { id: 'arm_star_plate', slot: 'armor', name: 'Thánh Giáp Tinh Vân Hắc Tinh', rarity: 'Extraordinary', defBonus: 48, hpBonus: 260, bonuses: { DEF: 12, CON: 12, INT: 10, WIS: 10 }, price: 2600, desc: 'Giáp truyền thuyết chống lại ánh nhìn của Cổ Thần.' },

  { id: 'rel_salt_ring', slot: 'relic', name: 'Nhẫn Muối Đóng Ranh', rarity: 'Uncommon', bonuses: { WIS: 3, DEF: 2 }, price: 120, desc: 'Giúp giữ tỉnh táo trước ảo ảnh và lời nguyền.' },
  { id: 'rel_clown_mask', slot: 'relic', name: 'Mặt Nạ Rạp Xiếc Vỡ', rarity: 'Super Rare', bonuses: { CHA: 7, DEX: 5, SPD: 4 }, price: 520, desc: 'Kỷ vật từ Vùng Đất Chú Hề, tăng mị lực và né tránh.' },
  { id: 'rel_mirror_shard', slot: 'relic', name: 'Mảnh Gương Mẫu Hậu', rarity: 'Mythical', bonuses: { INT: 9, WIS: 8, SPD: 5 }, price: 980, desc: 'Phản chiếu ma thuật từ Hoang Mạc Thủy Tinh.' },
  { id: 'rel_abyss_heart', slot: 'relic', name: 'Trái Tim Cổ Long Tĩnh Mạch', rarity: 'Legend', bonuses: { STR: 8, CON: 10, INT: 8, CHA: 8 }, price: 1800, desc: 'Cổ vật tối thượng cộng hưởng toàn diện mọi chỉ số.' }
];

export const CONSUMABLES_DB = [
  { id: 'item_ash_potion', name: 'Bình Huyết Tro', type: 'heal_player', value: 85, price: 40, desc: 'Hồi 85 HP cho nhân vật của bạn.' },
  { id: 'item_ether_dew', name: 'Sương Đêm Hồi Ma', type: 'heal_mp', value: 45, price: 50, desc: 'Hồi 45 MP để thi triển kỹ năng Class.' },
  { id: 'item_beast_salve', name: 'Cao Rễ Chữa Khế Thú', type: 'heal_mon', value: 110, price: 45, desc: 'Hồi 110 HP cho Khế Thú Tiên Phong.' },
  { id: 'item_seal_basic', name: 'Khế Ấn Tro Thường', type: 'seal', catchPower: 0.15, price: 35, desc: 'Lá bùa giấy tro dùng để thu phục quái vật yếu.' },
  { id: 'item_seal_silver', name: 'Khế Ấn Muối Bạc', type: 'seal', catchPower: 0.32, price: 95, desc: 'Bùa khắc muối tinh khiết, hiệu quả cao với quái Rare / Elite / SSR.' },
  { id: 'item_seal_crimson', name: 'Khế Ấn Huyết Nguyệt', type: 'seal', catchPower: 0.55, price: 240, desc: 'Ấn chú tối thượng để giam giữ Mythical, Legend & Cổ Thần!' },
  { id: 'item_ash_heart', name: 'Trái Tim Tro Hồn', type: 'restore_heart', value: 1, price: 450, desc: 'Khôi phục +1 Tim (Mạng Sống) cho người chơi!' }
];
