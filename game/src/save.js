// Save / load for Sunset Coast v2 — localStorage only, no network.
// Stores money, reputation, completed missions, collected shells and
// the player's last position. Autosaves after every mission and on
// page hide; the start screen offers Continue when a save exists.
const KEY = 'sunsetcoast2-save-v1';

export const RANKS = ['Rookie', 'Hustler', 'Wheelman', 'Street Boss', 'King of Palmera'];

export function rankFor(rep) {
  if (rep >= 2400) return RANKS[4];
  if (rep >= 1500) return RANKS[3];
  if (rep >= 800) return RANKS[2];
  if (rep >= 300) return RANKS[1];
  return RANKS[0];
}

export function defaultSave() {
  return {
    money: 250,
    rep: 0,
    missionsDone: [],      // mission ids, in order
    shells: [],            // collected shell indices
    taxiDone: 0,
    racesWon: 0,
    totalEarned: 0,
    position: { x: 20, z: 40 },
    createdAt: Date.now(),
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return { ...defaultSave(), ...data };
  } catch (e) {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
