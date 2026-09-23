/**
 * The UI's house rules, checked.
 *
 * The interface is pixel art laid out in whole UI pixels (see the header of
 * `src/styles/global.css`). Every one of these was a way the old stylesheet
 * read as a web page instead of part of the game, so this fails on:
 *
 *  - border-radius, backdrop-filter, blur(), and CSS gradients (the world
 *    vignette on `.game-root::after` is lighting, not UI, and is exempt);
 *  - soft shadows: any box-/text-shadow with a blur radius;
 *  - fractional pixel lengths, font sizes other than 10/20/40px, and
 *    font-family values other than the two generated faces;
 *  - raw hex colours in the stylesheet (colours come from `--c-*` tokens);
 *  - the same in the UI components' inline styles;
 *  - any character the UI can print that the pixel font has no glyph for.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MODULO } from '../src/ui/kit/glyphs';

const root = process.cwd();
const fail: string[] = [];

/* ---------------- stylesheet ---------------- */

const cssPath = join(root, 'src/styles/global.css');
const css = readFileSync(cssPath, 'utf8')
  // comments are prose, not rules
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

// the one block allowed a gradient: world lighting under the UI
const vignette = /\.game-root::after\s*\{[\s\S]*?\}/.exec(css);
const exemptFrom = vignette ? vignette.index : -1;
const exemptTo = vignette ? vignette.index + vignette[0].length : -1;

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

function scan(text: string, file: string, rules: Array<[RegExp, string]>, exempt?: [number, number]) {
  for (const [re, why] of rules) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = g.exec(text))) {
      if (exempt && m.index >= exempt[0] && m.index < exempt[1]) continue;
      fail.push(`${file}:${lineOf(text, m.index)}  ${why}: ${m[0].trim().slice(0, 60)}`);
    }
  }
}

scan(css, 'global.css', [
  [/border-radius\s*:/, 'border-radius'],
  [/backdrop-filter\s*:/, 'backdrop-filter'],
  [/blur\(/, 'blur'],
  [/(linear|radial|conic)-gradient\(/, 'gradient'],
  [/drop-shadow\(/, 'drop-shadow filter'],
  [/(box|text)-shadow\s*:[^;]*?-?\d+px\s+-?\d+px\s+[1-9]\d*px/, 'soft shadow'],
  [/\d+\.\d+px/, 'fractional pixel length'],
  [/#[0-9a-fA-F]{3,8}\b/, 'raw hex colour (use a --c-* token)'],
], [exemptFrom, exemptTo]);

for (const m of css.matchAll(/font-family\s*:\s*([^;]+);/g)) {
  if (!/^(var\(--font(-small)?\)|inherit)$/.test(m[1].trim())) fail.push(`global.css:${lineOf(css, m.index!)}  font-family outside the pixel faces: ${m[1].trim()}`);
}

for (const m of css.matchAll(/font-size\s*:\s*([^;]+);/g)) {
  const v = m[1].trim();
  if (!/^(10|20|40)px$/.test(v)) fail.push(`global.css:${lineOf(css, m.index!)}  font-size must be 10, 20 or 40px: ${v}`);
}

/* ---------------- component inline styles ---------------- */

const uiDir = join(root, 'src/ui');
const tsx = (readdirSync(uiDir, { recursive: true }) as string[])
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => join(uiDir, f));

for (const file of tsx) {
  const text = readFileSync(file, 'utf8');
  const name = file.slice(root.length + 1);
  const rules: Array<[RegExp, string]> = [
    [/borderRadius\s*:/, 'borderRadius'],
    [/boxShadow\s*:\s*[`'"][^`'"]*\d+px\s+\d+px\s+[1-9]/, 'soft boxShadow'],
    [/textShadow\s*:/, 'textShadow'],
    [/fontFamily\s*:/, 'fontFamily'],
    [/fontSize\s*:/, 'fontSize'],
    [/(linear|radial)-gradient\(/, 'gradient'],
    [/drop-shadow\(/, 'drop-shadow filter'],
    [/window\.confirm\(/, 'browser confirm() (use ConfirmButton)'],
  ];
  scan(text, name, rules);
}

/* ---------------- glyph coverage ---------------- */

// Every character that can reach the screen: string literals in the UI and
// the data files the UI prints from.
const sources = [
  ...tsx,
  ...readdirSync(join(root, 'src/data')).filter((f) => f.endsWith('.ts')).map((f) => join(root, 'src/data', f)),
  ...readdirSync(join(root, 'src/data/aegean')).filter((f) => f.endsWith('.ts')).map((f) => join(root, 'src/data/aegean', f)),
];
const missing = new Map<string, string>();
for (const file of sources) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/'([^'\\\n]|\\.)*'|"([^"\\\n]|\\.)*"|`([^`\\]|\\.)*`|>([^<>{}\n]+)</g)) {
    for (const ch of m[0]) {
      const code = ch.codePointAt(0)!;
      if (code < 0x20 || ch === '\n') continue;
      if (MODULO[ch] || MODULO[ch.toUpperCase()]) continue;
      if (!missing.has(ch)) missing.set(ch, file.slice(root.length + 1));
    }
  }
}
for (const [ch, file] of missing) {
  fail.push(`glyph missing for ${JSON.stringify(ch)} (U+${ch.codePointAt(0)!.toString(16).padStart(4, '0')}), first seen in ${file}`);
}

if (fail.length) {
  console.error(`UI style check: ${fail.length} problem(s)`);
  for (const f of fail) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`UI style check passed: stylesheet, ${tsx.length} components, ${Object.keys(MODULO).length} glyphs.`);
