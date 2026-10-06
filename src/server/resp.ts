/*
 * A Redis client for one pipeline per request, speaking the plain Redis
 * protocol (RESP2) over TCP or TLS. Enough for the leaderboard: send every
 * command, read every reply, close. Used when the store only provides a
 * `redis://` / `rediss://` URL (Vercel's Redis integration sets REDIS_URL)
 * instead of Upstash's REST API.
 */
import { connect as tcpConnect } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import type { Cmd, Redis } from './leaderboard';

const CRLF = '\r\n';

function encode(commands: Cmd[]): string {
  let out = '';
  for (const cmd of commands) {
    out += `*${cmd.length}${CRLF}`;
    for (const arg of cmd) {
      const s = String(arg);
      out += `$${new TextEncoder().encode(s).length}${CRLF}${s}${CRLF}`;
    }
  }
  return out;
}

class ReplyError extends Error {}

/** Parses one reply at `pos`; returns it and the next position, or null when the buffer ends first. */
function parse(buf: Uint8Array, pos: number): { value: unknown; next: number } | null {
  const lineEnd = (from: number) => {
    for (let i = from; i + 1 < buf.length; i++) if (buf[i] === 13 && buf[i + 1] === 10) return i;
    return -1;
  };
  const end = lineEnd(pos);
  if (end < 0) return null;
  const type = String.fromCharCode(buf[pos]);
  const line = new TextDecoder().decode(buf.subarray(pos + 1, end));
  const after = end + 2;
  switch (type) {
    case '+': return { value: line, next: after };
    case '-': return { value: new ReplyError(line), next: after };
    case ':': return { value: Number(line), next: after };
    case '$': {
      const len = Number(line);
      if (len < 0) return { value: null, next: after };
      if (buf.length < after + len + 2) return null;
      return { value: new TextDecoder().decode(buf.subarray(after, after + len)), next: after + len + 2 };
    }
    case '*': {
      const n = Number(line);
      if (n < 0) return { value: null, next: after };
      const items: unknown[] = [];
      let at = after;
      for (let i = 0; i < n; i++) {
        const r = parse(buf, at);
        if (!r) return null;
        items.push(r.value);
        at = r.next;
      }
      return { value: items, next: at };
    }
    default:
      throw new Error(`redis: unexpected reply type ${JSON.stringify(type)}`);
  }
}

export function respRedis(url: string, timeoutMs = 5000): Redis {
  const u = new URL(url);
  const secure = u.protocol === 'rediss:';
  const host = u.hostname;
  const port = Number(u.port || 6379);
  const prefix: Cmd[] = [];
  if (u.password) {
    const pw = decodeURIComponent(u.password);
    prefix.push(u.username ? ['AUTH', decodeURIComponent(u.username), pw] : ['AUTH', pw]);
  }
  const db = u.pathname.replace('/', '');
  if (db && db !== '0') prefix.push(['SELECT', db]);

  return {
    exec(commands: Cmd[]) {
      const all = [...prefix, ...commands];
      return new Promise<unknown[]>((resolve, reject) => {
        const socket = secure ? tlsConnect({ host, port, servername: host }) : tcpConnect({ host, port });
        let buf = new Uint8Array(0);
        let pos = 0;
        const replies: unknown[] = [];
        const finish = (err?: Error) => {
          clearTimeout(timer);
          socket.destroy();
          if (err) return reject(err);
          const failed = replies.find((r) => r instanceof ReplyError) as ReplyError | undefined;
          if (failed) return reject(new Error(`redis ${failed.message}`));
          resolve(replies.slice(prefix.length));
        };
        const timer = setTimeout(() => finish(new Error('redis timeout')), timeoutMs);
        socket.on('error', (err: Error) => finish(err));
        socket.on(secure ? 'secureConnect' : 'connect', () => socket.write(encode(all)));
        socket.on('data', (chunk: Uint8Array) => {
          const merged = new Uint8Array(buf.length + chunk.length);
          merged.set(buf);
          merged.set(chunk, buf.length);
          buf = merged;
          for (;;) {
            const r = parse(buf, pos);
            if (!r) break;
            replies.push(r.value);
            pos = r.next;
          }
          if (replies.length >= all.length) finish();
        });
      });
    },
  };
}
