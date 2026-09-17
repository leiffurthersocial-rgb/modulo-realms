import type { WeaponKind } from '../game/art/weaponart';
import type { Rarity } from '../game/items/types';

/**
 * The single source of truth for how strong things are.
 *
 * Every weapon in the game is priced from one curve rather than hand-tuned,
 * so a new weapon only has to declare what it *is* — its kind, its level, its
 * rarity and how fast it swings — and its damage falls out. That is what keeps
 * sixty-odd weapons honest against each other, and what makes adding the next
 * twenty safe: you cannot accidentally author a level-13 rapier that does
 * twice a level-13 maul's damage, because you never write a damage number.
 *
 * To add a tier of content: extend LEVEL_BANDS with the new region and level
 * range, and the curve below already covers it.
 */

/** Melee single-target damage per second, at a given level, before rarity. */
export const meleeDpsAt = (level: number): number => 10 + level * 2.9;

/** Each grade of rarity is worth this much more than the one below. */
export const RARITY_POWER: Record<Rarity, number> = {
  common: 1.0,
  rare: 1.1,
  superRare: 1.18,
  epic: 1.26,
  legendary: 1.4,
};

const RANGED_KINDS = new Set<WeaponKind>(['bow', 'crossbow']);
const MAGIC_KINDS = new Set<WeaponKind>(['staff', 'wand', 'tome', 'orb']);

/**
 * What each class of weapon is paid relative to melee. Reach and safety are
 * expensive: a bow never matches a sword's damage, and is not supposed to.
 */
export const CLASS_POWER = { melee: 1.0, ranged: 0.7, magic: 0.78 } as const;

/**
 * Shape modifiers within melee. A weapon that sweeps a rank gives up a little
 * single-target damage for the extra bodies it catches; one that only ever
 * touches what it is pointed at gets that back.
 */
export const SHAPE_POWER: Partial<Record<WeaponKind, number>> = {
  greatsword: 0.92, greataxe: 0.92, halberd: 0.92, scythe: 0.92, flail: 0.94, claws: 0.96,
  dagger: 1.05, rapier: 1.05, spear: 1.04, warpick: 1.05,
};

export const weaponClass = (kind: WeaponKind): keyof typeof CLASS_POWER =>
  (RANGED_KINDS.has(kind) ? 'ranged' : MAGIC_KINDS.has(kind) ? 'magic' : 'melee');

/** Target damage per second for a weapon of this kind, level and rarity. */
export function weaponDps(kind: WeaponKind, level: number, rarity: Rarity): number {
  const cls = weaponClass(kind);
  const shape = cls === 'melee' ? (SHAPE_POWER[kind] ?? 1) : 1;
  return meleeDpsAt(level) * CLASS_POWER[cls] * shape * RARITY_POWER[rarity];
}

/** Damage per swing, solved from the budget and the weapon's own attack speed. */
export function weaponDamage(kind: WeaponKind, level: number, rarity: Rarity, attackSpeed: number): number {
  return Math.max(1, Math.round(weaponDps(kind, level, rarity) / attackSpeed));
}

/**
 * Armour follows the same idea: one curve, so a new suit is authored by level
 * and rarity and never by guessing a number against the others.
 */
export const armorDefenseAt = (level: number, rarity: Rarity): number =>
  Math.max(1, Math.round((3 + level * 2.1) * RARITY_POWER[rarity]));

/**
 * The level band each region is built for, and the order the world expects to
 * be seen in. Content is placed against this table, and the shops, the loot
 * rolls and the spawn levels all read from the region a thing sits in — so a
 * new region only has to be added here to be wired into all three.
 */
export const LEVEL_BANDS: Array<{ region: string; from: number; to: number; note: string }> = [
  { region: 'central', from: 1, to: 6, note: 'Ashvale Valley — the first hours' },
  { region: 'west', from: 5, to: 14, note: 'Thornhollow — old wood, the Forest Court' },
  { region: 'east', from: 7, to: 15, note: 'The Sunken Mire — bog and drowned ruins' },
  { region: 'south', from: 9, to: 18, note: 'Duneholt Reach — red rock and the Ash Cutters' },
  { region: 'north', from: 12, to: 22, note: 'Crag Reach — the clans and the broken keeps' },
  { region: 'deepnorth', from: 22, to: 34, note: 'The Jotunreach — glacier, and what sleeps under it' },
];

/** The level the game is built to be finished at. */
export const ENDGAME_LEVEL = 34;

/* ------------------------------------------------------------------ */
/* Enemies                                                             */
/* ------------------------------------------------------------------ */

/**
 * What a thing is for, which is the only dial worth having. A skirmisher dies
 * fast and hurts you for approaching; a brute soaks a whole fight; an elite is
 * a named obstacle in a corridor; a boss is the room.
 */
export type EnemyRole = 'skirmisher' | 'standard' | 'brute' | 'elite' | 'boss';

const ROLE_HEALTH: Record<EnemyRole, number> = {
  skirmisher: 0.62, standard: 1, brute: 1.55, elite: 3.2, boss: 7,
};
const ROLE_DEFENSE: Record<EnemyRole, number> = {
  skirmisher: 0.55, standard: 1, brute: 1.6, elite: 1.8, boss: 1.7,
};
const ROLE_XP: Record<EnemyRole, number> = {
  skirmisher: 0.95, standard: 1, brute: 1.15, elite: 3, boss: 7.5,
};

/**
 * These three curves are descriptions of the bestiary that already existed
 * rather than a new rule imposed on it — every enemy written before this
 * table sits within about 15% of it. They are here so the next fifty do too:
 * a new enemy declares its level and its role, and its numbers follow.
 * `scripts/check-balance.ts` prints the deviation for every enemy in the game.
 */
export const enemyHealthAt = (level: number, role: EnemyRole = 'standard'): number =>
  Math.round((24 + level * level * 1.1 + level * 8) * ROLE_HEALTH[role]);

export const enemyDamageAt = (level: number, role: EnemyRole = 'standard'): number =>
  Math.round((5 + level * 2.7) * (role === 'brute' ? 1.12 : role === 'boss' ? 1.15 : 1));

export const enemyDefenseAt = (level: number, role: EnemyRole = 'standard'): number =>
  Math.max(0, Math.round(level * 1.5 * ROLE_DEFENSE[role]));

export const enemyXpAt = (level: number, role: EnemyRole = 'standard'): number =>
  Math.round((9 + level * level * 0.75 + level * 2) * ROLE_XP[role]);
