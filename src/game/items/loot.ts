import { RNG } from '../core/rng';
import { MAX_CONTENT_LEVEL, RARITY_POWER, meleeDpsAt, merchantMarkupAt, valuePremiumAt } from '../../data/balance';
import { DROPPABLE, REGION_RELICS, TEMPLATE_BY_ID, type ItemTemplate } from '../../data/items';
import { AEGEAN_ISLAND_ITEM_SOURCES } from '../../data/aegean/content';
import { candidateEnchants } from './enchants';
import { EFFECTS } from './effects';
import {
  RARITY_AFFIXES, RARITY_COLOR, RARITY_ENCHANT_SLOTS, RARITY_MULT, RARITY_ORDER, ROLLABLE_RARITIES,
  type Item, type ItemAffixRoll, type ItemProvenance, type Rarity, type RolledEnchant, type StatKey, type Stats,
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
  // Multiplicative with everything else a character has, so it is priced
  // well below the flat stats and rolls less often than they do.
  { name: 'Quickened', stat: 'attackSpeed', perLevel: 0.09, flat: 2, weight: 5 },
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

/**
 * Whether an affix may roll onto this template at all.
 *
 * `attackSpeed` means two different things depending on where it sits, and
 * conflating them was a genuine bug rather than a balance problem. On a weapon
 * the field holds the weapon's BASE SWING RATE — 1.26 for a longsword. On
 * anything else it is a PERCENTAGE BONUS, which is how `Player.attackInterval`
 * reads it from armour, off-hands and artifacts.
 *
 * The affix roller wrote percentages, so a longsword that rolled it came out
 * with a base swing rate of 1.26 + 21 = 22.26 — eighteen times the intended
 * attack rate, from one affix, on an item whose name did not even say
 * "Quickened" because only the first prefix gets to name a piece. It was the
 * single strongest thing in the game and it was invisible.
 *
 * So: no attack-speed affix on a weapon. On armour it works correctly and
 * stays.
 */
function affixAllowedOn(a: Affix, t: ItemTemplate): boolean {
  if (a.stat === 'attackSpeed' && t.slot === 'mainHand') return false;
  return true;
}

const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 100, rare: 42, superRare: 15, epic: 4.6, legendary: 0.9,
  // Never rolled. Mythic is placed by hand, on named relics, and this zero is
  // the guarantee: raise it and it becomes a drop tier like any other.
  mythic: 0,
  olympian: 0,
  primordial: 0,
};

/**
 * How much of its weight each rarity is allowed to keep, at the level the roll
 * is being made at.
 *
 * A legendary in the first hours is not a lucky drop, it is the end of the
 * loot game: nothing found for the next twenty levels can beat it, so the
 * whole middle of the game stops paying out. Epic and legendary are therefore
 * taken almost entirely off the table early and faded in over the run —
 * legendary is effectively unavailable below level 12 and does not reach its
 * full weight until 45.
 *
 * Magic find still multiplies whatever survives this, so a lucky character
 * with a good artifact gets there sooner. It just cannot get there at level 3.
 */
function levelGate(rarity: Rarity, level: number): number {
  if (rarity === 'legendary') return Math.max(0, Math.min(1, (level - 12) / 33));
  if (rarity === 'epic') return Math.max(0.02, Math.min(1, (level - 6) / 20));
  if (rarity === 'superRare') return Math.max(0.12, Math.min(1, (level - 2) / 10));
  return 1;
}

export function rollRarity(rng: RNG, magicFind = 0, luckBias = 0, level = 99): Rarity {
  const bonus = 1 + magicFind / 100 + luckBias;
  const weights = ROLLABLE_RARITIES.map((r, i) => (
    RARITY_WEIGHTS[r] * (i === 0 ? 1 : Math.pow(bonus, i * 0.9)) * levelGate(r, level)
  ));
  return rng.weighted(ROLLABLE_RARITIES, weights);
}

/**
 * Re-price a template's stats for the level and rarity it actually rolled at.
 *
 * Two bugs lived here, and together they were most of why damage ran away.
 *
 * The first was double-counted rarity. `W()` in items.ts already solves a
 * weapon's damage through `RARITY_POWER`, so a template authored as legendary
 * has its rarity baked into the number — and then this multiplied by
 * `RARITY_MULT[rarity]` again, handing that weapon its rarity bonus twice
 * over. Only the STEP from the template's own rarity is applied now, so an
 * ordinary blade rolled up to legendary still gains, and a relic authored as
 * legendary is priced exactly once.
 *
 * The second was the level scale. It was `1 + (level - templateLevel) * 0.13`,
 * a share of the template's own numbers and unbounded — which meant a level-1
 * sword dragged up to level 75 came out at 10.6x, far past what the linear
 * weapon curve pays an honestly authored level-75 weapon. Scaling by the RATIO
 * OF THE CURVE at the two levels makes an up-levelled item worth exactly what
 * a weapon written for that level is worth, which is the whole point of having
 * a curve.
 */
export function scaleStats(template: ItemTemplate, level: number, rarity: Rarity): Item['stats'] {
  // The valley's rarity ladder is part of its established loot economy. Only
  // Greek templates use the expansion's deliberately narrower power curve.
  const powers = template.id.startsWith('aegean_') ? RARITY_POWER : RARITY_MULT;
  const step = powers[rarity] / powers[template.rarity];
  const from = Math.max(1, template.level);
  const dmgScale = meleeDpsAt(level) / meleeDpsAt(from);
  const defScale = (3 + level * 2.1) / (3 + from * 2.1);
  const out: Item['stats'] = {};
  for (const [k, v] of Object.entries(template.stats) as Array<[StatKey, number]>) {
    if (v === undefined) continue;
    if (k === 'attackSpeed' || k === 'range') {
      out[k] = v;
    } else if (k === 'damage') {
      out[k] = Math.max(1, Math.round(v * dmgScale * step));
    } else if (k === 'defense' || k === 'maxHealth' || k === 'maxMana' || k === 'maxStamina') {
      out[k] = Math.max(1, Math.round(v * defScale * step));
    } else {
      // Bonus attributes are flat-ish on purpose: they are the flavour of a
      // piece, not its budget, and letting them ride the damage curve is how
      // a single ring ends up worth more than the weapon.
      out[k] = Math.round(v * Math.min(2.2, defScale) * step * 10) / 10;
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
  provenance?: ItemProvenance;
}

export function validItemProvenance(templateId: string, provenance?: ItemProvenance): boolean {
  const t = TEMPLATE_BY_ID[templateId];
  if (!t) return false;
  if (t.rarity !== 'primordial' && !t.islandOnly) return true;
  if (provenance?.source === 'debug') return true;
  if (!provenance || !AEGEAN_ISLAND_ITEM_SOURCES[templateId]?.includes(provenance.id)) return false;
  // A supplied region is authoritative. The campaign also checks physical location before craft.
  return !provenance.region || provenance.region === 'aegean_asterion';
}

export function makeItem(templateId: string, opts: MakeItemOpts = {}): Item {
  const t = TEMPLATE_BY_ID[templateId];
  if (!t) throw new Error(`Unknown item template: ${templateId}`);
  if (!validItemProvenance(templateId, opts.provenance)) throw new Error(`Island provenance required for ${templateId}`);
  const rng = opts.rng ?? new RNG(Math.floor(Math.random() * 1e9));
  const level = Math.max(1, Math.min(t.id.startsWith('aegean_') ? MAX_CONTENT_LEVEL : Infinity, Math.round(opts.level ?? t.level)));
  let rarity = opts.rarity ?? t.rarity;
  if (RARITY_ORDER.indexOf(t.rarity) > RARITY_ORDER.indexOf(rarity)) rarity = t.rarity;
  if ((rarity === 'olympian' || rarity === 'primordial') && t.rarity !== rarity) throw new Error('Divine rarities require their own authored template');

  const stats = scaleStats(t, level, rarity);
  const effects = [...(t.effects ?? [])];
  let name = t.name;
  const affixes: ItemAffixRoll[] = [];

  const isGear = t.type === 'weapon' || t.type === 'armor' || t.type === 'accessory';
  if (isGear && !opts.plain) {
    const affixCount = RARITY_AFFIXES[rarity];
    const used = new Set<string>();
    let prefixName: string | null = null;
    let suffixName: string | null = null;
    for (let i = 0; i < affixCount; i++) {
      const pool = i % 2 === 0 ? PREFIXES : SUFFIXES;
      const candidates = pool.filter((a) => !used.has(a.name) && affixAllowedOn(a, t));
      if (!candidates.length) continue;
      const a = rng.weighted(candidates, candidates.map((c) => c.weight));
      used.add(a.name);
      const roll = rng.range(0.75, 1.25);
      addStat(stats, a.stat, a.flat + a.perLevel * level * roll);
      affixes.push({ name: a.name, stat: a.stat, flat: a.flat, perLevel: a.perLevel, roll });
      if (a.suffix && !suffixName) suffixName = a.name;
      else if (!a.suffix && !prefixName) prefixName = a.name;
    }
    // A named relic keeps its name. Random affixes exist to make the
    // hundredth Iron Sword distinguishable from the ninety-ninth; hanging
    // "Savage ... of the Fox" on the sword a person handed you after losing a
    // duel to you throws away the only thing that made it that sword. The
    // template's OWN rarity is the test, not the rolled one, so an ordinary
    // blade rolled up to legendary still gets its affixes.
    const named = RARITY_ORDER.indexOf(t.rarity) >= RARITY_ORDER.indexOf('legendary');
    if (!named && prefixName) name = `${prefixName} ${name}`;
    if (!named && suffixName) name = `${name} ${suffixName}`;

    const effectChance = { common: 0, rare: 0.1, superRare: 0.4, epic: 0.75, legendary: 1, mythic: 1, olympian: 0, primordial: 0 }[rarity];
    if (rng.bool(effectChance)) {
      const pool = EFFECTS.filter((e) => e.minLevel <= level + 2 && !effects.includes(e.id));
      if (pool.length) effects.push(rng.pick(pool).id);
    }
  }

  const enchants: RolledEnchant[] = (t.fixedEnchants ?? []).map((e) => ({ ...e }));
  const slotBonus = t.fixedEnchants?.length ?? 0;
  const enchantSlots = Math.max(RARITY_ENCHANT_SLOTS[rarity], slotBonus);
  // Ten percent a level for every level above what the template was written
  // at, floored rather than allowed to run negative. Re-levelling an item
  // DOWN more than ten levels used to take this term past zero, and the
  // clamp below turned the result into a value of 1 — which is how a shop
  // re-levelling its level-70 signature piece down for a low-level visitor
  // ended up offering a legendary for two gold. `valuePremiumAt` already
  // prices the level itself, so the floor only has to stop the sign flip.
  const levelScale = Math.max(0.2, 1 + (level - t.level) * 0.1);
  const value = Math.max(1, Math.round(
    t.value * RARITY_MULT[rarity] * levelScale * valuePremiumAt(level),
  ));

  const item: Item = {
    uid: newUid(),
    defId: t.id,
    name,
    type: t.type,
    slot: t.slot,
    icon: t.icon,
    iconMetal: t.metal,
    iconAccent: t.accent,
    glow: t.glow ?? (RARITY_ORDER.indexOf(rarity) >= 4 ? RARITY_COLOR[rarity] : undefined),
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
    weaponPower: t.weaponPower,
    noReroll: t.noReroll,
    provenance: opts.provenance,
    aegeanPower: t.aegeanPower,
    curve: isGear && t.id.startsWith('aegean_') ? { version: 2, affixes, reforges: 0 } : undefined,
  };

  if (isGear && !opts.plain) rollEnchants(item, rng);
  return item;
}

/**
 * Roll a random piece of gear for the given level. Region-locked relics can
 * only appear from a roll made inside their own region.
 */
export function rollLoot(level: number, rng: RNG, magicFind = 0, luckBias = 0, region?: string): Item {
  const rarity = rollRarity(rng, magicFind, luckBias, level);

  if (rarity === 'legendary' && region) {
    const relics = REGION_RELICS.filter((t) => t.regions!.includes(region as 'north') && level >= t.level - 3);
    if (relics.length && rng.bool(0.3)) {
      const relic = rng.pick(relics);
      // The relic's own rarity wins: a mythic relic does not come out of the
      // ground demoted to legendary just because that is what the roll said.
      return makeItem(relic.id, { level: Math.max(level, relic.level), rarity: relic.rarity, rng });
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
  Math.max(1, Math.round(item.value * merchantMarkupAt(item.level) * priceMod));

export interface ItemCurveMigration {
  uid: string;
  previousStats: Stats;
  currentStats: Stats;
  previousValue: number;
  currentValue: number;
  /** Legacy saves never recorded exact rolls or forge counts; these are bounded estimates. */
  legacyRollsEstimated: boolean;
}

/** Undo the expansion's old global migration only when its receipt still
 * matches the untouched item. A later forge, commission or stat change wins. */
export function restoreLegacyItemMigration(item: Item, reports: readonly ItemCurveMigration[]): boolean {
  if (item.defId.startsWith('aegean_') || !TEMPLATE_BY_ID[item.defId] || item.curve?.version !== 2 || item.curve.reforges !== 0) return false;
  const report = reports.find((entry) => entry.uid === item.uid);
  if (!report || item.value !== report.currentValue) return false;
  const currentKeys = Object.keys(item.stats) as StatKey[];
  const reportedKeys = Object.keys(report.currentStats);
  if (currentKeys.length !== reportedKeys.length || currentKeys.some((key) => item.stats[key] !== report.currentStats[key])) return false;
  item.stats = { ...report.previousStats };
  item.value = report.previousValue;
  delete item.curve;
  return true;
}

const curveValue = (template: ItemTemplate, level: number, rarity: Rarity): number => Math.max(1, Math.round(
  template.value * RARITY_MULT[rarity] * Math.max(.2, 1 + (level - template.level) * .1) * valuePremiumAt(level),
));

function rebuildItemStats(item: Item, template: ItemTemplate): Stats {
  const stats = scaleStats(template, item.level, item.rarity);
  for (const a of item.curve?.affixes ?? []) addStat(stats, a.stat, a.flat + a.perLevel * item.level * a.roll);
  // Legacy bonuses are saved separately, so repeated load/reforge cannot compound them.
  const scale = (3 + item.level * 2.1) / (3 + (item.curve?.legacyAtLevel ?? item.level) * 2.1);
  for (const [key, value] of Object.entries(item.curve?.legacyBonuses ?? {}) as Array<[StatKey, number]>) {
    addStat(stats, key, value * Math.min(2.2, scale));
  }
  return stats;
}

/**
 * Versioned migration. New items retain exact rolls. Old snapshots cannot reveal
 * affixes that overlapped an old base or their unknown forge history: preserve the
 * observable positive bonus within the legal affix envelope, and report the loss
 * of exactness so save migration can display/record it rather than hide it.
 */
export function normalizeItemCurve(item: Item): ItemCurveMigration | null {
  const template = TEMPLATE_BY_ID[item.defId];
  if (!template || !template.id.startsWith('aegean_') || !['weapon', 'armor', 'accessory'].includes(item.type)) return null;
  const previousStats = { ...item.stats };
  const previousValue = item.value;
  const legacy = item.curve?.version !== 2;
  item.level = Math.max(1, Math.min(MAX_CONTENT_LEVEL, Math.round(item.level)));
  if (legacy) {
    const base = scaleStats(template, item.level, item.rarity);
    const bonus: Stats = {};
    for (const [key, value] of Object.entries(item.stats) as Array<[StatKey, number]>) {
      if (!Number.isFinite(value) || key === 'damage' || key === 'range' || (key === 'attackSpeed' && item.slot === 'mainHand')) continue;
      const pool = [...PREFIXES, ...SUFFIXES].filter(a => a.stat === key && affixAllowedOn(a, template));
      const cap = pool.sort((a, b) => (b.flat + b.perLevel * item.level * 1.25) - (a.flat + a.perLevel * item.level * 1.25))
        .slice(0, RARITY_AFFIXES[item.rarity]).reduce((sum, a) => sum + a.flat + a.perLevel * item.level * 1.25, 0);
      const retained = Math.max(0, Math.min(cap, value - (base[key] ?? 0)));
      if (retained > 0) bonus[key] = Math.round(retained * 10) / 10;
    }
    item.curve = { version: 2, affixes: [], legacyBonuses: bonus, legacyAtLevel: item.level, reforges: 0 };
  }
  item.stats = rebuildItemStats(item, template);
  item.value = curveValue(template, item.level, item.rarity);
  const changed = previousValue !== item.value || JSON.stringify(previousStats) !== JSON.stringify(item.stats);
  return changed || legacy ? { uid: item.uid, previousStats, currentStats: { ...item.stats }, previousValue, currentValue: item.value, legacyRollsEstimated: legacy } : null;
}

/** One curve reconstruction, never eleven-percent multiplication of a snapshot. */
export function relevelItem(item: Item, targetLevel: number): Item {
  const template = TEMPLATE_BY_ID[item.defId];
  if (!template || !template.id.startsWith('aegean_') || !['weapon', 'armor', 'accessory'].includes(item.type)) return item;
  normalizeItemCurve(item);
  const next = Math.max(1, Math.min(MAX_CONTENT_LEVEL, Math.round(targetLevel)));
  item.curve!.reforges += Math.max(0, next - item.level);
  item.level = next;
  item.stats = rebuildItemStats(item, template);
  item.value = curveValue(template, item.level, item.rarity);
  return item;
}

/**
 * Bring an item saved by an older build back into line with its template.
 *
 * An item is a SNAPSHOT: when it was rolled, everything the template said got
 * copied onto it, and it has carried those copies ever since. That is correct
 * for the parts that were rolled — its rarity, its affixes, its enchantments,
 * the level it came out at — and wrong for the parts the template simply
 * states. Add a signature move to the Leviathan Axe and the axe already in
 * somebody's hands does not have one, because the field did not exist on the
 * day it dropped. The player's reasonable conclusion is that the feature does
 * not work.
 *
 * So: on load, every stored item is re-read against its template, and the
 * fields the template OWNS are refreshed — the activated powers, the intrinsic
 * effects, the art, the description, the reroll lock. Rolled state is left
 * strictly alone.
 *
 * Damage is deliberately included. A weapon's numbers come from the shared
 * curve, and when that curve moves the gear in a save has to move with it or
 * the balance pass only applies to items found after it.
 */
export function refreshFromTemplate(item: Item): Item {
  const t = TEMPLATE_BY_ID[item.defId];
  if (!t) return item;

  if (t.id.startsWith('aegean_')) {
    normalizeItemCurve(item);
  } else {
    // Preserve the original loader: refresh template-owned stats and leave
    // rolled extra stats, sale value and forge history alone.
    const scaled = scaleStats(t, item.level, item.rarity);
    for (const [key, value] of Object.entries(scaled) as Array<[StatKey, number]>) item.stats[key] = value;
    delete item.curve;
  }

  item.weaponPower = t.weaponPower;
  item.artifact = t.artifact;
  item.weaponKind = t.weaponKind;
  item.armorLook = t.armorLook;
  item.icon = t.icon;
  item.iconMetal = t.metal;
  item.iconAccent = t.accent;
  item.classes = t.classes;
  item.desc = t.desc;
  item.noReroll = t.noReroll;
  item.consume = t.consume;
  item.aegeanPower = t.aegeanPower;
  if (t.id.startsWith('aegean_')) {
    item.enchantSlots = Math.max(RARITY_ENCHANT_SLOTS[item.rarity], item.enchants.length, t.fixedEnchants?.length ?? 0);
    item.glow = t.glow ?? (RARITY_ORDER.indexOf(item.rarity) >= 4 ? RARITY_COLOR[item.rarity] : undefined);
  }
  // Intrinsic effects belong to the template; anything the roll added on top
  // is kept.
  for (const e of t.effects ?? []) if (!item.effects.includes(e)) item.effects.push(e);
  return item;
}
