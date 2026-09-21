import { RNG } from '../core/rng';
import { PAL, mix, shade, withAlpha } from './palette';
import { Px, strip, type Canvas } from './pixel';

/**
 * The furnishings of the Gilded Spade's gaming floor.
 *
 * These live apart from `props.ts` for the same reason `aegean.ts` does: it is
 * one room's worth of art, it is almost all animated, and it would otherwise
 * push the shared prop file past the point where anyone can find anything in
 * it. `getProp` reaches in here first, exactly as it does for the Greek set.
 *
 * Nothing here is a file. Every patron, bottle, wheel and curl of smoke is
 * drawn from code at 1:1 pixel scale, like every other pixel in the game.
 *
 * Two rules hold across the whole room:
 *  - *Everything that can move, moves.* A casino that stands still reads as a
 *    furniture showroom. Sitters breathe and fidget, the croupier deals, the
 *    barkeep polishes, the wheel spins, the smoke drifts.
 *  - *People sit on their own stool.* A seated patron and the stool under them
 *    are one sprite, so there is one collision box, one sort key, and no way
 *    for a sitter to end up drawn behind the seat they are sitting on.
 */

export interface CasinoArt {
  canvas: Canvas;
  fw: number;
  fh: number;
  frames: number;
  fps: number;
  anchorY: number;
}

const cache = new Map<string, CasinoArt>();

const art = (frames: Px[], anchorY?: number, fps = 6): CasinoArt => ({
  canvas: strip(frames),
  fw: frames[0].w,
  fh: frames[0].h,
  frames: frames.length,
  fps,
  anchorY: anchorY ?? frames[0].h,
});

const shadow = (p: Px, cx: number, y: number, rx: number, ry = Math.max(2, rx * 0.4)) =>
  p.ellipse(cx, y, rx, ry, 'rgba(10,8,16,0.34)');

/* ------------------------------------------------------------------ */
/* Shared marks                                                        */
/* ------------------------------------------------------------------ */

function spade(p: Px, cx: number, cy: number, s: number, color: string): void {
  p.poly([[cx, cy - s], [cx + s * 0.92, cy + s * 0.28], [cx, cy + s * 0.62], [cx - s * 0.92, cy + s * 0.28]], color);
  p.ellipse(cx - s * 0.42, cy + s * 0.18, s * 0.5, s * 0.46, color);
  p.ellipse(cx + s * 0.42, cy + s * 0.18, s * 0.5, s * 0.46, color);
  p.fill(cx - 1, cy + s * 0.3, 2, Math.max(1, s * 0.6), color);
  p.fill(cx - s * 0.45, cy + s * 0.85, s * 0.9, 1, color);
}

function crownMark(p: Px, cx: number, cy: number, s: number, body: string, lit: string): void {
  p.poly([
    [cx - s, cy + s * 0.6], [cx - s * 0.7, cy - s * 0.6], [cx - s * 0.32, cy],
    [cx, cy - s], [cx + s * 0.32, cy], [cx + s * 0.7, cy - s * 0.6], [cx + s, cy + s * 0.6],
  ], body);
  p.fill(cx - s, cy + s * 0.6, s * 2, Math.max(1, s * 0.3), lit);
  p.set(cx, cy - s * 0.7, PAL.white);
}

/** A stack of chips, the one graphic that says "money on the table". */
function chipStack(p: Px, x: number, y: number, body: string, n: number, w = 7): void {
  for (let i = 0; i < n; i++) {
    const c = i % 2 === 0 ? body : shade(body, 0.72);
    p.fill(x, y - i * 2, w, 2, c);
    p.set(x, y - i * 2, shade(body, 0.55));
    p.set(x + w - 1, y - i * 2, shade(body, 0.55));
  }
  p.ellipse(x + w / 2, y - n * 2 + 1, w / 2, 1.3, shade(body, 1.3));
}

/* ------------------------------------------------------------------ */
/* Seated patrons                                                      */
/* ------------------------------------------------------------------ */

interface Patron {
  skin: string;
  hair: string;
  coat: string;
  trim: string;
  /** Rough head shape: hooded patrons keep their face in shadow. */
  hood?: boolean;
  hat?: 'none' | 'wide' | 'cap';
}

/**
 * The regulars. Deliberately a small cast of strongly different silhouettes —
 * a room of six near-identical figures reads as a bug, six distinct ones reads
 * as a crowd.
 */
const PATRONS: Record<string, Patron> = {
  a: { skin: '#c98d63', hair: '#3a2418', coat: '#2f4d66', trim: '#6fa0c0', hat: 'none' },
  b: { skin: '#8a5a3a', hair: '#1d1420', coat: '#5c2136', trim: '#d9a441', hat: 'wide' },
  c: { skin: '#e0b48c', hair: '#b8813d', coat: '#2b4a33', trim: '#8fbf4a', hat: 'none' },
  d: { skin: '#a86f48', hair: '#4a4155', coat: '#3a2f52', trim: '#8f7bd0', hood: true },
  e: { skin: '#d8a273', hair: '#7a3428', coat: '#4a3a24', trim: '#b98f5c', hat: 'cap' },
  f: { skin: '#9a6a48', hair: '#d8cfc4', coat: '#33313e', trim: '#c3cad6', hat: 'none' },
};

const SITTER_W = 24;
const SITTER_H = 38;
/** Where the stool's feet land inside the frame. */
const SITTER_FEET = 34;

/** Legs of the stool. The seat itself is always hidden by the body above it. */
function stoolUnder(p: Px, cx: number, feet: number): void {
  p.fill(cx - 6, feet - 7, 2, 7, PAL.woodDark);
  p.fill(cx + 4, feet - 7, 2, 7, PAL.woodDark);
  p.fill(cx - 6, feet - 3, 12, 1, shade(PAL.wood, 0.9));
  p.ellipse(cx, feet - 8, 7, 3, PAL.woodDark);
  p.ellipse(cx, feet - 9, 6.2, 2.6, '#6d2330');
}

/** Hair, hat and face, shared by every facing. */
function head(p: Px, who: Patron, hx: number, hy: number, dir: Dir, t: number): void {
  const side = dir === 'left' || dir === 'right';
  const face = dir === 'right' ? 1 : dir === 'left' ? -1 : 0;

  p.fill(hx - 3, hy, 7, 8, who.skin);
  p.fill(hx - 3, hy, 7, 1, mix(who.skin, PAL.white, 0.2));
  p.fill(hx - 3, hy + 7, 7, 1, shade(who.skin, 0.78));
  if (side) {
    // a nose, which is most of what sells a profile at this size
    p.set(hx + face * 4, hy + 4, who.skin);
    p.fill(hx - face * 4, hy + 1, 1, 6, who.hair);
  }
  p.fill(hx - 1, hy + 8, 3, 2, shade(who.skin, 0.74));

  if (who.hood) {
    p.fill(hx - 4, hy - 2, 9, 9, shade(who.coat, 0.6));
    p.fill(hx - 3, hy + 2, 7, 4, withAlpha(PAL.ink, 0.82));
    if (dir !== 'up') p.set(hx + face * 2, hy + 3, withAlpha(PAL.flameLit, 0.85));
    return;
  }

  // hair: full cap from behind, a fringe and sideburns from any other angle
  p.fill(hx - 3, hy - 2, 7, 3, who.hair);
  p.fill(hx - 4, hy - 1, 1, 5, who.hair);
  p.fill(hx + 3, hy - 1, 1, 5, who.hair);
  if (dir === 'up') p.fill(hx - 3, hy - 2, 7, 8, who.hair);
  if (side) p.fill(hx - face * 3, hy - 1, 3, 6, who.hair);

  if (who.hat === 'wide') {
    // brim, crown, hat band — three bands is the whole hat at this size
    p.fill(hx - 6, hy - 3, 13, 2, PAL.charcoal);
    p.fill(hx - 4, hy - 6, 9, 3, PAL.charcoal);
    p.fill(hx - 3, hy - 7, 7, 1, mix(PAL.charcoal, PAL.fog, 0.3));
    p.fill(hx - 4, hy - 4, 9, 1, who.trim);
  } else if (who.hat === 'cap') {
    // a soft cap with a peak that shades the eyes on the facing side
    p.fill(hx - 3, hy - 5, 7, 3, who.trim);
    p.fill(hx - 4, hy - 4, 9, 2, who.trim);
    p.fill(hx - 4, hy - 3, 9, 1, shade(who.trim, 0.66));
    p.fill(hx - 3, hy - 5, 7, 1, mix(who.trim, PAL.white, 0.3));
    if (side) p.fill(hx + face * 4, hy - 3, 3, 1, shade(who.trim, 0.66));
    else p.fill(hx - 4, hy - 2, 9, 1, shade(who.trim, 0.5));
  }

  if (dir === 'up') return;
  // eyes, closed on the last frame of the idle
  const eye = t === 3 ? shade(who.skin, 0.72) : PAL.ink;
  if (side) p.set(hx + face * 2, hy + 3, eye);
  else { p.set(hx - 2, hy + 3, eye); p.set(hx + 2, hy + 3, eye); }
}

type Dir = 'up' | 'down' | 'left' | 'right';

/**
 * One seated patron, drawn for a facing and an animation phase.
 *
 * `t` runs 0..3. The motion is small on purpose — a breath, a shifted arm, a
 * blink — because a sitter that waves its arms about pulls the eye away from
 * the tables, which are the thing the player is meant to walk to.
 */
function sitter(who: Patron, dir: Dir, t: number, rng: RNG): Px {
  const p = new Px(SITTER_W, SITTER_H);
  const cx = Math.round(SITTER_W / 2);
  const feet = SITTER_FEET;
  const breath = t === 1 || t === 3 ? 1 : 0;
  const side = dir === 'left' || dir === 'right';
  const face = dir === 'right' ? 1 : -1;

  shadow(p, cx, feet, 9, 3);
  stoolUnder(p, cx, feet);

  const hipY = feet - 8;
  const torsoTop = hipY - 10 + breath;
  const headTop = torsoTop - 9;
  const coatLit = mix(who.coat, PAL.white, 0.16);
  const coatDark = shade(who.coat, 0.64);
  const sleeve = shade(who.coat, 0.84);
  const trouser = shade(who.coat, 0.58);

  // thighs, forward of the seat — this is what makes it read as *sitting*
  if (dir === 'up') {
    p.fill(cx - 6, hipY - 1, 12, 5, trouser);
    p.fill(cx - 6, hipY - 1, 12, 1, shade(who.coat, 0.7));
  } else if (dir === 'down') {
    p.fill(cx - 6, hipY, 5, 6, trouser);
    p.fill(cx + 1, hipY, 5, 6, trouser);
    p.fill(cx - 6, hipY + 6, 5, 2, PAL.ink);
    p.fill(cx + 1, hipY + 6, 5, 2, PAL.ink);
  } else {
    // knee toward the table, shin dropping to a boot on the rail
    p.fill(face > 0 ? cx - 2 : cx - 7, hipY - 1, 9, 5, trouser);
    p.fill(cx + (face > 0 ? 5 : -7), hipY + 3, 2, 5, trouser);
    p.fill(cx + (face > 0 ? 4 : -7), hipY + 8, 4, 2, PAL.ink);
  }

  // torso — narrower in profile than head-on, which is what reads as a turn
  const halfW = side ? 4 : 5;
  const tx = side ? cx + face : cx;
  p.fill(tx - halfW, torsoTop, halfW * 2, 11, who.coat);
  p.fill(tx - halfW, torsoTop, halfW * 2, 1, coatLit);
  p.fill(tx + halfW - 1, torsoTop, 1, 11, coatDark);
  // the far shoulder, dropped back into shadow
  if (side) p.fill(tx - face * halfW, torsoTop + 1, 1, 10, shade(who.coat, 0.5));
  if (dir === 'down') {
    p.poly([[cx - 4, torsoTop + 1], [cx, torsoTop + 8], [cx + 4, torsoTop + 1]], who.trim);
    p.poly([[cx - 2, torsoTop + 1], [cx, torsoTop + 6], [cx + 2, torsoTop + 1]], PAL.cloth);
    p.set(cx, torsoTop + 8, PAL.gold);
  } else if (dir === 'up') {
    p.fill(cx - 5, torsoTop + 4, 10, 1, who.trim);
    p.fill(cx - 1, torsoTop + 1, 2, 9, coatDark);
  } else {
    p.fill(tx - halfW, torsoTop + 3, halfW * 2, 1, who.trim);
    p.fill(tx + face * 3, torsoTop + 1, 1, 10, coatDark);
  }

  // arms, resting on the table edge in front of them
  const armY = torsoTop + 4 + (t === 2 ? 1 : 0);
  if (side) {
    // only the near arm shows; it reaches toward whatever they are playing
    const ax = face > 0 ? cx + 2 : cx - 6;
    const reach = t === 1 ? 1 : 0;
    p.fill(ax, armY, 4, 4, sleeve);
    p.fill(ax + face * 3 + (face > 0 ? 1 : 0), armY + 3 + reach, 3, 3, sleeve);
    p.fill(ax + face * 6 + (face > 0 ? 0 : 1), armY + 5 + reach, 2, 2, who.skin);
  } else {
    const drop = t === 1 ? 1 : 0;
    p.fill(cx - 8, armY, 3, 6, sleeve);
    p.fill(cx + 5, armY - drop, 3, 6, sleeve);
    p.fill(cx - 8, armY + 6, 3, 2, who.skin);
    p.fill(cx + 5, armY + 6 - drop, 3, 2, who.skin);
  }

  const lean = dir === 'down' && t === 2 ? 1 : 0;
  head(p, who, cx + (side ? face * 2 : 0) + lean, headTop, dir, t);

  // Some of them are nursing a drink; the glass catches the room's light.
  // Only the ones facing the camera — in profile both hands are on the felt,
  // and a glass out there floats away from the body.
  if (rng.bool(0.5) && dir === 'down') {
    const gx = cx + 5;
    const gy = armY + 2;
    p.fill(gx, gy, 3, 5, withAlpha('#f6bf5d', 0.55));
    p.fill(gx, gy, 3, 1, PAL.white);
    p.fill(gx, gy + 3, 3, 2, withAlpha('#f6bf5d', 0.95));
  }

  p.outline('rgba(12,9,18,0.85)');
  return p;
}

/**
 * A head-and-shoulders bust of one of the regulars, for the seat plates at
 * the hold'em table.
 *
 * Drawn from the same cast as the people sitting in the room, so the stranger
 * who just raised you across the felt is recognisably one of the figures you
 * walked past on your way to the table.
 */
export function patronBust(key: string): Px {
  const who = PATRONS[key] ?? PATRONS.a;
  const W = 26;
  const H = 26;
  const p = new Px(W, H);
  const cx = 13;

  // a lit oval behind them, so the bust reads on any panel colour
  p.ellipse(cx, 17, 12, 11, '#241823');
  p.ellipse(cx, 16, 11, 10, '#33243055');

  // shoulders
  p.fill(cx - 8, 19, 16, 7, who.coat);
  p.fill(cx - 8, 19, 16, 1, mix(who.coat, PAL.white, 0.18));
  p.fill(cx + 7, 20, 1, 6, shade(who.coat, 0.62));
  p.poly([[cx - 4, 19], [cx, 25], [cx + 4, 19]], who.trim);
  p.poly([[cx - 2, 19], [cx, 23], [cx + 2, 19]], PAL.cloth);

  head(p, who, cx, 8, 'down', 0);
  p.outline('rgba(12,9,18,0.85)');
  return p;
}

const bustCache = new Map<string, string>();

/** The bust as a data URL, cached — the panel hands it straight to an <img>. */
export function patronBustUrl(key: string): string {
  let url = bustCache.get(key);
  if (!url) {
    url = patronBust(key).canvas.toDataURL();
    bustCache.set(key, url);
  }
  return url;
}

/** The cast, in a stable order, so a seat can pick one by index. */
export const PATRON_KEYS = Object.keys(PATRONS);

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

/**
 * The croupier at the blackjack table. Four frames: a card leaves the shoe,
 * travels out across the felt and settles, then the hand comes back. The
 * player never has to interact with them — they are there so the table is
 * never a piece of empty furniture.
 */
function croupier(t: number): Px {
  const W = 34;
  const H = 40;
  const p = new Px(W, H);
  const cx = 13;
  const feet = 37;
  const bob = t === 1 || t === 3 ? 1 : 0;

  shadow(p, cx, feet, 8, 3);

  const legTop = feet - 10;
  p.fill(cx - 4, legTop, 3, 10, '#241f2e');
  p.fill(cx + 1, legTop, 3, 10, '#241f2e');
  p.fill(cx - 5, feet - 2, 5, 2, PAL.ink);
  p.fill(cx, feet - 2, 5, 2, PAL.ink);

  const torsoTop = legTop - 12 + bob;
  // waistcoat over a white shirt — house uniform, the same crimson as the room
  p.fill(cx - 5, torsoTop, 11, 12, PAL.cloth);
  p.fill(cx - 5, torsoTop, 11, 1, PAL.white);
  p.fill(cx - 5, torsoTop + 1, 4, 11, '#6d2330');
  p.fill(cx + 2, torsoTop + 1, 4, 11, '#6d2330');
  p.fill(cx - 5, torsoTop + 1, 1, 11, '#8e2131');
  p.fill(cx + 5, torsoTop + 1, 1, 11, '#4e1723');
  p.set(cx - 2, torsoTop + 5, PAL.gold);
  p.set(cx - 2, torsoTop + 8, PAL.gold);
  // bow tie
  p.fill(cx - 2, torsoTop + 1, 5, 2, '#1c1725');
  p.set(cx, torsoTop + 1, PAL.gold);

  // arms. The left rests on the shoe; the right deals — it sweeps out across
  // the felt and comes back, and the card it releases keeps travelling for a
  // frame after the hand has started its return. Four frames is enough for
  // that to read as a deal rather than as an arm growing out of a sleeve.
  const lift = [0, 1, 1, 0][t];
  const out = [0, 3, 6, 3][t];
  p.fill(cx - 8, torsoTop + 3, 3, 7, PAL.cloth);
  p.fill(cx - 8, torsoTop + 10, 3, 2, '#d8a273');
  // upper arm, then the cuff and hand at its far end
  p.fill(cx + 5, torsoTop + 4 - lift, 2 + out, 3, PAL.cloth);
  p.fill(cx + 5, torsoTop + 4 - lift, 2 + out, 1, PAL.white);
  p.fill(cx + 7 + out, torsoTop + 4 - lift, 1, 3, '#6d2330');
  p.fill(cx + 8 + out, torsoTop + 4 - lift, 2, 3, '#d8a273');
  if (t >= 1) {
    // the card, already gone from the hand and still sliding
    const cardX = cx + 11 + out;
    const cardY = torsoTop + 3 - lift + (t === 3 ? 2 : 0);
    p.fill(cardX, cardY, 4, 6, PAL.white);
    p.fill(cardX, cardY, 4, 1, PAL.bone);
    p.fill(cardX + 3, cardY, 1, 6, PAL.bone);
    p.set(cardX + 1, cardY + 2, PAL.blood);
    p.set(cardX + 2, cardY + 4, PAL.blood);
  }

  const headTop = torsoTop - 9;
  p.fill(cx - 3, headTop, 7, 8, '#e0b48c');
  p.fill(cx - 3, headTop, 7, 1, mix('#e0b48c', PAL.white, 0.2));
  p.fill(cx - 3, headTop - 1, 7, 3, '#d9a441');
  p.fill(cx - 4, headTop, 1, 3, '#d9a441');
  p.fill(cx + 3, headTop, 1, 3, '#d9a441');
  const eye = t === 3 ? '#b08662' : PAL.ink;
  p.set(cx - 2, headTop + 4, eye);
  p.set(cx + 2, headTop + 4, eye);
  // the smile that has already worked out what you can afford to lose
  p.fill(cx - 1, headTop + 6, 3, 1, '#a8704a');

  p.outline('rgba(12,9,18,0.85)');
  return p;
}

/** The barkeep, working a glass with a cloth. */
function barkeep(t: number): Px {
  const W = 24;
  const H = 38;
  const p = new Px(W, H);
  const cx = 12;
  const feet = 35;
  const bob = t % 2;

  shadow(p, cx, feet, 7, 3);
  p.fill(cx - 4, feet - 10, 3, 10, '#2a2432');
  p.fill(cx + 1, feet - 10, 3, 10, '#2a2432');

  const torsoTop = feet - 22 + bob;
  p.fill(cx - 5, torsoTop, 10, 12, '#3f3949');
  p.fill(cx - 5, torsoTop, 10, 1, '#585165');
  p.fill(cx - 3, torsoTop + 1, 6, 11, PAL.cloth);
  p.fill(cx - 4, torsoTop + 6, 9, 6, '#6d2330');
  p.fill(cx - 4, torsoTop + 6, 9, 1, '#8e2131');

  // both hands on the glass; the polish is a small rotation frame to frame
  const gx = cx + 5 + (t === 1 ? 1 : t === 3 ? -1 : 0);
  p.fill(cx + 4, torsoTop + 2, 3, 6, '#3f3949');
  p.fill(cx - 8, torsoTop + 3, 3, 6, '#3f3949');
  p.fill(gx, torsoTop - 3, 4, 6, withAlpha(PAL.frost, 0.6));
  p.fill(gx, torsoTop - 3, 4, 1, PAL.white);
  p.fill(gx + 1, torsoTop + 3, 2, 2, withAlpha(PAL.frost, 0.8));
  p.set(gx + (t % 2), torsoTop - 2, PAL.white);

  const headTop = torsoTop - 9;
  p.fill(cx - 3, headTop, 7, 8, '#b8825a');
  p.fill(cx - 3, headTop - 2, 7, 4, '#2b2026');
  p.fill(cx - 4, headTop, 1, 3, '#2b2026');
  p.fill(cx + 3, headTop, 1, 3, '#2b2026');
  p.set(cx - 2, headTop + 4, PAL.ink);
  p.set(cx + 2, headTop + 4, PAL.ink);
  // moustache
  p.fill(cx - 2, headTop + 6, 5, 1, '#2b2026');

  p.outline('rgba(12,9,18,0.85)');
  return p;
}

/* ------------------------------------------------------------------ */
/* Furniture                                                           */
/* ------------------------------------------------------------------ */

/** The bar: a counter with a brass rail, taps, a spill mat and glassware. */
function barCounter(rng: RNG): Px {
  const W = 78;
  const H = 34;
  const p = new Px(W, H);
  shadow(p, W / 2, H - 2, 34, 5);

  // body, panelled front
  p.fill(2, 10, W - 4, 20, '#3b2415');
  p.fill(2, 10, W - 4, 2, '#6a4430');
  p.fill(2, 28, W - 4, 2, '#241408');
  for (let x = 6; x < W - 8; x += 12) {
    p.box(x, 15, 9, 11, '#2a1a0e');
    p.fill(x + 1, 16, 7, 9, '#46291d');
  }
  // top, in the same green as the tables so the room reads as one set
  p.fill(1, 6, W - 2, 5, '#6a4430');
  p.fill(1, 6, W - 2, 1, '#8a5c40');
  p.fill(3, 7, W - 6, 3, '#27713f');
  p.fill(3, 7, W - 6, 1, '#2d8049');
  // brass foot rail
  p.fill(2, 31, W - 4, 1, PAL.gold);
  p.fill(2, 32, W - 4, 1, '#8a6a2c');

  // bottles and glasses standing on it
  const bottles = ['#3c7a45', '#8e2131', '#2f6f93', '#d9a441', '#5b43a8'];
  for (let i = 0; i < 5; i++) {
    const bx = 8 + i * 13;
    const c = bottles[i % bottles.length];
    const hgt = 6 + rng.int(0, 3);
    p.fill(bx, 6 - hgt, 3, hgt, c);
    p.fill(bx, 6 - hgt, 1, hgt, mix(c, PAL.white, 0.3));
    p.set(bx + 1, 6 - hgt - 1, shade(c, 0.6));
  }
  for (const gx of [48, 56, 64]) {
    p.fill(gx, 1, 3, 5, withAlpha(PAL.frost, 0.5));
    p.fill(gx, 1, 3, 1, PAL.white);
  }
  p.outline(PAL.ink);
  return p;
}

/** Wall shelf of spirits behind the bar. */
function bottleShelf(rng: RNG): Px {
  const W = 46;
  const H = 30;
  const p = new Px(W, H);
  p.fill(0, 0, W, H, '#241408');
  p.fill(1, 1, W - 2, H - 2, '#33200f');
  for (const sy of [13, 27]) {
    p.fill(1, sy, W - 2, 2, '#6a4430');
    p.fill(1, sy, W - 2, 1, '#8a5c40');
  }
  const cols = ['#3c7a45', '#8e2131', '#2f6f93', '#d9a441', '#5b43a8', '#b2703b'];
  for (const [base, top] of [[13, 4], [27, 18]] as Array<[number, number]>) {
    for (let i = 0; i < 7; i++) {
      const bx = 3 + i * 6;
      const c = cols[rng.int(0, cols.length - 1)];
      const hgt = base - top - rng.int(0, 2);
      p.fill(bx, base - hgt, 4, hgt, c);
      p.fill(bx, base - hgt, 1, hgt, mix(c, PAL.white, 0.32));
      p.fill(bx + 1, base - hgt - 2, 2, 2, shade(c, 0.6));
      p.set(bx + 1, base - hgt + 1, withAlpha(PAL.white, 0.5));
    }
  }
  p.box(0, 0, W, H, PAL.gold);
  p.outline(PAL.ink);
  return p;
}

/**
 * The roulette wheel. Eight frames of the head turning against a ball running
 * the other way — the single most legible "this is a casino" object in the
 * room, and the only one that moves fast enough to catch the eye from the door.
 */
function roulette(t: number): Px {
  const W = 56;
  const H = 40;
  const p = new Px(W, H);
  const cx = 28;
  const cy = 22;
  shadow(p, cx, H - 3, 24, 5);

  // table under the wheel
  p.ellipse(cx, cy + 4, 26, 13, '#241408');
  p.ellipse(cx, cy + 3, 25, 12, '#6a4430');
  p.ellipse(cx, cy + 2, 24, 11, '#8a5c40');
  p.ellipse(cx, cy + 1, 21, 9.5, '#17452a');
  p.ellipse(cx, cy, 21, 9.5, '#27713f');
  // the betting layout, printed on the cloth either side of the bowl
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      p.fill(cx + sx * (18 - i * 0) - (sx < 0 ? 3 : 0), cy - 2 + i * 3, 3, 2,
        i % 2 === 0 ? '#8e2131' : '#1c1725');
    }
  }

  // the bowl
  p.ellipse(cx, cy, 17, 8, '#241408');
  p.ellipse(cx, cy - 1, 16, 7.4, '#6a4430');
  p.ellipse(cx, cy, 15, 7, '#3b2415');

  // the head: alternating red and black pockets, turning one step per frame
  const spin = (t * Math.PI * 2) / 16;
  for (let i = 0; i < 16; i++) {
    const a = spin + (i * Math.PI * 2) / 16;
    const rx = Math.cos(a) * 11;
    const ry = Math.sin(a) * 5;
    const c = i === 0 ? '#4f9a55' : i % 2 === 0 ? '#b8323a' : '#2a2432';
    p.ellipse(cx + rx, cy + ry, 2.8, 1.9, c);
    p.line(cx + rx * 0.45, cy + ry * 0.45, cx + rx, cy + ry, withAlpha(PAL.goldLit, 0.45));
  }
  // hub and the cross-handle on top of the spindle
  p.ellipse(cx, cy, 5, 2.8, '#8a6a2c');
  p.ellipse(cx, cy - 1, 3.8, 2.2, PAL.gold);
  p.fill(cx - 1, cy - 7, 2, 7, '#8a6a2c');
  p.fill(cx - 1, cy - 7, 1, 7, PAL.gold);
  p.fill(cx - 4, cy - 8, 9, 2, PAL.gold);
  p.fill(cx - 4, cy - 8, 9, 1, PAL.goldLit);
  p.ellipse(cx, cy - 10, 2, 2, PAL.goldLit);

  // the ball, running the opposite way around the rim and catching the light
  const ba = -spin * 2.5 + 1.2;
  const bx = cx + Math.cos(ba) * 14.5;
  const by = cy + Math.sin(ba) * 6.6;
  p.ellipse(bx, by, 2.2, 2, '#8d8599');
  p.ellipse(bx, by - 0.4, 1.5, 1.2, PAL.white);

  p.outline(PAL.ink);
  return p;
}

/**
 * A cocktail table: a small round top on a single column, a candle burning in
 * the middle of it and whatever the people sitting there have put down. It
 * exists to break up the floor between the big tables, which otherwise reads
 * as a field of carpet with furniture pushed to the walls.
 */
function cocktailTable(t: number, rng: RNG): Px {
  const W = 34;
  const H = 34;
  const p = new Px(W, H);
  const cx = 17;
  shadow(p, cx, H - 2, 11, 4);

  // column and foot
  p.fill(cx - 2, 20, 4, 10, '#2a1a0e');
  p.fill(cx - 2, 20, 1, 10, '#46291d');
  p.ellipse(cx, 30, 8, 3, '#241408');
  p.ellipse(cx, 29, 7, 2.4, '#46291d');

  // top: wood rim, baize inlay
  p.ellipse(cx, 20, 14, 7, '#241408');
  p.ellipse(cx, 19, 13, 6.4, '#6a4430');
  p.ellipse(cx, 18, 12, 5.8, '#8a5c40');
  p.ellipse(cx, 18, 9.5, 4.4, '#1f5a34');
  p.ellipse(cx, 17.5, 9.5, 4.4, '#27713f');

  // a candle in a brass dish, flickering
  const flame = [4, 5, 4, 3][t];
  p.ellipse(cx, 16, 4, 1.8, '#8a6a2c');
  p.ellipse(cx, 15.4, 3, 1.3, PAL.gold);
  p.fill(cx - 1, 10, 2, 5, PAL.cloth);
  p.ellipse(cx, 9, 1.5, flame * 0.4, PAL.flame);
  p.ellipse(cx, 9, 0.9, flame * 0.28, PAL.flameLit);
  p.ellipse(cx, 11, 11, 10, withAlpha(PAL.flameLit, 0.1));

  // whatever they are drinking, and a few chips left on the rim
  const gx = rng.bool() ? cx - 7 : cx + 5;
  p.fill(gx, 13, 3, 5, withAlpha('#f6bf5d', 0.55));
  p.fill(gx, 13, 3, 1, PAL.white);
  p.fill(gx, 16, 3, 2, withAlpha('#f6bf5d', 0.95));
  chipStack(p, cx + (gx > cx ? -9 : 6), 19, rng.bool() ? '#b8323a' : '#2f6f93', 2, 5);

  p.outline(PAL.ink);
  return p;
}

/**
 * The cashier's cage. Where the concept sheet puts the operator, this room
 * puts a brass grille, a scale and a till — the place the gold in your purse
 * visibly becomes the chips on the felt.
 */
function cashierCage(t: number): Px {
  const W = 46;
  const H = 46;
  const p = new Px(W, H);
  shadow(p, W / 2, H - 3, 20, 4);

  // counter
  p.fill(2, 30, W - 4, 13, '#3b2415');
  p.fill(2, 30, W - 4, 2, '#6a4430');
  p.fill(2, 41, W - 4, 2, '#241408');
  p.fill(1, 27, W - 2, 4, '#5a3b26');
  p.fill(1, 27, W - 2, 1, '#8a5c40');

  // cage: posts and a brass grille, back-lit from inside
  p.fill(3, 4, W - 6, 23, '#1a1622');
  p.fill(4, 5, W - 8, 21, withAlpha('#f6bf5d', 0.1));
  for (let x = 6; x < W - 6; x += 5) p.fill(x, 5, 1, 21, PAL.gold);
  for (let y = 7; y < 26; y += 6) p.fill(4, y, W - 8, 1, '#8a6a2c');
  p.box(3, 4, W - 6, 23, PAL.gold);
  // the teller's window, cut out of the grille
  p.fill(15, 17, 16, 9, '#241408');
  p.fill(15, 17, 16, 1, PAL.gold);

  // a brass scale on the counter, its pans rocking
  const tilt = [0, 1, 0, -1][t];
  p.fill(9, 24, 1, 6, PAL.gold);
  p.fill(5, 24 - tilt, 9, 1, PAL.goldLit);
  p.fill(5, 25 - tilt, 3, 1, '#8a6a2c');
  p.fill(11, 25 + tilt, 3, 1, '#8a6a2c');
  // chip trays, sorted by denomination
  chipStack(p, 33, 30, '#b8323a', 3, 6);
  chipStack(p, 33, 30 - 6, '#2f6f93', 2, 6);
  chipStack(p, 25, 30, '#d9a441', 4, 6);
  // a couple of coins loose on the top, glinting on the off frames
  p.ellipse(20, 29, 2, 1.2, PAL.gold);
  if (t % 2 === 0) p.set(20, 28, PAL.white);

  p.outline(PAL.ink);
  return p;
}

/** The crowned portrait of the house, hung over the back wall. */
function portrait(): Px {
  const W = 34;
  const H = 40;
  const p = new Px(W, H);
  // frame
  p.fill(0, 4, W, H - 6, '#241408');
  p.fill(1, 5, W - 2, H - 8, PAL.gold);
  p.fill(3, 7, W - 6, H - 12, '#8a6a2c');
  p.fill(4, 8, W - 8, H - 14, '#2b2026');
  // sitter: a silhouette in a crimson robe, under a crown
  p.ellipse(W / 2, H - 9, 11, 9, '#4a1a26');
  p.ellipse(W / 2, H - 9, 9, 7, '#6d2330');
  p.ellipse(W / 2, 20, 5, 6, '#c98d63');
  p.fill(W / 2 - 5, 16, 10, 3, '#3a2418');
  p.set(W / 2 - 2, 20, PAL.ink);
  p.set(W / 2 + 2, 20, PAL.ink);
  crownMark(p, W / 2, 12, 5, PAL.gold, PAL.goldLit);
  // frame crest and picture light
  crownMark(p, W / 2, 4, 4, '#8a6a2c', PAL.gold);
  p.fill(4, 6, W - 8, 1, withAlpha(PAL.goldLit, 0.5));
  p.outline(PAL.ink);
  return p;
}

/** Brass stanchion with a velvet rope, for the lane in from the door. */
function ropePost(withRope: boolean): Px {
  const W = withRope ? 34 : 12;
  const H = 30;
  const p = new Px(W, H);
  const post = (x: number) => {
    shadow(p, x, H - 2, 5, 2);
    p.ellipse(x, H - 3, 5, 2.2, '#8a6a2c');
    p.ellipse(x, H - 4, 4, 1.8, PAL.gold);
    p.fill(x - 1, 8, 2, H - 12, '#8a6a2c');
    p.fill(x - 1, 8, 1, H - 12, PAL.gold);
    p.ellipse(x, 7, 3, 2.6, PAL.gold);
    p.ellipse(x - 1, 6, 1.4, 1, PAL.goldLit);
  };
  post(5);
  if (withRope) {
    post(W - 6);
    // the rope's catenary, plus its worn top highlight
    for (let x = 5; x <= W - 6; x++) {
      const u = (x - 5) / (W - 11);
      const y = 11 + Math.sin(u * Math.PI) * 5;
      p.fill(x, y, 1, 3, '#6d2330');
      p.set(x, y, '#a63c4a');
    }
  }
  p.outline(PAL.ink);
  return p;
}

/** A potted palm, because every gaming room in history has had one. */
function pottedPalm(rng: RNG): Px {
  const W = 26;
  const H = 38;
  const p = new Px(W, H);
  const cx = 13;
  shadow(p, cx, H - 2, 9, 3);
  // pot
  p.poly([[cx - 7, 24], [cx + 7, 24], [cx + 5, H - 2], [cx - 5, H - 2]], '#8c5a3b');
  p.poly([[cx - 6, 24], [cx + 1, 24], [cx, H - 3], [cx - 4, H - 3]], '#a8724c');
  p.fill(cx - 8, 22, 16, 3, '#6d4630');
  p.fill(cx - 8, 22, 16, 1, '#b2703b');
  p.fill(cx - 6, 25, 12, 1, PAL.gold);
  // soil, then fronds
  p.ellipse(cx, 24, 6, 1.6, '#3a2a20');
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42 + rng.range(-0.08, 0.08);
    const len = 12 + rng.int(0, 5);
    const tipX = cx + Math.cos(a) * len;
    const tipY = 23 + Math.sin(a) * len;
    const c = i % 2 === 0 ? '#345e32' : '#4f823e';
    p.line(cx, 23, tipX, tipY, c);
    for (let k = 3; k < len; k += 2) {
      const bx = cx + Math.cos(a) * k;
      const by = 23 + Math.sin(a) * k;
      p.set(bx + Math.cos(a + 1.5) * 2, by + Math.sin(a + 1.5) * 2, c);
      p.set(bx + Math.cos(a - 1.5) * 2, by + Math.sin(a - 1.5) * 2, shade(c, 0.85));
    }
  }
  p.outline(PAL.ink);
  return p;
}

/**
 * A gold wall sconce. Replaces the generic torch in here: the Gilded Spade is
 * lit by brass and candle, not by a brand jammed in a bracket.
 */
function sconce(t: number): Px {
  const W = 14;
  const H = 24;
  const p = new Px(W, H);
  const cx = 7;
  // back plate and arm
  p.fill(cx - 3, 10, 6, 12, '#8a6a2c');
  p.fill(cx - 2, 11, 4, 10, PAL.gold);
  spade(p, cx, 16, 2.5, '#5e1220');
  p.fill(cx - 1, 6, 2, 5, '#8a6a2c');
  p.ellipse(cx, 6, 4, 1.6, PAL.gold);
  // candle and flame
  p.fill(cx - 1, 2, 2, 4, PAL.cloth);
  const h = [4, 5, 4, 3][t];
  p.ellipse(cx, 1, 1.6, h * 0.42, PAL.flame);
  p.ellipse(cx, 1, 1, h * 0.3, PAL.flameLit);
  p.ellipse(cx, 2, 7, 7, withAlpha(PAL.flameLit, 0.12));
  p.outline(PAL.ink, false);
  return p;
}

/**
 * Cigar smoke. Pure dressing, drawn flat and translucent so it drifts over the
 * carpet without ever hiding anything the player needs to see.
 */
function smoke(t: number): Px {
  const W = 22;
  const H = 34;
  const p = new Px(W, H);
  for (let i = 0; i < 6; i++) {
    const u = ((t / 8) + i / 6) % 1;
    const y = H - 2 - u * (H - 6);
    const x = W / 2 + Math.sin(u * 5 + i) * 4.5;
    const r = 1.8 + u * 4;
    // It thins as it climbs; anything denser than this starts hiding the
    // people it is supposed to be rising off.
    p.ellipse(x, y, r, r * 0.8, withAlpha('#cfc5b4', 0.3 * (1 - u) ** 1.4));
    p.set(x - r * 0.4, y - r * 0.3, withAlpha('#efe6d6', 0.18 * (1 - u)));
  }
  return p;
}

/** A coin catching the light on the carpet — a flat, blinking floor detail. */
function coinGlint(t: number): Px {
  const p = new Px(10, 8);
  p.ellipse(5, 5, 3.4, 2, '#8a6a2c');
  p.ellipse(5, 4.4, 2.6, 1.5, PAL.gold);
  p.ellipse(4.2, 4, 1.2, 0.8, PAL.goldLit);
  if (t === 1) {
    p.set(5, 1, withAlpha(PAL.white, 0.85));
    p.set(1, 4, withAlpha(PAL.white, 0.5));
    p.set(8, 4, withAlpha(PAL.white, 0.5));
  }
  return p;
}

/**
 * The centrepiece rug, drawn once at its true size instead of tiled.
 *
 * This is the piece that fixes the floor. A rug assembled out of 32px tiles
 * can only ever have its border repeat inside every tile, which is what made
 * the old room read as graph paper. Authored whole, the gold trim runs
 * unbroken around the edge and mitres at the corners the way a real rug does.
 */
function rug(rng: RNG): Px {
  const W = 184;
  const H = 136;
  const p = new Px(W, H);
  const base = '#4d1119';
  const deep = '#380b12';
  const lit = '#671a25';

  p.fill(0, 0, W, H, base);
  for (let i = 0; i < 1100; i++) {
    p.set(rng.int(0, W - 1), rng.int(0, H - 1), rng.bool(0.5) ? deep : lit);
  }
  // field medallion: concentric rings with a spade at the centre
  p.ellipse(W / 2, H / 2, 50, 36, withAlpha(deep, 0.8));
  p.ellipse(W / 2, H / 2, 46, 32, withAlpha(base, 0.9));
  for (let a = 0; a < 200; a++) {
    const r = (a / 200) * Math.PI * 2;
    p.set(W / 2 + Math.cos(r) * 43, H / 2 + Math.sin(r) * 30, withAlpha(PAL.gold, 0.32));
    p.set(W / 2 + Math.cos(r) * 29, H / 2 + Math.sin(r) * 20, withAlpha(PAL.gold, 0.2));
  }
  spade(p, W / 2, H / 2, 14, withAlpha(PAL.gold, 0.3));
  spade(p, W / 2, H / 2 - 1, 12, withAlpha('#8a6a2c', 0.45));

  // corner fans
  for (const [ox, oy, sx, sy] of [
    [16, 14, 1, 1], [W - 16, 14, -1, 1], [16, H - 14, 1, -1], [W - 16, H - 14, -1, -1],
  ] as Array<[number, number, number, number]>) {
    for (let i = 0; i < 4; i++) {
      p.line(ox, oy, ox + sx * (8 + i * 6), oy + sy * (16 - i * 4), withAlpha(PAL.gold, 0.26));
    }
    p.ellipse(ox, oy, 3, 3, withAlpha(PAL.gold, 0.3));
  }

  // trim: a broad dark band, a bright gold key line, mitred by construction
  p.box(4, 4, W - 8, H - 8, '#2f0d15');
  p.box(5, 5, W - 10, H - 10, '#2f0d15');
  p.box(7, 7, W - 14, H - 14, PAL.gold);
  p.box(8, 8, W - 16, H - 16, '#8a6a2c');
  p.box(12, 12, W - 24, H - 24, withAlpha(PAL.gold, 0.4));
  // a Greek-key dash running the trim channel
  for (let x = 10; x < W - 10; x += 8) {
    p.fill(x, 9, 4, 2, withAlpha(PAL.goldLit, 0.4));
    p.fill(x, H - 11, 4, 2, withAlpha(PAL.goldLit, 0.4));
  }
  for (let y = 10; y < H - 10; y += 8) {
    p.fill(9, y, 2, 4, withAlpha(PAL.goldLit, 0.4));
    p.fill(W - 11, y, 2, 4, withAlpha(PAL.goldLit, 0.4));
  }
  // fringe along the short ends
  for (let x = 2; x < W - 2; x += 3) {
    p.fill(x, 0, 2, 3, withAlpha('#c9b184', 0.55));
    p.fill(x, H - 3, 2, 3, withAlpha('#c9b184', 0.55));
  }
  return p;
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

type Gen = (rng: RNG) => CasinoArt;

const GEN: Record<string, Gen> = {};

// Seated patrons: one entry per cast member per facing.
for (const [key, who] of Object.entries(PATRONS)) {
  for (const dir of ['up', 'down', 'left', 'right'] as const) {
    GEN[`casino_sit_${dir}_${key}`] = (rng) => {
      // Each frame gets its own rng seeded identically, so the patron's drink
      // is decided once and does not blink in and out as the idle cycles.
      void rng;
      const frames = [0, 1, 2, 3].map((t) =>
        sitter(who, dir, t, new RNG(`casino_sit:${dir}:${key}`)));
      return art(frames, SITTER_FEET, 2.4);
    };
  }
}

GEN.casino_croupier = () => art([0, 1, 2, 3].map(croupier), 37, 3.2);
GEN.casino_barkeep = () => art([0, 1, 2, 3].map(barkeep), 35, 2.6);
GEN.casino_bar = (rng) => art([barCounter(rng)], 32);
GEN.casino_shelf = (rng) => art([bottleShelf(rng)], 30);
GEN.casino_roulette = () => art([0, 1, 2, 3, 4, 5, 6, 7].map(roulette), 38, 9);
GEN.casino_cashier = () => art([0, 1, 2, 3].map(cashierCage), 44, 2);
GEN.casino_cocktail = () => art([0, 1, 2, 3].map((t) => cocktailTable(t, new RNG('casino:cocktail'))), 32, 7);
GEN.casino_portrait = () => art([portrait()], 40);
GEN.casino_rope = () => art([ropePost(true)], 29);
GEN.casino_post = () => art([ropePost(false)], 29);
GEN.casino_palm = (rng) => art([pottedPalm(rng)], 37);
GEN.casino_sconce = () => art([0, 1, 2, 3].map(sconce), 22, 8);
GEN.casino_smoke = () => art([0, 1, 2, 3, 4, 5, 6, 7].map(smoke), 28, 4);
GEN.casino_glint = () => art([0, 1].map(coinGlint), 7, 1.2);
GEN.casino_rug = (rng) => art([rug(rng)]);

export const CASINO_PROP_NAMES = Object.keys(GEN);

export function getCasinoProp(name: string): CasinoArt | undefined {
  const gen = GEN[name];
  if (!gen) return undefined;
  let hit = cache.get(name);
  if (!hit) {
    hit = gen(new RNG(`casino:${name}`));
    cache.set(name, hit);
  }
  return hit;
}
