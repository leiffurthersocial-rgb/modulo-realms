import { PAL, shade, withAlpha } from '../art/palette';
import { getBuilding } from '../art/buildings';
import { getProp } from '../art/props';
import { menaceTier } from '../art/beasts';
import type { Enemy } from '../entities/enemy';
import { T, TILE, isWater } from '../world/tiles';
import type { GameMap } from '../world/map';
import { isMarine } from './marine';
import type { Game } from './game';

/**
 * Everything in the world that is alive but has nothing to do with the
 * game: chimney smoke, a fish breaking the surface, leaves off a maple in a
 * gust, fireflies over the grass, a tumbleweed across the Duneholt road, snow
 * in the Reach. It is pure decoration — nothing here is saved, nothing here
 * touches the simulation, and all of it can be thrown away on any frame.
 *
 * The renderer owns one of these and drives it from `game.now`, so a paused
 * game freezes it and nothing drifts while a menu is open.
 */

type Kind =
  | 'smoke' | 'leaf' | 'spark' | 'ember' | 'bird' | 'butterfly' | 'firefly'
  | 'drop' | 'dust' | 'breath' | 'snowclump' | 'mote' | 'ash' | 'bubble' | 'pigeon';

interface Mote {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  seed: number;
  gravity?: number;
}

interface Ripple { x: number; y: number; life: number; max: number; r: number }
interface Print { x: number; y: number; life: number; dx: number; dy: number; snow: boolean }
interface Fish { x0: number; y0: number; dir: number; t: number; dur: number; h: number; big: boolean; splashed: boolean }
/**
 * A tumbleweed: a ball of dead twigs (`twigs`, xyz triples on a unit sphere)
 * that rolls, wobbles, hops and squashes when it lands.
 */
interface Tumble { x: number; y: number; vx: number; z: number; vz: number; rot: number; r: number; life: number; twigs: Float32Array; squash: number; seed: number }
/** Something the dust devil has picked up: a twig or a dry leaf on a spiral. */
interface Debris { a: number; hy: number; rad: number; spd: number; color: string; big: boolean }
interface Devil { x: number; y: number; vx: number; vy: number; life: number; max: number; h: number; seed: number; bits: Debris[] }
/** A grain of blown sand, in the world like the snow: depth sets size, speed and parallax. */
interface Grain { x: number; y: number; depth: 0 | 1 | 2; vx: number; phase: number; amp: number }
/** A sand snake: a thin ribbon of sand skimming the dune surface in the wind. */
interface Streamer { x: number; y: number; len: number; phase: number; amp: number; life: number; max: number; v: number }
interface Glint { x: number; y: number; life: number }
/**
 * A snowflake that lives in the world, not on the glass. Depth sets its size,
 * brightness, fall speed and parallax; each one sways on its own clock.
 */
interface Flake { x: number; y: number; depth: 0 | 1 | 2; vy: number; phase: number; sway: number; land: number }

export type Climate = 'none' | 'meadow' | 'forest' | 'mire' | 'desert' | 'snow' | 'ash' | 'salt' | 'storm';

const CLIMATE: Record<string, Climate> = {
  central: 'meadow', west: 'forest', farwest: 'forest', east: 'mire', sunkenwest: 'mire',
  north: 'snow', deepnorth: 'snow', south: 'desert', farsouth: 'ash', emberdeep: 'ash',
  fareast: 'salt', stormeast: 'storm',
};

const LEAF_COLORS: Record<string, string[]> = {
  tree_maple: [PAL.flame, PAL.clay, '#c9602e'],
  tree_oak: [PAL.leafLit, PAL.leaf, PAL.grassPale],
  tree_birch: [PAL.grassPale, '#b9c460', PAL.grassLit],
  tree_willow: [PAL.swamp, PAL.rot],
  tree_ash: [PAL.ember, PAL.ash],
};

const BUTTERFLY = [PAL.cloth, PAL.goldLit, '#8fc0f0', PAL.flame, '#e87aa0'];

function hash(a: number, b = 0): number {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export interface View { left: number; top: number; w: number; h: number }

/**
 * The skeleton of a tumbleweed: a tangle of dead twigs laid as arcs over a
 * sphere, each with a couple of short forks bent inward. Built once per
 * tumbleweed; the renderer only rotates and plots it.
 */
function buildTwigs(seed: number): Float32Array {
  const pts: number[] = [];
  let n = 0;
  const rnd = () => hash(seed * 7.13 + n++, seed * 0.37);
  for (let t = 0; t < 14; t++) {
    // an axis anywhere on the sphere and two unit vectors across it
    const th = rnd() * Math.PI * 2;
    const ph = Math.acos(rnd() * 2 - 1);
    const ax = Math.sin(ph) * Math.cos(th), ay = Math.sin(ph) * Math.sin(th), az = Math.cos(ph);
    const [rx, ry, rz] = Math.abs(ax) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let ux = ay * rz - az * ry, uy = az * rx - ax * rz, uz = ax * ry - ay * rx;
    const ul = Math.hypot(ux, uy, uz);
    ux /= ul; uy /= ul; uz /= ul;
    const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
    const start = rnd() * Math.PI * 2;
    const len = 1.3 + rnd() * 1.7;
    const rad = t < 3 ? 0.45 + rnd() * 0.25 : 0.8 + rnd() * 0.2;
    const steps = 26;
    for (let s = 0; s <= steps; s++) {
      const a = start + (len * s) / steps;
      const wig = rad * (1 + Math.sin(s * 1.9 + t * 3) * 0.07);
      const px = (ux * Math.cos(a) + vx * Math.sin(a)) * wig;
      const py = (uy * Math.cos(a) + vy * Math.sin(a)) * wig;
      const pz = (uz * Math.cos(a) + vz * Math.sin(a)) * wig;
      pts.push(px, py, pz);
      if (s === 8 || s === 17) {
        const side = s === 8 ? 1 : -1;
        for (let k = 1; k <= 6; k++) {
          const f = 1 - k * 0.07;
          pts.push(px * f + ax * side * k * 0.05, py * f + ay * side * k * 0.05, pz * f + az * side * k * 0.05);
        }
      }
    }
  }
  return new Float32Array(pts);
}

/** A pixel-row ellipse: the one soft shape the sandstorm is made of. */
function puff(g: CanvasRenderingContext2D, x: number, y: number, r: number, ry: number, wob: number): void {
  const n = Math.max(1, Math.round(ry));
  for (let yy = -n; yy <= n; yy++) {
    const q = 1 - (yy / (n + 0.5)) ** 2;
    if (q <= 0) continue;
    const half = Math.round(Math.sqrt(q) * r * (1 + 0.1 * Math.sin(yy * 0.9 + wob)));
    g.fillRect(Math.round(x) - half, Math.round(y) + yy, half * 2 + 1, 1);
  }
}

/**
 * Hoar frost for the blizzard: fern-like crystals growing in from the four
 * corners, built once as 1px strokes and scaled up whole.
 */
let frostCache: HTMLCanvasElement | null = null;
function frostPattern(): HTMLCanvasElement {
  if (frostCache) return frostCache;
  const c = document.createElement('canvas');
  c.width = 100;
  c.height = 100;
  const g = c.getContext('2d')!;
  // six ferns per corner: a straight spine with 45 degree barbs that
  // shorten toward the tip, a white tip, a dark contrast pixel outside
  const fern = (x0: number, y0: number, a: number, len: number) => {
    for (let i = 0; i < len; i++) {
      const x = Math.round(x0 + Math.cos(a) * i);
      const y = Math.round(y0 + Math.sin(a) * i);
      g.fillStyle = 'rgba(40,56,80,0.5)';
      g.fillRect(x + 1, y + 1, 1, 1);
      g.fillStyle = i > len - 3 ? '#ffffff' : 'rgba(210,236,248,0.95)';
      g.fillRect(x, y, 1, 1);
      if (i > 2 && i % 3 === 0) {
        const barb = Math.round((len - i) * 0.35);
        for (const side of [-1, 1]) {
          for (let j = 1; j <= barb; j++) {
            g.fillStyle = 'rgba(190,226,244,0.85)';
            g.fillRect(Math.round(x + Math.cos(a + side * 0.8) * j), Math.round(y + Math.sin(a + side * 0.8) * j), 1, 1);
          }
        }
      }
    }
  };
  [0.12, 0.38, 0.62, 0.85, 1.1, 1.36].forEach((a, i) => fern(0, 0, a, [70, 52, 86, 60, 78, 50][i]));
  frostCache = c;
  return c;
}

export class Ambience {
  private motes: Mote[] = [];
  private ripples: Ripple[] = [];
  private prints: Print[] = [];
  private fish: Fish[] = [];
  private tumbles: Tumble[] = [];
  private devils: Devil[] = [];
  private glints: Glint[] = [];
  private flakes: Flake[] = [];
  private grains: Grain[] = [];
  private streamers: Streamer[] = [];
  /** How far the sandstorm's dust clouds have drifted downwind, world px. */
  private sandDrift = 0;
  private camDx = 0;
  private camDy = 0;
  private view: View = { left: 0, top: 0, w: 0, h: 0 };
  private lastCam = { x: NaN, y: NaN };
  private last = -1;
  private mapId = '';
  private startled = new Set<number>();
  private nextFish = 3;
  private nextTumble = 4;
  private nextDevil = 12;
  private nextVisitor = 0;
  private lastPrint = { x: 0, y: 0, side: 1 };
  private nextBreath = 0;
  private enemyCols = new WeakMap<Enemy, number>();
  /** 0..1, ramps in and out: a sandstorm in the desert, a blizzard in the snow. */
  storm = 0;
  private stormTarget = 0;
  private stormUntil = 0;
  private nextStorm = 70;
  climate: Climate = 'none';
  /** Current wind, pixels per second, positive = east. */
  wind = 10;

  private drawFrost(g: CanvasRenderingContext2D, w: number, h: number, k: number, s: number): void {
    const f = frostPattern();
    const size = Math.round(f.width * k * (0.6 + s * 0.6));
    g.save();
    g.globalAlpha = Math.min(1, s * 1.1);
    g.imageSmoothingEnabled = false;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      g.save();
      g.translate(sx > 0 ? 0 : w, sy > 0 ? 0 : h);
      g.scale(sx, sy);
      g.drawImage(f, 0, 0, size, size);
      g.restore();
    }
    g.restore();
  }

  /** A travelling pulse across the map: the gust the trees and the smoke all feel. */
  gust(x: number, now: number): number {
    const k = Math.sin(now * 0.32 - x * 0.0035);
    return k > 0.82 ? (k - 0.82) / 0.18 : 0;
  }

  /** Canopy offset in whole pixels for a tree at (x, y). */
  treeSway(x: number, y: number, now: number, amp: number): number {
    const base = Math.sin(now * 0.9 + x * 0.013 + y * 0.007) * 0.7;
    const g = this.gust(x, now) * 1.6;
    const storm = this.storm * Math.sin(now * 3.1 + x * 0.05) * 1.2;
    return Math.round((base + g + storm) * amp);
  }

  private spawn(m: Omit<Mote, 'seed'> & { seed?: number }): void {
    if (this.motes.length > 520) return;
    this.motes.push({ seed: Math.random() * 1000, ...m });
  }

  /* ---------------------------------------------------------------- */

  update(game: Game, view: View, propIdx: number[]): void {
    const now = game.now;
    const map = game.map;
    if (map.id !== this.mapId) {
      this.mapId = map.id;
      this.motes.length = 0; this.ripples.length = 0; this.prints.length = 0;
      this.fish.length = 0; this.tumbles.length = 0; this.devils.length = 0; this.startled.clear(); this.flakes.length = 0;
      this.grains.length = 0; this.streamers.length = 0;
    }
    let dt = this.last < 0 ? 0 : now - this.last;
    this.last = now;
    if (dt <= 0 || dt > 0.25) dt = dt > 0.25 ? 0.05 : 0;
    const overworld = map.id === 'overworld';
    const region = overworld ? game.regionAtPlayer() : undefined;
    this.climate = overworld && region ? CLIMATE[region] ?? 'none' : 'none';
    const hour = game.hour;
    const night = game.nightFactor;
    const day = map.outdoor && hour > 6.5 && hour < 19;
    this.wind = 10 + this.gust(game.player.x, now) * 26 + this.storm * 90;

    this.updateStorm(now, dt);
    if (dt > 0) {
      this.spawnFromProps(game, map, view, propIdx, dt, now, night);
      if (map.outdoor) {
        this.spawnWater(game, map, view, dt, now, day);
        this.spawnLife(game, map, view, dt, now, day, night);
        this.spawnClimate(game, map, view, dt, now);
        this.spawnPlayerTrail(game, map, dt, now);
      }
    }
    this.player = game.player;
    this.view = view;
    const camX = view.left + view.w / 2;
    const camY = view.top + view.h / 2;
    this.camDx = Number.isNaN(this.lastCam.x) ? 0 : camX - this.lastCam.x;
    this.camDy = Number.isNaN(this.lastCam.y) ? 0 : camY - this.lastCam.y;
    this.lastCam.x = camX; this.lastCam.y = camY;
    const jumped = Math.abs(this.camDx) > 200 || Math.abs(this.camDy) > 200;
    if (jumped) { this.flakes.length = 0; this.grains.length = 0; }
    this.stepSnow(game, map, view, dt, now);
    this.stepSand(map, view, dt, now);
    this.step(dt, now, map);
  }

  private updateStorm(now: number, dt: number): void {
    const stormy = this.climate === 'desert' || this.climate === 'snow';
    if (!stormy) { this.stormTarget = 0; this.nextStorm = Math.max(this.nextStorm, now + 60); }
    else if (this.stormTarget === 0 && now > this.nextStorm) {
      // rare: a storm every few minutes at most, and it passes
      this.stormTarget = 1;
      this.stormUntil = now + 28 + Math.random() * 30;
    } else if (this.stormTarget === 1 && now > this.stormUntil) {
      this.stormTarget = 0;
      this.nextStorm = now + 150 + Math.random() * 180;
    }
    const rate = 0.14 * dt;
    this.storm += Math.max(-rate, Math.min(rate, this.stormTarget - this.storm));
    if (this.storm < 0.001) this.storm = 0;
  }

  private spawnFromProps(game: Game, map: GameMap, view: View, propIdx: number[], dt: number, now: number, night: number): void {
    const p = game.player;
    for (const i of propIdx) {
      const prop = map.props[i];
      if (prop.x < view.left - 60 || prop.x > view.left + view.w + 60 || prop.y < view.top - 40 || prop.y > view.top + view.h + 220) continue;
      const art = prop.art;
      if (art.startsWith('bld:')) {
        const b = getBuilding(art.slice(4));
        if (!b.chimney) continue;
        // A chimney smokes in sessions: now and then, for a while, then not.
        const slot = Math.floor(now / 45 + hash(prop.x, prop.y) * 7);
        if (hash(prop.x + slot * 3.1, prop.y) > 0.3 + night * 0.25) continue;
        if (Math.random() > dt * 3) continue;
        const cx = prop.x - b.w / 2 + b.chimney[0];
        const cy = prop.y - b.h + 4 - (b.padTop ?? 0) + b.chimney[1];
        this.spawn({ kind: 'smoke', x: cx + (Math.random() - 0.5) * 2, y: cy, vx: 0, vy: -8, life: 0, max: 4.5 + Math.random() * 2, size: 1, color: Math.random() < 0.5 ? '#8f8a99' : '#6f6a7a' });
        continue;
      }
      switch (art) {
        case 'forge':
          if (Math.random() < dt * 5) this.spawn({ kind: 'spark', x: prop.x + (Math.random() - 0.5) * 12, y: prop.y - 12, vx: (Math.random() - 0.5) * 50, vy: -50 - Math.random() * 50, life: 0, max: 0.5 + Math.random() * 0.5, size: 1, color: Math.random() < 0.5 ? PAL.flameLit : PAL.flame, gravity: 120 });
          if (Math.random() < dt * 1.2) this.spawn({ kind: 'smoke', x: prop.x, y: prop.y - 44, vx: 0, vy: -12, life: 0, max: 3.5, size: 2, color: '#5d5866' });
          break;
        case 'torch':
        case 'brazier':
        case 'campfire': {
          const top = art === 'torch' ? 26 : art === 'brazier' ? 24 : 10;
          if (Math.random() < dt * (art === 'campfire' ? 2.5 : 1.2)) this.spawn({ kind: 'ember', x: prop.x + (Math.random() - 0.5) * 6, y: prop.y - top, vx: (Math.random() - 0.5) * 10, vy: -22 - Math.random() * 20, life: 0, max: 0.9 + Math.random() * 0.8, size: 1, color: Math.random() < 0.6 ? PAL.flameLit : PAL.flame });
          if (art === 'campfire' && Math.random() < dt * 1.5) this.spawn({ kind: 'smoke', x: prop.x, y: prop.y - 16, vx: 0, vy: -14, life: 0, max: 3, size: 2, color: '#6f6a7a' });
          break;
        }
        case 'cauldron':
          if (Math.random() < dt * 0.8) this.spawn({ kind: 'bubble', x: prop.x + (Math.random() - 0.5) * 12, y: prop.y - 26, vx: 0, vy: -9, life: 0, max: 2.2, size: 2, color: PAL.toxic });
          break;
        case 'tree_oak': case 'tree_maple': case 'tree_birch': case 'tree_willow': case 'tree_ash': case 'tree_pine_snow': {
          const pa = getProp(art);
          const g = this.gust(prop.x, now);
          // leaves come off in the gusts, and off the maples all the time
          const rate = (art === 'tree_maple' ? 0.05 : 0.018) + g * 0.35 + this.storm * 0.4;
          if (Math.random() < dt * rate) {
            const cx = prop.x + (Math.random() - 0.5) * pa.fw * 0.7;
            const cy = prop.y - pa.anchorY + pa.fh * (0.2 + Math.random() * 0.3);
            if (art === 'tree_pine_snow') this.spawn({ kind: 'snowclump', x: cx, y: cy, vx: this.wind * 0.3, vy: 12, life: 0, max: 1.4, size: 2, color: PAL.snow, gravity: 40 });
            else {
              const cols = LEAF_COLORS[art];
              this.spawn({ kind: 'leaf', x: cx, y: cy, vx: 0, vy: 9 + Math.random() * 6, life: 0, max: 4 + Math.random() * 3, size: 1, color: cols[Math.floor(Math.random() * cols.length)] });
            }
          }
          // walk under a tree and sometimes something in it leaves
          if (art !== 'tree_ash' && art !== 'tree_pine_snow') {
            const d = Math.hypot(p.x - prop.x, p.y - prop.y);
            if (d < 70 && !this.startled.has(i)) {
              this.startled.add(i);
              if (hash(i, Math.floor(now / 120)) < 0.2) {
                const n = 2 + Math.floor(Math.random() * 3);
                const away = Math.atan2(prop.y - p.y, prop.x - p.x);
                for (let k = 0; k < n; k++) {
                  const a = away + (Math.random() - 0.5) * 1.2;
                  this.spawn({ kind: 'bird', x: prop.x + (Math.random() - 0.5) * 16, y: prop.y - pa.anchorY + pa.fh * 0.3, vx: Math.cos(a) * 70, vy: Math.sin(a) * 40 - 30, life: 0, max: 3.5, size: 1, color: Math.random() < 0.5 ? PAL.charcoal : '#4a3a2e' });
                }
              }
            } else if (d > 240) this.startled.delete(i);
          }
          break;
        }
        case 'mushroom_cluster':
          if (night > 0.4 && Math.random() < dt * 0.25) this.spawn({ kind: 'mote', x: prop.x + (Math.random() - 0.5) * 12, y: prop.y - 8, vx: 0, vy: -5, life: 0, max: 2.5, size: 1, color: '#9fe6c8' });
          break;
        default:
          break;
      }
    }
  }

  private waterAt(map: GameMap, tx: number, ty: number): boolean {
    if (tx < 1 || ty < 1 || tx >= map.w - 1 || ty >= map.h - 1) return false;
    const id = map.tiles[ty * map.w + tx];
    return isWater(id) && !isMarine(id) && id !== T.SWAMP_WATER;
  }

  private spawnWater(game: Game, map: GameMap, view: View, dt: number, now: number, day: boolean): void {
    const tryWater = (): { x: number; y: number } | null => {
      for (let n = 0; n < 40; n++) {
        const tx = Math.floor((view.left + Math.random() * view.w) / TILE);
        const ty = Math.floor((view.top + Math.random() * view.h) / TILE);
        if (this.waterAt(map, tx, ty) && this.waterAt(map, tx + 1, ty) && this.waterAt(map, tx - 1, ty) && this.waterAt(map, tx, ty + 1)) {
          return { x: tx * TILE + 6 + Math.random() * 20, y: ty * TILE + 8 + Math.random() * 16 };
        }
      }
      return null;
    };
    if (now > this.nextFish) {
      this.nextFish = now + 3.5 + Math.random() * 7;
      const at = tryWater();
      if (!at) this.nextFish = now + 0.6;
      else {
        const big = Math.random() < 0.12;
        this.fish.push({ x0: at.x, y0: at.y, dir: Math.random() < 0.5 ? -1 : 1, t: 0, dur: big ? 1.25 : 0.9, h: big ? 18 : 11, big, splashed: false });
        this.splash(at.x, at.y, big ? 1.4 : 1);
      }
    }
    // sun on the water: short bright glints that blink and drift
    if (day && Math.random() < dt * 9 && this.glints.length < 40) {
      const at = tryWater();
      if (at) this.glints.push({ x: Math.round(at.x), y: Math.round(at.y), life: 0 });
    }
    // water striders and rising bubbles: small rings now and then
    if (Math.random() < dt * 1.2) {
      const at = tryWater();
      if (at) this.ripples.push({ x: at.x, y: at.y, life: 0, max: 1.4, r: 5 });
    }
    // dragonflies patrol the water by day
    if (day && game.nightFactor < 0.3 && this.climate !== 'snow' && Math.random() < dt * 0.2 && this.motes.filter((m) => m.kind === 'mote' && m.color === '#6fd0e8').length < 2) {
      const at = tryWater();
      if (at) this.spawn({ kind: 'mote', x: at.x, y: at.y - 10, vx: 0, vy: 0, life: 0, max: 9, size: 2, color: '#6fd0e8', seed: now });
    }
  }

  private splash(x: number, y: number, k: number): void {
    this.ripples.push({ x, y, life: 0, max: 1.1 * k, r: 9 * k });
    this.ripples.push({ x, y, life: -0.18, max: 1.3 * k, r: 14 * k });
    this.ripples.push({ x, y, life: -0.45, max: 1.7 * k, r: 22 * k });
    for (let i = 0; i < 7 * k; i++) {
      const a = Math.PI + (i / (7 * k)) * Math.PI;
      this.spawn({ kind: 'drop', x: x + Math.cos(a) * 3, y: y - 1, vx: Math.cos(a) * 30, vy: -35 - Math.random() * 45 * k, life: 0, max: 0.6, size: 1, color: i % 2 ? PAL.white : PAL.foam, gravity: 170 });
    }
  }

  private spawnLife(game: Game, map: GameMap, view: View, dt: number, now: number, day: boolean, night: number): void {
    const green = this.climate === 'meadow' || this.climate === 'forest' || this.climate === 'mire';
    if (!green || now < this.nextVisitor) return;
    this.nextVisitor = now + 0.15;
    const pick = (): { x: number; y: number; id: number } => {
      const x = view.left + Math.random() * view.w;
      const y = view.top + Math.random() * view.h;
      const id = map.tiles[Math.floor(y / TILE) * map.w + Math.floor(x / TILE)];
      return { x, y, id };
    };
    const count = (k: Kind) => { let n = 0; for (const m of this.motes) if (m.kind === k) n++; return n; };
    if (day && this.storm < 0.2 && count('butterfly') < 8) {
      const at = pick();
      if (at.id === T.FLOWERS || at.id === T.GRASS || at.id === T.GRASS_PALE || at.id === T.TALL_GRASS) {
        this.spawn({ kind: 'butterfly', x: at.x, y: at.y, vx: 0, vy: 0, life: 0, max: 14 + Math.random() * 10, size: 1, color: BUTTERFLY[Math.floor(Math.random() * BUTTERFLY.length)] });
      }
    }
    if (night > 0.35 && count('firefly') < 26) {
      const at = pick();
      if (at.id === T.GRASS || at.id === T.TALL_GRASS || at.id === T.GRASS_DARK || at.id === T.SWAMP_GROUND || at.id === T.FLOWERS) {
        this.spawn({ kind: 'firefly', x: at.x, y: at.y, vx: 0, vy: 0, life: 0, max: 8 + Math.random() * 8, size: 1, color: '#d8f07a' });
        // they come in little swarms
        for (let i = 0; i < 2; i++) this.spawn({ kind: 'firefly', x: at.x + (Math.random() - 0.5) * 40, y: at.y + (Math.random() - 0.5) * 30, vx: 0, vy: 0, life: 0, max: 8 + Math.random() * 8, size: 1, color: '#d8f07a' });
      }
    }
    // pigeons pecking on the paving in the valley, until you walk into them
    if (day && this.climate === 'meadow' && count('pigeon') < 7) {
      const at = pick();
      if (at.id === T.ROAD && Math.hypot(at.x - game.player.x, at.y - game.player.y) > 90) {
        for (let i = 0; i < 3; i++) this.spawn({ kind: 'pigeon', x: at.x + (Math.random() - 0.5) * 24, y: at.y + (Math.random() - 0.5) * 12, vx: 0, vy: 0, life: 0, max: 40, size: 1, color: Math.random() < 0.3 ? PAL.ash : PAL.fog });
      }
    }
    void dt;
  }

  private spawnClimate(game: Game, map: GameMap, view: View, dt: number, now: number): void {
    const c = this.climate;
    if (c === 'desert') {
      if (now > this.nextTumble && this.tumbles.length < 8) {
        this.nextTumble = now + (this.storm > 0.3 ? 0.8 + Math.random() * 1.4 : 6 + Math.random() * 10);
        const seed = Math.floor(Math.random() * 10000);
        const r = 7 + Math.floor(Math.random() * 4) + (this.storm > 0.5 && Math.random() < 0.4 ? 3 : 0);
        this.tumbles.push({ x: view.left - 24, y: view.top + 30 + Math.random() * (view.h - 60), vx: 40 + Math.random() * 30 + this.storm * 70, z: Math.random() * 20, vz: 30, rot: Math.random() * 6, r, life: 0, twigs: buildTwigs(seed), squash: 0, seed });
      }
      if (now > this.nextDevil && this.storm < 0.3 && !this.devils.length) {
        this.nextDevil = now + 18 + Math.random() * 24;
        const seed = Math.random() * 100;
        const bits: Debris[] = [];
        const cols = [PAL.woodDark, PAL.soil, PAL.clay, PAL.sandDark, PAL.wood];
        for (let i = 0; i < 26; i++) bits.push({ a: Math.random() * 6.28, hy: Math.random(), rad: 0.8 + Math.random() * 0.6, spd: 4 + Math.random() * 4, color: cols[i % cols.length], big: i % 4 === 0 });
        this.devils.push({ x: view.left + view.w * (0.1 + Math.random() * 0.5), y: view.top + view.h * (0.35 + Math.random() * 0.45), vx: 14 + Math.random() * 12, vy: (Math.random() - 0.5) * 10, life: 0, max: 12 + Math.random() * 8, h: 64 + Math.random() * 26, seed, bits });
      }
      // sand snakes: thin ribbons of sand racing over the dunes, many in a storm
      const gustK = Math.max(0, Math.sin(now * 0.9)) ** 3;
      if (this.streamers.length < 40 && Math.random() < dt * (0.6 + gustK * 3 + this.storm * 22)) {
        const x = view.left - 40 + Math.random() * (view.w + 40);
        const y = view.top + Math.random() * view.h;
        const id = map.tiles[Math.floor(y / TILE) * map.w + Math.floor(x / TILE)];
        if (id === T.SAND || id === T.DESERT_SAND) {
          this.streamers.push({ x, y, len: 18 + Math.random() * 40 + this.storm * 30, phase: Math.random() * 6.28, amp: 1 + Math.random() * 2, life: 0, max: 1.2 + Math.random() * 1.8, v: 60 + this.wind * 1.3 + Math.random() * 30 });
        }
      }
      // sand lifting off the ground in the wind
      if (Math.random() < dt * (0.8 + this.storm * 10)) this.spawn({ kind: 'dust', x: view.left + Math.random() * view.w, y: view.top + Math.random() * view.h, vx: this.wind * 1.2, vy: -2, life: 0, max: 1.4, size: 2, color: PAL.sandLit });
    } else if (c === 'snow') {
      // glints on the snow
      if (Math.random() < dt * 1.2 && this.glints.length < 6) {
        const x = view.left + Math.random() * view.w;
        const y = view.top + Math.random() * view.h;
        const id = map.tiles[Math.floor(y / TILE) * map.w + Math.floor(x / TILE)];
        if (id === T.SNOW || id === T.ICE) this.glints.push({ x: Math.round(x), y: Math.round(y), life: 0 });
      }
      // breath in the cold, for the player and anything close
      if (now > this.nextBreath) {
        this.nextBreath = now + 2.2 + Math.random();
        const p = game.player;
        const off = p.dir === 'left' ? -6 : p.dir === 'right' ? 6 : 0;
        const oy = p.dir === 'up' ? -30 : -24;
        for (let i = 0; i < 3; i++) this.spawn({ kind: 'breath', x: p.x + off, y: p.y + oy, vx: off * 2 + (Math.random() - 0.5) * 4, vy: -4, life: -i * 0.08, max: 1.1, size: 1, color: PAL.white });
        for (const e of game.enemies) {
          if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > 300 || Math.random() < 0.5) continue;
          const eo = e.dir === 'left' ? -10 : e.dir === 'right' ? 10 : 0;
          this.spawn({ kind: 'breath', x: e.x + eo * (e.def.scale ?? 1), y: e.y - 14 * (e.def.scale ?? 1), vx: eo * 1.5, vy: -4, life: 0, max: 1, size: 1, color: PAL.white });
        }
      }
    } else if (c === 'ash') {
      if (Math.random() < dt * 3) this.spawn({ kind: 'ember', x: view.left + Math.random() * view.w, y: view.top + view.h + 4, vx: (Math.random() - 0.5) * 8, vy: -18 - Math.random() * 14, life: 0, max: 5, size: 1, color: Math.random() < 0.5 ? PAL.ember : PAL.flame });
      if (Math.random() < dt * 10) this.spawn({ kind: 'ash', x: view.left + Math.random() * view.w, y: view.top - 4, vx: this.wind * 0.3, vy: 10 + Math.random() * 8, life: 0, max: view.h / 12, size: 1, color: Math.random() < 0.5 ? PAL.ash : PAL.fog });
    }
  }

  private spawnPlayerTrail(game: Game, map: GameMap, dt: number, now: number): void {
    const p = game.player;
    const d = Math.hypot(p.x - this.lastPrint.x, p.y - this.lastPrint.y);
    if (d > 60) { this.lastPrint.x = p.x; this.lastPrint.y = p.y; return; }
    if (d < 9) return;
    const dx = (p.x - this.lastPrint.x) / d;
    const dy = (p.y - this.lastPrint.y) / d;
    this.lastPrint.x = p.x; this.lastPrint.y = p.y;
    this.lastPrint.side = -this.lastPrint.side;
    const id = map.tiles[Math.floor(p.y / TILE) * map.w + Math.floor(p.x / TILE)];
    const snow = id === T.SNOW;
    const sand = id === T.SAND || id === T.DESERT_SAND;
    if (snow || sand) {
      this.prints.push({ x: p.x - dy * 3 * this.lastPrint.side, y: p.y + 4 + dx * 2 * this.lastPrint.side, life: 0, dx, dy, snow });
      if (this.prints.length > 70) this.prints.shift();
    }
    if (sand || id === T.DIRT || id === T.ROAD_DIRT || id === T.ASH_GROUND) {
      if (Math.random() < 0.5) this.spawn({ kind: 'dust', x: p.x - dx * 6, y: p.y + 5, vx: -dx * 10, vy: -6, life: 0, max: 0.6, size: 1, color: sand ? PAL.sandLit : id === T.ASH_GROUND ? PAL.ash : PAL.dirtLit });
    } else if (snow && Math.random() < 0.4) {
      this.spawn({ kind: 'dust', x: p.x - dx * 6, y: p.y + 5, vx: -dx * 8, vy: -8, life: 0, max: 0.5, size: 1, color: PAL.white });
    }
    void dt; void now;
  }

  /** Called by the renderer for each enemy it draws: footfalls and menace. */
  enemyFx(e: Enemy, col: number, now: number): void {
    const prev = this.enemyCols.get(e);
    this.enemyCols.set(e, col);
    const scale = e.def.scale ?? 1;
    const kind = e.def.creature?.kind;
    if (prev !== col && e.anim === 'walk' && (col === 3 || col === 6)) {
      if (kind === 'golem') {
        for (let i = 0; i < 4; i++) this.spawn({ kind: 'dust', x: e.x + (Math.random() - 0.5) * 16 * scale, y: e.y + 5, vx: (Math.random() - 0.5) * 30, vy: -8 - Math.random() * 6, life: 0, max: 0.7, size: 2, color: PAL.fog });
      } else if (kind === 'wolf' && Math.random() < 0.5 && (this.climate === 'desert' || this.climate === 'snow')) {
        this.spawn({ kind: 'dust', x: e.x, y: e.y + 5, vx: 0, vy: -6, life: 0, max: 0.5, size: 1, color: this.climate === 'snow' ? PAL.white : PAL.sandLit });
      }
    }
    if (kind === 'golem' && e.anim === 'attack' && prev !== col && col === 10) {
      for (let i = 0; i < 10; i++) this.spawn({ kind: 'dust', x: e.x + (Math.random() - 0.5) * 30 * scale, y: e.y + 4, vx: (Math.random() - 0.5) * 80, vy: -20 - Math.random() * 30, life: 0, max: 0.8, size: 2, color: PAL.fog, gravity: 60 });
    }
    // later creatures shed a little of whatever lights them
    const tier = e.def.creature ? menaceTier(e.def.level) : 0;
    if (tier >= 2 && !e.dead && Math.random() < 0.06 * tier) {
      const glow = e.def.creature?.glow ?? PAL.ember;
      this.spawn({ kind: 'mote', x: e.x + (Math.random() - 0.5) * 18 * scale, y: e.y - Math.random() * 20 * scale, vx: 0, vy: -14, life: 0, max: 1.2, size: 1, color: glow });
    }
    void now;
  }

  /* ---------------------------------------------------------------- */

  private player: { x: number; y: number } | null = null;

  private step(dt: number, now: number, map: GameMap): void {
    const wind = this.wind;
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.life += dt;
      if (m.life >= m.max) { this.motes.splice(i, 1); continue; }
      if (m.life < 0) continue;
      switch (m.kind) {
        case 'smoke':
          // rise straight at first, then lean over with the wind
          m.vx += ((m.life < 0.8 ? 0 : wind * 0.5) - m.vx) * dt * 0.8;
          m.vy = -8 - Math.min(1, m.life) * 4;
          m.size = 1 + m.life * 1.5;
          break;
        case 'leaf':
          m.vx = wind * 0.9 + Math.sin(now * 2 + m.seed) * 10;
          m.vy = 8 + Math.sin(now * 3 + m.seed) * 5;
          break;
        case 'bird':
          m.vy -= 12 * dt;
          break;
        case 'pigeon': {
          const pl = this.player;
          if (pl && Math.hypot(pl.x - m.x, pl.y - m.y) < 46) {
            const a = Math.atan2(m.y - pl.y, m.x - pl.x) + (Math.random() - 0.5);
            m.kind = 'bird'; m.vx = Math.cos(a) * 80; m.vy = Math.sin(a) * 40 - 40; m.life = 0; m.max = 3; m.color = PAL.ash;
          } else {
            // a few steps, a peck, a few steps
            const walk = Math.sin(now * 1.3 + m.seed) > 0.4;
            m.vx = walk ? Math.cos(m.seed + Math.floor(now / 2)) * 6 : 0;
            m.vy = walk ? Math.sin(m.seed + Math.floor(now / 2)) * 3 : 0;
          }
          break;
        }
        case 'butterfly': {
          const a = Math.sin(now * 0.7 + m.seed) * 3 + m.seed;
          m.vx = Math.cos(a) * 14 + wind * 0.2;
          m.vy = Math.sin(a) * 8 + Math.sin(now * 6 + m.seed) * 10;
          break;
        }
        case 'firefly':
          m.vx = Math.sin(now * 0.8 + m.seed) * 8;
          m.vy = Math.cos(now * 0.6 + m.seed * 1.3) * 6;
          break;
        case 'mote':
          if (m.color === '#6fd0e8') {
            // a dragonfly: hovers, then darts
            const phase = Math.floor(now * 1.3 + m.seed);
            const dart = hash(phase, m.seed) < 0.35;
            m.vx = dart ? Math.cos(hash(phase, 1) * 6.3) * 90 : Math.sin(now * 9 + m.seed) * 3;
            m.vy = dart ? Math.sin(hash(phase, 2) * 6.3) * 50 : Math.cos(now * 7 + m.seed) * 2;
            const tx = Math.floor((m.x + m.vx * dt) / TILE);
            const ty = Math.floor((m.y + 10 + m.vy * dt) / TILE);
            if (!this.waterAt(map, tx, ty)) { m.vx = -m.vx; m.vy = -m.vy; }
          }
          break;
        case 'ember':
          m.vx += (Math.sin(now * 4 + m.seed) * 8 - m.vx) * dt;
          break;
        case 'ash':
          m.vx = wind * 0.4 + Math.sin(now + m.seed) * 6;
          break;
        default:
          break;
      }
      if (m.gravity) m.vy += m.gravity * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.life += dt;
      if (r.life >= r.max) this.ripples.splice(i, 1);
    }
    for (let i = this.prints.length - 1; i >= 0; i--) {
      const pr = this.prints[i];
      pr.life += dt * (1 + this.storm * 3);
      if (pr.life > 9) this.prints.splice(i, 1);
    }
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      f.t += dt;
      if (f.t >= f.dur && !f.splashed) {
        f.splashed = true;
        this.splash(f.x0 + f.dir * (f.big ? 20 : 14), f.y0, f.big ? 1.3 : 0.8);
      }
      if (f.t > f.dur + 0.1) this.fish.splice(i, 1);
    }
    for (let i = this.tumbles.length - 1; i >= 0; i--) {
      const t = this.tumbles[i];
      t.life += dt;
      // the wind, gusts and all, is what drives it: it speeds up in a gust
      // and coasts when it drops, and it never runs a straight line
      const target = 30 + this.wind * 0.7 + this.storm * 80 + (t.seed % 20);
      t.vx += (target - t.vx) * dt * (t.z > 0 ? 0.35 : 0.9);
      t.vz -= 280 * dt;
      t.z += t.vz * dt;
      t.squash = Math.max(0, t.squash - dt * 7);
      if (t.z <= 0) {
        const hit = -t.vz;
        t.z = 0;
        // mostly skipping hops, now and then a big bound off a hummock
        const big = Math.random() < 0.18 + this.storm * 0.25;
        t.vz = big ? 110 + Math.random() * 60 + this.storm * 70 : 25 + Math.random() * 45;
        if (hit > 40) {
          t.squash = Math.min(1, hit / 160);
          for (let k = 0; k < 3 + (big ? 3 : 0); k++) this.spawn({ kind: 'dust', x: t.x + (Math.random() - 0.5) * t.r * 1.6, y: t.y + 1, vx: t.vx * 0.2 + (Math.random() - 0.5) * 30, vy: -6 - Math.random() * 12, life: 0, max: 0.5 + Math.random() * 0.4, size: Math.random() < 0.4 ? 2 : 1, color: PAL.sandLit });
          // it sheds a twig on a hard landing
          if (Math.random() < 0.3) this.spawn({ kind: 'leaf', x: t.x, y: t.y - t.r, vx: t.vx * 0.5, vy: -10, life: 0, max: 1.4, size: 1, color: Math.random() < 0.5 ? PAL.sandDark : PAL.clay });
        }
      }
      t.x += t.vx * dt;
      t.y += Math.sin(t.life * 0.8 + t.seed) * 6 * dt;
      t.rot += (t.vx / t.r) * dt;
      if (t.life > 40 || t.x > this.view.left + this.view.w + 80) this.tumbles.splice(i, 1);
    }
    for (let i = this.devils.length - 1; i >= 0; i--) {
      const d = this.devils[i];
      d.life += dt;
      d.vy += (Math.sin(d.life * 0.6 + d.seed) * 8 - d.vy) * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      for (const b of d.bits) {
        b.a += b.spd * dt * (1.4 - b.hy * 0.6);
        b.hy += dt * 0.08 * b.spd * 0.25;
        if (b.hy > 1) { b.hy = 0; b.a = Math.random() * 6.28; }
      }
      // the foot of it scours the ground and throws sand out sideways
      const k = Math.min(1, d.life, d.max - d.life);
      if (k > 0 && Math.random() < dt * 22 * k) {
        const a = Math.random() * 6.28;
        this.spawn({ kind: 'dust', x: d.x + Math.cos(a) * 8, y: d.y + Math.sin(a) * 3, vx: -Math.sin(a) * 40 + d.vx, vy: -10 - Math.random() * 25, life: 0, max: 0.6 + Math.random() * 0.5, size: Math.random() < 0.3 ? 2 : 1, color: Math.random() < 0.5 ? PAL.sandLit : PAL.sand });
      }
      if (d.life > d.max) this.devils.splice(i, 1);
    }
    for (let i = this.streamers.length - 1; i >= 0; i--) {
      const st = this.streamers[i];
      st.life += dt;
      st.x += st.v * dt;
      if (st.life > st.max) this.streamers.splice(i, 1);
    }
    for (let i = this.glints.length - 1; i >= 0; i--) {
      this.glints[i].life += dt;
      if (this.glints[i].life > 0.5) this.glints.splice(i, 1);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Drawing                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Snowfall. Flakes are kept in world coordinates inside a box a little
   * larger than the view: when the player walks, the snow stays where it is
   * in the world and the nearest layer slides past a little faster, so the
   * fall has depth instead of sitting on the screen like static. Each flake
   * sways on its own slow clock, and the near ones settle when they land.
   */
  private stepSnow(game: Game, map: GameMap, view: View, dt: number, now: number): void {
    const snowing = this.climate === 'snow' && map.outdoor;
    const target = snowing ? Math.round(110 + this.storm * 170) : 0;
    const dcx = this.camDx;
    const dcy = this.camDy;
    const pad = 24;
    const spawn = (fill: boolean): Flake => {
      const r = Math.random();
      const depth: 0 | 1 | 2 = r < 0.45 ? 0 : r < 0.85 ? 1 : 2;
      const x = view.left - pad + Math.random() * (view.w + pad * 2);
      const y = fill ? view.top + Math.random() * view.h : view.top - pad + Math.random() * 10;
      return { x, y, depth, vy: [11, 17, 26][depth] * (0.8 + Math.random() * 0.4), phase: Math.random() * 6.28, sway: 3 + Math.random() * 5, land: view.top + view.h * (0.25 + Math.random() * 0.8) };
    };
    // new flakes (entering the Reach, or a blizzard building) appear all over the view
    while (this.flakes.length < target) this.flakes.push(spawn(true));
    if (this.flakes.length > target) this.flakes.length = target;
    if (dt <= 0) return;
    const wind = (this.wind - 10) * 0.35 + this.storm * 55;
    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[i];
      const k = [1, 1.12, 1.3][f.depth];
      // parallax: flakes are above the ground, so the nearer ones slide past
      // faster than the ground does when the camera moves
      f.x += dcx * (1 - k);
      f.y += dcy * (1 - k);
      const storm = 1 + this.storm * 1.6;
      f.x += (wind * (0.7 + f.depth * 0.2) + Math.cos(now * (0.7 + f.depth * 0.15) + f.phase) * f.sway * 0.9) * dt;
      f.y += f.vy * storm * dt;
      const out = f.x < view.left - pad - 20 || f.x > view.left + view.w + pad + 20 || f.y > view.top + view.h + pad;
      // near flakes settle where they land, on snow, as a dot that melts in
      if (f.depth === 2 && f.y > f.land && this.storm < 0.5) {
        const id = map.tiles[Math.floor(f.y / TILE) * map.w + Math.floor(f.x / TILE)];
        if (id === T.SNOW || id === T.ICE || id === T.SNOW_ROCK) this.spawn({ kind: 'dust', x: f.x, y: f.y, vx: 0, vy: 0, life: 0, max: 1.6, size: 1, color: PAL.white });
        this.flakes[i] = spawn(false);
        continue;
      }
      if (out) {
        const n = spawn(false);
        // re-enter from whichever side the wind is blowing from
        if (f.x < view.left - pad - 20 || f.x > view.left + view.w + pad + 20) {
          n.x = wind >= 0 ? view.left - pad : view.left + view.w + pad;
          n.y = view.top + Math.random() * view.h;
        }
        this.flakes[i] = n;
      }
    }
    void game;
  }

  /**
   * Blown sand, kept in the world like the snow. Grains ride the wind almost
   * level, lifting and dropping on their own slow clocks; the nearer layer
   * slides past faster when the camera moves. The dust clouds drift on
   * `sandDrift` so they too stay put in the world between gusts.
   */
  private stepSand(map: GameMap, view: View, dt: number, now: number): void {
    const blowing = this.climate === 'desert' && map.outdoor;
    const target = blowing ? Math.round(this.storm * 420) : 0;
    const pad = 30;
    const spawn = (fill: boolean): Grain => {
      const r = Math.random();
      const depth: 0 | 1 | 2 = r < 0.5 ? 0 : r < 0.85 ? 1 : 2;
      const x = fill ? view.left - pad + Math.random() * (view.w + pad * 2) : view.left - pad - Math.random() * 40;
      return { x, y: view.top - pad + Math.random() * (view.h + pad * 2), depth, vx: [170, 240, 330][depth] * (0.85 + Math.random() * 0.3), phase: Math.random() * 6.28, amp: 5 + Math.random() * 16 };
    };
    while (this.grains.length < target) this.grains.push(spawn(true));
    if (this.grains.length > target) this.grains.length = target;
    if (dt <= 0) return;
    this.sandDrift += (this.wind * 0.45 + this.storm * 45) * dt;
    const gustK = Math.max(0, Math.sin(now * 0.9)) ** 3;
    const push = 0.45 + this.storm * 0.75 + gustK * 0.35;
    for (let i = 0; i < this.grains.length; i++) {
      const f = this.grains[i];
      const k = [1, 1.15, 1.35][f.depth];
      f.x += this.camDx * (1 - k);
      f.y += this.camDy * (1 - k);
      f.x += f.vx * push * dt;
      f.y += (Math.sin(now * (1.6 + f.depth * 0.5) + f.phase) * f.amp + 4) * dt;
      if (f.x > view.left + view.w + pad || f.x < view.left - pad - 60 || f.y < view.top - pad - 20 || f.y > view.top + view.h + pad + 20) this.grains[i] = spawn(false);
    }
  }

  /**
   * The sandstorm itself, in the air layer: rolling clouds of dust that drift
   * downwind in the world, thickening in the gusts, and the grains in front.
   * Everything is whole pixels and horizontal; nothing is a diagonal stroke.
   */
  drawSand(g: CanvasRenderingContext2D, now: number): void {
    const s = this.storm;
    if (this.climate !== 'desert' || (s < 0.02 && !this.grains.length)) return;
    const view = this.view;
    const gustK = Math.max(0, Math.sin(now * 0.9)) ** 3;
    g.save();
    if (s > 0.02) {
      const cell = 190;
      const drift = this.sandDrift;
      const x0 = Math.floor((view.left - drift - cell * 2) / cell);
      const x1 = Math.floor((view.left + view.w - drift + cell) / cell);
      const y0 = Math.floor((view.top - cell) / cell);
      const y1 = Math.floor((view.top + view.h + cell) / cell);
      const a = s * (0.3 + gustK * 0.12);
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          if (hash(cx, cy + 3) > 0.3 + s * 0.5) continue;
          const bx = cx * cell + hash(cx, cy) * cell * 0.6 + drift;
          const by = cy * cell + hash(cx + 5, cy) * cell * 0.6 + Math.sin(now * 0.5 + cx) * 6;
          const rx = 50 + hash(cx * 2, cy) * 60;
          // a billow of five lobes that turn over slowly, piled higher in the
          // middle, each in four hard tones: brown underside, ochre body,
          // sand, and a lit crest on the upwind top
          for (let k = 0; k < 5; k++) {
            const u = k / 4 - 0.5;
            const ox = u * rx * 1.5 + Math.cos(now * 0.7 + k * 2.1 + cx) * 8;
            const oy = Math.sin(now * 0.55 + k + cy) * 5 - (1 - Math.abs(u) * 2) * rx * 0.22;
            const r = rx * (0.62 - Math.abs(u) * 0.35);
            const wob = cx * 3 + k + now * 1.5;
            g.globalAlpha = a;
            g.fillStyle = PAL.dirtLit;
            puff(g, bx + ox + 3, by + oy + r * 0.25, r, r * 0.5, wob);
            g.fillStyle = PAL.sandDark;
            puff(g, bx + ox, by + oy, r * 0.9, r * 0.46, wob);
            g.fillStyle = PAL.sand;
            puff(g, bx + ox - r * 0.12, by + oy - r * 0.12, r * 0.68, r * 0.32, wob + 0.5);
            g.globalAlpha = a * 1.2;
            g.fillStyle = PAL.sandLit;
            puff(g, bx + ox - r * 0.25, by + oy - r * 0.24, r * 0.38, r * 0.16, wob + 1);
          }
        }
      }
    }
    // grains: dark ones and bright ones, so they read against the dunes
    // and against the dust alike; all of them level, the near ones long
    for (const f of this.grains) {
      const x = Math.round(f.x);
      const y = Math.round(f.y);
      const bright = f.phase > 2.6;
      if (f.depth === 0) {
        g.globalAlpha = 0.75;
        g.fillStyle = bright ? PAL.sandLit : PAL.dirtLit;
        g.fillRect(x, y, 1, 1);
      } else if (f.depth === 1) {
        g.globalAlpha = 0.55;
        g.fillStyle = PAL.dirt;
        g.fillRect(x, y + 1, 2, 1);
        g.globalAlpha = 1;
        g.fillStyle = bright ? PAL.cloth : PAL.sandDark;
        g.fillRect(x, y, 2, 1);
      } else {
        g.globalAlpha = 0.6;
        g.fillStyle = PAL.dirt;
        g.fillRect(x - 3, y + 1, 5, 1);
        g.globalAlpha = 1;
        g.fillStyle = PAL.sandLit;
        g.fillRect(x - 3, y, 3, 1);
        g.fillStyle = PAL.cloth;
        g.fillRect(x, y, 2, 1);
      }
    }
    g.restore();
  }

  /** Snowflakes in world pixels: far ones a dim dot, near ones a little cross. */
  drawSnow(g: CanvasRenderingContext2D, now: number): void {
    if (!this.flakes.length) return;
    g.save();
    for (const f of this.flakes) {
      const x = Math.round(f.x);
      const y = Math.round(f.y);
      // every flake carries one cool shadow pixel under its lower right, so
      // it still reads against the snow it is falling onto
      if (f.depth === 0) {
        g.globalAlpha = 0.35;
        g.fillStyle = '#6f84a4';
        g.fillRect(x + 1, y + 1, 1, 1);
        g.globalAlpha = 0.8;
        g.fillStyle = '#e4ecf6';
        g.fillRect(x, y, 1, 1);
      } else if (f.depth === 1) {
        const wide = Math.sin(now * 2.5 + f.phase) > 0.2;
        g.globalAlpha = 0.5;
        g.fillStyle = '#6f84a4';
        g.fillRect(x, y + 1, wide ? 3 : 2, 1);
        g.globalAlpha = 1;
        g.fillStyle = PAL.white;
        g.fillRect(x, y, wide ? 2 : 1, 1);
        if (!wide) g.fillRect(x, y - 1, 1, 1);
      } else {
        g.globalAlpha = 0.55;
        g.fillStyle = '#6f84a4';
        g.fillRect(x - 1, y + 2, 3, 1);
        g.fillRect(x + 2, y, 1, 2);
        g.globalAlpha = 0.9;
        g.fillStyle = '#e4ecf6';
        g.fillRect(x - 1, y, 3, 1);
        g.fillRect(x, y - 1, 1, 3);
        g.globalAlpha = 1;
        g.fillStyle = PAL.white;
        g.fillRect(x, y, 1, 1);
      }
    }
    g.restore();
  }

  /** Ground layer, under everything that stands: ripples, prints, cloud shade. */
  drawGround(g: CanvasRenderingContext2D, game: Game, view: View): void {
    const now = game.now;
    g.save();
    for (const r of this.ripples) {
      if (r.life < 0) continue;
      const k = r.life / r.max;
      const rr = Math.max(1, Math.round(r.r * k));
      g.globalAlpha = (1 - k) * 0.7;
      g.fillStyle = PAL.foam;
      // a pixel ellipse outline, eight arcs of two pixels
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        g.fillRect(Math.round(r.x + Math.cos(ang) * rr), Math.round(r.y + Math.sin(ang) * rr * 0.45), 2, 1);
      }
    }
    for (const pr of this.prints) {
      g.globalAlpha = Math.max(0, 1 - pr.life / 9) * (pr.snow ? 0.4 : 0.3);
      g.fillStyle = pr.snow ? '#7f93ad' : PAL.sandDark;
      g.fillRect(Math.round(pr.x), Math.round(pr.y), 2, 2);
      g.fillRect(Math.round(pr.x + pr.dx * 3), Math.round(pr.y + pr.dy * 3), 2, 1);
    }
    for (const gl of this.glints) {
      const k = gl.life / 0.5;
      g.globalAlpha = 1 - Math.abs(k - 0.5) * 2;
      g.fillStyle = PAL.white;
      g.fillRect(gl.x, gl.y, 1, 1);
      if (k > 0.3 && k < 0.7) { g.fillRect(gl.x - 1, gl.y, 3, 1); g.fillRect(gl.x, gl.y - 1, 1, 3); }
    }
    // sand snakes: a raised ribbon of lit sand with its own shadow under it,
    // wriggling as it runs; a second, fainter strand beside most of them
    for (const st of this.streamers) {
      const fade = Math.min(1, st.life * 4, (st.max - st.life) * 2);
      for (let strand = 0; strand < 2; strand++) {
        const len = strand ? Math.round(st.len * 0.6) : Math.round(st.len);
        const oy = strand ? 3 : 0;
        const ph = st.phase + strand * 1.7;
        for (let j = 0; j < len; j++) {
          const tail = j / len;
          const px = Math.round(st.x - j - strand * 6);
          const py = Math.round(st.y + oy + Math.sin(j * 0.11 + ph + now * 5) * st.amp + Math.sin(j * 0.31 + ph) * 0.6);
          const a = fade * (1 - tail) * (strand ? 0.45 : 0.8);
          g.globalAlpha = a * 0.7;
          g.fillStyle = PAL.dirtLit;
          g.fillRect(px, py + 1, 1, 1);
          g.globalAlpha = a;
          g.fillStyle = tail < 0.25 ? PAL.cloth : PAL.sandLit;
          g.fillRect(px, py, 1, 1);
        }
      }
    }
    // vultures turning over the dunes: a shadow on the sand, the bird far above it
    if (this.climate === 'desert' && game.nightFactor < 0.5) {
      for (let v = 0; v < 2; v++) {
        const ang = now * (0.35 + v * 0.1) + v * 3;
        const cx = view.left + view.w * (0.35 + 0.3 * v);
        const cy = view.top + view.h * (0.35 + 0.2 * v);
        const x = Math.round(cx + Math.cos(ang) * 70);
        const y = Math.round(cy + Math.sin(ang) * 30);
        const flap = Math.floor(now * 3 + v) % 5 === 0;
        g.globalAlpha = 0.16;
        g.fillStyle = '#1a1208';
        g.fillRect(x - 5, y + (flap ? -1 : 0), 4, 1); g.fillRect(x + 2, y + (flap ? -1 : 0), 4, 1); g.fillRect(x - 1, y, 3, 2);
        g.globalAlpha = 0.9;
        g.fillStyle = PAL.charcoal;
        const bx = x - 40;
        const by = y - 90;
        g.fillRect(bx - 5, by + (flap ? -2 : -1), 2, 1); g.fillRect(bx - 3, by, 3, 1);
        g.fillRect(bx + 4, by + (flap ? -2 : -1), 2, 1); g.fillRect(bx + 1, by, 3, 1);
        g.fillRect(bx, by, 1, 2);
      }
    }
    g.restore();
    this.drawCloudShadows(g, game, view);
  }

  /**
   * Big soft shadows of clouds you never see, drifting over the valley on
   * the wind. The ground stops being one flat light the moment they move.
   */
  private drawCloudShadows(g: CanvasRenderingContext2D, game: Game, view: View): void {
    if (game.map.id !== 'overworld' || this.climate === 'none') return;
    const h = game.hour;
    const light = h > 6 && h < 19.5 ? Math.min(1, (h - 6) / 1.5, (19.5 - h) / 1.5) : 0;
    if (light <= 0) return;
    const cell = 620;
    const drift = game.now * 9;
    const x0 = Math.floor((view.left + drift - cell) / cell);
    const x1 = Math.floor((view.left + view.w + drift + cell) / cell);
    const y0 = Math.floor((view.top - cell) / cell);
    const y1 = Math.floor((view.top + view.h + cell) / cell);
    g.save();
    g.fillStyle = '#0a0d18';
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (hash(cx, cy) > 0.45) continue;
        const bx = cx * cell + hash(cx, cy + 9) * cell * 0.5 - drift;
        const by = cy * cell + hash(cx + 9, cy) * cell * 0.5;
        g.globalAlpha = 0.07 * light;
        g.beginPath();
        for (let k = 0; k < 4; k++) {
          const rx = 70 + hash(cx * 3 + k, cy) * 90;
          const ry = rx * 0.45;
          const ox = (k - 1.5) * 55;
          const oy = (hash(cx, cy * 5 + k) - 0.5) * 50;
          g.ellipse(Math.round(bx + ox), Math.round(by + oy), rx, ry, 0, 0, Math.PI * 2);
        }
        g.fill();
      }
    }
    g.restore();
  }

  /** Things that stand on the ground and must sort with props: tumbleweeds, dust devils, jumping fish. */
  pushDrawables(out: Array<{ y: number; draw: () => void }>, g: CanvasRenderingContext2D): void {
    for (const t of this.tumbles) {
      out.push({ y: t.y, draw: () => this.drawTumble(g, t) });
    }
    for (const d of this.devils) {
      out.push({ y: d.y, draw: () => this.drawDevil(g, d) });
    }
    for (const f of this.fish) {
      out.push({ y: f.y0 - 2, draw: () => this.drawFish(g, f) });
    }
  }

  private drawTumble(g: CanvasRenderingContext2D, t: Tumble): void {
    g.save();
    // the shadow stays on the ground, shrinking and fading as it bounds up
    const lift = Math.min(1, t.z / 70);
    const sw = Math.max(4, Math.round(t.r * 2 * (1 - lift * 0.45)));
    g.globalAlpha = 0.4 * (1 - lift * 0.6);
    g.fillStyle = '#0a0810';
    g.fillRect(Math.round(t.x - sw / 2), Math.round(t.y), sw, 1);
    g.fillRect(Math.round(t.x - sw / 2 + 1), Math.round(t.y + 1), Math.max(1, sw - 2), 1);
    // squashes wide on a hard landing and springs back
    const sx = t.r * (1 + t.squash * 0.14);
    const sy = t.r * (1 - t.squash * 0.2);
    const cx = t.x;
    const cy = t.y - t.z - sy;
    // roll about the axis across the wind, wobble about the vertical
    const cr = Math.cos(t.rot), sr = Math.sin(t.rot);
    const w = Math.sin(t.life * 1.7 + t.seed) * 0.55;
    const cw = Math.cos(w), swb = Math.sin(w);
    const tw = t.twigs;
    // back twigs first, dark, seen through the gaps; lit ones in front
    const buckets: number[][] = [[], [], [], [], []];
    for (let i = 0; i < tw.length; i += 3) {
      const x0 = tw[i], y0 = tw[i + 1], z0 = tw[i + 2];
      const x1 = x0 * cr - y0 * sr;
      const y1 = x0 * sr + y0 * cr;
      const x2 = x1 * cw + z0 * swb;
      const z2 = -x1 * swb + z0 * cw;
      const light = -x2 * 0.45 - y1 * 0.55 + z2 * 0.7;
      const b = z2 < -0.25 ? 0 : light > 0.62 ? 4 : light > 0.25 ? 3 : light > -0.15 ? 2 : 1;
      buckets[b].push(Math.round(cx + x2 * sx), Math.round(cy + y1 * sy));
    }
    const cols = [PAL.soilDark, PAL.soil, PAL.dirt, PAL.dirtLit, PAL.plankLit];
    const alpha = [0.75, 1, 1, 1, 1];
    for (let b = 0; b < 5; b++) {
      g.globalAlpha = alpha[b];
      g.fillStyle = cols[b];
      const pts = buckets[b];
      for (let i = 0; i < pts.length; i += 2) g.fillRect(pts[i], pts[i + 1], 1, 1);
    }
    g.restore();
  }

  /**
   * A dust devil: a twisting funnel of sand, narrow at the foot and flaring
   * at the top, its axis snaking in the wind. Helical bands of lit sand run
   * up it as it turns; twigs and dry leaves ride the spiral, bright where
   * they pass in front of the column, dim behind it.
   */
  private drawDevil(g: CanvasRenderingContext2D, d: Devil): void {
    const now = this.last;
    const fade = Math.max(0, Math.min(1, d.life * 0.8, (d.max - d.life) * 0.8));
    if (fade <= 0) return;
    const H = Math.round(d.h);
    const axis = (hN: number) => d.x + Math.sin(now * 1.2 + d.seed + hN * 2.6) * hN * 7 + hN * hN * 8;
    const halfW = (hN: number) => 3 + Math.pow(hN, 1.4) * 21 + Math.sin(now * 3 + hN * 8 + d.seed) * (1 + hN * 2);
    g.save();
    // shadow and the scoured ring on the ground
    g.globalAlpha = 0.28 * fade;
    g.fillStyle = '#0a0810';
    g.fillRect(Math.round(d.x - 7), Math.round(d.y), 14, 1);
    g.fillRect(Math.round(d.x - 5), Math.round(d.y + 1), 10, 1);
    const bit = (b: Debris, front: boolean) => {
      const hN = b.hy;
      const s = Math.sin(b.a);
      if ((s > 0) !== front) return;
      const x = Math.round(axis(hN) + Math.cos(b.a) * halfW(hN) * b.rad);
      const y = Math.round(d.y - hN * H + s * halfW(hN) * 0.25);
      g.globalAlpha = fade * (front ? 1 : 0.45) * Math.min(1, (1 - hN) * 4);
      g.fillStyle = b.color;
      const turn = Math.floor(b.a * 2) % 2 === 0;
      if (b.big) { g.fillRect(x - 1, y, 3, 1); g.fillRect(turn ? x + 1 : x - 1, y - 1, 1, 1); }
      else g.fillRect(x, y, turn ? 2 : 1, turn ? 1 : 2);
    };
    for (const b of d.bits) bit(b, false);
    // the skirt of sand at its foot
    for (let k = 0; k < 3; k++) {
      const a = now * 5 + k * 2.1 + d.seed;
      g.globalAlpha = fade * 0.35;
      g.fillStyle = k === 1 ? PAL.sandLit : PAL.sand;
      puff(g, d.x + Math.cos(a) * 6, d.y - 2 + Math.sin(a) * 2, 6 + k, 3, a);
    }
    // the funnel, row by row
    for (let yy = 0; yy < H; yy++) {
      const hN = yy / H;
      const ax = axis(hN);
      const hw = halfW(hN);
      const n = Math.max(1, Math.round(hw));
      const top = hN > 0.85 ? (1 - hN) / 0.15 : 1;
      for (let px = -n; px <= n; px++) {
        const u = px / (n + 0.5);
        const ang = Math.asin(Math.max(-1, Math.min(1, u)));
        const band = Math.sin(ang * 2.4 + now * 10 - hN * 13 + d.seed);
        const edge = 1 - Math.abs(u);
        // ragged, dithered edges; a solid core
        if (edge < 0.25 && (px + yy + Math.floor(now * 20)) % 2 === 0) continue;
        const a = fade * top * (0.45 + edge * 0.45) * (1 - hN * 0.35);
        g.globalAlpha = a;
        g.fillStyle = band > 0.6 ? (u < 0 ? PAL.cloth : PAL.sandLit) : band > -0.1 ? (u > 0.5 ? PAL.sandDark : PAL.sand) : band > -0.6 ? PAL.sandDark : PAL.dirtLit;
        g.fillRect(Math.round(ax + px), Math.round(d.y - yy), 1, 1);
      }
    }
    for (const b of d.bits) bit(b, true);
    g.restore();
  }

  private drawFish(g: CanvasRenderingContext2D, f: Fish): void {
    if (f.t < 0 || f.t > f.dur) return;
    const u = f.t / f.dur;
    // hang at the top of the leap a moment before falling back
    const k = u < 0.5 ? 0.5 - 0.5 * Math.pow(1 - u * 2, 1.6) : 0.5 + 0.5 * Math.pow(u * 2 - 1, 1.6);
    const reach = f.big ? 20 : 14;
    const x = Math.round(f.x0 + f.dir * reach * k);
    const y = Math.round(f.y0 - Math.sin(k * Math.PI) * f.h);
    // the body arcs with the jump: nose up on the way out, down on the way in
    const len = f.big ? 12 : 9;
    const tilt = k < 0.3 ? -1 : k > 0.7 ? 1 : 0;
    const back = f.big ? '#7a94aa' : '#8aa6bc';
    const belly = f.big ? '#c8d8dc' : '#dfeef2';
    g.save();
    g.globalAlpha = 0.3;
    g.fillStyle = PAL.deep;
    g.fillRect(x - 3, f.y0 + 1, 6, 1);
    g.globalAlpha = 1;
    for (let i = 0; i < len; i++) {
      const q = i / (len - 1);
      const px = x + Math.round((q - 0.5) * len) * f.dir;
      const py = y + Math.round(tilt * (q - 0.5) * 3);
      const edge = q < 0.15 || q > 0.85;
      g.fillStyle = back;
      g.fillRect(px, py, 1, edge ? 1 : 2);
      if (!edge) { g.fillStyle = belly; g.fillRect(px, py + 2, 1, f.big ? 2 : 1); }
    }
    // forked tail, a dark eye, one bright glint
    const tail = x - Math.round(len / 2 + 1) * f.dir;
    const ty = y - Math.round(tilt * 2);
    g.fillStyle = back;
    g.fillRect(tail, ty - 1, 1, 1); g.fillRect(tail, ty + 2, 1, 1);
    g.fillRect(tail - f.dir, ty - 2, 1, 1); g.fillRect(tail - f.dir, ty + 3, 1, 1);
    const head = x + Math.round(len / 2 - 1) * f.dir;
    g.fillStyle = PAL.ink;
    g.fillRect(head, y + Math.round(tilt * 1.5), 1, 1);
    g.fillStyle = PAL.white;
    g.fillRect(x - f.dir, y, 1, 1);
    g.restore();
  }

  /** The air layer, after everything standing: smoke, leaves, birds, weather bits. */
  drawAir(g: CanvasRenderingContext2D, now: number): void {
    g.save();
    for (const m of this.motes) {
      if (m.life < 0) continue;
      const k = m.life / m.max;
      const x = Math.round(m.x);
      const y = Math.round(m.y);
      switch (m.kind) {
        case 'smoke': {
          // a round puff in hard pixels, fading in three steps, not a haze
          const a = k < 0.12 ? 0.25 : k < 0.5 ? 0.45 : k < 0.8 ? 0.3 : 0.15;
          g.globalAlpha = a;
          g.fillStyle = m.color;
          const r = Math.min(7, 1 + Math.floor(m.size));
          for (let yy = -r; yy <= r; yy++) {
            const half = Math.round(Math.sqrt(Math.max(0, r * r - yy * yy + r * 0.5)));
            g.fillRect(x - half, y + yy, half * 2 + 1, 1);
          }
          // lit crescent on the upper left, shade underneath
          g.globalAlpha = a;
          g.fillStyle = '#c4bfcc';
          g.fillRect(x - r + 1, y - r + 1, Math.max(1, r), 1);
          g.fillRect(x - r, y - r + 2, 1, Math.max(1, r - 1));
          g.fillStyle = '#4e4a58';
          g.fillRect(x - Math.floor(r / 2), y + r, r + 1, 1);
          break;
        }
        case 'leaf': {
          g.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
          g.fillStyle = m.color;
          const flip = Math.sin(now * 5 + m.seed) > 0;
          g.fillRect(x, y, flip ? 2 : 1, flip ? 1 : 2);
          break;
        }
        case 'bird': {
          g.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
          g.fillStyle = m.color;
          const up = Math.floor(now * 12 + m.seed) % 2 === 0;
          g.fillRect(x, y, 1, 1);
          g.fillRect(x - 2, y + (up ? -1 : 1), 2, 1);
          g.fillRect(x + 1, y + (up ? -1 : 1), 2, 1);
          break;
        }
        case 'pigeon': {
          g.globalAlpha = 1;
          const peck = Math.sin(now * 5 + m.seed) > 0.6 && m.vx === 0;
          const bob = Math.floor(now * 4 + m.seed) % 2;
          g.fillStyle = PAL.ink;
          g.fillRect(x - 4, y - 3, 7, 4);
          g.fillStyle = m.color;
          g.fillRect(x - 3, y - 3, 5, 3);
          g.fillStyle = PAL.cloth;
          g.fillRect(x - 2, y - 2, 3, 1);
          g.fillStyle = shade(m.color, 0.7);
          g.fillRect(x - 4, y - 2, 1, 1);
          const hx = peck ? x + 2 : x + 1 + bob;
          const hy = peck ? y - 2 : y - 6;
          g.fillStyle = PAL.ink;
          g.fillRect(hx - 1, hy - 1, 4, 4);
          g.fillStyle = '#5a6a7a';
          g.fillRect(hx, hy, 2, 2);
          g.fillStyle = '#6fbf8a';
          g.fillRect(hx, hy + 2, 1, 1);
          g.fillStyle = PAL.clay;
          g.fillRect(x - 1, y + 1, 1, 1); g.fillRect(x + 1, y + 1, 1, 1);
          break;
        }
        case 'butterfly': {
          g.globalAlpha = Math.min(1, m.life, (m.max - m.life));
          g.fillStyle = m.color;
          const open = Math.floor(now * 10 + m.seed) % 2 === 0;
          const yy = y - 8;
          if (open) { g.fillRect(x - 3, yy - 1, 3, 3); g.fillRect(x + 1, yy - 1, 3, 3); g.fillStyle = shade(m.color, 0.7); g.fillRect(x - 3, yy + 1, 1, 1); g.fillRect(x + 3, yy + 1, 1, 1); }
          else { g.fillRect(x - 1, yy - 2, 1, 3); g.fillRect(x + 1, yy - 2, 1, 3); }
          g.fillStyle = PAL.ink;
          g.fillRect(x, yy - 1, 1, 3);
          break;
        }
        case 'snowclump':
        case 'drop':
        case 'dust':
        case 'breath':
        case 'ash':
        case 'bubble': {
          const fade = m.kind === 'dust' || m.kind === 'breath' ? (1 - k) * (m.kind === 'breath' ? 0.55 : 0.6) : m.kind === 'bubble' ? (1 - k) * 0.5 : 1 - k * k;
          g.globalAlpha = fade;
          g.fillStyle = m.color;
          const s = m.kind === 'breath' ? 1 + Math.round(k * 2) : m.size;
          g.fillRect(x, y, s, s);
          break;
        }
        default:
          break;
      }
    }
    g.restore();
  }

  /** Things that give light: drawn after the darkness so they burn through it. */
  drawEmissive(g: CanvasRenderingContext2D, now: number, night: number): void {
    g.save();
    for (const m of this.motes) {
      if (m.life < 0) continue;
      const k = m.life / m.max;
      const x = Math.round(m.x);
      const y = Math.round(m.y);
      if (m.kind === 'spark' || m.kind === 'ember') {
        g.globalAlpha = 1 - k;
        g.fillStyle = m.color;
        g.fillRect(x, y, 1, 1);
      } else if (m.kind === 'firefly') {
        const blink = Math.max(0, Math.sin(now * 2.2 + m.seed * 3));
        const fade = Math.min(1, m.life, m.max - m.life) * night;
        if (blink <= 0.2 || fade <= 0) continue;
        const on = blink > 0.5 ? 1 : 0.55;
        g.globalAlpha = fade * on * 0.5;
        g.fillStyle = m.color;
        g.fillRect(x - 1, y - 11, 4, 2);
        g.fillRect(x, y - 12, 2, 4);
        g.globalAlpha = fade * on;
        g.fillStyle = '#f4ffb0';
        g.fillRect(x, y - 11, 2, 2);
      } else if (m.kind === 'mote') {
        if (m.color === '#6fd0e8') {
          // dragonfly: a blue needle with blurred wings
          g.globalAlpha = Math.min(1, m.life, m.max - m.life);
          g.fillStyle = '#3f8fb0';
          g.fillRect(x - 2, y, 4, 1);
          g.fillStyle = withAlpha(PAL.white, 0.6);
          const up = Math.floor(now * 30) % 2 === 0;
          g.fillRect(x - 1, y + (up ? -1 : 1), 3, 1);
          continue;
        }
        g.globalAlpha = (1 - k) * 0.9;
        g.fillStyle = m.color;
        g.fillRect(x, y, 1, 1);
      }
    }
    g.restore();
  }

  /** Light sources for the darkness buffer. */
  lights(add: (x: number, y: number, r: number, s: number) => void, night: number): void {
    if (night < 0.05) return;
    for (const m of this.motes) {
      if (m.kind === 'firefly' && m.life > 0) add(m.x, m.y - 11, 22, 0.35 * night);
      else if (m.kind === 'ember' || m.kind === 'spark') add(m.x, m.y, 10, 0.25);
    }
  }

  /**
   * Screen-space weather over the finished frame: snowfall and blizzards
   * in the Reach, sand and dust storms in Duneholt. `k` is device pixels
   * per world pixel, so flakes and grains stay whole pixels.
   */
  drawWeather(g: CanvasRenderingContext2D, w: number, h: number, k: number, now: number, reducedMotion = false, night = 0): void {
    const c = this.climate;
    if (c !== 'snow' && c !== 'desert') return;
    const s = this.storm;
    g.save();
    if (c === 'snow') {
      // the flakes themselves are in the world (drawSnow); on the glass
      // there is only what a blizzard does to the light and to the edges
      if (s > 0.02) {
        g.globalAlpha = s * 0.14;
        g.fillStyle = '#c8d6e8';
        g.fillRect(0, 0, w, h);
        this.drawFrost(g, w, h, k, s);
      }
    } else {
      if (s > 0.02) {
        // the air itself goes ochre, heavier in the gusts; the clouds, the
        // grains and the sand snakes are in the world (drawSand, drawGround)
        const gustK = Math.max(0, Math.sin(now * 0.9)) ** 3;
        g.globalAlpha = s * (0.14 + gustK * 0.1);
        g.fillStyle = '#b8955a';
        g.fillRect(0, 0, w, h);
        // and the edges of the view close in, in hard steps
        const steps = 4;
        for (let i = 0; i < steps; i++) {
          const inset = Math.round((i + 1) * 10 * k * (0.6 + s * 0.6));
          g.globalAlpha = s * 0.08;
          g.fillStyle = PAL.sandDark;
          g.fillRect(0, 0, w, inset);
          g.fillRect(0, h - inset, w, inset);
          g.fillRect(0, inset, inset, h - inset * 2);
          g.fillRect(w - inset, inset, inset, h - inset * 2);
        }
      }
      // midday glare over the dunes
      g.globalAlpha = 0.05 * (1 - night);
      g.fillStyle = '#fff1c0';
      g.fillRect(0, 0, w, h);
    }
    g.restore();
  }
}
