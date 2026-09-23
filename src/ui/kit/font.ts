import { MODULO, SMALL, type GlyphMap } from './glyphs';

/**
 * The UI's pixel fonts, built at boot as TrueType files in memory.
 *
 * There are no binary assets in this project, and a web font is one. So the
 * glyph bitmaps in `glyphs.ts` are turned into square outlines here and
 * handed to the browser through `FontFace`, which lets every DOM label and
 * every canvas `fillText` use the same hand-drawn letters.
 *
 * One font pixel is 100 units on a 1000-unit em, so at `font-size: 10px` a
 * glyph pixel is exactly one CSS pixel, at 20px exactly two. Those are the
 * only sizes the UI uses; anything in between would smear.
 */

const UNIT = 100;
const EM = 1000;
const ASCENT = 800;
const DESCENT = 200;

export const FONT_BODY = 'Modulo';
export const FONT_SMALL = 'Modulo Small';

type Rect = { x0: number; y0: number; x1: number; y1: number };

interface Glyph {
  code: number;
  rects: Rect[];
  advance: number;
}

/** Merge lit pixels into horizontal runs, then stack identical runs. */
function outline(rows: string[], cap: number, bold: boolean): Rect[] {
  const w = Math.max(...rows.map((r) => r.length)) + (bold ? 1 : 0);
  const lit = rows.map((row) => {
    const out: boolean[] = new Array(w).fill(false);
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') {
        out[x] = true;
        if (bold) out[x + 1] = true;
      }
    }
    return out;
  });
  const runs: { r: number; a: number; b: number }[] = [];
  lit.forEach((row, r) => {
    let x = 0;
    while (x < w) {
      if (!row[x]) { x++; continue; }
      const a = x;
      while (x < w && row[x]) x++;
      runs.push({ r, a, b: x });
    }
  });
  const rects: Rect[] = [];
  const used = new Set<number>();
  runs.forEach((run, i) => {
    if (used.has(i)) return;
    used.add(i);
    let bottom = run.r;
    for (;;) {
      const next = runs.findIndex((o, j) => !used.has(j) && o.r === bottom + 1 && o.a === run.a && o.b === run.b);
      if (next < 0) break;
      used.add(next);
      bottom++;
    }
    // row r spans y from (cap-1-r) to (cap-r) pixels above the baseline
    rects.push({ x0: run.a * UNIT, x1: run.b * UNIT, y0: (cap - 1 - bottom) * UNIT, y1: (cap - run.r) * UNIT });
  });
  return rects;
}

function buildGlyphs(map: GlyphMap, cap: number, bold: boolean, foldCase: boolean): Glyph[] {
  const byCode = new Map<number, Glyph>();
  const add = (ch: string, rows: string[]) => {
    const w = Math.max(...rows.map((r) => r.length)) + (bold && ch.trim() ? 1 : 0);
    byCode.set(ch.codePointAt(0)!, {
      code: ch.codePointAt(0)!,
      rects: ch.trim() ? outline(rows, cap, bold) : [],
      advance: (w + 1) * UNIT,
    });
  };
  for (const [ch, rows] of Object.entries(map)) add(ch, rows);
  if (foldCase) {
    for (const [ch, rows] of Object.entries(map)) {
      const lower = ch.toLowerCase();
      if (lower !== ch && !map[lower]) add(lower, rows);
    }
  }
  return [...byCode.values()].sort((a, b) => a.code - b.code);
}

/* ------------------------------------------------------------------ */
/* a minimal TrueType writer                                           */
/* ------------------------------------------------------------------ */

class Buf {
  bytes: number[] = [];
  u8(v: number) { this.bytes.push(v & 255); return this; }
  u16(v: number) { return this.u8(v >> 8).u8(v); }
  i16(v: number) { return this.u16(v < 0 ? v + 65536 : v); }
  u32(v: number) { return this.u16(Math.floor(v / 65536) & 0xffff).u16(v & 0xffff); }
  tag(s: string) { for (const c of s) this.u8(c.charCodeAt(0)); return this; }
  pad4() { while (this.bytes.length % 4) this.u8(0); return this; }
  get length() { return this.bytes.length; }
}

function checksum(bytes: number[]): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    const v = ((bytes[i] ?? 0) << 24 >>> 0) + ((bytes[i + 1] ?? 0) << 16) + ((bytes[i + 2] ?? 0) << 8) + (bytes[i + 3] ?? 0);
    sum = (sum + v) >>> 0;
  }
  return sum;
}

function buildTtf(family: string, glyphs: Glyph[], bold: boolean): ArrayBuffer {
  // glyph 0 is .notdef: a hollow box
  const notdef: Glyph = {
    code: -1,
    advance: 5 * UNIT,
    rects: [
      { x0: 0, x1: 400, y0: 0, y1: 100 }, { x0: 0, x1: 400, y0: 600, y1: 700 },
      { x0: 0, x1: 100, y0: 100, y1: 600 }, { x0: 300, x1: 400, y0: 100, y1: 600 },
    ],
  };
  const all = [notdef, ...glyphs];
  const numGlyphs = all.length;

  // glyf + loca
  const glyf = new Buf();
  const loca: number[] = [];
  let maxPoints = 0;
  let maxContours = 0;
  let xMin = 0, yMin = 0, xMax = 0, yMax = 0;
  for (const g of all) {
    loca.push(glyf.length);
    if (!g.rects.length) continue;
    const gx0 = Math.min(...g.rects.map((r) => r.x0));
    const gy0 = Math.min(...g.rects.map((r) => r.y0));
    const gx1 = Math.max(...g.rects.map((r) => r.x1));
    const gy1 = Math.max(...g.rects.map((r) => r.y1));
    xMin = Math.min(xMin, gx0); yMin = Math.min(yMin, gy0);
    xMax = Math.max(xMax, gx1); yMax = Math.max(yMax, gy1);
    maxContours = Math.max(maxContours, g.rects.length);
    maxPoints = Math.max(maxPoints, g.rects.length * 4);
    glyf.i16(g.rects.length).i16(gx0).i16(gy0).i16(gx1).i16(gy1);
    g.rects.forEach((_, i) => glyf.u16(i * 4 + 3));
    glyf.u16(0); // no instructions
    const pts: [number, number][] = [];
    // clockwise: bottom-left, top-left, top-right, bottom-right
    for (const r of g.rects) pts.push([r.x0, r.y0], [r.x0, r.y1], [r.x1, r.y1], [r.x1, r.y0]);
    for (let i = 0; i < pts.length; i++) glyf.u8(0x01);
    let px = 0;
    for (const [x] of pts) { glyf.i16(x - px); px = x; }
    let py = 0;
    for (const [, y] of pts) { glyf.i16(y - py); py = y; }
    glyf.pad4();
  }
  loca.push(glyf.length);
  const locaBuf = new Buf();
  for (const o of loca) locaBuf.u32(o);

  // hmtx
  const hmtx = new Buf();
  for (const g of all) {
    const lsb = g.rects.length ? Math.min(...g.rects.map((r) => r.x0)) : 0;
    hmtx.u16(g.advance).i16(lsb);
  }
  const advMax = Math.max(...all.map((g) => g.advance));

  // cmap (format 4); glyph ids are assigned in code order, so each run of
  // consecutive code points maps with a single idDelta
  const segs: { start: number; end: number; delta: number }[] = [];
  glyphs.forEach((g, i) => {
    const gid = i + 1;
    const last = segs[segs.length - 1];
    if (last && g.code === last.end + 1 && (gid - g.code) === last.delta) last.end = g.code;
    else segs.push({ start: g.code, end: g.code, delta: gid - g.code });
  });
  segs.push({ start: 0xffff, end: 0xffff, delta: 1 });
  const segCount = segs.length;
  const searchRange = 2 * 2 ** Math.floor(Math.log2(segCount));
  const sub = new Buf();
  sub.u16(4).u16(16 + segCount * 8).u16(0)
    .u16(segCount * 2).u16(searchRange).u16(Math.log2(searchRange / 2)).u16(segCount * 2 - searchRange);
  for (const s of segs) sub.u16(s.end);
  sub.u16(0);
  for (const s of segs) sub.u16(s.start);
  for (const s of segs) sub.u16(((s.delta % 65536) + 65536) % 65536);
  for (let i = 0; i < segCount; i++) sub.u16(0);
  const cmap = new Buf();
  cmap.u16(0).u16(1).u16(3).u16(1).u32(12);
  cmap.bytes.push(...sub.bytes);

  // head
  const head = new Buf();
  head.u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5)
    .u16(0x000b).u16(EM)
    .u32(0).u32(0).u32(0).u32(0)
    .i16(xMin).i16(yMin).i16(xMax).i16(yMax)
    .u16(bold ? 1 : 0).u16(8).i16(2).i16(1).i16(0);

  // hhea
  const hhea = new Buf();
  hhea.u32(0x00010000).i16(ASCENT).i16(-DESCENT).i16(0).u16(advMax)
    .i16(0).i16(0).i16(xMax).i16(1).i16(0).i16(0)
    .i16(0).i16(0).i16(0).i16(0).i16(0).u16(numGlyphs);

  // maxp 1.0
  const maxp = new Buf();
  maxp.u32(0x00010000).u16(numGlyphs).u16(maxPoints).u16(maxContours)
    .u16(0).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);

  // OS/2 v4
  const os2 = new Buf();
  const avg = Math.round(all.reduce((s, g) => s + g.advance, 0) / numGlyphs);
  const codes = glyphs.map((g) => g.code);
  os2.u16(4).i16(avg).u16(bold ? 700 : 400).u16(5).u16(0)
    .i16(650).i16(700).i16(0).i16(140).i16(650).i16(700).i16(0).i16(480)
    .i16(UNIT).i16(300).i16(0);
  for (let i = 0; i < 10; i++) os2.u8(0);
  os2.u32(1).u32(0).u32(0).u32(0).tag('MDLO')
    .u16((bold ? 0x20 : 0x40) | 0x80)
    .u16(Math.min(...codes)).u16(Math.min(0xffff, Math.max(...codes)))
    .i16(ASCENT).i16(-DESCENT).i16(0).u16(ASCENT).u16(DESCENT)
    .u32(1).u32(0).i16(500).i16(700).u16(0).u16(32).u16(1);

  // name
  const style = bold ? 'Bold' : 'Regular';
  const names: [number, string][] = [
    [1, family], [2, style], [3, `${family} ${style} generated`], [4, `${family} ${style}`],
    [6, `${family.replace(/\s/g, '')}-${style}`],
  ];
  const strings = new Buf();
  const recs = new Buf();
  for (const [id, text] of names) {
    const start = strings.length;
    for (const c of text) strings.u16(c.charCodeAt(0));
    recs.u16(3).u16(1).u16(0x409).u16(id).u16(strings.length - start).u16(start);
  }
  const name = new Buf();
  name.u16(0).u16(names.length).u16(6 + names.length * 12);
  name.bytes.push(...recs.bytes, ...strings.bytes);

  // post 3.0
  const post = new Buf();
  post.u32(0x00030000).u32(0).i16(-UNIT).i16(UNIT).u32(0).u32(0).u32(0).u32(0).u32(0);

  const tables: [string, Buf][] = [
    ['OS/2', os2], ['cmap', cmap], ['glyf', glyf], ['head', head], ['hhea', hhea],
    ['hmtx', hmtx], ['loca', locaBuf], ['maxp', maxp], ['name', name], ['post', post],
  ];
  const n = tables.length;
  const sr = 16 * 2 ** Math.floor(Math.log2(n));
  const out = new Buf();
  out.u32(0x00010000).u16(n).u16(sr).u16(Math.log2(sr / 16)).u16(n * 16 - sr);
  let offset = 12 + n * 16;
  const headerAt: number[] = [];
  for (const [tag, buf] of tables) {
    out.tag(tag).u32(checksum(buf.bytes)).u32(offset).u32(buf.length);
    headerAt.push(offset);
    offset += Math.ceil(buf.length / 4) * 4;
  }
  let headOffset = 0;
  tables.forEach(([tag, buf], i) => {
    if (tag === 'head') headOffset = headerAt[i];
    out.bytes.push(...buf.bytes);
    out.pad4();
  });
  const adjust = (0xb1b0afba - checksum(out.bytes)) >>> 0;
  const at = headOffset + 8;
  out.bytes[at] = (adjust >>> 24) & 255;
  out.bytes[at + 1] = (adjust >>> 16) & 255;
  out.bytes[at + 2] = (adjust >>> 8) & 255;
  out.bytes[at + 3] = adjust & 255;
  return new Uint8Array(out.bytes).buffer;
}

/** Build both families (regular and bold body, one small) as TTF buffers. */
export function buildFonts(): { family: string; weight: string; data: ArrayBuffer }[] {
  return [
    { family: FONT_BODY, weight: '400', data: buildTtf(FONT_BODY, buildGlyphs(MODULO, 7, false, false), false) },
    { family: FONT_BODY, weight: '700', data: buildTtf(FONT_BODY, buildGlyphs(MODULO, 7, true, false), true) },
    { family: FONT_SMALL, weight: '400', data: buildTtf(FONT_SMALL, buildGlyphs(SMALL, 5, false, true), false) },
  ];
}

/**
 * Register the fonts with the document. Resolves once they can be drawn, so
 * the first frame never shows a fallback face.
 */
export async function installFonts(): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return;
  const faces = buildFonts().map(({ family, weight, data }) => {
    const face = new FontFace(family, data, { weight, style: 'normal', display: 'block' });
    document.fonts.add(face);
    return face.load();
  });
  try {
    await Promise.all(faces);
  } catch (err) {
    // A font the browser refuses is cosmetic; the fallback stack still reads.
    console.warn('Modulo pixel font failed to load', err);
  }
}
