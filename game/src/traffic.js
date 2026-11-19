// traffic.js — the living street: traffic cars cruising the grid and pedestrians
// strolling the sidewalks. One clear job: ambient life that is not the player.
import * as THREE from 'three';
import { GRID_STEP, CITY_MIN, CITY_MAX, streetPoint, sidewalkPoint, pickFrom } from './city.js';
import { buildCarMesh, CAR_COLORS, CAR_NAMES } from './vehicles.js';

const SHIRT_COLORS = [0xe85a5a, 0x5a9ae8, 0x5ae88a, 0xe8d45a, 0xffffff, 0x333333, 0xe85ab0, 0x8a5ae8];

// Pedestrian mesh: body cylinder, head sphere, simple walking bob.
export function buildPedestrian(scene, shirtColor) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.1, 8),
    new THREE.MeshLambertMaterial({ color: shirtColor }));
  body.position.y = 0.95; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a077 }));
  head.position.y = 1.75; group.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2a2a3a }));
  legs.position.y = 0.25; group.add(legs);
  scene.add(group);
  return group;
}

export function spawnPedestrians(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = sidewalkPoint(rng);
    const mesh = buildPedestrian(scene, pickFrom(rng, SHIRT_COLORS));
    mesh.position.set(p.x, 0, p.z);
    peds.push({
      id: i, mesh, x: p.x, z: p.z, angle: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 1.2, walkPhase: rng() * 6, alive: true,
      hostile: false, health: 100, targetX: p.x, targetZ: p.z,
    });
  }
  return peds;
}

// Pedestrians wander: pick a nearby sidewalk point, walk to it, pick another.
// Hostile ones (mission rivals) instead chase the player.
export function updatePedestrians(peds, dt, player, colliders, resolveCollisions) {
  for (const ped of peds) {
    if (!ped.alive) continue;
    let tx = ped.targetX, tz = ped.targetZ;
    if (ped.hostile && player) { tx = player.x; tz = player.z; }
    const dx = tx - ped.x, dz = tz - ped.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.2) {
      if (!ped.hostile) {
        ped.targetX = ped.x + (Math.random() - 0.5) * 40;
        ped.targetZ = ped.z + (Math.random() - 0.5) * 40;
        ped.targetX = Math.max(-95, Math.min(110, ped.targetX));
        ped.targetZ = Math.max(-95, Math.min(110, ped.targetZ));
      }
      continue;
    }
    const step = Math.min(dist, ped.speed * dt * (ped.hostile ? 2.2 : 1));
    ped.angle = Math.atan2(dx, dz);
    ped.x += (dx / dist) * step;
    ped.z += (dz / dist) * step;
    resolveCollisions(colliders, ped, 0.5);
    ped.walkPhase += dt * 8;
    ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.walkPhase)) * 0.08, ped.z);
    ped.mesh.rotation.y = ped.angle;
  }
}

// Traffic cars: pick some parked cars to drive loops along the grid roads.
export function makeTrafficDrivers(scene, rng, cars, count) {
  const drivers = [];
  const pool = cars.filter((c) => !c.police).slice(0, count);
  for (const car of pool) {
    car.traffic = true;
    const alongX = Math.abs(car.x % GRID_STEP) < 1;
    drivers.push({
      car, alongX, dir: rng() < 0.5 ? 1 : -1,
      speed: 7 + rng() * 5, lane: (rng() < 0.5 ? -1 : 1) * 2.2,
    });
  }
  return drivers;
}

export function updateTraffic(drivers, dt) {
  for (const d of drivers) {
    const car = d.car;
    if (d.alongX) {
      car.z += d.dir * d.speed * dt;
      car.x += (Math.round(car.x / GRID_STEP) * GRID_STEP + d.lane - car.x) * Math.min(1, dt * 2);
      if (car.z > CITY_MAX + 10) { car.z = CITY_MIN - 10; d.dir = 1; }
      if (car.z < CITY_MIN - 10) { car.z = CITY_MAX + 10; d.dir = -1; }
      car.angle = d.dir > 0 ? Math.PI : 0;
    } else {
      car.x += d.dir * d.speed * dt;
      car.z += (Math.round(car.z / GRID_STEP) * GRID_STEP + d.lane - car.z) * Math.min(1, dt * 2);
      if (car.x > CITY_MAX + 10) { car.x = CITY_MIN - 10; d.dir = 1; }
      if (car.x < CITY_MIN - 10) { car.x = CITY_MAX + 10; d.dir = -1; }
      car.angle = d.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.mesh.group.position.set(car.x, 0, car.z);
    car.mesh.group.rotation.y = car.angle;
  }
}
