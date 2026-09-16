export type RegionId = 'central' | 'north' | 'east' | 'south' | 'west';

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
];

export const REGION_BY_INDEX: RegionDef[] = REGIONS.slice().sort((a, b) => a.index - b.index);
export const REGION_BY_ID: Record<RegionId, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionDef>;

export type LocationKind = 'village' | 'town' | 'dungeon' | 'cave' | 'landmark' | 'camp' | 'shrine' | 'ruin';

export interface DungeonSpec {
  mapId: string;
  theme: 'fortress' | 'crypt' | 'grove' | 'tomb' | 'spire' | 'mine';
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
 * The overworld is 512x512 tiles — about 16,000 pixels on a side. Every
 * location coordinate below is in this space, and the whole valley was scaled
 * up from a 384-tile draft, so the regions sit further apart and the roads
 * between them are a real journey rather than a short walk.
 */
export const WORLD_W = 512;
export const WORLD_H = 512;
export const VILLAGE_TX = 256;
export const VILLAGE_TY = 256;

export const LOCATIONS: LocationDef[] = [
  // settlements
  { id: 'ashvale', name: 'Ashvale', kind: 'town', tx: 256, ty: 256, region: 'central', desc: 'The last town in the valley with a working forge and a full inn.', known: true, radius: 29, level: 1 },
  { id: 'northwatch', name: 'Northwatch', kind: 'village', tx: 253, ty: 115, region: 'north', desc: 'A clanhold of stone huts wedged against the crag wall.', radius: 19, level: 10 },
  { id: 'mirefall', name: 'Mirefall', kind: 'village', tx: 400, ty: 272, region: 'east', desc: 'Stilt houses over black water. Nobody here sleeps well.', radius: 19, level: 7 },
  { id: 'duneholt', name: 'Duneholt', kind: 'village', tx: 264, ty: 400, region: 'south', desc: 'A walled trade post that pays the Cutters not to burn it.', radius: 19, level: 8 },
  { id: 'thornhollow', name: 'Thornhollow', kind: 'village', tx: 112, ty: 251, region: 'west', desc: 'Elven halls grown rather than built, high in the old canopy.', radius: 19, level: 6 },

  // dungeons
  {
    id: 'ruined_fortress', name: 'The Ruined Fortress', kind: 'dungeon', tx: 336, ty: 157, region: 'north', level: 10,
    desc: 'A border keep the clans abandoned. Something still holds the gate.',
    dungeon: { mapId: 'dungeon_fortress', theme: 'fortress', level: 10, rooms: 12, boss: 'boss_stone_warden', enemies: ['skeleton', 'skeleton_archer', 'golem', 'bandit_brute'], name: 'The Ruined Fortress' },
  },
  {
    id: 'barrow_crypt', name: 'The Barrow Crypt', kind: 'dungeon', tx: 157, ty: 357, region: 'south', level: 14,
    desc: 'Layered tombs of a line of kings that ended badly.',
    dungeon: { mapId: 'dungeon_crypt', theme: 'crypt', level: 14, rooms: 14, boss: 'boss_hollow_king', enemies: ['skeleton', 'crawler', 'wraith', 'revenant_knight'], name: 'The Barrow Crypt' },
  },
  {
    id: 'grove_temple', name: 'The Thornhollow Grove', kind: 'dungeon', tx: 75, ty: 197, region: 'west', level: 12,
    desc: 'A temple the forest has almost finished swallowing.',
    dungeon: { mapId: 'dungeon_grove', theme: 'grove', level: 12, rooms: 12, boss: 'boss_matriarch', enemies: ['sapling', 'spider', 'wisp', 'venomspider'], name: 'The Thornhollow Grove' },
  },
  {
    id: 'sunken_tomb', name: 'The Sunken Tomb', kind: 'dungeon', tx: 328, ty: 443, region: 'south', level: 12,
    desc: 'Sandstone halls under the dunes, sealed for a reason.',
    dungeon: { mapId: 'dungeon_tomb', theme: 'tomb', level: 12, rooms: 12, boss: 'boss_sand_tyrant', enemies: ['scorpion', 'sandgolem', 'skeleton', 'crawler'], name: 'The Sunken Tomb' },
  },
  {
    id: 'ashen_spire', name: 'The Ashen Spire', kind: 'dungeon', tx: 195, ty: 61, region: 'north', level: 16,
    desc: 'A Concord tower that froze mid-collapse and never finished falling.',
    dungeon: { mapId: 'dungeon_spire', theme: 'spire', level: 16, rooms: 14, boss: 'boss_rime_lich', miniboss: 'mini_frostwarden', enemies: ['cultist', 'wraith', 'revenant_knight', 'emberwisp'], name: 'The Ashen Spire' },
  },
  {
    id: 'ironroot_mine', name: 'Ironroot Mine', kind: 'cave', tx: 352, ty: 211, region: 'east', level: 6,
    desc: 'A Guild dig that hit something other than ore.',
    dungeon: { mapId: 'dungeon_mine', theme: 'mine', level: 6, rooms: 10, miniboss: 'mini_broodmother', enemies: ['bat', 'spider', 'goblin', 'goblin_shaman', 'slime'], name: 'Ironroot Mine' },
  },
  {
    id: 'whisperwell', name: 'Whisperwell Cave', kind: 'cave', tx: 181, ty: 325, region: 'central', level: 4,
    desc: 'A shallow cave the Ashvale children dare each other to enter.',
    dungeon: { mapId: 'dungeon_whisper', theme: 'mine', level: 4, rooms: 7, enemies: ['bat', 'slime', 'spider', 'crawler'], name: 'Whisperwell Cave' },
  },

  // camps and landmarks
  { id: 'cutter_camp', name: 'Cutter Camp', kind: 'camp', tx: 309, ty: 349, region: 'south', level: 8, desc: 'Ash Cutter tents ringed by stolen wagons.' },
  { id: 'goblin_warren', name: 'Scrap Warren', kind: 'camp', tx: 317, ty: 304, region: 'east', level: 4, desc: 'Goblins have made a home from a collapsed barn.' },
  { id: 'crag_camp', name: 'Crag War Camp', kind: 'camp', tx: 299, ty: 128, region: 'north', level: 11, desc: 'Orc raiders staging for a push into the valley.' },
  { id: 'drowned_shrine', name: 'The Drowned Shrine', kind: 'shrine', tx: 384, ty: 224, region: 'east', level: 7, desc: 'A shrine standing waist-deep in black water. It still answers.' },
  { id: 'standing_stones', name: 'The Counting Stones', kind: 'landmark', tx: 176, ty: 187, region: 'west', level: 5, desc: 'Nine stones in a ring. Count them twice and you get ten.' },
  { id: 'old_bridge', name: 'Kettle Bridge', kind: 'landmark', tx: 299, ty: 248, region: 'central', level: 2, desc: 'The old river crossing east out of Ashvale.' },
  { id: 'hermit_hut', name: "Hermit's Hut", kind: 'landmark', tx: 144, ty: 304, region: 'west', level: 5, desc: 'Somebody lives here on purpose.' },
  { id: 'sunken_wreck', name: 'The Broken Caravan', kind: 'landmark', tx: 280, ty: 333, region: 'south', level: 6, desc: 'A merchant train that did not make it to Duneholt.' },
  { id: 'frost_altar', name: 'The Frost Altar', kind: 'shrine', tx: 224, ty: 139, region: 'north', level: 12, desc: 'Ice that has not melted in living memory.' },
  { id: 'ember_falls', name: 'Emberfall', kind: 'landmark', tx: 213, ty: 205, region: 'central', level: 3, desc: 'A waterfall that runs warm all winter.' },
  { id: 'watchers_ring', name: "The Watcher's Ring", kind: 'ruin', tx: 400, ty: 357, region: 'east', level: 9, desc: 'Broken pillars around a pit that goes nowhere.' },
  { id: 'lost_chapel', name: 'The Lost Chapel', kind: 'ruin', tx: 128, ty: 395, region: 'south', level: 10, desc: 'The valley forgot which god this was for.' },
];

export const LOCATION_BY_ID: Record<string, LocationDef> = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));
export const DUNGEONS = LOCATIONS.filter((l) => !!l.dungeon);

/** Sites that carry a waystone, in travel-menu order. */
export const WAYSTONE_SITES: LocationDef[] = LOCATIONS.filter(
  (l) => l.kind === 'town' || l.kind === 'village' || l.kind === 'dungeon' || l.kind === 'cave',
);
