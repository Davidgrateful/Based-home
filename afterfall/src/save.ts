import type { Look } from "./models";

// Persistent progress (per browser). Wrapped in try/catch: private windows or
// blocked storage just mean progress isn't kept.

export interface Memory {
  id: keyof Save["mem"];
  name: string;
  desc: string;
  max: number;
  cost: (lvl: number) => number;
}

export interface Save {
  name: string; // what's written on your wristband
  look: Look | null; // null until the player has made a character
  storyDone: boolean;
  bank: number; // Rift Shards banked, spent on Memories
  echoes: number[];
  bestNight: number;
  loops: number;
  mem: { skin: number; muscle: number; wind: number; medic: number; sense: number; keeper: number };
  regions: string[]; // region ids the player has walked into
  fog: string; // discovered map cells, base64 bitset (map.ts)
  flags: Record<string, boolean | string>; // one-time story beats and choices
}

const KEY = "afterfall.save.v1";

const fresh = (): Save => ({
  name: "",
  look: null,
  storyDone: false,
  bank: 0,
  echoes: [],
  bestNight: 0,
  loops: 0,
  mem: { skin: 0, muscle: 0, wind: 0, medic: 0, sense: 0, keeper: 0 },
  regions: [],
  fog: "",
  flags: {},
});

export const save: Save = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...fresh(), ...JSON.parse(raw) } as Save;
      s.mem = { ...fresh().mem, ...s.mem };
      return s;
    }
  } catch {}
  return fresh();
})();

/** The survivor's name, or Rhea's nickname for her sleeping patient. */
export const playerName = () => save.name.trim() || "Sleeper";

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {}
}

export function resetSave() {
  Object.assign(save, fresh());
  persist();
}

// "Memories": what leaks through the loop. Permanent upgrades.
export const MEMORIES: Memory[] = [
  { id: "skin", name: "Thick Skin", desc: "+15 max vitals", max: 5, cost: (l) => [15, 30, 50, 75, 110][l] },
  { id: "muscle", name: "Muscle Memory", desc: "+15% axe damage", max: 5, cost: (l) => [20, 40, 65, 95, 130][l] },
  { id: "wind", name: "Second Wind", desc: "+30% stamina regen, cheaper dodges", max: 3, cost: (l) => [15, 35, 60][l] },
  { id: "medic", name: "Field Medic", desc: "+1 medkit at the start of every night", max: 3, cost: (l) => [25, 50, 90][l] },
  { id: "sense", name: "Shard Sense", desc: "Pull shards in from farther away", max: 3, cost: (l) => [10, 25, 45][l] },
  { id: "keeper", name: "Firekeeper", desc: "+30 campfire durability", max: 4, cost: (l) => [15, 30, 50, 80][l] },
];
