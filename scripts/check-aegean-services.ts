/** Serial service regression. Bundle with esbuild --platform=node --format=esm,
 * then run with Node. Uses real seeded world/activity geometry, no raster buffers.
 */
import assert from "node:assert/strict";
import { AEGEAN_LOCATIONS, AEGEAN_PORTS } from "../src/data/aegean/world";
import { AegeanActivities } from "../src/game/aegean/activities";
import { AEGEAN_SERVICES, AegeanServices } from "../src/game/aegean/services";
import type { Game } from "../src/game/core/game";
import type { Buff } from "../src/game/player/player";
import { dungeonEntry, generateDungeon } from "../src/game/world/dungeons";
import { createMap, type GameMap } from "../src/game/world/map";
import { isSolid, T, TILE } from "../src/game/world/tiles";
import { generateOverworld } from "../src/game/world/worldgen";

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

function walkGrid(map: GameMap): Uint8Array {
  const grid = Uint8Array.from(map.tiles, (tile) => (isSolid(tile) ? 0 : 1));
  for (const p of map.props) {
    if (!p.cw || !p.ch) continue;
    for (
      let y = Math.max(0, Math.floor((p.y - p.ch - 7) / TILE));
      y <= Math.min(map.h - 1, Math.floor((p.y + 7) / TILE));
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor((p.x - p.cw / 2 - 10) / TILE));
        x <= Math.min(map.w - 1, Math.floor((p.x + p.cw / 2 + 10) / TILE));
        x++
      ) {
        const px = x * TILE + 16,
          py = y * TILE + 16;
        if (
          px + 10 > p.x - p.cw / 2 &&
          px - 10 < p.x + p.cw / 2 &&
          py + 7 > p.y - p.ch &&
          py - 7 < p.y
        )
          grid[y * map.w + x] = 0;
      }
    }
  }
  return grid;
}
function flood(
  map: GameMap,
  grid: Uint8Array,
  x: number,
  y: number,
): Uint8Array {
  const seen = new Uint8Array(grid.length),
    queue = new Uint32Array(grid.length);
  const start = Math.floor(y / TILE) * map.w + Math.floor(x / TILE);
  assert.ok(grid[start], `${map.id}: safe arrival`);
  let head = 0,
    tail = 0;
  seen[start] = 1;
  queue[tail++] = start;
  while (head < tail) {
    const i = queue[head++],
      tx = i % map.w,
      ty = Math.floor(i / map.w);
    for (const j of [
      tx ? i - 1 : -1,
      tx + 1 < map.w ? i + 1 : -1,
      ty ? i - map.w : -1,
      ty + 1 < map.h ? i + map.w : -1,
    ]) {
      if (j < 0 || seen[j] || !grid[j]) continue;
      seen[j] = 1;
      queue[tail++] = j;
    }
  }
  return seen;
}

const started = performance.now(),
  seed = 1337;
const world = generateOverworld(seed),
  maps = new Map<string, GameMap>([["overworld", world]]);
for (const id of [
  "aegean_acheron",
  "aegean_asphodel",
  "aegean_persephone",
  "aegean_hades",
]) {
  maps.set(
    id,
    generateDungeon(
      AEGEAN_LOCATIONS.find((l) => l.dungeon?.mapId === id)!,
      seed,
    ),
  );
}
let weapon = "bow",
  lockout = 0,
  checkpoints = 0;
const arrivals: Array<{ id: string; x: number; y: number }> = [];
const player = {
  x: 0,
  y: 0,
  gold: 50000,
  flags: new Set<string>(),
  buffs: [] as Buff[],
  hp: 1,
  mp: 1,
  sp: 1,
  maxHp: 100,
  maxMp: 80,
  maxSp: 90,
  statuses: [{}] as unknown[],
  dead: false,
  weaponKind: () => weapon,
};
const game = {
  player,
  map: world,
  now: 20,
  enemies: [] as Array<{
    dead: boolean;
    friendly: boolean;
    x: number;
    y: number;
  }>,
  fade: { pending: null as null | (() => void) },
  campaign: {
    has: (id: string) =>
      player.flags.has(id.startsWith("aegean:") ? id : `aegean:complete:${id}`),
    access: () => null,
    veteranMissing: () => [] as string[],
    setCheckpoint: () => {
      checkpoints++;
    },
  },
  naval: {
    aboard: false,
    state: {
      visitedPorts: [] as string[],
      lastPort: "",
      shipX: 0,
      shipY: 0,
      deck: undefined as unknown,
    },
  },
  encounters: { active: false },
  activities: { active: undefined, state: { runs: {} } },
  travelLockoutRemaining: () => lockout,
  toast: noop,
  touch: noop,
  autosave: noop,
  closeAll: noop,
  fx: { ring: noop },
  getMap: (id: string) => maps.get(id)!,
  travel(id: string, x: number, y: number) {
    arrivals.push({ id, x, y });
    this.fade.pending = noop;
  },
};
const services = new AegeanServices(game as unknown as Game);
const probe = services as unknown as {
  standingPoint(
    map: GameMap,
    x: number,
    y: number,
  ): { x: number; y: number } | null;
};
const activities = new AegeanActivities(game as unknown as Game);
for (const map of maps.values()) {
  game.map = map;
  activities.install(map);
  services.install(map);
  const count = map.props.length;
  services.install(map);
  assert.equal(map.props.length, count, `${map.id}: install is idempotent`);
}
const installed = [...maps.values()].flatMap((map) =>
  map.props.filter((p) => p.data?.service),
);
assert.equal(AEGEAN_SERVICES.length, 25);
assert.equal(
  installed.length,
  25,
  "Every promised service is physically installed",
);

const grid = walkGrid(world),
  routes = new Map<number, Uint8Array>();
routes.set(1, flood(world, grid, 1008 * TILE + 16, 405 * TILE + 16));
for (const id of ["aegean_kymene", "aegean_drowned_lyre", "aegean_asterion"]) {
  const port = AEGEAN_PORTS.find((p) => p.id === id)!;
  const mass =
    world.landmasses![
      Math.floor(port.land.y / TILE) * world.w + Math.floor(port.land.x / TILE)
    ];
  routes.set(mass, flood(world, grid, port.land.x, port.land.y));
}
const interiors = new Map<string, Uint8Array>();
for (const map of maps.values())
  if (map.id !== "overworld") {
    const entry = dungeonEntry(map);
    interiors.set(map.id, flood(map, walkGrid(map), entry.x, entry.y));
  }
for (const service of AEGEAN_SERVICES) {
  const map = maps.get(service.map)!;
  const prop = map.props.find((p) => p.data?.service === service.id)!;
  const index = Math.floor(prop.y / TILE) * map.w + Math.floor(prop.x / TILE);
  if (map.id === "overworld") {
    const expectedMass = map.landmasses![service.ty * map.w + service.tx];
    assert.ok(expectedMass, `${service.id}: authored anchor is on land`);
    assert.equal(
      map.landmasses![index],
      expectedMass,
      `${service.id}: safe-position search stays on the original landmass`,
    );
    assert.ok(
      routes.get(expectedMass)?.[index],
      `${service.id}: reachable from the appropriate town or dock with prop collision`,
    );
    if (service.island)
      assert.equal(
        expectedMass,
        18,
        `${service.id}: shortcut stays on Asterion`,
      );
  } else
    assert.ok(
      interiors.get(map.id)?.[index],
      `${service.id}: reachable from the Underworld entrance`,
    );
  if (service.to) {
    const target = maps.get(service.to.map)!;
    const arrival = probe.standingPoint(
      target,
      service.to.tx * TILE + 16,
      service.to.ty * TILE + 16,
    );
    assert.ok(arrival, `${service.id}: safe destination exists`);
    const idx =
      Math.floor(arrival.y / TILE) * target.w + Math.floor(arrival.x / TILE);
    if (target.id === "overworld") {
      const mass = target.landmasses![idx];
      assert.equal(
        mass,
        target.landmasses![service.to.ty * target.w + service.to.tx],
        `${service.id}: arrival retains its authored landmass`,
      );
      assert.ok(
        routes.get(mass)?.[idx],
        `${service.id}: destination connects to its town or dock`,
      );
      if (service.island) assert.equal(mass, 18);
    } else
      assert.ok(
        interiors.get(target.id)?.[idx],
        `${service.id}: destination connects to the Underworld entrance`,
      );
  }
}

const use = (id: string) => {
  const definition = AEGEAN_SERVICES.find((s) => s.id === id)!;
  game.map = maps.get(definition.map)!;
  const prop = game.map.props.find((p) => p.data?.service === id)!;
  player.x = prop.x;
  player.y = prop.y;
  game.fade.pending = null;
  services.interact(prop);
  return prop;
};
use("lighthouse_out");
assert.equal(arrivals.length, 0, "Locked flag does not travel");
player.flags.add("aegean:route:lighthouse");
game.naval.state.visitedPorts = ["aegean_aigialos"];
use("lighthouse_out");
assert.equal(
  arrivals.length,
  0,
  "A return ferry cannot replace the first voyage",
);
game.naval.state.visitedPorts.push("aegean_ember_quay");
const ferry = use("lighthouse_out");
assert.equal(arrivals.length, 1);
assert.equal(player.gold, 47500);
assert.equal(game.naval.state.lastPort, "aegean_ember_quay");
services.interact(ferry);
assert.equal(player.gold, 47500, "A pending fade cannot charge a second fare");
player.flags.add("aegean:shortcut:broken_oars");
use("broken_oars_out");
assert.equal(
  arrivals.length,
  1,
  "Champion flag alone cannot bypass the army or storm landing",
);
player.flags.add("aegean:complete:aegean_army");
player.flags.add("aegean:landed");
use("broken_oars_out");
assert.equal(arrivals.length, 2);
assert.equal(
  world.landmasses![
    Math.floor(arrivals[1].y / TILE) * world.w +
      Math.floor(arrivals[1].x / TILE)
  ],
  18,
);

player.flags.add("aegean:training:archery");
services.update(1);
assert.equal(player.buffs.length, 2);
services.update(1);
assert.equal(player.buffs.length, 2, "Training never stacks");
assert.equal(player.buffs.find((b) => b.stat === "critChance")?.amount, 3);
assert.equal(player.buffs.find((b) => b.stat === "range")?.amount, 16);
weapon = "sword";
services.update(1);
assert.equal(
  player.buffs.length,
  0,
  "Changing weapon removes the archery bonus",
);
player.flags.add("aegean:refuge:olive");
use("olive_refuge");
assert.equal(player.hp, 100);
assert.equal(player.mp, 80);
assert.equal(player.sp, 90);
assert.equal(player.statuses.length, 0);
assert.equal(checkpoints, 1);
assert.equal(
  player.buffs.find((b) => b.id === "aegean_refuge_stamina")?.amount,
  2,
);
player.flags.add("aegean:refuge:persephone");
use("persephone_refuge");
assert.equal(
  player.buffs.filter((b) => b.id === "aegean_refuge_stamina").length,
  1,
);
assert.equal(
  player.buffs.find((b) => b.id === "aegean_refuge_stamina")?.amount,
  3,
);
assert.equal(
  player.buffs.find((b) => b.id === "aegean_refuge_mana")?.until,
  game.now + 600,
);

player.flags.add("aegean:route:charon");
player.flags.add("aegean:visit:hades");
player.flags.delete("aegean:service:visited:aegean_hades");
use("charon_out");
assert.equal(
  arrivals.length,
  2,
  "Surface discovery cannot forge an actual Underworld visit",
);
game.map = maps.get("aegean_hades")!;
services.install(game.map);
use("charon_out");
assert.equal(
  arrivals.length,
  3,
  "A witnessed far end enables the return shortcut",
);
game.encounters.active = true;
use("lighthouse_out");
assert.equal(arrivals.length, 3);
player.hp = 9;
use("olive_refuge");
assert.equal(player.hp, 9, "Refuges cannot heal an active encounter");
game.encounters.active = false;
lockout = 2;
use("lighthouse_out");
assert.equal(arrivals.length, 3);
lockout = 0;
game.naval.aboard = true;
use("lighthouse_out");
assert.equal(arrivals.length, 3);
assert.ok(
  AEGEAN_SERVICES.every(
    (s) =>
      !s.ports ||
      s.ports.every(
        (id) => !["aegean_asterion", "aegean_last_shore"].includes(id),
      ),
  ),
  "No ferry can cross the army or storm gates",
);

const isolated = createMap({
  id: "overworld",
  name: "Landmass-search regression",
  w: 20,
  h: 20,
  landmasses: new Uint8Array(400).fill(2),
});
isolated.tiles.fill(T.GRASS);
isolated.tiles[210] = T.MARBLE_WALL;
isolated.landmasses![210] = 1;
assert.equal(
  probe.standingPoint(isolated, 10 * TILE + 16, 10 * TILE + 16),
  null,
  "Placement cannot borrow walkable ground from another island",
);
assert.throws(
  () => services.install(isolated),
  /No safe service position/,
  "Blocked services fail visibly instead of silently disappearing",
);
console.log(
  `All 25 Aegean services installed and reachable in the real world; first-voyage, visit, army, island, combat, fare, refuge and training guards passed. ${(performance.now() - started).toFixed(0)}ms.`,
);
