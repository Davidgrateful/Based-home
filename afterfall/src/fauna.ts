// Wildlife. The Things lived here before the first patient fell; they keep to
// the deep woods (and later the Basin), range near a home, avoid firelight and
// only hunt what comes too close. The host spawns them; guests see snapshots.

import * as THREE from "three";
import { enemies, LOW, player, say, sfx, state, persist, world } from "./ctx";
import { net } from "./net";
import { save } from "./save";
import * as S from "./script";
import { BLACKWOOD_X, SETTLEMENT, WORLD_RADIUS } from "./world";
import { inBasin, inChoir } from "./farlands";

/** Extra wild ground beyond the Blackwood (set by the Basin when it opens). */
export const wildZones: ((x: number, z: number) => boolean)[] = [];
/** Places natives never go (the settlement). */
export const safeZones: { x: number; z: number; r: number }[] = [];

export function wildAt(x: number, z: number) {
  if (safeZones.some((s) => Math.hypot(x - s.x, z - s.z) < s.r)) return false;
  if (x < BLACKWOOD_X - 6 && Math.hypot(x, z - 20) < WORLD_RADIUS - 8) return true;
  return wildZones.some((f) => f(x, z));
}

// the settlement's walls and fire keep them out; the open Basin is theirs too
safeZones.push({ x: SETTLEMENT.x, z: SETTLEMENT.z, r: 30 });
wildZones.push((x, z) => world.basinOpen && inBasin(x, z) && !inChoir(x, z));

let cd = 4;

enemies.onNotice = () => {
  sfx.click();
  if (!save.flags.metThing && state.mode !== "title") {
    save.flags.metThing = true;
    persist();
    say(S.THING_FIRST);
  }
};

export function faunaUpdate(dt: number) {
  enemies.lights = [...(world.campfire.lit ? [world.campfire.group.position] : []), ...world.otherFires];
  if (net.isClient || state.mode === "title") return;
  const p = player.pos;
  for (const e of [...enemies.list]) {
    if (e.kind === "thing" && e.alive && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) > 90) enemies.remove(e);
  }
  cd -= dt;
  if (cd > 0 || !wildAt(p.x, p.z)) return;
  const n = enemies.list.filter((e) => e.kind === "thing" && e.alive).length;
  if (n >= (LOW ? 2 : 3)) return;
  cd = 16 + Math.random() * 14;
  for (let tries = 0; tries < 12; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = 30 + Math.random() * 12;
    const x = p.x + Math.cos(a) * r;
    const z = p.z + Math.sin(a) * r;
    if (!wildAt(x, z)) continue;
    if (enemies.lights.some((l) => Math.hypot(l.x - x, l.z - z) < 22)) continue;
    const pack = Math.random() < 0.4 ? 2 : 1;
    for (let i = 0; i < pack; i++) enemies.spawn("thing", new THREE.Vector3(x + i * 1.6, 0, z + i * 1.2), { rise: false });
    return;
  }
}
