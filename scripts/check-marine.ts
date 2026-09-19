/** Small deterministic fixtures exercise the actual relief and marine painters.
 * No browser, generated world, image buffers, server, or animation loop. */
import assert from 'node:assert/strict';
import { createMap, type GameMap } from '../src/game/world/map';
import { T, TILE, isWater, TILES } from '../src/game/world/tiles';
import { drawTerrainRelief } from '../src/game/core/terrainRelief';
import { drawMarineDepth, marineDepthMix } from '../src/game/core/marineDepth';
import {
  MARINE_CACHE_LIMIT, MARINE_CHUNK, buildShoreChunk, drawMarine, isMarine,
  marineCacheSize, shoreChunk, surfAt, swellY, type ShoreSegment,
} from '../src/game/core/marine';

function fixture(w: number, h: number, at: (x: number, y: number) => number): GameMap {
  const map = createMap({ id: 'marine-fixture', name: 'Marine fixture', w, h });
  map.kind = 'overworld'; map.outdoor = true;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) map.tiles[y * w + x] = at(x, y);
  return map;
}

interface Paint { x: number; y: number; w: number; h: number; color: unknown; alpha: number }
function recorder() {
  const paints: Paint[] = [], images: unknown[][] = [], gradients: number[][] = [];
  const state: Array<{ fillStyle: unknown; globalAlpha: number }> = [];
  const context = {
    fillStyle: undefined as unknown, globalAlpha: 1,
    save() { state.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha }); },
    restore() { Object.assign(this, state.pop()); },
    fillRect(x: number, y: number, w: number, h: number) { paints.push({ x, y, w, h, color: this.fillStyle, alpha: this.globalAlpha }); },
    drawImage(...args: unknown[]) { images.push(args); },
    createLinearGradient(...args: number[]) {
      gradients.push(args);
      return { addColorStop() {} };
    },
  };
  return { g: context as unknown as CanvasRenderingContext2D, paints, images, gradients };
}

// This reproduces the actual orientation of the reported defect, including the
// wall painter call; testing collision classification alone would miss it.
for (const water of [T.WATER, T.DEEP_WATER, T.AEGEAN_SHALLOWS, T.AEGEAN_SEA, T.STYGIAN, T.SWAMP_WATER, T.AEGEAN_SPRING, T.LERNA_POOL]) {
  const r = recorder();
  drawTerrainRelief(r.g, {} as CanvasImageSource, T.SAND, T.SAND, water, 32, 64, 0, TILE);
  assert.equal(r.gradients.length, 0, `Water ${water} north of land casts no raised-bank shadow`);
  assert.equal(r.paints.length, 0, `Water ${water} does not darken the lower beach`);
  drawTerrainRelief(r.g, {} as CanvasImageSource, water, T.SAND, T.VOID, 32, 32, 0, TILE);
  assert.equal(r.images.length, 0, `Water ${water} has no vertical wall face`);
}
for (const lower of [T.SAND, T.AEGEAN_SHALLOWS]) {
  const r = recorder();
  drawTerrainRelief(r.g, {} as CanvasImageSource, lower, lower, T.CLIFF, 32, 64, 0, TILE);
  assert.deepEqual(r.gradients, [[0, 64, 0, 74]], 'Cliff still casts its downward shadow');
  assert.deepEqual(r.paints.map(({ x, y, w, h }) => [x, y, w, h]), [[32, 64, TILE, 10]]);
  drawTerrainRelief(r.g, {} as CanvasImageSource, T.CLIFF, lower, T.CLIFF, 32, 32, 2, TILE);
  assert.equal(r.images.length, 1, 'Exposed cliff face remains visible above land or water');
  assert.deepEqual(r.images[0].slice(-4), [32, 50, TILE, 14]);
}

// Sample the wet material density independently of the contour builder. Its
// normal must lead toward water even around concave bays and diagonal cells.
function wetDensity(map: GameMap, wx: number, wy: number): number {
  const fx = wx / TILE - .5, fy = wy / TILE - .5;
  const x = Math.floor(fx), y = Math.floor(fy), u = fx - x, v = fy - y;
  let total = 0;
  for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
    const tx = x + ox, ty = y + oy;
    if (tx >= 0 && ty >= 0 && tx < map.w && ty < map.h && isMarine(map.tiles[ty * map.w + tx]))
      total += (ox ? u : 1 - u) * (oy ? v : 1 - v);
  }
  return total;
}
function assertNormals(map: GameMap, segments: ShoreSegment[], label: string): void {
  assert.ok(segments.length, `${label}: actual coastline exists`);
  for (const s of segments) {
    assert.ok([s.ax, s.ay, s.bx, s.by, s.nx, s.ny].every(Number.isFinite), `${label}: finite geometry`);
    assert.ok(Math.abs(Math.hypot(s.nx, s.ny) - 1) < 1e-9, `${label}: unit normal`);
    assert.ok(Math.hypot(s.bx - s.ax, s.by - s.ay) > 0, `${label}: nonzero segment`);
    assert.ok(Math.abs((s.bx - s.ax) * s.nx + (s.by - s.ay) * s.ny) < 1e-9, `${label}: normal perpendicular to shoreline`);
    const x = (s.ax + s.bx) / 2, y = (s.ay + s.by) / 2;
    assert.ok(wetDensity(map, x + s.nx * 4, y + s.ny * 4) > wetDensity(map, x - s.nx * 4, y - s.ny * 4), `${label}: normal points into local water`);
  }
}
for (const [name, wet, normal] of [
  ['east', (x: number, _y: number) => x >= 3, [1, 0]],
  ['west', (x: number, _y: number) => x < 3, [-1, 0]],
  ['south', (_x: number, y: number) => y >= 3, [0, 1]],
  ['north', (_x: number, y: number) => y < 3, [0, -1]],
] as const) {
  const map = fixture(6, 6, (x, y) => wet(x, y) ? T.AEGEAN_SHALLOWS : T.SAND);
  const shore = buildShoreChunk(map, 0, 0);
  assert.equal(shore.length, 5, `${name}: one continuous straight coast`);
  assertNormals(map, shore, name);
  for (const s of shore) {
    assert.ok(Math.abs(s.nx - normal[0]) < 1e-9 && Math.abs(s.ny - normal[1]) < 1e-9);
    assert.ok(s.beach, `${name}: sand coast allows run-up`);
  }
}
for (const [name, wet] of [
  ['convex headland', (x: number, y: number) => !(x >= 2 && x <= 4 && y >= 2 && y <= 4)],
  ['concave bay', (x: number, y: number) => x >= 2 && x <= 4 && y >= 2],
  ['one tile island', (x: number, y: number) => x !== 3 || y !== 3],
  ['diagonal checkerboard', (x: number, y: number) => (x + y) % 2 === 0],
  ['one tile channel', (x: number, _y: number) => x === 3],
] as const) {
  const map = fixture(7, 7, (x, y) => wet(x, y) ? T.AEGEAN_SEA : T.SAND);
  const shore = buildShoreChunk(map, 0, 0);
  assertNormals(map, shore, name);
  if (name === 'one tile island') assert.equal(shore.length, 4, 'Small island gets a closed four-sided shore');
  if (name === 'diagonal checkerboard') assert.equal(shore.length, 72, 'Both boundaries survive each ambiguous diagonal cell');
}
for (const inland of [T.STYGIAN, T.SWAMP_WATER, T.WATER, T.DEEP_WATER, T.AEGEAN_SPRING, T.LERNA_POOL]) {
  const map = fixture(6, 6, x => x >= 3 ? inland : T.SAND);
  assert.equal(buildShoreChunk(map, 0, 0).length, 0, `Inland liquid ${inland} has no ocean breakers`);
  const mouth = fixture(6, 6, x => x >= 3 ? T.AEGEAN_SEA : inland);
  assert.equal(buildShoreChunk(mouth, 0, 0).length, 0, `Marine/river join ${inland} is not a dry beach`);
}
for (const [material, runup] of [
  [T.SHELL_BEACH, true], [T.BLACK_BEACH, true], [T.PUMICE, true],
  [T.LIMESTONE, false], [T.LIMESTONE_CRAG, false], [T.OBSIDIAN, false], [T.OBSIDIAN_CRAG, false],
] as const) {
  const map = fixture(6, 6, x => x >= 3 ? T.AEGEAN_SHALLOWS : material);
  const shore = buildShoreChunk(map, 0, 0);
  assertNormals(map, shore, TILES[material].name);
  assert.ok(shore.every(s => s.beach === runup), `${TILES[material].name}: correct sand/shingle versus rocky surf`);
}

// Cache ownership and eviction are tested by returned geometry, not internals.
const cached = fixture((MARINE_CACHE_LIMIT + 3) * MARINE_CHUNK, 6, (_x, y) => y >= 3 ? T.AEGEAN_SEA : T.SAND);
const original = shoreChunk(cached, 0, 0);
assert.strictEqual(shoreChunk(cached, 0, 0), original, 'Unchanged chunk reuses geometry');
for (let x = 1; x <= MARINE_CACHE_LIMIT; x++) shoreChunk(cached, x, 0);
assert.equal(marineCacheSize(cached), MARINE_CACHE_LIMIT, 'Cache remains bounded to 48 chunks');
assert.notStrictEqual(shoreChunk(cached, 0, 0), original, 'Oldest chunk is evicted');
const fresh = fixture(6, 6, () => T.AEGEAN_SEA);
assert.equal(shoreChunk(fresh, 0, 0).length, 0, 'A different map with the same id cannot inherit shores');
cached.tiles.fill(T.AEGEAN_SEA); cached.revision = 'new-coast';
assert.equal(shoreChunk(cached, 0, 0).length, 0, 'New revision discards former coastline');
assert.equal(marineCacheSize(cached), 1, 'Revision drops obsolete cached chunks');

const approach = surfAt(.5, 0, 0), breaking = surfAt(3.8, 0, 0);
const runup = surfAt(5.4, 0, 0), retreat = surfAt(6.9, 0, 0);
assert.ok(approach.distance > breaking.distance && breaking.distance > 0, 'Crest approaches shore from sea');
assert.ok(breaking.foam > approach.foam, 'Crest brightens as it breaks');
assert.ok(runup.distance < 0 && runup.wash > .9, 'Broken wave runs up the beach');
assert.ok(retreat.distance > runup.distance && retreat.wash < runup.wash && retreat.foam < runup.foam, 'Retreat withdraws and thins');
for (let t = -8; t <= 24; t += .1) {
  const p = surfAt(t, 1735, 287);
  assert.ok(Object.values(p).every(Number.isFinite));
  assert.ok(p.wash >= 0 && p.wash <= 1 && p.foam >= 0 && p.foam <= 1);
}
const cycleA = surfAt(1, 150, 230), cycleB = surfAt(8.2, 150, 230);
for (const key of ['distance', 'foam', 'wash'] as const) assert.ok(Math.abs(cycleA[key] - cycleB[key]) < 1e-9, 'Wave cycle repeats without drift');
assert.notEqual(swellY(400, 3, 1), swellY(400, 3, 2), 'Open-sea wave travels over time');
for (const seam of [TILE, MARINE_CHUNK * TILE, 2 * MARINE_CHUNK * TILE])
  assert.ok(Math.abs(swellY(seam - .01, 3, 2) - swellY(seam + .01, 3, 2)) < .1, 'Swell remains continuous across tile/chunk seams');

// Record the real draw calls. Every painted pixel must respect quays and river
// mouths; checking only each rectangle's anchor misses visible edge spill.
function assertPaintMaterials(map: GameMap, paints: Paint[]): void {
  for (const p of paints) {
    assert.ok([p.x, p.y, p.w, p.h, p.alpha].every(Number.isFinite), 'No invalid canvas coordinates or alpha');
    for (let y = Math.floor(p.y); y < p.y + p.h; y++) for (let x = Math.floor(p.x); x < p.x + p.w; x++) {
      if (x < 0 || y < 0 || x >= map.w * TILE || y >= map.h * TILE) continue;
      const id = map.tiles[Math.floor(y / TILE) * map.w + Math.floor(x / TILE)];
      const sand = !TILES[id].solid && !isWater(id)
        && (TILES[id].shore === 'sand' || TILES[id].shore === 'shingle' || TILES[id].step === 'sand');
      const wash = p.color === '#678b81' || p.color === '#e5f2df';
      assert.ok(isMarine(id) || (wash && sand), `Marine paint ${p.color} spills onto ${TILES[id].name} at ${x},${y}`);
    }
  }
}
for (const dry of [T.FLOOR_WOOD, T.MARBLE, T.BRIDGE, T.WATER, T.STYGIAN, T.AEGEAN_SPRING, T.LERNA_POOL, T.LIMESTONE, T.OBSIDIAN]) {
  const map = fixture(10, 10, (x, y) => {
    if (x < 4) return T.SAND;
    if (x < 7 && y >= 4 && y <= 5) return dry;
    return T.AEGEAN_SHALLOWS;
  });
  for (const t of [0, 1.5, 3.5, 5.1, 6.8]) {
    const r = recorder();
    drawMarine(r.g, map, 0, 0, map.w * TILE, map.h * TILE, t);
    assert.ok(r.paints.length, 'Sea and beach actually animate in the mixed fixture');
    assertPaintMaterials(map, r.paints);
    assert.equal(r.g.globalAlpha, 1, 'Marine painter restores caller alpha');
  }
}
for (const material of [T.SHELL_BEACH, T.BLACK_BEACH, T.PUMICE]) {
  const map = fixture(8, 8, x => x >= 4 ? T.AEGEAN_SHALLOWS : material), r = recorder();
  drawMarine(r.g, map, 0, 0, 256, 256, 5);
  assertPaintMaterials(map, r.paints);
  assert.ok(r.paints.some(p => p.color === '#678b81' && p.x < 4 * TILE), `${TILES[material].name} visibly receives wet-beach wash`);
}
for (const id of [T.WATER, T.DEEP_WATER, T.STYGIAN, T.SWAMP_WATER, T.AEGEAN_SPRING, T.LERNA_POOL]) {
  const map = fixture(8, 8, () => id), r = recorder();
  drawMarine(r.g, map, 0, 0, 256, 256, 2);
  assert.equal(r.paints.length, 0, `${TILES[id].name} never receives sea waves`);
}
const openSea = fixture(24, 24, () => T.AEGEAN_SEA);
const firstView = recorder(), shiftedView = recorder(), laterView = recorder();
drawMarine(firstView.g, openSea, 0, 0, 512, 512, 2);
drawMarine(shiftedView.g, openSea, 128, 128, 512, 512, 2);
drawMarine(laterView.g, openSea, 0, 0, 512, 512, 3);
const overlap = (paints: Paint[]) => paints.filter(p => p.x > 150 && p.x < 480 && p.y > 150 && p.y < 480);
assert.ok(overlap(firstView.paints).length > 0, 'Open sea has visible moving wave bands');
assert.deepEqual(overlap(firstView.paints), overlap(shiftedView.paints), 'Camera movement does not reset or slide the world-anchored waves');
assert.notDeepEqual(firstView.paints, laterView.paints, 'Actual sea pixels change with time');

// The tile mask is already composited into the terrain's water tile. Verify
// exact alpha-pixel occlusion in all eight directions, including unmasked gaps.
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
function pixelSet(paints: Paint[]): Set<string> {
  const pixels = new Set<string>();
  for (const p of paints) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++)
    pixels.add(`${x},${y},${String(p.color)},${p.alpha}`);
  return pixels;
}
for (const [n, [ox, oy]] of directions.entries()) {
  const map = fixture(9, 9, (x, y) => x === 4 && y === 4 ? T.MARBLE : T.AEGEAN_SEA);
  const masks = directions.map(() => new Uint8ClampedArray(TILE * TILE * 4));
  // Bright RGB with transparent alpha must not cover anything.
  for (const mask of masks) for (let i = 0; i < mask.length; i += 4) mask[i] = mask[i + 1] = mask[i + 2] = 255;
  const unmasked = recorder(), transparent = recorder();
  drawMarine(unmasked.g, map, 0, 0, 288, 288, 2);
  drawMarine(transparent.g, map, 0, 0, 288, 288, 2, masks);
  assert.deepEqual(transparent.paints, unmasked.paints, 'RGBA alpha alone determines hard-bank coverage');
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++)
    masks[n][(y * TILE + x) * 4 + 3] = (x + 2 * y) % 3 ? 255 : 0;
  const waterX = 4 - ox, waterY = 4 - oy;
  let removed = 0;
  for (let time = 0; time < 8; time++) {
    const before = recorder(), after = recorder();
    drawMarine(before.g, map, 0, 0, 288, 288, time);
    drawMarine(after.g, map, 0, 0, 288, 288, time, masks);
    const expected = pixelSet(before.paints);
    for (const key of expected) {
      const [x, y] = key.split(',').map(Number);
      if (Math.floor(x / TILE) === waterX && Math.floor(y / TILE) === waterY
        && masks[n][(((y % TILE) * TILE + x % TILE) * 4) + 3]) {
        expected.delete(key); removed++;
      }
    }
    assert.deepEqual(pixelSet(after.paints), expected, `Bank mask direction ${n} clips exact covered pixels and retains its dithered gaps`);
  }
  assert.ok(removed > 0, `Direction ${n} fixture actually intersects a moving wave`);
}
const beachMap = fixture(9, 9, (x, y) => x === 4 && y === 4 ? T.SHELL_BEACH : T.AEGEAN_SHALLOWS);
const solidMasks = directions.map(() => new Uint8ClampedArray(TILE * TILE * 4).fill(255));
const beachPlain = recorder(), beachMasked = recorder();
drawMarine(beachPlain.g, beachMap, 0, 0, 288, 288, 5);
drawMarine(beachMasked.g, beachMap, 0, 0, 288, 288, 5, solidMasks);
assert.deepEqual(beachMasked.paints, beachPlain.paints, 'Beach mask pixels remain available for run-up and wash');

// Marine depth remains gameplay data; the static painter alone blends the
// existing textures over a continuous three-tile shelf.
for (const [id, depth] of [[T.AEGEAN_SHALLOWS, 0], [T.AEGEAN_SEA, 1]] as const) {
  const map = fixture(12, 8, () => id), r = recorder();
  assert.equal(marineDepthMix(map, 160, 112), depth, 'Uniform marine depth keeps its authored color');
  drawMarineDepth(r.g, {} as CanvasImageSource, map, 5, 3, 2, 160, 96, TILE);
  assert.equal(r.images.length, 1, 'Uniform sea needs only the original single texture draw');
  assert.equal(r.images[0][2], id * TILE, 'Uniform sea uses its correct texture row');
}
const shelf = fixture(32, 8, x => x >= 16 ? T.AEGEAN_SEA : T.AEGEAN_SHALLOWS);
const shelfTiles = shelf.tiles.slice();
assert.equal(marineDepthMix(shelf, 14 * TILE + 16, 112), 0, 'Pure shallow color survives outside the shelf transition');
assert.equal(marineDepthMix(shelf, 17 * TILE + 16, 112), 1, 'Pure deep color survives outside the shelf transition');
let previous = 0;
for (let x = 13 * TILE; x <= 19 * TILE; x++) {
  const mix = marineDepthMix(shelf, x, 112);
  assert.ok(Number.isFinite(mix) && mix >= previous - 1e-12 && mix >= 0 && mix <= 1, 'Shelf depth blends monotonically without overshoot');
  previous = mix;
}
for (const seam of [15 * TILE, 16 * TILE, 17 * TILE])
  assert.ok(Math.abs(marineDepthMix(shelf, seam - .001, 112) - marineDepthMix(shelf, seam + .001, 112)) < .0001, 'Depth color is continuous across tile and 16-tile chunk edges');
const shelfDraw = recorder(); shelfDraw.g.globalAlpha = .7;
drawMarineDepth(shelfDraw.g, {} as CanvasImageSource, shelf, 16, 3, 1, 0, 0, TILE);
assert.ok(shelfDraw.images.length > 1, 'Mixed shelf actually composites both existing water textures');
assert.equal(shelfDraw.g.globalAlpha, .7, 'Static depth painter restores caller alpha');
assert.deepEqual(shelf.tiles, shelfTiles, 'Depth appearance never changes tile IDs or sailing collision');
for (const liquid of [T.WATER, T.DEEP_WATER, T.AEGEAN_SPRING, T.LERNA_POOL, T.STYGIAN]) {
  const map = fixture(8, 8, x => x < 4 ? T.AEGEAN_SHALLOWS : liquid), r = recorder();
  assert.equal(marineDepthMix(map, 3 * TILE + 16, 112), 0, 'Inland water does not tint the marine shelf');
  drawMarineDepth(r.g, {} as CanvasImageSource, map, 4, 3, 0, 0, 0, TILE);
  assert.equal(r.images.length, 0, 'Marine depth painter leaves inland water to its own terrain renderer');
}
console.log('Marine relief, coast geometry, surf cycles, swell continuity, cache isolation and actual paint clipping passed.');
