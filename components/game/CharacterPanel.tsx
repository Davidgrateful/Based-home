'use client';

import type { Player } from '@/lib/game/types';
import { CLASS_COLORS, CLASS_DESCRIPTIONS } from '@/lib/game/data';

interface Props {
  player: Player;
  onClose: () => void;
}

export function CharacterPanel({ player, onClose }: Props) {
  const classColor = CLASS_COLORS[player.class] || '#fff';
  const xpPct = Math.min(100, (player.xp / player.xpToNext) * 100);

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      width: 320, background: '#0a0a18', border: '2px solid #446',
      borderRadius: 10, zIndex: 50, color: '#ddd', fontFamily: 'monospace',
      boxShadow: '0 0 40px rgba(80,80,200,0.3)',
    }}>
      <div style={{ background: '#111', padding: '10px 16px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold', color: '#aabbff' }}>⚔ CHARACTER</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>
      <div style={{ padding: 16 }}>
        {/* Avatar */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: classColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, border: `3px solid ${classColor}`, boxShadow: `0 0 15px ${classColor}44`,
          }}>
            {player.class === 'warrior' ? '⚔️' : player.class === 'mage' ? '🔮' : '🏹'}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>{player.name}</div>
            <div style={{ color: classColor, textTransform: 'capitalize', fontSize: 13 }}>{player.class}</div>
            <div style={{ color: '#aaa', fontSize: 12 }}>Level {player.level}</div>
          </div>
        </div>

        {/* XP Bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 3 }}>
            <span>Experience</span><span>{player.xp}/{player.xpToNext}</span>
          </div>
          <div style={{ height: 8, background: '#222', borderRadius: 4 }}>
            <div style={{ height: '100%', width: `${xpPct}%`, background: '#8855ff', borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Gold */}
        <div style={{ background: '#111', borderRadius: 6, padding: '8px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888', fontSize: 13 }}>Gold</span>
          <span style={{ color: '#ffdd44', fontWeight: 'bold' }}>💰 {player.gold.toLocaleString()}</span>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { label: 'HP', value: `${player.stats.hp}/${player.stats.maxHp}`, color: '#2ecc71' },
            { label: 'MP', value: `${player.stats.mp}/${player.stats.maxMp}`, color: '#3498db' },
            { label: 'ATK', value: player.stats.atk, color: '#e74c3c' },
            { label: 'DEF', value: player.stats.def, color: '#95a5a6' },
            { label: 'MATK', value: player.stats.matk, color: '#9b59b6' },
            { label: 'SPD', value: player.stats.spd.toFixed(1), color: '#f39c12' },
          ].map(s => (
            <div key={s.label} style={{ background: '#111', borderRadius: 5, padding: '5px 10px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#666' }}>{s.label}</span>
              <span style={{ color: s.color, fontWeight: 'bold' }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Equipment */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: '#556', marginBottom: 6 }}>EQUIPMENT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
            {(['weapon', 'head', 'chest', 'legs', 'ring', 'offhand'] as const).map(slot => {
              const item = player.equipment[slot];
              return (
                <div key={slot} style={{
                  background: '#111', border: '1px solid #334', borderRadius: 5,
                  padding: '5px 8px', textAlign: 'center', minHeight: 42,
                }}>
                  <div style={{ fontSize: 14 }}>{item ? item.icon : '—'}</div>
                  <div style={{ fontSize: 9, color: item ? '#aaa' : '#444', textTransform: 'capitalize' }}>
                    {item ? item.name : slot}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: '#446', textAlign: 'center' }}>
          {CLASS_DESCRIPTIONS[player.class]}
        </div>
      </div>
    </div>
  );
}
