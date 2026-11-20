// Live minimap for Sunset Coast v2 — a circular 2D canvas that draws
// the road grid, districts, the player arrow, traffic, police, the
// mission beacon and taxi markers, all from the live game state.
import { clamp } from './util.js';

const MAP_HALF = 470; // world units shown from centre to edge

export class Minimap {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.size = canvas.width;
  }

  toMap(x, z) {
    const s = this.size / 2;
    return [s + (x / MAP_HALF) * s, s + (z / MAP_HALF) * s];
  }

  draw(state) {
    // state: { playerX, playerZ, heading, inVehicle, traffic, cops, heli,
    //          beacon: {x,z,visible}|null, taxi: {x,z}|null, shells, city }
    const g = this.g;
    const S = this.size;
    const cx = S / 2, cy = S / 2;
    g.clearRect(0, 0, S, S);
    // circular clip
    g.save();
    g.beginPath();
    g.arc(cx, cy, S / 2 - 1, 0, Math.PI * 2);
    g.clip();
    // background: dark blue-grey
    g.fillStyle = '#101a2c';
    g.fillRect(0, 0, S, S);
    // beach strip (west)
    g.fillStyle = '#c9a86a';
    g.fillRect(0, 0, ((MAP_HALF - 450) / MAP_HALF) * cx, S);
    g.fillStyle = '#1f6f9e';
    g.fillRect(0, 0, ((MAP_HALF - 470) / MAP_HALF) * cx + 2, S);
    // blocks
    g.fillStyle = '#2c3550';
    for (let ix = -4; ix <= 4; ix++) {
      for (let iz = -4; iz <= 4; iz++) {
        const [x, y] = this.toMap(ix * 100 - 43, iz * 100 - 43);
        const w = (86 / MAP_HALF) * cx;
        g.fillRect(x, y, w, w);
      }
    }
    // roads
    g.strokeStyle = '#4a5468';
    g.lineWidth = 4;
    for (const rx of state.city.roadXs) {
      const [x] = this.toMap(rx, 0);
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke();
    }
    for (const rz of state.city.roadZs) {
      const [, y] = this.toMap(0, rz);
      g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
    }
    // park + airport hints
    g.fillStyle = '#3f7a3a';
    const [px, py] = this.toMap(250 - 43, 50 - 43);
    g.fillRect(px, py, (86 / MAP_HALF) * cx, (86 / MAP_HALF) * cx);
    g.fillStyle = '#5a6a7a';
    const [ax, ay] = this.toMap(300, 330);
    g.fillRect(ax, ay, (160 / MAP_HALF) * cx, (26 / MAP_HALF) * cx);

    const dot = (x, z, r, color) => {
      const [mx, my] = this.toMap(x, z);
      g.fillStyle = color;
      g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.fill();
    };
    // shells (pink dots)
    for (const s of state.shells) dot(s.x, s.z, 2, '#ff9ad5');
    // traffic (white dots)
    for (const car of state.traffic) {
      if (car.dead) continue;
      dot(car.x, car.z, 2.2, 'rgba(255,255,255,0.75)');
    }
    // police (blue flashing dots)
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    for (const cop of state.cops) {
      if (cop.dead) continue;
      dot(cop.x, cop.z, 3.2, flash ? '#4dc3ff' : '#ff4d6d');
    }
    if (state.heli) dot(state.heli.x, state.heli.z, 4, '#4dc3ff');
    // taxi fare marker
    if (state.taxi) {
      const [mx, my] = this.toMap(state.taxi.x, state.taxi.z);
      g.fillStyle = '#ff9ad5';
      g.beginPath(); g.arc(mx, my, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(mx, my, 5, 0, Math.PI * 2); g.stroke();
    }
    // mission beacon (pulsing yellow diamond)
    if (state.beacon && state.beacon.visible) {
      const [mx, my] = this.toMap(state.beacon.x, state.beacon.z);
      const pulse = 6 + Math.sin(performance.now() / 200) * 2;
      g.fillStyle = '#ffd23e';
      g.beginPath();
      g.moveTo(mx, my - pulse); g.lineTo(mx + pulse, my);
      g.lineTo(mx, my + pulse); g.lineTo(mx - pulse, my);
      g.closePath(); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    }
    // player arrow (centre-ish, rotated to heading)
    const [ux, uy] = this.toMap(state.playerX, state.playerZ);
    g.save();
    g.translate(clamp(ux, 10, S - 10), clamp(uy, 10, S - 10));
    g.rotate(state.heading);
    g.fillStyle = '#fff';
    g.strokeStyle = '#111';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6);
    g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.restore();
    // rim
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, S / 2 - 1, 0, Math.PI * 2); g.stroke();
  }
}
