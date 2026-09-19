/** Regression check for Ashvale residents walking toward pre-expansion coordinates.
 * Run with: npx tsx scripts/check-npc-schedules.ts
 */
import assert from 'node:assert/strict';
import { NPCS } from '../src/data/npcs';
import { LOCATION_BY_ID, VILLAGE_TX, VILLAGE_TY, WORLD_W, WORLD_H } from '../src/data/locations';
import { NpcEntity } from '../src/game/entities/npcEntity';
import { createMap } from '../src/game/world/map';
import { ASHVALE_BUILDINGS } from '../src/game/world/village';
import { TILE, T } from '../src/game/world/tiles';

const residents = NPCS.filter((n) => n.map === 'overworld' && n.tx < 960 && n.schedule?.length);
assert.equal(residents.length, 5, 'Exercise all five scheduled Ashvale residents');
const inn = ASHVALE_BUILDINGS.find((b) => b.id === 'inn')!;
const map = createMap({ id: 'schedule-test', name: 'Open ground', w: WORLD_W, h: WORLD_H });
map.tiles.fill(T.GRASS);

// Keep idle wandering deterministic without replacing the real movement code.
const random = Math.random;
let seed = 12345;
Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000);
try {
  for (const def of residents) {
    for (const leg of def.schedule!) {
      assert.ok(Math.hypot(leg.tx - VILLAGE_TX, leg.ty - VILLAGE_TY) <= LOCATION_BY_ID.ashvale.radius!,
        `${def.id}: ${leg.label} destination must stay inside Ashvale`);
    }

    const npc = new NpcEntity(def);
    const home = def.id === 'smith_corin'
      ? { tx: VILLAGE_TX - 14, ty: VILLAGE_TY - 3 }
      : def;
    const stages = [
      { hour: 7, label: 'working', spot: def },
      { hour: 8, label: 'working', spot: def },
      { hour: 17.99, label: 'working', spot: def },
      { hour: 18, label: 'at the tavern', spot: { tx: inn.tx, ty: inn.ty + 2 } },
      { hour: 21.99, label: 'at the tavern', spot: { tx: inn.tx, ty: inn.ty + 2 } },
      { hour: 22, label: 'at home', spot: home },
      { hour: 0, label: 'at home', spot: home },
      { hour: 6.99, label: 'at home', spot: home },
      { hour: 7, label: 'working', spot: def },
    ];
    for (const { hour, label, spot } of stages) {
      npc.updateSchedule(hour);
      assert.equal(npc.scheduleLabel, label, `${def.id} at ${hour}: activity`);
      assert.equal(npc.anchorX, spot.tx * TILE + TILE / 2, `${def.id} at ${hour}: destination x`);
      assert.equal(npc.anchorY, spot.ty * TILE + TILE / 2, `${def.id} at ${hour}: destination y`);
      for (let frame = 0; frame < 60 * 60; frame++) {
        npc.update(1 / 60, map, VILLAGE_TX * TILE, VILLAGE_TY * TILE);
        assert.ok(Math.hypot(npc.x / TILE - 0.5 - VILLAGE_TX, npc.y / TILE - 0.5 - VILLAGE_TY)
          <= LOCATION_BY_ID.ashvale.radius!, `${def.id} at ${hour}: must not walk out of town`);
      }
      assert.ok(Math.hypot(npc.x - npc.anchorX, npc.y - npc.anchorY) <= Math.max(40, def.wander ?? 0) + 1,
        `${def.id} at ${hour}: reaches the destination and wanders nearby`);
    }
  }
} finally {
  Math.random = random;
}

console.log('All five Ashvale residents stay in town through work, tavern, home and the next morning.');
