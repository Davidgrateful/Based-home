// Survivor creator: name the patient, dress them, turn them in the firelight.
// The preview is the real in-game model standing by the campfire.

import * as THREE from "three";
import { $, camera, persist, player, scene, sfx, voice, world } from "./ctx";
import { DEFAULT_LOOK, LOOK, type Look, randomLook, type Swatch } from "./models";
import { playerName, save } from "./save";
import { CAMP, heightAt } from "./world";
import { renderDesignation } from "./history";

const NAMES = [
  "Kai Mercer", "Jordan Vale", "Sam Okoye", "Rin Calder", "Alex Moreau", "Noor Haddad",
  "Ezra Quinn", "Mika Sato", "Dani Reyes", "Theo Lindqvist", "Ines Duarte", "Robin Achebe",
];

interface Row {
  key: keyof Look;
  label: string;
  kind: "choice" | "swatch";
}

const ROWS: Row[] = [
  { key: "body", label: "Body", kind: "choice" },
  { key: "build", label: "Frame", kind: "choice" },
  { key: "skin", label: "Skin tone", kind: "swatch" },
  { key: "hair", label: "Hair", kind: "choice" },
  { key: "hairColor", label: "Hair color", kind: "swatch" },
  { key: "top", label: "Clothing", kind: "choice" },
  { key: "topColor", label: "Clothing color", kind: "swatch" },
  { key: "pants", label: "Trousers", kind: "swatch" },
  { key: "extra", label: "Accessory", kind: "choice" },
  { key: "voice", label: "Voice", kind: "choice" },
];

/** Where the survivor stands on the menu and in the creator. */
export const STAND = new THREE.Vector3(CAMP.x - 1.7, 0, CAMP.z + 1.2);
/** Title shot: from the camp toward the wreck (and the sky over it). */
const POSTER_DIR = new THREE.Vector3(-12 - STAND.x, 0, 30 - STAND.z).normalize();
const POSTER_SIDE = new THREE.Vector3(-POSTER_DIR.z, 0, POSTER_DIR.x);
STAND.y = heightAt(STAND.x, STAND.z);

export const creator = { open: false, spin: 0.6 };
let look: Look = { ...(save.look ?? DEFAULT_LOOK) };
let onDone: (() => void) | null = null;
const input = $<HTMLInputElement>("cc-name");

// soft key light so the face reads on the menu and in the creator
const key = new THREE.PointLight(0xf2e6d4, 0, 9, 1.6);
key.position.copy(STAND).add(new THREE.Vector3(1.6, 2.3, 2.6));
scene.add(key);

const sanitize = (s: string) =>
  s
    .replace(/[^\p{L}\p{N} '\-.]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);

/** Push the saved survivor into the game: model, voice, HUD, menu. */
export function applySaved() {
  player.setLook(save.look ?? DEFAULT_LOOK);
  voice.playerName = playerName();
  voice.altVoice = (save.look?.voice ?? 0) === 1;
  $("hud-name").textContent = playerName();
  renderDesignation();
  $("char-sub").textContent = save.look ? `${playerName()}. Change name and clothing.` : "Name and dress your character.";
}

export function openCreator(done?: () => void) {
  onDone = done ?? null;
  look = { ...(save.look ?? DEFAULT_LOOK) };
  input.value = save.name;
  input.placeholder = "Sleeper";
  $("cc-done").textContent = done ? "Confirm and play" : "Confirm";
  render();
  player.setLook(look);
  $("title").classList.add("hidden");
  $("creator").classList.add("show");
  creator.open = true;
}

function close(confirm: boolean) {
  creator.open = false;
  $("creator").classList.remove("show");
  if (confirm) {
    save.look = { ...look };
    save.name = sanitize(input.value);
    persist();
  }
  applySaved();
  if (confirm && onDone) onDone();
  else $("title").classList.remove("hidden");
  onDone = null;
}

function set(k: keyof Look, v: number) {
  look[k] = v;
  player.setLook(look);
  render();
  if (k === "voice") voice.preview(v === 1); // hear it
  else sfx.coin();
}

function render() {
  const wrap = $("cc-rows");
  wrap.innerHTML = "";
  for (const r of ROWS) {
    const row = document.createElement("div");
    row.className = "cc-row";
    const label = document.createElement("span");
    label.className = "cc-label";
    label.textContent = r.label;
    row.appendChild(label);
    if (r.kind === "choice") {
      const opts = LOOK[r.key] as string[];
      const n = opts.length;
      const ctrl = document.createElement("div");
      ctrl.className = "cc-choice";
      const prev = document.createElement("button");
      prev.innerHTML = "&#8249;";
      prev.setAttribute("aria-label", `Previous ${r.label}`);
      prev.onclick = () => set(r.key, ((look[r.key] ?? 0) - 1 + n) % n);
      const val = document.createElement("span");
      val.textContent = opts[look[r.key] ?? 0];
      const next = document.createElement("button");
      next.innerHTML = "&#8250;";
      next.setAttribute("aria-label", `Next ${r.label}`);
      next.onclick = () => set(r.key, ((look[r.key] ?? 0) + 1) % n);
      ctrl.append(prev, val, next);
      row.appendChild(ctrl);
    } else {
      const opts = LOOK[r.key] as Swatch[];
      const ctrl = document.createElement("div");
      ctrl.className = "cc-swatches";
      opts.forEach((o, i) => {
        const b = document.createElement("button");
        b.style.background = `#${o.c.toString(16).padStart(6, "0")}`;
        b.title = o.name;
        b.setAttribute("aria-label", `${r.label}: ${o.name}`);
        b.setAttribute("aria-pressed", String(look[r.key] === i));
        b.onclick = () => set(r.key, i);
        ctrl.appendChild(b);
      });
      row.appendChild(ctrl);
    }
    wrap.appendChild(row);
  }
}

$("cc-done").addEventListener("click", () => close(true));
$("cc-back").addEventListener("click", () => close(false));
$("cc-random").addEventListener("click", () => {
  look = randomLook();
  if (!input.value.trim()) input.value = NAMES[Math.floor(Math.random() * NAMES.length)];
  player.setLook(look);
  render();
  sfx.coin();
});
input.addEventListener("keydown", (e) => e.stopPropagation()); // typing shouldn't move the character

// drag anywhere outside the panel to turn the survivor
let dragging = false;
let lastX = 0;
$("creator").addEventListener("pointerdown", (e) => {
  if ((e.target as HTMLElement).closest(".creator-col")) return;
  dragging = true;
  lastX = e.clientX;
});
addEventListener("pointerup", () => (dragging = false));
addEventListener("pointermove", (e) => {
  if (!dragging) return;
  creator.spin += (e.clientX - lastX) * 0.012;
  lastX = e.clientX;
});

/** Idle pose by the fire. */
function pose(t: number, yaw: number) {
  const m = player.model;
  m.root.visible = true;
  m.root.position.copy(STAND);
  m.root.rotation.set(0, yaw, 0);
  m.body.position.y = 0.95 + Math.sin(t * 1.6) * 0.004;
  m.body.rotation.set(0, 0, 0);
  m.armL.rotation.set(0.04, 0, -0.07);
  m.armR.rotation.set(0.04, 0, 0.07);
  m.legL.rotation.set(0, 0, -0.03);
  m.legR.rotation.set(0, 0, 0.03);
  m.head.rotation.set(Math.sin(t * 0.4) * 0.03, Math.sin(t * 0.27) * 0.12, 0);
}

const camTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const lookNow = CAMP.clone();

/** Main menu and creator camera. Call every frame while on the menu. */
export function menuCamera(dt: number, t: number) {
  key.intensity = 7;
  if (creator.open) {
    pose(t, creator.spin);
    camTarget.copy(STAND).add(new THREE.Vector3(0.7, 1.15, 3.0));
    lookTarget.copy(STAND).add(new THREE.Vector3(-0.55, 0.95, 0));
  } else {
    // The poster: low behind the survivor, the fire at their side, the
    // burning wreck ahead and the rift breathing open in the sky above it.
    pose(t, Math.atan2(POSTER_DIR.x, POSTER_DIR.z));
    const push = (Math.sin(t * 0.06) + 1) * 0.35;
    camTarget.copy(STAND).addScaledVector(POSTER_DIR, -7 + push).addScaledVector(POSTER_SIDE, -2.8).setY(STAND.y + 1.05);
    lookTarget.copy(STAND).addScaledVector(POSTER_DIR, 22).addScaledVector(POSTER_SIDE, -3).setY(STAND.y + 7.5);
    const tear = world.skyTear;
    tear.visible = true;
    tear.position.copy(STAND).addScaledVector(POSTER_DIR, 190).setY(105);
    tear.scale.setScalar(1.25);
    tear.lookAt(camera.position);
    world.skyTearMat.uniforms.uOpen.value = 0.32 + Math.sin(t * 0.35) * 0.08;
  }
  // ease between framings, but start in place: gliding in from the origin
  // means watching the title from under the ground on a slow device
  const far = camera.position.distanceTo(camTarget) > 25;
  const k = far ? 1 : Math.min(1, dt * 2.2);
  camera.position.lerp(camTarget, k);
  lookNow.lerp(lookTarget, k);
  camera.lookAt(lookNow);
}

export function menuLightOff() {
  key.intensity = 0;
  world.skyTear.visible = false;
}
