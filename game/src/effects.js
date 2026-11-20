// Particle effects for Sunset Coast v2 — pooled THREE.Points bursts
// for impacts, pickups, stunt jumps and explosions. One shared pool,
// no per-frame allocation.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

const MAX_PARTICLES = 400;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(4242);
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.material = new THREE.PointsMaterial({
      size: 1.6, vertexColors: true, transparent: true, opacity: 0.95,
      sizeAttenuation: true, depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.parts = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.parts.push({ life: 0, vx: 0, vy: 0, vz: 0, active: false });
      this.positions[i * 3 + 1] = -100;
    }
    this.cursor = 0;
  }

  burst(x, y, z, colorHex, count = 12, speed = 9, life = 0.7) {
    const color = new THREE.Color(colorHex);
    for (let n = 0; n < count; n++) {
      const p = this.parts[this.cursor];
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      p.active = true;
      p.life = life * (0.6 + this.rng() * 0.7);
      const a = this.rng() * Math.PI * 2;
      const up = this.rng() * 0.9 + 0.3;
      const s = speed * (0.5 + this.rng());
      p.vx = Math.cos(a) * s;
      p.vz = Math.sin(a) * s;
      p.vy = up * s;
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      this.colors[i * 3] = color.r;
      this.colors[i * 3 + 1] = color.g;
      this.colors[i * 3 + 2] = color.b;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  stuntBurst(x, z) {
    this.burst(x, 1, z, 0xffd23e, 30, 12, 1.0);
    this.burst(x, 1, z, 0xff7b54, 20, 9, 0.9);
  }

  explosion(x, z) {
    this.burst(x, 1.5, z, 0xff5f2d, 40, 16, 1.2);
    this.burst(x, 1.5, z, 0xffd23e, 25, 12, 0.9);
    this.burst(x, 1.5, z, 0x3a3a3a, 20, 7, 1.6);
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.parts[i];
      if (!p.active) continue;
      any = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.positions[i * 3 + 1] = -100;
        continue;
      }
      p.vy -= 18 * dt;
      this.positions[i * 3] += p.vx * dt;
      this.positions[i * 3 + 1] += p.vy * dt;
      this.positions[i * 3 + 2] += p.vz * dt;
      if (this.positions[i * 3 + 1] < 0.1) { this.positions[i * 3 + 1] = 0.1; p.vy = Math.abs(p.vy) * 0.4; }
    }
    if (any) this.geometry.attributes.position.needsUpdate = true;
  }
}
