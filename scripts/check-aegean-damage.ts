/** Actual Enemy attacks -> Game.damagePlayer -> Player HP, without creating a
 * world, renderer or game loop. Measures legal six-class builds and uses the
 * production forge for both original and Greek equipment. These are repeatable
 * landed-hit checks, not a claim of human combat playtesting. */
import assert from "node:assert/strict";
import { CLASSES, type ClassId } from "../src/data/classes";
import { AEGEAN_ATTACKS, AEGEAN_ENEMIES } from "../src/data/aegean/enemies";
import type { BossAttack } from "../src/data/enemies";
import { Enemy } from "../src/game/entities/enemy";
import { Player } from "../src/game/player/player";
import { makeItem } from "../src/game/items/loot";
import { AegeanPowers } from "../src/game/aegean/powers";
import { createMap } from "../src/game/world/map";
import { T } from "../src/game/world/tiles";
import type { Game as GameType } from "../src/game/core/game";
import type { DamageOpts } from "../src/game/core/world";

const noop = () => {};
Object.assign(globalThis, {
  window: new EventTarget(),
  document: {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => new Proxy({}, { get: () => noop }),
    }),
  },
});
const { Game } = await import("../src/game/core/game");
const branches: Record<ClassId, string[]> = {
  warrior: ["Power", "Berserker"],
  ranger: ["Bow", "Traps"],
  mage: ["Fire", "Arcane"],
  rogue: ["Critical", "Poison"],
  paladin: ["Faith", "Retribution"],
  necromancer: ["Death", "Blight"],
};
const map = createMap({ id: "aegean_medusa", name: "Damage test", w: 64, h: 64 });
map.tiles.fill(T.MARBLE);
const warnings: Array<{ x: number; y: number; time: number }> = [];
const retaliations: Array<{ amount: number; element: DamageOpts["element"] }> = [];
const game: GameType = Object.assign(Object.create(Game.prototype), {
  map,
  now: 100,
  dt: 0.05,
  godMode: false,
  naval: { aboard: false },
  encounters: { suppressOffense: false },
  enemies: [],
  projectiles: [],
  fx: { ring: noop, spawn: noop },
  floatText: noop,
  particles: noop,
  ringAt: noop,
  shake: noop,
  playSound: noop,
  touch: noop,
  toast: noop,
  damageEnemy(_target: Enemy, amount: number, opts: DamageOpts = {}) {
    retaliations.push({ amount, element: opts.element });
  },
  bestTarget: () => null,
  regionAtPlayer: () => "aegean_cyclades",
  playerDied() { this.player.dead = true; },
  telegraph(x: number, y: number, _radius: number, time: number) {
    warnings.push({ x, y, time });
  },
});
game.powers = new AegeanPowers(game);

function build(cls: ClassId, stage: "original" | "greek" | "royal" | "extreme"): Player {
  const p = new Player({ name: "Damage check", race: "human", cls,
    hairIndex: 0, skinIndex: 0, hairStyle: "short", beard: "none" });
  p.level = stage === "original" ? 75 : stage === "royal" ? 100 : 95;
  for (const node of p.classDef.skills.filter(n =>
    branches[cls].includes(n.branch) || n.branch === "Mastery")) p.skills[node.id] = node.max;
  assert.equal(Object.values(p.skills).reduce((sum, n) => sum + n, 0), 120);
  p.gold = 5000000;
  p.inventory.push(makeItem("mat_iron_ingot", { qty: 20000, plain: true }));
  game.player = p;
  if (stage === "royal") {
    for (const [slot, id, source] of [
      ["offHand", "last_dawn_mirror", "sanctuary_aegis"],
      ["armor", "oathforged_panoply", "sanctuary_forge"],
      ["accessory", "first_oath_ember", "sanctuary_names"],
    ] as const) p.equipment[slot] = makeItem(`aegean_${id}`, {
      plain: true, provenance: { source: "reward", id: `aegean_${source}`, region: "aegean_asterion" },
    });
  } else {
    p.equipment.armor = makeItem(stage === "extreme" ? "armor_frostguard" : stage === "original" ? "armor_underfloor" : "aegean_erymanthian_hide", { plain: true });
    p.equipment.offHand = makeItem(stage === "extreme" ? "shield_iron" : stage === "original" ? "shield_ember" : "aegean_aspis_sparta", { plain: true });
    p.equipment.accessory = makeItem(stage === "extreme" ? "art_iron_hide" : "art_ember_heart", { plain: true });
    for (const item of Object.values(p.equipment).filter(item => item !== null)) {
      const target = stage === "extreme" || item!.defId.startsWith("aegean_") ? p.level : 75;
      while (item!.level < target) game.reforge(item!.uid);
      assert.equal(item!.level, target, "The measured equipment is reforged through the real anvil");
    }
  }
  if (stage !== "original") for (const id of ["vigor", "mercy"]) p.flags.add(`aegean:mastery:${id}`);
  p.x = 800; p.y = 800;
  p.hp = p.maxHp; p.sp = p.maxSp;
  game.powers.reset();
  return p;
}

function freshHit() {
  const p = game.player;
  p.hp = p.maxHp; p.dead = false; p.invuln = 0; p.shield = 0;
  p.bracing = false; p.blocking = false; p.sp = p.maxSp;
  p.x = 800; p.y = 800;
  warnings.length = 0;
  retaliations.length = 0;
  game.projectiles = [];
}
function resolve(enemy: Enemy, seconds: number) {
  for (let t = 0; t < seconds; t += 0.05) {
    game.now += 0.05;
    game.player.invuln = Math.max(0, game.player.invuln - 0.05);
    enemy.update(game);
  }
}
function bossHit(id: string, attack: BossAttack, defense: "none" | "brace" | "block" | "roll" | "move" | "absorb" = "none", phase = 0): number {
  freshHit();
  const p = game.player;
  const e = new Enemy(id, 700, 800, id === "aegean_medusa" ? 95 : 100);
  game.enemies = [e];
  e.scripted = true; e.attackCd = 0; e.phase = phase;
  assert(e.queueAttack(game, attack));
  if (defense === "brace") p.bracing = true;
  if (defense === "block") p.blocking = true;
  if (defense === "roll") p.invuln = attack.windup + 1;
  if (defense === "absorb") p.shield = p.maxHp * 0.2;
  if (defense === "move") { p.x += 250; p.y += 250; }
  resolve(e, attack.windup + 0.1);
  return (p.maxHp - p.hp) / p.maxHp;
}
function ordinaryHit(id: string, level: number, region: string): number {
  freshHit();
  const e = new Enemy(id, 765, 800, level, { region });
  game.enemies = [e]; e.state = "chase"; e.attackCd = 0; e.tacticTime = 10;
  resolve(e, e.def.windup + 0.15);
  return (game.player.maxHp - game.player.hp) / game.player.maxHp;
}

const originalRandom = Math.random;
try {
  // No random dodge, and scatter lands far from a stationary player. This
  // reproduced Medusa's old harmless venom before the committed impact fix.
  Math.random = () => 0.999;
  const metrics: string[] = [];
  for (const cls of CLASSES) {
    for (const stage of ["original", "greek"] as const) {
      build(cls.id, stage);
      const poison = bossHit("aegean_medusa", AEGEAN_ATTACKS.poison);
      const thrust = bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust);
      const hound = ordinaryHit("aegean_hound", 76, "aegean_threshold");
      const jailer = ordinaryHit("aegean_jailer", 98, "aegean_ash");
      assert(poison >= (stage === "greek" ? 0.15 : 0.12) && poison < 0.36,
        `${stage} ${cls.id}: a committed Medusa pool is dangerous but survivable (${poison})`);
      assert(thrust >= 0.18 && thrust < 0.5, `${stage} ${cls.id}: a landed Medusa thrust has weight (${thrust})`);
      assert(hound >= 0.07 && hound < 0.25, `${stage} ${cls.id}: the entry pack remains dangerous (${hound})`);
      assert(jailer > hound && jailer < 0.4, `${stage} ${cls.id}: later brute hits harder without a one-shot (${jailer})`);
      assert.equal(bossHit("aegean_medusa", AEGEAN_ATTACKS.poison, "move"), 0,
        "Moving out of the committed venom warning evades it");
      assert.equal(bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust, "roll"), 0,
        "A correctly timed roll still avoids the thrust");
      const braced = bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust, "brace");
      assert(braced > 0 && braced < thrust * 0.7 && game.player.sp < game.player.maxSp,
        "Bracing mitigates the actual hit and spends stamina");
      const blocked = bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust, "block");
      assert(blocked > 0 && blocked < thrust * 0.4 && game.player.sp < game.player.maxSp,
        "A shield mitigates the actual hit and spends stamina");
      metrics.push(`${stage} ${cls.id}: pool ${(poison * 100).toFixed(1)}%, thrust ${(thrust * 100).toFixed(1)}%, hound ${(hound * 100).toFixed(1)}%, jailer ${(jailer * 100).toFixed(1)}% HP`);
    }
    build(cls.id, "royal");
    const sweep = bossHit("aegean_leonidas", AEGEAN_ATTACKS.sweep, "none", 5);
    assert(sweep >= 0.4 && sweep <= 0.8, `${cls.id}: the king's late sweep threatens40–80% of a prepared build (${sweep})`);
    metrics.push(`royal ${cls.id}: late sweep ${(sweep * 100).toFixed(1)}% HP`);

    const veteran = build(cls.id, "extreme");
    assert(veteran.maxHp > 100000 && veteran.stats().defense > 10000,
      "Actual repeated original reforges reproduce the otherwise invulnerable veteran build");
    const extremePool = bossHit("aegean_medusa", AEGEAN_ATTACKS.poison);
    const extremeThrust = bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust);
    const extremeHound = ordinaryHit("aegean_hound", 76, "aegean_threshold");
    const extremeJailer = ordinaryHit("aegean_jailer", 98, "aegean_ash");
    assert(extremePool > 0.11 && extremePool < 0.12, "Venom still threatens a massively reforged original build");
    assert(extremeThrust > 0.15 && extremeThrust < 0.17, "A direct boss strike cannot be ignored through reforging");
    assert(extremeHound > 0.029 && extremeHound < 0.031, "Ordinary enemies retain a modest minimum threat");
    assert(extremeJailer > 0.039 && extremeJailer < 0.041, "Brutes retain their stronger minimum threat");
    assert(bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust, "brace") < extremeThrust * 0.7);
    assert(bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust, "block") < extremeThrust * 0.4);
    assert.equal(bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust, "roll"), 0);
    assert.equal(bossHit("aegean_medusa", AEGEAN_ATTACKS.poison, "move"), 0);
    assert.equal(bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust, "absorb"), 0,
      "The minimum is still absorbed by ordinary protective shields");
    assert(veteran.shield < veteran.maxHp * 0.2, "Absorption pays for the minimum hit");
    const extremeSweep = bossHit("aegean_leonidas", AEGEAN_ATTACKS.sweep, "none", 5);
    assert(extremeSweep > 0.34 && extremeSweep < 0.35,
      "The king remains the greater threat even at extreme armour and health");
    metrics.push(`extreme ${cls.id}: HP ${veteran.maxHp.toFixed(0)}, pool ${(extremePool * 100).toFixed(1)}%, thrust ${(extremeThrust * 100).toFixed(1)}%, royal sweep ${(extremeSweep * 100).toFixed(1)}%`);
  }

  build("warrior", "extreme");
  game.player.equipment.mainHand = makeItem("aegean_unbroken_standard", { plain: true, provenance: { source: "debug", id: "damage-regression" } });
  const noWard = bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust);
  assert(game.powers.activate(game.player.equipment.mainHand));
  const warded = bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust);
  assert(warded > noWard * 0.7 && warded < noWard * 0.8,
    "A real Greek protective field still reduces the minimum hit; it is not true damage");
  game.powers.reset();
  bossHit("aegean_medusa", AEGEAN_ATTACKS.volley);
  assert.equal(game.projectiles.length, 5);
  assert(game.projectiles.every(projectile => projectile.minHealthDamage === 0.12),
    "Greek boss projectiles preserve their minimum through the real projectile constructor");

  // The minimum creates defensive pressure, never extra thorns/reflect damage.
  // Compare the same actual source blow with and without its Greek minimum.
  const thornVeteran = build("warrior", "extreme");
  const thornShare = thornVeteran.enchantPower("thorns") / 100;
  assert(thornShare > 0, "The original Frostguard Mail has its real thorns enchantment");
  bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust);
  const minimumThorns = retaliations.find(hit => hit.element === "physical")?.amount;
  assert(minimumThorns !== undefined);
  const source = game.enemies[0];
  const rawThrust = source.damage * AEGEAN_ATTACKS.thrust.power;
  freshHit();
  game.damagePlayer(rawThrust, { element: "physical", fromX: source.x, fromY: source.y });
  const rawThorns = retaliations.find(hit => hit.element === "physical")?.amount;
  assert(rawThorns !== undefined);
  assert(Math.abs(rawThorns - (thornVeteran.maxHp - thornVeteran.hp) * thornShare) < 0.00001,
    "Original raw-only thorns still reflect the authored share of actual HP damage");
  assert(Math.abs(minimumThorns - rawThorns) < 0.00001,
    "A huge health pool cannot turn the minimum into thousands of free thorns damage");
  bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust, "brace");
  const bracedThorns = retaliations.find(hit => hit.element === "physical")?.amount;
  assert(bracedThorns !== undefined && Math.abs(bracedThorns - rawThorns * 0.6) < 0.00001,
    "Active defense reduces retaliation using the real post-defense damage");

  const reflectedVeteran = build("warrior", "extreme");
  reflectedVeteran.equipment.mainHand = makeItem("sword_iron", { plain: true });
  while (reflectedVeteran.equipment.mainHand.level < 95)
    game.reforge(reflectedVeteran.equipment.mainHand.uid);
  assert(reflectedVeteran.attackPower() > 10000,
    "A heavily reforged weapon reproduces the reflected-attack-cap bypass");
  const mirror = makeItem("aegean_last_dawn_mirror", { plain: true,
    provenance: { source: "reward", id: "aegean_sanctuary_aegis", region: "aegean_asterion" } });
  reflectedVeteran.equipment.offHand = mirror;
  game.powers.onBrace();
  assert(game.powers.activate(mirror), "A real earned Mirror ward is active");
  bossHit("aegean_medusa", AEGEAN_ATTACKS.thrust);
  const minimumReflection = retaliations.find(hit => hit.element === "holy")?.amount;
  assert(minimumReflection !== undefined);
  const reflectedSource = game.enemies[0];
  freshHit();
  game.damagePlayer(reflectedSource.damage * AEGEAN_ATTACKS.thrust.power,
    { element: "physical", fromX: reflectedSource.x, fromY: reflectedSource.y });
  const rawReflection = retaliations.find(hit => hit.element === "holy")?.amount;
  assert(rawReflection !== undefined);
  assert(Math.abs(minimumReflection - rawReflection) < 0.00001,
    "A huge health pool and forged weapon cannot amplify a Mirror ward's reflection");

  build("warrior", "greek");
  freshHit();
  const medusa = new Enemy("aegean_medusa", 700, 800, 95);
  medusa.attackCd = 0;
  assert(medusa.queueAttack(game, AEGEAN_ATTACKS.poison));
  assert.deepEqual(warnings[0], { x: 800, y: 800, time: AEGEAN_ATTACKS.poison.windup },
    "The first visible warning is exactly the committed player position");
  assert(warnings.slice(1).every(point => point.x > 900 && point.y > 900),
    "The other impacts remain scattered");
  warnings.length = 0;
  const oldBoss = new Enemy("boss_emberdeep", 700, 800, 75);
  oldBoss.attackCd = 0;
  assert(oldBoss.queueAttack(game, AEGEAN_ATTACKS.poison));
  assert(warnings.every(point => point.x > 900 && point.y > 900),
    "Original bosses retain their existing rain geometry");
  assert.equal(new Enemy("wolf", 0, 0, 1).damage, 10.4,
    "The original field-enemy damage curve is unchanged");
  const king = new Enemy("aegean_leonidas", 0, 0, 100);
  for (const def of AEGEAN_ENEMIES.filter(def => def.boss && def.id !== king.def.id)) {
    const e = new Enemy(def.id, 0, 0, def.level);
    assert(e.damage >= 470 && e.damage < king.damage,
      `${def.id}: every Greek boss uses the endgame damage budget below the king`);
  }
  console.log(metrics.join("\n"));
  console.log("Greek damage checks passed: real HP loss, original/Greek reforges, warnings, dodges, shields and all boss budgets.");
} finally {
  Math.random = originalRandom;
}
