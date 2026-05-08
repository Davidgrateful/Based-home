'use client';

import { useState } from 'react';
import { DISTRICT_DEFS, type DistrictDef } from '@/lib/game/districts';
import Link from 'next/link';

interface Props { userId: string; }

const WAR_STATES: Record<string, string> = {
  'zero-district': 'war',
  'vault-district': 'contested',
  'neon-quarter': 'contested',
};

const MOCK_OWNERS: Record<string, { name: string; color: string; tag: string }> = {
  'neon-quarter':  { name: 'NeonKings', color: '#00ddff', tag: 'NK' },
  'vault-district':{ name: 'Iron Vault', color: '#ffcc00', tag: 'IV' },
  'rust-belt':     { name: 'Rust Lords', color: '#ff8833', tag: 'RL' },
  'foundry':       { name: 'The Forge', color: '#ff4433', tag: 'TF' },
  'archives':      { name: 'Keepers', color: '#ffaa33', tag: 'KP' },
};

export function WorldMapClient({ userId }: Props) {
  const [selected, setSelected] = useState<DistrictDef | null>(null);
  const [filter, setFilter] = useState<'all' | 'controlled' | 'contested' | 'free'>('all');

  const filtered = DISTRICT_DEFS.filter(d => {
    if (filter === 'controlled') return !!MOCK_OWNERS[d.slug];
    if (filter === 'contested') return WAR_STATES[d.slug] === 'contested' || WAR_STATES[d.slug] === 'war';
    if (filter === 'free') return !MOCK_OWNERS[d.slug];
    return true;
  });

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* Map */}
      <div style={{ flex: 1 }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['all', 'controlled', 'contested', 'free'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              style={{ textTransform: 'capitalize' }}
            >
              {f}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
            <span><span style={{ color: '#ffcc00' }}>■</span> Controlled</span>
            <span><span style={{ color: '#ff3344' }}>■</span> War</span>
            <span><span style={{ color: 'var(--border-base)' }}>■</span> Free</span>
          </div>
        </div>

        <div className="world-map">
          {DISTRICT_DEFS.map(d => {
            const owner = MOCK_OWNERS[d.slug];
            const warState = WAR_STATES[d.slug];
            const isSelected = selected?.slug === d.slug;
            const isFiltered = !filtered.includes(d);

            return (
              <div
                key={d.slug}
                className={`district-tile${warState === 'contested' || warState === 'war' ? ' contested' : ''}`}
                onClick={() => setSelected(isSelected ? null : d)}
                style={{
                  background: d.bgColor,
                  borderColor: isSelected ? d.color : owner ? `${owner.color}66` : 'var(--border-base)',
                  borderWidth: isSelected ? 2 : owner ? 2 : 1,
                  boxShadow: isSelected ? `0 0 20px ${d.color}44` : owner ? `0 0 8px ${owner.color}22` : 'none',
                  opacity: isFiltered ? 0.3 : 1,
                  cursor: isFiltered ? 'default' : 'pointer',
                }}
              >
                {/* War indicator */}
                {warState === 'war' && (
                  <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--neon-red)', boxShadow: '0 0 8px var(--neon-red)', animation: 'pulse 1s infinite' }} />
                )}
                {warState === 'contested' && (
                  <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--neon-orange)', boxShadow: '0 0 8px var(--neon-orange)' }} />
                )}

                {/* Owner tag */}
                {owner && (
                  <div style={{ position: 'absolute', top: 8, left: 8, background: `${owner.color}22`, border: `1px solid ${owner.color}44`, borderRadius: 3, padding: '1px 6px', fontSize: '0.6rem', fontFamily: 'Share Tech Mono, monospace', color: owner.color, fontWeight: 700 }}>
                    [{owner.tag}]
                  </div>
                )}

                <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>{d.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: d.color }}>{d.name}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
                  LVL {d.minLevel === 0 ? 'ANY' : d.minLevel + '+'}
                </div>

                {/* Buff tag */}
                <div style={{ marginTop: 6, padding: '2px 6px', background: `${d.color}11`, border: `1px solid ${d.color}22`, borderRadius: 3, fontSize: '0.6rem', color: d.color, fontFamily: 'Share Tech Mono, monospace' }}>
                  {d.defaultBuff.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side panel */}
      <div style={{ width: 280, flexShrink: 0 }}>
        {selected ? (
          <div className="panel animate-fade-in-up" style={{ position: 'sticky', top: 24 }}>
            <div className="panel-header" style={{ borderColor: selected.color }}>
              <span style={{ fontSize: '1rem' }}>{selected.icon}</span>
              <span style={{ color: selected.color }}>{selected.name.toUpperCase()}</span>
            </div>
            <div style={{ padding: 16 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>
                {selected.lore}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <div className="panel" style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 2 }}>RESOURCE</div>
                  <div style={{ fontSize: '0.85rem', color: selected.color, fontWeight: 600, textTransform: 'capitalize' }}>{selected.resourceType}</div>
                </div>
                <div className="panel" style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 2 }}>MIN LEVEL</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{selected.minLevel === 0 ? 'Open' : selected.minLevel}</div>
                </div>
              </div>

              {/* District buff */}
              <div style={{ background: `${selected.color}0d`, border: `1px solid ${selected.color}33`, borderRadius: 6, padding: '10px 12px', marginBottom: 16 }}>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 4 }}>DISTRICT BUFF</div>
                <div style={{ fontSize: '0.9rem', color: selected.color, fontWeight: 700 }}>{selected.defaultBuff.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active for guild in control</div>
              </div>

              {/* Owner */}
              {MOCK_OWNERS[selected.slug] ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 6 }}>CONTROLLED BY</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: MOCK_OWNERS[selected.slug].color }} />
                    <span style={{ color: MOCK_OWNERS[selected.slug].color, fontWeight: 700 }}>{MOCK_OWNERS[selected.slug].name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tax: 5%</span>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 16, padding: '8px 12px', background: '#44ff8811', border: '1px solid #44ff8833', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--neon-green)', fontWeight: 600 }}>🟢 Unclaimed Territory</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Your guild can claim this!</div>
                </div>
              )}

              {WAR_STATES[selected.slug] && (
                <div style={{ marginBottom: 16, padding: '8px 12px', background: '#ff334411', border: '1px solid #ff334433', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--neon-red)', fontWeight: 600 }}>
                    {WAR_STATES[selected.slug] === 'war' ? '⚔️ Active War' : '⚡ Contested'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>War ends in 3d 14h</div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href={`/game/district/${selected.slug}`} className="btn btn-primary" style={{ justifyContent: 'center' }}>
                  Enter District →
                </Link>
                <Link href="/game/raid" className="btn btn-secondary" style={{ justifyContent: 'center' }}>
                  ⚔️ Find Targets Here
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
              Click any district to inspect it, view its buff, see who controls it, and find raid targets.
            </div>
          </div>
        )}

        {/* Recent events */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">📡 GRID EVENTS</div>
          <div style={{ padding: '8px 0' }}>
            {[
              { icon: '⚔️', text: 'NeonKings seized Neon Quarter', time: '4m ago', color: 'var(--neon-cyan)' },
              { icon: '💀', text: 'GhostX raided VaultKing (1,240g stolen)', time: '12m ago', color: 'var(--neon-red)' },
              { icon: '🏆', text: 'ShadowBlade reached Level 30', time: '18m ago', color: 'var(--neon-gold)' },
              { icon: '⚡', text: 'War declared on Zero District', time: '45m ago', color: 'var(--neon-orange)' },
              { icon: '🎣', text: 'FishLord maxed Fishing skill (99!)', time: '1h ago', color: 'var(--neon-green)' },
            ].map((ev, i) => (
              <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-dim)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.9rem', marginTop: 1 }}>{ev.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{ev.text}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>{ev.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
