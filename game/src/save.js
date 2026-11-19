// save.js — save and load through localStorage. One clear job: persist the
// player's progress (cash, reputation, health, position, mission) and restore it.
const SAVE_KEY = 'sunset-coast-save-v1';

export function saveGame(G) {
  try {
    const data = {
      cash: G.cash, rep: G.rep, health: G.player.health,
      x: G.player.x, z: G.player.z, angle: G.player.angle,
      missionIndex: G.missionIndex, wanted: G.police.wanted,
      rivalsDown: G.missionRivalsDown || 0,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.x !== 'number') return null;
    return data;
  } catch { return null; }
}

export function hasSave() { return loadGame() !== null; }

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
