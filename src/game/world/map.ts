import { TILE, isSolid, isWall, isWater, tileSpeed, T, type TileId } from './tiles';

export type MapKind = 'overworld' | 'interior' | 'dungeon' | 'cave';

export interface PropInstance {
  art: string;
  x: number;
  y: number;
  /** Collision box: width/height in pixels, anchored at the prop's feet. */
  cw?: number;
  ch?: number;
  /** Light emitted by this prop. */
  light?: number;
  lightColor?: string;
  /** Animation phase offset so identical props don't tick in lockstep. */
  phase?: number;
  /** Draw below entities regardless of y-sorting (rugs, stairs). */
  flat?: boolean;
  /** Interaction hook id, resolved by the interaction system. */
  interact?: string;
  label?: string;
  /**
   * A permanent name plate drawn above this prop whenever the player is near.
   * Used on shop signs so a town tells you what every door is without you
   * having to walk up and read a prompt.
   */
  nameplate?: string;
  /** Accent colour for the name plate. */
  nameplateColor?: string;
  /** Free-form payload for the interaction (chest contents, sign text, ...). */
  data?: Record<string, unknown>;
}

export interface Portal {
  x: number;
  y: number;
  w: number;
  h: number;
  to: string;
  tx: number;
  ty: number;
  label: string;
  /** Marks a dungeon entrance for map icons. */
  kind?: 'door' | 'cave' | 'stairs' | 'portal';
  locked?: string;
}

export interface SpawnPoint {
  id: string;
  enemy: string;
  x: number;
  y: number;
  level: number;
  /** Wander radius. */
  radius: number;
  /** Seconds before a cleared spawn returns. Infinity for one-shot. */
  respawn: number;
  elite?: boolean;
  boss?: boolean;
  group?: number;
  /**
   * Which region's danger multiplier this spawn answers to. The overworld
   * fills it from the region grid; a dungeon fills it from the location it
   * hangs off, so an interior is as dangerous as the ground above it.
   */
  region?: string;
}

export interface MapChest {
  id: string;
  x: number;
  y: number;
  level: number;
  tier: 'small' | 'large' | 'boss';
  /** Guaranteed template ids. */
  fixed?: string[];
  gold?: number;
}

export interface GameMap {
  id: string;
  name: string;
  kind: MapKind;
  w: number;
  h: number;
  tiles: Uint8Array;
  props: PropInstance[];
  portals: Portal[];
  spawns: SpawnPoint[];
  chests: MapChest[];
  /** 0 = full daylight-driven lighting, 1 = pitch dark interior. */
  darkness: number;
  music: 'village' | 'world' | 'dungeon' | 'boss' | 'forest' | 'north' | 'desert';
  /** Outdoor maps follow the day/night cycle. */
  outdoor: boolean;
  /** Spatial buckets of prop indices, 256px cells. */
  propGrid?: Map<number, number[]>;
  /** Region id per tile for biome-aware behaviour (overworld only). */
  regions?: Uint8Array;
  bossId?: string;
  parent?: string;
  /** Authored encounter/controller ID. */
  encounter?: string;
  /** World-pixel anchors shared by authored geometry and encounter simulation. */
  encounterNodes?: Record<string, Array<{ x: number; y: number }>>;
  /** Distance through marine water to the connected mainland; 65535 is unreachable. */
  offshore?: Uint16Array;
  /** 0 sea, 1 Greek mainland, 2..17 smaller islands, 18 Asterion. */
  landmasses?: Uint8Array;
  /** Generation identity used by terrain/minimap caches. */
  revision?: string;
}

export const PROP_CELL = 256;

export function buildPropGrid(map: GameMap): void {
  const grid = new Map<number, number[]>();
  const cols = Math.ceil((map.w * TILE) / PROP_CELL) + 2;
  map.props.forEach((p, i) => {
    const cx = Math.floor(p.x / PROP_CELL);
    const cy = Math.floor(p.y / PROP_CELL);
    const key = cy * cols + cx;
    let arr = grid.get(key);
    if (!arr) grid.set(key, (arr = []));
    arr.push(i);
  });
  map.propGrid = grid;
  (map as GameMap & { _cols: number })._cols = cols;
}

export function propsInRect(map: GameMap, x0: number, y0: number, x1: number, y1: number, out: number[]): number[] {
  out.length = 0;
  if (!map.propGrid) buildPropGrid(map);
  const cols = (map as GameMap & { _cols: number })._cols;
  const cx0 = Math.floor(x0 / PROP_CELL);
  const cx1 = Math.floor(x1 / PROP_CELL);
  const cy0 = Math.floor(y0 / PROP_CELL);
  const cy1 = Math.floor(y1 / PROP_CELL);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const arr = map.propGrid!.get(cy * cols + cx);
      if (arr) for (const i of arr) out.push(i);
    }
  }
  return out;
}

export function createMap(opts: Partial<GameMap> & { id: string; name: string; w: number; h: number }): GameMap {
  return {
    kind: 'overworld',
    tiles: new Uint8Array(opts.w * opts.h),
    props: [],
    portals: [],
    spawns: [],
    chests: [],
    darkness: 0,
    music: 'world',
    outdoor: true,
    ...opts,
  };
}

export const tileIndex = (map: GameMap, tx: number, ty: number): number => ty * map.w + tx;

export function getTile(map: GameMap, tx: number, ty: number): TileId {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return T.VOID;
  return map.tiles[ty * map.w + tx];
}

export function setTile(map: GameMap, tx: number, ty: number, id: TileId): void {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return;
  map.tiles[ty * map.w + tx] = id;
}

export function fillRect(map: GameMap, tx: number, ty: number, w: number, h: number, id: TileId): void {
  for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) setTile(map, x, y, id);
}

export function tileAtPx(map: GameMap, x: number, y: number): TileId {
  return getTile(map, Math.floor(x / TILE), Math.floor(y / TILE));
}

export function solidAtPx(map: GameMap, x: number, y: number): boolean {
  return isSolid(tileAtPx(map, x, y));
}

export function speedAtPx(map: GameMap, x: number, y: number): number {
  return tileSpeed(tileAtPx(map, x, y));
}

/** Axis-aligned box test against terrain only. */
export type MovementProfile = 'foot' | 'ship' | 'swimmer' | 'flying';

export function tilePassable(id: TileId, profile: MovementProfile = 'foot'): boolean {
  if (id === T.VOID) return false;
  if (profile === 'ship' || profile === 'swimmer') return isWater(id) && id !== T.SWAMP_WATER;
  if (profile === 'flying') return (!isSolid(id) || isWater(id) || id === T.PIT) && id !== T.MOUNTAIN && id !== T.SNOW_ROCK;
  return !isSolid(id);
}

export function boxHitsTerrain(map: GameMap, x: number, y: number, hw: number, hh: number, profile: MovementProfile = 'foot'): boolean {
  const x0 = Math.floor((x - hw) / TILE);
  const x1 = Math.floor((x + hw) / TILE);
  const y0 = Math.floor((y - hh) / TILE);
  const y1 = Math.floor((y + hh) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!tilePassable(getTile(map, tx, ty), profile)) return true;
    }
  }
  return false;
}

export function isWallAt(map: GameMap, tx: number, ty: number): boolean {
  return isWall(getTile(map, tx, ty));
}

/** Nearest walkable pixel position to (x, y), searched in rings. */
export function findOpenNear(map: GameMap, x: number, y: number, hw = 8, hh = 6, maxRings = 24, profile: MovementProfile = 'foot'): { x: number; y: number } {
  if (!boxHitsTerrain(map, x, y, hw, hh, profile)) return { x, y };
  for (let r = 1; r <= maxRings; r++) {
    for (let i = 0; i < r * 8; i++) {
      const a = (i / (r * 8)) * Math.PI * 2;
      const nx = x + Math.cos(a) * r * TILE * 0.6;
      const ny = y + Math.sin(a) * r * TILE * 0.6;
      if (!boxHitsTerrain(map, nx, ny, hw, hh, profile)) return { x: nx, y: ny };
    }
  }
  return { x, y };
}
