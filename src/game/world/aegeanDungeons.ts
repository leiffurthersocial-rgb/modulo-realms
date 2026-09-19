import {
  AEGEAN_ADVENTURE_BY_ID,
  AEGEAN_UNDERWORLD_IDS,
  type AegeanAdventure,
} from "../../data/aegean/world";
import type { LocationDef } from "../../data/locations";
import { RNG } from "../core/rng";
import {
  buildPropGrid,
  createMap,
  fillRect,
  getTile,
  setTile,
  type GameMap,
  type PropInstance,
} from "./map";
import { T, TILE, isSolid } from "./tiles";

type Point = [number, number];
interface Builder {
  map: GameMap;
  a?: AegeanAdventure;
  entry: Point;
  floor: number;
  rng: RNG;
}

function disc(
  b: Builder,
  x: number,
  y: number,
  rx: number,
  ry = rx,
  tile = b.floor,
): void {
  for (let dy = -Math.ceil(ry); dy <= ry; dy++)
    for (let dx = -Math.ceil(rx); dx <= rx; dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1)
        setTile(b.map, x + dx, y + dy, tile);
    }
}

function room(
  b: Builder,
  x: number,
  y: number,
  w: number,
  h: number,
  tile = b.floor,
): void {
  fillRect(b.map, x, y, w, h, tile);
}

function line(b: Builder, a: Point, z: Point, width = 3, tile = b.floor): void {
  const steps = Math.ceil(Math.hypot(z[0] - a[0], z[1] - a[1]));
  for (let i = 0; i <= steps; i++)
    disc(
      b,
      Math.round(a[0] + ((z[0] - a[0]) * i) / Math.max(1, steps)),
      Math.round(a[1] + ((z[1] - a[1]) * i) / Math.max(1, steps)),
      width,
      width,
      tile,
    );
}

function ring(
  b: Builder,
  x: number,
  y: number,
  rx: number,
  ry: number,
  thickness: number,
  tile = b.floor,
): void {
  for (let a = 0; a < Math.PI * 2; a += 0.025)
    disc(
      b,
      Math.round(x + Math.cos(a) * rx),
      Math.round(y + Math.sin(a) * ry),
      thickness,
      thickness,
      tile,
    );
}

function node(b: Builder, key: string, x: number, y: number): void {
  (b.map.encounterNodes![key] ??= []).push({
    x: x * TILE + TILE / 2,
    y: y * TILE + TILE / 2,
  });
}

function art(
  b: Builder,
  x: number,
  y: number,
  name: string,
  o: Partial<PropInstance> = {},
): void {
  b.map.props.push({
    art: name,
    x: x * TILE + TILE / 2,
    y: y * TILE + TILE,
    ...o,
  });
}

function objective(
  b: Builder,
  index: number,
  x: number,
  y: number,
  name: string,
): void {
  // Objective anchors always have a wide, independently reachable landing.
  disc(b, x, y, 3);
  const title = b.a?.objectives[index] ?? `Anchor ${index + 1}`;
  art(b, x, y, name, {
    interact: "aegean",
    label: title,
    light: 90,
    lightColor: "#d1b578",
    data: {
      action: "objective",
      encounter: b.map.id,
      index,
      order: index,
      objective: title.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    },
  });
  node(b, "objective", x, y);
  node(b, `objective_${index}`, x, y);
  node(b, "enemy", x + 3, y + 2);
}

function arena(b: Builder, x: number, y: number, rx: number, ry = rx): void {
  disc(b, x, y, rx, ry);
  node(b, "arena", x, y);
  node(b, "boss", x, y);
  node(b, "safe", x, y + Math.max(3, ry - 4));
}

function columns(b: Builder, x: number, y: number, w: number, h: number): void {
  for (let dx = 0; dx <= w; dx += 8) {
    art(b, x + dx, y, "aegean_column", { cw: 18, ch: 12 });
    art(b, x + dx, y + h, "aegean_column", { cw: 18, ch: 12 });
  }
}

function portal(
  b: Builder,
  x: number,
  y: number,
  to: string,
  label: string,
  locked?: string,
): void {
  disc(b, x, y, 4);
  art(b, x, y, "aegean_oath_gate");
  b.map.portals.push({
    x: x * TILE - 16,
    y: y * TILE,
    w: 32,
    h: 36,
    to,
    tx: 0,
    ty: 0,
    label,
    kind: "portal",
    locked,
  });
}

function lion(b: Builder): void {
  // Two ravines flank a den; the north passage is the lion's second exit.
  b.map.tiles.fill(T.CLIFF);
  line(b, b.entry, [28, 66], 5, T.AEGEAN_GRASS);
  line(b, [28, 66], [31, 27], 5, T.AEGEAN_GRASS);
  line(b, [28, 66], [80, 72], 6, T.AEGEAN_GRASS);
  line(b, [80, 72], [87, 30], 5, T.AEGEAN_GRASS);
  line(b, [31, 27], [87, 30], 4, T.CAVE_FLOOR);
  arena(b, 59, 40, 21, 19);
  line(b, [31, 40], [87, 40], 5);
  for (const [i, x, y] of [
    [0, 40, 44],
    [1, 76, 42],
    [2, 59, 25],
  ])
    objective(b, i, x, y, "aegean_pillar_cracked");
  for (const p of [
    [28, 65],
    [31, 52],
    [43, 41],
  ] as Point[])
    art(b, p[0], p[1], "bone_pile", { flat: true });
}

function hydra(b: Builder): void {
  b.map.tiles.fill(T.STYGIAN);
  line(b, b.entry, [55, 75], 4);
  ring(b, 56, 45, 36, 27, 4, T.MARBLE);
  arena(b, 56, 45, 25, 17);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const p: Point = [
      Math.round(56 + Math.cos(a) * 33),
      Math.round(45 + Math.sin(a) * 24),
    ];
    line(b, p, [56, 45], 3);
    objective(b, i, p[0], p[1], "aegean_brazier");
  }
  for (const [x, y] of [
    [44, 37],
    [67, 48],
    [47, 56],
  ])
    disc(b, x, y, 3, 2, T.SWAMP_WATER);
}

function hind(b: Builder): void {
  b.map.tiles.fill(T.CLIFF);
  const clearings: Point[] = [
    [27, 68],
    [72, 60],
    [65, 24],
  ];
  line(b, b.entry, clearings[0], 4, T.AEGEAN_GRASS);
  line(b, clearings[0], clearings[1], 4, T.AEGEAN_GRASS);
  line(b, clearings[1], clearings[2], 4, T.AEGEAN_GRASS);
  clearings.forEach(([x, y], i) => {
    disc(b, x, y, 17, 13, T.AEGEAN_GRASS);
    objective(b, i, x - 8, y, "aegean_sanctuary_stone");
    for (let j = 0; j < 4; j++)
      art(b, x + 5 + j * 2, y - 6, "bush", { flat: true });
  });
  line(b, [4, 44], [104, 42], 2, T.WATER);
  line(b, [68, 48], [66, 38], 3, T.BRIDGE);
  arena(b, 65, 24, 14, 11);
}

function boar(b: Builder): void {
  b.map.tiles.fill(T.SNOW_ROCK);
  const route: Point[] = [
    b.entry,
    [30, 70],
    [86, 67],
    [84, 40],
    [29, 36],
    [30, 17],
    [76, 17],
  ];
  for (let i = 1; i < route.length; i++)
    line(b, route[i - 1], route[i], 5, T.SNOW);
  [
    [35, 68],
    [81, 42],
    [41, 18],
  ].forEach(([x, y], i) => {
    disc(b, x, y, 13, 10, T.SNOW);
    objective(b, i, x, y, "aegean_horn");
  });
  for (const y of [29, 56])
    for (let x = 38; x < 72; x += 5) art(b, x, y, "rock_big");
  arena(b, 75, 18, 18, 11);
}

function augeas(b: Builder): void {
  b.map.tiles.fill(T.MARBLE_WALL);
  room(b, 8, 10, 95, 77, T.TERRACOTTA);
  for (const y of [25, 50]) room(b, 8, y, 95, 5, T.WATER);
  for (const x of [29, 69]) room(b, x, 10, 4, 77, T.WATER);
  for (const x of [18, 49, 89]) line(b, [x, 15], [x, 83], 3, T.BRIDGE);
  for (const y of [18, 41, 71]) line(b, [12, y], [97, y], 3, T.MARBLE);
  [
    [24, 69],
    [50, 42],
    [84, 17],
  ].forEach(([x, y], i) => objective(b, i, x, y, "aegean_sluice"));
  columns(b, 34, 30, 24, 15);
  arena(b, 81, 68, 17, 13);
  node(b, "safe", 49, 71);
}

function birds(b: Builder): void {
  b.map.tiles.fill(T.SWAMP_WATER);
  const islands: Point[] = [
    [27, 68],
    [78, 62],
    [57, 23],
  ];
  line(b, b.entry, islands[0], 3, T.BRIDGE);
  line(b, islands[0], islands[1], 3, T.MARBLE);
  line(b, islands[1], islands[2], 3, T.MARBLE);
  line(b, islands[2], islands[0], 3, T.MARBLE);
  islands.forEach(([x, y], i) => {
    disc(b, x, y, 16, 12, T.MARBLE);
    objective(b, i, x, y, "aegean_resonator");
    art(b, x - 5, y - 4, "aegean_arch", { cw: 20, ch: 10 });
    art(b, x + 5, y + 4, "aegean_arch", { cw: 20, ch: 10 });
  });
  arena(b, 55, 45, 11, 9);
  line(b, [55, 45], [78, 62], 3);
}

function bull(b: Builder): void {
  b.map.tiles.fill(T.MARBLE_WALL);
  room(b, 8, 9, 96, 78, T.MARBLE);
  for (const x of [36, 70]) room(b, x, 12, 3, 68, T.MARBLE_WALL);
  for (const [x, y] of [
    [36, 65],
    [70, 31],
  ]) {
    room(b, x, y - 5, 3, 11);
    art(b, x + 1, y, "aegean_pillar_cracked");
  }
  line(b, b.entry, [91, 80], 4);
  [
    [25, 48],
    [53, 24],
    [90, 46],
  ].forEach(([x, y], i) => objective(b, i, x, y, "aegean_pylon"));
  columns(b, 13, 13, 80, 65);
  arena(b, 89, 62, 11, 14);
}

function mares(b: Builder): void {
  b.map.tiles.fill(T.MARBLE_WALL);
  room(b, 7, 7, 98, 81, T.TERRACOTTA);
  line(b, b.entry, [55, 81], 5);
  room(b, 50, 8, 12, 77);
  room(b, 8, 43, 95, 10);
  const pens: Point[] = [
    [29, 25],
    [82, 25],
    [29, 68],
    [82, 68],
  ];
  pens.forEach(([x, y], i) => {
    room(b, x - 16, y - 13, 33, 27, T.MARBLE_WALL);
    room(b, x - 14, y - 11, 29, 23, T.TERRACOTTA);
    line(b, [x, y], [55, y], 3);
    objective(b, i, x + (x < 55 ? 14 : -14), y, "aegean_pen_gate");
    node(b, "pen", x, y);
    art(b, x - 7, y + 5, "hay");
  });
  arena(b, 56, 48, 7, 6);
  node(b, "safe", 55, 78);
}

function hippolyta(b: Builder): void {
  b.map.tiles.fill(T.CLIFF);
  const terraces: Point[] = [
    [29, 68],
    [75, 45],
    [42, 20],
  ];
  line(b, b.entry, terraces[0], 5);
  line(b, terraces[0], terraces[1], 5);
  line(b, terraces[1], terraces[2], 5);
  terraces.forEach(([x, y], i) => {
    disc(b, x, y, 22, 14, T.MARBLE);
    objective(b, i, x, y, "aegean_standard");
    columns(b, x - 15, y - 10, 30, 20);
  });
  arena(b, 42, 20, 17, 10);
  node(b, "ally", 24, 70);
}

function geryon(b: Builder): void {
  b.map.tiles.fill(T.AEGEAN_SHALLOWS);
  const refuges: Point[] = [
    [25, 68],
    [79, 52],
    [60, 20],
  ];
  line(b, b.entry, refuges[0], 5, T.TERRACOTTA);
  line(b, refuges[0], refuges[1], 4, T.BASALT);
  line(b, refuges[1], refuges[2], 4, T.BASALT);
  refuges.forEach(([x, y], i) => {
    disc(b, x, y, 16, 12, T.TERRACOTTA);
    objective(b, i, x - 5, y, "aegean_bell");
    node(b, "herd", x, y + 4);
  });
  arena(b, 60, 20, 22, 13);
  line(b, [25, 68], [60, 20], 2, T.BASALT);
}

function hesperides(b: Builder): void {
  b.map.tiles.fill(T.PIT);
  const stars: Point[] = [
    [28, 69],
    [79, 47],
    [52, 19],
  ];
  line(b, b.entry, stars[0], 4, T.RUNE_FLOOR);
  for (let i = 0; i < 3; i++) {
    const [x, y] = stars[i];
    disc(b, x, y, 17, 13, T.AEGEAN_GRASS);
    objective(b, i, x, y, "aegean_star_anchor");
    art(b, x - 8, y - 5, "aegean_golden_tree");
    if (i) line(b, stars[i - 1], stars[i], 3, T.RUNE_FLOOR);
  }
  ring(b, 54, 43, 39, 30, 2, T.RUNE_FLOOR);
  arena(b, 52, 19, 12, 9);
}

function cerberus(b: Builder): void {
  b.map.tiles.fill(T.CRYPT_WALL);
  room(b, 10, 62, 34, 25, T.ASPHODEL);
  line(b, [32, 72], [57, 63], 6);
  room(b, 24, 12, 64, 53, T.MARBLE);
  columns(b, 27, 16, 56, 44);
  arena(b, 56, 38, 24, 19);
  [
    [36, 49],
    [75, 48],
    [56, 22],
  ].forEach(([x, y], i) => objective(b, i, x, y, "aegean_restraint"));
  art(b, 56, 12, "aegean_hades_gate");
  line(b, [56, 61], [94, 76], 4, T.ASPHODEL);
  node(b, "guardian_return", 94, 76);
}

function python(b: Builder): void {
  b.map.tiles.fill(T.CAVE_WALL);
  // A real spiral with a central chamber and three lateral vent balconies.
  const spiral: Point[] = [
    b.entry,
    [16, 18],
    [93, 18],
    [93, 74],
    [36, 74],
    [36, 36],
    [73, 36],
    [73, 54],
    [55, 54],
  ];
  for (let i = 1; i < spiral.length; i++)
    line(b, spiral[i - 1], spiral[i], 5, T.MARBLE);
  [
    [23, 26],
    [85, 64],
    [46, 45],
  ].forEach(([x, y], i) => objective(b, i, x, y, "aegean_vent"));
  line(b, [36, 45], [46, 45], 4);
  arena(b, 55, 53, 12, 11);
}

function medusa(b: Builder): void {
  b.map.tiles.fill(T.MARBLE_WALL);
  room(b, 9, 10, 94, 77, T.MARBLE);
  for (const [x, y] of [
    [34, 25],
    [66, 55],
    [30, 68],
    [79, 22],
  ])
    room(b, x, y, 7, 12, T.MARBLE_WALL);
  [
    [24, 48],
    [82, 68],
    [71, 20],
  ].forEach(([x, y], i) => objective(b, i, x, y, "aegean_mirror"));
  for (const [x, y] of [
    [42, 63],
    [61, 20],
    [87, 37],
    [21, 23],
  ])
    art(b, x, y, "aegean_petrified", { cw: 18, ch: 11 });
  arena(b, 55, 43, 12, 12);
}

function minotaur(b: Builder): void {
  b.map.tiles.fill(T.MARBLE_WALL);
  // Nested rectangular circuits with staggered passages; every gate has a bypass.
  for (let r = 0; r < 3; r++) {
    const x = 12 + r * 13,
      y = 12 + r * 10,
      w = 88 - r * 26,
      h = 71 - r * 20;
    line(b, [x, y], [x + w, y], 3);
    line(b, [x + w, y], [x + w, y + h], 3);
    line(b, [x + w, y + h], [x, y + h], 3);
    line(b, [x, y + h], [x, y], 3);
  }
  line(b, b.entry, [13, 79], 3);
  line(b, [30, 83], [30, 73], 3);
  line(b, [87, 34], [74, 34], 3);
  line(b, [45, 62], [45, 53], 3);
  [
    [30, 74],
    [78, 34],
    [45, 56],
  ].forEach(([x, y], i) => objective(b, i, x, y, "aegean_labyrinth_gate"));
  arena(b, 55, 47, 12, 8);
}

function chimera(b: Builder): void {
  b.map.tiles.fill(T.CLIFF);
  for (const y of [22, 46, 72])
    room(
      b,
      16,
      y - 7,
      83,
      15,
      y === 72 ? T.BASALT : y === 46 ? T.TERRACOTTA : T.MARBLE,
    );
  line(b, b.entry, [25, 72], 4);
  line(b, [88, 72], [88, 46], 4);
  line(b, [25, 46], [25, 22], 4);
  [
    [44, 72],
    [70, 46],
    [58, 22],
  ].forEach(([x, y], i) => objective(b, i, x, y, "aegean_vent"));
  arena(b, 73, 46, 17, 7);
  node(b, "high", 58, 22);
  node(b, "low", 44, 72);
}

function cyclops(b: Builder): void {
  b.map.tiles.fill(T.CLIFF);
  room(b, 10, 13, 93, 75, T.GRAVEL);
  for (const [x, y, w, h] of [
    [28, 26, 14, 23],
    [61, 55, 15, 20],
    [75, 15, 15, 15],
  ])
    room(b, x, y, w, h, T.CLIFF);
  [
    [24, 55],
    [53, 26],
    [86, 55],
  ].forEach(([x, y], i) => objective(b, i, x, y, "aegean_crane"));
  for (let x = 18; x < 93; x += 12) art(b, x, 80, "crate", { cw: 20, ch: 12 });
  arena(b, 54, 49, 12, 10);
}

function talos(b: Builder): void {
  b.map.tiles.fill(T.AEGEAN_SEA);
  disc(b, 57, 45, 42, 34, T.BASALT);
  disc(b, 57, 45, 23, 18, T.CLIFF);
  ring(b, 57, 45, 31, 25, 6, T.MARBLE);
  line(b, b.entry, [31, 65], 5, T.BASALT);
  [
    [36, 25],
    [81, 47],
    [43, 66],
  ].forEach(([x, y], i) => objective(b, i, x, y, "aegean_coast_station"));
  // Arena anchor lies on the patrol road, not in the unwalkable island core.
  node(b, "arena", 85, 45);
  node(b, "boss", 85, 45);
  node(b, "safe", 31, 66);
  for (let i = 0; i < 12; i++)
    node(
      b,
      "patrol",
      Math.round(57 + Math.cos((i * Math.PI) / 6) * 31),
      Math.round(45 + Math.sin((i * Math.PI) / 6) * 25),
    );
}

function scylla(b: Builder): void {
  b.map.tiles.fill(T.AEGEAN_SEA);
  // Deck/rock stations around an actual water vortex. The captain's trial
  // uses ordinary foot controls on the deck; open-world navigation owns sailing.
  const decks: Point[] = [
    [25, 69],
    [78, 52],
    [51, 19],
  ];
  line(b, b.entry, decks[0], 4, T.FLOOR_WOOD);
  decks.forEach(([x, y], i) => {
    room(b, x - 11, y - 7, 23, 15, T.FLOOR_WOOD);
    objective(b, i, x, y, "aegean_beacon");
    if (i) line(b, decks[i - 1], decks[i], 3, T.FLOOR_WOOD);
  });
  disc(b, 47, 48, 12, 13, T.STYGIAN);
  art(b, 47, 48, "aegean_whirlpool", { flat: true });
  node(b, "arena", 78, 52);
  node(b, "boss", 78, 52);
  node(b, "safe", 25, 68);
}

function titan(b: Builder): void {
  b.map.tiles.fill(T.PIT);
  const anchors: Point[] = [
    [28, 65],
    [83, 54],
    [54, 19],
  ];
  line(b, b.entry, anchors[0], 4, T.BRONZE_FLOOR);
  anchors.forEach(([x, y], i) => {
    disc(b, x, y, 17, 13, T.BASALT);
    objective(b, i, x, y, "aegean_chain_anchor");
    if (i) line(b, anchors[i - 1], anchors[i], 3, T.BRONZE_FLOOR);
  });
  line(b, [28, 65], [54, 19], 2, T.BRONZE_FLOOR);
  arena(b, 54, 19, 13, 10);
  for (const [x, y] of [
    [18, 22],
    [90, 14],
    [95, 78],
  ])
    art(b, x, y, "aegean_titan_chain");
}

function army(b: Builder): void {
  b.map.tiles.fill(T.CLIFF);
  const centers: Point[] = [
    [30, 101],
    [73, 93],
    [115, 61],
    [119, 24],
  ];
  line(b, b.entry, centers[0], 6);
  centers.forEach(([x, y], i) => {
    if (i) line(b, centers[i - 1], centers[i], 7);
    if (i === 2) disc(b, x, y, 26, 22, T.MARBLE);
    else room(b, x - 24, y - 17, 48, 34, i === 3 ? T.FLOOR_WOOD : T.MARBLE);
    objective(b, i, x - 17, y + 11, "aegean_standard");
    node(b, `chapter_${i}`, x, y);
    node(b, "arena", x, y);
    node(b, "safe", x - 17, y + 11);
    for (let k = 0; k < 6; k++) node(b, `reserve_${i}`, x - 15 + k * 6, y - 11);
    for (const dx of [-12, 12])
      art(b, x + dx, y, "aegean_shield_wall", { cw: 28, ch: 14 });
  });
  for (let x = 14; x <= 55; x += 10)
    art(b, x, 80, "aegean_column", { cw: 18, ch: 11 });
  room(b, 142, 8, 14, 42, T.AEGEAN_SEA);
  art(b, 146, 27, "aegean_ship_trireme");
  node(b, "harbour", 134, 24);
}

function leonidas(b: Builder): void {
  b.map.tiles.fill(T.MARBLE_WALL);
  room(b, 8, 99, 40, 23, T.MARBLE);
  line(b, b.entry, [63, 104], 5);
  line(b, [63, 104], [63, 80], 5);
  // The actual combat floor is 52 by 44 tiles, with a generous central route.
  room(b, 37, 34, 54, 48, T.MARBLE);
  room(b, 42, 39, 44, 37, T.BRONZE_FLOOR);
  columns(b, 38, 35, 48, 44);
  const braziers: Point[] = [
    [43, 59],
    [63, 40],
    [85, 59],
    [63, 75],
  ];
  const conductors: Point[] = [
    [39, 43],
    [85, 39],
    [89, 74],
    [40, 77],
  ];
  braziers.forEach(([x, y], i) => objective(b, i, x, y, "aegean_brazier"));
  conductors.forEach(([x, y], i) =>
    objective(b, i + 4, x, y, "aegean_conductor"),
  );
  for (const [x, y] of [
    [49, 48],
    [77, 48],
    [49, 66],
    [77, 66],
  ])
    art(b, x, y, "aegean_pillar_cracked", {
      cw: 24,
      ch: 17,
      data: { encounter: b.map.id, destructible: true },
    });
  art(b, 64, 32, "aegean_throne");
  node(b, "arena", 64, 57);
  node(b, "boss", 64, 49);
  node(b, "safe", 63, 77);
  for (const [x, y] of [
    [42, 38],
    [86, 38],
    [42, 76],
    [86, 76],
  ])
    node(b, "guard", x, y);
}

function sanctuary(b: Builder, kind: string): void {
  b.map.tiles.fill(kind === "names" ? T.STYGIAN : T.MARBLE_WALL);
  const centers: Point[] = [
    [27, 68],
    [78, 58],
    [55, 24],
  ];
  line(b, b.entry, centers[0], 4);
  centers.forEach(([x, y], i) => {
    if (i)
      line(
        b,
        centers[i - 1],
        centers[i],
        4,
        kind === "names" ? T.BRONZE_FLOOR : T.MARBLE,
      );
    disc(b, x, y, 18, 13, kind === "forge" ? T.BASALT : T.MARBLE);
    objective(
      b,
      i,
      x,
      y,
      kind === "aegis"
        ? "aegean_mirror"
        : kind === "forge"
          ? "aegean_anvil"
          : "aegean_shield_grave",
    );
    if (kind === "aegis") columns(b, x - 12, y - 9, 24, 18);
    if (kind === "forge") {
      disc(b, x + 7, y - 5, 3, 3, T.PIT);
      art(b, x + 7, y - 5, "aegean_fumarole");
    }
    if (kind === "names")
      for (let n = 0; n < 4; n++)
        art(b, x - 10 + n * 6, y - 9, "aegean_shield_grave");
  });
  arena(b, 55, 24, 13, 10);
}

function champion(b: Builder, kind: string): void {
  b.map.tiles.fill(
    kind === "hunt" ? T.CLIFF : kind === "storm" ? T.PIT : T.MARBLE_WALL,
  );
  line(b, b.entry, [53, 70], 4);
  arena(b, 55, 44, 36, 30);
  line(b, [53, 70], [55, 44], 5);
  const points: Point[] =
    kind === "hunt"
      ? [
          [29, 64],
          [83, 49],
          [45, 20],
        ]
      : [
          [32, 58],
          [79, 58],
          [55, 22],
        ];
  points.forEach(([x, y], i) =>
    objective(
      b,
      i,
      x,
      y,
      kind === "storm"
        ? "aegean_conductor"
        : kind === "volley"
          ? "aegean_shield_wall"
          : kind === "guard"
            ? "aegean_bell"
            : "aegean_standard",
    ),
  );
  if (kind === "spear")
    for (const r of [12, 23]) ring(b, 55, 44, r, r * 0.72, 1, T.BRONZE_FLOOR);
  if (kind === "shield")
    for (const x of [40, 67])
      art(b, x, 40, "aegean_shield_wall", { cw: 40, ch: 16 });
  if (kind === "hunt")
    for (const [x, y] of [
      [40, 40],
      [69, 29],
      [62, 59],
    ])
      disc(b, x, y, 5, 7, T.CLIFF);
  if (kind === "volley")
    for (const x of [34, 54, 74])
      art(b, x, 42, "aegean_arch", { cw: 30, ch: 12 });
  if (kind === "guard") node(b, "ward", 55, 44);
  if (kind === "storm")
    for (const [x, y] of [
      [35, 37],
      [71, 38],
      [55, 60],
    ])
      ring(b, x, y, 4, 4, 1, T.RUNE_FLOOR);
}

function underworld(b: Builder, slug: string): void {
  b.map.encounter = undefined; // Traversal/refuges do not start a combat director.
  // Use the original game's small foot-level bounds for substantial objects;
  // foliage, rubble and chains beyond the ledges remain surface decoration.
  const dressingBounds: Record<string, { cw: number; ch: number }> = {
    tree_dead: { cw: 20, ch: 12 },
    aegean_cypress: { cw: 20, ch: 12 },
    aegean_olive: { cw: 22, ch: 14 },
    aegean_golden_tree: { cw: 22, ch: 14 },
    aegean_column: { cw: 18, ch: 12 },
    aegean_pillar_cracked: { cw: 18, ch: 12 },
    pillar_broken: { cw: 18, ch: 10 },
    table: { cw: 40, ch: 14 },
    chair: { cw: 16, ch: 10 },
    bench: { cw: 38, ch: 12 },
    barrel: { cw: 18, ch: 12 },
    crate: { cw: 18, ch: 12 },
    boulder: { cw: 42, ch: 24 },
    rock_big: { cw: 26, ch: 16 },
    bookshelf: { cw: 36, ch: 12 },
    weapon_rack: { cw: 30, ch: 12 },
    well: { cw: 36, ch: 20 },
    aegean_sluice: { cw: 30, ch: 14 },
    aegean_statue: { cw: 22, ch: 12 },
    aegean_brazier: { cw: 18, ch: 10 },
    aegean_mooring: { cw: 14, ch: 10 },
    gravestone: { cw: 16, ch: 8 },
    planter: { cw: 22, ch: 12 },
    aegean_low_wall: { cw: 52, ch: 14 },
  };
  const dress = (name: string, points: Point[], options: Partial<PropInstance> = {}) =>
    points.forEach(([x, y]) => art(b, x, y, name, { ...dressingBounds[name], ...options }));
  const lamps = (points: Point[], color = "#8cb6bd", radius = 125) =>
    dress("aegean_brazier", points, { light: radius, lightColor: color });
  const paving = (x: number, y: number, w: number, h: number, tile: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++)
      if (!isSolid(getTile(b.map, xx, yy))) setTile(b.map, xx, yy, tile);
  };
  if (slug === "acheron") {
    b.map.tiles.fill(T.STYGIAN);
    room(b, 8, 58, 34, 31, T.ASPHODEL);
    room(b, 61, 10, 43, 38, T.ASPHODEL);
    line(b, [34, 71], [76, 30], 4, T.FLOOR_WOOD);
    art(b, 46, 56, "aegean_ferry");
    portal(b, 86, 24, "aegean_asphodel", "Follow the road to Asphodel");
    art(b, 23, 72, "aegean_scroll", {
      interact: "aegean",
      label: "Charon's expedition charter",
      data: { action: "charter" },
    });
    // A working quay on the near bank; abandoned fare offerings and a ruined
    // customs colonnade on the far one. The ferry remains the focal point.
    paving(12, 64, 27, 3, T.FLOOR_STONE);
    paving(29, 68, 10, 13, T.FLOOR_WOOD);
    paving(67, 31, 27, 3, T.FLOOR_STONE);
    dress("aegean_mooring", [[35, 69], [38, 75], [66, 40], [73, 35]]);
    dress("aegean_fishing_net", [[30, 78], [39, 63]]);
    dress("barrel", [[14, 69], [15, 71], [32, 80], [65, 43]]);
    dress("crate", [[16, 70], [17, 69], [36, 82], [68, 43]]);
    dress("aegean_amphora", [[18, 64], [19, 65], [31, 81], [75, 36], [96, 30]]);
    dress("aegean_basket", [[19, 70], [34, 81], [74, 36]]);
    dress("bench", [[13, 75], [28, 62], [80, 42]]);
    dress("aegean_column", [[68, 18], [77, 18], [94, 18], [100, 29]]);
    dress("pillar_broken", [[65, 25], [97, 39], [90, 42]]);
    dress("rubble", [[64, 27], [97, 40], [92, 42], [70, 16]]);
    dress("tree_dead", [[10, 62], [13, 85], [28, 86], [65, 13], [100, 44]]);
    dress("reeds", [[8, 73], [9, 77], [40, 83], [42, 69], [62, 44], [75, 47], [100, 17]]);
    dress("aegean_shore_bones", [[11, 80], [40, 60], [65, 17], [98, 45]]);
    dress("aegean_driftwood", [[7, 67], [43, 80], [61, 37], [104, 31]]);
    lamps([[20, 66], [36, 68], [44, 58], [56, 47], [69, 35], [80, 27], [92, 27]]);
  } else if (slug === "asphodel") {
    b.map.tiles.fill(T.CRYPT_WALL);
    room(b, 8, 9, 95, 78, T.ASPHODEL);
    for (let y = 11; y < 76; y++) {
      const x = 51 + Math.round(Math.sin(y * 0.11) * 9);
      room(b, x, y, 5, 1, T.STYGIAN);
    }
    for (const y of [27, 65]) line(b, [37, y], [70, y], 3, T.BRONZE_FLOOR);
    portal(b, 88, 20, "aegean_persephone", "Enter Persephone's Garden");
    for (const [x, y] of [
      [23, 25],
      [33, 51],
      [78, 44],
      [88, 68],
    ])
      art(b, x, y, "aegean_shield_grave", {
        interact: "aegean",
        label: "Remember a shade",
        data: { action: "memory", index: x },
      });
    // Four family plots, each with a different little trace of its former life.
    // Keep the shade's actual memorial at the open front of every plot.
    for (const [x, y] of [[23, 25], [33, 51], [78, 44], [88, 68]]) {
      paving(x - 4, y - 5, 9, 2, T.FLOOR_STONE);
      dress("gravestone", [[x - 3, y - 4], [x + 1, y - 4], [x + 4, y - 3]]);
      dress("aegean_thyme", [[x - 2, y - 2], [x + 3, y - 1], [x - 4, y + 2]]);
      dress("rock_small", [[x - 4, y - 3], [x + 5, y + 1]]);
      lamps([[x + 5, y - 3]], "#a3b9c0", 105);
    }
    dress("aegean_lyre", [[25, 22]]);
    dress("weapon_rack", [[30, 47]]);
    dress("aegean_amphora", [[76, 40], [78, 40], [91, 65]]);
    dress("aegean_basket", [[87, 65]]);
    dress("bench", [[18, 29], [27, 55], [83, 46], [95, 70]]);
    dress("tree_dead", [[14, 17], [35, 17], [14, 39], [41, 42], [18, 63], [35, 78], [73, 16], [98, 32], [70, 59], [78, 79], [99, 80]]);
    dress("aegean_cypress", [[18, 16], [38, 20], [20, 60], [72, 18], [96, 56], [74, 78]]);
    dress("shrub_dead", [[12, 20], [37, 19], [16, 41], [43, 44], [19, 65], [33, 80], [76, 18], [97, 35], [69, 62], [80, 80], [98, 82]]);
    dress("aegean_thyme", [[16, 23], [40, 34], [24, 43], [17, 73], [38, 71], [73, 29], [86, 34], [95, 45], [74, 69], [91, 80]]);
    dress("reeds", [[59, 17], [59, 21], [49, 39], [45, 48], [49, 54], [59, 72], [57, 75]]);
    dress("pillar_broken", [[40, 29], [66, 29], [39, 67], [70, 67]]);
    lamps([[40, 25], [66, 25], [40, 63], [67, 63], [82, 19], [96, 20]]);
  } else if (slug === "persephone") {
    b.map.tiles.fill(T.CRYPT_WALL);
    disc(b, 56, 46, 47, 38, T.AEGEAN_GRASS);
    line(b, b.entry, [56, 46], 4);
    line(b, [56, 46], [88, 20], 4);
    ring(b, 56, 46, 28, 23, 3, T.MARBLE);
    for (const [x, y] of [
      [35, 28],
      [78, 28],
      [38, 65],
      [75, 65],
    ])
      art(b, x, y, "aegean_golden_tree");
    art(b, 56, 46, "aegean_fountain", {
      interact: "aegean",
      label: "Rest in the garden",
      data: { action: "rest" },
    });
    art(b, 45, 46, "chest", {
      interact: "aegean",
      label: "Open storage",
      data: { action: "storage" },
    });
    portal(b, 88, 20, "aegean_hades", "Approach the House of Hades");
    // The living garden has four tended beds, a seed-work corner and an older
    // winter quarter. Small plants and benches leave the ring walk readable.
    for (const [x, y] of [[32, 39], [72, 39], [33, 56], [73, 56]]) {
      paving(x - 2, y - 2, 7, 5, T.TERRACOTTA);
      dress("aegean_vines", [[x - 1, y - 1], [x + 2, y - 1], [x - 1, y + 1], [x + 2, y + 1]]);
      dress("aegean_thyme", [[x - 2, y + 3], [x, y + 3], [x + 3, y + 3]]);
      dress("planter", [[x + 4, y - 1]]);
    }
    dress("bench", [[48, 37], [63, 37], [48, 55], [63, 55]]);
    dress("aegean_amphora", [[46, 53], [66, 53], [24, 46], [27, 46]]);
    dress("aegean_basket", [[25, 47], [31, 61]]);
    dress("table", [[25, 44]]);
    dress("chair", [[25, 46]]);
    dress("sack", [[27, 44]]);
    dress("aegean_olive", [[22, 40], [26, 59], [48, 20], [64, 20], [85, 46], [84, 58]]);
    dress("aegean_cypress", [[22, 33], [29, 22], [44, 15], [67, 15], [87, 32], [89, 51]]);
    dress("tree_dead", [[44, 73], [57, 77], [69, 74]]);
    dress("shrub_dead", [[46, 74], [60, 76], [71, 72]]);
    dress("aegean_thyme", [[33, 30], [37, 30], [76, 30], [80, 30], [36, 67], [40, 67], [73, 67], [77, 67], [47, 61], [64, 61]]);
    dress("aegean_low_wall", [[28, 34], [38, 34], [70, 34], [80, 34], [29, 64], [78, 64]]);
    lamps([[46, 43], [66, 43], [30, 47], [81, 48], [49, 68], [63, 68], [82, 22]], "#c9c88e", 140);
  } else if (slug === "hades") {
    b.map.tiles.fill(T.CRYPT_WALL);
    room(b, 8, 12, 95, 77, T.MARBLE);
    columns(b, 20, 20, 72, 53);
    room(b, 18, 37, 75, 5, T.BRONZE_FLOOR);
    art(b, 56, 18, "aegean_throne");
    portal(b, 30, 24, "aegean_cerberus", "Enter the lawful trial of Cerberus");
    portal(
      b,
      83,
      24,
      "aegean_tartarus",
      "Descend through the bronze gates",
      "cerberus",
    );
    // A royal court, not another empty arena: judgment tablets to the west,
    // sealed tribute to the east, and the king's central processional aisle.
    paving(50, 26, 13, 55, T.FLOOR_STONE);
    paving(55, 28, 3, 50, T.BRONZE_FLOOR);
    paving(43, 15, 27, 9, T.BRONZE_FLOOR);
    for (const y of [31, 46, 61, 77]) {
      dress("aegean_statue", [[45, y], [68, y]]);
      lamps([[48, y + 2], [65, y + 2]], "#aab8cc", 145);
    }
    dress("aegean_standard", [[45, 18], [67, 18], [24, 77], [88, 77]]);
    dress("table", [[26, 44], [34, 44], [26, 56], [34, 56]]);
    dress("chair", [[25, 46], [33, 46], [25, 58], [33, 58]]);
    dress("bookshelf", [[14, 33], [14, 47], [14, 62]]);
    dress("aegean_stele", [[19, 32], [27, 32], [35, 32], [18, 67], [28, 68], [37, 67]]);
    dress("aegean_scroll", [[28, 44], [36, 56], [20, 68]]);
    dress("aegean_amphora", [[77, 45], [79, 45], [83, 45], [85, 46], [76, 60], [78, 60], [82, 62], [84, 62], [93, 53]]);
    dress("aegean_basket", [[81, 47], [87, 61]]);
    dress("aegean_shield_grave", [[76, 70], [82, 70], [89, 70]]);
    dress("bench", [[30, 80], [39, 80], [74, 80], [83, 80]]);
    dress("aegean_cypress", [[12, 24], [99, 24], [13, 80], [97, 80]]);
    dress("rubble", [[95, 37], [96, 39], [12, 71]]);
    lamps([[25, 23], [35, 23], [78, 23], [89, 23], [17, 51], [92, 56]], "#be9bbf", 145);
  } else {
    b.map.tiles.fill(T.PIT);
    const p: Point[] = [b.entry, [28, 70], [78, 61], [52, 27], [89, 16]];
    for (let i = 1; i < p.length; i++) {
      line(b, p[i - 1], p[i], 4, T.BRONZE_FLOOR);
      disc(b, p[i][0], p[i][1], 13, 10, T.BASALT);
    }
    portal(b, 89, 16, "aegean_titan", "Contain the Broken Titan Chain");
    [
      [28, 70],
      [78, 61],
      [52, 27],
    ].forEach(([x, y], index) =>
      art(b, x - 4, y, "aegean_chain_anchor", {
        interact: "aegean",
        label: [
          "Sisyphus's Ascent",
          "The Empty Banquet",
          "The Danaids' Cistern",
        ][index],
        data: { action: "tartarus_trial", index },
      }),
    );
    // Each punishment can be recognized before its chain is touched. Floor
    // inlays only recolour existing ground; no new path crosses the abyss.
    paving(29, 63, 3, 13, T.FLOOR_STONE);
    dress("boulder", [[30, 62], [34, 65], [20, 74]]);
    dress("rock_big", [[32, 63], [36, 67], [21, 76], [35, 75]]);
    dress("rock_small", [[28, 66], [31, 68], [29, 72], [30, 75], [33, 77], [20, 71]]);
    dress("rubble", [[29, 65], [30, 69], [32, 73], [34, 76]]);
    dress("aegean_restraint", [[21, 65], [35, 72]]);
    dress("aegean_chain_anchor", [[20, 67], [37, 69]]);
    lamps([[23, 76], [34, 60], [38, 72]], "#d09d6d", 130);

    paving(73, 55, 13, 11, T.FLOOR_STONE);
    paving(77, 56, 3, 9, T.BRONZE_FLOOR);
    dress("table", [[78, 56], [78, 59], [78, 62], [78, 65]]);
    dress("chair", [[75, 56], [82, 56], [75, 59], [82, 59], [75, 62], [82, 62], [75, 65], [82, 65]]);
    dress("aegean_amphora", [[83, 54], [85, 55], [83, 67]]);
    dress("aegean_basket", [[85, 66]]);
    dress("aegean_golden_tree", [[86, 59]]);
    dress("bone_pile", [[69, 60], [72, 68], [87, 65]]);
    dress("aegean_column", [[70, 54], [87, 54], [88, 67]]);
    lamps([[72, 53], [86, 69]], "#c58b88", 150);

    paving(48, 23, 11, 8, T.FLOOR_STONE);
    dress("well", [[55, 24]]);
    dress("aegean_sluice", [[59, 29]]);
    dress("aegean_amphora", [[50, 21], [52, 22], [58, 23], [60, 26], [55, 31], [51, 32], [47, 31], [44, 26]]);
    dress("aegean_basket", [[53, 33]]);
    dress("rock_small", [[50, 25], [51, 26], [52, 27], [54, 28], [56, 29]]);
    dress("pillar_broken", [[44, 21], [62, 27], [58, 35]]);
    dress("aegean_restraint", [[45, 30], [60, 21]]);
    lamps([[46, 23], [59, 33]], "#87afbf", 145);

    // Chain piers and vents give the connecting spans their own silhouette;
    // they sit beside, rather than over, the path and its trial controls.
    dress("aegean_titan_chain", [[39, 65], [60, 59], [68, 47], [49, 42], [70, 19], [91, 9]]);
    dress("stalagmite", [[15, 75], [39, 75], [68, 66], [89, 56], [40, 28], [63, 22], [80, 12], [98, 20]]);
    dress("aegean_fumarole", [[20, 79], [42, 62], [70, 72], [84, 45], [40, 37], [66, 30], [97, 13]], { light: 100, lightColor: "#b36b55" });
    dress("aegean_pillar_cracked", [[15, 82], [47, 68], [64, 45], [69, 18], [94, 22]]);
    dress("aegean_shore_bones", [[18, 80], [40, 63], [66, 52], [50, 40], [73, 17], [95, 24]]);
    lamps([[17, 81], [49, 64], [72, 45], [58, 40], [72, 17], [84, 15], [94, 17]], "#a1a3c3", 145);
  }
  node(b, "safe", 24, 76);
}

/** Bespoke terrain, topology, tools and anchors. Runtime rules live in the director. */
export function generateAegeanDungeon(loc: LocationDef, seed: number): GameMap {
  const id = loc.dungeon!.mapId,
    slug = id.replace(/^aegean_/, "");
  const w = slug === "army" ? 160 : slug === "leonidas" ? 128 : 112;
  const h = slug === "army" || slug === "leonidas" ? 128 : 96;
  const outdoor = [
    "nemea",
    "hind",
    "boar",
    "birds",
    "geryon",
    "talos",
    "scylla",
    "army",
    "hippolyta",
    "bull",
    "chimera",
    "cyclops",
  ].includes(slug);
  const map = createMap({
    id,
    name: loc.name,
    w,
    h,
    kind: "dungeon",
    outdoor,
    darkness: outdoor ? 0.12 : 0.47,
    music: slug === "army" || slug === "leonidas" ? "boss" : "dungeon",
    encounter: id,
    encounterNodes: {},
    parent: loc.id,
    revision: `${seed}:${id}:1`,
  });
  const b: Builder = {
    map,
    a: AEGEAN_ADVENTURE_BY_ID[id],
    entry: [12, h - 12],
    floor: T.MARBLE,
    rng: new RNG(`${seed}:${id}:layout`),
  };
  const layouts: Record<string, (b: Builder) => void> = {
    nemea: lion,
    hydra,
    hind,
    boar,
    augeas,
    birds,
    bull,
    mares,
    hippolyta,
    geryon,
    hesperides,
    cerberus,
    python,
    medusa,
    minotaur,
    chimera,
    cyclops,
    talos,
    scylla,
    titan,
    army,
    leonidas,
  };
  if (layouts[slug]) layouts[slug](b);
  else if (slug.startsWith("sanctuary_")) sanctuary(b, slug.slice(10));
  else if (slug.startsWith("champion_")) champion(b, slug.slice(9));
  else if (AEGEAN_UNDERWORLD_IDS.includes(id)) underworld(b, slug);
  else throw new Error(`Missing authored Aegean layout: ${id}`);

  const [ex, ey] = b.entry;
  disc(b, ex, ey, 5);
  node(b, "entry", ex, ey - 3);
  node(b, "safe", ex, ey - 3);
  art(b, ex, ey, "stairs_up", { flat: true });
  const parent = loc.surfaceMap ?? "overworld";
  map.portals.unshift({
    x: ex * TILE - 16,
    y: ey * TILE - 16,
    w: 32,
    h: 32,
    to: parent,
    tx: loc.tx * TILE + TILE / 2,
    ty: (loc.ty + 4) * TILE,
    label: `Leave ${loc.name}`,
    kind: "stairs",
  });
  art(b, ex + 5, ey - 1, "aegean_sanctuary_stone", {
    interact: "aegean",
    label: "Rally, recover, or retry",
    light: 110,
    lightColor: "#85c5d2",
    data: { action: "checkpoint", encounter: id },
  });
  disc(b, ex + 5, ey - 1, 2);
  if (slug === "leonidas") {
    // The island's earned equipment is made at a real anvil, before the arena.
    // Keep the workbench separate from the sparring stones and entry route.
    room(b, 24, 102, 13, 7, T.BASALT);
    art(b, 28, 104, "aegean_anvil", {
      cw: 26, ch: 12, interact: "aegean", label: "Use the Oathsteel Anvil",
      data: { action: "forge" },
    });
    art(b, 25, 103, "aegean_brazier", { light: 170, lightColor: "#eda15e", cw: 18, ch: 10 });
    art(b, 34, 103, "weapon_rack", { cw: 30, ch: 12 });
    art(b, 34, 107, "chest", { cw: 24, ch: 14, interact: "storage", label: "Open your storage chest" });
    // Sparring is a place in the temple, rather than a submenu in Pause.
    const echoes = ["The spear", "The shield", "The loyal guard", "The storm", "The burning oath", "The final stand"];
    for (let phase = 0; phase < echoes.length; phase++) {
      const x = ex + 8 + phase * 4, y = ey + 3;
      disc(b, x, y, 3);
      line(b, [ex, ey], [x, y], 2);
      art(b, x, y, "aegean_statue", {
        interact: "aegean", label: `${echoes[phase]} — sparring stone`,
        data: { action: "practice", phase },
      });
    }
    art(b, ex - 3, ey, "aegean_sanctuary_stone", {
      interact: "aegean", label: "Withdraw to the antechamber",
      data: { action: "withdraw" },
    });
  }

  // Terrain anchors are a contract: no director spawn is knowingly inside rock.
  for (const key of ["enemy", "safe", "entry", "arena", "boss"])
    for (const p of map.encounterNodes![key] ?? []) {
      const x = Math.floor(p.x / TILE),
        y = Math.floor(p.y / TILE);
      if (isSolid(getTile(map, x, y))) disc(b, x, y, 2);
    }
  buildPropGrid(map);
  return map;
}
