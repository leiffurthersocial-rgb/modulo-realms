import { RNG } from '../core/rng';
import { withAlpha } from './palette';

export type Canvas = HTMLCanvasElement;

export function makeCanvas(w: number, h: number): Canvas {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c: Canvas): CanvasRenderingContext2D {
  const g = c.getContext('2d', { willReadFrequently: false })!;
  g.imageSmoothingEnabled = false;
  return g;
}

/**
 * Tiny immediate-mode pixel drawing surface. Everything in the game's art is
 * built from these primitives at 1:1 pixel scale, then blitted with smoothing
 * disabled so it stays crisp at any zoom.
 */
export class Px {
  readonly canvas: Canvas;
  readonly g: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;

  constructor(w: number, h: number) {
    this.w = Math.round(w);
    this.h = Math.round(h);
    this.canvas = makeCanvas(this.w, this.h);
    this.g = ctx2d(this.canvas);
  }

  set(x: number, y: number, color: string): this {
    this.g.fillStyle = color;
    this.g.fillRect(Math.round(x), Math.round(y), 1, 1);
    return this;
  }

  fill(x: number, y: number, w: number, h: number, color: string): this {
    this.g.fillStyle = color;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return this;
  }

  fillAll(color: string): this {
    return this.fill(0, 0, this.w, this.h, color);
  }

  /** Hollow rectangle, 1px border. */
  box(x: number, y: number, w: number, h: number, color: string): this {
    this.fill(x, y, w, 1, color);
    this.fill(x, y + h - 1, w, 1, color);
    this.fill(x, y, 1, h, color);
    this.fill(x + w - 1, y, 1, h, color);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string): this {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  /** Filled axis-aligned ellipse, drawn scanline-wise so edges stay pixel-crisp. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): this {
    if (rx <= 0 || ry <= 0) return this;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      const s = 1 - dy * dy;
      if (s <= 0) continue;
      const half = Math.sqrt(s) * rx;
      const x0 = Math.round(cx - half);
      const wd = Math.max(1, Math.round(half * 2));
      this.fill(x0, y, wd, 1, color);
    }
    return this;
  }

  circle(cx: number, cy: number, r: number, color: string): this {
    return this.ellipse(cx, cy, r, r, color);
  }

  /** Filled polygon via the 2D context (points are pixel coordinates). */
  poly(points: Array<[number, number]>, color: string): this {
    if (points.length < 3) return this;
    this.g.fillStyle = color;
    this.g.beginPath();
    this.g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) this.g.lineTo(points[i][0], points[i][1]);
    this.g.closePath();
    this.g.fill();
    return this;
  }

  /** Scatter single pixels inside a rect. */
  speckle(x: number, y: number, w: number, h: number, colors: string[], density: number, rng: RNG): this {
    const count = Math.round(w * h * density);
    for (let i = 0; i < count; i++) {
      this.set(x + rng.int(0, w - 1), y + rng.int(0, h - 1), rng.pick(colors));
    }
    return this;
  }

  /** Draw another surface onto this one. */
  blit(src: Px | Canvas, x: number, y: number, alpha = 1): this {
    const img = src instanceof Px ? src.canvas : src;
    if (alpha < 1) {
      this.g.save();
      this.g.globalAlpha = alpha;
      this.g.drawImage(img, Math.round(x), Math.round(y));
      this.g.restore();
    } else {
      this.g.drawImage(img, Math.round(x), Math.round(y));
    }
    return this;
  }

  /** Tint every opaque pixel toward a colour. */
  tint(color: string, strength: number): this {
    this.g.save();
    this.g.globalCompositeOperation = 'source-atop';
    this.g.fillStyle = withAlpha(color, strength);
    this.g.fillRect(0, 0, this.w, this.h);
    this.g.restore();
    return this;
  }

  /** Add a 1px outline around all opaque pixels (drawn underneath). */
  outline(color: string, includeDiagonals = false): this {
    const out = new Px(this.w, this.h);
    const offsets: Array<[number, number]> = includeDiagonals
      ? [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]
      : [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of offsets) out.blit(this, dx, dy);
    out.g.save();
    out.g.globalCompositeOperation = 'source-in';
    out.g.fillStyle = color;
    out.g.fillRect(0, 0, this.w, this.h);
    out.g.restore();
    out.blit(this, 0, 0);
    this.g.clearRect(0, 0, this.w, this.h);
    this.blit(out, 0, 0);
    return this;
  }

  /** Multiply-darken the lower portion, a cheap ambient-occlusion look. */
  shadeBottom(rows: number, strength = 0.25): this {
    this.g.save();
    this.g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < rows; i++) {
      this.g.fillStyle = `rgba(0,0,0,${(strength * (i + 1)) / rows})`;
      this.g.fillRect(0, this.h - rows + i, this.w, 1);
    }
    this.g.restore();
    return this;
  }

  mirrored(): Px {
    const out = new Px(this.w, this.h);
    out.g.save();
    out.g.translate(this.w, 0);
    out.g.scale(-1, 1);
    out.g.drawImage(this.canvas, 0, 0);
    out.g.restore();
    return out;
  }

  clone(): Px {
    const out = new Px(this.w, this.h);
    out.blit(this, 0, 0);
    return out;
  }
}

/** Compose a horizontal strip of frames into a single sheet canvas. */
export function strip(frames: Px[]): Canvas {
  if (frames.length === 0) return makeCanvas(1, 1);
  const fw = frames[0].w;
  const fh = frames[0].h;
  const sheet = makeCanvas(fw * frames.length, fh);
  const g = ctx2d(sheet);
  frames.forEach((f, i) => g.drawImage(f.canvas, i * fw, 0));
  return sheet;
}

/** Compose a grid: rows of frames (each row same length). */
export function sheetGrid(rows: Px[][]): Canvas {
  const fw = rows[0][0].w;
  const fh = rows[0][0].h;
  const cols = Math.max(...rows.map((r) => r.length));
  const sheet = makeCanvas(fw * cols, fh * rows.length);
  const g = ctx2d(sheet);
  rows.forEach((row, y) => row.forEach((f, x) => g.drawImage(f.canvas, x * fw, y * fh)));
  return sheet;
}
