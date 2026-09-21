import type { IconKind } from '../art/icons';
import type { WeaponKind } from '../art/weaponart';
import type { ClassId } from '../../data/classes';

/**
 * Five tiers, colour-coded so rarity is readable at a glance:
 * white, green, blue, purple, gold.
 */
/**
 * `mythic` sits above legendary and is not a tier loot can roll: there is no
 * weight for it in the drop tables and the crown's warrant will not raise
 * anything into it. It exists so that the handful of named relics that are
 * genuinely one-of-a-kind do not sit in the same colour as a legendary that
 * fell out of a chest.
 */
export type Rarity = 'common' | 'rare' | 'superRare' | 'epic' | 'legendary' | 'mythic' | 'olympian' | 'primordial';

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'superRare', 'epic', 'legendary', 'mythic', 'olympian', 'primordial'];

/** The tiers a random drop can actually be. Mythic is placed by hand only. */
export const ROLLABLE_RARITIES: Rarity[] = ['common', 'rare', 'superRare', 'epic', 'legendary'];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#ded6c8',
  rare: '#5dbf5a',
  superRare: '#4f9ce8',
  epic: '#a978e8',
  legendary: '#f0c93c',
  // A hot crimson that no other tier is anywhere near, so a mythic reads as
  // itself at a glance — on the ground, in the pack and in the toast.
  mythic: '#ff4f6e',
  olympian: '#efe0a3',
  primordial: '#b9dcff',
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  superRare: 'Super Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
  olympian: 'Olympian',
  primordial: 'Primordial',
};

export const RARITY_MULT: Record<Rarity, number> = {
  common: 1, rare: 1.26, superRare: 1.58, epic: 1.95, legendary: 2.5, mythic: 2.9, olympian: 3.2, primordial: 5.6,
};

/** Number of random stat affixes rolled onto an item of each rarity. */
export const RARITY_AFFIXES: Record<Rarity, number> = {
  common: 0, rare: 1, superRare: 2, epic: 3, legendary: 4, mythic: 4, olympian: 4, primordial: 6,
};

/** How many enchantment slots an item of each rarity carries. */
export const RARITY_ENCHANT_SLOTS: Record<Rarity, number> = {
  common: 0, rare: 1, superRare: 1, epic: 2, legendary: 3, mythic: 3, olympian: 4, primordial: 6,
};

/** Four slots only: one armour piece, a weapon, an off-hand and an artifact. */
export type EquipSlot = 'mainHand' | 'offHand' | 'armor' | 'accessory';

export const EQUIP_SLOT_ORDER: EquipSlot[] = ['mainHand', 'offHand', 'armor', 'accessory'];

export const SLOT_LABEL: Record<EquipSlot, string> = {
  mainHand: 'Weapon',
  offHand: 'Off Hand',
  armor: 'Armour',
  accessory: 'Artifact',
};

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'material' | 'quest' | 'misc';

export interface Stats {
  damage?: number;
  attackSpeed?: number;
  range?: number;
  defense?: number;
  maxHealth?: number;
  maxMana?: number;
  maxStamina?: number;
  strength?: number;
  dexterity?: number;
  intelligence?: number;
  vitality?: number;
  critChance?: number;
  critDamage?: number;
  moveSpeed?: number;
  abilityPower?: number;
  lifesteal?: number;
  cooldownReduction?: number;
  magicFind?: number;
  manaRegen?: number;
  staminaRegen?: number;
}

export type StatKey = keyof Stats;

export const STAT_LABEL: Record<StatKey, string> = {
  damage: 'Damage', attackSpeed: 'Attack Speed', range: 'Range', defense: 'Armour',
  maxHealth: 'Health', maxMana: 'Mana', maxStamina: 'Stamina',
  strength: 'Strength', dexterity: 'Dexterity', intelligence: 'Intelligence', vitality: 'Vitality',
  critChance: 'Crit Chance', critDamage: 'Crit Damage', moveSpeed: 'Move Speed', abilityPower: 'Ability Power',
  lifesteal: 'Life Steal', cooldownReduction: 'Cooldown Reduction', magicFind: 'Magic Find',
  manaRegen: 'Mana Regen', staminaRegen: 'Stamina Regen',
};

export const PERCENT_STATS = new Set<StatKey>([
  'critChance', 'critDamage', 'lifesteal', 'cooldownReduction', 'magicFind', 'abilityPower', 'attackSpeed',
]);

export interface ConsumeEffect {
  health?: number;
  mana?: number;
  stamina?: number;
  healthPct?: number;
  buff?: { stat: StatKey; amount: number; duration: number; name: string };
  cure?: boolean;
  /** Shared recovery clock; the runtime refuses use while this group is cooling down. */
  cooldownGroup?: 'recovery';
  cooldown?: number;
  resistance?: { status: 'poison' | 'curse' | 'fear'; multiplier: number; duration: number };
}

export interface ItemProvenance {
  source: 'reward' | 'craft' | 'debug';
  /** Permanent encounter or recipe ID; never inferred from a display name. */
  id: string;
  region?: string;
}

export interface ItemAffixRoll {
  name: string;
  stat: StatKey;
  flat: number;
  perLevel: number;
  roll: number;
}

export interface ItemCurveState {
  version: 2;
  affixes: ItemAffixRoll[];
  /** Legacy rolls lacking their original random seed are retained as bounded flat bonuses. */
  legacyBonuses?: Stats;
  legacyAtLevel?: number;
  reforges: number;
}

/** An enchantment rolled onto an item, with its level. */
export interface RolledEnchant {
  id: string;
  level: number;
}

/** Look overrides an armour piece applies to the player sprite. */
export interface ArmorLook {
  style: 'light' | 'heavy' | 'robe';
  helmet: 'none' | 'cap' | 'hood' | 'horned' | 'full' | 'crown' | 'circlet' | 'wizard';
  color: string;
  trim?: string;
  cape?: string | null;
}

/** A concrete item instance. Fully self-describing so saving is a plain JSON dump. */
export interface Item {
  uid: string;
  defId: string;
  name: string;
  type: ItemType;
  slot?: EquipSlot;
  icon: IconKind;
  iconMetal?: string;
  iconAccent?: string;
  glow?: string;
  rarity: Rarity;
  level: number;
  value: number;
  stats: Stats;
  /** Permanent, item-defining powers (unique gear). */
  effects: string[];
  /** Rolled enchantments — see game/items/enchants.ts. */
  enchants: RolledEnchant[];
  /** How many enchantment slots this item has in total. */
  enchantSlots: number;
  weaponKind?: WeaponKind;
  armorLook?: ArmorLook;
  classes?: ClassId[];
  desc?: string;
  qty: number;
  stackable: boolean;
  consume?: ConsumeEffect;
  questId?: string;
  /**
   * Set on relics whose enchantments were written by hand: the forge will not
   * rebind their runes. Rerolling them would replace a chosen set with a
   * random one and there is no way back, so the option is refused rather
   * than offered.
   */
  noReroll?: boolean;
  provenance?: ItemProvenance;
  /** Separate roll data prevents a forge operation from multiplying the entire snapshot. */
  curve?: ItemCurveState;
  /** Typed behaviour is registered in AEGEAN_POWERS; this ID is not descriptive text. */
  aegeanPower?: string;
  /** Artifacts have an activated power used from the off-hand/artifact key. */
  artifact?: { id: string; name: string; cooldown: number; desc: string };
  /**
   * A signature move that belongs to the weapon rather than to the class,
   * used with its own key. Only a handful of named relics carry one — it is
   * the difference between "a very good axe" and "the axe".
   */
  weaponPower?: { id: string; name: string; cooldown: number; desc: string };
  /**
   * Marked by the player as something to keep. Bulk sells skip it, and it has
   * its own tab in the pack. Nothing sets this automatically — the whole point
   * is that it means "I decided", not "the game guessed".
   */
  important?: boolean;
}

export const isEquippable = (i: Item): boolean => i.type === 'weapon' || i.type === 'armor' || i.type === 'accessory';

export function statLine(key: StatKey, value: number): string {
  const label = STAT_LABEL[key];
  const pct = PERCENT_STATS.has(key);
  const sign = value >= 0 ? '+' : '';
  if (key === 'attackSpeed' || key === 'range') return `${label}: ${value.toFixed(2)}`;
  if (key === 'damage' || key === 'defense') return `${label}: ${Math.round(value)}`;
  return `${sign}${pct ? value.toFixed(0) + '%' : Math.round(value)} ${label}`;
}
