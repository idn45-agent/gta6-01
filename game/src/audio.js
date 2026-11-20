// Sunset Coast v2 audio — everything is synthesised with WebAudio, no
// audio files. Engine hum, siren, collisions, pickups, mission jingles
// and a lazy sunset pad loop. Created lazily on first user gesture.
import { clamp } from './util.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.padOscs = [];
    this.padGain = null;
    this.started = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const ctx = this.ctx;
      // Engine: sawtooth through a low-pass, pitch follows speed.
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(ctx.destination);
      this.engineOsc.start();
      // Siren: two-tone square wave, gain gated by wanted level.
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0;
      const sirenFilter = ctx.createBiquadFilter();
      sirenFilter.type = 'bandpass';
      sirenFilter.frequency.value = 900;
      this.sirenOsc.connect(sirenFilter).connect(this.sirenGain).connect(ctx.destination);
      this.sirenOsc.start();
      this.sirenTimer = 0;
      // Sunset pad: slow detuned triangle chord (Am7 -> F -> C -> G).
      this.padGain = ctx.createGain();
      this.padGain.gain.value = 0.0;
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 700;
      this.padGain.connect(padFilter).connect(ctx.destination);
      this.padChords = [
        [220.0, 261.63, 329.63, 392.0],
        [174.61, 220.0, 261.63, 349.23],
        [130.81, 196.0, 261.63, 329.63],
        [196.0, 246.94, 293.66, 392.0],
      ];
      this.padIndex = 0;
      this.padNext = 0;
      this.started = true;
    } catch (e) {
      this.ctx = null; // audio unavailable — game still plays silent
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.ctx.destination.gain ? null : null;
    if (this.engineGain) this.engineGain.gain.value = m ? 0 : this.engineGain.gain.value;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
    if (this.padGain) this.padGain.gain.value = 0;
  }

  // Called every frame with the driving state.
  update(dt, { speed01, driving, wanted, time }) {
    if (!this.ctx || this.muted) return;
    if (this.engineGain) {
      const target = driving ? 0.05 + speed01 * 0.075 : 0.0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 165, this.ctx.currentTime, 0.08);
      this.engineFilter.frequency.setTargetAtTime(380 + speed01 * 1400, this.ctx.currentTime, 0.1);
    }
    if (this.sirenGain && this.sirenOsc) {
      if (wanted > 0) {
        this.sirenTimer += dt;
        const hi = Math.floor(this.sirenTimer * 2.2) % 2 === 0;
        this.sirenOsc.frequency.setTargetAtTime(hi ? 740 : 520, this.ctx.currentTime, 0.05);
        this.sirenGain.gain.setTargetAtTime(0.028 + wanted * 0.008, this.ctx.currentTime, 0.1);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      }
    }
    // Pad chord rotation every 6 seconds while driving or on foot at low volume.
    if (this.padGain && time > this.padNext) {
      this.padNext = time + 6;
      const chord = this.padChords[this.padIndex % this.padChords.length];
      this.padIndex++;
      for (const o of this.padOscs) { try { o.stop(); } catch (e) {} }
      this.padOscs = chord.map((f) => {
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.connect(this.padGain);
        o.start();
        return o;
      });
      this.padGain.gain.setTargetAtTime(0.018, this.ctx.currentTime, 1.5);
    }
  }

  blip(freq = 660, dur = 0.12, type = 'sine', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  thud(strength = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const dur = 0.18;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 300;
    const g = this.ctx.createGain();
    g.gain.value = clamp(0.25 * strength, 0.05, 0.4);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
    this.blip(70, 0.15, 'sine', 0.2 * strength);
  }

  honk() {
    if (!this.ctx || this.muted) return;
    this.blip(370, 0.28, 'square', 0.07);
    setTimeout(() => this.blip(370, 0.2, 'square', 0.06), 120);
  }

  pickup() { this.blip(880, 0.1); setTimeout(() => this.blip(1318, 0.16), 90); }

  missionJingle() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.14), i * 130));
  }

  failSting() {
    if (!this.ctx || this.muted) return;
    [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.08), i * 160));
  }

  punch() { this.thud(0.5); }
}
