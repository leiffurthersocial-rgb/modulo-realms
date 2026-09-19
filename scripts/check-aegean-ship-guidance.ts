/** Source receipts and port approach geometry only: no generated world or DOM. */
import assert from 'node:assert/strict';
import { AEGEAN_RECIPES, AEGEAN_REWARDS, AEGEAN_SHIPS } from '../src/data/aegean/content';
import { AEGEAN_SHIPBUILDING_SOURCES } from '../src/data/aegean/shipbuilding';
import { AEGEAN_ADVENTURE_BY_ID, AEGEAN_PORTS } from '../src/data/aegean/world';
import { NavalSystem } from '../src/game/aegean/naval';
import type { Game } from '../src/game/core/game';
import { createMap } from '../src/game/world/map';
import { T } from '../src/game/world/tiles';

const stormbreaker = AEGEAN_SHIPS.find((s) => s.id === 'aegean_stormbreaker')!;
for (const requirement of stormbreaker.requirements) {
  const source = AEGEAN_SHIPBUILDING_SOURCES[requirement];
  assert(source?.steps.length, `${requirement}: shipwright supplies directions before the player has earned it`);
  for (const step of source.steps) if (step.proof)
    assert(AEGEAN_ADVENTURE_BY_ID[step.proof], `${requirement}: completion status uses an actual adventure receipt`);
}
const ribs = AEGEAN_SHIPBUILDING_SOURCES['aegean:component:ribs'];
assert.equal(ribs.recipe, AEGEAN_RECIPES.find((r) => r.flag === 'aegean:component:ribs'), 'Displayed cost and materials come from the live forging recipe');
assert.deepEqual(ribs.steps.flatMap((s) => s.proof ? [s.proof] : []).sort(), [...ribs.recipe!.requires].sort(), 'Rib directions include every required labour');
assert(AEGEAN_REWARDS.aegean_hesperides.flags?.includes('aegean:component:sail'), 'The named Hesperides trial actually awards the sail');
assert(AEGEAN_REWARDS.aegean_cerberus.flags?.includes('aegean:component:keel'), 'The named Cerberus trial actually awards the keel');
assert.equal(AEGEAN_ADVENTURE_BY_ID.aegean_cerberus.surfaceMap, 'aegean_hades', 'Keel directions use the actual Cerberus entrance');
assert(AEGEAN_PORTS.some((p) => p.id === 'aegean_hesperides' && p.island), 'Sail directions name a real island landing');

const map = createMap({ id: 'overworld', name: 'Port geometry fixture', w: 1920, h: 1088 });
map.tiles.fill(T.AEGEAN_SEA);
const flags = new Set<string>();
const player = { x: 0, y: 0, flags };
const game = { map, player, campaign: { has: (id: string) => flags.has(id) } } as unknown as Game;
const naval = new NavalSystem(game);
naval.state.aboard = true;
for (const port of AEGEAN_PORTS) {
  for (const point of [naval.mooringPoint(port), port.launch]) {
    Object.assign(player, point);
    const guide = naval.landingGuide()!;
    assert.equal(guide.port.id, port.id, `${port.name}: the prompt names the pier being approached`);
    assert(guide.inRange, `${port.name}: both actual docking approaches advertise landing`);
    assert.equal(guide.distance, 0);
    assert.equal(naval.nearestPort(170)?.id, port.id, 'Landing display agrees with the existing mooring geometry');
  }
}
const crete = AEGEAN_PORTS.find((p) => p.id === 'aegean_crete')!;
player.x = crete.launch.x + 256;
player.y = crete.launch.y;
const offshore = naval.landingGuide()!;
assert.equal(offshore.port.id, crete.id);
assert.equal(offshore.direction, 'west', 'The direction points to the actual harbour approach');
assert.equal(offshore.distance, 256, 'HUD and compass share world-pixel distance');
assert.deepEqual(offshore.approach, crete.launch);
assert(!offshore.inRange, 'Offshore instructions do not promise landing before the ship is close enough');
assert.equal(naval.nearestPort(170), undefined);
assert.deepEqual(naval.state.visitedPorts, [], 'Reading directions never fabricates an island landing');
assert.equal(flags.size, 0, 'Reading component and port directions awards no progression');

const released = AEGEAN_PORTS.find((p) => p.id === 'aegean_last_shore')!;
assert.match(naval.landingReason(released)!, /Three Hundred/, 'The military harbour names its real obstacle');
flags.add('aegean_army');
assert.equal(naval.landingReason(released), null);
const asterion = AEGEAN_PORTS.find((p) => p.id === 'aegean_asterion')!;
assert.match(naval.landingReason(asterion)!, /Stormbreaker/, 'Asterion still requires the storm ship');
naval.state.selected = stormbreaker.id;
for (const flag of stormbreaker.requirements) flags.add(flag);
assert.equal(naval.landingReason(asterion), null);
naval.state.aboard = false;
assert.equal(naval.landingGuide(), undefined, 'On foot the sailing compass does not replace normal quest navigation');
naval.state.aboard = true;
map.id = 'aegean_deck';
assert.equal(naval.landingGuide(), undefined, 'The boarding deck has no fictional sea-port prompt');
console.log('Shipbuilding sources and all 20 harbour approach directions passed.');
