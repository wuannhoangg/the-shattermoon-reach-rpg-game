/* Music manager — simple, strict rules.
 *
 *  1. ONE track at a time. Every Audio element is registered and anything that is not the current track is destroyed.
 *  2. A track is NEVER cut short by the game. Changing scene (menu, exploring, battle, boss, story) does not interrupt it:
 *     the scene only decides which track comes NEXT, when the current one has ended.
 *  3. The player is in charge: turning music off stops it at once; picking a track in Settings plays that track (it loops);
 *     the volume slider applies instantly. Settings are shared across tabs/windows (storage event), so a second tab can
 *     never keep playing after music was switched off.
 */
(function (g) {
  'use strict';
  const TRACKS = [
    {id: 'explore_1', name: 'Đêm tro tàn · khám phá I', ctx: 'explore'},
    {id: 'explore_2', name: 'Lối mòn dưới trăng vỡ · khám phá II', ctx: 'explore'},
    {id: 'battle_1', name: 'Lưỡi sắc, lời thề · giao tranh I', ctx: 'battle'},
    {id: 'battle_2', name: 'Nhịp tim cuối cùng · giao tranh II', ctx: 'battle'},
    {id: 'dread_1', name: 'Bóng đè · Bá Chủ', ctx: 'boss'},
    {id: 'sorrow_1', name: 'Nến tắt · tiếng thở dài I', ctx: 'story'},
    {id: 'sorrow_2', name: 'Ký ức rơi · tiếng thở dài II', ctx: 'story'}
  ];
  const LISTS = {
    explore: TRACKS.filter(t => t.ctx === 'explore'),
    battle: TRACKS.filter(t => t.ctx === 'battle'),
    boss: TRACKS.filter(t => t.ctx === 'boss'),
    story: TRACKS.filter(t => t.ctx === 'story')
  };
  LISTS.title = LISTS.story;
  const src = id => 'assets/audio/music/' + id + '.mp3';

  const registry = new Set();
  let unlocked = false, current = null, lastId = '', startedAt = 0;
  const prefs = () => g.VTNPrefs.get();
  const wanted = () => prefs().musicOn;
  const volume = () => Math.max(0, Math.min(1, prefs().musicVolume));

  function kill(el) {
    try { el.onended = null; el.onerror = null; el.pause(); el.volume = 0; el.removeAttribute('src'); el.load(); } catch { /* ignore */ }
    registry.delete(el);
  }
  function killAll() { for (const el of [...registry]) kill(el); current = null; }

  function detect() {
    const d = g.document;
    if (d.body.classList.contains('title-mode')) return 'title';
    if (d.querySelector('#story-overlay.is-active')) return 'story';
    const b = g.VTNGame && g.VTNGame.battle && g.VTNGame.battle();
    if (b) return (b.mode === 'boss' || b.overlordId || b.finalBoss || b.abyssBoss) ? 'boss' : 'battle';
    return 'explore';
  }

  function nextFor(ctx) {
    const list = LISTS[ctx] || LISTS.explore;
    const others = list.filter(t => t.id !== lastId);
    const pool = others.length ? others : list;
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  function play(id, loop) {
    killAll();
    if (!wanted() || !unlocked) return;
    const el = new Audio(src(id));
    el.preload = 'auto'; el.loop = !!loop; el.volume = 0;
    registry.add(el);
    current = {id, el, loop: !!loop};
    lastId = id; startedAt = performance.now();
    el.onended = () => {                           // the track finished by itself: now (and only now) the scene picks the next one
      if (current && current.el === el) { kill(el); current = null; if (wanted()) advance(); }
    };
    el.onerror = () => { if (current && current.el === el) { kill(el); current = null; setTimeout(() => { if (wanted() && !current) advance(); }, 1500); } };
    const pr = el.play();
    if (pr && pr.catch) pr.catch(() => { if (current && current.el === el) { kill(el); current = null; unlocked = false; } });
    // gentle fade-in only; there is never a fade-out that cuts a playing track
    const t0 = performance.now();
    const step = () => {
      if (!registry.has(el)) return;
      const k = Math.min(1, (performance.now() - t0) / 700);
      try { el.volume = volume() * k; } catch { /* ignore */ }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function advance() {
    const pin = prefs().musicTrack;
    if (pin && pin !== 'auto' && TRACKS.some(t => t.id === pin)) { play(pin, true); return; }
    play(nextFor(detect()), false);
  }

  function tick() {
    if (!wanted()) { if (registry.size) killAll(); return; }                         // music off: nothing may sound
    if (!unlocked) return;
    for (const el of [...registry]) if (!current || el !== current.el) kill(el);      // anything stray goes
    const pin = prefs().musicTrack, pinned = pin && pin !== 'auto' && TRACKS.some(t => t.id === pin);
    if (!current) { advance(); return; }
    if (pinned && current.id !== pin) { play(pin, true); return; }                    // the player picked a track in Settings
    if (!pinned && current.loop) { advance(); return; }                               // un-pinned: leave the looping track at its next end
    if (!g.document.hidden && current.el.paused && !current.el.ended && performance.now() - startedAt > 1500) current.el.play().catch(() => {});
    if (current.el.volume !== volume() && performance.now() - startedAt > 800) { try { current.el.volume = volume(); } catch { /* ignore */ } }
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(e => g.removeEventListener(e, unlock, true));
    tick();
  }
  ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(e => g.addEventListener(e, unlock, true));

  g.document.addEventListener('visibilitychange', () => {
    if (!current) return;
    if (g.document.hidden) current.el.pause(); else if (wanted()) current.el.play().catch(() => {});
  });

  g.VTNPrefs.onChange((p, patch) => {
    if ('musicOn' in patch) { if (!p.musicOn) killAll(); else tick(); }
    if ('musicVolume' in patch && current) { try { current.el.volume = volume(); } catch { /* ignore */ } }
    if ('musicTrack' in patch) { killAll(); tick(); }
  });
  setInterval(tick, 400);

  g.VTNAudio = {
    TRACKS,
    inspect: () => ({
      unlocked, audible: [...registry].filter(e => !e.paused && e.volume > 0.01).length, elements: registry.size,
      currentId: current ? current.id : null, ctx: current ? detect() : '', volume: current ? current.el.volume : 0,
      paused: current ? current.el.paused : null, loop: current ? current.loop : null,
      position: current ? current.el.currentTime : 0, duration: current ? current.el.duration : 0
    }),
    /* test helper: jump close to the end of the current track so its natural end can be observed quickly */
    _seekToEnd: () => { if (current && current.el.duration) current.el.currentTime = Math.max(0, current.el.duration - 1.2); }
  };
})(window);
