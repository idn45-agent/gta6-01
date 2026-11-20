// Sunset Coast v2 — main entry point. Boots the renderer, owns the
// game loop, the chase camera, entering/exiting cars, the menu / pause /
// wasted state machine, saving, and the ?scene= presets the maker uses
// for screenshots. All systems (city, traffic, police, missions,
// combat, audio, HUD, minimap) are wired together here.
import * as THREE from 'three';
import { City, WORLD } from './city.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { MissionManager, MISSIONS } from './missions.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { HUD } from './hud.js';
import { Minimap } from './minimap.js';
import { Input } from './input.js';
import { loadSave, writeSave, defaultSave, clearSave } from './save.js';
import { mulberry32, clamp, lerp, angleLerp, dist2d } from './util.js';

const SPAWN = { x: 3, z: 40 };
const MARA = { x: 112, z: 112 };

export class Game {
  constructor() {
    this.state = 'menu'; // menu | playing | paused | wasted | missionPassed
    this.time = 0;
    this.errors = [];
    this.save = loadSave() || defaultSave();
    this.rng = mulberry32(20261120);
    this.audio = new AudioEngine();
    this.hud = new HUD();
    this.input = null;
    this.nextMissionDelay = 0;
    this.lastDamageAt = -100;
    this.maraBeaconOn = false;
    this.scenePreset = null;
    window.addEventListener('error', (e) => this.errors.push(String(e.message || e.error)));
  }

  init() {
    const app = document.getElementById('app');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    app.appendChild(this.renderer.domElement);
    this.input = new Input(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(40, 30, 80);

    this.city = new City(this.scene);
    this.effects = new Effects(this.scene);
    this.player = new Player(this.scene, SPAWN.x, SPAWN.z);
    this.traffic = new Traffic(this.scene, this.city, mulberry32(99));
    this.traffic.seedWorld();
    this.police = new Police(this.scene, this.city, mulberry32(7));

    const ctx = {
      player: this.player,
      traffic: this.traffic,
      police: this.police,
      city: this.city,
      audio: this.audio,
      effects: this.effects,
      save: this.save,
      hud: this.hud,
      toast: (html, s) => this.hud.toast(html, s),
      banner: (t, s) => this.hud.banner(t, s),
      addMoney: (n) => { this.save.money += n; this.save.totalEarned += n; },
      addRep: (n) => { this.save.rep += n; },
      saveGame: () => this.saveGame(),
      onMissionComplete: (m) => this.onMissionComplete(m),
    };
    this.missions = new MissionManager(this.scene, ctx);
    this.missions.seedShells(this.city.shellSpots, this.save.shells);
    this.combat = new Combat({ ...ctx, effects: this.effects });
    this.minimap = new Minimap(document.getElementById('minimap'));

    // Mara Sol NPC at the garage — a pink-jacketed figure with a marker.
    this.maraGroup = new THREE.Group();
    const maraBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.34),
      new THREE.MeshLambertMaterial({ color: 0xff4d8d }));
    maraBody.position.y = 1.15;
    this.maraGroup.add(maraBody);
    const maraHead = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xe8b890 }));
    maraHead.position.y = 1.78;
    this.maraGroup.add(maraHead);
    const maraHair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.44),
      new THREE.MeshLambertMaterial({ color: 0x2a1210 }));
    maraHair.position.y = 2.02;
    this.maraGroup.add(maraHair);
    const maraDiamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.0),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    maraDiamond.position.y = 3.2;
    this.maraGroup.add(maraDiamond);
    this.maraDiamond = maraDiamond;
    this.maraGroup.position.set(MARA.x, 0, MARA.z);
    this.scene.add(this.maraGroup);

    // camera state
    this.camYaw = Math.PI;
    this.camPitch = -0.32;
    this.camDist = 11;
    this.lastDragAt = -10;

    this.wireUI();
    this.applyScenePreset();
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.saveGame();
    });
    document.getElementById('loading').remove();
    // A ?scene= preset already started the game (screenshot staging);
    // otherwise show the menu.
    if (!this.scenePreset) {
      this.hud.showStart(this.save.money > 250 || this.save.missionsDone.length > 0 ? this.save : null,
        this.save.missionsDone.map((id) => MISSIONS.findIndex((m) => m.id === id)).filter((i) => i >= 0));
    }
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
    window.__game = this;
    window.__gameReady = true;
  }

  // ---- UI wiring ----
  wireUI() {
    const $ = (id) => document.getElementById(id);
    $('playBtn').addEventListener('click', () => {
      this.audio.ensure();
      this.startGame(false);
    });
    $('continueBtn').addEventListener('click', () => {
      this.audio.ensure();
      this.startGame(true);
    });
    $('resumeBtn').addEventListener('click', () => this.resume());
    $('saveBtn').addEventListener('click', () => {
      this.saveGame();
      this.hud.toast('Game saved.', 2);
    });
    $('quitBtn').addEventListener('click', () => {
      this.saveGame();
      this.state = 'menu';
      this.hud.hidePause();
      this.hud.hide();
      this.hud.showStart(this.save, this.save.missionsDone.map((id) => MISSIONS.findIndex((m) => m.id === id)));
    });
    $('retryBtn').addEventListener('click', () => this.respawn());
    $('wastedMenuBtn').addEventListener('click', () => {
      this.state = 'menu';
      this.hud.hideWasted();
      this.hud.hide();
      this.hud.showStart(this.save, this.save.missionsDone.map((id) => MISSIONS.findIndex((m) => m.id === id)));
    });
    $('missionNextBtn').addEventListener('click', () => {
      this.hud.hideMissionPassed();
      this.state = 'playing';
      this.nextMissionDelay = 1.5;
    });
  }

  startGame(useSavedPosition) {
    this.hud.hideStart();
    this.hud.show();
    this.state = 'playing';
    if (this.player.inVehicle) {
      this.player.inVehicle.driver = null;
      this.player.inVehicle = null;
      this.player.group.visible = true;
    }
    if (useSavedPosition && this.save.position) {
      this.player.teleport(this.save.position.x, this.save.position.z);
    } else {
      this.player.teleport(SPAWN.x, SPAWN.z);
    }
    this.player.health = 100;
    this.police.clearWanted();
    // first job: auto-start the next story mission shortly after spawn
    this.nextMissionDelay = 2;
    this.hud.toast('Welcome back to Palmera Bay, Ray. Mara has work for you.', 4);
  }

  resume() {
    this.hud.hidePause();
    this.state = 'playing';
  }

  respawn() {
    this.hud.hideWasted();
    this.save.money = Math.max(0, Math.floor(this.save.money * 0.9));
    this.player.health = 100;
    if (this.player.inVehicle) {
      this.player.inVehicle.driver = null;
      this.player.inVehicle = null;
      this.player.group.visible = true;
    }
    this.player.teleport(20, 40);
    this.police.clearWanted();
    this.missions.abortMission(null);
    this.state = 'playing';
    this.nextMissionDelay = 2;
    this.hud.toast('Hospital bill paid. Back on the streets.', 3);
  }

  onMissionComplete(m) {
    const next = this.missions.nextMissionIndex(this.save);
    const stats = this.hud.statHtml([
      [`$${m.reward}`, 'REWARD'],
      [`+${m.rep}`, 'REPUTATION'],
      [`${this.save.missionsDone.length}/6`, 'MISSIONS DONE'],
    ]);
    const title = next === -1 ? 'ALL MISSIONS COMPLETE' : 'MISSION PASSED';
    const text = next === -1
      ? 'You did every job Mara had. Palmera Bay is yours, Ray Vega — King of the Sunset Coast.'
      : `${m.name} is done. Mara will have another job soon — keep driving.`;
    this.state = 'missionPassed';
    this.hud.showMissionPassed(title, text, stats);
  }

  saveGame() {
    this.save.position = this.player.inVehicle
      ? { x: this.player.inVehicle.x, z: this.player.inVehicle.z }
      : { x: this.player.x, z: this.player.z };
    writeSave(this.save);
  }

  // ---- scene presets (?scene=...) for screenshots ----
  applyScenePreset() {
    const q = new URLSearchParams(location.search);
    const scene = q.get('scene');
    const autostart = q.get('autostart') === '1';
    if (!scene && !autostart) return;
    if (q.get('fresh') === '1') this.save = defaultSave();
    this.scenePreset = scene || 'free';
    // start the game immediately, skipping the menu
    this.hud.hideStart();
    this.hud.show();
    this.state = 'playing';
    this.player.health = 100;
    if (q.get('money')) this.save.money = parseInt(q.get('money'), 10) || this.save.money;
    const pos = q.get('pos');
    if (pos) {
      const [x, z] = pos.split(',').map(Number);
      this.player.teleport(x || SPAWN.x, z || SPAWN.z);
    }
    const wanted = parseInt(q.get('wanted') || '0', 10);
    if (wanted > 0) this.police.setWanted(wanted);

    if (scene === 'cover') {
      // Ray in a Comet GT on a downtown avenue, traffic around
      const car = this.traffic.spawnCar(0, -20, 0, 'sport', null, 0xe23a4e);
      this.enterCar(car, true);
      car.speed = 0;
      this.sceneCar = car;
      this.sceneCarColor = 0xe23a4e;
      this.camYaw = Math.PI + 0.3;
      this.camPitch = -0.22;
      this.camDist = 13;
    } else if (scene === 'street') {
      this.player.teleport(4, 96);
      this.player.heading = Math.PI * 0.9;
      // pull a few pedestrians and a taxi into frame
      const spots = [[-6, 92], [10, 104], [-12, 104], [14, 90], [-2, 108]];
      this.traffic.peds.slice(0, 5).forEach((ped, i) => {
        ped.x = spots[i][0]; ped.z = spots[i][1];
        ped.group.position.set(ped.x, 0, ped.z);
      });
      this.traffic.spawnCar(-80, 103.5, Math.PI / 2, 'taxi', 'traffic');
      this.camYaw = Math.PI * 0.85;
      this.camPitch = -0.3;
      this.camDist = 9;
    } else if (scene === 'chase') {
      const car = this.traffic.spawnCar(0, -20, 0, 'sport', null, 0xe23a4e);
      this.enterCar(car, true);
      car.speed = 26;
      this.sceneCar = car;
      this.sceneCarColor = 0xe23a4e;
      this.police.setWanted(4);
      for (let i = 0; i < 3; i++) this.police.spawnCopNear(car.x + 20 * (i - 1), car.z - 30);
      this.police.ensureHeli();
      this.camYaw = Math.PI + 0.15;
      this.camPitch = -0.24;
      this.camDist = 14;
    } else if (scene === 'mission') {
      this.missions.startMission(0);
      const car = this.traffic.spawnCar(104, 120, 0, 'sedan', null, 0x4a7fb8);
      this.enterCar(car, true);
      this.sceneCar = car;
      this.sceneCarColor = 0x4a7fb8;
      this.camYaw = Math.PI + 0.3;
      this.camPitch = -0.26;
      this.camDist = 13;
    }
    // spread traffic/peds so the shot looks alive
    this.fastForward(4);
    // Re-assert the staged scene: the chase may have wrecked the car
    // during the fast-forward, so restore it before the shot.
    if (this.sceneCar) {
      const car = this.sceneCar;
      if (car.dead) {
        // respawn the staged car fresh, in its staged colour
        const fresh = this.traffic.spawnCar(0, -20, 0, car.typeKey, null, this.sceneCarColor);
        this.enterCar(fresh, true);
        this.sceneCar = fresh;
        if (scene === 'chase') {
          fresh.speed = 26;
          this.police.setWanted(4);
          this.stageCopsNear(fresh.x, fresh.z);
        }
      } else {
        car.hp = 100;
        if (!this.player.inVehicle) this.enterCar(car, true);
        if (scene === 'chase') {
          car.speed = 26;
          this.stageCopsNear(car.x, car.z);
        } else car.speed = 0;
      }
      this.player.health = 100;
    }
    this.snapCamera = true;
  }

  // Pull up to 3 pursuit cops into frame behind the staged car.
  stageCopsNear(x, z) {
    let placed = 0;
    for (const cop of this.police.cops) {
      if (cop.driver !== 'police' || placed >= 3) continue;
      cop.x = x + (placed - 1) * 14;
      cop.z = z - 22 - placed * 6;
      cop.heading = 0;
      cop.speed = 26;
      placed++;
    }
    while (placed < 3) {
      const cop = this.police.spawnCopNear(x + (placed - 1) * 14, z - 22 - placed * 6);
      cop.speed = 26;
      placed++;
    }
  }

  // Run the simulation forward without rendering (screenshot staging).
  fastForward(seconds) {
    const steps = Math.round(seconds * 30);
    for (let i = 0; i < steps; i++) this.tick(1 / 30, true);
  }

  // ---- car enter / exit ----
  enterCar(car, force = false) {
    if (!car || car.dead) return false;
    if (car.driver === 'traffic') {
      // steal a moving car: the driver bails, cops notice
      car.driver = null;
      this.police.addWanted(1, 'car theft');
      this.hud.toast('You stole a car! The PBPD is on to you.', 2.5);
    } else if (car.missionCar) {
      this.police.addWanted(1, 'car theft');
      this.hud.toast('Hot wheels! Get it to Mara — fast.', 2.5);
    }
    car.driver = 'player';
    this.player.inVehicle = car;
    this.player.group.visible = false;
    this.audio.ensure();
    return true;
  }

  tryEnterCar() {
    const car = this.traffic.nearestDrivableCar(this.player.x, this.player.z, 6)
      || this.nearestMissionCar(6);
    if (car) {
      // mission 2's Comet GT is a dedicated spawned car
      if (this.enterCar(car)) this.hud.hint('');
      return;
    }
    this.hud.toast('No car nearby.', 1.5);
  }

  nearestMissionCar(maxDist) {
    // the chase target is not enterable; mission cars live in traffic
    return null;
  }

  exitCar() {
    const car = this.player.inVehicle;
    if (!car) return;
    if (Math.abs(car.speed) > 3) {
      this.hud.toast('Slow down before getting out!', 1.5);
      return;
    }
    car.driver = null;
    car.speed = 0;
    this.player.inVehicle = null;
    const side = 2.6;
    this.player.teleport(car.x + Math.cos(car.heading) * side, car.z - Math.sin(car.heading) * side);
    this.player.group.visible = true;
    this.player.heading = car.heading;
  }

  // ---- per-frame ----
  frame() {
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = clamp(dt, 0.001, 0.05);
    // Global keys that must work outside the playing state too.
    if (this.input.wasPressed('KeyP')) {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.saveGame();
        this.hud.showPause(this.hud.statHtml([
          [fmtMoneyShort(this.save.money), 'CASH'],
          [`${this.save.missionsDone.length}/6`, 'MISSIONS'],
          [`${this.save.shells.length}/20`, 'SHELLS'],
        ]));
      } else if (this.state === 'paused') this.resume();
    }
    if (this.state === 'playing') this.tick(dt, false);
    else if (this.state === 'menu') {
      // slow orbit around the city behind the menu
      this.time += dt;
      const a = this.time * 0.03;
      this.camera.position.set(Math.sin(a) * 320, 120, Math.cos(a) * 320);
      this.camera.lookAt(0, 0, 0);
      this.city.update(dt, this.time);
    }
    this.renderer.render(this.scene, this.camera);
    if (this.input) this.input.endFrame();
  }

  tick(dt, silent) {
    this.time += dt;
    const input = this.input;

    // global keys
    if (input.wasPressed('KeyM')) {
      this.audio.setMuted(!this.audio.muted);
      this.hud.toast(this.audio.muted ? 'Sound muted.' : 'Sound on.', 1.5);
    }
    if (input.wasPressed('KeyR') && this.missions.active) {
      const i = this.missions.current;
      this.missions.abortMission(null);
      this.missions.startMission(i);
    }
    if (input.wasPressed('KeyH') && this.player.inVehicle) this.audio.honk();

    // camera orbit from mouse drag
    if (input.mouseDX || input.mouseDY) {
      this.camYaw -= input.mouseDX * 0.005;
      this.camPitch = clamp(this.camPitch + input.mouseDY * 0.003, -1.0, -0.05);
      this.lastDragAt = this.time;
    }

    // enter / exit car
    if (input.wasPressed('KeyE')) {
      this.audio.ensure();
      if (this.player.inVehicle) this.exitCar();
      else this.tryEnterCar();
    }

    // player / vehicle control
    if (this.player.inVehicle) {
      const car = this.player.inVehicle;
      const axis = input.moveAxis();
      car.drive(dt, axis.f, -axis.s, input.down('Space'));
      // building collision for cars (push-out + damage)
      const p = { x: car.x, z: car.z };
      if (this.city.collideCircle(p, car.length / 2)) {
        const impact = Math.abs(car.speed);
        car.x = p.x; car.z = p.z;
        if (impact > 8) {
          car.damage(impact * 0.5);
          this.player.damage(impact * 0.12);
          this.audio.thud(1);
          this.effects.burst(car.x, 1, car.z, 0xffb36b, 12);
          this.lastDamageAt = this.time;
        }
        car.speed *= -0.25;
      }
      // car destroyed -> explosion, eject
      if (car.dead) {
        this.effects.explosion(car.x, car.z);
        this.audio.thud(1.5);
        this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
        car.remove();
        this.player.inVehicle = null;
        this.player.teleport(car.x + 3, car.z + 3);
        this.player.damage(25);
        this.lastDamageAt = this.time;
        this.hud.banner('CAR DESTROYED', 'Your ride is scrap metal now.');
      }
    } else {
      this.player.update(dt, input, this.camYaw + Math.PI, (p, r) => this.city.collideCircle(p, r));
      // interact hint near cars
      const near = this.traffic.nearestDrivableCar(this.player.x, this.player.z, 6);
      this.hud.interact(near ? '[E] ENTER CAR' : '');
    }
    if (this.player.inVehicle) this.hud.interact('');

    // health regen
    if (this.time - this.lastDamageAt > 6 && this.player.health < 100) {
      this.player.heal(2.5 * dt);
    }

    // world systems
    this.city.update(dt, this.time);
    this.traffic.update(dt, this.player, this.police.wanted);
    this.police.update(dt, this.player, this.traffic);
    this.combat.update(dt);
    this.missions.update(dt, this.time);
    this.effects.update(dt);

    // Mara marker bob + next-mission beacon
    this.maraDiamond.rotation.y += dt * 2;
    this.maraDiamond.position.y = 3.2 + Math.sin(this.time * 2) * 0.25;
    const next = this.missions.nextMissionIndex(this.save);
    if (!this.missions.active && next >= 0 && this.state === 'playing') {
      this.nextMissionDelay -= dt;
      if (this.nextMissionDelay <= 0) {
        // auto-start the next job when Ray reaches Mara
        const d = dist2d(this.player.x, this.player.z, MARA.x, MARA.z);
        this.hud.setObjective('NEXT JOB', `Meet Mara Sol at the garage — ${MISSIONS[next].name}`, d);
        if (d < 7) this.missions.startMission(next);
      }
    }

    // audio follows driving
    const driving = !!this.player.inVehicle;
    const speed01 = driving ? clamp(Math.abs(this.player.inVehicle.speed) / 48, 0, 1) : 0;
    this.audio.update(dt, { speed01, driving, wanted: this.police.wanted, time: this.time });

    // wasted?
    if (this.player.health <= 0 && this.state === 'playing') {
      this.state = 'wasted';
      this.audio.failSting();
      this.police.clearWanted();
      this.hud.showWasted(this.hud.statHtml([
        [fmtMoneyShort(this.save.money), 'CASH'],
        [`${this.save.missionsDone.length}/6`, 'MISSIONS'],
        [`${this.save.shells.length}/20`, 'SHELLS'],
      ]), this.police.wanted > 0 ? 'Busted by the Palmera Bay PD.' : 'The streets of Palmera Bay got the better of Ray Vega.');
      this.saveGame();
    }

    // camera
    this.updateCamera(dt);

    // HUD + minimap
    const v = this.player.inVehicle;
    this.hud.update({
      health: this.player.health,
      money: this.save.money,
      rep: this.save.rep,
      wanted: this.police.wanted,
      missionsDone: this.save.missionsDone.length,
      vehicle: v,
      speedKmh: v ? Math.abs(v.speed) * 3.6 : 0,
      carName: v ? v.type.name : '',
    });
    this.minimap.draw({
      playerX: v ? v.x : this.player.x,
      playerZ: v ? v.z : this.player.z,
      heading: v ? v.heading : this.player.heading,
      inVehicle: !!v,
      traffic: this.traffic.cars,
      cops: this.police.cops,
      heli: this.police.heli,
      beacon: this.missions.beacon.group.visible
        ? { x: this.missions.beacon.group.position.x, z: this.missions.beacon.group.position.z, visible: true }
        : null,
      taxi: this.missions.taxi ? { x: this.missions.taxi.x, z: this.missions.taxi.z } : null,
      shells: this.missions.shells,
      city: this.city,
    });

    if (!silent) {
      // hint line for new players
      if (!this.player.inVehicle && !this.missions.active) {
        this.hud.hint('<b>WASD</b> move · <b>SHIFT</b> sprint · <b>E</b> enter car · <b>F</b> punch · <b>P</b> pause');
      } else if (this.player.inVehicle) {
        this.hud.hint('<b>W/S</b> drive · <b>A/D</b> steer · <b>SPACE</b> handbrake · <b>E</b> exit · <b>H</b> honk');
      } else {
        this.hud.hint('');
      }
    }
  }

  updateCamera(dt) {
    const v = this.player.inVehicle;
    const tx = v ? v.x : this.player.x;
    const tz = v ? v.z : this.player.z;
    const ty = v ? 1.6 : 1.8;
    const heading = v ? v.heading : this.player.heading;
    // ease the orbit back behind the direction of travel when the player is moving
    const moving = v ? Math.abs(v.speed) > 4 : this.player.moving;
    const sinceDrag = this.time - this.lastDragAt;
    if (moving && sinceDrag > 2.5 && !this.snapCamera) {
      this.camYaw = angleLerp(this.camYaw, heading + Math.PI, 1 - Math.exp(-1.2 * dt));
    }
    const targetDist = v ? 13 : 10;
    this.camDist = lerp(this.camDist, targetDist, 1 - Math.exp(-3 * dt));
    const cx = tx + Math.sin(this.camYaw) * this.camDist * Math.cos(this.camPitch);
    const cz = tz + Math.cos(this.camYaw) * this.camDist * Math.cos(this.camPitch);
    const cy = ty - Math.sin(this.camPitch) * this.camDist;
    const desired = new THREE.Vector3(cx, Math.max(2.5, cy), cz);
    if (this.snapCamera) {
      this.camera.position.copy(desired);
      this.snapCamera = false;
    } else {
      this.camera.position.lerp(desired, 1 - Math.exp(-10 * dt));
    }
    this.camera.lookAt(tx, ty, tz);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function fmtMoneyShort(n) {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + Math.floor(n);
}

const game = new Game();
game.init();
