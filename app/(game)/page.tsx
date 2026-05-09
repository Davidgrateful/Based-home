import { auth } from '@/app/(auth)/auth';
import { WorldMapClient } from '@/components/game/WorldMapClient';
import { WorldEventsFeed } from '@/components/game/WorldEventsFeed';

export default async function GamePage() {
  const session = await auth();

  return (
    <div style={{ padding: 24 }}>

      {/* ── Lore banner ── */}
      <div className="lore-banner" style={{ marginBottom: 24 }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="lore-title" style={{ marginBottom: 6 }}>Chronicles of Base</div>
          <p className="lore-text" style={{ fontSize: '0.92rem', margin: 0, maxWidth: 680 }}>
            Long ago, the world of Base thrived under an age of builders and dreamers.
            Then greed, faction wars, and corrupted technology shattered civilization.
            Now the survivors fight over what remains — land, ancient relics, and power.
            <strong style={{ color: 'var(--text-primary)', fontStyle: 'normal' }}> Your legend starts here.</strong>
          </p>
        </div>
      </div>

      {/* ── World stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { icon: '🌍', label: 'Survivors Online', value: '247', color: 'var(--leaf-green)' },
          { icon: '⚔️', label: 'Raids Today',      value: '1,843', color: 'var(--blood-red)' },
          { icon: '🔥', label: 'Active Wars',      value: '3',    color: 'var(--firelight)' },
          { icon: '🏴', label: 'Unclaimed Lands',  value: '15',   color: 'var(--dawn-gold)' },
        ].map(s => (
          <div key={s.label} className="world-stat-card">
            <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{s.icon}</div>
            <div className="stat-label" style={{ marginBottom: 4 }}>{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── World header ── */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{
          fontFamily: 'Cinzel Decorative, Cinzel, serif',
          fontSize: '1.4rem',
          background: 'linear-gradient(135deg, #e8dfc8 0%, #c8983a 60%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 4,
        }}>
          THE WORLD OF BASE
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'Lora, serif', fontStyle: 'italic', margin: 0 }}>
          20 territories. Click any district to learn its secrets, scout its dangers, or plan your raid.
        </p>
      </div>

      {/* ── Map + events ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'flex-start' }}>
        <WorldMapClient />
        <WorldEventsFeed />
      </div>
    </div>
  );
}
