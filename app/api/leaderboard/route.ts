import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { character, guild, guildMember } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

export async function GET() {
  const [bySeasonPoints, byRaids, byGold] = await Promise.all([
    db.select({
      name: character.name,
      class: character.class,
      level: character.level,
      seasonPoints: character.seasonPoints,
      honor: character.honor,
      infamy: character.infamy,
      totalRaidsSucceeded: character.totalRaidsSucceeded,
    }).from(character).orderBy(desc(character.seasonPoints)).limit(20),

    db.select({
      name: character.name,
      class: character.class,
      level: character.level,
      totalRaidsSucceeded: character.totalRaidsSucceeded,
      honor: character.honor,
    }).from(character).orderBy(desc(character.totalRaidsSucceeded)).limit(20),

    db.select({
      name: character.name,
      class: character.class,
      level: character.level,
      gold: character.gold,
    }).from(character).orderBy(desc(character.gold)).limit(20),
  ]);

  return NextResponse.json({ bySeasonPoints, byRaids, byGold });
}
