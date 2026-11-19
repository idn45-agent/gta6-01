// vehicles.js — cars: build them, park them, enter/exit them, drive them.
// One clear job: everything about the player's and the world's cars as meshes.
import * as THREE from 'three';
import { GRID_STEP, streetPoint, pickFrom } from './city.js';

export const CAR_COLORS = [0xd8382e, 0x2e6ad8, 0xf2c230, 0x38b06a, 0xe8e8e8, 0x222831, 0x8a4ad8, 0xd86a2e];
export const CAR_NAMES = ['Comet', 'Sandpiper', 'Marlin', 'Pelican', 'Sunrunner', 'Coconut', 'Flamingo', 'Tide'];

// Build a low-poly car mesh: body, cabin, wheels, headlights. `police` adds a light bar.
export function buildCarMesh(scene, color, police) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: police ? 0xf0f0f0 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.4), paint);
  body.position.y = 0.55; group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: police ? 0x1a1a1a : 0x2a3a4a }));
  cabin.position.set(0, 1.15, -0.2); group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(wx, 0.38, wz); group.add(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const lx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), lightMat);
    light.position.set(lx, 0.6, 2.22); group.add(light);
  }
  let lightBar = null;
  if (police) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.x = -0.4; lightBar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.x = 0.4; lightBar.add(blue);
    lightBar.position.y = 1.55; group.add(lightBar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.25, 4.42),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    stripe.position.y = 0.55; group.add(stripe);
  }
  scene.add(group);
  return { group, lightBar, wheels: group.children.filter((c) => c.geometry === wheelGeo) };
}

// Create the parked + traffic fleet. Returns an array of car records.
export function spawnCars(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = streetPoint(rng);
    const alongRoad = Math.abs(p.x % GRID_STEP) < 1;
    const angle = alongRoad ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const color = pickFrom(rng, CAR_COLORS);
    const mesh = buildCarMesh(scene, color, false);
    mesh.group.position.set(p.x, 0, p.z);
    mesh.group.rotation.y = angle;
    cars.push({
      id: i, name: pickFrom(rng, CAR_NAMES), color,
      mesh, x: p.x, z: p.z, angle, speed: 0, steering: 0,
      police: false, traffic: false, occupied: false, stolen: false,
    });
  }
  return cars;
}

export function spawnPoliceCar(scene, x, z) {
  const mesh = buildCarMesh(scene, 0xf0f0f0, true);
  mesh.group.position.set(x, 0, z);
  return {
    id: 1000 + Math.floor(Math.random() * 9000), name: 'Interceptor', color: 0xf0f0f0,
    mesh, x, z, angle: 0, speed: 0, steering: 0,
    police: true, traffic: false, occupied: false, stolen: false,
  };
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// Arcade driving: W/S accelerate and brake, A/D steer, speed caps at ~30 units/s.
export function driveCar(car, input, dt) {
  const forward = (input.keys.has('up') ? 1 : 0) - (input.keys.has('down') ? 1 : 0);
  const steer = (input.keys.has('left') ? 1 : 0) - (input.keys.has('right') ? 1 : 0);
  const target = forward * 30;
  car.speed += (target - car.speed) * Math.min(1, dt * (forward !== 0 ? 1.6 : 2.2));
  if (Math.abs(car.speed) < 0.05 && forward === 0) car.speed = 0;
  car.angle += steer * Math.min(1, Math.abs(car.speed) / 8) * 1.9 * dt * Math.sign(car.speed || 1);
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  car.mesh.group.position.set(car.x, 0, car.z);
  car.mesh.group.rotation.y = car.angle;
  return Math.abs(car.speed);
}
