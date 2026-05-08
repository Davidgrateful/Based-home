'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const NAV = [
  { href: '/game',             icon: '🌐', label: 'World Map' },
  { href: '/game/home',        icon: '🏠', label: 'My Home' },
  { href: '/game/raid',        icon: '⚔️',  label: 'Raid' },
  { href: '/game/leaderboard', icon: '🏆', label: 'Leaderboard' },
  { href: '/game/guild',       icon: '🛡️',  label: 'Guild' },
  { href: '/game/market',      icon: '💰', label: 'Market' },
  { href: '/game/profile',     icon: '👤', label: 'Profile' },
];

interface Props { userId: string; userName: string; }

export function GameSidebar({ userId, userName }: Props) {
  const pathname = usePathname();

  return (
    <nav className="nav-sidebar">
      {/* Logo */}
      <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid var(--border-base)' }}>
        <div className="game-title" style={{ fontSize: '1.1rem' }}>BASE HOME</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.6rem', letterSpacing: '0.2em', fontFamily: 'Share Tech Mono, monospace' }}>
          DISTRICT WARS
        </div>
      </div>

      {/* Nav links */}
      <div style={{ flex: 1, paddingTop: 8 }}>
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${pathname === item.href || (item.href !== '/game' && pathname.startsWith(item.href)) ? ' active' : ''}`}
          >
            <span style={{ fontSize: '1rem', width: 20, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      {/* Season badge */}
      <div style={{ margin: '0 12px 12px', background: '#1a1200', border: '1px solid #ffcc0033', borderRadius: 6, padding: '8px 10px' }}>
        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.15em', fontFamily: 'Share Tech Mono, monospace' }}>SEASON 1</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--neon-gold)', fontWeight: 600 }}>The Grid Awakens</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>87 days remaining</div>
      </div>

      {/* User footer */}
      <div style={{ borderTop: '1px solid var(--border-base)', padding: '12px 16px' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {userName}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'flex-start', padding: '5px 4px', color: 'var(--text-muted)', fontSize: '0.78rem' }}
        >
          ← Exit Grid
        </button>
      </div>
    </nav>
  );
}
