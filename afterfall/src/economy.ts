// The survival economy: SCAVENGE → EARN → BUY → PREPARE → SURVIVE.
//
// The currency is the Shards you already carry: pieces the rift sheds. Out
// here they're the one thing everybody agrees is worth something: Meridian
// sealed them in sample tubes, the Hollow carry them, the dead were buried
// with them, and whoever keeps the trading post's table stocked takes them.
//
// Everything you can buy, you can also find. Buying is preparation and
// convenience, never the only way through: nothing in the story needs it.
//
// Three parts, each meant to grow:
//   CATALOG   what can be had, at what price (one table, configurable)
//   EARN      every way shards come in, each with its reason in the world
//   PURCHASE  quote → confirm → charge → grant, behind a Payment interface so
//             another way to pay (the testnet token) can be connected later
//             without touching the shop or the items

import { collectShard, persist, player, sfx, toast } from "./ctx";
import { save } from "./save";
import { carryCap, supplies, survival } from "./survival";

// ------------------------------------------------------------------ prices
/** Shards per item. Not balanced yet: tune here. */
export const PRICES = {
  medkit: 10,
  food: 5,
  water: 4,
  fuel: 9,
  kindling: 4,
  battery: 4,
  scrap: 3,
  hone: 22,
  // rare (the Watch's surplus): expensive, and worth it on a bad night
  surgery: 18,
  drum: 20,
  cells: 10,
};
/** How many each station holds (restocked at dawn). */
export const STOCK = {
  medkit: 2,
  food: 3,
  water: 3,
  fuel: 2,
  kindling: 4,
  battery: 2,
  scrap: 3,
  hone: 1,
  surgery: 1,
  drum: 1,
  cells: 1,
};

/** Where you can trade, and what's there. Prices at a station are the base
 *  price times its markup (the Watch is a long way to carry things). */
export const STATIONS = {
  post: { name: "The trading post", items: ["medkit", "fuel", "kindling", "food", "water", "battery", "scrap", "hone"], markup: 1 },
  watch: { name: "Meridian surplus", items: ["surgery", "drum", "cells", "medkit", "scrap"], markup: 1.25 },
} as const;
export type StationId = keyof typeof STATIONS;

// ------------------------------------------------------------------ catalog
/** What kind of thing it is: supplies now; the rest are room to grow. */
export type Category = "supply" | "tool" | "upgrade" | "cosmetic" | "story";

export interface Item {
  id: keyof typeof PRICES | string;
  name: string;
  /** one line, the way it'd be written on the board */
  desc: string;
  category: Category;
  price: () => number;
  /** what you're already carrying, shown beside it */
  owned: () => number;
  /** give it to the player */
  grant: () => void;
  /** may it be bought right now (beyond price and stock)? */
  available?: () => { ok: boolean; reason?: string };
}

const supply = (id: keyof typeof PRICES, name: string, desc: string, res: "food" | "water" | "fuel" | "scrap" | "batteries"): Item => ({
  id,
  name,
  desc,
  category: "supply",
  price: () => PRICES[id],
  owned: () => supplies[res],
  grant: () => {
    supplies[res]++;
  },
  available: () => room(res, 1),
});
/** Room in the pack for n more? */
const room = (res: "food" | "water" | "fuel" | "scrap" | "batteries", n: number) =>
  supplies[res] + n <= carryCap() ? { ok: true } : { ok: false, reason: `You can't carry that much ${res === "batteries" ? "battery" : res}.` };

export const CATALOG: Item[] = [
  {
    id: "medkit",
    name: "Medkit",
    desc: "Restores a good part of your health.",
    category: "supply",
    price: () => PRICES.medkit,
    owned: () => player.medkits,
    grant: () => {
      player.medkits++;
    },
  },
  {
    id: "fuel",
    name: "Fuel can",
    desc: "Two loads for the fire. Heavy, and worth it.",
    category: "supply",
    price: () => PRICES.fuel,
    owned: () => supplies.fuel,
    grant: () => {
      supplies.fuel += 2;
    },
    available: () => room("fuel", 2),
  },
  supply("kindling", "Kindling", "Dry sticks and bark. One load for the fire.", "fuel"),
  supply("food", "Food", "Tins. Eat by the fire to recover.", "food"),
  supply("water", "Water", "A sealed bottle. Drink by the fire.", "water"),
  supply("battery", "Battery", "Keeps your radio talking.", "batteries"),
  supply("scrap", "Scrap", "Wire, tins, a hinge. Three rigs an alarm line.", "scrap"),
  {
    id: "hone",
    name: "Whetstone and tape",
    desc: "Put an edge back on the axe, rewrap the grip. It bites a little deeper.",
    category: "tool",
    price: () => PRICES.hone,
    owned: () => (save.flags.axeHoned ? 1 : 0),
    grant: () => {
      save.flags.axeHoned = true;
      player.dmgMul *= 1.12;
    },
    available: () => (save.flags.axeHoned ? { ok: false, reason: "Your axe is already honed." } : { ok: true }),
  },
  {
    id: "surgery",
    name: "Field surgery kit",
    desc: "Two medkits' worth, sealed. Meridian issue.",
    category: "supply",
    price: () => PRICES.surgery,
    owned: () => player.medkits,
    grant: () => {
      player.medkits += 2;
    },
  },
  {
    id: "drum",
    name: "Sealed fuel drum",
    desc: "Four loads for the fire. A whole bad night's worth.",
    category: "supply",
    price: () => PRICES.drum,
    owned: () => supplies.fuel,
    grant: () => {
      supplies.fuel += 4;
    },
    available: () => room("fuel", 4),
  },
  {
    id: "cells",
    name: "Radio cells",
    desc: "Three batteries, still in the wrapper.",
    category: "supply",
    price: () => PRICES.cells,
    owned: () => supplies.batteries,
    grant: () => {
      supplies.batteries += 3;
    },
    available: () => room("batteries", 3),
  },
];

const stock = new Map<string, number>();
/** Fill the stations again (a new story, and every dawn). */
export function restock() {
  for (const st of Object.keys(STATIONS) as StationId[]) for (const id of STATIONS[st].items) stock.set(`${st}:${id}`, STOCK[id as keyof typeof STOCK] ?? 1);
}
restock();
export const inStock = (id: string, station: StationId = "post") => stock.get(`${station}:${id}`) ?? 0;
/** What an item costs at a station. */
export const priceAt = (item: Item, station: StationId) => Math.round(item.price() * STATIONS[station].markup);

// ------------------------------------------------------------------ earning
/** Shards for things you do, each with the reason they're there. */
export const REWARDS = {
  records: [6, "A sample tube in the Meridian case: shards."],
  firstHollow: [4, "It was carrying shards."],
  firstNight: [12, "The storm left shards in the ash."],
  ambush: [8, "The camera's battery. Somebody will trade for that."],
  tower: [5, "The tower shed shards as it woke."],
  warden: [20, "He'd been keeping them. All of them."],
  evidence: [2, "Someone left shards with it."],
} as const;

/** Take shards in. Every source goes through here. */
export function earn(n: number, why: string) {
  if (n <= 0) return;
  collectShard(n);
  sfx.coin();
  toast(`+${n} shards · ${why}`, 3200);
  flashBalance();
}

/** One of the rewards above, once (story beats can be replayed by respawns). */
export function reward(key: keyof typeof REWARDS, once = true) {
  if (once) {
    if (save.flags["rw:" + key]) return;
    save.flags["rw:" + key] = true;
  }
  const [n, why] = REWARDS[key];
  earn(n, why);
}

function flashBalance() {
  const el = document.getElementById("shards")?.parentElement;
  if (!el) return;
  el.classList.remove("got");
  void el.offsetWidth;
  el.classList.add("got");
}

// ------------------------------------------------------------------ payment
export interface Receipt {
  ok: boolean;
  /** the method's own reference (a transaction hash, one day) */
  ref?: string;
  reason?: string;
}

/** A way to pay. Shards are the only one connected; others plug in here. */
export interface Payment {
  id: "shards" | "token";
  label: string;
  /** usable at all right now? */
  status(): { ok: boolean; reason?: string };
  /** what the player has, in this method's units (null if unknown) */
  balance(): number | null;
  /** take the payment; resolve only once it has really happened */
  charge(price: number, item: Item): Promise<Receipt>;
}

export const shardsPayment: Payment = {
  id: "shards",
  label: "Shards",
  status: () => ({ ok: true }),
  balance: () => save.bank,
  charge: async (price) => {
    if (save.bank < price) return { ok: false, reason: "Not enough shards." };
    save.bank -= price;
    persist();
    return { ok: true, ref: `shards-${Date.now().toString(36)}` };
  },
};

/** The testnet token (token.ts: wallet connect and balance already exist).
 *  Not connected to purchases yet. When it is: transfer to the game's
 *  treasury through the connected wallet, wait for the receipt on-chain, and
 *  only then resolve ok. Until then it reports itself unavailable and the
 *  shop never offers it: no pretend transactions. */
export const tokenPayment: Payment = {
  id: "token",
  label: "Testnet token",
  status: () => ({ ok: false, reason: "Token purchases aren't connected yet." }),
  balance: () => null,
  charge: async () => ({ ok: false, reason: "Token purchases aren't connected yet." }),
};

export const PAYMENTS: Record<Payment["id"], Payment> = { shards: shardsPayment, token: tokenPayment };

// ------------------------------------------------------------------ purchase
export interface Quote {
  item: Item;
  price: number;
  pay: Payment;
  ok: boolean;
  reason?: string;
}

/** CHECK: can this be bought, now, this way? (no side effects) */
export function quote(id: string, method: Payment["id"] = "shards", station: StationId = "post"): Quote | null {
  const item = CATALOG.find((i) => i.id === id);
  if (!item || !(STATIONS[station].items as readonly string[]).includes(id)) return null;
  const pay = PAYMENTS[method];
  const price = priceAt(item, station);
  const st = pay.status();
  const av = item.available?.() ?? { ok: true };
  const bal = pay.balance();
  let reason: string | undefined;
  if (!st.ok) reason = st.reason;
  else if (inStock(id, station) <= 0) reason = "None left.";
  else if (!av.ok) reason = av.reason;
  else if (bal !== null && bal < price) reason = `You need ${price - bal} more.`;
  return { item, price, pay, ok: !reason, reason };
}

/** A completed purchase, kept for the session (and counted in the save). */
export const receipts: { id: string; price: number; method: string; ref?: string; at: number }[] = [];

/** CHARGE + GRANT: the confirmed purchase. The UI asks for confirmation first. */
export async function purchase(id: string, method: Payment["id"] = "shards", station: StationId = "post"): Promise<Receipt> {
  const q = quote(id, method, station);
  if (!q) return { ok: false, reason: "Unknown item." };
  if (!q.ok) return { ok: false, reason: q.reason };
  const r = await q.pay.charge(q.price, q.item);
  if (!r.ok) return r;
  q.item.grant();
  stock.set(`${station}:${id}`, inStock(id, station) - 1);
  receipts.push({ id, price: q.price, method, ref: r.ref, at: Date.now() });
  save.flags.bought = String(Number(save.flags.bought ?? 0) + 1);
  persist();
  survival.renderInv(true);
  return r;
}
