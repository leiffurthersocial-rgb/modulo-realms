import { PAL } from '../art/palette';

export type EffectTrigger = 'onHit' | 'onCrit' | 'onKill' | 'onDamaged' | 'passive';

export interface EffectDef {
  id: string;
  name: string;
  desc: string;
  trigger: EffectTrigger;
  /** Proc chance 0..1 (ignored for passives). */
  chance: number;
  power: number;
  color: string;
  /** Minimum item level before this effect can roll on generated loot. */
  minLevel: number;
}

export const EFFECTS: EffectDef[] = [
  { id: 'burning_edge', name: 'Burning Edge', desc: 'Attacks have a chance to set the target alight, burning it over time.', trigger: 'onHit', chance: 0.22, power: 0.5, color: PAL.flame, minLevel: 3 },
  { id: 'frostbite', name: 'Frostbite', desc: 'Attacks have a chance to chill enemies, slowing them for 3s.', trigger: 'onHit', chance: 0.25, power: 0.45, color: PAL.frost, minLevel: 3 },
  { id: 'venomous', name: 'Venomous', desc: 'Attacks have a chance to poison the target for 6s.', trigger: 'onHit', chance: 0.25, power: 0.35, color: PAL.toxic, minLevel: 2 },
  { id: 'vampiric', name: 'Vampiric', desc: 'Critical hits heal you for 25% of the damage dealt.', trigger: 'onCrit', chance: 1, power: 0.25, color: PAL.blood, minLevel: 5 },
  { id: 'sunflare', name: 'Sunflare', desc: 'Critical hits release a burst of holy light around the target.', trigger: 'onCrit', chance: 0.5, power: 0.8, color: PAL.holy, minLevel: 8 },
  { id: 'earthshaker', name: 'Earthshaker', desc: 'Critical hits send out a shockwave that staggers nearby enemies.', trigger: 'onCrit', chance: 0.4, power: 0.7, color: PAL.clay, minLevel: 8 },
  { id: 'stormcaller', name: 'Stormcaller', desc: 'Attacks sometimes call lightning that arcs between enemies.', trigger: 'onHit', chance: 0.14, power: 1.1, color: '#8fd0f0', minLevel: 10 },
  { id: 'echo', name: 'Echoing Shot', desc: 'Attacks sometimes fire a second spectral projectile.', trigger: 'onHit', chance: 0.2, power: 0.6, color: PAL.arcaneLit, minLevel: 6 },
  { id: 'spiritcall', name: 'Spirit Call', desc: 'Kills may summon a bound spirit that fights beside you for 15s.', trigger: 'onKill', chance: 0.14, power: 1, color: PAL.frost, minLevel: 12 },
  { id: 'flowstate', name: 'Flow State', desc: 'Each kill reduces all ability cooldowns by 1s.', trigger: 'onKill', chance: 1, power: 1, color: PAL.arcaneLit, minLevel: 6 },
  { id: 'swiftstep', name: 'Swiftstep', desc: 'Kills grant a burst of movement speed for 4s.', trigger: 'onKill', chance: 1, power: 0.3, color: PAL.grassPale, minLevel: 4 },
  { id: 'goldtouch', name: "Miser's Touch", desc: 'Enemies drop 40% more gold.', trigger: 'passive', chance: 1, power: 0.4, color: PAL.gold, minLevel: 4 },
  { id: 'thorns', name: 'Thornmail', desc: 'Reflects 25% of melee damage back at the attacker.', trigger: 'onDamaged', chance: 1, power: 0.25, color: PAL.rot, minLevel: 6 },
  { id: 'soulbind', name: 'Soulbound', desc: 'A chance to completely negate incoming damage.', trigger: 'onDamaged', chance: 0.14, power: 1, color: PAL.arcane, minLevel: 10 },
  { id: 'windward', name: 'Windward', desc: 'Grants a 12% chance to dodge attacks entirely.', trigger: 'passive', chance: 0.12, power: 1, color: PAL.foam, minLevel: 7 },
  { id: 'emberburst', name: 'Ember Burst', desc: 'After attacking, a cinder erupts beneath your target.', trigger: 'onHit', chance: 0.18, power: 0.9, color: PAL.ember, minLevel: 9 },
];

export const EFFECT_BY_ID: Record<string, EffectDef> = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));
