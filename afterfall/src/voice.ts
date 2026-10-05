// Character voices via the browser's built-in Web Speech API (no keys, no
// server). Each speaker gets a preferred voice plus a pitch/rate so they sound
// distinct even on systems with a single installed voice. Subtitles type on
// for every line, and a timer fallback keeps the story moving when speech is
// unavailable or muted.

import type { Line } from "./script";

export type SpeakerId = "RHEA" | "YOU" | "PILOT" | "DEZ" | "HOLLOW" | "WARDEN" | "CHOIR" | "ECHO";

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
  CHOIR: { name: "The Choir", color: "#b8a6d6", pitch: 1.7, rate: 0.68, prefer: ["whisper", ...FEMALE], ghost: true },
  ECHO: { name: "Echo", color: "#aaa3c2", pitch: 1.0, rate: 0.9, prefer: [...FEMALE, ...MALE], ghost: true },
};

export class Voice {
  muted = false;
  /** Substituted for {name} in every line and used as YOUR speaker label. */
  playerName = "Hundred";
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
    });
  }
}
