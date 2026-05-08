'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ProfileData {
  character: {
    id: string; name: string; class: string; level: number;
    xp: number; gold: number; honor: number; infamy: number;
    totalRaidsLaunched: number; totalRaidsSucceeded: number;
    totalRaidsDefended: number; totalRaidsLost: number;
    seasonPoints: number; createdAt: string;
  } | null;
  skills: { name: string; level: number; xp: number }[];
  home: { defenseRating: number; prestigeScore: number; totalTimesRaided: number } | null;
}

const SKILL_ICONS: Record<string, string> = {
  mining: '⛏️', crafting: '🔧', engineering: '⚙️', fishing: '🎣',
  cooking: '🍳', architecture: '🏗️', combat: '⚔️', alchemy: '⚗️',
  trading: '💰', hacking: '💻',
};

const CLASS_COLORS: Record<string, string> = { warrior: 'var(--class-warrior)', mage: 'var(--class-mage)', ranger: 'var(--class-ranger)' };
const CLASS_ICONS: Record<string, string> = { warrior: '⚔️', mage: '🔮', ranger: '🏹' };

function XPBar({ xp, toNext }: { xp: number; toNext: number }) {
  const pct = Math.min(100, (xp / toNext) * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 3 }}>
        <span>XP</span><span>{xp.toLocaleString()} / {toNext.toLocaleString()}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill progress-xp" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function xpForLevel(lvl: number) { return Math.floor(100 * Math.pow(1.4, lvl - 1)); }

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/character').then(r => r.json()),
      fetch('/api/home').then(r => r.json()),
    ]).then(([cd, hd]) => {
      setData({ character: cd.character, skills: cd.skills ?? [], home: hd.home });
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading profile...</div>;

  if (!data?.character) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: '1.2rem', marginBottom: 12 }}>No character found.</div>
      <Link href="/register" className="btn btn-primary">Create Character →</Link>
    </div>
  );

  const c = data.character;
  const clsColor = CLASS_COLORS[c.class] ?? '#fff';
  const xpToNext = xpForLevel(c.level);
  const raidSuccessRate = c.totalRaidsLaunched > 0 ? Math.round((c.totalRaidsSucceeded / c.totalRaidsLaunched) * 100) : 0;
  const defenseRate = (c.totalRaidsDefended + c.totalRaidsLost) > 0
    ? Math.round((c.totalRaidsDefended / (c.totalRaidsDefended + c.totalRaidsLost)) * 100) : 0;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 4 }}>👤 OPERATIVE PROFILE</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'flex-start' }}>
        {/* Left — identity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${clsColor}22`, border: `3px solid ${clsColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 12px' }}>
                {CLASS_ICONS[c.class]}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{c.name}</div>
              <div style={{ color: clsColor, textTransform: 'capitalize', fontSize: '0.85rem', marginTop: 2 }}>
                {c.class} · Level {c.level}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 4, fontFamily: 'Share Tech Mono, monospace' }}>
                Joined {new Date(c.createdAt).toLocaleDateString()}
              </div>
            </div>

            <XPBar xp={c.xp} toNext={xpToNext} />

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--bg-raised)', borderRadius: 5, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>GOLD</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--neon-gold)' }}>{c.gold.toLocaleString()}g</div>
              </div>
              <div style={{ background: 'var(--bg-raised)', borderRadius: 5, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>SEASON PTS</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--neon-purple)' }}>{c.seasonPoints.toLocaleString()}</div>
              </div>
              <div style={{ background: 'var(--bg-raised)', borderRadius: 5, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>HONOR</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--neon-blue)' }}>⚡ {c.honor}</div>
              </div>
              <div style={{ background: 'var(--bg-raised)', borderRadius: 5, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>INFAMY</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--neon-red)' }}>💀 {c.infamy}</div>
              </div>
            </div>
          </div>

          {/* Combat stats */}
          <div className="panel" style={{ padding: 14 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 10 }}>RAID STATS</div>
            {[
              { label: 'Raids Launched', value: c.totalRaidsLaunched },
              { label: 'Raids Succeeded', value: c.totalRaidsSucceeded, color: 'var(--neon-green)' },
              { label: 'Success Rate', value: `${raidSuccessRate}%`, color: raidSuccessRate > 60 ? 'var(--neon-green)' : 'var(--neon-orange)' },
              { label: 'Times Defended', value: c.totalRaidsDefended, color: 'var(--neon-blue)' },
              { label: 'Times Lost', value: c.totalRaidsLost, color: 'var(--neon-red)' },
              { label: 'Defense Rate', value: `${defenseRate}%`, color: defenseRate > 60 ? 'var(--neon-green)' : 'var(--neon-orange)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-dim)', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                <span style={{ fontWeight: 700, color: s.color ?? 'var(--text-primary)' }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Home stats */}
          {data.home && (
            <div className="panel" style={{ padding: 14 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 10 }}>HOME</div>
              {[
                { label: 'Defense Rating', value: data.home.defenseRating, color: 'var(--neon-blue)' },
                { label: 'Prestige', value: data.home.prestigeScore, color: 'var(--neon-gold)' },
                { label: 'Times Raided', value: data.home.totalTimesRaided, color: 'var(--neon-red)' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-dim)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                  <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
                </div>
              ))}
              <Link href="/game/home" className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>View Home →</Link>
            </div>
          )}
        </div>

        {/* Right — skills */}
        <div>
          <div className="panel">
            <div className="panel-header">📊 SKILL LEVELS</div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {data.skills.length === 0 ? (
                  <div style={{ gridColumn: 'span 2', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: 8 }}>No skills found.</div>
                ) : data.skills.map(sk => {
                  const maxXp = xpForLevel(sk.level);
                  const pct = Math.min(100, (sk.xp / maxXp) * 100);
                  const lvl99 = sk.level >= 99;
                  return (
                    <div key={sk.name} style={{ background: 'var(--bg-raised)', borderRadius: 6, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span>{SKILL_ICONS[sk.name] ?? '🔹'}</span>
                          <span style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.85rem' }}>{sk.name}</span>
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: lvl99 ? 'var(--neon-gold)' : 'var(--neon-blue)' }}>
                          {sk.level}
                          {lvl99 && ' 👑'}
                        </span>
                      </div>
                      <div className="progress-bar" style={{ height: 4 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: lvl99 ? 'var(--neon-gold)' : 'var(--neon-blue)' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: '0.64rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                        <span>{sk.xp.toLocaleString()} xp</span>
                        <span>{lvl99 ? 'MAX' : `${maxXp.toLocaleString()} to next`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16, padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.9rem' }}>🎖️ Trophies</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' }}>
              No trophies yet. Compete in Season 1 to earn them.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
