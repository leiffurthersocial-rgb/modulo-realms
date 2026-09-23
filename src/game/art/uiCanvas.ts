import { PAL } from './palette';
import { makeCanvas, type Canvas } from './pixel';
import { uiSprite } from './uiArt';

/**
 * The interface's pieces drawn straight onto a canvas — the prompts over
 * doors, nameplates, the streak counter, floating numbers — in the same
 * font and frames as the DOM UI.
 *
 * Everything here takes `k`, the whole number of canvas pixels per UI pixel,
 * and lands on whole pixels, so a label drawn over the world is exactly as
 * crisp as the panel it sits next to.
 */

export const FONT_FACE = 'Modulo';
export const FONT_SMALL_FACE = 'Modulo Small';

/** Set a pixel font on a context at `size` UI pixels (10 or 20) times `k`. */
export function setFont(g: CanvasRenderingContext2D, k: number, size: 10 | 20 = 10, small = false, bold = false): void {
  g.font = `${bold ? '700 ' : ''}${size * k}px "${small ? FONT_SMALL_FACE : FONT_FACE}"`;
  g.textBaseline = 'alphabetic';
}

interface TextOpts {
  color?: string;
  /** a one-pixel hard outline all round, in UI pixels */
  outline?: string | null;
  /** a one-pixel hard drop shadow (down-right) */
  shadow?: string | null;
  align?: 'left' | 'center' | 'right';
}

/**
 * Draw text on whole pixels. `y` is the baseline. The outline is four hard
 * offset copies rather than a stroke, so it stays one pixel wide and square.
 */
export function pixelText(g: CanvasRenderingContext2D, text: string, x: number, y: number, k: number, o: TextOpts = {}): number {
  const w = g.measureText(text).width;
  let left = x;
  if (o.align === 'center') left = x - w / 2;
  else if (o.align === 'right') left = x - w;
  // snap to the UI pixel grid
  left = Math.round(left / k) * k;
  const top = Math.round(y / k) * k;
  const prev = g.textAlign;
  g.textAlign = 'left';
  if (o.outline) {
    g.fillStyle = o.outline;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) g.fillText(text, left + dx * k, top + dy * k);
  } else if (o.shadow) {
    g.fillStyle = o.shadow;
    g.fillText(text, left + k, top + k);
  }
  g.fillStyle = o.color ?? PAL.cloth;
  g.fillText(text, left, top);
  g.textAlign = prev;
  return w;
}

/* ------------------------------------------------------------------ */
/* 9-slice                                                             */
/* ------------------------------------------------------------------ */

const nineCache = new Map<string, Canvas>();

/**
 * A frame sprite stretched to `w` x `h` UI pixels the way `border-image`
 * does it (corners kept, edges and middle tiled), cached at 1:1.
 */
function nineAt(name: string, slice: number, w: number, h: number): Canvas {
  const key = `${name}|${slice}|${w}|${h}`;
  let c = nineCache.get(key);
  if (c) return c;
  const src = uiSprite(name);
  const sw = src.width;
  const sh = src.height;
  const mw = sw - slice * 2;
  const mh = sh - slice * 2;
  c = makeCanvas(w, h);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const tile = (sx: number, sy: number, tw: number, th: number, dx: number, dy: number, dw: number, dh: number) => {
    for (let y = 0; y < dh; y += th) {
      for (let x = 0; x < dw; x += tw) {
        const cw = Math.min(tw, dw - x);
        const ch = Math.min(th, dh - y);
        g.drawImage(src, sx, sy, cw, ch, dx + x, dy + y, cw, ch);
      }
    }
  };
  const iw = Math.max(0, w - slice * 2);
  const ih = Math.max(0, h - slice * 2);
  tile(slice, slice, mw, mh, slice, slice, iw, ih);
  tile(slice, 0, mw, slice, slice, 0, iw, slice);
  tile(slice, sh - slice, mw, slice, slice, h - slice, iw, slice);
  tile(0, slice, slice, mh, 0, slice, slice, ih);
  tile(sw - slice, slice, slice, mh, w - slice, slice, slice, ih);
  g.drawImage(src, 0, 0, slice, slice, 0, 0, slice, slice);
  g.drawImage(src, sw - slice, 0, slice, slice, w - slice, 0, slice, slice);
  g.drawImage(src, 0, sh - slice, slice, slice, 0, h - slice, slice, slice);
  g.drawImage(src, sw - slice, sh - slice, slice, slice, w - slice, h - slice, slice, slice);
  if (nineCache.size > 256) nineCache.clear();
  nineCache.set(key, c);
  return c;
}

/** Draw a frame of `w` x `h` UI pixels at canvas position `x, y`, scaled by `k`. */
export function drawNine(g: CanvasRenderingContext2D, name: string, slice: number, x: number, y: number, w: number, h: number, k: number): void {
  const img = nineAt(name, slice, Math.max(slice * 2, Math.round(w)), Math.max(slice * 2, Math.round(h)));
  const prev = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, Math.round(x), Math.round(y), img.width * k, img.height * k);
  g.imageSmoothingEnabled = prev;
}

/** Draw a UI sprite (icon, key cap) at `k` times its size. */
export function drawSprite(g: CanvasRenderingContext2D, name: string, x: number, y: number, k: number): void {
  const img = uiSprite(name);
  const prev = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, Math.round(x), Math.round(y), img.width * k, img.height * k);
  g.imageSmoothingEnabled = prev;
}

/**
 * A key cap with a label in the small font — the same piece the DOM
 * `<KeyCap>` draws. Returns its width in canvas pixels.
 */
export function drawKeyCap(g: CanvasRenderingContext2D, label: string, x: number, y: number, k: number): number {
  setFont(g, k, 10, true);
  const tw = Math.round(g.measureText(label).width / k);
  const w = Math.max(9, tw + 4);
  // 13 UI pixels tall like the DOM cap: 2 top, 8 face, 3 lip
  drawNine(g, 'key', 2, x, y, w, 13, k);
  // the face is 2..10; the small glyphs sit on a baseline 5 below their top
  pixelText(g, label, x + (w * k) / 2, y + 8 * k, k, { color: PAL.ink, align: 'center' });
  return w * k;
}

/** A box on the canvas, in canvas pixels. */
export interface ScreenRect { x: number; y: number; w: number; h: number }

export const rectsOverlap = (a: ScreenRect, b: ScreenRect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Where `drawPrompt` will put its plate: `x, y` in canvas pixels, `w, h` in
 * UI pixels. `screen` is the same box in canvas pixels, for layout checks.
 */
export function promptBox(g: CanvasRenderingContext2D, key: string, text: string, cx: number, bottom: number, k: number) {
  setFont(g, k, 10);
  const textW = Math.round(g.measureText(text).width / k);
  setFont(g, k, 10, true);
  const capW = Math.max(9, Math.round(g.measureText(key).width / k) + 4);
  const w = 4 + 2 + capW + 4 + textW + 3 + 4;
  const h = 4 + 15 + 4;
  const x = Math.round(cx - (w * k) / 2);
  const y = Math.round(bottom - h * k);
  return { x, y, w, h, capW, screen: { x, y, w: w * k, h: h * k } as ScreenRect };
}

/**
 * The interaction prompt: key cap and words on an ash plate, e.g.
 * "[E] Enter the Gilded Spade". Centred on `cx`, sitting on `bottom`.
 */
export function drawPrompt(g: CanvasRenderingContext2D, key: string, text: string, cx: number, bottom: number, k: number): void {
  const { x, y, w, h, capW } = promptBox(g, key, text, cx, bottom, k);
  drawNine(g, 'frame-ash', 4, x, y, w, h, k);
  drawKeyCap(g, key, x + 6 * k, y + 5 * k, k);
  setFont(g, k, 10);
  pixelText(g, text, x + (6 + capW + 4) * k, y + 15 * k, k, { color: PAL.cloth, shadow: PAL.void });
}
