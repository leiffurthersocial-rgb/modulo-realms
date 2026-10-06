#!/usr/bin/env node
/*
 * Visits and new games per source and day, from the live site.
 *
 *   LEADERBOARD_ADMIN_TOKEN=… node marketing/stats.mjs [days] [--url https://modulo-realms-one.vercel.app]
 */
const days = Number(process.argv[2]) || 14;
const i = process.argv.indexOf('--url');
const base = i > 0 ? process.argv[i + 1] : 'https://modulo-realms-one.vercel.app';
const token = process.env.LEADERBOARD_ADMIN_TOKEN;
if (!token) { console.error('missing env LEADERBOARD_ADMIN_TOKEN'); process.exit(1); }
const res = await fetch(`${base}/api/leaderboard`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token },
  body: JSON.stringify({ action: 'stats', days }),
});
const body = await res.json();
if (!body.ok) { console.error(res.status, body); process.exit(1); }
const sources = new Set();
for (const d of Object.values(body.stats)) for (const k of Object.values(d)) for (const s of Object.keys(k)) sources.add(s);
const cols = [...sources].sort();
console.log(['day', ...cols.flatMap((s) => [`${s} visits`, `${s} starts`])].join('\t'));
for (const [d, v] of Object.entries(body.stats)) console.log([d, ...cols.flatMap((s) => [v.visit?.[s] ?? 0, v.start?.[s] ?? 0])].join('\t'));
