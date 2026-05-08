import type { WorldTile, TileType } from './types';
import { WORLD_WIDTH, WORLD_HEIGHT } from './types';

function hash(x: number, y: number, seed: number): number {
  let n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.3) * 43758.5453123;
  return n - Math.floor(n);
}

function fractal(x: number, y: number, scale: number, seed: number): number {
  let v = 0;
  v += hash(x / scale, y / scale, seed) * 0.5;
  v += hash(x / (scale * 0.5), y / (scale * 0.5), seed + 50) * 0.3;
  v += hash(x / (scale * 0.25), y / (scale * 0.25), seed + 100) * 0.2;
  return v;
}

const ZONE_DEFS: Record<string, { name: string; minLevel: number; maxLevel: number; safe: boolean; color: string }> = {
  town: { name: 'Base Home Town', minLevel: 0, maxLevel: 0, safe: true, color: '#8c7355' },
  meadow: { name: 'Sunny Meadow', minLevel: 0, maxLevel: 0, safe: true, color: '#4a7c59' },
  forest: { name: 'Dark Forest', minLevel: 1, maxLevel: 10, safe: false, color: '#2d5016' },
  desert: { name: 'Scorched Desert', minLevel: 5, maxLevel: 15, safe: false, color: '#c4a46b' },
  swamp: { name: 'Death Swamp', minLevel: 10, maxLevel: 20, safe: false, color: '#4a6b3c' },
  mountains: { name: 'Frozen Mountains', minLevel: 15, maxLevel: 30, safe: false, color: '#6c7c8c' },
  dungeon: { name: 'Shadow Dungeon', minLevel: 25, maxLevel: 50, safe: false, color: '#3c2d3c' },
  lavalands: { name: 'Lava Lands', minLevel: 35, maxLevel: 50, safe: false, color: '#8c3020' },
};

function getZone(x: number, y: number): string {
  const cx = WORLD_WIDTH / 2;
  const cy = WORLD_HEIGHT / 2;
  const dx = x - cx;
  const dy = y - cy;

  // Town core
  if (Math.abs(dx) <= 5 && Math.abs(dy) <= 5) return 'town';
  // Safe meadow around town
  if (Math.abs(dx) <= 14 && Math.abs(dy) <= 14) return 'meadow';

  // Cardinal directions define biomes
  const angle = Math.atan2(dy, dx);
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 55) {
    // Far corners → dungeon/lava
    if (x > cx + 40 && y > cy + 40) return 'dungeon';
    if (x < cx - 40 && y < cy - 40) return 'lavalands';
    if (x > cx + 40 && y < cy - 40) return 'dungeon';
    if (x < cx - 40 && y > cy + 40) return 'lavalands';
  }

  // North: forest
  if (angle < -Math.PI / 4 && angle > (-3 * Math.PI) / 4) return 'forest';
  // South: mountains
  if (angle > Math.PI / 4 && angle < (3 * Math.PI) / 4) return 'mountains';
  // East: desert
  if (angle > -Math.PI / 4 && angle < Math.PI / 4) return 'desert';
  // West: swamp
  return 'swamp';
}

function getTileType(x: number, y: number, zone: string, noise: number): { type: TileType; walkable: boolean } {
  if (zone === 'town') return { type: 'town', walkable: true };

  if (zone === 'meadow') {
    // Roads from town in 4 directions
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    if ((x === cx && Math.abs(y - cy) <= 14) || (y === cy && Math.abs(x - cx) <= 14)) {
      return { type: 'road', walkable: true };
    }
    if (noise > 0.82) return { type: 'tree', walkable: false };
    if (noise > 0.78) return { type: 'water', walkable: false };
    return { type: 'grass', walkable: true };
  }

  if (zone === 'forest') {
    if (noise > 0.55) return { type: 'tree', walkable: false };
    if (noise > 0.52 && noise < 0.54) return { type: 'water', walkable: false };
    return { type: 'grass', walkable: true };
  }

  if (zone === 'desert') {
    if (noise > 0.75) return { type: 'stone', walkable: false };
    if (noise < 0.08) return { type: 'water', walkable: false };
    return { type: 'sand', walkable: true };
  }

  if (zone === 'swamp') {
    if (noise > 0.65) return { type: 'tree', walkable: false };
    if (noise < 0.2) return { type: 'water', walkable: false };
    return { type: 'swamp', walkable: true };
  }

  if (zone === 'mountains') {
    if (noise > 0.5) return { type: 'mountain', walkable: false };
    if (noise > 0.35) return { type: 'stone', walkable: true };
    return { type: 'sand', walkable: true };
  }

  if (zone === 'dungeon') {
    if (noise > 0.68) return { type: 'stone', walkable: false };
    return { type: 'dungeon', walkable: true };
  }

  if (zone === 'lavalands') {
    if (noise > 0.65) return { type: 'stone', walkable: false };
    if (noise < 0.15) return { type: 'lava', walkable: false };
    return { type: 'dungeon', walkable: true };
  }

  return { type: 'grass', walkable: true };
}

let _cachedWorld: WorldTile[][] | null = null;

export function generateWorld(): WorldTile[][] {
  if (_cachedWorld) return _cachedWorld;

  const world: WorldTile[][] = [];
  const SEED = 42;

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    world[y] = [];
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const zone = getZone(x, y);
      const noise = fractal(x, y, 8, SEED);
      const { type, walkable } = getTileType(x, y, zone, noise);
      world[y][x] = { type, walkable, zone };
    }
  }

  _cachedWorld = world;
  return world;
}

export function isWalkable(world: WorldTile[][], x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return false;
  return world[ty][tx].walkable;
}

export function getZoneAt(world: WorldTile[][], x: number, y: number): string {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return 'unknown';
  return world[ty][tx].zone;
}

export const ZONE_INFO = ZONE_DEFS;

export const TILE_COLORS: Record<TileType, string> = {
  grass: '#3d7a45',
  water: '#1a5276',
  tree: '#1a4020',
  mountain: '#566573',
  sand: '#c9a84c',
  dungeon: '#2e1a47',
  town: '#7d6544',
  road: '#8a7560',
  stone: '#626567',
  swamp: '#2e4d2e',
  lava: '#c0392b',
};

export const TILE_ACCENT_COLORS: Record<TileType, string> = {
  grass: '#4a9455',
  water: '#1f6796',
  tree: '#145218',
  mountain: '#717d7e',
  sand: '#d4ac5a',
  dungeon: '#3d2257',
  town: '#8c7355',
  road: '#9c8c7c',
  stone: '#717d7e',
  swamp: '#3a5e3a',
  lava: '#e74c3c',
};
