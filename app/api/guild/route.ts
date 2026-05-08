import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { character, guild, guildMember } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [char] = await db.select().from(character).where(eq(character.userId, session.user.id)).limit(1);
  if (!char) return NextResponse.json({ guild: null });

  const [membership] = await db.select().from(guildMember).where(eq(guildMember.characterId, char.id)).limit(1);
  if (!membership) return NextResponse.json({ guild: null });

  const [g] = await db.select().from(guild).where(eq(guild.id, membership.guildId)).limit(1);
  if (!g) return NextResponse.json({ guild: null });

  const members = await db.select().from(guildMember).where(eq(guildMember.guildId, g.id));

  return NextResponse.json({ guild: g, membership, members });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [char] = await db.select().from(character).where(eq(character.userId, session.user.id)).limit(1);
  if (!char) return NextResponse.json({ error: 'No character' }, { status: 404 });

  // Check already in a guild
  const [existingMembership] = await db.select().from(guildMember).where(eq(guildMember.characterId, char.id)).limit(1);
  if (existingMembership) return NextResponse.json({ error: 'Already in a guild' }, { status: 409 });

  const { name, tag, motto, color } = await req.json();
  if (!name || !tag) return NextResponse.json({ error: 'Name and tag required' }, { status: 400 });
  if (tag.length < 2 || tag.length > 5) return NextResponse.json({ error: 'Tag must be 2–5 characters' }, { status: 400 });

  // Check gold (guild costs 1000g)
  if (char.gold < 1000) return NextResponse.json({ error: 'Need 1,000g to found a guild' }, { status: 400 });

  // Check name/tag uniqueness
  const [existingName] = await db.select().from(guild).where(eq(guild.name, name)).limit(1);
  if (existingName) return NextResponse.json({ error: 'Guild name taken' }, { status: 409 });

  const [existingTag] = await db.select().from(guild).where(eq(guild.tag, tag.toUpperCase())).limit(1);
  if (existingTag) return NextResponse.json({ error: 'Guild tag taken' }, { status: 409 });

  // Deduct gold
  await db.update(character).set({ gold: char.gold - 1000, lastActiveAt: new Date() }).where(eq(character.id, char.id));

  // Create guild
  const [newGuild] = await db.insert(guild).values({
    name,
    tag: tag.toUpperCase(),
    motto: motto || null,
    leaderId: char.id,
    color: color || '#4488ff',
    memberCount: 1,
  }).returning();

  // Add leader as member
  await db.insert(guildMember).values({
    guildId: newGuild.id,
    characterId: char.id,
    role: 'leader',
    contribution: 0,
  });

  return NextResponse.json({ guild: newGuild });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [char] = await db.select().from(character).where(eq(character.userId, session.user.id)).limit(1);
  if (!char) return NextResponse.json({ error: 'No character' }, { status: 404 });

  const [membership] = await db.select().from(guildMember).where(eq(guildMember.characterId, char.id)).limit(1);
  if (!membership) return NextResponse.json({ error: 'Not in a guild' }, { status: 400 });

  // Remove member
  await db.delete(guildMember).where(and(eq(guildMember.characterId, char.id), eq(guildMember.guildId, membership.guildId)));

  // Update member count
  const remaining = await db.select().from(guildMember).where(eq(guildMember.guildId, membership.guildId));
  if (remaining.length === 0) {
    await db.delete(guild).where(eq(guild.id, membership.guildId));
  } else {
    await db.update(guild).set({ memberCount: remaining.length }).where(eq(guild.id, membership.guildId));
  }

  return NextResponse.json({ ok: true });
}
