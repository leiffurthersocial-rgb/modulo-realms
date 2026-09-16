import { RNG, fbm, ridge } from '../core/rng';
import {
  LOCATIONS, VILLAGE_TX, VILLAGE_TY, WORLD_H, WORLD_W, type LocationDef,
} from '../../data/locations';
import { T, isSolid } from './tiles';
import { TILE } from './tiles';
import { buildPropGrid, createMap, getTile, setTile, type GameMap, type PropInstance } from './map';
import { buildAshvale } from './village';
import { buildSettlement } from './settlements';

export const REGION_CENTRAL = 0;
export const REGION_NORTH = 1;
export const REGION_EAST = 2;
export const REGION_SOUTH = 3;
export const REGION_WEST = 4;

const CX = VILLAGE_TX;
const CY = VILLAGE_TY;

/** Which region a tile belongs to, with a noisy boundary so it never looks like a pie chart. */
function regionAt(tx: number, ty: number, seed: number): number {
  const warpX = (fbm(tx * 0.012, ty * 0.012, seed + 11) - 0.5) * 46;
  const warpY = (fbm(tx * 0.012, ty * 0.012, seed + 29) - 0.5) * 46;
  const dx = tx + warpX - CX;
  const dy = ty + warpY - CY;
  const d = Math.hypot(dx, dy);
  if (d < 62) return REGION_CENTRAL;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? REGION_EAST : REGION_WEST;
  return dy > 0 ? REGION_SOUTH : REGION_NORTH;
}

interface GenCtx {
  map: GameMap;
  rng: RNG;
  seed: number;
  elev: Float32Array;
  moist: Float32Array;
  regions: Uint8Array;
}

function baseTerrain(ctx: GenCtx) {
  const { map, seed, elev, moist, regions } = ctx;
  for (let ty = 0; ty < WORLD_H; ty++) {
    for (let tx = 0; tx < WORLD_W; tx++) {
      const i = ty * WORLD_W + tx;
      const e = fbm(tx * 0.014, ty * 0.014, seed, 5) * 0.72 + ridge(tx * 0.008, ty * 0.008, seed + 3, 3) * 0.28;
      const m = fbm(tx * 0.02, ty * 0.02, seed + 101, 4);
      elev[i] = e;
      moist[i] = m;
      const reg = regionAt(tx, ty, seed);
      regions[i] = reg;

      // impassable mountain rim keeps the world bounded
      const edge = Math.min(tx, ty, WORLD_W - 1 - tx, WORLD_H - 1 - ty);
      if (edge < 5) { map.tiles[i] = T.MOUNTAIN; continue; }
      const rim = edge < 14 ? (14 - edge) / 9 : 0;

      let tile: number;
      switch (reg) {
        case REGION_NORTH: {
          const eN = e + rim * 0.5;
          if (eN > 0.88) tile = T.SNOW_ROCK;
          else if (eN > 0.82) tile = T.MOUNTAIN;
          else if (m > 0.62) tile = T.SNOW;
          else if (m < 0.3) tile = T.GRAVEL;
          else tile = m > 0.48 ? T.SNOW : T.GRASS_DARK;
          if (e < 0.3 && m > 0.6) tile = T.ICE;
          break;
        }
        case REGION_EAST: {
          if (e + rim * 0.5 > 0.76) tile = T.MOUNTAIN;
          else if (e < 0.4 && m > 0.46) tile = T.SWAMP_WATER;
          else if (m > 0.58) tile = T.SWAMP_GROUND;
          else if (m < 0.32) tile = T.MUD;
          else tile = T.SWAMP_GROUND;
          break;
        }
        case REGION_SOUTH: {
          const eS = e + rim * 0.5;
          if (eS > 0.76) tile = T.MOUNTAIN;
          else if (eS > 0.64) tile = T.DESERT_ROCK;
          else if (m < 0.36) tile = T.DESERT_SAND;
          else if (m > 0.68) tile = T.SAND;
          else tile = T.DESERT_SAND;
          break;
        }
        case REGION_WEST: {
          if (e + rim * 0.5 > 0.78) tile = T.MOUNTAIN;
          else if (m > 0.6) tile = T.GRASS_DARK;
          else if (m > 0.44) tile = T.TALL_GRASS;
          else if (m < 0.28) tile = T.DIRT;
          else tile = T.GRASS_DARK;
          break;
        }
        default: {
          if (e + rim * 0.5 > 0.8) tile = T.MOUNTAIN;
          else if (e < 0.32) tile = T.WATER;
          else if (e < 0.35) tile = T.SAND;
          else if (m > 0.68) tile = T.GRASS_DARK;
          else if (m > 0.655) tile = T.FLOWERS;
          else if (m > 0.6) tile = T.TALL_GRASS;
          else if (m < 0.3) tile = T.DIRT;
          else if (m < 0.38) tile = T.GRASS_PALE;
          else tile = T.GRASS;
          break;
        }
      }
      map.tiles[i] = tile;
    }
  }
}

/** Carve a meandering river, widening as it runs, with sand banks. */
function carveRiver(ctx: GenCtx, x0: number, y0: number, x1: number, y1: number, width: number) {
  const { map, seed } = ctx;
  const steps = Math.round(Math.hypot(x1 - x0, y1 - y0) * 1.4);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const nx = fbm(t * 6, seed * 0.001, seed + 77, 3) - 0.5;
    const ny = fbm(t * 6, seed * 0.001, seed + 91, 3) - 0.5;
    const cx = Math.round(x0 + (x1 - x0) * t + nx * 26);
    const cy = Math.round(y0 + (y1 - y0) * t + ny * 26);
    const w = width + Math.sin(t * 9) * 1.2;
    for (let dy = -Math.ceil(w) - 2; dy <= Math.ceil(w) + 2; dy++) {
      for (let dx = -Math.ceil(w) - 2; dx <= Math.ceil(w) + 2; dx++) {
        const d = Math.hypot(dx, dy);
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx < 6 || ty < 6 || tx >= WORLD_W - 6 || ty >= WORLD_H - 6) continue;
        const cur = getTile(map, tx, ty);
        if (cur === T.MOUNTAIN || cur === T.SNOW_ROCK) continue;
        if (d <= w - 1.2) setTile(map, tx, ty, T.DEEP_WATER);
        else if (d <= w) setTile(map, tx, ty, T.WATER);
        else if (d <= w + 1.6 && cur !== T.WATER && cur !== T.DEEP_WATER) setTile(map, tx, ty, T.SAND);
      }
    }
  }
}

function carveLake(ctx: GenCtx, cx: number, cy: number, r: number) {
  const { map, seed } = ctx;
  for (let ty = cy - r - 3; ty <= cy + r + 3; ty++) {
    for (let tx = cx - r - 3; tx <= cx + r + 3; tx++) {
      const wob = (fbm(tx * 0.09, ty * 0.09, seed + 55, 3) - 0.5) * r * 0.55;
      const d = Math.hypot(tx - cx, ty - cy) + wob;
      if (d < r - 2) setTile(map, tx, ty, T.DEEP_WATER);
      else if (d < r) setTile(map, tx, ty, T.WATER);
      else if (d < r + 1.6) setTile(map, tx, ty, T.SAND);
    }
  }
}

/** Roads are laid before props so nothing is scattered on top of them. */
function carveRoad(ctx: GenCtx, x0: number, y0: number, x1: number, y1: number, width = 2, dirt = false) {
  const { map, seed } = ctx;
  const steps = Math.round(Math.hypot(x1 - x0, y1 - y0) * 1.6);
  const road = dirt ? T.ROAD_DIRT : T.ROAD;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const wob = (fbm(t * 4 + x0 * 0.01, y0 * 0.01, seed + 33, 3) - 0.5) * 20 * Math.sin(t * Math.PI);
    const perpX = -(y1 - y0);
    const perpY = x1 - x0;
    const len = Math.hypot(perpX, perpY) || 1;
    const cx = Math.round(x0 + (x1 - x0) * t + (perpX / len) * wob);
    const cy = Math.round(y0 + (y1 - y0) * t + (perpY / len) * wob);
    for (let dy = -width; dy <= width; dy++) {
      for (let dx = -width; dx <= width; dx++) {
        if (Math.hypot(dx, dy) > width) continue;
        const tx = cx + dx;
        const ty = cy + dy;
        const cur = getTile(map, tx, ty);
        if (cur === T.VOID) continue;
        if (cur === T.WATER || cur === T.DEEP_WATER || cur === T.SWAMP_WATER) {
          setTile(map, tx, ty, T.BRIDGE);
        } else if (cur === T.MOUNTAIN || cur === T.SNOW_ROCK || cur === T.CLIFF) {
          setTile(map, tx, ty, T.GRAVEL);
        } else {
          setTile(map, tx, ty, road);
        }
      }
    }
  }
}

const isRoadish = (t: number) => t === T.ROAD || t === T.ROAD_DIRT || t === T.BRIDGE;

function propAt(map: GameMap, tx: number, ty: number, art: string, opts: Partial<PropInstance> = {}) {
  map.props.push({
    art,
    x: tx * TILE + TILE / 2,
    y: ty * TILE + TILE,
    ...opts,
  });
}

/** Scatter biome-appropriate scenery across the whole map. */
function scatterProps(ctx: GenCtx) {
  const { map, rng, seed, regions } = ctx;
  const blocked = (tx: number, ty: number) => {
    const t = getTile(map, tx, ty);
    return t === T.VOID || isRoadish(t) || t === T.WATER || t === T.DEEP_WATER || t === T.MOUNTAIN ||
      t === T.SNOW_ROCK || t === T.CLIFF || t === T.BRIDGE;
  };

  for (let ty = 6; ty < WORLD_H - 6; ty++) {
    for (let tx = 6; tx < WORLD_W - 6; tx++) {
      const tile = getTile(map, tx, ty);
      if (blocked(tx, ty)) continue;
      // keep a clear ring around the home village
      const dHome = Math.hypot(tx - CX, ty - CY);
      if (dHome < 34) continue;
      const reg = regions[ty * WORLD_W + tx];
      const forest = fbm(tx * 0.045, ty * 0.045, seed + 404, 3);
      const r = rng.next();

      switch (reg) {
        case REGION_NORTH: {
          const density = tile === T.SNOW ? 0.05 : 0.07;
          if (forest > 0.56 && r < density * 2.4) propAt(map, tx, ty, rng.bool(0.75) ? 'tree_pine_snow' : 'tree_pine', { cw: 12, ch: 8 });
          else if (r < 0.012) propAt(map, tx, ty, 'rock_snow', { cw: 22, ch: 12 });
          else if (r < 0.02) propAt(map, tx, ty, 'shrub_dead');
          else if (r < 0.026 && tile === T.SNOW) propAt(map, tx, ty, 'grass_tuft');
          break;
        }
        case REGION_EAST: {
          if (tile === T.SWAMP_WATER) {
            if (r < 0.04) propAt(map, tx, ty, 'lilypad', { flat: true });
            else if (r < 0.07) propAt(map, tx, ty, 'reeds');
            break;
          }
          if (forest > 0.52 && r < 0.14) propAt(map, tx, ty, rng.bool(0.6) ? 'tree_willow' : 'tree_dead', { cw: 12, ch: 8 });
          else if (r < 0.03) propAt(map, tx, ty, 'mushroom_cluster');
          else if (r < 0.05) propAt(map, tx, ty, 'reeds');
          else if (r < 0.058) propAt(map, tx, ty, 'bone_pile');
          else if (r < 0.065) propAt(map, tx, ty, 'fern');
          break;
        }
        case REGION_SOUTH: {
          if (r < 0.014) propAt(map, tx, ty, 'cactus', { cw: 12, ch: 8 });
          else if (r < 0.026) propAt(map, tx, ty, 'rock_sand', { cw: 18, ch: 10 });
          else if (r < 0.032) propAt(map, tx, ty, 'shrub_dead');
          else if (r < 0.038 && forest > 0.6) propAt(map, tx, ty, 'tree_palm', { cw: 10, ch: 8 });
          else if (r < 0.042) propAt(map, tx, ty, 'bone_pile');
          break;
        }
        case REGION_WEST: {
          const density = forest > 0.5 ? 0.3 : 0.08;
          if (r < density) {
            const kind = forest > 0.66 ? (rng.bool(0.25) ? 'tree_magic' : 'tree_oak') : rng.bool(0.5) ? 'tree_oak' : 'tree_birch';
            propAt(map, tx, ty, kind, { cw: 13, ch: 9, phase: rng.range(0, 6) });
          } else if (r < density + 0.03) propAt(map, tx, ty, rng.bool() ? 'bush' : 'fern');
          else if (r < density + 0.045) propAt(map, tx, ty, 'mushroom_cluster');
          else if (r < density + 0.055) propAt(map, tx, ty, 'grass_tuft');
          break;
        }
        default: {
          if (forest > 0.62 && r < 0.2) propAt(map, tx, ty, rng.bool(0.5) ? 'tree_oak' : rng.bool(0.5) ? 'tree_birch' : 'tree_maple', { cw: 13, ch: 9, phase: rng.range(0, 6) });
          else if (r < 0.022) propAt(map, tx, ty, rng.bool() ? 'bush' : 'bush_berry');
          else if (r < 0.04) propAt(map, tx, ty, 'grass_tuft');
          else if (r < 0.047) propAt(map, tx, ty, 'rock_small', { cw: 14, ch: 8 });
          else if (r < 0.052) propAt(map, tx, ty, 'flower_none');
          break;
        }
      }
    }
  }
  // remove the placeholder used to keep the flower branch cheap
  map.props = map.props.filter((p) => p.art !== 'flower_none');
}

/* ------------------------------------------------------------------ */
/* Points of interest                                                  */
/* ------------------------------------------------------------------ */

function clearArea(map: GameMap, tx: number, ty: number, r: number, tile?: number) {
  map.props = map.props.filter((p) => {
    const px = p.x / TILE;
    const py = p.y / TILE;
    return Math.hypot(px - tx, py - ty) > r;
  });
  if (tile !== undefined) {
    for (let y = ty - r; y <= ty + r; y++) {
      for (let x = tx - r; x <= tx + r; x++) {
        if (Math.hypot(x - tx, y - ty) <= r) {
          const cur = getTile(map, x, y);
          if (cur !== T.WATER && cur !== T.DEEP_WATER) setTile(map, x, y, tile);
        }
      }
    }
  }
}

function buildCamp(ctx: GenCtx, loc: LocationDef) {
  const { map, rng } = ctx;
  const { tx, ty } = loc;
  clearArea(map, tx, ty, 9, undefined);
  const ground = loc.region === 'south' ? T.SAND : loc.region === 'north' ? T.GRAVEL : T.DIRT;
  for (let y = ty - 7; y <= ty + 7; y++) {
    for (let x = tx - 7; x <= tx + 7; x++) {
      if (Math.hypot(x - tx, y - ty) <= 7 && !isRoadish(getTile(map, x, y))) setTile(map, x, y, ground);
    }
  }
  propAt(map, tx, ty, 'campfire', { light: 150, lightColor: '#e8763a', cw: 18, ch: 10 });
  const spots: Array<[number, number]> = [[-5, -3], [5, -3], [-5, 3], [5, 3], [0, -6], [0, 6]];
  spots.forEach(([dx, dy], i) => {
    if (i % 2 === 0) propAt(map, tx + dx, ty + dy, 'tent', { cw: 56, ch: 30 });
    else propAt(map, tx + dx, ty + dy, rng.bool() ? 'crate' : 'barrel', { cw: 18, ch: 12 });
  });
  propAt(map, tx - 8, ty, 'cart', { cw: 40, ch: 16 });
  propAt(map, tx + 8, ty - 5, 'weapon_rack', { cw: 24, ch: 10 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    propAt(map, Math.round(tx + Math.cos(a) * 9), Math.round(ty + Math.sin(a) * 9), 'torch', { light: 120, lightColor: '#e8763a', cw: 8, ch: 6 });
  }
  map.chests.push({ id: `chest_${loc.id}`, x: (tx + 3) * TILE, y: (ty - 6) * TILE, level: loc.level ?? 5, tier: 'large' });
}

function buildLandmark(ctx: GenCtx, loc: LocationDef) {
  const { map, rng } = ctx;
  const { tx, ty } = loc;
  clearArea(map, tx, ty, 7);
  switch (loc.id) {
    case 'standing_stones':
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        propAt(map, Math.round(tx + Math.cos(a) * 6), Math.round(ty + Math.sin(a) * 6), 'obelisk', { cw: 16, ch: 10, light: 60, lightColor: '#9578e8' });
      }
      propAt(map, tx, ty, 'shrine', { light: 130, lightColor: '#ffe9a8', cw: 20, ch: 12, interact: 'shrine', label: 'Pray at the shrine' });
      break;
    case 'drowned_shrine':
    case 'frost_altar':
      clearArea(map, tx, ty, 5, loc.id === 'frost_altar' ? T.ICE : T.SWAMP_GROUND);
      propAt(map, tx, ty, 'shrine', { light: 140, lightColor: loc.id === 'frost_altar' ? '#6fd0e8' : '#ffe9a8', cw: 20, ch: 12, interact: 'shrine', label: 'Pray at the shrine' });
      for (let i = 0; i < 4; i++) propAt(map, tx + rng.int(-5, 5), ty + rng.int(-5, 5), 'pillar_broken', { cw: 16, ch: 8 });
      break;
    case 'hermit_hut':
      clearArea(map, tx, ty, 6, T.DIRT);
      propAt(map, tx, ty, 'campfire', { light: 140, lightColor: '#e8763a', cw: 18, ch: 10 });
      propAt(map, tx - 4, ty - 2, 'cauldron', { cw: 20, ch: 12 });
      propAt(map, tx + 4, ty + 1, 'crate', { cw: 18, ch: 12 });
      break;
    case 'sunken_wreck':
      clearArea(map, tx, ty, 5, T.SAND);
      propAt(map, tx, ty, 'cart', { cw: 40, ch: 16 });
      propAt(map, tx + 3, ty + 2, 'crate', { cw: 18, ch: 12 });
      propAt(map, tx - 3, ty + 1, 'barrel', { cw: 16, ch: 12 });
      propAt(map, tx + 1, ty - 3, 'bone_pile');
      map.chests.push({ id: `chest_${loc.id}`, x: tx * TILE, y: (ty + 2) * TILE, level: loc.level ?? 6, tier: 'large' });
      break;
    case 'watchers_ring':
    case 'lost_chapel':
      clearArea(map, tx, ty, 8, T.GRAVEL);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        propAt(map, Math.round(tx + Math.cos(a) * 7), Math.round(ty + Math.sin(a) * 7), rng.bool(0.5) ? 'pillar' : 'pillar_broken', { cw: 16, ch: 10 });
      }
      propAt(map, tx, ty, 'altar', { cw: 36, ch: 14 });
      propAt(map, tx, ty - 5, 'ruin_arch', { cw: 50, ch: 14 });
      map.chests.push({ id: `chest_${loc.id}`, x: tx * TILE, y: ty * TILE + 40, level: loc.level ?? 9, tier: 'large' });
      break;
    case 'ember_falls':
      clearArea(map, tx, ty, 6, T.STONE_GROUND);
      for (let i = 0; i < 6; i++) propAt(map, tx + rng.int(-5, 5), ty + rng.int(-5, 5), 'rock_big', { cw: 26, ch: 12 });
      propAt(map, tx, ty - 2, 'brazier', { light: 150, lightColor: '#e8763a', cw: 14, ch: 10 });
      break;
    case 'old_bridge':
      for (let i = 0; i < 4; i++) propAt(map, tx - 4 + i * 3, ty - 4, 'lantern', { light: 110, lightColor: '#f6bf5d' });
      break;
    default:
      propAt(map, tx, ty, 'ruin_arch', { cw: 50, ch: 14 });
      break;
  }
}

function buildDungeonEntrance(ctx: GenCtx, loc: LocationDef) {
  const { map } = ctx;
  const { tx, ty } = loc;
  const theme = loc.dungeon!.theme;
  clearArea(map, tx, ty, 8, theme === 'grove' ? T.TEMPLE_FLOOR : theme === 'tomb' ? T.DESERT_ROCK : T.GRAVEL);
  const art = theme === 'mine' ? 'cave_mouth' : theme === 'grove' ? 'ruin_arch' : theme === 'spire' ? 'portal' : 'cave_mouth';
  propAt(map, tx, ty, art, { cw: 52, ch: 20, light: theme === 'spire' ? 160 : 0, lightColor: '#9578e8' });
  if (theme !== 'mine') {
    propAt(map, tx - 4, ty + 1, 'pillar', { cw: 16, ch: 10 });
    propAt(map, tx + 4, ty + 1, 'pillar', { cw: 16, ch: 10 });
  }
  propAt(map, tx - 3, ty + 3, 'brazier', { light: 160, lightColor: '#e8763a', cw: 14, ch: 10 });
  propAt(map, tx + 3, ty + 3, 'brazier', { light: 160, lightColor: '#e8763a', cw: 14, ch: 10 });
  propAt(map, tx - 6, ty + 3, 'waystone', {
    cw: 46, ch: 22, light: 150, lightColor: '#4f9ce8',
    interact: 'waystone', label: 'Use the waystone', data: { site: loc.id },
  });
  propAt(map, tx, ty + 4, 'signpost', { cw: 12, ch: 8, interact: 'sign', label: 'Read the marker', data: { text: `${loc.name} — recommended level ${loc.dungeon!.level}` } });

  map.portals.push({
    x: tx * TILE - 26,
    y: ty * TILE - 10,
    w: 52,
    h: 40,
    to: loc.dungeon!.mapId,
    tx: 0,
    ty: 0,
    label: `Enter ${loc.name}`,
    kind: theme === 'mine' ? 'cave' : 'stairs',
  });
}

/* ------------------------------------------------------------------ */
/* Spawns                                                              */
/* ------------------------------------------------------------------ */

const REGION_SPAWNS: Record<number, Array<{ id: string; weight: number; level: [number, number] }>> = {
  [REGION_CENTRAL]: [
    { id: 'wolf', weight: 10, level: [1, 4] },
    { id: 'slime', weight: 8, level: [1, 3] },
    { id: 'goblin', weight: 7, level: [2, 5] },
    { id: 'spider', weight: 6, level: [1, 4] },
    { id: 'boar', weight: 5, level: [2, 5] },
    { id: 'bandit', weight: 4, level: [3, 6] },
  ],
  [REGION_NORTH]: [
    { id: 'frostwolf', weight: 9, level: [10, 15] },
    { id: 'orc_raider', weight: 8, level: [9, 15] },
    { id: 'direwolf', weight: 6, level: [8, 12] },
    { id: 'wraith', weight: 5, level: [10, 15] },
    { id: 'golem', weight: 4, level: [11, 16] },
    { id: 'revenant_knight', weight: 2, level: [13, 17] },
  ],
  [REGION_EAST]: [
    { id: 'venomspider', weight: 9, level: [6, 11] },
    { id: 'toxicslime', weight: 8, level: [6, 10] },
    { id: 'serpent', weight: 7, level: [6, 11] },
    { id: 'crawler', weight: 6, level: [5, 9] },
    { id: 'goblin_shaman', weight: 4, level: [6, 10] },
    { id: 'wisp', weight: 4, level: [5, 9] },
  ],
  [REGION_SOUTH]: [
    { id: 'bandit', weight: 9, level: [6, 11] },
    { id: 'bandit_archer', weight: 8, level: [7, 12] },
    { id: 'scorpion', weight: 8, level: [7, 12] },
    { id: 'bandit_brute', weight: 5, level: [8, 13] },
    { id: 'sandgolem', weight: 3, level: [11, 14] },
    { id: 'crawler', weight: 3, level: [6, 10] },
  ],
  [REGION_WEST]: [
    { id: 'spider', weight: 8, level: [4, 8] },
    { id: 'wisp', weight: 8, level: [5, 10] },
    { id: 'sapling', weight: 7, level: [7, 12] },
    { id: 'direwolf', weight: 6, level: [6, 11] },
    { id: 'venomspider', weight: 4, level: [8, 12] },
    { id: 'emberwisp', weight: 3, level: [10, 13] },
  ],
};

function placeSpawns(ctx: GenCtx) {
  const { map, rng, regions } = ctx;
  let id = 0;
  const attempts = 1700;
  for (let i = 0; i < attempts; i++) {
    const tx = rng.int(10, WORLD_W - 10);
    const ty = rng.int(10, WORLD_H - 10);
    const tile = getTile(map, tx, ty);
    if (tile === T.MOUNTAIN || tile === T.SNOW_ROCK || tile === T.CLIFF || tile === T.WATER || tile === T.DEEP_WATER || tile === T.VOID) continue;
    const dHome = Math.hypot(tx - CX, ty - CY);
    if (dHome < 26) continue;
    // keep settlements safe
    let nearTown = false;
    for (const loc of LOCATIONS) {
      const safe = loc.kind === 'town' ? 46 : loc.kind === 'village' ? 30 : 0;
      if (safe && Math.hypot(tx - loc.tx, ty - loc.ty) < safe) { nearTown = true; break; }
    }
    if (nearTown) continue;

    const reg = regions[ty * WORLD_W + tx];
    const table = REGION_SPAWNS[reg];
    const pick = rng.weighted(table, table.map((t) => t.weight));
    const group = rng.bool(0.3) ? rng.int(2, 4) : 1;
    const level = rng.int(pick.level[0], pick.level[1]) + (dHome > 130 ? 1 : 0);
    map.spawns.push({
      id: `s${id++}`,
      enemy: pick.id,
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2,
      level,
      radius: 150,
      respawn: 150 + rng.range(0, 120),
      group,
      elite: rng.bool(0.035),
    });
  }

  // camp garrisons
  for (const loc of LOCATIONS.filter((l) => l.kind === 'camp')) {
    const roster = loc.id === 'crag_camp'
      ? ['orc_raider', 'orc_raider', 'direwolf']
      : loc.id === 'goblin_warren'
        ? ['goblin', 'goblin', 'goblin', 'goblin_shaman']
        : ['bandit', 'bandit_archer', 'bandit', 'bandit_brute'];
    roster.forEach((e, k) => {
      const a = (k / roster.length) * Math.PI * 2;
      map.spawns.push({
        id: `camp_${loc.id}_${k}`,
        enemy: e,
        x: (loc.tx + Math.cos(a) * 5) * TILE,
        y: (loc.ty + Math.sin(a) * 5) * TILE,
        level: loc.level ?? 6,
        radius: 200,
        respawn: 150,
      });
    });
  }

  // named outdoor miniboss
  map.spawns.push({
    id: 'mini_cutter_captain',
    enemy: 'mini_captain',
    x: LOCATIONS.find((l) => l.id === 'cutter_camp')!.tx * TILE,
    y: (LOCATIONS.find((l) => l.id === 'cutter_camp')!.ty - 3) * TILE,
    level: 8,
    radius: 280,
    respawn: Infinity,
    elite: true,
  });
}

function placeTreasure(ctx: GenCtx) {
  const { map, rng } = ctx;
  for (let i = 0; i < 46; i++) {
    const tx = rng.int(14, WORLD_W - 14);
    const ty = rng.int(14, WORLD_H - 14);
    const tile = getTile(map, tx, ty);
    if (tile === T.MOUNTAIN || tile === T.WATER || tile === T.DEEP_WATER || tile === T.SNOW_ROCK || tile === T.VOID || isRoadish(tile)) continue;
    const d = Math.hypot(tx - CX, ty - CY);
    if (d < 30) continue;
    map.chests.push({
      id: `wchest${i}`,
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE,
      level: Math.max(1, Math.min(18, Math.round(d / 14))),
      tier: rng.bool(0.25) ? 'large' : 'small',
    });
  }
}

/* ------------------------------------------------------------------ */


/**
 * Noise-driven mountains can wall a region off entirely. This flood-fills the
 * walkable world from the home village, then tunnels a path to any sizeable
 * pocket it could not reach, so every part of the map stays on foot.
 */
/**
 * Sand is a shoreline, not a biome. The elevation band that produces it can
 * land on a wide inland plateau and paint a desert into the middle of a green
 * valley, so anything too far from water goes back to meadow.
 */
function trimInlandSand(ctx: GenCtx): void {
  const { map } = ctx;
  const nearWater = (tx: number, ty: number) => {
    for (let oy = -3; oy <= 3; oy++) {
      for (let ox = -3; ox <= 3; ox++) {
        const t = getTile(map, tx + ox, ty + oy);
        if (t === T.WATER || t === T.DEEP_WATER || t === T.SWAMP_WATER) return true;
      }
    }
    return false;
  };
  const fixes: Array<[number, number]> = [];
  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      // the southern desert's sand is meant to be there
      if (ctx.regions[ty * map.w + tx] !== REGION_CENTRAL) continue;
      if (getTile(map, tx, ty) !== T.SAND) continue;
      if (nearWater(tx, ty)) continue;
      fixes.push([tx, ty]);
    }
  }
  for (const [tx, ty] of fixes) setTile(map, tx, ty, T.GRASS_PALE);
}

function ensureConnectivity(ctx: GenCtx): void {
  const { map } = ctx;
  const W = WORLD_W;
  const H = WORLD_H;
  const N = W * H;
  const open = (i: number) => !isSolid(map.tiles[i]);
  const seen = new Uint8Array(N);
  const queue = new Int32Array(N);

  const flood = (from: number): void => {
    let head = 0;
    let tail = 0;
    if (!open(from) || seen[from]) return;
    seen[from] = 1;
    queue[tail++] = from;
    while (head < tail) {
      const i = queue[head++];
      const x = i % W;
      const y = (i / W) | 0;
      if (x > 0 && !seen[i - 1] && open(i - 1)) { seen[i - 1] = 1; queue[tail++] = i - 1; }
      if (x < W - 1 && !seen[i + 1] && open(i + 1)) { seen[i + 1] = 1; queue[tail++] = i + 1; }
      if (y > 0 && !seen[i - W] && open(i - W)) { seen[i - W] = 1; queue[tail++] = i - W; }
      if (y < H - 1 && !seen[i + W] && open(i + W)) { seen[i + W] = 1; queue[tail++] = i + W; }
    }
  };

  flood(CY * W + CX);

  const parent = new Int32Array(N);
  const visit = new Int32Array(N);
  let stamp = 0;

  /** Dig from an unreachable pocket to the nearest reachable tile. */
  const tunnel = (seeds: number[]): void => {
    stamp++;
    let head = 0;
    let tail = 0;
    for (const s of seeds) {
      visit[s] = stamp;
      parent[s] = -1;
      queue[tail++] = s;
    }
    while (head < tail) {
      const i = queue[head++];
      if (seen[i]) {
        // walk the path back, carving anything solid into passable ground
        let cur = i;
        while (cur !== -1) {
          const cx = cur % W;
          const cy = (cur / W) | 0;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const nx = cx + ox;
              const ny = cy + oy;
              if (nx < 4 || ny < 4 || nx >= W - 4 || ny >= H - 4) continue;
              const ni = ny * W + nx;
              const t = map.tiles[ni];
              if (t === T.MOUNTAIN || t === T.CLIFF || t === T.SNOW_ROCK) {
                map.tiles[ni] = ctx.regions[ni] === REGION_NORTH ? T.SNOW : T.GRAVEL;
              }
            }
          }
          cur = parent[cur];
        }
        return;
      }
      const x = i % W;
      const y = (i / W) | 0;
      const push = (ni: number) => {
        if (visit[ni] === stamp) return;
        visit[ni] = stamp;
        parent[ni] = i;
        queue[tail++] = ni;
      };
      if (x > 4) push(i - 1);
      if (x < W - 5) push(i + 1);
      if (y > 4) push(i - W);
      if (y < H - 5) push(i + W);
    }
  };

  // find pockets the first flood missed and connect the meaningful ones
  const comp = new Int32Array(N);
  let compStamp = 0;
  for (let i = 0; i < N; i++) {
    if (seen[i] || !open(i) || comp[i]) continue;
    compStamp++;
    const cells: number[] = [];
    let head = 0;
    let tail = 0;
    comp[i] = compStamp;
    queue[tail++] = i;
    while (head < tail) {
      const j = queue[head++];
      cells.push(j);
      const x = j % W;
      const y = (j / W) | 0;
      const push = (nj: number) => {
        if (comp[nj] || !open(nj)) return;
        comp[nj] = compStamp;
        queue[tail++] = nj;
      };
      if (x > 0) push(j - 1);
      if (x < W - 1) push(j + 1);
      if (y > 0) push(j - W);
      if (y < H - 1) push(j + W);
    }
    // tiny hollows inside a crag are scenery, not a problem
    if (cells.length < 40) continue;
    tunnel(cells);
    for (const c of cells) flood(c);
  }
}

export function generateOverworld(seed: number): GameMap {
  const map = createMap({
    id: 'overworld',
    name: 'Ashvale Valley',
    kind: 'overworld',
    w: WORLD_W,
    h: WORLD_H,
    music: 'world',
    outdoor: true,
    darkness: 0,
  });
  const rng = new RNG(seed ^ 0x5a17);
  const ctx: GenCtx = {
    map,
    rng,
    seed,
    elev: new Float32Array(WORLD_W * WORLD_H),
    moist: new Float32Array(WORLD_W * WORLD_H),
    regions: new Uint8Array(WORLD_W * WORLD_H),
  };

  baseTerrain(ctx);
  map.regions = ctx.regions;

  // water features
  carveLake(ctx, CX + 38, CY - 26, 13);
  carveRiver(ctx, 176, 30, 214, 150, 3.2);
  carveRiver(ctx, 214, 150, 300, 214, 3.6);
  carveRiver(ctx, 120, 210, 60, 300, 2.8);

  // roads between every settlement and the capital, then on to the dungeons
  const towns = LOCATIONS.filter((l) => l.kind === 'village' || l.kind === 'town');
  for (const t of towns) {
    if (t.id === 'ashvale') continue;
    carveRoad(ctx, CX, CY, t.tx, t.ty, 2);
  }
  carveRoad(ctx, 190, 86, 252, 118, 1, true);
  carveRoad(ctx, 190, 86, 146, 46, 1, true);
  carveRoad(ctx, 198, 300, 246, 332, 1, true);
  carveRoad(ctx, 198, 300, 118, 268, 1, true);
  carveRoad(ctx, 84, 188, 56, 148, 1, true);
  carveRoad(ctx, 300, 204, 264, 158, 1, true);
  carveRoad(ctx, CX, CY, 136, 244, 1, true);
  carveRoad(ctx, CX + 20, CY, 232, 262, 1, true);

  trimInlandSand(ctx);
  ensureConnectivity(ctx);
  scatterProps(ctx);

  // settlements and points of interest
  buildAshvale(map, rng);
  for (const loc of LOCATIONS) {
    if (loc.kind === 'village') buildSettlement(map, rng, loc);
    else if (loc.kind === 'camp') buildCamp(ctx, loc);
    else if (loc.kind === 'dungeon' || loc.kind === 'cave') buildDungeonEntrance(ctx, loc);
    else if (loc.kind !== 'town') buildLandmark(ctx, loc);
  }

  placeSpawns(ctx);
  placeTreasure(ctx);
  buildPropGrid(map);
  return map;
}

export const worldPixelSize = { w: WORLD_W * TILE, h: WORLD_H * TILE };
