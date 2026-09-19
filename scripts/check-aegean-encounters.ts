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
  player.x = 900;
  player.y = 700;
  player.hp = player.maxHp;
  const rewards: string[] = [],
    hits: Array<{ amount: number; opts: DamageOpts }> = [],
    shots: ProjectileSpec[] = [];
  const warnings: unknown[][] = [];
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
    spawnProjectile(spec: ProjectileSpec) {
      shots.push(spec);
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
  director.interact(checkpoint);
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
  };
}

// Charges must connect with the authored structure; a plain interaction cannot
// bypass the lion, boar, bull or labyrinth. The actual stored dash is resolved.
for (const slug of ["nemea", "boar", "bull", "minotaur"]) {
  const f = fixture(slug),
    boss = f.principal();
  f.use(0);
  assert.equal(f.record().steps.length, 0, `${slug}: premature mechanism`);
  for (let i = 0; i < 3; i++) {
    boss.x = f.points[i].x - 200;
    boss.y = f.points[i].y;
    boss.attackCd = 0;
    f.player.x = f.points[i].x + 190;
    f.player.y = f.points[i].y;
    assert.ok(boss.queueAttack(f.game, AEGEAN_ATTACKS.charge));
    f.fake.now += 1.4;
    f.fake.dt = 1.4;
    boss.update(f.game);
    f.use(i);
    assert.ok(
      f.record().steps.includes(i),
      `${slug}: charge opens structure ${i}`,
    );
  }
  if (slug === "nemea" || slug === "minotaur") f.kill(boss);
  assert.deepEqual(f.rewards, [f.id], `${slug}: complete once`);
}

{
  const f = fixture("hydra");
  f.use(0);
  assert.equal(f.record().steps.length, 0);
  const head = (i: number) =>
    f.fake.enemies.find(
      (e) =>
        !e.dead &&
        e.def.name.startsWith(["Venom", "Sweep", "Lunge", "Brood", "Coil"][i]),
    )!;
  f.kill(head(0));
  f.tick(8.2);
  assert.ok(head(0), "uncauterized neck regrows");
  for (let i = 0; i < 5; i++) {
    f.kill(head(i));
    f.use(i);
  }
  assert.equal(f.record().steps.length, 5);
  assert.equal(f.rewards.length, 0, "immortal neck still requires the slab");
  f.use(0);
  assert.deepEqual(f.rewards, [f.id]);
}
{
  const f = fixture("hind"),
    hind = f.principal();
  f.use(2);
  assert.equal(f.record().steps.length, 0);
  assert.equal(
    f.director.modifyDamage(hind, 1e12, {}),
    0,
    "the sacred hind cannot be killed",
  );
  for (let i = 0; i < 3; i++) {
    hind.x = f.points[i].x;
    hind.y = f.points[i].y;
    f.use(i);
  }
  f.tick(0.1);
  assert.equal(f.rewards.length, 0, "sleeping hind needs defending");
  f.clearAdds();
  f.tick(0.1);
  assert.deepEqual(f.rewards, [f.id]);
}
{
  const f = fixture("augeas");
  f.use(1);
  assert.equal(f.record().steps.length, 0);
  for (const i of [0, 2, 1]) {
    f.use(i);
    const steps = f.record().steps.length;
    f.use((i + 1) % 3);
    assert.equal(
      f.record().steps.length,
      steps,
      "sluice guarded until adds die",
    );
    f.clearAdds();
  }
  f.tick(0.1);
  assert.deepEqual(f.rewards, [f.id]);
}
{
  const f = fixture("birds");
  f.use(0);
  f.use(1);
  assert.equal(f.record().steps.length, 1, "flock blocks the next resonator");
  f.clearAdds();
  f.use(1);
  f.clearAdds();
  f.use(2);
  f.clearAdds();
  f.kill(f.principal());
  assert.deepEqual(f.rewards, [f.id]);
}
{
  const f = fixture("mares"),
    mares = f.fake.enemies.filter((e) => e.def.name.startsWith("Mare "));
  assert.equal(mares.length, 4);
  for (const e of mares) {
    e.x = 1500;
    e.y = 1500;
    assert.equal(f.director.modifyDamage(e, 1e12, {}), 0);
  }
  f.use(0);
  assert.equal(
    f.record().steps.length,
    0,
    "gate cannot capture a distant mare",
  );
  mares.forEach((e, i) => {
    e.x = f.points[i].x;
    e.y = f.points[i].y;
    f.use(i);
    assert.ok(e.friendly);
  });
  f.kill(f.principal());
  assert.deepEqual(f.rewards, [f.id]);
}
{
  const f = fixture("hippolyta");
  assert.equal(f.director.modifyDamage(f.principal(), 1e12, {}), 0);
  for (let i = 0; i < 3; i++) {
    f.use(i);
    f.tick(0.2);
    assert.equal(f.record().steps.length, i);
    f.clearAdds();
    for (let t = 0; t < 30 && !f.record().steps.includes(i); t++) f.tick(1);
    assert.equal(
      f.record().steps.length,
      i + 1,
      "allies reach and hold the standard",
    );
  }
  assert.equal(f.principal().friendly, false);
  f.kill(f.principal());
  assert.deepEqual(f.rewards, [f.id]);
}
{
  const f = fixture("geryon"),
    cattle = f.fake.enemies.filter(
      (e) => e.def.name === "Cattle of the Red Herd",
    );
  f.use(0);
  assert.equal(f.record().steps.length, 0, "refuge requires both cattle");
  for (let i = 0; i < 3; i++) {
    cattle.forEach((e) => {
      e.x = f.points[i].x;
      e.y = f.points[i].y;
    });
    f.use(i);
  }
  f.kill(f.principal());
  assert.equal(f.rewards.length, 0, "all three bodies must fall");
  f.clearAdds();
  assert.deepEqual(f.rewards, [f.id]);
}
{
  const f = fixture("hesperides");
  f.use(0);
  f.use(2);
  assert.equal(f.record().steps.length, 0, "sky follows the next anchor");
  f.use(1);
  f.use(2);
  f.use(0);
  assert.deepEqual(f.rewards, [f.id]);
  const timeout = fixture("hesperides");
  timeout.use(0);
  timeout.tick(20.2);
  assert.match(timeout.director.status, /Take the sky/);
  assert.equal(timeout.rewards.length, 0);
}
{
  const f = fixture("cerberus");
  assert.ok(f.director.suppressOffense);
  f.use(0);
  assert.equal(f.record().steps.length, 0);
  assert.equal(
    f.director.modifyDamage(f.principal(), 1e12, { noProc: true }),
    0,
    "summon/proc damage cannot bypass restraint",
  );
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 40 && !f.director.exposureActive; j++) f.tick(0.5);
    assert.ok(f.director.exposureActive);
    f.use(i);
  }
  const boss = f.principal(),
    entry = f.map.encounterNodes!.entry[0];
  boss.x = entry.x;
  boss.y = entry.y;
  f.tick(0.1);
  assert.deepEqual(f.rewards, [f.id]);
}

// The eight further myths cannot be won by removing a generic boss HP bar.
for (const slug of [
  "python",
  "medusa",
  "chimera",
  "cyclops",
  "talos",
  "scylla",
  "titan",
]) {
  const f = fixture(slug),
    boss = f.principal();
  f.kill(boss);
  assert.equal(
    f.rewards.length,
    0,
    `${slug}: objective prerequisite survives overwhelming damage`,
  );
  if (["chimera", "cyclops", "talos"].includes(slug)) {
    boss.x = 1600;
    boss.y = 1600;
    f.use(0);
    assert.equal(f.record().steps.length, 0, `${slug}: wrong context rejected`);
  }
  for (let i = 0; i < 3; i++) {
    if (slug === "chimera") {
      boss.x = f.points[i].x - 190;
      boss.y = f.points[i].y;
      boss.attackCd = 0;
      f.player.x = f.points[i].x;
      f.player.y = f.points[i].y;
      boss.queueAttack(f.game, AEGEAN_ATTACKS.flame);
      f.fake.now += 1.5;
      f.fake.dt = 1.5;
      boss.update(f.game);
    }
    if (slug === "cyclops") {
      f.player.x = f.points[i].x;
      f.player.y = f.points[i].y;
      // Wait for a real target-locked quarry warning and its impact.
      f.tick(i ? 5 : 4.1);
    }
    if (slug === "talos") {
      boss.x = f.points[i].x;
      boss.y = f.points[i].y;
      boss.windupAttack = null;
      boss.windupTime = 0;
    }
    f.use(i);
    if (slug === "titan") f.clearAdds();
    if (slug === "scylla" || slug === "titan") f.tick(6.2);
    if (slug === "python") f.clearAdds();
    assert.ok(
      f.record().steps.includes(i),
      `${slug}: authored objective ${i} can complete`,
    );
  }
  if (!["scylla", "titan"].includes(slug)) f.kill(boss);
  assert.deepEqual(f.rewards, [f.id]);
}

assert.equal(ARMY_ROSTER.length, 300);
assert.equal(new Set(ARMY_ROSTER.map((s) => s.id)).size, 300);
for (let company = 0; company < 10; company++) {
  const roles = ARMY_ROSTER.slice(company * 30, company * 30 + 30).map(
    (s) => s.role,
  );
  assert.deepEqual(
    ["hoplite", "runner", "javelin", "shield", "captain"].map(
      (role) => roles.filter((r) => r === role).length,
    ),
    [20, 4, 3, 2, 1],
  );
}
{
  const f = fixture("army");
  let deaths = 0;
  for (let chapter = 0; chapter < 4; chapter++) {
    const end = [60, 150, 240, 300][chapter];
    while (deaths < end) {
      const live = f.fake.enemies.filter((e) => !e.dead);
      assert.ok(live.length > 0 && live.length <= 36, "bounded active army");
      for (const e of live) {
        e.dead = true;
        assert.equal(
          f.director.onEnemyKilled(e),
          true,
          "army soldiers suppress ordinary rewards",
        );
        deaths++;
      }
      f.tick(0.1);
    }
    assert.equal(f.director.armyStanding, 300 - end);
    assert.equal(f.record().chapter, chapter + 1);
    if (chapter < 3) {
      assert.equal(
        f.rewards.length,
        0,
        "only the complete army grants its unique reward",
      );
      const saved = f.director.snapshot();
      f.director.restore(saved);
      f.director.onMapEntered();
      f.director.interact(f.checkpoint);
    }
  }
  assert.deepEqual(f.rewards, [f.id]);
}

{
  const f = fixture("leonidas");
  const boss = f.principal();
  assert.equal(
    f.director.modifyDamage(boss, 1e12, {}),
    0,
    "phase entrance protected",
  );
  f.tick(2.6);
  const floors = [0.82, 0.64, 0.42, 0.18, 0.05];
  let totalGuards = 0;
  for (let phase = 0; phase < 5; phase++) {
    if (phase === 1) {
      f.use(0);
      f.use(0);
      f.kill(boss);
      assert.equal(
        boss.hp,
        boss.maxHp * floors[phase],
        "one link cannot advance",
      );
      f.tick(0.1);
      assert.match(f.director.status, /Phase 2/);
      f.use(1);
    }
    if (phase === 2) {
      for (let wave = 0; wave < 2; wave++) {
        const guards = f.fake.enemies.filter(
          (e) => !e.dead && e.def.id === "aegean_royal_guard",
        );
        assert.equal(guards.length, 6);
        totalGuards += guards.length;
        f.kill(boss);
        f.tick(0.1);
        assert.match(f.director.status, /Phase 3/);
        guards.forEach(f.kill);
        f.tick(0.1);
      }
    }
    f.kill(boss);
    assert.ok(!boss.dead);
    assert.ok(
      boss.hp >= boss.maxHp * floors[phase] - 0.01,
      "overkill respects next phase boundary",
    );
    f.tick(0.1);
    f.tick(2.6);
  }
  assert.equal(totalGuards, 12);
  assert.match(f.director.status, /Phase 6/);
  f.kill(boss);
  assert.ok(
    !boss.dead && boss.hp >= 1,
    "the last five percent cannot skip the oath",
  );
  f.tick(18);
  f.kill(boss);
  assert.deepEqual(f.rewards, [f.id]);
  assert.equal(f.director.practicePhase, 5);
  f.player.gold = 12345;
  f.player.cooldowns.test = 9;
  f.player.resistances.poison = { until: f.fake.now + 30, multiplier: 0.25 };
  assert.ok(f.director.startPractice(0));
  f.player.gold = 1;
  f.player.cooldowns.test = 0;
  f.tick(2.6);
  f.kill(f.principal());
  f.tick(0.1);
  assert.equal(f.rewards.length, 1, "practice grants no reward");
  assert.equal(f.player.gold, 12345);
  assert.equal(f.player.cooldowns.test, 9, "practice restores cooldown state");
  assert.ok(
    Math.abs(f.player.resistances.poison.until - f.fake.now - 30) < 0.01,
    "practice freezes resistance duration",
  );
  f.director.restore(undefined);
  assert.equal(
    Object.keys(f.director.snapshot().records).length,
    0,
    "new game clears encounter checkpoints",
  );
}

// Stored warning geometry: turning after a tell never rotates the impact, and
// rain uses the exact random points that were drawn, not another random roll.
{
  const f = fixture("nemea"),
    boss = f.principal();
  boss.attackCd = 0;
  boss.x = 600;
  boss.y = 600;
  f.player.x = 740;
  f.player.y = 600;
  boss.queueAttack(f.game, AEGEAN_ATTACKS.sweep);
  f.player.x = 600;
  f.player.y = 460;
  f.fake.now += 1.3;
  f.fake.dt = 1.3;
  boss.update(f.game);
  assert.equal(f.hits.length, 0, "cone remains facing east");
  boss.attackCd = 0;
  f.player.x = 750;
  f.player.y = 600;
  boss.queueAttack(f.game, AEGEAN_ATTACKS.thrust);
  assert.equal(
    f.warnings.at(-1)?.[7],
    AEGEAN_ATTACKS.thrust.radius,
    "line width equals actual collision half-width",
  );
  f.fake.now += 1;
  f.fake.dt = 1;
  boss.update(f.game);
  assert.equal(f.hits.length, 1, "line attack resolves damage");
  boss.attackCd = 0;
  boss.queueAttack(f.game, {
    ...AEGEAN_ATTACKS.poison,
    count: 1,
    lifeTax: 0.1,
  });
  const point = boss.attackGeometry!.points[0];
  f.player.x = point.x;
  f.player.y = point.y;
  f.fake.now += 1.6;
  f.fake.dt = 1.6;
  boss.update(f.game);
  assert.equal(f.hits.length, 2);
  assert.equal(
    f.hits.at(-1)!.opts.trueDamageAmount,
    f.player.maxHp * 0.1,
    "life-tax remains separate from armored damage",
  );
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
  f.fake.now += 1.4;
  f.fake.dt = 1.4;
  serpent.update(f.game);
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
  "Aegean runtime regressions passed: all twelve Labours, eight myths, 300 soldiers/checkpoints, six Leonidas phases, twelve guards, practice restoration, committed geometry, escort navigation and explicit sea movement.",
);
