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
      setError('Unknown traveler. Check your credentials.');
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
      {/* Forest silhouette background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 100%, #1a2e0e 0%, #0b1008 50%, #060a05 100%)',
      }} />
      {/* Tree line silhouette */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%',
        background: 'linear-gradient(0deg, #0d1a09 0%, transparent 100%)',
        clipPath: 'polygon(0 100%, 0 60%, 3% 30%, 5% 60%, 8% 20%, 11% 60%, 14% 35%, 17% 55%, 20% 15%, 23% 50%, 26% 25%, 28% 55%, 31% 10%, 34% 45%, 37% 20%, 40% 50%, 43% 30%, 46% 55%, 49% 5%, 52% 40%, 55% 20%, 58% 50%, 61% 25%, 64% 55%, 67% 10%, 70% 45%, 73% 20%, 76% 50%, 79% 30%, 82% 55%, 85% 15%, 88% 50%, 91% 25%, 94% 55%, 97% 30%, 100% 50%, 100% 100%)',
      }} />
      {/* Atmosphere glows */}
      <div style={{ position: 'absolute', top: '25%', left: '10%', width: 400, height: 400, borderRadius: '50%', background: '#2d5c1a', filter: 'blur(160px)', opacity: 0.12, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '30%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: '#c8983a', filter: 'blur(160px)', opacity: 0.07, pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="game-title" style={{ fontSize: '2.4rem', marginBottom: 6 }}>BASE</div>
          <p style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            A world fractured. A people divided.<br />Your legend begins now.
          </p>
        </div>

        {/* Panel */}
        <div className="panel" style={{ padding: 32, backdropFilter: 'blur(4px)' }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.3rem', marginBottom: 6 }}>
              Return, Survivor
            </h2>
            <p style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              The world of Base remembers your deeds.
            </p>
          </div>

          <form action={(formData) => { setError(''); setLoading(true); formAction(formData); }}>
            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Email</label>
              <input name="email" type="email" required className="input" placeholder="your@email.com" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="input-label">Password</label>
              <input name="password" type="password" required className="input" placeholder="••••••••" />
            </div>

            {error && (
              <div style={{ background: 'rgba(200,56,40,0.08)', border: '1px solid rgba(200,56,40,0.3)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: 'var(--blood-red)', fontSize: '0.85rem', fontFamily: 'Lora, serif' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Entering the world...' : 'Enter the World →'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'Lora, serif' }}>
            First time in Base?{' '}
            <Link href="/register" style={{ color: 'var(--dawn-gold)', textDecoration: 'none', fontWeight: 600 }}>
              Begin your journey
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: '0.68rem', letterSpacing: '0.15em', fontFamily: 'Cinzel, serif' }}>
          SEASON OF RECKONING — 87 DAYS REMAIN
        </div>
      </div>
    </div>
  );
}
