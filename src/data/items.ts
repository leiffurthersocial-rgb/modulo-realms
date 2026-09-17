import { PAL } from '../game/art/palette';
import type { IconKind } from '../game/art/icons';
import type { WeaponKind } from '../game/art/weaponart';
import type { ClassId } from './classes';
import type { ArmorLook, ConsumeEffect, EquipSlot, ItemType, Rarity, Stats } from '../game/items/types';
import type { RegionId } from './locations';
import { armorDefenseAt, weaponDamage, weaponDps } from './balance';

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
  weaponPower?: { id: string; name: string; cooldown: number; desc: string };
  armorLook?: ArmorLook;
  classes?: ClassId[];
  desc?: string;
  stackable?: boolean;
  consume?: ConsumeEffect;
  artifact?: { id: string; name: string; cooldown: number; desc: string };
  /** The forge will not rebind this item's runes. See Item.noReroll. */
  noReroll?: boolean;
  /** Excluded from random loot tables. */
  noDrop?: boolean;
  /** Only rolls as loot inside these regions. */
  regions?: RegionId[];
}

/**
 * A weapon is authored by what it IS — kind, level, how fast it swings, how
 * far it reaches — and its damage is solved from the shared DPS budget in
 * `balance.ts`. There is deliberately no damage argument: hand-written damage
 * is how a fast weapon quietly ends up worth twice a slow one of the same
 * level.
 *
 * `extra` is spread BEFORE `stats`, never after. Spread last, an `extra.stats`
 * object replaces the whole merged block rather than adding to it, which
 * silently strips the speed and range from every weapon carrying a bonus
 * attribute — and the defense from every such armour.
 */
const W = (
  id: string, name: string, kind: WeaponKind, level: number, speed: number, range: number,
  extra: Partial<ItemTemplate> = {},
): ItemTemplate => {
  const rarity = extra.rarity ?? 'common';
  const damage = weaponDamage(kind, level, rarity, speed);
  return {
    id, name, type: 'weapon', slot: 'mainHand', icon: kind as IconKind, weaponKind: kind,
    rarity, level, value: Math.round(20 + damage * 3.4 + level * 7),
    metal: PAL.iron,
    ...extra,
    // speed and range are the weapon's identity and always win over
    // `extra.stats`, which only carries bonus attributes. On a weapon
    // `attackSpeed` is the base swing rate, so a "+6 speed" bonus written
    // there would read as six swings a second.
    stats: { ...(extra.stats ?? {}), damage, attackSpeed: speed, range },
  };
};

/**
 * Armour is authored the same way as a weapon: level, rarity and a look. The
 * defense comes from the shared curve, and `weight` is the one dial — plate
 * buys more protection than a robe and pays for it in the bonus stats the
 * caller writes.
 */
const A = (
  id: string, name: string, level: number, weight: number, look: ArmorLook,
  extra: Partial<ItemTemplate> = {},
): ItemTemplate => {
  const rarity = extra.rarity ?? 'common';
  const defense = Math.max(1, Math.round(armorDefenseAt(level, rarity) * weight));
  return {
    id, name, type: 'armor', slot: 'armor', icon: 'chest',
    rarity, level, value: Math.round(24 + defense * 5.5 + level * 6),
    metal: look.color, accent: look.trim, armorLook: look,
    ...extra,
    stats: { ...(extra.stats ?? {}), defense },
  };
};

/** How much protection a silhouette is worth, as a share of the armour curve. */
const ROBE = 0.62, LIGHT = 0.82, MAIL = 1.15, PLATE = 1.4;

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
  W('sword_worn', 'Notched Shortsword', 'sword', 1, 1.35, 46, { desc: 'Somebody carried this a long way before you did.' }),
  W('sword_iron', 'Iron Sword', 'sword', 2, 1.3, 48),
  W('sword_steel', 'Steel Longsword', 'sword', 6, 1.25, 52, { metal: PAL.steel, stats: { strength: 2 } }),
  W('sword_valley', 'Valley Guard Blade', 'sword', 11, 1.28, 52, { metal: PAL.steel, rarity: 'rare', stats: { strength: 3, critChance: 3 } }),
  W('sword_frost', 'Rimeglass Blade', 'sword', 16, 1.3, 54, { metal: PAL.frost, glow: PAL.frost, rarity: 'superRare', stats: { intelligence: 4 }, fixedEnchants: [{ id: 'freezing', level: 1 }] }),
  W('greatsword_iron', 'Iron Greatsword', 'greatsword', 5, 0.78, 62, { stats: { strength: 2 } }),
  W('greatsword_crag', 'Cragbreaker', 'greatsword', 12, 0.72, 66, { metal: PAL.ironLit, rarity: 'rare', stats: { strength: 5, critDamage: 15 } }),
  W('greatsword_grave', 'Gravewarden Greatblade', 'greatsword', 16, 0.7, 68, { metal: PAL.slate, glow: PAL.arcane, rarity: 'superRare', stats: { strength: 7 } }),
  // axes and blunt
  W('axe_wood', "Woodcutter's Axe", 'axe', 1, 1.05, 48, { desc: 'Meant for timber. It has stopped being fussy.' }),
  W('axe_iron', 'Iron Battleaxe', 'axe', 4, 0.98, 52),
  W('greataxe_clan', 'Clanbreaker Axe', 'greataxe', 10, 0.7, 64, { metal: PAL.ironLit, rarity: 'rare', stats: { strength: 4 } }),
  W('hammer_iron', 'Iron Warhammer', 'hammer', 7, 0.75, 56, { stats: { strength: 3 } }),
  W('hammer_stone', 'Stonefall Maul', 'hammer', 13, 0.68, 60, { metal: PAL.rockPale, rarity: 'superRare', stats: { strength: 6 }, fixedEnchants: [{ id: 'shockwave', level: 1 }] }),
  W('mace_iron', 'Iron Mace', 'mace', 2, 1.1, 46),
  W('mace_dawn', 'Dawnward Mace', 'mace', 9, 1.05, 48, { metal: PAL.gold, glow: PAL.holy, rarity: 'rare', stats: { intelligence: 3 }, classes: ['paladin'] }),
  // light blades
  W('dagger_rusty', 'Rusted Dagger', 'dagger', 1, 2.1, 34, { stats: { critChance: 4 } }),
  W('dagger_iron', 'Iron Dagger', 'dagger', 2, 2, 36, { stats: { critChance: 6 } }),
  W('dagger_shadow', 'Shadowfang', 'dagger', 12, 2.1, 38, { metal: PAL.arcaneLit, glow: PAL.arcaneDark, rarity: 'superRare', stats: { critChance: 12, dexterity: 4 }, fixedEnchants: [{ id: 'venomous', level: 2 }] }),
  W('claws_beast', 'Bonebreaker Claws', 'claws', 6, 2.3, 34, { metal: PAL.cloth, stats: { critChance: 8 } }),
  W('spear_hunt', 'Hunting Spear', 'spear', 3, 1.15, 70),
  W('spear_pike', 'Guard Pike', 'spear', 9, 1.1, 76, { metal: PAL.steel, rarity: 'rare', stats: { defense: 3 } }),
  // ranged
  W('bow_hunting', 'Hunting Bow', 'bow', 1, 1.25, 455, { metal: PAL.wood, desc: 'Well-used yew, restrung last spring.' }),
  W('bow_yew', 'Yew Longbow', 'bow', 5, 1.15, 524, { metal: PAL.woodLit, stats: { dexterity: 2 } }),
  W('bow_court', 'Court Warden Bow', 'bow', 12, 1.2, 580, { metal: PAL.leafLit, glow: PAL.leafLit, rarity: 'superRare', stats: { dexterity: 5, critChance: 6 }, fixedEnchants: [{ id: 'multishot', level: 1 }] }),
  W('crossbow_iron', 'Iron Crossbow', 'crossbow', 7, 0.8, 552, { stats: { critDamage: 20 } }),
  W('crossbow_heavy', 'Barrow Repeater', 'crossbow', 14, 0.85, 580, { metal: PAL.ironDark, rarity: 'superRare', stats: { critDamage: 30 }, fixedEnchants: [{ id: 'piercing', level: 2 }] }),
  // magic
  W('staff_apprentice', 'Apprentice Staff', 'staff', 1, 1.05, 399, { metal: PAL.wood, glow: PAL.arcaneLit, stats: { intelligence: 2, maxMana: 10 } }),
  W('staff_ember', 'Emberwood Staff', 'staff', 6, 1, 452, { metal: PAL.wood, glow: PAL.flame, stats: { intelligence: 4, abilityPower: 8 } }),
  W('staff_concord', 'Concord Spellstaff', 'staff', 13, 1.02, 505, { metal: PAL.arcane, glow: PAL.arcaneLit, rarity: 'superRare', stats: { intelligence: 7, abilityPower: 14, maxMana: 30 } }),
  W('wand_copper', 'Copper Wand', 'wand', 2, 1.6, 372, { metal: PAL.copper, glow: PAL.frost, stats: { intelligence: 2 } }),
  W('tome_lesser', 'Lesser Grimoire', 'tome', 4, 1.2, 386, { metal: PAL.blood, glow: PAL.arcaneLit, stats: { intelligence: 3, maxMana: 15 } }),
  W('scythe_bone', 'Bone Scythe', 'scythe', 1, 1.05, 58, { metal: PAL.cloth, stats: { intelligence: 2 }, classes: ['necromancer'] }),
  W('scythe_grave', 'Gravewarden Scythe', 'scythe', 10, 0.95, 64, { metal: PAL.rot, glow: PAL.toxic, rarity: 'rare', stats: { intelligence: 5, lifesteal: 3 } }),

  /* --- duelling blades: fast, precise, built around crit --- */
  W('rapier_town', 'Town Guard Rapier', 'rapier', 3, 1.85, 44, { metal: PAL.steel, stats: { critChance: 6, dexterity: 1 } }),
  W('rapier_duellist', "Duellist's Needle", 'rapier', 8, 1.9, 46, { metal: PAL.steel, rarity: 'rare', stats: { critChance: 11, dexterity: 4 } }),
  W('rapier_court', 'Court Fencer', 'rapier', 13, 1.95, 48, { metal: PAL.leafLit, glow: PAL.leafLit, rarity: 'superRare', stats: { critChance: 15, dexterity: 6, moveSpeed: 4 }, fixedEnchants: [{ id: 'piercing', level: 2 }] }),
  W('rapier_mire', 'Mirefall Stinger', 'rapier', 10, 2, 46, { metal: PAL.toxic, glow: PAL.toxic, rarity: 'rare', stats: { critChance: 9, dexterity: 4 }, fixedEnchants: [{ id: 'venomous', level: 1 }] }),

  /* --- flails: slow, heavy, they hit everything nearby --- */
  W('flail_iron', 'Iron Flail', 'flail', 4, 0.9, 54, { stats: { strength: 2 } }),
  W('flail_morning', 'Morning Star', 'flail', 9, 0.85, 56, { metal: PAL.ironLit, rarity: 'rare', stats: { strength: 4, critDamage: 18 } }),
  W('flail_crag', 'Cragfall Flail', 'flail', 14, 0.78, 58, { metal: PAL.rockPale, rarity: 'superRare', stats: { strength: 7, critDamage: 25 }, fixedEnchants: [{ id: 'shockwave', level: 2 }] }),

  /* --- polearms: reach, sweep, the front rank's weapon --- */
  W('halberd_levy', 'Levy Halberd', 'halberd', 5, 0.92, 78, { stats: { defense: 2 } }),
  W('halberd_watch', 'Northwatch Halberd', 'halberd', 11, 0.88, 82, { metal: PAL.steel, rarity: 'rare', stats: { strength: 4, defense: 4 } }),
  W('halberd_reaper', 'Reaper of the Reach', 'halberd', 16, 0.82, 86, { metal: PAL.frost, glow: PAL.frost, rarity: 'superRare', stats: { strength: 7, defense: 5 }, fixedEnchants: [{ id: 'swirling', level: 2 }] }),

  /* --- war picks: armour-breakers, punishing on a crit --- */
  W('warpick_miner', "Miner's Pick", 'warpick', 2, 1.15, 44, { metal: PAL.iron, desc: 'Meant for ore. It has stopped caring about the difference.' }),
  W('warpick_guild', 'Guild War Pick', 'warpick', 7, 1.1, 46, { metal: PAL.copper, rarity: 'rare', stats: { critDamage: 25, strength: 2 } }),
  W('warpick_ironroot', 'Ironroot Beak', 'warpick', 13, 1.08, 48, { metal: PAL.copper, glow: PAL.ember, rarity: 'superRare', stats: { critDamage: 40, critChance: 8, strength: 4 }, fixedEnchants: [{ id: 'piercing', level: 3 }] }),

  /* --- orbs: caster focuses that hover and strike at range --- */
  W('orb_apprentice', 'Apprentice Orb', 'orb', 3, 1.4, 386, { metal: PAL.frost, glow: PAL.frost, stats: { intelligence: 3, maxMana: 18 } }),
  W('orb_ember', 'Emberglass Orb', 'orb', 8, 1.35, 426, { metal: PAL.flame, glow: PAL.ember, rarity: 'rare', stats: { intelligence: 5, abilityPower: 12 }, fixedEnchants: [{ id: 'fire_aspect', level: 1 }] }),
  W('orb_tide', 'Drowned Tidestone', 'orb', 11, 1.32, 452, { metal: PAL.water, glow: PAL.frost, rarity: 'superRare', stats: { intelligence: 7, abilityPower: 16, maxMana: 40 }, fixedEnchants: [{ id: 'freezing', level: 2 }] }),
  W('orb_hollow', 'Hollow Light', 'orb', 15, 1.3, 479, { metal: PAL.arcaneLit, glow: PAL.arcane, rarity: 'epic', stats: { intelligence: 10, abilityPower: 24, cooldownReduction: 8, lifesteal: 4 } }),

  /* --- a few more of the old kinds, to fill the mid-game --- */
  W('sword_mire', 'Bogsteel Falchion', 'sword', 8, 1.3, 50, { metal: PAL.swamp, rarity: 'rare', stats: { strength: 3, lifesteal: 2 } }),
  W('greatsword_dune', 'Duneholt Cleaver', 'greatsword', 9, 0.75, 64, { metal: PAL.sandDark, rarity: 'rare', stats: { strength: 4, maxHealth: 20 } }),
  W('axe_cutter', 'Ash Cutter Hatchet', 'axe', 7, 1.28, 50, { metal: PAL.ironDark, rarity: 'rare', stats: { critChance: 5 } }),
  W('dagger_guild', 'Guild Shiv', 'dagger', 6, 2.05, 36, { metal: PAL.copper, stats: { critChance: 9, magicFind: 4 } }),
  W('bow_mire', 'Mirewood Recurve', 'bow', 8, 1.2, 552, { metal: PAL.swampDark, rarity: 'rare', stats: { dexterity: 4, critChance: 4 } }),
  W('staff_dune', 'Sunstruck Staff', 'staff', 10, 1.02, 479, { metal: PAL.sand, glow: PAL.goldLit, rarity: 'rare', stats: { intelligence: 6, abilityPower: 12 } }),
  W('spear_mire', 'Bog Harpoon', 'spear', 6, 1.12, 78, { metal: PAL.rot, rarity: 'rare', stats: { dexterity: 3 } }),
  W('mace_crag', 'Cragwarden Mace', 'mace', 12, 1.05, 50, { metal: PAL.rockPale, rarity: 'rare', stats: { strength: 5, defense: 4 } }),

  /* --- the outer marches: the Gloaming, the Saltreach, the Cinderwastes --- */
  W('scythe_gloam', 'Gloamreaper', 'scythe', 18, 0.98, 64, { metal: PAL.leafDark, glow: PAL.toxic, rarity: 'rare', stats: { intelligence: 8, lifesteal: 4 }, fixedEnchants: [{ id: 'venomous', level: 2 }] }),
  W('bow_gloam', 'Exile\'s Longbow', 'bow', 21, 1.16, 610, { metal: PAL.leafDark, glow: PAL.toxic, rarity: 'superRare', stats: { dexterity: 8, critChance: 8 }, fixedEnchants: [{ id: 'venomous', level: 2 }] }),
  W('dagger_gloam', 'Thorn of the Court', 'dagger', 24, 2.15, 38, { metal: PAL.leaf, glow: PAL.toxic, rarity: 'epic', stats: { critChance: 18, dexterity: 9 }, fixedEnchants: [{ id: 'venomous', level: 3 }] }),
  W('spear_salt', 'Legionary Pike', 'spear', 20, 1.08, 82, { metal: '#9fc0c8', rarity: 'rare', stats: { dexterity: 7, defense: 6 } }),
  W('halberd_tide', 'Tidewarden Halberd', 'halberd', 25, 0.8, 90, { metal: '#9fc0c8', glow: PAL.foam, rarity: 'epic', stats: { strength: 11, defense: 9 }, fixedEnchants: [{ id: 'freezing', level: 2 }] }),
  W('orb_salt', 'Saltglass Lens', 'orb', 23, 1.3, 490, { metal: PAL.foam, glow: PAL.water, rarity: 'superRare', stats: { intelligence: 12, abilityPower: 24, maxMana: 70 } }),
  W('greataxe_cutter', 'Warlord\'s Cleaver', 'greataxe', 27, 0.68, 68, { metal: PAL.ironDark, glow: PAL.ember, rarity: 'epic', stats: { strength: 14, critDamage: 35 }, fixedEnchants: [{ id: 'fire_aspect', level: 3 }] }),
  W('mace_cinder', 'Cinderfall Mace', 'mace', 22, 1.04, 52, { metal: '#6a3020', glow: PAL.flame, rarity: 'superRare', stats: { strength: 10, defense: 6 }, fixedEnchants: [{ id: 'fire_aspect', level: 2 }] }),
  W('staff_cinder', 'Ashcaller Staff', 'staff', 29, 1, 545, { metal: PAL.ember, glow: PAL.flameLit, rarity: 'epic', stats: { intelligence: 17, abilityPower: 34, maxMana: 100 }, fixedEnchants: [{ id: 'ember_focus', level: 3 }] }),
  W('crossbow_waste', 'Wastebreaker', 'crossbow', 30, 0.8, 640, { metal: PAL.emberDark, glow: PAL.ember, rarity: 'epic', stats: { critDamage: 65, dexterity: 14 }, fixedEnchants: [{ id: 'chain_reaction', level: 2 }] }),

  /* ---------------------------------------------------------------- */
  /* The late game: the Frostmarch, and everything above it            */
  /*                                                                   */
  /* Levels 18 to 34. None of these numbers were chosen — every one is */
  /* solved from balance.ts, so this whole block could be twice as     */
  /* long without anything drifting out of line.                       */
  /* ---------------------------------------------------------------- */
  W('sword_jarl', 'Jarlsteel Longsword', 'sword', 19, 1.28, 54, { metal: PAL.steel, rarity: 'rare', stats: { strength: 6, critChance: 4 } }),
  W('greatsword_glacier', 'Glacierbreak', 'greatsword', 22, 0.7, 68, { metal: '#bcd8e8', glow: PAL.frost, rarity: 'superRare', stats: { strength: 9, critDamage: 20 }, fixedEnchants: [{ id: 'freezing', level: 2 }] }),
  W('greataxe_jotun', 'Jotunbane', 'greataxe', 25, 0.68, 66, { metal: PAL.ironLit, glow: PAL.frost, rarity: 'epic', stats: { strength: 12, maxHealth: 60 } }),
  W('hammer_avalanche', 'Avalanche Maul', 'hammer', 27, 0.66, 62, { metal: PAL.rockPale, rarity: 'epic', stats: { strength: 14, critDamage: 30 }, fixedEnchants: [{ id: 'shockwave', level: 3 }] }),
  W('halberd_gate', 'Gatewarden Halberd', 'halberd', 24, 0.8, 88, { metal: PAL.frost, glow: PAL.frost, rarity: 'superRare', stats: { strength: 9, defense: 8 }, fixedEnchants: [{ id: 'swirling', level: 2 }] }),
  W('dagger_icefang', 'Icefang', 'dagger', 21, 2.15, 38, { metal: PAL.ice, glow: PAL.frost, rarity: 'superRare', stats: { critChance: 16, dexterity: 7 }, fixedEnchants: [{ id: 'freezing', level: 2 }] }),
  W('rapier_pale', 'Pale Needle', 'rapier', 26, 2, 48, { metal: PAL.white, glow: PAL.frost, rarity: 'epic', stats: { critChance: 20, dexterity: 10, moveSpeed: 5 }, fixedEnchants: [{ id: 'piercing', level: 3 }] }),
  W('spear_glacier', 'Glacier Pike', 'spear', 23, 1.08, 80, { metal: PAL.ice, rarity: 'rare', stats: { dexterity: 7, defense: 5 } }),
  W('flail_wintertide', 'Wintertide Flail', 'flail', 28, 0.76, 58, { metal: '#8fc4dc', glow: PAL.frost, rarity: 'epic', stats: { strength: 13, critDamage: 35 }, fixedEnchants: [{ id: 'shockwave', level: 2 }] }),
  W('claws_jotun', 'Rimeclaws', 'claws', 30, 2.35, 36, { metal: PAL.frost, glow: PAL.white, rarity: 'epic', stats: { critChance: 18, attackSpeed: 6, dexterity: 12 } }),
  W('warpick_moraine', 'Moraine Pick', 'warpick', 20, 1.08, 48, { metal: PAL.rockPale, rarity: 'rare', stats: { critDamage: 45, strength: 6 } }),
  W('scythe_longwinter', 'Scythe of the Long Winter', 'scythe', 29, 0.92, 66, { metal: PAL.bone, glow: PAL.frost, rarity: 'epic', stats: { intelligence: 12, lifesteal: 6 }, fixedEnchants: [{ id: 'freezing', level: 3 }] }),
  W('bow_jotun', 'Jotunhorn Bow', 'bow', 20, 1.18, 600, { metal: PAL.bone, rarity: 'rare', stats: { dexterity: 7, critChance: 6 } }),
  W('bow_whitewind', 'Whitewind Longbow', 'bow', 27, 1.22, 640, { metal: PAL.white, glow: PAL.frost, rarity: 'epic', stats: { dexterity: 12, critChance: 12, moveSpeed: 4 }, fixedEnchants: [{ id: 'multishot', level: 2 }] }),
  W('crossbow_gate', 'Gatebreaker Arbalest', 'crossbow', 24, 0.82, 620, { metal: PAL.ironDark, glow: PAL.frost, rarity: 'superRare', stats: { critDamage: 55, dexterity: 8 }, fixedEnchants: [{ id: 'piercing', level: 3 }] }),
  W('wand_hoarfrost', 'Hoarfrost Wand', 'wand', 19, 1.55, 420, { metal: PAL.frost, glow: PAL.ice, rarity: 'rare', stats: { intelligence: 7, abilityPower: 14 } }),
  W('staff_glacier', 'Glacierheart Staff', 'staff', 22, 1, 530, { metal: PAL.ice, glow: PAL.frost, rarity: 'superRare', stats: { intelligence: 11, abilityPower: 22, maxMana: 55 }, fixedEnchants: [{ id: 'frost_focus', level: 2 }] }),
  W('orb_longnight', 'Orb of the Long Night', 'orb', 26, 1.3, 500, { metal: PAL.arcaneDark, glow: PAL.arcaneLit, rarity: 'epic', stats: { intelligence: 15, abilityPower: 32, cooldownReduction: 10, lifesteal: 5 } }),
  W('tome_jotun', 'Codex of the Jotunreach', 'tome', 30, 1.15, 520, { metal: PAL.bone, glow: PAL.frost, rarity: 'epic', stats: { intelligence: 18, abilityPower: 36, maxMana: 110 } }),

  /* --- Under the Gate: levels 35 to 40, and nothing is level-appropriate --- */
  W('greatsword_divide', 'The Long Division', 'greatsword', 35, 0.7, 70, { metal: PAL.arcaneLit, glow: PAL.arcane, rarity: 'epic', stats: { strength: 18, critDamage: 40 }, fixedEnchants: [{ id: 'committed', level: 3 }] }),
  W('hammer_carry', 'Carry the One', 'hammer', 36, 0.64, 64, { metal: PAL.white, glow: PAL.arcaneLit, rarity: 'epic', stats: { strength: 20, critDamage: 50 }, fixedEnchants: [{ id: 'shockwave', level: 3 }] }),
  W('dagger_precision', 'Precision Loss', 'dagger', 35, 2.2, 40, { metal: PAL.arcaneDark, glow: PAL.arcaneLit, rarity: 'epic', stats: { critChance: 22, dexterity: 16 }, fixedEnchants: [{ id: 'piercing', level: 3 }] }),
  W('halberd_factor', 'Factor', 'halberd', 37, 0.78, 92, { metal: PAL.steel, glow: PAL.arcane, rarity: 'epic', stats: { strength: 16, defense: 12 }, fixedEnchants: [{ id: 'swirling', level: 3 }] }),
  W('bow_zero', 'Zero', 'bow', 36, 1.2, 680, { metal: PAL.white, glow: PAL.arcaneLit, rarity: 'epic', stats: { dexterity: 18, critChance: 16 }, fixedEnchants: [{ id: 'multishot', level: 3 }] }),
  W('crossbow_quotient', 'Quotient', 'crossbow', 38, 0.8, 660, { metal: PAL.arcaneDark, glow: PAL.arcane, rarity: 'legendary', stats: { critDamage: 80, dexterity: 18 }, fixedEnchants: [{ id: 'chain_reaction', level: 3 }] }),
  W('staff_modulo', 'The Modulo, Entire', 'staff', 38, 1, 580, { metal: PAL.arcane, glow: PAL.white, rarity: 'legendary', stats: { intelligence: 26, abilityPower: 52, maxMana: 180, cooldownReduction: 14 }, fixedEnchants: [{ id: 'void_strike', level: 3 }] }),
  W('orb_irrational', 'The Irrational', 'orb', 37, 1.28, 540, { metal: PAL.white, glow: PAL.arcaneLit, rarity: 'legendary', stats: { intelligence: 24, abilityPower: 48, lifesteal: 8 }, fixedEnchants: [{ id: 'soul_siphon', level: 3 }] }),

  /* --- the deep marches: levels 52 to 75 --- */
  W('sword_drowned', 'Drowned Longsword', 'sword', 53, 1.26, 54, { metal: '#6f9ab4', rarity: 'rare', stats: { strength: 8, maxHealth: 60 } }),
  W('spear_fen', 'Fenreed Spear', 'spear', 55, 1.18, 74, { metal: '#4a7a6a', rarity: 'rare', stats: { dexterity: 9 } }),
  W('staff_silt', 'Siltbound Stave', 'staff', 56, 0.96, 520, { metal: '#38505a', glow: '#8fd0f0', rarity: 'superRare', stats: { intelligence: 12, abilityPower: 16 } }),
  W('greataxe_mire', 'Mirebreaker', 'greataxe', 58, 0.64, 70, { metal: '#243330', rarity: 'superRare', stats: { strength: 13, critDamage: 24 } }),
  W('bow_reed', 'Blackreed Bow', 'bow', 59, 1.12, 560, { metal: '#1c2a26', rarity: 'superRare', stats: { dexterity: 12, critChance: 7 } }),
  W('dagger_undertow', 'Undertow', 'dagger', 61, 2.0, 40, { metal: '#6f9ab4', glow: PAL.foam, rarity: 'epic', stats: { dexterity: 14, critChance: 11 } }),
  W('halberd_storm', 'Stormward Halberd', 'halberd', 62, 0.82, 82, { metal: '#5a5480', glow: '#b9b0ff', rarity: 'epic', stats: { strength: 14, defense: 8 } }),
  W('wand_fork', 'Forked Wand', 'wand', 63, 1.5, 460, { metal: '#9a8fe8', glow: '#e0dcff', rarity: 'epic', stats: { intelligence: 15, cooldownReduction: 8 } }),
  W('greatsword_glasswalk', 'Glasswalk Greatblade', 'greatsword', 65, 0.7, 76, { metal: '#7f8fb4', glow: '#c9d2ee', rarity: 'epic', stats: { strength: 16, critDamage: 32 } }),
  W('crossbow_thunder', 'Thunderlatch', 'crossbow', 66, 0.86, 620, { metal: '#4b4470', glow: '#b9b0ff', rarity: 'epic', stats: { dexterity: 16, critDamage: 30 } }),
  W('scythe_stormwake', 'Stormwake Scythe', 'scythe', 67, 1.0, 84, { metal: '#2e2a48', glow: '#9a8fe8', rarity: 'epic', stats: { intelligence: 17, abilityPower: 22 } }),
  W('mace_ember', 'Emberfall Mace', 'mace', 68, 1.06, 58, { metal: '#8a2a18', glow: PAL.flameLit, rarity: 'epic', stats: { strength: 17, maxHealth: 120 } }),
  W('axe_cinder', 'Cindercleaver', 'axe', 70, 0.98, 60, { metal: '#6a2016', glow: PAL.flame, rarity: 'epic', stats: { strength: 18, critChance: 8 } }),
  W('tome_deep', 'The Deep Ledger', 'tome', 71, 1.1, 480, { metal: '#3a1210', glow: PAL.ember, rarity: 'epic', stats: { intelligence: 19, abilityPower: 26 } }),
  W('claws_emberjaw', 'Emberjaw Talons', 'claws', 72, 2.2, 100, { metal: '#4a1a14', glow: PAL.flameLit, rarity: 'epic', stats: { dexterity: 19, critChance: 12 } }),
  W('hammer_floor', 'Underfloor Maul', 'hammer', 74, 0.62, 66, { metal: '#330d08', glow: PAL.flame, rarity: 'epic', stats: { strength: 21, critDamage: 40 } }),
];

/* ------------------------------------------------------------------ */
/* Armour — one slot, whole outfits                                    */
/* ------------------------------------------------------------------ */

export const ARMOR: ItemTemplate[] = [
  A('armor_traveller', "Traveller's Garb", 1, LIGHT, light('#5c5140', PAL.wood), { stats: { moveSpeed: 2 }, desc: 'Road dust, and a lot of it.' }),
  A('armor_leather', 'Padded Leathers', 2, LIGHT, light(PAL.clay, PAL.wood), { stats: { maxHealth: 10 } }),
  A('armor_robe_apprentice', 'Apprentice Robe', 1, ROBE, robe(PAL.arcaneDark, PAL.frost, 'wizard'), { stats: { maxMana: 16, intelligence: 1 } }),
  A('armor_acolyte', 'Acolyte Vestments', 5, ROBE, robe('#3f4a6a', PAL.gold), { rarity: 'rare', stats: { maxMana: 30, intelligence: 3 } }),
  A('armor_mail', 'Mail Hauberk', 5, MAIL, heavy(PAL.iron, PAL.ironLit), { stats: { maxHealth: 22 } }),
  A('armor_hunter', 'Hunter\'s Hide', 6, LIGHT, light('#4a5a3a', PAL.leafLit, 'hood'), { rarity: 'rare', stats: { dexterity: 3, moveSpeed: 4 } }),
  A('armor_wolfhide', 'Wolfhide Mantle', 8, LIGHT, light('#6b6a74', PAL.cloth, 'hood', '#4a4955'), { rarity: 'rare', stats: { maxHealth: 28, moveSpeed: 3 } }),
  A('armor_guard', 'Valley Guard Plate', 9, PLATE, heavy(PAL.steel, PAL.gold, 'full', '#3a5a8a'), { rarity: 'rare', stats: { maxHealth: 40, moveSpeed: -2 } }),
  A('armor_shadow', 'Shadow Walker', 12, LIGHT, light('#241d2e', PAL.arcaneLit, 'hood', '#1a1626'), { rarity: 'epic', stats: { dexterity: 6, critChance: 6, moveSpeed: 8 }, fixedEnchants: [{ id: 'deflect', level: 1 }] }),
  A('armor_barrow', 'Barrow Shroud', 13, ROBE, robe('#2f3346', PAL.frost, 'hood', '#22283a'), { rarity: 'epic', stats: { maxMana: 55, intelligence: 6, abilityPower: 10 } }),
  A('armor_frostguard', 'Frostguard Mail', 14, PLATE, heavy('#6fa8c4', PAL.white, 'horned', '#2f4458'), { rarity: 'epic', stats: { maxHealth: 70, defense: 6 }, fixedEnchants: [{ id: 'thorns', level: 1 }] }),
  A('armor_ironroot', 'Ironroot Plate', 15, PLATE, heavy(PAL.copper, PAL.gold, 'full'), { rarity: 'epic', stats: { maxHealth: 80, strength: 5, moveSpeed: -3 } }),
  A('armor_concord', 'Concord Mantle', 11, ROBE, robe(PAL.arcane, PAL.frost, 'wizard', PAL.arcaneDark), { rarity: 'superRare', stats: { maxMana: 48, intelligence: 6, abilityPower: 10 } }),
  A('armor_scout', 'Scoutmaster Kit', 7, LIGHT, light(PAL.leaf, PAL.sandLit, 'cap'), { rarity: 'rare', stats: { moveSpeed: 9, dexterity: 3, maxStamina: 25 } }),
  A('armor_duskforged', 'Duskforged Plate', 16, PLATE, heavy('#3a3648', PAL.ember, 'horned', '#2a1a1a'), {
    rarity: 'legendary', glow: PAL.ember, noDrop: true,
    stats: { maxHealth: 130, defense: 10, strength: 7, moveSpeed: -2 },
    effects: ['thorns', 'earthshaker'],
    desc: 'Heavy as guilt, and about as easy to put down.',
  }),
  A('armor_hollow_court', 'Mantle of the Hollow Court', 17, ROBE, robe('#2a2438', PAL.gold, 'crown', '#3a2a4a'), {
    rarity: 'legendary', glow: PAL.arcaneLit, noDrop: true,
    stats: { maxMana: 90, intelligence: 12, abilityPower: 22, lifesteal: 5 },
    effects: ['vampiric', 'flowstate'],
    desc: 'The court wore this to the grave and kept wearing it.',
  }),

  /* --- mid-game outfits, one per region, so travel changes how you dress --- */
  A('armor_bogweave', 'Bogweave Coat', 7, LIGHT, light(PAL.swamp, PAL.rot, 'hood'), { rarity: 'rare', stats: { maxHealth: 26, defense: 2 }, desc: 'Waxed against water that would rather be inside you.' }),
  A('armor_sunveil', 'Sunveil Wrap', 8, ROBE, robe(PAL.sandLit, PAL.gold, 'hood'), { rarity: 'rare', stats: { maxMana: 34, intelligence: 4, moveSpeed: 3 } }),
  A('armor_clanmail', 'Clanhold Ringmail', 10, MAIL, heavy(PAL.ironDark, PAL.copper, 'horned'), { rarity: 'rare', stats: { maxHealth: 46, strength: 3 } }),
  A('armor_thornweave', 'Thornweave Habit', 9, ROBE, robe('#2d4a2f', PAL.leafLit, 'hood', '#1f3322'), { rarity: 'rare', stats: { maxMana: 38, abilityPower: 9, moveSpeed: 3 } }),
  A('armor_cutter', 'Cutter Raid Harness', 11, LIGHT, light('#5a3a2a', PAL.ember, 'cap'), { rarity: 'superRare', stats: { attackSpeed: 6, critChance: 5, moveSpeed: 5 } }),
  A('armor_wardplate', 'Wardens Bulwark', 13, PLATE, heavy('#4a5a6a', PAL.frost, 'full', '#2a3a4a'), { rarity: 'superRare', stats: { maxHealth: 64, defense: 7, moveSpeed: -2 }, fixedEnchants: [{ id: 'deflect', level: 2 }] }),
  A('armor_emberplate', 'Emberforge Plate', 15, PLATE, heavy('#6a3020', PAL.flameLit, 'horned', '#3a1a12'), { rarity: 'epic', glow: PAL.ember, stats: { maxHealth: 88, defense: 8, strength: 6 }, fixedEnchants: [{ id: 'fire_aspect', level: 2 }] }),
  A('armor_tidecaller', 'Tidecaller Vestments', 14, ROBE, robe('#274a5e', PAL.frost, 'wizard', '#1a3242'), { rarity: 'epic', glow: PAL.frost, stats: { maxMana: 72, intelligence: 9, abilityPower: 16 }, fixedEnchants: [{ id: 'freezing', level: 2 }] }),

  /* --- the outer marches --- */
  A('armor_gloamweave', 'Gloamweave', 18, LIGHT, light('#1f3a28', PAL.toxic, 'hood', '#132017'), { rarity: 'rare', stats: { dexterity: 8, moveSpeed: 8, lifesteal: 3 } }),
  A('armor_exile', "Exile's Leathers", 23, LIGHT, light('#25412a', PAL.leafLit, 'hood', '#16281c'), { rarity: 'epic', glow: PAL.toxic, stats: { dexterity: 12, critChance: 9, moveSpeed: 10 } }),
  A('armor_legionary', 'Drowned Legionary Plate', 21, PLATE, heavy('#6f8e92', PAL.foam, 'full', '#33585c'), { rarity: 'superRare', stats: { maxHealth: 130, defense: 10, moveSpeed: -2 } }),
  A('armor_saltglass', 'Saltglass Vestments', 25, ROBE, robe('#2f4a52', PAL.foam, 'wizard', '#1d3138'), { rarity: 'epic', glow: PAL.foam, stats: { maxMana: 130, intelligence: 14, abilityPower: 28 } }),
  A('armor_cutterlord', 'Warlord Harness', 27, MAIL, heavy('#6a3020', PAL.flameLit, 'horned', '#3a1a12'), { rarity: 'epic', glow: PAL.ember, stats: { maxHealth: 165, strength: 12, attackSpeed: 6 } }),
  A('armor_cinderplate', 'Cinderwaste Plate', 30, PLATE, heavy('#5a2418', PAL.flame, 'full', '#2e120b'), { rarity: 'epic', glow: PAL.flame, stats: { maxHealth: 215, defense: 16, moveSpeed: -3 }, fixedEnchants: [{ id: 'fire_aspect', level: 2 }] }),

  /* --- the Frostmarch and the Jotunreach --- */
  A('armor_marchplate', 'Frostmarch Plate', 19, PLATE, heavy('#5a6a7a', PAL.steel, 'full', '#33404f'), { rarity: 'superRare', stats: { maxHealth: 110, defense: 9, moveSpeed: -2 } }),
  A('armor_palehide', 'Pale Hunter Hide', 20, LIGHT, light('#8f9aa8', PAL.white, 'hood', '#6b7684'), { rarity: 'superRare', stats: { dexterity: 9, moveSpeed: 9, critChance: 6 } }),
  A('armor_whitewalk', 'Whitewalker Kit', 22, LIGHT, light('#c6d4e0', PAL.frost, 'cap'), { rarity: 'epic', stats: { dexterity: 11, moveSpeed: 11, maxStamina: 60 }, fixedEnchants: [{ id: 'deflect', level: 2 }] }),
  A('armor_riven', 'Riven Choir Vestments', 24, ROBE, robe('#2a3c4e', PAL.ice, 'wizard', '#1b2a38'), { rarity: 'epic', glow: PAL.frost, stats: { maxMana: 120, intelligence: 13, abilityPower: 26 } }),
  A('armor_jotunmail', 'Jotunmail', 26, MAIL, heavy('#7d8ea0', PAL.frost, 'horned', '#3a4a5a'), { rarity: 'epic', stats: { maxHealth: 150, strength: 10, defense: 8 } }),
  A('armor_glacierguard', 'Glacierguard Plate', 28, PLATE, heavy('#9fc4d8', PAL.white, 'full', '#4a6a80'), { rarity: 'epic', glow: PAL.frost, stats: { maxHealth: 185, defense: 14, moveSpeed: -3 }, fixedEnchants: [{ id: 'thorns', level: 2 }] }),
  A('armor_longwinter', 'Shroud of the Long Winter', 30, ROBE, robe('#1f2a38', PAL.frost, 'hood', '#141d28'), { rarity: 'legendary', glow: PAL.ice, stats: { maxMana: 180, intelligence: 18, abilityPower: 38, lifesteal: 6 }, effects: ['frostbite'] }),
  A('armor_divisor', 'Divisor Plate', 35, PLATE, heavy('#3b3550', PAL.arcaneLit, 'full', '#241f36'), { rarity: 'epic', glow: PAL.arcane, stats: { maxHealth: 300, defense: 22, strength: 16, moveSpeed: -3 } }),
  A('armor_integer', 'Vestments of the Whole Number', 37, ROBE, robe('#221c34', PAL.white, 'wizard', '#151022'), { rarity: 'legendary', glow: PAL.arcaneLit, stats: { maxMana: 260, intelligence: 26, abilityPower: 52, cooldownReduction: 12 }, effects: ['flowstate'] }),
  A('armor_uncountable', 'The Uncountable', 39, LIGHT, light('#e8e4f2', PAL.white, 'hood', '#b9b2d0'), { rarity: 'legendary', glow: PAL.white, stats: { dexterity: 26, moveSpeed: 16, critChance: 14, maxStamina: 120 }, fixedEnchants: [{ id: 'deflect', level: 3 }] }),
  A('armor_gatekeeper', "Gatekeeper's Harness", 32, PLATE, heavy('#cfe4f0', PAL.holy, 'crown', '#6f9ab4'), {
    rarity: 'legendary', glow: PAL.white, noDrop: true,
    stats: { maxHealth: 260, defense: 20, strength: 14, moveSpeed: -2 },
    effects: ['frostbite', 'soulbind'],
    desc: 'Whatever wore this stood at the gate until the gate outlasted it.',
  }),

  /* --- the deep marches --- */
  A('armor_fenweave', 'Fenweave Shroud', 54, ROBE, robe('#243330', '#5a8a6a', 'hood', '#1c2a26'), { rarity: 'superRare', stats: { maxMana: 180, intelligence: 14, abilityPower: 20 } }),
  A('armor_drowned', 'Drowned Legion Plate', 57, PLATE, heavy('#38505a', PAL.foam, 'full', '#1c2b33'), { rarity: 'epic', stats: { maxHealth: 320, defense: 16, moveSpeed: -3 } }),
  A('armor_reedstep', 'Reedstep Leathers', 59, LIGHT, light('#1c2a26', '#8fd0f0', 'hood', '#101a18'), { rarity: 'epic', stats: { dexterity: 15, moveSpeed: 11, maxStamina: 90 } }),
  A('armor_stormward', 'Stormward Harness', 63, PLATE, heavy('#4b4470', '#b9b0ff', 'horned', '#2e2a48'), { rarity: 'epic', glow: '#b9b0ff', stats: { maxHealth: 360, defense: 20 }, fixedEnchants: [{ id: 'deflect', level: 2 }] }),
  A('armor_glasscloak', 'Glasswalker Cloak', 66, LIGHT, light('#7f8fb4', '#c9d2ee', 'hood', '#454f6e'), { rarity: 'epic', stats: { dexterity: 18, critChance: 9, moveSpeed: 12 } }),
  A('armor_stormrobe', 'Robe of the Open Sky', 68, ROBE, robe('#2e2a48', '#e0dcff', 'circlet', '#4b4470'), { rarity: 'epic', glow: '#9a8fe8', stats: { maxMana: 280, intelligence: 20, abilityPower: 32 } }),
  A('armor_emberplate', 'Emberwrought Plate', 71, PLATE, heavy('#3a1210', PAL.flameLit, 'full', '#1c0806'), { rarity: 'epic', glow: PAL.ember, stats: { maxHealth: 460, defense: 26, strength: 12, moveSpeed: -4 }, fixedEnchants: [{ id: 'thorns', level: 2 }] }),
  A('armor_underfloor', 'What the Floor Wore', 74, MAIL, heavy('#330d08', PAL.flame, 'horned', '#4a1a14'), { rarity: 'legendary', glow: PAL.flameLit, stats: { maxHealth: 520, defense: 28, strength: 15, critDamage: 30 }, effects: ['thorns', 'earthshaker'], desc: 'Scale, and not from anything that had a name.' }),
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
  { id: 'shield_march', name: 'Frostmarch Wall', type: 'armor', slot: 'offHand', icon: 'shield', weaponKind: 'shield', metal: '#5a6a7a', accent: PAL.steel, rarity: 'superRare', level: 19, value: 1400, stats: { defense: 52, maxHealth: 110, moveSpeed: -4 } },
  { id: 'orb_hoar', name: 'Hoarfrost Lens', type: 'armor', slot: 'offHand', icon: 'orb', weaponKind: 'orb', metal: PAL.ice, glow: PAL.frost, rarity: 'epic', level: 22, value: 1600, stats: { abilityPower: 30, maxMana: 100, cooldownReduction: 8 } },
  { id: 'shield_jotun', name: 'Jotun Doorplank', type: 'armor', slot: 'offHand', icon: 'shield', weaponKind: 'shield', metal: '#7d8ea0', accent: PAL.frost, glow: PAL.frost, rarity: 'epic', level: 26, value: 2300, stats: { defense: 72, maxHealth: 170, moveSpeed: -5 }, fixedEnchants: [{ id: 'thorns', level: 3 }], desc: 'A door, to something that used a mountain for a house.' },
  { id: 'tome_glacier', name: 'The Glacier Testament', type: 'armor', slot: 'offHand', icon: 'tome', weaponKind: 'tome', metal: PAL.white, glow: PAL.ice, rarity: 'legendary', level: 29, value: 3400, stats: { maxMana: 190, intelligence: 16, abilityPower: 34, cooldownReduction: 12 } },
  { id: 'shield_axiom', name: 'Axiom', type: 'armor', slot: 'offHand', icon: 'shield', weaponKind: 'shield', metal: PAL.white, accent: PAL.arcaneLit, glow: PAL.arcane, rarity: 'legendary', level: 36, value: 5600, stats: { defense: 110, maxHealth: 280, moveSpeed: -4 }, fixedEnchants: [{ id: 'thorns', level: 3 }], desc: 'A thing assumed to be true, beaten flat and strapped to an arm.' },
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

  /* --- the outer marches --- */
  ART('art_gloaming_seed', 'Seed of the Gloaming', 'mat_herb', 25, 'epic', 2100, { abilityPower: 24, lifesteal: 5, maxHealth: 90 },
    { id: 'summon_wolf', name: 'Send the Wood', cooldown: 34, desc: 'The undergrowth stands up and fights for you.' },
    { metal: PAL.leafDark, accent: PAL.toxic, glow: PAL.toxic }),
  ART('art_tidecrown', 'The Drowned Crown', 'ring', 27, 'epic', 2600, { maxHealth: 150, defense: 12, intelligence: 12 },
    { id: 'ward', name: 'High Water', cooldown: 28, desc: 'A wall of salt water that takes the next several blows for you.' },
    { metal: PAL.gold, accent: PAL.foam, glow: PAL.foam }),
  ART('art_cinder_core', 'The Cinder Core', 'mat_crystal', 31, 'legendary', 4400, { strength: 16, abilityPower: 34, critDamage: 40 },
    { id: 'fire_nova', name: 'Open the Lid', cooldown: 24, desc: 'The ground splits and the waste comes up through it.' },
    { metal: PAL.ember, accent: PAL.flameLit, glow: PAL.flame, effects: ['burning_edge'] }),

  /* --- the far north --- */
  ART('art_winter_horn', 'Horn of the Long Winter', 'horn', 20, 'epic', 1500, { maxHealth: 120, defense: 9 },
    { id: 'rally', name: 'Sound the Winter', cooldown: 32, desc: 'A note that heals you and freezes everything that hears it.' },
    { metal: PAL.bone, accent: PAL.frost, glow: PAL.frost }),
  ART('art_glacier_heart', 'Heart of the Glacier', 'mat_crystal', 26, 'epic', 2400, { intelligence: 14, abilityPower: 26, defense: 8 },
    { id: 'fire_nova', name: 'Calving', cooldown: 26, desc: 'The ground splits in a ring of ice around you.' },
    { metal: PAL.ice, glow: PAL.frost }),
  ART('art_last_gate', 'Key of the Last Gate', 'key', 32, 'legendary', 5200,
    { maxHealth: 160, strength: 12, intelligence: 12, dexterity: 12, abilityPower: 30, cooldownReduction: 15, magicFind: 25 },
    { id: 'time_fold', name: 'Hold the Gate', cooldown: 42, desc: 'Stops time inside the whole arena, and you alone keep walking.' },
    { metal: PAL.white, accent: PAL.holy, glow: PAL.frost, noDrop: true, effects: ['spiritcall', 'flowstate', 'frostbite'], desc: 'It was never a key. It was what the gate was holding shut.' }),

  ART('art_remainder', 'The Remainder Itself', 'mat_crystal', 40, 'mythic', 14000,
    { maxHealth: 320, strength: 20, intelligence: 20, dexterity: 20, abilityPower: 50, cooldownReduction: 20, magicFind: 35, lifesteal: 8 },
    { id: 'time_fold', name: 'Divide By Nothing', cooldown: 50, desc: 'Stops the arena. Everything in it stays stopped until you are finished.' },
    { metal: PAL.white, accent: PAL.arcaneLit, glow: PAL.arcane, noDrop: true, effects: ['spiritcall', 'flowstate', 'soulbind'],
      desc: 'It was never a monster. It was the part of the sum that would not go away.' }),

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

  ART('art_tide_glass', 'Tideglass Lens', 'mat_crystal', 56, 'epic', 5200, { intelligence: 14, abilityPower: 18 },
    { id: 'ward', name: 'Undertow', cooldown: 34, desc: 'Water closes over you, absorbing a great deal of damage.' },
    { metal: '#6f9ab4', glow: PAL.foam }),
  ART('art_storm_ring', 'The Open Sky', 'ring', 64, 'epic', 6400, { critChance: 8, moveSpeed: 6 },
    { id: 'fire_nova', name: 'Ground Strike', cooldown: 28, desc: 'Calls the weather down in a ring around you.' },
    { metal: '#9a8fe8', glow: '#e0dcff' }),
  ART('art_ember_heart', 'A Piece of the Floor', 'amulet', 72, 'legendary', 9800, { strength: 16, maxHealth: 260, defense: 12 },
    { id: 'frenzy', name: 'Draw Breath', cooldown: 42, desc: 'You burn from the inside for ten seconds, and everything you touch does too.' },
    { metal: '#330d08', glow: PAL.flameLit }),
];

/* ------------------------------------------------------------------ */
/* Uniques                                                             */
/* ------------------------------------------------------------------ */

/**
 * What a named relic is worth over a generated weapon of its level and
 * rarity. The whole premium, and deliberately small: a relic wins on its
 * effects, its fixed enchantments and its signature move, not on a damage
 * number nothing else in the game is allowed to have.
 */
export const RELIC_PREMIUM = 1.12;

/**
 * The named relics.
 *
 * Their damage numbers are written out below so the table reads honestly, but
 * they are NOT authoritative — `priceRelics()` at the bottom of this file
 * solves each one from the shared curve on load, exactly as `W()` does for
 * every generated weapon. They were the only weapons that could drift, and
 * they twice had: first to between 1.5x and 2.5x their own curve, and then
 * again the moment the curve was retuned underneath them. Now they cannot.
 */
export const UNIQUES: ItemTemplate[] = [
  {
    id: 'unique_flamebound', name: 'Flamebound Sword', type: 'weapon', slot: 'mainHand', icon: 'sword', weaponKind: 'sword',
    metal: PAL.flame, glow: PAL.ember, rarity: 'legendary', level: 8, value: 1500,
    stats: { damage: 24, attackSpeed: 1.32, range: 52, strength: 8, critChance: 6 },
    effects: ['burning_edge', 'emberburst'], fixedEnchants: [{ id: 'fire_aspect', level: 2 }], noReroll: true, noDrop: true,
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
    stats: { damage: 33, attackSpeed: 1.05, range: 505, intelligence: 12, abilityPower: 22 },
    effects: ['venomous', 'spiritcall'], fixedEnchants: [{ id: 'ember_focus', level: 2 }], noReroll: true, noDrop: true,
    desc: 'Cut from a tree that was old when the valley was young. It has not forgiven you.',
  },
  {
    id: 'unique_stormcall', name: 'Stormcaller Bow', type: 'weapon', slot: 'mainHand', icon: 'bow', weaponKind: 'bow',
    metal: '#8fd0f0', glow: '#8fd0f0', rarity: 'legendary', level: 12, value: 2000,
    stats: { damage: 23, attackSpeed: 1.28, range: 607, dexterity: 10, critChance: 10 },
    effects: ['stormcaller', 'echo'], fixedEnchants: [{ id: 'multishot', level: 2 }], noReroll: true, noDrop: true,
    desc: 'Drawn once at the top of the Ashen Spire. The storm has followed it since.',
  },
  {
    id: 'unique_sandtyrant', name: 'Fang of the Sand Tyrant', type: 'weapon', slot: 'mainHand', icon: 'dagger', weaponKind: 'dagger',
    metal: PAL.toxic, glow: PAL.toxic, rarity: 'legendary', level: 11, value: 1850,
    stats: { damage: 19, attackSpeed: 2.15, range: 38, dexterity: 9, critChance: 16, critDamage: 30 },
    effects: ['venomous', 'swiftstep'], fixedEnchants: [{ id: 'venomous', level: 3 }], noReroll: true, noDrop: true,
    desc: 'Still dripping. It will not stop.',
  },
  /* --- the two northern relics, only found in the Crag Reach --- */
  {
    id: 'unique_leviathan', name: 'Leviathan Axe', type: 'weapon', slot: 'mainHand', icon: 'axe', weaponKind: 'axe',
    metal: '#bcd8e8', accent: PAL.frost, glow: PAL.frost, rarity: 'mythic', level: 15, value: 6400,
    stats: { damage: 54, attackSpeed: 1.0, range: 58, strength: 14, critDamage: 30 },
    effects: ['frostbite', 'earthshaker'], fixedEnchants: [{ id: 'freezing', level: 3 }, { id: 'committed', level: 2 }], noReroll: true,
    weaponPower: {
      id: 'leviathan_throw', name: 'Return',
      cooldown: 14,
      desc: 'Throw it. It freezes a line of everything it passes, sticks in the ground, and comes back to your hand through all of it again.',
    },
    noDrop: true, regions: ['north', 'deepnorth'],
    desc: 'Cold beyond cold, and it always comes back to the hand that threw it. The clans brought it to the Last Gate once. It came back; they did not.',
  },
  {
    id: 'unique_chaos_blades', name: 'Blades of Chaos', type: 'weapon', slot: 'mainHand', icon: 'claws', weaponKind: 'claws',
    metal: '#c8402f', accent: PAL.flameLit, glow: PAL.ember, rarity: 'mythic', level: 15, value: 6400,
    stats: { damage: 23, attackSpeed: 2.3, range: 96, strength: 9, dexterity: 9, critChance: 16 },
    effects: ['burning_edge', 'emberburst'], fixedEnchants: [{ id: 'fire_aspect', level: 3 }, { id: 'swirling', level: 2 }], noReroll: true,
    weaponPower: {
      id: 'chaos_chains', name: 'Chains of Chaos',
      cooldown: 15,
      desc: 'Whip the chains out in a burning circle, drag everything they catch to your feet, and set the ground on fire under all of it.',
    },
    noDrop: true, regions: ['north'],
    desc: 'Chained to the bone. They burn whoever holds them, and they do not care whose bone it is.',
  },

  /* --- the Jotunreach relics --- */
  {
    id: 'unique_jotunbane', name: "Jotunbane, the Gravecutter", type: 'weapon', slot: 'mainHand', icon: 'greataxe', weaponKind: 'greataxe',
    metal: '#bcd8e8', accent: PAL.white, glow: PAL.frost, rarity: 'legendary', level: 27, value: 7800,
    stats: { damage: 113, attackSpeed: 0.66, range: 68, strength: 20, critDamage: 45, maxHealth: 120 },
    effects: ['frostbite', 'earthshaker'], fixedEnchants: [{ id: 'freezing', level: 3 }, { id: 'swirling', level: 2 }], noReroll: true,
    noDrop: true, regions: ['deepnorth'],
    desc: 'The barrow-jotun buried it with himself, which tells you what he thought of it.',
  },
  {
    id: 'unique_whitecrown', name: 'Whitecrown', type: 'weapon', slot: 'mainHand', icon: 'staff', weaponKind: 'staff',
    metal: PAL.white, accent: PAL.ice, glow: PAL.frost, rarity: 'legendary', level: 29, value: 8400,
    stats: { damage: 67, attackSpeed: 1, range: 560, intelligence: 22, abilityPower: 44, maxMana: 150, cooldownReduction: 12 },
    effects: ['frostbite', 'spiritcall'], fixedEnchants: [{ id: 'frost_focus', level: 3 }, { id: 'ember_focus', level: 2 }], noReroll: true,
    noDrop: true, regions: ['deepnorth'],
    desc: 'Cut from the ceiling of a cathedral that sings when the wind is wrong.',
  },
  {
    id: 'unique_winters_edge', name: "Winter's Edge", type: 'weapon', slot: 'mainHand', icon: 'greatsword', weaponKind: 'greatsword',
    metal: '#e6f4fb', accent: PAL.white, glow: PAL.frost, rarity: 'legendary', level: 34, value: 12000,
    stats: { damage: 127, attackSpeed: 0.72, range: 74, strength: 26, critChance: 12, critDamage: 60, lifesteal: 6 },
    effects: ['frostbite', 'earthshaker', 'flowstate'],
    fixedEnchants: [{ id: 'freezing', level: 3 }, { id: 'swirling', level: 3 }, { id: 'committed', level: 2 }], noReroll: true,
    noDrop: true,
    desc: 'Aldrhrim did not carry a sword. This is the piece of him that was shaped like one.',
  },
  {
    id: 'unique_tusya', name: "Tusya's Answer", type: 'weapon', slot: 'mainHand', icon: 'rapier', weaponKind: 'rapier',
    metal: '#e8e0d4', accent: PAL.gold, glow: PAL.goldLit, rarity: 'mythic', level: 30, value: 11000,
    stats: { damage: 48, attackSpeed: 2.1, range: 50, dexterity: 22, strength: 10, critChance: 26, critDamage: 70, moveSpeed: 10 },
    effects: ['swiftstep', 'flowstate'],
    fixedEnchants: [{ id: 'critical_hit', level: 3 }, { id: 'piercing', level: 3 }, { id: 'committed', level: 3 }], noReroll: true,
    noDrop: true,
    desc: 'He fought with it for thirty years and never once drew it first. Won honestly, or not at all.',
  },
  {
    id: 'unique_remainder', name: 'One', type: 'weapon', slot: 'mainHand', icon: 'sword', weaponKind: 'sword',
    metal: PAL.white, accent: PAL.arcaneLit, glow: PAL.arcane, rarity: 'mythic', level: 40, value: 20000,
    stats: { damage: 95, attackSpeed: 1.3, range: 58, strength: 24, intelligence: 24, dexterity: 24, critChance: 20, critDamage: 90, lifesteal: 10 },
    effects: ['flowstate', 'spiritcall', 'earthshaker'],
    fixedEnchants: [{ id: 'sharpness', level: 3 }, { id: 'critical_hit', level: 3 }, { id: 'committed', level: 3 }], noReroll: true,
    noDrop: true,
    desc: 'The smallest thing that will not divide into anything else. It is very sharp about it.',
  },

  /* --- the three at the bottom of the deep marches --- */
  {
    id: 'unique_drowned_crown', name: 'The Crown She Waited In', type: 'weapon', slot: 'mainHand', icon: 'staff', weaponKind: 'staff',
    metal: '#38505a', accent: PAL.foam, glow: '#8fd0f0', rarity: 'legendary', level: 60, value: 16000,
    stats: { damage: 130, attackSpeed: 1.0, range: 540, intelligence: 30, abilityPower: 52, maxMana: 240, cooldownReduction: 14 },
    effects: ['frostbite', 'spiritcall'], fixedEnchants: [{ id: 'freezing', level: 3 }, { id: 'frost_focus', level: 3 }], noReroll: true,
    noDrop: true, regions: ['sunkenwest'],
    desc: 'She was told to wait for the water and she did. This is what she was holding.',
  },
  {
    id: 'unique_storm_throne', name: 'The Standing Rod', type: 'weapon', slot: 'mainHand', icon: 'spear', weaponKind: 'spear',
    metal: '#5a5480', accent: '#e0dcff', glow: '#b9b0ff', rarity: 'legendary', level: 67, value: 19000,
    stats: { damage: 132, attackSpeed: 1.45, range: 86, dexterity: 28, strength: 20, critChance: 14, critDamage: 48 },
    effects: ['stormcaller', 'echo'], fixedEnchants: [{ id: 'shockwave', level: 3 }, { id: 'swirling', level: 2 }], noReroll: true,
    noDrop: true, regions: ['stormeast'],
    desc: 'Driven into the flats to give the lightning somewhere to go. It has been going there a very long time.',
  },
  {
    id: 'unique_floor_of_world', name: 'Underfloor', type: 'weapon', slot: 'mainHand', icon: 'greataxe', weaponKind: 'greataxe',
    metal: '#330d08', accent: PAL.flameLit, glow: PAL.flame, rarity: 'mythic', level: 74, value: 32000,
    stats: { damage: 335, attackSpeed: 0.6, range: 82, strength: 38, critDamage: 70, maxHealth: 320, lifesteal: 7 },
    effects: ['burning_edge', 'earthshaker', 'flowstate'],
    fixedEnchants: [{ id: 'fire_aspect', level: 3 }, { id: 'swirling', level: 3 }, { id: 'committed', level: 2 }], noReroll: true,
    weaponPower: {
      id: 'underfloor_open', name: 'Open It',
      cooldown: 20,
      desc: 'Put it through the ground. The floor gives way in a long wedge ahead of you, and what is under the floor is still lit.',
    },
    noDrop: true,
    desc: 'It was never a weapon. It is a piece of the thing the Cinderwastes are lying on, and it is the right shape by accident.',
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
  { id: 'potion_health_xl', name: 'Jotunblood Draught', type: 'consumable', icon: 'potion_health', metal: PAL.frost, rarity: 'epic', level: 20, value: 320, stats: {}, stackable: true, consume: { healthPct: 0.8 }, desc: 'Restores 80% of maximum health.' },
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
  { id: 'mat_glacier_shard', name: 'Glacier Shard', type: 'material', icon: 'mat_crystal', metal: PAL.ice, rarity: 'epic', level: 20, value: 420, stats: {}, stackable: true, desc: 'It does not melt. It has been tried.' },
  { id: 'mat_jotun_ingot', name: 'Jotunsteel Ingot', type: 'material', icon: 'mat_ingot', metal: '#bcd8e8', rarity: 'epic', level: 26, value: 680, stats: {}, stackable: true },
  { id: 'mat_greater_rune', name: 'Greater Binding Rune', type: 'material', icon: 'rune', metal: PAL.frost, rarity: 'legendary', level: 28, value: 950, stats: {}, stackable: true, desc: 'Does what a binding rune does, to things a binding rune will not hold.' },

  /*
   * Trophies. These used to be typed `quest`, which meant they could not be
   * sold, could not be dropped, and were kept out of every bulk sell — and no
   * quest in the game ever asked for one. A wolf handing you a permanent,
   * unsellable pelt every other kill is not a reward, it is a slot you have
   * lost. They are materials now, which is what they always were.
   */
  { id: 'q_wolf_pelt', name: 'Thick Wolf Pelt', type: 'material', icon: 'mat_leather', rarity: 'common', level: 1, value: 20, stats: {}, stackable: true, desc: 'Proof of a culled pack.' },
  { id: 'q_bandit_orders', name: 'Cutter Marching Orders', type: 'material', icon: 'scroll', rarity: 'common', level: 8, value: 90, stats: {}, stackable: true, desc: 'Somebody in the south is being told where to burn next.' },
  { id: 'q_heartseed', name: 'Heartseed of the Grove', type: 'material', icon: 'mat_herb', rarity: 'superRare', level: 12, value: 340, stats: {}, stackable: true, desc: 'It pulses when you hold it still.' },
  { id: 'q_ice_core', name: 'Frozen Core', type: 'material', icon: 'mat_crystal', metal: PAL.frost, rarity: 'superRare', level: 12, value: 340, stats: {}, stackable: true, desc: 'Cut out of a warden that had stopped moving. It has not.' },
  { id: 'q_relic_shard', name: 'Shard of the Modulo', type: 'material', icon: 'mat_crystal', metal: PAL.frost, rarity: 'epic', level: 14, value: 520, stats: {}, stackable: true, desc: 'One of many. There are always more.' },
];

export const QUEST_ITEMS: ItemTemplate[] = [
  { id: 'q_supply_crate', name: 'Ashvale Supply Parcel', type: 'quest', icon: 'quest', rarity: 'common', level: 1, value: 0, stats: {}, noDrop: true, desc: 'Sealed with the Alliance stamp.' },
  { id: 'q_ledger', name: 'Guild Ledger Page', type: 'quest', icon: 'scroll', rarity: 'common', level: 1, value: 0, stats: {}, noDrop: true, desc: 'Numbers somebody would rather you did not read.' },
  { id: 'q_crypt_key', name: 'Crypt Seal Key', type: 'quest', icon: 'key', rarity: 'rare', level: 1, value: 0, stats: {}, noDrop: true, desc: 'Cold to the touch.' },
  { id: 'q_missing_ring', name: "Maren's Wedding Ring", type: 'quest', icon: 'ring', metal: PAL.gold, rarity: 'common', level: 1, value: 0, stats: {}, noDrop: true },
  { id: 'q_gate_sigil', name: 'Sigil of the Last Gate', type: 'quest', icon: 'rune', metal: PAL.frost, rarity: 'legendary', level: 1, value: 0, stats: {}, noDrop: true, desc: 'Warm, in a place where nothing is.' },
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

/**
 * Solve every relic's damage from the shared curve, so a hand-written weapon
 * cannot drift away from the generated ones when the curve is retuned. This
 * is the same arithmetic `W()` does, plus the relic premium, applied in place
 * on load. The numbers written in the table above are documentation.
 */
function priceRelics(): void {
  for (const u of UNIQUES) {
    if (!u.weaponKind || u.stats.damage === undefined) continue;
    const speed = u.stats.attackSpeed ?? 1;
    u.stats.damage = Math.max(1, Math.round(weaponDps(u.weaponKind, u.level, u.rarity) * RELIC_PREMIUM / speed));
  }
}
priceRelics();

/** Region-locked relics, rolled only by chests and elites in that region. */
export const REGION_RELICS = UNIQUES.filter((t) => t.regions?.length);
