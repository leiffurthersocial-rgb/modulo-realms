/** Regenerate the immutable west-world fixture from Git, never working-tree code.
 * Run serially: node scripts/record-aegean-legacy-baseline.mjs
 * The revision is deliberately pinned to the pre-Aegean default branch.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
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
const snapshot = { baseCommit, seed, w: map.w, h: map.h, maxContentLevel: 75,
  counts: Object.fromEntries(['props', 'portals', 'spawns', 'chests'].map(k => [k, map[k].length])), sha256 };
writeFileSync('scripts/aegean-legacy-baseline.json', `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Recorded frozen ${baseCommit} world: ${map.w} × ${map.h}, seed ${seed}.`);
