/*
 * The browser side of the global leaderboard (server: src/server/leaderboard.ts).
 *
 * Each character gets its own random id and secret token, kept in
 * localStorage next to the save, so the entry follows the character and only
 * this browser can move it. Progress is sent from the autosave, and only when
 * the level or the name changed — a few requests per session at most.
 *
 * Production builds only: the dev server has no /api, and a local test
 * character has no business on the public board. Every failure is silent;
 * the game never waits on the network.
 */
import type { Player } from '../player/player';

const STORE_KEY = 'modulo-realms-online-v1';
const ENDPOINT = '/api/leaderboard';

export interface BoardEntry { rank: number; id: string; name: string; level: number; cls: string; race: string }
export interface BoardMe { rank: number | null; level: number | null; hidden: boolean }
export interface Board { top: BoardEntry[]; total: number; me?: BoardMe }

interface Identity { id: string; token: string; sentLevel: number; sentName: string; refused?: string }
interface Store { optOut?: boolean; characters: Record<string, Identity> }

export const onlineEnabled = (): boolean => typeof window !== 'undefined' && !!import.meta.env?.PROD;

function read(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const s = raw ? JSON.parse(raw) as Store : null;
    if (s && typeof s === 'object' && s.characters) return s;
  } catch { /* storage blocked */ }
  return { characters: {} };
}
function write(s: Store): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}

/** One save slot, so name + race + class is enough to tell this character from the last one. */
const characterKey = (p: Player) => `${p.name}|${p.race}|${p.cls}`;

function token(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function identity(p: Player, create: boolean): Identity | null {
  const s = read();
  const key = characterKey(p);
  if (!s.characters[key] && create) {
    s.characters[key] = { id: crypto.randomUUID(), token: token(), sentLevel: 0, sentName: '' };
    write(s);
  }
  return s.characters[key] ?? null;
}

function update(p: Player, patch: Partial<Identity>): void {
  const s = read();
  const key = characterKey(p);
  if (!s.characters[key]) return;
  s.characters[key] = { ...s.characters[key], ...patch };
  write(s);
}

export function isOptedOut(): boolean { return !!read().optOut; }

let inFlight = false;

/** Called from the autosave. Sends only when there is something new and the server has not refused this character. */
export function syncLeaderboard(p: Player | null | undefined): void {
  if (!onlineEnabled() || !p || inFlight || isOptedOut()) return;
  const me = identity(p, true);
  if (!me || me.refused) return;
  if (me.sentLevel >= p.level && me.sentName === p.name) return;
  inFlight = true;
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'submit', id: me.id, token: me.token, name: p.name, level: p.level, cls: p.cls, race: p.race,
      playTime: Math.floor(p.playTime),
    }),
  })
    .then(async (res) => {
      const body = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (body.ok) update(p, { sentLevel: p.level, sentName: p.name });
      // A refused name, a ban or a foreign entry will not change by retrying every minute.
      else if (body.error === 'name' || body.error === 'banned' || body.error === 'auth') update(p, { refused: body.error });
    })
    .catch(() => { /* offline — the next autosave tries again */ })
    .finally(() => { inFlight = false; });
}

export async function fetchBoard(p?: Player | null, limit = 50): Promise<Board> {
  const me = p ? identity(p, false) : null;
  const q = new URLSearchParams({ limit: String(limit) });
  if (me) q.set('id', me.id);
  const res = await fetch(`${ENDPOINT}?${q}`);
  if (!res.ok) throw new Error(String(res.status));
  return await res.json() as Board;
}

/** The id this browser uses for a character, so the board can mark "you". */
export function myEntryId(p?: Player | null): string | null {
  return p ? identity(p, false)?.id ?? null : null;
}

export function refusedReason(p?: Player | null): string | null {
  return p ? identity(p, false)?.refused ?? null : null;
}

export async function report(target: string): Promise<void> {
  await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'report', target }) });
}

/** Off the board and stay off: deletes every entry this browser made and stops sending. */
export async function optOut(): Promise<void> {
  const s = read();
  s.optOut = true;
  write(s);
  await Promise.all(Object.values(s.characters).map((c) =>
    fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', id: c.id, token: c.token }) })
      .catch(() => undefined)));
}

export function optIn(p?: Player | null): void {
  const s = read();
  s.optOut = false;
  // Removed on the server, so everything has to be sent again.
  for (const c of Object.values(s.characters)) c.sentLevel = 0;
  write(s);
  syncLeaderboard(p);
}
