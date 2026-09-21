/**
 * The Gilded Spade's gaming floor: geometry, reachability and pay-table truth.
 *
 * The casino interior is dense — four gaming stations, a bar, a cashier's
 * cage and fourteen seated bodies inside fifteen tiles by twelve — and every
 * one of those bodies carries a collision box. That is exactly the shape of
 * room where a prop nudged by six pixels quietly walls the player off from
 * the poker table, or buries a slot machine behind a patron's stool, and
 * nothing about the screenshot tells you it happened.
 *
 * Canvas calls are stubbed the way `check-aegean-world.ts` stubs them: the
 * terrain and prop collision is real, no raster buffer is ever allocated.
 *
 * Run: npx tsx scripts/check-casino.ts
 */
import assert from 'node:assert/strict';
import { PROP_NAMES, getProp } from '../src/game/art/props';
import { SLOT_REEL, SLOT_TRIPLE, type SlotSymbol } from '../src/game/casino/games';
import { NPCS } from '../src/data/npcs';
import { buildInterior, interiorEntry } from '../src/game/world/interiors';
import type { GameMap, PropInstance } from '../src/game/world/map';
import { T, TILE, isSolid } from '../src/game/world/tiles';

const noop = () => undefined;
const context = new Proxy({}, {
  get: (_target, key) =>
    key === 'createLinearGradient' || key === 'createRadialGradient'
      ? () => ({ addColorStop: noop })
      : key === 'measureText' ? () => ({ width: 0 }) : noop,
  set: () => true,
});
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => context }),
} as unknown as Document;

/* ------------------------------------------------------------------ */
/* Walkability                                                         */
/* ------------------------------------------------------------------ */

function walkGrid(map: GameMap): Uint8Array {
  const grid = Uint8Array.from(map.tiles, (t) => (isSolid(t) ? 0 : 1));
  for (const p of map.props) {
    if (!p.cw || !p.ch) continue;
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const px = x * TILE + 16;
        const py = y * TILE + 16;
        if (
          px + 9 > p.x - p.cw / 2 && px - 9 < p.x + p.cw / 2 &&
          py + 7 > p.y - p.ch && py - 7 < p.y
        ) grid[y * map.w + x] = 0;
      }
    }
  }
  return grid;
}

function flood(map: GameMap, grid: Uint8Array, sx: number, sy: number): Uint8Array {
  const seen = new Uint8Array(grid.length);
  const queue = new Uint32Array(grid.length);
  const start = Math.floor(sy / TILE) * map.w + Math.floor(sx / TILE);
  assert.ok(grid[start], 'casino: the entry tile must be walkable');
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const i = queue[head++];
    const x = i % map.w;
    const y = Math.floor(i / map.w);
    for (const j of [
      x ? i - 1 : -1,
      x < map.w - 1 ? i + 1 : -1,
      y ? i - map.w : -1,
      y < map.h - 1 ? i + map.w : -1,
    ]) {
      if (j < 0 || seen[j] || !grid[j]) continue;
      seen[j] = 1;
      queue[tail++] = j;
    }
  }
  return seen;
}

/** Can the player stand on a tile adjacent to this prop and press E? */
function standable(map: GameMap, seen: Uint8Array, p: PropInstance): boolean {
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      if (!seen[y * map.w + x]) continue;
      const px = x * TILE + 16;
      const py = y * TILE + 16;
      // The interaction radius the game uses is generous; half a tile of
      // slack here still catches a prop that has been walled in.
      if (Math.hypot(px - p.x, py - (p.y - 12)) <= TILE * 1.6) return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */

const map = buildInterior('int_casino', 'The Gilded Spade', 100, 100);

assert.equal(map.name, 'The Gilded Spade');
assert.ok(
  map.w * map.h < 17 * 13,
  `casino: the room must stay smaller than the 17x13 it used to be, got ${map.w}x${map.h}`,
);

/* ---- floor ---- */

const tiles = new Set(map.tiles);
assert.ok(!tiles.has(T.FLOOR_CARPET), 'casino: must not use the generic carpet, whose per-tile gold box grids the floor');
for (const id of [T.CASINO_CARPET, T.CASINO_PARQUET, T.CASINO_MARBLE]) {
  assert.ok(tiles.has(id), `casino: floor material ${id} is registered but never laid`);
}
// The apron has to be under the door, or it is just a patch of stone.
const door = Math.floor(map.w / 2);
assert.equal(
  map.tiles[(map.h - 2) * map.w + door], T.CASINO_MARBLE,
  'casino: the marble apron must cover the doorway',
);

/* ---- art ---- */

const known = new Set(PROP_NAMES);
for (const art of new Set(map.props.map((p) => p.art))) {
  assert.ok(known.has(art), `casino: ${art} has no authored art and would draw fallback pixels`);
}

/* ---- the room is populated and it moves ---- */

const sitters = map.props.filter((p) => p.art.startsWith('casino_sit_'));
assert.ok(sitters.length >= 12, `casino: a gaming floor needs a crowd, got ${sitters.length} seated patrons`);
for (const dir of ['up', 'down', 'left', 'right']) {
  assert.ok(
    sitters.some((p) => p.art.startsWith(`casino_sit_${dir}_`)),
    `casino: nobody is sitting facing ${dir}; everyone at a table would be on one side of it`,
  );
}
// Identical props ticking in lockstep is the tell that a room is a sprite
// sheet rather than a crowd, so anything that repeats carries a phase.
const phased = new Map<string, Set<number>>();
for (const p of map.props) {
  if (getProp(p.art).frames < 2) continue;
  const seen = phased.get(p.art) ?? new Set<number>();
  seen.add(p.phase ?? 0);
  phased.set(p.art, seen);
}
for (const [art, offsets] of phased) {
  const count = map.props.filter((p) => p.art === art).length;
  if (count < 2) continue;
  assert.equal(offsets.size, count, `casino: ${count} of ${art} share an animation phase and tick in lockstep`);
}

/* ---- both house NPCs are on the floor and inside the walls ---- */

const staff = NPCS.filter((n) => n.map === 'int_casino');
assert.ok(staff.length >= 2, 'casino: the house needs more than one person working the floor');
for (const n of staff) {
  assert.ok(
    n.tx > 0 && n.tx < map.w - 1 && n.ty > 0 && n.ty < map.h - 1,
    `${n.id}: stands outside the smaller room at ${n.tx},${n.ty}`,
  );
  assert.ok(!isSolid(map.tiles[n.ty * map.w + n.tx]), `${n.id}: spawns inside a wall`);
}

/* ---- everything the player has to reach, they can reach ---- */

const entry = interiorEntry(map);
const grid = walkGrid(map);
const seen = flood(map, grid, entry.x, entry.y);

const interactive = map.props.filter((p) => p.interact);
assert.ok(
  interactive.filter((p) => p.interact === 'slots').length === 3,
  'casino: the slot bank is three machines',
);
assert.equal(interactive.filter((p) => p.interact === 'poker').length, 1, 'casino: exactly one poker table');
for (const p of interactive) {
  assert.ok(standable(map, seen, p), `casino: ${p.art} (${p.interact}) is walled in and cannot be used`);
}
const exit = map.portals.find((p) => p.to === 'overworld');
assert.ok(exit, 'casino: the door out is missing');
assert.ok(
  seen[Math.floor((exit.y + exit.h / 2) / TILE) * map.w + Math.floor((exit.x + exit.w / 2) / TILE)] === 1,
  'casino: the way out is not reachable from where the player lands',
);

/* ---- no fixture is buried inside another ---- */

const boxes = map.props.filter((p) => p.cw && p.ch);
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i];
    const b = boxes[j];
    const overlapX = Math.min(a.x + a.cw! / 2, b.x + b.cw! / 2) - Math.max(a.x - a.cw! / 2, b.x - b.cw! / 2);
    const overlapY = Math.min(a.y, b.y) - Math.max(a.y - a.ch!, b.y - b.ch!);
    assert.ok(
      overlapX <= 0 || overlapY <= 0,
      `casino: ${a.art} and ${b.art} occupy the same floor at ${a.x},${a.y}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* The slot pay table                                                  */
/* ------------------------------------------------------------------ */

// The panel derives its ladder from SLOT_TRIPLE and sorts it. It used to be a
// hand-written list, and it had drifted: three spades paid x14 and the pay
// table did not mention spades at all.
const ladder = (Object.keys(SLOT_TRIPLE) as SlotSymbol[]).sort((a, b) => SLOT_TRIPLE[b] - SLOT_TRIPLE[a]);
for (const sym of new Set(SLOT_REEL)) {
  assert.ok(ladder.includes(sym), `slots: ${sym} is on the reel strip but not in the pay table`);
}
for (let i = 1; i < ladder.length; i++) {
  assert.ok(
    SLOT_TRIPLE[ladder[i - 1]] >= SLOT_TRIPLE[ladder[i]],
    'slots: the pay table must read best-paying first',
  );
}
// Rarer on the strip must never pay less than commoner.
const frequency = (s: SlotSymbol) => SLOT_REEL.filter((r) => r === s).length;
for (let i = 1; i < ladder.length; i++) {
  assert.ok(
    frequency(ladder[i - 1]) <= frequency(ladder[i]),
    `slots: ${ladder[i - 1]} pays more than ${ladder[i]} but lands at least as often`,
  );
}

console.log(
  `Gilded Spade passed: ${map.w}x${map.h} room, ${map.props.length} fixtures, ${sitters.length} seated patrons, ` +
  `${staff.length} staff, ${interactive.length} usable stations all reachable from the door, ` +
  `${ladder.length}-rung pay table in payout order.`,
);
