#!/usr/bin/env node
/*
 * Turns a raw clip from record.mjs into a post-ready short: 1080x1920 H.264,
 * pixel-doubled with nearest-neighbour (the art stays crisp), a hook line in
 * the game's own font at the start, a small title, an end card with where to
 * play, and loudness normalised to -14 LUFS.
 *
 *   node marketing/edit.mjs <in.webm> <out.mp4> --hook "TEXT" [--sub "TEXT"] [--start 1] [--dur 15]
 *
 * Captions may contain "\n" for line breaks.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [input, output] = process.argv.slice(2);
const opt = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
if (!input || !output) { console.error('usage: node marketing/edit.mjs <in.webm> <out.mp4> --hook "TEXT" [--sub "TEXT"] [--start 1] [--dur 15]'); process.exit(1); }
const hook = opt('hook', '').replace(/\\n/g, '\n');
const sub = opt('sub', '').replace(/\\n/g, '\n');
const start = Number(opt('start', '1'));
const dur = Number(opt('dur', '15'));
const url = opt('url', 'modulo-realms-one.vercel.app');

const cache = join(here, '.cache');
mkdirSync(cache, { recursive: true });
if (!existsSync(join(cache, 'Modulo-Bold.ttf'))) {
  const r = spawnSync(process.execPath, [join(here, 'export-font.mjs'), cache], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(1);
}
const text = (name, value) => { const f = join(cache, `${name}.txt`); writeFileSync(f, value); return f; };
const font = join(cache, 'Modulo-Bold.ttf');
const small = join(cache, 'Modulo.ttf');
const endAt = dur - 2.8;

// drawtext with a hard 1-px-style outline (borderw) and no soft shadow: it is pixel art.
const draw = (file, size, y, from, to, color = '#f4d58d', border = 6) =>
  `drawtext=fontfile=${font}:textfile=${file}:fontsize=${size}:fontcolor=${color}:borderw=${border}:bordercolor=#0d0b12:` +
  `line_spacing=${Math.round(size / 3)}:x=(w-text_w)/2:y=${y}:enable='between(t,${from},${to})'`;

const filters = [
  'crop=540:960:(in_w-540)/2:0',
  'scale=1080:1920:flags=neighbor',
  'fps=30',
  // small title, always
  `drawtext=fontfile=${small}:textfile=${text('title', 'MODULO: REALMS OF ASH')}:fontsize=36:fontcolor=#e7c778:borderw=4:bordercolor=#0d0b12:x=(w-text_w)/2:y=120`,
  hook ? draw(text('hook', hook), 78, 300, 0, Math.min(4.5, endAt)) : null,
  sub ? draw(text('sub', sub), 56, 1500, 1.5, endAt, '#ffffff', 5) : null,
  // end card
  `drawbox=x=0:y=0:w=iw:h=ih:color=#0d0b12@0.72:t=fill:enable='gte(t,${endAt})'`,
  draw(text('end1', 'Play free\nin your browser'), 86, 700, endAt, dur),
  draw(text('end2', url), 46, 1000, endAt, dur, '#ffffff', 4),
  draw(text('end3', 'link in bio'), 40, 1100, endAt, dur, '#a39578', 4),
  `fade=t=in:st=0:d=0.3`,
].filter(Boolean).join(',');

const args = [
  '-v', 'error', '-y', '-ss', String(start), '-t', String(dur), '-i', input,
  '-vf', filters,
  '-af', `loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.3,afade=t=out:st=${dur - 0.6}:d=0.6`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', output,
];
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`edited → ${output}`);
