/** Serial, bounded geometry regression. Bundle with the installed esbuild, then run in Node.
 * Canvas calls are stubbed: terrain/prop collision is real, no browser or raster
 * buffers are allocated. The legacy building generator only needs its dimensions.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import baseline from "./aegean-legacy-baseline.json";
import {
  AEGEAN_ADVENTURES,
  AEGEAN_ISLANDS,
  AEGEAN_LOCATIONS,
  AEGEAN_MAP_IDS,
  AEGEAN_PORTS,
  AEGEAN_TOWN_LAYOUTS,
  AEGEAN_WAYSTONES,
} from "../src/data/aegean/world";
import { AEGEAN_ISLAND_ECOLOGY, AEGEAN_MAINLAND_ECOLOGY, AEGEAN_RARE_SPECIES } from "../src/data/aegean/ecology";
import { RNG } from "../src/game/core/rng";
import { aegeanWaystoneDestination } from "../src/game/aegean/waypoints";
import { AEGEAN_ACTIVITIES } from "../src/data/aegean/progression";
import { AEGEAN_PROP_NAMES } from "../src/game/art/aegean";
import { PROP_NAMES } from "../src/game/art/props";
import {
  generateOverworld,
  generateLegacyOverworld,
} from "../src/game/world/worldgen";
import { generateDungeon, dungeonEntry } from "../src/game/world/dungeons";
import {
  AEGEAN_SEAM_MASKS,
  prepareAegeanActivityGround,
} from "../src/game/world/aegean";
import {
  boxHitsTerrain,
  tilePassable,
  type GameMap,
} from "../src/game/world/map";
import { isSolid, isWater, T, TILES, TILE } from "../src/game/world/tiles";

const noop = () => undefined;
const knownArt = new Set([...AEGEAN_PROP_NAMES, ...PROP_NAMES]);
const missingArt = new Set<string>();
function assertAuthoredArt(props: GameMap["props"], name: string): void {
  for (const key of new Set(props.map((p) => p.art)))
    if (!knownArt.has(key) && !key.startsWith("bld:"))
      missingArt.add(`${name}: ${key}`);
}
const context = new Proxy(
  {},
  {
    get: (_target, key) =>
      key === "createLinearGradient" || key === "createRadialGradient"
        ? () => ({ addColorStop: noop })
        : key === "measureText"
          ? () => ({ width: 0 })
          : noop,
    set: () => true,
  },
);
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => context }),
} as unknown as Document;

function walkGrid(map: GameMap, props: boolean): Uint8Array {
  const grid = Uint8Array.from(map.tiles, (t) => (isSolid(t) ? 0 : 1));
  if (props)
    for (const p of map.props) {
      if (!p.cw || !p.ch) continue;
      const x0 = Math.max(0, Math.floor((p.x - p.cw / 2 - 9) / TILE));
      const x1 = Math.min(map.w - 1, Math.floor((p.x + p.cw / 2 + 9) / TILE));
      const y0 = Math.max(0, Math.floor((p.y - p.ch - 7) / TILE));
      const y1 = Math.min(map.h - 1, Math.floor((p.y + 7) / TILE));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const px = x * TILE + 16,
            py = y * TILE + 16;
          if (
            px + 9 > p.x - p.cw / 2 &&
            px - 9 < p.x + p.cw / 2 &&
            py + 7 > p.y - p.ch &&
            py - 7 < p.y
          )
            grid[y * map.w + x] = 0;
        }
    }
  return grid;
}
function flood(
  map: GameMap,
  grid: Uint8Array,
  sx: number,
  sy: number,
): Uint8Array {
  const seen = new Uint8Array(grid.length),
    queue = new Uint32Array(grid.length);
  const start = Math.floor(sy / TILE) * map.w + Math.floor(sx / TILE);
  assert.ok(grid[start], `${map.id}: entry must be walkable`);
  let head = 0,
    tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const i = queue[head++],
      x = i % map.w,
      y = Math.floor(i / map.w);
    for (const j of [
      x ? i - 1 : -1,
      x < map.w - 1 ? i + 1 : -1,
      y ? i - map.w : -1,
      y < map.h - 1 ? i + map.w : -1,
    ]) {
      if (j < 0 || seen[j] || !grid[j]) continue;
      seen[j] = 1;
      queue[tail++] = j;
    }
  }
  return seen;
}
function reached(
  map: GameMap,
  seen: Uint8Array,
  x: number,
  y: number,
): boolean {
  return seen[Math.floor(y / TILE) * map.w + Math.floor(x / TILE)] === 1;
}

const seed = Number(process.env.AEGEAN_TEST_SEED ?? 1337);
const started = performance.now();
const activityAnchors = new Map<string, string>();
for (const activity of AEGEAN_ACTIVITIES) {
  const key = `${activity.map ?? "overworld"}:${activity.tx}:${activity.ty}`;
  assert.ok(
    !activityAnchors.has(key),
    `${activity.id}: interaction overlaps ${activityAnchors.get(key)} at ${key}`,
  );
  activityAnchors.set(key, activity.id);
}
const legacy = generateLegacyOverworld(seed);
// These hashes were generated from every dependency at git d39d75a, including
// the original 75-level cap. Comparing two calls to today's generator alone
// would miss an accidental shared change to both legacy and appended maps.
if (seed === baseline.seed) {
  assert.equal(legacy.w, baseline.w);
  assert.equal(legacy.h, baseline.h);
  for (const key of [
    "tiles",
    "regions",
    "props",
    "portals",
    "spawns",
    "chests",
  ] as const) {
    const bytes =
      key === "tiles" || key === "regions"
        ? legacy[key]!
        : JSON.stringify(legacy[key]);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      baseline.sha256[key],
      `${key}: frozen git ${baseline.baseCommit} baseline`,
    );
  }
}
const world = generateOverworld(seed);
// Replay the pre-clarity patrol stream against the unchanged generated ground.
// This frozen old algorithm checks stable save IDs as well as real population
// change; it deliberately consumes the original four actor draws per patrol.
const previousPatrols = new Map<string, { x: number; y: number; group: number; enemy: string }>();
const previousRng = new RNG(`${seed}:aegean:actors:v1`);
for (let y = 30; y < world.h - 30; y += 15) for (let x = 985; x < world.w - 25; x += 15) {
  const tx = x + previousRng.int(-5, 5), ty = y + previousRng.int(-5, 5), i = ty * world.w + tx;
  if (!world.landmasses![i] || isSolid(world.tiles[i]) || isWater(world.tiles[i]) || world.tiles[i] === T.MARBLE) continue;
  if (AEGEAN_LOCATIONS.some(l => !l.surfaceMap && Math.hypot(l.tx - tx, l.ty - ty) < (l.kind === 'village' ? 36 : 14))) continue;
  const island = AEGEAN_ISLANDS.find(island => island.landmass === world.landmasses![i]);
  const table = (island ? AEGEAN_ISLAND_ECOLOGY[island.id] : AEGEAN_MAINLAND_ECOLOGY[world.regions![i]])?.enemies;
  if (!table) continue;
  const enemy = table[previousRng.int(0, table.length - 1)]; previousRng.int(0, 3);
  const group = previousRng.bool(.55) ? 2 : 1; previousRng.int(0, 120);
  previousPatrols.set(`aegean:surface:${tx}:${ty}`, { x: tx * TILE + 16, y: ty * TILE + 16, group, enemy });
}
const patrols = world.spawns.filter(spawn => spawn.id.startsWith('aegean:surface:'));
for (const spawn of patrols) {
  const old = previousPatrols.get(spawn.id);
  assert(old, `${spawn.id}: thinning retains an existing patrol ID`);
  assert.equal(spawn.x, old.x); assert.equal(spawn.y, old.y);
  if (AEGEAN_RARE_SPECIES.has(spawn.enemy)) { assert.equal(spawn.group, 1, 'Rare creatures always patrol alone'); assert(spawn.respawn >= 540, 'Rare creatures return less frequently'); }
}
const oldPopulation = [...previousPatrols.values()].reduce((sum, p) => sum + p.group, 0);
const population = patrols.reduce((sum, p) => sum + (p.group ?? 1), 0);
const oldRare = [...previousPatrols.values()].filter(p => AEGEAN_RARE_SPECIES.has(p.enemy)).reduce((sum, p) => sum + p.group, 0);
const rare = patrols.filter(p => AEGEAN_RARE_SPECIES.has(p.enemy)).length;
assert(patrols.length / previousPatrols.size > .65 && patrols.length / previousPatrols.size < .79, 'Moderate land patrol reduction');
assert(population / oldPopulation > .57 && population / oldPopulation < .77, 'Fewer mobs without stripping the land empty');
assert(rare / population < oldRare / oldPopulation * .55, 'Apex creatures occupy a much smaller part of the population');
console.log(`Seed ${seed} ordinary Greek patrols: ${previousPatrols.size} -> ${patrols.length}; creatures ${oldPopulation} -> ${population}; rare creatures ${oldRare} -> ${rare}.`);
for (const island of AEGEAN_ISLANDS) {
  const residents = world.spawns.filter(spawn => world.landmasses![Math.floor(spawn.y / TILE) * world.w + Math.floor(spawn.x / TILE)] === island.landmass);
  for (const enemy of AEGEAN_ISLAND_ECOLOGY[island.id].enemies)
    assert(residents.some(spawn => spawn.enemy === enemy), `${island.id}: its ${enemy} really occupies walkable territory`);
}
assertAuthoredArt(world.props.slice(legacy.props.length), "Greek overworld");
assert.equal(world.w, 1920);
assert.equal(world.h, 1088);
assert.equal(world.tiles.length, 2 * legacy.tiles.length);
// A realm seam is now open landscape, not two keyhole gates in a vertical rim.
let openBorder = 0;
for (let y = 18; y < world.h - 18; y++)
  if (
    !isSolid(world.tiles[y * world.w + 959]) &&
    !isSolid(world.tiles[y * world.w + 960])
  )
    openBorder++;
assert.ok(
  openBorder > 700,
  `Expected broad natural biome transition; only ${openBorder} open rows`,
);
// All major Greek land biomes must have terrain variation at atlas scale, not
// merely trees placed over one flat background material.
for (let region = 12; region <= 20; region++) {
  const counts = new Map<number, number>();
  let total = 0;
  for (let y = 8; y < world.h - 8; y++)
    for (let x = 974; x < 1450; x++) {
      const i = y * world.w + x;
      if (world.regions![i] !== region || world.landmasses![i] !== 1) continue;
      counts.set(world.tiles[i], (counts.get(world.tiles[i]) ?? 0) + 1);
      total++;
    }
  const substantial = [...counts.values()].filter((n) => n > total * 0.008);
  assert.ok(
    substantial.length >= 5,
    `Region ${region}: only ${substantial.length} meaningful terrain materials`,
  );
}
// Sharing roads and the game's collision rules must never turn into copying
// the western natural biomes. Check the finished, stamped world rather than
// only the terrain function, so town/river/island passes cannot reintroduce it.
const retiredGreekTerrain = new Set<number>([
  T.DEEP_WATER, T.WATER, T.SAND, T.GRASS, T.GRASS_DARK, T.GRASS_PALE,
  T.TALL_GRASS, T.FLOWERS, T.DIRT, T.FARM_SOIL, T.STONE_GROUND, T.GRAVEL,
  T.MOUNTAIN, T.CLIFF, T.SNOW, T.SNOW_ROCK, T.ICE, T.SWAMP_WATER,
  T.SWAMP_GROUND, T.MUD, T.DESERT_SAND, T.DESERT_ROCK, T.ASH_GROUND,
]);
const regionMaterials = new Map<number, Map<number, number>>();
const islandMaterials = new Map<number, Map<number, number>>();
for (let y = 0; y < world.h; y++) for (let x = 960; x < world.w; x++) {
  const i = y * world.w + x, region = world.regions![i], tile = world.tiles[i];
  if (region < 12) continue; // Narrow, intentional western transition.
  assert.ok(!retiredGreekTerrain.has(tile),
    `Greek region ${region} copied ${TILES[tile].name} at ${x},${y}`);
  const regional = regionMaterials.get(region) ?? new Map<number, number>();
  regional.set(tile, (regional.get(tile) ?? 0) + 1);
  regionMaterials.set(region, regional);
  const mass = world.landmasses![i];
  if (mass > 1) {
    const island = islandMaterials.get(mass) ?? new Map<number, number>();
    island.set(tile, (island.get(tile) ?? 0) + 1);
    islandMaterials.set(mass, island);
  }
}
for (const [region, materials] of [
  [12, [T.THYME_SCRUB, T.AEGEAN_GRASS, T.LIMESTONE]],
  [13, [T.LAUREL_FLOOR]],
  [14, [T.OLYMPIAN_MEADOW, T.LIMESTONE]],
  [15, [T.GOLDEN_TERRACE]],
  [16, [T.GOLDEN_TERRACE, T.LAUREL_FLOOR]],
  [17, [T.SHELL_BEACH, T.THYME_SCRUB]],
  [18, [T.EUROTAS_EARTH]],
  [19, [T.REED_BANK, T.LERNA_POOL, T.DELTA_SILT]],
  [20, [T.OBSIDIAN, T.PUMICE, T.BLACK_BEACH]],
  [23, [T.STORM_HEATH, T.OBSIDIAN]],
] as Array<[number, number[]]>) for (const tile of materials) {
  assert.ok((regionMaterials.get(region)?.get(tile) ?? 0) > 16,
    `Region ${region}: missing substantial ${TILES[tile].name}`);
}
for (const [id, material] of [
  ["hesperides", T.GOLDEN_GARDEN], ["crete", T.VINEYARD_SOIL],
  ["gorgon", T.LIMESTONE], ["ash_crown", T.OBSIDIAN],
  ["asterion", T.STORM_HEATH],
] as Array<[string, number]>) {
  const island = AEGEAN_ISLANDS.find((island) => island.id === id)!;
  assert.ok((islandMaterials.get(island.landmass)?.get(material) ?? 0) > 16,
    `${id}: its landscape must include ${TILES[material].name}`);
}
// Marine surf must not be painted onto an inland karst spring or a walkable
// reed pool. Their movement properties still follow the original water rules.
assert.ok(isSolid(T.AEGEAN_SPRING) && isWater(T.AEGEAN_SPRING));
assert.ok(!isSolid(T.LERNA_POOL) && isWater(T.LERNA_POOL));
assert.equal(TILES[T.LERNA_POOL].speed, TILES[T.SWAMP_WATER].speed);
for (const tile of [T.AEGEAN_SHALLOWS, T.AEGEAN_SEA])
  assert.ok(isSolid(tile) && isWater(tile));
assert.equal(TILES[T.SHELL_BEACH].shore, "sand");
assert.equal(TILES[T.BLACK_BEACH].shore, "sand");
assert.equal(TILES[T.PUMICE].shore, "shingle");
assert.equal(TILES[T.LIMESTONE].shore, "rock");
assert.equal(TILES[T.OBSIDIAN].shore, "rock");
// The gulfs must remain open marine geography and may never become bridges
// when roads or settlements are regenerated over them.
for (const [x, y] of [
  [1320, 153],
  [1432, 361],
  [1342, 698],
])
  assert.ok(
    isWater(world.tiles[y * world.w + x]) &&
      world.landmasses![y * world.w + x] === 0,
    `Open gulf at ${x},${y}`,
  );
for (const id of [
  "aegean_contract_pass",
  "aegean_discovery_split_star",
  "aegean_storm_altar",
]) {
  const activity = AEGEAN_ACTIVITIES.find((a) => a.id === id)!;
  assert.equal(
    world.landmasses![activity.ty * world.w + activity.tx],
    1,
    `${id}: mountain activity stays on mainland, never silently converted to a sea buoy`,
  );
}
assert.equal(AEGEAN_ISLANDS.length, 17, "Sixteen small islands plus Asterion");
assert.equal(
  AEGEAN_MAP_IDS.length,
  36,
  "31 encounter maps plus five Underworld spaces",
);
for (let y = 0; y < legacy.h; y++)
  for (let x = 0; x < legacy.w; x++) {
    if (
      AEGEAN_SEAM_MASKS.some(
        (m) => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h,
      )
    )
      continue;
    assert.equal(
      world.tiles[y * world.w + x],
      legacy.tiles[y * legacy.w + x],
      `Legacy tile changed at ${x},${y}`,
    );
    assert.equal(
      world.regions![y * world.w + x],
      legacy.regions![y * legacy.w + x],
      `Legacy region changed at ${x},${y}`,
    );
  }
assert.deepEqual(
  world.props.slice(0, legacy.props.length),
  legacy.props,
  "Legacy props and their order survive",
);
assert.deepEqual(
  world.portals.slice(0, legacy.portals.length),
  legacy.portals,
  "Legacy portals survive",
);
assert.deepEqual(
  world.spawns.slice(0, legacy.spawns.length),
  legacy.spawns,
  "Legacy spawn IDs and positions survive",
);
assert.deepEqual(
  world.chests.slice(0, legacy.chests.length),
  legacy.chests,
  "Legacy chest IDs and positions survive",
);

for (const port of AEGEAN_PORTS) {
  assert.equal(
    boxHitsTerrain(world, port.land.x, port.land.y, 9, 7),
    false,
    `${port.id}: land anchor`,
  );
  assert.equal(
    boxHitsTerrain(world, port.launch.x, port.launch.y, 16, 12, "ship"),
    false,
    `${port.id}: ship launch`,
  );
  const idx =
    Math.floor(port.launch.y / TILE) * world.w +
    Math.floor(port.launch.x / TILE);
  assert.notEqual(
    world.offshore![idx],
    65535,
    `${port.id}: launch must connect to mainland marine water`,
  );
}
const marineGrid = new Uint8Array(world.tiles.length);
for (let i = 0; i < marineGrid.length; i++) {
  const x = i % world.w;
  // The live hull uses half-width 16 at tile centres, touching the next tile.
  marineGrid[i] =
    x + 1 < world.w &&
    tilePassable(world.tiles[i], "ship") &&
    tilePassable(world.tiles[i + 1], "ship")
      ? 1
      : 0;
}
const marine = flood(
  world,
  marineGrid,
  AEGEAN_PORTS[0].launch.x,
  AEGEAN_PORTS[0].launch.y,
);
for (const port of AEGEAN_PORTS)
  assert.ok(
    reached(world, marine, port.launch.x, port.launch.y),
    `${port.id}: hull-sized route from Aigialos`,
  );
const mainWalk = flood(
  world,
  walkGrid(world, false),
  1008 * TILE + 16,
  405 * TILE + 16,
);
let asterionLand = 0;
for (let i = 0; i < world.tiles.length; i++)
  if (world.landmasses![i] === 18) {
    asterionLand++;
    assert.equal(
      mainWalk[i],
      0,
      "Asterion must have no foot route from the mainland",
    );
  }
assert.ok(
  asterionLand > 20000,
  "Asterion is a substantial island, not a boss platform",
);
for (const loc of AEGEAN_LOCATIONS.filter((l) => !l.surfaceMap)) {
  if (world.landmasses![loc.ty * world.w + loc.tx] !== 1) continue;
  assert.ok(
    reached(
      world,
      mainWalk,
      loc.tx * TILE + 16,
      (loc.ty + (loc.dungeon ? 3 : 0)) * TILE + 16,
    ),
    `${loc.id}: connected mainland entrance`,
  );
}
prepareAegeanActivityGround(world, AEGEAN_ACTIVITIES);
const surfaceGrid = walkGrid(world, true);
const surfaceRoutes = new Map<number, Uint8Array>();
surfaceRoutes.set(
  1,
  flood(world, surfaceGrid, 1008 * TILE + 16, 405 * TILE + 16),
);
for (const island of AEGEAN_ISLANDS) {
  const port = AEGEAN_PORTS.find((p) => p.id === `aegean_${island.id}`)!;
  surfaceRoutes.set(
    island.landmass,
    flood(world, surfaceGrid, port.land.x, port.land.y),
  );
}
for (const loc of AEGEAN_LOCATIONS.filter((l) => !l.surfaceMap)) {
  const mass = world.landmasses![loc.ty * world.w + loc.tx];
  assert.ok(mass, `${loc.id}: named surface destination stands on land`);
  assert.ok(
    reached(
      world,
      surfaceRoutes.get(mass)!,
      loc.tx * TILE + 16,
      (loc.ty + (loc.dungeon ? 3 : 0)) * TILE + 16,
    ),
    `${loc.id}: foot route from its landing with prop collision`,
  );
}
for (const stone of AEGEAN_WAYSTONES.filter((stone) => stone.mapId === "overworld")) {
  const arrival = aegeanWaystoneDestination(stone.id)!;
  const mass = world.landmasses![Math.floor(arrival.y / TILE) * world.w + Math.floor(arrival.x / TILE)];
  assert.ok(mass, `${stone.id}: waypoint arrival is on land`);
  assert.equal(boxHitsTerrain(world, arrival.x, arrival.y, 9, 7), false, `${stone.id}: clear arrival terrain`);
  assert.ok(reached(world, surfaceRoutes.get(mass)!, arrival.x, arrival.y), `${stone.id}: arrival reachable from its town or dock with prop collision`);
  assert.equal(world.props.filter((p) => p.interact === "waystone" && p.data?.site === stone.id).length, 1, `${stone.id}: exactly one physical stone`);
}
for (const loc of AEGEAN_LOCATIONS.filter((l) => l.kind === "village")) {
  for (const [n, [dx, dy]] of AEGEAN_TOWN_LAYOUTS[loc.id]
    .slice(0, 3)
    .entries()) {
    const kind = ["inn", "smithy", "store"][n],
      id = `int_${loc.id}_${kind}`;
    assert.equal(
      world.portals.filter((p) => p.to === id).length,
      1,
      `${id}: one usable front door`,
    );
    const mass = world.landmasses![loc.ty * world.w + loc.tx];
    assert.ok(
      reached(
        world,
        surfaceRoutes.get(mass)!,
        (loc.tx + dx + 0.5) * TILE,
        (loc.ty + dy + 2.5) * TILE,
      ),
      `${id}: doorstep reachable with real building collision`,
    );
  }
}
for (const a of AEGEAN_ACTIVITIES.filter(
  (a) => !a.map || a.map === "overworld",
)) {
  const i = a.ty * world.w + a.tx;
  if (!world.landmasses![i]) continue; // Explicit marine discoveries are buoy interactions.
  assert.equal(
    boxHitsTerrain(world, a.tx * TILE + 16, a.ty * TILE + 16, 9, 7),
    false,
    `${a.id}: activity court`,
  );
  assert.ok(
    reached(
      world,
      surfaceRoutes.get(world.landmasses![i])!,
      a.tx * TILE + 16,
      a.ty * TILE + 16,
    ),
    `${a.id}: activity reachable from its landing`,
  );
}

for (const id of AEGEAN_MAP_IDS) {
  const loc = AEGEAN_LOCATIONS.find((l) => l.dungeon?.mapId === id);
  assert.ok(loc?.dungeon, `${id}: registered map`);
  const map = generateDungeon(loc, seed);
  assertAuthoredArt(map.props, id);
  prepareAegeanActivityGround(map, AEGEAN_ACTIVITIES);
  const entry = dungeonEntry(map),
    seen = flood(map, walkGrid(map, true), entry.x, entry.y);
  const stone = AEGEAN_WAYSTONES.find((stone) => stone.mapId === id);
  if (stone) {
    const arrival = aegeanWaystoneDestination(stone.id)!;
    assert.ok(reached(map, seen, arrival.x, arrival.y), `${id}: Underworld waypoint reachable from entry with prop collision`);
    assert.equal(boxHitsTerrain(map, arrival.x, arrival.y, 9, 7), false, `${id}: clear Underworld arrival terrain`);
    assert.equal(map.props.filter((p) => p.interact === "waystone" && p.data?.site === stone.id).length, 1, `${id}: physical Underworld stone`);
  }
  if (id === "aegean_leonidas") {
    const anvil = map.props.find(p => p.interact === "aegean" && p.data?.action === "forge");
    assert.ok(anvil, "The island has a usable forge for earned recipes and royal choices");
    assert.ok(reached(map, seen, anvil.x, anvil.y + 24), "The island anvil is reachable from the temple entrance");
  }
  const expected =
    AEGEAN_ADVENTURES.find((a) => a.id === id)?.objectives.length ?? 0;
  const tools = map.props.filter((p) => p.data?.action === "objective");
  assert.equal(tools.length, expected, `${id}: authored mechanic count`);
  assert.equal(map.spawns.length, 0, `${id}: director owns its actors`);
  for (const p of tools) {
    assert.ok(
      reached(map, seen, p.x, p.y - 16),
      `${id}: objective ${p.data?.index} reachable with terrain and prop collision`,
    );
  }
  for (const key of ["entry", "arena", "boss", "safe", "enemy"])
    for (const p of map.encounterNodes?.[key] ?? []) {
      assert.ok(
        reached(map, seen, p.x, p.y),
        `${id}: ${key} node ${p.x / TILE},${p.y / TILE} reachable`,
      );
    }
  for (const p of map.portals)
    assert.ok(
      reached(map, seen, p.x + p.w / 2, p.y + p.h / 2),
      `${id}: portal to ${p.to} reachable`,
    );
  for (const a of AEGEAN_ACTIVITIES.filter((a) => a.map === id))
    assert.ok(
      reached(map, seen, a.tx * TILE + 16, a.ty * TILE + 16),
      `${id}: activity ${a.id} reachable`,
    );
}
assert.deepEqual(
  [...missingArt],
  [],
  "Every Greek prop has authored art, never fallback pixels",
);
console.log(
  `Aegean geometry passed for seed ${seed}: exact doubling, frozen ${baseline.baseCommit} legacy identities, ${AEGEAN_PORTS.length} connected usable docks, isolated Asterion, 36 connected authored maps, all land activities reachable. ${(performance.now() - started).toFixed(0)}ms.`,
);
