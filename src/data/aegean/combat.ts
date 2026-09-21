import type { BossAttack, EnemyDef } from '../enemies';

// Every Greek move is a bodily action or a visible object released by its owner.
// The old ring/cross/echo names remain stable as kit keys for saved content only.
const move = (id: string, name: string, shape: BossAttack['shape'], over: Partial<BossAttack> = {}): BossAttack => ({
  id, name, shape, windup: .78, cooldown: 4.4, power: 1.15, radius: 82,
  range: 300, element: 'physical', color: '#d8b26a', physical: 'claw', ...over,
});
const venom = { element: 'poison' as const, color: '#94bd6d' };
const storm = { element: 'arcane' as const, color: '#a4c7dd' };
const shade = { element: 'shadow' as const, color: '#a59bbd' };
const fire = { element: 'fire' as const, color: '#de914e' };
export const MYTH_ATTACKS = {
  pounce: move('pounce', 'Pounce', 'leap', { radius: 38, range: 245, windup: .78, physical: 'claw' }),
  rend: move('rend', 'Raking claws', 'cone', { radius: 96, windup: .68, physical: 'claw' }),
  charge: move('charge', 'Charging horns', 'dash', { range: 300, windup: .9, power: 1.45, physical: 'fang' }),
  tusks: move('tusks', 'Tusk rush', 'dash', { range: 180, windup: .8, physical: 'fang' }),
  antlers: move('antlers', 'Antler sweep', 'cone', { radius: 112, windup: .82, physical: 'fang' }),
  root: move('root', 'Thrown root tangle', 'projectile', { ...venom, radius: 16, range: 335, projectileSpeed: 215, count: 1, physical: 'tendril', projectileSprite: 'net', status: { kind: 'chill', power: .28, duration: 1.6 } }),
  seed: move('seed', 'Thorn seeds', 'projectile', { ...venom, count: 3, spread: .6, projectileSpeed: 250, radius: 10, physical: 'tendril', projectileSprite: 'fang' }),
  blade: move('blade', 'Double cut', 'cone', { radius: 89, swings: 2, windup: .75, physical: 'blade' }),
  music: move('music', 'Piper notes', 'projectile', { ...shade, count: 2, spread: .42, projectileSpeed: 195, radius: 12, range: 380, windup: 1, physical: 'spit', projectileSprite: 'note' }),
  embers: move('embers', 'Thrown embers', 'projectile', { ...fire, count: 3, spread: .65, radius: 11, projectileSpeed: 245, physical: 'spit', projectileSprite: 'ember' }),
  hooves: move('hooves', 'Rearing hoof kick', 'cone', { radius: 90, windup: .9, physical: 'hoof' }),
  arrows: move('arrows', 'Drawn bow', 'projectile', { count: 3, spread: .65, radius: 10, projectileSpeed: 375, range: 550, windup: .8, physical: 'bow', projectileSprite: 'arrow' }),
  boulder: move('boulder', 'Boulder throw', 'projectile', { radius: 29, count: 1, range: 540, windup: 1.1, power: 1.55, projectileSpeed: 235, physical: 'boulder', projectileSprite: 'boulder' }),
  dive: move('dive', 'Wing dive', 'leap', { radius: 35, range: 295, windup: .82, physical: 'wing' }),
  feathers: move('feathers', 'Flung bronze feathers', 'projectile', { count: 4, spread: 1, radius: 10, projectileSpeed: 295, windup: .88, physical: 'wing', projectileSprite: 'feather' }),
  lightning: move('lightning', 'Storm javelin', 'projectile', { ...storm, radius: 14, range: 480, windup: .95, power: 1.35, projectileSpeed: 350, count: 1, physical: 'spear', projectileSprite: 'spear' }),
  jaws: move('jaws', 'Snapping jaws', 'dash', { ...venom, range: 145, radius: 24, windup: .72, physical: 'fang' }),
  coil: move('coil', 'Tail lash', 'cone', { ...venom, radius: 120, physical: 'tendril', status: { kind: 'chill', power: .25, duration: 1.6 } }),
  spit: move('spit', 'Venom spit', 'projectile', { ...venom, count: 2, spread: .45, radius: 15, projectileSpeed: 285, range: 390, physical: 'spit', projectileSprite: 'venom' }),
  furnace: move('furnace', 'Furnace fireballs', 'projectile', { ...fire, count: 3, spread: .68, radius: 16, projectileSpeed: 245, windup: 1, physical: 'spit', projectileSprite: 'ember' }),
  hammer: move('hammer', 'Overhead hammer', 'cone', { radius: 110, power: 1.55, windup: .95, physical: 'hammer' }),
  spear: move('spear', 'Spear thrust', 'line', { range: 145, radius: 10, windup: .72, physical: 'spear' }),
  shield: move('shield', 'Shield rush', 'dash', { range: 130, power: 1.3, windup: .8, physical: 'shield' }),
  haunt: move('haunt', 'Shade rush', 'leap', { ...shade, range: 210, radius: 30, windup: .9, physical: 'claw', status: { kind: 'curse', power: .2, duration: 3 } }),
  call: move('call', 'Scattered dragon teeth', 'summon', { ...shade, summon: 'aegean_spartoi', count: 2, cooldown: 14, windup: 1.35, physical: 'fang' }),
  lure: move('lure', 'Siren cast-net', 'projectile', { ...shade, count: 1, radius: 19, range: 335, projectileSpeed: 205, power: .8, windup: 1.05, physical: 'tendril', projectileSprite: 'net', status: { kind: 'chill', power: .3, duration: 1.4 } }),
  chains: move('chains', 'Thrown chain-hook', 'projectile', { ...shade, radius: 15, range: 350, windup: .9, projectileSpeed: 260, physical: 'chain', projectileSprite: 'chain', status: { kind: 'chill', power: .3, duration: 1.6 } }),
  breach: move('breach', 'Breaching jaws', 'leap', { ...storm, radius: 42, range: 255, windup: 1, power: 1.4, physical: 'fang' }),
  tide: move('tide', 'Spat seawater', 'projectile', { ...storm, count: 2, spread: .55, radius: 22, range: 355, projectileSpeed: 235, windup: .95, physical: 'spit', projectileSprite: 'venom' }),
  ink: move('ink', 'Ink jets', 'projectile', { ...shade, count: 3, spread: .8, radius: 18, range: 325, projectileSpeed: 210, windup: .95, physical: 'spit', projectileSprite: 'venom' }),
  trident: move('trident', 'Three-pronged throw', 'projectile', { ...storm, count: 3, spread: .4, radius: 13, projectileSpeed: 345, range: 480, physical: 'spear', projectileSprite: 'spear' }),
  web: move('web', 'Thrown silk snare', 'projectile', { radius: 18, range: 320, color: '#dce2ce', projectileSpeed: 205, physical: 'tendril', projectileSprite: 'net', status: { kind: 'chill', power: .35, duration: 1.6 } }),
  riddle: move('riddle', 'Sphinx wing blades', 'projectile', { count: 3, spread: .7, radius: 14, range: 380, projectileSpeed: 275, windup: 1.05, power: 1.35, physical: 'wing', projectileSprite: 'feather' }),
  needles: move('needles', 'Tail needles', 'projectile', { ...venom, count: 4, spread: .95, radius: 9, projectileSpeed: 355, range: 490, windup: .85, physical: 'tendril', projectileSprite: 'fang' }),
  gaze: move('gaze', 'Petrifying stare', 'line', { range: 235, radius: 7, color: '#cee4b4', windup: 1.1, physical: 'gaze', status: { kind: 'chill', power: .45, duration: 1.6 }, power: 1.15 }),
  judgement: move('judgement', 'Fury sickles', 'cone', { ...shade, radius: 100, swings: 2, windup: .9, physical: 'blade' }),
  gust: move('gust', 'Wind-flung feathers', 'projectile', { ...storm, count: 2, spread: .65, radius: 13, range: 390, projectileSpeed: 280, windup: .92, physical: 'wing', projectileSprite: 'feather' }),
  maelstrom: move('maelstrom', 'Tentacle grab', 'line', { ...storm, range: 155, radius: 10, power: 1.1, windup: 1, physical: 'tendril', pull: 165 }),
  howl: move('howl', 'Bellowing breath', 'projectile', { ...shade, count: 2, spread: .55, radius: 14, range: 325, projectileSpeed: 180, windup: 1.05, physical: 'spit', projectileSprite: 'note', status: { kind: 'fear', power: .15, duration: 1.3 } }),
} satisfies Record<string, BossAttack>;
type Move = keyof typeof MYTH_ATTACKS;

const KIT: Record<string, [NonNullable<EnemyDef['combat']>['movement'], number, Move[]]> = {
  hound: ['flank', 2.6, ['pounce', 'rend']], sacred_boar: ['rush', 3.1, ['charge', 'tusks']],
  stag: ['stalk', 2.7, ['antlers', 'charge']], satyr: ['flank', 2.3, ['blade', 'rend']],
  piper: ['orbit', 3.1, ['music', 'seed']], torch_dancer: ['flank', 2.7, ['embers', 'blade']],
  centaur: ['rush', 2.5, ['charge', 'spear']], centaur_bow: ['orbit', 2.8, ['arrows', 'hooves']],
  centaur_elder: ['rush', 3, ['boulder', 'hooves']], harpy: ['flank', 2.8, ['dive', 'rend']],
  storm_harpy: ['orbit', 3.2, ['lightning', 'dive']], bronze_harpy: ['orbit', 2.8, ['feathers', 'arrows']],
  drakon: ['rush', 3, ['jaws', 'charge']], constrictor: ['stalk', 3, ['coil', 'jaws']],
  viper: ['flank', 2.1, ['jaws', 'spit']], talos_shard: ['rush', 3, ['shield', 'furnace']],
  furnace_guardian: ['anchor', 3.1, ['hammer', 'furnace']], automaton: ['rush', 2.8, ['lightning', 'spear', 'shield']],
  hoplite: ['rush', 2.2, ['spear', 'shield']], oath_shade: ['flank', 2.6, ['haunt', 'pounce']],
  burial_priest: ['orbit', 3.6, ['call', 'haunt', 'music']], empousa: ['stalk', 2.8, ['lure', 'blade']],
  kere: ['flank', 2.5, ['dive', 'judgement']], jailer: ['rush', 3, ['chains', 'hammer']],
  serpent: ['rush', 2.7, ['breach', 'jaws']], crab: ['rush', 2.9, ['shield', 'tusks']],
  siren: ['orbit', 3.1, ['lure', 'music', 'trident']], ketos: ['rush', 3.3, ['breach', 'tide']],
  octopus: ['anchor', 3.1, ['maelstrom', 'ink', 'chains']], sea_serpent: ['flank', 3, ['lightning', 'breach', 'jaws']],
  amazon_archer: ['orbit', 2.4, ['arrows', 'dive', 'spear']],
  dryad: ['anchor', 3, ['root', 'seed']], maenad: ['flank', 2, ['blade', 'charge', 'rend']],
  spartoi: ['rush', 2.5, ['spear', 'tusks']], telchine: ['orbit', 2.9, ['hammer', 'trident']],
  hippocampus: ['flank', 2.5, ['charge', 'tide']], nereid: ['orbit', 3, ['tide', 'trident', 'lure']],
  graeae: ['orbit', 3, ['gaze', 'haunt', 'chains']], arachne: ['stalk', 2.7, ['web', 'pounce', 'spit']],
  sphinx: ['stalk', 3.1, ['riddle', 'pounce', 'feathers']], gryphon: ['flank', 2.6, ['dive', 'feathers', 'rend']],
  manticore: ['orbit', 2.7, ['needles', 'pounce', 'coil']], bronze_bull: ['rush', 2.9, ['charge', 'furnace', 'tusks']],
  myrmidon: ['rush', 2.1, ['spear', 'pounce']], lamia: ['stalk', 2.8, ['lure', 'coil', 'spit']],
  erinys: ['flank', 2.5, ['judgement', 'chains', 'dive']], eidolon: ['flank', 2.5, ['haunt', 'lightning']],
  ichthyocentaur: ['flank', 2.6, ['trident', 'charge', 'tide']], laestrygonian: ['rush', 3.4, ['boulder', 'hammer', 'tusks']],
  anemoi: ['orbit', 2.8, ['gust', 'tide', 'feathers']], charybdis_spawn: ['anchor', 3.4, ['maelstrom', 'tide', 'ink']],
  man_eating_mare: ['rush', 2.2, ['pounce', 'hooves', 'rend']], hydra_head: ['anchor', 2.8, ['jaws', 'spit']],
  scylla_head: ['rush', 2.7, ['breach', 'chains', 'rend']],
  army_hoplite: ['rush', 4, ['spear']], army_runner: ['flank', 3.4, ['pounce']], army_javelin: ['orbit', 4, ['arrows']],
  army_shield: ['rush', 4, ['shield']], army_captain: ['rush', 3.5, ['spear', 'shield']],
};
export function mythKit(slug: string): NonNullable<EnemyDef['combat']> {
  const [movement, cadence, names] = KIT[slug] ?? ['rush', 3, ['spear']];
  return { movement, cadence: cadence * 1.22, attacks: names.map(name => ({ ...MYTH_ATTACKS[name], id: `${slug}_${name}` })) };
}

const BOSS_KITS: Record<string, Move[]> = {
  nemea: ['charge', 'pounce', 'rend', 'howl'], hydra: ['spit', 'coil', 'jaws', 'seed'],
  hind: ['antlers', 'charge', 'root', 'pounce'], boar: ['charge', 'tusks', 'hooves', 'boulder'],
  augeas: ['maelstrom', 'tide', 'hammer', 'boulder'], birds: ['feathers', 'dive', 'arrows', 'gust'],
  bull: ['charge', 'furnace', 'tusks', 'hammer'], mares: ['hooves', 'arrows', 'charge', 'pounce'],
  hippolyta: ['spear', 'arrows', 'blade', 'shield'], geryon: ['tusks', 'spear', 'arrows', 'shield'],
  hesperides: ['root', 'furnace', 'coil', 'lightning'], cerberus: ['pounce', 'howl', 'furnace', 'chains'],
  python: ['jaws', 'coil', 'haunt', 'spit'], medusa: ['gaze', 'needles', 'coil', 'haunt'],
  minotaur: ['charge', 'blade', 'tusks', 'hammer'], chimera: ['furnace', 'spit', 'pounce', 'howl'],
  cyclops: ['boulder', 'hammer', 'tusks', 'pounce'], talos: ['furnace', 'hammer', 'lightning', 'shield'],
  scylla: ['chains', 'breach', 'maelstrom', 'jaws'], titan: ['chains', 'lightning', 'hammer', 'gust'],
  sanctuary_aegis: ['shield', 'arrows', 'tusks', 'spear'], sanctuary_forge: ['hammer', 'furnace', 'embers', 'hooves'],
  sanctuary_names: ['haunt', 'call', 'music', 'judgement'], champion_spear: ['spear', 'charge', 'tusks'],
  champion_shield: ['shield', 'antlers', 'hammer'], champion_hunt: ['pounce', 'blade', 'needles'],
  champion_volley: ['arrows', 'feathers', 'boulder'], champion_guard: ['spear', 'shield', 'chains'],
  champion_storm: ['lightning', 'gust', 'tide'], leonidas: ['spear', 'charge', 'blade', 'lightning', 'shield', 'judgement'],
};
export function mythBossKit(slug: string): BossAttack[] {
  const island = slug === 'leonidas' || slug.startsWith('champion_');
  return (BOSS_KITS[slug] ?? ['spear', 'charge', 'hammer']).map((name, index) => {
    const base: BossAttack = MYTH_ATTACKS[name];
    return { ...base, id: name === 'charge' ? 'charge' : `${slug}_${name}`, cooldown: 4.8 + index * .45,
      power: base.power * (island ? 1.38 : 1.08), windup: Math.max(island ? .68 : .72, base.windup - (island ? .06 : 0)),
      swings: island && (name === 'blade' || name === 'judgement') ? 3 : base.swings,
      radius: base.radius ? base.radius * (island && base.shape === 'cone' ? 1.32 : 1.16) : undefined,
      innerRadius: base.innerRadius ? base.innerRadius * 1.12 : undefined,
      range: (base.range ?? 340) * (island && (base.shape === 'dash' || base.shape === 'leap') ? 1.4 : 1.15),
      count: base.count ? base.count : undefined,
    };
  });
}
