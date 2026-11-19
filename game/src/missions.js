// missions.js — the story: three jobs from Mara Sol with a beginning, a middle
// and a payoff. One clear job: objectives, markers, rewards and progression.
import * as THREE from 'three';
import { LANDMARKS } from './city.js';
import { setWanted } from './police.js';

export const MISSIONS = [
  {
    id: 'package', title: 'Job 1 — The Package',
    text: 'Pick up the package at the Marina Drop. Mara is counting on you.',
    target: LANDMARKS.marina, reward: 500, rep: 'Runner',
  },
  {
    id: 'getaway', title: 'Job 2 — Hot Wheels',
    text: 'Steal any car, then lose the cops and reach Mara\'s Hideout.',
    target: LANDMARKS.hideout, reward: 1200, rep: 'Wheelman',
  },
  {
    id: 'showdown', title: 'Job 3 — Sunset Showdown',
    text: 'Dario\'s crew is waiting on Sunset Beach. Put all 3 rivals down, then reach the yacht.',
    target: LANDMARKS.beach, reward: 2500, rep: 'King of the Coast',
  },
];

let markerMesh = null;
let ringMesh = null;

// A glowing beacon column + pulsing ring marks the current objective.
export function showMarker(scene, target) {
  hideMarker(scene);
  markerMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 30, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.45 }));
  markerMesh.position.set(target.x, 15, target.z);
  scene.add(markerMesh);
  ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.set(target.x, 0.15, target.z);
  scene.add(ringMesh);
}

export function hideMarker(scene) {
  if (markerMesh) { scene.remove(markerMesh); markerMesh = null; }
  if (ringMesh) { scene.remove(ringMesh); ringMesh = null; }
}

export function pulseMarker(time) {
  if (ringMesh) {
    const s = 1 + Math.sin(time * 3) * 0.12;
    ringMesh.scale.set(s, s, 1);
  }
}

// Start mission `index`: set the objective, place rivals for the showdown, raise heat for the getaway.
export function startMission(G, index) {
  const mission = MISSIONS[index];
  if (!mission) { G.missionIndex = MISSIONS.length; G.objective = 'Story complete — Palmera Bay is yours, Ray.'; return; }
  G.missionIndex = index;
  G.missionTarget = mission.target;
  G.objective = mission.text;
  G.objectiveTitle = mission.title;
  showMarker(G.scene, mission.target);
  if (mission.id === 'getaway') setWanted(G.police, 2);
  if (mission.id === 'showdown') {
    G.missionRivalsDown = 0;
    const beach = LANDMARKS.beach;
    // Repurpose three pedestrians as Dario's crew: teleport them to the beach,
    // mark them hostile and dress them in red so the player can spot them.
    const crew = G.peds.slice(0, 3);
    for (let i = 0; i < crew.length; i++) {
      const ped = crew[i];
      ped.alive = true; ped.hostile = true; ped.health = 100;
      ped.x = beach.x - 8 + i * 8; ped.z = beach.z - 6 + (i % 2) * 10;
      ped.targetX = ped.x; ped.targetZ = ped.z;
      ped.mesh.visible = true;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xc02020 });
    }
    G.toast('Dario\'s crew is on the beach — put them down!');
  }
  G.hudDirty = true;
}

// Called every frame: complete the mission when the player reaches the marker
// (and, for the showdown, after all 3 rivals are down).
export function updateMissions(G, dt) {
  if (G.missionIndex >= MISSIONS.length) return;
  const mission = MISSIONS[G.missionIndex];
  // Showdown finale: once the 3 rivals are down the marker moves to the yacht.
  const target = mission.id === 'showdown' && (G.missionRivalsDown || 0) >= 3
    ? LANDMARKS.yacht : mission.target;
  if (target !== G.missionTarget) {
    G.missionTarget = target;
    showMarker(G.scene, target);
    G.toast('All rivals down — get to the yacht!');
  }
  const px = G.player.car ? G.player.car.x : G.player.x;
  const pz = G.player.car ? G.player.car.z : G.player.z;
  const d = Math.hypot(px - target.x, pz - target.z);
  G.missionDistance = Math.round(d);
  if (mission.id === 'showdown' && (G.missionRivalsDown || 0) < 3) {
    // Before the rivals are down the marker is the beach itself; the yacht comes after.
    if (d < 6) G.toast('Take down all 3 rivals first!');
    return;
  }
  if (d < 6) completeMission(G);
}

function completeMission(G) {
  const mission = MISSIONS[G.missionIndex];
  G.cash += mission.reward;
  G.rep = mission.rep;
  G.audio.cash();
  G.toast(`Job complete! +$${mission.reward} — you are now ${mission.rep}.`);
  hideMarker(G.scene);
  setWanted(G.police, 0);
  startMission(G, G.missionIndex + 1);
}
