// Character voices via the browser's built-in Web Speech API (no keys, no
// server). Each speaker gets a preferred voice plus a pitch/rate so they sound
// distinct even on systems with a single installed voice. Subtitles are shown
// for every line, and a timer fallback keeps the story moving when speech is
// unavailable or muted.

export type SpeakerId = "RHEA" | "YOU" | "PILOT" | "HOLLOW" | "WARDEN" | "UNKNOWN";

interface Speaker {
  name: string;
  color: string;
  pitch: number;
  rate: number;
  prefer: string[];
  radio?: boolean;
}

const SPEAKERS: Record<SpeakerId, Speaker> = {
  RHEA: {
    name: "RHEA · Flight Medic",
    color: "#7fe3d4",
    pitch: 1.15,
    rate: 1.02,
    prefer: ["samantha", "zira", "female", "victoria", "karen", "moira", "tessa", "fiona", "aria", "jenny"],
    radio: true,
  },
  YOU: {
    name: "YOU · Patient 100",
    color: "#ffd27a",
    pitch: 0.95,
    rate: 0.98,
    prefer: ["daniel", "alex", "guy", "male", "david", "mark", "fred"],
  },
  PILOT: {
    name: "PILOT · Medevac 100",
    color: "#a9b8ff",
    pitch: 0.85,
    rate: 1.18,
    prefer: ["fred", "male", "david", "mark", "daniel"],
    radio: true,
  },
  HOLLOW: {
    name: "THE HOLLOW",
    color: "#ff7b6b",
    pitch: 0.45,
    rate: 0.82,
    prefer: ["male", "david", "mark", "fred", "daniel"],
  },
  WARDEN: {
    name: "THE WARDEN",
    color: "#ff3d5a",
    pitch: 0.1,
    rate: 0.72,
    prefer: ["male", "david", "mark", "fred", "daniel"],
  },
  UNKNOWN: {
    name: "???",
    color: "#d59bff",
    pitch: 1.6,
    rate: 0.7,
    prefer: ["whisper", "female", "samantha", "zira"],
  },
};

export class Voice {
  muted = false;
  private voices: SpeechSynthesisVoice[] = [];
  private box: HTMLElement;
  private who: HTMLElement;
  private text: HTMLElement;
  private token = 0;
  private active = 0;
  get busy() {
    return this.active > 0;
  }
  private queue: Promise<void> = Promise.resolve();
  onLine?: (speaker: SpeakerId) => void;

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

  /** Queue lines; resolves when they have all been spoken (or skipped). */
  say(lines: [SpeakerId, string][]): Promise<void> {
    const t = this.token;
    this.queue = this.queue.then(async () => {
      for (const [id, line] of lines) {
        if (t !== this.token) return;
        await this.speakOne(id, line, t);
      }
    });
    return this.queue;
  }

  /** Drop everything queued or speaking (used on respawn / restart). */
  interrupt() {
    this.token++;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    this.hide();
    this.active = 0;
    this.queue = Promise.resolve();
  }

  private hide() {
    this.box.classList.remove("show");
  }

  private speakOne(id: SpeakerId, line: string, t: number): Promise<void> {
    const s = SPEAKERS[id];
    this.who.textContent = s.name;
    this.who.style.color = s.color;
    this.text.textContent = line;
    this.box.classList.toggle("radio", !!s.radio);
    this.box.classList.add("show");
    this.onLine?.(id);
    this.active++;

    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.active = Math.max(0, this.active - 1);
        setTimeout(() => {
          if (t === this.token) this.hide();
          resolve();
        }, 350);
      };
      // Reading-speed fallback; also caps engines whose onend never fires.
      const ms = Math.max(1800, line.length * 62) / s.rate;
      const canSpeak = !this.muted && "speechSynthesis" in window;
      if (!canSpeak) {
        setTimeout(finish, ms);
        return;
      }
      const u = new SpeechSynthesisUtterance(line);
      const v = this.pick(s);
      if (v) u.voice = v;
      u.pitch = s.pitch;
      u.rate = s.rate;
      u.volume = 1;
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
      setTimeout(finish, ms * 2.2 + 1500);
    });
  }
}
