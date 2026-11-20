// Ray Vega on foot — a low-poly walker with a camera-relative move,
// sprint, punch and jump. The player mesh is built from boxes so the
// game needs no external character art.
import * as THREE from 'three';
import { clamp, lerp, angleLerp } from './util.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98f6a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff7b54 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const torso = box(0.62, 0.72, 0.34, shirt, 0, 1.18, 0);
  const head = box(0.42, 0.42, 0.4, skin, 0, 1.78, 0);
  box(0.46, 0.14, 0.44, hair, 0, 2.02, 0);
  const legL = box(0.24, 0.78, 0.28, pants, -0.17, 0.42, 0);
  const legR = box(0.24, 0.78, 0.28, pants, 0.17, 0.42, 0);
  const armL = box(0.2, 0.66, 0.24, shirt, -0.44, 1.2, 0);
  const armR = box(0.2, 0.66, 0.24, shirt, 0.44, 1.2, 0);
  return { group: g, torso, head, legL, legR, armL, armR };
}

export class Player {
  constructor(scene, x, z) {
    this.scene = scene;
    const built = makePlayerMesh();
    this.group = built.group;
    this.parts = built;
    this.group.position.set(x, 0, z);
    scene.add(this.group);
    this.x = x; this.z = z;
    this.heading = 0;
    this.vx = 0; this.vz = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.y = 0; this.vy = 0;
    this.onGround = true;
    this.punchTimer = 0;
    this.punchCooldown = 0;
    this.walkPhase = 0;
    this.moving = false;
    this.sprinting = false;
    this.inVehicle = null; // Vehicle or null
  }

  get pos() { return this.group.position; }

  heal(amount) { this.health = clamp(this.health + amount, 0, this.maxHealth); }
  damage(amount) { this.health = clamp(this.health - amount, 0, this.maxHealth); }

  update(dt, input, camYaw, collideFn) {
    if (this.inVehicle) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const axis = input.moveAxis();
    this.sprinting = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = this.sprinting ? 11 : 6.5;
    // camera-relative movement
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    let mx = (sin * axis.f + cos * axis.s);
    let mz = (cos * axis.f - sin * axis.s);
    const len = Math.hypot(mx, mz);
    this.moving = len > 0.01;
    if (this.moving) {
      mx /= len; mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      this.heading = angleLerp(this.heading, targetHeading, 1 - Math.exp(-12 * dt));
      this.x += mx * speed * dt;
      this.z += mz * speed * dt;
      this.walkPhase += dt * speed * 1.6;
    }
    // gravity / jump
    if (input.wasPressed('Space') && this.onGround) {
      this.vy = 7.5;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.vy -= 22 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.onGround = true; }
    }
    // punch
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    if (input.wasPressed('KeyF') && this.punchCooldown <= 0) {
      this.punchTimer = 0.28;
      this.punchCooldown = 0.45;
    }
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    // building collision
    if (collideFn) collideFn(this, 0.9);
    this.x = clamp(this.x, -455, 455);
    this.z = clamp(this.z, -455, 455);
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.heading;
    // walk cycle
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    this.parts.armL.rotation.x = -swing * 0.8;
    if (this.punchTimer > 0) {
      this.parts.armR.rotation.x = -1.9; // punch extended
    } else {
      this.parts.armR.rotation.x = swing * 0.8;
    }
    this.parts.torso.position.y = 1.18 + (this.moving ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : 0);
  }

  // Punch hit test against a point (pedestrian, cop): returns true on hit.
  punchHits(tx, tz, range = 2.2) {
    if (this.punchTimer <= 0) return false;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    if (d > range) return false;
    const dot = (dx * fx + dz * fz) / (d || 1);
    return dot > 0.3;
  }

  teleport(x, z) {
    this.x = x; this.z = z;
    this.group.position.set(x, 0, z);
  }
}
