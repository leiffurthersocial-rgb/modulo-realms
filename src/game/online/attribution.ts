/*
 * Which channel brought this player: the `utm_source` of the link they came
 * in on (the bios link to /?utm_source=tiktok and so on). One "visit" per
 * browser session and one "start" per new character are counted on the
 * server as daily sums per source — no id, no IP, nothing about the player.
 * Production builds only; every failure is silent.
 */
import { onlineEnabled } from './leaderboard';

const KEY = 'modulo-realms-source';
const ENDPOINT = '/api/leaderboard';

function source(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('utm_source');
    if (fromUrl) { localStorage.setItem(KEY, fromUrl.toLowerCase().slice(0, 24)); return fromUrl; }
    return localStorage.getItem(KEY) ?? '';
  } catch { return ''; }
}

function send(kind: 'visit' | 'start'): void {
  if (!onlineEnabled()) return;
  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'track', kind, src: source() }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Once per browser session, at startup. */
export function trackVisit(): void {
  if (!onlineEnabled()) return;
  try {
    if (sessionStorage.getItem(`${KEY}:seen`)) return;
    sessionStorage.setItem(`${KEY}:seen`, '1');
  } catch { /* storage blocked: count anyway */ }
  send('visit');
}

/** A new character. */
export function trackStart(): void { send('start'); }
