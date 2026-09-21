/** Runtime regressions for authored mechanics, without a browser or renderer.
 * Run serially with the project's TypeScript runner. Every transition below is
 * driven by public director/entity APIs; no private encounter state is changed. */
import assert from "node:assert/strict";
import type { Game } from "../src/game/core/game";
import type { DamageOpts, ProjectileSpec } from "../src/game/core/world";
import {
  AegeanEncounterDirector,
  ARMY_ROSTER,
} from "../src/game/aegean/encounters";
import { AegeanNavigation } from "../src/game/aegean/navigation";
import { Enemy } from "../src/game/entities/enemy";
import type { PhysicalAttackCue } from "../src/game/combat/physical";
import { Player } from "../src/game/player/player";
import { createMap, setTile, type PropInstance } from "../src/game/world/map";
import { T, TILE } from "../src/game/world/tiles";
import { AEGEAN_ATTACKS } from "../src/data/aegean/enemies";

function fixture(slug: string) {
  const id = `aegean_${slug}`,
    map = createMap({ id, name: slug, w: 160, h: 128, kind: "dungeon" });
  map.tiles.fill(T.MARBLE);
  const points = Array.from({ length: 8 }, (_, i) => ({
    x: 800 + (i % 4) * 170,
    y: 700 + Math.floor(i / 4) * 180,
  }));
  const count =
    slug === "hydra"
      ? 5
      : slug === "mares" || slug === "army"
        ? 4
        : slug === "leonidas"
          ? 8
          : 3;
  map.props = points
    .slice(0, count)
    .map(
      (p, index): PropInstance => ({
        ...p,
        art: "aegean_brazier",
        interact: "aegean",
        data: { action: "objective", index, encounter: id },
      }),
    );
  const checkpoint: PropInstance = {
    x: 400,
    y: 400,
    art: "aegean_sanctuary_stone",
    interact: "aegean",
    data: { action: "checkpoint" },
  };
  map.props.push(checkpoint);
  map.encounterNodes = {
    entry: [{ x: 420, y: 450 }],
    arena: [{ x: 950, y: 700 }],
    boss: [{ x: 950, y: 700 }],
    safe: [{ x: 900, y: 950 }],
    enemy: points,
    guard: points,
  };
  for (let i = 0; i < 4; i++) {
    map.encounterNodes[`chapter_${i}`] = [points[i]];
    map.encounterNodes[`reserve_${i}`] = points;
  }
  const player = new Player({
    name: "Regression",
    race: "human",
    cls: "warrior",
    hairIndex: 0,
    skinIndex: 0,
    hairStyle: "short",
    beard: "none",
  });
  player.level = 100;
  player.x = 950;
  player.y = 1000;
  player.hp = player.maxHp;
  const rewards: string[] = [],
    hits: Array<{ amount: number; opts: DamageOpts }> = [],
    shots: ProjectileSpec[] = [];
  const warnings: unknown[][] = [];
  const physicalCues: PhysicalAttackCue[] = [];
  const flights = new Map<ProjectileSpec, number>();
  let director: AegeanEncounterDirector;
  const fake = {
    map,
    player,
    now: 100,
    dt: 0.1,
    enemies: [] as Enemy[],
    bossTarget: null as Enemy | null,
    floatText() {},
    particles() {},
    ringAt() {},
    shake() {},
    playSound() {},
    toast() {},
    telegraph(...args: unknown[]) {
      warnings.push(args);
    },
    physicalAttack(spec: PhysicalAttackCue) { physicalCues.push(spec); },
    spawnProjectile(spec: ProjectileSpec) {
      shots.push(spec);
      flights.set(spec, spec.range / spec.speed);
    },
    summon(def: string, x: number, y: number, level: number) {
      const e = new Enemy(def, x, y, level);
      fake.enemies.push(e);
      return e;
    },
    damagePlayer(amount: number, opts: DamageOpts = {}) {
      hits.push({ amount, opts });
    },
    aegeanHas(key: string) {
      return player.flags.has(`aegean:complete:${key}`);
    },
    completeAegean(key: string) {
      rewards.push(key);
      player.flags.add(`aegean:complete:${key}`);
    },
    damageEnemy(enemy: Enemy, amount: number, opts: DamageOpts = {}) {
      if (enemy.dead || !director.isDamageAllowed(enemy)) return;
      const damage = director.modifyDamage(enemy, amount, opts);
      enemy.hp -= damage;
      if (enemy.hp <= 0) {
        enemy.dead = true;
        director.onEnemyKilled(enemy);
      }
    },
  };
  const game = fake as unknown as Game;
  director = new AegeanEncounterDirector(game);
  director.onMapEntered();
  const record = () => director.snapshot().records[id];
  const principal = () => fake.enemies.find((e) => !e.dead && e.def.id === id)!;
  const use = (i: number) => {
    player.x = points[i].x;
    player.y = points[i].y;
    director.interact(map.props[i]);
  };
  const tick = (seconds: number) => {
    for (let t = 0; t < seconds - 1e-8; t += 0.1) {
      fake.now += 0.1;
      fake.dt = Math.min(0.1, seconds - t);
      director.update(fake.dt);
      for (const e of [...fake.enemies]) if (!e.dead) e.update(game);
      // This fixture advances only flight-end callbacks. Actual swept projectile
      // collision, wall hits and source cancellation are covered by Game tests.
      for (const [shot, left] of flights) {
        const source = fake.enemies.find(e => e.id === shot.sourceId);
        if (shot.sourceId !== undefined && (!source || source.dead || Math.hypot(source.x-player.x, source.y-player.y) > 560)) { flights.delete(shot); continue; }
        if (left > fake.dt) flights.set(shot, left - fake.dt);
        else {
          flights.delete(shot);
          shot.onImpact?.({x:shot.x + Math.cos(shot.angle)*shot.range, y:shot.y + Math.sin(shot.angle)*shot.range}, "range");
        }
      }
    }
  };
  const kill = (e: Enemy) =>
    fake.damageEnemy(e, e.maxHp * 100, { fromX: e.x - 500, fromY: e.y });
  const clearAdds = () => {
    for (const e of fake.enemies)
      if (!e.dead && e.def.id !== id && !e.friendly) kill(e);
  };
  return {
    id,
    map,
    game,
    fake,
    player,
    director,
    record,
    principal,
    use,
    tick,
    kill,
    clearAdds,
    points,
    checkpoint,
    rewards,
    hits,
    shots,
    warnings,
    physicalCues,
  };
}

// First entry immediately creates an active opponent; no shrine or E prompt.
for (const slug of ["nemea", "python", "medusa", "chimera", "cyclops", "talos", "birds", "hippolyta", "sanctuary_aegis", "sanctuary_forge", "sanctuary_names", "champion_spear", "champion_shield", "champion_volley", "champion_hunt", "champion_guard", "champion_storm"]) {
  const f = fixture(slug), boss = f.principal();
  assert.ok(boss && !boss.friendly, `${slug}: boss attacks on entry`);
  assert.ok(boss.maxHp <= 30000, `${slug}: health is capped after all enemy scaling`);
  assert.equal(f.director.modifyDamage(boss, 100, {}), 100, `${slug}: no mandatory tool damage gate`);
  f.kill(boss);
  assert.deepEqual(f.rewards, [f.id], `${slug}: combat victory needs no three-prop checklist`);
  f.director.onEnemyKilled(boss);
  assert.equal(f.rewards.length, 1, `${slug}: duplicate death cannot duplicate reward`);
}

// Real dash impacts open counterplay automatically without pressing E.
for (const slug of ["nemea", "boar", "bull", "minotaur"]) {
  const f = fixture(slug), boss = f.principal();
  f.use(0);
  assert.equal(f.record().steps.length, 0, `${slug}: tapping an untouched structure does nothing`);
  for (let i = 0; i < 3; i++) {
    boss.x = f.points[i].x - 200; boss.y = f.points[i].y; boss.attackCd = 0;
    boss.windupAttack = null; boss.windupTime = 0;
    f.player.x = f.points[i].x + 120; f.player.y = f.points[i].y;
    assert.ok(boss.queueAttack(f.game, AEGEAN_ATTACKS.charge));
    for (let t=0;t<60 && boss.windupAttack;t++) { f.fake.now += .05; f.fake.dt=.05; boss.update(f.game); }
    f.director.update(.01);
    assert.ok(f.record().steps.includes(i), `${slug}: charge collision activates structure ${i}`);
  }
  if (slug === "nemea" || slug === "minotaur") f.kill(boss);
  assert.deepEqual(f.rewards, [f.id]);
}

{
  const f = fixture("python"), boss = f.principal();
  f.player.x = f.points[0].x; f.player.y = f.points[0].y;
  f.tick(.8);
  assert.ok(f.record().steps.includes(0), "standing at a vent operates it");
  assert.equal(f.director.modifyDamage(boss, 100, {}), 135, "tool rewards a damage opening, not permission to fight");
  assert.equal(boss.windupAttack, null, "tool interrupts a committed attack");
}
{
  const f = fixture("hydra");
  const head = (i: number) => f.fake.enemies.find((e) => !e.dead && e.def.name.startsWith(["Venom", "Sweep", "Lunge", "Brood", "Coil"][i]))!;
  assert.equal(f.fake.enemies.filter((e) => !e.dead && e.def.id === "aegean_hydra_head").length, 5);
  f.kill(head(0)); f.tick(8.2);
  assert.ok(head(0), "unburned hydra neck regenerates");
  for (let i = 0; i < 5; i++) {
    const target=head(i);
    target.x=1500+i*95; target.y=1350;
    f.kill(target);
    f.player.x=target.x; f.player.y=target.y;
    f.tick(.8);
  }
  f.tick(.1);
  assert.deepEqual(f.rewards, [f.id], "five burned wounds finish without another slab interaction");
}
{
  const f = fixture("hind"), hind = f.principal();
  assert.equal(f.director.modifyDamage(hind, 1e12, {}), 0, "sacred hind remains nonlethal");
  for (let i = 0; i < 3; i++) {
    hind.x = f.points[i].x; hind.y = f.points[i].y;
    f.player.x = hind.x; f.player.y = hind.y;
    f.tick(.9);
    assert.ok(f.record().steps.includes(i), "calm arrival seals each sanctuary automatically");
  }
  f.tick(.2); f.clearAdds(); f.tick(.1);
  assert.deepEqual(f.rewards, [f.id]);
}
{
  const f = fixture("augeas");
  // Any route through the flood is valid. Clear each guardian pocket first.
  for (const i of [1, 2, 0]) {
    f.player.x = f.points[i].x; f.player.y = f.points[i].y;
    f.tick(.8);
    assert.ok(f.record().steps.includes(i), "sluices have no hidden ordering");
    f.clearAdds();
  }
  f.tick(.1);
  assert.deepEqual(f.rewards, [f.id]);
}
{
  const f = fixture("mares");
  const mares = f.fake.enemies.filter((e) => !e.dead && e.def.id === "aegean_man_eating_mare");
  assert.equal(mares.length, 4, "actual horse enemies, not renamed boars");
  mares.forEach((e, i) => {e.x = f.points[i].x; e.y = f.points[i].y;});
  f.tick(.1);
  assert.ok(mares.every((e) => e.friendly), "entering paddocks captures the mares");
  f.kill(f.principal());
  assert.deepEqual(f.rewards, [f.id]);
}
{
  const f = fixture("geryon");
  f.kill(f.principal());
  assert.equal(f.rewards.length, 0, "all three bodies must fall");
  f.clearAdds();
  assert.deepEqual(f.rewards, [f.id], "herd shelters are helpful, not mandatory reward switches");
}
{
  const f = fixture("hesperides");
  for (const i of [0, 1, 2, 0]) {
    f.player.x = f.points[i].x; f.player.y = f.points[i].y; f.tick(.8);
  }
  assert.deepEqual(f.rewards, [f.id], "sky transfers by walking between anchors");
}
{
  const f = fixture("cerberus"), boss = f.principal();
  assert.ok(f.director.suppressOffense);
  assert.equal(f.director.modifyDamage(boss, 1e12, {}), 0);
  for (let i = 0; i < 3; i++) {
    // Stay away through the attacks, then approach during the visible rest.
    for (let t = 0; t < 80 && !f.director.exposureActive; t++) {
      f.player.x = boss.x + 300; f.player.y = boss.y; f.tick(.1);
    }
    assert.ok(f.director.exposureActive, "three-head combo has a readable rest");
    f.player.x = boss.x + 60; f.player.y = boss.y; f.tick(.1);
  }
  assert.deepEqual(f.rewards, [f.id], "approaching resting heads fastens restraints without E chores");
}
{
  const f = fixture("scylla"), boss = f.principal();
  const heads = () => f.fake.enemies.filter((e) => !e.dead && e.def.id === "aegean_scylla_head");
  assert.equal(heads().length, 6, "all six heads are live immediately");
  f.use(0); f.use(2);
  assert.equal(heads().length, 6, "beacon interactions never duplicate heads");
  f.kill(boss);
  assert.equal(boss.hp, boss.maxHp, "living heads physically protect the body");
  // Clear pairs in reverse order: no imposed beacon sequence.
  for (const index of [2, 1, 0]) {
    const pair = heads().filter((e) => e.def.name.endsWith(String(index * 2 + 1)) || e.def.name.endsWith(String(index * 2 + 2)));
    f.kill(pair[0]);
    assert.ok(!f.record().steps.includes(index), "one living head keeps its flame dark");
    f.kill(pair[1]);
    assert.ok(f.record().steps.includes(index), "second kill lights beacon automatically");
  }
  assert.equal(boss.friendly, false);
  f.kill(boss);
  assert.deepEqual(f.rewards, [f.id]);
  const saved = f.director.snapshot();
  f.director.restore(saved); f.director.onMapEntered();
  assert.equal(heads().length, 0, "completed saves do not respawn enemies");
  f.director.interact(f.checkpoint);
  assert.equal(heads().length, 6, "explicit rematch resets actual combat actors");
}
{
  const f = fixture("titan");
  for (const index of [2,0,1]) {
    f.player.x = f.points[index].x; f.player.y = f.points[index].y;
    f.tick(.8); f.clearAdds(); f.tick(3.2);
    assert.ok(f.record().steps.includes(index), "defended anchor repairs by holding ground");
  }
  assert.deepEqual(f.rewards, [f.id]);
}

// The three-hundred means 300 simultaneously alive, attacking and vulnerable.
assert.equal(ARMY_ROSTER.length, 300);
assert.equal(new Set(ARMY_ROSTER.map((s) => s.id)).size, 300);
{
  const f = fixture("army");
  const soldiers = f.fake.enemies.filter((e) => !e.dead);
  assert.equal(soldiers.length, 300);
  assert.equal(new Set(soldiers.map((e) => e.spawnId)).size, 300, "each soldier has a durable distinct identity");
  assert.ok(soldiers.every((e) => f.director.isDamageAllowed(e)), "none are phantom reserves");
  const distant = soldiers[0], before = {x:distant.x,y:distant.y};
  f.tick(.3);
  assert.ok(distant.x !== before.x || distant.y !== before.y, "far companies actively advance");
  f.player.hp = f.player.maxHp * .5;
  const hp = f.player.hp;
  for (const e of soldiers.slice(0,150)) {e.dead=true; f.director.onEnemyKilled(e);}
  f.tick(.1);
  assert.equal(f.director.armyStanding, 150);
  assert.equal(f.player.hp, hp, "mass kills and artificial chapter breaks cannot refill health");
  assert.equal(f.rewards.length, 0);
  for (const e of soldiers.slice(150)) {e.dead=true; f.director.onEnemyKilled(e);}
  f.tick(.1);
  assert.deepEqual(f.rewards, [f.id]);
  assert.equal(f.record().chapter, 4, "legacy save field records only full victory");
}
{
  const f = fixture("army");
  f.director.restore({version:1,records:{aegean_army:{steps:[],chapter:2,bestPhase:0,completed:false}}});
  f.director.onMapEntered();
  assert.equal(f.director.armyStanding,300,"old partial chapter save restarts the actual 300 battle");
  assert.equal(f.fake.enemies.filter((e)=>!e.dead).length,300);
}
{
  const f = fixture("leonidas"), boss = f.principal();
  assert.ok(boss.maxHp <= 40000);
  assert.equal(f.director.modifyDamage(boss,1e12,{}),0,"brief phase announcement protects the transition");
  f.tick(.8);
  for (let phase = 0; phase < 5; phase++) {
    f.kill(boss); f.tick(.1); f.tick(.8);
    assert.ok(!boss.dead,"each attack phase appears despite overwhelming gear");
  }
  assert.match(f.director.status,/Phase 6/);
  f.kill(boss); assert.ok(!boss.dead && boss.hp >= 1,"last oath requires its three actual strikes");
  f.tick(16);
  f.kill(boss);
  assert.deepEqual(f.rewards,[f.id]);
  assert.equal(f.director.practicePhase,5);
  f.player.gold=12345; f.player.cooldowns.test=9;
  f.player.resistances.poison={until:f.fake.now+30,multiplier:.25};
  assert.ok(f.director.startPractice(0));
  f.player.gold=1; f.player.cooldowns.test=0;
  f.tick(.8); f.kill(f.principal()); f.tick(.1);
  assert.equal(f.rewards.length,1,"practice never grants rewards");
  assert.equal(f.player.gold,12345); assert.equal(f.player.cooldowns.test,9);
  assert.ok(Math.abs(f.player.resistances.poison.until-f.fake.now-30)<.01,"practice freezes resistance duration");
  f.director.restore(undefined);
  assert.equal(Object.keys(f.director.snapshot().records).length,0);
}

// Greek shots are physically held and thrown by the visible actor. A locked
// target changes the aim, never a remote damage field under the new player spot.
{
  const f = fixture("nemea"), boss = f.principal();
  boss.attackCd = 0; boss.x = 600; boss.y = 600;
  f.player.x = 760; f.player.y = 600;
  const aimedAngle = Math.atan2(f.player.y - 8 - (boss.y - Math.min(28, boss.radius*.5)), f.player.x - boss.x);
  assert.ok(boss.queueAttack(f.game, {...AEGEAN_ATTACKS.volley, count:1, physical:"bow", projectileSprite:"arrow"}));
  assert.equal(f.warnings.length, 0, "No geometric Greek attack overlay is created");
  assert.ok(f.physicalCues.length, "A visible weapon provides the windup");
  f.player.x = 600; f.player.y = 440;
  for (let i=0;i<18;i++) {f.fake.now += .1; f.fake.dt=.1; boss.update(f.game);}
  assert.equal(f.hits.length, 0, "Releasing a projectile does not remotely damage the player");
  assert.equal(f.shots.length,1);
  assert.equal(f.shots[0].sprite,"arrow");
  assert.equal(f.shots[0].sourceId,boss.id,"The flying object retains its actual owner");
  assert.ok(Math.abs(f.shots[0].angle-aimedAngle)<.01,"The shot keeps its eastward aim after the player moves north");
}
{
  const f = fixture("cyclops"), boss = f.principal();
  f.player.x = f.points[0].x; f.player.y = f.points[0].y;
  for (let i=0;i<35 && !f.shots.length;i++) f.tick(.1);
  const boulder = f.shots.find(s=>s.sprite === "boulder" && s.onImpact);
  assert.ok(boulder,"Cyclops throws a real boulder from the visible giant");
  assert.ok(Math.hypot(boulder.x + Math.cos(boulder.angle)*boulder.range - f.points[0].x,
    boulder.y + Math.sin(boulder.angle)*boulder.range - f.points[0].y) < .01,
    "A short boulder throw reaches its target from the raised hand, not just from the giant's feet");
  assert.equal(f.warnings.length,0,"Cyclops does not paint a ground damage circle");
  assert.equal(f.record().steps.length,0,"An announced throw alone cannot break a crane");
  boulder.onImpact!(f.points[0],"wall");
  assert.ok(f.record().steps.includes(0),"The boulder breaks the crane where it physically lands");
  const before = f.record().steps.length;
  f.kill(boss);
  boulder.onImpact!(f.points[1],"range");
  assert.equal(f.record().steps.length,before,"A dead source cannot complete a delayed crane impact");
}
{
  const f = fixture("cyclops"), boss = f.principal();
  f.tick(1);
  assert.ok(boss.windupAttack,"Cyclops has begun lifting a boulder");
  f.player.x += 1800;
  f.director.update(.1);
  assert.equal(boss.windupAttack,null,"Leaving the visible attack cancels its unreleased object");
  assert.equal(f.hits.length,0);
}

// An escort finds the opening in an actual wall instead of rubbing its face
// against it indefinitely. The path is requested via its public movement API.
{
  const f = fixture("hind"),
    nav = new AegeanNavigation(),
    e = f.principal();
  e.x = 400;
  e.y = 450;
  for (let y = 1; y < 60; y++)
    if (y < 35 || y > 43) setTile(f.map, 40, y, T.MARBLE_WALL);
  const target = { x: 1100, y: 450 };
  for (
    let t = 0;
    t < 1000 && Math.hypot(e.x - target.x, e.y - target.y) > 45;
    t++
  ) {
    f.fake.now += 0.1;
    f.fake.dt = 0.1;
    nav.move(e, f.game, target, 2);
  }
  assert.ok(
    Math.hypot(e.x - target.x, e.y - target.y) < 45,
    "scripted escort reaches the other side of a dogleg",
  );
  assert.ok(TILE > 0);
}

// Navigation is selected by spawn context, never by the species name: the
// same serpent can inhabit a temple or the open sea, and boarding foes walk.
{
  const f = fixture("nemea");
  f.map.tiles.fill(T.AEGEAN_SEA);
  f.fake.enemies = [];
  for (let y = 0; y < f.map.h; y++)
    for (let x = 50; x < f.map.w; x++) setTile(f.map, x, y, T.AEGEAN_GRASS);
  const serpent = new Enemy("aegean_serpent", 20 * TILE, 600, 83);
  f.fake.enemies.push(serpent);
  f.fake.dt = 0.1;
  const start = serpent.x;
  serpent.driveTo(f.game, 44 * TILE, 600);
  assert.equal(serpent.x, start, "a foot spawn cannot walk on sea tiles");
  serpent.movementProfile = "swimmer";
  for (let i = 0; i < 20; i++) serpent.driveTo(f.game, 44 * TILE, 600);
  assert.ok(
    serpent.x > start + 80,
    "an explicitly swimming sea enemy approaches through actual water",
  );
  for (let i = 0; i < 300; i++) serpent.driveTo(f.game, 62 * TILE, 600);
  assert.ok(
    serpent.x + serpent.radius * 0.7 < 50 * TILE + 0.01,
    "a swimmer cannot cross the shore onto land",
  );
  serpent.x = 40 * TILE;
  serpent.y = 600;
  serpent.attackCd = 0;
  f.player.x = 62 * TILE;
  f.player.y = 600;
  serpent.queueAttack(f.game, AEGEAN_ATTACKS.charge);
  for (let tick=0;tick<60 && serpent.windupAttack;tick++) {f.fake.now+=.05;f.fake.dt=.05;serpent.update(f.game);}
  assert.ok(
    serpent.x > 40 * TILE + 50 &&
      serpent.x + serpent.radius * 0.7 < 50 * TILE + 0.01,
    "committed swimming charge travels through water but stops at the shore",
  );
  const siren = new Enemy("aegean_siren", 45 * TILE, 700, 90);
  siren.movementProfile = "flying";
  f.fake.enemies = [siren];
  f.fake.dt = 0.1;
  for (let i = 0; i < 80; i++) siren.driveTo(f.game, 62 * TILE, 700);
  assert.ok(
    siren.x > 50 * TILE + 80,
    "an explicit flying profile crosses water and ordinary land",
  );
}

console.log(
  "Aegean runtime regressions passed: automatic starts, optional boss counters, nonlethal Labours, six simultaneous Scylla heads, 300 simultaneous soldiers, six Leonidas phases, practice restoration, physical source-bound attacks, escort navigation and explicit sea movement.",
);
