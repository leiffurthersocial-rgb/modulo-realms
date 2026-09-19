import { RNG, fbm, ridge } from '../core/rng';
import {
  LOCATIONS, LOCATION_BY_ID, VILLAGE_TX, VILLAGE_TY, WORLD_H, WORLD_W, type LocationDef,
} from '../../data/locations';
import { MAX_CONTENT_LEVEL } from '../../data/balance';
import { T, isSolid } from './tiles';
import { TILE } from './tiles';
import { buildPropGrid, createMap, getTile, setTile, type GameMap, type PropInstance } from './map';
import { buildAshvale, drainFor } from './village';
import { buildSettlement } from './settlements';

export const REGION_CENTRAL = 0;
export const REGION_NORTH = 1;
export const REGION_EAST = 2;
export const REGION_SOUTH = 3;
export const REGION_WEST = 4;
export const REGION_DEEPNORTH = 5;
export const REGION_FARWEST = 6;
export const REGION_FAREAST = 7;
export const REGION_FARSOUTH = 8;
export const REGION_SUNKENWEST = 9;
export const REGION_STORMEAST = 10;
export const REGION_EMBERDEEP = 11;

const CX = VILLAGE_TX;
const CY = VILLAGE_TY;

/**
 * The latitude above which the Crag Reach gives way to the Jotunreach. The
 * deep north is a band rather than a quadrant: once you are far enough up the
 * map there is nothing else, which is what makes walking there feel like an
 * expedition instead of a border crossing.
 */
const DEEPNORTH_Y = 200;

/**
 * The outer marches. Like the Jotunreach these are bands rather than
 * quadrants: cross one of these lines and there is nothing on the other side
 * but the march, which is what makes the edge of the map feel like an edge.
 */
const FARWEST_X = 246;
const FAREAST_X = 716;
const FARSOUTH_Y = 690;

/**
 * The deep marches, outside the outer ones. Same idea one step further out:
 * past these lines the world is nothing but the march, and the walk to reach
 * one is most of what makes it feel like the end of the map.
 */
const SUNKENWEST_X = 140;
const STORMEAST_X = 828;
const EMBERDEEP_Y = 918;

/** Which region a tile belongs to, with a noisy boundary so it never looks like a pie chart. */
function regionAt(tx: number, ty: number, seed: number): number {
  // Two octaves of domain warp: a broad one that bends whole borders and a
  // finer one that frays their edges, so the nine regions never read as a pie
  // chart even across a map this size.
  const warpX = (fbm(tx * 0.007, ty * 0.007, seed + 11) - 0.5) * 96
    + (fbm(tx * 0.028, ty * 0.028, seed + 41) - 0.5) * 26;
  const warpY = (fbm(tx * 0.007, ty * 0.007, seed + 29) - 0.5) * 96
    + (fbm(tx * 0.028, ty * 0.028, seed + 59) - 0.5) * 26;
  // Every march's inner edge is a ragged line, not a coordinate.
  // The deep marches are tested before everything else, so they own the
  // corners outright rather than being carved out of a neighbour.
  const emberEdge = EMBERDEEP_Y + (fbm(tx * 0.011, 0.5, seed + 181, 3) - 0.5) * 52;
  if (ty + warpY * 0.5 > emberEdge) return REGION_EMBERDEEP;
  const swEdge = SUNKENWEST_X + (fbm(0.5, ty * 0.011, seed + 193, 3) - 0.5) * 48;
  if (tx + warpX * 0.5 < swEdge) return REGION_SUNKENWEST;
  const seEdge = STORMEAST_X + (fbm(0.5, ty * 0.011, seed + 211, 3) - 0.5) * 48;
  if (tx + warpX * 0.5 > seEdge) return REGION_STORMEAST;
  const iceEdge = DEEPNORTH_Y + (fbm(tx * 0.013, 0.5, seed + 97, 3) - 0.5) * 46;
  if (ty + warpY * 0.5 < iceEdge) return REGION_DEEPNORTH;
  const wEdge = FARWEST_X + (fbm(0.5, ty * 0.013, seed + 131, 3) - 0.5) * 44;
  if (tx + warpX * 0.5 < wEdge) return REGION_FARWEST;
  const eEdge = FAREAST_X + (fbm(0.5, ty * 0.013, seed + 149, 3) - 0.5) * 44;
  if (tx + warpX * 0.5 > eEdge) return REGION_FAREAST;
  const sEdge = FARSOUTH_Y + (fbm(tx * 0.013, 0.5, seed + 167, 3) - 0.5) * 44;
  if (ty + warpY * 0.5 > sEdge) return REGION_FARSOUTH;
  const dx = tx + warpX - CX;
  const dy = ty + warpY - CY;
  const d = Math.hypot(dx, dy);
  // the central valley's own edge wobbles too
  const lobe = 83 + (fbm(Math.atan2(dy, dx) * 1.4, 0.5, seed + 71, 3) - 0.5) * 34;
  if (d < lobe) return REGION_CENTRAL;
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
        case REGION_SUNKENWEST: {
          // The Drowning Reach. The Gloaming runs out into black water that
          // is still rising: more water than land, reed flats where it is
          // shallow, and drowned wood standing in it that never fell over.
          const eSW = e + rim * 0.5;
          if (eSW > 0.82) tile = T.CLIFF;
          else if (e < 0.42) tile = T.SWAMP_WATER;
          else if (e < 0.48) tile = T.MUD;
          else if (m > 0.6) tile = T.GRASS_DARK;
          else tile = m > 0.42 ? T.TALL_GRASS : T.MUD;
          break;
        }
        case REGION_STORMEAST: {
          // The Stormreach. Past the salt the sky stops clearing. Bare flat
          // struck to glass in patches, gravel where it has been broken up
          // again, and standing water that never quite dries.
          const eSE = e + rim * 0.5;
          if (eSE > 0.8) tile = T.MOUNTAIN;
          else if (eSE > 0.7) tile = T.STONE_GROUND;
          else if (e < 0.31) tile = T.WATER;
          else if (m > 0.64) tile = T.GRAVEL;
          else if (m < 0.36) tile = T.STONE_GROUND;
          else tile = T.SAND;
          break;
        }
        case REGION_EMBERDEEP: {
          // The Emberdeep: the floor of the world. Ash over rock over
          // something that is still hot, and the ground is broken enough that
          // most routes through it are single file.
          const eED = e + rim * 0.5;
          if (eED > 0.72) tile = T.MOUNTAIN;
          else if (eED > 0.6) tile = T.DESERT_ROCK;
          else if (m > 0.66) tile = T.GRAVEL;
          else if (m < 0.3) tile = T.STONE_GROUND;
          else tile = T.ASH_GROUND;
          break;
        }
        case REGION_FARWEST: {
          // The Gloaming. The canopy closes over entirely: dark ground, deep
          // moss, standing water in the hollows, and cliffs where the old
          // wood grew over rock and then grew through it.
          const eW = e + rim * 0.5;
          if (eW > 0.8) tile = T.CLIFF;
          else if (eW > 0.74) tile = T.MOUNTAIN;
          else if (e < 0.27 && m > 0.55) tile = T.SWAMP_WATER;
          else if (m > 0.62) tile = T.GRASS_DARK;
          else if (m < 0.3) tile = T.DIRT;
          else tile = m > 0.46 ? T.GRASS_DARK : T.TALL_GRASS;
          break;
        }
        case REGION_FAREAST: {
          // The Saltreach: where the Mire runs out into a dead sea. Salt
          // flats, shallow tide, and bare rock where the water has not
          // reached yet.
          const eE = e + rim * 0.5;
          if (eE > 0.78) tile = T.MOUNTAIN;
          else if (e < 0.3) tile = T.WATER;
          else if (e < 0.35) tile = T.SAND;
          else if (m > 0.66) tile = T.MUD;
          else if (m < 0.34) tile = T.STONE_GROUND;
          else tile = T.SAND;
          break;
        }
        case REGION_FARSOUTH: {
          // The Cinderwastes. Under Duneholt the sand turns to ash, and the
          // ash is warm. Nothing has grown here in a long time.
          const eS2 = e + rim * 0.5;
          if (eS2 > 0.76) tile = T.MOUNTAIN;
          else if (eS2 > 0.66) tile = T.DESERT_ROCK;
          else if (m > 0.6) tile = T.GRAVEL;
          else if (m < 0.32) tile = T.DESERT_SAND;
          else tile = T.ASH_GROUND;
          break;
        }
        case REGION_DEEPNORTH: {
          // Glacier. Bare ice where the sheet is thick, wind-packed snow over
          // most of it, moraine gravel where it has ground the rock down, and
          // crags that wall whole valleys off. It is meant to read as a place
          // that was never meant to be crossed.
          const eD = e + rim * 0.55;
          if (eD > 0.8) tile = T.SNOW_ROCK;
          else if (eD > 0.74) tile = T.MOUNTAIN;
          else if (m > 0.66) tile = T.ICE;
          else if (m < 0.3) tile = T.GRAVEL;
          else tile = T.SNOW;
          break;
        }
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
          // the mire is meant to be wet, but standing bog is impassable, so
          // it is kept to genuinely low, genuinely damp ground
          else if (e < 0.33 && m > 0.58) tile = T.SWAMP_WATER;
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
          // The home valley is where the player spends the first ten levels
          // and is the one region that must never generate as a lake district.
          // Standing water needs genuinely low ground; the rivers and the two
          // placed lakes supply all the water this region needs.
          else if (e < 0.235) tile = T.WATER;
          else if (e < 0.26) tile = T.SAND;
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
        case REGION_FARWEST: {
          // Denser than Thornhollow and darker with it: the Gloaming is the
          // only place on the map where the trees are the terrain.
          const density = forest > 0.42 ? 0.42 : 0.14;
          if (r < density) {
            const kind = forest > 0.6 ? (rng.bool(0.4) ? 'tree_magic' : 'tree_dead') : rng.bool(0.5) ? 'tree_oak' : 'tree_willow';
            propAt(map, tx, ty, kind, { cw: 13, ch: 9, phase: rng.range(0, 6) });
          } else if (r < density + 0.04) propAt(map, tx, ty, 'mushroom_cluster');
          else if (r < density + 0.06) propAt(map, tx, ty, rng.bool() ? 'fern' : 'bush');
          else if (r < density + 0.07) propAt(map, tx, ty, 'bone_pile');
          else if (r < density + 0.078) propAt(map, tx, ty, 'stump');
          break;
        }
        case REGION_FAREAST: {
          if (tile === T.WATER) break;
          if (r < 0.03) propAt(map, tx, ty, 'reeds');
          else if (r < 0.045) propAt(map, tx, ty, 'rock_small', { cw: 14, ch: 8 });
          else if (r < 0.055) propAt(map, tx, ty, 'bone_pile');
          else if (r < 0.062 && forest > 0.62) propAt(map, tx, ty, 'tree_dead', { cw: 12, ch: 8 });
          else if (r < 0.07) propAt(map, tx, ty, 'pillar_broken', { cw: 14, ch: 10 });
          break;
        }
        case REGION_FARSOUTH: {
          if (r < 0.016) propAt(map, tx, ty, 'rock_big', { cw: 22, ch: 12 });
          else if (r < 0.026) propAt(map, tx, ty, 'shrub_dead');
          else if (r < 0.034) propAt(map, tx, ty, 'bone_pile');
          else if (r < 0.04) propAt(map, tx, ty, 'stalagmite');
          else if (r < 0.045 && forest > 0.66) propAt(map, tx, ty, 'obelisk', { cw: 14, ch: 10 });
          break;
        }
        case REGION_DEEPNORTH: {
          // Almost nothing grows up here, and that emptiness is the point: the
          // Jotunreach should read as a place the world stopped decorating.
          if (r < 0.014) propAt(map, tx, ty, 'rock_snow', { cw: 22, ch: 12 });
          else if (r < 0.022 && tile === T.ICE) propAt(map, tx, ty, 'crystal');
          else if (r < 0.03) propAt(map, tx, ty, 'shrub_dead');
          else if (forest > 0.68 && r < 0.05) propAt(map, tx, ty, 'tree_pine_snow', { cw: 12, ch: 8 });
          else if (r < 0.036) propAt(map, tx, ty, 'bone_pile');
          break;
        }
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
  const ground = loc.region === 'south' ? T.SAND
    : loc.region === 'farsouth' || loc.region === 'emberdeep' ? T.ASH_GROUND
    : loc.region === 'fareast' || loc.region === 'stormeast' ? T.SAND
    : loc.region === 'deepnorth' ? T.SNOW
    : loc.region === 'sunkenwest' ? T.MUD
    : loc.region === 'north' ? T.GRAVEL : T.DIRT;
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

/** The natural walkable ground for a tile's region, used when filling water. */
function regionGround(ctx: GenCtx, tx: number, ty: number): number {
  switch (ctx.regions[ty * WORLD_W + tx]) {
    case REGION_NORTH: return T.SNOW;
    case REGION_DEEPNORTH: return T.SNOW;
    case REGION_FARWEST: return T.GRASS_DARK;
    case REGION_FAREAST: return T.SAND;
    case REGION_FARSOUTH: return T.ASH_GROUND;
    case REGION_SUNKENWEST: return T.MUD;
    case REGION_STORMEAST: return T.SAND;
    case REGION_EMBERDEEP: return T.ASH_GROUND;
    case REGION_EAST: return T.SWAMP_GROUND;
    case REGION_SOUTH: return T.DESERT_SAND;
    case REGION_WEST: return T.GRASS_DARK;
    default: return T.GRASS;
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
    { id: 'slime', weight: 8, level: [2, 5] },
    { id: 'goblin', weight: 7, level: [2, 5] },
    { id: 'spider', weight: 6, level: [3, 6] },
    { id: 'boar', weight: 5, level: [3, 6] },
    { id: 'bandit', weight: 4, level: [4, 6] },
  ],
  [REGION_NORTH]: [
    { id: 'frostwolf', weight: 9, level: [22, 28] },
    { id: 'orc_raider', weight: 8, level: [24, 30] },
    { id: 'direwolf', weight: 6, level: [25, 31] },
    { id: 'wraith', weight: 5, level: [27, 33] },
    { id: 'golem', weight: 4, level: [29, 35] },
    { id: 'revenant_knight', weight: 2, level: [30, 36] },
  ],
  [REGION_EAST]: [
    { id: 'venomspider', weight: 9, level: [12, 17] },
    { id: 'toxicslime', weight: 8, level: [13, 18] },
    { id: 'serpent', weight: 7, level: [15, 20] },
    { id: 'crawler', weight: 6, level: [16, 21] },
    { id: 'goblin_shaman', weight: 4, level: [18, 23] },
    { id: 'wisp', weight: 4, level: [19, 24] },
  ],
  [REGION_SOUTH]: [
    { id: 'bandit', weight: 9, level: [26, 33] },
    { id: 'bandit_archer', weight: 8, level: [28, 35] },
    { id: 'scorpion', weight: 8, level: [30, 37] },
    { id: 'bandit_brute', weight: 5, level: [32, 39] },
    { id: 'sandgolem', weight: 3, level: [33, 40] },
    { id: 'crawler', weight: 3, level: [35, 42] },
  ],
  [REGION_FARWEST]: [
    { id: 'gloam_stalker', weight: 9, level: [30, 34] },
    { id: 'gloam_weaver', weight: 8, level: [31, 35] },
    { id: 'venomspider', weight: 5, level: [32, 36] },
    { id: 'hollow_treant', weight: 5, level: [34, 38] },
    { id: 'court_exile', weight: 4, level: [35, 39] },
    { id: 'wisp', weight: 3, level: [36, 40] },
  ],
  [REGION_FAREAST]: [
    { id: 'brine_crawler', weight: 9, level: [38, 42] },
    { id: 'salt_wraith', weight: 8, level: [39, 43] },
    { id: 'drowned_legionary', weight: 7, level: [40, 44] },
    { id: 'salt_colossus', weight: 4, level: [42, 46] },
    { id: 'serpent', weight: 3, level: [43, 47] },
    { id: 'wraith', weight: 3, level: [44, 48] },
  ],
  [REGION_FARSOUTH]: [
    { id: 'ash_scorpion', weight: 9, level: [48, 53] },
    { id: 'cinder_wisp', weight: 8, level: [49, 54] },
    { id: 'ash_serpent', weight: 6, level: [51, 56] },
    { id: 'cutter_warlord', weight: 5, level: [52, 57] },
    { id: 'magma_golem', weight: 3, level: [54, 59] },
    { id: 'bandit_brute', weight: 3, level: [55, 60] },
  ],
  [REGION_DEEPNORTH]: [
    { id: 'rime_stalker', weight: 9, level: [42, 47] },
    { id: 'ice_revenant', weight: 8, level: [43, 48] },
    { id: 'glacier_wyrm', weight: 7, level: [44, 49] },
    { id: 'winter_shade', weight: 6, level: [45, 50] },
    { id: 'pale_hunter', weight: 5, level: [45, 50] },
    { id: 'jotun_thrall', weight: 4, level: [46, 51] },
    { id: 'herald_winter', weight: 3, level: [47, 52] },
    { id: 'glass_golem', weight: 3, level: [48, 53] },
    { id: 'frost_giant', weight: 2, level: [49, 54] },
    { id: 'bone_colossus', weight: 1, level: [50, 54] },
  ],
  [REGION_WEST]: [
    { id: 'spider', weight: 8, level: [4, 8] },
    { id: 'wisp', weight: 8, level: [5, 9] },
    { id: 'sapling', weight: 7, level: [6, 10] },
    { id: 'direwolf', weight: 6, level: [8, 12] },
    { id: 'venomspider', weight: 4, level: [9, 13] },
    { id: 'emberwisp', weight: 3, level: [10, 14] },
  ],

  [REGION_SUNKENWEST]: [
    { id: 'drowned_hound', weight: 9, level: [52, 57] },
    { id: 'fen_shade', weight: 8, level: [53, 58] },
    { id: 'fen_weaver', weight: 7, level: [54, 60] },
    { id: 'sunken_treant', weight: 5, level: [56, 61] },
    { id: 'the_drowned', weight: 5, level: [57, 62] },
    { id: 'mire_colossus', weight: 3, level: [59, 62] },
  ],
  [REGION_STORMEAST]: [
    { id: 'storm_wisp', weight: 9, level: [58, 63] },
    { id: 'glass_hunter', weight: 8, level: [59, 65] },
    { id: 'storm_serpent', weight: 7, level: [61, 66] },
    { id: 'thunder_wrought', weight: 5, level: [62, 67] },
    { id: 'stormcaller', weight: 4, level: [63, 68] },
    { id: 'salt_colossus', weight: 2, level: [60, 66] },
  ],
  [REGION_EMBERDEEP]: [
    { id: 'ember_shade', weight: 9, level: [64, 69] },
    { id: 'deep_scorpion', weight: 8, level: [65, 71] },
    { id: 'molten_serpent', weight: 7, level: [66, 72] },
    { id: 'ember_wrought', weight: 5, level: [67, 73] },
    { id: 'ash_revenant', weight: 4, level: [69, 74] },
    { id: 'cinder_colossus', weight: 3, level: [71, 75] },
  ],
};

function placeSpawns(ctx: GenCtx) {
  const { map, rng, regions } = ctx;
  let id = 0;
  // Scaled with the world so density stays where it was tuned: the map grew
  // 1.8x in area, and an empty map is worse than a quiet one.
  const attempts = 3000;
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
    const roster = loc.id === 'exile_camp'
      ? ['court_exile', 'court_exile', 'gloam_stalker', 'gloam_weaver']
      : loc.id === 'cutter_stronghold'
      ? ['cutter_warlord', 'cutter_warlord', 'ash_scorpion', 'bandit_brute', 'cinder_wisp']
      : loc.id === 'thrall_camp'
      ? ['jotun_thrall', 'ice_revenant', 'ice_revenant', 'herald_winter']
      : loc.id === 'crag_camp'
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
  for (let i = 0; i < 84; i++) {
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
      // Distance from home IS the difficulty curve, so a chest at the top
      // of the map is a level-30 chest. The old cap of 18 was the old edge
      // of the world; MAX_CONTENT_LEVEL moves with the content.
      level: Math.max(1, Math.min(MAX_CONTENT_LEVEL, Math.round(d / 15))),
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

/**
 * Guarantees the player can walk from home to everything that matters.
 * `locationsOnly` skips the general pocket sweep and just makes sure every
 * named place is reachable — used for a second pass after dungeon entrances
 * have carved their own ground.
 */
function ensureConnectivity(ctx: GenCtx, locationsOnly = false): void {
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
              // rock is tunnelled through and water is filled in: both are
              // solid, and a corridor that stops at a riverbank is no corridor
              if (t === T.MOUNTAIN || t === T.CLIFF || t === T.SNOW_ROCK) {
                map.tiles[ni] = ctx.regions[ni] === REGION_NORTH || ctx.regions[ni] === REGION_DEEPNORTH ? T.SNOW : T.GRAVEL;
              } else if (t === T.WATER || t === T.DEEP_WATER || t === T.SWAMP_WATER) {
                map.tiles[ni] = T.BRIDGE;
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
  for (let i = 0; !locationsOnly && i < N; i++) {
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

  // A named place the player can be sent to must always be walkable to, even
  // if it landed in a pocket too small for the pass above to bother with.
  for (const loc of LOCATIONS) {
    const here = loc.ty * W + loc.tx;
    if (seen[here]) continue;
    // clear a landing pad at the site, then dig back to the mainland
    const pad: number[] = [];
    for (let oy = -3; oy <= 3; oy++) {
      for (let ox = -3; ox <= 3; ox++) {
        const nx = loc.tx + ox;
        const ny = loc.ty + oy;
        if (nx < 4 || ny < 4 || nx >= W - 4 || ny >= H - 4) continue;
        const ni = ny * W + nx;
        if (isSolid(map.tiles[ni])) map.tiles[ni] = ctx.regions[ni] === REGION_NORTH || ctx.regions[ni] === REGION_DEEPNORTH ? T.SNOW : T.GRAVEL;
        pad.push(ni);
      }
    }
    tunnel(pad);
    for (const c of pad) flood(c);
    // nothing may stand in a corridor that only exists so this place is reachable
    map.props = map.props.filter((pr) => {
      const px = Math.floor(pr.x / TILE);
      const py = Math.floor(pr.y / TILE);
      return !(pr.cw && Math.abs(px - loc.tx) <= 3 && Math.abs(py - loc.ty) <= 3);
    });
  }
}

/** Second connectivity pass, once every entrance has cleared its own ground. */
function connectLocations(ctx: GenCtx): void {
  ensureConnectivity(ctx, true);
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
  carveLake(ctx, CX + 51, CY - 35, 17);
  carveLake(ctx, CX - 74, CY + 62, 14);
  carveRiver(ctx, 363, 232, 413, 392, 3.6);
  carveRiver(ctx, 413, 392, 528, 477, 4);
  carveRiver(ctx, 288, 472, 208, 592, 3.2);
  carveRiver(ctx, 428, 522, 338, 622, 3);

  // roads between every settlement and the capital, then on to the dungeons
  const towns = LOCATIONS.filter((l) => l.kind === 'village' || l.kind === 'town');
  for (const t of towns) {
    if (t.id === 'ashvale') continue;
    carveRoad(ctx, CX, CY, t.tx, t.ty, 2);
  }
  // Every dungeon hangs off the settlement that watches it, by id rather than
  // by coordinate, so the road network survives the world being rescaled.
  const road = (fromId: string, toId: string) => {
    const a = LOCATION_BY_ID[fromId];
    const b = LOCATION_BY_ID[toId];
    if (a && b) carveRoad(ctx, a.tx, a.ty, b.tx, b.ty, 1, true);
  };
  road('northwatch', 'ruined_fortress');
  road('northwatch', 'ashen_spire');
  road('northwatch', 'crag_camp');
  road('northwatch', 'frost_altar');
  road('duneholt', 'sunken_tomb');
  road('duneholt', 'barrow_crypt');
  road('duneholt', 'cutter_camp');
  road('duneholt', 'lost_chapel');
  road('thornhollow', 'grove_temple');
  road('thornhollow', 'standing_stones');
  road('thornhollow', 'hermit_hut');
  road('mirefall', 'ironroot_mine');
  road('mirefall', 'drowned_shrine');
  road('mirefall', 'watchers_ring');
  road('northwatch', 'frostmarch_hold');
  // The one road into the Jotunreach, and then the trail through it. Every
  // new region only needs this much wiring: a road in, and a road onward.
  road('frostmarch_hold', 'vardhold');
  road('vardhold', 'glass_hollow');
  road('vardhold', 'riven_cathedral');
  road('vardhold', 'ice_fields');
  road('vardhold', 'thrall_camp');
  road('thrall_camp', 'jotun_barrow');
  road('riven_cathedral', 'white_stair');
  road('white_stair', 'the_last_gate');
  road('the_last_gate', 'under_the_gate');
  road('jotun_barrow', 'cairn_of_names');
  // the outer marches: one road out of each of the old frontier towns, then
  // the trail onward through the march
  road('thornhollow', 'duskhold');
  road('duskhold', 'the_deepwood');
  road('duskhold', 'thorn_warren');
  road('duskhold', 'exile_camp');
  road('thorn_warren', 'gloam_ring');
  road('mirefall', 'saltwatch');
  road('saltwatch', 'drowned_court');
  road('saltwatch', 'salt_mine');
  road('saltwatch', 'salt_pillars');
  road('salt_mine', 'wrecked_fleet');
  road('duneholt', 'cinderhold');
  road('cinderhold', 'the_caldera');
  road('cinderhold', 'ashfall_barrow');
  road('cinderhold', 'cutter_stronghold');
  road('the_caldera', 'glass_flats');
  // the deep marches: one road out of each outer-march town, then onward
  road('duskhold', 'reedwatch');
  road('reedwatch', 'blackreed_warren');
  road('reedwatch', 'the_sunken_hall');
  road('reedwatch', 'the_shallows');
  road('the_sunken_hall', 'drowned_orchard');
  road('saltwatch', 'lastmast');
  road('lastmast', 'the_standing_rod');
  road('lastmast', 'glass_run');
  road('lastmast', 'fulgurite_field');
  road('the_standing_rod', 'the_earthing');
  road('cinderhold', 'the_banking');
  road('the_banking', 'the_underfloor');
  road('the_banking', 'slagworks');
  road('the_banking', 'ash_terraces');
  road('slagworks', 'the_long_vent');

  road('ashvale', 'whisperwell');
  road('ashvale', 'ember_falls');
  road('ashvale', 'old_bridge');

  trimInlandSand(ctx);
  ensureConnectivity(ctx);
  scatterProps(ctx);

  // settlements and points of interest
  buildAshvale(map, rng);
  for (const loc of LOCATIONS) {
    // Every named place gets a dry apron first. `clearArea` deliberately
    // refuses to overwrite water, so a cave mouth that generated on a
    // shoreline kept its lake and penned the player in the moment they
    // stepped back out of the dungeon.
    if (loc.kind !== 'village' && loc.kind !== 'town') {
      drainFor(map, loc.tx, loc.ty, 15, 24, regionGround(ctx, loc.tx, loc.ty));
    }
    if (loc.kind === 'village') buildSettlement(map, rng, loc);
    else if (loc.kind === 'camp') buildCamp(ctx, loc);
    else if (loc.kind === 'dungeon' || loc.kind === 'cave') buildDungeonEntrance(ctx, loc);
    else if (loc.kind !== 'town') buildLandmark(ctx, loc);
  }
  // Entrances carve their own ground, so the guarantee that you can walk to
  // every named place has to run once more after they exist.
  connectLocations(ctx);

  placeSpawns(ctx);
  placeTreasure(ctx);
  buildPropGrid(map);
  return map;
}

export const worldPixelSize = { w: WORLD_W * TILE, h: WORLD_H * TILE };
