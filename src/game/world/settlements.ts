import { RNG } from '../core/rng';
import type { LocationDef } from '../../data/locations';
import { T, TILE } from './tiles';
import { getTile, setTile, type GameMap, type PropInstance } from './map';
import { placeBuilding } from './village';

const prop = (map: GameMap, tx: number, ty: number, art: string, o: Partial<PropInstance> = {}) => {
  map.props.push({ art, x: tx * TILE + TILE / 2, y: ty * TILE + TILE, ...o });
};

interface SettlementStyle {
  ground: number;
  houses: string[];
  trees?: string;
  lightColor: string;
}

const STYLES: Record<string, SettlementStyle> = {
  northwatch: { ground: T.GRAVEL, houses: ['snow_house', 'snow_house', 'hut', 'dwarf_hall'], trees: 'tree_pine_snow', lightColor: '#8fc4dc' },
  mirefall: { ground: T.SWAMP_GROUND, houses: ['hut', 'cottage_c', 'hut', 'ruined_house'], trees: 'tree_willow', lightColor: '#8fbf4a' },
  duneholt: { ground: T.DESERT_ROCK, houses: ['desert_house', 'desert_house', 'tent', 'general_store'], trees: 'tree_palm', lightColor: '#f6bf5d' },
  thornhollow: { ground: T.GRASS_DARK, houses: ['elven_house', 'elven_house', 'hut', 'cottage_b'], trees: 'tree_magic', lightColor: '#9578e8' },
};

/** Smaller outposts share one layout routine with per-region dressing. */
export function buildSettlement(map: GameMap, rng: RNG, loc: LocationDef): void {
  const style = STYLES[loc.id] ?? STYLES.mirefall;
  const { tx: CX, ty: CY } = loc;

  map.props = map.props.filter((p) => Math.hypot(p.x / TILE - CX, p.y / TILE - CY) > 13);
  for (let ty = CY - 13; ty <= CY + 13; ty++) {
    for (let tx = CX - 13; tx <= CX + 13; tx++) {
      const d = Math.hypot(tx - CX, ty - CY);
      if (d > 13) continue;
      const cur = getTile(map, tx, ty);
      if (cur === T.WATER || cur === T.DEEP_WATER || cur === T.MOUNTAIN) continue;
      if (d < 4) setTile(map, tx, ty, T.ROAD);
      else if (d < 12) setTile(map, tx, ty, style.ground);
    }
  }
  for (let ty = CY - 13; ty <= CY + 13; ty++) for (let tx = CX - 1; tx <= CX + 1; tx++) setTile(map, tx, ty, T.ROAD);
  for (let tx = CX - 13; tx <= CX + 13; tx++) for (let ty = CY - 1; ty <= CY + 1; ty++) setTile(map, tx, ty, T.ROAD);

  // One building here is worth entering — a lodge with a bed and a stash. The
  // rest are the valley's standard shuttered townhouse, so the player learns
  // one silhouette and never wastes a walk on a door that does not open.
  placeBuilding(map, {
    id: `${loc.id}_lodge`,
    art: style.houses[0],
    tx: CX - 8,
    ty: CY - 4,
    interior: `int_${loc.id}_lodge`,
    label: `Enter the ${loc.name} lodge`,
  });
  const filler: Array<[number, number]> = [[8, -4], [-8, 7], [8, 7], [-11, 1], [11, 1], [0, -9]];
  filler.forEach(([dx, dy], i) => {
    placeBuilding(map, { id: `${loc.id}_h${i}`, art: 'townhouse', tx: CX + dx, ty: CY + dy, label: 'A shuttered house' });
  });

  prop(map, CX, CY + 4, loc.id === 'duneholt' ? 'market_stall' : 'well', { cw: 34, ch: 16, interact: loc.id === 'duneholt' ? undefined : 'well', label: 'Drink from the well' });
  prop(map, CX - 6, CY - 6, 'waystone', {
    cw: 46, ch: 22, light: 150, lightColor: '#4f9ce8',
    interact: 'waystone', label: 'Use the waystone', data: { site: loc.id },
  });
  prop(map, CX + 3, CY - 3, 'notice_board', { cw: 30, ch: 12, interact: 'notice', label: 'Read the notice board' });
  prop(map, CX - 4, CY + 6, 'cart', { cw: 40, ch: 16 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6;
    prop(map, Math.round(CX + Math.cos(a) * 10), Math.round(CY + Math.sin(a) * 10), 'torch', { light: 140, lightColor: style.lightColor, cw: 8, ch: 6 });
  }
  if (style.trees) {
    for (let i = 0; i < 10; i++) {
      const tx = CX + rng.int(-12, 12);
      const ty = CY + rng.int(-12, 12);
      if (Math.hypot(tx - CX, ty - CY) < 7) continue;
      if (getTile(map, tx, ty) === T.ROAD) continue;
      prop(map, tx, ty, style.trees, { cw: 12, ch: 8, phase: rng.range(0, 6) });
    }
  }
  map.chests.push({ id: `chest_${loc.id}`, x: (CX + 6) * TILE, y: (CY + 9) * TILE, level: loc.level ?? 6, tier: 'small' });
}

export function settlementInteriorIds(loc: LocationDef): string[] {
  return [`int_${loc.id}_lodge`];
}
