import type { GameMap } from '../world/map';
import { T, TILE } from '../world/tiles';
import { isMarine } from './marine';

const depthId = (map: GameMap, tx: number, ty: number): number =>
  tx < 0 || ty < 0 || tx >= map.w || ty >= map.h ? T.VOID : map.tiles[ty * map.w + tx];

/** Blur only the two marine depths. Land, rivers and the Styx contribute no
 * color, keeping a turquoise shelf from gaining a dark artificial shoreline. */
function centerDepth(map: GameMap, tx: number, ty: number): number {
  let deep = 0, total = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const id = depthId(map, tx + ox, ty + oy);
    if (!isMarine(id)) continue;
    const weight = (ox === 0 ? 2 : 1) * (oy === 0 ? 2 : 1);
    total += weight;
    if (id === T.AEGEAN_SEA) deep += weight;
  }
  return total ? deep / total : 0;
}

const interpolate = (a: number, b: number, c: number, d: number, u: number, v: number): number =>
  (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;

/** Deep-water fraction at a world pixel. The three-tile transition is anchored
 * to world tile centers, so adjacent terrain chunks share exactly one field. */
export function marineDepthMix(map: GameMap, worldX: number, worldY: number): number {
  if (!isMarine(depthId(map, Math.floor(worldX / TILE), Math.floor(worldY / TILE)))) return 0;
  const fx = worldX / TILE - .5, fy = worldY / TILE - .5;
  const tx = Math.floor(fx), ty = Math.floor(fy);
  return interpolate(
    centerDepth(map, tx, ty), centerDepth(map, tx + 1, ty),
    centerDepth(map, tx, ty + 1), centerDepth(map, tx + 1, ty + 1),
    fx - tx, fy - ty,
  );
}

/** Static cached terrain only: reuse the authored water textures, feathering
 * their color in small pixel blocks rather than drawing a hard depth border.
 * No map mutations, per-frame buffers, gradients, or additional canvases. */
export function drawMarineDepth(
  g: CanvasRenderingContext2D, sheet: CanvasImageSource, map: GameMap,
  tx: number, ty: number, variant: number, dx: number, dy: number, tile = TILE,
): void {
  const id = depthId(map, tx, ty);
  if (!isMarine(id)) return;
  let mixed = false;
  for (let oy = -2; oy <= 2 && !mixed; oy++) for (let ox = -2; ox <= 2; ox++) {
    const neighbor = depthId(map, tx + ox, ty + oy);
    if (isMarine(neighbor) && neighbor !== id) { mixed = true; break; }
  }
  if (!mixed) {
    g.drawImage(sheet, variant * tile, id * tile, tile, tile, dx, dy, tile, tile);
    return;
  }

  // The nine samples cover both bilinear cells inside this tile. Compute them
  // once, rather than rereading the map for every small texture block.
  const weights = [
    centerDepth(map, tx - 1, ty - 1), centerDepth(map, tx, ty - 1), centerDepth(map, tx + 1, ty - 1),
    centerDepth(map, tx - 1, ty), centerDepth(map, tx, ty), centerDepth(map, tx + 1, ty),
    centerDepth(map, tx - 1, ty + 1), centerDepth(map, tx, ty + 1), centerDepth(map, tx + 1, ty + 1),
  ];
  g.drawImage(sheet, variant * tile, T.AEGEAN_SHALLOWS * tile, tile, tile, dx, dy, tile, tile);
  const alpha = g.globalAlpha;
  const block = 4;
  for (let py = 0; py < tile; py += block) for (let px = 0; px < tile; px += block) {
    const w = Math.min(block, tile - px), h = Math.min(block, tile - py);
    const fx = (px + w / 2) / tile + .5, fy = (py + h / 2) / tile + .5;
    const x = Math.floor(fx), y = Math.floor(fy), i = y * 3 + x;
    const mix = interpolate(weights[i], weights[i + 1], weights[i + 3], weights[i + 4], fx - x, fy - y);
    if (mix <= 0) continue;
    g.globalAlpha = alpha * mix;
    g.drawImage(sheet, variant * tile + px, T.AEGEAN_SEA * tile + py, w, h, dx + px, dy + py, w, h);
  }
  g.globalAlpha = alpha;
}
