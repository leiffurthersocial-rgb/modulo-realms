import { RNG } from '../core/rng';
import { PAL, mix, shade } from './palette';
import { Px, strip } from './pixel';
import type { PropArt } from './props';

/**
 * Furniture for the rooms behind Ashvale's doors.
 *
 * Interiors used to be a wooden floor the size of a barn with a forge in the
 * corner of every room — the chapel's included. These are the pieces the
 * rooms are furnished from now (`world/interiors.ts`):
 *
 * - wall faces (`int_wall_*`): the back wall is two tiles tall and faced, so
 *   a room has a wall to hang things on instead of a black edge;
 * - things on that wall: windows, a painting, shelves, a tool board, drying
 *   herbs, a stained window, a hearth;
 * - things on the floor: counters, a bar, kegs, pews, a throne, a map table,
 *   a wardrobe, an armour stand, a quench tub and the small stuff that makes
 *   a room look used.
 *
 * Wall-hung pieces are anchored at the foot of the wall (the prop's y) and
 * drawn above it, so `anchorY` is larger than their height on purpose.
 * `getProp` asks here before the generic generators.
 */

function art(frames: Px[], anchorY: number, fps = 5): PropArt {
  return { canvas: strip(frames), fw: frames[0].w, fh: frames[0].h, frames: frames.length, fps, anchorY };
}

function shadow(p: Px, cx: number, y: number, rx: number, ry = Math.max(2, rx * 0.35)) {
  p.ellipse(cx, y, rx, ry, 'rgba(10,8,16,0.3)');
}

/** Grain, a lit top edge and a shaded bottom one — wood that reads as wood. */
function wood(p: Px, x: number, y: number, w: number, h: number, base: string, rng?: RNG, vertical = false) {
  p.fill(x, y, w, h, base);
  p.fill(x, y, w, 1, shade(base, 1.2));
  p.fill(x, y + h - 1, w, 1, shade(base, 0.7));
  p.fill(x, y, 1, h, shade(base, 1.1));
  p.fill(x + w - 1, y, 1, h, shade(base, 0.78));
  if (!rng) return;
  const lines = Math.max(2, Math.round((vertical ? w : h) / 4));
  for (let i = 0; i < lines; i++) {
    const c = rng.bool() ? shade(base, 0.86) : shade(base, 1.08);
    if (vertical) p.fill(x + rng.int(1, Math.max(1, w - 2)), y + 1, 1, h - 2, c);
    else p.fill(x + 1, y + rng.int(1, Math.max(1, h - 2)), w - 2, 1, c);
  }
}

const GEN: Record<string, (rng: RNG) => PropArt> = {};

/* ================================ walls ================================ */

/** Upright planks over a dark skirting. */
GEN.int_wall_wood = (rng) => {
  const p = new Px(32, 64);
  for (let x = 0; x < 32; x += 8) wood(p, x, 0, 8, 58, rng.bool() ? PAL.wood : shade(PAL.wood, 0.92), rng, true);
  p.fill(0, 0, 32, 4, PAL.woodDark);
  p.fill(0, 4, 32, 1, shade(PAL.woodDark, 0.7));
  p.fill(0, 56, 32, 8, PAL.woodDark);
  p.fill(0, 56, 32, 1, PAL.woodLit);
  p.fill(0, 63, 32, 1, PAL.ink);
  return art([p], 64);
};

/** Lime plaster above timber panelling — the inn, homes, the apothecary. */
GEN.int_wall_plaster = (rng) => {
  const p = new Px(32, 64);
  const plaster = mix(PAL.cloth, PAL.sand, 0.35);
  p.fill(0, 0, 32, 36, plaster);
  for (let i = 0; i < 26; i++) p.set(rng.int(0, 31), rng.int(2, 34), shade(plaster, rng.bool() ? 0.93 : 1.04));
  p.fill(0, 0, 32, 3, PAL.woodDark);
  p.fill(0, 3, 32, 1, shade(plaster, 0.8));
  // chair rail, then panels
  wood(p, 0, 36, 32, 3, PAL.plank);
  for (let x = 0; x < 32; x += 16) {
    wood(p, x, 39, 16, 17, PAL.wood);
    p.fill(x + 3, 42, 10, 11, shade(PAL.wood, 0.88));
    p.fill(x + 3, 42, 10, 1, shade(PAL.wood, 0.72));
  }
  p.fill(0, 56, 32, 8, PAL.woodDark);
  p.fill(0, 56, 32, 1, PAL.woodLit);
  p.fill(0, 63, 32, 1, PAL.ink);
  return art([p], 64);
};

/** Dressed stone in courses — the forge, the Moot Hall, the chapel. */
GEN.int_wall_stone = (rng) => {
  const p = new Px(32, 64);
  p.fill(0, 0, 32, 64, PAL.rockDark);
  for (let row = 0; row < 7; row++) {
    const y = row * 8;
    const off = row % 2 ? 8 : 0;
    for (let x = -off; x < 32; x += 16) {
      const c = rng.pick([PAL.stone, shade(PAL.stone, 1.08), shade(PAL.stone, 0.94)]);
      p.fill(x + 1, y + 1, 14, 6, c);
      p.fill(x + 1, y + 1, 14, 1, shade(c, 1.18));
      p.fill(x + 1, y + 6, 14, 1, shade(c, 0.8));
    }
  }
  p.fill(0, 56, 32, 8, shade(PAL.rockDark, 0.9));
  p.fill(0, 56, 32, 1, PAL.rock);
  p.fill(0, 63, 32, 1, PAL.ink);
  return art([p], 64);
};

/* =========================== on the back wall =========================== */

/** A mullioned window with daylight in it, and a sill. */
GEN.int_window = () => {
  const p = new Px(28, 32);
  p.fill(0, 0, 28, 32, PAL.woodDark);
  p.fill(2, 2, 24, 26, '#8fc0e0');
  p.fill(2, 2, 24, 8, '#b8dcf0');
  p.fill(2, 18, 24, 10, '#6f9fc4');
  p.fill(13, 2, 2, 26, PAL.woodDark);
  p.fill(2, 13, 24, 2, PAL.woodDark);
  p.set(5, 4, PAL.white); p.set(6, 5, PAL.white); p.set(17, 4, PAL.white);
  wood(p, 0, 28, 28, 4, PAL.plank);
  return art([p], 54);
};

/** A small landscape in a gilt frame. */
GEN.int_painting = (rng) => {
  const p = new Px(30, 22);
  p.fill(0, 0, 30, 22, PAL.gold);
  p.fill(1, 1, 28, 20, shade(PAL.gold, 0.7));
  p.fill(3, 3, 24, 16, '#9fc4d8');
  p.fill(3, 11, 24, 8, PAL.grass);
  p.poly([[3, 13], [10, 6], [16, 13]], PAL.rock);
  p.poly([[12, 13], [19, 8], [27, 13]], shade(PAL.rock, 1.2));
  p.fill(3, 15, 24, 4, PAL.grassDark);
  p.circle(22, 6, 2, PAL.goldLit);
  for (let i = 0; i < 3; i++) p.set(rng.int(5, 25), rng.int(15, 18), PAL.leafLit);
  p.set(0, 0, PAL.goldLit);
  return art([p], 50);
};

/** Stained glass in a pointed arch — the chapel's east light. */
GEN.int_stained_window = () => {
  const p = new Px(30, 48);
  p.poly([[0, 48], [0, 14], [15, 0], [30, 14], [30, 48]], PAL.rockDark);
  p.poly([[3, 46], [3, 15], [15, 4], [27, 15], [27, 46]], PAL.charcoal);
  const glass = [PAL.arcaneLit, PAL.gold, PAL.blood, '#6fa8d8', PAL.leafLit];
  for (let y = 6; y < 46; y += 5) {
    for (let x = 4; x < 27; x += 5) {
      const inside = y > 15 || Math.abs(x + 2 - 15) < (y - 4) * 1.1;
      if (!inside) continue;
      p.fill(x, y, 4, 4, glass[(x * 3 + y) % glass.length]);
    }
  }
  p.fill(14, 5, 2, 41, PAL.charcoal);
  p.circle(15, 20, 4, PAL.holy);
  p.set(15, 20, PAL.white);
  return art([p], 60);
};

/** A board of tongs, hammers, files and a saw over the forge bench. */
GEN.int_tool_wall = () => {
  const p = new Px(76, 32);
  wood(p, 0, 0, 76, 32, PAL.wood);
  for (let x = 0; x < 76; x += 19) p.fill(x, 0, 1, 32, shade(PAL.wood, 0.75));
  for (let x = 4; x < 76; x += 8) p.set(x, 3, PAL.ironLit);
  const hammer = (x: number, big: boolean) => {
    p.fill(x + 3, 6, 2, 20, PAL.woodDark);
    p.fill(x, 5, big ? 9 : 7, big ? 6 : 4, PAL.iron); p.fill(x, 5, big ? 9 : 7, 1, PAL.ironLit);
  };
  hammer(2, true); hammer(14, false);
  // tongs
  for (const x of [26, 34]) { p.line(x, 5, x + 3, 27, PAL.ironDark); p.line(x + 4, 5, x + 1, 27, PAL.ironDark); p.set(x + 2, 15, PAL.ironLit); }
  // files and a punch
  p.fill(44, 6, 2, 16, PAL.steel); p.fill(44, 20, 2, 7, PAL.woodDark);
  p.fill(49, 8, 2, 12, PAL.steel); p.fill(49, 19, 2, 6, PAL.woodDark);
  // saw
  p.fill(56, 7, 16, 11, PAL.steel); p.fill(56, 7, 16, 1, PAL.white);
  for (let x = 56; x < 72; x += 2) p.set(x, 18, PAL.ironDark);
  p.fill(66, 18, 5, 8, PAL.woodDark);
  p.outline(PAL.ink);
  return art([p], 54);
};

/** Herbs hung head-down to dry from a pole along the wall. */
GEN.int_herbs = (rng) => {
  const p = new Px(44, 24);
  p.fill(0, 2, 44, 2, PAL.woodDark);
  p.fill(0, 2, 44, 1, PAL.woodLit);
  for (let x = 3; x < 42; x += 6) {
    const c = rng.pick([PAL.leaf, PAL.grassPale, PAL.rot, '#8a6aa8', PAL.leafLit]);
    const len = rng.int(10, 18);
    p.fill(x + 1, 4, 1, 3, PAL.bone);
    for (let y = 6; y < 6 + len; y++) {
      const w = Math.max(1, Math.round(1 + (y - 6) * 0.25));
      p.fill(x + 1 - Math.floor(w / 2), y, w, 1, (y % 3) ? c : shade(c, 1.2));
    }
  }
  return art([p], 58);
};

/**
 * A stone hearth against the back wall with a real fire in it — every room
 * that used to borrow the forge now has one of these.
 */
GEN.int_fireplace = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(52, 60);
    // chimney breast
    p.fill(6, 0, 40, 60, PAL.stone);
    for (let y = 0; y < 60; y += 7) for (let x = 6 + ((y / 7) % 2 ? 5 : 0); x < 46; x += 10) p.fill(x, y, 9, 1, shade(PAL.stone, 0.8));
    // mantel
    wood(p, 0, 20, 52, 6, PAL.wood);
    p.fill(8, 16, 4, 4, PAL.clay); p.fill(40, 15, 5, 5, PAL.iron); p.set(41, 15, PAL.ironLit);
    // firebox
    p.fill(10, 28, 32, 30, PAL.ink);
    p.fill(12, 30, 28, 28, PAL.charcoal);
    p.fill(8, 26, 36, 3, PAL.rockLit);
    // logs and flames
    p.fill(14, 52, 24, 4, PAL.woodDark); p.fill(16, 50, 20, 3, PAL.wood);
    const flick = [0, 2, 1, 3][f];
    p.poly([[15, 51], [20, 38 - flick], [25, 51]], PAL.flame);
    p.poly([[22, 51], [27, 34 + flick], [33, 51]], PAL.flame);
    p.poly([[28, 51], [33, 40 - flick], [37, 51]], PAL.ember);
    p.poly([[19, 51], [22, 43 - flick], [26, 51]], PAL.flameLit);
    p.poly([[25, 51], [28, 41 + flick], [31, 51]], PAL.goldLit);
    p.set(27, 46, PAL.white);
    p.fill(8, 57, 36, 3, PAL.rockDark);
    frames.push(p);
  }
  return art(frames, 60, 7);
};

/** Floor-standing shelves against the wall, stocked with a trader's goods. */
GEN.int_shelf_goods = (rng) => {
  const p = new Px(40, 50);
  wood(p, 0, 0, 40, 50, PAL.woodDark, rng, true);
  p.fill(2, 2, 36, 46, shade(PAL.wood, 0.8));
  for (let r = 0; r < 4; r++) {
    const y = 3 + r * 11;
    wood(p, 2, y + 9, 36, 2, PAL.plank);
    let x = 3;
    while (x < 34) {
      const kind = rng.int(0, 3);
      if (kind === 0) { p.fill(x, y + 2, 6, 7, PAL.plank); p.fill(x, y + 2, 6, 1, PAL.plankLit); x += 7; }
      else if (kind === 1) { const c = rng.pick([PAL.blood, '#4a6a9a', PAL.leaf, PAL.gold]); p.fill(x, y + 4, 7, 5, c); p.fill(x, y + 4, 7, 1, shade(c, 1.3)); x += 8; }
      else if (kind === 2) { p.fill(x + 1, y + 3, 4, 6, PAL.clay); p.fill(x + 2, y + 2, 2, 1, PAL.clay); x += 6; }
      else { p.ellipse(x + 3, y + 6, 3, 3, mix(PAL.cloth, PAL.sand, 0.4)); x += 7; }
    }
  }
  return art([p], 50);
};

/** The apothecary's wall of stoppered jars, in every colour of trouble. */
GEN.int_shelf_jars = (rng) => {
  const p = new Px(40, 50);
  wood(p, 0, 0, 40, 50, PAL.woodDark, rng, true);
  p.fill(2, 2, 36, 46, '#3a2a30');
  const glass = [PAL.toxic, PAL.blood, '#6fa8d8', PAL.arcaneLit, PAL.flameLit, PAL.foam];
  for (let r = 0; r < 4; r++) {
    const y = 3 + r * 11;
    wood(p, 2, y + 9, 36, 2, PAL.plank);
    for (let x = 3; x < 35; x += 5) {
      if (rng.bool(0.15)) continue;
      const c = rng.pick(glass), h = rng.int(4, 7);
      p.fill(x, y + 9 - h, 4, h, c);
      p.fill(x, y + 9 - h, 4, 1, shade(c, 1.3));
      p.fill(x + 1, y + 8 - h, 2, 1, PAL.bone);
      p.set(x, y + 10 - h, PAL.white);
    }
  }
  return art([p], 50);
};

/* ============================ counters & bars ============================ */

/**
 * A shop counter, waist-high: the keeper stands on the same tile, just
 * behind its collision strip, and shows from the belt up.
 */
const counter = (w: number, top: (p: Px, rng: RNG) => void) => (rng: RNG) => {
  const p = new Px(w, 30);
  shadow(p, w / 2, 28, w / 2 - 2, 3);
  // front panelling, a lit worktop with an overhang, a dark kick board
  wood(p, 1, 12, w - 2, 14, PAL.wood, rng, true);
  for (let x = 4; x < w - 6; x += 16) {
    p.fill(x, 14, 12, 9, shade(PAL.wood, 0.86));
    p.fill(x, 14, 12, 1, shade(PAL.wood, 0.7));
  }
  wood(p, 0, 8, w, 5, PAL.plank, rng);
  p.fill(0, 8, w, 1, PAL.plankLit);
  p.fill(1, 13, w - 2, 1, shade(PAL.woodDark, 0.8));
  p.fill(1, 26, w - 2, 2, PAL.woodDark);
  top(p, rng);
  p.outline(PAL.ink);
  return art([p], 28);
};

/** The trading post's counter: brass scales, a ledger, a coin tray. */
GEN.int_counter_store = counter(64, (p) => {
  // an open ledger
  p.fill(4, 3, 16, 6, PAL.cloth); p.fill(4, 3, 16, 1, PAL.white); p.fill(11, 3, 2, 6, shade(PAL.cloth, 0.75));
  for (const y of [5, 7]) { p.fill(5, y, 5, 1, PAL.ash); p.fill(14, y, 5, 1, PAL.ash); }
  // brass scales
  p.fill(31, 0, 2, 8, PAL.gold); p.fill(24, 0, 16, 1, PAL.gold);
  p.fill(23, 3, 6, 2, PAL.goldLit); p.fill(35, 4, 6, 2, PAL.goldLit); p.line(24, 1, 25, 3, PAL.gold); p.line(39, 1, 38, 4, PAL.gold);
  // coin stacks
  for (const [x, h] of [[46, 5], [50, 3], [54, 6]] as Array<[number, number]>) { p.fill(x, 8 - h, 3, h, PAL.gold); p.fill(x, 8 - h, 3, 1, PAL.goldLit); }
});

/** The apothecary's counter: a mortar, stoppered bottles, a candle. */
GEN.int_counter_apoth = counter(64, (p) => {
  p.fill(6, 4, 8, 4, PAL.rockLit); p.fill(7, 4, 6, 1, PAL.rockPale); p.line(12, 1, 9, 4, PAL.plank);
  const bottles: Array<[number, string]> = [[22, PAL.toxic], [27, PAL.blood], [32, '#6fa8d8'], [37, PAL.arcaneLit]];
  for (const [x, c] of bottles) { p.fill(x, 2, 4, 6, c); p.fill(x + 1, 0, 2, 2, PAL.bone); p.set(x, 3, PAL.white); }
  p.fill(50, 2, 3, 6, PAL.cloth); p.set(51, 1, PAL.flameLit);
});

/** The Kettle & Crown's bar: brass taps and a line of mugs. */
GEN.int_bar = (rng) => {
  const w = 96;
  const p = new Px(w, 32);
  shadow(p, w / 2, 30, w / 2 - 2, 3);
  wood(p, 1, 14, w - 2, 14, PAL.woodDark, rng, true);
  for (let x = 4; x < w - 8; x += 12) p.fill(x, 17, 1, 9, shade(PAL.woodDark, 1.25));
  wood(p, 0, 10, w, 5, PAL.plank, rng);
  p.fill(0, 10, w, 1, PAL.plankLit);
  p.fill(0, 27, w, 1, PAL.gold); // brass foot rail
  for (const x of [14, 22, 30]) { p.fill(x, 2, 2, 8, PAL.gold); p.fill(x - 1, 2, 4, 2, PAL.goldLit); }
  for (let x = 46; x < 88; x += 8) {
    p.fill(x, 4, 5, 6, PAL.bone); p.fill(x, 4, 5, 1, PAL.cloth); p.fill(x + 5, 5, 1, 3, shade(PAL.bone, 0.7));
    if (rng.bool(0.5)) p.fill(x + 1, 3, 3, 1, PAL.white);
  }
  p.outline(PAL.ink);
  return art([p], 30);
};

/** Casks racked on their sides, taps out. */
GEN.int_kegs = (rng) => {
  const p = new Px(44, 40);
  shadow(p, 22, 38, 20, 3);
  wood(p, 1, 30, 42, 6, PAL.woodDark);
  const cask = (x: number, y: number) => {
    p.ellipse(x, y, 9, 9, PAL.woodDark);
    p.ellipse(x, y, 8, 8, PAL.wood);
    p.ellipse(x, y, 5, 5, shade(PAL.wood, 1.1));
    p.fill(x - 8, y - 1, 16, 2, PAL.iron);
    p.fill(x - 1, y + 5, 2, 4, PAL.gold);
    if (rng.bool(0.5)) p.set(x - 3, y - 4, PAL.plankLit);
  };
  cask(12, 22); cask(32, 22); cask(22, 9);
  return art([p], 38);
};

/* ================================ furniture ================================ */

GEN.int_stool = (rng) => {
  const p = new Px(16, 20);
  shadow(p, 8, 18, 6, 2);
  p.ellipse(8, 7, 7, 3, PAL.woodDark);
  p.ellipse(8, 6, 6, 2, PAL.plank);
  p.fill(3, 8, 2, 10, PAL.wood); p.fill(11, 8, 2, 10, shade(PAL.wood, 0.8)); p.fill(7, 9, 2, 8, shade(PAL.wood, 0.9));
  p.fill(4, 13, 8, 1, PAL.woodDark);
  void rng;
  return art([p], 19);
};

GEN.int_wardrobe = (rng) => {
  const p = new Px(36, 56);
  shadow(p, 18, 54, 16, 3);
  wood(p, 1, 4, 34, 50, PAL.wood, rng, true);
  wood(p, 0, 0, 36, 6, PAL.woodDark, rng);
  p.fill(4, 9, 13, 40, shade(PAL.wood, 0.9)); p.fill(19, 9, 13, 40, shade(PAL.wood, 0.9));
  p.fill(4, 9, 13, 1, shade(PAL.wood, 0.7)); p.fill(19, 9, 13, 1, shade(PAL.wood, 0.7));
  p.fill(15, 26, 2, 4, PAL.gold); p.fill(19, 26, 2, 4, PAL.gold);
  p.fill(2, 50, 4, 4, PAL.woodDark); p.fill(30, 50, 4, 4, PAL.woodDark);
  return art([p], 55);
};

GEN.int_plant = (rng) => {
  const p = new Px(22, 30);
  shadow(p, 11, 28, 7, 2);
  p.fill(5, 18, 12, 10, PAL.clay); p.fill(4, 18, 14, 2, shade(PAL.clay, 1.2)); p.fill(6, 26, 10, 2, shade(PAL.clay, 0.75));
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.33;
    const len = rng.int(8, 14);
    p.line(11, 18, Math.round(11 + Math.cos(a) * len), Math.round(18 + Math.sin(a) * len), i % 2 ? PAL.leaf : PAL.leafLit);
  }
  p.fill(10, 16, 2, 3, PAL.leafDark);
  return art([p], 29);
};

/** A floor candle-stand. The flame moves; the light is the prop's. */
GEN.int_candles = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 3; f++) {
    const p = new Px(18, 36);
    shadow(p, 9, 34, 6, 2);
    p.fill(8, 12, 2, 21, PAL.ironDark); p.fill(4, 32, 10, 2, PAL.ironDark);
    p.fill(3, 12, 12, 2, PAL.iron);
    for (const x of [3, 8, 13]) {
      p.fill(x, 6, 2, 6, PAL.cloth);
      const h = [3, 4, 2][(f + x) % 3];
      p.fill(x, 6 - h, 2, h, PAL.flameLit);
      p.set(x, 6 - h, PAL.white);
    }
    frames.push(p);
  }
  return art(frames, 35, 6);
};

GEN.int_armor_stand = () => {
  const p = new Px(28, 48);
  shadow(p, 14, 46, 10, 2);
  p.fill(13, 8, 2, 36, PAL.woodDark); p.fill(6, 43, 16, 3, PAL.woodDark);
  // helm
  p.ellipse(14, 6, 5, 5, PAL.iron); p.fill(9, 6, 10, 2, PAL.ironDark); p.set(12, 3, PAL.ironLit);
  // cuirass and pauldrons
  p.fill(7, 13, 14, 16, PAL.iron); p.fill(7, 13, 14, 2, PAL.ironLit);
  p.ellipse(6, 14, 4, 3, PAL.ironLit); p.ellipse(22, 14, 4, 3, PAL.iron);
  p.fill(13, 15, 2, 12, PAL.ironDark);
  p.fill(8, 29, 12, 6, shade(PAL.clay, 0.8));
  for (let x = 8; x < 20; x += 3) p.fill(x, 29, 1, 6, PAL.woodDark);
  return art([p], 47);
};

/** A half barrel of water to quench in; steam comes off it now and then. */
GEN.int_quench = () => {
  const p = new Px(30, 24);
  shadow(p, 15, 22, 13, 2);
  p.ellipse(15, 8, 13, 5, PAL.woodDark);
  p.fill(2, 8, 26, 12, PAL.wood);
  p.ellipse(15, 20, 13, 3, PAL.wood);
  p.ellipse(15, 8, 11, 4, PAL.water);
  p.ellipse(15, 7, 7, 2, PAL.waterLit);
  p.fill(2, 11, 26, 2, PAL.iron); p.fill(2, 17, 26, 2, PAL.iron);
  return art([p], 23);
};

/** A coal bin: a plank box heaped with fuel. */
GEN.int_coals = (rng) => {
  const p = new Px(30, 24);
  shadow(p, 15, 22, 13, 2);
  wood(p, 2, 10, 26, 12, PAL.wood, rng);
  p.fill(2, 10, 26, 2, PAL.woodDark);
  p.ellipse(15, 10, 12, 4, PAL.ink);
  for (let i = 0; i < 16; i++) { const x = rng.int(5, 25), y = rng.int(6, 11); p.fill(x, y, 2, 2, rng.bool(0.25) ? PAL.charcoal : '#15121a'); }
  p.set(12, 7, PAL.rockLit); p.set(19, 8, PAL.rockLit);
  p.fill(1, 12, 1, 9, PAL.iron); p.fill(28, 12, 1, 9, PAL.iron);
  p.outline(PAL.ink);
  return art([p], 23);
};

/** Forge bellows: two boards, leather folds between, a nozzle to the fire. */
GEN.int_bellows = () => {
  const p = new Px(34, 26);
  shadow(p, 16, 24, 14, 2);
  // stand
  p.fill(6, 18, 2, 6, PAL.woodDark); p.fill(22, 18, 2, 6, PAL.woodDark); p.fill(5, 22, 20, 2, PAL.woodDark);
  // top and bottom boards, pear-shaped, handles out the back
  p.poly([[2, 6], [24, 4], [28, 9], [24, 12], [2, 11]], PAL.wood);
  p.poly([[2, 14], [24, 15], [28, 13], [24, 19], [2, 18]], shade(PAL.wood, 0.8));
  p.fill(0, 7, 3, 2, PAL.woodDark); p.fill(0, 15, 3, 2, PAL.woodDark);
  // leather folds
  for (let x = 4; x < 24; x += 4) p.fill(x, 11, 3, 4, x % 8 ? PAL.clay : shade(PAL.clay, 0.8));
  // brass nozzle
  p.fill(27, 11, 6, 3, PAL.gold); p.fill(27, 11, 6, 1, PAL.goldLit);
  p.outline(PAL.ink);
  // mirrored: it stands to the right of the forge and blows left, into it
  return art([p.mirrored()], 25);
};

/** The forge proper: a brick hearth two tiles wide under a hood and flue. */
GEN.int_forge = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(70, 84);
    shadow(p, 35, 82, 32, 3);
    // flue and hood
    p.fill(27, 0, 16, 30, PAL.rockDark); p.fill(29, 0, 12, 30, PAL.stone);
    p.poly([[8, 44], [27, 26], [43, 26], [62, 44]], PAL.rockDark);
    p.poly([[11, 43], [29, 28], [41, 28], [59, 43]], PAL.stone);
    for (let y = 30; y < 43; y += 4) p.fill(16 + (y - 30), y, 38 - (y - 30) * 2, 1, shade(PAL.stone, 0.82));
    // brick hearth body
    p.fill(4, 44, 62, 36, PAL.clay);
    for (let y = 44; y < 80; y += 5) for (let x = 4 + ((y / 5) % 2 ? 5 : 0); x < 66; x += 10) p.fill(x, y, 1, 5, shade(PAL.clay, 0.7));
    for (let y = 48; y < 80; y += 5) p.fill(4, y, 62, 1, shade(PAL.clay, 0.75));
    p.fill(4, 44, 62, 3, PAL.rockLit);
    // fire bed
    p.fill(12, 47, 46, 10, PAL.ink);
    const glow = [PAL.ember, PAL.flame, PAL.flameLit, PAL.flame][f];
    for (let x = 14; x < 56; x += 4) p.fill(x, 51 + ((x + f) % 3), 3, 3, (x + f) % 8 < 4 ? glow : PAL.ember);
    p.fill(20, 49 - (f % 2), 2, 2, PAL.goldLit); p.fill(40, 50 - ((f + 1) % 2), 2, 2, PAL.goldLit);
    // ash door and iron bands
    p.fill(28, 64, 14, 12, PAL.ink); p.fill(29, 65, 12, 10, f % 2 ? PAL.ember : PAL.emberDark);
    p.fill(4, 60, 62, 1, PAL.ironDark); p.fill(4, 78, 62, 2, PAL.ironDark);
    p.outline(PAL.ink);
    frames.push(p);
  }
  return art(frames, 83, 6);
};

/** A chapel pew, two tiles long. */
GEN.int_pew = (rng) => {
  const p = new Px(64, 28);
  shadow(p, 32, 26, 30, 2);
  wood(p, 1, 2, 62, 10, PAL.wood, rng);
  wood(p, 1, 13, 62, 5, PAL.plank, rng);
  p.fill(1, 12, 62, 1, PAL.woodDark);
  for (const x of [2, 30, 58]) p.fill(x, 18, 4, 8, shade(PAL.wood, 0.8));
  p.fill(0, 0, 4, 20, PAL.woodDark); p.fill(60, 0, 4, 20, PAL.woodDark);
  return art([p], 27);
};

GEN.int_lectern = () => {
  const p = new Px(22, 34);
  shadow(p, 11, 32, 8, 2);
  p.fill(9, 12, 4, 19, PAL.wood); p.fill(5, 30, 12, 3, PAL.woodDark);
  p.poly([[2, 10], [20, 6], [20, 12], [2, 14]], PAL.woodDark);
  p.poly([[4, 9], [18, 6], [18, 9], [4, 12]], PAL.cloth);
  p.line(11, 7, 11, 11, shade(PAL.cloth, 0.7));
  p.fill(14, 9, 1, 5, PAL.blood);
  return art([p], 33);
};

/** The king's chair at the head of the Moot Hall table. */
GEN.int_throne = (rng) => {
  const p = new Px(34, 50);
  shadow(p, 17, 48, 14, 2);
  wood(p, 5, 0, 24, 30, PAL.woodDark, rng, true);
  p.fill(8, 4, 18, 22, PAL.blood); p.fill(8, 4, 18, 2, shade(PAL.blood, 1.3));
  p.circle(17, 12, 3, PAL.gold); p.set(17, 11, PAL.goldLit);
  for (const x of [4, 29]) { p.fill(x, 0, 2, 3, PAL.gold); }
  wood(p, 2, 28, 30, 7, PAL.wood, rng);
  p.fill(4, 30, 26, 3, PAL.blood);
  wood(p, 2, 24, 5, 12, PAL.woodDark); wood(p, 27, 24, 5, 12, PAL.woodDark);
  p.fill(4, 35, 3, 12, PAL.woodDark); p.fill(27, 35, 3, 12, PAL.woodDark);
  return art([p], 49);
};

/** A war table with the valley pinned out on it. */
GEN.int_map_table = (rng) => {
  const p = new Px(52, 34);
  shadow(p, 26, 32, 22, 3);
  wood(p, 2, 8, 48, 9, PAL.plank, rng);
  p.fill(6, 6, 40, 9, mix(PAL.cloth, PAL.sand, 0.4));
  p.fill(10, 8, 12, 3, PAL.grassPale); p.fill(26, 9, 8, 4, PAL.leafLit); p.fill(34, 7, 6, 3, PAL.snowDark);
  p.line(8, 12, 44, 10, PAL.water);
  for (const [x, y, c] of [[14, 9, PAL.blood], [30, 10, PAL.gold], [38, 8, PAL.arcaneLit]] as Array<[number, number, string]>) { p.fill(x, y - 2, 1, 3, PAL.ink); p.set(x, y - 3, c); }
  p.fill(2, 16, 48, 3, PAL.woodDark);
  wood(p, 5, 19, 5, 13, PAL.wood); wood(p, 42, 19, 5, 13, PAL.wood);
  return art([p], 33);
};

GEN.int_churn = () => {
  const p = new Px(18, 30);
  shadow(p, 9, 28, 7, 2);
  p.fill(3, 10, 12, 18, PAL.wood); p.fill(3, 10, 12, 1, PAL.plankLit);
  p.fill(3, 14, 12, 1, PAL.iron); p.fill(3, 24, 12, 1, PAL.iron);
  p.fill(8, 0, 2, 11, PAL.plank); p.fill(5, 9, 8, 2, PAL.woodDark);
  return art([p], 29);
};

GEN.int_spinning_wheel = () => {
  const p = new Px(32, 32);
  shadow(p, 16, 30, 13, 2);
  p.circle(12, 13, 10, PAL.woodDark);
  p.circle(12, 13, 9, PAL.wood);
  p.circle(12, 13, 7, PAL.woodDark);
  p.circle(12, 13, 6, PAL.wood);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; p.line(12, 13, Math.round(12 + Math.cos(a) * 7), Math.round(13 + Math.sin(a) * 7), PAL.woodDark); }
  p.fill(4, 25, 26, 3, PAL.woodDark); p.fill(24, 10, 3, 16, PAL.wood);
  p.fill(25, 8, 5, 4, mix(PAL.cloth, PAL.sand, 0.3));
  return art([p], 31);
};

/** A three-panel screen, for the beds at the back of the inn. */
GEN.int_screen = () => {
  const p = new Px(46, 46);
  shadow(p, 23, 44, 21, 2);
  const panel = (x: number, c: string) => {
    wood(p, x, 2, 15, 42, PAL.woodDark);
    p.fill(x + 2, 5, 11, 34, c);
    p.fill(x + 2, 5, 11, 2, shade(c, 1.2));
    p.line(x + 3, 30, x + 11, 12, shade(c, 0.8));
  };
  panel(0, PAL.blood); panel(15, shade(PAL.blood, 0.85)); panel(30, PAL.blood);
  return art([p], 45);
};

/** Crates stacked two high, one lid prised. */
GEN.int_crates = (rng) => {
  const p = new Px(34, 40);
  shadow(p, 17, 38, 15, 2);
  const crate = (x: number, y: number, s: number) => {
    wood(p, x, y, s, s, PAL.wood, rng);
    p.fill(x, y, s, 2, PAL.plankLit);
    p.line(x + 1, y + 1, x + s - 2, y + s - 2, shade(PAL.wood, 0.75));
    p.fill(x, y + s - 2, s, 2, PAL.woodDark);
  };
  crate(1, 18, 18); crate(17, 20, 16); crate(7, 2, 16);
  p.fill(9, 1, 6, 2, mix(PAL.cloth, PAL.sand, 0.5));
  return art([p], 39);
};

/** A long runner down an aisle, three tiles. Flat. */
GEN.int_runner = () => {
  const p = new Px(40, 96);
  p.fill(0, 0, 40, 96, PAL.blood);
  p.fill(2, 2, 36, 92, shade(PAL.blood, 0.85));
  p.box(4, 4, 32, 88, PAL.gold);
  for (let y = 12; y < 88; y += 12) { p.fill(18, y, 4, 4, PAL.gold); p.set(19, y + 1, PAL.goldLit); }
  return art([p], 96);
};

/** Stove and hanging pots in the inn's kitchen corner. */
GEN.int_stove = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 3; f++) {
    const p = new Px(40, 44);
    shadow(p, 20, 42, 18, 2);
    p.fill(2, 16, 36, 26, PAL.ironDark); p.fill(2, 16, 36, 2, PAL.iron);
    p.fill(10, 26, 20, 12, PAL.ink);
    p.fill(12, 34 - f, 16, 4 + f, f === 1 ? PAL.flameLit : PAL.flame);
    p.fill(15, 5, 2, 11, PAL.iron); // flue
    p.ellipse(28, 13, 7, 4, PAL.charcoal); p.fill(21, 9, 14, 4, PAL.charcoal); p.ellipse(28, 9, 7, 2, PAL.ironDark);
    p.set(26, 8 - f, PAL.fog); p.set(29, 6 - f, PAL.fog);
    frames.push(p);
  }
  return art(frames, 43, 5);
};


/* ============================== loop two ============================== */

/** A slab of hearthstone laid in front of a fireplace. Flat. */
GEN.int_hearthstone = () => {
  // the fireplace's own stone, laid flush against its foot
  const p = new Px(52, 12);
  p.fill(0, 0, 52, 11, PAL.stone);
  p.fill(0, 0, 52, 1, shade(PAL.stone, 1.3));
  p.fill(0, 10, 52, 2, PAL.rockDark);
  for (const x of [13, 26, 39]) p.fill(x, 1, 1, 9, shade(PAL.stone, 0.8));
  p.set(9, 4, PAL.ember); p.set(30, 6, PAL.ash); p.set(31, 6, PAL.ash);
  return art([p], 12);
};

/** A display table of boots, bolts of cloth and rope. */
GEN.int_display_table = (rng) => {
  const p = new Px(50, 32);
  shadow(p, 25, 30, 22, 2);
  wood(p, 2, 10, 46, 6, PAL.plank, rng);
  p.fill(2, 15, 46, 2, PAL.woodDark);
  wood(p, 5, 17, 4, 13, PAL.wood); wood(p, 41, 17, 4, 13, PAL.wood);
  p.fill(6, 4, 10, 7, '#4a6a9a'); p.fill(6, 4, 10, 1, shade('#4a6a9a', 1.3)); p.fill(8, 3, 6, 2, shade('#4a6a9a', 1.15));
  p.fill(18, 5, 9, 6, PAL.blood); p.fill(18, 5, 9, 1, shade(PAL.blood, 1.3));
  p.fill(30, 3, 4, 8, PAL.clay); p.fill(30, 9, 7, 2, PAL.clay); p.fill(36, 3, 4, 8, shade(PAL.clay, 0.85)); p.fill(36, 9, 7, 2, shade(PAL.clay, 0.85));
  p.ellipse(44, 8, 3, 3, mix(PAL.plank, PAL.sand, 0.5)); p.set(44, 8, PAL.woodDark);
  p.outline(PAL.ink);
  return art([p], 31);
};

/** A small side table of stoppered vials behind the apothecary's counter. */
GEN.int_side_table = () => {
  const p = new Px(34, 28);
  shadow(p, 17, 26, 14, 2);
  wood(p, 2, 10, 30, 5, PAL.plank);
  p.fill(2, 14, 30, 2, PAL.woodDark);
  wood(p, 4, 16, 3, 10, PAL.wood); wood(p, 27, 16, 3, 10, PAL.wood);
  const glass = [PAL.toxic, '#6fa8d8', PAL.arcaneLit, PAL.blood];
  for (let i = 0; i < 4; i++) { const x = 5 + i * 7; p.fill(x, 4, 4, 6, glass[i]); p.fill(x + 1, 2, 2, 2, PAL.bone); p.set(x, 5, PAL.white); }
  p.outline(PAL.ink);
  return art([p], 27);
};

/** Split logs stacked by the hearth. */
GEN.int_woodpile = (rng) => {
  const p = new Px(34, 26);
  shadow(p, 17, 24, 15, 2);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4 - row; i++) {
      const x = 4 + i * 8 + row * 4, y = 18 - row * 7;
      p.circle(x, y, 4, PAL.woodDark);
      p.circle(x, y, 3, mix(PAL.plank, PAL.sand, 0.3));
      p.set(x, y, PAL.wood);
      if (rng.bool(0.4)) p.set(x + 1, y - 1, PAL.plankLit);
    }
  }
  p.outline(PAL.ink);
  return art([p], 25);
};

/** A basket of turnips, onions and an apple or two. */
GEN.int_basket = (rng) => {
  const p = new Px(26, 22);
  shadow(p, 13, 20, 10, 2);
  p.fill(3, 10, 20, 9, PAL.plank);
  for (let x = 3; x < 23; x += 3) p.fill(x, 10, 1, 9, shade(PAL.plank, 0.75));
  p.fill(3, 10, 20, 1, PAL.plankLit);
  for (let i = 0; i < 7; i++) {
    const x = rng.int(5, 20), y = rng.int(5, 10);
    const c = rng.pick([PAL.cloth, '#c8a0d0', PAL.blood, '#e8d8a0']);
    p.circle(x, y, 2, c); p.set(x, y - 2, PAL.leafLit);
  }
  p.outline(PAL.ink);
  return art([p], 21);
};

/** A candle in a brass cup on the wall. */
GEN.int_sconce = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 3; f++) {
    const p = new Px(12, 22);
    p.fill(4, 12, 4, 8, PAL.gold); p.fill(2, 12, 8, 2, PAL.goldLit); p.fill(5, 19, 2, 3, PAL.gold);
    p.fill(5, 6, 2, 6, PAL.cloth);
    const h = [4, 5, 3][f];
    p.fill(5, 6 - h, 2, h, PAL.flameLit); p.set(5, 6 - h, PAL.white); p.set(6, 5, PAL.flame);
    frames.push(p);
  }
  return art(frames, 44, 6);
};

/** A great round window of coloured glass for the chapel's back wall. */
GEN.int_rose_window = () => {
  const p = new Px(52, 58);
  // (drawn at 52x58, anchored low enough to sit wholly on the 64px wall)
  p.fill(4, 26, 44, 32, PAL.rockDark);
  p.circle(26, 26, 25, PAL.rockDark);
  p.circle(26, 26, 22, PAL.charcoal);
  const glass = [PAL.arcaneLit, PAL.gold, PAL.blood, '#6fa8d8', PAL.leafLit, PAL.flame];
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2;
    for (let r = 8; r < 21; r++) {
      for (let k = 0; k < 4; k++) {
        const a = a0 + (k / 4) * (Math.PI * 2 / 12) * 0.8;
        p.set(Math.round(26 + Math.cos(a) * r), Math.round(26 + Math.sin(a) * r), glass[i % glass.length]);
      }
    }
  }
  p.circle(26, 26, 7, PAL.holy); p.circle(26, 26, 3, PAL.white);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; p.line(26, 26, Math.round(26 + Math.cos(a) * 22), Math.round(26 + Math.sin(a) * 22), PAL.charcoal); }
  p.fill(8, 48, 36, 10, PAL.charcoal);
  for (let x = 10; x < 42; x += 8) p.fill(x, 49, 6, 8, glass[(x / 8) % glass.length | 0]);
  return art([p], 60);
};

/** A dressed stone altar under a white cloth with a gold border. */
GEN.int_altar = () => {
  const p = new Px(60, 42);
  shadow(p, 30, 40, 28, 3);
  p.fill(4, 14, 52, 24, PAL.stone);
  for (let x = 4; x < 56; x += 13) p.fill(x, 14, 1, 24, shade(PAL.stone, 0.8));
  p.fill(4, 36, 52, 3, PAL.rockDark);
  // cloth over the top, falling down the front in the middle
  p.fill(2, 10, 56, 6, PAL.cloth); p.fill(2, 10, 56, 1, PAL.white);
  p.fill(18, 16, 24, 16, PAL.cloth); p.fill(18, 30, 24, 2, PAL.gold);
  p.fill(18, 16, 1, 16, shade(PAL.cloth, 0.8)); p.fill(41, 16, 1, 16, shade(PAL.cloth, 0.8));
  p.fill(28, 20, 4, 8, PAL.gold); p.fill(26, 22, 8, 3, PAL.gold);
  // candles and a book
  for (const x of [8, 50]) { p.fill(x, 2, 3, 8, PAL.cloth); p.fill(x, 0, 3, 2, PAL.flameLit); }
  p.fill(22, 6, 16, 4, PAL.blood); p.fill(23, 6, 14, 1, shade(PAL.blood, 1.3));
  p.outline(PAL.ink);
  return art([p], 41);
};

/**
 * A raised stone platform: a pale top, a lit lip, a dark front riser and a
 * single step down the middle, so it reads as height rather than a rug.
 */
GEN.int_dais = () => {
  const p = new Px(112, 60);
  const top = shade(PAL.stone, 1.12);
  p.fill(0, 0, 112, 44, top);
  for (let x = 0; x < 112; x += 16) p.fill(x, 0, 1, 44, shade(top, 0.9));
  for (let y = 0; y < 44; y += 14) p.fill(0, y, 112, 1, shade(top, 0.9));
  p.fill(0, 42, 112, 2, shade(top, 1.25));        // lip
  p.fill(0, 44, 112, 10, PAL.rockDark);          // riser
  for (let x = 6; x < 112; x += 14) p.fill(x, 46, 8, 6, shade(PAL.rockDark, 1.25));
  p.fill(36, 44, 40, 4, top);                    // the step
  p.fill(36, 44, 40, 1, shade(top, 1.25));
  p.fill(36, 48, 40, 6, PAL.rockDark);
  p.fill(0, 54, 112, 2, 'rgba(10,8,16,0.35)');   // shadow on the floor
  return art([p], 56);
};

/** The council table: five tiles of board under a runner, set for a meeting. */
GEN.int_long_table = (rng) => {
  const w = 150;
  const p = new Px(w, 36);
  shadow(p, w / 2, 34, w / 2 - 4, 3);
  wood(p, 2, 8, w - 4, 9, PAL.plank, rng);
  p.fill(2, 8, w - 4, 1, PAL.plankLit);
  p.fill(2, 16, w - 4, 3, PAL.woodDark);
  for (const x of [6, w / 2 - 2, w - 11]) wood(p, x, 19, 5, 15, PAL.wood);
  p.fill(10, 9, w - 20, 5, PAL.blood); p.fill(10, 9, w - 20, 1, shade(PAL.blood, 1.3));
  for (const x of [22, 50, 100, 128]) { p.ellipse(x, 11, 4, 2, PAL.bone); p.set(x, 11, PAL.cloth); }
  for (const x of [40, 110]) { p.fill(x, 2, 2, 8, PAL.cloth); p.fill(x, 0, 2, 2, PAL.flameLit); }
  p.fill(64, 6, 22, 5, mix(PAL.cloth, PAL.sand, 0.4)); p.line(66, 8, 84, 8, PAL.water);
  p.outline(PAL.ink);
  return art([p], 35);
};

/** A trestle table with a bench down each side — the inn's long table. */
GEN.int_bench_table = (rng) => {
  const p = new Px(84, 50);
  shadow(p, 42, 48, 40, 3);
  wood(p, 4, 6, 76, 5, PAL.wood, rng);   // far bench
  p.fill(8, 11, 3, 6, PAL.woodDark); p.fill(73, 11, 3, 6, PAL.woodDark);
  wood(p, 0, 16, 84, 9, PAL.plank, rng); // table top
  p.fill(0, 16, 84, 1, PAL.plankLit);
  p.fill(0, 24, 84, 3, PAL.woodDark);
  for (const x of [6, 74]) wood(p, x, 27, 4, 10, PAL.wood);
  wood(p, 4, 36, 76, 5, PAL.wood, rng);  // near bench
  p.fill(8, 41, 3, 6, PAL.woodDark); p.fill(73, 41, 3, 6, PAL.woodDark);
  for (const x of [14, 34, 54]) { p.fill(x, 13, 5, 5, PAL.bone); p.fill(x, 13, 5, 1, PAL.cloth); }
  p.ellipse(66, 18, 6, 2, PAL.clay); p.ellipse(66, 17, 4, 1, PAL.flameLit);
  p.outline(PAL.ink);
  return art([p], 49);
};

/** A woven rectangular rug; flat. */
const rug = (w: number, h: number, base: string, trim: string) => () => {
  const p = new Px(w, h);
  p.fill(0, 0, w, h, trim);
  p.fill(2, 2, w - 4, h - 4, base);
  p.box(4, 4, w - 8, h - 8, trim);
  for (let y = 8; y < h - 8; y += 6) for (let x = 8 + ((y / 6) % 2) * 3; x < w - 8; x += 6) p.set(x, y, shade(base, 1.3));
  for (let x = 0; x < w; x += 3) { p.set(x, 0, shade(trim, 0.7)); p.set(x, h - 1, shade(trim, 0.7)); }
  return art([p], h);
};
GEN.int_rug_long = rug(88, 56, '#6a2a3a', PAL.gold);
GEN.int_rug_green = rug(72, 44, '#3a5a3a', mix(PAL.gold, PAL.plank, 0.5));
GEN.int_runner_short = () => {
  const p = new Px(40, 64);
  p.fill(0, 0, 40, 64, PAL.blood);
  p.fill(2, 0, 36, 64, shade(PAL.blood, 0.85));
  p.fill(4, 0, 1, 64, PAL.gold); p.fill(35, 0, 1, 64, PAL.gold);
  for (let y = 8; y < 64; y += 12) { p.fill(18, y, 4, 4, PAL.gold); p.set(19, y + 1, PAL.goldLit); }
  return art([p], 64);
};

/** A cauldron on an iron tripod over live embers. */
GEN.int_cauldron_fire = () => {
  const frames: Px[] = [];
  for (let f = 0; f < 4; f++) {
    const p = new Px(36, 40);
    shadow(p, 18, 38, 15, 2);
    p.ellipse(18, 34, 12, 3, PAL.rockDark);
    for (let x = 9; x < 28; x += 3) p.fill(x, 32 + ((x + f) % 2), 2, 2, (x + f) % 3 ? PAL.ember : PAL.flameLit);
    p.poly([[16, 26 - (f % 2)], [18, 22 + (f % 3)], [20, 26]], PAL.flame);
    p.line(5, 37, 12, 8, PAL.ironDark); p.line(31, 37, 24, 8, PAL.ironDark);
    p.ellipse(18, 18, 12, 9, PAL.charcoal);
    p.ellipse(18, 16, 11, 7, shade(PAL.charcoal, 1.3));
    p.ellipse(18, 11, 11, 3, PAL.ironDark);
    p.ellipse(18, 11, 9, 2, PAL.toxic);
    p.set(14 + f, 10, '#c8f07a'); p.set(22 - f, 11, '#c8f07a');
    p.fill(8, 12, 2, 2, PAL.iron); p.fill(26, 12, 2, 2, PAL.iron);
    p.outline(PAL.ink);
    frames.push(p);
  }
  return art(frames, 39, 5);
};

/** A low bench of potted herbs. */
GEN.int_planter_bench = (rng) => {
  const p = new Px(60, 32);
  shadow(p, 30, 30, 28, 2);
  wood(p, 2, 18, 56, 5, PAL.wood, rng);
  p.fill(5, 23, 3, 7, PAL.woodDark); p.fill(52, 23, 3, 7, PAL.woodDark);
  for (const x of [10, 24, 38, 50]) {
    p.fill(x - 4, 11, 9, 8, PAL.clay); p.fill(x - 5, 11, 11, 2, shade(PAL.clay, 1.2));
    const c = rng.pick([PAL.leaf, PAL.leafLit, PAL.grassPale, PAL.toxic]);
    for (let i = 0; i < 5; i++) p.line(x, 11, x + rng.int(-4, 4), rng.int(2, 6), c);
    if (rng.bool(0.5)) p.set(x + rng.int(-2, 2), rng.int(3, 6), rng.pick([PAL.blood, PAL.arcaneLit, PAL.goldLit]));
  }
  p.outline(PAL.ink);
  return art([p], 31);
};

const cache = new Map<string, PropArt>();

export const INTERIOR_PROP_NAMES = Object.keys(GEN);

export function getInteriorProp(name: string): PropArt | undefined {
  const gen = GEN[name];
  if (!gen) return undefined;
  let hit = cache.get(name);
  if (!hit) {
    hit = gen(new RNG(`interior:${name}`));
    cache.set(name, hit);
  }
  return hit;
}
