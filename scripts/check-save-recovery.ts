/** Bundle with esbuild for Node; no browser or generated world is needed. */
import assert from 'node:assert/strict';
import { makeItem } from '../src/game/items/loot';
import { CLASS_BY_ID } from '../src/data/classes';
import { SAVE_KEY, ROLLBACK_KEY, PRE_AEGEAN_KEY, backupKey, preserveExpansionSave, readPlayableSave, recoveryId, writePlayableSave } from '../src/game/save/rollbackRecovery';
import type { SaveData } from '../src/game/save/save';

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  failWrites = false;
  discardWrites = false;
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    if (!this.discardWrites) this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const weapon = makeItem(CLASS_BY_ID.warrior.startWeapon, { plain: true });
const potion = makeItem('potion_health_s', { qty: 4 });
const legacy: SaveData = {
  version: 1, seed: 42, savedAt: 123, mapId: 'overworld', clock: 300, day: 7,
  player: {
    name: 'Returning Hero', cls: 'warrior', race: 'human', hairIndex: 0, skinIndex: 0,
    hairStyle: 'short', beard: 'none', x: 16000, y: 14000, level: 74, xp: 1200,
    hp: 450, mp: 30, sp: 90, gold: 98000, skillPoints: 2, skills: { strength: 4 },
    inventory: [potion], storage: [], equipment: { mainHand: weapon, offHand: null, armor: null, accessory: null },
    reputation: { alliance: 90, northern: 80, forest: 70, guild: 60, bandits: -40, arcane: 50 },
    flags: ['legacy-cleared'], discovered: ['ashvale'], waystones: ['ashvale'], killCounts: { wolf: 100 },
    bossesKilled: ['old-boss'], clearedDungeons: ['old-dungeon'], shrinesTended: 5,
    quickItem: potion.defId, playTime: 90000, deaths: 3,
  },
  quests: { active: [], completed: ['tutorial'] }, trackedQuest: null,
  mapStates: { overworld: { opened: ['chest1'], respawn: {}, killedSpawns: ['spawn1'], everKilled: ['spawn1'], cleared: false } },
};

const storage = new MemoryStorage();
writePlayableSave(storage, legacy);
assert.deepEqual(readPlayableSave(storage).data, JSON.parse(JSON.stringify(legacy)), 'Ordinary v1 saves remain unchanged');
assert.equal(storage.getItem(ROLLBACK_KEY), null);

const greekSword = { ...weapon, uid: 'greek-sword', defId: 'aegean_sword', rarity: 'primordial', stats: { damage: 5000 } };
const greekMaterial = { ...potion, uid: 'greek-material', defId: 'oathsteel', qty: 7 };
const original = {
  ...structuredClone(legacy), version: 2, now: 6789, savedAt: 456, mapId: 'aegean_temple',
  campaign: { receipts: ['army-won', 'hydra-won'] }, naval: { owned: ['stormbreaker'], aboard: true },
  encounters: { army: { slain: 300 }, leonidas: { victories: 1 } },
};
original.player.inventory.push(greekMaterial);
original.player.equipment.mainHand = greekSword as typeof weapon;
original.player.level = 83;
original.player.x = 52000;
original.player.discovered.push('aegean_achaia');
original.player.gold = 1234567;
original.quests.active.push({ id: 'aegean-only-quest', progress: [3], turnedIn: false });
original.trackedQuest = 'aegean-only-quest';
const raw = JSON.stringify(original);
storage.setItem(SAVE_KEY, raw);
storage.setItem(PRE_AEGEAN_KEY, JSON.stringify(legacy));
const projected = readPlayableSave(storage);
assert.equal(projected.heldItems, 2);
assert.equal(projected.data.player.gold, 1234567, 'Never silently restore the older pre-expansion snapshot');
assert.equal(projected.data.player.level, 83, 'Earned levels remain intact');
assert.equal(projected.data.player.inventory[0].uid, potion.uid);
assert.equal(projected.data.player.equipment.mainHand, null, 'Unavailable gear cannot enter the old renderer or combat');
assert.equal(projected.data.trackedQuest, null);
assert.deepEqual(projected.data.quests.active, []);
assert.equal(storage.getItem(SAVE_KEY), raw, 'Projection is read-only');
preserveExpansionSave(storage, projected.source!);
assert.equal(storage.getItem(backupKey(projected.source!)), raw, 'Permanent backup is exact, including all Greek systems and items');

const continued = structuredClone(projected.data);
continued.savedAt = 789;
continued.mapId = 'overworld';
continued.player.x = 15400;
continued.player.gold += 800;
continued.player.inventory[0].qty = 1;
continued.player.bossesKilled.push('another-old-boss');
writePlayableSave(storage, continued, projected.source);
assert.deepEqual(readPlayableSave(storage).data, continued, 'Continue resumes the latest legacy progress after refresh');
assert.equal(storage.getItem(SAVE_KEY), raw, 'Autosaving the rollback must never overwrite the full v2 save');
assert.equal(storage.getItem(PRE_AEGEAN_KEY), JSON.stringify(legacy), 'The pre-Aegean backup also stays untouched');
assert.equal(storage.getItem(backupKey(projected.source!)), raw);

const newerRaw = JSON.stringify({ ...original, savedAt: 999 });
storage.setItem(SAVE_KEY, newerRaw);
assert.throws(() => writePlayableSave(storage, continued, projected.source), /Another tab changed/);
assert.equal(readPlayableSave(storage).data.player.gold, original.player.gold, 'A shadow from a different source must never replace a newer v2 save');

const fullStorage = new MemoryStorage();
fullStorage.setItem(SAVE_KEY, raw);
fullStorage.failWrites = true;
assert.throws(() => preserveExpansionSave(fullStorage, projected.source!), /Quota/);
assert.equal(fullStorage.getItem(SAVE_KEY), raw);
fullStorage.failWrites = false;
fullStorage.discardWrites = true;
assert.throws(() => preserveExpansionSave(fullStorage, projected.source!), /verified/);
assert.equal(fullStorage.getItem(SAVE_KEY), raw);

const newCharacter = structuredClone(legacy);
newCharacter.player.name = 'New Adventurer';
writePlayableSave(storage, newCharacter);
assert.equal(readPlayableSave(storage).data.player.name, 'New Adventurer');
assert.equal(storage.getItem(backupKey({ id: recoveryId(newerRaw), raw: newerRaw })), newerRaw, 'Starting a new character still preserves v2');

storage.setItem(SAVE_KEY, '{broken');
assert.throws(() => readPlayableSave(storage), /not been changed/);
assert.equal(storage.getItem(SAVE_KEY), '{broken');
storage.setItem(SAVE_KEY, JSON.stringify({ ...legacy, version: 99 }));
assert.throws(() => readPlayableSave(storage), /unsupported/);
storage.setItem(SAVE_KEY, JSON.stringify({ ...legacy, player: { ...legacy.player, cls: 'unknown' } }));
assert.throws(() => readPlayableSave(storage), /incomplete/);

console.log('Save recovery: v1 compatibility, v2 projection, exact backups, independent resumed saves, held items, no stale fallback, tab conflicts, quota, new characters and invalid saves passed.');
