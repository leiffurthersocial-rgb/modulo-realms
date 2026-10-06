/*
 * The global leaderboard: one entry per character, ranked by level, ties
 * going to whoever got there first. Runs as a Vercel Function
 * (`api/leaderboard.js`, bundled from `leaderboardRoute.ts` by
 * `scripts/build-api.mjs`); storage is any Redis that speaks the commands
 * below — Upstash over REST in production, an in-memory one in the check.
 *
 * Nothing here can make a browser game cheat-proof: the save lives in the
 * player's localStorage. What it does:
 *  - the name filter runs here, where it cannot be skipped;
 *  - an entry can only be changed by the browser that created it (a secret
 *    token, stored hashed);
 *  - play time has to be plausible for the level, and cannot grow faster
 *    than the wall clock between two submissions;
 *  - rate limits per IP, reports that hide an entry after three different
 *    reporters, and admin ban/restore by an ADMIN token.
 * IPs are only ever stored as salted hashes, and only for limits and reports.
 */
import { canonicalName, checkName } from '../game/names/nameFilter';

export type Cmd = Array<string | number>;
export interface Redis { exec(commands: Cmd[]): Promise<unknown[]> }

export interface LeaderboardEnv {
  redis: Redis;
  /** Unlocks ban / restore / reports. Empty disables the admin actions. */
  adminToken: string;
  /** Salt for IP hashes. */
  salt: string;
  now(): number;
}

export const MAX_LEVEL = 100; // MAX_CONTENT_LEVEL in data/balance.ts
export const TOP_DEFAULT = 50;
export const TOP_MAX = 100;
const REPORTS_TO_HIDE = 3;
const SUBMITS_PER_MINUTE = 20;
const REPORTS_PER_HOUR = 10;
/** Minutes are counted from here so "reached first" fits under the level in one score. */
const EPOCH = Date.UTC(2026, 0, 1);

/**
 * The least play time, in seconds, a character of this level can honestly
 * have. Deliberately generous (level 75 ≈ 3.5 h, 100 ≈ 5.5 h): pacing has
 * never been measured on a real playthrough, and a false "cheater" on an
 * honest fast player is worse than a missed one.
 */
export function minPlaySeconds(level: number): number {
  return Math.round(20 * Math.pow(Math.max(0, level - 1), 1.5));
}

const K = {
  board: 'lb:board',
  player: (id: string) => `lb:p:${id}`,
  banned: 'lb:banned',
  bannedNames: 'lb:banned-names',
  hidden: 'lb:hidden',
  reports: (id: string) => `lb:rep:${id}`,
  rate: (what: string, ip: string, window: number) => `lb:rl:${what}:${ip}:${window}`,
  stats: (kind: string, day: string) => `stats:${kind}:${day}`,
};

/** Where players come from: counted per source and day, nothing else. */
const STAT_KINDS = ['visit', 'start'] as const;
const SOURCE_RE = /^[a-z0-9_-]{1,24}$/;
const STATS_KEEP_SECONDS = 400 * 86400;
const VISITS_PER_MINUTE = 30;
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;
const SLUG_RE = /^[a-z_]{2,24}$/;

export interface BoardRow { rank: number; id: string; name: string; level: number; cls: string; race: string }

async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200, cache = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  });
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') ?? 'unknown').trim();
}

/** Counts a hit in this window; true while under the limit. */
async function underLimit(env: LeaderboardEnv, what: string, ipHash: string, limit: number, seconds: number): Promise<boolean> {
  const window = Math.floor(env.now() / 1000 / seconds);
  const key = K.rate(what, ipHash, window);
  const [count] = await env.redis.exec([['INCR', key], ['EXPIRE', key, seconds * 2]]);
  return Number(count) <= limit;
}

function score(level: number, reachedAt: number): number {
  const minutes = Math.max(0, Math.floor((reachedAt - EPOCH) / 60000));
  return level * 1e9 + (1e9 - 1 - Math.min(minutes, 1e9 - 1));
}

function hashToRecord(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (let i = 0; i + 1 < raw.length; i += 2) out[String(raw[i])] = String(raw[i + 1]);
    return out;
  }
  return raw as Record<string, string>;
}

export async function top(env: LeaderboardEnv, limit: number): Promise<BoardRow[]> {
  const [ids] = await env.redis.exec([['ZREVRANGE', K.board, 0, limit - 1]]);
  const list = (ids as string[] | null) ?? [];
  if (!list.length) return [];
  const rows = await env.redis.exec(list.map((id) => ['HMGET', K.player(id), 'name', 'level', 'cls', 'race']));
  return list.map((id, i) => {
    const [name, level, cls, race] = (rows[i] as Array<string | null>) ?? [];
    return { rank: i + 1, id, name: name ?? '?', level: Number(level ?? 0), cls: cls ?? '', race: race ?? '' };
  });
}

async function handleGet(req: Request, env: LeaderboardEnv): Promise<Response> {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(TOP_MAX, Number(url.searchParams.get('limit')) || TOP_DEFAULT));
  const id = url.searchParams.get('id') ?? '';
  const rows = await top(env, limit);
  const [total] = await env.redis.exec([['ZCARD', K.board]]);
  const body: Record<string, unknown> = { top: rows, total: Number(total ?? 0) };
  if (ID_RE.test(id)) {
    const [rank, level, hidden] = await env.redis.exec([
      ['ZREVRANK', K.board, id], ['HGET', K.player(id), 'level'], ['SISMEMBER', K.hidden, id],
    ]);
    body.me = rank === null || rank === undefined
      ? { rank: null, level: level ? Number(level) : null, hidden: Number(hidden) === 1 }
      : { rank: Number(rank) + 1, level: Number(level), hidden: false };
    return json(body);
  }
  // The anonymous board is the same for everyone; let the CDN hold it briefly.
  return json(body, 200, 'public, s-maxage=20, stale-while-revalidate=60');
}

interface SubmitBody { id?: unknown; token?: unknown; name?: unknown; level?: unknown; cls?: unknown; race?: unknown; playTime?: unknown }

async function submit(b: SubmitBody, ipHash: string, env: LeaderboardEnv): Promise<Response> {
  const id = String(b.id ?? '');
  const token = String(b.token ?? '');
  if (!ID_RE.test(id) || !TOKEN_RE.test(token)) return json({ ok: false, error: 'bad-request' }, 400);
  if (!(await underLimit(env, 'submit', ipHash, SUBMITS_PER_MINUTE, 60))) return json({ ok: false, error: 'rate' }, 429);

  const level = Number(b.level);
  const playTime = Number(b.playTime);
  const cls = String(b.cls ?? '');
  const race = String(b.race ?? '');
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return json({ ok: false, error: 'bad-request' }, 400);
  if (!Number.isFinite(playTime) || playTime < 0 || playTime > 3.2e8) return json({ ok: false, error: 'bad-request' }, 400);
  if (!SLUG_RE.test(cls) || !SLUG_RE.test(race)) return json({ ok: false, error: 'bad-request' }, 400);

  const named = checkName(String(b.name ?? ''));
  if (!named.ok) return json({ ok: false, error: 'name', message: named.message }, 422);
  const canon = canonicalName(named.name);

  const [banned, nameBanned, hidden, existingRaw] = await env.redis.exec([
    ['SISMEMBER', K.banned, id], ['SISMEMBER', K.bannedNames, canon], ['SISMEMBER', K.hidden, id], ['HGETALL', K.player(id)],
  ]);
  if (Number(banned) === 1) return json({ ok: false, error: 'banned' }, 403);
  if (Number(nameBanned) === 1) return json({ ok: false, error: 'name', message: 'That name is not allowed.' }, 422);

  const now = env.now();
  const tokenHash = await sha256(token);
  const prev = hashToRecord(existingRaw);
  if (prev.tok && prev.tok !== tokenHash) return json({ ok: false, error: 'auth' }, 403);

  if (playTime < minPlaySeconds(level)) return json({ ok: false, error: 'implausible' }, 422);
  if (prev.tok) {
    const prevPlay = Number(prev.playTime ?? 0);
    const prevAt = Number(prev.at ?? now);
    // Five minutes of slack for clocks and a save written just before the tab closed.
    if (playTime - prevPlay > (now - prevAt) / 1000 * 1.05 + 300) return json({ ok: false, error: 'implausible' }, 422);
  }

  const prevLevel = Number(prev.level ?? 0);
  const best = Math.max(level, prevLevel);
  const s = level > prevLevel || !prev.score ? score(best, now) : Number(prev.score);
  const commands: Cmd[] = [[
    'HSET', K.player(id),
    'name', named.name, 'canon', canon, 'level', best, 'cls', cls, 'race', race,
    'playTime', Math.max(playTime, Number(prev.playTime ?? 0)), 'at', now, 'first', prev.first ?? now, 'tok', tokenHash, 'score', s,
  ]];
  if (Number(hidden) !== 1) commands.push(['ZADD', K.board, s, id]);
  commands.push(['ZREVRANK', K.board, id]);
  const results = await env.redis.exec(commands);
  const rank = results[results.length - 1];
  return json({ ok: true, rank: rank === null || rank === undefined ? null : Number(rank) + 1, hidden: Number(hidden) === 1 });
}

async function remove(b: SubmitBody, env: LeaderboardEnv): Promise<Response> {
  const id = String(b.id ?? '');
  const token = String(b.token ?? '');
  if (!ID_RE.test(id) || !TOKEN_RE.test(token)) return json({ ok: false, error: 'bad-request' }, 400);
  const [tok] = await env.redis.exec([['HGET', K.player(id), 'tok']]);
  if (tok && tok !== (await sha256(token))) return json({ ok: false, error: 'auth' }, 403);
  await env.redis.exec([['ZREM', K.board, id], ['DEL', K.player(id)], ['SREM', K.hidden, id], ['DEL', K.reports(id)]]);
  return json({ ok: true });
}

async function report(b: { target?: unknown }, ipHash: string, env: LeaderboardEnv): Promise<Response> {
  const target = String(b.target ?? '');
  if (!ID_RE.test(target)) return json({ ok: false, error: 'bad-request' }, 400);
  if (!(await underLimit(env, 'report', ipHash, REPORTS_PER_HOUR, 3600))) return json({ ok: false, error: 'rate' }, 429);
  const [, count] = await env.redis.exec([['SADD', K.reports(target), ipHash], ['SCARD', K.reports(target)]]);
  if (Number(count) >= REPORTS_TO_HIDE) await env.redis.exec([['ZREM', K.board, target], ['SADD', K.hidden, target]]);
  return json({ ok: true });
}

/**
 * One visit or one new game, counted under its source (utm_source, lower
 * case; anything else is "other", none is "direct"). Only the daily sums are
 * stored — no id, no IP — so this needs no consent and tells us which channel
 * brings players.
 */
async function track(b: { kind?: unknown; src?: unknown }, ipHash: string, env: LeaderboardEnv): Promise<Response> {
  const kind = String(b.kind ?? '');
  if (!(STAT_KINDS as readonly string[]).includes(kind)) return json({ ok: false, error: 'bad-request' }, 400);
  if (!(await underLimit(env, 'track', ipHash, VISITS_PER_MINUTE, 60))) return json({ ok: false, error: 'rate' }, 429);
  const raw = String(b.src ?? '').toLowerCase();
  const src = !raw ? 'direct' : SOURCE_RE.test(raw) ? raw : 'other';
  const key = K.stats(kind, day(env.now()));
  await env.redis.exec([['HINCRBY', key, src, 1], ['EXPIRE', key, STATS_KEEP_SECONDS]]);
  return json({ ok: true });
}

async function admin(b: { action?: unknown; target?: unknown; days?: unknown }, env: LeaderboardEnv): Promise<Response> {
  const target = String(b.target ?? '');
  switch (b.action) {
    case 'stats': {
      const days = Math.max(1, Math.min(90, Number(b.days) || 14));
      const dates = Array.from({ length: days }, (_, i) => day(env.now() - i * 86400000));
      const rows = await env.redis.exec(dates.flatMap((d) => STAT_KINDS.map((k) => ['HGETALL', K.stats(k, d)])));
      const out: Record<string, Record<string, Record<string, number>>> = {};
      dates.forEach((d, i) => {
        out[d] = {};
        STAT_KINDS.forEach((k, j) => {
          const rec = hashToRecord(rows[i * STAT_KINDS.length + j]);
          out[d][k] = Object.fromEntries(Object.entries(rec).map(([src, n]) => [src, Number(n)]));
        });
      });
      return json({ ok: true, stats: out });
    }
    case 'reports': {
      const [ids] = await env.redis.exec([['SMEMBERS', K.hidden]]);
      const list = (ids as string[] | null) ?? [];
      const rows = list.length ? await env.redis.exec(list.flatMap((id) => [['HMGET', K.player(id), 'name', 'level'], ['SCARD', K.reports(id)]])) : [];
      return json({ ok: true, hidden: list.map((id, i) => {
        const [name, level] = (rows[i * 2] as Array<string | null>) ?? [];
        return { id, name, level: Number(level ?? 0), reports: Number(rows[i * 2 + 1] ?? 0) };
      }) });
    }
    case 'ban': {
      if (!ID_RE.test(target)) return json({ ok: false, error: 'bad-request' }, 400);
      const [canon] = await env.redis.exec([['HGET', K.player(target), 'canon']]);
      const commands: Cmd[] = [['SADD', K.banned, target], ['ZREM', K.board, target], ['SREM', K.hidden, target]];
      if (canon) commands.push(['SADD', K.bannedNames, String(canon)]);
      await env.redis.exec(commands);
      return json({ ok: true });
    }
    case 'ban-name': {
      const canon = canonicalName(target);
      if (!canon) return json({ ok: false, error: 'bad-request' }, 400);
      await env.redis.exec([['SADD', K.bannedNames, canon]]);
      return json({ ok: true, canon });
    }
    case 'restore': {
      if (!ID_RE.test(target)) return json({ ok: false, error: 'bad-request' }, 400);
      const [s] = await env.redis.exec([['HGET', K.player(target), 'score']]);
      const commands: Cmd[] = [['SREM', K.hidden, target], ['SREM', K.banned, target], ['DEL', K.reports(target)]];
      if (s) commands.push(['ZADD', K.board, Number(s), target]);
      await env.redis.exec(commands);
      return json({ ok: true });
    }
    default:
      return json({ ok: false, error: 'bad-request' }, 400);
  }
}

async function handlePost(req: Request, env: LeaderboardEnv): Promise<Response> {
  const text = await req.text();
  if (text.length > 2000) return json({ ok: false, error: 'bad-request' }, 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { return json({ ok: false, error: 'bad-request' }, 400); }
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad-request' }, 400);
  const ipHash = (await sha256(`${env.salt}:${clientIp(req)}`)).slice(0, 24);

  const adminHeader = req.headers.get('x-admin-token') ?? '';
  if (adminHeader) {
    if (env.adminToken.length < 16 || (await sha256(adminHeader)) !== (await sha256(env.adminToken))) {
      return json({ ok: false, error: 'auth' }, 403);
    }
    return admin(body, env);
  }
  switch (body.action) {
    case 'submit': return submit(body, ipHash, env);
    case 'remove': return remove(body, env);
    case 'report': return report(body, ipHash, env);
    case 'track': return track(body, ipHash, env);
    default: return json({ ok: false, error: 'bad-request' }, 400);
  }
}

export async function handleLeaderboard(req: Request, env: LeaderboardEnv): Promise<Response> {
  try {
    if (req.method === 'GET') return await handleGet(req, env);
    if (req.method === 'POST') return await handlePost(req, env);
    return json({ ok: false, error: 'method' }, 405);
  } catch (err) {
    console.error('leaderboard', err);
    return json({ ok: false, error: 'server' }, 500);
  }
}
