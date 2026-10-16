// Co-op voice chat: WebRTC audio between every pair of survivors in a room
// (mesh, max 8). The room server relays the signaling only; audio flows
// peer to peer. Voices are positional: they come from the speaker's survivor
// and fade with distance. Push-to-talk (V) by default, or open mic.

import * as THREE from "three";
import { net } from "./net";

export type MicMode = "off" | "ptt" | "open";

interface Link {
  id: number;
  pc: RTCPeerConnection;
  sender: RTCRtpSender | null;
  gain?: GainNode;
  panner?: PannerNode;
  analyser?: AnalyserNode;
  el?: HTMLAudioElement;
  level: number;
  pendingIce: RTCIceCandidateInit[];
}

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};
const KEY = "afterfall.voice";

class VoiceChat {
  mode: MicMode = "ptt";
  othersMuted = false;
  ptt = false;
  micLevel = 0;
  micError = "";
  private links = new Map<number, Link>();
  private ctx: AudioContext | null = null;
  private mic: MediaStream | null = null;
  private micTrack: MediaStreamTrack | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private buf = new Uint8Array(512);
  onChange?: () => void;

  constructor() {
    try {
      const saved = localStorage.getItem(KEY) as MicMode | null;
      if (saved === "off" || saved === "ptt" || saved === "open") this.mode = saved;
    } catch {}
    net.on("welcome", (m) => {
      // newcomers have the highest id: the existing players send the offers
      for (const p of m.players) this.link(p.id, false);
    });
    net.on("join", (m) => {
      if (net.id < m.id) this.offer(this.link(m.id, true));
    });
    net.on("leave", (m) => this.drop(m.id));
    net.on("closed", () => {
      for (const id of [...this.links.keys()]) this.drop(id);
    });
    net.on("rtc", (m) => this.onSignal(m.from!, m.sdp));
    net.on("ice", (m) => this.onIce(m.from!, m.c));
    addEventListener("keydown", (e) => {
      if (e.code === "KeyV" && !e.repeat) this.setPtt(true);
    });
    addEventListener("keyup", (e) => {
      if (e.code === "KeyV") this.setPtt(false);
    });
    addEventListener("blur", () => this.setPtt(false));
  }

  get transmitting() {
    return !!this.micTrack && (this.mode === "open" || (this.mode === "ptt" && this.ptt));
  }

  get peersSpeaking() {
    const out = new Set<number>();
    for (const l of this.links.values()) if (l.level > 0.04) out.add(l.id);
    return out;
  }

  private audio() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Ask for the microphone (needs a click or key press first). */
  async enableMic() {
    if (this.mic || this.mode === "off") return;
    try {
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.micTrack = this.mic.getAudioTracks()[0];
      const ctx = this.audio();
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 512;
      ctx.createMediaStreamSource(this.mic).connect(this.micAnalyser);
      this.micError = "";
      for (const l of this.links.values()) l.sender?.replaceTrack(this.micTrack);
      this.applyTx();
    } catch (e) {
      this.micError = (e as Error).name === "NotAllowedError" ? "Microphone blocked by the browser." : "No microphone found.";
    }
    this.onChange?.();
  }

  resumeAudio() {
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
  }

  setMode(m: MicMode) {
    this.mode = m;
    try {
      localStorage.setItem(KEY, m);
    } catch {}
    if (m !== "off") this.enableMic();
    this.applyTx();
    this.onChange?.();
  }

  cycleMode() {
    this.setMode(this.mode === "ptt" ? "open" : this.mode === "open" ? "off" : "ptt");
  }

  setOthersMuted(v: boolean) {
    this.othersMuted = v;
    for (const l of this.links.values()) if (l.gain) l.gain.gain.value = v ? 0 : 1;
    this.onChange?.();
  }

  setPtt(v: boolean) {
    if (this.ptt === v) return;
    this.ptt = v;
    if (v && net.active && this.mode === "ptt") this.enableMic();
    this.applyTx();
    this.onChange?.();
  }

  private applyTx() {
    if (this.micTrack) this.micTrack.enabled = this.transmitting;
  }

  // ------------------------------------------------------------------ peers
  /** The offerer adds the audio transceiver; the answerer gets it from the offer. */
  private link(id: number, offerer = false) {
    let l = this.links.get(id);
    if (l) return l;
    const pc = new RTCPeerConnection(ICE);
    l = { id, pc, sender: null, level: 0, pendingIce: [] };
    if (offerer) {
      const tr = pc.addTransceiver("audio", { direction: "sendrecv" });
      l.sender = tr.sender;
      if (this.micTrack) tr.sender.replaceTrack(this.micTrack);
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) net.send({ t: "ice", to: id, c: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => this.attach(l!, e.streams[0] ?? new MediaStream([e.track]));
    this.links.set(id, l);
    return l;
  }

  private async offer(l: Link) {
    const o = await l.pc.createOffer();
    await l.pc.setLocalDescription(o);
    net.send({ t: "rtc", to: l.id, sdp: l.pc.localDescription });
  }

  private async onSignal(from: number, sdp: RTCSessionDescriptionInit) {
    const l = this.link(from);
    try {
      await l.pc.setRemoteDescription(sdp);
      for (const c of l.pendingIce.splice(0)) await l.pc.addIceCandidate(c).catch(() => {});
      if (sdp.type === "offer") {
        // our transceiver for this peer is the one the offer created
        const tr = l.pc.getTransceivers().find((x) => x.mid !== null);
        if (tr) {
          tr.direction = "sendrecv";
          l.sender = tr.sender;
          if (this.micTrack) await tr.sender.replaceTrack(this.micTrack);
        }
        const a = await l.pc.createAnswer();
        await l.pc.setLocalDescription(a);
        net.send({ t: "rtc", to: from, sdp: l.pc.localDescription });
      }
    } catch (e) {
      console.warn("[voice] signaling", e);
    }
  }

  private async onIce(from: number, c: RTCIceCandidateInit) {
    const l = this.link(from);
    if (!l.pc.remoteDescription) l.pendingIce.push(c);
    else await l.pc.addIceCandidate(c).catch(() => {});
  }

  /** Route a peer's voice through a 3D panner placed at their survivor. */
  private attach(l: Link, stream: MediaStream) {
    if (l.el) return;
    const ctx = this.audio();
    // Chrome only feeds remote WebRTC audio into WebAudio while an element plays it
    l.el = new Audio();
    l.el.srcObject = stream;
    l.el.muted = true;
    l.el.play().catch(() => {});
    const src = ctx.createMediaStreamSource(stream);
    l.analyser = ctx.createAnalyser();
    l.analyser.fftSize = 512;
    l.gain = ctx.createGain();
    l.gain.gain.value = this.othersMuted ? 0 : 1;
    l.panner = new PannerNode(ctx, {
      panningModel: "HRTF",
      distanceModel: "inverse",
      refDistance: 4,
      maxDistance: 120,
      rolloffFactor: 1.3,
    });
    src.connect(l.analyser);
    src.connect(l.gain).connect(l.panner).connect(ctx.destination);
  }

  private drop(id: number) {
    const l = this.links.get(id);
    if (!l) return;
    l.pc.close();
    l.el?.pause();
    l.panner?.disconnect();
    this.links.delete(id);
  }

  private rms(a: AnalyserNode) {
    a.getByteTimeDomainData(this.buf);
    let s = 0;
    for (let i = 0; i < a.fftSize; i++) {
      const v = (this.buf[i] - 128) / 128;
      s += v * v;
    }
    return Math.sqrt(s / a.fftSize);
  }

  /** Every frame: listener follows the camera, voices follow the survivors. */
  update(camera: THREE.Camera, positions: Map<number, THREE.Vector3>) {
    if (this.micAnalyser) this.micLevel = this.transmitting ? this.rms(this.micAnalyser) : 0;
    if (!this.ctx) return;
    const L = this.ctx.listener;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setValueAtTime(camera.position.x, t);
      L.positionY.setValueAtTime(camera.position.y, t);
      L.positionZ.setValueAtTime(camera.position.z, t);
      L.forwardX.setValueAtTime(fwd.x, t);
      L.forwardY.setValueAtTime(fwd.y, t);
      L.forwardZ.setValueAtTime(fwd.z, t);
      L.upX.setValueAtTime(up.x, t);
      L.upY.setValueAtTime(up.y, t);
      L.upZ.setValueAtTime(up.z, t);
    }
    for (const l of this.links.values()) {
      if (l.analyser) l.level = l.level * 0.7 + this.rms(l.analyser) * 0.3;
      const p = positions.get(l.id);
      if (p && l.panner) {
        l.panner.positionX.setValueAtTime(p.x, t);
        l.panner.positionY.setValueAtTime(p.y + 1.7, t);
        l.panner.positionZ.setValueAtTime(p.z, t);
      }
    }
  }

  get connectedCount() {
    let n = 0;
    for (const l of this.links.values()) if (l.pc.connectionState === "connected") n++;
    return n;
  }
}

export const voiceChat = new VoiceChat();
