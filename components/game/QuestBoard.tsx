'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CharData {
  level: number;
  totalRaidsLaunched: number;
  totalRaidsSucceeded: number;
  seasonPoints: number;
}
interface HomeData { defenseRating: number; }
interface GuildData { id: string; }

interface Quest {
  id: string;
  act: string;
  actNum: number;
  title: string;
  lore: string;
  objective: string;
  reward: string;
  rewardIcon: string;
  isComplete: (c: CharData, h: HomeData | null, g: GuildData | null) => boolean;
  isUnlocked: (c: CharData, h: HomeData | null, g: GuildData | null, prev: Quest[]) => boolean;
  link?: string;
}

const MAIN_QUESTS: Quest[] = [
  {
    id: 'claim_ground',
    act: 'Act I — Claim Your Ground',
    actNum: 1,
    title: 'The First Stone',
    lore: 'Every great settlement begins with a single wall. Build your first room and declare your claim upon this broken world.',
    objective: 'Build at least one room in your settlement',
    reward: '+200 Gold, +50 XP',
    rewardIcon: '💰',
    isComplete: (_, h) => (h?.defenseRating ?? 0) > 0,
    isUnlocked: () => true,
    link: '/game/home',
  },
  {
    id: 'first_blood',
    act: 'Act II — Prove Your Strength',
    actNum: 2,
    title: 'Blood on the Soil',
    lore: 'The world does not yield to builders alone. Show that you can take what you need — or defend what you have.',
    objective: 'Complete your first raid',
    reward: '+300 Gold, +100 XP, +5 Honor',
    rewardIcon: '⚔️',
    isComplete: (c) => c.totalRaidsLaunched > 0,
    isUnlocked: (_, h, __, prev) => prev.find(q => q.id === 'claim_ground')?.isComplete(_, h, __) ?? false,
    link: '/game/raid',
  },
  {
    id: 'find_people',
    act: 'Act III — Find Your People',
    actNum: 3,
    title: 'None Survive Alone',
    lore: 'The great factions of Base were not built by lone wolves. Seek out allies — or forge your own banner and call others to your cause.',
    objective: 'Join or found a guild',
    reward: '+500 Gold, Guild Banner item',
    rewardIcon: '🛡️',
    isComplete: (_, __, g) => g !== null,
    isUnlocked: (c, h, g, prev) => prev.find(q => q.id === 'first_blood')?.isComplete(c, h, g) ?? false,
    link: '/game/guild',
  },
  {
    id: 'rise_up',
    act: 'Act IV — Rise in the Ranks',
    actNum: 4,
    title: 'A Name Worth Fearing',
    lore: 'Survivors forget the nameless. Make yours known across the world. Climb the season rankings until the world cannot ignore you.',
    objective: 'Earn 1,000 Season Points',
    reward: '+1,000 Gold, Veteran Title',
    rewardIcon: '🏆',
    isComplete: (c) => c.seasonPoints >= 1000,
    isUnlocked: (c, h, g, prev) => prev.find(q => q.id === 'find_people')?.isComplete(c, h, g) ?? false,
    link: '/game/leaderboard',
  },
  {
    id: 'shape_world',
    act: 'Act V — Shape the World',
    actNum: 5,
    title: 'The Builder of Base',
    lore: 'This is what you were chosen for. Not merely to survive — but to leave a mark on this world that outlasts you. Lead your faction to victory.',
    objective: 'Help your guild capture a district',
    reward: 'Legendary Trophy + On-Chain Monument',
    rewardIcon: '👑',
    isComplete: () => false,
    isUnlocked: (c, h, g, prev) => prev.find(q => q.id === 'rise_up')?.isComplete(c, h, g) ?? false,
    link: '/game',
  },
];

const SIDE_QUESTS = [
  { icon: '⛏️', title: 'Miner\'s Discipline', desc: 'Raise your Mining skill to Level 10', reward: '+150g' },
  { icon: '🔧', title: 'The Craftsman\'s Touch', desc: 'Build 5 different room types in your settlement', reward: '+200g' },
  { icon: '🎣', title: 'The Patient Hunter', desc: 'Raise your Fishing skill to Level 5', reward: '+80g' },
  { icon: '💰', title: 'First Market Deal', desc: 'Buy any item from the Market', reward: '+50 Season Pts' },
  { icon: '🤝', title: 'An Unlikely Alliance', desc: 'Successfully defend against a raid', reward: '+100 Honor' },
  { icon: '🏹', title: 'Swift as the Wind', desc: 'Complete 3 raids in one day', reward: '+300g + Ranger Medal' },
];

export function QuestBoard() {
  const [char, setChar]   = useState<CharData | null>(null);
  const [home, setHome]   = useState<HomeData | null>(null);
  const [guildData, setGuildData] = useState<GuildData | null>(null);
  const [activeId, setActiveId] = useState<string | null>('claim_ground');
  const [tab, setTab] = useState<'main' | 'side'>('main');

  useEffect(() => {
    Promise.all([
      fetch('/api/character').then(r => r.json()),
      fetch('/api/guild').then(r => r.json()),
    ]).then(([cd, gd]) => {
      if (cd.character) setChar(cd.character);
      if (cd.home)      setHome(cd.home);
      if (gd.guild)     setGuildData(gd.guild);
    }).catch(() => {});
  }, []);

  // Find first uncompleted quest for the active indicator
  const activeQuest = MAIN_QUESTS.find(q => {
    const unlocked = q.isUnlocked(char ?? { level: 1, totalRaidsLaunched: 0, totalRaidsSucceeded: 0, seasonPoints: 0 }, home, guildData, MAIN_QUESTS);
    const done     = q.isComplete(char ?? { level: 1, totalRaidsLaunched: 0, totalRaidsSucceeded: 0, seasonPoints: 0 }, home, guildData);
    return unlocked && !done;
  });

  const selected = MAIN_QUESTS.find(q => q.id === activeId);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'flex-start' }}>

      {/* ── Quest list ── */}
      <div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {([['main', '📜 Main Quest'], ['side', '🌿 Side Quests']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`btn btn-sm ${tab === id ? 'btn-primary' : 'btn-ghost'}`} style={{ fontFamily: 'Lora, serif', textTransform: 'none', letterSpacing: '0.02em' }}>
              {label}
            </button>
          ))}
        </div>

        <div className="panel">
          {tab === 'main' ? (
            MAIN_QUESTS.map((q, i) => {
              const safeChar = char ?? { level: 1, totalRaidsLaunched: 0, totalRaidsSucceeded: 0, seasonPoints: 0 };
              const done     = q.isComplete(safeChar, home, guildData);
              const unlocked = q.isUnlocked(safeChar, home, guildData, MAIN_QUESTS);
              const isCurrent = activeQuest?.id === q.id;
              return (
                <div
                  key={q.id}
                  className={`quest-item ${done ? 'completed' : ''} ${isCurrent ? 'active' : ''}`}
                  onClick={() => setActiveId(q.id)}
                  style={{ opacity: !unlocked ? 0.3 : 1, cursor: !unlocked ? 'not-allowed' : 'pointer' }}
                >
                  <div className="quest-act-label">{q.act}</div>
                  <div className="quest-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {done ? '✅' : isCurrent ? '🔶' : unlocked ? '⬜' : '🔒'}
                    {q.title}
                  </div>
                </div>
              );
            })
          ) : (
            SIDE_QUESTS.map((q, i) => (
              <div key={i} className="quest-item">
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{q.icon}</span>
                  <div>
                    <div className="quest-title" style={{ fontSize: '0.85rem' }}>{q.title}</div>
                    <div className="quest-desc" style={{ marginTop: 2 }}>{q.desc}</div>
                    <div style={{ marginTop: 5, fontSize: '0.72rem', color: 'var(--dawn-gold)', fontFamily: 'Share Tech Mono, monospace' }}>
                      Reward: {q.reward}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Quest detail ── */}
      {selected && tab === 'main' ? (
        <div className="panel animate-fade-in-up">
          {/* Act header */}
          <div style={{
            padding: '20px 24px 16px',
            background: 'linear-gradient(135deg, #14200c 0%, #1c2c12 100%)',
            borderBottom: '1px solid var(--border-base)',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          }}>
            <div className="lore-title" style={{ marginBottom: 8 }}>{selected.act}</div>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: 4 }}>
              {selected.title}
            </h2>
          </div>

          <div style={{ padding: 24 }}>
            {/* Lore */}
            <div style={{
              padding: '16px 20px',
              background: 'rgba(200,152,58,0.05)',
              border: '1px solid rgba(200,152,58,0.15)',
              borderLeft: '3px solid var(--dawn-gold)',
              borderRadius: '0 var(--radius) var(--radius) 0',
              marginBottom: 20,
            }}>
              <p className="lore-text" style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.8 }}>
                {selected.lore}
              </p>
            </div>

            {/* Objective */}
            <div style={{ marginBottom: 20 }}>
              <div className="lore-title" style={{ marginBottom: 10 }}>Objective</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', background: 'var(--bg-raised)', borderRadius: 'var(--radius)', border: '1px solid var(--border-base)' }}>
                {(() => {
                  const safeChar = char ?? { level: 1, totalRaidsLaunched: 0, totalRaidsSucceeded: 0, seasonPoints: 0 };
                  const done = selected.isComplete(safeChar, home, guildData);
                  return (
                    <>
                      <span style={{ fontSize: '1.2rem' }}>{done ? '✅' : '🔶'}</span>
                      <span style={{ fontFamily: 'Lora, serif', fontSize: '0.9rem', color: done ? 'var(--leaf-green)' : 'var(--text-primary)' }}>
                        {selected.objective}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Reward */}
            <div style={{ marginBottom: 24 }}>
              <div className="lore-title" style={{ marginBottom: 10 }}>Reward</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', background: 'rgba(200,152,58,0.06)', borderRadius: 'var(--radius)', border: '1px solid rgba(200,152,58,0.2)' }}>
                <span style={{ fontSize: '1.3rem' }}>{selected.rewardIcon}</span>
                <span style={{ color: 'var(--dawn-gold)', fontFamily: 'Share Tech Mono, monospace', fontSize: '0.88rem' }}>
                  {selected.reward}
                </span>
              </div>
            </div>

            {selected.link && (
              <Link href={selected.link} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Begin this quest →
              </Link>
            )}
          </div>
        </div>
      ) : tab === 'main' ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', marginBottom: 8 }}>The Builder's Path</div>
          <p className="lore-text" style={{ fontSize: '0.85rem', margin: 0 }}>
            Select a quest from the left to read its story and begin your journey.
          </p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌿</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', marginBottom: 8 }}>Side Quests</div>
          <p className="lore-text" style={{ fontSize: '0.85rem', margin: 0 }}>
            Complete side quests to earn extra gold, experience, and rare titles.
            They are independent of the main story — tackle any in any order.
          </p>
        </div>
      )}
    </div>
  );
}
