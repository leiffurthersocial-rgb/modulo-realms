import { RNG } from '../core/rng';
import type { DungeonSpec, LocationDef } from '../../data/locations';
import { T, TILE } from './tiles';
import { buildPropGrid, createMap, fillRect, getTile, setTile, type GameMap, type PropInstance } from './map';
import { generateAegeanDungeon } from './aegeanDungeons';

interface Theme {
  floor: number;
  wall: number;
  accent: number;
  props: string[];
  torch: string;
  torchColor: string;
  darkness: number;
  music: 'dungeon' | 'boss';
}

const THEMES: Record<DungeonSpec['theme'], Theme> = {
  fortress: { floor: T.DUNGEON_FLOOR, wall: T.DUNGEON_WALL, accent: T.BLOOD_FLOOR, props: ['crate', 'barrel', 'weapon_rack', 'rubble', 'dungeon_pillar', 'bone_pile'], torch: 'torch', torchColor: '#e8763a', darkness: 0.78, music: 'dungeon' },
  crypt: { floor: T.CRYPT_FLOOR, wall: T.CRYPT_WALL, accent: T.BLOOD_FLOOR, props: ['coffin', 'gravestone', 'bone_pile', 'dungeon_pillar', 'rubble', 'skull_none'], torch: 'brazier', torchColor: '#9578e8', darkness: 0.85, music: 'dungeon' },
  grove: { floor: T.TEMPLE_FLOOR, wall: T.TEMPLE_WALL, accent: T.RUNE_FLOOR, props: ['bush', 'mushroom_cluster', 'fern', 'pillar_broken', 'stump', 'tree_magic'], torch: 'crystal', torchColor: '#8fbf4a', darkness: 0.62, music: 'dungeon' },
  tomb: { floor: T.SAND_FLOOR, wall: T.SAND_WALL, accent: T.RUNE_FLOOR, props: ['coffin', 'pillar', 'rubble', 'bone_pile', 'crate', 'statue'], torch: 'brazier', torchColor: '#f6bf5d', darkness: 0.8, music: 'dungeon' },
  spire: { floor: T.TOWER_FLOOR, wall: T.TOWER_WALL, accent: T.RUNE_FLOOR, props: ['bookshelf', 'crystal', 'obelisk', 'dungeon_pillar', 'alchemy_table', 'rubble'], torch: 'crystal', torchColor: '#9578e8', darkness: 0.82, music: 'dungeon' },
  mine: { floor: T.CAVE_FLOOR, wall: T.CAVE_WALL, accent: T.GRAVEL, props: ['ore_vein', 'stalagmite', 'crate', 'rubble', 'rock_big', 'mushroom_cluster'], torch: 'torch', torchColor: '#e8763a', darkness: 0.88, music: 'dungeon' },
  // The glacier interiors. ICE_FLOOR/ICE_WALL already existed in the tileset
  // and had never been used by anything — adding a theme is one line here.
  glacier: { floor: T.ICE_FLOOR, wall: T.ICE_WALL, accent: T.RUNE_FLOOR, props: ['crystal', 'stalagmite', 'rubble', 'rock_big', 'obelisk', 'bone_pile'], torch: 'crystal', torchColor: '#6fd0e8', darkness: 0.7, music: 'dungeon' },
  barrow: { floor: T.CRYPT_FLOOR, wall: T.ICE_WALL, accent: T.RUNE_FLOOR, props: ['coffin', 'gravestone', 'bone_pile', 'dungeon_pillar', 'obelisk', 'skull_none'], torch: 'brazier', torchColor: '#6fd0e8', darkness: 0.84, music: 'dungeon' },
};

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'entry' | 'normal' | 'treasure' | 'boss' | 'miniboss';
}

const roomCenter = (r: Room) => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) });

const prop = (map: GameMap, tx: number, ty: number, art: string, o: Partial<PropInstance> = {}) => {
  map.props.push({ art, x: tx * TILE + TILE / 2, y: ty * TILE + TILE, ...o });
};

function carveCorridor(map: GameMap, floor: number, ax: number, ay: number, bx: number, by: number, rng: RNG) {
  const horizontalFirst = rng.bool();
  const w = 2;
  const carve = (x: number, y: number) => {
    for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) setTile(map, x + dx, y + dy, floor);
  };
  if (horizontalFirst) {
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) carve(x, ay);
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) carve(bx, y);
  } else {
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) carve(ax, y);
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) carve(x, by);
  }
}

export function generateDungeon(loc: LocationDef, seed: number): GameMap {
  if (loc.dungeon?.encounter?.startsWith('aegean_')) return generateAegeanDungeon(loc, seed);
  const spec = loc.dungeon!;
  const theme = THEMES[spec.theme];
  const rng = new RNG(`${seed}:${spec.mapId}`);
  const size = Math.min(84, 42 + spec.rooms * 3);

  const map = createMap({
    id: spec.mapId,
    name: spec.name,
    kind: spec.theme === 'mine' ? 'cave' : 'dungeon',
    w: size,
    h: size,
    music: theme.music,
    outdoor: false,
    darkness: theme.darkness,
    bossId: spec.boss,
    parent: loc.id,
  });
  map.tiles.fill(theme.wall);

  // --- rooms ---
  const rooms: Room[] = [];
  const tries = spec.rooms * 26;
  for (let i = 0; i < tries && rooms.length < spec.rooms; i++) {
    const w = rng.int(7, 14);
    const h = rng.int(6, 12);
    const x = rng.int(2, size - w - 3);
    const y = rng.int(2, size - h - 3);
    const pad = 2;
    if (rooms.some((r) => x < r.x + r.w + pad && x + w + pad > r.x && y < r.y + r.h + pad && y + h + pad > r.y)) continue;
    rooms.push({ x, y, w, h, kind: 'normal' });
  }
  if (rooms.length < 3) {
    rooms.push({ x: 4, y: 4, w: 10, h: 8, kind: 'normal' });
    rooms.push({ x: size - 16, y: size - 14, w: 11, h: 9, kind: 'normal' });
  }

  rooms[0].kind = 'entry';
  // boss room is the one furthest from the entrance, and gets enlarged
  const entry = roomCenter(rooms[0]);
  let farIdx = 1;
  let farD = -1;
  rooms.forEach((r, i) => {
    if (i === 0) return;
    const c = roomCenter(r);
    const d = Math.hypot(c.x - entry.x, c.y - entry.y);
    if (d > farD) { farD = d; farIdx = i; }
  });
  if (spec.boss || spec.miniboss) {
    const r = rooms[farIdx];
    r.kind = spec.boss ? 'boss' : 'miniboss';
    r.x = Math.max(2, r.x - 3);
    r.y = Math.max(2, r.y - 3);
    r.w = Math.min(size - r.x - 3, r.w + 6);
    r.h = Math.min(size - r.y - 3, r.h + 6);
  }
  const treasureCount = Math.max(1, Math.floor(rooms.length / 5));
  for (let i = 0; i < treasureCount; i++) {
    const cand = rooms.filter((r) => r.kind === 'normal');
    if (cand.length) rng.pick(cand).kind = 'treasure';
  }

  for (const r of rooms) fillRect(map, r.x, r.y, r.w, r.h, theme.floor);

  // --- corridors: connect each room to the previous nearest one ---
  const connected = [rooms[0]];
  for (const r of rooms.slice(1)) {
    let best = connected[0];
    let bestD = Infinity;
    const c = roomCenter(r);
    for (const o of connected) {
      const oc = roomCenter(o);
      const d = Math.hypot(oc.x - c.x, oc.y - c.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    const bc = roomCenter(best);
    carveCorridor(map, theme.floor, c.x, c.y, bc.x, bc.y, rng);
    connected.push(r);
  }
  // a couple of loops so the layout is not a pure tree
  for (let i = 0; i < Math.max(1, Math.floor(rooms.length / 4)); i++) {
    const a = roomCenter(rng.pick(rooms));
    const b = roomCenter(rng.pick(rooms));
    carveCorridor(map, theme.floor, a.x, a.y, b.x, b.y, rng);
  }

  // --- dressing ---
  let chestN = 0;
  let spawnN = 0;
  rooms.forEach((r, idx) => {
    const c = roomCenter(r);
    // wall torches
    for (let i = 0; i < 4; i++) {
      const tx = r.x + 1 + rng.int(0, r.w - 3);
      const ty = r.y;
      if (getTile(map, tx, ty) === theme.floor) {
        prop(map, tx, ty, theme.torch, { light: 190, lightColor: theme.torchColor, cw: 6, ch: 4, phase: rng.range(0, 6) });
      }
    }
    if (r.kind === 'entry') {
      prop(map, c.x, c.y, 'stairs_up', { flat: true, interact: 'exit_dungeon', label: `Leave ${spec.name}` });
      map.portals.push({
        x: c.x * TILE - 20, y: c.y * TILE - 16, w: 40, h: 40,
        to: 'overworld', tx: loc.tx * TILE + TILE / 2, ty: (loc.ty + 4) * TILE,
        label: `Leave ${spec.name}`, kind: 'stairs',
      });
      return;
    }

    // scenery
    const count = rng.int(3, 7);
    for (let i = 0; i < count; i++) {
      const tx = r.x + rng.int(1, r.w - 2);
      const ty = r.y + rng.int(1, r.h - 2);
      const art = rng.pick(theme.props);
      if (art === 'skull_none') continue;
      prop(map, tx, ty, art, { cw: 18, ch: 10, phase: rng.range(0, 6) });
    }
    // traps
    if (rng.bool(0.45)) {
      const tx = r.x + rng.int(1, r.w - 2);
      const ty = r.y + rng.int(1, r.h - 2);
      prop(map, tx, ty, 'trap_spikes', { flat: true, data: { trap: true, damage: 6 + spec.level * 2.2 }, phase: rng.range(0, 6) });
    }

    if (r.kind === 'boss' || r.kind === 'miniboss') {
      fillRect(map, r.x + 2, r.y + 2, r.w - 4, r.h - 4, theme.accent);
      prop(map, c.x, c.y - 2, spec.theme === 'crypt' ? 'bone_throne' : 'magic_circle', { flat: spec.theme !== 'crypt', light: 120, lightColor: theme.torchColor });
      for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]] as Array<[number, number]>) {
        prop(map, c.x + dx, c.y + dy, 'brazier', { light: 200, lightColor: theme.torchColor, cw: 12, ch: 8 });
      }
      const bossId = r.kind === 'boss' ? spec.boss! : spec.miniboss!;
      map.spawns.push({
        id: `${spec.mapId}_boss`, enemy: bossId, x: c.x * TILE, y: c.y * TILE,
        level: r.kind === 'boss' ? spec.bossLevel ?? spec.level + 1 : spec.level, radius: 400, respawn: Infinity,
        boss: r.kind === 'boss', elite: true, region: loc.region,
      });
      map.chests.push({ id: `${spec.mapId}_bosschest`, x: c.x * TILE, y: (c.y + 4) * TILE, level: (spec.bossLevel ?? spec.level) + 2, tier: 'boss' });
      return;
    }

    if (r.kind === 'treasure') {
      map.chests.push({ id: `${spec.mapId}_c${chestN++}`, x: c.x * TILE, y: c.y * TILE, level: spec.level + 1, tier: 'large' });
      prop(map, c.x - 2, c.y, 'crate', { cw: 18, ch: 12 });
      prop(map, c.x + 2, c.y, 'barrel', { cw: 16, ch: 10 });
    } else if (rng.bool(0.4)) {
      map.chests.push({ id: `${spec.mapId}_c${chestN++}`, x: c.x * TILE, y: (c.y + 1) * TILE, level: spec.level, tier: 'small' });
    }

    // enemies, scaled up slightly deeper into the dungeon
    const depth = Math.min(1, idx / Math.max(1, rooms.length - 1));
    const n = rng.int(2, 4) + (depth > 0.6 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const tx = r.x + rng.int(1, r.w - 2);
      const ty = r.y + rng.int(1, r.h - 2);
      map.spawns.push({
        id: `${spec.mapId}_s${spawnN++}`,
        enemy: rng.pick(spec.enemies),
        x: tx * TILE, y: ty * TILE,
        level: spec.level + Math.round(depth * 2) + rng.int(-1, 1),
        radius: 220,
        // Dungeon rank-and-file comes back, the way the overworld always has.
        // Only the named things in the boss room stay dead.
        respawn: 540 + rng.range(0, 240),
        elite: rng.bool(0.08),
        region: loc.region,
      });
    }
  });

  // Whisperwell holds one authored object among all the generated scenery:
  // the head off the Gilded Spade's roulette wheel, which somebody carried
  // down here and left. It goes in the room furthest from the stairs, lit
  // just enough to be spotted from the doorway of that room and no further,
  // and it is a prop rather than a chest drop so it is always in the same
  // place when the player comes looking for it a second time.
  if (spec.mapId === 'dungeon_whisper') {
    const far = rooms[farIdx] ?? rooms[rooms.length - 1];
    const c = roomCenter(far);
    prop(map, c.x + 1, c.y - 1, 'casino_wheel_head', {
      cw: 16, ch: 10, light: 60, lightColor: '#f6bf5d',
      interact: 'wheel_head', label: 'Take the brass wheel head',
      nameplate: 'Something brass', nameplateColor: '#f6bf5d',
    });
  }

  if (spec.theme === 'mine') decorateCave(map, rooms, theme, new RNG(`${seed}:${spec.mapId}:cavelife`));

  buildPropGrid(map);
  return map;
}

/**
 * Dress a mine so it reads as lived-in: water on the floor, things growing
 * at the walls, webs in the corners, timbering and a length of track.
 *
 * Runs last, on its own RNG, and only appends props. Every room, corridor,
 * spawn, chest and trap is laid exactly where it was before; this adds
 * scenery on top and moves none of it. Only the cart and the crystals take
 * up space, and they keep clear of everything already standing.
 */
function decorateCave(map: GameMap, rooms: Room[], theme: Theme, rng: RNG): void {
  const taken = (x: number, y: number, r: number) =>
    map.props.some((p) => p.art !== 'cave_rails' && Math.abs(p.x - x) < r && Math.abs(p.y - y) < r)
    || map.chests.some((c) => Math.abs(c.x - x) < r && Math.abs(c.y - y) < r)
    || map.spawns.some((sp) => sp.boss && Math.abs(sp.x - x) < 90 && Math.abs(sp.y - y) < 90);
  const floorAt = (tx: number, ty: number) => getTile(map, tx, ty) === theme.floor;
  const put = (tx: number, ty: number, art: string, o: Partial<PropInstance> = {}, room = 26) => {
    const x = tx * TILE + TILE / 2, y = ty * TILE + TILE;
    if (!floorAt(tx, ty) || taken(x, y, room)) return false;
    prop(map, tx, ty, art, o);
    return true;
  };

  // one room gets the old workings: a line of track and a cart left on it
  const tracked = rooms.filter((r) => r.kind === 'normal' && r.w >= 9 && r.h >= 6);
  const railRoom = tracked.length ? rng.pick(tracked) : undefined;

  // a few tries at a random spot, so one crowded tile does not lose the piece
  const tryPut = (n: number, at: () => [number, number], art: () => string, o: () => Partial<PropInstance>, room: number) => {
    for (let i = 0; i < n; i++) {
      const [tx, ty] = at();
      if (put(tx, ty, art(), o(), room)) return true;
    }
    return false;
  };

  for (const r of rooms) {
    const bottom = r.y + r.h - 1;
    const right = r.x + r.w - 1;
    const inside = (): [number, number] => [r.x + rng.int(1, r.w - 2), r.y + rng.int(1, r.h - 2)];
    const edge = (): [number, number] => {
      const side = rng.int(0, 2);
      return [side === 0 ? r.x : side === 1 ? right : r.x + rng.int(1, r.w - 2), side === 2 ? bottom : r.y + rng.int(1, r.h - 2)];
    };
    if (r.kind !== 'entry') {
      // standing water, which caveLife drips into
      for (let i = rng.int(1, 2); i > 0; i--) tryPut(5, inside, () => (rng.bool(0.5) ? 'cave_puddle_a' : 'cave_puddle_b'), () => ({ flat: true }), 40);
      // amethyst in some walls
      if (rng.bool(0.5)) tryPut(5, () => [rng.bool() ? r.x : right, r.y + rng.int(1, r.h - 2)], () => 'cave_crystal', () => ({ cw: 16, ch: 8, light: 64, lightColor: '#9578e8' }), 34);
      // glowing growth along the side and bottom walls
      for (let i = rng.int(1, 3); i > 0; i--) tryPut(4, edge, () => 'cave_glowshroom', () => ({ light: 56, lightColor: '#6fd0e8', phase: rng.range(0, 6) }), 30);
    }
    // webs in the upper corners
    if (rng.bool(0.6)) put(r.x, r.y, 'cave_web_l', { flat: true }, 16);
    if (rng.bool(0.6)) put(right, r.y, 'cave_web_r', { flat: true }, 16);
    // loose stone and cracks everywhere; they are what breaks up the floor
    for (let i = rng.int(3, 6); i > 0; i--) {
      put(r.x + rng.int(0, r.w - 1), r.y + rng.int(0, r.h - 1), rng.pick(['cave_pebbles_a', 'cave_pebbles_b', 'cave_crack']), { flat: true }, 20);
    }

    if (r === railRoom) {
      const ty = r.y + Math.floor(r.h / 2) + 1;
      let cart = false;
      for (let tx = r.x; tx <= right; tx++) {
        if (!floorAt(tx, ty)) continue;
        prop(map, tx, ty, 'cave_rails', { flat: true });
        if (!cart && tx > r.x + 2 && rng.bool(0.3)) cart = put(tx, ty, 'cave_cart', { cw: 30, ch: 10 }, 30);
      }
    }
  }

  // Timber sets across the north-south tunnels, every few tiles: two posts
  // against the rock, a beam overhead, a lantern. That is what a mine is.
  const inRoom = (tx: number, ty: number) => rooms.some((r) => tx >= r.x - 1 && tx <= r.x + r.w && ty >= r.y - 1 && ty <= r.y + r.h);
  for (let tx = 1; tx < map.w - 2; tx++) {
    let since = 99;
    for (let ty = 2; ty < map.h - 2; ty++) {
      const tunnel = floorAt(tx, ty) && floorAt(tx + 1, ty) && !floorAt(tx - 1, ty) && !floorAt(tx + 2, ty)
        && floorAt(tx, ty - 1) && floorAt(tx, ty + 1) && !inRoom(tx, ty);
      since++;
      if (!tunnel || since < 6 || !rng.bool(0.5)) continue;
      const x = (tx + 1) * TILE, y = ty * TILE + TILE;
      if (map.props.some((p) => Math.abs(p.x - x) < 40 && Math.abs(p.y - y) < 60)) continue;
      map.props.push({ art: 'cave_support', x, y, light: 150, lightColor: '#f6bf5d', phase: rng.range(0, 6) });
      since = 0;
    }
  }
}

export function dungeonEntry(map: GameMap): { x: number; y: number } {
  const p = map.portals.find((pt) => pt.kind === 'stairs');
  if (p) return { x: p.x + p.w / 2, y: p.y + p.h + 18 };
  return { x: map.w * TILE * 0.5, y: map.h * TILE * 0.5 };
}
