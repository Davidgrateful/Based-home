import type { RoomCell } from './homeRooms';
import { ROOM_DEFS } from './homeRooms';

export interface RaidLogEntry {
  type: 'move' | 'trap' | 'combat' | 'loot' | 'escape' | 'fail' | 'system';
  message: string;
  hpBefore?: number;
  hpAfter?: number;
  goldFound?: number;
}

export interface RaidResult {
  status: 'success' | 'failed' | 'escaped';
  goldStolen: number;
  materialsStolen: number;
  trapsTriggered: number;
  guardsDefeated: number;
  attackerHpRemaining: number;
  log: RaidLogEntry[];
  pathTaken: { x: number; y: number }[];
  xpEarned: number;
}

interface RaiderStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  hackLevel: number; // 1-99
  combatLevel: number; // 1-99
  carryCapacity: number;
  timeLimit: number; // seconds
}

// Simulate an async raid turn-by-turn
export function simulateRaid(
  layout: RoomCell[][],
  homeGold: number,
  homeMaterials: number,
  raider: RaiderStats,
): RaidResult {
  const log: RaidLogEntry[] = [];
  const path: { x: number; y: number }[] = [];
  let hp = raider.hp;
  let goldStolen = 0;
  let materialsStolen = 0;
  let trapsTriggered = 0;
  let guardsDefeated = 0;
  let carryWeight = 0;
  let timeUsed = 0;
  let alarmRaised = false;

  const push = (type: RaidLogEntry['type'], message: string, extra?: Partial<RaidLogEntry>) =>
    log.push({ type, message, ...extra });

  // Find entrance
  let startX = -1, startY = -1;
  outer: for (let y = 0; y < layout.length; y++) {
    for (let x = 0; x < (layout[y]?.length ?? 0); x++) {
      if (layout[y][x]?.type === 'entrance') { startX = x; startY = y; break outer; }
    }
  }
  if (startX === -1) { startX = 0; startY = 0; }

  push('system', `[RAID INITIATED] Entering at cell (${startX},${startY})`);
  path.push({ x: startX, y: startY });
  timeUsed += 2;

  // BFS-like exploration: raider navigates toward vaults
  const GRID_SIZE = layout.length;
  const visited = new Set<string>();
  visited.add(`${startX},${startY}`);

  // Find all vaults and plan a route
  const vaultPositions: { x: number; y: number }[] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < (layout[y]?.length ?? 0); x++) {
      const cell = layout[y]?.[x];
      if (cell && (cell.type === 'vault' || cell.type === 'fake_vault')) {
        vaultPositions.push({ x, y });
      }
    }
  }

  push('move', `[SCOUTING] ${vaultPositions.length} vault signatures detected. Moving to intercept.`);

  // Simulate movement through rooms
  let cx = startX, cy = startY;
  const maxSteps = 40;

  for (let step = 0; step < maxSteps && hp > 0 && timeUsed < raider.timeLimit; step++) {
    // Find nearest unvisited non-wall room with something interesting
    // Simple pathfinding: try to move toward nearest vault
    const target = vaultPositions.find(v => !visited.has(`${v.x},${v.y}`)) ?? null;

    // Move step
    const directions = [
      { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 },
    ];

    let moved = false;
    for (const dir of directions.sort(() => {
      // Sort toward target if exists
      if (!target) return Math.random() - 0.5;
      const a = Math.abs((cx + dir.dx) - target.x) + Math.abs((cy + dir.dy) - target.y);
      const b = Math.abs(cx - target.x) + Math.abs(cy - target.y);
      return a - b;
    })) {
      const nx = cx + dir.dx, ny = cy + dir.dy;
      if (nx < 0 || ny < 0 || ny >= GRID_SIZE || nx >= (layout[ny]?.length ?? 0)) continue;
      const cell = layout[ny]?.[nx];
      if (!cell || visited.has(`${nx},${ny}`)) continue;
      if (cell.type === 'empty') { visited.add(`${nx},${ny}`); continue; }

      visited.add(`${nx},${ny}`);
      path.push({ x: nx, y: ny });
      cx = nx; cy = ny;
      timeUsed += 3;
      moved = true;

      // Process room
      if (cell.type === 'wall') {
        const breakTime = 5 * cell.level;
        timeUsed += breakTime;
        push('move', `[WALL] Breaking through Wall Lv${cell.level}... (${breakTime}s)`);
        break;
      }

      if (cell.type === 'trap') {
        trapsTriggered++;
        alarmRaised = true;
        const dmg = (ROOM_DEFS.trap.trapDamage ?? 25) * cell.level;
        const hpBefore = hp;
        hp -= dmg;
        push('trap', `[TRAP] 🪤 TRAP TRIGGERED! Lv${cell.level} trap deals ${dmg} damage!`, { hpBefore, hpAfter: hp });
        if (!alarmRaised) push('system', `[ALARM] Security alarm raised! Guards mobilizing!`);
      }

      if (cell.type === 'barracks' || (alarmRaised && Math.random() < 0.4)) {
        const guardCount = cell.type === 'barracks' ? cell.level : 1;
        for (let g = 0; g < guardCount && hp > 0; g++) {
          const guardHp = 30 + raider.combatLevel;
          const guardAtk = 10 + Math.floor(cell.level * 5);
          const playerAtk = 15 + Math.floor(raider.combatLevel * 0.5);
          // Simulate combat rounds
          let gHp = guardHp;
          let rounds = 0;
          while (gHp > 0 && hp > 0 && rounds < 20) {
            gHp -= playerAtk + Math.floor(Math.random() * 10);
            if (gHp > 0) { hp -= Math.max(1, guardAtk - raider.def); }
            rounds++;
          }
          if (gHp <= 0) {
            guardsDefeated++;
            push('combat', `[COMBAT] ⚔️ Guard defeated after ${rounds} rounds. ${hp} HP remaining.`, { hpAfter: hp });
          } else {
            push('combat', `[COMBAT] ⚔️ Guard overpowered! Taking heavy hits.`, { hpAfter: hp });
          }
          timeUsed += rounds * 2;
        }
      }

      if (cell.type === 'fake_vault') {
        trapsTriggered++;
        alarmRaised = true;
        const hpBefore = hp;
        const dmg = (ROOM_DEFS.fake_vault.trapDamage ?? 20) * cell.level;
        hp -= dmg;
        timeUsed += 8; // time wasted cracking it
        push('trap', `[DECOY] 🎭 DECOY VAULT! Lost 8 seconds. Trap fires for ${dmg} damage!`, { hpBefore, hpAfter: hp });
        push('system', `[ALARM] Alarm triggered by decoy vault!`);
      }

      if (cell.type === 'vault' && hp > 0) {
        // Try to crack vault
        const crackDifficulty = cell.level * 10;
        const hackSuccess = raider.hackLevel >= crackDifficulty;
        const crackTime = hackSuccess ? 5 : 15;
        timeUsed += crackTime;

        if (hackSuccess || raider.hackLevel > crackDifficulty * 0.6) {
          const maxGold = Math.min(homeGold, Math.floor(homeGold * 0.3), raider.carryCapacity - carryWeight);
          const goldFound = Math.max(0, Math.floor(maxGold * (0.5 + Math.random() * 0.5)));
          goldStolen += goldFound;
          carryWeight += goldFound;
          const matFound = Math.min(homeMaterials, Math.floor(Math.random() * 20 * cell.level));
          materialsStolen += matFound;
          push('loot', `[LOOT] 💰 Vault Lv${cell.level} cracked! Seized ${goldFound}g + ${matFound} materials.`, { goldFound });
        } else {
          push('system', `[BLOCKED] Vault Lv${cell.level} requires Hacking ${crackDifficulty}. (yours: ${raider.hackLevel}). Bypassing...`);
          timeUsed += 10;
        }
      }

      break;
    }

    if (!moved) break;
    if (hp <= 0) break;
    if (timeUsed >= raider.timeLimit) break;
  }

  // Determine outcome
  if (hp <= 0) {
    push('fail', `[DEFEATED] ☠️ You were overwhelmed by the defenses. Raid failed.`);
    return { status: 'failed', goldStolen: 0, materialsStolen: 0, trapsTriggered, guardsDefeated, attackerHpRemaining: 0, log, pathTaken: path, xpEarned: Math.floor(guardsDefeated * 10 + trapsTriggered * 5) };
  }

  if (timeUsed >= raider.timeLimit) {
    push('escape', `[TIMEOUT] ⏱️ Time's up! Escaping with ${goldStolen}g...`);
    const xp = Math.floor(goldStolen * 0.1 + guardsDefeated * 15 + trapsTriggered * 8);
    push('escape', `[ESCAPED] ✅ Raid complete. +${xp} XP earned.`);
    return { status: 'escaped', goldStolen, materialsStolen, trapsTriggered, guardsDefeated, attackerHpRemaining: hp, log, pathTaken: path, xpEarned: xp };
  }

  push('escape', `[ESCAPE] ✅ Extraction complete. Loot secured: ${goldStolen}g.`);
  const xp = Math.floor(goldStolen * 0.15 + guardsDefeated * 20 + trapsTriggered * 10 + 50);
  push('escape', `[XP] +${xp} XP earned from this raid.`);
  return { status: 'success', goldStolen, materialsStolen, trapsTriggered, guardsDefeated, attackerHpRemaining: hp, log, pathTaken: path, xpEarned: xp };
}
