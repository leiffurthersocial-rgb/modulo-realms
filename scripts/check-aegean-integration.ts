/** Run from the repository root, serially. Real Game/save/campaign/naval/activity
 * APIs; DOM and storage are in-memory only. No rendering, RAF, server or audio.
 * Two save loads rebuild the actual world; every other scenario reuses it. */
import assert from "node:assert/strict";
import type { Game as GameType } from "../src/game/core/game";
import type { SaveData } from "../src/game/save/save";
import type { PropInstance } from "../src/game/world/map";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  clear(): void {
    this.values.clear();
  }
}
const noop = () => {};
function canvas(): HTMLCanvasElement {
  const context = new Proxy(
    { imageSmoothingEnabled: false },
    {
      get(target, key) {
        if (key in target) return Reflect.get(target, key);
        if (key === "measureText")
          return (text: string) => ({ width: text.length * 8 });
        if (key === "createLinearGradient" || key === "createRadialGradient")
          return () => ({ addColorStop: noop });
        return noop;
      },
      set: (target, key, value) => Reflect.set(target, key, value),
    },
  );
  return Object.assign(new EventTarget(), {
    width: 800,
    height: 600,
    style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    }),
  }) as unknown as HTMLCanvasElement;
}
const storage = new MemoryStorage();
Object.assign(globalThis, {
  localStorage: storage,
  window: Object.assign(new EventTarget(), {
    setTimeout: () => 0,
    clearTimeout: noop,
    setInterval: () => 0,
    clearInterval: noop,
  }),
  document: Object.assign(new EventTarget(), {
    createElement: (tag: string) => {
      assert.equal(tag, "canvas");
      return canvas();
    },
  }),
});

// Renderer owns a scratch canvas at module initialization, hence dynamic imports.
const { Game } = await import("../src/game/core/game");
const { saveGame, loadGame } = await import("../src/game/save/save");
const { Player } = await import("../src/game/player/player");
const { Enemy } = await import("../src/game/entities/enemy");
const { createMap, boxHitsTerrain } = await import("../src/game/world/map");
const { T } = await import("../src/game/world/tiles");
const { makeItem } = await import("../src/game/items/loot");
const { countItem } = await import("../src/game/items/inventory");
const {
  OLD_WORLD_TESTAMENT,
  AEGEAN_ENTRY_BOSSES,
  AEGEAN_LABOUR_IDS,
  AEGEAN_STRATEGIC_IDS,
  AEGEAN_SANCTUARY_IDS,
  AEGEAN_CHAMPION_IDS,
  AEGEAN_ACTIVITY_BY_ID,
} = await import("../src/data/aegean/progression");
const { AEGEAN_PORTS } = await import("../src/data/aegean/world");
const { AEGEAN_SHIPS } = await import("../src/data/aegean/content");
const { AEGEAN_SERVICES } = await import("../src/game/aegean/services");
const KEY = "modulo-realms-save-v1",
  BACKUP = "modulo-realms-save-pre-aegean";

const game: GameType = new Game(canvas());
game.player = new Player({
  name: "Aegean integration",
  race: "human",
  cls: "warrior",
  hairIndex: 0,
  skinIndex: 0,
  hairStyle: "short",
  beard: "none",
});
game.player.level = 100;
game.player.gold = 5000000;
game.player.x = 480 * 32;
game.player.y = 448 * 32;
game.player.hp = game.player.maxHp;
game.map = createMap({
  id: "overworld",
  name: "Save bootstrap only",
  w: 64,
  h: 64,
});
game.map.tiles.fill(T.GRASS);
game.maps.set(game.map.id, game.map);
game.screen = "playing";
game.now = 100;
game.powers.reset();
const oldSword = makeItem("sword_iron", { level: 75, rarity: "epic" });
game.player.inventory.push(oldSword);
assert(saveGame(game));
const legacy = JSON.parse(storage.getItem(KEY)!) as SaveData;
legacy.version = 1;
delete legacy.powers;
delete legacy.campaign;
delete legacy.activities;
delete legacy.naval;
delete legacy.encounters;
delete legacy.itemMigrations;
delete legacy.player.inventory[0].curve;
legacy.player.inventory[0].stats.damage = 9999999;
const original = JSON.stringify(legacy);
storage.clear();
storage.setItem(KEY, original);

assert(loadGame(game), "A version 1 save loads through the production loader");
assert.equal(
  storage.getItem(KEY),
  original,
  "Loading never overwrites the original save",
);
assert.equal(game.player.inventory[0].uid, oldSword.uid);
assert.equal(game.player.inventory[0].curve?.version, 2);
assert((game.player.inventory[0].stats.damage ?? Infinity) < 9999999);
assert.equal(
  game.itemMigrationReport.filter((r) => r.uid === oldSword.uid).length,
  1,
);
const normalizedLegacy = structuredClone(game.player.inventory[0]);
assert(saveGame(game));
assert.equal(
  storage.getItem(BACKUP),
  original,
  "The first successful v2 write preserves the exact legacy payload",
);
assert.equal(storage.getItem("modulo-realms-save-recovery"), null);
const surfaceServiceCount = AEGEAN_SERVICES.filter(
  (service) => service.map === "overworld",
).length;
assert.equal(
  game.map.props.filter((prop) => prop.data?.service).length,
  surfaceServiceCount,
);
game.services.install(game.map);
assert.equal(
  game.map.props.filter((prop) => prop.data?.service).length,
  surfaceServiceCount,
  "Installing services twice must not duplicate markers",
);

// Gate prerequisites are lifetime receipts, independent of current map resets.
assert.match(game.campaign.access("aegean_nemea")!, /Veteran Writ/);
game.travel("aegean_nemea", 400, 400);
assert.equal(
  game.fade.pending,
  null,
  "The actual travel API cannot bypass the Veteran Writ",
);
for (const id of AEGEAN_ENTRY_BOSSES) game.player.bossesKilled.add(id);
game.campaign.recordLegacy();
game.campaign.update(1);
assert.equal(game.campaign.access("aegean_nemea"), null);
assert(game.campaign.has("aegean_veteran_writ"));
assert(
  game.campaign.access("aegean_army"),
  "The army still requires the complete old world and Greek proofs",
);
for (const id of OLD_WORLD_TESTAMENT.dungeons)
  game.player.clearedDungeons.add(id);
for (const id of OLD_WORLD_TESTAMENT.bosses) game.player.bossesKilled.add(id);
for (const id of OLD_WORLD_TESTAMENT.minibosses) game.player.killCounts[id] = 1;
game.player.flags.add("beat_tusya");
game.campaign.recordLegacy();
assert.deepEqual(game.campaign.testamentMissing(), []);
game.completeAegean("aegean_nemea");
const firstGold = game.player.gold,
  firstGear = game.player.inventory.length;
game.completeAegean("aegean_nemea");
assert.equal(
  game.player.gold,
  firstGold,
  "Repeated completion cannot duplicate the first-clear payout",
);
assert.equal(game.player.inventory.length, firstGear);
for (const id of [...AEGEAN_LABOUR_IDS, ...AEGEAN_STRATEGIC_IDS])
  game.player.flags.add(`aegean:complete:${id}`);
assert.equal(game.campaign.access("aegean_army"), null);
assert(game.campaign.access("aegean_leonidas"));
assert.deepEqual(
  game.campaign.requirements(["aegean_nemea", "aegean:component:ribs"]),
  ["aegean:component:ribs"],
);
assert(game.campaign.selectMastery("vigor"));
assert(
  !game.campaign.selectMastery("clarity"),
  "Only one mastery is allowed per milestone",
);

// Actual port coordinates and collision profiles, purchase, boarding and rescue.
const port = AEGEAN_PORTS.find((p) => p.id === "aegean_aigialos")!;
const islandPort = AEGEAN_PORTS.find((p) => p.id === "aegean_asterion")!;
const at = (point: { x: number; y: number }) => {
  game.player.x = point.x;
  game.player.y = point.y;
};
assert(
  !game.naval.buy("aegean_skiff"),
  "Ships cannot be purchased away from a harbour",
);
at(port.land);
const beforeShip = game.player.gold;
assert(game.naval.buy("aegean_skiff"));
assert.equal(
  beforeShip - game.player.gold,
  AEGEAN_SHIPS.find((s) => s.id === "aegean_skiff")!.cost,
);
const paid = game.player.gold;
assert(game.naval.buy("aegean_skiff"));
assert.equal(
  game.player.gold,
  paid,
  "Selecting an owned ship does not charge twice",
);
assert(
  !game.naval.buy("aegean_stormbreaker"),
  "Gold alone cannot buy the storm route",
);
assert(game.naval.embark());
assert(game.naval.aboard);
assert(
  boxHitsTerrain(game.map, game.player.x, game.player.y, 10, 8, "foot"),
  "The launch is marine water",
);
assert(
  !boxHitsTerrain(game.map, game.player.x, game.player.y, 16, 12, "ship"),
  "The hull can occupy the launch",
);
game.input.setVirtual("right", true);
game.naval.update(0.1);
game.input.setVirtual("right", false);
game.input.endFrame();
assert(game.naval.dock());
assert.deepEqual({ x: game.player.x, y: game.player.y }, port.land);
assert(game.campaign.state.checkpoint?.map === "overworld");
assert(game.naval.buy("aegean_roundship"));
assert(game.naval.fit("lens"));
assert(game.naval.embark());
at(islandPort.launch);
assert(!game.naval.dock(), "An ordinary ship cannot land on Asterion");
assert(!game.campaign.has("aegean:landed"));
at(port.launch);
game.enemies.push(
  new Enemy("aegean_sea_serpent", game.player.x + 90, game.player.y, 96, {
    spawnId: "sea:integration",
    region: "aegean_pelagic",
  }),
);
assert(game.naval.enterDeck());
assert.equal(game.map.id, "aegean_ship_deck");
assert(!game.naval.aboard);
assert(game.enemies.some((e) => e.spawnId?.startsWith("deck:")));
assert(
  !game.naval.returnHelm(),
  "The crew cannot abandon a live boarding party",
);
const javelin = makeItem("aegean_thunder_javelins");
game.player.equipment.mainHand = javelin;
game.basicAttack();
assert(
  game.projectiles.some((projectile) => projectile.friendly),
  "Ordinary class weapon combat works on the deck",
);
for (const enemy of [...game.enemies])
  if (!enemy.friendly)
    game.damageEnemy(enemy, enemy.maxHp * 1000, { noProc: true });
assert(game.naval.returnHelm());
assert.equal(game.map.id, "overworld");
assert(game.naval.aboard);
const beforeWreck = game.player.gold;
game.naval.damage(game.naval.definition!.hull * 100);
assert(!game.naval.aboard);
assert(game.naval.vessel!.hull > 0);
assert.deepEqual({ x: game.player.x, y: game.player.y }, port.land);
const wreck = { ...game.naval.state.wreck! };
assert.equal(beforeWreck - game.player.gold, wreck.gold);
assert(game.naval.embark());
at(wreck);
game.naval.update(0.01);
assert.equal(game.naval.state.wreck, undefined);
assert.equal(
  game.player.gold,
  beforeWreck,
  "Recovering the actual wreck restores the voyage gold",
);
at(port.launch);
assert(game.naval.dock());

// Story ferries only retrace ports personally reached by the player’s ship.
const ferry = game.map.props.find(
  (prop) => prop.data?.service === "lighthouse_out",
)!;
assert(ferry);
at(ferry);
const beforeService = game.player.gold;
assert(game.services.interact(ferry));
assert.equal(game.fade.pending, null);
assert.equal(game.player.gold, beforeService);
game.player.flags.add("aegean:route:lighthouse");
assert(game.services.interact(ferry));
assert.equal(
  game.fade.pending,
  null,
  "A story reward cannot replace the first voyage to the far port",
);
assert.equal(game.player.gold, beforeService);
const emberPort = AEGEAN_PORTS.find((p) => p.id === "aegean_ember_quay")!;
at(port.land);
assert(game.naval.embark());
at(emberPort.launch);
assert(game.naval.dock());
at(ferry);
assert(game.services.interact(ferry));
assert(game.fade.pending, "The ferry opens after both ports were docked at");
assert.equal(beforeService - game.player.gold, 2500);
// Execute the accepted travel callback without rendering the fade animation.
const travel = game.fade.pending;
game.fade.pending = null;
travel();
game.fade.alpha = 0;
game.fade.target = 0;
assert.equal(game.map.id, "overworld");
assert(
  Math.hypot(
    game.player.x - emberPort.land.x,
    game.player.y - emberPort.land.y,
  ) < 140,
);
assert(
  !boxHitsTerrain(game.map, game.player.x, game.player.y, 10, 7),
  "Ferry arrival is a real dry landing",
);
assert.equal(game.naval.state.lastPort, emberPort.id);
game.player.equipment.mainHand = javelin;
const originalCrit = game.player.stats().critChance;
game.player.flags.add("aegean:training:archery");
game.services.update(1);
assert.equal(
  game.player.stats().critChance,
  originalCrit + 3,
  "The earned archery lesson affects actual ranged stats",
);
game.player.equipment.mainHand = null;
game.services.update(1);
assert(
  !game.player.buffs.some((buff) => buff.id.startsWith("aegean_centaur_")),
  "The ranged lesson cannot buff an unequipped/melee loadout",
);
game.player.equipment.mainHand = javelin;
const refuge = game.map.props.find(
  (prop) => prop.data?.service === "olive_refuge",
)!;
at(refuge);
game.player.hp = game.player.maxHp / 2;
const wounded = game.player.hp;
game.services.interact(refuge);
assert.equal(
  game.player.hp,
  wounded,
  "The refuge requires its own story receipt",
);
game.player.flags.add("aegean:refuge:olive");
game.services.interact(refuge);
assert.equal(game.player.hp, game.player.maxHp);
game.services.interact(refuge);
assert.equal(
  game.player.buffs.filter((buff) => buff.id === "aegean_refuge_stamina")
    .length,
  1,
  "Repeated refuge use refreshes rather than stacking the boon",
);
assert.equal(game.campaign.state.checkpoint?.x, game.player.x);

// Royal choices require an earned source receipt and the island itself.
assert.throws(() => makeItem("aegean_kings_dory"), /provenance/);
assert.throws(
  () =>
    makeItem("aegean_kings_dory", {
      provenance: { source: "reward", id: "aegean_nemea" },
    }),
  /provenance/,
);
game.campaign.state.pendingChoices.push("aegean_leonidas");
assert(!game.campaign.chooseReward("aegean_leonidas", "aegean_kings_dory"));
at(islandPort.land);
assert(!game.campaign.chooseReward("aegean_leonidas", "sword_iron"));
assert(game.campaign.chooseReward("aegean_leonidas", "aegean_kings_dory"));
assert(
  !game.campaign.chooseReward("aegean_leonidas", "aegean_kings_dory"),
  "The royal choice can be claimed once",
);
const royal = game.player.inventory.find(
  (i) => i.defId === "aegean_kings_dory",
)!;
assert.equal(royal.provenance?.id, "aegean_leonidas");
assert.equal(royal.provenance?.region, "aegean_asterion");
assert.equal(royal.enchants.length, 4);
const savedRoyal = structuredClone(royal);

// Real installed props drive an escort into its second step before saving.
const rescue = "aegean_contract_rescue";
function station(id: string, index: number): PropInstance {
  const prop = game.map.props.find(
    (p) => p.data?.activity === id && p.data?.index === index,
  );
  assert(prop, `Missing installed station ${id}/${index}`);
  return prop;
}
function use(id: string, index: number): void {
  const prop = station(id, index);
  at(prop);
  assert(game.activities.interact(prop));
}
use(rescue, 0);
use(rescue, 1);
assert.equal(game.activities.state.runs[rescue].step, 1);
assert.equal(game.activities.state.runs[rescue].progress, 1);
assert(game.activities.state.runs[rescue].escort);
game.campaign.state.visits.push("integration_route");
game.campaign.state.counters.integration = 7;
game.campaign.setCheckpoint();
// Saved army fixture is produced through the public restore schema; separate
// encounter regressions prove all 300 deaths and chapter transitions.
game.encounters.restore({
  version: 1,
  records: {
    aegean_army: { steps: [], chapter: 2, bestPhase: 0, completed: false },
  },
});
game.powers.reset();
game.player.equipment.mainHand = javelin;
for (let i = 0; i < 3; i++) assert(game.powers.consumeAttack(javelin));
game.powers.update(0.55);
const thread = makeItem("aegean_ariadne_thread");
game.player.equipment.accessory = thread;
game.useArtifact();
assert(game.powers.cooldown(thread) > 0);
assert.equal(
  game.player.artifactCooldown,
  game.powers.cooldown(thread),
  "The real artifact input synchronizes its displayed cooldown",
);
const antidote = makeItem("aegean_antitoxin", { qty: 2 });
game.player.inventory.push(antidote);
game.useItem(antidote.uid);
assert.equal(countItem(game.player.inventory, "aegean_antitoxin"), 1);
game.useItem(antidote.uid);
assert.equal(
  countItem(game.player.inventory, "aegean_antitoxin"),
  1,
  "The shared recovery cooldown blocks a second draught",
);
const savedFleet = game.naval.snapshot(),
  savedPowers = game.powers.snapshot(),
  savedNow = game.now;
const savedMaxHp = game.player.maxHp;
const savedCooldowns = structuredClone(game.player.cooldowns),
  savedResistance = structuredClone(game.player.resistances);
assert(saveGame(game));
const savedV2 = JSON.parse(storage.getItem(KEY)!) as SaveData;
assert.equal(savedV2.version, 2);
assert(loadGame(game));
assert.equal(game.now, savedNow);
assert.deepEqual(game.powers.snapshot(), savedPowers);
assert.deepEqual(game.player.cooldowns, savedCooldowns);
assert.deepEqual(game.player.resistances, savedResistance);
assert(
  !game.powers.activate(game.player.equipment.accessory!),
  "Reload cannot erase the real equipment cooldown",
);
assert.deepEqual(game.naval.snapshot(), savedFleet);
assert(game.player.flags.has("aegean:mastery:vigor"));
assert.equal(
  game.player.maxHp,
  savedMaxHp,
  "The restored mastery and gear derive the same maximum health",
);
assert.equal(game.campaign.state.counters.integration, 7);
assert(game.campaign.state.visits.includes("integration_route"));
assert(game.campaign.has("aegean_nemea"));
assert.deepEqual(
  JSON.parse(
    JSON.stringify(game.player.inventory.find((i) => i.uid === oldSword.uid)),
  ),
  JSON.parse(JSON.stringify(normalizedLegacy)),
);
assert.deepEqual(
  JSON.parse(
    JSON.stringify(game.player.inventory.find((i) => i.uid === royal.uid)),
  ),
  JSON.parse(JSON.stringify(savedRoyal)),
  "Royal rolls, enchantments and provenance survive the loader",
);
assert.equal(
  game.itemMigrationReport.filter((r) => r.uid === oldSword.uid).length,
  1,
  "A second load must not migrate the legacy item again",
);
assert.equal(storage.getItem(BACKUP), original);
assert.equal(
  game.activities.state.runs[rescue].step,
  1,
  "The completed first step survives loading",
);
assert.equal(
  game.activities.state.runs[rescue].progress,
  0,
  "The interrupted escort restarts its current route",
);
assert.equal(game.activities.state.runs[rescue].escort, undefined);
game.setMap("aegean_army");
assert.equal(
  game.encounters.armyStanding,
  150,
  "The saved second chapter restores exactly 150 remaining soldiers",
);
assert(
  !game.campaign.has("aegean_army"),
  "A chapter checkpoint is not an army victory",
);
game.setMap("overworld");

// A failed escort clears its attackers and can restart, then earn one payout.
use(rescue, 1);
const escorted = game.activities.state.runs[rescue].escort!;
game.enemies.push(
  new Enemy("aegean_harpy", escorted.x, escorted.y, 90, {
    spawnId: `activity:${rescue}:regression`,
    region: "aegean_coast",
  }),
);
for (let i = 0; i < 205; i++) {
  game.now += 0.1;
  game.activities.update(0.1);
}
assert.equal(game.activities.state.runs[rescue].escort, undefined);
assert.equal(game.activities.state.runs[rescue].progress, 0);
assert(!game.enemies.some((e) => e.spawnId?.startsWith(`activity:${rescue}:`)));
use(rescue, 1);
function finishEscort(id: string): void {
  for (const index of [2, 3]) {
    const target = station(id, index);
    at(target);
    // Defeat hostile actors using actual Game damage/reward dispatch.
    for (const e of [...game.enemies])
      if (e.spawnId?.startsWith(`activity:${id}:`))
        game.damageEnemy(e, e.maxHp * 1000, { noProc: true });
    for (let i = 0; i < 35; i++) {
      game.now += 0.1;
      game.activities.update(0.1);
    }
    assert(game.activities.interact(target));
  }
}
finishEscort(rescue);
assert(game.campaign.has(rescue));
assert(!game.activities.start(rescue));
const repeatState = game.activities.snapshot();
game.activities.restore(repeatState);
assert(
  !game.activities.start(rescue),
  "The repeat cooldown survives restoration",
);
game.now += 301;
assert(
  game.activities.start(rescue),
  "A repeatable contract becomes available after its cooldown",
);
const repeatGold = game.player.gold;
use(rescue, 0);
use(rescue, 1);
finishEscort(rescue);
assert.equal(
  game.player.gold - repeatGold,
  AEGEAN_ACTIVITY_BY_ID[rescue].reward.gold,
  "A legal repeated run pays exactly one contract reward",
);

// Defence cannot finish with living attackers or carry time from a failed court.
const arena = "aegean_contract_arena";
use(arena, 0);
for (const index of [1, 3, 2]) use(arena, index);
assert.equal(game.activities.current?.type, "defend");
use(arena, 0);
assert(game.enemies.some((e) => e.spawnId?.startsWith(`activity:${arena}:`)));
game.player.x += 400;
game.activities.update(0.1);
assert.equal(game.activities.state.runs[arena].timer, 0);
assert.equal(game.activities.state.runs[arena].started, false);
assert(!game.enemies.some((e) => e.spawnId?.startsWith(`activity:${arena}:`)));
use(arena, 0);
for (let i = 0; i < 42; i++) {
  game.now++;
  game.activities.update(1);
}
assert(
  !game.campaign.has(arena),
  "Surviving the duration alone is insufficient while attackers live",
);
for (const e of [...game.enemies])
  if (e.spawnId?.startsWith(`activity:${arena}:`))
    game.damageEnemy(e, e.maxHp * 1000, { noProc: true });
const arenaGold = game.player.gold;
game.activities.update(0.1);
assert(game.campaign.has(arena));
assert.equal(
  game.player.gold - arenaGold,
  AEGEAN_ACTIVITY_BY_ID[arena].reward.gold,
);
const completedGold = game.player.gold;
use(arena, 0);
assert.equal(
  game.player.gold,
  completedGold,
  "A completed contract cannot pay again inside its cooldown",
);

for (const id of [...AEGEAN_SANCTUARY_IDS, ...AEGEAN_CHAMPION_IDS])
  game.player.flags.add(`aegean:complete:${id}`);
assert(
  game.campaign.access("aegean_leonidas"),
  "Nine island proofs do not replace the army",
);
game.player.flags.add("aegean:complete:aegean_army");
assert.equal(game.campaign.access("aegean_leonidas"), null);
assert(saveGame(game));
assert.equal(
  storage.getItem(BACKUP),
  original,
  "Later saves never replace the original legacy backup",
);
game.input.detach();
console.log(
  "Aegean integration passed: real v1/v2 save migration, army/campaign/mastery/gear/resource persistence, provenance gates, ports/deck/wreck and activity retry/restore/repeat safety.",
);
