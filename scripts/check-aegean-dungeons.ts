/** Small serial regression for every authored Greek dungeon; no world raster or browser. */
import assert from "node:assert/strict";
import { AEGEAN_ADVENTURES, AEGEAN_LOCATIONS, AEGEAN_MAP_IDS, AEGEAN_WAYSTONES } from "../src/data/aegean/world";
import { aegeanWaystoneDestination } from "../src/game/aegean/waypoints";
import { AEGEAN_ACTIVITIES } from "../src/data/aegean/progression";
import { AEGEAN_PROP_NAMES } from "../src/game/art/aegean";
import { PROP_NAMES } from "../src/game/art/props";
import { generateDungeon, dungeonEntry } from "../src/game/world/dungeons";
import { prepareAegeanActivityGround } from "../src/game/world/aegean";
import { boxHitsTerrain, type GameMap } from "../src/game/world/map";
import { isSolid, T, TILE } from "../src/game/world/tiles";
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


const seed = 1337;
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
const armyLoc = AEGEAN_LOCATIONS.find((l) => l.dungeon?.mapId === "aegean_army")!;
const battlefield = generateDungeon(armyLoc, seed);
assert.equal(battlefield.w, 96);
assert.equal(battlefield.h, 80);
assert.equal(Object.keys(battlefield.encounterNodes!).filter((k) => k.startsWith("company_")).length, 10);
assert.equal(Object.keys(battlefield.encounterNodes!).filter((k) => k.startsWith("chapter_") || k.startsWith("reserve_")).length, 0);
for (const [key, nodes] of Object.entries(battlefield.encounterNodes!)) if (key.startsWith("company_"))
  for (const point of nodes) assert.ok(([T.DIRT,T.MUD,T.GRAVEL] as number[]).includes(battlefield.tiles[Math.floor(point.y/TILE)*battlefield.w+Math.floor(point.x/TILE)]), "every army company stands on soil");
assert.deepEqual([...missingArt],[],"all authored props have artwork");
console.log(`All ${AEGEAN_MAP_IDS.length} Greek dungeons: tools, doors, entry, boss and safe nodes reachable; compact arenas and single soil battlefield verified.`);
