'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useActionState, useEffect, useState } from 'react';
import { type RegisterActionState, register } from '../actions';

const CLASSES = [
  {
    id: 'warrior',
    name: 'Warrior',
    icon: '⚔️',
    color: '#ff4444',
    tagline: 'Iron fist. Unbreakable defense.',
    stats: { HP: '●●●●●', ATK: '●●●●○', DEF: '●●●●●', SPD: '●●○○○', HACK: '●○○○○' },
    perks: ['Barracks start at Level 2', 'Guards deal +25% damage', 'Wall rooms cost -30%'],
  },
  {
    id: 'mage',
    name: 'Mage',
    icon: '🔮',
    color: '#4488ff',
    tagline: 'Arcane traps. Unstoppable offense.',
    stats: { HP: '●●●○○', ATK: '●●●●●', DEF: '●●○○○', SPD: '●●●○○', HACK: '●●●●○' },
    perks: ['Trap rooms deal +40% damage', 'Alchemy skill +5 bonus', 'Can set magical decoys'],
  },
  {
    id: 'ranger',
    name: 'Ranger',
    icon: '🏹',
    color: '#44cc44',
    tagline: 'Swift raids. Ghost in the Grid.',
    stats: { HP: '●●●○○', ATK: '●●●●○', DEF: '●●●○○', SPD: '●●●●●', HACK: '●●●○○' },
    perks: ['Raid time limit +60 seconds', 'Carry weight +50%', 'Hacking skill +5 bonus'],
  },
];

function StatDots({ value }: { value: string }) {
  return (
    <span style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: '0.8rem' }}>
      {value.split('').map((c, i) => (
        <span key={i} style={{ color: c === '●' ? 'var(--neon-blue)' : 'var(--border-base)' }}>{c}</span>
      ))}
    </span>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [selectedClass, setSelectedClass] = useState('warrior');
  const [characterName, setCharacterName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'account' | 'class'>('account');
  const [accountData, setAccountData] = useState({ email: '', password: '' });

  const [state, formAction] = useActionState<RegisterActionState, FormData>(register, { status: 'idle' });

  useEffect(() => {
    if (state.status === 'user_exists') { setError('Email already in use. Try logging in.'); setLoading(false); }
    else if (state.status === 'failed' || state.status === 'invalid_data') { setError('Failed to create account. Try again.'); setLoading(false); }
    else if (state.status === 'success') { updateSession(); router.push('/game'); }
  }, [state.status, router, updateSession]);

  const selectedClassData = CLASSES.find(c => c.id === selectedClass)!;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-void)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--border-dim) 1px, transparent 1px), linear-gradient(90deg, var(--border-dim) 1px, transparent 1px)', backgroundSize: '60px 60px', opacity: 0.5 }} />
      <div style={{ position: 'absolute', top: '10%', right: '10%', width: 400, height: 400, borderRadius: '50%', background: selectedClassData.color, filter: 'blur(150px)', opacity: 0.04, pointerEvents: 'none', transition: 'background 0.5s' }} />

      <div style={{ width: '100%', maxWidth: step === 'class' ? 700 : 420, position: 'relative', zIndex: 1, transition: 'max-width 0.3s' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="game-title" style={{ fontSize: '1.8rem', marginBottom: 4 }}>BASE HOME</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: 'Share Tech Mono, monospace' }}>
            NEW OPERATIVE REGISTRATION
          </div>
        </div>

        {step === 'account' ? (
          <div className="panel" style={{ padding: 32 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.4rem', marginBottom: 4 }}>Create your operative</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Step 1 of 2 — Account credentials</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Email</label>
              <input
                type="email" required className="input" placeholder="you@example.com"
                value={accountData.email}
                onChange={e => setAccountData(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="input-label">Password</label>
              <input
                type="password" required className="input" placeholder="Min. 8 characters"
                value={accountData.password}
                onChange={e => setAccountData(p => ({ ...p, password: e.target.value }))}
              />
            </div>

            {error && <div style={{ background: '#ff334411', border: '1px solid #ff334433', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: 'var(--neon-red)', fontSize: '0.85rem' }}>{error}</div>}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={!accountData.email || accountData.password.length < 6}
              onClick={() => { setError(''); setStep('class'); }}
            >
              Choose Your Class →
            </button>

            <div style={{ marginTop: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Already have a home?{' '}
              <Link href="/login" style={{ color: 'var(--neon-blue)', textDecoration: 'none', fontWeight: 600 }}>Log in</Link>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep('account')}>← Back</button>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Step 2 of 2 — Choose your operative class</span>
            </div>

            {/* Class cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {CLASSES.map(cls => (
                <div
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  className="panel"
                  style={{
                    padding: 20,
                    cursor: 'pointer',
                    border: `2px solid ${selectedClass === cls.id ? cls.color : 'var(--border-base)'}`,
                    boxShadow: selectedClass === cls.id ? `0 0 20px ${cls.color}33` : 'none',
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                >
                  {selectedClass === cls.id && (
                    <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: cls.color, boxShadow: `0 0 8px ${cls.color}` }} />
                  )}
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{cls.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: cls.color, marginBottom: 4 }}>{cls.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: 16, fontStyle: 'italic' }}>{cls.tagline}</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                    {Object.entries(cls.stats).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', fontSize: '0.68rem' }}>{k}</span>
                        <StatDots value={v} />
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 12 }}>
                    {cls.perks.map((p, i) => (
                      <div key={i} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                        <span style={{ color: cls.color, marginRight: 6 }}>▸</span>{p}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Character name input */}
            <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
              <label className="input-label">Operative Callsign (character name)</label>
              <input
                value={characterName}
                onChange={e => setCharacterName(e.target.value.slice(0, 32))}
                className="input"
                placeholder="e.g. Korrath, Nyxara, Vex_7"
                maxLength={32}
                style={{ fontFamily: 'Share Tech Mono, monospace' }}
              />
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Unique name visible to all players. Max 32 characters.
              </div>
            </div>

            {error && <div style={{ background: '#ff334411', border: '1px solid #ff334433', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: 'var(--neon-red)', fontSize: '0.85rem' }}>{error}</div>}

            <form action={(formData) => { setError(''); setLoading(true); formAction(formData); }}>
              <input type="hidden" name="email" value={accountData.email} />
              <input type="hidden" name="password" value={accountData.password} />
              <input type="hidden" name="characterClass" value={selectedClass} />
              <input type="hidden" name="characterName" value={characterName} />
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading || !characterName.trim()}>
                {loading ? 'Building your home...' : `Deploy as ${selectedClassData.name} → Enter the Grid`}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
