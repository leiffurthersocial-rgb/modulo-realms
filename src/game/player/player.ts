import { CLASS_BY_ID, type AbilityDef, type ClassDef, type ClassId } from '../../data/classes';
import { RACE_BY_ID, type FactionId, type RaceId } from '../../data/races';
import { PAL } from '../art/palette';
import type { Look } from '../art/characters';
import type { WeaponKind } from '../art/weaponart';
import { newEntityId, type Entity, type StatusEffect } from '../entities/entity';
import { EQUIP_SLOT_ORDER, type EquipSlot, type Item, type StatKey, type Stats } from '../items/types';
import { ENCHANT_BY_ID, enchantValue } from '../items/enchants';
import type { Dir4 } from '../core/math';

export interface Buff {
  id: string;
  name: string;
  stat: StatKey;
  amount: number;
  until: number;
  color: string;
}

export const EQUIP_SLOTS: EquipSlot[] = EQUIP_SLOT_ORDER;

/**
 * Every weapon kind is classified in exactly one place. Adding a kind without
 * listing it here used to leave it silently melee — an orb with 340 range then
 * swung a 340-pixel melee cone that hit half the screen.
 */
export const RANGED_KINDS = new Set<WeaponKind>(['bow', 'crossbow', 'staff', 'wand', 'tome', 'orb']);
export const MAGIC_KINDS = new Set<WeaponKind>(['staff', 'wand', 'tome', 'orb']);

/**
 * How wide a melee kind sweeps, in radians. A greatsword and a halberd cut
 * through a rank; a dagger or a rapier is a thrust and only ever touches what
 * it is pointed at. Unlisted kinds use the default.
 */
export const SWING_ARC: Partial<Record<WeaponKind, number>> = {
  dagger: 0.75, rapier: 0.6, spear: 0.7, warpick: 0.85,
  greatsword: 1.9, greataxe: 2.0, halberd: 1.8, scythe: 2.1, flail: 1.6, claws: 1.5,
};
export const DEFAULT_SWING_ARC = 1.15;

/** Which attribute a weapon kind scales with, overriding the class default. */
export const WEAPON_STAT: Partial<Record<WeaponKind, 'strength' | 'dexterity' | 'intelligence'>> = {
  bow: 'dexterity', crossbow: 'dexterity', dagger: 'dexterity', claws: 'dexterity', rapier: 'dexterity',
  staff: 'intelligence', wand: 'intelligence', tome: 'intelligence', scythe: 'intelligence', orb: 'intelligence',
  greatsword: 'strength', greataxe: 'strength', hammer: 'strength', flail: 'strength',
  halberd: 'strength', warpick: 'strength',
};

export const xpToNext = (level: number): number => Math.round(64 * Math.pow(level, 1.48) + 40);

export interface PlayerInit {
  name: string;
  race: RaceId;
  cls: ClassId;
  hairIndex: number;
  skinIndex: number;
  hairStyle: Look['hairStyle'];
  beard: Look['beard'];
}

export type DerivedStats = Required<Pick<Stats,
  'maxHealth' | 'maxMana' | 'maxStamina' | 'defense' | 'strength' | 'dexterity' | 'intelligence' | 'vitality' |
  'critChance' | 'critDamage' | 'moveSpeed' | 'abilityPower' | 'lifesteal' | 'cooldownReduction' | 'magicFind' |
  'manaRegen' | 'staminaRegen' | 'attackSpeed' | 'damage' | 'range'>>;

export class Player implements Entity {
  id = newEntityId();
  name: string;
  race: RaceId;
  cls: ClassId;
  hairIndex: number;
  skinIndex: number;
  hairStyle: Look['hairStyle'];
  beard: Look['beard'];

  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  radius = 11;
  dir: Dir4 = 'down';
  dead = false;
  flash = 0;
  anim = 'idle';
  animTime = 0;
  statuses: StatusEffect[] = [];
  knockX = 0;
  knockY = 0;

  level = 1;
  xp = 0;
  hp = 100;
  mp = 50;
  sp = 100;
  gold = 75;
  skillPoints = 0;
  /**
   * Crown warrants already spent with King Jovan. Warrants earned is simply
   * the number of bosses felled, so the two together give what is available.
   */
  warrantsUsed = 0;
  skills: Record<string, number> = {};

  inventory: Item[] = [];
  storage: Item[] = [];
  equipment: Record<EquipSlot, Item | null> = {
    mainHand: null, offHand: null, armor: null, accessory: null,
  };

  buffs: Buff[] = [];
  cooldowns: Record<string, number> = {};
  quickItem: string | null = 'potion_health_s';

  reputation: Record<FactionId, number> = { alliance: 0, northern: 0, forest: 0, guild: 0, bandits: 0, arcane: 0 };
  flags = new Set<string>();
  discovered = new Set<string>();
  waystones = new Set<string>();
  killCounts: Record<string, number> = {};
  bossesKilled = new Set<string>();
  clearedDungeons = new Set<string>();
  shrinesTended = 0;

  attackTimer = 0;
  invuln = 0;
  shield = 0;
  shieldUntil = 0;
  /** Cached enchantment totals, refreshed by stats(). */
  enchantLevels: Record<string, number> = {};
  artifactCooldown = 0;
  offhandCooldown = 0;
  blocking = false;
  dashVx = 0;
  dashVy = 0;
  dashTimer = 0;
  reviveUsed = false;
  playTime = 0;
  deaths = 0;
  maxHpCache = 100;

  constructor(init: PlayerInit) {
    this.name = init.name;
    this.race = init.race;
    this.cls = init.cls;
    this.hairIndex = init.hairIndex;
    this.skinIndex = init.skinIndex;
    this.hairStyle = init.hairStyle;
    this.beard = init.beard;
    const s = this.stats();
    this.hp = s.maxHealth;
    this.mp = s.maxMana;
    this.sp = s.maxStamina;
  }

  get classDef(): ClassDef { return CLASS_BY_ID[this.cls]; }
  get raceDef() { return RACE_BY_ID[this.race]; }
  get maxHp(): number { return this.stats().maxHealth; }
  set maxHp(v: number) { this.maxHpCache = v; }
  get maxMp(): number { return this.stats().maxMana; }
  get maxSp(): number { return this.stats().maxStamina; }

  get abilities(): AbilityDef[] {
    return this.classDef.abilities.filter((a) => a.level <= this.level);
  }

  hasPerk(perkId: string): boolean {
    return this.raceDef.perkId === perkId;
  }

  /** Fully derived stat block: class base + growth + race + skills + gear + buffs. */
  stats(): DerivedStats {
    const c = this.classDef;
    const r = this.raceDef;
    const lv = this.level - 1;

    const out: DerivedStats = {
      maxHealth: c.base.health + c.growth.health * lv,
      maxMana: c.base.mana + c.growth.mana * lv,
      maxStamina: c.base.stamina + c.growth.stamina * lv,
      defense: c.base.defense + c.growth.defense * lv + (r.stats.defense ?? 0),
      strength: c.base.strength + c.growth.strength * lv + (r.stats.strength ?? 0),
      dexterity: c.base.dexterity + c.growth.dexterity * lv + (r.stats.dexterity ?? 0),
      intelligence: c.base.intelligence + c.growth.intelligence * lv + (r.stats.intelligence ?? 0),
      vitality: c.base.vitality + (r.stats.vitality ?? 0),
      critChance: c.base.critChance + (r.stats.critChance ?? 0),
      critDamage: 50,
      moveSpeed: c.base.moveSpeed + (r.stats.moveSpeed ?? 0),
      abilityPower: 0,
      lifesteal: 0,
      cooldownReduction: 0,
      magicFind: 0,
      manaRegen: 2.4,
      staminaRegen: 9,
      attackSpeed: 0,
      damage: 0,
      range: 0,
    };

    for (const node of c.skills) {
      const pts = this.skills[node.id] ?? 0;
      if (!pts) continue;
      for (const [k, v] of Object.entries(node.bonus) as Array<[keyof DerivedStats, number]>) {
        if (k in out) out[k] += v * pts;
      }
    }

    for (const slot of EQUIP_SLOTS) {
      const it = this.equipment[slot];
      if (!it) continue;
      for (const [k, v] of Object.entries(it.stats) as Array<[StatKey, number]>) {
        if (k === 'damage' || k === 'attackSpeed' || k === 'range') {
          if (slot === 'mainHand') {
            if (k === 'damage') out.damage += v;
            else if (k === 'attackSpeed') out.attackSpeed += v * 0;
            else out.range += v;
          }
          continue;
        }
        if (k in out) (out as unknown as Record<string, number>)[k] += v;
      }
    }

    // enchantments that map onto plain stats
    const levels: Record<string, number> = {};
    for (const slot of EQUIP_SLOTS) {
      for (const e of this.equipment[slot]?.enchants ?? []) levels[e.id] = (levels[e.id] ?? 0) + e.level;
    }
    for (const [id, lv] of Object.entries(levels)) {
      const def = ENCHANT_BY_ID[id];
      if (!def?.stat) continue;
      const key = def.stat.key as keyof DerivedStats;
      if (key in out) out[key] += enchantValue(id, lv);
    }
    this.enchantLevels = levels;

    for (const b of this.buffs) {
      if (b.stat in out) (out as unknown as Record<string, number>)[b.stat] += b.amount;
    }

    if (levels.protection) out.defense *= 1 + enchantValue('protection', levels.protection) / 100;
    out.maxHealth += out.vitality * 5;
    out.maxStamina += out.dexterity * 1.5;
    out.maxMana += out.intelligence * 3;
    out.defense += Math.floor(out.vitality * 0.25);
    if (this.hasPerk('pathfinder')) out.moveSpeed *= 1.1;

    for (const k of Object.keys(out) as Array<keyof DerivedStats>) out[k] = Math.round(out[k] * 10) / 10;
    return out;
  }

  primaryStat(): 'strength' | 'dexterity' | 'intelligence' {
    return WEAPON_STAT[this.weaponKind()]
      ?? (this.cls === 'mage' || this.cls === 'necromancer' ? 'intelligence'
        : this.cls === 'ranger' || this.cls === 'rogue' ? 'dexterity'
          : 'strength');
  }

  weaponKind(): WeaponKind {
    return this.equipment.mainHand?.weaponKind ?? 'none';
  }

  isRangedWeapon(): boolean {
    return RANGED_KINDS.has(this.weaponKind());
  }

  /** Magic weapons fire a slower, larger bolt and cost mana per shot. */
  isMagicWeapon(): boolean {
    return MAGIC_KINDS.has(this.weaponKind());
  }

  attackPower(): number {
    const s = this.stats();
    const weaponDmg = s.damage > 0 ? s.damage : 4 + this.level;
    const prim = s[this.primaryStat()];
    return weaponDmg * (1 + prim * 0.022);
  }

  attackInterval(): number {
    const base = this.equipment.mainHand?.stats.attackSpeed ?? 1.2;
    let bonus = 0;
    for (const slot of EQUIP_SLOTS) bonus += this.equipment[slot]?.stats.attackSpeed && slot !== 'mainHand' ? this.equipment[slot]!.stats.attackSpeed! : 0;
    for (const node of this.classDef.skills) {
      const pts = this.skills[node.id] ?? 0;
      if (pts && node.bonus.attackSpeed) bonus += node.bonus.attackSpeed * pts;
    }
    return 1 / Math.max(0.2, base * (1 + bonus / 100));
  }

  attackRange(): number {
    return this.equipment.mainHand?.stats.range ?? 44;
  }

  cooldownFor(a: AbilityDef): number {
    const cdr = Math.min(60, this.stats().cooldownReduction);
    return a.cooldown * (1 - cdr / 100);
  }

  effectIds(): string[] {
    const out: string[] = [];
    for (const slot of EQUIP_SLOTS) {
      const it = this.equipment[slot];
      if (it) out.push(...it.effects);
    }
    return out;
  }

  hasEffect(id: string): boolean {
    return this.effectIds().includes(id);
  }

  addXp(amount: number): number {
    let levels = 0;
    this.xp += amount;
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level++;
      this.skillPoints += 1;
      levels++;
      this.hp = this.maxHp;
      this.mp = this.maxMp;
      this.sp = this.maxSp;
    }
    return levels;
  }

  rep(f: FactionId): number { return this.reputation[f] ?? 0; }

  addRep(f: FactionId, amount: number): void {
    this.reputation[f] = Math.max(-100, Math.min(100, (this.reputation[f] ?? 0) + amount));
  }

  priceMod(faction: FactionId): number {
    let mod = 1;
    const rep = this.rep(faction);
    mod -= Math.max(-0.12, Math.min(0.18, rep / 500));
    if (this.hasPerk('haggler')) mod -= 0.08;
    return Math.max(0.6, mod);
  }

  /** Total level of an enchantment across all equipped gear. */
  enchant(id: string): number {
    let lv = 0;
    for (const slot of EQUIP_SLOTS) {
      for (const e of this.equipment[slot]?.enchants ?? []) if (e.id === id) lv += e.level;
    }
    return lv;
  }

  enchantPower(id: string): number {
    return enchantValue(id, this.enchant(id));
  }

  look(): Look {
    const r = this.raceDef;
    const c = this.classDef;
    const mh = this.equipment.mainHand;
    const armor = this.equipment.armor;
    const off = this.equipment.offHand;
    const al = armor?.armorLook;

    return {
      skin: r.look.skins[this.skinIndex % r.look.skins.length],
      hair: r.look.hairs[this.hairIndex % r.look.hairs.length],
      hairStyle: this.hairStyle,
      beard: this.beard,
      shirt: al?.color ?? c.look.shirt,
      pants: c.look.pants,
      boots: al ? shadeHex(al.color, 0.7) : '#3a2a1e',
      belt: '#2a1c14',
      cape: al?.cape ?? c.look.cape ?? null,
      armor: al?.style ?? c.look.armor,
      armorColor: al?.color,
      armorTrim: al?.trim ?? PAL.gold,
      helmet: al?.helmet ?? c.look.helmet,
      ears: r.look.ears,
      tusks: r.look.tusks,
      height: r.look.height,
      bulk: r.look.bulk,
      eyes: r.look.eyes,
      weapon: mh?.weaponKind && mh.weaponKind !== 'none'
        ? { kind: mh.weaponKind, metal: mh.iconMetal ?? PAL.iron, grip: '#2a1c14', glow: mh.glow }
        : null,
      offhand: off
        ? (off.weaponKind === 'shield' ? 'shield' : off.weaponKind === 'tome' ? 'tome' : off.icon === 'torch_item' ? 'torch' : 'shield')
        : 'none',
      offhandColor: off?.iconMetal ?? PAL.iron,
      // A mythic relic glows on the character the way a legendary does.
      glow: topTier(mh) ? mh!.glow ?? null : (topTier(armor) ? armor!.glow ?? null : null),
    };
  }
}

/** Legendary and Mythic gear is the gear that glows on the character. */
const topTier = (i: Item | null | undefined): boolean =>
  i?.rarity === 'legendary' || i?.rarity === 'mythic';

function shadeHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * amount)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * amount)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
