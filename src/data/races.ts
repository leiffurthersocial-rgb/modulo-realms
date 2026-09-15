import { PAL } from '../game/art/palette';

export type RaceId = 'human' | 'elf' | 'dwarf' | 'orc' | 'beastfolk' | 'revenant';
export type FactionId = 'alliance' | 'northern' | 'forest' | 'guild' | 'bandits' | 'arcane';

export interface RaceDef {
  id: RaceId;
  name: string;
  blurb: string;
  /** Flat bonuses applied at character creation. */
  stats: { vitality?: number; strength?: number; dexterity?: number; intelligence?: number; defense?: number; moveSpeed?: number; critChance?: number };
  /** Starting reputation with each faction (-100..100). */
  rep: Partial<Record<FactionId, number>>;
  /** Passive flavour rule shown on the creation screen. */
  perk: string;
  perkId: string;
  look: {
    skins: string[];
    hairs: string[];
    ears: 'human' | 'elf' | 'beast';
    tusks?: boolean;
    height: number;
    bulk: number;
    eyes?: string;
  };
}

export const RACES: RaceDef[] = [
  {
    id: 'human',
    name: 'Human',
    blurb: 'Traders, farmers and soldiers of the Ashfall valley. Adaptable, and trusted almost everywhere.',
    stats: { vitality: 2, strength: 1, dexterity: 1, intelligence: 1 },
    rep: { alliance: 25, northern: 5, forest: 0, guild: 5, arcane: 0, bandits: -5 },
    perk: 'Well Connected — merchants offer 8% better prices.',
    perkId: 'haggler',
    look: { skins: [PAL.skin1, PAL.skin2, PAL.skin3, PAL.skin4], hairs: ['#4a3324', '#2a2029', '#8a6a3a', '#b5462f'], ears: 'human', height: 1, bulk: 1 },
  },
  {
    id: 'elf',
    name: 'Sylvan Elf',
    blurb: 'Long-lived wardens of the western wood. Quick, perceptive, and quietly certain of their own superiority.',
    stats: { dexterity: 3, intelligence: 2, vitality: -1, critChance: 3 },
    rep: { forest: 35, arcane: 15, alliance: 5, northern: -15, guild: -10, bandits: -10 },
    perk: 'Keen Sight — 15% larger discovery radius and +3% critical chance.',
    perkId: 'keensight',
    look: { skins: [PAL.skinElf, PAL.skin1, '#d8c0b8'], hairs: ['#d8cfc4', '#e8c27a', '#5b9247', '#9578e8'], ears: 'elf', height: 1.03, bulk: 0.92, eyes: '#2f6f93' },
  },
  {
    id: 'dwarf',
    name: 'Deepstone Dwarf',
    blurb: 'Smiths and tunnel-wrights of the Ironroot Guild. Stubborn as the rock they carve.',
    stats: { vitality: 4, strength: 2, defense: 3, dexterity: -1, moveSpeed: -3 },
    rep: { guild: 35, northern: 15, alliance: 10, forest: -10, arcane: -5, bandits: -10 },
    perk: 'Forge-Born — equipment repairs and upgrades cost 20% less.',
    perkId: 'forgeborn',
    look: { skins: [PAL.skin2, PAL.skin1, PAL.skin3], hairs: ['#b5462f', '#8a6a3a', '#d8cfc4', '#4a3324'], ears: 'human', height: 0.86, bulk: 1.18 },
  },
  {
    id: 'orc',
    name: 'Ashborn Orc',
    blurb: 'Clanfolk from the northern crags. Strong, direct, and used to being watched closely in human towns.',
    stats: { strength: 4, vitality: 3, intelligence: -2, defense: 1 },
    rep: { northern: 35, bandits: 10, alliance: -15, forest: -20, guild: -5, arcane: -10 },
    perk: 'Blood Fury — deal 15% more damage below half health.',
    perkId: 'bloodfury',
    look: { skins: [PAL.skinOrc, '#6d8a4c', '#8fa86a'], hairs: ['#2a2029', '#4a3324', '#d8cfc4'], ears: 'human', tusks: true, height: 1.1, bulk: 1.22, eyes: '#e8763a' },
  },
  {
    id: 'beastfolk',
    name: 'Beastfolk',
    blurb: 'Wanderers of the plains with the ears and instincts of their totem. Fast, curious, rarely still.',
    stats: { dexterity: 4, vitality: 1, moveSpeed: 6, intelligence: -1 },
    rep: { forest: 20, northern: 10, alliance: -5, bandits: 0, guild: -5, arcane: -5 },
    perk: 'Pathfinder — 10% movement speed and dashes cost less stamina.',
    perkId: 'pathfinder',
    look: { skins: [PAL.skinBeast, '#c9a06a', '#8a6a4a', '#d8cfc4'], hairs: ['#6b4b34', '#c9a86b', '#2a2029', '#a3823f'], ears: 'beast', height: 0.98, bulk: 1.02, eyes: '#d9a441' },
  },
  {
    id: 'revenant',
    name: 'Revenant',
    blurb: 'Someone the grave gave back. Tolerated in the valley, feared elsewhere, and never quite warm to the touch.',
    stats: { intelligence: 3, vitality: 2, defense: 1, moveSpeed: -2 },
    rep: { arcane: 20, bandits: 5, alliance: -10, forest: -15, northern: -10, guild: -10 },
    perk: 'Deathless — revive once per dungeon with 35% health.',
    perkId: 'deathless',
    look: { skins: [PAL.skinUndead, '#a8b4a4', '#c0c8c0'], hairs: ['#d8cfc4', '#38304a', '#6fd0e8'], ears: 'human', height: 1, bulk: 0.96, eyes: '#6fd0e8' },
  },
];

export const RACE_BY_ID: Record<RaceId, RaceDef> = Object.fromEntries(RACES.map((r) => [r.id, r])) as Record<RaceId, RaceDef>;

export interface FactionDef {
  id: FactionId;
  name: string;
  blurb: string;
  color: string;
}

export const FACTIONS: FactionDef[] = [
  { id: 'alliance', name: 'Valley Alliance', blurb: 'The farming towns and militia of the central valley.', color: '#4f9ce8' },
  { id: 'northern', name: 'Northern Clans', blurb: 'Crag-dwelling clans who measure worth in scars.', color: '#8fc4dc' },
  { id: 'forest', name: 'Forest Court', blurb: 'The elven wardens of Thornhollow and their bound spirits.', color: '#6fbf5a' },
  { id: 'guild', name: 'Ironroot Guild', blurb: 'Dwarven smiths, miners and very exacting accountants.', color: '#d9a441' },
  { id: 'bandits', name: 'Ash Cutters', blurb: 'Road-thieves who rule the southern ruins.', color: '#b5462f' },
  { id: 'arcane', name: 'Arcane Concord', blurb: 'Scholars of the broken Modulo, keepers of dangerous books.', color: '#a978e8' },
];

export const FACTION_BY_ID: Record<FactionId, FactionDef> = Object.fromEntries(FACTIONS.map((f) => [f.id, f])) as Record<FactionId, FactionDef>;

export function repTier(value: number): { label: string; color: string } {
  if (value >= 75) return { label: 'Honoured', color: '#f0a93c' };
  if (value >= 40) return { label: 'Trusted', color: '#6fbf5a' };
  if (value >= 15) return { label: 'Friendly', color: '#8fbf4a' };
  if (value > -15) return { label: 'Neutral', color: '#b9b3a8' };
  if (value > -40) return { label: 'Wary', color: '#e8763a' };
  if (value > -75) return { label: 'Hostile', color: '#b5462f' };
  return { label: 'Hated', color: '#8e2131' };
}
