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
  mining: '⛏️', crafting: '🔨', engineering: '⚙️', fishing: '🎣',
  cooking: '🍲', architecture: '🏗️', combat: '⚔️', alchemy: '⚗️',
  trading: '🧺', hacking: '💻',
};

const SKILL_LORE: Record<string, string> = {
  mining:       'Extracting the bones of the earth',
  crafting:     'Shaping raw material into purpose',
  engineering:  'Building machines from broken parts',
  fishing:      'Patience rewarded by the deep',
  cooking:      'Turning survival into sustenance',
  architecture: 'Raising walls against the dark',
  combat:       'The language of the broken world',
  alchemy:      'Ancient formulas, dangerous results',
  trading:      'Gold changes hands, power follows',
  hacking:      'The old world\'s locks, opened again',
};

const CLASS_COLORS: Record<string, string> = {
  warrior: 'var(--class-warrior)',
  mage:    'var(--class-mage)',
  ranger:  'var(--class-ranger)',
};
const CLASS_ICONS: Record<string, string> = { warrior: '⚔️', mage: '🔮', ranger: '🏹' };
const CLASS_LORE: Record<string, string> = {
  warrior: 'Forged in the fires of the faction wars, you carry the scars of battles fought before your time. The walls you build will outlast the world that broke you.',
  mage:    'You recovered the forbidden knowledge of the old world — the arcane scripts that built and then destroyed civilization. You wield them more carefully than your predecessors.',
  ranger:  'The wilderness raised you when civilization fell. You move faster, see further, and leave no trace. The broken world fears what it cannot find.',
};

const CLASS_TITLES: Record<string, string[]> = {
  warrior: ['Survivor', 'Defender', 'Iron Guard', 'Bastion', 'Warlord'],
  mage:    ['Survivor', 'Arcanist', 'Runekeeper', 'Archmage', 'Worldbender'],
  ranger:  ['Survivor', 'Scout', 'Pathfinder', 'Ghostwalker', 'Legend of Base'],
};

function xpForLevel(lvl: number) { return Math.floor(100 * Math.pow(1.4, lvl - 1)); }

function XPBar({ xp, toNext }: { xp: number; toNext: number }) {
  const pct = Math.min(100, (xp / toNext) * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 3, fontFamily: 'Share Tech Mono, monospace' }}>
        <span>Experience</span><span>{xp.toLocaleString()} / {toNext.toLocaleString()}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill progress-xp" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/character').then(r => r.json()),
      fetch('/api/home').then(r => r.json()),
    ]).then(([cd, hd]) => {
      setData({ character: cd.character, skills: cd.skills ?? [], home: hd.home });
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'Lora, serif', fontStyle: 'italic' }}>
      Reading the chronicles...
    </div>
  );

  if (!data?.character) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', marginBottom: 8 }}>No survivor found.</div>
      <p className="lore-text" style={{ marginBottom: 16 }}>Your story has not yet begun in Base.</p>
      <Link href="/register" className="btn btn-primary">Begin Your Journey →</Link>
    </div>
  );

  const c = data.character;
  const clsColor = CLASS_COLORS[c.class] ?? 'var(--dawn-gold)';
  const xpToNext = xpForLevel(c.level);
  const raidSuccessRate = c.totalRaidsLaunched > 0 ? Math.round((c.totalRaidsSucceeded / c.totalRaidsLaunched) * 100) : 0;
  const defenseRate = (c.totalRaidsDefended + c.totalRaidsLost) > 0
    ? Math.round((c.totalRaidsDefended / (c.totalRaidsDefended + c.totalRaidsLost)) * 100) : 0;
  const titleIdx = Math.min(Math.floor(c.level / 20), 4);
  const title = CLASS_TITLES[c.class]?.[titleIdx] ?? 'Survivor';
  const daysAlive = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Cinzel Decorative, Cinzel, serif', fontSize: '1.6rem', marginBottom: 4 }}>
          📖 SURVIVOR CHRONICLE
        </h1>
        <p className="lore-text" style={{ fontSize: '0.85rem', margin: 0 }}>
          Every scar, every victory, every gold coin — recorded here for the world to remember.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Left column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Character portrait panel */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Portrait header with class background */}
            <div style={{
              padding: '24px 20px 20px',
              background: `linear-gradient(145deg, ${clsColor}18 0%, var(--bg-surface) 100%)`,
              borderBottom: '1px solid var(--border-base)',
              textAlign: 'center',
              position: 'relative',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${clsColor}22 0%, transparent 70%)`, pointerEvents: 'none' }} />
              <div style={{
                width: 80, height: 80,
                borderRadius: '50%',
                background: `radial-gradient(circle at 40% 35%, ${clsColor}30 0%, ${clsColor}10 60%, transparent 100%)`,
                border: `3px solid ${clsColor}66`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.4rem', margin: '0 auto 14px',
                position: 'relative', zIndex: 1,
                boxShadow: `0 0 32px ${clsColor}33`,
              }}>
                {CLASS_ICONS[c.class]}
              </div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.3rem', fontWeight: 700, marginBottom: 2, position: 'relative', zIndex: 1 }}>{c.name}</div>
              <div style={{ color: clsColor, fontFamily: 'Cinzel, serif', fontSize: '0.72rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, position: 'relative', zIndex: 1 }}>
                {title} · {c.class} · Level {c.level}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'Lora, serif', fontStyle: 'italic', position: 'relative', zIndex: 1 }}>
                Survived {daysAlive === 0 ? 'since today' : `${daysAlive} days`}
              </div>
            </div>

            <div style={{ padding: '16px 18px' }}>
              {/* Class lore */}
              <p className="lore-text" style={{ fontSize: '0.78rem', marginBottom: 14 }}>
                {CLASS_LORE[c.class]}
              </p>

              <XPBar xp={c.xp} toNext={xpToNext} />

              {/* Core stats grid */}
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {[
                  { label: 'Gold', value: `${c.gold.toLocaleString()}g`, color: 'var(--dawn-gold)' },
                  { label: 'Season Pts', value: c.seasonPoints.toLocaleString(), color: 'var(--rarity-epic)' },
                  { label: 'Honor', value: `⚡ ${c.honor}`, color: 'var(--river-blue)' },
                  { label: 'Infamy', value: `💀 ${c.infamy}`, color: 'var(--blood-red)' },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value" style={{ color: s.color, fontSize: '0.92rem' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Battle record */}
          <div className="panel" style={{ padding: 14 }}>
            <div className="panel-header" style={{ padding: '0 0 10px', marginBottom: 6 }}>⚔️ Battle Record</div>
            {[
              { label: 'Raids Launched', value: c.totalRaidsLaunched },
              { label: 'Raids Succeeded', value: c.totalRaidsSucceeded, color: 'var(--leaf-green)' },
              { label: 'Success Rate', value: `${raidSuccessRate}%`, color: raidSuccessRate > 60 ? 'var(--leaf-green)' : 'var(--firelight)' },
              { label: 'Defended', value: c.totalRaidsDefended, color: 'var(--river-blue)' },
              { label: 'Lost Defense', value: c.totalRaidsLost, color: 'var(--blood-red)' },
              { label: 'Defense Rate', value: `${defenseRate}%`, color: defenseRate > 60 ? 'var(--leaf-green)' : 'var(--firelight)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-dim)', fontSize: '0.8rem', fontFamily: 'Lora, serif' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                <span style={{ fontWeight: 700, color: s.color ?? 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace' }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Settlement */}
          {data.home && (
            <div className="panel" style={{ padding: 14 }}>
              <div className="panel-header" style={{ padding: '0 0 10px', marginBottom: 6 }}>🏡 Settlement</div>
              {[
                { label: 'Defense Rating', value: data.home.defenseRating, color: 'var(--river-blue)' },
                { label: 'Prestige', value: data.home.prestigeScore, color: 'var(--dawn-gold)' },
                { label: 'Times Raided', value: data.home.totalTimesRaided, color: 'var(--blood-red)' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-dim)', fontSize: '0.8rem', fontFamily: 'Lora, serif' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                  <span style={{ fontWeight: 700, color: s.color, fontFamily: 'Share Tech Mono, monospace' }}>{s.value}</span>
                </div>
              ))}
              <Link href="/game/home" className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
                View Settlement →
              </Link>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Skill journal */}
          <div className="panel">
            <div className="panel-header">📚 Survivor Skills</div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {data.skills.length === 0 ? (
                  <div style={{ gridColumn: 'span 2', color: 'var(--text-secondary)', fontFamily: 'Lora, serif', fontStyle: 'italic', padding: 8 }}>
                    No skills recorded yet.
                  </div>
                ) : data.skills.map(sk => {
                  const maxXp = xpForLevel(sk.level);
                  const pct   = Math.min(100, (sk.xp / maxXp) * 100);
                  const maxed = sk.level >= 99;
                  const isActive = activeSkill === sk.name;
                  return (
                    <div
                      key={sk.name}
                      onClick={() => setActiveSkill(isActive ? null : sk.name)}
                      style={{
                        background: isActive ? 'var(--bg-raised)' : 'var(--bg-raised)',
                        borderRadius: 6, padding: '10px 12px',
                        cursor: 'pointer',
                        border: `1px solid ${isActive ? 'var(--border-bright)' : 'transparent'}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                          <span>{SKILL_ICONS[sk.name] ?? '🔹'}</span>
                          <div>
                            <div style={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.8rem', textTransform: 'capitalize' }}>{sk.name}</div>
                            {isActive && (
                              <div style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: 1 }}>
                                {SKILL_LORE[sk.name]}
                              </div>
                            )}
                          </div>
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: maxed ? 'var(--dawn-gold)' : 'var(--text-primary)', fontFamily: 'Share Tech Mono, monospace' }}>
                          {sk.level}{maxed && ' 👑'}
                        </span>
                      </div>
                      <div className="progress-bar" style={{ height: 3 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: maxed ? 'var(--dawn-gold)' : 'var(--leaf-green)' }} />
                      </div>
                      {isActive && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                          <span>{sk.xp.toLocaleString()} xp</span>
                          <span>{maxed ? 'MASTERED' : `${maxXp.toLocaleString()} to next`}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Trophies */}
          <div className="panel">
            <div className="panel-header">🏆 Trophies & Honours</div>
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.4 }}>🏆</div>
              <p className="lore-text" style={{ fontSize: '0.85rem', maxWidth: 340, margin: '0 auto 8px' }}>
                No trophies yet. The Season of Reckoning is still young.
                Prove yourself before the world forgets your name.
              </p>
              <Link href="/game/leaderboard" className="btn btn-ghost btn-sm">
                View Season Rankings →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
