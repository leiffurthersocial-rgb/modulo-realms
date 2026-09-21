import { RNG } from '../core/rng';
import { T, TILE, TILE_COUNT } from '../world/tiles';
import { PAL, mix, shade, withAlpha } from './palette';
import { Px, makeCanvas, ctx2d, type Canvas } from './pixel';

const S = TILE;
const VARIANTS = 4;

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function noiseGround(p: Px, base: string, dark: string, light: string, rng: RNG, density = 0.22): Px {
  p.fillAll(base);
  // broad tonal patches first so the ground never reads as flat colour
  for (let i = 0; i < 6; i++) {
    const c = rng.bool() ? mix(base, dark, rng.range(0.12, 0.3)) : mix(base, light, rng.range(0.1, 0.24));
    p.ellipse(rng.int(-4, S + 4), rng.int(-4, S + 4), rng.int(5, 13), rng.int(4, 10), c);
  }
  p.speckle(0, 0, S, S, [dark, light, mix(base, dark, 0.5)], density, rng);
  return p;
}

/**
 * Grass is built in layers: tonal clumps, a dither band between tones, then
 * individual blades with a lit tip. Four variants keep the tiling from
 * showing a grid.
 */
function grassTile(rng: RNG, base: string, dark: string, light: string, bladeChance = 1): Px {
  const p = new Px(S, S);
  const deepest = mix(dark, PAL.ink, 0.35);
  p.fillAll(mix(base, dark, 0.2));

  // gentle clumps — the seamless macro pass in the renderer does the heavy lifting
  for (let i = 0; i < 5; i++) {
    const cx = rng.int(-4, S + 4);
    const cy = rng.int(-4, S + 4);
    const rx = rng.int(5, 12);
    const ry = rng.int(4, 9);
    p.ellipse(cx, cy, rx, ry, rng.bool(0.55) ? mix(base, light, rng.range(0.06, 0.16)) : mix(base, deepest, rng.range(0.08, 0.2)));
  }
  // dithered transition speckle
  for (let i = 0; i < 70; i++) {
    const x = rng.int(0, S - 1);
    const y = rng.int(0, S - 1);
    p.set(x, y, rng.bool(0.5) ? mix(base, deepest, 0.3) : mix(base, light, 0.25));
  }
  // blades
  const blades = Math.round(16 * bladeChance);
  for (let i = 0; i < blades; i++) {
    const x = rng.int(1, S - 2);
    const y = rng.int(4, S - 1);
    const h = rng.int(2, 5);
    const lean = rng.bool() ? 1 : -1;
    const shade1 = rng.bool(0.5) ? deepest : dark;
    for (let k = 0; k < h; k++) p.set(x + (k > h - 2 ? lean : 0), y - k, shade1);
    p.set(x + (h > 2 ? lean : 0), y - h, light);
  }
  // scattered litter
  for (let i = 0; i < 3; i++) {
    if (!rng.bool(0.45)) continue;
    const x = rng.int(2, S - 4);
    const y = rng.int(2, S - 3);
    p.fill(x, y, rng.int(1, 3), 1, mix(dark, PAL.soilDark, 0.5));
  }
  return p;
}

/** Fitted cobbles with mortar gaps and worn highlights. */
function cobbleTile(rng: RNG, base: string, dark: string, light: string, size = 6): Px {
  const p = new Px(S, S);
  p.fillAll(mix(dark, base, 0.35));
  for (let y = -1; y < S; y += size) {
    const off = (Math.floor(y / size) % 2 === 0 ? 0 : Math.floor(size / 2));
    for (let x = -size; x < S + size; x += size) {
      const cx = x + off + rng.int(0, 1);
      const cy = y + rng.int(0, 1);
      const w = size - 1 - rng.int(0, 1);
      const h = size - 1 - rng.int(0, 1);
      const c = mix(base, rng.bool() ? light : dark, rng.range(0, 0.4));
      // body, top light, bottom shade
      p.fill(cx, cy, w, h, c);
      p.fill(cx, cy, w, 1, mix(c, light, 0.45));
      p.fill(cx, cy + h - 1, w, 1, mix(c, dark, 0.55));
      p.fill(cx + w - 1, cy, 1, h, mix(c, dark, 0.35));
      if (rng.bool(0.35)) p.set(cx + rng.int(0, Math.max(0, w - 1)), cy + rng.int(1, Math.max(1, h - 2)), mix(c, light, 0.5));
      if (rng.bool(0.18)) p.set(cx + rng.int(0, Math.max(0, w - 1)), cy + rng.int(1, Math.max(1, h - 2)), mix(c, dark, 0.6));
    }
  }
  return p;
}


/** Wooden planks with end-seams and grain; used for floors, bridges and walls. */
function plankTile(rng: RNG, base: string, dark: string, light: string, vertical = false): Px {
  const p = new Px(S, S);
  p.fillAll(base);
  const step = 8;
  for (let i = 0; i < S; i += step) {
    if (vertical) {
      p.fill(i, 0, 1, S, dark);
      p.fill(i + 1, 0, 1, S, mix(base, light, 0.4));
      const seam = rng.int(4, S - 4);
      p.fill(i, seam, step - 1, 1, dark);
    } else {
      p.fill(0, i, S, 1, dark);
      p.fill(0, i + 1, S, 1, mix(base, light, 0.4));
      const seam = rng.int(4, S - 4);
      p.fill(seam, i, 1, step - 1, dark);
    }
  }
  for (let i = 0; i < 30; i++) {
    const x = rng.int(0, S - 1);
    const y = rng.int(0, S - 1);
    const c = rng.bool() ? shade(base, 0.88) : shade(base, 1.1);
    if (vertical) p.fill(x, y, 1, rng.int(1, 4), c);
    else p.fill(x, y, rng.int(1, 4), 1, c);
  }
  // a couple of knots
  for (let i = 0; i < 2; i++) {
    if (!rng.bool(0.5)) continue;
    const x = rng.int(3, S - 4);
    const y = rng.int(3, S - 4);
    p.ellipse(x, y, 2, 1.4, shade(base, 0.72));
    p.set(x, y, shade(base, 0.6));
  }
  return p;
}

function waterTile(rng: RNG, deep: boolean, colors?: readonly [string, string]): Px {
  const p = new Px(S, S);
  const base = colors?.[0] ?? (deep ? PAL.deep : PAL.water);
  const light = colors?.[1] ?? (deep ? PAL.water : PAL.waterLit);
  p.fillAll(base);
  for (let i = 0; i < 6; i++) {
    p.ellipse(rng.int(0, S), rng.int(0, S), rng.int(4, 9), rng.int(2, 4), mix(base, light, 0.25));
  }
  for (let i = 0; i < 5; i++) {
    const x = rng.int(0, S - 8);
    const y = rng.int(1, S - 2);
    const w = rng.int(3, 7);
    p.fill(x, y, w, 1, mix(light, PAL.foam, 0.2));
    if (rng.bool(0.5)) p.fill(x + 2, y + 1, Math.max(2, w - 3), 1, mix(base, light, 0.5));
  }
  return p;
}

/** Ocean depth and small capillary ripples sit underneath the world-space
 * moving swells. Bright stationary pond glints would compete with the surf. */
function oceanTile(rng: RNG, deep: boolean): Px {
  const base = deep ? '#204667' : '#388c9a';
  const light = deep ? '#497a91' : '#82c2bc';
  const p = new Px(S, S);
  p.fillAll(base);
  for (let n = 0; n < 7; n++) {
    p.ellipse(rng.int(-4, S + 4), rng.int(0, S), rng.int(5, 14), rng.int(1, 3), mix(base, light, rng.range(.08, .2)));
  }
  for (let n = 0; n < 6; n++) {
    const x = rng.int(0, S - 6), y = rng.int(0, S - 2), w = rng.int(2, 5);
    p.fill(x, y, w, 1, mix(base, light, .25));
    if (rng.bool(.4)) p.fill(x + w, y + 1, 2, 1, mix(base, light, .16));
  }
  return p;
}

function rockTile(rng: RNG, base: string, dark: string, light: string): Px {
  const p = new Px(S, S);
  p.fillAll(base);
  for (let i = 0; i < 7; i++) {
    const x = rng.int(0, S - 6);
    const y = rng.int(0, S - 6);
    const w = rng.int(4, 11);
    const h = rng.int(3, 8);
    const c = mix(base, rng.bool() ? light : dark, rng.range(0.15, 0.55));
    p.poly(
      [
        [x, y + h / 2],
        [x + w / 3, y],
        [x + w, y + h / 3],
        [x + w - 2, y + h],
        [x + 2, y + h],
      ],
      c,
    );
  }
  p.speckle(0, 0, S, S, [dark, light], 0.1, rng);
  return p;
}

/** A solid wall block seen from above with a lit top edge. */
function wallTile(rng: RNG, base: string, dark: string, light: string, brick = true): Px {
  const p = new Px(S, S);
  p.fillAll(base);
  if (brick) {
    for (let y = 0; y < S; y += 8) {
      const off = (y / 8) % 2 === 0 ? 0 : 8;
      p.fill(0, y, S, 1, dark);
      for (let x = -16; x < S; x += 16) {
        p.fill(x + off, y, 1, 8, dark);
        const c = mix(base, rng.bool() ? light : dark, rng.range(0, 0.3));
        p.fill(x + off + 1, y + 1, 14, 6, c);
        p.fill(x + off + 1, y + 1, 14, 1, mix(c, light, 0.35));
      }
    }
  } else {
    p.speckle(0, 0, S, S, [dark, light, mix(base, dark, 0.6)], 0.25, rng);
    for (let i = 0; i < 4; i++) p.line(rng.int(0, S), 0, rng.int(0, S), S, dark);
  }
  p.fill(0, 0, S, 1, light);
  return p;
}

/** The front face of a wall, used when the tile below the wall is walkable. */
function wallFace(rng: RNG, base: string, dark: string, light: string): Px {
  const p = new Px(S, S);
  const b = shade(base, 0.78);
  p.fillAll(b);
  p.fill(0, 0, S, 2, mix(light, b, 0.4));
  for (let y = 3; y < S; y += 7) {
    p.fill(0, y, S, 1, shade(dark, 0.85));
    for (let x = ((y / 7) % 2 === 0 ? 0 : 8); x < S; x += 16) p.fill(x, y, 1, 7, shade(dark, 0.85));
  }
  p.speckle(0, 0, S, S, [shade(dark, 0.9), shade(light, 0.7)], 0.08, rng);
  p.shadeBottom(8, 0.5);
  return p;
}

/** Low Mediterranean plants grow as woody cushions, with exposed mineral soil
 * between them. This is deliberately different from the western grass blades. */
function mediterraneanCover(rng: RNG, kind: 'thyme' | 'laurel' | 'alpine' | 'golden' | 'heath' | 'garden'): Px {
  const colors = {
    thyme: ['#92916a', '#676d4c', '#b4b595'],
    laurel: ['#546d58', '#364d42', '#839478'],
    alpine: ['#a3ab8b', '#748470', '#d1ceb0'],
    golden: ['#b0a165', '#81734c', '#d4c28a'],
    heath: ['#737d7b', '#495d60', '#9fa6a0'],
    garden: ['#a1ab69', '#6c8153', '#c4c98a'],
  } as const;
  const [base, dark, light] = colors[kind];
  const p = noiseGround(new Px(S, S), base, dark, light, rng, .13);
  if (kind === 'laurel') {
    // Leaf mould, russet fallen leaves and the pale exposed roots of old groves.
    for (let n = 0; n < 13; n++) {
      const x = rng.int(1, 29), y = rng.int(2, 29);
      p.line(x - 1, y + 1, x + 2, y - 1, n % 3 ? '#71816a' : '#ad9770');
      p.set(x, y, '#a4ac88');
      p.set(x + 1, y + 1, '#42594a');
    }
    if (rng.bool(.7)) {
      const x = rng.int(3, 25), y = rng.int(7, 23);
      p.line(x, y, x + 5, y - 2, '#8b8a6c');
      p.line(x + 3, y - 1, x + 7, y + 2, '#6f7258');
    }
  } else if (kind === 'golden') {
    // Wind-combed stubble, seed heads and little limestone fragments.
    for (let n = 0; n < 15; n++) {
      const x = rng.int(2, 29), y = rng.int(5, 30), h = rng.int(2, 5);
      p.line(x, y, x + 1, y - h, dark);
      p.fill(x, y - h, 2, 1, n % 3 ? light : '#baad7b');
    }
    for (let n = 0; n < 4; n++) p.fill(rng.int(0, 30), rng.int(0, 31), 2, 1, '#c4baa0');
  } else {
    const clumps = kind === 'alpine' ? 6 : kind === 'garden' ? 9 : 8;
    for (let n = 0; n < clumps; n++) {
      const x = rng.int(1, 30), y = rng.int(2, 30), w = rng.int(2, 4);
      p.ellipse(x, y, w, rng.int(1, 2), dark);
      p.fill(x - w + 1, y - 1, w + 1, 1, mix(base, light, .65));
      p.set(x + 1, y - 2, light);
      if (kind === 'thyme' && n < 3) {
        p.set(x, y - 2, '#aa92ac');
        p.set(x + 2, y - 1, '#c0a4be');
      }
      if (kind === 'heath') {
        p.line(x, y + 1, x - 2, y - 3, '#839290');
        if (n < 3) p.set(x - 2, y - 3, '#a897ac');
      }
      if (kind === 'alpine' && n < 3) {
        p.set(x - 1, y - 2, n % 2 ? '#afb0ce' : '#f0e5b8');
        p.set(x + 1, y - 2, n % 2 ? '#ceccdf' : '#d9c979');
      }
      if (kind === 'garden' && n < 4) {
        p.set(x, y - 3, '#e4c365');
        p.set(x - 1, y - 2, '#f0d994');
        p.set(x + 1, y - 2, '#c7a74b');
      }
    }
    // Grey-white grit is exposed through the cushions, never a snow blanket.
    if (kind === 'thyme' || kind === 'alpine') for (let n = 0; n < 5; n++) {
      const x = rng.int(0, 30), y = rng.int(0, 30);
      p.fill(x, y, 2, 1, '#c4bfa4');
      p.set(x + 1, y + 1, '#8c907c');
    }
  }
  return p;
}

function limestoneTile(rng: RNG, crag: boolean): Px {
  const p = noiseGround(new Px(S, S), crag ? '#a6a18e' : '#c4bd9f', '#8e8b79', '#e0d8bb', rng, .10);
  // Water-worn bedding planes, broken angular flakes and rust in hairline seams.
  for (let n = 0; n < (crag ? 6 : 4); n++) {
    const x = rng.int(-5, 26), y = rng.int(2, 28), w = rng.int(8, 18), h = rng.int(3, 7);
    p.poly([[x,y+2],[x+3,y],[x+w,y+1],[x+w-2,y+h],[x+1,y+h+1]], crag ? '#aaa58f' : '#d1c8aa');
    p.line(x + 3, y, x + w - 1, y + 1, '#e1dac0');
    p.line(x + 1, y + h + 1, x + w - 2, y + h, crag ? '#767a70' : '#a69d81');
    if (rng.bool(.7)) p.line(x + 4, y + 2, x + 7, y + h - 1, '#aaa181');
  }
  for (let n = 0; n < 5; n++) p.set(rng.int(0, 31), rng.int(0, 31), '#bcab7b');
  if (!crag && rng.bool(.4)) { const x=rng.int(4,24), y=rng.int(4,24); p.line(x,y,x+3,y-1,'#929471'); p.set(x+2,y-2,'#b0ac84'); }
  return p;
}

function riverbankTile(rng: RNG, kind: 'reed' | 'silt' | 'pool'): Px {
  const pool = kind === 'pool';
  const p = noiseGround(new Px(S,S), pool ? '#527e76' : kind === 'reed' ? '#83915e' : '#9a8b6a', pool ? '#3e645e' : '#657455', pool ? '#82a294' : '#b7ad7b', rng, .13);
  if (pool) {
    for (let n=0;n<5;n++) {
      const x=rng.int(2,25), y=rng.int(3,29);
      p.fill(x,y,rng.int(3,7),1,'#789e90'); p.set(x+2,y+1,'#648c81');
    }
  } else {
    // Fine braided sediment deposits, not the old dark poison-marsh texture.
    for (let n=0;n<4;n++) {
      const y=rng.int(2,28);
      for(let x=0;x<S;x++) p.set(x,y+Math.round(Math.sin((x+n*9)*.22)*2),kind==='reed'?'#929b6b':'#b2a17a');
    }
  }
  for (let n=0;n<(kind==='reed'?9:3);n++) {
    const x=rng.int(2,29), y=rng.int(6,30), h=rng.int(3,6);
    p.line(x,y,x+1,y-h,'#617e55');
    p.line(x,y-1,x-2,y-4,'#8f9e69');
    p.set(x+1,y-h,'#c1b787');
  }
  return p;
}

function volcanicTile(rng: RNG, kind: 'pumice' | 'flow' | 'crag'): Px {
  const pumice = kind === 'pumice';
  const p = noiseGround(new Px(S,S), pumice?'#aaa096':'#484951', pumice?'#827e77':'#303742', pumice?'#cec1af':'#717887', rng, .14);
  if (pumice) {
    // Vesicles in pale porous stones, with a sunlit lip on each cavity.
    for(let n=0;n<20;n++) {
      const x=rng.int(1,29),y=rng.int(1,29),w=rng.int(1,3);
      p.fill(x,y,w,2,'#817e79'); p.fill(x,y-1,w,1,'#c6bcab'); p.set(x+1,y+1,'#94908a');
    }
  } else {
    // Conchoidal glass fractures; thin blue-grey highlights follow their curves.
    for(let n=0;n<(kind==='crag'?7:4);n++) {
      const x=rng.int(-3,27), y=rng.int(-3,27), w=rng.int(5,13), h=rng.int(4,10);
      p.poly([[x,y+1],[x+w-3,y],[x+w,y+h-2],[x+3,y+h]],'#39424d');
      p.line(x,y+1,x+w-3,y,'#79818e');
      p.line(x+w-3,y,x+w,y+h-2,'#596b7a');
      p.line(x+3,y+h,x+w-2,y+h-2,'#292e38');
    }
    for(let n=0;n<3;n++) { const x=rng.int(1,29), y=rng.int(1,29); p.fill(x,y,2,1,'#94725a'); }
  }
  return p;
}

function aegeanBeach(rng: RNG, black: boolean): Px {
  const base=black?'#69686c':'#d6c9a3', dark=black?'#50565e':'#b6ab88', light=black?'#8d9092':'#ede0bd';
  const p=noiseGround(new Px(S,S),base,dark,light,rng,.18);
  // Low sand bars laid down by water, shell fragments and a strand of sea grass.
  for(let n=0;n<3;n++) {
    const y=rng.int(2,27);
    for(let x=0;x<S;x++) { const yy=y+Math.round(Math.sin((x+n*17)*.15)*1.2); p.set(x,yy,mix(base,light,.5)); p.set(x,yy+1,mix(base,dark,.3)); }
  }
  for(let n=0;n<3;n++) {
    const x=rng.int(2,28),y=rng.int(3,28);
    p.fill(x,y,3,1,black?'#adada3':'#eae4cf'); p.fill(x+1,y-1,2,1,black?'#c5bbb0':'#fff1da'); p.set(x+2,y+1,black?'#777b7a':'#b7a685');
  }
  if(rng.bool(.45)) { const x=rng.int(4,24),y=rng.int(5,24); p.line(x,y,x+5,y+1,black?'#77827a':'#9c9a73'); p.set(x+3,y-1,black?'#89978a':'#adab80'); }
  return p;
}

function vineyardTile(rng: RNG): Px {
  const p=noiseGround(new Px(S,S),'#8a694e','#624f3d','#af8d66',rng,.16);
  // Narrow diagonal hoe marks and pale pebbles distinguish the terrace plots
  // from the original horizontal wheat-field furrows.
  for(let n=-2;n<5;n++) {
    p.line(n*9,0,n*9+12,31,'#6e553e');
    p.line(n*9+1,0,n*9+13,31,'#a47e58');
  }
  for(let n=0;n<9;n++) { const x=rng.int(0,30), y=rng.int(0,30); p.fill(x,y,2,1,'#c1af88'); }
  return p;
}

function eurotasTile(rng: RNG): Px {
  const p=noiseGround(new Px(S,S),'#ad7052','#835039','#ce9870',rng,.16);
  for(let n=0;n<5;n++) {
    const x=rng.int(1,27),y=rng.int(3,27);
    p.line(x,y,x+4,y-1,'#815c43'); p.line(x+4,y-1,x+6,y+2,'#94664a');
    p.fill(x+1,y+3,2,1,'#d3b087');
  }
  for(let n=0;n<3;n++) { const x=rng.int(1,28), y=rng.int(3,28); p.line(x,y,x+1,y-3,'#837a50'); p.set(x+2,y-3,'#b2a66f'); }
  return p;
}

/* ------------------------------------------------------------------ */
/* Per-tile generators                                                 */
/* ------------------------------------------------------------------ */

function generateTile(id: number, rng: RNG): Px {
  switch (id) {
    case T.THYME_SCRUB: return mediterraneanCover(rng, 'thyme');
    case T.LAUREL_FLOOR: return mediterraneanCover(rng, 'laurel');
    case T.OLYMPIAN_MEADOW: return mediterraneanCover(rng, 'alpine');
    case T.GOLDEN_TERRACE: return mediterraneanCover(rng, 'golden');
    case T.STORM_HEATH: return mediterraneanCover(rng, 'heath');
    case T.GOLDEN_GARDEN: return mediterraneanCover(rng, 'garden');
    case T.LIMESTONE: return limestoneTile(rng, false);
    case T.LIMESTONE_CRAG: return limestoneTile(rng, true);
    case T.REED_BANK: return riverbankTile(rng, 'reed');
    case T.DELTA_SILT: return riverbankTile(rng, 'silt');
    case T.LERNA_POOL: return riverbankTile(rng, 'pool');
    case T.PUMICE: return volcanicTile(rng, 'pumice');
    case T.OBSIDIAN: return volcanicTile(rng, 'flow');
    case T.OBSIDIAN_CRAG: return volcanicTile(rng, 'crag');
    case T.SHELL_BEACH: return aegeanBeach(rng, false);
    case T.BLACK_BEACH: return aegeanBeach(rng, true);
    case T.AEGEAN_SPRING: return waterTile(rng, false, ['#427e88', '#79a9ad']);
    case T.VINEYARD_SOIL: return vineyardTile(rng);
    case T.CASINO_CARPET: return casinoCarpetTile(rng);
    case T.CASINO_PARQUET: return casinoParquetTile(rng);
    case T.CASINO_MARBLE: return casinoMarbleTile(rng);
    case T.EUROTAS_EARTH: return eurotasTile(rng);
    case T.DEEP_WATER: return waterTile(rng, true);
    case T.WATER: return waterTile(rng, false);
    case T.SAND: {
      const p = new Px(S, S);
      noiseGround(p, PAL.sand, PAL.sandDark, PAL.sandLit, rng, 0.16);
      for (let i = 0; i < 5; i++) {
        const y = rng.int(1, S - 2);
        for (let x = 0; x < S; x++) {
          const yy = y + Math.round(Math.sin((x + i * 11) * 0.28) * 1.8);
          p.set(x, yy, withAlpha(PAL.sandLit, 0.55));
          p.set(x, yy + 1, withAlpha(PAL.sandDark, 0.35));
        }
      }
      for (let i = 0; i < 4; i++) p.set(rng.int(0, S - 1), rng.int(0, S - 1), PAL.bone);
      return p;
    }
    case T.GRASS: return grassTile(rng, PAL.grass, PAL.grassDark, PAL.grassLit);
    case T.GRASS_DARK: return grassTile(rng, PAL.grassDark, PAL.mossDark, PAL.grass, 1.2);
    case T.GRASS_PALE: return grassTile(rng, PAL.grassLit, PAL.grass, PAL.grassPale, 0.8);
    case T.TALL_GRASS: {
      const p = grassTile(rng, PAL.grassDark, PAL.mossDark, PAL.grass, 0.6);
      for (let i = 0; i < 26; i++) {
        const x = rng.int(0, S - 1);
        const y = rng.int(6, S);
        const h = rng.int(5, 9);
        const c = rng.bool(0.5) ? PAL.grassLit : PAL.grass;
        for (let k = 0; k < h; k++) p.set(x + Math.round(Math.sin(k * 0.6) * 1.2), y - k, c);
      }
      return p;
    }
    case T.FLOWERS: {
      // sparse, muted blooms on a stem — never confetti
      const p = grassTile(rng, PAL.grass, PAL.grassDark, PAL.grassLit, 0.9);
      const cols = [mix(PAL.blood, PAL.charcoal, 0.25), mix(PAL.arcane, PAL.ink, 0.15), PAL.bone, mix(PAL.gold, PAL.soil, 0.3)];
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i++) {
        const x = rng.int(4, S - 5);
        const y = rng.int(7, S - 4);
        const c = rng.pick(cols);
        p.fill(x, y, 1, 3, PAL.grassDark);
        p.set(x - 1, y - 1, c);
        p.set(x + 1, y - 1, c);
        p.set(x, y - 2, c);
        p.set(x, y - 1, mix(c, PAL.white, 0.35));
      }
      return p;
    }
    case T.DIRT: {
      const p = noiseGround(new Px(S, S), PAL.dirt, PAL.soilDark, PAL.dirtLit, rng, 0.24);
      for (let i = 0; i < 6; i++) {
        const x = rng.int(1, S - 3);
        const y = rng.int(1, S - 3);
        p.fill(x, y, rng.int(1, 3), 1, mix(PAL.soilDark, PAL.ink, 0.4));
      }
      for (let i = 0; i < 4; i++) p.set(rng.int(0, S - 1), rng.int(0, S - 1), PAL.ash);
      return p;
    }
    case T.ROAD: {
      // Irregular fitted flagstones. Each slab gets its own tone, a lit top
      // bevel and a dark bottom one, with real mortar between — the contrast
      // is what stops a paved square reading as one flat slab of colour.
      const mortar = '#332d26';
      const p = new Px(S, S);
      p.fillAll(mortar);
      const rows = [0, 11, 22];
      for (const ry of rows) {
        const rh = 10;
        let x = -rng.int(0, 7);
        while (x < S) {
          const sw = rng.int(7, 13);
          const c = mix('#6d6152', rng.bool() ? '#9a8d78' : '#4a4137', rng.range(0.05, 0.5));
          p.fill(x + 1, ry + 1, sw - 1, rh - 1, c);
          p.fill(x + 1, ry + 1, sw - 1, 1, mix(c, '#c0b39a', 0.5));       // lit bevel
          p.fill(x + 1, ry + rh - 1, sw - 1, 1, mix(c, PAL.ink, 0.45));   // shaded bevel
          p.fill(x + 1, ry + 1, 1, rh - 1, mix(c, '#c0b39a', 0.25));
          // pitting and a hairline crack on some slabs
          for (let k = 0; k < 3; k++) {
            p.set(x + rng.int(1, sw - 1), ry + rng.int(2, rh - 2), rng.bool() ? mix(c, PAL.ink, 0.4) : mix(c, '#c0b39a', 0.35));
          }
          if (rng.bool(0.3)) {
            const kx = x + rng.int(2, Math.max(3, sw - 2));
            for (let k = 2; k < rh - 2; k++) p.set(kx + (k % 3 === 0 ? 1 : 0), ry + k, mix(c, PAL.ink, 0.5));
          }
          x += sw;
        }
      }
      // wear polished down the middle where boots fall
      for (let i = 0; i < 4; i++) p.ellipse(rng.int(0, S), rng.int(0, S), rng.int(4, 8), rng.int(3, 5), withAlpha('#a2957c', 0.16));
      for (let i = 0; i < 8; i++) p.set(rng.int(0, S - 1), rng.int(0, S - 1), withAlpha(PAL.mossDark, 0.5));
      return p;
    }
    case T.ROAD_DIRT: {
      const p = noiseGround(new Px(S, S), '#77593c', '#4e3a26', '#9a7a52', rng, 0.26);
      // wheel ruts and trodden pebbles
      for (let i = 0; i < 3; i++) {
        const y = rng.int(2, S - 3);
        for (let x = 0; x < S; x++) p.set(x, y + Math.round(Math.sin((x + i * 9) * 0.22) * 1.6), withAlpha('#4e3a26', 0.55));
      }
      for (let i = 0; i < 9; i++) {
        const x = rng.int(1, S - 3);
        const y = rng.int(1, S - 3);
        p.fill(x, y, 2, 1, '#8c8072');
        p.set(x, y, '#a89c8c');
      }
      return p;
    }
    case T.FARM_SOIL: {
      const p = new Px(S, S);
      p.fillAll(PAL.soil);
      for (let y = 0; y < S; y += 5) {
        p.fill(0, y, S, 3, PAL.soilDark);
        p.fill(0, y + 3, S, 1, mix(PAL.soil, PAL.dirtLit, 0.6));
      }
      p.speckle(0, 0, S, S, [PAL.soilDark, PAL.dirt], 0.12, rng);
      return p;
    }
    case T.STONE_GROUND: return rockTile(rng, PAL.rockLit, PAL.rock, PAL.rockPale);
    case T.GRAVEL: {
      const p = new Px(S, S);
      p.fillAll(PAL.rock);
      for (let i = 0; i < 60; i++) {
        p.fill(rng.int(0, S - 2), rng.int(0, S - 2), rng.int(1, 2), rng.int(1, 2), rng.pick([PAL.rockLit, PAL.rockPale, PAL.rockDark]));
      }
      return p;
    }
    case T.MOUNTAIN: return rockTile(rng, PAL.rock, PAL.rockDark, PAL.rockPale);
    case T.CLIFF: return rockTile(rng, PAL.slate, PAL.ink, PAL.stone);
    case T.SNOW: {
      const p = noiseGround(new Px(S, S), PAL.snow, PAL.snowDark, PAL.white, rng, 0.16);
      for (let i = 0; i < 8; i++) p.set(rng.int(0, S - 1), rng.int(0, S - 1), PAL.white);
      return p;
    }
    case T.SNOW_ROCK: {
      const p = rockTile(rng, PAL.rockPale, PAL.rock, PAL.snowDark);
      for (let i = 0; i < 9; i++) p.ellipse(rng.int(0, S), rng.int(0, S), rng.int(2, 5), rng.int(1, 3), PAL.snow);
      return p;
    }
    case T.ICE:
    case T.ICE_FLOOR: {
      const p = new Px(S, S);
      p.fillAll(PAL.ice);
      for (let i = 0; i < 6; i++) p.ellipse(rng.int(0, S), rng.int(0, S), rng.int(3, 8), rng.int(2, 5), mix(PAL.ice, PAL.white, 0.35));
      for (let i = 0; i < 4; i++) p.line(rng.int(0, S), rng.int(0, S), rng.int(0, S), rng.int(0, S), mix(PAL.ice, PAL.frost, 0.6));
      return p;
    }
    case T.ICE_WALL: return wallTile(rng, PAL.frost, PAL.water, PAL.white, false);
    case T.SWAMP_WATER: {
      const p = new Px(S, S);
      p.fillAll(PAL.swampDark);
      for (let i = 0; i < 6; i++) p.ellipse(rng.int(0, S), rng.int(0, S), rng.int(3, 8), rng.int(2, 5), mix(PAL.swampDark, PAL.swamp, 0.6));
      for (let i = 0; i < 10; i++) p.set(rng.int(0, S - 1), rng.int(0, S - 1), PAL.toxic);
      for (let i = 0; i < 3; i++) p.ellipse(rng.int(0, S), rng.int(0, S), rng.int(2, 4), 2, withAlpha(PAL.rot, 0.7));
      return p;
    }
    case T.SWAMP_GROUND: return grassTile(rng, PAL.swamp, PAL.swampDark, PAL.rot, 0.7);
    case T.MUD: return noiseGround(new Px(S, S), PAL.soilDark, PAL.ink, PAL.soil, rng, 0.3);
    case T.DESERT_SAND: {
      const p = noiseGround(new Px(S, S), PAL.sandLit, PAL.sand, PAL.cloth, rng, 0.12);
      for (let i = 0; i < 5; i++) {
        const y = rng.int(1, S - 2);
        for (let x = 0; x < S; x++) p.set(x, y + Math.round(Math.sin((x + i * 7) * 0.25) * 2), mix(PAL.sandLit, PAL.sandDark, 0.35));
      }
      return p;
    }
    case T.DESERT_ROCK:
    case T.SAND_FLOOR: return cobbleTile(rng, PAL.sandDark, PAL.clay, PAL.sand, 8);
    case T.SAND_WALL: return wallTile(rng, PAL.sandDark, PAL.soil, PAL.sand);
    case T.ASH_GROUND: {
      const p = noiseGround(new Px(S, S), PAL.stone, PAL.charcoal, PAL.ash, rng, 0.26);
      for (let i = 0; i < 4; i++) p.set(rng.int(0, S - 1), rng.int(0, S - 1), PAL.ember);
      return p;
    }
    case T.BRIDGE: {
      const p = plankTile(rng, PAL.wood, PAL.woodDark, PAL.plank, false);
      p.fill(0, 0, S, 2, PAL.woodDark);
      p.fill(0, S - 2, S, 2, PAL.woodDark);
      return p;
    }
    case T.FLOOR_WOOD: return plankTile(rng, '#7a5734', '#3f2a17', '#9a7449', false);
    case T.FLOOR_STONE: return cobbleTile(rng, '#5a5364', '#2b2634', '#8a8296', 8);
    case T.FLOOR_CARPET: {
      const p = new Px(S, S);
      p.fillAll(PAL.blood);
      p.box(0, 0, S, S, shade(PAL.blood, 0.75));
      for (let i = 0; i < 20; i++) p.set(rng.int(1, S - 2), rng.int(1, S - 2), shade(PAL.blood, 1.2));
      p.box(4, 4, S - 8, S - 8, PAL.gold);
      return p;
    }
    case T.WALL_WOOD: {
      const p = plankTile(rng, '#33231a', '#1a1009', '#4a3324', true);
      p.tint(PAL.ink, 0.3);
      p.fill(0, 0, S, 2, '#6a4a2e');
      p.fill(0, 2, S, 1, '#2a1c12');
      for (let i = 0; i < 10; i++) p.set(rng.int(0, S - 1), rng.int(3, S - 1), '#150d07');
      return p;
    }
    case T.WALL_STONE: return wallTile(rng, '#3b3546', PAL.void, PAL.stone);
    case T.DUNGEON_FLOOR: return cobbleTile(rng, PAL.rock, PAL.rockDark, PAL.rockLit, 8);
    case T.DUNGEON_WALL: return wallTile(rng, PAL.rockDark, PAL.ink, PAL.rock);
    case T.CRYPT_FLOOR: {
      const p = cobbleTile(rng, PAL.slate, PAL.ink, PAL.stone, 16);
      if (rng.bool(0.3)) p.ellipse(rng.int(4, S - 4), rng.int(4, S - 4), 3, 2, withAlpha(PAL.rot, 0.5));
      return p;
    }
    case T.CRYPT_WALL: return wallTile(rng, PAL.charcoal, PAL.void, PAL.slate);
    case T.CAVE_FLOOR: return noiseGround(new Px(S, S), '#4d4436', '#2b2620', PAL.dirt, rng, 0.3);
    case T.CAVE_WALL: return rockTile(rng, '#2b2620', PAL.void, PAL.soil);
    case T.TEMPLE_FLOOR: {
      const p = cobbleTile(rng, PAL.moss, PAL.mossDark, PAL.grassDark, 16);
      for (let i = 0; i < 12; i++) p.set(rng.int(0, S - 1), rng.int(0, S - 1), PAL.leafLit);
      return p;
    }
    case T.TEMPLE_WALL: {
      const p = wallTile(rng, PAL.mossDark, PAL.ink, PAL.moss);
      for (let i = 0; i < 10; i++) p.set(rng.int(0, S - 1), rng.int(0, S - 1), PAL.leaf);
      return p;
    }
    case T.TOWER_FLOOR: {
      const p = cobbleTile(rng, PAL.arcaneDark, PAL.ink, PAL.arcane, 16);
      for (let i = 0; i < 6; i++) p.set(rng.int(0, S - 1), rng.int(0, S - 1), PAL.arcaneLit);
      return p;
    }
    case T.TOWER_WALL: return wallTile(rng, '#1a1233', PAL.void, PAL.arcane);
    case T.PIT: {
      const p = new Px(S, S);
      p.fillAll(PAL.void);
      p.fill(0, 0, S, 3, PAL.ink);
      p.speckle(0, 0, S, 8, [PAL.charcoal], 0.1, rng);
      return p;
    }
    case T.RUNE_FLOOR: {
      const p = cobbleTile(rng, PAL.arcaneDark, PAL.ink, PAL.arcane, 16);
      p.circle(S / 2, S / 2, 9, withAlpha(PAL.arcaneLit, 0.25));
      p.box(S / 2 - 6, S / 2 - 6, 12, 12, PAL.arcaneLit);
      return p;
    }
    case T.BLOOD_FLOOR: {
      const p = cobbleTile(rng, PAL.rock, PAL.rockDark, PAL.rockLit, 8);
      for (let i = 0; i < 4; i++) p.ellipse(rng.int(2, S - 2), rng.int(2, S - 2), rng.int(2, 6), rng.int(2, 4), withAlpha(PAL.blood, 0.6));
      return p;
    }
    default: {
      const p = new Px(S, S);
      const greek: Record<number, [string, string, string]> = {
        [T.AEGEAN_GRASS]: ['#819667', '#687f50', '#a6b884'],
        [T.MARBLE]: ['#d9cfac', '#b2aa90', '#eee6cc'],
        [T.MARBLE_WALL]: ['#a9a388', '#767666', '#e5d9b5'],
        [T.TERRACOTTA]: ['#b67d53', '#91563d', '#d2a675'],
        [T.AEGEAN_SHALLOWS]: ['#388c9a', '#256977', '#79b9b6'],
        [T.AEGEAN_SEA]: ['#204667', '#18364e', '#3d6e88'],
        [T.BASALT]: ['#514c52', '#37353c', '#726772'],
        [T.ASPHODEL]: ['#898d82', '#626e69', '#b0bba6'],
        [T.STYGIAN]: ['#3f5365', '#27374a', '#7a8da6'],
        [T.BRONZE_FLOOR]: ['#897444', '#594d36', '#b69a5a'],
      };
      const colors = greek[id];
      if (!colors) return p.fillAll(PAL.charcoal);
      if (id === T.AEGEAN_GRASS || id === T.ASPHODEL)
        return grassTile(rng, colors[0], colors[1], colors[2], id === T.ASPHODEL ? .8 : 1);
      if (id === T.BASALT) return rockTile(rng, colors[0], colors[1], colors[2]);
      if (id === T.AEGEAN_SEA || id === T.AEGEAN_SHALLOWS) return oceanTile(rng, id === T.AEGEAN_SEA);
      if (id === T.STYGIAN)
        return waterTile(rng, true, [colors[0], colors[2]]);
      if (id === T.MARBLE || id === T.BRONZE_FLOOR) {
        const stone = cobbleTile(rng, colors[0], colors[1], colors[2], id === T.MARBLE ? 11 : 8);
        for (let n=0;n<3;n++) {
          const x=rng.int(1,30), y=rng.int(2,29);
          stone.line(x,y,x+rng.int(-4,4),y+3,mix(colors[0],colors[1],.55));
        }
        return stone;
      }
      noiseGround(p, colors[0], colors[1], colors[2], rng, .12);
      if (id === T.MARBLE || id === T.MARBLE_WALL || id === T.BRONZE_FLOOR) {
        p.line(0, 15, 31, 15, colors[1]).line(15, 0, 15, 15, colors[1]).line(7, 16, 7, 31, colors[1]);
        if (id === T.MARBLE_WALL) p.fill(0, 3, 32, 3, '#944a3c').fill(0, 7, 32, 2, '#b49d59');
      }
      if (id === T.AEGEAN_SEA || id === T.AEGEAN_SHALLOWS || id === T.STYGIAN) {
        for (let n = 0; n < 3; n++) p.line(rng.int(1, 12), 5 + n * 10, rng.int(18, 30), 5 + n * 10, colors[2]);
      }
      return p;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Tileset assembly                                                    */
/* ------------------------------------------------------------------ */

export interface Tileset {
  sheet: Canvas;
  faces: Canvas;
  /** Alpha masks used to bleed a higher-priority material over its neighbour. */
  masks: Canvas[];
}

const MASK_DIRS: Array<[number, number]> = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
  [-1, -1], [1, -1], [1, 1], [-1, 1],
];

function buildMask(index: number, rng: RNG): Canvas {
  const p = new Px(S, S);
  const [dx, dy] = MASK_DIRS[index];
  const corner = index >= 4;
  const depth = corner ? 9 : 11;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let d: number;
      if (corner) {
        const ex = dx < 0 ? x : S - 1 - x;
        const ey = dy < 0 ? y : S - 1 - y;
        d = Math.max(ex, ey);
      } else if (dx !== 0) {
        d = dx < 0 ? x : S - 1 - x;
      } else {
        d = dy < 0 ? y : S - 1 - y;
      }
      if (d > depth) continue;
      const t = 1 - d / depth;
      // Dithered threshold keeps the seam looking hand-placed rather than blurred.
      if (rng.next() < t * t * 1.35) p.set(x, y, '#ffffff');
    }
  }
  return p.canvas;
}

/* ------------------------------------------------------------------ */
/* The Gilded Spade                                                    */
/* ------------------------------------------------------------------ */

/**
 * Casino floors, authored to be *seamless*.
 *
 * Everything structural — the damask lattice, the parquet run, the marble
 * joint — is derived from the tile-local coordinate modulo a divisor of 32,
 * so it continues straight across the tile edge no matter which of the four
 * variants the renderer picks. Only the noise passes use the rng. That is the
 * whole reason these exist: the room used to be laid with `FLOOR_CARPET`,
 * which draws a gold box inside every single tile, and a 15x11 room of those
 * reads as graph paper rather than as a floor.
 */
function casinoCarpetTile(rng: RNG): Px {
  const p = new Px(S, S);
  const base = '#7c1f2e';
  const deep = '#5c1522';
  const lit = '#9c2b3b';
  p.fillAll(base);

  // Pile: short vertical strokes, dense enough to kill the flat fill.
  for (let i = 0; i < 90; i++) {
    const x = rng.int(0, S - 1);
    const y = rng.int(0, S - 1);
    p.set(x, y, rng.bool(0.52) ? deep : lit);
  }
  // A woven diagonal lattice on a 16px pitch — wraps at the tile edge.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if ((x + y) % 16 === 0) p.set(x, y, mix(base, deep, 0.55));
      else if ((x - y + 64) % 16 === 0) p.set(x, y, mix(base, lit, 0.35));
    }
  }
  // A gold fleur at each lattice crossing: (8,8) and (24,24) in tile space.
  for (const [cx, cy] of [[8, 8], [24, 24]] as Array<[number, number]>) {
    const g1 = withAlpha(PAL.gold, 0.5);
    const g2 = withAlpha(PAL.goldLit, 0.34);
    p.set(cx, cy - 3, g1); p.set(cx, cy + 3, g1);
    p.set(cx - 3, cy, g1); p.set(cx + 3, cy, g1);
    p.set(cx - 2, cy - 2, g2); p.set(cx + 2, cy - 2, g2);
    p.set(cx - 2, cy + 2, g2); p.set(cx + 2, cy + 2, g2);
    p.set(cx, cy, withAlpha(PAL.goldLit, 0.6));
  }
  return p;
}

/** Polished board floor: a running bond whose seams line up across tiles. */
function casinoParquetTile(rng: RNG): Px {
  const p = new Px(S, S);
  const base = '#5b3a22';
  p.fillAll(base);
  for (let y = 0; y < S; y++) {
    // Boards are 8px deep; every other course is offset by half a board.
    const course = Math.floor(y / 8);
    const tone = course % 2 === 0 ? mix(base, '#7d5533', 0.32) : mix(base, '#3b2415', 0.3);
    for (let x = 0; x < S; x++) p.set(x, y, tone);
  }
  for (let i = 0; i < 70; i++) {
    const x = rng.int(0, S - 1);
    const y = rng.int(0, S - 1);
    p.set(x, y, rng.bool(0.5) ? withAlpha('#2a1a0e', 0.5) : withAlpha('#9a7046', 0.35));
  }
  // Course seams and the butt joints between boards, both on 32-divisors.
  for (let y = 0; y < S; y += 8) p.fill(0, y, S, 1, '#2a1a0e');
  for (let y = 0; y < S; y += 8) {
    const offset = ((y / 8) % 2) * 8;
    for (let x = offset; x < S; x += 16) p.fill(x, y, 1, 8, '#33200f');
  }
  // A low sheen across the top of each course, so it reads as polished.
  for (let y = 1; y < S; y += 8) p.fill(0, y, S, 1, withAlpha('#b98f5c', 0.16));
  return p;
}

/**
 * The entrance apron: warm dark marble in 16px squares, veined in brass.
 * Deliberately brown-black rather than the cool slate the rest of the game's
 * stone uses — a cold grey threshold in the middle of all this crimson reads
 * as a hole in the floor.
 */
function casinoMarbleTile(rng: RNG): Px {
  const p = new Px(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dark = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0;
      p.set(x, y, dark ? '#332430' : '#4a3641');
    }
  }
  for (let i = 0; i < 9; i++) {
    const x = rng.int(0, S - 1);
    const y = rng.int(0, S - 1);
    p.line(x, y, x + rng.int(-7, 7), y + rng.int(-7, 7), withAlpha('#9c8478', 0.28));
  }
  for (let i = 0; i < 6; i++) {
    const x = rng.int(0, S - 1);
    const y = rng.int(0, S - 1);
    p.line(x, y, x + rng.int(-5, 5), y + rng.int(-5, 5), withAlpha(PAL.gold, 0.3));
  }
  // The grout, on a 16px pitch, continuous across tiles.
  for (let i = 0; i < S; i += 16) {
    p.fill(i, 0, 1, S, withAlpha(PAL.gold, 0.32));
    p.fill(0, i, S, 1, withAlpha(PAL.gold, 0.32));
  }
  return p;
}

let cached: Tileset | null = null;

export function getTileset(): Tileset {
  if (cached) return cached;
  const rng = new RNG('modulo-tiles-v1');

  const sheet = makeCanvas(S * VARIANTS, S * TILE_COUNT);
  const g = ctx2d(sheet);
  for (let id = 0; id < TILE_COUNT; id++) {
    for (let v = 0; v < VARIANTS; v++) {
      // New materials use their own streams: adding Greek tiles must never
      // shift the original wall faces or transition-mask pixels.
      const p = generateTile(id, id >= T.AEGEAN_GRASS ? new RNG(`aegean-material:${id}:${v}`) : rng);
      g.drawImage(p.canvas, v * S, id * S);
    }
  }

  const faces = makeCanvas(S * VARIANTS, S * TILE_COUNT);
  const fg = ctx2d(faces);
  const faceSpec: Record<number, [string, string, string]> = {
    [T.WALL_STONE]: [PAL.stone, PAL.charcoal, PAL.fog],
    [T.WALL_WOOD]: [PAL.wood, PAL.woodDark, PAL.plank],
    [T.DUNGEON_WALL]: [PAL.rockDark, PAL.ink, PAL.rock],
    [T.CRYPT_WALL]: [PAL.charcoal, PAL.void, PAL.slate],
    [T.CAVE_WALL]: ['#2b2620', PAL.void, PAL.soil],
    [T.TEMPLE_WALL]: [PAL.mossDark, PAL.ink, PAL.moss],
    [T.TOWER_WALL]: ['#1a1233', PAL.void, PAL.arcane],
    [T.ICE_WALL]: [PAL.frost, PAL.water, PAL.white],
    [T.SAND_WALL]: [PAL.sandDark, PAL.soil, PAL.sand],
    [T.MOUNTAIN]: [PAL.rock, PAL.rockDark, PAL.rockPale],
    [T.CLIFF]: [PAL.slate, PAL.ink, PAL.stone],
    [T.SNOW_ROCK]: [PAL.rockPale, PAL.rock, PAL.snow],
  };
  for (const [idStr, cols] of Object.entries(faceSpec)) {
    const id = Number(idStr);
    for (let v = 0; v < VARIANTS; v++) {
      fg.drawImage(wallFace(rng, cols[0], cols[1], cols[2]).canvas, v * S, id * S);
    }
  }

  for (const id of [T.LIMESTONE_CRAG, T.OBSIDIAN_CRAG]) {
    for (let v = 0; v < VARIANTS; v++) {
      const faceRng = new RNG(`aegean-face:${id}:${v}`);
      const face = id === T.LIMESTONE_CRAG
        ? limestoneTile(faceRng, true)
        : volcanicTile(faceRng, 'crag');
      face.tint(id === T.LIMESTONE_CRAG ? '#686f67' : '#202c3a', .28);
      face.fill(0, 0, S, 1, id === T.LIMESTONE_CRAG ? '#ccc6ae' : '#77818b');
      face.shadeBottom(12, .45);
      fg.drawImage(face.canvas, v * S, id * S);
    }
  }

  const masks = MASK_DIRS.map((_, i) => buildMask(i, rng));
  cached = { sheet, faces, masks };
  return cached;
}

export const TILE_VARIANTS = VARIANTS;
