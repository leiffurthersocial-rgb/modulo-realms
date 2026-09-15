import { RNG } from '../core/rng';
import { DROPPABLE, REGION_RELICS, TEMPLATE_BY_ID, type ItemTemplate } from '../../data/items';
import { candidateEnchants } from './enchants';
import { EFFECTS } from './effects';
import {
  RARITY_AFFIXES, RARITY_ENCHANT_SLOTS, RARITY_MULT, RARITY_ORDER,
  type Item, type Rarity, type RolledEnchant, type StatKey,
} from './types';

let uidCounter = 0;
export function newUid(): string {
  uidCounter = (uidCounter + 1) % 1e9;
  return `i${Date.now().toString(36)}${uidCounter.toString(36)}`;
}

interface Affix {
  name: string;
  suffix?: boolean;
  stat: StatKey;
  perLevel: number;
  flat: number;
  weight: number;
}

const PREFIXES: Affix[] = [
  { name: 'Keen', stat: 'critChance', perLevel: 0.22, flat: 2, weight: 10 },
  { name: 'Brutal', stat: 'critDamage', perLevel: 0.9, flat: 6, weight: 9 },
  { name: 'Savage', stat: 'strength', perLevel: 0.3, flat: 1, weight: 10 },
  { name: 'Nimble', stat: 'dexterity', perLevel: 0.3, flat: 1, weight: 10 },
  { name: 'Studious', stat: 'intelligence', perLevel: 0.3, flat: 1, weight: 10 },
  { name: 'Hale', stat: 'vitality', perLevel: 0.28, flat: 1, weight: 9 },
  { name: 'Quickened', stat: 'attackSpeed', perLevel: 0.25, flat: 3, weight: 7 },
  { name: 'Focused', stat: 'abilityPower', perLevel: 0.5, flat: 4, weight: 8 },
  { name: 'Fleet', stat: 'moveSpeed', perLevel: 0.2, flat: 2, weight: 7 },
  { name: 'Leeching', stat: 'lifesteal', perLevel: 0.1, flat: 1, weight: 5 },
  { name: 'Flowing', stat: 'cooldownReduction', perLevel: 0.22, flat: 2, weight: 5 },
  { name: 'Grim', stat: 'magicFind', perLevel: 0.4, flat: 3, weight: 5 },
];

const SUFFIXES: Affix[] = [
  { name: 'of the Bear', suffix: true, stat: 'maxHealth', perLevel: 3.2, flat: 8, weight: 12 },
  { name: 'of the Mountain', suffix: true, stat: 'defense', perLevel: 0.6, flat: 2, weight: 11 },
  { name: 'of the Tide', suffix: true, stat: 'maxMana', perLevel: 2.6, flat: 8, weight: 9 },
  { name: 'of the Gale', suffix: true, stat: 'maxStamina', perLevel: 2.4, flat: 8, weight: 8 },
  { name: 'of Embers', suffix: true, stat: 'abilityPower', perLevel: 0.45, flat: 3, weight: 8 },
  { name: 'of the Fox', suffix: true, stat: 'dexterity', perLevel: 0.3, flat: 1, weight: 9 },
  { name: 'of the Ox', suffix: true, stat: 'strength', perLevel: 0.3, flat: 1, weight: 9 },
  { name: 'of the Owl', suffix: true, stat: 'intelligence', perLevel: 0.3, flat: 1, weight: 9 },
  { name: 'of Renewal', suffix: true, stat: 'manaRegen', perLevel: 0.12, flat: 1, weight: 5 },
  { name: 'of Endurance', suffix: true, stat: 'staminaRegen', perLevel: 0.12, flat: 1, weight: 5 },
  { name: 'of the Hunt', suffix: true, stat: 'critChance', perLevel: 0.2, flat: 2, weight: 6 },
];

const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 100, rare: 42, superRare: 15, epic: 4.6, legendary: 0.9,
};

export function rollRarity(rng: RNG, magicFind = 0, luckBias = 0): Rarity {
  const bonus = 1 + magicFind / 100 + luckBias;
  const weights = RARITY_ORDER.map((r, i) => RARITY_WEIGHTS[r] * (i === 0 ? 1 : Math.pow(bonus, i * 0.9)));
  return rng.weighted(RARITY_ORDER, weights);
}

function scaleStats(template: ItemTemplate, level: number, rarity: Rarity): Item['stats'] {
  const mult = RARITY_MULT[rarity];
  const lvlScale = 1 + Math.max(0, level - template.level) * 0.13;
  const out: Item['stats'] = {};
  for (const [k, v] of Object.entries(template.stats) as Array<[StatKey, number]>) {
    if (v === undefined) continue;
    if (k === 'attackSpeed' || k === 'range') {
      out[k] = v;
    } else if (k === 'damage' || k === 'defense' || k === 'maxHealth' || k === 'maxMana' || k === 'maxStamina') {
      out[k] = Math.max(1, Math.round(v * lvlScale * mult));
    } else {
      out[k] = Math.round(v * Math.min(2.2, lvlScale) * mult * 10) / 10;
    }
  }
  return out;
}

function addStat(stats: Item['stats'], key: StatKey, value: number) {
  const rounded = key === 'attackSpeed' || key === 'range' ? value : Math.round(value * 10) / 10;
  stats[key] = Math.round(((stats[key] ?? 0) + rounded) * 10) / 10;
}

/** Fill an item's enchantment slots, honouring group exclusivity and rarity gates. */
export function rollEnchants(item: Item, rng: RNG): void {
  let guard = 0;
  while (item.enchants.length < item.enchantSlots && guard++ < 12) {
    const pool = candidateEnchants(item);
    if (!pool.length) break;
    const def = rng.weighted(pool, pool.map((e) => e.weight));
    // higher rarity items roll higher enchantment levels
    const rarityIdx = RARITY_ORDER.indexOf(item.rarity);
    const maxLevel = Math.min(def.maxLevel, 1 + Math.floor(rarityIdx / 2) + (rng.bool(0.25) ? 1 : 0));
    item.enchants.push({ id: def.id, level: Math.max(1, Math.min(def.maxLevel, maxLevel)) });
  }
}

export interface MakeItemOpts {
  level?: number;
  rarity?: Rarity;
  rng?: RNG;
  qty?: number;
  /** Skip random affixes and enchantment rolls (shop stock, quest rewards). */
  plain?: boolean;
}

export function makeItem(templateId: string, opts: MakeItemOpts = {}): Item {
  const t = TEMPLATE_BY_ID[templateId];
  if (!t) throw new Error(`Unknown item template: ${templateId}`);
  const rng = opts.rng ?? new RNG(Math.floor(Math.random() * 1e9));
  const level = Math.max(1, Math.round(opts.level ?? t.level));
  let rarity = opts.rarity ?? t.rarity;
  if (RARITY_ORDER.indexOf(t.rarity) > RARITY_ORDER.indexOf(rarity)) rarity = t.rarity;

  const stats = scaleStats(t, level, rarity);
  const effects = [...(t.effects ?? [])];
  let name = t.name;

  const isGear = t.type === 'weapon' || t.type === 'armor' || t.type === 'accessory';
  if (isGear && !opts.plain) {
    const affixCount = RARITY_AFFIXES[rarity];
    const used = new Set<string>();
    let prefixName: string | null = null;
    let suffixName: string | null = null;
    for (let i = 0; i < affixCount; i++) {
      const pool = i % 2 === 0 ? PREFIXES : SUFFIXES;
      const candidates = pool.filter((a) => !used.has(a.name));
      if (!candidates.length) continue;
      const a = rng.weighted(candidates, candidates.map((c) => c.weight));
      used.add(a.name);
      addStat(stats, a.stat, a.flat + a.perLevel * level * rng.range(0.75, 1.25));
      if (a.suffix && !suffixName) suffixName = a.name;
      else if (!a.suffix && !prefixName) prefixName = a.name;
    }
    if (prefixName) name = `${prefixName} ${name}`;
    if (suffixName) name = `${name} ${suffixName}`;

    const effectChance = { common: 0, rare: 0.1, superRare: 0.4, epic: 0.75, legendary: 1 }[rarity];
    if (rng.bool(effectChance)) {
      const pool = EFFECTS.filter((e) => e.minLevel <= level + 2 && !effects.includes(e.id));
      if (pool.length) effects.push(rng.pick(pool).id);
    }
  }

  const enchants: RolledEnchant[] = (t.fixedEnchants ?? []).map((e) => ({ ...e }));
  const slotBonus = t.fixedEnchants?.length ?? 0;
  const enchantSlots = Math.max(RARITY_ENCHANT_SLOTS[rarity], slotBonus);
  const value = Math.max(1, Math.round(t.value * RARITY_MULT[rarity] * (1 + (level - t.level) * 0.1)));

  const item: Item = {
    uid: newUid(),
    defId: t.id,
    name,
    type: t.type,
    slot: t.slot,
    icon: t.icon,
    iconMetal: t.metal,
    iconAccent: t.accent,
    glow: t.glow ?? (rarity === 'legendary' ? '#f0c93c' : undefined),
    rarity,
    level,
    value,
    stats,
    effects,
    enchants,
    enchantSlots,
    weaponKind: t.weaponKind,
    armorLook: t.armorLook,
    classes: t.classes,
    desc: t.desc,
    qty: opts.qty ?? 1,
    stackable: !!t.stackable,
    consume: t.consume,
    artifact: t.artifact,
  };

  if (isGear && !opts.plain) rollEnchants(item, rng);
  return item;
}

/**
 * Roll a random piece of gear for the given level. Region-locked relics can
 * only appear from a roll made inside their own region.
 */
export function rollLoot(level: number, rng: RNG, magicFind = 0, luckBias = 0, region?: string): Item {
  const rarity = rollRarity(rng, magicFind, luckBias);

  if (rarity === 'legendary' && region) {
    const relics = REGION_RELICS.filter((t) => t.regions!.includes(region as 'north') && level >= t.level - 3);
    if (relics.length && rng.bool(0.3)) {
      return makeItem(rng.pick(relics).id, { level: Math.max(level, relics[0].level), rarity: 'legendary', rng });
    }
  }

  const window = 4 + Math.floor(level / 3);
  const pool = DROPPABLE.filter((t) => t.level <= level + 2 && t.level >= level - window);
  const fallback = DROPPABLE.filter((t) => t.level <= level + 2);
  const chosen = pool.length ? rng.pick(pool) : (fallback.length ? rng.pick(fallback) : DROPPABLE[0]);
  return makeItem(chosen.id, { level: Math.max(1, level + rng.int(-1, 1)), rarity, rng });
}

export const sellValue = (item: Item, priceMod = 1): number =>
  Math.max(1, Math.round(item.value * 0.35 * priceMod)) * Math.max(1, item.qty);

export const buyValue = (item: Item, priceMod = 1): number =>
  Math.max(1, Math.round(item.value * 1.25 * priceMod));
