// Fire that looks like fire: flame tongues shaded by scrolling, domain-warped
// noise (a hot white-yellow core cooling through orange to red at the
// ragged edges), always turned to the camera; a bed of glowing embers; sparks
// that spit and float up; smoke that rises, drifts and spreads; firelight
// that flickers smoothly instead of strobing. Optional logs (real bark) and a
// ring of photo-scanned stones.
//
// One Fire per fire in the world; updateFires() runs them all.

import * as THREE from "three";
import barkUrl from "ez-tree-assets/bark/oak_color_1k.jpg";
import { stoneRing } from "./props";

const NOISE = /* glsl */ `
  float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vn(p); p = p * 2.07 + 13.1; a *= 0.5; } return v; }
`;

const FLAME_FRAG = /* glsl */ `
  uniform float uTime, uSeed, uPower, uGhost;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 uv = vUv;
    float t = uTime * 1.35 + uSeed * 17.0;
    // turbulence rises: sample noise moving downward through the flame
    vec2 q = vec2(uv.x * 2.4 + uSeed, uv.y * 1.6 - t);
    float warp = fbm(q);
    float n = fbm(vec2(uv.x * 3.6 + warp * 1.4 + uSeed * 3.0, uv.y * 2.6 - t * 1.6));
    // a teardrop that narrows as it climbs, its edge torn into tongues by the noise
    float x = (uv.x - 0.5) * 2.0 + (warp - 0.5) * 0.7 * uv.y;
    float width = mix(0.9, 0.06, pow(uv.y, 0.75)) * (0.65 + n * 0.7);
    float body = 1.0 - smoothstep(width * 0.25, width, abs(x));
    float heat = body * (0.3 + n * 1.0) - uv.y * (1.2 - uPower * 0.35);
    heat += (1.0 - smoothstep(0.0, 0.15, uv.y)) * 0.08 * body; // the roots burn hottest
    float a = smoothstep(0.03, 0.4, heat) * 0.85 * smoothstep(0.0, 0.12, uv.y);
    float k = clamp(heat * 1.7, 0.0, 1.0);
    vec3 c = mix(vec3(0.45, 0.03, 0.0), vec3(1.0, 0.3, 0.02), smoothstep(0.0, 0.35, k));
    c = mix(c, vec3(1.0, 0.66, 0.16), smoothstep(0.35, 0.75, k));
    c = mix(c, vec3(1.0, 0.92, 0.7), smoothstep(0.85, 1.0, k));
    // the Choir's fire burns pale
    c = mix(c, vec3(0.75, 0.92, 1.0) * (0.6 + k * 0.6), uGhost);
    gl_FragColor = vec4(c * (0.46 + 0.42 * k), a);
    #include <colorspace_fragment>
  }
`;

let barkTex: THREE.Texture | null = null;
let bedTex: THREE.Texture | null = null;

/** Solid in the middle, gone at the rim. */
function bedFade() {
  if (bedTex) return bedTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "#fff");
  r.addColorStop(0.55, "#ddd");
  r.addColorStop(1, "#000");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  bedTex = new THREE.CanvasTexture(c);
  return bedTex;
}
let smokeTex: THREE.Texture | null = null;
let emberTex: THREE.Texture | null = null;
let sparkTex: THREE.Texture | null = null;

/** A soft, lumpy smoke puff. */
function smokeTexture() {
  if (smokeTex) return smokeTex;
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * S * 0.22;
    const x = S / 2 + Math.cos(a) * r;
    const y = S / 2 + Math.sin(a) * r;
    const rad = S * (0.12 + Math.random() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(255,255,255,0.16)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }
  smokeTex = new THREE.CanvasTexture(c);
  return smokeTex;
}

/** Glowing cracks in a bed of ash and charcoal (used as an emissive map). */
function emberTexture() {
  if (emberTex) return emberTex;
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  r.addColorStop(0, "#d86a20");
  r.addColorStop(0.35, "#a8360a");
  r.addColorStop(0.7, "#3a0c02");
  r.addColorStop(1, "#000000");
  g.fillStyle = r;
  g.fillRect(0, 0, S, S);
  // charcoal chunks laid over the glow, the light showing through the gaps
  for (let i = 0; i < 160; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * S * 0.42;
    g.fillStyle = `rgba(${10 + Math.random() * 20},${8 + Math.random() * 10},${6},${0.55 + Math.random() * 0.4})`;
    g.beginPath();
    g.ellipse(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 4 + Math.random() * 12, 3 + Math.random() * 8, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  emberTex = new THREE.CanvasTexture(c);
  emberTex.colorSpace = THREE.SRGBColorSpace;
  return emberTex;
}

function sparkTexture() {
  if (sparkTex) return sparkTex;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, "rgba(255,240,200,1)");
  r.addColorStop(0.3, "rgba(255,160,60,0.8)");
  r.addColorStop(1, "rgba(255,80,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  sparkTex = new THREE.CanvasTexture(c);
  return sparkTex;
}

export interface FireOptions {
  /** ~flame height in metres (a campfire is 1) */
  size: number;
  /** 0 none, 1 woodsmoke, 2 a fuel fire's black column */
  smoke?: number;
  logs?: boolean;
  stones?: boolean;
  /** base light intensity (0: no light of its own) */
  light?: number;
  lightRange?: number;
  /** pale flames */
  ghost?: boolean;
  /** burning against white (the Choir): drawn without additive blending */
  onWhite?: boolean;
}

interface Puff {
  s: THREE.Sprite;
  life: number;
  max: number;
  v: THREE.Vector3;
}

const all = new Set<Fire>();

export class Fire {
  group = new THREE.Group();
  light: THREE.PointLight | null = null;
  /** 0..1: how big and hot it burns (a dying campfire shrinks) */
  power = 1;
  /** burning at all? (unlit pits keep their logs and stones) */
  lit = true;
  private pivot = new THREE.Group();
  private flames: THREE.Mesh[] = [];
  private mats: THREE.ShaderMaterial[] = [];
  private puffs: Puff[] = [];
  private smokeMat: THREE.SpriteMaterial | null = null;
  private sparks: THREE.Points;
  private sparkData: Float32Array;
  private bed: THREE.Mesh;
  private bedMat: THREE.MeshStandardMaterial;
  private o: FireOptions;
  private seed = Math.random() * 10;
  private puffT = 0;
  private baseLight: number;
  private logGlow = { value: 1 };

  constructor(o: FireOptions) {
    this.o = o;
    const S = o.size;
    this.group.add(this.pivot);
    all.add(this);

    // flame tongues: one tall, two smaller to the sides, one low and wide
    const tongues: [number, number, number, number][] = [
      // x offset, z (depth) offset, width, height
      [0, 0, 0.9, 1.25],
      [-0.22, 0.05, 0.62, 0.85],
      [0.24, -0.04, 0.6, 0.8],
      [0, 0.08, 1.15, 0.55],
    ];
    tongues.forEach(([x, z, w, h], i) => {
      const geo = new THREE.PlaneGeometry(w * S, h * S * 1.2, 1, 1);
      geo.translate(0, (h * S * 1.2) / 2 - 0.04 * S, 0);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uSeed: { value: this.seed + i * 1.7 }, uPower: { value: 1 }, uGhost: { value: o.ghost ? 1 : 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: FLAME_FRAG,
        transparent: true,
        depthWrite: false,
        blending: o.ghost || o.onWhite ? THREE.NormalBlending : THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x * S, 0, z * S);
      m.renderOrder = 2;
      this.pivot.add(m);
      this.flames.push(m);
      this.mats.push(mat);
    });

    // the bed: ash and charcoal glowing through
    // feathered at the edge so it sinks into the ground instead of sitting on it like a plate
    this.bedMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1, emissive: 0xffffff, emissiveMap: emberTexture(), emissiveIntensity: 1.4, alphaMap: bedFade(), transparent: true, depthWrite: false });
    this.bed = new THREE.Mesh(new THREE.CircleGeometry(0.62 * S, 24), this.bedMat);
    this.bed.rotation.x = -Math.PI / 2;
    this.bed.position.y = 0.025;
    this.bed.receiveShadow = true;
    this.group.add(this.bed);

    if (o.logs) this.group.add(this.buildLogs(S));
    if (o.stones) stoneRing(this.group, 11, 0.88 * S, 0.34 * S);

    // sparks
    const N = Math.round(18 * S);
    this.sparkData = new Float32Array(N * 7); // x y z vx vy vz life
    const pos = new Float32Array(N * 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.sparks = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ map: sparkTexture(), size: 0.04 * Math.max(1, S * 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: o.ghost ? 0xcfefff : 0xffffff }),
    );
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);

    // smoke (kept in world space so it drifts away from the fire)
    if (o.smoke) {
      const dark = o.smoke >= 2;
      this.smokeMat = new THREE.SpriteMaterial({ map: smokeTexture(), color: dark ? 0x1a1816 : 0x6a6a6a, transparent: true, depthWrite: false, opacity: 0 });
      const n = dark ? 22 : 12;
      for (let i = 0; i < n; i++) {
        const s = new THREE.Sprite(this.smokeMat.clone());
        s.visible = false;
        this.puffs.push({ s, life: 0, max: 1, v: new THREE.Vector3() });
      }
    }

    this.baseLight = o.light ?? 0;
    if (this.baseLight) {
      this.light = new THREE.PointLight(o.ghost ? 0xdfefff : 0xff8a3a, this.baseLight, o.lightRange ?? 24, 1.6);
      this.light.position.y = 0.9 * S;
      this.group.add(this.light);
    }
  }

  private buildLogs(S: number) {
    const g = new THREE.Group();
    if (!barkTex) {
      barkTex = new THREE.TextureLoader().load(barkUrl);
      barkTex.colorSpace = THREE.SRGBColorSpace;
      barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping;
      barkTex.repeat.set(1, 2);
    }
    // charred toward the middle where they burn: dark vertex colours and a glow
    const geo = new THREE.CylinderGeometry(0.05 * S, 0.072 * S, 1.0 * S, 9, 6);
    const p = geo.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const up = p.getY(i) / (1.0 * S) + 0.5; // 0 the end outside .. 1 the end in the fire
      const c = (0.1 + 0.9 * (1 - THREE.MathUtils.smoothstep(up, 0.25, 0.85))) * 0.6;
      col.set([c, c * 0.95, c * 0.9], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.MeshStandardMaterial({ map: barkTex, color: 0x6a5a50, vertexColors: true, roughness: 0.95 });
    // the burning ends glow only while the fire burns (a cold pit is just charcoal)
    mat.onBeforeCompile = (s) => {
      s.uniforms.uGlow = this.logGlow;
      s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nvarying float vUp;").replace("#include <begin_vertex>", `#include <begin_vertex>\nvUp = position.y / ${(1.0 * S).toFixed(3)} + 0.5;`);
      s.fragmentShader = s.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vUp;\nuniform float uGlow;")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.8, 0.14, 0.02) * smoothstep(0.86, 1.0, vUp) * 0.35 * uGlow;");
    };
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(geo, mat);
      const a = (i / 5) * Math.PI * 2 + 0.3;
      // teepee: feet out on the ground, burning ends meeting over the bed
      const foot = new THREE.Vector3(Math.cos(a) * 0.62 * S, 0.04 * S, Math.sin(a) * 0.62 * S);
      const tip = new THREE.Vector3(Math.cos(a + 2.2) * 0.1 * S, 0.42 * S, Math.sin(a + 2.2) * 0.1 * S);
      const dir = tip.clone().sub(foot);
      l.position.copy(foot).addScaledVector(dir, 0.5);
      l.quaternion.setFromUnitVectors(up, dir.normalize());
      l.castShadow = true;
      g.add(l);
    }
    return g;
  }

  /** Called every frame by updateFires(). */
  /** A better-built fire: more light, a little more reach. */
  setBoost(k: number) {
    this.baseLight = (this.o.light ?? 0) * k;
    if (this.light) this.light.distance = (this.o.lightRange ?? 24) * Math.sqrt(k);
  }

  update(dt: number, t: number, cam: THREE.Camera) {
    const on = this.lit;
    const S = this.o.size;
    const pw = this.power;
    for (const f of this.flames) f.visible = on && pw > 0.02;
    // flames turn to face the camera (around the vertical only)
    const wp = this.group.getWorldPosition(new THREE.Vector3());
    this.pivot.rotation.y = Math.atan2(cam.position.x - wp.x, cam.position.z - wp.z) - this.group.rotation.y;
    const flick = 0.85 + Math.sin(t * 7.3 + this.seed) * 0.07 + Math.sin(t * 13.7 + this.seed * 2) * 0.05 + Math.sin(t * 23.1) * 0.03;
    for (const [i, m] of this.mats.entries()) {
      m.uniforms.uTime.value = t;
      m.uniforms.uPower.value = pw;
      const f = this.flames[i];
      f.scale.set(0.6 + pw * 0.4, (0.45 + pw * 0.55) * (0.94 + Math.sin(t * (5 + i) + i) * 0.06), 1);
    }
    this.bedMat.emissiveIntensity = on ? (0.35 + pw * 0.35) * flick : 0.0; // a cold pit is just ash
    this.logGlow.value = on ? Math.min(1, pw * 1.5) : 0;
    if (this.light) {
      this.light.intensity = on ? this.baseLight * (0.3 + 0.7 * pw) * flick : 0;
      this.light.position.x = Math.sin(t * 9.1 + this.seed) * 0.06 * S;
      this.light.position.z = Math.cos(t * 7.7 + this.seed) * 0.06 * S;
    }
    // sparks: spat up, slowed by the air, fading
    const sp = this.sparks.geometry.attributes.position as THREE.BufferAttribute;
    const d = this.sparkData;
    for (let i = 0; i < sp.count; i++) {
      const j = i * 7;
      d[j + 6] -= dt;
      if (d[j + 6] <= 0) {
        if (!on || Math.random() > 0.05 + pw * 0.08) {
          sp.setXYZ(i, 0, -100, 0);
          continue;
        }
        d[j] = (Math.random() - 0.5) * 0.4 * S;
        d[j + 1] = 0.3 * S;
        d[j + 2] = (Math.random() - 0.5) * 0.4 * S;
        d[j + 3] = (Math.random() - 0.5) * 0.6;
        d[j + 4] = (1.6 + Math.random() * 2.2) * Math.sqrt(S);
        d[j + 5] = (Math.random() - 0.5) * 0.6;
        d[j + 6] = 0.6 + Math.random() * 1.0;
      }
      d[j + 3] += Math.sin(t * 3 + i) * dt * 0.8;
      d[j + 4] *= 1 - dt * 0.6;
      d[j] += d[j + 3] * dt;
      d[j + 1] += d[j + 4] * dt;
      d[j + 2] += d[j + 5] * dt;
      sp.setXYZ(i, d[j], d[j + 1], d[j + 2]);
    }
    sp.needsUpdate = true;
    // smoke: born in the flame tips, rising, spreading, thinning
    if (this.smokeMat) {
      // smoke lives in the scene itself (world space), whatever holds the fire
      let parent: THREE.Object3D | null = this.group;
      while (parent?.parent) parent = parent.parent;
      if (!(parent as THREE.Scene)?.isScene) parent = null;
      const heavy = (this.o.smoke ?? 0) >= 2;
      this.puffT -= dt;
      if (on && this.puffT <= 0 && parent) {
        const p = this.puffs.find((q) => q.life <= 0);
        if (p) {
          this.puffT = heavy ? 0.22 : 0.45;
          p.max = p.life = heavy ? 5 + Math.random() * 2 : 3.5 + Math.random() * 1.5;
          p.s.position.copy(wp).add(new THREE.Vector3((Math.random() - 0.5) * 0.3 * S, 1.1 * S * (0.6 + pw * 0.4), (Math.random() - 0.5) * 0.3 * S));
          p.v.set((Math.random() - 0.5) * 0.3 + 0.25, (heavy ? 1.5 : 0.9) * Math.sqrt(S), (Math.random() - 0.5) * 0.3);
          p.s.visible = true;
          if (!p.s.parent) parent.add(p.s);
        }
      }
      for (const p of this.puffs) {
        if (p.life <= 0) {
          p.s.visible = false;
          continue;
        }
        p.life -= dt;
        const k = 1 - p.life / p.max; // 0 born .. 1 gone
        p.s.position.addScaledVector(p.v, dt);
        p.v.x += dt * 0.12; // a light wind
        const size = (0.6 + k * (heavy ? 5 : 2.4)) * S;
        p.s.scale.set(size, size, 1);
        (p.s.material as THREE.SpriteMaterial).opacity = Math.sin(Math.min(1, k * 1.2) * Math.PI) * (heavy ? 0.55 : 0.28) * pw;
        (p.s.material as THREE.SpriteMaterial).rotation += dt * 0.2;
      }
    }
  }

  dispose() {
    all.delete(this);
    for (const p of this.puffs) p.s.removeFromParent();
    this.group.removeFromParent();
  }
}

/** Run every fire (flames face the camera, smoke drifts, light flickers). */
export function updateFires(dt: number, t: number, cam: THREE.Camera) {
  for (const f of all) if (f.group.parent) f.update(dt, t, cam);
}
