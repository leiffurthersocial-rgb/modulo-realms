import assert from "node:assert/strict";
import { readExpansionSave, recoveryId } from "../src/game/save/rejoinRollback";
import type { SaveData } from "../src/game/save/save";
import type { Item } from "../src/game/items/types";

const key = "modulo-realms-save-v1";
const shadowKey = "modulo-realms-save-rollback-v1";
const values = new Map<string, string>();
const storage = { getItem: (id: string) => values.get(id) ?? null };
const item = (uid: string, qty = 1): Item => ({
  uid,
  defId: uid,
  name: uid,
  type: "weapon",
  slot: "mainHand",
  icon: "sword",
  rarity: "mythic",
  level: 75,
  value: 100,
  stats: { damage: 300 },
  effects: [],
  enchants: [],
  enchantSlots: 0,
  qty,
  stackable: false,
});
const royal = {
  ...item("held-royal"),
  rarity: "primordial" as const,
  provenance: "asterion",
};
const heldMaterial = {
  ...item("held-material", 7),
  type: "material" as const,
  stackable: true,
};
const sold = item("sold-during-rollback");
const potion = {
  ...item("potion", 5),
  type: "consumable" as const,
  stackable: true,
};
const original = {
  version: 2,
  savedAt: 100,
  now: 500,
  seed: 42,
  mapId: "aegean_leonidas",
  clock: 350,
  day: 5,
  player: {
    name: "Returning Hero",
    cls: "warrior",
    race: "human",
    hairIndex: 0,
    skinIndex: 0,
    hairStyle: "short",
    beard: "none",
    x: 52000,
    y: 14000,
    level: 90,
    xp: 7890,
    hp: 800,
    mp: 90,
    sp: 130,
    gold: 200000,
    skillPoints: 3,
    skills: { battle: 4 },
    inventory: [heldMaterial, potion, sold],
    storage: [],
    equipment: { mainHand: royal, offHand: null, armor: null, accessory: null },
    reputation: {
      alliance: 90,
      northern: 70,
      forest: 50,
      guild: 40,
      bandits: -30,
      arcane: 20,
    },
    flags: ["old-victory"],
    discovered: ["ashvale", "asterion"],
    waystones: ["ashvale"],
    killCounts: { wolf: 30 },
    bossesKilled: ["leonidas"],
    clearedDungeons: ["old-dungeon"],
    shrinesTended: 5,
    quickItem: "potion",
    playTime: 1000,
    deaths: 3,
    statuses: [{ type: "poison", until: 510, strength: 30 }],
    shield: 900,
    shieldUntil: 520,
  },
  quests: {
    active: [
      { id: "held-greek-quest", progress: [3], turnedIn: false },
      { id: "old-quest", progress: [1], turnedIn: false },
    ],
    completed: ["tutorial"],
  },
  trackedQuest: "held-greek-quest",
  mapStates: {
    overworld: {
      opened: ["old-chest"],
      respawn: {},
      killedSpawns: [],
      cleared: false,
    },
    greek: {
      opened: ["royal-chest"],
      respawn: {},
      killedSpawns: ["leonidas"],
      cleared: true,
    },
  },
  campaign: {
    receipts: ["victory:leonidas", "army:300"],
    masteries: { 80: "hoplite" },
  },
  encounters: {
    army: { defeated: 300 },
    leonidas: { victories: 1, practicePhase: 5 },
  },
  activities: {
    runs: { pilgrimage: { step: 3 } },
    active: "pilgrimage",
    cooldowns: {},
  },
  naval: {
    fleet: [
      { id: "stormbreaker", hull: 456, fittings: ["ram"], cargo: ["sail"] },
    ],
    selected: "stormbreaker",
    aboard: true,
    heading: 1,
    lastPort: "asterion",
    visitedPorts: ["achaia", "asterion"],
    shipX: 53000,
    shipY: 14500,
    deck: { x: 53000, y: 14500, enemies: ["ketos"] },
  },
  powers: {
    version: 1,
    cooldowns: { royal: 20 },
    javelins: 2,
    javelinRecovery: 0.4,
    flamePattern: 1,
  },
} as unknown as SaveData;
const raw = JSON.stringify(original);
values.set(key, raw);
assert.deepEqual(readExpansionSave(storage), {
  data: JSON.parse(raw),
  rejoined: false,
  restoredItems: 0,
});
const newer = structuredClone(original);
newer.version = 1;
newer.savedAt = 200;
newer.now = 700;
newer.mapId = "overworld";
newer.player.x = 15400;
newer.player.y = 14500;
newer.player.gold = 199123;
newer.player.inventory = [{ ...potion, qty: 2 }];
newer.player.equipment.mainHand = item("earned-new-weapon");
newer.player.flags.push("earned-victory");
newer.player.deaths++;
delete newer.player.statuses;
delete newer.player.shield;
delete newer.player.shieldUntil;
newer.quests = { active: [], completed: ["tutorial", "old-quest"] };
newer.trackedQuest = null;
newer.mapStates.overworld.opened.push("new-chest");
const writeShadow = (data = newer, extra = {}) =>
  values.set(
    shadowKey,
    JSON.stringify({
      version: 1,
      source: recoveryId(raw),
      heldItemIds: [royal.uid, heldMaterial.uid],
      heldQuestIds: ["held-greek-quest"],
      data,
      ...extra,
    }),
  );
writeShadow();
const before = [...values];
const joined = readExpansionSave(storage)!;
assert.equal(joined.rejoined, true);
assert.equal(joined.restoredItems, 2);
assert.equal(joined.data.version, 2);
assert.equal(
  joined.data.player.gold,
  199123,
  "Do not restore spent gold or replay rewards",
);
assert.equal(
  joined.data.player.inventory.find((i) => i.uid === "potion")?.qty,
  2,
  "Consumed quantities remain consumed",
);
assert.equal(
  joined.data.player.inventory.some((i) => i.uid === sold.uid),
  false,
  "Sold legacy items never resurrect",
);
assert.equal(
  joined.data.player.equipment.mainHand?.uid,
  "earned-new-weapon",
  "Latest equipment retains priority",
);
assert.deepEqual(
  joined.data.player.storage.find((i) => i.uid === royal.uid),
  royal,
  "Held gear retains every field and provenance in storage",
);
assert.equal(
  joined.data.player.storage.find((i) => i.uid === heldMaterial.uid)?.qty,
  7,
);
assert.equal(joined.data.player.x, 15400);
assert.equal(joined.data.player.deaths, 4);
assert.deepEqual(joined.data.player.statuses, []);
assert.equal(joined.data.player.shield, 0);
assert.equal(joined.data.now, 700);
assert.deepEqual(
  joined.data.campaign,
  original.campaign,
  "Keep all exact campaign payment receipts",
);
assert.deepEqual(
  joined.data.encounters,
  original.encounters,
  "Preserve 300 and Leonidas progression without rewards",
);
assert.deepEqual(joined.data.powers, original.powers);
assert.deepEqual(joined.data.naval?.fleet, original.naval?.fleet);
assert.equal(joined.data.naval?.aboard, false);
assert.equal(joined.data.naval?.deck, undefined);
assert.equal(
  joined.data.quests.active.filter((q) => q.id === "held-greek-quest").length,
  1,
);
assert.equal(
  joined.data.quests.active.some((q) => q.id === "old-quest"),
  false,
);
assert.equal(
  joined.data.mapStates.overworld.opened.includes("new-chest"),
  true,
);
assert.deepEqual(joined.data.mapStates.greek, original.mapStates.greek);
assert.deepEqual(
  [...values],
  before,
  "Loading must never write or delete either recovery copy",
);
assert.deepEqual(
  readExpansionSave(storage),
  joined,
  "Reload before saving is deterministic and cannot duplicate gear",
);

const emptySlot = structuredClone(newer);
emptySlot.player.equipment.mainHand = null;
writeShadow(emptySlot);
assert.equal(
  readExpansionSave(storage)?.data.player.equipment.mainHand?.uid,
  royal.uid,
  "Restore previous gear when its slot is still free",
);
const alreadyHeld = structuredClone(newer);
alreadyHeld.player.storage.push(royal);
alreadyHeld.quests.completed.push("held-greek-quest");
writeShadow(alreadyHeld);
assert.equal(
  readExpansionSave(storage)?.restoredItems,
  1,
  "UID-based reconciliation cannot duplicate an already-present object",
);
assert.equal(
  readExpansionSave(storage)?.data.quests.active.length,
  0,
  "Do not reactivate a quest completed during recovery",
);

// After an ordinary verified v2 save, the source fingerprint changes. Keeping
// the old recovery data is safe and avoids destructive cleanup on load.
writeShadow();
values.set(key, JSON.stringify(joined.data));
assert.equal(readExpansionSave(storage)?.rejoined, false);
assert.equal(readExpansionSave(storage)?.data.player.storage.length, 2);
values.set(key, JSON.stringify({ ...newer, version: 1 }));
assert.equal(
  readExpansionSave(storage)?.rejoined,
  false,
  "A new v1 character never inherits another character",
);
values.set(key, raw);
writeShadow(newer, { source: "different-adventure" });
assert.equal(readExpansionSave(storage)?.rejoined, false);
writeShadow(newer, { heldItemIds: undefined });
assert.throws(() => readExpansionSave(storage), /recovery information/);
values.set(shadowKey, "{broken");
assert.throws(
  () => readExpansionSave(storage),
  /Both saved copies are still safe/,
);
assert.equal(values.get(key), raw);
console.log(
  "Save rejoin: latest progress, spent gold/items, held gear, provenance, slot conflicts, quests, ships, receipts, idempotence and non-destructive failures passed.",
);
