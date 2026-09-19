import type { Stats } from "../items/types";
export interface Mastery {
  id: string;
  level: number;
  name: string;
  description: string;
  stats: Stats;
}
export const MASTERIES: Mastery[] = [
  {
    id: "vigor",
    level: 80,
    name: "Heracles’ Vigor",
    description: "+14% maximum health.",
    stats: {},
  },
  {
    id: "clarity",
    level: 80,
    name: "Athena’s Clarity",
    description: "+15% maximum mana and +3 mana regeneration.",
    stats: { manaRegen: 3 },
  },
  {
    id: "stride",
    level: 80,
    name: "Hermes’ Stride",
    description: "+12 movement speed and +25 stamina.",
    stats: { moveSpeed: 12, maxStamina: 25 },
  },
  {
    id: "bronze",
    level: 85,
    name: "Living Bronze",
    description: "+70 defense.",
    stats: { defense: 70 },
  },
  {
    id: "hunter",
    level: 85,
    name: "Hunter’s Patience",
    description: "+7% critical chance.",
    stats: { critChance: 7 },
  },
  {
    id: "wisdom",
    level: 85,
    name: "Delphic Wisdom",
    description: "+35 ability power.",
    stats: { abilityPower: 35 },
  },
  {
    id: "resolve",
    level: 90,
    name: "Unbroken Resolve",
    description: "Bracing costs half as much stamina.",
    stats: {},
  },
  {
    id: "reserves",
    level: 90,
    name: "Deep Reserves",
    description: "+5 stamina and +3 mana regeneration.",
    stats: { staminaRegen: 5, manaRegen: 3 },
  },
  {
    id: "edge",
    level: 90,
    name: "Hero’s Edge",
    description: "+20 to strength, dexterity and intelligence.",
    stats: { strength: 20, dexterity: 20, intelligence: 20 },
  },
  {
    id: "mercy",
    level: 95,
    name: "Persephone’s Mercy",
    description: "+18% maximum health.",
    stats: {},
  },
  {
    id: "fury",
    level: 95,
    name: "Ares’ Focus",
    description: "+25% critical damage.",
    stats: { critDamage: 25 },
  },
  {
    id: "tide",
    level: 95,
    name: "Poseidon’s Endurance",
    description: "+50 stamina and +30 defense.",
    stats: { maxStamina: 50, defense: 30 },
  },
  {
    id: "steadfast",
    level: 100,
    name: "Last One Standing",
    description: "+100 defense and +10 vitality.",
    stats: { defense: 100, vitality: 10 },
  },
  {
    id: "ascendant",
    level: 100,
    name: "Ascendant Will",
    description: "+50 ability power and +30 intelligence.",
    stats: { abilityPower: 50, intelligence: 30 },
  },
  {
    id: "hero",
    level: 100,
    name: "A Mortal’s Defiance",
    description: "+30 strength, +30 dexterity and +5% critical chance.",
    stats: { strength: 30, dexterity: 30, critChance: 5 },
  },
];
