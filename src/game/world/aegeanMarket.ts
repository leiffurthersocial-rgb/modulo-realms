import { buildPropGrid, createMap, fillRect, setTile, type GameMap, type PropInstance } from './map';
import { T, TILE } from './tiles';

/** Thyra's public caravan hall uses the same doors, traders and stash as town. */
export function buildAegeanMarket(id: string, returnX: number, returnY: number): GameMap | undefined {
  if (id !== 'int_aegean_thyra_market') return;
  const map = createMap({ id, name: 'The Gate Market', kind: 'interior', w: 25, h: 18,
    outdoor: false, darkness: 0, music: 'village', parent: 'aegean_thyra' });
  const put = (x: number, y: number, art: string, extra: Partial<PropInstance> = {}) =>
    map.props.push({ art, x: x * TILE + 16, y: y * TILE + 32, ...extra });
  fillRect(map, 0, 0, map.w, map.h, T.MARBLE_WALL);
  fillRect(map, 1, 1, map.w - 2, map.h - 2, T.MARBLE);
  for (const y of [2, 15]) fillRect(map, 2, y, 21, 1, T.BRONZE_FLOOR);
  setTile(map, 12, 17, T.MARBLE);
  setTile(map, 12, 16, T.MARBLE);
  // Lysandra stands at (10,6), with a customer-facing counter inside talk range.
  for (const x of [10, 12]) put(x, 6.5, 'table', { cw: 40, ch: 14 });
  for (const [x, y] of [[3,4], [5,4], [17,4], [20,4], [3,8], [21,8]])
    put(x, y, x % 2 ? 'barrel' : 'crate', { cw: 20, ch: 12 });
  put(7, 4, 'aegean_amphora', { cw: 14, ch: 8 });
  put(18, 8, 'aegean_basket');
  put(19, 8, 'sack');
  put(10, 3, 'bookshelf', { cw: 32, ch: 12 });
  put(14, 3, 'aegean_vines');
  for (const x of [2, 22]) put(x, 2, 'torch', { cw: 6, ch: 4, light: 175, lightColor: '#eac681' });
  for (const x of [5, 19]) put(x, 11, 'aegean_column', { cw: 18, ch: 10 });
  put(12, 13, 'rug', { flat: true });
  put(8, 13, 'bench', { cw: 38, ch: 12 });
  put(16, 13, 'chest', { cw: 24, ch: 14, interact: 'storage', label: 'Open your storage chest' });
  put(4, 12, 'notice_board', { interact: 'notice', label: 'Read the caravan noticeboard' });
  put(20, 12, 'signpost', { interact: 'sign', label: 'Read the market directory', data: {
    text: 'Gate Market — caravan provisions and trade. Speak to Lysandra at the counter to buy or sell. The town inn, forge and trading post stand around the square; the blue waystone outside opens return travel.',
  } });
  map.portals.push({ x: 12*TILE - 12, y: 17*TILE - 4, w: 32, h: 36,
    to: 'overworld', tx: returnX, ty: returnY, label: 'Return to Thyra square', kind: 'door' });
  buildPropGrid(map);
  return map;
}
