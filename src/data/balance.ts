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

/**
 * Melee single-target damage per second, at a given level, before rarity.
 *
 * Weapon damage is only half of what a swing actually does — the other half is
 * the primary stat multiplier in `Player.attackPower`, and the two multiply. A
 * steep weapon curve on top of a growing stat is what let a level-15 relic
 * delete a level-34 boss, so the weapon side stays the flatter of the two.
 *
 * It was cut to 1.8 a level, which was an overcorrection: combined with
 * everything else in this file it left ordinary enemies taking real effort,
 * and a wolf on the road should not take effort. Back up to 2.4 — still below
 * the 2.9 it started at, because the runaway it was fixing was real.
 */
export const meleeDpsAt = (level: number): number => 9 + level * 2.4;

/** Each grade of rarity is worth this much more than the one below. */
export const RARITY_POWER: Record<Rarity, number> = {
  common: 1.0,
  rare: 1.06,
  superRare: 1.12,
  epic: 1.19,
  legendary: 1.28,
  // Mythic is not a tier anything rolls into — it is worn by a handful of
  // hand-written relics, and it is meant to be the best thing in the game.
  // The spread is deliberately narrow: a relic should be a better weapon,
  // not a different game.
  mythic: 1.38,
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
  { region: 'west', from: 4, to: 14, note: 'Thornhollow — old wood, gentle ground, terrible bosses' },
  { region: 'east', from: 12, to: 24, note: 'The Sunken Mire — a real step up from the wood' },
  { region: 'north', from: 22, to: 36, note: 'Crag Reach — the clans and the broken keeps' },
  { region: 'south', from: 26, to: 42, note: 'Duneholt Reach — the Ash Cutters, and nothing here is fair' },
  { region: 'farwest', from: 30, to: 40, note: 'The Gloaming — the wood that stopped answering' },
  { region: 'fareast', from: 38, to: 48, note: 'The Saltreach — a dead sea and the tide coming in' },
  { region: 'deepnorth', from: 42, to: 54, note: 'The Jotunreach — glacier, and what sleeps under it' },
  { region: 'farsouth', from: 48, to: 60, note: 'The Cinderwastes — warm ash, and it is warm for a reason' },
  { region: 'sunkenwest', from: 52, to: 62, note: 'The Drowning Reach — where the Gloaming runs into water' },
  { region: 'stormeast', from: 58, to: 68, note: 'The Stormreach — past the salt, under a sky that never clears' },
  { region: 'emberdeep', from: 64, to: 75, note: 'The Emberdeep — the bottom of the world, and the last of it' },
];

/**
 * How dangerous a region is beyond what its level band already says, applied
 * to enemy health in `Enemy`'s constructor.
 *
 * The level band says when you are MEANT to be somewhere. This says what it
 * feels like when you get there, and the two are not the same claim: the
 * Gloaming and the Mire overlap in level and are nothing like each other to
 * stand in.
 *
 * The spread used to run to 2.8, which multiplied fight lengths that were
 * already too long and made every ordinary enemy in the back half of the game
 * a slog. It is a seasoning, not a second difficulty curve — the level band
 * does the real work, and this only tilts it. A sixty percent spread across
 * the whole world is plenty to feel.
 *
 * Thornhollow is the gentle one on purpose — it is where a new character
 * learns the controls — and its BOSSES are exempt, because a soft region with
 * a frightening thing at the bottom of it is the shape the whole west is
 * built around.
 */
export const REGION_DIFFICULTY: Record<string, number> = {
  central: 1.0,
  west: 1.0,
  east: 1.03,
  north: 1.07,
  south: 1.13,
  farwest: 1.09,
  fareast: 1.12,
  deepnorth: 1.15,
  farsouth: 1.2,
  sunkenwest: 1.18,
  stormeast: 1.23,
  emberdeep: 1.3,
};

/**
 * Bosses do not take their region's multiplier — they carry their own, so
 * that a starter region can still have something in its cellar that kills
 * you. The west's bosses are the loudest case: Thornhollow is levelled for a
 * character who has just learned to dodge, and the thing in the grove is not.
 *
 * These keep a much wider spread than the ordinary multiplier above, because
 * a boss is where difficulty belongs. Trash is texture; bosses are the game.
 */
export const REGION_BOSS_DIFFICULTY: Record<string, number> = {
  central: 1.0,
  west: 1.85,
  east: 1.2,
  north: 1.35,
  south: 1.6,
  farwest: 1.45,
  fareast: 1.5,
  deepnorth: 1.55,
  farsouth: 1.75,
  sunkenwest: 1.65,
  stormeast: 1.8,
  emberdeep: 2.0,
};

/**
 * The level the game is built to be finished at. Everything past it is the
 * Emberdeep, which runs to the cap and is not meant to be survivable on the
 * way out of the fight above it.
 */
export const ENDGAME_LEVEL = 68;

/** The last level there is content for. */
export const MAX_CONTENT_LEVEL = 75;

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
 * It is a FIT, not a derivation. Real damage per second is weapon damage times
 * the primary-stat multiplier times attack speed times the critical multiplier,
 * and every one of those four grows with level — so the product is steeper
 * than quadratic, and no formula written by hand from the other curves will
 * land on it. `scripts/measure-dps.ts` builds an actual Player at each level,
 * equips the best gear that level can hold, spends its talent points into
 * damage and prints what comes out. Run it after touching weapons, attributes
 * or talents, and refit this.
 *
 * It is fitted to the TYPICAL build rather than the best-in-slot one, because
 * TIME_TO_KILL below is written as what an ordinary player experiences. A
 * damage-stacked best-in-slot character measures about 1.5x this and clears
 * the stated fight lengths correspondingly faster, which is the spread the
 * whole system is built around.
 *
 * It counts abilities as well as auto-attacks, bounded by what the mana and
 * stamina bars can pay for. Counting only auto-attacks said a level-73 mage
 * dealt a sixth of what a rogue did, when in play it deals more; counting
 * abilities on cooldown with no regard for cost said the opposite just as
 * loudly. Both errors were made during this tuning pass and both would have
 * had the whole game retuned around a wrong number.
 *
 * Current fit: within about 10% of a measured typical build from level 22 up,
 * and deliberately a quarter under it below that — so the opening hours run
 * SHORTER than the stated fight lengths rather than longer. Nothing in the
 * first few hours should take effort.
 */
export const playerDpsAt = (level: number): number =>
  13 + 0.5 * level * level + 0.011 * level * level * level;

/**
 * How long a fight should last, in seconds, for a player of the right level
 * with a reasonable build. This is the only honest way to state difficulty:
 * a health number means nothing on its own, and a health number that does not
 * move with the player's real damage means nothing at any level.
 *
 * These are the real difficulty dial, and they were set far too high — nearly
 * double their original values, on top of a region multiplier that then
 * multiplied them again. The compound result was that a rank-and-file enemy
 * anywhere past the starting valley was a fight, and rank-and-file enemies
 * must not be fights. They are the texture between the fights.
 *
 * The shape to aim for: a skirmisher dies to two or three connecting hits, a
 * standard enemy takes a few seconds of attention, a brute is a decision, and
 * only an elite or a boss is an encounter. Bosses keep most of their length,
 * because a boss is supposed to be long — and their hit caps and immune phases
 * are what make that length interesting rather than merely long.
 *
 * A best-in-slot build clears these in roughly two thirds of the time; a badly
 * geared one takes half again as long. That spread is the point.
 */
export const TIME_TO_KILL: Record<EnemyRole, number> = {
  skirmisher: 0.9,
  standard: 1.6,
  brute: 3.4,
  elite: 9,
  boss: 42,
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

/** What each role is worth in coin relative to an ordinary enemy. */
const ROLE_GOLD: Record<EnemyRole, number> = {
  skirmisher: 0.7, standard: 1, brute: 1.45, elite: 4, boss: 16,
};

/**
 * What a kill pays, as a range.
 *
 * This has to track `valuePremiumAt` or the economy quietly breaks in the back
 * half of the game. Gold drops were hand-written per enemy and barely moved
 * with level — a level-23 corpse paid about 90 and a level-70 one about 114,
 * while the gear on the counter beside it went from 3,000 to 47,000. The
 * result was that shopping worked early and became impossible later, which is
 * the opposite of a difficulty curve.
 *
 * Tying it to the same premium that prices the goods keeps the ratio roughly
 * constant: somewhere around sixty to a hundred ordinary kills for a good
 * weapon at any point in the game, tilting higher toward the end because the
 * end is where gear is supposed to be an ambition.
 */
export const enemyGoldAt = (level: number, role: EnemyRole = 'standard'): [number, number] => {
  const mid = 1.3 * level * valuePremiumAt(level) * ROLE_GOLD[role];
  return [Math.max(0, Math.round(mid * 0.6)), Math.max(1, Math.round(mid * 1.4))];
};

/**
 * The two things that are NOT solved by the curves above. Health and defense
 * are derived from TIME_TO_KILL, so there is nothing left to tune there —
 * change the fight length instead. What remains is how hard a hit lands and
 * what the kill pays, applied once in `Enemy`'s constructor.
 */
export const ENEMY_THREAT = {
  // Cut twice. Rank-and-file enemies should not be able to meaningfully
  // threaten a character who is at or above their level.
  damage: 1.3,
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

/**
 * How far above the player's own level a *randomly rolled* item is allowed
 * to land — shop stock and the gear an ordinary kill drops, alike. A region
 * or a high-level enemy can still make the roll worse than this, never
 * better: it's a ceiling on how good the roll gets, not a promise of how bad
 * it can be. Deterministic, hand-placed rewards (a boss's named unique, a
 * quest payout) are exempt on purpose — those are supposed to be worth
 * reaching for, not something you could already use.
 */
export const LOOT_LEVEL_REACH = 15;

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

/**
 * How much more a thing is worth for being high level, beyond what its raw
 * numbers already say.
 *
 * An item's base value is a linear function of its damage and level, which
 * makes an endgame weapon cost about the same as twenty kills at the level it
 * drops at — the same ratio as a starter sword, so gear never becomes an
 * ambition. Worth grows faster than that: the gap between the second-best
 * weapon in the world and the best one is not one level's worth of anything.
 */
export const valuePremiumAt = (level: number): number => 1 + Math.pow(level / 30, 1.6);

/**
 * A merchant's markup, which climbs with the tier of what is on the counter.
 *
 * This is deliberately separate from `valuePremiumAt`. Raising an item's WORTH
 * inflates both sides of the counter — you pay more, and you are paid more for
 * the loot you bring in, so shopping never actually gets harder. Raising the
 * MARKUP moves only the buying side, which is the thing that should get
 * expensive: a trader in the Emberdeep is the only person for a hundred miles
 * with a level-70 breastplate and prices accordingly.
 *
 * At level 1 this is the 1.25 it has always been. By the cap it is near four.
 */
export const merchantMarkupAt = (level: number): number =>
  1.25 * (1 + Math.pow(Math.max(0, level) / 40, 1.4));

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
export const armorConstantAt = (level: number): number => 58 + 24 * level;

/** Nothing reduces a hit by more than this, whatever you are wearing. */
export const MAX_DAMAGE_REDUCTION = 0.74;

/** The share of a blow that actually lands, for a player of this level. */
export function damageTaken(defense: number, level: number): number {
  const d = Math.max(0, defense);
  const reduction = Math.min(MAX_DAMAGE_REDUCTION, d / (d + armorConstantAt(level)));
  return 1 - reduction;
}
