// The world on the other side of the rift: terrain, sky with two moons, the
// wrecked medevac plane, the ambulance the player wakes up in, alien forest,
// resonance pylons and the Warden's arena.

import * as THREE from "three";

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
  return h * crash * arena + (1 - arena) * -2;
}

export const AMBULANCE = { minX: -1.35, maxX: 1.35, minZ: -3.25, maxZ: 3.25 };
export const BEACON = new THREE.Vector3(-12.5, 0, 33);
export const PYLONS = [new THREE.Vector3(58, 0, 62), new THREE.Vector3(-62, 0, 88), new THREE.Vector3(18, 0, 122)];
export const ARENA = new THREE.Vector3(0, 0, 165);
for (const p of [BEACON, ...PYLONS, ARENA]) p.y = heightAt(p.x, p.z);

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
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });

export interface Shard {
  mesh: THREE.Mesh;
  taken: boolean;
  base: number;
}

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
  private spores: THREE.Points;
  private embers: THREE.Points;
  private emberData: Float32Array;
  private skyMat: THREE.ShaderMaterial;
  private shardGlow: THREE.SpriteMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.fog = new THREE.FogExp2(0x1d1533, 0.0115);
    scene.background = new THREE.Color(0x1d1533);

    // ---------- Sky ----------
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: `
        varying vec3 vDir; uniform float uTime;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 horizon = vec3(0.114,0.082,0.2);
          vec3 mid = vec3(0.16,0.05,0.28);
          vec3 top = vec3(0.02,0.01,0.06);
          vec3 c = mix(horizon, mid, smoothstep(0.0,0.25,h));
          c = mix(c, top, smoothstep(0.25,0.9,h));
          // aurora band
          float band = sin(vDir.x*6.0 + uTime*0.05) * 0.08 + 0.35;
          float a = exp(-pow((h-band)*9.0, 2.0)) * (0.5+0.5*sin(vDir.z*10.0+uTime*0.2));
          c += vec3(0.05,0.45,0.4) * a * 0.35;
          // stars
          vec3 p = floor(vDir*300.0);
          float s = step(0.997, hash(p)) * smoothstep(0.05,0.3,h);
          c += vec3(s) * (0.6+0.4*sin(uTime*3.0+hash(p)*20.0));
          gl_FragColor = vec4(c,1.0);
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
        new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.5, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      halo.scale.setScalar(r * 5);
      halo.position.copy(pos);
      scene.add(halo);
    };
    moon(38, 0xe6d9ff, new THREE.Vector3(-180, 220, 420));
    moon(16, 0x9ff3e4, new THREE.Vector3(120, 150, 450));

    // ---------- Lights ----------
    scene.add(new THREE.HemisphereLight(0x9a8be6, 0x24343a, 1.25));
    this.sun = new THREE.DirectionalLight(0xd8ccff, 1.6);
    this.sun.position.set(-40, 80, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -45;
    sc.right = sc.top = 45;
    sc.near = 1;
    sc.far = 220;
    this.sun.shadow.bias = -0.0005;
    scene.add(this.sun, this.sun.target);

    // ---------- Terrain ----------
    const size = 420;
    const seg = 180;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const cA = new THREE.Color(0x2a2340);
    const cB = new THREE.Color(0x1f3b3a);
    const cScorch = new THREE.Color(0x141014);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
      const n = Math.sin(x * 0.08) * Math.cos(z * 0.06) * 0.5 + 0.5;
      c.copy(cA).lerp(cB, n);
      const scorch = 1 - smoothstep(6, 26, Math.hypot(x + 6, z - 18));
      c.lerp(cScorch, scorch * 0.8);
      const arena = 1 - smoothstep(16, 26, Math.hypot(x - ARENA.x, z - ARENA.z));
      c.lerp(new THREE.Color(0x3a1424), arena * 0.7);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    ground.receiveShadow = true;
    scene.add(ground);

    // Skid trench from the crash.
    const trench = new THREE.Mesh(new THREE.PlaneGeometry(6, 40), new THREE.MeshStandardMaterial({ color: 0x0c0a0c, roughness: 1 }));
    trench.rotation.x = -Math.PI / 2;
    trench.rotation.z = 0.25;
    trench.position.set(-6, 0.03, 12);
    trench.receiveShadow = true;
    scene.add(trench);

    this.shardGlow = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: 0x55e8ff,
      transparent: true,
      opacity: 0.8,
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
    for (const p of PYLONS) this.pylons.push(this.buildPylon(p));
    const r = this.buildArena();
    this.rift = r.rift;
    this.riftMat = r.mat;
    this.riftLight = r.light;
    this.buildShards();

    // ---------- Particles ----------
    const sporeGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) sp.set([(Math.random() - 0.5) * 80, Math.random() * 20, (Math.random() - 0.5) * 80], i * 3);
    sporeGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.spores = new THREE.Points(
      sporeGeo,
      new THREE.PointsMaterial({ color: 0x9dffe0, size: 0.18, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
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
    const inner = std(0xb9c4c9, { roughness: 0.9 });
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

    const light = new THREE.PointLight(0xff3030, 6, 7, 1.6);
    light.position.set(0, 2.5, 0.5);
    g.add(light);

    this.scene.add(g);
    this.cameraBlockers.push(g);
    return { group: g, doorL, doorR, light, monitor, axe };
  }

  private buildPlane() {
    const hull = std(0xa4abb3, { metalness: 0.55, roughness: 0.5 });
    const dark = std(0x1a1c20, { roughness: 1 });
    const stripe = std(0x1f6bd1);
    const seg = (len: number, x: number, z: number, ry: number, broken: boolean) => {
      const g = new THREE.Group();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, len, 18, 1, true), hull);
      cyl.material.side = THREE.DoubleSide;
      cyl.rotation.z = Math.PI / 2;
      cyl.castShadow = cyl.receiveShadow = true;
      g.add(cyl);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(2.33, 2.33, len, 18, 1, true, 0.9, 0.35), stripe);
      s.rotation.z = Math.PI / 2;
      g.add(s);
      if (broken) {
        const scorch = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.35, 18), dark);
        scorch.rotation.y = Math.PI / 2;
        scorch.position.x = len / 2;
        g.add(scorch);
      }
      g.position.set(x, heightAt(x, z) + 1.6, z);
      g.rotation.y = ry;
      this.scene.add(g);
      this.cameraBlockers.push(g);
      for (let i = -len / 2 + 2; i <= len / 2 - 1; i += 3) {
        this.colliders.push({ x: x + Math.cos(ry) * i, z: z - Math.sin(ry) * i, r: 2.4 });
      }
      return g;
    };
    seg(12, -21, 30, 0, true);
    const nose = seg(9, -4.5, 37, -0.12, true);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.3, 3.2, 18), hull);
    cone.rotation.z = -Math.PI / 2;
    cone.position.x = 6.1;
    nose.add(cone);
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.6), std(0x16202b, { metalness: 0.8, roughness: 0.1 }));
    cockpit.position.set(5.4, 1.4, 0);
    nose.add(cockpit);
    this.colliders.push({ x: 2, z: 36.2, r: 2.2 });
    // tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.5, 0.25), hull);
    tail.position.set(-28, heightAt(-28, 30) + 3.8, 30);
    tail.rotation.z = -0.35;
    tail.castShadow = true;
    this.scene.add(tail);
    const logo = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.27), std(0xc4161c));
    logo.position.set(0.2, 0.4, 0);
    tail.add(logo);
    // detached wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(14, 0.35, 3.4), hull);
    wing.position.set(-22, 0.6, 20.5);
    wing.rotation.set(0.05, 0.35, 0.12);
    wing.castShadow = wing.receiveShadow = true;
    this.scene.add(wing);
    for (let i = -6; i <= 6; i += 2.5) this.colliders.push({ x: -22 + Math.cos(0.35) * i, z: 20.5 - Math.sin(0.35) * i, r: 1.4 });
    // engine
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 2.8, 12), dark);
    eng.rotation.z = Math.PI / 2;
    eng.position.set(-16, 0.9, 17.5);
    eng.castShadow = true;
    this.scene.add(eng);
    this.colliders.push({ x: -16, z: 17.5, r: 1.5 });

    // fires
    for (const [x, z, s] of [[-15, 30, 1.4], [-16, 17.5, 1], [-1.8, 36, 1.1], [4, 9, 0.6]] as const) {
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
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.55, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const canopyGeo = new THREE.IcosahedronGeometry(1, 0);
    const bulbGeo = new THREE.SphereGeometry(0.22, 6, 4);
    const trunks = new THREE.InstancedMesh(trunkGeo, std(0x1c1426), N);
    const canopy = new THREE.InstancedMesh(canopyGeo, std(0xffffff), N * 2);
    const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), N * 3);
    trunks.castShadow = canopy.castShadow = true;
    canopy.receiveShadow = true;
    const avoid = [new THREE.Vector3(-8, 0, 20), BEACON, ...PYLONS, ARENA];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const palette = [0x5b2a86, 0x1f7a6e, 0x7a2a5e, 0x2c4f9a];
    const bulbCols = [0x7dffe9, 0xff8af0, 0xb6ff6a];
    let ti = 0;
    let ci = 0;
    let bi = 0;
    let tries = 0;
    while (ti < N && tries++ < 5000) {
      const a = rand() * Math.PI * 2;
      const r = 26 + rand() * (WORLD_RADIUS - 20);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r + 30;
      if (Math.hypot(x, z) > WORLD_RADIUS + 15) continue;
      if (avoid.some((v) => Math.hypot(v.x - x, v.z - z) < (v === ARENA ? 32 : 14))) continue;
      const y = heightAt(x, z);
      const h = 4 + rand() * 6;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
      m.compose(p.set(x, y - 0.2, z), q, s.set(1, h, 1));
      trunks.setMatrixAt(ti, m);
      for (let k = 0; k < 2; k++) {
        const cs = 1.6 + rand() * 1.6;
        m.compose(p.set(x + (rand() - 0.5) * 1.5, y + h + k * 1.2, z + (rand() - 0.5) * 1.5), q, s.set(cs, cs * 0.8, cs));
        canopy.setMatrixAt(ci, m);
        canopy.setColorAt(ci++, new THREE.Color(palette[Math.floor(rand() * palette.length)]));
      }
      for (let k = 0; k < 3; k++) {
        m.compose(p.set(x + (rand() - 0.5) * 3, y + h - 0.6 - rand() * 1.5, z + (rand() - 0.5) * 3), q, s.setScalar(1));
        bulbs.setMatrixAt(bi, m);
        bulbs.setColorAt(bi++, new THREE.Color(bulbCols[Math.floor(rand() * 3)]));
      }
      this.colliders.push({ x, z, r: 0.7 });
      ti++;
    }
    trunks.count = ti;
    canopy.count = ci;
    bulbs.count = bi;
    this.scene.add(trunks, canopy, bulbs);

    // rocks
    const R = 70;
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), std(0x3a3548), R);
    rocks.castShadow = rocks.receiveShadow = true;
    let ri = 0;
    tries = 0;
    while (ri < R && tries++ < 3000) {
      const x = (rand() - 0.5) * 2 * WORLD_RADIUS;
      const z = (rand() - 0.5) * 2 * WORLD_RADIUS + 30;
      if (Math.hypot(x, z - 30) > WORLD_RADIUS) continue;
      if (Math.hypot(x + 6, z - 16) < 24) continue;
      if (avoid.some((v) => Math.hypot(v.x - x, v.z - z) < (v === ARENA ? 30 : 10))) continue;
      const sc = 0.6 + rand() * 1.8;
      q.setFromEuler(new THREE.Euler(rand(), rand() * 6, rand()));
      m.compose(p.set(x, heightAt(x, z) + sc * 0.3, z), q, s.set(sc, sc * 0.7, sc));
      rocks.setMatrixAt(ri++, m);
      if (sc > 1) this.colliders.push({ x, z, r: sc * 0.9 });
    }
    rocks.count = ri;
    this.scene.add(rocks);

    // glowing ground flora
    const F = 1400;
    const flora = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), F);
    for (let i = 0; i < F; i++) {
      const x = (rand() - 0.5) * 2 * WORLD_RADIUS;
      const z = (rand() - 0.5) * 2 * WORLD_RADIUS + 30;
      if (Math.hypot(x + 6, z - 16) < 14) {
        m.makeScale(0, 0, 0);
      } else {
        const sc = 0.5 + rand();
        m.compose(p.set(x, heightAt(x, z) + 0.2 * sc, z), q.identity(), s.setScalar(sc));
      }
      flora.setMatrixAt(i, m);
      flora.setColorAt(i, new THREE.Color(rand() < 0.5 ? 0x3affc8 : 0x9a6bff).multiplyScalar(0.7));
    }
    this.scene.add(flora);
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
          vec3 col = mix(vec3(0.5,0.1,0.9), vec3(0.2,1.0,0.9), swirl) * (0.4+core);
          float alpha = edge * (0.08 + 0.9*uOpen) * (0.4 + 0.6*swirl);
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    const rift = new THREE.Mesh(new THREE.CircleGeometry(9, 64), mat);
    rift.position.set(ARENA.x, ARENA.y + 11, ARENA.z + 14);
    this.scene.add(rift);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(9.3, 0.5, 8, 48), std(0x1a1520, { emissive: 0x5a1a8a, emissiveIntensity: 0.6 }));
    frame.position.copy(rift.position);
    this.scene.add(frame);
    const light = new THREE.PointLight(0x8a4aff, 2, 60, 1.2);
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
    for (const [x, z] of spots) {
      const mesh = new THREE.Mesh(geo, m);
      const y = heightAt(x, z) + 1.1;
      mesh.position.set(x, y, z);
      const glow = new THREE.Sprite(this.shardGlow);
      glow.scale.setScalar(1.6);
      mesh.add(glow);
      this.scene.add(mesh);
      this.shards.push({ mesh, taken: false, base: y });
    }
  }

  // ---------------------------------------------------------------- runtime

  update(dt: number, t: number, focus: THREE.Vector3) {
    this.skyMat.uniforms.uTime.value = t;
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
    this.interiorLight.intensity = 6 * flick;
    this.roofLights[0].emissiveIntensity = Math.sin(t * 8) > 0 ? 3 : 0.1;
    this.roofLights[1].emissiveIntensity = Math.sin(t * 8) > 0 ? 0.1 : 3;
    this.monitorMat.emissiveIntensity = 0.8 + (Math.sin(t * 6) > 0.85 ? 1.6 : 0);

    this.beaconMat.emissiveIntensity = Math.sin(t * 5) > 0 ? 3 : 0.2;
    this.beaconLight.intensity = Math.sin(t * 5) > 0 ? 5 : 0.3;

    for (const f of this.fires) {
      f.light.intensity = f.base * (0.75 + Math.random() * 0.5);
      f.flames.forEach((m, i) => {
        m.scale.y = 0.7 + Math.sin(t * 9 + i * 1.7) * 0.25 + Math.random() * 0.15;
        m.rotation.y += dt * (i % 2 ? 2 : -2);
      });
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
