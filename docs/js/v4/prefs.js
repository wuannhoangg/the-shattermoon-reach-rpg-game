/* Global player preferences (independent of save slots), persisted in localStorage. */
(function (g) {
  'use strict';
  const KEY = (g.VTN_TEST ? 'qa-' : '') + 'vtn4-prefs';
  const DEFAULTS = {
    musicOn: true, musicTrack: 'auto', musicVolume: .5,
    sfxOn: true, sfxVolume: .5,
    difficulty: 'normal',
    textSpeed: 1, battleSpeed: 1,
    vfx: 'full', shake: true, numbers: true,
    pathSpeed: 'normal', motion: 'full'
  };
  const DIFFICULTY = {
    easy:      {name: 'Dễ',        note: 'Địch yếu hơn, bạn đánh mạnh hơn. Hợp để theo dõi cốt truyện.', foe: .65, hero: 1.25},
    normal:    {name: 'Thường',    note: 'Cân bằng theo thiết kế gốc.',                                     foe: 1,   hero: 1},
    hard:      {name: 'Khó',       note: 'Địch đánh đau hơn, bạn phải tính từng lượt.',                     foe: 1.3, hero: .92},
    nightmare: {name: 'Ác mộng',   note: 'Mọi sai lầm đều trả giá bằng Nến Hồn.',                            foe: 1.65, hero: .82}
  };
  const PATH_SPEED = {slow: .45, normal: .65, fast: 1};
  let value = {...DEFAULTS};
  try { value = {...DEFAULTS, ...JSON.parse(g.localStorage.getItem(KEY) || '{}')}; } catch { /* storage may be blocked */ }
  const listeners = new Set();
  function save() { try { g.localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* ignore */ } }
  /* another tab/window changed the settings: follow it, so music switched off in one place is off everywhere */
  g.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    let incoming = {}; try { incoming = JSON.parse(e.newValue || '{}'); } catch { return; }
    const next = {...DEFAULTS, ...incoming}, patch = {};
    for (const k of Object.keys(next)) if (next[k] !== value[k]) patch[k] = next[k];
    if (!Object.keys(patch).length) return;
    value = next; listeners.forEach(fn => { try { fn(value, patch); } catch (err) { console.error(err); } });
  });
  g.VTNPrefs = {
    DEFAULTS, DIFFICULTY, PATH_SPEED,
    get: () => value,
    set(patch) { value = {...value, ...patch}; save(); listeners.forEach(fn => { try { fn(value, patch); } catch (e) { console.error(e); } }); return value; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    difficulty: () => DIFFICULTY[value.difficulty] || DIFFICULTY.normal,
    pathFactor: () => PATH_SPEED[value.pathSpeed] || PATH_SPEED.normal
  };
})(window);
