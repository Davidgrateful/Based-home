import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { raid, home, character, skill, notification } from '@/lib/db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { simulateRaid } from '@/lib/game/raidEngine';
import type { RoomCell } from '@/lib/game/homeRooms';

// GET: list available raid targets
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [char] = await db.select().from(character).where(eq(character.userId, session.user.id)).limit(1);
  if (!char) return NextResponse.json({ error: 'No character' }, { status: 404 });

  // Find homes of other players (not self, not shielded)
  const now = new Date();
  const targets = await db
    .select({
      homeId: home.id,
      homeName: home.name,
      defenseRating: home.defenseRating,
      prestigeScore: home.prestigeScore,
      resourceGold: home.resourceGold,
      lastRaidedAt: home.lastRaidedAt,
      totalTimesRaided: home.totalTimesRaided,
      ownerName: character.name,
      ownerLevel: character.level,
      ownerClass: character.class,
      ownerHonor: character.honor,
      ownerInfamy: character.infamy,
      shieldExpiresAt: character.shieldExpiresAt,
    })
    .from(home)
    .innerJoin(character, eq(home.ownerId, character.id))
    .where(and(
      ne(character.userId, session.user.id),
      sql`${character.shieldExpiresAt} IS NULL OR ${character.shieldExpiresAt} < ${now}`,
    ))
    .limit(20);

  return NextResponse.json({ targets });
}

// POST: execute a raid
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [attacker] = await db.select().from(character).where(eq(character.userId, session.user.id)).limit(1);
  if (!attacker) return NextResponse.json({ error: 'No character' }, { status: 404 });

  const { homeId, callingCard } = await req.json();
  if (!homeId) return NextResponse.json({ error: 'No target' }, { status: 400 });

  // Check daily raid limit (5 per day)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayRaids = await db
    .select({ count: sql<number>`count(*)` })
    .from(raid)
    .where(and(eq(raid.attackerId, attacker.id), sql`${raid.createdAt} >= ${todayStart}`));

  if ((todayRaids[0]?.count ?? 0) >= 5) {
    return NextResponse.json({ error: 'Daily raid limit reached (5/day)' }, { status: 429 });
  }

  // Get target home
  const [targetHome] = await db.select().from(home).where(eq(home.id, homeId)).limit(1);
  if (!targetHome) return NextResponse.json({ error: 'Home not found' }, { status: 404 });

  const [defender] = await db.select().from(character).where(eq(character.id, targetHome.ownerId)).limit(1);
  if (!defender) return NextResponse.json({ error: 'Defender not found' }, { status: 404 });

  // Shield check
  if (defender.shieldExpiresAt && defender.shieldExpiresAt > new Date()) {
    return NextResponse.json({ error: 'Target is shielded' }, { status: 403 });
  }

  // Get attacker skills
  const skills = await db.select().from(skill).where(eq(skill.characterId, attacker.id));
  const hackSkill = skills.find(s => s.name === 'hacking')?.level ?? 1;
  const combatSkill = skills.find(s => s.name === 'combat')?.level ?? 1;

  // Class modifiers
  const classTimeBonus = attacker.class === 'ranger' ? 60 : 0;
  const classCarryBonus = attacker.class === 'ranger' ? 1.5 : 1;
  const baseHp = attacker.class === 'warrior' ? 200 : attacker.class === 'mage' ? 90 : 140;
  const levelHp = attacker.level * (attacker.class === 'warrior' ? 20 : attacker.class === 'mage' ? 8 : 12);

  const raiderStats = {
    hp: baseHp + levelHp,
    maxHp: baseHp + levelHp,
    atk: 15 + attacker.level * 3,
    def: 10 + attacker.level * 2,
    hackLevel: hackSkill,
    combatLevel: combatSkill,
    carryCapacity: Math.floor(500 * classCarryBonus),
    timeLimit: 120 + classTimeBonus + attacker.level * 2,
  };

  // Run simulation
  const layout = targetHome.layout as RoomCell[][];
  const result = simulateRaid(layout, targetHome.resourceGold, targetHome.resourceMaterials, raiderStats);

  // Apply results to DB
  const now = new Date();

  // Record raid
  const [raidRecord] = await db.insert(raid).values({
    attackerId: attacker.id,
    defenderId: defender.id,
    homeId: targetHome.id,
    status: result.status,
    goldStolen: result.goldStolen,
    materialsStolen: result.materialsStolen,
    trapsTriggered: result.trapsTriggered,
    guardsDefeated: result.guardsDefeated,
    attackerHpRemaining: result.attackerHpRemaining,
    replayLog: result.log as any,
    pathTaken: result.pathTaken as any,
    xpEarned: result.xpEarned,
    honorChange: result.status === 'success' ? 5 : -2,
    callingCard: callingCard ?? null,
    completedAt: now,
  }).returning();

  // Update attacker stats
  await db.update(character).set({
    xp: attacker.xp + result.xpEarned,
    gold: attacker.gold + result.goldStolen,
    totalRaidsLaunched: attacker.totalRaidsLaunched + 1,
    totalRaidsSucceeded: result.status === 'success' ? attacker.totalRaidsSucceeded + 1 : attacker.totalRaidsSucceeded,
    honor: result.status === 'success' ? attacker.honor + 5 : Math.max(0, attacker.honor - 2),
    seasonPoints: attacker.seasonPoints + Math.floor(result.xpEarned * 0.1),
    lastActiveAt: now,
  }).where(eq(character.id, attacker.id));

  // Update defender home
  if (result.goldStolen > 0 || result.materialsStolen > 0) {
    await db.update(home).set({
      resourceGold: Math.max(0, targetHome.resourceGold - result.goldStolen),
      resourceMaterials: Math.max(0, targetHome.resourceMaterials - result.materialsStolen),
      totalTimesRaided: targetHome.totalTimesRaided + 1,
      totalLootLost: targetHome.totalLootLost + result.goldStolen,
      lastRaidedAt: now,
    }).where(eq(home.id, targetHome.id));
  } else {
    await db.update(home).set({
      totalTimesRaided: targetHome.totalTimesRaided + 1,
      lastRaidedAt: now,
    }).where(eq(home.id, targetHome.id));
  }

  // Update defender stats
  await db.update(character).set({
    totalRaidsLost: result.status === 'success' ? defender.totalRaidsLost + 1 : defender.totalRaidsLost,
    totalRaidsDefended: result.status === 'failed' ? defender.totalRaidsDefended + 1 : defender.totalRaidsDefended,
    // Grant shield after successful raid
    shieldExpiresAt: result.status === 'success' ? new Date(Date.now() + 8 * 60 * 60 * 1000) : defender.shieldExpiresAt,
  }).where(eq(character.id, defender.id));

  // Notify defender
  await db.insert(notification).values({
    characterId: defender.id,
    type: 'raid_result',
    title: result.status === 'success' ? `Your home was raided by ${attacker.name}!` : `${attacker.name} tried to raid you — and failed!`,
    body: `${result.goldStolen}g stolen. ${result.guardsDefeated} guards defeated. ${result.trapsTriggered} traps triggered.`,
    data: { raidId: raidRecord.id } as any,
  });

  return NextResponse.json({ result, raidId: raidRecord.id });
}
