import { RNG } from '../core/rng';
import { T, TILE } from './tiles';
import { buildPropGrid, createMap, fillRect, setTile, type GameMap, type PropInstance } from './map';

type InteriorKind = 'home' | 'inn' | 'smithy' | 'store' | 'apothecary' | 'hall' | 'chapel' | 'farm' | 'cottage';

interface InteriorSpec {
  kind: InteriorKind;
  name: string;
  w: number;
  h: number;
  floor: number;
  wall: number;
}

const SPECS: Record<string, InteriorSpec> = {
  int_home: { kind: 'home', name: 'Your Home', w: 17, h: 13, floor: T.FLOOR_WOOD, wall: T.WALL_WOOD },
  int_inn: { kind: 'inn', name: 'The Kettle & Crown', w: 25, h: 18, floor: T.FLOOR_WOOD, wall: T.WALL_WOOD },
  int_smithy: { kind: 'smithy', name: 'Ashvale Forge', w: 19, h: 14, floor: T.FLOOR_STONE, wall: T.WALL_STONE },
  int_store: { kind: 'store', name: 'Ashvale Trading Post', w: 19, h: 14, floor: T.FLOOR_WOOD, wall: T.WALL_WOOD },
  int_apothecary: { kind: 'apothecary', name: "Sable's Apothecary", w: 17, h: 13, floor: T.FLOOR_WOOD, wall: T.WALL_WOOD },
  int_hall: { kind: 'hall', name: 'Ashvale Moot Hall', w: 23, h: 16, floor: T.FLOOR_STONE, wall: T.WALL_STONE },
  int_chapel: { kind: 'chapel', name: 'Chapel of the Last Light', w: 17, h: 17, floor: T.FLOOR_STONE, wall: T.WALL_STONE },
  int_farm: { kind: 'farm', name: 'Fallow Farmhouse', w: 19, h: 13, floor: T.FLOOR_WOOD, wall: T.WALL_WOOD },
};

const defaultSpec = (name: string): InteriorSpec => ({ kind: 'cottage', name, w: 15, h: 12, floor: T.FLOOR_WOOD, wall: T.WALL_WOOD });

const prop = (map: GameMap, tx: number, ty: number, art: string, o: Partial<PropInstance> = {}) => {
  map.props.push({ art, x: tx * TILE + TILE / 2, y: ty * TILE + TILE, ...o });
};

function dress(map: GameMap, spec: InteriorSpec, rng: RNG, id: string) {
  const { w, h } = spec;
  const cx = Math.floor(w / 2);

  // hearth on the back wall for every interior
  prop(map, 2, 2, 'forge', { cw: 30, ch: 14, light: 200, lightColor: '#e8763a' });
  prop(map, w - 3, 1, 'bookshelf', { cw: 34, ch: 12 });

  switch (spec.kind) {
    case 'home':
      prop(map, w - 3, 4, 'bed', { cw: 30, ch: 40, interact: 'bed', label: 'Sleep until morning' });
      prop(map, 2, 6, 'chest', { cw: 24, ch: 14, interact: 'storage', label: 'Open your storage chest' });
      prop(map, cx, 5, 'rug', { flat: true });
      prop(map, cx, 7, 'table', { cw: 40, ch: 14 });
      prop(map, cx - 2, 8, 'chair', { cw: 16, ch: 10 });
      prop(map, cx + 2, 8, 'chair', { cw: 16, ch: 10 });
      prop(map, 3, 3, 'barrel', { cw: 16, ch: 10 });
      prop(map, w - 2, 8, 'weapon_rack', { cw: 24, ch: 10 });
      prop(map, 2, h - 3, 'crate', { cw: 18, ch: 12 });
      break;
    case 'inn':
      for (let i = 0; i < 3; i++) {
        prop(map, 4 + i * 6, 6, 'table', { cw: 40, ch: 14 });
        prop(map, 3 + i * 6, 7, 'chair', { cw: 16, ch: 10 });
        prop(map, 6 + i * 6, 7, 'chair', { cw: 16, ch: 10 });
      }
      for (let i = 0; i < 3; i++) {
        prop(map, 4 + i * 6, 11, 'table', { cw: 40, ch: 14 });
        prop(map, 3 + i * 6, 12, 'chair', { cw: 16, ch: 10 });
      }
      prop(map, w - 5, 3, 'table', { cw: 40, ch: 14 });
      for (let i = 0; i < 4; i++) prop(map, w - 7 + i, 2, 'barrel', { cw: 16, ch: 10 });
      prop(map, w - 3, 8, 'bed', { cw: 30, ch: 40, interact: 'inn_bed', label: 'Rent a room (20 gold)' });
      prop(map, w - 3, 13, 'bed', { cw: 30, ch: 40 });
      prop(map, cx, h - 3, 'rug', { flat: true });
      for (const [tx, ty] of [[1, 5], [1, 11], [w - 2, 5], [w - 2, 12]]) prop(map, tx, ty, 'torch', { light: 170, lightColor: '#f6bf5d', cw: 6, ch: 4 });
      break;
    case 'smithy':
      prop(map, 4, 3, 'anvil', { cw: 26, ch: 12, interact: 'anvil', label: 'Use the anvil' });
      prop(map, 7, 3, 'grindstone', { cw: 24, ch: 12 });
      prop(map, w - 4, 4, 'weapon_rack', { cw: 28, ch: 10 });
      prop(map, w - 7, 4, 'weapon_rack', { cw: 28, ch: 10 });
      for (let i = 0; i < 4; i++) prop(map, 3 + i * 3, h - 3, 'crate', { cw: 18, ch: 12 });
      prop(map, 2, h - 4, 'barrel', { cw: 16, ch: 10 });
      break;
    case 'store':
      for (let i = 0; i < 4; i++) prop(map, 3 + i * 4, 4, 'crate', { cw: 18, ch: 12 });
      for (let i = 0; i < 4; i++) prop(map, 3 + i * 4, 6, 'barrel', { cw: 16, ch: 10 });
      prop(map, cx, 9, 'table', { cw: 40, ch: 14 });
      prop(map, w - 3, 8, 'bookshelf', { cw: 34, ch: 12 });
      prop(map, 2, 9, 'sack', { cw: 16, ch: 10 });
      prop(map, 4, 10, 'sack', { cw: 16, ch: 10 });
      break;
    case 'apothecary':
      prop(map, 4, 4, 'alchemy_table', { cw: 38, ch: 12 });
      prop(map, 8, 4, 'cauldron', { cw: 24, ch: 12, light: 90, lightColor: '#8fbf4a' });
      prop(map, w - 4, 4, 'bookshelf', { cw: 34, ch: 12 });
      for (let i = 0; i < 5; i++) prop(map, 3 + i * 2, h - 3, 'mushroom_cluster');
      break;
    case 'hall':
      prop(map, cx, 3, 'table', { cw: 40, ch: 14 });
      prop(map, cx, h - 4, 'rug', { flat: true });
      for (let i = 0; i < 4; i++) {
        prop(map, 3 + i * 4, 5, 'chair', { cw: 16, ch: 10 });
        prop(map, 3 + i * 4, 9, 'chair', { cw: 16, ch: 10 });
      }
      prop(map, 2, 2, 'banner', { cw: 8, ch: 4 });
      prop(map, w - 3, 2, 'banner', { cw: 8, ch: 4 });
      prop(map, w - 4, 6, 'bookshelf', { cw: 34, ch: 12 });
      for (const [tx, ty] of [[1, 4], [1, 10], [w - 2, 4], [w - 2, 10]]) prop(map, tx, ty, 'torch', { light: 170, lightColor: '#f6bf5d', cw: 6, ch: 4 });
      break;
    case 'chapel':
      prop(map, cx, 3, 'shrine', { cw: 24, ch: 12, light: 220, lightColor: '#ffe9a8', interact: 'shrine', label: 'Pray at the altar' });
      prop(map, cx, 5, 'altar', { cw: 36, ch: 14 });
      for (let i = 0; i < 4; i++) {
        prop(map, cx - 3, 8 + i * 2, 'chair', { cw: 16, ch: 10 });
        prop(map, cx + 3, 8 + i * 2, 'chair', { cw: 16, ch: 10 });
      }
      for (const [tx, ty] of [[2, 4], [w - 3, 4], [2, h - 4], [w - 3, h - 4]]) prop(map, tx, ty, 'brazier', { light: 190, lightColor: '#ffe9a8', cw: 12, ch: 8 });
      break;
    case 'farm':
      prop(map, w - 3, 4, 'bed', { cw: 30, ch: 40 });
      prop(map, cx, 6, 'table', { cw: 40, ch: 14 });
      prop(map, cx - 2, 7, 'chair', { cw: 16, ch: 10 });
      for (let i = 0; i < 4; i++) prop(map, 3 + i * 3, h - 3, 'sack', { cw: 16, ch: 10 });
      prop(map, 2, 4, 'hay', { cw: 26, ch: 12 });
      break;
    default:
      prop(map, w - 3, 3, 'bed', { cw: 30, ch: 40 });
      prop(map, 3, 5, 'table', { cw: 40, ch: 14 });
      prop(map, 3, 6, 'chair', { cw: 16, ch: 10 });
      prop(map, cx, h - 4, 'rug', { flat: true });
      prop(map, w - 3, h - 4, 'crate', { cw: 18, ch: 12 });
      if (rng.bool(0.5)) prop(map, 2, 3, 'barrel', { cw: 16, ch: 10 });
      break;
  }

  // wall sconces
  for (let tx = 3; tx < w - 2; tx += 5) prop(map, tx, 1, 'torch', { light: 160, lightColor: '#f6bf5d', cw: 6, ch: 4 });
  void id;
}

export function buildInterior(id: string, name: string, returnX: number, returnY: number): GameMap {
  const spec = SPECS[id] ?? defaultSpec(name);
  const rng = new RNG(`interior:${id}`);
  const map = createMap({
    id,
    name: spec.name,
    kind: 'interior',
    w: spec.w,
    h: spec.h,
    music: 'village',
    outdoor: false,
    darkness: 0.74,
  });

  fillRect(map, 0, 0, spec.w, spec.h, spec.wall);
  fillRect(map, 1, 1, spec.w - 2, spec.h - 2, spec.floor);
  // doorway at the bottom centre
  const dx = Math.floor(spec.w / 2);
  setTile(map, dx, spec.h - 1, spec.floor);
  setTile(map, dx, spec.h - 2, spec.floor);

  dress(map, spec, rng, id);

  map.portals.push({
    x: dx * TILE - 12,
    y: (spec.h - 1) * TILE - 4,
    w: 32,
    h: 36,
    to: 'overworld',
    tx: returnX,
    ty: returnY,
    label: 'Step outside',
    kind: 'door',
  });

  buildPropGrid(map);
  return map;
}

/** Spawn point for the player when entering this interior. */
export function interiorEntry(map: GameMap): { x: number; y: number } {
  return { x: Math.floor(map.w / 2) * TILE + TILE / 2, y: (map.h - 3) * TILE };
}
