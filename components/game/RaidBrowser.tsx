'use client';

import { useState, useEffect } from 'react';
import type { RaidLogEntry, RaidResult } from '@/lib/game/raidEngine';

interface RaidTarget {
  homeId: string;
  homeName: string;
  defenseRating: number;
  prestigeScore: number;
  resourceGold: number;
  ownerName: string;
  ownerLevel: number;
  ownerClass: 'warrior' | 'mage' | 'ranger';
  ownerHonor: number;
  ownerInfamy: number;
  lastRaidedAt: string | null;
  totalTimesRaided: number;
}

const CLASS_ICONS = { warrior: '⚔️', mage: '🔮', ranger: '🏹' };
const CLASS_COLORS = { warrior: 'var(--class-warrior)', mage: 'var(--class-mage)', ranger: 'var(--class-ranger)' };

function DiffBadge({ rating }: { rating: number }) {
  if (rating < 100) return <span className="tag tag-common">Easy</span>;
  if (rating < 300) return <span className="tag tag-uncommon">Medium</span>;
  if (rating < 600) return <span className="tag tag-rare">Hard</span>;
  if (rating < 1000) return <span className="tag tag-epic">Brutal</span>;
  return <span className="tag tag-legendary">Fortress</span>;
}

function LogLine({ entry }: { entry: RaidLogEntry }) {
  return (
    <div className={`raid-log-${entry.type}`} style={{ display: 'flex', gap: 8 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 8 }}>▸</span>
      <span>{entry.message}</span>
      {entry.hpAfter !== undefined && entry.hpBefore !== undefined && entry.hpBefore !== entry.hpAfter && (
        <span style={{ color: 'var(--neon-orange)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          HP {entry.hpBefore} → {Math.max(0, entry.hpAfter)}
        </span>
      )}
    </div>
  );
}

export function RaidBrowser() {
  const [targets, setTargets] = useState<RaidTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RaidTarget | null>(null);
  const [raiding, setRaiding] = useState(false);
  const [result, setResult] = useState<RaidResult | null>(null);
  const [callingCard, setCallingCard] = useState('');
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'gold' | 'defense' | 'level'>('gold');

  useEffect(() => {
    fetch('/api/raid')
      .then(r => r.json())
      .then(d => { setTargets(d.targets ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...targets].sort((a, b) => {
    if (sortBy === 'gold') return b.resourceGold - a.resourceGold;
    if (sortBy === 'defense') return a.defenseRating - b.defenseRating;
    return a.ownerLevel - b.ownerLevel;
  });

  const executeRaid = async () => {
    if (!selected) return;
    setRaiding(true);
    setResult(null);
    setError('');
    try {
      const res = await fetch('/api/raid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeId: selected.homeId, callingCard: callingCard || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Raid failed'); return; }
      setResult(data.result);
      // Refresh targets
      fetch('/api/raid').then(r => r.json()).then(d => setTargets(d.targets ?? []));
    } catch {
      setError('Network error — try again.');
    } finally {
      setRaiding(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚔️</div>
      Scanning for targets...
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* Target list */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>SORT BY</span>
          {(['gold', 'defense', 'level'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)} className={`btn btn-sm ${sortBy === s ? 'btn-primary' : 'btn-ghost'}`} style={{ textTransform: 'capitalize' }}>
              {s === 'gold' ? '💰 Gold' : s === 'defense' ? '🛡️ Easiest' : '🎯 Level'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {targets.length} target{targets.length !== 1 ? 's' : ''} found
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.length === 0 && (
            <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
              No raid targets available. More players will appear as the server grows.
            </div>
          )}
          {sorted.map(t => {
            const isSelected = selected?.homeId === t.homeId;
            const clsColor = CLASS_COLORS[t.ownerClass] ?? '#fff';
            const timeSinceRaid = t.lastRaidedAt
              ? Math.floor((Date.now() - new Date(t.lastRaidedAt).getTime()) / 3600000)
              : null;
            return (
              <div
                key={t.homeId}
                className="panel"
                onClick={() => { setSelected(isSelected ? null : t); setResult(null); setError(''); }}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  border: `1px solid ${isSelected ? 'var(--neon-blue)' : 'var(--border-base)'}`,
                  background: isSelected ? '#4488ff08' : 'var(--bg-surface)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>{t.homeName}</span>
                    <DiffBadge rating={t.defenseRating} />
                    {timeSinceRaid !== null && timeSinceRaid < 8 && (
                      <span className="tag" style={{ color: 'var(--neon-blue)', borderColor: '#4488ff33', background: '#4488ff11', fontSize: '0.6rem' }}>
                        🛡️ {8 - timeSinceRaid}h shield
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem' }}>
                    <span>
                      <span style={{ color: clsColor }}>{CLASS_ICONS[t.ownerClass]} </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{t.ownerName}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>Lv{t.ownerLevel}</span>
                    </span>
                    {t.ownerHonor > 0 && <span style={{ color: 'var(--neon-blue)' }}>⚡ {t.ownerHonor} honor</span>}
                    {t.ownerInfamy > 0 && <span style={{ color: 'var(--neon-red)' }}>💀 {t.ownerInfamy} infamy</span>}
                    <span style={{ color: 'var(--text-muted)' }}>Raided {t.totalTimesRaided}×</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--neon-gold)' }}>
                    ~{Math.floor(t.resourceGold * 0.3).toLocaleString()}g
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>potential loot</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    🛡️ {t.defenseRating} DEF
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action panel */}
      <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 24 }}>
        {result ? (
          <div className="panel animate-fade-in-up">
            <div className="panel-header" style={{
              borderColor: result.status === 'success' ? 'var(--neon-green)' : result.status === 'escaped' ? 'var(--neon-orange)' : 'var(--neon-red)',
            }}>
              {result.status === 'success' ? '✅ RAID SUCCESS' : result.status === 'escaped' ? '⚡ ESCAPED' : '☠️ RAID FAILED'}
            </div>
            <div style={{ padding: 14 }}>
              {result.status !== 'failed' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ background: 'var(--bg-raised)', borderRadius: 5, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>GOLD</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--neon-gold)' }}>+{result.goldStolen}g</div>
                  </div>
                  <div style={{ background: 'var(--bg-raised)', borderRadius: 5, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>XP</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--neon-purple)' }}>+{result.xpEarned}</div>
                  </div>
                  <div style={{ background: 'var(--bg-raised)', borderRadius: 5, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>GUARDS</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--neon-orange)' }}>{result.guardsDefeated}</div>
                  </div>
                  <div style={{ background: 'var(--bg-raised)', borderRadius: 5, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>HP LEFT</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: result.attackerHpRemaining > 50 ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                      {result.attackerHpRemaining}
                    </div>
                  </div>
                </div>
              )}
              <div className="panel" style={{ padding: 10, maxHeight: 260, overflowY: 'auto' }}>
                <div className="raid-log" style={{ fontSize: '0.72rem' }}>
                  {result.log.map((entry, i) => <LogLine key={i} entry={entry} />)}
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => { setResult(null); setSelected(null); }}
              >
                ← Back to targets
              </button>
            </div>
          </div>
        ) : selected ? (
          <div className="panel animate-fade-in-up">
            <div className="panel-header">⚔️ RAID {selected.homeName.toUpperCase()}</div>
            <div style={{ padding: 14 }}>
              <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'Owner', value: `${CLASS_ICONS[selected.ownerClass]} ${selected.ownerName} Lv${selected.ownerLevel}`, color: CLASS_COLORS[selected.ownerClass] },
                  { label: 'Defense', value: `${selected.defenseRating}`, color: 'var(--neon-blue)' },
                  { label: 'Est. Loot', value: `~${Math.floor(selected.resourceGold * 0.3).toLocaleString()}g`, color: 'var(--neon-gold)' },
                  { label: 'Times Raided', value: `${selected.totalTimesRaided}×`, color: 'var(--text-secondary)' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid var(--border-dim)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                    <span style={{ color: r.color, fontWeight: 600 }}>{r.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Calling Card (optional)</label>
                <input
                  value={callingCard}
                  onChange={e => setCallingCard(e.target.value.slice(0, 80))}
                  placeholder="Leave a message for the defender..."
                  className="input"
                  style={{ fontSize: '0.85rem' }}
                />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Shown to the home owner after the raid.
                </div>
              </div>

              {error && (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#ff334411', border: '1px solid #ff334433', borderRadius: 5, fontSize: '0.82rem', color: 'var(--neon-red)' }}>
                  {error}
                </div>
              )}

              <button
                className="btn btn-danger"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={executeRaid}
                disabled={raiding}
              >
                {raiding ? '⚔️ Raiding...' : '⚔️ Launch Raid'}
              </button>
              <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                5 raids per day · Defender gets notified · Defender earns 8h shield if you succeed
              </div>
            </div>
          </div>
        ) : (
          <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚔️</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
              Select a target to preview their home stats and launch a raid.
            </p>
            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-raised)', borderRadius: 6, textAlign: 'left' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 6 }}>DAILY LIMITS</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                ⚔️ 5 raids per day<br />
                🛡️ Can't hit same player twice in 24h<br />
                ✅ Success = defender gets 8h shield<br />
                💀 Fail = you gain infamy, lose honor
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
