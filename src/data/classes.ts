import { PAL } from '../game/art/palette';
import type { WeaponKind } from '../game/art/weaponart';

export type ClassId = 'warrior' | 'ranger' | 'mage' | 'rogue' | 'paladin' | 'necromancer';

export type AbilityShape =
  | 'melee_arc'      // wide sweep around the player
  | 'dash'           // burst of movement, damaging on contact
  | 'projectile'     // single travelling bolt
  | 'multishot'      // spread of projectiles
  | 'nova'           // ring of damage centred on the caster
  | 'ground'         // lingering zone at the cursor
  | 'buff'           // timed self buff
  | 'heal'
  | 'summon'
  | 'shield';

export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  shape: AbilityShape;
  level: number;
  mana: number;
  stamina: number;
  cooldown: number;
  /** Damage as a multiple of the player's attack power. */
  power: number;
  radius?: number;
  range?: number;
  count?: number;
  duration?: number;
  element?: 'physical' | 'fire' | 'frost' | 'arcane' | 'shadow' | 'holy' | 'poison';
  color: string;
  icon: string;
}

export interface SkillNodeDef {
  id: string;
  name: string;
  branch: string;
  tier: number;
  max: number;
  desc: string;
  /** Per-point bonuses. */
  bonus: Partial<Record<
    'strength' | 'dexterity' | 'intelligence' | 'vitality' | 'defense' | 'critChance' | 'critDamage' |
    'moveSpeed' | 'maxHealth' | 'maxMana' | 'maxStamina' | 'attackSpeed' | 'abilityPower' | 'lifesteal' |
    'cooldownReduction' | 'magicFind' | 'staminaRegen' | 'manaRegen', number>>;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  blurb: string;
  playstyle: string;
  color: string;
  base: {
    health: number; mana: number; stamina: number;
    strength: number; dexterity: number; intelligence: number; vitality: number; defense: number;
    critChance: number; moveSpeed: number;
  };
  /** Gained per level. */
  growth: { health: number; mana: number; stamina: number; strength: number; dexterity: number; intelligence: number; defense: number };
  weapons: WeaponKind[];
  armor: 'cloth' | 'light' | 'medium' | 'heavy';
  abilities: AbilityDef[];
  skills: SkillNodeDef[];
  startWeapon: string;
  startArmor: string[];
  look: { armor: 'none' | 'light' | 'heavy' | 'robe'; helmet: 'none' | 'cap' | 'hood' | 'horned' | 'full' | 'crown' | 'circlet' | 'wizard'; shirt: string; pants: string; cape?: string | null; offhand?: 'none' | 'shield' | 'torch' | 'tome' };
}

/**
 * How many points a node of each tier will take. The trees got much deeper
 * when the cap moved to 75: a capped character earns 120 points and every
 * class tree now holds 162, so no build ever finishes one.
 */
const TIER_MAX: Record<number, number> = { 1: 8, 2: 8, 3: 6, 4: 6, 5: 6, 6: 5, 7: 3 };

const skill = (branch: string, tier: number, id: string, name: string, desc: string, bonus: SkillNodeDef['bonus'], max = TIER_MAX[tier] ?? 3): SkillNodeDef =>
  ({ id, name, branch, tier, max, desc, bonus });

/**
 * A fourth branch every class carries, so there is always somewhere sensible
 * to put a point that does not fit a specialisation.
 */
const MASTERY_SKILLS: SkillNodeDef[] = [
  skill('Mastery', 1, 'x_mas1', 'Conditioning', '+12 max health and +8 max stamina per point.', { maxHealth: 12, maxStamina: 8 }, 8),
  skill('Mastery', 2, 'x_mas2', 'Footwork', '+1.5% move speed and +2 Defense per point.', { moveSpeed: 1.5, defense: 2 }, 8),
  skill('Mastery', 3, 'x_mas3', 'Practised Hand', '+2% attack speed and +2% crit damage per point.', { attackSpeed: 2, critDamage: 2 }, 6),
  skill('Mastery', 4, 'x_mas4', 'Deep Reserves', '+18 max mana, +18 stamina and +1 mana regen per point.', { maxMana: 18, maxStamina: 18, manaRegen: 1 }, 6),
  skill('Mastery', 5, 'x_mas5', 'Veteran', '+5 Defense, +30 health and +4% ability power per point.', { defense: 5, maxHealth: 30, abilityPower: 4 }, 5),
  skill('Mastery', 6, 'x_mas6', 'Nothing Left To Teach', '+4 to every attribute and +6% ability power per point.', { strength: 4, dexterity: 4, intelligence: 4, abilityPower: 6 }, 3),
];

export const CLASSES: ClassDef[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    blurb: 'A front-line fighter who trades footwork for staying power. Heavy armour, heavier swings.',
    playstyle: 'Melee · High health · Crowd control',
    color: '#d9603c',
    base: { health: 140, mana: 40, stamina: 110, strength: 12, dexterity: 6, intelligence: 4, vitality: 12, defense: 8, critChance: 5, moveSpeed: 100 },
    growth: { health: 16, mana: 2, stamina: 7, strength: 2.2, dexterity: 0.8, intelligence: 0.4, defense: 1.3 },
    weapons: ['sword', 'greatsword', 'axe', 'greataxe', 'hammer', 'mace', 'spear', 'shield'],
    armor: 'heavy',
    startWeapon: 'sword_iron',
    startArmor: ['armor_leather'],
    look: { armor: 'heavy', helmet: 'cap', shirt: '#7a5a3a', pants: '#3b3346', cape: null, offhand: 'none' },
    abilities: [
      { id: 'cleave', name: 'Cleave', desc: 'A wide sweep that strikes every enemy in front of you.', shape: 'melee_arc', level: 1, mana: 0, stamina: 18, cooldown: 3.5, power: 1.5, radius: 78, element: 'physical', color: '#e8763a', icon: 'greataxe' },
      { id: 'warcry', name: 'War Cry', desc: 'Roar to gain 30% damage and 20% damage reduction for 8s.', shape: 'buff', level: 4, mana: 0, stamina: 30, cooldown: 18, power: 0, duration: 8, element: 'physical', color: '#f6bf5d', icon: 'shield' },
      { id: 'secondwind', name: 'Second Wind', desc: 'Get your breath back: 34% of your maximum health, returned over 6s. It keeps working while you swing.', shape: 'heal', level: 6, mana: 0, stamina: 34, cooldown: 20, power: 0.34, duration: 6, element: 'physical', color: '#d9603c', icon: 'potion_health' },
      { id: 'charge', name: 'Shield Charge', desc: 'Barrel forward, knocking back and damaging everything you touch.', shape: 'dash', level: 8, mana: 0, stamina: 26, cooldown: 9, power: 1.8, range: 210, element: 'physical', color: '#c3cad6', icon: 'shield' },
      { id: 'earthshatter', name: 'Earthshatter', desc: 'Slam the ground for heavy damage and a brief stun.', shape: 'nova', level: 14, mana: 10, stamina: 35, cooldown: 16, power: 2.8, radius: 120, element: 'physical', color: '#b2703b', icon: 'hammer' },
      { id: 'ruin', name: 'Ruin', desc: 'Bring the weapon down with everything you have. Enormous damage in a wide ring, and it staggers whatever survives.', shape: 'nova', level: 22, mana: 20, stamina: 55, cooldown: 26, power: 5.2, radius: 190, element: 'physical', color: '#b5462f', icon: 'greataxe' },
    ],
    skills: [
      skill('Power', 1, 'w_pow1', 'Brutal Strength', '+2 Strength per point.', { strength: 2 }),
      skill('Power', 2, 'w_pow2', 'Heavy Swing', '+3% attack speed and +2% crit damage per point.', { attackSpeed: 3, critDamage: 2 }),
      skill('Power', 3, 'w_pow3', 'Executioner', '+2% critical chance per point.', { critChance: 2 }),
      skill('Power', 4, 'w_pow4', 'Warmaster', '+3 Strength and +3% crit damage per point.', { strength: 3, critDamage: 3 }),
      skill('Power', 5, 'w_pow5', 'Breaker', '+4 Strength and +2% attack speed per point.', { strength: 4, attackSpeed: 2 }),
      skill('Power', 6, 'w_pow6', 'Killing Blow', '+3% crit chance and +6% crit damage per point.', { critChance: 3, critDamage: 6 }),
      skill('Power', 7, 'w_pow7', 'The Last Word', '+8 Strength and +12% crit damage per point.', { strength: 8, critDamage: 12 }),
      skill('Defense', 1, 'w_def1', 'Ironhide', '+3 Defense per point.', { defense: 3 }),
      skill('Defense', 2, 'w_def2', 'Second Wind', '+14 max health and +1 stamina regen per point.', { maxHealth: 14, staminaRegen: 1 }),
      skill('Defense', 3, 'w_def3', 'Bulwark', '+5 Defense and +22 health per point.', { defense: 5, maxHealth: 22 }),
      skill('Defense', 4, 'w_def4', 'Mountain', '+7 Defense and +32 health per point.', { defense: 7, maxHealth: 32 }),
      skill('Defense', 5, 'w_def5', 'Shieldbearer', '+9 Defense and +2 stamina regen per point.', { defense: 9, staminaRegen: 2 }),
      skill('Defense', 6, 'w_def6', 'Unbroken', '+12 Defense and +55 health per point.', { defense: 12, maxHealth: 55 }),
      skill('Defense', 7, 'w_def7', 'Nothing Gets Through', '+20 Defense and +110 health per point.', { defense: 20, maxHealth: 110 }),
      skill('Berserker', 1, 'w_ber1', 'Bloodthirst', '+1.5% life steal per point.', { lifesteal: 1.5 }),
      skill('Berserker', 2, 'w_ber2', 'Reckless', '+4% ability power and +2% move speed per point.', { abilityPower: 4, moveSpeed: 2 }),
      skill('Berserker', 3, 'w_ber3', 'Unending Rage', '-4% cooldowns per point.', { cooldownReduction: 4 }),
      skill('Berserker', 4, 'w_ber4', 'Nothing Left', '+2.5% life steal and +5% ability power per point.', { lifesteal: 2.5, abilityPower: 5 }),
      skill('Berserker', 5, 'w_ber5', 'Red Mist', '+6% ability power and +3% attack speed per point.', { abilityPower: 6, attackSpeed: 3 }),
      skill('Berserker', 6, 'w_ber6', 'Past Caring', '+3% life steal and -3% cooldowns per point.', { lifesteal: 3, cooldownReduction: 3 }),
      skill('Berserker', 7, 'w_ber7', 'Blood For Blood', '+5% life steal and +16% ability power per point.', { lifesteal: 5, abilityPower: 16 }),
      ...MASTERY_SKILLS,
    ],
  },
  {
    id: 'ranger',
    name: 'Ranger',
    blurb: 'Hunter of the deep wood. Fights at range, keeps moving, and never misses twice.',
    playstyle: 'Ranged · Mobility · Sustained damage',
    color: '#6fbf5a',
    base: { health: 105, mana: 60, stamina: 130, strength: 7, dexterity: 13, intelligence: 6, vitality: 8, defense: 5, critChance: 12, moveSpeed: 108 },
    growth: { health: 11, mana: 4, stamina: 9, strength: 1, dexterity: 2.4, intelligence: 0.8, defense: 0.8 },
    weapons: ['bow', 'crossbow', 'dagger', 'spear', 'sword'],
    armor: 'light',
    startWeapon: 'bow_hunting',
    startArmor: ['armor_leather'],
    look: { armor: 'light', helmet: 'hood', shirt: '#3f6a4a', pants: '#4a3324', cape: '#2d4a2f', offhand: 'none' },
    abilities: [
      { id: 'multishot', name: 'Splitshot', desc: 'Loose five arrows in a spread.', shape: 'multishot', level: 1, mana: 0, stamina: 20, cooldown: 4.5, power: 0.8, count: 5, range: 420, element: 'physical', color: '#87b45c', icon: 'bow' },
      { id: 'roll', name: 'Tumble', desc: 'Roll a short distance, briefly untouchable.', shape: 'dash', level: 3, mana: 0, stamina: 22, cooldown: 6, power: 0, range: 190, element: 'physical', color: '#d8cfc4', icon: 'boots' },
      { id: 'fielddressing', name: 'Field Dressing', desc: 'Herbs, a strip of cloth and no time at all: 30% of your maximum health, returned over 5s.', shape: 'heal', level: 6, mana: 10, stamina: 20, cooldown: 18, power: 0.3, duration: 5, element: 'poison', color: '#6fbf5a', icon: 'mat_herb' },
      { id: 'thorntrap', name: 'Thorn Trap', desc: 'Place a snare that roots and bleeds anything that steps in it.', shape: 'ground', level: 7, mana: 12, stamina: 18, cooldown: 12, power: 1.4, radius: 70, duration: 9, element: 'poison', color: '#8fbf4a', icon: 'mat_herb' },
      { id: 'rain', name: 'Arrow Rain', desc: 'Call a storm of arrows onto the marked ground.', shape: 'ground', level: 13, mana: 25, stamina: 25, cooldown: 17, power: 2.4, radius: 130, duration: 4, element: 'physical', color: '#67974a', icon: 'crossbow' },
      { id: 'volleystorm', name: 'Killing Field', desc: 'Empty the quiver: twelve arrows in a fan, every one of them aimed.', shape: 'multishot', level: 22, mana: 20, stamina: 50, cooldown: 24, power: 1.5, count: 12, range: 560, element: 'physical', color: '#87b45c', icon: 'bow' },
    ],
    skills: [
      skill('Bow', 1, 'r_bow1', 'Steady Aim', '+2 Dexterity per point.', { dexterity: 2 }),
      skill('Bow', 2, 'r_bow2', 'Barbed Heads', '+4% ability power per point.', { abilityPower: 4 }),
      skill('Bow', 3, 'r_bow3', 'Deadeye', '+2% crit chance and +4% crit damage per point.', { critChance: 2, critDamage: 4 }),
      skill('Bow', 4, 'r_bow4', 'One Breath', '+3 Dexterity and +5% crit damage per point.', { dexterity: 3, critDamage: 5 }),
      skill('Bow', 5, 'r_bow5', 'Longshot', '+4 Dexterity and +5% ability power per point.', { dexterity: 4, abilityPower: 5 }),
      skill('Bow', 6, 'r_bow6', 'Through The Eye', '+3% crit chance and +8% crit damage per point.', { critChance: 3, critDamage: 8 }),
      skill('Bow', 7, 'r_bow7', 'Never Misses Twice', '+8 Dexterity and +14% crit damage per point.', { dexterity: 8, critDamage: 14 }),
      skill('Traps', 1, 'r_trp1', 'Field Craft', '+3% attack speed per point.', { attackSpeed: 3 }),
      skill('Traps', 2, 'r_trp2', 'Wilderness Lore', '-4% cooldowns per point.', { cooldownReduction: 4 }),
      skill('Traps', 3, 'r_trp3', 'Rich Pickings', '+5% magic find per point.', { magicFind: 5 }),
      skill('Traps', 4, 'r_trp4', 'Field Master', '-5% cooldowns and +5% magic find per point.', { cooldownReduction: 5, magicFind: 5 }),
      skill('Traps', 5, 'r_trp5', 'Set And Forget', '+5% ability power and +4% attack speed per point.', { abilityPower: 5, attackSpeed: 4 }),
      skill('Traps', 6, 'r_trp6', 'Old Hand', '-4% cooldowns and +8% magic find per point.', { cooldownReduction: 4, magicFind: 8 }),
      skill('Traps', 7, 'r_trp7', 'The Whole Wood Is A Snare', '+16% ability power and +14% magic find per point.', { abilityPower: 16, magicFind: 14 }),
      skill('Mobility', 1, 'r_mob1', 'Light Step', '+2% move speed per point.', { moveSpeed: 2 }),
      skill('Mobility', 2, 'r_mob2', 'Endurance', '+12 stamina and +1 stamina regen per point.', { maxStamina: 12, staminaRegen: 1 }),
      skill('Mobility', 3, 'r_mob3', 'Windrunner', '+4% move speed and +12 health per point.', { moveSpeed: 4, maxHealth: 12 }),
      skill('Mobility', 4, 'r_mob4', 'Never Cornered', '+5% move speed and +18 stamina per point.', { moveSpeed: 5, maxStamina: 18 }),
      skill('Mobility', 5, 'r_mob5', 'Second Nature', '+4 Defense and +2 stamina regen per point.', { defense: 4, staminaRegen: 2 }),
      skill('Mobility', 6, 'r_mob6', 'Ghostfoot', '+5% move speed and +6 Defense per point.', { moveSpeed: 5, defense: 6 }),
      skill('Mobility', 7, 'r_mob7', 'Gone Before The Sound', '+9% move speed and +60 stamina per point.', { moveSpeed: 9, maxStamina: 60 }),
      ...MASTERY_SKILLS,
    ],
  },
  {
    id: 'mage',
    name: 'Mage',
    blurb: 'A Concord scholar who reads the Modulo and shapes what leaks out of it.',
    playstyle: 'Ranged magic · Area damage · Fragile',
    color: '#6f9ce8',
    base: { health: 85, mana: 150, stamina: 85, strength: 4, dexterity: 7, intelligence: 14, vitality: 6, defense: 3, critChance: 7, moveSpeed: 98 },
    growth: { health: 8, mana: 14, stamina: 5, strength: 0.4, dexterity: 1, intelligence: 2.8, defense: 0.6 },
    weapons: ['staff', 'wand', 'tome', 'dagger'],
    armor: 'cloth',
    startWeapon: 'staff_apprentice',
    startArmor: ['armor_robe_apprentice'],
    look: { armor: 'robe', helmet: 'wizard', shirt: '#3f4a8a', pants: '#2b1f4d', cape: '#2b1f4d', offhand: 'none' },
    abilities: [
      { id: 'firebolt', name: 'Emberbolt', desc: 'Hurl a bolt of fire that bursts on impact.', shape: 'projectile', level: 1, mana: 14, stamina: 0, cooldown: 1.6, power: 1.6, range: 460, radius: 42, element: 'fire', color: '#e8763a', icon: 'staff' },
      { id: 'frostnova', name: 'Frost Nova', desc: 'A ring of ice that damages and slows everything nearby.', shape: 'nova', level: 5, mana: 28, stamina: 0, cooldown: 10, power: 1.5, radius: 130, duration: 4, element: 'frost', color: '#6fd0e8', icon: 'mat_crystal' },
      { id: 'arcaneward', name: 'Arcane Ward', desc: 'A shield worth 34% of your maximum health, for 10s. Ability power improves it.', shape: 'shield', level: 9, mana: 30, stamina: 0, cooldown: 20, power: 3, duration: 10, element: 'arcane', color: '#9578e8', icon: 'ring' },
      { id: 'knit', name: 'Knit', desc: 'Read yourself back together. Restores 26% of your maximum health instantly — expensive, and worth it when you have 85 health to begin with.', shape: 'heal', level: 11, mana: 48, stamina: 0, cooldown: 17, power: 0.26, element: 'arcane', color: '#6f9ce8', icon: 'potion_health' },
      { id: 'meteor', name: 'Cinderfall', desc: 'Call down a burning stone at the cursor.', shape: 'ground', level: 15, mana: 55, stamina: 0, cooldown: 18, power: 3.4, radius: 120, duration: 2, element: 'fire', color: '#b5462f', icon: 'bomb' },
      { id: 'supernova', name: 'Remainder Zero', desc: 'Collapse a point of the Modulo. Everything inside the radius is simply taken out of the equation.', shape: 'ground', level: 22, mana: 90, stamina: 0, cooldown: 30, power: 6, radius: 180, duration: 3, element: 'arcane', color: '#9578e8', icon: 'mat_crystal' },
    ],
    skills: [
      skill('Fire', 1, 'm_fir1', 'Kindling', '+2 Intelligence per point.', { intelligence: 2 }),
      skill('Fire', 2, 'm_fir2', 'Conflagration', '+5% ability power per point.', { abilityPower: 5 }),
      skill('Fire', 3, 'm_fir3', 'Wildfire', '+2% crit chance and +4% crit damage per point.', { critChance: 2, critDamage: 4 }),
      skill('Fire', 4, 'm_fir4', 'Long Burn', '+6% ability power and +2% crit chance per point.', { abilityPower: 6, critChance: 2 }),
      skill('Fire', 5, 'm_fir5', 'Firestorm', '+4 Intelligence and +6% ability power per point.', { intelligence: 4, abilityPower: 6 }),
      skill('Fire', 6, 'm_fir6', 'Everything Burns', '+3% crit chance and +9% crit damage per point.', { critChance: 3, critDamage: 9 }),
      skill('Fire', 7, 'm_fir7', 'The Long Summer', '+8 Intelligence and +18% ability power per point.', { intelligence: 8, abilityPower: 18 }),
      skill('Ice', 1, 'm_ice1', 'Cold Focus', '+14 max mana per point.', { maxMana: 14 }),
      skill('Ice', 2, 'm_ice2', 'Rime Guard', '+3 Defense and +10 health per point.', { defense: 3, maxHealth: 10 }),
      skill('Ice', 3, 'm_ice3', 'Deep Winter', '+1.5 mana regen per point.', { manaRegen: 1.5 }),
      skill('Ice', 4, 'm_ice4', 'Absolute Cold', '+5 Defense and +26 max mana per point.', { defense: 5, maxMana: 26 }),
      skill('Ice', 5, 'm_ice5', 'Glacial Patience', '+7 Defense and +2 mana regen per point.', { defense: 7, manaRegen: 2 }),
      skill('Ice', 6, 'm_ice6', 'Still Air', '+9 Defense and +45 health per point.', { defense: 9, maxHealth: 45 }),
      skill('Ice', 7, 'm_ice7', 'The Year Without A Thaw', '+16 Defense and +140 max mana per point.', { defense: 16, maxMana: 140 }),
      skill('Arcane', 1, 'm_arc1', 'Quick Casting', '-4% cooldowns per point.', { cooldownReduction: 4 }),
      skill('Arcane', 2, 'm_arc2', 'Leyline Tap', '+1% life steal and +1 mana regen per point.', { lifesteal: 1, manaRegen: 1 }),
      skill('Arcane', 3, 'm_arc3', 'Modulo Insight', '+6% ability power and +5% magic find per point.', { abilityPower: 6, magicFind: 5 }),
      skill('Arcane', 4, 'm_arc4', 'The Whole Equation', '+3 Intelligence and +2 mana regen per point.', { intelligence: 3, manaRegen: 2 }),
      skill('Arcane', 5, 'm_arc5', 'Carried Remainder', '+5 Intelligence and +6% ability power per point.', { intelligence: 5, abilityPower: 6 }),
      skill('Arcane', 6, 'm_arc6', 'Divide By Nothing', '-4% cooldowns and +9% magic find per point.', { cooldownReduction: 4, magicFind: 9 }),
      skill('Arcane', 7, 'm_arc7', 'Solved', '+20% ability power and -5% cooldowns per point.', { abilityPower: 20, cooldownReduction: 5 }),
      ...MASTERY_SKILLS,
    ],
  },
  {
    id: 'rogue',
    name: 'Rogue',
    blurb: 'Knife-work and quiet exits. You are very good at being somewhere you should not be.',
    playstyle: 'Melee burst · Critical hits · Evasion',
    color: '#a978e8',
    base: { health: 100, mana: 70, stamina: 140, strength: 8, dexterity: 14, intelligence: 7, vitality: 7, defense: 4, critChance: 18, moveSpeed: 112 },
    growth: { health: 10, mana: 5, stamina: 10, strength: 1.2, dexterity: 2.6, intelligence: 0.9, defense: 0.7 },
    weapons: ['dagger', 'sword', 'bow', 'claws'],
    armor: 'light',
    startWeapon: 'dagger_iron',
    startArmor: ['armor_leather'],
    look: { armor: 'light', helmet: 'hood', shirt: '#3b3346', pants: '#241d2e', cape: '#241d2e', offhand: 'none' },
    abilities: [
      { id: 'shadowstep', name: 'Shadowstep', desc: 'Blink through enemies, striking each one you pass.', shape: 'dash', level: 1, mana: 0, stamina: 20, cooldown: 5, power: 1.6, range: 220, element: 'shadow', color: '#5b43a8', icon: 'dagger' },
      { id: 'fanofknives', name: 'Fan of Knives', desc: 'Throw daggers in every direction.', shape: 'multishot', level: 4, mana: 0, stamina: 24, cooldown: 8, power: 0.9, count: 8, range: 300, element: 'physical', color: '#c3cad6', icon: 'dagger' },
      { id: 'venom', name: 'Coat Blades', desc: 'Your strikes poison for 12s and gain 25% crit chance.', shape: 'buff', level: 8, mana: 15, stamina: 20, cooldown: 20, power: 0, duration: 12, element: 'poison', color: '#8fbf4a', icon: 'potion_stamina' },
      { id: 'tonic', name: 'Bloodtonic', desc: 'Something from the belt, swallowed without stopping. 22% of your maximum health, instantly, and often.', shape: 'heal', level: 10, mana: 12, stamina: 18, cooldown: 11, power: 0.22, element: 'poison', color: '#a978e8', icon: 'potion_health' },
      { id: 'assassinate', name: 'Assassinate', desc: 'A single devastating strike that always crits.', shape: 'melee_arc', level: 13, mana: 20, stamina: 35, cooldown: 14, power: 3.6, radius: 70, element: 'shadow', color: '#8e2131', icon: 'skull' },
      { id: 'deathmark', name: 'Death Mark', desc: 'Vanish, and reappear behind everything nearby in turn, once each. Every strike is a critical.', shape: 'dash', level: 22, mana: 30, stamina: 50, cooldown: 28, power: 5, range: 340, element: 'shadow', color: '#8e2131', icon: 'skull' },
    ],
    skills: [
      skill('Critical', 1, 'g_cri1', 'Precision', '+1.5% crit chance per point.', { critChance: 1.5 }),
      skill('Critical', 2, 'g_cri2', 'Deep Cuts', '+5% crit damage per point.', { critDamage: 5 }),
      skill('Critical', 3, 'g_cri3', 'Killer Instinct', '+2 Dexterity and +4% ability power per point.', { dexterity: 2, abilityPower: 4 }),
      skill('Critical', 4, 'g_cri4', 'No Second Strike', '+2% crit chance and +8% crit damage per point.', { critChance: 2, critDamage: 8 }),
      skill('Critical', 5, 'g_cri5', 'Where It Counts', '+4 Dexterity and +6% crit damage per point.', { dexterity: 4, critDamage: 6 }),
      skill('Critical', 6, 'g_cri6', 'Opening', '+3% crit chance and +9% crit damage per point.', { critChance: 3, critDamage: 9 }),
      skill('Critical', 7, 'g_cri7', 'One Cut', '+8 Dexterity and +20% crit damage per point.', { dexterity: 8, critDamage: 20 }),
      skill('Stealth', 1, 'g_ste1', 'Soft Boots', '+2% move speed per point.', { moveSpeed: 2 }),
      skill('Stealth', 2, 'g_ste2', 'Evasion', '+3 Defense and +12 stamina per point.', { defense: 3, maxStamina: 12 }),
      skill('Stealth', 3, 'g_ste3', 'Cutpurse', '+6% magic find per point.', { magicFind: 6 }),
      skill('Stealth', 4, 'g_ste4', 'Unseen', '+4% move speed and +4 Defense per point.', { moveSpeed: 4, defense: 4 }),
      skill('Stealth', 5, 'g_ste5', 'Nobody Saw', '+6 Defense and +2 stamina regen per point.', { defense: 6, staminaRegen: 2 }),
      skill('Stealth', 6, 'g_ste6', 'Quiet Exit', '+5% move speed and +9% magic find per point.', { moveSpeed: 5, magicFind: 9 }),
      skill('Stealth', 7, 'g_ste7', 'Never Was There', '+9% move speed and +16 Defense per point.', { moveSpeed: 9, defense: 16 }),
      skill('Poison', 1, 'g_poi1', 'Toxins', '+4% ability power per point.', { abilityPower: 4 }),
      skill('Poison', 2, 'g_poi2', 'Leech Venom', '+1.5% life steal per point.', { lifesteal: 1.5 }),
      skill('Poison', 3, 'g_poi3', 'Swift Blades', '+4% attack speed and -3% cooldowns per point.', { attackSpeed: 4, cooldownReduction: 3 }),
      skill('Poison', 4, 'g_poi4', 'Old Poison', '+2.5% life steal and +5% attack speed per point.', { lifesteal: 2.5, attackSpeed: 5 }),
      skill('Poison', 5, 'g_poi5', 'Slow Acting', '+6% ability power and +3% attack speed per point.', { abilityPower: 6, attackSpeed: 3 }),
      skill('Poison', 6, 'g_poi6', 'Nothing Clots', '+3% life steal and -3% cooldowns per point.', { lifesteal: 3, cooldownReduction: 3 }),
      skill('Poison', 7, 'g_poi7', 'The Dose', '+5% life steal and +18% ability power per point.', { lifesteal: 5, abilityPower: 18 }),
      ...MASTERY_SKILLS,
    ],
  },
  {
    id: 'paladin',
    name: 'Paladin',
    blurb: 'Sworn to the last lit shrine in the valley. Holds the line and drags others back over it.',
    playstyle: 'Melee · Healing · Protection',
    color: '#f0c95c',
    base: { health: 130, mana: 95, stamina: 100, strength: 10, dexterity: 5, intelligence: 9, vitality: 11, defense: 9, critChance: 6, moveSpeed: 98 },
    growth: { health: 14, mana: 8, stamina: 6, strength: 1.8, dexterity: 0.6, intelligence: 1.5, defense: 1.5 },
    weapons: ['sword', 'hammer', 'mace', 'shield', 'spear'],
    armor: 'heavy',
    startWeapon: 'mace_iron',
    startArmor: ['armor_leather'],
    look: { armor: 'heavy', helmet: 'full', shirt: '#c9c0a8', pants: '#4a4655', cape: '#d9a441', offhand: 'shield' },
    abilities: [
      { id: 'smite', name: 'Smite', desc: 'A burst of holy force in front of you.', shape: 'melee_arc', level: 1, mana: 12, stamina: 12, cooldown: 4, power: 1.7, radius: 80, element: 'holy', color: '#ffe9a8', icon: 'hammer' },
      { id: 'mend', name: 'Mend', desc: 'Restore 30% of your maximum health instantly. Ability power improves it, up to 60%.', shape: 'heal', level: 3, mana: 30, stamina: 0, cooldown: 14, power: 0.3, element: 'holy', color: '#f6bf5d', icon: 'potion_health' },
      { id: 'consecrate', name: 'Consecration', desc: 'Hallow the ground, burning undead that stand on it.', shape: 'ground', level: 8, mana: 34, stamina: 10, cooldown: 15, power: 1.3, radius: 130, duration: 8, element: 'holy', color: '#f0c95c', icon: 'rune' },
      { id: 'aegis', name: 'Aegis of Dawn', desc: 'A radiant shield worth 34% of your maximum health, for 12s, and it blinds attackers.', shape: 'shield', level: 14, mana: 40, stamina: 0, cooldown: 24, power: 4, duration: 12, element: 'holy', color: '#ffe9a8', icon: 'shield' },
      { id: 'judgement', name: 'Judgement', desc: 'Call down the dawn: heavy holy damage in a wide ring, and it heals you for a share of everything it burns.', shape: 'nova', level: 22, mana: 70, stamina: 30, cooldown: 26, power: 5, radius: 200, element: 'holy', color: '#ffe9a8', icon: 'hammer' },
    ],
    skills: [
      skill('Faith', 1, 'p_fai1', 'Devotion', '+2 Intelligence and +10 mana per point.', { intelligence: 2, maxMana: 10 }),
      skill('Faith', 2, 'p_fai2', 'Radiance', '+5% ability power per point.', { abilityPower: 5 }),
      skill('Faith', 3, 'p_fai3', 'Blessed Hands', '+1.5 mana regen and -3% cooldowns per point.', { manaRegen: 1.5, cooldownReduction: 3 }),
      skill('Faith', 4, 'p_fai4', 'Unfailing', '+3 Intelligence and +6% ability power per point.', { intelligence: 3, abilityPower: 6 }),
      skill('Faith', 5, 'p_fai5', 'Lantern Oath', '+4 Intelligence and +2 mana regen per point.', { intelligence: 4, manaRegen: 2 }),
      skill('Faith', 6, 'p_fai6', 'Still Lit', '+8% ability power and -3% cooldowns per point.', { abilityPower: 8, cooldownReduction: 3 }),
      skill('Faith', 7, 'p_fai7', 'The Shrine Holds', '+8 Intelligence and +18% ability power per point.', { intelligence: 8, abilityPower: 18 }),
      skill('Protection', 1, 'p_pro1', 'Shield Wall', '+3 Defense per point.', { defense: 3 }),
      skill('Protection', 2, 'p_pro2', 'Stalwart', '+16 max health per point.', { maxHealth: 16 }),
      skill('Protection', 3, 'p_pro3', 'Unyielding', '+5 Defense and +1.5% life steal per point.', { defense: 5, lifesteal: 1.5 }),
      skill('Protection', 4, 'p_pro4', 'The Wall Holds', '+7 Defense and +30 health per point.', { defense: 7, maxHealth: 30 }),
      skill('Protection', 5, 'p_pro5', 'Oathbound', '+9 Defense and +2% life steal per point.', { defense: 9, lifesteal: 2 }),
      skill('Protection', 6, 'p_pro6', 'Last Man Standing', '+12 Defense and +55 health per point.', { defense: 12, maxHealth: 55 }),
      skill('Protection', 7, 'p_pro7', 'None Shall Pass', '+20 Defense and +110 health per point.', { defense: 20, maxHealth: 110 }),
      skill('Retribution', 1, 'p_ret1', 'Zeal', '+1.5 Strength and +3% attack speed per point.', { strength: 1.5, attackSpeed: 3 }),
      skill('Retribution', 2, 'p_ret2', 'Righteous Fury', '+1.5% crit chance and +4% crit damage per point.', { critChance: 1.5, critDamage: 4 }),
      skill('Retribution', 3, "p_ret3", "Dawn's Edge", '+2 Strength and +5% ability power per point.', { strength: 2, abilityPower: 5 }),
      skill('Retribution', 4, 'p_ret4', 'Dawnbringer', '+3 Strength and +4% attack speed per point.', { strength: 3, attackSpeed: 4 }),
      skill('Retribution', 5, 'p_ret5', 'Hammer And Anvil', '+4 Strength and +5% crit damage per point.', { strength: 4, critDamage: 5 }),
      skill('Retribution', 6, 'p_ret6', 'Judgement Falls', '+3% crit chance and +8% crit damage per point.', { critChance: 3, critDamage: 8 }),
      skill('Retribution', 7, 'p_ret7', 'The Sun Comes Up', '+8 Strength and +16% crit damage per point.', { strength: 8, critDamage: 16 }),
      ...MASTERY_SKILLS,
    ],
  },
  {
    id: 'necromancer',
    name: 'Necromancer',
    blurb: 'Studies what the Concord will not. Borrows the dead, briefly, and gives most of them back.',
    playstyle: 'Summons · Damage over time · Fragile',
    color: '#8fbf4a',
    base: { health: 92, mana: 135, stamina: 90, strength: 5, dexterity: 7, intelligence: 13, vitality: 7, defense: 4, critChance: 8, moveSpeed: 100 },
    growth: { health: 9, mana: 12, stamina: 6, strength: 0.6, dexterity: 1, intelligence: 2.6, defense: 0.8 },
    weapons: ['scythe', 'staff', 'wand', 'tome', 'dagger'],
    armor: 'cloth',
    startWeapon: 'scythe_bone',
    startArmor: ['armor_robe_apprentice'],
    look: { armor: 'robe', helmet: 'hood', shirt: '#2f3a2a', pants: '#241d2e', cape: '#1e3324', offhand: 'tome' },
    abilities: [
      { id: 'boltshadow', name: 'Grave Bolt', desc: 'A shard of grave-cold that pierces through enemies.', shape: 'projectile', level: 1, mana: 13, stamina: 0, cooldown: 1.5, power: 1.5, range: 420, radius: 34, element: 'shadow', color: '#8fbf4a', icon: 'scythe' },
      { id: 'raise', name: 'Raise Thrall', desc: 'Summon three servants for 24s. What answers gets worse as you get better, and they hit for your ability power.', shape: 'summon', level: 4, mana: 35, stamina: 0, cooldown: 18, power: 1.35, count: 3, duration: 24, element: 'shadow', color: '#d8cfc4', icon: 'mat_bone' },
      { id: 'drain', name: 'Life Siphon', desc: 'Drain nearby enemies, healing for part of the damage.', shape: 'nova', level: 8, mana: 30, stamina: 0, cooldown: 11, power: 1.6, radius: 140, element: 'shadow', color: '#8e2131', icon: 'mat_essence' },
      { id: 'tithe', name: 'The Tithe', desc: 'Take back what was lent out. 28% of your maximum health, returned over 6s, and it asks nothing living for it.', shape: 'heal', level: 11, mana: 42, stamina: 0, cooldown: 18, power: 0.28, duration: 6, element: 'shadow', color: '#8fbf4a', icon: 'mat_essence' },
      { id: 'plague', name: 'Rotfield', desc: 'A creeping blight that poisons the ground for 10s.', shape: 'ground', level: 14, mana: 48, stamina: 0, cooldown: 19, power: 2.2, radius: 140, duration: 10, element: 'poison', color: '#5f7a3a', icon: 'potion_stamina' },
      { id: 'legion', name: 'The Standing Legion', desc: 'Raise six thralls at once, a rung above what you can normally call, for 30s.', shape: 'summon', level: 22, mana: 80, stamina: 0, cooldown: 30, power: 1.8, count: 6, duration: 30, element: 'shadow', color: '#5b43a8', icon: 'skull' },
    ],
    skills: [
      skill('Death', 1, 'n_dea1', 'Grave Study', '+2 Intelligence per point.', { intelligence: 2 }),
      skill('Death', 2, 'n_dea2', 'Withering', '+5% ability power per point.', { abilityPower: 5 }),
      skill('Death', 3, 'n_dea3', 'Soul Harvest', '+2% life steal per point.', { lifesteal: 2 }),
      skill('Death', 4, 'n_dea4', 'The Long Count', '+3 Intelligence and +3% life steal per point.', { intelligence: 3, lifesteal: 3 }),
      skill('Death', 5, 'n_dea5', 'Borrowed Time', '+4 Intelligence and +6% ability power per point.', { intelligence: 4, abilityPower: 6 }),
      skill('Death', 6, 'n_dea6', 'Given Back', '+3% life steal and +8% ability power per point.', { lifesteal: 3, abilityPower: 8 }),
      skill('Death', 7, 'n_dea7', 'Everything Is Owed', '+8 Intelligence and +6% life steal per point.', { intelligence: 8, lifesteal: 6 }),
      skill('Summoning', 1, 'n_sum1', 'Bone Craft', '-4% cooldowns per point.', { cooldownReduction: 4 }),
      skill('Summoning', 2, 'n_sum2', 'Legion', '+14 max mana and +1 mana regen per point.', { maxMana: 14, manaRegen: 1 }),
      skill('Summoning', 3, 'n_sum3', 'Undying Bond', '+16 health and +3 Defense per point.', { maxHealth: 16, defense: 3 }),
      skill('Summoning', 4, 'n_sum4', 'Standing Army', '+26 max mana and +26 health per point.', { maxMana: 26, maxHealth: 26 }),
      skill('Summoning', 5, 'n_sum5', 'Grave Discipline', '+6 Defense and +2 mana regen per point.', { defense: 6, manaRegen: 2 }),
      skill('Summoning', 6, 'n_sum6', 'They Do Not Tire', '-4% cooldowns and +50 health per point.', { cooldownReduction: 4, maxHealth: 50 }),
      skill('Summoning', 7, 'n_sum7', 'The Whole Yard Rises', '+16 Defense and +140 max mana per point.', { defense: 16, maxMana: 140 }),
      skill('Blight', 1, 'n_bli1', 'Virulence', '+1.5% crit chance per point.', { critChance: 1.5 }),
      skill('Blight', 2, 'n_bli2', 'Creeping Rot', '+3% attack speed and +4% crit damage per point.', { attackSpeed: 3, critDamage: 4 }),
      skill('Blight', 3, 'n_bli3', 'Grim Fortune', '+6% magic find per point.', { magicFind: 6 }),
      skill('Blight', 4, 'n_bli4', 'Everything Rots', '+7% ability power and +5% crit damage per point.', { abilityPower: 7, critDamage: 5 }),
      skill('Blight', 5, 'n_bli5', 'Patient Plague', '+4% attack speed and +6% ability power per point.', { attackSpeed: 4, abilityPower: 6 }),
      skill('Blight', 6, 'n_bli6', 'Nothing Keeps', '+3% crit chance and +9% magic find per point.', { critChance: 3, magicFind: 9 }),
      skill('Blight', 7, 'n_bli7', 'The Field After', '+18% ability power and +16% crit damage per point.', { abilityPower: 18, critDamage: 16 }),
      ...MASTERY_SKILLS,
    ],
  },
];

export const CLASS_BY_ID: Record<ClassId, ClassDef> = Object.fromEntries(CLASSES.map((c) => [c.id, c])) as Record<ClassId, ClassDef>;

export const ALL_ABILITIES: Record<string, AbilityDef> = Object.fromEntries(
  CLASSES.flatMap((c) => c.abilities.map((a) => [a.id, a])),
);

export const SKILL_BRANCHES = (c: ClassDef): string[] => [...new Set(c.skills.map((s) => s.branch))];

export const CLASS_ACCENT: Record<ClassId, string> = {
  warrior: '#d9603c', ranger: '#6fbf5a', mage: '#6f9ce8', rogue: '#a978e8', paladin: '#f0c95c', necromancer: '#8fbf4a',
};

export const ARMOR_TINT: Record<string, string> = {
  cloth: PAL.arcaneDark, light: PAL.wood, medium: PAL.copper, heavy: PAL.iron,
};
