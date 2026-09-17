/**
 * A single 48-colour palette used by every generated sprite and tile so the
 * whole game reads as one art style. Warm, slightly desaturated fantasy tones
 * with cool shadows.
 */
export const PAL = {
  // neutrals / shadow
  void: '#06050a',
  ink: '#100d16',
  charcoal: '#1c1725',
  slate: '#2e2740',
  stone: '#4a4159',
  ash: '#6a6178',
  fog: '#958da1',
  bone: '#d8cfc4',
  cloth: '#efe6d6',
  white: '#fdf8ef',

  // greens
  mossDark: '#17281c',
  moss: '#243c27',
  grassDark: '#274124',
  grass: '#385a2c',
  grassLit: '#487036',
  grassPale: '#688c47',
  leafDark: '#1d3421',
  leaf: '#345e32',
  leafLit: '#4f823e',
  swamp: '#41502c',
  swampDark: '#2b361f',
  toxic: '#8fbf4a',

  // earth
  soilDark: '#3a2a20',
  soil: '#51392a',
  dirt: '#6b4b34',
  dirtLit: '#8a6544',
  sand: '#c9a86b',
  sandLit: '#e2c68c',
  sandDark: '#a3823f',
  clay: '#8c5a3b',

  // rock
  rockDark: '#2f2c38',
  rock: '#4a4655',
  rockLit: '#6c6879',
  rockPale: '#928da0',
  snow: '#d2dbe6',
  snowDark: '#a3b1c5',
  ice: '#8fc4dc',

  // water
  deep: '#0f2138',
  water: '#1a3e5c',
  waterLit: '#286181',
  foam: '#8fd0d8',

  // wood
  woodDark: '#33231a',
  wood: '#5a3b26',
  woodLit: '#7d5533',
  plank: '#9a7046',
  plankLit: '#b98f5c',

  // metal
  ironDark: '#3d4350',
  iron: '#6b7385',
  ironLit: '#9aa2b3',
  steel: '#c3cad6',
  gold: '#d9a441',
  goldLit: '#f2cb60',
  copper: '#b2703b',

  // fire / magic
  emberDark: '#6d2315',
  ember: '#b5462f',
  flame: '#e8763a',
  flameLit: '#f6bf5d',
  arcaneDark: '#2b1f4d',
  arcane: '#5b43a8',
  arcaneLit: '#9578e8',
  frost: '#6fd0e8',
  blood: '#8e2131',
  rot: '#5f7a3a',
  holy: '#ffe9a8',

  // skin tones
  skin1: '#e8b48c',
  skin2: '#c98d63',
  skin3: '#9c6444',
  skin4: '#6f4530',
  skin5: '#4a2c1e',
  skin6: '#33201a',
  skinElf: '#f0d6c0',
  skinOrc: '#7d9a5c',
  skinBeast: '#b98a55',
  skinUndead: '#b9c4b0',
} as const;

export type PaletteColor = keyof typeof PAL;

/** Multiply a hex colour by a scalar — used for cheap shading of generated art. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * amount)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * amount)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Blend two hex colours. t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const r = Math.round(((na >> 16) & 255) * (1 - t) + ((nb >> 16) & 255) * t);
  const g = Math.round(((na >> 8) & 255) * (1 - t) + ((nb >> 8) & 255) * t);
  const bl = Math.round((na & 255) * (1 - t) + (nb & 255) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
