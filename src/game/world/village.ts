import { RNG } from '../core/rng';
import { getBuilding } from '../art/buildings';
import { T, TILE } from './tiles';
import { getTile, setTile, type GameMap, type PropInstance } from './map';

export interface BuildingPlacement {
  id: string;
  art: string;
  tx: number;
  ty: number;
  interior?: string;
  label: string;
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

export const ASHVALE_BUILDINGS: BuildingPlacement[] = [
  { id: 'player_home', art: 'player_home', tx: 175, ty: 182, interior: 'int_home', label: 'Enter your home' },
  { id: 'town_hall', art: 'town_hall', tx: 192, ty: 175, interior: 'int_hall', label: 'Enter the Moot Hall' },
  { id: 'inn', art: 'inn', tx: 207, ty: 181, interior: 'int_inn', label: 'Enter the Kettle & Crown' },
  { id: 'blacksmith', art: 'blacksmith', tx: 208, ty: 202, interior: 'int_smithy', label: 'Enter the forge house' },
  { id: 'general_store', art: 'general_store', tx: 176, ty: 202, interior: 'int_store', label: 'Enter the trading post' },
  { id: 'apothecary', art: 'apothecary', tx: 170, ty: 192, interior: 'int_apothecary', label: 'Enter the apothecary' },
  { id: 'chapel', art: 'chapel', tx: 214, ty: 175, interior: 'int_chapel', label: 'Enter the chapel' },
  { id: 'farmhouse', art: 'farmhouse', tx: 174, ty: 214, interior: 'int_farm', label: 'Enter the farmhouse' },
  { id: 'cottage_a', art: 'cottage_a', tx: 199, ty: 214, interior: 'int_cottage_a', label: "Enter Maren's cottage" },
  { id: 'cottage_b', art: 'cottage_b', tx: 212, ty: 212, interior: 'int_cottage_b', label: "Enter Old Bram's cottage" },
  { id: 'cottage_c', art: 'cottage_c', tx: 187, ty: 216, interior: 'int_cottage_c', label: 'Enter the cottage' },
  { id: 'guard_post', art: 'guard_post', tx: 192, ty: 222, label: 'The south gatehouse' },
];

export function buildAshvale(map: GameMap, rng: RNG): void {
  const CX = 192;
  const CY = 192;

  // plaza and streets
  for (let ty = CY - 8; ty <= CY + 8; ty++) {
    for (let tx = CX - 9; tx <= CX + 9; tx++) {
      if (Math.hypot((tx - CX) * 0.85, ty - CY) < 8) setTile(map, tx, ty, T.ROAD);
    }
  }
  for (let ty = CY - 22; ty <= CY + 32; ty++) for (let tx = CX - 2; tx <= CX + 2; tx++) setTile(map, tx, ty, T.ROAD);
  for (let tx = CX - 26; tx <= CX + 26; tx++) for (let ty = CY - 2; ty <= CY + 2; ty++) setTile(map, tx, ty, T.ROAD);
  // side lanes to the outer cottages
  for (let tx = CX - 22; tx <= CX + 22; tx++) for (let ty = CY + 18; ty <= CY + 20; ty++) setTile(map, tx, ty, T.ROAD_DIRT);
  for (let ty = CY - 20; ty <= CY + 20; ty++) { setTile(map, CX - 20, ty, T.ROAD_DIRT); setTile(map, CX + 20, ty, T.ROAD_DIRT); }

  // grass tidy-up around town
  for (let ty = CY - 30; ty <= CY + 34; ty++) {
    for (let tx = CX - 32; tx <= CX + 32; tx++) {
      const cur = getTile(map, tx, ty);
      if (cur === T.TALL_GRASS || cur === T.GRASS_DARK || cur === T.DIRT) setTile(map, tx, ty, T.GRASS);
    }
  }

  // farm fields
  for (let ty = CY + 14; ty <= CY + 24; ty++) {
    for (let tx = CX - 30; tx <= CX - 16; tx++) {
      if (getTile(map, tx, ty) === T.GRASS) setTile(map, tx, ty, T.FARM_SOIL);
    }
  }

  for (const b of ASHVALE_BUILDINGS) placeBuilding(map, b);

  // the valley's first waystone, on the north side of the square
  prop(map, CX - 7, CY - 7, 'waystone', {
    cw: 46, ch: 22, light: 150, lightColor: '#4f9ce8',
    interact: 'waystone', label: 'Use the waystone', data: { site: 'ashvale' },
  });

  // town square dressing
  prop(map, CX, CY + 3, 'well', { cw: 34, ch: 16, interact: 'well', label: 'Drink from the well' });
  prop(map, CX - 5, CY - 3, 'market_stall', { cw: 56, ch: 18 });
  prop(map, CX + 5, CY - 3, 'market_stall', { cw: 56, ch: 18 });
  prop(map, CX + 3, CY + 6, 'notice_board', { cw: 30, ch: 12, interact: 'notice', label: 'Read the notice board' });
  prop(map, CX - 8, CY + 5, 'cart', { cw: 40, ch: 16 });
  prop(map, CX + 9, CY + 5, 'crate', { cw: 18, ch: 12 });
  prop(map, CX + 10, CY + 6, 'barrel', { cw: 16, ch: 12 });

  // blacksmith yard
  prop(map, 205, 203, 'forge', { cw: 38, ch: 20, light: 170, lightColor: '#e8763a' });
  prop(map, 203, 205, 'anvil', { cw: 26, ch: 12, interact: 'anvil', label: 'Use the anvil' });
  prop(map, 206, 206, 'grindstone', { cw: 24, ch: 12 });
  prop(map, 201, 206, 'weapon_rack', { cw: 28, ch: 10 });
  prop(map, 210, 206, 'log', { cw: 36, ch: 12 });

  // apothecary garden
  prop(map, 169, 196, 'cauldron', { cw: 24, ch: 12 });
  prop(map, 167, 195, 'alchemy_table', { cw: 38, ch: 12 });
  for (let i = 0; i < 6; i++) prop(map, 166 + (i % 3), 198 + Math.floor(i / 3), 'mushroom_cluster');

  // farm
  prop(map, 178, 214, 'scarecrow', { cw: 12, ch: 8 });
  prop(map, 170, 210, 'hay', { cw: 28, ch: 14 });
  prop(map, 172, 218, 'hay', { cw: 28, ch: 14 });
  prop(map, 167, 213, 'beehive', { cw: 18, ch: 10 });
  for (let tx = 162; tx <= 180; tx += 2) prop(map, tx, 206, 'fence', { cw: 30, ch: 8 });
  for (let ty = 206; ty <= 224; ty += 2) prop(map, 162, ty, 'fence', { cw: 30, ch: 8 });

  // street lighting along the main roads
  for (let i = -20; i <= 20; i += 8) {
    prop(map, CX - 4, CY + i, 'torch', { light: 145, lightColor: '#f6bf5d', cw: 8, ch: 6 });
    prop(map, CX + 4, CY + i, 'torch', { light: 145, lightColor: '#f6bf5d', cw: 8, ch: 6 });
  }
  for (let i = -22; i <= 22; i += 10) {
    if (Math.abs(i) < 8) continue;
    prop(map, CX + i, CY - 4, 'torch', { light: 145, lightColor: '#f6bf5d', cw: 8, ch: 6 });
  }

  // gates and banners
  prop(map, CX - 4, CY + 30, 'banner', { cw: 10, ch: 6 });
  prop(map, CX + 4, CY + 30, 'banner', { cw: 10, ch: 6 });
  prop(map, CX - 4, CY - 24, 'banner', { cw: 10, ch: 6 });
  prop(map, CX + 4, CY - 24, 'banner', { cw: 10, ch: 6 });
  prop(map, CX + 6, CY + 30, 'signpost', { cw: 12, ch: 8, interact: 'sign', label: 'Read the signpost', data: { text: 'ASHVALE — south to Duneholt, west to Thornhollow, north to Northwatch, east to Mirefall.' } });

  // orchard, hedgerow and clutter so the town reads as lived-in
  const soft = (tx: number, ty: number) => {
    const t = getTile(map, tx, ty);
    return t === T.GRASS || t === T.FLOWERS || t === T.GRASS_PALE || t === T.TALL_GRASS;
  };
  const occupied = (tx: number, ty: number) =>
    map.props.some((pr) => Math.abs(pr.x / TILE - tx) < 1.6 && Math.abs(pr.y / TILE - ty) < 1.6);

  // orchard rows east of the farm
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      const tx = CX - 14 + col * 3;
      const ty = CY + 12 + row * 3;
      if (!soft(tx, ty) || occupied(tx, ty)) continue;
      prop(map, tx, ty, rng.bool(0.6) ? 'tree_maple' : 'tree_oak', { cw: 12, ch: 8, phase: rng.range(0, 6) });
    }
  }
  for (let i = 0; i < 460; i++) {
    const tx = CX + rng.int(-34, 34);
    const ty = CY + rng.int(-32, 36);
    if (!soft(tx, ty) || occupied(tx, ty)) continue;
    // keep the square and the streets walkable
    if (Math.abs(tx - CX) < 4 || Math.abs(ty - CY) < 4) continue;
    const r = rng.next();
    if (r < 0.26) prop(map, tx, ty, rng.bool(0.4) ? 'tree_oak' : rng.bool(0.5) ? 'tree_birch' : 'tree_maple', { cw: 12, ch: 8, phase: rng.range(0, 6) });
    else if (r < 0.38) prop(map, tx, ty, rng.bool(0.5) ? 'bush_berry' : 'bush', { cw: 14, ch: 8 });
    else if (r < 0.72) prop(map, tx, ty, 'grass_tuft');
    else if (r < 0.82) prop(map, tx, ty, 'rock_small', { cw: 12, ch: 7 });
    else if (r < 0.9) prop(map, tx, ty, 'fern');
    else prop(map, tx, ty, 'mushroom_cluster');
  }
  // fenced kitchen gardens beside two cottages
  for (const [bx, by] of [[197, 206], [208, 204]] as Array<[number, number]>) {
    for (let i = 0; i < 4; i++) {
      prop(map, bx + i, by, 'fence', { cw: 30, ch: 8 });
      if (rng.bool(0.6)) prop(map, bx + i, by + 2, 'bush_berry', { cw: 14, ch: 8 });
    }
  }
  // clutter and furniture around the square, so it reads as a market not a plaza
  prop(map, CX - 10, CY + 2, 'barrel_stack', { cw: 26, ch: 16 });
  prop(map, CX - 11, CY + 4, 'crate', { cw: 18, ch: 12 });
  prop(map, CX + 9, CY - 6, 'sack', { cw: 16, ch: 10 });
  prop(map, CX + 8, CY + 7, 'log', { cw: 36, ch: 12 });
  prop(map, CX - 3, CY + 9, 'hay', { cw: 28, ch: 14 });
  prop(map, CX + 10, CY + 3, 'barrel_stack', { cw: 26, ch: 16 });

  for (const [bx, by] of [[-7, 1], [7, 1], [-7, -4], [7, -4]] as Array<[number, number]>) {
    prop(map, CX + bx, CY + by, 'bench', { cw: 36, ch: 10 });
  }
  for (const [bx, by] of [[-5, 5], [5, 5], [-9, -2], [9, -2], [-2, -7], [2, -7]] as Array<[number, number]>) {
    prop(map, CX + bx, CY + by, 'planter', { cw: 22, ch: 12 });
  }
  for (const [lx, ly] of [[-8, -8], [8, -8], [-8, 8], [8, 8]] as Array<[number, number]>) {
    prop(map, CX + lx, CY + ly, 'lamp_post', { cw: 8, ch: 6, light: 165, lightColor: '#f6bf5d' });
  }
  // extra stalls flanking the square
  prop(map, CX - 9, CY - 1, 'market_stall', { cw: 56, ch: 18 });
  prop(map, CX + 9, CY - 1, 'market_stall', { cw: 56, ch: 18 });

  // a starter chest tucked behind the player's home
  map.chests.push({ id: 'chest_home_yard', x: 172 * TILE, y: 179 * TILE, level: 1, tier: 'small', gold: 30 });
}
