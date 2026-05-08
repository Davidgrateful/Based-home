import type { InferSelectModel } from 'drizzle-orm';
import {
  boolean, foreignKey, integer, json, pgTable,
  primaryKey, real, text, timestamp, uuid, varchar,
} from 'drizzle-orm/pg-core';

// ─── AUTH (kept from original) ────────────────────────────────────────────────

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

// ─── CHARACTERS ───────────────────────────────────────────────────────────────

export const character = pgTable('Character', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId').notNull().references(() => user.id),
  name: varchar('name', { length: 32 }).notNull().unique(),
  class: varchar('class', { enum: ['warrior', 'mage', 'ranger'] }).notNull(),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  gold: integer('gold').notNull().default(500),
  // Reputation & social
  honor: integer('honor').notNull().default(0),
  infamy: integer('infamy').notNull().default(0),
  totalRaidsLaunched: integer('totalRaidsLaunched').notNull().default(0),
  totalRaidsSucceeded: integer('totalRaidsSucceeded').notNull().default(0),
  totalRaidsDefended: integer('totalRaidsDefended').notNull().default(0),
  totalRaidsLost: integer('totalRaidsLost').notNull().default(0),
  // Position in world
  districtId: uuid('districtId'),
  // Timestamps
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  lastActiveAt: timestamp('lastActiveAt').notNull().defaultNow(),
  // Shield: new players protected for 7 days
  shieldExpiresAt: timestamp('shieldExpiresAt'),
  // Season
  seasonPoints: integer('seasonPoints').notNull().default(0),
});

export type Character = InferSelectModel<typeof character>;

// ─── SKILLS ───────────────────────────────────────────────────────────────────

export const skill = pgTable('Skill', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  characterId: uuid('characterId').notNull().references(() => character.id),
  name: varchar('name', {
    enum: ['mining', 'crafting', 'engineering', 'fishing', 'cooking',
           'architecture', 'combat', 'alchemy', 'trading', 'hacking'],
  }).notNull(),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
});

export type Skill = InferSelectModel<typeof skill>;

// ─── DISTRICTS ────────────────────────────────────────────────────────────────

export const district = pgTable('District', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  name: varchar('name', { length: 64 }).notNull(),
  slug: varchar('slug', { length: 32 }).notNull().unique(),
  lore: text('lore'),
  resourceType: varchar('resourceType', { length: 32 }).notNull(),
  // Coordinates on world map (0-4 x, 0-3 y for a 5x4 grid = 20 districts)
  gridX: integer('gridX').notNull(),
  gridY: integer('gridY').notNull(),
  // Control
  controllingGuildId: uuid('controllingGuildId'),
  taxRate: real('taxRate').notNull().default(0.05), // 5% default
  defenseRating: integer('defenseRating').notNull().default(100),
  // Buffs (JSON: { type, value })
  buff: json('buff'),
  // War state
  warState: varchar('warState', { enum: ['peace', 'contested', 'war'] }).notNull().default('peace'),
  warEndsAt: timestamp('warEndsAt'),
  // Points
  prestigeScore: integer('prestigeScore').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export type District = InferSelectModel<typeof district>;

// ─── GUILDS ───────────────────────────────────────────────────────────────────

export const guild = pgTable('Guild', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  name: varchar('name', { length: 48 }).notNull().unique(),
  tag: varchar('tag', { length: 5 }).notNull().unique(), // [TAG]
  motto: text('motto'),
  leaderId: uuid('leaderId').notNull(),
  memberCount: integer('memberCount').notNull().default(1),
  maxMembers: integer('maxMembers').notNull().default(20),
  gold: integer('gold').notNull().default(0), // guild treasury
  // Controlled districts
  controlledDistricts: integer('controlledDistricts').notNull().default(0),
  // Season
  seasonPoints: integer('seasonPoints').notNull().default(0),
  totalRaidsWon: integer('totalRaidsWon').notNull().default(0),
  // War
  warWins: integer('warWins').notNull().default(0),
  warLosses: integer('warLosses').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  color: varchar('color', { length: 7 }).notNull().default('#4488ff'),
});

export type Guild = InferSelectModel<typeof guild>;

export const guildMember = pgTable('GuildMember', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  guildId: uuid('guildId').notNull().references(() => guild.id),
  characterId: uuid('characterId').notNull().references(() => character.id),
  role: varchar('role', { enum: ['leader', 'officer', 'member'] }).notNull().default('member'),
  contribution: integer('contribution').notNull().default(0),
  joinedAt: timestamp('joinedAt').notNull().defaultNow(),
});

export type GuildMember = InferSelectModel<typeof guildMember>;

// ─── HOMES ────────────────────────────────────────────────────────────────────

export const home = pgTable('Home', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  ownerId: uuid('ownerId').notNull().references(() => character.id).unique(),
  name: varchar('name', { length: 48 }).notNull().default('My Home'),
  districtId: uuid('districtId').references(() => district.id),
  // Grid layout: 10x10 array of room objects
  // Each cell: { type, level, data } | null
  layout: json('layout').notNull().default([]),
  // Stored resources (what raiders can steal)
  resourceGold: integer('resourceGold').notNull().default(0),
  resourceMaterials: integer('resourceMaterials').notNull().default(0),
  resourceComponents: integer('resourceComponents').notNull().default(0),
  // Defense rating (computed from rooms + traps)
  defenseRating: integer('defenseRating').notNull().default(0),
  // Prestige (computed from trophies + size)
  prestigeScore: integer('prestigeScore').notNull().default(0),
  // Size unlocked (Architecture skill)
  unlockedSize: integer('unlockedSize').notNull().default(3), // 3x3 start, up to 10x10
  // Raid metadata
  lastRaidedAt: timestamp('lastRaidedAt'),
  totalTimesRaided: integer('totalTimesRaided').notNull().default(0),
  totalLootLost: integer('totalLootLost').notNull().default(0),
  // Visitors
  totalVisits: integer('totalVisits').notNull().default(0),
  // Onchain (for future Base NFT integration)
  nftTokenId: varchar('nftTokenId', { length: 64 }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type Home = InferSelectModel<typeof home>;

// ─── INVENTORY ────────────────────────────────────────────────────────────────

export const inventoryItem = pgTable('InventoryItem', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  characterId: uuid('characterId').notNull().references(() => character.id),
  itemId: varchar('itemId', { length: 64 }).notNull(), // references static item catalog
  quantity: integer('quantity').notNull().default(1),
  durability: integer('durability').notNull().default(100), // 0-100
  isEquipped: boolean('isEquipped').notNull().default(false),
  slot: varchar('slot', { length: 16 }), // head/chest/weapon/etc
  acquiredAt: timestamp('acquiredAt').notNull().defaultNow(),
});

export type InventoryItem = InferSelectModel<typeof inventoryItem>;

// ─── RAIDS ────────────────────────────────────────────────────────────────────

export const raid = pgTable('Raid', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  attackerId: uuid('attackerId').notNull().references(() => character.id),
  defenderId: uuid('defenderId').notNull().references(() => character.id),
  homeId: uuid('homeId').notNull().references(() => home.id),
  // Status
  status: varchar('status', {
    enum: ['planned', 'in_progress', 'success', 'failed', 'escaped'],
  }).notNull().default('planned'),
  // Results
  goldStolen: integer('goldStolen').notNull().default(0),
  materialsStolen: integer('materialsStolen').notNull().default(0),
  trapsTriggered: integer('trapsTriggered').notNull().default(0),
  guardsDefeated: integer('guardsDefeated').notNull().default(0),
  attackerHpRemaining: integer('attackerHpRemaining').notNull().default(100),
  // The step-by-step replay log
  replayLog: json('replayLog').notNull().default([]),
  // The path taken through the home
  pathTaken: json('pathTaken').notNull().default([]),
  // Reward to attacker
  xpEarned: integer('xpEarned').notNull().default(0),
  honorChange: integer('honorChange').notNull().default(0),
  infamyChange: integer('infamyChange').notNull().default(0),
  // Was this raid made public?
  isPublic: boolean('isPublic').notNull().default(false),
  // Did defender see it?
  defenderSeen: boolean('defenderSeen').notNull().default(false),
  // Calling card left (message from raider)
  callingCard: varchar('callingCard', { length: 128 }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  completedAt: timestamp('completedAt'),
});

export type Raid = InferSelectModel<typeof raid>;

// ─── BOUNTIES ─────────────────────────────────────────────────────────────────

export const bounty = pgTable('Bounty', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  posterId: uuid('posterId').notNull().references(() => character.id),
  targetId: uuid('targetId').notNull().references(() => character.id),
  reward: integer('reward').notNull(),
  reason: varchar('reason', { length: 128 }),
  status: varchar('status', { enum: ['active', 'claimed', 'expired'] }).notNull().default('active'),
  claimedById: uuid('claimedById'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  expiresAt: timestamp('expiresAt').notNull(),
});

export type Bounty = InferSelectModel<typeof bounty>;

// ─── MARKETPLACE ──────────────────────────────────────────────────────────────

export const marketListing = pgTable('MarketListing', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  sellerId: uuid('sellerId').notNull().references(() => character.id),
  districtId: uuid('districtId').references(() => district.id),
  itemId: varchar('itemId', { length: 64 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  pricePerUnit: integer('pricePerUnit').notNull(),
  status: varchar('status', { enum: ['active', 'sold', 'cancelled'] }).notNull().default('active'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  soldAt: timestamp('soldAt'),
});

export type MarketListing = InferSelectModel<typeof marketListing>;

// ─── DISTRICT WARS ────────────────────────────────────────────────────────────

export const districtWar = pgTable('DistrictWar', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  districtId: uuid('districtId').notNull().references(() => district.id),
  attackingGuildId: uuid('attackingGuildId').notNull().references(() => guild.id),
  defendingGuildId: uuid('defendingGuildId'),
  attackerPoints: integer('attackerPoints').notNull().default(0),
  defenderPoints: integer('defenderPoints').notNull().default(0),
  status: varchar('status', { enum: ['active', 'attacker_won', 'defender_won'] }).notNull().default('active'),
  startedAt: timestamp('startedAt').notNull().defaultNow(),
  endsAt: timestamp('endsAt').notNull(),
  winnerId: uuid('winnerId'),
});

export type DistrictWar = InferSelectModel<typeof districtWar>;

// ─── CHAT ─────────────────────────────────────────────────────────────────────

export const chatMessage = pgTable('ChatMessage', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  characterId: uuid('characterId').notNull().references(() => character.id),
  characterName: varchar('characterName', { length: 32 }).notNull(),
  channel: varchar('channel', {
    enum: ['global', 'district', 'guild', 'system', 'trade'],
  }).notNull().default('global'),
  districtId: uuid('districtId'),
  guildId: uuid('guildId'),
  message: text('message').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export type ChatMessage = InferSelectModel<typeof chatMessage>;

// ─── LEADERBOARD SNAPSHOTS ────────────────────────────────────────────────────

export const leaderboardEntry = pgTable('LeaderboardEntry', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  season: integer('season').notNull().default(1),
  characterId: uuid('characterId').notNull().references(() => character.id),
  characterName: varchar('characterName', { length: 32 }).notNull(),
  guildTag: varchar('guildTag', { length: 5 }),
  category: varchar('category', {
    enum: ['season_points', 'raids_won', 'gold_earned', 'defense_rating', 'skill_total'],
  }).notNull(),
  score: integer('score').notNull().default(0),
  rank: integer('rank'),
  snapshotAt: timestamp('snapshotAt').notNull().defaultNow(),
});

export type LeaderboardEntry = InferSelectModel<typeof leaderboardEntry>;

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export const notification = pgTable('Notification', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  characterId: uuid('characterId').notNull().references(() => character.id),
  type: varchar('type', {
    enum: ['raid_incoming', 'raid_result', 'bounty_posted', 'guild_invite',
           'war_declared', 'district_captured', 'level_up', 'season_end'],
  }).notNull(),
  title: varchar('title', { length: 64 }).notNull(),
  body: text('body').notNull(),
  data: json('data'),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export type Notification = InferSelectModel<typeof notification>;

// ─── TROPHIES (on-chain later) ────────────────────────────────────────────────

export const trophy = pgTable('Trophy', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  characterId: uuid('characterId').notNull().references(() => character.id),
  season: integer('season').notNull(),
  category: varchar('category', { length: 64 }).notNull(),
  rank: integer('rank').notNull(),
  label: varchar('label', { length: 128 }).notNull(),
  rarity: varchar('rarity', { enum: ['bronze', 'silver', 'gold', 'legendary'] }).notNull(),
  // For future on-chain minting
  nftTokenId: varchar('nftTokenId', { length: 64 }),
  mintedAt: timestamp('mintedAt'),
  awardedAt: timestamp('awardedAt').notNull().defaultNow(),
});

export type Trophy = InferSelectModel<typeof trophy>;
