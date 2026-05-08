import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
import { RaidBrowser } from '@/components/game/RaidBrowser';

export default async function RaidPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 4 }}>⚔️ RAID BROWSER</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Scout targets, plan your route, steal their loot. Your raid is simulated server-side — no waiting, instant results.
        </p>
      </div>

      {/* Raid mechanics explainer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { step: '01', icon: '🔍', label: 'Scout', desc: 'Pick a target. Higher defense = harder raid.' },
          { step: '02', icon: '🚪', label: 'Breach', desc: 'Your raider enters through their home entrance.' },
          { step: '03', icon: '💰', label: 'Loot', desc: 'Navigate traps, defeat guards, crack vaults.' },
          { step: '04', icon: '🏃', label: 'Escape', desc: 'Get out before time expires. Keep what you carry.' },
        ].map(s => (
          <div key={s.step} className="panel" style={{ padding: 14, borderLeft: '3px solid var(--neon-blue)' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 4 }}>PHASE {s.step}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
              <span style={{ fontWeight: 700, color: 'var(--neon-blue)' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.desc}</div>
          </div>
        ))}
      </div>

      <RaidBrowser />
    </div>
  );
}
