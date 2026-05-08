'use client';

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '@/lib/game/types';

interface Props {
  messages: ChatMessage[];
  onSend: (msg: string) => void;
}

const CHANNEL_COLORS: Record<string, string> = {
  global: '#88ccff',
  local: '#aaffaa',
  system: '#ffdd44',
  combat: '#ff8844',
};

export function ChatPanel({ messages, onSend }: Props) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, width: 340, zIndex: 20,
      background: 'rgba(10,10,20,0.85)', border: '1px solid #334',
      borderRadius: '0 8px 0 0', display: 'flex', flexDirection: 'column',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid #334', fontSize: 11, color: '#556' }}>
        ⚔ BASE HOME CHAT
      </div>
      <div ref={listRef} style={{ height: 140, overflowY: 'auto', padding: '4px 8px' }}>
        {messages.slice(-50).map(m => (
          <div key={m.id} style={{ fontSize: 12, marginBottom: 2, lineHeight: 1.4 }}>
            <span style={{ color: CHANNEL_COLORS[m.channel] || '#aaa', fontWeight: 'bold' }}>
              {m.channel === 'system' ? '[SYS]' : `[${m.playerName}]`}
            </span>{' '}
            <span style={{ color: m.channel === 'system' ? '#ffdd44' : '#ddd' }}>{m.message}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid #334' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); e.stopPropagation(); }}
          placeholder="Press Enter to chat..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#ddd', padding: '6px 8px', fontSize: 12, fontFamily: 'monospace',
          }}
        />
        <button
          onClick={send}
          style={{ background: '#223', border: 'none', color: '#88ccff', padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
