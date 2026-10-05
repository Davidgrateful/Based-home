// Co-op glue: joins a room, shows the other survivors, streams your own
// survivor to them, and routes the host's world to the Long Night director.

import * as THREE from "three";
import { RemoteAvatar, type RemoteState } from "./avatars";
import { $, enemies, player, scene, sfx, state, toast, world } from "./ctx";
import type { Look } from "./models";
import { net } from "./net";
import { becomeHost, nightCatchUp, onNetNightStart, onNetWorld } from "./night";
import { playerName, save } from "./save";

const avatars = new Map<number, RemoteAvatar>();
let sendT = 0;

function addAvatar(id: number, name: string, look: Look | null) {
  if (avatars.has(id)) return;
  avatars.set(id, new RemoteAvatar(scene, id, name, look));
  syncTargets();
  renderRoster();
}

function removeAvatar(id: number) {
  avatars.get(id)?.dispose();
  avatars.delete(id);
  syncTargets();
  renderRoster();
}

function syncTargets() {
  enemies.others = [...avatars.values()].map((a) => a.proxy);
}

export function inviteLink() {
  return `${location.origin}${location.pathname}?room=${net.room}`;
}

function renderRoster() {
  const chip = $("room-chip");
  chip.hidden = !net.active;
  if (!net.active) return;
  const names = [playerName(), ...[...avatars.values()].map((a) => a.name)];
  $("room-code").textContent = `Room ${net.room}`;
  $("room-list").innerHTML = names.map((n, i) => `<li>${n}${i === 0 ? ' <span class="dim">(you)</span>' : ""}</li>`).join("");
  $("btn-invite").hidden = false;
}

// ------------------------------------------------------------------ messages
net.on("welcome", (m) => {
  for (const p of m.players) addAvatar(p.id, p.name, p.look);
  renderRoster();
});
net.on("join", (m) => {
  addAvatar(m.id, m.name, m.look);
  toast(`${m.name} joined the camp`);
  sfx.beep();
  if (net.isHost) nightCatchUp(m.id);
});
net.on("leave", (m) => {
  const a = avatars.get(m.id);
  if (a) toast(`${a.name} left`);
  removeAvatar(m.id);
});
net.on("host", (m) => {
  if (m.id === net.id) {
    toast("You're hosting the night now");
    becomeHost();
  }
});
net.on("closed", () => {
  for (const id of [...avatars.keys()]) removeAvatar(id);
  toast("Lost the connection to the room. Playing on alone.", 4000);
  becomeHost();
  renderRoster();
});
net.on("st", (m) => avatars.get(m.from!)?.apply(m.s as RemoteState));
net.on("ns", (m) => onNetNightStart(m as never));
net.on("w", (m) => onNetWorld(m as never));
net.on("tear", (m) => world.spawnTear(m.x, m.z, m.big));
net.on("bolt", (m) => enemies.castBoltFrom(m.id, new THREE.Vector3(m.at[0], m.at[1], m.at[2])));
net.on("dmg", (m) => {
  if (!state.dead) player.damage(m.n, new THREE.Vector3(m.x, 0, m.z));
});
net.on("sw", (m) => {
  // a client swung: the host resolves it against the real enemies
  if (!net.isHost) return;
  state.remoteSwing = true;
  enemies.hit(new THREE.Vector3(m.x, 0, m.z), m.f, m.heavy ? 3.2 : 2.7, m.heavy ? 1.5 : 1.2, m.dmg, m.heavy);
  state.remoteSwing = false;
});

/** Connect to a room. Resolves once you're in (as host or guest). */
export async function joinRoom(code: string) {
  await net.connect(code, playerName(), save.look);
  enemies.puppet = net.isClient;
  renderRoster();
}

/** Called every frame. */
export function coopUpdate(dt: number, camera: THREE.Camera) {
  for (const a of avatars.values()) a.update(dt, camera);
  if (!net.active || state.mode !== "night") return;
  sendT -= dt;
  if (sendT > 0) return;
  sendT = 1 / 12;
  const r = (v: number) => Math.round(v * 100) / 100;
  const s: RemoteState = {
    p: [r(player.pos.x), r(player.pos.y), r(player.pos.z)],
    f: r(player.facing),
    a: player.attackT > 0 ? r(1 - player.attackT / player.swingDur) : -1,
    c: player.combo,
    air: player.airborne,
    dn: state.dead,
    iv: player.invuln > 0 && player.dashT > 0,
    hp: Math.round(player.hp),
    mh: player.maxHp,
    rb: player.riftBound,
  };
  net.send({ t: "st", s });
}

/** A client's swing: predict locally for feel, let the host apply damage. */
export function coopSwing(facing: number, dmg: number, heavy: boolean) {
  const n = enemies.hit(player.pos, facing, heavy ? 3.2 : 2.7, heavy ? 1.5 : 1.2, dmg, heavy, false);
  net.send({ t: "sw", x: player.pos.x, z: player.pos.z, f: facing, dmg, heavy });
  return n;
}

/** Host: let clients see shaman bolts. */
enemies.onCast = (e, to) => {
  sfx.charge();
  if (net.active && net.isHost) net.send({ t: "bolt", id: e.id, at: [to.x, to.y, to.z] });
};
