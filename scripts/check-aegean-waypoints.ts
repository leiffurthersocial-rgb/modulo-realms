import assert from 'node:assert/strict';
import { AEGEAN_ADVENTURES, AEGEAN_LOCATIONS, AEGEAN_PORTS, AEGEAN_UNDERWORLD_IDS, AEGEAN_WAYSTONES } from '../src/data/aegean/world';
import { WAYSTONE_SITES } from '../src/data/locations';
import { aegeanEarnedWaystones, aegeanWaystoneAccess, aegeanWaystoneDestination, aegeanWaystonesInReach } from '../src/game/aegean/waypoints';

const fresh = { visitedPorts: [] as string[], armyDefeated: false, aboard: false };
const ids = new Set(AEGEAN_WAYSTONES.map((stone) => stone.id));
assert.equal(ids.size, AEGEAN_WAYSTONES.length, 'Every waystone has one stable save identity');
assert.ok(ids.size >= 50, 'The doubled world has a substantial return network');
for (const loc of AEGEAN_LOCATIONS.filter((loc) => loc.kind === 'village')) {
  assert.ok(ids.has(loc.id), `${loc.id}: every Greek town has a stone`);
}
for (const adventure of AEGEAN_ADVENTURES.filter((a) => !a.surfaceMap && a.region !== 'aegean_asterion')) {
  assert.ok(ids.has(adventure.id), `${adventure.id}: every ordinary surface dungeon has a stone`);
}
for (const port of AEGEAN_PORTS.filter((p) => p.id !== 'aegean_asterion')) {
  assert.ok(ids.has(`aegean_harbour_${port.id.slice(7)}`), `${port.id}: harbour coverage`);
}
assert.ok(!ids.has('aegean_leonidas') && !ids.has('aegean_harbour_asterion'), 'The storm island stays sea-only');
for (const stone of AEGEAN_WAYSTONES)
  assert.ok(WAYSTONE_SITES.some((loc) => loc.id === stone.id), `${stone.id}: original travel menu knows it`);

const army = aegeanWaystoneDestination('aegean_army')!;
assert.equal(aegeanWaystoneAccess('aegean_army', fresh), null, 'The army entrance is available before victory');
assert.ok(aegeanWaystonesInReach(army.mapId, army.x, army.y, fresh).some((s) => s.id === 'aegean_army'));
assert.ok(aegeanWaystoneAccess('aegean_harbour_last_shore', fresh), 'The released military harbour requires the army');
assert.equal(aegeanWaystoneAccess('aegean_harbour_last_shore', { ...fresh, armyDefeated: true }), null);

const kymene = aegeanWaystoneDestination('aegean_kymene')!;
assert.ok(aegeanWaystoneAccess('aegean_kymene', fresh));
assert.ok(!aegeanWaystonesInReach(kymene.mapId, kymene.x, kymene.y, { ...fresh, aboard: true }).some((s) => s.id === 'aegean_kymene'), 'Sailing past cannot attune an island');
const docked = { ...fresh, visitedPorts: ['aegean_kymene', 'aegean_crete'] };
assert.equal(aegeanWaystoneAccess('aegean_kymene', docked), null);
assert.equal(aegeanWaystoneAccess('aegean_minotaur', docked), null);
assert.ok(aegeanWaystoneAccess('aegean_medusa', docked), 'One island receipt cannot unlock another island');
assert.ok(aegeanWaystonesInReach(kymene.mapId, kymene.x, kymene.y, docked).some((s) => s.id === 'aegean_kymene'));

for (const id of AEGEAN_UNDERWORLD_IDS) {
  const destination = aegeanWaystoneDestination(id)!;
  assert.equal(destination.mapId, id, `${id}: arriving in the actual Underworld hub`);
  assert.ok(!aegeanWaystonesInReach('overworld', destination.x, destination.y, fresh).some((s) => s.id === id));
  assert.ok(aegeanWaystonesInReach(id, destination.x, destination.y, fresh).some((s) => s.id === id));
}
const previousDiscovery = new Set(['ashvale', 'aegean_thyra', 'aegean_nemea', 'aegean_acheron', 'aegean_minotaur', 'aegean_medusa']);
const earned = aegeanEarnedWaystones(previousDiscovery, docked);
assert.ok(earned.includes('aegean_thyra') && earned.includes('aegean_nemea'), 'Previous mainland exploration is honoured');
assert.ok(earned.includes('aegean_harbour_crete') && earned.includes('aegean_harbour_kymene'), 'Actual old landings unlock their new harbour stones');
assert.ok(earned.includes('aegean_minotaur') && !earned.includes('aegean_medusa'));
assert.ok(!earned.includes('aegean_acheron'), 'Seeing the descent does not count as visiting the Underworld');
assert.deepEqual([...previousDiscovery], ['ashvale', 'aegean_thyra', 'aegean_nemea', 'aegean_acheron', 'aegean_minotaur', 'aegean_medusa'], 'Receipt reconciliation does not mutate discovery or pay XP');
const stored = JSON.parse(JSON.stringify({ discovered: [...previousDiscovery], waystones: ['ashvale', ...earned], visitedPorts: docked.visitedPorts }));
assert.deepEqual(aegeanEarnedWaystones(new Set(stored.discovered), { ...fresh, visitedPorts: stored.visitedPorts }), earned, 'Save-shaped discovery and landing receipts reconstruct the same network');
assert.equal(aegeanWaystoneDestination('ashvale'), undefined, 'Legacy arrival geometry remains in the original code');
console.log(`Aegean waypoints passed: ${ids.size} destinations, all towns/ordinary dungeon mouths/harbours, five map-aware Underworld hubs, prior discoveries retained, first sea crossings preserved.`);
