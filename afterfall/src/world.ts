// The world on the other side of the rift: terrain, sky with two moons, the
// wrecked medevac plane, the ambulance the player wakes up in, alien forest,
// resonance pylons and the Warden's arena.

import * as THREE from "three";
import { buildAircraft, wreckPieces, type Aircraft } from "./aircraft";
import { Forest, SHADOW_LAYER, type TreeSpot } from "./flora";
import { NearField, placeProps, type Placed } from "./props";

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
  const scorch = (1 - smoothstep(6, 26, Math.hypot(x + 6, z - 18))) * 0.95;
  const choir = 1 - smoothstep(14, 30, Math.hypot(x - CHOIR_C.x, z - CHOIR_C.z));
  return { dirt, scorch, choir, basin };
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
for (const p of [BEACON, ...PYLONS, ARENA, CAMP, STATION, MAST]) p.y = heightAt(p.x, p.z);

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

export const MOODS = {
  basin: { fog: 0x0f2129, density: 0.017, hemi: 1.1, tint: [0.7, 1.25, 1.35], sun: 1.2 },
  choir: { fog: 0xd9e4e8, density: 0.03, hemi: 2.6, tint: [2.6, 2.7, 2.75], sun: 2.4 },
  night: { fog: 0x161a22, density: 0.0115, hemi: 1.2, tint: [1, 1, 1], sun: 1.5 },
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
  fires: { light: THREE.PointLight; flames: THREE.Mesh[]; base: number }[] = [];
  beaconLight: THREE.PointLight;
  beaconMat: THREE.MeshStandardMaterial;
  rift: THREE.Mesh;
  riftMat: THREE.ShaderMaterial;
  riftLight: THREE.PointLight;
  riftOpen = 0;
  /** Fire and smoke behind the falling plane (off while it cruises). */
  planeTrail = true;
  hemi!: THREE.HemisphereLight;
  bigMoon!: THREE.MeshBasicMaterial;
  campfire!: { group: THREE.Group; light: THREE.PointLight; flames: THREE.Mesh[]; logs: THREE.Group; lit: boolean; hp: number; maxHp: number };
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
  private shardMat = new THREE.MeshStandardMaterial({ color: 0xa8dbe4, emissive: 0x3aa8c8, emissiveIntensity: 1.3, flatShading: true, metalness: 0.3, roughness: 0.2 });
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
      uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: `
        varying vec3 vDir; uniform float uTime; uniform vec3 uTint;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 horizon = vec3(0.086,0.102,0.133);
          vec3 mid = vec3(0.06,0.07,0.115);
          vec3 top = vec3(0.012,0.016,0.03);
          vec3 c = mix(horizon, mid, smoothstep(0.0,0.25,h));
          c = mix(c, top, smoothstep(0.25,0.9,h));
          // aurora band
          float band = sin(vDir.x*6.0 + uTime*0.05) * 0.08 + 0.35;
          float a = exp(-pow((h-band)*9.0, 2.0)) * (0.5+0.5*sin(vDir.z*10.0+uTime*0.2));
          c += vec3(0.08,0.3,0.28) * a * 0.16;
          // stars
          vec3 p = floor(vDir*300.0);
          float s = step(0.997, hash(p)) * smoothstep(0.05,0.3,h);
          c += vec3(s) * (0.6+0.4*sin(uTime*3.0+hash(p)*20.0));
          gl_FragColor = vec4(c * uTint,1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), this.skyMat);
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    scene.add(sky);

    const moon = (r: number, color: number, pos: THREE.Vector3) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 16),
        new THREE.MeshBasicMaterial({ color, fog: false }),
      );
      m.position.copy(pos);
      scene.add(m);
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.22, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      halo.scale.setScalar(r * 3.2);
      halo.position.copy(pos);
      scene.add(halo);
      return m.material;
    };
    this.bigMoon = moon(38, 0xe4e0d6, new THREE.Vector3(-180, 220, 420));
    moon(16, 0xbfd6d0, new THREE.Vector3(120, 150, 450));

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

    // Skid trench from the crash.
    const trench = new THREE.Mesh(new THREE.PlaneGeometry(6, 40), new THREE.MeshStandardMaterial({ color: 0x0c0a0c, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }));
    trench.rotation.x = -Math.PI / 2;
    trench.rotation.z = 0.25;
    trench.position.set(-6, 0.03, 12);
    trench.receiveShadow = true;
    scene.add(trench);

    this.shardGlow = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: 0x6ac0d6,
      transparent: true,
      opacity: 0.45,
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
    const bea = this.buildBeacon();
    this.beaconLight = bea.light;
    this.beaconMat = bea.mat;
    this.buildForest();
    this.buildStation();
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
    const sp = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) sp.set([(Math.random() - 0.5) * 80, Math.random() * 20, (Math.random() - 0.5) * 80], i * 3);
    sporeGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.spores = new THREE.Points(
      sporeGeo,
      new THREE.PointsMaterial({ color: 0xb8d8cc, size: 0.12, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
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
    scene.add(this.embers);
  }

  // ---------------------------------------------------------------- builders

  private buildAmbulance() {
    const g = new THREE.Group();
    const white = std(0xe9ecef, { roughness: 0.6 });
    const red = std(0xc4161c);
    const inner = std(0x8a979c, { roughness: 0.9 });
    const floorM = std(0x3e4a4f);
    const W = 2.7;
    const H = 2.6;
    const L = 6.5;
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    // shell (thin walls; inside faces are a separate lighter material)
    box(W, 0.12, L, floorM, 0, 0.3, 0);
    box(W, 0.12, L, white, 0, H + 0.3, 0);
    box(0.1, H, L, white, -W / 2, H / 2 + 0.3, 0);
    box(0.1, H, L, white, W / 2, H / 2 + 0.3, 0);
    box(W, H, 0.1, white, 0, H / 2 + 0.3, -L / 2);
    // interior lining
    box(0.02, H - 0.2, L - 0.2, inner, -W / 2 + 0.06, H / 2 + 0.3, 0);
    box(0.02, H - 0.2, L - 0.2, inner, W / 2 - 0.06, H / 2 + 0.3, 0);
    // red stripes outside
    for (const s of [-1, 1]) box(0.02, 0.28, L, red, (W / 2 + 0.06) * s, 1.3, 0);
    box(W, 0.28, 0.02, red, 0, 1.3, -L / 2 - 0.06);
    // red cross on roof
    box(1.2, 0.02, 0.35, red, 0, H + 0.37, 0);
    box(0.35, 0.02, 1.2, red, 0, H + 0.37, 0);
    // cab
    box(W, 1.9, 2.0, white, 0, 1.25, -L / 2 - 1.0);
    const glass = std(0x223344, { roughness: 0.1, metalness: 0.6 });
    box(W - 0.2, 0.7, 0.05, glass, 0, 1.75, -L / 2 - 2.02);
    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const tire = std(0x111111);
    for (const [x, z] of [[-1.3, -4.5], [1.3, -4.5], [-1.3, 2.0], [1.3, 2.0]]) {
      const w = new THREE.Mesh(wheelGeo, tire);
      w.position.set(x, 0.3, z);
      g.add(w);
    }
    // roof light bar
    for (const [x, col] of [[-0.6, 0xff1a2a], [0.6, 0x1a6bff]] as const) {
      const m = std(col, { emissive: col, emissiveIntensity: 2 });
      this.roofLights.push(m);
      box(0.6, 0.15, 0.25, m, x, H + 0.45, -L / 2 + 0.2);
    }

    // stretcher
    box(0.7, 0.08, 2.0, std(0x2a2f33), -0.55, 0.9, -0.6);
    box(0.68, 0.06, 1.95, std(0xd8dde0), -0.55, 0.97, -0.6);
    for (const z of [-1.4, 0.2]) box(0.05, 0.55, 0.05, std(0x777777, { metalness: 0.8 }), -0.55, 0.6, z);
    // cabinets
    box(0.4, 1.4, 2.2, std(0xd2d9dc), 1.05, 1.6, -1.0);
    // heart monitor
    box(0.08, 0.5, 0.6, std(0x222222), 1.08, 1.7, 1.0);
    const monitor = std(0x001a08, { emissive: 0x19ff6a, emissiveIntensity: 1.2 });
    box(0.02, 0.38, 0.48, monitor, 1.03, 1.7, 1.0);
    // oxygen tank, debris
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), std(0x2f8f4f, { metalness: 0.4 }));
    tank.position.set(0.6, 0.55, 2.2);
    tank.rotation.z = 1.3;
    g.add(tank);

    // fire axe on the wall bracket
    const axe = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.95, 6), std(0xb52b20));
    axe.add(handle);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.3), std(0xc9ccd2, { metalness: 0.8, roughness: 0.3 }));
    blade.position.set(0, 0.38, 0.14);
    axe.add(blade);
    axe.position.set(-1.2, 1.7, 1.6);
    axe.rotation.y = Math.PI / 2;
    g.add(axe);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffcc66, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.1);
    axe.add(glow);

    // rear doors (hinged)
    const mkDoor = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set((W / 2) * side, 0.3, L / 2);
      const d = box(W / 2, H, 0.08, white, (-W / 4) * side, H / 2, 0, pivot);
      d.castShadow = true;
      box(W / 2 - 0.1, 0.28, 0.02, red, (-W / 4) * side, 1.0, 0.05, pivot);
      const win = box(0.6, 0.45, 0.02, glass, (-W / 4) * side, 1.75, 0.05, pivot);
      win.castShadow = false;
      g.add(pivot);
      return pivot;
    };
    const doorL = mkDoor(-1);
    const doorR = mkDoor(1);

    const light = new THREE.PointLight(0xff3030, 3.2, 7, 1.6);
    light.position.set(0, 2.5, 0.5);
    g.add(light);

    this.scene.add(g);
    this.cameraBlockers.push(g);
    return { group: g, doorL, doorR, light, monitor, axe };
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

    // fires
    for (const [x, z, s] of [[-15, 30, 1.4], [-16, 17.5, 1], [-1.8, 36, 1.1], [-3.5, 6, 0.5]] as const) {
      const y = heightAt(x, z);
      const light = new THREE.PointLight(0xff7a2a, 18 * s, 22, 1.7);
      light.position.set(x, y + 2.2, z);
      this.scene.add(light);
      const flames: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(
          new THREE.ConeGeometry(0.5 * s, 1.8 * s, 6),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb347 : 0xff5a1f, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        f.position.set(x + (Math.random() - 0.5) * s, y + 0.9 * s, z + (Math.random() - 0.5) * s);
        this.scene.add(f);
        flames.push(f);
      }
      this.fires.push({ light, flames, base: 18 * s });
    }
  }

  private buildBeacon() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), std(0xff6a00, { roughness: 0.5 }));
    box.position.y = 0.25;
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
    const avoid = [new THREE.Vector3(-8, 0, 20), BEACON, ...PYLONS, ARENA, STATION, MAST, BASIN_V, SETTLE_V];
    const clearR = (v: THREE.Vector3) =>
      v === ARENA ? 32 : v === STATION ? 20 : v === MAST ? 5 : v === BASIN_V ? 84 : v === SETTLE_V ? 26 : 14;
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
    bulbs.count = bi;
    this.scene.add(bulbs);
    this.forest = new Forest(spots);
    this.scene.add(this.forest.group);
    this.near = new NearField(heightAt, (x, z) => {
      const f = floorFx(x, z);
      const grow = (1 - f.dirt) * (1 - f.scorch) * (1 - f.choir) * (1 - f.basin * 0.9) * (Math.hypot(x, z - 20) < WORLD_RADIUS + 10 ? 1 : 0);
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
    const flora = new THREE.InstancedMesh(new THREE.ConeGeometry(0.035, 0.32, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), F);
    for (let i = 0; i < F; i++) {
      const x = (rand() - 0.5) * 2 * WORLD_RADIUS;
      const z = (rand() - 0.5) * 2 * WORLD_RADIUS + 30;
      if (Math.hypot(x + 6, z - 16) < 14 || Math.hypot(x - BASIN_C.x, z - BASIN_C.z) < 74) {
        m.makeScale(0, 0, 0);
      } else {
        const sc = 0.5 + rand();
        m.compose(p.set(x, heightAt(x, z) + 0.2 * sc, z), q.identity(), s.setScalar(sc));
      }
      flora.setMatrixAt(i, m);
      // nothing grows light in the Blackwood
      flora.setColorAt(i, new THREE.Color(rand() < 0.5 ? 0x5fa894 : 0x7a6e9a).multiplyScalar(x < BLACKWOOD_X ? 0.08 : 0.55));
    }
    this.scene.add(flora);
  }

  /** Meridian Field Station: tents, a lab cabin, dead floodlights. Someone left
   *  in a hurry, and something came in after they did. */
  private buildStation() {
    const S = STATION;
    const canvas = std(0xcfcac0, { roughness: 0.95 });
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
    const shell = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 3), std(0xb9bec4, { roughness: 0.7 }));
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
    const gb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1), std(0x3d4248, { metalness: 0.4 }));
    gb.position.y = 0.55;
    gen.add(gb);
    const gs = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.12, 1.02), std(0xd8a21c));
    gs.position.y = 0.8;
    gen.add(gs);
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
      const c = new THREE.Mesh(new THREE.BoxGeometry(1, 0.7, 0.8), std(0x59626b, { metalness: 0.5, roughness: 0.5 }));
      c.position.y = 0.35;
      const g = new THREE.Group();
      g.add(c);
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.12, 0.82), std(0xff6a00));
      st.position.y = 0.5;
      g.add(st);
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
    const stone = std(0x2c2838);
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
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 120, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x5cf0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
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
    const stone = std(0x2a2232);
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
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `
        varying vec2 vUv; uniform float uTime; uniform float uOpen;
        void main(){
          vec2 p = vUv - 0.5; float r = length(p)*2.0; float a = atan(p.y,p.x);
          float swirl = sin(a*5.0 + r*14.0 - uTime*3.0)*0.5+0.5;
          float edge = smoothstep(1.0,0.85,r);
          float core = smoothstep(0.9, 0.0, r);
          // rift colour language: cyan for the unknown, white at the heart of it
          vec3 col = mix(vec3(0.08,0.45,0.62), vec3(0.85,1.0,1.0), swirl * 0.7 + core * 0.5) * (0.4+core);
          float alpha = edge * (0.08 + 0.9*uOpen) * (0.4 + 0.6*swirl);
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    const rift = new THREE.Mesh(new THREE.CircleGeometry(9, 64), mat);
    rift.position.set(ARENA.x, ARENA.y + 11, ARENA.z + 14);
    this.scene.add(rift);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(9.3, 0.5, 8, 48), std(0x15191c, { emissive: 0x1d6c7c, emissiveIntensity: 0.6 }));
    frame.position.copy(rift.position);
    this.scene.add(frame);
    const light = new THREE.PointLight(0x7ae2ff, 2, 60, 1.2);
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
    const y = heightAt(x, z) + 1.1;
    mesh.position.set(x, y, z);
    const glow = new THREE.Sprite(this.shardGlow);
    glow.scale.setScalar(1.6);
    mesh.add(glow);
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
    const g = new THREE.Group();
    g.position.copy(CAMP);
    const stone = std(0x3c3a38, { flatShading: true, roughness: 1 });
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17 + (i % 3) * 0.03, 0), stone);
      st.position.set(Math.cos(a) * 0.82, 0.08, Math.sin(a) * 0.82);
      st.rotation.set(i, i * 2, 0);
      st.scale.y = 0.7;
      st.castShadow = true;
      g.add(st);
    }
    const logs = new THREE.Group();
    const wood = std(0x3a2416);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.3, 6), wood);
      l.rotation.z = Math.PI / 2 - 0.35;
      l.rotation.y = (i / 4) * Math.PI;
      l.position.y = 0.3;
      logs.add(l);
    }
    g.add(logs);
    const ash = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), std(0x111014));
    ash.rotation.x = -Math.PI / 2;
    ash.position.y = 0.03;
    g.add(ash);
    const flames: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(0.3 - i * 0.04, 1.15 - i * 0.12, 10),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xe8a24a : 0xd9561c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      f.position.set(Math.cos(i * 1.3) * 0.18, 0.75, Math.sin(i * 1.3) * 0.18);
      f.visible = false;
      g.add(f);
      flames.push(f);
    }
    const light = new THREE.PointLight(0xff8a3a, 0, 26, 1.5);
    light.position.y = 1.4;
    g.add(light);
    this.scene.add(g);
    this.colliders.push({ x: CAMP.x, z: CAMP.z, r: 1.0 });
    this.campfire = { group: g, light, flames, logs, lit: false, hp: 100, maxHp: 100 };
  }

  setCampfire(lit: boolean, maxHp = 100) {
    const c = this.campfire;
    c.lit = lit;
    c.maxHp = maxHp;
    c.hp = maxHp;
    for (const f of c.flames) f.visible = lit;
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
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff9a3a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
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
    this.hemi.intensity = mood.hemi;
    this.sun.intensity = mood.sun;
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
    this.skyTearMat.uniforms.uTime.value = t;

    // mood lerp
    const k = Math.min(1, dt * 0.8);
    const fog = this.scene.fog as THREE.FogExp2;
    const mood = this.zoneMood ? (MOODS[this.zoneMood] as Mood) : this.mood;
    this.moodFog.lerp(new THREE.Color(mood.fog), k);
    fog.color.copy(this.moodFog);
    (this.scene.background as THREE.Color).copy(this.moodFog);
    this.moodDensity += (mood.density - this.moodDensity) * k;
    this.fogBoostNow += (this.fogBoost - this.fogBoostNow) * Math.min(1, dt * 0.5);
    fog.density = this.moodDensity + this.fogBoostNow * 0.014;
    this.hemi.intensity += (mood.hemi - this.hemi.intensity) * k;
    this.sun.intensity += (mood.sun - this.sun.intensity) * k;
    const tint = this.skyMat.uniforms.uTint.value as THREE.Vector3;
    tint.lerp(new THREE.Vector3(...mood.tint), k);
    this.bigMoon.color.lerp(new THREE.Color(mood.blood ? 0xc8473c : 0xe4e0d6), k);

    // campfire
    const cf = this.campfire;
    if (cf.lit) {
      const f = Math.max(0.15, cf.hp / cf.maxHp);
      cf.light.intensity = (10 + 26 * f) * (0.8 + Math.random() * 0.4);
      cf.flames.forEach((m, i) => {
        m.scale.set(f, f * (0.75 + Math.sin(t * 10 + i * 1.9) * 0.25 + Math.random() * 0.15), f);
        m.rotation.y += dt * (i % 2 ? 2.5 : -2.5);
      });
    } else cf.light.intensity = 0;

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
    this.riftLight.intensity = 2 + this.riftOpen * 40 + Math.sin(t * 3) * 0.5;

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
    this.beaconMat.emissiveIntensity = Math.sin(t * 5) > 0 ? 3 : 0.2;
    this.beaconLight.intensity = Math.sin(t * 5) > 0 ? 5 : 0.3;

    for (const f of this.fires) {
      f.light.intensity = f.base * (0.75 + Math.random() * 0.5);
      f.flames.forEach((m, i) => {
        m.scale.y = 0.7 + Math.sin(t * 9 + i * 1.7) * 0.25 + Math.random() * 0.15;
        m.rotation.y += dt * (i % 2 ? 2 : -2);
      });
    }

    if (this.shards.some((s) => s.dynamic && s.taken)) {
      for (const s of this.shards) if (s.dynamic && s.taken) this.scene.remove(s.mesh);
      this.shards = this.shards.filter((s) => !(s.dynamic && s.taken));
    }
    for (const s of this.shards) {
      if (s.taken) continue;
      s.mesh.rotation.y += dt * 1.6;
      s.mesh.position.y = s.base + Math.sin(t * 2 + s.mesh.position.x) * 0.15;
    }

    for (const p of this.pylons) {
      const k = p.lit ? 1 : p.charge;
      p.rune.emissiveIntensity = 0.15 + k * 3 + (p.charge > 0 && !p.lit ? Math.sin(t * 10) * 0.3 : 0);
      p.light.intensity = k * 25;
      (p.beam.material as THREE.MeshBasicMaterial).opacity = p.lit ? 0.35 + Math.sin(t * 4) * 0.05 : 0;
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

    // embers from the fires
    const ep = this.embers.geometry.attributes.position as THREE.BufferAttribute;
    const d = this.emberData;
    for (let i = 0; i < ep.count; i++) {
      const j = i * 4;
      d[j + 3] -= dt;
      if (d[j + 3] <= 0) {
        const f = this.fires[i % this.fires.length].light.position;
        d[j] = f.x + (Math.random() - 0.5) * 2;
        d[j + 1] = f.y - 1.5;
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
