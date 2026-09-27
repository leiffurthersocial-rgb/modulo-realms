import type { Game } from './game';
import type { PropInstance } from '../world/map';
import type { CharacterSheet, Look } from '../art/characters';
import { DEFAULT_LOOK, getCharacterSheet } from '../art/characters';
import { getBuilding } from '../art/buildings';
import { PAL, shade } from '../art/palette';
import { TILE } from '../world/tiles';
import { VILLAGE_TX, VILLAGE_TY } from '../../data/locations';

/**
 * Ashvale, lived in. Twenty-five small things that happen in town whether or
 * not the player is looking — the life a place has between the quests:
 *
 *  1 hens scratching by the farmhouse, scattering when you walk through
 *  2 a rooster on the cart that crows at dawn
 *  3 a cat asleep on the barrels, tail twitching; it hops off if you come close
 *  4 a dog by the inn door that wags and trots out to meet you
 *  5 a villager with a basket doing the rounds of the stalls
 *  6 a villager carrying water from the well to the farm
 *  7 two children playing tag round the well
 *  8 washing on a line beside a townhouse, flapping in the wind
 *  9 bunting strung across the square
 * 10 the fringes of the market awnings fluttering
 * 11 sparks off the anvil while the smith is working it
 * 12 a spray of sparks off the grindstone now and then
 * 13 crows on the chapel and Moot Hall roofs that caw and take off
 * 14 sparrows hopping on the well roof
 * 15 bees working the flower boxes
 * 16 petals blowing off the flower boxes
 * 17 notices on the board lifting in the breeze
 * 18 steam from the inn's kitchen vent
 * 19 water dripping from the well bucket
 * 20 wisps of hay blowing off the cart
 * 21 an apple rolling off a market stall
 * 22 moths round the fire baskets at night
 * 23 sparks rising from the forge chimney after dark
 * 24 the chapel bell at six, noon and six, swinging in a cote on the ridge
 * 25 a rug being beaten over a rail, dust puffing out of it
 *
 * Pure decoration, like `ambience.ts` and `caveLife.ts`: nothing here is
 * saved, collides, or touches the simulation or the map — the anchors are
 * read off props the town already has, so the frozen west world is never
 * edited. It only runs while the player is in Ashvale.
 */

type DrawActor = (g: CanvasRenderingContext2D, sheet: CharacterSheet, anim: string, animTime: number, dir: string, x: number, y: number, scale?: number) => void;
interface Pt { x: number; y: number }
interface Critter { x: number; y: number; hx: number; hy: number; vx: number; vy: number; t: number; state: number; seed: number; face: number }
interface Walker { look: Look; path: Pt[]; leg: number; x: number; y: number; t: number; wait: number; dir: string; moving: boolean; carry: 'basket' | 'buckets' }
interface Speck { x: number; y: number; vx: number; vy: number; t: number; max: number; color: string; kind: 'spark' | 'petal' | 'hay' | 'dust' | 'steam' | 'drop' | 'ember' }
interface Bird { x: number; y: number; hx: number; hy: number; state: 'perch' | 'fly' | 'gone'; t: number; vx: number; vy: number; seed: number; kind: 'crow' | 'sparrow' }

const hash = (a: number, b = 0) => { const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return n - Math.floor(n); };

export class TownLife {
  private active = false;
  private built = false;
  private last = -1;
  private now = 0;
  private wind = 0;
  private night = 0;
  private hour = 12;
  private a: {
    farm?: PropInstance; cart?: PropInstance; barrels?: PropInstance; inn?: PropInstance; well?: PropInstance; board?: PropInstance;
    anvil?: PropInstance; grind?: PropInstance; forge?: PropInstance; chapel?: PropInstance; hall?: PropInstance; store?: PropInstance;
    stalls: PropInstance[]; planters: PropInstance[]; braziers: PropInstance[]; houses: PropInstance[];
  } = { stalls: [], planters: [], braziers: [], houses: [] };
  private hens: Critter[] = [];
  private cat: Critter | null = null;
  private dog: Critter | null = null;
  private walkers: Walker[] = [];
  private kids: Critter[] = [];
  private birds: Bird[] = [];
  private specks: Speck[] = [];
  private apple: { x: number; y: number; vx: number; t: number } | null = null;
  private nextApple = 20;
  private rooster = 0;
  private bell = -1;
  private lastBellHour = -1;
  private smithAtAnvil = false;

  private build(game: Game): void {
    this.built = true;
    const cx = VILLAGE_TX * TILE, cy = VILLAGE_TY * TILE;
    const near = (p: PropInstance, r: number) => Math.abs(p.x - cx) < r * TILE && Math.abs(p.y - cy) < r * TILE;
    const find = (art: string, r = 32) => game.map.props.find((p) => p.art === art && near(p, r));
    const all = (art: string, r = 32) => game.map.props.filter((p) => p.art === art && near(p, r));
    const a = this.a;
    a.farm = find('bld:farmhouse'); a.inn = find('bld:inn'); a.chapel = find('bld:chapel'); a.hall = find('bld:town_hall');
    a.store = find('bld:general_store');
    a.cart = find('cart', 14); a.barrels = find('barrel_stack', 14); a.well = find('well', 10); a.board = find('notice_board', 10);
    a.anvil = find('anvil', 20); a.grind = find('grindstone', 20); a.forge = find('forge', 20);
    a.stalls = all('market_stall', 12); a.planters = all('planter'); a.braziers = all('brazier', 14);
    a.houses = all('bld:townhouse').sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy));
    const critter = (x: number, y: number, seed: number): Critter => ({ x, y, hx: x, hy: y, vx: 0, vy: 0, t: 0, state: 0, seed, face: 1 });
    if (a.farm) for (let i = 0; i < 3; i++) this.hens.push(critter(a.farm.x - 40 + i * 34, a.farm.y + 30 + (i % 2) * 14, i + 1));
    if (a.barrels) this.cat = critter(a.barrels.x + 2, a.barrels.y - 22, 7);
    if (a.inn) this.dog = critter(a.inn.x - 40, a.inn.y + 22, 11);
    if (a.well) for (let i = 0; i < 2; i++) this.kids.push(critter(a.well.x, a.well.y, 20 + i));
    // crows on the ridges, sparrows on the well roof
    for (const b of [a.chapel, a.hall]) {
      if (!b) continue;
      const art = getBuilding(b.art.slice(4));
      for (let i = 0; i < 2; i++) {
        // on the gable either side of the finial, following the slope down
        const d = i ? 8 : -6;
        const x = b.x + d, y = b.y - art.h - (art.padTop ?? 0) + 14 + Math.round(Math.abs(d) * 1.1);
        this.birds.push({ x, y, hx: x, hy: y, state: 'perch', t: hash(x, y) * 10, vx: 0, vy: 0, seed: hash(y, x), kind: 'crow' });
      }
    }
    if (a.well) for (let i = 0; i < 2; i++) {
      const x = a.well.x - 8 + i * 14, y = a.well.y - 44;
      this.birds.push({ x, y, hx: x, hy: y, state: 'perch', t: i * 3, vx: 0, vy: 0, seed: 0.3 + i * 0.4, kind: 'sparrow' });
    }
    // two errand-runners: the market round, and water from the well to the farm
    const look = (o: Partial<Look>): Look => ({ ...DEFAULT_LOOK, ...o });
    const door = (b?: PropInstance): Pt | null => (b ? { x: b.x, y: b.y + 20 } : null);
    const stallFront = a.stalls.map((s) => ({ x: s.x, y: s.y + 22 }));
    const storeDoor = door(a.store);
    if (stallFront.length >= 2 && storeDoor) {
      this.walkers.push({ look: look({ hair: '#8a5a3a', hairStyle: 'braid', shirt: '#8a4a5a', pants: '#4a3a3a' }), path: [...stallFront, storeDoor], leg: 0, x: stallFront[0].x, y: stallFront[0].y, t: 0, wait: 2, dir: 'down', moving: false, carry: 'basket' });
    }
    const farmDoor = door(a.farm);
    if (a.well && farmDoor) {
      const w = { x: a.well.x + 26, y: a.well.y + 10 };
      this.walkers.push({ look: look({ hair: '#3a2a20', shirt: '#5a6a4a', pants: '#3b3346', skin: PAL.skin3 }), path: [w, { x: (w.x + farmDoor.x) / 2, y: w.y + 60 }, farmDoor], leg: 0, x: w.x, y: w.y, t: 0, wait: 3, dir: 'down', moving: false, carry: 'buckets' });
    }
  }

  update(game: Game): void {
    const map = game.map;
    const p = game.player;
    const cx = VILLAGE_TX * TILE, cy = VILLAGE_TY * TILE;
    this.active = map.id === 'overworld' && Math.abs(p.x - cx) < 46 * TILE && Math.abs(p.y - cy) < 42 * TILE;
    if (!this.active) { this.last = -1; return; }
    if (!this.built) this.build(game);
    const now = game.now;
    const dt = this.last < 0 ? 0 : Math.min(0.1, now - this.last);
    this.last = now;
    this.now = now;
    this.hour = game.hour;
    this.night = game.nightFactor;
    this.wind = 10 + Math.sin(now * 0.37) * 8 + Math.sin(now * 1.3) * 4;
    if (dt <= 0) return;
    const day = this.hour > 6.5 && this.hour < 19.5;
    const near = (x: number, y: number, r: number) => Math.hypot(p.x - x, p.y - y) < r;
    const a = this.a;
    const spawn = (s: Speck) => { if (this.specks.length < 260) this.specks.push(s); };

    // 1 hens: scratch, peck, wander round home; scatter from the player
    for (const h of this.hens) {
      h.t += dt;
      if (near(h.x, h.y, 46)) {
        const ang = Math.atan2(h.y - p.y, h.x - p.x);
        h.vx = Math.cos(ang) * 70; h.vy = Math.sin(ang) * 50; h.state = 2;
      } else if (h.state === 2 && h.t > 0.6) { h.state = 0; h.vx = 0; h.vy = 0; }
      else if (h.state !== 2 && Math.random() < dt * 0.5) {
        const ang = Math.random() * Math.PI * 2, back = Math.hypot(h.x - h.hx, h.y - h.hy) > 50;
        const toHome = Math.atan2(h.hy - h.y, h.hx - h.x);
        const d = back ? toHome : ang;
        h.vx = Math.cos(d) * 14; h.vy = Math.sin(d) * 10; h.state = 1; h.t = 0;
      } else if (h.state === 1 && h.t > 0.8) { h.vx = 0; h.vy = 0; h.state = 0; }
      if (h.state === 2 && Math.abs(h.vx) + Math.abs(h.vy) > 0) h.t = Math.min(h.t, 0.5);
      h.x += h.vx * dt; h.y += h.vy * dt;
      if (h.vx !== 0) h.face = Math.sign(h.vx);
      h.vx *= h.state === 2 ? 0.96 : 1; h.vy *= h.state === 2 ? 0.96 : 1;
    }
    // 2 rooster crows at dawn
    if (this.hour > 5.5 && this.hour < 7 && Math.random() < dt * 0.25) this.rooster = now;

    // 3 cat: asleep on the barrels; wakes and hops off, comes back later
    const cat = this.cat;
    if (cat) {
      cat.t += dt;
      if (cat.state === 0 && near(cat.hx, cat.hy + 22, 42)) { cat.state = 1; cat.t = 0; cat.face = Math.sign(cat.hx - p.x) || 1; }
      if (cat.state === 1) { cat.x = cat.hx + cat.face * cat.t * 90; cat.y = cat.hy + Math.min(22, cat.t * 60) - Math.sin(Math.min(1, cat.t * 2.5) * Math.PI) * 10; if (cat.t > 1.4) { cat.state = 2; cat.t = 0; } }
      if (cat.state === 2 && cat.t > 25 && !near(cat.hx, cat.hy, 160)) { cat.state = 0; cat.x = cat.hx; cat.y = cat.hy; }
    }
    // 4 dog: wags by the inn, trots out to the player, then back
    const dog = this.dog;
    if (dog) {
      dog.t += dt;
      const toPlayer = near(dog.hx, dog.hy, 120) && !near(dog.x, dog.y, 30);
      const tx = toPlayer ? p.x + 24 : dog.hx, ty = toPlayer ? p.y + 6 : dog.hy;
      const d = Math.hypot(tx - dog.x, ty - dog.y);
      if (d > 4) { dog.vx = ((tx - dog.x) / d) * 60; dog.vy = ((ty - dog.y) / d) * 60; dog.x += dog.vx * dt; dog.y += dog.vy * dt; dog.face = Math.sign(dog.vx) || dog.face; dog.state = 1; }
      else dog.state = 0;
    }
    // 5, 6 errand-runners, by day
    for (const w of this.walkers) {
      if (!day) { w.moving = false; continue; }
      if (w.wait > 0) { w.wait -= dt; w.moving = false; continue; }
      const target = w.path[(w.leg + 1) % w.path.length];
      const dx = target.x - w.x, dy = target.y - w.y, d = Math.hypot(dx, dy);
      if (d < 2) { w.leg = (w.leg + 1) % w.path.length; w.wait = 2 + hash(w.leg, w.x) * 4; w.moving = false; continue; }
      w.x += (dx / d) * 42 * dt; w.y += (dy / d) * 42 * dt; w.t += dt; w.moving = true;
      w.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    // 7 children playing tag round the well, by day
    if (a.well) this.kids.forEach((k, i) => {
      k.t += dt;
      const ang = now * (1.1 + i * 0.05) + i * 2.4 + Math.sin(now * 0.7) * 0.4;
      const nx = a.well!.x + Math.cos(ang) * 58, ny = a.well!.y + 6 + Math.sin(ang) * 30;
      k.face = Math.sign(nx - k.x) || k.face;
      k.vx = nx - k.x; k.vy = ny - k.y; k.x = nx; k.y = ny;
    });

    // 11 anvil sparks while the smith is at it, by day
    const smith = game.npcs.find((n) => n.def.id === 'smith_corin');
    this.smithAtAnvil = !!(smith && a.anvil && day && Math.hypot(smith.x - a.anvil.x, smith.y - a.anvil.y) < 70);
    if (this.smithAtAnvil && a.anvil && Math.floor(now / 1.6) !== Math.floor((now - dt) / 1.6)) {
      for (let i = 0; i < 8; i++) spawn({ kind: 'spark', x: a.anvil.x + 2, y: a.anvil.y - 26, vx: (Math.random() - 0.5) * 90, vy: -30 - Math.random() * 60, t: 0, max: 0.4 + Math.random() * 0.3, color: Math.random() < 0.5 ? PAL.flameLit : PAL.goldLit });
    }
    // 12 grindstone spray
    if (a.grind && day && Math.random() < dt * 0.25) for (let i = 0; i < 6; i++) spawn({ kind: 'spark', x: a.grind.x - 2, y: a.grind.y - 20, vx: 30 + Math.random() * 50, vy: -20 + Math.random() * 30, t: 0, max: 0.35, color: PAL.goldLit });

    // 13, 14 birds on the roofs and the well
    for (const b of this.birds) {
      b.t += dt;
      if (b.state === 'perch' && near(b.hx, b.hy + 60, b.kind === 'crow' ? 80 : 56)) {
        b.state = 'fly'; b.t = 0; const away = Math.sign(b.hx - p.x) || 1;
        b.vx = away * (40 + b.seed * 40); b.vy = -30 - b.seed * 20;
      } else if (b.state === 'perch' && b.kind === 'crow' && Math.random() < dt * 0.01) { b.state = 'fly'; b.t = 0; b.vx = (b.seed > 0.5 ? 1 : -1) * 50; b.vy = -25; }
      if (b.state === 'fly') { b.x += b.vx * dt; b.y += (b.vy + Math.sin(b.t * 5) * 12) * dt; if (b.t > 4) { b.state = 'gone'; b.t = 0; } }
      if (b.state === 'gone' && b.t > 20 && !near(b.hx, b.hy + 60, 200)) { b.state = 'perch'; b.x = b.hx; b.y = b.hy; }
    }
    // 16 petals off the flower boxes
    for (const pl of a.planters) if (Math.random() < dt * (0.1 + (this.wind - 6) * 0.02)) spawn({ kind: 'petal', x: pl.x + (Math.random() - 0.5) * 16, y: pl.y - 16, vx: this.wind * 0.8, vy: 4, t: 0, max: 3.5, color: [PAL.blood, PAL.goldLit, '#e87aa0', PAL.cloth][Math.floor(Math.random() * 4)] });
    // 18 steam from the inn kitchen
    if (a.inn && Math.random() < dt * 1.2) {
      const art = getBuilding('inn');
      spawn({ kind: 'steam', x: a.inn.x + art.w * 0.3 + (Math.random() - 0.5) * 4, y: a.inn.y - art.h * 0.62, vx: this.wind * 0.3, vy: -14, t: 0, max: 1.6, color: PAL.cloth });
    }
    // 19 drips from the well bucket
    if (a.well && Math.random() < dt * 0.8) spawn({ kind: 'drop', x: a.well.x - 1 + (Math.random() < 0.5 ? 0 : 4), y: a.well.y - 16, vx: 0, vy: 20, t: 0, max: 0.35, color: PAL.foam });
    // 20 hay off the cart
    if (a.cart && Math.random() < dt * 0.6 * (this.wind / 10)) spawn({ kind: 'hay', x: a.cart.x + (Math.random() - 0.5) * 20, y: a.cart.y - 22, vx: this.wind * 1.4, vy: -3, t: 0, max: 2.5, color: Math.random() < 0.5 ? PAL.sand : PAL.sandLit });
    // 21 an apple rolls off a stall now and then
    if (!this.apple && a.stalls.length && now > this.nextApple && day) {
      const s = a.stalls[Math.floor(Math.random() * a.stalls.length)];
      this.apple = { x: s.x + (Math.random() - 0.5) * 30, y: s.y + 4, vx: (Math.random() < 0.5 ? -1 : 1) * 28, t: 0 };
      this.nextApple = now + 40 + Math.random() * 40;
    }
    if (this.apple) { const ap = this.apple; ap.t += dt; ap.x += ap.vx * dt; ap.vx *= 1 - dt * 1.2; if (ap.t > 6) this.apple = null; }
    // 22 moths at night; 23 forge chimney sparks at night
    if (this.night > 0.4) {
      for (const br of a.braziers) if (Math.random() < dt * 0.2) spawn({ kind: 'dust', x: br.x, y: br.y - 34, vx: 0, vy: 0, t: 0, max: 5, color: PAL.bone });
      if (a.forge && Math.random() < dt * 1.5) spawn({ kind: 'ember', x: a.forge.x + (Math.random() - 0.5) * 6, y: a.forge.y - 52, vx: this.wind * 0.4, vy: -26 - Math.random() * 20, t: 0, max: 1.4, color: Math.random() < 0.5 ? PAL.flameLit : PAL.flame });
    }
    // 24 the chapel bell
    const h = Math.floor(this.hour);
    if ((h === 6 || h === 12 || h === 18) && this.lastBellHour !== h) { this.lastBellHour = h; this.bell = now; }
    if (h !== 6 && h !== 12 && h !== 18) this.lastBellHour = -1;
    // 25 rug-beating dust, by day
    const rug = this.rugAt();
    if (rug && day && Math.floor(now / 1.3) !== Math.floor((now - dt) / 1.3)) for (let i = 0; i < 5; i++) spawn({ kind: 'dust', x: rug.x + (Math.random() - 0.5) * 16, y: rug.y - 14 + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 20 + this.wind * 0.5, vy: -8, t: 0, max: 1.2, color: PAL.sand });

    for (let i = this.specks.length - 1; i >= 0; i--) {
      const s = this.specks[i];
      s.t += dt;
      if (s.kind === 'spark' || s.kind === 'drop') s.vy += 260 * dt;
      if (s.kind === 'petal' || s.kind === 'hay') { s.vy = Math.sin(now * 3 + s.x * 0.1) * 6 + 5; }
      if (s.kind === 'dust' && s.max > 3) { s.vx = Math.cos(now * 3 + s.y) * 20; s.vy = Math.sin(now * 4 + s.x) * 14; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.t > s.max) this.specks.splice(i, 1);
    }
  }

  private rugAt(): Pt | null {
    const house = this.a.houses[3];
    return house ? { x: house.x + 72, y: house.y + 10 } : null;
  }
  private lineAt(): { x0: number; x1: number; y: number } | null {
    const house = this.a.houses[1];
    return house ? { x0: house.x + 48, x1: house.x + 132, y: house.y - 26 } : null;
  }

  /** Things that stand on the ground and sort with the actors. */
  pushDrawables(out: Array<{ y: number; draw: () => void }>, g: CanvasRenderingContext2D, drawActor: DrawActor): void {
    if (!this.active) return;
    const now = this.now;
    const shadow = (x: number, y: number, w: number) => { g.fillStyle = 'rgba(10,8,16,0.3)'; g.fillRect(Math.round(x - w / 2), Math.round(y), w, 1); };
    for (const h of this.hens) out.push({ y: h.y, draw: () => {
      const x = Math.round(h.x), y = Math.round(h.y), f = h.face;
      const peck = h.state === 0 && Math.sin(now * 4 + h.seed * 7) > 0.5;
      const flap = h.state === 2 && Math.floor(now * 14) % 2 === 0;
      shadow(x, y, 7);
      g.fillStyle = PAL.ink; g.fillRect(x - 4, y - 6, 8, 6);
      g.fillStyle = PAL.cloth; g.fillRect(x - 3, y - 5, 6, 4);
      g.fillStyle = shade(PAL.cloth, 0.8); g.fillRect(x - 3 * f - (f > 0 ? 1 : 0), y - 4, 2, 2);
      if (flap) { g.fillStyle = PAL.cloth; g.fillRect(x - 1, y - 8, 3, 2); }
      const hx = x + f * (peck ? 3 : 2) - (f < 0 ? 2 : 0), hy = peck ? y - 3 : y - 8;
      g.fillStyle = PAL.ink; g.fillRect(hx - 1, hy - 1, 4, 4);
      g.fillStyle = PAL.cloth; g.fillRect(hx, hy, 2, 2);
      g.fillStyle = PAL.blood; g.fillRect(hx, hy - 1, 2, 1);
      g.fillStyle = PAL.flame; g.fillRect(f > 0 ? hx + 2 : hx - 1, hy + 1, 1, 1);
      g.fillStyle = PAL.gold; g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1);
    } });
    // the rooster on the cart
    const cart = this.a.cart;
    if (cart) out.push({ y: cart.y + 1, draw: () => {
      const x = Math.round(cart.x + 10), y = Math.round(cart.y - 20);
      const crow = now - this.rooster < 1.4;
      g.fillStyle = PAL.ink; g.fillRect(x - 4, y - 6, 8, 6);
      g.fillStyle = PAL.clay; g.fillRect(x - 3, y - 5, 6, 4);
      g.fillStyle = PAL.leafDark; g.fillRect(x - 6, y - 8, 3, 5);
      const hy = crow ? y - 11 : y - 9;
      g.fillStyle = PAL.ink; g.fillRect(x + 1, hy - 1, 4, 5);
      g.fillStyle = PAL.flame; g.fillRect(x + 2, hy, 2, 3);
      g.fillStyle = PAL.blood; g.fillRect(x + 2, hy - 2, 2, 2);
      g.fillStyle = PAL.gold; g.fillRect(x + 4, hy + 1, crow ? 2 : 1, 1);
      if (crow) { g.fillStyle = PAL.cloth; for (let i = 0; i < 3; i++) g.fillRect(x + 8 + i * 3, hy - 3 - i * 2 + Math.round(Math.sin(now * 10 + i)), 2, 1); }
    } });
    // the cat
    const cat = this.cat;
    if (cat && !(cat.state === 2 && cat.t < 25 && cat.t > 1.5)) out.push({ y: cat.state === 0 ? (this.a.barrels?.y ?? cat.y) + 1 : cat.y + 22, draw: () => {
      const x = Math.round(cat.x), y = Math.round(cat.y) + (cat.state === 0 ? 0 : 0);
      g.fillStyle = PAL.ink;
      if (cat.state === 0) {
        // curled asleep, tail flicking
        g.fillRect(x - 5, y - 4, 10, 5);
        g.fillStyle = PAL.clay; g.fillRect(x - 4, y - 3, 8, 3);
        g.fillStyle = shade(PAL.clay, 0.7); g.fillRect(x - 2, y - 3, 1, 3); g.fillRect(x + 1, y - 3, 1, 3);
        g.fillStyle = PAL.clay; g.fillRect(x + 2, y - 5, 3, 2);
        g.fillStyle = PAL.ink; g.fillRect(x + 2, y - 6, 1, 1); g.fillRect(x + 4, y - 6, 1, 1);
        const flick = Math.sin(now * 2 + cat.seed) > 0.8 ? -1 : 0;
        g.fillStyle = PAL.clay; g.fillRect(x - 6, y - 2 + flick, 2, 1);
      } else {
        const run = Math.floor(now * 12) % 2;
        g.fillRect(x - 5, y - 5, 10, 5);
        g.fillStyle = PAL.clay; g.fillRect(x - 4, y - 4, 8, 3);
        g.fillStyle = PAL.ink; g.fillRect(x + cat.face * 4 - 1, y - 7, 3, 3);
        g.fillStyle = PAL.clay; g.fillRect(x + cat.face * 4, y - 6, 1, 1);
        g.fillRect(x - cat.face * 6, y - 6 - run, 1, 3);
        g.fillStyle = PAL.ink; g.fillRect(x - 3 + run, y, 1, 1); g.fillRect(x + 2 - run, y, 1, 1);
      }
    } });
    // the dog
    const dog = this.dog;
    if (dog) out.push({ y: dog.y, draw: () => {
      const x = Math.round(dog.x), y = Math.round(dog.y), f = dog.face;
      const wag = Math.floor(now * (dog.state ? 10 : 6)) % 2;
      const trot = dog.state ? Math.floor(now * 10) % 2 : 0;
      shadow(x, y, 12);
      g.fillStyle = PAL.ink; g.fillRect(x - 6, y - 8, 12, 7);
      g.fillStyle = PAL.dirtLit; g.fillRect(x - 5, y - 7, 10, 5);
      g.fillStyle = PAL.bone; g.fillRect(x - 2, y - 3, 5, 1);
      g.fillStyle = PAL.ink; g.fillRect(x + f * 5 - 2, y - 12, 5, 6);
      g.fillStyle = PAL.dirtLit; g.fillRect(x + f * 5 - 1, y - 11, 3, 4);
      g.fillStyle = PAL.dirt; g.fillRect(x + f * 5 - (f > 0 ? 1 : 0), y - 13, 2, 3);
      g.fillStyle = PAL.ink; g.fillRect(x + f * 7, y - 9, 1, 1);
      g.fillStyle = PAL.dirtLit; g.fillRect(x - f * 7 - (f > 0 ? 0 : 1), y - 9 - wag, 2, 2);
      g.fillStyle = PAL.dirt; g.fillRect(x - 4 + trot, y - 1, 2, 1); g.fillRect(x + 3 - trot, y - 1, 2, 1);
    } });
    // errand-runners
    for (const w of this.walkers) out.push({ y: w.y, draw: () => {
      drawActor(g, getCharacterSheet(w.look), w.moving ? 'walk' : 'idle', w.moving ? w.t : now, w.dir, w.x, w.y + 6);
      const x = Math.round(w.x), y = Math.round(w.y);
      if (w.carry === 'basket') {
        g.fillStyle = PAL.ink; g.fillRect(x + 4, y - 16, 9, 7);
        g.fillStyle = PAL.plank; g.fillRect(x + 5, y - 15, 7, 5);
        g.fillStyle = PAL.blood; g.fillRect(x + 6, y - 17, 2, 2); g.fillStyle = PAL.goldLit; g.fillRect(x + 9, y - 17, 2, 2);
      } else {
        for (const s of [-1, 1]) { g.fillStyle = PAL.ink; g.fillRect(x + s * 9 - 3, y - 14, 6, 7); g.fillStyle = PAL.wood; g.fillRect(x + s * 9 - 2, y - 13, 4, 5); g.fillStyle = PAL.water; g.fillRect(x + s * 9 - 2, y - 13, 4, 1); }
      }
    } });
    // children
    const kidLook: Look[] = [{ ...DEFAULT_LOOK, hair: '#c9a86b', shirt: '#6a8ab0', height: 0.72 }, { ...DEFAULT_LOOK, hair: '#4a2a1a', hairStyle: 'ponytail', shirt: '#b5462f', height: 0.7 }];
    if (this.hour > 7 && this.hour < 19) this.kids.forEach((k, i) => out.push({ y: k.y, draw: () => {
      const dir = Math.abs(k.vx) > Math.abs(k.vy) ? (k.vx > 0 ? 'right' : 'left') : (k.vy > 0 ? 'down' : 'up');
      drawActor(g, getCharacterSheet(kidLook[i]), 'walk', now * 1.6 + i, dir, k.x, k.y + 6, 0.8);
    } }));
    // the apple
    const ap = this.apple;
    if (ap) out.push({ y: ap.y, draw: () => {
      g.globalAlpha = Math.min(1, 6 - ap.t);
      g.fillStyle = PAL.ink; g.fillRect(Math.round(ap.x) - 2, Math.round(ap.y) - 4, 4, 4);
      g.fillStyle = PAL.blood; g.fillRect(Math.round(ap.x) - 1, Math.round(ap.y) - 3, 2, 2);
      g.globalAlpha = 1;
    } });
  }

  /** Over the actors, under the darkness. */
  drawAir(g: CanvasRenderingContext2D): void {
    if (!this.active) return;
    const now = this.now, a = this.a;
    g.save();
    // 9 bunting across the square, between the two front stalls
    if (a.stalls.length >= 2) {
      const [s0, s1] = [...a.stalls].sort((p, q) => p.y - q.y || p.x - q.x);
      const x0 = s0.x, x1 = s1.x === s0.x ? s0.x + 200 : s1.x, y0 = s0.y - 46;
      // one continuous sagging cord, pennants hung off it every 12 px
      const len = Math.max(1, Math.abs(x1 - x0));
      const cord = (k: number) => y0 + Math.sin(k * Math.PI) * 14;
      g.fillStyle = PAL.woodDark;
      for (let x = 0; x <= len; x++) g.fillRect(Math.round(x0 + (x1 - x0) * (x / len)), Math.round(cord(x / len)), 1, 1);
      const n = Math.floor(len / 12);
      for (let i = 1; i < n; i++) {
        const k = i / n, x = Math.round(x0 + (x1 - x0) * k), y = Math.round(cord(k)) + 1;
        const sway = Math.round(Math.sin(now * 3 + i) * (this.wind / 12));
        const c = [PAL.blood, PAL.goldLit, '#4f9ce8', PAL.cloth][i % 4];
        g.fillStyle = PAL.ink; g.fillRect(x - 3, y, 7, 1);
        g.fillStyle = c; g.fillRect(x - 2, y + 1, 5, 2); g.fillRect(x - 1 + sway, y + 3, 3, 1); g.fillRect(x + sway, y + 4, 1, 1);
        g.fillStyle = shade(c, 0.7); g.fillRect(x + 2, y + 1, 1, 2);
      }
    }
    // 10 awning fringes
    for (const s of a.stalls) {
      for (let i = 0; i < 9; i++) {
        const x = Math.round(s.x - 26 + i * 6.5), y = Math.round(s.y - 40 + (Math.sin(now * 5 + i + s.x) * (this.wind / 12) > 0.5 ? 1 : 0));
        g.fillStyle = i % 2 ? PAL.cloth : PAL.blood; g.fillRect(x, y, 3, 2);
      }
    }
    // 8 washing on a line
    const line = this.lineAt();
    if (line) {
      g.fillStyle = PAL.woodDark;
      g.fillRect(line.x0 - 1, line.y - 2, 2, 34); g.fillRect(line.x1 - 1, line.y - 2, 2, 34);
      for (let x = line.x0; x < line.x1; x += 2) g.fillRect(x, line.y + Math.round(Math.sin(((x - line.x0) / (line.x1 - line.x0)) * Math.PI) * 4), 2, 1);
      const cloths: Array<[number, string, number, number]> = [[0.18, PAL.cloth, 10, 12], [0.4, '#6a8ab0', 8, 14], [0.62, PAL.blood, 12, 10], [0.84, PAL.sandLit, 8, 11]];
      for (const [k, c, w, h] of cloths) {
        const x = Math.round(line.x0 + (line.x1 - line.x0) * k - w / 2), y = Math.round(line.y + Math.sin(k * Math.PI) * 4 + 1);
        const billow = Math.round(Math.sin(now * 2.5 + k * 9) * (this.wind / 9));
        g.fillStyle = PAL.ink; g.fillRect(x - 1, y - 1, w + 2, h + 2);
        g.fillStyle = c; g.fillRect(x, y, w, h);
        g.fillStyle = shade(c, 0.8); g.fillRect(x + (billow > 0 ? w - 2 : 0), y + 2, 2, h - 2);
        g.fillRect(x + billow, y + h, w, 1);
      }
    }
    // 25 the rug over its rail
    const rug = this.rugAt();
    if (rug) {
      g.fillStyle = PAL.woodDark; g.fillRect(rug.x - 14, rug.y - 18, 2, 18); g.fillRect(rug.x + 12, rug.y - 18, 2, 18); g.fillRect(rug.x - 14, rug.y - 19, 28, 2);
      g.fillStyle = PAL.ink; g.fillRect(rug.x - 11, rug.y - 18, 22, 14);
      g.fillStyle = '#6a2a3a'; g.fillRect(rug.x - 10, rug.y - 17, 20, 12);
      g.fillStyle = PAL.gold; g.fillRect(rug.x - 10, rug.y - 17, 20, 1); g.fillRect(rug.x - 10, rug.y - 7, 20, 1);
      for (let i = 0; i < 3; i++) g.fillRect(rug.x - 6 + i * 6, rug.y - 13, 2, 2);
    }
    // 17 notices lifting
    if (a.board) for (let i = 0; i < 4; i++) {
      if (Math.sin(now * 2 + i * 1.7) * (this.wind / 12) < 0.6) continue;
      g.fillStyle = PAL.cloth; g.fillRect(Math.round(a.board.x - 12 + (i % 2) * 14 + 8), Math.round(a.board.y - 36 + Math.floor(i / 2) * 10), 3, 2);
    }
    // 15 bees
    for (const pl of a.planters) for (let i = 0; i < 2; i++) {
      const t = now * (2 + i) + pl.x;
      const x = Math.round(pl.x + Math.cos(t) * 10 + Math.sin(t * 3.1) * 3), y = Math.round(pl.y - 20 + Math.sin(t * 1.7) * 5);
      g.fillStyle = PAL.ink; g.fillRect(x, y, 2, 1); g.fillStyle = PAL.goldLit; g.fillRect(x + 1, y, 1, 1);
      if (Math.floor(now * 20 + i) % 2) { g.fillStyle = PAL.cloth; g.fillRect(x, y - 1, 1, 1); }
    }
    // 13, 14 birds
    for (const b of this.birds) {
      if (b.state === 'gone') continue;
      const x = Math.round(b.x), y = Math.round(b.y);
      const crow = b.kind === 'crow';
      const body = crow ? PAL.ink : PAL.dirt;
      if (b.state === 'perch') {
        const caw = crow && Math.sin(now * 0.8 + b.seed * 20) > 0.97;
        const hop = !crow && Math.sin(now * 3 + b.seed * 10) > 0.8 ? -1 : 0;
        g.fillStyle = body; g.fillRect(x - 2, y - 3 + hop, crow ? 5 : 4, crow ? 4 : 3);
        g.fillRect(x + (crow ? 2 : 1), y - 5 + hop, 2, 2);
        g.fillStyle = crow ? PAL.charcoal : PAL.sand; g.fillRect(x + (crow ? 4 : 3), y - 4 + hop, caw ? 2 : 1, 1);
        if (caw) { g.fillStyle = PAL.ink; g.fillRect(x + 7, y - 8, 1, 1); g.fillRect(x + 9, y - 10, 1, 1); }
      } else {
        const up = Math.floor(now * 12 + b.seed * 10) % 2;
        g.fillStyle = body; g.fillRect(x - 1, y - 1, 3, 2);
        g.fillRect(x - 4, y - 1 - up * 2, 3, 1); g.fillRect(x + 2, y - 1 - up * 2, 3, 1);
      }
    }
    // specks: sparks, petals, hay, dust, steam, drops
    for (const s of this.specks) {
      const k = s.t / s.max;
      g.globalAlpha = s.kind === 'steam' ? 0.55 * (1 - k) : s.kind === 'dust' && s.max < 3 ? 0.6 * (1 - k) : Math.min(1, (1 - k) * 2);
      g.fillStyle = s.color;
      const size = s.kind === 'steam' ? 2 + Math.round(k * 3) : s.kind === 'dust' && s.max < 3 ? 2 : 1;
      g.fillRect(Math.round(s.x), Math.round(s.y), size, s.kind === 'hay' ? 1 : size);
      if (s.kind === 'hay') g.fillRect(Math.round(s.x) + 1, Math.round(s.y) + 1, 2, 1);
    }
    g.globalAlpha = 1;
    // 24 the bell: rings spreading from the chapel roof
    const chapel = a.chapel;
    if (chapel && this.bell >= 0 && now - this.bell < 6) {
      const art = getBuilding('chapel');
      const bx = chapel.x, by = chapel.y - art.h - (art.padTop ?? 0) + 18;
      // a little bell-cote on the finial: yoke, swinging bell, clapper
      const swing = Math.round(Math.sin(now * 7) * 2);
      g.fillStyle = PAL.ink; g.fillRect(bx - 7, by - 10, 14, 3); g.fillRect(bx - 7, by - 10, 2, 12); g.fillRect(bx + 5, by - 10, 2, 12);
      g.fillStyle = PAL.woodDark; g.fillRect(bx - 6, by - 9, 12, 1);
      g.fillStyle = PAL.ink; g.fillRect(bx - 4 + swing, by - 7, 8, 8);
      g.fillStyle = PAL.gold; g.fillRect(bx - 3 + swing, by - 6, 6, 6);
      g.fillStyle = PAL.goldLit; g.fillRect(bx - 2 + swing, by - 6, 2, 3);
      g.fillStyle = PAL.ink; g.fillRect(bx - swing, by + 1, 1, 2);
      // sound waves either side, one per stroke, fading as they travel
      const k = ((now - this.bell) % 1.5) / 1.5;
      g.fillStyle = PAL.goldLit; g.globalAlpha = 0.9 * (1 - k);
      for (const side of [-1, 1]) for (let i = 0; i < 2; i++) {
        const d = 10 + i * 5 + Math.round(k * 10);
        const x = Math.round(bx + side * d);
        g.fillRect(x, by - 7 - i, 1, 7 + i * 2);
        g.fillRect(x - side, by - 8 - i, 1, 1); g.fillRect(x - side, by + 1 + i, 1, 1);
      }
      g.globalAlpha = 1;
    }
    g.restore();
  }

  /** After the darkness: sparks and embers glow through it. */
  drawEmissive(g: CanvasRenderingContext2D): void {
    if (!this.active) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const s of this.specks) {
      if (s.kind !== 'spark' && s.kind !== 'ember' && !(s.kind === 'dust' && s.max > 3)) continue;
      g.globalAlpha = Math.min(1, (1 - s.t / s.max) * 1.5) * (s.kind === 'dust' ? 0.5 : 0.9);
      g.fillStyle = s.color;
      g.fillRect(Math.round(s.x), Math.round(s.y), s.kind === 'dust' ? 2 : 1, 1);
    }
    g.restore();
  }
}

export const townLife = new TownLife();
