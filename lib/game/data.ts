import type { Item, Quest, DropEntry } from './types';

// ─── ITEMS ───────────────────────────────────────────────────────────────────

export const ITEMS: Record<string, Item> = {
  // Starter weapons
  rusty_sword: {
    id: 'rusty_sword', name: 'Rusty Sword', type: 'weapon', slot: 'weapon',
    stats: { atk: 5 }, value: 20, rarity: 'common',
    description: 'An old sword, still sharp enough.', requiredLevel: 1, requiredClass: 'warrior', icon: '⚔️',
  },
  oak_staff: {
    id: 'oak_staff', name: 'Oak Staff', type: 'weapon', slot: 'weapon',
    stats: { matk: 7 }, value: 20, rarity: 'common',
    description: 'A staff carved from oak. Channels magic well.', requiredLevel: 1, requiredClass: 'mage', icon: '🪄',
  },
  short_bow: {
    id: 'short_bow', name: 'Short Bow', type: 'weapon', slot: 'weapon',
    stats: { atk: 6 }, value: 20, rarity: 'common',
    description: 'A simple bow for hunting.', requiredLevel: 1, requiredClass: 'ranger', icon: '🏹',
  },
  // Mid weapons
  steel_sword: {
    id: 'steel_sword', name: 'Steel Sword', type: 'weapon', slot: 'weapon',
    stats: { atk: 18 }, value: 200, rarity: 'uncommon',
    description: 'Forged from quality steel.', requiredLevel: 10, requiredClass: 'warrior', icon: '⚔️',
  },
  fire_staff: {
    id: 'fire_staff', name: 'Fire Staff', type: 'weapon', slot: 'weapon',
    stats: { matk: 22 }, value: 200, rarity: 'uncommon',
    description: 'Crackles with flame magic.', requiredLevel: 10, requiredClass: 'mage', icon: '🔥',
  },
  hunters_bow: {
    id: 'hunters_bow', name: "Hunter's Bow", type: 'weapon', slot: 'weapon',
    stats: { atk: 20 }, value: 200, rarity: 'uncommon',
    description: 'A masterwork bow used by rangers.', requiredLevel: 10, requiredClass: 'ranger', icon: '🏹',
  },
  // High-tier weapons
  dark_blade: {
    id: 'dark_blade', name: 'Dark Blade', type: 'weapon', slot: 'weapon',
    stats: { atk: 45 }, value: 1500, rarity: 'rare',
    description: 'A blade forged in shadow.', requiredLevel: 25, requiredClass: 'warrior', icon: '🗡️',
  },
  void_staff: {
    id: 'void_staff', name: 'Void Staff', type: 'weapon', slot: 'weapon',
    stats: { matk: 55 }, value: 1500, rarity: 'rare',
    description: 'Channels the void itself.', requiredLevel: 25, requiredClass: 'mage', icon: '🌑',
  },
  shadow_bow: {
    id: 'shadow_bow', name: 'Shadow Bow', type: 'weapon', slot: 'weapon',
    stats: { atk: 50 }, value: 1500, rarity: 'rare',
    description: 'Arrows travel through shadow.', requiredLevel: 25, requiredClass: 'ranger', icon: '🏹',
  },
  // Legendary weapons
  excalibur: {
    id: 'excalibur', name: 'Excalibur', type: 'weapon', slot: 'weapon',
    stats: { atk: 100, def: 20 }, value: 9999, rarity: 'legendary',
    description: 'The legendary holy sword.', requiredLevel: 40, requiredClass: 'warrior', icon: '✨',
  },
  // Armor
  leather_armor: {
    id: 'leather_armor', name: 'Leather Armor', type: 'armor', slot: 'chest',
    stats: { def: 8 }, value: 50, rarity: 'common',
    description: 'Basic protection from leather.', requiredLevel: 1, icon: '🧥',
  },
  iron_armor: {
    id: 'iron_armor', name: 'Iron Armor', type: 'armor', slot: 'chest',
    stats: { def: 20 }, value: 300, rarity: 'uncommon',
    description: 'Solid iron plate armor.', requiredLevel: 10, icon: '🛡️',
  },
  shadow_mail: {
    id: 'shadow_mail', name: 'Shadow Mail', type: 'armor', slot: 'chest',
    stats: { def: 45, spd: 1 }, value: 1200, rarity: 'rare',
    description: 'Woven from shadow essence.', requiredLevel: 25, icon: '🌑',
  },
  // Helmets
  leather_helm: {
    id: 'leather_helm', name: 'Leather Helm', type: 'armor', slot: 'head',
    stats: { def: 4 }, value: 30, rarity: 'common',
    description: 'A simple leather helmet.', requiredLevel: 1, icon: '⛑️',
  },
  iron_helm: {
    id: 'iron_helm', name: 'Iron Helm', type: 'armor', slot: 'head',
    stats: { def: 12 }, value: 150, rarity: 'uncommon',
    description: 'Solid iron head protection.', requiredLevel: 10, icon: '⛑️',
  },
  // Legs
  leather_legs: {
    id: 'leather_legs', name: 'Leather Leggings', type: 'armor', slot: 'legs',
    stats: { def: 5 }, value: 40, rarity: 'common',
    description: 'Leather protection for legs.', requiredLevel: 1, icon: '👖',
  },
  iron_legs: {
    id: 'iron_legs', name: 'Iron Leggings', type: 'armor', slot: 'legs',
    stats: { def: 15 }, value: 200, rarity: 'uncommon',
    description: 'Iron plates for legs.', requiredLevel: 10, icon: '👖',
  },
  // Rings
  ring_power: {
    id: 'ring_power', name: 'Ring of Power', type: 'armor', slot: 'ring',
    stats: { atk: 5, matk: 5 }, value: 500, rarity: 'uncommon',
    description: 'Enhances physical and magic power.', requiredLevel: 8, icon: '💍',
  },
  // Consumables
  health_potion: {
    id: 'health_potion', name: 'Health Potion', type: 'consumable',
    consumeEffect: { hp: 100 }, value: 25, rarity: 'common',
    description: 'Restores 100 HP.', requiredLevel: 1, icon: '🧪',
  },
  mana_potion: {
    id: 'mana_potion', name: 'Mana Potion', type: 'consumable',
    consumeEffect: { mp: 80 }, value: 25, rarity: 'common',
    description: 'Restores 80 MP.', requiredLevel: 1, icon: '🫧',
  },
  elixir: {
    id: 'elixir', name: 'Elixir', type: 'consumable',
    consumeEffect: { hp: 250, mp: 200 }, value: 200, rarity: 'uncommon',
    description: 'Fully restores HP and MP.', requiredLevel: 1, icon: '✨',
  },
  // Materials (drops)
  slime_gel: {
    id: 'slime_gel', name: 'Slime Gel', type: 'material',
    value: 5, rarity: 'common', description: 'Sticky gel from a slime.', requiredLevel: 0, icon: '🟢',
  },
  wolf_fang: {
    id: 'wolf_fang', name: 'Wolf Fang', type: 'material',
    value: 12, rarity: 'common', description: 'A sharp wolf fang.', requiredLevel: 0, icon: '🦷',
  },
  goblin_ear: {
    id: 'goblin_ear', name: 'Goblin Ear', type: 'material',
    value: 15, rarity: 'common', description: 'Proof of goblin slaying.', requiredLevel: 0, icon: '👂',
  },
  orc_tusk: {
    id: 'orc_tusk', name: 'Orc Tusk', type: 'material',
    value: 30, rarity: 'uncommon', description: 'A heavy orc tusk.', requiredLevel: 0, icon: '🦷',
  },
  demon_soul: {
    id: 'demon_soul', name: 'Demon Soul', type: 'material',
    value: 200, rarity: 'rare', description: 'A soul torn from a demon.', requiredLevel: 0, icon: '💜',
  },
  dragon_scale: {
    id: 'dragon_scale', name: 'Dragon Scale', type: 'material',
    value: 500, rarity: 'legendary', description: 'An extremely rare dragon scale.', requiredLevel: 0, icon: '🐉',
  },
};

// ─── SHOP INVENTORIES ─────────────────────────────────────────────────────────

export const BLACKSMITH_ITEMS = [
  'rusty_sword', 'oak_staff', 'short_bow',
  'leather_armor', 'leather_helm', 'leather_legs',
  'steel_sword', 'fire_staff', 'hunters_bow',
  'iron_armor', 'iron_helm', 'iron_legs',
];

export const MERCHANT_ITEMS = [
  'health_potion', 'mana_potion', 'elixir', 'ring_power',
];

// ─── MONSTER TEMPLATES ────────────────────────────────────────────────────────

export interface MonsterTemplate {
  type: string;
  name: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  aggroRange: number;
  attackRange: number;
  xpReward: number;
  goldReward: number;
  drops: DropEntry[];
  color: string;
  zone: string;
  attackCooldown: number;
}

export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  {
    type: 'slime', name: 'Green Slime', level: 1, hp: 30, atk: 5, def: 2, spd: 1.5,
    aggroRange: 5, attackRange: 1.2, xpReward: 10, goldReward: 2, attackCooldown: 1500,
    drops: [{ itemId: 'slime_gel', chance: 0.7, qty: 1 }, { itemId: 'health_potion', chance: 0.1, qty: 1 }],
    color: '#4fc34f', zone: 'forest',
  },
  {
    type: 'wolf', name: 'Dark Wolf', level: 4, hp: 70, atk: 12, def: 5, spd: 3.5,
    aggroRange: 7, attackRange: 1.3, xpReward: 35, goldReward: 8, attackCooldown: 1200,
    drops: [{ itemId: 'wolf_fang', chance: 0.6, qty: 1 }, { itemId: 'health_potion', chance: 0.15, qty: 1 }],
    color: '#555577', zone: 'forest',
  },
  {
    type: 'goblin', name: 'Forest Goblin', level: 7, hp: 110, atk: 18, def: 8, spd: 2.8,
    aggroRange: 6, attackRange: 1.2, xpReward: 70, goldReward: 15, attackCooldown: 1000,
    drops: [{ itemId: 'goblin_ear', chance: 0.8, qty: 1 }, { itemId: 'rusty_sword', chance: 0.05, qty: 1 }],
    color: '#aa5533', zone: 'forest',
  },
  {
    type: 'scorpion', name: 'Desert Scorpion', level: 8, hp: 130, atk: 22, def: 10, spd: 2.5,
    aggroRange: 5, attackRange: 1.3, xpReward: 80, goldReward: 18, attackCooldown: 1100,
    drops: [{ itemId: 'health_potion', chance: 0.2, qty: 1 }],
    color: '#cc8833', zone: 'desert',
  },
  {
    type: 'zombie', name: 'Swamp Zombie', level: 12, hp: 200, atk: 28, def: 12, spd: 1.8,
    aggroRange: 5, attackRange: 1.3, xpReward: 130, goldReward: 25, attackCooldown: 1400,
    drops: [{ itemId: 'mana_potion', chance: 0.15, qty: 1 }],
    color: '#5a8a4a', zone: 'swamp',
  },
  {
    type: 'orc', name: 'Mountain Orc', level: 18, hp: 320, atk: 40, def: 20, spd: 2.2,
    aggroRange: 6, attackRange: 1.4, xpReward: 250, goldReward: 50, attackCooldown: 1300,
    drops: [{ itemId: 'orc_tusk', chance: 0.6, qty: 1 }, { itemId: 'iron_armor', chance: 0.04, qty: 1 }],
    color: '#668833', zone: 'mountains',
  },
  {
    type: 'demon', name: 'Shadow Demon', level: 30, hp: 600, atk: 70, def: 35, spd: 3.0,
    aggroRange: 8, attackRange: 2.0, xpReward: 700, goldReward: 150, attackCooldown: 900,
    drops: [{ itemId: 'demon_soul', chance: 0.4, qty: 1 }, { itemId: 'dark_blade', chance: 0.03, qty: 1 }],
    color: '#882288', zone: 'dungeon',
  },
  {
    type: 'dragon', name: 'Ancient Dragon', level: 50, hp: 5000, atk: 150, def: 80, spd: 2.5,
    aggroRange: 12, attackRange: 3.0, xpReward: 10000, goldReward: 2000, attackCooldown: 800,
    drops: [{ itemId: 'dragon_scale', chance: 0.8, qty: 1 }, { itemId: 'excalibur', chance: 0.15, qty: 1 }, { itemId: 'elixir', chance: 1, qty: 3 }],
    color: '#cc3322', zone: 'lavalands',
  },
];

// ─── QUESTS ───────────────────────────────────────────────────────────────────

export const QUESTS: Quest[] = [
  {
    id: 'q_slimes', name: 'Slime Problem', requiredLevel: 1,
    description: 'The forest slimes are getting out of hand. Kill 5 of them.',
    objectives: [{ type: 'kill', target: 'slime', quantity: 5, label: 'Slay Forest Slimes' }],
    reward: { xp: 100, gold: 50 },
  },
  {
    id: 'q_wolves', name: 'Wolf Hunt', requiredLevel: 3,
    description: 'Dark wolves are terrorizing travelers. Hunt 8 wolves.',
    objectives: [{ type: 'kill', target: 'wolf', quantity: 8, label: 'Hunt Dark Wolves' }],
    reward: { xp: 300, gold: 100 },
  },
  {
    id: 'q_goblins', name: 'Goblin Raid', requiredLevel: 6,
    description: 'Goblins have been raiding villages. Eliminate 10 goblins.',
    objectives: [{ type: 'kill', target: 'goblin', quantity: 10, label: 'Defeat Forest Goblins' }],
    reward: { xp: 700, gold: 200, items: ['steel_sword'] },
  },
  {
    id: 'q_orcs', name: 'Mountain Threat', requiredLevel: 15,
    description: 'An orc warband is gathering in the mountains. Defeat 8 orcs.',
    objectives: [{ type: 'kill', target: 'orc', quantity: 8, label: 'Defeat Mountain Orcs' }],
    reward: { xp: 2500, gold: 800, items: ['shadow_mail'] },
  },
  {
    id: 'q_dragon', name: 'Dragon Slayer', requiredLevel: 40,
    description: 'A legendary dragon has awakened in the lava lands. Slay it and become a hero!',
    objectives: [{ type: 'kill', target: 'dragon', quantity: 1, label: 'Slay the Ancient Dragon' }],
    reward: { xp: 50000, gold: 10000, items: ['excalibur'] },
  },
];

// ─── NPC DEFINITIONS ─────────────────────────────────────────────────────────

export const NPC_DEFS = [
  {
    id: 'npc_inn', name: 'Innkeeper Rosa', role: 'healer' as const,
    x: 63, y: 62, dialogue: 'Welcome to Base Home! Rest here to restore your health and mana.',
    color: '#e8c96d',
  },
  {
    id: 'npc_smith', name: 'Blacksmith Thor', role: 'shop' as const,
    x: 66, y: 63, dialogue: 'Fine weapons and armor! Only the best from my forge!',
    shopItems: BLACKSMITH_ITEMS, color: '#e87d44',
  },
  {
    id: 'npc_merchant', name: 'Merchant Lily', role: 'shop' as const,
    x: 63, y: 66, dialogue: 'Potions and supplies for all adventurers!',
    shopItems: MERCHANT_ITEMS, color: '#e84477',
  },
  {
    id: 'npc_quest', name: 'Captain Aldric', role: 'quest' as const,
    x: 66, y: 66, dialogue: 'Heroes are needed! Speak with me to take on quests.',
    color: '#6d9de8',
  },
];

// ─── CLASS BASE STATS ─────────────────────────────────────────────────────────

export const CLASS_STATS: Record<string, { hp: number; mp: number; atk: number; def: number; spd: number; matk: number }> = {
  warrior: { hp: 200, mp: 50, atk: 18, def: 22, spd: 4, matk: 5 },
  mage: { hp: 90, mp: 200, atk: 8, def: 8, spd: 5, matk: 28 },
  ranger: { hp: 140, mp: 100, atk: 22, def: 12, spd: 7, matk: 10 },
};

export const CLASS_COLORS: Record<string, string> = {
  warrior: '#e74c3c',
  mage: '#3498db',
  ranger: '#2ecc71',
};

export const CLASS_DESCRIPTIONS: Record<string, string> = {
  warrior: 'A mighty fighter with high HP and defense. Excels at melee combat.',
  mage: 'A powerful spellcaster with devastating magic. Fragile but deadly.',
  ranger: 'A swift hunter with ranged attacks. Balanced stats and high speed.',
};

// ─── XP CURVE ─────────────────────────────────────────────────────────────────

export function xpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.4, level - 1));
}

export function calcLevel(totalXp: number): { level: number; xp: number; xpToNext: number } {
  let level = 1;
  let remaining = totalXp;
  while (true) {
    const needed = xpToNextLevel(level);
    if (remaining < needed) break;
    remaining -= needed;
    level++;
    if (level >= 60) break;
  }
  return { level, xp: remaining, xpToNext: xpToNextLevel(level) };
}

// ─── STARTER EQUIPMENT ───────────────────────────────────────────────────────

export function getStarterEquipment(cls: string): Partial<Record<string, Item>> {
  const weapon = cls === 'warrior' ? ITEMS.rusty_sword : cls === 'mage' ? ITEMS.oak_staff : ITEMS.short_bow;
  return { weapon };
}

export function getStarterInventory(): (Item | null)[] {
  const inv = new Array(20).fill(null);
  inv[0] = ITEMS.health_potion;
  inv[1] = ITEMS.health_potion;
  inv[2] = ITEMS.mana_potion;
  return inv;
}
