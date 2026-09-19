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

/* ------------------------------------------------------------------ */
/* Per-tile generators                                                 */
/* ------------------------------------------------------------------ */

function generateTile(id: number, rng: RNG): Px {
  switch (id) {
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
      if (id === T.AEGEAN_SEA || id === T.AEGEAN_SHALLOWS || id === T.STYGIAN)
        return waterTile(rng, id !== T.AEGEAN_SHALLOWS, [colors[0], colors[2]]);
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

let cached: Tileset | null = null;

export function getTileset(): Tileset {
  if (cached) return cached;
  const rng = new RNG('modulo-tiles-v1');

  const sheet = makeCanvas(S * VARIANTS, S * TILE_COUNT);
  const g = ctx2d(sheet);
  for (let id = 0; id < TILE_COUNT; id++) {
    for (let v = 0; v < VARIANTS; v++) {
      const p = generateTile(id, rng);
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

  const masks = MASK_DIRS.map((_, i) => buildMask(i, rng));
  cached = { sheet, faces, masks };
  return cached;
}

export const TILE_VARIANTS = VARIANTS;
