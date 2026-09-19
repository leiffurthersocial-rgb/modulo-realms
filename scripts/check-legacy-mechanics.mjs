/** Compare production mechanics to the actual pre-expansion Git source.
 * No map generation, browser, server or disk checkout. Run this serially:
 * node scripts/check-legacy-mechanics.mjs
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';

const BASE = 'd39d75a';
const noop = () => {};
const context = new Proxy({ imageSmoothingEnabled: false }, {
  get: (target, key) => key in target ? target[key] : key === 'measureText' ? () => ({ width: 0 })
    : key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop: noop }) : noop,
  set: (target, key, value) => { target[key] = value; return true; },
});
const canvas = () => Object.assign(new EventTarget(), {
  width: 800, height: 600, style: {}, getContext: () => context,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
});
Object.assign(globalThis, {
  window: Object.assign(new EventTarget(), { setTimeout: () => 0, clearTimeout: noop }),
  document: Object.assign(new EventTarget(), { createElement: () => canvas() }),
});
const entry = `
export { Game } from './src/game/core/game.ts';
export { Player } from './src/game/player/player.ts';
export { Enemy } from './src/game/entities/enemy.ts';
export { ALL_ENEMIES } from './src/data/enemies.ts';
export { createMap } from './src/game/world/map.ts';
export { RNG } from './src/game/core/rng.ts';
export { ALL_TEMPLATES } from './src/data/items.ts';
export * as loot from './src/game/items/loot.ts';
`;
async function load(frozen) {
  const result = await build({
    stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true,
    platform: 'node', format: 'esm', write: false, logLevel: 'warning',
    plugins: frozen ? [{ name: 'original-game-source', setup(b) {
      b.onResolve({ filter: /^\./ }, (a) => ({
        path: posix.normalize(posix.join(a.importer ? posix.dirname(a.importer) : '', a.path.endsWith('.ts') ? a.path : `${a.path}.ts`)),
        namespace: 'original',
      }));
      b.onLoad({ filter: /.*/, namespace: 'original' }, (a) => ({
        contents: execFileSync('git', ['show', `${BASE}:${a.path}`], { encoding: 'utf8' }), loader: 'ts',
      }));
    } }] : [],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const original = await load(true);
const current = await load(false);
const playerInit = { name: 'Mechanics parity', race: 'human', cls: 'warrior', hairIndex: 0, skinIndex: 0, hairStyle: 'short', beard: 'none' };
const view = (item) => ({
  name: item.name, defId: item.defId, level: item.level, rarity: item.rarity,
  stats: item.stats, value: item.value, enchants: item.enchants, effects: item.effects, enchantSlots: item.enchantSlots,
});
function make(mod, id, options = {}) { return mod.loot.makeItem(id, { rng: new mod.RNG(49173), ...options }); }
let cases = 0;
for (const template of original.ALL_TEMPLATES) {
  for (const plain of [false, true]) {
    assert.deepEqual(view(make(current, template.id, { plain })), view(make(original, template.id, { plain })), `Original loot changed: ${template.id}, plain=${plain}`);
    cases++;
  }
}
for (const level of [1, 24, 75, 83, 110]) {
  for (const rarity of ['common', 'rare', 'superRare', 'epic', 'legendary']) {
    assert.deepEqual(view(make(current, 'sword_iron', { level, rarity })), view(make(original, 'sword_iron', { level, rarity })), `Rarity/level ladder changed: ${level}/${rarity}`);
    cases++;
  }
}
const samples = ['sword_iron', ...['offHand', 'armor', 'accessory'].map((slot) => original.ALL_TEMPLATES.find((t) => t.slot === slot && t.rarity !== 'mythic').id)];
function forgeSequence(mod, id) {
  const game = new mod.Game(canvas());
  game.player = new mod.Player(playerInit);
  game.player.level = 75;
  game.player.gold = 10_000_000;
  game.player.bossesKilled = new Set(['one', 'two', 'three', 'four']);
  const item = make(mod, id, { level: 24, rarity: 'rare' });
  game.player.inventory = [item, make(mod, 'mat_iron_ingot', { qty: 1000, plain: true })];
  const stages = [];
  for (let i = 0; i < 3; i++) {
    game.reforge(item.uid);
    stages.push({ item: structuredClone(view(item)), gold: game.player.gold, ingots: game.ingotsHeld() });
  }
  for (let i = 0; i < 2; i++) {
    game.royalElevate(item.uid);
    stages.push({ item: structuredClone(view(item)), warrants: game.player.warrantsUsed });
  }
  item.stats.luck = 137; // A rolled extra stat must survive template refresh.
  item.value += 12345; // Reload has never repriced a player's original items.
  mod.loot.refreshFromTemplate(item);
  stages.push({ item: structuredClone(view(item)) });
  game.input.detach();
  return stages;
}
const savedRandom = Math.random;
try {
  Math.random = () => 0.314159;
  for (const id of samples) assert.deepEqual(forgeSequence(current, id), forgeSequence(original, id), `Forge/crown/load changed: ${id}`);
  function ability(mod, cls, id) {
    const game = new mod.Game(canvas());
    game.player = new mod.Player({ ...playerInit, cls });
    game.player.level = 75;
    game.player.hp = 1;
    game.player.mp = game.player.maxMp;
    game.player.sp = game.player.maxSp;
    game.aimAngle = () => 0;
    game.aimPoint = () => ({ x: 0, y: 0 });
    game.rollDamage = () => ({ dmg: 10000, crit: false });
    game.damageEnemy = noop;
    game.applyHitEffects = noop;
    game.enemies = Array.from({ length: 4 }, () => ({ x: game.player.x, y: game.player.y, radius: 15, dead: false, friendly: false }));
    const index = game.player.abilities.findIndex((a) => a.id === id);
    assert(index >= 0);
    game.useAbility(index);
    const result = { hp: game.player.hp, mp: game.player.mp, sp: game.player.sp, cooldowns: game.player.cooldowns, zones: game.groundZones };
    game.input.detach();
    return result;
  }
  assert.deepEqual(ability(current, 'necromancer', 'drain'), ability(original, 'necromancer', 'drain'), 'Life Siphon changed');
  assert.deepEqual(ability(current, 'ranger', 'rain'), ability(original, 'ranger', 'rain'), 'Arrow Rain changed');
  function bossAttack(mod, id, attackId) {
    const game = new mod.Game(canvas());
    game.player = new mod.Player(playerInit);
    game.player.level = 75;
    game.player.x = 420; game.player.y = 400;
    game.map = mod.createMap({ id: 'overworld', name: 'Combat parity', w:64,h:64 });
    game.map.tiles.fill(4);
    const e = new mod.Enemy(id, 400, 400, 75);
    e.phase = 0;
    const calls = [];
    for (const method of ['damagePlayer','spawnProjectile','summon','ringAt','particles','shake','playSound'])
      game[method] = (...args) => { calls.push([method,...args]); };
    e.windupAttack = e.def.boss.attacks.find(a => a.id === attackId);
    e.resolveBossAttack(game);
    game.input.detach();
    return { calls, x:e.x,y:e.y,attackCd:e.attackCd,bossCooldowns:e.bossCooldowns };
  }
  for (const def of original.ALL_ENEMIES.filter(e => e.boss)) {
    for (const attack of def.boss.attacks)
      assert.deepEqual(bossAttack(current,def.id,attack.id),bossAttack(original,def.id,attack.id),`Original boss attack changed: ${def.id}/${attack.id}`);
  }

} finally { Math.random = savedRandom; }

// A historical migration receipt may repair an untouched item, never a later upgrade.
const item = make(current, 'sword_iron', { level: 75, rarity: 'epic' });
const previousStats = { ...item.stats, luck: 77 };
const previousValue = item.value + 456;
const receipt = { uid: item.uid, previousStats, previousValue, currentStats: { ...item.stats }, currentValue: item.value, legacyRollsEstimated: true };
item.curve = { version: 2, affixes: [], reforges: 0 };
const upgraded = structuredClone(item);
upgraded.curve.reforges = 1;
const commissioned = structuredClone(item);
commissioned.value += 1;
const changed = structuredClone(item);
changed.stats.damage += 1;
for (const candidate of [upgraded, commissioned, changed]) {
  const snapshot = structuredClone(candidate);
  assert.equal(current.loot.restoreLegacyItemMigration(candidate, [receipt]), false);
  assert.deepEqual(candidate, snapshot);
}
assert.equal(current.loot.restoreLegacyItemMigration(item, [receipt]), true);
assert.deepEqual(item.stats, previousStats);
assert.equal(item.value, previousValue);
assert.equal(item.curve, undefined);
assert.equal(current.loot.restoreLegacyItemMigration(item, [receipt]), false);
const unchanged = structuredClone(item);
assert.equal(current.loot.normalizeItemCurve(item), null);
assert.deepEqual(item, unchanged, 'Original equipment must never enter the Greek migration');
console.log(`Original mechanics match Git ${BASE}: ${cases} loot cases, four forge/Crown/load sequences, Life Siphon, Arrow Rain, all original boss attacks, and safe migration recovery.`);
