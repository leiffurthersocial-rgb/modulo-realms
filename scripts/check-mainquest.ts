/**
 * The main story: the chain is whole, every reference resolves, the levels
 * climb, the finale is the Remainder at the top of the range — and, against a
 * real Game, the rules the story is built on hold:
 *
 * - a chapter waits on its level and is taken the moment the level arrives;
 * - an unfound place gets directions, never an arrow;
 * - a boss killed before its chapter counts;
 * - a hunt counts real spawns in its region and nothing else;
 * - the way down to the Remainder is barred until the story lifts the bar;
 * - an old save that already did everything catches up in one pass.
 *
 * DOM and storage are in-memory stubs; no world is generated.
 */
import assert from "node:assert/strict";
import type { Game as GameType } from "../src/game/core/game";

const noop = () => {};
function canvas(): HTMLCanvasElement {
  const context = new Proxy({ imageSmoothingEnabled: false }, {
    get(target, key) {
      if (key in target) return Reflect.get(target, key);
      if (key === "measureText") return (text: string) => ({ width: text.length * 8 });
      if (key === "createLinearGradient" || key === "createRadialGradient") return () => ({ addColorStop: noop });
      return noop;
    },
    set: (target, key, value) => Reflect.set(target, key, value),
  });
  return Object.assign(new EventTarget(), {
    width: 800, height: 600, style: {}, getContext: () => context,
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: 800, height: 600 }),
  }) as unknown as HTMLCanvasElement;
}
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() },
  window: Object.assign(new EventTarget(), { setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop }),
  document: Object.assign(new EventTarget(), { createElement: () => canvas() }),
});

const { Game } = await import("../src/game/core/game");
const { Player } = await import("../src/game/player/player");
const { QuestLog } = await import("../src/game/quests/questlog");
const { createMap } = await import("../src/game/world/map");
const { T } = await import("../src/game/world/tiles");
const { QUEST_BY_ID } = await import("../src/data/quests");
const { MAIN_ORDER, MAIN_ACTS, MAIN_REPORT } = await import("../src/data/mainquest");
const { NPC_BY_ID } = await import("../src/data/npcs");
const { LOCATION_BY_ID, LOCATIONS, REGION_BY_ID } = await import("../src/data/locations");
const { ENEMY_BY_ID } = await import("../src/data/enemies");
const { AEGEAN_ENTRY_BOSSES } = await import("../src/data/aegean/progression");

/* ------------------------------ the data ------------------------------ */

const steps = MAIN_ORDER.map((id) => {
  const q = QUEST_BY_ID[id];
  assert(q, `${id}: main story step exists`);
  return q;
});
assert.equal(steps[0].id, "tutorial", "the story starts with the tutorial");
const bossLevel = new Map<string, number>();
for (const loc of LOCATIONS) {
  const d = loc.dungeon;
  if (d?.boss) bossLevel.set(d.boss, d.bossLevel ?? d.level + 1);
  if (d?.miniboss && !bossLevel.has(d.miniboss)) bossLevel.set(d.miniboss, d.level);
}
let lastLevel = 0, lastAct = 1;
steps.forEach((q, i) => {
  assert(q.main, `${q.id}: flagged main`);
  assert(q.act && MAIN_ACTS.some((a) => a.act === q.act), `${q.id}: belongs to a known act`);
  assert(q.act >= lastAct, `${q.id}: acts never go backwards`);
  lastAct = q.act;
  const gate = q.prereq?.level ?? q.level;
  assert(gate >= lastLevel, `${q.id}: level gate ${gate} does not drop below ${lastLevel}`);
  lastLevel = gate;
  if (i > 0) assert.equal(q.prereq?.quest, steps[i - 1].id, `${q.id}: follows ${steps[i - 1].id}`);
  assert(!q.auto || q.id === "tutorial", `${q.id}: main steps are offered by the story, not by walking past a marker`);
  assert(NPC_BY_ID[q.giver], `${q.id}: giver ${q.giver} exists`);
  if (q.turnIn) {
    assert(NPC_BY_ID[q.turnIn], `${q.id}: hand-in ${q.turnIn} exists`);
    if (q.id !== "tutorial") {
      assert(MAIN_REPORT[q.turnIn], `${q.id}: the tracker knows where ${q.turnIn} is`);
      assert(LOCATION_BY_ID[MAIN_REPORT[q.turnIn].location], `${q.turnIn}: report location resolves`);
    }
  }
  if (q.marker) assert(LOCATION_BY_ID[q.marker], `${q.id}: marker ${q.marker} resolves`);
  if (q.guide === "discovered") assert(q.hint && q.hint.length > 20, `${q.id}: an unguided step carries directions`);
  if (!q.marker && q.id !== "tutorial") assert(q.hint, `${q.id}: a step without a marker still says where`);
  for (const o of q.objectives) {
    if (o.type === "boss") {
      const e = ENEMY_BY_ID[o.enemy];
      assert(e, `${q.id}: ${o.enemy} exists`);
      const lv = bossLevel.get(o.enemy);
      assert(lv !== undefined, `${q.id}: ${o.enemy} lives in a dungeon`);
      // The chapter opens a little before its boss, never after it is trivial.
      assert(lv! >= gate - 1, `${q.id}: ${o.enemy} (Lv ${lv}) is not below the chapter's gate ${gate}`);
    }
    if (o.type === "hunt") {
      assert(REGION_BY_ID[o.region as keyof typeof REGION_BY_ID], `${q.id}: hunt region ${o.region} exists`);
      const r = REGION_BY_ID[o.region as keyof typeof REGION_BY_ID];
      assert(gate >= r.level[0] - 2 && gate <= r.level[1], `${q.id}: hunts ${o.region} at a level that region is for`);
    }
    if (o.type === "explore") assert(LOCATION_BY_ID[o.location], `${q.id}: ${o.location} resolves`);
    if (o.type === "clear") assert(LOCATIONS.some((l) => l.dungeon?.mapId === o.map), `${q.id}: ${o.map} is a dungeon`);
  }
});
const finale = steps[steps.length - 1];
assert.deepEqual(finale.objectives.map((o) => o.type === "boss" && o.enemy), ["boss_remainder"], "the last chapter is the Remainder");
assert.equal(bossLevel.get("boss_remainder"), 75, "the Remainder waits at the top of the west's range");
const storyBosses = new Set(steps.flatMap((q) => q.objectives.flatMap((o) => (o.type === "boss" ? [o.enemy] : []))));
for (const id of AEGEAN_ENTRY_BOSSES) assert(storyBosses.has(id), `${id}: every boss that opens Achaea is on the story's road`);
for (const [id, lv] of bossLevel) if (storyBosses.has(id)) assert(lv <= 75, `${id}: west story stays inside level 75`);

/* ------------------------------ a real Game ------------------------------ */

const game: GameType = new Game(canvas());
function fresh(level: number): void {
  game.player = new Player({ name: "Story", race: "human", cls: "warrior", hairIndex: 0, skinIndex: 0, hairStyle: "short", beard: "none" });
  game.player.level = level;
  game.quests = new QuestLog();
  game.trackedQuest = null;
  game.toasts.length = 0;
  game.storyCards.length = 0;
}
game.map = createMap({ id: "overworld", name: "Story bootstrap", w: 64, h: 64 });
game.map.tiles.fill(T.GRASS);
game.maps.set(game.map.id, game.map);
game.screen = "playing";

// 1. The tutorial hands over, and the next chapter waits on its level.
fresh(1);
game.quests.accept("tutorial");
game.player.discovered.add("ashvale");
game.player.discovered.add("whisperwell");
for (const id of game.quests.onExplore("whisperwell")) game.questProgressToast(id);
assert(game.quests.isCompleted("tutorial"), "the tutorial pays on the spot");
assert(game.quests.isActive("main_count"), "chapter one is taken the moment the tutorial ends");
assert.equal(game.trackedQuest, "main_count", "and tracked");
for (const id of game.quests.onClear("dungeon_whisper")) game.questProgressToast(id);
assert(game.quests.isActive("main_count"), "a chapter with a hand-in waits for it");
assert.equal(game.mainStoryState().kind, "report", "the tracker says who to report to");
game.turnInQuest("main_count");
let state = game.mainStoryState();
assert(state.kind === "level" && state.needLevel === 6, "the next chapter waits on level 6");
assert(!game.quests.isActive("main_brood"), "and is not taken before it");
assert(state.kind === "level" && state.huntRegion, "and says where people of your level hunt");

// 2. A level up anywhere opens it. The mine is unfound: directions, no arrow.
game.player.level = 6;
game.update(1 / 60);
assert(game.quests.isActive("main_brood"), "reaching the level takes the chapter");
assert.equal(game.trackedTarget(), null, "an unfound place gets no compass arrow");
assert.equal(game.quests.markers(game.player).length, 0, "nor an atlas flag");
game.player.discovered.add("ironroot_mine");
assert(game.trackedTarget(), "once found, the arrow appears");

// 3. A hunt counts real spawns in its region, and nothing else.
const huntIndex = QUEST_BY_ID.main_brood.objectives.findIndex((o) => o.type === "hunt");
game.quests.onKill("wolf", "east");
game.quests.onKill("wolf", undefined);
assert.equal(game.quests.get("main_brood")!.progress[huntIndex], 0, "kills elsewhere, or by summons, do not count");
for (let i = 0; i < 20; i++) game.quests.onKill("wolf", "central");
assert.equal(game.quests.get("main_brood")!.progress[huntIndex], 20, "valley kills count to the target and stop");

// 4. A boss killed before its chapter counts the moment the chapter is taken.
fresh(12);
for (const id of ["tutorial", "main_count", "main_brood", "main_court"]) game.quests.completed.push(id);
game.player.bossesKilled.add("boss_matriarch");
game.offerMainQuests();
const mq = game.quests.get("main_matriarch")!;
assert.equal(mq.progress[1], 1, "the Matriarch felled on a bounty counts");
assert.equal(mq.progress[0], 0, "but the cull is still yours to do");

// 5. The bar on the way down.
fresh(75);
assert(game.mainStorySeal("dungeon_remainder"), "the way down is barred without the story");
assert.equal(game.mainStorySeal("dungeon_lastgate"), null, "only the Remainder's stair is barred");
game.quests.accept("main_remainder");
assert.equal(game.mainStorySeal("dungeon_remainder"), null, "the last chapter lifts it");
fresh(75);
game.player.bossesKilled.add("boss_remainder");
assert.equal(game.mainStorySeal("dungeon_remainder"), null, "a save that already went down keeps its way open");

// 6. A veteran save catches up in one pass, paid, with one toast.
fresh(80);
for (const q of steps) for (const o of q.objectives) {
  if (o.type === "boss") game.player.bossesKilled.add(o.enemy);
  if (o.type === "clear") game.player.clearedDungeons.add(o.map);
  if (o.type === "explore") game.player.discovered.add(o.location);
}
game.player.discovered.add("whisperwell");
const gold = game.player.gold;
game.offerMainQuests(true);
assert.deepEqual(MAIN_ORDER.filter((id) => !game.quests.isCompleted(id)), [], "every chapter already earned is completed");
assert.equal(game.mainStoryState().kind, "done");
assert(game.player.gold > gold, "and paid");
assert.equal(game.toasts.filter((t) => t.title === "Main story caught up").length, 1, "with one toast, not twelve");

// 7. A player mid-region is not handed the cull on load.
fresh(6);
for (const id of ["tutorial", "main_count"]) game.quests.completed.push(id);
game.player.killCounts.mini_broodmother = 1;
game.offerMainQuests(true);
assert(game.quests.isActive("main_brood"), "a level-6 player still has the valley to thin");
fresh(30);
for (const id of ["tutorial", "main_count"]) game.quests.completed.push(id);
game.player.killCounts.mini_broodmother = 1;
game.offerMainQuests(true);
assert(game.quests.isCompleted("main_brood"), "a level-30 player who outgrew the valley is not sent back to it");

// 8. The story is told: a chapter opened in play gets its card (its act's card
// first when it opens an act); a catch-up on load shows none; a level gate
// names the experience still to earn.
fresh(6);
game.quests.completed.push("tutorial", "main_count");
game.offerMainQuests();
assert.deepEqual(game.storyCards.map((c) => c.title), ["Too Many Legs"], "a chapter opened in play gets one card");
assert.equal(game.storyCards[0].goal, QUEST_BY_ID.main_brood.summary, "the card says what to do");
fresh(9);
game.quests.completed.push("tutorial", "main_count", "main_brood");
game.offerMainQuests();
assert.deepEqual(game.storyCards.map((c) => c.title), [MAIN_ACTS[1].name, "Word to the Court"], "a new act opens with its own card");
game.nextStoryCard();
game.nextStoryCard();
assert.equal(game.storyCards.length, 0, "cards are read one by one");
fresh(80);
for (const q of steps) for (const o of q.objectives) if (o.type === "boss") game.player.bossesKilled.add(o.enemy);
game.offerMainQuests(true);
assert.equal(game.storyCards.length, 0, "catching up on load tells no story");
fresh(4);
game.quests.completed.push("tutorial", "main_count");
const gate = game.levelGateHelp(6);
assert(gate.xpToGo > 0, "a level gate names the experience still to earn");

console.log(`Main story: ${steps.length} chapters across ${MAIN_ACTS.length} acts — chain, references, level gates, guidance, hunts, pre-credit, the bar and catch-up all hold.`);
