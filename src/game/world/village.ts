import { RNG } from '../core/rng';
import { VILLAGE_TX, VILLAGE_TY } from '../../data/locations';
import { getBuilding } from '../art/buildings';
import { T, TILE } from './tiles';
import { getTile, setTile, type GameMap, type PropInstance } from './map';

const CX = VILLAGE_TX;
const CY = VILLAGE_TY;

export interface BuildingPlacement {
  id: string;
  art: string;
  tx: number;
  ty: number;
  interior?: string;
  label: string;
}

/**
 * Fill water out of a settlement's footprint. Terrain is generated before
 * anything is built on it, so a lake or a river bend can land on the site and
 * strand a doorway. Everything inside `solidR` becomes dry ground; between
 * `solidR` and `featherR` only the deep water is raised to shallow, so the
 * remaining shoreline slopes away from town instead of ending at a wall.
 */
export function drainFor(map: GameMap, cx: number, cy: number, solidR: number, featherR: number, ground: number = T.GRASS): void {
  for (let ty = cy - featherR; ty <= cy + featherR; ty++) {
    for (let tx = cx - featherR; tx <= cx + featherR; tx++) {
      const d = Math.hypot(tx - cx, ty - cy);
      if (d > featherR) continue;
      const cur = getTile(map, tx, ty);
      if (cur !== T.WATER && cur !== T.DEEP_WATER && cur !== T.SWAMP_WATER) continue;
      if (d <= solidR) setTile(map, tx, ty, ground);
      else if (cur === T.DEEP_WATER) setTile(map, tx, ty, T.WATER);
    }
  }
}

/** Place a building sprite, its collision footprint and its door portal. */
export function placeBuilding(map: GameMap, b: BuildingPlacement): void {
  const art = getBuilding(b.art);
  const x = b.tx * TILE + TILE / 2;
  const y = b.ty * TILE + TILE;

  // clear scenery and flatten the ground under the building
  const halfW = Math.ceil(art.w / TILE / 2) + 1;
  const tallH = Math.ceil(art.h / TILE) + 1;
  map.props = map.props.filter((p) => {
    const dx = Math.abs(p.x - x);
    const dy = p.y - y;
    return !(dx < art.w / 2 + 8 && dy < 10 && dy > -art.h);
  });
  for (let ty = b.ty - 1; ty <= b.ty; ty++) {
    for (let tx = b.tx - halfW; tx <= b.tx + halfW; tx++) {
      const cur = getTile(map, tx, ty);
      if (cur === T.WATER || cur === T.DEEP_WATER) setTile(map, tx, ty, T.DIRT);
    }
  }
  void tallH;

  map.props.push({
    art: `bld:${b.art}`,
    x,
    y,
    cw: art.footW - 6,
    ch: art.footH - 4,
  });

  const doorWorldX = x - art.w / 2 + art.doorX;
  if (b.interior) {
    map.portals.push({
      x: doorWorldX - 16,
      y: y - 26,
      w: 32,
      h: 30,
      to: b.interior,
      tx: 0,
      ty: 0,
      label: b.label,
      kind: 'door',
    });
  }
  // doorstep path
  const dtx = Math.floor(doorWorldX / TILE);
  for (let i = 0; i < 2; i++) setTile(map, dtx, b.ty + i, T.DIRT);
}

const prop = (map: GameMap, tx: number, ty: number, art: string, o: Partial<PropInstance> = {}) => {
  map.props.push({ art, x: tx * TILE + TILE / 2, y: ty * TILE + TILE, ...o });
};

/**
 * Ashvale is laid out as a ring, not a sprawl. Every building you can actually
 * use faces the square within a few steps of the waystone, each one wearing a
 * different roof, a trade sign and a lit name plate, so the player can stand in
 * the middle of town and see at a glance where the forge, the shop, the
 * apothecary, the inn, the chapel and the hall are. Anything without a purpose
 * is pushed out past the lanes and wears the one shuttered silhouette.
 *
 * Coordinates are offsets from the town centre so the whole town moves with
 * VILLAGE_TX/TY if the world is ever rescaled again.
 */
interface ServiceSpot {
  id: string;
  art: string;
  dx: number;
  dy: number;
  interior: string;
  label: string;
  /** Shown on the permanent name plate over the door. */
  plate: string;
  color: string;
}

const SERVICES: ServiceSpot[] = [
  { id: 'blacksmith', art: 'blacksmith', dx: -11, dy: -7, interior: 'int_smithy', label: 'Enter the forge', plate: 'FORGE', color: '#e8763a' },
  { id: 'general_store', art: 'general_store', dx: 0, dy: -9, interior: 'int_store', label: 'Enter the trading post', plate: 'TRADING POST', color: '#6fbf5a' },
  { id: 'apothecary', art: 'apothecary', dx: 11, dy: -7, interior: 'int_apothecary', label: 'Enter the apothecary', plate: 'APOTHECARY', color: '#9578e8' },
  { id: 'inn', art: 'inn', dx: 13, dy: 7, interior: 'int_inn', label: 'Enter the Kettle & Crown', plate: 'INN', color: '#f6bf5d' },
  { id: 'chapel', art: 'chapel', dx: 0, dy: 11, interior: 'int_chapel', label: 'Enter the chapel', plate: 'CHAPEL', color: '#ffe9a8' },
  { id: 'town_hall', art: 'town_hall', dx: -13, dy: 7, interior: 'int_hall', label: 'Enter the Moot Hall', plate: 'MOOT HALL', color: '#8fd0f0' },
];

const OUTER: BuildingPlacement[] = [];

export const ASHVALE_BUILDINGS: BuildingPlacement[] = [
  ...SERVICES.map((sv) => ({ id: sv.id, art: sv.art, tx: CX + sv.dx, ty: CY + sv.dy, interior: sv.interior, label: sv.label })),
  // The Gilded Spade took over the shuttered house on the west lane, between
  // the forge and the hall. It sits on the outer ring rather than the square,
  // so it does not compete with a door that sells you something you need.
  { id: 'casino', art: 'casino', tx: CX - 30, ty: CY - 4, interior: 'int_casino', label: 'Enter the casino' },
  { id: 'player_home', art: 'player_home', tx: CX - 6, ty: CY + 18, interior: 'int_home', label: 'Enter your home' },
  { id: 'farmhouse', art: 'farmhouse', tx: CX - 22, ty: CY + 24, interior: 'int_farm', label: 'Enter the farmhouse' },
  { id: 'guard_post', art: 'guard_post', tx: CX + 2, ty: CY + 30, label: 'The south gatehouse' },
  ...OUTER,
];

/**
 * Filler housing. All one silhouette, all boarded shut — the player checks one
 * of these, learns the shape, and never wastes another walk on it. They live
 * outside the service ring so they never compete with a door that matters.
 */
const ASHVALE_TOWNHOUSES: Array<[number, number]> = [
  [-26, -20], [-18, -24], [-8, -26], [4, -26], [14, -23], [24, -18],
  [-28, 12], [-24, 22], [26, 12], [22, 22], [12, 28], [-14, 30],
  [30, -4], [16, 34], [-20, 36],
];

export function buildAshvale(map: GameMap, rng: RNG): void {
  // Drain the town before laying anything on it. The elevation pass can drop a
  // lake straight onto the site, and on an unlucky seed that walls the player's
  // own front door off from the square. Ground is filled solid out to the lane
  // and the lake edge is feathered beyond it, so a river still runs past the
  // town without running through the doorsteps.
  drainFor(map, CX, CY, 48, 66);

  // A tight paved square with a short spoke out to each service door. Paving
  // the whole ring turned the town into one grey slab; this way the stone
  // points at the doors and everything else stays green.
  for (let ty = CY - 9; ty <= CY + 9; ty++) {
    for (let tx = CX - 13; tx <= CX + 13; tx++) {
      if (Math.hypot((tx - CX) * 0.68, ty - CY) < 8) setTile(map, tx, ty, T.ROAD);
    }
  }
  for (const sv of SERVICES) {
    const steps = Math.max(Math.abs(sv.dx), Math.abs(sv.dy)) + 3;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(CX + sv.dx * t);
      const py = Math.round(CY + sv.dy * t) + 1;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) setTile(map, px + ox, py + oy, T.ROAD);
    }
  }
  // the four highroads out of town
  for (let ty = CY - 34; ty <= CY + 40; ty++) for (let tx = CX - 2; tx <= CX + 2; tx++) setTile(map, tx, ty, T.ROAD);
  for (let tx = CX - 38; tx <= CX + 38; tx++) for (let ty = CY - 2; ty <= CY + 2; ty++) setTile(map, tx, ty, T.ROAD);
  // outer lane ringing the town, where the shuttered houses sit
  for (let a = 0; a < 360; a += 1) {
    const r = a * (Math.PI / 180);
    for (let k = -1; k <= 1; k++) {
      setTile(map, Math.round(CX + Math.cos(r) * (26 + k)), Math.round(CY + Math.sin(r) * (26 + k)), T.ROAD_DIRT);
    }
  }

  // grass tidy-up around town
  for (let ty = CY - 42; ty <= CY + 46; ty++) {
    for (let tx = CX - 44; tx <= CX + 44; tx++) {
      const cur = getTile(map, tx, ty);
      if (cur === T.TALL_GRASS || cur === T.GRASS_DARK || cur === T.DIRT || cur === T.SAND) setTile(map, tx, ty, T.GRASS);
    }
  }

  // farm fields, west of the farmhouse
  for (let ty = CY + 20; ty <= CY + 32; ty++) {
    for (let tx = CX - 36; tx <= CX - 24; tx++) {
      if (getTile(map, tx, ty) === T.GRASS) setTile(map, tx, ty, T.FARM_SOIL);
    }
  }

  for (const b of ASHVALE_BUILDINGS) placeBuilding(map, b);
  ASHVALE_TOWNHOUSES.forEach(([dx, dy], i) => {
    placeBuilding(map, { id: `ashvale_house_${i}`, art: 'townhouse', tx: CX + dx, ty: CY + dy, label: 'A shuttered house' });
  });

  // A lit name plate outside every door worth opening.
  // The sign hangs two tiles to the side: a door drops you directly in front
  // of itself when you step out, and anything standing on that tile wedges you
  // against the wall.
  for (const sv of SERVICES) {
    const sx = CX + sv.dx;
    const sy = CY + sv.dy + 1;
    prop(map, sx + 2, sy, 'shop_sign', {
      cw: 12, ch: 8, light: 96, lightColor: sv.color,
      nameplate: sv.plate, nameplateColor: sv.color,
    });
    // Placeholders where the iron lamp posts stood. They keep the scatter
    // below from planting a tree on the doorstep and are lifted out at the
    // end — see the bottom of this function.
    prop(map, sx - 4, sy, 'lamp_post', { cw: 8, ch: 6, light: 150, lightColor: sv.color });
    prop(map, sx + 5, sy, 'lamp_post', { cw: 8, ch: 6, light: 150, lightColor: sv.color });
  }

  // The casino labels itself like every other usable door — a hanging sign, a
  // name plate and lamps — but the marquee over the lintel is what you see
  // from the lane, and it runs its bulbs whatever the hour.
  {
    const kx = CX - 30;
    const ky = CY - 4;
    prop(map, kx, ky, 'casino_marquee', { y: ky * TILE + 33, light: 190, lightColor: '#f2cb60' });
    prop(map, kx + 3, ky + 1, 'casino_sign', {
      cw: 12, ch: 8, light: 96, lightColor: '#d9a441',
      nameplate: 'CASINO', nameplateColor: '#d9a441',
    });
    prop(map, kx - 4, ky + 1, 'casino_lamp', { cw: 8, ch: 6, light: 165, lightColor: '#efe6d6' });
    prop(map, kx + 5, ky + 1, 'casino_lamp', { cw: 8, ch: 6, light: 165, lightColor: '#efe6d6' });
    prop(map, kx - 6, ky + 2, 'bench', { cw: 36, ch: 10 });
    prop(map, kx + 7, ky + 2, 'planter', { cw: 22, ch: 12 });
    // a paved forecourt and a spur joining the outer lane
    for (let ty = ky + 1; ty <= ky + 2; ty++) {
      for (let tx = kx - 4; tx <= kx + 4; tx++) setTile(map, tx, ty, T.ROAD);
    }
    for (let tx = kx + 5; tx <= CX - 24; tx++) {
      for (let ty = ky + 1; ty <= ky + 2; ty++) setTile(map, tx, ty, T.ROAD_DIRT);
    }
  }

  // the valley's first waystone, dead centre where you cannot miss it
  prop(map, CX - 4, CY - 2, 'waystone', {
    cw: 46, ch: 22, light: 165, lightColor: '#4f9ce8',
    interact: 'waystone', label: 'Use the waystone', data: { site: 'ashvale' },
    nameplate: 'WAYSTONE', nameplateColor: '#4f9ce8',
  });
  prop(map, CX + 4, CY - 2, 'notice_board', {
    cw: 30, ch: 12, interact: 'notice', label: 'Read the notice board',
    nameplate: 'NOTICES', nameplateColor: '#cfc7e0',
  });
  prop(map, CX, CY + 4, 'well', { cw: 34, ch: 16, interact: 'well', label: 'Drink from the well' });

  // market stalls line the square without blocking the doors
  for (const [mx, my] of [[-7, 2], [7, 2], [-7, -3], [7, -3]] as Array<[number, number]>) {
    prop(map, CX + mx, CY + my, 'market_stall', { cw: 56, ch: 18 });
  }
  prop(map, CX - 9, CY + 4, 'cart', { cw: 40, ch: 16 });
  prop(map, CX + 9, CY + 4, 'barrel_stack', { cw: 26, ch: 16 });
  prop(map, CX + 10, CY + 5, 'crate', { cw: 18, ch: 12 });
  prop(map, CX - 10, CY - 5, 'sack', { cw: 16, ch: 10 });

  // blacksmith yard, outside the forge door
  prop(map, CX - 14, CY - 5, 'forge', { cw: 38, ch: 20, light: 175, lightColor: '#e8763a' });
  prop(map, CX - 15, CY - 3, 'anvil', {
    cw: 26, ch: 12, interact: 'anvil', label: 'Use the anvil',
    nameplate: 'ANVIL', nameplateColor: '#e8763a',
  });
  prop(map, CX - 12, CY - 3, 'grindstone', { cw: 24, ch: 12 });
  prop(map, CX - 17, CY - 6, 'weapon_rack', { cw: 28, ch: 10 });

  // apothecary garden, outside its door
  prop(map, CX + 14, CY - 5, 'cauldron', { cw: 24, ch: 12 });
  prop(map, CX + 16, CY - 6, 'alchemy_table', { cw: 38, ch: 12 });
  for (let i = 0; i < 6; i++) prop(map, CX + 13 + (i % 3), CY - 4 + Math.floor(i / 3), 'mushroom_cluster');

  // farm
  prop(map, CX - 25, CY + 21, 'scarecrow', { cw: 12, ch: 8 });
  prop(map, CX - 30, CY + 18, 'hay', { cw: 28, ch: 14 });
  prop(map, CX - 27, CY + 28, 'hay', { cw: 28, ch: 14 });
  prop(map, CX - 33, CY + 22, 'beehive', { cw: 18, ch: 10 });
  for (let tx = CX - 38; tx <= CX - 20; tx += 2) prop(map, tx, CY + 16, 'fence', { cw: 30, ch: 8 });
  for (let ty = CY + 16; ty <= CY + 34; ty += 2) prop(map, CX - 38, ty, 'fence', { cw: 30, ch: 8 });

  // street lighting along the highroads
  for (let i = -30; i <= 34; i += 8) {
    if (Math.abs(i) < 12) continue;
    prop(map, CX - 4, CY + i, 'torch', { light: 145, lightColor: '#f6bf5d', cw: 8, ch: 6 });
    prop(map, CX + 4, CY + i, 'torch', { light: 145, lightColor: '#f6bf5d', cw: 8, ch: 6 });
  }
  for (let i = -34; i <= 34; i += 10) {
    if (Math.abs(i) < 14) continue;
    prop(map, CX + i, CY - 4, 'torch', { light: 145, lightColor: '#f6bf5d', cw: 8, ch: 6 });
  }

  // gates and banners
  for (const [bx, by] of [[-4, 38], [4, 38], [-4, -32], [4, -32]] as Array<[number, number]>) {
    prop(map, CX + bx, CY + by, 'banner_standard', { cw: 10, ch: 6, phase: bx * 0.21 + by * 0.05 });
  }
  prop(map, CX + 6, CY + 38, 'signpost', {
    cw: 12, ch: 8, interact: 'sign', label: 'Read the signpost',
    data: { text: 'ASHVALE — south to Duneholt, west to Thornhollow, north to Northwatch, east to Mirefall.' },
  });

  // orchard, hedgerow and clutter so the town reads as lived-in
  const soft = (tx: number, ty: number) => {
    const t = getTile(map, tx, ty);
    return t === T.GRASS || t === T.FLOWERS || t === T.GRASS_PALE || t === T.TALL_GRASS;
  };
  const occupied = (tx: number, ty: number) =>
    map.props.some((pr) => Math.abs(pr.x / TILE - tx) < 1.6 && Math.abs(pr.y / TILE - ty) < 1.6);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const tx = CX + 14 + col * 3;
      const ty = CY + 16 + row * 3;
      if (!soft(tx, ty) || occupied(tx, ty)) continue;
      prop(map, tx, ty, rng.bool(0.6) ? 'tree_maple' : 'tree_oak', { cw: 12, ch: 8, phase: rng.range(0, 6) });
    }
  }
  for (let i = 0; i < 700; i++) {
    const tx = CX + rng.int(-46, 46);
    const ty = CY + rng.int(-44, 48);
    if (!soft(tx, ty) || occupied(tx, ty)) continue;
    if (Math.abs(tx - CX) < 4 || Math.abs(ty - CY) < 4) continue;
    const r = rng.next();
    if (r < 0.26) prop(map, tx, ty, rng.bool(0.4) ? 'tree_oak' : rng.bool(0.5) ? 'tree_birch' : 'tree_maple', { cw: 12, ch: 8, phase: rng.range(0, 6) });
    else if (r < 0.38) prop(map, tx, ty, rng.bool(0.5) ? 'bush_berry' : 'bush', { cw: 14, ch: 8 });
    else if (r < 0.72) prop(map, tx, ty, 'grass_tuft');
    else if (r < 0.82) prop(map, tx, ty, 'rock_small', { cw: 12, ch: 7 });
    else if (r < 0.9) prop(map, tx, ty, 'fern');
    else prop(map, tx, ty, 'mushroom_cluster');
  }
  // Fire baskets at the four corners of the square. Iron lamp posts stood
  // here once and looked electric; open flame is what the valley burns.
  for (const [lx, ly] of [[-10, -8], [10, -8], [-10, 9], [10, 9]] as Array<[number, number]>) {
    prop(map, CX + lx, CY + ly, 'brazier', { cw: 12, ch: 8, light: 165, lightColor: '#f6bf5d', phase: (lx + ly) * 0.37 });
  }
  for (const [bx, by] of [[-6, 6], [6, 6], [-6, -6], [6, -6]] as Array<[number, number]>) {
    prop(map, CX + bx, CY + by, 'bench', { cw: 36, ch: 10 });
  }
  for (const [px, py] of [[-3, 7], [3, 7], [-3, -7], [3, -7]] as Array<[number, number]>) {
    prop(map, CX + px, CY + py, 'planter', { cw: 22, ch: 12 });
  }

  // No iron lamp posts in the valley: they read as electric light.
  map.props = map.props.filter((pr) => pr.art !== 'lamp_post' && pr.art !== 'casino_lamp');

  // a starter chest tucked behind the player's home
  map.chests.push({ id: 'chest_home_yard', x: (CX - 9) * TILE, y: (CY + 15) * TILE, level: 1, tier: 'small', gold: 30 });
}
