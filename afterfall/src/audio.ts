// Procedural sound effects with WebAudio — no audio files to ship.

export class Sfx {
  ctx?: AudioContext;
  master?: GainNode;
  private noiseBuf?: AudioBuffer;
  private ambience?: GainNode;
  private sirenOsc?: OscillatorNode;
  private sirenGain?: GainNode;
  volume = 0.8;

  init() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m: boolean) {
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  private noise(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = "bandpass", when = 0, pan = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuf) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      src.connect(f).connect(g).connect(p).connect(this.master);
    } else src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = "sine", slideTo?: number, when = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  swing() { this.noise(0.18, 1800, 0.8, 0.35, "bandpass"); }
  hit(heavy = false) {
    this.noise(heavy ? 0.22 : 0.12, heavy ? 250 : 400, 1, heavy ? 1.2 : 0.8, "lowpass");
    this.tone(heavy ? 90 : 120, heavy ? 0.25 : 0.15, 0.4, "square", 40);
  }
  kill() { this.noise(0.35, 180, 0.8, 0.9, "lowpass"); this.tone(300, 0.3, 0.15, "triangle", 80); }
  sting() {
    this.tone(55, 2.2, 0.7, "sine", 40);
    this.noise(1.6, 120, 0.6, 0.7, "lowpass");
    this.tone(1760, 1.6, 0.06, "sine", 1700, 0.05);
    this.tone(2637, 1.4, 0.04, "sine", 2600, 0.12);
  }
  alarm() { for (let i = 0; i < 6; i++) this.tone(i % 2 ? 660 : 880, 0.18, 0.18, "square", undefined, i * 0.22); }
  whoosh() { this.noise(3.5, 500, 0.4, 0.9, "bandpass"); this.tone(220, 3.5, 0.25, "sawtooth", 60); }
  rumble() { this.noise(3, 60, 0.5, 1.0, "lowpass"); this.tone(32, 3, 0.6, "sine", 25); }
  ghost() { this.tone(523, 1.4, 0.12, "sine", 784); this.tone(659, 1.6, 0.1, "sine", 988, 0.1); this.noise(1.2, 3000, 2, 0.15, "bandpass"); }
  monitor() { this.tone(1040, 0.07, 0.04, "sine"); }
  coin() { this.tone(1320, 0.08, 0.12, "triangle", 1760); }

  /** Engine drone for the cabin scene. */
  private droneNodes?: { o: OscillatorNode; g: GainNode };
  drone(on: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (on && !this.droneNodes) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = 62;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 240;
      const g = ctx.createGain();
      g.gain.value = 0.12;
      o.connect(f).connect(g).connect(this.master);
      o.start();
      this.droneNodes = { o, g };
    } else if (!on && this.droneNodes) {
      const { o, g } = this.droneNodes;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      setTimeout(() => o.stop(), 800);
      this.droneNodes = undefined;
    }
  }
  hurt() { this.tone(220, 0.25, 0.35, "sawtooth", 90); this.noise(0.2, 600, 1, 0.5, "lowpass"); }
  pickup() { this.tone(880, 0.12, 0.25, "triangle", 1320); this.tone(1320, 0.18, 0.18, "sine", 1760, 0.07); }
  dash() { this.noise(0.25, 900, 0.5, 0.4, "highpass"); }
  heal() { this.tone(440, 0.4, 0.2, "sine", 880); }
  beep() { this.tone(1000, 0.08, 0.15, "square"); }
  door() { this.noise(0.6, 250, 2, 0.6, "lowpass"); this.tone(70, 0.5, 0.3, "sawtooth", 50); }
  slam() { this.noise(0.9, 120, 1, 1.2, "lowpass"); this.tone(55, 0.8, 0.8, "sine", 30); }
  charge() { this.tone(200, 0.6, 0.12, "sawtooth", 600); }
  roar() { this.tone(90, 1.4, 0.5, "sawtooth", 45); this.noise(1.2, 300, 0.7, 0.6, "lowpass"); }
  heartbeat(g = 0.7) { this.tone(60, 0.12, g, "sine", 40); this.tone(55, 0.14, g * 0.7, "sine", 35, 0.22); }
  crash() {
    this.noise(2.5, 200, 0.4, 1.5, "lowpass");
    this.noise(1.5, 2000, 0.3, 0.8, "bandpass", 0.1);
    this.tone(80, 2, 0.8, "sawtooth", 25);
  }

  /** Dying ambulance siren that winds down. */
  siren(on: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (on && !this.sirenOsc) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain).connect(o.frequency);
      o.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.value = 0.06;
      o.connect(g).connect(this.master);
      o.start();
      lfo.start();
      this.sirenOsc = o;
      this.sirenGain = g;
    } else if (!on && this.sirenOsc && this.sirenGain) {
      const t = ctx.currentTime;
      this.sirenOsc.frequency.cancelScheduledValues(t);
      this.sirenGain.gain.setTargetAtTime(0, t, 0.8);
      const o = this.sirenOsc;
      setTimeout(() => o.stop(), 4000);
      this.sirenOsc = undefined;
    }
  }

  /** Something breathing close by: slow filtered swells, in and out. */
  breath(n = 3) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuf) return;
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * 2.6;
      for (const [start, len, freq, peak] of [[0, 1.1, 520, 0.22], [1.25, 1.2, 380, 0.16]] as const) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = freq;
        f.Q.value = 0.9;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + start);
        g.gain.exponentialRampToValueAtTime(peak, t + start + len * 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, t + start + len);
        src.connect(f).connect(g).connect(this.master);
        src.start(t + start, Math.random());
        src.stop(t + start + len + 0.05);
      }
    }
  }
  /** A struck match catching, then the kindling going up. */
  ignite() {
    this.noise(0.12, 3200, 1, 0.5, "highpass");
    this.noise(1.6, 700, 0.5, 0.55, "bandpass", 0.1);
    this.tone(90, 1.2, 0.18, "sine", 140, 0.1);
  }
  /** Pen on paper. */
  scratch() { this.noise(0.09 + Math.random() * 0.06, 2400 + Math.random() * 1500, 2, 0.12, "bandpass"); }
  /** A native's call: a dry run of clicks, then a low warble. */
  click() {
    for (let i = 0; i < 7; i++) this.noise(0.02, 2600 + i * 120, 4, 0.35 - i * 0.03, "bandpass", i * 0.05);
    this.tone(180, 0.6, 0.12, "triangle", 120, 0.4);
  }
  /** A dry branch snapping somewhere out in the dark (quieter = further). */
  twig(gain = 0.5) {
    this.noise(0.05, 2200, 3, gain, "bandpass");
    this.noise(0.08, 900, 1.5, gain * 0.6, "bandpass", 0.03);
    this.tone(140, 0.09, gain * 0.25, "triangle", 70, 0.02);
  }
  /** Feet in leaf litter: n soft, uneven steps. */
  steps(n = 4, gain = 0.25) {
    let at = 0;
    for (let i = 0; i < n; i++) {
      at += 0.42 + Math.random() * 0.25;
      this.noise(0.14, 520 + Math.random() * 260, 0.9, gain * (0.7 + Math.random() * 0.4), "lowpass", at);
      this.noise(0.05, 2600, 2, gain * 0.25, "bandpass", at + 0.02);
    }
  }
  /** A person's voice, too far or too low to make out: a few formant-ish syllables. */
  murmur(gain = 0.16) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const n = 2 + Math.floor(Math.random() * 3);
    let at = 0;
    const base = 105 + Math.random() * 60;
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + at;
      const len = 0.16 + Math.random() * 0.22;
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.25), t);
      o.frequency.linearRampToValueAtTime(base * (0.8 + Math.random() * 0.3), t + len);
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 500 + Math.random() * 500;
      f.Q.value = 4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(f).connect(g).connect(this.master);
      o.start(t);
      o.stop(t + len + 0.05);
      at += len + 0.05 + Math.random() * 0.15;
    }
  }
  /** A sharp intake of breath: the tell before a Hollow swings. */
  rasp() {
    this.noise(0.32, 1500, 1.2, 0.3, "bandpass");
    this.noise(0.25, 420, 1, 0.18, "lowpass", 0.05);
  }
  /** Something rummaged through: zips, clatter, cloth. */
  rummage() {
    for (let i = 0; i < 4; i++) this.noise(0.06 + Math.random() * 0.06, 1200 + Math.random() * 2400, 1.4, 0.25, "bandpass", i * 0.07 + Math.random() * 0.04);
  }
  /** The tin-can line rattling. */
  cans() {
    for (let i = 0; i < 9; i++) this.tone(1900 + Math.random() * 1400, 0.07, 0.07, "triangle", 1500 + Math.random() * 600, i * 0.045 + Math.random() * 0.03);
  }
  /** Radio static: a burst of hiss. */
  staticBurst(dur = 0.5, gain = 0.22) {
    this.noise(dur, 3200, 0.4, gain, "bandpass");
    this.noise(dur * 0.7, 900, 0.6, gain * 0.5, "highpass", 0.03);
  }
  /** Distant thunder. */
  thunder(near = 0.5) {
    this.noise(2.4 + near, 90 + near * 80, 0.6, 0.45 + near * 0.6, "lowpass");
    this.noise(0.4, 600, 0.5, near * 0.5, "lowpass");
    this.tone(38, 2.2, 0.35 * near + 0.1, "sine", 28);
  }
  /** Rain on the canopy and the ground, faded in and out. */
  rain(level: number, secs = 3) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuf) return;
    if (!this.rainGain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 2400;
      f.Q.value = 0.35;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      this.rainGain = g;
    }
    const g = this.rainGain;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
    g.gain.linearRampToValueAtTime(level, ctx.currentTime + secs);
  }
  private rainGain?: GainNode;
  private bed?: GainNode;
  private leaves?: GainNode;
  private dread?: GainNode;
  private tension = 0;
  private gustT = 0;
  private bugT = 0;
  private callT = 20;
  private creakT = 8;
  private silenceT = 0;
  private silenceCd = 0;
  private pulseT = 0;

  /** The world breathing, every frame. tension 0..1 (how close something is);
   *  pan -1..1 (where it is); crash: metres from the wreck; out: outdoors. */
  atmosphere(dt: number, o: { tension: number; pan: number; crash: number; out: boolean; night: boolean }) {
    const ctx = this.ctx;
    if (!ctx || !this.bed || !this.leaves || !this.dread) return;
    const was = this.tension;
    this.tension += (o.tension - this.tension) * Math.min(1, dt * (o.tension > this.tension ? 1.2 : 0.4));
    const T = this.tension;
    const now = ctx.currentTime;
    // the forest goes quiet when something's close; and once, it stops altogether
    this.silenceCd -= dt;
    if (was < 0.7 && T >= 0.7 && this.silenceCd <= 0) {
      this.silenceT = 2.2 + Math.random() * 1.2;
      this.silenceCd = 40;
    }
    this.silenceT = Math.max(0, this.silenceT - dt);
    const bed = this.silenceT > 0 ? 0.05 : 1 - T * 0.65;
    this.bed.gain.setTargetAtTime(o.out ? bed : 0.4, now, this.silenceT > 0 ? 0.08 : 0.6);
    this.dread.gain.setTargetAtTime(this.silenceT > 0 ? 0 : Math.max(0, T - 0.3) * 0.09, now, 0.8);
    // gusts through the leaves
    this.gustT -= dt;
    if (this.gustT <= 0) {
      this.gustT = 3 + Math.random() * 6;
      this.leaves.gain.setTargetAtTime(0.008 + Math.random() * 0.04, now, 1.5);
    }
    if (!o.out || this.silenceT > 0) return;
    // insects, only when nothing's near
    this.bugT -= dt;
    if (this.bugT <= 0 && o.night) {
      this.bugT = 0.7 + Math.random() * 0.9;
      if (T < 0.35) {
        const f = 4300 + Math.random() * 900;
        const pan = (Math.random() - 0.5) * 1.4;
        for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) this.noise(0.025, f, 18, 0.05 * (1 - T * 2.5), "bandpass", i * 0.055, pan);
      }
    }
    // something far off: an owl, a bird that isn't quite a bird
    this.callT -= dt;
    if (this.callT <= 0) {
      this.callT = 25 + Math.random() * 40;
      if (T < 0.5) {
        this.tone(340, 0.35, 0.025, "sine", 300);
        this.tone(330, 0.5, 0.022, "sine", 290, 0.55);
      }
    }
    // the wreck, still settling
    this.creakT -= dt;
    if (this.creakT <= 0) {
      this.creakT = 9 + Math.random() * 16;
      if (o.crash < 45) {
        const k = 1 - o.crash / 45;
        if (Math.random() < 0.5) this.tone(72, 1.3, 0.05 * k, "sawtooth", 56);
        else for (let i = 0; i < 2; i++) this.tone(2200 + Math.random() * 600, 0.03, 0.04 * k, "triangle", undefined, i * 0.4);
      }
    }
    // close: its movement, from where it is
    this.pulseT -= dt;
    if (T > 0.55 && this.pulseT <= 0) {
      this.pulseT = 1.6 + Math.random() * 2.5;
      if (Math.random() < 0.6) this.noise(0.12, 520, 0.9, 0.05 + T * 0.08, "lowpass", 0, o.pan);
      else this.noise(0.05, 2200, 3, 0.04 + T * 0.06, "bandpass", 0, o.pan);
    }
  }
  /** One pop of burning wood; call at random intervals near a fire. */
  crackle(gain = 0.2) {
    this.noise(0.03 + Math.random() * 0.04, 1800 + Math.random() * 2400, 1.2, gain, "bandpass");
  }
  /** Fade the wind bed; near-silence is a tool, not a bug. */
  ambienceTo(level: number, secs = 2) {
    const ctx = this.ctx;
    if (!ctx || !this.ambience) return;
    this.ambience.gain.cancelScheduledValues(ctx.currentTime);
    this.ambience.gain.setValueAtTime(this.ambience.gain.value, ctx.currentTime);
    this.ambience.gain.linearRampToValueAtTime(level, ctx.currentTime + secs);
  }

  /** Alien wind bed. */
  startAmbience() {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuf || this.ambience) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 380;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 200;
    lfo.connect(lg).connect(f.frequency);
    const g = ctx.createGain();
    g.gain.value = 0.18;
    this.bed = ctx.createGain();
    this.bed.connect(this.master);
    src.connect(f).connect(g).connect(this.bed);
    src.start();
    lfo.start();
    // trees: a rustle under the wind, in gusts
    const leaves = ctx.createBufferSource();
    leaves.buffer = this.noiseBuf;
    leaves.loop = true;
    const lf = ctx.createBiquadFilter();
    lf.type = "bandpass";
    lf.frequency.value = 1700;
    lf.Q.value = 0.5;
    this.leaves = ctx.createGain();
    this.leaves.gain.value = 0.02;
    leaves.connect(lf).connect(this.leaves).connect(this.bed);
    leaves.start(0, 0.7);
    // under everything when it's close: a low pressure, felt more than heard
    const sub = ctx.createOscillator();
    sub.frequency.value = 41;
    const sub2 = ctx.createOscillator();
    sub2.frequency.value = 61.3;
    this.dread = ctx.createGain();
    this.dread.gain.value = 0;
    sub.connect(this.dread);
    sub2.connect(this.dread);
    this.dread.connect(this.master);
    sub.start();
    sub2.start();
    // Low drone
    const drone = ctx.createOscillator();
    drone.frequency.value = 43.65;
    const dg = ctx.createGain();
    dg.gain.value = 0.05;
    drone.connect(dg).connect(this.master);
    drone.start();
    this.ambience = g;
  }
}
