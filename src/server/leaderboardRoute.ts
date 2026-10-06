/*
 * The Vercel Function entry: bundled to `api/leaderboard.js` by
 * `scripts/build-api.mjs`, so the deployed function is one plain ES module
 * with no TypeScript or import resolution left for Vercel to do.
 *
 * Env (Vercel → Project → Settings → Environment Variables):
 *   KV_REST_API_URL / KV_REST_API_TOKEN   set by the Upstash for Redis integration
 *     (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN also work)
 *   LEADERBOARD_ADMIN_TOKEN               ≥ 16 characters, for ban / restore / reports
 *   LEADERBOARD_SALT                      optional, salts the IP hashes
 */
import { handleLeaderboard, type Cmd, type Redis } from './leaderboard';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

function upstash(url: string, token: string): Redis {
  return {
    async exec(commands: Cmd[]) {
      const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(commands),
      });
      if (!res.ok) throw new Error(`upstash ${res.status}`);
      const out = (await res.json()) as Array<{ result?: unknown; error?: string }>;
      return out.map((r) => {
        if (r.error) throw new Error(`upstash ${r.error}`);
        return r.result;
      });
    },
  };
}

function handler(req: Request): Promise<Response> | Response {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ ok: false, error: 'offline' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
  return handleLeaderboard(req, {
    redis: upstash(url, token),
    adminToken: env.LEADERBOARD_ADMIN_TOKEN ?? '',
    salt: env.LEADERBOARD_SALT ?? env.LEADERBOARD_ADMIN_TOKEN ?? 'modulo',
    now: () => Date.now(),
  });
}

export { handler as GET, handler as POST };
