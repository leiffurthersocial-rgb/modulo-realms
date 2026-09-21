import type { Game } from '../core/game';
import { AEGEAN_ADVENTURE_BY_ID, AEGEAN_LOCATIONS, AEGEAN_PORTS, AEGEAN_WAYSTONES, AEGEAN_ISLANDS } from '../../data/aegean/world';
import { AEGEAN_SHIPBUILDING_SOURCES } from '../../data/aegean/shipbuilding';
import { TILE } from '../world/tiles';

export interface ShipStep {
  requirement: string;
  action: string;
  destination: string;
  tx: number;
  ty: number;
  adventure?: string;
  forge?: boolean;
}
/** Resolve from real receipts, never from discovery or an inventory name. */
export function nextShipStep(game: Game, requirement: string): ShipStep | null {
  if (game.campaign.has(requirement)) return null;
  const source = AEGEAN_SHIPBUILDING_SOURCES[requirement];
  if (!source) return null;
  const proof = source.steps.find(s => s.proof && !game.campaign.has(s.proof))?.proof;
  if (proof) {
    const a = AEGEAN_ADVENTURE_BY_ID[proof];
    if (!a) return null;
    let surface = a;
    let parent = a.surfaceMap;
    while (parent && parent !== 'overworld') {
      const loc = AEGEAN_LOCATIONS.find(l => l.id === parent);
      if (!loc) break;
      surface = { ...surface, tx: loc.tx, ty: loc.ty };
      parent = loc.surfaceMap;
    }
    const actions: Record<string, string> = {
      aegean_boar: 'Trap the charging boar', aegean_augeas: 'Clear the flooded estate',
      aegean_hesperides: 'Carry the sky through the garden', aegean_cerberus: 'Restrain Cerberus',
      aegean_army: 'Defeat the Three Hundred', aegean_bull: 'Capture the Cretan Bull',
    };
    return { requirement, action: actions[proof] ?? `Complete ${a.name}`, destination: a.name,
      tx: surface.tx, ty: surface.ty, adventure: proof };
  }
  if (source.recipe) {
    const towns = AEGEAN_LOCATIONS.filter(l => l.kind === 'village');
    const town = towns.reduce((best, t) => Math.hypot(t.tx * TILE - game.player.x, t.ty * TILE - game.player.y) <
      Math.hypot(best.tx * TILE - game.player.x, best.ty * TILE - game.player.y) ? t : best);
    return { requirement, action: 'Forge Bronze Storm Ribs', destination: `${town.name} forge`, tx: town.tx + 7, ty: town.ty + 3, forge: true };
  }
  return null;
}

/** Each leg aims at a real door or harbour, including all Underworld layers. */
export function shipGuidanceTarget(game: Game): { x: number; y: number; name: string } | null {
  const tracked = game.campaign.state.trackedComponent;
  if (!tracked) return null;
  const step = nextShipStep(game, tracked);
  const map = game.map;
  const massAt = (x: number, y: number) => map.landmasses?.[Math.floor(y / TILE) * map.w + Math.floor(x / TILE)] || 1;
  const playerMass = massAt(game.player.x, game.player.y);
  const portMass = (id: string) => AEGEAN_ISLANDS.find(i => `aegean_${i.id}` === id)?.landmass ?? 1;
  const availablePorts = AEGEAN_PORTS.filter(p => !p.gate || (p.gate === 'army' ? game.campaign.has('aegean_army') : game.naval.state.visitedPorts.includes(p.id)));
  const nearestPort = (onFoot: boolean) => availablePorts.filter(p => !onFoot || portMass(p.id) === playerMass)
    .sort((a, b) => Math.hypot(a.land.x - game.player.x, a.land.y - game.player.y) - Math.hypot(b.land.x - game.player.x, b.land.y - game.player.y))[0];
  if (!step && map.id === 'overworld') {
    const port = nearestPort(!game.naval.aboard);
    return port ? { ...(game.naval.aboard ? port.launch : port.land), name: `Shipwright · ${port.name}` } : null;
  }
  if (step?.forge) {
    const forge = map.props.filter(p => p.interact === 'aegean' && p.data?.action === 'forge' && (map.id !== 'overworld' || massAt(p.x, p.y) === playerMass))
      .sort((a, b) => Math.hypot(a.x - game.player.x, a.y - game.player.y) - Math.hypot(b.x - game.player.x, b.y - game.player.y))[0];
    if (forge) return { x: forge.x, y: forge.y, name: 'Anvil · forge Storm Ribs' };
  }
  if (map.id === step?.adventure) return null; // encounter cues take over
  if (map.id !== 'overworld') {
    const route: string[] = [];
    let id = step?.adventure;
    while (id) {
      route.unshift(id);
      id = AEGEAN_LOCATIONS.find(l => l.id === id)?.surfaceMap;
      if (id === 'overworld') break;
    }
    route.unshift('overworld');
    const idx = route.indexOf(map.id);
    const door = (idx >= 0 ? map.portals.find(p => p.to === route[idx + 1]) : undefined)
      ?? map.portals.find(p => p.to === map.parent || p.to === 'overworld') ?? map.portals[0];
    return door ? { x: door.x + door.w / 2, y: door.y + door.h / 2, name: door.label || 'Follow the marked doorway' } : null;
  }
  if (!step) return null;
  const requiredPort = AEGEAN_WAYSTONES.find(w => w.id === step.adventure)?.requiredPort;
  const targetMass = requiredPort ? portMass(requiredPort) : massAt(step.tx * TILE, step.ty * TILE);
  if (!game.naval.aboard && targetMass !== playerMass) {
    const departure = nearestPort(true);
    if (departure) {
      const moored = game.naval.mooredPort?.id === departure.id;
      return { ...(moored ? game.naval.boardingPoint(departure) : departure.land),
        name: moored ? `Board ship · ${departure.name}` : `Shipyard · sail from ${departure.name}` };
    }
  }
  if (game.naval.aboard) {
    const port = AEGEAN_PORTS.find(p => p.id === requiredPort) ?? AEGEAN_PORTS.filter(p => !p.island && !p.gate)
      .sort((a, b) => Math.hypot(a.tx - step.tx, a.ty - step.ty) - Math.hypot(b.tx - step.tx, b.ty - step.ty))[0];
    if (port) return { ...port.launch, name: `Land: ${port.name}` };
  }
  return { x: step.tx * TILE, y: step.ty * TILE, name: step.action };
}
