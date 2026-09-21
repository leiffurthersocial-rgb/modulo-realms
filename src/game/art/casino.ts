import { PAL, mix, shade, withAlpha } from './palette';
import { Px } from './pixel';
import type { Card, Suit, SlotSymbol } from '../casino/games';

/**
 * Playing cards, chips and reel symbols, drawn at 1:1 pixel scale and handed
 * to React as data URLs — the same route `icons.ts` uses to get inventory art
 * into the DOM. Nothing here is a file: the casino's whole look is generated,
 * like every other pixel in the game.
 */

const cache = new Map<string, string>();
const cached = (key: string, make: () => Px): string => {
  let url = cache.get(key);
  if (!url) {
    url = make().canvas.toDataURL();
    cache.set(key, url);
  }
  return url;
};

/* ------------------------------------------------------------------ */
/* Suit marks                                                          */
/* ------------------------------------------------------------------ */

function spade(p: Px, cx: number, cy: number, s: number, color: string): void {
  p.poly([[cx, cy - s], [cx + s * 0.9, cy + s * 0.25], [cx, cy + s * 0.6], [cx - s * 0.9, cy + s * 0.25]], color);
  p.ellipse(cx - s * 0.4, cy + s * 0.18, s * 0.5, s * 0.44, color);
  p.ellipse(cx + s * 0.4, cy + s * 0.18, s * 0.5, s * 0.44, color);
  p.fill(cx - 1, cy + s * 0.3, 2, Math.max(1, s * 0.6), color);
  p.fill(cx - s * 0.45, cy + s * 0.85, s * 0.9, 1, color);
}

function heart(p: Px, cx: number, cy: number, s: number, color: string): void {
  p.ellipse(cx - s * 0.42, cy - s * 0.3, s * 0.55, s * 0.5, color);
  p.ellipse(cx + s * 0.42, cy - s * 0.3, s * 0.55, s * 0.5, color);
  p.poly([[cx - s * 0.92, cy - s * 0.18], [cx + s * 0.92, cy - s * 0.18], [cx, cy + s]], color);
}

function club(p: Px, cx: number, cy: number, s: number, color: string): void {
  p.ellipse(cx, cy - s * 0.45, s * 0.5, s * 0.48, color);
  p.ellipse(cx - s * 0.5, cy + s * 0.12, s * 0.5, s * 0.48, color);
  p.ellipse(cx + s * 0.5, cy + s * 0.12, s * 0.5, s * 0.48, color);
  p.fill(cx - 1, cy, 2, Math.max(1, s * 0.85), color);
  p.fill(cx - s * 0.45, cy + s * 0.85, s * 0.9, 1, color);
}

function diamond(p: Px, cx: number, cy: number, s: number, color: string): void {
  p.poly([[cx, cy - s], [cx + s * 0.78, cy], [cx, cy + s], [cx - s * 0.78, cy]], color);
}

export function suitMark(p: Px, suit: Suit, cx: number, cy: number, s: number, color: string): void {
  if (suit === 'spade') spade(p, cx, cy, s, color);
  else if (suit === 'heart') heart(p, cx, cy, s, color);
  else if (suit === 'club') club(p, cx, cy, s, color);
  else diamond(p, cx, cy, s, color);
}

/* ------------------------------------------------------------------ */
/* Card faces                                                          */
/* ------------------------------------------------------------------ */

/** A 3x5 pip font, enough for the corner index on a card. */
const RANK_GLYPH: Record<string, string[]> = {
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '0': ['111', '101', '101', '101', '111'],
  J: ['001', '001', '001', '101', '111'],
  Q: ['111', '101', '101', '111', '011'],
  K: ['101', '110', '100', '110', '101'],
  A: ['111', '101', '111', '101', '101'],
};

function glyph(p: Px, ch: string, x: number, y: number, color: string): number {
  const rows = RANK_GLYPH[ch];
  if (!rows) return 0;
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) if (row[rx] === '1') p.set(x + rx, y + ry, color);
  });
  return 4;
}

const CARD_W = 30;
const CARD_H = 42;

export function cardFace(card: Card, label: string): Px {
  const p = new Px(CARD_W, CARD_H);
  const red = card.suit === 'heart' || card.suit === 'diamond';
  const ink = red ? '#b8323a' : '#16131f';

  // stock, with a warm edge so it does not read as flat white
  p.fill(0, 0, CARD_W, CARD_H, '#0f0d14');
  p.fill(1, 1, CARD_W - 2, CARD_H - 2, PAL.white);
  p.fill(1, 1, CARD_W - 2, 1, '#ffffff');
  p.fill(1, CARD_H - 2, CARD_W - 2, 1, '#cfc5b4');
  p.fill(CARD_W - 2, 1, 1, CARD_H - 2, '#ded3c1');

  // corner index, top-left and mirrored bottom-right
  let x = 3;
  for (const ch of label) x += glyph(p, ch, x, 3, ink);
  suitMark(p, card.suit, 5, 12, 2.6, ink);
  let bx = CARD_W - 4 - (label.length * 4 - 1);
  for (const ch of label) bx += glyph(p, ch, bx, CARD_H - 8, ink);
  suitMark(p, card.suit, CARD_W - 6, CARD_H - 13, 2.6, ink);

  // centre mark
  suitMark(p, card.suit, CARD_W / 2, CARD_H / 2, 6.5, ink);
  p.ellipse(CARD_W / 2, CARD_H / 2 - 2, 7, 7, withAlpha('#ffffff', 0.12));
  return p;
}

export function cardBack(): Px {
  const p = new Px(CARD_W, CARD_H);
  p.fill(0, 0, CARD_W, CARD_H, '#0f0d14');
  p.fill(1, 1, CARD_W - 2, CARD_H - 2, '#6d2330');
  // woven diagonal weave, then a gilt border
  for (let y = 1; y < CARD_H - 1; y++) {
    for (let x = 1; x < CARD_W - 1; x++) {
      if ((x + y) % 4 === 0) p.set(x, y, '#8c3040');
      else if ((x - y + 40) % 4 === 0) p.set(x, y, '#4e1723');
    }
  }
  p.box(2, 2, CARD_W - 4, CARD_H - 4, PAL.gold);
  p.box(4, 4, CARD_W - 8, CARD_H - 8, '#8a6a2c');
  suitMark(p, 'spade', CARD_W / 2, CARD_H / 2, 5, PAL.goldLit);
  return p;
}

export const cardFaceUrl = (card: Card, label: string): string =>
  cached(`card:${card.rank}:${card.suit}`, () => cardFace(card, label));

export const cardBackUrl = (): string => cached('cardback', cardBack);

/* ------------------------------------------------------------------ */
/* Chips                                                               */
/* ------------------------------------------------------------------ */

/** Chip colours by denomination, smallest first. */
export const CHIP_TIERS: Array<{ value: number; body: string; edge: string }> = [
  { value: 1, body: '#d8cfc4', edge: '#8d8599' },
  { value: 5, body: '#b8323a', edge: '#6d1a22' },
  { value: 25, body: '#2f6f93', edge: '#173c52' },
  { value: 100, body: '#3c7a45', edge: '#1d4326' },
  { value: 500, body: '#d9a441', edge: '#8a6a2c' },
];

export function chip(tier: number): Px {
  const t = CHIP_TIERS[Math.max(0, Math.min(CHIP_TIERS.length - 1, tier))];
  const p = new Px(16, 16);
  p.ellipse(8, 8, 7.5, 7.5, '#0f0d14');
  p.ellipse(8, 8, 6.6, 6.6, t.edge);
  // the four edge spots a casino chip has
  for (const a of [0, 90, 180, 270]) {
    const r = (a * Math.PI) / 180;
    p.ellipse(8 + Math.cos(r) * 5.4, 8 + Math.sin(r) * 5.4, 2.1, 2.1, t.body);
  }
  p.ellipse(8, 8, 4.4, 4.4, t.body);
  p.ellipse(8, 8, 3.2, 3.2, shade(t.body, 0.86));
  p.ellipse(7, 6.6, 2, 1.6, withAlpha('#ffffff', 0.3));
  return p;
}

export const chipUrl = (tier: number): string => cached(`chip:${tier}`, () => chip(tier));

/** Break an amount into chip tiers, largest first, for a stack graphic. */
export function chipBreakdown(amount: number, max = 5): number[] {
  const out: number[] = [];
  let left = amount;
  for (let i = CHIP_TIERS.length - 1; i >= 0 && out.length < max; i--) {
    while (left >= CHIP_TIERS[i].value && out.length < max) {
      out.push(i);
      left -= CHIP_TIERS[i].value;
    }
  }
  if (out.length === 0 && amount > 0) out.push(0);
  return out;
}

/* ------------------------------------------------------------------ */
/* Reel symbols                                                        */
/* ------------------------------------------------------------------ */

const SYM = 28;

function cherries(p: Px): void {
  // stalks
  p.line(14, 6, 9, 16, '#3c7a45');
  p.line(14, 6, 19, 15, '#3c7a45');
  p.fill(13, 4, 3, 3, '#4f9a55');
  p.poly([[15, 4], [21, 2], [19, 7]], '#4f9a55');
  p.poly([[15, 4], [20, 3], [18, 6]], '#6cb96f');
  for (const [cx, cy] of [[9, 19], [19, 18]] as Array<[number, number]>) {
    p.ellipse(cx, cy, 5, 5, '#6d1a22');
    p.ellipse(cx, cy, 4.2, 4.2, '#b8323a');
    p.ellipse(cx - 1.3, cy - 1.3, 1.6, 1.4, '#e8757a');
    p.ellipse(cx - 1.6, cy - 1.7, 0.8, 0.7, PAL.white);
  }
}

function bell(p: Px): void {
  p.fill(13, 3, 2, 3, '#8a6a2c');
  p.poly([[14, 5], [21, 17], [22, 21], [6, 21], [7, 17]], '#8a6a2c');
  p.poly([[14, 6], [20, 17], [21, 20], [7, 20], [8, 17]], PAL.gold);
  p.poly([[14, 7], [17, 16], [17, 19], [11, 19], [11, 16]], PAL.goldLit);
  p.fill(5, 21, 18, 2, '#8a6a2c');
  p.fill(5, 21, 18, 1, PAL.goldLit);
  p.ellipse(14, 24, 2.4, 2.4, '#8a6a2c');
  p.ellipse(13.4, 23.6, 1.2, 1.2, PAL.goldLit);
}

function seven(p: Px): void {
  // a fat slab seven with a shadow, the way a real machine paints it
  const draw = (ox: number, oy: number, c: string) => {
    p.fill(6 + ox, 4 + oy, 16, 4, c);
    p.fill(15 + ox, 8 + oy, 5, 4, c);
    p.fill(13 + ox, 12 + oy, 5, 4, c);
    p.fill(11 + ox, 16 + oy, 5, 4, c);
    p.fill(10 + ox, 20 + oy, 5, 4, c);
  };
  draw(1, 1, '#6d1a22');
  draw(0, 0, '#c8383f');
  p.fill(6, 4, 16, 1, '#e8757a');
  p.fill(15, 8, 3, 1, '#e8757a');
}

function crownSym(p: Px): void {
  p.poly([[4, 20], [6, 7], [10, 13], [14, 4], [18, 13], [22, 7], [24, 20]], '#8a6a2c');
  p.poly([[5, 19], [7, 9], [10, 14], [14, 6], [18, 14], [21, 9], [23, 19]], PAL.gold);
  p.poly([[7, 18], [8, 12], [10, 15], [14, 9], [18, 15], [20, 12], [21, 18]], PAL.goldLit);
  p.fill(4, 20, 20, 3, '#8a6a2c');
  p.fill(4, 20, 20, 1, PAL.goldLit);
  p.ellipse(14, 6, 1.8, 1.8, PAL.white);
  p.ellipse(7, 9, 1.4, 1.4, '#b8323a');
  p.ellipse(21, 9, 1.4, 1.4, '#b8323a');
  p.ellipse(10, 22, 1.3, 1.3, '#6fd0e8');
  p.ellipse(18, 22, 1.3, 1.3, '#6fd0e8');
}

function spadeSym(p: Px): void {
  spade(p, 14, 14, 10, '#1a1622');
  spade(p, 14, 13, 9, '#2e2740');
  p.ellipse(11, 9, 2.4, 3, withAlpha('#ffffff', 0.16));
}

export function slotSymbol(sym: SlotSymbol): Px {
  const p = new Px(SYM, SYM);
  if (sym === 'cherry') cherries(p);
  else if (sym === 'bell') bell(p);
  else if (sym === 'seven') seven(p);
  else if (sym === 'crown') crownSym(p);
  else spadeSym(p);
  return p;
}

export const slotSymbolUrl = (sym: SlotSymbol): string => cached(`slot:${sym}`, () => slotSymbol(sym));

/** A blurred vertical smear of a symbol, for a reel still in motion. */
export function slotBlur(sym: SlotSymbol): Px {
  const src = slotSymbol(sym);
  const p = new Px(SYM, SYM);
  for (let i = -6; i <= 6; i += 2) {
    p.blit(src, 0, i, 0.16);
  }
  p.g.save();
  p.g.globalCompositeOperation = 'source-atop';
  p.g.fillStyle = withAlpha(mix(PAL.cloth, PAL.ash, 0.4), 0.2);
  p.g.fillRect(0, 0, SYM, SYM);
  p.g.restore();
  return p;
}

export const slotBlurUrl = (sym: SlotSymbol): string => cached(`blur:${sym}`, () => slotBlur(sym));

/** A single gold coin, for the jackpot shower. */
export const coinUrl = (): string => cached('coin', () => {
  const p = new Px(12, 12);
  p.ellipse(6, 6, 5.5, 5.5, '#8a6a2c');
  p.ellipse(6, 6, 4.5, 4.5, PAL.gold);
  p.ellipse(6, 6, 3, 3, PAL.goldLit);
  p.ellipse(4.6, 4.4, 1.4, 1.2, PAL.white);
  return p;
});
