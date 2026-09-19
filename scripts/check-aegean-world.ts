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
} from "../src/data/aegean/world";
import { AEGEAN_ACTIVITIES } from "../src/data/aegean/progression";
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
import { isSolid, TILE } from "../src/game/world/tiles";

const noop = () => undefined;
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
assert.equal(world.w, 1920);
assert.equal(world.h, 1088);
assert.equal(world.tiles.length, 2 * legacy.tiles.length);
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
  prepareAegeanActivityGround(map, AEGEAN_ACTIVITIES);
  const entry = dungeonEntry(map),
    seen = flood(map, walkGrid(map, true), entry.x, entry.y);
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
console.log(
  `Aegean geometry passed for seed ${seed}: exact doubling, frozen ${baseline.baseCommit} legacy identities, ${AEGEAN_PORTS.length} connected usable docks, isolated Asterion, 36 connected authored maps, all land activities reachable. ${(performance.now() - started).toFixed(0)}ms.`,
);
