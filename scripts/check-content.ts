/**
 * Cross-checks the data files against each other for references that do not
 * resolve. Every one of these fails silently at runtime — a shop quietly
 * missing a line, a dungeon spawning nothing, a boss that drops no relic —
 * which is exactly the kind of mistake worth a script.
 *
 *   npx tsx scripts/check-content.ts
 */
import { AEGEAN_MAP_IDS } from '../src/data/aegean/world';
import { NPCS } from '../src/data/npcs';
import { ALL_ENEMIES, ENEMY_BY_ID } from '../src/data/enemies';
import { TEMPLATE_BY_ID } from '../src/data/items';
import { LOCATIONS, REGION_BY_ID, type RegionId } from '../src/data/locations';
import { REGION_BOSS_DIFFICULTY, REGION_DIFFICULTY } from '../src/data/balance';

let bad = 0;
const fail = (msg: string) => { console.log('  ' + msg); bad++; };

console.log('shops');
for (const n of NPCS) {
  for (const st of n.shop?.stock ?? []) {
    if (!TEMPLATE_BY_ID[st.item]) fail(`${n.id}: stocks unknown item "${st.item}"`);
  }
}

console.log('enemy drops and boss relics');
for (const e of ALL_ENEMIES) {
  for (const d of e.drops) if (!TEMPLATE_BY_ID[d.item]) fail(`${e.id}: drops unknown item "${d.item}"`);
  const relic = e.boss?.uniqueDrop;
  if (relic && !TEMPLATE_BY_ID[relic]) fail(`${e.id}: unique drop "${relic}" does not exist`);
  for (const a of e.boss?.attacks ?? []) {
    if (a.summon && !ENEMY_BY_ID[a.summon]) fail(`${e.id}: attack "${a.id}" summons unknown "${a.summon}"`);
  }
  for (const ph of e.boss?.phases ?? []) {
    const s = ph.immune?.summon;
    if (s && !ENEMY_BY_ID[s]) fail(`${e.id}: immune phase "${ph.name}" summons unknown "${s}"`);
  }
  if (e.region && REGION_DIFFICULTY[e.region] === undefined) fail(`${e.id}: unknown home region "${e.region}"`);
}

console.log('dungeons');
const mapIds = new Set<string>();
for (const loc of LOCATIONS) {
  if (!REGION_BY_ID[loc.region as RegionId]) fail(`${loc.id}: unknown region "${loc.region}"`);
  const d = loc.dungeon;
  if (!d) continue;
  if (mapIds.has(d.mapId)) fail(`${loc.id}: duplicate dungeon mapId "${d.mapId}"`);
  mapIds.add(d.mapId);
  // Authored Aegean actors belong to the encounter director, not random spawn lists.
  if (!d.enemies.length && !AEGEAN_MAP_IDS.includes(d.mapId)) fail(`${loc.id}: no enemies listed`);
  for (const id of d.enemies) if (!ENEMY_BY_ID[id]) fail(`${loc.id}: unknown enemy "${id}"`);
  if (d.boss && !ENEMY_BY_ID[d.boss]) fail(`${loc.id}: unknown boss "${d.boss}"`);
  if (d.miniboss && !ENEMY_BY_ID[d.miniboss]) fail(`${loc.id}: unknown miniboss "${d.miniboss}"`);
}

console.log('names');
const seen = new Map<string, string>();
for (const loc of LOCATIONS) {
  const prev = seen.get(loc.name);
  if (prev) fail(`"${loc.name}" is the name of both ${prev} and ${loc.id}`);
  seen.set(loc.name, loc.id);
}

console.log('regions');
for (const r of Object.keys(REGION_BY_ID)) {
  if (REGION_DIFFICULTY[r] === undefined) fail(`region "${r}" has no difficulty multiplier`);
  if (REGION_BOSS_DIFFICULTY[r] === undefined) fail(`region "${r}" has no boss difficulty multiplier`);
  if (!LOCATIONS.some((l) => l.region === r)) fail(`region "${r}" has nothing in it`);
}

console.log(bad ? `\n${bad} broken reference(s).` : '\nEvery reference resolves.');

if (bad) process.exitCode = 1;
