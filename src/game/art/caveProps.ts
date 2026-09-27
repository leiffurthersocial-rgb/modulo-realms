import { RNG } from '../core/rng';
import { PAL, mix, shade } from './palette';
import { Px, strip } from './pixel';
import type { PropArt } from './props';

/**
 * Cave dressing: what makes a mine read as a place things live in rather
 * than a brown floor with torches on it. Everything here is scenery laid by
 * `decorateCave` in `world/dungeons.ts`; what moves on its own — drips,
 * spores, glints, bats, rats, dust — is `core/caveLife.ts`.
 *
 * `getProp` asks here first, the same way it asks the casino and Achaea.
 */

function art(frames: Px[], anchorY: number, fps = 4): PropArt {
  return { canvas: strip(frames), fw: frames[0].w, fh: frames[0].h, frames: frames.length, fps, anchorY };
}

const GEN: Record<string, (rng: RNG) => PropArt> = {};

/* ---------------------------- water ---------------------------- */

const puddle = (w: number, h: number) => (rng: RNG) => {
  const p = new Px(w, h);
  const cx = w / 2, cy = h / 2;
  // a wet dark rim, the pool, a lighter band where the ceiling light lands
  p.ellipse(cx, cy, w / 2 - 1, h / 2 - 1, 'rgba(10,8,16,0.35)');
  p.ellipse(cx, cy, w / 2 - 2, h / 2 - 2, PAL.deep);
  p.ellipse(cx + 1, cy + 1, w / 2 - 4, h / 2 - 3, mix(PAL.deep, PAL.water, 0.6));
  p.line(Math.round(cx - w / 5), Math.round(cy - 1), Math.round(cx + w / 8), Math.round(cy - 1), PAL.waterLit);
  p.set(Math.round(cx + w / 5), Math.round(cy + 1), PAL.foam);
  // pebbles at the edge
  for (let i = 0; i < 4; i++) {
    const a = rng.range(0, Math.PI * 2);
    p.set(Math.round(cx + Math.cos(a) * (w / 2 - 1)), Math.round(cy + Math.sin(a) * (h / 2 - 1)), PAL.rockLit);
  }
  return art([p], Math.round(cy + 4));
};
GEN.cave_puddle_a = puddle(34, 14);
GEN.cave_puddle_b = puddle(24, 11);

/* ---------------------------- growth ---------------------------- */

/** Pale stems under caps that breathe light in and out. */
GEN.cave_glowshroom = (rng) => {
  const caps = [0, 1, 2, 3, 4].map((i) => ({ x: 5 + i * 5 + rng.int(-1, 1), h: rng.int(4, 11), r: rng.int(2, 5) }));
  caps.sort((a, b) => b.h - a.h);
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const glow = [0, 0.35, 0.7, 0.35][f];
    const p = new Px(32, 24);
    p.ellipse(16, 22, 13, 2, 'rgba(10,8,16,0.3)');
    for (const c of caps) {
      const top = 22 - c.h;
      p.fill(c.x, top, 1, c.h, mix(PAL.bone, PAL.fog, 0.3));
      p.set(c.x + 1, top + 2, shade(PAL.bone, 0.7));
      // cap: dark rim, lit dome, a bright crown
      p.ellipse(c.x, top, c.r, Math.max(1, c.r - 1), mix('#16504d', '#2f8f86', glow));
      p.fill(c.x - c.r + 1, top - 1, c.r * 2 - 1, 1, mix('#2f8f86', PAL.frost, 0.4 + glow * 0.6));
      p.fill(c.x - 1, top - Math.max(1, c.r - 1), 3, 1, mix(PAL.frost, '#e6fffb', glow));
      p.set(c.x - Math.floor(c.r / 2), top, '#e6fffb');
    }
    frames.push(p);
  }
  return art(frames, 23, 2.5);
};

/** Amethyst growing out of the rock. The glints are `caveLife`'s. */
GEN.cave_crystal = (rng) => {
  const p = new Px(26, 30);
  p.ellipse(13, 28, 10, 2, 'rgba(10,8,16,0.35)');
  p.ellipse(13, 27, 9, 3, PAL.rockDark);
  const shards: Array<[number, number, number]> = [[13, 4, 4], [7, 12, 3], [19, 10, 3], [10, 16, 2], [17, 17, 2]];
  for (const [x, top, hw] of shards) {
    const base = 27;
    p.poly([[x - hw, base], [x, top], [x + hw, base]], PAL.arcaneDark);
    p.poly([[x - hw + 1, base], [x, top + 2], [x, base]], PAL.arcane);
    p.line(x, top + 2, x, base - 2, PAL.arcaneLit);
    p.set(x, top + 1, PAL.white);
  }
  for (let i = 0; i < 3; i++) p.set(rng.int(6, 20), rng.int(24, 27), PAL.rockLit);
  return art([p], 28);
};

/** A web across a corner, spun by something that is still about. */
const web = (flip: boolean) => () => {
  const p = new Px(26, 24);
  const c = 'rgba(214,208,220,0.55)';
  const hub = { x: 3, y: 2 };
  const ends: Array<[number, number]> = [[25, 1], [24, 9], [18, 17], [9, 23], [1, 22]];
  for (const [x, y] of ends) p.line(hub.x, hub.y, x, y, c);
  for (const r of [5, 9, 14, 19]) {
    let prev: [number, number] | null = null;
    for (const [x, y] of ends) {
      const d = Math.hypot(x - hub.x, y - hub.y);
      const pt: [number, number] = [Math.round(hub.x + (x - hub.x) * (r / d)), Math.round(hub.y + (y - hub.y) * (r / d))];
      if (prev) p.line(prev[0], prev[1], pt[0], pt[1], c);
      prev = pt;
    }
  }
  p.set(11, 8, PAL.charcoal); p.set(12, 8, PAL.charcoal); p.set(11, 9, PAL.ink);
  return art([flip ? p.mirrored() : p], 24);
};
GEN.cave_web_l = web(false);
GEN.cave_web_r = web(true);

/* ---------------------------- floor ---------------------------- */

const pebbles = (n: number) => (rng: RNG) => {
  const p = new Px(30, 14);
  for (let i = 0; i < n; i++) {
    const x = rng.int(2, 27), y = rng.int(3, 11), w = rng.int(1, 3);
    p.fill(x, y + 1, w, 1, 'rgba(10,8,16,0.4)');
    p.fill(x, y, w, 1, rng.bool(0.3) ? PAL.rockLit : PAL.rock);
    if (w > 1) p.set(x, y, PAL.rockPale);
  }
  return art([p], 10);
};
GEN.cave_pebbles_a = pebbles(7);
GEN.cave_pebbles_b = pebbles(11);

GEN.cave_crack = (rng) => {
  const p = new Px(40, 16);
  let x = 2, y = rng.int(5, 10);
  const dark = 'rgba(10,8,16,0.55)';
  while (x < 37) {
    const nx = x + rng.int(3, 6), ny = Math.max(2, Math.min(13, y + rng.int(-2, 2)));
    p.line(x, y, nx, ny, dark);
    if (rng.bool(0.35)) p.line(nx, ny, nx + rng.int(-3, 3), ny + rng.int(-3, 3), 'rgba(10,8,16,0.35)');
    x = nx; y = ny;
  }
  return art([p], 12);
};

/* ---------------------------- the mine ---------------------------- */

/**
 * A timber set across a tunnel: two posts at the rock, a cap beam over the
 * way through, and a lantern hung from the middle of it. 66 wide so the
 * posts stand against the walls of a two-tile corridor.
 */
GEN.cave_support = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 3; f++) {
    const p = new Px(66, 54);
    const post = (x: number) => {
      p.fill(x, 8, 5, 44, PAL.woodDark);
      p.fill(x + 1, 8, 3, 44, PAL.wood);
      p.fill(x + 1, 8, 1, 44, PAL.woodLit);
      for (let y = 15; y < 50; y += 9) p.fill(x + 1, y, 3, 1, shade(PAL.wood, 0.75));
      p.fill(x - 1, 50, 7, 3, PAL.woodDark);
    };
    post(2); post(59);
    // the cap beam, and a wedge driven in at each end
    p.fill(0, 4, 66, 6, PAL.woodDark);
    p.fill(1, 5, 64, 4, PAL.wood);
    p.fill(1, 5, 64, 1, PAL.woodLit);
    for (let x = 8; x < 60; x += 11) p.fill(x, 7, 2, 1, shade(PAL.wood, 0.7));
    for (const x of [4, 61]) { p.fill(x, 10, 2, 3, PAL.woodDark); p.set(x, 7, PAL.ironLit); }
    // chain and lantern
    p.fill(33, 10, 1, 6, PAL.iron);
    p.fill(30, 16, 7, 1, PAL.ironDark);
    p.fill(30, 17, 7, 8, PAL.ironDark);
    const flame = [PAL.flameLit, PAL.goldLit, PAL.flame][f];
    p.fill(31, 18, 5, 6, mix(PAL.flame, PAL.gold, 0.5));
    p.fill(32, 19 + (f === 1 ? 1 : 0), 3, 4, flame);
    p.set(33, 19, PAL.white);
    p.fill(30, 25, 7, 1, PAL.ironDark);
    frames.push(p);
  }
  return art(frames, 52, 7);
};

/** One tile of track; laid end to end across a room. */
GEN.cave_rails = () => {
  const p = new Px(32, 14);
  for (let x = 1; x < 32; x += 8) {
    p.fill(x, 2, 5, 11, PAL.woodDark);
    p.fill(x + 1, 3, 3, 9, PAL.wood);
  }
  for (const y of [4, 10]) {
    p.fill(0, y + 1, 32, 1, 'rgba(10,8,16,0.45)');
    p.fill(0, y, 32, 1, PAL.iron);
    p.fill(0, y - 1, 32, 1, PAL.ironLit);
  }
  return art([p], 10);
};

GEN.cave_cart = (rng) => {
  const p = new Px(36, 30);
  p.ellipse(18, 27, 15, 3, 'rgba(10,8,16,0.4)');
  // tub, wider at the top
  p.poly([[3, 10], [33, 10], [30, 24], [6, 24]], PAL.ironDark);
  p.poly([[5, 11], [31, 11], [29, 22], [7, 22]], PAL.iron);
  p.fill(4, 10, 28, 1, PAL.ironLit);
  for (const x of [9, 18, 27]) p.fill(x, 12, 1, 10, PAL.ironDark);
  // ore heaped over the lip
  for (let i = 0; i < 14; i++) {
    const x = rng.int(6, 29), y = rng.int(5, 10);
    p.fill(x, y, 3, 2, rng.bool(0.3) ? PAL.gold : PAL.rock);
    p.set(x, y, rng.bool(0.3) ? PAL.goldLit : PAL.rockLit);
  }
  for (const x of [9, 26]) {
    p.circle(x, 25, 3, PAL.charcoal);
    p.set(x, 25, PAL.ironLit);
  }
  return art([p], 27);
};

const cache = new Map<string, PropArt>();

export const CAVE_PROP_NAMES = Object.keys(GEN);

export function getCaveProp(name: string): PropArt | undefined {
  const gen = GEN[name];
  if (!gen) return undefined;
  let hit = cache.get(name);
  if (!hit) {
    hit = gen(new RNG(`cave:${name}`));
    cache.set(name, hit);
  }
  return hit;
}
