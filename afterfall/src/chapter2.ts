// CHAPTER II: THE THING IN THE DARK
//
// You're not surviving a crash any more. Something is keeping track of you.
//
//   TRACKS     Morning finds prints all the way round your fire, then a line of
//              them leading off toward the Blackwood. Follow them.
//   BLACKWOOD  It calls to you in Rhea's voice. Then two of them work you: one
//              stands in the trail, the other comes from behind.
//   THE ECHO   The prints end at somebody else's camp, laid out exactly like
//              yours. A patient who was here before sits at its fire for a while.
//              Their notebook: a list of numbers, all crossed out but the last.
//   RETURN     Back to the fire. Something follows at a distance.
//   LOST       Rhea, mid-sentence, and then nothing.
//   SIGNAL     Two pips on the radio, over and over, louder the closer you get.
//   THE CAMERA In the trees above the crash, a camera on a tripod under netting,
//              pointed at the wreck. It has been recording since 02:51.
//              The plane came down at 03:12. Cut to black.
//
// Death sends you back to the fire. What you learned stays learned: the Echo
// doesn't replay, the camp's notebook doesn't need reading twice.

import * as THREE from "three";
import { key } from "./cinematic";
import { cine, enemies, hud, LOW, persist, player, renderer, say, setObjective, sfx, state, voice, wait, world } from "./ctx";
import type { Enemy } from "./enemies";
import { Fire } from "./fire";
import { EVIDENCE } from "./history";
import { buildHumanoid } from "./models";
import { save } from "./save";
import * as S from "./script";
import { CAMP, ECHO2, heightAt, HIDE } from "./world";
export { ECHO2, HIDE };

export type Ch2Phase = "tracks" | "blackwood" | "echo" | "return" | "lost" | "signal" | "camera" | "done";

const CRASH = new THREE.Vector3(-12, 0, 30);

const TRAIL: [number, number][] = [[-3.5, 9], [-9, 13], [-15, 18], [-22, 21.5], [-29, 25], [-35, 28.5], [-41, 32], [-46, 37.5], [-50, 42], [ECHO2.x + 1.5, ECHO2.z - 1.5]];
const once = (k: string) => {
  if (save.flags["c2:" + k]) return false;
  save.flags["c2:" + k] = true;
  persist();
  return true;
};
const seen = (k: string) => !!save.flags["c2:" + k];
const dist = (a: THREE.Vector3 | { x: number; z: number }) => Math.hypot(player.pos.x - a.x, player.pos.z - a.z);
const mat = (color: number, rough = 0.9, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

// ------------------------------------------------------------------ the prints
function printTex() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(20,16,12,0.78)";
  // a bare foot, a little too long: heel, sole, five toes pressed deep
  g.beginPath();
  g.ellipse(32, 98, 13, 20, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(30, 62, 15, 26, 0.08, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.ellipse(18 + i * 7.5, 28 - Math.sin((i / 4) * Math.PI) * 6 + (i === 0 ? 4 : 0), 3.6 - i * 0.3, 5, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildPrints() {
  const spots: { x: number; z: number; a: number; s: number }[] = [];
  const step = (x0: number, z0: number, x1: number, z1: number, phase: { n: number }) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const a = Math.atan2(x1 - x0, z1 - z0);
    for (let d = 0; d < len; d += 0.78) {
      const k = d / len;
      const side = phase.n++ % 2 ? 1 : -1;
      spots.push({ x: x0 + (x1 - x0) * k + Math.cos(a) * 0.14 * side, z: z0 + (z1 - z0) * k - Math.sin(a) * 0.14 * side, a, s: side });
    }
  };
  const ph = { n: 0 };
  // all the way round the fire, just outside the light
  const R = 9.5;
  for (let i = 0; i < 64; i++) {
    const a0 = (i / 64) * Math.PI * 2;
    const a1 = ((i + 1) / 64) * Math.PI * 2;
    step(CAMP.x + Math.cos(a0) * R, CAMP.z + Math.sin(a0) * R, CAMP.x + Math.cos(a1) * R, CAMP.z + Math.sin(a1) * R, ph);
  }
  // then away, toward the Blackwood
  for (let i = 0; i < TRAIL.length - 1; i++) step(TRAIL[i][0], TRAIL[i][1], TRAIL[i + 1][0], TRAIL[i + 1][1], ph);
  const m = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.16, 0.34),
    new THREE.MeshStandardMaterial({ map: printTex(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }),
    spots.length,
  );
  const o = new THREE.Object3D();
  spots.forEach((p, i) => {
    o.position.set(p.x, heightAt(p.x, p.z) + 0.035, p.z);
    o.rotation.set(-Math.PI / 2, 0, p.a + Math.PI);
    o.scale.set(p.s, 1, 1); // left foot, right foot
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.renderOrder = 1;
  m.receiveShadow = true;
  m.frustumCulled = false;
  m.visible = false;
  world.scene.add(m);
  return m;
}

// ------------------------------------------------------------------ the other camp
function buildOtherCamp() {
  const g = new THREE.Group();
  g.position.copy(ECHO2);
  const fire = new Fire({ size: 0.85, logs: true, stones: true });
  fire.lit = false;
  g.add(fire.group);
  // the log where yours is, at the same angle
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.6, 8), mat(0x3a3029, 1));
  log.rotation.set(0, 0.5, Math.PI / 2);
  log.position.set(-2.4, 0.2, 1.3);
  g.add(log);
  // a notebook on the log, swollen with rain
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.26), mat(0x4a3a2c, 1));
  book.position.set(-2.3, 0.43, 1.25);
  book.rotation.y = 0.4;
  g.add(book);
  // a tarp that came down years ago, a tin cup, a tag wired to a stick
  const tarp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6, 4, 3), mat(0x2f3a35, 1, 0, { side: THREE.DoubleSide }));
  const tp = tarp.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) tp.setZ(i, Math.sin(tp.getX(i) * 2.2 + tp.getY(i)) * 0.06);
  tarp.geometry.computeVertexNormals();
  tarp.rotation.x = -Math.PI / 2;
  tarp.position.set(3.4, 0.05, 2.8);
  g.add(tarp);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 10), mat(0x8a8470, 0.5, 0.6));
  cup.position.set(0.9, 0.05, -1.2);
  cup.rotation.z = 1.4;
  g.add(cup);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.1, 5), mat(0x3a2f26, 1));
  stick.position.set(1.8, 0.55, -1.6);
  stick.rotation.z = 0.12;
  g.add(stick);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.004), mat(0xbab4ac, 0.5, 0.5));
  tag.position.set(1.85, 0.92, -1.58);
  g.add(tag);
  g.traverse((m) => ((m as THREE.Mesh).isMesh && ((m.castShadow = !LOW), (m.receiveShadow = true))));
  world.scene.add(g);
  world.colliders.push({ x: ECHO2.x, z: ECHO2.z, r: 0.9 });
  const at = (x: number, z: number) => new THREE.Vector3(ECHO2.x + x, 0, ECHO2.z + z);
  EVIDENCE.push(
    {
      id: "bw-ring",
      label: "Look at the fire ring",
      text: ["A ring of stones. A log to sit on, at the same angle as yours.", "The ash is years old.", "Somebody made camp here exactly the way you did."],
      patients: [],
      where: "The Blackwood",
      at: at(0, 0),
    },
    {
      id: "bw-list",
      label: "Open the notebook",
      text: ["Most of the pages are a tally. Then one is a list:", "0217. 0432. 0891. 4012.", "Each crossed out except the last. Under it, in the same hand: NEXT —", "The rest of the line is blank."],
      patients: ["0217", "0432", "0891", "4012"],
      where: "The Blackwood",
      at: at(-2.3, 1.25),
    },
  );
  return { fire };
}

// ------------------------------------------------------------------ the camera
function buildHide() {
  const g = new THREE.Group();
  g.position.copy(HIDE);
  g.rotation.y = Math.atan2(CRASH.x - HIDE.x, CRASH.z - HIDE.z); // +z faces the crash
  const metal = mat(0x2c2f33, 0.5, 0.7);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 1.45, 5), metal);
    leg.position.set(Math.cos(a) * 0.24, 0.7, Math.sin(a) * 0.24);
    leg.rotation.set(-Math.sin(a) * 0.17, 0, Math.cos(a) * 0.17);
    g.add(leg);
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.3), mat(0x23262a, 0.45, 0.6));
  body.position.set(0, 1.46, 0);
  g.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 14), mat(0x0d0e10, 0.2, 0.5));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 1.46, 0.24);
  g.add(lens);
  const glassRing = new THREE.Mesh(new THREE.CircleGeometry(0.052, 16), new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.05, metalness: 0.9 }));
  glassRing.position.set(0, 1.46, 0.341);
  g.add(glassRing);
  // the flip-out screen, on the side you'll stand on, showing what it sees
  const rt = new THREE.WebGLRenderTarget(LOW ? 192 : 320, LOW ? 120 : 200);
  const flip = new THREE.Group();
  flip.position.set(-0.19, 1.47, -0.04);
  flip.rotation.y = -Math.PI / 2 + 0.5;
  g.add(flip);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.125), new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false }));
  flip.add(screen);
  const oc = document.createElement("canvas");
  oc.width = 320;
  oc.height = 200;
  const overlayTex = new THREE.CanvasTexture(oc);
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.125), new THREE.MeshBasicMaterial({ map: overlayTex, transparent: true, toneMapped: false, depthWrite: false }));
  overlay.position.z = 0.0015;
  flip.add(overlay);
  const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.216, 0.14, 0.012), mat(0x23262a, 0.45, 0.6));
  hinge.position.z = -0.0075;
  flip.add(hinge);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.06), mat(0x23262a, 0.45, 0.6));
  arm.position.set(0.1, 0, -0.03);
  flip.add(arm);
  // the one light: a red pinprick, blinking
  const rec = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  rec.position.set(0.06, 1.57, 0.13);
  g.add(rec);
  // a weatherproof box and a battery, cabled; an aerial up the nearest trunk
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.24), mat(0x3d4232, 0.8));
  box.position.set(0.5, 0.13, -0.35);
  g.add(box);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.2, 4), metal);
  ant.position.set(0.5, 0.86, -0.35);
  g.add(ant);
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.05, 1.38, -0.1), new THREE.Vector3(0.2, 0.4, -0.25), new THREE.Vector3(0.4, 0.04, -0.3)]), new THREE.LineBasicMaterial({ color: 0x1a1a1a })));
  // a blind of camouflage netting behind it, strung between two cut poles:
  // from the trail it's just more dark between the trees
  const net = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.75, 10, 6), mat(0x2c3324, 1, 0, { side: THREE.DoubleSide }));
  const np = net.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < np.count; i++) np.setZ(i, Math.sin(np.getX(i) * 3.1 + np.getY(i) * 2) * 0.05 - Math.cos((np.getX(i) / 2.2) * Math.PI) * 0.12);
  net.geometry.computeVertexNormals();
  net.position.set(0, 0.95, -0.85);
  g.add(net);
  for (const x of [-1.1, 1.1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 2.0, 5), mat(0x3a2f26, 1));
    p.position.set(x, 1.0, -0.85);
    p.rotation.z = x * 0.04;
    g.add(p);
  }
  // cut branches leaned against it
  for (let i = 0; i < 5; i++) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 1.6, 4), mat(0x2e2a22, 1));
    br.position.set(-0.9 + i * 0.45, 0.75, -0.95);
    br.rotation.set(0.25, 0, (i - 2) * 0.12);
    g.add(br);
  }
  g.traverse((m) => ((m as THREE.Mesh).isMesh && m !== screen && m !== overlay && ((m.castShadow = !LOW), (m.receiveShadow = true))));
  world.scene.add(g);
  world.colliders.push({ x: HIDE.x, z: HIDE.z, r: 0.5 });
  // what the camera sees
  const feed = new THREE.PerspectiveCamera(38, 1.6, 0.3, 160);
  const lensWorld = new THREE.Vector3(0, 1.46, 0.3);
  g.updateMatrixWorld(true);
  feed.position.copy(g.localToWorld(lensWorld.clone()));
  feed.lookAt(CRASH.x, heightAt(CRASH.x, CRASH.z) + 1.2, CRASH.z);
  const screenWorld = new THREE.Vector3();
  screen.getWorldPosition(screenWorld);
  const screenNormal = new THREE.Vector3();
  flip.getWorldDirection(screenNormal);
  return { group: g, rt, feed, overlay: oc, overlayTex, rec, screen: screenWorld, normal: screenNormal, lens: feed.position.clone() };
}

/** REC, and when it started: before the plane came down. */
function drawOverlay(c: HTMLCanvasElement, secs: number) {
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = 0; y < c.height; y += 3) g.fillRect(0, y, c.width, 1);
  g.font = "600 17px monospace";
  g.fillStyle = "rgba(240,240,232,0.92)";
  g.fillText("CAM 2 · FALLSITE", 14, 166);
  g.fillText("REC START 02:51:07", 14, 188);
  if (Math.floor(secs * 2) % 2 === 0) {
    g.fillStyle = "#ff2a1a";
    g.beginPath();
    g.arc(22, 20, 6, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "rgba(240,240,232,0.92)";
  g.fillText("REC", 34, 26);
  g.strokeStyle = "rgba(240,240,232,0.5)";
  g.lineWidth = 2;
  g.strokeRect(150, 90, 20, 20); // centre mark
}

// ------------------------------------------------------------------ the chapter
class ChapterTwo {
  phase: Ch2Phase = "done";
  onEnd = () => {};
  private prints!: THREE.InstancedMesh;
  private hide!: ReturnType<typeof buildHide>;
  private t = 0;
  private herd: Enemy[] = [];
  private herdT = -1;
  private follower: Enemy | null = null;
  private pipT = 0;
  private feedOn = false;
  private feedSecs = 0;
  private mimicT = -1;
  private ghost: THREE.Group | null = null;

  build() {
    this.prints = buildPrints();
    buildOtherCamp();
    this.hide = buildHide();
    drawOverlay(this.hide.overlay, 0);
    this.hide.overlayTex.needsUpdate = true;
    if (seen("started")) this.prints.visible = true;
  }

  /** Morning after the first night. */
  start() {
    once("started");
    this.prints.visible = true;
    this.herd = [];
    this.herdT = -1;
    this.follower = null;
    this.mimicT = -1;
    this.to(seen("echo") ? (seen("lost") ? "signal" : "return") : "tracks");
  }

  private to(p: Ch2Phase) {
    this.phase = p;
    this.t = 0;
    const O = "II · THE THING IN THE DARK";
    if (p === "tracks") setObjective(O, "Follow the tracks.");
    if (p === "blackwood") setObjective(O, "Stay on the tracks.");
    if (p === "return") setObjective(O, "Go back to the fire.");
    if (p === "lost") setObjective(O, "");
    if (p === "signal") setObjective(O, "Follow the signal.");
    if (p === "camera") setObjective(O, "");
  }

  /** Where the world nudges you (the story's soft compass). */
  target(): THREE.Vector3 | null {
    if (this.phase === "tracks" || this.phase === "blackwood") return ECHO2;
    if (this.phase === "return") return CAMP;
    if (this.phase === "signal") return HIDE;
    return null;
  }

  interacts() {
    return [
      {
        pos: () => HIDE,
        r: 2.4,
        label: "Look at the screen",
        when: () => this.phase === "signal" && !cine.active,
        run: () => void this.theCamera(),
      },
    ];
  }

  /** Death: back to the fire. What you learned stays learned. */
  onDeath(deaths: number) {
    for (const e of this.herd) if (e.alive) enemies.remove(e);
    if (this.follower?.alive) enemies.remove(this.follower);
    this.herd = [];
    this.follower = null;
    this.herdT = -1;
    this.to(seen("echo") ? (seen("lost") ? "signal" : "return") : "tracks");
    if (this.phase === "tracks") this.recognized = deaths >= 1;
  }
  /** On a later attempt, the one in the trail knows you. */
  private recognized = false;

  update(dt: number) {
    if (this.phase === "done") return;
    this.t += dt;
    const p = player.pos;

    // TRACKS: the morning's first look, then follow them off
    if (this.phase === "tracks") {
      if (this.t > 2.5 && !voice.busy && once("ringSaid")) void say(S.CH2_RING);
      if (p.x < -38) {
        this.to("blackwood");
        this.mimicT = 6;
      }
      if (dist(ECHO2) < 9) this.reachEcho();
    }

    // BLACKWOOD: her voice from the wrong side, then two of them
    if (this.phase === "blackwood") {
      if (this.mimicT > 0) this.mimicT -= dt;
      else if (this.mimicT > -100 && !voice.busy) {
        this.mimicT = -999; // (waits for a quiet moment)
        if (once("mimic")) void this.mimic();
        this.herdT = 7;
      }
      if (this.herdT > 0) {
        this.herdT -= dt;
        if (this.herdT <= 0) this.springHerd();
      }
      this.herdUpdate(dt);
      if (dist(ECHO2) < 9) this.reachEcho();
    }

    // RETURN: something keeps pace, out of reach
    if (this.phase === "return") {
      if (!this.follower && this.t > 10 && dist(CAMP) > 40) {
        const behind = player.yaw + Math.PI;
        const e = enemies.spawn("hollow", new THREE.Vector3(p.x + Math.sin(behind) * 22, 0, p.z + Math.cos(behind) * 22), { rise: false });
        e.stalk = true;
        e.mind = "follow";
        e.mindT = 999;
        e.bold = 0;
        e.keepOff = 15;
        this.follower = e;
        if (once("followed")) window.setTimeout(() => !voice.busy && void say(S.CH2_FOLLOWED), 6000);
      }
      if (this.follower?.alive && dist(CAMP) < 18) {
        enemies.remove(this.follower); // gone at the edge of the light
        this.follower = null;
      }
      if (dist(CAMP) < 7 && !cine.active) void this.loseRhea();
    }

    // SIGNAL: two pips, closer and quicker as you come to it
    if (this.phase === "signal") {
      const d = dist(HIDE);
      const near = THREE.MathUtils.clamp(1 - d / 70, 0, 1);
      const dir = Math.atan2(HIDE.x - p.x, HIDE.z - p.z);
      const facing = Math.cos(dir - player.yaw) * 0.5 + 0.5;
      this.pipT -= dt;
      if (this.pipT <= 0 && !cine.active) {
        this.pipT = THREE.MathUtils.lerp(3.2, 0.7, near);
        sfx.signal(0.035 + 0.11 * near * (0.6 + 0.4 * facing), 0.96 + facing * 0.06);
        voice.static = Math.max(0.15, 0.7 - near * 0.6);
      }
      if (d < 16 && !voice.busy && once("hideNear")) void say(S.CH2_HIDE_NEAR);
    }

    // the recorder's light
    this.hide.rec.visible = Math.floor(state.elapsed * 1.2) % 2 === 0;
    if (this.feedOn) {
      this.feedSecs += dt;
      this.renderFeed();
    }
  }

  private async mimic() {
    sfx.twig(0.3);
    await wait(500);
    await say(S.CH2_MIMIC);
    await say(S.CH2_NOT_ME);
  }

  /** Two of them: one stands in the trail, the other comes from behind. */
  private springHerd() {
    const p = player.pos;
    const ahead = player.yaw;
    const front = enemies.spawn("hollow", new THREE.Vector3(p.x + Math.sin(ahead) * 15, 0, p.z + Math.cos(ahead) * 15), { rise: false });
    front.stalk = true;
    front.mind = "observe";
    front.mindT = 999;
    front.courage = -9;
    front.bold = 0;
    front.keepOff = 12;
    const back = enemies.spawn("hollow", new THREE.Vector3(p.x - Math.sin(ahead) * 17, 0, p.z - Math.cos(ahead) * 17), { rise: false, speedMul: 1.1 });
    back.stalk = true;
    back.mind = "stalk";
    back.mindT = 6;
    back.courage = 0.55;
    back.windup = 0.6;
    this.herd = [front, back];
    sfx.murmur(0.08);
    if (this.recognized && once("knows")) {
      // the second time, the one in the trail knows you
      void say(S.CH2_KNOWS).then(() => {
        if (front.alive) front.mind = "retreat";
        front.mindT = 999;
      });
    }
  }

  private herdUpdate(dt: number) {
    if (!this.herd.length) return;
    const [front, back] = this.herd;
    void dt;
    // once the one behind commits, the one in front closes
    if (front.alive && back.alive && (back.mind === "attack" || back.committed) && front.mind === "observe") {
      front.mind = "stalk";
      front.courage = 0.6;
      front.mindT = 5;
    }
    // hurt one and the other backs off into the trees
    for (const [a, b] of [[front, back], [back, front]] as const) {
      if (!a.alive && b.alive && b.mind !== "retreat") {
        b.mind = "retreat";
        b.mindT = 999;
      }
      if (b.alive && b.mind === "retreat" && dist(b.pos) > 30) enemies.remove(b);
    }
    if (this.herd.every((e) => !e.alive || !enemies.list.includes(e))) this.herd = [];
  }

  // -------------------------------------------------------------- the Echo
  private reachEcho() {
    for (const e of this.herd) if (e.alive) e.mind = "retreat";
    if (seen("echo")) {
      this.to("return");
      return;
    }
    void this.theEcho();
  }

  private async theEcho() {
    this.phase = "echo";
    once("echo");
    voice.interrupt();
    player.frozen = true;
    hud.prompt.classList.remove("show");
    enemies.clear();
    cine.begin(false);
    // a pale figure at the cold fire, and a pale fire under its hands
    const ghostFire = new Fire({ size: 0.6, ghost: true });
    ghostFire.group.position.copy(ECHO2);
    world.scene.add(ghostFire.group);
    const h = buildHumanoid({ cloth: 0xffffff, skin: 0xffffff, pants: 0xffffff, hair: 0xffffff });
    const gm = new THREE.MeshBasicMaterial({ color: 0xcfeef5, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    h.root.traverse((m) => (m as THREE.Mesh).isMesh && ((m as THREE.Mesh).material = gm));
    const seat = new THREE.Vector3(ECHO2.x - 1.3, ECHO2.y, ECHO2.z + 0.9);
    h.root.position.copy(seat);
    h.root.rotation.y = Math.atan2(ECHO2.x - seat.x, ECHO2.z - seat.z);
    h.root.scale.set(1, 0.72, 1); // hunched over the fire
    world.scene.add(h.root);
    this.ghost = h.root;
    sfx.ghost();
    document.body.classList.add("echoing");
    window.setTimeout(() => document.body.classList.remove("echoing"), 1700);
    const look = ECHO2.clone().setY(ECHO2.y + 0.9);
    const side = new THREE.Vector3(Math.sin(player.yaw + 1.2), 0, Math.cos(player.yaw + 1.2));
    const eye = look.clone().addScaledVector(side, 4.4).add(new THREE.Vector3(0, 0.7, 0));
    let tt = 0;
    cine.onTick = (dt) => {
      tt += dt;
      gm.opacity = Math.min(0.42, tt * 0.3) * (0.85 + Math.random() * 0.15);
    };
    cine.shot(key(eye, look), key(eye.clone().addScaledVector(side, -1.2), look), 30);
    await wait(1200);
    await cine.say(S.CH2_ECHO);
    // it gets up, looks your way, and walks off into the trees
    h.root.scale.set(1, 1, 1);
    const away = new THREE.Vector3(ECHO2.x - 9, 0, ECHO2.z + 7);
    h.root.rotation.y = Math.atan2(player.pos.x - seat.x, player.pos.z - seat.z);
    await wait(1400);
    h.root.rotation.y = Math.atan2(away.x - seat.x, away.z - seat.z);
    let k = 0;
    cine.onTick = (dt) => {
      k = Math.min(1, k + dt / 4);
      h.root.position.lerpVectors(seat, away, k);
      h.root.position.y = heightAt(h.root.position.x, h.root.position.z);
      gm.opacity = 0.42 * (1 - k) * (0.85 + Math.random() * 0.15);
    };
    await wait(4000);
    cine.onTick = undefined;
    world.scene.remove(h.root);
    world.scene.remove(ghostFire.group);
    ghostFire.dispose();
    this.ghost = null;
    const frag = document.getElementById("fragment")!;
    frag.innerHTML = `${S.CH2_ECHO_FRAGMENT}<small>Patient 4012</small>`;
    frag.classList.add("show");
    window.setTimeout(() => frag.classList.remove("show"), 4200);
    cine.end();
    player.frozen = false;
    await say(S.CH2_AFTER_ECHO);
    this.to("return");
  }

  // -------------------------------------------------------------- Rhea, gone
  private async loseRhea() {
    this.phase = "lost";
    if (this.follower?.alive) enemies.remove(this.follower);
    this.follower = null;
    this.t = 0;
    voice.interrupt();
    voice.static = 0.1;
    await say(S.CH2_RHEA_CUT);
    voice.interrupt();
    sfx.staticBurst(1.8, 0.2);
    await wait(2200);
    await say(S.CH2_RHEA_GONE);
    await wait(1800);
    once("lost");
    sfx.signal(0.08);
    await wait(1600);
    sfx.signal(0.08);
    await say(S.CH2_SIGNAL);
    this.to("signal");
  }

  // -------------------------------------------------------------- the camera
  renderFeed() {
    const h = this.hide;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(h.rt);
    renderer.render(world.scene, h.feed);
    renderer.setRenderTarget(prev);
    drawOverlay(h.overlay, this.feedSecs);
    h.overlayTex.needsUpdate = true;
  }

  private async theCamera() {
    this.phase = "camera";
    voice.interrupt();
    voice.static = 0;
    player.frozen = true;
    hud.prompt.classList.remove("show");
    enemies.clear();
    this.feedOn = true;
    this.feedSecs = 0;
    player.model.root.visible = false; // (you're standing right behind it)
    cine.begin(false);
    // the story doesn't tick during a cutscene: the feed runs off the camera's clock
    cine.onTick = (dt) => {
      this.feedSecs += dt;
      this.renderFeed();
    };
    // over the camera's shoulder, down at the wreck
    const lens = this.hide.lens;
    const fwd = new THREE.Vector3(CRASH.x - HIDE.x, 0, CRASH.z - HIDE.z).normalize();
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const target = CRASH.clone().setY(heightAt(CRASH.x, CRASH.z) + 1);
    const back = lens.clone().addScaledVector(fwd, -1.1).addScaledVector(right, 1.0).add(new THREE.Vector3(0, -0.05, 0));
    cine.shot(key(back, target), key(back.clone().addScaledVector(fwd, 0.4).addScaledVector(right, -0.3), target), 7);
    await wait(1800);
    await cine.say(S.CH2_CAMERA_1);
    // the screen, close
    const scr = this.hide.screen;
    const eye = scr.clone().addScaledVector(this.hide.normal, 0.2).add(new THREE.Vector3(0, 0.025, 0));
    cine.shot(key(eye, scr), key(eye.clone().lerp(scr, 0.25), scr), 9);
    await wait(1600);
    await cine.say(S.CH2_CAMERA_2);
    await wait(2600);
    // black. No sound.
    hud.blackout.style.transition = "none";
    hud.blackout.style.opacity = "1";
    sfx.ambienceTo(0, 0.1);
    this.feedOn = false;
    cine.onTick = undefined;
    await wait(2400);
    this.phase = "done";
    once("done");
    cine.end();
    player.model.root.visible = true;
    player.frozen = false;
    this.onEnd();
  }

  /** Testing: jump to a phase. */
  skip(p: Ch2Phase) {
    if (p === "signal" || p === "return") once("echo");
    if (p === "signal") once("lost");
    this.prints.visible = true;
    this.to(p);
  }
}

export const chapterTwo = new ChapterTwo();
