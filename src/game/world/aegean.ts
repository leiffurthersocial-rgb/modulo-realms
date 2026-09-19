import {
  AEGEAN_ADVENTURES,
  AEGEAN_ISLANDS,
  AEGEAN_LOCATIONS,
  AEGEAN_PORTS,
  AEGEAN_TOWN_LAYOUTS,
  AEGEAN_WAYSTONES,
  type AegeanPort,
} from "../../data/aegean/world";
import { RNG } from "../core/rng";
import {
  aegeanPath,
  generateAegeanTerrain,
  scatterAegeanScenery,
} from "./aegeanGeography";
export { AEGEAN_SEAM_MASKS, aegeanMainlandCoast } from "./aegeanGeography";
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

const path = aegeanPath;

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
      const tile = map.tiles[i];
      if (isSolid(tile) || isWater(tile))
        setTile(map, x + dx, y + dy, T.LIMESTONE);
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
      // Dredge only the obstructing shore. Preserve the naturally tapered sea
      // shelf beyond it instead of painting a long rectangular turquoise bar.
      if (!isWater(getTile(map, x, y))) {
        setTile(map, x, y, T.AEGEAN_SHALLOWS);
        map.landmasses![y * map.w + x] = 0;
      }
    }
  }
  for (let s = 0; s < 5; s++)
    fillRect(map, p.tx + direction * s, p.ty - 1, 1, 3, T.FLOOR_WOOD);
  prop(map, p.tx, p.ty, "aegean_mooring", {
    interact: "aegean",
    label: `Shipwright at ${p.name}`,
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
  const x = loc.tx,
    y = loc.ty,
    id = loc.id;
  clearLanding(map, x, y, 25);
  const roof = id === "aegean_sparta" ? "aegean_spartan_house" : "aegean_house";
  // Small plazas, curved lanes and individual thresholds leave natural ground
  // between buildings, as the original settlements do. No giant marble discs.
  for (let dy = -4; dy <= 5; dy++)
    for (let dx = -5; dx <= 5; dx++)
      if (Math.abs(dx) + Math.abs(dy) < 9) setTile(map, x + dx, y + dy, T.ROAD);
  for (const [n, [dx, dy]] of AEGEAN_TOWN_LAYOUTS[id].entries()) {
    path(map, x, y + 1, x + dx, y + dy + 2, 1);
    fillRect(map, x + dx - 2, y + dy - 1, 5, 3, T.MARBLE);
    const kind = ["inn", "smithy", "store"][n];
    prop(map, x + dx, y + dy, n % 3 === 1 ? "aegean_courtyard_house" : roof, {
      cw: 92,
      ch: 48,
      nameplate:
        kind === "inn"
          ? "INN"
          : kind === "smithy"
            ? "FORGE"
            : kind === "store"
              ? "TRADING POST"
              : undefined,
      nameplateColor:
        kind === "inn" ? "#ddbd77" : kind === "smithy" ? "#ca8958" : "#9fad74",
    });
    if (kind) {
      map.portals.push({
        x: (x + dx) * TILE,
        y: (y + dy + 1) * TILE - 26,
        w: 32,
        h: 30,
        to: `int_${id}_${kind}`,
        tx: 0,
        ty: 0,
        label: `Enter the ${kind === "smithy" ? "forge" : kind === "store" ? "trading post" : "inn"}`,
        kind: "door",
      });
      fillRect(map, x + dx - 1, y + dy + 1, 3, 2, T.ROAD_DIRT);
    }
    prop(
      map,
      x + dx + 3,
      y + dy + 1,
      n % 2 ? "aegean_amphora" : "aegean_vines",
    );
  }
  const centreArt =
    id === "aegean_delphi" || id === "aegean_sparta"
      ? "aegean_temple"
      : id === "aegean_potamoi"
        ? "aegean_watermill"
        : id === "aegean_aigialos" || id === "aegean_ember_quay"
          ? "aegean_warehouse"
          : "aegean_portico";
  fillRect(map, x - 3, y - 9, 7, 4, T.MARBLE);
  prop(map, x, y - 7, centreArt, {
    cw: 108,
    ch: 32,
    nameplate: id === "aegean_thyra" ? "GATE MARKET — TRADE HALL" : loc.name,
    nameplateColor: "#e2c787",
  });
  if (id === "aegean_thyra") {
    map.portals.push({
      x: x * TILE - 2, y: (y - 6) * TILE + 2, w: 36, h: 36,
      to: "int_aegean_thyra_market", tx: 0, ty: 0,
      label: "Enter the Gate Market — buy and sell", kind: "door",
    });
    fillRect(map, x - 1, y - 5, 3, 3, T.ROAD);
  }
  const services: Array<[number, number, string, string, string]> = [
    [-7, 3, "notice_board", "journal", "Read local rumours"],
    [7, 3, "aegean_anvil", "forge", "Visit the Greek forge"],
    [0, 10, "aegean_fountain", "rest", "Rest and recover"],
    [-7, 11, "chest", "storage", "Open storage"],
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
    prop(map, loc.tx + dx, loc.ty + 23, "aegean_cypress", { cw: 10, ch: 7 });
  for (const [dx, dy] of [
    [-10, -3],
    [10, -3],
    [-10, 14],
    [10, 14],
  ])
    prop(map, x + dx, y + dy, "torch", {
      light: 115,
      lightColor: "#edba74",
      cw: 7,
      ch: 5,
    });
  prop(map, x - 12, y + 13, "cart");
  prop(map, x + 12, y + 10, "barrel");
  if (id === "aegean_thyra" || id === "aegean_aigialos")
    for (const dx of [-12, 12])
      prop(map, x + dx, y + 2, "market_stall", { cw: 30, ch: 12 });
  if (id === "aegean_delphi")
    for (const dx of [-5, 5]) prop(map, x + dx, y - 13, "aegean_column");
  if (id === "aegean_sparta")
    for (const dx of [-9, 9]) prop(map, x + dx, y - 8, "aegean_standard");
  // Furnished street edges are visible on foot, not only when a whole town is
  // viewed at atlas scale. The centre and scheduled NPC lanes stay open.
  for (const [dx, dy, art] of [
    [-8, -7, "market_stall"],
    [8, -6, "market_stall"],
    [-4, -7, "aegean_amphora"],
    [4, -7, "aegean_vines"],
    [-3, -5, "bench"],
    [3, -5, "planter"],
    [-5, -1, "aegean_vines"],
    [6, -1, "aegean_amphora"],
    [-3, 3, "bench"],
    [6, 6, "aegean_basket"],
    [-6, 7, "aegean_basket"],
    [1, 3, "planter"],
    [-9, 8, "aegean_low_wall"],
    [9, 8, "aegean_low_wall"],
    [-11, -6, "barrel"],
    [11, -6, "crate"],
    [-1, 13, "aegean_clothesline"],
    [3, 13, "aegean_amphora"],
  ] as Array<[number, number, string]>)
    prop(map, x + dx, y + dy, art);
  const localWork =
    id === "aegean_potamoi"
      ? "aegean_wheat"
      : id === "aegean_sparta"
        ? "aegean_shield_wall"
        : id === "aegean_aigialos" || id === "aegean_kymene"
          ? "aegean_fishing_net"
          : id === "aegean_ember_quay"
            ? "aegean_anvil"
            : id === "aegean_delphi"
              ? "aegean_statue"
              : "aegean_cart";
  prop(map, x + 9, y + 5, localWork);
  for (const [dx, dy] of [
    [-6, -10],
    [6, -11],
    [-10, 5],
    [10, 12],
    [-5, 15],
  ])
    prop(
      map,
      x + dx,
      y + dy,
      id === "aegean_nemean_hearth" ? "aegean_olive" : "aegean_thyme",
    );
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
      if (!isWater(map.tiles[i]) || (map.tiles[i] === T.SWAMP_WATER || map.tiles[i] === T.LERNA_POOL)) continue;
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
        (map.tiles[j] === T.SWAMP_WATER || map.tiles[j] === T.LERNA_POOL)
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
    let road: { x: number; y: number } | undefined;
    for (let r = 7; r <= 28 && !road; r += 3) {
      for (let a = 0; a < 16; a++) {
        const tx = Math.round(x + Math.cos((a * Math.PI) / 8) * r),
          ty = Math.round(y + Math.sin((a * Math.PI) / 8) * r);
        const tile = getTile(map, tx, ty);
        if (tile === T.ROAD || tile === T.ROAD_DIRT || tile === T.BRIDGE) {
          road = { x: tx, y: ty };
          break;
        }
      }
    }
    for (let dy = -6; dy <= 6; dy++)
      for (let dx = -6; dx <= 6; dx++) {
        const tx = x + dx,
          ty = y + dy;
        if (dx * dx + dy * dy > 36) continue;
        if (
          map.id !== "overworld" ||
          map.landmasses?.[ty * map.w + tx] === map.landmasses?.[y * map.w + x]
        )
          if (isWater(getTile(map, tx, ty))) {
            // Wetland stories stand on narrow crossing boardwalks, preserving
            // the water and banks instead of erasing a circular marble pad.
            if (Math.abs(dx) <= 1 || Math.abs(dy) <= 1)
              setTile(map, tx, ty, T.BRIDGE);
          } else if (isSolid(getTile(map, tx, ty)))
            setTile(map, tx, ty, T.LIMESTONE);
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
    revision: `${seed}:aegean-v2`,
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
  generateAegeanTerrain(map, seed);
  const roads: Array<Array<[number, number]>> = [
    [
      [930, 390],
      [978, 390],
      [1008, 405],
    ],
    [
      [930, 690],
      [978, 690],
      [996, 648],
      [1023, 624],
      [1080, 590],
    ],
    [
      [1008, 405],
      [1018, 367],
      [1061, 357],
      [1090, 330],
    ],
    [
      [1008, 405],
      [1003, 463],
      [1020, 541],
      [1080, 590],
    ],
    [
      [1008, 405],
      [1088, 426],
      [1150, 409],
      [1210, 376],
      [1241, 357],
      [1280, 365],
    ],
    [
      [1280, 365],
      [1296, 412],
      [1278, 463],
      [1304, 501],
      [1350, 535],
    ],
    [
      [1080, 590],
      [1140, 610],
      [1200, 592],
      [1260, 601],
      [1324, 565],
      [1350, 535],
    ],
    [
      [1350, 535],
      [1284, 568],
      [1250, 601],
      [1234, 654],
      [1243, 707],
      [1274, 735],
      [1310, 765],
    ],
    [
      [1080, 590],
      [1092, 662],
      [1063, 725],
      [1079, 786],
      [1110, 828],
    ],
    [
      [1310, 765],
      [1326, 817],
      [1298, 853],
      [1271, 895],
      [1290, 948],
    ],
    [
      [1290, 948],
      [1255, 979],
      [1272, 1015],
    ],
    [
      [1280, 365],
      [1263, 307],
      [1240, 251],
      [1265, 205],
      [1234, 158],
      [1250, 112],
    ],
    [
      [1280, 365],
      [1305, 314],
      [1345, 299],
      [1382, 298],
    ],
    [
      [1280, 365],
      [1314, 402],
      [1380, 409],
      [1422, 440],
      [1480, 420],
    ],
    [
      [1480, 420],
      [1505, 431],
      [1530, 420],
    ],
  ];
  for (const points of roads) {
    const a = points[0],
      b = points[points.length - 1];
    path(map, a[0], a[1], b[0], b[1], 2, false, points.slice(1, -1));
  }
  const royalRoads: Array<Array<[number, number]>> = [
    [
      [1740, 476],
      [1756, 472],
      [1779, 464],
      [1793, 443],
      [1810, 452],
    ],
    [
      [1756, 472],
      [1766, 451],
      [1760, 440],
      [1770, 426],
      [1787, 410],
      [1810, 398],
      [1835, 406],
      [1850, 416],
    ],
    [
      [1850, 416],
      [1859, 440],
      [1844, 466],
      [1851, 493],
      [1854, 515],
      [1835, 530],
      [1810, 535],
      [1794, 548],
    ],
    [
      [1794, 548],
      [1770, 532],
      [1763, 514],
      [1758, 490],
      [1756, 472],
    ],
    [
      [1779, 464],
      [1801, 482],
      [1824, 483],
      [1844, 466],
    ],
  ];
  for (const points of royalRoads) {
    const a = points[0],
      b = points[points.length - 1];
    path(map, a[0], a[1], b[0], b[1], 1, false, points.slice(1, -1));
  }
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
    if (source && landmass !== 18)
      path(map, source.tx, source.ty, a.tx, a.ty, 1);
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
        loc.id === "aegean_leonidas"
          ? "aegean_great_temple"
          : island
            ? "aegean_oath_gate"
            : "aegean_temple",
        {
          cw: loc.id === "aegean_leonidas" ? 280 : 96,
          ch: 28,
          nameplate: loc.id === "aegean_army" ? "GATES OF THE LAST SHORE — THE THREE HUNDRED" : loc.name,
          nameplateColor: "#e2c787",
        },
      );
      prop(map, loc.tx - 3, loc.ty + 4, "aegean_scroll", {
        interact: "sign",
        label: `Read: ${loc.name}`,
        data: { text: loc.id === "aegean_army"
          ? "The Three Hundred hold this pass. Enter the gate to challenge their army. Defeating them opens the Last Shore harbour and the sea route toward Leonidas. Cleared rally stages are remembered if you retreat."
          : `${loc.name} — level ${loc.level}. ${loc.desc}` },
      });
      map.portals.push({
        // Put the prompt at the visible doorway, not two tiles down the path.
        x: loc.tx * TILE - 2,
        y: loc.ty * TILE + 2,
        w: 36,
        h: 36,
        to: loc.dungeon.mapId,
        tx: 0,
        ty: 0,
        label: loc.id === "aegean_army" ? "Challenge the Three Hundred" : `Enter ${loc.name}`,
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
    if (p.id !== "aegean_asterion")
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
  // Town stones already stand beside their square. The rest sit beside the
  // dungeon approach or on the harbour apron, with a clear place to arrive.
  for (const stone of AEGEAN_WAYSTONES) {
    if (stone.mapId !== "overworld") continue;
    const loc = AEGEAN_LOCATIONS.find((l) => l.id === stone.id)!;
    if (loc.kind === "village") continue;
    clearLanding(map, stone.tx, stone.ty + 1, 3);
    path(map, stone.tx, stone.ty + 1, loc.tx, loc.ty + (loc.dungeon ? 3 : 0), 1);
    prop(map, stone.tx, stone.ty, "waystone", {
      interact: "waystone", label: `Travel from ${loc.name}`,
      data: { site: loc.id }, light: 100, lightColor: "#76bac5",
      cw: 28, ch: 14,
    });
  }
  scatterAegeanScenery(map, seed);
  const rng = new RNG(`${seed}:aegean:actors:v1`);
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
