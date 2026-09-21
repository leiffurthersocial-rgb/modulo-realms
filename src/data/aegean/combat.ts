import type { BossAttack, EnemyDef } from '../enemies';

// Warnings describe the answer in a few words. Each species owns an ordered
// repertoire rather than selecting the same generic swing with a different tint.
const move = (id: string, name: string, shape: BossAttack['shape'], over: Partial<BossAttack> = {}): BossAttack => ({
  id, name, shape, windup: .7, cooldown: 3.5, power: 1.35, radius: 95,
  range: 340, element: 'physical', color: '#e4bb6d', ...over,
});
const venom = { element: 'poison' as const, color: '#94cd6d' };
const storm = { element: 'arcane' as const, color: '#a4d7ef' };
const shade = { element: 'shadow' as const, color: '#b49bd5' };
const fire = { element: 'fire' as const, color: '#ee914e' };
export const MYTH_ATTACKS = {
  pounce: move('pounce', 'Pounce · sidestep', 'leap', { radius: 66, range: 280, windup: .65 }),
  rend: move('rend', 'Claw fan · get behind', 'cone', { radius: 120, windup: .48 }),
  charge: move('charge', 'Charge · leave the lane', 'dash', { range: 360, windup: .8, power: 1.65 }),
  tusks: move('tusks', 'Tusk furrows · diagonal gap', 'cross', { radius: 20, range: 250, windup: .9 }),
  antlers: move('antlers', 'Antler sweep · close in', 'donut', { radius: 165, innerRadius: 65, windup: .8 }),
  root: move('root', 'Roots · leave both lines', 'cross', { ...venom, radius: 19, range: 260, status: { kind: 'chill', power: .32, duration: 2 } }),
  seed: move('seed', 'Thorn spiral · between thorns', 'nova', { ...venom, count: 9, projectileSpeed: 235, radius: 8, windup: .85 }),
  blade: move('blade', 'Twin blades · evade twice', 'echo', { radius: 64, repeatDelay: .65, windup: .6 }),
  music: move('music', 'Discord · enter the quiet eye', 'donut', { ...shade, radius: 215, innerRadius: 72, windup: 1 }),
  embers: move('embers', 'Ember crown · thread the gaps', 'nova', { ...fire, count: 7, radius: 10, projectileSpeed: 260 }),
  hooves: move('hooves', 'Hoofbeat · evade the second hit', 'echo', { radius: 76, repeatDelay: .65 }),
  arrows: move('arrows', 'Arrow fan · find a gap', 'projectile', { count: 5, spread: 1.1, radius: 9, projectileSpeed: 440, range: 620, windup: .65 }),
  boulder: move('boulder', 'Falling stones · keep moving', 'rain', { radius: 64, count: 3, windup: .95, power: 1.8 }),
  dive: move('dive', 'Wing dive · leave the shadow', 'leap', { radius: 56, range: 360, windup: .65 }),
  feathers: move('feathers', 'Razor feathers · cross a gap', 'nova', { count: 12, radius: 7, projectileSpeed: 330, windup: .85 }),
  lightning: move('lightning', 'Forked lightning · diagonal gap', 'cross', { ...storm, radius: 20, range: 390, windup: .95, power: 1.5 }),
  jaws: move('jaws', 'Serpent lunge · sidestep', 'line', { ...venom, range: 290, radius: 25, windup: .52 }),
  coil: move('coil', 'Coiling ring · stay inside', 'donut', { ...venom, innerRadius: 66, radius: 165, status: { kind: 'chill', power: .35, duration: 2.3 } }),
  spit: move('spit', 'Venom fan · spread apart', 'projectile', { ...venom, count: 3, spread: .65, radius: 11, projectileSpeed: 350, range: 470 }),
  furnace: move('furnace', 'Furnace vents · find a gap', 'nova', { ...fire, count: 8, radius: 12, projectileSpeed: 280, windup: 1 }),
  hammer: move('hammer', 'Hammerfall · leave both blows', 'echo', { ...fire, radius: 82, repeatDelay: .9, power: 1.7, windup: .8 }),
  spear: move('spear', 'Spear thrust · move sideways', 'line', { range: 285, radius: 15, windup: .5 }),
  shield: move('shield', 'Shield bash · roll behind', 'dash', { range: 150, power: 1.5, windup: .62 }),
  haunt: move('haunt', 'Haunting double · keep moving', 'echo', { ...shade, radius: 72, repeatDelay: .9, status: { kind: 'curse', power: .3, duration: 5 } }),
  call: move('call', 'Dragon teeth · break the risen', 'summon', { ...shade, summon: 'aegean_spartoi', count: 2, cooldown: 12, windup: 1.25 }),
  lure: move('lure', 'Siren tide · leave the circle', 'pull', { ...shade, radius: 185, power: .8, windup: 1.1 }),
  chains: move('chains', 'Crossed chains · diagonal gap', 'cross', { ...shade, radius: 23, range: 320, windup: .9, status: { kind: 'chill', power: .4, duration: 2 } }),
  breach: move('breach', 'Breach · leave the wake', 'leap', { ...storm, radius: 93, range: 300, windup: .9, power: 1.6 }),
  tide: move('tide', 'Tide ring · hold the eye', 'donut', { ...storm, radius: 215, innerRadius: 85, windup: .85 }),
  ink: move('ink', 'Ink burst · between the jets', 'nova', { ...shade, count: 10, radius: 12, projectileSpeed: 220, windup: .8 }),
  trident: move('trident', 'Three prongs · step through', 'projectile', { ...storm, count: 3, spread: .55, radius: 13, projectileSpeed: 390, range: 590 }),
  web: move('web', 'Silk cross · leave the web', 'cross', { radius: 25, range: 260, color: '#dce2ce', status: { kind: 'chill', power: .5, duration: 2.1 } }),
  riddle: move('riddle', 'Sphinx verdict · enter the eye', 'donut', { ...storm, radius: 230, innerRadius: 92, windup: 1.1, power: 1.7 }),
  needles: move('needles', 'Tail needles · split the fan', 'projectile', { ...venom, count: 7, spread: 1.25, radius: 7, projectileSpeed: 490, range: 610, windup: .65 }),
  gaze: move('gaze', 'Stone gaze · get behind', 'cone', { radius: 330, color: '#cee4b4', windup: 1.1, status: { kind: 'chill', power: .6, duration: 2.3 }, power: 1.45 }),
  judgement: move('judgement', 'Fury mark · evade twice', 'echo', { ...shade, radius: 82, repeatDelay: .55, windup: .7 }),
  gust: move('gust', 'Four winds · diagonal gap', 'cross', { ...storm, radius: 32, range: 410, windup: .85 }),
  maelstrom: move('maelstrom', 'Maelstrom · leave the spiral', 'pull', { ...storm, radius: 230, power: 1.3, windup: 1.1 }),
  howl: move('howl', 'Dread howl · close in', 'donut', { ...shade, radius: 250, innerRadius: 94, windup: .9, status: { kind: 'fear', power: .2, duration: 2 } }),
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
  return { movement, cadence, attacks: names.map(name => ({ ...MYTH_ATTACKS[name], id: `${slug}_${name}` })) };
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
  return (BOSS_KITS[slug] ?? ['spear', 'charge', 'hammer']).map((name, index) => {
    const base: BossAttack = MYTH_ATTACKS[name];
    return { ...base, id: name === 'charge' ? 'charge' : `${slug}_${name}`, cooldown: 3.8 + index * .4,
      power: base.power * 1.16, windup: Math.max(.55, base.windup),
      radius: base.radius ? base.radius * 1.16 : undefined,
      innerRadius: base.innerRadius ? base.innerRadius * 1.12 : undefined,
      range: (base.range ?? 340) * 1.15,
      count: base.count ? base.count + (base.shape === 'summon' ? 0 : 2) : undefined,
    };
  });
}
