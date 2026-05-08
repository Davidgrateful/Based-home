-- Base Home: District Wars — game tables migration

-- Characters
CREATE TABLE IF NOT EXISTS "Character" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "name" varchar(32) NOT NULL UNIQUE,
  "class" varchar NOT NULL,
  "level" integer NOT NULL DEFAULT 1,
  "xp" integer NOT NULL DEFAULT 0,
  "gold" integer NOT NULL DEFAULT 500,
  "honor" integer NOT NULL DEFAULT 0,
  "infamy" integer NOT NULL DEFAULT 0,
  "totalRaidsLaunched" integer NOT NULL DEFAULT 0,
  "totalRaidsSucceeded" integer NOT NULL DEFAULT 0,
  "totalRaidsDefended" integer NOT NULL DEFAULT 0,
  "totalRaidsLost" integer NOT NULL DEFAULT 0,
  "districtId" uuid,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "lastActiveAt" timestamp NOT NULL DEFAULT now(),
  "shieldExpiresAt" timestamp,
  "seasonPoints" integer NOT NULL DEFAULT 0
);

-- Skills
CREATE TABLE IF NOT EXISTS "Skill" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "characterId" uuid NOT NULL REFERENCES "Character"("id"),
  "name" varchar NOT NULL,
  "level" integer NOT NULL DEFAULT 1,
  "xp" integer NOT NULL DEFAULT 0
);

-- Districts
CREATE TABLE IF NOT EXISTS "District" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(64) NOT NULL,
  "slug" varchar(32) NOT NULL UNIQUE,
  "lore" text,
  "resourceType" varchar(32) NOT NULL,
  "gridX" integer NOT NULL,
  "gridY" integer NOT NULL,
  "controllingGuildId" uuid,
  "taxRate" real NOT NULL DEFAULT 0.05,
  "defenseRating" integer NOT NULL DEFAULT 100,
  "buff" json,
  "warState" varchar NOT NULL DEFAULT 'peace',
  "warEndsAt" timestamp,
  "prestigeScore" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

-- Guilds
CREATE TABLE IF NOT EXISTS "Guild" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(48) NOT NULL UNIQUE,
  "tag" varchar(5) NOT NULL UNIQUE,
  "motto" text,
  "leaderId" uuid NOT NULL,
  "memberCount" integer NOT NULL DEFAULT 1,
  "maxMembers" integer NOT NULL DEFAULT 20,
  "gold" integer NOT NULL DEFAULT 0,
  "controlledDistricts" integer NOT NULL DEFAULT 0,
  "seasonPoints" integer NOT NULL DEFAULT 0,
  "totalRaidsWon" integer NOT NULL DEFAULT 0,
  "warWins" integer NOT NULL DEFAULT 0,
  "warLosses" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "color" varchar(7) NOT NULL DEFAULT '#4488ff'
);

-- Guild Members
CREATE TABLE IF NOT EXISTS "GuildMember" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "guildId" uuid NOT NULL REFERENCES "Guild"("id"),
  "characterId" uuid NOT NULL REFERENCES "Character"("id"),
  "role" varchar NOT NULL DEFAULT 'member',
  "contribution" integer NOT NULL DEFAULT 0,
  "joinedAt" timestamp NOT NULL DEFAULT now()
);

-- Homes
CREATE TABLE IF NOT EXISTS "Home" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ownerId" uuid NOT NULL UNIQUE REFERENCES "Character"("id"),
  "name" varchar(48) NOT NULL DEFAULT 'My Home',
  "districtId" uuid REFERENCES "District"("id"),
  "layout" json NOT NULL DEFAULT '[]',
  "resourceGold" integer NOT NULL DEFAULT 0,
  "resourceMaterials" integer NOT NULL DEFAULT 0,
  "resourceComponents" integer NOT NULL DEFAULT 0,
  "defenseRating" integer NOT NULL DEFAULT 0,
  "prestigeScore" integer NOT NULL DEFAULT 0,
  "unlockedSize" integer NOT NULL DEFAULT 3,
  "lastRaidedAt" timestamp,
  "totalTimesRaided" integer NOT NULL DEFAULT 0,
  "totalLootLost" integer NOT NULL DEFAULT 0,
  "totalVisits" integer NOT NULL DEFAULT 0,
  "nftTokenId" varchar(64),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS "InventoryItem" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "characterId" uuid NOT NULL REFERENCES "Character"("id"),
  "itemId" varchar(64) NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "durability" integer NOT NULL DEFAULT 100,
  "isEquipped" boolean NOT NULL DEFAULT false,
  "slot" varchar(16),
  "acquiredAt" timestamp NOT NULL DEFAULT now()
);

-- Raids
CREATE TABLE IF NOT EXISTS "Raid" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attackerId" uuid NOT NULL REFERENCES "Character"("id"),
  "defenderId" uuid NOT NULL REFERENCES "Character"("id"),
  "homeId" uuid NOT NULL REFERENCES "Home"("id"),
  "status" varchar NOT NULL DEFAULT 'planned',
  "goldStolen" integer NOT NULL DEFAULT 0,
  "materialsStolen" integer NOT NULL DEFAULT 0,
  "trapsTriggered" integer NOT NULL DEFAULT 0,
  "guardsDefeated" integer NOT NULL DEFAULT 0,
  "attackerHpRemaining" integer NOT NULL DEFAULT 100,
  "replayLog" json NOT NULL DEFAULT '[]',
  "pathTaken" json NOT NULL DEFAULT '[]',
  "xpEarned" integer NOT NULL DEFAULT 0,
  "honorChange" integer NOT NULL DEFAULT 0,
  "infamyChange" integer NOT NULL DEFAULT 0,
  "isPublic" boolean NOT NULL DEFAULT false,
  "defenderSeen" boolean NOT NULL DEFAULT false,
  "callingCard" varchar(128),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "completedAt" timestamp
);

-- Bounties
CREATE TABLE IF NOT EXISTS "Bounty" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "posterId" uuid NOT NULL REFERENCES "Character"("id"),
  "targetId" uuid NOT NULL REFERENCES "Character"("id"),
  "reward" integer NOT NULL,
  "reason" varchar(128),
  "status" varchar NOT NULL DEFAULT 'active',
  "claimedById" uuid,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "expiresAt" timestamp NOT NULL
);

-- Market Listings
CREATE TABLE IF NOT EXISTS "MarketListing" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sellerId" uuid NOT NULL REFERENCES "Character"("id"),
  "districtId" uuid REFERENCES "District"("id"),
  "itemId" varchar(64) NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "pricePerUnit" integer NOT NULL,
  "status" varchar NOT NULL DEFAULT 'active',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "soldAt" timestamp
);

-- District Wars
CREATE TABLE IF NOT EXISTS "DistrictWar" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "districtId" uuid NOT NULL REFERENCES "District"("id"),
  "attackingGuildId" uuid NOT NULL REFERENCES "Guild"("id"),
  "defendingGuildId" uuid,
  "attackerPoints" integer NOT NULL DEFAULT 0,
  "defenderPoints" integer NOT NULL DEFAULT 0,
  "status" varchar NOT NULL DEFAULT 'active',
  "startedAt" timestamp NOT NULL DEFAULT now(),
  "endsAt" timestamp NOT NULL,
  "winnerId" uuid
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "characterId" uuid NOT NULL REFERENCES "Character"("id"),
  "characterName" varchar(32) NOT NULL,
  "channel" varchar NOT NULL DEFAULT 'global',
  "districtId" uuid,
  "guildId" uuid,
  "message" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

-- Leaderboard Entries
CREATE TABLE IF NOT EXISTS "LeaderboardEntry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "season" integer NOT NULL DEFAULT 1,
  "characterId" uuid NOT NULL REFERENCES "Character"("id"),
  "characterName" varchar(32) NOT NULL,
  "guildTag" varchar(5),
  "category" varchar NOT NULL,
  "score" integer NOT NULL DEFAULT 0,
  "rank" integer,
  "snapshotAt" timestamp NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "characterId" uuid NOT NULL REFERENCES "Character"("id"),
  "type" varchar NOT NULL,
  "title" varchar(64) NOT NULL,
  "body" text NOT NULL,
  "data" json,
  "read" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

-- Trophies
CREATE TABLE IF NOT EXISTS "Trophy" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "characterId" uuid NOT NULL REFERENCES "Character"("id"),
  "season" integer NOT NULL,
  "category" varchar(64) NOT NULL,
  "rank" integer NOT NULL,
  "label" varchar(128) NOT NULL,
  "rarity" varchar NOT NULL,
  "nftTokenId" varchar(64),
  "mintedAt" timestamp,
  "awardedAt" timestamp NOT NULL DEFAULT now()
);

-- Seed the 20 districts
INSERT INTO "District" ("name", "slug", "lore", "resourceType", "gridX", "gridY", "color", "warState") VALUES
  ('Neon Quarter',    'neon-quarter',    'The neon-lit heart of the grid. Entertainment, vice, and power converge here.',           'entertainment', 0, 0, '#ff44cc', 'peace'),
  ('Vault District',  'vault-district',  'Fortress of wealth. The most defended district in the city.',                             'gold',          1, 0, '#ffcc00', 'peace'),
  ('Zero District',   'zero-district',   'Birth of the grid. Ancient servers and forgotten protocols lurk beneath.',                'relics',        2, 0, '#4488ff', 'peace'),
  ('Ghost Alley',     'ghost-alley',     'Where the disappeared go. Black markets and off-grid operatives thrive here.',            'intel',         3, 0, '#888888', 'peace'),
  ('The Spire',       'the-spire',       'Towering headquarters of megacorps. Corporate warfare is fought in boardrooms.',          'influence',     4, 0, '#cc44ff', 'peace'),
  ('Iron Works',      'iron-works',      'Industrial heart of the city. Forges, fabricators, and hard labor.',                     'materials',     0, 1, '#ff8844', 'peace'),
  ('The Colosseum',   'the-colosseum',   'Sanctioned arena combat. Blood sports and glory draws the bold.',                        'glory',         1, 1, '#ff3344', 'peace'),
  ('Circuit Bay',     'circuit-bay',     'Docklands of the digital sea. Smugglers and engineers share the waterfront.',            'components',    2, 1, '#44ccff', 'peace'),
  ('The Gardens',     'the-gardens',     'Rare green space. Food production and alchemical ingredients grown here.',                'food',          3, 1, '#44ff88', 'peace'),
  ('Data Spraw',      'data-spraw',      'Endless low-cost housing. Where most operatives start their grid life.',                 'data',          4, 1, '#6688ff', 'peace'),
  ('Rust Corridor',   'rust-corridor',   'Abandoned industrial zone. Salvagers and raiders use it as a staging ground.',           'salvage',       0, 2, '#cc8844', 'peace'),
  ('Nexus Gate',      'nexus-gate',      'Transit hub. Every route passes through Nexus. Control it, control movement.',           'transit',       1, 2, '#44ffcc', 'peace'),
  ('The Undermarket', 'undermarket',     'Underground bazaar. Anything can be bought or sold, no questions asked.',                 'contraband',    2, 2, '#ff6644', 'peace'),
  ('Helix Labs',      'helix-labs',      'Biotech research district. Experimental enhancements and volatile substances.',          'biotech',       3, 2, '#ccff44', 'peace'),
  ('Crypt Row',       'crypt-row',       'Where the server dead rest. Ancient encrypted vaults line every wall.',                  'encrypted_data',4, 2, '#8844ff', 'peace'),
  ('Nova Flats',      'nova-flats',      'Mid-tier residential. Stable, boring, and increasingly contested.',                     'housing',       0, 3, '#ff44ff', 'peace'),
  ('The Exchange',    'the-exchange',    'Financial district. Commodity trading, currency exchange, and market manipulation.',      'currency',      1, 3, '#ffee44', 'peace'),
  ('Slag Heap',       'slag-heap',       'Wasteland outskirts. Toxic but rich in rare earth materials.',                          'rare_materials',2, 3, '#884422', 'peace'),
  ('Signal Tower',    'signal-tower',    'Communications nexus. Whoever holds it can broadcast to the whole grid.',               'broadcast',     3, 3, '#4488ff', 'peace'),
  ('The Sanctuary',   'the-sanctuary',   'Neutral ground. Raids forbidden. A place for diplomacy and deals.',                     'neutral',       4, 3, '#ffffff', 'peace')
ON CONFLICT (slug) DO NOTHING;
