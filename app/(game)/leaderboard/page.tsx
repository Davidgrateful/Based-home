'use client';

import { useEffect, useState } from 'react';

interface CharRow {
  name: string;
  class: 'warrior' | 'mage' | 'ranger';
  level: number;
  seasonPoints?: number;
  totalRaidsSucceeded?: number;
  gold?: number;
  honor?: number;
  infamy?: number;
}

const CLASS_ICONS = { warrior: '⚔️', mage: '🔮', ranger: '🏹' };
const CLASS_COLORS = { warrior: 'var(--class-warrior)', mage: 'var(--class-mage)', ranger: 'var(--class-ranger)' };

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--neon-gold)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>1</div>;
  if (rank === 2) return <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#aaaacc', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>2</div>;
  if (rank === 3) return <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#cc8844', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>3</div>;
  return <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-raised)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem' }}>{rank}</div>;
}

export default function LeaderboardPage() {
  const [data, setData] = useState<{ bySeasonPoints: CharRow[]; byRaids: CharRow[]; byGold: CharRow[] } | null>(null);
  const [tab, setTab] = useState<'season' | 'raids' | 'gold'>('season');

  useEffect(() => {
    fetch('/api/leaderboard').then(r => r.json()).then(setData);
  }, []);

  const rows: CharRow[] = !data ? [] : tab === 'season' ? data.bySeasonPoints : tab === 'raids' ? data.byRaids : data.byGold;
  const valueKey = tab === 'season' ? 'seasonPoints' : tab === 'raids' ? 'totalRaidsSucceeded' : 'gold';
  const valueLabel = tab === 'season' ? 'Season Pts' : tab === 'raids' ? 'Raids Won' : 'Gold';
  const valueColor = tab === 'season' ? 'var(--neon-purple)' : tab === 'raids' ? 'var(--neon-red)' : 'var(--neon-gold)';

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 4 }}>🏆 LEADERBOARD</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Season 1 rankings. Resets in 87 days. Top 100 earn on-chain trophies.
        </p>
      </div>

      {/* Season countdown */}
      <div style={{ marginBottom: 20, padding: '12px 18px', background: '#1a1200', border: '1px solid #ffcc0033', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: '1.5rem' }}>⏳</span>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--neon-gold)' }}>Season 1 — The Grid Awakens</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            87 days remaining · Top 100 season players earn a permanent on-chain trophy (non-transferable)
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {([
          { id: 'season', label: '🏆 Season Points' },
          { id: 'raids',  label: '⚔️ Raiders' },
          { id: 'gold',   label: '💰 Wealthiest' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel">
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 12, padding: '8px 16px', borderBottom: '1px solid var(--border-base)' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>#</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>OPERATIVE</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', textAlign: 'right' }}>{valueLabel.toUpperCase()}</span>
        </div>

        {!data && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading rankings...</div>
        )}

        {data && rows.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
            No players yet — be the first on the board!
          </div>
        )}

        {rows.map((row, i) => {
          const rank = i + 1;
          return (
            <div
              key={row.name}
              className={`leaderboard-row ${rank <= 3 ? `rank-${rank}` : ''}`}
              style={{ gridTemplateColumns: '40px 1fr auto', gap: 12 }}
            >
              <RankBadge rank={rank} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1rem' }}>{CLASS_ICONS[row.class]}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{row.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: CLASS_COLORS[row.class] }}>{row.class}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>Lv{row.level}</span>
                    {row.honor !== undefined && row.honor > 0 && <span style={{ color: 'var(--neon-blue)', marginLeft: 8 }}>⚡ {row.honor}</span>}
                    {row.infamy !== undefined && row.infamy > 0 && <span style={{ color: 'var(--neon-red)', marginLeft: 8 }}>💀 {row.infamy}</span>}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: valueColor }}>
                  {((row as any)[valueKey] ?? 0).toLocaleString()}
                </div>
                {rank === 1 && <div style={{ fontSize: '0.6rem', color: 'var(--neon-gold)' }}>👑 LEADER</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trophy info */}
      <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-base)', borderRadius: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.9rem' }}>🎖️ Season Trophy Rewards</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { rank: 'Rank 1', trophy: '👑 Legendary', color: 'var(--neon-gold)', desc: 'Immortalized on-chain. Trophy displayed in world.' },
            { rank: 'Rank 2–10', trophy: '💎 Epic', color: 'var(--rarity-epic)', desc: 'Epic on-chain trophy. Permanent prestige.' },
            { rank: 'Rank 11–50', trophy: '🔷 Rare', color: 'var(--rarity-rare)', desc: 'Rare on-chain trophy. Season badge.' },
            { rank: 'Rank 51–100', trophy: '🟢 Uncommon', color: 'var(--rarity-uncommon)', desc: 'Uncommon trophy. Proof of top 100.' },
          ].map(t => (
            <div key={t.rank} style={{ padding: 10, background: 'var(--bg-raised)', borderRadius: 6 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>{t.rank}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: t.color, marginTop: 4 }}>{t.trophy}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
