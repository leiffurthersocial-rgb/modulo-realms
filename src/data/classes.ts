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

const skill = (branch: string, tier: number, id: string, name: string, desc: string, bonus: SkillNodeDef['bonus'], max = 3): SkillNodeDef =>
  ({ id, name, branch, tier, max, desc, bonus });

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
      { id: 'charge', name: 'Shield Charge', desc: 'Barrel forward, knocking back and damaging everything you touch.', shape: 'dash', level: 8, mana: 0, stamina: 26, cooldown: 9, power: 1.8, range: 210, element: 'physical', color: '#c3cad6', icon: 'shield' },
      { id: 'earthshatter', name: 'Earthshatter', desc: 'Slam the ground for heavy damage and a brief stun.', shape: 'nova', level: 14, mana: 10, stamina: 35, cooldown: 16, power: 2.8, radius: 120, element: 'physical', color: '#b2703b', icon: 'hammer' },
      { id: 'ruin', name: 'Ruin', desc: 'Bring the weapon down with everything you have. Enormous damage in a wide ring, and it staggers whatever survives.', shape: 'nova', level: 22, mana: 20, stamina: 55, cooldown: 26, power: 5.2, radius: 190, element: 'physical', color: '#b5462f', icon: 'greataxe' },
    ],
    skills: [
      skill('Power', 1, 'w_pow1', 'Brutal Strength', '+3 Strength per point.', { strength: 3 }),
      skill('Power', 2, 'w_pow2', 'Heavy Swing', '+6% attack speed and +4% crit damage per point.', { attackSpeed: 6, critDamage: 4 }),
      skill('Power', 3, 'w_pow3', 'Executioner', '+5% critical chance per point.', { critChance: 5 }, 2),
      skill('Defense', 1, 'w_def1', 'Ironhide', '+4 Defense per point.', { defense: 4 }),
      skill('Defense', 2, 'w_def2', 'Second Wind', '+25 max health and +2 stamina regen per point.', { maxHealth: 25, staminaRegen: 2 }),
      skill('Defense', 3, 'w_def3', 'Bulwark', '+8 Defense and +40 health per point.', { defense: 8, maxHealth: 40 }, 2),
      skill('Berserker', 1, 'w_ber1', 'Bloodthirst', '+3% life steal per point.', { lifesteal: 3 }),
      skill('Berserker', 2, 'w_ber2', 'Reckless', '+8% ability power, +4% move speed per point.', { abilityPower: 8, moveSpeed: 4 }),
      skill('Berserker', 3, 'w_ber3', 'Unending Rage', '-10% cooldowns per point.', { cooldownReduction: 10 }, 2),
      skill('Power', 4, 'w_pow4', 'Warmaster', '+5 Strength and +6% crit damage per point.', { strength: 5, critDamage: 6 }, 2),
      skill('Defense', 4, 'w_def4', 'Mountain', '+12 Defense and +60 health per point.', { defense: 12, maxHealth: 60 }, 2),
      skill('Berserker', 4, 'w_ber4', 'Nothing Left', '+5% life steal and +10% ability power per point.', { lifesteal: 5, abilityPower: 10 }, 2),
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
      { id: 'thorntrap', name: 'Thorn Trap', desc: 'Place a snare that roots and bleeds anything that steps in it.', shape: 'ground', level: 7, mana: 12, stamina: 18, cooldown: 12, power: 1.4, radius: 70, duration: 9, element: 'poison', color: '#8fbf4a', icon: 'mat_herb' },
      { id: 'rain', name: 'Arrow Rain', desc: 'Call a storm of arrows onto the marked ground.', shape: 'ground', level: 13, mana: 25, stamina: 25, cooldown: 17, power: 2.4, radius: 130, duration: 4, element: 'physical', color: '#67974a', icon: 'crossbow' },
      { id: 'volleystorm', name: 'Killing Field', desc: 'Empty the quiver: twelve arrows in a fan, every one of them aimed.', shape: 'multishot', level: 22, mana: 20, stamina: 50, cooldown: 24, power: 1.5, count: 12, range: 560, element: 'physical', color: '#87b45c', icon: 'bow' },
    ],
    skills: [
      skill('Bow', 1, 'r_bow1', 'Steady Aim', '+3 Dexterity per point.', { dexterity: 3 }),
      skill('Bow', 2, 'r_bow2', 'Barbed Heads', '+8% ability power per point.', { abilityPower: 8 }),
      skill('Bow', 3, 'r_bow3', 'Deadeye', '+6% crit chance, +10% crit damage per point.', { critChance: 6, critDamage: 10 }, 2),
      skill('Traps', 1, 'r_trp1', 'Field Craft', '+6% attack speed per point.', { attackSpeed: 6 }),
      skill('Traps', 2, 'r_trp2', 'Wilderness Lore', '-10% cooldowns per point.', { cooldownReduction: 10 }),
      skill('Traps', 3, 'r_trp3', 'Rich Pickings', '+10% magic find per point.', { magicFind: 10 }, 2),
      skill('Mobility', 1, 'r_mob1', 'Light Step', '+4% move speed per point.', { moveSpeed: 4 }),
      skill('Mobility', 2, 'r_mob2', 'Endurance', '+20 stamina and +2 stamina regen per point.', { maxStamina: 20, staminaRegen: 2 }),
      skill('Mobility', 3, 'r_mob3', 'Windrunner', '+8% move speed and +15 health per point.', { moveSpeed: 8, maxHealth: 15 }, 2),
      skill('Bow', 4, 'r_bow4', 'One Breath', '+5 Dexterity and +10% crit damage per point.', { dexterity: 5, critDamage: 10 }, 2),
      skill('Traps', 4, 'r_trp4', 'Field Master', '-12% cooldowns and +10% magic find per point.', { cooldownReduction: 12, magicFind: 10 }, 2),
      skill('Mobility', 4, 'r_mob4', 'Never Cornered', '+10% move speed and +30 stamina per point.', { moveSpeed: 10, maxStamina: 30 }, 2),
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
      { id: 'arcaneward', name: 'Arcane Ward', desc: 'A shield that absorbs damage for 10s.', shape: 'shield', level: 9, mana: 30, stamina: 0, cooldown: 20, power: 3, duration: 10, element: 'arcane', color: '#9578e8', icon: 'ring' },
      { id: 'meteor', name: 'Cinderfall', desc: 'Call down a burning stone at the cursor.', shape: 'ground', level: 15, mana: 55, stamina: 0, cooldown: 18, power: 3.4, radius: 120, duration: 2, element: 'fire', color: '#b5462f', icon: 'bomb' },
      { id: 'supernova', name: 'Remainder Zero', desc: 'Collapse a point of the Modulo. Everything inside the radius is simply taken out of the equation.', shape: 'ground', level: 22, mana: 90, stamina: 0, cooldown: 30, power: 6, radius: 180, duration: 3, element: 'arcane', color: '#9578e8', icon: 'mat_crystal' },
    ],
    skills: [
      skill('Fire', 1, 'm_fir1', 'Kindling', '+3 Intelligence per point.', { intelligence: 3 }),
      skill('Fire', 2, 'm_fir2', 'Conflagration', '+10% ability power per point.', { abilityPower: 10 }),
      skill('Fire', 3, 'm_fir3', 'Wildfire', '+6% crit chance and +10% crit damage per point.', { critChance: 6, critDamage: 10 }, 2),
      skill('Ice', 1, 'm_ice1', 'Cold Focus', '+25 max mana per point.', { maxMana: 25 }),
      skill('Ice', 2, 'm_ice2', 'Rime Guard', '+4 Defense and +15 health per point.', { defense: 4, maxHealth: 15 }),
      skill('Ice', 3, 'm_ice3', 'Deep Winter', '+3 mana regen per point.', { manaRegen: 3 }, 2),
      skill('Arcane', 1, 'm_arc1', 'Quick Casting', '-10% cooldowns per point.', { cooldownReduction: 10 }),
      skill('Arcane', 2, 'm_arc2', 'Leyline Tap', '+2% life steal and +2 mana regen per point.', { lifesteal: 2, manaRegen: 2 }),
      skill('Arcane', 3, 'm_arc3', 'Modulo Insight', '+12% ability power and +10% magic find per point.', { abilityPower: 12, magicFind: 10 }, 2),
      skill('Fire', 4, 'm_fir4', 'Long Burn', '+14% ability power and +6% crit chance per point.', { abilityPower: 14, critChance: 6 }, 2),
      skill('Ice', 4, 'm_ice4', 'Absolute Cold', '+8 Defense and +40 max mana per point.', { defense: 8, maxMana: 40 }, 2),
      skill('Arcane', 4, 'm_arc4', 'The Whole Equation', '+5 Intelligence and +4 mana regen per point.', { intelligence: 5, manaRegen: 4 }, 2),
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
      { id: 'assassinate', name: 'Assassinate', desc: 'A single devastating strike that always crits.', shape: 'melee_arc', level: 13, mana: 20, stamina: 35, cooldown: 14, power: 3.6, radius: 70, element: 'shadow', color: '#8e2131', icon: 'skull' },
      { id: 'deathmark', name: 'Death Mark', desc: 'Vanish, and reappear behind everything nearby in turn, once each. Every strike is a critical.', shape: 'dash', level: 22, mana: 30, stamina: 50, cooldown: 28, power: 5, range: 340, element: 'shadow', color: '#8e2131', icon: 'skull' },
    ],
    skills: [
      skill('Critical', 1, 'g_cri1', 'Precision', '+4% crit chance per point.', { critChance: 4 }),
      skill('Critical', 2, 'g_cri2', 'Deep Cuts', '+12% crit damage per point.', { critDamage: 12 }),
      skill('Critical', 3, 'g_cri3', 'Killer Instinct', '+3 Dexterity and +8% ability power per point.', { dexterity: 3, abilityPower: 8 }, 2),
      skill('Stealth', 1, 'g_ste1', 'Soft Boots', '+5% move speed per point.', { moveSpeed: 5 }),
      skill('Stealth', 2, 'g_ste2', 'Evasion', '+4 Defense and +20 stamina per point.', { defense: 4, maxStamina: 20 }),
      skill('Stealth', 3, 'g_ste3', 'Cutpurse', '+12% magic find per point.', { magicFind: 12 }, 2),
      skill('Poison', 1, 'g_poi1', 'Toxins', '+8% ability power per point.', { abilityPower: 8 }),
      skill('Poison', 2, 'g_poi2', 'Leech Venom', '+3% life steal per point.', { lifesteal: 3 }),
      skill('Poison', 3, 'g_poi3', 'Swift Blades', '+8% attack speed and -8% cooldowns per point.', { attackSpeed: 8, cooldownReduction: 8 }, 2),
      skill('Critical', 4, 'g_cri4', 'No Second Strike', '+6% crit chance and +18% crit damage per point.', { critChance: 6, critDamage: 18 }, 2),
      skill('Stealth', 4, 'g_ste4', 'Unseen', '+8% move speed and +6 Defense per point.', { moveSpeed: 8, defense: 6 }, 2),
      skill('Poison', 4, 'g_poi4', 'Old Poison', '+5% life steal and +10% attack speed per point.', { lifesteal: 5, attackSpeed: 10 }, 2),
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
      { id: 'mend', name: 'Mend', desc: 'Restore a chunk of your health instantly.', shape: 'heal', level: 3, mana: 30, stamina: 0, cooldown: 14, power: 2.2, element: 'holy', color: '#f6bf5d', icon: 'potion_health' },
      { id: 'consecrate', name: 'Consecration', desc: 'Hallow the ground, burning undead that stand on it.', shape: 'ground', level: 8, mana: 34, stamina: 10, cooldown: 15, power: 1.3, radius: 130, duration: 8, element: 'holy', color: '#f0c95c', icon: 'rune' },
      { id: 'aegis', name: 'Aegis of Dawn', desc: 'A radiant shield that absorbs damage and blinds attackers.', shape: 'shield', level: 14, mana: 40, stamina: 0, cooldown: 24, power: 4, duration: 12, element: 'holy', color: '#ffe9a8', icon: 'shield' },
      { id: 'judgement', name: 'Judgement', desc: 'Call down the dawn: heavy holy damage in a wide ring, and it heals you for a share of everything it burns.', shape: 'nova', level: 22, mana: 70, stamina: 30, cooldown: 26, power: 5, radius: 200, element: 'holy', color: '#ffe9a8', icon: 'hammer' },
    ],
    skills: [
      skill('Faith', 1, 'p_fai1', 'Devotion', '+3 Intelligence and +15 mana per point.', { intelligence: 3, maxMana: 15 }),
      skill('Faith', 2, 'p_fai2', 'Radiance', '+10% ability power per point.', { abilityPower: 10 }),
      skill('Faith', 3, 'p_fai3', 'Blessed Hands', '+3 mana regen and -8% cooldowns per point.', { manaRegen: 3, cooldownReduction: 8 }, 2),
      skill('Protection', 1, 'p_pro1', 'Shield Wall', '+5 Defense per point.', { defense: 5 }),
      skill('Protection', 2, 'p_pro2', 'Stalwart', '+30 max health per point.', { maxHealth: 30 }),
      skill('Protection', 3, 'p_pro3', 'Unyielding', '+8 Defense and +3% life steal per point.', { defense: 8, lifesteal: 3 }, 2),
      skill('Retribution', 1, 'p_ret1', 'Zeal', '+2 Strength and +5% attack speed per point.', { strength: 2, attackSpeed: 5 }),
      skill('Retribution', 2, 'p_ret2', 'Righteous Fury', '+4% crit chance and +8% crit damage per point.', { critChance: 4, critDamage: 8 }),
      skill('Retribution', 3, 'p_ret3', "Dawn's Edge", '+3 Strength and +10% ability power per point.', { strength: 3, abilityPower: 10 }, 2),
      skill('Faith', 4, 'p_fai4', 'Unfailing', '+5 Intelligence and +14% ability power per point.', { intelligence: 5, abilityPower: 14 }, 2),
      skill('Protection', 4, 'p_pro4', 'The Wall Holds', '+12 Defense and +50 health per point.', { defense: 12, maxHealth: 50 }, 2),
      skill('Retribution', 4, 'p_ret4', 'Dawnbringer', '+4 Strength and +8% attack speed per point.', { strength: 4, attackSpeed: 8 }, 2),
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
      { id: 'raise', name: 'Raise Thrall', desc: 'Summon two skeletal servants to fight for 20s.', shape: 'summon', level: 4, mana: 35, stamina: 0, cooldown: 22, power: 1, count: 2, duration: 20, element: 'shadow', color: '#d8cfc4', icon: 'mat_bone' },
      { id: 'drain', name: 'Life Siphon', desc: 'Drain nearby enemies, healing for part of the damage.', shape: 'nova', level: 8, mana: 30, stamina: 0, cooldown: 11, power: 1.6, radius: 140, element: 'shadow', color: '#8e2131', icon: 'mat_essence' },
      { id: 'plague', name: 'Rotfield', desc: 'A creeping blight that poisons the ground for 10s.', shape: 'ground', level: 14, mana: 48, stamina: 0, cooldown: 19, power: 2.2, radius: 140, duration: 10, element: 'poison', color: '#5f7a3a', icon: 'potion_stamina' },
      { id: 'legion', name: 'The Standing Legion', desc: 'Raise six thralls at once, and they are the strongest things you have killed lately.', shape: 'summon', level: 22, mana: 80, stamina: 0, cooldown: 34, power: 1.4, count: 6, duration: 26, element: 'shadow', color: '#5b43a8', icon: 'skull' },
    ],
    skills: [
      skill('Death', 1, 'n_dea1', 'Grave Study', '+3 Intelligence per point.', { intelligence: 3 }),
      skill('Death', 2, 'n_dea2', 'Withering', '+10% ability power per point.', { abilityPower: 10 }),
      skill('Death', 3, 'n_dea3', 'Soul Harvest', '+4% life steal per point.', { lifesteal: 4 }, 2),
      skill('Summoning', 1, 'n_sum1', 'Bone Craft', '-10% cooldowns per point.', { cooldownReduction: 10 }),
      skill('Summoning', 2, 'n_sum2', 'Legion', '+25 max mana and +2 mana regen per point.', { maxMana: 25, manaRegen: 2 }),
      skill('Summoning', 3, 'n_sum3', 'Undying Bond', '+25 health and +4 Defense per point.', { maxHealth: 25, defense: 4 }, 2),
      skill('Blight', 1, 'n_bli1', 'Virulence', '+5% crit chance per point.', { critChance: 5 }),
      skill('Blight', 2, 'n_bli2', 'Creeping Rot', '+6% attack speed and +8% crit damage per point.', { attackSpeed: 6, critDamage: 8 }),
      skill('Blight', 3, 'n_bli3', 'Grim Fortune', '+12% magic find per point.', { magicFind: 12 }, 2),
      skill('Death', 4, 'n_dea4', 'The Long Count', '+5 Intelligence and +6% life steal per point.', { intelligence: 5, lifesteal: 6 }, 2),
      skill('Summoning', 4, 'n_sum4', 'Standing Army', '+40 max mana and +40 health per point.', { maxMana: 40, maxHealth: 40 }, 2),
      skill('Blight', 4, 'n_bli4', 'Everything Rots', '+14% ability power and +10% crit damage per point.', { abilityPower: 14, critDamage: 10 }, 2),
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
