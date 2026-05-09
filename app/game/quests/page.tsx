export const dynamic = 'force-dynamic';

import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
import { QuestBoard } from '@/components/game/QuestBoard';

export default async function QuestsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Cinzel Decorative, Cinzel, serif', fontSize: '1.6rem', marginBottom: 6 }}>
          📜 THE BUILDER'S PATH
        </h1>
        <p className="lore-text" style={{ fontSize: '0.9rem', margin: 0 }}>
          Your destiny in Base is not found — it is built. Five acts. One story. The world is watching.
        </p>
      </div>

      {/* Story progress bar */}
      <div style={{ marginBottom: 24, padding: '14px 20px', background: 'linear-gradient(135deg, #14200c 0%, #1c2c12 100%)', border: '1px solid var(--border-base)', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          {['I', 'II', 'III', 'IV', 'V'].map((act, i) => (
            <div key={act} style={{ textAlign: 'center', flex: 1, position: 'relative' }}>
              {i < 4 && (
                <div style={{ position: 'absolute', top: 14, left: '50%', right: '-50%', height: 2, background: 'var(--border-base)', zIndex: 0 }} />
              )}
              <div style={{
                width: 28, height: 28,
                borderRadius: '50%',
                background: i === 0 ? 'var(--dawn-gold)' : 'var(--bg-raised)',
                border: `2px solid ${i === 0 ? 'var(--dawn-gold)' : 'var(--border-base)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.72rem',
                color: i === 0 ? '#0a0800' : 'var(--text-muted)',
                margin: '0 auto 4px',
                position: 'relative', zIndex: 1,
              }}>
                {act}
              </div>
              <div style={{ fontSize: '0.6rem', color: i === 0 ? 'var(--dawn-gold)' : 'var(--text-muted)', fontFamily: 'Cinzel, serif', letterSpacing: '0.08em' }}>
                {['BEGUN', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED'][i]}
              </div>
            </div>
          ))}
        </div>
      </div>

      <QuestBoard />
    </div>
  );
}
