import { PAL, mix, withAlpha } from './palette';
import { Px } from './pixel';
import { RNG } from '../core/rng';
import { slotBlur, slotSymbol } from './casino';
import { SLOT_REEL, SLOT_TRIPLE, SLOT_TWO_CHERRY, STAKES, type SlotSymbol } from '../casino/games';

/**
 * The slot machine in the Gilded Spade, drawn as a machine.
 *
 * The first version of this screen was a dialog box: a title bar with an ×,
 * a row of stake buttons, a SPIN button and a pay table in a list. It told
 * you everything and looked like a settings panel. A slot machine is not a
 * form — it is an object you stand in front of, put a coin into and pull a
 * handle on, and every piece of information it gives you is printed on its
 * own body.
 *
 * So this is one cabinet, drawn at 1:1 pixel scale and blown up with nearest
 * neighbour, exactly like every sprite in the world. The pay table is silk-
 * screened on the belly glass. The stake is five coin slots along the front.
 * The credit and the win are lamp displays. There is no button that says
 * SPIN: there is a handle on the right, and you pull it.
 *
 * Everything here is drawing. What the reels are doing lives in
 * `game/casino/slotMachine.ts` and ticks in game time.
 */

/* ------------------------------------------------------------------ */
/* Geometry — the whole cabinet in one place                           */
/* ------------------------------------------------------------------ */

// Wide enough for the handle bolted to the right cheek — the cabinet itself
// only occupies the left 142 pixels of it.
export const CAB_W = 172;
export const CAB_H = 302;

/** Cabinet body, not counting the handle that sticks out to the right. */
const BODY_X = 10;
const BODY_W = 132;
const BODY_TOP = 20;

/** The reel window's glass, inside its brass frame. */
export const GLASS_X = 26;
export const GLASS_Y = 84;
export const GLASS_W = 100;
export const GLASS_H = 84;
/** One symbol cell. Three of them fill the glass exactly. */
export const CELL = 28;
/** Left edge of each reel's 31px column. */
export const REEL_X = [27, 60, 93];
export const REEL_W = 31;
/** Top of the middle row — the one the pay line runs through. */
export const ROW_Y = GLASS_Y + CELL;

/**
 * The handle: a knob on a rod in a vertical guide, bolted to the right cheek.
 *
 * It ran on a pivot at first and swung its knob through a hundred and fifty
 * degrees, which read as the handle going round in a circle rather than being
 * pulled. It is a straight pull now — down the guide and back up on its
 * spring — which is both what the hand expects and what the pointer can
 * actually follow.
 */
export const LEVER_X = 152;
export const LEVER_TOP = 96;
export const LEVER_BOTTOM = 166;
export const LEVER_KNOB = 8;

/** Where the knob sits for a given pull, 0 at rest and 1 fully down. */
export function leverKnob(v: number): { x: number; y: number } {
  return { x: LEVER_X, y: LEVER_TOP + (LEVER_BOTTOM - LEVER_TOP) * v };
}

/** How far down its travel a point is. Straight down the guide, nothing else. */
export function leverValueAt(_x: number, y: number): number {
  return Math.max(0, Math.min(1, (y - LEVER_TOP) / (LEVER_BOTTOM - LEVER_TOP)));
}

/** Which coin slot a point is over, or -1. */
export function slotAt(x: number, y: number): number {
  if (y < SLOT_ROW_Y - 3 || y > SLOT_ROW_Y + SLOT_ROW_H + 3) return -1;
  for (let i = 0; i < 5; i++) {
    const sx = slotSlotX(i);
    if (x >= sx - 2 && x <= sx + SLOT_SLOT_W + 2) return i;
  }
  return -1;
}

/** The five coin slots along the front, left to right. */
export const SLOT_ROW_Y = 250;
export const SLOT_ROW_H = 13;
export const slotSlotX = (i: number): number => 27 + i * 20;
export const SLOT_SLOT_W = 16;

/** The payout tray at the bottom, where coins land. */
export const TRAY_X = 24;
export const TRAY_Y = 276;
export const TRAY_W = 104;
export const TRAY_H = 18;

/** Where coins fall out of, on a win. */
export const CHUTE_X = 76;
export const CHUTE_Y = 268;

/* ------------------------------------------------------------------ */
/* A 3x5 pixel alphabet                                                */
/* ------------------------------------------------------------------ */

/**
 * Small enough to letter a machine with, and crisp at any integer zoom
 * because it is pixels rather than a web font. The cards in `casino.ts` carry
 * their own three-row pip font for rank indices; this one is the full set,
 * because a cabinet has words on it.
 */
const FONT: Record<string, string[]> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '111', '011'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '011'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  ' ': ['000', '000', '000', '000', '000'],
  '-': ['000', '000', '111', '000', '000'],
  '.': ['000', '000', '000', '000', '010'],
  ',': ['000', '000', '000', '010', '010'],
  '!': ['010', '010', '010', '000', '010'],
  '?': ['110', '001', '010', '000', '010'],
  ':': ['000', '010', '000', '010', '000'],
  "'": ['010', '010', '000', '000', '000'],
  '+': ['000', '010', '111', '010', '000'],
  '=': ['000', '111', '000', '111', '000'],
  '/': ['001', '001', '010', '100', '100'],
  '*': ['101', '010', '101', '000', '000'],
};

const GLYPH_W = 4;
export const TEXT_H = 5;

/** Width a string will occupy at this font's fixed pitch. */
export const textWidth = (s: string): number => Math.max(0, s.length * GLYPH_W - 1);

/** Draw a string of the pixel alphabet. Unknown characters are skipped. */
export function text(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string,
): void {
  ctx.fillStyle = color;
  let cx = x;
  for (const raw of s.toUpperCase()) {
    const rows = FONT[raw];
    if (rows) {
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < 3; rx++) if (row[rx] === '1') ctx.fillRect(cx + rx, y + ry, 1, 1);
      });
    }
    cx += GLYPH_W;
  }
}

/** The same, centred on `cx`. */
export function textCentered(
  ctx: CanvasRenderingContext2D, s: string, cx: number, y: number, color: string,
): void {
  text(ctx, s, Math.round(cx - textWidth(s) / 2), y, color);
}

/* ------------------------------------------------------------------ */
/* Lamp displays                                                       */
/* ------------------------------------------------------------------ */

/** Segment map per digit: top, top-left, top-right, middle, bottom-left, bottom-right, bottom. */
const SEGMENTS: Record<string, string> = {
  '0': '1110111', '1': '0010010', '2': '1011101', '3': '1011011', '4': '0111010',
  '5': '1101011', '6': '1101111', '7': '1010010', '8': '1111111', '9': '1111011',
  '-': '0001000', ' ': '0000000',
};

/**
 * One seven-segment digit, with its dark segments left faintly visible.
 *
 * The unlit segments matter: a display that only draws the lit ones reads as
 * floating sticks, while a real lamp panel shows you the whole figure eight
 * behind the number.
 */
function digit(
  ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, on: string, off: string,
): void {
  const map = SEGMENTS[ch] ?? SEGMENTS[' '];
  const bar = (i: number, bx: number, by: number, bw: number, bh: number) => {
    ctx.fillStyle = map[i] === '1' ? on : off;
    ctx.fillRect(x + bx, y + by, bw, bh);
  };
  bar(0, 1, 0, 2, 1);   // top
  bar(1, 0, 1, 1, 2);   // top-left
  bar(2, 3, 1, 1, 2);   // top-right
  bar(3, 1, 3, 2, 1);   // middle
  bar(4, 0, 4, 1, 2);   // bottom-left
  bar(5, 3, 4, 1, 2);   // bottom-right
  bar(6, 1, 6, 2, 1);   // bottom
}

/** Width of one lamp digit including the gap after it. */
export const LAMP_PITCH = 6;

/** A right-aligned run of seven-segment digits. */
export function lampNumber(
  ctx: CanvasRenderingContext2D, value: number, right: number, y: number, places: number,
  on = '#ff7a4a', off = 'rgba(120,40,24,0.34)',
): void {
  const s = String(Math.max(0, Math.round(value))).slice(-places).padStart(places, ' ');
  for (let i = 0; i < places; i++) {
    digit(ctx, s[i], right - (places - i) * LAMP_PITCH, y, on, off);
  }
}

/* ------------------------------------------------------------------ */
/* Small reel symbols, for the pay table                               */
/* ------------------------------------------------------------------ */

const tinyCache = new Map<SlotSymbol, Px>();

/**
 * A 10px version of each reel symbol.
 *
 * Drawn rather than scaled: shrinking the 28px symbol to ten pixels turns the
 * cherries into a brown smudge and the seven into a blob, and the pay table is
 * the one place on the machine a player actually has to read.
 */
export function tinySymbol(sym: SlotSymbol): Px {
  const hit = tinyCache.get(sym);
  if (hit) return hit;
  const p = new Px(10, 10);
  if (sym === 'cherry') {
    p.line(5, 1, 3, 5, '#3c7a45');
    p.line(5, 1, 7, 5, '#3c7a45');
    p.ellipse(3, 7, 2.4, 2.4, '#b8323a');
    p.ellipse(7, 7, 2.4, 2.4, '#8e2131');
    p.set(2, 6, '#e8757a');
  } else if (sym === 'bell') {
    p.poly([[5, 1], [8, 6], [9, 8], [1, 8], [2, 6]], PAL.gold);
    p.poly([[5, 2], [7, 6], [7, 7], [3, 7], [4, 6]], PAL.goldLit);
    p.fill(1, 8, 8, 1, '#8a6a2c');
    p.set(5, 9, PAL.goldLit);
  } else if (sym === 'seven') {
    p.fill(2, 1, 6, 2, '#c8383f');
    p.fill(6, 3, 2, 2, '#c8383f');
    p.fill(5, 5, 2, 2, '#c8383f');
    p.fill(4, 7, 2, 2, '#c8383f');
    p.fill(2, 1, 6, 1, '#e8757a');
  } else if (sym === 'crown') {
    p.poly([[1, 8], [2, 2], [5, 5], [8, 2], [9, 8]], PAL.gold);
    p.fill(1, 8, 9, 1, '#8a6a2c');
    p.set(5, 4, PAL.white);
    p.set(2, 3, '#b8323a');
    p.set(8, 3, '#b8323a');
  } else {
    p.poly([[5, 1], [9, 6], [5, 8], [1, 6]], '#2e2740');
    p.ellipse(3, 6, 2, 2, '#2e2740');
    p.ellipse(7, 6, 2, 2, '#2e2740');
    p.fill(4, 6, 2, 3, '#2e2740');
    p.set(3, 4, withAlpha(PAL.white, 0.3));
  }
  tinyCache.set(sym, p);
  return p;
}

/* ------------------------------------------------------------------ */
/* The cabinet body                                                    */
/* ------------------------------------------------------------------ */

let bodyCache: Px | null = null;

/** Rounded brass bezel used for the glass, the belly and the tray. */
function bezel(p: Px, x: number, y: number, w: number, h: number): void {
  p.fill(x - 3, y - 3, w + 6, h + 6, '#5d4a1e');
  p.fill(x - 2, y - 2, w + 4, h + 4, PAL.gold);
  p.fill(x - 2, y - 2, w + 4, 1, PAL.goldLit);
  p.fill(x - 2, y + h + 1, w + 4, 1, '#5d4a1e');
  p.fill(x - 1, y - 1, w + 2, h + 2, '#2a1a0e');
}

/**
 * The parts of the machine that never move: the case, the marquee board, the
 * bezels, the silk-screened pay table, the coin slots and the tray. Drawn
 * once into an offscreen and blitted under the moving parts every frame.
 */
export function cabinetBody(): Px {
  if (bodyCache) return bodyCache;
  const p = new Px(CAB_W, CAB_H);
  const rng = new RNG('slot:cabinet');
  const wood = '#4a2c19';
  const woodLit = '#6a4430';
  const woodDark = '#2a1a0e';

  // --- shadow the whole machine sits in ---
  p.ellipse(CAB_W / 2, CAB_H - 4, 74, 9, 'rgba(8,6,12,0.5)');

  // --- case: a tall walnut box with a shouldered top and a kicked-out base ---
  p.fill(BODY_X, BODY_TOP, BODY_W, CAB_H - BODY_TOP - 8, wood);
  p.fill(BODY_X, BODY_TOP, BODY_W, 2, woodLit);
  p.fill(BODY_X, BODY_TOP, 3, CAB_H - BODY_TOP - 8, mix(wood, PAL.white, 0.12));
  p.fill(BODY_X + BODY_W - 4, BODY_TOP, 4, CAB_H - BODY_TOP - 8, woodDark);
  p.fill(BODY_X - 3, CAB_H - 16, BODY_W + 6, 8, '#3b2415');
  p.fill(BODY_X - 3, CAB_H - 16, BODY_W + 6, 1, woodLit);
  p.fill(BODY_X - 3, CAB_H - 9, BODY_W + 6, 1, woodDark);
  // grain, so the case is not a flat brown rectangle
  for (let i = 0; i < 90; i++) {
    const gx = BODY_X + rng.int(1, BODY_W - 2);
    const gy = BODY_TOP + rng.int(2, CAB_H - BODY_TOP - 14);
    p.fill(gx, gy, rng.int(2, 7), 1, rng.bool() ? withAlpha(woodDark, 0.4) : withAlpha(woodLit, 0.3));
  }

  // --- shoulders: the case narrows above the glass into the marquee ---
  p.poly([[BODY_X, BODY_TOP + 10], [BODY_X + 8, BODY_TOP], [BODY_X, BODY_TOP]], woodDark);
  p.poly([
    [BODY_X + BODY_W - 1, BODY_TOP + 10], [BODY_X + BODY_W - 9, BODY_TOP], [BODY_X + BODY_W - 1, BODY_TOP],
  ], woodDark);

  // --- marquee board ---
  bezel(p, 22, 26, 108, 44);
  p.fill(22, 26, 108, 44, '#6d2330');
  p.fill(22, 26, 108, 2, '#8e2131');
  p.fill(22, 68, 108, 2, '#4e1723');
  // a damask wash over the crimson, the same trick the carpet uses
  for (let y = 28; y < 68; y += 4) {
    for (let x = 24; x < 128; x += 8) {
      p.set(x + ((y / 4) % 2 ? 4 : 0), y, withAlpha('#8e2131', 0.7));
    }
  }
  // the house crown, embossed
  const crown = (cx: number, cy: number, s: number, c: string) => p.poly([
    [cx - s, cy + s * 0.6], [cx - s * 0.7, cy - s * 0.6], [cx - s * 0.32, cy],
    [cx, cy - s], [cx + s * 0.32, cy], [cx + s * 0.7, cy - s * 0.6], [cx + s, cy + s * 0.6],
  ], c);
  crown(76, 40, 9, '#5d4a1e');
  crown(76, 39, 9, PAL.gold);
  crown(76, 38, 7, PAL.goldLit);
  p.fill(66, 45, 20, 2, PAL.gold);

  // --- reel window frame ---
  bezel(p, GLASS_X, GLASS_Y, GLASS_W, GLASS_H);
  // --- pay line pointers, cast into the frame either side of the glass ---
  for (const dir of [-1, 1] as const) {
    const bx = dir < 0 ? GLASS_X - 9 : GLASS_X + GLASS_W + 3;
    p.poly(dir < 0
      ? [[bx, ROW_Y + 14], [bx + 6, ROW_Y + 10], [bx + 6, ROW_Y + 18]]
      : [[bx + 6, ROW_Y + 14], [bx, ROW_Y + 10], [bx, ROW_Y + 18]], '#8a6a2c');
  }

  // --- belly glass, with the pay table silk-screened on it ---
  bezel(p, 24, 202, 104, 44);
  p.fill(24, 202, 104, 44, '#1b1422');
  p.fill(24, 202, 104, 1, '#33243a');

  // --- coin slots ---
  for (let i = 0; i < 5; i++) {
    const x = slotSlotX(i);
    p.fill(x - 1, SLOT_ROW_Y - 1, SLOT_SLOT_W + 2, SLOT_ROW_H + 2, '#5d4a1e');
    p.fill(x, SLOT_ROW_Y, SLOT_SLOT_W, SLOT_ROW_H, '#8a6a2c');
    p.fill(x, SLOT_ROW_Y, SLOT_SLOT_W, 1, PAL.goldLit);
    // the slit a coin goes into
    p.fill(x + 3, SLOT_ROW_Y + 2, SLOT_SLOT_W - 6, 2, '#160f0a');
  }

  // --- payout tray: a recess under a brass lip ---
  p.fill(TRAY_X - 3, TRAY_Y - 4, TRAY_W + 6, 4, '#8a6a2c');
  p.fill(TRAY_X - 3, TRAY_Y - 4, TRAY_W + 6, 1, PAL.goldLit);
  p.fill(TRAY_X, TRAY_Y, TRAY_W, TRAY_H, '#160f0a');
  p.fill(TRAY_X, TRAY_Y, TRAY_W, 2, '#241408');
  p.fill(TRAY_X, TRAY_Y + TRAY_H - 2, TRAY_W, 2, '#3b2415');
  // the chute the coins come out of
  p.fill(CHUTE_X - 9, TRAY_Y - 8, 18, 5, '#160f0a');
  p.fill(CHUTE_X - 9, TRAY_Y - 9, 18, 1, '#8a6a2c');

  // --- the handle's guide, bolted to the right cheek ---
  // a bracket off the case, then the channel the rod slides in
  p.fill(BODY_X + BODY_W - 4, LEVER_TOP - 8, LEVER_X - BODY_X - BODY_W + 2, 7, '#5d4a1e');
  p.fill(BODY_X + BODY_W - 4, LEVER_TOP - 8, LEVER_X - BODY_X - BODY_W + 2, 2, '#8a6a2c');
  p.fill(BODY_X + BODY_W - 4, LEVER_BOTTOM + 2, LEVER_X - BODY_X - BODY_W + 2, 7, '#5d4a1e');
  p.fill(BODY_X + BODY_W - 4, LEVER_BOTTOM + 2, LEVER_X - BODY_X - BODY_W + 2, 2, '#8a6a2c');
  p.fill(LEVER_X - 4, LEVER_TOP - 8, 8, LEVER_BOTTOM - LEVER_TOP + 17, '#3b2c10');
  p.fill(LEVER_X - 3, LEVER_TOP - 7, 6, LEVER_BOTTOM - LEVER_TOP + 15, '#241408');
  p.fill(LEVER_X - 3, LEVER_TOP - 7, 1, LEVER_BOTTOM - LEVER_TOP + 15, '#5d4a1e');

  p.outline('rgba(8,6,12,0.75)');
  bodyCache = p;
  return p;
}

/* ------------------------------------------------------------------ */
/* Per-frame pieces                                                    */
/* ------------------------------------------------------------------ */

/** Everything the renderer needs to know, handed over by the machine. */
export interface SlotView {
  /** Seconds the panel has been open, for chases and glare. */
  t: number;
  /** Fractional position of each reel along the strip. */
  pos: [number, number, number];
  /** How fast each reel is turning, in cells per second. */
  speed: [number, number, number];
  /** 0 at rest, 1 fully pulled. */
  lever: number;
  /** True while the pointer is on the knob. */
  leverHot: boolean;
  stake: number;
  credit: number;
  win: number;
  /** Pay multiple of the result on the reels, 0 for a loss or mid-spin. */
  paid: number;
  /** Which reels are part of a winning line. */
  hit: [boolean, boolean, boolean];
  /** Counts down after a win; drives lights, rays and the bell. */
  celebrate: number;
  /** Counts down while the top bell is ringing. */
  bell: number;
  /** Rises while the third reel is being held back on a near thing. */
  anticipation: number;
  /** Coins in flight out of the chute. */
  coins: Array<{ x: number; y: number; r: number }>;
  /** How many coins are lying in the tray. */
  tray: number;
  /** Counts down after a coin is put in, per slot. */
  insert: number[];
  /** Rises while the machine is left alone. */
  attract: number;
  /** The line printed under the reels. */
  message: string;
  jackpot: boolean;
}

/** The strip symbol at an absolute cell index. */
const stripAt = (i: number): SlotSymbol => SLOT_REEL[((i % SLOT_REEL.length) + SLOT_REEL.length) % SLOT_REEL.length];

/** Bulb positions around the marquee, walking clockwise from top-left. */
const BULBS: Array<[number, number]> = (() => {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < 9; i++) out.push([26 + i * 12.5, 22]);
  out.push([130, 34], [130, 48], [130, 62]);
  for (let i = 8; i >= 0; i--) out.push([26 + i * 12.5, 74]);
  out.push([22, 62], [22, 48], [22, 34]);
  return out;
})();

/**
 * Draw the whole machine into a 176x266 context.
 *
 * The caller scales the canvas up with nearest-neighbour filtering, so every
 * coordinate in here is a real pixel of the sprite and integers matter.
 */
export function drawCabinet(ctx: CanvasRenderingContext2D, v: SlotView): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CAB_W, CAB_H);

  const shake = v.bell > 0 ? Math.round(Math.sin(v.bell * 42) * 2) : 0;
  ctx.save();
  ctx.translate(shake, 0);

  ctx.drawImage(cabinetBody().canvas, 0, 0);
  drawReels(ctx, v);
  drawTopBell(ctx, v);
  drawMarquee(ctx, v);
  drawGlassOverlay(ctx, v);
  drawPayTable(ctx, v);
  drawDisplays(ctx, v);
  drawCoinSlots(ctx, v);
  drawTray(ctx, v);
  drawLever(ctx, v);

  ctx.restore();
}

/* ---- the reels themselves ---- */

function drawReels(ctx: CanvasRenderingContext2D, v: SlotView): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(GLASS_X, GLASS_Y, GLASS_W, GLASS_H);
  ctx.clip();

  for (let i = 0; i < 3; i++) {
    const x = REEL_X[i];
    // the drum behind the symbols, lit down the middle and dark at the edges
    ctx.fillStyle = '#d8cfc4';
    ctx.fillRect(x, GLASS_Y, REEL_W, GLASS_H);
    const grad = ctx.createLinearGradient(0, GLASS_Y, 0, GLASS_Y + GLASS_H);
    grad.addColorStop(0, 'rgba(24,16,28,0.72)');
    grad.addColorStop(0.32, 'rgba(24,16,28,0.05)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grad.addColorStop(0.68, 'rgba(24,16,28,0.05)');
    grad.addColorStop(1, 'rgba(24,16,28,0.72)');

    const pos = v.pos[i];
    const base = Math.floor(pos);
    const off = (pos - base) * CELL;
    const fast = Math.abs(v.speed[i]) > 6;
    for (let k = -1; k <= 2; k++) {
      const sym = stripAt(base + k);
      const y = Math.round(ROW_Y - off - k * CELL);
      if (y > GLASS_Y + GLASS_H || y + CELL < GLASS_Y) continue;
      const art = fast ? slotBlur(sym) : slotSymbol(sym);
      ctx.drawImage(art.canvas, x + 2, y);
      // the hairline between two cells of the strip
      if (!fast) {
        ctx.fillStyle = 'rgba(40,28,20,0.22)';
        ctx.fillRect(x, y + CELL - 1, REEL_W, 1);
      }
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x, GLASS_Y, REEL_W, GLASS_H);

    // a winning reel gets its own lamp behind the middle cell
    if (v.hit[i] && v.celebrate > 0) {
      const pulse = 0.28 + Math.abs(Math.sin(v.celebrate * 7)) * 0.34;
      ctx.fillStyle = withAlpha(PAL.goldLit, pulse);
      ctx.fillRect(x, ROW_Y, REEL_W, CELL);
    }
    // the reel being held back on a near thing shivers in its own light
    if (v.anticipation > 0 && i === 2) {
      ctx.fillStyle = withAlpha('#6fd0e8', 0.1 + Math.abs(Math.sin(v.t * 14)) * 0.12);
      ctx.fillRect(x, GLASS_Y, REEL_W, GLASS_H);
    }
  }
  ctx.restore();
}

/* ---- glass: pay line, glare, attract lettering ---- */

function drawGlassOverlay(ctx: CanvasRenderingContext2D, v: SlotView): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(GLASS_X, GLASS_Y, GLASS_W, GLASS_H);
  ctx.clip();

  // the brass strips between the drums, drawn over the reels so a symbol
  // cannot spill from one window into the next
  for (const x of [GLASS_X + 32, GLASS_X + 65]) {
    ctx.fillStyle = '#8a6a2c';
    ctx.fillRect(x, GLASS_Y, 2, GLASS_H);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(x, GLASS_Y, 1, GLASS_H);
  }

  // the pay line, brighter while it is paying
  const lineLit = v.celebrate > 0 ? 0.5 + Math.abs(Math.sin(v.celebrate * 9)) * 0.5 : 0.5;
  ctx.fillStyle = withAlpha('#c8383f', lineLit);
  ctx.fillRect(GLASS_X, ROW_Y + CELL / 2 - 1, GLASS_W, 1);

  // a sheen that slides across the glass every few seconds
  const glare = (v.t * 34) % 320;
  if (glare < GLASS_W + 60) {
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = PAL.white;
    ctx.beginPath();
    ctx.moveTo(GLASS_X + glare - 40, GLASS_Y + GLASS_H);
    ctx.lineTo(GLASS_X + glare - 22, GLASS_Y + GLASS_H);
    ctx.lineTo(GLASS_X + glare + 12, GLASS_Y);
    ctx.lineTo(GLASS_X + glare - 6, GLASS_Y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // left alone long enough, the machine starts asking
  if (v.attract > 0) {
    const blink = Math.sin(v.t * 5) > -0.2;
    ctx.fillStyle = withAlpha('#160f0a', 0.62 * v.attract);
    ctx.fillRect(GLASS_X, ROW_Y + 4, GLASS_W, 20);
    if (blink) {
      textCentered(ctx, 'PULL THE HANDLE', GLASS_X + GLASS_W / 2, ROW_Y + 10, withAlpha(PAL.goldLit, v.attract));
    }
  }

  // a burst of rays behind a jackpot
  if (v.jackpot && v.celebrate > 0) {
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = PAL.goldLit;
    const cx = GLASS_X + GLASS_W / 2;
    const cy = ROW_Y + CELL / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + v.t * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120);
      ctx.lineTo(cx + Math.cos(a + 0.16) * 120, cy + Math.sin(a + 0.16) * 120);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();

  // the line printed on the frame under the glass
  textCentered(ctx, v.message, CAB_W / 2 - 4, GLASS_Y + GLASS_H + 6, v.celebrate > 0 ? PAL.goldLit : '#c9b184');
}

/* ---- marquee: bulbs and the house name ---- */

function drawMarquee(ctx: CanvasRenderingContext2D, v: SlotView): void {
  const winning = v.celebrate > 0;
  BULBS.forEach(([x, y], i) => {
    // Idle: a chase running clockwise. Paying: every other bulb, strobing.
    const lit = winning
      ? (i + Math.floor(v.celebrate * 12)) % 2 === 0
      : (i - Math.floor(v.t * 9)) % 4 === 0;
    const c = lit ? PAL.goldLit : '#6a521f';
    ctx.fillStyle = '#3b2c10';
    ctx.fillRect(x - 2, y - 2, 4, 4);
    ctx.fillStyle = c;
    ctx.fillRect(x - 1, y - 2, 2, 4);
    ctx.fillRect(x - 2, y - 1, 4, 2);
    if (lit) {
      ctx.fillStyle = withAlpha(PAL.goldLit, 0.22);
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }
  });

  textCentered(ctx, 'THE GILDED SPADE', 76, 52, PAL.goldLit);
  textCentered(ctx, v.jackpot && v.celebrate > 0 ? 'JACKPOT' : 'THREE REEL', 76, 61,
    v.jackpot && v.celebrate > 0 && Math.sin(v.t * 18) > 0 ? PAL.white : withAlpha('#f2cb60', 0.75));
}

/* ---- the bell bolted to the top ---- */

function drawTopBell(ctx: CanvasRenderingContext2D, v: SlotView): void {
  const cx = 76;
  const swing = v.bell > 0 ? Math.sin(v.bell * 36) * 3 : 0;
  ctx.save();
  ctx.translate(cx, 20);
  ctx.rotate(swing * 0.06);
  // mounting post
  ctx.fillStyle = '#5d4a1e';
  ctx.fillRect(-2, -4, 4, 6);
  // the dome
  ctx.fillStyle = '#8a6a2c';
  ctx.beginPath();
  ctx.ellipse(0, -6, 9, 8, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = v.bell > 0 ? PAL.white : PAL.gold;
  ctx.beginPath();
  ctx.ellipse(0, -6, 7.5, 6.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = PAL.goldLit;
  ctx.fillRect(-7, -7, 3, 2);
  ctx.fillStyle = '#5d4a1e';
  ctx.fillRect(-9, -6, 18, 2);
  ctx.restore();

  // sound coming off it
  if (v.bell > 0) {
    ctx.strokeStyle = withAlpha(PAL.white, 0.5);
    ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      const r = 10 + i * 6 + (1 - (v.bell % 0.3) / 0.3) * 4;
      ctx.beginPath();
      ctx.arc(cx - 12, 12, r, Math.PI * 0.75, Math.PI * 1.25);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 12, 12, r, -Math.PI * 0.25, Math.PI * 0.25);
      ctx.stroke();
    }
  }
}

/* ---- the pay table, printed on the belly glass ---- */

function drawPayTable(ctx: CanvasRenderingContext2D, v: SlotView): void {
  const rows: Array<[SlotSymbol, number, number]> = [
    ['seven', 3, SLOT_TRIPLE.seven],
    ['crown', 3, SLOT_TRIPLE.crown],
    ['spade', 3, SLOT_TRIPLE.spade],
    ['bell', 3, SLOT_TRIPLE.bell],
    ['cherry', 3, SLOT_TRIPLE.cherry],
    ['cherry', 2, SLOT_TWO_CHERRY],
  ];
  rows.forEach(([sym, n, mult], i) => {
    const col = i < 3 ? 0 : 1;
    const row = i % 3;
    const x = 28 + col * 52;
    const y = 206 + row * 13;
    // a rung lights up when it is the one that just paid
    const lit = v.celebrate > 0 && v.win > 0 && v.hit.some(Boolean) && mult === v.paid
      && (n === 3) === v.hit.every(Boolean);
    if (lit) {
      ctx.fillStyle = withAlpha(PAL.goldLit, 0.2 + Math.abs(Math.sin(v.celebrate * 8)) * 0.2);
      ctx.fillRect(x - 3, y - 1, 50, 12);
    }
    const art = tinySymbol(sym);
    for (let k = 0; k < n; k++) ctx.drawImage(art.canvas, x + k * 11, y);
    if (n === 2) text(ctx, 'ANY', x + 23, y + 3, '#7a6f62');
    text(ctx, `*${mult}`, x + 36, y + 3, lit ? PAL.white : '#c9b184');
  });
}

/* ---- credit / bet / win lamps ---- */

function drawDisplays(ctx: CanvasRenderingContext2D, v: SlotView): void {
  const board = (label: string, value: number, x: number, places: number, on: string, flash = false) => {
    const w = places * LAMP_PITCH + 4;
    ctx.fillStyle = '#120c14';
    ctx.fillRect(x, 180, w, 11);
    ctx.fillStyle = '#3a2c1a';
    ctx.fillRect(x, 180, w, 1);
    ctx.fillStyle = '#5d4a1e';
    ctx.fillRect(x, 190, w, 1);
    // a paying win lamp blinks, the way a real one does until it is collected
    const lamp = flash && Math.sin(v.t * 11) < 0 ? withAlpha(on, 0.35) : on;
    lampNumber(ctx, value, x + w - 2, 182, places, lamp);
    text(ctx, label, x + 1, 193, '#9b8f80');
  };
  board('CREDIT', v.credit, 25, 6, '#ff9a4a');
  board('BET', v.stake, 68, 3, '#ffd24a');
  board('WIN', v.win, 93, 5, v.win > 0 ? '#6fe08a' : '#ff7a4a', v.win > 0 && v.celebrate > 0);
}

/* ---- coin slots along the front ---- */

function drawCoinSlots(ctx: CanvasRenderingContext2D, v: SlotView): void {
  for (let i = 0; i < 5; i++) {
    const x = slotSlotX(i);
    const active = v.stake === STAKES[i];
    if (active) {
      ctx.fillStyle = withAlpha(PAL.goldLit, 0.35 + Math.abs(Math.sin(v.t * 4)) * 0.2);
      ctx.fillRect(x - 1, SLOT_ROW_Y - 1, SLOT_SLOT_W + 2, SLOT_ROW_H + 2);
      ctx.fillStyle = '#8a6a2c';
      ctx.fillRect(x, SLOT_ROW_Y, SLOT_SLOT_W, SLOT_ROW_H);
      ctx.fillStyle = '#160f0a';
      ctx.fillRect(x + 3, SLOT_ROW_Y + 2, SLOT_SLOT_W - 6, 2);
    }
    textCentered(ctx, String(STAKES[i]), x + SLOT_SLOT_W / 2, SLOT_ROW_Y + 6,
      active ? '#160f0a' : '#f2cb60');

    // a coin dropping into the slit
    const ins = v.insert[i] ?? 0;
    if (ins > 0) {
      const k = 1 - ins;
      const cy = SLOT_ROW_Y - 14 + k * 14;
      ctx.fillStyle = PAL.gold;
      ctx.beginPath();
      ctx.ellipse(x + SLOT_SLOT_W / 2, cy, 3 * (1 - k * 0.6), 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.goldLit;
      ctx.fillRect(x + SLOT_SLOT_W / 2 - 1, cy - 1, 2, 1);
    }
  }
}

/* ---- payout tray ---- */

function drawTray(ctx: CanvasRenderingContext2D, v: SlotView): void {
  // coins piled in the tray, deterministic per index so the pile is stable
  for (let i = 0; i < Math.min(v.tray, 26); i++) {
    const rng = (i * 2654435761) % 1000 / 1000;
    const x = TRAY_X + 6 + (i % 13) * 7.4 + rng * 2;
    const y = TRAY_Y + TRAY_H - 5 - Math.floor(i / 13) * 4;
    ctx.fillStyle = '#8a6a2c';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.6, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.goldLit;
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 1);
  }
  // coins still in the air out of the chute
  for (const c of v.coins) {
    ctx.fillStyle = '#8a6a2c';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 4 * Math.abs(Math.cos(c.r)) + 1, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 3 * Math.abs(Math.cos(c.r)) + 0.6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---- the handle ---- */

function drawLever(ctx: CanvasRenderingContext2D, v: SlotView): void {
  const kx = LEVER_X;
  const ky = Math.round(LEVER_TOP + (LEVER_BOTTOM - LEVER_TOP) * v.lever);

  // the rod, running from the knob down into the guide
  ctx.fillStyle = '#5d4a1e';
  ctx.fillRect(kx - 2, ky, 4, LEVER_BOTTOM + 8 - ky);
  ctx.fillStyle = '#8a6a2c';
  ctx.fillRect(kx - 2, ky, 3, LEVER_BOTTOM + 8 - ky);
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(kx - 2, ky, 1, LEVER_BOTTOM + 8 - ky);

  // the return spring above it, compressing as the handle comes down
  const coils = 6;
  const span = Math.max(4, ky - LEVER_TOP + 10);
  for (let i = 0; i < coils; i++) {
    const y = LEVER_TOP - 8 + (i / coils) * span;
    ctx.fillStyle = i % 2 === 0 ? '#8d8599' : '#5a5462';
    ctx.fillRect(kx - 4, Math.round(y), 8, 2);
  }

  // the ball on the end
  const r = LEVER_KNOB + (v.leverHot ? 1 : 0);
  ctx.fillStyle = '#6d1a22';
  ctx.beginPath();
  ctx.arc(kx, ky, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c8383f';
  ctx.beginPath();
  ctx.arc(kx, ky, r - 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8757a';
  ctx.beginPath();
  ctx.arc(kx - r * 0.34, ky - r * 0.36, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = withAlpha(PAL.white, 0.85);
  ctx.fillRect(Math.round(kx - r * 0.45), Math.round(ky - r * 0.55), 2, 1);

  // an arrow that blinks down the handle's travel while the machine waits
  if (v.attract > 0 && v.lever < 0.05) {
    const blink = 0.35 + Math.abs(Math.sin(v.t * 6)) * 0.5;
    ctx.fillStyle = withAlpha(PAL.goldLit, blink * v.attract);
    // beside the guide rather than on it, so they point down the travel
    // without being drawn over the rod they are pointing along
    for (let i = 0; i < 3; i++) {
      const y = ky + 16 + i * 8;
      ctx.beginPath();
      ctx.moveTo(kx + 8, y);
      ctx.lineTo(kx + 14, y);
      ctx.lineTo(kx + 11, y + 4);
      ctx.closePath();
      ctx.fill();
    }
  }
}
