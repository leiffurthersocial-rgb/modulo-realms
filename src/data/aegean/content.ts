import { GREEK_WEAPON_STYLES } from './weapons';
import type { ItemTemplate } from "../items";
import type {
  ArmorLook,
  EquipSlot,
  Rarity,
  Stats,
} from "../../game/items/types";
import type { WeaponKind } from "../../game/art/weaponart";
import type { IconKind } from "../../game/art/icons";
import { armorDefenseAt, weaponDamage } from "../balance";
import { AEGEAN_POWERS } from "../../game/items/effects";

export interface AegeanReward {
  xp: number;
  gold: number;
  items?: string[];
  flags?: string[];
  /** A persistent claim: choose one; never create all the alternatives. */
  choice?: string[];
}

export interface AegeanRecipe {
  id: string;
  name: string;
  item: string;
  gold: number;
  materials: Array<{ id: string; count: number }>;
  requires: string[];
  islandOnly: boolean;
  station: "forge" | "divine" | "oath";
  /** A successful craft can record a permanent component, independent of inventory space. */
  flag?: string;
}

export interface AegeanShip {
  id: string;
  name: string;
  cost: number;
  hull: number;
  speed: number;
  turn: number;
  slots: { combat: number; utility: number };
  requirements: string[];
  stormRating: number;
  cargo: number;
  draft: "shallow" | "deep";
  ram: boolean;
  description: string;
}

const BRONZE = "#be8750",
  IVORY = "#efe0a3",
  STAR = "#b9dcff",
  OATH = "#554c48";
const gear = (
  id: string,
  name: string,
  slot: EquipSlot,
  rarity: Rarity,
  level: number,
  icon: IconKind,
  stats: Stats,
  power: string,
  desc: string,
  extra: Partial<ItemTemplate> = {},
): ItemTemplate => ({
  id: `aegean_${id}`,
  name,
  type:
    slot === "mainHand" || slot === "offHand"
      ? "weapon"
      : slot === "armor"
        ? "armor"
        : "accessory",
  slot,
  rarity,
  level,
  icon,
  stats,
  value: 900 + level * 75,
  noDrop: true,
  metal: rarity === "primordial" ? OATH : BRONZE,
  accent: rarity === "primordial" ? STAR : IVORY,
  glow:
    rarity === "primordial" ? STAR : rarity === "olympian" ? IVORY : undefined,
  aegeanPower: power,
  desc,
  ...extra,
});
const weapon = (
  id: string,
  name: string,
  kind: WeaponKind,
  rarity: Rarity,
  level: number,
  speed: number,
  range: number,
  power: string,
  desc: string,
  bonus: Stats = {},
): ItemTemplate =>
  gear(
    id,
    name,
    "mainHand",
    rarity,
    level,
    kind,
    {
      ...bonus,
      damage: weaponDamage(kind, level, rarity, GREEK_WEAPON_STYLES[`aegean_${id}`]?.speed ?? speed),
      attackSpeed: GREEK_WEAPON_STYLES[`aegean_${id}`]?.speed ?? speed,
      range: GREEK_WEAPON_STYLES[`aegean_${id}`]?.range ?? range,
    },
    power,
    desc,
    {
      weaponKind: kind,
      weaponPower: {
        id: power,
        name,
        cooldown: AEGEAN_POWERS[power]?.cooldown ?? 12,
        desc,
      },
    },
  );
const offhand = (
  id: string,
  name: string,
  kind: WeaponKind,
  rarity: Rarity,
  level: number,
  power: string,
  desc: string,
  stats: Stats,
): ItemTemplate =>
  gear(id, name, "offHand", rarity, level, kind, stats, power, desc, {
    weaponKind: kind,
    artifact: {
      id: power,
      name,
      cooldown: AEGEAN_POWERS[power]?.cooldown ?? 16,
      desc,
    },
  });
const armour = (
  id: string,
  name: string,
  rarity: Rarity,
  level: number,
  weight: number,
  power: string,
  desc: string,
  stats: Stats,
  style: ArmorLook["style"],
): ItemTemplate =>
  gear(
    id,
    name,
    "armor",
    rarity,
    level,
    "chest",
    { ...stats, defense: Math.round(armorDefenseAt(level, rarity) * weight) },
    power,
    desc,
    {
      armorLook: {
        style,
        helmet:
          style === "heavy" ? "full" : style === "robe" ? "hood" : "circlet",
        color: rarity === "primordial" ? OATH : BRONZE,
        trim: rarity === "primordial" ? STAR : IVORY,
        cape: "#843c38",
      },
    },
  );
const artifact = (
  id: string,
  name: string,
  rarity: Rarity,
  level: number,
  icon: IconKind,
  power: string,
  desc: string,
  stats: Stats,
): ItemTemplate =>
  gear(id, name, "accessory", rarity, level, icon, stats, power, desc, {
    artifact: {
      id: power,
      name,
      cooldown: AEGEAN_POWERS[power]?.cooldown ?? 20,
      desc,
    },
  });

/** All 36 ledger identities. Neither new rarity enters any random loot pool. */
export const AEGEAN_GEAR: ItemTemplate[] = [
  weapon(
    "dory_dawn",
    "Dory of the Dawn",
    "spear",
    "legendary",
    76,
    1.08,
    96,
    "aegean_spacing",
    "A measured thrust marks a target; striking from reach earns the next opening.",
    { strength: 16 },
  ),
  weapon(
    "kopis_nemea",
    "Kopis of the Nemean Hunt",
    "sword",
    "olympian",
    82,
    1.36,
    62,
    "aegean_hunt_counter",
    "Evading a committed attack primes a brief flank-cut window.",
    { dexterity: 17 },
  ),
  weapon(
    "hydra_fang",
    "Hydra's Last Fang",
    "dagger",
    "olympian",
    89,
    1.95,
    46,
    "aegean_hydra_venom",
    "Up to three venom stacks build when a target is exposed.",
    { critChance: 7 },
  ),
  weapon(
    "artemis_bow",
    "Artemis's Silver Bow",
    "bow",
    "olympian",
    84,
    1.1,
    440,
    "aegean_hunt_mark",
    "Mark one enemy, then follow with a deliberate piercing shot.",
    { dexterity: 19 },
  ),
  weapon(
    "thunder_javelins",
    "Thunder Javelins",
    "javelin",
    "olympian",
    92,
    1.18,
    300,
    "aegean_javelin_recall",
    "Three ready javelins recover steadily; recall creates one bounded lightning line.",
    { critChance: 6 },
  ),
  weapon(
    "hephaestus_measure",
    "Hephaestus's Measure",
    "hammer",
    "olympian",
    91,
    0.76,
    74,
    "aegean_forge_shock",
    "A stagger releases one short shockwave; the effect has its own cooldown.",
    { strength: 22 },
  ),
  weapon(
    "delphic_staff",
    "Staff of the Delphic Breath",
    "staff",
    "olympian",
    88,
    0.94,
    370,
    "aegean_oracle_field",
    "Place a small oracle field; reposition through it for limited mana recovery.",
    { intelligence: 20 },
  ),
  weapon(
    "prometheus_chains",
    "Chains of Prometheus",
    "chainblades",
    "olympian",
    97,
    1.3,
    114,
    "aegean_chain_retreat",
    "A close strike followed by a retreat primes a chain sweep; bosses resist pulls.",
    { strength: 14, dexterity: 14 },
  ),
  weapon(
    "labyrinth_labrys",
    "Labrys of the Labyrinth",
    "greataxe",
    "olympian",
    94,
    0.82,
    82,
    "aegean_tether_sever",
    "An earned interruption primes a committed armour-breaking heavy arc.",
    { strength: 21 },
  ),
  weapon(
    "geryon_pick",
    "Geryon's Threefold Pick",
    "warpick",
    "olympian",
    95,
    1.12,
    66,
    "aegean_threefold",
    "Three earned openings prime one armour-breaking thrust.",
    { critDamage: 18 },
  ),
  weapon(
    "quarry_answer",
    "Quarry's Answer",
    "hammer",
    "legendary",
    88,
    0.68,
    80,
    "aegean_quarry_crush",
    "Breaking cover or a construct weak point empowers a single crushing swing.",
    { strength: 18 },
  ),
  weapon(
    "stymphalian_recurve",
    "Stymphalian Recurve",
    "bow",
    "olympian",
    92,
    1.32,
    380,
    "aegean_bronze_ricochet",
    "A marked hit can ricochet once to a nearby threat; repeated ricochets cannot chain.",
    { dexterity: 20 },
  ),
  weapon(
    "kings_dory",
    "King's Dory",
    "spear",
    "primordial",
    100,
    1.14,
    108,
    "aegean_royal_counter",
    "A timed defence primes one precise counter-thrust and a brief protective ward.",
    { strength: 23, vitality: 12 },
  ),
  weapon(
    "last_dawn_kopis",
    "Last Dawn Kopis",
    "sword",
    "primordial",
    100,
    1.46,
    66,
    "aegean_dawn_pursuit",
    "Interrupt a threat to open a brief pursuit and guarded-retreat window.",
    { dexterity: 23, strength: 12 },
  ),
  weapon(
    "storm_cleared_bow",
    "Bow of the Storm-Cleared Sky",
    "bow",
    "primordial",
    100,
    1.08,
    480,
    "aegean_storm_shot",
    "Ordinary hits mark a target for a focused storm shot; encounter wards still apply.",
    { dexterity: 24, critChance: 6 },
  ),
  weapon(
    "first_flame_sceptre",
    "Sceptre of the First Flame",
    "staff",
    "primordial",
    100,
    1.02,
    405,
    "aegean_flame_cycle",
    "Cycle a lance, a fan, and a ring of flame; each pattern spends mana.",
    { intelligence: 26, maxMana: 55 },
  ),
  weapon(
    "twin_oathblades",
    "Twin Oathblades",
    "chainblades",
    "primordial",
    100,
    1.5,
    124,
    "aegean_oath_combo",
    "Alternate close and distant chain strikes to earn a capped finisher.",
    { dexterity: 22, strength: 14 },
  ),
  weapon(
    "unbroken_standard",
    "The Unbroken Standard",
    "halberd",
    "primordial",
    100,
    0.94,
    112,
    "aegean_standard_stance",
    "Plant a short-lived defensive standard for yourself and nearby allies.",
    { strength: 20, vitality: 16 },
  ),
  offhand(
    "aspis_sparta",
    "Aspis of Sparta",
    "shield",
    "legendary",
    89,
    "aegean_aspis_brace",
    "A disciplined block restores a little stamina.",
    { defense: 74, maxStamina: 30 },
  ),
  offhand(
    "drowned_lyre",
    "Lyre of the Drowned",
    "tome",
    "olympian",
    90,
    "aegean_lyre_pulse",
    "A timed pulse weakens hostile projectiles without charming their caster.",
    { maxMana: 72, intelligence: 16 },
  ),
  offhand(
    "clear_mind_aegis",
    "Aegis of the Clear Mind",
    "shield",
    "olympian",
    94,
    "aegean_clear_mind",
    "A correctly faced defence clears petrification pressure.",
    { defense: 88, vitality: 17 },
  ),
  offhand(
    "crossroads_tablets",
    "Tablets of the Crossroads",
    "tome",
    "olympian",
    91,
    "aegean_spirit_passage",
    "Gather owned spirits through a nearby collision-safe passage.",
    { intelligence: 17, manaRegen: 4 },
  ),
  offhand(
    "returning_lantern",
    "Lantern of the Returning Soul",
    "wand",
    "olympian",
    95,
    "aegean_soul_lantern",
    "A small refuge restores limited health when you leave and re-enter its edge.",
    { maxHealth: 95, maxMana: 45 },
  ),
  offhand(
    "talos_heart",
    "Heart of Talos",
    "orb",
    "olympian",
    96,
    "aegean_talos_heat",
    "Store one defended impact and release a controlled heat pulse.",
    { defense: 62, intelligence: 18 },
  ),
  offhand(
    "last_dawn_mirror",
    "Mirror of the Last Dawn",
    "shield",
    "primordial",
    100,
    "aegean_mirror_counter",
    "A timed reflection opens a personal attack opportunity.",
    { defense: 106, maxStamina: 36 },
  ),
  offhand(
    "last_companion_aspis",
    "Aspis of the Last Companion",
    "shield",
    "primordial",
    100,
    "aegean_companion_guard",
    "Protecting an ally or timing a solo brace stores one counter charge.",
    { defense: 96, vitality: 21 },
  ),
  armour(
    "nemean_mantle",
    "Nemean Mantle",
    "olympian",
    84,
    1.12,
    "aegean_mantle_resolve",
    "A successful brace shortens its recovery; ordinary attacks remain dangerous.",
    { vitality: 17, maxStamina: 32 },
    "light",
  ),
  armour(
    "erymanthian_hide",
    "Erymanthian Hide",
    "olympian",
    92,
    1.25,
    "aegean_boar_resolve",
    "Resists cold and knockback without granting immunity.",
    { vitality: 19, maxHealth: 75 },
    "heavy",
  ),
  armour(
    "amazon_girdle",
    "Girdle of the Amazon Queen",
    "olympian",
    94,
    0.91,
    "aegean_amazon_discipline",
    "Successful movement aids personal recovery and nearby allies.",
    { dexterity: 18, moveSpeed: 9 },
    "light",
  ),
  armour(
    "stygian_raiment",
    "Stygian Raiment",
    "olympian",
    98,
    0.79,
    "aegean_stygian_escape",
    "Leaving a marked hazard grants brief protection and faster fear recovery.",
    { intelligence: 22, maxMana: 90 },
    "robe",
  ),
  armour(
    "oathforged_panoply",
    "Oathforged Panoply",
    "primordial",
    100,
    1.32,
    "aegean_oath_guard",
    "Correct defence stores one guard charge; it cannot negate execution mechanics.",
    { vitality: 24, maxHealth: 105 },
    "heavy",
  ),
  artifact(
    "ariadne_thread",
    "Thread of Ariadne",
    "olympian",
    94,
    "rune",
    "aegean_ariadne_return",
    "Mark a safe point and return within four seconds. No crossing gates or water.",
    { dexterity: 12, maxStamina: 38 },
  ),
  artifact(
    "atlas_star",
    "Atlas's Last Star",
    "olympian",
    97,
    "gem",
    "aegean_atlas_relief",
    "Unbroken movement discipline earns a brief shield and resource relief.",
    { vitality: 14, maxMana: 45 },
  ),
  artifact(
    "orphic_seal",
    "Orphic Seal",
    "olympian",
    97,
    "rune",
    "aegean_orphic_rally",
    "Gather your own summons; when alone, the song fortifies you.",
    { intelligence: 17, maxHealth: 60 },
  ),
  artifact(
    "returning_tide_crown",
    "Crown of the Returning Tide",
    "olympian",
    98,
    "chalice",
    "aegean_tide_wave",
    "A defensive wave pushes lesser threats; bosses resist displacement.",
    { maxStamina: 45, manaRegen: 3 },
  ),
  artifact(
    "first_oath_ember",
    "Ember of the First Oath",
    "primordial",
    100,
    "mat_essence",
    "aegean_ember_oath",
    "An earned interrupt primes the next short offensive and defensive opening.",
    { strength: 12, intelligence: 12, dexterity: 12 },
  ),
];

export const AEGEAN_GEAR_IDS = AEGEAN_GEAR.map((item) => item.id);
export const AEGEAN_LEONIDAS_CHOICES = AEGEAN_GEAR.filter(
  (item) => item.rarity === "primordial" && item.slot === "mainHand",
).map((item) => item.id);
export const AEGEAN_MATERIALS: ItemTemplate[] = [
  {
    id: "aegean_bronze",
    name: "Aegean Bronze",
    type: "material",
    icon: "mat_ingot",
    metal: BRONZE,
    rarity: "epic",
    level: 76,
    value: 650,
    stats: {},
    stackable: true,
    noDrop: true,
    desc: "Forged from the ore of Achaea; used for equipment and ships.",
  },
  {
    id: "aegean_resin",
    name: "Ambrosial Resin",
    type: "material",
    icon: "mat_herb",
    metal: IVORY,
    rarity: "epic",
    level: 80,
    value: 850,
    stats: {},
    stackable: true,
    noDrop: true,
    desc: "A sacred grove resin used in divine bindings and restorative draughts.",
  },
  {
    id: "aegean_stygian_glass",
    name: "Stygian Glass",
    type: "material",
    icon: "mat_crystal",
    metal: "#8c7bac",
    rarity: "legendary",
    level: 94,
    value: 1500,
    stats: {},
    stackable: true,
    noDrop: true,
    desc: "Cold glass formed beside the rivers of the dead.",
  },
  {
    id: "aegean_oathsteel",
    name: "Oathsteel",
    type: "material",
    icon: "mat_ingot",
    metal: OATH,
    accent: STAR,
    rarity: "legendary",
    level: 100,
    value: 2400,
    stats: {},
    stackable: true,
    noDrop: true,
    islandOnly: true,
    desc: "Found and forged only on Asterion.",
  },
  {
    id: "aegean_storm_ribs",
    name: "Bronze Storm Ribs",
    type: "quest",
    icon: "mat_ingot",
    metal: BRONZE,
    rarity: "legendary",
    level: 92,
    value: 0,
    stats: {},
    noDrop: true,
    desc: "A reinforced keel for a ship bound through the oath storm.",
  },
  {
    id: "aegean_kings_catalyst",
    name: "The King's Catalyst",
    type: "quest",
    icon: "mat_essence",
    metal: STAR,
    rarity: "legendary",
    level: 100,
    value: 0,
    stats: {},
    noDrop: true,
    islandOnly: true,
    desc: "An earned rematch catalyst for another royal weapon at Asterion’s forge.",
  },
];
export const AEGEAN_CONSUMABLES: ItemTemplate[] = [
  {
    id: "aegean_ambrosia",
    name: "Diluted Ambrosia",
    type: "consumable",
    icon: "elixir",
    rarity: "epic",
    level: 80,
    value: 900,
    stats: {},
    stackable: true,
    noDrop: true,
    consume: {
      healthPct: 0.32,
      mana: 70,
      cooldownGroup: "recovery",
      cooldown: 18,
    },
    desc: "Restores 32% health and 70 mana. Shares the recovery cooldown.",
  },
  {
    id: "aegean_moly",
    name: "Moly Draught",
    type: "consumable",
    icon: "potion_buff",
    rarity: "epic",
    level: 90,
    value: 1200,
    stats: {},
    stackable: true,
    noDrop: true,
    consume: {
      cure: true,
      resistance: { status: "curse", multiplier: 0.5, duration: 15 },
      cooldownGroup: "recovery",
      cooldown: 18,
    },
    desc: "Cleanse and reduce incoming curse duration for 15 seconds.",
  },
  {
    id: "aegean_antitoxin",
    name: "Hydra Antitoxin",
    type: "consumable",
    icon: "potion_buff",
    rarity: "epic",
    level: 86,
    value: 1000,
    stats: {},
    stackable: true,
    noDrop: true,
    consume: {
      cure: true,
      resistance: { status: "poison", multiplier: 0.5, duration: 15 },
      cooldownGroup: "recovery",
      cooldown: 18,
    },
    desc: "Cleanse poison and reduce further poison duration for 15 seconds.",
  },
  {
    id: "aegean_golden_apple",
    name: "Golden-Apple Preparation",
    type: "consumable",
    icon: "food_apple",
    metal: IVORY,
    rarity: "legendary",
    level: 97,
    value: 2600,
    stats: {},
    stackable: true,
    noDrop: true,
    consume: {
      healthPct: 0.48,
      stamina: 90,
      cooldownGroup: "recovery",
      cooldown: 25,
    },
    desc: "Restores 48% health and 90 stamina. Shares the recovery cooldown.",
  },
];
export const AEGEAN_ITEMS = [
  ...AEGEAN_GEAR,
  ...AEGEAN_MATERIALS,
  ...AEGEAN_CONSUMABLES,
];

const bundle = (id: string, count: number): string[] =>
  Array.from({ length: count }, () => id);
const reward = (
  level: number,
  items: string[] = [],
  flags: string[] = [],
): AegeanReward => ({
  xp: Math.round(level * level * 8),
  gold: Math.round(level * 1050),
  items,
  flags,
});
export const AEGEAN_REWARDS: Record<string, AegeanReward> = {
  aegean_veteran_trial: reward(76, [
    "aegean_dory_dawn",
    ...bundle("aegean_bronze", 6),
  ]),
  aegean_nemea: reward(
    82,
    ["aegean_kopis_nemea", ...bundle("aegean_resin", 6)],
    ["aegean:fitting:boarding_screen"],
  ),
  aegean_hydra: reward(89, [
    "aegean_hydra_fang",
    "aegean_antitoxin",
    ...bundle("aegean_resin", 6),
  ]),
  aegean_hind: reward(
    84,
    ["aegean_artemis_bow"],
    ["aegean:utility:artemis_trail"],
  ),
  aegean_boar: reward(92, [
    "aegean_erymanthian_hide",
    ...bundle("aegean_bronze", 12),
  ]),
  aegean_augeas: reward(86, bundle("aegean_bronze", 12), [
    "aegean:utility:cleansing_wells",
  ]),
  aegean_birds: reward(
    90,
    ["aegean_stymphalian_recurve"],
    ["aegean:fitting:signal_gong"],
  ),
  aegean_bull: reward(93, bundle("aegean_bronze", 10), [
    "aegean:fitting:bullhorn_ram",
  ]),
  aegean_mares: reward(
    94,
    ["aegean_ambrosia", ...bundle("aegean_resin", 10)],
    ["aegean:utility:tether"],
  ),
  aegean_hippolyta: reward(
    94,
    ["aegean_amazon_girdle"],
    ["aegean:utility:command"],
  ),
  aegean_geryon: reward(
    95,
    ["aegean_geryon_pick"],
    ["aegean:utility:provision_hold"],
  ),
  aegean_hesperides: reward(
    97,
    ["aegean_atlas_star", "aegean_golden_apple"],
    ["aegean:component:sail"],
  ),
  aegean_cerberus: reward(
    98,
    ["aegean_stygian_raiment", ...bundle("aegean_stygian_glass", 12)],
    ["aegean:component:keel"],
  ),
  aegean_python: reward(88, ["aegean_delphic_staff"]),
  aegean_medusa: reward(
    94,
    ["aegean_clear_mind_aegis"],
    ["aegean:fitting:lookout_lens"],
  ),
  aegean_minotaur: reward(
    94,
    ["aegean_labyrinth_labrys", "aegean_ariadne_thread"],
    ["aegean:fitting:recovery_line"],
  ),
  aegean_chimera: reward(94, bundle("aegean_resin", 16)),
  aegean_cyclops: reward(88, ["aegean_quarry_answer"]),
  aegean_talos: reward(
    96,
    ["aegean_talos_heart"],
    ["aegean:fitting:bronze_heart"],
  ),
  aegean_scylla: reward(98, ["aegean_returning_tide_crown"]),
  aegean_titan: reward(98, [
    "aegean_prometheus_chains",
    ...bundle("aegean_stygian_glass", 16),
  ]),
  aegean_army: {
    ...reward(100, ["aegean_aspis_sparta", ...bundle("aegean_bronze", 24)]),
    gold: 300000,
    flags: ["aegean:harbour:released"],
  },
  aegean_sanctuary_aegis: reward(100, [
    "aegean_last_dawn_mirror",
    ...bundle("aegean_oathsteel", 6),
  ]),
  aegean_sanctuary_forge: reward(100, [
    "aegean_oathforged_panoply",
    ...bundle("aegean_oathsteel", 6),
  ]),
  aegean_sanctuary_names: reward(100, [
    "aegean_first_oath_ember",
    ...bundle("aegean_oathsteel", 6),
  ]),
  aegean_champion_spear: reward(100, bundle("aegean_oathsteel", 8), [
    "aegean:shortcut:broken_oars",
  ]),
  aegean_champion_shield: reward(100, bundle("aegean_oathsteel", 8), [
    "aegean:shortcut:cypress_vale",
  ]),
  aegean_champion_hunt: reward(100, bundle("aegean_oathsteel", 8), [
    "aegean:shortcut:red_ravine",
  ]),
  aegean_champion_volley: reward(100, bundle("aegean_oathsteel", 8), [
    "aegean:shortcut:necropolis",
  ]),
  aegean_champion_guard: reward(100, bundle("aegean_oathsteel", 8), [
    "aegean:shortcut:barracks",
  ]),
  aegean_champion_storm: reward(100, bundle("aegean_oathsteel", 8), [
    "aegean:shortcut:sky_stair",
  ]),
  aegean_leonidas: {
    xp: 150000,
    gold: 500000,
    choice: AEGEAN_LEONIDAS_CHOICES,
    flags: ["aegean:title:unbroken", "aegean:realm:restored"],
  },
  aegean_storm_altar: reward(92, ["aegean_thunder_javelins"]),
  aegean_forge_measure: reward(91, ["aegean_hephaestus_measure"]),
  aegean_crossroads: reward(91, ["aegean_crossroads_tablets"]),
};

/** Repeat rewards cannot reproduce a first-clear royal choice or progression seal. */
export const AEGEAN_REPEAT_REWARDS: Record<string, AegeanReward> =
  Object.fromEntries(
    Object.keys(AEGEAN_REWARDS).map((id) => [
      id,
      {
        xp: 4000,
        gold: id === "aegean_leonidas" ? 65000 : 12000,
        items:
          id === "aegean_leonidas"
            ? ["aegean_kings_catalyst", ...bundle("aegean_oathsteel", 6)]
            : id.startsWith("aegean_champion_") ||
                id.startsWith("aegean_sanctuary_")
              ? bundle("aegean_oathsteel", 3)
              : bundle(
                  id === "aegean_cerberus" || id === "aegean_titan"
                    ? "aegean_stygian_glass"
                    : "aegean_bronze",
                  3,
                ),
      },
    ]),
  );

const recipe = (
  item: string,
  name: string,
  source: string,
  tier: "baseline" | "olympian" | "primordial" = "olympian",
): AegeanRecipe => ({
  id: `aegean_recipe_${item}`,
  name,
  item: `aegean_${item}`,
  gold: tier === "primordial" ? 300000 : tier === "baseline" ? 45000 : 95000,
  materials:
    tier === "primordial"
      ? [
          { id: "aegean_oathsteel", count: 14 },
          { id: "aegean_stygian_glass", count: 6 },
        ]
      : [
          { id: "aegean_bronze", count: 8 },
          { id: "aegean_resin", count: 4 },
        ],
  requires: [source],
  islandOnly: tier === "primordial",
  station:
    tier === "primordial" ? "oath" : tier === "baseline" ? "forge" : "divine",
});
export const AEGEAN_RECIPES: AegeanRecipe[] = [
  recipe("dory_dawn", "Dory of the Dawn", "aegean_veteran_trial", "baseline"),
  recipe("kopis_nemea", "Kopis of the Nemean Hunt", "aegean_nemea"),
  recipe("nemean_mantle", "Nemean Mantle", "aegean_nemea"),
  recipe("hydra_fang", "Hydra's Last Fang", "aegean_hydra"),
  recipe("artemis_bow", "Artemis's Silver Bow", "aegean_hind"),
  recipe("thunder_javelins", "Thunder Javelins", "aegean_storm_altar"),
  recipe("hephaestus_measure", "Hephaestus's Measure", "aegean_forge_measure"),
  recipe("delphic_staff", "Staff of the Delphic Breath", "aegean_python"),
  recipe("prometheus_chains", "Chains of Prometheus", "aegean_titan"),
  recipe("labyrinth_labrys", "Labrys of the Labyrinth", "aegean_minotaur"),
  recipe("geryon_pick", "Geryon's Threefold Pick", "aegean_geryon"),
  recipe("quarry_answer", "Quarry's Answer", "aegean_cyclops", "baseline"),
  recipe("stymphalian_recurve", "Stymphalian Recurve", "aegean_birds"),
  recipe("aspis_sparta", "Aspis of Sparta", "aegean_veteran_trial", "baseline"),
  recipe("drowned_lyre", "Lyre of the Drowned", "aegean_story_theatre"),
  recipe("clear_mind_aegis", "Aegis of the Clear Mind", "aegean_medusa"),
  recipe(
    "crossroads_tablets",
    "Tablets of the Crossroads",
    "aegean_crossroads",
  ),
  recipe(
    "returning_lantern",
    "Lantern of the Returning Soul",
    "aegean_story_soldier",
  ),
  recipe("talos_heart", "Heart of Talos", "aegean_talos"),
  recipe("erymanthian_hide", "Erymanthian Hide", "aegean_boar"),
  recipe("amazon_girdle", "Girdle of the Amazon Queen", "aegean_hippolyta"),
  recipe("stygian_raiment", "Stygian Raiment", "aegean_cerberus"),
  recipe("ariadne_thread", "Thread of Ariadne", "aegean_minotaur"),
  recipe("atlas_star", "Atlas's Last Star", "aegean_hesperides"),
  recipe("orphic_seal", "Orphic Seal", "aegean_story_winter"),
  recipe(
    "returning_tide_crown",
    "Crown of the Returning Tide",
    "aegean_scylla",
  ),
  recipe(
    "last_dawn_mirror",
    "Mirror of the Last Dawn",
    "aegean_sanctuary_aegis",
    "primordial",
  ),
  recipe(
    "last_companion_aspis",
    "Aspis of the Last Companion",
    "aegean_sanctuary_aegis",
    "primordial",
  ),
  recipe(
    "oathforged_panoply",
    "Oathforged Panoply",
    "aegean_sanctuary_forge",
    "primordial",
  ),
  recipe(
    "first_oath_ember",
    "Ember of the First Oath",
    "aegean_sanctuary_names",
    "primordial",
  ),
  ...AEGEAN_LEONIDAS_CHOICES.map((id) => ({
    ...recipe(
      id.slice(7),
      AEGEAN_GEAR.find((item) => item.id === id)!.name,
      "aegean_leonidas",
      "primordial",
    ),
    materials: [
      { id: "aegean_kings_catalyst", count: 1 },
      { id: "aegean_oathsteel", count: 14 },
    ],
  })),
  {
    id: "aegean_recipe_storm_ribs",
    name: "A Hull That Holds",
    item: "aegean_storm_ribs",
    gold: 80000,
    materials: [{ id: "aegean_bronze", count: 16 }],
    requires: ["aegean_augeas", "aegean_boar"],
    islandOnly: false,
    station: "forge",
    flag: "aegean:component:ribs",
  },
  ...AEGEAN_CONSUMABLES.map(
    (item, index): AegeanRecipe => ({
      id: `aegean_recipe_${item.id.slice(7)}`,
      name: item.name,
      item: item.id,
      gold: [1200, 1800, 1500, 3500][index],
      materials: [{ id: "aegean_resin", count: index === 3 ? 3 : 1 }],
      requires: [
        [],
        ["aegean_python"],
        ["aegean_hydra"],
        ["aegean_hesperides"],
      ][index],
      islandOnly: false,
      station: "forge",
    }),
  ),
];

export const AEGEAN_SHIPS: AegeanShip[] = [
  {
    id: "aegean_skiff",
    name: "Coastal Skiff",
    cost: 35000,
    hull: 320,
    speed: 220,
    turn: 3.2,
    slots: { combat: 0, utility: 1 },
    requirements: [],
    stormRating: 0,
    cargo: 6,
    draft: "shallow",
    ram: false,
    description: "Nimble in coves, fragile offshore.",
  },
  {
    id: "aegean_roundship",
    name: "Merchant Roundship",
    cost: 180000,
    hull: 780,
    speed: 165,
    turn: 1.7,
    slots: { combat: 0, utility: 2 },
    requirements: [],
    stormRating: 1,
    cargo: 20,
    draft: "deep",
    ram: false,
    description: "Strong provision capacity for charted routes.",
  },
  {
    id: "aegean_trireme",
    name: "War Trireme",
    cost: 480000,
    hull: 1150,
    speed: 235,
    turn: 2.2,
    slots: { combat: 1, utility: 1 },
    requirements: ["aegean_bull"],
    stormRating: 2,
    cargo: 10,
    draft: "deep",
    ram: true,
    description: "A bronze ram and strong boarding defence.",
  },
  {
    id: "aegean_stormbreaker",
    name: "Stormbreaker",
    cost: 1400000,
    hull: 1900,
    speed: 250,
    turn: 2.35,
    slots: { combat: 2, utility: 1 },
    requirements: [
      "aegean_army",
      "aegean:component:ribs",
      "aegean:component:sail",
      "aegean:component:keel",
    ],
    stormRating: 3,
    cargo: 14,
    draft: "deep",
    ram: true,
    description:
      "The only hull certified for the oath storm; monsters remain dangerous.",
  },
];

export const AEGEAN_FITTINGS = [
  {
    id: "aegean:fitting:bullhorn_ram",
    name: "Bullhorn Ram",
    slot: "combat",
    source: "aegean_bull",
    cost: 65000,
    effect: { ramDamage: 0.25 },
  },
  {
    id: "aegean:fitting:bronze_heart",
    name: "Bronze-Heart Stabilizer",
    slot: "utility",
    source: "aegean_talos",
    cost: 90000,
    effect: { impactReduction: 0.15 },
  },
  {
    id: "aegean:fitting:signal_gong",
    name: "Stymphalian Signal Gong",
    slot: "utility",
    source: "aegean_birds",
    cost: 40000,
    effect: { flyingThreatDelay: 3 },
  },
  {
    id: "aegean:fitting:boarding_screen",
    name: "Nemean Boarding Screen",
    slot: "combat",
    source: "aegean_nemea",
    cost: 45000,
    effect: { boardingDamageReduction: 0.15 },
  },
  {
    id: "aegean:fitting:lookout_lens",
    name: "Gorgon Lookout Lens",
    slot: "utility",
    source: "aegean_medusa",
    cost: 55000,
    effect: { warningRange: 120 },
  },
  {
    id: "aegean:fitting:recovery_line",
    name: "Ariadne Recovery Line",
    slot: "utility",
    source: "aegean_minotaur",
    cost: 25000,
    effect: { wreckCostReduction: 0.2 },
  },
] as const;

/** The provenance validator is shared by reward claims, crafting, saves and debug tools. */
export const AEGEAN_ISLAND_ITEM_SOURCES: Record<string, string[]> = {
  aegean_last_dawn_mirror: [
    "aegean_sanctuary_aegis",
    "aegean_recipe_last_dawn_mirror",
  ],
  aegean_last_companion_aspis: ["aegean_recipe_last_companion_aspis"],
  aegean_oathforged_panoply: [
    "aegean_sanctuary_forge",
    "aegean_recipe_oathforged_panoply",
  ],
  aegean_first_oath_ember: [
    "aegean_sanctuary_names",
    "aegean_recipe_first_oath_ember",
  ],
  ...Object.fromEntries(
    AEGEAN_LEONIDAS_CHOICES.map((id) => [
      id,
      ["aegean_leonidas", `aegean_recipe_${id.slice(7)}`],
    ]),
  ),
  aegean_oathsteel: [
    "aegean_sanctuary_aegis",
    "aegean_sanctuary_forge",
    "aegean_sanctuary_names",
    "aegean_champion_spear",
    "aegean_champion_shield",
    "aegean_champion_hunt",
    "aegean_champion_volley",
    "aegean_champion_guard",
    "aegean_champion_storm",
    "aegean_leonidas",
  ],
  aegean_kings_catalyst: ["aegean_leonidas"],
};
