// minimap.js — the live 2D minimap: streets, beach, player, cars, police,
// pedestrians and the mission marker, drawn on a small canvas. One clear job: orientation.
import { GRID_STEP, CITY_MIN, CITY_MAX, BEACH_X } from './city.js';

const WORLD_MIN = -140, WORLD_MAX = 150;

export function drawMinimap(canvas, G) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const toMap = (x, z) => [
    ((x - WORLD_MIN) / (WORLD_MAX - WORLD_MIN)) * W,
    ((z - WORLD_MIN) / (WORLD_MAX - WORLD_MIN)) * H,
  ];
  // Backdrop: land, then the ocean strip on the east edge.
  ctx.fillStyle = '#274b2e'; ctx.fillRect(0, 0, W, H);
  const [bx] = toMap(BEACH_X, 0);
  ctx.fillStyle = '#2a7ab8'; ctx.fillRect(bx, 0, W - bx, H);
  ctx.fillStyle = '#e8d49a'; ctx.fillRect(bx - 8, 0, 8, H);
  // Streets.
  ctx.strokeStyle = '#5a6068'; ctx.lineWidth = 3;
  for (let i = -3; i <= 3; i++) {
    const c = i * GRID_STEP;
    const [x1, y1] = toMap(c, CITY_MIN); const [x2, y2] = toMap(c, CITY_MAX);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const [x3, y3] = toMap(CITY_MIN, c); const [x4, y4] = toMap(CITY_MAX, c);
    ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
  }
  function dot(x, z, color, r) {
    const [mx, my] = toMap(x, z);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
  }
  // Mission marker: a pulsing gold diamond.
  if (G.missionTarget) {
    const [mx, my] = toMap(G.missionTarget.x, G.missionTarget.z);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.moveTo(mx, my - 7); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 7); ctx.lineTo(mx - 6, my); ctx.closePath(); ctx.fill();
  }
  // Pedestrians as tiny grey dots, traffic as white dots.
  for (const ped of G.peds) if (ped.alive && !ped.hostile) dot(ped.x, ped.z, '#c8c8c8', 1.5);
  for (const car of G.cars) if (!car.police && !car.occupied) dot(car.x, car.z, '#ffffff', 2);
  // Police as flashing blue/red dots.
  for (const car of G.police.units) dot(car.x, car.z, Math.floor(performance.now() / 300) % 2 ? '#ff4040' : '#4080ff', 3);
  // Hostile rivals as red dots.
  for (const ped of G.peds) if (ped.alive && ped.hostile) dot(ped.x, ped.z, '#ff2020', 3);
  // Player: a white triangle pointing the way they face.
  const [px, py] = toMap(G.player.x, G.player.z);
  const a = G.player.car ? G.player.car.angle : G.player.angle;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(px + Math.sin(a) * 7, py + Math.cos(a) * 7);
  ctx.lineTo(px + Math.sin(a + 2.6) * 5, py + Math.cos(a + 2.6) * 5);
  ctx.lineTo(px + Math.sin(a - 2.6) * 5, py + Math.cos(a - 2.6) * 5);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.stroke();
}
