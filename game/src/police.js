// police.js — the wanted level and the Palmera Bay Police Department.
// One clear job: stars go up when the player commits crimes, police cars chase and
// ram the player while stars are up, and stars cool down when the player behaves.
import { spawnPoliceCar } from './vehicles.js';

export const MAX_WANTED = 5;

export function createPolice() {
  return { wanted: 0, heat: 0, calmTimer: 0, units: [], flashTimer: 0 };
}

// A crime adds heat; every 25 heat is one more star (max 5).
export function addHeat(police, amount, toast) {
  police.heat = Math.min(125, police.heat + amount);
  const newWanted = Math.max(police.wanted, Math.min(MAX_WANTED, Math.ceil(police.heat / 25)));
  if (newWanted > police.wanted) {
    police.wanted = newWanted;
    if (toast) toast(`WANTED — ${newWanted} star${newWanted > 1 ? 's' : ''}! Lose the cops!`);
  }
  police.calmTimer = 0;
  return police.wanted;
}

export function setWanted(police, stars) {
  police.wanted = Math.max(0, Math.min(MAX_WANTED, stars));
  police.heat = police.wanted * 25;
  police.calmTimer = 0;
}

// Keep the right number of police units on the street and steer them at the player.
export function updatePolice(G, dt) {
  const police = G.police;
  const scene = G.scene;
  // Spawn or retire units to match the wanted level.
  while (police.units.length < police.wanted) {
    const a = Math.random() * Math.PI * 2;
    const car = spawnPoliceCar(scene, G.player.x + Math.cos(a) * 26, G.player.z + Math.sin(a) * 26);
    car.traffic = false;
    police.units.push(car);
    G.cars.push(car);
  }
  while (police.units.length > police.wanted) {
    const car = police.units.pop();
    scene.remove(car.mesh.group);
    const idx = G.cars.indexOf(car);
    if (idx >= 0) G.cars.splice(idx, 1);
  }
  // Chase: steer toward the player, ram on contact, flash the light bar.
  police.flashTimer += dt;
  const flashOn = Math.floor(police.flashTimer * 6) % 2 === 0;
  for (const car of police.units) {
    const dx = G.player.x - car.x, dz = G.player.z - car.z;
    const dist = Math.hypot(dx, dz) || 1;
    const targetAngle = Math.atan2(dx, dz);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const wantSpeed = dist > 4 ? 26 : 12;
    car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.4);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    car.mesh.group.position.set(car.x, 0, car.z);
    car.mesh.group.rotation.y = car.angle;
    if (car.mesh.lightBar) car.mesh.lightBar.visible = flashOn;
    // Ram: shove the player and hurt them when the unit closes in.
    if (dist < 2.6) {
      G.player.x += (dx / dist) * -2.2;
      G.player.z += (dz / dist) * -2.2;
      G.player.health = Math.max(0, G.player.health - 14 * dt * 4);
      G.audio.crash();
    }
  }
  // Cool down: 20 calm seconds drop one star.
  if (police.wanted > 0) {
    police.calmTimer += dt;
    if (police.calmTimer > 20) {
      police.wanted -= 1;
      police.heat = police.wanted * 25;
      police.calmTimer = 0;
    }
  }
}
