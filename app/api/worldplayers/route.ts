import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { character, chatMessage } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Active players (last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const players = await db
    .select({
      id: character.id,
      name: character.name,
      class: character.class,
      level: character.level,
      honor: character.honor,
      infamy: character.infamy,
      lastActiveAt: character.lastActiveAt,
    })
    .from(character)
    .where(sql`${character.lastActiveAt} >= ${fiveMinutesAgo}`)
    .limit(50);

  // Recent global chat (last 5 minutes)
  const recentChat = await db
    .select()
    .from(chatMessage)
    .where(sql`${chatMessage.createdAt} >= ${fiveMinutesAgo} AND ${chatMessage.channel} = 'global'`)
    .orderBy(desc(chatMessage.createdAt))
    .limit(20);

  return NextResponse.json({ players, recentChat: recentChat.reverse() });
}
