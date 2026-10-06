/**
 * Leaderboard API against an in-memory Redis: ranking, ownership, the name
 * filter on the server, plausibility limits, reports, admin, and that the
 * committed api/leaderboard.js bundle matches the source.
 */
import { spawnSync } from 'node:child_process';
import { handleLeaderboard, minPlaySeconds, type Cmd, type LeaderboardEnv } from '../src/server/leaderboard';

let failures = 0;
const fail = (msg: string) => { failures++; console.error(`  FAIL ${msg}`); };
const ok = (cond: unknown, msg: string) => { if (!cond) fail(msg); };

/** Just the Redis commands the leaderboard uses. */
function memoryRedis() {
  const kv = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const sets = new Map<string, Set<string>>();
  const zsets = new Map<string, Map<string, number>>();
  const h = (k: string) => { let m = hashes.get(k); if (!m) hashes.set(k, (m = new Map())); return m; };
  const s = (k: string) => { let m = sets.get(k); if (!m) sets.set(k, (m = new Set())); return m; };
  const z = (k: string) => { let m = zsets.get(k); if (!m) zsets.set(k, (m = new Map())); return m; };
  const desc = (k: string) => [...z(k).entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1)).map(([m]) => m);
  const run = ([cmd, ...a]: Cmd): unknown => {
    const k = String(a[0]);
    switch (cmd) {
      case 'INCR': { const n = Number(kv.get(k) ?? 0) + 1; kv.set(k, String(n)); return n; }
      case 'EXPIRE': return 1;
      case 'HSET': { const m = h(k); for (let i = 1; i < a.length; i += 2) m.set(String(a[i]), String(a[i + 1])); return 1; }
      case 'HGET': return hashes.get(k)?.get(String(a[1])) ?? null;
      case 'HMGET': return a.slice(1).map((f) => hashes.get(k)?.get(String(f)) ?? null);
      case 'HGETALL': return [...(hashes.get(k) ?? new Map()).entries()].flat();
      case 'DEL': { const had = hashes.delete(k) || sets.delete(k) || kv.delete(k); return had ? 1 : 0; }
      case 'SADD': { const m = s(k); const before = m.size; for (const v of a.slice(1)) m.add(String(v)); return m.size - before; }
      case 'SREM': return sets.get(k)?.delete(String(a[1])) ? 1 : 0;
      case 'SCARD': return sets.get(k)?.size ?? 0;
      case 'SISMEMBER': return sets.get(k)?.has(String(a[1])) ? 1 : 0;
      case 'SMEMBERS': return [...(sets.get(k) ?? [])];
      case 'ZADD': z(k).set(String(a[2]), Number(a[1])); return 1;
      case 'ZREM': return zsets.get(k)?.delete(String(a[1])) ? 1 : 0;
      case 'ZCARD': return zsets.get(k)?.size ?? 0;
      case 'ZREVRANGE': return desc(k).slice(Number(a[1]), Number(a[2]) + 1);
      case 'ZREVRANK': { const i = desc(k).indexOf(String(a[1])); return i < 0 ? null : i; }
      default: throw new Error(`memory redis: ${cmd}`);
    }
  };
  return { exec: async (commands: Cmd[]) => commands.map(run) };
}

let clock = Date.UTC(2026, 9, 6, 12);
const env: LeaderboardEnv = { redis: memoryRedis(), adminToken: 'admin-token-0123456789', salt: 'test', now: () => clock };

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tok = (n: number) => `token-${String(n).padStart(32, '0')}`;
let ip = 1;
async function call(method: string, body?: unknown, headers: Record<string, string> = {}, query = '') {
  const res = await handleLeaderboard(new Request(`http://local/api/leaderboard${query}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${ip}`, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
  return { status: res.status, body: await res.json() as Record<string, any> };
}
const submit = (n: number, name: string, level: number, playTime = minPlaySeconds(level) + 60, extra: object = {}) =>
  call('POST', { action: 'submit', id: uuid(n), token: tok(n), name, level, cls: 'warrior', race: 'human', playTime, ...extra });

async function main() {
  // empty board
  let r = await call('GET');
  ok(r.status === 200 && r.body.top.length === 0 && r.body.total === 0, 'empty board');

  // ranking: level first, earlier wins a tie
  ok((await submit(1, 'Torvin', 10)).body.ok, 'submit Torvin');
  clock += 60_000;
  ok((await submit(2, 'Maela', 10)).body.ok, 'submit Maela');
  ok((await submit(3, 'Rurik', 12)).body.ok, 'submit Rurik');
  r = await call('GET');
  ok(r.body.top.map((x: any) => x.name).join(',') === 'Rurik,Torvin,Maela', `ranking ${r.body.top.map((x: any) => x.name)}`);
  r = await call('GET', undefined, {}, `?id=${uuid(2)}`);
  ok(r.body.me?.rank === 3, 'own rank');

  // the filter runs on the server
  r = await submit(4, 'n1gg3r', 5);
  ok(r.status === 422 && r.body.error === 'name', 'slur rejected by server');
  r = await submit(4, 'Zoë', 5);
  ok(r.status === 422, 'bad characters rejected');

  // someone else cannot overwrite an entry
  r = await call('POST', { action: 'submit', id: uuid(1), token: tok(99), name: 'Hijack', level: 50, cls: 'warrior', race: 'human', playTime: 1e6 });
  ok(r.status === 403 && r.body.error === 'auth', 'foreign token rejected');

  // plausibility
  r = await submit(5, 'Speedy', 100, 60);
  ok(r.status === 422 && r.body.error === 'implausible', 'level 100 in a minute rejected');
  clock += 10 * 60_000;
  r = await submit(1, 'Torvin', 30, minPlaySeconds(30) + 60);
  ok(r.status === 422 && r.body.error === 'implausible', 'play time cannot outrun the wall clock');
  clock += 4 * 3600_000;
  r = await submit(1, 'Torvin', 30, minPlaySeconds(30) + 60);
  ok(r.body.ok && r.body.rank === 1, 'honest progress accepted');

  // a lower level never lowers the entry
  clock += 60_000;
  await submit(1, 'Torvin', 2, minPlaySeconds(30) + 120);
  r = await call('GET');
  ok(r.body.top[0].level === 30, 'best level kept');

  // reports: three different reporters hide an entry, it stays hidden on resubmit
  for (let i = 0; i < 3; i++) { ip = 50 + i; await call('POST', { action: 'report', target: uuid(3) }); }
  ip = 1;
  r = await call('GET');
  ok(!r.body.top.some((x: any) => x.name === 'Rurik'), 'reported entry hidden');
  clock += 3600_000;
  await submit(3, 'Rurik', 13, minPlaySeconds(13) + 60);
  r = await call('GET');
  ok(!r.body.top.some((x: any) => x.name === 'Rurik'), 'hidden entry stays hidden');

  // admin
  r = await call('POST', { action: 'reports' }, { 'x-admin-token': 'wrong-token-0000000000' });
  ok(r.status === 403, 'wrong admin token rejected');
  r = await call('POST', { action: 'reports' }, { 'x-admin-token': env.adminToken });
  ok(r.body.hidden?.length === 1 && r.body.hidden[0].reports === 3, 'admin sees reports');
  await call('POST', { action: 'restore', target: uuid(3) }, { 'x-admin-token': env.adminToken });
  r = await call('GET');
  ok(r.body.top.some((x: any) => x.name === 'Rurik'), 'admin restore');
  await call('POST', { action: 'ban', target: uuid(2) }, { 'x-admin-token': env.adminToken });
  r = await call('GET');
  ok(!r.body.top.some((x: any) => x.name === 'Maela'), 'admin ban removes entry');
  r = await submit(2, 'Maela', 11, 1e5);
  ok(r.status === 403 && r.body.error === 'banned', 'banned player cannot return');
  r = await submit(6, 'M4ela', 3);
  ok(r.status === 422, 'banned name blocked in other spellings');

  // the player can take themselves off
  r = await call('POST', { action: 'remove', id: uuid(3), token: tok(3) });
  ok(r.body.ok, 'remove');
  r = await call('GET');
  ok(!r.body.top.some((x: any) => x.name === 'Rurik'), 'removed entry gone');

  // rate limit
  ip = 200;
  let limited = false;
  for (let i = 0; i < 25; i++) if ((await submit(7, 'Spammer', 1, 0)).status === 429) limited = true;
  ok(limited, 'submit rate limit');

  // junk
  ok((await call('POST', 'not an object')).status === 400, 'junk body');
  ok((await call('PUT')).status === 405, 'wrong method');

  // the deployed bundle is the source
  const fresh = spawnSync(process.execPath, ['scripts/build-api.mjs', '--check'], { stdio: 'inherit' });
  ok(fresh.status === 0, 'api/leaderboard.js is up to date');

  if (failures) { console.error(`check-leaderboard: ${failures} failure(s)`); process.exit(1); }
  console.log('check-leaderboard: ok');
}

void main();
