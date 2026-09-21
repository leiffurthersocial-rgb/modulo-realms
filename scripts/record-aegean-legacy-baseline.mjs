/** Regenerate the immutable west-world fixture from Git, never working-tree code.
 * Run serially: node scripts/record-aegean-legacy-baseline.mjs
 * The revision is deliberately pinned to the pre-Aegean default branch.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';

const baseCommit = 'd39d75a';
const result = await build({
  stdin: { contents: 'export { generateOverworld } from "./src/game/world/worldgen.ts";', resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'frozen-git-world', setup(b) {
    b.onResolve({ filter: /^\./ }, a => ({
      path: posix.normalize(posix.join(a.importer ? posix.dirname(a.importer) : '', a.path.endsWith('.ts') ? a.path : `${a.path}.ts`)),
      namespace: 'baseline',
    }));
    b.onLoad({ filter: /.*/, namespace: 'baseline' }, a => ({
      contents: execFileSync('git', ['show', `${baseCommit}:${a.path}`], { encoding: 'utf8' }), loader: 'ts',
    }));
  } }],
});
const { generateOverworld } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const noop = () => undefined;
const context = new Proxy({}, { get: (_target, key) => key === 'createLinearGradient' || key === 'createRadialGradient'
  ? () => ({ addColorStop: noop }) : key === 'measureText' ? () => ({ width: 0 }) : noop, set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
const seed = 1337, map = generateOverworld(seed), sha256 = {};
for (const key of ['tiles', 'regions', 'props', 'portals', 'spawns', 'chests']) {
  const bytes = key === 'tiles' || key === 'regions' ? map[key] : JSON.stringify(map[key]);
  sha256[key] = createHash('sha256').update(bytes).digest('hex');
}
// The working tree's own west world, for the documented-changes record. The
// frozen hashes above answer "has the Aegean work disturbed the old world?".
// This second set answers "is the old world still exactly what we last agreed
// it should be?", which is a different question once the owner has asked for
// a deliberate change to a town.
const { generateLegacyOverworld } = await import('../src/game/world/worldgen.ts')
  .catch(async () => {
    const r = await build({ entryPoints: ['src/game/world/worldgen.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
    return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
  });
const current = generateLegacyOverworld(seed);
const sha256After = {};
for (const key of ['tiles', 'regions', 'props', 'portals', 'spawns', 'chests']) {
  const bytes = key === 'tiles' || key === 'regions' ? current[key] : JSON.stringify(current[key]);
  sha256After[key] = createHash('sha256').update(bytes).digest('hex');
}
const changed = Object.keys(sha256).filter((k) => sha256[k] !== sha256After[k]);

const existing = JSON.parse(readFileSync('scripts/aegean-legacy-baseline.json', 'utf8'));
const snapshot = { baseCommit, seed, w: map.w, h: map.h, maxContentLevel: 75,
  counts: Object.fromEntries(['props', 'portals', 'spawns', 'chests'].map(k => [k, map[k].length])), sha256,
  documentedChanges: {
    note: existing.documentedChanges?.note
      ?? 'Deliberate post-d39d75a edits to the original west world, approved by the owner.',
    changes: existing.documentedChanges?.changes ?? [],
    counts: Object.fromEntries(['props', 'portals', 'spawns', 'chests'].map(k => [k, current[k].length])),
    sha256After,
  } };
writeFileSync('scripts/aegean-legacy-baseline.json', `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Recorded frozen ${baseCommit} world: ${map.w} × ${map.h}, seed ${seed}.`);
console.log(changed.length
  ? `Working tree differs from the frozen world in: ${changed.join(', ')}.`
  : 'Working tree matches the frozen world exactly.');
