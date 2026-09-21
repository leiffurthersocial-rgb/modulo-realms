import { buildAegeanInterior } from './aegeanInteriors';
import { buildAegeanMarket } from './aegeanMarket';
import { RNG } from '../core/rng';
import { T, TILE } from './tiles';
import { buildPropGrid, createMap, fillRect, setTile, type GameMap, type PropInstance } from './map';

type InteriorKind = 'home' | 'inn' | 'smithy' | 'store' | 'apothecary' | 'hall' | 'chapel' | 'farm' | 'casino' | 'cottage';

interface InteriorSpec {
  kind: InteriorKind;
  name: string;
  w: number;
  h: number;
  floor: number;
  wall: number;
  /**
   * Interiors are lit rooms by design — darkness belongs to dungeons. The one
   * exception is the casino, which is windowless and lit entirely by its own
   * brass: a little ambient shade is what turns the sconces, the slot heads
   * and the cashier's cage into actual pools of light instead of decals.
   */
  dark?: number;
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
  // Smaller than it was (17x13). A gaming room lives on people being close
  // enough to each other to overhear a bad beat; the old floor had eight tiles
  // of empty carpet between the tables and read as a warehouse.
  int_casino: { kind: 'casino', name: 'The Gilded Spade', w: 15, h: 12, floor: T.CASINO_PARQUET, wall: T.WALL_STONE, dark: 0.34 },
};

const defaultSpec = (name: string): InteriorSpec => ({ kind: 'cottage', name, w: 15, h: 12, floor: T.FLOOR_WOOD, wall: T.WALL_WOOD });

const prop = (map: GameMap, tx: number, ty: number, art: string, o: Partial<PropInstance> = {}) => {
  map.props.push({ art, x: tx * TILE + TILE / 2, y: ty * TILE + TILE, ...o });
};

/**
 * The Gilded Spade's gaming floor.
 *
 * Laid out in pixels rather than tiles, because almost nothing in here lines
 * up with a 32px grid: a croupier stands *behind* a table, a patron sits at
 * its near edge, a rope runs between two posts. Tile coordinates would round
 * all of that into a row of objects sitting on stripes, which is exactly what
 * the room used to look like.
 *
 * Reading the floor from the door: the entrance apron and its velvet rope,
 * then the poker table dead ahead with its ring of players, the blackjack
 * table and its croupier to the north-west, the slot bank down the west wall,
 * the bar along the north-east, and the roulette wheel and cashier's cage in
 * the two south corners. Three lanes stay clear of furniture — straight up
 * from the door, and one down each wall.
 */
function dressCasino(map: GameMap, w: number, h: number): void {
  const at = (x: number, y: number, art: string, o: Partial<PropInstance> = {}) => {
    map.props.push({ art, x, y, ...o });
  };
  const cxT = Math.floor(w / 2);

  // Floor: boards wall to wall, one carpet over the middle of them, and a
  // marble apron in the doorway — so the room has a threshold you cross
  // rather than starting on the felt.
  fillRect(map, 2, 1, w - 4, h - 2, T.CASINO_CARPET);
  fillRect(map, cxT - 1, h - 3, 3, 3, T.CASINO_MARBLE);
  // The rug is one authored image, not a tiled material: its gold trim runs
  // unbroken around the edge and mitres at the corners, which a 32px tile can
  // never do without repeating the border inside every single square.
  at(250, 300, 'casino_rug', { flat: true });

  /* ---- cocktail tables, filling the floor between the big games ---- */
  at(146, 196, 'casino_cocktail', { cw: 24, ch: 10, light: 70, lightColor: '#f6bf5d' });
  at(118, 202, 'casino_sit_right_a', { cw: 14, ch: 9, phase: 1.9 });
  at(352, 190, 'casino_cocktail', { cw: 24, ch: 10, light: 70, lightColor: '#f6bf5d', phase: 0.5 });
  at(380, 196, 'casino_sit_left_f', { cw: 14, ch: 9, phase: 0.3 });
  at(288, 150, 'casino_cocktail', { cw: 24, ch: 10, light: 70, lightColor: '#f6bf5d', phase: 1.4 });
  at(316, 156, 'casino_sit_left_d', { cw: 14, ch: 9, phase: 2.4 });
  at(260, 156, 'casino_sit_right_b', { cw: 14, ch: 9, phase: 0.6 });

  /* ---- the back wall ---- */
  at(240, 62, 'casino_portrait', {
    interact: 'sign', label: 'Study the portrait',
    data: {
      title: 'The House',
      text: 'No name on the plate. Whoever sat for it wore the crown like it was borrowed, and kept one hand out of frame.',
    },
  });
  at(144, 60, 'casino_banner', { cw: 8, ch: 4 });
  at(336, 60, 'casino_banner', { cw: 8, ch: 4 });

  /* ---- blackjack, north-west: croupier behind, two players at the near rail */
  at(150, 76, 'casino_croupier');
  at(150, 110, 'card_table', { cw: 64, ch: 16 });
  at(122, 129, 'casino_sit_up_b', { cw: 16, ch: 9 });
  at(178, 129, 'casino_sit_up_c', { cw: 16, ch: 9, phase: 0.9 });

  /* ---- the slot bank, west wall ---- */
  for (let i = 0; i < 3; i++) {
    at(50, 150 + i * 58, 'slot_machine', {
      cw: 22, ch: 12, light: 95, lightColor: '#f6bf5d', phase: i * 0.73,
      interact: 'slots', label: 'Play the slot machine',
    });
  }

  /* ---- the bar, north-east ---- */
  at(392, 66, 'casino_shelf');
  at(392, 86, 'casino_barkeep');
  at(392, 114, 'casino_bar', {
    cw: 74, ch: 16,
    interact: 'sign', label: 'Look over the bar',
    data: {
      title: 'The Bar',
      text: 'Two cordials, a valley brandy and something green nobody orders twice. The house pours free while you are losing.',
    },
  });
  at(362, 133, 'casino_sit_up_f', { cw: 16, ch: 9, phase: 0.4 });
  at(422, 133, 'casino_sit_up_d', { cw: 16, ch: 9, phase: 1.3 });

  /* ---- poker, dead ahead of the door ---- */
  // The seat due south is deliberately empty: that is where the player walks
  // up to read the prompt, and a sitter there would hide the near rail.
  at(224, 224, 'casino_sit_down_a', { cw: 16, ch: 9, phase: 0.2 });
  at(276, 224, 'casino_sit_down_e', { cw: 16, ch: 9, phase: 1.1 });
  at(212, 240, 'casino_smoke');
  at(250, 250, 'poker_table', {
    cw: 66, ch: 20, interact: 'poker', label: 'Sit down at the poker table',
  });
  at(204, 256, 'casino_sit_right_c', { cw: 14, ch: 9, phase: 0.7 });
  at(296, 256, 'casino_sit_left_b', { cw: 14, ch: 9, phase: 1.6 });

  /* ---- roulette, south-west ---- */
  at(104, 300, 'casino_roulette', {
    cw: 44, ch: 14, light: 55, lightColor: '#efe6d6',
    interact: 'sign', label: 'Watch the wheel',
    data: {
      title: 'The Whirligig',
      text: 'Nobody is betting it. Dario spins it because a room with a still wheel in it feels closed.',
    },
  });
  at(104, 318, 'casino_sit_up_e', { cw: 14, ch: 9, phase: 2.1 });

  /* ---- the cashier's cage, south-east ---- */
  at(406, 302, 'casino_cashier', {
    cw: 40, ch: 14, light: 110, lightColor: '#f6bf5d',
    interact: 'sign', label: 'Read the cage notice',
    data: {
      title: "The Cashier's Cage",
      text: 'GOLD IN, CHIPS OUT. THE HOUSE COUNTS TWICE. Below it, in smaller paint: so should you.',
    },
  });
  at(344, 216, 'chip_stack', { cw: 14, ch: 8 });

  /* ---- the entrance ---- */
  at(140, 344, 'casino_rope', { cw: 30, ch: 8 });
  at(340, 344, 'casino_rope', { cw: 30, ch: 8 });
  at(58, 346, 'casino_palm', { cw: 16, ch: 10 });
  at(424, 346, 'casino_palm', { cw: 16, ch: 10 });

  /* ---- brass and candlelight, instead of the generic torch ---- */
  // Each flame gets its own phase: four candles flickering in unison is the
  // single clearest tell that a room is a loop rather than a place.
  const sconces: Array<[number, number, number]> = [
    [190, 58, 0], [292, 58, 0.37], [42, 230, 0.81], [438, 230, 1.24],
  ];
  for (const [x, y, phase] of sconces) {
    at(x, y, 'casino_sconce', { light: 150, lightColor: '#f6bf5d', phase });
  }

  /* ---- small change, lost in the pile ---- */
  const glints: Array<[number, number, number]> = [[164, 300, 0], [330, 268, 0.6], [268, 180, 1.1]];
  for (const [x, y, phase] of glints) at(x, y, 'casino_glint', { flat: true, phase });
}

function dress(map: GameMap, spec: InteriorSpec, rng: RNG, id: string) {
  const { w, h } = spec;
  const cx = Math.floor(w / 2);

  // Hearth on the back wall for every interior that is somebody's home or
  // workplace. The casino is the exception: it is lit by its own signage and
  // an open fire in the corner would fight the room for attention.
  if (spec.kind !== 'casino') {
    prop(map, 2, 2, 'forge', { cw: 30, ch: 14, light: 200, lightColor: '#e8763a' });
    prop(map, w - 3, 1, 'bookshelf', { cw: 34, ch: 12 });
  }

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
    case 'casino':
      dressCasino(map, w, h);
      break;
    default:
      // Every lodge earns its door: somewhere to sleep and the same stash you
      // keep at home, so a settlement is a real forward base.
      prop(map, w - 3, 3, 'bed', { cw: 30, ch: 40, interact: 'bed', label: 'Sleep until morning' });
      prop(map, 2, 6, 'chest', { cw: 24, ch: 14, interact: 'storage', label: 'Open your storage chest' });
      prop(map, 3, 5, 'table', { cw: 40, ch: 14 });
      prop(map, 3, 6, 'chair', { cw: 16, ch: 10 });
      prop(map, cx, h - 4, 'rug', { flat: true });
      prop(map, w - 3, h - 4, 'crate', { cw: 18, ch: 12 });
      if (rng.bool(0.5)) prop(map, 2, 3, 'barrel', { cw: 16, ch: 10 });
      break;
  }

  // wall sconces (the casino places its own, around the banners)
  if (spec.kind !== 'casino') {
    for (let tx = 3; tx < w - 2; tx += 5) prop(map, tx, 1, 'torch', { light: 160, lightColor: '#f6bf5d', cw: 6, ch: 4 });
  }
  void id;
}

export function buildInterior(id: string, name: string, returnX: number, returnY: number): GameMap {
  const market = buildAegeanMarket(id, returnX, returnY);
  if (market) return market;
  const greek = buildAegeanInterior(id, returnX, returnY);
  if (greek) return greek;
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
    darkness: spec.dark ?? 0,
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
