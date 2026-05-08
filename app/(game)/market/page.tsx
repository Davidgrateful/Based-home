'use client';

import { useState, useEffect } from 'react';

interface Listing {
  id: string;
  itemId: string;
  quantity: number;
  pricePerUnit: number;
  sellerName: string;
  sellerLevel: number;
  sellerClass: string;
  createdAt: string;
}

const ITEM_META: Record<string, { name: string; icon: string; category: string }> = {
  iron_ore:       { name: 'Iron Ore',        icon: '⛏️', category: 'materials' },
  gold_ore:       { name: 'Gold Ore',         icon: '🪙', category: 'materials' },
  crystal_shard:  { name: 'Crystal Shard',    icon: '💎', category: 'materials' },
  circuit_board:  { name: 'Circuit Board',    icon: '⚙️', category: 'components' },
  nano_fiber:     { name: 'Nano Fiber',        icon: '🧵', category: 'components' },
  healing_potion: { name: 'Healing Potion',   icon: '🧪', category: 'consumables' },
  turbo_potion:   { name: 'Turbo Potion',     icon: '⚡', category: 'consumables' },
  barrier_charm:  { name: 'Barrier Charm',    icon: '🔮', category: 'consumables' },
  rusty_sword:    { name: 'Rusty Sword',      icon: '⚔️', category: 'weapons' },
  plasma_staff:   { name: 'Plasma Staff',     icon: '🔮', category: 'weapons' },
  sniper_bow:     { name: 'Sniper Bow',       icon: '🏹', category: 'weapons' },
  iron_chestplate:{ name: 'Iron Chestplate',  icon: '🛡️', category: 'armor' },
};

const CATEGORIES = ['all', 'materials', 'components', 'consumables', 'weapons', 'armor'];

const MOCK_LISTINGS: Listing[] = [
  { id: '1', itemId: 'iron_ore',       quantity: 50,  pricePerUnit: 12,   sellerName: 'Korrath',    sellerLevel: 14, sellerClass: 'warrior', createdAt: new Date().toISOString() },
  { id: '2', itemId: 'crystal_shard',  quantity: 5,   pricePerUnit: 340,  sellerName: 'Nyxara',     sellerLevel: 22, sellerClass: 'mage',    createdAt: new Date().toISOString() },
  { id: '3', itemId: 'healing_potion', quantity: 20,  pricePerUnit: 45,   sellerName: 'Vex',        sellerLevel: 8,  sellerClass: 'ranger',  createdAt: new Date().toISOString() },
  { id: '4', itemId: 'circuit_board',  quantity: 10,  pricePerUnit: 180,  sellerName: 'Dragan',     sellerLevel: 31, sellerClass: 'warrior', createdAt: new Date().toISOString() },
  { id: '5', itemId: 'plasma_staff',   quantity: 1,   pricePerUnit: 2400, sellerName: 'Nyxara',     sellerLevel: 22, sellerClass: 'mage',    createdAt: new Date().toISOString() },
  { id: '6', itemId: 'nano_fiber',     quantity: 30,  pricePerUnit: 95,   sellerName: 'Kira',       sellerLevel: 17, sellerClass: 'ranger',  createdAt: new Date().toISOString() },
  { id: '7', itemId: 'gold_ore',       quantity: 15,  pricePerUnit: 55,   sellerName: 'Forge_X',    sellerLevel: 19, sellerClass: 'warrior', createdAt: new Date().toISOString() },
  { id: '8', itemId: 'turbo_potion',   quantity: 8,   pricePerUnit: 120,  sellerName: 'Vex',        sellerLevel: 8,  sellerClass: 'ranger',  createdAt: new Date().toISOString() },
  { id: '9', itemId: 'sniper_bow',     quantity: 1,   pricePerUnit: 1800, sellerName: 'Kira',       sellerLevel: 17, sellerClass: 'ranger',  createdAt: new Date().toISOString() },
  { id: '10', itemId: 'barrier_charm', quantity: 3,   pricePerUnit: 220,  sellerName: 'Dragan',     sellerLevel: 31, sellerClass: 'warrior', createdAt: new Date().toISOString() },
];

const CLASS_ICONS: Record<string, string> = { warrior: '⚔️', mage: '🔮', ranger: '🏹' };

export default function MarketPage() {
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'quantity'>('price_asc');
  const [search, setSearch] = useState('');
  const [buying, setBuying] = useState<string | null>(null);
  const [buyQty, setBuyQty] = useState(1);
  const [gold, setGold] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/character').then(r => r.json()).then(d => {
      if (d.character) setGold(d.character.gold);
    });
  }, []);

  const filtered = MOCK_LISTINGS.filter(l => {
    const meta = ITEM_META[l.itemId];
    if (!meta) return false;
    if (category !== 'all' && meta.category !== category) return false;
    if (search && !meta.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'price_asc') return a.pricePerUnit - b.pricePerUnit;
    if (sortBy === 'price_desc') return b.pricePerUnit - a.pricePerUnit;
    return b.quantity - a.quantity;
  });

  const buyingListing = buying ? MOCK_LISTINGS.find(l => l.id === buying) : null;
  const totalCost = buyingListing ? buyingListing.pricePerUnit * buyQty : 0;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 4 }}>💰 MARKET</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Player-driven economy. Buy materials, gear, consumables. List your own items for gold.
        </p>
      </div>

      {/* Balance bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ padding: '8px 16px', background: '#1a1200', border: '1px solid #ffcc0033', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: '1.2rem' }}>💰</span>
          <div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>YOUR BALANCE</div>
            <div style={{ fontWeight: 700, color: 'var(--neon-gold)' }}>
              {gold !== null ? `${gold.toLocaleString()}g` : '—'}
            </div>
          </div>
        </div>
        <button className="btn btn-gold btn-sm" disabled style={{ opacity: 0.5 }}>
          + List Item (coming soon)
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items..."
          className="input"
          style={{ width: 200, fontSize: '0.85rem', padding: '6px 10px' }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`btn btn-sm ${category === c ? 'btn-primary' : 'btn-ghost'}`}
              style={{ textTransform: 'capitalize' }}
            >
              {c}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {([['price_asc', '💰 Cheapest'], ['price_desc', '💎 Priciest'], ['quantity', '📦 Most']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setSortBy(id)} className={`btn btn-sm ${sortBy === id ? 'btn-primary' : 'btn-ghost'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'flex-start' }}>
        {/* Listing grid */}
        <div>
          {filtered.length === 0 ? (
            <div className="panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              No listings match your search.
            </div>
          ) : (
            <div className="panel">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, padding: '8px 16px', borderBottom: '1px solid var(--border-base)' }}>
                {['ITEM', 'QTY', 'PRICE / UNIT', 'ACTION'].map(h => (
                  <span key={h} style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', textAlign: h === 'ACTION' ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              {filtered.map(l => {
                const meta = ITEM_META[l.itemId];
                const isSelected = buying === l.id;
                return (
                  <div
                    key={l.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto auto',
                      gap: 12,
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border-dim)',
                      alignItems: 'center',
                      background: isSelected ? '#4488ff08' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: '1.2rem' }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{meta.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {CLASS_ICONS[l.sellerClass]} {l.sellerName}
                          <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>Lv{l.sellerLevel}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {l.quantity.toLocaleString()}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--neon-gold)' }}>
                      {l.pricePerUnit.toLocaleString()}g
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <button
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setBuying(isSelected ? null : l.id); setBuyQty(1); }}
                      >
                        {isSelected ? '✓ Selected' : 'Buy'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Purchase panel */}
        <div style={{ position: 'sticky', top: 24 }}>
          {buyingListing ? (
            <div className="panel animate-fade-in-up">
              <div className="panel-header">🛒 PURCHASE</div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: '2rem' }}>{ITEM_META[buyingListing.itemId]?.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{ITEM_META[buyingListing.itemId]?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Available: {buyingListing.quantity.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="input-label">Quantity</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setBuyQty(q => Math.max(1, q - 1))}>−</button>
                    <input
                      type="number"
                      value={buyQty}
                      min={1}
                      max={buyingListing.quantity}
                      onChange={e => setBuyQty(Math.min(buyingListing.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="input"
                      style={{ textAlign: 'center', width: 80 }}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={() => setBuyQty(q => Math.min(buyingListing.quantity, q + 1))}>+</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setBuyQty(buyingListing.quantity)} style={{ fontSize: '0.72rem' }}>MAX</button>
                  </div>
                </div>

                <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-raised)', borderRadius: 6 }}>
                  {[
                    { label: 'Unit price', value: `${buyingListing.pricePerUnit.toLocaleString()}g` },
                    { label: 'Quantity', value: `× ${buyQty}` },
                    { label: 'Total cost', value: `${totalCost.toLocaleString()}g`, highlight: true },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                      <span style={{ fontWeight: r.highlight ? 700 : 400, color: r.highlight ? 'var(--neon-gold)' : 'var(--text-primary)' }}>{r.value}</span>
                    </div>
                  ))}
                </div>

                {gold !== null && gold < totalCost && (
                  <div style={{ marginBottom: 12, padding: '8px 12px', background: '#ff334411', border: '1px solid #ff334433', borderRadius: 5, color: 'var(--neon-red)', fontSize: '0.8rem' }}>
                    Insufficient gold. You have {gold.toLocaleString()}g.
                  </div>
                )}

                <button
                  className="btn btn-gold"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={gold !== null && gold < totalCost}
                  onClick={() => {
                    // Market is read-only / mock for now
                    alert('Market transactions coming in next patch. This is a preview.');
                  }}
                >
                  💰 Buy for {totalCost.toLocaleString()}g
                </button>
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => setBuying(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="panel" style={{ padding: 24 }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🏪</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Player Market</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Select an item to purchase it. All trades are instant and gold is transferred directly.
                </div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-raised)', borderRadius: 6 }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 8 }}>MARKET RULES</div>
                {[
                  '5% district tax on each sale',
                  'Listings expire after 7 days',
                  'No cancellation fee',
                  'Rare items can only be listed once',
                ].map((r, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '4px 0', borderBottom: '1px solid var(--border-dim)' }}>
                    › {r}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price history placeholder */}
          <div className="panel" style={{ marginTop: 12, padding: 14 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginBottom: 8 }}>📈 PRICE HISTORY</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '12px 0' }}>
              Price charts available in Season 1 after 48h of trading data.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
