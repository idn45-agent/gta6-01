// Palmera Bay — the city itself: ground texture, road grid, districts,
// buildings, palms, props, landmarks and the collision map.
// The city is a deterministic grid (seed 20261120): roads every 100 units,
// blocks of 86 units, districts carved out of the grid. West edge is the
// beach and ocean; south-east is a small airport; south-west is the marina.
import * as THREE from 'three';
import { mulberry32, clamp, weightedPick } from './util.js';

export const WORLD = {
  half: 460,          // playable half-extent in world units
  roadEvery: 100,     // road centre spacing
  roadHalf: 7,        // half road width
  blockHalf: 43,      // half block size (road to road minus road)
  seed: 20261120,
};

export const DISTRICTS = {
  beach:    { name: 'Palmera Beach',  color: 0xf2d8a0 },
  marina:   { name: 'Marina Bay',    color: 0x7fb8c9 },
  downtown: { name: 'Downtown',      color: 0xc9b8a8 },
  plaza:    { name: 'Sunset Plaza',  color: 0x8fbf7f },
  suburbs:  { name: 'Coral Suburbs', color: 0xd8c9a8 },
  airport:  { name: 'Bayview Airfield', color: 0x9aa8b8 },
};

// Which district a block (ix, iz) belongs to. Block centres sit halfway
// between the roads: centre (ix*100+50, iz*100+50), ix, iz in -4..4.
export function districtOf(ix, iz) {
  const cx = ix * 100 + 50, cz = iz * 100 + 50;
  if (cx >= 250 && cz >= 250) return 'airport';
  if (cx <= -250 && cz >= 250) return 'marina';
  if (cx <= -350) return 'beach';
  if (cx === 250 && cz === 50) return 'plaza';
  if (Math.abs(cx) <= 150 && Math.abs(cz) <= 150) return 'downtown';
  if (cz <= -250) return 'suburbs';
  if (cx >= 250 && cz <= -150) return 'suburbs';
  return 'downtown';
}

const ROAD_XS = [-400, -300, -200, -100, 0, 100, 200, 300, 400];
const ROAD_ZS = [-400, -300, -200, -100, 0, 100, 200, 300, 400];

// Paint the ground: asphalt roads with dashes, sidewalks, beach sand,
// ocean on the west edge, park grass at the plaza, runway at the airport.
function makeGroundTexture() {
  const S = 2048;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const toPx = (v) => ((v + 470) / 940) * S; // world [-470,470] -> [0,S]

  // base: warm sidewalk concrete
  g.fillStyle = '#b8a88e'; g.fillRect(0, 0, S, S);
  // block interiors: sidewalk ring + varied inner tone per block
  const blockRng = mulberry32(5150);
  const innerTones = ['#a89a80', '#9a9484', '#b0a284', '#a3947c', '#9c8f7a'];
  for (let ix = -4; ix <= 4; ix++) for (let iz = -4; iz <= 4; iz++) {
    const cx = ix * 100 + 50, cz = iz * 100 + 50;
    g.fillStyle = '#c9b896'; // sidewalk ring
    g.fillRect(toPx(cx - 43), toPx(cz - 43), toPx(86) - toPx(0), toPx(86) - toPx(0));
    g.fillStyle = innerTones[Math.floor(blockRng() * innerTones.length)];
    g.fillRect(toPx(cx - 36), toPx(cz - 36), toPx(72) - toPx(0), toPx(72) - toPx(0));
    // a few parking-lot dashes on some blocks
    if (blockRng() < 0.4) {
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.moveTo(toPx(cx - 28 + k * 12), toPx(cz - 28));
        g.lineTo(toPx(cx - 28 + k * 12), toPx(cz - 16));
        g.stroke();
      }
    }
  }
  // ocean (west of x=-450)
  const oceanGrad = g.createLinearGradient(toPx(-470), 0, toPx(-430), 0);
  oceanGrad.addColorStop(0, '#1a5f8a'); oceanGrad.addColorStop(1, '#2f8fb8');
  g.fillStyle = oceanGrad; g.fillRect(0, 0, toPx(-450), S);
  // beach sand strip
  g.fillStyle = '#eed9a4'; g.fillRect(toPx(-450), 0, toPx(-440) - toPx(-450), S);
  // marina water (south-west corner blocks)
  g.fillStyle = '#2f7fa8';
  g.fillRect(toPx(-400), toPx(300), toPx(200) - toPx(0), toPx(170) - toPx(0));
  // plaza park grass
  g.fillStyle = '#6fae5e';
  g.fillRect(toPx(250 - 43), toPx(50 - 43), toPx(86) - toPx(0), toPx(86) - toPx(0));
  g.fillStyle = '#7fbf6e';
  g.beginPath(); g.arc(toPx(250), toPx(50), toPx(18) - toPx(0), 0, Math.PI * 2); g.fill();
  // airport runway
  g.fillStyle = '#3a3f4a';
  g.fillRect(toPx(300), toPx(330), toPx(160) - toPx(0), toPx(26) - toPx(0));
  g.fillStyle = '#e8e8e8';
  for (let x = 310; x < 460; x += 20) g.fillRect(toPx(x), toPx(342), toPx(10) - toPx(0), 3);

  // roads: dark asphalt
  g.fillStyle = '#33363e';
  for (const x of ROAD_XS) g.fillRect(toPx(x - 7), 0, toPx(14) - toPx(0), S);
  for (const z of ROAD_ZS) g.fillRect(0, toPx(z - 7), S, toPx(14) - toPx(0));
  // centre dashes
  g.fillStyle = '#e8d24a';
  for (const x of ROAD_XS) {
    for (let z = -460; z < 460; z += 16) g.fillRect(toPx(x) - 1.5, toPx(z), 3, toPx(8) - toPx(0));
  }
  for (const z of ROAD_ZS) {
    for (let x = -460; x < 460; x += 16) g.fillRect(toPx(x), toPx(z) - 1.5, toPx(8) - toPx(0), 3);
  }
  // crosswalk stripes at intersections
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const x of ROAD_XS) for (const z of ROAD_ZS) {
    for (let i = -3; i <= 3; i++) {
      g.fillRect(toPx(x + i * 2) - 1, toPx(z - 10), 2, 4);
      g.fillRect(toPx(x + i * 2) - 1, toPx(z + 6), 2, 4);
    }
  }
  // boardwalk line along the beach
  g.fillStyle = '#c98f5f';
  g.fillRect(toPx(-440), 0, toPx(6) - toPx(0), S);

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Shared window texture for building facades (3 palettes).
function makeFacadeTexture(base, lit) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  const rng = mulberry32(base.length * 7919 + lit.length);
  for (let y = 12; y < 244; y += 22) {
    for (let x = 10; x < 118; x += 22) {
      g.fillStyle = rng() < 0.55 ? lit : 'rgba(20,24,40,0.85)';
      g.fillRect(x, y, 14, 16);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(WORLD.seed);
    this.colliders = [];   // {x, z, hx, hz} axis-aligned boxes
    this.buildings = [];
    this.palms = [];
    this.roadXs = ROAD_XS;
    this.roadZs = ROAD_ZS;
    this.build();
  }

  isRoad(x, z) {
    for (const rx of ROAD_XS) if (Math.abs(x - rx) < WORLD.roadHalf + 2) return true;
    for (const rz of ROAD_ZS) if (Math.abs(z - rz) < WORLD.roadHalf + 2) return true;
    return false;
  }

  districtAt(x, z) {
    if (x < -440) return 'beach';
    const ix = Math.round((x - 50) / 100), iz = Math.round((z - 50) / 100);
    if (ix < -4 || ix > 4 || iz < -4 || iz > 4) return 'beach';
    return districtOf(ix, iz);
  }

  // Push a circle out of building colliders. Returns true if it hit something.
  collideCircle(p, radius) {
    let hit = false;
    for (const c of this.colliders) {
      const nx = clamp(p.x, c.x - c.hx, c.x + c.hx);
      const nz = clamp(p.z, c.z - c.hz, c.z + c.hz);
      const dx = p.x - nx, dz = p.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          p.x = nx + (dx / d) * radius;
          p.z = nz + (dz / d) * radius;
        } else {
          p.x += radius;
        }
      }
    }
    return hit;
  }

  // Nearest point on the road network to (x, z), snapped to a road centre.
  nearestRoadPoint(x, z) {
    let bx = ROAD_XS[0], bz = ROAD_ZS[0], bd = 1e9;
    for (const rx of ROAD_XS) for (const rz of ROAD_ZS) {
      const d = Math.abs(x - rx) + Math.abs(z - rz);
      if (d < bd) { bd = d; bx = rx; bz = rz; }
    }
    return { x: bx, z: bz };
  }

  randomRoadPoint(rng) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    if (axis === 'x') return { x: ROAD_XS[Math.floor(rng() * ROAD_XS.length)], z: -430 + rng() * 860, axis: 'x' };
    return { x: -430 + rng() * 860, z: ROAD_ZS[Math.floor(rng() * ROAD_ZS.length)], axis: 'z' };
  }

  build() {
    const rng = this.rng;
    const scene = this.scene;

    // Sunset sky: gradient background + warm fog.
    const skyCv = document.createElement('canvas');
    skyCv.width = 4; skyCv.height = 512;
    const sg = skyCv.getContext('2d');
    const grad = sg.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#2b1a5e');
    grad.addColorStop(0.35, '#7a2d6e');
    grad.addColorStop(0.62, '#e85d4a');
    grad.addColorStop(0.78, '#ff9a3d');
    grad.addColorStop(1.0, '#ffc46b');
    sg.fillStyle = grad; sg.fillRect(0, 0, 4, 512);
    const skyTex = new THREE.CanvasTexture(skyCv);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    scene.background = skyTex;
    scene.fog = new THREE.Fog(0xd98a5e, 220, 900);

    // Lighting: low warm sun from the west (sunset over the ocean).
    const sun = new THREE.DirectionalLight(0xffb36b, 2.4);
    sun.position.set(-300, 140, 120);
    scene.add(sun);
    const hemi = new THREE.HemisphereLight(0xffd9b0, 0x4a3a5e, 1.15);
    scene.add(hemi);
    const amb = new THREE.AmbientLight(0x8a6aa8, 0.5);
    scene.add(amb);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(940, 940),
      new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    scene.add(ground);
    // Ocean plane beyond the beach (animated in main loop via material offset)
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 940),
      new THREE.MeshLambertMaterial({ color: 0x1f6f9e }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(-620, -0.4, 0);
    scene.add(ocean);
    this.ocean = ocean;

    // Sun disc low over the ocean
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(34, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd98a, fog: false }),
    );
    sunDisc.position.set(-560, 52, -60);
    sunDisc.lookAt(0, 52, -60);
    scene.add(sunDisc);
    this.sunDisc = sunDisc;

    // Facade textures
    const facades = [
      makeFacadeTexture('#c98f6a', '#ffd98a'),
      makeFacadeTexture('#7fa8b8', '#cfe8ff'),
      makeFacadeTexture('#b87a9a', '#ffe0b0'),
      makeFacadeTexture('#8a9a7a', '#fff2c0'),
    ];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    // Buildings per block (block centres sit between the roads, so no
    // building ever straddles a road). Beachfront gets low hotels.
    for (let ix = -4; ix <= 4; ix++) {
      for (let iz = -4; iz <= 4; iz++) {
        const d = districtOf(ix, iz);
        if (d === 'marina' || d === 'plaza' || d === 'airport') continue;
        if (ix === -1 && iz === -1) continue; // Sol Tower block
        const cx = ix * 100 + 50, cz = iz * 100 + 50;
        const tall = d === 'downtown';
        const n = tall ? 2 : (rng() < 0.5 ? 2 : 1);
        for (let b = 0; b < n; b++) {
          const w = tall ? 22 + rng() * 14 : 16 + rng() * 14;
          const dep = tall ? 22 + rng() * 14 : 14 + rng() * 12;
          const h = tall ? 34 + rng() * 90 : (d === 'suburbs' ? 7 + rng() * 6 : 12 + rng() * 18);
          const ox = (b === 0 ? -14 : 14) + (rng() - 0.5) * 8;
          const oz = (b === 0 ? -12 : 12) + (rng() - 0.5) * 8;
          const mat = new THREE.MeshLambertMaterial({
            map: facades[Math.floor(rng() * facades.length)],
            color: new THREE.Color().setHSL(0.05 + rng() * 0.1, 0.25 + rng() * 0.3, 0.55 + rng() * 0.25),
          });
          const mesh = new THREE.Mesh(boxGeo, mat);
          mesh.scale.set(w, h, dep);
          mesh.position.set(cx + ox, h / 2, cz + oz);
          scene.add(mesh);
          this.buildings.push(mesh);
          this.colliders.push({ x: cx + ox, z: cz + oz, hx: w / 2 + 0.5, hz: dep / 2 + 0.5 });
          // rooftop box (AC unit / sign) for skyline variety
          if (tall && rng() < 0.6) {
            const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x3a3348 }));
            roof.scale.set(6, 3, 6);
            roof.position.set(cx + ox, h + 1.5, cz + oz);
            scene.add(roof);
          }
        }
      }
    }

    // Landmarks ---------------------------------------------------------
    // Sol Tower — tallest building downtown (block -1,-1 centre)
    const tower = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ map: facades[1], color: 0xd8c8ff }));
    tower.scale.set(30, 150, 30);
    tower.position.set(-50, 75, -50);
    scene.add(tower);
    this.colliders.push({ x: -50, z: -50, hx: 15.5, hz: 15.5 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff4d6d }));
    beacon.position.set(-50, 152, -50);
    scene.add(beacon);
    this.towerBeacon = beacon;

    // Palmera Pier — boardwalk out over the ocean
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a5a34 });
    const pier = new THREE.Mesh(boxGeo, pierMat);
    pier.scale.set(60, 2, 10);
    pier.position.set(-480, 1, 100);
    scene.add(pier);
    // Ferris wheel on the pier (simple torus + spokes)
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 1.2, 8, 24),
      new THREE.MeshLambertMaterial({ color: 0xffd23e }));
    wheel.add(rim);
    for (let i = 0; i < 8; i++) {
      const cabin = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: weightedPick(rng, [[0xff5f6d, 1], [0x4dc3ff, 1], [0x7dff9b, 1]]) }));
      cabin.scale.set(3, 3, 3);
      const a = (i / 8) * Math.PI * 2;
      cabin.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
      wheel.add(cabin);
    }
    wheel.position.set(-500, 24, 100);
    scene.add(wheel);
    this.ferrisWheel = wheel;

    // Marina docks + boats (south-west)
    const dockMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
    for (let i = 0; i < 3; i++) {
      const dock = new THREE.Mesh(boxGeo, dockMat);
      dock.scale.set(8, 1.5, 60);
      dock.position.set(-360 + i * 26, 0.8, 350);
      scene.add(dock);
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }));
      hull.scale.set(6, 2.5, 18);
      boat.add(hull);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 10, 6),
        new THREE.MeshLambertMaterial({ color: 0x888888 }));
      mast.position.y = 6;
      boat.add(mast);
      boat.position.set(-360 + i * 26 + 8, 1, 330 + i * 8);
      scene.add(boat);
    }

    // Sunset Plaza fountain (block 2,0 centre: 250,50)
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 2, 20),
      new THREE.MeshLambertMaterial({ color: 0x9ab8c8 }));
    fountain.position.set(250, 1, 50);
    scene.add(fountain);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.6, 20),
      new THREE.MeshLambertMaterial({ color: 0x4dc3ff }));
    water.position.set(250, 2, 50);
    scene.add(water);
    this.colliders.push({ x: 250, z: 50, hx: 16, hz: 16 });

    // Airport terminal + parked plane (south-east)
    const terminal = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xd8d8e0 }));
    terminal.scale.set(50, 12, 24);
    terminal.position.set(350, 6, 340);
    scene.add(terminal);
    this.colliders.push({ x: 350, z: 340, hx: 25.5, hz: 12.5 });
    const plane = new THREE.Group();
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 34, 10),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    fuselage.rotation.x = Math.PI / 2;
    plane.add(fuselage);
    const wing = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xff7b54 }));
    wing.scale.set(30, 0.8, 6);
    plane.add(wing);
    const tail = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xff7b54 }));
    tail.scale.set(10, 5, 0.8);
    tail.position.set(0, 3, -16);
    plane.add(tail);
    plane.position.set(380, 4, 380);
    plane.rotation.y = 0.5;
    scene.add(plane);

    // Palm trees along the beach + scattered in the city
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 9, 6);
    const leafGeo = new THREE.ConeGeometry(3.4, 5, 6);
    const makePalm = (x, z, s = 1) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 4.5;
      g.add(trunk);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        const a = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 1.6, 9.4, Math.sin(a) * 1.6);
        leaf.rotation.z = Math.cos(a) * 0.9;
        leaf.rotation.x = -Math.sin(a) * 0.9;
        g.add(leaf);
      }
      g.position.set(x, 0, z);
      g.scale.setScalar(s);
      scene.add(g);
      this.palms.push(g);
      return g;
    };
    for (let z = -430; z <= 430; z += 34) {
      makePalm(-436 + (rng() - 0.5) * 4, z + (rng() - 0.5) * 10, 0.9 + rng() * 0.4);
    }
    for (let i = 0; i < 40; i++) {
      const x = -420 + rng() * 840, z = -420 + rng() * 840;
      if (!this.isRoad(x, z) && this.districtAt(x, z) !== 'airport') makePalm(x, z, 0.8 + rng() * 0.5);
    }

    // Street lights at intersections
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const poleGeo = new THREE.CylinderGeometry(0.25, 0.25, 9, 6);
    for (const x of ROAD_XS) for (const z of ROAD_ZS) {
      if (rng() < 0.5) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + 9, 4.5, z + 9);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), lampMat);
      lamp.position.set(x + 9, 9.2, z + 9);
      scene.add(lamp);
    }

    // Stunt ramps (orange wedges) — on the roads around the city
    this.ramps = [];
    const rampSpots = [[-3, 150], [150, -3], [203, 250], [-3, -250]];
    for (const [x, z] of rampSpots) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 11),
        new THREE.MeshLambertMaterial({ color: 0xd85a20 }));
      ramp.position.set(x, 1.4, z);
      ramp.rotation.x = -0.35;
      ramp.rotation.y = rng() * Math.PI;
      scene.add(ramp);
      this.ramps.push({ x, z });
    }

    // Collectible shells (20) — placed on sidewalks, deterministic spots
    this.shellSpots = [];
    let guard = 0;
    while (this.shellSpots.length < 20 && guard++ < 400) {
      const x = -420 + rng() * 840, z = -420 + rng() * 840;
      if (this.isRoad(x, z)) continue;
      if (this.districtAt(x, z) === 'airport') continue;
      this.shellSpots.push({ x, z });
    }
  }

  update(dt, t) {
    if (this.ferrisWheel) this.ferrisWheel.rotation.z += dt * 0.25;
    if (this.towerBeacon) {
      const s = 1 + Math.sin(t * 3) * 0.25;
      this.towerBeacon.scale.setScalar(s);
    }
    if (this.ocean) this.ocean.position.y = -0.4 + Math.sin(t * 0.7) * 0.15;
  }
}
