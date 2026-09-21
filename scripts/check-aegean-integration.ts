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
const { AEGEAN_PORTS, AEGEAN_WAYSTONES } = await import("../src/data/aegean/world");
const { aegeanWaystoneDestination } = await import("../src/game/aegean/waypoints");
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
assert.equal(game.player.inventory[0].curve, undefined, "Original gear keeps its original progression system");
assert((game.player.inventory[0].stats.damage ?? Infinity) < 9999999);
assert.equal(
  game.itemMigrationReport.filter((r) => r.uid === oldSword.uid).length,
  0,
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

// Achaea uses danger, not a certificate or character level, to set its difficulty.
const veteranLevel = game.player.level;
game.player.level = 1;
game.player.x = 1000 * 32;
game.campaign.update(2);
assert.equal(game.player.x, 1000 * 32, "A level-one visitor is never pushed across the map seam");
assert.equal(game.campaign.access("aegean_nemea"), null);
assert.equal(game.campaign.access("aegean_army"), null, "Anyone may challenge the army");
game.travel("aegean_nemea", 400, 400);
assert(game.fade.pending, "Ordinary travel admits a level-one visitor to a Greek dungeon");
game.fade.pending = null;
game.fade.target = 0;
game.player.level = veteranLevel;
for (const id of AEGEAN_ENTRY_BOSSES) game.player.bossesKilled.add(id);
game.campaign.recordLegacy();
game.campaign.update(2);
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
assert(game.quests.isCompleted("aegean_nemea"), "Encounter victory completes the original Journal entry");
game.turnInQuest("aegean_nemea");
assert.equal(game.player.gold, firstGold, "The Journal cannot pay an encounter reward twice");
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
for (const harbour of AEGEAN_PORTS) {
  const pier = game.naval.boardingPoint(harbour);
  const berth = game.naval.mooringPoint(harbour);
  assert(!boxHitsTerrain(game.map, pier.x, pier.y, 10, 7, 'foot'), `${harbour.name}: boarding point is on the wooden pier`);
  assert(!boxHitsTerrain(game.map, berth.x, berth.y, 16, 12, 'ship'), `${harbour.name}: moored hull fits water`);
  assert(Math.hypot(berth.x - pier.x, berth.y - pier.y) <= 96, `${harbour.name}: boat is visible immediately beside the pier`);
}
const beforeShip = game.player.gold;
assert(game.naval.buy("aegean_skiff"));
assert(!game.naval.aboard, 'Buying does not silently start sailing');
assert.equal(game.naval.state.mooredAt, port.id);
const purchasedBerth = game.naval.mooringPoint(port);
assert.deepEqual(game.naval.drawPosition, purchasedBerth, 'Purchased hull is drawn while the owner is on foot');
assert.deepEqual({ x: game.naval.state.shipX, y: game.naval.state.shipY }, purchasedBerth);
const transforms: number[][] = [];
const hullContext = canvas().getContext('2d')!;
hullContext.translate = (x, y) => { transforms.push([x, y]); };
game.naval.draw(hullContext);
assert.deepEqual(transforms[0], [purchasedBerth.x, purchasedBerth.y], 'The real hull renderer paints the moored boat');
const mooredSave = game.naval.snapshot();
game.naval.restore(mooredSave);
assert.deepEqual(game.naval.drawPosition, purchasedBerth, 'A saved mooring survives restore');
const legacyMooring = { ...mooredSave, lastPort: 'aegean_ember_quay' };
delete legacyMooring.mooredAt;
game.naval.restore(legacyMooring);
assert.equal(game.naval.mooredPort?.id, port.id, 'A pre-fix purchase with an unrelated default harbour is recovered at the current dock');
game.naval.restore(mooredSave);
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
at(game.naval.boardingPoint(port));
assert.equal(game.naval.boardingPort()?.id, port.id, 'The pier tip exposes boarding without returning to the counter');
const interactionHooks = game as unknown as {
  findInteractable(): { label: string; run(): void } | null;
  updateDiscovery(): void;
  useProp(prop: PropInstance): void;
  offerAutoQuests(location?: string, quiet?: boolean): void;
};
const boardAction = interactionHooks.findInteractable();
assert(boardAction, 'The pier has a normal E interaction');
assert.equal(boardAction?.label, `Board ${game.naval.definition!.name}`, 'The normal E prompt identifies the owned ship');
boardAction.run();
assert(game.naval.aboard);
assert.equal(game.naval.mooredPort, undefined, 'An active ship is never also moored');
assert.deepEqual({ x: game.player.x, y: game.player.y }, purchasedBerth, 'Boarding starts in the visible hull beside the pier');
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
const landingAction = interactionHooks.findInteractable();
assert(landingAction, 'A ship in landing range has a visible normal E/USE action');
assert.equal(landingAction.label, `Land at ${port.name}`);
landingAction.run();
assert(!game.naval.aboard, 'The ordinary interaction takes the player ashore');
assert.deepEqual({ x: game.player.x, y: game.player.y }, port.land);
assert.deepEqual(game.naval.drawPosition, purchasedBerth, 'Docking leaves the same ship beside the pier');
at(game.naval.boardingPoint(port));
assert.equal(game.naval.boardingPort(), undefined, 'The landing key press cannot immediately board again');
at(port.land);
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
assert.equal(game.naval.state.mooredAt, emberPort.id, 'The ferry brings the selected hull to the destination harbour');
assert.deepEqual(game.naval.drawPosition, game.naval.mooringPoint(emberPort), 'The ferry leaves the visible hull at its destination pier');
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
assert.equal(royal.enchants.length, 6);
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
  0,
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
  300,
  "An unfinished old chapter restarts the single simultaneous 300-soldier battle",
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
assert(game.activities.state.runs[rescue].retry, "A failed escort waits for deliberate regrouping");
const failedGold = game.player.gold;
for (let tick = 0; tick < 40; tick++) { game.now += .1; game.activities.update(.1); }
assert.equal(game.activities.state.runs[rescue].escort, undefined, "Standing at the failure point cannot restart an unattended assault");
assert.equal(game.player.gold, failedGold, "A failed escort never pays a reward");
assert(!game.enemies.some(e => e.spawnId?.startsWith(`activity:${rescue}:`)));
use(rescue, 1);
assert.equal(game.activities.state.runs[rescue].retry, undefined, "Explicit regrouping clears the local failure state");
function finishEscort(id: string): void {
  for (const index of [2, 3]) {
    const target = station(id, index);
    // Defeat hostile actors using actual Game damage/reward dispatch.
    for (const e of [...game.enemies])
      if (e.spawnId?.startsWith(`activity:${id}:`))
        game.damageEnemy(e, e.maxHp * 1000, { noProc: true });
    // The authored rescue now follows a sheltered landing around real water.
    // Walk the connected route; teleporting over that water cannot provide an
    // escort with footsteps to follow and was never a legal player route.
    const profile = target.data?.movement === "ship" ? "ship" : "foot";
    const hw = profile === "ship" ? 16 : 12, hh = profile === "ship" ? 12 : 10;
    const start = { x: game.player.x, y: game.player.y, parent: -1 };
    const route = [start], seen = new Set([`${start.x},${start.y}`]);
    let goal = -1;
    for (let head = 0; head < route.length; head++) {
      const current = route[head];
      if (current.x === target.x && current.y === target.y) { goal = head; break; }
      for (const [dx, dy] of [[32, 0], [-32, 0], [0, 32], [0, -32]]) {
        const x = current.x + dx, y = current.y + dy, key = `${x},${y}`;
        if (seen.has(key) || Math.abs(x - start.x) > 448 || Math.abs(y - start.y) > 448 ||
          boxHitsTerrain(game.map, x, y, hw, hh, profile) ||
          boxHitsTerrain(game.map, current.x + dx / 2, current.y + dy / 2, hw, hh, profile)) continue;
        seen.add(key); route.push({ x, y, parent: head });
      }
    }
    assert(goal >= 0, `${id}: escort waypoint ${index} has a real route`);
    const path: typeof route = [];
    for (let i = goal; route[i].parent >= 0; i = route[i].parent) path.unshift(route[i]);
    for (const point of path) {
      const from = { x: game.player.x, y: game.player.y };
      for (let tick = 1; tick <= 4; tick++) {
        at({ x: from.x + (point.x - from.x) * tick / 4, y: from.y + (point.y - from.y) * tick / 4 });
        assert(!boxHitsTerrain(game.map, game.player.x, game.player.y, hw, hh, profile));
        game.now += 0.1;
        game.activities.update(0.1);
      }
    }
    for (let i = 0; i < 35; i++) {
      game.now += 0.1;
      game.activities.update(0.1);
    }
    assert(game.activities.interact(target));
    if (index < 3) assert.equal(game.activities.state.runs[id].progress, index);
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
assert.equal(game.activities.current?.type, "dodge", "The old button order cannot solve the physical lane trial");
assert.equal(game.activities.state.runs[arena].progress, 0);
const trialDefenders = game.enemies.filter(e => !e.dead && e.spawnId?.startsWith(`activity:${arena}:`));
assert.equal(trialDefenders.length, 1, "The trial has one visible defender instead of phantom blasts");
for (const e of trialDefenders) game.damageEnemy(e, e.maxHp * 1000, {noProc: true});
at(station(arena, 0));
const trialHp = game.player.hp, trialTelegraphs = game.fx.telegraphs.length;
for (let tick = 0; tick < 100; tick++) { game.now += .1; game.activities.update(.1); }
assert.equal(game.player.hp, trialHp, "An empty trial cannot inflict detached timer damage");
assert.equal(game.fx.telegraphs.length, trialTelegraphs, "Trial work creates no abstract attack fields");
assert.equal(game.enemies.filter(e => !e.dead && e.spawnId?.startsWith(`activity:${arena}:`)).length, 0,
  "Killing the visible defender earns breathing room instead of a replacement loop");
for (const index of [1, 2, 3]) {
  at(station(arena, index));
  for (let tick = 0; tick < 25 && game.activities.current?.type === "dodge"; tick++) {
    game.now += .1; game.activities.update(.1);
  }
}
assert.equal(game.activities.current?.type, "defend", "Occupying the indicated safe lanes completes the trial");
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

// Journal tracking resumes the selected unfinished story, including its real
// next object, rather than pointing at a nearby regional landmark.
const lighthouseStory = "aegean_story_lighthouse";
const namesStory = "aegean_story_names";
use(lighthouseStory, 0);
use(lighthouseStory, 1);
assert.equal(game.activities.state.runs[lighthouseStory].progress, 1);
use(namesStory, 0);
assert.equal(game.activities.active?.id, namesStory);
const beforeTrackingGold = game.player.gold;
game.trackQuest(lighthouseStory);
assert.equal(game.activities.active?.id, lighthouseStory);
assert.equal(game.activities.state.runs[lighthouseStory].progress, 1, "Resuming preserves found evidence");
assert.equal(game.quests.get(lighthouseStory)?.progress[0], 1);
const nextRecord = station(lighthouseStory, 2);
assert.deepEqual(game.trackedTarget(), {
  x: nextRecord.x, y: nextRecord.y, name: nextRecord.label,
}, "The compass identifies the next unread wreck record");
game.trackQuest(lighthouseStory);
assert.equal(game.trackedQuest, null, "Tracking the same quest still toggles tracking off");
assert.equal(game.activities.active?.id, lighthouseStory);
game.trackQuest("tutorial");
assert.equal(game.trackedQuest, "tutorial");
assert.equal(game.activities.active?.id, lighthouseStory, "Ordinary quest tracking does not switch stories");
game.trackQuest(rescue);
assert.equal(game.activities.state.runs[rescue], undefined, "Tracking a finished contract does not replay it");
assert.equal(game.activities.active?.id, lighthouseStory);
game.trackQuest("aegean_discovery_first_dawn");
assert.equal(game.activities.state.runs.aegean_discovery_first_dawn, undefined, "Tracking cannot unlock an unaccepted story");
assert(!game.campaign.has("aegean_leonidas"));
assert.equal(game.player.gold, beforeTrackingGold, "Tracking never pays a story reward");
game.trackQuest(null);

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
// A rebuilt coast must never strand a saved character or hull inside terrain.
game.setMap("overworld");
game.naval.state.aboard = false;
delete game.naval.state.deck;
game.naval.state.visitedPorts = [];
const deepSea = { x: 1900 * 32, y: 60 * 32 };
assert(boxHitsTerrain(game.map, deepSea.x, deepSea.y, 10, 7));
const assertSafeFoot = () => {
  assert(Number.isFinite(game.player.x) && Number.isFinite(game.player.y));
  assert(!boxHitsTerrain(game.map, game.player.x, game.player.y, 10, 7));
  assert(!game.propBlocks(game.player.x, game.player.y, 10, 7));
  assert(!game.naval.aboard);
};
const assertSafeHull = () => {
  assert.equal(game.map.id, "overworld");
  assert(game.naval.aboard);
  assert(Number.isFinite(game.player.x) && Number.isFinite(game.player.y));
  assert(!boxHitsTerrain(game.map, game.player.x, game.player.y, 16, 12, "ship"));
  assert.equal(game.naval.state.shipX, game.player.x);
  assert.equal(game.naval.state.shipY, game.player.y);
};
const recoveryGold = game.player.gold;
const recoveryEquipment = JSON.stringify(game.player.equipment);
assert(game.recoverSavedPosition(deepSea.x, deepSea.y));
assertSafeFoot();
assert(game.player.x < 960 * 32, "Unvisited seas recover to Ashvale");
const safeHome = { x: game.player.x, y: game.player.y };
assert.equal(game.recoverSavedPosition(safeHome.x, safeHome.y), false);
assert.deepEqual({ x: game.player.x, y: game.player.y }, safeHome);
assert(game.recoverSavedPosition(NaN, Infinity));
assertSafeFoot();
game.naval.state.visitedPorts = [port.id];
assert(game.recoverSavedPosition(deepSea.x, deepSea.y));
assertSafeFoot();
assert(
  Math.hypot(game.player.x - port.land.x, game.player.y - port.land.y) < 100,
  "A known mainland harbour is preferred when resuming from the Greek sea",
);
assert.equal(game.player.gold, recoveryGold, "Position recovery costs no gold");
assert.equal(JSON.stringify(game.player.equipment), recoveryEquipment);

game.naval.state.selected = "aegean_skiff";
game.naval.state.lastPort = port.id;
game.naval.state.aboard = true;
assert(boxHitsTerrain(game.map, safeHome.x, safeHome.y, 16, 12, "ship"));
assert(game.recoverSavedPosition(safeHome.x, safeHome.y));
assertSafeHull();
const safeWater = { x: game.player.x, y: game.player.y };
assert.equal(game.recoverSavedPosition(safeWater.x, safeWater.y), false);
assert.deepEqual({ x: game.player.x, y: game.player.y }, safeWater);
assert(game.recoverSavedPosition(NaN, Infinity));
assertSafeHull();

// Unknown checkpoint maps must use the real fallback map for residents/state.
game.naval.state.aboard = false;
game.campaign.state.checkpoint = { map: "missing-checkpoint", x: NaN, y: Infinity };
at(deepSea);
game.player.dead = true;
game.player.hp = 0;
game.screen = "dead";
game.respawnPlayer();
assert.equal(game.screen, "playing");
assert.equal(game.map.id, "overworld");
assert(!game.player.dead && game.player.hp > 0);
assertSafeFoot();
assert(game.npcs.length > 0, "A corrupt checkpoint still restores the overworld's residents");

// Boarding saves keep their old sea coordinates; those may now be dry land.
game.naval.state.deck = { ...safeHome, enemies: [] };
game.naval.buildDeck();
game.setMap("aegean_ship_deck");
game.enemies = [];
game.naval.state.aboard = false;
assert(game.naval.returnHelm());
assert.equal(game.naval.state.deck, undefined);
assertSafeHull();
assert.equal(storage.getItem(BACKUP), original, "Recovery never changes the original backup");

// Real Game interactions use the same port receipts and destination maps as the
// waypoint layout. These scenarios reuse the existing generated world.
game.naval.state.aboard = false;
game.setMap('overworld');
game.closeAll();
game.fade.pending = null;
game.fade.alpha = game.fade.target = 0;
game.lastDamageTaken = -Infinity;
const finishTravel = () => {
  const pending = game.fade.pending;
  assert(pending, 'An accepted journey schedules real map travel');
  game.fade.pending = null;
  pending();
  game.fade.alpha = game.fade.target = 0;
};
const stonePosition = (id: string) => {
  const stone = AEGEAN_WAYSTONES.find((entry) => entry.id === id);
  assert(stone, `Missing waypoint ${id}`);
  return { x: (stone.tx + .5) * 32, y: (stone.ty + 1) * 32 };
};

// Coming from the west reaches Thyra's offset stone before the town's
// discovery circle. That first encounter still pays XP and advances/offers
// quests once; stepping into town or using the stone must not pay again.
const discoveryLevel = game.player.level, discoveryXp = game.player.xp;
const exploreLocations: string[] = [], offeredLocations: Array<string | undefined> = [];
const originalExplore = game.quests.onExplore;
const originalOffer = interactionHooks.offerAutoQuests;
game.quests.onExplore = function(location) {
  exploreLocations.push(location);
  return originalExplore.call(this, location);
};
interactionHooks.offerAutoQuests = function(location, quiet) {
  offeredLocations.push(location);
  return originalOffer.call(game, location, quiet);
};
try {
  game.player.level = 76;
  game.player.xp = 0;
  game.player.discovered.delete('aegean_thyra');
  game.player.waystones.delete('aegean_thyra');
  assert(!game.player.hasPerk('keensight'), 'Fixture uses the normal discovery radius');
  at({ x: 983 * 32, y: 401 * 32 });
  assert(Math.hypot(983 - 1008, 401 - 405) > 23, 'West approach is outside the normal town radius');
  interactionHooks.updateDiscovery();
  assert(game.player.discovered.has('aegean_thyra'));
  assert(game.player.waystones.has('aegean_thyra'));
  assert.equal(game.player.xp, 785, 'The offset-stone first visit pays Thyra discovery XP');
  assert.equal(exploreLocations.filter((id) => id === 'aegean_thyra').length, 1, 'The first stone visit advances exploration quests');
  assert.equal(offeredLocations.filter((id) => id === 'aegean_thyra').length, 1, 'The first stone visit offers local quests');
  at({ x: 1008 * 32, y: 405 * 32 });
  interactionHooks.updateDiscovery();
  const thyraStone = game.map.props.find((prop) => prop.interact === 'waystone' && prop.data?.site === 'aegean_thyra');
  assert(thyraStone);
  interactionHooks.useProp(thyraStone);
  interactionHooks.updateDiscovery();
  assert.equal(game.player.xp, 785, 'Entering town and reusing its stone cannot repeat XP');
  assert.equal(exploreLocations.filter((id) => id === 'aegean_thyra').length, 1, 'Exploration callbacks run exactly once');
  assert.equal(offeredLocations.filter((id) => id === 'aegean_thyra').length, 1, 'Local quest offers run exactly once');
} finally {
  game.quests.onExplore = originalExplore;
  interactionHooks.offerAutoQuests = originalOffer;
  game.player.level = discoveryLevel;
  game.player.xp = discoveryXp;
  game.closeAll();
}

// Backfill earned discoveries without pretending to rediscover them for XP.
at({ x: 16, y: 16 });
game.player.discovered.add('aegean_thyra');
game.player.waystones.delete('aegean_thyra');
game.player.discovered.delete('aegean_harbour_crete');
game.player.waystones.delete('aegean_harbour_crete');
game.naval.state.visitedPorts = ['aegean_crete'];
const backfillXp = game.player.xp;
interactionHooks.updateDiscovery();
assert(game.player.waystones.has('aegean_thyra'), 'Existing mainland discoveries receive their new waystones');
assert(game.player.waystones.has('aegean_harbour_crete'), 'A saved landing receipt receives its new harbour waystone');
assert.equal(game.player.xp, backfillXp, 'Waystone backfill never replays discovery XP');

const creteStone = game.map.props.find((prop) => prop.interact === 'waystone' && prop.data?.site === 'aegean_harbour_crete');
assert(creteStone, 'Crete has a real installed waystone');
game.player.waystones.delete('aegean_harbour_crete');
game.naval.state.visitedPorts = [];
at(stonePosition('aegean_harbour_crete'));
interactionHooks.updateDiscovery();
assert(!game.player.waystones.has('aegean_harbour_crete'), 'Seeing an island without docking does not unlock its harbour');
interactionHooks.useProp(creteStone);
assert(!game.player.waystones.has('aegean_harbour_crete'), 'Using an island stone cannot fabricate a landing receipt');
game.naval.state.visitedPorts = ['aegean_crete'];
game.naval.state.aboard = true;
interactionHooks.updateDiscovery();
interactionHooks.useProp(creteStone);
assert(!game.player.waystones.has('aegean_harbour_crete'), 'Aboard a ship, discovery and use both leave the island stone locked');
game.naval.state.aboard = false;
interactionHooks.updateDiscovery();
assert(game.player.waystones.has('aegean_harbour_crete'), 'A visited island attunes after stepping ashore');
game.closeAll();

// Surface discovery does not unlock every floor of the Underworld.
at({ x: 16, y: 16 });
game.player.discovered.add('aegean_acheron');
game.player.waystones.delete('aegean_acheron');
interactionHooks.updateDiscovery();
assert(!game.player.waystones.has('aegean_acheron'), 'A surface entrance receipt cannot backfill an unseen Underworld waypoint');
game.setMap('aegean_acheron');
at(stonePosition('aegean_acheron'));
interactionHooks.updateDiscovery();
assert(game.player.waystones.has('aegean_acheron'), 'Reaching Acheron on its actual map attunes its waystone');
const underworldXp = game.player.xp;
interactionHooks.updateDiscovery();
assert.equal(game.player.xp, underworldXp, 'Standing by the Underworld stone cannot repeat XP');
game.setMap('overworld');
at(port.land);
game.travelToWaystone('aegean_acheron');
finishTravel();
const acheronDestination = aegeanWaystoneDestination('aegean_acheron')!;
assert.equal(game.map.id, acheronDestination.mapId, 'Fast travel returns to Acheron, not the overworld at dungeon coordinates');
assert(Math.hypot(game.player.x - acheronDestination.x, game.player.y - acheronDestination.y) < 80);
assert(!boxHitsTerrain(game.map, game.player.x, game.player.y, 10, 7), 'The Underworld arrival is walkable');
game.travelToWaystone('aegean_thyra');
finishTravel();
assert.equal(game.map.id, 'overworld');
const thyraDestination = aegeanWaystoneDestination('aegean_thyra')!;
assert(Math.hypot(game.player.x - thyraDestination.x, game.player.y - thyraDestination.y) < 80);

game.player.waystones.add('aegean_island_asterion');
game.travelToWaystone('aegean_island_asterion');
assert.equal(game.fade.pending, null, 'Even a stale attunement cannot teleport to Leonidas island');
game.player.waystones.add('aegean_harbour_asterion');
game.travelToWaystone('aegean_harbour_asterion');
assert.equal(game.fade.pending, null, 'A stale royal harbour attunement cannot replace the first actual landing');
game.naval.state.visitedPorts.push(islandPort.id);
game.travelToWaystone('aegean_harbour_asterion');
assert(game.fade.pending, 'After the first sea landing, the real royal harbour stone can be used');
finishTravel();
const royalHarbour = aegeanWaystoneDestination('aegean_harbour_asterion')!;
assert(Math.hypot(game.player.x - royalHarbour.x, game.player.y - royalHarbour.y) < 80);
game.travelToWaystone('aegean_thyra');
assert(game.fade.pending, 'Asterion waystones provide a real journey home after attunement');
finishTravel();
assert(Math.hypot(game.player.x - thyraDestination.x, game.player.y - thyraDestination.y) < 80);

// The Gate Market is an actual shop building with the normal trading flow.
const marketDoor = game.map.portals.find((portal) => portal.to === 'int_aegean_thyra_market');
assert(marketDoor);
at({ x: marketDoor.x + marketDoor.w / 2, y: marketDoor.y + marketDoor.h / 2 });
assert(!game.propBlocks(game.player.x, game.player.y, 10, 7), 'The Gate Market threshold is outside its facade collision');
const marketAction = interactionHooks.findInteractable();
assert(marketAction?.label.includes('Gate Market'), 'The normal E prompt opens the Gate Market threshold');
marketAction.run();
finishTravel();
assert.equal(game.map.id, 'int_aegean_thyra_market');
const factor = game.npcs.find((npc) => npc.def.id === 'aegean_thyra_factor');
assert(factor, 'Lysandra is spawned inside the trading hall');
game.openShop(factor.def);
assert(game.shop, 'The caravan factor opens a trading window');
assert.equal(game.shop?.shopId, 'aegean_thyra_gate_market');
const bread = game.shop.stock.find((item) => item.defId === 'food_bread');
assert(bread, 'The market stocks provisions');
game.player.inventory = [];
const tradingGold = game.player.gold;
game.buyItem(bread.uid);
assert.equal(countItem(game.player.inventory, 'food_bread'), 1, 'Buying from Lysandra uses the original inventory flow');
assert(game.player.gold < tradingGold);
const afterPurchaseGold = game.player.gold;
game.sellItem(game.player.inventory.find((item) => item.defId === 'food_bread')!.uid);
assert.equal(countItem(game.player.inventory, 'food_bread'), 0, 'Lysandra also buys travelling goods');
assert(game.player.gold > afterPurchaseGold && game.player.gold < tradingGold);
game.input.detach();
// Old broad-arena saves must resume inside the compact dungeon, not outside
// its new tile bounds or back on the unrelated mainland.
game.naval.state.aboard = false;
delete game.naval.state.deck;
const beforeCompactGear = JSON.stringify(game.player.equipment);
const beforeCompactGold = game.player.gold;
game.setMap("aegean_hydra");
assert(game.recoverSavedPosition(3200, 2400), "Old Hydra coordinates require relocation");
assert.equal(game.map.id, "aegean_hydra", "Compaction keeps the saved dungeon destination");
assertSafeFoot();
assert(game.player.x >= 0 && game.player.x < game.map.w * 32 && game.player.y >= 0 && game.player.y < game.map.h * 32);
const compactExit = game.map.portals.find(portal => portal.kind === "stairs")!;
assert(Math.hypot(game.player.x - compactExit.x - compactExit.w / 2, game.player.y - compactExit.y - compactExit.h - 18) < 100,
  "A distant old coordinate returns to the new reachable entrance");
assert.equal(game.player.gold, beforeCompactGold);
assert.equal(JSON.stringify(game.player.equipment), beforeCompactGear, "Map resize never changes equipment");

console.log(
  "Aegean integration passed: real v1/v2 save migration, army/campaign/mastery/gear/resource persistence, provenance gates, ports/deck/wreck, rebuilt-coast/checkpoint recovery and activity retry/restore/repeat safety.",
);
