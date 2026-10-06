#!/usr/bin/env node
/*
 * YouTube Shorts: sign in once, upload, read the numbers back.
 *
 *   node marketing/youtube.mjs login                 device-code sign-in; prints the refresh token to store
 *   node marketing/youtube.mjs upload <file.mp4> --title "…" --desc "…" [--tags a,b] [--privacy public|unlisted|private]
 *   node marketing/youtube.mjs stats <videoId>[,<videoId>…]
 *
 * Env (cloud environment settings, never the repo):
 *   YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET   Google Cloud OAuth client, type "TVs and Limited Input devices",
 *                                               project with "YouTube Data API v3" enabled
 *   YOUTUBE_REFRESH_TOKEN                       from `login`
 *
 * The device flow means the person types a short code at google.com/device
 * on their own phone; no password or code ever passes through here. A
 * vertical video under 60 seconds is published as a Short automatically.
 * Until the Google Cloud project passes YouTube's API audit, uploads from it
 * are locked to private — the video then has to be made public by hand once.
 */
import { readFileSync, statSync } from 'node:fs';

const env = process.env;
const [cmd, arg] = process.argv.slice(2);
const opt = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const need = (k) => { if (!env[k]) { console.error(`missing env ${k}`); process.exit(1); } return env[k]; };
const SCOPE = 'https://www.googleapis.com/auth/youtube';

async function form(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  return { status: res.status, body: await res.json() };
}

async function accessToken() {
  const r = await form('https://oauth2.googleapis.com/token', {
    client_id: need('YOUTUBE_CLIENT_ID'), client_secret: need('YOUTUBE_CLIENT_SECRET'),
    refresh_token: need('YOUTUBE_REFRESH_TOKEN'), grant_type: 'refresh_token',
  });
  if (!r.body.access_token) { console.error('token refresh failed:', r.body.error, r.body.error_description); process.exit(1); }
  return r.body.access_token;
}

async function login() {
  const id = need('YOUTUBE_CLIENT_ID');
  const secret = need('YOUTUBE_CLIENT_SECRET');
  const start = await form('https://oauth2.googleapis.com/device/code', { client_id: id, scope: SCOPE });
  if (!start.body.device_code) { console.error('device flow refused:', start.body); process.exit(1); }
  console.log(`\nOn your phone: open ${start.body.verification_url} and enter the code  ${start.body.user_code}`);
  console.log('Sign in with the account that owns the channel, then allow access.\n');
  const until = Date.now() + start.body.expires_in * 1000;
  let wait = (start.body.interval ?? 5) * 1000;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, wait));
    const r = await form('https://oauth2.googleapis.com/token', {
      client_id: id, client_secret: secret, device_code: start.body.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    if (r.body.refresh_token) {
      console.log('Signed in. Store this as YOUTUBE_REFRESH_TOKEN in the environment settings:');
      console.log(r.body.refresh_token);
      return;
    }
    if (r.body.error === 'slow_down') wait += 5000;
    else if (r.body.error !== 'authorization_pending') { console.error('sign-in failed:', r.body.error); process.exit(1); }
  }
  console.error('the code expired; run login again');
  process.exit(1);
}

async function upload(file) {
  const token = await accessToken();
  const meta = {
    snippet: {
      title: opt('title', 'Modulo: Realms of Ash #Shorts').slice(0, 100),
      description: opt('desc', ''),
      tags: (opt('tags', 'pixelart,indiegame,rpg,gamedev,browsergame')).split(',').map((t) => t.trim()).filter(Boolean),
      categoryId: '20', // Gaming
    },
    status: { privacyStatus: opt('privacy', 'public'), selfDeclaredMadeForKids: false },
  };
  const size = statSync(file).size;
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-type': 'video/mp4', 'x-upload-content-length': String(size),
    },
    body: JSON.stringify(meta),
  });
  const location = init.headers.get('location');
  if (!location) { console.error('upload refused:', init.status, await init.text()); process.exit(1); }
  const put = await fetch(location, { method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-length': String(size) }, body: readFileSync(file) });
  const body = await put.json();
  if (!body.id) { console.error('upload failed:', put.status, JSON.stringify(body)); process.exit(1); }
  console.log(JSON.stringify({ id: body.id, url: `https://youtube.com/shorts/${body.id}`, privacy: body.status?.privacyStatus }));
}

async function stats(ids) {
  const token = await accessToken();
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${encodeURIComponent(ids)}`, { headers: { authorization: `Bearer ${token}` } });
  const body = await res.json();
  for (const v of body.items ?? []) {
    const s = v.statistics;
    console.log(JSON.stringify({ id: v.id, title: v.snippet.title, views: +s.viewCount || 0, likes: +s.likeCount || 0, comments: +s.commentCount || 0 }));
  }
}

if (cmd === 'login') await login();
else if (cmd === 'upload' && arg) await upload(arg);
else if (cmd === 'stats' && arg) await stats(arg);
else { console.error('usage: node marketing/youtube.mjs login | upload <file.mp4> --title … | stats <ids>'); process.exit(1); }
