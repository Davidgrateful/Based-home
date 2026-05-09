'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DISTRICT_DEFS, type DistrictDef } from '@/lib/game/districts';

// Biome classification → visual class + terrain description + wildlife
const BIOME_MAP: Record<string, { cls: string; terrain: string; wildlife: string }> = {
  intel:       { cls: 'biome-ruins',    terrain: 'Crumbling alleyways',   wildlife: 'Ravens & shadows' },
  components:  { cls: 'biome-mountain', terrain: 'Iron cliffs',            wildlife: 'Eagles overhead' },
  shards:      { cls: 'biome-volcanic', terrain: 'Scorched wasteland',     wildlife: 'Ash wolves' },
  metal:       { cls: 'biome-ruins',    terrain: 'Industrial wreckage',    wildlife: 'Scrap rats' },
  crystals:    { cls: 'biome-coastal',  terrain: 'Crystal tidal flats',    wildlife: 'Glowing fish' },
  ore:         { cls: 'biome-mountain', terrain: 'Rocky highlands',        wildlife: 'Mountain bears' },
  silver:      { cls: 'biome-plains',   terrain: 'Rolling meadows',        wildlife: 'Deer & foxes' },
  gold:        { cls: 'biome-plains',   terrain: 'Sun-touched fields',     wildlife: 'Hawks & rabbits' },
  alloy:       { cls: 'biome-ruins',    terrain: 'Fortified ruins',        wildlife: 'War hounds' },
  knowledge:   { cls: 'biome-neutral',  terrain: 'Ancient stone halls',    wildlife: 'Owls' },
  fish:        { cls: 'biome-coastal',  terrain: 'Misty docklands',        wildlife: 'Herons & fish' },
  food:        { cls: 'biome-forest',   terrain: 'Cultivated farmland',    wildlife: 'Songbirds' },
  scrap:       { cls: 'biome-ruins',    terrain: 'Junkyard sprawl',        wildlife: 'Wild dogs' },
  goods:       { cls: 'biome-plains',   terrain: 'Cobbled market roads',   wildlife: 'Pigeons & merchants' },
  contraband:  { cls: 'biome-swamp',    terrain: 'Hidden marsh paths',     wildlife: 'Silent predators' },
  copper:      { cls: 'biome-mountain', terrain: 'Ore-rich highlands',     wildlife: 'Mountain goats' },
  mixed:       { cls: 'biome-forest',   terrain: 'Neutral border lands',   wildlife: 'All kinds' },
  circuits:    { cls: 'biome-ruins',    terrain: 'Neon-lit ruins',         wildlife: 'Tech scavengers' },
  trophies:    { cls: 'biome-plains',   terrain: 'Arena grounds',          wildlife: 'Battle-bred wolves' },
};

const WAR_STATES = {
  peace:     { dot: 'var(--leaf-green)', warClass: '' },
  contested: { dot: 'var(--firelight)',  warClass: 'contested' },
  war:       { dot: 'var(--blood-red)',  warClass: 'at-war' },
};

const MOCK_OWNERS: Record<string, string> = {
  'vault-district': 'Iron Vanguard',
  'neon-quarter':   'The Accord',
  'colosseum':      'Blood & Glory',
  'blacksite':      'Shadow Pact',
};
const MOCK_WARS: Record<string, 'peace' | 'contested' | 'war'> = {
  'foundry':        'war',
  'vault-district': 'contested',
  'circuit-gate':   'contested',
};

function DistrictCard({ d, selected, onClick }: { d: DistrictDef; selected: boolean; onClick: () => void }) {
  const biome  = BIOME_MAP[d.resourceType] ?? { cls: 'biome-neutral', terrain: 'Unknown', wildlife: 'Unknown' };
  const warKey = MOCK_WARS[d.slug] ?? 'peace';
  const war    = WAR_STATES[warKey];
  const owner  = MOCK_OWNERS[d.slug] ?? 'Unclaimed';

  return (
    <div
      className={`district-tile ${biome.cls} ${war.warClass}`}
      onClick={onClick}
      style={{
        border: `${selected ? 2 : 1}px solid ${selected ? d.color : 'var(--border-base)'}`,
        boxShadow: selected ? `0 0 24px ${d.color}44, 0 8px 32px rgba(0,0,0,0.6)` : undefined,
        transform: selected ? 'translateY(-4px) scale(1.02)' : undefined,
        transition: 'all 0.22s',
      }}
    >
      {/* gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.75) 100%)', pointerEvents: 'none', zIndex: 1 }} />

      {/* District icon */}
      <div style={{ position: 'absolute', top: 9, left: 9, fontSize: '1.5rem', zIndex: 2, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
        {d.icon}
      </div>

      {/* War dot */}
      {warKey !== 'peace' && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 3, width: 8, height: 8, borderRadius: '50%', background: war.dot, animation: warKey === 'war' ? 'war-pulse 1s ease-in-out infinite' : undefined }} />
      )}

      {/* Name + owner */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.7rem', color: '#fff', lineHeight: 1.2, marginBottom: 2, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
          {d.name}
        </div>
        <div style={{ fontSize: '0.58rem', fontFamily: 'Share Tech Mono, monospace', color: owner === 'Unclaimed' ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.65)', fontStyle: owner === 'Unclaimed' ? 'italic' : 'normal' }}>
          {owner === 'Unclaimed' ? '— unclaimed —' : owner}
        </div>
      </div>
    </div>
  );
}

function DistrictDetail({ d }: { d: DistrictDef }) {
  const biome  = BIOME_MAP[d.resourceType] ?? { cls: '', terrain: 'Unknown', wildlife: 'Unknown' };
  const warKey = MOCK_WARS[d.slug] ?? 'peace';
  const owner  = MOCK_OWNERS[d.slug] ?? 'Unclaimed';

  return (
    <div className="panel animate-slide-in" style={{ position: 'sticky', top: 16 }}>
      {/* Biome header */}
      <div style={{
        padding: '20px 20px 16px',
        background: `linear-gradient(135deg, ${d.bgColor} 0%, #131a0e 100%)`,
        borderBottom: '1px solid var(--border-base)',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 80% 50%, ${d.color}22 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '2.4rem', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }}>{d.icon}</div>
          <div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: 3 }}>{d.name}</div>
            <div style={{ fontSize: '0.65rem', color: d.color, fontFamily: 'Cinzel, serif', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {d.resourceType.replace(/_/g, ' ')} territory
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="lore-text" style={{ fontSize: '0.84rem', margin: 0 }}>"{d.lore}"</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[{ title: 'Terrain', val: biome.terrain }, { title: 'Wildlife', val: biome.wildlife }].map(r => (
            <div key={r.title} style={{ background: 'var(--bg-raised)', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
              <div className="lore-title" style={{ marginBottom: 3 }}>{r.title}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontFamily: 'Lora, serif' }}>{r.val}</div>
            </div>
          ))}
        </div>

        <div>
          {[
            { label: 'Controlled by', value: owner, color: owner === 'Unclaimed' ? 'var(--text-muted)' : 'var(--dawn-gold)' },
            { label: 'War state', value: warKey === 'peace' ? '🕊️ Peaceful' : warKey === 'contested' ? '⚡ Contested' : '🔥 At War', color: warKey === 'peace' ? 'var(--leaf-green)' : warKey === 'contested' ? 'var(--firelight)' : 'var(--blood-red)' },
            { label: 'Territory buff', value: d.defaultBuff.label, color: 'var(--river-blue)' },
            { label: 'Access', value: d.minLevel === 0 ? 'Open to all' : `Level ${d.minLevel}+`, color: 'var(--text-secondary)' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '5px 0', borderBottom: '1px solid var(--border-dim)' }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{r.label}</span>
              <span style={{ color: r.color, fontWeight: 600, fontFamily: 'Share Tech Mono, monospace', fontSize: '0.76rem' }}>{r.value}</span>
            </div>
          ))}
        </div>

        <Link href="/game/raid" className="btn btn-danger btn-sm" style={{ justifyContent: 'center' }}>
          ⚔️ Raid this territory
        </Link>
      </div>
    </div>
  );
}

const FILTERS = [
  { id: 'all', label: '🗺️ All Territories' },
  { id: 'war', label: '🔥 At War' },
  { id: 'unclaimed', label: '🏴 Unclaimed' },
  { id: 'forest', label: '🌲 Forest / Plains' },
  { id: 'mountain', label: '⛰️ Mountain' },
  { id: 'coastal', label: '🌊 Coastal / Swamp' },
];

export function WorldMapClient() {
  const [selected, setSelected] = useState<DistrictDef | null>(null);
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? DISTRICT_DEFS : DISTRICT_DEFS.filter(d => {
    if (filter === 'war')       return MOCK_WARS[d.slug] === 'war' || MOCK_WARS[d.slug] === 'contested';
    if (filter === 'unclaimed') return !MOCK_OWNERS[d.slug];
    const biome = BIOME_MAP[d.resourceType]?.cls ?? '';
    if (filter === 'forest')   return biome.includes('forest') || biome.includes('plains');
    if (filter === 'mountain') return biome.includes('mountain') || biome.includes('volcanic');
    if (filter === 'coastal')  return biome.includes('coastal') || biome.includes('swamp');
    return true;
  });

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontFamily: 'Lora, serif', fontSize: '0.78rem', textTransform: 'none', letterSpacing: '0.02em', fontStyle: 'normal' }}
          >
            {f.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
          {filtered.length} / {DISTRICT_DEFS.length}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 300px' : '1fr', gap: 20, alignItems: 'flex-start' }}>
        {/* Map */}
        <div>
          <div className="world-map" style={{ padding: 0, gap: 8 }}>
            {DISTRICT_DEFS.map(d => {
              const visible = filtered.find(f => f.slug === d.slug);
              return (
                <DistrictCard
                  key={d.slug}
                  d={d}
                  selected={selected?.slug === d.slug}
                  onClick={() => setSelected(selected?.slug === d.slug ? null : d)}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
            {[
              { dot: 'var(--leaf-green)', label: 'Peaceful' },
              { dot: 'var(--firelight)',  label: 'Contested' },
              { dot: 'var(--blood-red)',  label: 'At War' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Lora, serif' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.dot, flexShrink: 0 }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        {selected && <DistrictDetail d={selected} />}
      </div>
    </div>
  );
}
