// THE WORLD REMEMBERS — Chapter One's Long Night.
//
// Each time the first night begins again, one more thing is different. Never
// announced; easy to think you imagined it:
//   2nd night  Rhea's first words change. A tree by the path has been marked.
//   3rd night  the Old Camp's fire is burning. The log by your fire has moved.
//              Out in the dark, somebody asks "Who's there?" in your voice.
//   4th night  the deep night's visitor doesn't come for you. It watches.
//   5th night  a page by the fire: the registry, your line, the ink still wet.
//              Rhea: the storm only ever starts when you wake up.
// Nothing here explains the loop. It only makes it harder not to notice.

import * as THREE from "three";
import { player, say, sfx, voice, world } from "./ctx";
import type { Enemy } from "./enemies";
import { spawnEcho, unfoundEchoes } from "./echo";
import { save } from "./save";
import * as S from "./script";
import { survival } from "./survival";
import { CAMP, heightAt, OLD_CAMP } from "./world";

const once = (k: string) => {
  if (save.flags["rm:" + k]) return false;
  save.flags["rm:" + k] = true;
  return true;
};

const MARK = new THREE.Vector3(-3.5, 0, 18.5);
const PAGE = new THREE.Vector3(CAMP.x + 1.1, 0, CAMP.z + 1.6);
/** Where an Echo might be waiting on a later night. */
const ECHO_SPOTS: [number, number][] = [[-34, 30], [22, 42], [-50, 22], [36, 4], [-18, 56], [60, 36], [-8, -14]];

let marked: THREE.Group | null = null;
let page: THREE.Mesh | null = null;
let whoT = -1;

function carved() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.strokeStyle = "rgba(205,180,140,0.95)";
  g.lineWidth = 6;
  g.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(26 + i * 18, 30);
    g.lineTo(28 + i * 18, 98);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(16, 84);
  g.lineTo(100, 40);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A dead trunk by the path, with a fresh mark cut into it. */
function buildMarkedTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 3.4, 9), new THREE.MeshStandardMaterial({ color: 0x3a3029, roughness: 1 }));
  trunk.position.y = 1.7;
  trunk.rotation.z = 0.06;
  trunk.castShadow = true;
  g.add(trunk);
  const cut = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshStandardMaterial({ map: carved(), transparent: true, roughness: 1 }));
  cut.position.set(0, 1.45, 0.215);
  g.add(cut);
  g.position.set(MARK.x, heightAt(MARK.x, MARK.z), MARK.z);
  g.rotation.y = Math.atan2(CAMP.x - MARK.x, CAMP.z - MARK.z); // the mark faces the fire
  world.scene.add(g);
  world.colliders.push({ x: MARK.x, z: MARK.z, r: 0.3 });
  return g;
}

function buildPage() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 320;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d8d0bc";
  g.fillRect(0, 0, 256, 320);
  g.fillStyle = "rgba(60,70,90,0.35)";
  for (let i = 0; i < 12; i++) g.fillRect(16, 30 + i * 24, 224, 1);
  g.fillStyle = "#1e2a44";
  g.font = 'italic 600 22px "Barlow", sans-serif';
  g.fillText("10001  ·  ACTIVE", 22, 150);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
  m.rotation.set(-Math.PI / 2, 0, 0.5);
  m.position.set(PAGE.x, heightAt(PAGE.x, PAGE.z) + 0.03, PAGE.z);
  world.scene.add(m);
  return m;
}

/** Put the world in the state of the nth night (cumulative, quietly). */
function apply(run: number) {
  if (run >= 1 && !marked) marked = buildMarkedTree();
  if (run >= 2) {
    if (world.oldCampFire) world.oldCampFire.lit = true;
    // the log you sit on is on the other side of the fire now
    if (survival.seatLog) {
      survival.seatLog.position.set(CAMP.x + 2.5, heightAt(CAMP.x + 2.5, CAMP.z + 1.0), CAMP.z + 1.0);
      survival.seatLog.rotation.y = -0.7;
    }
  }
  if (run >= 4 && !page) page = buildPage();
}

export const remembers = {
  /** Called once the night has begun again (survival.loopNight). */
  onLoop(run: number) {
    apply(run);
    whoT = run >= 2 && !save.flags["rm:who"] ? 28 : -1;
    // an Echo, somewhere it wasn't before
    const pool = unfoundEchoes();
    if (pool.length && !world.ghosts.length) {
      const [x, z] = ECHO_SPOTS[run % ECHO_SPOTS.length];
      spawnEcho(pool[Math.floor(Math.random() * pool.length)], x, z);
    }
    // what she says when you wake, again
    const lines = run === 1 ? S.LOOP_WAKE[1] : run === 2 ? S.LOOP_WAKE[2] : run === 3 ? S.LOOP_WAKE[3] : S.NIGHT_AGAIN;
    window.setTimeout(() => void say(lines), 1800);
    survival.stormLine = () => (run >= 4 ? S.STORM_WAKE : S.STORM_START);
    survival.onProwler = (e: Enemy) => {
      if (run < 3) return;
      // this one doesn't come for you. It stands where it can see you, and waits.
      e.bold = 0;
      e.courage = -5;
      e.keepOff = 17;
      watcher = e;
    };
  },

  /** A story that's already past a few nights (Continue, tests). */
  restore() {
    apply(survival.run);
  },

  update(dt: number) {
    const p = player.pos;
    if (marked && Math.hypot(p.x - MARK.x, p.z - MARK.z) < 3.2 && !voice.busy && once("mark")) void say(S.MARKED_TREE);
    if (world.oldCampFire?.lit && Math.hypot(p.x - OLD_CAMP.x, p.z - OLD_CAMP.z) < 16 && !voice.busy && once("oldfire")) void say(S.OLD_FIRE);
    if (page && Math.hypot(p.x - PAGE.x, p.z - PAGE.z) < 2.2 && !voice.busy && once("page")) void say(S.MEM_PAGE);
    // the deep night: a sound, a question, and your own voice asking it back
    if (whoT > 0 && survival.phase === "deep") {
      whoT -= dt;
      if (whoT <= 0 && once("who")) {
        voice.interrupt();
        sfx.twig(0.4);
        void say(S.WHO_THERE).then(() => {
          window.setTimeout(() => {
            void say(S.WHO_THERE_BACK);
            window.setTimeout(() => sfx.steps(3, 0.1), 2200);
          }, 2600);
        });
      }
    }
    // the watcher: if you walk at it, it isn't there any more
    if (watcher?.alive && Math.hypot(p.x - watcher.pos.x, p.z - watcher.pos.z) < 8) {
      const w = watcher;
      watcher = null;
      if (once("watcher")) void say(S.WATCHER);
      w.flee = 3;
      window.setTimeout(() => {
        if (w.alive) w.hp = 0;
        w.model.root.visible = false;
        w.state = "dead";
      }, 2500);
    }
  },
};
let watcher: Enemy | null = null;
