'use client';

import { useEffect, useState } from 'react';

interface WorldEvent {
  icon: string;
  text: string;
  type: string;
  timestamp: string;
}

const TYPE_COLORS: Record<string, string> = {
  raid:      'var(--blood-red)',
  guild:     'var(--river-blue)',
  levelup:   'var(--leaf-green)',
  world:     'var(--text-secondary)',
  social:    'var(--dawn-gold)',
  political: 'var(--rarity-epic)',
  danger:    'var(--firelight)',
  lore:      'var(--dawn-gold)',
};

export function WorldEventsFeed() {
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/worldevents')
      .then(r => r.json())
      .then(d => { setEvents(d.events ?? []); setLoading(false); })
      .catch(() => setLoading(false));

    // Refresh every 30s
    const t = setInterval(() => {
      fetch('/api/worldevents').then(r => r.json()).then(d => setEvents(d.events ?? []));
    }, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="panel" style={{ height: '100%' }}>
      <div className="panel-header">
        <span>🌍</span> World Events
        <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--leaf-green)', display: 'inline-block', animation: 'world-breathe 2s ease-in-out infinite' }} />
      </div>

      {loading ? (
        <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'Lora, serif', fontSize: '0.85rem' }}>
          Listening to the world...
        </div>
      ) : events.length === 0 ? (
        <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'Lora, serif', fontSize: '0.85rem' }}>
          The world is quiet for now...
        </div>
      ) : (
        <div style={{ overflowY: 'auto', maxHeight: 420 }}>
          {events.map((ev, i) => (
            <div key={i} className="world-event animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
              <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{ev.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: TYPE_COLORS[ev.type] ?? 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {ev.text}
                </div>
              </div>
              <div className="world-event-time">{ev.timestamp}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
