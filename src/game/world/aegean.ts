import {
  AEGEAN_ADVENTURES,
  AEGEAN_ISLANDS,
  AEGEAN_LOCATIONS,
  AEGEAN_PORTS,
  type AegeanPort,
} from "../../data/aegean/world";
import { RNG, fbm } from "../core/rng";
import {
  buildPropGrid,
  createMap,
  fillRect,
  getTile,
  setTile,
  type GameMap,
  type PropInstance,
} from "./map";
import { T, TILE, isSolid, isWater } from "./tiles";

/** The only legacy tiles an expansion is allowed to change. */
export const AEGEAN_SEAM_MASKS = [
  { x: 927, y: 386, w: 33, h: 9 },
  { x: 927, y: 686, w: 33, h: 9 },
] as const;

const COAST: Array<[number, number]> = [
  [0, 1250],
  [110, 1372],
  [220, 1380],
  [300, 1435],
  [355, 1475],
  [420, 1535],
  [460, 1475],
  [535, 1394],
  [640, 1398],
  [710, 1390],
  [780, 1440],
  [860, 1400],
  [948, 1345],
  [1015, 1330],
  [1087, 1270],
];

export function aegeanMainlandCoast(ty: number): number {
  let i = 1;
  while (i < COAST.length - 1 && ty > COAST[i][0]) i++;
  const a = COAST[i - 1],
    b = COAST[i];
  return (
    a[1] +
    ((b[1] - a[1]) * (ty - a[0])) / (b[0] - a[0]) +
    Math.sin(ty * 0.063) * 8 +
    Math.sin(ty * 0.019) * 7
  );
}

function mainlandRegion(x: number, y: number): number {
  if (y > 912) return 20;
  if (y < 208) return 14;
  if (y > 676 && x < 1235) return 19;
  if (y > 645) return 18;
  if (x > aegeanMainlandCoast(y) - 85) return y < 460 && x > 1460 ? 22 : 17;
  if (y > 454 && x < 1210) return 15;
  if (x > 1200 && y < 451) return 16;
  if (y < 360) return 13;
  return 12;
}

function ground(region: number): number {
  return region === 14
    ? T.SNOW
    : region === 19
      ? T.SWAMP_GROUND
      : region === 20 || region === 23
        ? T.BASALT
        : region === 18
          ? T.TERRACOTTA
          : region === 16
            ? T.MARBLE
            : T.AEGEAN_GRASS;
}

function prop(
  map: GameMap,
  tx: number,
  ty: number,
  art: string,
  options: Partial<PropInstance> = {},
): void {
  map.props.push({
    art,
    x: tx * TILE + TILE / 2,
    y: ty * TILE + TILE,
    ...options,
  });
}

/** Roads stay on their landmass; they cannot turn a sea crossing into a bridge. */
function path(
  map: GameMap,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width = 2,
  force = false,
): void {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay));
  for (let s = 0; s <= n; s++) {
    const x = Math.round(ax + ((bx - ax) * s) / Math.max(1, n));
    const y = Math.round(ay + ((by - ay) * s) / Math.max(1, n));
    for (let dy = -width; dy <= width; dy++)
      for (let dx = -width; dx <= width; dx++) {
        const tx = x + dx,
          ty = y + dy;
        if (tx < 927 || tx >= map.w - 4 || ty < 4 || ty >= map.h - 4) continue;
        if (force || (map.landmasses?.[ty * map.w + tx] ?? 0) > 0)
          setTile(map, tx, ty, T.MARBLE);
      }
  }
}

function clearLanding(
  map: GameMap,
  x: number,
  y: number,
  radius: number,
): void {
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const i = (y + dy) * map.w + x + dx;
      if (dx * dx + dy * dy > radius * radius || !map.landmasses?.[i]) continue;
      setTile(map, x + dx, y + dy, T.MARBLE);
    }
}

function buildPort(map: GameMap, p: AegeanPort): void {
  const west = p.id === "aegean_asterion";
  const direction = west ? -1 : 1;
  const lx = Math.floor(p.launch.x / TILE),
    ly = Math.floor(p.launch.y / TILE);
  const landX = Math.floor(p.land.x / TILE),
    landY = Math.floor(p.land.y / TILE);
  // A local approach, never a bridge between separate islands.
  fillRect(map, p.tx - 3, p.ty - 4, 7, 9, T.MARBLE);
  path(map, landX, landY, p.tx, p.ty, 2, true);
  const waterStart = p.tx + direction * 5;
  for (let y = ly - 5; y <= ly + 5; y++) {
    for (
      let x = Math.min(waterStart, lx - 4);
      x <= Math.max(waterStart, lx + 4);
      x++
    ) {
      setTile(map, x, y, T.AEGEAN_SHALLOWS);
      map.landmasses![y * map.w + x] = 0;
    }
  }
  for (let s = 0; s < 5; s++)
    fillRect(map, p.tx + direction * s, p.ty - 1, 1, 3, T.FLOOR_WOOD);
  prop(map, p.tx, p.ty, "aegean_mooring", {
    interact: "aegean",
    label: `Sail from ${p.name}`,
    data: { action: "dock", port: p.id },
    nameplate: p.name,
    nameplateColor: "#92d5de",
  });
  prop(map, p.tx - direction * 2, p.ty - 4, "aegean_beacon", {
    light: 180,
    lightColor: "#9ed6d5",
  });
}

function town(map: GameMap, loc: (typeof AEGEAN_LOCATIONS)[number]): void {
  clearLanding(map, loc.tx, loc.ty, 22);
  const roof =
    loc.id === "aegean_sparta" ? "aegean_spartan_house" : "aegean_house";
  for (const [dx, dy] of [
    [-12, -9],
    [11, -9],
    [-14, 9],
    [14, 9],
    [-2, -15],
  ]) {
    prop(map, loc.tx + dx, loc.ty + dy, roof, { cw: 92, ch: 48 });
  }
  prop(map, loc.tx, loc.ty - 7, "aegean_temple", {
    cw: 108,
    ch: 32,
    nameplate: loc.name,
    nameplateColor: "#e2c787",
  });
  const services: Array<[number, number, string, string, string]> = [
    [-7, 3, "aegean_scroll", "chronicle", "Open the Aegean Chronicle"],
    [7, 3, "aegean_anvil", "forge", "Visit the Greek forge"],
    [0, 10, "aegean_fountain", "rest", "Rest and recover"],
    [-7, 11, "chest_large", "storage", "Open storage"],
    [7, 11, "market_stall", "shop", "Buy expedition supplies"],
  ];
  for (const [dx, dy, art, action, label] of services)
    prop(map, loc.tx + dx, loc.ty + dy, art, {
      interact: "aegean",
      label,
      data: { action, settlement: loc.id },
      cw: 20,
      ch: 12,
    });
  if (loc.travelPolicy === "waystone")
    prop(map, loc.tx - 6, loc.ty - 5, "waystone", {
      interact: "waystone",
      label: `Travel from ${loc.name}`,
      data: { site: loc.id },
      light: 100,
      lightColor: "#76bac5",
      cw: 28,
      ch: 14,
    });
  for (const dx of [-18, 18])
    prop(map, loc.tx + dx, loc.ty + 1, "aegean_cypress", { cw: 10, ch: 7 });
}

/** Marine breadth-first distance. Island shores deliberately are not distance sources. */
export function buildOffshoreField(map: GameMap): Uint16Array {
  const field = new Uint16Array(map.w * map.h);
  field.fill(65535);
  const queue = new Int32Array(960 * map.h);
  let head = 0,
    tail = 0;
  for (let y = 1; y < map.h - 1; y++)
    for (let x = 960; x < map.w - 1; x++) {
      const i = y * map.w + x;
      if (!isWater(map.tiles[i]) || map.tiles[i] === T.SWAMP_WATER) continue;
      if (
        [i - 1, i + 1, i - map.w, i + map.w].some(
          (j) => map.landmasses?.[j] === 1,
        )
      ) {
        field[i] = 0;
        queue[tail++] = i;
      }
    }
  while (head < tail) {
    const i = queue[head++],
      x = i % map.w,
      y = Math.floor(i / map.w);
    for (const j of [
      x > 960 ? i - 1 : -1,
      x < map.w - 1 ? i + 1 : -1,
      y > 0 ? i - map.w : -1,
      y < map.h - 1 ? i + map.w : -1,
    ]) {
      if (
        j < 0 ||
        field[j] !== 65535 ||
        !isWater(map.tiles[j]) ||
        map.tiles[j] === T.SWAMP_WATER
      )
        continue;
      field[j] = Math.min(65534, field[i] + 1);
      queue[tail++] = j;
    }
  }
  return field;
}

/** Give the authored story stations a readable court without creating sea bridges. */
export function prepareAegeanActivityGround(
  map: GameMap,
  activities: ReadonlyArray<{ tx: number; ty: number; map?: string }>,
): void {
  const courts: Array<{ x: number; y: number }> = [];
  for (const activity of activities) {
    if ((activity.map ?? "overworld") !== map.id) continue;
    const x = activity.tx,
      y = activity.ty;
    if (map.id === "overworld" && (x < 960 || !map.landmasses?.[y * map.w + x]))
      continue;
    if (isWater(getTile(map, x, y))) continue;
    let road: { x: number; y: number } | undefined;
    for (let r = 7; r <= 28 && !road; r += 3) {
      for (let a = 0; a < 16; a++) {
        const tx = Math.round(x + Math.cos((a * Math.PI) / 8) * r),
          ty = Math.round(y + Math.sin((a * Math.PI) / 8) * r);
        if (getTile(map, tx, ty) === T.MARBLE) {
          road = { x: tx, y: ty };
          break;
        }
      }
    }
    for (let dy = -6; dy <= 6; dy++)
      for (let dx = -6; dx <= 6; dx++) {
        const tx = x + dx,
          ty = y + dy;
        if (dx * dx + dy * dy > 36 || isWater(getTile(map, tx, ty))) continue;
        if (
          map.id !== "overworld" ||
          map.landmasses?.[ty * map.w + tx] === map.landmasses?.[y * map.w + x]
        )
          setTile(map, tx, ty, T.MARBLE);
      }
    if (road && map.id === "overworld") path(map, x, y, road.x, road.y, 1);
    courts.push({ x: x * TILE, y: y * TILE });
  }
  map.props = map.props.filter(
    (p) =>
      !p.cw ||
      p.interact ||
      p.nameplate ||
      !courts.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 220),
  );
  map.revision = `${map.revision ?? map.id}:activities`;
  buildPropGrid(map);
}

export function appendAegean(legacy: GameMap, seed: number): GameMap {
  const map = createMap({
    id: "overworld",
    name: "Realms of Ash and Achaea",
    w: 1920,
    h: 1088,
    props: [...legacy.props],
    portals: [...legacy.portals],
    spawns: [...legacy.spawns],
    chests: [...legacy.chests],
    regions: new Uint8Array(1920 * 1088),
    landmasses: new Uint8Array(1920 * 1088),
    revision: `${seed}:aegean-v1`,
  });
  for (let y = 0; y < legacy.h; y++) {
    map.tiles.set(
      legacy.tiles.subarray(y * legacy.w, (y + 1) * legacy.w),
      y * map.w,
    );
    if (legacy.regions)
      map.regions!.set(
        legacy.regions.subarray(y * legacy.w, (y + 1) * legacy.w),
        y * map.w,
      );
  }
  for (let y = 0; y < map.h; y++) {
    const coast = aegeanMainlandCoast(y);
    for (let x = 960; x < map.w; x++) {
      const i = y * map.w + x;
      map.regions![i] = 22;
      if (y < 4 || y >= map.h - 4 || x >= map.w - 4) {
        map.tiles[i] = T.VOID;
        continue;
      }
      if (x > coast) {
        map.tiles[i] = x < coast + 15 ? T.AEGEAN_SHALLOWS : T.AEGEAN_SEA;
        continue;
      }
      const region = mainlandRegion(x, y);
      map.regions![i] = region;
      map.landmasses![i] = 1;
      const n = fbm(x * 0.027, y * 0.027, seed + 7919, 2);
      let tile = ground(region);
      if (x > coast - 6) tile = region === 20 ? T.BASALT : T.SAND;
      else if ((region === 14 || region === 16) && n > 0.71)
        tile = region === 14 ? T.SNOW_ROCK : T.CLIFF;
      else if (region === 19 && n < 0.36) tile = T.SWAMP_WATER;
      else if (region === 15 && n > 0.53) tile = T.FARM_SOIL;
      else if (n > 0.72) tile = T.STONE_GROUND;
      if (x < 969) tile = T.MOUNTAIN;
      map.tiles[i] = tile;
    }
  }
  for (const island of AEGEAN_ISLANDS) {
    for (let y = island.ty - island.ry; y <= island.ty + island.ry; y++) {
      for (let x = island.tx - island.rx; x <= island.tx + island.rx; x++) {
        const dx = (x - island.tx) / island.rx,
          dy = (y - island.ty) / island.ry;
        const angle = Math.atan2(dy, dx);
        // Perturb inward only: the authored water gap and boundary are inviolate.
        const shore =
          0.88 +
          Math.sin(angle * 5 + island.landmass) * 0.04 +
          Math.sin(angle * 9) * 0.025;
        const d = Math.hypot(dx, dy);
        if (d > shore + 0.08) continue;
        const i = y * map.w + x;
        if (d > shore) {
          if (!map.landmasses![i]) map.tiles[i] = T.AEGEAN_SHALLOWS;
          continue;
        }
        map.landmasses![i] = island.landmass;
        map.regions![i] = island.id === "asterion" ? 23 : 21;
        map.tiles[i] =
          d > shore - 0.065
            ? island.coast === "volcanic" || island.coast === "storm"
              ? T.BASALT
              : T.SAND
            : island.coast === "volcanic" || island.id === "asterion"
              ? T.BASALT
              : T.AEGEAN_GRASS;
        if (island.id === "asterion" && y < 398 && d < 0.6)
          map.tiles[i] = T.MARBLE;
      }
    }
  }
  // Two actual river valleys, with regular fords and roads built afterwards.
  for (const start of [1035, 1155]) {
    for (let y = 475; y < 656; y++) {
      const x = Math.round(start + Math.sin(y * 0.031) * 15 + (y - 475) * 0.19);
      fillRect(map, x - 2, y, 5, 1, T.WATER);
    }
  }
  const roads: Array<[number, number, number, number]> = [
    [930, 390, 978, 390],
    [978, 390, 1008, 405],
    [930, 690, 978, 690],
    [978, 690, 1080, 590],
    [1008, 405, 1090, 330],
    [1008, 405, 1080, 590],
    [1008, 405, 1280, 365],
    [1280, 365, 1350, 535],
    [1080, 590, 1350, 535],
    [1350, 535, 1310, 765],
    [1080, 590, 1110, 828],
    [1310, 765, 1290, 948],
    [1290, 948, 1272, 1015],
    [1280, 365, 1250, 112],
    [1280, 365, 1382, 298],
    [1280, 365, 1480, 420],
    [1480, 420, 1530, 420],
  ];
  for (const [ax, ay, bx, by] of roads) path(map, ax, ay, bx, by, 2, ax < 960);
  const mainlandTowns = AEGEAN_LOCATIONS.filter(
    (l) => l.kind === "village" && l.id !== "aegean_kymene",
  );
  for (const a of AEGEAN_ADVENTURES.filter((a) => !a.surfaceMap)) {
    const landmass = map.landmasses![a.ty * map.w + a.tx];
    const source =
      landmass === 1
        ? mainlandTowns.reduce((best, t) =>
            Math.hypot(t.tx - a.tx, t.ty - a.ty) <
            Math.hypot(best.tx - a.tx, best.ty - a.ty)
              ? t
              : best,
          )
        : AEGEAN_ISLANDS.find((i) => i.landmass === landmass);
    if (source) path(map, source.tx, source.ty, a.tx, a.ty, 2);
    clearLanding(map, a.tx, a.ty, 7);
  }
  for (const loc of AEGEAN_LOCATIONS) {
    if (loc.surfaceMap) continue;
    if (loc.kind === "village") {
      town(map, loc);
      continue;
    }
    if (loc.dungeon) {
      clearLanding(map, loc.tx, loc.ty, 7);
      const island = loc.region === "aegean_asterion";
      prop(
        map,
        loc.tx,
        loc.ty - 1,
        island ? "aegean_oath_gate" : "aegean_temple",
        { cw: 96, ch: 28, nameplate: loc.name, nameplateColor: "#e2c787" },
      );
      prop(map, loc.tx - 3, loc.ty + 4, "aegean_scroll", {
        interact: "sign",
        label: `Read: ${loc.name}`,
        data: { text: `${loc.name} — level ${loc.level}. ${loc.desc}` },
      });
      map.portals.push({
        x: loc.tx * TILE - 18,
        y: (loc.ty + 2) * TILE,
        w: 36,
        h: 36,
        to: loc.dungeon.mapId,
        tx: 0,
        ty: 0,
        label: `Enter ${loc.name}`,
        kind: "stairs",
        locked: loc.gate,
      });
    } else if (loc.kind === "landmark") {
      prop(map, loc.tx - 7, loc.ty, "aegean_statue", {
        interact: "aegean",
        label: `Discover ${loc.name}`,
        data: { action: "discovery", location: loc.id },
        cw: 22,
        ch: 12,
      });
      map.chests.push({
        id: `${loc.id}:discovery`,
        x: (loc.tx - 6) * TILE,
        y: (loc.ty + 3) * TILE,
        level: loc.level ?? 92,
        tier: "large",
      });
    }
  }
  for (const p of AEGEAN_PORTS) {
    const island = AEGEAN_ISLANDS.find((i) => `aegean_${i.id}` === p.id);
    const source = island ??
      AEGEAN_LOCATIONS.find((l) => l.id === p.id) ?? { tx: 1480, ty: 420 };
    path(
      map,
      source.tx,
      source.ty,
      Math.floor(p.land.x / TILE),
      Math.floor(p.land.y / TILE),
      2,
    );
    buildPort(map, p);
  }
  // Decorations and ordinary actors use their own stream; no legacy identity changes.
  const rng = new RNG(`${seed}:aegean:scenery:v1`);
  const scenery = [
    "aegean_olive",
    "aegean_cypress",
    "aegean_column",
    "aegean_amphora",
  ];
  for (let y = 12; y < map.h - 12; y += 3)
    for (let x = 976; x < map.w - 12; x += 3) {
      const i = y * map.w + x,
        tile = map.tiles[i],
        region = map.regions![i];
      if (
        isSolid(tile) ||
        isWater(tile) ||
        tile === T.MARBLE ||
        tile === T.FLOOR_WOOD ||
        rng.next() > 0.23
      )
        continue;
      if (
        AEGEAN_LOCATIONS.some(
          (l) =>
            !l.surfaceMap &&
            Math.hypot(l.tx - x, l.ty - y) < (l.kind === "village" ? 25 : 10),
        )
      )
        continue;
      const art =
        region === 14
          ? "tree_pine_snow"
          : region === 19
            ? "reeds"
            : region === 20
              ? "aegean_fumarole"
              : region === 23
                ? rng.bool(0.7)
                  ? "aegean_red_cypress"
                  : "aegean_shield_grave"
                : rng.pick(scenery);
      prop(map, x, y, art, {
        cw: art.includes("cypress") || art.includes("olive") ? 10 : undefined,
        ch: 7,
        phase: rng.range(0, 6),
      });
    }
  const rosters: Record<number, string[]> = {
    12: ["aegean_hound", "aegean_satyr"],
    13: ["aegean_centaur", "aegean_piper", "aegean_sacred_boar"],
    14: ["aegean_harpy", "aegean_storm_harpy", "aegean_stag"],
    15: ["aegean_torch_dancer", "aegean_hound"],
    16: ["aegean_drakon", "aegean_automaton"],
    17: ["aegean_crab", "aegean_siren", "aegean_hoplite"],
    18: ["aegean_hoplite", "aegean_centaur_elder"],
    19: ["aegean_viper", "aegean_constrictor", "aegean_bronze_harpy"],
    20: ["aegean_furnace_guardian", "aegean_empousa", "aegean_kere"],
    21: ["aegean_talos_shard", "aegean_serpent", "aegean_siren"],
    22: ["aegean_oath_shade", "aegean_hoplite"],
    23: ["aegean_royal_guard", "aegean_burial_priest", "aegean_oath_shade"],
  };
  const levels: Record<number, number> = {
    12: 76,
    13: 79,
    14: 89,
    15: 82,
    16: 86,
    17: 84,
    18: 92,
    19: 88,
    20: 95,
    21: 93,
    22: 97,
    23: 100,
  };
  for (let y = 30; y < map.h - 30; y += 19)
    for (let x = 985; x < map.w - 25; x += 19) {
      const tx = x + rng.int(-5, 5),
        ty = y + rng.int(-5, 5),
        i = ty * map.w + tx;
      if (
        !map.landmasses![i] ||
        isSolid(map.tiles[i]) ||
        map.tiles[i] === T.MARBLE
      )
        continue;
      if (
        AEGEAN_LOCATIONS.some(
          (l) =>
            !l.surfaceMap &&
            Math.hypot(l.tx - tx, l.ty - ty) < (l.kind === "village" ? 36 : 14),
        )
      )
        continue;
      const region = map.regions![i],
        table = rosters[region];
      if (!table) continue;
      map.spawns.push({
        id: `aegean:surface:${tx}:${ty}`,
        enemy: rng.pick(table),
        x: tx * TILE + 16,
        y: ty * TILE + 16,
        level: Math.min(100, levels[region] + rng.int(0, 3)),
        radius: 150,
        group: rng.bool(0.32) ? 2 : 1,
        respawn: 240 + rng.int(0, 120),
        region: AEGEAN_LOCATIONS.find(
          (l) =>
            l.region && l.tx > 960 && Math.hypot(l.tx - tx, l.ty - ty) < 70,
        )?.region,
      });
    }
  map.offshore = buildOffshoreField(map);
  buildPropGrid(map);
  return map;
}
