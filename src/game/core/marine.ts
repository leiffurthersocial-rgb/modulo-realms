import type { GameMap } from '../world/map';
import { T, TILE, TILES, isWater } from '../world/tiles';

export const MARINE_CHUNK = 16;
export const MARINE_CACHE_LIMIT = 48;
export const isMarine = (id: number): boolean => id === T.AEGEAN_SHALLOWS || id === T.AEGEAN_SEA;
const tileAt = (map: GameMap, x: number, y: number): number => {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  return tx < 0 || ty < 0 || tx >= map.w || ty >= map.h ? T.VOID : map.tiles[ty * map.w + tx];
};
const beach = (id: number): boolean => !!TILES[id] && !TILES[id].solid && !TILES[id].water
  && (TILES[id].shore === 'sand' || TILES[id].shore === 'shingle' || TILES[id].step === 'sand');
/** Eight 32×32 RGBA masks, in terrain-renderer order N,E,S,W,NW,NE,SE,SW.
 * Read once from the existing tileset; the marine pass allocates no canvases. */
export type MarineBankMasks = readonly Uint8ClampedArray[];
const BANK_NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [1, -1], [1, 1], [-1, 1],
];

/** A hard bank already overlaps this water tile in the cached terrain. Mask
 * only those existing pixels, preserving the broken edge rather than adding
 * a second rectangular shoreline or a new full-screen surface. */
function bankOcclusion(map: GameMap, tx: number, ty: number, left: number, top: number, right: number, bottom: number, masks?: MarineBankMasks): number {
  if (!masks) return 0;
  let covered = 0;
  for (let n = 0; n < BANK_NEIGHBORS.length; n++) {
    const [ox, oy] = BANK_NEIGHBORS[n], nx = tx + ox, ny = ty + oy;
    if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
    const id = map.tiles[ny * map.w + nx], mask = masks[n];
    if (!mask || id === T.VOID || isWater(id) || beach(id)) continue;
    // Almost all offshore marks have no bank neighbours. Even beside a bank,
    // marks outside its narrow mask remain one fillRect call.
    let intersects = false;
    for (let y = top; y < bottom && !intersects; y++) for (let x = left; x < right; x++) {
      if (mask[((y - ty * TILE) * TILE + x - tx * TILE) * 4 + 3]) { intersects = true; break; }
    }
    if (intersects) covered |= 1 << n;
  }
  return covered;
}

function maskCovers(masks: MarineBankMasks, bits: number, x: number, y: number): boolean {
  const alpha = (y * TILE + x) * 4 + 3;
  for (let n = 0; n < BANK_NEIGHBORS.length; n++) if ((bits & (1 << n)) && masks[n][alpha]) return true;
  return false;
}

/** Clip the entire small pixel mark, including its trailing edge. Checking only
 * its anchor lets spray and shadows paint across nearby pier or river tiles. */
function waterMark(g: CanvasRenderingContext2D, map: GameMap, x: number, y: number, w: number, h: number, material: 'sea' | 'beach' | 'surf' = 'sea', masks?: MarineBankMasks): void {
  x = Math.round(x); y = Math.round(y);
  for (let ty = Math.max(0, Math.floor(y / TILE)); ty <= Math.min(map.h - 1, Math.floor((y + h - 1) / TILE)); ty++) {
    for (let tx = Math.max(0, Math.floor(x / TILE)); tx <= Math.min(map.w - 1, Math.floor((x + w - 1) / TILE)); tx++) {
      const id = map.tiles[ty * map.w + tx];
      if (!(material !== 'beach' && isMarine(id)) && !(material !== 'sea' && beach(id))) continue;
      const left = Math.max(x, tx * TILE), top = Math.max(y, ty * TILE);
      const right = Math.min(x + w, (tx + 1) * TILE), bottom = Math.min(y + h, (ty + 1) * TILE);
      const covered = isMarine(id) ? bankOcclusion(map, tx, ty, left, top, right, bottom, masks) : 0;
      if (!covered) { g.fillRect(left, top, right - left, bottom - top); continue; }
      for (let py = top; py < bottom; py++) {
        let run = left;
        for (let px = left; px <= right; px++) {
          const blocked = px === right || maskCovers(masks!, covered, px - tx * TILE, py - ty * TILE);
          if (blocked) {
            if (px > run) g.fillRect(run, py, px - run, 1);
            run = px + 1;
          }
        }
      }
    }
  }
}

export interface ShoreSegment {
  ax: number; ay: number; bx: number; by: number;
  /** Unit normal from the dry bank towards the local water, including islands. */
  nx: number; ny: number;
  beach: boolean;
}
interface ShoreCache { revision: string | undefined; chunks: Map<number, ShoreSegment[]> }
const shores = new WeakMap<GameMap, ShoreCache>();

/** March the actual local water boundary. A mainland-distance field would miss
 * every island beach and incorrectly put breakers out in the open ocean. */
export function buildShoreChunk(map: GameMap, cx: number, cy: number): ShoreSegment[] {
  const result: ShoreSegment[] = [];
  const startX = cx * MARINE_CHUNK, startY = cy * MARINE_CHUNK;
  for (let y = startY; y < startY + MARINE_CHUNK && y < map.h - 1; y++) {
    for (let x = startX; x < startX + MARINE_CHUNK && x < map.w - 1; x++) {
      if (x < 0 || y < 0) continue;
      const ids = [map.tiles[y * map.w + x], map.tiles[y * map.w + x + 1],
        map.tiles[(y + 1) * map.w + x + 1], map.tiles[(y + 1) * map.w + x]];
      const wet = ids.map(isMarine), count = wet.filter(Boolean).length;
      if (count === 0 || count === 4) continue;
      // A river mouth joins water to water; neither a bridge nor the void is a beach.
      const dry = ids.filter((_, i) => !wet[i]);
      if (!dry.some(id => id !== T.VOID && !isWater(id) && id !== T.BRIDGE && id !== T.FLOOR_WOOD && id !== T.MARBLE)) continue;
      const px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
      const corners = [[px, py], [px + TILE, py], [px + TILE, py + TILE], [px, py + TILE]];
      const crossings: Array<{x: number; y: number; edge: number}> = [];
      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        if (wet[i] !== wet[next]) crossings.push({x: (corners[i][0] + corners[next][0]) / 2, y: (corners[i][1] + corners[next][1]) / 2, edge: i});
      }
      const pairs = crossings.length === 2 ? [[crossings[0], crossings[1]]] : wet[0]
        ? [[crossings[3], crossings[0]], [crossings[1], crossings[2]]]
        : [[crossings[0], crossings[1]], [crossings[2], crossings[3]]];
      for (const [a, b] of pairs) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        let closest = -1, distance = Infinity;
        for (let i = 0; i < 4; i++) if (wet[i]) {
          const d = (corners[i][0] - mx) ** 2 + (corners[i][1] - my) ** 2;
          if (d < distance) { closest = i; distance = d; }
        }
        let nx = -(b.y - a.y), ny = b.x - a.x;
        const length = Math.hypot(nx, ny);
        nx /= length; ny /= length;
        if (nx * (corners[closest][0] - mx) + ny * (corners[closest][1] - my) < 0) { nx = -nx; ny = -ny; }
        result.push({ax: a.x, ay: a.y, bx: b.x, by: b.y, nx, ny, beach: dry.some(beach)});
      }
    }
  }
  return result;
}

export function shoreChunk(map: GameMap, cx: number, cy: number): ShoreSegment[] {
  let cache = shores.get(map);
  if (!cache || cache.revision !== map.revision) {
    cache = { revision: map.revision, chunks: new Map() };
    shores.set(map, cache);
  }
  const key = cy * Math.ceil(map.w / MARINE_CHUNK) + cx;
  const hit = cache.chunks.get(key);
  if (hit) { cache.chunks.delete(key); cache.chunks.set(key, hit); return hit; }
  const segments = buildShoreChunk(map, cx, cy);
  cache.chunks.set(key, segments);
  if (cache.chunks.size > MARINE_CACHE_LIMIT) cache.chunks.delete(cache.chunks.keys().next().value!);
  return segments;
}
export function marineCacheSize(map: GameMap): number { return shores.get(map)?.chunks.size ?? 0; }

/** One wave approaches, breaks, runs up the beach, and thins as it retreats. */
export function surfAt(time: number, x: number, y: number): { distance: number; foam: number; wash: number } {
  const phase = ((time / 7.2 + (x + y * .57) / 1700) % 1 + 1) % 1;
  if (phase < .56) {
    const p = phase / .56;
    return { distance: 37 * (1 - p) + 2, foam: .12 + Math.sin(p * Math.PI / 2) * .6, wash: 0 };
  }
  if (phase < .78) {
    const p = (phase - .56) / .22;
    return { distance: 2 - Math.sin(p * Math.PI / 2) * 8, foam: .72 - p * .2, wash: Math.sin(p * Math.PI / 2) };
  }
  const p = (phase - .78) / .22;
  return { distance: -6 + p * 15, foam: .52 * (1 - p) ** 1.5, wash: 1 - p };
}

/** Coordinates are world anchored so wave fronts cross tiles and cached chunks. */
export function swellY(x: number, band: number, time: number): number {
  return band * 72 + time * 6.5 + x * .19
    + Math.sin(x / 93 + band * .71 - time * .38) * 7
    + Math.sin(x / 27 + band * 2.1 - time * .2) * 1.6;
}

function swells(g: CanvasRenderingContext2D, map: GameMap, left: number, top: number, w: number, h: number, time: number, masks?: MarineBankMasks): void {
  const x0 = Math.floor(left / 6) * 6, x1 = left + w + 6;
  const b0 = Math.floor((top - x1 * .19 - time * 6.5 - 12) / 72);
  const b1 = Math.ceil((top + h - x0 * .19 - time * 6.5 + 12) / 72);
  for (let band = b0; band <= b1; band++) for (let x = x0; x < x1; x += 6) {
    const y = swellY(x, band, time);
    if (y < top - 5 || y > top + h + 5) continue;
    const id = tileAt(map, x + 3, y);
    if (!isMarine(id) || !isMarine(tileAt(map, x + 6, y))) continue;
    const pulse = .5 + .5 * Math.sin(x / 47 + band * 1.9 + time * .34);
    const deep = id === T.AEGEAN_SEA;
    g.globalAlpha = (deep ? .12 : .08) + pulse * .09;
    g.fillStyle = '#123d59';
    waterMark(g, map, x, y + 3, 6, 2, 'sea', masks);
    g.globalAlpha = (deep ? .17 : .11) + pulse * .13;
    g.fillStyle = deep ? '#85b9c7' : '#b3dad3';
    waterMark(g, map, x, y, 6, 1, 'sea', masks);
    // Wind tears the swell into short bright caps, rather than endless stripes.
    if (deep && pulse > .91 && Math.sin(band * 1.7 + time * .23) > .28) {
      g.globalAlpha = .36 * (pulse - .9) * 10;
      g.fillStyle = '#d6ece5';
      waterMark(g, map, x, y - 1, 4, 1, 'sea', masks);
    }
  }
}

/** Water is painted before the pier, actors, vessels and props. Each surf pixel
 * checks its material: run-up can wet beach sand, never a quay or a temple. */
export function drawMarine(g: CanvasRenderingContext2D, map: GameMap, left: number, top: number, w: number, h: number, time: number, masks?: MarineBankMasks): void {
  g.save();
  swells(g, map, left, top, w, h, time, masks);
  const size = MARINE_CHUNK * TILE;
  const x0 = Math.max(0, Math.floor((left - 48) / size)), x1 = Math.min(Math.ceil(map.w / MARINE_CHUNK) - 1, Math.floor((left + w + 48) / size));
  const y0 = Math.max(0, Math.floor((top - 48) / size)), y1 = Math.min(Math.ceil(map.h / MARINE_CHUNK) - 1, Math.floor((top + h + 48) / size));
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    for (const s of shoreChunk(map, cx, cy)) {
      const length = Math.hypot(s.bx - s.ax, s.by - s.ay);
      for (let d = 0; d < length; d += 2.5) {
        const u = d / length, x = s.ax + (s.bx - s.ax) * u, y = s.ay + (s.by - s.ay) * u;
        if (x < left - 42 || x > left + w + 42 || y < top - 42 || y > top + h + 42) continue;
        const p = surfAt(time, x, y);
        // Damp sand is a shallow, translucent stain along every beach orientation.
        if (s.beach) {
          const wx = x - s.nx * 5, wy = y - s.ny * 5;
          if (beach(tileAt(map, wx, wy))) {
            g.fillStyle = '#678b81'; g.globalAlpha = .14 + p.wash * .1;
            waterMark(g, map, wx - 3, wy - 3, 6, 6, 'beach', masks);
          }
        }
        for (let crest = 0; crest < 2; crest++) {
          const offset = p.distance + (crest ? 13 : 0);
          const wiggle = Math.sin(x * .14 + y * .09 - time * 1.4) * 1.4;
          const wx = x + s.nx * (offset + wiggle), wy = y + s.ny * (offset + wiggle);
          const id = tileAt(map, wx, wy);
          if (!isMarine(id) && !(s.beach && beach(id) && offset < 2)) continue;
          g.fillStyle = '#e5f2df';
          g.globalAlpha = p.foam * (crest ? .3 : 1) * (.74 + .26 * Math.sin(x * .83 + y * .67) ** 2);
          waterMark(g, map, wx, wy, crest ? 2 : 3, 2, s.beach && offset < 2 ? 'surf' : 'sea', masks);
          if (!crest && p.wash > .15 && isMarine(id)) {
            g.globalAlpha *= .25;
            waterMark(g, map, wx + s.nx * 4, wy + s.ny * 4, 2, 2, 'sea', masks);
          }
        }
      }
    }
  }
  g.restore();
}
