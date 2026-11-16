// Hệ Thống 13 Bản Đồ & Tầng Ngục Đa Kiến Trúc — Vực Tàn Nguyệt

export const WORLD_MAPS = [
  {
    id: 'map_central_ash',
    name: '01. Lục Địa Trung Tâm: Thánh Điện & Rừng Lặng Tro',
    biomeTag: 'Thánh Điện • Bình Nguyên • Rừng Lặng Tro • Sông Ngòi',
    monsterRegion: 'RỪNG LẶNG TRO',
    levelRange: [1, 6],
    dangerRate: 0.15,
    banditChance: 0.04,
    anomalyChance: 0.05,
    bossCode: 'm_020',
    palette: { ground: '#1d1b22', wild: '#16241b', wildAccent: '#3d6348', wall: '#0c0b0f', wallTop: '#2b2636', water: '#183242' },
    landmarks: [
      { name: 'Thánh Điện Tro Tàn (Đài Hồi Phục)', x: 8, y: 7, type: 'shrine' },
      { name: 'Lò Rèn & Thương Hội Khắc Ước', x: 12, y: 8, type: 'shop' },
      { name: 'Sông Ngòi Tro Bạc → Lối xuống Hang Dưới Sông', x: 16, y: 26, type: 'portal', targetMap: 'map_river_caverns', tx: 6, ty: 6 },
      { name: 'Bìa Rừng Lặng Tro → Đầm Sương Mộ & Nghĩa Trang', x: 4, y: 27, type: 'portal', targetMap: 'map_grave_mire', tx: 14, ty: 4 },
      { name: 'Cổng Đông → Quần Đảo Chuông Muối & Biển Băng', x: 27, y: 12, type: 'portal', targetMap: 'map_salt_archipelago', tx: 4, ty: 14 },
      { name: 'Đền Cháy Dưới Tán (Tế Đàn Chúa Rễ M-020)', x: 24, y: 5, type: 'boss_altar', bossCode: 'm_020' }
    ]
  },
  {
    id: 'map_grave_mire',
    name: '02. Đầm Sương Mộ, Nghĩa Trang Cổ & Đồi Ma Trơi',
    biomeTag: 'Đầm Lầy • Nghĩa Trang • Đồi Ma Trơi • Đồi Gò Cổ • Vùng Ô Nhiễm',
    monsterRegion: 'ĐẦM SƯƠNG MỘ',
    levelRange: [4, 9],
    dangerRate: 0.18,
    banditChance: 0.08,
    anomalyChance: 0.06,
    bossCode: 'm_060',
    palette: { ground: '#181c20', wild: '#122126', wildAccent: '#6741d9', wall: '#0b0d10', wallTop: '#252d36', water: '#1b3b36' },
    landmarks: [
      { name: 'Đài Lửa Đầm Sương', x: 14, y: 5, type: 'shrine' },
      { name: 'Nghĩa Trang Cổ → Xuống Hầm Mộ Hoàng Gia (Tầng B1)', x: 8, y: 16, type: 'portal', targetMap: 'map_royal_catacombs', tx: 6, ty: 5 },
      { name: 'Đồi Ma Trơi & Đồi Gò Cổ → Vành Đai Miếu Câm', x: 26, y: 22, type: 'portal', targetMap: 'map_silent_shrines_hell', tx: 5, ty: 10 },
      { name: 'Đường Mòn Phía Bắc → Lục Địa Trung Tâm', x: 14, y: 3, type: 'portal', targetMap: 'map_central_ash', tx: 5, ty: 26 },
      { name: 'Hồ Sen Mục (Tế Đàn Bà Mẹ Trăm Bóng M-060)', x: 22, y: 10, type: 'boss_altar', bossCode: 'm_060' }
    ]
  },
  {
    id: 'map_salt_archipelago',
    name: '03. Quần Đảo Chuông Muối, Sông Ngòi & Biển Băng',
    biomeTag: 'Quần Đảo • Sông Ngòi • Biển Băng • Cảng Tàu Đắm',
    monsterRegion: 'QUẦN ĐẢO CHUÔNG MUỐI',
    levelRange: [5, 10],
    dangerRate: 0.17,
    banditChance: 0.07,
    anomalyChance: 0.06,
    bossCode: 'm_040',
    palette: { ground: '#1f232b', wild: '#172b3a', wildAccent: '#4dabf7', wall: '#0c1117', wallTop: '#2e3f52', water: '#103b5c' },
    landmarks: [
      { name: 'Ngọn Hải Đăng Muối Trắng (Đài Hồi Phục)', x: 6, y: 14, type: 'shrine' },
      { name: 'Vòng Xoáy Đáy Sông → Hang Dưới Sông', x: 15, y: 15, type: 'portal', targetMap: 'map_river_caverns', tx: 14, ty: 14 },
      { name: 'Bến Băng Phía Bắc → Sơn Mạch Xương Thiên & Núi Tuyết', x: 24, y: 6, type: 'portal', targetMap: 'map_skybone_snow', tx: 5, ty: 22 },
      { name: 'Tàu Buôn Cảng Chuông Muối', x: 9, y: 12, type: 'shop' },
      { name: 'Đền Dưới Triều (Tế Đàn Hoàng Đế Vực Mặn M-040)', x: 25, y: 24, type: 'boss_altar', bossCode: 'm_040' }
    ]
  },
  {
    id: 'map_river_caverns',
    name: '04. Hang Dưới Sông & Thủy Cung Chuông Đắm (Tầng Ngầm)',
    biomeTag: 'Hang Dưới Sông • Hang Động Ngầm • Rạn San Hô Đỏ',
    monsterRegion: 'QUẦN ĐẢO CHUÔNG MUỐI',
    levelRange: [6, 11],
    dangerRate: 0.20,
    banditChance: 0.03,
    anomalyChance: 0.09,
    bossCode: 'm_040',
    palette: { ground: '#111b24', wild: '#142938', wildAccent: '#e03131', wall: '#080d12', wallTop: '#1c3347', water: '#0b2538' },
    landmarks: [
      { name: 'Bọt Khí Thánh Tích (Đài Hồi Phục)', x: 7, y: 7, type: 'shrine' },
      { name: 'Lối Lên Mặt Sông → Lục Địa Trung Tâm', x: 5, y: 5, type: 'portal', targetMap: 'map_central_ash', tx: 16, ty: 25 },
      { name: 'Đường Hầm Đá Sâu → Thành Phố Dưới Lòng Đất', x: 24, y: 22, type: 'portal', targetMap: 'map_underground_city', tx: 5, ty: 12 }
    ]
  },
  {
    id: 'map_skybone_snow',
    name: '05. Sơn Mạch Xương Thiên, Núi Tuyết, Băng Nguyên & Núi Băng',
    biomeTag: 'Núi Tuyết • Băng Nguyên • Núi Băng • Đèo Hẹp',
    monsterRegion: 'BẠCH NGUYÊN VÔ NHẬT',
    levelRange: [8, 14],
    dangerRate: 0.18,
    banditChance: 0.06,
    anomalyChance: 0.07,
    bossCode: 'm_160',
    palette: { ground: '#262b36', wild: '#2b384a', wildAccent: '#a5d8ff', wall: '#12161f', wallTop: '#4c5c75', water: '#339af0' },
    landmarks: [
      { name: 'Trạm Gác Băng Giá (Đài Hồi Phục)', x: 6, y: 21, type: 'shrine' },
      { name: 'Cửa Hang Trong Núi → Thành Phố Dưới Lòng Đất', x: 14, y: 12, type: 'portal', targetMap: 'map_underground_city', tx: 14, ty: 5 },
      { name: 'Đỉnh Bão Tuyết → Thiên Đàng & Thành Phố Trên Không', x: 25, y: 5, type: 'portal', targetMap: 'map_sky_citadel', tx: 14, ty: 24 },
      { name: 'Hồ Băng Vĩnh Cửu (Tế Đàn Mẫu Long Ngủ Đông M-160)', x: 23, y: 18, type: 'boss_altar', bossCode: 'm_160' }
    ]
  },
  {
    id: 'map_underground_city',
    name: '06. Hạ Tầng Vỉa Vọng: Thành Phố Dưới Lòng Đất & Hang Trong Núi',
    biomeTag: 'Thành Phố Dưới Lòng Đất • Hang Trong Núi • Lò Rèn Mạch Sâu',
    monsterRegion: 'HẠ TẦNG VỈA VỌNG',
    levelRange: [9, 15],
    dangerRate: 0.18,
    banditChance: 0.05,
    anomalyChance: 0.08,
    bossCode: 'm_140',
    palette: { ground: '#211c1a', wild: '#2e241f', wildAccent: '#ff922b', wall: '#0f0c0b', wallTop: '#4a3b32', water: '#d9480f' },
    landmarks: [
      { name: 'Lò Rèn Trung Tâm Thạch Dân (Đài Hồi Phục)', x: 13, y: 6, type: 'shrine' },
      { name: 'Xưởng Rèn Huyền Thoại Vỉa Vọng', x: 16, y: 7, type: 'shop' },
      { name: 'Thang Máy Mỏ Cổ → Sơn Mạch Xương Thiên', x: 14, y: 4, type: 'portal', targetMap: 'map_skybone_snow', tx: 14, ty: 13 },
      { name: 'Mạch Nham Thạch Sâu (Tế Đàn Cổ Long Tĩnh Mạch M-140)', x: 24, y: 23, type: 'boss_altar', bossCode: 'm_140' }
    ]
  },
  {
    id: 'map_glass_desert',
    name: '07. Hoang Mạc Thủy Tinh & Thung Lũng Gương',
    biomeTag: 'Thung Lũng Gương • Hoang Mạc Thủy Tinh • Ốc Đảo Gương',
    monsterRegion: 'HOANG MẠC THỦY TINH',
    levelRange: [10, 15],
    dangerRate: 0.18,
    banditChance: 0.11,
    anomalyChance: 0.12,
    bossCode: 'm_100',
    palette: { ground: '#2b251d', wild: '#383024', wildAccent: '#ffd43b', wall: '#14110d', wallTop: '#5c4f3c', water: '#66d9e8' },
    landmarks: [
      { name: 'Ốc Đảo Phản Chiếu (Đài Hồi Phục)', x: 6, y: 6, type: 'shrine' },
      { name: 'Cổng Đại Đô Thành → Đô Thành Cửu Khuyết', x: 25, y: 14, type: 'portal', targetMap: 'map_nine_citadel', tx: 4, ty: 14 },
      { name: 'Tấm Gương Mười Mặt → Miền Đất Kỳ Diệu & 10 Mùa', x: 15, y: 24, type: 'portal', targetMap: 'map_wonderland_clown', tx: 14, ty: 5 },
      { name: 'Điện Kính Vỡ (Tế Đàn Mẫu Hậu Kính Vỡ M-100)', x: 22, y: 6, type: 'boss_altar', bossCode: 'm_100' }
    ]
  },
  {
    id: 'map_nine_citadel',
    name: '08. Đô Thành Cửu Khuyết: Thành Phố & Quảng Trường Lâu Đài',
    biomeTag: 'Thành Phố • Cổng Thành Bảy Lớp • Ngoại Vi Lâu Đài',
    monsterRegion: 'ĐÔ THÀNH CỬU KHUYẾT',
    levelRange: [11, 16],
    dangerRate: 0.17,
    banditChance: 0.12,
    anomalyChance: 0.06,
    bossCode: 'm_120',
    palette: { ground: '#1e1821', wild: '#291d2b', wildAccent: '#d6336c', wall: '#0d0a0f', wallTop: '#3d2c42', water: '#4c1d2e' },
    landmarks: [
      { name: 'Quảng Trường Đèn Lồng Đỏ (Đài Hồi Phục)', x: 7, y: 14, type: 'shrine' },
      { name: 'Chợ Đêm Huyết Tộc & Hội Công Chứng', x: 10, y: 12, type: 'shop' },
      { name: 'Cổng Chính Lâu Đài → Lâu Đài & Tháp Cao Vô Tận', x: 23, y: 14, type: 'portal', targetMap: 'map_castle_tower', tx: 5, ty: 14 },
      { name: 'Cổng Tây → Hoang Mạc Thủy Tinh & Thung Lũng Gương', x: 3, y: 14, type: 'portal', targetMap: 'map_glass_desert', tx: 24, ty: 14 }
    ]
  },
  {
    id: 'map_castle_tower',
    name: '09. Lâu Đài Cửu Khuyết & Tháp Cao Vô Tận (Tầng 2 → Đỉnh Tháp)',
    biomeTag: 'Lâu Đài Gothic • Tháp Cao • Đại Sảnh Ngai Vàng',
    monsterRegion: 'ĐÔ THÀNH CỬU KHUYẾT',
    levelRange: [13, 18],
    dangerRate: 0.21,
    banditChance: 0.04,
    anomalyChance: 0.08,
    bossCode: 'm_120',
    palette: { ground: '#1a1524', wild: '#251d36', wildAccent: '#9775fa', wall: '#0a080f', wallTop: '#362a4d', water: '#5f3dc4' },
    landmarks: [
      { name: 'Bệ Thờ Tháp Chuông (Đài Hồi Phục)', x: 6, y: 13, type: 'shrine' },
      { name: 'Cầu Thang Xoắn Xuống → Đô Thành Cửu Khuyết', x: 4, y: 14, type: 'portal', targetMap: 'map_nine_citadel', tx: 22, ty: 14 },
      { name: 'Ngai Vàng Cổng Lạc (Tế Đàn Vua Cổng Lạc M-120)', x: 24, y: 14, type: 'boss_altar', bossCode: 'm_120' }
    ]
  },
  {
    id: 'map_royal_catacombs',
    name: '10. Hầm Mộ Hoàng Gia & Nghĩa Trang Ngầm (Tầng B1–B2)',
    biomeTag: 'Hầm Mộ • Mê Cung Quan Tài • Nghĩa Trang Ngầm',
    monsterRegion: 'VÀNH ĐAI MIẾU CÂM',
    levelRange: [12, 17],
    dangerRate: 0.22,
    banditChance: 0.05,
    anomalyChance: 0.09,
    bossCode: 'm_180',
    palette: { ground: '#16151a', wild: '#211f29', wildAccent: '#ae3ec9', wall: '#09080b', wallTop: '#2e2b38', water: '#3b2447' },
    landmarks: [
      { name: 'Nến Xương Bất Diệt (Đài Hồi Phục)', x: 7, y: 6, type: 'shrine' },
      { name: 'Bậc Thang Lên → Đầm Sương Mộ & Nghĩa Trang Cổ', x: 5, y: 5, type: 'portal', targetMap: 'map_grave_mire', tx: 8, ty: 15 },
      { name: 'Đại Điện Chuông Câm (Tế Đàn Đế Thú Trăm Phù M-180)', x: 24, y: 23, type: 'boss_altar', bossCode: 'm_180' }
    ]
  },
  {
    id: 'map_silent_shrines_hell',
    name: '11. Vành Đai Miếu Câm, Núi Lửa Địa Ngục & Vùng Đất Quỷ Dữ',
    biomeTag: 'Vùng Đất Bị Ám • Núi Lửa • Địa Ngục • Vùng Đất Quỷ Dữ • Vực Sâu',
    monsterRegion: 'KHE TRỜI HẮC TINH',
    levelRange: [15, 22],
    dangerRate: 0.22,
    banditChance: 0.10,
    anomalyChance: 0.10,
    bossCode: 'm_200',
    palette: { ground: '#241214', wild: '#361619', wildAccent: '#ff4d4d', wall: '#0f0607', wallTop: '#4f1d22', water: '#e8590c' },
    landmarks: [
      { name: 'Miếu Tro Phong Ấn (Đài Hồi Phục)', x: 6, y: 10, type: 'shrine' },
      { name: 'Lối Về → Đầm Sương Mộ', x: 4, y: 10, type: 'portal', targetMap: 'map_grave_mire', tx: 25, ty: 22 },
      { name: 'Vết Nứt Cuối Đêm (Tế Đàn Mắt Vực Cuối Đêm M-200)', x: 25, y: 24, type: 'boss_altar', bossCode: 'm_200' }
    ]
  },
  {
    id: 'map_sky_citadel',
    name: '12A. Thiên Đàng Sụp Đổ & Thành Phố Trên Không',
    biomeTag: 'Thiên Đàng • Thành Phố Trên Không • Đảo Bay Tầng Mây',
    monsterRegion: 'SƠN MẠCH XƯƠNG THIÊN',
    levelRange: [14, 20],
    dangerRate: 0.19,
    banditChance: 0.03,
    anomalyChance: 0.12,
    bossCode: 'm_080',
    palette: { ground: '#252636', wild: '#2f324d', wildAccent: '#ffd43b', wall: '#11121c', wallTop: '#4a4e73', water: '#74c0fc' },
    landmarks: [
      { name: 'Thánh Đài Lông Vũ Sa Ngã (Đài Hồi Phục)', x: 14, y: 22, type: 'shrine' },
      { name: 'Cầu Vồng Băng Xuống → Sơn Mạch Xương Thiên', x: 14, y: 25, type: 'portal', targetMap: 'map_skybone_snow', tx: 25, ty: 6 },
      { name: 'Đỉnh Xương Thiên (Tế Đàn Long Sừng Gãy Khuyết M-080)', x: 14, y: 5, type: 'boss_altar', bossCode: 'm_080' }
    ]
  },
  {
    id: 'map_wonderland_clown',
    name: '12B. Miền Đất Kỳ Diệu: Vùng Đất 10 Mùa, Rạp Xiếc Chú Hề & Ảo Tưởng',
    biomeTag: 'Vùng Đất Mùa Xuân • Vùng Đất 10 Mùa • Vùng Đất Chú Hề • Vùng Đất Ảo Tưởng',
    monsterRegion: 'KHE TRỜI HẮC TINH',
    levelRange: [12, 24],
    dangerRate: 0.21,
    banditChance: 0.05,
    anomalyChance: 0.25,
    bossCode: 'm_200',
    palette: { ground: '#24192e', wild: '#2e1c3b', wildAccent: '#f72585', wall: '#110a17', wallTop: '#4c2a66', water: '#4cc9f0' },
    landmarks: [
      { name: 'Vườn Xuân Mười Mùa (Đài Hồi Phục)', x: 14, y: 7, type: 'shrine' },
      { name: 'Gương Thoát Ảo Ảnh → Hoang Mạc Thủy Tinh', x: 14, y: 4, type: 'portal', targetMap: 'map_glass_desert', tx: 15, ty: 23 },
      { name: 'Rạp Xiếc Chú Hề & Ngai Cổ Thần (Tế Đàn Mắt Vực M-200)', x: 14, y: 24, type: 'boss_altar', bossCode: 'm_200' }
    ]
  }
];
