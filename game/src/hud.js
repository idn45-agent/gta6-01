// HUD for Sunset Coast v2 — drives the DOM overlay: health, money,
// wanted stars, objective panel, speedometer, toasts, banners and the
// start / pause / wasted / mission-passed screens.
import { rankFor } from './save.js';
import { fmtMoney, clamp } from './util.js';

export class HUD {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.hud = this.el('hud');
    this.moneyEl = this.el('money');
    this.wantedEl = this.el('wanted');
    this.repEl = this.el('repLine');
    this.healthBar = this.el('healthBar');
    this.healthNum = this.el('healthNum');
    this.vehicleHp = this.el('vehicleHp');
    this.rankName = this.el('rankName');
    this.objectiveEl = this.el('objective');
    this.objectiveTitle = this.el('objectiveTitle');
    this.objectiveText = this.el('objectiveText');
    this.objectiveDist = this.el('objectiveDist');
    this.missionTimer = this.el('missionTimer');
    this.speedo = this.el('speedo');
    this.speedNum = this.el('speedNum');
    this.carName = this.el('carName');
    this.toastEl = this.el('toast');
    this.hintEl = this.el('hint');
    this.bannerEl = this.el('banner');
    this.bannerTitle = this.el('bannerTitle');
    this.bannerSub = this.el('bannerSub');
    this.interactEl = this.el('interact');
    this.toastTimer = null;
    this.bannerTimer = null;
    this.lastWanted = -1;
  }

  show() { this.hud.classList.remove('hidden'); }
  hide() { this.hud.classList.add('hidden'); }

  update(state) {
    // state: { health, money, rep, wanted, missionsDone, vehicle, speedKmh, carName }
    this.healthBar.style.width = `${clamp(state.health, 0, 100)}%`;
    this.healthNum.textContent = Math.ceil(state.health);
    this.vehicleHp.textContent = state.vehicle
      ? `Car ${Math.max(0, Math.ceil(state.vehicle.hp))}%`
      : 'On foot';
    this.moneyEl.textContent = fmtMoney(state.money);
    this.rankName.textContent = rankFor(state.rep);
    this.repEl.textContent = `REP ${state.rep} · Missions ${state.missionsDone}/6`;
    if (state.wanted !== this.lastWanted) {
      this.lastWanted = state.wanted;
      let stars = '';
      for (let i = 0; i < 5; i++) {
        stars += i < state.wanted ? '★' : '<span class="dim">★</span>';
      }
      this.wantedEl.innerHTML = stars;
    }
    if (state.vehicle) {
      this.speedo.classList.remove('hidden');
      this.speedNum.textContent = Math.round(state.speedKmh);
      this.carName.textContent = state.carName;
    } else {
      this.speedo.classList.add('hidden');
    }
  }

  setObjective(title, text, distMeters) {
    if (!title) { this.objectiveEl.classList.add('hidden'); return; }
    this.objectiveEl.classList.remove('hidden');
    this.objectiveTitle.textContent = title.toUpperCase();
    this.objectiveText.textContent = text;
    this.objectiveDist.textContent = distMeters != null ? `${Math.round(distMeters)}m` : '';
  }

  setTimer(seconds) {
    if (seconds == null) { this.missionTimer.classList.add('hidden'); return; }
    this.missionTimer.classList.remove('hidden');
    const s = Math.max(0, Math.ceil(seconds));
    this.missionTimer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  toast(html, seconds = 3) {
    this.toastEl.innerHTML = html;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), seconds * 1000);
  }

  hint(html) { this.hintEl.innerHTML = html || ''; }

  banner(title, sub = '', seconds = 2.6) {
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub;
    this.bannerEl.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.bannerEl.classList.remove('show'), seconds * 1000);
  }

  interact(text) {
    if (!text) { this.interactEl.classList.add('hidden'); return; }
    this.interactEl.classList.remove('hidden');
    this.interactEl.textContent = text;
  }

  // --- screens ---
  showStart(save, missionsDone) {
    const screen = this.el('startScreen');
    screen.classList.remove('hidden');
    const progress = this.el('missionProgress');
    progress.innerHTML = '<ul class="missionList">' + [
      'First Delivery', 'Hot Wheels', 'Tail the Courier',
      'Sunset Grand Prix', 'Lose the Heat', 'The Big Score',
    ].map((name, i) => {
      const cls = missionsDone.includes(i) ? 'done' : (i === missionsDone.length ? 'active' : 'locked');
      const mark = missionsDone.includes(i) ? '✓' : (i === missionsDone.length ? '▶' : '·');
      return `<li class="${cls}">${mark} ${name}</li>`;
    }).join('') + '</ul>';
    const cont = this.el('continueBtn');
    if (save) cont.classList.remove('hidden');
    else cont.classList.add('hidden');
  }

  hideStart() { this.el('startScreen').classList.add('hidden'); }
  showPause(stats) {
    this.el('pauseScreen').classList.remove('hidden');
    this.el('pauseStats').innerHTML = stats;
  }
  hidePause() { this.el('pauseScreen').classList.add('hidden'); }
  showWasted(stats, text) {
    this.el('wastedScreen').classList.remove('hidden');
    this.el('wastedText').textContent = text;
    this.el('wastedStats').innerHTML = stats;
  }
  hideWasted() { this.el('wastedScreen').classList.add('hidden'); }
  showMissionPassed(title, text, stats) {
    this.el('missionScreen').classList.remove('hidden');
    this.el('missionScreenTitle').textContent = title;
    this.el('missionScreenText').textContent = text;
    this.el('missionScreenStats').innerHTML = stats;
  }
  hideMissionPassed() { this.el('missionScreen').classList.add('hidden'); }

  statHtml(stats) {
    return stats.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  }
}
