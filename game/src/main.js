// main.js — boot and the one game loop: start screen, play, pause, game over.
// Wires every system together: world, city, input, vehicles, traffic, police,
// missions, combat, HUD, minimap, audio and saves. Also stages the ?shot= scenes
// the screenshots are taken from, and exposes window.__game for scripted play-tests.
import * as THREE from 'three';
import { makeRng, LANDMARKS, streetPoint } from './city.js';
import { buildWorld, resolveCollisions } from './world.js';
import { createInput, consumePress } from './input.js';
import { createAudio } from './audio.js';
import { spawnCars, nearestCar, driveCar } from './vehicles.js';
import { spawnPedestrians, updatePedestrians, makeTrafficDrivers, updateTraffic } from './traffic.js';
import { createPolice, addHeat, setWanted, updatePolice } from './police.js';
import { punch, checkVehicleHits, checkCarCollisions, regenHealth } from './combat.js';
import { startMission, updateMissions, pulseMarker } from './missions.js';
import { createHud } from './hud.js';
import { drawMinimap } from './minimap.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;
const rng = makeRng(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  G.camera.aspect = window.innerWidth / window.innerHeight;
  G.camera.updateProjectionMatrix();
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
const { colliders } = buildWorld(scene, rng);

// The player on foot: orange shirt, dark trousers, built from primitives.
function buildPlayerMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 1.15, 10),
    new THREE.MeshLambertMaterial({ color: 0xe86a2e }));
  body.position.y = 1.0; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xd9a077 }));
  head.position.y = 1.85; group.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.35),
    new THREE.MeshLambertMaterial({ color: 0x2a2a3a }));
  legs.position.y = 0.28; group.add(legs);
  scene.add(group);
  return group;
}

const G = {
  scene, camera, renderer, colliders, rng,
  player: {
    mesh: buildPlayerMesh(), x: -52, z: 44, angle: 0, health: 100,
    car: null, walkPhase: 0, speed: 0,
  },
  cars: [], peds: [], trafficDrivers: [],
  police: createPolice(),
  cash: 0, rep: 'Street', missionIndex: 0, missionTarget: null,
  objective: '', objectiveTitle: '', missionDistance: null, missionRivalsDown: 0,
  state: 'title', // title | play | pause | over
  lastPunch: 0, lastDragAt: 0, elapsed: 0,
  input: createInput(canvas),
  audio: createAudio(),
  hud: createHud(),
};
G.cars = spawnCars(scene, rng, 14);
G.peds = spawnPedestrians(scene, rng, 18);
G.trafficDrivers = makeTrafficDrivers(scene, rng, G.cars, 6);
G.toast = (msg) => G.hud.toast(msg);
G.hudDirty = true;

function movePlayerOnFoot(dt) {
  const input = G.input;
  const fwd = (input.keys.has('up') ? 1 : 0) - (input.keys.has('down') ? 1 : 0);
  const strafe = (input.keys.has('right') ? 1 : 0) - (input.keys.has('left') ? 1 : 0);
  if (fwd === 0 && strafe === 0) { G.player.speed = 0; return; }
  const speed = input.keys.has('sprint') ? 10 : 6;
  const yaw = input.camYaw;
  // Forward is where the camera looks; strafe is sideways to it.
  const mx = Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
  const mz = Math.cos(yaw) * fwd - Math.sin(yaw) * strafe;
  const len = Math.hypot(mx, mz) || 1;
  G.player.x += (mx / len) * speed * dt;
  G.player.z += (mz / len) * speed * dt;
  G.player.angle = Math.atan2(mx, mz);
  G.player.speed = speed;
  G.player.walkPhase += dt * 10;
  resolveCollisions(colliders, G.player, 0.6);
  G.player.mesh.position.set(G.player.x, Math.abs(Math.sin(G.player.walkPhase)) * 0.06, G.player.z);
  G.player.mesh.rotation.y = G.player.angle;
}

// E: step into the nearest car (stealing it raises the heat) or step out of one.
function tryEnterExitCar() {
  const p = G.player;
  if (p.car) {
    const car = p.car;
    car.occupied = false; car.speed = 0;
    p.car = null;
    p.x = car.x + Math.sin(car.angle + Math.PI / 2) * 2.5;
    p.z = car.z + Math.cos(car.angle + Math.PI / 2) * 2.5;
    p.mesh.visible = true;
    p.mesh.position.set(p.x, 0, p.z);
    G.audio.pickup();
    return;
  }
  const car = nearestCar(G.cars, p.x, p.z, 4.5);
  if (!car) return;
  if (!car.stolen && !car.police) {
    car.stolen = true;
    addHeat(G.police, 25, G.toast);
    G.toast(`You stole a ${car.name}!`);
  } else if (car.police) {
    G.toast('You cannot steal a police car!');
    return;
  }
  p.car = car;
  car.occupied = true;
  p.mesh.visible = false;
  G.audio.pickup();
}

// Third-person camera: behind the player (or the car), dragged with the mouse,
// gently swinging back behind the direction of travel.
function updateCamera(dt) {
  const input = G.input;
  const target = G.player.car || G.player;
  const heading = G.player.car ? G.player.car.angle : G.player.angle;
  const moving = G.player.car ? Math.abs(G.player.car.speed) > 2 : G.player.speed > 0.5;
  if (moving && performance.now() - G.lastDragAt > 2500) {
    let diff = heading - input.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    input.camYaw += diff * Math.min(1, dt * 1.2);
  }
  const dist = G.player.car ? 11 : 8.5;
  const height = 4.2 + Math.sin(input.camPitch) * 5;
  const cx = target.x - Math.sin(input.camYaw) * dist * Math.cos(input.camPitch);
  const cz = target.z - Math.cos(input.camYaw) * dist * Math.cos(input.camPitch);
  camera.position.set(cx, height, cz);
  camera.lookAt(target.x, 1.6, target.z);
}

function update(dt) {
  const input = G.input;
  if (consumePress(input, 'pause')) { togglePause(); return; }
  if (consumePress(input, 'mute')) { G.audio.toggleMute(); G.toast(G.audio.isMuted() ? 'Sound off' : 'Sound on'); }
  if (consumePress(input, 'enter')) tryEnterExitCar();
  if (consumePress(input, 'punch') && !G.player.car) punch(G);

  if (G.player.car) {
    const speed = driveCar(G.player.car, input, dt);
    resolveCollisions(colliders, G.player.car, 1.6);
    G.player.car.mesh.group.position.set(G.player.car.x, 0, G.player.car.z);
    G.player.x = G.player.car.x; G.player.z = G.player.car.z;
    G.audio.update(dt, Math.abs(speed), G.police.wanted);
    checkVehicleHits(G);
    checkCarCollisions(G);
  } else {
    movePlayerOnFoot(dt);
    G.audio.update(dt, G.player.speed, G.police.wanted);
  }
  updateTraffic(G.trafficDrivers, dt);
  updatePedestrians(G.peds, dt, G.player, colliders, resolveCollisions);
  updatePolice(G, dt);
  updateMissions(G, dt);
  pulseMarker(G.elapsed);
  regenHealth(G, dt);

  // Busted / wasted: at 0 health Ray wakes up at Sol Plaza, lighter by $200.
  if (G.player.health <= 0) {
    G.player.health = 100;
    G.cash = Math.max(0, G.cash - 200);
    setWanted(G.police, 0);
    if (G.player.car) { G.player.car.occupied = false; G.player.car = null; G.player.mesh.visible = true; }
    G.player.x = 10; G.player.z = 10;
    G.player.mesh.position.set(10, 0, 10);
    G.toast('Wasted! You wake up at Sol Plaza, $200 lighter.');
  }
  updateCamera(dt);
  G.hud.update(G);
  drawMinimap(document.getElementById('minimap'), G);
  G.elapsed += dt;
}

function togglePause() {
  if (G.state === 'play') {
    G.state = 'pause';
    document.getElementById('pause').style.display = 'flex';
  } else if (G.state === 'pause') {
    G.state = 'play';
    document.getElementById('pause').style.display = 'none';
  }
}

function startGame(save) {
  if (save) {
    G.cash = save.cash; G.rep = save.rep; G.player.health = save.health;
    G.player.x = save.x; G.player.z = save.z; G.player.angle = save.angle;
    G.player.mesh.position.set(save.x, 0, save.z);
    setWanted(G.police, save.wanted || 0);
    G.missionRivalsDown = save.rivalsDown || 0;
    startMission(G, save.missionIndex || 0);
  } else {
    startMission(G, 0);
  }
  document.getElementById('start').style.display = 'none';
  document.getElementById('pause').style.display = 'none';
  G.hud.show();
  G.state = 'play';
  G.audio.unlock();
  G.toast('Welcome to Palmera Bay, Ray.');
}

// ---- Screenshot staging: ?shot=chase|street|drive|mission&seed=1 ----------------
// Each scene plays the real game from a staged position so the screenshot shows
// the systems working, not a menu.
function stageShot(name) {
  startGame(null);
  const p = G.player;
  if (name === 'chase') {
    startMission(G, 1); // Hot Wheels: wanted 2, hideout objective
    setWanted(G.police, 3);
    const car = G.cars.find((c) => !c.police && !c.traffic);
    p.x = car.x; p.z = car.z;
    tryEnterExitCar();
    G.player.car.x = 0; G.player.car.z = 30; G.player.car.angle = Math.PI;
    G.player.car.mesh.group.position.set(0, 0, 30);
    G.player.x = 0; G.player.z = 30; // keep the player record on the car
    G.player.car.speed = 14;
    // Camera in FRONT of the fleeing car, looking back at it: the police
    // chasing behind it are in the frame. Freeze the auto-follow swing
    // (lastDragAt) so the camera holds this angle for the shot.
    G.input.camYaw = 0;
    // Freeze the auto-follow swing for 10 s so the camera holds this angle
    // through the slow software-rendered drive before the shot.
    G.lastDragAt = performance.now() + 10000;
    // Let the police close in for a few seconds before the shot. Their rams
    // hurt during staging, so top the health back up afterwards.
    for (let i = 0; i < 240; i++) updatePolice(G, 1 / 60);
    G.player.health = 100;
  } else if (name === 'street') {
    p.x = 8; p.z = 24; p.angle = 2.6;
    p.mesh.position.set(8, 0, 24);
    G.input.camYaw = 2.6;
    startMission(G, 0);
    for (let i = 0; i < 120; i++) { updateTraffic(G.trafficDrivers, 1 / 60); updatePedestrians(G.peds, 1 / 60, G.player, colliders, resolveCollisions); }
  } else if (name === 'drive') {
    const car = G.cars.find((c) => !c.police && !c.traffic);
    p.x = car.x; p.z = car.z;
    tryEnterExitCar();
    G.player.car.x = 88; G.player.car.z = -30; G.player.car.angle = 0;
    G.player.car.mesh.group.position.set(88, 0, -30);
    G.player.x = 88; G.player.z = -30; // keep the player record on the car
    G.player.car.speed = 20;
    G.input.camYaw = 0;
    startMission(G, 0);
    for (let i = 0; i < 120; i++) updateTraffic(G.trafficDrivers, 1 / 60);
  } else if (name === 'mission') {
    startMission(G, 2); // Sunset Showdown on the beach
    p.x = LANDMARKS.beach.x - 18; p.z = LANDMARKS.beach.z + 4; p.angle = Math.PI / 2;
    p.mesh.position.set(p.x, 0, p.z);
    G.input.camYaw = Math.PI / 2;
    for (let i = 0; i < 90; i++) updatePedestrians(G.peds, 1 / 60, G.player, colliders, resolveCollisions);
  }
  updateCamera(0.016);
  renderer.render(scene, camera);
  window.__shotReady = true;
}

// ---- Buttons, menus, autosave ---------------------------------------------------
document.getElementById('playBtn').addEventListener('click', () => startGame(null));
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('saveBtn').addEventListener('click', () => {
  G.toast(saveGame(G) ? 'Game saved.' : 'Save failed — storage is off.');
});
document.getElementById('restartBtn').addEventListener('click', () => {
  clearSave(); window.location.search = '';
});
if (hasSave()) document.getElementById('continueBtn').style.display = 'inline-block';
document.getElementById('continueBtn').addEventListener('click', () => startGame(loadGame()));
canvas.addEventListener('mousedown', () => { G.lastDragAt = performance.now(); });
setInterval(() => { if (G.state === 'play') saveGame(G); }, 30000); // autosave every 30 s

// Test hook: the CDP play-test drives the game through this object.
window.__game = {
  G, startGame, stageShot,
  state() {
    return {
      state: G.state, x: G.player.x, z: G.player.z, health: G.player.health,
      cash: G.cash, wanted: G.police.wanted, mission: G.missionIndex,
      inCar: !!G.player.car, policeUnits: G.police.units.length,
      pedsAlive: G.peds.filter((p) => p.alive).length,
    };
  },
};

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (G.state === 'play') update(dt);
  renderer.render(scene, camera);
}

if (shot) {
  stageShot(shot);
  requestAnimationFrame(frame);
} else {
  // Title screen backdrop: a slow orbit over Sol Plaza while the menu shows.
  camera.position.set(40, 26, 40);
  camera.lookAt(0, 2, 0);
  requestAnimationFrame(frame);
}
