/** Bounded data, acquisition and equipment regressions. Run with the project's TS runner. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AEGEAN_GEAR,
  AEGEAN_ITEMS,
  AEGEAN_ISLAND_ITEM_SOURCES,
  AEGEAN_RECIPES,
  AEGEAN_REWARDS,
  AEGEAN_SHIPS,
} from "../src/data/aegean/content";
import {
  AEGEAN_ACTIVITIES,
  AEGEAN_CHAPTERS,
  AEGEAN_CONTRACTS,
  AEGEAN_DISCOVERIES,
  AEGEAN_LABOUR_IDS,
  AEGEAN_STORIES,
  OLD_WORLD_TESTAMENT,
} from "../src/data/aegean/progression";
import { DROPPABLE, TEMPLATE_BY_ID } from "../src/data/items";
import { RARITY_POWER } from "../src/data/balance";
import { AEGEAN_POWERS } from "../src/game/items/effects";
import {
  makeItem,
  normalizeItemCurve,
  relevelItem,
  rollRarity,
  scaleStats,
  validItemProvenance,
} from "../src/game/items/loot";
import {
  RARITY_AFFIXES,
  RARITY_ENCHANT_SLOTS,
  RARITY_ORDER,
  ROLLABLE_RARITIES,
  type Item,
} from "../src/game/items/types";
import { RNG } from "../src/game/core/rng";
import { AegeanPowers } from "../src/game/aegean/powers";
import type { Game } from "../src/game/core/game";
import type { Enemy } from "../src/game/entities/enemy";
import { T } from "../src/game/world/tiles";

assert.equal(AEGEAN_GEAR.length, 36);
assert.deepEqual(
  ["mainHand", "offHand", "armor", "accessory"].map(
    (slot) => AEGEAN_GEAR.filter((item) => item.slot === slot).length,
  ),
  [18, 8, 5, 5],
);
assert.equal(
  new Set(AEGEAN_ITEMS.map((item) => item.id)).size,
  AEGEAN_ITEMS.length,
);
assert.equal(new Set(AEGEAN_GEAR.map((item) => item.aegeanPower)).size, 36);
assert.deepEqual(RARITY_ORDER.slice(-3), ["mythic", "olympian", "primordial"]);
assert.equal(RARITY_POWER.olympian, 1.52);
assert.equal(RARITY_POWER.primordial, 1.68);
for (const tier of ["olympian", "primordial"] as const) {
  assert.equal(RARITY_AFFIXES[tier], 4);
  assert.equal(RARITY_ENCHANT_SLOTS[tier], 4);
  assert(!ROLLABLE_RARITIES.includes(tier));
}
for (const item of AEGEAN_GEAR) {
  assert(TEMPLATE_BY_ID[item.id], item.id);
  assert(
    item.noDrop && !DROPPABLE.some((drop) => drop.id === item.id),
    `${item.id} leaked into random loot`,
  );
  assert(
    item.aegeanPower && AEGEAN_POWERS[item.aegeanPower],
    `${item.id} has no executable power`,
  );
  assert(
    AEGEAN_RECIPES.some((recipe) => recipe.item === item.id) ||
      Object.values(AEGEAN_REWARDS).some(
        (reward) =>
          reward.items?.includes(item.id) || reward.choice?.includes(item.id),
      ),
    `${item.id} cannot be acquired`,
  );
  if (item.rarity === "primordial") {
    assert(
      AEGEAN_ISLAND_ITEM_SOURCES[item.id]?.length,
      `${item.id} has no source rule`,
    );
    assert.throws(() => makeItem(item.id), /provenance/);
    assert.throws(
      () =>
        makeItem(item.id, {
          provenance: { source: "reward", id: "aegean_nemea" },
        }),
      /provenance/,
    );
    const source = AEGEAN_ISLAND_ITEM_SOURCES[item.id][0];
    assert(
      validItemProvenance(item.id, {
        source: source.includes("_recipe_") ? "craft" : "reward",
        id: source,
        region: "aegean_asterion",
      }),
    );
    assert(
      !validItemProvenance(item.id, {
        source: "reward",
        id: source,
        region: "aegean_arcadia",
      }),
    );
    const legal = makeItem(item.id, {
      rng: new RNG(item.id),
      provenance: {
        source: source.includes("_recipe_") ? "craft" : "reward",
        id: source,
        region: "aegean_asterion",
      },
    });
    assert.equal(legal.rarity, "primordial");
    assert.equal(legal.enchantSlots, 4);
    assert.equal(legal.enchants.length, 4);
    assert.equal(legal.curve?.affixes.length, 4);
  }
}
for (const recipe of AEGEAN_RECIPES) {
  assert(TEMPLATE_BY_ID[recipe.item], `Unknown recipe output ${recipe.item}`);
  for (const material of recipe.materials)
    assert(
      TEMPLATE_BY_ID[material.id] && material.count > 0,
      `Invalid ingredient ${material.id}`,
    );
  if (TEMPLATE_BY_ID[recipe.item].rarity === "primordial")
    assert(recipe.islandOnly && recipe.station === "oath");
}
assert.equal(AEGEAN_SHIPS.length, 4);
assert.deepEqual(
  AEGEAN_SHIPS.find((ship) => ship.id === "aegean_stormbreaker")!.requirements,
  [
    "aegean_army",
    "aegean:component:ribs",
    "aegean:component:sail",
    "aegean:component:keel",
  ],
);
const rng = new RNG(90210);
for (let i = 0; i < 1000; i++)
  assert(
    !["mythic", "olympian", "primordial"].includes(
      rollRarity(rng, 500, 5, 100),
    ),
  );
assert.throws(
  () => makeItem("sword_iron", { rarity: "olympian" }),
  /authored template/,
);
assert.throws(
  () => makeItem("sword_iron", { rarity: "primordial" }),
  /authored template/,
);
// A source-level check keeps this pure-data script free of a browser Game instance.
const gameSource = readFileSync(
  resolve(process.cwd(), "src/game/core/game.ts"),
  "utf8",
);
const elevateSource = gameSource.slice(
  gameSource.indexOf("  canElevate("),
  gameSource.indexOf("  royalElevate("),
);
assert(
  elevateSource.includes(
    "['common', 'rare', 'superRare', 'epic', 'legendary']",
  ),
  "Crown promotion must stop at Legendary",
);

assert.equal(AEGEAN_CHAPTERS.length, 8);
assert(AEGEAN_CHAPTERS.every((chapter) => chapter.steps.length === 4));
assert.equal(AEGEAN_STORIES.length, 16);
assert.equal(AEGEAN_CONTRACTS.length, 12);
assert.equal(AEGEAN_DISCOVERIES.length, 24);
assert.equal(AEGEAN_LABOUR_IDS.length, 12);
assert.equal(OLD_WORLD_TESTAMENT.dungeons.length, 25);
assert.equal(OLD_WORLD_TESTAMENT.bosses.length, 16);
assert.equal(OLD_WORLD_TESTAMENT.minibosses.length, 8);
assert.equal(
  new Set(AEGEAN_ACTIVITIES.map((activity) => activity.id)).size,
  AEGEAN_ACTIVITIES.length,
);
for (const activity of AEGEAN_ACTIVITIES) {
  assert(
    activity.steps.length > 0 &&
      activity.steps.every(
        (step) => step.target && step.label && step.count > 0,
      ),
  );
  assert(
    AEGEAN_REWARDS[activity.id],
    `${activity.id} lacks a first-clear reward`,
  );
  for (const step of activity.steps)
    if (step.type === "puzzle") assert.equal(step.sequence?.length, step.count);
}

// The exact same roll taken through 99 forge upgrades must equal a fresh curve-priced roll.
const stepped = makeItem("sword_iron", {
  level: 1,
  rarity: "epic",
  rng: new RNG(18971),
});
const initialRolls = structuredClone(stepped.curve!.affixes);
const initialEnchants = structuredClone(stepped.enchants);
for (let level = 2; level <= 100; level++) relevelItem(stepped, level);
const direct = makeItem("sword_iron", {
  level: 100,
  rarity: "epic",
  rng: new RNG(18971),
});
assert.deepEqual(
  stepped.stats,
  direct.stats,
  "Repeated forge upgrades must not compound",
);
assert.deepEqual(
  stepped.curve!.affixes,
  initialRolls,
  "The exact random roll must survive reforge",
);
assert.deepEqual(
  stepped.enchants,
  initialEnchants,
  "Reforge must not reroll enchantments",
);
assert.equal(stepped.curve!.reforges, 99);
relevelItem(stepped, 10000);
assert.equal(stepped.level, 100);
const snapshot = JSON.stringify(stepped);
assert.equal(normalizeItemCurve(stepped), null);
assert.equal(JSON.stringify(stepped), snapshot, "Migration must be idempotent");

const legacy = makeItem("sword_iron", {
  level: 75,
  rarity: "epic",
  rng: new RNG(7),
});
const legacyId = legacy.uid,
  legacyRunes = structuredClone(legacy.enchants);
delete legacy.curve;
legacy.stats.damage = (legacy.stats.damage ?? 1) * 40;
legacy.stats.defense = 99999;
const migration = normalizeItemCurve(legacy);
assert(migration?.legacyRollsEstimated, "Legacy uncertainty must be reported");
assert.equal(legacy.uid, legacyId);
assert.deepEqual(legacy.enchants, legacyRunes);
assert.equal(
  legacy.stats.damage,
  scaleStats(TEMPLATE_BY_ID.sword_iron, 75, "epic").damage,
);
assert(
  (legacy.stats.defense ?? 0) < 1000,
  "Old exponential affixes must be bounded",
);
const migrated = JSON.stringify(legacy);
assert.equal(normalizeItemCurve(legacy), null);
assert.equal(JSON.stringify(legacy), migrated);

function runtime() {
  const player = {
    x: 160,
    y: 176,
    radius: 10,
    facing: 0,
    hp: 700,
    maxHp: 1000,
    mp: 150,
    maxMp: 200,
    sp: 80,
    maxSp: 150,
    dead: false,
    bracing: false,
    blocking: false,
    buffs: [],
    statuses: [],
    equipment: {
      mainHand: null,
      offHand: null,
      armor: null,
      accessory: null,
    } as Record<string, Item | null>,
    stats: () => ({ cooldownReduction: 0 }),
    attackPower: () => 100,
    attackRange: () => 120,
  };
  const enemy = {
    id: 100,
    x: 280,
    y: 176,
    radius: 15,
    hp: 10000,
    maxHp: 10000,
    dead: false,
    friendly: false,
    warded: false,
    isBoss: false,
    statuses: [],
    lastImpact: null,
    windupAttack: null,
  } as unknown as Enemy;
  let hits = 0;
  const game = {
    now: 100,
    player,
    enemies: [enemy],
    projectiles: [],
    naval: { aboard: false },
    map: {
      id: "aegean_test",
      w: 24,
      h: 24,
      tiles: new Uint8Array(24 * 24).fill(T.GRASS),
      props: [],
      portals: [],
      spawns: [],
      chests: [],
    },
    encounters: {
      exposureActive: false,
      active: false,
      suppressOffense: false,
      cleansePressure: () => {},
    },
    bestTarget: () => enemy,
    aimAngle: () => 0,
    damageEnemy: (target: Enemy, amount: number) => {
      target.hp -= amount;
      hits++;
    },
    floatText: () => {},
    ringAt: () => {},
    telegraph: () => {},
    touch: () => {},
  } as unknown as Game;
  const powers = new AegeanPowers(game);
  powers.update(0);
  return { game, player, enemy, powers, hits: () => hits };
}

{
  const { player, powers } = runtime();
  player.equipment.mainHand = makeItem("aegean_thunder_javelins", {
    plain: true,
  });
  assert(powers.consumeAttack(player.equipment.mainHand));
  assert(powers.consumeAttack(player.equipment.mainHand));
  assert(powers.consumeAttack(player.equipment.mainHand));
  assert(
    !powers.consumeAttack(player.equipment.mainHand),
    "The fourth javelin must wait",
  );
  powers.update(1.3);
  assert.equal(powers.javelinCharges, 1);
  assert(powers.consumeAttack(player.equipment.mainHand));
}
{
  const { player, powers, enemy, hits } = runtime();
  const bow = makeItem("aegean_artemis_bow", { plain: true });
  player.equipment.mainHand = bow;
  assert(powers.activate(bow));
  const firstHits = hits();
  for (let n = 0; n < 20; n++) assert(!powers.activate(bow));
  assert.equal(hits(), firstHits, "Cooldown blocks repeated activations");
  assert.equal(
    powers.onHit(enemy, 100, { noProc: true }),
    100,
    "Proc damage cannot recursively earn another proc",
  );
  assert(
    powers.onHit(enemy, 100, {}) > 100,
    "A marked target receives its stated opening bonus",
  );
}
{
  const { player, powers } = runtime();
  const kopis = makeItem("aegean_kopis_nemea", { plain: true });
  player.equipment.mainHand = kopis;
  assert(
    !powers.activate(kopis),
    "A conditional weapon must require its actual event",
  );
  powers.onDodge();
  assert(powers.activate(kopis));
  assert(!powers.activate(kopis));
}
{
  const { player, powers, game } = runtime();
  const aspis = makeItem("aegean_aspis_sparta", { plain: true });
  player.equipment.offHand = aspis;
  powers.onBrace();
  assert(powers.activate(aspis));
  const reduced = powers.onHurt(100, {});
  assert(
    reduced >= 60 && reduced < 100,
    "Defensive powers are bounded, never invulnerability",
  );
  assert.equal(
    powers.onHurt(100, { trueDamage: true }),
    100,
    "Execution mechanics bypass ordinary wards",
  );
  game.now += 20;
  powers.update(20);
  assert.equal(powers.onHurt(100, {}), 100, "Wards expire");
}
{
  const { player, powers, game } = runtime();
  const thread = makeItem("aegean_ariadne_thread", { plain: true });
  player.equipment.accessory = thread;
  assert(powers.activate(thread));
  player.x = 272;
  game.map.tiles[5 * 24 + 6] = T.WALL_STONE;
  assert(!powers.activate(thread), "Ariadne cannot return through a wall");
  assert.equal(player.x, 272);
  game.map.tiles[5 * 24 + 6] = T.GRASS;
  assert(
    powers.activate(thread),
    "A safe return is allowed during the original activation cooldown",
  );
  assert.equal(player.x, 160);
  assert(!powers.activate(thread), "The consumed mark cannot be reused");
}
{
  const { player, powers, game } = runtime();
  const thread = makeItem("aegean_ariadne_thread", { plain: true });
  player.equipment.accessory = thread;
  assert(powers.activate(thread));
  game.map.id = "other_map";
  player.x = 240;
  powers.update(0.1);
  assert(!powers.activate(thread), "Changing maps cannot retain a return mark");
  assert.equal(player.x, 240);
}

{
  const source = runtime(),
    loaded = runtime();
  const bow = makeItem("aegean_artemis_bow", { plain: true });
  source.player.equipment.mainHand = bow;
  assert(source.powers.activate(bow));
  source.game.now += 2;
  const saved = source.powers.snapshot();
  assert.equal(saved.cooldowns.aegean_hunt_mark, 10);
  loaded.game.now = 9000;
  loaded.player.equipment.mainHand = bow;
  loaded.powers.restore(JSON.parse(JSON.stringify(saved)));
  assert.equal(
    loaded.powers.cooldown(bow),
    10,
    "Reload preserves remaining cooldown independently of the engine clock",
  );
  assert(!loaded.powers.activate(bow), "Reload cannot grant a free activation");
  assert.equal(
    loaded.powers.onHit(loaded.enemy, 100),
    100,
    "A regenerated enemy cannot inherit the old actor’s mark",
  );
  saved.cooldowns.aegean_hunt_mark = 0;
  assert.equal(
    source.powers.cooldown(bow),
    10,
    "Snapshots never expose mutable live cooldown state",
  );
  loaded.game.now += 9.9;
  loaded.powers.update(9.9);
  assert(!loaded.powers.activate(bow));
  loaded.game.now += 0.2;
  loaded.powers.update(0.2);
  assert(
    loaded.powers.activate(bow),
    "The original remaining cooldown expires normally",
  );
}
{
  const source = runtime(),
    loaded = runtime();
  const javelin = makeItem("aegean_thunder_javelins", { plain: true });
  source.player.equipment.mainHand = javelin;
  for (let n = 0; n < 3; n++) assert(source.powers.consumeAttack(javelin));
  source.powers.update(0.65);
  loaded.game.now = 8000;
  loaded.powers.restore(source.powers.snapshot());
  assert.equal(
    loaded.powers.javelinCharges,
    0,
    "Loading does not replenish expended javelins",
  );
  assert(!loaded.powers.consumeAttack(javelin));
  loaded.powers.update(0.64);
  assert.equal(loaded.powers.javelinCharges, 0);
  loaded.powers.update(0.02);
  assert.equal(
    loaded.powers.javelinCharges,
    1,
    "Partial javelin recovery survives loading",
  );
}
{
  const { player, powers, game, enemy } = runtime();
  const sceptre = makeItem("aegean_first_flame_sceptre", {
    plain: true,
    provenance: { source: "debug", id: "regression" },
  });
  player.equipment.mainHand = sceptre;
  assert(powers.activate(sceptre));
  const mana = player.mp,
    snapshot = powers.snapshot();
  assert.equal(snapshot.flamePattern, 1);
  // Practice enters with fresh resources, then restores the frozen real attempt.
  powers.reset();
  player.mp = player.maxMp;
  assert.equal(powers.snapshot().flamePattern, 0);
  assert(powers.activate(sceptre));
  game.now += 100;
  powers.restore(snapshot);
  player.mp = mana;
  assert.equal(
    powers.snapshot().flamePattern,
    1,
    "Practice cannot consume or reset the real flame sequence",
  );
  assert.equal(
    powers.cooldown(sceptre),
    10,
    "Practice time cannot discharge a real cooldown",
  );
  assert.equal(player.mp, mana);
  game.now += 10;
  powers.update(10);
  const hp = enemy.hp;
  assert(powers.activate(sceptre));
  assert.equal(
    hp - enemy.hp,
    190,
    "After restore, the second flame is the fan rather than another lance",
  );
  assert.equal(
    player.mp,
    mana - 30,
    "The restored cycle still spends its normal mana",
  );
}
{
  const { player, powers } = runtime();
  const thread = makeItem("aegean_ariadne_thread", { plain: true });
  player.equipment.accessory = thread;
  assert(powers.activate(thread));
  const saved = powers.snapshot();
  player.x = 272;
  powers.restore(saved);
  assert(
    !powers.activate(thread),
    "Loading cannot revive a spatial return point",
  );
  assert.equal(player.x, 272);
  assert.equal(
    powers.cooldown(thread),
    20,
    "Discarding a return point does not refund its cooldown",
  );
  powers.restore({
    version: 1,
    cooldowns: {
      aegean_ariadne_return: 999999,
      unknown: 100,
      aegean_hunt_mark: NaN,
    },
    javelins: -4,
    javelinRecovery: Infinity,
    flamePattern: 50,
  });
  const bounded = powers.snapshot();
  assert.deepEqual(bounded.cooldowns, { aegean_ariadne_return: 20 });
  assert.equal(bounded.javelins, 0);
  assert.equal(bounded.javelinRecovery, 0);
  assert.equal(bounded.flamePattern, 2);
  powers.restore();
  assert.equal(
    powers.javelinCharges,
    3,
    "Older saves without equipment state receive default ready charges",
  );
  assert.equal(powers.cooldown(thread), 0);
}

console.log(
  "Aegean content: 36 gear identities, acquisition/provenance, 8 chapters, 16 stories, 12 contracts, 24 discoveries, curve migration, bounded powers and reload/practice persistence passed.",
);
