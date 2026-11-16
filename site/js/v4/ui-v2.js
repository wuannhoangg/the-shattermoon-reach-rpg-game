(function(){
// Presentation helpers for the v2-style theme. They only decorate markup that
// game.js already produced: selects become clickable card grids (the select
// stays the source of truth and still fires its own onchange), and monster
// cards get their tier colour. Nothing here changes game state directly.
const D = window.VTN_DATA;
const classSprites = window.VTN_CLASS_SPRITES || null;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bonusText = (b) => b && typeof b === 'object' ? Object.entries(b).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k}`).join(', ') : '';

function choose(select, value){
  if (select.value === value) return;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function cardGrid(select, cls, render){
  const grid = document.createElement('div');
  grid.className = 'pick-grid ' + cls;
  for (const opt of select.options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (opt.value === select.value ? ' on' : '') + (opt.disabled ? ' locked' : '');
    b.dataset.value = opt.value;
    b.innerHTML = render(opt.value, opt);
    if (!opt.disabled) b.addEventListener('click', () => {
      choose(select, opt.value);
      // game.js may rebuild the whole screen; if it did not, update the highlight here
      for (const x of grid.querySelectorAll('.pick')) x.classList.toggle('on', x.dataset.value === select.value);
    });
    grid.appendChild(b);
  }
  return grid;
}

function enhanceCreation(){
  const race = document.getElementById('create-race');
  if (race && !race.classList.contains('enhanced-select')) {
    race.classList.add('enhanced-select');
    const groups = [...new Set(D.races.map(r => r.group))];
    const filter = document.createElement('select');
    filter.className = 'pick-filter';
    filter.innerHTML = `<option value="">Tất cả ${D.races.length} chủng tộc</option>` + groups.map(g => `<option>${esc(g)}</option>`).join('');
    const grid = cardGrid(race, 'races', (id, opt) => {
      const r = D.races.find(x => x.id === id) || {};
      return `<span class="k">${esc(id)} • ${esc(r.group || '')}</span><span class="n">${esc(r.name || opt.textContent)}</span>` +
        `<span class="s">${esc(bonusText(r.statBonuses))}${r.freeStatPoints ? `, +${r.freeStatPoints} tự chọn` : ''}</span>` +
        `<span class="d">${esc(opt.disabled ? 'Mở khóa ở lượt chơi mới.' : (r.appearance || ''))}</span>`;
    });
    filter.addEventListener('change', () => {
      for (const b of grid.querySelectorAll('.pick')) {
        const r = D.races.find(x => x.id === b.dataset.value);
        b.style.display = !filter.value || r?.group === filter.value ? '' : 'none';
      }
    });
    race.after(filter, grid);
    grid.querySelector('.pick.on')?.scrollIntoView({ block: 'nearest' });
  }
  const cls = document.getElementById('create-class');
  if (cls && !cls.classList.contains('enhanced-select')) {
    cls.classList.add('enhanced-select');
    cls.after(cardGrid(cls, 'classes', (id, opt) => {
      const c = D.classes.find(x => x.id === id) || {};
      const battle = classSprites?.classes?.[id]?.battle;
      const sprite = battle ? `<span class="class-battle-sprite" data-class-battle="${esc(id)}"><img src="${esc(battle)}" alt="" draggable="false"></span>` : '';
      return sprite + `<span class="k">${esc(c.englishName || '')}</span><span class="n">${esc(c.name || opt.textContent)}</span>` +
        `<span class="s" style="color:var(--accent-gold)">Ưu thế: ${esc(c.primaryStatsText || '')}</span><span class="d">${esc(c.playstyle || '')}</span>`;
    }));
  }
}

function tierCards(){
  for (const card of document.querySelectorAll('.card:not([data-tier])')) {
    const cv = card.querySelector('canvas[data-species]');
    if (!cv) continue;
    const sp = D.monsters.find(m => m.id === cv.dataset.species);
    const tier = sp && D.tiers[sp.tierIndex];
    card.dataset.tier = tier ? tier.name : '';
    if (!tier) continue;
    card.style.setProperty('--tier', tier.color);
    if (!card.classList.contains('collectible') && !cv.classList.contains('muted-sprite')) {
      const label = document.createElement('div');
      label.className = 'tier-label';
      const emblem = window.VTN_EMBLEMS?.tier?.[tier.index];
      label.innerHTML = `<span>${esc(sp.id)}</span>${emblem ? `<img class="vtn-emblem" src="${esc(emblem)}" alt="${esc(tier.vietnameseName || tier.name || 'Bậc')}" width="18" height="18" draggable="false">` : ''}<span>${esc(tier.vietnameseName || tier.name)}</span>`;
      card.prepend(label);
    }
  }
}

let queued = false;
const run = () => { queued = false; enhanceCreation(); tierCards(); };
new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } })
  .observe(document.body, { childList: true, subtree: true });
run();
})();
