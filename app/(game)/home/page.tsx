'use client';

import { useEffect, useState } from 'react';
import { HomeBuilder } from '@/components/game/HomeBuilder';
import { emptyLayout, type RoomCell } from '@/lib/game/homeRooms';

interface HomeData {
  id: string;
  name: string;
  layout: RoomCell[][];
  unlockedSize: number;
  defenseRating: number;
  prestigeScore: number;
  resourceGold: number;
  resourceMaterials: number;
  totalTimesRaided: number;
  totalVisits: number;
  lastRaidedAt: string | null;
}

interface CharData {
  id: string;
  name: string;
  level: number;
  gold: number;
  class: string;
  honor: number;
  infamy: number;
}

export default function HomePage() {
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [charData, setCharData] = useState<CharData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState('');
  const [tab, setTab] = useState<'build' | 'overview'>('build');

  useEffect(() => {
    Promise.all([
      fetch('/api/home').then(r => r.json()),
      fetch('/api/character').then(r => r.json()),
    ]).then(([hd, cd]) => {
      setHomeData(hd.home);
      setCharData(cd.character);
      setLoading(false);
    });
  }, []);

  const handleSave = async (layout: RoomCell[], cost: number) => {
    const res = await fetch('/api/home', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout }),
    });
    if (res.ok) {
      const data = await res.json();
      setSaveMsg(`✅ Saved! DEF: ${data.defenseRating} | Prestige: ${data.prestigeScore}`);
      setHomeData(prev => prev ? { ...prev, defenseRating: data.defenseRating, prestigeScore: data.prestigeScore, layout } : prev);
      if (charData && cost > 0) setCharData(prev => prev ? { ...prev, gold: prev.gold - cost } : prev);
      setTimeout(() => setSaveMsg(''), 4000);
    }
  };

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
      Loading your home...
    </div>
  );

  if (!homeData || !charData) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: '1.2rem', marginBottom: 12, color: 'var(--neon-red)' }}>No home found.</div>
      <p style={{ color: 'var(--text-secondary)' }}>Create a character first to get your home.</p>
    </div>
  );

  const layout = homeData.layout?.length ? homeData.layout : emptyLayout(homeData.unlockedSize);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: 4 }}>
            🏠 {homeData.name}
          </h1>
          <div style={{ display: 'flex', gap: 20, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <span>🛡️ Defense <strong style={{ color: 'var(--neon-blue)' }}>{homeData.defenseRating}</strong></span>
            <span>✨ Prestige <strong style={{ color: 'var(--neon-gold)' }}>{homeData.prestigeScore}</strong></span>
            <span>⚔️ Raided <strong style={{ color: 'var(--neon-red)' }}>{homeData.totalTimesRaided}×</strong></span>
            <span>👁️ Visited <strong>{homeData.totalVisits}×</strong></span>
          </div>
        </div>
        <div className="panel" style={{ padding: '8px 16px', textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>YOUR GOLD</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--neon-gold)' }}>
            💰 {charData.gold.toLocaleString()}g
          </div>
        </div>
      </div>

      {/* Shield warning if recently raided */}
      {homeData.lastRaidedAt && (() => {
        const h = (Date.now() - new Date(homeData.lastRaidedAt).getTime()) / 3600000;
        if (h < 8) return (
          <div style={{ marginBottom: 16, padding: '10px 16px', background: '#4488ff11', border: '1px solid #4488ff33', borderRadius: 6, fontSize: '0.85rem', color: 'var(--neon-blue)' }}>
            🛡️ Shield active — you cannot be raided for another {Math.ceil(8 - h)}h after your last raid.
          </div>
        );
        return null;
      })()}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border-base)', paddingBottom: 12 }}>
        {(['build', 'overview'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            style={{ textTransform: 'capitalize' }}
          >
            {t === 'build' ? '🔨 Builder' : '📊 Overview'}
          </button>
        ))}
        {saveMsg && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', fontSize: '0.82rem', color: 'var(--neon-green)' }}>
            {saveMsg}
          </div>
        )}
      </div>

      {tab === 'build' ? (
        <>
          <div style={{ marginBottom: 16, padding: '10px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-base)', borderRadius: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Builder Tips:</strong>{' '}
            Click or drag to place rooms. Place <strong>Vaults</strong> deep inside — raiders enter from the 🚪 Entrance.
            Use <strong>Traps</strong> and <strong>Decoy Vaults</strong> to mislead and punish.
            Unlocked area: <strong style={{ color: 'var(--neon-blue)' }}>{homeData.unlockedSize}×{homeData.unlockedSize}</strong>
            {' '}(upgrade Architecture skill to expand).
          </div>
          <HomeBuilder
            initialLayout={layout as any}
            unlockedSize={homeData.unlockedSize}
            gold={charData.gold}
            onSave={handleSave as any}
          />
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { label: 'Defense Rating', value: homeData.defenseRating, icon: '🛡️', color: 'var(--neon-blue)', desc: 'Higher = harder to raid successfully' },
            { label: 'Prestige Score', value: homeData.prestigeScore, icon: '✨', color: 'var(--neon-gold)', desc: 'Social status from trophies and upgrades' },
            { label: 'Stored Gold', value: `${homeData.resourceGold}g`, icon: '💰', color: 'var(--neon-gold)', desc: 'Raiders can steal this if they reach your vault' },
            { label: 'Materials', value: homeData.resourceMaterials, icon: '⚙️', color: 'var(--neon-cyan)', desc: 'Crafting materials stored in your home' },
            { label: 'Times Raided', value: homeData.totalTimesRaided, icon: '⚔️', color: 'var(--neon-red)', desc: 'How many times raiders have attempted your home' },
            { label: 'Visitor Count', value: homeData.totalVisits, icon: '👁️', color: 'var(--neon-green)', desc: 'Players who have visited your home' },
          ].map(stat => (
            <div key={stat.label} className="panel" style={{ padding: 20 }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 4 }}>{stat.label.toUpperCase()}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>{stat.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
