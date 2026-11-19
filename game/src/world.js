// world.js — builds the 3D scene of Palmera Bay: sky, sun, ground, ocean, beach,
// roads, buildings, palms and the plaza. One clear job: static scenery + collision data.
import * as THREE from 'three';
import { CITY_MIN, CITY_MAX, GRID_STEP, BEACH_X, MARINA_Z, makeRng, isBlock, pickFrom } from './city.js';

const BUILDING_COLORS = [0xe8b48a, 0xd9a0a0, 0x9fc3d9, 0xf2e3c6, 0xc9b8e0, 0xa8d8b9, 0xe0c090, 0xb8c8d8];
const ROOF_COLORS = [0x7a4a3a, 0x3a5a7a, 0x5a7a4a, 0x8a6a3a];

export function buildWorld(scene, rng) {
  const colliders = []; // {x, z, half} axis-aligned building footprints
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0xa8c8e0, 160, 420);

  const sun = new THREE.DirectionalLight(0xffe0b0, 2.2);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x8a6a4a, 1.1));

  // Ground: grass-green city slab, sand strip, ocean plane.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x7fae62 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0);
  scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 300),
    new THREE.MeshLambertMaterial({ color: 0xe8d49a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(BEACH_X + 24, 0.02, 0);
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 560),
    new THREE.MeshLambertMaterial({ color: 0x2a7ab8 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(BEACH_X + 130, 0.0, 0);
  scene.add(ocean);

  // Roads: dark strips along every grid line, with pale centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  for (let i = -3; i <= 3; i++) {
    const c = i * GRID_STEP;
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(9, 200), roadMat);
    roadX.rotation.x = -Math.PI / 2; roadX.position.set(c, 0.05, 0); scene.add(roadX);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(200, 9), roadMat);
    roadZ.rotation.x = -Math.PI / 2; roadZ.position.set(0, 0.05, c); scene.add(roadZ);
    for (let d = -90; d <= 90; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 3), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(c, 0.08, d); scene.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.6), dashMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(d, 0.08, c); scene.add(dash2);
    }
  }

  // Buildings: one or two boxes per block, with a darker roof cap and lit windows.
  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let bx = -3; bx <= 2; bx++) {
    for (let bz = -3; bz <= 2; bz++) {
      const cx = bx * GRID_STEP + 15, cz = bz * GRID_STEP + 15;
      if (Math.abs(cx) < 18 && Math.abs(cz) < 18) continue; // Sol Plaza stays open
      if (cx > BEACH_X - 20 || cz > MARINA_Z - 20) continue;
      const count = rng() < 0.45 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const w = 8 + rng() * 6, d = 8 + rng() * 6, h = 6 + rng() * rng() * 26;
        const px = cx + (k === 0 ? -3.5 : 3.5) * (rng() < 0.5 ? 1 : -1) * 0.4;
        const pz = cz + (k === 0 ? -3 : 3);
        const mat = new THREE.MeshLambertMaterial({ color: pickFrom(rng, BUILDING_COLORS) });
        const b = new THREE.Mesh(wallGeo, mat);
        b.scale.set(w, h, d); b.position.set(px, h / 2, pz); scene.add(b);
        const roof = new THREE.Mesh(wallGeo,
          new THREE.MeshLambertMaterial({ color: pickFrom(rng, ROOF_COLORS) }));
        roof.scale.set(w + 0.4, 0.6, d + 0.4); roof.position.set(px, h + 0.3, pz); scene.add(roof);
        // A few glowing windows on the street-facing side.
        for (let wi = 0; wi < 4; wi++) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), winMat);
          win.position.set(px - w / 2 + 1.5 + wi * (w - 3) / 3, 3 + (wi % 2) * 4, pz + d / 2 + 0.06);
          scene.add(win);
        }
        colliders.push({ x: px, z: pz, half: Math.max(w, d) / 2 + 0.4 });
      }
    }
  }

  // Palm trees along the beach and the plaza.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f });
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z); scene.add(trunk);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 4), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.scale.set(1.6, 0.35, 0.7);
      leaf.position.set(x + Math.cos(a) * 1.6, 7.2, z + Math.sin(a) * 1.6);
      leaf.rotation.y = -a; scene.add(leaf);
    }
  }
  for (let z = -90; z <= 90; z += 18) { palm(BEACH_X - 4, z); palm(BEACH_X + 8, z + 9); }
  palm(-12, -12); palm(12, -12); palm(-12, 12); palm(12, 12);

  // Sol Plaza fountain: a blue disc and a white column at the city centre.
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.8, 20),
    new THREE.MeshLambertMaterial({ color: 0x4aa8d8 }));
  fountain.position.set(0, 0.4, 0); scene.add(fountain);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 6, 10),
    new THREE.MeshLambertMaterial({ color: 0xf0ead8 }));
  column.position.set(0, 3, 0); scene.add(column);
  colliders.push({ x: 0, z: 0, half: 7.5 });

  // Marina piers at the south edge.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  for (const px of [-40, 0, 40]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 22), pierMat);
    pier.position.set(px, 0.3, MARINA_Z + 8); scene.add(pier);
  }
  return { colliders };
}

// Push a circle of radius r out of every building collider it overlaps.
export function resolveCollisions(colliders, pos, r) {
  for (const c of colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z;
    if (Math.abs(dx) < c.half + r && Math.abs(dz) < c.half + r) {
      const ox = c.half + r - Math.abs(dx), oz = c.half + r - Math.abs(dz);
      if (ox < oz) pos.x += dx >= 0 ? ox : -ox; else pos.z += dz >= 0 ? oz : -oz;
    }
  }
  pos.x = Math.max(-140, Math.min(150, pos.x));
  pos.z = Math.max(-140, Math.min(150, pos.z));
}

export function blockAt(x, z) { return isBlock(x, z); }
