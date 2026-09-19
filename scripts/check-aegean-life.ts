import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PROP_NAMES } from "../src/game/art/props";
import { AEGEAN_PROP_NAMES } from "../src/game/art/aegean";
import { AEGEAN_NPCS } from "../src/data/aegean/npcs";
import { AEGEAN_LOCATIONS } from "../src/data/aegean/world";
import { TEMPLATE_BY_ID } from "../src/data/items";
import { NpcEntity } from "../src/game/entities/npcEntity";
import {
  AudioManager,
  aegeanMusicForRegion,
  type MusicTrack,
} from "../src/game/audio/audio";
import { generateOverworld } from "../src/game/world/worldgen";
import { buildInterior } from "../src/game/world/interiors";
import { boxHitsTerrain, propsInRect } from "../src/game/world/map";

const towns = AEGEAN_LOCATIONS.filter((l) => l.kind === "village");
assert.equal(AEGEAN_NPCS.length, 48);
assert.equal(new Set(AEGEAN_NPCS.map((n) => n.id)).size, 48);
assert.equal(AEGEAN_NPCS.filter((n) => n.services?.includes("inn")).length, 16);
for (const town of towns) {
  const locals = AEGEAN_NPCS.filter(
    (n) => n.map === "overworld" && n.id.startsWith(town.id + "_"),
  );
  assert.equal(locals.length, 4, `${town.id}: four distinct residents`);
  assert.equal(
    new Set(locals.map((n) => `${n.tx}:${n.ty}`)).size,
    4,
    `${town.id}: no stacked spawns`,
  );
  for (const n of locals) {
    assert.equal(n.schedule?.length, 3, `${n.id}: work, evening and home`);
    const npc = new NpcEntity(n);
    for (const leg of n.schedule!) {
      assert.ok(
        Math.hypot(leg.tx - town.tx, leg.ty - town.ty) < 30,
        `${n.id}: schedule stays in its own town`,
      );
      npc.updateSchedule(leg.at);
      assert.equal(npc.anchorX, leg.tx * 32 + 16);
      assert.equal(npc.anchorY, leg.ty * 32 + 16);
      assert.equal(npc.scheduleLabel, leg.label);
    }
    npc.updateSchedule(2);
    assert.equal(
      npc.scheduleLabel,
      "at home",
      `${n.id}: late-night schedules wrap correctly`,
    );
  }
}
for (const n of AEGEAN_NPCS) {
  for (const topic of n.topics ?? [])
    assert.ok(
      n.nodes?.some((node) => node.id === topic.to),
      `${n.id}: valid dialogue target`,
    );
  for (const stock of n.shop?.stock ?? [])
    assert.ok(TEMPLATE_BY_ID[stock.item], `${n.id}: valid stock ${stock.item}`);
}

// Keep the original soundtrack rows byte-for-byte intact, including timbre,
// volume, scale, tempo and swing; Greek composition is an additive branch.
const oldAudio = execFileSync(
  "git",
  ["show", "d39d75a:src/game/audio/audio.ts"],
  { encoding: "utf8" },
);
const currentAudio = readFileSync("src/game/audio/audio.ts", "utf8");
for (const id of [
  "title",
  "village",
  "world",
  "forest",
  "north",
  "desert",
  "dungeon",
  "boss",
]) {
  const row = oldAudio.split("\n").find((line) => line.startsWith(`  ${id}:`));
  assert.ok(
    row && currentAudio.includes(row),
    `${id}: original soundtrack definition must be preserved`,
  );
}
assert.equal(aegeanMusicForRegion("forest"), undefined);
assert.equal(aegeanMusicForRegion("aegean_arcadia"), "grove");
assert.equal(aegeanMusicForRegion("aegean_sparta", true), "lacedaemon");
assert.equal(aegeanMusicForRegion("aegean_coast"), "seafarer");

const events: Array<{ type: string; value: number }> = [];
const parameter = () => ({
  value: 0,
  setValueAtTime(value: number) {
    assert.ok(Number.isFinite(value));
  },
  linearRampToValueAtTime(value: number) {
    assert.ok(Number.isFinite(value) && value >= 0);
  },
  exponentialRampToValueAtTime(value: number) {
    assert.ok(Number.isFinite(value) && value > 0);
  },
});
const node = () => ({ connect() {}, disconnect() {} });
class FakeAudioContext {
  currentTime = 0;
  sampleRate = 80;
  state = "running";
  destination = node();
  createGain() {
    return { ...node(), gain: parameter() };
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(Math.ceil(length)) };
  }
  createBiquadFilter() {
    return { ...node(), type: "lowpass", frequency: parameter() };
  }
  createBufferSource() {
    return {
      ...node(),
      buffer: null,
      start(time: number) {
        events.push({ type: "noise", value: time });
      },
      stop(time: number) {
        assert.ok(Number.isFinite(time));
      },
    };
  }
  createOscillator() {
    const frequency = parameter();
    return {
      ...node(),
      type: "sine",
      frequency,
      start(time: number) {
        assert.ok(Number.isFinite(time));
        events.push({ type: "tone", value: frequency.value });
      },
      stop(time: number) {
        assert.ok(Number.isFinite(time));
      },
    };
  }
}
let schedule = () => {};
let timers = 0;
const previousWindow = globalThis.window;
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    AudioContext: FakeAudioContext,
    setInterval(callback: () => void) {
      schedule = callback;
      timers++;
      return 1;
    },
    clearInterval() {
      timers--;
    },
  },
});
try {
  const audio = new AudioManager();
  const tracks: MusicTrack[] = [
    "aegean",
    "polis",
    "grove",
    "oracle",
    "seafarer",
    "lacedaemon",
    "storm",
    "underworld",
    "phalanx",
    "oath",
  ];
  for (const track of tracks) {
    events.length = 0;
    audio.playMusic(track);
    schedule();
    assert.ok(
      events.some((e) => e.type === "tone"),
      `${track}: produces scheduled music`,
    );
    assert.ok(events.length < 40, `${track}: bounded voice scheduling`);
    assert.ok(
      events
        .filter((e) => e.type === "tone")
        .every((e) => e.value >= 20 && e.value < 6000),
      `${track}: audible finite pitches`,
    );
    assert.equal(timers, 1, "Changing regions must reuse one audio scheduler");
  }
  for (const cue of [
    "ship_oar",
    "ship_ram",
    "ship_dock",
    "storm_thunder",
    "bronze_gate",
    "phalanx_horn",
    "oath_bell",
  ]) {
    events.length = 0;
    audio.play(cue, 0.6);
    assert.ok(
      events.length > 0,
      `${cue}: actual synthesized cue, not a missing switch case`,
    );
    assert.ok(events.length <= 4, `${cue}: bounded effect voices`);
  }
  audio.stopMusic();
  assert.equal(timers, 0, "Stopping music releases its only timer");
} finally {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: previousWindow,
  });
}

if (process.argv.includes("--world")) {
  // Use the real terrain and collision boxes without allocating pixel buffers.
  const noop = () => undefined;
  const context = new Proxy({}, {
    get: (_target,key) => key === 'createLinearGradient' || key === 'createRadialGradient'
      ? () => ({ addColorStop:noop }) : key === 'measureText' ? () => ({ width:0 }) : noop,
    set: () => true,
  });
  globalThis.document = { createElement: () => ({ width:0,height:0,getContext:() => context }) } as unknown as Document;
  const world = generateOverworld(42);
  const indices: number[] = [];
  const random = Math.random;
  Math.random = () => 0.95;
  try {
    for (const def of AEGEAN_NPCS.filter((n) => n.map === "overworld")) {
      const npc = new NpcEntity(def);
      for (const leg of def.schedule!) {
        const x = leg.tx * 32 + 16,
          y = leg.ty * 32 + 16;
        assert.equal(
          boxHitsTerrain(world, x, y, 8, 5),
          false,
          `${def.id}: ${leg.label} terrain`,
        );
        propsInRect(world, x - 64, y - 96, x + 64, y + 32, indices);
        assert.equal(
          indices.some((i) => {
            const p = world.props[i];
            return (
              !!p.cw &&
              !!p.ch &&
              x + 8 > p.x - p.cw / 2 &&
              x - 8 < p.x + p.cw / 2 &&
              y + 5 > p.y - p.ch &&
              y - 5 < p.y
            );
          }),
          false,
          `${def.id}: ${leg.label} is outside buildings and solid props`,
        );
        npc.updateSchedule(leg.at);
        for (let frame = 0; frame < 60 * 65; frame++)
          npc.update(1 / 60, world, 0, 0);
        assert.ok(
          Math.hypot(npc.x - x, npc.y - y) <= 41,
          `${def.id}: can actually walk to ${leg.label}`,
        );
      }
    }
  } finally {
    Math.random = random;
  }
  const allArt = new Set([...PROP_NAMES, ...AEGEAN_PROP_NAMES]);
  for (const door of world.portals.filter(p => p.to.startsWith('int_aegean_'))) {
    const room = buildInterior(door.to, door.label, door.x + door.w/2, door.y + door.h + 22);
    for (const prop of room.props)
      assert.ok(allArt.has(prop.art), `${door.to}: ${prop.art} has real pixel art`);
  }
  for (const def of AEGEAN_NPCS.filter((n) => n.map !== 'overworld')) {
    const door = world.portals.find((p) => p.to === def.map);
    assert.ok(door, `${def.id}: inhabited room has an actual overworld door`);
    const room = buildInterior(def.map, door.label, door.x + door.w/2, door.y + door.h + 22);
    const free = (tx:number,ty:number): boolean => {
      const x=tx*32+16,y=ty*32+16;
      if (boxHitsTerrain(room,x,y,8,5)) return false;
      return !room.props.some((p) => p.cw && p.ch && x+8>p.x-p.cw/2 && x-8<p.x+p.cw/2 && y+5>p.y-p.ch && y-5<p.y);
    };
    assert.ok(free(def.tx,def.ty),`${def.id}: stands clear of walls and furniture`);
    const start = (room.h-2)*room.w + Math.floor(room.w/2);
    const seen = new Set<number>([start]), queue=[start];
    for (let cursor=0;cursor<queue.length;cursor++) {
      const index=queue[cursor],x=index%room.w,y=Math.floor(index/room.w);
      for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        const next=ny*room.w+nx;
        if(nx<0||ny<0||nx>=room.w||ny>=room.h||seen.has(next)||!free(nx,ny))continue;
        seen.add(next);queue.push(next);
      }
    }
    assert.ok(seen.has(def.ty*room.w+def.tx),`${def.id}: reachable from the room's actual entrance`);
  }
}
console.log(
  `Aegean life:48 distinct residents in8 towns,16 inhabited interiors,valid dialogue/stock/daily schedules,10 composed themes,original soundtrack preserved,7 finite cues and one timer passed${process.argv.includes("--world") ? ", including generated-town paths and house doors" : ""}.`,
);
