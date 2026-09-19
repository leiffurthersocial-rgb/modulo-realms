import { AEGEAN_WAYSTONES } from '../../data/aegean/world';
import { TILE } from '../world/tiles';

export interface AegeanWaypointContext {
  visitedPorts: readonly string[];
  armyDefeated: boolean;
  aboard?: boolean;
}

const byId = new Map(AEGEAN_WAYSTONES.map((stone) => [stone.id, stone]));

export function aegeanWaystoneDestination(siteId: string):
  { mapId: string; x: number; y: number } | undefined {
  const stone = byId.get(siteId);
  return stone && {
    mapId: stone.mapId,
    x: stone.tx * TILE + TILE / 2,
    y: (stone.ty + 1) * TILE + 40,
  };
}

/** A discovery is earned on foot; the sea journey and army still happen once. */
export function aegeanWaystoneAccess(siteId: string, context: AegeanWaypointContext): string | null {
  const stone = byId.get(siteId);
  if (!stone) return null;
  if (context.aboard) return 'Dock and step ashore before using a waystone.';
  if (stone.requiresArmy && !context.armyDefeated)
    return 'Defeat the Three Hundred to open the Released Harbour.';
  if (stone.requiredPort && !context.visitedPorts.includes(stone.requiredPort))
    return 'Reach this island by ship and dock there first.';
  return null;
}

/** Uses the real destination map: seeing Taenarum is not visiting all of Hades. */
export function aegeanWaystonesInReach(
  mapId: string, x: number, y: number, context: AegeanWaypointContext,
) {
  return AEGEAN_WAYSTONES.filter((stone) => {
    if (stone.mapId !== mapId || aegeanWaystoneAccess(stone.id, context)) return false;
    const dx = x - (stone.tx + .5) * TILE;
    const dy = y - (stone.ty + 1) * TILE;
    return dx * dx + dy * dy < (stone.radius * TILE) ** 2;
  });
}

/**
 * Existing saves retain their discoveries. Add the new destinations using
 * those receipts without replaying discovery XP or opening unseen locations.
 * An Underworld stone is earned inside its own map, even if its surface
 * entrance was already found before this update.
 */
export function aegeanEarnedWaystones(
  discovered: ReadonlySet<string>, context: AegeanWaypointContext,
): string[] {
  return AEGEAN_WAYSTONES.filter((stone) => {
    if (stone.mapId !== 'overworld' || aegeanWaystoneAccess(stone.id, context)) return false;
    if (discovered.has(stone.id)) return true;
    // Docking predates the harbour's new LocationDef and is direct evidence
    // that this shore has been reached, independent of map-reveal radius.
    if (!stone.id.startsWith('aegean_harbour_')) return false;
    const portId = `aegean_${stone.id.slice('aegean_harbour_'.length)}`;
    return context.visitedPorts.includes(portId);
  }).map((stone) => stone.id);
}
