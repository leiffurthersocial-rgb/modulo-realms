import { PAL } from '../game/art/palette';
import type { Look } from '../game/art/characters';
import type { CreatureKind } from '../game/art/creatures';
import type { FactionId } from './races';
import type { EnemyRole } from './balance';

export type DamageElement = 'physical' | 'fire' | 'frost' | 'arcane' | 'shadow' | 'holy' | 'poison';

export interface DropEntry {
  item: string;
  chance: number;
  min?: number;
  max?: number;
}

export type AttackShape = 'circle' | 'cone' | 'line' | 'ring' | 'projectile' | 'summon' | 'dash' | 'rain';

export interface BossAttack {
  id: string;
  name: string;
  shape: AttackShape;
  /** Seconds of telegraph before the hit lands. */
  windup: number;
  cooldown: number;
  power: number;
  radius?: number;
  range?: number;
  count?: number;
  element: DamageElement;
  color: string;
  /** Only usable from this phase onward. */
  phase?: number;
  summon?: string;
  /**
   * A share of the player's MAXIMUM health, dealt on top of the normal hit and
   * ignoring armour entirely. This is the part of a boss that cannot be
   * out-geared: stacking defense and health makes everything else it does
   * survivable, and makes this exactly as dangerous as it was on the first
   * attempt. A dodge roll still avoids it — the answer is meant to be
   * footwork, not numbers.
   */
  lifeTax?: number;
}

export interface BossPhase {
  /** Trigger when health drops below this fraction. */
  at: number;
  name: string;
  speed: number;
  damage: number;
  /** Shout shown when the phase starts. */
  line: string;
  hazard?: 'fire' | 'poison' | 'frost' | 'shadow' | null;
}

export interface BossDef {
  title: string;
  phases: BossPhase[];
  attacks: BossAttack[];
  arenaMusic?: boolean;
  uniqueDrop: string;
  /**
   * The most a single blow may take off, as a share of the boss's maximum
   * health. A boss that sets this cannot be deleted by a build: whatever the
   * number on your weapon, it takes at least `1 / hitCap` connecting hits, so
   * the fight always runs long enough for the boss to actually use its kit.
   *
   * This exists because it is not possible to out-scale it. The player's real
   * damage grows quadratically with level (weapon damage times primary stat,
   * both linear), so any fixed pool of health is eventually a rounding error —
   * and a five-phase boss that dies in three seconds is not a boss, it is a
   * cutscene. Only put it on the handful of fights that are meant to stay
   * frightening forever.
   */
  hitCap?: number;
  /**
   * Seconds before it stops pacing itself. After this the boss's damage climbs
   * by `enrageRate` per second, without limit, so a fight it is losing is
   * still a fight you can lose. Attrition is not a strategy.
   */
  enrageAfter?: number;
  enrageRate?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  /**
   * What this thing is for. Health, defense and xp are all solved from it and
   * the level, against the player's REAL damage curve — see balance.ts. It is
   * written out on every enemy rather than inferred so that the report in
   * `scripts/check-balance.ts` is checking a claim, not its own guess.
   */
  role: EnemyRole;
  /** Humanoids use the character generator; creatures use the creature generator. */
  kind: 'humanoid' | 'creature';
  look?: Look;
  creature?: { kind: CreatureKind; palette: string; glow?: string };
  scale?: number;
  level: number;
  health: number;
  damage: number;
  defense: number;
  speed: number;
  xp: number;
  gold: [number, number];
  radius: number;
  /** AI tuning. */
  sight: number;
  attackRange: number;
  attackCooldown: number;
  windup: number;
  ranged?: { speed: number; element: DamageElement; color: string; radius: number; arc?: number; count?: number };
  /** Packs aggro together and keep their distance from each other. */
  pack?: boolean;
  /** Flees below this fraction of health. */
  flee?: number;
  element?: DamageElement;
  faction?: FactionId;
  drops: DropEntry[];
  lootChance: number;
  lootBias?: number;
  elite?: boolean;
  boss?: BossDef;
  /** Undead take extra holy damage; beasts extra poison, etc. */
  tags?: string[];
}

const humanLook = (over: Partial<Look>): Look => ({
  skin: PAL.skin2, hair: '#2a2029', hairStyle: 'short', beard: 'none',
  shirt: '#5a4a3a', pants: '#3b3346', boots: '#33231a', belt: '#33231a',
  armor: 'light', ears: 'human', height: 1, bulk: 1, ...over,
});

export const ENEMIES: EnemyDef[] = [
  /* --- beasts --- */
  {
    id: 'wolf', name: 'Grey Wolf', kind: 'creature', creature: { kind: 'wolf', palette: 'wolf' },
    role: 'standard',
    level: 1, health: 52, damage: 7, defense: 2, speed: 92, xp: 12, gold: [0, 4], radius: 13,
    sight: 300, attackRange: 34, attackCooldown: 1.5, windup: 0.32, pack: true, flee: 0.15,
    drops: [{ item: 'q_wolf_pelt', chance: 0.55 }, { item: 'mat_leather', chance: 0.4 }, { item: 'food_meat', chance: 0.25 }],
    lootChance: 0.1, tags: ['beast'],
  },
  {
    id: 'direwolf', name: 'Dire Wolf', kind: 'creature', creature: { kind: 'wolf', palette: 'direwolf' }, scale: 1.25,
    role: 'standard',
    level: 6, health: 203, damage: 18, defense: 9, speed: 104, xp: 48, gold: [2, 10], radius: 16,
    sight: 360, attackRange: 40, attackCooldown: 1.3, windup: 0.3, pack: true,
    drops: [{ item: 'q_wolf_pelt', chance: 0.7 }, { item: 'mat_leather', chance: 0.5, min: 1, max: 2 }],
    lootChance: 0.18, tags: ['beast'],
  },
  {
    id: 'frostwolf', name: 'Frostmane', kind: 'creature', creature: { kind: 'wolf', palette: 'frostwolf', glow: PAL.frost }, scale: 1.2,
    role: 'skirmisher',
    level: 11, health: 346, damage: 30, defense: 9, speed: 108, xp: 116, gold: [6, 18], radius: 16,
    sight: 380, attackRange: 40, attackCooldown: 1.25, windup: 0.3, pack: true, element: 'frost',
    drops: [{ item: 'mat_leather', chance: 0.5, min: 1, max: 3 }, { item: 'mat_crystal', chance: 0.25 }],
    lootChance: 0.24, tags: ['beast'],
  },
  {
    id: 'boar', name: 'Tusked Boar', kind: 'creature', creature: { kind: 'boar', palette: 'boar' },
    role: 'standard',
    level: 3, health: 87, damage: 12, defense: 5, speed: 84, xp: 22, gold: [0, 5], radius: 15,
    sight: 240, attackRange: 36, attackCooldown: 1.8, windup: 0.45,
    drops: [{ item: 'food_meat', chance: 0.6, min: 1, max: 2 }, { item: 'mat_leather', chance: 0.35 }],
    lootChance: 0.1, tags: ['beast'],
  },
  {
    id: 'spider', name: 'Thicket Spider', kind: 'creature', creature: { kind: 'spider', palette: 'spider' },
    role: 'standard',
    level: 2, health: 65, damage: 8, defense: 3, speed: 88, xp: 16, gold: [0, 5], radius: 13,
    sight: 280, attackRange: 32, attackCooldown: 1.4, windup: 0.3, pack: true,
    drops: [{ item: 'mat_cloth', chance: 0.4 }, { item: 'mat_herb', chance: 0.2 }],
    lootChance: 0.1, tags: ['beast'],
  },
  {
    id: 'venomspider', name: 'Bog Weaver', kind: 'creature', creature: { kind: 'spider', palette: 'venomspider', glow: PAL.toxic }, scale: 1.15,
    role: 'standard',
    level: 8, health: 317, damage: 21, defense: 12, speed: 92, xp: 73, gold: [3, 12], radius: 15,
    sight: 320, attackRange: 240, attackCooldown: 2.2, windup: 0.5, element: 'poison',
    ranged: { speed: 230, element: 'poison', color: PAL.toxic, radius: 30 },
    drops: [{ item: 'mat_herb', chance: 0.4 }, { item: 'antidote', chance: 0.3 }, { item: 'mat_essence', chance: 0.1 }],
    lootChance: 0.2, tags: ['beast'],
  },
  {
    id: 'bat', name: 'Cave Bat', kind: 'creature', creature: { kind: 'bat', palette: 'bat' },
    role: 'skirmisher',
    level: 2, health: 40, damage: 6, defense: 2, speed: 118, xp: 15, gold: [0, 3], radius: 11,
    sight: 260, attackRange: 28, attackCooldown: 1.1, windup: 0.22, pack: true,
    drops: [{ item: 'mat_leather', chance: 0.2 }],
    lootChance: 0.06, tags: ['beast'],
  },
  {
    id: 'scorpion', name: 'Dune Scorpion', kind: 'creature', creature: { kind: 'scorpion', palette: 'scorpion' },
    role: 'standard',
    level: 7, health: 255, damage: 20, defense: 11, speed: 78, xp: 60, gold: [2, 12], radius: 15,
    sight: 280, attackRange: 38, attackCooldown: 1.6, windup: 0.4, element: 'poison',
    drops: [{ item: 'antidote', chance: 0.3 }, { item: 'mat_bone', chance: 0.3 }],
    lootChance: 0.18, tags: ['beast'],
  },
  {
    id: 'serpent', name: 'Marsh Serpent', kind: 'creature', creature: { kind: 'serpent', palette: 'serpent' },
    role: 'skirmisher',
    level: 6, health: 126, damage: 17, defense: 5, speed: 96, xp: 46, gold: [1, 8], radius: 14,
    sight: 300, attackRange: 46, attackCooldown: 1.35, windup: 0.28, element: 'poison',
    drops: [{ item: 'mat_leather', chance: 0.4 }, { item: 'antidote', chance: 0.2 }],
    lootChance: 0.15, tags: ['beast'],
  },
  /* --- slimes, spirits, constructs --- */
  {
    id: 'slime', name: 'Bog Slime', kind: 'creature', creature: { kind: 'slime', palette: 'slime' },
    role: 'brute',
    level: 1, health: 97, damage: 6, defense: 2, speed: 52, xp: 14, gold: [0, 4], radius: 13,
    sight: 200, attackRange: 30, attackCooldown: 1.8, windup: 0.4,
    drops: [{ item: 'mat_essence', chance: 0.08 }, { item: 'mat_herb', chance: 0.25 }],
    lootChance: 0.08, tags: ['ooze'],
  },
  {
    id: 'toxicslime', name: 'Rot Slime', kind: 'creature', creature: { kind: 'slime', palette: 'slimeToxic', glow: PAL.toxic },
    role: 'standard',
    level: 7, health: 255, damage: 18, defense: 11, speed: 58, xp: 60, gold: [1, 9], radius: 15,
    sight: 240, attackRange: 34, attackCooldown: 1.7, windup: 0.4, element: 'poison',
    drops: [{ item: 'antidote', chance: 0.35 }, { item: 'mat_essence', chance: 0.15 }],
    lootChance: 0.16, tags: ['ooze'],
  },
  {
    id: 'wisp', name: 'Ley Wisp', kind: 'creature', creature: { kind: 'wisp', palette: 'wisp', glow: PAL.arcaneLit },
    role: 'skirmisher',
    level: 5, health: 97, damage: 15, defense: 4, speed: 86, xp: 36, gold: [2, 10], radius: 12,
    sight: 340, attackRange: 260, attackCooldown: 2.1, windup: 0.55, element: 'arcane',
    ranged: { speed: 200, element: 'arcane', color: PAL.arcaneLit, radius: 28 },
    drops: [{ item: 'mat_crystal', chance: 0.3 }, { item: 'mat_essence', chance: 0.12 }],
    lootChance: 0.16, tags: ['spirit'],
  },
  {
    id: 'emberwisp', name: 'Ember Wisp', kind: 'creature', creature: { kind: 'wisp', palette: 'emberwisp', glow: PAL.flame },
    role: 'skirmisher',
    level: 10, health: 293, damage: 27, defense: 8, speed: 92, xp: 99, gold: [4, 14], radius: 12,
    sight: 360, attackRange: 280, attackCooldown: 1.9, windup: 0.5, element: 'fire',
    ranged: { speed: 230, element: 'fire', color: PAL.flame, radius: 34 },
    drops: [{ item: 'mat_crystal', chance: 0.3 }, { item: 'mat_essence', chance: 0.2 }],
    lootChance: 0.2, tags: ['spirit'],
  },
  {
    id: 'crawler', name: 'Grave Crawler', kind: 'creature', creature: { kind: 'crawler', palette: 'crawler' },
    role: 'standard',
    level: 4, health: 118, damage: 14, defense: 6, speed: 96, xp: 29, gold: [1, 7], radius: 13,
    sight: 300, attackRange: 32, attackCooldown: 1.3, windup: 0.28, pack: true,
    drops: [{ item: 'mat_bone', chance: 0.5 }, { item: 'mat_leather', chance: 0.25 }],
    lootChance: 0.12, tags: ['undead'],
  },
  {
    id: 'wraith', name: 'Hollow Wraith', kind: 'creature', creature: { kind: 'wraith', palette: 'wraith', glow: PAL.frost },
    role: 'skirmisher',
    level: 9, health: 245, damage: 25, defense: 7, speed: 82, xp: 83, gold: [4, 16], radius: 14,
    sight: 340, attackRange: 250, attackCooldown: 2, windup: 0.5, element: 'shadow',
    ranged: { speed: 190, element: 'shadow', color: '#6f7f96', radius: 30 },
    drops: [{ item: 'mat_essence', chance: 0.25 }, { item: 'mat_bone', chance: 0.4 }],
    lootChance: 0.22, tags: ['undead'],
  },
  {
    id: 'golem', name: 'Stone Sentinel', kind: 'creature', creature: { kind: 'golem', palette: 'golem' }, scale: 1.2,
    role: 'brute',
    level: 10, health: 798, damage: 32, defense: 24, speed: 52, xp: 120, gold: [8, 24], radius: 18,
    sight: 280, attackRange: 48, attackCooldown: 2.2, windup: 0.65,
    drops: [{ item: 'mat_crystal', chance: 0.4 }, { item: 'mat_iron_ore', chance: 0.5, min: 1, max: 3 }],
    lootChance: 0.3, tags: ['construct'],
  },
  {
    id: 'sandgolem', name: 'Tomb Guardian', kind: 'creature', creature: { kind: 'golem', palette: 'sandgolem' }, scale: 1.2,
    role: 'standard',
    level: 12, health: 626, damage: 38, defense: 18, speed: 54, xp: 141, gold: [10, 30], radius: 18,
    sight: 300, attackRange: 50, attackCooldown: 2.1, windup: 0.6,
    drops: [{ item: 'mat_gem_ruby', chance: 0.2 }, { item: 'mat_crystal', chance: 0.35 }],
    lootChance: 0.32, tags: ['construct'],
  },
  {
    id: 'sapling', name: 'Thorn Sapling', kind: 'creature', creature: { kind: 'treant', palette: 'treant' }, scale: 0.85,
    role: 'standard',
    level: 8, health: 317, damage: 22, defense: 12, speed: 62, xp: 73, gold: [2, 10], radius: 16,
    sight: 260, attackRange: 46, attackCooldown: 1.9, windup: 0.5, element: 'poison',
    drops: [{ item: 'mat_herb', chance: 0.55, min: 1, max: 2 }, { item: 'mat_essence', chance: 0.12 }],
    lootChance: 0.2, tags: ['plant'],
  },
  /* --- humanoids --- */
  {
    id: 'bandit', name: 'Ash Cutter', kind: 'humanoid',
    look: humanLook({ shirt: '#5a4436', pants: '#3a2f28', hair: '#3a2a20', helmet: 'hood', armorColor: '#4a3a2a', weapon: { kind: 'sword', metal: PAL.iron, grip: PAL.woodDark } }),
    role: 'standard',
    level: 3, health: 87, damage: 13, defense: 5, speed: 84, xp: 22, gold: [4, 14], radius: 13,
    sight: 320, attackRange: 40, attackCooldown: 1.5, windup: 0.35, flee: 0.18, faction: 'bandits',
    drops: [{ item: 'potion_health_s', chance: 0.25 }, { item: 'q_bandit_orders', chance: 0.12 }],
    lootChance: 0.22, tags: ['humanoid'],
  },
  {
    id: 'bandit_archer', name: 'Cutter Bowman', kind: 'humanoid',
    look: humanLook({ shirt: '#4a5a42', pants: '#3a2f28', hair: '#4a3324', helmet: 'hood', armorColor: '#3f4a36', weapon: { kind: 'bow', metal: PAL.wood, grip: PAL.woodDark } }),
    role: 'standard',
    level: 4, health: 118, damage: 15, defense: 6, speed: 88, xp: 29, gold: [5, 16], radius: 13,
    sight: 380, attackRange: 300, attackCooldown: 2, windup: 0.5, flee: 0.25, faction: 'bandits',
    ranged: { speed: 330, element: 'physical', color: PAL.cloth, radius: 20 },
    drops: [{ item: 'potion_health_s', chance: 0.2 }, { item: 'mat_leather', chance: 0.3 }],
    lootChance: 0.24, tags: ['humanoid'],
  },
  {
    id: 'bandit_brute', name: 'Cutter Brute', kind: 'humanoid',
    look: humanLook({ shirt: '#6a4436', pants: '#3a2f28', hair: '#2a2029', hairStyle: 'mohawk', armor: 'heavy', armorColor: '#5a5060', bulk: 1.2, height: 1.06, weapon: { kind: 'greataxe', metal: PAL.iron, grip: PAL.woodDark } }),
    role: 'brute',
    level: 7, health: 454, damage: 26, defense: 17, speed: 74, xp: 69, gold: [10, 28], radius: 15,
    sight: 320, attackRange: 52, attackCooldown: 2.1, windup: 0.55, faction: 'bandits',
    drops: [{ item: 'potion_health_m', chance: 0.25 }, { item: 'mat_iron_ingot', chance: 0.3 }],
    lootChance: 0.3, tags: ['humanoid'],
  },
  {
    id: 'skeleton', name: 'Risen Skeleton', kind: 'humanoid',
    look: humanLook({ skin: PAL.cloth, hair: PAL.bone, hairStyle: 'bald', shirt: '#5a5548', pants: '#3f3a32', eyes: PAL.ember, armor: 'none', weapon: { kind: 'sword', metal: PAL.ironDark, grip: PAL.woodDark } }),
    role: 'standard',
    level: 5, health: 156, damage: 16, defense: 8, speed: 70, xp: 38, gold: [2, 10], radius: 13,
    sight: 300, attackRange: 40, attackCooldown: 1.7, windup: 0.42,
    drops: [{ item: 'mat_bone', chance: 0.6, min: 1, max: 2 }],
    lootChance: 0.2, tags: ['undead'],
  },
  {
    id: 'skeleton_archer', name: 'Bone Archer', kind: 'humanoid',
    look: humanLook({ skin: PAL.cloth, hair: PAL.bone, hairStyle: 'bald', shirt: '#4a4a58', pants: '#38304a', eyes: PAL.frost, armor: 'none', weapon: { kind: 'bow', metal: PAL.bone, grip: PAL.stone } }),
    role: 'skirmisher',
    level: 7, health: 160, damage: 21, defense: 6, speed: 66, xp: 57, gold: [3, 12], radius: 13,
    sight: 380, attackRange: 320, attackCooldown: 2.4, windup: 0.6,
    ranged: { speed: 300, element: 'physical', color: PAL.bone, radius: 20 },
    drops: [{ item: 'mat_bone', chance: 0.6, min: 1, max: 2 }],
    lootChance: 0.22, tags: ['undead'],
  },
  {
    id: 'goblin', name: 'Scrap Goblin', kind: 'humanoid',
    look: humanLook({ skin: '#7d9a5c', hair: '#3a2a20', hairStyle: 'wild', shirt: '#6a5a3a', pants: '#3a2f28', height: 0.8, bulk: 0.9, ears: 'elf', eyes: PAL.flameLit, weapon: { kind: 'dagger', metal: PAL.iron, grip: PAL.woodDark } }),
    role: 'standard',
    level: 2, health: 65, damage: 9, defense: 3, speed: 96, xp: 16, gold: [3, 11], radius: 12,
    sight: 300, attackRange: 34, attackCooldown: 1.2, windup: 0.26, pack: true, flee: 0.22,
    drops: [{ item: 'mat_iron_ore', chance: 0.25 }, { item: 'food_bread', chance: 0.2 }],
    lootChance: 0.16, tags: ['humanoid'],
  },
  {
    id: 'goblin_shaman', name: 'Goblin Hexer', kind: 'humanoid',
    look: humanLook({ skin: '#6d8a4c', hair: PAL.bone, hairStyle: 'wild', shirt: '#4a3a6a', pants: '#2b1f4d', height: 0.82, bulk: 0.9, ears: 'elf', armor: 'robe', helmet: 'hood', armorColor: '#3a2a5a', eyes: PAL.toxic, weapon: { kind: 'staff', metal: PAL.wood, grip: PAL.woodDark, glow: PAL.toxic } }),
    role: 'skirmisher',
    level: 6, health: 126, damage: 20, defense: 5, speed: 78, xp: 46, gold: [6, 18], radius: 12,
    sight: 360, attackRange: 270, attackCooldown: 2.3, windup: 0.6, element: 'poison',
    ranged: { speed: 200, element: 'poison', color: PAL.toxic, radius: 32 },
    drops: [{ item: 'potion_mana_s', chance: 0.3 }, { item: 'mat_crystal', chance: 0.2 }],
    lootChance: 0.24, tags: ['humanoid'],
  },
  {
    id: 'orc_raider', name: 'Crag Raider', kind: 'humanoid',
    look: humanLook({ skin: PAL.skinOrc, hair: '#2a2029', hairStyle: 'ponytail', shirt: '#5a4436', pants: '#3a2f28', tusks: true, height: 1.12, bulk: 1.2, armor: 'light', armorColor: '#5a4436', eyes: PAL.ember, weapon: { kind: 'axe', metal: PAL.iron, grip: PAL.woodDark } }),
    role: 'standard',
    level: 9, health: 383, damage: 30, defense: 14, speed: 80, xp: 88, gold: [8, 26], radius: 15,
    sight: 340, attackRange: 46, attackCooldown: 1.8, windup: 0.45, faction: 'northern',
    drops: [{ item: 'mat_iron_ingot', chance: 0.3 }, { item: 'potion_health_m', chance: 0.2 }],
    lootChance: 0.3, tags: ['humanoid'],
  },
  {
    id: 'cultist', name: 'Concord Apostate', kind: 'humanoid',
    look: humanLook({ skin: PAL.skinUndead, hair: '#38304a', hairStyle: 'long', shirt: '#3a2a5a', pants: '#241d2e', armor: 'robe', helmet: 'hood', armorColor: '#2b1f4d', eyes: PAL.arcaneLit, weapon: { kind: 'wand', metal: PAL.arcane, grip: PAL.woodDark, glow: PAL.arcaneLit } }),
    role: 'skirmisher',
    level: 11, health: 346, damage: 32, defense: 9, speed: 84, xp: 116, gold: [10, 30], radius: 13,
    sight: 380, attackRange: 300, attackCooldown: 2.1, windup: 0.55, element: 'arcane', faction: 'arcane',
    ranged: { speed: 240, element: 'arcane', color: PAL.arcaneLit, radius: 34 },
    drops: [{ item: 'potion_mana_m', chance: 0.3 }, { item: 'mat_essence', chance: 0.2 }, { item: 'q_relic_shard', chance: 0.15 }],
    lootChance: 0.3, tags: ['humanoid'],
  },
  {
    id: 'revenant_knight', name: 'Barrow Knight', kind: 'humanoid',
    look: humanLook({ skin: PAL.skinUndead, hair: '#38304a', hairStyle: 'bald', shirt: '#3f4450', pants: '#2f2c38', armor: 'heavy', helmet: 'full', armorColor: '#4a4655', armorTrim: PAL.frost, bulk: 1.1, eyes: PAL.frost, cape: '#2b1f4d', weapon: { kind: 'greatsword', metal: PAL.ironLit, grip: PAL.woodDark, glow: PAL.frost } }),
    role: 'standard',
    level: 13, health: 716, damage: 42, defense: 20, speed: 72, xp: 162, gold: [16, 44], radius: 16,
    sight: 340, attackRange: 56, attackCooldown: 2, windup: 0.5, element: 'frost',
    drops: [{ item: 'mat_essence', chance: 0.3 }, { item: 'potion_health_l', chance: 0.2 }],
    lootChance: 0.4, lootBias: 0.2, tags: ['undead'],
  },
  /* --- minibosses --- */
  {
    id: 'mini_captain', name: 'Cutter Captain Vosk', kind: 'humanoid', elite: true,
    look: humanLook({ shirt: '#6a3a36', pants: '#3a2f28', hair: '#2a2029', hairStyle: 'ponytail', beard: 'full', armor: 'heavy', armorColor: '#5a4a44', armorTrim: PAL.gold, helmet: 'horned', bulk: 1.15, cape: '#8e2131', weapon: { kind: 'greatsword', metal: PAL.steel, grip: PAL.woodDark } }),
    role: 'elite',
    level: 8, health: 1456, damage: 30, defense: 22, speed: 84, xp: 219, gold: [40, 90], radius: 16,
    sight: 400, attackRange: 56, attackCooldown: 1.7, windup: 0.45, faction: 'bandits',
    drops: [{ item: 'potion_health_m', chance: 1, min: 2, max: 3 }, { item: 'q_bandit_orders', chance: 1 }],
    lootChance: 1, lootBias: 0.5, tags: ['humanoid'],
  },
  {
    id: 'mini_broodmother', name: 'The Brood Mother', kind: 'creature', elite: true,
    creature: { kind: 'spider', palette: 'venomspider', glow: PAL.toxic }, scale: 1.7,
    role: 'elite',
    level: 9, health: 1761, damage: 26, defense: 24, speed: 78, xp: 263, gold: [30, 80], radius: 22,
    sight: 420, attackRange: 260, attackCooldown: 1.9, windup: 0.5, element: 'poison',
    ranged: { speed: 240, element: 'poison', color: PAL.toxic, radius: 36, count: 3, arc: 0.5 },
    drops: [{ item: 'antidote', chance: 1, min: 2, max: 3 }, { item: 'mat_essence', chance: 1 }],
    lootChance: 1, lootBias: 0.5, tags: ['beast'],
  },
  {
    id: 'mini_frostwarden', name: 'Rime Warden', kind: 'creature', elite: true,
    creature: { kind: 'golem', palette: 'golem', glow: PAL.frost }, scale: 1.7,
    role: 'elite',
    level: 12, health: 2800, damage: 40, defense: 32, speed: 56, xp: 423, gold: [50, 120], radius: 24,
    sight: 360, attackRange: 60, attackCooldown: 2.2, windup: 0.7, element: 'frost',
    drops: [{ item: 'q_ice_core', chance: 1 }, { item: 'mat_crystal', chance: 1, min: 2, max: 4 }],
    lootChance: 1, lootBias: 0.6, tags: ['construct'],
  },

  /* ---------------------------------------------------------------- */
  /* The Jotunreach — levels 20 to 30                                  */
  /*                                                                   */
  /* Every line below was priced off enemyHealthAt/enemyDamageAt in    */
  /* balance.ts for the level and role written in its comment, which   */
  /* is what keeps a whole new region in step with a bestiary written  */
  /* twenty levels earlier. `npx tsx scripts/check-balance.ts` proves  */
  /* it and will say so the moment it stops being true.                */
  /* ---------------------------------------------------------------- */
  {
    // lv20 skirmisher: hunts in fours, faster than you, made of nothing much
    id: 'rime_stalker', name: 'Rime Stalker', kind: 'creature', creature: { kind: 'wolf', palette: 'rimewolf', glow: PAL.frost }, scale: 1.3,
    role: 'skirmisher',
    level: 20, health: 1009, damage: 59, defense: 17, speed: 122, xp: 332, gold: [18, 44], radius: 17,
    sight: 440, attackRange: 42, attackCooldown: 1.15, windup: 0.26, pack: true, element: 'frost',
    drops: [{ item: 'mat_leather', chance: 0.5, min: 2, max: 4 }, { item: 'mat_glacier_shard', chance: 0.18 }],
    lootChance: 0.3, tags: ['beast'],
  },
  {
    // lv21 standard: the clans that walked north and did not come back
    id: 'ice_revenant', name: 'Rimewalker', kind: 'humanoid',
    look: humanLook({
      skin: PAL.skinUndead, hair: PAL.frost, hairStyle: 'long', beard: 'full', shirt: '#3f4a58', pants: '#2a323e',
      armor: 'heavy', armorColor: '#5a6a7a', armorTrim: PAL.frost, helmet: 'horned', eyes: PAL.frost, bulk: 1.1,
      weapon: { kind: 'axe', metal: PAL.ironLit, grip: PAL.woodDark, glow: PAL.frost },
    }),
    role: 'standard',
    level: 21, health: 1640, damage: 62, defense: 32, speed: 70, xp: 382, gold: [22, 55], radius: 16,
    sight: 360, attackRange: 54, attackCooldown: 1.9, windup: 0.48, element: 'frost',
    drops: [{ item: 'mat_essence', chance: 0.35 }, { item: 'potion_health_l', chance: 0.25 }, { item: 'mat_glacier_shard', chance: 0.2 }],
    lootChance: 0.45, lootBias: 0.3, tags: ['undead'],
  },
  {
    // lv22 skirmisher: keeps its distance and makes the ground cold
    id: 'winter_shade', name: 'Winter Shade', kind: 'creature', creature: { kind: 'wraith', palette: 'wintershade', glow: PAL.frost }, scale: 1.25,
    role: 'skirmisher',
    level: 22, health: 1206, damage: 64, defense: 18, speed: 96, xp: 395, gold: [20, 52], radius: 15,
    sight: 460, attackRange: 330, attackCooldown: 1.9, windup: 0.5, element: 'frost', flee: 0.12,
    ranged: { speed: 300, element: 'frost', color: PAL.frost, radius: 36, count: 2, arc: 0.35 },
    drops: [{ item: 'mat_essence', chance: 0.4 }, { item: 'potion_mana_m', chance: 0.3 }],
    lootChance: 0.35, tags: ['undead'],
  },
  {
    // lv22 standard: lives under the ice and comes up through it
    id: 'glacier_wyrm', name: 'Glacier Wyrm', kind: 'creature', creature: { kind: 'serpent', palette: 'glacierwyrm', glow: PAL.ice }, scale: 1.5,
    role: 'standard',
    level: 22, health: 1783, damage: 64, defense: 33, speed: 88, xp: 416, gold: [24, 58], radius: 19,
    sight: 400, attackRange: 50, attackCooldown: 1.5, windup: 0.34, element: 'frost',
    drops: [{ item: 'mat_leather', chance: 0.6, min: 2, max: 4 }, { item: 'mat_glacier_shard', chance: 0.25 }],
    lootChance: 0.35, tags: ['beast'],
  },
  {
    // lv23 standard: white-painted hunters who got here first and stayed
    id: 'pale_hunter', name: 'Pale Hunter', kind: 'humanoid',
    look: humanLook({
      skin: '#e8e0d4', hair: PAL.white, hairStyle: 'ponytail', shirt: '#c6d4e0', pants: '#8f9aa8',
      armor: 'light', armorColor: '#c6d4e0', armorTrim: PAL.frost, helmet: 'hood', eyes: PAL.frost,
      weapon: { kind: 'bow', metal: PAL.bone, grip: PAL.cloth },
    }),
    role: 'standard',
    level: 23, health: 1916, damage: 67, defense: 35, speed: 94, xp: 452, gold: [26, 62], radius: 14,
    sight: 520, attackRange: 400, attackCooldown: 1.7, windup: 0.46, faction: 'bandits',
    ranged: { speed: 420, element: 'physical', color: PAL.bone, radius: 22 },
    drops: [{ item: 'potion_health_xl', chance: 0.25 }, { item: 'mat_leather', chance: 0.4, min: 2, max: 3 }],
    lootChance: 0.5, lootBias: 0.3, tags: ['humanoid'],
  },
  {
    // lv24 brute: half again your height, and it swings like it
    id: 'jotun_thrall', name: 'Jotun Thrall', kind: 'humanoid',
    look: humanLook({
      skin: '#9fb0be', hair: '#6b7684', hairStyle: 'long', beard: 'long', shirt: '#4a5a68', pants: '#3a4654',
      armor: 'heavy', armorColor: '#6b7684', armorTrim: PAL.ice, bulk: 1.5, height: 1.2, eyes: PAL.frost,
      weapon: { kind: 'greataxe', metal: PAL.ironLit, grip: PAL.woodDark },
    }),
    scale: 1.45,
    role: 'brute',
    level: 24, health: 3338, damage: 78, defense: 58, speed: 62, xp: 562, gold: [40, 95], radius: 22,
    sight: 380, attackRange: 70, attackCooldown: 2.4, windup: 0.72, element: 'frost',
    drops: [{ item: 'mat_jotun_ingot', chance: 0.3 }, { item: 'potion_health_xl', chance: 0.3 }],
    lootChance: 0.55, lootBias: 0.4, tags: ['giant'],
  },
  {
    // lv25 skirmisher: the people who decided the winter was right
    id: 'herald_winter', name: 'Herald of the Long Winter', kind: 'humanoid',
    look: humanLook({
      skin: PAL.skin1, hair: PAL.white, hairStyle: 'bald', shirt: '#2a3c4e', pants: '#1b2a38',
      armor: 'robe', armorColor: '#2a3c4e', armorTrim: PAL.ice, helmet: 'wizard', eyes: PAL.frost, glow: PAL.frost,
      cape: '#1b2a38', weapon: { kind: 'staff', metal: PAL.ice, grip: PAL.bone, glow: PAL.frost },
    }),
    role: 'skirmisher',
    level: 25, health: 1511, damage: 73, defense: 21, speed: 74, xp: 501, gold: [34, 80], radius: 14,
    sight: 440, attackRange: 360, attackCooldown: 2.1, windup: 0.58, element: 'frost', faction: 'arcane',
    ranged: { speed: 280, element: 'frost', color: PAL.ice, radius: 44, count: 3, arc: 0.45 },
    drops: [{ item: 'mat_essence', chance: 0.5 }, { item: 'mat_glacier_shard', chance: 0.3 }, { item: 'q_relic_shard', chance: 0.2 }],
    lootChance: 0.55, lootBias: 0.4, tags: ['humanoid'],
  },
  {
    // lv26 brute: the glacier learned to stand up
    id: 'glass_golem', name: 'Glass Golem', kind: 'creature', creature: { kind: 'golem', palette: 'icegolem', glow: PAL.frost }, scale: 1.8,
    role: 'brute',
    level: 26, health: 3811, damage: 84, defense: 62, speed: 52, xp: 653, gold: [44, 105], radius: 25,
    sight: 360, attackRange: 66, attackCooldown: 2.5, windup: 0.8, element: 'frost',
    drops: [{ item: 'mat_glacier_shard', chance: 0.6, min: 1, max: 3 }, { item: 'mat_jotun_ingot', chance: 0.25 }],
    lootChance: 0.6, lootBias: 0.5, tags: ['construct'],
  },
  {
    // lv28 brute: the thing the thralls were made in the image of
    id: 'frost_giant', name: 'Frost Giant', kind: 'humanoid',
    look: humanLook({
      skin: '#8fa8ba', hair: PAL.white, hairStyle: 'long', beard: 'long', shirt: '#3a4a5a', pants: '#2a3644',
      armor: 'heavy', armorColor: '#7d8ea0', armorTrim: PAL.white, helmet: 'horned', bulk: 1.6, height: 1.3,
      eyes: PAL.frost, cape: '#c6d4e0', weapon: { kind: 'hammer', metal: PAL.rockPale, grip: PAL.woodDark, glow: PAL.frost },
    }),
    scale: 1.8,
    role: 'brute',
    level: 28, health: 4279, damage: 90, defense: 67, speed: 60, xp: 751, gold: [60, 140], radius: 27,
    sight: 420, attackRange: 84, attackCooldown: 2.6, windup: 0.85, element: 'frost',
    drops: [{ item: 'mat_jotun_ingot', chance: 0.5, min: 1, max: 2 }, { item: 'elixir_grand', chance: 0.3 }],
    lootChance: 0.7, lootBias: 0.6, tags: ['giant'],
  },
  {
    // lv29 brute: a barrow's worth of clan dead, stacked and standing
    id: 'bone_colossus', name: 'Bone Colossus', kind: 'creature', creature: { kind: 'golem', palette: 'bonewrought', glow: PAL.frost }, scale: 2,
    role: 'brute',
    level: 29, health: 4505, damage: 93, defense: 70, speed: 50, xp: 802, gold: [66, 150], radius: 28,
    sight: 380, attackRange: 76, attackCooldown: 2.7, windup: 0.9, element: 'shadow',
    drops: [{ item: 'mat_bone', chance: 1, min: 3, max: 6 }, { item: 'mat_greater_rune', chance: 0.25 }],
    lootChance: 0.7, lootBias: 0.6, tags: ['undead', 'construct'],
  },

  /* ---------------------------------------------------------------- */
  /* The Gloaming, the Saltreach and the Cinderwastes                  */
  /*                                                                   */
  /* Three marches at the outer edge of the map, each a step past the  */
  /* region it grew out of. Priced from balance.ts like everything     */
  /* else; `npx tsx scripts/check-balance.ts` keeps them honest.       */
  /* ---------------------------------------------------------------- */

  /* --- the Gloaming (west, 16-26) --- */
  {
    id: 'gloam_stalker', name: 'Gloam Stalker', kind: 'creature', creature: { kind: 'wolf', palette: 'gloamwolf', glow: PAL.toxic }, scale: 1.3,
    role: 'skirmisher',
    level: 17, health: 755, damage: 51, defense: 14, speed: 126, xp: 247, gold: [12, 34], radius: 17,
    sight: 480, attackRange: 40, attackCooldown: 1.1, windup: 0.24, pack: true, element: 'poison',
    drops: [{ item: 'mat_leather', chance: 0.4, min: 1, max: 3 }, { item: 'mat_herb', chance: 0.3 }],
    lootChance: 0.26, tags: ['beast'],
  },
  {
    id: 'gloam_weaver', name: 'Gloamweaver', kind: 'creature', creature: { kind: 'spider', palette: 'gloamspider', glow: PAL.toxic }, scale: 1.55,
    role: 'standard',
    level: 19, health: 1380, damage: 56, defense: 29, speed: 92, xp: 318, gold: [16, 42], radius: 18,
    sight: 440, attackRange: 320, attackCooldown: 1.8, windup: 0.44, element: 'poison',
    ranged: { speed: 280, element: 'poison', color: PAL.toxic, radius: 34, count: 2, arc: 0.4 },
    drops: [{ item: 'antidote', chance: 0.35 }, { item: 'mat_essence', chance: 0.3 }],
    lootChance: 0.34, tags: ['beast'],
  },
  {
    id: 'hollow_treant', name: 'Hollow Elder', kind: 'creature', creature: { kind: 'treant', palette: 'hollowtreant', glow: PAL.arcaneLit }, scale: 2,
    role: 'brute',
    level: 22, health: 2999, damage: 72, defense: 53, speed: 54, xp: 478, gold: [30, 74], radius: 26,
    sight: 380, attackRange: 78, attackCooldown: 2.5, windup: 0.78, element: 'poison',
    drops: [{ item: 'mat_essence', chance: 0.45 }, { item: 'q_heartseed', chance: 0.2 }],
    lootChance: 0.45, lootBias: 0.3, tags: ['plant'],
  },
  {
    id: 'court_exile', name: 'Court Exile', kind: 'humanoid',
    look: humanLook({
      skin: PAL.skinElf, hair: '#2f4a33', hairStyle: 'long', ears: 'elf', eyes: PAL.toxic,
      shirt: '#1f3a28', pants: '#16281c', armor: 'light', armorColor: '#25412a', armorTrim: PAL.toxic, helmet: 'hood',
      cape: '#132017', weapon: { kind: 'bow', metal: PAL.leafDark, grip: PAL.woodDark, glow: PAL.toxic },
    }),
    role: 'standard',
    level: 24, health: 2059, damage: 70, defense: 36, speed: 96, xp: 489, gold: [30, 70], radius: 14,
    sight: 540, attackRange: 420, attackCooldown: 1.6, windup: 0.44, faction: 'forest',
    ranged: { speed: 440, element: 'poison', color: PAL.toxic, radius: 24 },
    drops: [{ item: 'mat_essence', chance: 0.4 }, { item: 'potion_health_l', chance: 0.3 }],
    lootChance: 0.5, lootBias: 0.35, tags: ['humanoid'],
  },

  /* --- the Saltreach (east, 18-28) --- */
  {
    id: 'brine_crawler', name: 'Brine Crawler', kind: 'creature', creature: { kind: 'crawler', palette: 'brinecrawler', glow: PAL.foam }, scale: 1.45,
    role: 'standard',
    level: 19, health: 1380, damage: 56, defense: 29, speed: 98, xp: 318, gold: [16, 40], radius: 17,
    sight: 400, attackRange: 46, attackCooldown: 1.4, windup: 0.3, pack: true,
    drops: [{ item: 'mat_leather', chance: 0.4, min: 1, max: 3 }, { item: 'antidote', chance: 0.25 }],
    lootChance: 0.3, tags: ['beast'],
  },
  {
    id: 'salt_wraith', name: 'Salt Wraith', kind: 'creature', creature: { kind: 'wraith', palette: 'saltwraith', glow: PAL.foam }, scale: 1.35,
    role: 'skirmisher',
    level: 21, health: 1110, damage: 62, defense: 17, speed: 104, xp: 363, gold: [18, 48], radius: 15,
    sight: 480, attackRange: 340, attackCooldown: 1.8, windup: 0.46, element: 'frost', flee: 0.12,
    ranged: { speed: 320, element: 'frost', color: PAL.foam, radius: 34, count: 2, arc: 0.36 },
    drops: [{ item: 'mat_essence', chance: 0.4 }, { item: 'potion_mana_m', chance: 0.3 }],
    lootChance: 0.34, tags: ['undead'],
  },
  {
    id: 'drowned_legionary', name: 'Drowned Legionary', kind: 'humanoid',
    look: humanLook({
      skin: '#8aa6a2', hair: '#3a4a4a', hairStyle: 'bald', shirt: '#3a5058', pants: '#27363c',
      armor: 'heavy', armorColor: '#6f8e92', armorTrim: PAL.foam, helmet: 'full', eyes: PAL.foam, bulk: 1.1,
      weapon: { kind: 'spear', metal: '#8aa6a2', grip: PAL.woodDark },
    }),
    role: 'standard',
    level: 23, health: 1916, damage: 67, defense: 35, speed: 76, xp: 452, gold: [26, 64], radius: 16,
    sight: 380, attackRange: 70, attackCooldown: 1.9, windup: 0.48,
    drops: [{ item: 'mat_essence', chance: 0.35 }, { item: 'mat_steel_ingot', chance: 0.3 }],
    lootChance: 0.45, lootBias: 0.3, tags: ['undead'],
  },
  {
    id: 'salt_colossus', name: 'Salt Colossus', kind: 'creature', creature: { kind: 'golem', palette: 'saltgolem', glow: PAL.foam }, scale: 1.9,
    role: 'brute',
    level: 26, health: 3800, damage: 84, defense: 62, speed: 54, xp: 653, gold: [44, 104], radius: 25,
    sight: 360, attackRange: 68, attackCooldown: 2.5, windup: 0.8,
    drops: [{ item: 'mat_gem_sapphire', chance: 0.3 }, { item: 'mat_rune', chance: 0.25 }],
    lootChance: 0.6, lootBias: 0.5, tags: ['construct'],
  },

  /* --- the Cinderwastes (south, 20-32) --- */
  {
    id: 'cinder_wisp', name: 'Cinderwisp', kind: 'creature', creature: { kind: 'wisp', palette: 'cinderwisp', glow: PAL.flame }, scale: 1.2,
    role: 'skirmisher',
    level: 21, health: 1110, damage: 62, defense: 17, speed: 118, xp: 363, gold: [18, 46], radius: 14,
    sight: 460, attackRange: 300, attackCooldown: 1.7, windup: 0.4, element: 'fire',
    ranged: { speed: 330, element: 'fire', color: PAL.flame, radius: 36 },
    drops: [{ item: 'mat_essence', chance: 0.4 }, { item: 'mat_herb', chance: 0.3 }],
    lootChance: 0.3, tags: ['elemental'],
  },
  {
    id: 'ash_scorpion', name: 'Ash Scorpion', kind: 'creature', creature: { kind: 'scorpion', palette: 'ashscorpion', glow: PAL.ember }, scale: 1.5,
    role: 'standard',
    level: 23, health: 1916, damage: 67, defense: 35, speed: 96, xp: 452, gold: [24, 60], radius: 18,
    sight: 400, attackRange: 50, attackCooldown: 1.4, windup: 0.32, element: 'fire', pack: true,
    drops: [{ item: 'mat_leather', chance: 0.45, min: 1, max: 3 }, { item: 'antidote', chance: 0.3 }],
    lootChance: 0.34, tags: ['beast'],
  },
  {
    id: 'ash_serpent', name: 'Cinder Serpent', kind: 'creature', creature: { kind: 'serpent', palette: 'ashserpent', glow: PAL.flame }, scale: 1.6,
    role: 'standard',
    level: 26, health: 2516, damage: 75, defense: 39, speed: 100, xp: 568, gold: [30, 72], radius: 19,
    sight: 440, attackRange: 54, attackCooldown: 1.35, windup: 0.3, element: 'fire',
    drops: [{ item: 'mat_leather', chance: 0.5, min: 2, max: 4 }, { item: 'mat_gem_ruby', chance: 0.2 }],
    lootChance: 0.4, tags: ['beast'],
  },
  {
    id: 'cutter_warlord', name: 'Cutter Warlord', kind: 'humanoid',
    look: humanLook({
      skin: PAL.skin2, hair: '#2a2029', hairStyle: 'wild', beard: 'full', shirt: '#5a2a20', pants: '#3a221a',
      armor: 'heavy', armorColor: '#6a3020', armorTrim: PAL.flameLit, helmet: 'horned', bulk: 1.3, height: 1.08,
      eyes: PAL.flameLit, cape: '#8e2131', weapon: { kind: 'greataxe', metal: PAL.ironDark, grip: PAL.woodDark, glow: PAL.ember },
    }),
    scale: 1.25, role: 'brute',
    level: 28, health: 4269, damage: 90, defense: 67, speed: 76, xp: 751, gold: [70, 150], radius: 20,
    sight: 440, attackRange: 76, attackCooldown: 2.2, windup: 0.6, element: 'fire', faction: 'bandits',
    drops: [{ item: 'q_bandit_orders', chance: 0.4 }, { item: 'potion_health_xl', chance: 0.35 }],
    lootChance: 0.6, lootBias: 0.5, tags: ['humanoid'],
  },
  {
    id: 'magma_golem', name: 'Magma Golem', kind: 'creature', creature: { kind: 'golem', palette: 'magmagolem', glow: PAL.flame }, scale: 2,
    role: 'brute',
    level: 31, health: 5022, damage: 99, defense: 74, speed: 52, xp: 911, gold: [80, 170], radius: 27,
    sight: 360, attackRange: 72, attackCooldown: 2.6, windup: 0.85, element: 'fire',
    drops: [{ item: 'mat_gem_ruby', chance: 0.4 }, { item: 'mat_greater_rune', chance: 0.22 }],
    lootChance: 0.7, lootBias: 0.6, tags: ['construct', 'elemental'],
  },

  /* --- northern elites --- */
  {
    id: 'mini_wintercaller', name: 'The Wintercaller', kind: 'humanoid', elite: true,
    look: humanLook({
      skin: PAL.skinUndead, hair: PAL.ice, hairStyle: 'long', shirt: '#22303e', pants: '#1a242e',
      armor: 'robe', armorColor: '#22303e', armorTrim: PAL.white, helmet: 'crown', eyes: PAL.white, glow: PAL.ice,
      cape: '#cfe0ec', weapon: { kind: 'orb', metal: PAL.ice, grip: PAL.bone, glow: PAL.frost },
    }),
    scale: 1.5,
    role: 'elite',
    level: 24, health: 8524, damage: 70, defense: 65, speed: 68, xp: 1467, gold: [180, 340], radius: 20,
    sight: 480, attackRange: 380, attackCooldown: 1.9, windup: 0.55, element: 'frost',
    ranged: { speed: 300, element: 'frost', color: PAL.ice, radius: 46, count: 4, arc: 0.7 },
    drops: [{ item: 'mat_glacier_shard', chance: 1, min: 2, max: 4 }, { item: 'potion_health_xl', chance: 1, min: 2, max: 3 }],
    lootChance: 1, lootBias: 0.8, tags: ['undead'],
  },
  {
    id: 'mini_glacier_maw', name: 'Glacier Maw', kind: 'creature', elite: true,
    creature: { kind: 'crawler', palette: 'glaciermaw', glow: PAL.frost }, scale: 2.2,
    role: 'elite',
    level: 28, health: 10827, damage: 81, defense: 76, speed: 82, xp: 1959, gold: [240, 430], radius: 26,
    sight: 440, attackRange: 70, attackCooldown: 1.8, windup: 0.5, element: 'frost',
    drops: [{ item: 'mat_jotun_ingot', chance: 1, min: 2, max: 3 }, { item: 'elixir_grand', chance: 1, min: 1, max: 2 }],
    lootChance: 1, lootBias: 0.9, tags: ['beast'],
  },
];

/* ------------------------------------------------------------------ */
/* Bosses                                                              */
/* ------------------------------------------------------------------ */

export const BOSSES: EnemyDef[] = [
  {
    id: 'boss_stone_warden', name: 'The Stone Warden', kind: 'creature',
    creature: { kind: 'golem', palette: 'golem', glow: PAL.arcaneLit }, scale: 2.3,
    role: 'boss',
    level: 10, health: 5762, damage: 34, defense: 26, speed: 50, xp: 780, gold: [180, 320], radius: 30,
    sight: 520, attackRange: 70, attackCooldown: 2.4, windup: 0.75,
    drops: [{ item: 'potion_health_l', chance: 1, min: 2, max: 3 }, { item: 'mat_crystal', chance: 1, min: 3, max: 5 }],
    lootChance: 1, lootBias: 1.1, tags: ['construct'],
    boss: {
      title: 'Warden of the Ruined Fortress',
      uniqueDrop: 'unique_wardenheart',
      phases: [
        { at: 1, name: 'Awakening', speed: 1, damage: 1, line: 'THE GATE HOLDS.' },
        { at: 0.55, name: 'Fracture', speed: 1.18, damage: 1.25, line: 'THE GATE... CRACKS.', hazard: 'fire' },
        { at: 0.22, name: 'Collapse', speed: 1.35, damage: 1.5, line: 'THEN NOTHING HOLDS.', hazard: 'fire' },
      ],
      attacks: [
        { id: 'slam', name: 'Ground Slam', shape: 'circle', windup: 0.95, cooldown: 5.5, power: 2.2, radius: 150, element: 'physical', color: PAL.clay },
        { id: 'shards', name: 'Stone Shards', shape: 'projectile', windup: 0.7, cooldown: 4.5, power: 1.2, count: 7, range: 520, element: 'physical', color: PAL.rockPale },
        { id: 'summon', name: 'Call Sentinels', shape: 'summon', windup: 1.2, cooldown: 18, power: 0, count: 2, element: 'physical', color: PAL.arcaneLit, summon: 'golem', phase: 1 },
        { id: 'quake', name: 'Fissure', shape: 'ring', windup: 1.3, cooldown: 11, power: 2.6, radius: 260, element: 'fire', color: PAL.ember, phase: 2 },
      ],
    },
  },
  {
    id: 'boss_hollow_king', name: 'The Hollow King', kind: 'humanoid',
    look: humanLook({
      skin: PAL.skinUndead, hair: '#38304a', hairStyle: 'long', shirt: '#2f3346', pants: '#241d2e',
      armor: 'heavy', armorColor: '#4a4655', armorTrim: PAL.gold, helmet: 'crown', bulk: 1.15, height: 1.1,
      cape: '#4a2a4a', eyes: PAL.arcaneLit, glow: PAL.arcane,
      weapon: { kind: 'greatsword', metal: PAL.ironLit, grip: PAL.woodDark, glow: PAL.arcaneLit },
    }),
    scale: 2.2,
    role: 'boss',
    level: 15, health: 11239, damage: 46, defense: 38, speed: 74, xp: 1558, gold: [280, 480], radius: 28,
    sight: 560, attackRange: 76, attackCooldown: 1.8, windup: 0.5, element: 'shadow',
    drops: [{ item: 'potion_health_l', chance: 1, min: 2, max: 4 }, { item: 'mat_essence', chance: 1, min: 2, max: 4 }],
    lootChance: 1, lootBias: 1.3, tags: ['undead'],
    boss: {
      title: 'Last King of the Barrow Crypt',
      uniqueDrop: 'armor_hollow_court',
      phases: [
        { at: 1, name: 'The Court', speed: 1, damage: 1, line: 'You kneel, or you join them.' },
        { at: 0.6, name: 'The Grave', speed: 1.2, damage: 1.2, line: 'My court is patient. It has waited centuries for you.', hazard: 'shadow' },
        { at: 0.25, name: 'The Crown', speed: 1.45, damage: 1.45, line: 'THE CROWN IS NOT YOURS TO TAKE.', hazard: 'shadow' },
      ],
      attacks: [
        { id: 'combo', name: 'Kingsblade', shape: 'cone', windup: 0.55, cooldown: 3.4, power: 1.7, radius: 120, element: 'physical', color: PAL.ironLit },
        { id: 'darkbolt', name: 'Grave Volley', shape: 'projectile', windup: 0.8, cooldown: 4.2, power: 1.4, count: 5, range: 560, element: 'shadow', color: '#6f7f96' },
        { id: 'raise', name: 'Raise the Court', shape: 'summon', windup: 1.1, cooldown: 16, power: 0, count: 3, element: 'shadow', color: PAL.arcane, summon: 'skeleton' },
        { id: 'blink', name: 'Shadowstep', shape: 'dash', windup: 0.5, cooldown: 8, power: 1.9, range: 320, element: 'shadow', color: PAL.arcaneDark, phase: 1 },
        { id: 'nova', name: 'Crown of Night', shape: 'ring', windup: 1.4, cooldown: 12, power: 3, radius: 300, element: 'shadow', color: PAL.arcane, phase: 2 },
      ],
    },
  },
  {
    id: 'boss_matriarch', name: 'The Forest Matriarch', kind: 'creature',
    creature: { kind: 'treant', palette: 'treant', glow: PAL.toxic }, scale: 2.4,
    role: 'boss',
    level: 13, health: 8883, damage: 40, defense: 33, speed: 58, xp: 1213, gold: [200, 380], radius: 30,
    sight: 540, attackRange: 80, attackCooldown: 2.2, windup: 0.65, element: 'poison',
    drops: [{ item: 'mat_herb', chance: 1, min: 3, max: 6 }, { item: 'q_heartseed', chance: 1 }],
    lootChance: 1, lootBias: 1.2, tags: ['plant'],
    boss: {
      title: 'Heart of the Thornhollow Grove',
      uniqueDrop: 'unique_matriarch',
      phases: [
        { at: 1, name: 'Rooted', speed: 1, damage: 1, line: 'You walk where nothing should walk.' },
        { at: 0.6, name: 'Blooming', speed: 1.15, damage: 1.25, line: 'The grove remembers every axe.', hazard: 'poison' },
        { at: 0.25, name: 'Withering', speed: 1.3, damage: 1.5, line: 'THEN BURN WITH ME.', hazard: 'poison' },
      ],
      attacks: [
        { id: 'sweep', name: 'Bough Sweep', shape: 'cone', windup: 0.7, cooldown: 4, power: 1.8, radius: 150, element: 'physical', color: '#5a3f28' },
        { id: 'spores', name: 'Spore Burst', shape: 'ring', windup: 1, cooldown: 8, power: 1.6, radius: 230, element: 'poison', color: PAL.toxic },
        { id: 'vines', name: 'Grasping Vines', shape: 'rain', windup: 1.1, cooldown: 9, power: 1.5, count: 5, radius: 70, element: 'poison', color: PAL.leaf },
        { id: 'saplings', name: 'Call the Grove', shape: 'summon', windup: 1.2, cooldown: 17, power: 0, count: 3, element: 'poison', color: PAL.leafLit, summon: 'sapling', phase: 1 },
      ],
    },
  },
  {
    id: 'boss_sand_tyrant', name: 'The Sand Tyrant', kind: 'creature',
    creature: { kind: 'scorpion', palette: 'scorpion', glow: PAL.toxic }, scale: 2.4,
    role: 'boss',
    level: 12, health: 7759, damage: 38, defense: 31, speed: 76, xp: 1058, gold: [190, 340], radius: 28,
    sight: 520, attackRange: 66, attackCooldown: 1.9, windup: 0.5, element: 'poison',
    drops: [{ item: 'antidote', chance: 1, min: 2, max: 4 }, { item: 'mat_gem_ruby', chance: 1 }],
    lootChance: 1, lootBias: 1.15, tags: ['beast'],
    boss: {
      title: 'Terror of the Sunken Tomb',
      uniqueDrop: 'unique_sandtyrant',
      phases: [
        { at: 1, name: 'Stalking', speed: 1, damage: 1, line: '' },
        { at: 0.55, name: 'Frenzy', speed: 1.3, damage: 1.25, line: '', hazard: 'poison' },
        { at: 0.2, name: 'Death Throes', speed: 1.5, damage: 1.5, line: '', hazard: 'poison' },
      ],
      attacks: [
        { id: 'sting', name: 'Tail Sting', shape: 'circle', windup: 0.6, cooldown: 3.6, power: 1.9, radius: 110, element: 'poison', color: PAL.toxic },
        { id: 'burrow', name: 'Burrow Strike', shape: 'dash', windup: 0.7, cooldown: 7, power: 2.1, range: 360, element: 'physical', color: PAL.sand },
        { id: 'spit', name: 'Venom Spray', shape: 'projectile', windup: 0.7, cooldown: 4.5, power: 1.3, count: 6, range: 480, element: 'poison', color: PAL.toxic },
        { id: 'brood', name: 'Call the Brood', shape: 'summon', windup: 1, cooldown: 16, power: 0, count: 3, element: 'poison', color: PAL.sandDark, summon: 'scorpion', phase: 1 },
      ],
    },
  },
  {
    id: 'boss_rime_lich', name: 'Vareth, the Rimebound', kind: 'humanoid',
    look: humanLook({
      skin: PAL.skinUndead, hair: PAL.frost, hairStyle: 'long', shirt: '#2f4458', pants: '#1f2942',
      armor: 'robe', armorColor: '#2f4458', armorTrim: PAL.frost, helmet: 'wizard', eyes: PAL.frost, glow: PAL.frost,
      cape: '#1f3a52', weapon: { kind: 'staff', metal: PAL.frost, grip: PAL.ironDark, glow: PAL.frost },
    }),
    scale: 2.1,
    role: 'boss',
    level: 17, health: 13800, damage: 52, defense: 43, speed: 78, xp: 1948, gold: [320, 560], radius: 26,
    sight: 600, attackRange: 400, attackCooldown: 2, windup: 0.6, element: 'frost',
    ranged: { speed: 280, element: 'frost', color: PAL.frost, radius: 40 },
    drops: [{ item: 'elixir_grand', chance: 1 }, { item: 'mat_essence', chance: 1, min: 3, max: 5 }],
    lootChance: 1, lootBias: 1.4, tags: ['undead'],
    boss: {
      title: 'Archivist of the Ashen Spire',
      uniqueDrop: 'art_modulo_shard',
      hitCap: 0.033,
      enrageAfter: 150,
      enrageRate: 0.018,
      phases: [
        { at: 1, name: 'Calculation', speed: 1, damage: 1, line: 'The Modulo divides all things. You are a remainder.' },
        { at: 0.65, name: 'Remainder', speed: 1.2, damage: 1.25, line: 'Curious. You persist.', hazard: 'frost' },
        { at: 0.3, name: 'Zero', speed: 1.4, damage: 1.55, line: 'THEN LET NOTHING REMAIN.', hazard: 'frost' },
      ],
      attacks: [
        { id: 'shards', name: 'Rime Shards', shape: 'projectile', windup: 0.6, cooldown: 3, power: 1.4, count: 8, range: 600, element: 'frost', color: PAL.frost },
        { id: 'blizzard', name: 'Blizzard', shape: 'rain', windup: 1.2, cooldown: 10, power: 1.7, count: 7, radius: 80, element: 'frost', color: PAL.ice },
        { id: 'nova', name: 'Absolute Zero', shape: 'ring', windup: 1.5, cooldown: 13, power: 3.2, radius: 320, element: 'frost', color: PAL.white, lifeTax: 0.12 },
        { id: 'thralls', name: 'Frozen Court', shape: 'summon', windup: 1.1, cooldown: 18, power: 0, count: 3, element: 'frost', color: PAL.ice, summon: 'revenant_knight', phase: 1 },
        { id: 'blink', name: 'Fold Space', shape: 'dash', windup: 0.4, cooldown: 6, power: 1.2, range: 340, element: 'arcane', color: PAL.arcaneLit, phase: 1 },
      ],
    },
  },

  /* ---------------------------------------------------------------- */
  /* The road north                                                    */
  /* ---------------------------------------------------------------- */
  {
    id: 'boss_march_warden', name: 'Hjalmar the Unbroken', kind: 'humanoid',
    look: humanLook({
      skin: '#c8b8a4', hair: '#8f8778', hairStyle: 'long', beard: 'long', shirt: '#4a4450', pants: '#33303c',
      armor: 'heavy', armorColor: '#5a6a7a', armorTrim: PAL.gold, helmet: 'horned', bulk: 1.35, height: 1.1,
      eyes: PAL.flameLit, cape: '#6a2f28',
      weapon: { kind: 'greataxe', metal: PAL.steel, grip: PAL.woodDark },
    }),
    scale: 2.2,
    role: 'boss',
    level: 19, health: 16545, damage: 62, defense: 48, speed: 80, xp: 2383, gold: [420, 720], radius: 26,
    sight: 520, attackRange: 84, attackCooldown: 1.9, windup: 0.55, faction: 'northern',
    drops: [{ item: 'potion_health_xl', chance: 1, min: 2, max: 4 }, { item: 'mat_glacier_shard', chance: 1, min: 2, max: 3 }],
    lootChance: 1, lootBias: 1.2, tags: ['humanoid'],
    boss: {
      title: 'Last Captain of the Frostmarch',
      uniqueDrop: 'art_winter_horn',
      phases: [
        { at: 1, name: 'The Watch', speed: 1, damage: 1, line: 'The march holds. It has held for ninety years and it holds today.' },
        { at: 0.6, name: 'The Breach', speed: 1.2, damage: 1.25, line: 'You came up the road. Nothing has come up the road in a long time.' },
        { at: 0.25, name: 'The Last Order', speed: 1.45, damage: 1.5, line: 'Then I will hold it alone. As I have. AS I HAVE.', hazard: 'frost' },
      ],
      attacks: [
        { id: 'cleave', name: 'Broadaxe Sweep', shape: 'cone', windup: 0.6, cooldown: 4, power: 1.5, radius: 180, element: 'physical', color: PAL.steel },
        { id: 'charge', name: 'Shield Rush', shape: 'dash', windup: 0.5, cooldown: 7, power: 1.6, range: 380, element: 'physical', color: PAL.ironLit },
        { id: 'stomp', name: 'Ground Break', shape: 'ring', windup: 1.1, cooldown: 11, power: 2.2, radius: 250, element: 'physical', color: PAL.rockPale },
        { id: 'levy', name: 'Call the Levy', shape: 'summon', windup: 1, cooldown: 20, power: 0, count: 3, element: 'frost', color: PAL.frost, summon: 'ice_revenant', phase: 1 },
        { id: 'volley', name: 'Signal Volley', shape: 'rain', windup: 1.2, cooldown: 13, power: 1.5, count: 6, radius: 78, element: 'physical', color: PAL.bone, phase: 2 },
      ],
    },
  },

  /* ---------------------------------------------------------------- */
  /* The Jotunreach                                                    */
  /* ---------------------------------------------------------------- */
  {
    id: 'boss_riven_choir', name: 'The Riven Choir', kind: 'creature',
    creature: { kind: 'wraith', palette: 'wintershade', glow: PAL.ice }, scale: 2.5,
    role: 'boss',
    level: 24, health: 24022, damage: 80, defense: 61, speed: 74, xp: 3668, gold: [560, 940], radius: 26,
    sight: 620, attackRange: 420, attackCooldown: 1.9, windup: 0.55, element: 'frost',
    ranged: { speed: 300, element: 'frost', color: PAL.ice, radius: 44, count: 3, arc: 0.5 },
    drops: [{ item: 'elixir_grand', chance: 1, min: 2, max: 3 }, { item: 'mat_greater_rune', chance: 1 }],
    lootChance: 1, lootBias: 1.3, tags: ['undead'],
    boss: {
      title: 'What Is Left Singing in the Riven Cathedral',
      uniqueDrop: 'art_glacier_heart',
      hitCap: 0.025,
      enrageAfter: 150,
      enrageRate: 0.02,
      phases: [
        { at: 1, name: 'Plainsong', speed: 1, damage: 1, line: 'We were forty. We are one. Sit, and we will teach you the part you sing.' },
        { at: 0.62, name: 'Descant', speed: 1.25, damage: 1.3, line: 'You are singing it wrong.', hazard: 'frost' },
        { at: 0.28, name: 'Silence', speed: 1.5, damage: 1.6, line: 'THEN WE WILL SING OVER YOU.', hazard: 'frost' },
      ],
      attacks: [
        { id: 'chord', name: 'Chord', shape: 'projectile', windup: 0.55, cooldown: 3, power: 1.3, count: 7, range: 640, element: 'frost', color: PAL.ice },
        { id: 'antiphon', name: 'Antiphon', shape: 'line', windup: 1, cooldown: 8, power: 2.1, range: 620, element: 'frost', color: PAL.white },
        { id: 'chorus', name: 'Full Chorus', shape: 'ring', windup: 1.4, cooldown: 12, power: 2.6, radius: 340, element: 'frost', color: PAL.frost, phase: 1, lifeTax: 0.14 },
        { id: 'voices', name: 'The Other Voices', shape: 'summon', windup: 1.1, cooldown: 19, power: 0, count: 4, element: 'frost', color: PAL.ice, summon: 'winter_shade', phase: 1 },
        { id: 'hail', name: 'Hailfall', shape: 'rain', windup: 1.2, cooldown: 10, power: 1.7, count: 9, radius: 82, element: 'frost', color: PAL.white, phase: 2 },
      ],
    },
  },
  {
    id: 'boss_jotun_king', name: 'Bekkr, the Barrow-Jotun', kind: 'humanoid',
    look: humanLook({
      skin: '#8fa8ba', hair: PAL.white, hairStyle: 'long', beard: 'long', shirt: '#2f3c48', pants: '#232d38',
      armor: 'heavy', armorColor: '#8f9aa8', armorTrim: PAL.gold, helmet: 'crown', bulk: 1.7, height: 1.35,
      eyes: PAL.frost, glow: PAL.frost, cape: '#4a5a6a',
      weapon: { kind: 'greataxe', metal: '#bcd8e8', grip: PAL.woodDark, glow: PAL.frost },
    }),
    scale: 2.6,
    role: 'boss',
    level: 28, health: 30646, damage: 93, defense: 71, speed: 66, xp: 4898, gold: [820, 1350], radius: 30,
    sight: 560, attackRange: 96, attackCooldown: 2.2, windup: 0.7, element: 'frost',
    drops: [{ item: 'mat_jotun_ingot', chance: 1, min: 3, max: 5 }, { item: 'elixir_grand', chance: 1, min: 2, max: 3 }],
    lootChance: 1, lootBias: 1.4, tags: ['giant'],
    boss: {
      title: 'King Under the Long Barrow',
      uniqueDrop: 'unique_jotunbane',
      hitCap: 0.02,
      enrageAfter: 150,
      enrageRate: 0.025,
      phases: [
        { at: 1, name: 'Waking', speed: 1, damage: 1, line: 'Small thing. Loud thing. You have woken a tired king.' },
        { at: 0.7, name: 'Standing', speed: 1.18, damage: 1.22, line: 'Ah. You meant it.' },
        { at: 0.4, name: 'Wrath', speed: 1.35, damage: 1.45, line: 'I buried my own axe so I would never do this again.', hazard: 'frost' },
        { at: 0.15, name: 'The Old Way', speed: 1.6, damage: 1.7, line: 'THEN WE DO IT THE OLD WAY.', hazard: 'frost' },
      ],
      attacks: [
        { id: 'sweep', name: 'Barrow Sweep', shape: 'cone', windup: 0.7, cooldown: 4.5, power: 1.6, radius: 230, element: 'physical', color: PAL.ironLit },
        { id: 'quake', name: 'Barrowquake', shape: 'ring', windup: 1.3, cooldown: 10, power: 2.4, radius: 360, element: 'physical', color: PAL.rockPale, lifeTax: 0.16 },
        { id: 'hurl', name: 'Hurled Cairn', shape: 'projectile', windup: 0.9, cooldown: 6, power: 1.9, count: 3, range: 620, element: 'physical', color: PAL.rock },
        { id: 'stride', name: 'Long Stride', shape: 'dash', windup: 0.5, cooldown: 8, power: 1.7, range: 460, element: 'frost', color: PAL.frost, phase: 1 },
        { id: 'honour', name: 'Honour Guard', shape: 'summon', windup: 1.2, cooldown: 22, power: 0, count: 3, element: 'frost', color: PAL.ice, summon: 'jotun_thrall', phase: 2 },
        { id: 'calving', name: 'Calving', shape: 'rain', windup: 1.4, cooldown: 11, power: 2, count: 10, radius: 86, element: 'frost', color: PAL.ice, phase: 2 },
      ],
    },
  },

  /* ---------------------------------------------------------------- */
  /* The Last Gate                                                     */
  /*                                                                   */
  /* The end of the game. Five phases, eleven attacks, and the only    */
  /* enemy in the world drawn at three times a person's height.        */
  /* Everything the northern clans will not say out loud is this.      */
  /* ---------------------------------------------------------------- */
  {
    id: 'boss_winter_jarl', name: 'Aldrhrim, the Winter That Walks', kind: 'humanoid',
    look: humanLook({
      skin: '#cfe0ec', hair: PAL.white, hairStyle: 'long', beard: 'long', shirt: '#1b2a38', pants: '#141d28',
      armor: 'heavy', armorColor: '#9fc4d8', armorTrim: PAL.white, helmet: 'crown', bulk: 1.8, height: 1.4,
      eyes: PAL.white, glow: PAL.frost, cape: '#e6f4fb',
      weapon: { kind: 'greatsword', metal: '#e6f4fb', grip: PAL.bone, glow: PAL.frost },
    }),
    scale: 3.1,
    role: 'boss',
    level: 32, health: 37497, damage: 105, defense: 82, speed: 72, xp: 6308, gold: [1600, 2600], radius: 38,
    sight: 720, attackRange: 120, attackCooldown: 2.1, windup: 0.65, element: 'frost',
    ranged: { speed: 320, element: 'frost', color: PAL.white, radius: 52 },
    drops: [
      { item: 'unique_winters_edge', chance: 1 },
      // The Leviathan Axe was a northern relic nobody had a reliable way to
      // find. It is the thing the clans failed to kill Aldrhrim with, so this
      // is where it is: on the floor of the Last Gate, guaranteed.
      { item: 'unique_leviathan', chance: 1 },
      { item: 'armor_gatekeeper', chance: 1 },
      { item: 'elixir_grand', chance: 1, min: 4, max: 6 },
      { item: 'mat_greater_rune', chance: 1, min: 2, max: 4 },
    ],
    lootChance: 1, lootBias: 2, tags: ['giant', 'undead'],
    boss: {
      title: 'What the Jotunreach Was Built To Keep In',
      arenaMusic: true,
      uniqueDrop: 'art_last_gate',
      // 80 connecting hits, minimum, whatever you are carrying. At a
      // greatsword's swing rate that is a hair over ninety seconds of a
      // five-phase boss using its whole kit on you, and it is ninety seconds
      // at level 32 and at level 60.
      hitCap: 0.0125,
      // And it does not wait you out. Two minutes in, every blow starts
      // climbing 3% a second, forever.
      enrageAfter: 120,
      enrageRate: 0.03,
      phases: [
        { at: 1, name: 'The Gate', speed: 1, damage: 1, line: 'You walked a very long way to be told no.' },
        { at: 0.8, name: 'The Cold', speed: 1.15, damage: 1.2, line: 'The clans put a door here. A door. Against me.', hazard: 'frost' },
        { at: 0.55, name: 'The Walk', speed: 1.35, damage: 1.4, line: 'I have been walking south for four hundred years. You are in the way of a season.', hazard: 'frost' },
        { at: 0.3, name: 'The Long Night', speed: 1.55, damage: 1.65, line: 'Ashvale. I remember when it had another name. I will remember this one too.', hazard: 'frost' },
        { at: 0.1, name: 'Winter', speed: 1.85, damage: 2, line: 'THEN LET IT BE WINTER EVERYWHERE.', hazard: 'frost' },
      ],
      attacks: [
        { id: 'edge', name: "Winter's Edge", shape: 'cone', windup: 0.65, cooldown: 4, power: 1.5, radius: 280, element: 'frost', color: PAL.white },
        { id: 'glacier', name: 'Glacier Step', shape: 'dash', windup: 0.45, cooldown: 7, power: 1.8, range: 540, element: 'frost', color: PAL.ice },
        { id: 'shards', name: 'Splinter', shape: 'projectile', windup: 0.6, cooldown: 3.2, power: 1.3, count: 9, range: 700, element: 'frost', color: PAL.frost },
        { id: 'wall', name: 'The Gate Closes', shape: 'line', windup: 1.1, cooldown: 9, power: 2.2, range: 700, element: 'frost', color: PAL.ice, phase: 1, lifeTax: 0.14 },
        { id: 'nova', name: 'Killing Frost', shape: 'ring', windup: 1.5, cooldown: 12, power: 2.8, radius: 400, element: 'frost', color: PAL.white, phase: 1, lifeTax: 0.18 },
        { id: 'thralls', name: 'The Long March', shape: 'summon', windup: 1.2, cooldown: 24, power: 0, count: 3, element: 'frost', color: PAL.ice, summon: 'jotun_thrall', phase: 2 },
        { id: 'blizzard', name: 'The Long Night', shape: 'rain', windup: 1.3, cooldown: 10, power: 2, count: 12, radius: 92, element: 'frost', color: PAL.ice, phase: 2 },
        { id: 'stomp', name: 'Break the Floor', shape: 'circle', windup: 1, cooldown: 7, power: 2.1, radius: 240, element: 'physical', color: PAL.rockPale, phase: 2 },
        { id: 'heralds', name: 'The Choir Follows', shape: 'summon', windup: 1.1, cooldown: 26, power: 0, count: 4, element: 'frost', color: PAL.frost, summon: 'winter_shade', phase: 3 },
        { id: 'winter', name: 'Everywhere', shape: 'ring', windup: 1.8, cooldown: 15, power: 3.6, radius: 560, element: 'frost', color: PAL.white, phase: 4, lifeTax: 0.34 },
        { id: 'hunt', name: 'The Season Turns', shape: 'rain', windup: 0.9, cooldown: 6, power: 2.2, count: 14, radius: 96, element: 'frost', color: PAL.white, phase: 4 },
      ],
    },
  },

  /* ---------------------------------------------------------------- */
  /* The outer marches                                                 */
  /* ---------------------------------------------------------------- */
  {
    id: 'boss_gloam_mother', name: 'The Gloaming Itself', kind: 'creature',
    creature: { kind: 'treant', palette: 'hollowtreant', glow: PAL.toxic }, scale: 3,
    role: 'boss',
    level: 25, health: 25555, damage: 83, defense: 64, speed: 58, xp: 3958, gold: [640, 1080], radius: 36,
    sight: 640, attackRange: 130, attackCooldown: 2.1, windup: 0.65, element: 'poison',
    ranged: { speed: 280, element: 'poison', color: PAL.toxic, radius: 46 },
    drops: [{ item: 'q_heartseed', chance: 1 }, { item: 'elixir_grand', chance: 1, min: 2, max: 3 }, { item: 'mat_greater_rune', chance: 1 }],
    lootChance: 1, lootBias: 1.3, tags: ['plant'],
    boss: {
      title: 'The Wood That Stopped Answering',
      uniqueDrop: 'art_gloaming_seed',
      hitCap: 0.025,
      enrageAfter: 150,
      enrageRate: 0.02,
      phases: [
        { at: 1, name: 'Canopy', speed: 1, damage: 1, line: 'The Court asked the wood to be a garden. The wood declined.' },
        { at: 0.6, name: 'Undergrowth', speed: 1.24, damage: 1.3, line: 'You are standing in me. You have been for an hour.', hazard: 'poison' },
        { at: 0.26, name: 'Root', speed: 1.5, damage: 1.6, line: 'THEN BE COMPOST.', hazard: 'poison' },
      ],
      attacks: [
        { id: 'lash', name: 'Bough Lash', shape: 'cone', windup: 0.6, cooldown: 3.6, power: 1.5, radius: 260, element: 'physical', color: PAL.leafLit },
        { id: 'spores', name: 'Spores', shape: 'ring', windup: 1.2, cooldown: 10, power: 2.3, radius: 340, element: 'poison', color: PAL.toxic, lifeTax: 0.13 },
        { id: 'thorns', name: 'Thornfall', shape: 'rain', windup: 1.1, cooldown: 8, power: 1.8, count: 9, radius: 84, element: 'poison', color: PAL.leaf },
        { id: 'saplings', name: 'It Has Children', shape: 'summon', windup: 1.1, cooldown: 18, power: 0, count: 4, element: 'poison', color: PAL.toxic, summon: 'hollow_treant', phase: 1 },
        { id: 'grasp', name: 'Rootgrasp', shape: 'line', windup: 0.9, cooldown: 7, power: 2, range: 600, element: 'poison', color: PAL.leafDark, phase: 1 },
      ],
    },
  },
  {
    id: 'boss_tide_king', name: 'The Tide That Was A King', kind: 'humanoid',
    look: humanLook({
      skin: '#8aa6a2', hair: '#9fc0c8', hairStyle: 'long', beard: 'long', shirt: '#2f4a52', pants: '#1d3138',
      armor: 'heavy', armorColor: '#6f8e92', armorTrim: PAL.gold, helmet: 'crown', bulk: 1.5, height: 1.25,
      eyes: PAL.foam, glow: PAL.foam, cape: '#33585c',
      weapon: { kind: 'halberd', metal: '#9fc0c8', grip: PAL.woodDark, glow: PAL.foam },
    }),
    scale: 2.7, role: 'boss',
    level: 27, health: 28860, damage: 90, defense: 69, speed: 70, xp: 4573, gold: [760, 1240], radius: 32,
    sight: 640, attackRange: 110, attackCooldown: 2, windup: 0.6, element: 'frost',
    ranged: { speed: 300, element: 'frost', color: PAL.foam, radius: 44 },
    drops: [{ item: 'elixir_grand', chance: 1, min: 2, max: 4 }, { item: 'mat_gem_sapphire', chance: 1, min: 2, max: 3 }],
    lootChance: 1, lootBias: 1.35, tags: ['undead'],
    boss: {
      title: 'Crowned Under Water, Drowned Above It',
      uniqueDrop: 'art_tidecrown',
      hitCap: 0.022,
      enrageAfter: 150,
      enrageRate: 0.022,
      phases: [
        { at: 1, name: 'Low Water', speed: 1, damage: 1, line: 'My court is out there. All of it. Under the salt.' },
        { at: 0.66, name: 'Flood', speed: 1.22, damage: 1.28, line: 'The tide does not negotiate. Neither did I.', hazard: 'frost' },
        { at: 0.3, name: 'High Water', speed: 1.5, damage: 1.6, line: 'COME DOWN AND MEET THEM.', hazard: 'frost' },
      ],
      attacks: [
        { id: 'sweep', name: 'Halberd Sweep', shape: 'cone', windup: 0.55, cooldown: 3.4, power: 1.5, radius: 250, element: 'physical', color: '#9fc0c8' },
        { id: 'surge', name: 'Surge', shape: 'line', windup: 0.9, cooldown: 7, power: 2.1, range: 660, element: 'frost', color: PAL.foam },
        { id: 'tide', name: 'The Tide Comes In', shape: 'ring', windup: 1.5, cooldown: 12, power: 2.7, radius: 380, element: 'frost', color: PAL.water, lifeTax: 0.15 },
        { id: 'court', name: 'His Court', shape: 'summon', windup: 1.1, cooldown: 19, power: 0, count: 4, element: 'frost', color: PAL.foam, summon: 'drowned_legionary', phase: 1 },
        { id: 'undertow', name: 'Undertow', shape: 'dash', windup: 0.45, cooldown: 7, power: 1.7, range: 420, element: 'frost', color: PAL.water, phase: 1 },
        { id: 'squall', name: 'Squall', shape: 'rain', windup: 1.1, cooldown: 9, power: 1.9, count: 10, radius: 88, element: 'frost', color: PAL.foam, phase: 2 },
      ],
    },
  },
  {
    id: 'boss_cinder_maw', name: 'Vulgrim, the Cinder Maw', kind: 'creature',
    creature: { kind: 'golem', palette: 'magmagolem', glow: PAL.flame }, scale: 3.2,
    role: 'boss',
    level: 31, health: 35802, damage: 102, defense: 79, speed: 64, xp: 5938, gold: [1100, 1800], radius: 40,
    sight: 700, attackRange: 140, attackCooldown: 1.9, windup: 0.6, element: 'fire',
    ranged: { speed: 320, element: 'fire', color: PAL.flame, radius: 52 },
    drops: [{ item: 'elixir_grand', chance: 1, min: 3, max: 5 }, { item: 'mat_greater_rune', chance: 1, min: 2, max: 3 }],
    lootChance: 1, lootBias: 1.6, tags: ['construct', 'elemental'],
    boss: {
      title: 'What Duneholt Pays The Cutters To Ignore',
      arenaMusic: true,
      uniqueDrop: 'art_cinder_core',
      hitCap: 0.016,
      enrageAfter: 130,
      enrageRate: 0.028,
      phases: [
        { at: 1, name: 'Banked', speed: 1, damage: 1, line: 'You have walked a long way over the lid of me.' },
        { at: 0.78, name: 'Drawing', speed: 1.16, damage: 1.2, line: 'The ash out there is what is left of the last one.', hazard: 'fire' },
        { at: 0.52, name: 'Open Flame', speed: 1.34, damage: 1.45, line: 'Duneholt pays the Cutters to keep people off my roof. It works.', hazard: 'fire' },
        { at: 0.26, name: 'Runaway', speed: 1.56, damage: 1.7, line: 'You are not people. Fine.', hazard: 'fire' },
        { at: 0.09, name: 'Everything Burns', speed: 1.9, damage: 2.1, line: 'THEN LET THE WASTE HAVE THE VALLEY TOO.', hazard: 'fire' },
      ],
      attacks: [
        { id: 'bite', name: 'Maw', shape: 'cone', windup: 0.6, cooldown: 3.4, power: 1.6, radius: 300, element: 'fire', color: PAL.flame },
        { id: 'spit', name: 'Cinderspit', shape: 'projectile', windup: 0.55, cooldown: 3, power: 1.4, count: 9, range: 700, element: 'fire', color: PAL.ember },
        { id: 'eruption', name: 'Eruption', shape: 'rain', windup: 1.2, cooldown: 8, power: 2, count: 12, radius: 92, element: 'fire', color: PAL.flameLit },
        { id: 'flow', name: 'Pyroclast', shape: 'ring', windup: 1.5, cooldown: 12, power: 2.8, radius: 420, element: 'fire', color: PAL.flameLit, phase: 1, lifeTax: 0.19 },
        { id: 'lunge', name: 'Lunge', shape: 'dash', windup: 0.4, cooldown: 6, power: 1.8, range: 500, element: 'fire', color: PAL.ember, phase: 1 },
        { id: 'brood', name: 'The Waste Answers', shape: 'summon', windup: 1.1, cooldown: 20, power: 0, count: 4, element: 'fire', color: PAL.flame, summon: 'magma_golem', phase: 2 },
        { id: 'caldera', name: 'Caldera', shape: 'ring', windup: 1.9, cooldown: 16, power: 3.8, radius: 620, element: 'fire', color: PAL.white, phase: 3, lifeTax: 0.33 },
      ],
    },
  },

  /* ---------------------------------------------------------------- */
  /* Under the Gate                                                    */
  /*                                                                   */
  /* Past Aldrhrim, down. Nothing here is level-appropriate for anyone. */
  /* ---------------------------------------------------------------- */
  {
    id: 'boss_remainder', name: 'The Remainder', kind: 'creature',
    creature: { kind: 'wisp', palette: 'wisp', glow: PAL.white }, scale: 3.4,
    role: 'boss',
    level: 40, health: 52604, damage: 130, defense: 102, speed: 86, xp: 9668, gold: [4000, 7000], radius: 44,
    sight: 900, attackRange: 160, attackCooldown: 1.8, windup: 0.55, element: 'arcane',
    ranged: { speed: 340, element: 'arcane', color: PAL.arcaneLit, radius: 56 },
    drops: [
      { item: 'unique_remainder', chance: 1 },
      { item: 'elixir_grand', chance: 1, min: 6, max: 9 },
      { item: 'mat_greater_rune', chance: 1, min: 4, max: 7 },
    ],
    lootChance: 1, lootBias: 2.4, tags: ['construct'],
    boss: {
      title: 'What Would Not Divide',
      arenaMusic: true,
      uniqueDrop: 'art_remainder',
      // 100 connecting hits. There is no build, at any level, that shortens
      // this fight below about two minutes, and the enrage means those two
      // minutes get worse rather than safer. This is the one the game is
      // willing to let you lose forever.
      hitCap: 0.01,
      enrageAfter: 90,
      enrageRate: 0.04,
      phases: [
        { at: 1, name: 'Zero', speed: 1, damage: 1, line: 'Everything here was divided evenly. Then there was me.' },
        { at: 0.84, name: 'One', speed: 1.12, damage: 1.18, line: 'You are counting. Good. Keep counting.' },
        { at: 0.64, name: 'Two', speed: 1.25, damage: 1.4, line: 'The Concord tried this. The clans tried this. Aldrhrim tried this.', hazard: 'shadow' },
        { at: 0.44, name: 'Three', speed: 1.42, damage: 1.65, line: 'None of them were wrong. They were only finite.', hazard: 'shadow' },
        { at: 0.24, name: 'Four', speed: 1.6, damage: 1.95, line: 'I have been the part left over since before the valley had water in it.', hazard: 'shadow' },
        { at: 0.08, name: 'Remainder', speed: 1.9, damage: 2.4, line: 'AND I AM STILL HERE.', hazard: 'shadow' },
      ],
      attacks: [
        { id: 'divide', name: 'Divide', shape: 'cone', windup: 0.6, cooldown: 3.4, power: 1.6, radius: 320, element: 'arcane', color: PAL.arcaneLit },
        { id: 'shards', name: 'Long Division', shape: 'projectile', windup: 0.55, cooldown: 2.8, power: 1.3, count: 11, range: 760, element: 'arcane', color: PAL.arcane },
        { id: 'fold', name: 'Fold', shape: 'dash', windup: 0.35, cooldown: 6, power: 1.8, range: 620, element: 'arcane', color: PAL.white },
        { id: 'carry', name: 'Carry the One', shape: 'line', windup: 1, cooldown: 8, power: 2.2, range: 800, element: 'shadow', color: PAL.arcaneDark, lifeTax: 0.12 },
        { id: 'modulo', name: 'Modulo', shape: 'ring', windup: 1.4, cooldown: 11, power: 2.9, radius: 460, element: 'arcane', color: PAL.white, phase: 1, lifeTax: 0.2 },
        { id: 'factors', name: 'Its Factors', shape: 'summon', windup: 1.1, cooldown: 20, power: 0, count: 4, element: 'frost', color: PAL.ice, summon: 'bone_colossus', phase: 2 },
        { id: 'rain', name: 'Precision Loss', shape: 'rain', windup: 1.1, cooldown: 8, power: 2.1, count: 14, radius: 96, element: 'shadow', color: PAL.arcaneDark, phase: 2 },
        { id: 'heralds', name: 'The Others', shape: 'summon', windup: 1.1, cooldown: 24, power: 0, count: 5, element: 'frost', color: PAL.frost, summon: 'herald_winter', phase: 3 },
        { id: 'zero', name: 'Remainder Zero', shape: 'ring', windup: 2, cooldown: 16, power: 4.2, radius: 700, element: 'shadow', color: PAL.arcaneDark, phase: 4, lifeTax: 0.42 },
        { id: 'count', name: 'Keep Counting', shape: 'rain', windup: 0.8, cooldown: 5, power: 2.4, count: 18, radius: 104, element: 'arcane', color: PAL.arcaneLit, phase: 5, lifeTax: 0.06 },
      ],
    },
  },
];

export const ALL_ENEMIES: EnemyDef[] = [...ENEMIES, ...BOSSES];
export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ALL_ENEMIES.map((e) => [e.id, e]));
