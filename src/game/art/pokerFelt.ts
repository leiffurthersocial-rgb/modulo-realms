import { PAL, withAlpha } from './palette';
import { Px } from './pixel';
import { RNG } from '../core/rng';
import { CHIP_TIERS, cardBack, cardFace, chip, chipBreakdown } from './casino';
import { HOLDEM_LABEL, RANK_LABEL, STAKES, type Card } from '../casino/games';
import { PATRON_KEYS, patronBust } from './casinoRoom';
import { text, textCentered, textWidth, lampNumber } from './slotCabinet';

/**
 * The hold'em table at the Gilded Spade, drawn as a table.
 *
 * Third and last of the house games to stop being a dialog. The old panel
 * was a title bar, a row of `div`s for the opponents, a strip of card images
 * and four buttons underneath — it told you the game state and it looked
 * like a form. This is the table from where the player is sitting: the far
 * rail with the others leaning over it, the board out on the baize, your own
 * two cards big in front of you, your chips in a rack at your elbow.
 *
 * There are no buttons. You fold by throwing your cards, you bet by throwing
 * chips from the rack onto the line, and you push the line in to commit. The
 * legends that say so are silk-screened on the felt, the way the pay table
 * is printed on the slot machine's belly glass.
 *
 * Geometry and drawing only. The hand is `casino/holdem.ts`, and the chips
 * in the air are `casino/pokerShow.ts`.
 */

export const TABLE_W = 380;
export const TABLE_H = 256;

/* ---- where everything lives ---- */

const OVAL_CX = 190;
const OVAL_CY = 130;
const OVAL_RX = 178;
const OVAL_RY = 116;

/** Far rail: the line the opponents lean over. */
export const SEAT_Y = 56;
const SEAT_SPOTS: Record<number, number[]> = {
  1: [190],
  2: [124, 256],
  3: [96, 190, 284],
  4: [62, 148, 232, 318],
};

/** Middle of the `i`-th opponent's place at a table with `total` of them. */
export const seatX = (i: number, total: number): number =>
  (SEAT_SPOTS[Math.max(1, Math.min(4, total))] ?? SEAT_SPOTS[4])[i] ?? 190;

/** Where an opponent's committed chips sit, just inside the rail. */
export const SEAT_BET_Y = 104;
/** The pot, in the middle of the baize. */
export const POT_X = 190;
export const POT_Y = 118;

/** The five community cards. */
const CARD_W = 30;
const CARD_H = 42;
export const BOARD_Y = 126;
export const boardX = (i: number): number => 107 + i * 34;

/** The hero's betting line, and the chips standing on it. */
export const LINE = { x: 108, y: 176, w: 164, h: 22 };
export const HERO_BET_X = 190;
export const HERO_BET_Y = 181;

/** The hero's own two cards. */
export const HERO_CARDS = { x: 156, y: 202, w: 70, h: CARD_H };
export const heroCardX = (i: number): number => 156 + i * 38;

/** The hero's name plate, which is also how you get up from the table. */
export const PLATE = { x: 14, y: 204, w: 108, h: 44 };

/** The chip rack at the player's elbow. */
export const RACK_Y = 224;
export const RACK_R = 11;
export const rackX = (i: number): number => 254 + i * 26;

/** The buy-in plaques, shown on the line before anyone has sat down. */
export const buyInBox = (i: number): { x: number; y: number; w: number; h: number } =>
  ({ x: 44 + i * 60, y: 168, w: 54, h: 30 });

const inBox = (x: number, y: number, b: { x: number; y: number; w: number; h: number }): boolean =>
  x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

export const onHeroCards = (x: number, y: number): boolean => inBox(x, y, HERO_CARDS);
export const onLine = (x: number, y: number): boolean => inBox(x, y, LINE);
export const onPlate = (x: number, y: number): boolean => inBox(x, y, PLATE);
export const onBoard = (x: number, y: number): boolean =>
  x >= 100 && x <= 280 && y >= BOARD_Y - 4 && y <= BOARD_Y + CARD_H + 4;

/** Which rack chip a point is over, or -1. */
export function rackAt(x: number, y: number): number {
  for (let i = 0; i < STAKES.length; i++) {
    if (Math.hypot(x - rackX(i), y - RACK_Y) <= RACK_R + 3) return i;
  }
  return -1;
}

/** Which buy-in plaque a point is over, or -1. */
export function buyInAt(x: number, y: number): number {
  for (let i = 0; i < STAKES.length; i++) if (inBox(x, y, buyInBox(i))) return i;
  return -1;
}

/* ------------------------------------------------------------------ */
/* The table itself                                                    */
/* ------------------------------------------------------------------ */

let tableCache: Px | null = null;

function tableTop(): Px {
  if (tableCache) return tableCache;
  const p = new Px(TABLE_W, TABLE_H);
  const rng = new RNG('holdem:table');

  // the room behind the table
  p.fill(0, 0, TABLE_W, TABLE_H, '#160f16');
  for (let i = 0; i < 400; i++) {
    p.set(rng.int(0, TABLE_W - 1), rng.int(0, 40), withAlpha('#2a1a26', 0.6));
  }

  // padded leather rail, then the baize inside it
  p.ellipse(OVAL_CX, OVAL_CY + 4, OVAL_RX, OVAL_RY, '#170d08');
  p.ellipse(OVAL_CX, OVAL_CY, OVAL_RX, OVAL_RY, '#4a2c19');
  p.ellipse(OVAL_CX, OVAL_CY - 2, OVAL_RX - 2, OVAL_RY - 2, '#6a4430');
  p.ellipse(OVAL_CX, OVAL_CY - 1, OVAL_RX - 10, OVAL_RY - 10, '#241408');
  p.ellipse(OVAL_CX, OVAL_CY, OVAL_RX - 12, OVAL_RY - 12, '#1f5a34');
  p.ellipse(OVAL_CX, OVAL_CY, OVAL_RX - 13, OVAL_RY - 13, '#27713f');
  for (let i = 0; i < 1400; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.range(0, 1));
    const x = Math.round(OVAL_CX + Math.cos(a) * r * (OVAL_RX - 14));
    const y = Math.round(OVAL_CY + Math.sin(a) * r * (OVAL_RY - 14));
    p.set(x, y, rng.bool() ? withAlpha('#1b4f2d', 0.5) : withAlpha('#2f8049', 0.35));
  }
  // brass tack line around the rail
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    p.set(Math.round(OVAL_CX + Math.cos(a) * (OVAL_RX - 6)),
      Math.round(OVAL_CY + Math.sin(a) * (OVAL_RY - 6)), '#8a6a2c');
  }

  // the house mark, painted in the middle of the baize under the board
  const s = 13;
  p.poly([[OVAL_CX, OVAL_CY - s], [OVAL_CX + s * 0.9, OVAL_CY + s * 0.25],
    [OVAL_CX, OVAL_CY + s * 0.6], [OVAL_CX - s * 0.9, OVAL_CY + s * 0.25]], withAlpha('#1b4f2d', 0.85));
  p.fill(OVAL_CX - 2, OVAL_CY + s * 0.3, 4, 8, withAlpha('#1b4f2d', 0.85));

  // the betting line, printed as an arc of dashes in front of the player
  for (let x = LINE.x; x < LINE.x + LINE.w; x += 6) {
    const k = (x - LINE.x) / LINE.w - 0.5;
    p.fill(x, Math.round(LINE.y + 2 + k * k * 14), 3, 1, withAlpha(PAL.bone, 0.35));
  }

  tableCache = p;
  return p;
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

/** One opponent, flattened to what the table needs to draw. */
export interface SeatView {
  id: number;
  name: string;
  chips: number;
  hole: Card[];
  revealed: boolean;
  folded: boolean;
  allIn: boolean;
  committed: number;
  active: boolean;
  winner: boolean;
  button: boolean;
  bubble: string;
  shown: string | null;
}

export interface Flight {
  x: number;
  y: number;
  tier: number;
  /** 0..1, squashes the chip as it turns over in the air. */
  spin: number;
}

export interface TableView {
  t: number;
  seated: boolean;
  stake: number;
  gold: number;
  /** Opponents, left to right along the far rail. */
  seats: SeatView[];
  hero: SeatView | null;
  board: Card[];
  boardShown: number;
  pot: number;
  message: string;
  /** Chips lying at each opponent's place, and in the pot, as tier lists. */
  seatStacks: number[][];
  potStack: number[];
  heroStack: number[];
  pending: number[];
  pendingAmount: number;
  flights: Flight[];
  /** What clicking the line would do right now. */
  lineLabel: string;
  owed: number;
  heroTurn: boolean;
  handOver: boolean;
  chip: number;
  hover: string | null;
  /** Counts down while the hero's cards are being thrown into the muck. */
  muck: number;
}

/* ------------------------------------------------------------------ */

export function drawTable(ctx: CanvasRenderingContext2D, v: TableView): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, TABLE_W, TABLE_H);
  ctx.drawImage(tableTop().canvas, 0, 0);

  if (!v.seated) {
    drawBuyIn(ctx, v);
    return;
  }

  drawOpponents(ctx, v);
  drawPot(ctx, v);
  drawBoard(ctx, v);
  drawMessage(ctx, v);
  drawLine(ctx, v);
  drawHero(ctx, v);
  drawPlate(ctx, v);
  drawRack(ctx, v);
  for (const f of v.flights) drawChipAt(ctx, f.x, f.y, f.tier, f.spin);
}

/* ---- sitting down ---- */

function drawBuyIn(ctx: CanvasRenderingContext2D, v: TableView): void {
  textCentered(ctx, "TEXAS HOLD'EM", OVAL_CX, 96, PAL.goldLit);
  textCentered(ctx, 'TWENTY BIG BLINDS BUYS YOU IN', OVAL_CX, 108, withAlpha(PAL.bone, 0.65));
  textCentered(ctx, 'CASH OUT WHATEVER IS STILL IN FRONT OF YOU', OVAL_CX, 118, withAlpha(PAL.bone, 0.45));

  STAKES.forEach((stake, i) => {
    const b = buyInBox(i);
    const hot = v.hover === `buy${i}`;
    const afford = v.gold >= stake * 2;
    ctx.fillStyle = afford ? (hot ? '#3c7a45' : '#1b4f2d') : 'rgba(20,14,12,0.6)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = withAlpha(afford ? PAL.goldLit : PAL.bone, hot ? 0.95 : 0.45);
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    ctx.drawImage(chip(tierFor(stake)).canvas, b.x + b.w / 2 - 8, b.y + 3);
    textCentered(ctx, String(stake), b.x + b.w / 2, b.y + 21, afford ? PAL.white : withAlpha(PAL.white, 0.4));
  });

  text(ctx, 'YOUR GOLD', 150, 212, '#9b8f80');
  lampNumber(ctx, v.gold, 236, 208, 6, '#ff9a4a');
}

const tierFor = (amount: number): number =>
  amount >= 500 ? 4 : amount >= 100 ? 3 : amount >= 25 ? 2 : amount >= 5 ? 1 : 0;

/* ---- the far rail ---- */

function drawOpponents(ctx: CanvasRenderingContext2D, v: TableView): void {
  const total = v.seats.length;
  v.seats.forEach((s, i) => {
    const cx = seatX(i, total);
    const dim = s.folded ? 0.38 : 1;

    // their hole cards, tucked under their hands
    const cards = s.revealed && s.hole.length ? s.hole : [];
    if (!s.folded || s.revealed) {
      if (cards.length) {
        // turned over at showdown: full size, popped forward off the rail
        cards.forEach((c, k) => {
          ctx.drawImage(cardFace(c, RANK_LABEL[c.rank]).canvas, cx - 32 + k * 34, SEAT_Y + 14);
        });
      } else if (s.hole.length) {
        ctx.save();
        ctx.globalAlpha = dim;
        for (let k = 0; k < 2; k++) {
          ctx.drawImage(cardBack().canvas, 0, 0, CARD_W, CARD_H, cx - 17 + k * 18, SEAT_Y + 16, 16, 22);
        }
        ctx.restore();
      }
    }

    // the player: the same cast as the room downstairs, so the stranger who
    // just raised you is somebody you walked past on the way in
    ctx.save();
    ctx.globalAlpha = dim;
    ctx.drawImage(patronBust(PATRON_KEYS[s.id % PATRON_KEYS.length]).canvas, cx - 16, SEAT_Y - 34);
    ctx.restore();

    // the plate: name, stack, and whether it is on them
    const plateW = 54;
    ctx.fillStyle = s.active ? withAlpha(PAL.goldLit, 0.22 + Math.abs(Math.sin(v.t * 6)) * 0.2) : 'rgba(10,8,16,0.6)';
    ctx.fillRect(cx - plateW / 2, SEAT_Y - 2, plateW, 15);
    ctx.strokeStyle = s.winner ? PAL.goldLit : withAlpha(PAL.bone, s.active ? 0.8 : 0.3);
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - plateW / 2 + 0.5, SEAT_Y - 1.5, plateW - 1, 14);
    textCentered(ctx, s.name.toUpperCase(), cx, SEAT_Y + 1, s.folded ? withAlpha(PAL.bone, 0.5) : PAL.white);
    textCentered(ctx, s.allIn ? 'ALL IN' : String(s.chips), cx, SEAT_Y + 8,
      s.allIn ? '#f2cb60' : withAlpha(PAL.goldLit, 0.85));

    if (s.button) {
      ctx.fillStyle = PAL.bone;
      ctx.beginPath();
      ctx.arc(cx + plateW / 2 + 6, SEAT_Y + 5, 5, 0, Math.PI * 2);
      ctx.fill();
      textCentered(ctx, 'D', cx + plateW / 2 + 6, SEAT_Y + 3, '#241408');
    }

    // what they just did, over their head
    if (s.bubble) {
      const w = textWidth(s.bubble) + 6;
      ctx.fillStyle = 'rgba(10,8,16,0.86)';
      ctx.fillRect(cx - w / 2, SEAT_Y - 46, w, 11);
      ctx.strokeStyle = withAlpha(PAL.goldLit, 0.6);
      ctx.strokeRect(cx - w / 2 + 0.5, SEAT_Y - 45.5, w - 1, 10);
      textCentered(ctx, s.bubble, cx, SEAT_Y - 43, PAL.goldLit);
    }
    if (s.shown) textCentered(ctx, s.shown.toUpperCase(), cx, SEAT_Y + 60, '#6fe08a');

    // their chips on the baize, and the amount beside them
    drawStack(ctx, cx, SEAT_BET_Y, v.seatStacks[i] ?? []);
    if (s.committed > 0) {
      textCentered(ctx, String(s.committed), cx, SEAT_BET_Y + 6, PAL.goldLit);
    }
  });
}

/* ---- pot and board ---- */

function drawPot(ctx: CanvasRenderingContext2D, v: TableView): void {
  drawStack(ctx, POT_X, POT_Y, v.potStack, true);
  // beside the pile rather than over it: the seat opposite has its own chips
  // directly above this spot, and a label there would land on them
  if (v.pot > 0) {
    const label = `POT ${v.pot}`;
    ctx.fillStyle = 'rgba(10,8,16,0.6)';
    ctx.fillRect(POT_X + 14, POT_Y - 9, textWidth(label) + 6, 11);
    text(ctx, label, POT_X + 17, POT_Y - 6, PAL.goldLit);
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, v: TableView): void {
  for (let i = 0; i < 5; i++) {
    const x = boardX(i);
    if (i < v.boardShown && v.board[i]) {
      ctx.drawImage(cardFace(v.board[i], RANK_LABEL[v.board[i].rank]).canvas, x, BOARD_Y);
    } else {
      // an empty place, so the board always reads as five
      ctx.strokeStyle = withAlpha(PAL.bone, 0.16);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, BOARD_Y + 0.5, CARD_W - 1, CARD_H - 1);
    }
  }
}

function drawMessage(ctx: CanvasRenderingContext2D, v: TableView): void {
  if (!v.message) return;
  const w = textWidth(v.message) + 10;
  ctx.fillStyle = 'rgba(10,8,16,0.7)';
  ctx.fillRect(OVAL_CX - w / 2, 170, w, 12);
  textCentered(ctx, v.message, OVAL_CX, 173, PAL.white);
}

/* ---- the hero's side of the table ---- */

function drawLine(ctx: CanvasRenderingContext2D, v: TableView): void {
  const hot = v.hover === 'line' && v.heroTurn;
  if (v.heroTurn || v.handOver) {
    ctx.fillStyle = withAlpha(PAL.goldLit, hot ? 0.16 : 0.07 + Math.abs(Math.sin(v.t * 3)) * 0.05);
    ctx.fillRect(LINE.x, LINE.y - 6, LINE.w, LINE.h);
  }
  drawStack(ctx, HERO_BET_X, HERO_BET_Y, v.heroStack);
  drawStack(ctx, HERO_BET_X + 30, HERO_BET_Y, v.pending);

  if (v.pendingAmount > 0) {
    textCentered(ctx, String(v.pendingAmount), HERO_BET_X + 30, HERO_BET_Y + 6, PAL.goldLit);
  }
  // printed under the chips rather than through them
  if (v.lineLabel) {
    const w = textWidth(v.lineLabel) + 8;
    ctx.fillStyle = 'rgba(10,8,16,0.55)';
    ctx.fillRect(OVAL_CX - w / 2, LINE.y + 16, w, 10);
    textCentered(ctx, v.lineLabel, OVAL_CX, LINE.y + 18, hot ? PAL.white : withAlpha(PAL.bone, 0.85));
  }
}

function drawHero(ctx: CanvasRenderingContext2D, v: TableView): void {
  const hero = v.hero;
  if (!hero) return;
  const hot = v.hover === 'cards' && v.heroTurn;
  for (let i = 0; i < 2; i++) {
    const c = hero.hole[i];
    if (!c) continue;
    // thrown cards slide away and fade as they go into the muck
    const k = v.muck;
    const x = heroCardX(i) + (hot && !k ? 0 : 0) - k * (90 + i * 18);
    const y = HERO_CARDS.y - (hot ? 3 : 0) - k * 66;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    if (hero.folded && !k) ctx.globalAlpha = 0.35;
    ctx.drawImage(cardFace(c, RANK_LABEL[c.rank]).canvas, Math.round(x), Math.round(y));
    ctx.restore();
  }
  if (hero.shown) {
    textCentered(ctx, hero.shown.toUpperCase(), OVAL_CX, HERO_CARDS.y + CARD_H + 2, '#6fe08a');
  } else if (v.heroTurn && !hero.folded) {
    textCentered(ctx, 'THROW YOUR CARDS TO FOLD', OVAL_CX, HERO_CARDS.y + CARD_H + 2,
      withAlpha(PAL.bone, hot ? 0.95 : 0.45));
  }
}

function drawPlate(ctx: CanvasRenderingContext2D, v: TableView): void {
  const hero = v.hero;
  if (!hero) return;
  const hot = v.hover === 'plate';
  ctx.fillStyle = hero.active ? withAlpha(PAL.goldLit, 0.18) : 'rgba(10,8,16,0.6)';
  ctx.fillRect(PLATE.x, PLATE.y, PLATE.w, PLATE.h);
  ctx.strokeStyle = hero.winner ? PAL.goldLit : withAlpha(PAL.bone, hot ? 0.9 : 0.35);
  ctx.lineWidth = 1;
  ctx.strokeRect(PLATE.x + 0.5, PLATE.y + 0.5, PLATE.w - 1, PLATE.h - 1);

  text(ctx, 'YOUR STACK', PLATE.x + 6, PLATE.y + 6, '#9b8f80');
  lampNumber(ctx, hero.chips, PLATE.x + PLATE.w - 6, PLATE.y + 14, 6, '#ff9a4a');
  textCentered(ctx, hot ? 'CASH OUT AND LEAVE' : 'BLINDS ' + Math.max(1, Math.round(v.stake / 2)) + '/' + v.stake,
    PLATE.x + PLATE.w / 2, PLATE.y + 32, withAlpha(PAL.bone, hot ? 0.95 : 0.5));
  if (hero.button) {
    ctx.fillStyle = PAL.bone;
    ctx.beginPath();
    ctx.arc(PLATE.x + PLATE.w - 9, PLATE.y + 36, 5, 0, Math.PI * 2);
    ctx.fill();
    textCentered(ctx, 'D', PLATE.x + PLATE.w - 9, PLATE.y + 34, '#241408');
  }
}

function drawRack(ctx: CanvasRenderingContext2D, v: TableView): void {
  const hero = v.hero;
  // the well the chips stand in, cut into the near rail
  ctx.fillStyle = '#3b2415';
  ctx.fillRect(244, RACK_Y - 3, 126, 15);
  ctx.fillStyle = '#241408';
  ctx.fillRect(244, RACK_Y - 3, 126, 2);
  STAKES.forEach((value, i) => {
    const x = rackX(i);
    const can = !!hero && v.heroTurn && hero.chips >= value;
    const hot = v.hover === `rack${i}`;
    ctx.fillStyle = '#1b4f2d';
    ctx.beginPath();
    ctx.ellipse(x, RACK_Y + 5, RACK_R + 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = can ? 1 : 0.35;
    ctx.translate(x, RACK_Y - (hot && can ? 3 : 0));
    ctx.scale(1.2, 1.2);
    ctx.drawImage(chip(tierFor(value)).canvas, -8, -8);
    ctx.restore();
    textCentered(ctx, String(value), x, RACK_Y - 3 - (hot && can ? 3 : 0),
      can ? PAL.white : withAlpha(PAL.white, 0.4));
  });
  textCentered(ctx, v.heroTurn ? 'THROW A CHIP ON THE LINE' : 'YOUR CHIPS', 307, RACK_Y + 14,
    withAlpha(PAL.bone, 0.45));
}

/* ------------------------------------------------------------------ */
/* Chips                                                               */
/* ------------------------------------------------------------------ */

/** One chip, possibly caught mid-turn in the air. */
function drawChipAt(ctx: CanvasRenderingContext2D, x: number, y: number, tier: number, spin = 0): void {
  if (spin > 0) {
    // an edge-on chip: the sprite squashed, with its rim showing
    const k = Math.abs(Math.cos(spin));
    const t = CHIP_TIERS[Math.max(0, Math.min(CHIP_TIERS.length - 1, tier))];
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (k < 0.3) {
      ctx.fillStyle = t.edge;
      ctx.fillRect(-7, -2, 14, 4);
      ctx.fillStyle = t.body;
      ctx.fillRect(-7, -1, 14, 1);
    } else {
      ctx.scale(1, k);
      ctx.drawImage(chip(tier).canvas, -8, -8);
    }
    ctx.restore();
    return;
  }
  ctx.drawImage(chip(tier).canvas, Math.round(x) - 8, Math.round(y) - 8);
}

/**
 * A short stack of chips.
 *
 * `tiers` is the list of chips actually lying there — the show pushes one
 * onto it every time a thrown chip lands, so a stack grows as it is paid
 * into rather than appearing whole.
 */
function drawStack(ctx: CanvasRenderingContext2D, cx: number, cy: number, tiers: number[], wide = false): void {
  if (!tiers.length) return;
  // wide stacks (the pot) break into columns rather than growing a tower
  const perCol = wide ? 5 : 6;
  tiers.forEach((tier, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = cx + (wide ? (col - 1) * 11 : 0);
    drawChipAt(ctx, x, cy - row * 2, tier);
  });
}

/** The chips an amount is made of, for throwing one at a time. */
export const chipsFor = (amount: number, max = 6): number[] => chipBreakdown(amount, max);

export { HOLDEM_LABEL };
