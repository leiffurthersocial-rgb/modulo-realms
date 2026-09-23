import { shipGuidanceTarget } from '../aegean/guidance';
import { ANIM, ROW, getCharacterSheet, type CharacterSheet } from '../art/characters';
import { getCreatureSheet, creatureStyle } from '../art/creatures';
import { getBuilding } from '../art/buildings';
import { getProp } from '../art/props';
import { getIcon } from '../art/icons';
import { PAL, withAlpha } from '../art/palette';
import { getTileset, TILE_VARIANTS } from '../art/tileset';
import { drawProjectile } from '../combat/projectiles';
import { RARITY_COLOR } from '../items/types';
import type { Enemy } from '../entities/enemy';
import { T, TILE, TILES, isWater } from '../world/tiles';
import { drawTerrainRelief } from './terrainRelief';
import { drawMarine, isMarine } from './marine';
import { drawMarineDepth } from './marineDepth';
import { propsInRect, type GameMap } from '../world/map';
import type { Game } from './game';
import { LOCATIONS } from '../../data/locations';
import { drawPrompt, pixelText, promptBox, rectsOverlap, setFont, type ScreenRect } from '../art/uiCanvas';
import { canvasUiScale } from './zoom';

const identities = new WeakMap<GameMap,number>();
let nextIdentity=1;
function mapIdentity(map:GameMap):number {let id=identities.get(map);if(!id){id=nextIdentity++;identities.set(map,id);}return id;}
const CHUNK = 16;
const CHUNK_PX = CHUNK * TILE;

const chunkCache = new Map<string, HTMLCanvasElement>();
const chunkOrder: string[] = [];
const scratch = document.createElement('canvas');
scratch.width = TILE;
scratch.height = TILE;
const scratchG = scratch.getContext('2d')!;

const NEIGHBORS: Array<[number, number]> = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [1, -1], [1, 1], [-1, 1],
];

let marineBankMasks: Uint8ClampedArray[] | undefined;
function getMarineBankMasks(): Uint8ClampedArray[] {
  // Read the eight tiny static masks once; no per-frame canvas readbacks.
  return marineBankMasks ??= getTileset().masks.map(mask =>
    (mask as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, TILE, TILE).data);
}

function tileVariant(tx: number, ty: number): number {
  const h = (Math.imul(tx, 374761393) ^ Math.imul(ty, 668265263)) >>> 0;
  return (h >>> 13) % TILE_VARIANTS;
}

function renderChunk(map: GameMap, cx: number, cy: number): HTMLCanvasElement {
  const key = `${map.id}:${mapIdentity(map)}:${cx},${cy}`;
  const hit = chunkCache.get(key);
  if (hit) return hit;

  const ts = getTileset();
  const canvas = document.createElement('canvas');
  canvas.width = CHUNK_PX;
  canvas.height = CHUNK_PX;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;

  for (let y = 0; y < CHUNK; y++) {
    for (let x = 0; x < CHUNK; x++) {
      const tx = cx * CHUNK + x;
      const ty = cy * CHUNK + y;
      if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) continue;
      const id = map.tiles[ty * map.w + tx];
      const v = tileVariant(tx, ty);
      const dx = x * TILE;
      const dy = y * TILE;
      if (isMarine(id)) drawMarineDepth(g, ts.sheet, map, tx, ty, v, dx, dy, TILE);
      else g.drawImage(ts.sheet, v * TILE, id * TILE, TILE, TILE, dx, dy, TILE, TILE);

      const def = TILES[id];
      // blend higher-priority neighbours over this tile
      for (let n = 0; n < NEIGHBORS.length; n++) {
        const [ox, oy] = NEIGHBORS[n];
        const nx = tx + ox;
        const ny = ty + oy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
        const nid = map.tiles[ny * map.w + nx];
        if (nid === id) continue;
        const ndef = TILES[nid];
        if (!ndef) continue;
        // The shelf has a broad continuous depth gradient of its own.
        if (isMarine(id) && isMarine(nid)) continue;
        const dryBank = isMarine(id) && !ndef.water && nid !== T.VOID;
        // Land overlaps the sea at the shore. Painting water over land made
        // the blue edge look like a raised slab, especially south of a beach.
        if (isMarine(nid) && !def.water) continue;
        if (!dryBank && ndef.blend <= def.blend) continue;
        if (ndef.family && ndef.family === def.family) continue;
        if (ndef.solid && !def.solid && ndef.blend >= 90) continue;
        scratchG.clearRect(0, 0, TILE, TILE);
        scratchG.globalCompositeOperation = 'source-over';
        scratchG.drawImage(ts.sheet, tileVariant(nx, ny) * TILE, nid * TILE, TILE, TILE, 0, 0, TILE, TILE);
        scratchG.globalCompositeOperation = 'destination-in';
        scratchG.drawImage(ts.masks[n], 0, 0);
        scratchG.globalCompositeOperation = 'source-over';
        g.drawImage(scratch, dx, dy);
      }

      const belowId = ty + 1 < map.h ? map.tiles[(ty + 1) * map.w + tx] : T.VOID;
      const aboveId = ty > 0 ? map.tiles[(ty - 1) * map.w + tx] : T.VOID;
      drawTerrainRelief(g, ts.faces, id, belowId, aboveId, dx, dy, v, TILE);
    }
  }

  applyMacroVariation(g, map, cx, cy);

  chunkCache.set(key, canvas);
  chunkOrder.push(key);
  if (chunkOrder.length > 32) {
    const old = chunkOrder.shift()!;
    chunkCache.delete(old);
  }
  return canvas;
}

/**
 * Large soft blotches keyed to world-space cells, so ground variation crosses
 * tile and chunk boundaries instead of stopping at a 32px grid.
 */
function applyMacroVariation(g: CanvasRenderingContext2D, map: GameMap, cx: number, cy: number): void {
  if (map.kind === 'interior') return;
  const CELL = 96; // world pixels per blotch cell
  const originX = cx * CHUNK_PX;
  const originY = cy * CHUNK_PX;
  const c0 = Math.floor(originX / CELL) - 1;
  const c1 = Math.floor((originX + CHUNK_PX) / CELL) + 1;
  const r0 = Math.floor(originY / CELL) - 1;
  const r1 = Math.floor((originY + CHUNK_PX) / CELL) + 1;

  g.save();
  g.globalCompositeOperation = 'source-atop';
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const h = (Math.imul(c, 374761393) ^ Math.imul(r, 668265263)) >>> 0;
      const jx = ((h >>> 3) % 100) / 100;
      const jy = ((h >>> 11) % 100) / 100;
      const size = 70 + ((h >>> 17) % 90);
      const dark = ((h >>> 23) & 1) === 0;
      const strength = 0.05 + ((h >>> 5) % 7) / 100;
      const wx = c * CELL + jx * CELL;
      const wy = r * CELL + jy * CELL;
      const lx = wx - originX;
      const ly = wy - originY;
      const grad = g.createRadialGradient(lx, ly, 0, lx, ly, size);
      const col = dark ? '8,6,14' : '240,228,196';
      grad.addColorStop(0, `rgba(${col},${strength})`);
      grad.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(lx, ly, size, 0, Math.PI * 2);
      g.fill();
    }
  }
  // a uniform grade keeps the whole world in a colder, grimmer key
  g.fillStyle = 'rgba(20,16,32,0.14)';
  g.fillRect(0, 0, CHUNK_PX, CHUNK_PX);
  g.restore();
}

export function invalidateChunks(mapId?: string): void {
  if (!mapId) {
    minimapCache.clear();
    chunkCache.clear();
    chunkOrder.length = 0;
    return;
  }
  for (const k of [...chunkCache.keys()]) {
    if (k.startsWith(`${mapId}:`)) chunkCache.delete(k);
  }
}

/* ------------------------------------------------------------------ */
/* Actors                                                              */
/* ------------------------------------------------------------------ */

function frameFor(anim: string, animTime: number): number {
  const a = ANIM[anim as keyof typeof ANIM] ?? ANIM.idle;
  const idx = Math.floor(animTime * a.fps);
  const f = a.loop ? idx % a.frames : Math.min(a.frames - 1, idx);
  return a.from + f;
}

function drawActor(
  g: CanvasRenderingContext2D,
  sheet: CharacterSheet,
  anim: string,
  animTime: number,
  dir: string,
  x: number,
  y: number,
  scale = 1,
  flash = 0,
  alpha = 1,
): void {
  const col = frameFor(anim, animTime);
  const row = ROW[dir] ?? 0;
  const flip = dir === 'left';
  const w = sheet.fw * scale;
  const h = sheet.fh * scale;
  const dx = Math.round(x - w / 2);
  const dy = Math.round(y - sheet.feet * scale);

  g.save();
  if (alpha < 1) g.globalAlpha = alpha;
  if (flip) {
    g.translate(dx + w, dy);
    g.scale(-1, 1);
    g.drawImage(sheet.canvas, col * sheet.fw, row * sheet.fh, sheet.fw, sheet.fh, 0, 0, w, h);
  } else {
    g.drawImage(sheet.canvas, col * sheet.fw, row * sheet.fh, sheet.fw, sheet.fh, dx, dy, w, h);
  }
  g.restore();

  if (flash > 0.02) {
    g.save();
    g.globalAlpha = Math.min(0.85, flash);
    g.globalCompositeOperation = 'lighter';
    if (flip) {
      g.translate(dx + w, dy);
      g.scale(-1, 1);
      g.drawImage(sheet.canvas, col * sheet.fw, row * sheet.fh, sheet.fw, sheet.fh, 0, 0, w, h);
    } else {
      g.drawImage(sheet.canvas, col * sheet.fw, row * sheet.fh, sheet.fw, sheet.fh, dx, dy, w, h);
    }
    g.restore();
  }
}

function enemySheet(e: Enemy): CharacterSheet {
  if (e.def.kind === 'creature' && e.def.creature) {
    return getCreatureSheet(creatureStyle(e.def.creature.kind, e.def.creature.palette, 1, e.def.creature.glow));
  }
  return getCharacterSheet(e.def.look!);
}

/* ------------------------------------------------------------------ */
/* Minimap                                                             */
/* ------------------------------------------------------------------ */

const minimapCache = new Map<string, HTMLCanvasElement>();

export function getMinimap(map: GameMap, step = 2): HTMLCanvasElement {
  const key = `${map.id}:${mapIdentity(map)}:${step}`;
  const hit = minimapCache.get(key);
  if (hit) return hit;
  const w = Math.ceil(map.w / step);
  const h = Math.ceil(map.h / step);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const id = map.tiles[Math.min(map.h - 1, y * step) * map.w + Math.min(map.w - 1, x * step)];
      const hex = TILES[id]?.map ?? '#000000';
      const n = parseInt(hex.slice(1), 16);
      const i = (y * w + x) * 4;
      img.data[i] = (n >> 16) & 255;
      img.data[i + 1] = (n >> 8) & 255;
      img.data[i + 2] = n & 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if(minimapCache.size>=12) minimapCache.delete(minimapCache.keys().next().value!);
  minimapCache.set(key, c);
  return c;
}

/* ------------------------------------------------------------------ */
/* Main render                                                         */
/* ------------------------------------------------------------------ */

interface Drawable {
  y: number;
  draw: () => void;
}

const lightBuffer = document.createElement('canvas');
const propIdx: number[] = [];

/** Seconds the death shake takes to die away; the world then fades to black over `DEATH_DARKEN`. */
export const DEATH_SETTLE = 2;
const DEATH_DARKEN = 1.2;

export function render(game: Game): void {
  const g = game.g;
  const { canvas, camera, map, player } = game;
  const zoom = camera.zoom;
  const viewW = canvas.width / zoom;
  const viewH = canvas.height / zoom;

  const shakeX = camera.shake ? (Math.random() - 0.5) * camera.shake : 0;
  const shakeY = camera.shake ? (Math.random() - 0.5) * camera.shake : 0;
  const camX = camera.x + shakeX;
  const camY = camera.y + shakeY;
  const left = camX - viewW / 2;
  const top = camY - viewH / 2;

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = map.outdoor ? '#0e1a24' : '#07060b';
  g.fillRect(0, 0, canvas.width, canvas.height);

  g.setTransform(zoom, 0, 0, zoom, Math.round(-left * zoom), Math.round(-top * zoom));
  // UI drawn over the world (prompts, nameplates, markers) is drawn in screen
  // space at the UI's own whole-pixel scale, not at the camera's zoom
  const ui = canvasUiScale();
  const ox = Math.round(-left * zoom);
  const oy = Math.round(-top * zoom);
  const toScreen = (wx: number, wy: number): [number, number] => [Math.round(wx * zoom + ox), Math.round(wy * zoom + oy)];

  // terrain
  const c0x = Math.floor(left / CHUNK_PX);
  const c1x = Math.floor((left + viewW) / CHUNK_PX);
  const c0y = Math.floor(top / CHUNK_PX);
  const c1y = Math.floor((top + viewH) / CHUNK_PX);
  for (let cy = c0y; cy <= c1y; cy++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      if (cx < 0 || cy < 0 || cx * CHUNK >= map.w || cy * CHUNK >= map.h) continue;
      // Shared pixel-aligned edges prevent faint gaps between cached chunks
      // when the naval or boss camera uses a fractional zoom.
      const x0 = Math.round(cx * CHUNK_PX * zoom) / zoom;
      const y0 = Math.round(cy * CHUNK_PX * zoom) / zoom;
      const x1 = Math.round((cx + 1) * CHUNK_PX * zoom) / zoom;
      const y1 = Math.round((cy + 1) * CHUNK_PX * zoom) / zoom;
      g.drawImage(renderChunk(map, cx, cy), x0, y0, x1 - x0, y1 - y0);
    }
  }

  // animated water shimmer
  if (map.outdoor) {
    const t = game.now;
    g.save();
    g.globalAlpha = 0.25;
    const tx0 = Math.floor(left / TILE);
    const tx1 = Math.ceil((left + viewW) / TILE);
    const ty0 = Math.floor(top / TILE);
    const ty1 = Math.ceil((top + viewH) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) continue;
        const id = map.tiles[ty * map.w + tx];
        if (!isWater(id) || isMarine(id)) continue;
        const phase = Math.sin(t * 1.6 + tx * 0.6 + ty * 0.4);
        if (phase < 0.55) continue;
        g.fillStyle = id === T.SWAMP_WATER ? PAL.toxic : PAL.foam;
        const off = Math.round((Math.sin(t + tx) + 1) * 6);
        g.fillRect(tx * TILE + 4, ty * TILE + 8 + off, 10, 1);
        g.fillRect(tx * TILE + 18, ty * TILE + 20 - off, 8, 1);
      }
    }
    g.restore();
    if ((map.id === 'overworld' && left + viewW >= 960 * TILE) || map.id.startsWith('aegean_'))
      drawMarine(g, map, left, top, viewW, viewH, t, getMarineBankMasks());
  }

  // gather drawables
  const drawables: Drawable[] = [];
  // Include the full 372×266 royal temple while retaining spatial buckets.
  propsInRect(map, left - 200, top - 200, left + viewW + 200, top + viewH + 300, propIdx);

  for (const i of propIdx) {
    const prop = map.props[i];
    if (prop.x < left - 210 || prop.x > left + viewW + 210 || prop.y < top - 260 || prop.y > top + viewH + 300) continue;
    if (prop.art.startsWith('bld:')) {
      const art = getBuilding(prop.art.slice(4));
      const dx = Math.round(prop.x - art.w / 2);
      const dy = Math.round(prop.y - art.h + 4);
      drawables.push({ y: prop.y, draw: () => g.drawImage(art.canvas, dx, dy) });
      continue;
    }
    const art = getProp(prop.art);
    const frame = art.frames > 1 ? Math.floor((game.now + (prop.phase ?? 0)) * art.fps) % art.frames : 0;
    const dx = Math.round(prop.x - art.fw / 2);
    const dy = Math.round(prop.y - art.anchorY);
    const sway = !prop.flat && art.fh > 40 ? Math.sin(game.now * 0.8 + prop.x * 0.01) * 0.6 : 0;
    const drawFn = () => {
      if (sway !== 0) {
        g.save();
        g.translate(prop.x, prop.y);
        g.transform(1, 0, sway * 0.02, 1, 0, 0);
        g.translate(-prop.x, -prop.y);
        g.drawImage(art.canvas, frame * art.fw, 0, art.fw, art.fh, dx, dy, art.fw, art.fh);
        g.restore();
      } else {
        g.drawImage(art.canvas, frame * art.fw, 0, art.fw, art.fh, dx, dy, art.fw, art.fh);
      }
    };
    if (prop.flat) drawFn();
    else drawables.push({ y: prop.y, draw: drawFn });
  }

  // chests
  for (const c of game.chests) {
    if (c.x < left - 60 || c.x > left + viewW + 60 || c.y < top - 60 || c.y > top + viewH + 60) continue;
    const art = getProp(c.tier === 'boss' ? (c.opened ? 'chest_gold_open' : 'chest_gold') : c.opened ? 'chest_open' : 'chest');
    const dx = Math.round(c.x - art.fw / 2);
    const dy = Math.round(c.y - art.anchorY);
    drawables.push({
      y: c.y,
      draw: () => {
        if (!c.opened) {
          const pulse = 0.4 + 0.25 * Math.sin(game.now * 3);
          g.save();
          g.globalAlpha = pulse * 0.5;
          g.fillStyle = c.tier === 'boss' ? PAL.goldLit : PAL.gold;
          g.beginPath();
          g.ellipse(c.x, c.y - 4, 18, 7, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
        g.drawImage(art.canvas, dx, dy);
      },
    });
  }

  // pickups
  for (const it of game.pickups) {
    if (!it.item && it.gold <= 0) continue;
    const icon = it.item
      ? getIcon(it.item.icon, { metal: it.item.iconMetal, accent: it.item.iconAccent, glow: it.item.glow })
      : getIcon('gold');
    const bob = Math.sin(game.now * 3 + it.id) * 2;
    const dy = Math.round(it.y - it.z - 16 + bob);
    const dx = Math.round(it.x - 16);
    const rare = it.item && it.item.rarity !== 'common' && it.item.rarity !== 'rare';
    drawables.push({
      y: it.y,
      draw: () => {
        g.save();
        g.globalAlpha = 0.3;
        g.fillStyle = '#0a0810';
        g.beginPath();
        g.ellipse(it.x, it.y, 8, 3, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
        if (rare) {
          // A beam in the item's rarity colour, visible across the room. The
          // whole point of a good drop is spotting it from a distance.
          const beam = RARITY_COLOR[it.item!.rarity];
          const pulse = 0.5 + 0.25 * Math.sin(game.now * 4 + it.id);
          g.save();
          const grad = g.createLinearGradient(it.x, it.y - 120, it.x, it.y);
          grad.addColorStop(0, withAlpha(beam, 0));
          grad.addColorStop(1, withAlpha(beam, 0.5 * pulse));
          g.fillStyle = grad;
          g.fillRect(it.x - 7, it.y - 120, 14, 120);
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = pulse;
          g.fillStyle = beam;
          g.beginPath();
          g.ellipse(it.x, it.y, 13, 5, 0, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 0.35 + 0.2 * Math.sin(game.now * 4);
          g.beginPath();
          g.ellipse(it.x, dy + 16, 16, 16, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
        g.drawImage(icon, dx, dy, 32, 32);
      },
    });
  }

  // npcs
  for (const n of game.npcs) {
    if (n.x < left - 80 || n.x > left + viewW + 80 || n.y < top - 100 || n.y > top + viewH + 100) continue;
    const sheet = getCharacterSheet(n.def.look);
    drawables.push({
      y: n.y,
      draw: () => {
        drawActor(g, sheet, n.anim, n.animTime, n.dir, n.x, n.y + 6, 1, 0, 1);
        if (n.def.quests?.length) {
          const hasOffer = n.def.quests.some((q) => {
            const def = game.quests;
            return !def.isActive(q) && !def.isCompleted(q);
          });
          const ready = game.quests.active.some((aq) => {
            const qd = aq.id;
            return game.quests.isComplete(qd, player) && (game.questGiverFor(qd) === n.def.id);
          });
          if (hasOffer || ready) {
            // a two-step bob: pixel art does not float, it hops
            const bob = Math.sin(game.now * 3) > 0 ? 0 : 1;
            const [sx, sy] = toScreen(n.x, n.y - 44);
            g.save();
            g.setTransform(1, 0, 0, 1, 0, 0);
            setFont(g, ui, 20, false, true);
            pixelText(g, ready ? '?' : '!', sx, sy - bob * ui, ui, {
              color: ready ? PAL.toxic : PAL.flameLit, outline: PAL.void, align: 'center',
            });
            g.restore();
          }
        }
      },
    });
  }

  // enemies
  for (const e of game.enemies) {
    if (e.x < left - 160 || e.x > left + viewW + 160 || e.y < top - 200 || e.y > top + viewH + 160) continue;
    const sheet = enemySheet(e);
    const scale = e.def.scale ?? 1;
    drawables.push({
      y: e.y,
      draw: () => {
        drawActor(g, sheet, e.hurtTime > 0 ? 'hurt' : e.anim, e.animTime, e.dir, e.x, e.y + 6, scale, e.flash, e.friendly ? 0.75 : 1);
        // health bar for damaged or notable enemies
        if ((e.hp < e.maxHp || e.elite) && !e.isBoss) {
          const w = Math.max(24, e.radius * 2.2);
          const hx = Math.round(e.x - w / 2);
          const hy = Math.round(e.y - sheet.fh * scale + 12);
          g.fillStyle = 'rgba(8,6,12,0.75)';
          g.fillRect(hx - 1, hy - 1, w + 2, 5);
          g.fillStyle = e.elite ? '#f0a93c' : '#b5462f';
          g.fillRect(hx, hy, Math.max(0, (e.hp / e.maxHp) * w), 3);
        }
        for (const s of e.statuses) {
          if (s.kind === 'burn' || s.kind === 'poison') {
            if (Math.random() < 0.25) game.particles(e.x + (Math.random() - 0.5) * 12, e.y - 6, 1, s.color, { speed: 20, life: 0.4, size: 2, gravity: -50 });
          }
        }
      },
    });
  }

  game.aegeanHazards.draw(g);
  game.encounters.draw(g);
  game.activities.draw(g);
  // A purchased hull remains beside its pier after the player steps ashore.
  // The same drawable becomes the active boat, so boarding never duplicates it.
  const shipPosition = game.naval.drawPosition;
  if (shipPosition && shipPosition.x >= left - 160 && shipPosition.x <= left + viewW + 160 &&
    shipPosition.y >= top - 160 && shipPosition.y <= top + viewH + 160)
    drawables.push({ y: shipPosition.y, draw: () => game.naval.draw(g) });
  // player
  if(!game.naval.aboard) {
    const sheet = getCharacterSheet(player.look());
    drawables.push({
      y: player.y + 1,
      draw: () => {
        const alpha = player.invuln > 0 && Math.floor(game.now * 20) % 2 === 0 ? 0.55 : 1;
        drawActor(g, sheet, player.anim, player.animTime, player.dir, player.x, player.y + 6, 1, player.flash, alpha);
        if (player.shield > 0) {
          g.save();
          g.globalAlpha = 0.35 + 0.15 * Math.sin(game.now * 5);
          g.strokeStyle = PAL.arcaneLit;
          g.lineWidth = 2;
          g.beginPath();
          g.ellipse(player.x, player.y - 12, 22, 26, 0, 0, Math.PI * 2);
          g.stroke();
          g.restore();
        }
        if (player.blocking || player.bracing) {
          g.save();
          g.globalAlpha = 0.5;
          g.strokeStyle = PAL.steel;
          g.lineWidth = 3;
          const aim = player.bracing ? player.facing : Math.atan2(game.input.world.y - player.y, game.input.world.x - player.x);
          g.beginPath();
          g.arc(player.x, player.y - 8, 26, aim - 0.7, aim + 0.7);
          g.stroke();
          g.restore();
        }
      },
    });
  }

  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  // auto-aim reticle, so it is always obvious what the next swing will hit
  const lock = game.lockTarget;
  if (lock && !lock.dead) {
    const t = game.now * 3;
    g.save();
    g.globalAlpha = 0.5 + 0.2 * Math.sin(t * 2);
    g.strokeStyle = '#f0c93c';
    g.lineWidth = 1.5;
    const r = lock.radius + 7;
    for (let i = 0; i < 4; i++) {
      const a = t * 0.6 + (i / 4) * Math.PI * 2;
      g.beginPath();
      g.arc(lock.x, lock.y, r, a, a + 0.5);
      g.stroke();
    }
    g.restore();
  }

  // ground zones
  for (const z of game.groundZones) {
    g.save();
    g.globalAlpha = 0.2 + 0.1 * Math.sin(game.now * 6);
    g.fillStyle = z.color;
    g.beginPath();
    g.ellipse(z.x, z.y, z.r, z.r * 0.6, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // projectiles and effects
  for (const p of game.projectiles) drawProjectile(g, p, game.now);
  game.fx.draw(g);

  // lighting
  drawLighting(game, g, left, top, viewW, viewH);

  // Interaction prompt, nameplates and floating words share one layout: the
  // prompt claims its box first, a nameplate under it steps aside (the
  // prompt already names the thing), and floating words climb clear of both
  // and of each other instead of printing on top.
  const taken: ScreenRect[] = [];
  let prompt: { key: string; label: string; sx: number; sy: number } | null = null;
  if (game.interact) {
    // No key to name when there is no keyboard — the USE button says it.
    const key = game.input.touchMode ? 'USE' : game.input.keyLabel('interact');
    const [sx, sy] = toScreen(game.interact.x, game.interact.y - 6);
    prompt = { key, label: game.interact.label, sx, sy };
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    taken.push(promptBox(g, key, prompt.label, sx, sy, ui).screen);
    g.restore();
  }

  drawNameplates(game, g, propIdx, toScreen, ui, taken);
  if (prompt) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    drawPrompt(g, prompt.key, prompt.label, prompt.sx, prompt.sy, ui);
    g.restore();
  }
  game.fx.drawText(g, toScreen, ui, taken);
  drawTrackedCompass(game, g, left, top, viewW, viewH, toScreen, ui);

  if (game.debug) drawDebug(game, g, left, top, viewW, viewH);

  g.setTransform(1, 0, 0, 1, 0, 0);

  game.aegeanHazards.drawWeather(g, canvas.width, canvas.height);

  // payoff flash — level ups, big drops, streak milestones
  if (game.screenFlash.alpha > 0.005) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.min(0.55, game.screenFlash.alpha);
    g.fillStyle = game.screenFlash.color;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.restore();
  }

  drawStreak(game, g);
  if (game.minimapCanvas && game.showMinimap && game.screen === 'playing' && game.fade.alpha < 0.5) drawMinimapInto(game, game.minimapCanvas);

  if (game.fade.alpha > 0.001) {
    g.save();
    g.globalAlpha = Math.min(1, game.fade.alpha);
    g.fillStyle = PAL.void;
    g.fillRect(0, 0, canvas.width, canvas.height);
    if (game.fade.label && game.fade.alpha > 0.6) {
      // the destination, lettered in the UI font while the screen is dark
      g.globalAlpha = Math.ceil(Math.min(1, (game.fade.alpha - 0.6) / 0.4) * 3) / 3;
      setFont(g, ui, 20, false, true);
      pixelText(g, game.fade.label.toUpperCase(), canvas.width / 2, canvas.height / 2, ui, { color: PAL.goldLit, shadow: PAL.emberDark, align: 'center' });
    }
    g.restore();
  }

  // fallen: once the shake has settled, the world goes dark under the death screen
  if (game.screen === 'dead' && game.deadFor > DEATH_SETTLE) {
    g.save();
    g.globalAlpha = Math.min(1, (game.deadFor - DEATH_SETTLE) / DEATH_DARKEN);
    g.fillStyle = PAL.void;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.restore();
  }
}

/**
 * Permanent labels over the props that carry one — shop signs, the waystone,
 * the anvil. They fade in as you approach and never need interacting with, so
 * a settlement tells you what it holds from the middle of the square.
 */
function drawNameplates(
  game: Game, g: CanvasRenderingContext2D, propIdx: number[],
  toScreen: (x: number, y: number) => [number, number], k: number,
  taken: ScreenRect[],
): void {
  const p = game.player;
  const props = game.map.props;
  const prompts = taken.slice();
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  setFont(g, k, 10, true);
  for (const i of propIdx) {
    const pr = props[i];
    if (!pr.nameplate) continue;
    const d = Math.hypot(pr.x - p.x, pr.y - p.y);
    if (d > 460) continue;
    // fade in three hard steps rather than a smooth ramp
    const alpha = Math.ceil(Math.min(1, (460 - d) / 110) * 3) / 3;
    const color = pr.nameplateColor ?? PAL.cloth;
    const text = pr.nameplate.toUpperCase();
    const tw = Math.round(g.measureText(text).width / k);
    const w = tw + 6;
    const [sx, sy] = toScreen(pr.x, pr.y - 44);
    const x = Math.round(sx - (w * k) / 2);
    const y = sy - 12 * k;
    const box = { x: x - k, y: y - k, w: (w + 2) * k, h: 14 * k };
    if (prompts.some((r) => rectsOverlap(r, box))) continue;
    taken.push(box);
    g.globalAlpha = alpha;
    g.fillStyle = PAL.void;
    g.fillRect(x - k, y - k, (w + 2) * k, 12 * k);
    g.fillStyle = PAL.charcoal;
    g.fillRect(x, y, w * k, 10 * k);
    g.fillStyle = color;
    g.fillRect(x, y + 9 * k, w * k, k);
    // a small tick pointing down at the door
    g.fillStyle = PAL.void;
    g.fillRect(Math.round(sx - k), y + 11 * k, 3 * k, k);
    g.fillRect(Math.round(sx), y + 12 * k, k, k);
    pixelText(g, text, sx, y + 8 * k, k, { color, align: 'center' });
  }
  g.restore();
}

const STREAK_TIERS = [
  { at: 20, color: PAL.goldLit, word: 'UNSTOPPABLE' },
  { at: 12, color: PAL.flame, word: 'RAMPAGE' },
  { at: 7, color: PAL.toxic, word: 'ON A TEAR' },
  { at: 4, color: PAL.frost, word: 'STREAK' },
];

/**
 * The streak readout. It lives above the hotbar, grows with the tier, and its
 * timer bar drains in real time — the drain is what makes you push for one
 * more kill instead of backing off.
 */
function drawStreak(game: Game, g: CanvasRenderingContext2D): void {
  if (game.streak < 3 || game.screen !== 'playing') return;
  const left = game.streakUntil - game.now;
  if (left <= 0) return;
  const k = canvasUiScale();
  const tier = STREAK_TIERS.find((t) => game.streak >= t.at);
  const color = tier?.color ?? PAL.bone;
  const word = tier?.word ?? 'STREAK';
  const cx = Math.round(game.canvas.width / 2);
  const y = game.canvas.height - 64 * k;
  // the number hops up two pixels on each new kill instead of scaling
  const pop = game.now - (game.streakUntil - 4) < 0.12 ? 2 : 0;

  g.save();
  setFont(g, k, 20, false, true);
  pixelText(g, `${game.streak}`, cx, y - pop * k, k, { color, outline: PAL.void, align: 'center' });
  setFont(g, k, 10, true);
  pixelText(g, word, cx, y + 8 * k, k, { color, shadow: PAL.void, align: 'center' });
  // drain bar, in whole pixels
  const bw = 40;
  const fill = Math.round(bw * Math.max(0, Math.min(1, left / 4)));
  const bx = cx - (bw / 2) * k;
  g.fillStyle = PAL.void;
  g.fillRect(bx - k, y + 11 * k, (bw + 2) * k, 4 * k);
  g.fillStyle = PAL.charcoal;
  g.fillRect(bx, y + 12 * k, bw * k, 2 * k);
  g.fillStyle = color;
  g.fillRect(bx, y + 12 * k, fill * k, 2 * k);
  g.restore();
}

function drawLighting(game: Game, g: CanvasRenderingContext2D, left: number, top: number, viewW: number, viewH: number): void {
  const map = game.map;
  const night = game.nightFactor;
  const darkness = map.outdoor ? night * 0.72 : map.darkness;
  if (darkness < 0.02) {
    // subtle daytime warmth
    if (map.outdoor) {
      const h = game.hour;
      if (h > 16 && h < 20) {
        g.save();
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = `rgba(255,190,130,${0.12 + (h - 16) * 0.04})`;
        g.fillRect(left, top, viewW, viewH);
        g.restore();
      }
    }
    return;
  }

  // Battery saver halves the light buffer in each axis — a quarter of the
  // pixels to fill and blend — and the result is scaled back up on the way
  // out. Light is a soft gradient, so the lost resolution is invisible.
  const saver = game.settings.batterySaver;
  const scale = saver ? 0.5 : 1;
  const w = Math.max(1, Math.ceil(viewW * scale));
  const h = Math.max(1, Math.ceil(viewH * scale));
  if (lightBuffer.width !== w || lightBuffer.height !== h) {
    lightBuffer.width = w;
    lightBuffer.height = h;
  }
  const lg = lightBuffer.getContext('2d')!;
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.clearRect(0, 0, w, h);
  lg.fillStyle = map.outdoor ? `rgba(12,16,34,${darkness})` : `rgba(6,5,12,${darkness})`;
  lg.fillRect(0, 0, w, h);

  lg.globalCompositeOperation = 'destination-out';
  const addLight = (worldX: number, worldY: number, worldR: number, strength = 1) => {
    // world -> screen -> buffer, which is the screen scaled down in saver mode
    const sx = (worldX - left) * scale;
    const sy = (worldY - top) * scale;
    const radius = worldR * scale;
    if (sx < -radius || sy < -radius || sx > w + radius || sy > h + radius) return;
    const grad = lg.createRadialGradient(sx, sy, 0, sx, sy, radius);
    grad.addColorStop(0, `rgba(255,255,255,${0.95 * strength})`);
    grad.addColorStop(0.55, `rgba(255,255,255,${0.5 * strength})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    lg.fillStyle = grad;
    lg.beginPath();
    lg.arc(sx, sy, radius, 0, Math.PI * 2);
    lg.fill();
  };

  const flicker = 1 + Math.sin(game.now * 9) * 0.04 + Math.sin(game.now * 21) * 0.02;
  addLight(game.player.x, game.player.y - 10, (map.outdoor ? 190 : 130) * flicker, 0.92);
  for (const i of propIdx) {
    const prop = game.map.props[i];
    if (!prop.light) continue;
    addLight(prop.x, prop.y - 16, prop.light * flicker * (map.outdoor ? 1 : 0.78), 0.95);
  }
  if (!saver) {
    // incidental lights: every shot in flight, every burning patch of ground,
    // every glowing creature. Atmosphere, and the cheapest thing to drop.
    for (const p of game.projectiles) addLight(p.x, p.y, 60, 0.6);
    for (const z of game.groundZones) addLight(z.x, z.y, z.r * 1.2, 0.5);
    for (const e of game.enemies) {
      if (e.def.creature?.glow || e.isBoss) addLight(e.x, e.y - 10, 90, 0.5);
    }
  }

  lg.globalCompositeOperation = 'source-over';
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(lightBuffer, 0, 0, w, h, 0, 0, game.canvas.width, game.canvas.height);
  if (!saver) {
    // coloured light wash on top for atmosphere
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = (map.outdoor ? 0.07 : 0.12) * darkness;
    g.fillStyle = map.outdoor ? '#3f5a94' : '#c86a2a';
    g.fillRect(0, 0, game.canvas.width, game.canvas.height);
  }
  g.restore();
  g.setTransform(game.camera.zoom, 0, 0, game.camera.zoom, Math.round(-left * game.camera.zoom), Math.round(-top * game.camera.zoom));
}

/** The original compass points to a harbour while sailing, or the tracked quest on foot. */
function drawTrackedCompass(
  game: Game, g: CanvasRenderingContext2D, left: number, top: number, viewW: number, viewH: number,
  toScreen: (x: number, y: number) => [number, number], k: number,
): void {
  const landing = game.naval.landingGuide();
  const guided = shipGuidanceTarget(game);
  const target = guided ?? (landing ? { ...landing.approach, name: `Harbour: ${landing.port.name}` } : game.trackedTarget());
  if (!target || (!guided && game.map.id !== 'overworld')) return;
  const p = game.player;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const distPx = Math.hypot(dx, dy);
  if (distPx < (guided ? 65 : 260)) return;

  const angle = Math.atan2(dy, dx);
  const radius = Math.min(viewW, viewH) * 0.36;
  const cx = p.x + Math.cos(angle) * radius;
  const cy = p.y + Math.sin(angle) * radius;
  const clampedX = Math.max(left + 30, Math.min(left + viewW - 30, cx));
  // keep the arrow and the name lettered under it clear of the ability bar:
  // bar (~48 UI px with its key caps) + the label 20-30 UI px below the arrow
  const barClear = (84 * k) / game.camera.zoom;
  const clampedY = Math.max(top + 30, Math.min(top + viewH - Math.max(42, barClear), cy));

  g.save();
  g.translate(clampedX, clampedY);
  g.globalAlpha = Math.sin(game.now * 3) > 0 ? 0.85 : 0.6;
  g.rotate(angle);
  g.fillStyle = PAL.goldLit;
  g.beginPath();
  g.moveTo(11, 0);
  g.lineTo(-6, -7);
  g.lineTo(-3, 0);
  g.lineTo(-6, 7);
  g.closePath();
  g.fill();
  g.restore();

  const [sx, sy] = toScreen(clampedX, clampedY);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  setFont(g, k, 10);
  pixelText(g, `${target.name} ${Math.round(distPx / 32)}m`, sx, sy + 20 * k, k, { color: PAL.bone, outline: PAL.void, align: 'center' });
  if (landing) {
    // Landscape touch layouts hide the journal tracker and toast subtitles.
    const useKey = game.input.touchMode ? 'USE' : game.input.keyLabel('interact');
    pixelText(g, `Harbours only · ${useKey} to land nearby`, sx, sy + 32 * k, k, { color: PAL.fog, outline: PAL.void, align: 'center' });
  }
  g.restore();
}

/** Side of the HUD minimap square, in UI pixels. */
export const MINIMAP_SIZE = 104;

/**
 * The minimap, drawn into the HUD's own canvas (see `ui/hud/Minimap.tsx`)
 * rather than onto the world, so its frame and plaque are ordinary UI. The
 * canvas is sized in device pixels; `m` is device pixels per UI pixel.
 */
export function drawMinimapInto(game: Game, canvas: HTMLCanvasElement): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const size = canvas.width;
  const m = Math.max(1, Math.round(size / MINIMAP_SIZE));
  const map = game.map;
  const overworld = map.id === 'overworld';
  const step = overworld ? 2 : 1;
  const mini = getMinimap(map, step);
  // how much map the square shows, in minimap pixels
  const span = overworld ? 420 : 166;
  const scale = size / span;
  const px = (game.player.x / TILE / step) - span / 2;
  const py = (game.player.y / TILE / step) - span / 2;

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = PAL.ink;
  g.fillRect(0, 0, size, size);
  g.drawImage(mini, px, py, span, span, 0, 0, size, size);

  const toMini = (wx: number, wy: number): [number, number] => [
    Math.round(((wx / TILE / step) - px) * scale),
    Math.round(((wy / TILE / step) - py) * scale),
  ];
  const dot = (x: number, y: number, r: number, color: string) => {
    g.fillStyle = PAL.void;
    g.fillRect(x - r * m - m, y - r * m - m, (r * 2 + 2) * m, (r * 2 + 2) * m);
    g.fillStyle = color;
    g.fillRect(x - r * m, y - r * m, r * 2 * m, r * 2 * m);
  };

  if (overworld) {
    for (const loc of LOCATIONS) {
      if (!game.player.discovered.has(loc.id)) continue;
      const [mx, my] = toMini(loc.tx * TILE, loc.ty * TILE);
      if (mx < 0 || mx > size || my < 0 || my > size) continue;
      dot(mx, my, 1, loc.kind === 'town' || loc.kind === 'village' ? PAL.flameLit : loc.kind === 'dungeon' || loc.kind === 'cave' ? PAL.ember : PAL.frost);
    }
  }
  for (const n of game.npcs) {
    const [mx, my] = toMini(n.x, n.y);
    g.fillStyle = PAL.toxic;
    g.fillRect(mx - m, my - m, m * 2, m * 2);
  }
  for (const e of game.enemies) {
    if (e.friendly) continue;
    const [mx, my] = toMini(e.x, e.y);
    if (e.isBoss) dot(mx, my, 2, PAL.ember);
    else {
      g.fillStyle = e.elite ? PAL.flame : PAL.blood;
      g.fillRect(mx - m, my - m, m * 2, m * 2);
    }
  }
  for (const c of game.chests) {
    if (c.opened) continue;
    const [mx, my] = toMini(c.x, c.y);
    g.fillStyle = PAL.gold;
    g.fillRect(mx - m, my - m, m * 2, m * 2);
  }
  const tracked = game.trackedTarget();
  if (tracked && overworld) {
    const [mx, my] = toMini(tracked.x, tracked.y);
    // a hollow square that blinks, not a soft pulsing ring
    if (Math.sin(game.now * 6) > -0.3) {
      g.fillStyle = PAL.goldLit;
      const r = 3 * m;
      g.fillRect(mx - r, my - r, r * 2, m);
      g.fillRect(mx - r, my + r - m, r * 2, m);
      g.fillRect(mx - r, my - r, m, r * 2);
      g.fillRect(mx + r - m, my - r, m, r * 2);
    }
  }
  // the player: a white cross with a void edge
  const [cx, cy] = toMini(game.player.x, game.player.y);
  g.fillStyle = PAL.void;
  g.fillRect(cx - 2 * m, cy - m, 4 * m + m, 3 * m);
  g.fillRect(cx - m, cy - 2 * m, 3 * m, 4 * m + m);
  g.fillStyle = PAL.white;
  g.fillRect(cx - m, cy, 3 * m, m);
  g.fillRect(cx, cy - m, m, 3 * m);
}

function drawDebug(game: Game, g: CanvasRenderingContext2D, left: number, top: number, viewW: number, viewH: number): void {
  g.save();
  g.strokeStyle = 'rgba(255,0,128,0.65)';
  g.lineWidth = 1;
  for (const i of propIdx) {
    const p = game.map.props[i];
    if (!p.cw || !p.ch) continue;
    g.strokeRect(p.x - p.cw / 2, p.y - p.ch, p.cw, p.ch);
  }
  g.strokeStyle = 'rgba(0,255,255,0.7)';
  g.strokeRect(game.player.x - 8, game.player.y - 6, 16, 12);
  for (const e of game.enemies) {
    g.strokeStyle = 'rgba(255,80,80,0.7)';
    g.beginPath();
    g.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(e.x, e.y);
    g.lineTo(e.homeX, e.homeY);
    g.globalAlpha = 0.25;
    g.stroke();
    g.globalAlpha = 1;
  }
  void left; void top; void viewW; void viewH;
  g.restore();
}

export { drawActor, frameFor };
