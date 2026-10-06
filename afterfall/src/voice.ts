// Character voices. Every scripted line is pre-recorded (tools/voice: a local
// neural TTS pass, treated per character: radio, tape, the Choir...) and
// shipped as a few packs under public/voice, fetched in story order. If a
// line has no recording, or its pack isn't in yet, the browser's own speech
// stands in, with a per-speaker voice, pitch and rate. Subtitles type on for
// every line, and a timer keeps the story moving when nothing can be heard.

import type { Line } from "./script";

export type SpeakerId = "RHEA" | "YOU" | "PILOT" | "DEZ" | "HOLLOW" | "WARDEN" | "CHOIR" | "ECHO" | "INES" | "TEO";

interface Speaker {
  name: string;
  color: string;
  pitch: number;
  rate: number;
  prefer: string[];
  radio?: boolean;
  ghost?: boolean;
}

const FEMALE = ["samantha", "zira", "female", "victoria", "karen", "moira", "tessa", "fiona", "aria", "jenny", "libby", "sonia"];
const MALE = ["daniel", "alex", "guy", "male", "david", "mark", "fred", "ryan", "thomas"];

const SPEAKERS: Record<SpeakerId, Speaker> = {
  RHEA: { name: "Rhea", color: "#8fc7bd", pitch: 1.12, rate: 1.03, prefer: FEMALE, radio: true },
  YOU: { name: "You", color: "#e2c48a", pitch: 0.95, rate: 0.98, prefer: MALE },
  PILOT: { name: "Okafor", color: "#a8b3d0", pitch: 0.82, rate: 1.05, prefer: ["fred", ...MALE], radio: true },
  DEZ: { name: "Dez", color: "#c7b98f", pitch: 1.08, rate: 1.16, prefer: ["alex", "ryan", "guy", ...MALE] },
  HOLLOW: { name: "Hollow", color: "#d4887a", pitch: 0.45, rate: 0.82, prefer: MALE },
  WARDEN: { name: "The Warden", color: "#cf5f56", pitch: 0.1, rate: 0.74, prefer: MALE },
  CHOIR: { name: "The Choir", color: "#e6f1f3", pitch: 1.7, rate: 0.68, prefer: ["whisper", ...FEMALE], ghost: true },
  ECHO: { name: "Echo", color: "#a9d6de", pitch: 1.0, rate: 0.9, prefer: [...FEMALE, ...MALE], ghost: true },
  // the Changed: patients who stayed long enough to be rewritten
  INES: { name: "Ines", color: "#7fd3e0", pitch: 0.92, rate: 1.06, prefer: ["moira", "tessa", "fiona", ...FEMALE] },
  TEO: { name: "Teo", color: "#c9b48e", pitch: 0.62, rate: 0.86, prefer: ["fred", "thomas", ...MALE] },
};

/** [pack, byte offset, byte length, milliseconds] */
type Clip = [string, number, number, number];
/** Packs in the order the game needs them. */
const PACK_ORDER = ["intro", "common", "story", "night", "echo", "late"];

/** The recorded performances: a manifest, and packs fetched on demand. */
class VoiceBank {
  manifest: Record<string, Clip> | null = null;
  private packs = new Map<string, Promise<ArrayBuffer | null>>();

  async load() {
    try {
      const r = await fetch("./voice/manifest.json");
      if (!r.ok) return;
      this.manifest = await r.json();
      // fetch every pack, one after another, the opening first
      for (const p of PACK_ORDER) await this.pack(p);
    } catch {
      this.manifest = null;
    }
  }

  pack(name: string) {
    let p = this.packs.get(name);
    if (!p) {
      p = fetch(`./voice/${name}.bin`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
      this.packs.set(name, p);
    }
    return p;
  }

  clip(key: string) {
    return this.manifest?.[key] ?? null;
  }

  /** Decoded audio for a clip, or null if it can't be had within `wait` ms. */
  async audio(ctx: AudioContext, c: Clip, wait: number): Promise<AudioBuffer | null> {
    const pack = await Promise.race([this.pack(c[0]), new Promise<null>((r) => setTimeout(() => r(null), wait))]);
    if (!pack) return null;
    try {
      return await ctx.decodeAudioData(pack.slice(c[1], c[1] + c[2]));
    } catch {
      return null;
    }
  }
}

export class Voice {
  /** Recorded lines (falls back to browser speech line by line). */
  bank = new VoiceBank();
  /** The game's AudioContext (created on the first tap; see audio.ts). */
  audioCtx: () => AudioContext | undefined = () => undefined;
  /** Your lines in the second recorded voice ("Lighter" in the creator). */
  altVoice = false;
  private playing: AudioBufferSourceNode | null = null;
  private out: GainNode | null = null;
  muted = false;
  /** Substituted for {name} in every line and used as YOUR speaker label. */
  playerName = "Sleeper";
  private voices: SpeechSynthesisVoice[] = [];
  private box: HTMLElement;
  private who: HTMLElement;
  private text: HTMLElement;
  private token = 0;
  private active = 0;
  private typer = 0;
  private queue: Promise<void> = Promise.resolve();
  onLine?: (speaker: SpeakerId, radio: boolean) => void;

  get busy() {
    return this.active > 0;
  }

  constructor() {
    void this.bank.load();
    this.box = document.getElementById("subtitle")!;
    this.who = document.getElementById("sub-who")!;
    this.text = document.getElementById("sub-text")!;
    if ("speechSynthesis" in window) {
      const load = () => (this.voices = speechSynthesis.getVoices());
      load();
      speechSynthesis.addEventListener?.("voiceschanged", load);
    }
  }

  private pick(s: Speaker): SpeechSynthesisVoice | undefined {
    const en = this.voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
    const pool = en.length ? en : this.voices;
    for (const p of s.prefer) {
      const v = pool.find((v) => v.name.toLowerCase().includes(p));
      if (v) return v;
    }
    return pool[0];
  }

  /** Queue lines; resolves when they have all been spoken (or interrupted). */
  say(lines: Line[]): Promise<void> {
    const t = this.token;
    this.queue = this.queue.then(async () => {
      for (const line of lines) {
        if (t !== this.token) return;
        await this.speakOne(line, t);
      }
    });
    return this.queue;
  }

  private unlocked = false;
  /** iOS only allows speech after a tap: speak a silent blank inside one. */
  unlock() {
    if (this.unlocked || !("speechSynthesis" in window)) return;
    this.unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch {}
  }

  /** Drop everything queued or speaking (used on respawn, skip, restart). */
  interrupt() {
    this.token++;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    try {
      this.playing?.stop();
    } catch {}
    this.playing = null;
    this.box.classList.remove("show");
    clearInterval(this.typer);
    this.active = 0;
    this.queue = Promise.resolve();
  }

  private speakOne([id, raw, opts]: Line, t: number): Promise<void> {
    const s = SPEAKERS[id];
    const line = raw.replace(/\{name\}/g, this.playerName);
    const pitch = opts?.pitch ?? s.pitch;
    const rate = opts?.rate ?? s.rate;
    this.who.textContent = (opts?.name ?? (id === "YOU" ? this.playerName : s.name)).replace(/\{name\}/g, this.playerName);
    this.who.style.color = s.color;
    this.box.classList.toggle("radio", opts?.radio ?? !!s.radio);
    this.box.classList.toggle("ghost", !!s.ghost);
    this.box.classList.add("show");
    this.onLine?.(id, opts?.radio ?? !!s.radio);
    this.active++;

    // typewriter subtitle
    clearInterval(this.typer);
    let n = 0;
    this.text.textContent = "";
    this.typer = window.setInterval(() => {
      n += 2;
      this.text.textContent = line.slice(0, n);
      if (n >= line.length) clearInterval(this.typer);
    }, 22);

    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.active = Math.max(0, this.active - 1);
        setTimeout(() => {
          if (t === this.token && this.active === 0) this.box.classList.remove("show");
          resolve();
        }, 280);
      };
      const radio = opts?.radio ?? !!s.radio;
      const key = `${id}|${radio ? 1 : 0}|${raw}`;
      const clip = (id === "YOU" && this.altVoice ? this.bank.clip(key + "#b") : null) ?? this.bank.clip(key);
      const ctx = this.audioCtx();
      if (clip && (this.muted || !ctx)) {
        // no sound, but the recording knows how long the line really is
        setTimeout(finish, clip[3] + 250);
        return;
      }
      if (clip && ctx) {
        this.bank.audio(ctx, clip, 2500).then((buf) => {
          if (done || t !== this.token) return finish();
          if (!buf) return this.speakTts(line, s, pitch, rate, finish);
          if (!this.out) {
            this.out = ctx.createGain();
            this.out.gain.value = 1;
            this.out.connect(ctx.destination);
          }
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(this.out);
          src.onended = () => {
            if (this.playing === src) this.playing = null;
            finish();
          };
          this.playing = src;
          src.start();
          setTimeout(finish, buf.duration * 1000 + 1500); // in case onended never comes
        });
        return;
      }
      this.speakTts(line, s, pitch, rate, finish);
    });
  }

  /** Browser speech, for lines without a recording. */
  private speakTts(line: string, s: Speaker, pitch: number, rate: number, finish: () => void) {
    {
      // Reading-speed fallback; also caps engines whose onend never fires.
      const ms = Math.max(1600, line.length * 60) / rate;
      const canSpeak = !this.muted && "speechSynthesis" in window && this.voices.length > 0;
      if (!canSpeak) {
        setTimeout(finish, ms);
        return;
      }
      const u = new SpeechSynthesisUtterance(line);
      const v = this.pick(s);
      if (v) u.voice = v;
      u.pitch = pitch;
      u.rate = rate;
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
      setTimeout(finish, ms * 2.2 + 1500);
    }
  }

  /** Play one of your lines in the chosen voice (the creator's preview). */
  preview(alt: boolean) {
    this.altVoice = alt;
    this.interrupt();
    void this.say([["YOU", "I'm here. I think. Where's here?"]]);
  }
}
