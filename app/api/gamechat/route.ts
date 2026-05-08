import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { chatMessage, character } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get('channel') ?? 'global';
  const limit = Math.min(50, Number(searchParams.get('limit') ?? 50));

  const messages = await db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.channel, channel as any))
    .orderBy(desc(chatMessage.createdAt))
    .limit(limit);

  return NextResponse.json({ messages: messages.reverse() });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [char] = await db.select().from(character).where(eq(character.userId, session.user.id)).limit(1);
  if (!char) return NextResponse.json({ error: 'No character' }, { status: 404 });

  const { message, channel } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  if (message.length > 200) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const [msg] = await db.insert(chatMessage).values({
    characterId: char.id,
    characterName: char.name,
    channel: channel ?? 'global',
    message: message.trim(),
  }).returning();

  return NextResponse.json({ message: msg });
}
