// CHAPTER ONE: THE DROP — the scripted campaign.

import * as THREE from "three";
import { key } from "./cinematic";
import {
  $,
  bounds,
  camera,
  card,
  cine,
  enemies,
  fade,
  hud,
  type Interact,
  input,
  persist,
  pickupShards,
  pick,
  player,
  runInteractions,
  say,
  setObjective,
  sfx,
  state,
  toast,
  voice,
  wait,
  world,
} from "./ctx";
import { echoProgress, listenEcho, spawnEcho } from "./echo";
import type { Enemy } from "./enemies";
import { PlaneSet } from "./cinesets";
import { showRecords } from "./records";
import { markRegion } from "./regions";
import { CASE_POS, SHAPE_POS, Signs } from "./signs";
import { buildHumanoid, buildSpear, DEFAULT_LOOK } from "./models";
import { save } from "./save";
import * as S from "./script";
import { ARENA, BEACON, CAMP, heightAt, PYLONS } from "./world";
const SHAPE_X = SHAPE_POS.x;
const SHAPE_Z = SHAPE_POS.z;

type Stage = "intro" | "wake" | "outside" | "signs" | "fire" | "records" | "first" | "ambush" | "pylons" | "boss" | "ending" | "done";

export const story = {
  stage: "intro" as Stage,
  boss: null as Enemy | null,
  onComplete: () => {},
};

let checkpoint = new THREE.Vector3(0, 0.36, -1.2);
let activePylon = -1;
let pylonSpawned = 0;
let stageClock = 0;
let barkCd = 8;
let respawns = 0;
let bossHalf = false;
let bossLow = false;
let firstShardSaid = false;
const waveTimers: { at: number; n: number; kind: "hollow" | "runner" }[] = [];

// Chapter One set dressing lives in the world for every mode (the tracks are
// still there on the hundredth night).
const signs = new Signs(world.scene, world.ambulance);
let signStep = 0;
let seenFor = 0;
let fireFoundSaid = false;
let firstHollow: Enemy | null = null;
const AMB_SIDE = new THREE.Vector3(2.8, 0, 0.3);

// ------------------------------------------------------------------ COLD OPEN
async function coldOpen() {
  cine.begin();
  const caps = $("captions");
  hud.blackout.style.transition = "none";
  hud.blackout.style.opacity = "1";
  sfx.drone(true);
  const beat = 0; // the heart monitor in the cabin carries the pulse now

  // 1. Black. Typed transfer manifest.
  for (const line of S.COLD_OPEN_CAPTIONS) {
    if (cine.skipped) break;
    const el = document.createElement("div");
    el.className = "cap";
    el.textContent = line;
    caps.appendChild(el);
    sfx.beep();
    await cine.wait(1500);
  }
  await cine.wait(500);
  caps.classList.add("out");

  // 2. The flight, on screen: the plane in the clouds, the cockpit, the cabin.
  if (!cine.skipped) {
    const set = new PlaneSet(world.scene, world, save.look ?? DEFAULT_LOOK);
    set.onBeat = () => sfx.monitor();
    let tt = 0;
    cine.onTick = (dt) => {
      tt += dt;
      set.update(dt, tt, voice.busy);
      if (set.shaking) cine.shake = Math.max(cine.shake, 0.12 * set.shaking);
    };
    world.setMood("night");
    hud.blackout.style.transition = "opacity 1.6s ease";
    hud.blackout.style.opacity = "0";
    for (const b of S.COLD_OPEN_BEATS) {
      if (cine.skipped) break;
      for (const c of b.cue ?? []) {
        set.cue(c);
        if (c === "alarm") sfx.alarm();
        if (c === "beep") sfx.beep();
        if (c === "flood") {
          sfx.whoosh();
          sfx.rumble();
        }
      }
      const sh = set.shot(b.shot);
      cine.shot(sh.from, sh.to, sh.dur);
      await cine.say(b.lines);
      if (b.hold) await cine.wait(b.hold * 1000);
    }
    await cine.wait(1200);
    $("flash").classList.add("go");
    await cine.wait(700);
    set.dispose();
    cine.onTick = undefined;
  }
  sfx.drone(false);

  // 3. Cut outside: the sky tears, the plane falls, a Hollow watches.
  // Shot from the open crash scar so the trees frame the sky instead of hiding it.
  const camA = new THREE.Vector3(18, heightAt(18, 46) + 1.6, 46);
  const crash = new THREE.Vector3(-12, 1.5, 31);
  const dir = crash.clone().sub(camA).setY(0).normalize();
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  const tearPos = crash.clone().addScaledVector(dir, 110).setY(150);
  const watcher = buildHumanoid({ cloth: 0x3b2e24, skin: 0x8a6a52, pants: 0x2a221c, mask: 0xe8e0cc, eye: 0xff6a20 });
  watcher.weapon.add(buildSpear());
  const wPos = camA.clone().addScaledVector(dir, 3.2).addScaledVector(perp, 1.3);
  wPos.y = heightAt(wPos.x, wPos.z);
  watcher.root.position.copy(wPos);
  watcher.root.rotation.y = Math.atan2(crash.x - wPos.x, crash.z - wPos.z);
  watcher.armR.rotation.x = -0.4;
  world.scene.add(watcher.root);

  if (!cine.skipped) {
    $("flash").classList.add("go");
    hud.blackout.style.transition = "opacity .2s";
    hud.blackout.style.opacity = "0";
    world.skyTear.visible = true;
    world.skyTear.position.copy(tearPos);
    world.skyTear.lookAt(camA);
    world.setMood("night");
    sfx.rumble();

    let t = 0;
    const plane = world.fallingPlane;
    cine.onTick = (dt) => {
      t += dt;
      const open = Math.min(1, t / 3);
      world.skyTear.scale.setScalar(0.05 + open * 1.7);
      world.skyTearMat.uniforms.uOpen.value = open * (t > 9 ? Math.max(0, 1 - (t - 9) / 3) : 1);
      const k = (t - 2.4) / 6.4;
      if (k > 0 && k < 1) {
        if (!plane.visible) {
          plane.visible = true;
          sfx.whoosh();
        }
        const e = k * k; // accelerating dive
        const p = new THREE.Vector3().lerpVectors(tearPos, crash, e);
        p.y += Math.sin(k * Math.PI) * 10;
        const next = new THREE.Vector3().lerpVectors(tearPos, crash, Math.min(1, (k + 0.02) ** 2));
        plane.position.copy(p);
        plane.lookAt(next);
        plane.rotateZ(Math.sin(t * 2) * 0.3 + 0.4);
        plane.scale.setScalar(1);
      } else if (k >= 1 && plane.visible) {
        plane.visible = false;
        sfx.crash();
        cine.shake = 1.2;
        $("flash").classList.remove("go");
        void $("flash").offsetWidth;
        $("flash").classList.add("go");
      }
    };
    await cine.shot(key(camA, tearPos), key(camA.clone().add(new THREE.Vector3(-1, 0.4, -1)), tearPos.clone().lerp(crash, 0.3)), 3.4);
    await cine.shot(
      key(camA.clone().add(new THREE.Vector3(-1, 0.4, -1)), tearPos),
      key(camA.clone().add(new THREE.Vector3(-7, -0.6, -6)), crash),
      5.6,
      { track: () => (plane.visible ? plane.position : crash) },
    );
    // 4. The watcher counts. Over his shoulder, toward the burning wreck.
    const behind = wPos.clone().addScaledVector(dir, -2.4).addScaledVector(perp, 0.9).setY(wPos.y + 1.9);
    const look = crash.clone().setY(2.5);
    const closer = behind.clone().addScaledVector(dir, 0.9).setY(wPos.y + 1.8);
    cine.shot(key(behind, look), key(closer, look), 7);
    await cine.say(S.COLD_OPEN_WATCHERS);
    await cine.wait(400);
  }

  // 5. Title slam.
  if (!cine.skipped) {
    $("titlecard").classList.add("show");
    sfx.sting();
    await cine.wait(4200);
  }
  // Clean end state whether or not the player skipped.
  $("titlecard").classList.remove("show");
  hud.blackout.style.transition = "opacity .6s";
  hud.blackout.style.opacity = "1";
  await wait(650);
  clearInterval(beat);
  sfx.drone(false);
  caps.innerHTML = "";
  caps.classList.remove("out");
  hud.blackout.classList.remove("alarm");
  world.scene.remove(watcher.root);
  world.fallingPlane.visible = false;
  world.skyTear.visible = false;
  cine.end();
}

// ------------------------------------------------------------------ ACT I
export async function startStory() {
  state.mode = "story";
  story.stage = "intro";
  state.exited = false;
  player.firstPerson = true;
  player.frozen = true;
  player.pos.set(0, 0.36, -1.2);
  player.yaw = 0;
  world.setMood("night");
  world.setCampfire(false); // the pit is cold until the Long Night
  for (const [id, x, z] of [
    [0, -31, 23],
    [3, -46, 72],
    [10, CAMP.x + 1.6, CAMP.z + 1.2],
  ]) {
    if (!world.ghosts.some((g) => g.echoId === id)) spawnEcho(id, x, z);
  }

  await coldOpen();

  // WAKE
  story.stage = "wake";
  state.runStart = state.elapsed;
  hud.root.classList.add("show");
  player.frozen = false;
  player.pitch = 0.35;
  hud.blackout.style.transition = "opacity 4s ease";
  hud.blackout.style.opacity = "0";
  $("blur").classList.add("waking");
  sfx.siren(true);
  setTimeout(() => sfx.siren(false), 6000);
  setObjective("PROLOGUE · WAKE", "Look around. Get out of the ambulance.");
  sfx.startAmbience();
  await say(S.WAKE);
  if (story.stage === "wake" && !player.hasAxe) setObjective("PROLOGUE · WAKE", "Take the fire axe from the wall.");
}

async function goOutside() {
  story.stage = "outside";
  checkpoint = new THREE.Vector3(0, 0, 6);
  voice.interrupt();
  // Crane-up reveal of the alien sky.
  cine.begin(false);
  const p = player.pos.clone();
  const from = key(camera.position, p.clone().add(new THREE.Vector3(0, 1.7, 6)));
  const to = key(p.clone().add(new THREE.Vector3(3, 4.5, -6)), p.clone().add(new THREE.Vector3(-30, 40, 80)));
  player.firstPerson = false;
  player.camDist = 5;
  player.model.root.visible = true;
  sfx.sting();
  cine.shot(from, to, 4.5);
  await cine.say(S.REVEAL.slice(0, 4));
  cine.end();
  player.pitch = -0.1;
  markRegion("fallsite");
  card("CHAPTER ONE", "THE FALLSITE", "Find the black box", 3000);
  setObjective("CHAPTER 1 · THE FALLSITE", "Reach the plane wreck and find the black-box beacon.");
  await say(S.REVEAL.slice(4));
}

async function beaconFound() {
  story.stage = "signs";
  signStep = -1; // nothing triggers until the recording is done
  checkpoint = BEACON.clone().add(new THREE.Vector3(3, 0, -4));
  setObjective("CHAPTER 1 · THE FALLSITE", "Listen.");
  await say(S.BLACK_BOX_FIND);
  if (story.stage !== "signs") return;
  await blackBoxFlashback();
  await say(S.BLACK_BOX);
  if (story.stage !== "signs") return;
  startSigns();
}

// ------------------------------------------------------------------ THE SIGNS
// Tracks → marks → breath → a shape → a voice. Then the fire, the records,
// and one Hollow walking into the light.
function startSigns() {
  story.stage = "signs";
  signStep = 0;
  seenFor = 0;
  checkpoint = new THREE.Vector3(3.5, 0, -3);
  sfx.ambienceTo(0.07, 6); // the wind drops away
  setObjective("CHAPTER 1 · THE FALLSITE", "Go back to the ambulance.");
}

async function signsSequence(step: number) {
  signStep = step;
  if (step === 1) {
    await say(S.SIGN_TRACKS);
  } else if (step === 2) {
    await say(S.SIGN_MARKS);
    await wait(1200);
    if (story.stage !== "signs") return;
    sfx.breath(3);
    await wait(2600);
    await say(S.SIGN_BREATH);
    if (story.stage !== "signs") return;
    signs.showShape(true);
    signStep = 3;
    setObjective("CHAPTER 1 · THE FALLSITE", "Look around.");
  } else if (step === 4) {
    await say(S.SIGN_SHAPE.slice(0, 2));
    signs.showShape(false); // gone between one look and the next
    sfx.ambienceTo(0.02, 0.4);
    await say(S.SIGN_SHAPE.slice(2));
    await wait(900);
    await say(S.SIGN_VOICE);
    if (story.stage !== "signs") return;
    sfx.ambienceTo(0.1, 4);
    story.stage = "fire";
    checkpoint = CAMP.clone().add(new THREE.Vector3(-2, 0, -2));
    setObjective("CHAPTER 1 · THE FALLSITE", "Light the fire pit beside the ambulance.");
  }
}

async function readRecords() {
  story.stage = "first";
  player.frozen = true;
  hud.prompt.classList.remove("show");
  await showRecords();
  player.frozen = false;
  setObjective("CHAPTER 1 · THE FALLSITE", "Patient 10001. Active.");
  await say(S.RECORDS_READ);
  if (story.stage !== "first") return;
  spawnFirstHollow(true);
}

/** One of them walks into the firelight. Not a wave: one. */
async function spawnFirstHollow(cinematic: boolean) {
  const dir = new THREE.Vector3(SHAPE_X - CAMP.x, 0, SHAPE_Z - CAMP.z).normalize();
  const at = CAMP.clone().addScaledVector(dir, 15);
  firstHollow = enemies.spawn("hollow", at, { rise: false, speedMul: 0.55, hpMul: 1.4 });
  barkCd = 14; // let it speak its own line first
  setObjective("CHAPTER 1 · THE FALLSITE", "It's coming into the light.");
  sfx.ambienceTo(0.03, 1);
  if (!cinematic) return;
  cine.begin(false);
  const eye = player.pos.clone().addScaledVector(dir, -2.2).add(new THREE.Vector3(0.6, 1.7, 0));
  const look = at.clone().setY(at.y + 1.4);
  cine.shot(key(eye, look), key(eye.clone().addScaledVector(dir, 0.8), look), 4.2);
  await cine.say(S.FIRST_HOLLOW);
  cine.end();
}

async function firstHollowDown() {
  firstHollow = null;
  sfx.ambienceTo(0.18, 3);
  await say(S.FIRST_HOLLOW_DOWN);
  if (story.stage !== "first") return;
  startAmbush();
}

/** The recording plays over what it describes: Okafor alone at the stick. */
async function blackBoxFlashback() {
  cine.begin();
  document.body.classList.add("flashback");
  const set = new PlaneSet(world.scene, world, save.look ?? DEFAULT_LOOK);
  set.flashback();
  set.onBeat = () => sfx.monitor();
  let tt = 0;
  cine.onTick = (dt) => {
    tt += dt;
    set.update(dt, tt, voice.busy);
    cine.shake = Math.max(cine.shake, 0.06);
  };
  sfx.alarm();
  const shots = ["okaforClose", "dezSeat", "cabinAlarm", "okaforClose"];
  for (let i = 0; i < S.BLACK_BOX_LOG.length; i++) {
    if (cine.skipped) break;
    const sh = set.shot(shots[i] ?? "okaforClose");
    cine.shot(sh.from, sh.to, sh.dur);
    await cine.say([S.BLACK_BOX_LOG[i]]);
  }
  set.dispose();
  document.body.classList.remove("flashback");
  cine.end();
}

// ------------------------------------------------------------------ ACT II
function startAmbush() {
  story.stage = "ambush";
  checkpoint = CAMP.clone().add(new THREE.Vector3(-2, 0, -2));
  stageClock = 0;
  waveTimers.length = 0;
  waveTimers.push({ at: 0.2, n: 3, kind: "hollow" }, { at: 7, n: 2, kind: "runner" }, { at: 14, n: 2, kind: "hollow" });
  sfx.roar();
  card("CHAPTER TWO", "THE HOLLOW", "They used to be patients", 2600);
  setObjective("CHAPTER 2 · THE HOLLOW", "Survive the Hollow ambush.");
  say(S.AMBUSH_START);
}

async function ambushCleared() {
  story.stage = "pylons";
  activePylon = -1;
  setObjective("CHAPTER 3 · RESONANCE", "Activate the resonance pylons (0/3).");
  await say(S.AMBUSH_CLEARED);
  if (story.stage === "pylons") card("CHAPTER THREE", "RESONANCE", "Light the three towers", 2800);
}

async function pylonLit(i: number) {
  const lit = world.pylons.filter((p) => p.lit).length;
  sfx.charge();
  sfx.sting();
  toast(`Tower ${lit}/3 resonating`);
  checkpoint = PYLONS[i].clone().add(new THREE.Vector3(0, 0, -8));
  activePylon = -1;
  setObjective("CHAPTER 3 · RESONANCE", `Activate the resonance pylons (${lit}/3).`);
  if (lit === 3) {
    story.stage = "boss";
    checkpoint = ARENA.clone().add(new THREE.Vector3(0, 0, -34));
    sfx.rumble();
    setObjective("CHAPTER 4 · THE WARDEN", "Follow the beams north to the stone circle.");
  }
  await say(S.PYLON_LIT[lit - 1]);
}

// ------------------------------------------------------------------ ACT III
async function spawnBoss() {
  bossHalf = bossLow = false;
  const b = enemies.spawn("warden", ARENA.clone());
  story.boss = b;
  sfx.roar();
  cine.begin(false);
  const look = ARENA.clone().add(new THREE.Vector3(0, 3.5, 0));
  card("CHAPTER FOUR", "THE WARDEN", "Patient One", 3200);
  await cine.shot(
    key(ARENA.clone().add(new THREE.Vector3(5, 1.2, -11)), look),
    key(ARENA.clone().add(new THREE.Vector3(2.5, 0.8, -8)), look.clone().add(new THREE.Vector3(0, 1.5, 0))),
    3.6,
  );
  cine.end();
  hud.bossName.textContent = "THE WARDEN · PATIENT ONE";
  hud.bossBar.classList.add("show");
  setObjective("CHAPTER 4 · THE WARDEN", "Defeat the Warden. Jump or dodge out of the red ring.");
  await say(S.WARDEN_INTRO);
}

async function bossDefeated() {
  story.stage = "ending";
  hud.bossBar.classList.remove("show");
  state.slowMo = 0.25;
  setTimeout(() => (state.slowMo = 1), 1600);
  voice.interrupt();
  setObjective("EPILOGUE", "The rift is opening…");
  await say(S.WARDEN_DEATH);
  // Orbit the opening rift.
  cine.begin(false);
  const r = world.rift.position.clone();
  let a = -0.6;
  cine.onTick = (dt) => {
    world.riftOpen = Math.min(1, world.riftOpen + dt * 0.35);
    a += dt * 0.08;
  };
  sfx.rumble();
  const around = (ang: number, d: number, h: number) => r.clone().add(new THREE.Vector3(Math.sin(ang) * d, h - 6, -Math.cos(ang) * d));
  cine.shot(key(around(-0.6, 30, 2), r), key(around(0.5, 20, 0), r), 14);
  await cine.say(S.EPILOGUE);
  void a;
  await fade(1, 2500);
  cine.end();
  story.stage = "done";
  save.storyDone = true;
  persist();
  story.onComplete();
}

// ------------------------------------------------------------------ interactions
const interacts: Interact[] = [
  {
    pos: () => new THREE.Vector3(-1.0, 0.36, 1.6),
    r: 1.6,
    label: "Take the fire axe",
    when: () => story.stage === "wake" && !player.hasAxe,
    run: () => {
      player.equipAxe();
      world.axeProp.visible = false;
      sfx.pickup();
      toast("Fire axe. Left mouse or F to swing. The third hit in a row is heavy.", 3500);
      setObjective("PROLOGUE · WAKE", "Kick open the rear doors.");
      voice.interrupt();
      say(S.TAKE_AXE);
    },
  },
  {
    pos: () => new THREE.Vector3(0, 0.36, 3.0),
    r: 1.7,
    label: "Kick open the rear doors",
    when: () => story.stage === "wake" && player.hasAxe && world.doorsTarget === 0,
    run: () => {
      world.doorsTarget = 1;
      sfx.door();
      player.shake = 0.3;
      setObjective("PROLOGUE · WAKE", "Step outside.");
    },
  },
  {
    pos: () => BEACON,
    r: 2.6,
    label: "Play the black box",
    when: () => story.stage === "outside",
    run: () => {
      sfx.beep();
      beaconFound();
    },
  },
  {
    pos: () => CAMP,
    r: 3.2,
    label: "Light the fire",
    when: () => story.stage === "fire",
    run: async () => {
      story.stage = "records";
      world.setCampfire(true);
      sfx.ignite();
      sfx.ambienceTo(0.16, 3);
      setObjective("CHAPTER 1 · THE FALLSITE", "Read the Meridian case by the stones.");
      voice.interrupt();
      await say(S.FIRE_LIT);
    },
  },
  {
    pos: () => CASE_POS,
    r: 2.0,
    label: "Read the Meridian records",
    when: () => story.stage === "records" && !voice.busy,
    run: () => {
      readRecords();
    },
  },
  ...PYLONS.map((p, i) => ({
    pos: () => p,
    r: 6,
    label: "Touch the tower",
    when: () => story.stage === "pylons" && activePylon === -1 && !world.pylons[i].lit,
    run: () => {
      activePylon = i;
      pylonSpawned = 0;
      world.pylons[i].charge = 0.01;
      sfx.charge();
      enemies.spawnAround(p, 3, 14, 20, i === 2 ? "runner" : "hollow");
      if (i === 0) say(S.PYLON_TOUCH);
      setObjective("CHAPTER 3 · RESONANCE", "Stay inside the ring while the tower charges.");
    },
  })),
];

/** Echo interaction picks whichever ghost is closest. */
function echoInteract(): Interact | null {
  let best = null;
  let bd = Infinity;
  for (const g of world.ghosts) {
    const d = Math.hypot(g.pos.x - player.pos.x, g.pos.z - player.pos.z);
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  if (!best) return null;
  const g = best;
  return { pos: () => g.pos, r: 2.4, label: `Listen to the Echo <span class="dim">${echoProgress()}</span>`, when: () => state.exited, run: () => listenEcho(g) };
}

// ------------------------------------------------------------------ hooks
export function storyOnDeath(e: Enemy) {
  if (e.kind === "warden" && state.mode === "story") bossDefeated();
  if (e === firstHollow && state.mode === "story") firstHollowDown();
}

export async function storyPlayerDown() {
  state.dead = true;
  voice.interrupt();
  $("dead").classList.add("show");
  await wait(1200);
  say(S.RESPAWN[respawns++ % S.RESPAWN.length]);
  await wait(2200);
  enemies.clear();
  player.pos.copy(checkpoint);
  player.pos.y = bounds.groundAt(checkpoint.x, checkpoint.z);
  player.hp = player.maxHp;
  player.medkits = Math.max(player.medkits, 1);
  player.invuln = 2;
  if (story.stage === "first") spawnFirstHollow(false);
  if (story.stage === "ambush") startAmbush();
  if (story.stage === "pylons" && activePylon >= 0) {
    world.pylons[activePylon].charge = 0;
    activePylon = -1;
    setObjective("CHAPTER 3 · RESONANCE", `Activate the resonance pylons (${world.pylons.filter((p) => p.lit).length}/3).`);
  }
  if (story.stage === "boss" && story.boss) {
    story.boss = null;
    hud.bossBar.classList.remove("show");
    setObjective("CHAPTER 4 · THE WARDEN", "Return to the stone circle.");
  }
  $("dead").classList.remove("show");
  state.dead = false;
}

export function storyTarget(): THREE.Vector3 | null {
  switch (story.stage) {
    case "outside":
      return BEACON;
    case "signs":
      return signStep >= 0 && signStep < 2 ? AMB_SIDE : null;
    case "fire":
      return CAMP;
    case "records":
      return CASE_POS;
    case "pylons": {
      if (activePylon >= 0) return null;
      let best: THREE.Vector3 | null = null;
      let bd = Infinity;
      for (const p of world.pylons) {
        if (p.lit) continue;
        const d = p.pos.distanceTo(player.pos);
        if (d < bd) {
          bd = d;
          best = p.pos;
        }
      }
      return best;
    }
    case "boss":
      return story.boss ? null : ARENA;
    default:
      return null;
  }
}

export function storyUpdate(dt: number) {
  stageClock += dt;
  if (player.hp <= 0 && !state.dead) {
    storyPlayerDown();
    return;
  }

  if (story.stage === "wake" && !state.exited && player.pos.z > 3.9) {
    state.exited = true;
    goOutside();
  }

  const echo = echoInteract();
  runInteractions(echo ? [...interacts, echo] : interacts);

  if (state.exited)
    pickupShards(() => {
      if (!firstShardSaid) {
        firstShardSaid = true;
        say(S.FIRST_SHARD);
      }
    });

  signs.update(dt, state.elapsed);
  if (story.stage === "signs" && signStep >= 0 && !cine.active) {
    const p = player.pos;
    if (signStep === 0 && signs.nearTrack(p) < 1.6) signsSequence(1);
    else if (signStep <= 1 && !voice.busy && Math.hypot(p.x - AMB_SIDE.x, p.z - AMB_SIDE.z) < 2.6) signsSequence(2);
    else if (signStep === 3) {
      seenFor += signs.shapeSeen(camera) ? dt : 0;
      if (seenFor > 0.9 || (signs.shapeT > 14 && !voice.busy)) signsSequence(4);
    }
  }
  if (story.stage === "fire" && !fireFoundSaid && !voice.busy && Math.hypot(player.pos.x - CAMP.x, player.pos.z - CAMP.z) < 6) {
    fireFoundSaid = true;
    say(S.FIRE_FOUND);
  }

  if (story.stage === "ambush") {
    for (const w of waveTimers) {
      if (w.n > 0 && stageClock >= w.at) {
        enemies.spawnAround(player.pos, w.n, 15, 20, w.kind);
        w.n = 0;
      }
    }
    if (waveTimers.length && waveTimers.every((w) => w.n === 0) && enemies.aliveCount === 0) {
      waveTimers.length = 0;
      ambushCleared();
    }
  }

  if (story.stage === "pylons" && activePylon >= 0) {
    const p = world.pylons[activePylon];
    const inside = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) < 6;
    if (inside) p.charge = Math.min(1, p.charge + dt / 14);
    hud.objective.textContent = inside ? `Charging tower… ${Math.round(p.charge * 100)}%` : "Get back inside the ring!";
    if (p.charge > 0.45 && pylonSpawned === 0) {
      pylonSpawned = 1;
      enemies.spawnAround(p.pos, 1 + activePylon, 14, 20, "hollow");
      if (activePylon >= 1) enemies.spawnAround(p.pos, 1, 16, 20, "shaman");
    }
    if (p.charge >= 1 && !p.lit) {
      p.lit = true;
      pylonLit(activePylon);
    }
  }

  if (story.stage === "boss" && !story.boss && Math.hypot(player.pos.x - ARENA.x, player.pos.z - ARENA.z) < 26) spawnBoss();
  const b = story.boss;
  if (b && b.alive) {
    hud.bossFill.style.width = `${Math.max(0, b.hp / b.maxHp) * 100}%`;
    const f = b.hp / b.maxHp;
    if (f < 0.5 && !bossHalf) {
      bossHalf = true;
      say(S.WARDEN_HALF);
    }
    if (f < 0.2 && !bossLow) {
      bossLow = true;
      say(S.WARDEN_LOW);
    }
  }

  barkCd -= dt;
  if (barkCd <= 0 && enemies.aliveCount > 0 && !voice.busy) {
    barkCd = 9 + Math.random() * 6;
    say([["HOLLOW", pick(S.HOLLOW_BARKS)]]);
  }
}

export function storyOnSummon() {
  say(S.WARDEN_SUMMON);
}

/** Debug: jump to a stage. */
export function storySkip(to: Stage) {
  voice.interrupt();
  cine.skip();
  cine.end();
  hud.root.classList.add("show");
  hud.blackout.style.opacity = "0";
  player.frozen = false;
  if (!player.hasAxe) player.equipAxe();
  world.axeProp.visible = false;
  world.doorsTarget = 1;
  state.exited = true;
  player.firstPerson = false;
  story.stage = to;
  if (to === "outside") player.pos.set(0, 0, 6);
  if (["signs", "fire"].includes(to)) world.setCampfire(false);
  if (to === "signs") {
    player.pos.copy(BEACON).add(new THREE.Vector3(3, 0, -4));
    startSigns();
  }
  if (to === "fire") {
    player.pos.set(3, 0, 4);
    story.stage = "fire";
  }
  if (to === "records") {
    world.setCampfire(true);
    player.pos.set(CAMP.x - 1, 0, CAMP.z - 2);
  }
  if (to === "ambush") {
    world.setCampfire(true);
    player.pos.copy(CAMP).add(new THREE.Vector3(-2, 0, -2));
    startAmbush();
  }
  if (to === "pylons") ambushCleared();
  if (to === "boss") {
    world.pylons.forEach((p) => (p.lit = true));
    player.pos.set(0, heightAt(0, 128), 128);
  }
  void input;
}
