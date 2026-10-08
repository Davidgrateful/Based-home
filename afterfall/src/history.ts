// The world before you: what you're called, the places you find, and what
// the people who came before left behind.
//
// Designation: SLEEPER (Rhea's word) → HUNDRED (scratched under the tally
// marks) → PATIENT 10001 (the registry). Each is a stage of understanding,
// shown under your name. Nothing explains it.
//
// Landmarks announce themselves the first time you reach them. Evidence is
// something you look at: a tag, a grave, a log. Patient numbers go into the
// margin of the map; the last one written there is yours.

import * as THREE from "three";
import { $, cine, persist, player, sfx, state, type Interact } from "./ctx";
import { save } from "./save";
import { showPlaceCard } from "./regions";
import { CHOIR_C, DEAD_TAG, DEAD_TREE, MAST, OC, OLD_CAMP, SHED_BED, STATION, WATCH, heightAt } from "./world";

// ------------------------------------------------------------------ designation
const NAMES = ["Sleeper", "Hundred", "Patient 10001"];

export function designation(): number {
  const n = Number(save.flags.desig ?? 0);
  return Math.max(n, save.storyDone ? 2 : 0);
}

/** Move the designation on (never back). The old one is struck through, briefly. */
export function setDesignation(n: number, quiet = false) {
  const was = designation();
  if (n <= was) return;
  save.flags.desig = String(n);
  persist();
  if (quiet) return renderDesignation();
  renderDesignation(NAMES[was]);
  sfx.scratch();
}

let strikeT = 0;
export function renderDesignation(from?: string) {
  const el = $("hud-desig");
  if (!el) return;
  const now = NAMES[designation()].toUpperCase();
  clearTimeout(strikeT);
  // unnamed, the designation IS your name on the HUD (no second line)
  if (!save.name.trim()) {
    el.style.display = "none";
    const nm = $("hud-name");
    if (from) {
      nm.innerHTML = `<s style="opacity:.5;margin-right:8px">${from}</s>${NAMES[designation()]}`;
      strikeT = window.setTimeout(() => (nm.textContent = NAMES[designation()]), 5000);
    } else nm.textContent = NAMES[designation()];
    return;
  }
  el.style.display = "";
  if (from) {
    el.innerHTML = `<s>${from.toUpperCase()}</s> ${now}`;
    el.classList.add("changed");
    strikeT = window.setTimeout(() => {
      el.textContent = now;
      el.classList.remove("changed");
    }, 5000);
  } else el.textContent = now;
}

// ------------------------------------------------------------------ landmarks
interface Landmark {
  id: string;
  name: string;
  x: number;
  z: number;
  r: number;
  line: string;
  /** found some other way than walking up to it (seen from afar) */
  found?: () => boolean;
}

export const LANDMARKS: Landmark[] = [
  { id: "deadtree", name: "Dead Tree", x: DEAD_TREE.x, z: DEAD_TREE.z, r: 16, line: "Discovered." },
  { id: "watchtower", name: "The Watchtower", x: MAST.x, z: MAST.z, r: 13, line: "Discovered." },
  // the white light can't be reached: it is found by seeing it from the north fields
  { id: "whitelight", name: "The White Light", x: CHOIR_C.x, z: CHOIR_C.z, r: 0, line: "Sighted. Too far to reach.", found: () => player.pos.z > 112 },
];

export const landmarkFound = (id: string) => !!save.flags["lm:" + id];

let lmT = 0;
export function historyUpdate(dt: number) {
  lmT -= dt;
  if (lmT > 0 || state.mode === "title" || cine.active) return;
  lmT = 0.5;
  for (const l of LANDMARKS) {
    if (landmarkFound(l.id)) continue;
    const near = l.r > 0 && Math.hypot(player.pos.x - l.x, player.pos.z - l.z) < l.r;
    if (!near && !l.found?.()) continue;
    save.flags["lm:" + l.id] = true;
    persist();
    showPlaceCard("", l.name, l.line);
    return; // one card at a time
  }
}

// ------------------------------------------------------------------ evidence
export interface Evidence {
  id: string;
  /** what the prompt says */
  label: string;
  /** what you read (lines) */
  text: string[];
  /** patient numbers it names */
  patients: string[];
  /** where (for the map's margin) */
  where: string;
  at: THREE.Vector3;
}

const v = (base: THREE.Vector3, d: readonly [number, number]) => {
  const x = base.x + d[0];
  const z = base.z + d[1];
  return new THREE.Vector3(x, heightAt(x, z), z);
};

export const EVIDENCE: Evidence[] = [
  {
    id: "deadtag",
    label: "Look at the tag",
    text: ["A Meridian tag on a wire, rusted through.", "PATIENT 9843.", "It has been here for years."],
    patients: ["9843"],
    where: "Dead Tree",
    at: v(DEAD_TREE, DEAD_TAG),
  },
  {
    id: "oc-post",
    label: "Look at the wristbands",
    text: ["Wristbands, nailed to a post one above another.", "One is still readable: 0034.", "The rest have faded white."],
    patients: ["0034"],
    where: "Old Camp",
    at: v(OLD_CAMP, OC.post),
  },
  {
    id: "oc-board",
    label: "Read the board",
    text: ["Tally marks cut into a plank. Hundreds.", "At the top: WAIT FOR HUNDRED.", "They stopped counting in the middle of a group."],
    patients: [],
    where: "Old Camp",
    at: v(OLD_CAMP, OC.board),
  },
  {
    id: "oc-graves",
    label: "Look at the graves",
    text: ["Three graves. Tags on the stakes: 0217. 0891.", "The third tag is blank.", "The third grave is dug. There is nobody in it."],
    patients: ["0217", "0891"],
    where: "Old Camp",
    at: v(OLD_CAMP, OC.graves),
  },
  {
    id: "oc-cot",
    label: "Look at the cot",
    text: ["A cot of lashed branches.", "Scratched into the frame: 0217."],
    patients: ["0217"],
    where: "Old Camp",
    at: v(OLD_CAMP, OC.cot),
  },
  {
    id: "oc-roll",
    label: "Look at the bedroll",
    text: ["A bedroll, a tag tied to it.", "MARA. 4012.", "Somebody kept a name out here."],
    patients: ["4012"],
    where: "Old Camp",
    at: v(OLD_CAMP, OC.roll),
  },
  {
    id: "oc-can",
    label: "Look at the canister",
    text: ["A water canister, half full.", "Stencilled on the side: 0891."],
    patients: ["0891"],
    where: "Old Camp",
    at: v(OLD_CAMP, OC.can),
  },
  {
    id: "oc-bag",
    label: "Open the bag",
    text: ["A Meridian medical bag. PATIENT 0432.", "Empty, except for a drawing of two moons."],
    patients: ["0432"],
    where: "Old Camp",
    at: v(OLD_CAMP, OC.bag),
  },
  {
    id: "w-camera",
    label: "Look through the camera",
    text: ["A camera on a tripod, aimed east.", "At the crash. At the ambulance.", "The red light is still on."],
    patients: [],
    where: "The Watch",
    at: v(STATION, WATCH.camera),
  },
  {
    id: "w-log",
    label: "Read the log",
    text: ["OBSERVATION LOG", "03:12  TRANSIT.  03:14  ARRIVED.  03:20  KEEP WATCHING.", "No name. Just: arrived."],
    patients: [],
    where: "The Watch",
    at: v(STATION, WATCH.desk),
  },
  {
    // nothing else here is explained
    id: "shed-band",
    label: "Look at the wristband",
    text: ["A wristband on the bed rail.", "PATIENT 9843."],
    patients: ["9843"],
    where: "The shed",
    at: SHED_BED,
  },
];

export const evidenceFound = (id: string) => !!save.flags["ev:" + id];

/** Every patient number found, lowest first, with where it was found. */
export function knownPatients(): { no: string; where: string }[] {
  const out = new Map<string, string>();
  for (const e of EVIDENCE) if (evidenceFound(e.id)) for (const p of e.patients) if (!out.has(p)) out.set(p, e.where);
  return [...out.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([no, where]) => ({ no, where }));
}

let noteT = 0;
function showNote(lines: string[]) {
  const el = $("note");
  el.innerHTML = lines.map((l) => `<p>${l}</p>`).join("");
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(noteT);
  noteT = window.setTimeout(() => el.classList.remove("show"), 2600 + lines.join(" ").length * 45);
}

/** Inspect prompts for whatever evidence is in reach (story and the Long Night). */
let interacts: Interact[] | null = null;
export function evidenceInteracts(): Interact[] {
  return (interacts ??= EVIDENCE.map((e) => ({
    pos: () => e.at,
    r: 2.2,
    label: e.label,
    when: () => true,
    run: () => {
      const first = !evidenceFound(e.id);
      showNote(e.text);
      if (!first) return;
      save.flags["ev:" + e.id] = true;
      persist();
      sfx.monitor();
      if (e.id === "oc-board") setDesignation(1);
    },
  })));
}
