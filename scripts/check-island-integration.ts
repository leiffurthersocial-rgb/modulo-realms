/** Real item-use and pickup paths, without a browser or world generation. */
import assert from 'node:assert/strict';
import { Player } from '../src/game/player/player';
import { makeItem } from '../src/game/items/loot';
import type { Game as GameType } from '../src/game/core/game';

const noop = () => {};
const context = new Proxy({}, { get: (_target, key) => key === 'measureText' ? () => ({ width: 0 }) : noop });
Object.assign(globalThis, { window: Object.assign(new EventTarget(), { setTimeout: noop }), document: { createElement: () => ({ getContext: () => context }) } });
const { Game } = await import('../src/game/core/game');
const player = new Player({ name: 'Island recovery', race: 'human', cls: 'warrior', hairIndex: 0, skinIndex: 0, hairStyle: 'short', beard: 'none' });
player.level = 100;
let region = 'aegean_asterion';
const rings: number[] = [], labels: string[] = [];
const game = Object.assign(Object.create(Game.prototype), {
  player, now: 100, encounters: { isPractice: false }, pickups: [], pickupId: 0,
  regionAtPlayer: () => region, touch: noop, toast: noop,
  fx: { spawn: noop, ring: (_x: number, _y: number, radius: number) => rings.push(radius) },
  flashScreen: noop, freeze: noop, shake: noop,
  floatText: (_x: number, _y: number, label: string) => labels.push(label),
}) as GameType;

for (const id of ['elixir_grand', 'potion_health_s', 'food_bread', 'antidote', 'aegean_ambrosia']) {
  player.cooldowns = {};
  const first = makeItem(id, { qty: 2, plain: true });
  const alternate = makeItem('elixir_grand', { qty: 2, plain: true });
  player.inventory = [first, alternate];
  player.hp = 1;
  game.useItem(first.uid);
  assert(player.hp > 1, `${id}: first heal works`);
  assert.equal(first.qty, 1);
  assert.equal(player.cooldowns['consume:recovery'], 18);
  player.hp = 1;
  game.useItem(alternate.uid);
  assert.equal(player.hp, 1, `${id}: switching to an old-world elixir cannot bypass recovery`);
  assert.equal(alternate.qty, 2, 'Blocked consumables are not spent');
  player.cooldowns['consume:recovery'] = 0;
  game.useItem(alternate.uid);
  assert.equal(player.hp, player.maxHp, 'Healing works once recovery expires');
}

// Practice retains items but must respect the same combat recovery window.
Object.assign(game.encounters, { isPractice: true });
player.cooldowns = {};
const practicePotion = makeItem('elixir_grand', { qty: 2, plain: true });
player.inventory = [practicePotion];
player.hp = 1;
game.useItem(practicePotion.uid);
assert.equal(practicePotion.qty, 2);
player.hp = 1;
game.useItem(practicePotion.uid);
assert.equal(player.hp, 1);
Object.assign(game.encounters, { isPractice: false });

// Ordinary valley consumables keep their established behavior.
region = 'valley';
player.cooldowns = {};
player.inventory = [makeItem('elixir_grand', { qty: 3, plain: true })];
for (let i = 0; i < 2; i++) {
  player.hp = 1;
  game.useItem(player.inventory[0].uid);
  assert.equal(player.hp, player.maxHp);
}
assert.equal(player.cooldowns['consume:recovery'], undefined);

const royal = makeItem('aegean_kings_dory', { plain: true, provenance: { source: 'debug', id: 'test' } });
game.dropPickup(100, 100, royal, 0);
assert(labels.includes('PRIMORDIAL'), 'The highest rarity announces itself');
assert(rings.includes(320), 'Primordial has its own starlight pickup ring');
assert.equal(game.pickups[0].item, royal);
console.log('Island integration passed: shared recovery, old-elixir bypass, practice, valley compatibility, Primordial pickup.');
