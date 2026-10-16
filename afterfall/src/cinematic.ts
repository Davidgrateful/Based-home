// In-engine cinematics: letterboxed camera shots, skippable as a whole.
// Sequence code awaits `shot`, `wait` and `say`; once skipped, all of them
// resolve immediately so the sequence falls through to its end state.

import * as THREE from "three";
import type { Line } from "./script";
import type { Voice } from "./voice";

export interface CamKey {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

interface Shot {
  from: CamKey;
  to: CamKey;
  dur: number;
  t: number;
  track?: () => THREE.Vector3;
  ease: (k: number) => number;
  done: () => void;
}

const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

export class Cine {
  active = false;
  skipped = false;
  shake = 0;
  /** Per-frame animation hook for things like the falling plane. */
  onTick?: (dt: number) => void;
  private shotNow: Shot | null = null;
  private skipP: Promise<void> = Promise.resolve();
  private skipR: () => void = () => {};
  private voice: Voice;
  private look = new THREE.Vector3();

  constructor(voice: Voice) {
    this.voice = voice;
    const skipBtn = document.getElementById("skip");
    skipBtn?.addEventListener("click", () => this.skip());
    addEventListener("keydown", (e) => {
      if (this.active && (e.code === "Enter" || e.code === "Escape" || e.code === "Space")) this.skip();
    });
  }

  begin(skippable = true) {
    this.active = true;
    this.skipped = false;
    this.skipP = new Promise((r) => (this.skipR = r));
    document.body.classList.add("cine");
    document.getElementById("skip")?.classList.toggle("show", skippable);
  }

  end() {
    this.active = false;
    this.shotNow = null;
    this.onTick = undefined;
    document.body.classList.remove("cine");
    document.getElementById("skip")?.classList.remove("show");
  }

  skip() {
    if (!this.active || this.skipped) return;
    this.skipped = true;
    this.voice.interrupt();
    this.shotNow?.done();
    this.shotNow = null;
    this.skipR();
  }

  wait(ms: number) {
    if (this.skipped) return Promise.resolve();
    return Promise.race([new Promise<void>((r) => setTimeout(r, ms)), this.skipP]);
  }

  say(lines: Line[]) {
    if (this.skipped) return Promise.resolve();
    return Promise.race([this.voice.say(lines), this.skipP]);
  }

  shot(from: CamKey, to: CamKey, dur: number, opts: { track?: () => THREE.Vector3; linear?: boolean } = {}) {
    if (this.skipped) return Promise.resolve();
    return new Promise<void>((done) => {
      this.shotNow = { from, to, dur, t: 0, track: opts.track, ease: opts.linear ? (k) => k : easeInOut, done };
    });
  }

  /** Returns true while the cinematic owns the camera. */
  update(dt: number, camera: THREE.PerspectiveCamera) {
    if (!this.active) return false;
    this.onTick?.(dt);
    const s = this.shotNow;
    if (s) {
      s.t += dt;
      const k = s.ease(Math.min(1, s.t / s.dur));
      camera.position.lerpVectors(s.from.pos, s.to.pos, k);
      if (s.track) this.look.copy(s.track());
      else this.look.lerpVectors(s.from.look, s.to.look, k);
      camera.lookAt(this.look);
      if (s.t >= s.dur) {
        this.shotNow = null;
        s.done();
      }
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const a = this.shake * 0.6;
      camera.position.add(new THREE.Vector3((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a));
    }
    return true;
  }
}

export const key = (pos: THREE.Vector3, look: THREE.Vector3): CamKey => ({ pos: pos.clone(), look: look.clone() });
