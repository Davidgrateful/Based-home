'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useActionState, useEffect, useState } from 'react';
import { type LoginActionState, login } from '../actions';

export default function LoginPage() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [state, formAction] = useActionState<LoginActionState, FormData>(login, { status: 'idle' });

  useEffect(() => {
    if (state.status === 'failed' || state.status === 'invalid_data') {
      setError('Invalid credentials. Check your email and password.');
      setLoading(false);
    } else if (state.status === 'success') {
      updateSession();
      router.push('/game');
    }
  }, [state.status, router, updateSession]);

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
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(var(--border-dim) 1px, transparent 1px), linear-gradient(90deg, var(--border-dim) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        opacity: 0.5,
      }} />

      {/* Glow orbs */}
      <div style={{ position: 'absolute', top: '20%', left: '15%', width: 300, height: 300, borderRadius: '50%', background: '#4488ff', filter: 'blur(120px)', opacity: 0.06, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: 250, height: 250, borderRadius: '50%', background: '#8844ff', filter: 'blur(120px)', opacity: 0.06, pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="game-title" style={{ fontSize: '2rem', marginBottom: 8 }}>BASE HOME</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: 'Share Tech Mono, monospace' }}>
            DISTRICT WARS
          </div>
        </div>

        {/* Panel */}
        <div className="panel" style={{ padding: 32 }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.4rem', marginBottom: 4 }}>Welcome back, Operative</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Log in to access your home and the Grid.</p>
          </div>

          <form action={(formData) => { setError(''); setLoading(true); formAction(formData); }}>
            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Email</label>
              <input name="email" type="email" required className="input" placeholder="you@example.com" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="input-label">Password</label>
              <input name="password" type="password" required className="input" placeholder="••••••••" />
            </div>

            {error && (
              <div style={{ background: '#ff334411', border: '1px solid #ff334433', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: 'var(--neon-red)', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Authenticating...' : 'Enter the Grid →'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            New operative?{' '}
            <Link href="/register" style={{ color: 'var(--neon-blue)', textDecoration: 'none', fontWeight: 600 }}>
              Create your home
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.1em', fontFamily: 'Share Tech Mono, monospace' }}>
          SEASON 1 — THE GRID AWAKENS
        </div>
      </div>
    </div>
  );
}
