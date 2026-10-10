'use strict';
/* audio.js
   All sound is made in the browser with the Web Audio API. No audio files needed.
   Note: on the Moon there is no air, so there is no wind outside. You only hear your suit. */

const Sfx = {
  ctx: null, master: null, musicGain: null, noise: null,
  on: true, musicOn: true, eva: false,
  wind: null, hum: null, breath: null,

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain();
    this.master.gain.value = this.on ? 0.9 : 0;
    this.master.connect(c.destination);
    this.musicGain = c.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.5 : 0;
    this.musicGain.connect(this.master);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.makeAmbience();
    this.makeMusic();
  },

  noiseSrc() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    return s;
  },

  makeAmbience() {
    const c = this.ctx;
    // wind (Mars only, controlled by scene())
    this.wind = c.createGain(); this.wind.gain.value = 0;
    const ws = this.noiseSrc(), wf = c.createBiquadFilter();
    wf.type = 'bandpass'; wf.frequency.value = 520; wf.Q.value = 0.7;
    ws.connect(wf); wf.connect(this.wind); this.wind.connect(this.master); ws.start();
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 0.12; lg.gain.value = 180;
    lfo.connect(lg); lg.connect(wf.frequency); lfo.start();
    // habitat hum (life support machinery)
    this.hum = c.createGain(); this.hum.gain.value = 0;
    [[55, 'triangle', 0.5], [110.5, 'sine', 0.25], [165, 'sine', 0.1]].forEach(([f, type, v]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f; g.gain.value = v;
      o.connect(g); g.connect(this.hum); o.start();
    });
    this.hum.connect(this.master);
    // suit breathing (shaped by an interval below)
    this.breath = c.createGain(); this.breath.gain.value = 0.0001;
    const bs = this.noiseSrc(), bf = c.createBiquadFilter();
    bf.type = 'bandpass'; bf.frequency.value = 800; bf.Q.value = 0.9;
    bs.connect(bf); bf.connect(this.breath); this.breath.connect(this.master); bs.start();
    setInterval(() => {
      if (!this.eva || !this.ctx) return;
      const t = c.currentTime, g = this.breath.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0.0001, t);
      g.linearRampToValueAtTime(0.1, t + 0.9);
      g.linearRampToValueAtTime(0.0001, t + 1.5);
      g.linearRampToValueAtTime(0.07, t + 2.0);
      g.linearRampToValueAtTime(0.0001, t + 2.7);
    }, 3000);
  },

  makeMusic() {
    const c = this.ctx;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 800; f.connect(this.musicGain);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = 250;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    const pad = [0, 1, 2].map(() => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth'; o.detune.value = (Math.random() - 0.5) * 12; g.gain.value = 0.05;
      o.connect(g); g.connect(f); o.start();
      return o;
    });
    const chords = [[110, 164.8, 220], [98, 146.8, 196], [87.3, 130.8, 174.6], [98, 146.8, 185]];
    let i = 0;
    const step = () => {
      const t = c.currentTime;
      pad.forEach((o, k) => o.frequency.setTargetAtTime(chords[i][k], t, 1.6));
      i = (i + 1) % chords.length;
    };
    // soft twinkling notes, like faraway stars
    const bells = [392, 440, 523, 587, 659, 784];
    setInterval(() => { if (this.musicOn && this.on) this.tone(bells[Math.floor(Math.random() * bells.length)], 2.4, 'sine', 0.025, 0, 0); }, 5200);
    step(); setInterval(step, 9000);
  },

  setSound(v) { this.on = v; if (this.ctx) this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.05); },
  setMusic(v) { this.musicOn = v; if (this.ctx) this.musicGain.gain.setTargetAtTime(v ? 0.5 : 0, this.ctx.currentTime, 0.2); },

  /* Set the background sound for where the player is. */
  scene(zone, storm, world, powered) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, mars = world === 'mars', out = zone === 'out';
    this.eva = out;
    let w = 0;
    if (mars) w = out ? (storm ? 0.16 : 0.05) : (storm ? 0.03 : 0.006);
    this.wind.gain.setTargetAtTime(w, t, 0.4);
    this.hum.gain.setTargetAtTime(powered ? (out ? 0.012 : 0.05) : 0.004, t, 0.4);
  },

  tone(freq, dur, type, vol, when, slide) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol == null ? 0.12 : vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  burst(dur, freq, q, vol, type, when, fade) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + (when || 0);
    const s = this.noiseSrc(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (fade ? dur * 0.3 : 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  },

  click() { this.tone(900, 0.05, 'square', 0.05); },
  step(zone) {
    if (zone === 'out') this.burst(0.1, 420, 0.8, 0.22);
    else { this.burst(0.06, 1500, 2, 0.12); this.tone(170, 0.05, 'square', 0.03); }
  },
  hiss() { this.burst(1.4, 5000, 0.5, 0.2, 'highpass', 0, true); this.tone(120, 0.3, 'square', 0.04, 1.2); },
  work(dur) {
    const n = Math.max(2, Math.round(dur / 0.22));
    for (let i = 0; i < n; i++) {
      this.tone(300 + Math.random() * 220, 0.06, 'square', 0.05, i * 0.22);
      this.burst(0.05, 2200, 3, 0.1, 'bandpass', i * 0.22 + 0.05);
    }
  },
  done() { this.tone(520, 0.1, 'triangle', 0.1); this.tone(780, 0.16, 'triangle', 0.1, 0.09); },
  good() { [660, 830, 990].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.12, i * 0.09)); },
  error() { this.tone(150, 0.28, 'sawtooth', 0.12, 0, -60); },
  warn() { this.tone(520, 0.12, 'square', 0.06); this.tone(390, 0.16, 'square', 0.06, 0.14); },
  alarm() { for (let i = 0; i < 4; i++) { this.tone(880, 0.14, 'square', 0.07, i * 0.3); this.tone(660, 0.14, 'square', 0.07, i * 0.3 + 0.15); } },
  sleep() { this.tone(330, 1.2, 'sine', 0.1, 0, -200); this.tone(247, 1.4, 'sine', 0.08, 0.2, -120); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.13, i * 0.16)); },
  lose() { [330, 262, 196, 147].forEach((f, i) => this.tone(f, 0.6, 'sawtooth', 0.09, i * 0.25)); }
};
