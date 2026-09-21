/** A place's creatures, weather and ground danger form one readable identity. */
export type AegeanHazardKind = 'roots' | 'vent' | 'rockfall' | 'gaze' | 'lightning' | 'thorns' | 'spears' | 'tide' | 'song';
export type AegeanWeather = 'pollen' | 'embers' | 'rain' | 'sea-mist' | 'golden-leaves' | 'dust' | 'petals' | 'clear';
export interface AegeanEcology {
  enemies: readonly string[];
  hazard: AegeanHazardKind;
  weather: AegeanWeather;
  color: string;
  identity: string;
}
const biome = (enemies: string[], hazard: AegeanHazardKind, weather: AegeanWeather, color: string, identity: string): AegeanEcology => ({ enemies: enemies.map(id => `aegean_${id}`), hazard, weather, color, identity });
export const AEGEAN_ISLAND_ECOLOGY: Record<string, AegeanEcology> = {
  kymene: biome(['telchine', 'crab', 'nereid'], 'tide', 'sea-mist', '#71c6cc', 'Flooded net coves · retreat from the rising surf'),
  crete: biome(['bronze_bull', 'arachne', 'maenad'], 'vent', 'embers', '#dc8255', 'Cracked palace vineyards · watch the steaming fissures'),
  thalke: biome(['talos_shard', 'automaton', 'telchine'], 'lightning', 'dust', '#e4b165', 'Bronze foundry island · charged metal draws lightning'),
  gorgon: biome(['graeae', 'lamia', 'eidolon'], 'gaze', 'sea-mist', '#abc58d', 'Petrified orchards · watch the rays from broken Gorgon statues'),
  erytheia: biome(['hound', 'manticore', 'sacred_boar'], 'spears', 'dust', '#d18a61', 'Red herd mesa · buried horn traps mark the cattle runs'),
  hesperides: biome(['dryad', 'drakon', 'gryphon'], 'thorns', 'golden-leaves', '#e9ca62', 'Sunset garden · golden roots defend the apples'),
  amazon: biome(['amazon_archer', 'myrmidon', 'maenad'], 'spears', 'petals', '#d994b1', 'Huntress jungle · spring spears guard ambush trails'),
  sirens: biome(['siren', 'nereid', 'anemoi'], 'song', 'rain', '#aeace3', 'Singing sea stacks · loose shrine bells swing above the rocks'),
  delos: biome(['sphinx', 'gryphon', 'automaton'], 'gaze', 'clear', '#ffe09a', 'Apollo’s sun courts · searing light crosses marble'),
  icarian: biome(['anemoi', 'storm_harpy', 'gryphon'], 'rockfall', 'dust', '#c4d9ee', 'Wind-sheared wax cliffs · falling stone follows your steps'),
  cyclops_table: biome(['laestrygonian', 'sacred_boar', 'manticore'], 'rockfall', 'dust', '#c4aa89', 'Giants’ quarry · boulder shadows warn before impact'),
  sister_west: biome(['nereid', 'telchine', 'lamia'], 'tide', 'sea-mist', '#87cbd6', 'The drowned sister · pools breathe with the tide'),
  sister_middle: biome(['dryad', 'piper', 'sphinx'], 'roots', 'pollen', '#bdcc79', 'The dreaming sister · living hedges close around you'),
  sister_east: biome(['erinys', 'eidolon', 'spartoi'], 'lightning', 'rain', '#ac9dcb', 'The mourning sister · oath lightning wakes the fallen'),
  drowned_lyre: biome(['siren', 'eidolon', 'nereid'], 'song', 'sea-mist', '#b9a1dc', 'Drowned amphitheatre · broken lyre shrines hide swinging bronze bells'),
  ash_crown: biome(['furnace_guardian', 'bronze_bull', 'empousa'], 'vent', 'embers', '#ed9d62', 'Hephaestus’ broken caldera · vents erupt in rolling belts'),
  asterion: biome(['royal_guard', 'erinys', 'spartoi', 'burial_priest'], 'lightning', 'rain', '#bacbdf', 'The oathbound kingdom · storm fronts sweep red cypress graves'),
};
export const AEGEAN_MAINLAND_ECOLOGY: Record<number, AegeanEcology> = {
  12: biome(['satyr', 'myrmidon', 'sphinx'], 'spears', 'dust', '#d8c788', 'The marble pass'),
  13: biome(['dryad', 'centaur', 'piper', 'arachne'], 'roots', 'pollen', '#9ccc86', 'Arcadian sacred woods'),
  14: biome(['anemoi', 'gryphon', 'storm_harpy'], 'lightning', 'rain', '#c3d9e8', 'The thunder escarpment'),
  15: biome(['maenad', 'spartoi', 'lamia'], 'tide', 'petals', '#d7c68b', 'The living river delta'),
  16: biome(['sphinx', 'graeae', 'drakon'], 'gaze', 'golden-leaves', '#ddc579', 'The oracle’s sun terraces'),
  17: biome(['telchine', 'nereid', 'crab'], 'tide', 'sea-mist', '#8ed3db', 'The bronze coast'),
  18: biome(['hoplite', 'myrmidon', 'centaur_elder'], 'spears', 'dust', '#d69879', 'The red-earth war roads'),
  19: biome(['lamia', 'constrictor', 'bronze_harpy', 'arachne'], 'roots', 'sea-mist', '#acc583', 'Lerna’s breathing reed beds'),
  20: biome(['furnace_guardian', 'empousa', 'erinys', 'bronze_bull'], 'vent', 'embers', '#df9b71', 'The obsidian peninsula'),
  21: biome(['telchine', 'sphinx', 'dryad'], 'tide', 'sea-mist', '#a9c5a9', 'The shattered islands'),
  22: biome(['ichthyocentaur', 'nereid', 'charybdis_spawn'], 'tide', 'rain', '#97bdcf', 'The monster sea'),
  23: AEGEAN_ISLAND_ECOLOGY.asterion,
};
export const AEGEAN_SEA_PACKS: readonly (readonly string[])[] = [
  ['aegean_hippocampus', 'aegean_telchine', 'aegean_nereid'],
  ['aegean_siren', 'aegean_ichthyocentaur', 'aegean_hippocampus'],
  ['aegean_ketos', 'aegean_charybdis_spawn', 'aegean_nereid'],
  ['aegean_sea_serpent', 'aegean_charybdis_spawn', 'aegean_anemoi'],
  ['aegean_sea_serpent', 'aegean_ichthyocentaur', 'aegean_anemoi'],
];

/** Apex creatures punctuate a journey; they do not fill ordinary patrols. */
export const AEGEAN_RARE_SPECIES = new Set([
  'aegean_sphinx', 'aegean_gryphon', 'aegean_manticore', 'aegean_laestrygonian',
  'aegean_bronze_bull', 'aegean_furnace_guardian', 'aegean_centaur_elder',
  'aegean_drakon', 'aegean_graeae', 'aegean_talos_shard',
  'aegean_ketos', 'aegean_charybdis_spawn', 'aegean_sea_serpent',
]);
export function aegeanSpeciesWeight(id: string): number {
  return AEGEAN_RARE_SPECIES.has(id) ? .22 : id === 'aegean_ichthyocentaur' || id === 'aegean_eidolon' ? .55 : 1;
}
export function pickAegeanSpecies(ids: readonly string[], roll: number): string {
  let remaining = Math.max(0, Math.min(.999999, roll)) * ids.reduce((sum, id) => sum + aegeanSpeciesWeight(id), 0);
  for (const id of ids) { remaining -= aegeanSpeciesWeight(id); if (remaining < 0) return id; }
  return ids[ids.length - 1];
}
export const AEGEAN_SURFACE_SPAWNS = { spacing: 15, retained: .72, pairChance: .55 } as const;
export const AEGEAN_SEA_ENCOUNTERS = {
  firstDelay: 22,
  maxAlive: [1, 2, 3, 3, 4],
  interval: [25, 21, 17, 13.5, 10],
} as const;
