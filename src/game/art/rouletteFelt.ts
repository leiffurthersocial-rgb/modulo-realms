import { PAL, withAlpha } from './palette';
import { Px } from './pixel';
import { RNG } from '../core/rng';
import { CHIP_TIERS, chip } from './casino';
import { STAKES } from '../casino/games';
import { WHEEL_ORDER, colourOf, type Bet } from '../casino/rouletteTable';
import { text, textCentered, textWidth, lampNumber } from './slotCabinet';

/**
 * The Whirligig's table: the wheel and the cloth, drawn as the thing itself.
 *
 * Same rule as the slot cabinet next door — this is not a dialog with a
 * picture of roulette in it. It is the table, seen from where a player
 * stands: the wheel on the left with the ball actually running its rim, the
 * cloth on the right with chips sitting on the fields they were put on, and
 * a rack of chips to pick up. Everything is drawn at 1:1 and blown up with
 * nearest neighbour, and the only words on it are silk-screened on the felt.
 *
 * The pixel alphabet and the lamp digits are borrowed from `slotCabinet.ts`
 * rather than written twice: it is the same room, and the same house painted
 * both machines.
 */

export const FELT_W = 336;
export const FELT_H = 212;

/** The wheel, and how big it is. */
export const WHEEL_CX = 76;
export const WHEEL_CY = 112;
export const WHEEL_R = 62;
/** Radius the ball runs at out on the rim, and down in the pockets. */
const RIM_R = 52;
const POCKET_R = 33;

/** A field on the cloth: where it is and what betting on it means. */
export interface Field {
  key: string;
  bet: Bet;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

const GRID_X = 166;
const GRID_Y = 34;
const CELL_W = 13;
const CELL_H = 14;

/** The chip rack along the bottom of the cloth. */
export const RACK_Y = 150;
export const RACK_R = 12;
export const rackX = (i: number): number => 176 + i * 34;

/** Where the reset/clear legend sits. */
export const CLEAR_BOX = { x: 152, y: 114, w: 46, h: 14 };

let fieldCache: Field[] | null = null;

/**
 * Every field on the cloth, in one list.
 *
 * Drawing and hit-testing read the same array, so a field can never be
 * painted somewhere the pointer does not find it — which is exactly the bug
 * a hand-written second copy of these coordinates would eventually be.
 */
export function fields(): Field[] {
  if (fieldCache) return fieldCache;
  const out: Field[] = [];
  out.push({ key: 'n0', bet: { type: 'straight', n: 0 }, x: 152, y: GRID_Y, w: CELL_W, h: CELL_H * 3, label: '0' });
  for (let c = 0; c < 12; c++) {
    for (let r = 0; r < 3; r++) {
      const n = c * 3 + (3 - r);
      out.push({
        key: `n${n}`, bet: { type: 'straight', n },
        x: GRID_X + c * CELL_W, y: GRID_Y + r * CELL_H, w: CELL_W, h: CELL_H, label: String(n),
      });
    }
  }
  const dozens = ['1ST 12', '2ND 12', '3RD 12'];
  for (let d = 0; d < 3; d++) {
    out.push({
      key: `d${d}`, bet: { type: 'dozen', d: d as 0 | 1 | 2 },
      x: GRID_X + d * 52, y: 80, w: 52, h: 14, label: dozens[d],
    });
  }
  const outside: Array<[Bet['type'], string]> = [
    ['low', '1-18'], ['even', 'EVEN'], ['red', 'RED'], ['black', 'BLACK'], ['odd', 'ODD'], ['high', '19-36'],
  ];
  outside.forEach(([type, label], i) => {
    out.push({
      key: type, bet: { type } as Bet,
      x: GRID_X + i * 26, y: 96, w: 26, h: 14, label,
    });
  });
  fieldCache = out;
  return out;
}

/** Which field a point is over, or null. */
export function fieldAt(x: number, y: number): Field | null {
  for (const f of fields()) {
    if (x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) return f;
  }
  return null;
}

/** Which chip in the rack a point is over, or -1. */
export function rackAt(x: number, y: number): number {
  for (let i = 0; i < STAKES.length; i++) {
    if (Math.hypot(x - rackX(i), y - RACK_Y) <= RACK_R + 3) return i;
  }
  return -1;
}

/** Is the point on the wheel? That is what you push to spin it. */
export const onWheel = (x: number, y: number): boolean =>
  Math.hypot(x - WHEEL_CX, y - WHEEL_CY) <= WHEEL_R;

/* ------------------------------------------------------------------ */
/* Static parts                                                        */
/* ------------------------------------------------------------------ */

let clothCache: Px | null = null;

/** The baize, the printed fields and the wheel's fixed woodwork. */
function cloth(): Px {
  if (clothCache) return clothCache;
  const p = new Px(FELT_W, FELT_H);
  const rng = new RNG('roulette:cloth');

  // the table top: baize with a wooden kerb all the way round
  p.fill(0, 0, FELT_W, FELT_H, '#1f5a34');
  p.fill(0, 0, FELT_W, FELT_H, '#27713f');
  for (let i = 0; i < 900; i++) {
    p.set(rng.int(0, FELT_W - 1), rng.int(0, FELT_H - 1),
      rng.bool() ? withAlpha('#1b4f2d', 0.5) : withAlpha('#2f8049', 0.4));
  }
  p.fill(0, 0, FELT_W, 4, '#6a4430');
  p.fill(0, FELT_H - 4, FELT_W, 4, '#3b2415');
  p.fill(0, 0, 4, FELT_H, '#6a4430');
  p.fill(FELT_W - 4, 0, 4, FELT_H, '#3b2415');
  p.fill(0, 4, FELT_W, 1, '#8a5c40');

  // the wheel's bowl and the apron it sits in
  p.ellipse(WHEEL_CX, WHEEL_CY + 3, WHEEL_R + 5, WHEEL_R + 5, '#241408');
  p.ellipse(WHEEL_CX, WHEEL_CY, WHEEL_R + 4, WHEEL_R + 4, '#6a4430');
  p.ellipse(WHEEL_CX, WHEEL_CY - 1, WHEEL_R + 2, WHEEL_R + 2, '#8a5c40');
  p.ellipse(WHEEL_CX, WHEEL_CY, WHEEL_R, WHEEL_R, '#3b2415');
  p.ellipse(WHEEL_CX, WHEEL_CY, WHEEL_R - 4, WHEEL_R - 4, '#241408');
  // brass band around the rim the ball runs on
  for (let a = 0; a < 64; a++) {
    const r = (a / 64) * Math.PI * 2;
    p.ellipse(WHEEL_CX + Math.cos(r) * (RIM_R + 4), WHEEL_CY + Math.sin(r) * (RIM_R + 4), 1.4, 1.4, '#8a6a2c');
  }

  clothCache = p;
  return p;
}

/* ------------------------------------------------------------------ */
/* The view                                                            */
/* ------------------------------------------------------------------ */

export interface FeltView {
  t: number;
  wheel: number;
  ball: number;
  ballOut: number;
  ballHop: number;
  bets: Map<string, number>;
  chip: number;
  hover: string | null;
  result: number | null;
  history: number[];
  celebrate: number;
  won: number;
  gold: number;
  staked: number;
  message: string;
  phase: string;
}

const COLOUR_BODY: Record<string, string> = {
  red: '#b8323a', black: '#2a2432', green: '#4f9a55',
};

export function drawFelt(ctx: CanvasRenderingContext2D, v: FeltView): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, FELT_W, FELT_H);
  ctx.drawImage(cloth().canvas, 0, 0);

  drawWheel(ctx, v);
  drawCloth(ctx, v);
  drawChips(ctx, v);
  drawRack(ctx, v);
  drawStatus(ctx, v);
}

/* ---- the wheel ---- */

function drawWheel(ctx: CanvasRenderingContext2D, v: FeltView): void {
  const n = WHEEL_ORDER.length;
  // the head: 37 pockets, numbered, turning
  for (let i = 0; i < n; i++) {
    const a0 = v.wheel + (i / n) * Math.PI * 2;
    const a1 = v.wheel + ((i + 1) / n) * Math.PI * 2;
    const num = WHEEL_ORDER[i];
    ctx.beginPath();
    ctx.moveTo(WHEEL_CX, WHEEL_CY);
    ctx.arc(WHEEL_CX, WHEEL_CY, WHEEL_R - 6, a0, a1);
    ctx.closePath();
    ctx.fillStyle = COLOUR_BODY[colourOf(num)];
    ctx.fill();
    // The number, painted in its pocket and turning with the head. Thirty-
    // seven of them around a wheel this size is a ring of engraving rather
    // than thirty-seven readable figures, which is exactly what a real wheel
    // looks like from where the player is standing — so it is drawn faint,
    // as texture, not as something the cloth expects anyone to read.
    const mid = (a0 + a1) / 2;
    ctx.save();
    ctx.translate(WHEEL_CX + Math.cos(mid) * (WHEEL_R - 12), WHEEL_CY + Math.sin(mid) * (WHEEL_R - 12));
    ctx.rotate(mid + Math.PI / 2);
    textCentered(ctx, String(num), 0, -2, withAlpha(PAL.white, 0.55));
    ctx.restore();
    // the fret between two pockets
    ctx.strokeStyle = withAlpha(PAL.goldLit, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(WHEEL_CX + Math.cos(a0) * (POCKET_R - 6), WHEEL_CY + Math.sin(a0) * (POCKET_R - 6));
    ctx.lineTo(WHEEL_CX + Math.cos(a0) * (WHEEL_R - 6), WHEEL_CY + Math.sin(a0) * (WHEEL_R - 6));
    ctx.stroke();
  }

  // the winning pocket keeps its own light once the ball is in it
  if (v.result !== null && v.phase === 'resting') {
    const i = WHEEL_ORDER.indexOf(v.result);
    const a0 = v.wheel + (i / n) * Math.PI * 2;
    const a1 = v.wheel + ((i + 1) / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(WHEEL_CX, WHEEL_CY);
    ctx.arc(WHEEL_CX, WHEEL_CY, WHEEL_R - 6, a0, a1);
    ctx.closePath();
    ctx.fillStyle = withAlpha(PAL.goldLit, 0.3 + Math.abs(Math.sin(v.t * 6)) * 0.35);
    ctx.fill();
  }

  // the cone in the middle, and the turret handle on top of it
  ctx.fillStyle = '#3b2415';
  ctx.beginPath();
  ctx.arc(WHEEL_CX, WHEEL_CY, POCKET_R - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a6a2c';
  ctx.beginPath();
  ctx.arc(WHEEL_CX, WHEEL_CY, POCKET_R - 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.gold;
  ctx.beginPath();
  ctx.arc(WHEEL_CX, WHEEL_CY, 11, 0, Math.PI * 2);
  ctx.fill();
  // four arms of the turret, turning with the head
  for (let i = 0; i < 4; i++) {
    const a = v.wheel * 1 + (i / 4) * Math.PI * 2;
    ctx.strokeStyle = PAL.goldLit;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(WHEEL_CX, WHEEL_CY);
    ctx.lineTo(WHEEL_CX + Math.cos(a) * (POCKET_R - 9), WHEEL_CY + Math.sin(a) * (POCKET_R - 9));
    ctx.stroke();
  }
  ctx.fillStyle = '#c8383f';
  ctx.beginPath();
  ctx.arc(WHEEL_CX, WHEEL_CY, 4, 0, Math.PI * 2);
  ctx.fill();

  // the ball
  const r = POCKET_R + (RIM_R - POCKET_R) * v.ballOut;
  const bx = WHEEL_CX + Math.cos(v.ball) * r;
  const by = WHEEL_CY + Math.sin(v.ball) * r - v.ballHop * 6;
  if (v.ballHop > 0) {
    ctx.fillStyle = 'rgba(8,6,12,0.4)';
    ctx.beginPath();
    ctx.ellipse(bx, WHEEL_CY + Math.sin(v.ball) * r, 3, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#8d8599';
  ctx.beginPath();
  ctx.arc(bx, by, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.white;
  ctx.beginPath();
  ctx.arc(bx - 0.8, by - 0.9, 2, 0, Math.PI * 2);
  ctx.fill();

  // the legend on the hub, which is also the thing you click
  if (v.phase === 'betting') {
    const blink = v.staked > 0 ? 0.5 + Math.abs(Math.sin(v.t * 5)) * 0.5 : 0.35;
    const label = v.staked > 0 ? 'PUSH' : 'BET';
    textCentered(ctx, label, WHEEL_CX, WHEEL_CY + WHEEL_R + 10, withAlpha(PAL.goldLit, blink));
  } else if (v.phase === 'resting') {
    textCentered(ctx, 'CLICK TO CLEAR', WHEEL_CX, WHEEL_CY + WHEEL_R + 10,
      withAlpha(PAL.white, 0.5 + Math.abs(Math.sin(v.t * 4)) * 0.4));
  }
}

/* ---- the printed cloth ---- */

function drawCloth(ctx: CanvasRenderingContext2D, v: FeltView): void {
  for (const f of fields()) {
    const col = f.bet.type === 'straight' ? colourOf(f.bet.n) : null;
    ctx.fillStyle = col ? COLOUR_BODY[col] : 'rgba(18,44,28,0.5)';
    ctx.fillRect(f.x, f.y, f.w - 1, f.h - 1);
    // the outside fields carry their own colour patch instead of a word
    if (f.key === 'red' || f.key === 'black') {
      ctx.fillStyle = COLOUR_BODY[f.key];
      ctx.fillRect(f.x + 1, f.y + 1, f.w - 3, f.h - 3);
    }
    ctx.strokeStyle = withAlpha(PAL.bone, 0.55);
    ctx.lineWidth = 1;
    ctx.strokeRect(f.x + 0.5, f.y + 0.5, f.w - 2, f.h - 2);

    const hot = v.hover === f.key;
    if (hot && v.phase === 'betting') {
      ctx.fillStyle = withAlpha(PAL.goldLit, 0.3);
      ctx.fillRect(f.x, f.y, f.w - 1, f.h - 1);
    }
    // a field that has just won is lit until the table is cleared
    if (v.result !== null && v.phase === 'resting' && wins(f, v.result)) {
      ctx.fillStyle = withAlpha(PAL.goldLit, 0.25 + Math.abs(Math.sin(v.t * 7)) * 0.3);
      ctx.fillRect(f.x, f.y, f.w - 1, f.h - 1);
    }
    textCentered(ctx, f.label, f.x + (f.w - 1) / 2, f.y + (f.h - 6) / 2, PAL.white);
  }

  // clear-the-cloth legend, printed in the corner like a house rule
  const c = CLEAR_BOX;
  ctx.strokeStyle = withAlpha(PAL.bone, v.hover === 'clear' ? 0.9 : 0.4);
  ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
  textCentered(ctx, 'CLEAR', c.x + c.w / 2, c.y + 5, withAlpha(PAL.bone, v.hover === 'clear' ? 1 : 0.6));

  // the last few results, the board every roulette table keeps
  text(ctx, 'LAST', 206, 118, withAlpha(PAL.bone, 0.5));
  v.history.slice(0, 8).forEach((n, i) => {
    const x = 228 + i * 12;
    ctx.fillStyle = COLOUR_BODY[colourOf(n)];
    ctx.fillRect(x, 114, 11, 14);
    ctx.strokeStyle = withAlpha(PAL.bone, 0.35);
    ctx.strokeRect(x + 0.5, 114.5, 10, 13);
    textCentered(ctx, String(n), x + 5.5, 118, PAL.white);
  });
}

/** Does this field win on `n`? Kept local so drawing never imports the rules twice. */
function wins(f: Field, n: number): boolean {
  const b = f.bet;
  if (b.type === 'straight') return b.n === n;
  if (n === 0) return false;
  if (b.type === 'dozen') return Math.floor((n - 1) / 12) === b.d;
  if (b.type === 'red' || b.type === 'black') return colourOf(n) === b.type;
  if (b.type === 'even') return n % 2 === 0;
  if (b.type === 'odd') return n % 2 === 1;
  if (b.type === 'low') return n <= 18;
  return n >= 19;
}

/* ---- chips sitting on the cloth ---- */

function drawChips(ctx: CanvasRenderingContext2D, v: FeltView): void {
  for (const f of fields()) {
    const amount = v.bets.get(f.key);
    if (!amount) continue;
    const cx = Math.round(f.x + (f.w - 1) / 2);
    const cy = Math.round(f.y + (f.h - 1) / 2);
    const tier = chipTier(amount);
    const body = CHIP_TIERS[tier];
    // a short stack, so a big bet looks like a big bet
    const stack = Math.min(4, 1 + Math.floor(Math.log2(Math.max(1, amount / 10))));
    // A straight-up cell is thirteen pixels wide. A full chip sprite on one
    // hides the number it was bet on, so those get a token drawn to fit and
    // the roomier outside fields get the real thing.
    const small = f.w < 20;
    for (let i = 0; i < stack; i++) {
      const y = cy - i * 2;
      if (small) {
        ctx.fillStyle = '#0f0d14';
        ctx.beginPath();
        ctx.ellipse(cx, y, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = body.edge;
        ctx.beginPath();
        ctx.ellipse(cx, y - 0.5, 4.2, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = body.body;
        ctx.beginPath();
        ctx.ellipse(cx, y - 0.5, 2.4, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.drawImage(chip(tier).canvas, cx - 8, y - 8);
      }
    }
    // the amount, only where there is room to print it
    if (!small) {
      const label = String(amount);
      const w = textWidth(label);
      ctx.fillStyle = 'rgba(10,8,16,0.82)';
      ctx.fillRect(cx - Math.round(w / 2) - 2, cy + 3 - stack * 2, w + 3, 7);
      textCentered(ctx, label, cx, cy + 4 - stack * 2, PAL.goldLit);
    }
  }
}

const chipTier = (amount: number): number =>
  amount >= 500 ? 4 : amount >= 100 ? 3 : amount >= 25 ? 2 : amount >= 5 ? 1 : 0;

/* ---- the rack you pick a chip up from ---- */

function drawRack(ctx: CanvasRenderingContext2D, v: FeltView): void {
  // the well the chips stand in, cut into the kerb the way a real rack is
  ctx.fillStyle = '#1b4f2d';
  ctx.fillRect(164, RACK_Y - 2, 164, 14);
  ctx.fillStyle = withAlpha('#0f2c1b', 0.7);
  ctx.fillRect(164, RACK_Y - 2, 164, 2);
  STAKES.forEach((value, i) => {
    const x = rackX(i);
    const held = v.chip === value;
    const y = RACK_Y - (held ? 4 : 0);
    // the well the chip sits in
    ctx.fillStyle = '#1b4f2d';
    ctx.beginPath();
    ctx.ellipse(x, RACK_Y + 5, RACK_R + 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.25, 1.25);
    ctx.drawImage(chip(chipTier(value)).canvas, -8, -8);
    ctx.restore();
    if (held) {
      ctx.strokeStyle = withAlpha(PAL.goldLit, 0.7 + Math.abs(Math.sin(v.t * 5)) * 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, RACK_R + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    textCentered(ctx, String(value), x, y - 3, held ? PAL.white : withAlpha(PAL.white, 0.75));
  });
}

/* ---- the line the table tells you things on ---- */

function drawStatus(ctx: CanvasRenderingContext2D, v: FeltView): void {
  textCentered(ctx, 'THE WHIRLIGIG', WHEEL_CX, 14, withAlpha(PAL.goldLit, 0.85));

  ctx.fillStyle = 'rgba(10,8,16,0.55)';
  ctx.fillRect(152, 176, 176, 30);
  ctx.fillStyle = withAlpha(PAL.goldLit, 0.4);
  ctx.fillRect(152, 176, 176, 1);

  textCentered(ctx, v.message, 240, 181,
    v.celebrate > 0 && Math.sin(v.t * 12) > 0 ? PAL.white : PAL.goldLit);

  text(ctx, 'GOLD', 156, 194, '#9b8f80');
  lampNumber(ctx, v.gold, 212, 191, 6, '#ff9a4a');
  text(ctx, 'STAKED', 220, 194, '#9b8f80');
  lampNumber(ctx, v.staked, 280, 191, 5, '#ffd24a');
  text(ctx, 'WON', 286, 194, '#9b8f80');
  lampNumber(ctx, v.won, 326, 191, 4, v.won > 0 ? '#6fe08a' : '#ff7a4a');
}
