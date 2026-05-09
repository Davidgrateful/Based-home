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

function getSettlementTier(prestige: number): { tier: string; next: number; color: string } {
  if (prestige >= 5000) return { tier: 'Legendary Stronghold', next: 0, color: '#c8983a' };
  if (prestige >= 2000) return { tier: 'Fortified Citadel', next: 5000, color: '#a870e8' };
  if (prestige >= 800)  return { tier: 'Established Town', next: 2000, color: '#4a8ab8' };
  if (prestige >= 250)  return { tier: 'Growing Camp', next: 800, color: '#5aa832' };
  if (prestige >= 50)   return { tier: 'Humble Outpost', next: 250, color: '#8a9878' };
  return { tier: 'Abandoned Ruin', next: 50, color: '#6a6858' };
}

function getMood(lastRaidedAt: string | null, defenseRating: number): { label: string; cls: string; desc: string; icon: string } {
  if (lastRaidedAt) {
    const h = (Date.now() - new Date(lastRaidedAt).getTime()) / 3600000;
    if (h < 8) return { label: 'Under Shield', cls: 'mood-peaceful', icon: '🛡️', desc: `Protected for another ${Math.ceil(8 - h)}h after the last raid.` };
    if (h < 24) return { label: 'Recovering', cls: 'mood-danger', icon: '⚠️', desc: 'Your settlement bears fresh scars. Raiders may return.' };
  }
  if (defenseRating < 20) return { label: 'Vulnerable', cls: 'mood-danger', icon: '⚠️', desc: 'Your walls are thin. A bold raider would find easy pickings.' };
  if (defenseRating >= 80) return { label: 'Peaceful', cls: 'mood-peaceful', icon: '🌿', desc: 'Your defenses hold strong. The land is quiet for now.' };
  return { label: 'Watchful', cls: 'mood-peaceful', icon: '👁️', desc: 'Scouts keep watch. The settlement stands ready.' };
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
      setSaveMsg(`Settlement saved — DEF: ${data.defenseRating} | Prestige: ${data.prestigeScore}`);
      setHomeData(prev => prev ? { ...prev, defenseRating: data.defenseRating, prestigeScore: data.prestigeScore, layout: layout as unknown as RoomCell[][] } : prev);
      if (charData && cost > 0) setCharData(prev => prev ? { ...prev, gold: prev.gold - cost } : prev);
      setTimeout(() => setSaveMsg(''), 5000);
    }
  };

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏡</div>
      <p style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
        The settlement stirs at your arrival...
      </p>
    </div>
  );

  if (!homeData || !charData) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏚️</div>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', marginBottom: 8 }}>No settlement found.</div>
      <p style={{ fontFamily: 'Lora, serif', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Create a character first to claim your land.</p>
    </div>
  );

  const layout = homeData.layout?.length ? homeData.layout : emptyLayout(homeData.unlockedSize);
  const mood = getMood(homeData.lastRaidedAt, homeData.defenseRating);
  const tier = getSettlementTier(homeData.prestigeScore);
  const tierPct = tier.next > 0 ? Math.min(100, Math.round((homeData.prestigeScore / tier.next) * 100)) : 100;

  return (
    <div style={{ padding: 24 }}>

      {/* Settlement identity header */}
      <div style={{
        marginBottom: 20,
        padding: '20px 24px',
        background: 'linear-gradient(135deg, #10180c 0%, #1a2812 50%, #131f0d 100%)',
        border: '1px solid var(--border-base)',
        borderRadius: 'var(--radius-lg)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 200, height: '100%', background: 'radial-gradient(ellipse at right, rgba(90,168,50,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: '1.6rem' }}>🏡</span>
              <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', margin: 0, color: 'var(--text-primary)' }}>
                {homeData.name}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', color: tier.color, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                {tier.tier}
              </span>
              {tier.next > 0 && (
                <span style={{ fontFamily: 'Lora, serif', fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  · {homeData.prestigeScore} / {tier.next} prestige
                </span>
              )}
            </div>
            {tier.next > 0 && (
              <div style={{ width: 200, height: 4, background: 'var(--bg-raised)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', width: `${tierPct}%`, background: tier.color, borderRadius: 2, transition: 'width 0.6s' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                🛡️ <strong style={{ color: 'var(--river-blue)' }}>{homeData.defenseRating}</strong> DEF
              </span>
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                ✨ <strong style={{ color: 'var(--dawn-gold)' }}>{homeData.prestigeScore}</strong> Prestige
              </span>
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                ⚔️ Raided <strong style={{ color: 'var(--blood-red)' }}>{homeData.totalTimesRaided}×</strong>
              </span>
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                👁️ <strong>{homeData.totalVisits}</strong> visitors
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div className={`panel ${mood.cls}`} style={{ padding: '10px 16px', display: 'inline-block', minWidth: 160 }}>
              <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>{mood.icon}</div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>{mood.label}</div>
              <p style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>{mood.desc}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent raid notification */}
      {homeData.lastRaidedAt && (() => {
        const h = (Date.now() - new Date(homeData.lastRaidedAt).getTime()) / 3600000;
        if (h >= 24) return null;
        return (
          <div style={{
            marginBottom: 16,
            padding: '14px 20px',
            background: 'linear-gradient(135deg, rgba(200,56,40,0.08) 0%, rgba(200,56,40,0.04) 100%)',
            border: '1px solid rgba(200,56,40,0.25)',
            borderLeft: '3px solid var(--blood-red)',
            borderRadius: '0 var(--radius) var(--radius) 0',
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>💀</span>
              <div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: 'var(--blood-red)', marginBottom: 2, letterSpacing: '0.05em' }}>
                  YOUR SETTLEMENT WAS RAIDED
                </div>
                <p style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Raiders breached your walls {h < 1 ? 'less than an hour' : `${Math.floor(h)} hour${Math.floor(h) > 1 ? 's' : ''}`} ago.
                  {h < 8 ? ' A shield now protects you from further attacks.' : ' Reinforce your defenses before they return.'}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center', borderBottom: '1px solid var(--border-dim)', paddingBottom: 12 }}>
        {([['build', '🔨 Builder'], ['overview', '📊 Settlement Stats']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontFamily: 'Lora, serif', textTransform: 'none', letterSpacing: '0.02em' }}>
            {label}
          </button>
        ))}
        {saveMsg && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--leaf-green)', fontFamily: 'Lora, serif', fontStyle: 'italic' }}>
            ✅ {saveMsg}
          </div>
        )}
      </div>

      {tab === 'build' ? (
        <>
          <div style={{
            marginBottom: 16, padding: '12px 18px',
            background: 'rgba(200,152,58,0.05)',
            border: '1px solid rgba(200,152,58,0.15)',
            borderLeft: '3px solid var(--dawn-gold)',
            borderRadius: '0 var(--radius) var(--radius) 0',
            fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7,
          }}>
            <strong style={{ color: 'var(--dawn-gold)', fontFamily: 'Cinzel, serif', fontSize: '0.78rem', letterSpacing: '0.06em' }}>BUILDER'S WISDOM</strong>
            <br />
            <span style={{ fontFamily: 'Lora, serif', fontStyle: 'italic' }}>
              Place your Vaults deep within — raiders enter from the 🚪 Entrance and must fight through every room.
              Layer Traps between empty passages and Decoy Vaults to mislead and punish the greedy.
              Your settlement is <strong style={{ color: 'var(--river-blue)', fontStyle: 'normal' }}>{homeData.unlockedSize}×{homeData.unlockedSize}</strong> cells
              — expand by training your Architecture skill.
            </span>
          </div>
          <HomeBuilder
            initialLayout={layout as any}
            unlockedSize={homeData.unlockedSize}
            gold={charData.gold}
            onSave={handleSave as any}
          />
        </>
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div className="lore-title" style={{ marginBottom: 12 }}>Settlement Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Defense Rating', value: homeData.defenseRating, icon: '🛡️', color: 'var(--river-blue)', desc: 'Higher = harder to raid successfully' },
                { label: 'Prestige Score', value: homeData.prestigeScore, icon: '✨', color: 'var(--dawn-gold)', desc: 'Social standing earned from trophies and upgrades' },
                { label: 'Stored Gold', value: `${homeData.resourceGold}g`, icon: '💰', color: 'var(--dawn-gold)', desc: 'Raiders can steal this if they reach your vault' },
                { label: 'Materials', value: homeData.resourceMaterials, icon: '🪵', color: '#9a7848', desc: 'Crafting materials stored in your settlement' },
                { label: 'Times Raided', value: homeData.totalTimesRaided, icon: '⚔️', color: 'var(--blood-red)', desc: 'How many times raiders have breached your walls' },
                { label: 'Visitor Count', value: homeData.totalVisits, icon: '👁️', color: 'var(--leaf-green)', desc: 'Players who have walked through your settlement' },
              ].map(stat => (
                <div key={stat.label} className="panel" style={{ padding: 20 }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>{stat.icon}</div>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{stat.label}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: stat.color, fontFamily: 'Share Tech Mono, monospace' }}>{stat.value}</div>
                  <div style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{stat.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Settlement tier progression */}
          <div className="panel" style={{ padding: 20 }}>
            <div className="lore-title" style={{ marginBottom: 12 }}>Settlement Tier</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                {[
                  { label: 'Abandoned Ruin', threshold: 0, color: '#6a6858' },
                  { label: 'Humble Outpost', threshold: 50, color: '#8a9878' },
                  { label: 'Growing Camp', threshold: 250, color: '#5aa832' },
                  { label: 'Established Town', threshold: 800, color: '#4a8ab8' },
                  { label: 'Fortified Citadel', threshold: 2000, color: '#a870e8' },
                  { label: 'Legendary Stronghold', threshold: 5000, color: '#c8983a' },
                ].map((t, i) => {
                  const active = homeData.prestigeScore >= t.threshold && (i === 5 || homeData.prestigeScore < [50, 250, 800, 2000, 5000, Infinity][i]);
                  return (
                    <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, opacity: homeData.prestigeScore >= t.threshold ? 1 : 0.35 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, boxShadow: active ? `0 0 8px ${t.color}` : 'none', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', color: active ? t.color : 'var(--text-muted)', fontWeight: active ? 700 : 400 }}>{t.label}</span>
                      <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{t.threshold === 0 ? '0' : `${t.threshold}+ prestige`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p style={{ fontFamily: 'Lora, serif', fontStyle: 'italic', fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Earn prestige by adding trophies, upgrading rooms, and defending against raids.
              Higher tiers unlock new building options and attract more visitors.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
