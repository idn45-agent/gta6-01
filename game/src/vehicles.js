// Vehicles for Sunset Coast v2 — low-poly cars built from boxes, with
// arcade handling per type (sedan, sport, truck, taxi, police, bike).
// Cars are meshes + a small physics state; the player, traffic and
// police all drive the same Vehicle class.
import * as THREE from 'three';
import { clamp, lerp, angleLerp } from './util.js';

export const CAR_TYPES = {
  sedan:  { name: 'Vega Sedan',   topSpeed: 34, accel: 16, brake: 30, grip: 2.6, color: 0x4a7fb8, wheels: 4 },
  sport:  { name: 'Comet GT',     topSpeed: 48, accel: 24, brake: 34, grip: 2.2, color: 0xe23a4e, wheels: 4 },
  truck:  { name: 'Hauler Truck', topSpeed: 26, accel: 11, brake: 24, grip: 3.0, color: 0x8a7a4a, wheels: 4 },
  taxi:   { name: 'Bay Taxi',     topSpeed: 36, accel: 17, brake: 30, grip: 2.6, color: 0xf2c230, wheels: 4 },
  police: { name: 'PBPD Interceptor', topSpeed: 44, accel: 22, brake: 34, grip: 2.4, color: 0x1c2a44, wheels: 4 },
  bike:   { name: 'Sunset Bike',  topSpeed: 42, accel: 21, brake: 32, grip: 1.9, color: 0x9a4de2, wheels: 2 },
};

const BODY_COLORS = [0x4a7fb8, 0xe23a4e, 0x7dff9b, 0xf2c230, 0x9a4de2, 0xd8d8e0, 0x2a2f3a, 0xff7b54];

export function randomBodyColor(rng) {
  return BODY_COLORS[Math.floor(rng() * BODY_COLORS.length)];
}

function makeCarMesh(typeKey, color) {
  const type = CAR_TYPES[typeKey];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2438 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x181c24 });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  if (typeKey === 'bike') {
    box(0.5, 0.5, 2.2, bodyMat, 0, 0.7, 0);
    box(0.4, 0.6, 0.6, darkMat, 0, 1.1, -0.4);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.25, 12);
    const w1 = new THREE.Mesh(wheelGeo, darkMat); w1.rotation.z = Math.PI / 2; w1.position.set(0, 0.42, 0.85); g.add(w1);
    const w2 = new THREE.Mesh(wheelGeo, darkMat); w2.rotation.z = Math.PI / 2; w2.position.set(0, 0.42, -0.85); g.add(w2);
    return { group: g, wheels: [w1, w2] };
  }
  const len = typeKey === 'truck' ? 5.6 : 4.4;
  const wid = typeKey === 'truck' ? 2.4 : 2.0;
  box(wid, 0.75, len, bodyMat, 0, 0.62, 0);                    // chassis
  box(wid * 0.88, 0.62, len * 0.52, glassMat, 0, 1.28, -len * 0.05); // cabin
  box(wid * 0.9, 0.1, len * 0.2, bodyMat, 0, 1.62, -len * 0.05);     // roof
  // headlights / taillights
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  box(0.4, 0.18, 0.1, lightMat, -wid * 0.32, 0.7, len / 2 + 0.02);
  box(0.4, 0.18, 0.1, lightMat, wid * 0.32, 0.7, len / 2 + 0.02);
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a });
  box(0.4, 0.18, 0.1, tailMat, -wid * 0.32, 0.7, -len / 2 - 0.02);
  box(0.4, 0.18, 0.1, tailMat, wid * 0.32, 0.7, -len / 2 - 0.02);
  if (typeKey === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffe94d }));
    sign.position.set(0, 1.85, 0);
    g.add(sign);
  }
  if (typeKey === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2a3a }));
    bar.position.set(0, 1.72, 0);
    g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.02, 0.2, len * 0.9),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.set(0, 0.85, 0);
    g.add(stripe);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheels = [];
  for (const [wx, wz] of [[-wid / 2, len * 0.32], [wid / 2, len * 0.32], [-wid / 2, -len * 0.32], [wid / 2, -len * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  return { group: g, wheels };
}

export class Vehicle {
  constructor(scene, typeKey, x, z, heading, color) {
    this.typeKey = typeKey;
    this.type = CAR_TYPES[typeKey];
    this.scene = scene;
    const built = makeCarMesh(typeKey, color ?? this.type.color);
    this.group = built.group;
    this.wheels = built.wheels;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
    scene.add(this.group);
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.hp = 100;
    this.driver = null;      // 'player' | 'traffic' | 'police' | null (parked)
    this.stolen = false;
    this.dead = false;
    this.length = typeKey === 'truck' ? 5.6 : 4.4;
    this.width = typeKey === 'truck' ? 2.4 : 2.0;
    this.spin = 0;
  }

  get pos() { return this.group.position; }

  // Arcade drive step. throttle -1..1, steerInput -1..1, handbrake bool.
  drive(dt, throttle, steerInput, handbrake) {
    const t = this.type;
    const targetSteer = steerInput * 0.55;
    this.steer = lerp(this.steer, targetSteer, 1 - Math.exp(-8 * dt));
    if (throttle > 0) this.speed += t.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= t.brake * dt;      // brake
      else this.speed += t.accel * 0.55 * throttle * dt;      // reverse
    }
    // drag + rolling resistance
    this.speed -= this.speed * (handbrake ? 2.2 : 0.35) * dt;
    if (handbrake) this.speed -= this.speed * 1.5 * dt;
    this.speed = clamp(this.speed, -t.topSpeed * 0.45, t.topSpeed);
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    // steering only bites while moving
    const steerFactor = clamp(Math.abs(this.speed) / 8, 0, 1);
    this.heading += this.steer * (this.speed / t.topSpeed) * t.grip * steerFactor * dt * (this.speed >= 0 ? 1 : -1);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;
    // world bounds
    this.x = clamp(this.x, -455, 455);
    this.z = clamp(this.z, -455, 455);
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    // lean into turns + wheel spin
    const lean = clamp(-this.steer * this.speed * 0.006, -0.08, 0.08);
    this.group.rotation.z = lerp(this.group.rotation.z, lean, 0.2);
    this.spin += this.speed * dt * 2.2;
    for (const w of this.wheels) w.rotation.x = this.spin;
  }

  // Simple circle-vs-circle bump used by traffic/police collisions.
  bump(other, strength = 1) {
    const dx = this.x - other.x, dz = this.z - other.z;
    const d = Math.hypot(dx, dz) || 0.01;
    const min = (this.length + other.length) / 2 - 0.6;
    if (d < min) {
      const push = (min - d) / 2;
      this.x += (dx / d) * push; this.z += (dz / d) * push;
      other.x -= (dx / d) * push; other.z -= (dz / d) * push;
      const exch = this.speed;
      this.speed = other.speed * 0.6 * strength;
      other.speed = exch * 0.6 * strength;
      this.hp -= 2 * strength;
      other.hp -= 2 * strength;
      return true;
    }
    return false;
  }

  damage(amount) {
    this.hp -= amount;
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.hp = 0;
    }
  }

  remove() {
    this.scene.remove(this.group);
  }
}
