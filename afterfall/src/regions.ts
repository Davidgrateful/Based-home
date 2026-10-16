// Named places. Walking into one for the first time puts its name on screen
// and marks it on the map; the Blackwood also thickens the fog.

import { $, cine, farlands, persist, sfx, state, world } from "./ctx";
import { inBasin, inChoir } from "./farlands";
import { save } from "./save";
import { ARENA, BASIN_C, BLACKWOOD_X, CHOIR_C, OLD_CAMP, PYLONS, SCAR, SETTLEMENT, STATION } from "./world";

export interface Region {
  id: string;
  no: string;
  name: string;
  line: string;
  /** Where the map writes the name. */
  label: [number, number];
  /** Not reachable yet: drawn as interference on the map. */
  locked?: () => boolean;
}

export const REGIONS: Region[] = [
  { id: "fallsite", no: "01", name: "The Fallsite", line: "Where you came down.", label: [-6, 16] },
  { id: "blackwood", no: "02", name: "The Blackwood", line: "Nothing grows light here.", label: [-110, 40] },
  { id: "scar", no: "03", name: "The Blue Scar", line: "The ground here is wrong.", label: [SCAR.x, SCAR.z - 12] },
  { id: "station", no: "04", name: "The Watch", line: "Somebody was watching.", label: [STATION.x, STATION.z - 22] },
  { id: "oldcamp", no: "05", name: "The Old Camp", line: "Somebody lived here.", label: [OLD_CAMP.x, OLD_CAMP.z - 13] },
  { id: "towers", no: "06", name: "The Tower Fields", line: "They hum when you get close.", label: [10, 80] },
  { id: "warden", no: "07", name: "The Warden's Domain", line: "The oldest stones. The oldest one.", label: [ARENA.x, ARENA.z + 4] },
  { id: "settlement", no: "08", name: "The Hollow Settlement", line: "The Changed keep a fire here.", label: [SETTLEMENT.x, SETTLEMENT.z - 24], locked: () => !farlands.live },
  { id: "basin", no: "09", name: "The Rift Basin", line: "Down is a suggestion here.", label: [BASIN_C.x, BASIN_C.z - 30], locked: () => !world.basinOpen },
  { id: "choir", no: "10", name: "The White Light", line: "", label: [CHOIR_C.x, CHOIR_C.z + 14], locked: () => !save.regions.includes("choir") },
];

const byId = (id: string) => REGIONS.find((r) => r.id === id)!;

export function regionAt(x: number, z: number): Region | null {
  if (inChoir(x, z)) return byId("choir");
  if (inBasin(x, z)) return byId("basin");
  if (farlands.live && Math.hypot(x - SETTLEMENT.x, z - SETTLEMENT.z) < 26) return byId("settlement");
  // the scar is a wound in the Fallsite's edge: it wins where they overlap
  if (Math.hypot(x - SCAR.x, z - SCAR.z) < 13) return byId("scar");
  if (Math.hypot(x + 6, z - 16) < 42) return byId("fallsite");
  if (Math.hypot(x - STATION.x, z - STATION.z) < 32) return byId("station");
  if (Math.hypot(x - OLD_CAMP.x, z - OLD_CAMP.z) < 15) return byId("oldcamp");
  if (Math.hypot(x - ARENA.x, z - ARENA.z) < 38) return byId("warden");
  if (PYLONS.some((p) => Math.hypot(x - p.x, z - p.z) < 24)) return byId("towers");
  if (x < BLACKWOOD_X) return byId("blackwood");
  return null;
}

let current: Region | null = null;
let timer = 0;
let cardT = 0;

/** Big name card the first time; a quiet line on later visits. */
function announce(r: Region, first: boolean) {
  showPlaceCard(first ? `Zone ${r.no}` : "", r.name, first ? r.line : "", first);
}

/** The place card (regions, and landmarks: "Dead Tree / Discovered"). */
export function showPlaceCard(kicker: string, name: string, line: string, first = true) {
  const el = $("region");
  $("region-no").textContent = kicker;
  $("region-name").textContent = name;
  $("region-line").textContent = line;
  el.classList.toggle("quiet", !first);
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(cardT);
  cardT = window.setTimeout(() => el.classList.remove("show"), first ? 5200 : 2800);
  if (first) sfx.ghost();
}

export function regionsUpdate(dt: number, x: number, z: number) {
  timer -= dt;
  if (timer > 0) return;
  timer = 0.4;
  const r = regionAt(x, z);
  world.fogBoost = r?.id === "blackwood" ? 1 : 0;
  if (!r || r === current) return;
  if (state.mode === "title" || cine.active) return;
  current = r;
  const first = !save.regions.includes(r.id);
  if (r.id === "choir") {
    markRegion("choir");
    return;
  }
  if (first) {
    save.regions.push(r.id);
    persist();
  }
  announce(r, first);
}

export function resetRegionCard() {
  current = null;
}

/** Record a region without a card (when a chapter card already names it). */
export function markRegion(id: string) {
  current = byId(id);
  if (!save.regions.includes(id)) {
    save.regions.push(id);
    persist();
  }
}
