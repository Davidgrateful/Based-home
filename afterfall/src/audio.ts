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

  private noise(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = "bandpass", when = 0) {
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
    src.connect(f).connect(g).connect(this.master);
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
  hit() { this.noise(0.12, 400, 1, 0.8, "lowpass"); this.tone(120, 0.15, 0.4, "square", 50); }
  hurt() { this.tone(220, 0.25, 0.35, "sawtooth", 90); this.noise(0.2, 600, 1, 0.5, "lowpass"); }
  pickup() { this.tone(880, 0.12, 0.25, "triangle", 1320); this.tone(1320, 0.18, 0.18, "sine", 1760, 0.07); }
  dash() { this.noise(0.25, 900, 0.5, 0.4, "highpass"); }
  heal() { this.tone(440, 0.4, 0.2, "sine", 880); }
  beep() { this.tone(1000, 0.08, 0.15, "square"); }
  door() { this.noise(0.6, 250, 2, 0.6, "lowpass"); this.tone(70, 0.5, 0.3, "sawtooth", 50); }
  slam() { this.noise(0.9, 120, 1, 1.2, "lowpass"); this.tone(55, 0.8, 0.8, "sine", 30); }
  charge() { this.tone(200, 0.6, 0.12, "sawtooth", 600); }
  roar() { this.tone(90, 1.4, 0.5, "sawtooth", 45); this.noise(1.2, 300, 0.7, 0.6, "lowpass"); }
  heartbeat() { this.tone(60, 0.12, 0.7, "sine", 40); this.tone(55, 0.14, 0.5, "sine", 35, 0.22); }
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
    src.connect(f).connect(g).connect(this.master);
    src.start();
    lfo.start();
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
