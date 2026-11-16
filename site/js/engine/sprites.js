// Trình Vẽ Pixel Art 16x16 Đa Dạng Hóa Cho Tất Cả 200 Quái Vật & 40 Chủng Tộc

const ELEMENT_PALETTES = {
  TRO:     ['#141013', '#4a1c17', '#9e3223', '#e85d35', '#ffd43b'],
  MỘC:     ['#101712', '#23422b', '#437a4e', '#69db7c', '#e9fac8'],
  THỦY:    ['#0d1721', '#1b3b5c', '#2b6cb0', '#4dabf7', '#d0ebff'],
  THẠCH:   ['#171512', '#42392e', '#786854', '#b59d79', '#ffe8cc'],
  BĂNG:    ['#101924', '#264666', '#4c88c4', '#74c0fc', '#ffffff'],
  TỬ:      ['#130f1c', '#322252', '#6741d9', '#b197fc', '#f3d9fa'],
  HUYẾT:   ['#170c10', '#4d131d', '#9e232b', '#ff4d5e', '#ffc9c9'],
  'HƯ VÔ': ['#0b0914', '#281547', '#6a1b9a', '#f72585', '#4cc9f0']
};

const ARCHETYPES = {
  beast: [
    '0000100000100000',
    '0001410001410000',
    '0001311111310000',
    '0013333333331000',
    '0013513331531000',
    '0013333333331000',
    '0001334443310000',
    '0012333333321100',
    '0123333333332310',
    '1233333333333341',
    '1333223333223341',
    '0133101331013310',
    '0133101331013310',
    '0122101221012210',
    '0144101441014410',
    '0011000110001100'
  ],
  dragon: [
    '0110000110000110',
    '1231001441001321',
    '1233101331013321',
    '1233311551133321',
    '0123333333333210',
    '0123433333343210',
    '0012333443332100',
    '0001233443321000',
    '0012333333332100',
    '0123322332233210',
    '0123101331013210',
    '0011001331001100',
    '0000012332100000',
    '0000123443210000',
    '0001441001441000',
    '0000110000110000'
  ],
  humanoid: [
    '0000011111100000',
    '0000143333410000',
    '0001333333331000',
    '0001351331531000',
    '0001333443331000',
    '0000123333210000',
    '0011233443321100',
    '0123333443333210',
    '1233123333213321',
    '1441012332101441',
    '0110012332100110',
    '0000013333100000',
    '0000123113210000',
    '0000123113210000',
    '0001441001441000',
    '0000110000110000'
  ],
  eldritch: [
    '0010011111100100',
    '0141133333311410',
    '0133333443333310',
    '1233334554333321',
    '1233345115433321',
    '1233334554333321',
    '0123333443333210',
    '0012333333332100',
    '0132123333212310',
    '1341012332101431',
    '1310123113210131',
    '0100131001310010',
    '0001310000131000',
    '0014100000014100',
    '0011000000001100',
    '0000000000000000'
  ]
};

export function renderMonsterPixelArt(canvas, monster, scale = 6) {
  if (!canvas || !monster) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pal = ELEMENT_PALETTES[monster.element] || ELEMENT_PALETTES.TRO;
  const grid = ARCHETYPES[monster.archetype] || ARCHETYPES.beast;
  const seed = monster.num || 1;

  const ox = Math.floor((canvas.width - 16 * scale) / 2);
  const oy = Math.floor((canvas.height - 16 * scale) / 2);

  const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, scale, canvas.width / 2, canvas.height / 2, scale * 8);
  grad.addColorStop(0, pal[3] + '44');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let ch = grid[y][x];
      if (ch === '0' && y <= 2 && (x === (seed % 5) + 2 || x === 13 - (seed % 5)) && monster.threat >= 2) {
        ch = '4';
      }
      if (ch !== '0') {
        let cIdx = parseInt(ch, 10) - 1;
        if ((x + y + seed) % 7 === 0 && cIdx > 0 && cIdx < 4) {
          cIdx = (cIdx + 1) % 5;
        }
        ctx.fillStyle = pal[cIdx];
        ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    }
  }
}

export function drawHeroSprite(ctx, px, py, size, dir, tick, race) {
  const bob = Math.floor(tick / 12) % 2;
  ctx.fillStyle = race ? race.cloakColor : '#6e242b';
  ctx.fillRect(px + 6, py + 5 + bob, size - 12, size - 7);
  ctx.fillStyle = race ? race.skinColor : '#d8b48a';
  ctx.fillRect(px + 9, py + 5 + bob, size - 18, 8);
  ctx.fillStyle = '#ffd43b';
  if (dir === 'left') ctx.fillRect(px + 9, py + 8 + bob, 3, 2);
  else if (dir === 'right') ctx.fillRect(px + 20, py + 8 + bob, 3, 2);
  else if (dir === 'down') {
    ctx.fillRect(px + 11, py + 8 + bob, 3, 2);
    ctx.fillRect(px + 18, py + 8 + bob, 3, 2);
  }
}
