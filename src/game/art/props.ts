import { RNG } from '../core/rng';
import { PAL, mix, shade, withAlpha } from './palette';
import { Px, strip, type Canvas } from './pixel';
import { getAegeanProp } from './aegean';
import { CASINO_PROP_NAMES, getCasinoProp } from './casinoRoom';

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
  /**
   * Wind: rows above this one belong to the canopy and are drawn shifted by
   * whole pixels as the breeze moves them; the trunk below stays planted.
   */
  swayRow?: number;
  /** How far the canopy travels in a gust, in pixels. */
  swayAmp?: number;
  /** Small foliage that shivers when something walks through it. */
  rustle?: boolean;
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
  const x0 = cx - Math.floor(w / 2);
  p.fill(x0, baseY - h, w, h, dark);
  p.fill(x0 + 1, baseY - h, Math.max(1, w - 2), h, mix(dark, light, 0.5));
  p.fill(x0 + 1, baseY - h, 1, h, mix(dark, light, 0.8));
  p.fill(cx + Math.floor(w / 2) - 1, baseY - h, 1, h, shade(dark, 0.7));
  // bark stripes
  for (let y = baseY - h + 3; y < baseY - 3; y += 4) p.fill(x0 + 1 + ((y >> 2) % 2), y, 1, 2, shade(dark, 0.85));
  // flared roots
  p.fill(x0 - 2, baseY - 2, w + 4, 2, dark);
  p.fill(x0 - 1, baseY - 3, w + 2, 1, dark);
  p.set(x0 - 2, baseY - 2, mix(dark, light, 0.4));
  // a fork up into the canopy
  p.line(cx, baseY - h + 2, cx - w, baseY - h - 4, dark);
  p.line(cx + 1, baseY - h + 2, cx + w, baseY - h - 5, dark);
}

/**
 * A canopy built from leaf clusters rather than one blob: each cluster has
 * its own shadowed underside, its own lit crown toward the upper-left sun and
 * a rim of bright leaves, and the front clusters overlap the back ones. That
 * is what makes a tree read as foliage instead of as a lollipop.
 */
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
  const deep = shade(dark, 0.78);
  p.ellipse(cx, cy + ry * 0.12, rx * 0.92, ry * 0.9, dark);
  const clusters: Array<[number, number, number, number]> = [];
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const big = i % 3 === 0 ? 1.25 : i % 3 === 1 ? 0.8 : 0.62;
    clusters.push([cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.52, rx * 0.4 * big, ry * 0.48 * big]);
  }
  // two small clusters breaking the outline
  for (let i = 0; i < 2; i++) {
    const a = rng.range(-2.6, -0.5);
    clusters.push([cx + Math.cos(a) * rx * 0.92, cy + Math.sin(a) * ry * 0.85, rx * 0.2, ry * 0.24]);
  }
  clusters.push([cx - rx * 0.08, cy - ry * 0.18, rx * 0.5, ry * 0.52]);
  clusters.sort((q, r) => q[1] - r[1]);
  for (const [bx, by, crx, cry] of clusters) {
    p.ellipse(bx + 1, by + 1.5, crx, cry, deep);
    p.ellipse(bx, by + 1, crx, cry, shade(dark, 0.85));
    p.ellipse(bx, by, crx, cry, base);
    // the lit crown hugs the upper-left edge of the cluster, with ragged
    // leaf notches cut into it, rather than a bright spot in the middle
    p.ellipse(bx - crx * 0.18, by - cry * 0.2, crx * 0.8, cry * 0.72, mix(base, light, 0.5));
    p.ellipse(bx + crx * 0.12, by + cry * 0.14, crx * 0.72, cry * 0.66, base);
    for (let k = 0; k < 7; k++) {
      const t = -Math.PI * 0.5 - 1.2 + (k / 6) * 1.6;
      p.set(bx + Math.cos(t) * crx * 0.82, by + Math.sin(t) * cry * 0.8, light);
      if (k % 2) p.set(bx + Math.cos(t) * crx * 0.92, by + Math.sin(t) * cry * 0.9, mix(light, PAL.white, 0.2));
    }
    for (let k = 0; k < 4; k++) p.set(bx + rng.range(-crx * 0.7, crx * 0.7), by + cry * rng.range(0.55, 0.9), dark);
  }
  // leaf speckle, only on the foliage
  p.g.save();
  p.g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 30; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next());
    const x = cx + Math.cos(a) * rx * r;
    const y = cy + Math.sin(a) * ry * r;
    p.set(x, y, y < cy ? light : dark);
  }
  p.g.restore();
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
    // bark: a knot and a couple of fissures, so the trunk is wood not a bar
    const tw = Math.max(3, Math.round(w * 0.14));
    for (let i = 0; i < 3; i++) p.fill(cx - Math.floor(tw / 2) + 1 + (i % 2), h - 6 - i * 6 - rng.int(0, 3), 1, 3, shade(trunkDark, 0.8));
    p.fill(cx - 1, h - 3 - h * 0.25, 2, 2, shade(trunkDark, 0.7));
    canopy(p, cx, h * 0.34, w * 0.46, h * 0.3, dark, base, light, rng, 8);
    // branch stubs where the trunk goes up into the leaves, and the canopy's shade on it
    const ty = Math.round(h * 0.6);
    const bark = mix(trunkDark, trunkLight, 0.45);
    p.line(cx - 1, ty, cx - 5, ty - 5, bark); p.line(cx, ty, cx - 4, ty - 5, mix(trunkDark, trunkLight, 0.7));
    p.line(cx + 1, ty - 1, cx + 5, ty - 6, bark);
    p.fill(cx - Math.floor(tw / 2), ty, tw, 2, shade(trunkDark, 0.6));
    return { ...art([p], h - 3), swayRow: Math.round(h * 0.6), swayAmp: 1 };
  };
}

GEN.tree_oak = leafyTree(56, 72, PAL.leafDark, PAL.leaf, PAL.leafLit, PAL.woodDark, PAL.woodLit);
GEN.tree_maple = leafyTree(52, 68, '#6d2a1a', '#b5462f', '#e8763a', PAL.woodDark, PAL.woodLit);
GEN.tree_birch = (rng) => {
  const p = new Px(44, 64);
  const cx = 22;
  groundShadow(p, cx, 60, 12);
  p.fill(cx - 2, 26, 5, 34, PAL.cloth);
  p.fill(cx + 1, 26, 2, 34, PAL.bone);
  for (let i = 0; i < 7; i++) p.fill(cx - 2, 28 + i * 5, rng.int(2, 4), 1, PAL.charcoal);
  canopy(p, cx, 20, 19, 14, PAL.grassDark, PAL.grassLit, PAL.grassPale, rng, 7);
  return { ...art([p], 61), swayRow: 44, swayAmp: 1 };
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
  return { ...art([p], 73), swayRow: 56, swayAmp: 1 };
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
  return { ...art([p], 73), swayRow: 56, swayAmp: 1 };
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
  return { ...art([p], 65), swayRow: 40, swayAmp: 1 };
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
  return { ...art([p], 69), swayRow: 48, swayAmp: 2 };
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
  return { ...art([p], 68), swayRow: 34, swayAmp: 2 };
};
GEN.tree_ash = (rng) => {
  const p = new Px(52, 68);
  const cx = 26;
  groundShadow(p, cx, 64, 12);
  trunk(p, cx, 65, 28, 6, PAL.ink, PAL.charcoal);
  canopy(p, cx, 24, 22, 14, PAL.charcoal, PAL.slate, PAL.ash, rng, 7);
  for (let i = 0; i < 6; i++) p.set(cx + rng.int(-18, 18), 18 + rng.int(-8, 8), PAL.ember);
  return { ...art([p], 65), swayRow: 42, swayAmp: 1 };
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
  return { ...art(frames, 73, 5), swayRow: 46, swayAmp: 1 };
};

/* --- foliage / small scatter --- */

GEN.bush = (rng) => {
  const p = new Px(32, 28);
  groundShadow(p, 16, 25, 9);
  canopy(p, 16, 16, 13, 9, PAL.leafDark, PAL.leaf, PAL.leafLit, rng, 5);
  return { ...art([p], 26), swayRow: 16, swayAmp: 1, rustle: true };
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
  return { ...art([p], 26), swayRow: 16, swayAmp: 1, rustle: true };
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
  return { ...art([p], 29), swayRow: 18, swayAmp: 1, rustle: true };
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
  return { ...art([p], 23), swayRow: 14, swayAmp: 1, rustle: true };
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
  return { ...art([p], 15), swayRow: 10, swayAmp: 1, rustle: true };
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
    // speckle the stone, never the air round it: stray grains used to pick
    // up the outline and float beside the rock as little crosses
    p.g.save();
    p.g.globalCompositeOperation = 'source-atop';
    // the highlight lives on the stone too; unclipped it floated over the top
    p.fill(0, 0, w, Math.round(h * 0.55), mix(base, light, 0.35));
    p.ellipse(w * 0.4, h * 0.45, w * 0.22, h * 0.16, light);
    p.speckle(2, 2, w - 4, h - 4, [dark, light], 0.05, rng);
    p.g.restore();
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
  // Snow lies on the rock: the cap is the rock's own top, repainted, so it
  // follows the contour exactly, with a blue lip and a few drips below it.
  p.g.save();
  p.g.globalCompositeOperation = 'source-atop';
  p.fill(0, 0, b.fw, 22, PAL.snow);
  p.fill(0, 0, b.fw, 18, PAL.white);
  p.fill(0, 22, b.fw, 1, PAL.snowDark);
  for (const [x, len] of [[9, 3], [15, 2], [22, 4], [27, 2]]) p.fill(x, 23, 1, len, PAL.snowDark);
  for (const [x, len] of [[10, 2], [23, 3]]) p.fill(x, 23, 1, len, PAL.snow);
  p.g.restore();
  // and a drift banked against its foot
  p.ellipse(10, b.anchorY - 1, 7, 2, PAL.snow);
  p.ellipse(26, b.anchorY, 6, 1.5, PAL.snow);
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
  const p = new Px(36, 34);
  groundShadow(p, 17, 32, 13);
  p.ellipse(17, 23, 15, 9, PAL.sandDark);
  p.ellipse(17, 22, 14, 8, PAL.sand);
  p.ellipse(14, 19, 7, 3, PAL.sandLit);
  for (let i = 0; i < 26; i++) {
    const x = rng.int(3, 31); const y = rng.int(15, 30);
    p.fill(x, y, rng.int(2, 4), 1, rng.bool() ? PAL.sandLit : PAL.clay);
  }
  for (let i = 0; i < 6; i++) p.set(rng.int(4, 30), rng.int(29, 32), PAL.sandLit);
  // a pitchfork left standing in it
  p.line(27, 5, 23, 22, PAL.woodLit);
  p.line(28, 5, 24, 22, PAL.wood);
  p.fill(25, 3, 7, 1, PAL.iron);
  for (let i = 0; i < 3; i++) p.fill(25 + i * 3, 0, 1, 3, PAL.ironLit);
  return art([p], 33);
};

GEN.cart = (rng) => {
  const p = new Px(56, 40);
  groundShadow(p, 26, 37, 22);
  // shafts resting on the ground, then the bed
  p.line(44, 22, 55, 34, PAL.woodDark);
  p.line(44, 25, 54, 36, PAL.wood);
  p.fill(6, 16, 40, 14, PAL.wood);
  p.fill(6, 16, 40, 3, PAL.plank);
  p.box(6, 16, 40, 14, PAL.woodDark);
  for (let i = 0; i < 5; i++) p.fill(10 + i * 8, 17, 1, 12, PAL.woodDark);
  p.fill(6, 22, 40, 1, PAL.ironDark);
  // a load: sacks, a barrel and a crate of apples
  for (const [x, y] of [[10, 12], [17, 11], [13, 8]] as Array<[number, number]>) {
    p.ellipse(x, y, 5, 4, PAL.sand);
    p.ellipse(x - 1, y - 1, 3, 2, PAL.sandLit);
    p.fill(x - 1, y - 5, 2, 2, PAL.clay);
  }
  p.fill(24, 5, 10, 12, PAL.wood);
  p.ellipse(29, 5, 5, 2, PAL.plank);
  p.fill(23, 8, 12, 1, PAL.iron); p.fill(23, 13, 12, 1, PAL.iron);
  p.fill(35, 9, 9, 8, PAL.plank);
  p.box(35, 9, 9, 8, PAL.woodDark);
  for (let i = 0; i < 6; i++) p.set(36 + rng.int(0, 6), 9 + rng.int(-1, 1), rng.bool(0.7) ? PAL.blood : PAL.leafLit);
  // spoked wheels
  for (const wx of [14, 38]) {
    p.circle(wx, 31, 7, PAL.woodDark);
    p.circle(wx, 31, 5, PAL.wood);
    p.circle(wx, 31, 3, withAlpha(PAL.ink, 0.5));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI;
      p.line(wx - Math.cos(a) * 5, 31 - Math.sin(a) * 5, wx + Math.cos(a) * 5, 31 + Math.sin(a) * 5, PAL.woodLit);
    }
    p.circle(wx, 31, 1.5, PAL.iron);
    p.ellipse(wx, 31, 7, 7, 'rgba(0,0,0,0)');
  }
  return art([p], 38);
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
    flame(p, 10, 14, 1.25, (f / 4) * Math.PI * 2, [PAL.flameLit, PAL.flame, PAL.ember]);
    frames.push(p);
  }
  return art(frames, 38, 10);
};
GEN.brazier = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(30, 46);
    groundShadow(p, 15, 44, 9, 3);
    // a stone pedestal and a round, flared iron bowl on it
    p.fill(11, 32, 8, 12, PAL.stone);
    p.fill(11, 32, 2, 12, PAL.fog);
    p.fill(17, 32, 2, 12, PAL.slate);
    p.fill(9, 42, 12, 3, PAL.stone);
    p.fill(9, 42, 12, 1, PAL.fog);
    p.ellipse(15, 27, 8, 5, PAL.ironDark);
    p.ellipse(15, 26, 7, 4, PAL.iron);
    p.fill(8, 27, 14, 1, PAL.ironDark);
    p.ellipse(15, 22, 11, 3, PAL.ironDark);
    p.ellipse(15, 21.5, 10, 2, PAL.ironLit);
    for (const x of [10, 20]) p.fill(x, 23, 1, 6, PAL.ironDark);
    // a dome of coals above the rim
    p.ellipse(15, 20, 8, 2.5, PAL.emberDark);
    for (let i = 0; i < 9; i++) p.set(8 + i * 2 - (i % 2), 19 + (i % 3 === 0 ? 1 : 0), (i + f) % 3 === 0 ? PAL.flameLit : PAL.ember);
    flame(p, 15, 19, 1.5, (f / 4) * Math.PI * 2, [PAL.holy, PAL.flameLit, PAL.flame]);
    p.set(14 + (f % 3), 4 + (f % 2) * 2, PAL.flameLit);
    frames.push(p);
  }
  return art(frames, 44, 10);
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
    flame(p, 17, 27, 1.5, (f / 4) * Math.PI * 2, [PAL.flameLit, PAL.flame, PAL.ember]);
    frames.push(p);
  }
  return art(frames, 32, 9);
};
/**
 * A bridge lantern: an oak post with an iron hook, and an oil lamp hanging
 * from it that you can see burning. It stood on the ground on its own once,
 * which is nowhere a lantern would ever be put.
 */
GEN.lantern = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(22, 44);
    groundShadow(p, 8, 42, 6);
    p.fill(6, 6, 4, 36, PAL.wood);
    p.fill(6, 6, 1, 36, PAL.woodLit);
    p.fill(9, 6, 1, 36, PAL.woodDark);
    p.fill(5, 4, 6, 3, PAL.woodDark);
    p.fill(5, 30, 6, 2, PAL.ironDark);
    // the hook arm and the hanging lamp, swinging a pixel
    const sw = f === 1 ? 1 : f === 3 ? -1 : 0;
    p.fill(10, 8, 8, 2, PAL.ironDark);
    p.fill(17, 8, 1, 3, PAL.ironDark);
    const lx = 14 + sw;
    p.fill(lx + 2, 11, 1, 2, PAL.ironDark);
    p.fill(lx, 13, 5, 2, PAL.ironDark);
    p.fill(lx, 15, 5, 7, PAL.ironDark);
    p.fill(lx + 1, 16, 3, 5, f % 2 ? PAL.flameLit : PAL.flame);
    p.fill(lx + 2, 17, 1, 3, PAL.holy);
    p.fill(lx, 22, 5, 1, PAL.ironDark);
    frames.push(p);
  }
  return art(frames, 42, 3);
};

/* --- village / interior furniture --- */

GEN.well = (rng) => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const r2 = new RNG('well-stones');
    const p = new Px(44, 50);
    groundShadow(p, 22, 47, 17);
    p.ellipse(22, 36, 16, 9, PAL.stone);
    p.ellipse(22, 35, 13, 7, PAL.ink);
    p.ellipse(22, 36, 11, 5, PAL.water);
    // light on the water, drifting
    p.fill(15 + f * 2, 35, 3, 1, withAlpha(PAL.foam, 0.8));
    p.set(27 - f, 37, withAlpha(PAL.foam, 0.6));
    p.fill(6, 36, 32, 8, PAL.stone);
    p.ellipse(22, 44, 16, 5, PAL.stone);
    for (let i = 0; i < 5; i++) p.fill(7 + i * 6 + (i % 2), 37 + (i % 2) * 3, 5, 3, shade(PAL.stone, 1.15));
    for (let i = 0; i < 14; i++) p.set(r2.int(7, 37), r2.int(36, 47), r2.bool() ? PAL.slate : PAL.fog);
    for (let i = 0; i < 5; i++) p.set(r2.int(7, 37), r2.int(41, 47), PAL.moss);
    // posts, roof, crank
    p.fill(9, 10, 4, 28, PAL.wood);
    p.fill(31, 10, 4, 28, PAL.wood);
    p.fill(9, 10, 1, 28, PAL.woodLit);
    p.poly([[4, 12], [22, 2], [40, 12], [40, 15], [22, 6], [4, 15]], PAL.clay);
    p.poly([[4, 12], [22, 2], [22, 6], [4, 15]], mix(PAL.clay, PAL.flame, 0.3));
    for (let i = 0; i < 4; i++) p.line(6 + i * 4, 12 - i * 2, 6 + i * 4, 14 - i * 2, shade(PAL.clay, 0.75));
    p.fill(9, 17, 26, 3, PAL.woodDark);
    p.fill(35, 16, 3, 2, PAL.ironDark);
    const crank = [[38, 14], [40, 17], [38, 20], [36, 17]][f];
    p.line(36, 18, crank[0], crank[1], PAL.iron);
    // rope and a wooden bucket hanging over the shaft
    p.fill(21, 20, 1, 6, PAL.sand);
    p.fill(18, 26, 8, 6, PAL.wood);
    p.fill(18, 26, 8, 1, PAL.plank);
    p.fill(18, 28, 8, 1, PAL.ironDark);
    p.box(18, 26, 8, 6, PAL.woodDark);
    frames.push(p);
  }
  void rng;
  return art(frames, 48, 1.5);
};

GEN.anvil = () => {
  const p = new Px(32, 30);
  groundShadow(p, 16, 28, 11);
  // a stump block under the iron
  p.fill(9, 20, 14, 8, PAL.wood);
  p.fill(9, 20, 14, 2, PAL.woodLit);
  p.fill(9, 27, 14, 1, PAL.woodDark);
  p.fill(12, 16, 8, 5, PAL.ironDark);
  p.fill(13, 12, 6, 5, PAL.iron);
  p.fill(4, 7, 24, 6, PAL.iron);
  p.fill(4, 7, 24, 2, PAL.ironLit);
  p.fill(6, 7, 6, 1, PAL.steel);
  p.poly([[28, 7], [32, 10], [28, 13]], PAL.iron);
  p.fill(4, 11, 24, 2, PAL.ironDark);
  // a hammer resting on the face, tongs leaning on the block
  p.fill(15, 4, 8, 3, PAL.ironDark);
  p.fill(15, 4, 8, 1, PAL.iron);
  p.fill(8, 5, 8, 2, PAL.woodLit);
  p.line(23, 18, 28, 27, PAL.ironDark);
  p.line(25, 18, 29, 27, PAL.iron);
  p.set(23, 17, PAL.ironLit);
  p.outline(PAL.ink);
  return art([p], 29);
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
  for (let f = 0; f < 6; f++) {
    const p = new Px(34, 42);
    const t = (f / 6) * Math.PI * 2;
    groundShadow(p, 17, 40, 12);
    // a small fire under it
    for (const [x, y] of [[9, 38], [25, 38], [17, 39]]) p.fill(x - 3, y, 7, 2, PAL.woodDark);
    p.fill(12, 35, 10, 3, PAL.emberDark);
    for (let i = 0; i < 3; i++) p.fill(13 + i * 3, 33 - ((f + i) % 3), 2, 3, [PAL.flameLit, PAL.flame, PAL.ember][(f + i) % 3]);
    // flames licking up the sides of the pot between the legs
    for (const [x, h] of [[10, 5 + (f % 2)], [17, 4 + ((f + 1) % 3)], [23, 5 + ((f + 2) % 2)]]) {
      p.fill(x, 36 - h, 2, h, PAL.flame);
      p.fill(x, 36 - h + 1, 1, h - 2, PAL.flameLit);
      p.set(x, 36 - h - 1, PAL.holy);
    }
    for (const x of [6, 26]) { p.fill(x, 38, 4, 2, PAL.wood); p.set(x + (x < 10 ? 0 : 3), 38, PAL.plank); }
    p.ellipse(17, 26, 13, 10, PAL.ironDark);
    p.ellipse(13, 23, 4, 4, shade(PAL.iron, 0.9));
    p.fill(5, 30, 3, 6, PAL.ironDark);
    p.fill(26, 30, 3, 6, PAL.ironDark);
    p.fill(4, 36, 4, 1, PAL.stone); p.fill(26, 36, 4, 1, PAL.stone);
    p.ellipse(17, 18, 12, 4, PAL.ink);
    p.ellipse(17, 18, 10, 3, mix('#7a4a28', '#9a6a38', 0.5 + 0.5 * Math.sin(t)));
    // bubbles rise, swell and pop, each on its own clock
    for (let i = 0; i < 4; i++) {
      const k = ((f + i * 1.7) % 6) / 6;
      const bx = 10 + ((i * 5) % 14);
      if (k < 0.8) { p.set(bx, 18 - Math.round(k * 2), '#c89a5a'); if (k > 0.5) { p.set(bx + 1, 18 - Math.round(k * 2), '#c89a5a'); p.set(bx, 17 - Math.round(k * 2), PAL.sandLit); } }
      else { p.set(bx - 1, 16, '#9a6a38'); p.set(bx + 1, 15, '#9a6a38'); }
    }
    // steam curling off the brew
    for (let i = 0; i < 3; i++) {
      const yy = 13 - ((f * 2 + i * 4) % 12);
      p.fill(14 + i * 3 + Math.round(Math.sin(t + i) * 1.5), yy, 2, 2, withAlpha(PAL.cloth, yy > 6 ? 0.5 : 0.3));
    }
    p.fill(4, 16, 26, 2, PAL.ironDark);
    p.fill(4, 16, 26, 1, PAL.iron);
    // a ladle leaning on the rim
    p.line(24, 17, 30, 6, PAL.woodLit);
    frames.push(p);
  }
  return art(frames, 40, 6);
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
/** Grain, a lit top edge and a shaded bottom one — the minimum for wood to read as wood. */
function grain(p: Px, x: number, y: number, w: number, h: number, base: string, rng?: RNG, vertical = false) {
  p.fill(x, y, w, h, base);
  p.fill(x, y, w, 1, shade(base, 1.2));
  p.fill(x, y + h - 1, w, 1, shade(base, 0.7));
  p.fill(x, y, 1, h, shade(base, 1.1));
  p.fill(x + w - 1, y, 1, h, shade(base, 0.78));
  if (!rng) return;
  const lines = Math.max(2, Math.round((vertical ? w : h) / 4));
  for (let i = 0; i < lines; i++) {
    const c = rng.bool() ? shade(base, 0.84) : shade(base, 1.09);
    if (vertical) p.fill(x + rng.int(1, Math.max(1, w - 2)), y + 1, 1, h - 2, c);
    else p.fill(x + 1, y + rng.int(1, Math.max(1, h - 2)), w - 2, 1, c);
  }
}

GEN.bed = (rng) => {
  const p = new Px(36, 52);
  groundShadow(p, 18, 50, 15, 4);
  // frame, then a mattress inset into it so the bed has depth
  grain(p, 2, 4, 32, 46, PAL.woodDark, rng, true);
  grain(p, 4, 6, 28, 42, PAL.wood, rng, true);
  p.fill(5, 10, 26, 36, PAL.blood);
  p.fill(5, 10, 26, 2, shade(PAL.blood, 1.28));
  p.fill(5, 44, 26, 2, shade(PAL.blood, 0.62));
  p.fill(5, 10, 2, 36, shade(PAL.blood, 1.12));
  p.fill(29, 10, 2, 36, shade(PAL.blood, 0.72));
  // blanket folds
  for (const fy of [22, 30, 38]) {
    p.fill(6, fy, 24, 1, shade(PAL.blood, 0.74));
    p.fill(6, fy + 1, 24, 1, shade(PAL.blood, 1.12));
  }
  // pillow, dented in the middle
  p.fill(6, 8, 24, 10, PAL.cloth);
  p.fill(6, 8, 24, 2, PAL.white);
  p.fill(6, 16, 24, 2, shade(PAL.cloth, 0.72));
  p.fill(13, 11, 10, 4, shade(PAL.cloth, 0.86));
  // headboard and footboard posts
  grain(p, 3, 3, 30, 5, PAL.plank, rng);
  grain(p, 3, 45, 30, 5, PAL.plank, rng);
  for (const px of [2, 31]) {
    p.fill(px, 2, 3, 4, PAL.plankLit);
    p.fill(px, 46, 3, 4, PAL.plankLit);
  }
  p.outline(PAL.ink);
  return art([p], 51);
};
GEN.table = (rng) => {
  const p = new Px(46, 34);
  groundShadow(p, 23, 32, 18, 4);
  // top with a chamfered edge, then legs braced by a stretcher
  grain(p, 2, 8, 42, 8, PAL.plank, rng);
  p.fill(2, 8, 42, 1, PAL.plankLit);
  p.fill(2, 15, 42, 3, shade(PAL.woodDark, 0.9));
  p.fill(2, 15, 42, 1, PAL.woodDark);
  grain(p, 5, 18, 5, 14, PAL.wood, rng, true);
  grain(p, 36, 18, 5, 14, PAL.wood, rng, true);
  p.fill(9, 26, 28, 2, shade(PAL.wood, 0.8));
  if (rng.bool(0.8)) {
    // a cup and a candle so the table reads as used
    p.fill(10, 3, 5, 6, PAL.bone);
    p.fill(10, 3, 5, 2, PAL.cloth);
    p.fill(14, 5, 1, 3, shade(PAL.bone, 0.7));
    p.ellipse(26, 6, 5, 3, PAL.clay);
    p.ellipse(26, 5, 4, 2, PAL.flameLit);
    p.set(24, 5, PAL.white);
  }
  return art([p], 33);
};
GEN.chair = (rng) => {
  const p = new Px(22, 30);
  groundShadow(p, 11, 28, 8, 3);
  // slatted back, seat with a lip, tapered legs
  grain(p, 4, 4, 14, 3, PAL.plank, rng);
  for (const sx of [5, 10, 15]) p.fill(sx, 6, 2, 10, shade(PAL.wood, 0.92));
  p.fill(4, 4, 2, 13, shade(PAL.wood, 1.1));
  p.fill(16, 4, 2, 13, shade(PAL.wood, 0.76));
  grain(p, 3, 16, 16, 4, PAL.plank, rng);
  p.fill(3, 19, 16, 1, shade(PAL.woodDark, 0.9));
  p.fill(5, 20, 3, 8, PAL.wood);
  p.fill(5, 20, 1, 8, shade(PAL.wood, 1.1));
  p.fill(14, 20, 3, 8, shade(PAL.wood, 0.82));
  p.fill(5, 27, 12, 1, PAL.woodDark);
  return art([p], 29);
};
GEN.rug = (rng) => {
  const p = new Px(56, 40);
  // woven bands and a fringe, not concentric rings of flat colour
  p.ellipse(28, 20, 26, 18, PAL.arcaneDark);
  p.ellipse(28, 20, 24, 16, PAL.blood);
  p.ellipse(28, 20, 22, 14, shade(PAL.blood, 0.84));
  p.ellipse(28, 20, 17, 11, PAL.arcaneDark);
  p.ellipse(28, 20, 15, 9, shade(PAL.arcaneDark, 1.2));
  p.ellipse(28, 20, 9, 5, PAL.gold);
  p.ellipse(28, 20, 6, 3, shade(PAL.gold, 0.7));
  // weave texture and a worn centre
  for (let i = 0; i < 40; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0, 1);
    p.set(28 + Math.cos(a) * r * 24, 20 + Math.sin(a) * r * 16, rng.bool() ? 'rgba(255,240,210,0.10)' : 'rgba(10,8,16,0.14)');
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    p.set(28 + Math.cos(a) * 26.5, 20 + Math.sin(a) * 18.5, PAL.cloth);
  }
  return art([p], 40);
};
GEN.banner = () => {
  const p = new Px(22, 44);
  p.fill(2, 2, 18, 3, PAL.wood);
  p.fill(1, 2, 1, 3, PAL.gold); p.fill(20, 2, 1, 3, PAL.gold);
  p.fill(3, 5, 16, 30, PAL.blood);
  p.fill(3, 5, 4, 30, shade(PAL.blood, 1.2));
  p.poly([[3, 35], [11, 42], [19, 35]], PAL.blood);
  p.circle(11, 16, 5, PAL.gold);
  p.circle(11, 16, 3, PAL.blood);
  p.fill(10, 11, 2, 11, PAL.gold);
  return art([p], 44);
};
/**
 * A town standard on a proper pole: a stone foot, an ash staff with a gilt
 * finial, a crossbar, and a banner that moves in the wind. The gate banners
 * used to be the wall banner stood on the grass with nothing holding it up.
 */
GEN.banner_standard = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 6; f++) {
    const p = new Px(30, 70);
    const t = (f / 6) * Math.PI * 2;
    groundShadow(p, 15, 67, 8, 3);
    // stone foot and pole
    p.fill(10, 62, 10, 5, PAL.stone);
    p.fill(10, 62, 10, 1, PAL.fog);
    p.fill(11, 66, 8, 1, PAL.charcoal);
    p.fill(14, 6, 3, 57, PAL.wood);
    p.fill(14, 6, 1, 57, PAL.woodLit);
    p.fill(16, 6, 1, 57, PAL.woodDark);
    // finial
    p.fill(13, 4, 5, 2, PAL.gold);
    p.poly([[15.5, -1], [18, 4], [13, 4]], PAL.goldLit);
    // crossbar with little iron caps
    p.fill(5, 9, 21, 2, PAL.woodDark);
    p.fill(4, 9, 1, 2, PAL.gold); p.fill(26, 9, 1, 2, PAL.gold);
    // the cloth: each column ripples on its own phase, pinned at the bar
    for (let x = 0; x < 19; x++) {
      const k = x / 18;
      const wave = Math.round(Math.sin(t + x * 0.45) * 1.4 * (0.35 + k * 0.65));
      const len = 34 + Math.round(Math.sin(t + x * 0.3) * 1);
      const tip = x < 9 ? x : 18 - x;
      const bottom = 11 + len + Math.round(tip * 0.7);
      const c = x < 3 ? shade(PAL.blood, 1.2) : x > 15 ? shade(PAL.blood, 0.8) : PAL.blood;
      const shadeK = Math.sin(t + x * 0.45) > 0.4 ? 1.12 : Math.sin(t + x * 0.45) < -0.4 ? 0.84 : 1;
      p.fill(6 + x, 11 + wave * 0, 1, bottom - 11 + wave, shade(c, shadeK));
    }
    // a gilt border and the valley's device: a tower over a wave
    p.fill(6, 12, 19, 1, PAL.gold);
    p.fill(10, 20, 11, 11, shade(PAL.blood, 0.75));
    p.fill(13, 21, 5, 8, PAL.goldLit);
    p.fill(12, 21, 1, 2, PAL.goldLit); p.fill(18, 21, 1, 2, PAL.goldLit); p.fill(15, 20, 1, 2, PAL.goldLit);
    p.fill(15, 25, 1, 3, shade(PAL.blood, 0.6));
    for (let x = 0; x < 11; x++) p.set(10 + x, 32 + (x % 3 === 1 ? -1 : 0), PAL.gold);
    frames.push(p);
  }
  return art(frames, 66, 5);
};

GEN.market_stall = (rng) => {
  const frames: Px[] = [];
  const goods = new RNG('stall-goods');
  const wares: Array<[number, string, string]> = [];
  const kinds = ['bread', 'apples', 'cloth', 'cheese'];
  for (let i = 0; i < 4; i++) wares.push([9 + i * 12, kinds[(i + goods.int(0, 3)) % 4], goods.pick([PAL.arcane, '#3f6a5a', PAL.gold])]);
  for (let f = 0; f < 4; f++) {
    const p = new Px(64, 58);
    groundShadow(p, 32, 56, 26, 4);
    p.fill(4, 22, 3, 32, PAL.wood);
    p.fill(57, 22, 3, 32, PAL.wood);
    p.fill(6, 36, 52, 8, PAL.plank);
    p.fill(6, 36, 52, 2, PAL.plankLit);
    p.fill(6, 44, 52, 2, PAL.woodDark);
    p.fill(8, 46, 48, 8, withAlpha(PAL.ink, 0.35));
    // a baskets row under the counter
    for (let i = 0; i < 3; i++) { p.fill(10 + i * 16, 47, 10, 6, PAL.sandDark); p.fill(10 + i * 16, 47, 10, 1, PAL.sand); p.fill(11 + i * 16, 46, 8, 1, [PAL.blood, PAL.leafLit, PAL.flameLit][i]); }
    // the awning: striped, with a scalloped hem that lifts in the breeze
    for (let i = 0; i < 6; i++) {
      const lift = Math.round(Math.sin(f * 1.57 + i * 0.9) * 0.8);
      const c = i % 2 ? PAL.blood : PAL.cloth;
      p.fill(2 + i * 10, 16, 10, 18 - lift, c);
      p.fill(2 + i * 10, 16, 10, 2, shade(c, 1.1));
      p.ellipse(7 + i * 10, 34 - lift, 5, 2, c);
    }
    p.poly([[0, 18], [32, 8], [64, 18], [64, 22], [32, 12], [0, 22]], PAL.woodDark);
    p.fill(31, 5, 2, 4, PAL.gold);
    // a dark cloth on the counter so the wares read against it
    p.fill(7, 34, 50, 2, '#2e2536');
    // wares that are something: loaves, a pyramid of apples, rolled cloth, a cheese
    for (const [x, kind, col] of wares) {
      if (kind === 'bread') { p.ellipse(x + 4, 32, 4, 2.5, PAL.clay); p.fill(x + 1, 30, 6, 1, PAL.sandLit); p.set(x + 3, 31, PAL.sandDark); p.set(x + 5, 31, PAL.sandDark); }
      else if (kind === 'apples') { for (const [ax, ay] of [[0, 32], [3, 32], [6, 32], [1.5, 29.5], [4.5, 29.5], [3, 27]]) { p.fill(x + ax, ay, 2, 2, PAL.blood); p.set(x + ax, ay, PAL.flame); } p.set(x + 4, 26, PAL.leafLit); }
      else if (kind === 'cloth') { p.fill(x, 28, 8, 6, col); p.fill(x, 28, 8, 1, shade(col, 1.3)); p.fill(x + 7, 28, 1, 6, shade(col, 0.65)); p.fill(x, 31, 8, 1, shade(col, 0.8)); }
      else { p.ellipse(x + 4, 32, 4, 2.5, PAL.goldLit); p.poly([[x + 4, 32], [x + 8, 30], [x + 8, 33]], PAL.sandLit); p.fill(x + 1, 30, 6, 1, PAL.gold); }
    }
    frames.push(p);
  }
  void rng;
  return art(frames, 54, 1.2);
};

/**
 * A hanging trade sign on an iron bracket. One stands outside every building
 * in Ashvale you can actually use, under a name plate, so the town labels
 * itself instead of making the player try every door.
 */
GEN.shop_sign = (rng) => {
  const p = new Px(30, 44);
  groundShadow(p, 15, 42, 8);
  // post and scrolled bracket
  p.fill(4, 8, 4, 34, PAL.wood);
  p.fill(4, 8, 1, 34, PAL.woodLit);
  p.fill(7, 8, 1, 34, PAL.woodDark);
  p.fill(4, 6, 16, 3, PAL.ironDark);
  p.fill(4, 6, 16, 1, PAL.iron);
  p.fill(11, 9, 1, 3, PAL.ironDark);
  p.fill(18, 9, 1, 3, PAL.ironDark);
  // board, hung from two rings and swinging a little
  p.fill(8, 12, 18, 16, PAL.woodDark);
  p.fill(9, 13, 16, 14, PAL.wood);
  p.fill(9, 13, 16, 1, PAL.plankLit);
  p.fill(9, 26, 16, 1, shade(PAL.woodDark, 0.8));
  for (let i = 0; i < 4; i++) p.fill(9, 15 + i * 3, 16, 1, shade(PAL.wood, 0.9));
  // a gilt border and a blank device the nameplate above explains
  p.box(11, 15, 12, 10, PAL.gold);
  for (let i = 0; i < 5; i++) p.set(rng.int(10, 24), rng.int(14, 26), PAL.woodLit);
  p.outline(PAL.ink);
  return art([p], 43);
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
  const frames: Px[] = [];
  for (let f = 0; f < 8; f++) {
    const p = new Px(32, 48);
    groundShadow(p, 14, 45, 8);
    p.fill(12, 18, 4, 28, PAL.wood);
    p.fill(2, 22, 24, 3, PAL.wood);
    p.fill(8, 8, 12, 12, PAL.sand);
    p.fill(9, 12, 3, 2, PAL.ink);
    p.fill(16, 12, 3, 2, PAL.ink);
    for (let i = 0; i < 6; i++) p.set(10 + i, 16 + (i % 2), PAL.ink);
    p.poly([[3, 9], [25, 9], [14, 1]], PAL.clay);
    p.fill(3, 8, 22, 2, shade(PAL.clay, 0.8));
    p.fill(17, 4, 3, 3, PAL.blood);
    p.fill(6, 24, 16, 14, PAL.blood);
    p.fill(6, 24, 16, 3, shade(PAL.blood, 1.2));
    p.fill(9, 29, 4, 4, '#3f5a6a');
    p.fill(15, 32, 3, 3, PAL.sandDark);
    for (let i = 0; i < 5; i++) p.fill(4 + i * 4, 38, 2, 5, PAL.sandDark);
    for (const x of [1, 24]) { p.fill(x, 21, 2, 1, PAL.sandLit); p.fill(x + 1, 25, 1, 2, PAL.sandLit); }
    // a crow that uses the arm as a perch: pecks, looks round, flicks its tail
    const bx = 23;
    const by = 21;
    const peck = f === 2 || f === 5;
    const look = f >= 6;
    p.ellipse(bx, by - 2, 3, 2, PAL.ink);
    p.fill(bx - 4, by - 3, 2, 1, PAL.ink);
    if (f === 4) p.fill(bx - 5, by - 4, 2, 1, PAL.ink);
    const hx = bx + (look ? 1 : 2);
    const hy = by - 4 + (peck ? 2 : 0);
    p.fill(hx - 1, hy - 1, 3, 3, PAL.ink);
    p.fill(look ? hx - 2 : hx + 2, hy, 2, 1, PAL.gold);
    p.set(hx, hy - 1, PAL.fog);
    p.fill(bx - 1, by, 1, 1, PAL.gold); p.fill(bx + 1, by, 1, 1, PAL.gold);
    frames.push(p);
  }
  return art(frames, 46, 2);
};

GEN.beehive = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 6; f++) {
    const p = new Px(32, 36);
    const t = (f / 6) * Math.PI * 2;
    groundShadow(p, 16, 34, 9);
    p.fill(14, 28, 4, 6, PAL.woodDark);
    p.fill(9, 27, 14, 2, PAL.wood);
    for (let i = 0; i < 4; i++) p.ellipse(16, 11 + i * 5, 10 - i * 0.5, 3.5, i % 2 ? PAL.sandLit : PAL.sand);
    p.ellipse(16, 8, 6, 3, PAL.sandLit);
    for (let i = 0; i < 4; i++) p.fill(8 + i, 12 + i * 5, 16 - i * 2, 1, PAL.sandDark);
    p.fill(14, 22, 4, 3, PAL.ink);
    p.fill(15, 24, 2, 1, PAL.gold);
    // bees: a loose figure-eight in front of the door
    for (let i = 0; i < 4; i++) {
      const a = t + i * 1.6;
      const x = 16 + Math.sin(a) * (9 + i) ;
      const y = 17 + Math.sin(a * 2) * 4 - i;
      p.set(x, y, PAL.goldLit);
      p.set(x + 1, y, PAL.ink);
      p.set(x, y - 1, withAlpha(PAL.white, 0.6));
    }
    frames.push(p);
  }
  return art(frames, 34, 8);
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
/**
 * A waystone is a thing the valley put up a very long time ago, so it should
 * look like one. The old one was a glowing blue vortex under a lintel — a
 * sci-fi portal, which read as modern next to every other prop in the game
 * and made a fantasy world look like it had a teleporter in it.
 *
 * This is three leaning menhirs, weathered and lichened, with a carved face
 * and runes cut into the rock. The only light is what has collected in the
 * grooves of the carving: a slow amber pulse, the colour of the lamps and the
 * shrine braziers rather than a screen. Nothing hovers and nothing spins.
 */
GEN.waystone = (rng) => {
  const frames: Px[] = [];
  const STONE = '#6e6a63';
  const STONE_LIT = '#8a857c';
  const STONE_DARK = '#4a4741';
  const MOSS = '#5a6b46';
  const RUNE = '#d9a441';

  for (let f = 0; f < 8; f++) {
    const p = new Px(72, 88);
    const t = (f / 8) * Math.PI * 2;
    // Slow, shallow, and never off: an old carving catching the light, not a
    // machine idling.
    const glow = 0.45 + 0.3 * Math.sin(t);
    groundShadow(p, 36, 84, 27, 8);

    // trodden earth and a kerb of half-buried fieldstones
    p.ellipse(36, 82, 25, 7, '#4a4034');
    p.ellipse(36, 81, 21, 5, '#5a4e3f');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      p.ellipse(36 + Math.cos(a) * 21, 81 + Math.sin(a) * 5.5, 4, 3, STONE_DARK);
    }

    // The two flanking menhirs lean apart and taper hard toward the top, and
    // each one is a different height. Straight parallel shafts read as
    // columns — as architecture — and the whole point is that nobody built
    // this, they dragged three rocks here and stood them up.
    for (const side of [-1, 1]) {
      const bx = 36 + side * 21;
      const tall = side < 0 ? 54 : 49;
      const lean = side * 5;
      for (let row = 0; row < tall; row++) {
        const y = 80 - row;
        const k = row / tall;
        // a wide, rough foot narrowing to a broken-looking crown
        const w = 14 - k * k * 7 + Math.sin(row * 0.55 + side * 2) * 1.2;
        const x = bx + lean * k * k - w / 2;
        p.fill(x, y, w, 1, STONE);
        p.fill(x + (side < 0 ? 0.5 : w - 2), y, 1.5, 1, STONE_LIT);
        p.fill(x + (side < 0 ? w - 2 : 0.5), y, 1.5, 1, STONE_DARK);
      }
      // weathering: chips up the face, lichen collecting on the damp side
      for (let i = 0; i < 18; i++) p.set(bx + rng.range(-5, 5), rng.range(34, 79), STONE_DARK);
      for (let i = 0; i < 11; i++) p.set(bx + side * rng.range(2, 6), rng.range(60, 80), MOSS);
      for (let i = 0; i < 5; i++) p.set(bx + rng.range(-4, 4), rng.range(70, 80), '#6d7c55');
      // Cut strokes, not symbols: four short scores at an angle, the way a
      // chisel leaves them, with the light pooled in the grooves.
      for (let i = 0; i < 4; i++) {
        const ry = 80 - tall + 8 + i * 9;
        const rx = bx + lean * 0.4;
        for (let j = 0; j < 5; j++) {
          p.set(rx - 2 + j, ry - j * 0.6, withAlpha(RUNE, 0.3 + glow * 0.36));
        }
      }
    }

    // The centre stone stands further back and taller, and its crown is
    // deliberately broken and uneven — quarried and dressed by hand.
    for (let row = 0; row < 50; row++) {
      const y = 78 - row;
      const k = row / 50;
      // A gentle taper. Narrowing sharply near the top pinched the silhouette
      // into a head and shoulders, which is not what a menhir looks like.
      const w = 21 - k * 4;
      const x = 36 - w / 2 + Math.sin(row * 0.18) * 1.1;
      p.fill(x, y, w, 1, STONE);
      p.fill(x + 1, y, 2, 1, STONE_LIT);
      p.fill(x + w - 2, y, 1.5, 1, STONE_DARK);
    }
    // A chipped, sloping top cut into the shaft rather than sat on top of it,
    // so the crown belongs to the same rock.
    p.poly([[27, 29], [38, 25], [46, 30], [46, 34], [26, 34]], STONE);
    p.poly([[27, 29], [38, 25], [43, 28], [28, 31]], STONE_LIT);
    p.poly([[42, 26], [46, 30], [46, 35], [42, 33]], STONE_DARK);
    for (let i = 0; i < 28; i++) p.set(36 + rng.range(-9, 9), rng.range(32, 74), STONE_DARK);
    for (let i = 0; i < 10; i++) p.set(36 + rng.range(-9, 9), rng.range(62, 79), MOSS);

    // the carved face: a ring and a bar, the valley's mark for a road that
    // goes further than it looks
    p.ellipse(36, 50, 10, 10, withAlpha(STONE_DARK, 0.85));
    p.ellipse(36, 50, 7, 7, withAlpha(RUNE, 0.13 + glow * 0.15));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      p.set(36 + Math.cos(a) * 8, 50 + Math.sin(a) * 8, withAlpha(RUNE, 0.4 + glow * 0.4));
    }
    p.fill(31, 49, 10, 1.5, withAlpha(RUNE, 0.45 + glow * 0.4));
    p.fill(35, 44, 1.5, 12, withAlpha(RUNE, 0.35 + glow * 0.35));

    // A low, warm wash on the ground in front, like firelight off stone.
    p.ellipse(36, 74, 30, 12, withAlpha(RUNE, 0.035 + glow * 0.035));
    frames.push(p);
  }
  // Eight frames over nine seconds: slow enough that nothing about it reads
  // as powered.
  return art(frames, 84, 1.1);
};


GEN.lamp_post = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 2; f++) {
    const p = new Px(20, 52);
    groundShadow(p, 10, 49, 7);
    p.fill(7, 44, 6, 6, PAL.ironDark);
    p.fill(8, 12, 4, 34, PAL.ironDark);
    p.fill(9, 12, 1, 34, PAL.iron);
    p.fill(5, 8, 10, 3, PAL.ironDark);
    p.fill(6, 3, 8, 6, f === 0 ? PAL.flameLit : PAL.gold);
    p.box(5, 2, 10, 8, PAL.ironDark);
    p.poly([[4, 2], [16, 2], [10, -3]], PAL.ironDark);
    p.ellipse(10, 6, 13, 13, withAlpha(PAL.flameLit, 0.08));
    frames.push(p);
  }
  return art(frames, 50, 3);
};

GEN.bench = (rng) => {
  const p = new Px(42, 24);
  groundShadow(p, 21, 22, 16);
  p.fill(2, 10, 38, 5, PAL.plank);
  p.fill(2, 10, 38, 1, PAL.plankLit);
  p.fill(2, 15, 38, 1, PAL.woodDark);
  p.fill(2, 4, 38, 4, PAL.wood);
  p.fill(2, 4, 38, 1, PAL.plank);
  p.fill(5, 15, 3, 7, PAL.woodDark);
  p.fill(34, 15, 3, 7, PAL.woodDark);
  for (let i = 0; i < 6; i++) p.fill(rng.int(3, 38), rng.int(5, 14), rng.int(2, 4), 1, shade(PAL.wood, 0.85));
  return art([p], 23);
};

GEN.planter = (rng) => {
  const p = new Px(30, 26);
  groundShadow(p, 15, 24, 11);
  p.fill(3, 14, 24, 10, PAL.wood);
  p.fill(3, 14, 24, 2, PAL.plank);
  p.fill(3, 22, 24, 2, PAL.woodDark);
  p.fill(5, 11, 20, 4, PAL.soilDark);
  for (let i = 0; i < 12; i++) {
    const x = rng.int(5, 24);
    const h = rng.int(3, 8);
    for (let k = 0; k < h; k++) p.set(x, 12 - k, k > h - 2 ? PAL.grassPale : PAL.grass);
  }
  for (let i = 0; i < 3; i++) {
    const x = rng.int(6, 23);
    p.set(x, 6 + rng.int(0, 3), rng.pick([PAL.blood, PAL.gold, PAL.bone]));
  }
  p.outline(PAL.woodDark);
  return art([p], 25);
};

GEN.barrel_stack = (rng) => {
  const p = new Px(34, 40);
  groundShadow(p, 17, 37, 14);
  const barrel = (x: number, y: number) => {
    p.fill(x, y, 14, 18, PAL.wood);
    p.ellipse(x + 7, y, 7, 2.5, PAL.plank);
    p.fill(x - 1, y + 4, 16, 2, PAL.iron);
    p.fill(x - 1, y + 12, 16, 2, PAL.iron);
    for (let i = 0; i < 3; i++) p.fill(x + 3 + i * 4, y + 1, 1, 16, PAL.woodDark);
  };
  barrel(2, 20);
  barrel(18, 20);
  barrel(10, 4);
  for (let i = 0; i < 6; i++) p.set(rng.int(3, 30), rng.int(5, 36), PAL.woodDark);
  p.outline(PAL.woodDark);
  return art([p], 38);
};


/* ------------------------------------------------------------------ */
/* Casino                                                              */
/* ------------------------------------------------------------------ */

/**
 * A 5x7 bitmap alphabet, just wide enough to spell the one word the marquee
 * needs. The game has no pixel font — name plates are drawn by the renderer in
 * the UI layer — so a sign that has to read as *painted on the building*
 * carries its own letters.
 */
const MARQUEE_GLYPHS: Record<string, string[]> = {
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '10001', '01110'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
};

function glyph(p: Px, ch: string, x: number, y: number, color: string): void {
  const rows = MARQUEE_GLYPHS[ch];
  if (!rows) return;
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) if (row[rx] === '1') p.set(x + rx, y + ry, color);
  });
}

/** Pip suit marks, small enough to sit on a banner or a card corner. */
function spade(p: Px, cx: number, cy: number, s: number, color: string): void {
  p.poly([[cx, cy - s], [cx + s * 0.92, cy + s * 0.28], [cx, cy + s * 0.62], [cx - s * 0.92, cy + s * 0.28]], color);
  p.ellipse(cx - s * 0.42, cy + s * 0.18, s * 0.5, s * 0.46, color);
  p.ellipse(cx + s * 0.42, cy + s * 0.18, s * 0.5, s * 0.46, color);
  p.fill(cx - 1, cy + s * 0.3, 2, Math.max(1, s * 0.6), color);
  p.fill(cx - s * 0.45, cy + s * 0.85, s * 0.9, 1, color);
}

/**
 * The CASINO marquee. Everything that can glow does, and it glows in a chase:
 * the bulb ring runs a four-frame cycle so the sign reads as *running* from
 * across the square, the way the torches and lamp posts already do.
 *
 * It is a prop rather than part of the building because `bld:` sprites are
 * drawn without a frame index — buildings in this game are static by design,
 * and the animated pieces (signs, lamps, torches) always sit on top as props.
 */
GEN.casino_marquee = () => {
  const frames: Px[] = [];
  const W = 76;
  const H = 40;
  const word = 'CASINO';
  const glyphW = 6;
  const wordX = Math.round((W - (word.length * glyphW - 1)) / 2);
  const boardY = 10;
  const boardH = 24;

  for (let f = 0; f < 4; f++) {
    const p = new Px(W, H);

    // crown, standing clear above the board
    const cx = Math.round(W / 2);
    p.poly([[cx - 10, boardY + 1], [cx - 7, 3], [cx - 3, 8], [cx, 0], [cx + 3, 8], [cx + 7, 3], [cx + 10, boardY + 1]], PAL.gold);
    p.fill(cx - 10, boardY - 1, 20, 2, PAL.goldLit);
    p.set(cx, 2, PAL.white);
    p.set(cx - 7, 5, PAL.blood);
    p.set(cx + 7, 5, PAL.blood);

    // board
    p.fill(2, boardY, W - 4, boardH, PAL.woodDark);
    p.fill(3, boardY + 1, W - 6, boardH - 2, '#2a2432');
    p.box(3, boardY + 1, W - 6, boardH - 2, PAL.gold);
    p.box(5, boardY + 3, W - 10, boardH - 6, '#6d4a1c');

    // the word, gilt with a warm highlight above it
    const ty = boardY + 9;
    for (let i = 0; i < word.length; i++) glyph(p, word[i], wordX + i * glyphW, ty + 1, PAL.goldLit);
    for (let i = 0; i < word.length; i++) glyph(p, word[i], wordX + i * glyphW, ty, PAL.white);

    // chasing bulbs around the board
    const bulbs: Array<[number, number]> = [];
    for (let x = 4; x <= W - 6; x += 7) { bulbs.push([x, boardY + 1]); bulbs.push([x, boardY + boardH - 3]); }
    for (let y = boardY + 7; y <= boardY + boardH - 8; y += 7) { bulbs.push([3, y]); bulbs.push([W - 5, y]); }
    bulbs.forEach(([bx, by], i) => {
      const on = (i + f) % 4 !== 0;
      p.fill(bx, by, 2, 2, on ? PAL.flameLit : '#7a6434');
      if (on) p.ellipse(bx + 1, by + 1, 4, 4, withAlpha(PAL.flameLit, 0.16));
    });

    p.outline(PAL.ink);
    frames.push(p);
  }
  // The anchor is taller than the frame on purpose. The sign is pinned high on
  // the facade, well above the prop's own footing, and that footing sits just
  // *in front of* the building's so the y-sort draws it over the wall rather
  // than behind the roof.
  return art(frames, 61, 6);
};

GEN.casino_sign = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 2; f++) {
    const p = new Px(30, 44);
    groundShadow(p, 15, 42, 8);
    p.fill(4, 8, 4, 34, PAL.wood);
    p.fill(4, 8, 1, 34, PAL.woodLit);
    p.fill(7, 8, 1, 34, PAL.woodDark);
    p.fill(4, 6, 16, 3, PAL.ironDark);
    p.fill(4, 6, 16, 1, PAL.iron);
    p.fill(11, 9, 1, 3, PAL.ironDark);
    p.fill(18, 9, 1, 3, PAL.ironDark);
    p.fill(8, 12, 18, 16, PAL.woodDark);
    p.fill(9, 13, 16, 14, '#3a2430');
    p.fill(9, 13, 16, 1, '#5a3a48');
    p.box(10, 14, 14, 12, PAL.gold);
    spade(p, 17, 20, 5, f === 0 ? PAL.cloth : PAL.white);
    p.outline(PAL.ink);
    frames.push(p);
  }
  return art(frames, 43, 1.5);
};

/** The crimson spade banner that hangs either side of the casino door. */
GEN.casino_banner = () => {
  const p = new Px(16, 40);
  p.fill(1, 0, 14, 2, PAL.ironDark);
  p.fill(2, 2, 12, 30, PAL.blood);
  p.fill(2, 2, 1, 30, '#b03449');
  p.fill(13, 2, 1, 30, '#5e1220');
  p.poly([[2, 32], [8, 38], [14, 32]], PAL.blood);
  p.poly([[2, 32], [8, 38], [8, 32]], '#a62c3f');
  p.box(3, 4, 10, 26, PAL.gold);
  spade(p, 8, 14, 4, PAL.goldLit);
  p.outline(PAL.ink);
  return art([p], 39);
};

/**
 * A slot machine, built to the concept sheet: a crowned cabinet in crimson
 * and brass, a marquee of chasing bulbs, a gold-framed window with three
 * cream reels behind a red pay line, lit buttons, a side arrow either side of
 * the window, and a handle with a red ball on it.
 *
 * Eight frames. The reels tumble on their own, the marquee chases, the
 * buttons cycle and the handle rocks — a bank of these along a wall is the
 * loudest thing in the room, which is the point of a bank of these.
 */
GEN.slot_machine = () => {
  const frames: Px[] = [];
  const W = 32;
  const H = 54;
  const FR = 8;
  // What the reels show. Blocky stand-ins for the panel's real symbols — at
  // six pixels across, a cherry is a red dot and a seven is a red slash.
  const reelColors = [PAL.blood, PAL.gold, PAL.frost, PAL.toxic, PAL.flameLit, PAL.cloth];

  for (let f = 0; f < FR; f++) {
    const p = new Px(W, H);
    groundShadow(p, 16, 51, 12);

    // crown crest
    p.poly([[10, 12], [11, 4], [13, 8], [16, 2], [19, 8], [21, 4], [22, 12]], '#8a6a2c');
    p.poly([[11, 11], [12, 6], [14, 9], [16, 4], [18, 9], [20, 6], [21, 11]], PAL.gold);
    p.set(16, 4, PAL.white);
    p.set(12, 6, PAL.blood);
    p.set(20, 6, PAL.blood);

    // cabinet: brass carcass over a crimson body
    p.fill(3, 11, 26, 40, '#2a0e16');
    p.fill(4, 12, 24, 38, '#4e1723');
    p.fill(4, 12, 24, 2, '#6d2330');
    p.fill(4, 12, 1, 38, '#8e2131');
    p.fill(27, 12, 1, 38, '#1e0910');
    // walnut side panels, so a bank of these does not vanish into the carpet
    p.fill(4, 20, 2, 26, '#3b2415');
    p.fill(26, 20, 2, 26, '#2a1a0e');
    p.box(3, 11, 26, 40, PAL.gold);

    // marquee header with a four-step bulb chase
    p.fill(6, 14, 20, 6, '#4e1723');
    p.box(6, 14, 20, 6, '#8a6a2c');
    for (let i = 0; i < 5; i++) {
      const on = (i + f) % 4 !== 0;
      p.set(7 + i * 4, 15, on ? PAL.flameLit : '#7a6434');
      p.set(7 + i * 4, 18, on ? PAL.flameLit : '#7a6434');
    }
    p.fill(11, 16, 10, 2, f % 4 < 2 ? PAL.goldLit : PAL.gold);

    // the window: three cream reels behind a gold frame and a red pay line
    p.fill(6, 22, 20, 14, PAL.ink);
    p.box(6, 22, 20, 14, PAL.gold);
    p.box(7, 23, 18, 12, '#8a6a2c');
    for (let r = 0; r < 3; r++) {
      const rx = 8 + r * 6;
      p.fill(rx, 24, 5, 10, '#cfc5b4');
      p.fill(rx, 24, 5, 2, '#efe6d6');
      p.fill(rx, 32, 5, 2, '#b8ae9d');
      // the symbol on the pay line, scrolling at its own rate per reel
      const c = reelColors[(f * (r + 2) + r * 3) % reelColors.length];
      p.fill(rx + 1, 27, 3, 4, c);
      p.set(rx + 1, 27, PAL.white);
    }
    p.fill(6, 29, 20, 1, withAlpha(PAL.blood, 0.7));

    // the arrows either side of the window
    for (const [ax, dir] of [[4, 1], [27, -1]] as Array<[number, number]>) {
      p.poly([[ax, 26], [ax + dir * 2, 29], [ax, 32]], (f % 4) < 2 ? PAL.goldLit : '#8a6a2c');
    }

    // button deck
    p.fill(7, 38, 18, 7, '#2a1220');
    p.fill(7, 38, 18, 1, '#4a2434');
    for (let i = 0; i < 3; i++) {
      const on = i === f % 3;
      p.fill(9 + i * 6, 40, 4, 3, on ? PAL.flameLit : PAL.ember);
      if (on) p.ellipse(11 + i * 6, 41, 5, 4, withAlpha(PAL.flameLit, 0.2));
    }

    // coin tray, with a couple of winnings still sitting in it
    p.fill(7, 46, 18, 4, '#2a1220');
    p.fill(7, 46, 18, 1, '#150a12');
    for (let i = 0; i < 3; i++) p.ellipse(10 + i * 5, 48, 1.8, 1.2, PAL.gold);

    // the handle: a brass rod with a red ball, rocking through the cycle
    const pull = [0, 1, 2, 3, 3, 2, 1, 0][f];
    p.fill(29, 22 + pull, 2, 11, PAL.ironDark);
    p.fill(29, 22 + pull, 1, 11, PAL.iron);
    p.ellipse(30, 21 + pull, 2.6, 2.6, '#6d1a22');
    p.ellipse(30, 21 + pull, 2, 2, '#b8323a');
    p.set(29, 20 + pull, '#e8757a');

    p.outline(PAL.ink);
    frames.push(p);
  }
  return art(frames, 51, 7);
};

/**
 * The poker table: a padded leather rail with brass studs, bright baize
 * inside it, the board dealt out along the betting arc, a dealer button and
 * money stacked in front of three of the seats.
 */
GEN.poker_table = () => {
  const p = new Px(80, 46);
  groundShadow(p, 40, 44, 32);

  // pedestal, so the table is standing on something
  p.fill(34, 32, 12, 10, '#2a1a0e');
  p.ellipse(40, 42, 13, 3.5, '#241408');

  // rail: dark padded leather, lit along its top edge
  p.ellipse(40, 27, 39, 17, '#241408');
  p.ellipse(40, 26, 38, 16, '#4a2b1a');
  p.ellipse(40, 25, 37, 15, '#6a4430');
  p.ellipse(40, 24, 36, 14, '#8a5c40');
  // brass studs around the rail
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    p.set(40 + Math.cos(a) * 34, 25 + Math.sin(a) * 13.5, PAL.gold);
  }

  // baize
  p.ellipse(40, 25, 31, 11.5, '#17452a');
  p.ellipse(40, 24, 31, 11.5, '#1f5a34');
  p.ellipse(40, 23.5, 29, 10.5, '#27713f');
  p.ellipse(40, 22, 25, 8, '#2d8049');
  // the betting arc, stitched into the felt
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    p.set(40 + Math.cos(a) * 27, 24 + Math.sin(a) * 9.5, '#19502e');
  }

  // the board: five cards face up along the middle
  for (let i = 0; i < 5; i++) {
    const cx = 25 + i * 7;
    p.fill(cx, 19, 6, 8, '#0f0d14');
    p.fill(cx, 19, 6, 7, PAL.white);
    p.fill(cx, 19, 6, 1, PAL.cloth);
    const red = i === 1 || i === 3;
    p.set(cx + 1, 21, red ? PAL.blood : PAL.ink);
    p.fill(cx + 2, 23, 2, 2, red ? PAL.blood : PAL.ink);
  }

  // the dealer button, and the pot pushed up behind the board
  p.ellipse(19, 24, 3, 2, PAL.bone);
  p.ellipse(19, 23.4, 2.2, 1.4, PAL.white);
  const stack = (x: number, y: number, c: string, n: number) => {
    for (let i = 0; i < n; i++) {
      p.fill(x, y - i * 2, 7, 2, i % 2 === 0 ? c : shade(c, 0.72));
      p.set(x, y - i * 2, shade(c, 0.55));
      p.set(x + 6, y - i * 2, shade(c, 0.55));
    }
    p.ellipse(x + 3.5, y - n * 2 + 1, 3.5, 1.4, shade(c, 1.3));
  };
  // the pot, pushed up in front of the board
  stack(37, 33, PAL.gold, 3);
  // and the players' own money, in front of three of the seats
  stack(17, 30, PAL.blood, 4);
  stack(56, 30, PAL.frost, 3);
  stack(47, 32, '#3c7a45', 2);
  p.outline(PAL.ink);
  return art([p], 44);
};

/**
 * The blackjack table: a half-round counter with the dealer standing at the
 * flat side, three betting circles laid out on the arc, and the shoe within
 * reach of the dealer's right hand.
 */
GEN.card_table = () => {
  const p = new Px(76, 40);
  groundShadow(p, 38, 38, 30);

  // the front panel of the counter, facing the players
  p.fill(5, 22, 66, 14, '#3b2415');
  p.fill(5, 22, 66, 2, '#6a4430');
  p.fill(5, 34, 66, 2, '#241408');
  for (let x = 10; x < 66; x += 11) {
    p.box(x, 25, 8, 8, '#2a1a0e');
    p.fill(x + 1, 26, 6, 6, '#46291d');
  }
  p.fill(5, 33, 66, 1, PAL.gold);

  // the top: a half-round rail with baize inside it
  p.ellipse(38, 21, 35, 14, '#241408');
  p.ellipse(38, 20, 34, 13, '#6a4430');
  p.ellipse(38, 19, 33, 12, '#8a5c40');
  p.ellipse(38, 20, 29, 10, '#17452a');
  p.ellipse(38, 19, 29, 10, '#27713f');
  p.ellipse(38, 18, 26, 8, '#2d8049');
  // the arc the bets sit on
  for (let i = 0; i < 30; i++) {
    const a = Math.PI * (0.06 + (i / 29) * 0.88);
    p.set(38 - Math.cos(a) * 24, 19 + Math.sin(a) * 7, '#19502e');
  }

  // three betting circles, two of them covered
  for (let i = 0; i < 3; i++) {
    const bx = 24 + i * 14;
    p.ellipse(bx, 23, 4, 2, '#19502e');
    if (i !== 1) {
      p.fill(bx - 3, 21, 6, 2, i === 0 ? PAL.blood : PAL.frost);
      p.fill(bx - 3, 19, 6, 2, i === 0 ? '#6d1a22' : '#2f6f93');
    }
  }
  // the dealer's own two cards: one up, one face down under it
  p.fill(32, 11, 7, 9, '#0f0d14');
  p.fill(32, 11, 7, 8, PAL.white);
  p.fill(32, 11, 7, 1, PAL.cloth);
  p.set(33, 13, PAL.blood);
  p.fill(34, 15, 2, 2, PAL.blood);
  p.fill(40, 12, 7, 8, '#0f0d14');
  p.fill(40, 12, 7, 7, '#6d2330');
  for (let y = 13; y < 18; y++) for (let x = 41; x < 46; x++) if ((x + y) % 2 === 0) p.set(x, y, '#8c3040');

  // the shoe, a wedge with a stack of cards showing at its mouth
  p.poly([[55, 18], [69, 18], [69, 9], [61, 9]], '#2a1220');
  p.poly([[56, 17], [68, 17], [68, 10], [62, 10]], '#4a2434');
  p.fill(57, 12, 9, 5, PAL.bone);
  p.fill(57, 12, 9, 1, PAL.cloth);
  p.fill(55, 17, 14, 1, PAL.gold);

  // the discard tray, low and brass-lipped
  p.fill(8, 14, 10, 4, '#2a1220');
  p.fill(9, 13, 8, 2, PAL.bone);
  p.fill(8, 13, 10, 1, PAL.gold);
  p.outline(PAL.ink);
  return art([p], 38);
};

/** Loose chips and a lone ace, scattered as dressing. */
GEN.chip_stack = (rng) => {
  const p = new Px(22, 18);
  groundShadow(p, 11, 16, 8);
  const stack = (x: number, y: number, c: string, n: number) => {
    for (let i = 0; i < n; i++) p.fill(x, y - i * 2, 7, 2, i % 2 === 0 ? c : shade(c, 0.72));
    p.ellipse(x + 3, y - n * 2 + 1, 3.5, 1.4, shade(c, 1.3));
  };
  stack(2, 14, PAL.blood, rng.int(2, 4));
  stack(11, 14, PAL.frost, rng.int(2, 3));
  p.fill(16, 8, 5, 7, PAL.white);
  spade(p, 18, 11, 2, PAL.ink);
  p.outline(PAL.ink);
  return art([p], 17);
};

/**
 * The casino's own street lamp. Same iron post as `lamp_post` so it belongs to
 * the town, but it burns cold blue-white instead of hearth-orange — the one
 * building in Ashvale that is not lit by a fire.
 */
/**
 * A padded stool. Deliberately much smaller than `chair`: a ring of them
 * around a card table has to read as seating without swallowing the table or
 * the lane the player walks up.
 */
GEN.casino_stool = (rng) => {
  const p = new Px(18, 20);
  groundShadow(p, 9, 18, 7);
  // legs
  p.fill(4, 12, 2, 6, PAL.woodDark);
  p.fill(12, 12, 2, 6, PAL.woodDark);
  p.fill(8, 13, 2, 5, shade(PAL.woodDark, 0.85));
  p.fill(4, 15, 10, 1, PAL.wood);
  // padded seat
  p.ellipse(9, 11, 8, 4, PAL.woodDark);
  p.ellipse(9, 10, 7.5, 3.6, '#6d2330');
  p.ellipse(9, 9.4, 6.5, 3, '#8e2131');
  p.ellipse(7, 8.6, 2.6, 1.2, '#a63c4a');
  for (let i = 0; i < 3; i++) p.set(rng.int(5, 13), rng.int(8, 11), '#5e1220');
  p.fill(2, 10, 14, 1, PAL.gold);
  p.outline(PAL.ink);
  return art([p], 19);
};

GEN.casino_lamp = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 2; f++) {
    const p = new Px(20, 52);
    groundShadow(p, 10, 49, 7);
    p.fill(7, 44, 6, 6, PAL.ironDark);
    p.fill(8, 12, 4, 34, PAL.ironDark);
    p.fill(9, 12, 1, 34, PAL.iron);
    p.fill(5, 8, 10, 3, PAL.ironDark);
    p.fill(6, 3, 8, 6, f === 0 ? PAL.cloth : PAL.white);
    p.box(5, 2, 10, 8, PAL.ironDark);
    p.poly([[4, 2], [16, 2], [10, -3]], PAL.ironDark);
    p.ellipse(10, 6, 14, 14, withAlpha(PAL.cloth, 0.09));
    frames.push(p);
  }
  return art(frames, 50, 2.5);
};

const FALLBACK: Gen = () => {
  const p = new Px(24, 24);
  p.fillAll('#ff00ff');
  return art([p]);
};

export function getProp(name: string): PropArt {
  const aegean = getAegeanProp(name);
  if (aegean) return aegean;
  const gilded = getCasinoProp(name);
  if (gilded) return gilded;
  let a = cache.get(name);
  if (!a) {
    const gen = GEN[name] ?? FALLBACK;
    a = gen(new RNG(`prop:${name}`));
    cache.set(name, a);
  }
  return a;
}

export const PROP_NAMES = [...Object.keys(GEN), ...CASINO_PROP_NAMES];
