export type RoomType =
  | 'empty' | 'wall' | 'entrance'
  | 'vault' | 'fake_vault'
  | 'barracks' | 'workshop' | 'trophy'
  | 'trap' | 'garden' | 'social' | 'generator';

export interface RoomDef {
  type: RoomType;
  label: string;
  icon: string;
  description: string;
  cssClass: string;
  buildCost: number;
  maxLevel: number;
  effect: string;
  requiredArch: number;
  isRaidTarget: boolean;
  isTrap: boolean;
  trapDamage?: number;
}

export const ROOM_DEFS: Record<RoomType, RoomDef> = {
  empty:      { type: 'empty',      label: 'Empty',       icon: '',   description: 'Unbuilt cell.', cssClass: 'empty', buildCost: 0, maxLevel: 1, effect: 'none', requiredArch: 0, isRaidTarget: false, isTrap: false },
  wall:       { type: 'wall',       label: 'Wall',        icon: '🧱', description: 'Solid wall. Slows raiders.', cssClass: 'room-wall', buildCost: 50, maxLevel: 5, effect: 'Blocks movement. Costs raiders time.', requiredArch: 0, isRaidTarget: false, isTrap: false },
  entrance:   { type: 'entrance',   label: 'Entrance',    icon: '🚪', description: 'Main entry. Required.', cssClass: 'room-entrance', buildCost: 0, maxLevel: 3, effect: 'Raiders start here. Upgrade for door traps.', requiredArch: 0, isRaidTarget: false, isTrap: false },
  vault:      { type: 'vault',      label: 'Vault',       icon: '💰', description: 'Stores your loot. Primary target.', cssClass: 'room-vault', buildCost: 500, maxLevel: 10, effect: 'Holds 1000g × level. Higher level needs better hacking.', requiredArch: 2, isRaidTarget: true, isTrap: false },
  fake_vault: { type: 'fake_vault', label: 'Decoy Vault', icon: '🎭', description: 'Looks real. Wastes raider time + triggers trap.', cssClass: 'room-fake-vault', buildCost: 300, maxLevel: 5, effect: 'Raider spends time cracking it → trap fires → alarm raised.', requiredArch: 3, isRaidTarget: false, isTrap: true, trapDamage: 20 },
  barracks:   { type: 'barracks',   label: 'Barracks',   icon: '⚔️', description: 'Spawns guards that attack raiders.', cssClass: 'room-barracks', buildCost: 400, maxLevel: 8, effect: 'Spawns 1 guard per level. Guards deal 15 dmg each.', requiredArch: 2, isRaidTarget: false, isTrap: false },
  workshop:   { type: 'workshop',   label: 'Workshop',   icon: '🔧', description: 'Crafting station. Passive income.', cssClass: 'room-workshop', buildCost: 350, maxLevel: 10, effect: 'Passive crafting income. Unlocks recipes per level.', requiredArch: 1, isRaidTarget: false, isTrap: false },
  trophy:     { type: 'trophy',     label: 'Trophy Hall',icon: '🏆', description: 'Displays achievements. Increases prestige.', cssClass: 'room-trophy', buildCost: 200, maxLevel: 5, effect: '+100 prestige per trophy. Visitors see your wins.', requiredArch: 1, isRaidTarget: false, isTrap: false },
  trap:       { type: 'trap',       label: 'Trap',        icon: '🪤', description: 'Hidden. Damages raiders on entry.', cssClass: 'room-trap', buildCost: 250, maxLevel: 8, effect: 'Deals 25 dmg × level on entry. Resets each raid.', requiredArch: 1, isRaidTarget: false, isTrap: true, trapDamage: 25 },
  garden:     { type: 'garden',     label: 'Garden',      icon: '🌿', description: 'Passive resource generation.', cssClass: 'room-garden', buildCost: 150, maxLevel: 5, effect: 'Generates 10g × level/hr (24h cap).', requiredArch: 0, isRaidTarget: false, isTrap: false },
  social:     { type: 'social',     label: 'Social Hall', icon: '💬', description: 'Open to visitors. Builds honor.', cssClass: 'room-social', buildCost: 100, maxLevel: 3, effect: '+5 Honor per unique visitor/day.', requiredArch: 0, isRaidTarget: false, isTrap: false },
  generator:  { type: 'generator',  label: 'Generator',   icon: '⚡', description: 'Powers electronic defenses.', cssClass: 'room-generator', buildCost: 300, maxLevel: 5, effect: 'Required for electronic locks and laser traps.', requiredArch: 3, isRaidTarget: false, isTrap: false },
};

export const BUILDABLE_ROOMS: RoomType[] = [
  'wall', 'vault', 'fake_vault', 'barracks', 'workshop',
  'trophy', 'trap', 'garden', 'social', 'generator',
];

export interface RoomCell {
  type: RoomType;
  level: number;
  x: number;
  y: number;
}

export function emptyLayout(unlockedSize: number): RoomCell[][] {
  const grid: RoomCell[][] = [];
  for (let y = 0; y < 10; y++) {
    grid[y] = [];
    for (let x = 0; x < 10; x++) {
      grid[y][x] = { type: 'empty', level: 1, x, y };
    }
  }
  const center = Math.floor(unlockedSize / 2);
  if (grid[0] && center < unlockedSize) {
    grid[0][center] = { type: 'entrance', level: 1, x: center, y: 0 };
  }
  return grid;
}

export function calcDefenseRating(grid: RoomCell[][]): number {
  let rating = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === 'barracks')   rating += 50 * cell.level;
      if (cell.type === 'trap')       rating += 30 * cell.level;
      if (cell.type === 'fake_vault') rating += 25 * cell.level;
      if (cell.type === 'wall')       rating += 10 * cell.level;
    }
  }
  return rating;
}

export function calcPrestige(grid: RoomCell[][]): number {
  let p = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === 'trophy') p += 100 * cell.level;
      if (cell.type === 'vault')  p += 20 * cell.level;
      if (cell.type === 'social') p += 30 * cell.level;
    }
  }
  return p;
}
