/** Focused rules/runtime checks: no world generation, browser or raster buffers. */
import assert from 'node:assert/strict';
import { AEGEAN_ISLAND_ECOLOGY, AEGEAN_SEA_PACKS, AEGEAN_RARE_SPECIES, AEGEAN_SEA_ENCOUNTERS, pickAegeanSpecies } from '../src/data/aegean/ecology';
import { AEGEAN_ISLANDS, AEGEAN_WAYSTONES } from '../src/data/aegean/world';
import { AEGEAN_ACTIVITIES } from '../src/data/aegean/progression';
import { AEGEAN_ACTIVITY_SCENES } from '../src/data/aegean/activityScenes';
import { ENEMY_BY_ID } from '../src/data/enemies';
import { NavalSystem } from '../src/game/aegean/naval';
import { AegeanActivities } from '../src/game/aegean/activities';
import { AegeanHazards, aegeanHazardPhase, aegeanTrapContacts, aegeanTrapTouches, AEGEAN_TRAPS, AEGEAN_VORTEX, type AegeanGroundHazard } from '../src/game/aegean/hazards';
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
// The same sparse physical source controls art and hit contact. Entering an
// already active trap is harmless until its full warning has been seen.
const map = createMap({ id: 'overworld', name: 'hazard-fixture', w: 1920, h: 1088 });
map.tiles.fill(T.AEGEAN_GRASS); map.regions = new Uint8Array(map.tiles.length); map.regions.fill(13); map.landmasses = new Uint8Array(map.tiles.length); map.landmasses.fill(1);
let hits = 0;
const game = { map, now: 0, player: { x: 1100 * 32, y: 980 * 32, hp: 1000, shield: 0, maxHp: 1000, statuses: [] }, naval: { aboard: false }, damagePlayer: () => { hits++; }, fx: { ring: noop } } as unknown as Game;
const hazards = new AegeanHazards(game);
const probe = hazards as unknown as { ground: AegeanGroundHazard[]; refresh: () => void; seaPulse: number; whirlpool?: { x: number; y: number; until: number }; updateSea: (dt: number) => void };
hazards.update(.1);
assert(probe.ground.length > 0 && probe.ground.length < 25, 'A few tangible mechanisms punctuate natural ground');
const trap = probe.ground[0];
game.player.x = trap.x + Math.cos(trap.phase) * 34; game.player.y = trap.y + Math.sin(trap.phase) * 34;
const time = (cycle: number, t: number) => cycle * AEGEAN_TRAPS.cycle + t - trap.phase;
game.now = time(10, 5.9); hazards.update(.1);
assert.equal(hits, 0, 'A previously unseen active trap cannot instantly damage the player');
const warn = (cycle: number) => { for (let tick = 0; tick < 15; tick++) { game.now = time(cycle, 3.6 + tick * .1); hazards.update(.1); } };
warn(11); game.now = time(11, 5.9); hazards.update(.1); hazards.update(.1);
assert.equal(hits, 1, 'One physical contact lands once per eruption');
assert.equal(game.player.statuses.length, 0, 'A dodged/blocked contact never roots the player');
game.player.x += AEGEAN_TRAPS.cellSize; probe.refresh(); game.player.x -= AEGEAN_TRAPS.cellSize; probe.refresh(); hazards.update(.1);
assert.equal(hits, 1, 'Crossing a simulation cell never resets an eruption hit receipt');
warn(12); game.now = time(12, 5.9);
game.damagePlayer = () => { hits++; game.player.hp -= 50; }; hazards.update(.1);
assert.equal(hits, 2, 'A later warned eruption can land again');
assert(game.player.statuses.some(status => status.kind === 'chill'), 'A connected root strike briefly slows');
game.canvas = { width: 800, height: 600 } as HTMLCanvasElement;
game.camera = { x: game.player.x + 2000, y: game.player.y, zoom: 2, shake: 0 };
warn(13); game.now = time(13, 5.9); hazards.update(.1);
assert.equal(hits, 2, 'Offscreen mechanisms neither arm nor damage');
game.camera.x = game.player.x; hazards.update(.1);
assert.equal(hits, 2, 'Bringing an active source onscreen does not skip its warning');
for (const kind of ['roots', 'vent', 'rockfall', 'gaze', 'lightning', 'thorns', 'spears', 'tide', 'song'] as const) {
  const h = { ...trap, kind }, contacts = aegeanTrapContacts(h, .5);
  assert(contacts.length, `${kind}: physical attack has contact geometry`);
  for (const c of contacts) assert(aegeanTrapTouches(h, .5, c.x2, c.y2), `${kind}: visible object tip really collides`);
  assert(!aegeanTrapTouches(h, .5, h.x + 160, h.y + 160), `${kind}: no distant field damage`);
}
assert(Array.from({ length: 36 }, (_, n) => n * Math.PI / 18).some(a => !aegeanTrapTouches(trap, .5, trap.x + Math.cos(a) * 60, trap.y + Math.sin(a) * 60)), 'Roots leave real safe gaps between physical branches');
// A long game clock and repeated map/embark resets cannot summon a whirlpool.
map.tiles.fill(T.AEGEAN_SEA);
game.naval = { aboard: true, danger: 3, state: { heading: 0 }, nearestPort: () => undefined, definition: { hull: 1000 }, damage: noop } as unknown as Game['naval'];
game.toast = noop; game.now = 90000; hazards.reset();
assert.equal(probe.seaPulse, AEGEAN_VORTEX.firstDelay);
for (let t = 0; t < 100; t++) { game.now++; probe.updateSea(1); }
assert.equal(probe.whirlpool, undefined, 'No vortex in the first hundred seconds of open-water sailing');
hazards.reset(); assert.equal(probe.seaPulse, 10, 'Changing maps keeps the voyage cooldown instead of triggering a spawn');
for (let t = 0; t < 10; t++) { game.now++; probe.updateSea(1); }
assert(probe.whirlpool, 'Rare whirlpool remains available after the sailing delay');
assert(probe.seaPulse >= AEGEAN_VORTEX.minDelay && probe.seaPulse <= AEGEAN_VORTEX.maxDelay);
const before = probe.seaPulse; game.naval.aboard = false; game.now++; hazards.update(1);
assert.equal(probe.seaPulse, before, 'Time ashore cannot age the next whirlpool');
assert.equal(AEGEAN_VORTEX.hullPerSecond, .085);
assert.deepEqual(AEGEAN_SEA_ENCOUNTERS.maxAlive, [1, 2, 3, 3, 4]);
for (const [danger, interval] of AEGEAN_SEA_ENCOUNTERS.interval.entries()) assert(interval >= (16 - danger * 2.5) * 1.5, 'Fewer ship encounters at every danger tier');
const choices = ['aegean_satyr', 'aegean_manticore'];
const rarePicks = Array.from({ length: 1000 }, (_, n) => pickAegeanSpecies(choices, n / 1000)).filter(id => AEGEAN_RARE_SPECIES.has(id)).length;
assert(rarePicks > 150 && rarePicks < 200, 'Apex species are rare encounters, not half of patrols');
// Leaving the helm cancels the actual pending strike, so a boarding fight
// cannot return the ship into a now-expired, unseen storm attack.
const ship = new NavalSystem(game);
const shipProbe = ship as unknown as { strikes: { x: number; y: number; at: number }[] };
ship.state.selected = 'aegean_stormbreaker'; ship.state.aboard = true;
game.naval = ship; game.enemies = [{ x: game.player.x, y: game.player.y, def: { id: 'aegean_telchine' } }] as Game['enemies'];
game.touch = noop; game.autosave = noop; game.recoverSavedPosition = () => true;
game.setMap = (id: string) => { map.id = id; };
ship.buildDeck = noop; ship.populateDeck = noop;
shipProbe.strikes = [{ x: game.player.x, y: game.player.y, at: game.now + 1 }];
assert(ship.enterDeck(), 'A nearby sea enemy permits boarding');
assert.equal(shipProbe.strikes.length, 0, 'Boarding immediately cancels pending lightning');
game.now += 20; game.enemies = [];
assert(ship.returnHelm(), 'Clearing the boarders permits returning');
assert.equal(shipProbe.strikes.length, 0, 'No expired lightning follows the player back to sea');
shipProbe.strikes = [{ x: game.player.x, y: game.player.y, at: game.now - 1 }];
map.id = 'aegean_ship_deck'; ship.update(.1);
assert.equal(shipProbe.strikes.length, 0, 'Map departure also cancels strikes when boarding state is stale');
console.log('Active Aegean passed: distinct rosters, rarer apex/sea threats, physical trap contact, full visible warnings, rare voyage-timed whirlpools, playable challenges and functional halls.');
