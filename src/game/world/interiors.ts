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
  /** The faced back wall, two tiles tall. The casino keeps its own. */
  face?: string;
}

/**
 * Rooms are sized to what is in them. They used to be barns — the inn was
 * 25x18 tiles with nine tables in it — and every one had a forge for a
 * hearth. Now the back wall is two tiles tall and faced (`face`), so there is
 * something to hang a window or a shelf on, and the floor holds a room's
 * worth of furniture rather than a field's.
 */
const SPECS: Record<string, InteriorSpec> = {
  int_home: { kind: 'home', name: 'Your Home', w: 10, h: 8, floor: T.ROOM_PLANK, wall: T.WALL_WOOD, face: 'int_wall_plaster' },
  int_inn: { kind: 'inn', name: 'The Kettle & Crown', w: 15, h: 11, floor: T.ROOM_PLANK, wall: T.WALL_WOOD, face: 'int_wall_plaster' },
  int_smithy: { kind: 'smithy', name: 'Ashvale Forge', w: 11, h: 8, floor: T.ROOM_FLAG, wall: T.WALL_STONE, face: 'int_wall_stone' },
  int_store: { kind: 'store', name: 'Ashvale Trading Post', w: 11, h: 8, floor: T.ROOM_PLANK, wall: T.WALL_WOOD, face: 'int_wall_wood' },
  int_apothecary: { kind: 'apothecary', name: "Sable's Apothecary", w: 10, h: 8, floor: T.ROOM_PLANK, wall: T.WALL_WOOD, face: 'int_wall_plaster' },
  int_hall: { kind: 'hall', name: 'Ashvale Moot Hall', w: 13, h: 10, floor: T.ROOM_FLAG, wall: T.WALL_STONE, face: 'int_wall_stone' },
  int_chapel: { kind: 'chapel', name: 'Chapel of the Last Light', w: 11, h: 11, floor: T.ROOM_FLAG, wall: T.WALL_STONE, face: 'int_wall_stone' },
  int_farm: { kind: 'farm', name: 'Fallow Farmhouse', w: 11, h: 8, floor: T.ROOM_PLANK, wall: T.WALL_WOOD, face: 'int_wall_wood' },
  // Smaller than it was (17x13). A gaming room lives on people being close
  // enough to each other to overhear a bad beat; the old floor had eight tiles
  // of empty carpet between the tables and read as a warehouse.
  int_casino: { kind: 'casino', name: 'The Gilded Spade', w: 15, h: 12, floor: T.CASINO_PARQUET, wall: T.WALL_STONE, dark: 0.34 },
};

const defaultSpec = (name: string): InteriorSpec => ({ kind: 'cottage', name, w: 10, h: 8, floor: T.ROOM_PLANK, wall: T.WALL_WOOD, face: 'int_wall_plaster' });

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
  // Moved off the roulette rail: nobody bets a wheel with no head on it,
  // and a patron sitting there stood squarely in front of the one fixture
  // the room has to make the player walk over and look at.
  at(150, 133, 'casino_sit_up_e', { cw: 16, ch: 9, phase: 2.1 });

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
  // The wheel is laid out broken. Somebody took its head off before the game
  // starts, and the room is built around the hole that leaves: the nameplate
  // says so from across the floor, the art says so up close, and the prompt
  // is the one interaction in the casino that is not a game you can play.
  // `game.applyStoryProps` swaps this for the working wheel once it is fixed,
  // so the repaired state survives a reload without a second layout.
  at(104, 300, 'casino_roulette_broken', {
    cw: 44, ch: 14, light: 30, lightColor: '#8a6a2c',
    interact: 'roulette', label: 'Inspect the damaged wheel',
    nameplate: 'DAMAGED', nameplateColor: '#d9553f',
    data: { station: 'roulette' },
  });

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

/**
 * Furnish a room. The rules the layouts keep to: nothing wider than a tile
 * stands in the outer floor column or on the last floor row (it would clip
 * the side or front wall), counters sit one tile in front of the shelves
 * their keeper sells from, beds put their heads to a wall, and every room
 * has one thing on each side wall so no wall is bare.
 */
function dress(map: GameMap, spec: InteriorSpec, rng: RNG, id: string) {
  const { w, h } = spec;
  const cx = Math.floor(w / 2);
  /** Something on the back wall (drawn over the wall face). */
  const onWall = (tx: number, art: string, o: Partial<PropInstance> = {}) => prop(map, tx, 1, art, o);
  /** Placement in pixels, for the pieces that do not sit on the tile grid. */
  const px = (x: number, ty: number, art: string, o: Partial<PropInstance> = {}) => prop(map, 0, ty, art, { x, ...o });
  const seat = (tx: number, ty: number) => prop(map, tx, ty, 'chair', { cw: 16, ch: 10 });
  const stool = (x: number, ty: number) => px(x, ty, 'int_stool', { cw: 12, ch: 8 });
  const table = (tx: number, ty: number) => prop(map, tx, ty, 'table', { cw: 40, ch: 14 });

  /** Exact placement — x and the prop's foot y in pixels — for pieces snapped into corners. */
  const at = (x: number, y: number, art: string, o: Partial<PropInstance> = {}) => map.props.push({ art, x, y, ...o });
  // a bed with its head to the back wall and its side to the right wall
  const cornerBed = (o: Partial<PropInstance> = {}) => at((w - 1) * TILE - 20, 2 * TILE + 51, 'bed', { cw: 30, ch: 40, ...o });

  switch (spec.kind) {
    case 'home':
      onWall(2, 'int_fireplace', { cw: 52, ch: 10 });
      at(2 * TILE + 16, 2 * TILE + 12, 'int_hearthstone', { flat: true });
      onWall(4, 'int_painting');
      onWall(6, 'int_window');
      cornerBed({ interact: 'bed', label: 'Sleep until morning' });
      at(4 * TILE, 4 * TILE + 30, 'int_rug_green', { flat: true });
      at(4 * TILE, 4 * TILE + 20, 'table', { cw: 40, ch: 14 });
      at(4 * TILE - 32, 4 * TILE + 20, 'int_stool', { cw: 12, ch: 8 }); at(4 * TILE + 32, 4 * TILE + 20, 'int_stool', { cw: 12, ch: 8 });
      at(1 * TILE + 14, 6 * TILE + 24, 'int_plant', { cw: 12, ch: 8 });
      px(1 * TILE + 22, 5, 'barrel', { cw: 16, ch: 10 });
      px(8 * TILE + 12, 5, 'chest', { cw: 24, ch: 14, interact: 'storage', label: 'Open your storage chest' });
      px(1 * TILE + 22, 3, 'int_woodpile', { cw: 28, ch: 8 });
      break;
    case 'inn':
      // hearth and the regular's table on the left, the bar with its bottle
      // shelf and casks on the right, the long table in the middle, beds in
      // a nook at the back right behind a partition of screens
      onWall(3, 'int_fireplace', { cw: 52, ch: 10 });
      at(3 * TILE + 16, 2 * TILE + 12, 'int_hearthstone', { flat: true });
      onWall(6, 'int_window');
      onWall(8, 'int_painting');
      onWall(10, 'int_shelf_jars', { cw: 36, ch: 8 });
      prop(map, 10, 3, 'int_bar', { cw: 92, ch: 6 });
      at(12 * TILE + 28, 3 * TILE + 26, 'int_kegs', { cw: 38, ch: 10 });
      for (const x of [9, 10, 11]) stool(x * TILE + 16, 4);
      table(3, 4); stool(3 * TILE - 18, 4); stool(3 * TILE + 50, 4);
      px(6 * TILE + 16, 7, 'int_rug_long', { flat: true });
      px(6 * TILE + 16, 6, 'int_bench_table', { cw: 80, ch: 10 });
      table(3, 8); stool(3 * TILE - 18, 8); stool(3 * TILE + 50, 8);
      at(11 * TILE + 22, 6 * TILE + 30, 'int_screen', { cw: 40, ch: 8 });
      at(11 * TILE + 22, 7 * TILE + 44, 'int_screen', { cw: 40, ch: 8 });
      at(6 * TILE + 16, 2 * TILE + 26, 'int_side_table', { cw: 30, ch: 6 });
      at(13 * TILE + 12, 6 * TILE + 28, 'bed', { cw: 30, ch: 40, interact: 'inn_bed', label: 'Rent a bed (20 gold)' });
      at(13 * TILE + 12, 8 * TILE + 28, 'bed', { cw: 30, ch: 40 });
      px(1 * TILE + 20, 6, 'int_plant', { cw: 12, ch: 8 });
      px(1 * TILE + 22, 9, 'barrel', { cw: 16, ch: 10 });
      break;
    case 'smithy':
      onWall(6, 'int_tool_wall');
      onWall(9, 'int_window');
      px(2 * TILE + 8, 2, 'int_forge', { cw: 64, ch: 14, light: 200, lightColor: '#e8763a' });
      at(2 * TILE + 8 + 52, 2 * TILE + 28, 'int_bellows', { cw: 26, ch: 8 });
      at(1 * TILE + 18, 3 * TILE + 24, 'int_coals', { cw: 26, ch: 8 });
      prop(map, 5, 4, 'anvil', { cw: 26, ch: 12, interact: 'anvil', label: 'Use the anvil' });
      prop(map, 7, 4, 'int_quench', { cw: 26, ch: 10 });
      at((w - 1) * TILE - 16, 2 * TILE + 30, 'grindstone', { cw: 24, ch: 12 });
      at((w - 1) * TILE - 16, 4 * TILE + 30, 'int_armor_stand', { cw: 20, ch: 8 });
      at((w - 1) * TILE - 16, 6 * TILE + 20, 'weapon_rack', { cw: 24, ch: 10 });
      px(1 * TILE + 22, 6, 'int_crates', { cw: 28, ch: 10 });
      px(3 * TILE + 8, 6, 'barrel', { cw: 16, ch: 10 });
      break;
    case 'store':
      onWall(2, 'int_window');
      onWall(4, 'int_shelf_goods', { cw: 36, ch: 8 });
      onWall(6, 'int_shelf_goods', { cw: 36, ch: 8 });
      onWall(8, 'int_window');
      prop(map, 5, 3, 'int_counter_store', { cw: 60, ch: 6 });
      // dry goods down the left wall, crates and casks down the right
      px(1 * TILE + 20, 3, 'barrel', { cw: 16, ch: 10 });
      at(1 * TILE + 34, 3 * TILE + 34, 'sack', { cw: 16, ch: 10 });
      at(1 * TILE + 18, 4 * TILE + 18, 'sack', { cw: 16, ch: 10 });
      at((w - 1) * TILE - 18, 2 * TILE + 38, 'int_crates', { cw: 28, ch: 10 });
      at((w - 1) * TILE - 18, 4 * TILE + 30, 'barrel_stack', { cw: 26, ch: 12 });
      at((w - 1) * TILE - 14, 6 * TILE + 22, 'int_plant', { cw: 12, ch: 8 });
      px(5 * TILE + 16, 5, 'int_rug_green', { flat: true });
      px(3 * TILE + 8, 6, 'int_display_table', { cw: 46, ch: 8 });
      break;
    case 'apothecary':
      onWall(2, 'int_shelf_jars', { cw: 36, ch: 8 });
      onWall(5, 'int_herbs');
      onWall(7, 'int_shelf_jars', { cw: 36, ch: 8 });
      px(4 * TILE + 16, 3, 'int_counter_apoth', { cw: 60, ch: 6 });
      px(5 * TILE + 24, 2, 'int_side_table', { cw: 30, ch: 6 });
      px(7 * TILE + 16, 4, 'int_cauldron_fire', { cw: 26, ch: 10 });
      at((w - 1) * TILE - 24, 6 * TILE + 24, 'alchemy_table', { cw: 40, ch: 12 });
      at(1 * TILE + 32, 6 * TILE + 24, 'int_planter_bench', { cw: 56, ch: 8 });
      at(3 * TILE + 12, 6 * TILE + 22, 'int_plant', { cw: 12, ch: 8 });
      break;
    case 'hall':
      // the king's chair on a dais against the back wall, the council table
      // before it, the runner from the door to the table
      onWall(3, 'int_window');
      onWall(5, 'int_sconce');
      onWall(7, 'int_sconce');
      onWall(9, 'int_window');
      at(6 * TILE + 16, 3 * TILE + 24, 'int_dais', { flat: true });
      prop(map, 6, 2, 'int_throne', { cw: 28, ch: 8 });
      px(4 * TILE + 8, 3, 'int_candles', { cw: 8, ch: 6 });
      px(8 * TILE + 24, 3, 'int_candles', { cw: 8, ch: 6 });
      at(6 * TILE + 16, 5 * TILE + 26, 'int_long_table', { cw: 144, ch: 10 });
      for (const x of [4, 6, 8]) { at(x * TILE + 16, 5 * TILE + 4, 'chair', { cw: 16, ch: 6 }); at(x * TILE + 16, 5 * TILE + 44, 'chair', { cw: 16, ch: 10 }); }
      at(6 * TILE + 16, 9 * TILE + 12, 'int_runner_short', { flat: true });
      at(1 * TILE + 22, 4 * TILE + 30, 'bookshelf', { cw: 34, ch: 12 });
      at((w - 1) * TILE - 28, 4 * TILE + 30, 'int_map_table', { cw: 46, ch: 10 });
      at(1 * TILE + 20, 7 * TILE + 28, 'banner', { cw: 8, ch: 4 });
      at((w - 1) * TILE - 16, 7 * TILE + 28, 'banner', { cw: 8, ch: 4 });
      at((w - 1) * TILE - 18, 2 * TILE + 44, 'int_armor_stand', { cw: 20, ch: 8 });
      at(2 * TILE + 16, 8 * TILE + 24, 'chest', { cw: 24, ch: 14 });
      break;
    case 'chapel':
      onWall(2, 'int_sconce');
      onWall(5, 'int_rose_window');
      onWall(8, 'int_sconce');
      at(5 * TILE + 16, 3 * TILE + 26, 'int_dais', { flat: true });
      prop(map, 5, 3, 'int_altar', { cw: 54, ch: 10, interact: 'shrine', label: 'Pray at the altar' });
      at(3 * TILE + 26, 3 * TILE + 16, 'int_lectern', { cw: 14, ch: 6 });
      for (const y of [5 * TILE + 20, 6 * TILE + 30, 8 * TILE + 8]) {
        at(3 * TILE, y, 'int_pew', { cw: 60, ch: 8 });
        at(8 * TILE, y, 'int_pew', { cw: 60, ch: 8 });
      }
      at(5 * TILE + 16, 4 * TILE + 26 + 96, 'int_runner', { flat: true });
      at(5 * TILE + 16, 4 * TILE + 26 + 170, 'int_runner', { flat: true });
      at(1 * TILE + 20, 9 * TILE + 20, 'int_plant', { cw: 12, ch: 8 });
      at(9 * TILE + 12, 9 * TILE + 20, 'int_plant', { cw: 12, ch: 8 });
      break;
    case 'farm':
      onWall(2, 'int_fireplace', { cw: 52, ch: 10 });
      at(2 * TILE + 16, 2 * TILE + 12, 'int_hearthstone', { flat: true });
      onWall(5, 'int_herbs');
      onWall(7, 'int_window');
      cornerBed();
      at(4 * TILE - 2, 2 * TILE + 24, 'int_woodpile', { cw: 28, ch: 8 });
      at(5 * TILE, 4 * TILE + 32, 'int_bench_table', { cw: 80, ch: 10 });
      // pantry corner
      px(1 * TILE + 18, 4, 'int_churn', { cw: 12, ch: 8 });
      px(1 * TILE + 20, 5, 'sack', { cw: 16, ch: 10 });
      px(1 * TILE + 22, 6, 'barrel', { cw: 16, ch: 10 });
      px(2 * TILE + 14, 6, 'int_basket', { cw: 20, ch: 8 });
      at((w - 1) * TILE - 20, 5 * TILE + 30, 'int_spinning_wheel', { cw: 24, ch: 8 });
      at((w - 1) * TILE - 50, 5 * TILE + 30, 'int_stool', { cw: 12, ch: 8 });
      break;
    case 'casino':
      dressCasino(map, w, h);
      break;
    default:
      // Every lodge earns its door: somewhere to sleep and the same stash you
      // keep at home, so a settlement is a real forward base.
      onWall(2, 'int_fireplace', { cw: 52, ch: 10 });
      onWall(5, 'int_window');
      prop(map, 7, 3, 'bed', { cw: 30, ch: 40, interact: 'bed', label: 'Sleep until morning' });
      px(8 * TILE + 8, 5, 'chest', { cw: 24, ch: 14, interact: 'storage', label: 'Open your storage chest' });
      px(3 * TILE + 16, 5, 'int_rug_green', { flat: true });
      table(3, 4); seat(3, 5);
      px(1 * TILE + 22, 6, 'int_crates', { cw: 28, ch: 10 });
      if (rng.bool(0.5)) px(1 * TILE + 22, 3, 'barrel', { cw: 16, ch: 10 });
      void cx;
      break;
  }
  void id; void h;
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
  // a faced room loses its first floor row to the back wall
  const top = spec.face ? 2 : 1;
  fillRect(map, 1, top, spec.w - 2, spec.h - 1 - top, spec.floor);
  if (spec.face) for (let tx = 1; tx < spec.w - 1; tx++) prop(map, tx, 1, spec.face, { flat: true });
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
