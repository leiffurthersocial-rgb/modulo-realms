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
  // Mythic is not a tier anything rolls into — it is worn by a handful of
  // hand-written relics, and it is meant to be the best thing in the game.
  mythic: 1.55,
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
  { region: 'undergate', from: 34, to: 40, note: 'Under the Gate — the trial, and the thing the Modulo could not divide' },
];

/**
 * The level the game is built to be finished at — the Last Gate. Everything
 * past it is the trial underneath, which runs to 40 and is not meant to be
 * survivable on the way out of the boss fight above it.
 */
export const ENDGAME_LEVEL = 34;

/** The last level there is content for. */
export const MAX_CONTENT_LEVEL = 40;

/* ------------------------------------------------------------------ */
/* Enemies                                                             */
/* ------------------------------------------------------------------ */

/**
 * What a thing is for, which is the only dial worth having. A skirmisher dies
 * fast and hurts you for approaching; a brute soaks a whole fight; an elite is
 * a named obstacle in a corridor; a boss is the room.
 */
export type EnemyRole = 'skirmisher' | 'standard' | 'brute' | 'elite' | 'boss';

/** Retained so the relative shape of the roles is stated in one place. */
export const ROLE_HEALTH: Record<EnemyRole, number> = {
  skirmisher: 0.62, standard: 1, brute: 1.55, elite: 3.2, boss: 7,
};
const ROLE_DEFENSE: Record<EnemyRole, number> = {
  skirmisher: 0.55, standard: 1, brute: 1.6, elite: 1.8, boss: 1.7,
};
const ROLE_XP: Record<EnemyRole, number> = {
  skirmisher: 0.95, standard: 1, brute: 1.15, elite: 3, boss: 7.5,
};

/**
 * What the player actually kills things with — not what a weapon's tooltip
 * says. This is the number the whole bestiary is priced against, and getting
 * it wrong is how a five-phase boss died in three and a half seconds.
 *
 * The trap: `Player.attackPower()` is `weaponDamage * (1 + primaryStat *
 * 0.022)`. Weapon damage grows with level and so does the primary stat, so
 * real damage per swing grows QUADRATICALLY while `meleeDpsAt` above — the
 * curve weapons are authored against — grows linearly. Measured against a
 * dummy with an era-appropriate build, the real number is 1.6x the weapon
 * curve at level 5, 6.7x at 17 and 37x at 34.
 *
 * So: weapons are still priced against `meleeDpsAt`, because that is what
 * keeps weapons honest AGAINST EACH OTHER. Enemies are priced against this,
 * because this is what they actually have to survive. The two curves answer
 * different questions and must not be confused again.
 *
 * Fitted to measurements at levels 5, 10, 17, 22 and 28 (the level-34
 * best-in-slot mythic build sits well above it, and is meant to).
 */
export const playerDpsAt = (level: number): number => 12 + 1.2 * level * level;

/**
 * How long a fight should last, in seconds, for a player of the right level
 * with a reasonable build. This is the only honest way to state difficulty:
 * a health number means nothing on its own, and a health number that does not
 * move with the player's real damage means nothing at any level.
 *
 * A best-in-slot build clears these in roughly a third of the time; a badly
 * geared one takes two or three times as long. That spread is the point.
 */
export const TIME_TO_KILL: Record<EnemyRole, number> = {
  skirmisher: 2.4,
  standard: 4,
  brute: 7.5,
  elite: 20,
  boss: 55,
};

/**
 * Enemy health, solved from what the player can actually put out. A new enemy
 * declares its level and its role and its health follows, and it stays correct
 * at every level because both sides of the equation are the same shape.
 * `scripts/check-balance.ts` prints the deviation for every enemy in the game.
 */
export const enemyDefenseAt = (level: number, role: EnemyRole = 'standard'): number =>
  Math.max(0, Math.round(level * 1.5 * ROLE_DEFENSE[role]));

export const enemyHealthAt = (level: number, role: EnemyRole = 'standard'): number =>
  // Its own armour is part of how long it lives, so it is divided back out
  // here. Otherwise a heavily armoured boss quietly runs twice its intended
  // length while a lightly armoured one runs short, and neither number in the
  // table means what it says.
  Math.round(playerDpsAt(level) * TIME_TO_KILL[role] * (100 / (100 + enemyDefenseAt(level, role))));

export const enemyDamageAt = (level: number, role: EnemyRole = 'standard'): number =>
  Math.round((5 + level * 2.7) * (role === 'brute' ? 1.12 : role === 'boss' ? 1.15 : 1));

export const enemyXpAt = (level: number, role: EnemyRole = 'standard'): number =>
  Math.round((9 + level * level * 0.75 + level * 2) * ROLE_XP[role]);

/**
 * The two things that are NOT solved by the curves above. Health and defense
 * are derived from TIME_TO_KILL, so there is nothing left to tune there —
 * change the fight length instead. What remains is how hard a hit lands and
 * what the kill pays, applied once in `Enemy`'s constructor.
 */
export const ENEMY_THREAT = {
  damage: 1.75,
  xp: 1.12,
} as const;

/**
 * What the rank and file drop, as a share of what their definition says. The
 * bestiary's own numbers are the *dungeon* rate: an elite or a boss pays them
 * in full. An ordinary enemy is the thing you kill forty of on the way
 * somewhere, and forty of anything filling the pack is what makes loot stop
 * meaning something.
 *
 * `gear` scales the chance of a random weapon/armour roll; `material` scales
 * the listed material and consumable drops. Quest items are never scaled —
 * a bounty that wants nine pelts still wants nine pelts.
 */
export const TRASH_DROP_RATE = {
  gear: 0.4,
  material: 0.55,
} as const;

/* ------------------------------------------------------------------ */
/* Armour                                                              */
/* ------------------------------------------------------------------ */

/**
 * Damage reduction has to be RELATIVE to how far along you are, or it stops
 * being a stat and becomes an off switch.
 *
 * The old rule was `100 / (100 + defense)`, with a fixed 100. Defense grows
 * with level, with gear and with talents — a level-40 build reaches about 635,
 * which under that rule took 86% off every blow in the game. Standing in front
 * of the final boss cost 9% of a health bar over half a minute, which is the
 * other half of why nothing was dangerous.
 *
 * Dividing by a number that grows with the player keeps armour worth taking
 * (it is always a real reduction, and more is always better) while making it
 * impossible to out-scale damage entirely. The cap is the backstop.
 */
export const armorConstantAt = (level: number): number => 60 + 28 * level;

/** Nothing reduces a hit by more than this, whatever you are wearing. */
export const MAX_DAMAGE_REDUCTION = 0.75;

/** The share of a blow that actually lands, for a player of this level. */
export function damageTaken(defense: number, level: number): number {
  const d = Math.max(0, defense);
  const reduction = Math.min(MAX_DAMAGE_REDUCTION, d / (d + armorConstantAt(level)));
  return 1 - reduction;
}
