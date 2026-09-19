/** Tile ids. Stored in map data as Uint8 values, so keep this under 256. */
export const T = {
  VOID: 0,
  DEEP_WATER: 1,
  WATER: 2,
  SAND: 3,
  GRASS: 4,
  GRASS_DARK: 5,
  GRASS_PALE: 6,
  TALL_GRASS: 7,
  FLOWERS: 8,
  DIRT: 9,
  ROAD: 10,
  ROAD_DIRT: 11,
  FARM_SOIL: 12,
  STONE_GROUND: 13,
  GRAVEL: 14,
  MOUNTAIN: 15,
  CLIFF: 16,
  SNOW: 17,
  SNOW_ROCK: 18,
  ICE: 19,
  SWAMP_WATER: 20,
  SWAMP_GROUND: 21,
  MUD: 22,
  DESERT_SAND: 23,
  DESERT_ROCK: 24,
  ASH_GROUND: 25,
  BRIDGE: 26,
  FLOOR_WOOD: 27,
  FLOOR_STONE: 28,
  FLOOR_CARPET: 29,
  WALL_WOOD: 30,
  WALL_STONE: 31,
  DUNGEON_FLOOR: 32,
  DUNGEON_WALL: 33,
  CRYPT_FLOOR: 34,
  CRYPT_WALL: 35,
  CAVE_FLOOR: 36,
  CAVE_WALL: 37,
  TEMPLE_FLOOR: 38,
  TEMPLE_WALL: 39,
  TOWER_FLOOR: 40,
  TOWER_WALL: 41,
  PIT: 42,
  RUNE_FLOOR: 43,
  BLOOD_FLOOR: 44,
  ICE_FLOOR: 45,
  ICE_WALL: 46,
  SAND_FLOOR: 47,
  SAND_WALL: 48,
  AEGEAN_GRASS: 49,
  MARBLE: 50,
  MARBLE_WALL: 51,
  TERRACOTTA: 52,
  AEGEAN_SHALLOWS: 53,
  AEGEAN_SEA: 54,
  BASALT: 55,
  ASPHODEL: 56,
  STYGIAN: 57,
  BRONZE_FLOOR: 58,
} as const;

export type TileId = number;
export const TILE_COUNT = 59;

export interface TileDef {
  id: TileId;
  name: string;
  solid: boolean;
  /** Deep liquid — blocks movement but reads as water for visuals. */
  water: boolean;
  /** Movement multiplier applied while standing on it. */
  speed: number;
  /** Higher priority materials bleed over lower ones at the seam. */
  blend: number;
  /** Footstep sound family. */
  step: 'grass' | 'dirt' | 'stone' | 'wood' | 'water' | 'sand' | 'snow';
  /** Minimap colour. */
  map: string;
  /** Tiles with the same texture family blend seamlessly (no seam drawn). */
  family?: string;
}

const d = (
  id: TileId,
  name: string,
  opts: Partial<TileDef> & { map: string },
): TileDef => ({
  id,
  name,
  solid: false,
  water: false,
  speed: 1,
  blend: 10,
  step: 'grass',
  family: undefined,
  ...opts,
});

export const TILES: TileDef[] = [];

function reg(t: TileDef) {
  TILES[t.id] = t;
}

reg(d(T.VOID, 'Void', { solid: true, map: '#05040a', blend: 0 }));
reg(d(T.DEEP_WATER, 'Deep Water', { solid: true, water: true, map: '#152a45', blend: 60, step: 'water', family: 'water' }));
reg(d(T.WATER, 'Water', { solid: true, water: true, map: '#1f4a6d', blend: 58, step: 'water', family: 'water' }));
reg(d(T.AEGEAN_GRASS, 'Olive meadow', { map: '#819667', blend: 23, family: 'aegean-grass' }));
reg(d(T.MARBLE, 'Sunlit marble', { map: '#d9cfac', blend: 42, step: 'stone' }));
reg(d(T.MARBLE_WALL, 'Painted marble wall', { solid: true, map: '#9c987e', blend: 95, step: 'stone' }));
reg(d(T.TERRACOTTA, 'Terracotta earth', { map: '#b67d53', blend: 27, step: 'dirt' }));
reg(d(T.AEGEAN_SHALLOWS, 'Aegean shallows', { solid: true, water: true, map: '#388c9a', blend: 58, step: 'water', family: 'water' }));
reg(d(T.AEGEAN_SEA, 'Aegean sea', { solid: true, water: true, map: '#204667', blend: 60, step: 'water', family: 'water' }));
reg(d(T.BASALT, 'Basalt', { map: '#514c52', blend: 35, step: 'stone' }));
reg(d(T.ASPHODEL, 'Asphodel meadow', { map: '#898d82', blend: 25, step: 'grass' }));
reg(d(T.STYGIAN, 'Stygian river', { solid: true, water: true, map: '#3f5365', blend: 62, step: 'water', family: 'water' }));
reg(d(T.BRONZE_FLOOR, 'Oath bronze', { map: '#897444', blend: 43, step: 'stone' }));
reg(d(T.SAND, 'Sand', { map: '#c9a86b', blend: 40, step: 'sand', speed: 0.94 }));
reg(d(T.GRASS, 'Grass', { map: '#4e7a3c', blend: 20, step: 'grass' }));
reg(d(T.GRASS_DARK, 'Woodland', { map: '#3a5c33', blend: 22, step: 'grass' }));
reg(d(T.GRASS_PALE, 'Meadow', { map: '#6b9a4a', blend: 21, step: 'grass' }));
reg(d(T.TALL_GRASS, 'Tall Grass', { map: '#456f33', blend: 24, step: 'grass', speed: 0.85 }));
reg(d(T.FLOWERS, 'Wildflowers', { map: '#5d8a44', blend: 23, step: 'grass' }));
reg(d(T.DIRT, 'Dirt', { map: '#6b4b34', blend: 30, step: 'dirt' }));
reg(d(T.ROAD, 'Cobbled Road', { map: '#8a7f70', blend: 34, step: 'stone', speed: 1.12 }));
reg(d(T.ROAD_DIRT, 'Trail', { map: '#7d6042', blend: 32, step: 'dirt', speed: 1.07 }));
reg(d(T.FARM_SOIL, 'Tilled Soil', { map: '#513524', blend: 31, step: 'dirt', speed: 0.9 }));
reg(d(T.STONE_GROUND, 'Rocky Ground', { map: '#6c6879', blend: 35, step: 'stone' }));
reg(d(T.GRAVEL, 'Gravel', { map: '#7a7484', blend: 33, step: 'stone', speed: 0.96 }));
reg(d(T.MOUNTAIN, 'Mountain', { solid: true, map: '#4a4655', blend: 70, step: 'stone' }));
reg(d(T.CLIFF, 'Cliff', { solid: true, map: '#38304a', blend: 70, step: 'stone' }));
reg(d(T.SNOW, 'Snow', { map: '#dfe7f0', blend: 42, step: 'snow', speed: 0.92 }));
reg(d(T.SNOW_ROCK, 'Frozen Crag', { solid: true, map: '#b3c0d2', blend: 71, step: 'snow' }));
reg(d(T.ICE, 'Ice', { map: '#8fc4dc', blend: 44, step: 'snow', speed: 1.18 }));
reg(d(T.SWAMP_WATER, 'Bog', { water: true, map: '#2b361f', blend: 56, step: 'water', speed: 0.55 }));
reg(d(T.SWAMP_GROUND, 'Marsh', { map: '#41502c', blend: 26, step: 'dirt', speed: 0.9 }));
reg(d(T.MUD, 'Mud', { map: '#3a2a20', blend: 28, step: 'dirt', speed: 0.72 }));
reg(d(T.DESERT_SAND, 'Dunes', { map: '#e2c68c', blend: 38, step: 'sand', speed: 0.92 }));
reg(d(T.DESERT_ROCK, 'Sandstone', { map: '#a3823f', blend: 39, step: 'stone' }));
reg(d(T.ASH_GROUND, 'Ashland', { map: '#584d66', blend: 36, step: 'dirt' }));
reg(d(T.BRIDGE, 'Bridge', { map: '#7d5533', blend: 90, step: 'wood', speed: 1.05 }));
reg(d(T.FLOOR_WOOD, 'Floorboards', { map: '#7d5533', blend: 90, step: 'wood' }));
reg(d(T.FLOOR_STONE, 'Flagstones', { map: '#6c6879', blend: 90, step: 'stone' }));
reg(d(T.FLOOR_CARPET, 'Carpet', { map: '#8e2131', blend: 92, step: 'wood' }));
reg(d(T.WALL_WOOD, 'Timber Wall', { solid: true, map: '#33231a', blend: 95, step: 'wood' }));
reg(d(T.WALL_STONE, 'Stone Wall', { solid: true, map: '#38304a', blend: 95, step: 'stone' }));
reg(d(T.DUNGEON_FLOOR, 'Fortress Floor', { map: '#4a4655', blend: 90, step: 'stone' }));
reg(d(T.DUNGEON_WALL, 'Fortress Wall', { solid: true, map: '#2f2c38', blend: 95, step: 'stone' }));
reg(d(T.CRYPT_FLOOR, 'Crypt Floor', { map: '#3d3a4a', blend: 90, step: 'stone' }));
reg(d(T.CRYPT_WALL, 'Crypt Wall', { solid: true, map: '#241d2e', blend: 95, step: 'stone' }));
reg(d(T.CAVE_FLOOR, 'Cavern Floor', { map: '#4d4436', blend: 90, step: 'dirt' }));
reg(d(T.CAVE_WALL, 'Cavern Wall', { solid: true, map: '#2b2620', blend: 95, step: 'stone' }));
reg(d(T.TEMPLE_FLOOR, 'Temple Floor', { map: '#3f5a42', blend: 90, step: 'stone' }));
reg(d(T.TEMPLE_WALL, 'Temple Wall', { solid: true, map: '#25412a', blend: 95, step: 'stone' }));
reg(d(T.TOWER_FLOOR, 'Arcane Floor', { map: '#2b1f4d', blend: 90, step: 'stone' }));
reg(d(T.TOWER_WALL, 'Arcane Wall', { solid: true, map: '#1a1233', blend: 95, step: 'stone' }));
reg(d(T.PIT, 'Chasm', { solid: true, map: '#0b0910', blend: 99, step: 'stone' }));
reg(d(T.RUNE_FLOOR, 'Runed Floor', { map: '#5b43a8', blend: 91, step: 'stone' }));
reg(d(T.BLOOD_FLOOR, 'Stained Floor', { map: '#4a2a2f', blend: 91, step: 'stone' }));
reg(d(T.ICE_FLOOR, 'Glacial Floor', { map: '#8fc4dc', blend: 90, step: 'snow', speed: 1.1 }));
reg(d(T.ICE_WALL, 'Glacial Wall', { solid: true, map: '#6fa8c4', blend: 95, step: 'snow' }));
reg(d(T.SAND_FLOOR, 'Tomb Floor', { map: '#a3823f', blend: 90, step: 'sand' }));
reg(d(T.SAND_WALL, 'Tomb Wall', { solid: true, map: '#6d5426', blend: 95, step: 'stone' }));

for (let i = 0; i < TILE_COUNT; i++) {
  if (!TILES[i]) reg(d(i, 'Unknown', { map: '#ff00ff' }));
}

export const isSolid = (id: TileId): boolean => TILES[id]?.solid ?? true;
export const isWater = (id: TileId): boolean => TILES[id]?.water ?? false;
export const tileSpeed = (id: TileId): number => TILES[id]?.speed ?? 1;
export const isWall = (id: TileId): boolean => {
  const t = TILES[id];
  return !!t && t.solid && id !== T.PIT && id !== T.VOID;
};

/**
 * Walls stop a shot; water and pits do not. Both are solid to walk on, but an
 * arrow fired across a river should land on the far bank, not drop in.
 */
export const blocksProjectiles = (id: TileId): boolean => {
  const t = TILES[id];
  if (!t) return true;
  return t.solid && !t.water && id !== T.PIT;
};

export const TILE = 32;
