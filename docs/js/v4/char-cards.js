(function (g) {
  'use strict';
  const doc = g.document;
  const source = g.VTN_DATA?.prologue_cards;
  const cards = Array.isArray(source?.cards) ? source.cards : [];
  const byId = new Map(cards.map(card => [card.id, card]));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const rankClass = rank => ({ 'S++': 'spp', S: 's', A: 'a', B: 'b', D: 'd' }[rank] || 'd');
  const state = () => g.VTNGame?.storyState?.() || g.VTNGame?.state?.() || null;
  const reducedMotion = () => g.VTNPrefs?.get?.()?.motion === 'reduced' || !!g.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const currentFlag = (id, suffix = '') => !!state()?.flags?.[`p5card_${suffix ? suffix + '_' : ''}${id}`];

  let host = null;
  let active = null;
  let queue = [];
  let rosterOpen = false;
  let lockedView = false;

  function resolvePlayer(card) {
    const s = state(), hero = s?.hero || {};
    const classes = g.VTN_DATA?.classes || [];
    const cls = classes.find(item => item.id === hero.classId);
    let portrait = null;
    const list = g.VTN_RACE_PEOPLE?.races?.[hero.raceId] || [];
    const look = list.find(item => item.key === hero.storyLook && (!hero.gender || item.gender === hero.gender))
      || list.find(item => item.gender === (hero.gender || 'm') && item.age === (hero.age || 'young'))
      || list[0];
    portrait = look?.front || null;
    return { ...card, name: hero.name || card.name, className: cls?.name || card.className, portrait, inspected: currentFlag(card.id), titleGranted: false };
  }

  function resolveCard(id) {
    const card = byId.get(String(id));
    if (!card) return null;
    if (card.id === 'player') return resolvePlayer(card);
    const portrait = g.VTN_CAST?.[card.portraitKey]?.portrait || g.VTN_CAST?.[card.portraitKey]?.front || null;
    return { ...card, portrait, inspected: currentFlag(card.id), titleGranted: currentFlag(card.id, 'title') };
  }

  function roster() {
    return cards.map(card => resolveCard(card.id)).filter(Boolean);
  }

  function remember(id, grantTitle) {
    const s = state();
    if (!s) return;
    s.flags ??= {};
    s.flags[`p5card_${id}`] = true;
    const card = byId.get(id);
    if (grantTitle && card?.title) s.flags[`p5card_title_${id}`] = true;
    try { g.VTNGame?.save?.(); } catch { /* card presentation must not block story */ }
  }

  function captureHost() {
    if (host) return;
    const overlay = doc?.getElementById('overlay');
    const modal = overlay?.querySelector('.modal');
    const title = doc?.getElementById('modal-title');
    const content = doc?.getElementById('content');
    if (!overlay || !modal || !title || !content) return;
    const close = doc.getElementById('close-modal');
    host = {
      overlay,
      modal,
      title,
      content,
      close,
      wasOpen: overlay.classList.contains('open'),
      overlayClass: overlay.className,
      modalClass: modal.className,
      titleText: title.textContent,
      contentHTML: content.innerHTML,
      closeClass: close?.className || '',
      closeText: close?.textContent || '',
      screen: doc.body?.dataset.screen || '',
      creation: doc.body?.classList.contains('creation-mode') || false
    };
  }

  function openLayer(kind, html) {
    captureHost();
    const overlay = host?.overlay, modal = host?.modal;
    if (!overlay || !modal) return false;
    const title = host.title, content = host.content;
    overlay.classList.add('open', 'vtn-char-cards-overlay');
    modal.classList.add('vtn-char-cards-modal');
    title.textContent = kind === 'roster' ? 'Nhóm triệu hồi' : 'Phiến đá giám định';
    content.innerHTML = html;
    doc.body.dataset.screen = 'char-cards';
    doc.body.classList.remove('creation-mode');
    host.close?.classList.add('hidden');
    requestAnimationFrame(() => content.querySelector('button')?.focus());
    return true;
  }

  function restoreHost() {
    if (!host) return;
    const h = host;
    host = null;
    h.overlay.className = h.overlayClass;
    h.modal.className = h.modalClass;
    h.title.textContent = h.titleText;
    h.content.innerHTML = h.contentHTML;
    if (h.close) { h.close.className = h.closeClass; h.close.textContent = h.closeText; }
    if (h.wasOpen) h.overlay.classList.add('open');
    else h.overlay.classList.remove('open');
    if (h.screen) h.overlay.ownerDocument.body.dataset.screen = h.screen;
    else delete h.overlay.ownerDocument.body.dataset.screen;
    h.overlay.ownerDocument.body.classList.toggle('creation-mode', h.creation);
  }

  function portraitMarkup(card, small = false) {
    if (!card.portrait) return `<div class="vtn-card-no-portrait" aria-hidden="true">${esc(card.name.slice(0, 1))}</div>`;
    return `<img class="vtn-card-portrait-img${small ? ' is-small' : ''}" src="${esc(card.portrait)}" alt="${esc(card.name)}" draggable="false">`;
  }

  function titleMarkup(card, pending = false) {
    if (!card.title) return `<div class="vtn-card-title is-empty"><span>Danh hiệu</span><strong>${esc(card.titleStatus || 'Chưa có danh hiệu')}</strong></div>`;
    if (!card.titleGranted && !pending) return `<div class="vtn-card-title is-empty"><span>Danh hiệu</span><strong>Chưa ghi nhận</strong></div>`;
    return `<div class="vtn-card-title${pending ? ' is-pending' : ''}"><span>Danh hiệu</span><strong>${esc(card.titleStatus || card.title)}</strong></div>`;
  }

  function cardMarkup(card, opts = {}) {
    const granting = !!opts.grantTitle && !!card.title;
    const motion = reducedMotion() ? ' is-reduced' : '';
    return `<section class="vtn-card-stage rank-${rankClass(card.rank)}${granting ? ' is-granting' : ''}${motion}" data-vtn-card-stage role="dialog" aria-modal="true" aria-labelledby="vtn-card-name">
      <div class="vtn-card-plate">
        <div class="vtn-card-topline"><span>HỒ SƠ GIÁM ĐỊNH</span><span>VỰC TÀN NGUYỆT</span></div>
        <div class="vtn-card-grid">
          <div class="vtn-card-portrait-panel">
            <div class="vtn-card-portrait">${portraitMarkup(card)}</div>
            <div class="vtn-card-seal" aria-hidden="true"><span></span><b>${esc(card.rank)}</b></div>
            <p class="vtn-card-caption">Phiến đá đã ghi nhận</p>
          </div>
          <div class="vtn-card-copy">
            <div class="vtn-card-kicker"><span>NGƯỜI ĐƯỢC GỌI</span><span>HẠNG ${esc(card.rank)}</span></div>
            <h2 id="vtn-card-name">${esc(card.name)}</h2>
            <p class="vtn-card-class">${esc(card.className)}</p>
            <div class="vtn-card-talent"><span>THIÊN PHÚ</span><strong>${esc(card.talent)}</strong></div>
            <div class="vtn-card-rank"><span class="vtn-rank-badge">${esc(card.rank)}</span><div><small>ĐÁNH GIÁ</small><strong>Hạng ${esc(card.rank)}</strong></div></div>
            <section class="vtn-card-section"><h3>Năng lực</h3><ul>${(card.abilityLines || []).map(line => `<li>${esc(line)}</li>`).join('')}</ul></section>
            <section class="vtn-card-limit"><h3>Giới hạn</h3><p>${esc(card.limit)}</p></section>
            ${titleMarkup(card, granting)}
          </div>
        </div>
        <div class="vtn-card-scan" aria-hidden="true"><span>Đồng bộ dữ liệu</span><div class="vtn-scan-meter"><i></i></div><b>ĐÃ KHÓA</b></div>
        <div class="vtn-card-actions"><button type="button" class="vtn-card-continue" data-vtn-card-action="continue">Tiếp tục</button><span>Enter · Space · Esc</span></div>
      </div>
    </section>`;
  }

  function lockedMarkup(card) {
    return `<section class="vtn-roster-locked" role="dialog" aria-modal="true" aria-labelledby="vtn-locked-title">
      <div class="vtn-locked-mark" aria-hidden="true">?</div><p class="vtn-card-kicker">HỒ SƠ CHƯA MỞ</p><h2 id="vtn-locked-title">Chưa giám định</h2><p>Phiến đá chưa ghi nhận hồ sơ của ${esc(card.name)}.</p><button type="button" class="vtn-card-continue" data-vtn-card-action="roster-back">Quay lại nhóm</button>
    </section>`;
  }

  function rosterMarkup() {
    const list = roster();
    return `<section class="vtn-roster-shell" role="dialog" aria-modal="true" aria-labelledby="vtn-roster-title">
      <header class="vtn-roster-head"><div><p class="vtn-card-kicker">HỒ SƠ TRIỀU ĐÌNH</p><h2 id="vtn-roster-title">Nhóm triệu hồi</h2></div><button type="button" class="vtn-roster-close" data-vtn-card-action="close-roster">Đóng</button></header>
      <p class="vtn-roster-intro">Năm người được gọi qua Giới Đạo. Những hồ sơ chưa chạm vào phiến đá vẫn đang úp.</p>
      <div class="vtn-roster-grid">${list.map(card => {
        const seen = currentFlag(card.id);
        return `<button type="button" class="vtn-roster-card${seen ? ' is-seen rank-' + rankClass(card.rank) : ' is-hidden'}" data-vtn-card-id="${esc(card.id)}" aria-label="${seen ? 'Mở hồ sơ ' + esc(card.name) : 'Hồ sơ chưa giám định'}">
          <span class="vtn-roster-art">${seen ? portraitMarkup(card, true) : '<span class="vtn-roster-back">?</span>'}</span><strong>${seen ? esc(card.name) : 'Chưa giám định'}</strong><small>${seen ? 'Hạng ' + esc(card.rank) : 'Chạm để xem trạng thái'}</small>
        </button>`;
      }).join('')}</div>
      <p class="vtn-roster-hint">Chọn một thẻ để xem phiến đá mở hồ sơ.</p>
    </section>`;
  }

  function finishActive() {
    if (!active) return;
    const task = active;
    const card = resolveCard(task.id);
    active = null;
    if (card) remember(card.id, !!task.opts.grantTitle);
    restoreHost();
    task.resolve(card ? { id: card.id, granted: !!task.opts.grantTitle && !!card.title } : undefined);
    setTimeout(pump, 0);
  }

  function pump() {
    if (active || !queue.length) return;
    const task = queue.shift();
    const card = resolveCard(task.id);
    if (!card) { task.resolve(undefined); setTimeout(pump, 0); return; }
    active = task;
    lockedView = false;
    openLayer('card', cardMarkup(card, task.opts));
  }

  function show(id, opts = {}) {
    return new Promise(resolve => {
      const card = byId.get(String(id));
      if (!card) { resolve(undefined); return; }
      queue.push({ id: card.id, opts: { grantTitle: !!opts.grantTitle }, resolve });
      pump();
    });
  }

  function closeRoster() {
    if (active) return;
    rosterOpen = false;
    lockedView = false;
    restoreHost();
  }

  function openRoster() {
    if (!doc || active) return false;
    rosterOpen = true;
    lockedView = false;
    return openLayer('roster', rosterMarkup());
  }

  function showLocked(id) {
    const card = resolveCard(id);
    if (!card) return;
    lockedView = true;
    openLayer('roster', lockedMarkup(card));
  }

  function handleClick(event) {
    const action = event.target.closest?.('[data-vtn-card-action]');
    if (action) {
      const type = action.dataset.vtnCardAction;
      if (type === 'continue') finishActive();
      else if (type === 'roster-back') { lockedView = false; openLayer('roster', rosterMarkup()); }
      else if (type === 'close-roster') closeRoster();
      return;
    }
    const card = event.target.closest?.('[data-vtn-card-id]');
    if (card && rosterOpen && !active) {
      const id = card.dataset.vtnCardId;
      if (currentFlag(id)) show(id).catch(() => {});
      else showLocked(id);
    }
  }

  function handleKey(event) {
    if (!host?.overlay?.classList.contains('vtn-char-cards-overlay')) return;
    if (event.key === 'Escape') { event.preventDefault(); if (active) finishActive(); else if (lockedView) { lockedView = false; openLayer('roster', rosterMarkup()); } else closeRoster(); return; }
    if (active && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); finishActive(); }
  }

  if (!doc) {
    g.VTNCharCards = { show: () => Promise.resolve(), roster: () => [], openRoster: () => false, has: () => false };
    return;
  }
  doc.addEventListener('click', handleClick);
  g.addEventListener('keydown', handleKey);
  g.VTNCharCards = {
    show,
    roster,
    openRoster,
    has: id => currentFlag(String(id))
  };
})(typeof window !== 'undefined' ? window : globalThis);
