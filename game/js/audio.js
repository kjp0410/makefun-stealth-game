/* audio.js — every sound is synthesized live with WebAudio.
 * No audio files, no network: a soft pad underneath, footstep ticks,
 * a coin clink, an alert sting when the eye fills, a low thud when
 * caught, and a small chime when a level clears.
 */
const AudioSys = {
  ctx: null,
  muted: false,
  padNodes: null,

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.startPad();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.ctx.suspend();
    if (!m && this.ctx) this.ctx.resume();
  },

  /* Two detuned triangle oscillators through a low-pass filter, quiet
   * enough to sit under everything else. */
  startPad() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const o1 = ctx.createOscillator();
    o1.type = "triangle"; o1.frequency.value = 110;
    const o2 = ctx.createOscillator();
    o2.type = "triangle"; o2.frequency.value = 164.8;
    const o3 = ctx.createOscillator();
    o3.type = "sine"; o3.frequency.value = 55;
    o1.connect(filter); o2.connect(filter); o3.connect(filter);
    filter.connect(gain); gain.connect(ctx.destination);
    o1.start(); o2.start(); o3.start();
    this.padNodes = { gain, filter };
  },

  /* Raise the pad's filter when the eye opens: the room feels tenser. */
  setTension(meter) {
    if (!this.padNodes) return;
    const f = 420 + meter * 9;
    this.padNodes.filter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.2);
  },

  blip(freq, dur, type, vol, when) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + (when || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },

  /* A footstep: a short filtered noise tick, pitch by surface. */
  step(sneaking) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 0.05;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = sneaking ? 300 : 700;
    const g = ctx.createGain();
    g.gain.value = sneaking ? 0.03 : 0.07;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t);
  },

  coin() {
    this.blip(2093, 0.09, "sine", 0.14);
    this.blip(2637, 0.14, "sine", 0.1, 0.06);
  },

  coinLand() {
    this.blip(1318, 0.08, "triangle", 0.1);
  },

  /* Two rising notes: a guard just noticed you. */
  suspicious() {
    this.blip(392, 0.12, "square", 0.06);
    this.blip(523, 0.16, "square", 0.06, 0.1);
  },

  /* A harsh sting: the eye is full, you are caught. */
  caught() {
    this.blip(220, 0.5, "sawtooth", 0.16);
    this.blip(110, 0.7, "sawtooth", 0.14, 0.08);
  },

  pickup() {
    this.blip(880, 0.1, "sine", 0.12);
    this.blip(1174, 0.16, "sine", 0.12, 0.08);
  },

  levelClear() {
    [523, 659, 784, 1046].forEach((f, i) => this.blip(f, 0.22, "triangle", 0.12, i * 0.11));
  },

  exitOpen() {
    this.blip(1568, 0.3, "sine", 0.1);
    this.blip(2093, 0.4, "sine", 0.08, 0.12);
  },
};
