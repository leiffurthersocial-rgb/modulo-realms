#!/usr/bin/env node
/*
 * Regenerates src/data/nameBlocklist.ts from public word lists.
 *
 *   node scripts/build-name-blocklist.mjs <dir>
 *
 * <dir> holds the raw downloads, never checked in:
 *   ldnoobw_<lang>.txt  https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words (CC BY 4.0)
 *   dsojevic.json       https://github.com/dsojevic/profanity-list en.json (MIT)
 *
 * Two strengths come out of it. HARD terms are searched for anywhere inside a
 * name, letters run together, so "xXn1gg3rXx" and "f.u.c.k" are caught; a
 * term's listed exceptions ("raccoon" for "coon") are let through. SOFT terms
 * only block a whole word, because as a substring they hit ordinary names
 * ("ass" in "Cassandra"). The curated lists below are ours and always HARD.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/build-name-blocklist.mjs <dir with downloaded lists>'); process.exit(1); }

/** Slurs and hate terms the public lists miss or only list as whole words: German, Swiss, French, Italian, extremism. */
const CURATED_HARD = [
  // German / Swiss German
  'neger', 'negerin', 'negerkuss', 'kanake', 'kanacke', 'kanaken', 'zigeuner', 'zigeunerin', 'judensau', 'saujude',
  'drecksjude', 'judenschwein', 'judenpack', 'schwuchtel', 'kampflesbe', 'transe', 'tschusch', 'kaffer', 'hottentotte',
  'mongo', 'spast', 'spasti', 'spacko', 'behindi', 'hurensohn', 'hurenkind', 'fotze', 'wichser', 'missgeburt',
  'kinderficker', 'kinderschaender', 'kinderschander', 'untermensch', 'rassenschande', 'herrenrasse', 'judenfrei',
  // extremism
  'hitler', 'heilhitler', 'siegheil', 'nazi', 'neonazi', 'fuehrer', 'fuhrer', 'reichsfuhrer', 'gaskammer',
  'auschwitz', 'holocaust', 'kukluxklan', 'whitepower', 'whitepride', 'whitegenocide', 'wpww', '1488', '14words',
  'fourteenwords', 'gasthejews', 'killalljews', 'killjews', 'jewkiller', 'isis', 'alqaida', 'alqaeda', 'jihadi',
  'terrorist', 'schoolshooter', 'columbine',
  // English additions
  'fvck', 'phuck', 'fuk', 'nigga', 'nigger', 'niglet', 'negroid', 'jigaboo', 'porchmonkey', 'junglebunny', 'retard', 'faggot', 'tranny',
  'rapist', 'raping', 'molester', 'pedophile', 'paedophile', 'pedophil', 'paedo', 'pedo', 'childporn', 'kiddieporn',
  'lolicon', 'incest',
  // French / Italian / Spanish
  'negre', 'negresse', 'bougnoule', 'youpin', 'pede', 'tapette', 'frocio', 'ricchione', 'finocchio', 'negraccio',
  'maricon', 'mariconazo', 'sudaca', 'panchito',
];

/** Exceptions for HARD terms (curated or downloaded) that would otherwise eat ordinary words. */
const EXCEPTIONS = {
  rape: ['grape', 'drape', 'drapery', 'scrape', 'trapeze', 'rapeseed', 'crape'],
  rapist: ['therapist'],
  coon: ['cocoon'],
  pedo: ['torpedo', 'pedometer', 'speedo', 'pedology', 'pedosphere', 'impedo'],
  pede: ['centipede', 'millipede', 'impede', 'stampede', 'velocipede', 'pedestal', 'pedestrian', 'expede'],
  spast: ['spastic'],
  mongo: ['mongoose', 'mongol'],
  isis: ['crisis'],
  transe: ['transept'],
  nazi: ['nazir', 'nazim', 'nazish'],
  retard: ['retardant'],
};

/** Words the dsojevic list tags as LGBTQ that are self-descriptions, not slurs. Kept, but only as SOFT. */
const IDENTITY_NOT_SLUR = new Set(['enby', 'cishet', 'transbian', 't-girl', 'tgirl', 'switch hitter', 'bicon', 'gym bunny', 'gymbunny', 'muscle mary']);

/** Downloaded SOFT words that are ordinary names or gamer tags here ("xX Ash Xx", the name pool's Balen). */
const SOFT_ALLOW = new Set(['xx', 'balen', 'anita', 'mona', 'regina', 'pippa', 'del', 'dell', 'con', 'rosette']);

/** Staff impersonation and system words; SOFT (whole word). */
const RESERVED = ['admin', 'administrator', 'moderator', 'mod', 'gm', 'gamemaster', 'staff', 'support', 'official', 'system', 'server', 'developer', 'dev'];

/** Lower case, wildcard marks off, accents folded to ASCII (names are ASCII; the UI font has no glyphs for the rest). */
const clean = (s) => s.toLowerCase().replace(/\*/g, '').normalize('NFKD').replace(/\p{M}/gu, '')
  .replace(/ß/g, 'ss').replace(/[^\x20-\x7e]/g, '').trim();

const hard = new Map(); // term -> Set(exceptions)
const soft = new Set();
const addHard = (term, exceptions = []) => {
  const t = clean(term);
  if (!t) return;
  const set = hard.get(t) ?? new Set();
  for (const x of exceptions) set.add(clean(x));
  hard.set(t, set);
};

const dsojevic = JSON.parse(readFileSync(join(dir, 'dsojevic.json'), 'utf8'));
for (const e of dsojevic) {
  const variants = e.match.split('|');
  const tags = new Set(e.tags);
  const slur = tags.has('racial') || tags.has('lgbtq') || tags.has('religious');
  for (const raw of variants) {
    const v = clean(raw);
    const letters = v.replace(/[^a-z0-9]/g, '');
    const isHard = !IDENTITY_NOT_SLUR.has(v) && (
      e.severity >= 4
      || (slur && e.severity >= 2)
      || (tags.has('general') && e.severity >= 2)
      || (tags.has('sexual') && e.severity >= 3 && letters.length >= 5)
    );
    if (isHard) {
      // An exception like "rac*" stands for the matched word with letters around it.
      addHard(v, (e.exceptions ?? []).map((x) => x.replace(/\*/g, v)));
    } else soft.add(v);
  }
}
for (const t of CURATED_HARD) addHard(t);
for (const [t, xs] of Object.entries(EXCEPTIONS)) if (hard.has(t)) addHard(t, xs);

const langs = [];
for (const f of readdirSync(dir).sort()) {
  const m = /^ldnoobw_([a-z]+)\.txt$/.exec(f);
  if (!m) continue;
  langs.push(m[1]);
  for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
    const t = clean(line);
    if (t && !hard.has(t)) soft.add(t);
  }
}
for (const t of RESERVED) soft.add(t);
for (const t of hard.keys()) soft.delete(t);
for (const t of SOFT_ALLOW) soft.delete(t);

const hardRows = [...hard.entries()].sort(([a], [b]) => a.localeCompare(b))
  .map(([t, xs]) => xs.size ? `  [${JSON.stringify(t)}, ${JSON.stringify([...xs].sort())}],` : `  [${JSON.stringify(t)}],`);
const softRows = [...soft].sort();

const out = `/*
 * Names a player may not use. GENERATED by scripts/build-name-blocklist.mjs — edit the
 * script (or rerun it on fresh downloads), not this file.
 *
 * Sources: LDNOOBW List of Dirty, Naughty, Obscene and Otherwise Bad Words
 * (CC BY 4.0; languages: ${langs.join(', ')}), dsojevic/profanity-list (MIT), plus a
 * curated German/Swiss/extremism list kept in the script.
 *
 * HARD: blocked anywhere inside the name, letters run together; [term, exceptions].
 * SOFT: blocked as a whole word only.
 */

export const HARD_TERMS: ReadonlyArray<readonly [string, ReadonlyArray<string>?]> = [
${hardRows.join('\n')}
];

export const SOFT_TERMS: ReadonlyArray<string> = ${JSON.stringify(softRows)};
`;
writeFileSync(new URL('../src/data/nameBlocklist.ts', import.meta.url), out);
console.log(`hard ${hard.size}, soft ${soft.size}, languages ${langs.join(',')}`);
