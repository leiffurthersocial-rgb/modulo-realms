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

function fixture(id = 'aegean_nemea') {
  const map = createMap({ id: 'myth_test', name: 'Myth test', w: 80, h: 80, kind: 'dungeon' });
  map.tiles.fill(T.MARBLE);
  const player = new Player({ name: 'Pattern test', race: 'human', cls: 'warrior', hairIndex: 0, skinIndex: 0, hairStyle: 'short', beard: 'none' });
  player.x = 800; player.y = 800;
  const enemy = new Enemy(id, 650, 800, 100);
  enemy.scripted = true; enemy.attackCd = 0;
  const hits: DamageOpts[] = [], warnings: unknown[][] = [], shots: ProjectileSpec[] = [];
  const ctx: WorldCtx = { map, player, enemies: [enemy], now: 100, dt: .025,
    damageEnemy() {}, damagePlayer(_amount, opts = {}) { if (player.invuln <= 0) { hits.push(opts); player.hp -= 1; } },
    spawnProjectile(shot) { shots.push(shot); }, particles() {}, floatText() {}, shake() {}, playSound() {},
    telegraph(...args) { warnings.push(args); }, summon() {}, ringAt() {},
  };
  const tick = (seconds: number) => { for (let t = 0; t < seconds; t += ctx.dt) { ctx.now += ctx.dt; enemy.update(ctx); } };
  const queue = (a: BossAttack) => { assert(enemy.queueAttack(ctx, a)); return a; };
  return { ctx, enemy, player, hits, warnings, shots, tick, queue };
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
{
  const f = fixture(); f.player.x = 685;
  const a = f.queue(MYTH_ATTACKS.antlers); f.tick(a.windup + .03);
  assert.equal(f.hits.length, 0, 'Safe centre of annular attack really is safe');
}
{
  const f = fixture(); const a = f.queue(MYTH_ATTACKS.antlers); f.tick(a.windup + .03);
  assert.equal(f.hits.length, 1, 'Standing in the outer shockwave is punished');
}
{
  const f = fixture(); const a = f.queue(MYTH_ATTACKS.root);
  assert.equal(f.warnings.length, 2, 'Cross advertises both immutable lanes');
  f.player.x += 90; f.player.y += 90; f.tick(a.windup + .03);
  assert.equal(f.hits.length, 0, 'A diagonal gap evades the root cross');
}
{
  const f = fixture(); const a = f.queue(MYTH_ATTACKS.root); f.tick(a.windup + .03);
  assert.equal(f.hits.length, 1); assert(f.player.statuses.some(s => s.kind === 'chill'), 'A connecting web/root slows');
}
{
  const f = fixture(); f.player.invuln = 5;
  const a = f.queue(MYTH_ATTACKS.root); f.tick(a.windup + .03);
  assert.equal(f.hits.length, 0); assert.equal(f.player.statuses.length, 0, 'Dodge also avoids control effects');
}
{
  const f = fixture(); f.ctx.damagePlayer = () => {}; // Random dodge / absorption: no invulnerability timer.
  const a = f.queue(MYTH_ATTACKS.root); f.tick(a.windup + .03);
  assert.equal(f.player.statuses.length, 0, 'A missed/absorbed hit cannot apply a control status');
}
{
  const f = fixture(); f.ctx.damagePlayer = () => {};
  const a = f.queue(MYTH_ATTACKS.maelstrom); f.tick(a.windup + .03);
  assert.equal(f.player.knockX, 0, 'A randomly dodged pull cannot displace the player');
}
{
  const f = fixture(); const a = f.queue(MYTH_ATTACKS.feathers); f.tick(a.windup + .03);
  assert.equal(f.shots.length, a.count); assert.equal(f.warnings.length, a.count);
  assert(f.shots.some(s => Math.cos(s.angle) < -.9) && f.shots.some(s => Math.cos(s.angle) > .9), 'Nova fires a full radial pattern');
  assert(f.shots.every(s => s.radius === a.radius && s.speed === a.projectileSpeed));
}
{
  const f = fixture(); const a = f.queue(MYTH_ATTACKS.pounce); f.player.y += 160; f.tick(a.windup + .03);
  assert.equal(f.hits.length, 0); assert.equal(f.enemy.y, 800); assert.equal(f.enemy.x, 800, 'Pounce lands at its committed shadow, not a homing hit');
}
{
  const f = fixture(); for (let y = 0; y < 80; y++) setTile(f.ctx.map, 23, y, T.WALL_STONE);
  const a = f.queue(MYTH_ATTACKS.pounce); f.tick(a.windup + .03);
  assert.equal(f.hits.length, 0); assert.equal(f.enemy.x, 650, 'Pounce cannot jump through a wall');
}
{
  const f = fixture(); const a = f.queue(MYTH_ATTACKS.blade); f.tick(a.windup + .03);
  assert.equal(f.hits.length, 1); assert.equal(f.warnings.length, 2, 'Second strike gets its own warning');
  f.player.y += 180; f.tick((a.repeatDelay ?? .8) + .05);
  assert.equal(f.hits.length, 1, 'Leaving the echo escapes its second hit');
}
{
  const f = fixture(); const a = f.queue(MYTH_ATTACKS.blade); f.tick(a.windup + (a.repeatDelay ?? .8) + .08);
  assert.equal(f.hits.length, 2, 'Standing still takes both blade strikes');
}
{
  const f = fixture(); const a = f.queue(MYTH_ATTACKS.maelstrom); f.tick(a.windup + .03);
  assert(f.player.knockX < 0, 'Maw pulls toward itself rather than pushing the player away');
}
{
  const f = fixture(); f.player.invuln = 10;
  const a = f.queue(MYTH_ATTACKS.maelstrom); f.tick(a.windup + .03);
  assert.equal(f.player.knockX, 0, 'Rolling through the suck avoids displacement');
}
{
  const f = fixture('aegean_dryad'); f.enemy.scripted = false; f.enemy.tacticTime = 0;
  f.tick(.025); assert.equal(f.enemy.windupAttack?.id, 'dryad_root', 'Field AI actually executes its authored repertoire');
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
console.log(`Greek bestiary passed: ${field.length} native field species, ${bosses.length} bespoke bosses; safe gaps, radial projectiles, locked pounces, walls, echo timing, pulls, dodges, control effects and distinct drawing commands.`);
