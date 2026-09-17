export type RegionId = 'central' | 'north' | 'east' | 'south' | 'west' | 'deepnorth' | 'farwest' | 'fareast' | 'farsouth';

export interface RegionDef {
  id: RegionId;
  index: number;
  name: string;
  blurb: string;
  /** Recommended level band. */
  level: [number, number];
  color: string;
  music: 'world' | 'forest' | 'north' | 'desert';
}

export const REGIONS: RegionDef[] = [
  { id: 'central', index: 0, name: 'Ashvale Valley', blurb: 'Farmland, orchard and river meadow around the town of Ashvale.', level: [1, 5], color: '#6b9a4a', music: 'world' },
  { id: 'north', index: 1, name: 'Crag Reach', blurb: 'Snowbound pine and broken fortifications. The clans hold what the cold does not.', level: [9, 17], color: '#b3c0d2', music: 'north' },
  { id: 'east', index: 2, name: 'The Sunken Mire', blurb: 'Standing bog, drowned ruins, and things with too many legs.', level: [6, 12], color: '#5f7a3a', music: 'forest' },
  { id: 'south', index: 3, name: 'Duneholt Reach', blurb: 'Red rock and hot sand. The Ash Cutters run the roads here.', level: [7, 14], color: '#c9a86b', music: 'desert' },
  { id: 'west', index: 4, name: 'Thornhollow', blurb: 'Old wood under an older canopy, warded by the Forest Court.', level: [4, 13], color: '#3c6b39', music: 'forest' },
  { id: 'deepnorth', index: 5, name: 'The Jotunreach', blurb: 'Above the Reach the ground turns to glacier and stops pretending anyone lives here.', level: [22, 34], color: '#d8ecf6', music: 'north' },
  { id: 'farwest', index: 6, name: 'The Gloaming', blurb: 'Past the Court the canopy closes over entirely and the wood stops answering to anyone.', level: [16, 26], color: '#1f3a28', music: 'forest' },
  { id: 'fareast', index: 7, name: 'The Saltreach', blurb: 'Where the Mire runs out into a dead sea. Salt flats, drowned towers, and the tide coming in.', level: [18, 28], color: '#4a7a8c', music: 'forest' },
  { id: 'farsouth', index: 8, name: 'The Cinderwastes', blurb: 'Under Duneholt the sand turns to ash, and the ash is warm.', level: [20, 32], color: '#7a3a2a', music: 'desert' },
];

export const REGION_BY_INDEX: RegionDef[] = REGIONS.slice().sort((a, b) => a.index - b.index);
export const REGION_BY_ID: Record<RegionId, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionDef>;

export type LocationKind = 'village' | 'town' | 'dungeon' | 'cave' | 'landmark' | 'camp' | 'shrine' | 'ruin';

export interface DungeonSpec {
  mapId: string;
  theme: 'fortress' | 'crypt' | 'grove' | 'tomb' | 'spire' | 'mine' | 'glacier' | 'barrow';
  level: number;
  rooms: number;
  boss?: string;
  miniboss?: string;
  enemies: string[];
  name: string;
}

export interface LocationDef {
  id: string;
  name: string;
  kind: LocationKind;
  /** Tile coordinates on the overworld. */
  tx: number;
  ty: number;
  region: RegionId;
  desc: string;
  /** Discovery radius in tiles. */
  radius?: number;
  dungeon?: DungeonSpec;
  /** Starts discovered on the world map. */
  known?: boolean;
  level?: number;
}

/**
 * The overworld is 768 tiles wide and 832 tall — roughly 24,500 by 26,600
 * pixels, or about 2.4x the area of the original valley.
 *
 * It has grown twice, and both times outward from Ashvale rather than around
 * it, so nothing that was already placed ever moved relative to the town. The
 * first growth added 192 rows to the north (the Jotunreach). The second added
 * 128 columns west, 128 columns east and 128 rows south: the Gloaming beyond
 * Thornhollow, the Saltreach beyond the Mire, and the Cinderwastes below
 * Duneholt. That is why every coordinate here reads 128 higher in x and 192
 * higher in y than it does in the old drafts.
 */
export const WORLD_W = 768;
export const WORLD_H = 832;
export const VILLAGE_TX = 384;
export const VILLAGE_TY = 448;

export const LOCATIONS: LocationDef[] = [
  // settlements
  { id: 'ashvale', name: 'Ashvale', kind: 'town', tx: 384, ty: 448, region: 'central', desc: 'The last town in the valley with a working forge and a full inn.', known: true, radius: 29, level: 1 },
  { id: 'northwatch', name: 'Northwatch', kind: 'village', tx: 381, ty: 307, region: 'north', desc: 'A clanhold of stone huts wedged against the crag wall.', radius: 19, level: 10 },
  { id: 'mirefall', name: 'Mirefall', kind: 'village', tx: 528, ty: 464, region: 'east', desc: 'Stilt houses over black water. Nobody here sleeps well.', radius: 19, level: 7 },
  { id: 'duneholt', name: 'Duneholt', kind: 'village', tx: 392, ty: 592, region: 'south', desc: 'A walled trade post that pays the Cutters not to burn it.', radius: 19, level: 8 },
  { id: 'thornhollow', name: 'Thornhollow', kind: 'village', tx: 240, ty: 443, region: 'west', desc: 'Elven halls grown rather than built, high in the old canopy.', radius: 19, level: 6 },
  { id: 'vardhold', name: 'Vardhold', kind: 'village', tx: 376, ty: 205, region: 'deepnorth', desc: 'Six roofs, one fire, and a gate nobody opens. The last place anyone lives.', radius: 19, level: 21 },

  // dungeons
  {
    id: 'ruined_fortress', name: 'The Ruined Fortress', kind: 'dungeon', tx: 464, ty: 349, region: 'north', level: 10,
    desc: 'A border keep the clans abandoned. Something still holds the gate.',
    dungeon: { mapId: 'dungeon_fortress', theme: 'fortress', level: 10, rooms: 12, boss: 'boss_stone_warden', enemies: ['skeleton', 'skeleton_archer', 'golem', 'bandit_brute'], name: 'The Ruined Fortress' },
  },
  {
    id: 'barrow_crypt', name: 'The Barrow Crypt', kind: 'dungeon', tx: 285, ty: 549, region: 'south', level: 14,
    desc: 'Layered tombs of a line of kings that ended badly.',
    dungeon: { mapId: 'dungeon_crypt', theme: 'crypt', level: 14, rooms: 14, boss: 'boss_hollow_king', enemies: ['skeleton', 'crawler', 'wraith', 'revenant_knight'], name: 'The Barrow Crypt' },
  },
  {
    id: 'grove_temple', name: 'The Thornhollow Grove', kind: 'dungeon', tx: 203, ty: 389, region: 'west', level: 12,
    desc: 'A temple the forest has almost finished swallowing.',
    dungeon: { mapId: 'dungeon_grove', theme: 'grove', level: 12, rooms: 12, boss: 'boss_matriarch', enemies: ['sapling', 'spider', 'wisp', 'venomspider'], name: 'The Thornhollow Grove' },
  },
  {
    id: 'sunken_tomb', name: 'The Sunken Tomb', kind: 'dungeon', tx: 456, ty: 635, region: 'south', level: 12,
    desc: 'Sandstone halls under the dunes, sealed for a reason.',
    dungeon: { mapId: 'dungeon_tomb', theme: 'tomb', level: 12, rooms: 12, boss: 'boss_sand_tyrant', enemies: ['scorpion', 'sandgolem', 'skeleton', 'crawler'], name: 'The Sunken Tomb' },
  },
  {
    id: 'ashen_spire', name: 'The Ashen Spire', kind: 'dungeon', tx: 323, ty: 253, region: 'north', level: 16,
    desc: 'A Concord tower that froze mid-collapse and never finished falling.',
    dungeon: { mapId: 'dungeon_spire', theme: 'spire', level: 16, rooms: 14, boss: 'boss_rime_lich', miniboss: 'mini_frostwarden', enemies: ['cultist', 'wraith', 'revenant_knight', 'emberwisp'], name: 'The Ashen Spire' },
  },
  {
    id: 'ironroot_mine', name: 'Ironroot Mine', kind: 'cave', tx: 480, ty: 403, region: 'east', level: 6,
    desc: 'A Guild dig that hit something other than ore.',
    dungeon: { mapId: 'dungeon_mine', theme: 'mine', level: 6, rooms: 10, miniboss: 'mini_broodmother', enemies: ['bat', 'spider', 'goblin', 'goblin_shaman', 'slime'], name: 'Ironroot Mine' },
  },
  {
    id: 'whisperwell', name: 'Whisperwell Cave', kind: 'cave', tx: 309, ty: 517, region: 'central', level: 4,
    desc: 'A shallow cave the Ashvale children dare each other to enter.',
    dungeon: { mapId: 'dungeon_whisper', theme: 'mine', level: 4, rooms: 7, enemies: ['bat', 'slime', 'spider', 'crawler'], name: 'Whisperwell Cave' },
  },

  /* --- the outer marches --- */
  { id: 'duskhold', name: 'Duskhold', kind: 'village', tx: 74, ty: 470, region: 'farwest', desc: 'A Court outpost that stopped sending word. It is still lit.', radius: 19, level: 18 },
  { id: 'saltwatch', name: 'Saltwatch', kind: 'village', tx: 700, ty: 452, region: 'fareast', desc: 'Stilts on a salt flat, and a bell nobody will explain.', radius: 19, level: 20 },
  { id: 'cinderhold', name: 'Cinderhold', kind: 'village', tx: 404, ty: 772, region: 'farsouth', desc: 'A Cutter town that went straight. Mostly. The walls face inward as well as out.', radius: 19, level: 23 },
  {
    id: 'the_deepwood', name: 'The Deepwood', kind: 'dungeon', tx: 48, ty: 388, region: 'farwest', level: 25,
    desc: 'The canopy closes completely. It is dark enough in there to need a torch at noon.',
    dungeon: { mapId: 'dungeon_deepwood', theme: 'grove', level: 25, rooms: 16, boss: 'boss_gloam_mother', miniboss: 'mini_broodmother', enemies: ['gloam_stalker', 'gloam_weaver', 'hollow_treant', 'court_exile'], name: 'The Deepwood' },
  },
  {
    id: 'thorn_warren', name: 'The Thorn Warren', kind: 'cave', tx: 96, ty: 560, region: 'farwest', level: 20,
    desc: 'Something dug under the roots and the roots grew down after it.',
    dungeon: { mapId: 'dungeon_thorn', theme: 'grove', level: 20, rooms: 12, miniboss: 'mini_broodmother', enemies: ['gloam_weaver', 'gloam_stalker', 'venomspider', 'sapling'], name: 'The Thorn Warren' },
  },
  {
    id: 'drowned_court', name: 'The Drowned Court', kind: 'dungeon', tx: 716, ty: 356, region: 'fareast', level: 27,
    desc: 'A throne room with a tide line two thirds of the way up the walls.',
    dungeon: { mapId: 'dungeon_drowned', theme: 'tomb', level: 27, rooms: 16, boss: 'boss_tide_king', miniboss: 'mini_frostwarden', enemies: ['drowned_legionary', 'salt_wraith', 'brine_crawler', 'salt_colossus'], name: 'The Drowned Court' },
  },
  {
    id: 'salt_mine', name: 'The Salt Works', kind: 'cave', tx: 684, ty: 560, region: 'fareast', level: 22,
    desc: 'Guild salt pans, abandoned in a hurry, with the tools still laid out.',
    dungeon: { mapId: 'dungeon_saltworks', theme: 'mine', level: 22, rooms: 13, miniboss: 'mini_captain', enemies: ['brine_crawler', 'salt_wraith', 'salt_colossus', 'crawler'], name: 'The Salt Works' },
  },
  {
    id: 'the_caldera', name: 'The Caldera', kind: 'dungeon', tx: 356, ty: 800, region: 'farsouth', level: 31,
    desc: 'The lid of something. Duneholt pays the Cutters to keep people off it.',
    dungeon: { mapId: 'dungeon_caldera', theme: 'spire', level: 31, rooms: 17, boss: 'boss_cinder_maw', miniboss: 'mini_glacier_maw', enemies: ['magma_golem', 'cinder_wisp', 'ash_serpent', 'cutter_warlord', 'ash_scorpion'], name: 'The Caldera' },
  },
  {
    id: 'ashfall_barrow', name: 'Ashfall Barrow', kind: 'dungeon', tx: 512, ty: 764, region: 'farsouth', level: 26,
    desc: 'A Cutter burial pit that somebody has been adding to recently.',
    dungeon: { mapId: 'dungeon_ashfall', theme: 'crypt', level: 26, rooms: 14, miniboss: 'mini_captain', enemies: ['cutter_warlord', 'ash_scorpion', 'cinder_wisp', 'skeleton', 'revenant_knight'], name: 'Ashfall Barrow' },
  },

  /* --- the Frostmarch, and the Jotunreach above it --- */
  {
    id: 'frostmarch_hold', name: 'Frostmarch Hold', kind: 'dungeon', tx: 434, ty: 243, region: 'north', level: 19,
    desc: 'The last manned gate on the northern road. It has been manned a very long time.',
    dungeon: { mapId: 'dungeon_frostmarch', theme: 'fortress', level: 19, rooms: 15, boss: 'boss_march_warden', miniboss: 'mini_frostwarden', enemies: ['ice_revenant', 'revenant_knight', 'frostwolf', 'golem', 'orc_raider'], name: 'Frostmarch Hold' },
  },
  {
    id: 'glass_hollow', name: 'The Glass Hollow', kind: 'cave', tx: 326, ty: 186, region: 'deepnorth', level: 22,
    desc: 'A melt cave in the face of the glacier. The walls are clear enough to see things moving behind them.',
    dungeon: { mapId: 'dungeon_glass', theme: 'glacier', level: 22, rooms: 12, miniboss: 'mini_wintercaller', enemies: ['rime_stalker', 'glacier_wyrm', 'winter_shade', 'ice_revenant'], name: 'The Glass Hollow' },
  },
  {
    id: 'riven_cathedral', name: 'The Riven Cathedral', kind: 'dungeon', tx: 270, ty: 141, region: 'deepnorth', level: 24,
    desc: 'A Concord cathedral that the ice took whole, upright, mid-service.',
    dungeon: { mapId: 'dungeon_riven', theme: 'glacier', level: 24, rooms: 15, boss: 'boss_riven_choir', enemies: ['winter_shade', 'herald_winter', 'ice_revenant', 'glass_golem'], name: 'The Riven Cathedral' },
  },
  {
    id: 'jotun_barrow', name: 'The Long Barrow', kind: 'dungeon', tx: 500, ty: 122, region: 'deepnorth', level: 28,
    desc: 'A grave cut for something the size of a hall, and it was cut to the right size.',
    dungeon: { mapId: 'dungeon_barrow', theme: 'barrow', level: 28, rooms: 16, boss: 'boss_jotun_king', miniboss: 'mini_glacier_maw', enemies: ['jotun_thrall', 'bone_colossus', 'glass_golem', 'pale_hunter', 'frost_giant'], name: 'The Long Barrow' },
  },
  {
    id: 'under_the_gate', name: 'Under the Gate', kind: 'dungeon', tx: 420, ty: 22, region: 'deepnorth', level: 38,
    desc: 'The stair past the gate keeps going down. Nobody built the part at the bottom.',
    dungeon: { mapId: 'dungeon_remainder', theme: 'glacier', level: 38, rooms: 18, boss: 'boss_remainder', miniboss: 'mini_glacier_maw', enemies: ['bone_colossus', 'frost_giant', 'herald_winter', 'glass_golem', 'jotun_thrall'], name: 'Under the Gate' },
  },
  {
    id: 'the_last_gate', name: 'The Last Gate', kind: 'dungeon', tx: 384, ty: 42, region: 'deepnorth', level: 32,
    desc: 'The clans built a door at the top of the world. Nobody will tell you what it was for.',
    dungeon: { mapId: 'dungeon_lastgate', theme: 'glacier', level: 32, rooms: 17, boss: 'boss_winter_jarl', miniboss: 'mini_glacier_maw', enemies: ['frost_giant', 'jotun_thrall', 'herald_winter', 'bone_colossus', 'winter_shade'], name: 'The Last Gate' },
  },

  // camps and landmarks
  { id: 'cutter_camp', name: 'Cutter Camp', kind: 'camp', tx: 437, ty: 541, region: 'south', level: 8, desc: 'Ash Cutter tents ringed by stolen wagons.' },
  { id: 'goblin_warren', name: 'Scrap Warren', kind: 'camp', tx: 445, ty: 496, region: 'east', level: 4, desc: 'Goblins have made a home from a collapsed barn.' },
  { id: 'crag_camp', name: 'Crag War Camp', kind: 'camp', tx: 427, ty: 320, region: 'north', level: 11, desc: 'Orc raiders staging for a push into the valley.' },
  { id: 'drowned_shrine', name: 'The Drowned Shrine', kind: 'shrine', tx: 512, ty: 416, region: 'east', level: 7, desc: 'A shrine standing waist-deep in black water. It still answers.' },
  { id: 'standing_stones', name: 'The Counting Stones', kind: 'landmark', tx: 304, ty: 379, region: 'west', level: 5, desc: 'Nine stones in a ring. Count them twice and you get ten.' },
  { id: 'old_bridge', name: 'Kettle Bridge', kind: 'landmark', tx: 427, ty: 440, region: 'central', level: 2, desc: 'The old river crossing east out of Ashvale.' },
  { id: 'hermit_hut', name: "Hermit's Hut", kind: 'landmark', tx: 272, ty: 496, region: 'west', level: 5, desc: 'Somebody lives here on purpose.' },
  { id: 'sunken_wreck', name: 'The Broken Caravan', kind: 'landmark', tx: 408, ty: 525, region: 'south', level: 6, desc: 'A merchant train that did not make it to Duneholt.' },
  { id: 'frost_altar', name: 'The Frost Altar', kind: 'shrine', tx: 352, ty: 331, region: 'north', level: 12, desc: 'Ice that has not melted in living memory.' },
  { id: 'ember_falls', name: 'Emberfall', kind: 'landmark', tx: 341, ty: 397, region: 'central', level: 3, desc: 'A waterfall that runs warm all winter.' },
  { id: 'watchers_ring', name: "The Watcher's Ring", kind: 'ruin', tx: 528, ty: 549, region: 'east', level: 9, desc: 'Broken pillars around a pit that goes nowhere.' },
  { id: 'lost_chapel', name: 'The Lost Chapel', kind: 'ruin', tx: 256, ty: 587, region: 'south', level: 10, desc: 'The valley forgot which god this was for.' },

  /* --- the outer marches --- */
  { id: 'gloam_ring', name: 'The Unlit Ring', kind: 'shrine', tx: 60, ty: 620, region: 'farwest', level: 22, desc: 'Nine stones again, and this time all nine are there.' },
  { id: 'exile_camp', name: 'The Exile Camp', kind: 'camp', tx: 118, ty: 424, region: 'farwest', level: 21, desc: 'Court elves who were asked to leave and went further than asked.' },
  { id: 'salt_pillars', name: 'The Salt Pillars', kind: 'landmark', tx: 660, ty: 292, region: 'fareast', level: 21, desc: 'Columns of salt in rows, and something inside a few of them.' },
  { id: 'wrecked_fleet', name: 'The Wrecked Fleet', kind: 'ruin', tx: 736, ty: 624, region: 'fareast', level: 25, desc: 'Forty hulls on a flat with no water anywhere near it.' },
  { id: 'cutter_stronghold', name: 'The Cutter Stronghold', kind: 'camp', tx: 452, ty: 700, region: 'farsouth', level: 27, desc: 'Where the Ash Cutters actually live, as opposed to where they raid.' },
  { id: 'glass_flats', name: 'The Glass Flats', kind: 'landmark', tx: 292, ty: 740, region: 'farsouth', level: 24, desc: 'Sand that was hot enough, once, for long enough.' },

  /* --- the Jotunreach --- */
  { id: 'thrall_camp', name: 'The Thrall Yard', kind: 'camp', tx: 440, ty: 174, region: 'deepnorth', level: 24, desc: 'Something keeps a work crew up here. The work is not obvious.' },
  { id: 'white_stair', name: 'The White Stair', kind: 'landmark', tx: 340, ty: 96, region: 'deepnorth', level: 27, desc: 'Steps cut into the glacier face, at a size that was not cut for people.' },
  { id: 'ice_fields', name: 'The Standing Ice', kind: 'shrine', tx: 246, ty: 190, region: 'deepnorth', level: 23, desc: 'Pillars of clear ice in rows, and something inside every one of them.' },
  { id: 'cairn_of_names', name: 'The Cairn of Names', kind: 'ruin', tx: 464, ty: 68, region: 'deepnorth', level: 30, desc: 'Every stone has a name cut into it. The pile is very large.' },
];

export const LOCATION_BY_ID: Record<string, LocationDef> = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));
export const DUNGEONS = LOCATIONS.filter((l) => !!l.dungeon);

/** Sites that carry a waystone, in travel-menu order. */
export const WAYSTONE_SITES: LocationDef[] = LOCATIONS.filter(
  (l) => l.kind === 'town' || l.kind === 'village' || l.kind === 'dungeon' || l.kind === 'cave',
);
