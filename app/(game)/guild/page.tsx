'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface GuildData {
  id: string;
  name: string;
  tag: string;
  motto: string | null;
  memberCount: number;
  controlledDistricts: number;
  seasonPoints: number;
  totalRaidsWon: number;
  warWins: number;
  gold: number;
  color: string;
}

interface MemberData {
  id: string;
  characterId: string;
  role: 'leader' | 'officer' | 'member';
  contribution: number;
  characterName?: string;
  characterLevel?: number;
  characterClass?: string;
}

export default function GuildPage() {
  const [guild, setGuild] = useState<GuildData | null>(null);
  const [loading, setLoading] = useState(true);
  const [createMode, setCreateMode] = useState(false);
  const [formName, setFormName] = useState('');
  const [formTag, setFormTag] = useState('');
  const [formMotto, setFormMotto] = useState('');
  const [formColor, setFormColor] = useState('#4488ff');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/guild').then(r => r.json()).then(d => {
      setGuild(d.guild ?? null);
      setLoading(false);
    });
  }, []);

  const createGuild = async () => {
    if (!formName || !formTag) return;
    setSubmitting(true); setError('');
    const res = await fetch('/api/guild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: formName, tag: formTag.toUpperCase(), motto: formMotto, color: formColor }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Failed to create guild'); setSubmitting(false); return; }
    setGuild(data.guild);
    setCreateMode(false);
    setSubmitting(false);
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
      Loading guild data...
    </div>
  );

  if (!guild && !createMode) return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 4 }}>🛡️ GUILD</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          You're not in a guild. Join one or found your own faction.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="panel" style={{ padding: 24, textAlign: 'center', cursor: 'pointer', border: '1px solid var(--border-base)' }} onClick={() => setCreateMode(true)}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏴</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Found a Guild</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Create your own faction. Recruit up to 20 members. Claim districts.</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Create Guild →</button>
        </div>
        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🤝</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Join a Guild</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Browse open guilds or get an invite from a guild leader.</div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} disabled>Browse Guilds →</button>
        </div>
      </div>

      <div className="panel" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Why join a guild?</div>
        {[
          '⚔️ Coordinate raids on the same target for maximum loot',
          '🏛️ Claim districts and collect tax from all trades there',
          '🏆 Guild season points = shared trophy rewards',
          '🛡️ Defend each other — guild members can reinforce homes',
          '💬 Private guild chat channel',
          '📢 Declare war on rival guilds for district control',
        ].map((r, i) => (
          <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '5px 0', borderBottom: '1px solid var(--border-dim)' }}>{r}</div>
        ))}
      </div>
    </div>
  );

  if (createMode) return (
    <div style={{ padding: 24, maxWidth: 500 }}>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }} onClick={() => setCreateMode(false)}>← Back</button>
      <h1 style={{ fontSize: '1.8rem', marginBottom: 20 }}>🏴 Found a Guild</h1>

      <div className="panel" style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <label className="input-label">Guild Name</label>
          <input value={formName} onChange={e => setFormName(e.target.value)} className="input" placeholder="Iron Vault Brotherhood" maxLength={48} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="input-label">Tag (3–5 chars shown as [TAG])</label>
          <input value={formTag} onChange={e => setFormTag(e.target.value.toUpperCase())} className="input" placeholder="IVB" maxLength={5} style={{ fontFamily: 'Share Tech Mono, monospace' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="input-label">Motto (optional)</label>
          <input value={formMotto} onChange={e => setFormMotto(e.target.value)} className="input" placeholder="No mercy, no retreat." maxLength={80} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="input-label">Guild Color</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={formColor} onChange={e => setFormColor(e.target.value)} style={{ width: 40, height: 36, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'none', padding: 2 }} />
            <span style={{ color: formColor, fontFamily: 'Share Tech Mono, monospace', fontWeight: 700 }}>[{formTag || 'TAG'}] {formName || 'Guild Name'}</span>
          </div>
        </div>

        {error && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#ff334411', border: '1px solid #ff334433', borderRadius: 5, color: 'var(--neon-red)', fontSize: '0.85rem' }}>{error}</div>}

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={createGuild} disabled={submitting || !formName || formTag.length < 2}>
          {submitting ? 'Creating...' : '🏴 Found Guild (cost: 1,000g)'}
        </button>
        <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Guild cap: 20 members · You become leader · Can be expanded via district ownership
        </div>
      </div>
    </div>
  );

  // Has guild
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: '1.8rem' }}>{guild!.name}</h1>
            <span style={{ padding: '3px 10px', background: `${guild!.color}22`, border: `1px solid ${guild!.color}44`, borderRadius: 4, fontSize: '0.8rem', fontFamily: 'Share Tech Mono, monospace', color: guild!.color, fontWeight: 700 }}>
              [{guild!.tag}]
            </span>
          </div>
          {guild!.motto && <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>"{guild!.motto}"</p>}
        </div>
        <button className="btn btn-secondary btn-sm">⚙️ Manage</button>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: '👥', label: 'Members', value: `${guild!.memberCount}/20`, color: 'var(--neon-blue)' },
          { icon: '🏛️', label: 'Districts', value: guild!.controlledDistricts, color: 'var(--neon-gold)' },
          { icon: '🏆', label: 'Season Pts', value: guild!.seasonPoints.toLocaleString(), color: 'var(--neon-purple)' },
          { icon: '⚔️', label: 'Raids Won', value: guild!.totalRaidsWon, color: 'var(--neon-red)' },
          { icon: '💰', label: 'Treasury', value: `${guild!.gold.toLocaleString()}g`, color: 'var(--neon-gold)' },
        ].map(s => (
          <div key={s.label} className="panel" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 4 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Members */}
        <div className="panel">
          <div className="panel-header">👥 MEMBERS ({guild!.memberCount}/20)</div>
          <div style={{ padding: '4px 0' }}>
            <div style={{ padding: '8px 16px', color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>
              Member list will appear here as players join.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="panel">
            <div className="panel-header">⚡ GUILD ACTIONS</div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>📢 Declare District War</button>
              <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>📨 Invite Member</button>
              <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>💰 Deposit to Treasury</button>
              <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>🤝 Propose Alliance</button>
            </div>
          </div>
          <div className="panel" style={{ padding: 12 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 8 }}>WAR RECORD</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--neon-green)' }}>W: {guild!.warWins}</span>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ color: 'var(--neon-red)' }}>L: 0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
