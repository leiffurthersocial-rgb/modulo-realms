import { Px, strip } from "./pixel";
import type { PropArt } from "./props";

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
  if (!name.startsWith("aegean_")) return undefined;
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
