'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/game',             icon: '🗺️', label: 'World Map',   desc: 'Explore Base' },
  { href: '/game/home',        icon: '🏡', label: 'Settlement',  desc: 'Your home' },
  { href: '/game/raid',        icon: '⚔️', label: 'Raid',        desc: 'Hunt & plunder' },
  { href: '/game/quests',      icon: '📜', label: 'Quests',      desc: "The Builder's Path" },
  { href: '/game/leaderboard', icon: '🏆', label: 'Chronicle',   desc: 'Season rankings' },
  { href: '/game/guild',       icon: '🛡️', label: 'Guild',       desc: 'Your faction' },
  { href: '/game/market',      icon: '🧺', label: 'Market',      desc: 'Trade & barter' },
  { href: '/game/profile',     icon: '📖', label: 'Profile',     desc: 'Survivor record' },
];

const CLASS_ICONS: Record<string, string> = { warrior: '⚔️', mage: '🔮', ranger: '🏹' };
const CLASS_COLORS: Record<string, string> = {
  warrior: 'var(--class-warrior)',
  mage:    'var(--class-mage)',
  ranger:  'var(--class-ranger)',
};

interface CharSummary {
  name: string;
  class: string;
  level: number;
  xp: number;
  gold: number;
}

function xpForLevel(lvl: number) { return Math.floor(100 * Math.pow(1.4, lvl - 1)); }

function WorldTimeIndicator() {
  const [hour, setHour] = useState(new Date().getHours());
  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours()), 60000);
    return () => clearInterval(t);
  }, []);
  const isDawn  = hour >= 5  && hour < 8;
  const isDay   = hour >= 8  && hour < 17;
  const isDusk  = hour >= 17 && hour < 20;
  const isNight = !isDawn && !isDay && !isDusk;
  const icon  = isDawn ? '🌅' : isDay ? '☀️' : isDusk ? '🌆' : '🌙';
  const label = isDawn ? 'Dawn' : isDay ? 'Daylight' : isDusk ? 'Dusk' : 'Night';
  const col   = isDawn ? '#c8983a' : isDay ? '#e8c870' : isDusk ? '#d46828' : '#6880a8';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
      <span>{icon}</span>
      <span style={{ color: col, fontFamily: 'Share Tech Mono, monospace' }}>{label}</span>
    </div>
  );
}

interface Props { userId: string; userName: string; }

export function GameSidebar({ userId, userName }: Props) {
  const pathname = usePathname();
  const [char, setChar] = useState<CharSummary | null>(null);

  useEffect(() => {
    fetch('/api/character').then(r => r.json()).then(d => {
      if (d.character) setChar(d.character);
    }).catch(() => {});
  }, []);

  const xpPct = char ? Math.min(100, (char.xp / xpForLevel(char.level)) * 100) : 0;

  return (
    <nav className="nav-sidebar">

      {/* ── Brand ── */}
      <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--border-base)', position: 'relative' }}>
        <div className="game-title" style={{ fontSize: '1.3rem', marginBottom: 2 }}>BASE</div>
        <div style={{
          fontFamily: 'Lora, serif',
          fontStyle: 'italic',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          letterSpacing: '0.04em',
        }}>
          A world reborn from ruin
        </div>
      </div>

      {/* ── Character card ── */}
      {char ? (
        <div style={{
          margin: '10px 10px 0',
          padding: '12px',
          background: 'linear-gradient(135deg, #131a0e 0%, #1a2414 100%)',
          border: '1px solid var(--border-base)',
          borderRadius: 'var(--radius-lg)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 60, height: 60,
            background: `radial-gradient(circle, ${CLASS_COLORS[char.class] ?? '#5aa832'}22 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{
              width: 38, height: 38,
              borderRadius: '50%',
              background: `${CLASS_COLORS[char.class] ?? '#5aa832'}18`,
              border: `2px solid ${CLASS_COLORS[char.class] ?? '#5aa832'}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', flexShrink: 0,
            }}>
              {CLASS_ICONS[char.class] ?? '⚔️'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: 'Cinzel, serif',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{char.name}</div>
              <div style={{ fontSize: '0.7rem', color: CLASS_COLORS[char.class] ?? 'var(--leaf-green)', marginTop: 1, textTransform: 'capitalize' }}>
                {char.class} · Lv {char.level}
              </div>
            </div>
          </div>
          {/* XP bar */}
          <div style={{ marginBottom: 6 }}>
            <div className="progress-bar" style={{ height: 3 }}>
              <div className="progress-fill progress-xp" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
          {/* Gold */}
          <div style={{ fontSize: '0.72rem', color: 'var(--dawn-gold)', fontFamily: 'Share Tech Mono, monospace' }}>
            💰 {char.gold.toLocaleString()}g
          </div>
        </div>
      ) : (
        <div style={{ margin: '10px 10px 0', padding: '10px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: 'var(--radius)', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'Lora, serif' }}>
          No character yet...
        </div>
      )}

      {/* ── Nav links ── */}
      <div style={{ flex: 1, paddingTop: 8 }}>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/game' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`nav-item${active ? ' active' : ''}`}>
              <span style={{ fontSize: '1rem', width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ── World status ── */}
      <div style={{ margin: '0 10px 8px' }}>
        <div style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-dim)',
          borderRadius: 'var(--radius)',
          padding: '8px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <WorldTimeIndicator />
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
            BASE
          </div>
        </div>
      </div>

      {/* ── Season badge ── */}
      <div style={{ margin: '0 10px 8px' }} className="season-banner">
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--dawn-gold)', textTransform: 'uppercase', marginBottom: 2 }}>
          Season of Reckoning
        </div>
        <div style={{ fontFamily: 'Lora, serif', fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          The world remembers
        </div>
        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>
          87 days remaining
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ borderTop: '1px solid var(--border-dim)', padding: '10px 14px' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'Share Tech Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {userName}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'flex-start', padding: '4px 2px', color: 'var(--text-muted)', fontSize: '0.75rem' }}
        >
          ↩ Leave the World
        </button>
      </div>
    </nav>
  );
}
