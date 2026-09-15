import { PAL } from '../game/art/palette';
import type { Look } from '../game/art/characters';
import type { CreatureKind } from '../game/art/creatures';
import type { FactionId } from './races';

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

export interface EnemyDef {
  id: string;
  name: string;
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
  boss?: {
    title: string;
    phases: BossPhase[];
    attacks: BossAttack[];
    arenaMusic?: boolean;
    uniqueDrop: string;
  };
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
    level: 1, health: 34, damage: 7, defense: 1, speed: 92, xp: 12, gold: [0, 4], radius: 13,
    sight: 300, attackRange: 34, attackCooldown: 1.5, windup: 0.32, pack: true, flee: 0.15,
    drops: [{ item: 'q_wolf_pelt', chance: 0.55 }, { item: 'mat_leather', chance: 0.4 }, { item: 'food_meat', chance: 0.25 }],
    lootChance: 0.1, tags: ['beast'],
  },
  {
    id: 'direwolf', name: 'Dire Wolf', kind: 'creature', creature: { kind: 'wolf', palette: 'direwolf' }, scale: 1.25,
    level: 6, health: 105, damage: 18, defense: 4, speed: 104, xp: 44, gold: [2, 10], radius: 16,
    sight: 360, attackRange: 40, attackCooldown: 1.3, windup: 0.3, pack: true,
    drops: [{ item: 'q_wolf_pelt', chance: 0.7 }, { item: 'mat_leather', chance: 0.5, min: 1, max: 2 }],
    lootChance: 0.18, tags: ['beast'],
  },
  {
    id: 'frostwolf', name: 'Frostmane', kind: 'creature', creature: { kind: 'wolf', palette: 'frostwolf', glow: PAL.frost }, scale: 1.2,
    level: 11, health: 190, damage: 30, defense: 8, speed: 108, xp: 92, gold: [6, 18], radius: 16,
    sight: 380, attackRange: 40, attackCooldown: 1.25, windup: 0.3, pack: true, element: 'frost',
    drops: [{ item: 'mat_leather', chance: 0.5, min: 1, max: 3 }, { item: 'mat_crystal', chance: 0.25 }],
    lootChance: 0.24, tags: ['beast'],
  },
  {
    id: 'boar', name: 'Tusked Boar', kind: 'creature', creature: { kind: 'boar', palette: 'boar' },
    level: 3, health: 70, damage: 12, defense: 3, speed: 84, xp: 22, gold: [0, 5], radius: 15,
    sight: 240, attackRange: 36, attackCooldown: 1.8, windup: 0.45,
    drops: [{ item: 'food_meat', chance: 0.6, min: 1, max: 2 }, { item: 'mat_leather', chance: 0.35 }],
    lootChance: 0.1, tags: ['beast'],
  },
  {
    id: 'spider', name: 'Thicket Spider', kind: 'creature', creature: { kind: 'spider', palette: 'spider' },
    level: 2, health: 40, damage: 8, defense: 1, speed: 88, xp: 15, gold: [0, 5], radius: 13,
    sight: 280, attackRange: 32, attackCooldown: 1.4, windup: 0.3, pack: true,
    drops: [{ item: 'mat_cloth', chance: 0.4 }, { item: 'mat_herb', chance: 0.2 }],
    lootChance: 0.1, tags: ['beast'],
  },
  {
    id: 'venomspider', name: 'Bog Weaver', kind: 'creature', creature: { kind: 'spider', palette: 'venomspider', glow: PAL.toxic }, scale: 1.15,
    level: 8, health: 130, damage: 21, defense: 5, speed: 92, xp: 58, gold: [3, 12], radius: 15,
    sight: 320, attackRange: 240, attackCooldown: 2.2, windup: 0.5, element: 'poison',
    ranged: { speed: 230, element: 'poison', color: PAL.toxic, radius: 30 },
    drops: [{ item: 'mat_herb', chance: 0.4 }, { item: 'antidote', chance: 0.3 }, { item: 'mat_essence', chance: 0.1 }],
    lootChance: 0.2, tags: ['beast'],
  },
  {
    id: 'bat', name: 'Cave Bat', kind: 'creature', creature: { kind: 'bat', palette: 'bat' },
    level: 2, health: 26, damage: 6, defense: 0, speed: 118, xp: 11, gold: [0, 3], radius: 11,
    sight: 260, attackRange: 28, attackCooldown: 1.1, windup: 0.22, pack: true,
    drops: [{ item: 'mat_leather', chance: 0.2 }],
    lootChance: 0.06, tags: ['beast'],
  },
  {
    id: 'scorpion', name: 'Dune Scorpion', kind: 'creature', creature: { kind: 'scorpion', palette: 'scorpion' },
    level: 7, health: 120, damage: 20, defense: 7, speed: 78, xp: 52, gold: [2, 12], radius: 15,
    sight: 280, attackRange: 38, attackCooldown: 1.6, windup: 0.4, element: 'poison',
    drops: [{ item: 'antidote', chance: 0.3 }, { item: 'mat_bone', chance: 0.3 }],
    lootChance: 0.18, tags: ['beast'],
  },
  {
    id: 'serpent', name: 'Marsh Serpent', kind: 'creature', creature: { kind: 'serpent', palette: 'serpent' },
    level: 6, health: 88, damage: 17, defense: 3, speed: 96, xp: 42, gold: [1, 8], radius: 14,
    sight: 300, attackRange: 46, attackCooldown: 1.35, windup: 0.28, element: 'poison',
    drops: [{ item: 'mat_leather', chance: 0.4 }, { item: 'antidote', chance: 0.2 }],
    lootChance: 0.15, tags: ['beast'],
  },
  /* --- slimes, spirits, constructs --- */
  {
    id: 'slime', name: 'Bog Slime', kind: 'creature', creature: { kind: 'slime', palette: 'slime' },
    level: 1, health: 44, damage: 6, defense: 2, speed: 52, xp: 10, gold: [0, 4], radius: 13,
    sight: 200, attackRange: 30, attackCooldown: 1.8, windup: 0.4,
    drops: [{ item: 'mat_essence', chance: 0.08 }, { item: 'mat_herb', chance: 0.25 }],
    lootChance: 0.08, tags: ['ooze'],
  },
  {
    id: 'toxicslime', name: 'Rot Slime', kind: 'creature', creature: { kind: 'slime', palette: 'slimeToxic', glow: PAL.toxic },
    level: 7, health: 145, damage: 18, defense: 6, speed: 58, xp: 48, gold: [1, 9], radius: 15,
    sight: 240, attackRange: 34, attackCooldown: 1.7, windup: 0.4, element: 'poison',
    drops: [{ item: 'antidote', chance: 0.35 }, { item: 'mat_essence', chance: 0.15 }],
    lootChance: 0.16, tags: ['ooze'],
  },
  {
    id: 'wisp', name: 'Ley Wisp', kind: 'creature', creature: { kind: 'wisp', palette: 'wisp', glow: PAL.arcaneLit },
    level: 5, health: 60, damage: 15, defense: 2, speed: 86, xp: 36, gold: [2, 10], radius: 12,
    sight: 340, attackRange: 260, attackCooldown: 2.1, windup: 0.55, element: 'arcane',
    ranged: { speed: 200, element: 'arcane', color: PAL.arcaneLit, radius: 28 },
    drops: [{ item: 'mat_crystal', chance: 0.3 }, { item: 'mat_essence', chance: 0.12 }],
    lootChance: 0.16, tags: ['spirit'],
  },
  {
    id: 'emberwisp', name: 'Ember Wisp', kind: 'creature', creature: { kind: 'wisp', palette: 'emberwisp', glow: PAL.flame },
    level: 10, health: 120, damage: 27, defense: 4, speed: 92, xp: 78, gold: [4, 14], radius: 12,
    sight: 360, attackRange: 280, attackCooldown: 1.9, windup: 0.5, element: 'fire',
    ranged: { speed: 230, element: 'fire', color: PAL.flame, radius: 34 },
    drops: [{ item: 'mat_crystal', chance: 0.3 }, { item: 'mat_essence', chance: 0.2 }],
    lootChance: 0.2, tags: ['spirit'],
  },
  {
    id: 'crawler', name: 'Grave Crawler', kind: 'creature', creature: { kind: 'crawler', palette: 'crawler' },
    level: 4, health: 74, damage: 14, defense: 3, speed: 96, xp: 30, gold: [1, 7], radius: 13,
    sight: 300, attackRange: 32, attackCooldown: 1.3, windup: 0.28, pack: true,
    drops: [{ item: 'mat_bone', chance: 0.5 }, { item: 'mat_leather', chance: 0.25 }],
    lootChance: 0.12, tags: ['undead'],
  },
  {
    id: 'wraith', name: 'Hollow Wraith', kind: 'creature', creature: { kind: 'wraith', palette: 'wraith', glow: PAL.frost },
    level: 9, health: 135, damage: 25, defense: 6, speed: 82, xp: 70, gold: [4, 16], radius: 14,
    sight: 340, attackRange: 250, attackCooldown: 2, windup: 0.5, element: 'shadow',
    ranged: { speed: 190, element: 'shadow', color: '#6f7f96', radius: 30 },
    drops: [{ item: 'mat_essence', chance: 0.25 }, { item: 'mat_bone', chance: 0.4 }],
    lootChance: 0.22, tags: ['undead'],
  },
  {
    id: 'golem', name: 'Stone Sentinel', kind: 'creature', creature: { kind: 'golem', palette: 'golem' }, scale: 1.2,
    level: 10, health: 300, damage: 32, defense: 16, speed: 52, xp: 110, gold: [8, 24], radius: 18,
    sight: 280, attackRange: 48, attackCooldown: 2.2, windup: 0.65,
    drops: [{ item: 'mat_crystal', chance: 0.4 }, { item: 'mat_iron_ore', chance: 0.5, min: 1, max: 3 }],
    lootChance: 0.3, tags: ['construct'],
  },
  {
    id: 'sandgolem', name: 'Tomb Guardian', kind: 'creature', creature: { kind: 'golem', palette: 'sandgolem' }, scale: 1.2,
    level: 12, health: 360, damage: 38, defense: 18, speed: 54, xp: 140, gold: [10, 30], radius: 18,
    sight: 300, attackRange: 50, attackCooldown: 2.1, windup: 0.6,
    drops: [{ item: 'mat_gem_ruby', chance: 0.2 }, { item: 'mat_crystal', chance: 0.35 }],
    lootChance: 0.32, tags: ['construct'],
  },
  {
    id: 'sapling', name: 'Thorn Sapling', kind: 'creature', creature: { kind: 'treant', palette: 'treant' }, scale: 0.85,
    level: 8, health: 165, damage: 22, defense: 9, speed: 62, xp: 62, gold: [2, 10], radius: 16,
    sight: 260, attackRange: 46, attackCooldown: 1.9, windup: 0.5, element: 'poison',
    drops: [{ item: 'mat_herb', chance: 0.55, min: 1, max: 2 }, { item: 'mat_essence', chance: 0.12 }],
    lootChance: 0.2, tags: ['plant'],
  },
  /* --- humanoids --- */
  {
    id: 'bandit', name: 'Ash Cutter', kind: 'humanoid',
    look: humanLook({ shirt: '#5a4436', pants: '#3a2f28', hair: '#3a2a20', helmet: 'hood', armorColor: '#4a3a2a', weapon: { kind: 'sword', metal: PAL.iron, grip: PAL.woodDark } }),
    level: 3, health: 76, damage: 13, defense: 4, speed: 84, xp: 26, gold: [4, 14], radius: 13,
    sight: 320, attackRange: 40, attackCooldown: 1.5, windup: 0.35, flee: 0.18, faction: 'bandits',
    drops: [{ item: 'potion_health_s', chance: 0.25 }, { item: 'q_bandit_orders', chance: 0.12 }],
    lootChance: 0.22, tags: ['humanoid'],
  },
  {
    id: 'bandit_archer', name: 'Cutter Bowman', kind: 'humanoid',
    look: humanLook({ shirt: '#4a5a42', pants: '#3a2f28', hair: '#4a3324', helmet: 'hood', armorColor: '#3f4a36', weapon: { kind: 'bow', metal: PAL.wood, grip: PAL.woodDark } }),
    level: 4, health: 62, damage: 15, defense: 3, speed: 88, xp: 30, gold: [5, 16], radius: 13,
    sight: 380, attackRange: 300, attackCooldown: 2, windup: 0.5, flee: 0.25, faction: 'bandits',
    ranged: { speed: 330, element: 'physical', color: PAL.cloth, radius: 20 },
    drops: [{ item: 'potion_health_s', chance: 0.2 }, { item: 'mat_leather', chance: 0.3 }],
    lootChance: 0.24, tags: ['humanoid'],
  },
  {
    id: 'bandit_brute', name: 'Cutter Brute', kind: 'humanoid',
    look: humanLook({ shirt: '#6a4436', pants: '#3a2f28', hair: '#2a2029', hairStyle: 'mohawk', armor: 'heavy', armorColor: '#5a5060', bulk: 1.2, height: 1.06, weapon: { kind: 'greataxe', metal: PAL.iron, grip: PAL.woodDark } }),
    level: 7, health: 180, damage: 26, defense: 9, speed: 74, xp: 62, gold: [10, 28], radius: 15,
    sight: 320, attackRange: 52, attackCooldown: 2.1, windup: 0.55, faction: 'bandits',
    drops: [{ item: 'potion_health_m', chance: 0.25 }, { item: 'mat_iron_ingot', chance: 0.3 }],
    lootChance: 0.3, tags: ['humanoid'],
  },
  {
    id: 'skeleton', name: 'Risen Skeleton', kind: 'humanoid',
    look: humanLook({ skin: PAL.cloth, hair: PAL.bone, hairStyle: 'bald', shirt: '#5a5548', pants: '#3f3a32', eyes: PAL.ember, armor: 'none', weapon: { kind: 'sword', metal: PAL.ironDark, grip: PAL.woodDark } }),
    level: 5, health: 80, damage: 16, defense: 6, speed: 70, xp: 34, gold: [2, 10], radius: 13,
    sight: 300, attackRange: 40, attackCooldown: 1.7, windup: 0.42,
    drops: [{ item: 'mat_bone', chance: 0.6, min: 1, max: 2 }],
    lootChance: 0.2, tags: ['undead'],
  },
  {
    id: 'skeleton_archer', name: 'Bone Archer', kind: 'humanoid',
    look: humanLook({ skin: PAL.cloth, hair: PAL.bone, hairStyle: 'bald', shirt: '#4a4a58', pants: '#38304a', eyes: PAL.frost, armor: 'none', weapon: { kind: 'bow', metal: PAL.bone, grip: PAL.stone } }),
    level: 7, health: 78, damage: 21, defense: 5, speed: 66, xp: 48, gold: [3, 12], radius: 13,
    sight: 380, attackRange: 320, attackCooldown: 2.4, windup: 0.6,
    ranged: { speed: 300, element: 'physical', color: PAL.bone, radius: 20 },
    drops: [{ item: 'mat_bone', chance: 0.6, min: 1, max: 2 }],
    lootChance: 0.22, tags: ['undead'],
  },
  {
    id: 'goblin', name: 'Scrap Goblin', kind: 'humanoid',
    look: humanLook({ skin: '#7d9a5c', hair: '#3a2a20', hairStyle: 'wild', shirt: '#6a5a3a', pants: '#3a2f28', height: 0.8, bulk: 0.9, ears: 'elf', eyes: PAL.flameLit, weapon: { kind: 'dagger', metal: PAL.iron, grip: PAL.woodDark } }),
    level: 2, health: 46, damage: 9, defense: 2, speed: 96, xp: 16, gold: [3, 11], radius: 12,
    sight: 300, attackRange: 34, attackCooldown: 1.2, windup: 0.26, pack: true, flee: 0.22,
    drops: [{ item: 'mat_iron_ore', chance: 0.25 }, { item: 'food_bread', chance: 0.2 }],
    lootChance: 0.16, tags: ['humanoid'],
  },
  {
    id: 'goblin_shaman', name: 'Goblin Hexer', kind: 'humanoid',
    look: humanLook({ skin: '#6d8a4c', hair: PAL.bone, hairStyle: 'wild', shirt: '#4a3a6a', pants: '#2b1f4d', height: 0.82, bulk: 0.9, ears: 'elf', armor: 'robe', helmet: 'hood', armorColor: '#3a2a5a', eyes: PAL.toxic, weapon: { kind: 'staff', metal: PAL.wood, grip: PAL.woodDark, glow: PAL.toxic } }),
    level: 6, health: 70, damage: 20, defense: 3, speed: 78, xp: 44, gold: [6, 18], radius: 12,
    sight: 360, attackRange: 270, attackCooldown: 2.3, windup: 0.6, element: 'poison',
    ranged: { speed: 200, element: 'poison', color: PAL.toxic, radius: 32 },
    drops: [{ item: 'potion_mana_s', chance: 0.3 }, { item: 'mat_crystal', chance: 0.2 }],
    lootChance: 0.24, tags: ['humanoid'],
  },
  {
    id: 'orc_raider', name: 'Crag Raider', kind: 'humanoid',
    look: humanLook({ skin: PAL.skinOrc, hair: '#2a2029', hairStyle: 'ponytail', shirt: '#5a4436', pants: '#3a2f28', tusks: true, height: 1.12, bulk: 1.2, armor: 'light', armorColor: '#5a4436', eyes: PAL.ember, weapon: { kind: 'axe', metal: PAL.iron, grip: PAL.woodDark } }),
    level: 9, health: 215, damage: 30, defense: 11, speed: 80, xp: 82, gold: [8, 26], radius: 15,
    sight: 340, attackRange: 46, attackCooldown: 1.8, windup: 0.45, faction: 'northern',
    drops: [{ item: 'mat_iron_ingot', chance: 0.3 }, { item: 'potion_health_m', chance: 0.2 }],
    lootChance: 0.3, tags: ['humanoid'],
  },
  {
    id: 'cultist', name: 'Concord Apostate', kind: 'humanoid',
    look: humanLook({ skin: PAL.skinUndead, hair: '#38304a', hairStyle: 'long', shirt: '#3a2a5a', pants: '#241d2e', armor: 'robe', helmet: 'hood', armorColor: '#2b1f4d', eyes: PAL.arcaneLit, weapon: { kind: 'wand', metal: PAL.arcane, grip: PAL.woodDark, glow: PAL.arcaneLit } }),
    level: 11, health: 140, damage: 32, defense: 7, speed: 84, xp: 96, gold: [10, 30], radius: 13,
    sight: 380, attackRange: 300, attackCooldown: 2.1, windup: 0.55, element: 'arcane', faction: 'arcane',
    ranged: { speed: 240, element: 'arcane', color: PAL.arcaneLit, radius: 34 },
    drops: [{ item: 'potion_mana_m', chance: 0.3 }, { item: 'mat_essence', chance: 0.2 }, { item: 'q_relic_shard', chance: 0.15 }],
    lootChance: 0.3, tags: ['humanoid'],
  },
  {
    id: 'revenant_knight', name: 'Barrow Knight', kind: 'humanoid',
    look: humanLook({ skin: PAL.skinUndead, hair: '#38304a', hairStyle: 'bald', shirt: '#3f4450', pants: '#2f2c38', armor: 'heavy', helmet: 'full', armorColor: '#4a4655', armorTrim: PAL.frost, bulk: 1.1, eyes: PAL.frost, cape: '#2b1f4d', weapon: { kind: 'greatsword', metal: PAL.ironLit, grip: PAL.woodDark, glow: PAL.frost } }),
    level: 13, health: 340, damage: 42, defense: 20, speed: 72, xp: 165, gold: [16, 44], radius: 16,
    sight: 340, attackRange: 56, attackCooldown: 2, windup: 0.5, element: 'frost',
    drops: [{ item: 'mat_essence', chance: 0.3 }, { item: 'potion_health_l', chance: 0.2 }],
    lootChance: 0.4, lootBias: 0.2, tags: ['undead'],
  },
  /* --- minibosses --- */
  {
    id: 'mini_captain', name: 'Cutter Captain Vosk', kind: 'humanoid', elite: true,
    look: humanLook({ shirt: '#6a3a36', pants: '#3a2f28', hair: '#2a2029', hairStyle: 'ponytail', beard: 'full', armor: 'heavy', armorColor: '#5a4a44', armorTrim: PAL.gold, helmet: 'horned', bulk: 1.15, cape: '#8e2131', weapon: { kind: 'greatsword', metal: PAL.steel, grip: PAL.woodDark } }),
    level: 8, health: 520, damage: 30, defense: 12, speed: 84, xp: 260, gold: [40, 90], radius: 16,
    sight: 400, attackRange: 56, attackCooldown: 1.7, windup: 0.45, faction: 'bandits',
    drops: [{ item: 'potion_health_m', chance: 1, min: 2, max: 3 }, { item: 'q_bandit_orders', chance: 1 }],
    lootChance: 1, lootBias: 0.5, tags: ['humanoid'],
  },
  {
    id: 'mini_broodmother', name: 'The Brood Mother', kind: 'creature', elite: true,
    creature: { kind: 'spider', palette: 'venomspider', glow: PAL.toxic }, scale: 1.7,
    level: 9, health: 620, damage: 26, defense: 10, speed: 78, xp: 300, gold: [30, 80], radius: 22,
    sight: 420, attackRange: 260, attackCooldown: 1.9, windup: 0.5, element: 'poison',
    ranged: { speed: 240, element: 'poison', color: PAL.toxic, radius: 36, count: 3, arc: 0.5 },
    drops: [{ item: 'antidote', chance: 1, min: 2, max: 3 }, { item: 'mat_essence', chance: 1 }],
    lootChance: 1, lootBias: 0.5, tags: ['beast'],
  },
  {
    id: 'mini_frostwarden', name: 'Rime Warden', kind: 'creature', elite: true,
    creature: { kind: 'golem', palette: 'golem', glow: PAL.frost }, scale: 1.7,
    level: 12, health: 880, damage: 40, defense: 22, speed: 56, xp: 420, gold: [50, 120], radius: 24,
    sight: 360, attackRange: 60, attackCooldown: 2.2, windup: 0.7, element: 'frost',
    drops: [{ item: 'q_ice_core', chance: 1 }, { item: 'mat_crystal', chance: 1, min: 2, max: 4 }],
    lootChance: 1, lootBias: 0.6, tags: ['construct'],
  },
];

/* ------------------------------------------------------------------ */
/* Bosses                                                              */
/* ------------------------------------------------------------------ */

export const BOSSES: EnemyDef[] = [
  {
    id: 'boss_stone_warden', name: 'The Stone Warden', kind: 'creature',
    creature: { kind: 'golem', palette: 'golem', glow: PAL.arcaneLit }, scale: 2.3,
    level: 10, health: 1750, damage: 34, defense: 22, speed: 50, xp: 900, gold: [180, 320], radius: 30,
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
    level: 15, health: 2600, damage: 46, defense: 24, speed: 74, xp: 1500, gold: [280, 480], radius: 28,
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
    level: 13, health: 2200, damage: 40, defense: 18, speed: 58, xp: 1200, gold: [200, 380], radius: 30,
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
    level: 12, health: 1900, damage: 38, defense: 16, speed: 76, xp: 1050, gold: [190, 340], radius: 28,
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
    level: 17, health: 2900, damage: 52, defense: 20, speed: 78, xp: 1800, gold: [320, 560], radius: 26,
    sight: 600, attackRange: 400, attackCooldown: 2, windup: 0.6, element: 'frost',
    ranged: { speed: 280, element: 'frost', color: PAL.frost, radius: 40 },
    drops: [{ item: 'elixir_grand', chance: 1 }, { item: 'mat_essence', chance: 1, min: 3, max: 5 }],
    lootChance: 1, lootBias: 1.4, tags: ['undead'],
    boss: {
      title: 'Archivist of the Ashen Spire',
      uniqueDrop: 'art_modulo_shard',
      phases: [
        { at: 1, name: 'Calculation', speed: 1, damage: 1, line: 'The Modulo divides all things. You are a remainder.' },
        { at: 0.65, name: 'Remainder', speed: 1.2, damage: 1.25, line: 'Curious. You persist.', hazard: 'frost' },
        { at: 0.3, name: 'Zero', speed: 1.4, damage: 1.55, line: 'THEN LET NOTHING REMAIN.', hazard: 'frost' },
      ],
      attacks: [
        { id: 'shards', name: 'Rime Shards', shape: 'projectile', windup: 0.6, cooldown: 3, power: 1.4, count: 8, range: 600, element: 'frost', color: PAL.frost },
        { id: 'blizzard', name: 'Blizzard', shape: 'rain', windup: 1.2, cooldown: 10, power: 1.7, count: 7, radius: 80, element: 'frost', color: PAL.ice },
        { id: 'nova', name: 'Absolute Zero', shape: 'ring', windup: 1.5, cooldown: 13, power: 3.2, radius: 320, element: 'frost', color: PAL.white },
        { id: 'thralls', name: 'Frozen Court', shape: 'summon', windup: 1.1, cooldown: 18, power: 0, count: 3, element: 'frost', color: PAL.ice, summon: 'revenant_knight', phase: 1 },
        { id: 'blink', name: 'Fold Space', shape: 'dash', windup: 0.4, cooldown: 6, power: 1.2, range: 340, element: 'arcane', color: PAL.arcaneLit, phase: 1 },
      ],
    },
  },
];

export const ALL_ENEMIES: EnemyDef[] = [...ENEMIES, ...BOSSES];
export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ALL_ENEMIES.map((e) => [e.id, e]));
