// Missions and side activities for Sunset Coast v2.
// Six story missions for Mara Sol plus taxi fares, street races,
// shell collectibles and stunt jumps. The manager owns the objective
// beacon, timers and rewards; the game loop calls update() each tick.
import * as THREE from 'three';
import { Vehicle } from './vehicles.js';
import { dist2d, clamp, mulberry32 } from './util.js';

export const MISSIONS = [
  {
    id: 'm1', name: 'First Delivery', giver: 'Mara Sol',
    intro: 'Mara needs a package at the Marina. Take her sedan and drive it there — fast, but quiet.',
    steps: [
      { type: 'goto', text: 'Meet Mara Sol at the garage', x: 108, z: 108, radius: 6 },
      { type: 'enter', text: 'Get in a car', vehicle: 'any' },
      { type: 'goto', text: 'Deliver the package to the Marina docks', x: -352, z: 344, radius: 8, time: 150, inVehicle: true },
    ],
    reward: 300, rep: 150,
  },
  {
    id: 'm2', name: 'Hot Wheels', giver: 'Mara Sol',
    intro: 'A Comet GT is parked downtown, owner nowhere in sight. Steal it and bring it to Mara’s garage.',
    steps: [
      { type: 'goto', text: 'Find the Comet GT downtown', x: 204, z: -96, radius: 10 },
      { type: 'enter', text: 'Steal the Comet GT', vehicle: 'sport', missionCar: true },
      { type: 'goto', text: 'Deliver the Comet GT to Mara’s garage', x: 108, z: 108, radius: 8, inVehicle: true },
    ],
    reward: 500, rep: 250,
  },
  {
    id: 'm3', name: 'Tail the Courier', giver: 'Mara Sol',
    intro: 'A courier is moving product through the city. Tail him — stay close, but don’t spook him.',
    steps: [
      { type: 'enter', text: 'Get in a car to tail the courier', vehicle: 'any' },
      { type: 'chase', text: 'Tail the courier — stay within 60m for 20s', duration: 20 },
    ],
    reward: 600, rep: 300,
  },
  {
    id: 'm4', name: 'Sunset Grand Prix', giver: 'Mara Sol',
    intro: 'The street racers run the Grand Prix at sunset. Six gates, one winner. Beat the clock.',
    steps: [
      { type: 'enter', text: 'Get in a car for the race', vehicle: 'any' },
      { type: 'race', text: 'Race through the gates', time: 150,
        gates: [[-300, -300], [300, -300], [300, 300], [-100, 300], [-300, 100], [100, 100]] },
    ],
    reward: 800, rep: 400,
  },
  {
    id: 'm5', name: 'Lose the Heat', giver: 'Mara Sol',
    intro: 'The PBPD is all over you. Lose them — stay out of sight until the heat dies down.',
    steps: [
      { type: 'survive', text: 'Lose the cops — wanted level must hit 0', duration: 75 },
    ],
    reward: 700, rep: 350,
  },
  {
    id: 'm6', name: 'The Big Score', giver: 'Mara Sol',
    intro: 'One last job: grab the package at Sunset Plaza and fly it to Bayview Airfield. The whole city will be watching.',
    steps: [
      { type: 'goto', text: 'Pick up the package at Sunset Plaza', x: 250, z: 50, radius: 8 },
      { type: 'enter', text: 'Get in a car', vehicle: 'any' },
      { type: 'goto', text: 'Deliver the package to Bayview Airfield', x: 350, z: 380, radius: 10, time: 180, inVehicle: true },
    ],
    reward: 1500, rep: 600,
  },
];

function makeBeacon(scene) {
  const group = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  cyl.position.y = 30;
  group.add(cyl);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.5, 0.35, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  group.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  diamond.position.y = 8;
  group.add(diamond);
  group.visible = false;
  scene.add(group);
  return { group, diamond };
}

export class MissionManager {
  constructor(scene, ctx) {
    this.scene = scene;
    this.ctx = ctx; // { player, traffic, police, city, audio, toast, banner, addMoney, addRep, onMissionComplete }
    this.beacon = makeBeacon(scene);
    this.current = -1;      // mission index in MISSIONS, -1 = free roam
    this.step = 0;
    this.stepTimer = 0;
    this.chaseProgress = 0;
    this.chaseCar = null;
    this.raceGate = 0;
    this.taxi = null;       // { state: 'toPickup'|'toDrop', ped, x, z, fare }
    this.taxiCooldown = 0;
    this.shells = [];       // { mesh, x, z, taken }
    this.shellCooldown = 0;
    this.stuntCooldown = 0;
    this.rng = mulberry32(777);
    this.active = false;
  }

  // ---- story missions ----
  nextMissionIndex(save) {
    for (let i = 0; i < MISSIONS.length; i++) {
      if (!save.missionsDone.includes(MISSIONS[i].id)) return i;
    }
    return -1;
  }

  startMission(i) {
    const m = MISSIONS[i];
    this.current = i;
    this.step = 0;
    this.stepTimer = 0;
    this.chaseProgress = 0;
    this.raceGate = 0;
    this.active = true;
    // Hot Wheels: park the target Comet GT on the road downtown.
    if (m.id === 'm2') {
      const gt = new Vehicle(this.scene, 'sport', 204, -96, 0, 0xe23a4e);
      gt.driver = null;
      gt.missionCar = true;
      this.ctx.traffic.cars.push(gt);
      this.missionCar = gt;
    }
    this.ctx.toast(`<b>${m.name}</b> — ${m.intro}`, 6);
    this.ctx.audio.missionJingle();
    this.placeBeaconForStep();
    this.ctx.hud.setObjective(m.name, this.currentStep().text, null);
  }

  currentMission() { return this.current >= 0 ? MISSIONS[this.current] : null; }
  currentStep() {
    const m = this.currentMission();
    return m ? m.steps[this.step] : null;
  }

  abortMission(reason) {
    if (!this.active) return;
    this.active = false;
    this.current = -1;
    this.beacon.group.visible = false;
    this.cleanupChaseCar();
    this.cleanupMissionCar();
    this.ctx.hud.setObjective(null);
    if (reason) this.ctx.toast(reason, 4);
  }

  failStep(reason) {
    this.ctx.audio.failSting();
    this.ctx.toast(`<b>Mission failed:</b> ${reason}`, 5);
    this.abortMission(null);
  }

  completeMission() {
    const m = this.currentMission();
    this.ctx.addMoney(m.reward);
    this.ctx.addRep(m.rep);
    this.ctx.audio.missionJingle();
    this.ctx.banner('MISSION PASSED', `${m.name}  ·  +$${m.reward}  ·  +${m.rep} REP`);
    this.ctx.save.missionsDone.push(m.id);
    this.ctx.saveGame();
    this.active = false;
    this.current = -1;
    this.beacon.group.visible = false;
    this.cleanupChaseCar();
    this.cleanupMissionCar();
    this.ctx.hud.setObjective(null);
    this.ctx.onMissionComplete(m);
  }

  placeBeaconForStep() {
    const step = this.currentStep();
    if (!step) { this.beacon.group.visible = false; return; }
    if (step.x !== undefined) {
      this.beacon.group.position.set(step.x, 0, step.z);
      this.beacon.group.visible = true;
    } else if (step.type === 'race') {
      const g = step.gates[this.raceGate];
      this.beacon.group.position.set(g[0], 0, g[1]);
      this.beacon.group.visible = true;
    } else if (step.type === 'chase' && this.chaseCar) {
      this.beacon.group.visible = true;
    } else {
      this.beacon.group.visible = false;
    }
  }

  spawnChaseCar() {
    const { player, traffic, city } = this.ctx;
    const px = player.inVehicle ? player.inVehicle.x : player.x;
    const pz = player.inVehicle ? player.inVehicle.z : player.z;
    const p = city.nearestRoadPoint(px + 60, pz + 40);
    const car = new Vehicle(this.scene, 'sedan', p.x, p.z, 0, 0xd8d8e0);
    car.driver = 'mission';
    car.cruiseSpeed = 24;
    traffic.cars.push(car);
    this.chaseCar = car;
    return car;
  }

  cleanupMissionCar() {
    if (this.missionCar) {
      const { traffic } = this.ctx;
      // only remove it if the player did not keep driving it
      if (this.missionCar.driver !== 'player') {
        traffic.cars = traffic.cars.filter((c) => c !== this.missionCar);
        this.missionCar.remove();
      }
      this.missionCar = null;
    }
  }

  cleanupChaseCar() {
    if (this.chaseCar) {
      const { traffic } = this.ctx;
      traffic.cars = traffic.cars.filter((c) => c !== this.chaseCar);
      this.chaseCar.remove();
      this.chaseCar = null;
    }
  }

  // ---- side activities ----
  seedShells(spots, takenIndices) {
    for (let i = 0; i < spots.length; i++) {
      if (takenIndices.includes(i)) continue;
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.1),
        new THREE.MeshBasicMaterial({ color: 0xff9ad5 }),
      );
      mesh.position.set(spots[i].x, 1.4, spots[i].z);
      this.scene.add(mesh);
      this.shells.push({ mesh, x: spots[i].x, z: spots[i].z, index: i });
    }
  }

  update(dt, t) {
    // beacon animation
    if (this.beacon.group.visible) {
      this.beacon.diamond.rotation.y += dt * 2;
      this.beacon.diamond.position.y = 8 + Math.sin(t * 2.5) * 0.8;
    }
    // shells
    for (const s of this.shells) {
      s.mesh.rotation.y += dt * 1.5;
      s.mesh.position.y = 1.4 + Math.sin(t * 2 + s.index) * 0.25;
    }
    this.updateMission(dt);
    this.updateTaxi(dt);
    this.updateShells(dt);
    this.updateStunts(dt);
  }

  playerPos() {
    const { player } = this.ctx;
    return player.inVehicle ? { x: player.inVehicle.x, z: player.inVehicle.z } : { x: player.x, z: player.z };
  }

  updateMission(dt) {
    if (!this.active) return;
    const m = this.currentMission();
    const step = this.currentStep();
    if (!step) return;
    const { player, police } = this.ctx;
    const pos = this.playerPos();

    // step timer (timed steps)
    if (step.time) {
      this.stepTimer += dt;
      const left = Math.max(0, step.time - this.stepTimer);
      this.ctx.hud.setTimer(left);
      if (left <= 0) { this.failStep('Out of time.'); return; }
    } else {
      this.ctx.hud.setTimer(null);
    }

    switch (step.type) {
      case 'goto': {
        const d = dist2d(pos.x, pos.z, step.x, step.z);
        this.ctx.hud.setObjective(m.name, step.text, d);
        if (step.inVehicle && !player.inVehicle) {
          this.ctx.hud.setObjective(m.name, step.text + ' (in a car!)', d);
        } else if (d < step.radius) {
          this.advanceStep();
        }
        break;
      }
      case 'enter': {
        this.ctx.hud.setObjective(m.name, step.text, null);
        if (player.inVehicle) {
          if (step.vehicle === 'any' || player.inVehicle.typeKey === step.vehicle) this.advanceStep();
          else this.ctx.hud.setObjective(m.name, step.text + ` — need a ${step.vehicle}`, null);
        }
        break;
      }
      case 'chase': {
        if (!this.chaseCar) this.spawnChaseCar();
        const car = this.chaseCar;
        // flee AI: drive along roads away from the player
        const d = dist2d(pos.x, pos.z, car.x, car.z);
        this.ctx.hud.setObjective(m.name, step.text, d);
        this.beacon.group.position.set(car.x, 0, car.z);
        this.beacon.group.visible = true;
        if (d < 60) {
          this.chaseProgress += dt;
          if (d < 10) this.chaseProgress -= dt * 1.5; // too close spooks him
        } else {
          this.chaseProgress -= dt * 0.5;
        }
        this.chaseProgress = clamp(this.chaseProgress, 0, step.duration);
        this.ctx.hud.setTimer(step.duration - this.chaseProgress);
        if (this.chaseProgress >= step.duration) this.advanceStep();
        break;
      }
      case 'race': {
        const gate = step.gates[this.raceGate];
        const d = dist2d(pos.x, pos.z, gate[0], gate[1]);
        this.ctx.hud.setObjective(m.name, `${step.text} — gate ${this.raceGate + 1}/${step.gates.length}`, d);
        if (d < 12) {
          this.raceGate++;
          this.ctx.audio.pickup();
          this.ctx.toast(`Gate ${this.raceGate}/${step.gates.length}!`, 1.5);
          if (this.raceGate >= step.gates.length) this.advanceStep();
          else this.placeBeaconForStep();
        }
        break;
      }
      case 'survive': {
        this.ctx.hud.setObjective(m.name, step.text, null);
        if (police.wanted === 0) {
          this.stepTimer += dt;
          this.ctx.hud.setTimer(Math.max(0, step.duration - this.stepTimer));
          if (this.stepTimer >= step.duration) this.advanceStep();
        } else {
          this.stepTimer = Math.max(0, this.stepTimer - dt * 0.5);
          this.ctx.hud.setTimer(step.duration - this.stepTimer);
        }
        break;
      }
      default: break;
    }
  }

  advanceStep() {
    const m = this.currentMission();
    this.step++;
    this.stepTimer = 0;
    this.ctx.audio.pickup();
    if (this.step >= m.steps.length) {
      this.completeMission();
    } else {
      this.placeBeaconForStep();
      this.ctx.hud.setObjective(m.name, this.currentStep().text, null);
    }
  }

  updateTaxi(dt) {
    const { player, traffic } = this.ctx;
    this.taxiCooldown -= dt;
    // start a fare when the player is driving a taxi and free
    if (!this.taxi && player.inVehicle && player.inVehicle.typeKey === 'taxi' && !this.active && this.taxiCooldown <= 0) {
      const peds = traffic.peds.filter((p) => !p.dead);
      if (peds.length > 0) {
        const ped = peds[Math.floor(this.rng() * peds.length)];
        this.taxi = { state: 'toPickup', ped, x: ped.x, z: ped.z, fare: 40 + Math.floor(this.rng() * 40) };
        this.ctx.toast('Taxi fare: pick up the passenger (pink marker on the minimap).', 4);
      }
    }
    if (!this.taxi) return;
    const pos = this.playerPos();
    if (this.taxi.state === 'toPickup') {
      this.taxi.x = this.taxi.ped.x; this.taxi.z = this.taxi.ped.z;
      if (dist2d(pos.x, pos.z, this.taxi.x, this.taxi.z) < 6 && player.inVehicle) {
        this.taxi.state = 'toDrop';
        const dest = this.ctx.city.randomRoadPoint(this.rng);
        this.taxi.x = dest.x; this.taxi.z = dest.z;
        this.ctx.toast('Passenger aboard — take them to the drop-off.', 3);
      }
    } else if (dist2d(pos.x, pos.z, this.taxi.x, this.taxi.z) < 8 && player.inVehicle) {
      this.ctx.addMoney(this.taxi.fare);
      this.ctx.save.taxiDone++;
      this.ctx.audio.missionJingle();
      this.ctx.toast(`Fare complete: <b>+$${this.taxi.fare}</b>`, 3);
      this.taxi = null;
      this.taxiCooldown = 5;
    }
    // cancel if the player leaves the taxi
    if (!player.inVehicle && this.taxi) {
      this.taxi = null;
      this.taxiCooldown = 8;
    }
  }

  updateShells(dt) {
    const pos = this.playerPos();
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      if (dist2d(pos.x, pos.z, s.x, s.z) < 3) {
        this.scene.remove(s.mesh);
        this.shells.splice(i, 1);
        this.ctx.save.shells.push(s.index);
        this.ctx.addMoney(25);
        this.ctx.addRep(10);
        this.ctx.audio.pickup();
        this.ctx.toast('Sunset shell found! <b>+$25</b>', 2);
        this.ctx.saveGame();
      }
    }
  }

  updateStunts(dt) {
    const { player, city } = this.ctx;
    this.stuntCooldown -= dt;
    if (!player.inVehicle || this.stuntCooldown > 0) return;
    const car = player.inVehicle;
    if (Math.abs(car.speed) < 18) return;
    for (const r of city.ramps) {
      if (dist2d(car.x, car.z, r.x, r.z) < 7) {
        this.stuntCooldown = 6;
        this.ctx.addMoney(50);
        this.ctx.addRep(15);
        this.ctx.audio.missionJingle();
        this.ctx.banner('STUNT JUMP!', '+$50  ·  the crowd goes wild');
        car.group.position.y = 0; // visual hop handled by effects
        this.ctx.effects.stuntBurst(car.x, car.z);
        break;
      }
    }
  }
}
