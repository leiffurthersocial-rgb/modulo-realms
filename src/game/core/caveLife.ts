import type { Game } from './game';
import type { GameMap } from '../world/map';
import { T, TILE } from '../world/tiles';
import { PAL } from '../art/palette';

/**
 * What moves in a cave when nothing is fighting: water dripping into the
 * puddles, spores lifting off the glowing caps, crystals catching the light,
 * dust turning in the torchlight, bats that leave the ceiling when you walk
 * under them and rats that run along the walls and away from you.
 *
 * Pure decoration, like `ambience.ts`: nothing here is saved, collides or
 * touches the simulation. It runs on `game.now` and only in caves (`kind:
 * 'cave'`), and it reads its anchors — puddles, shrooms, crystals, torches —
 * from the props `decorateCave` laid.
 */

interface Drop { x: number; y: number; floor: number; vy: number }
interface Ring { x: number; y: number; t: number }
interface Speck { x: number; y: number; vx: number; vy: number; t: number; max: number; color: string; glow: boolean }
interface Bat { x: number; y: number; hx: number; hy: number; state: 'hang' | 'fly' | 'gone'; t: number; vx: number; vy: number; seed: number; back: number }
interface Rat { x: number; y: number; dir: number; speed: number; t: number; left: number; pause: number }
interface Glint { x: number; y: number; t: number }

function hash(a: number, b = 0): number {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export class CaveLife {
  private mapId = '';
  private last = -1;
  private drops: Drop[] = [];
  private rings: Ring[] = [];
  private specks: Speck[] = [];
  private bats: Bat[] = [];
  private rats: Rat[] = [];
  private glints: Glint[] = [];
  private nextRat = 3;
  private active = false;

  /** Hanging places: a floor tile with rock straight above it, one in a dozen. */
  private roost(map: GameMap): void {
    this.bats = [];
    const wall = (tx: number, ty: number) => map.tiles[ty * map.w + tx] === T.CAVE_WALL;
    for (let ty = 1; ty < map.h - 1; ty++) {
      for (let tx = 1; tx < map.w - 1; tx++) {
        if (map.tiles[ty * map.w + tx] !== T.CAVE_FLOOR || !wall(tx, ty - 1)) continue;
        if (hash(tx, ty) > 0.12) continue;
        const x = tx * TILE + 6 + hash(ty, tx) * 20, y = ty * TILE + 3;
        this.bats.push({ x, y, hx: x, hy: y, state: 'hang', t: hash(tx * 3, ty) * 10, vx: 0, vy: 0, seed: hash(tx, ty * 7), back: 0 });
      }
    }
  }

  update(game: Game, view: { left: number; top: number; w: number; h: number }, propIdx: number[]): void {
    const map = game.map;
    this.active = map.kind === 'cave';
    if (map.id !== this.mapId) {
      this.mapId = map.id;
      this.drops = []; this.rings = []; this.specks = []; this.rats = []; this.glints = [];
      if (this.active) this.roost(map);
    }
    if (!this.active) return;
    const now = game.now;
    let dt = this.last < 0 ? 0 : now - this.last;
    this.last = now;
    if (dt <= 0 || dt > 0.25) return;
    const p = game.player;
    const inView = (x: number, y: number, pad = 40) => x > view.left - pad && x < view.left + view.w + pad && y > view.top - pad && y < view.top + view.h + pad;

    for (const i of propIdx) {
      const pr = map.props[i];
      if (!inView(pr.x, pr.y)) continue;
      switch (pr.art) {
        case 'cave_puddle_a':
        case 'cave_puddle_b':
          // every puddle has its own drip, on its own clock
          if (Math.random() < dt * (0.35 + hash(pr.x, pr.y) * 0.5)) {
            const x = pr.x + (hash(pr.y, pr.x) - 0.5) * 12;
            this.drops.push({ x, y: pr.y - 70, floor: pr.y - 6, vy: 0 });
          }
          break;
        case 'cave_glowshroom':
          if (Math.random() < dt * 0.7) this.specks.push({ x: pr.x + (Math.random() - 0.5) * 16, y: pr.y - 10, vx: 0, vy: -6 - Math.random() * 5, t: 0, max: 3 + Math.random() * 2, color: Math.random() < 0.6 ? PAL.frost : '#bff4ec', glow: true });
          break;
        case 'cave_crystal':
          if (Math.random() < dt * 0.6) this.glints.push({ x: pr.x + (Math.random() - 0.5) * 12, y: pr.y - 8 - Math.random() * 18, t: 0 });
          break;
        case 'torch':
        case 'cave_support': {
          // dust turning slowly in the light
          if (Math.random() < dt * 2.6) {
            const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 70;
            this.specks.push({ x: pr.x + Math.cos(a) * r, y: pr.y - 24 + Math.sin(a) * r * 0.6, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 3, t: 0, max: 4 + Math.random() * 3, color: Math.random() < 0.5 ? PAL.bone : PAL.flameLit, glow: false });
          }
          break;
        }
        default:
          break;
      }
    }

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.vy += 420 * dt;
      d.y += d.vy * dt;
      if (d.y >= d.floor) {
        this.rings.push({ x: d.x, y: d.floor, t: 0 });
        for (const s of [-1, 1]) this.specks.push({ x: d.x, y: d.floor - 1, vx: s * 14, vy: -26, t: 0, max: 0.28, color: PAL.foam, glow: false });
        this.drops.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) if ((this.rings[i].t += dt) > 0.9) this.rings.splice(i, 1);
    for (let i = this.glints.length - 1; i >= 0; i--) if ((this.glints[i].t += dt) > 0.45) this.glints.splice(i, 1);
    for (let i = this.specks.length - 1; i >= 0; i--) {
      const s = this.specks[i];
      s.t += dt;
      if (s.max < 1) s.vy += 160 * dt; // splash droplets fall back
      else s.vx += Math.sin(now * 1.3 + s.y * 0.1) * 3 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.t > s.max) this.specks.splice(i, 1);
    }
    if (this.specks.length > 220) this.specks.splice(0, this.specks.length - 220);

    // bats leave the ceiling when you walk under them, and come back later
    for (const b of this.bats) {
      b.t += dt;
      if (b.state === 'hang') {
        if (inView(b.x, b.y, 60) && Math.abs(p.x - b.x) < 80 && Math.abs(p.y - b.y) < 90) {
          b.state = 'fly'; b.t = 0;
          const away = Math.sign(b.x - p.x) || 1;
          b.vx = away * (50 + b.seed * 40);
          b.vy = -10;
        }
      } else if (b.state === 'fly') {
        // erratic, fluttering flight away into the dark
        b.vx += Math.sin(b.t * 9 + b.seed * 20) * 160 * dt;
        b.vy = Math.sin(b.t * 6 + b.seed * 9) * 40 - 12;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.t > 3.2) { b.state = 'gone'; b.t = 0; b.back = 40 + b.seed * 50; }
      } else if (b.t > b.back && (Math.abs(p.x - b.hx) > 300 || Math.abs(p.y - b.hy) > 240)) {
        // back on its roost while nobody is looking
        b.x = b.hx; b.y = b.hy;
        b.state = 'hang'; b.t = 0;
      }
    }

    // rats run along the walls, and away from you
    if (now > this.nextRat && this.rats.length < 2) {
      this.nextRat = now + 5 + Math.random() * 8;
      for (let n = 0; n < 30; n++) {
        const tx = Math.floor((view.left + Math.random() * view.w) / TILE);
        const ty = Math.floor((view.top + Math.random() * view.h) / TILE);
        if (tx < 2 || ty < 2 || tx >= map.w - 2 || ty >= map.h - 2) continue;
        const at = (x: number, y: number) => map.tiles[y * map.w + x];
        if (at(tx, ty) !== T.CAVE_FLOOR || at(tx, ty + 1) !== T.CAVE_WALL) continue;
        const x = tx * TILE + 16, y = ty * TILE + TILE - 4;
        if (Math.hypot(p.x - x, p.y - y) < 120) continue;
        this.rats.push({ x, y, dir: Math.random() < 0.5 ? -1 : 1, speed: 46, t: 0, left: 90 + Math.random() * 110, pause: 0 });
        break;
      }
    }
    for (let i = this.rats.length - 1; i >= 0; i--) {
      const r = this.rats[i];
      r.t += dt;
      const near = Math.hypot(p.x - r.x, p.y - r.y) < 90;
      if (near) { r.dir = Math.sign(r.x - p.x) || r.dir; r.speed = 150; r.pause = 0; }
      if (r.pause > 0) { r.pause -= dt; continue; }
      if (!near && Math.random() < dt * 0.6) r.pause = 0.3 + Math.random() * 0.6;
      const nx = r.x + r.dir * r.speed * dt;
      const tile = map.tiles[Math.floor(r.y / TILE) * map.w + Math.floor(nx / TILE)];
      if (tile !== T.CAVE_FLOOR) r.dir = -r.dir;
      else { r.x = nx; r.left -= r.speed * dt; }
      if (r.left <= 0 || r.t > 12) this.rats.splice(i, 1);
    }
  }

  /** Under actors: ripples, rats. */
  drawGround(g: CanvasRenderingContext2D, now: number): void {
    if (!this.active) return;
    g.save();
    for (const r of this.rings) {
      const k = r.t / 0.9;
      g.globalAlpha = 0.7 * (1 - k);
      g.strokeStyle = PAL.foam;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(r.x, r.y, 2 + k * 9, 1 + k * 3.5, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    for (const r of this.rats) {
      const x = Math.round(r.x), y = Math.round(r.y);
      const f = r.pause > 0 ? 0 : Math.floor(now * (r.speed > 60 ? 18 : 10)) % 2;
      const d = r.dir;
      g.fillStyle = 'rgba(10,8,16,0.35)';
      g.fillRect(x - 4, y + 1, 8, 1);
      g.fillStyle = '#5a4a44';
      g.fillRect(x - 3, y - 3, 6, 3);
      g.fillStyle = '#7a665c';
      g.fillRect(x - 2, y - 3, 3, 1);
      // head, ear, eye
      g.fillStyle = '#5a4a44';
      g.fillRect(x + d * 3 - (d < 0 ? 2 : 0), y - 3, 2, 2);
      g.fillStyle = '#9a8478';
      g.fillRect(x + d * 2, y - 4, 1, 1);
      g.fillStyle = PAL.ink;
      g.fillRect(x + d * 4 - (d < 0 ? 1 : 0), y - 3, 1, 1);
      // tail
      g.fillStyle = '#b08a80';
      g.fillRect(x - d * 4 - (d > 0 ? 2 : 0), y - 1, 3, 1);
      // legs
      g.fillStyle = '#3a2e2a';
      g.fillRect(x - 2 + f, y, 1, 1);
      g.fillRect(x + 1 - f, y, 1, 1);
    }
    g.restore();
  }

  /** Over actors, under the darkness: drops, dust, bats. */
  drawAir(g: CanvasRenderingContext2D, now: number): void {
    if (!this.active) return;
    g.save();
    g.fillStyle = PAL.foam;
    for (const d of this.drops) g.fillRect(Math.round(d.x), Math.round(d.y), 1, 2);
    for (const s of this.specks) {
      if (s.glow) continue;
      g.globalAlpha = Math.min(1, s.t * 3, (s.max - s.t) * 2) * (s.max < 1 ? 0.9 : 0.85);
      g.fillStyle = s.color;
      g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
    g.globalAlpha = 1;
    for (const b of this.bats) {
      if (b.state === 'gone') continue;
      const x = Math.round(b.x), y = Math.round(b.y);
      if (b.state === 'hang') {
        // folded, upside down, ears at the bottom; now and then a wing twitches
        const twitch = hash(Math.floor(now * 2), b.seed * 100) < 0.08;
        g.fillStyle = PAL.ink;
        g.fillRect(x, y, 4, 7);
        g.fillRect(x + 1, y - 1, 2, 1);
        g.fillRect(x, y + 7, 1, 1);
        g.fillRect(x + 3, y + 7, 1, 1);
        g.fillStyle = '#3a2e44';
        g.fillRect(x + 1, y + 1, 2, 4);
        g.fillStyle = PAL.ink;
        if (twitch) { g.fillRect(x - 3, y + 1, 3, 1); g.fillRect(x - 2, y + 2, 2, 1); }
        g.fillStyle = PAL.ember;
        g.fillRect(x + 1, y + 5, 1, 1);
        g.fillRect(x + 2, y + 5, 1, 1);
      } else {
        const up = Math.floor(now * 16 + b.seed * 10) % 2 === 0;
        g.fillStyle = PAL.ink;
        g.fillRect(x - 1, y - 1, 3, 4);
        g.fillRect(x - 1, y - 2, 1, 1); g.fillRect(x + 1, y - 2, 1, 1);
        if (up) {
          g.fillRect(x - 7, y - 4, 3, 1); g.fillRect(x - 5, y - 3, 3, 1); g.fillRect(x - 3, y - 2, 2, 1);
          g.fillRect(x + 5, y - 4, 3, 1); g.fillRect(x + 3, y - 3, 3, 1); g.fillRect(x + 2, y - 2, 2, 1);
        } else {
          g.fillRect(x - 7, y + 2, 3, 1); g.fillRect(x - 5, y + 1, 3, 1); g.fillRect(x - 3, y, 2, 1);
          g.fillRect(x + 5, y + 2, 3, 1); g.fillRect(x + 3, y + 1, 3, 1); g.fillRect(x + 2, y, 2, 1);
        }
      }
    }
    g.restore();
  }

  /** After the darkness: what gives its own light — spores, caps, glints. */
  drawEmissive(g: CanvasRenderingContext2D, game: Game, propIdx: number[]): void {
    if (!this.active) return;
    const now = game.now;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const i of propIdx) {
      const pr = game.map.props[i];
      if (pr.art !== 'cave_glowshroom' && pr.art !== 'cave_crystal') continue;
      const pulse = 0.5 + 0.5 * Math.sin(now * 1.6 + (pr.phase ?? 0));
      const shroom = pr.art === 'cave_glowshroom';
      // a stepped oval of light: flat layers, no soft gradient, the corners
      // cut so it never reads as a box
      g.fillStyle = shroom ? '#1f6b66' : PAL.arcaneDark;
      const cx = Math.round(pr.x), cy = Math.round(pr.y - (shroom ? 9 : 14));
      const rw = shroom ? 18 : 13, rh = shroom ? 8 : 16;
      g.globalAlpha = (shroom ? 0.1 : 0.13) + pulse * 0.08;
      for (const [kw, kh] of [[1, 0.35], [0.85, 0.65], [0.62, 0.88], [0.35, 1]]) {
        const w = Math.round(rw * kw), h = Math.round(rh * kh);
        g.fillRect(cx - w, cy - h, w * 2, h * 2);
      }
    }
    for (const s of this.specks) {
      if (!s.glow) continue;
      g.globalAlpha = Math.min(1, s.t * 2, (s.max - s.t)) * 0.9;
      g.fillStyle = s.color;
      g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
    for (const gl of this.glints) {
      const k = 1 - Math.abs(gl.t / 0.45 - 0.5) * 2;
      const arm = Math.round(1 + k * 3);
      const x = Math.round(gl.x), y = Math.round(gl.y);
      g.globalAlpha = 0.9 * k;
      g.fillStyle = PAL.white;
      g.fillRect(x - arm, y, arm * 2 + 1, 1);
      g.fillRect(x, y - arm, 1, arm * 2 + 1);
      g.fillStyle = PAL.arcaneLit;
      g.fillRect(x - 1, y - 1, 3, 3);
    }
    g.restore();
  }
}

export const caveLife = new CaveLife();
