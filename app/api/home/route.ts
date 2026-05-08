import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { home, character } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { calcDefenseRating, calcPrestige } from '@/lib/game/homeRooms';
import type { RoomCell } from '@/lib/game/homeRooms';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get('ownerId');

  let charId: string;
  if (ownerId) {
    charId = ownerId;
  } else {
    const [char] = await db.select().from(character).where(eq(character.userId, session.user.id)).limit(1);
    if (!char) return NextResponse.json({ error: 'No character' }, { status: 404 });
    charId = char.id;
  }

  const [playerHome] = await db.select().from(home).where(eq(home.ownerId, charId)).limit(1);
  if (!playerHome) return NextResponse.json({ home: null });

  // Track visits if viewing someone else's home
  if (ownerId && ownerId !== charId) {
    await db.update(home).set({ totalVisits: playerHome.totalVisits + 1 }).where(eq(home.id, playerHome.id));
  }

  return NextResponse.json({ home: playerHome });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [char] = await db.select().from(character).where(eq(character.userId, session.user.id)).limit(1);
  if (!char) return NextResponse.json({ error: 'No character' }, { status: 404 });

  const body = await req.json();
  const { layout, name } = body;

  if (!layout) return NextResponse.json({ error: 'No layout' }, { status: 400 });

  const grid = layout as RoomCell[][];
  const defenseRating = calcDefenseRating(grid);
  const prestigeScore = calcPrestige(grid);

  const [playerHome] = await db.select().from(home).where(eq(home.ownerId, char.id)).limit(1);
  if (!playerHome) return NextResponse.json({ error: 'No home' }, { status: 404 });

  await db.update(home).set({
    layout: layout as any,
    name: name ?? playerHome.name,
    defenseRating,
    prestigeScore,
    updatedAt: new Date(),
  }).where(eq(home.id, playerHome.id));

  return NextResponse.json({ ok: true, defenseRating, prestigeScore });
}
