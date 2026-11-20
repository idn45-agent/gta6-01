// Combat for Sunset Coast v2 — fists on foot, ramming in a car.
// Punching a pedestrian or a cop is a crime (wanted +1, +2 for a cop).
// Ramming pedestrians or police cars at speed is a crime too, and
// damages the player's car and health.
import { dist2d } from './util.js';

export class Combat {
  constructor(ctx) {
    this.ctx = ctx; // { player, traffic, police, audio, toast, effects }
    this.hitCooldown = 0;
  }

  update(dt) {
    this.hitCooldown -= dt;
    const { player, traffic, police, audio } = this.ctx;
    if (player.inVehicle) {
      this.updateCarImpacts(dt);
      return;
    }
    // on-foot punch
    if (player.punchTimer > 0 && this.hitCooldown <= 0) {
      // punch pedestrians
      for (const ped of traffic.peds) {
        if (ped.dead) continue;
        if (player.punchHits(ped.x, ped.z)) {
          ped.knockDown();
          audio.punch();
          this.ctx.effects.burst(ped.x, 1.2, ped.z, 0xffe9a8, 8);
          police.addWanted(1, 'assault');
          this.ctx.toast('You decked a pedestrian! The cops noticed.', 2.5);
          this.hitCooldown = 0.4;
          return;
        }
      }
      // punch cops
      for (const cop of police.cops) {
        if (cop.dead) continue;
        if (player.punchHits(cop.x, cop.z, 3.2)) {
          cop.damage(25);
          audio.punch();
          this.ctx.effects.burst(cop.x, 1.2, cop.z, 0x9fe8ff, 8);
          police.addWanted(2, 'assault officer');
          this.ctx.toast('You punched a cop! That was bold.', 2.5);
          this.hitCooldown = 0.4;
          return;
        }
      }
    }
  }

  updateCarImpacts(dt) {
    const { player, traffic, police, audio } = this.ctx;
    const car = player.inVehicle;
    if (!car || Math.abs(car.speed) < 6) return;
    const speed = Math.abs(car.speed);
    // hit pedestrians
    for (const ped of traffic.peds) {
      if (ped.dead) continue;
      if (dist2d(car.x, car.z, ped.x, ped.z) < 2.4) {
        ped.knockDown();
        car.damage(4);
        audio.thud(1);
        this.ctx.effects.burst(ped.x, 1.2, ped.z, 0xffe9a8, 10);
        police.addWanted(1, 'hit pedestrian');
        this.ctx.toast('You hit a pedestrian!', 2);
      }
    }
    // ram traffic cars
    for (const other of traffic.cars) {
      if (other === car || other.dead) continue;
      if (car.bump(other, 1)) {
        audio.thud(0.8);
        this.ctx.effects.burst((car.x + other.x) / 2, 1, (car.z + other.z) / 2, 0xffb36b, 10);
        if (other.driver === 'traffic' && speed > 18) police.addWanted(1, 'reckless driving');
      }
    }
    // ram police cars
    for (const cop of police.cops) {
      if (cop.dead) continue;
      if (car.bump(cop, 1.2)) {
        audio.thud(1);
        this.ctx.effects.burst((car.x + cop.x) / 2, 1, (car.z + cop.z) / 2, 0x9fe8ff, 12);
        police.addWanted(2, 'rammed police');
        this.ctx.toast('You rammed a police car!', 2);
      }
    }
  }
}
