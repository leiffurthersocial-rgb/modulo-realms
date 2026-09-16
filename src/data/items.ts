import { PAL } from '../game/art/palette';
import type { IconKind } from '../game/art/icons';
import type { WeaponKind } from '../game/art/weaponart';
import type { ClassId } from './classes';
import type { ArmorLook, ConsumeEffect, EquipSlot, ItemType, Rarity, Stats } from '../game/items/types';

export interface ItemTemplate {
  id: string;
  name: string;
  type: ItemType;
  slot?: EquipSlot;
  icon: IconKind;
  metal?: string;
  accent?: string;
  glow?: string;
  rarity: Rarity;
  level: number;
  value: number;
  stats: Stats;
  effects?: string[];
  /** Enchantments always present on this item, regardless of rolls. */
  fixedEnchants?: Array<{ id: string; level: number }>;
  weaponKind?: WeaponKind;
  armorLook?: ArmorLook;
  classes?: ClassId[];
  desc?: string;
  stackable?: boolean;
  consume?: ConsumeEffect;
  artifact?: { id: string; name: string; cooldown: number; desc: string };
  /** Excluded from random loot tables. */
  noDrop?: boolean;
  /** Only rolls as loot inside these regions. */
  regions?: Array<'central' | 'north' | 'east' | 'south' | 'west'>;
}

/**
 * `extra` is spread BEFORE `stats`, never after. Spread last, an `extra.stats`
 * object replaces the whole merged block rather than adding to it, which
 * silently stripped the damage, speed and range from every weapon below that
 * carries a bonus attribute — and the defense from every such armour.
 */
const W = (
  id: string, name: string, kind: WeaponKind, level: number, damage: number, speed: number, range: number,
  extra: Partial<ItemTemplate> = {},
): ItemTemplate => ({
  id, name, type: 'weapon', slot: 'mainHand', icon: kind as IconKind, weaponKind: kind,
  rarity: 'common', level, value: Math.round(20 + damage * 3.4 + level * 7),
  metal: PAL.iron,
  ...extra,
  // The positional damage/speed/range also win over `extra.stats`, which only
  // ever carries bonus attributes. On a weapon `attackSpeed` is the base swing
  // rate and `range` the literal reach, so a "+6 speed" bonus written there
  // would read as six swings a second.
  stats: { ...(extra.stats ?? {}), damage, attackSpeed: speed, range },
});

const A = (
  id: string, name: string, level: number, defense: number, look: ArmorLook,
  extra: Partial<ItemTemplate> = {},
): ItemTemplate => ({
  id, name, type: 'armor', slot: 'armor', icon: 'chest',
  rarity: 'common', level, value: Math.round(24 + defense * 5.5 + level * 6),
  metal: look.color, accent: look.trim, armorLook: look,
  ...extra,
  stats: { ...(extra.stats ?? {}), defense },
});

const light = (color: string, trim?: string, helmet: ArmorLook['helmet'] = 'none', cape?: string | null): ArmorLook =>
  ({ style: 'light', helmet, color, trim, cape: cape ?? null });
const heavy = (color: string, trim?: string, helmet: ArmorLook['helmet'] = 'cap', cape?: string | null): ArmorLook =>
  ({ style: 'heavy', helmet, color, trim, cape: cape ?? null });
const robe = (color: string, trim?: string, helmet: ArmorLook['helmet'] = 'hood', cape?: string | null): ArmorLook =>
  ({ style: 'robe', helmet, color, trim, cape: cape ?? null });

/* ------------------------------------------------------------------ */
/* Weapons                                                             */
/* ------------------------------------------------------------------ */

export const WEAPONS: ItemTemplate[] = [
  // blades
  W('sword_worn', 'Notched Shortsword', 'sword', 1, 7, 1.35, 46, { desc: 'Somebody carried this a long way before you did.' }),
  W('sword_iron', 'Iron Sword', 'sword', 2, 10, 1.3, 48),
  W('sword_steel', 'Steel Longsword', 'sword', 6, 18, 1.25, 52, { metal: PAL.steel, stats: { strength: 2 } }),
  W('sword_valley', 'Valley Guard Blade', 'sword', 11, 28, 1.28, 52, { metal: PAL.steel, rarity: 'rare', stats: { strength: 3, critChance: 3 } }),
  W('sword_frost', 'Rimeglass Blade', 'sword', 16, 38, 1.3, 54, { metal: PAL.frost, glow: PAL.frost, rarity: 'superRare', stats: { intelligence: 4 }, fixedEnchants: [{ id: 'freezing', level: 1 }] }),
  W('greatsword_iron', 'Iron Greatsword', 'greatsword', 5, 23, 0.78, 62, { stats: { strength: 2 } }),
  W('greatsword_crag', 'Cragbreaker', 'greatsword', 12, 44, 0.72, 66, { metal: PAL.ironLit, rarity: 'rare', stats: { strength: 5, critDamage: 15 } }),
  W('greatsword_grave', 'Gravewarden Greatblade', 'greatsword', 16, 58, 0.7, 68, { metal: PAL.slate, glow: PAL.arcane, rarity: 'superRare', stats: { strength: 7 } }),
  // axes and blunt
  W('axe_wood', "Woodcutter's Axe", 'axe', 1, 9, 1.05, 48, { desc: 'Meant for timber. It has stopped being fussy.' }),
  W('axe_iron', 'Iron Battleaxe', 'axe', 4, 17, 0.98, 52),
  W('greataxe_clan', 'Clanbreaker Axe', 'greataxe', 10, 38, 0.7, 64, { metal: PAL.ironLit, rarity: 'rare', stats: { strength: 4 } }),
  W('hammer_iron', 'Iron Warhammer', 'hammer', 7, 27, 0.75, 56, { stats: { strength: 3 } }),
  W('hammer_stone', 'Stonefall Maul', 'hammer', 13, 46, 0.68, 60, { metal: PAL.rockPale, rarity: 'superRare', stats: { strength: 6 }, fixedEnchants: [{ id: 'shockwave', level: 1 }] }),
  W('mace_iron', 'Iron Mace', 'mace', 2, 11, 1.1, 46),
  W('mace_dawn', 'Dawnward Mace', 'mace', 9, 26, 1.05, 48, { metal: PAL.gold, glow: PAL.holy, rarity: 'rare', stats: { intelligence: 3 }, classes: ['paladin'] }),
  // light blades
  W('dagger_rusty', 'Rusted Dagger', 'dagger', 1, 5, 2.1, 34, { stats: { critChance: 4 } }),
  W('dagger_iron', 'Iron Dagger', 'dagger', 2, 8, 2, 36, { stats: { critChance: 6 } }),
  W('dagger_shadow', 'Shadowfang', 'dagger', 12, 26, 2.1, 38, { metal: PAL.arcaneLit, glow: PAL.arcaneDark, rarity: 'superRare', stats: { critChance: 12, dexterity: 4 }, fixedEnchants: [{ id: 'venomous', level: 2 }] }),
  W('claws_beast', 'Bonebreaker Claws', 'claws', 6, 15, 2.3, 34, { metal: PAL.cloth, stats: { critChance: 8 } }),
  W('spear_hunt', 'Hunting Spear', 'spear', 3, 13, 1.15, 70),
  W('spear_pike', 'Guard Pike', 'spear', 9, 26, 1.1, 76, { metal: PAL.steel, rarity: 'rare', stats: { defense: 3 } }),
  // ranged
  W('bow_hunting', 'Hunting Bow', 'bow', 1, 8, 1.25, 330, { metal: PAL.wood, desc: 'Well-used yew, restrung last spring.' }),
  W('bow_yew', 'Yew Longbow', 'bow', 5, 17, 1.15, 380, { metal: PAL.woodLit, stats: { dexterity: 2 } }),
  W('bow_court', 'Court Warden Bow', 'bow', 12, 34, 1.2, 420, { metal: PAL.leafLit, glow: PAL.leafLit, rarity: 'superRare', stats: { dexterity: 5, critChance: 6 }, fixedEnchants: [{ id: 'multishot', level: 1 }] }),
  W('crossbow_iron', 'Iron Crossbow', 'crossbow', 7, 29, 0.8, 400, { stats: { critDamage: 20 } }),
  W('crossbow_heavy', 'Barrow Repeater', 'crossbow', 14, 48, 0.85, 420, { metal: PAL.ironDark, rarity: 'superRare', stats: { critDamage: 30 }, fixedEnchants: [{ id: 'piercing', level: 2 }] }),
  // magic
  W('staff_apprentice', 'Apprentice Staff', 'staff', 1, 9, 1.05, 300, { metal: PAL.wood, glow: PAL.arcaneLit, stats: { intelligence: 2, maxMana: 10 } }),
  W('staff_ember', 'Emberwood Staff', 'staff', 6, 20, 1, 340, { metal: PAL.wood, glow: PAL.flame, stats: { intelligence: 4, abilityPower: 8 } }),
  W('staff_concord', 'Concord Spellstaff', 'staff', 13, 36, 1.02, 380, { metal: PAL.arcane, glow: PAL.arcaneLit, rarity: 'superRare', stats: { intelligence: 7, abilityPower: 14, maxMana: 30 } }),
  W('wand_copper', 'Copper Wand', 'wand', 2, 10, 1.6, 280, { metal: PAL.copper, glow: PAL.frost, stats: { intelligence: 2 } }),
  W('tome_lesser', 'Lesser Grimoire', 'tome', 4, 14, 1.2, 290, { metal: PAL.blood, glow: PAL.arcaneLit, stats: { intelligence: 3, maxMana: 15 } }),
  W('scythe_bone', 'Bone Scythe', 'scythe', 1, 10, 1.05, 58, { metal: PAL.cloth, stats: { intelligence: 2 }, classes: ['necromancer'] }),
  W('scythe_grave', 'Gravewarden Scythe', 'scythe', 10, 32, 0.95, 64, { metal: PAL.rot, glow: PAL.toxic, rarity: 'rare', stats: { intelligence: 5, lifesteal: 3 } }),

  /* --- duelling blades: fast, precise, built around crit --- */
  W('rapier_town', 'Town Guard Rapier', 'rapier', 3, 11, 1.85, 44, { metal: PAL.steel, stats: { critChance: 6, dexterity: 1 } }),
  W('rapier_duellist', "Duellist's Needle", 'rapier', 8, 22, 1.9, 46, { metal: PAL.steel, rarity: 'rare', stats: { critChance: 11, dexterity: 4 } }),
  W('rapier_court', 'Court Fencer', 'rapier', 13, 34, 1.95, 48, { metal: PAL.leafLit, glow: PAL.leafLit, rarity: 'superRare', stats: { critChance: 15, dexterity: 6, moveSpeed: 4 }, fixedEnchants: [{ id: 'piercing', level: 2 }] }),
  W('rapier_mire', 'Mirefall Stinger', 'rapier', 10, 26, 2, 46, { metal: PAL.toxic, glow: PAL.toxic, rarity: 'rare', stats: { critChance: 9, dexterity: 4 }, fixedEnchants: [{ id: 'venomous', level: 1 }] }),

  /* --- flails: slow, heavy, they hit everything nearby --- */
  W('flail_iron', 'Iron Flail', 'flail', 4, 18, 0.9, 54, { stats: { strength: 2 } }),
  W('flail_morning', 'Morning Star', 'flail', 9, 31, 0.85, 56, { metal: PAL.ironLit, rarity: 'rare', stats: { strength: 4, critDamage: 18 } }),
  W('flail_crag', 'Cragfall Flail', 'flail', 14, 49, 0.78, 58, { metal: PAL.rockPale, rarity: 'superRare', stats: { strength: 7, critDamage: 25 }, fixedEnchants: [{ id: 'shockwave', level: 2 }] }),

  /* --- polearms: reach, sweep, the front rank's weapon --- */
  W('halberd_levy', 'Levy Halberd', 'halberd', 5, 21, 0.92, 78, { stats: { defense: 2 } }),
  W('halberd_watch', 'Northwatch Halberd', 'halberd', 11, 37, 0.88, 82, { metal: PAL.steel, rarity: 'rare', stats: { strength: 4, defense: 4 } }),
  W('halberd_reaper', 'Reaper of the Reach', 'halberd', 16, 56, 0.82, 86, { metal: PAL.frost, glow: PAL.frost, rarity: 'superRare', stats: { strength: 7, defense: 5 }, fixedEnchants: [{ id: 'swirling', level: 2 }] }),

  /* --- war picks: armour-breakers, punishing on a crit --- */
  W('warpick_miner', "Miner's Pick", 'warpick', 2, 12, 1.15, 44, { metal: PAL.iron, desc: 'Meant for ore. It has stopped caring about the difference.' }),
  W('warpick_guild', 'Guild War Pick', 'warpick', 7, 25, 1.1, 46, { metal: PAL.copper, rarity: 'rare', stats: { critDamage: 25, strength: 2 } }),
  W('warpick_ironroot', 'Ironroot Beak', 'warpick', 13, 41, 1.08, 48, { metal: PAL.copper, glow: PAL.ember, rarity: 'superRare', stats: { critDamage: 40, critChance: 8, strength: 4 }, fixedEnchants: [{ id: 'piercing', level: 3 }] }),

  /* --- orbs: caster focuses that hover and strike at range --- */
  W('orb_apprentice', 'Apprentice Orb', 'orb', 3, 12, 1.4, 290, { metal: PAL.frost, glow: PAL.frost, stats: { intelligence: 3, maxMana: 18 } }),
  W('orb_ember', 'Emberglass Orb', 'orb', 8, 25, 1.35, 320, { metal: PAL.flame, glow: PAL.ember, rarity: 'rare', stats: { intelligence: 5, abilityPower: 12 }, fixedEnchants: [{ id: 'fire_aspect', level: 1 }] }),
  W('orb_tide', 'Drowned Tidestone', 'orb', 11, 33, 1.32, 340, { metal: PAL.water, glow: PAL.frost, rarity: 'superRare', stats: { intelligence: 7, abilityPower: 16, maxMana: 40 }, fixedEnchants: [{ id: 'freezing', level: 2 }] }),
  W('orb_hollow', 'Hollow Light', 'orb', 15, 45, 1.3, 360, { metal: PAL.arcaneLit, glow: PAL.arcane, rarity: 'epic', stats: { intelligence: 10, abilityPower: 24, cooldownReduction: 8, lifesteal: 4 } }),

  /* --- a few more of the old kinds, to fill the mid-game --- */
  W('sword_mire', 'Bogsteel Falchion', 'sword', 8, 23, 1.3, 50, { metal: PAL.swamp, rarity: 'rare', stats: { strength: 3, lifesteal: 2 } }),
  W('greatsword_dune', 'Duneholt Cleaver', 'greatsword', 9, 35, 0.75, 64, { metal: PAL.sandDark, rarity: 'rare', stats: { strength: 4, maxHealth: 20 } }),
  W('axe_cutter', 'Ash Cutter Hatchet', 'axe', 7, 24, 1.28, 50, { metal: PAL.ironDark, rarity: 'rare', stats: { critChance: 5 } }),
  W('dagger_guild', 'Guild Shiv', 'dagger', 6, 15, 2.05, 36, { metal: PAL.copper, stats: { critChance: 9, magicFind: 4 } }),
  W('bow_mire', 'Mirewood Recurve', 'bow', 8, 24, 1.2, 400, { metal: PAL.swampDark, rarity: 'rare', stats: { dexterity: 4, critChance: 4 } }),
  W('staff_dune', 'Sunstruck Staff', 'staff', 10, 29, 1.02, 360, { metal: PAL.sand, glow: PAL.goldLit, rarity: 'rare', stats: { intelligence: 6, abilityPower: 12 } }),
  W('spear_mire', 'Bog Harpoon', 'spear', 6, 19, 1.12, 78, { metal: PAL.rot, rarity: 'rare', stats: { dexterity: 3 } }),
  W('mace_crag', 'Cragwarden Mace', 'mace', 12, 35, 1.05, 50, { metal: PAL.rockPale, rarity: 'rare', stats: { strength: 5, defense: 4 } }),
];

/* ------------------------------------------------------------------ */
/* Armour — one slot, whole outfits                                    */
/* ------------------------------------------------------------------ */

export const ARMOR: ItemTemplate[] = [
  A('armor_traveller', "Traveller's Garb", 1, 4, light('#5c5140', PAL.wood), { stats: { moveSpeed: 2 }, desc: 'Road dust, and a lot of it.' }),
  A('armor_leather', 'Padded Leathers', 2, 7, light(PAL.clay, PAL.wood), { stats: { maxHealth: 10 } }),
  A('armor_robe_apprentice', 'Apprentice Robe', 1, 4, robe(PAL.arcaneDark, PAL.frost, 'wizard'), { stats: { maxMana: 16, intelligence: 1 } }),
  A('armor_acolyte', 'Acolyte Vestments', 5, 11, robe('#3f4a6a', PAL.gold), { rarity: 'rare', stats: { maxMana: 30, intelligence: 3 } }),
  A('armor_mail', 'Mail Hauberk', 5, 15, heavy(PAL.iron, PAL.ironLit), { stats: { maxHealth: 22 } }),
  A('armor_hunter', 'Hunter\'s Hide', 6, 14, light('#4a5a3a', PAL.leafLit, 'hood'), { rarity: 'rare', stats: { dexterity: 3, moveSpeed: 4 } }),
  A('armor_wolfhide', 'Wolfhide Mantle', 8, 19, light('#6b6a74', PAL.cloth, 'hood', '#4a4955'), { rarity: 'rare', stats: { maxHealth: 28, moveSpeed: 3 } }),
  A('armor_guard', 'Valley Guard Plate', 9, 26, heavy(PAL.steel, PAL.gold, 'full', '#3a5a8a'), { rarity: 'rare', stats: { maxHealth: 40, moveSpeed: -2 } }),
  A('armor_shadow', 'Shadow Walker', 12, 24, light('#241d2e', PAL.arcaneLit, 'hood', '#1a1626'), { rarity: 'epic', stats: { dexterity: 6, critChance: 6, moveSpeed: 8 }, fixedEnchants: [{ id: 'deflect', level: 1 }] }),
  A('armor_barrow', 'Barrow Shroud', 13, 27, robe('#2f3346', PAL.frost, 'hood', '#22283a'), { rarity: 'epic', stats: { maxMana: 55, intelligence: 6, abilityPower: 10 } }),
  A('armor_frostguard', 'Frostguard Mail', 14, 36, heavy('#6fa8c4', PAL.white, 'horned', '#2f4458'), { rarity: 'epic', stats: { maxHealth: 70, defense: 6 }, fixedEnchants: [{ id: 'thorns', level: 1 }] }),
  A('armor_ironroot', 'Ironroot Plate', 15, 40, heavy(PAL.copper, PAL.gold, 'full'), { rarity: 'epic', stats: { maxHealth: 80, strength: 5, moveSpeed: -3 } }),
  A('armor_concord', 'Concord Mantle', 11, 22, robe(PAL.arcane, PAL.frost, 'wizard', PAL.arcaneDark), { rarity: 'superRare', stats: { maxMana: 48, intelligence: 6, abilityPower: 10 } }),
  A('armor_scout', 'Scoutmaster Kit', 7, 16, light(PAL.leaf, PAL.sandLit, 'cap'), { rarity: 'rare', stats: { moveSpeed: 9, dexterity: 3, maxStamina: 25 } }),
  A('armor_duskforged', 'Duskforged Plate', 16, 52, heavy('#3a3648', PAL.ember, 'horned', '#2a1a1a'), {
    rarity: 'legendary', glow: PAL.ember, noDrop: true,
    stats: { maxHealth: 130, defense: 10, strength: 7, moveSpeed: -2 },
    effects: ['thorns', 'earthshaker'],
    desc: 'Heavy as guilt, and about as easy to put down.',
  }),
  A('armor_hollow_court', 'Mantle of the Hollow Court', 17, 44, robe('#2a2438', PAL.gold, 'crown', '#3a2a4a'), {
    rarity: 'legendary', glow: PAL.arcaneLit, noDrop: true,
    stats: { maxMana: 90, intelligence: 12, abilityPower: 22, lifesteal: 5 },
    effects: ['vampiric', 'flowstate'],
    desc: 'The court wore this to the grave and kept wearing it.',
  }),

  /* --- mid-game outfits, one per region, so travel changes how you dress --- */
  A('armor_bogweave', 'Bogweave Coat', 7, 17, light(PAL.swamp, PAL.rot, 'hood'), { rarity: 'rare', stats: { maxHealth: 26, defense: 2 }, desc: 'Waxed against water that would rather be inside you.' }),
  A('armor_sunveil', 'Sunveil Wrap', 8, 15, robe(PAL.sandLit, PAL.gold, 'hood'), { rarity: 'rare', stats: { maxMana: 34, intelligence: 4, moveSpeed: 3 } }),
  A('armor_clanmail', 'Clanhold Ringmail', 10, 28, heavy(PAL.ironDark, PAL.copper, 'horned'), { rarity: 'rare', stats: { maxHealth: 46, strength: 3 } }),
  A('armor_thornweave', 'Thornweave Habit', 9, 18, robe('#2d4a2f', PAL.leafLit, 'hood', '#1f3322'), { rarity: 'rare', stats: { maxMana: 38, abilityPower: 9, moveSpeed: 3 } }),
  A('armor_cutter', 'Cutter Raid Harness', 11, 23, light('#5a3a2a', PAL.ember, 'cap'), { rarity: 'superRare', stats: { attackSpeed: 6, critChance: 5, moveSpeed: 5 } }),
  A('armor_wardplate', 'Wardens Bulwark', 13, 34, heavy('#4a5a6a', PAL.frost, 'full', '#2a3a4a'), { rarity: 'superRare', stats: { maxHealth: 64, defense: 7, moveSpeed: -2 }, fixedEnchants: [{ id: 'deflect', level: 2 }] }),
  A('armor_emberplate', 'Emberforge Plate', 15, 44, heavy('#6a3020', PAL.flameLit, 'horned', '#3a1a12'), { rarity: 'epic', glow: PAL.ember, stats: { maxHealth: 88, defense: 8, strength: 6 }, fixedEnchants: [{ id: 'fire_aspect', level: 2 }] }),
  A('armor_tidecaller', 'Tidecaller Vestments', 14, 26, robe('#274a5e', PAL.frost, 'wizard', '#1a3242'), { rarity: 'epic', glow: PAL.frost, stats: { maxMana: 72, intelligence: 9, abilityPower: 16 }, fixedEnchants: [{ id: 'freezing', level: 2 }] }),
];

/* ------------------------------------------------------------------ */
/* Off-hands                                                           */
/* ------------------------------------------------------------------ */

export const OFFHANDS: ItemTemplate[] = [
  { id: 'shield_wood', name: 'Oak Buckler', type: 'armor', slot: 'offHand', icon: 'shield', weaponKind: 'shield', metal: PAL.wood, rarity: 'common', level: 2, value: 55, stats: { defense: 6 } },
  { id: 'shield_iron', name: 'Iron Kite Shield', type: 'armor', slot: 'offHand', icon: 'shield', weaponKind: 'shield', metal: PAL.iron, rarity: 'common', level: 6, value: 140, stats: { defense: 13, maxHealth: 18 } },
  { id: 'shield_tower', name: 'Valley Tower Shield', type: 'armor', slot: 'offHand', icon: 'shield', weaponKind: 'shield', metal: PAL.steel, rarity: 'rare', level: 12, value: 420, stats: { defense: 26, maxHealth: 45, moveSpeed: -3 } },
  { id: 'shield_barrow', name: 'Barrow Aegis', type: 'armor', slot: 'offHand', icon: 'shield', weaponKind: 'shield', metal: PAL.slate, glow: PAL.frost, rarity: 'epic', level: 15, value: 900, stats: { defense: 38, maxHealth: 70 }, fixedEnchants: [{ id: 'thorns', level: 2 }] },
  { id: 'tome_off', name: 'Bound Codex', type: 'armor', slot: 'offHand', icon: 'tome', weaponKind: 'tome', metal: PAL.blood, rarity: 'common', level: 5, value: 120, stats: { maxMana: 28, intelligence: 2 } },
  { id: 'tome_whisper', name: 'Whispering Codex', type: 'armor', slot: 'offHand', icon: 'tome', weaponKind: 'tome', metal: PAL.arcane, glow: PAL.arcaneLit, rarity: 'superRare', level: 12, value: 480, stats: { maxMana: 60, intelligence: 6, abilityPower: 10 } },
  { id: 'torch_off', name: 'Everburning Brand', type: 'armor', slot: 'offHand', icon: 'torch_item', metal: PAL.flame, glow: PAL.flame, rarity: 'common', level: 3, value: 70, stats: { critChance: 2 }, desc: 'Lights the dark places. Never quite goes out.' },
  { id: 'shield_bog', name: 'Bogplank Shield', type: 'armor', slot: 'offHand', icon: 'shield', weaponKind: 'shield', metal: PAL.swampDark, accent: PAL.rot, rarity: 'rare', level: 8, value: 240, stats: { defense: 18, maxHealth: 28 } },
  { id: 'shield_dune', name: 'Sunburst Targe', type: 'armor', slot: 'offHand', icon: 'shield', weaponKind: 'shield', metal: PAL.sand, accent: PAL.goldLit, glow: PAL.goldLit, rarity: 'superRare', level: 11, value: 400, stats: { defense: 22, maxHealth: 32, moveSpeed: 3 } },
  { id: 'shield_crag', name: 'Clanhold Bulwark', type: 'armor', slot: 'offHand', icon: 'shield', weaponKind: 'shield', metal: PAL.ironDark, accent: PAL.copper, rarity: 'epic', level: 16, value: 1050, stats: { defense: 44, maxHealth: 85, moveSpeed: -4 }, fixedEnchants: [{ id: 'shockwave', level: 1 }] },
  { id: 'orb_off', name: 'Focusing Lens', type: 'armor', slot: 'offHand', icon: 'orb', weaponKind: 'orb', metal: PAL.frost, glow: PAL.frost, rarity: 'rare', level: 7, value: 200, stats: { abilityPower: 9, maxMana: 30 } },
  { id: 'orb_dark', name: 'Nightglass Lens', type: 'armor', slot: 'offHand', icon: 'orb', weaponKind: 'orb', metal: PAL.arcaneDark, glow: PAL.arcaneLit, rarity: 'epic', level: 14, value: 760, stats: { abilityPower: 20, maxMana: 65, cooldownReduction: 6 } },
  { id: 'lantern_off', name: 'Wayfarer Lantern', type: 'armor', slot: 'offHand', icon: 'lantern', metal: PAL.iron, glow: PAL.goldLit, rarity: 'rare', level: 6, value: 180, stats: { magicFind: 8, maxHealth: 14 }, desc: 'Burns whale oil and something the apothecary will not name.' },
];

/* ------------------------------------------------------------------ */
/* Artifacts — activated powers, Minecraft Dungeons style              */
/* ------------------------------------------------------------------ */

const ART = (
  id: string, name: string, icon: IconKind, level: number, rarity: Rarity, value: number,
  stats: Stats, artifact: NonNullable<ItemTemplate['artifact']>, extra: Partial<ItemTemplate> = {},
): ItemTemplate => ({
  id, name, type: 'accessory', slot: 'accessory', icon, rarity, level, value, artifact,
  ...extra,
  stats: { ...stats, ...(extra.stats ?? {}) },
});

export const ARTIFACTS: ItemTemplate[] = [
  ART('art_healing_sigil', 'Healing Sigil', 'amulet', 2, 'common', 90, { vitality: 2 },
    { id: 'heal_burst', name: 'Mend', cooldown: 26, desc: 'Restores a third of your health.' },
    { metal: PAL.gold, accent: PAL.blood }),
  ART('art_ember_totem', 'Ember Totem', 'mat_crystal', 5, 'rare', 240, { abilityPower: 6 },
    { id: 'fire_nova', name: 'Emberburst', cooldown: 20, desc: 'Erupts in a ring of fire around you.' },
    { metal: PAL.flame, glow: PAL.ember }),
  ART('art_swift_boots', 'Boots of Swiftness', 'boots', 4, 'rare', 210, { moveSpeed: 5 },
    { id: 'speed_burst', name: 'Quicken', cooldown: 22, desc: 'Doubles your speed for six seconds.' },
    { metal: PAL.leafLit }),
  ART('art_wolf_fang', 'Wolf Fang Charm', 'amulet', 7, 'superRare', 420, { critChance: 4 },
    { id: 'summon_wolf', name: 'Call of the Pack', cooldown: 40, desc: 'Summons a spirit wolf to fight beside you.' },
    { metal: PAL.cloth, accent: PAL.ember }),
  ART('art_iron_hide', 'Iron Hide Amulet', 'amulet', 8, 'superRare', 440, { defense: 6 },
    { id: 'ward', name: 'Iron Hide', cooldown: 30, desc: 'Absorbs a large amount of incoming damage.' },
    { metal: PAL.iron, accent: PAL.steel }),
  ART('art_death_cap', 'Death Cap Mushroom', 'mat_herb', 9, 'superRare', 460, { attackSpeed: 4 },
    { id: 'frenzy', name: 'Frenzy', cooldown: 34, desc: 'Greatly raises attack speed and damage for eight seconds.' },
    { metal: PAL.toxic, glow: PAL.toxic }),
  ART('art_light_feather', 'Light Feather', 'ring', 10, 'epic', 720, { moveSpeed: 6, critChance: 3 },
    { id: 'blink', name: 'Featherfall', cooldown: 14, desc: 'Blink a long distance, leaving a stunning burst behind.' },
    { metal: PAL.white, accent: PAL.frost }),
  ART('art_corrupted_beacon', 'Corrupted Beacon', 'mat_crystal', 13, 'epic', 980, { abilityPower: 12 },
    { id: 'beam', name: 'Corruption Beam', cooldown: 32, desc: 'Fires a searing beam that melts everything in front of you.' },
    { metal: PAL.arcaneLit, glow: PAL.arcane }),
  ART('art_harvester', 'Harvester Idol', 'skull', 14, 'epic', 1020, { lifesteal: 3 },
    { id: 'soul_burst', name: 'Reap', cooldown: 36, desc: 'Spends gathered souls in a devastating burst.' },
    { metal: PAL.bone, glow: PAL.toxic }),
  ART('art_modulo_shard', 'Shard of the Modulo', 'mat_crystal', 18, 'legendary', 3200,
    { intelligence: 12, strength: 8, dexterity: 8, abilityPower: 22, cooldownReduction: 12, magicFind: 20 },
    { id: 'time_fold', name: 'Fold the Remainder', cooldown: 45, desc: 'Freezes everything nearby in stopped time.' },
    { metal: PAL.frost, glow: PAL.frost, noDrop: true, effects: ['spiritcall', 'flowstate'], desc: 'It hums when you are about to die.' }),
  ART('art_kings_seal', 'Seal of King Jovan', 'ring', 12, 'legendary', 2400,
    { maxHealth: 90, defense: 10, strength: 6, magicFind: 12 },
    { id: 'rally', name: "King's Rally", cooldown: 38, desc: 'A rallying cry: heals you and empowers your strikes.' },
    { metal: PAL.gold, accent: PAL.holy, glow: PAL.holy, noDrop: true, desc: 'Given, not found. Jovan gives a great many things away.' }),

  /* --- artifacts with their own icon art --- */
  ART('art_rally_horn', 'Horn of the Old Levy', 'horn', 6, 'rare', 300, { maxHealth: 30, defense: 3 },
    { id: 'rally', name: 'Sound the Levy', cooldown: 30, desc: 'A blast that heals you and knocks enemies back.' },
    { metal: PAL.bone, accent: PAL.copper }),
  ART('art_grave_chalice', 'Chalice of the Ninth King', 'chalice', 11, 'epic', 860, { lifesteal: 5, maxHealth: 40 },
    { id: 'soul_burst', name: 'Drink Deep', cooldown: 30, desc: 'Drains life from everything around you into yourself.' },
    { metal: PAL.gold, accent: PAL.blood, glow: PAL.blood }),
  ART('art_hourglass', 'Cracked Hourglass', 'hourglass', 12, 'epic', 940, { cooldownReduction: 10, attackSpeed: 5 },
    { id: 'time_fold', name: 'Spill the Sand', cooldown: 40, desc: 'Slows everything nearby to a crawl for six seconds.' },
    { metal: PAL.sandLit, accent: PAL.frost, glow: PAL.frost }),
  ART('art_plague_mask', 'Mirefall Plague Mask', 'mask', 9, 'superRare', 500, { defense: 5, abilityPower: 8 },
    { id: 'frenzy', name: 'Breathe the Bog', cooldown: 32, desc: 'Exhales a poison cloud that eats through armour.' },
    { metal: PAL.bone, accent: PAL.toxic, glow: PAL.toxic }),
  ART('art_stormvane', 'Stormvane', 'weathervane', 14, 'epic', 1100, { critChance: 7, moveSpeed: 5 },
    { id: 'beam', name: 'Call the Vane', cooldown: 34, desc: 'Draws a lightning arc through everything in a line.' },
    { metal: PAL.iron, accent: '#8fd0f0', glow: '#8fd0f0' }),
  ART('art_emberdrum', 'Emberforge Drum', 'drum', 10, 'superRare', 620, { strength: 5, attackSpeed: 4 },
    { id: 'fire_nova', name: 'Beat the Forge', cooldown: 24, desc: 'A pounding rhythm that sets the ground alight around you.' },
    { metal: PAL.wood, accent: PAL.ember, glow: PAL.ember }),
];

/* ------------------------------------------------------------------ */
/* Uniques                                                             */
/* ------------------------------------------------------------------ */

export const UNIQUES: ItemTemplate[] = [
  {
    id: 'unique_flamebound', name: 'Flamebound Sword', type: 'weapon', slot: 'mainHand', icon: 'sword', weaponKind: 'sword',
    metal: PAL.flame, glow: PAL.ember, rarity: 'legendary', level: 8, value: 1500,
    stats: { damage: 36, attackSpeed: 1.32, range: 52, strength: 8, critChance: 6 },
    effects: ['burning_edge', 'emberburst'], fixedEnchants: [{ id: 'fire_aspect', level: 2 }], noDrop: true,
    desc: 'Forged in a furnace that has not gone out in three hundred years.',
  },
  {
    id: 'unique_wardenheart', name: "Warden's Heartstone", type: 'accessory', slot: 'accessory', icon: 'amulet',
    metal: PAL.rock, accent: PAL.arcaneLit, glow: PAL.arcaneLit, rarity: 'legendary', level: 10, value: 1700,
    stats: { maxHealth: 95, defense: 14, strength: 5 }, effects: ['thorns', 'soulbind'], noDrop: true,
    artifact: { id: 'ward', name: 'Stoneskin', cooldown: 30, desc: 'Hardens your skin to stone for a short time.' },
    desc: 'Still warm. Still beating, very slowly.',
  },
  {
    id: 'unique_matriarch', name: 'Bough of the Matriarch', type: 'weapon', slot: 'mainHand', icon: 'staff', weaponKind: 'staff',
    metal: PAL.leaf, glow: PAL.toxic, rarity: 'legendary', level: 13, value: 2100,
    stats: { damage: 46, attackSpeed: 1.05, range: 380, intelligence: 12, abilityPower: 22 },
    effects: ['venomous', 'spiritcall'], fixedEnchants: [{ id: 'ember_focus', level: 2 }], noDrop: true,
    desc: 'Cut from a tree that was old when the valley was young. It has not forgiven you.',
  },
  {
    id: 'unique_stormcall', name: 'Stormcaller Bow', type: 'weapon', slot: 'mainHand', icon: 'bow', weaponKind: 'bow',
    metal: '#8fd0f0', glow: '#8fd0f0', rarity: 'legendary', level: 12, value: 2000,
    stats: { damage: 40, attackSpeed: 1.28, range: 440, dexterity: 10, critChance: 10 },
    effects: ['stormcaller', 'echo'], fixedEnchants: [{ id: 'multishot', level: 2 }], noDrop: true,
    desc: 'Drawn once at the top of the Ashen Spire. The storm has followed it since.',
  },
  {
    id: 'unique_sandtyrant', name: 'Fang of the Sand Tyrant', type: 'weapon', slot: 'mainHand', icon: 'dagger', weaponKind: 'dagger',
    metal: PAL.toxic, glow: PAL.toxic, rarity: 'legendary', level: 11, value: 1850,
    stats: { damage: 28, attackSpeed: 2.15, range: 38, dexterity: 9, critChance: 16, critDamage: 30 },
    effects: ['venomous', 'swiftstep'], fixedEnchants: [{ id: 'venomous', level: 3 }], noDrop: true,
    desc: 'Still dripping. It will not stop.',
  },
  /* --- the two northern relics, only found in the Crag Reach --- */
  {
    id: 'unique_leviathan', name: 'Leviathan Axe', type: 'weapon', slot: 'mainHand', icon: 'axe', weaponKind: 'axe',
    metal: '#bcd8e8', accent: PAL.frost, glow: PAL.frost, rarity: 'legendary', level: 15, value: 4200,
    stats: { damage: 62, attackSpeed: 1.0, range: 58, strength: 12, critDamage: 25 },
    effects: ['frostbite', 'earthshaker'], fixedEnchants: [{ id: 'freezing', level: 3 }, { id: 'committed', level: 2 }],
    noDrop: true, regions: ['north'],
    desc: 'Cold beyond cold, and it always comes back to the hand that threw it.',
  },
  {
    id: 'unique_chaos_blades', name: 'Blades of Chaos', type: 'weapon', slot: 'mainHand', icon: 'claws', weaponKind: 'claws',
    metal: '#c8402f', accent: PAL.flameLit, glow: PAL.ember, rarity: 'legendary', level: 15, value: 4200,
    stats: { damage: 34, attackSpeed: 2.3, range: 96, strength: 8, dexterity: 8, critChance: 14 },
    effects: ['burning_edge', 'emberburst'], fixedEnchants: [{ id: 'fire_aspect', level: 3 }, { id: 'swirling', level: 2 }],
    noDrop: true, regions: ['north'],
    desc: 'Chained to the bone. They burn whoever holds them, and they do not care whose bone it is.',
  },
];

/* ------------------------------------------------------------------ */
/* Consumables, materials, quest items                                 */
/* ------------------------------------------------------------------ */

export const CONSUMABLES: ItemTemplate[] = [
  { id: 'potion_health_s', name: 'Minor Healing Draught', type: 'consumable', icon: 'potion_health', rarity: 'common', level: 1, value: 25, stats: {}, stackable: true, consume: { health: 45 }, desc: 'Restores 45 health.' },
  { id: 'potion_health_m', name: 'Healing Draught', type: 'consumable', icon: 'potion_health', metal: PAL.blood, rarity: 'rare', level: 5, value: 60, stats: {}, stackable: true, consume: { health: 130 }, desc: 'Restores 130 health.' },
  { id: 'potion_health_l', name: 'Greater Healing Draught', type: 'consumable', icon: 'potion_health', metal: PAL.blood, rarity: 'superRare', level: 12, value: 140, stats: {}, stackable: true, consume: { healthPct: 0.55 }, desc: 'Restores 55% of maximum health.' },
  { id: 'potion_mana_s', name: 'Minor Mana Draught', type: 'consumable', icon: 'potion_mana', rarity: 'common', level: 1, value: 28, stats: {}, stackable: true, consume: { mana: 50 }, desc: 'Restores 50 mana.' },
  { id: 'potion_mana_m', name: 'Mana Draught', type: 'consumable', icon: 'potion_mana', rarity: 'rare', level: 6, value: 70, stats: {}, stackable: true, consume: { mana: 140 }, desc: 'Restores 140 mana.' },
  { id: 'potion_stamina', name: 'Wind Tonic', type: 'consumable', icon: 'potion_stamina', rarity: 'common', level: 2, value: 30, stats: {}, stackable: true, consume: { stamina: 80 }, desc: 'Restores 80 stamina.' },
  { id: 'potion_might', name: 'Draught of Might', type: 'consumable', icon: 'potion_buff', rarity: 'rare', level: 4, value: 85, stats: {}, stackable: true, consume: { buff: { stat: 'strength', amount: 8, duration: 120, name: 'Might' } }, desc: '+8 Strength for two minutes.' },
  { id: 'potion_swift', name: 'Draught of Swiftness', type: 'consumable', icon: 'potion_buff', metal: PAL.grassPale, rarity: 'rare', level: 4, value: 85, stats: {}, stackable: true, consume: { buff: { stat: 'moveSpeed', amount: 18, duration: 120, name: 'Swiftness' } }, desc: '+18 Movement Speed for two minutes.' },
  { id: 'potion_focus', name: 'Draught of Focus', type: 'consumable', icon: 'potion_buff', metal: PAL.arcaneLit, rarity: 'rare', level: 6, value: 95, stats: {}, stackable: true, consume: { buff: { stat: 'abilityPower', amount: 20, duration: 120, name: 'Focus' } }, desc: '+20% Ability Power for two minutes.' },
  { id: 'elixir_grand', name: 'Grand Elixir', type: 'consumable', icon: 'elixir', rarity: 'epic', level: 14, value: 400, stats: {}, stackable: true, consume: { healthPct: 1, mana: 400, stamina: 400 }, desc: 'Restores everything. Tastes like a struck bell.' },
  { id: 'antidote', name: 'Antidote', type: 'consumable', icon: 'potion_stamina', metal: PAL.toxic, rarity: 'common', level: 3, value: 35, stats: {}, stackable: true, consume: { cure: true, health: 20 }, desc: 'Cures poison and burning.' },
  { id: 'food_bread', name: 'Trail Bread', type: 'consumable', icon: 'food_bread', rarity: 'common', level: 1, value: 8, stats: {}, stackable: true, consume: { health: 18, stamina: 30 } },
  { id: 'food_meat', name: 'Roast Haunch', type: 'consumable', icon: 'food_meat', rarity: 'common', level: 1, value: 18, stats: {}, stackable: true, consume: { health: 40, stamina: 50 } },
  { id: 'food_cheese', name: 'Valley Cheese', type: 'consumable', icon: 'food_cheese', rarity: 'common', level: 1, value: 12, stats: {}, stackable: true, consume: { health: 25, mana: 20 } },
  { id: 'food_apple', name: 'Orchard Apple', type: 'consumable', icon: 'food_apple', rarity: 'common', level: 1, value: 5, stats: {}, stackable: true, consume: { health: 12, stamina: 20 } },
];

export const MATERIALS: ItemTemplate[] = [
  { id: 'mat_iron_ore', name: 'Iron Ore', type: 'material', icon: 'mat_ore', metal: PAL.iron, rarity: 'common', level: 1, value: 12, stats: {}, stackable: true },
  { id: 'mat_iron_ingot', name: 'Iron Ingot', type: 'material', icon: 'mat_ingot', metal: PAL.iron, rarity: 'common', level: 1, value: 30, stats: {}, stackable: true },
  { id: 'mat_steel_ingot', name: 'Steel Ingot', type: 'material', icon: 'mat_ingot', metal: PAL.steel, rarity: 'rare', level: 6, value: 75, stats: {}, stackable: true },
  { id: 'mat_leather', name: 'Cured Leather', type: 'material', icon: 'mat_leather', rarity: 'common', level: 1, value: 16, stats: {}, stackable: true },
  { id: 'mat_cloth', name: 'Linen Bolt', type: 'material', icon: 'mat_cloth', rarity: 'common', level: 1, value: 14, stats: {}, stackable: true },
  { id: 'mat_herb', name: 'Emberleaf', type: 'material', icon: 'mat_herb', rarity: 'common', level: 1, value: 18, stats: {}, stackable: true },
  { id: 'mat_bone', name: 'Old Bone', type: 'material', icon: 'mat_bone', rarity: 'common', level: 1, value: 10, stats: {}, stackable: true },
  { id: 'mat_crystal', name: 'Ley Crystal', type: 'material', icon: 'mat_crystal', metal: PAL.arcaneLit, rarity: 'rare', level: 5, value: 55, stats: {}, stackable: true },
  { id: 'mat_essence', name: 'Bound Essence', type: 'material', icon: 'mat_essence', rarity: 'superRare', level: 9, value: 120, stats: {}, stackable: true },
  { id: 'mat_gem_ruby', name: 'Cut Ruby', type: 'material', icon: 'gem', metal: PAL.blood, rarity: 'superRare', level: 8, value: 200, stats: {}, stackable: true },
  { id: 'mat_gem_sapphire', name: 'Cut Sapphire', type: 'material', icon: 'gem', metal: PAL.water, rarity: 'superRare', level: 8, value: 200, stats: {}, stackable: true },
  { id: 'mat_rune', name: 'Binding Rune', type: 'material', icon: 'rune', metal: PAL.arcane, rarity: 'epic', level: 10, value: 320, stats: {}, stackable: true, desc: 'Used at an anvil to re-roll an enchantment.' },
];

export const QUEST_ITEMS: ItemTemplate[] = [
  { id: 'q_wolf_pelt', name: 'Thick Wolf Pelt', type: 'quest', icon: 'mat_leather', rarity: 'common', level: 1, value: 0, stats: {}, stackable: true, noDrop: true, desc: 'Proof of a culled pack.' },
  { id: 'q_supply_crate', name: 'Ashvale Supply Parcel', type: 'quest', icon: 'quest', rarity: 'common', level: 1, value: 0, stats: {}, noDrop: true, desc: 'Sealed with the Alliance stamp.' },
  { id: 'q_ledger', name: 'Guild Ledger Page', type: 'quest', icon: 'scroll', rarity: 'common', level: 1, value: 0, stats: {}, noDrop: true, desc: 'Numbers somebody would rather you did not read.' },
  { id: 'q_crypt_key', name: 'Crypt Seal Key', type: 'quest', icon: 'key', rarity: 'rare', level: 1, value: 0, stats: {}, noDrop: true, desc: 'Cold to the touch.' },
  { id: 'q_heartseed', name: 'Heartseed of the Grove', type: 'quest', icon: 'mat_herb', rarity: 'superRare', level: 1, value: 0, stats: {}, noDrop: true, desc: 'It pulses when you hold it still.' },
  { id: 'q_relic_shard', name: 'Shard of the Modulo', type: 'quest', icon: 'mat_crystal', metal: PAL.frost, rarity: 'epic', level: 1, value: 0, stats: {}, stackable: true, noDrop: true, desc: 'One of many. There are always more.' },
  { id: 'q_missing_ring', name: "Maren's Wedding Ring", type: 'quest', icon: 'ring', metal: PAL.gold, rarity: 'common', level: 1, value: 0, stats: {}, noDrop: true },
  { id: 'q_bandit_orders', name: 'Cutter Marching Orders', type: 'quest', icon: 'scroll', rarity: 'common', level: 1, value: 0, stats: {}, noDrop: true },
  { id: 'q_ice_core', name: 'Frozen Core', type: 'quest', icon: 'mat_crystal', metal: PAL.frost, rarity: 'superRare', level: 1, value: 0, stats: {}, noDrop: true },
  { id: 'q_kings_letter', name: "King Jovan's Letter", type: 'quest', icon: 'scroll', metal: PAL.gold, rarity: 'rare', level: 1, value: 0, stats: {}, noDrop: true, desc: 'Sealed in gold wax, and written by hand.' },
];

export const ALL_TEMPLATES: ItemTemplate[] = [
  ...WEAPONS, ...ARMOR, ...OFFHANDS, ...ARTIFACTS, ...UNIQUES, ...CONSUMABLES, ...MATERIALS, ...QUEST_ITEMS,
];

export const TEMPLATE_BY_ID: Record<string, ItemTemplate> = Object.fromEntries(ALL_TEMPLATES.map((t) => [t.id, t]));

/** Templates eligible for random drops. */
export const DROPPABLE = ALL_TEMPLATES.filter(
  (t) => !t.noDrop && (t.type === 'weapon' || t.type === 'armor' || t.type === 'accessory'),
);

/** Region-locked relics, rolled only by chests and elites in that region. */
export const REGION_RELICS = UNIQUES.filter((t) => t.regions?.length);
