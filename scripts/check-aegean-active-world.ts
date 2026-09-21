/** Focused rules/runtime checks: no world generation, browser or raster buffers. */
import assert from 'node:assert/strict';
import { AEGEAN_ISLAND_ECOLOGY, AEGEAN_SEA_PACKS } from '../src/data/aegean/ecology';
import { AEGEAN_ISLANDS, AEGEAN_WAYSTONES } from '../src/data/aegean/world';
import { AEGEAN_ACTIVITIES } from '../src/data/aegean/progression';
import { AEGEAN_ACTIVITY_SCENES } from '../src/data/aegean/activityScenes';
import { ENEMY_BY_ID } from '../src/data/enemies';
import { AegeanActivities } from '../src/game/aegean/activities';
import { AegeanHazards, aegeanHazardPhase } from '../src/game/aegean/hazards';
import { buildAegeanInterior } from '../src/game/world/aegeanInteriors';
import { createMap } from '../src/game/world/map';
import { T } from '../src/game/world/tiles';
import type { Game } from '../src/game/core/game';
const noop = () => undefined;
const context = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop: noop }) : key === 'measureText' ? () => ({ width: 0 }) : noop, set: () => true });
globalThis.document = { createElement: () => ({ getContext: () => context }) } as unknown as Document;
assert.equal(AEGEAN_ISLANDS.length, Object.keys(AEGEAN_ISLAND_ECOLOGY).length);
const rosters = new Set<string>();
for (const island of AEGEAN_ISLANDS) {
  const ecology = AEGEAN_ISLAND_ECOLOGY[island.id];
  assert(ecology && ecology.enemies.length >= 3, `${island.id}: its own complete ecology`);
  for (const id of ecology.enemies) assert(ENEMY_BY_ID[id], `${island.id}: real creature ${id}`);
  rosters.add([...ecology.enemies].sort().join(','));
}
assert.equal(rosters.size, AEGEAN_ISLANDS.length, 'No two islands share the same creature roster');
const sea = new Set(AEGEAN_SEA_PACKS.flat());
assert(sea.size >= 8, 'The sea has a broad native bestiary');
for (const id of sea) assert(ENEMY_BY_ID[id]);
assert(AEGEAN_WAYSTONES.some(s => s.id === 'aegean_leonidas' && s.requiredPort === 'aegean_asterion' && s.requiresArmy));
assert(AEGEAN_ACTIVITIES.every(a => a.steps.every(s => s.type !== 'puzzle')), 'No new activity requires memorising a three-button sequence');
for (const a of AEGEAN_ACTIVITIES) for (const s of a.steps) if (['channel', 'strike', 'race', 'dodge'].includes(s.type)) assert(AEGEAN_ACTIVITY_SCENES[a.id].objects.length >= s.count);
assert.equal(aegeanHazardPhase(3.6, 0).warning, true);
assert.equal(aegeanHazardPhase(5.5, 0).active, true);
assert.equal(aegeanHazardPhase(0, 0).active, false);
for (const town of ['nemean_hearth', 'potamoi', 'delphi', 'aigialos', 'sparta', 'ember_quay', 'kymene']) {
  const hall = buildAegeanInterior(`int_aegean_${town}_hall`, 123, 456)!;
  assert(hall, `${town}: landmark building is enterable`);
  assert.equal(hall.portals[0].tx, 123); assert.equal(hall.portals[0].ty, 456);
  for (const action of ['rest', 'shop', 'storage', 'forge']) assert(hall.props.some(p => p.data?.action === action));
}
// Real action update: movement and held position complete scenes; E alone does not.
for (const a of AEGEAN_ACTIVITIES) for (const [stageIndex, action] of a.steps.entries()) {
  if (!['channel', 'strike', 'race', 'dodge'].includes(action.type)) continue;
  const id = a.id, map = createMap({ id: a.map ?? 'overworld', name: 'fixture', w: 40, h: 40 });
  map.tiles.fill(T.GRASS);
  for (let index = 0; index <= 3; index++) map.props.push({ art: 'aegean_bell', x: 400 + index * 110, y: 400, label: `target ${index}`, data: { activity: id, index, movement: 'foot' } });
  const player = { x: 400, y: 400, attackTimer: 0, hp: 1000, maxHp: 1000, flags: new Set<string>() };
  let damage = 0;
  const game = { map, player, now: 0, enemies: [], toast: noop, touch: noop, floatText: noop, telegraph: noop, fx: { ring: noop }, damagePlayer: () => { damage++; }, autosave: noop, completeAegean: noop, campaign: { has: () => false, requirements: () => [], recordReward: noop }, quests: { completed: [], get: () => ({ progress: [] }), accept: noop, complete: noop } } as unknown as Game;
  const system = new AegeanActivities(game);
  // Start on the same step ID used by old saves, with fresh transient pressure.
  system.state.active = id;
  system.state.runs[id] = { id, step: stageIndex, progress: 0, visited: [], timer: 0, started: true, wave: 1, sequence: [] };
  system.interact(map.props[1]);
  assert.equal(system.state.runs[id].progress, 0, `${id}: clicking E cannot solve an action challenge`);
  for (let index = 1; index <= 3; index++) {
    player.x = map.props[index].x;
    const ticks = action.type === 'race' ? 1 : 27;
    for (let tick = 0; tick < ticks && system.state.runs[id]?.step === stageIndex; tick++) {
      game.now += .1;
      player.attackTimer = tick % 2 ? 0 : .5;
      system.update(.1);
    }
  }
  if (stageIndex + 1 === a.steps.length) assert.equal(system.state.active, null, `${id}: final physical stage pays its reward`);
  else {
    assert.equal(system.state.runs[id].step, stageIndex + 1, `${id}: its physical verb completes the stage`);
    assert.equal(system.state.runs[id].progress, 0);
  }
  void damage;
}
// A trap lands once per eruption, then resets on the next cycle.
const map = createMap({ id: 'overworld', name: 'hazard-fixture', w: 1920, h: 1088 });
map.tiles.fill(T.AEGEAN_GRASS); map.regions = new Uint8Array(map.tiles.length); map.regions.fill(13); map.landmasses = new Uint8Array(map.tiles.length); map.landmasses.fill(1);
let hits = 0;
const game = { map, now: 0, player: { x: 1100 * 32, y: 980 * 32, hp: 1000, shield: 0, maxHp: 1000, statuses: [] }, naval: { aboard: false }, damagePlayer: () => { hits++; }, fx: { ring: noop } } as unknown as Game;
const hazards = new AegeanHazards(game);
const probe = hazards as unknown as { ground: { id: string; x: number; y: number; phase: number }[]; refresh: () => void };
hazards.update(.1);
assert(probe.ground.length > 0, 'Dangerous natural ground creates nearby legible traps');
const trap = probe.ground[0]; game.player.x = trap.x; game.player.y = trap.y; game.now = 5.5 - trap.phase;
hazards.update(.1); hazards.update(.1);
assert.equal(hits, 1, 'One eruption never causes per-frame damage spam');
assert.equal(game.player.statuses.length, 0, 'A dodged/blocked hit never roots the player');
game.player.x += 320; probe.refresh(); game.player.x -= 320; probe.refresh(); hazards.update(.1);
assert.equal(hits, 1, 'Crossing a simulation cell does not reset an eruption hit receipt');
game.now += 6.8;
game.damagePlayer = () => { hits++; game.player.hp -= 50; };
hazards.update(.1);
assert.equal(hits, 2, 'A later eruption can damage again');
assert(game.player.statuses.some(status => status.kind === 'chill'), 'A connected root strike briefly slows');
console.log('Active Aegean passed: distinct island rosters, native sea threats, 4 playable challenge verbs, gated royal waystones, useful enterable halls, telegraphed hazards.');
