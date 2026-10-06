/*
 * Player names: what characters are allowed, and the slur / profanity filter.
 *
 * Shared by character creation (instant feedback) and the leaderboard API
 * (`src/server/leaderboard.ts`), which is the one that actually enforces it —
 * a client check can always be skipped.
 *
 * Evasion this undoes before matching: case, accents (ü → u), look-alike
 * Cyrillic/Greek letters, leetspeak (n1gg3r, @ss), separators (f.u.c.k,
 * n i g), CamelCase, and stretched letters (niiigger). Better safe than
 * sorry: a HARD term inside an innocent name blocks it too, unless the term
 * lists that word as an exception.
 */
import { HARD_TERMS, SOFT_TERMS } from '../../data/nameBlocklist';

export const NAME_MIN = 3;
export const NAME_MAX = 16;
const NAME_CHARS = /^[A-Za-z0-9 _-]+$/;

const CONFUSABLE: Record<string, string> = {
  'а': 'a', 'в': 'b', 'е': 'e', 'ё': 'e', 'з': '3', 'і': 'i', 'ї': 'i', 'ј': 'j', 'к': 'k', 'м': 'm', 'н': 'h',
  'о': 'o', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'х': 'x', 'ѕ': 's', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w', 'ɡ': 'g',
  'α': 'a', 'β': 'b', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k', 'μ': 'u', 'ν': 'v', 'ο': 'o', 'ρ': 'p', 'τ': 't',
  'υ': 'u', 'χ': 'x', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ð': 'd', 'þ': 'th', 'ł': 'l', 'đ': 'd', 'ı': 'i',
};
const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't',
  '8': 'b', '9': 'g', '6': 'g', '€': 'e', '¢': 'c',
};

/** Lower case, accents off, look-alikes mapped; CamelCase split into words first. */
function fold(raw: string): string {
  const split = raw.replace(/([a-z])([A-Z])/g, '$1 $2');
  return [...split.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()].map((c) => CONFUSABLE[c] ?? c).join('');
}

/** The readings of one folded name a filter has to try: 1 as i or l, q as g, ph as f. */
function readings(folded: string): string[] {
  const leet = (s: string, one: string) => [...s].map((c) => (c === '1' ? one : LEET[c] ?? c)).join('');
  const base = leet(folded, 'i');
  const out = new Set([base, leet(folded, 'l'), base.replace(/q/g, 'g').replace(/ph/g, 'f')]);
  return [...out];
}

const letters = (s: string) => s.replace(/[^a-z]/g, '');
/** "gg" → "g+g+": a term matches however far each letter is stretched, but never with fewer. */
const stretch = (term: string) => [...term].map((c) => `${c}+`).join('');
/** A term as the filter stores it: letters only, digits read as leetspeak ("1488" → "iabb"). */
const termKey = (t: string) => letters(readings(fold(t))[0]);

interface HardWithExceptions { re: RegExp; except: RegExp[] }

const hardPlain: string[] = [];
const hardExcepted: HardWithExceptions[] = [];
const wordTerms: string[] = [];
for (const [term, exceptions] of HARD_TERMS) {
  const key = termKey(term);
  if (!key) continue;
  // Three letters are too few to search inside other words ("fag" in "Fagan").
  if (key.length < 4) { wordTerms.push(key); continue; }
  if (exceptions?.length) {
    hardExcepted.push({
      re: new RegExp(stretch(key), 'g'),
      except: exceptions.map(termKey).filter(Boolean).map((x) => new RegExp(stretch(x), 'g')),
    });
  } else hardPlain.push(key);
}
for (const term of SOFT_TERMS) {
  const key = termKey(term);
  if (key) wordTerms.push(key);
}
const HARD_RE = new RegExp(hardPlain.map(stretch).join('|'));
/** Whole words, a plural s allowed. */
const WORD_RE = new RegExp(`^(?:${[...new Set(wordTerms)].map(stretch).join('|')})s?$`);

function ranges(re: RegExp, s: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  re.lastIndex = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    out.push([m.index, m.index + m[0].length]);
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

function hardHit(joined: string): boolean {
  if (HARD_RE.test(joined)) return true;
  for (const { re, except } of hardExcepted) {
    const hits = ranges(re, joined);
    if (!hits.length) continue;
    const covers = except.flatMap((x) => ranges(x, joined));
    if (hits.some(([a, b]) => !covers.some(([xa, xb]) => xa <= a && xb >= b))) return true;
  }
  return false;
}

/** True when a name contains a slur, profanity, hate term or reserved staff word. */
export function isNameBlocked(raw: string): boolean {
  const folded = fold(raw);
  // Words as typed ("Ass69" → "ass") and words after leetspeak ("@ss" → "ass").
  const words = new Set(folded.split(/[^a-z]+/).filter(Boolean));
  for (const r of readings(folded)) {
    const joined = letters(r);
    if (!joined) continue;
    if (hardHit(joined)) return true;
    words.add(joined);
    for (const w of r.split(/[^a-z]+/)) if (w) words.add(w);
  }
  for (const w of words) if (WORD_RE.test(w)) return true;
  return false;
}

/** The form two names share when they only differ in spelling tricks; used for bans. */
export function canonicalName(raw: string): string {
  return letters(readings(fold(raw))[0]);
}

export type NameCheck =
  | { ok: true; name: string }
  | { ok: false; reason: 'short' | 'long' | 'chars' | 'blocked'; message: string };

/** The full rule set for a new name: tidy whitespace, length, allowed characters, filter. */
export function checkName(raw: string): NameCheck {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < NAME_MIN) return { ok: false, reason: 'short', message: `At least ${NAME_MIN} characters.` };
  if (name.length > NAME_MAX) return { ok: false, reason: 'long', message: `At most ${NAME_MAX} characters.` };
  if (!NAME_CHARS.test(name) || !/[A-Za-z]/.test(name)) {
    return { ok: false, reason: 'chars', message: 'Letters, numbers, space, - and _ only.' };
  }
  if (isNameBlocked(name)) return { ok: false, reason: 'blocked', message: 'That name is not allowed.' };
  return { ok: true, name };
}
