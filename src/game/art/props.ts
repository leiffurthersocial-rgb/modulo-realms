import { RNG } from '../core/rng';
import { PAL, mix, shade, withAlpha } from './palette';
import { Px, strip, type Canvas } from './pixel';

export interface PropArt {
  /** Sheet containing `frames` horizontally laid out frames. */
  canvas: Canvas;
  fw: number;
  fh: number;
  frames: number;
  /** Frames per second for animated props. */
  fps: number;
  /** Where the sprite's "feet" sit, measured from the top of the frame. */
  anchorY: number;
}

const cache = new Map<string, PropArt>();

function art(frames: Px[], anchorY?: number, fps = 6): PropArt {
  return {
    canvas: strip(frames),
    fw: frames[0].w,
    fh: frames[0].h,
    frames: frames.length,
    fps,
    anchorY: anchorY ?? frames[0].h,
  };
}

/* ------------------------------------------------------------------ */
/* Shared shapes                                                       */
/* ------------------------------------------------------------------ */

function groundShadow(p: Px, cx: number, y: number, rx: number, ry = Math.max(2, rx * 0.4)) {
  p.ellipse(cx, y, rx, ry, 'rgba(10,8,16,0.32)');
}

function trunk(p: Px, cx: number, baseY: number, h: number, w: number, dark: string, light: string) {
  p.fill(cx - Math.floor(w / 2), baseY - h, w, h, dark);
  p.fill(cx - Math.floor(w / 2) + 1, baseY - h, Math.max(1, w - 2), h, mix(dark, light, 0.5));
  p.fill(cx + Math.floor(w / 2) - 1, baseY - h, 1, h, shade(dark, 0.7));
  // roots
  p.fill(cx - Math.floor(w / 2) - 1, baseY - 2, 2, 2, dark);
  p.fill(cx + Math.floor(w / 2) - 1, baseY - 2, 2, 2, dark);
}

/** Layered blobby canopy — the workhorse for every leafy tree. */
function canopy(
  p: Px,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  dark: string,
  base: string,
  light: string,
  rng: RNG,
  blobs = 7,
) {
  p.ellipse(cx, cy, rx, ry, dark);
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const bx = cx + Math.cos(a) * rx * 0.55;
    const by = cy + Math.sin(a) * ry * 0.55;
    p.ellipse(bx, by, rx * rng.range(0.34, 0.5), ry * rng.range(0.34, 0.5), base);
  }
  p.ellipse(cx, cy - ry * 0.15, rx * 0.66, ry * 0.6, base);
  // highlight cluster toward the upper-left light source
  for (let i = 0; i < 4; i++) {
    p.ellipse(
      cx - rx * rng.range(0.1, 0.5),
      cy - ry * rng.range(0.25, 0.6),
      rx * rng.range(0.16, 0.26),
      ry * rng.range(0.16, 0.26),
      light,
    );
  }
  // leaf speckle
  for (let i = 0; i < 24; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next());
    p.set(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, rng.bool(0.5) ? light : dark);
  }
}

/* ------------------------------------------------------------------ */
/* Generators                                                          */
/* ------------------------------------------------------------------ */

type Gen = (rng: RNG) => PropArt;

const GEN: Record<string, Gen> = {};

/* --- trees --- */

function leafyTree(w: number, h: number, dark: string, base: string, light: string, trunkDark: string, trunkLight: string) {
  return (rng: RNG): PropArt => {
    const p = new Px(w, h);
    const cx = w / 2;
    groundShadow(p, cx, h - 4, w * 0.3);
    trunk(p, cx, h - 3, h * 0.42, Math.max(3, Math.round(w * 0.14)), trunkDark, trunkLight);
    canopy(p, cx, h * 0.34, w * 0.46, h * 0.3, dark, base, light, rng, 8);
    return art([p], h - 3);
  };
}

GEN.tree_oak = leafyTree(56, 72, PAL.leafDark, PAL.leaf, PAL.leafLit, PAL.woodDark, PAL.woodLit);
GEN.tree_maple = leafyTree(52, 68, '#5a3320', PAL.clay, PAL.flame, PAL.woodDark, PAL.woodLit);
GEN.tree_birch = (rng) => {
  const p = new Px(44, 64);
  const cx = 22;
  groundShadow(p, cx, 60, 12);
  p.fill(cx - 2, 26, 5, 34, PAL.cloth);
  p.fill(cx + 1, 26, 2, 34, PAL.bone);
  for (let i = 0; i < 7; i++) p.fill(cx - 2, 28 + i * 5, rng.int(2, 4), 1, PAL.charcoal);
  canopy(p, cx, 20, 19, 14, PAL.grassDark, PAL.grassLit, PAL.grassPale, rng, 7);
  return art([p], 61);
};
GEN.tree_pine = (rng) => {
  const p = new Px(44, 76);
  const cx = 22;
  groundShadow(p, cx, 72, 11);
  trunk(p, cx, 73, 16, 5, PAL.woodDark, PAL.wood);
  for (let i = 0; i < 5; i++) {
    const y = 60 - i * 12;
    const wd = 21 - i * 3.4;
    p.poly([[cx - wd, y], [cx + wd, y], [cx, y - 20]], PAL.mossDark);
    p.poly([[cx - wd + 3, y - 1], [cx + wd - 5, y - 1], [cx, y - 17]], PAL.moss);
    p.poly([[cx - wd + 5, y - 3], [cx - 1, y - 3], [cx - 2, y - 14]], PAL.leaf);
    for (let k = 0; k < 5; k++) p.set(cx + rng.int(-wd + 2, wd - 2), y - rng.int(1, 14), rng.bool() ? PAL.leafLit : PAL.mossDark);
  }
  return art([p], 73);
};
GEN.tree_pine_snow = (rng) => {
  const base = GEN.tree_pine(rng);
  const p = new Px(base.fw, base.fh);
  p.blit(base.canvas, 0, 0);
  for (let i = 0; i < 5; i++) {
    const y = 60 - i * 12;
    const wd = 21 - i * 3.4;
    p.poly([[22 - wd, y], [22 + wd, y], [22, y - 6]], withAlpha(PAL.snow, 0.92));
    for (let k = 0; k < 4; k++) p.set(22 + rng.int(-wd, wd), y - rng.int(0, 5), PAL.white);
  }
  return art([p], 73);
};
GEN.tree_dead = (rng) => {
  const p = new Px(48, 68);
  const cx = 24;
  groundShadow(p, cx, 64, 10);
  trunk(p, cx, 65, 40, 6, PAL.woodDark, PAL.soil);
  const branch = (x: number, y: number, dx: number, dy: number, len: number, depth: number) => {
    let px = x; let py = y;
    for (let i = 0; i < len; i++) {
      px += dx; py += dy;
      p.set(px, py, depth > 1 ? PAL.woodDark : PAL.soil);
      p.set(px, py + 1, PAL.woodDark);
    }
    if (depth > 0) {
      branch(px, py, dx + rng.range(-0.7, 0.2), dy - 0.3, Math.max(3, len - 4), depth - 1);
      branch(px, py, dx + rng.range(-0.2, 0.7), dy - 0.3, Math.max(3, len - 4), depth - 1);
    }
  };
  branch(cx, 32, -0.7, -0.8, 9, 2);
  branch(cx, 36, 0.8, -0.7, 9, 2);
  branch(cx, 26, 0.1, -1, 8, 2);
  return art([p], 65);
};
GEN.tree_willow = (rng) => {
  const p = new Px(60, 72);
  const cx = 30;
  groundShadow(p, cx, 68, 15);
  trunk(p, cx, 69, 28, 7, PAL.woodDark, PAL.wood);
  canopy(p, cx, 24, 26, 15, PAL.swampDark, PAL.swamp, PAL.rot, rng, 8);
  for (let i = 0; i < 14; i++) {
    const x = cx + rng.int(-24, 24);
    const y = 32 + rng.int(0, 6);
    const len = rng.int(6, 18);
    for (let k = 0; k < len; k++) p.set(x + Math.round(Math.sin(k * 0.4) * 1.2), y + k, rng.bool(0.6) ? PAL.swamp : PAL.rot);
  }
  return art([p], 69);
};
GEN.tree_palm = (rng) => {
  const p = new Px(52, 72);
  const cx = 26;
  groundShadow(p, cx, 68, 11);
  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    p.fill(cx + Math.round(Math.sin(t * 1.6) * 5) - 2, 68 - i, 4, 1, i % 4 === 0 ? PAL.woodDark : PAL.wood);
  }
  const tipX = cx + Math.round(Math.sin(1.6) * 5);
  for (let f = 0; f < 6; f++) {
    const a = (f / 6) * Math.PI * 2;
    for (let k = 0; k < 15; k++) {
      const x = tipX + Math.cos(a) * k;
      const y = 28 + Math.sin(a) * k * 0.5 + k * k * 0.035;
      p.set(x, y, k < 8 ? PAL.leaf : PAL.leafDark);
      p.set(x, y - 1, PAL.leafLit);
    }
  }
  p.circle(tipX, 28, 3, PAL.clay);
  return art([p], 68);
};
GEN.tree_ash = (rng) => {
  const p = new Px(52, 68);
  const cx = 26;
  groundShadow(p, cx, 64, 12);
  trunk(p, cx, 65, 28, 6, PAL.ink, PAL.charcoal);
  canopy(p, cx, 24, 22, 14, PAL.charcoal, PAL.slate, PAL.ash, rng, 7);
  for (let i = 0; i < 6; i++) p.set(cx + rng.int(-18, 18), 18 + rng.int(-8, 8), PAL.ember);
  return art([p], 65);
};
GEN.tree_magic = (rng) => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(56, 76);
    const cx = 28;
    groundShadow(p, cx, 72, 14);
    trunk(p, cx, 73, 32, 7, '#2a2140', PAL.arcane);
    canopy(p, cx, 26, 24, 17, PAL.arcaneDark, PAL.arcane, PAL.arcaneLit, rng, 8);
    for (let i = 0; i < 9; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(0.3, 1);
      p.set(cx + Math.cos(a) * 24 * r, 26 + Math.sin(a) * 17 * r + Math.sin(f * 1.5 + i) * 1.5, PAL.frost);
    }
    frames.push(p);
  }
  return art(frames, 73, 5);
};

/* --- foliage / small scatter --- */

GEN.bush = (rng) => {
  const p = new Px(32, 28);
  groundShadow(p, 16, 25, 9);
  canopy(p, 16, 16, 13, 9, PAL.leafDark, PAL.leaf, PAL.leafLit, rng, 5);
  return art([p], 26);
};
GEN.bush_berry = (rng) => {
  const p = new Px(32, 28);
  groundShadow(p, 16, 25, 9);
  canopy(p, 16, 16, 13, 9, PAL.leafDark, PAL.leaf, PAL.leafLit, rng, 5);
  for (let i = 0; i < 6; i++) {
    const x = 16 + rng.int(-10, 10);
    const y = 14 + rng.int(-6, 7);
    p.set(x, y, PAL.blood); p.set(x + 1, y, PAL.ember);
  }
  return art([p], 26);
};
GEN.shrub_dead = (rng) => {
  const p = new Px(28, 24);
  groundShadow(p, 14, 21, 7);
  for (let i = 0; i < 12; i++) {
    const a = rng.range(-2.6, -0.5);
    for (let k = 0; k < rng.int(5, 11); k++) p.set(14 + Math.cos(a) * k, 21 + Math.sin(a) * k, rng.bool() ? PAL.woodDark : PAL.soil);
  }
  return art([p], 22);
};
GEN.cactus = (rng) => {
  const p = new Px(28, 44);
  groundShadow(p, 14, 41, 7);
  p.fill(11, 10, 7, 31, PAL.moss);
  p.fill(12, 10, 4, 31, PAL.leaf);
  p.ellipse(14.5, 10, 3.5, 3, PAL.leaf);
  p.fill(5, 22, 6, 4, PAL.moss); p.fill(5, 16, 4, 8, PAL.moss); p.ellipse(6.5, 16, 2, 2, PAL.leaf);
  p.fill(18, 26, 6, 4, PAL.moss); p.fill(20, 19, 4, 9, PAL.moss); p.ellipse(21.5, 19, 2, 2, PAL.leaf);
  for (let i = 0; i < 12; i++) p.set(rng.int(6, 22), rng.int(12, 40), PAL.bone);
  return art([p], 42);
};
GEN.reeds = (rng) => {
  const p = new Px(26, 30);
  for (let i = 0; i < 9; i++) {
    const x = rng.int(3, 22);
    const h = rng.int(12, 24);
    for (let k = 0; k < h; k++) p.set(x + Math.round(Math.sin(k * 0.25) * 1.5), 28 - k, k > h - 5 ? PAL.swamp : PAL.grassDark);
    if (rng.bool(0.5)) p.fill(x - 1, 28 - h - 3, 3, 4, PAL.clay);
  }
  return art([p], 29);
};
GEN.fern = (rng) => {
  const p = new Px(28, 24);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + rng.range(-1.1, 1.1);
    for (let k = 0; k < rng.int(8, 13); k++) {
      const x = 14 + Math.cos(a) * k;
      const y = 22 + Math.sin(a) * k;
      p.set(x, y, PAL.leaf);
      if (k % 2 === 0) { p.set(x + 1, y, PAL.leafDark); p.set(x - 1, y, PAL.leafLit); }
    }
  }
  return art([p], 23);
};
GEN.mushroom_cluster = (rng) => {
  const p = new Px(26, 22);
  groundShadow(p, 13, 20, 7);
  for (let i = 0; i < 3; i++) {
    const x = 6 + i * 7 + rng.int(-1, 1);
    const y = 19 - rng.int(0, 3);
    const h = rng.int(4, 7);
    p.fill(x, y - h, 2, h, PAL.bone);
    p.ellipse(x + 1, y - h, 4, 3, rng.bool() ? PAL.blood : PAL.arcane);
    p.ellipse(x + 1, y - h - 1, 2, 1, PAL.cloth);
  }
  return art([p], 21);
};
GEN.lilypad = (rng) => {
  const p = new Px(22, 16);
  p.ellipse(11, 9, 9, 5, PAL.leaf);
  p.ellipse(11, 8, 8, 4, PAL.leafLit);
  p.line(11, 8, 18, 11, PAL.leafDark);
  if (rng.bool(0.4)) { p.circle(9, 7, 2, PAL.cloth); p.set(9, 7, PAL.flameLit); }
  return art([p], 14);
};
GEN.grass_tuft = (rng) => {
  const p = new Px(20, 16);
  for (let i = 0; i < 7; i++) {
    const x = rng.int(3, 16);
    const h = rng.int(5, 11);
    for (let k = 0; k < h; k++) p.set(x + Math.round(Math.sin(k * 0.5) * 1.3), 14 - k, k > h - 3 ? PAL.grassPale : PAL.grassLit);
  }
  return art([p], 15);
};

/* --- rock / mineral --- */

function rockGen(w: number, h: number, dark: string, base: string, light: string) {
  return (rng: RNG): PropArt => {
    const p = new Px(w, h);
    groundShadow(p, w / 2, h - 3, w * 0.36);
    const pts: Array<[number, number]> = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = rng.range(0.66, 1);
      pts.push([w / 2 + Math.cos(a) * (w / 2 - 2) * r, h - 4 + Math.sin(a) * (h / 2 - 3) * r]);
    }
    p.poly(pts, base);
    p.poly(pts.map(([x, y]) => [x, y + 2] as [number, number]), shade(base, 0.7));
    p.poly(pts, base);
    p.ellipse(w * 0.4, h * 0.42, w * 0.2, h * 0.16, light);
    p.speckle(2, 2, w - 4, h - 4, [dark, light], 0.05, rng);
    p.outline(dark);
    return art([p], h - 3);
  };
}
GEN.rock_small = rockGen(22, 18, PAL.rockDark, PAL.rock, PAL.rockPale);
GEN.rock_big = rockGen(40, 32, PAL.rockDark, PAL.rock, PAL.rockPale);
GEN.boulder = rockGen(56, 46, PAL.ink, PAL.slate, PAL.stone);
GEN.rock_sand = rockGen(30, 24, PAL.soil, PAL.sandDark, PAL.sand);
GEN.rock_snow = (rng) => {
  const b = rockGen(36, 30, PAL.rock, PAL.rockPale, PAL.snow)(rng);
  const p = new Px(b.fw, b.fh);
  p.blit(b.canvas, 0, 0);
  p.ellipse(18, 12, 12, 5, withAlpha(PAL.snow, 0.9));
  return art([p], b.anchorY);
};
GEN.crystal = (rng) => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(28, 40);
    groundShadow(p, 14, 37, 9);
    const glow = 0.5 + 0.5 * Math.sin((f / 4) * Math.PI * 2);
    p.ellipse(14, 30, 12, 8, withAlpha(PAL.arcaneLit, 0.12 + glow * 0.12));
    const shard = (x: number, top: number, w: number) => {
      p.poly([[x, 36], [x - w, 36 - (36 - top) * 0.45], [x, top], [x + w, 36 - (36 - top) * 0.45]], PAL.arcane);
      p.poly([[x, 36], [x - w, 36 - (36 - top) * 0.45], [x, top]], PAL.arcaneLit);
      p.line(x, top, x, 35, mix(PAL.arcaneLit, PAL.white, 0.4 + glow * 0.4));
    };
    shard(14, 8, 5);
    shard(7, 20, 3);
    shard(21, 17, 3.5);
    frames.push(p);
  }
  return art(frames, 37, 4);
};
GEN.stalagmite = (rng) => {
  const p = new Px(24, 40);
  groundShadow(p, 12, 37, 8);
  p.poly([[5, 37], [12, 4], [19, 37]], PAL.rockDark);
  p.poly([[8, 37], [12, 8], [14, 37]], PAL.rock);
  p.line(11, 10, 11, 34, PAL.rockLit);
  for (let i = 0; i < 6; i++) p.set(12 + rng.int(-4, 4), rng.int(12, 36), PAL.rockPale);
  return art([p], 38);
};
GEN.ore_vein = (rng) => {
  const b = rockGen(30, 26, PAL.rockDark, PAL.rock, PAL.rockPale)(rng);
  const p = new Px(b.fw, b.fh);
  p.blit(b.canvas, 0, 0);
  for (let i = 0; i < 7; i++) {
    const x = rng.int(6, 24); const y = rng.int(8, 22);
    p.fill(x, y, 2, 2, PAL.gold); p.set(x, y, PAL.goldLit);
  }
  return art([p], b.anchorY);
};

/* --- wood structures --- */

GEN.stump = (rng) => {
  const p = new Px(26, 20);
  groundShadow(p, 13, 18, 8);
  p.ellipse(13, 12, 9, 6, PAL.woodDark);
  p.fill(4, 12, 18, 5, PAL.woodDark);
  p.ellipse(13, 11, 8, 5, PAL.wood);
  p.ellipse(13, 11, 5, 3, PAL.woodLit);
  p.ellipse(13, 11, 2, 1, PAL.wood);
  for (let i = 0; i < 6; i++) p.set(rng.int(5, 21), rng.int(13, 17), PAL.woodDark);
  return art([p], 19);
};
GEN.log = (rng) => {
  const p = new Px(44, 20);
  groundShadow(p, 22, 18, 16);
  p.fill(4, 6, 36, 10, PAL.wood);
  p.fill(4, 6, 36, 3, PAL.woodLit);
  p.fill(4, 14, 36, 2, PAL.woodDark);
  p.ellipse(5, 11, 3, 5, PAL.woodDark);
  p.ellipse(5, 11, 2, 3, PAL.plank);
  for (let i = 0; i < 8; i++) p.fill(rng.int(8, 36), rng.int(7, 15), rng.int(2, 5), 1, shade(PAL.wood, 0.85));
  return art([p], 18);
};
GEN.fence = (rng) => {
  const p = new Px(32, 28);
  p.fill(4, 8, 3, 18, PAL.wood);
  p.fill(25, 8, 3, 18, PAL.wood);
  p.fill(4, 6, 3, 2, PAL.plank);
  p.fill(25, 6, 3, 2, PAL.plank);
  p.fill(0, 12, 32, 3, PAL.woodLit);
  p.fill(0, 19, 32, 3, PAL.woodLit);
  p.fill(0, 14, 32, 1, PAL.woodDark);
  p.fill(0, 21, 32, 1, PAL.woodDark);
  for (let i = 0; i < 6; i++) p.set(rng.int(0, 31), rng.int(12, 22), PAL.woodDark);
  return art([p], 27);
};
GEN.crate = (rng) => {
  const p = new Px(26, 26);
  groundShadow(p, 13, 24, 9);
  p.fill(3, 5, 20, 19, PAL.wood);
  p.fill(3, 5, 20, 3, PAL.plank);
  p.box(3, 5, 20, 19, PAL.woodDark);
  p.line(3, 5, 22, 23, PAL.plank);
  p.line(22, 5, 3, 23, PAL.plank);
  p.fill(3, 12, 20, 2, PAL.woodDark);
  for (let i = 0; i < 5; i++) p.set(rng.int(4, 21), rng.int(6, 22), PAL.woodLit);
  return art([p], 25);
};
GEN.barrel = (rng) => {
  const p = new Px(24, 30);
  groundShadow(p, 12, 28, 9);
  p.fill(4, 6, 16, 22, PAL.wood);
  p.ellipse(12, 6, 8, 3, PAL.plank);
  p.fill(3, 11, 18, 3, PAL.iron);
  p.fill(3, 21, 18, 3, PAL.iron);
  p.fill(3, 11, 18, 1, PAL.ironLit);
  p.fill(3, 21, 18, 1, PAL.ironLit);
  for (let i = 0; i < 4; i++) p.fill(6 + i * 4, 7, 1, 20, PAL.woodDark);
  p.outline(PAL.woodDark);
  return art([p], 29);
};
GEN.sack = (rng) => {
  const p = new Px(22, 24);
  groundShadow(p, 11, 22, 8);
  p.ellipse(11, 15, 8, 8, PAL.sand);
  p.ellipse(9, 13, 5, 5, PAL.sandLit);
  p.fill(8, 4, 6, 6, PAL.sand);
  p.fill(7, 8, 8, 2, PAL.clay);
  for (let i = 0; i < 6; i++) p.set(rng.int(5, 17), rng.int(10, 21), PAL.sandDark);
  p.outline(PAL.soil);
  return art([p], 23);
};
GEN.hay = (rng) => {
  const p = new Px(34, 26);
  groundShadow(p, 17, 24, 13);
  p.ellipse(17, 15, 15, 9, PAL.sandDark);
  p.ellipse(17, 14, 14, 8, PAL.sand);
  for (let i = 0; i < 26; i++) {
    const x = rng.int(3, 31); const y = rng.int(7, 22);
    p.fill(x, y, rng.int(2, 4), 1, rng.bool() ? PAL.sandLit : PAL.clay);
  }
  return art([p], 25);
};
GEN.cart = (rng) => {
  const p = new Px(52, 36);
  groundShadow(p, 26, 33, 20);
  p.fill(6, 12, 40, 14, PAL.wood);
  p.fill(6, 12, 40, 3, PAL.plank);
  p.box(6, 12, 40, 14, PAL.woodDark);
  for (let i = 0; i < 5; i++) p.fill(10 + i * 8, 13, 1, 12, PAL.woodDark);
  for (const wx of [14, 38]) {
    p.circle(wx, 28, 6, PAL.woodDark);
    p.circle(wx, 28, 4, PAL.wood);
    p.circle(wx, 28, 1, PAL.iron);
    p.line(wx - 4, 28, wx + 4, 28, PAL.woodDark);
    p.line(wx, 24, wx, 32, PAL.woodDark);
  }
  p.fill(44, 16, 8, 2, PAL.wood);
  for (let i = 0; i < 4; i++) p.fill(rng.int(10, 40), 8 + rng.int(0, 3), 6, 5, PAL.sand);
  return art([p], 34);
};
GEN.signpost = (rng) => {
  const p = new Px(28, 34);
  groundShadow(p, 14, 32, 7);
  p.fill(12, 12, 4, 20, PAL.wood);
  p.fill(13, 12, 1, 20, PAL.woodLit);
  p.fill(2, 8, 24, 12, PAL.plank);
  p.box(2, 8, 24, 12, PAL.woodDark);
  p.fill(2, 8, 24, 2, PAL.plankLit);
  for (let i = 0; i < 3; i++) p.fill(5, 12 + i * 3, rng.int(8, 17), 1, PAL.woodDark);
  return art([p], 33);
};
GEN.weapon_rack = (rng) => {
  const p = new Px(36, 40);
  p.fill(2, 34, 32, 4, PAL.woodDark);
  p.fill(4, 6, 3, 30, PAL.wood);
  p.fill(29, 6, 3, 30, PAL.wood);
  p.fill(2, 8, 32, 3, PAL.wood);
  const weapons = 4;
  for (let i = 0; i < weapons; i++) {
    const x = 7 + i * 7;
    p.fill(x, 10, 2, 20, PAL.steel);
    p.fill(x, 10, 1, 20, PAL.white);
    p.fill(x - 2, 30, 6, 2, PAL.gold);
    p.fill(x, 32, 2, 4, PAL.wood);
    if (rng.bool(0.3)) p.fill(x - 1, 10, 4, 3, PAL.iron);
  }
  return art([p], 38);
};

/* --- containers --- */

function chestGen(open: boolean, gold: boolean) {
  return (rng: RNG): PropArt => {
    const p = new Px(30, 28);
    const body = gold ? PAL.clay : PAL.wood;
    const trim = gold ? PAL.gold : PAL.iron;
    groundShadow(p, 15, 26, 11);
    p.fill(3, 13, 24, 12, body);
    p.fill(3, 13, 24, 2, shade(body, 1.2));
    p.box(3, 13, 24, 12, PAL.woodDark);
    p.fill(3, 18, 24, 2, trim);
    if (open) {
      p.fill(3, 4, 24, 8, shade(body, 0.8));
      p.fill(5, 5, 20, 6, PAL.ink);
      p.box(3, 4, 24, 8, PAL.woodDark);
      for (let i = 0; i < 8; i++) {
        p.fill(rng.int(6, 22), rng.int(14, 20), 2, 2, rng.bool(0.6) ? PAL.gold : PAL.goldLit);
      }
      p.ellipse(15, 16, 9, 3, withAlpha(PAL.goldLit, 0.25));
    } else {
      p.fill(3, 6, 24, 8, body);
      p.ellipse(15, 6, 12, 4, shade(body, 1.15));
      p.fill(3, 6, 24, 1, shade(body, 1.3));
      p.box(3, 6, 24, 8, PAL.woodDark);
      p.fill(12, 12, 6, 6, trim);
      p.set(15, 15, PAL.ink);
      p.fill(3, 9, 24, 2, trim);
    }
    p.outline(PAL.ink);
    return art([p], 27);
  };
}
GEN.chest = chestGen(false, false);
GEN.chest_open = chestGen(true, false);
GEN.chest_gold = chestGen(false, true);
GEN.chest_gold_open = chestGen(true, true);

/* --- fire / light --- */

function flame(p: Px, cx: number, baseY: number, scale: number, phase: number, colors: [string, string, string]) {
  const h = 10 * scale + Math.sin(phase) * 2 * scale;
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const w = Math.max(1, (1 - t) * 4.2 * scale + Math.sin(phase + y * 0.6) * 0.9);
    const c = t < 0.32 ? colors[0] : t < 0.7 ? colors[1] : colors[2];
    p.fill(cx - w / 2 + Math.sin(phase + t * 3) * scale * 0.8, baseY - y, w, 1, c);
  }
}

GEN.torch = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(20, 40);
    p.fill(8, 16, 4, 22, PAL.wood);
    p.fill(9, 16, 1, 22, PAL.woodLit);
    p.fill(7, 14, 6, 4, PAL.ironDark);
    p.ellipse(10, 22, 9, 9, withAlpha(PAL.flame, 0.07));
    flame(p, 10, 14, 1.25, (f / 4) * Math.PI * 2, [PAL.flameLit, PAL.flame, PAL.ember]);
    frames.push(p);
  }
  return art(frames, 38, 10);
};
GEN.brazier = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(28, 44);
    p.fill(11, 30, 6, 12, PAL.ironDark);
    p.fill(7, 40, 14, 3, PAL.ironDark);
    p.fill(5, 22, 18, 9, PAL.iron);
    p.fill(5, 22, 18, 2, PAL.ironLit);
    p.fill(7, 31, 14, 2, PAL.ironDark);
    p.ellipse(14, 24, 13, 13, withAlpha(PAL.flame, 0.07));
    flame(p, 14, 24, 1.6, (f / 4) * Math.PI * 2, [PAL.flameLit, PAL.flame, PAL.ember]);
    frames.push(p);
  }
  return art(frames, 43, 10);
};
GEN.campfire = (rng) => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(34, 34);
    groundShadow(p, 17, 30, 13);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      p.ellipse(17 + Math.cos(a) * 11, 28 + Math.sin(a) * 5, 3, 2, PAL.rock);
    }
    p.line(9, 28, 25, 24, PAL.woodDark);
    p.line(9, 24, 25, 28, PAL.wood);
    p.ellipse(17, 26, 12, 8, withAlpha(PAL.flame, 0.09));
    flame(p, 17, 27, 1.5, (f / 4) * Math.PI * 2, [PAL.flameLit, PAL.flame, PAL.ember]);
    frames.push(p);
  }
  return art(frames, 32, 9);
};
GEN.lantern = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 2; f++) {
    const p = new Px(18, 26);
    p.fill(8, 1, 2, 4, PAL.ironDark);
    p.fill(4, 5, 10, 3, PAL.ironDark);
    p.fill(5, 8, 8, 10, f === 0 ? PAL.flameLit : PAL.gold);
    p.box(4, 7, 10, 12, PAL.ironDark);
    p.fill(4, 19, 10, 3, PAL.ironDark);
    p.ellipse(9, 13, 9, 9, withAlpha(PAL.flameLit, 0.08));
    frames.push(p);
  }
  return art(frames, 24, 3);
};

/* --- village / interior furniture --- */

GEN.well = (rng) => {
  const p = new Px(44, 48);
  groundShadow(p, 22, 45, 17);
  p.ellipse(22, 34, 16, 9, PAL.stone);
  p.ellipse(22, 33, 13, 7, PAL.ink);
  p.ellipse(22, 34, 11, 5, PAL.water);
  p.fill(6, 34, 32, 8, PAL.stone);
  p.ellipse(22, 42, 16, 5, PAL.stone);
  for (let i = 0; i < 14; i++) p.set(rng.int(7, 37), rng.int(34, 45), rng.bool() ? PAL.slate : PAL.fog);
  p.fill(9, 8, 4, 28, PAL.wood);
  p.fill(31, 8, 4, 28, PAL.wood);
  p.poly([[4, 10], [22, 0], [40, 10], [40, 13], [22, 4], [4, 13]], PAL.clay);
  p.poly([[4, 10], [22, 0], [22, 4], [4, 13]], mix(PAL.clay, PAL.flame, 0.3));
  p.fill(21, 12, 2, 10, PAL.woodDark);
  p.fill(18, 22, 8, 5, PAL.wood);
  p.box(18, 22, 8, 5, PAL.ironDark);
  return art([p], 46);
};
GEN.anvil = () => {
  const p = new Px(32, 26);
  groundShadow(p, 16, 24, 11);
  p.fill(10, 18, 12, 6, PAL.ironDark);
  p.fill(13, 12, 6, 7, PAL.iron);
  p.fill(4, 6, 24, 6, PAL.iron);
  p.fill(4, 6, 24, 2, PAL.ironLit);
  p.poly([[28, 6], [32, 9], [28, 12]], PAL.iron);
  p.fill(4, 10, 24, 2, PAL.ironDark);
  p.outline(PAL.ink);
  return art([p], 25);
};
GEN.forge = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(44, 46);
    p.fill(4, 20, 36, 24, PAL.stone);
    p.box(4, 20, 36, 24, PAL.charcoal);
    for (let y = 22; y < 44; y += 6) for (let x = 5 + ((y / 6) % 2 ? 0 : 7); x < 39; x += 14) p.fill(x, y, 12, 5, PAL.slate);
    p.fill(10, 24, 24, 14, PAL.ink);
    p.ellipse(22, 34, 12, 7, withAlpha(PAL.ember, 0.35));
    flame(p, 22, 37, 1.5, (f / 4) * Math.PI * 2, [PAL.flameLit, PAL.flame, PAL.ember]);
    p.fill(12, 2, 20, 18, PAL.stone);
    p.fill(12, 2, 20, 3, PAL.fog);
    p.box(12, 2, 20, 18, PAL.charcoal);
    frames.push(p);
  }
  return art(frames, 45, 8);
};
GEN.grindstone = () => {
  const p = new Px(30, 30);
  groundShadow(p, 15, 28, 10);
  p.fill(4, 20, 22, 8, PAL.wood);
  p.fill(4, 20, 22, 2, PAL.plank);
  p.circle(15, 14, 10, PAL.stone);
  p.circle(15, 14, 8, PAL.fog);
  p.circle(15, 14, 2, PAL.ironDark);
  p.ellipse(11, 10, 3, 2, PAL.bone);
  p.outline(PAL.charcoal);
  return art([p], 29);
};
GEN.cauldron = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(32, 34);
    groundShadow(p, 16, 32, 11);
    p.ellipse(16, 22, 13, 11, PAL.ironDark);
    p.ellipse(16, 14, 12, 4, PAL.ink);
    p.ellipse(16, 14, 10, 3, mix(PAL.toxic, PAL.arcane, (f % 2) * 0.4));
    for (let i = 0; i < 3; i++) {
      p.circle(10 + ((i * 5 + f * 2) % 12), 13 - ((f + i) % 3), 1, PAL.toxic);
    }
    p.fill(4, 26, 24, 3, PAL.ironDark);
    p.fill(6, 29, 3, 4, PAL.ironDark);
    p.fill(23, 29, 3, 4, PAL.ironDark);
    frames.push(p);
  }
  return art(frames, 33, 5);
};
GEN.alchemy_table = (rng) => {
  const p = new Px(44, 34);
  p.fill(2, 14, 40, 6, PAL.wood);
  p.fill(2, 14, 40, 2, PAL.plank);
  p.fill(5, 20, 4, 13, PAL.woodDark);
  p.fill(35, 20, 4, 13, PAL.woodDark);
  const cols = [PAL.toxic, PAL.blood, PAL.arcaneLit, PAL.frost];
  for (let i = 0; i < 5; i++) {
    const x = 5 + i * 8;
    const h = rng.int(5, 9);
    p.fill(x, 14 - h, 4, h, withAlpha(cols[i % 4], 0.85));
    p.fill(x + 1, 14 - h, 1, h, PAL.white);
    p.fill(x + 1, 14 - h - 2, 2, 2, PAL.bone);
  }
  return art([p], 33);
};
GEN.bookshelf = (rng) => {
  const p = new Px(40, 48);
  p.fill(0, 0, 40, 48, PAL.woodDark);
  p.fill(2, 2, 36, 44, PAL.wood);
  for (let r = 0; r < 4; r++) {
    const y = 4 + r * 11;
    p.fill(3, y + 9, 34, 2, PAL.woodDark);
    let x = 4;
    while (x < 35) {
      const w = rng.int(2, 4);
      const h = rng.int(6, 9);
      p.fill(x, y + 9 - h, w, h, rng.pick([PAL.blood, PAL.arcane, PAL.leaf, PAL.gold, PAL.water, PAL.clay]));
      p.fill(x, y + 9 - h, 1, h, PAL.cloth);
      x += w + rng.int(0, 1);
    }
  }
  return art([p], 47);
};
GEN.bed = () => {
  const p = new Px(36, 52);
  p.fill(2, 4, 32, 46, PAL.woodDark);
  p.fill(4, 6, 28, 42, PAL.wood);
  p.fill(5, 10, 26, 36, PAL.blood);
  p.fill(5, 10, 26, 4, shade(PAL.blood, 1.2));
  p.fill(6, 8, 24, 10, PAL.cloth);
  p.fill(6, 8, 24, 3, PAL.white);
  p.fill(4, 4, 28, 4, PAL.plank);
  p.fill(4, 46, 28, 4, PAL.plank);
  p.outline(PAL.ink);
  return art([p], 51);
};
GEN.table = (rng) => {
  const p = new Px(46, 34);
  p.fill(2, 8, 42, 8, PAL.plank);
  p.fill(2, 8, 42, 2, PAL.plankLit);
  p.fill(2, 16, 42, 2, PAL.woodDark);
  p.fill(5, 18, 4, 14, PAL.wood);
  p.fill(37, 18, 4, 14, PAL.wood);
  if (rng.bool(0.8)) {
    p.fill(10, 3, 5, 6, PAL.bone); p.fill(10, 3, 5, 2, PAL.cloth);
    p.ellipse(26, 6, 5, 3, PAL.clay); p.ellipse(26, 5, 4, 2, PAL.flameLit);
  }
  return art([p], 33);
};
GEN.chair = () => {
  const p = new Px(22, 30);
  p.fill(4, 4, 14, 12, PAL.wood);
  p.fill(4, 4, 14, 2, PAL.plank);
  p.fill(4, 16, 14, 4, PAL.plank);
  p.fill(5, 20, 3, 8, PAL.woodDark);
  p.fill(14, 20, 3, 8, PAL.woodDark);
  return art([p], 29);
};
GEN.rug = () => {
  const p = new Px(56, 40);
  p.ellipse(28, 20, 26, 18, PAL.arcaneDark);
  p.ellipse(28, 20, 23, 15, PAL.blood);
  p.ellipse(28, 20, 16, 10, PAL.arcaneDark);
  p.ellipse(28, 20, 8, 5, PAL.gold);
  return art([p], 40);
};
GEN.banner = () => {
  const p = new Px(22, 44);
  p.fill(2, 2, 18, 3, PAL.wood);
  p.fill(3, 5, 16, 30, PAL.blood);
  p.fill(3, 5, 4, 30, shade(PAL.blood, 1.2));
  p.poly([[3, 35], [11, 42], [19, 35]], PAL.blood);
  p.circle(11, 16, 5, PAL.gold);
  p.circle(11, 16, 3, PAL.blood);
  p.fill(10, 11, 2, 11, PAL.gold);
  return art([p], 44);
};
GEN.market_stall = (rng) => {
  const p = new Px(64, 56);
  p.fill(4, 22, 3, 30, PAL.wood);
  p.fill(57, 22, 3, 30, PAL.wood);
  p.fill(6, 34, 52, 8, PAL.plank);
  p.fill(6, 34, 52, 2, PAL.plankLit);
  p.fill(6, 42, 52, 2, PAL.woodDark);
  for (let i = 0; i < 6; i++) {
    p.fill(2 + i * 10, 16, 10, 18, i % 2 ? PAL.blood : PAL.cloth);
  }
  p.poly([[0, 18], [32, 8], [64, 18], [64, 22], [32, 12], [0, 22]], PAL.woodDark);
  for (let i = 0; i < 7; i++) {
    const x = 9 + i * 7;
    p.fill(x, 30, 5, 4, rng.pick([PAL.clay, PAL.leaf, PAL.gold, PAL.blood, PAL.arcane]));
  }
  return art([p], 54);
};
GEN.notice_board = (rng) => {
  const p = new Px(40, 44);
  groundShadow(p, 20, 42, 12);
  p.fill(6, 24, 4, 18, PAL.wood);
  p.fill(30, 24, 4, 18, PAL.wood);
  p.fill(2, 4, 36, 24, PAL.wood);
  p.fill(4, 6, 32, 20, PAL.woodDark);
  p.poly([[0, 6], [20, 0], [40, 6], [40, 8], [20, 2], [0, 8]], PAL.plank);
  for (let i = 0; i < 4; i++) {
    const x = 6 + (i % 2) * 15;
    const y = 8 + Math.floor(i / 2) * 9;
    p.fill(x, y, 13, 7, PAL.cloth);
    for (let k = 0; k < 3; k++) p.fill(x + 2, y + 1 + k * 2, rng.int(4, 9), 1, PAL.ash);
    p.set(x + 6, y, PAL.blood);
  }
  return art([p], 43);
};
GEN.scarecrow = () => {
  const p = new Px(28, 46);
  groundShadow(p, 14, 43, 8);
  p.fill(12, 16, 4, 28, PAL.wood);
  p.fill(3, 20, 22, 3, PAL.wood);
  p.fill(8, 6, 12, 12, PAL.sand);
  p.fill(9, 10, 3, 2, PAL.ink);
  p.fill(16, 10, 3, 2, PAL.ink);
  p.fill(11, 14, 6, 1, PAL.ink);
  p.poly([[4, 7], [24, 7], [14, 0]], PAL.clay);
  p.fill(6, 22, 16, 14, PAL.blood);
  p.fill(6, 22, 16, 3, shade(PAL.blood, 1.2));
  for (let i = 0; i < 5; i++) p.fill(4 + i * 4, 36, 2, 5, PAL.sandDark);
  return art([p], 44);
};
GEN.beehive = () => {
  const p = new Px(26, 30);
  groundShadow(p, 13, 28, 9);
  for (let i = 0; i < 4; i++) p.ellipse(13, 8 + i * 6, 11 - i, 4, i % 2 ? PAL.sandLit : PAL.sand);
  p.ellipse(13, 26, 10, 3, PAL.sandDark);
  p.fill(11, 20, 4, 4, PAL.ink);
  return art([p], 29);
};

/* --- ruins / graves --- */

GEN.gravestone = (rng) => {
  const p = new Px(24, 30);
  groundShadow(p, 12, 28, 9);
  p.fill(5, 8, 14, 20, PAL.fog);
  p.ellipse(12, 8, 7, 6, PAL.fog);
  p.fill(6, 9, 12, 18, PAL.ash);
  p.ellipse(12, 9, 6, 5, PAL.ash);
  p.fill(11, 12, 2, 10, PAL.stone);
  p.fill(8, 15, 8, 2, PAL.stone);
  for (let i = 0; i < 6; i++) p.set(rng.int(6, 18), rng.int(10, 27), PAL.stone);
  p.outline(PAL.charcoal);
  return art([p], 29);
};
GEN.bone_pile = (rng) => {
  const p = new Px(28, 20);
  groundShadow(p, 14, 18, 10);
  for (let i = 0; i < 6; i++) {
    const x = rng.int(3, 20); const y = rng.int(9, 17);
    const len = rng.int(5, 10);
    p.fill(x, y, len, 2, PAL.bone);
    p.fill(x, y, 2, 2, PAL.cloth);
    p.fill(x + len - 2, y, 2, 2, PAL.cloth);
  }
  p.ellipse(9, 12, 4, 3, PAL.cloth);
  p.fill(7, 12, 2, 2, PAL.ink);
  p.fill(11, 12, 2, 2, PAL.ink);
  return art([p], 19);
};
GEN.pillar = (rng) => {
  const p = new Px(28, 56);
  groundShadow(p, 14, 53, 11);
  p.fill(4, 48, 20, 6, PAL.ash);
  p.fill(7, 8, 14, 40, PAL.fog);
  p.fill(8, 8, 5, 40, PAL.bone);
  p.fill(18, 8, 3, 40, PAL.ash);
  p.fill(4, 2, 20, 7, PAL.fog);
  p.fill(4, 2, 20, 2, PAL.bone);
  for (let i = 0; i < 8; i++) p.set(rng.int(8, 20), rng.int(10, 47), PAL.stone);
  p.outline(PAL.charcoal);
  return art([p], 55);
};
GEN.pillar_broken = (rng) => {
  const p = new Px(28, 34);
  groundShadow(p, 14, 31, 11);
  p.fill(4, 26, 20, 6, PAL.ash);
  p.fill(7, 8, 14, 18, PAL.fog);
  p.fill(8, 8, 5, 18, PAL.bone);
  p.poly([[7, 12], [14, 6], [21, 11], [21, 8], [7, 8]], PAL.ash);
  for (let i = 0; i < 8; i++) p.set(rng.int(8, 20), rng.int(9, 25), PAL.stone);
  p.outline(PAL.charcoal);
  return art([p], 33);
};
GEN.ruin_arch = (rng) => {
  const p = new Px(60, 56);
  groundShadow(p, 30, 53, 22);
  p.fill(2, 14, 12, 40, PAL.ash);
  p.fill(46, 14, 12, 40, PAL.ash);
  p.fill(4, 14, 5, 40, PAL.fog);
  p.fill(48, 14, 5, 40, PAL.fog);
  p.poly([[2, 16], [30, 0], [58, 16], [58, 22], [30, 8], [2, 22]], PAL.ash);
  p.poly([[2, 16], [30, 0], [30, 8], [2, 22]], PAL.fog);
  for (let i = 0; i < 20; i++) p.set(rng.int(3, 57), rng.int(2, 52), rng.bool() ? PAL.stone : PAL.moss);
  p.outline(PAL.charcoal);
  return art([p], 55);
};
GEN.rubble = (rng) => {
  const p = new Px(34, 22);
  groundShadow(p, 17, 20, 13);
  for (let i = 0; i < 9; i++) {
    const x = rng.int(2, 28); const y = rng.int(8, 18);
    p.fill(x, y, rng.int(3, 7), rng.int(2, 5), rng.pick([PAL.ash, PAL.fog, PAL.stone]));
  }
  return art([p], 21);
};
GEN.statue = (rng) => {
  const p = new Px(34, 56);
  groundShadow(p, 17, 53, 13);
  p.fill(5, 46, 24, 8, PAL.ash);
  p.fill(5, 46, 24, 2, PAL.fog);
  p.fill(12, 20, 10, 26, PAL.fog);
  p.fill(13, 20, 4, 26, PAL.bone);
  p.circle(17, 14, 6, PAL.fog);
  p.circle(16, 13, 4, PAL.bone);
  p.fill(6, 24, 6, 14, PAL.fog);
  p.fill(22, 22, 6, 12, PAL.fog);
  p.fill(24, 8, 3, 18, PAL.ash);
  p.poly([[22, 10], [29, 10], [25, 2]], PAL.ash);
  for (let i = 0; i < 12; i++) p.set(rng.int(6, 28), rng.int(10, 50), PAL.moss);
  p.outline(PAL.charcoal);
  return art([p], 55);
};
GEN.obelisk = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(30, 60);
    groundShadow(p, 15, 57, 12);
    p.fill(6, 52, 18, 6, PAL.charcoal);
    p.poly([[9, 52], [21, 52], [18, 6], [12, 6]], PAL.slate);
    p.poly([[9, 52], [15, 52], [14, 6], [12, 6]], PAL.stone);
    p.poly([[12, 6], [18, 6], [15, 0]], PAL.slate);
    const glow = 0.4 + 0.6 * Math.sin((f / 4) * Math.PI * 2);
    for (let i = 0; i < 4; i++) {
      p.fill(13, 14 + i * 9, 4, 4, withAlpha(PAL.arcaneLit, 0.3 + glow * 0.6));
    }
    frames.push(p);
  }
  return art(frames, 59, 4);
};
GEN.shrine = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(40, 48);
    groundShadow(p, 20, 45, 15);
    p.fill(6, 34, 28, 10, PAL.ash);
    p.fill(6, 34, 28, 2, PAL.fog);
    p.fill(10, 20, 20, 14, PAL.fog);
    p.fill(12, 22, 16, 10, PAL.charcoal);
    const glow = 0.45 + 0.55 * Math.sin((f / 4) * Math.PI * 2);
    p.ellipse(20, 20, 13, 13, withAlpha(PAL.holy, 0.06 + glow * 0.1));
    p.circle(20, 20, 5, withAlpha(PAL.holy, 0.5 + glow * 0.5));
    p.circle(20, 20, 3, PAL.white);
    p.poly([[6, 20], [20, 8], [34, 20]], PAL.ash);
    frames.push(p);
  }
  return art(frames, 47, 5);
};
GEN.altar = () => {
  const p = new Px(44, 36);
  groundShadow(p, 22, 33, 17);
  p.fill(4, 16, 36, 16, PAL.slate);
  p.fill(4, 16, 36, 3, PAL.stone);
  p.fill(2, 12, 40, 5, PAL.ash);
  p.fill(2, 12, 40, 2, PAL.fog);
  p.ellipse(22, 14, 8, 2, withAlpha(PAL.blood, 0.6));
  return art([p], 35);
};
GEN.coffin = () => {
  const p = new Px(28, 44);
  groundShadow(p, 14, 42, 11);
  p.poly([[6, 4], [22, 4], [26, 16], [22, 40], [6, 40], [2, 16]], PAL.woodDark);
  p.poly([[8, 6], [20, 6], [23, 16], [20, 38], [8, 38], [5, 16]], PAL.wood);
  p.fill(13, 12, 2, 14, PAL.iron);
  p.fill(9, 16, 10, 2, PAL.iron);
  p.outline(PAL.ink);
  return art([p], 43);
};
GEN.portal = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 6; f++) {
    const p = new Px(48, 56);
    const t = (f / 6) * Math.PI * 2;
    p.ellipse(24, 30, 20, 24, withAlpha(PAL.arcaneDark, 0.8));
    p.ellipse(24, 30, 17, 21, withAlpha(PAL.arcane, 0.85));
    for (let i = 0; i < 4; i++) {
      const r = 15 - i * 3.5;
      p.ellipse(24 + Math.sin(t + i) * 2, 30, r, r * 1.2, withAlpha(i % 2 ? PAL.arcaneLit : PAL.arcane, 0.55));
    }
    p.ellipse(24, 30, 5, 7, withAlpha(PAL.white, 0.8));
    for (let i = 0; i < 10; i++) {
      const a = t * 2 + (i / 10) * Math.PI * 2;
      p.set(24 + Math.cos(a) * 18, 30 + Math.sin(a) * 22, PAL.frost);
    }
    frames.push(p);
  }
  return art(frames, 54, 12);
};
GEN.stairs_down = () => {
  const p = new Px(48, 40);
  p.fill(2, 2, 44, 36, PAL.ink);
  for (let i = 0; i < 5; i++) {
    const inset = i * 4;
    p.fill(4 + inset, 4 + i * 6, 40 - inset * 2, 5, shade(PAL.rock, 1 - i * 0.14));
    p.fill(4 + inset, 4 + i * 6, 40 - inset * 2, 1, shade(PAL.rockLit, 1 - i * 0.14));
  }
  p.box(2, 2, 44, 36, PAL.rockDark);
  return art([p], 40);
};
GEN.stairs_up = () => {
  const p = new Px(48, 40);
  p.fill(2, 2, 44, 36, PAL.rockDark);
  for (let i = 0; i < 5; i++) {
    const inset = (4 - i) * 4;
    p.fill(4 + inset, 4 + i * 6, 40 - inset * 2, 5, shade(PAL.rock, 0.5 + i * 0.14));
    p.fill(4 + inset, 4 + i * 6, 40 - inset * 2, 1, shade(PAL.rockPale, 0.5 + i * 0.14));
  }
  p.box(2, 2, 44, 36, PAL.rockDark);
  return art([p], 40);
};
GEN.cave_mouth = (rng) => {
  const p = new Px(72, 56);
  p.ellipse(36, 44, 34, 16, PAL.rockDark);
  p.poly([[2, 54], [8, 24], [24, 8], [48, 8], [64, 24], [70, 54]], PAL.rock);
  p.poly([[6, 54], [12, 26], [26, 12], [46, 12], [60, 26], [66, 54]], PAL.rockDark);
  p.ellipse(36, 50, 22, 22, PAL.ink);
  p.ellipse(36, 52, 18, 18, PAL.void);
  for (let i = 0; i < 26; i++) p.set(rng.int(4, 68), rng.int(10, 40), rng.bool() ? PAL.rockLit : PAL.rockPale);
  for (let i = 0; i < 4; i++) {
    const x = 18 + i * 12;
    p.poly([[x, 30], [x + 3, 30], [x + 1, 38]], PAL.rockPale);
  }
  return art([p], 56);
};
GEN.door = () => {
  const p = new Px(32, 44);
  p.fill(2, 4, 28, 40, PAL.woodDark);
  p.fill(4, 6, 24, 36, PAL.wood);
  for (let i = 0; i < 4; i++) p.fill(4 + i * 6, 6, 1, 36, PAL.woodDark);
  p.fill(4, 12, 24, 2, PAL.iron);
  p.fill(4, 34, 24, 2, PAL.iron);
  p.circle(23, 24, 2, PAL.gold);
  p.poly([[2, 6], [16, 0], [30, 6]], PAL.stone);
  return art([p], 44);
};


GEN.trap_spikes = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(32, 32);
    p.fill(2, 2, 28, 28, PAL.rockDark);
    p.box(2, 2, 28, 28, PAL.ink);
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 4; k++) {
        const x = 5 + i * 7;
        const y = 5 + k * 7;
        const out = f >= 2 ? 6 : f === 1 ? 3 : 0;
        if (out === 0) { p.fill(x, y, 4, 4, PAL.ink); continue; }
        p.poly([[x, y + 5], [x + 2, y + 5 - out], [x + 4, y + 5]], PAL.steel);
        p.line(x + 2, y + 5 - out, x + 2, y + 5, PAL.white);
      }
    }
    frames.push(p);
  }
  return art(frames, 32, 3);
};

GEN.dungeon_pillar = (rng) => {
  const p = new Px(30, 56);
  groundShadow(p, 15, 53, 12);
  p.fill(4, 48, 22, 6, PAL.rockDark);
  p.fill(7, 6, 16, 42, PAL.rock);
  p.fill(8, 6, 6, 42, PAL.rockLit);
  p.fill(20, 6, 3, 42, PAL.rockDark);
  p.fill(4, 0, 22, 7, PAL.rock);
  p.fill(4, 0, 22, 2, PAL.rockPale);
  for (let i = 0; i < 10; i++) p.set(rng.int(8, 22), rng.int(8, 47), PAL.rockDark);
  p.outline(PAL.ink);
  return art([p], 55);
};

GEN.bone_throne = () => {
  const p = new Px(44, 56);
  groundShadow(p, 22, 53, 17);
  p.fill(8, 30, 28, 22, PAL.charcoal);
  p.fill(8, 30, 28, 3, PAL.slate);
  p.fill(11, 6, 22, 26, PAL.slate);
  p.fill(11, 6, 22, 3, PAL.stone);
  for (let i = 0; i < 5; i++) {
    p.fill(6 + i * 8, 2, 3, 10, PAL.cloth);
    p.circle(7 + i * 8, 2, 2.5, PAL.bone);
  }
  p.fill(4, 34, 5, 18, PAL.charcoal);
  p.fill(35, 34, 5, 18, PAL.charcoal);
  p.outline(PAL.ink);
  return art([p], 55);
};

GEN.magic_circle = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 6; f++) {
    const p = new Px(64, 64);
    const t = (f / 6) * Math.PI * 2;
    p.ellipse(32, 32, 28, 16, withAlpha(PAL.arcane, 0.18));
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      p.set(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 15, withAlpha(PAL.arcaneLit, 0.8));
      p.set(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 10, withAlpha(PAL.frost, 0.6));
    }
    for (let i = 0; i < 6; i++) {
      const a = t + (i / 6) * Math.PI * 2;
      p.fill(32 + Math.cos(a) * 22 - 1, 32 + Math.sin(a) * 13 - 1, 3, 3, PAL.white);
    }
    frames.push(p);
  }
  return art(frames, 64, 10);
};


/** Standing stone gate with a slow blue vortex in the middle — the travel network. */
GEN.waystone = (rng) => {
  const frames: Px[] = [];
  for (let f = 0; f < 8; f++) {
    const p = new Px(72, 88);
    const t = (f / 8) * Math.PI * 2;
    groundShadow(p, 36, 84, 26, 8);

    // rune-carved base
    p.ellipse(36, 82, 24, 7, PAL.slate);
    p.ellipse(36, 81, 21, 6, PAL.stone);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      p.set(36 + Math.cos(a) * 18, 81 + Math.sin(a) * 5, withAlpha(PAL.frost, 0.7));
    }

    // vortex
    const glow = 0.55 + 0.45 * Math.sin(t);
    p.ellipse(36, 48, 21, 27, withAlpha('#1b3a63', 0.92));
    for (let i = 5; i >= 1; i--) {
      const r = i * 4;
      p.ellipse(36 + Math.sin(t + i) * 1.5, 48, r, r * 1.3, withAlpha(i % 2 ? '#2f74c0' : '#4f9ce8', 0.32 + glow * 0.22));
    }
    p.ellipse(36, 48, 5, 7, withAlpha('#bfe4ff', 0.75 + glow * 0.25));
    for (let i = 0; i < 14; i++) {
      const a = t * 1.6 + (i / 14) * Math.PI * 2;
      const rr = 8 + ((i * 3 + f * 2) % 14);
      p.set(36 + Math.cos(a) * rr, 48 + Math.sin(a) * rr * 1.25, i % 3 === 0 ? '#bfe4ff' : '#4f9ce8');
    }

    // pillars and lintel
    for (const side of [-1, 1]) {
      const x = 36 + side * 24 - 6;
      p.fill(x, 16, 12, 66, PAL.slate);
      p.fill(x + (side < 0 ? 1 : 7), 16, 4, 66, PAL.stone);
      p.fill(x, 16, 12, 3, PAL.fog);
      for (let i = 0; i < 6; i++) p.fill(x + 2, 24 + i * 10, 8, 1, shade(PAL.slate, 0.7));
      for (let i = 0; i < 3; i++) p.set(x + 3 + (i % 3) * 2, 34 + i * 12, withAlpha('#4f9ce8', 0.5 + glow * 0.4));
    }
    p.poly([[6, 18], [66, 18], [60, 6], [12, 6]], PAL.slate);
    p.poly([[12, 6], [60, 6], [58, 9], [14, 9]], PAL.fog);
    p.fill(30, 10, 12, 5, withAlpha('#4f9ce8', 0.4 + glow * 0.5));
    for (let i = 0; i < 6; i++) p.set(rng.int(10, 62), rng.int(7, 17), PAL.stone);

    p.ellipse(36, 50, 34, 34, withAlpha('#4f9ce8', 0.05 + glow * 0.05));
    frames.push(p);
  }
  return art(frames, 84, 9);
};

const FALLBACK: Gen = () => {
  const p = new Px(24, 24);
  p.fillAll('#ff00ff');
  return art([p]);
};

export function getProp(name: string): PropArt {
  let a = cache.get(name);
  if (!a) {
    const gen = GEN[name] ?? FALLBACK;
    a = gen(new RNG(`prop:${name}`));
    cache.set(name, a);
  }
  return a;
}

export const PROP_NAMES = Object.keys(GEN);
