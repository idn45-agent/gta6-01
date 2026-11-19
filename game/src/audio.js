// audio.js — synthesized WebAudio sound: no audio files. One clear job: engine hum,
// police sirens, pickup blips and punches, all generated from oscillators.
export function createAudio() {
  const audio = { ctx: null, muted: false, engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null, sirenTimer: 0 };
  function ensure() {
    if (audio.ctx) return audio.ctx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 50;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 400;
      audio.engineOsc.connect(filter); filter.connect(audio.engineGain); audio.engineGain.connect(audio.ctx.destination);
      audio.engineOsc.start();
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'sine';
      audio.sirenOsc.frequency.value = 700;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain); audio.sirenGain.connect(audio.ctx.destination);
      audio.sirenOsc.start();
    } catch { audio.ctx = null; }
    return audio.ctx;
  }
  // Short blip: a sine that slides from f0 to f1 over `dur` seconds.
  function blip(f0, f1, dur, vol) {
    if (!ensure() || audio.muted) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator(), gain = audio.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(audio.ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  return {
    unlock() { ensure(); if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); },
    toggleMute() { audio.muted = !audio.muted; if (audio.engineGain) audio.engineGain.gain.value = 0; if (audio.sirenGain) audio.sirenGain.gain.value = 0; return audio.muted; },
    isMuted() { return audio.muted; },
    pickup() { blip(660, 990, 0.12, 0.15); },
    cash() { blip(880, 1320, 0.18, 0.18); setTimeout(() => blip(1320, 1760, 0.15, 0.15), 90); },
    punch() { blip(180, 60, 0.12, 0.3); },
    crash() { blip(120, 40, 0.3, 0.35); },
    sirenOn() { /* siren level is driven per-frame by update() */ },
    // Called every frame: engine pitch follows speed, siren wails while wanted.
    update(dt, speed, wanted) {
      if (!audio.ctx || audio.muted) return;
      audio.engineGain.gain.value = speed > 0.5 ? 0.05 + Math.min(0.06, speed * 0.002) : 0;
      audio.engineOsc.frequency.value = 45 + speed * 4;
      audio.sirenTimer += dt;
      if (wanted > 0) {
        const phase = Math.floor(audio.sirenTimer * 2.2) % 2;
        audio.sirenOsc.frequency.value = phase === 0 ? 720 : 960;
        audio.sirenGain.gain.value = 0.035;
      } else {
        audio.sirenGain.gain.value = 0;
      }
    },
  };
}
