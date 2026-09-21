/** Production anvil/reload consistency and the complete inventory rarity ladder. */
import assert from 'node:assert/strict';
import { Player } from '../src/game/player/player';
import { makeItem, refreshFromTemplate } from '../src/game/items/loot';
import { sortInventory } from '../src/game/items/inventory';
import { RARITY_ORDER } from '../src/game/items/types';
import type { Game as GameType } from '../src/game/core/game';

const noop = () => {};
Object.assign(globalThis, {
  window: new EventTarget(),
  document: { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => noop }) }) },
});
const { Game } = await import('../src/game/core/game');
const player = new Player({ name: 'Anvil check', race: 'human', cls: 'warrior', hairIndex: 0, skinIndex: 0, hairStyle: 'short', beard: 'none' });
player.level = 100;
player.gold = 10_000_000;
const game = Object.assign(Object.create(Game.prototype), {
  player, fx: { spawn: noop }, toast: noop, touch: noop,
}) as GameType;
player.inventory = [makeItem('mat_iron_ingot', { plain: true, qty: 100000 })];

for (const id of ['sword_iron', 'unique_remainder', 'unique_floor_of_world', 'armor_frostguard']) {
  const item = makeItem(id, { level: 74, plain: true });
  player.inventory.push(item);
  item.stats.magicFind = 137; // A roll-only key on each of these templates.
  const before = structuredClone(item);
  const cost = game.reforgeCost(item);
  const gold = player.gold;
  const ingots = game.ingotsHeld();
  game.reforge(item.uid);
  assert.equal(item.level, 75);
  for (const key of ['damage', 'defense', 'maxHealth', 'maxMana'] as const) {
    if (before.stats[key] !== undefined)
      assert.equal(item.stats[key], Math.round(before.stats[key]! * 1.11 + 1), `${id}: original forge through level 75`);
  }
  assert.equal(player.gold, gold - cost.gold);
  assert.equal(game.ingotsHeld(), ingots - cost.ingots);
  const uid = item.uid, enchants = structuredClone(item.enchants), effects = [...item.effects];
  // Reproduce an old, heavily forged snapshot at the campaign boundary.
  if (item.stats.damage !== undefined) item.stats.damage *= 10000;
  if (item.stats.defense !== undefined) item.stats.defense *= 10000;
  while (item.level < 115) {
    game.reforge(item.uid);
    const reloaded = refreshFromTemplate(structuredClone(item));
    assert.deepEqual(item.stats, reloaded.stats, `${id}: forging to ${item.level} agrees with loading`);
    assert.equal(item.stats.magicFind, 137, `${id}: rolled extra stat survives`);
    assert.equal(item.uid, uid);
    assert.deepEqual(item.enchants, enchants);
    assert.deepEqual(item.effects, effects);
  }
  const capped = structuredClone(item), cappedGold = player.gold;
  game.reforge(item.uid);
  assert.deepEqual(item, capped, 'The level-115 cap still rejects further forging');
  assert.equal(player.gold, cappedGold);
}

const ordered = RARITY_ORDER.map(rarity => makeItem(
  rarity === 'primordial' ? 'aegean_kings_dory' : rarity === 'olympian' ? 'aegean_artemis_bow' : 'sword_iron',
  { plain: true, rarity, level: rarity === 'common' ? 115 : 100, provenance: { source: 'debug', id: 'rarity-sort-check' } },
));
sortInventory(ordered);
assert.deepEqual(ordered.map(item => item.rarity), [...RARITY_ORDER].reverse(), 'Primordial leads the full rarity ladder, even above higher-level common gear');
const armor = makeItem('armor_frostguard', { plain: true, rarity: 'mythic', level: 115 });
const mixed = [armor, ...ordered];
sortInventory(mixed);
assert.equal(mixed.at(-1)?.uid, armor.uid, 'Equipment categories retain their existing order');
console.log('Endgame reforges match reloads, preserve earned extras, retain original early forging and sort Primordial first.');
