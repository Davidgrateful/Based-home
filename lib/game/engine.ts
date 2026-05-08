'use client';

import type {
  Player, Monster, NPC, RemotePlayer, DamageNumber, ChatMessage,
  UIState, InputState, WorldTile, Item,
} from './types';
import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT, SPAWN_X, SPAWN_Y, INVENTORY_SIZE } from './types';
import { generateWorld, isWalkable, getZoneAt, TILE_COLORS, TILE_ACCENT_COLORS } from './world';
import {
  MONSTER_TEMPLATES, NPC_DEFS, ITEMS, CLASS_STATS, CLASS_COLORS,
  QUESTS, xpToNextLevel, getStarterEquipment, getStarterInventory,
} from './data';

let nextId = 1;
function uid(prefix = 'e'): string { return `${prefix}_${nextId++}`; }

// ─── MONSTER SPAWNING ─────────────────────────────────────────────────────────

function spawnMonsters(world: WorldTile[][]): Monster[] {
  const monsters: Monster[] = [];
  const MONSTER_COUNT = 200;

  for (let i = 0; i < MONSTER_COUNT; i++) {
    const tmpl = MONSTER_TEMPLATES[Math.floor(Math.random() * (MONSTER_TEMPLATES.length - 1))]; // skip dragon
    let x = 0, y = 0, tries = 0;
    do {
      x = 5 + Math.floor(Math.random() * (WORLD_WIDTH - 10));
      y = 5 + Math.floor(Math.random() * (WORLD_HEIGHT - 10));
      tries++;
    } while ((world[y]?.[x]?.zone !== tmpl.zone || !world[y]?.[x]?.walkable || dist(x, y, SPAWN_X, SPAWN_Y) < 18) && tries < 50);
    if (tries >= 50) continue;

    monsters.push(makeMonster(tmpl, x, y));
  }

  // Spawn the Dragon boss in lavalands
  const dragonTmpl = MONSTER_TEMPLATES[MONSTER_TEMPLATES.length - 1];
  monsters.push(makeMonster(dragonTmpl, 20, 110));

  return monsters;
}

function makeMonster(tmpl: typeof MONSTER_TEMPLATES[0], x: number, y: number): Monster {
  return {
    id: uid('m'), type: tmpl.type, name: tmpl.name, level: tmpl.level,
    stats: { hp: tmpl.hp, maxHp: tmpl.hp, mp: 0, maxMp: 0, atk: tmpl.atk, def: tmpl.def, spd: tmpl.spd, matk: 0 },
    x, y, state: 'idle', targetId: null,
    aggroRange: tmpl.aggroRange, attackRange: tmpl.attackRange,
    patrolX: x + (Math.random() - 0.5) * 6, patrolY: y + (Math.random() - 0.5) * 6,
    spawnX: x, spawnY: y,
    lastAttackTime: 0, attackCooldown: tmpl.attackCooldown,
    xpReward: tmpl.xpReward, goldReward: tmpl.goldReward,
    drops: tmpl.drops, color: tmpl.color, zone: tmpl.zone,
    dead: false, deadTimer: 0, animTick: Math.random() * Math.PI * 2,
  };
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

// ─── PLAYER CREATION ─────────────────────────────────────────────────────────

export function createPlayer(id: string, name: string, cls: string): Player {
  const base = CLASS_STATS[cls] || CLASS_STATS.warrior;
  const equipment = getStarterEquipment(cls) as Partial<Record<string, Item>>;
  const inv = getStarterInventory();
  const starterWeapon = (equipment.weapon as Item | undefined);
  const atkBonus = starterWeapon?.stats?.atk ?? 0;
  const matkBonus = starterWeapon?.stats?.matk ?? 0;
  return {
    id, name, class: cls as Player['class'], level: 1, xp: 0,
    xpToNext: xpToNextLevel(1), gold: 100,
    stats: { ...base, maxHp: base.hp, maxMp: base.mp, atk: base.atk + atkBonus, matk: base.matk + matkBonus },
    x: SPAWN_X, y: SPAWN_Y, direction: 'down', moving: false,
    inventory: inv, equipment: equipment as Player['equipment'],
    quests: [], targetId: null,
    lastAttackTime: 0, attackCooldown: 1000,
    respawnTimer: 0, dead: false, animTick: 0,
  };
}

// ─── GAME ENGINE ─────────────────────────────────────────────────────────────

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world: WorldTile[][];
  public player: Player;
  private monsters: Monster[];
  private npcs: NPC[];
  private otherPlayers: RemotePlayer[];
  private damageNumbers: DamageNumber[];
  private chat: ChatMessage[];
  private input: InputState;
  private rafId: number | null = null;
  private lastTime = 0;
  private onUpdate: (state: UIState) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundClick: (e: MouseEvent) => void;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastSaveTime = 0;

  constructor(canvas: HTMLCanvasElement, player: Player, onUpdate: (state: UIState) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.world = generateWorld();
    this.player = player;
    this.monsters = spawnMonsters(this.world);
    this.npcs = NPC_DEFS.map(n => ({ ...n }));
    this.otherPlayers = [];
    this.damageNumbers = [];
    this.chat = [{ id: uid('c'), playerName: 'System', message: 'Welcome to BASE HOME! Use WASD to move. Click enemies to attack.', channel: 'system', timestamp: Date.now() }];
    this.input = { up: false, down: false, left: false, right: false };
    this.onUpdate = onUpdate;

    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundClick = this.onCanvasClick.bind(this);
  }

  start() {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    this.canvas.addEventListener('click', this.boundClick);
    this.rafId = requestAnimationFrame(this.loop.bind(this));

    // Poll other players every 4s
    this.pollInterval = setInterval(() => this.fetchOtherPlayers(), 4000);
    this.fetchOtherPlayers();
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    this.canvas.removeEventListener('click', this.boundClick);
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private loop(time: number) {
    const delta = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    if (!this.player.dead) {
      this.movePlayer(delta);
      this.updateCombat(time);
    } else {
      this.updateRespawn(time, delta);
    }

    this.updateMonsters(time, delta);
    this.updateDamageNumbers(time);

    // Auto-save every 15s
    if (time - this.lastSaveTime > 15000) {
      this.savePlayerToServer();
      this.lastSaveTime = time;
    }

    this.render(time);
    this.onUpdate(this.buildUIState());
    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  // ─── INPUT ──────────────────────────────────────────────────────────────────

  private onKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    switch (e.key.toLowerCase()) {
      case 'w': case 'arrowup': this.input.up = true; break;
      case 's': case 'arrowdown': this.input.down = true; break;
      case 'a': case 'arrowleft': this.input.left = true; break;
      case 'd': case 'arrowright': this.input.right = true; break;
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    switch (e.key.toLowerCase()) {
      case 'w': case 'arrowup': this.input.up = false; break;
      case 's': case 'arrowdown': this.input.down = false; break;
      case 'a': case 'arrowleft': this.input.left = false; break;
      case 'd': case 'arrowright': this.input.right = false; break;
    }
  }

  private onCanvasClick(e: MouseEvent) {
    if (this.player.dead) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const { camX, camY } = this.getCamera();
    const wx = (sx + camX) / TILE_SIZE;
    const wy = (sy + camY) / TILE_SIZE;

    // Check monster click
    let clicked: Monster | null = null;
    let bestDist = 1.5;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = dist(m.x + 0.5, m.y + 0.5, wx, wy);
      if (d < bestDist) { bestDist = d; clicked = m; }
    }

    if (clicked) {
      this.player.targetId = clicked.id;
    } else {
      this.player.targetId = null;
    }

    // NPC click
    for (const npc of this.npcs) {
      const d = dist(npc.x + 0.5, npc.y + 0.5, wx, wy);
      if (d < 1.5) {
        this.player.targetId = null;
        this.onUpdate(this.buildUIState(npc));
        return;
      }
    }
  }

  // ─── MOVEMENT ───────────────────────────────────────────────────────────────

  private movePlayer(delta: number) {
    const spd = this.player.stats.spd * delta;
    let dx = 0, dy = 0;
    if (this.input.up) { dy -= 1; this.player.direction = 'up'; }
    if (this.input.down) { dy += 1; this.player.direction = 'down'; }
    if (this.input.left) { dx -= 1; this.player.direction = 'left'; }
    if (this.input.right) { dx += 1; this.player.direction = 'right'; }

    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    const len = Math.sqrt(dx * dx + dy * dy);
    this.player.moving = len > 0;

    if (len > 0) {
      const nx = this.player.x + dx * spd;
      const ny = this.player.y + dy * spd;

      // Slide on collision
      const canX = isWalkable(this.world, nx, this.player.y);
      const canY = isWalkable(this.world, this.player.x, ny);

      if (canX) this.player.x = nx;
      if (canY) this.player.y = ny;

      this.player.x = Math.max(0.5, Math.min(WORLD_WIDTH - 1.5, this.player.x));
      this.player.y = Math.max(0.5, Math.min(WORLD_HEIGHT - 1.5, this.player.y));
      this.player.animTick += delta * 8;
    }
  }

  // ─── COMBAT ─────────────────────────────────────────────────────────────────

  private updateCombat(time: number) {
    if (!this.player.targetId) return;
    const target = this.monsters.find(m => m.id === this.player.targetId);
    if (!target || target.dead) { this.player.targetId = null; return; }

    const d = dist(this.player.x, this.player.y, target.x, target.y);
    const cls = this.player.class;
    const attackRange = cls === 'mage' ? 5 : cls === 'ranger' ? 4 : 1.8;

    if (d <= attackRange && time - this.player.lastAttackTime >= this.player.attackCooldown) {
      this.player.lastAttackTime = time;
      const { dmg, isCrit } = this.calcDamage(this.player.stats.atk + this.player.stats.matk, target.stats.def);
      target.stats.hp = Math.max(0, target.stats.hp - dmg);
      this.addDmgNum(target.x, target.y, dmg, isCrit, '#ff4444');

      if (target.stats.hp <= 0) this.killMonster(target, time);
    }
  }

  private calcDamage(atk: number, def: number): { dmg: number; isCrit: boolean } {
    const base = Math.max(1, atk - def * 0.5 + (Math.random() - 0.5) * atk * 0.3);
    const isCrit = Math.random() < 0.15;
    const dmg = Math.floor(isCrit ? base * 2 : base);
    return { dmg, isCrit };
  }

  private killMonster(m: Monster, time: number) {
    m.dead = true;
    m.state = 'dead';
    m.deadTimer = time;
    m.targetId = null;

    // XP
    const xpGain = m.xpReward;
    const goldGain = m.goldReward + Math.floor(Math.random() * m.goldReward * 0.5);
    this.player.xp += xpGain;
    this.player.gold += goldGain;
    this.addSysMsg(`+${xpGain} XP, +${goldGain} gold`);

    // Level up check
    while (this.player.xp >= this.player.xpToNext && this.player.level < 60) {
      this.player.xp -= this.player.xpToNext;
      this.player.level++;
      this.player.xpToNext = xpToNextLevel(this.player.level);
      this.levelUpStats();
      this.addSysMsg(`LEVEL UP! You are now level ${this.player.level}!`);
    }

    // Drops
    for (const drop of m.drops) {
      if (Math.random() < drop.chance) {
        const item = ITEMS[drop.itemId];
        if (item) {
          this.addToInventory(item);
          this.addSysMsg(`${m.name} dropped ${item.icon} ${item.name}!`);
        }
      }
    }

    // Quest progress
    this.updateQuestKill(m.type);

    // Respawn after 15s
    setTimeout(() => {
      m.dead = false;
      m.stats.hp = m.stats.maxHp;
      m.x = m.spawnX;
      m.y = m.spawnY;
      m.state = 'idle';
      m.targetId = null;
    }, 15000);
  }

  private levelUpStats() {
    const cls = this.player.class;
    const gains = cls === 'warrior'
      ? { hp: 20, mp: 5, atk: 3, def: 4, spd: 0.1, matk: 0 }
      : cls === 'mage'
        ? { hp: 8, mp: 20, atk: 1, def: 1, spd: 0.2, matk: 5 }
        : { hp: 12, mp: 10, atk: 4, def: 2, spd: 0.3, matk: 1 };

    this.player.stats.maxHp += gains.hp;
    this.player.stats.maxMp += gains.mp;
    this.player.stats.hp = this.player.stats.maxHp;
    this.player.stats.mp = this.player.stats.maxMp;
    this.player.stats.atk += gains.atk;
    this.player.stats.def += gains.def;
    this.player.stats.spd += gains.spd;
    this.player.stats.matk += gains.matk;
    this.player.attackCooldown = Math.max(400, 1000 - this.player.level * 10);
  }

  // ─── MONSTER AI ─────────────────────────────────────────────────────────────

  private updateMonsters(time: number, delta: number) {
    for (const m of this.monsters) {
      if (m.dead) continue;
      m.animTick += delta * 4;

      const dToPlayer = dist(m.x, m.y, this.player.x, this.player.y);

      // Aggro
      if (!this.player.dead && dToPlayer <= m.aggroRange && m.state !== 'chase' && m.state !== 'attack') {
        m.state = 'chase';
        m.targetId = this.player.id;
      }

      // De-aggro if too far
      if (m.state === 'chase' || m.state === 'attack') {
        const dToSpawn = dist(m.x, m.y, m.spawnX, m.spawnY);
        if (dToSpawn > 20 || this.player.dead) {
          m.state = 'idle';
          m.targetId = null;
          m.x = m.spawnX;
          m.y = m.spawnY;
          m.stats.hp = m.stats.maxHp;
          continue;
        }
      }

      switch (m.state) {
        case 'idle': {
          // Slowly patrol
          const pdist = dist(m.x, m.y, m.patrolX, m.patrolY);
          if (pdist < 0.2) {
            m.patrolX = m.spawnX + (Math.random() - 0.5) * 5;
            m.patrolY = m.spawnY + (Math.random() - 0.5) * 5;
          } else {
            const speed = m.stats.spd * 0.3 * delta;
            const ndx = (m.patrolX - m.x) / pdist;
            const ndy = (m.patrolY - m.y) / pdist;
            const nx = m.x + ndx * speed;
            const ny = m.y + ndy * speed;
            if (isWalkable(this.world, nx, ny)) { m.x = nx; m.y = ny; }
          }
          break;
        }
        case 'chase': {
          if (dToPlayer <= m.attackRange) {
            m.state = 'attack';
          } else {
            const speed = m.stats.spd * delta;
            const ndx = (this.player.x - m.x) / dToPlayer;
            const ndy = (this.player.y - m.y) / dToPlayer;
            const nx = m.x + ndx * speed;
            const ny = m.y + ndy * speed;
            if (isWalkable(this.world, nx, ny)) { m.x = nx; m.y = ny; }
          }
          break;
        }
        case 'attack': {
          if (dToPlayer > m.attackRange * 1.3) {
            m.state = 'chase';
          } else if (time - m.lastAttackTime >= m.attackCooldown) {
            m.lastAttackTime = time;
            const { dmg, isCrit } = this.calcDamage(m.stats.atk, this.player.stats.def);
            this.player.stats.hp = Math.max(0, this.player.stats.hp - dmg);
            this.addDmgNum(this.player.x, this.player.y, dmg, isCrit, '#ff9900');

            if (this.player.stats.hp <= 0) {
              this.player.dead = true;
              this.player.respawnTimer = Date.now() + 8000;
              this.player.targetId = null;
              this.addSysMsg('You have been defeated! Respawning in 8 seconds...');
            }
          }
          break;
        }
      }
    }
  }

  private updateRespawn(_time: number, _delta: number) {
    if (Date.now() >= this.player.respawnTimer) {
      this.player.dead = false;
      this.player.x = SPAWN_X;
      this.player.y = SPAWN_Y;
      this.player.stats.hp = Math.floor(this.player.stats.maxHp * 0.5);
      this.player.stats.mp = Math.floor(this.player.stats.maxMp * 0.5);
      this.addSysMsg('You have respawned at Base Home Town!');
    }
  }

  // ─── QUESTS ─────────────────────────────────────────────────────────────────

  private updateQuestKill(monsterType: string) {
    for (const qp of this.player.quests) {
      if (qp.status !== 'active') continue;
      const quest = QUESTS.find(q => q.id === qp.questId);
      if (!quest) continue;
      for (const obj of quest.objectives) {
        if (obj.type === 'kill' && obj.target === monsterType) {
          qp.progress[obj.target] = (qp.progress[obj.target] || 0) + 1;
        }
      }
      // Check completion
      const complete = quest.objectives.every(obj => (qp.progress[obj.target] || 0) >= obj.quantity);
      if (complete) {
        qp.status = 'complete';
        this.addSysMsg(`Quest complete: "${quest.name}"! Claim your reward!`);
      }
    }
  }

  public acceptQuest(questId: string) {
    const quest = QUESTS.find(q => q.id === questId);
    if (!quest) return;
    if (this.player.level < quest.requiredLevel) {
      this.addSysMsg(`You need level ${quest.requiredLevel} for this quest.`); return;
    }
    if (this.player.quests.find(q => q.questId === questId)) return;
    this.player.quests.push({ questId, status: 'active', progress: {} });
    this.addSysMsg(`Quest accepted: "${quest.name}"`);
  }

  public claimQuest(questId: string) {
    const qp = this.player.quests.find(q => q.questId === questId);
    if (!qp || qp.status !== 'complete') return;
    const quest = QUESTS.find(q => q.id === questId);
    if (!quest) return;
    qp.status = 'claimed';
    this.player.xp += quest.reward.xp;
    this.player.gold += quest.reward.gold;
    if (quest.reward.items) {
      for (const itemId of quest.reward.items) {
        const item = ITEMS[itemId];
        if (item) this.addToInventory(item);
      }
    }
    this.addSysMsg(`Claimed "${quest.name}" — +${quest.reward.xp} XP, +${quest.reward.gold} gold!`);
  }

  // ─── INVENTORY ───────────────────────────────────────────────────────────────

  private addToInventory(item: Item) {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      if (!this.player.inventory[i]) { this.player.inventory[i] = item; return; }
    }
    this.addSysMsg('Inventory full! Item lost.');
  }

  public useItem(slot: number) {
    const item = this.player.inventory[slot];
    if (!item) return;
    if (item.type === 'consumable' && item.consumeEffect) {
      if (item.consumeEffect.hp) {
        this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + item.consumeEffect.hp);
      }
      if (item.consumeEffect.mp) {
        this.player.stats.mp = Math.min(this.player.stats.maxMp, this.player.stats.mp + item.consumeEffect.mp);
      }
      this.player.inventory[slot] = null;
      this.addSysMsg(`Used ${item.icon} ${item.name}`);
    } else if (item.type === 'weapon' || item.type === 'armor') {
      this.equipItem(slot);
    }
  }

  public equipItem(slot: number) {
    const item = this.player.inventory[slot];
    if (!item || !item.slot) return;
    if (item.requiredLevel && this.player.level < item.requiredLevel) {
      this.addSysMsg(`Need level ${item.requiredLevel} to equip this.`); return;
    }
    const oldEquip = this.player.equipment[item.slot as keyof typeof this.player.equipment];
    this.player.equipment[item.slot as keyof typeof this.player.equipment] = item as any;
    this.player.inventory[slot] = oldEquip || null;
    this.recalcStats();
    this.addSysMsg(`Equipped ${item.icon} ${item.name}`);
  }

  public unequipItem(slot: string) {
    const item = this.player.equipment[slot as keyof typeof this.player.equipment];
    if (!item) return;
    const emptySlot = this.player.inventory.findIndex(i => !i);
    if (emptySlot === -1) { this.addSysMsg('Inventory full!'); return; }
    this.player.inventory[emptySlot] = item;
    delete this.player.equipment[slot as keyof typeof this.player.equipment];
    this.recalcStats();
  }

  private recalcStats() {
    const cls = this.player.class;
    const base = CLASS_STATS[cls];
    const lvlBonus = (this.player.level - 1);
    const gains = cls === 'warrior'
      ? { hp: 20, mp: 5, atk: 3, def: 4, spd: 0.1, matk: 0 }
      : cls === 'mage'
        ? { hp: 8, mp: 20, atk: 1, def: 1, spd: 0.2, matk: 5 }
        : { hp: 12, mp: 10, atk: 4, def: 2, spd: 0.3, matk: 1 };

    let totalAtk = base.atk + gains.atk * lvlBonus;
    let totalDef = base.def + gains.def * lvlBonus;
    let totalMatk = base.matk + gains.matk * lvlBonus;
    let totalSpd = base.spd + gains.spd * lvlBonus;
    let totalHp = base.hp + gains.hp * lvlBonus;
    let totalMp = base.mp + gains.mp * lvlBonus;

    for (const item of Object.values(this.player.equipment)) {
      if (!item?.stats) continue;
      if (item.stats.atk) totalAtk += item.stats.atk;
      if (item.stats.def) totalDef += item.stats.def;
      if (item.stats.matk) totalMatk += item.stats.matk;
      if (item.stats.spd) totalSpd += item.stats.spd;
      if (item.stats.maxHp) totalHp += item.stats.maxHp;
      if (item.stats.maxMp) totalMp += item.stats.maxMp;
    }

    const oldHp = this.player.stats.hp;
    const oldMaxHp = this.player.stats.maxHp;
    this.player.stats.atk = Math.round(totalAtk);
    this.player.stats.def = Math.round(totalDef);
    this.player.stats.matk = Math.round(totalMatk);
    this.player.stats.spd = Math.round(totalSpd * 10) / 10;
    this.player.stats.maxHp = Math.round(totalHp);
    this.player.stats.maxMp = Math.round(totalMp);
    this.player.stats.hp = Math.round((oldHp / oldMaxHp) * this.player.stats.maxHp);
  }

  // ─── SHOP ───────────────────────────────────────────────────────────────────

  public buyItem(itemId: string) {
    const item = ITEMS[itemId];
    if (!item) return;
    if (this.player.gold < item.value) { this.addSysMsg('Not enough gold!'); return; }
    this.player.gold -= item.value;
    this.addToInventory(item);
    this.addSysMsg(`Bought ${item.icon} ${item.name} for ${item.value}g`);
  }

  public sellItem(slot: number) {
    const item = this.player.inventory[slot];
    if (!item) return;
    const sellPrice = Math.floor(item.value * 0.4);
    this.player.gold += sellPrice;
    this.player.inventory[slot] = null;
    this.addSysMsg(`Sold ${item.name} for ${sellPrice}g`);
  }

  // ─── HEALER ─────────────────────────────────────────────────────────────────

  public healPlayer() {
    const cost = Math.floor(this.player.stats.maxHp * 0.1);
    if (this.player.gold < cost) { this.addSysMsg(`Healing costs ${cost}g — not enough gold!`); return; }
    this.player.gold -= cost;
    this.player.stats.hp = this.player.stats.maxHp;
    this.player.stats.mp = this.player.stats.maxMp;
    this.addSysMsg('Fully healed! May your journey be safe.');
  }

  // ─── CHAT ────────────────────────────────────────────────────────────────────

  public sendChat(message: string) {
    const msg: ChatMessage = {
      id: uid('c'), playerName: this.player.name, message,
      channel: 'global', timestamp: Date.now(),
    };
    this.chat.push(msg);
    if (this.chat.length > 100) this.chat.shift();
    this.postChatToServer(msg);
  }

  private addSysMsg(message: string) {
    this.chat.push({ id: uid('c'), playerName: 'System', message, channel: 'system', timestamp: Date.now() });
    if (this.chat.length > 100) this.chat.shift();
  }

  // ─── REMOTE PLAYERS ──────────────────────────────────────────────────────────

  private async fetchOtherPlayers() {
    try {
      const res = await fetch(`/api/worldplayers?pid=${this.player.id}`);
      if (res.ok) {
        const data = await res.json();
        this.otherPlayers = data.players || [];
        const msgs = data.recentChat || [];
        for (const m of msgs) {
          if (!this.chat.find(c => c.id === m.id)) this.chat.push(m);
        }
        if (this.chat.length > 100) this.chat.splice(0, this.chat.length - 100);
      }
    } catch (_) {}
  }

  private async savePlayerToServer() {
    try {
      await fetch('/api/character', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x: this.player.x, y: this.player.y,
          level: this.player.level, xp: this.player.xp,
          gold: this.player.gold,
          stats: this.player.stats,
          inventory: this.player.inventory,
          equipment: this.player.equipment,
          quests: this.player.quests,
        }),
      });
    } catch (_) {}
  }

  private async postChatToServer(msg: ChatMessage) {
    try {
      await fetch('/api/gamechat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      });
    } catch (_) {}
  }

  // ─── DAMAGE NUMBERS ──────────────────────────────────────────────────────────

  private addDmgNum(x: number, y: number, value: number, isCrit: boolean, color: string) {
    this.damageNumbers.push({
      id: uid('d'), value, x, y, color, isCrit,
      startTime: performance.now(),
    });
  }

  private updateDamageNumbers(time: number) {
    this.damageNumbers = this.damageNumbers.filter(d => time - d.startTime < 1500);
  }

  // ─── CAMERA ─────────────────────────────────────────────────────────────────

  private getCamera() {
    const camX = (this.player.x + 0.5) * TILE_SIZE - this.canvas.width / 2;
    const camY = (this.player.y + 0.5) * TILE_SIZE - this.canvas.height / 2;
    return { camX, camY };
  }

  // ─── RENDERING ───────────────────────────────────────────────────────────────

  private render(time: number) {
    const { camX, camY } = this.getCamera();
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // Visible tile range
    const startX = Math.max(0, Math.floor(camX / TILE_SIZE));
    const startY = Math.max(0, Math.floor(camY / TILE_SIZE));
    const endX = Math.min(WORLD_WIDTH, Math.ceil((camX + W) / TILE_SIZE) + 1);
    const endY = Math.min(WORLD_HEIGHT, Math.ceil((camY + H) / TILE_SIZE) + 1);

    // Draw tiles
    for (let ty = startY; ty < endY; ty++) {
      for (let tx = startX; tx < endX; tx++) {
        const tile = this.world[ty][tx];
        const sx = tx * TILE_SIZE - camX;
        const sy = ty * TILE_SIZE - camY;

        ctx.fillStyle = TILE_COLORS[tile.type];
        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

        // Accent pattern
        const accent = TILE_ACCENT_COLORS[tile.type];
        if (tile.type === 'grass' && (tx + ty) % 3 === 0) {
          ctx.fillStyle = accent;
          ctx.fillRect(sx + 8, sy + 8, 6, 6);
        } else if (tile.type === 'water') {
          const wave = Math.sin(time * 0.001 + tx * 0.5 + ty * 0.3) * 3;
          ctx.fillStyle = accent;
          ctx.fillRect(sx, sy + 15 + wave, TILE_SIZE, 4);
        } else if (tile.type === 'tree') {
          ctx.fillStyle = '#0d2b0d';
          ctx.beginPath();
          ctx.arc(sx + 20, sy + 18, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(sx + 20, sy + 16, 12, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile.type === 'mountain') {
          ctx.fillStyle = '#3d4a55';
          ctx.beginPath();
          ctx.moveTo(sx + 20, sy + 4); ctx.lineTo(sx + 36, sy + 36); ctx.lineTo(sx + 4, sy + 36);
          ctx.closePath(); ctx.fill();
        } else if (tile.type === 'town') {
          ctx.fillStyle = accent;
          ctx.fillRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        } else if (tile.type === 'road') {
          ctx.fillStyle = accent;
          ctx.fillRect(sx, sy + 16, TILE_SIZE, 8);
        } else if (tile.type === 'dungeon') {
          if ((tx + ty) % 4 === 0) {
            ctx.fillStyle = '#1a0a2e';
            ctx.fillRect(sx + 2, sy + 2, 10, 10);
          }
        } else if (tile.type === 'lava') {
          const lavaFlicker = Math.sin(time * 0.003 + tx * 2 + ty) * 0.3 + 0.7;
          ctx.fillStyle = `rgba(255, 100, 0, ${lavaFlicker * 0.4})`;
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        } else if (tile.type === 'swamp') {
          if ((tx * ty) % 5 === 0) {
            ctx.fillStyle = '#1a3a1a';
            ctx.beginPath();
            ctx.ellipse(sx + 20, sy + 20, 10, 6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Draw NPCs
    for (const npc of this.npcs) {
      const sx = (npc.x + 0.5) * TILE_SIZE - camX;
      const sy = (npc.y + 0.5) * TILE_SIZE - camY;
      if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;
      this.drawNPC(ctx, npc, sx, sy, time);
    }

    // Draw monsters
    for (const m of this.monsters) {
      if (m.dead) continue;
      const sx = (m.x + 0.5) * TILE_SIZE - camX;
      const sy = (m.y + 0.5) * TILE_SIZE - camY;
      if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
      this.drawMonster(ctx, m, sx, sy, time);
    }

    // Draw other players
    for (const op of this.otherPlayers) {
      const sx = (op.x + 0.5) * TILE_SIZE - camX;
      const sy = (op.y + 0.5) * TILE_SIZE - camY;
      if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
      this.drawRemotePlayer(ctx, op, sx, sy);
    }

    // Draw player
    if (!this.player.dead) {
      const sx = (this.player.x + 0.5) * TILE_SIZE - camX;
      const sy = (this.player.y + 0.5) * TILE_SIZE - camY;
      this.drawPlayer(ctx, sx, sy, time);
    } else {
      // Death screen overlay
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('YOU DIED', W / 2, H / 2 - 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px monospace';
      const secs = Math.max(0, Math.ceil((this.player.respawnTimer - Date.now()) / 1000));
      ctx.fillText(`Respawning in ${secs}s...`, W / 2, H / 2 + 20);
      ctx.textAlign = 'left';
    }

    // Draw damage numbers
    const now = performance.now();
    for (const dn of this.damageNumbers) {
      const age = now - dn.startTime;
      const alpha = 1 - age / 1500;
      const sx = (dn.x + 0.5) * TILE_SIZE - camX;
      const sy = (dn.y + 0.5) * TILE_SIZE - camY - age * 0.03;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${dn.isCrit ? 22 : 16}px monospace`;
      ctx.fillStyle = dn.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      const label = dn.isCrit ? `CRIT ${dn.value}!` : `${dn.value}`;
      ctx.strokeText(label, sx, sy);
      ctx.fillText(label, sx, sy);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, sx: number, sy: number, time: number) {
    const color = CLASS_COLORS[this.player.class] || '#ffffff';
    const bob = this.player.moving ? Math.sin(this.player.animTick) * 3 : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 18, 12, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(sx, sy - 2 + bob, 14, 0, Math.PI * 2); ctx.fill();

    // Inner detail
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(sx - 4, sy - 6 + bob, 5, 0, Math.PI * 2); ctx.fill();

    // Eyes (direction)
    ctx.fillStyle = '#fff';
    const dir = this.player.direction;
    const ex = dir === 'left' ? -5 : dir === 'right' ? 5 : 0;
    const ey = dir === 'up' ? -5 : dir === 'down' ? 5 : 0;
    ctx.beginPath(); ctx.arc(sx + ex + 4, sy + ey - 2 + bob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(sx + ex + 5, sy + ey - 2 + bob, 1.5, 0, Math.PI * 2); ctx.fill();

    // Name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.player.name, sx, sy - 22 + bob);

    // HP bar
    const barW = 40;
    ctx.fillStyle = '#333';
    ctx.fillRect(sx - barW / 2, sy - 34 + bob, barW, 5);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(sx - barW / 2, sy - 34 + bob, barW * (this.player.stats.hp / this.player.stats.maxHp), 5);

    ctx.textAlign = 'left';
  }

  private drawMonster(ctx: CanvasRenderingContext2D, m: Monster, sx: number, sy: number, time: number) {
    const isTargeted = m.id === this.player.targetId;
    const bob = Math.sin(m.animTick) * 2;
    const size = m.type === 'dragon' ? 22 : m.type === 'demon' ? 18 : 13;

    // Target ring
    if (isTargeted) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy + bob, size + 4, 0, Math.PI * 2); ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy + size + 2, size * 0.7, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    if (m.type === 'dragon') {
      // Dragon shape
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.moveTo(sx, sy - size + bob);
      ctx.lineTo(sx + size, sy + size + bob);
      ctx.lineTo(sx - size, sy + size + bob);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff6600';
      ctx.beginPath(); ctx.arc(sx, sy + bob, size * 0.5, 0, Math.PI * 2); ctx.fill();
    } else if (m.type === 'slime') {
      ctx.fillStyle = m.color;
      ctx.beginPath(); ctx.ellipse(sx, sy + 4 + bob, size, size * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.ellipse(sx - 4, sy - 2 + bob, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = m.color;
      ctx.beginPath(); ctx.arc(sx, sy + bob, size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(sx + 3, sy + 3 + bob, size * 0.6, 0, Math.PI * 2); ctx.fill();
    }

    // Eyes
    ctx.fillStyle = '#ff0000';
    ctx.beginPath(); ctx.arc(sx - 4, sy - 3 + bob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 4, sy - 3 + bob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(sx - 3.5, sy - 3 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 4.5, sy - 3 + bob, 1.5, 0, Math.PI * 2); ctx.fill();

    // Name
    ctx.fillStyle = '#ffaaaa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${m.name} Lv${m.level}`, sx, sy - size - 12 + bob);

    // HP bar
    const barW = 36;
    ctx.fillStyle = '#440000';
    ctx.fillRect(sx - barW / 2, sy - size - 10 + bob, barW, 4);
    ctx.fillStyle = '#cc2222';
    ctx.fillRect(sx - barW / 2, sy - size - 10 + bob, barW * (m.stats.hp / m.stats.maxHp), 4);

    ctx.textAlign = 'left';
  }

  private drawNPC(ctx: CanvasRenderingContext2D, npc: NPC, sx: number, sy: number, time: number) {
    const bob = Math.sin(time * 0.002 + npc.x) * 2;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 16, 10, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = npc.color;
    ctx.beginPath(); ctx.arc(sx, sy + bob, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(sx - 3, sy - 4 + bob, 6, 0, Math.PI * 2); ctx.fill();

    // Exclamation (quest/shop)
    if (npc.role === 'quest' || npc.role === 'shop') {
      ctx.fillStyle = '#ffdd00';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', sx, sy - 18 + bob);
    } else if (npc.role === 'healer') {
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('+', sx, sy - 18 + bob);
    }

    // Name
    ctx.fillStyle = '#ffdd88';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(npc.name, sx, sy + 28 + bob);
    ctx.textAlign = 'left';
  }

  private drawRemotePlayer(ctx: CanvasRenderingContext2D, op: RemotePlayer, sx: number, sy: number) {
    const color = CLASS_COLORS[op.class] || '#aaaaff';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#aaffaa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(op.name, sx, sy - 18);
    ctx.textAlign = 'left';
  }

  // ─── UI STATE ────────────────────────────────────────────────────────────────

  public buildUIState(nearbyNPC?: NPC): UIState {
    const px = this.player.x;
    const py = this.player.y;
    const nearby = nearbyNPC || this.npcs.find(n => dist(n.x, n.y, px, py) < 2.5) || null;

    return {
      player: { ...this.player },
      monsters: this.monsters.filter(m => !m.dead),
      npcs: this.npcs,
      otherPlayers: this.otherPlayers,
      chat: [...this.chat],
      damageNumbers: [...this.damageNumbers],
      nearbyNPC: nearby,
    };
  }

  public resizeCanvas(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
  }
}
