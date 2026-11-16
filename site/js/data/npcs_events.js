// Hệ Thống NPC Đa Tính Cách, Lựa Chọn Phân Nhánh, Khiêu Chiến NPC, Cướp Đường & Kỳ Ngộ

export const NPCS_DATA = [
  {
    id: 'npc_elder_root',
    mapId: 'map_central_ash',
    x: 10, y: 8,
    name: 'Trưởng Lão Mộc Tịch',
    raceCode: 'R-09',
    raceName: 'Tinh linh Dạ Diệp',
    personality: 'Trầm Mặc & Khắc Kỷ',
    color: '#5ca365',
    duelSquad: ['m_001', 'm_005', 'm_012'],
    duelLevel: 4,
    greeting: 'Rễ cây dưới Thánh Điện đang run rẩy. Ngươi mang huyết thống mới đến Vực Tàn Nguyệt để săn quái hay để lắng nghe lời hứa bị chôn vùi?',
    choices: [
      {
        label: 'Hỏi về bí mật tiến hóa & 10 thứ bậc của 200 quái vật',
        reqStat: null,
        outcomeText: 'Mỗi quái vật đều mang 1 trong 10 Thứ Bậc từ Phàm Thể (Normal) đến Siêu Việt (Extraordinary), cộng thêm Tiềm Lực (IV) và Tính Cách riêng. Hãy mở Sách Bách Khoa Quái Vật [B] để soi điểm yếu của chúng!',
        reward: { seals: 2 }
      },
      {
        label: '[Thuyết Phục • CHA ≥ 11] Xin thánh vật hồi sinh của Hội Giữ Rễ',
        reqStat: { stat: 'CHA', min: 11 },
        outcomeText: 'Ánh mắt của ngươi mang uy nghi của kẻ giữ lời thề. Ta trao cho ngươi 1 Trái Tim Tro Hồn để phòng khi sinh mệnh nguy cấp.',
        reward: { hearts: 1, gold: 80 }
      },
      {
        label: '⚔ Khiêu Chiến Trưởng Lão Mộc Tịch (Thử Thách Đội Hình)',
        reqStat: null,
        isDuel: true,
        outcomeText: 'Được thôi! Hãy để rễ cổ kiểm tra sự ăn ý giữa ngươi và Khế Thú!'
      }
    ]
  },
  {
    id: 'npc_arrogant_knight',
    mapId: 'map_nine_citadel',
    x: 12, y: 14,
    name: 'Chỉ Huy Vệ Binh Valen',
    raceCode: 'R-01',
    raceName: 'Nhân tộc Khắc Ước',
    personality: 'Kiêu Ngạo & Nghiêm Khắc',
    color: '#d43540',
    duelSquad: ['m_104', 'm_111', 'm_118'],
    duelLevel: 13,
    greeting: 'Đô Thành Cửu Khuyết không dành cho những kẻ lang thang yếu ớt. Chỉ những kẻ có sức mạnh thực sự mới được phép bước qua Cổng Lâu Đài!',
    choices: [
      {
        label: '[Uy Áp • STR ≥ 18] Chứng minh sức mạnh cơ bắp trước mặt hắn',
        reqStat: { stat: 'STR', min: 18 },
        outcomeText: 'Valen lùi nửa bước trước khí thế của ngươi: "Hừm... thanh kiếm của ngươi không phải đồ trang trí. Cầm lấy lộ phí này và tiến vào Lâu Đài đi!"',
        reward: { gold: 250, silverSeals: 2 }
      },
      {
        label: '[Lý Luận • INT ≥ 18] Vạch trần lỗ hổng trong Luật Khế Cửu Khuyết',
        reqStat: { stat: 'INT', min: 18 },
        outcomeText: 'Valen sững sờ: "Ngươi đọc được cả khế ước cổ của Hội Công Chứng sao? Ta bái phục!"',
        reward: { expPlayer: 120, gold: 200 }
      },
      {
        label: '⚔ Khiêu Chiến Chỉ Huy Valen',
        reqStat: null,
        isDuel: true,
        outcomeText: 'Rút vũ khí ra! Ta sẽ cho ngươi thấy kỷ luật của Vệ Binh Cửu Khuyết!'
      }
    ]
  },
  {
    id: 'npc_mad_jester',
    mapId: 'map_wonderland_clown',
    x: 16, y: 12,
    name: 'Hề Điên Mười Mùa',
    raceCode: 'R-38',
    raceName: 'Ảnh nhân Gương Vỡ',
    personality: 'Điên Loạn & Hài Hước Đen Tối',
    color: '#f72585',
    duelSquad: ['m_191', 'm_195', 'm_198'],
    duelLevel: 16,
    greeting: 'Hí hí! Chào mừng tới Rạp Xiếc Chú Hề giữa Vùng Đất 10 Mùa! Ở đây mùa xuân nở hoa xương, mùa đông rơi tro tím, còn ngươi... muốn đổi gì lấy tiếng cười?',
    choices: [
      {
        label: 'Tham gia Vòng Quay Kỳ Ngộ (Nhận ngẫu nhiên Tim, Ấn Huyết Nguyệt hoặc Gặp Quái Mythical!)',
        reqStat: null,
        triggerAnomaly: true,
        outcomeText: 'Hề Điên tung 3 quả cầu gương lên trời — không gian quanh ngươi vặn xoắn!'
      },
      {
        label: '[Thông Thái • WIS ≥ 16] Nhìn thấu ảo ảnh sau chiếc mặt nạ chú hề',
        reqStat: { stat: 'WIS', min: 16 },
        outcomeText: 'Hề Điên ngừng cười, cúi rạp người: "Đôi mắt của ngươi không bị lừa bởi gương vỡ. Nhận lấy báu vật này đi!"',
        reward: { crimsonSeals: 2, hearts: 1 }
      },
      {
        label: '⚔ Khiêu Chiến Hề Điên Mười Mùa',
        reqStat: null,
        isDuel: true,
        outcomeText: 'Màn diễn bắt đầu! Đừng khóc nếu Khế Thú của ngươi biến thành trò cười nhé!'
      }
    ]
  },
  {
    id: 'npc_dwarf_forgemaster',
    mapId: 'map_underground_city',
    x: 15, y: 8,
    name: 'Đại Thợ Rèn Borin Mạch Sâu',
    raceCode: 'R-13',
    raceName: 'Thạch dân Mạch Sâu',
    personality: 'Bộc Trực & Tham Vật Liệu',
    color: '#ff922b',
    duelSquad: ['m_124', 'm_130', 'm_138'],
    duelLevel: 12,
    greeting: 'Keng! Keng! Nghe tiếng đá vọng chưa? Ở Thành Phố Dưới Lòng Đất này, một thanh vũ khí cường hóa +5 đáng giá hơn cả lời hứa của nhà vua!',
    choices: [
      {
        label: 'Nhận quà ra mắt của Thợ Rèn Vỉa Vọng (+180 Tro Vàng & 2 Khế Ấn Muối Bạc)',
        reqStat: null,
        outcomeText: 'Dùng số vàng này để cường hóa vũ khí hoặc mua trang bị mới trong Cửa Hàng!',
        reward: { gold: 180, silverSeals: 2 }
      },
      {
        label: '⚔ Khiêu Chiến Đại Thợ Rèn Borin',
        reqStat: null,
        isDuel: true,
        outcomeText: 'Để xem giáp của ngươi cứng hơn hay búa của Thạch dân cứng hơn!'
      }
    ]
  },
  {
    id: 'npc_angel_exile',
    mapId: 'map_sky_citadel',
    x: 12, y: 12,
    name: 'Seraphim Gãy Cánh Aurelia',
    raceCode: 'R-35',
    raceName: 'Thiên duệ Sa Ngã',
    personality: 'Bi Thương & Cao Ngạo',
    color: '#ffd43b',
    duelSquad: ['m_072', 'm_076', 'm_080'],
    duelLevel: 17,
    greeting: 'Thiên Đàng Sụp Đổ từ đêm Trăng Vỡ. Thành Phố Trên Không này giờ chỉ còn lại tiếng gió rít qua những tượng thần không đầu...',
    choices: [
      {
        label: '[Nhân Hậu • CHA ≥ 14] An ủi và chia sẻ tro ấm sưởi đôi cánh gãy',
        reqStat: { stat: 'CHA', min: 14 },
        outcomeText: 'Aurelia khẽ mỉm cười: "Lâu lắm rồi mới có kẻ không nhìn ta như một quái vật. Hãy nhận phước lành hồi phục toàn bộ Tim!"',
        reward: { fullHearts: true, crimsonSeals: 1 }
      },
      {
        label: '⚔ Khiêu Chiến Seraphim Aurelia',
        reqStat: null,
        isDuel: true,
        outcomeText: 'Dù chỉ còn một cánh, ánh sáng sa ngã của ta vẫn đủ thiêu rụi kẻ ngạo mạn!'
      }
    ]
  }
];

export const KY_NGO_EVENTS = [
  {
    id: 'anomaly_spring_10_seasons',
    title: '✦ KỲ NGỘ: LẠC VÀO VÙNG ĐẤT MÙA XUÂN & 10 MÙA KỲ DỊ ✦',
    desc: 'Một cánh hoa anh đào bằng tro rơi trúng vai bạn. Trong chớp mắt, rừng tối biến thành đồng cỏ 10 mùa đan xen: tuyết rơi trên hoa đào, mưa lửa trên suối bạc!',
    choices: [
      {
        label: 'Uống nước Suối Mười Mùa (Hồi đầy HP, MP và +1 Tim Mạng Sống!)',
        reward: { fullHeal: true, hearts: 1, gold: 150 },
        resultText: 'Dòng nước ấm áp chữa lành mọi vết thương và khôi phục +1 Tim sinh mệnh!'
      },
      {
        label: 'Thổi sáo gọi Linh Thú Cổ Thần ẩn mình trong hoa (Gặp quái Mythical / Legend!)',
        spawnRareTier: 7,
        resultText: 'Từ tán cây 10 mùa, một sinh vật truyền thuyết tỏa hào quang rực rỡ bước ra!'
      }
    ]
  },
  {
    id: 'anomaly_mirror_valley',
    title: '✦ KỲ NGỘ: THUNG LŨNG GƯƠNG & VÙNG ĐẤT ẢO TƯỞNG ✦',
    desc: 'Mặt đất dưới chân hóa thành tấm gương khổng lồ phản chiếu hàng trăm phiên bản khác nhau của chính bạn. Một chiếc rương pha lê lơ lửng giữa không trung.',
    choices: [
      {
        label: 'Đập vỡ chiếc gương giả để lấy kho báu (+350 Tro Vàng & +2 Khế Ấn Huyết Nguyệt)',
        reward: { gold: 350, crimsonSeals: 2 },
        resultText: 'Mảnh gương tan biến, để lại túi vàng nặng trĩu và hai lá Khế Ấn Huyết Nguyệt!'
      },
      {
        label: 'Bước xuyên qua gương đối diện Hư Ảnh (Gặp quái Extraordinary / Legend hiếm!)',
        spawnRareTier: 8,
        resultText: 'Bóng phản chiếu bước ra khỏi gương với sức mạnh của Cổ Thần!'
      }
    ]
  },
  {
    id: 'anomaly_blood_altar',
    title: '✦ KỲ NGỘ: ĐỀN HIẾN TẾ TRĂNG VỠ BỊ LÃNG QUÊN ✦',
    desc: 'Giữa vùng đất bị ám hiện ra một tế đàn khắc đầy cổ ngữ của 40 chủng tộc. Ngọn lửa tím đang cháy bập bùng.',
    choices: [
      {
        label: 'Dâng 100 Tro Vàng cầu nguyện (+2 Điểm Tiềm Năng Nhân Vật & +1 Tim)',
        costGold: 100,
        reward: { statPoints: 2, hearts: 1 },
        resultText: 'Cổ ngữ bừng sáng! Bạn nhận được +2 Điểm Tiềm Năng để cộng chỉ số và +1 Tim!'
      },
      {
        label: 'Rút thanh đoản kiếm cổ cắm trên bệ đá (+200 EXP Nhân Vật & +200 EXP Khế Thú)',
        reward: { expPlayer: 200, expMon: 200 },
        resultText: 'Ký ức chiến đấu ngàn năm tràn vào tâm trí bạn và Khế Thú!'
      }
    ]
  }
];

export const BANDIT_ENCOUNTERS = [
  {
    name: 'Băng Cướp Tro Đen',
    desc: 'Ba tên đạo tặc đeo mặt nạ xương chó lao ra từ bóng tối: "Muốn sống qua vùng này thì để lại 120 Tro Vàng hoặc bỏ mạng!"',
    squad: ['m_006', 'm_011'],
    goldDemand: 120
  },
  {
    name: 'Kẻ Săn Tiền Thưởng Huyết Nguyệt',
    desc: 'Một gã sát thủ mặc áo choàng đỏ thẫm chặn ngang lối đi: "Cái đầu của kẻ lập khế ước đáng giá lắm đấy!"',
    squad: ['m_105', 'm_112'],
    goldDemand: 200
  }
];
