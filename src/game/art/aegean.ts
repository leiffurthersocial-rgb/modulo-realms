import { Px, strip } from "./pixel";
import type { PropArt } from "./props";
import { RNG } from "../core/rng";
import { mix } from "./palette";

const C = {
  ink: "#222632",
  shadow: "rgba(14,19,27,.3)",
  marble: "#ded3ae",
  light: "#f2e8c7",
  stone: "#969982",
  bronze: "#b7944c",
  gold: "#e3c36e",
  dark: "#665b43",
  red: "#994638",
  clay: "#bb7050",
  roof: "#854b40",
  leaf: "#788557",
  leafLight: "#a9b278",
  trunk: "#706343",
  sea: "#5496a2",
  blue: "#456b8b",
};

/** Deliberate art identities. A mistyped content key must not silently draw the
 * same anonymous lightning pylon as every other unsupported Greek object. */
export const AEGEAN_PROP_NAMES = [
  "talos_footprint",
  "bronze_feathers",
  "lyre",
  "cyclops_table",
  "sea_stack",
  "great_temple",
  "fishing_net",
  "clothesline",
  "basket",
  "low_wall",
  "driftwood",
  "shells",
  "limestone",
  "shore_bones",
  "thyme",
  "wheat",
  "vines",
  "cart",
  "portico",
  "watermill",
  "warehouse",
  "ship_skiff",
  "ship_roundship",
  "ship_trireme",
  "ship_stormbreaker",
  "ferry",
  "house",
  "spartan_house",
  "courtyard_house",
  "temple",
  "cypress",
  "red_cypress",
  "olive",
  "golden_tree",
  "oath_gate",
  "hades_gate",
  "arch",
  "column",
  "pillar_cracked",
  "amphora",
  "brazier",
  "beacon",
  "fumarole",
  "mirror",
  "standard",
  "shield_wall",
  "shield_grave",
  "statue",
  "petrified",
  "scroll",
  "stele",
  "anvil",
  "fountain",
  "crane",
  "sluice",
  "pen_gate",
  "labyrinth_gate",
  "bell",
  "resonator",
  "horn",
  "throne",
  "whirlpool",
  "mooring",
  "titan_chain",
  "chain_anchor",
  "pylon",
  "sanctuary_stone",
  "coast_station",
  "star_anchor",
  "restraint",
  "vent",
  "conductor",
].map((name) => `aegean_${name}`);
const registered = new Set(AEGEAN_PROP_NAMES);

function base(w: number, h: number): Px {
  const p = new Px(w, h);
  p.ellipse(w / 2, h - 4, w * 0.34, 4, C.shadow);
  return p;
}
function column(p: Px, x: number, y: number, h: number, w = 12): void {
  p.fill(x - w / 2 - 3, y - 4, w + 6, 5, C.stone).fill(
    x - w / 2,
    y - h,
    w,
    h - 4,
    C.marble,
  );
  for (let dx = -w / 2 + 2; dx < w / 2; dx += 3)
    p.line(x + dx, y - h + 3, x + dx, y - 6, C.stone);
  p.fill(x - w / 2 - 3, y - h - 3, w + 6, 4, C.light).fill(
    x - w / 2 - 2,
    y - h - 7,
    w + 4,
    4,
    C.marble,
  );
  p.fill(x + w / 2 - 2, y - h + 1, 2, h - 6, "#a8a38b");
  p.fill(x - w / 2 + 1, y - h + 2, 1, h - 9, "#ece3c7");
  p.fill(x - w / 2 - 3, y - 2, w + 6, 1, "#b0aa93");
  if (h > 40)
    p.line(
      x - 1,
      y - h + Math.floor(h * 0.55),
      x + 3,
      y - h + Math.floor(h * 0.55) + 2,
      "#b3ad94",
    );
}
function flame(p: Px, x: number, y: number, frame: number): void {
  p.poly(
    [
      [x - 7, y],
      [x - 4, y - 9],
      [x - 1, y - 5],
      [x + 2, y - 19 + frame * 2],
      [x + 5, y - 9],
      [x + 8, y],
    ],
    "#cd663d",
  );
  p.poly(
    [
      [x - 3, y],
      [x, y - 11 + frame],
      [x + 4, y],
    ],
    "#efcb73",
  );
}
function roof(p: Px, x: number, y: number, w: number): void {
  p.poly(
    [
      [x, y],
      [x + w / 2, y - 22],
      [x + w, y],
    ],
    C.roof,
  );
  p.poly(
    [
      [x + 4, y - 2],
      [x + w / 2, y - 19],
      [x + w - 4, y - 2],
    ],
    C.clay,
  );
  for (let dx = 8; dx < w - 6; dx += 8)
    p.line(x + dx, y - 1, x + w / 2, y - 20, C.roof);
  for (let dy = 4; dy < 18; dy += 5) {
    const inset = (dy * w) / 44;
    p.line(x + inset, y - dy, x + w - inset, y - dy, "#9c5b43");
    p.line(x + inset + 1, y - dy - 1, x + w - inset - 1, y - dy - 1, "#ca825a");
  }
  p.fill(x - 2, y, w + 4, 5, C.marble).fill(x, y + 5, w, 3, C.blue);
}
function wheel(p: Px, x: number, y: number, r: number): void {
  p.circle(x, y, r, C.dark)
    .circle(x, y, r - 2, C.bronze)
    .circle(x, y, r - 4, C.dark);
  for (let i = 0; i < 6; i++)
    p.line(
      x,
      y,
      x + Math.cos((i * Math.PI) / 3) * (r - 2),
      y + Math.sin((i * Math.PI) / 3) * (r - 2),
      C.gold,
    );
}

/** Original procedural props share painted marble, bronze and terracotta motifs. */
function draw(name: string, frame = 0): Px {
  if (name === "aegean_amphora") {
    const p = base(32, 42),
      rng = new RNG("amphora-glaze");
    p.ellipse(7, 18, 5, 8, "#5c4936").ellipse(25, 18, 5, 8, "#5c4936");
    p.ellipse(7, 17, 3, 6, "#b58356").ellipse(25, 17, 3, 6, "#926444");
    p.poly(
      [
        [10, 11],
        [11, 5],
        [21, 5],
        [22, 12],
        [26, 20],
        [24, 32],
        [19, 38],
        [13, 38],
        [8, 31],
        [6, 20],
      ],
      "#5b4334",
    );
    p.poly(
      [
        [11, 11],
        [12, 7],
        [20, 7],
        [21, 13],
        [24, 21],
        [22, 31],
        [18, 36],
        [13, 34],
        [9, 28],
        [8, 20],
      ],
      "#a36543",
    );
    p.ellipse(13, 22, 4, 11, "#c1865b").fill(12, 8, 2, 7, "#ce9565");
    p.fill(10, 3, 12, 4, "#634a36").fill(11, 3, 10, 1, "#c38e61");
    p.fill(8, 20, 17, 3, "#5d4837").fill(8, 23, 17, 1, "#c8a473");
    for (let n = 0; n < 13; n++)
      p.set(
        rng.int(11, 20),
        rng.int(26, 32),
        rng.bool() ? "#c18b5f" : "#835437",
      );
    p.fill(13, 36, 6, 2, "#6c4d37");
    return p;
  }
  if (name === "aegean_anvil") {
    const p = base(42, 37);
    p.fill(12, 25, 21, 8, "#554837")
      .fill(14, 26, 3, 6, "#8d7350")
      .fill(29, 26, 3, 6, "#362f28");
    p.fill(16, 18, 14, 8, "#444841").fill(18, 17, 9, 6, "#74786a");
    p.poly(
      [
        [5, 9],
        [33, 9],
        [39, 13],
        [32, 17],
        [10, 17],
        [6, 14],
      ],
      "#424741",
    );
    p.fill(7, 9, 25, 3, "#a7ac98").fill(8, 12, 24, 3, "#72796d");
    p.line(10, 10, 27, 10, "#d0c7a5").fill(10, 15, 20, 2, "#53594f");
    p.fill(30, 2, 3, 9, C.trunk)
      .fill(27, 1, 10, 4, "#927a4f")
      .fill(27, 1, 10, 1, "#c3a672");
    p.set(12, 12, "#c1b798").set(26, 13, "#454c44");
    return p;
  }
  if (name === "aegean_thyme") {
    const p = base(26, 20),
      rng = new RNG("wild-thyme");
    for (let n = 0; n < 17; n++) {
      const x = rng.int(3, 23),
        y = rng.int(7, 17);
      p.line(x, y, x + rng.int(-2, 2), y - rng.int(3, 7), "#44573a");
      p.fill(x - 2, y - 3, 3, 2, rng.bool() ? "#61764b" : "#82905c");
      if (n % 3 === 0) p.set(x, y - 5, "#a99cad");
    }
    return p;
  }
  if (name === "aegean_coast_station") {
    const p = base(82, 74);
    p.fill(10, 60, 61, 8, C.stone).fill(13, 53, 55, 8, C.marble);
    p.fill(21, 38, 6, 20, C.trunk).fill(56, 38, 6, 20, C.trunk);
    p.poly(
      [
        [12, 25],
        [63, 18],
        [71, 37],
        [17, 44],
      ],
      "#b5a582",
    );
    p.poly(
      [
        [18, 28],
        [60, 22],
        [64, 35],
        [21, 39],
      ],
      "#567f84",
    );
    p.line(24, 32, 48, 25, C.light).line(48, 25, 59, 33, C.light);
    p.circle(43, 31, 4, C.bronze).fill(5, 14, 4, 43, C.trunk);
    p.poly(
      [
        [8, 14],
        [26, 19],
        [8, 24],
      ],
      C.red,
    );
    return p;
  }
  if (name === "aegean_sanctuary_stone") {
    const p = base(66, 74),
      rng = new RNG("sanctuary-stone");
    p.ellipse(33, 61, 27, 9, "#697467");
    p.poly(
      [
        [12, 58],
        [17, 20],
        [30, 9],
        [48, 17],
        [54, 58],
      ],
      "#b7b497",
    );
    p.poly(
      [
        [16, 53],
        [21, 22],
        [30, 14],
        [35, 48],
      ],
      "#d3ccb0",
    );
    p.circle(35, 34, 11, "#858a73").circle(35, 34, 8, "#b3ac8b");
    p.line(29, 34, 34, 39, "#65755e").line(34, 39, 42, 28, "#65755e");
    for (let n = 0; n < 13; n++)
      p.fill(rng.int(13, 51), rng.int(55, 62), 2, 2, "#688051");
    return p;
  }
  if (name === "aegean_pylon") {
    const p = base(62, 86);
    p.fill(9, 70, 44, 10, C.stone)
      .fill(17, 29, 28, 41, C.clay)
      .fill(20, 32, 22, 33, "#a85f43");
    p.fill(12, 23, 38, 8, C.marble).fill(12, 25, 38, 2, C.blue);
    p.poly(
      [
        [20, 23],
        [16, 5],
        [22, 9],
        [26, 20],
        [36, 20],
        [40, 9],
        [46, 5],
        [42, 23],
      ],
      C.bronze,
    );
    p.line(24, 39, 24, 61, C.gold).line(39, 39, 39, 61, C.gold);
    return p;
  }
  if (name === "aegean_talos_footprint") {
    const p = base(78, 43);
    p.ellipse(34, 29, 24, 10, "#615741").ellipse(33, 27, 21, 8, "#494638");
    for (let n = 0; n < 5; n++)
      p.ellipse(50 + n * 4, 18 + n * 3, 4, 3, "#827047");
    p.line(17, 29, 42, 33, "#977e4d").line(19, 31, 27, 34, "#bb9451");
    return p;
  }
  if (name === "aegean_bronze_feathers" || name === "aegean_lyre") {
    const p = base(44, 49);
    if (name.endsWith("feathers")) {
      for (const [x, y] of [
        [8, 39],
        [20, 42],
        [30, 29],
      ]) {
        p.line(x, y, x + 9, y - 23, C.bronze);
        for (let j = 2; j < 20; j += 4)
          p.line(
            x + j * 0.4,
            y - j,
            x + j * 0.4 + 6,
            y - j - 3,
            j % 3 ? C.gold : C.dark,
          );
      }
    } else {
      p.fill(10, 35, 26, 8, C.bronze)
        .fill(9, 8, 5, 30, C.dark)
        .fill(32, 8, 5, 30, C.dark)
        .fill(8, 9, 31, 4, C.bronze);
      for (let x = 15; x < 32; x += 4) p.line(x, 13, x, 36, C.light);
      p.ellipse(11, 7, 5, 5, C.gold).ellipse(34, 7, 5, 5, C.gold);
    }
    return p;
  }
  if (name === "aegean_cyclops_table" || name === "aegean_sea_stack") {
    const table = name.endsWith("table"),
      p = base(table ? 154 : 88, table ? 88 : 160),
      rng = new RNG(name);
    if (table) {
      p.fill(22, 49, 23, 32, "#777b6e").fill(112, 49, 22, 32, "#60675f");
      p.poly(
        [
          [5, 42],
          [27, 24],
          [139, 25],
          [152, 45],
          [140, 57],
          [15, 57],
        ],
        "#b0ab92",
      );
      p.line(15, 45, 140, 45, "#d0c6a8");
      p.ellipse(94, 36, 17, 6, "#776d54").ellipse(95, 34, 12, 4, "#a59a71");
    } else {
      p.poly(
        [
          [11, 147],
          [17, 68],
          [34, 5],
          [49, 15],
          [68, 77],
          [79, 148],
        ],
        "#6d756c",
      );
      p.poly(
        [
          [18, 139],
          [24, 72],
          [35, 15],
          [43, 77],
          [50, 145],
        ],
        "#a6a28b",
      );
      p.line(42, 38, 48, 110, "#464f4c").line(61, 92, 57, 144, "#464f4c");
      for (let n = 0; n < 20; n++)
        p.fill(rng.int(28, 55), rng.int(85, 136), rng.int(2, 8), 1, "#b3ad91");
    }
    return p;
  }
  if (name === "aegean_great_temple") {
    const p = base(372, 266),
      rng = new RNG("last-oath-temple");
    for (let step = 0; step < 6; step++) {
      const inset = step * 5,
        y = 254 - step * 7;
      p.fill(
        6 + inset,
        y,
        360 - inset * 2,
        7,
        step % 2 ? "#797c77" : "#a5a28a",
      );
      p.fill(6 + inset, y, 360 - inset * 2, 1, "#d4cdb0");
    }
    p.fill(40, 69, 292, 151, "#9b9880").fill(47, 74, 278, 137, "#c9bea0");
    for (let y = 80; y < 205; y += 13)
      for (let x = 50 + (y % 2) * 11; x < 320; x += 24) {
        p.fill(x, y, 20, 11, rng.pick(["#c2b79c", "#cfc3a5", "#bdb297"]));
        p.fill(x, y, 20, 1, "#d8ccb0");
        if (rng.bool(0.25)) p.line(x + 9, y + 4, x + 14, y + 8, "#a59b84");
      }
    p.fill(146, 114, 80, 104, "#373b39").fill(155, 120, 62, 99, "#514b39");
    for (let x = 159; x < 216; x += 9) p.fill(x, 123, 3, 89, C.bronze);
    p.fill(148, 114, 76, 7, "#958151");
    roof(p, 22, 66, 328);
    p.fill(34, 71, 305, 13, "#5c7374");
    for (let x = 44; x < 331; x += 17) p.fill(x, 73, 5, 8, "#b1a47e");
    for (const x of [57, 92, 126, 245, 280, 315]) column(p, x, 218, 126, 18);
    for (const x of [78, 295]) {
      p.fill(x - 6, 88, 12, 83, C.red);
      p.fill(x - 6, 162, 12, 5, C.bronze);
    }
    p.circle(186, 50, 11, "#735d39").circle(186, 50, 8, C.bronze);
    p.line(177, 58, 186, 42, C.light).line(186, 42, 195, 58, C.light);
    for (const x of [34, 338]) {
      p.fill(x - 8, 213, 16, 14, "#716a56");
      flame(p, x, 209, 0);
    }
    return p;
  }
  if (name === "aegean_fishing_net" || name === "aegean_clothesline") {
    const p = base(92, 62);
    p.fill(8, 7, 4, 51, C.trunk).fill(78, 7, 4, 51, C.trunk);
    p.line(10, 11, 44, 17, "#c2b087").line(44, 17, 80, 11, "#c2b087");
    if (name.endsWith("net")) {
      for (let n = 0; n < 10; n++) {
        const x = 13 + n * 6;
        p.line(x, 14 + (n < 5 ? n : 9 - n), x + 6, 46, "#a9966f");
        p.line(x, 15 + (n < 5 ? n : 9 - n), x - 6, 43, "#8d805f");
      }
      for (let y = 22; y < 46; y += 6) p.line(13, y, 76, y + 3, "#ab9976");
      p.ellipse(53, 52, 16, 4, "#61573d");
    } else {
      for (const [x, color] of [
        [18, "#cfc1a3"],
        [38, "#995e51"],
        [58, "#739198"],
      ] as Array<[number, string]>) {
        p.fill(x, 17, 15, 25, color).fill(
          x + 2,
          18,
          2,
          24,
          mix(color, "#333132", 0.25),
        );
        p.fill(x + 1, 16, 2, 4, C.dark).fill(x + 12, 16, 2, 4, C.dark);
      }
    }
    return p;
  }
  if (name === "aegean_basket") {
    const p = base(34, 32);
    p.ellipse(17, 22, 12, 8, "#977c4f")
      .ellipse(17, 16, 12, 5, "#baa575")
      .ellipse(17, 16, 9, 3, "#635339");
    for (let y = 19; y < 29; y += 3) p.line(7, y, 27, y, "#675639");
    for (let x = 9; x < 27; x += 4) p.line(x, 18, x, 28, "#baa16d");
    for (let n = 0; n < 5; n++)
      p.circle(11 + n * 3, 15 + (n % 2), 3, n % 2 ? "#9a7049" : "#657747");
    return p;
  }
  if (name === "aegean_low_wall") {
    const p = base(80, 31),
      rng = new RNG("low-marble-wall");
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 5; col++) {
        const x = 4 + col * 14 + (row % 2 ? 4 : 0),
          y = 7 + row * 7;
        p.fill(x, y, 13, 7, rng.pick(["#aca58a", "#bfb69a", "#a19e87"])).fill(
          x,
          y,
          13,
          1,
          "#d6ceb2",
        );
        p.fill(x + 1, y + 6, 12, 1, "#787c6b");
      }
    p.fill(2, 5, 76, 3, "#cec4a6");
    return p;
  }
  if (
    [
      "aegean_driftwood",
      "aegean_shells",
      "aegean_limestone",
      "aegean_shore_bones",
    ].includes(name)
  ) {
    const p = base(54, 32),
      rng = new RNG(name);
    if (name.endsWith("driftwood")) {
      p.poly(
        [
          [3, 21],
          [44, 12],
          [49, 17],
          [8, 28],
        ],
        "#776d57",
      );
      p.line(6, 22, 44, 15, "#b7aa89")
        .line(10, 24, 43, 17, "#514e42")
        .line(29, 17, 37, 5, "#8e8066");
    } else if (name.endsWith("limestone")) {
      for (let n = 0; n < 5; n++) {
        const x = 9 + n * 8,
          y = 20 + rng.int(-4, 4);
        p.ellipse(x, y, rng.int(4, 8), rng.int(3, 5), "#8b9183").fill(
          x - 2,
          y - 3,
          4,
          2,
          "#d6ceb1",
        );
      }
    } else if (name.endsWith("bones")) {
      p.line(6, 23, 45, 14, "#b5ad94");
      for (let x = 12; x < 42; x += 6) p.line(x, 21, x - 2, 12, "#ccc2a9");
      p.ellipse(44, 14, 6, 4, "#b5ad94").set(45, 13, "#57594f");
    } else
      for (let n = 0; n < 9; n++) {
        const x = rng.int(6, 47),
          y = rng.int(11, 26);
        p.ellipse(x, y, 2, 1, n % 2 ? "#d3c5a4" : "#a7ad9e").set(
          x,
          y - 1,
          "#e4d9bd",
        );
      }
    return p;
  }
  if (
    name === "aegean_thyme" ||
    name === "aegean_wheat" ||
    name === "aegean_vines"
  ) {
    const p = base(44, 34);
    if (name === "aegean_wheat") {
      for (let n = 0; n < 11; n++) {
        const x = 5 + ((n * 17) % 34),
          y = 22 + ((n * 7) % 9);
        p.line(x, y, x - 1, y - 15, "#8e7d45");
        p.line(x - 1, y - 13, x - 5, y - 17, "#c7b46b");
        p.line(x - 1, y - 10, x + 3, y - 15, "#e0cc85");
        p.fill(x - 2, y - 19, 2, 6, "#d7bf72");
      }
    } else {
      if (name === "aegean_vines")
        p.fill(7, 5, 2, 25, C.trunk)
          .fill(34, 5, 2, 25, C.trunk)
          .fill(5, 8, 32, 2, C.trunk);
      for (let n = 0; n < 14; n++) {
        const x = 5 + ((n * 13) % 34),
          y = 12 + ((n * 7) % 16);
        p.ellipse(x, y, 5, 3, n % 2 ? "#68744c" : "#84915a");
        if (n % 3 === 0)
          p.fill(
            x - 1,
            y - 2,
            2,
            2,
            name === "aegean_thyme" ? "#b7a4bf" : "#75618b",
          );
      }
    }
    return p;
  }
  if (name === "aegean_cart") {
    const p = base(68, 48);
    p.fill(10, 14, 43, 21, "#7b6446").fill(13, 17, 36, 12, "#ab9164");
    for (let y = 16; y < 34; y += 6) p.line(10, y, 53, y, "#5d4d39");
    p.line(49, 29, 66, 34, C.trunk);
    wheel(p, 19, 36, 8);
    wheel(p, 45, 36, 8);
    p.fill(18, 8, 12, 12, C.clay).fill(34, 5, 11, 15, C.marble);
    return p;
  }
  if (
    name === "aegean_portico" ||
    name === "aegean_watermill" ||
    name === "aegean_warehouse"
  ) {
    const mill = name.endsWith("watermill"),
      warehouse = name.endsWith("warehouse");
    const p = base(148, 111);
    p.fill(12, 40, 117, 59, "#8a8b77").fill(15, 42, 111, 55, "#c9bea1");
    roof(p, 8, 38, 124);
    for (let y = 47; y < 94; y += 9)
      for (let x = 18 + (y % 2) * 6; x < 123; x += 18)
        p.line(x, y, x + 13, y, "#b0a68d");
    p.fill(62, 64, 24, 35, C.dark).fill(65, 66, 18, 31, "#786044");
    p.fill(13, 98, 117, 5, C.light);
    if (mill) {
      wheel(p, 119, 77, 22);
      p.fill(113, 29, 4, 51, C.trunk);
      p.fill(22, 65, 17, 22, C.blue);
    } else if (warehouse) {
      p.fill(20, 66, 30, 32, C.dark);
      p.fill(100, 69, 17, 29, C.dark);
      for (let x = 20; x < 52; x += 8) p.fill(x, 63, 6, 4, C.bronze);
    } else {
      for (const x of [25, 48, 103, 126]) column(p, x, 101, 45, 8);
      p.fill(13, 51, 117, 5, C.blue);
    }
    for (const x of [22, 106]) p.fill(x, 51, 10, 7, C.dark);
    return p;
  }
  if (name.includes("ship_") || name === "aegean_ferry") {
    const small = name.includes("skiff") || name.endsWith("ferry"),
      storm = name.includes("stormbreaker"),
      round = name.includes("roundship");
    const w = small ? 76 : 128,
      h = small ? 74 : 126;
    const p = base(w, h),
      cy = h - 28;
    p.poly(
      [
        [5, cy - 8],
        [w - 9, cy - 9],
        [w - 19, cy + 15],
        [25, cy + 16],
      ],
      C.dark,
    );
    p.poly(
      [
        [8, cy - 8],
        [w - 8, cy - 8],
        [w - 21, cy + 7],
        [25, cy + 9],
      ],
      storm ? C.bronze : "#9a7650",
    );
    for (let j = 0; j < 4; j++)
      p.line(
        18 + j * 3,
        cy - 5 + j * 4,
        w - 17 - j * 2,
        cy - 5 + j * 4,
        j % 2 ? "#7b593c" : "#b49562",
      );
    for (let j = 0; j < 7; j++) p.fill(27 + j * 10, cy - 2, 1, 3, "#5b4b35");
    for (let x = 26; x < w - 20; x += 12) {
      p.line(x, cy + 7, x - 13, cy + 24, C.light);
      p.line(x, cy + 1, x + 7, cy - 13, C.dark);
    }
    p.fill(w / 2, 12, 4, cy - 5, C.dark);
    p.poly(
      [
        [w / 2 + 5, 13],
        [w - 18, 27],
        [w - 27, cy - 14],
        [w / 2 + 5, cy - 9],
      ],
      storm ? "#a5bbce" : C.light,
    );
    p.line(w / 2 + 5, 13, w - 27, cy - 14, C.stone);
    p.line(w / 2 + 2, 12, 18, cy - 4, "#8d856c").line(
      w / 2 + 2,
      12,
      w - 14,
      cy - 5,
      "#8d856c",
    );
    for (let j = 1; j < 4; j++) {
      const sx = w / 2 + 5 + ((w / 2 - 28) * j) / 4;
      p.line(sx, 17 + j * 3, sx - 5, cy - 12, "#c6bd9e");
    }
    if (storm)
      p.poly(
        [
          [w / 2 + 18, 35],
          [w / 2 + 27, 25],
          [w / 2 + 23, 41],
          [w / 2 + 33, 37],
          [w / 2 + 18, 59],
          [w / 2 + 22, 43],
        ],
        C.gold,
      );
    if (round)
      for (let x = 22; x < 55; x += 11) p.fill(x, cy - 7, 9, 8, C.clay);
    if (!small)
      p.poly(
        [
          [w - 16, cy + 7],
          [w - 1, cy + 2],
          [w - 18, cy + 12],
        ],
        C.bronze,
      );
    return p;
  }
  if (name.includes("house") || name === "aegean_temple") {
    const temple = name.endsWith("temple"),
      w = temple ? 156 : 124,
      h = temple ? 128 : 106;
    const p = base(w, h);
    p.fill(12, 47, w - 24, h - 55, C.stone).fill(
      15,
      48,
      w - 30,
      h - 58,
      C.marble,
    );
    roof(p, 6, 41, w - 12);
    p.fill(11, h - 13, w - 22, 5, C.stone).fill(7, h - 8, w - 14, 4, C.light);
    if (temple)
      for (let x = 23; x < w - 20; x += 22) column(p, x, h - 13, h - 64, 10);
    else {
      p.fill(w / 2 - 12, h - 49, 24, 36, C.dark);
      for (const x of [25, w - 35])
        p.fill(x, 61, 12, 16, C.blue).box(x - 1, 60, 14, 18, C.light);
      // Limewash chips, lintels, roof courses and a side terrace give domestic
      // buildings the same small-scale wear as the older village sprites.
      p.fill(w / 2 - 15, h - 51, 30, 4, C.light);
      for (let y = 50; y < h - 17; y += 11)
        for (let x = 19 + (y % 3) * 5; x < w - 20; x += 23)
          p.fill(x, y, 5, 1, "#bbb198");
      for (let x = 17; x < w - 12; x += 13) p.fill(x, 40, 8, 2, C.roof);
      if (name.includes("courtyard")) {
        p.fill(14, h - 22, 23, 15, C.stone).fill(15, h - 24, 23, 3, C.light);
        p.fill(17, h - 35, 3, 13, C.trunk).fill(30, h - 35, 3, 13, C.trunk);
        p.ellipse(20, h - 38, 12, 5, C.leaf).ellipse(
          27,
          h - 35,
          10,
          4,
          C.leafLight,
        );
      }
    }
    if (name.includes("spartan")) {
      p.fill(19, 48, 10, 36, C.red).fill(w - 29, 48, 10, 36, C.red);
    }
    return p;
  }
  if (
    name.includes("cypress") ||
    name.includes("olive") ||
    name.includes("golden_tree")
  ) {
    const cypress = name.includes("cypress"),
      p = base(cypress ? 46 : 86, cypress ? 108 : 82),
      x = p.w / 2;
    p.fill(x - 3, p.h - 35, 6, 30, C.trunk);
    const dark = name.includes("red_") ? "#693b3c" : "#485b49",
      mid = name.includes("red_") ? "#965448" : C.leaf;
    const leaf = name.includes("red_") ? "#b47358" : C.leafLight;
    const rng = new RNG(`tree:${name}`);
    p.fill(x + 2, p.h - 32, 2, 27, "#514636").fill(
      x - 2,
      p.h - 29,
      1,
      23,
      "#9a8961",
    );
    p.line(x - 1, p.h - 11, x - 8, p.h - 5, C.trunk).line(
      x + 1,
      p.h - 13,
      x + 8,
      p.h - 6,
      C.trunk,
    );
    if (cypress) {
      p.poly(
        [
          [x, 3],
          [x + 16, 65],
          [x + 10, 88],
          [x - 12, 88],
          [x - 17, 65],
        ],
        dark,
      );
      p.poly(
        [
          [x - 1, 8],
          [x + 7, 77],
          [x - 10, 80],
        ],
        mid,
      );
      for (let tier = 0; tier < 8; tier++) {
        const yy = 17 + tier * 9,
          half = 3 + tier * 1.65;
        p.ellipse(x - 2, yy, half, 7, tier % 2 ? mid : mix(mid, dark, 0.22));
        for (let n = 0; n < 8; n++) {
          const px = x + rng.range(-half, half),
            py = yy + rng.range(-6, 6);
          p.fill(px, py, rng.int(1, 3), 1, rng.bool(0.35) ? leaf : dark);
        }
      }
    } else {
      p.line(x, p.h - 15, x - 19, 41, C.trunk).line(
        x,
        p.h - 15,
        x + 22,
        34,
        C.trunk,
      );
      for (const [dx, dy, r] of [
        [-22, 33, 19],
        [0, 22, 24],
        [24, 31, 18],
      ])
        p.ellipse(x + dx, dy, r, r * 0.75, dark).ellipse(
          x + dx - 2,
          dy - 3,
          r - 3,
          r * 0.6,
          mid,
        );
      for (let i = 0; i < 14; i++)
        p.circle(
          15 + ((i * 17) % 58),
          18 + ((i * 11) % 31),
          name.includes("golden") ? 3 : 1,
          name.includes("golden") ? C.gold : C.leafLight,
        );
      for (let n = 0; n < 65; n++) {
        const angle = rng.range(0, Math.PI * 2),
          rr = Math.sqrt(rng.next());
        const px = x + Math.cos(angle) * 35 * rr,
          py = 31 + Math.sin(angle) * 21 * rr;
        p.ellipse(
          px,
          py,
          rng.int(2, 5),
          rng.int(1, 3),
          rng.bool(0.45) ? mix(mid, dark, 0.3) : mid,
        );
        p.fill(px - 1, py - 1, rng.int(1, 3), 1, leaf);
        if (n % 7 === 0)
          p.set(px + 2, py + 2, name.includes("golden") ? C.gold : "#394735");
      }
    }
    return p;
  }
  if (
    name.endsWith("oath_gate") ||
    name.endsWith("hades_gate") ||
    name.endsWith("arch")
  ) {
    const p = base(108, 108);
    column(p, 20, 100, 75, 16);
    column(p, 88, 100, 75, 16);
    p.fill(8, 12, 92, 14, C.marble).fill(8, 17, 92, 4, C.red);
    if (!name.endsWith("arch")) {
      p.fill(34, 29, 39, 62, C.dark);
      for (let x = 38; x < 73; x += 9) p.fill(x, 32, 3, 58, C.bronze);
    }
    p.poly(
      [
        [8, 12],
        [54, 0],
        [100, 12],
      ],
      C.bronze,
    );
    return p;
  }
  if (name.endsWith("column") || name.endsWith("pillar_cracked")) {
    const p = base(40, 84);
    column(p, 20, 78, 62, 16);
    if (name.endsWith("cracked"))
      p.line(19, 22, 24, 38, C.ink)
        .line(24, 38, 17, 45, C.ink)
        .line(17, 45, 21, 64, C.ink);
    return p;
  }
  const p = base(64, 76),
    x = 32,
    y = 68;
  if (name.endsWith("amphora")) {
    p.ellipse(x, y - 18, 14, 20, C.clay)
      .fill(x - 6, y - 45, 12, 15, C.clay)
      .fill(x - 10, y - 47, 20, 4, C.dark);
    p.ellipse(x - 14, y - 28, 6, 8, C.dark)
      .ellipse(x + 14, y - 28, 6, 8, C.dark)
      .fill(x - 13, y - 20, 26, 5, C.dark);
  } else if (
    name.endsWith("brazier") ||
    name.endsWith("beacon") ||
    name.endsWith("fumarole")
  ) {
    if (!name.endsWith("fumarole")) {
      p.fill(18, 61, 28, 7, C.stone);
      column(p, x, 62, 27, 10);
      p.poly(
        [
          [16, 29],
          [48, 29],
          [40, 39],
          [24, 39],
        ],
        C.bronze,
      );
    } else p.ellipse(x, 62, 20, 8, C.stone);
    flame(p, x, name.endsWith("fumarole") ? 60 : 29, frame);
  } else if (name.endsWith("mirror")) {
    column(p, x, y, 24, 9);
    p.ellipse(x, 29, 19, 25, C.bronze).ellipse(x, 29, 15, 21, "#85b4bf");
    p.poly(
      [
        [21, 16],
        [33, 9],
        [43, 41],
        [35, 49],
      ],
      "#d0e3de",
    );
  } else if (name.endsWith("standard")) {
    p.fill(28, 7, 4, 60, C.bronze).poly(
      [
        [32, 9],
        [55, 12],
        [50, 36],
        [32, 33],
      ],
      C.red,
    );
    p.poly(
      [
        [37, 29],
        [42, 16],
        [47, 29],
        [44, 29],
        [42, 22],
        [40, 29],
      ],
      C.gold,
    );
  } else if (name.endsWith("shield_wall")) {
    for (const dx of [-15, 0, 15])
      p.ellipse(x + dx, 49, 12, 18, C.dark)
        .ellipse(x + dx, 47, 10, 16, C.bronze)
        .circle(x + dx, 47, 3, C.gold);
  } else if (name.endsWith("shield_grave")) {
    p.fill(28, 15, 7, 52, C.stone)
      .ellipse(x, 47, 18, 19, C.bronze)
      .ellipse(x, 47, 14, 15, C.red)
      .circle(x, 47, 4, C.gold);
  } else if (name.endsWith("statue") || name.endsWith("petrified")) {
    p.fill(18, 62, 29, 6, C.stone)
      .fill(23, 43, 7, 20, C.marble)
      .fill(34, 43, 7, 20, C.marble)
      .poly(
        [
          [24, 26],
          [41, 26],
          [44, 49],
          [21, 49],
        ],
        C.marble,
      )
      .circle(32, 18, 9, C.marble);
    p.line(24, 29, 12, 43, C.stone).line(40, 28, 51, 20, C.stone);
  } else if (name.endsWith("scroll") || name.endsWith("stele")) {
    p.fill(18, 36, 5, 32, C.dark)
      .fill(40, 36, 5, 32, C.dark)
      .fill(12, 14, 41, 37, C.marble);
    p.fill(9, 12, 47, 4, C.bronze).fill(9, 49, 47, 4, C.bronze);
    for (let k = 0; k < 5; k++)
      p.line(19, 23 + k * 5, 44 - k * 2, 23 + k * 5, C.dark);
  } else if (name.endsWith("anvil")) {
    p.fill(20, 47, 25, 20, C.dark)
      .poly(
        [
          [13, 30],
          [54, 30],
          [42, 42],
          [25, 42],
          [20, 35],
          [8, 35],
        ],
        C.stone,
      )
      .fill(17, 27, 33, 5, C.light);
    p.fill(43, 16, 5, 18, C.trunk).fill(38, 11, 15, 8, C.bronze);
  } else if (name.endsWith("fountain")) {
    p.ellipse(x, 58, 27, 11, C.stone)
      .ellipse(x, 55, 23, 8, C.marble)
      .ellipse(x, 54, 19, 5, C.sea);
    column(p, x, 54, 25, 9);
    p.ellipse(x, 24, 15, 5, C.marble);
    p.line(x, 17, x, 26, "#a8ddd9");
  } else if (name.endsWith("crane")) {
    p.fill(28, 10, 7, 56, C.trunk)
      .fill(7, 10, 48, 7, C.dark)
      .line(10, 13, 30, 36, C.bronze)
      .line(52, 15, 52, 46, C.bronze);
    p.fill(43, 46, 18, 16, C.stone);
    wheel(p, 22, 39, 10);
  } else if (
    name.endsWith("sluice") ||
    name.endsWith("pen_gate") ||
    name.endsWith("labyrinth_gate")
  ) {
    p.fill(7, 31, 6, 36, C.stone)
      .fill(51, 31, 6, 36, C.stone)
      .fill(9, 32, 47, 5, C.bronze);
    for (let n = 17; n < 50; n += 8) p.fill(n, 37, 4, 24, C.dark);
    wheel(p, 32, 24, 13);
  } else if (
    name.endsWith("bell") ||
    name.endsWith("resonator") ||
    name.endsWith("horn")
  ) {
    p.fill(10, 15, 6, 52, C.trunk)
      .fill(48, 15, 6, 52, C.trunk)
      .fill(9, 13, 46, 6, C.trunk);
    if (name.endsWith("horn"))
      p.poly(
        [
          [20, 34],
          [42, 22],
          [47, 27],
          [37, 33],
          [31, 44],
          [20, 45],
        ],
        C.bronze,
      );
    else
      p.poly(
        [
          [24, 23],
          [40, 23],
          [43, 45],
          [49, 50],
          [15, 50],
          [22, 45],
        ],
        C.bronze,
      ).circle(32, 54, 4, C.dark);
  } else if (name.endsWith("throne")) {
    p.fill(11, 6, 42, 51, C.bronze)
      .fill(17, 13, 30, 34, C.red)
      .fill(11, 47, 43, 8, C.dark)
      .fill(14, 53, 7, 15, C.bronze)
      .fill(45, 53, 7, 15, C.bronze);
    p.poly(
      [
        [11, 6],
        [18, 0],
        [24, 6],
        [32, 0],
        [40, 6],
        [48, 0],
        [53, 6],
      ],
      C.gold,
    );
  } else if (name.endsWith("whirlpool")) {
    for (let k = 22; k > 2; k -= 4)
      p.ellipse(
        32 + Math.sin(k) * 2,
        45,
        k,
        k * 0.65,
        k % 8 ? "#365e75" : "#709ea6",
      );
  } else if (name.endsWith("mooring")) {
    p.fill(12, 55, 40, 10, C.dark)
      .fill(18, 24, 9, 38, C.trunk)
      .fill(39, 24, 9, 38, C.trunk);
    p.line(21, 38, 44, 48, C.marble).line(21, 45, 44, 38, C.marble);
  } else if (name.endsWith("titan_chain") || name.endsWith("chain_anchor")) {
    for (let j = 0; j < 5; j++)
      p.ellipse(31 + (j % 2 ? 6 : 0), 10 + j * 10, 10, 8, C.bronze).ellipse(
        31 + (j % 2 ? 6 : 0),
        10 + j * 10,
        6,
        4,
        C.ink,
      );
    p.fill(13, 60, 39, 8, C.stone);
  } else {
    // Pylons, restraints, conductors, star anchors and sanctuary stones have
    // distinct emblems on the same readable ancient mechanism silhouette.
    p.fill(14, 61, 36, 7, C.stone).poly(
      [
        [21, 17],
        [43, 17],
        [48, 61],
        [16, 61],
      ],
      C.marble,
    );
    const color = name.endsWith("conductor") ? "#8dbfda" : C.bronze;
    if (name.endsWith("star_anchor"))
      for (let n = 0; n < 5; n++)
        p.line(
          32,
          34,
          32 + Math.sin(n * Math.PI * 0.4) * 13,
          34 - Math.cos(n * Math.PI * 0.4) * 13,
          C.bronze,
        );
    else if (name.endsWith("restraint")) wheel(p, 32, 36, 11);
    else if (name.endsWith("vent"))
      p.fill(22, 26, 20, 20, C.dark)
        .fill(26, 28, 4, 16, C.bronze)
        .fill(35, 28, 4, 16, C.bronze);
    else
      p.poly(
        [
          [34, 22],
          [23, 39],
          [31, 38],
          [27, 52],
          [42, 32],
          [33, 33],
        ],
        color,
      );
  }
  return p;
}

const cache = new Map<string, PropArt>();
export function getAegeanProp(name: string): PropArt | undefined {
  if (!registered.has(name)) return undefined;
  const old = cache.get(name);
  if (old) return old;
  const animated = /brazier|beacon|fumarole/.test(name);
  const frames = Array.from({ length: animated ? 4 : 1 }, (_, i) =>
    draw(name, i),
  );
  const result = {
    canvas: strip(frames),
    fw: frames[0].w,
    fh: frames[0].h,
    frames: frames.length,
    fps: 6,
    anchorY: frames[0].h - 4,
  };
  cache.set(name, result);
  return result;
}
