import { createMap, fillRect, buildPropGrid, type GameMap } from "../world/map";
import { T } from "../world/tiles";
/** A shipboard arena uses the player's full class kit, with the sea visible beyond the rails. */
export function createShipDeck(): GameMap {
  const map = createMap({
    id: "aegean_ship_deck",
    name: "The Boarding Deck",
    kind: "dungeon",
    w: 38,
    h: 27,
    outdoor: true,
    darkness: 0.08,
    music: "boss",
    revision: "aegean-deck-v1",
  });
  map.tiles.fill(T.AEGEAN_SEA);
  fillRect(map, 5, 5, 28, 17, T.FLOOR_WOOD);
  fillRect(map, 3, 9, 32, 9, T.FLOOR_WOOD);
  for (const y of [5, 21])
    for (let x = 6; x < 32; x += 3)
      map.props.push({
        art: "aegean_column_broken",
        x: x * 32 + 16,
        y: y * 32 + 16,
        cw: 16,
        ch: 14,
      });
  map.props.push({
    art: "aegean_mooring",
    x: 8 * 32,
    y: 13 * 32,
    interact: "aegean",
    label: "Return to the helm",
    data: { action: "helm" },
  });
  map.props.push({
    art: "aegean_banner",
    x: 18 * 32,
    y: 9 * 32,
    cw: 24,
    ch: 16,
  });
  buildPropGrid(map);
  return map;
}
