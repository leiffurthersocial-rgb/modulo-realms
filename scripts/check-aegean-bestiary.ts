/** Greek-native art + real entity warning/impact regressions; no browser or canvas buffers. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AEGEAN_ENEMIES } from '../src/data/aegean/enemies';
import { MYTH_ATTACKS } from '../src/data/aegean/combat';
import { Enemy } from '../src/game/entities/enemy';
import { Player } from '../src/game/player/player';
import { createMap, setTile } from '../src/game/world/map';
import { T } from '../src/game/world/tiles';
import type { BossAttack } from '../src/data/enemies';
import type { DamageOpts, ProjectileSpec, WorldCtx } from '../src/game/core/world';
import { drawMythCreature } from '../src/game/art/aegeanCreatures';
import { creatureStyle } from '../src/game/art/creatures';
import { FxSystem } from '../src/game/combat/fx';
import { physicalOrigin, physicalPose, drawPhysicalAttack, type PhysicalAttackCue } from '../src/game/combat/physical';

function fixture(id = 'aegean_nemea') {
  const map = createMap({ id: 'myth_test', name: 'Myth test', w: 80, h: 80, kind: 'dungeon' });
  map.tiles.fill(T.MARBLE);
  const player = new Player({ name: 'Pattern test', race: 'human', cls: 'warrior', hairIndex: 0, skinIndex: 0, hairStyle: 'short', beard: 'none' });
  player.x = 800; player.y = 800;
  const enemy = new Enemy(id, 650, 800, 100);
  enemy.scripted = true; enemy.attackCd = 0;
  const hits: DamageOpts[] = [], warnings: unknown[][] = [], shots: ProjectileSpec[] = [], cues: PhysicalAttackCue[] = [];
  const ctx: WorldCtx = { map, player, enemies: [enemy], now: 100, dt: .025,
    damageEnemy() {}, damagePlayer(_amount, opts = {}) { if (player.invuln <= 0) { hits.push(opts); player.hp -= 1; } },
    spawnProjectile(shot) { shots.push(shot); }, particles() {}, floatText() {}, shake() {}, playSound() {},
    physicalAttack(cue) { cues.push(cue); },
    telegraph(...args) { warnings.push(args); }, summon() {}, ringAt() {},
  };
  const tick = (seconds: number) => { for (let t = 0; t < seconds; t += ctx.dt) { ctx.now += ctx.dt; enemy.update(ctx); } };
  const queue = (a: BossAttack) => { assert(enemy.queueAttack(ctx, a)); return a; };
  return { ctx, enemy, player, hits, warnings, shots, cues, tick, queue };
}
const bosses = AEGEAN_ENEMIES.filter(e => e.boss);
const field = AEGEAN_ENEMIES.filter(e => !e.boss && e.kind === 'creature');
assert(field.length >= 54, 'A large exclusively Greek field roster exists');
assert.equal(new Set(field.map(e => e.creature!.kind)).size, field.length, 'Every field species owns a native art key');
assert.equal(new Set(bosses.map(e => e.creature!.kind)).size, bosses.length, 'Every boss owns a bespoke art key');
for (const e of [...field, ...bosses]) {
  assert(e.creature?.kind.startsWith('myth_'), `${e.id} uses native Greek art`);
  const deck = e.boss?.attacks ?? e.combat?.attacks;
  assert(deck && deck.length >= 2, `${e.id} has an authored repertoire`);
}
for (const e of bosses) {
  assert(e.health <= (e.id === 'aegean_leonidas' ? 40000 : 30000));
  assert(new Enemy(e.id, 500, 500, 150, { region: 'aegean_ash' }).maxHp <= (e.id === 'aegean_leonidas' ? 40000 : 30000), 'Post-scaling ceiling cannot regress into a sponge');
}
// Attacks have a visible source preparation, then an actual body/weapon or missile.
for (const a of Object.values(MYTH_ATTACKS)) {
  assert(['cone', 'line', 'dash', 'leap', 'projectile', 'summon'].includes(a.shape), `${a.id} is physically delivered`);
  assert(a.physical, `${a.id} has a concrete held weapon/limb`);
}
{
  const f = fixture(); f.player.x = 720;
  const a = f.queue(MYTH_ATTACKS.spear);
  assert.equal(f.warnings.length, 0, 'Greek threats never draw abstract danger geometry');
  assert.equal(f.cues[0].phase, 'prepare'); assert.equal(f.cues[0].source, f.enemy);
  f.tick(a.windup + .03); assert.equal(f.hits.length, 0, 'Releasing a thrust does not deal instantaneous area damage');
  f.tick(.45); assert.equal(f.hits.length, 1, 'A visible extended spear physically contacts its target');
}
{
  const f = fixture(); f.player.x = 920;
  const a = f.queue(MYTH_ATTACKS.spear); f.tick(a.windup + .7);
  assert.equal(f.hits.length, 0, 'A held weapon cannot hit beyond its visible reach');
}
{
  const f = fixture(); f.player.x = 755;
  const a = f.queue(MYTH_ATTACKS.spear); f.tick(a.windup + .025); f.ctx.dt = .25; f.tick(.5);
  assert.equal(f.hits.length, 1, 'Slow frames still sweep the passing spear instead of tunnelling through the target');
}
{
  const f = fixture(); const a = f.queue(MYTH_ATTACKS.root); f.tick(a.windup + .06);
  assert.equal(f.hits.length, 0, 'A thrown snare has no detached damage at release');
  assert.equal(f.shots.length, 1); assert.equal(f.shots[0].sprite, 'net');
  assert.equal(f.shots[0].sourceId, f.enemy.id); assert.equal(f.shots[0].status?.kind, 'chill');
  assert.equal(f.player.statuses.length, 0, 'Snare status belongs to an actual projectile hit');
}
{
  const f = fixture(); const a = f.queue(MYTH_ATTACKS.feathers); f.tick(a.windup + .06);
  assert.equal(f.shots.length, 4); assert.equal(f.warnings.length, 0);
  assert(f.shots.every(s => s.sprite === 'feather' && s.radius === a.radius && s.speed === a.projectileSpeed));
  assert(f.shots.every(s => Math.cos(s.angle) > .7), 'Feathers form a readable forward throw instead of radial spam');
}
{
  const f = fixture(); let callbacks = 0; let landing: { x: number; y: number } | null = null;
  const target = { x: 825, y: 800 };
  assert(f.enemy.queueAttack(f.ctx, { ...MYTH_ATTACKS.boulder, onImpact(point) { callbacks++; landing = point; } }, target));
  f.tick(MYTH_ATTACKS.boulder.windup + .06);
  const shot = f.shots[0], origin = physicalOrigin(f.enemy);
  assert.equal(callbacks, 0, 'A thrown boulder cannot trigger an impact prop before landing');
  assert.equal(shot.range, Math.hypot(target.x - origin.x, target.y - origin.y), 'Authored prop receives the actual projectile endpoint');
  shot.onImpact?.(target, 'range'); shot.onImpact?.(target, 'hit');
  assert.equal(callbacks, 1); assert.deepEqual(landing, target);
}
{
  const f = fixture(); const a = f.queue(MYTH_ATTACKS.pounce); f.player.y += 160;
  f.tick(a.windup + .06);
  assert(f.enemy.x < 800, 'A pounce travels visibly instead of teleporting onto a warning');
  f.tick(.65); assert.equal(f.hits.length, 0); assert.equal(f.enemy.y, 800); assert.equal(f.enemy.x, 800, 'Pounce follows its committed body path');
}
{
  const f = fixture(); for (let y = 0; y < 80; y++) setTile(f.ctx.map, 23, y, T.WALL_STONE);
  const a = f.queue(MYTH_ATTACKS.pounce); f.tick(a.windup + .7);
  assert.equal(f.hits.length, 0); assert(f.enemy.x < 23 * 32, 'A moving leap stops at walls');
}
for (const attack of [MYTH_ATTACKS.spear, MYTH_ATTACKS.gaze]) {
  const f = fixture(); f.player.x = 770;
  for (let y = 0; y < 80; y++) setTile(f.ctx.map, 23, y, T.WALL_STONE);
  const a = f.queue(attack); f.tick(a.windup + .6);
  assert.equal(f.hits.length, 0, `${a.name} cannot hit through intervening masonry`);
}
{
  const f = fixture(); f.player.x = 720;
  const a = f.queue(MYTH_ATTACKS.blade); f.tick(a.windup + .9);
  assert.equal(f.hits.length, 2, 'Double cut contacts twice through two visible swings');
}
{
  const f = fixture(); f.player.x = 720;
  const a = f.queue(MYTH_ATTACKS.blade); f.tick(a.windup + .4);
  assert.equal(f.hits.length, 1); f.player.y += 180; f.tick(.6);
  assert.equal(f.hits.length, 1, 'Stepping beyond the held blade evades its return swing');
}
{
  const f = fixture(); f.player.x = 750;
  const a = f.queue(MYTH_ATTACKS.maelstrom); f.tick(a.windup + .6);
  assert.equal(f.hits.length, 1); assert(f.player.knockX < 0, 'A contacting tentacle pulls toward its present source');
}
for (const evade of ['roll', 'random'] as const) {
  const f = fixture(); f.player.x = 720;
  if (evade === 'roll') f.player.invuln = 5; else f.ctx.damagePlayer = () => {};
  const a = f.queue({ ...MYTH_ATTACKS.maelstrom, status: { kind: 'chill', power: .3, duration: 2 } }); f.tick(a.windup + .6);
  assert.equal(f.hits.length, 0); assert.equal(f.player.knockX, 0); assert.equal(f.player.statuses.length, 0, `${evade} avoids contact control as well as damage`);
}
for (const cancel of ['dead', 'far', 'removed', 'interrupted'] as const) {
  const f = fixture(); const a = f.queue(MYTH_ATTACKS.boulder);
  if (cancel === 'dead') f.enemy.dead = true;
  else if (cancel === 'far') f.player.x += 900;
  else if (cancel === 'removed') f.ctx.enemies = [];
  else f.enemy.cancelAttack();
  f.tick(a.windup + .5); assert.equal(f.shots.length, 0, `${cancel} source cannot release a delayed missile`);
}
{
  const f = fixture(); f.player.x = 720;
  const a = f.queue(MYTH_ATTACKS.blade); f.tick(a.windup + .06); f.enemy.windupAttack = null;
  f.tick(.9); assert.equal(f.hits.length, 0, 'Director interruption cancels an active physical swing');
  assert.equal(f.cues.at(-1)?.isActive?.(), false, 'Interrupted physical cue disappears immediately');
}
{
  const f = fixture(); f.ctx.camera = { x: 800, y: 800, zoom: 2 }; f.ctx.canvas = { width: 480, height: 400 };
  assert.equal(f.enemy.queueAttack(f.ctx, MYTH_ATTACKS.boulder), false, 'A source outside the actual small viewport cannot start a surprise attack');
  f.ctx.camera.x = 710;
  const a = f.queue(MYTH_ATTACKS.boulder); f.ctx.camera.x = 1000; f.tick(a.windup + .4);
  assert.equal(f.shots.length, 0, 'Leaving the actual viewport cancels a pending release');
}
{
  const f = fixture('aegean_dryad'); f.enemy.scripted = false; f.enemy.tacticTime = 0;
  f.tick(.025); assert.equal(f.enemy.windupAttack?.id, 'dryad_root', 'Field AI executes its authored physical repertoire');
}
{
  const cue: PhysicalAttackCue = { x: 100, y: 100, angle: 0, reach: 120, duration: .4, kind: 'spear', phase: 'strike', color: '#ffffff' };
  assert.equal(physicalPose(cue, .2).reach, 120, 'Physical spear pose reaches exactly its collision extent at full extension');
  const f = fixture(), translations: number[][] = [];
  const canvas = new Proxy({}, { get(_target, key) { return key === 'translate' ? (...args: number[]) => translations.push(args) : () => {}; }, set() { return true; } }) as CanvasRenderingContext2D;
  drawPhysicalAttack(canvas, { ...cue, source: f.enemy, elapsed: .2 });
  assert.deepEqual(translations[0], [100, 100], 'A committed player cue remains at its authored position');
  translations.length = 0; drawPhysicalAttack(canvas, { ...cue, source: f.enemy, followSource: true, elapsed: .2 });
  assert.deepEqual(translations[0], Object.values(physicalOrigin(f.enemy)), 'A held enemy weapon remains visibly attached to its body');
}

// Weapon cones must show the actual narrow spear / broad axe reach, while
// legacy callers retain their old cone width.
{
  const fx = new FxSystem(), arcs: number[][] = [];
  const canvas = new Proxy({}, { get(_target, key) { return key === 'arc' ? (...args: number[]) => arcs.push(args) : () => {}; }, set() { return true; } }) as CanvasRenderingContext2D;
  fx.telegraph(1, 2, 100, .5, '#ffffff', 'cone', 1, 13, .16);
  fx.draw(canvas);
  assert.equal(arcs[0][3], .84); assert.equal(arcs[0][4], 1.16, 'Spear telegraph uses its narrow authored angle');
  fx.clear(); arcs.length = 0;
  fx.telegraph(1, 2, 100, .5, '#ffffff', 'cone', 0, 13, 1.9);
  fx.draw(canvas);
  assert.equal(arcs[0][3], -1.9); assert.equal(arcs[0][4], 1.9, 'Wide chainblades show their full sweep');
  fx.clear(); arcs.length = 0;
  fx.telegraph(1, 2, 100, .5, '#ffffff', 'cone'); fx.draw(canvas);
  assert.equal(arcs[0][3], -.55); assert.equal(arcs[0][4], .55, 'Legacy cone drawing remains unchanged');
}

// Record draw commands one frame at a time; never allocate raster buffers.
function surface() {
  const hash = createHash('sha256'), state: Record<string, unknown> = { fillStyle: '', globalAlpha: 1 }, stack: Array<Record<string, unknown>> = [];
  const canvas = { width: 0, height: 0, fingerprint: () => hash.copy().digest('hex'), getContext: () => context };
  const context = new Proxy(state, { get(target, key: string) {
    if (key in target) return target[key];
    if (key === 'save') return () => stack.push({ ...state });
    if (key === 'restore') return () => Object.assign(state, stack.pop());
    if (key === 'drawImage') return (source: typeof canvas, ...args: number[]) => hash.update(JSON.stringify([key, source.fingerprint(), args, state]));
    return (...args: number[]) => hash.update(JSON.stringify([key, args, state]));
  }, set(target, key: string, value) { target[key] = value; return true; } });
  return canvas;
}
(globalThis as unknown as { document: unknown }).document = { createElement: () => surface() };
const fingerprints = new Map<string, string>();
for (const e of [...field, ...bosses]) {
  const art = drawMythCreature(creatureStyle(e.creature!.kind, e.creature!.palette), 'down', { t: .25, walk: false, lunge: 0, hurt: false, bob: 0 });
  const fingerprint = (art.canvas as unknown as { fingerprint(): string }).fingerprint();
  assert(!fingerprints.has(fingerprint), `${e.id} duplicates ${fingerprints.get(fingerprint)}`);
  fingerprints.set(fingerprint, e.id);
  if (e.boss) assert.equal(art.w, 64, 'Boss anatomy uses its own larger composition');
}
console.log(`Greek bestiary passed: ${field.length} native field species, ${bosses.length} bespoke bosses; physical source cues, swept melee contact, visible projectiles, locked body travel, walls, interruption, viewport gating, dodges, control effects and distinct drawing commands.`);
