import { PAL } from '../art/palette';
import type { StatKey } from './types';

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

/** Authored powers are deliberately outside the random EFFECTS pool. */
export type AegeanPowerEvent = 'active' | 'brace' | 'dodge' | 'stagger' | 'interrupt' | 'hazardExit' | 'hit';
export type AegeanPowerAction =
  | { type: 'damage'; shape: 'line' | 'arc' | 'nova' | 'chain'; multiplier: number; range: number; targets?: number; status?: 'poison' | 'burn' | 'slow'; duration?: number; stacks?: number }
  | { type: 'restore'; resource: 'health' | 'mana' | 'stamina'; amount: number; percent?: number }
  | { type: 'buff'; stat: StatKey; amount: number; duration: number }
  | { type: 'ward'; reduction: number; duration: number; reflect?: boolean }
  | { type: 'mark'; duration: number; bonus: number }
  | { type: 'move'; mode: 'markReturn' | 'retreat' | 'gatherAllies'; range: number; duration: number }
  | { type: 'cleanse'; status: 'petrify' | 'fear' | 'poison' | 'curse' | 'slow' }
  | { type: 'displace'; distance: number; range: number; bossScale: number }
  | { type: 'projectileWard'; duration: number; multiplier: number }
  | { type: 'field'; radius: number; duration: number; mana?: number; health?: number; damageReduction?: number }
  | { type: 'cycle'; manaCost: number; patterns: Array<{ shape: 'line' | 'arc' | 'nova'; multiplier: number; range: number }> };
export interface AegeanPowerDef {
  id: string;
  name: string;
  trigger: AegeanPowerEvent;
  cooldown: number;
  /** The event earns a finite active window; a normal activation cannot fake the event. */
  requiresEvent?: Exclude<AegeanPowerEvent, 'active'>;
  window?: number;
  charges?: number;
  condition?: 'marked' | 'exposed' | 'alternatingRange' | 'threeOpenings' | 'reach';
  /** Primordial arts always work; a real opening strengthens their damage. */
  empowerEvent?: Exclude<AegeanPowerEvent, 'active'>;
  empowerCondition?: 'alternatingRange';
  empowerMultiplier?: number;
  actions: AegeanPowerAction[];
}
const power = (id: string, name: string, trigger: AegeanPowerEvent, cooldown: number, actions: AegeanPowerAction[], extra: Partial<AegeanPowerDef> = {}): AegeanPowerDef => ({ id, name, trigger, cooldown, actions, ...extra });
const strike = (shape: 'line' | 'arc' | 'nova' | 'chain', multiplier: number, range: number): AegeanPowerAction => ({ type: 'damage', shape, multiplier, range });
const ward = (reduction: number, duration: number): AegeanPowerAction => ({ type: 'ward', reduction, duration });
const restore = (resource: 'health' | 'mana' | 'stamina', amount: number): AegeanPowerAction => ({ type: 'restore', resource, amount });
const AEGEAN_POWER_LIST: AegeanPowerDef[] = [
  power('aegean_spacing', 'Dawn Measure', 'active', 9, [{ type: 'mark', duration: 5, bonus: .18 }, strike('line', 1.45, 112)], { condition: 'reach' }),
  power('aegean_hunt_counter', 'Nemean Counter', 'active', 10, [strike('arc', 1.9, 88), { type: 'buff', stat: 'critChance', amount: 12, duration: 3 }], { requiresEvent: 'dodge', window: 5 }),
  power('aegean_hydra_venom', 'Last Venom', 'active', 11, [{ type: 'damage', shape: 'line', multiplier: 1.25, range: 72, status: 'poison', duration: 5, stacks: 3 }], { condition: 'exposed' }),
  power('aegean_hunt_mark', 'Silver Quarry', 'active', 12, [{ type: 'mark', duration: 6, bonus: .28 }, strike('line', 1.6, 440)]),
  power('aegean_javelin_recall', 'Recall the Thunder', 'active', 11, [strike('line', 1.8, 310), restore('stamina', 20)], { charges: 3 }),
  power('aegean_forge_shock', 'The Smith’s Measure', 'active', 12, [strike('nova', 1.45, 115)], { requiresEvent: 'stagger', window: 5 }),
  power('aegean_oracle_field', 'Delphic Breath', 'active', 15, [{ type: 'field', radius: 85, duration: 5, mana: 30 }, strike('line', 1.1, 300)]),
  power('aegean_chain_retreat', 'Promethean Recoil', 'active', 10, [strike('arc', 1.7, 142), { type: 'move', mode: 'retreat', range: 60, duration: .25 }], { condition: 'alternatingRange' }),
  power('aegean_tether_sever', 'Cut the Labyrinth', 'active', 14, [strike('arc', 2.3, 108)], { requiresEvent: 'interrupt', window: 6 }),
  power('aegean_threefold', 'Threefold Breach', 'active', 12, [strike('line', 2.2, 92), { type: 'mark', duration: 4, bonus: .22 }], { condition: 'threeOpenings', charges: 3 }),
  power('aegean_quarry_crush', 'The Quarry Answers', 'active', 15, [strike('nova', 1.85, 94)], { requiresEvent: 'stagger', window: 6 }),
  power('aegean_bronze_ricochet', 'Bronze Return', 'active', 10, [{ type: 'mark', duration: 5, bonus: .1 }, { type: 'damage', shape: 'chain', multiplier: 1.4, range: 320, targets: 2 }]),
  power('aegean_royal_counter', 'Royal Counter', 'active', 8, [strike('line', 4.5, 220), ward(.4, 4), restore('stamina', 55)], { empowerEvent: 'brace', window: 6, empowerMultiplier: 1.5 }),
  power('aegean_dawn_pursuit', 'The Last Pursuit', 'active', 8, [strike('arc', 4.2, 155), { type: 'buff', stat: 'moveSpeed', amount: 45, duration: 5 }, { type: 'buff', stat: 'critDamage', amount: 70, duration: 5 }, ward(.35, 4)], { empowerEvent: 'interrupt', window: 7, empowerMultiplier: 1.5 }),
  power('aegean_storm_shot', 'Storm-Cleared Sky', 'active', 9, [{ type: 'damage', shape: 'line', multiplier: 5.2, range: 740, targets: 8 }, { type: 'mark', duration: 8, bonus: .3 }]),
  power('aegean_flame_cycle', 'Three First Flames', 'active', 6, [{ type: 'cycle', manaCost: 24, patterns: [{ shape: 'line', multiplier: 5, range: 620 }, { shape: 'arc', multiplier: 4.6, range: 300 }, { shape: 'nova', multiplier: 4.2, range: 220 }] }]),
  power('aegean_oath_combo', 'Twin Oath', 'active', 8, [strike('arc', 4.2, 220), restore('stamina', 65), ward(.3, 3)], { empowerCondition: 'alternatingRange', charges: 3, empowerMultiplier: 1.5 }),
  power('aegean_standard_stance', 'Stand Unbroken', 'active', 12, [strike('nova', 4.5, 230), { type: 'field', radius: 190, duration: 7, damageReduction: .4 }, { type: 'move', mode: 'gatherAllies', range: 300, duration: 7 }, restore('stamina', 75), restore('mana', 60)]),
  power('aegean_aspis_brace', 'Spartan Economy', 'active', 12, [ward(.3, 2), restore('stamina', 22)], { requiresEvent: 'brace', window: 5 }),
  power('aegean_lyre_pulse', 'Quiet the Volley', 'active', 16, [{ type: 'projectileWard', duration: 3, multiplier: .5 }, restore('mana', 18)]),
  power('aegean_clear_mind', 'Clear Mind', 'active', 15, [{ type: 'cleanse', status: 'petrify' }, ward(.2, 3)], { requiresEvent: 'brace', window: 5 }),
  power('aegean_spirit_passage', 'The Shortest Road', 'active', 16, [{ type: 'move', mode: 'gatherAllies', range: 240, duration: 4 }, restore('mana', 24)]),
  power('aegean_soul_lantern', 'Returning Light', 'active', 20, [{ type: 'field', radius: 85, duration: 6, health: .14 }]),
  power('aegean_talos_heat', 'Stored Sun', 'active', 16, [{ type: 'damage', shape: 'nova', multiplier: 1.6, range: 120, status: 'burn', duration: 3 }], { requiresEvent: 'brace', window: 6, charges: 1 }),
  power('aegean_mirror_counter', 'Last Dawn Reflection', 'active', 12, [{ type: 'ward', reduction: .4, duration: 5, reflect: true }, strike('nova', 3, 190), { type: 'buff', stat: 'abilityPower', amount: 65, duration: 6 }, { type: 'cleanse', status: 'petrify' }], { empowerEvent: 'brace', window: 6, empowerMultiplier: 1.5 }),
  power('aegean_companion_guard', 'The Last Companion', 'active', 12, [ward(.4, 5), strike('line', 4.5, 210), { type: 'restore', resource: 'health', amount: 0, percent: .15 }, restore('stamina', 70)], { empowerEvent: 'brace', window: 6, empowerMultiplier: 1.5 }),
  power('aegean_mantle_resolve', 'Nemean Resolve', 'brace', 9, [restore('stamina', 16)]),
  power('aegean_boar_resolve', 'Erymanthian Resolve', 'brace', 12, [{ type: 'cleanse', status: 'slow' }, ward(.18, 3)]),
  power('aegean_amazon_discipline', 'Amazon Discipline', 'dodge', 10, [restore('stamina', 14), { type: 'move', mode: 'gatherAllies', range: 110, duration: 2 }]),
  power('aegean_stygian_escape', 'Stygian Escape', 'hazardExit', 12, [{ type: 'cleanse', status: 'fear' }, ward(.22, 3)]),
  power('aegean_oath_guard', 'One Unbroken Guard', 'brace', 8, [ward(.4, 4), { type: 'restore', resource: 'health', amount: 0, percent: .08 }, restore('stamina', 45), { type: 'cleanse', status: 'slow' }]),
  power('aegean_ariadne_return', 'Ariadne’s Return', 'active', 20, [{ type: 'move', mode: 'markReturn', range: 160, duration: 4 }]),
  power('aegean_atlas_relief', 'A Moment Unburdened', 'active', 22, [ward(.28, 4), restore('stamina', 35), restore('mana', 20)], { requiresEvent: 'dodge', window: 6 }),
  power('aegean_orphic_rally', 'The Gathering Song', 'active', 20, [{ type: 'move', mode: 'gatherAllies', range: 300, duration: 5 }, ward(.2, 4), restore('health', 80)]),
  power('aegean_tide_wave', 'The Returning Tide', 'active', 20, [strike('nova', 1.2, 150), { type: 'displace', distance: 80, range: 150, bossScale: 0 }, ward(.2, 3)]),
  power('aegean_ember_oath', 'First Oath', 'active', 14, [{ type: 'damage', shape: 'nova', multiplier: 4, range: 230, status: 'burn', duration: 5 }, { type: 'buff', stat: 'abilityPower', amount: 100, duration: 7 }, ward(.4, 6), restore('mana', 100), restore('stamina', 100)], { empowerEvent: 'interrupt', window: 7, empowerMultiplier: 1.5 }),
];
export const AEGEAN_POWERS: Record<string, AegeanPowerDef> = Object.fromEntries(AEGEAN_POWER_LIST.map(def => [def.id, def]));
