export type TileType = 'grass' | 'water' | 'tree' | 'mountain' | 'sand' | 'dungeon' | 'town' | 'road' | 'stone' | 'swamp' | 'lava';

export type CharacterClass = 'warrior' | 'mage' | 'ranger';

export type EquipSlot = 'head' | 'chest' | 'legs' | 'weapon' | 'offhand' | 'ring';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type MonsterState = 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';

export interface Position {
  x: number;
  y: number;
}

export interface Camera {
  x: number;
  y: number;
}

export interface Stats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  spd: number;
  matk: number;
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'material';
  slot?: EquipSlot;
  stats?: Partial<Stats>;
  consumeEffect?: { hp?: number; mp?: number };
  value: number;
  rarity: Rarity;
  description: string;
  requiredLevel: number;
  requiredClass?: CharacterClass;
  icon: string;
}

export interface DropEntry {
  itemId: string;
  chance: number;
  qty: number;
}

export interface QuestObjective {
  type: 'kill' | 'collect' | 'reach';
  target: string;
  quantity: number;
  label: string;
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  objectives: QuestObjective[];
  reward: { xp: number; gold: number; items?: string[] };
  requiredLevel: number;
}

export interface QuestProgress {
  questId: string;
  status: 'active' | 'complete' | 'claimed';
  progress: Record<string, number>;
}

export interface Player {
  id: string;
  name: string;
  class: CharacterClass;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  stats: Stats;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  moving: boolean;
  inventory: (Item | null)[];
  equipment: Partial<Record<EquipSlot, Item>>;
  quests: QuestProgress[];
  targetId: string | null;
  lastAttackTime: number;
  attackCooldown: number;
  respawnTimer: number;
  dead: boolean;
  animTick: number;
}

export interface Monster {
  id: string;
  type: string;
  name: string;
  level: number;
  stats: Stats;
  x: number;
  y: number;
  state: MonsterState;
  targetId: string | null;
  aggroRange: number;
  attackRange: number;
  patrolX: number;
  patrolY: number;
  spawnX: number;
  spawnY: number;
  lastAttackTime: number;
  attackCooldown: number;
  xpReward: number;
  goldReward: number;
  drops: DropEntry[];
  color: string;
  zone: string;
  dead: boolean;
  deadTimer: number;
  animTick: number;
}

export interface NPC {
  id: string;
  name: string;
  role: 'shop' | 'quest' | 'healer' | 'banker';
  x: number;
  y: number;
  dialogue: string;
  shopItems?: string[];
  color: string;
}

export interface RemotePlayer {
  id: string;
  name: string;
  class: CharacterClass;
  level: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface DamageNumber {
  id: string;
  value: number;
  x: number;
  y: number;
  color: string;
  isCrit: boolean;
  startTime: number;
}

export interface ChatMessage {
  id: string;
  playerName: string;
  message: string;
  channel: 'global' | 'local' | 'system' | 'combat';
  timestamp: number;
}

export interface WorldTile {
  type: TileType;
  walkable: boolean;
  zone: string;
}

export interface UIState {
  player: Player;
  monsters: Monster[];
  npcs: NPC[];
  otherPlayers: RemotePlayer[];
  chat: ChatMessage[];
  damageNumbers: DamageNumber[];
  nearbyNPC: NPC | null;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export const TILE_SIZE = 40;
export const WORLD_WIDTH = 128;
export const WORLD_HEIGHT = 128;
export const INVENTORY_SIZE = 20;
export const SPAWN_X = 64;
export const SPAWN_Y = 64;
