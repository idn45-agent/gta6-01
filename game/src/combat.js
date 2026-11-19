// combat.js — fist fights and vehicle ramming. One clear job: hurting people
// (pedestrians, rivals, police) and taking damage back.
import { addHeat } from './police.js';

// The player's punch: nearest living person within 2.2 units takes 34 damage.
// Knocking someone out is a crime; knocking out a mission rival counts toward the mission.
export function punch(G) {
  const now = performance.now();
  if (now - G.lastPunch < 450) return false;
  G.lastPunch = now;
  G.audio.punch();
  let hit = null, bestD = 2.4;
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    const d = Math.hypot(ped.x - G.player.x, ped.z - G.player.z);
    if (d < bestD) { bestD = d; hit = ped; }
  }
  if (!hit) return false;
  hit.health -= 34;
  hit.x += (hit.x - G.player.x) * 0.4;
  hit.z += (hit.z - G.player.z) * 0.4;
  if (hit.health <= 0) {
    hit.alive = false;
    hit.mesh.visible = false;
    if (hit.hostile) {
      G.missionRivalsDown = (G.missionRivalsDown || 0) + 1;
      G.toast('Rival down!');
      G.audio.cash();
    } else {
      addHeat(G.police, 25, G.toast);
      G.toast('You knocked out a bystander — the cops noticed!');
    }
  }
  return true;
}

// Driving into a pedestrian knocks them down and raises the wanted level.
export function checkVehicleHits(G) {
  if (!G.player.car) return;
  const car = G.player.car;
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    const d = Math.hypot(ped.x - car.x, ped.z - car.z);
    if (d < 2.0) {
      ped.alive = false;
      ped.mesh.visible = false;
      ped.x += Math.sin(car.angle) * 6;
      ped.z += Math.cos(car.angle) * 6;
      addHeat(G.police, 25, G.toast);
      G.audio.crash();
      G.toast('You hit a pedestrian!');
    }
  }
}

// Bumping traffic cars at speed damages the player's car handling and the player.
export function checkCarCollisions(G) {
  if (!G.player.car) return;
  const car = G.player.car;
  for (const other of G.cars) {
    if (other === car || other.police) continue;
    const d = Math.hypot(other.x - car.x, other.z - car.z);
    if (d < 3.2 && Math.abs(car.speed) > 6) {
      car.speed *= 0.4;
      G.player.health = Math.max(0, G.player.health - 4);
      G.audio.crash();
    }
  }
}

// The player regenerates a little health when calm and out of trouble.
export function regenHealth(G, dt) {
  if (G.police.wanted === 0 && G.player.health > 0 && G.player.health < 100) {
    G.player.health = Math.min(100, G.player.health + 1.5 * dt);
  }
}
