/** Compare actual procedural drawing commands to pre-expansion Git art.
 * A recording Canvas2D keeps this check small and browser-free; identical
 * ordered commands, paint state and source surfaces produce identical pixels.
 * Run serially: node scripts/check-legacy-art.mjs
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { posix } from 'node:path';

const BASE = 'd39d75a';
function surface() {
  const hash = createHash('sha256');
  const draws = [];
  const canvas = { width: 0, height: 0, draws, fingerprint: () => hash.copy().digest('hex') };
  const state = { fillStyle: '#000000', globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: false };
  const stack = [];
  const record = (kind, args) => hash.update(JSON.stringify([kind, args, state]));
  const context = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'save') return () => { stack.push({ ...state }); record('save', []); };
      if (key === 'restore') return () => { Object.assign(state, stack.pop()); record('restore', []); };
      if (key === 'drawImage') return (source, ...args) => {
        const draw = { source: source.fingerprint(), width: source.width, height: source.height, args, state: { ...state } };
        draws.push(draw); record('drawImage', draw);
      };
      if (['fillRect', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill'].includes(key))
        return (...args) => record(key, args);
      throw new Error(`Unrecorded Canvas2D operation: ${String(key)}`);
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  canvas.getContext = () => context;
  return canvas;
}
globalThis.document = { createElement: (tag) => { assert.equal(tag, 'canvas'); return surface(); } };
const entry = `export { getTileset } from './src/game/art/tileset.ts'; export { T, TILE_COUNT } from './src/game/world/tiles.ts';`;
async function load(frozen) {
  const result = await build({
    stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true,
    platform: 'node', format: 'esm', write: false, logLevel: 'warning',
    plugins: frozen ? [{ name: 'original-art-source', setup(b) {
      b.onResolve({ filter: /^\./ }, (a) => ({
        path: posix.normalize(posix.join(a.importer ? posix.dirname(a.importer) : '', a.path.endsWith('.ts') ? a.path : `${a.path}.ts`)),
        namespace: 'original',
      }));
      b.onLoad({ filter: /.*/, namespace: 'original' }, (a) => ({
        contents: execFileSync('git', ['show', `${BASE}:${a.path}`], { encoding: 'utf8' }), loader: 'ts',
      }));
    } }] : [],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const original = await load(true), current = await load(false);
const before = original.getTileset(), after = current.getTileset();
for (const [name, id] of Object.entries(original.T)) assert.equal(current.T[name], id, `Saved tile ID changed: ${name}`);
for (const key of ['sheet', 'faces']) {
  const legacyRows = after[key].draws.filter((draw) => draw.args[1] < original.TILE_COUNT * 32);
  assert.deepEqual(legacyRows, before[key].draws, `Original ${key} drawing commands changed`);
}
assert.deepEqual(after.masks.map((mask) => mask.fingerprint()), before.masks.map((mask) => mask.fingerprint()), 'Original terrain transition masks changed');
const newRows = after.sheet.draws.filter((draw) => draw.args[1] >= current.T.THYME_SCRUB * 32);
assert.equal(newRows.length, (current.TILE_COUNT - current.T.THYME_SCRUB) * 4);
assert.equal(new Set(newRows.map((draw) => draw.source)).size, newRows.length, 'Every Greek natural material and variant has authored, non-duplicate drawing commands');
console.log(`Original art parity passed: ${before.sheet.draws.length} tile variants, ${before.faces.draws.length} wall faces and ${before.masks.length} transition masks match Git ${BASE}; ${newRows.length} distinct new Greek material variants.`);
