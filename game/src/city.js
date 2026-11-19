// city.js — the layout of Palmera Bay: streets, blocks, landmarks and spawn points.
// One clear job: answer "where is everything?" for the rest of the game.

// Streets run on a grid every 30 units; the city spans -90..90 on both axes.
// East of x = 96 is the beach and the ocean; south of z = 96 is the marina.
export const GRID_STEP = 30;
export const CITY_MIN = -90;
export const CITY_MAX = 90;
export const BEACH_X = 96;
export const MARINA_Z = 96;

export const LANDMARKS = {
  hideout: { x: -52, z: 52, name: 'Mara\'s Hideout' },
  marina: { x: 72, z: -42, name: 'Marina Drop' },
  beach: { x: 104, z: 30, name: 'Sunset Beach' },
  plaza: { x: 0, z: 0, name: 'Sol Plaza' },
  docks: { x: -72, z: -72, name: 'Old Docks' },
  yacht: { x: 108, z: 62, name: 'The Yacht' },
};

// Seeded RNG so a ?seed= run places the same cars and people every time.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickFrom(rng, list) { return list[Math.floor(rng() * list.length) % list.length]; }

// A point on a street (used for traffic, parked cars and pedestrians).
export function streetPoint(rng) {
  const line = Math.floor(rng() * 7) - 3; // -3..3 -> -90..90
  const along = CITY_MIN + rng() * (CITY_MAX - CITY_MIN);
  return rng() < 0.5
    ? { x: line * GRID_STEP, z: along }
    : { x: along, z: line * GRID_STEP };
}

// A point on a sidewalk next to a street.
export function sidewalkPoint(rng) {
  const p = streetPoint(rng);
  const off = (rng() < 0.5 ? -1 : 1) * 4.5;
  return rng() < 0.5 ? { x: p.x + off, z: p.z } : { x: p.x, z: p.z + off };
}

// Is (x, z) inside a building block (not on a road, beach or plaza)?
export function isBlock(x, z) {
  if (x > BEACH_X - 6 || z > MARINA_Z - 6) return false;
  const fx = Math.abs(((x + 15) % GRID_STEP + GRID_STEP) % GRID_STEP - 15);
  const fz = Math.abs(((z + 15) % GRID_STEP + GRID_STEP) % GRID_STEP - 15);
  return fx > 7.5 && fz > 7.5 && !(Math.abs(x) < 18 && Math.abs(z) < 18);
}

// Snap a point to the middle of the nearest road.
export function nearestRoadPoint(x, z) {
  const rx = Math.round(x / GRID_STEP) * GRID_STEP;
  const rz = Math.round(z / GRID_STEP) * GRID_STEP;
  return Math.abs(x - rx) < Math.abs(z - rz) ? { x: rx, z } : { x, z: rz };
}
