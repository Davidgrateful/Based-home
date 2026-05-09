import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { character, raid, guild } from '@/lib/db/schema';
import { desc, gt } from 'drizzle-orm';

// Atmospheric filler events seeded by time-of-day to feel alive
const AMBIENT_EVENTS = [
  { icon: '🌲', text: 'A wandering merchant arrived at the Silver Quarter', type: 'world', ago: 3 },
  { icon: '🐺', text: 'Wolves were spotted near the Rust Belt. Travelers beware.', type: 'world', ago: 8 },
  { icon: '🌫️', text: 'Heavy fog rolled across the Deepwater Docks this morning', type: 'world', ago: 15 },
  { icon: '🔥', text: 'A campfire was lit in Neutral Ground — survivors gathering', type: 'social', ago: 22 },
  { icon: '⛏️', text: 'Rare ore seam discovered in the Iron Works district', type: 'world', ago: 34 },
  { icon: '🏹', text: 'A ranger was seen scouting the borders of Zero District', type: 'world', ago: 41 },
  { icon: '🌿', text: 'The Green Belt harvest festival begins at nightfall', type: 'social', ago: 55 },
  { icon: '⚗️', text: 'An alchemist guild in Helix Labs completed a rare experiment', type: 'world', ago: 68 },
  { icon: '🕊️', text: 'Peace negotiations held in the Sanctuary. Outcome unknown.', type: 'political', ago: 82 },
  { icon: '💎', text: 'Crystal shards spotted near Crystal Row — contested resource', type: 'world', ago: 95 },
  { icon: '🌙', text: 'Night patrol reports movement near the Blacksite perimeter', type: 'danger', ago: 112 },
  { icon: '🐟', text: 'The fishing season opens at Deepwater Docks this week', type: 'world', ago: 130 },
  { icon: '🏰', text: 'An abandoned fortress was discovered beyond the grid edges', type: 'world', ago: 145 },
  { icon: '⚡', text: 'A storm is forming over the mountains north of Base', type: 'world', ago: 160 },
  { icon: '🗺️', text: 'Old maps of the pre-collapse world surfaced at the Archives', type: 'lore', ago: 180 },
];

function minutesAgo(n: number): string {
  if (n < 60) return `${n}m ago`;
  const h = Math.floor(n / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export const revalidate = 30;

export async function GET() {
  const events: { icon: string; text: string; type: string; timestamp: string }[] = [];

  try {
    // Real events: recent raids
    const recentRaids = await db
      .select({
        status: raid.status,
        goldStolen: raid.goldStolen,
        callingCard: raid.callingCard,
        createdAt: raid.createdAt,
      })
      .from(raid)
      .where(gt(raid.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .orderBy(desc(raid.createdAt))
      .limit(5);

    for (const r of recentRaids) {
      const minsAgo = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 60000);
      if (r.status === 'success') {
        events.push({ icon: '💀', text: `A home was raided — ${r.goldStolen}g stolen`, type: 'raid', timestamp: minutesAgo(minsAgo) });
      } else if (r.status === 'failed') {
        events.push({ icon: '🛡️', text: 'A raid was repelled — the defender held their ground', type: 'raid', timestamp: minutesAgo(minsAgo) });
      }
    }

    // Real events: new guilds
    const newGuilds = await db
      .select({ name: guild.name, tag: guild.tag, createdAt: guild.createdAt })
      .from(guild)
      .where(gt(guild.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .orderBy(desc(guild.createdAt))
      .limit(3);

    for (const g of newGuilds) {
      const minsAgo = Math.floor((Date.now() - new Date(g.createdAt).getTime()) / 60000);
      events.push({ icon: '🛡️', text: `[${g.tag}] ${g.name} — a new faction rises in Base`, type: 'guild', timestamp: minutesAgo(minsAgo) });
    }

    // Real events: recent high-level characters
    const vets = await db
      .select({ name: character.name, level: character.level, class: character.class, createdAt: character.lastActiveAt })
      .from(character)
      .where(gt(character.level, 5))
      .orderBy(desc(character.lastActiveAt))
      .limit(3);

    for (const c of vets) {
      const minsAgo = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 60000);
      events.push({ icon: '⬆️', text: `${c.name} the ${c.class} reached Level ${c.level}`, type: 'levelup', timestamp: minutesAgo(minsAgo) });
    }
  } catch {
    // DB might not be available — fall through to ambient
  }

  // Fill with ambient events
  for (const a of AMBIENT_EVENTS) {
    events.push({ icon: a.icon, text: a.text, type: a.type, timestamp: minutesAgo(a.ago) });
  }

  // Sort real events to the top, then return
  return NextResponse.json({ events: events.slice(0, 20) });
}
