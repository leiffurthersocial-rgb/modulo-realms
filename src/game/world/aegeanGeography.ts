import {
  AEGEAN_ISLANDS,
  AEGEAN_LOCATIONS,
  AEGEAN_PORTS,
  type AegeanIsland,
} from "../../data/aegean/world";
import { RNG, fbm, ridge } from "../core/rng";
import { getTile, type GameMap, type PropInstance } from "./map";
import { T, TILE, isSolid, isWater } from "./tiles";

/** Only the former eastern boundary is regenerated. All western identities remain intact. */
export const AEGEAN_SEAM_MASKS = [{ x: 928, y: 14, w: 32, h: 1060 }] as const;
type Point = readonly [number, number];
const terrainSeeds = new WeakMap<GameMap, number>();
const coastCache = new Map<number, Float32Array>();

// Headlands, enclosed gulfs, river mouths and the military cape are authored at
// landscape scale. Noise breaks their edges; it does not choose their geography.
const COAST: Point[] = [
  [0, 1250],
  [72, 1321],
  [130, 1372],
  [230, 1395],
  [304, 1410],
  [361, 1489],
  [382, 1523],
  [420, 1540],
  [456, 1497],
  [510, 1382],
  [548, 1394],
  [582, 1418],
  [635, 1374],
  [686, 1362],
  [747, 1402],
  [788, 1440],
  [839, 1413],
  [889, 1355],
  [930, 1336],
  [950, 1345],
  [1014, 1308],
  [1054, 1274],
  [1087, 1270],
];

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
function clamp(n: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, n));
}

export function aegeanMainlandCoast(y: number, seed = 1337): number {
  let coast = coastCache.get(seed);
  if (!coast) {
    coast = new Float32Array(1088);
    for (let ty = 0; ty < coast.length; ty++) {
      let k = 1;
      while (k < COAST.length - 1 && ty > COAST[k][0]) k++;
      const a = COAST[k - 1],
        b = COAST[k];
      const t = smooth((ty - a[0]) / (b[0] - a[0]));
      let x = a[1] + (b[1] - a[1]) * t;
      x += (fbm(ty * 0.021, 0.7, seed + 8701, 4) - 0.5) * 30;
      x += (fbm(ty * 0.11, 2.7, seed + 8761, 2) - 0.5) * 10;
      // Working harbours need sheltered water beyond a persistent land approach.
      for (const p of AEGEAN_PORTS.filter((p) => !p.island)) {
        const distance = Math.abs(ty - p.ty);
        if (distance < 18) x += (p.tx + 9 - x) * (1 - smooth(distance / 18));
      }
      coast[ty] = x;
    }
    if (coastCache.size > 3) coastCache.clear();
    coastCache.set(seed, coast);
  }
  return coast[clamp(Math.round(y), 0, 1087)];
}

function mainlandRegion(
  x: number,
  y: number,
  seed: number,
  coast: number,
): number {
  // Same domain-warp grammar as the original world, including broad and fine
  // octaves. A traveller sees terrain crossfade, never rectangular colour bands.
  const wx =
    x +
    (fbm(x * 0.008, y * 0.008, seed + 811, 3) - 0.5) * 78 +
    (fbm(x * 0.032, y * 0.032, seed + 821, 2) - 0.5) * 20;
  const wy =
    y +
    (fbm(x * 0.008, y * 0.008, seed + 829, 3) - 0.5) * 86 +
    (fbm(x * 0.031, y * 0.031, seed + 839, 2) - 0.5) * 22;
  if (wy > 918) return 20;
  if (wy < 194 + Math.sin((wx - 1040) * 0.009) * 28) return 14;
  if (wy > 669 && wx < 1218 + Math.sin(wy * 0.019) * 18) return 19;
  if (wx > coast - 58 && wy < 900) return wx > 1460 && wy < 468 ? 22 : 17;
  if (wy > 654) return 18;
  if (wy > 452 && wx < 1230) return 15;
  if (wx > 1204 && wy < 470) return 16;
  if (wy < 353) return 13;
  return 12;
}

function terrain(region: number, e: number, m: number, detail: number): number {
  switch (region) {
    case 14:
      return e > 0.72
        ? T.SNOW_ROCK
        : e > 0.665
          ? T.MOUNTAIN
          : e < 0.36 && m > 0.56
            ? T.ICE
            : m < 0.35
              ? T.GRAVEL
              : e < 0.5 && m < 0.48
                ? T.STONE_GROUND
                : T.SNOW;
    case 13:
      return e > 0.75
        ? T.CLIFF
        : e > 0.67
          ? T.STONE_GROUND
          : m > 0.57
            ? T.GRASS_DARK
            : m > 0.47
              ? T.TALL_GRASS
              : m < 0.32
                ? T.DIRT
                : detail > 0.64
                  ? T.FLOWERS
                  : T.AEGEAN_GRASS;
    case 15:
      return e > 0.76
        ? T.CLIFF
        : e > 0.66
          ? T.GRAVEL
          : e < 0.35 && m > 0.58
            ? T.SWAMP_GROUND
            : m > 0.59
              ? T.GRASS_DARK
              : m < 0.36
                ? T.DIRT
                : m > 0.51
                  ? T.TALL_GRASS
                  : T.GRASS_PALE;
    case 16:
      return e > 0.735
        ? T.CLIFF
        : e > 0.65
          ? T.MOUNTAIN
          : e > 0.58
            ? T.STONE_GROUND
            : m < 0.36
              ? T.GRAVEL
              : m > 0.57
                ? T.GRASS_DARK
                : detail > 0.66
                  ? T.FLOWERS
                  : T.AEGEAN_GRASS;
    case 18:
      return e > 0.74
        ? T.MOUNTAIN
        : e > 0.65
          ? T.DESERT_ROCK
          : m > 0.57
            ? T.GRASS_DARK
            : m > 0.49
              ? T.AEGEAN_GRASS
              : m < 0.33
                ? T.GRAVEL
                : detail > 0.63
                  ? T.DIRT
                  : T.TERRACOTTA;
    case 19:
      return e > 0.73
        ? T.CLIFF
        : e > 0.63
          ? T.STONE_GROUND
          : e < 0.42
            ? T.SWAMP_WATER
            : m > 0.62
              ? T.GRASS_DARK
              : m < 0.34
                ? T.MUD
                : detail > 0.63
                  ? T.TALL_GRASS
                  : T.SWAMP_GROUND;
    case 20:
      return e > 0.735
        ? T.MOUNTAIN
        : e > 0.64
          ? T.DESERT_ROCK
          : m > 0.63
            ? T.GRAVEL
            : m < 0.34
              ? T.STONE_GROUND
              : detail > 0.58
                ? T.ASH_GROUND
                : T.BASALT;
    case 17:
    case 22:
      return e > 0.735
        ? T.CLIFF
        : e > 0.64
          ? T.DESERT_ROCK
          : m < 0.34
            ? T.SAND
            : m > 0.6
              ? T.TALL_GRASS
              : detail > 0.64
                ? T.GRASS_PALE
                : T.AEGEAN_GRASS;
    default:
      return e > 0.75
        ? T.CLIFF
        : e > 0.67
          ? T.STONE_GROUND
          : m > 0.6
            ? T.GRASS_DARK
            : m < 0.31
              ? T.GRAVEL
              : m < 0.39
                ? T.GRASS_PALE
                : detail > 0.66
                  ? T.FLOWERS
                  : T.AEGEAN_GRASS;
  }
}

/** A different angular silhouette for every named island, in normalized bounds.
 * Concave coves, long capes and broad shoulders are intentional and independent
 * of the smaller noise that erodes their edges. East landings stay sheltered.
 */
const ISLAND_SHAPES: Record<string, number[]> = {
  kymene: [
    0.94, 0.87, 0.66, 0.82, 0.98, 0.75, 0.58, 0.89, 0.92, 0.78, 0.93, 0.87,
  ],
  crete: [
    0.93, 0.86, 0.58, 0.7, 0.92, 0.98, 0.82, 0.61, 0.91, 0.75, 0.67, 0.98,
  ],
  thalke: [
    0.9, 0.83, 0.74, 0.98, 0.92, 0.69, 0.95, 0.6, 0.89, 0.98, 0.78, 0.87,
  ],
  gorgon: [
    0.95, 0.68, 0.92, 0.94, 0.71, 0.91, 0.62, 0.85, 0.97, 0.7, 0.87, 0.94,
  ],
  erytheia: [
    0.95, 0.91, 0.78, 0.98, 0.81, 0.94, 0.61, 0.88, 0.74, 0.95, 0.85, 0.99,
  ],
  hesperides: [
    0.91, 0.7, 0.96, 0.73, 0.93, 0.99, 0.78, 0.61, 0.97, 0.95, 0.84, 0.67,
  ],
  amazon: [
    0.96, 0.8, 0.95, 0.99, 0.85, 0.73, 0.88, 0.94, 0.69, 0.99, 0.73, 0.88,
  ],
  sirens: [
    0.95, 0.59, 0.96, 0.72, 0.99, 0.54, 0.89, 0.7, 0.96, 0.57, 0.98, 0.75,
  ],
  delos: [
    0.91, 0.87, 0.98, 0.73, 0.88, 0.94, 0.63, 0.91, 0.75, 0.99, 0.81, 0.76,
  ],
  icarian: [
    0.92, 0.64, 0.82, 0.98, 0.7, 0.96, 0.57, 0.9, 0.98, 0.79, 0.63, 0.97,
  ],
  cyclops_table: [
    0.93, 0.94, 0.66, 0.81, 0.95, 0.96, 0.92, 0.69, 0.83, 0.98, 0.74, 0.87,
  ],
  sister_west: [
    0.93, 0.64, 0.81, 0.98, 0.59, 0.89, 0.73, 0.94, 0.67, 0.98, 0.81, 0.73,
  ],
  sister_middle: [
    0.93, 0.95, 0.71, 0.88, 0.97, 0.69, 0.84, 0.61, 0.99, 0.87, 0.62, 0.95,
  ],
  sister_east: [
    0.91, 0.77, 0.96, 0.63, 0.89, 0.98, 0.71, 0.89, 0.62, 0.95, 0.87, 0.72,
  ],
  drowned_lyre: [
    0.95, 0.77, 0.96, 0.93, 0.61, 0.82, 0.95, 0.66, 0.87, 0.98, 0.68, 0.9,
  ],
  ash_crown: [
    0.95, 0.92, 0.79, 0.97, 0.83, 0.99, 0.75, 0.91, 0.96, 0.73, 0.95, 0.87,
  ],
  asterion: [
    0.94, 0.88, 0.94, 0.97, 0.87, 0.98, 0.94, 0.91, 0.83, 0.98, 0.92, 0.97,
  ],
};

function islandRadius(island: AegeanIsland, angle: number): number {
  const profile = ISLAND_SHAPES[island.id];
  const f = ((angle / (Math.PI * 2) + 1) % 1) * profile.length;
  const i = Math.floor(f),
    t = smooth(f - i);
  return profile[i] + (profile[(i + 1) % profile.length] - profile[i]) * t;
}

function islandTerrain(
  island: AegeanIsland,
  x: number,
  y: number,
  e: number,
  m: number,
): number {
  if (island.id === "asterion") {
    const summit = Math.hypot((x - 1818) / 50, (y - 391) / 40);
    if (summit < 0.7 && e > 0.49) return T.MOUNTAIN;
    if (e > 0.72) return T.CLIFF;
    if (m > 0.57 && y > 430) return T.GRASS_DARK;
    if (m < 0.35) return T.GRAVEL;
    return e > 0.58 ? T.STONE_GROUND : T.BASALT;
  }
  if (island.coast === "volcanic")
    return e > 0.71
      ? T.CLIFF
      : e > 0.64
        ? T.DESERT_ROCK
        : m > 0.59
          ? T.TERRACOTTA
          : m < 0.35
            ? T.ASH_GROUND
            : T.BASALT;
  if (island.id === "hesperides")
    return e > 0.75
      ? T.STONE_GROUND
      : m > 0.52
        ? T.GRASS_DARK
        : m < 0.36
          ? T.GRASS_PALE
          : T.FLOWERS;
  if (island.coast === "storm")
    return e > 0.66
      ? T.CLIFF
      : e > 0.57
        ? T.STONE_GROUND
        : m < 0.38
          ? T.GRAVEL
          : T.AEGEAN_GRASS;
  return e > 0.71
    ? T.CLIFF
    : e > 0.64
      ? T.STONE_GROUND
      : m > 0.55
        ? T.GRASS_DARK
        : m < 0.33
          ? T.GRAVEL
          : e < 0.42
            ? T.GRASS_PALE
            : T.AEGEAN_GRASS;
}

export function generateAegeanTerrain(map: GameMap, seed: number): void {
  terrainSeeds.set(map, seed);
  for (let y = 0; y < map.h; y++) {
    const coast = aegeanMainlandCoast(y, seed);
    for (let x = 928; x < map.w; x++) {
      if (x < 960 && (y < 14 || y >= map.h - 14)) continue;
      const i = y * map.w + x;
      if (y < 5 || y >= map.h - 5 || x >= map.w - 5) {
        map.tiles[i] = T.VOID;
        continue;
      }
      if (x > coast) {
        const shelf = 9 + fbm(x * 0.025, y * 0.025, seed + 899, 3) * 20;
        map.tiles[i] = x < coast + shelf ? T.AEGEAN_SHALLOWS : T.AEGEAN_SEA;
        map.regions![i] = 22;
        continue;
      }
      const e =
        fbm(x * 0.014, y * 0.014, seed, 5) * 0.72 +
        ridge(x * 0.008, y * 0.008, seed + 3, 3) * 0.28;
      const m = fbm(x * 0.02, y * 0.02, seed + 101, 4);
      const detail = fbm(x * 0.07, y * 0.07, seed + 877, 2);
      const reg = mainlandRegion(x, y, seed, coast);
      let tile = terrain(reg, e, m, detail);
      const beach = 3 + detail * 6;
      if (x > coast - beach) {
        const cliffs = (y < 460 && y > 320) || y > 970;
        tile =
          reg === 20
            ? T.BASALT
            : cliffs && e > 0.61 && x < coast - 2
              ? T.CLIFF
              : T.SAND;
      }
      // Reconstruct the original Stormreach/Emberdeep terrain without its old
      // map-edge mountain multiplier, then let it dissolve into the new biome.
      const seam = 963 + (fbm(x * 0.019, y * 0.019, seed + 911, 3) - 0.5) * 65;
      if (x < seam) {
        const ember = y > 918 + (fbm(x * 0.011, 0.5, seed + 181, 3) - 0.5) * 52;
        tile = ember
          ? e > 0.72
            ? T.MOUNTAIN
            : e > 0.6
              ? T.DESERT_ROCK
              : m > 0.66
                ? T.GRAVEL
                : m < 0.3
                  ? T.STONE_GROUND
                  : T.ASH_GROUND
          : e > 0.8
            ? T.MOUNTAIN
            : e > 0.7
              ? T.STONE_GROUND
              : e < 0.31
                ? T.WATER
                : m > 0.64
                  ? T.GRAVEL
                  : m < 0.36
                    ? T.STONE_GROUND
                    : T.SAND;
        map.regions![i] = ember ? 11 : 10;
      } else map.regions![i] = reg;
      map.tiles[i] = tile;
      map.landmasses![i] = 1;
    }
  }
  for (const island of AEGEAN_ISLANDS) {
    for (
      let y = island.ty - island.ry - 7;
      y <= island.ty + island.ry + 7;
      y++
    ) {
      for (
        let x = island.tx - island.rx - 7;
        x <= island.tx + island.rx + 7;
        x++
      ) {
        if (x < 960 || x >= map.w - 6 || y < 6 || y >= map.h - 6) continue;
        const dx = (x - island.tx) / island.rx,
          dy = (y - island.ty) / island.ry;
        const rough =
          (fbm(x * 0.12, y * 0.12, seed + island.landmass * 71, 3) - 0.5) *
          0.085;
        const shore = islandRadius(island, Math.atan2(dy, dx)) + rough;
        const depth =
          (shore - Math.hypot(dx, dy)) * Math.min(island.rx, island.ry);
        const i = y * map.w + x;
        if (depth < -5 || map.landmasses![i] === 1) continue;
        if (depth < 0) {
          if (!map.landmasses![i]) map.tiles[i] = T.AEGEAN_SHALLOWS;
          continue;
        }
        const e =
          fbm(x * 0.032, y * 0.032, seed + 977, 4) * 0.7 +
          ridge(x * 0.019, y * 0.019, seed + 991, 3) * 0.3;
        const m = fbm(x * 0.043, y * 0.043, seed + 997, 3);
        map.landmasses![i] = island.landmass;
        map.regions![i] = island.id === "asterion" ? 23 : 21;
        map.tiles[i] =
          depth < 2.5
            ? island.coast === "volcanic" || island.coast === "storm"
              ? T.BASALT
              : T.SAND
            : islandTerrain(island, x, y, e, m);
      }
    }
  }
  // Subtractive basins break the monotone coast into real, two-dimensional
  // geography: a drowned northern fjord, the curled military cape, and the
  // great Lacedaemonian gulf whose inland shore the southern road follows.
  coastalInlet(map, seed, [
    [1282, 131, 4],
    [1294, 143, 8],
    [1320, 153, 13],
    [1347, 158, 15],
    [1370, 181, 21],
    [1417, 191, 28],
  ]);
  coastalInlet(map, seed, [
    [1302, 201, 3],
    [1315, 184, 6],
    [1328, 173, 8],
    [1347, 158, 12],
  ]);
  coastalInlet(map, seed, [
    [1378, 321, 4],
    [1383, 337, 7],
    [1398, 354, 11],
    [1432, 361, 18],
    [1461, 349, 14],
    [1493, 339, 10],
    [1527, 337, 15],
  ]);
  coastalInlet(map, seed, [
    [1290, 629, 4],
    [1289, 654, 10],
    [1309, 666, 17],
    [1325, 692, 23],
    [1362, 704, 29],
    [1414, 686, 34],
  ]);
  coastalInlet(map, seed, [
    [1322, 634, 3],
    [1321, 653, 7],
    [1309, 666, 14],
  ]);
  coastalInlet(
    map,
    seed,
    [
      [1868, 497, 4],
      [1885, 485, 11],
      [1905, 490, 18],
    ],
    18,
  );
  // The Ash Crown is a broken, flooded caldera; the west mouth remains open to
  // the ocean. Its landing and eastern rim form the foot route around the lake.
  basin(map, seed, 1825, 729, 15, 13, T.AEGEAN_SHALLOWS, 17);
  // The garden harbour, flooded theatre and caldera are sea inlets with open
  // mouths, not the same elliptical island merely painted a different colour.
  islandInlet(
    map,
    2,
    [
      [1510, 670],
      [1514, 681],
      [1511, 690],
    ],
    6,
  );
  islandInlet(
    map,
    16,
    [
      [1782, 194],
      [1794, 189],
      [1808, 192],
    ],
    5,
  );
  islandInlet(
    map,
    17,
    [
      [1784, 724],
      [1798, 725],
      [1810, 729],
      [1823, 729],
    ],
    5,
  );
  // Arcadian karst pools and a spring-fed lake below the Olympian snowline.
  basin(map, seed, 1114, 216, 19, 13, T.WATER, 1);
  basin(map, seed, 1193, 186, 16, 23, T.WATER, 1);
  basin(map, seed, 1051, 788, 28, 18, T.SWAMP_WATER, 1);
  basin(map, seed, 1170, 847, 24, 31, T.SWAMP_WATER, 1);
  rivers(map, seed);
  farms(map, seed);
  islandGardens(map);
}

function coastalInlet(
  map: GameMap,
  seed: number,
  nodes: Array<[number, number, number]>,
  mass = 1,
): void {
  // Width follows a branching drowned valley, never an elliptical punch. The
  // upper reach narrows into uneven rock clefts; the mouth broadens into sea.
  curve(
    nodes.map(([x, y]) => [x, y] as Point),
    (cx, cy, t) => {
      const f = t * (nodes.length - 1),
        n = Math.min(nodes.length - 2, Math.floor(f));
      const width = nodes[n][2] + (nodes[n + 1][2] - nodes[n][2]) * (f - n);
      for (let dy = -Math.ceil(width + 3); dy <= width + 3; dy++)
        for (let dx = -Math.ceil(width + 3); dx <= width + 3; dx++) {
          const x = Math.round(cx) + dx,
            y = Math.round(cy) + dy,
            i = y * map.w + x;
          if (x < 960 || x >= map.w - 6 || y < 6 || y >= map.h - 6) continue;
          if (map.landmasses![i] !== mass && map.landmasses![i] !== 0) continue;
          const edge = (fbm(x * 0.083, y * 0.083, seed + 1543, 3) - 0.5) * 5;
          const d = Math.hypot(dx, dy) + edge,
            shelf = 2 + fbm(x * 0.04, y * 0.04, seed + 1559, 2) * 3;
          if (d < width) {
            if (map.landmasses![i] === 0) {
              if (d < width - shelf && map.tiles[i] === T.AEGEAN_SHALLOWS)
                map.tiles[i] = T.AEGEAN_SEA;
              continue;
            }
            map.tiles[i] = d < width - shelf ? T.AEGEAN_SEA : T.AEGEAN_SHALLOWS;
            map.landmasses![i] = 0;
            map.regions![i] = 22;
          } else if (
            d < width + 1.7 &&
            map.landmasses![i] === mass &&
            !isWater(map.tiles[i])
          )
            map.tiles[i] = mass === 18 ? T.BASALT : T.SAND;
        }
    },
  );
}

function islandInlet(
  map: GameMap,
  mass: number,
  points: readonly Point[],
  width: number,
): void {
  curve(points, (cx, cy) => {
    for (let dy = -width; dy <= width; dy++)
      for (let dx = -width; dx <= width; dx++) {
        if (dx * dx + dy * dy > width * width) continue;
        const x = Math.round(cx) + dx,
          y = Math.round(cy) + dy,
          i = y * map.w + x;
        if (map.landmasses![i] && map.landmasses![i] !== mass) continue;
        map.tiles[i] = T.AEGEAN_SHALLOWS;
        map.landmasses![i] = 0;
      }
  });
}

function islandGardens(map: GameMap): void {
  for (const [cx, cy, rx, ry, tile, mass] of [
    [1522, 885, 11, 6, T.FARM_SOIL, 3],
    [1570, 872, 12, 7, T.FARM_SOIL, 3],
    [1723, 861, 11, 10, T.TERRACOTTA, 6],
    [1757, 889, 14, 8, T.GRASS_PALE, 6],
    [1820, 1018, 10, 5, T.FLOWERS, 7],
    [1851, 1036, 12, 7, T.FLOWERS, 7],
    [1582, 1004, 9, 13, T.TERRACOTTA, 8],
  ]) {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++) {
        const i = (cy + y) * map.w + cx + x;
        if (
          map.landmasses![i] === mass &&
          !isWater(map.tiles[i]) &&
          (x * x) / (rx * rx) + (y * y) / (ry * ry) < 1
        )
          map.tiles[i] = tile;
      }
  }
  // An actual terraced ascent below the mountain temple, with broad stairs and
  // side gardens. Its entrance remains at the stable authored portal anchor.
  for (let y = 436; y <= 452; y++)
    for (let x = 1796; x <= 1824; x++) {
      const i = y * map.w + x;
      if (map.landmasses![i] !== 18) continue;
      map.tiles[i] = y % 4 === 0 ? T.STONE_GROUND : T.MARBLE;
    }
}

function basin(
  map: GameMap,
  seed: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  water: number,
  mass: number,
): void {
  for (let y = cy - ry - 3; y <= cy + ry + 3; y++)
    for (let x = cx - rx - 3; x <= cx + rx + 3; x++) {
      const i = y * map.w + x;
      if (map.landmasses![i] !== mass) continue;
      const d =
        Math.hypot((x - cx) / rx, (y - cy) / ry) +
        (fbm(x * 0.1, y * 0.1, seed + 55, 3) - 0.5) * 0.32;
      if (d < 0.82) map.tiles[i] = water;
      else if (d < 1) map.tiles[i] = water === T.SWAMP_WATER ? T.MUD : T.SAND;
    }
}

function curve(
  points: readonly Point[],
  paint: (x: number, y: number, t: number) => void,
): void {
  for (let n = 0; n < points.length - 1; n++) {
    const a = points[Math.max(0, n - 1)],
      b = points[n],
      c = points[n + 1],
      d = points[Math.min(points.length - 1, n + 2)];
    const steps = Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) * 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps,
        tt = t * t,
        ttt = tt * t;
      const at = (j: number) =>
        0.5 *
        (2 * b[j] +
          (-a[j] + c[j]) * t +
          (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * tt +
          (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * ttt);
      paint(at(0), at(1), (n + t) / (points.length - 1));
    }
  }
}

function river(
  map: GameMap,
  seed: number,
  points: readonly Point[],
  width: number,
): void {
  curve(points, (cx, cy, t) => {
    const w =
      width * (0.62 + t * 0.55) +
      fbm(cx * 0.035, cy * 0.035, seed + 919, 2) * 1.6;
    for (let dy = -Math.ceil(w + 2); dy <= Math.ceil(w + 2); dy++)
      for (let dx = -Math.ceil(w + 2); dx <= Math.ceil(w + 2); dx++) {
        const x = Math.round(cx) + dx,
          y = Math.round(cy) + dy,
          i = y * map.w + x;
        if (x < 970 || y < 8 || y >= map.h - 8 || map.landmasses![i] !== 1)
          continue;
        const d = Math.hypot(dx, dy);
        if (d < w - 1.4) map.tiles[i] = T.DEEP_WATER;
        else if (d < w) map.tiles[i] = T.WATER;
        else if (d < w + 1.7 && !isWater(map.tiles[i]))
          map.tiles[i] = map.regions![i] === 19 ? T.MUD : T.SAND;
      }
  });
}

function rivers(map: GameMap, seed: number): void {
  river(
    map,
    seed,
    [
      [1168, 152],
      [1152, 211],
      [1183, 260],
      [1134, 322],
      [1160, 386],
      [1132, 449],
      [1182, 499],
      [1220, 556],
      [1292, 580],
      [1374, 602],
    ],
    4.7,
  );
  river(
    map,
    seed + 1,
    [
      [1044, 246],
      [1016, 302],
      [1061, 374],
      [1031, 427],
      [1065, 469],
      [1039, 511],
      [1115, 568],
      [1168, 559],
      [1220, 556],
    ],
    3.4,
  );
  // Two distributaries make an actual coastal delta south of Aigialos.
  river(
    map,
    seed + 2,
    [
      [1292, 580],
      [1327, 600],
      [1342, 625],
      [1370, 632],
    ],
    2.5,
  );
  river(
    map,
    seed + 3,
    [
      [1310, 585],
      [1347, 572],
      [1385, 580],
      [1428, 582],
    ],
    2.2,
  );
  river(
    map,
    seed + 4,
    [
      [1250, 604],
      [1247, 670],
      [1281, 721],
      [1258, 768],
      [1300, 815],
      [1322, 877],
      [1309, 937],
      [1350, 951],
    ],
    4.2,
  );
  river(
    map,
    seed + 5,
    [
      [1004, 695],
      [1059, 717],
      [1094, 754],
      [1131, 785],
      [1150, 861],
      [1218, 898],
      [1272, 896],
      [1353, 886],
    ],
    2.7,
  );
}

function farms(map: GameMap, seed: number): void {
  // Walled plots follow the river terraces, separated by meadow and old tracks.
  const rng = new RNG(`${seed}:aegean:terraces`);
  for (const [cx, cy] of [
    [1100, 608],
    [1148, 610],
    [1090, 475],
    [1188, 520],
    [1260, 793],
    [1326, 800],
    [1251, 737],
    [1004, 448],
  ] as Point[]) {
    const w = rng.int(8, 16),
      h = rng.int(6, 12);
    for (let y = -h; y <= h; y++)
      for (let x = -w; x <= w; x++) {
        const tx = cx + x,
          ty = cy + y,
          i = ty * map.w + tx;
        if (map.landmasses![i] !== 1 || isWater(map.tiles[i])) continue;
        const edge = Math.abs(x) === w || Math.abs(y) === h;
        map.tiles[i] = edge ? T.ROAD_DIRT : T.FARM_SOIL;
      }
  }
}

const roadish = (t: number) =>
  t === T.ROAD ||
  t === T.ROAD_DIRT ||
  t === T.BRIDGE ||
  t === T.MARBLE ||
  t === T.FLOOR_WOOD;

/** Original-world road grammar: curved, worn paths, gravel passes and bridges.
 * Ocean cells are never filled; the same landmass is required at every step.
 */
export function aegeanPath(
  map: GameMap,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width = 1,
  _force = false,
  via: readonly Point[] = [],
): void {
  const seed = terrainSeeds.get(map) ?? 1337;
  const distance = Math.hypot(bx - ax, by - ay);
  const points: Point[] = [[ax, ay], ...via, [bx, by]];
  if (points.length === 2 && distance > 24) {
    const px = -(by - ay) / distance,
      py = (bx - ax) / distance;
    for (const t of [0.24, 0.53, 0.78]) {
      const bend =
        (fbm(ax * 0.019 + t * 2.9, ay * 0.019, seed + 33, 3) - 0.5) *
        Math.min(58, distance * 0.28);
      points.splice(points.length - 1, 0, [
        ax + (bx - ax) * t + px * bend,
        ay + (by - ay) * t + py * bend,
      ]);
    }
  }
  curve(points, (cx, cy) => {
    for (let dy = -width; dy <= width; dy++)
      for (let dx = -width; dx <= width; dx++) {
        if (Math.hypot(dx, dy) > width) continue;
        const x = Math.round(cx) + dx,
          y = Math.round(cy) + dy,
          i = y * map.w + x;
        if (
          x < 928 ||
          x >= map.w - 5 ||
          y < 14 ||
          y >= map.h - 14 ||
          !map.landmasses![i]
        )
          continue;
        const tile = map.tiles[i];
        map.tiles[i] = isWater(tile)
          ? T.BRIDGE
          : isSolid(tile)
            ? T.GRAVEL
            : width > 1
              ? T.ROAD
              : T.ROAD_DIRT;
      }
  });
}

function prop(
  map: GameMap,
  x: number,
  y: number,
  art: string,
  options: Partial<PropInstance> = {},
): void {
  map.props.push({ art, x: x * TILE + 16, y: y * TILE + TILE, ...options });
}

export function scatterAegeanScenery(map: GameMap, seed: number): void {
  const rng = new RNG(`${seed}:aegean:scenery:v2`);
  const protectedSites = AEGEAN_LOCATIONS.filter((l) => !l.surfaceMap);
  // Town envelopes are checked once per 16-tile cell, not once per tree.
  const protectedCells = new Set<string>();
  for (const l of protectedSites) {
    const r = l.kind === "village" ? 28 : 11;
    for (
      let y = Math.floor((l.ty - r) / 16);
      y <= Math.floor((l.ty + r) / 16);
      y++
    )
      for (
        let x = Math.floor((l.tx - r) / 16);
        x <= Math.floor((l.tx + r) / 16);
        x++
      )
        protectedCells.add(`${x}:${y}`);
  }
  for (let y = 8; y < map.h - 8; y++)
    for (let x = 960; x < map.w - 8; x++) {
      const i = y * map.w + x,
        tile = map.tiles[i],
        mass = map.landmasses![i],
        region = map.regions![i];
      if (!mass || isSolid(tile) || roadish(tile)) continue;
      if (
        protectedCells.has(`${Math.floor(x / 16)}:${Math.floor(y / 16)}`) &&
        protectedSites.some(
          (l) =>
            Math.hypot(l.tx - x, l.ty - y) < (l.kind === "village" ? 28 : 11),
        )
      )
        continue;
      const r = rng.next();
      if (r > 0.27) continue;
      // Two scales grow coherent groves with clearings rather than gridded dots.
      const forest = fbm(x * 0.045, y * 0.045, seed + 404, 3);
      let art: string | undefined,
        solid = false;
      if (tile === T.SWAMP_WATER) {
        if (r < 0.04) art = "lilypad";
        else if (r < 0.075) art = "reeds";
      } else if (tile === T.FARM_SOIL) {
        if (r < 0.18) art = "aegean_wheat";
      } else if (region === 14) {
        if (r < (forest > 0.57 ? 0.115 : 0.016)) {
          art = tile === T.SNOW ? "tree_pine_snow" : "tree_pine";
          solid = true;
        } else if (r < 0.035) {
          art = "rock_snow";
          solid = true;
        } else if (r < 0.045) art = "shrub_dead";
      } else if (region === 19) {
        if (forest > 0.54 && r < 0.12) {
          art = rng.bool(0.7) ? "tree_willow" : "tree_dead";
          solid = true;
        } else if (r < 0.1) art = "reeds";
        else if (r < 0.125) art = rng.bool() ? "fern" : "mushroom_cluster";
      } else if (region === 20) {
        if (r < 0.016) {
          art = "rock_big";
          solid = true;
        } else if (r < 0.027) art = "shrub_dead";
        else if (r < 0.03 && forest > 0.59) art = "aegean_fumarole";
        else if (r < 0.036) art = "bone_pile";
      } else if (region === 23) {
        if (forest > 0.51 && r < 0.19) {
          art = "aegean_red_cypress";
          solid = true;
        } else if (r < 0.035) art = "aegean_shield_grave";
        else if (r < 0.052) art = "rock_small";
        else if (r < 0.07) art = "grass_tuft";
      } else {
        const wooded = region === 13 || tile === T.GRASS_DARK;
        const density = wooded
          ? forest > 0.48
            ? 0.26
            : 0.08
          : forest > 0.62
            ? 0.105
            : 0.016;
        if (r < density) {
          art = wooded
            ? rng.pick([
                "tree_oak",
                "tree_pine",
                "aegean_olive",
                "aegean_cypress",
              ])
            : rng.pick(["aegean_olive", "aegean_olive", "aegean_cypress"]);
          if (mass === 7) art = "aegean_golden_tree";
          solid = true;
        } else if (r < density + 0.025)
          art = rng.pick(["grass_tuft", "bush", "aegean_thyme"]);
        else if (r < density + 0.036) art = wooded ? "fern" : "rock_small";
        else if (r < density + 0.04 && forest > 0.61) art = "pillar_broken";
      }
      if (!art) continue;
      // Leave both banks of every road readable and collision-free.
      if (
        solid &&
        [i - 1, i + 1, i - map.w, i + map.w].some((j) => roadish(map.tiles[j]))
      )
        continue;
      prop(map, x, y, art, {
        cw: solid ? 12 : undefined,
        ch: solid ? 8 : undefined,
        phase: rng.range(0, 6),
        flat: art === "lilypad",
      });
    }
  landmarks(map, seed);
  coastDressing(map, seed);
}

function coastDressing(map: GameMap, seed: number): void {
  const rng = new RNG(`${seed}:aegean:shore`);
  for (let y = 9; y < map.h - 9; y += 2)
    for (let x = 970; x < map.w - 9; x += 2) {
      const i = y * map.w + x;
      if (
        !map.landmasses![i] ||
        isSolid(map.tiles[i]) ||
        isWater(map.tiles[i]) ||
        roadish(map.tiles[i])
      )
        continue;
      const coast = [i - 3, i + 3, i - 3 * map.w, i + 3 * map.w].some(
        (j) => !map.landmasses![j] && isWater(map.tiles[j]),
      );
      if (!coast || rng.next() > 0.28) continue;
      if (AEGEAN_PORTS.some((p) => Math.hypot(x - p.tx, y - p.ty) < 9))
        continue;
      const art =
        map.regions![i] === 20 || map.regions![i] === 23
          ? rng.pick(["rock_small", "aegean_driftwood", "aegean_shore_bones"])
          : rng.pick([
              "aegean_limestone",
              "aegean_shells",
              "aegean_driftwood",
              "aegean_thyme",
            ]);
      prop(map, x, y, art, { flat: art === "aegean_shells" });
    }
  for (const p of AEGEAN_PORTS) {
    const direction = p.id === "aegean_asterion" ? -1 : 1;
    for (const [dx, dy, art] of [
      [-4, -6, "aegean_fishing_net"],
      [-5, 5, "aegean_amphora"],
      [-8, -2, "aegean_cart"],
    ] as Array<[number, number, string]>) {
      const x = p.tx + dx * direction,
        y = p.ty + dy;
      if (!isSolid(getTile(map, x, y)) && !isWater(getTile(map, x, y)))
        prop(map, x, y, art);
    }
  }
}

function landmarks(map: GameMap, seed: number): void {
  const rng = new RNG(`${seed}:aegean:ruins`);
  const footprints: Record<string, [number, number]> = {
    aegean_house: [84, 26], aegean_spartan_house: [84, 26], aegean_courtyard_house: [90, 28],
    aegean_portico: [108, 24], aegean_column: [18, 12], aegean_pillar_cracked: [18, 12],
    pillar_broken: [18, 10], aegean_statue: [20, 12], aegean_petrified: [18, 10],
    aegean_olive: [12, 8], aegean_golden_tree: [12, 8], aegean_cart: [32, 16],
    aegean_fountain: [32, 16], aegean_beacon: [20, 12], aegean_sea_stack: [24, 16],
  };
  const place = (x: number, y: number, art: string) => {
    const tile = getTile(map, x, y);
    if (x < 960 || isSolid(tile) || isWater(tile) || roadish(tile)) return;
    if (
      AEGEAN_LOCATIONS.some(
        (l) => !l.surfaceMap && Math.hypot(l.tx - x, l.ty - y) < 12,
      )
    )
      return;
    const footprint = footprints[art];
    prop(map, x, y, art, footprint ? { cw: footprint[0], ch: footprint[1] } : {});
  };
  // Aqueduct ruins, ancient processional grounds, farmsteads and shoreline work
  // have composed arrangements rather than random amphorae across every biome.
  for (let n = 0; n < 11; n++)
    place(
      1019 + n * 4,
      461 + Math.round(Math.sin(n * 0.4) * 3),
      n === 5 ? "pillar_broken" : "aegean_arch",
    );
  for (const [cx, cy] of [
    [1130, 353],
    [1224, 462],
    [1352, 705],
    [1326, 842],
    [1455, 430],
  ] as Point[]) {
    for (const dx of [-6, 0, 6])
      for (const dy of [-4, 4])
        place(
          cx + dx,
          cy + dy,
          rng.bool(0.25) ? "pillar_broken" : "aegean_column",
        );
    place(cx, cy - 8, "aegean_statue");
  }
  for (const [cx, cy] of [
    [1100, 608],
    [1148, 610],
    [1090, 475],
    [1188, 520],
    [1260, 793],
    [1326, 800],
  ] as Point[]) {
    place(cx - 17, cy - 7, "aegean_house");
    place(cx - 17, cy + 3, "aegean_cart");
    for (let n = 0; n < 5; n++) place(cx - 14 + n * 7, cy - 14, "aegean_olive");
    place(cx + 18, cy + 3, "aegean_amphora");
  }
  for (const island of AEGEAN_ISLANDS) {
    if (island.id === "asterion") continue;
    const cx = island.tx,
      cy = island.ty;
    if (island.id === "gorgon")
      for (let n = 0; n < 12; n++)
        place(cx - 17 + rng.int(-5, 5), cy - 22 + n * 3, "aegean_petrified");
    else if (island.id === "hesperides")
      for (let n = 0; n < 10; n++)
        place(
          cx - 22 + n * 4,
          cy - 10 + Math.round(Math.sin(n) * 3),
          "aegean_golden_tree",
        );
    else if (island.id === "drowned_lyre")
      for (let n = 0; n < 12; n++)
        place(
          cx - 15 + Math.round(Math.cos(n * 0.25) * 17),
          cy + 8 + Math.round(Math.sin(n * 0.25) * 13),
          "aegean_column",
        );
    else if (
      island.id.startsWith("sister_") ||
      island.id === "icarian" ||
      island.id === "delos"
    )
      place(cx - 7, cy - 12, "aegean_beacon");
    else {
      place(cx - 11, cy - 11, "aegean_pillar_cracked");
      place(cx - 17, cy - 9, "aegean_amphora");
    }
    switch (island.id) {
      case "kymene":
        place(cx - 23, cy - 5, "aegean_fishing_net");
        place(cx - 22, cy + 7, "aegean_basket");
        break;
      case "crete":
        for (let n = 0; n < 8; n++) {
          place(cx - 32 + n * 6, cy - 9, "aegean_vines");
          place(cx + 5 + n * 4, cy - 18, "aegean_vines");
        }
        for (let n = 0; n < 5; n++)
          place(cx - 24 + n * 6, cy + 20, "aegean_pillar_cracked");
        place(cx - 27, cy + 12, "aegean_portico");
        place(cx + 25, cy + 8, "aegean_cart");
        break;
      case "thalke":
        for (let n = 0; n < 7; n++) {
          const a = n * Math.PI * 0.27;
          place(
            cx + Math.round(Math.cos(a) * 17),
            cy + Math.round(Math.sin(a) * 29),
            "aegean_talos_footprint",
          );
        }
        place(cx - 14, cy - 14, "aegean_crane");
        break;
      case "gorgon":
        place(cx - 23, cy - 14, "aegean_courtyard_house");
        place(cx - 26, cy - 8, "aegean_mirror");
        break;
      case "erytheia":
        for (let n = 0; n < 6; n++) {
          place(cx - 22 + n * 6, cy - 19, "aegean_low_wall");
          place(cx - 22 + n * 6, cy + 20, "aegean_low_wall");
        }
        place(cx - 25, cy - 2, "aegean_pen_gate");
        place(cx + 22, cy + 3, "aegean_bell");
        place(cx + 14, cy - 18, "aegean_house");
        break;
      case "hesperides":
        place(cx - 18, cy + 9, "aegean_fountain");
        place(cx + 17, cy - 9, "aegean_arch");
        break;
      case "amazon":
        for (let n = 0; n < 4; n++) {
          place(cx - 23, cy - 18 + n * 7, "aegean_shield_wall");
          place(cx + 17, cy - 15 + n * 9, "aegean_standard");
        }
        place(cx - 16, cy + 20, "aegean_spartan_house");
        place(cx - 24, cy + 17, "aegean_cart");
        break;
      case "sirens":
        place(cx - 10, cy - 8, "aegean_sea_stack");
        place(cx + 6, cy - 13, "aegean_sea_stack");
        place(cx + 5, cy + 13, "aegean_sea_stack");
        place(cx - 9, cy + 9, "aegean_lyre");
        break;
      case "delos":
        for (const dx of [-8, 8])
          for (const dy of [-8, 8]) place(cx + dx, cy + dy, "aegean_column");
        place(cx - 8, cy + 12, "aegean_brazier");
        break;
      case "icarian":
        for (let n = 0; n < 7; n++)
          place(
            cx - 12 + n * 4,
            cy - 13 + Math.round(Math.sin(n) * 5),
            "aegean_bronze_feathers",
          );
        break;
      case "cyclops_table":
        place(cx - 15, cy - 9, "aegean_cyclops_table");
        place(cx - 21, cy + 7, "aegean_amphora");
        break;
      case "sister_west":
        place(cx - 7, cy + 7, "aegean_fishing_net");
        place(cx + 5, cy - 8, "aegean_house");
        break;
      case "sister_middle":
        place(cx - 7, cy + 10, "aegean_bell");
        place(cx + 6, cy - 9, "aegean_pillar_cracked");
        break;
      case "sister_east":
        for (let n = 0; n < 5; n++)
          place(cx - 7 + n * 3, cy + 9, "aegean_driftwood");
        break;
      case "drowned_lyre":
        place(cx + 10, cy - 13, "aegean_lyre");
        place(cx - 8, cy - 19, "aegean_petrified");
        break;
      case "ash_crown":
        for (let n = 0; n < 8; n++)
          place(
            cx + Math.round(Math.cos(n * 0.7) * 23),
            cy + Math.round(Math.sin(n * 0.7) * 22),
            "aegean_pillar_cracked",
          );
        break;
    }
    // An optional cache sits beside each island's off-road history. Stable IDs
    // mean a regenerated coast cannot duplicate treasure in existing saves.
    const signX = cx + Math.round(island.rx * 0.34),
      signY = cy + Math.round(island.ry * 0.31);
    if (
      !isSolid(getTile(map, signX, signY)) &&
      !isWater(getTile(map, signX, signY))
    ) {
      prop(map, signX + 1, signY, "aegean_stele", {
        interact: "sign",
        label: `Read the inscription of ${island.name}`,
        data: { text: island.discovery },
      });
      map.chests.push({
        id: `aegean:${island.id}:shore_cache`,
        x: signX * TILE + 16,
        y: signY * TILE + 16,
        level: 92,
        tier: "small",
        gold: 4000,
      });
    }
  }
  // The king's approach crosses red groves and ordered shield tombs below the
  // mountain; broken colonnades announce the sanctuary before its entrance.
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 7; col++)
      place(1768 + col * 5, 519 + row * 6, "aegean_shield_grave");
  for (let n = 0; n < 13; n++) {
    place(1798, 415 + n * 3, "aegean_column");
    place(1822, 415 + n * 3, "aegean_column");
  }
}
