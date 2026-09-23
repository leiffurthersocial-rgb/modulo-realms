import { PAL } from './palette';
import { makeCanvas, type Canvas } from './pixel';
import { getMinimap } from '../core/renderer';
import { TILES } from '../world/tiles';
import type { GameMap } from '../world/map';
import { LOCATIONS, REGION_BY_INDEX } from '../../data/locations';

/**
 * The atlas and the dungeon sheet, drawn as maps rather than as screenshots
 * of the minimap: the world in inks on parchment with the unknown hatched
 * over, and a dungeon as walls drawn in outline round pale floor.
 */

/* ------------------------------------------------------------------ */
/* the world atlas                                                     */
/* ------------------------------------------------------------------ */

const atlasCache = new Map<string, Canvas>();

/**
 * The world at one pixel per `step` tiles, re-inked onto parchment: the
 * terrain's own colours pulled toward sepia (a colour blend with the paper)
 * and then multiplied into it, so water still reads darker than land and
 * snow lighter than forest, but everything is the same sheet.
 */
export function parchmentAtlas(world: GameMap, step: number): Canvas {
  const key = `${world.id}:${step}`;
  const hit = atlasCache.get(key);
  if (hit) return hit;
  const src = getMinimap(world, step);
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'color';
  g.globalAlpha = 0.62;
  g.fillStyle = PAL.sand;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 1;
  g.fillStyle = PAL.sandLit;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  if (atlasCache.size > 6) atlasCache.clear();
  atlasCache.set(key, c);
  return c;
}

/** Tiles per fog cell: the unknown is revealed in blocks, not soft circles. */
const FOG_CELL = 8;

/**
 * The unknown, as a sheet the size of the atlas: blank paper with a hatch
 * wherever nothing you have discovered is near. Cells within reach of a
 * discovered place are cut out.
 */
export function atlasFog(world: GameMap, step: number, discovered: Set<string>): Canvas {
  const cw = Math.ceil(world.w / FOG_CELL);
  const ch = Math.ceil(world.h / FOG_CELL);
  const known = new Uint8Array(cw * ch);
  for (const loc of LOCATIONS) {
    if (loc.surfaceMap || !discovered.has(loc.id)) continue;
    const r = ((loc.radius ?? 12) * 3.4) / FOG_CELL;
    const cx = loc.tx / FOG_CELL;
    const cy = loc.ty / FOG_CELL;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(ch - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(cw - 1, Math.ceil(cx + r)); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) known[y * cw + x] = 1;
      }
    }
  }
  const w = Math.ceil(world.w / step);
  const h = Math.ceil(world.h / step);
  const c = makeCanvas(w, h);
  const g = c.getContext('2d')!;
  const cell = FOG_CELL / step;
  // the paper, then a diagonal hatch in a darker ink every four pixels
  const paper = makeCanvas(4, 4);
  const pg = paper.getContext('2d')!;
  pg.fillStyle = PAL.sandLit;
  pg.fillRect(0, 0, 4, 4);
  pg.fillStyle = PAL.sand;
  for (let i = 0; i < 4; i++) pg.fillRect(i, 3 - i, 1, 1);
  g.fillStyle = g.createPattern(paper, 'repeat')!;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (known[y * cw + x]) continue;
      g.fillRect(Math.floor(x * cell), Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }
  // an ink edge where the known world meets the blank
  g.fillStyle = PAL.sandDark;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (known[y * cw + x]) continue;
      const k = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < cw && yy < ch && known[yy * cw + xx];
      const px = Math.floor(x * cell);
      const py = Math.floor(y * cell);
      const s = Math.ceil(cell);
      if (k(x - 1, y)) g.fillRect(px, py, 1, s);
      if (k(x + 1, y)) g.fillRect(px + s - 1, py, 1, s);
      if (k(x, y - 1)) g.fillRect(px, py, s, 1);
      if (k(x, y + 1)) g.fillRect(px, py + s - 1, s, 1);
    }
  }
  return c;
}

const centroidCache = new Map<string, Array<{ index: number; x: number; y: number }>>();

/**
 * Where to write each region's name: the median tile of the region, which
 * lands inside even a crescent-shaped region more often than the mean does.
 */
export function regionLabelPoints(world: GameMap): Array<{ index: number; x: number; y: number }> {
  const hit = centroidCache.get(world.id);
  if (hit) return hit;
  const xs = new Map<number, number[]>();
  const ys = new Map<number, number[]>();
  if (world.regions) {
    for (let y = 0; y < world.h; y += 4) {
      for (let x = 0; x < world.w; x += 4) {
        const r = world.regions[y * world.w + x];
        if (r === undefined || !REGION_BY_INDEX[r]) continue;
        if (TILES[world.tiles[y * world.w + x]]?.water) continue;
        (xs.get(r) ?? xs.set(r, []).get(r)!).push(x);
        (ys.get(r) ?? ys.set(r, []).get(r)!).push(y);
      }
    }
  }
  const median = (a: number[]) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
  const out = [...xs.keys()].map((index) => ({ index, x: median(xs.get(index)!), y: median(ys.get(index)!) }));
  centroidCache.set(world.id, out);
  return out;
}

/* ------------------------------------------------------------------ */
/* dungeon sheets                                                      */
/* ------------------------------------------------------------------ */

/**
 * A dungeon floor as a hand-drawn plan: every walkable tile a pale cell,
 * every edge where floor meets rock inked in a hard line, a faint dot grid
 * on the floor for scale. `s` is pixels per tile (a whole number).
 */
export function dungeonSheet(map: GameMap, s: number): Canvas {
  const c = makeCanvas(map.w * s, map.h * s);
  const g = c.getContext('2d')!;
  const open = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
    const t = TILES[map.tiles[y * map.w + x]];
    return !!t && !t.solid && !t.water;
  };
  const water = (x: number, y: number) => !!TILES[map.tiles[y * map.w + x]]?.water;
  g.fillStyle = PAL.ink;
  g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const px = x * s;
      const py = y * s;
      if (water(x, y)) {
        g.fillStyle = PAL.water;
        g.fillRect(px, py, s, s);
        continue;
      }
      if (!open(x, y)) {
        // rock beside a room gets a hatch so the walls read as mass
        if (open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1)) {
          g.fillStyle = PAL.charcoal;
          g.fillRect(px, py, s, s);
          g.fillStyle = PAL.slate;
          for (let i = 0; i < s; i += 2) g.fillRect(px + i, py + s - 1 - i, 1, 1);
        }
        continue;
      }
      g.fillStyle = PAL.sand;
      g.fillRect(px, py, s, s);
      if (s >= 3 && (x + y) % 2 === 0) {
        g.fillStyle = PAL.sandDark;
        g.fillRect(px + Math.floor(s / 2), py + Math.floor(s / 2), 1, 1);
      }
    }
  }
  // wall outlines, one ink pixel on the floor side of every floor/rock edge
  g.fillStyle = PAL.woodDark;
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      if (!open(x, y)) continue;
      const px = x * s;
      const py = y * s;
      if (!open(x - 1, y) && !water(Math.max(0, x - 1), y)) g.fillRect(px, py, 1, s);
      if (!open(x + 1, y) && !water(Math.min(map.w - 1, x + 1), y)) g.fillRect(px + s - 1, py, 1, s);
      if (!open(x, y - 1) && !water(x, Math.max(0, y - 1))) g.fillRect(px, py, s, 1);
      if (!open(x, y + 1) && !water(x, Math.min(map.h - 1, y + 1))) g.fillRect(px, py + s - 1, s, 1);
    }
  }
  return c;
}
