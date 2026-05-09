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
    color: '#c84838',
    tagline: 'Born from battle. Built to endure.',
    lore: 'Scarred by years of faction wars, Warriors are the backbone of any settlement. They build the walls that keep the darkness out — and tear down the ones that stand in their way.',
    stats: { Vitality: '●●●●●', Strength: '●●●●○', Defense: '●●●●●', Speed: '●●○○○', Cunning: '●○○○○' },
    perks: ['Barracks start at Level 2', 'Guards deal +25% damage in raids', 'Stone walls cost 30% less to build'],
  },
  {
    id: 'mage',
    name: 'Mage',
    icon: '🔮',
    color: '#4870b8',
    tagline: 'Ancient knowledge. Dangerous power.',
    lore: 'Students of the lost arcane arts, Mages recovered forbidden knowledge from the ruins of the old world. Their traps are invisible. Their strikes are devastating. Few see them coming.',
    stats: { Vitality: '●●●○○', Strength: '●●●●●', Defense: '●●○○○', Speed: '●●●○○', Cunning: '●●●●○' },
    perks: ['Trap rooms deal +40% damage', 'Alchemy skill starts at +5', 'Can place magical decoy vaults'],
  },
  {
    id: 'ranger',
    name: 'Ranger',
    icon: '🏹',
    color: '#5aa832',
    tagline: 'Unseen. Unheard. Unstoppable.',
    lore: 'Forged in the wild lands beyond the districts, Rangers lived alone long before civilization crumbled. They move fast, carry much, and strike before the target even knows they are there.',
    stats: { Vitality: '●●●○○', Strength: '●●●●○', Defense: '●●●○○', Speed: '●●●●●', Cunning: '●●●○○' },
    perks: ['Raid time limit +60 seconds', 'Can carry 50% more loot', 'Hacking skill starts at +5'],
  },
];

function StatDots({ value, color }: { value: string; color: string }) {
  return (
    <span style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: '0.8rem' }}>
      {value.split('').map((c, i) => (
        <span key={i} style={{ color: c === '●' ? color : 'var(--border-base)' }}>{c}</span>
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
      {/* Forest world background */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 100%, #1a2e0e 0%, #0b1008 50%, #060a05 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(0deg, #0d1a09 0%, transparent 100%)', clipPath: 'polygon(0 100%, 0 60%, 3% 30%, 5% 60%, 8% 20%, 11% 60%, 14% 35%, 17% 55%, 20% 15%, 23% 50%, 26% 25%, 28% 55%, 31% 10%, 34% 45%, 37% 20%, 40% 50%, 43% 30%, 46% 55%, 49% 5%, 52% 40%, 55% 20%, 58% 50%, 61% 25%, 64% 55%, 67% 10%, 70% 45%, 73% 20%, 76% 50%, 79% 30%, 82% 55%, 85% 15%, 88% 50%, 91% 25%, 94% 55%, 97% 30%, 100% 50%, 100% 100%)' }} />
      <div style={{ position: 'absolute', top: '15%', right: '10%', width: 400, height: 400, borderRadius: '50%', background: selectedClassData.color, filter: 'blur(180px)', opacity: 0.06, pointerEvents: 'none', transition: 'background 0.6s' }} />
      <div style={{ position: 'absolute', top: '20%', left: '8%', width: 300, height: 300, borderRadius: '50%', background: '#2d5c1a', filter: 'blur(160px)', opacity: 0.1, pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: step === 'class' ? 740 : 420, position: 'relative', zIndex: 1, transition: 'max-width 0.35s' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="game-title" style={{ fontSize: '2rem', marginBottom: 6 }}>BASE</div>
          <p style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            Begin your journey. Claim your place in the world.
          </p>
        </div>

        {step === 'account' ? (
          <div className="panel" style={{ padding: 32 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.3rem', marginBottom: 6 }}>Create Your Account</h2>
              <p style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Step 1 of 2 — Your identity in Base</p>
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

            {error && <div style={{ background: 'rgba(200,56,40,0.08)', border: '1px solid rgba(200,56,40,0.3)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: 'var(--blood-red)', fontSize: '0.85rem', fontFamily: 'Lora, serif' }}>{error}</div>}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={!accountData.email || accountData.password.length < 6}
              onClick={() => { setError(''); setStep('class'); }}
            >
              Choose Your Path →
            </button>

            <div style={{ marginTop: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'Lora, serif' }}>
              Already a survivor?{' '}
              <Link href="/login" style={{ color: 'var(--dawn-gold)', textDecoration: 'none', fontWeight: 600 }}>Return to Base</Link>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep('account')}>← Back</button>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'Lora, serif', fontStyle: 'italic' }}>Step 2 of 2 — Choose your path in Base</span>
            </div>

            {/* Class cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {CLASSES.map(cls => (
                <div
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  className="panel"
                  style={{
                    padding: 20,
                    cursor: 'pointer',
                    border: `2px solid ${selectedClass === cls.id ? cls.color : 'var(--border-base)'}`,
                    boxShadow: selectedClass === cls.id ? `0 0 24px ${cls.color}33, 0 4px 20px rgba(0,0,0,0.5)` : 'none',
                    transition: 'all 0.22s',
                    position: 'relative',
                    background: selectedClass === cls.id ? `linear-gradient(135deg, ${cls.color}08 0%, var(--bg-surface) 100%)` : undefined,
                  }}
                >
                  {selectedClass === cls.id && (
                    <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: cls.color, boxShadow: `0 0 10px ${cls.color}` }} />
                  )}
                  <div style={{ fontSize: 30, marginBottom: 8 }}>{cls.icon}</div>
                  <div style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1rem', color: cls.color, marginBottom: 3 }}>{cls.name}</div>
                  <div style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.76rem', marginBottom: 10 }}>{cls.tagline}</div>
                  <p style={{ fontFamily: 'Lora, serif', fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{cls.lore}</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                    {Object.entries(cls.stats).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'Cinzel, serif', fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{k}</span>
                        <StatDots value={v} color={cls.color} />
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 10 }}>
                    {cls.perks.map((p, i) => (
                      <div key={i} style={{ fontFamily: 'Lora, serif', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.4 }}>
                        <span style={{ color: cls.color, marginRight: 5 }}>▸</span>{p}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Character name input */}
            <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
              <label className="input-label">Survivor Name</label>
              <input
                value={characterName}
                onChange={e => setCharacterName(e.target.value.slice(0, 32))}
                className="input"
                placeholder="e.g. Korrath, Nyxara, Vex"
                maxLength={32}
                style={{ fontFamily: 'Cinzel, serif' }}
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
                {loading ? 'Entering the world...' : `Begin as ${selectedClassData.name} → Enter Base`}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
