(function (g) {
  'use strict';
  const R = g.VTNRules;
  const LIMIT = 4;
  function actor(state, uid = 'hero') {
    return uid === 'hero' ? state?.hero : [...(state?.party || []), ...(state?.storage || [])].find(m => String(m.uid) === String(uid));
  }
  function monsterLearned(state, a) {
    const species = R.by('monsters', a?.speciesId);
    const learned = Array.isArray(a?.learnedSkills) ? a.learnedSkills : [];
    const levelLearned = (species?.learnset || [])
      .filter(entry => Number(entry.level) <= Number(a?.level || 1))
      .map(entry => entry.skillId);
    return [...new Set([...learned, ...levelLearned])];
  }
  function available(state, uid = 'hero') {
    const a = actor(state, uid);
    if (!a) return [];
    const ids = uid === 'hero' ? a.learned : monsterLearned(state, a);
    return [...new Set(ids)].filter(id => R.by('skills', id)?.kind !== 'passive' && R.by('skills', id));
  }
  function defaults(state, uid = 'hero') {
    const ids = available(state, uid);
    // Learned arrays are chronological in saves; the newest skills are the
    // most useful default, while the levelset order makes legacy monsters
    // deterministic when they have no explicit learnedSkills field.
    return ids.slice().reverse().slice(0, LIMIT);
  }
  function equipped(state, uid = 'hero') {
    const a = actor(state, uid), allowed = available(state, uid);
    if (!a) return [];
    // Missing field is a legacy save, while an empty slot is an explicit choice.
    if (!Array.isArray(a.equippedSkills)) return defaults(state, uid);
    const seen = new Set();
    return Array.from({length: LIMIT}, (_, i) => {
      const id = a.equippedSkills[i];
      if (!allowed.includes(id) || seen.has(id)) return null;
      seen.add(id); return id;
    });
  }
  function set(state, uid, slot, id) {
    const a = actor(state, uid), index = Number(slot);
    if (!a || !Number.isInteger(index) || index < 0 || index >= LIMIT || (id && !available(state, uid).includes(id))) return false;
    const slots = Array.from({length: LIMIT}, (_, i) => equipped(state, uid)[i] || null);
    if (id && slots.some((value, i) => i !== index && value === id)) {
      // Selecting an already-equipped skill is a deliberate swap, which is
      // easier to understand on a four-slot screen than a silent rejection.
      const other = slots.indexOf(id);
      slots[other] = slots[index] || null;
    }
    slots[index] = id || null; a.equippedSkills = slots; return true;
  }
  function snapshot(state) {
    const result = {};
    for (const uid of ['hero', ...state.party.map(m => String(m.uid))]) {
      const a = actor(state, uid), slots = equipped(state, uid);
      if (!Array.isArray(a.equippedSkills)) a.equippedSkills = slots.slice();
      result[uid] = slots.filter(Boolean);
    }
    return result;
  }
  function migrateState(state) {
    if (!state || typeof state !== 'object') return state;
    const heroIds = [...new Set(Array.isArray(state.hero?.learned) ? state.hero.learned : [])]
      .filter(id => R.by('skills', id)?.kind !== 'passive' && R.by('skills', id));
    if (state.hero) {
      const current = Array.isArray(state.hero.equippedSkills) ? state.hero.equippedSkills : heroIds.slice().reverse();
      const seen = new Set();
      state.hero.equippedSkills = Array.from({length: LIMIT}, (_, i) => {
        const id = current[i];
        if (!heroIds.includes(id) || seen.has(id)) return null;
        seen.add(id); return id;
      });
    }
    for (const monster of [...(state.party || []), ...(state.storage || [])]) {
      const ids = monsterLearned(state, monster).filter(id => R.by('skills', id)?.kind !== 'passive' && R.by('skills', id));
      monster.learnedSkills = ids;
      const current = Array.isArray(monster.equippedSkills) ? monster.equippedSkills : ids.slice().reverse();
      const seen = new Set();
      monster.equippedSkills = Array.from({length: LIMIT}, (_, i) => {
        const id = current[i];
        if (!ids.includes(id) || seen.has(id)) return null;
        seen.add(id); return id;
      });
    }
    return state;
  }
  const nativeNewState = R.newState;
  const nativeDecode = R.decode;
  if (typeof nativeNewState === 'function') R.newState = (...args) => migrateState(nativeNewState(...args));
  if (typeof nativeDecode === 'function') R.decode = raw => migrateState(nativeDecode(raw));
  g.VTNLoadouts = {LIMIT, actor, available, defaults, equipped, set, snapshot, migrateState, monsterLearned};
})(globalThis);
