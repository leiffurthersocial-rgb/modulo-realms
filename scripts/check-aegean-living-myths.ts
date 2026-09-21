/** Bounded runtime checks: no full world generation, browser, or server. */
import assert from 'node:assert/strict';
import { AegeanRecovery } from '../src/game/aegean/recovery';
import { AegeanWeaponCombat } from '../src/game/aegean/weapons';
import { nextShipStep, shipGuidanceTarget } from '../src/game/aegean/guidance';
import { AEGEAN_GEAR, AEGEAN_SHIPS } from '../src/data/aegean/content';
import { GREEK_WEAPON_STYLES } from '../src/data/aegean/weapons';
import { AEGEAN_PORTS } from '../src/data/aegean/world';
import { Player } from '../src/game/player/player';
import { Enemy } from '../src/game/entities/enemy';
import { createMap } from '../src/game/world/map';
import { T } from '../src/game/world/tiles';
import { makeItem } from '../src/game/items/loot';
import type { Game as GameType } from '../src/game/core/game';

const noop = () => {};
const context = new Proxy({}, { get: (_target, key) => key === 'measureText' ? () => ({ width: 0 }) : noop });
Object.assign(globalThis, { window: Object.assign(new EventTarget(), { setTimeout: noop }), document: { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } });
const { Game } = await import('../src/game/core/game');
const { AegeanCampaign } = await import('../src/game/aegean/campaign');
const map = createMap({ id: 'aegean_fixture', name: 'Combat fixture', w: 80, h: 80 }); map.tiles.fill(T.MARBLE);
const player = new Player({ name: 'Gameplay test', race: 'human', cls: 'warrior', hairIndex: 0, skinIndex: 0, hairStyle: 'short', beard: 'none' });
player.level = 90; player.x = 800; player.y = 800; player.hp = player.maxHp * .2;
const toasts: Array<{ title: string; sub?: string }> = [];
const game = Object.assign(Object.create(Game.prototype), {
  map, player, now: 100, dt: 1/60, enemies: [], projectiles: [], hitStop: 0,
  aegeanRecovery: new AegeanRecovery(), aegeanHitReceipts: new WeakMap(),
  powers: { onHit: (_enemy: Enemy, amount: number) => amount },
  encounters: { isDamageAllowed: () => true, modifyDamage: (_enemy: Enemy, amount: number) => amount },
  fx: { ring: noop, spawn: noop, telegraph: noop }, floatText: noop, shake: noop, playSound: noop, telegraph: noop,
  regionAtPlayer: () => 'aegean_cyclades', touch: noop, autosave: noop, ringAt: noop,
  toast: (title: string, sub?: string) => toasts.push({ title, sub }),
  killEnemy: (e: Enemy) => { e.dead = true; },
  mapStates: new Map(), quests: { complete: noop }, mapState: () => ({}), trackedQuest: null,
  naval: { aboard: false },
  spawnProjectile(spec: unknown) { this.projectiles.push(spec); },
}) as GameType;
// Real runtime damage and recovery: rejected damage and overkill do not heal.
const e = new Enemy('aegean_hound', 840, 800, 80); e.hp = e.maxHp = 10000; e.defense = 0;
player.equipment.mainHand = makeItem('aegean_hydra_fang', { plain: true });
player.equipment.mainHand.stats.lifesteal = 100;
e.immuneUntil = 1000;
const before = player.hp;
assert.equal(game.damageEnemy(e, 100000), 0);
game.applyHitEffects(e, 100000, false);
assert.equal(player.hp, before, 'Immune enemies pay no healing or hit procs');
e.immuneUntil = 0; e.hp = 2;
assert.equal(game.damageEnemy(e, 100000), 2, 'Returns actual remaining damage, excluding overkill');
assert(player.hp - before <= 2 + 1e-6, 'Healing uses actual damage rather than attack sheet damage');
const recovery = new AegeanRecovery();
let total = 0; for (let i = 0; i < 300; i++) total += recovery.take(10000, 1000, 10);
assert(Math.abs(total - 20) < 1e-6, '300 simultaneous hits share one 2% recovery budget');
assert.equal(recovery.take(10000, 1000, 10), 0);
assert(Math.abs(recovery.take(10000, 1000, 10.1) - 2) < 1e-6);
assert.equal(recovery.take(-100, 1000, 11), 0);
assert.equal(recovery.take(Infinity, 1000, 11), 0);

// Hostile elemental volleys apply ailments only when they actually hurt us.
const originalDamagePlayer = game.damagePlayer;
for (const element of ['poison', 'fire', 'frost', 'shadow'] as const) {
  player.statuses = [];
  game.projectiles = [];
  game.damagePlayer = noop;
  Game.prototype.spawnProjectile.call(game, { x: player.x, y: player.y - 8, angle: 0, speed: 1, damage: 30, radius: 12, range: 100, color: '#fff', element, friendly: false });
  (game as unknown as { updateProjectiles: (dt: number) => void }).updateProjectiles(1/60);
  assert.equal(player.statuses.length, 0, `${element}: dodged/absorbed volleys apply no ailment`);
  game.damagePlayer = () => { player.hp -= 10; };
  Game.prototype.spawnProjectile.call(game, { x: player.x, y: player.y - 8, angle: 0, speed: 1, damage: 30, radius: 12, range: 100, color: '#fff', element, friendly: false });
  (game as unknown as { updateProjectiles: (dt: number) => void }).updateProjectiles(1/60);
  assert.equal(player.statuses.length, 1, `${element}: landed volleys still apply their ailment`);
}
game.damagePlayer = originalDamagePlayer;
player.statuses = [];

// All Greek weapon families use executable distinct basic attacks.
const combat = new AegeanWeaponCombat(game);
const signatures = new Set<string>();
for (const item of AEGEAN_GEAR.filter(item => item.slot === 'mainHand')) {
  const profile = GREEK_WEAPON_STYLES[item.id]; assert(profile, item.id);
  assert.equal(item.stats.attackSpeed, profile.speed);
  player.equipment.mainHand = makeItem(item.id, { plain: true, provenance: { source: 'debug', id: 'living-myths-regression' } });
  game.enemies = []; game.projectiles = []; combat.reset();
  const shapes: unknown[] = [];
  game.telegraph = (_x, _y, radius, duration, _color, shape, angle) => shapes.push({ radius, duration, shape, angle });
  for (let beat = 0; beat < 3; beat++) {
    assert(combat.attack(100, 0, beat === 2));
    game.now += .7; combat.update();
  }
  const shots = game.projectiles.map(p => ({ speed: p.speed, pierce: p.pierce, angle: p.angle, element: p.element, splash: p.splash }));
  signatures.add(JSON.stringify({ shapes, shots }));
}
assert.equal(signatures.size, 18, 'Every Greek weapon produces a different basic attack sequence');
assert(Math.max(...Object.values(GREEK_WEAPON_STYLES).map(p => p.speed)) / Math.min(...Object.values(GREEK_WEAPON_STYLES).map(p => p.speed)) > 4, 'Fast daggers and slow hammers feel meaningfully different');
player.equipment.mainHand = makeItem('sword_iron', { plain: true });
assert.equal(combat.attack(100, 0, false), false, 'Legacy weapons retain their existing attack path');

// Component progression resolves live receipts and actual entry/landing legs.
game.campaign = new AegeanCampaign(game);
const ribs = 'aegean:component:ribs';
assert.equal(nextShipStep(game, ribs)?.adventure, 'aegean_boar');
player.flags.add('aegean:complete:aegean_boar');
assert.equal(nextShipStep(game, ribs)?.adventure, 'aegean_augeas');
player.flags.add('aegean:complete:aegean_augeas');
assert(nextShipStep(game, ribs)?.forge);
player.flags.add(ribs); assert.equal(nextShipStep(game, ribs), null);
game.campaign.trackComponent('aegean:component:sail'); map.id = 'overworld'; game.naval.state = { visitedPorts: [] } as never; game.naval.aboard = true;
const guide = shipGuidanceTarget(game)!;
const port = AEGEAN_PORTS.find(p => p.id === 'aegean_hesperides')!;
assert.equal(guide.x, port.launch.x); assert.equal(guide.y, port.launch.y, 'Sailing guidance ends at the actual pier approach');
game.naval.aboard = false;
assert(shipGuidanceTarget(game)?.name.startsWith('Shipyard · sail from'), 'On foot, an island objective first directs the player to embark');
assert.equal(player.flags.has('aegean:landed'), false, 'Looking at a map never awards a landing');
game.naval.aboard = false; game.campaign.trackComponent('aegean:component:keel'); map.id = 'aegean_asphodel';
map.portals = [{ x: 500, y: 500, w: 30, h: 30, to: 'aegean_persephone', tx: 3, ty: 3, label: 'Persephone’s Garden' }];
assert.equal(shipGuidanceTarget(game)?.name, 'Persephone’s Garden', 'Underworld guidance points to the next real door');
for (const id of AEGEAN_SHIPS.find(s => s.id === 'aegean_stormbreaker')!.requirements)
  assert(game.campaign.has(id) || nextShipStep(game, id), `${id}: usable route exists`);
// Live Game access must preserve discovered Asterion return routes.
player.flags.add('aegean:complete:aegean_army');
game.naval.state.visitedPorts = ['aegean_asterion'];
map.id = 'aegean_leonidas';
assert.equal(game.waystoneAccessReason('aegean_harbour_asterion'), null);
// Rewards name the real items/currencies and storage overflow, including repeats.
map.id = 'aegean_hesperides'; player.inventory = Array.from({ length: 40 }, () => makeItem('sword_iron', { plain: true }));
game.campaign.complete('aegean_hesperides');
const receipt = game.campaign.state.receipts![0];
assert(receipt.lines.some(line => line.includes('gold') && line.includes('XP')));
assert(receipt.lines.some(line => line.includes('Star-Sail')));
assert(toasts.some(t => t.title === 'Sent to storage'));
assert(player.storage.length > 0, 'Full inventory preserves named rewards');
const stored = player.storage.length; game.campaign.complete('aegean_hesperides');
assert.equal(player.storage.length, stored, 'Duplicate completion cannot re-award items');
const saved = game.campaign.snapshot(); game.campaign.restore(saved);
assert.equal(game.campaign.state.trackedComponent, 'aegean:component:keel');
assert.equal(game.campaign.state.receipts![0].title, receipt.title);
console.log('18 distinct weapon patterns, bounded actual-damage recovery, component routes, persistent exact reward receipts passed.');
