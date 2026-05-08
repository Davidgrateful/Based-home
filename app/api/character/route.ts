import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { character, skill, home } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { emptyLayout } from '@/lib/game/homeRooms';
import { xpToNextLevel } from '@/lib/game/data';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [char] = await db.select().from(character).where(eq(character.userId, session.user.id)).limit(1);
  if (!char) return NextResponse.json({ character: null });

  const skills = await db.select().from(skill).where(eq(skill.characterId, char.id));
  const [playerHome] = await db.select().from(home).where(eq(home.ownerId, char.id)).limit(1);

  return NextResponse.json({ character: char, skills, home: playerHome ?? null });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, characterClass } = await req.json();
  if (!name || !characterClass) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  // Check name uniqueness
  const [existing] = await db.select().from(character).where(eq(character.name, name)).limit(1);
  if (existing) return NextResponse.json({ error: 'Name taken' }, { status: 409 });

  // Create character
  const shieldDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const [newChar] = await db.insert(character).values({
    userId: session.user.id,
    name,
    class: characterClass as 'warrior' | 'mage' | 'ranger',
    shieldExpiresAt: shieldDate,
  }).returning();

  // Create default skills
  const skillNames = ['mining', 'crafting', 'engineering', 'fishing', 'cooking', 'architecture', 'combat', 'alchemy', 'trading', 'hacking'] as const;
  await db.insert(skill).values(skillNames.map(s => ({ characterId: newChar.id, name: s, level: 1, xp: 0 })));

  // Create home
  const layout = emptyLayout(3); // Start with 3x3 unlocked
  await db.insert(home).values({
    ownerId: newChar.id,
    name: `${name}'s Home`,
    layout: layout as any,
    unlockedSize: 3,
  });

  return NextResponse.json({ character: newChar });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [char] = await db.select().from(character).where(eq(character.userId, session.user.id)).limit(1);
  if (!char) return NextResponse.json({ error: 'No character' }, { status: 404 });

  const body = await req.json();
  const { level, xp, gold, seasonPoints } = body;

  await db.update(character).set({
    level: level ?? char.level,
    xp: xp ?? char.xp,
    gold: gold ?? char.gold,
    seasonPoints: seasonPoints ?? char.seasonPoints,
    lastActiveAt: new Date(),
  }).where(eq(character.id, char.id));

  return NextResponse.json({ ok: true });
}
