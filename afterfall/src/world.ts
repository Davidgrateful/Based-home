// The world on the other side of the rift: terrain, sky with two moons, the
// wrecked medevac plane, the ambulance the player wakes up in, alien forest,
// resonance pylons and the Warden's arena.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { buildAircraft, wreckPieces, type Aircraft } from "./aircraft";
import { Forest, SHADOW_LAYER, type TreeSpot } from "./flora";
import { NearField, placeProps, type Placed } from "./props";
import { buildAmbulance } from "./ambulance";
import { Fire, updateFires } from "./fire";
import { buildLitter } from "./litter";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import barkUrl from "ez-tree-assets/bark/oak_color_1k.jpg";

/** A few small glowing mushrooms: pale stems, caps that give off light. */
function mushroomCluster() {
  const parts: THREE.BufferGeometry[] = [];
  const spots: [number, number, number][] = [
    [0, 0, 1],
    [0.07, 0.04, 0.7],
    [-0.05, 0.06, 0.55],
    [0.02, -0.07, 0.8],
  ];
  for (const [x, z, k] of spots) {
    const stem = new THREE.CylinderGeometry(0.008 * k, 0.012 * k, 0.09 * k, 6);
    stem.translate(x, 0.045 * k, z);
    const cap = new THREE.SphereGeometry(0.03 * k, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.55, 1);
    cap.translate(x, 0.09 * k, z);
    for (const [g, c] of [
      [stem, 0.18],
      [cap, 1],
    ] as const) {
      const n = g.attributes.position.count;
      g.setAttribute("color", new THREE.Float32BufferAttribute(new Array(n * 3).fill(c), 3));
      parts.push(g.index ? g.toNonIndexed() : g);
    }
  }
  // merge (positions + colours only)
  let total = 0;
  for (const g of parts) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    col.set(g.attributes.color.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}

/** What the ground is at a point: trodden earth (around the camp, the crash,
 *  the settlement, and in patches), burnt ground by the wreck, Choir ash. */
export function floorFx(x: number, z: number) {
  const n2 = Math.sin(x * 0.23 + z * 0.11) * Math.cos(z * 0.19 - x * 0.07) * 0.5 + 0.5;
  const arena = 1 - smoothstep(16, 26, Math.hypot(x - ARENA.x, z - ARENA.z));
  const basin = 1 - smoothstep(50, 74, Math.hypot(x - BASIN_C.x, z - BASIN_C.z));
  const dirt = Math.max(
    smoothstep(0.62, 0.9, n2) * 0.8,
    1 - smoothstep(4, 9, Math.hypot(x - CAMP.x, z - CAMP.z)),
    1 - smoothstep(10, 18, Math.hypot(x - SETTLEMENT.x, z - SETTLEMENT.z)),
    arena * 0.9,
    basin * 0.6,
  );
  // the slide: the fuselage gouged a furrow west to east, tail first
  const furrow = 1 - smoothstep(1.2, 3.4, segDist(x, z, -36, 28.5, 1, 37.5));
  const scorch = Math.max((1 - smoothstep(6, 26, Math.hypot(x + 6, z - 18))) * 0.95, furrow * 0.7);
  const choir = 1 - smoothstep(14, 30, Math.hypot(x - CHOIR_C.x, z - CHOIR_C.z));
  const scar = 1 - smoothstep(5, 9, Math.hypot(x - SCAR.x, z - SCAR.z));
  // worn paths where people walked, again and again
  const path = 1 - smoothstep(0.7, 1.9, pathDist(x, z));
  return { dirt: Math.max(dirt, scar * 0.7, path * 0.9, furrow * 0.6), scorch: Math.max(scorch, scar * 0.55), choir, basin };
}

function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

/** Trodden tracks between the places people went: camp to the Old Camp, the
 *  scar and the Watch, the wreck to the Dead Tree and the shed past it. They
 *  wander a little, the way feet do. */
export const PATHS: [number, number][][] = [
  [[3, 6], [-12, 8], [-26, 4], [-40, 6], [-53, 4]],
  [[8, 11], [16, 20], [26, 29], [40, 31], [56, 29], [68, 27]],
  [[-8, 26], [-15, 40], [-22, 52], [-28, 60]],
  [[-27, 66], [-31, 73], [-34, 79]],
];
function pathDist(x: number, z: number) {
  let d = Infinity;
  const wob = Math.sin(x * 0.21 + z * 0.13) * 0.7;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x + wob, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
  return d;
}

/** The forest floor: Poly Haven scans (moss and needles, bare dirt, burnt
 *  ground) blended per vertex, tinted by region, with a second, larger-scale
 *  sample to break up the tiling. */
function groundMaterial() {
  const tl = new THREE.TextureLoader();
  const tex = (f: string, srgb = true) => {
    const t = tl.load(`./world/${f}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const moss = tex("ground-moss.webp");
  const mossN = tex("ground-moss-n.webp", false);
  const dirt = tex("ground-dirt.webp");
  const burnt = tex("ground-burnt.webp");
  // the plane's uv spans 420 x 580 m: tile every ~4 m
  moss.repeat.set(420 / 4, 580 / 4);
  mossN.repeat.copy(moss.repeat);
  const m = new THREE.MeshStandardMaterial({ map: moss, normalMap: mossN, normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true, roughness: 0.95 });
  m.onBeforeCompile = (s) => {
    s.uniforms.tDirt = { value: dirt };
    s.uniforms.tBurnt = { value: burnt };
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 fx;\nvarying vec3 vFx;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFx = fx;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D tDirt;\nuniform sampler2D tBurnt;\nvarying vec3 vFx;")
      .replace(
        "#include <map_fragment>",
        `vec2 tuv = vMapUv;
        vec3 a = texture2D(map, tuv).rgb;
        // a second, slower sample breaks up the repeat
        a *= 0.75 + 0.5 * texture2D(map, tuv * 0.137 + 0.31).g;
        vec3 d = texture2D(tDirt, tuv * 0.83).rgb;
        vec3 b = texture2D(tBurnt, tuv * 0.9).rgb;
        vec3 g = mix(a, d, vFx.x);
        g = mix(g, b * 0.8, vFx.y);
        g = mix(g, vec3(0.78, 0.82, 0.83) * (0.85 + 0.3 * d.r), vFx.z);
        diffuseColor.rgb *= g;`,
      );
  };
  return m;
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const WORLD_RADIUS = 190;
const SKY_LOW = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches && !location.search.includes("high");

export function heightAt(x: number, z: number) {
  const h =
    Math.sin(x * 0.021) * 5 +
    Math.cos(z * 0.017) * 5 +
    Math.sin((x + z) * 0.045) * 1.6 +
    Math.sin(x * 0.13 + z * 0.09) * 0.5 -
    5;
  // Crash site is a flattened scar so the opening plays on level ground.
  const crash = smoothstep(18, 55, Math.hypot(x + 6, z - 16));
  // Arena is a shallow bowl.
  const arena = smoothstep(20, 34, Math.hypot(x - ARENA.x, z - ARENA.z));
  const ground = h * crash * arena + (1 - arena) * -2;
  // North of the Warden's circle the ground breaks: the Rift Basin. Ridged,
  // cracked, sinking toward a crater; flat and pale where the Choir waits.
  const db = Math.hypot(x - BASIN_C.x, z - BASIN_C.z);
  const basin = 1 - smoothstep(58, 80, db);
  if (basin <= 0) return ground;
  const ridge = Math.abs(Math.sin(x * 0.11 + Math.sin(z * 0.05) * 2) + Math.sin(z * 0.13 + x * 0.04));
  const shards = Math.max(0, Math.sin(x * 0.31) * Math.sin(z * 0.27) - 0.55) * 9;
  const crater = -7 * (1 - smoothstep(0, 46, db));
  const choir = 1 - smoothstep(16, 30, Math.hypot(x - CHOIR_C.x, z - CHOIR_C.z));
  const broken = (-3 + ridge * 3.2 + shards + crater) * (1 - choir) + choir * -4;
  return ground + (broken - ground) * basin;
}

/** The Rift Basin, past the Warden's circle; the Choir at its far edge. */
export const BASIN_C = { x: 0, z: 262 };
export const BASIN_R = 70;
export const CHOIR_C = { x: 0, z: 304 };
/** The settlement of the Changed, deep in the Blackwood. */
export const SETTLEMENT = { x: -124, z: 104 };

export const AMBULANCE = { minX: -1.35, maxX: 1.35, minZ: -3.25, maxZ: 3.25 };
export const BEACON = new THREE.Vector3(-12.5, 0, 33);
export const PYLONS = [new THREE.Vector3(58, 0, 62), new THREE.Vector3(-62, 0, 88), new THREE.Vector3(18, 0, 122)];
export const ARENA = new THREE.Vector3(0, 0, 165);
export const CAMP = new THREE.Vector3(6, 0, 9);
/** Meridian's abandoned field station, east of the crash. Red trees around it. */
export const STATION = new THREE.Vector3(80, 0, 26);
/** A broken Meridian relay mast behind the ambulance: the landmark you navigate home by. */
export const MAST = new THREE.Vector3(8, 0, -22);
/** West of this line the forest closes in: the Blackwood. */
export const BLACKWOOD_X = -38;
/** A giant dead tree, bleached, on the way north-west: you can steer by it. */
export const DEAD_TREE = new THREE.Vector3(-30, 0, 64);
/** The Blue Scar: a patch of ground the rift has damaged, east of the crash. */
export const SCAR = new THREE.Vector3(30, 0, 34);
/** The Old Camp: survivors lived here once, at the edge of the Blackwood. */
export const OLD_CAMP = new THREE.Vector3(-58, 0, 4);
/** Where the evidence lies (offsets from its place), for the props and the inspect prompts. */
export const OC = { post: [3.6, -2.8], board: [-4.2, -2.4], graves: [0.4, -7.2], cot: [2.9, 2.6], bag: [-1.4, 1.9], can: [-2.4, -0.9], roll: [-2.6, 2.2], note: [-0.9, -3.4] } as const;
export const WATCH = { camera: [-12, 4], desk: [-11, 0.6] } as const;
export const DEAD_TAG = [2.6, -1.8] as const;
/** A Meridian shed past the Dead Tree: one bed, facing a wall. */
export const SHED = new THREE.Vector3(-36, 0, 82);
/** Where the shed's bed is (the wristband on its rail), for the inspect prompt. */
export const SHED_BED = new THREE.Vector3(-36, 0, 82.4);
/** Small stories in the woods: seen, never explained. */
export const MICRO = { pack: [-46, 34], cups: [48, 19], grave: [20, 50] } as const;
for (const p of [BEACON, ...PYLONS, ARENA, CAMP, STATION, MAST, DEAD_TREE, SCAR, OLD_CAMP, SHED, SHED_BED]) p.y = heightAt(p.x, p.z);

export interface Circle {
  x: number;
  z: number;
  r: number;
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

export interface Shard {
  mesh: THREE.Mesh;
  taken: boolean;
  base: number;
  dynamic?: boolean;
  value?: number;
}

export interface Cache {
  group: THREE.Group;
  pos: THREE.Vector3;
  opened: boolean;
}

export interface Ghost {
  group: THREE.Group;
  pos: THREE.Vector3;
  echoId: number;
}

interface Mood {
  fog: number;
  density: number;
  hemi: number;
  tint: [number, number, number];
  sun: number;
  blood?: boolean;
}

/** The realistic forest drinks light: lift the dark moods (not the Choir's
 *  white-out) so faces and silhouettes still read at night. */
const lift = (hemi: number) => (hemi < 2 ? 1.35 : 1);

export const MOODS = {
  basin: { fog: 0x0f2129, density: 0.017, hemi: 1.1, tint: [0.7, 1.25, 1.35], sun: 1.2 },
  choir: { fog: 0xd9e4e8, density: 0.03, hemi: 2.6, tint: [2.6, 2.7, 2.75], sun: 2.4 },
  night: { fog: 0x1a2130, density: 0.0115, hemi: 1.2, tint: [1, 1, 1], sun: 1.5 },
  dusk: { fog: 0x33282a, density: 0.009, hemi: 1.4, tint: [1.45, 1.05, 0.95], sun: 1.8 },
  storm: { fog: 0x11141b, density: 0.0155, hemi: 0.9, tint: [0.75, 0.78, 0.95], sun: 1.1 },
  blood: { fog: 0x24100f, density: 0.0135, hemi: 1.0, tint: [1.5, 0.6, 0.55], sun: 1.2, blood: true },
  dawn: { fog: 0x3a3a40, density: 0.0075, hemi: 1.65, tint: [1.4, 1.25, 1.15], sun: 2.0 },
  fog: { fog: 0x5c6066, density: 0.03, hemi: 1.3, tint: [1.2, 1.22, 1.25], sun: 1.4 },
} satisfies Record<string, Mood>;
export type MoodName = keyof typeof MOODS;

export interface Pylon {
  pos: THREE.Vector3;
  rune: THREE.MeshStandardMaterial;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  beam: THREE.Mesh;
  light: THREE.PointLight;
  charge: number;
  lit: boolean;
}

export class World {
  scene: THREE.Scene;
  colliders: Circle[] = [];
  cameraBlockers: THREE.Object3D[] = [];
  shards: Shard[] = [];
  pylons: Pylon[] = [];
  sun: THREE.DirectionalLight;
  ambulance: THREE.Group;
  doorL: THREE.Group;
  doorR: THREE.Group;
  doorsOpen = 0; // 0..1 animation
  doorsTarget = 0;
  interiorLight: THREE.PointLight;
  monitorMat: THREE.MeshStandardMaterial;
  axeProp: THREE.Group;
  roofLights: THREE.MeshStandardMaterial[] = [];
  fires: { light: THREE.PointLight; fire: Fire; base: number }[] = [];
  beaconLight: THREE.PointLight;
  beaconMat: THREE.MeshStandardMaterial;
  rift: THREE.Mesh;
  riftMat: THREE.ShaderMaterial;
  riftLight: THREE.PointLight;
  riftOpen = 0;
  private riftDebris: THREE.Mesh[] = [];
  private scarStones: THREE.Mesh[] = [];
  private lanternLight!: THREE.PointLight;
  private lanternGlass!: THREE.MeshStandardMaterial;
  private shedScreen!: THREE.MeshStandardMaterial;
  private lookoutWin!: THREE.MeshStandardMaterial;
  private shedLight!: THREE.PointLight;
  /** The camera is inside the aircraft set (the outdoor light is dimmed). */
  indoor = false;
  /** Fire and smoke behind the falling plane (off while it cruises). */
  planeTrail = true;
  hemi!: THREE.HemisphereLight;
  bigMoon!: { color: THREE.Color };
  campfire!: { group: THREE.Group; light: THREE.PointLight; fire: Fire; lit: boolean; hp: number; maxHp: number };
  caches: Cache[] = [];
  /** Trunk positions, for the map. */
  treeSpots: { x: number; z: number; kind: 0 | 1 | 2 }[] = [];
  /** Fires other than the campfire (the settlement's). */
  otherFires: THREE.Vector3[] = [];
  /** 0..1: extra fog while inside the Blackwood. */
  fogBoost = 0;
  private fogBoostNow = 0;
  private mastLight!: THREE.SpriteMaterial;
  private mist: { s: THREE.Sprite; base: THREE.Vector3; ph: number }[] = [];
  private stationFlicker!: THREE.MeshStandardMaterial;
  private stationLamp!: THREE.PointLight;
  ghosts: Ghost[] = [];
  fallingPlane!: THREE.Group;
  /** The trees (instanced, near/far detail). */
  forest!: Forest;
  /** Grass and ferns around the player. */
  near!: NearField;
  /** The medevac jet itself (inside fallingPlane): lights, fans, window glow. */
  aircraft!: Aircraft;
  skyTear!: THREE.Mesh;
  skyTearMat!: THREE.ShaderMaterial;
  private tears: { mesh: THREE.Mesh; life: number }[] = [];
  private trail: { s: THREE.Sprite; life: number; vel: THREE.Vector3 }[] = [];
  private trailT = 0;
  private mood: Mood = MOODS.night as Mood;
  /** A place's own weather (the Basin, the Choir) overrides the story mood. */
  zoneMood: MoodName | null = null;
  /** Things the loop has switched off. */
  mastDark = false;
  stationDark = false;
  /** The way north past the Warden's circle (opened in Chapter Six). */
  basinOpen = false;
  private moodFog = new THREE.Color(0x1d1533);
  private moodDensity = 0.0115;
  private ghostMat!: THREE.MeshBasicMaterial;
  private shardGeo = new THREE.OctahedronGeometry(0.32);
  private shardMat = new THREE.MeshStandardMaterial({ color: 0x9fb8bd, emissive: 0x3aa8c8, emissiveIntensity: 0.55, flatShading: true, metalness: 0.4, roughness: 0.25 });
  private spores: THREE.Points;
  private embers: THREE.Points;
  private emberData: Float32Array;
  private skyMat: THREE.ShaderMaterial;
  private shardGlow: THREE.SpriteMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.fog = new THREE.FogExp2(0x161a22, 0.0115);
    scene.background = new THREE.Color(0x161a22);

    // ---------- Sky ----------
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uTint: { value: new THREE.Vector3(1, 1, 1) },
        uHaze: { value: new THREE.Color(0x1a2130) },
        uWrong: { value: 0.35 },
      },
      // phones: fewer noise octaves, no faint-star layer
      defines: { OCT: SKY_LOW ? 3 : 5, ...(SKY_LOW ? { LOW: 1 } : {}) },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      // An enormous night: a gradient that melts into the fog at the horizon,
      // stars of every brightness, the galaxy's band with its dust lanes, thin
      // cloud drifting across it all. And in the north, where the rift is,
      // the stars bend, as if the light were being pulled through something.
      fragmentShader: `
        varying vec3 vDir; uniform float uTime; uniform vec3 uTint; uniform vec3 uHaze; uniform float uWrong;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        float h21(vec2 p){ p = fract(p*vec2(233.34,851.73)); p += dot(p, p+23.45); return fract(p.x*p.y); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
        float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<OCT;i++){ v+=a*vn(p); p=p*2.03+7.7; a*=0.5; } return v; }
        // one layer of round stars: n cells around the sky, a fraction lit
        vec3 stars(vec3 d, float n, float keep, float size){
          vec3 p = d * n; vec3 cell = floor(p); vec3 f = fract(p) - 0.5;
          float r = hash(cell);
          if (r < keep) return vec3(0.0);
          vec3 off = vec3(hash(cell+1.3), hash(cell+2.7), hash(cell+4.1)) - 0.5;
          float dist = length(f - off * 0.6);
          float mag = pow((r - keep) / (1.0 - keep), 3.0);
          float s = smoothstep(size, 0.0, dist) * (0.25 + 2.2 * mag);
          float tw = 0.75 + 0.25 * sin(uTime * (1.5 + r * 4.0) + r * 60.0);
          vec3 col = mix(vec3(1.0, 0.82, 0.62), vec3(0.72, 0.84, 1.0), hash(cell + 9.1));
          return col * s * mix(1.0, tw, mag);
        }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          // light bending around the rift (low in the north)
          vec3 R = normalize(vec3(0.0, 0.32, 1.0));
          float ang = acos(clamp(dot(d, R), -1.0, 1.0));
          float lens = uWrong * 0.06 / (ang * ang * 40.0 + 0.6);
          vec3 sd = normalize(d + normalize(d - R * dot(d, R) + 1e-4) * lens * sin(uTime * 0.15 + ang * 6.0));

          vec3 top = vec3(0.008, 0.011, 0.024);
          vec3 mid = vec3(0.035, 0.045, 0.08);
          vec3 c = mix(uHaze, mid, smoothstep(-0.02, 0.22, h));
          c = mix(c, top, smoothstep(0.22, 0.95, h));

          // the galaxy: a tilted band of faint light with dark dust lanes
          vec3 gp = normalize(vec3(0.42, 0.75, -0.5));
          float gd = dot(sd, gp);
          vec2 guv = vec2(atan(sd.x, sd.z) * 2.2, gd * 9.0);
          float band = exp(-gd * gd * 26.0);
          float dust = fbm(guv * 2.0 + 3.1);
          float glow = band * (0.35 + 0.65 * fbm(guv * 0.9)) * smoothstep(0.38, 0.62, 1.0 - dust * band * 0.9);
          c += vec3(0.07, 0.075, 0.1) * glow * smoothstep(0.02, 0.3, h);

          // stars: a dust of faint ones, fewer bright ones, more along the band
          vec3 st = stars(sd, 260.0, 0.955 - band * 0.05, 0.38) + stars(sd, 90.0, 0.987, 0.32) * 1.4;
          #ifndef LOW
          st += stars(sd, 520.0, 0.95 - band * 0.08, 0.3) * 0.5;
          #endif
          st *= smoothstep(0.0, 0.22, h);

          // thin cloud drifting across, lit faintly by the moons; it hides the stars
          vec2 cuv = d.xz / max(d.y, 0.06) * 0.55 + vec2(uTime * 0.004, uTime * 0.0025);
          float cl = smoothstep(0.5, 0.85, fbm(cuv * 1.3)) * smoothstep(0.02, 0.25, h) * 0.85;
          c = mix(c + st, mix(uHaze, vec3(0.1, 0.11, 0.14), 0.5) * 0.9, cl);

          // near the rift the sky itself is wrong: a cold seam of light that comes and goes
          float seam = exp(-ang * ang * 900.0 / (0.6 + 0.4 * sin(uTime * 0.21))) * uWrong;
          c += vec3(0.25, 0.55, 0.62) * seam * 0.35;
          gl_FragColor = vec4(c * uTint, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), this.skyMat);
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    scene.add(sky);

    // Far ridges: two rings of mountain silhouette well beyond where you can
    // walk, made of the same haze as the horizon (darker toward their crests),
    // so the far distance has a shape and still dissolves into the air.
    const ridge = (radius: number, lo: number, hi: number, dark: number, seed: number) => {
      const N = 320;
      const pos: number[] = [];
      const hf: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const s = a * 3 + seed;
        // overlapping peaks: broad shoulders, a few sharp summits
        let h = 0.5 + 0.25 * Math.sin(s) + 0.15 * Math.sin(s * 2.7 + 1.1) + 0.1 * Math.sin(s * 6.3 + 2.3);
        h += 0.22 * Math.pow(Math.abs(Math.sin(s * 4.1 + 0.7)), 6) + 0.05 * Math.sin(s * 17.0);
        const top = lo + (hi - lo) * Math.max(0, Math.min(1.2, h));
        const x = Math.sin(a) * radius;
        const z = 80 + Math.cos(a) * radius;
        pos.push(x, -40, z, x, top, z);
        hf.push(0, 1);
        if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("hf", new THREE.Float32BufferAttribute(hf, 1));
      g.setIndex(idx);
      const m = new THREE.Mesh(
        g,
        new THREE.ShaderMaterial({
          side: THREE.DoubleSide,
          fog: false,
          uniforms: { uHaze: this.skyMat.uniforms.uHaze, uTint: this.skyMat.uniforms.uTint, uDark: { value: dark } },
          vertexShader: `attribute float hf; varying float vH; void main(){ vH = hf; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `uniform vec3 uHaze; uniform vec3 uTint; uniform float uDark; varying float vH;
            void main(){ float k = mix(1.0, uDark, smoothstep(0.35, 1.0, vH)); gl_FragColor = vec4(uHaze * k * uTint, 1.0); }`,
        }),
      );
      m.frustumCulled = false;
      m.renderOrder = -1;
      scene.add(m);
    };
    ridge(520, 20, 95, 0.72, 1.7); // the farthest range: barely there
    ridge(400, 5, 55, 0.5, 4.2); // nearer hills: a firmer silhouette

    // moons: real spheres, lit from one side (a gibbous phase), with darker
    // seas and a dimmed limb, so they read as worlds rather than paper discs
    const moon = (r: number, color: number, pos: THREE.Vector3, lightDir: THREE.Vector3, seed: number) => {
      const uColor = new THREE.Color(color);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 48, 24),
        new THREE.ShaderMaterial({
          fog: false,
          uniforms: { uColor: { value: uColor }, uL: { value: lightDir.normalize() }, uSeed: { value: seed } },
          vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV;
            void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; vec4 w = modelMatrix * vec4(position,1.0);
              vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
          fragmentShader: `uniform vec3 uColor; uniform vec3 uL; uniform float uSeed; varying vec3 vN; varying vec3 vP; varying vec3 vV;
            float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
            float vn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
              return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                         mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
            void main(){
              vec3 p = normalize(vP) * 3.0 + uSeed;
              float seas = smoothstep(0.45, 0.7, vn(p) * 0.65 + vn(p * 2.3) * 0.35);
              float grit = vn(p * 9.0) * 0.5 + vn(p * 21.0) * 0.5;
              float alb = (1.0 - seas * 0.38) * (0.82 + grit * 0.22);
              float lam = smoothstep(-0.08, 0.35, dot(normalize(vN), uL));
              float limb = 0.55 + 0.45 * pow(max(dot(normalize(vN), vV), 0.0), 0.5);
              vec3 c = uColor * alb * limb * (0.04 + 0.96 * lam);
              gl_FragColor = vec4(c, 1.0);
            }`,
        }),
      );
      m.position.copy(pos);
      scene.add(m);
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.12, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      halo.scale.setScalar(r * 3.6);
      halo.position.copy(pos);
      scene.add(halo);
      return { color: uColor };
    };
    // both lit by the same far sun, below the horizon to the east
    const farSun = new THREE.Vector3(0.9, -0.15, -0.35);
    this.bigMoon = moon(38, 0xe4e0d6, new THREE.Vector3(-180, 220, 420), farSun.clone(), 1.7);
    moon(16, 0xbfd6d0, new THREE.Vector3(120, 150, 450), farSun.clone(), 5.3);

    // ---------- Lights ----------
    this.hemi = new THREE.HemisphereLight(0x8d98b5, 0x2a2622, 1.2);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xc9d2e6, 1.5);
    this.sun.position.set(-40, 80, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -45;
    sc.right = sc.top = 45;
    sc.near = 1;
    sc.far = 220;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.camera.layers.enable(SHADOW_LAYER);
    scene.add(this.sun, this.sun.target);

    // ---------- Terrain ----------
    // 420 wide, and long enough north to hold the Basin and the Choir
    const geo = new THREE.PlaneGeometry(420, 580, 180, 248);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, 80);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    // per vertex: a tint (the region's colour language) and how much bare
    // dirt / burnt ground / pale Choir ash shows through the forest floor
    const colors = new Float32Array(pos.count * 3);
    const fx = new Float32Array(pos.count * 3);
    const base = new THREE.Color(0x9aa6a0);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
      const n = Math.sin(x * 0.08) * Math.cos(z * 0.06) * 0.5 + 0.5;
      c.copy(base).multiplyScalar(0.85 + n * 0.2);
      const arena = 1 - smoothstep(16, 26, Math.hypot(x - ARENA.x, z - ARENA.z));
      c.lerp(new THREE.Color(0xc07a70), arena * 0.7);
      const basin = 1 - smoothstep(50, 74, Math.hypot(x - BASIN_C.x, z - BASIN_C.z));
      c.lerp(new THREE.Color(0x6f98a8), basin * 0.85);
      if (x < BLACKWOOD_X) c.multiplyScalar(0.7); // the Blackwood floor is darker
      colors.set([c.r, c.g, c.b], i * 3);
      const f = floorFx(x, z);
      fx.set([f.dirt, f.scorch, f.choir], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("fx", new THREE.BufferAttribute(fx, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, groundMaterial());
    ground.receiveShadow = true;
    scene.add(ground);

    // (the skid scar is burnt ground in the terrain itself now)

    this.shardGlow = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: 0x6ac0d6,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const amb = this.buildAmbulance();
    this.ambulance = amb.group;
    this.doorL = amb.doorL;
    this.doorR = amb.doorR;
    this.interiorLight = amb.light;
    this.monitorMat = amb.monitor;
    this.axeProp = amb.axe;

    this.buildPlane();
    this.buildCrashDebris();
    this.buildLandmarks();
    this.buildOldCamp();
    this.buildWatch();
    this.buildShed();
    this.buildMicroStories();
    buildLitter(this.scene, heightAt, {
      trees: this.treeSpots.filter((t) => t.kind === 0),
      avoid: [
        { x: 0, z: 0, r: 6 }, { x: CAMP.x, z: CAMP.z, r: 6 }, { x: -14, z: 31, r: 14 }, { x: OLD_CAMP.x, z: OLD_CAMP.z, r: 9 },
        { x: STATION.x, z: STATION.z, r: 17 }, { x: ARENA.x, z: ARENA.z, r: 30 }, { x: SHED.x, z: SHED.z, r: 5 }, { x: SETTLEMENT.x, z: SETTLEMENT.z, r: 22 },
        { x: SCAR.x, z: SCAR.z, r: 9 },
      ],
      inside: (x, z) => Math.hypot(x, z - 20) < WORLD_RADIUS - 6 && Math.hypot(x - BASIN_C.x, z - BASIN_C.z) > 80,
    });
    const bea = this.buildBeacon();
    this.beaconLight = bea.light;
    this.beaconMat = bea.mat;
    this.buildForest();
    this.buildStation();
    // The station's own fire, by the collapsed tent: no flame left, the bed
    // still faintly alive. Whoever kept it left not long ago.
    const cold = new Fire({ size: 0.8, smoke: 1, logs: true, stones: true });
    cold.power = 0.015;
    cold.group.position.set(STATION.x - 6, heightAt(STATION.x - 6, STATION.z + 7), STATION.z + 7);
    scene.add(cold.group);
    this.colliders.push({ x: STATION.x - 6, z: STATION.z + 7, r: 0.9 });
    this.buildMast();
    this.buildMist();
    for (const p of PYLONS) this.pylons.push(this.buildPylon(p));
    const r = this.buildArena();
    this.rift = r.rift;
    this.riftMat = r.mat;
    this.riftLight = r.light;
    this.buildShards();
    this.buildCampfire();
    this.buildFallingPlane();
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0xcfeef5, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });

    // ---------- Particles ----------
    const sporeGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) sp.set([(Math.random() - 0.5) * 80, Math.random() * 20, (Math.random() - 0.5) * 80], i * 3);
    sporeGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.spores = new THREE.Points(
      sporeGeo,
      new THREE.PointsMaterial({ color: 0x8a9c96, size: 0.09, map: glowTexture(), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.spores.frustumCulled = false;
    scene.add(this.spores);

    const emberGeo = new THREE.BufferGeometry();
    this.emberData = new Float32Array(260 * 4); // x,y,z,life
    const ep = new Float32Array(260 * 3);
    emberGeo.setAttribute("position", new THREE.BufferAttribute(ep, 3));
    this.embers = new THREE.Points(
      emberGeo,
      new THREE.PointsMaterial({ color: 0xff8a3a, size: 0.22, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.embers.frustumCulled = false;
    // (each Fire spits its own sparks now; these stay out of the scene)
  }

  // ---------------------------------------------------------------- builders

  private buildAmbulance() {
    const a = buildAmbulance(glowTexture);
    this.roofLights.push(...a.roofLights);
    this.scene.add(a.group);
    this.cameraBlockers.push(a.group);
    return a;
  }

  private buildPlane() {
    // the same jet that fell, in pieces (scaled up a little: it reads as big up close)
    const K = 1.4;
    const W = wreckPieces();
    const place = (o: THREE.Object3D, x: number, z: number, ry: number, lift: number, tilt = 0) => {
      const holder = new THREE.Group();
      holder.add(o);
      holder.scale.setScalar(K);
      holder.position.set(x, heightAt(x, z) + lift, z);
      holder.rotation.set(0, ry, tilt);
      holder.traverse((m) => {
        if ((m as THREE.Mesh).isMesh) m.castShadow = m.receiveShadow = true;
      });
      this.scene.add(holder);
      return holder;
    };
    // aft cabin: nose toward +x, lying a little on its side
    const aft = W.piece(-4.6, 3.6);
    aft.position.z = -(-4.6 + 3.6) / 2;
    const aftH = place(aft, -21, 30, Math.PI / 2, 1.55, 0.12);
    this.cameraBlockers.push(aftH);
    for (let i = -4; i <= 4; i += 3) this.colliders.push({ x: -21 + i, z: 30, r: 2.4 });
    // the nose and cockpit, broken off and slewed round
    const nose = W.piece(3.6, 12);
    nose.position.z = -(3.6 + 12) / 2;
    const noseH = place(nose, -0.5, 37, Math.PI / 2 - 0.12, 1.5, -0.08);
    this.cameraBlockers.push(noseH);
    for (let i = -5; i <= 5; i += 3) this.colliders.push({ x: -0.5 + Math.cos(0.12) * i, z: 37 + Math.sin(0.12) * i, r: 2.3 });
    // the tail with its fin, nose-down in the dirt
    place(W.tail, -30.5, 30.5, Math.PI / 2 + 0.3, 0.6, -0.3);
    this.colliders.push({ x: -31, z: 30.5, r: 2.4 });
    // a wing, torn off at the root
    const wingH = place(W.wing, -27.5, 18.5, 0.35 + Math.PI, 0.25, 0.08);
    wingH.scale.setScalar(1.2);
    for (let i = -6; i <= 6; i += 2.5) this.colliders.push({ x: -22 + Math.cos(0.35) * i, z: 20.5 - Math.sin(0.35) * i, r: 1.4 });
    // an engine, thrown clear
    place(W.engine, -16, 17.5, 1.1, 0.45, 0.4).scale.setScalar(1.2);
    this.colliders.push({ x: -16, z: 17.5, r: 1.5 });

    // fires: burning fuel, black smoke
    for (const [x, z, s] of [[-15, 30, 1.4], [-16, 17.5, 1], [-1.8, 36, 1.1], [-3.5, 6, 0.5]] as const) {
      const fire = new Fire({ size: 1.8 * s, smoke: 2, light: 18 * s, lightRange: 22 });
      fire.group.position.set(x, heightAt(x, z) + 0.05, z);
      this.scene.add(fire.group);
      this.fires.push({ light: fire.light!, fire, base: 18 * s });
    }
  }

  /** What came out of the aircraft as it broke up, strewn along the line it
   *  slid (tail first, west; the nose last, east): torn skin, seats, luggage,
   *  the medical kit. Few things, each where it would have landed. */
  private buildCrashDebris() {
    const rand = rng(4242);
    const at = (o: THREE.Object3D, x: number, z: number, lift = 0) => {
      o.position.set(x, heightAt(x, z) + lift, z);
      o.traverse((m) => ((m as THREE.Mesh).isMesh && ((m.castShadow = true), (m.receiveShadow = true))));
      this.scene.add(o);
      return o;
    };
    // torn skin: bent aluminium sheets, painted side up or burnt side up, half dug in
    const paint = std(0x8c8a86, { roughness: 0.55, metalness: 0.35 });
    const burnt = std(0x1c1a18, { roughness: 1 });
    for (let i = 0; i < 16; i++) {
      const k = i / 15;
      const x = -29 + k * 26 + (rand() - 0.5) * 6;
      const z = 31 - k * 2 + (rand() - 0.5) * 9;
      if (Math.hypot(x + 21, z - 30) < 4.5) continue; // not inside the fuselage
      const w = 0.4 + rand() * 1.4;
      const g = new THREE.PlaneGeometry(w, 0.3 + rand() * 0.9, 4, 2);
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < pos.count; v++) pos.setZ(v, Math.sin(pos.getX(v) * 3 + i) * 0.08 * w); // buckled
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, rand() < 0.6 ? paint : burnt);
      (m.material as THREE.Material).side = THREE.DoubleSide;
      at(m, x, z, 0.12);
      m.rotation.set(-Math.PI / 2 + (rand() - 0.5) * 1.4, rand() * Math.PI, (rand() - 0.5) * 0.6);
    }
    // seats, thrown clear of the cabin
    const fabric = std(0x2a2e36, { roughness: 0.95 });
    const frame = std(0x55585c, { roughness: 0.5, metalness: 0.6 });
    const seat = () => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), fabric);
      base.position.y = 0.42;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.1), fabric);
      back.position.set(0, 0.78, -0.22);
      back.rotation.x = -0.15;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.04), frame);
      leg.position.set(0, 0.2, 0);
      g.add(base, back, leg);
      return g;
    };
    for (const [x, z, ry, rx, rz] of [
      [-24.5, 25.5, 0.6, 0, 0],
      [-13.5, 27.5, 2.4, -1.5, 0.2], // on its back
      [-9.8, 33.2, -0.9, 0, 1.45], // on its side
      [-18.2, 34.5, 1.9, 0, 0],
    ] as const) {
      const s = at(seat(), x, z);
      s.rotation.set(rx, ry, rz);
      if (rx || rz) s.position.y += 0.25;
    }
    // luggage: two cases shut, one burst open with clothes spilling
    const lug = (c: number, x: number, z: number, ry: number, open = false) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.42), std(c, { roughness: 0.75 }));
      body.position.y = 0.11;
      g.add(body);
      if (open) {
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.42), std(c, { roughness: 0.75 }));
        lid.position.set(0, 0.12, -0.38);
        lid.rotation.x = -2.2;
        g.add(lid);
        for (const [cx, cz, cc] of [[0.3, 0.45, 0x8a8478], [-0.2, 0.6, 0x3e4a5c], [0.5, 0.9, 0xa29a8c]] as const) {
          const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.35), std(cc, { roughness: 1, side: THREE.DoubleSide }));
          cloth.rotation.set(-Math.PI / 2, 0, cx * 3);
          cloth.position.set(cx, 0.02, cz);
          g.add(cloth);
        }
      }
      at(g, x, z).rotation.y = ry;
    };
    lug(0x2b3445, -15.2, 23.8, 0.4);
    lug(0x5a2a2a, -6.8, 30.5, 2.1, true);
    lug(0x4b4f52, -26.8, 34.2, -0.7);
    // the medical kit, cracked open; an oxygen bottle rolled into the grass; a blanket
    const kit = new THREE.Group();
    const kbody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.38), std(0xd8d6d0, { roughness: 0.6 }));
    kbody.position.y = 0.14;
    const crossMat = std(0x8c1c1c, { roughness: 0.7 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.005), crossMat);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.005), crossMat);
    c1.position.set(0, 0.16, 0.192);
    c2.position.copy(c1.position);
    kit.add(kbody, c1, c2);
    at(kit, -3.2, 29.6).rotation.set(0, 0.8, 0.12);
    const o2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.75, 14), std(0x2c6a3c, { roughness: 0.4, metalness: 0.3 }));
    at(o2, -11.5, 21.2, 0.09).rotation.set(0, 0.5, Math.PI / 2);
    const blanket = new THREE.PlaneGeometry(1.5, 1.1, 6, 4);
    const bp = blanket.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < bp.count; v++) bp.setZ(v, Math.sin(bp.getX(v) * 4) * Math.cos(bp.getY(v) * 5) * 0.05);
    blanket.computeVertexNormals();
    const bl = new THREE.Mesh(blanket, std(0x4b5f7a, { roughness: 1, side: THREE.DoubleSide }));
    at(bl, -8.6, 24.3, 0.04).rotation.set(-Math.PI / 2, 0, 1.1);

    // the trees it went through: snapped at head height, their tops thrown down along the slide
    const bark = new THREE.TextureLoader().load(barkUrl);
    bark.colorSpace = THREE.SRGBColorSpace;
    bark.wrapS = bark.wrapT = THREE.RepeatWrapping;
    bark.repeat.set(1, 2);
    const wood = std(0x6a5c4e, { roughness: 1, map: bark });
    const raw = std(0x8a7458, { roughness: 1 }); // broken wood, weathered a little
    for (const [x, z, h, fall] of [[-33, 24.5, 2.8, 0.3], [-24, 41.5, 3.4, -0.2], [-15, 23, 2.2, 0.5], [-6, 42.5, 3, -0.4], [-28, 23, 1.6, 0.2]] as const) {
      const g = new THREE.Group();
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, h, 9), wood);
      stump.position.y = h / 2;
      g.add(stump);
      // the break: splinters of pale wood at different heights, leaning out
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + x;
        const len = 0.25 + ((k * 37 + Math.round(z)) % 10) / 14;
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.07, len, 0.05), k % 3 ? raw : wood);
        sp.position.set(Math.cos(a) * 0.2, h + len / 2 - 0.05, Math.sin(a) * 0.2);
        sp.rotation.set(Math.sin(a) * 0.35, a, -Math.cos(a) * 0.35);
        g.add(sp);
      }
      at(g, x, z);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 7, 8), wood);
      top.rotation.set(Math.PI / 2, 0, fall);
      at(top, x + 3.2, z + Math.sign(31 - z) * -1.5, 0.3).rotation.y = 1.4 + fall;
      this.colliders.push({ x, z, r: 0.5 });
    }
    // a stretcher, folded in half against the ground
    const strG = new THREE.Group();
    const alu = std(0xb8bcc0, { metalness: 0.7, roughness: 0.35 });
    for (const [ry, dz] of [[0, 0], [0.7, 0.9]] as const) {
      const half = new THREE.Group();
      for (const x of [-0.27, 0.27]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), alu);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(x, 0.05, 0);
        half.add(rail);
      }
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.95), std(0x2b3f57, { roughness: 0.9 }));
      pad.position.y = 0.07;
      half.add(pad);
      half.rotation.x = ry;
      half.position.z = dz;
      strG.add(half);
    }
    at(strG, -20, 33.5).rotation.y = 0.6;
    // a landing light torn off the wing, its glass cracked
    const lamp = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 14), std(0x9a9da0, { metalness: 0.6, roughness: 0.4 }));
    housing.rotation.x = Math.PI / 2 - 0.3;
    const lensG = new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), std(0x22282c, { roughness: 0.1, metalness: 0.4 }));
    lensG.position.z = 0.12;
    lensG.rotation.x = -0.3;
    lamp.add(housing, lensG);
    at(lamp, -25, 36.5, 0.12).rotation.y = 2.2;
    // paper: the flight's documents, blown out and caught in the grass
    const paper = std(0xd8d2c4, { roughness: 1, side: THREE.DoubleSide });
    const pr = rng(31);
    for (let i = 0; i < 10; i++) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), paper);
      at(sh, -12 + pr() * 9, 31 + (pr() - 0.5) * 6, 0.03 + pr() * 0.04).rotation.set(-Math.PI / 2 + (pr() - 0.5) * 0.4, 0, pr() * 6);
    }
    // a second oxygen bottle, and a dark stain by the seat on its back
    const o2b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.75, 14), std(0x2c6a3c, { roughness: 0.4, metalness: 0.3 }));
    at(o2b, -19, 29, 0.09).rotation.set(0, -0.4, Math.PI / 2);
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12), std(0x2a0a08, { roughness: 0.6, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    stain.scale.set(1, 0.6, 1);
    at(stain, -13.2, 26.8, 0.035).rotation.set(-Math.PI / 2, 0, 0.5);
    // boots, from the cockpit out into the trees: somebody walked away from this
    this.prints([[-1, 39], [3, 44], [6, 49], [9, 55], [11, 61]], true);
  }

  /** Put something on the ground at a world point (casting and taking shadow). */
  private put(o: THREE.Object3D, x: number, z: number, lift = 0) {
    o.position.set(x, heightAt(x, z) + lift, z);
    o.traverse((m) => ((m as THREE.Mesh).isMesh && ((m.castShadow = true), (m.receiveShadow = true))));
    this.scene.add(o);
    return o;
  }

  /** Footprints along a line, alternating feet (bare or booted). */
  private prints(pts: [number, number][], boot: boolean, col = 0x1e1a16) {
    const geo = new THREE.CircleGeometry(0.5, 10);
    geo.rotateX(-Math.PI / 2);
    const out: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const yaw = Math.atan2(bx - ax, bz - az);
      const n = Math.floor(len / 0.7);
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const side = (out.length % 2 ? 1 : -1) * 0.13;
        const x = ax + (bx - ax) * t + Math.cos(yaw) * side;
        const z = az + (bz - az) * t - Math.sin(yaw) * side;
        q.setFromAxisAngle(up, yaw);
        m.compose(new THREE.Vector3(x, heightAt(x, z) + 0.035, z), q, new THREE.Vector3(boot ? 0.24 : 0.2, 1, boot ? 0.58 : 0.5));
        out.push(m.clone());
      }
    }
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 1, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), out.length);
    out.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.receiveShadow = true;
    this.scene.add(im);
  }

  /** Past the Dead Tree: a Meridian shed of corrugated sheet. One bed in it,
   *  facing the back wall. The wall is cut with hundreds of marks; one of them
   *  is newer than the rest. A monitor in the corner is still on standby: from
   *  the path it looks like somebody's light. */
  private buildShed() {
    const C = SHED;
    const g = new THREE.Group();
    const sheet = new THREE.MeshStandardMaterial({ color: 0x6b6862, map: corrugatedTex(), roughness: 0.7, metalness: 0.55, side: THREE.DoubleSide });
    const W = 3.2, H = 2.5, D = 3.8;
    const wall = (w: number, h: number, x: number, z: number, ry: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), sheet);
      m.position.set(x, h / 2, z);
      m.rotation.y = ry;
      g.add(m);
      return m;
    };
    wall(D, H, -W / 2, 0, Math.PI / 2);
    wall(D, H, W / 2, 0, Math.PI / 2);
    wall(W, H, 0, -D / 2, 0);
    // the front: half a wall, the door gone
    wall(0.9, H, -W / 2 + 0.45, D / 2, 0);
    wall(0.9, H, W / 2 - 0.45, D / 2, 0);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, D + 0.4), sheet);
    roof.rotation.x = -Math.PI / 2;
    roof.position.y = H;
    g.add(roof);
    // the marks, on the inside of the back wall
    const marks = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, H - 0.4), new THREE.MeshStandardMaterial({ map: wallMarksTex(), transparent: true, roughness: 0.8, metalness: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    marks.position.set(0, H / 2 + 0.1, -D / 2 + 0.02);
    g.add(marks);
    // the bed, its foot to the wall: whoever lay here looked at the marks
    const steel = std(0x5c5a56, { metalness: 0.7, roughness: 0.6 });
    const bed = new THREE.Group();
    const mattress = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.14, 1.95, 2, 0.05), std(0x77736a, { roughness: 1 }));
    mattress.position.y = 0.62;
    bed.add(mattress);
    for (const x of [-0.42, 0.42]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.95, 6), steel);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, 0.74, 0);
      bed.add(rail);
      for (const z of [-0.9, 0.9]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), steel);
        leg.position.set(x, 0.3, z);
        bed.add(leg);
      }
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.5, 0.04), steel);
    head.position.set(0, 0.85, 0.97);
    bed.add(head);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 4, 14), std(0xd6d2c8, { roughness: 0.8 }));
    band.position.set(0.42, 0.74, 0.35);
    band.rotation.y = Math.PI / 2;
    bed.add(band);
    bed.position.set(0, 0, 0.4);
    g.add(bed);
    // IV pole, the bag long empty
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.9, 6), steel);
    pole.position.set(-0.8, 0.95, 0.9);
    const bag = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.2, 0.03, 2, 0.012), new THREE.MeshStandardMaterial({ color: 0xc8d4d8, transparent: true, opacity: 0.45, roughness: 0.2 }));
    bag.position.set(-0.8, 1.75, 0.9);
    bag.scale.y = 0.6; // flat: emptied
    g.add(pole, bag);
    // a monitor on a stand, rusted, still on standby
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), steel);
    stand.position.set(1.1, 0.55, 0.9);
    const mon = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.32, 0.18, 2, 0.02), std(0x5a4636, { roughness: 0.9, metalness: 0.4 }));
    mon.position.set(1.1, 1.25, 0.9);
    mon.rotation.y = -0.6;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshStandardMaterial({ color: 0x050806, emissive: 0x4fa86a, emissiveIntensity: 0.2, emissiveMap: textTex(["", "", "", "            standby", "", ""], 256, 192, "#060a07", "#5f9a6c") }));
    scr.position.set(1.1 - Math.sin(0.6) * 0.092, 1.25, 0.9 + Math.cos(0.6) * 0.092);
    scr.rotation.y = -0.6;
    g.add(stand, mon, scr);
    const glow = new THREE.PointLight(0x7fd09a, 0.9, 6, 2);
    glow.position.set(0.9, 1.3, 1.2);
    g.add(glow);
    this.shedScreen = scr.material as THREE.MeshStandardMaterial;
    this.shedLight = glow;
    // the doorway faces the path from the Dead Tree
    g.rotation.y = Math.atan2(DEAD_TREE.x - C.x, DEAD_TREE.z - C.z);
    this.put(g, C.x, C.z);
    for (const [dx, dz] of [[-1.6, 0], [1.6, 0], [0, -1.9]]) this.colliders.push({ x: C.x + dx, z: C.z + dz, r: 1.1 });
  }

  /** Stories that take a few seconds to understand, and that nobody explains. */
  private buildMicroStories() {
    // 1. A pack against a dead trunk, a broken torch beside it. Two people came
    //    here. One left.
    {
      const [x, z] = MICRO.pack;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 2.6, 9), std(0x3a332c, { roughness: 1 }));
      this.put(trunk, x, z, 1.25);
      const pack = new THREE.Group();
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.55, 0.22, 2, 0.06), std(0x3e4434, { roughness: 1 }));
      body.position.y = 0.28;
      body.rotation.x = -0.25;
      pack.add(body);
      this.put(pack, x + 0.1, z + 0.45).rotation.y = 0.2;
      const torch = new THREE.Group();
      const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 10), std(0x22252a, { metalness: 0.5, roughness: 0.4 }));
      tb.rotation.z = Math.PI / 2;
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.032, 10), std(0x8a9096, { roughness: 0.2, metalness: 0.3 }));
      lens.position.x = 0.112;
      lens.rotation.y = Math.PI / 2;
      torch.add(tb, lens);
      this.put(torch, x + 0.7, z + 0.6, 0.03).rotation.y = 0.8;
      this.prints([[x + 6, z + 7], [x + 2.5, z + 3], [x + 0.6, z + 0.9]], true); // in
      this.prints([[x + 5.5, z - 5], [x + 2, z - 2], [x + 0.6, z + 0.4]], true); // in
      this.prints([[x - 0.2, z + 0.5], [x - 4, z + 2.5], [x - 9, z + 3]], true); // and out: one
    }
    // 2. A cold fire. Two cups. One seat. A medical bag nobody came back for.
    {
      const [x, z] = MICRO.cups;
      const f = new Fire({ size: 0.6, logs: true, stones: true });
      f.lit = false;
      this.put(f.group, x, z);
      const tin = std(0x7a7470, { metalness: 0.6, roughness: 0.5 });
      for (const [dx, dz] of [[0.75, 0.3], [-0.55, 0.62]]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 10), tin);
        this.put(cup, x + dx, z + dz, 0.045);
      }
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.42, 10), std(0x4a3d32, { roughness: 1 }));
      this.put(seat, x + 1.1, z + 0.5, 0.21);
      const bag = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.22, 0.24, 2, 0.04), std(0x6e2a24, { roughness: 0.9 }));
      this.put(bag, x - 0.9, z - 0.7, 0.11).rotation.y = 0.9;
      this.colliders.push({ x, z, r: 0.7 });
    }
    // 3. A small grave. No name on it.
    {
      const [x, z] = MICRO.grave;
      const gr = new THREE.Group();
      const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(0x3a3128, { roughness: 1 }));
      mound.scale.set(0.35, 0.12, 0.6);
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 6), std(0x2e2620, { roughness: 1 }));
      stake.position.set(0, 0.27, -0.66);
      gr.add(mound, stake);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07 + (i % 3) * 0.02, 0), std(0x6c6a66, { roughness: 1 }));
        st.position.set(Math.cos(a) * 0.42, 0.04, Math.sin(a) * 0.7);
        gr.add(st);
      }
      this.put(gr, x, z).rotation.y = 0.4;
    }
  }

  /** The Old Camp, at the edge of the Blackwood: people lived here, for a
   *  while. Everything in it is something they left. */
  private buildOldCamp() {
    const C = OLD_CAMP;
    const at = (o: THREE.Object3D, dx: number, dz: number, lift = 0) => {
      const x = C.x + dx;
      const z = C.z + dz;
      o.position.set(x, heightAt(x, z) + lift, z);
      o.traverse((m) => ((m as THREE.Mesh).isMesh && ((m.castShadow = true), (m.receiveShadow = true))));
      this.scene.add(o);
      return o;
    };
    const wood = std(0x4a3d32, { roughness: 1 });
    const darkWood = std(0x2e2620, { roughness: 1 });
    const canvasMat = std(0x45463a, { roughness: 1, side: THREE.DoubleSide });
    const stick = (len: number, r = 0.035, mat = wood) => new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, len, 6), mat);

    // the fire they kept: cold for a long time
    const cold = new Fire({ size: 0.9, logs: true, stones: true });
    cold.lit = false;
    at(cold.group, 0, 0);
    this.colliders.push({ x: C.x, z: C.z, r: 0.9 });

    // bedrolls round it, and a lean-to over two of them
    const roll = (c: number) => {
      const g = new THREE.Group();
      const mat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 1.9), std(c, { roughness: 1 }));
      mat.position.y = 0.03;
      const rolled = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.75, 10), std(c, { roughness: 1 }));
      rolled.rotation.z = Math.PI / 2;
      rolled.position.set(0, 0.13, -0.85);
      g.add(mat, rolled);
      return g;
    };
    for (const [dx, dz, ry, c] of [[-2.6, 2.2, 0.9, 0x3c4a5a], [-3.4, -0.4, 1.5, 0x5a4a3c], [2.4, -1.8, -0.6, 0x4a4f3a]] as const) at(roll(c), dx, dz).rotation.y = ry;
    const lean = new THREE.Group();
    const p1 = stick(1.8, 0.05);
    p1.position.set(-1, 0.9, 0);
    const p2 = stick(1.8, 0.05);
    p2.position.set(1, 0.9, 0);
    const tarp = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.3, 4, 4), canvasMat);
    tarp.rotation.x = -1.05;
    tarp.position.set(0, 0.95, 0.75);
    lean.add(p1, p2, tarp);
    at(lean, -3.1, 1.2).rotation.y = 1.2;
    // a battery lantern hung from the lean-to, nearly dead. Still on.
    const lantern = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 10), std(0x3a3d40, { metalness: 0.5, roughness: 0.6 }));
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0x222018, emissive: 0xffe2a8, emissiveIntensity: 0.6 }));
    glass.position.y = 0.02;
    this.lanternGlass = glass.material as THREE.MeshStandardMaterial;
    this.lanternLight = new THREE.PointLight(0xffe2b0, 3.2, 13, 1.7);
    this.lanternLight.position.y = -0.05;
    lantern.add(body, glass, this.lanternLight);
    at(lantern, -3.1 + Math.cos(1.2) * 0.9, 1.2 - Math.sin(1.2) * 0.9, 1.55);
    // a cot of lashed branches, a name cut into the frame
    const cot = new THREE.Group();
    for (const x of [-0.35, 0.35]) {
      const rail = stick(1.9, 0.045);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, 0.32, 0);
      cot.add(rail);
      for (const z of [-0.85, 0.85]) {
        const leg = stick(0.34, 0.04, darkWood);
        leg.position.set(x, 0.16, z);
        cot.add(leg);
      }
    }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 1.8), std(0x6a6450, { roughness: 1 }));
    bed.position.y = 0.36;
    const name = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14), new THREE.MeshStandardMaterial({ map: textTex(["0217"], 256, 84, "#3a2f26", "#b8ab94"), roughness: 1 }));
    name.position.set(0, 0.32, 0.951);
    cot.add(bed, name);
    at(cot, OC.cot[0], OC.cot[1]).rotation.y = -0.4;
    // a post with wristbands nailed to it, one above another
    const post = new THREE.Group();
    const pole = stick(1.7, 0.07, darkWood);
    pole.position.y = 0.85;
    post.add(pole);
    for (let i = 0; i < 7; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 4, 14), std(i % 3 ? 0xc8c2b4 : 0xb8b0a0, { roughness: 0.8 }));
      band.position.set(0, 0.45 + i * 0.16, 0.07);
      band.rotation.set(0.2 * Math.sin(i), 0, 0.4 * Math.cos(i * 2));
      post.add(band);
    }
    at(post, OC.post[0], OC.post[1]);
    this.colliders.push({ x: C.x + OC.post[0], z: C.z + OC.post[1], r: 0.25 });
    // the tally board: a plank on two stakes, cut with hundreds of marks
    const board = new THREE.Group();
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.05), new THREE.MeshStandardMaterial({ map: tallyTex(), roughness: 1 }));
    plank.position.y = 0.95;
    for (const x of [-0.6, 0.6]) {
      const st = stick(1.4, 0.05, darkWood);
      st.position.set(x, 0.7, -0.04);
      board.add(st);
    }
    board.add(plank);
    at(board, OC.board[0], OC.board[1]).rotation.y = 0.7;
    this.colliders.push({ x: C.x + OC.board[0], z: C.z + OC.board[1], r: 0.6 });
    // three graves in a row: mounds, stakes, tags. The last tag is blank.
    ["0217", "0891", ""].forEach((tag, i) => {
      const g = new THREE.Group();
      const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(0x3a3128, { roughness: 1 }));
      mound.scale.set(0.5, 0.18, 1.0);
      const stake = stick(0.9, 0.04, darkWood);
      stake.position.set(0, 0.45, -1.05);
      const cross = stick(0.4, 0.03, darkWood);
      cross.rotation.z = Math.PI / 2;
      cross.position.set(0, 0.68, -1.05);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.08), new THREE.MeshStandardMaterial({ map: textTex([tag || " "], 128, 52, "#8c8a84", "#2a2622"), roughness: 0.6, metalness: 0.4 }));
      plate.position.set(0, 0.55, -1.02);
      g.add(mound, stake, cross, plate);
      at(g, OC.graves[0] + (i - 1) * 1.4, OC.graves[1]).rotation.y = Math.PI;
    });
    // a medical bag, stencilled with somebody else's number
    const bag = new THREE.Group();
    const bb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.24, 0.26), new THREE.MeshStandardMaterial({ color: 0x6e2a24, roughness: 0.9 }));
    bb.position.y = 0.12;
    const sten = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.1), new THREE.MeshStandardMaterial({ map: textTex(["PATIENT 0432"], 256, 76, "rgba(0,0,0,0)", "#d8d2c8"), transparent: true, roughness: 0.9 }));
    sten.position.set(0, 0.14, 0.131);
    bag.add(bb, sten);
    at(bag, OC.bag[0], OC.bag[1]).rotation.y = 0.5;
    // a hospital gown left drying on a line between two stakes
    const line = new THREE.Group();
    for (const x of [-1.3, 1.3]) {
      const st = stick(1.6, 0.04, darkWood);
      st.position.set(x, 0.8, 0);
      line.add(st);
    }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 2.6, 4), std(0x8a8270));
    rope.rotation.z = Math.PI / 2;
    rope.position.y = 1.5;
    const gown = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.95, 3, 4), std(0x8fa6b4, { roughness: 1, side: THREE.DoubleSide }));
    gown.position.set(0.2, 1.02, 0);
    gown.rotation.y = 0.15;
    line.add(rope, gown);
    at(line, 4.6, 2.4).rotation.y = -1.1;
    // a shelter they started and never finished: four poles, two crossbars
    const frame = new THREE.Group();
    for (const [x, z] of [[-1, -0.8], [1, -0.8], [-1, 0.8], [1, 0.8]]) {
      const pole = stick(2, 0.05, darkWood);
      pole.position.set(x, 1, z);
      pole.rotation.z = x * 0.04;
      frame.add(pole);
    }
    for (const z of [-0.8, 0.8]) {
      const bar = stick(2.1, 0.04);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 1.85, z);
      frame.add(bar);
    }
    // a shirt hung on the crossbar to dry, never taken down
    const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.7, 3, 3), std(0x6d6658, { roughness: 1, side: THREE.DoubleSide }));
    shirt.position.set(0.3, 1.5, 0.8);
    frame.add(shirt);
    at(frame, 5.6, -3.8).rotation.y = 0.3;
    // a pot hung over the cold fire on a tripod of sticks
    const tri = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = stick(1.5, 0.03, darkWood);
      leg.position.set(Math.cos(a) * 0.35, 0.7, Math.sin(a) * 0.35);
      leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
      tri.add(leg);
    }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.18, 12, 1, true), std(0x2a2826, { metalness: 0.6, roughness: 0.6, side: THREE.DoubleSide }));
    pot.position.y = 0.6;
    tri.add(pot);
    at(tri, 0, 0);
    // a water canister, a number stencilled on its side
    const can = new THREE.Group();
    const cb = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.46, 0.16, 2, 0.03), std(0x3e4a3a, { roughness: 0.7, metalness: 0.2 }));
    cb.position.y = 0.23;
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.09), new THREE.MeshStandardMaterial({ map: textTex(["0891"], 192, 66, "rgba(0,0,0,0)", "#d8d2c8"), transparent: true, roughness: 0.8 }));
    cs.position.set(0, 0.25, 0.082);
    can.add(cb, cs);
    at(can, OC.can[0], OC.can[1]).rotation.y = -0.5;
    // a name on a sleeping place
    const tagR = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshStandardMaterial({ map: textTex(["MARA 4012"], 256, 84, "#c8c2b4", "#2a2622"), roughness: 1, side: THREE.DoubleSide }));
    at(tagR, OC.roll[0], OC.roll[1], 0.07).rotation.set(-Math.PI / 2, 0, 0.9);
    // a radio, its case split, the dial gone
    const radio = new THREE.Group();
    const rb = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.18, 0.12, 2, 0.02), std(0x2a2c2e, { roughness: 0.6 }));
    rb.position.y = 0.09;
    rb.rotation.z = 0.08;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.45, 4), std(0x8a8c8e, { metalness: 0.8 }));
    ant.position.set(0.1, 0.32, 0);
    ant.rotation.z = -0.9;
    radio.add(rb, ant);
    at(radio, 1.7, 3.8).rotation.y = 0.4;
    // a note pinned under a stone
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.26), new THREE.MeshStandardMaterial({ map: textTex(["", "wait for", "hundred", ""], 128, 160, "#cfc8b6", "#3a3530"), roughness: 1 }));
    at(note, OC.note[0], OC.note[1], 0.025).rotation.set(-Math.PI / 2, 0, 0.3);
    const pin = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07, 0), std(0x6c6a66, { roughness: 1 }));
    at(pin, OC.note[0] + 0.05, OC.note[1] - 0.08, 0.04);
    // a spear leaning on the lean-to, a coil of rope, a snare at the trees
    const spear = stick(2.1, 0.022, darkWood);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 6), std(0x9a9c9e, { metalness: 0.7, roughness: 0.4 }));
    tip.position.y = 1.12;
    spear.add(tip);
    at(spear, -2.2, 2.6, 1.0).rotation.set(0.35, 0, 0.1);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 18), std(0x8a7a5a, { roughness: 1 }));
    at(coil, -1.5, 3.3, 0.02).rotation.x = Math.PI / 2;
    const snare = new THREE.Group();
    const peg = stick(0.5, 0.015, darkWood);
    peg.position.y = 0.2;
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.004, 4, 16), std(0x9a9488));
    loop.position.set(0.12, 0.08, 0);
    loop.rotation.y = Math.PI / 2;
    snare.add(peg, loop);
    at(snare, 7.2, 4.5);
    // something buried, a corner of a box showing through the dirt
    const buried = new THREE.Group();
    const dm = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), std(0x3a3128, { roughness: 1 }));
    dm.scale.set(0.6, 0.15, 0.45);
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.25), std(0x4d5247, { roughness: 0.7 }));
    corner.position.set(0.18, 0.08, 0.05);
    corner.rotation.set(0.3, 0.5, 0.2);
    buried.add(dm, corner);
    at(buried, -5.2, 5.4);
    // tins and a cup by the fire
    for (const [dx, dz] of [[0.9, 0.6], [1.1, 0.35], [-0.8, 1.0]] as const) {
      const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 10), std(0x7a7470, { metalness: 0.6, roughness: 0.5 }));
      at(tin, dx, dz, 0.05);
    }
  }

  /** The Watch: Meridian's post at the field station. A camera on a tripod,
   *  aimed west at the crash, and the desk where somebody kept the log. */
  private buildWatch() {
    const S = STATION;
    const at = (o: THREE.Object3D, d: readonly [number, number], lift = 0) => {
      const x = S.x + d[0];
      const z = S.z + d[1];
      o.position.set(x, heightAt(x, z) + lift, z);
      o.traverse((m) => ((m as THREE.Mesh).isMesh && ((m.castShadow = true), (m.receiveShadow = true))));
      this.scene.add(o);
      return o;
    };
    const metal = std(0x2c2f33, { roughness: 0.5, metalness: 0.7 });
    const tri = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.5, 5), metal);
      leg.position.set(Math.cos(a) * 0.25, 0.72, Math.sin(a) * 0.25);
      leg.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18);
      tri.add(leg);
    }
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.2), metal);
    cam.position.y = 1.5;
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.16, 12), std(0x111214, { roughness: 0.2, metalness: 0.5 }));
    lens.rotation.z = Math.PI / 2;
    lens.position.set(-0.24, 1.5, 0);
    const rec = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), new THREE.MeshBasicMaterial({ color: 0x8a1a14 }));
    rec.position.set(-0.05, 1.62, 0.08);
    tri.add(cam, lens, rec);
    // aimed west, toward where the plane came down
    at(tri, WATCH.camera).rotation.y = Math.atan2(0, 1) - 0.12;
    const desk = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.7), std(0x55585c, { metalness: 0.4, roughness: 0.6 }));
    top.position.y = 0.76;
    desk.add(top);
    for (const [x, z] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.76, 5), metal);
      leg.position.set(x, 0.38, z);
      desk.add(leg);
    }
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.04), std(0x1a1c1f, { roughness: 0.4 }));
    screen.position.set(-0.25, 0.98, -0.2);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.28), new THREE.MeshBasicMaterial({ map: textTex(["FEED 03  ·  FALLSITE", "NO SIGNAL"], 256, 156, "#0a0d0e", "#5f7f80") }));
    glass.position.set(-0.25, 0.98, -0.178);
    const clip = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), new THREE.MeshStandardMaterial({ map: textTex(["OBSERVATION LOG", "", "03:12  TRANSIT", "03:14  ARRIVED", "03:20  KEEP WATCHING"], 192, 256, "#d6d0c2", "#2a2724"), roughness: 1 }));
    clip.rotation.x = -Math.PI / 2;
    clip.position.set(0.3, 0.79, 0.05);
    desk.add(screen, glass, clip);
    at(desk, WATCH.desk).rotation.y = Math.PI / 2;
    this.colliders.push({ x: S.x + WATCH.desk[0], z: S.z + WATCH.desk[1], r: 0.8 });

    // the lookout: a cabin on steel legs, its windows facing the crash, a camera
    // pod on the rail. Someone built this to watch one place.
    const look = new THREE.Group();
    const lsteel = std(0x3a3d40, { metalness: 0.6, roughness: 0.5 });
    const L = 9;
    for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, L, 6), lsteel);
      leg.position.set(x * 1.15, L / 2, z * 1.15);
      leg.rotation.set(-z * 0.03, 0, x * 0.03);
      look.add(leg);
    }
    for (let k = 1; k < 4; k++) {
      const y = (k / 4) * L;
      for (const [x, z, ry] of [[0, -1.42, 0], [0, 1.42, 0], [-1.42, 0, Math.PI / 2], [1.42, 0, Math.PI / 2]] as const) {
        const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4, 5), lsteel);
        brace.rotation.set(0, ry, Math.PI / 2 + (k % 2 ? 0.7 : -0.7));
        brace.position.set(x, y, z);
        look.add(brace);
      }
    }
    const cab = new THREE.Mesh(new RoundedBoxGeometry(3.4, 2.2, 3.4, 2, 0.06), new THREE.MeshStandardMaterial({ color: 0x5d625e, map: corrugatedTex(), roughness: 0.75, metalness: 0.4 }));
    cab.position.y = L + 1.1;
    const lroof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 0.7, 4), lsteel);
    lroof.rotation.y = Math.PI / 4;
    lroof.position.y = L + 2.55;
    look.add(cab, lroof);
    // the window toward the crash: one lamp still flickers behind it
    // its own lamp, dimmer than the station's, stuttering with it
    this.lookoutWin = new THREE.MeshStandardMaterial({ color: 0x0a0c10, emissive: 0xdfe8ff, emissiveIntensity: 0.5 });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.8), this.lookoutWin);
    win.position.set(-1.71, L + 1.35, 0);
    win.rotation.y = -Math.PI / 2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 4.2), lsteel);
    deck.position.y = L - 0.05;
    look.add(win, deck);
    const pod = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.3, 0.3, 2, 0.05), std(0xd4d6d2, { roughness: 0.4 }));
    pod.position.set(-1.9, L + 2.1, 1.3);
    const podLens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 12), std(0x111214, { roughness: 0.2 }));
    podLens.rotation.z = Math.PI / 2;
    podLens.position.set(-2.18, L + 2.1, 1.3);
    look.add(pod, podLens);
    // a ladder up one leg
    for (let y = 0.4; y < L; y += 0.4) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), lsteel);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(1.5, y, 1.75);
      look.add(rung);
    }
    // its window looks east: toward the crash (east is -x)
    const lx = S.x - 4;
    const lz = S.z - 11;
    look.position.set(lx, heightAt(lx, lz), lz);
    look.traverse((m) => ((m as THREE.Mesh).isMesh && ((m.castShadow = true), (m.receiveShadow = true))));
    this.scene.add(look);
    for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) this.colliders.push({ x: lx + x, z: lz + z, r: 0.3 });
  }

  /** Two places to remember the way by. */
  private buildLandmarks() {
    // ---- the Dead Tree: one enormous trunk, bleached grey, leafless, twisting
    // up out of the canopy. Branches by recursion, merged into one mesh.
    const rand = rng(77);
    const parts: THREE.BufferGeometry[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const limb = (from: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, depth: number) => {
      const r1 = r0 * 0.62;
      const g = new THREE.CylinderGeometry(r1, r0, len, depth > 1 ? 9 : 6, 1);
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
      g.translate(from.x, from.y, from.z);
      parts.push(g.index ? g.toNonIndexed() : g);
      const tip = from.clone().addScaledVector(dir, len);
      if (depth >= 4 || r1 < 0.05) return;
      const n = depth === 0 ? 4 : 2 + Math.floor(rand() * 2);
      for (let i = 0; i < n; i++) {
        const d = dir.clone()
          .add(new THREE.Vector3((rand() - 0.5) * 1.5, (rand() - 0.15) * 0.7, (rand() - 0.5) * 1.5))
          .normalize();
        const at = depth === 0 ? from.clone().addScaledVector(dir, len * (0.55 + i * 0.13)) : tip;
        limb(at, d, len * (0.55 + rand() * 0.2), depth === 0 ? r0 * 0.42 : r1, depth + 1);
      }
      if (depth === 0) limb(tip, dir.clone().add(new THREE.Vector3(0.15, 0, -0.1)).normalize(), len * 0.45, r1, depth + 1);
    };
    limb(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0.05, 1, 0.08).normalize(), 15, 1.25, 0);
    // roots flaring into the ground
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      limb(new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(Math.cos(a), -0.75, Math.sin(a)).normalize(), 1.9, 0.7, 3);
    }
    const geo = mergeGeometries(parts);
    // real bark, bleached: the oak scan tinted the grey of something long dead
    const bark = new THREE.TextureLoader().load(barkUrl);
    bark.colorSpace = THREE.SRGBColorSpace;
    bark.wrapS = bark.wrapT = THREE.RepeatWrapping;
    bark.repeat.set(2, 6);
    const tree = new THREE.Mesh(geo, std(0x8c8984, { roughness: 1, map: bark }));
    tree.position.copy(DEAD_TREE);
    tree.scale.setScalar(1.4); // a head taller than anything around it
    tree.castShadow = true;
    tree.receiveShadow = true;
    this.scene.add(tree);
    this.colliders.push({ x: DEAD_TREE.x, z: DEAD_TREE.z, r: 1.6 });
    // at its roots, an old Meridian tag on a wire, rusted through: long before tonight
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.09), new THREE.MeshStandardMaterial({ map: textTex(["9843"], 128, 72, "#6b4a32", "#2a1a10"), roughness: 0.9, metalness: 0.3, side: THREE.DoubleSide }));
    const tx = DEAD_TREE.x + DEAD_TAG[0];
    const tz = DEAD_TREE.z + DEAD_TAG[1];
    tag.position.set(tx, heightAt(tx, tz) + 0.04, tz);
    tag.rotation.set(-Math.PI / 2 + 0.2, 0, 0.6);
    this.scene.add(tag);

    // ---- the Blue Scar: cracked ground, a cold light down in the cracks,
    // stones lifted a hand's width off the earth, turning very slowly
    // a cold low mist sits on the scar and doesn't drift with the rest
    const scarMist = new THREE.SpriteMaterial({ map: glowTexture(), color: 0x8fb4c0, transparent: true, opacity: 0.1, depthWrite: false });
    for (const [dx, dz, sc] of [[0, 0, 13], [-4, 3, 9], [4, -3, 10]]) {
      const ms = new THREE.Sprite(scarMist);
      ms.scale.set(sc, sc * 0.22, 1);
      ms.position.set(SCAR.x + dx, heightAt(SCAR.x + dx, SCAR.z + dz) + 0.7, SCAR.z + dz);
      this.scene.add(ms);
    }
    const crackMat = new THREE.MeshBasicMaterial({ color: 0x5fb8c8, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
    const cr = rng(9);
    for (let i = 0; i < 44; i++) {
      const a = cr() * Math.PI * 2;
      const d = Math.sqrt(cr()) * 8;
      const x = SCAR.x + Math.cos(a) * d;
      const z = SCAR.z + Math.sin(a) * d;
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.06 + cr() * 0.12, 1 + cr() * 3.2), crackMat);
      c.rotation.set(-Math.PI / 2, 0, cr() * Math.PI);
      c.position.set(x, heightAt(x, z) + 0.03, z);
      this.scene.add(c);
    }
    const stone = std(0x3c3d42, { roughness: 0.9 });
    for (let i = 0; i < 7; i++) {
      const a = cr() * Math.PI * 2;
      const d = 1 + cr() * 4.5;
      const x = SCAR.x + Math.cos(a) * d;
      const z = SCAR.z + Math.sin(a) * d;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15 + cr() * 0.3, 0), stone);
      st.castShadow = true;
      st.userData.hover = { y: heightAt(x, z) + 0.25 + cr() * 0.6, ph: cr() * 6 };
      st.position.set(x, st.userData.hover.y, z);
      this.scarStones.push(st);
      this.scene.add(st);
    }
    // (no light of its own: the cracks glow, and every point light costs every pixel)
  }

  private buildBeacon() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.42, 0.44, 3, 0.06), std(0xc85a1a, { roughness: 0.55 }));
    box.position.y = 0.21;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 6, 12, Math.PI), std(0x2a2c2e, { roughness: 0.5 }));
    handle.position.y = 0.42;
    g.add(handle);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.14), new THREE.MeshStandardMaterial({ map: textTex(["ELT  406"], 192, 66, "#1a1c1e", "#d8d4cc"), roughness: 0.6 }));
    plate.position.set(0, 0.24, 0.222);
    g.add(plate);
    box.castShadow = true;
    g.add(box);
    const mat = std(0x330000, { emissive: 0xff2020, emissiveIntensity: 3 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat);
    bulb.position.y = 0.6;
    g.add(bulb);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2), std(0x222222));
    ant.position.set(0.25, 0.8, 0);
    g.add(ant);
    g.position.copy(BEACON);
    this.scene.add(g);
    const light = new THREE.PointLight(0xff2020, 4, 10, 2);
    light.position.copy(BEACON).add(new THREE.Vector3(0, 1, 0));
    this.scene.add(light);
    return { light, mat };
  }

  private buildForest() {
    const rand = rng(1001);
    const N = 230;
    const NB = 120; // extra trunks packed into the Blackwood
    const bulbGeo = new THREE.SphereGeometry(0.16, 8, 6);
    const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), N * 3);
    const BASIN_V = new THREE.Vector3(BASIN_C.x, 0, BASIN_C.z);
    const SETTLE_V = new THREE.Vector3(SETTLEMENT.x, 0, SETTLEMENT.z);
    const avoid = [new THREE.Vector3(-8, 0, 20), BEACON, ...PYLONS, ARENA, STATION, MAST, BASIN_V, SETTLE_V, CAMP, DEAD_TREE, SCAR, OLD_CAMP, SHED, new THREE.Vector3(MICRO.pack[0], 0, MICRO.pack[1]), new THREE.Vector3(MICRO.cups[0], 0, MICRO.cups[1]), new THREE.Vector3(MICRO.grave[0], 0, MICRO.grave[1])];
    const clearR = (v: THREE.Vector3) =>
      v === ARENA ? 32 : v === STATION ? 20 : v === MAST ? 5 : v === BASIN_V ? 84 : v === SETTLE_V ? 26 : v === CAMP ? 9 : v === DEAD_TREE ? 12 : v === SCAR ? 11 : v === OLD_CAMP ? 11 : v === SHED ? 8 : 14;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const bulbCols = [0x6fa89c, 0xa87f98, 0x95a874];
    const spots: TreeSpot[] = [];
    let ti = 0;
    let bi = 0;
    let tries = 0;
    const plant = (x: number, z: number) => {
      const y = heightAt(x, z);
      const dark = x < BLACKWOOD_X;
      const red = Math.hypot(x - STATION.x, z - STATION.z) < 46;
      const kind: 0 | 1 | 2 = dark ? 1 : red ? 2 : 0;
      // real trees: taller than the old figures; the Blackwood towers
      const h = dark ? 15 + rand() * 9 : 9 + rand() * 8;
      const rot = rand() * 6.28;
      spots.push({ x, y, z, rot, h, kind, pick: rand() });
      // the forest's glowing seed-pods still hang low in the ordinary woods
      if (!dark && !red && bi < N * 3 - 3) {
        for (let k = 0; k < 3; k++) {
          const a = rand() * 6.28;
          const r = 1.2 + rand() * 2.2;
          m.compose(p.set(x + Math.cos(a) * r, y + h * (0.45 + rand() * 0.2), z + Math.sin(a) * r), q.identity(), s.setScalar(1));
          bulbs.setMatrixAt(bi, m);
          bulbs.setColorAt(bi++, new THREE.Color(bulbCols[Math.floor(rand() * 3)]));
        }
      }
      this.colliders.push({ x, z, r: dark ? 0.75 : 0.6 });
      this.treeSpots.push({ x, z, kind });
      ti++;
    };
    const free = (x: number, z: number) =>
      Math.hypot(x, z - 20) < WORLD_RADIUS - 2 && !avoid.some((v) => Math.hypot(v.x - x, v.z - z) < clearR(v));
    while (ti < N && tries++ < 5000) {
      const a = rand() * Math.PI * 2;
      const r = 26 + rand() * (WORLD_RADIUS - 20);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r + 30;
      if (Math.hypot(x, z) > WORLD_RADIUS + 15) continue;
      if (!free(x, z)) continue;
      plant(x, z);
    }
    tries = 0;
    while (ti < N + NB && tries++ < 5000) {
      const x = BLACKWOOD_X - 4 - rand() * 150;
      const z = -150 + rand() * 340;
      if (!free(x, z)) continue;
      if (this.treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 3.2)) continue;
      plant(x, z);
    }
    // the old seed-pods hung where blob canopies used to be; real crowns don't
    // hold them, so they stay unplanted (the rand() calls keep the forest in place)
    bulbs.count = 0;
    this.forest = new Forest(spots);
    this.scene.add(this.forest.group);
    this.near = new NearField(heightAt, (x, z) => {
      const f = floorFx(x, z);
      const drift = smoothstep(-0.35, 0.55, Math.sin(x * 0.045 + Math.sin(z * 0.03) * 2) * Math.cos(z * 0.052 - x * 0.012) + Math.sin(x * 0.17 + z * 0.11) * 0.25);
      const grow = (1 - f.dirt) * (1 - f.scorch) * (1 - f.choir) * (1 - f.basin * 0.9) * (0.5 + 0.5 * drift) * (Math.hypot(x, z - 20) < WORLD_RADIUS + 10 ? 1 : 0);
      return { grow, dark: x < BLACKWOOD_X };
    });
    this.scene.add(this.near.group);

    // rocks: photo-scanned, on the same spots as ever
    const R = 70;
    const rockList: Placed[] = [];
    let ri = 0;
    tries = 0;
    while (ri < R && tries++ < 3000) {
      const x = (rand() - 0.5) * 2 * WORLD_RADIUS;
      const z = (rand() - 0.5) * 2 * WORLD_RADIUS + 30;
      if (Math.hypot(x, z - 30) > WORLD_RADIUS) continue;
      if (Math.hypot(x + 6, z - 16) < 24) continue;
      if (avoid.some((v) => Math.hypot(v.x - x, v.z - z) < (v === ARENA ? 30 : 10))) continue;
      const sc = 0.6 + rand() * 1.8;
      rockList.push({ x, y: heightAt(x, z) - sc * 0.25, z, s: sc * 2.2, rx: (rand() - 0.5) * 0.4, ry: rand() * 6.28, rz: (rand() - 0.5) * 0.4, sy: 0.9 });
      ri++;
      if (sc > 1) this.colliders.push({ x, z, r: sc * 0.9 });
    }
    // stumps and fallen trunks (their own seed: the rest of the world is unchanged)
    const r2 = rng(2002);
    const stumps: Placed[] = [];
    const logs: Placed[] = [];
    for (let i = 0, t = 0; (stumps.length < 46 || logs.length < 30) && t < 4000; t++) {
      const x = (r2() - 0.5) * 2 * WORLD_RADIUS;
      const z = (r2() - 0.5) * 2 * WORLD_RADIUS + 30;
      if (Math.hypot(x, z - 30) > WORLD_RADIUS || !free(x, z) || Math.hypot(x + 6, z - 16) < 20) continue;
      if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1.2)) continue;
      const y = heightAt(x, z);
      if (i++ % 2 === 0 && stumps.length < 46) {
        stumps.push({ x, y: y - 0.05, z, s: 0.9 + r2() * 0.8, rx: 0, ry: r2() * 6.28, rz: 0 });
        this.colliders.push({ x, z, r: 0.45 });
      } else if (logs.length < 30) {
        const yaw = r2() * 6.28;
        const len = 3 + r2() * 3;
        logs.push({ x, y: y - 0.08, z, s: len, rx: 0, ry: yaw, rz: (r2() - 0.5) * 0.08 });
        for (const k of [-0.3, 0, 0.3]) this.colliders.push({ x: x + Math.cos(yaw) * len * k, z: z - Math.sin(yaw) * len * k, r: 0.35 });
      }
    }
    placeProps(this.scene, rockList, stumps, logs);

    // glowing ground flora
    const F = 420;
    const flora = new THREE.InstancedMesh(mushroomCluster(), new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }), F);
    for (let i = 0; i < F; i++) {
      const x = (rand() - 0.5) * 2 * WORLD_RADIUS;
      const z = (rand() - 0.5) * 2 * WORLD_RADIUS + 30;
      if (Math.hypot(x + 6, z - 16) < 14 || Math.hypot(x - BASIN_C.x, z - BASIN_C.z) < 74) {
        m.makeScale(0, 0, 0);
      } else {
        const sc = 0.5 + rand();
        m.compose(p.set(x, heightAt(x, z) - 0.01, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28), s.setScalar(sc));
      }
      flora.setMatrixAt(i, m);
      // nothing grows light in the Blackwood
      flora.setColorAt(i, new THREE.Color(rand() < 0.5 ? 0x6fe0c4 : 0x9a8cff).multiplyScalar(x < BLACKWOOD_X ? 0.06 : 0.32));
    }
    this.scene.add(flora);
  }

  /** Meridian Field Station: tents, a lab cabin, dead floodlights. Someone left
   *  in a hurry, and something came in after they did. */
  private buildStation() {
    const S = STATION;
    const canvas = std(0x7f7c6e, { roughness: 1 }); // weathered canvas, not new white
    const steel = std(0x8d939a, { metalness: 0.6, roughness: 0.45 });
    const dark = std(0x24262a);
    const red = std(0xc4161c);
    const at = (dx: number, dz: number) => new THREE.Vector3(S.x + dx, heightAt(S.x + dx, S.z + dz), S.z + dz);
    const place = (o: THREE.Object3D, dx: number, dz: number, ry = 0, r = 0) => {
      o.position.copy(at(dx, dz));
      o.rotation.y = ry;
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) m.castShadow = m.receiveShadow = true;
      });
      this.scene.add(o);
      if (r) this.colliders.push({ x: S.x + dx, z: S.z + dz, r });
      return o;
    };
    const tent = (collapsed: boolean) => {
      const g = new THREE.Group();
      const w = 4, d = 3.2;
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, collapsed ? 0.6 : 1.4, d), canvas);
      base.position.y = collapsed ? 0.3 : 0.7;
      g.add(base);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(d * 0.58, d * 0.58, w, 3, 1), canvas);
      roof.rotation.z = Math.PI / 2;
      roof.rotation.x = Math.PI / 2 + Math.PI / 6;
      roof.position.y = collapsed ? 0.75 : 1.9;
      roof.scale.set(1, 1, collapsed ? 0.4 : 0.7);
      if (collapsed) roof.rotation.y = 0.25;
      g.add(roof);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.5), red);
      cross.position.set(w / 2 + 0.01, collapsed ? 0.35 : 0.9, 0);
      g.add(cross);
      return g;
    };
    place(tent(false), -7, -4, 0.3, 2.2);
    place(tent(false), 6, -7, -0.4, 2.2);
    place(tent(true), 1, 8, 1.2, 2.2);

    // lab cabin, door hanging open, one cold light still alive inside
    const cabin = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 3), new THREE.MeshStandardMaterial({ color: 0x8b9095, map: corrugatedTex(), roughness: 0.75, metalness: 0.3 }));
    shell.position.y = 1.5;
    cabin.add(shell);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(6.02, 0.25, 3.02), red);
    stripe.position.y = 1.1;
    cabin.add(stripe);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 3), dark);
    skirt.position.y = 0.15;
    cabin.add(skirt);
    this.stationFlicker = std(0x0a0c10, { emissive: 0xdfe8ff, emissiveIntensity: 1.5 });
    for (const x of [-1.8, 1.8]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.02), x < 0 ? this.stationFlicker : std(0x0a0c10));
      win.position.set(x, 1.9, 1.51);
      cabin.add(win);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2, 0.06), std(0x9aa0a6));
    door.geometry.translate(0.45, 0, 0);
    door.position.set(0.1, 1.3, 1.53);
    door.rotation.y = 1.9;
    cabin.add(door);
    place(cabin, 9, 5, -0.2);
    // the emergency lamp over the door still turns: the only light for a hundred metres
    this.stationLamp = new THREE.PointLight(0xff2a1a, 14, 24, 1.6);
    this.stationLamp.position.copy(at(9, 7)).add(new THREE.Vector3(0, 3.2, 0));
    this.scene.add(this.stationLamp);
    this.colliders.push({ x: S.x + 7.6, z: S.z + 5.3, r: 1.8 }, { x: S.x + 10.4, z: S.z + 4.7, r: 1.8 });
    // what came out of it: drag marks from the door into the trees
    const drag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 9), std(0x2a0d0b, { roughness: 1, transparent: true, opacity: 0.8, depthWrite: false }));
    drag.rotation.set(-Math.PI / 2, 0, -0.9);
    const dp = at(13, 10);
    drag.position.set(dp.x, dp.y + 0.03, dp.z);
    this.scene.add(drag);

    // floodlight mast: three lamps dead, one flickering
    const flood = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 7, 6), steel);
    pole.position.y = 3.5;
    flood.add(pole);
    for (let i = 0; i < 4; i++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.2), i === 2 ? this.stationFlicker : dark);
      lamp.position.set(-0.6 + (i % 2) * 1.2, 6.6 + Math.floor(i / 2) * 0.45, 0.15);
      lamp.rotation.x = 0.4;
      flood.add(lamp);
    }
    place(flood, -2, -1, 0.6, 0.4);

    // generator, gurneys, crates
    const gen = new THREE.Group();
    const gb = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.0, 1, 2, 0.06), std(0x3d4248, { metalness: 0.4 }));
    gb.position.y = 0.6;
    gen.add(gb);
    const gs = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.1, 1.02), std(0x9a7a2a, { roughness: 0.8 }));
    gs.position.y = 0.82;
    gen.add(gs);
    // skids, a vent grille, an exhaust stack, a fuel cap: a machine, not a block
    for (const z of [-0.4, 0.4]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), std(0x26292c, { metalness: 0.5 }));
      skid.position.set(0, 0.05, z);
      gen.add(skid);
    }
    for (let i = 0; i < 6; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.012), std(0x1a1c1f));
      slat.position.set(-0.5 + i * 0.08, 0.55, 0.51);
      gen.add(slat);
    }
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), std(0x2a2522, { metalness: 0.6, roughness: 0.7 }));
    stack.position.set(0.55, 1.3, -0.25);
    const fcap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), std(0x8a1c18));
    fcap.position.set(-0.5, 1.12, 0.2);
    gen.add(stack, fcap);
    place(gen, -3, 3, 0.2, 1);
    const gurney = (flipped: boolean) => {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 2), std(0xd8dde0));
      top.position.y = 0.85;
      g.add(top);
      for (const [x, z] of [[-0.3, -0.85], [0.3, -0.85], [-0.3, 0.85], [0.3, 0.85]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 5), steel);
        leg.position.set(x, 0.42, z);
        g.add(leg);
      }
      // restraint straps: these were not for comfort
      for (const z of [-0.5, 0.4]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.03, 0.09), dark);
        strap.position.set(0, 0.9, z);
        g.add(strap);
      }
      if (flipped) {
        g.rotation.z = Math.PI / 2;
        g.position.y = 0.4;
      }
      return g;
    };
    place(gurney(false), 3, 1, 1.1);
    const fg = place(gurney(true), 5.5, 1.8, 0.3);
    fg.position.y += 0.35;
    for (const [dx, dz] of [[-9, 3], [-8.2, 4.1], [12, -2]]) {
      // a Meridian equipment case: moulded, ribbed, latched, stencilled
      const c = new THREE.Mesh(new RoundedBoxGeometry(1, 0.7, 0.8, 3, 0.06), std(0x4a5258, { metalness: 0.2, roughness: 0.6 }));
      c.position.y = 0.35;
      const g = new THREE.Group();
      g.add(c);
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.01, 0.04, 0.81), std(0x9c3a24, { roughness: 0.8 }));
      st.position.y = 0.6;
      g.add(st);
      for (const x of [-0.3, 0.3]) {
        const latch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.03), std(0x8a8d90, { metalness: 0.8, roughness: 0.4 }));
        latch.position.set(x, 0.5, 0.41);
        g.add(latch);
      }
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.12), new THREE.MeshStandardMaterial({ map: textTex(["MERIDIAN"], 256, 76, "rgba(0,0,0,0)", "#cfd2d4"), transparent: true, roughness: 0.8 }));
      label.position.set(0, 0.32, 0.402);
      g.add(label);
      place(g, dx, dz, dx * 0.7, 0.7);
    }
    // perimeter fence, broken in places
    for (let i = 0; i < 22; i++) {
      if (i % 7 === 3 || i === 10 || i === 11) continue;
      const a = (i / 22) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), steel);
      post.position.y = 0.8;
      const g = new THREE.Group();
      g.add(post);
      g.rotation.z = Math.sin(i * 5.1) * 0.25;
      place(g, Math.cos(a) * 16, Math.sin(a) * 16);
    }
  }

  /** Low ground mist: soft cards lying in the hollows of the forest edge and
   *  through the Blackwood. Cheap (one shared material, no lights) and they give
   *  the fog a floor, which flat exponential fog never has. */
  private buildMist() {
    const mat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0x9aa6b4, transparent: true, opacity: 0.09, depthWrite: false });
    const rand = rng(77);
    const spots: [number, number][] = [];
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const r = 30 + rand() * 22;
      spots.push([-6 + Math.cos(a) * r, 18 + Math.sin(a) * r]);
    }
    for (let i = 0; i < 30; i++) spots.push([BLACKWOOD_X - 8 - rand() * 130, -120 + rand() * 300]);
    for (let i = 0; i < 8; i++) spots.push([STATION.x + (rand() - 0.5) * 50, STATION.z + (rand() - 0.5) * 50]);
    for (const [x, z] of spots) {
      if (Math.hypot(x, z - 20) > WORLD_RADIUS) continue;
      const s = new THREE.Sprite(mat);
      const base = new THREE.Vector3(x, heightAt(x, z) + 0.9, z);
      s.position.copy(base);
      s.scale.set(16 + rand() * 12, 3.2 + rand() * 1.6, 1);
      s.renderOrder = 2;
      this.scene.add(s);
      this.mist.push({ s, base, ph: rand() * 6.28 });
    }
  }

  /** Broken relay mast behind the ambulance. Tall enough to see over the trees;
   *  its red light is how you find your way back to the fire. */
  private buildMast() {
    const g = new THREE.Group();
    const steel = std(0x5d6168, { metalness: 0.6, roughness: 0.5 });
    const H = 26;
    const legGeo = new THREE.CylinderGeometry(0.07, 0.1, H, 5);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const leg = new THREE.Mesh(legGeo, steel);
      leg.position.set(x * 0.7, H / 2, z * 0.7);
      leg.rotation.set(-z * 0.025, 0, x * 0.025);
      g.add(leg);
    }
    const braceGeo = new THREE.BoxGeometry(0.05, 0.05, 1.9);
    for (let y = 2; y < H - 1; y += 2.6) {
      const k = 1 - (y / H) * 0.6;
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(braceGeo, steel);
        b.position.set(Math.cos((i * Math.PI) / 2) * 0.7 * k, y, Math.sin((i * Math.PI) / 2) * 0.7 * k);
        b.rotation.set(0.6, (i * Math.PI) / 2, 0);
        b.scale.z = k;
        g.add(b);
      }
    }
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.2, 0.3, 12, 1, true), std(0xc9ced6, { side: THREE.DoubleSide }));
    dish.position.set(0.6, H - 3, 0);
    dish.rotation.z = -1.2;
    g.add(dish);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), std(0x330000, { emissive: 0xff2a1a, emissiveIntensity: 3 }));
    lamp.position.y = H + 0.2;
    g.add(lamp);
    this.mastLight = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff3020, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const glow = new THREE.Sprite(this.mastLight);
    glow.scale.setScalar(3.2);
    glow.position.y = H + 0.2;
    g.add(glow);
    g.position.copy(MAST);
    g.rotation.set(0.1, 0.5, -0.07); // leaning: something hit it
    g.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) m.castShadow = true;
    });
    this.scene.add(g);
    // the top section that snapped off, lying in the scrub
    const piece = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 7), steel);
    piece.position.set(MAST.x + 4, heightAt(MAST.x + 4, MAST.z + 3) + 0.4, MAST.z + 3);
    piece.rotation.set(0.1, 0.9, 0.3);
    piece.castShadow = true;
    this.scene.add(piece);
    this.colliders.push({ x: MAST.x, z: MAST.z, r: 1.6 }, { x: MAST.x + 4, z: MAST.z + 3, r: 1.6 });
  }

  private buildPylon(pos: THREE.Vector3): Pylon {
    const g = new THREE.Group();
    g.position.copy(pos);
    const stone = std(0x55525a, { roughness: 0.95 });
    const geo = new THREE.CylinderGeometry(0.5, 1.1, 7, 4);
    const ob = new THREE.Mesh(geo, stone);
    ob.position.y = 3.5;
    ob.rotation.y = Math.PI / 4;
    ob.castShadow = true;
    g.add(ob);
    const rune = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2ad8ff, emissiveIntensity: 0.15, flatShading: true });
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.05), rune);
      const a = (i * Math.PI) / 2;
      r.position.set(Math.sin(a) * 0.72, 2.2 + (i % 2) * 1.4, Math.cos(a) * 0.72);
      r.rotation.y = a;
      g.add(r);
    }
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), rune);
    cap.position.y = 7.6;
    g.add(cap);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), stone);
      st.position.set(Math.cos(a) * 6.5, 0.4, Math.sin(a) * 6.5);
      st.rotation.y = a;
      st.castShadow = true;
      g.add(st);
    }
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x2ad8ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 6, 48, 1, 0, Math.PI * 2), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
    // a thin column of light that thins out as it climbs and is swallowed by the fog
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.3, 120, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7fe4f2, transparent: true, opacity: 0, alphaMap: beamFade(), blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    beam.position.y = 60;
    g.add(beam);
    const light = new THREE.PointLight(0x2ad8ff, 0, 30, 1.5);
    light.position.y = 6;
    g.add(light);
    this.scene.add(g);
    this.colliders.push({ x: pos.x, z: pos.z, r: 1.3 });
    return { pos, rune, ring, ringMat, beam, light, charge: 0, lit: false };
  }

  private buildArena() {
    const stone = std(0x4f4b52, { roughness: 0.95 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      if (Math.abs(a - Math.PI * 1.5) < 0.3) continue; // entrance gap to the south
      if (Math.abs(a - Math.PI * 0.5) < 0.3) continue; // and north, toward the Basin
      const x = ARENA.x + Math.cos(a) * 24;
      const z = ARENA.z + Math.sin(a) * 24;
      const h = 4 + (i % 3) * 1.5;
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.2), stone);
      st.position.set(x, heightAt(x, z) + h / 2 - 0.3, z);
      st.rotation.y = -a;
      st.rotation.z = (i % 2 ? 1 : -1) * 0.06;
      st.castShadow = true;
      this.scene.add(st);
      this.colliders.push({ x, z, r: 1.1 });
    }
    // The Rift is not a portal. It is damage: a ragged seam in the air, dark
    // inside (a hole, with somebody else's stars in it), a thin cold fringe
    // where the light bends round it, and faint ripples spreading into the
    // air. Shut, it is a hairline you could miss. (Also the sky's tear.)
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `
        varying vec2 vUv; uniform float uTime; uniform float uOpen;
        float h21(vec2 p){ p = fract(p*vec2(233.34,851.73)); p += dot(p, p+23.45); return fract(p.x*p.y); }
        float vn(float x){ float i = floor(x), f = fract(x); return mix(h21(vec2(i, 3.1)), h21(vec2(i + 1.0, 3.1)), f*f*(3.0-2.0*f)); }
        void main(){
          vec2 p = vUv - 0.5;
          float t = uTime;
          // the seam wanders, jagged, and crawls slowly
          float w = (vn(p.y * 9.0 + t * 0.08) - 0.5) * 0.09 + (vn(p.y * 31.0 - t * 0.2) - 0.5) * 0.025 + sin(p.y * 7.0 + 1.3) * 0.02;
          float taper = 1.0 - smoothstep(0.12, 0.47, abs(p.y));
          float open = clamp(uOpen, 0.0, 1.0);
          float width = (0.004 + open * 0.085) * taper * (0.75 + 0.5 * vn(p.y * 14.0 + 5.0));
          float d = abs(p.x - w);
          // inside: a hole, nearly black, someone else's stars drifting in it
          float inside = smoothstep(width, width * 0.55, d) * taper;
          vec2 sp = floor((p + vec2(0.0, t * 0.004)) * 140.0);
          float star = step(0.985, h21(sp)) * 0.8;
          vec3 voidC = vec3(0.004, 0.01, 0.02) + vec3(0.6, 0.85, 0.9) * star;
          // the fringe where light bends: thin, cold, uneven, flickering when shut
          float flick = open > 0.05 ? 1.0 : smoothstep(0.6, 0.95, vn(t * 0.7)) ;
          float fringe = exp(-pow((d - width) / (0.0035 + open * 0.004), 2.0)) * taper * (0.5 + 0.5 * vn(p.y * 40.0 + t)) * flick;
          // ripples in the air around it (the world bending), very faint
          float r = length(vec2(p.x - w, p.y * 0.55));
          float ripple = (sin(r * 70.0 - t * 1.6) * 0.5 + 0.5) * exp(-r * 9.0) * (0.15 + open) * 0.12;
          float haze = exp(-d * (22.0 - open * 12.0)) * taper * (0.05 + open * 0.2);
          vec3 cold = vec3(0.62, 0.9, 0.95);
          vec3 col = mix(cold * (fringe * 0.85 + ripple + haze), voidC, inside);
          float alpha = clamp(inside * 0.96 + fringe * 0.6 + ripple + haze, 0.0, 1.0);
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    const rift = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), mat);
    rift.position.set(ARENA.x, ARENA.y + 11, ARENA.z + 14);
    this.scene.add(rift);
    // stones lifted out of the circle, drifting up against gravity around the seam
    const debrisMat = std(0x22232a, { roughness: 0.9 });
    for (let i = 0; i < 9; i++) {
      const d = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + (i % 4) * 0.07, 0), debrisMat);
      d.userData.debris = { a: (i / 9) * Math.PI * 2 + i, r: 1.2 + (i % 4) * 0.9, y: (i * 1.9) % 12, sp: 0.12 + (i % 3) * 0.06 };
      d.castShadow = true;
      this.riftDebris.push(d);
      this.scene.add(d);
    }
    const light = new THREE.PointLight(0x9fdcea, 1, 45, 1.6);
    light.position.copy(rift.position).add(new THREE.Vector3(0, 0, -3));
    this.scene.add(light);
    return { rift, mat, light };
  }

  private buildShards() {
    const geo = new THREE.OctahedronGeometry(0.32);
    const m = new THREE.MeshStandardMaterial({ color: 0x9ff6ff, emissive: 0x22c8ff, emissiveIntensity: 1.8, flatShading: true, metalness: 0.3, roughness: 0.2 });
    const spots: [number, number][] = [
      [3, 8], [-3, 14], [6, 18], [-9, 24], [-4, 28], [8, 28],
      // toward pylon 1
      [20, 38], [32, 45], [44, 54], [64, 68], [52, 70],
      // toward pylon 2
      [-26, 46], [-38, 58], [-50, 72], [-70, 96], [-58, 100],
      // toward pylon 3
      [-8, 70], [4, 88], [12, 104], [26, 128], [10, 132],
      // arena approach
      [-6, 140], [6, 142], [-14, 156], [14, 158], [0, 176],
      // secrets
      [90, 20], [-95, 30], [80, 130], [-90, 140],
    ];
    for (const [x, z] of spots) this.addShard(x, z);
    void geo;
    void m;
  }

  /** Place a shard. Dynamic ones (drops, caches) are removed once taken. */
  addShard(x: number, z: number, dynamic = false, value = 1) {
    const mesh = new THREE.Mesh(this.shardGeo, this.shardMat);
    // hangs just off the ground, a little tilted: something that shouldn't float
    const y = heightAt(x, z) + 0.45;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(0.75);
    mesh.rotation.z = 0.35;
    // (no halo: a cold glint you notice, not a light that calls you over)
    this.scene.add(mesh);
    const s: Shard = { mesh, taken: false, base: y, dynamic, value };
    this.shards.push(s);
    return s;
  }

  clearDynamicShards() {
    for (const s of this.shards) if (s.dynamic) this.scene.remove(s.mesh);
    this.shards = this.shards.filter((s) => !s.dynamic);
  }

  // ---------------------------------------------------------------- loop props

  private buildCampfire() {
    const fire = new Fire({ size: 1, smoke: 1, logs: true, stones: true, light: 36, lightRange: 26 });
    fire.lit = false;
    const g = fire.group;
    g.position.copy(CAMP);
    this.scene.add(g);
    this.colliders.push({ x: CAMP.x, z: CAMP.z, r: 1.0 });
    this.campfire = { group: g, light: fire.light!, fire, lit: false, hp: 100, maxHp: 100 };
  }

  setCampfire(lit: boolean, maxHp = 100) {
    const c = this.campfire;
    c.lit = lit;
    c.maxHp = maxHp;
    c.hp = maxHp;
    c.fire.lit = lit;
  }

  spawnCache(x: number, z: number): Cache {
    const g = new THREE.Group();
    const y = heightAt(x, z);
    g.position.set(x, y, z);
    g.rotation.y = Math.random() * Math.PI;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.85), std(0x59626b, { metalness: 0.5, roughness: 0.5 }));
    body.position.y = 0.38;
    body.castShadow = true;
    g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.14, 0.87), std(0xff6a00));
    stripe.position.y = 0.5;
    g.add(stripe);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.1, 0.9), std(0x454d55, { metalness: 0.5 }));
    lid.position.y = 0.8;
    lid.name = "lid";
    g.add(lid);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xc8d0d4, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.y = 1.4;
    glow.scale.setScalar(1.6);
    glow.name = "glow";
    g.add(glow);
    this.scene.add(g);
    const c: Cache = { group: g, pos: new THREE.Vector3(x, y, z), opened: false };
    this.caches.push(c);
    return c;
  }

  openCache(c: Cache) {
    c.opened = true;
    const lid = c.group.getObjectByName("lid");
    if (lid) {
      lid.position.set(0, 0.6, -0.6);
      lid.rotation.x = -1.2;
    }
    const glow = c.group.getObjectByName("glow");
    if (glow) glow.visible = false;
  }

  clearCaches() {
    for (const c of this.caches) this.scene.remove(c.group);
    this.caches = [];
  }

  /** An Echo: the flickering ghost of a patient who fell before you. */
  spawnGhost(echoId: number, x: number, z: number, model: THREE.Group): Ghost {
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = this.ghostMat;
        m.castShadow = false;
      }
    });
    const y = heightAt(x, z);
    model.position.set(x, y, z);
    model.rotation.y = Math.random() * Math.PI * 2;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xa9e6f2, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.y = 1.2;
    halo.scale.set(2.5, 4, 1);
    model.add(halo);
    this.scene.add(model);
    const g: Ghost = { group: model, pos: new THREE.Vector3(x, y, z), echoId };
    this.ghosts.push(g);
    return g;
  }

  removeGhost(g: Ghost) {
    this.scene.remove(g.group);
    this.ghosts = this.ghosts.filter((x) => x !== g);
  }

  /** Cyan tear in the air where Hollow step through. */
  spawnTear(x: number, z: number, big = false) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x8fe8ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    const s = big ? 2.2 : 1;
    m.position.set(x, heightAt(x, z) + 1.6 * s, z);
    m.scale.set(0.2, 4 * s, 1);
    m.userData.s = s;
    this.scene.add(m);
    this.tears.push({ mesh: m, life: 1.6 });
  }

  /** Jump straight to the target weather (a hard cut, not a drift). */
  snapMood() {
    const mood = this.zoneMood ? (MOODS[this.zoneMood] as Mood) : this.mood;
    this.moodFog.set(mood.fog);
    this.moodDensity = mood.density;
    this.hemi.intensity = mood.hemi * lift(mood.hemi);
    this.sun.intensity = mood.sun * lift(mood.hemi);
    (this.skyMat.uniforms.uTint.value as THREE.Vector3).set(...mood.tint);
  }

  setMood(name: MoodName, density?: number) {
    this.mood = { ...(MOODS[name] as Mood) };
    if (density) this.mood.density = density;
  }

  private buildFallingPlane() {
    const g = new THREE.Group();
    this.aircraft = buildAircraft();
    g.add(this.aircraft.group);
    g.visible = false;
    this.scene.add(g);
    this.fallingPlane = g;

    this.skyTearMat = this.riftMat.clone();
    this.skyTearMat.uniforms = { uTime: { value: 0 }, uOpen: { value: 0 } };
    this.skyTear = new THREE.Mesh(new THREE.CircleGeometry(30, 64), this.skyTearMat);
    this.skyTear.scale.set(0.01, 0.01, 1);
    this.skyTear.visible = false;
    this.skyTearMat.fog = false;
    this.scene.add(this.skyTear);
  }

  // ---------------------------------------------------------------- runtime

  update(dt: number, t: number, focus: THREE.Vector3, camera?: THREE.Camera) {
    this.skyMat.uniforms.uTime.value = t;
    // the further the rift has opened, the more wrong the northern sky becomes
    const wrong = this.skyMat.uniforms.uWrong;
    wrong.value += (0.25 + this.riftOpen * 0.75 - wrong.value) * Math.min(1, dt * 0.3);
    this.skyTearMat.uniforms.uTime.value = t;

    // mood lerp
    const k = Math.min(1, dt * 0.8);
    const fog = this.scene.fog as THREE.FogExp2;
    const mood = this.zoneMood ? (MOODS[this.zoneMood] as Mood) : this.mood;
    this.moodFog.lerp(new THREE.Color(mood.fog), k);
    fog.color.copy(this.moodFog);
    (this.scene.background as THREE.Color).copy(this.moodFog);
    // the sky's horizon is the fog itself (before the mood's tint), so the land melts into it
    const tintV = this.skyMat.uniforms.uTint.value as THREE.Vector3;
    (this.skyMat.uniforms.uHaze.value as THREE.Color).setRGB(this.moodFog.r / tintV.x, this.moodFog.g / tintV.y, this.moodFog.b / tintV.z);
    this.moodDensity += (mood.density - this.moodDensity) * k;
    this.fogBoostNow += (this.fogBoost - this.fogBoostNow) * Math.min(1, dt * 0.5);
    fog.density = this.moodDensity + this.fogBoostNow * 0.014;
    // inside the aircraft the night outside barely reaches: its own lamps light it
    const outdoor = this.indoor ? 0.22 : 1;
    const ki = this.indoor ? 1 : k;
    this.hemi.intensity += (mood.hemi * lift(mood.hemi) * outdoor - this.hemi.intensity) * ki;
    this.sun.intensity += (mood.sun * lift(mood.hemi) * outdoor - this.sun.intensity) * ki;
    const tint = this.skyMat.uniforms.uTint.value as THREE.Vector3;
    tint.lerp(new THREE.Vector3(...mood.tint), k);
    this.bigMoon.color.lerp(new THREE.Color(mood.blood ? 0xc8473c : 0xe4e0d6), k);

    // campfire: a dying fire burns lower
    const cf = this.campfire;
    cf.fire.lit = cf.lit;
    cf.fire.power = cf.lit ? Math.max(0.15, cf.hp / cf.maxHp) : 0;
    if (camera) updateFires(dt, t, camera);

    for (const c of this.caches) {
      const glow = c.group.getObjectByName("glow");
      if (glow && glow.visible) glow.scale.setScalar(1.4 + Math.sin(t * 4) * 0.3);
    }
    for (const g of this.ghosts) {
      this.ghostMat.opacity = 0.25 + Math.random() * 0.15 + Math.sin(t * 3) * 0.05;
      g.group.position.x = g.pos.x + (Math.random() < 0.03 ? (Math.random() - 0.5) * 0.4 : 0);
      g.group.position.y = g.pos.y + Math.sin(t * 1.5) * 0.1;
    }
    for (const tr of this.tears) {
      tr.life -= dt;
      const a = tr.life / 1.6;
      const s = tr.mesh.userData.s as number;
      tr.mesh.scale.x = Math.sin(Math.min(1, (1 - a) * 3) * Math.PI * 0.5) * 2.2 * s * Math.min(1, a * 3);
      if (camera) tr.mesh.quaternion.copy(camera.quaternion);
      (tr.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, a * 2);
      if (tr.life <= 0) this.scene.remove(tr.mesh);
    }
    this.tears = this.tears.filter((x) => x.life > 0);

    if (this.fallingPlane.visible) this.aircraft.update(dt, t);
    if (camera) this.forest.update(dt, t, camera.position);
    this.near.update(t, focus);
    // falling plane fire/smoke trail
    if (this.fallingPlane.visible && this.planeTrail) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.025;
        const fire = this.trail.length % 3 !== 0;
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTexture(),
            color: fire ? 0xff7a2a : 0x2a2030,
            transparent: true,
            opacity: fire ? 0.9 : 0.7,
            depthWrite: false,
            blending: fire ? THREE.AdditiveBlending : THREE.NormalBlending,
            fog: false,
          }),
        );
        const tail = new THREE.Vector3(2.6, 0.55, fire ? -7.6 : -8.4).applyMatrix4(this.fallingPlane.matrixWorld); // the burning port engine
        sp.position.copy(tail);
        sp.scale.setScalar(fire ? 3 : 5);
        this.scene.add(sp);
        this.trail.push({ s: sp, life: fire ? 0.9 : 2.5, vel: new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2) });
      }
    }
    for (const p of this.trail) {
      p.life -= dt;
      p.s.position.addScaledVector(p.vel, dt);
      p.s.scale.multiplyScalar(1 + dt * 0.8);
      (p.s.material as THREE.SpriteMaterial).opacity *= 1 - dt * 0.9;
      if (p.life <= 0) {
        this.scene.remove(p.s);
        p.s.material.dispose();
      }
    }
    this.trail = this.trail.filter((p) => p.life > 0);

    this.riftMat.uniforms.uTime.value = t;
    this.riftMat.uniforms.uOpen.value = this.riftOpen;
    this.riftLight.intensity = 0.6 + this.riftOpen * 16 + Math.sin(t * 0.9) * 0.3;
    // the shed's monitor on standby: a slow breath of green
    const sb = 0.75 + Math.sin(t * 0.8) * 0.25;
    this.shedScreen.emissiveIntensity = 0.2 * sb;
    this.shedLight.intensity = 0.9 * sb;
    // the old camp's lantern: a weak battery, stuttering
    const lk = Math.sin(t * 1.3) > 0.93 ? 0.15 : 0.75 + Math.sin(t * 17) * 0.08;
    this.lanternLight.intensity = 3.2 * lk;
    this.lanternGlass.emissiveIntensity = 0.6 * lk;
    for (const st of this.scarStones) {
      const h = st.userData.hover as { y: number; ph: number };
      st.position.y = h.y + Math.sin(t * 0.4 + h.ph) * 0.06;
      st.rotation.y = t * 0.05 + h.ph;
    }
    // the debris rises slowly round the seam, turning, and starts again below
    for (const d of this.riftDebris) {
      const u = d.userData.debris as { a: number; r: number; y: number; sp: number };
      u.y += dt * u.sp * (0.4 + this.riftOpen);
      if (u.y > 16) u.y = 0;
      const a = u.a + t * 0.04;
      d.position.set(this.rift.position.x + Math.cos(a) * u.r, ARENA.y + 1 + u.y, this.rift.position.z + Math.sin(a) * u.r * 0.6);
      d.rotation.set(t * u.sp, t * u.sp * 0.7, 0);
      d.visible = this.riftOpen > 0.2 || u.r < 5;
    }

    // Shadow frustum follows the player.
    this.sun.position.set(focus.x - 40, focus.y + 80, focus.z + 60);
    this.sun.target.position.copy(focus);

    // ambulance
    this.doorsOpen += (this.doorsTarget - this.doorsOpen) * Math.min(1, dt * 3);
    this.doorL.rotation.y = -this.doorsOpen * 1.9;
    this.doorR.rotation.y = this.doorsOpen * 1.9;
    const flick = Math.sin(t * 23) * Math.sin(t * 7.3) > 0.2 ? 0.25 : 1;
    this.interiorLight.intensity = 3.2 * flick;
    this.roofLights[0].emissiveIntensity = Math.sin(t * 8) > 0 ? 3 : 0.1;
    this.roofLights[1].emissiveIntensity = Math.sin(t * 8) > 0 ? 0.1 : 3;
    this.monitorMat.emissiveIntensity = 0.8 + (Math.sin(t * 6) > 0.85 ? 1.6 : 0);

    for (const m of this.mist) m.s.position.set(m.base.x + Math.sin(t * 0.05 + m.ph) * 3, m.base.y, m.base.z + Math.cos(t * 0.04 + m.ph) * 3);
    this.mastLight.opacity = this.mastDark ? 0 : t % 1.8 < 0.25 ? 0.95 : 0.3;
    this.stationLamp.intensity = this.stationDark ? 0 : 6 + Math.max(0, Math.sin(t * 2.4)) * 18;
    this.stationFlicker.emissiveIntensity = Math.random() < 0.08 ? 0.1 : Math.sin(t * 31) > -0.6 ? 1.6 : 0.3;
    this.lookoutWin.emissiveIntensity = this.stationFlicker.emissiveIntensity * 0.35;
    this.beaconMat.emissiveIntensity = Math.sin(t * 5) > 0 ? 3 : 0.2;
    this.beaconLight.intensity = Math.sin(t * 5) > 0 ? 5 : 0.3;

    if (this.shards.some((s) => s.dynamic && s.taken)) {
      for (const s of this.shards) if (s.dynamic && s.taken) this.scene.remove(s.mesh);
      this.shards = this.shards.filter((s) => !(s.dynamic && s.taken));
    }
    for (const s of this.shards) {
      if (s.taken) continue;
      s.mesh.rotation.y += dt * 0.35;
      s.mesh.position.y = s.base + Math.sin(t * 0.9 + s.mesh.position.x) * 0.05;
    }

    for (const p of this.pylons) {
      const k = p.lit ? 1 : p.charge;
      p.rune.emissiveIntensity = 0.15 + k * 3 + (p.charge > 0 && !p.lit ? Math.sin(t * 10) * 0.3 : 0);
      p.light.intensity = k * 25;
      (p.beam.material as THREE.MeshBasicMaterial).opacity = p.lit ? 0.22 + Math.sin(t * 1.3) * 0.03 : 0;
      p.ringMat.opacity = p.lit ? 0.1 : 0.25 + p.charge * 0.6;
      p.ring.rotation.z += dt * (0.2 + p.charge * 2);
    }

    // spores recycle around the player
    const sp = this.spores.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      let x = sp.getX(i);
      let y = sp.getY(i) + dt * 0.4;
      let z = sp.getZ(i);
      if (y > focus.y + 18) y = focus.y - 1;
      if (x - focus.x > 40) x -= 80;
      if (x - focus.x < -40) x += 80;
      if (z - focus.z > 40) z -= 80;
      if (z - focus.z < -40) z += 80;
      sp.setXYZ(i, x + Math.sin(t + i) * dt * 0.3, y, z);
    }
    sp.needsUpdate = true;

    // embers from the fires (retired: each Fire has its own sparks)
    if (this.embers.parent) {
    const ep = this.embers.geometry.attributes.position as THREE.BufferAttribute;
    const d = this.emberData;
    for (let i = 0; i < ep.count; i++) {
      const j = i * 4;
      d[j + 3] -= dt;
      if (d[j + 3] <= 0) {
        // the fire's world position (its light sits in the fire's own frame)
        const f = this.fires[i % this.fires.length].fire.group.position;
        d[j] = f.x + (Math.random() - 0.5) * 2;
        d[j + 1] = f.y + 0.3;
        d[j + 2] = f.z + (Math.random() - 0.5) * 2;
        d[j + 3] = 1.5 + Math.random() * 2.5;
      }
      d[j] += Math.sin(t * 2 + i) * dt * 0.6;
      d[j + 1] += dt * (1.5 + (i % 5) * 0.3);
      ep.setXYZ(i, d[j], d[j + 1], d[j + 2]);
    }
    ep.needsUpdate = true;
    }
  }
}

/** Bright at the foot, gone by the top (for light columns). */
let _beamFade: THREE.Texture | null = null;
export function beamFade() {
  if (_beamFade) return _beamFade;
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, "#000");
  grd.addColorStop(0.55, "#333");
  grd.addColorStop(0.92, "#fff");
  grd.addColorStop(1, "#888");
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  _beamFade = new THREE.CanvasTexture(c);
  return _beamFade;
}

let _glow: THREE.Texture | null = null;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.3, "rgba(255,255,255,0.5)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

/** Words on a little canvas (labels, tags, a log page). */
function textTex(lines: string[], w: number, h: number, bg: string, fg: string) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const size = Math.min(h / (lines.length + 0.8), w / Math.max(...lines.map((l) => l.length), 1) * 1.6);
  g.font = `600 ${size}px "IBM Plex Mono", monospace`;
  g.fillStyle = fg;
  g.textAlign = lines.length > 1 ? "left" : "center";
  g.textBaseline = "middle";
  lines.forEach((l, i) => g.fillText(l, lines.length > 1 ? size * 0.5 : w / 2, (h / (lines.length + 0.4)) * (i + 0.7)));
  // wear
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 1 + Math.random() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A weathered plank cut with hundreds of tally marks; three words at the top. */
function tallyTex() {
  const W = 512;
  const H = 320;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#4b3f33";
  g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 3) {
    g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
    g.fillRect(0, y, W, 1);
  }
  g.strokeStyle = "rgba(215,200,175,0.75)";
  g.lineWidth = 2;
  g.font = '600 30px "IBM Plex Mono", monospace';
  g.fillStyle = "rgba(220,205,180,0.85)";
  g.fillText("WAIT FOR HUNDRED", 20, 40);
  let n = 0;
  for (let row = 0; row < 7; row++)
    for (let col = 0; col < 13; col++) {
      if (row === 6 && col > 8) break;
      const x0 = 18 + col * 37;
      const y0 = 64 + row * 36;
      const marks = row === 6 && col === 8 ? 3 : 5; // they stopped counting mid-group
      for (let i = 0; i < Math.min(4, marks); i++) {
        g.beginPath();
        g.moveTo(x0 + i * 6 + Math.random() * 2, y0);
        g.lineTo(x0 + i * 6 + Math.random() * 2, y0 + 26);
        g.stroke();
        n++;
      }
      if (marks === 5) {
        g.beginPath();
        g.moveTo(x0 - 3, y0 + 22);
        g.lineTo(x0 + 24, y0 + 4);
        g.stroke();
      }
    }
  void n;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Corrugated sheet: ribs, rust running down from the rivets. */
function corrugatedTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  for (let x = 0; x < 256; x++) {
    const k = 0.75 + 0.25 * Math.sin((x / 256) * Math.PI * 24);
    g.fillStyle = `rgb(${Math.round(150 * k)},${Math.round(146 * k)},${Math.round(138 * k)})`;
    g.fillRect(x, 0, 1, 256);
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 120;
    const gr = g.createLinearGradient(x, y, x, y + 60 + Math.random() * 100);
    gr.addColorStop(0, "rgba(110,52,24,0.55)");
    gr.addColorStop(1, "rgba(110,52,24,0)");
    g.fillStyle = gr;
    g.fillRect(x - 3, y, 6 + Math.random() * 8, 160);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

/** Hundreds of short marks cut into the wall, row on row, by somebody lying
 *  down. One of them is newer: brighter metal, not yet dulled. */
function wallMarksTex() {
  const W = 512;
  const H = 384;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.lineWidth = 1.6;
  let n = 0;
  for (let row = 0; row < 14; row++)
    for (let x = 14; x < W - 14; x += 6 + Math.random() * 2) {
      if (row === 13 && x > W * 0.55) break;
      const y = 20 + row * 25 + Math.sin(x * 0.05 + row) * 2;
      g.strokeStyle = `rgba(200,198,190,${0.32 + Math.random() * 0.2})`;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 2, y + 15 + Math.random() * 3);
      g.stroke();
      n++;
    }
  // the newer one, at the end of the last row
  g.strokeStyle = "rgba(240,238,232,0.95)";
  g.lineWidth = 2.2;
  const x = W * 0.55 + 7;
  const y = 20 + 13 * 25;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + 0.5, y + 17);
  g.stroke();
  void n;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
