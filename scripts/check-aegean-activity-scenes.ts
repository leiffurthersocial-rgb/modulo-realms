/** One serial map-generation process. No browser, canvas buffers or server. */
import assert from "node:assert/strict";
import { AEGEAN_ACTIVITIES } from "../src/data/aegean/progression";
import { AEGEAN_ACTIVITY_SCENES } from "../src/data/aegean/activityScenes";
import { AEGEAN_LOCATIONS } from "../src/data/aegean/world";
import { AEGEAN_PROP_NAMES } from "../src/game/art/aegean";
import { PROP_NAMES } from "../src/game/art/props";
import { AegeanActivities, layoutActivityScene } from "../src/game/aegean/activities";
import { generateOverworld } from "../src/game/world/worldgen";
import { generateDungeon } from "../src/game/world/dungeons";
import { createMap, boxHitsTerrain, propsInRect, type GameMap, type MovementProfile, type PropInstance } from "../src/game/world/map";
import { T, TILE } from "../src/game/world/tiles";
import type { Game } from "../src/game/core/game";

const noop = () => undefined;
const context = new Proxy({}, {
  get: (_target, key) => key === "createLinearGradient" || key === "createRadialGradient"
    ? () => ({ addColorStop: noop }) : key === "measureText" ? () => ({ width: 0 }) : noop,
  set: () => true,
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;

const art = new Set([...PROP_NAMES, ...AEGEAN_PROP_NAMES]);
assert.equal(Object.keys(AEGEAN_ACTIVITY_SCENES).length, AEGEAN_ACTIVITIES.length);
for (const a of AEGEAN_ACTIVITIES) {
  const scene = AEGEAN_ACTIVITY_SCENES[a.id];
  assert(scene, `${a.id} has an authored scene`);
  for (const p of [scene.anchor, ...scene.objects, ...(scene.scenery ?? [])])
    assert(art.has(p.art), `${a.id}: ${p.art} must have authored art, not a fallback`);
  const required = Math.max(0, ...a.steps.map(step => step.type === "puzzle" ? Math.max(...step.sequence!) :
    ["channel", "strike", "race", "dodge"].includes(step.type) || step.type === "escort" || step.type === "visit" && !a.id.includes("_discovery_") ||
      (step.type === "interact" || step.type === "visit") && step.count > 1 ? step.count : 0));
  assert.equal(scene.objects.length, required, `${a.id} has exactly the objects its mechanics need`);
  assert.equal(new Set([scene.anchor, ...scene.objects].map(p => p.name)).size, scene.objects.length + 1);
  for (const p of [scene.anchor, ...scene.objects]) assert(!/station\s*\d|numbered/i.test(p.name));
}

/** Independent flood of installed terrain and collision, including the space
 * halfway between tile centres. Every puzzle/escort route must remain usable. */
function reachable(map: GameMap, anchor: PropInstance, targets: PropInstance[]): void {
  const profile = anchor.data!.movement as MovementProfile;
  const hw = profile === "ship" ? 16 : 12, hh = profile === "ship" ? 12 : 10;
  const solid = propsInRect(map, anchor.x - 18 * TILE, anchor.y - 18 * TILE,
    anchor.x + 18 * TILE, anchor.y + 18 * TILE, []).map(i => map.props[i]).filter(p => p.cw && p.ch);
  const blocked = (x: number, y: number) => boxHitsTerrain(map, x, y, hw, hh, profile) || solid.some(p =>
    x + hw > p.x - p.cw! / 2 && x - hw < p.x + p.cw! / 2 && y + hh > p.y - p.ch! && y - hh < p.y);
  const queue = [{ x: anchor.x, y: anchor.y }], seen = new Set([`${anchor.x},${anchor.y}`]);
  assert(!blocked(anchor.x, anchor.y), `${anchor.data!.activity}: anchor is usable`);
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    for (const [dx, dy] of [[TILE, 0], [-TILE, 0], [0, TILE], [0, -TILE]]) {
      const x = p.x + dx, y = p.y + dy, key = `${x},${y}`;
      if (seen.has(key) || Math.abs(x - anchor.x) > 16 * TILE || Math.abs(y - anchor.y) > 16 * TILE ||
        blocked(x, y) || blocked(p.x + dx / 2, p.y + dy / 2)) continue;
      seen.add(key); queue.push({ x, y });
    }
  }
  for (const p of targets) {
    assert(seen.has(`${p.x},${p.y}`), `${p.data!.activity}: ${p.label} is reachable from the landmark`);
    assert(Math.hypot(p.x - anchor.x, p.y - anchor.y) <= 12 * TILE, `${p.label} stays a local scene`);
  }
}

// A wall bisects the authored layout; controls must follow the side of its
// landmark, never jump to the closer disconnected ground beyond the wall.
const small = createMap({ id: "scene-test", name: "scene-test", w: 36, h: 36 });
small.tiles.fill(T.GRASS);
for (let y = 0; y < small.h; y++) small.tiles[y * small.w + 20] = T.MOUNTAIN;
const fixture = { ...AEGEAN_ACTIVITIES.find(a => a.id === "aegean_story_olive")!, tx: 18, ty: 18 };
let placed = layoutActivityScene(small, fixture).filter(p => p.interact);
assert.equal(placed.length, 4);
assert(placed.every(p => p.x < 20 * TILE));
reachable(small, placed[0], placed);
// The same story positioned at sea stays at sea, despite reachable dry shore.
small.tiles.fill(T.WATER);
for (let y = 0; y < small.h; y++) for (let x = 22; x < small.w; x++) small.tiles[y * small.w + x] = T.GRASS;
placed = layoutActivityScene(small, fixture).filter(p => p.interact);
assert.equal(placed.length, 4);
assert(placed.every(p => p.data?.movement === "ship" && p.x < 22 * TILE));
reachable(small, placed[0], placed);

// A one-object discovery must really finish through the normal interaction;
// removing its old unused markers must not leave a hidden visit requirement.
for (const id of ["aegean_discovery_last_mile", "aegean_discovery_wind_stair"]) {
  const a = AEGEAN_ACTIVITIES.find(a => a.id === id)!;
  const map = createMap({ id: "overworld", name: "discovery-test", w: 36, h: 36 });
  map.tiles.fill(T.GRASS);
  map.props.push(...layoutActivityScene(map, { ...a, tx: 18, ty: 18 }));
  const completed = new Set<string>(), quests = new Map<string, { progress: number[] }>();
  let saves = 0;
  const runtime = new AegeanActivities({
    map, now: 0, enemies: [], trackedQuest: null,
    player: { flags: new Set<string>() },
    campaign: { requirements: () => [], has: (id: string) => completed.has(id) },
    quests: {
      completed: [], get: (id: string) => quests.get(id),
      accept: (id: string) => { const q = { progress: [0] }; quests.set(id, q); return q; },
      complete: (id: string) => quests.delete(id),
    },
    completeAegean: (id: string) => completed.add(id),
    toast: noop, touch: noop, autosave: () => { saves++; },
  } as unknown as Game);
  assert.equal(map.props.filter(p => p.interact).length, 1);
  runtime.interact(map.props.find(p => p.interact)!);
  assert(completed.has(id), `${id}: one-object discovery awards its actual reward`);
  assert.equal(runtime.state.active, null);
  assert.equal(saves, 1);
  assert.equal(quests.size, 0, "The ordinary journal completes with the discovery");
}

const mapIds = [...new Set(AEGEAN_ACTIVITIES.map(a => a.map ?? "overworld"))];
const seed = Number(process.env.AEGEAN_TEST_SEED ?? 1337);
let interactions = 0;
for (const id of mapIds) {
  const map = id === "overworld" ? generateOverworld(seed) :
    generateDungeon(AEGEAN_LOCATIONS.find(loc => loc.dungeon?.mapId === id)!, seed);
  const runtime = new AegeanActivities({ map } as Game);
  runtime.install(map);
  for (const a of AEGEAN_ACTIVITIES.filter(a => (a.map ?? "overworld") === id)) {
    const targets = map.props.filter(p => p.data?.activity === a.id);
    const scene = AEGEAN_ACTIVITY_SCENES[a.id];
    assert.equal(targets.length, scene.objects.length + 1, `${a.id}: every required object was installed`);
    const anchor = targets.find(p => p.data?.index === 0)!;
    reachable(map, anchor, targets);
    assert(Math.hypot(anchor.x - (a.tx + 0.5) * TILE, anchor.y - (a.ty + 0.5) * TILE) <= 6 * TILE,
      `${a.id}: scene did not relocate to a distant shore`);
    assert.equal(new Set(targets.map(p => `${p.x},${p.y}`)).size, targets.length);
    runtime.state.active = a.id;
    for (let index = 0; index < a.steps.length; index++) {
      const step = a.steps[index];
      runtime.state.runs[a.id] = { id: a.id, step: index, progress: 0, visited: [], timer: 0, started: false, wave: 0, sequence: [] };
      const target = runtime.target;
      assert(target && targets.some(p => p.x === target.x && p.y === target.y && p.label === target.name));
      if (step.type === "puzzle") assert.equal(target.name, scene.objects[step.sequence![0] - 1].name);
      if (step.type === "escort") {
        runtime.state.runs[a.id].started = true;
        assert.equal(runtime.target!.name, scene.objects[0].name);
        if (step.count > 1) {
          runtime.state.runs[a.id].progress = 1;
          assert.equal(runtime.target!.name, scene.objects[1].name);
        }
      }
    }
    interactions += targets.length;
  }
}
console.log(`All ${AEGEAN_ACTIVITIES.length} authored activity scenes passed: valid art, necessary objects, connected land/sea routes, and real journal targets (${interactions} interactions).`);
