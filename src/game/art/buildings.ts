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

function roofShape(p: Px, o: BuildingOpts, rng: RNG, roofH: number) {
  const { w } = o;
  const overhang = 4;
  const style = o.roofStyle ?? 'shingle';
  const peakW = Math.round(w * 0.16);
  const left = -overhang;
  const right = w + overhang;

  const poly: Array<[number, number]> = [
    [left, roofH],
    [Math.round(w / 2 - peakW / 2), 0],
    [Math.round(w / 2 + peakW / 2), 0],
    [right, roofH],
  ];
  p.poly(poly, o.roofDark);

  if (style === 'thatch') {
    for (let y = 0; y < roofH; y++) {
      const t = y / roofH;
      const x0 = left * t + (w / 2 - peakW / 2) * (1 - t);
      const x1 = right * t + (w / 2 + peakW / 2) * (1 - t);
      const c = mix(o.roof, o.roofDark, (Math.sin(y * 0.9) + 1) * 0.25);
      p.fill(x0, y, x1 - x0, 1, c);
      if (y % 4 === 0) for (let k = 0; k < (x1 - x0) / 6; k++) p.set(x0 + rng.int(0, x1 - x0), y, shade(o.roof, 1.2));
    }
  } else if (style === 'canvas') {
    for (let y = 0; y < roofH; y++) {
      const t = y / roofH;
      const x0 = left * t + (w / 2 - peakW / 2) * (1 - t);
      const x1 = right * t + (w / 2 + peakW / 2) * (1 - t);
      const stripe = Math.floor((y / roofH) * 6) % 2 === 0;
      p.fill(x0, y, x1 - x0, 1, stripe ? o.roof : o.roofDark);
    }
  } else {
    const rowH = style === 'tile' ? 5 : 4;
    for (let y = 0; y < roofH; y += rowH) {
      const t = y / roofH;
      const x0 = left * t + (w / 2 - peakW / 2) * (1 - t);
      const x1 = right * t + (w / 2 + peakW / 2) * (1 - t);
      const rowColor = mix(o.roof, o.roofDark, (y / roofH) * 0.35);
      p.fill(x0, y, x1 - x0, rowH - 1, rowColor);
      p.fill(x0, y + rowH - 1, x1 - x0, 1, o.roofDark);
      const tileW = style === 'tile' ? 8 : 10;
      const off = ((y / rowH) % 2) * (tileW / 2);
      for (let x = x0 + off; x < x1; x += tileW) p.fill(x, y, 1, rowH - 1, shade(rowColor, 0.82));
      for (let k = 0; k < (x1 - x0) / 24; k++) p.set(x0 + rng.int(0, x1 - x0), y + rng.int(0, rowH - 2), shade(rowColor, 1.15));
    }
  }
  // ridge + eaves
  p.fill(Math.round(w / 2 - peakW / 2) - 1, 0, peakW + 2, 2, shade(o.roof, 1.25));
  p.fill(left, roofH - 2, right - left, 3, o.roofDark);
  if (style === 'snow') {
    for (let y = 0; y < roofH * 0.55; y += 1) {
      const t = y / roofH;
      const x0 = left * t + (w / 2 - peakW / 2) * (1 - t);
      const x1 = right * t + (w / 2 + peakW / 2) * (1 - t);
      p.fill(x0, y, x1 - x0, 1, withAlpha(PAL.snow, 0.9 - t));
    }
  }
}

export function makeBuilding(o: BuildingOpts, seed: string): BuildingArt {
  const rng = new RNG(seed);
  const { w, h } = o;
  const storeys = o.storeys ?? 1;
  const wallH = storeys === 2 ? Math.round(h * 0.52) : Math.round(h * 0.42);
  const roofH = h - wallH;
  const p = new Px(w + 12, h + 6);
  const ox = 6;

  // ground shadow
  p.ellipse(ox + w / 2, h + 1, w * 0.52, 5, 'rgba(10,8,16,0.3)');

  // walls
  const wallY = roofH;
  p.g.save();
  p.g.translate(ox, 0);
  wallTexture(p, 0, wallY, w, wallH, o, rng);

  // foundation
  p.fill(0, wallY + wallH - 4, w, 4, shade(o.wallDark, 0.8));
  p.fill(0, wallY + wallH - 4, w, 1, shade(o.wallDark, 1.1));

  // door
  const doorW = 16;
  const doorH = Math.min(26, wallH - 6);
  const doorX = Math.round(w / 2 - doorW / 2);
  const doorY = wallY + wallH - doorH - 2;
  p.fill(doorX - 2, doorY - 2, doorW + 4, doorH + 2, shade(o.wallDark, 0.75));
  p.fill(doorX, doorY, doorW, doorH, PAL.woodDark);
  p.fill(doorX + 1, doorY + 1, doorW - 2, doorH - 1, PAL.wood);
  for (let i = 1; i < 4; i++) p.fill(doorX + i * 4, doorY + 1, 1, doorH - 1, PAL.woodDark);
  p.fill(doorX + 1, doorY + 4, doorW - 2, 2, PAL.iron);
  p.fill(doorX + 1, doorY + doorH - 6, doorW - 2, 2, PAL.iron);
  p.circle(doorX + doorW - 4, doorY + doorH / 2, 1.5, PAL.gold);
  // door step
  p.fill(doorX - 3, wallY + wallH - 1, doorW + 6, 3, PAL.ash);

  // windows
  const winCount = o.windows ?? 2;
  for (let i = 0; i < winCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const idx = Math.floor(i / 2);
    const wx = Math.round(w / 2 + side * (14 + idx * 18)) - 6;
    const wy = wallY + 8 + (storeys === 2 && i >= 2 ? 0 : 0);
    if (wx < 3 || wx > w - 15) continue;
    p.fill(wx - 1, wy - 1, 14, 14, PAL.woodDark);
    p.fill(wx, wy, 12, 12, mix(PAL.flameLit, PAL.clay, 0.35));
    p.fill(wx, wy, 12, 4, withAlpha(PAL.white, 0.25));
    p.fill(wx + 5, wy, 2, 12, PAL.woodDark);
    p.fill(wx, wy + 5, 12, 2, PAL.woodDark);
  }
  if (storeys === 2) {
    for (let i = 0; i < 2; i++) {
      const wx = Math.round(w / 2 + (i === 0 ? -1 : 1) * 16) - 6;
      const wy = wallY + wallH - 20;
      p.fill(wx - 1, wy - 1, 14, 14, PAL.woodDark);
      p.fill(wx, wy, 12, 12, mix(PAL.flameLit, PAL.clay, 0.5));
      p.fill(wx + 5, wy, 2, 12, PAL.woodDark);
      p.fill(wx, wy + 5, 12, 2, PAL.woodDark);
    }
  }

  // roof over the walls
  roofShape(p, o, rng, roofH);

  if (o.chimney) {
    const cx = Math.round(w * 0.74);
    p.fill(cx, Math.max(0, roofH * 0.15), 12, roofH * 0.7, PAL.clay);
    p.fill(cx, Math.max(0, roofH * 0.15), 12, 3, PAL.ash);
    for (let y = roofH * 0.2; y < roofH * 0.8; y += 5) p.fill(cx, y, 12, 1, shade(PAL.clay, 0.8));
  }
  if (o.banner) {
    p.fill(6, roofH + 3, 10, 22, PAL.blood);
    p.poly([[6, roofH + 25], [11, roofH + 30], [16, roofH + 25]], PAL.blood);
    p.circle(11, roofH + 12, 3, PAL.gold);
    p.fill(w - 16, roofH + 3, 10, 22, PAL.arcane);
    p.poly([[w - 16, roofH + 25], [w - 11, roofH + 30], [w - 6, roofH + 25]], PAL.arcane);
    p.circle(w - 11, roofH + 12, 3, PAL.frost);
  }
  if (o.lamps) {
    for (const lx of [doorX - 10, doorX + doorW + 8]) {
      p.fill(lx, doorY + 2, 2, 8, PAL.ironDark);
      p.fill(lx - 2, doorY + 10, 6, 7, PAL.ironDark);
      p.fill(lx - 1, doorY + 11, 4, 5, PAL.flameLit);
      p.ellipse(lx + 1, doorY + 13, 9, 9, withAlpha(PAL.flameLit, 0.09));
    }
  }
  if (o.sign) {
    const sx = doorX + doorW + 6;
    const sy = wallY + 4;
    if (sx + 20 < w) {
      p.fill(sx - 2, sy, 2, 6, PAL.ironDark);
      p.fill(sx - 2, sy, 20, 2, PAL.ironDark);
      p.fill(sx + 2, sy + 2, 16, 14, PAL.woodDark);
      p.fill(sx + 3, sy + 3, 14, 12, PAL.wood);
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
    // knock holes out of the roof and stain the walls
    for (let i = 0; i < 5; i++) {
      p.ellipse(rng.int(6, w - 6), rng.int(2, roofH), rng.int(3, 8), rng.int(2, 5), 'rgba(0,0,0,0)');
    }
    p.g.save();
    p.g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) p.ellipse(rng.int(0, w), rng.int(0, roofH + 6), rng.int(4, 11), rng.int(3, 7), '#fff');
    p.g.restore();
    p.g.save();
    p.g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 14; i++) p.ellipse(rng.int(0, w), rng.int(roofH, h), rng.int(2, 6), rng.int(2, 4), withAlpha(PAL.mossDark, 0.5));
    p.g.restore();
  }
  p.g.restore();

  return {
    canvas: p.canvas,
    w: p.w,
    h: p.h,
    doorX: ox + Math.round(w / 2),
    doorY: h,
    footW: w,
    footH: wallH,
  };
}

const presets: Record<string, () => BuildingArt> = {
  cottage_a: () => makeBuilding({ w: 96, h: 108, wall: PAL.plank, wallDark: PAL.woodDark, roof: PAL.clay, roofDark: '#5a3320', roofStyle: 'shingle', wallStyle: 'plank', chimney: true, windows: 2 }, 'cottage_a'),
  cottage_b: () => makeBuilding({ w: 104, h: 112, wall: PAL.cloth, wallDark: PAL.wood, roof: '#7a4a58', roofDark: '#4a2a34', roofStyle: 'tile', wallStyle: 'plaster', chimney: true, windows: 2 }, 'cottage_b'),
  cottage_c: () => makeBuilding({ w: 88, h: 100, wall: PAL.wood, wallDark: PAL.woodDark, roof: PAL.sandDark, roofDark: PAL.soil, roofStyle: 'thatch', wallStyle: 'log', windows: 2 }, 'cottage_c'),
  farmhouse: () => makeBuilding({ w: 128, h: 118, wall: PAL.plank, wallDark: PAL.woodDark, roof: PAL.sand, roofDark: PAL.sandDark, roofStyle: 'thatch', wallStyle: 'plank', chimney: true, windows: 4 }, 'farmhouse'),
  blacksmith: () => makeBuilding({ w: 124, h: 116, wall: PAL.stone, wallDark: PAL.charcoal, roof: '#4a3a44', roofDark: '#2a2028', roofStyle: 'shingle', wallStyle: 'stone', chimney: true, windows: 2, sign: 'anvil', lamps: true }, 'blacksmith'),
  inn: () => makeBuilding({ w: 148, h: 152, wall: PAL.cloth, wallDark: PAL.wood, roof: '#6a4030', roofDark: '#3c241a', roofStyle: 'shingle', wallStyle: 'plaster', storeys: 2, chimney: true, windows: 4, sign: 'mug', lamps: true }, 'inn'),
  general_store: () => makeBuilding({ w: 120, h: 114, wall: PAL.plankLit, wallDark: PAL.wood, roof: '#3f6a5a', roofDark: '#22403a', roofStyle: 'tile', wallStyle: 'plank', windows: 2, sign: 'coin', lamps: true }, 'general_store'),
  apothecary: () => makeBuilding({ w: 108, h: 118, wall: '#8a86a8', wallDark: PAL.slate, roof: PAL.arcaneDark, roofDark: '#1a1233', roofStyle: 'shingle', wallStyle: 'plaster', chimney: true, windows: 2, sign: 'potion' }, 'apothecary'),
  town_hall: () => makeBuilding({ w: 168, h: 150, wall: PAL.fog, wallDark: PAL.stone, roof: '#3a4a6a', roofDark: '#1f2942', roofStyle: 'tile', wallStyle: 'stone', storeys: 2, windows: 4, banner: true, lamps: true }, 'town_hall'),
  chapel: () => makeBuilding({ w: 112, h: 140, wall: PAL.fog, wallDark: PAL.stone, roof: '#d0c0a0', roofDark: PAL.sandDark, roofStyle: 'tile', wallStyle: 'stone', storeys: 2, windows: 2, sign: 'book' }, 'chapel'),
  guard_post: () => makeBuilding({ w: 80, h: 96, wall: PAL.stone, wallDark: PAL.charcoal, roof: '#3a4a6a', roofDark: '#1f2942', roofStyle: 'shingle', wallStyle: 'stone', windows: 1, sign: 'shield', banner: true }, 'guard_post'),
  hut: () => makeBuilding({ w: 72, h: 84, wall: PAL.wood, wallDark: PAL.woodDark, roof: PAL.sandDark, roofDark: PAL.soil, roofStyle: 'thatch', wallStyle: 'log', windows: 1 }, 'hut'),
  elven_house: () => makeBuilding({ w: 104, h: 126, wall: '#c8d8c0', wallDark: PAL.moss, roof: PAL.leafDark, roofDark: PAL.mossDark, roofStyle: 'tile', wallStyle: 'plaster', storeys: 2, windows: 2, lamps: true }, 'elven_house'),
  dwarf_hall: () => makeBuilding({ w: 140, h: 112, wall: PAL.ash, wallDark: PAL.slate, roof: PAL.copper, roofDark: '#6d3f21', roofStyle: 'tile', wallStyle: 'stone', windows: 2, banner: true, lamps: true }, 'dwarf_hall'),
  snow_house: () => makeBuilding({ w: 104, h: 110, wall: PAL.wood, wallDark: PAL.woodDark, roof: PAL.snowDark, roofDark: PAL.stone, roofStyle: 'snow', wallStyle: 'log', chimney: true, windows: 2 }, 'snow_house'),
  desert_house: () => makeBuilding({ w: 110, h: 100, wall: PAL.sandLit, wallDark: PAL.sandDark, roof: PAL.sand, roofDark: PAL.clay, roofStyle: 'tile', wallStyle: 'plaster', windows: 2 }, 'desert_house'),
  tent: () => makeBuilding({ w: 80, h: 76, wall: PAL.clay, wallDark: PAL.soil, roof: PAL.clay, roofDark: PAL.soil, roofStyle: 'canvas', wallStyle: 'plaster', windows: 0 }, 'tent'),
  ruined_house: () => makeBuilding({ w: 100, h: 96, wall: PAL.ash, wallDark: PAL.slate, roof: PAL.slate, roofDark: PAL.charcoal, roofStyle: 'shingle', wallStyle: 'stone', windows: 2, ruined: true }, 'ruined_house'),
  player_home: () => makeBuilding({ w: 108, h: 116, wall: PAL.plank, wallDark: PAL.woodDark, roof: '#3f5a6a', roofDark: '#22343f', roofStyle: 'shingle', wallStyle: 'plank', chimney: true, windows: 2, lamps: true }, 'player_home'),
  mage_tower: () => {
    const b = makeBuilding({ w: 90, h: 168, wall: '#6a6488', wallDark: PAL.slate, roof: PAL.arcaneDark, roofDark: '#140f26', roofStyle: 'tile', wallStyle: 'stone', storeys: 2, windows: 2 }, 'mage_tower');
    const p = new Px(b.w, b.h);
    p.blit(b.canvas, 0, 0);
    // glowing arcane windows near the peak
    p.fill(38, 26, 10, 12, withAlpha(PAL.arcaneLit, 0.9));
    p.fill(38, 26, 10, 12, withAlpha(PAL.frost, 0.4));
    p.ellipse(43, 32, 16, 16, withAlpha(PAL.arcaneLit, 0.08));
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
