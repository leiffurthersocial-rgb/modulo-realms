import { RNG } from '../core/rng';
import { PAL, mix, shade, withAlpha } from './palette';
import { Px, type Canvas } from './pixel';

export interface BuildingArt {
  canvas: Canvas;
  w: number;
  h: number;
  /** Door centre, in sprite coordinates. */
  doorX: number;
  doorY: number;
  /** Solid footprint at the base of the sprite. */
  footW: number;
  footH: number;
  sign?: string;
  /** Lit windows in sprite coordinates, [x, y, w, h] — they glow after dark. */
  windows?: Array<[number, number, number, number]>;
  /** Top of the chimney stack in sprite coordinates, where smoke leaves it. */
  chimney?: [number, number];
  /**
   * Rows of headroom at the top of `canvas` for finials. `h` stays the height
   * the town was laid out against, so placement never moves; the renderer
   * lifts the canvas by this much.
   */
  padTop?: number;
}

export interface BuildingOpts {
  w: number;
  h: number;
  wall: string;
  wallDark: string;
  roof: string;
  roofDark: string;
  /** 'shingle' | 'thatch' | 'tile' | 'snow' | 'canvas' */
  roofStyle?: 'shingle' | 'thatch' | 'tile' | 'snow' | 'canvas';
  wallStyle?: 'plank' | 'stone' | 'plaster' | 'log';
  chimney?: boolean;
  storeys?: 1 | 2;
  windows?: number;
  sign?: 'anvil' | 'mug' | 'coin' | 'potion' | 'book' | 'shield' | null;
  banner?: boolean;
  lamps?: boolean;
  ruined?: boolean;
  /**
   * Nobody is home and nobody ever will be. Boards the door, closes every
   * shutter and drops the handle, so a player can tell at a glance that this
   * house has no interior without walking up to try it.
   */
  shuttered?: boolean;
  /** Painted or gilt trim: barge boards, finials, keystones. */
  trim?: string;
  /** Colour of the open shutters beside lit windows. */
  shutterColor?: string;
  /** Window boxes under the ground-floor windows. */
  flowers?: boolean;
  /** A striped canvas awning over the door: [stripe, ground]. */
  awning?: [string, string];
  /** Ivy up one corner. */
  ivy?: boolean;
  /** A small gabled dormer window in the roof. */
  dormer?: boolean;
  /** Moss in the roof and stains down the wall: nobody has kept this up. */
  weathered?: boolean;
  /** 'gable' puts a timbered gable end on the front of the roof. */
  roofForm?: 'hip' | 'gable';
  /** Where along the roof the chimney stands, 0..1 from the left. */
  chimneyAt?: number;
}

function wallTexture(p: Px, x: number, y: number, w: number, h: number, o: BuildingOpts, rng: RNG) {
  const { wall, wallDark } = o;
  p.fill(x, y, w, h, wall);
  const style = o.wallStyle ?? 'plank';
  if (style === 'plank') {
    for (let i = y; i < y + h; i += 6) {
      p.fill(x, i, w, 1, wallDark);
      p.fill(x, i + 1, w, 1, shade(wall, 1.1));
    }
    for (let i = 0; i < w / 10; i++) p.fill(x + rng.int(0, w - 1), y, 1, h, shade(wall, 0.9));
  } else if (style === 'log') {
    for (let i = y; i < y + h; i += 7) {
      p.fill(x, i, w, 6, shade(wall, 1.05));
      p.fill(x, i + 5, w, 1, wallDark);
      p.fill(x, i, w, 1, shade(wall, 1.18));
    }
  } else if (style === 'stone') {
    for (let iy = y; iy < y + h; iy += 7) {
      const off = ((iy - y) / 7) % 2 === 0 ? 0 : 7;
      for (let ix = x - 14; ix < x + w; ix += 14) {
        const cx = Math.max(x, ix + off);
        const cw = Math.min(13, x + w - cx);
        if (cw <= 0) continue;
        const c = mix(wall, rng.bool() ? shade(wall, 1.15) : wallDark, rng.range(0, 0.5));
        p.fill(cx, iy, cw, 6, c);
        p.fill(cx, iy, cw, 1, shade(c, 1.12));
      }
    }
  } else {
    // plaster with exposed timber frame
    p.fill(x, y, w, h, wall);
    p.speckle(x, y, w, h, [shade(wall, 0.95), shade(wall, 1.05)], 0.06, rng);
    p.fill(x, y, w, 2, o.wallDark);
    p.fill(x, y + h - 2, w, 2, o.wallDark);
    for (let i = 0; i <= 4; i++) p.fill(x + Math.round((i * (w - 3)) / 4), y, 3, h, o.wallDark);
    for (let i = 0; i < 3; i++) p.line(x + (i * w) / 3, y + h, x + ((i + 1) * w) / 3, y, o.wallDark);
  }
}

/** Rows above the roof peak kept free for finials and dormer spikes. */
export const ROOF_PAD = 6;

function roofShape(p: Px, o: BuildingOpts, rng: RNG, roofH: number) {
  const { w } = o;
  const overhang = 4;
  const style = o.roofStyle ?? 'shingle';
  const peakW = Math.round(w * 0.16);
  const left = -overhang;
  const right = w + overhang;
  const peakL = Math.round(w / 2 - peakW / 2);
  const peakR = Math.round(w / 2 + peakW / 2);
  const edgeX = (y: number, side: -1 | 1) => {
    const t = y / roofH;
    return side < 0 ? left * t + peakL * (1 - t) : right * t + peakR * (1 - t);
  };

  p.poly([[left, roofH], [peakL, 0], [peakR, 0], [right, roofH]], o.roofDark);

  if (style === 'thatch') {
    for (let y = 0; y < roofH; y++) {
      const x0 = edgeX(y, -1);
      const x1 = edgeX(y, 1);
      const c = mix(o.roof, o.roofDark, (Math.sin(y * 0.9) + 1) * 0.25);
      p.fill(x0, y, x1 - x0, 1, c);
      if (y % 4 === 0) for (let k = 0; k < (x1 - x0) / 6; k++) p.set(x0 + rng.int(0, x1 - x0), y, shade(o.roof, 1.2));
      if (y % 3 === 1) for (let k = 0; k < (x1 - x0) / 9; k++) p.fill(x0 + rng.int(0, x1 - x0), y, 1, 2, shade(o.roofDark, 0.85));
    }
    // a combed, rolled ridge of straw
    p.fill(peakL - 3, 0, peakW + 6, 4, shade(o.roof, 0.9));
    for (let x = peakL - 3; x < peakR + 3; x += 3) p.fill(x, 3, 2, 2, shade(o.roofDark, 0.9));
  } else if (style === 'canvas') {
    for (let y = 0; y < roofH; y++) {
      const x0 = edgeX(y, -1);
      const x1 = edgeX(y, 1);
      const stripe = Math.floor((y / roofH) * 6) % 2 === 0;
      p.fill(x0, y, x1 - x0, 1, stripe ? o.roof : o.roofDark);
    }
  } else {
    // Every shingle is its own shade, a hair apart. A flat colour field
    // is what made the valley's roofs read as cardboard.
    const rowH = style === 'tile' ? 5 : 4;
    for (let y = 0; y < roofH; y += rowH) {
      const x0 = edgeX(y, -1);
      const x1 = edgeX(y, 1);
      const rowColor = mix(o.roof, o.roofDark, (y / roofH) * 0.35);
      p.fill(x0, y, x1 - x0, rowH - 1, rowColor);
      p.fill(x0, y + rowH - 1, x1 - x0, 1, o.roofDark);
      const tileW = style === 'tile' ? 8 : 10;
      const off = ((y / rowH) % 2) * (tileW / 2);
      for (let x = x0 + off - tileW; x < x1; x += tileW) {
        const cx0 = Math.max(x0, x);
        const cw = Math.min(x1, x + tileW) - cx0;
        if (cw <= 1) continue;
        p.fill(cx0, y, cw - 1, rowH - 1, shade(rowColor, rng.range(0.9, 1.1)));
        p.fill(cx0, y, cw - 1, 1, shade(rowColor, 1.12));
        if (style === 'tile') p.fill(cx0 + cw - 2, y, 1, rowH - 1, shade(rowColor, 0.72));
      }
    }
  }
  // one light plane: the left half of the roof faces the sun, the right half does not
  p.g.save();
  p.g.globalCompositeOperation = 'source-atop';
  p.g.fillStyle = 'rgba(255,240,210,0.07)';
  p.g.fillRect(left, 0, w / 2 - left, roofH);
  p.g.fillStyle = 'rgba(10,8,20,0.16)';
  p.g.fillRect(w / 2, 0, right - w / 2, roofH);
  p.g.restore();
  if (o.roofForm === 'gable') {
    // a timbered gable end facing the street, with a round attic window
    const gw = Math.round(w * 0.34);
    const gy = roofH - 3;
    const top = Math.round(roofH * 0.2);
    p.poly([[w / 2 - gw - 2, gy + 1], [w / 2, top - 2], [w / 2 + gw + 2, gy + 1]], shade(o.roofDark, 0.8));
    p.poly([[w / 2 - gw, gy], [w / 2, top], [w / 2 + gw, gy]], o.wall);
    p.poly([[w / 2, top], [w / 2 + gw, gy], [w / 2, gy]], withAlpha(PAL.ink, 0.12));
    const beam = o.wallDark;
    p.line(w / 2 - gw, gy, w / 2, top, beam); p.line(w / 2 + gw, gy, w / 2, top, beam);
    p.fill(w / 2 - 1, top + 2, 2, gy - top - 2, beam);
    p.line(w / 2 - gw * 0.6, gy, w / 2 - 2, top + (gy - top) * 0.45, beam);
    p.line(w / 2 + gw * 0.6, gy, w / 2 + 2, top + (gy - top) * 0.45, beam);
    const oy = Math.round(top + (gy - top) * 0.55);
    p.circle(w / 2, oy, 4, PAL.woodDark);
    p.circle(w / 2, oy, 3, '#2a3246');
    p.set(w / 2 - 1, oy - 1, '#8fa8c8');
    p.fill(w / 2 - gw - 3, gy, gw * 2 + 6, 2, o.trim ?? shade(o.roofDark, 0.9));
    if (o.trim) p.fill(w / 2 - 1, top - 5, 2, 4, o.trim);
  }
  // lit left hip, shadowed right hip
  p.line(left, roofH - 1, peakL, 0, shade(o.roof, 1.3));
  p.line(left + 1, roofH - 1, peakL + 1, 0, shade(o.roof, 1.12));
  p.line(right - 1, roofH - 1, peakR - 1, 0, shade(o.roofDark, 0.75));
  if (o.weathered) {
    for (let i = 0; i < 7; i++) {
      const y = rng.int(Math.round(roofH * 0.35), roofH - 5);
      const x = rng.int(Math.round(edgeX(y, -1)) + 3, Math.round(edgeX(y, 1)) - 6);
      p.ellipse(x, y, rng.range(2, 4), rng.range(1, 2), withAlpha(PAL.moss, 0.85));
      p.set(x - 1, y - 1, PAL.leafDark);
    }
  }
  // ridge cap, and finials at both ends of it
  const ridge = o.trim ?? shade(o.roof, 1.25);
  p.fill(peakL - 1, 0, peakW + 2, 2, shade(o.roofDark, 0.8));
  p.fill(peakL - 1, 0, peakW + 2, 1, o.trim ? shade(o.trim, 0.8) : shade(o.roof, 1.25));
  for (const fx of [peakL - 1, peakR]) {
    p.fill(fx, -4, 2, 5, ridge);
    p.fill(fx, -5, 1, 1, o.trim ? shade(o.trim, 1.2) : ridge);
    if (o.trim) p.set(fx + 1, -3, shade(o.trim, 1.25));
  }
  // barge board along the eave, with a dentil course under it
  const board = o.trim ? shade(o.trim, 0.7) : shade(o.roofDark, 0.85);
  p.fill(left, roofH - 3, right - left, 3, board);
  p.fill(left, roofH - 3, right - left, 1, o.trim ? o.trim : shade(o.roof, 1.1));
  for (let x = left + 1; x < right - 1; x += 3) p.set(x, roofH, shade(o.roofDark, 0.6));
  if (style === 'snow') {
    for (let y = 0; y < roofH * 0.55; y += 1) {
      const t = y / roofH;
      const x0 = edgeX(y, -1);
      const x1 = edgeX(y, 1);
      p.fill(x0, y, x1 - x0, 1, withAlpha(PAL.snow, 0.9 - t));
    }
    // icicles off the eave
    for (let x = left + 2; x < right - 2; x += rng.int(3, 6)) p.fill(x, roofH, 1, rng.int(1, 4), withAlpha(PAL.ice, 0.9));
  }
}

/** Stones stacked up a corner, alternating long and short, lighter than the wall. */
function quoins(p: Px, x: number, y: number, h: number, o: BuildingOpts, right: boolean) {
  const stone = mix(o.wall, PAL.bone, 0.35);
  for (let i = 0, yy = y; yy < y + h - 4; i++, yy += 5) {
    const long = i % 2 === 0;
    const bw = long ? 6 : 4;
    const bx = right ? x + 4 - bw : x;
    p.fill(bx, yy, bw, 4, stone);
    p.fill(bx, yy, bw, 1, shade(stone, 1.12));
    p.fill(bx, yy + 4, bw, 1, shade(o.wallDark, 0.8));
  }
}

function drawWindow(p: Px, o: BuildingOpts, wx: number, wy: number, rng: RNG, tall = false): boolean {
  const h = tall ? 14 : 12;
  const arched = o.wallStyle === 'stone' || o.wallStyle === 'plaster';
  p.fill(wx - 1, wy - 1, 14, h + 2, PAL.woodDark);
  if (arched) {
    p.fill(wx, wy - 3, 12, 3, PAL.woodDark);
    p.fill(wx - 2, wy - 4, 16, 2, shade(o.wallDark, 0.9));
    const key = o.trim ?? mix(o.wall, PAL.bone, 0.4);
    p.fill(wx + 5, wy - 5, 2, 3, key);
  }
  if (o.shuttered) {
    p.fill(wx, wy, 12, h, shade(PAL.wood, 0.6));
    for (let k = 1; k < h; k += 3) p.fill(wx, wy + k, 12, 1, shade(PAL.woodDark, 0.72));
    p.fill(wx + 5, wy, 2, h, shade(PAL.woodDark, 0.6));
    p.line(wx, wy + 2, wx + 11, wy + h - 3, shade(PAL.wood, 0.85));
    return false;
  }
  // By day the glass is dark with the sky in it; the renderer lights it
  // from inside after dusk.
  const glass = '#2a3246';
  p.fill(wx, wy, 12, h, glass);
  if (arched) p.fill(wx + 1, wy - 2, 10, 2, glass);
  p.fill(wx, wy + h - 4, 12, 4, '#1c2030');
  p.fill(wx + 1, wy + 1, 3, 1, '#8fa8c8');
  p.fill(wx + 1, wy + 2, 1, 2, '#6f88a8');
  p.set(wx + 8, wy + 1, '#6f88a8');
  p.fill(wx + 5, wy - (arched ? 2 : 0), 2, h + (arched ? 2 : 0), PAL.woodDark);
  p.fill(wx, wy + Math.floor(h / 2) - 1, 12, 2, PAL.woodDark);
  // a curtain pulled to one side
  p.fill(wx + 7, wy + 1, 2, h - 2, withAlpha(o.shutterColor ?? PAL.blood, 0.55));
  // sill
  p.fill(wx - 2, wy + h + 1, 16, 2, mix(o.wall, PAL.bone, 0.3));
  p.fill(wx - 2, wy + h + 2, 16, 1, shade(o.wallDark, 0.8));
  // open shutters
  if (o.shutterColor) {
    for (const sx of [wx - 5, wx + 13]) {
      p.fill(sx, wy - 1, 4, h + 2, o.shutterColor);
      p.fill(sx, wy - 1, 1, h + 2, shade(o.shutterColor, 1.2));
      for (let k = 1; k < h + 1; k += 3) p.fill(sx + 1, wy + k, 3, 1, shade(o.shutterColor, 0.7));
    }
  }
  if (o.flowers) {
    p.fill(wx - 1, wy + h + 3, 14, 3, PAL.wood);
    p.fill(wx - 1, wy + h + 3, 14, 1, PAL.plank);
    for (let k = 0; k < 9; k++) {
      const fx = wx + rng.int(0, 11);
      p.set(fx, wy + h + 2 - rng.int(0, 2), PAL.leafLit);
      if (rng.bool(0.6)) p.set(fx, wy + h + 1 - rng.int(0, 2), rng.pick([PAL.blood, PAL.flameLit, PAL.cloth, PAL.arcaneLit, '#e87aa0']));
    }
  }
  return true;
}

export function makeBuilding(o: BuildingOpts, seed: string): BuildingArt {
  const rng = new RNG(seed);
  const { w, h } = o;
  const storeys = o.storeys ?? 1;
  const wallH = storeys === 2 ? Math.round(h * 0.52) : Math.round(h * 0.42);
  const roofH = h - wallH;
  // headroom for the ridge finials; the sprite is still anchored by its bottom
  const p = new Px(w + 12, h + 6 + ROOF_PAD);
  const ox = 6;
  const windows: Array<[number, number, number, number]> = [];

  // ground shadow
  p.ellipse(ox + w / 2, h + 1 + ROOF_PAD, w * 0.52, 5, 'rgba(10,8,16,0.3)');

  // walls
  const wallY = roofH;
  p.g.save();
  p.g.translate(ox, ROOF_PAD);
  wallTexture(p, 0, wallY, w, wallH, o, rng);

  // Form shading: the facade is lit from the upper left and sits in its own
  // eave shadow, which is what keeps a wall from reading as a flat rectangle.
  p.g.save();
  const wash = p.g.createLinearGradient(0, wallY, w, wallY);
  wash.addColorStop(0, withAlpha(PAL.white, 0.07));
  wash.addColorStop(0.55, 'rgba(0,0,0,0)');
  wash.addColorStop(1, 'rgba(10,8,16,0.26)');
  p.g.fillStyle = wash;
  p.g.fillRect(0, wallY, w, wallH);
  p.g.restore();
  // a hard eave shadow, two steps deep
  p.fill(0, wallY, w, 2, withAlpha(PAL.ink, 0.4));
  p.fill(0, wallY + 2, w, 2, withAlpha(PAL.ink, 0.2));
  // corners: dressed quoins on masonry, squared posts on timber
  if (o.wallStyle === 'stone' || o.wallStyle === 'plaster') {
    quoins(p, 0, wallY, wallH, o, false);
    quoins(p, w - 5, wallY, wallH, o, true);
  } else {
    for (const px of [0, w - 3]) {
      p.fill(px, wallY, 3, wallH, shade(o.wallDark, px === 0 ? 1.05 : 0.8));
      p.fill(px, wallY, 1, wallH, shade(o.wallDark, px === 0 ? 1.3 : 0.95));
    }
  }
  // a belt course between storeys
  if (storeys === 2) {
    const by = wallY + Math.round(wallH * 0.46);
    p.fill(0, by, w, 3, shade(o.wallDark, 0.95));
    p.fill(0, by, w, 1, o.trim ? shade(o.trim, 0.85) : mix(o.wall, PAL.bone, 0.3));
  }

  // foundation: a plinth of fitted stones, with splash grime above it
  const plinthY = wallY + wallH - 5;
  p.fill(0, plinthY - 3, w, 3, withAlpha(PAL.ink, 0.14));
  for (let i = 0; i < w / 6; i++) p.fill(rng.int(1, w - 2), plinthY - rng.int(3, 6), 1, rng.int(1, 3), withAlpha(PAL.ink, 0.12));
  p.fill(0, plinthY, w, 5, shade(o.wallDark, 0.75));
  for (let x = 0, i = 0; x < w; i++) {
    const sw = rng.int(6, 11);
    p.fill(x + 1, plinthY + 1, Math.min(sw - 1, w - x - 1), 3, mix(PAL.stone, o.wallDark, rng.range(0, 0.5)));
    p.fill(x + 1, plinthY + 1, Math.min(sw - 1, w - x - 1), 1, shade(PAL.stone, 1.25));
    x += sw;
    void i;
  }
  if (o.weathered) {
    // damp creeping up from the ground
    for (let i = 0; i < 16; i++) p.fill(rng.int(2, w - 3), plinthY - rng.int(1, 5), 1, rng.int(2, 5), withAlpha(PAL.mossDark, 0.35));
  }

  // door
  const doorW = 16;
  const doorH = Math.min(26, wallH - 6);
  const doorX = Math.round(w / 2 - doorW / 2);
  const doorY = wallY + wallH - doorH - 2;
  // a dressed stone surround with a keystone
  const surround = mix(o.wallDark, PAL.stone, 0.5);
  p.fill(doorX - 3, doorY - 4, doorW + 6, doorH + 4, surround);
  p.fill(doorX - 3, doorY - 4, doorW + 6, 1, shade(surround, 1.25));
  p.fill(doorX + doorW / 2 - 2, doorY - 6, 4, 4, o.trim ?? shade(surround, 1.2));
  p.fill(doorX + doorW / 2 - 1, doorY - 5, 2, 2, o.trim ? shade(o.trim, 1.2) : shade(surround, 1.35));
  p.fill(doorX - 2, doorY - 2, doorW + 4, doorH + 2, shade(o.wallDark, 0.6));
  p.fill(doorX, doorY, doorW, doorH, PAL.woodDark);
  p.fill(doorX + 1, doorY + 1, doorW - 2, doorH - 1, PAL.wood);
  for (let i = 1; i < 4; i++) p.fill(doorX + i * 4, doorY + 1, 1, doorH - 1, PAL.woodDark);
  if (o.shuttered) {
    // greyed-out timber, two boards nailed across, no handle
    p.fill(doorX, doorY, doorW, doorH, shade(PAL.woodDark, 0.72));
    p.fill(doorX + 1, doorY + 1, doorW - 2, doorH - 1, shade(PAL.wood, 0.62));
    for (let i = 1; i < 4; i++) p.fill(doorX + i * 4, doorY + 1, 1, doorH - 1, shade(PAL.woodDark, 0.7));
    for (const by of [doorY + 6, doorY + doorH - 10]) {
      p.fill(doorX - 4, by, doorW + 8, 4, PAL.wood);
      p.fill(doorX - 4, by, doorW + 8, 1, shade(PAL.wood, 1.18));
      p.set(doorX - 1, by + 1, PAL.ironDark);
      p.set(doorX + doorW, by + 1, PAL.ironDark);
    }
  } else {
    p.fill(doorX + 1, doorY + 4, doorW - 2, 2, PAL.iron);
    p.fill(doorX + 1, doorY + doorH - 6, doorW - 2, 2, PAL.iron);
    for (const sy of [doorY + 9, doorY + 14]) for (let i = 0; i < 3; i++) p.set(doorX + 3 + i * 5, sy, PAL.ironLit);
    p.circle(doorX + doorW - 4, doorY + doorH / 2, 1.5, PAL.gold);
    p.set(doorX + doorW - 5, doorY + doorH / 2 - 1, PAL.goldLit);
    // a small lit grille in the door
    p.fill(doorX + 5, doorY + 2, 6, 3, mix(PAL.flameLit, PAL.clay, 0.4));
    p.fill(doorX + 7, doorY + 2, 1, 3, PAL.woodDark);
  }
  // door step and a mat
  p.fill(doorX - 3, wallY + wallH - 1, doorW + 6, 3, PAL.ash);
  p.fill(doorX - 3, wallY + wallH - 1, doorW + 6, 1, PAL.fog);
  if (!o.shuttered) p.fill(doorX + 1, wallY + wallH + 1, doorW - 2, 2, o.shutterColor ? shade(o.shutterColor, 0.8) : PAL.clay);

  // windows
  const winCount = o.windows ?? 2;
  for (let i = 0; i < winCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const idx = Math.floor(i / 2);
    const wx = Math.round(w / 2 + side * (32 + idx * 20)) - 6;
    const wy = wallY + 9;
    if (wx < 3 || wx > w - 15) continue;
    if (drawWindow(p, o, wx, wy, rng)) windows.push([wx + ox, wy, 12, 12]);
    else if (o.weathered) p.fill(wx + 2, wy + 13, 1, rng.int(4, 9), withAlpha(PAL.ink, 0.25));
  }
  if (storeys === 2) {
    for (let i = 0; i < 2; i++) {
      const wx = Math.round(w / 2 + (i === 0 ? -1 : 1) * Math.min(42, w / 2 - 20)) - 6;
      const wy = wallY + wallH - 22;
      const lower: BuildingOpts = { ...o, flowers: false, shutterColor: undefined };
      if (drawWindow(p, lower, wx, wy, rng)) windows.push([wx + ox, wy, 12, 12]);
    }
  }

  // ivy up the left corner
  if (o.ivy) {
    for (let v = 0; v < 3; v++) {
      let x = 3 + v * 3;
      for (let y = wallY + wallH - 4; y > wallY + 4 + v * 6; y--) {
        x += rng.int(-1, 1);
        x = Math.max(1, Math.min(18, x));
        p.set(x, y, PAL.leafDark);
        if (rng.bool(0.45)) { p.set(x + 1, y, PAL.leaf); if (rng.bool(0.4)) p.set(x - 1, y - 1, PAL.leafLit); }
      }
    }
  }

  // roof over the walls
  roofShape(p, o, rng, roofH);

  if (o.dormer) {
    const dx = Math.round(w / 2) - 9;
    const dy = Math.round(roofH * 0.42);
    p.fill(dx, dy, 18, 13, o.wall);
    p.fill(dx, dy, 18, 13, withAlpha(PAL.ink, 0.12));
    p.fill(dx + 3, dy + 3, 12, 9, PAL.woodDark);
    p.fill(dx + 4, dy + 4, 10, 8, '#2a3246');
    p.fill(dx + 5, dy + 5, 2, 1, '#8fa8c8');
    p.fill(dx + 8, dy + 4, 2, 8, PAL.woodDark);
    windows.push([dx + 4 + ox, dy + 4, 10, 8]);
    p.poly([[dx - 3, dy + 1], [dx + 9, dy - 7], [dx + 21, dy + 1]], o.roofDark);
    p.poly([[dx - 1, dy], [dx + 9, dy - 6], [dx + 19, dy]], o.roof);
    p.line(dx - 3, dy + 1, dx + 9, dy - 7, o.trim ?? shade(o.roof, 1.3));
    p.line(dx + 9, dy - 7, dx + 21, dy + 1, o.trim ? shade(o.trim, 0.8) : shade(o.roofDark, 0.8));
    if (o.trim) p.fill(dx + 8, dy - 10, 2, 3, o.trim);
  }

  let chimney: [number, number] | undefined;
  if (o.chimney) {
    // a stone stack with a capped, sooty top
    const cx = Math.round(w * (o.chimneyAt ?? 0.74));
    const cy = Math.max(0, Math.round(roofH * 0.12));
    const ch = Math.round(roofH * 0.7);
    p.fill(cx, cy, 12, ch, PAL.clay);
    for (let y = cy + 3; y < cy + ch; y += 4) {
      const off = ((y - cy) / 4) % 2 === 0 ? 0 : 3;
      p.fill(cx, y, 12, 1, shade(PAL.clay, 0.72));
      for (let x = cx + off; x < cx + 12; x += 6) p.fill(x, y - 3, 1, 3, shade(PAL.clay, 0.8));
    }
    p.fill(cx, cy, 2, ch, shade(PAL.clay, 1.15));
    p.fill(cx + 10, cy, 2, ch, shade(PAL.clay, 0.7));
    p.fill(cx - 2, cy - 1, 16, 3, PAL.stone);
    p.fill(cx - 2, cy - 1, 16, 1, PAL.fog);
    p.fill(cx + 2, cy - 2, 8, 1, PAL.charcoal);
    chimney = [cx + 6 + ox, cy - 2];
  }
  if (o.banner) {
    for (const [bx, col, dev] of [[6, PAL.blood, PAL.gold], [w - 16, PAL.arcane, PAL.frost]] as Array<[number, string, string]>) {
      p.fill(bx - 1, roofH + 2, 12, 2, o.trim ?? PAL.gold);
      p.fill(bx, roofH + 4, 10, 22, col);
      p.fill(bx, roofH + 4, 1, 22, shade(col, 1.25));
      p.fill(bx + 9, roofH + 4, 1, 22, shade(col, 0.7));
      p.poly([[bx, roofH + 26], [bx + 5, roofH + 31], [bx + 10, roofH + 26]], col);
      p.circle(bx + 5, roofH + 13, 3, dev);
      p.fill(bx + 1, roofH + 21, 8, 1, dev);
    }
  }
  if (o.awning) {
    const [stripe, ground] = o.awning;
    const ax = doorX - 5;
    const aw = doorW + 10;
    const ay = doorY - 12;
    for (let i = 0; i < aw; i += 4) {
      const c = (i / 4) % 2 === 0 ? stripe : ground;
      p.poly([[ax + i, ay], [ax + i + 4, ay], [ax + i + 5, ay + 7], [ax + i - 1, ay + 7]], c);
      p.ellipse(ax + i + 2, ay + 7, 2.5, 1.5, c);
    }
    p.fill(ax - 1, ay - 1, aw + 2, 2, PAL.woodDark);
    p.fill(ax, ay + 7, aw, 1, withAlpha(PAL.ink, 0.25));
    p.fill(ax - 1, ay + 9, aw + 2, 2, withAlpha(PAL.ink, 0.18));
  }
  if (o.lamps) {
    // the trade sign takes the right-hand bracket when there is one
    for (const lx of o.sign ? [doorX - 10] : [doorX - 10, doorX + doorW + 8]) {
      // a wrought bracket and a caged oil lamp
      p.fill(lx - 2, doorY + 1, 5, 1, PAL.ironDark);
      p.fill(lx, doorY + 1, 1, 9, PAL.ironDark);
      p.fill(lx - 2, doorY + 9, 6, 1, PAL.ironDark);
      p.fill(lx - 2, doorY + 10, 6, 7, PAL.ironDark);
      p.fill(lx - 1, doorY + 11, 4, 5, PAL.flameLit);
      p.fill(lx, doorY + 12, 2, 3, PAL.holy);
      p.fill(lx - 1, doorY + 17, 4, 1, PAL.ironDark);
      p.ellipse(lx + 1, doorY + 13, 9, 9, withAlpha(PAL.flameLit, 0.1));
    }
  }
  if (o.sign) {
    const sx = doorX + doorW + 5;
    const sy = doorY - 1;
    if (sx + 20 < w) {
      p.fill(sx - 2, sy, 2, 6, PAL.ironDark);
      p.fill(sx - 2, sy, 20, 2, PAL.ironDark);
      p.set(sx + 17, sy - 1, PAL.ironDark);
      p.fill(sx + 2, sy + 2, 16, 14, PAL.woodDark);
      p.fill(sx + 3, sy + 3, 14, 12, PAL.wood);
      p.box(sx + 2, sy + 2, 16, 14, o.trim ?? PAL.woodDark);
      const cx = sx + 10; const cy = sy + 9;
      switch (o.sign) {
        case 'anvil':
          p.fill(cx - 5, cy - 2, 10, 3, PAL.steel);
          p.fill(cx - 2, cy + 1, 4, 3, PAL.iron);
          p.fill(cx - 4, cy + 4, 8, 2, PAL.steel);
          break;
        case 'mug':
          p.fill(cx - 4, cy - 4, 7, 9, PAL.sandLit);
          p.fill(cx - 4, cy - 4, 7, 2, PAL.white);
          p.fill(cx + 3, cy - 2, 3, 4, PAL.sandLit);
          break;
        case 'coin':
          p.circle(cx, cy, 5, PAL.gold);
          p.circle(cx, cy, 3, PAL.goldLit);
          break;
        case 'potion':
          p.fill(cx - 1, cy - 6, 3, 3, PAL.bone);
          p.ellipse(cx, cy + 1, 4, 5, PAL.toxic);
          p.ellipse(cx - 1, cy, 2, 2, PAL.white);
          break;
        case 'book':
          p.fill(cx - 5, cy - 4, 10, 8, PAL.blood);
          p.fill(cx - 1, cy - 4, 2, 8, PAL.gold);
          break;
        case 'shield':
          p.poly([[cx - 5, cy - 5], [cx + 5, cy - 5], [cx + 4, cy + 2], [cx, cy + 6], [cx - 4, cy + 2]], PAL.iron);
          p.poly([[cx - 5, cy - 5], [cx, cy - 5], [cx, cy + 6], [cx - 4, cy + 2]], PAL.steel);
          break;
      }
    }
  }
  if (o.ruined) {
    p.g.save();
    p.g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) p.ellipse(rng.int(0, w), rng.int(0, roofH + 6), rng.int(4, 11), rng.int(3, 7), '#fff');
    p.g.restore();
    p.g.save();
    p.g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 14; i++) p.ellipse(rng.int(0, w), rng.int(roofH, h), rng.int(2, 6), rng.int(2, 4), withAlpha(PAL.mossDark, 0.5));
    p.g.restore();
    windows.length = 0;
    chimney = undefined;
  }
  p.g.restore();

  return {
    canvas: p.canvas,
    w: p.w,
    h: p.h - ROOF_PAD,
    padTop: ROOF_PAD,
    doorX: ox + Math.round(w / 2),
    doorY: h,
    footW: w,
    footH: wallH,
    windows: windows.map(([x, y, ww, wh]) => [x, y + ROOF_PAD, ww, wh] as [number, number, number, number]),
    chimney: chimney ? [chimney[0], chimney[1] + ROOF_PAD] : undefined,
  };
}

const presets: Record<string, () => BuildingArt> = {
  /**
   * The valley's filler housing. Every one of these is byte-identical on
   * purpose: once a player has walked up to one boarded door, they know every
   * house that looks like this is scenery and can stop checking.
   */
  townhouse: () => makeBuilding({
    w: 96, h: 106, wall: '#6d6272', wallDark: '#403847', roof: '#4a4152', roofDark: '#2a2432',
    roofStyle: 'shingle', wallStyle: 'plank', chimney: true, windows: 2, shuttered: true, weathered: true, ivy: true,
  }, 'townhouse'),
  cottage_a:() => makeBuilding({ w: 96, h: 108, wall: PAL.plank, wallDark: PAL.woodDark, roof: PAL.clay, roofDark: '#5a3320', roofStyle: 'shingle', wallStyle: 'plank', chimney: true, windows: 2, shutterColor: '#3f6a5a', flowers: true }, 'cottage_a'),
  cottage_b: () => makeBuilding({ w: 104, h: 112, wall: PAL.cloth, wallDark: PAL.wood, roof: '#7a4a58', roofDark: '#4a2a34', roofStyle: 'tile', wallStyle: 'plaster', chimney: true, windows: 2, shutterColor: '#7a4a58', flowers: true, ivy: true, roofForm: 'gable', chimneyAt: 0.2 }, 'cottage_b'),
  cottage_c: () => makeBuilding({ w: 88, h: 100, wall: PAL.wood, wallDark: PAL.woodDark, roof: PAL.sandDark, roofDark: PAL.soil, roofStyle: 'thatch', wallStyle: 'log', windows: 2, shutterColor: '#5a3320' }, 'cottage_c'),
  farmhouse: () => makeBuilding({ w: 128, h: 118, wall: PAL.plank, wallDark: PAL.woodDark, roof: PAL.sand, roofDark: PAL.sandDark, roofStyle: 'thatch', wallStyle: 'plank', chimney: true, windows: 4, shutterColor: '#8e2131', flowers: true, roofForm: 'gable', chimneyAt: 0.16 }, 'farmhouse'),
  blacksmith: () => makeBuilding({ w: 124, h: 116, wall: PAL.stone, wallDark: PAL.charcoal, roof: '#4a3a44', roofDark: '#2a2028', roofStyle: 'shingle', wallStyle: 'stone', chimney: true, windows: 2, sign: 'anvil', lamps: true, trim: PAL.copper, shutterColor: '#5a2a1a', chimneyAt: 0.12 }, 'blacksmith'),
  inn: () => makeBuilding({ w: 148, h: 152, wall: PAL.cloth, wallDark: PAL.wood, roof: '#6a4030', roofDark: '#3c241a', roofStyle: 'shingle', wallStyle: 'plaster', storeys: 2, chimney: true, windows: 4, sign: 'mug', lamps: true, trim: PAL.gold, shutterColor: '#8e2131', flowers: true, dormer: true, awning: ['#8e2131', '#efe6d6'] }, 'inn'),
  general_store: () => makeBuilding({ w: 120, h: 114, wall: PAL.plankLit, wallDark: PAL.wood, roof: '#3f6a5a', roofDark: '#22403a', roofStyle: 'tile', wallStyle: 'plank', windows: 2, sign: 'coin', lamps: true, trim: PAL.gold, shutterColor: '#2f5a4a', flowers: true, awning: ['#3f6a5a', '#efe6d6'] }, 'general_store'),
  apothecary: () => makeBuilding({ w: 108, h: 118, wall: '#8a86a8', wallDark: PAL.slate, roof: PAL.arcaneDark, roofDark: '#1a1233', roofStyle: 'shingle', wallStyle: 'plaster', chimney: true, windows: 2, sign: 'potion', trim: '#9578e8', shutterColor: '#2b1f4d', ivy: true, flowers: true, roofForm: 'gable', chimneyAt: 0.2 }, 'apothecary'),
  town_hall: () => makeBuilding({ w: 168, h: 150, wall: PAL.fog, wallDark: PAL.stone, roof: '#3a4a6a', roofDark: '#1f2942', roofStyle: 'tile', wallStyle: 'stone', storeys: 2, windows: 4, banner: true, lamps: true, trim: PAL.gold, shutterColor: '#1f2942', dormer: true }, 'town_hall'),
  chapel: () => makeBuilding({ w: 112, h: 140, wall: PAL.fog, wallDark: PAL.stone, roof: '#5a5f6e', roofDark: '#33363f', roofStyle: 'tile', wallStyle: 'stone', storeys: 2, windows: 2, sign: 'book', trim: PAL.goldLit, ivy: true, roofForm: 'gable' }, 'chapel'),
  guard_post: () => makeBuilding({ w: 80, h: 96, wall: PAL.stone, wallDark: PAL.charcoal, roof: '#3a4a6a', roofDark: '#1f2942', roofStyle: 'shingle', wallStyle: 'stone', windows: 1, sign: 'shield', banner: true, trim: PAL.iron }, 'guard_post'),
  hut: () => makeBuilding({ w: 72, h: 84, wall: PAL.wood, wallDark: PAL.woodDark, roof: PAL.sandDark, roofDark: PAL.soil, roofStyle: 'thatch', wallStyle: 'log', windows: 1 }, 'hut'),
  elven_house: () => makeBuilding({ w: 104, h: 126, wall: '#c8d8c0', wallDark: PAL.moss, roof: PAL.leafDark, roofDark: PAL.mossDark, roofStyle: 'tile', wallStyle: 'plaster', storeys: 2, windows: 2, lamps: true, trim: PAL.leafLit, ivy: true, flowers: true }, 'elven_house'),
  dwarf_hall: () => makeBuilding({ w: 140, h: 112, wall: PAL.ash, wallDark: PAL.slate, roof: PAL.copper, roofDark: '#6d3f21', roofStyle: 'tile', wallStyle: 'stone', windows: 2, banner: true, lamps: true, trim: PAL.goldLit, shutterColor: '#6d3f21' }, 'dwarf_hall'),
  snow_house: () => makeBuilding({ w: 104, h: 110, wall: PAL.wood, wallDark: PAL.woodDark, roof: PAL.snowDark, roofDark: PAL.stone, roofStyle: 'snow', wallStyle: 'log', chimney: true, windows: 2, shutterColor: '#1f2942' }, 'snow_house'),
  desert_house: () => makeBuilding({ w: 110, h: 100, wall: PAL.sandLit, wallDark: PAL.sandDark, roof: PAL.sand, roofDark: PAL.clay, roofStyle: 'tile', wallStyle: 'plaster', windows: 2, awning: ['#b5462f', '#e2c68c'], shutterColor: '#286181' }, 'desert_house'),
  tent: () => makeBuilding({ w: 80, h: 76, wall: PAL.clay, wallDark: PAL.soil, roof: PAL.clay, roofDark: PAL.soil, roofStyle: 'canvas', wallStyle: 'plaster', windows: 0 }, 'tent'),
  ruined_house: () => makeBuilding({ w: 100, h: 96, wall: PAL.ash, wallDark: PAL.slate, roof: PAL.slate, roofDark: PAL.charcoal, roofStyle: 'shingle', wallStyle: 'stone', windows: 2, ruined: true, weathered: true, ivy: true }, 'ruined_house'),
  player_home: () => makeBuilding({ w: 108, h: 116, wall: PAL.plank, wallDark: PAL.woodDark, roof: '#3f5a6a', roofDark: '#22343f', roofStyle: 'shingle', wallStyle: 'plank', chimney: true, windows: 2, lamps: true, shutterColor: '#286181', flowers: true, trim: PAL.bone, roofForm: 'gable' }, 'player_home'),
  /**
   * The one building in Ashvale that advertises itself. It starts from the same
   * stone shell as the forge and the hall so it still belongs to the town, then
   * takes a double door, a red carpet down the steps and a gilt board over the
   * lintel. The board is deliberately left unlit here: the bulbs that chase
   * around it are the `casino_marquee` prop, because a `bld:` sprite is drawn
   * without a frame index and so can never animate.
   */
  casino: () => {
    // Starts from the same stone shell as the forge and the hall so it still
    // belongs to Ashvale, then takes a double door, a red carpet down the
    // steps and a gilt board over the lintel. The shell's own windows are
    // switched off and re-cut out at the corners, because the board sits
    // exactly where they would be. The board is left dark here: the bulbs
    // that chase around it are the `casino_marquee` prop, since a `bld:`
    // sprite is drawn without a frame index and so can never animate.
    const W = 132;
    const H = 124;
    const b = makeBuilding({
      w: W, h: H, wall: PAL.stone, wallDark: '#2b2536', roof: '#463a52', roofDark: '#241d2e',
      roofStyle: 'shingle', wallStyle: 'stone', chimney: true, windows: 0, lamps: false, trim: PAL.gold,
    }, 'casino');
    const p = new Px(b.w, b.h + ROOF_PAD);
    p.blit(b.canvas, 0, 0);

    const wallH = Math.round(H * 0.42);
    const wallY = H - wallH + ROOF_PAD;
    const cx = b.doorX;
    const doorH = Math.min(26, wallH - 6);
    const doorY = wallY + wallH - doorH - 2;

    // lit windows out at the corners, clear of the board
    for (const wx of [cx - 52, cx + 40]) {
      p.fill(wx - 1, wallY + 13, 14, 14, PAL.woodDark);
      p.fill(wx, wallY + 14, 12, 12, mix(PAL.flameLit, PAL.clay, 0.35));
      p.fill(wx, wallY + 14, 12, 4, withAlpha(PAL.white, 0.25));
      p.fill(wx + 5, wallY + 14, 2, 12, PAL.woodDark);
      p.fill(wx, wallY + 19, 12, 2, PAL.woodDark);
    }

    // the marquee board's recess — the prop lights it
    const boardW = 72;
    p.fill(cx - boardW / 2, wallY + 4, boardW, 24, '#221c2a');
    p.box(cx - boardW / 2, wallY + 4, boardW, 24, '#6d4a1c');

    // double doors under a gilt arch
    p.fill(cx - 13, doorY - 2, 26, doorH + 2, shade('#2b2536', 0.7));
    p.fill(cx - 12, doorY, 24, doorH, PAL.woodDark);
    p.fill(cx - 11, doorY + 1, 10, doorH - 2, PAL.wood);
    p.fill(cx + 1, doorY + 1, 10, doorH - 2, PAL.wood);
    p.fill(cx - 1, doorY, 2, doorH, shade(PAL.woodDark, 0.8));
    for (const lx of [cx - 11, cx + 1]) {
      p.fill(lx, doorY + 3, 10, 1, PAL.gold);
      p.fill(lx, doorY + doorH - 6, 10, 1, PAL.gold);
    }
    p.circle(cx - 3, doorY + doorH / 2, 1.5, PAL.goldLit);
    p.circle(cx + 3, doorY + doorH / 2, 1.5, PAL.goldLit);
    p.fill(cx - 15, doorY - 4, 30, 2, PAL.gold);
    p.fill(cx - 15, doorY - 2, 2, 4, PAL.gold);
    p.fill(cx + 13, doorY - 2, 2, 4, PAL.gold);

    // crimson spade banners flanking the door, below the board
    for (const bx of [cx - 30, cx + 22]) {
      p.fill(bx, doorY - 6, 8, 22, PAL.blood);
      p.fill(bx, doorY - 6, 1, 22, '#b03449');
      p.fill(bx + 7, doorY - 6, 1, 22, '#5e1220');
      p.poly([[bx, doorY + 16], [bx + 4, doorY + 21], [bx + 8, doorY + 16]], PAL.blood);
      p.poly([[bx + 2, doorY], [bx + 7, doorY + 5], [bx + 4, doorY + 9], [bx + 1, doorY + 5]], PAL.goldLit);
    }

    // carriage lamps either side of the doors
    for (const lx of [cx - 20, cx + 17]) {
      p.fill(lx, doorY + 2, 2, 8, PAL.ironDark);
      p.fill(lx - 2, doorY + 10, 6, 7, PAL.ironDark);
      p.fill(lx - 1, doorY + 11, 4, 5, PAL.flameLit);
      p.fill(lx, doorY + 12, 2, 3, PAL.holy);
      p.ellipse(lx + 1, doorY + 13, 9, 9, withAlpha(PAL.flameLit, 0.1));
    }

    // red carpet running down the steps
    const HB = H + ROOF_PAD;
    p.fill(cx - 9, HB - 2, 18, 8, '#7a1c2c');
    p.fill(cx - 9, HB - 2, 18, 1, '#a8304a');
    p.fill(cx - 8, HB - 1, 1, 7, '#b03449');
    p.fill(cx + 7, HB - 1, 1, 7, '#5e1220');

    const windows: Array<[number, number, number, number]> = [[cx - 52, wallY + 14, 12, 12], [cx + 40, wallY + 14, 12, 12]];
    return { ...b, canvas: p.canvas, windows };
  },
  mage_tower: () => {
    const b = makeBuilding({ w: 90, h: 168, wall: '#6a6488', wallDark: PAL.slate, roof: PAL.arcaneDark, roofDark: '#140f26', roofStyle: 'tile', wallStyle: 'stone', storeys: 2, windows: 2 }, 'mage_tower');
    const p = new Px(b.w, b.h + ROOF_PAD);
    p.blit(b.canvas, 0, 0);
    // glowing arcane windows near the peak
    p.fill(38, 26 + ROOF_PAD, 10, 12, withAlpha(PAL.arcaneLit, 0.9));
    p.fill(38, 26 + ROOF_PAD, 10, 12, withAlpha(PAL.frost, 0.4));
    p.ellipse(43, 32 + ROOF_PAD, 16, 16, withAlpha(PAL.arcaneLit, 0.08));
    return { ...b, canvas: p.canvas };
  },
};

const cache = new Map<string, BuildingArt>();

export function getBuilding(name: string): BuildingArt {
  let b = cache.get(name);
  if (!b) {
    b = (presets[name] ?? presets.cottage_a)();
    cache.set(name, b);
  }
  return b;
}

export const BUILDING_NAMES = Object.keys(presets);
