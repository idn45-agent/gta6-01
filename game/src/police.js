// Palmera Bay PD — the wanted system. Crimes raise stars; police cars
// spawn and ram the player; high wanted adds roadblocks and a
// helicopter. Stars cool down when the player stays clean and unseen.
import * as THREE from 'three';
import { Vehicle } from './vehicles.js';
import { clamp, lerp, angleLerp, dist2d, mulberry32 } from './util.js';

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.wanted = 0;
    this.cops = [];        // Vehicle instances with driver 'police'
    this.heli = null;      // { group, x, z, angle }
    this.heat = 0;         // 0..1 chase intensity for sirens/UI
    this.cleanTimer = 0;   // seconds since last crime
    this.coolTimer = 0;
    this.spawnTimer = 0;
    this.bustedTimer = 0;  // on-foot bust progress
    this.roadblocks = [];  // meshes
  }

  addWanted(n, reason) {
    if (n <= 0) return;
    this.wanted = clamp(this.wanted + n, 0, 5);
    this.cleanTimer = 0;
    this.coolTimer = 0;
    return this.wanted;
  }

  setWanted(n) {
    this.wanted = clamp(n, 0, 5);
    this.cleanTimer = 0;
    this.coolTimer = 0;
  }

  clearWanted() {
    this.setWanted(0);
    this.despawnAll();
  }

  spawnCopNear(px, pz) {
    const rng = this.rng;
    const p = this.city.randomRoadPoint(rng);
    // bias spawn toward the player: pick a road point near them
    const near = this.city.nearestRoadPoint(px + (rng() - 0.5) * 160, pz + (rng() - 0.5) * 160);
    const x = near.x + (rng() - 0.5) * 20;
    const z = near.z + (rng() - 0.5) * 20;
    const cop = new Vehicle(this.scene, 'police', x, z, rng() * Math.PI * 2, 0x1c2a44);
    cop.driver = 'police';
    cop.cruiseSpeed = 30 + this.wanted * 3;
    this.cops.push(cop);
    return cop;
  }

  ensureHeli() {
    if (this.heli) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 2.4),
      new THREE.MeshLambertMaterial({ color: 0x1c2a44 }));
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4, 0.7, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x1c2a44 }));
    tail.position.set(-4, 0.4, 0);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.15, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x888888 }));
    rotor.position.y = 1.2;
    g.add(rotor);
    const spot = new THREE.Mesh(new THREE.ConeGeometry(6, 40, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
    spot.position.y = -20;
    g.add(spot);
    this.scene.add(g);
    this.heli = { group: g, rotor, x: 0, z: 0, angle: 0 };
  }

  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.group);
    this.heli = null;
  }

  despawnAll() {
    for (const cop of this.cops) cop.remove();
    this.cops = [];
    this.removeHeli();
    for (const rb of this.roadblocks) this.scene.remove(rb);
    this.roadblocks = [];
  }

  // Roadblock: two police cars parked across the road ahead of the player.
  makeRoadblock(px, pz, heading) {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    for (const side of [-1, 1]) {
      const bx = px + fx * 70 + fz * side * 4;
      const bz = pz + fz * 70 - fx * side * 4;
      const cop = new Vehicle(this.scene, 'police', bx, bz, heading + Math.PI / 2, 0x1c2a44);
      cop.driver = 'roadblock';
      cop.speed = 0;
      this.cops.push(cop);
      this.roadblocks.push(cop.group);
    }
  }

  update(dt, player, traffic) {
    const px = player.inVehicle ? player.inVehicle.x : player.x;
    const pz = player.inVehicle ? player.inVehicle.z : player.z;
    const playerSpeed = player.inVehicle ? Math.abs(player.inVehicle.speed) : 0;

    // clean timer: stars decay when no crime and no cop nearby
    this.cleanTimer += dt;
    let nearestCop = 1e9;
    for (const cop of this.cops) nearestCop = Math.min(nearestCop, dist2d(cop.x, cop.z, px, pz));
    if (this.wanted > 0 && this.cleanTimer > 22 && nearestCop > 55) {
      this.coolTimer += dt;
      if (this.coolTimer > 4) {
        this.wanted = Math.max(0, this.wanted - 1);
        this.coolTimer = 0;
        this.cleanTimer = 0;
      }
    } else {
      this.coolTimer = 0;
    }

    // desired cop count by wanted level
    const wantCops = this.wanted === 0 ? 0 : this.wanted <= 2 ? this.wanted + 1 : this.wanted + 2;
    this.spawnTimer -= dt;
    if (this.cops.filter((c) => c.driver === 'police').length < wantCops && this.spawnTimer <= 0 && this.wanted > 0) {
      this.spawnTimer = 2.5;
      this.spawnCopNear(px, pz);
    }
    // helicopter at 4+ stars
    if (this.wanted >= 4) this.ensureHeli();
    else this.removeHeli();

    // roadblock at 3+ stars, occasionally ahead of the player
    if (this.wanted >= 3 && this.roadblocks.length === 0 && player.inVehicle && playerSpeed > 12 && this.rng() < dt * 0.25) {
      this.makeRoadblock(px, pz, player.inVehicle.heading);
    }
    if (this.roadblocks.length > 0 && (this.wanted < 3 || nearestCop > 220)) {
      for (const rb of this.roadblocks) this.scene.remove(rb);
      this.roadblocks = [];
      this.cops = this.cops.filter((c) => c.driver !== 'roadblock');
    }

    // police pursuit AI
    const survivors = [];
    for (const cop of this.cops) {
      if (cop.dead) { cop.remove(); continue; }
      survivors.push(cop);
      if (cop.driver === 'roadblock') continue;
      const dx = px - cop.x, dz = pz - cop.z;
      const d = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      // predictive steering: aim slightly ahead of the player
      const lead = clamp(playerSpeed * 0.25, 0, 12);
      const tx = px + Math.sin(player.inVehicle ? player.inVehicle.heading : player.heading) * lead;
      const tz = pz + Math.cos(player.inVehicle ? player.inVehicle.heading : player.heading) * lead;
      const leadHeading = Math.atan2(tx - cop.x, tz - cop.z);
      cop.heading = angleLerp(cop.heading, leadHeading, 1 - Math.exp(-2.6 * dt));
      // throttle: full chase, but ease off when very close (ram, don't orbit)
      let throttle = 1;
      if (d < 6) throttle = 0.85;
      const top = cop.cruiseSpeed;
      cop.speed = lerp(cop.speed, top * throttle, 1 - Math.exp(-1.6 * dt));
      cop.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.z += Math.cos(cop.heading) * cop.speed * dt;
      cop.x = clamp(cop.x, -455, 455);
      cop.z = clamp(cop.z, -455, 455);
      cop.group.position.set(cop.x, 0, cop.z);
      cop.group.rotation.y = cop.heading;
      cop.spin += cop.speed * dt * 2.2;
      for (const w of cop.wheels) w.rotation.x = cop.spin;
      // ram the player's car
      if (player.inVehicle && d < 4.2) {
        const v = player.inVehicle;
        const push = 3.2;
        v.x += (dx / (d || 1)) * -push * 0.1;
        v.z += (dz / (d || 1)) * -push * 0.1;
        const impact = Math.abs(cop.speed - v.speed);
        if (impact > 6) {
          v.damage(impact * 0.35);
          cop.damage(impact * 0.2);
          v.speed *= 0.82;
        }
        cop.speed *= 0.9;
      }
      // despawn far-away cops when wanted is gone
      if (this.wanted === 0 && d > 160) { cop.remove(); cop.dead = true; }
    }
    this.cops = survivors.filter((c) => !c.dead || c.driver === 'roadblock');

    // helicopter hovers above the player
    if (this.heli) {
      const h = this.heli;
      h.angle += dt * 0.5;
      const hx = px + Math.cos(h.angle) * 26;
      const hz = pz + Math.sin(h.angle) * 26;
      h.x = lerp(h.x, hx, 1 - Math.exp(-1.5 * dt));
      h.z = lerp(h.z, hz, 1 - Math.exp(-1.5 * dt));
      h.group.position.set(h.x, 55, h.z);
      h.group.lookAt(px, 0, pz);
      h.rotor.rotation.y += dt * 30;
    }

    // on-foot bust: a cop standing next to Ray on foot busts him
    if (!player.inVehicle && this.wanted > 0) {
      if (nearestCop < 3.5) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 2.5) {
          this.bustedTimer = 0;
          player.damage(100); // busted -> wasted screen
        }
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
      }
    } else {
      this.bustedTimer = 0;
    }

    this.heat = this.wanted > 0 ? clamp(nearestCop < 60 ? 1 : 0.5, 0, 1) : 0;
    return { nearestCop };
  }
}
