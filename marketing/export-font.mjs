#!/usr/bin/env node
/*
 * Writes the game's own pixel fonts (built from code at runtime, see
 * src/ui/kit/font.ts) as TTF files, so video captions use the same face.
 *
 *   node marketing/export-font.mjs <dir>     → <dir>/Modulo.ttf, Modulo-Bold.ttf, ModuloSmall.ttf
 */
import { buildSync } from 'esbuild';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = process.argv[2];
if (!dir) { console.error('usage: node marketing/export-font.mjs <dir>'); process.exit(1); }
const tmp = mkdtempSync(join(tmpdir(), 'modulo-font-'));
const bundle = join(tmp, 'font.mjs');
buildSync({ entryPoints: [join(root, 'src/ui/kit/font.ts')], bundle: true, platform: 'node', format: 'esm', outfile: bundle, logLevel: 'warning' });
const { buildFonts } = await import(pathToFileURL(bundle).href);
mkdirSync(dir, { recursive: true });
const names = ['Modulo.ttf', 'Modulo-Bold.ttf', 'ModuloSmall.ttf'];
buildFonts().forEach((f, i) => writeFileSync(join(dir, names[i]), Buffer.from(f.data)));
rmSync(tmp, { recursive: true, force: true });
console.log(`fonts → ${dir}`);
