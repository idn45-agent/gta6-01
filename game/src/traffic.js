// Traffic and pedestrians for Sunset Coast v2.
// Traffic cars cruise the road grid, turn at intersections and brake
// for the player. Pedestrians stroll the sidewalks and flee from
// speeding cars, fights and police sirens.
import * as THREE from 'three';
import { Vehicle, randomBodyColor, CAR_TYPES } from './vehicles.js';
import { mulberry32, clamp, lerp, angleLerp, dist2d } from './util.js';

const PED_SHIRTS = [0xffd23e, 0x4dc3ff, 0x7dff9b, 0xff8fb3, 0xd8c8ff, 0xffffff, 0xff9a3d];
const PED_PANTS = [0x2a3550, 0x3a3a3a, 0x5a4a3a, 0x24382a];

function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: PED_SHIRTS[Math.floor(rng() * PED_SHIRTS.length)] });
  const pants = new THREE.MeshLambertMaterial({ color: PED_PANTS[Math.floor(rng() * PED_PANTS.length)] });
  const skin = new THREE.MeshLambertMaterial({ color: [0xc98f6a, 0x8a5a3a, 0xe8b890][Math.floor(rng() * 3)] });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  box(0.56, 0.66, 0.32, shirt, 0, 1.12, 0);
  box(0.38, 0.38, 0.36, skin, 0, 1.66, 0);
  const legL = box(0.22, 0.72, 0.26, pants, -0.15, 0.38, 0);
  const legR = box(0.22, 0.72, 0.26, pants, 0.15, 0.38, 0);
  return { group: g, legL, legR };
}

class Pedestrian {
  constructor(scene, rng, city, x, z) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    const built = makePedMesh(rng);
    this.group = built.group;
    this.legs = built;
    this.x = x; this.z = z;
    this.heading = rng() * Math.PI * 2;
    this.speed = 1.2 + rng() * 1.3;
    this.phase = rng() * 6;
    this.target = null;
    this.fleeing = false;
    this.fleeTimer = 0;
    this.dead = false;
    this.knockedTimer = 0;
    this.group.position.set(x, 0, z);
    scene.add(this.group);
    this.pickTarget();
  }

  pickTarget() {
    // stroll to a nearby sidewalk point (near a road, offset from centre)
    const p = this.city.randomRoadPoint(this.rng);
    const off = (this.rng() < 0.5 ? -1 : 1) * (10 + this.rng() * 4);
    if (p.axis === 'x') this.target = { x: p.x + off, z: p.z };
    else this.target = { x: p.x, z: p.z + off };
  }

  update(dt, playerPos, playerSpeed, wanted) {
    if (this.dead) {
      this.knockedTimer -= dt;
      if (this.knockedTimer <= 0) { this.dead = false; this.group.rotation.z = 0; this.group.position.y = 0; }
      return;
    }
    // flee if a fast car or a fight is near
    const dPlayer = dist2d(this.x, this.z, playerPos.x, playerPos.z);
    if ((playerSpeed > 14 && dPlayer < 12) || (wanted >= 2 && dPlayer < 16)) {
      this.fleeing = true; this.fleeTimer = 2.5;
    }
    this.fleeTimer -= dt;
    if (this.fleeTimer <= 0) this.fleeing = false;
    let tx, tz, speed;
    if (this.fleeing) {
      const dx = this.x - playerPos.x, dz = this.z - playerPos.z;
      const d = Math.hypot(dx, dz) || 1;
      tx = this.x + (dx / d) * 30; tz = this.z + (dz / d) * 30;
      speed = this.speed * 2.6;
    } else {
      if (!this.target || dist2d(this.x, this.z, this.target.x, this.target.z) < 3) this.pickTarget();
      tx = this.target.x; tz = this.target.z;
      speed = this.speed;
    }
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.1) {
      const targetHeading = Math.atan2(dx, dz);
      this.heading = angleLerp(this.heading, targetHeading, 1 - Math.exp(-6 * dt));
      this.x += Math.sin(this.heading) * speed * dt;
      this.z += Math.cos(this.heading) * speed * dt;
      this.phase += dt * speed * 3.2;
    }
    this.x = clamp(this.x, -450, 450);
    this.z = clamp(this.z, -450, 450);
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    const swing = Math.sin(this.phase) * 0.5;
    this.legs.legL.rotation.x = swing;
    this.legs.legR.rotation.x = -swing;
  }

  knockDown() {
    this.dead = true;
    this.knockedTimer = 4;
    this.group.rotation.z = Math.PI / 2;
    this.group.position.y = 0.4;
  }

  remove() { this.scene.remove(this.group); }
}

export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.peds = [];
    this.spawnTimer = 0;
  }

  spawnCar(x, z, heading, typeKey, driver = 'traffic', color) {
    const v = new Vehicle(this.scene, typeKey, x, z, heading, color ?? randomBodyColor(this.rng));
    v.driver = driver;
    v.cruiseSpeed = 10 + this.rng() * 8;
    v.turnCooldown = 0;
    v.axis = Math.abs(Math.sin(heading)) > 0.5 ? 'x' : 'z';
    v.dir = 1;
    this.cars.push(v);
    return v;
  }

  seedWorld() {
    const rng = this.rng;
    const types = ['sedan', 'sedan', 'sport', 'taxi', 'truck', 'sedan', 'bike'];
    for (let i = 0; i < 14; i++) {
      const p = this.city.randomRoadPoint(rng);
      const heading = p.axis === 'x' ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
      const lane = (rng() < 0.5 ? -1 : 1) * 3.5;
      const x = p.axis === 'x' ? p.x + lane : p.x;
      const z = p.axis === 'x' ? p.z : p.z + lane;
      this.spawnCar(x, z, heading, types[Math.floor(rng() * types.length)]);
    }
    // a few parked cars along the roads near the start area
    const parked = [
      { x: 4, z: 60, h: 0, t: 'sedan' },
      { x: -4, z: -30, h: Math.PI, t: 'sport' },
      { x: 60, z: 4, h: Math.PI / 2, t: 'taxi' },
      { x: -60, z: -4, h: -Math.PI / 2, t: 'sedan' },
      { x: 104, z: 60, h: 0, t: 'truck' },
      { x: -104, z: -60, h: Math.PI, t: 'bike' },
    ];
    for (const p of parked) {
      const v = new Vehicle(this.scene, p.t, p.x, p.z, p.h, randomBodyColor(rng));
      v.driver = null;
      this.cars.push(v);
    }
    for (let i = 0; i < 26; i++) {
      const p = this.city.randomRoadPoint(rng);
      const off = (rng() < 0.5 ? -1 : 1) * (10 + rng() * 3);
      const x = p.axis === 'x' ? p.x + off : p.x + (rng() - 0.5) * 20;
      const z = p.axis === 'x' ? p.z + (rng() - 0.5) * 20 : p.z + off;
      this.peds.push(new Pedestrian(this.scene, rng, this.city, clamp(x, -440, 440), clamp(z, -440, 440)));
    }
  }

  update(dt, player, wanted) {
    const rng = this.rng;
    const playerPos = player.inVehicle ? player.inVehicle : player;
    const playerSpeed = player.inVehicle ? Math.abs(player.inVehicle.speed) : 0;
    // traffic cars
    for (const car of this.cars) {
      if (car.driver !== 'traffic') continue;
      if (car.dead) continue;
      car.turnCooldown -= dt;
      // desired heading along current road axis
      const isX = Math.abs(Math.sin(car.heading)) > Math.SQRT1_2;
      // find nearest road line on this axis and stay in lane
      let targetHeading = car.heading;
      if (isX) {
        let best = this.city.roadXs[0], bd = 1e9;
        for (const rx of this.city.roadXs) { const d = Math.abs(car.z - rx); if (d < bd) { bd = d; best = rx; } }
        const laneZ = best + (car.dir > 0 ? 3.5 : -3.5);
        const dz = laneZ - car.z;
        targetHeading = (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + clamp(dz * 0.06, -0.5, 0.5);
        car.z += 0; // lane drift handled by heading
      } else {
        let best = this.city.roadZs[0], bd = 1e9;
        for (const rz of this.city.roadZs) { const d = Math.abs(car.x - rz); if (d < bd) { bd = d; best = rz; } }
        const laneX = best + (car.dir > 0 ? -3.5 : 3.5);
        const dx = laneX - car.x;
        targetHeading = (car.dir > 0 ? 0 : Math.PI) + clamp(dx * 0.06, -0.5, 0.5);
      }
      // turn at intersections
      const nearX = this.city.roadXs.some((rx) => Math.abs(car.x - rx) < 6);
      const nearZ = this.city.roadZs.some((rz) => Math.abs(car.z - rz) < 6);
      if (nearX && nearZ && car.turnCooldown <= 0 && rng() < 0.02) {
        car.turnCooldown = 4;
        if (rng() < 0.45) {
          // 90-degree turn: flip axis
          car.heading += (rng() < 0.5 ? 1 : -1) * Math.PI / 2;
        } else if (rng() < 0.12) {
          car.heading += Math.PI; // U-turn, rare
        }
      }
      car.heading = angleLerp(car.heading, targetHeading, 1 - Math.exp(-3 * dt));
      // brake for the player / car ahead
      let throttle = 1;
      const dPlayer = dist2d(car.x, car.z, playerPos.x, playerPos.z);
      const ahead = this.aheadBlocked(car);
      if (dPlayer < 9 && playerSpeed < 4) throttle = 0;
      else if (ahead) throttle = 0.2;
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const toPlayer = (playerPos.x - car.x) * fx + (playerPos.z - car.z) * fz;
      if (dPlayer < 7 && toPlayer > 0 && playerSpeed > 2) throttle = 0; // let player pass
      car.speed = lerp(car.speed, car.cruiseSpeed * throttle, 1 - Math.exp(-2 * dt));
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.x = clamp(car.x, -450, 450);
      car.z = clamp(car.z, -450, 450);
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
      car.spin += car.speed * dt * 2.2;
      for (const w of car.wheels) w.rotation.x = car.spin;
      // respawn if it wandered off the grid or got stuck far away
      if (Math.abs(car.x) > 448 || Math.abs(car.z) > 448) {
        const p = this.city.randomRoadPoint(rng);
        car.x = p.x; car.z = p.z;
        car.heading = p.axis === 'x' ? Math.PI / 2 : 0;
      }
    }
    // pedestrians
    for (const ped of this.peds) ped.update(dt, playerPos, playerSpeed, wanted);
    // keep traffic density up near the player
    this.spawnTimer -= dt;
    const active = this.cars.filter((c) => c.driver === 'traffic' && !c.dead).length;
    if (this.spawnTimer <= 0 && active < 12) {
      this.spawnTimer = 3;
      const p = this.city.randomRoadPoint(rng);
      const heading = p.axis === 'x' ? Math.PI / 2 : 0;
      this.spawnCar(p.x, p.z, heading, ['sedan', 'sport', 'taxi'][Math.floor(rng() * 3)]);
    }
  }

  aheadBlocked(car) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    for (const other of this.cars) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 12 && side < 3) return true;
    }
    return false;
  }

  nearestParkedCar(x, z, maxDist = 6) {
    let best = null, bd = maxDist;
    for (const car of this.cars) {
      if (car.driver !== null || car.dead) continue;
      const d = dist2d(x, z, car.x, car.z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }

  nearestDrivableCar(x, z, maxDist = 6) {
    let best = null, bd = maxDist;
    for (const car of this.cars) {
      if (car.dead) continue;
      if (car.driver === 'police') continue;
      const d = dist2d(x, z, car.x, car.z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }
}
