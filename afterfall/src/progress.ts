// SURVIVAL KNOWLEDGE — a handful of things you get better at out here.
//
// Not a skill tree: six small, separate pieces of know-how, each learned once
// (the trader shows you, for shards and sometimes scrap), each asking that
// you've done something first. They stay learned when the night begins again.
// None of them makes you safe; each one takes a little edge off.
//
// The numbers live in one place (KNOW below); the effects are applied by
// ctx.applyMemories (health/stamina/dodge/medkits) and survival.ts (carry,
// search time, the fire), all reading save.flags["up:<id>"].

import { applyMemories, persist, player, sfx } from "./ctx";
import { save } from "./save";
import { supplies } from "./survival";

export interface Know {
  id: string;
  name: string;
  /** what it does, plainly */
  desc: string;
  shards: number;
  scrap?: number;
  /** what you must have done first */
  needs: () => { ok: boolean; what: string };
}

const evidenceCount = () => Object.keys(save.flags).filter((k) => k.startsWith("ev:")).length;
const kills = () => Number(save.flags.kills ?? 0);
const survivedNight = () => !!save.flags["rw:firstNight"];

export const KNOW: Know[] = [
  { id: "field", name: "Field training", desc: "Pack it properly. Carry more of everything.", shards: 12, scrap: 2, needs: () => ({ ok: true, what: "" }) },
  { id: "hand", name: "Steady hand", desc: "Search things in half the time.", shards: 10, needs: () => ({ ok: evidenceCount() >= 2, what: "Look closely at two things the others left behind." }) },
  { id: "breath", name: "Last breath", desc: "Your stamina runs deeper and comes back faster.", shards: 14, needs: () => ({ ok: survivedNight(), what: "Survive a night." }) },
  { id: "medic", name: "Field medic", desc: "Medkits restore more health.", shards: 16, needs: () => ({ ok: evidenceCount() >= 4, what: "Find four of the things the others left behind." }) },
  { id: "feet", name: "Light feet", desc: "A dodge costs less of you.", shards: 12, scrap: 1, needs: () => ({ ok: kills() >= 3, what: "Put down three of the Hollow." }) },
  { id: "keeper", name: "Firekeeper", desc: "Fuel catches better and the fire burns slower.", shards: 14, scrap: 2, needs: () => ({ ok: survivedNight(), what: "Keep a fire through a storm." }) },
];

export const knows = (id: string) => !!save.flags["up:" + id];

/** Can it be learned now? (no side effects) */
export function canLearn(id: string): { ok: boolean; reason?: string } {
  const k = KNOW.find((x) => x.id === id);
  if (!k) return { ok: false, reason: "Unknown." };
  if (knows(id)) return { ok: false, reason: "You know this." };
  const n = k.needs();
  if (!n.ok) return { ok: false, reason: n.what };
  if (save.bank < k.shards) return { ok: false, reason: `You need ${k.shards - save.bank} more shards.` };
  if ((k.scrap ?? 0) > supplies.scrap) return { ok: false, reason: `You need ${(k.scrap ?? 0) - supplies.scrap} more scrap.` };
  return { ok: true };
}

/** Learn it: pay, remember it for good, apply it. */
export function learn(id: string) {
  const k = KNOW.find((x) => x.id === id);
  if (!k || !canLearn(id).ok) return false;
  save.bank -= k.shards;
  supplies.scrap -= k.scrap ?? 0;
  save.flags["up:" + id] = true;
  persist();
  const hp = player.hp;
  applyMemories();
  player.hp = hp;
  sfx.sting();
  return true;
}

/** Count a Hollow put down (for Light feet). */
export function countKill() {
  save.flags.kills = String(kills() + 1);
}
