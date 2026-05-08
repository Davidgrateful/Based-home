export interface DistrictDef {
  slug: string;
  name: string;
  lore: string;
  resourceType: string;
  gridX: number;
  gridY: number;
  color: string;
  bgColor: string;
  icon: string;
  minLevel: number;
  defaultBuff: { type: string; value: number; label: string };
}

export const DISTRICT_DEFS: DistrictDef[] = [
  // Row 0 (top)
  { slug: 'ghost-alley', name: 'Ghost Alley', lore: 'Dark markets and shadow ops. Nobody asks questions here.', resourceType: 'intel', gridX: 0, gridY: 0, color: '#aa44ff', bgColor: '#0e0a18', icon: '👻', minLevel: 15, defaultBuff: { type: 'hacking', value: 20, label: 'Hacking +20%' } },
  { slug: 'circuit-gate', name: 'Circuit Gate', lore: 'Engineering hub. If it runs on power, it was built here.', resourceType: 'components', gridX: 1, gridY: 0, color: '#44ff88', bgColor: '#0a180e', icon: '⚙️', minLevel: 10, defaultBuff: { type: 'engineering', value: 20, label: 'Engineering +20%' } },
  { slug: 'zero-district', name: 'Zero District', lore: 'The endgame zone. Legends are made and broken here.', resourceType: 'shards', gridX: 2, gridY: 0, color: '#ff3366', bgColor: '#180a10', icon: '⚡', minLevel: 40, defaultBuff: { type: 'all', value: 15, label: 'All Skills +15%' } },
  { slug: 'foundry', name: 'The Foundry', lore: 'Industrial core. The Grid runs on steel forged here.', resourceType: 'metal', gridX: 3, gridY: 0, color: '#ff4433', bgColor: '#180a0a', icon: '🔥', minLevel: 8, defaultBuff: { type: 'crafting', value: 25, label: 'Crafting +25%' } },
  { slug: 'crystal-row', name: 'Crystal Row', lore: 'Alchemists and mystics control rare reagents.', resourceType: 'crystals', gridX: 4, gridY: 0, color: '#44ffee', bgColor: '#0a1818', icon: '💎', minLevel: 12, defaultBuff: { type: 'alchemy', value: 25, label: 'Alchemy +25%' } },

  // Row 1 (middle-top)
  { slug: 'rust-belt', name: 'Rust Belt', lore: 'Old infrastructure, new opportunity. Miners work these veins.', resourceType: 'ore', gridX: 0, gridY: 1, color: '#ff8833', bgColor: '#180e08', icon: '⛏️', minLevel: 5, defaultBuff: { type: 'mining', value: 30, label: 'Mining +30%' } },
  { slug: 'silver-quarter', name: 'Silver Quarter', lore: 'Merchants and traders built fortunes here.', resourceType: 'silver', gridX: 1, gridY: 1, color: '#ddddff', bgColor: '#141420', icon: '💰', minLevel: 5, defaultBuff: { type: 'trading', value: 30, label: 'Trading +30%' } },
  { slug: 'neon-quarter', name: 'Neon Quarter', lore: 'The beating heart of the Grid. Social, loud, never sleeps.', resourceType: 'gold', gridX: 2, gridY: 1, color: '#00ddff', bgColor: '#081418', icon: '🌃', minLevel: 0, defaultBuff: { type: 'gold', value: 10, label: 'Gold +10%' } },
  { slug: 'iron-gate', name: 'Iron Gate', lore: 'Military district. The most heavily defended zone.', resourceType: 'alloy', gridX: 3, gridY: 1, color: '#8888aa', bgColor: '#111116', icon: '🗼', minLevel: 10, defaultBuff: { type: 'defense', value: 20, label: 'Defense +20%' } },
  { slug: 'archives', name: 'The Archives', lore: 'History is power. Seasonal trophies are housed here.', resourceType: 'knowledge', gridX: 4, gridY: 1, color: '#ffaa33', bgColor: '#160e04', icon: '📜', minLevel: 0, defaultBuff: { type: 'xp', value: 20, label: 'XP Gain +20%' } },

  // Row 2 (middle-bottom)
  { slug: 'deepwater', name: 'Deepwater Docks', lore: 'Fishing and coastal trade. Calm on the surface.', resourceType: 'fish', gridX: 0, gridY: 2, color: '#3366ff', bgColor: '#080c18', icon: '🎣', minLevel: 3, defaultBuff: { type: 'fishing', value: 35, label: 'Fishing +35%' } },
  { slug: 'green-belt', name: 'Green Belt', lore: 'Farming and cooking guilds feed the whole city.', resourceType: 'food', gridX: 1, gridY: 2, color: '#44aa44', bgColor: '#0a1208', icon: '🌾', minLevel: 1, defaultBuff: { type: 'cooking', value: 35, label: 'Cooking +35%' } },
  { slug: 'vault-district', name: 'Vault District', lore: 'The safest homes, the richest prizes. Everyone wants this.', resourceType: 'gold', gridX: 2, gridY: 2, color: '#ffcc00', bgColor: '#141200', icon: '🏛️', minLevel: 20, defaultBuff: { type: 'loot', value: 25, label: 'Loot +25%' } },
  { slug: 'sprawl', name: 'The Sprawl', lore: 'Chaotic starter zone. No rules, cheap land, fast action.', resourceType: 'scrap', gridX: 3, gridY: 2, color: '#8888ff', bgColor: '#0e0e18', icon: '🏚️', minLevel: 0, defaultBuff: { type: 'raid_speed', value: 20, label: 'Raid Speed +20%' } },
  { slug: 'market-row', name: 'Market Row', lore: 'The Grid's largest open marketplace. Taxes go to the guild in control.', resourceType: 'goods', gridX: 4, gridY: 2, color: '#ff88aa', bgColor: '#180e12', icon: '🏪', minLevel: 0, defaultBuff: { type: 'market_tax', value: -50, label: 'Market Fee -50%' } },

  // Row 3 (bottom)
  { slug: 'blacksite', name: 'Blacksite', lore: 'Classified. Only the most dangerous operatives operate here.', resourceType: 'contraband', gridX: 0, gridY: 3, color: '#ff2244', bgColor: '#180608', icon: '☠️', minLevel: 30, defaultBuff: { type: 'combat', value: 30, label: 'Combat +30%' } },
  { slug: 'coppervault', name: 'Copper Vault', lore: 'Industrial wealth storage. Raiders love this zone.', resourceType: 'copper', gridX: 1, gridY: 3, color: '#cc6633', bgColor: '#140c08', icon: '⚗️', minLevel: 8, defaultBuff: { type: 'resource_gen', value: 25, label: 'Passive Income +25%' } },
  { slug: 'neutral-ground', name: 'Neutral Ground', lore: 'Treaty zone. No guild wars. Peaceful trading only.', resourceType: 'mixed', gridX: 2, gridY: 3, color: '#aaaaaa', bgColor: '#141414', icon: '🕊️', minLevel: 0, defaultBuff: { type: 'none', value: 0, label: 'PvP Shield +24h' } },
  { slug: 'tech-ward', name: 'Tech Ward', lore: 'Hackers paradise. Electronic locks mean nothing here.', resourceType: 'circuits', gridX: 3, gridY: 3, color: '#44ddff', bgColor: '#081418', icon: '💻', minLevel: 15, defaultBuff: { type: 'hacking', value: 35, label: 'Hacking +35%' } },
  { slug: 'colosseum', name: 'The Colosseum', lore: 'Arena district. Weekly tournaments crown champions.', resourceType: 'trophies', gridX: 4, gridY: 3, color: '#ffdd44', bgColor: '#141000', icon: '🏆', minLevel: 10, defaultBuff: { type: 'season_points', value: 50, label: 'Season Points +50%' } },
];

export function getDistrict(slug: string): DistrictDef | undefined {
  return DISTRICT_DEFS.find(d => d.slug === slug);
}
