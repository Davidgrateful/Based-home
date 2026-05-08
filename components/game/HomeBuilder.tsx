'use client';

import { useState, useCallback } from 'react';
import { ROOM_DEFS, BUILDABLE_ROOMS, type RoomType, type RoomCell, calcDefenseRating, calcPrestige } from '@/lib/game/homeRooms';

const GRID = 10;

const ROOM_COSTS: Record<RoomType, number> = {
  empty: 0, wall: 50, entrance: 0, vault: 500, fake_vault: 300,
  barracks: 400, workshop: 350, trophy: 200, trap: 250, garden: 150, social: 100, generator: 300,
};

interface Props {
  initialLayout: RoomCell[][];
  unlockedSize: number;
  gold: number;
  onSave: (layout: RoomCell[][], cost: number) => Promise<void>;
}

function mkGrid(layout: RoomCell[][], unlockedSize: number): RoomCell[][] {
  const grid: RoomCell[][] = [];
  for (let y = 0; y < GRID; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID; x++) {
      grid[y][x] = layout[y]?.[x] ?? { type: 'empty', level: 1, x, y };
    }
  }
  return grid;
}

export function HomeBuilder({ initialLayout, unlockedSize, gold, onSave }: Props) {
  const [grid, setGrid] = useState<RoomCell[][]>(() => mkGrid(initialLayout, unlockedSize));
  const [selectedTool, setSelectedTool] = useState<RoomType>('wall');
  const [isDragging, setIsDragging] = useState(false);
  const [pendingCost, setPendingCost] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<'build' | 'erase'>('build');

  const isLocked = (x: number, y: number) => x >= unlockedSize || y >= unlockedSize;

  const paintCell = useCallback((x: number, y: number) => {
    if (isLocked(x, y)) return;
    const cell = grid[y]?.[x];
    if (!cell) return;
    // Can't overwrite entrance
    if (cell.type === 'entrance') return;

    const newType: RoomType = mode === 'erase' ? 'empty' : selectedTool;
    if (cell.type === newType) return;

    const cost = mode === 'erase' ? 0 : (ROOM_COSTS[newType] ?? 0);

    setGrid(prev => {
      const next = prev.map(row => row.map(c => ({ ...c })));
      next[y][x] = { type: newType, level: 1, x, y };
      return next;
    });
    setPendingCost(prev => prev + (mode === 'erase' ? 0 : cost));
  }, [grid, mode, selectedTool, unlockedSize]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(grid, pendingCost);
      setPendingCost(0);
    } finally {
      setSaving(false);
    }
  };

  const defRating = calcDefenseRating(grid);
  const prestige = calcPrestige(grid);

  const roomCounts: Partial<Record<RoomType, number>> = {};
  for (const row of grid) for (const cell of row) {
    if (cell.type !== 'empty') roomCounts[cell.type] = (roomCounts[cell.type] ?? 0) + 1;
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* Grid */}
      <div>
        <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setMode('build')}
            className={`btn btn-sm ${mode === 'build' ? 'btn-primary' : 'btn-ghost'}`}
          >🔨 Build</button>
          <button
            onClick={() => setMode('erase')}
            className={`btn btn-sm ${mode === 'erase' ? 'btn-danger' : 'btn-ghost'}`}
          >🗑️ Erase</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--neon-blue)' }}>🛡️ DEF: <strong>{defRating}</strong></span>
            <span style={{ color: 'var(--neon-gold)' }}>✨ PRESTIGE: <strong>{prestige}</strong></span>
          </div>
        </div>

        <div
          className="room-grid"
          style={{ gridTemplateColumns: `repeat(${GRID}, 36px)`, userSelect: 'none' }}
          onMouseLeave={() => { setIsDragging(false); setHovered(null); }}
        >
          {grid.map((row, y) =>
            row.map((cell, x) => {
              const locked = isLocked(x, y);
              const def = ROOM_DEFS[cell.type];
              const isHov = hovered?.x === x && hovered?.y === y;
              return (
                <div
                  key={`${x}-${y}`}
                  className={`room-cell ${locked ? 'locked' : cell.type === 'empty' ? 'empty' : `room-${cell.type.replace('_', '-')}`}`}
                  style={{
                    width: 36, height: 36, fontSize: '0.85rem',
                    outline: isHov && !locked ? '2px solid var(--neon-blue)' : 'none',
                    cursor: locked ? 'not-allowed' : 'crosshair',
                  }}
                  title={locked ? 'Locked — upgrade Architecture to unlock' : `${def.label}: ${def.effect}`}
                  onMouseDown={() => { if (!locked) { setIsDragging(true); paintCell(x, y); } }}
                  onMouseUp={() => setIsDragging(false)}
                  onMouseEnter={() => { setHovered({ x, y }); if (isDragging && !locked) paintCell(x, y); }}
                >
                  {cell.type !== 'empty' ? def.icon : locked ? '🔒' : ''}
                </div>
              );
            })
          )}
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          {pendingCost > 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--neon-gold)' }}>
              💰 Build cost: <strong>{pendingCost.toLocaleString()}g</strong>
              {pendingCost > gold && <span style={{ color: 'var(--neon-red)', marginLeft: 6 }}>(insufficient gold!)</span>}
            </span>
          )}
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={handleSave}
            disabled={saving || pendingCost > gold}
          >
            {saving ? 'Saving...' : '💾 Save Layout'}
          </button>
        </div>

        {/* Legend */}
        <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            { t: 'entrance', label: 'Entry', color: '#00ddff' },
            { t: 'vault', label: 'Vault', color: '#ffcc00' },
            { t: 'trap', label: 'Trap', color: '#ff3344' },
            { t: 'barracks', label: 'Guards', color: '#ff4444' },
            { t: 'wall', label: 'Wall', color: '#888' },
            { t: 'workshop', label: 'Workshop', color: '#4488ff' },
            { t: 'fake_vault', label: 'Decoy', color: '#aa44ff' },
            { t: 'garden', label: 'Garden', color: '#44ff88' },
          ] as const).map(({ t, label, color }) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color, opacity: 0.6 }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Tool selector */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <div className="panel">
          <div className="panel-header">🔨 ROOMS</div>
          <div style={{ padding: 8 }}>
            {BUILDABLE_ROOMS.map(type => {
              const def = ROOM_DEFS[type];
              const count = roomCounts[type] ?? 0;
              const selected = selectedTool === type && mode === 'build';
              return (
                <div
                  key={type}
                  onClick={() => { setSelectedTool(type); setMode('build'); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 5,
                    cursor: 'pointer',
                    background: selected ? '#4488ff18' : 'transparent',
                    border: `1px solid ${selected ? 'var(--neon-blue)' : 'transparent'}`,
                    marginBottom: 3,
                    transition: 'all 0.1s',
                  }}
                >
                  <span style={{ fontSize: '1rem', width: 20, textAlign: 'center' }}>{def.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: selected ? 'var(--neon-blue)' : 'var(--text-primary)' }}>
                      {def.label}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {def.buildCost > 0 ? `${def.buildCost}g` : 'Free'}
                      {count > 0 && <span style={{ marginLeft: 6, color: 'var(--text-secondary)' }}>×{count}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hovered room info */}
        {hovered && (() => {
          const cell = grid[hovered.y]?.[hovered.x];
          if (!cell || cell.type === 'empty' || isLocked(hovered.x, hovered.y)) return null;
          const def = ROOM_DEFS[cell.type];
          return (
            <div className="panel" style={{ marginTop: 10, padding: 12 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 4, color: 'var(--neon-cyan)' }}>
                {def.icon} {def.label} {cell.type !== 'entrance' && `Lv${cell.level}`}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {def.effect}
              </div>
              {def.isTrap && (
                <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--neon-red)' }}>
                  ⚠️ Trap: {(def.trapDamage ?? 0) * cell.level} dmg
                </div>
              )}
            </div>
          );
        })()}

        {/* Stats */}
        <div className="panel" style={{ marginTop: 10, padding: 12 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.12em', fontFamily: 'Share Tech Mono, monospace', marginBottom: 8 }}>HOME STATS</div>
          {[
            { label: 'Defense', value: defRating, color: 'var(--neon-blue)', max: 2000 },
            { label: 'Prestige', value: prestige, color: 'var(--neon-gold)', max: 2000 },
          ].map(s => (
            <div key={s.label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 3 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                <span style={{ color: s.color, fontWeight: 700 }}>{s.value}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100, (s.value / s.max) * 100)}%`, background: s.color }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            {Object.entries(roomCounts).map(([type, cnt]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                <span>{ROOM_DEFS[type as RoomType]?.icon} {ROOM_DEFS[type as RoomType]?.label}</span>
                <span style={{ color: 'var(--text-primary)' }}>×{cnt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
