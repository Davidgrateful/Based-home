import { auth } from '@/app/(auth)/auth';
import { WorldMapClient } from '@/components/game/WorldMapClient';

export default async function GamePage() {
  const session = await auth();

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', marginBottom: 4 }}>THE GRID</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              20 districts. One persistent world. Click a district to inspect, raid, or claim territory.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="panel" style={{ padding: '8px 16px', display: 'flex', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.15em', fontFamily: 'Share Tech Mono, monospace' }}>ONLINE</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--neon-green)' }}>247</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.15em', fontFamily: 'Share Tech Mono, monospace' }}>RAIDS TODAY</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--neon-red)' }}>1,843</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.15em', fontFamily: 'Share Tech Mono, monospace' }}>WARS ACTIVE</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--neon-orange)' }}>3</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <WorldMapClient userId={session?.user?.id ?? ''} />
    </div>
  );
}
