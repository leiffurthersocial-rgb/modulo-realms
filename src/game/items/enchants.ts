import type { WeaponKind } from '../art/weaponart';
import { PAL } from '../art/palette';
import { RARITY_ORDER, type Item, type Rarity, type Stats } from './types';

/**
 * Enchantments are rolled onto gear and stack with everything else. Each one
 * declares which kinds of gear can host it, an exclusivity group (so a blade
 * can be Fire Aspect *or* Freezing, never both), and a rarity gate so the good
 * ones only show up on good drops.
 */
export type EnchantHost = 'melee' | 'ranged' | 'magic' | 'armor' | 'artifact';

export interface EnchantDef {
  id: string;
  name: string;
  /** Short line shown in tooltips; {v} is replaced with the level's value. */
  desc: string;
  host: EnchantHost[];
  /** Narrower restriction than `host` when a specific weapon is required. */
  weapons?: WeaponKind[];
  /** Only one enchantment from a group may sit on the same item. */
  group?: string;
  maxLevel: number;
  /** Minimum item rarity that can roll this enchantment. */
  minRarity: Rarity;
  weight: number;
  color: string;
  /** Value per level (index 0 = level 1). */
  power: number[];
  /** Flat stat contribution per level, applied in the player's stat block. */
  stat?: { key: keyof Stats; per: number };
}

export const ENCHANTS: EnchantDef[] = [
  /* ----- melee weapons ----- */
  { id: 'sharpness', name: 'Sharpness', desc: '+{v}% weapon damage.', host: ['melee'], maxLevel: 3, minRarity: 'common', weight: 14, color: PAL.steel, power: [12, 22, 34] },
  { id: 'fire_aspect', name: 'Fire Aspect', desc: '{v}% chance to set the target burning.', host: ['melee', 'ranged'], group: 'element', maxLevel: 3, minRarity: 'rare', weight: 11, color: PAL.flame, power: [18, 28, 40] },
  { id: 'freezing', name: 'Freezing', desc: '{v}% chance to chill the target, slowing it heavily.', host: ['melee', 'ranged'], group: 'element', maxLevel: 3, minRarity: 'rare', weight: 11, color: PAL.frost, power: [20, 32, 45] },
  { id: 'venomous', name: 'Venomous', desc: '{v}% chance to poison the target.', host: ['melee', 'ranged'], group: 'element', maxLevel: 3, minRarity: 'rare', weight: 10, color: PAL.toxic, power: [20, 32, 45] },
  { id: 'leeching', name: 'Leeching', desc: 'Killing an enemy restores {v}% of your health.', host: ['melee'], maxLevel: 3, minRarity: 'superRare', weight: 8, color: PAL.blood, power: [4, 7, 10] },
  { id: 'critical_hit', name: 'Critical Hit', desc: '+{v}% critical strike chance.', host: ['melee', 'ranged'], maxLevel: 3, minRarity: 'rare', weight: 10, color: PAL.goldLit, power: [5, 9, 14], stat: { key: 'critChance', per: 5 } },
  { id: 'swirling', name: 'Swirling', desc: 'Your swings reach {v}% further and hit a wider arc.', host: ['melee'], maxLevel: 3, minRarity: 'superRare', weight: 7, color: PAL.cloth, power: [15, 25, 38] },
  { id: 'shockwave', name: 'Shockwave', desc: '{v}% chance to send out a stunning shockwave.', host: ['melee'], weapons: ['hammer', 'greataxe', 'greatsword', 'mace'], maxLevel: 3, minRarity: 'epic', weight: 6, color: PAL.clay, power: [15, 25, 35] },
  { id: 'chains', name: 'Chains', desc: '{v}% chance to root everything around the target.', host: ['melee'], maxLevel: 2, minRarity: 'epic', weight: 5, color: PAL.iron, power: [14, 24] },
  { id: 'committed', name: 'Committed', desc: 'Deal {v}% more damage to enemies below half health.', host: ['melee'], maxLevel: 3, minRarity: 'superRare', weight: 7, color: PAL.ember, power: [20, 35, 50] },

  /* ----- ranged weapons ----- */
  { id: 'multishot', name: 'Multishot', desc: '{v}% chance to fire three projectiles at once.', host: ['ranged'], group: 'shot', maxLevel: 3, minRarity: 'rare', weight: 10, color: PAL.grassPale, power: [20, 32, 46] },
  { id: 'piercing', name: 'Piercing', desc: 'Projectiles pass through {v} extra enemies.', host: ['ranged'], group: 'shot', maxLevel: 3, minRarity: 'rare', weight: 10, color: PAL.bone, power: [1, 2, 3] },
  { id: 'chain_reaction', name: 'Chain Reaction', desc: '{v}% chance for hits to burst outward.', host: ['ranged'], group: 'shot', maxLevel: 3, minRarity: 'epic', weight: 6, color: PAL.flameLit, power: [18, 28, 40] },
  { id: 'power', name: 'Power', desc: '+{v}% projectile damage.', host: ['ranged'], maxLevel: 3, minRarity: 'common', weight: 13, color: PAL.wood, power: [14, 25, 38] },
  { id: 'growing', name: 'Growing', desc: 'Shots gain up to {v}% damage the further they travel.', host: ['ranged'], maxLevel: 3, minRarity: 'superRare', weight: 7, color: PAL.leafLit, power: [20, 35, 50] },

  /* ----- magic weapons ----- */
  { id: 'arcane_surge', name: 'Arcane Surge', desc: '+{v}% ability power.', host: ['magic'], maxLevel: 3, minRarity: 'common', weight: 12, color: PAL.arcaneLit, power: [8, 15, 24], stat: { key: 'abilityPower', per: 8 } },
  { id: 'soul_siphon', name: 'Soul Siphon', desc: '+{v}% life steal.', host: ['magic'], maxLevel: 3, minRarity: 'superRare', weight: 8, color: PAL.blood, power: [3, 5, 8], stat: { key: 'lifesteal', per: 3 } },
  { id: 'ember_focus', name: 'Ember Focus', desc: 'Spells burn for an extra {v}% over time.', host: ['magic'], group: 'element', maxLevel: 3, minRarity: 'rare', weight: 9, color: PAL.flame, power: [20, 34, 50] },
  { id: 'frost_focus', name: 'Frost Focus', desc: 'Spells chill their target for {v}% longer.', host: ['magic'], group: 'element', maxLevel: 3, minRarity: 'rare', weight: 9, color: PAL.frost, power: [25, 45, 70] },
  { id: 'void_strike', name: 'Void Strike', desc: 'Every fifth cast deals {v}% extra damage.', host: ['magic'], maxLevel: 3, minRarity: 'epic', weight: 6, color: PAL.arcaneDark, power: [40, 70, 110] },

  /* ----- armour ----- */
  { id: 'protection', name: 'Protection', desc: '+{v}% armour.', host: ['armor'], maxLevel: 3, minRarity: 'common', weight: 14, color: PAL.iron, power: [12, 22, 34] },
  { id: 'life_boost', name: 'Life Boost', desc: '+{v} maximum health.', host: ['armor'], maxLevel: 3, minRarity: 'common', weight: 12, color: PAL.blood, power: [25, 50, 85], stat: { key: 'maxHealth', per: 25 } },
  { id: 'thorns', name: 'Thorns', desc: 'Reflects {v}% of melee damage back at the attacker.', host: ['armor'], maxLevel: 3, minRarity: 'rare', weight: 9, color: PAL.rot, power: [15, 25, 38] },
  { id: 'swiftfooted', name: 'Swiftfooted', desc: '+{v}% movement speed after a kill.', host: ['armor'], maxLevel: 3, minRarity: 'rare', weight: 9, color: PAL.grassPale, power: [12, 20, 30] },
  { id: 'cooling', name: 'Cooling', desc: '-{v}% ability cooldowns.', host: ['armor', 'artifact'], maxLevel: 3, minRarity: 'superRare', weight: 8, color: PAL.frost, power: [8, 14, 20], stat: { key: 'cooldownReduction', per: 8 } },
  { id: 'deflect', name: 'Deflect', desc: '{v}% chance to dodge an attack entirely.', host: ['armor'], maxLevel: 3, minRarity: 'epic', weight: 6, color: PAL.foam, power: [8, 13, 18] },
  { id: 'final_shout', name: 'Final Shout', desc: 'Below a quarter health, gain {v}% damage reduction.', host: ['armor'], maxLevel: 2, minRarity: 'epic', weight: 5, color: PAL.holy, power: [25, 40] },

  /* ----- shared / artifact ----- */
  { id: 'looting', name: 'Looting', desc: 'Enemies drop {v}% more gold and loot.', host: ['melee', 'ranged', 'magic', 'armor', 'artifact'], maxLevel: 3, minRarity: 'rare', weight: 8, color: PAL.gold, power: [20, 35, 55], stat: { key: 'magicFind', per: 8 } },
  { id: 'potency', name: 'Potency', desc: 'Artifact effects are {v}% stronger.', host: ['artifact'], maxLevel: 3, minRarity: 'rare', weight: 10, color: PAL.arcaneLit, power: [20, 35, 55] },
  { id: 'refreshment', name: 'Refreshment', desc: 'Restores {v} mana on a kill.', host: ['artifact', 'magic'], maxLevel: 3, minRarity: 'rare', weight: 8, color: PAL.water, power: [6, 11, 18] },
];

export const ENCHANT_BY_ID: Record<string, EnchantDef> = Object.fromEntries(ENCHANTS.map((e) => [e.id, e]));

export function enchantDescription(def: EnchantDef, level: number): string {
  const v = def.power[Math.max(0, Math.min(def.power.length - 1, level - 1))];
  return def.desc.replace('{v}', String(v));
}

export function enchantValue(id: string, level: number): number {
  const def = ENCHANT_BY_ID[id];
  if (!def || level <= 0) return 0;
  return def.power[Math.max(0, Math.min(def.power.length - 1, level - 1))];
}

/** Which enchantment pool an item draws from. */
export function hostFor(item: Pick<Item, 'type' | 'weaponKind'>): EnchantHost | null {
  if (item.type === 'armor') return 'armor';
  if (item.type === 'accessory') return 'artifact';
  if (item.type !== 'weapon') return null;
  const k = item.weaponKind;
  if (k === 'bow' || k === 'crossbow') return 'ranged';
  if (k === 'staff' || k === 'wand' || k === 'tome' || k === 'scythe') return 'magic';
  return 'melee';
}

/** Enchantments that could legally be rolled onto this item right now. */
export function candidateEnchants(item: Pick<Item, 'type' | 'weaponKind' | 'rarity' | 'enchants'>): EnchantDef[] {
  const host = hostFor(item);
  if (!host) return [];
  const rarityIdx = RARITY_ORDER.indexOf(item.rarity);
  const takenGroups = new Set(
    item.enchants.map((e) => ENCHANT_BY_ID[e.id]?.group).filter((g): g is string => !!g),
  );
  const takenIds = new Set(item.enchants.map((e) => e.id));
  return ENCHANTS.filter((e) => {
    if (!e.host.includes(host)) return false;
    if (e.weapons && (!item.weaponKind || !e.weapons.includes(item.weaponKind))) return false;
    if (RARITY_ORDER.indexOf(e.minRarity) > rarityIdx) return false;
    if (takenIds.has(e.id)) return false;
    if (e.group && takenGroups.has(e.group)) return false;
    return true;
  });
}

/** Total level of an enchantment across a set of items. */
export function totalEnchantLevel(items: Array<Item | null>, id: string): number {
  let lv = 0;
  for (const it of items) {
    if (!it) continue;
    for (const e of it.enchants) if (e.id === id) lv += e.level;
  }
  return lv;
}

/** Combined value of an enchantment across the given items (already summed by level). */
export function totalEnchantValue(items: Array<Item | null>, id: string): number {
  return enchantValue(id, totalEnchantLevel(items, id));
}
