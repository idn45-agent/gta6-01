// hud.js — the DOM heads-up display: health, cash, reputation, wanted stars,
// the mission objective and toast messages. One clear job: show the game state.
export function createHud() {
  const el = {
    hud: document.getElementById('hud'),
    cash: document.getElementById('cash'),
    rep: document.getElementById('rep'),
    healthfill: document.getElementById('healthfill'),
    stars: document.getElementById('stars'),
    objtitle: document.getElementById('objtitle'),
    objtext: document.getElementById('objtext'),
    toast: document.getElementById('toast'),
    status: document.getElementById('status'),
  };
  let toastTimer = null;
  return {
    show() { el.hud.style.display = 'block'; },
    hide() { el.hud.style.display = 'none'; },
    update(G) {
      el.cash.textContent = `$${Math.floor(G.cash).toLocaleString('en-US')}`;
      el.rep.textContent = G.rep;
      el.healthfill.style.width = `${Math.max(0, Math.min(100, G.player.health))}%`;
      el.healthfill.style.background = G.player.health > 50
        ? 'linear-gradient(90deg,#37d67a,#9be15d)'
        : G.player.health > 25 ? 'linear-gradient(90deg,#e8a83a,#ffd23e)' : 'linear-gradient(90deg,#d8382e,#ff7a5a)';
      const filled = '★'.repeat(G.police.wanted);
      const empty = '☆'.repeat(5 - G.police.wanted);
      el.stars.textContent = filled + empty;
      el.objtitle.textContent = G.objectiveTitle || 'Sunset Coast';
      const dist = G.missionDistance != null ? ` — ${G.missionDistance}m away` : '';
      el.objtext.textContent = (G.objective || '') + dist;
    },
    toast(message) {
      el.toast.textContent = message;
      el.toast.style.display = 'block';
      el.status.textContent = message;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.toast.style.display = 'none'; }, 3500);
    },
  };
}
