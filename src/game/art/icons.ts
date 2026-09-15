import { RNG } from '../core/rng';
import { PAL, mix, shade, withAlpha } from './palette';
import { Px, type Canvas } from './pixel';
import { drawWeapon, type WeaponKind } from './weaponart';

export const ICON = 32;

export type IconKind =
  | WeaponKind
  | 'helmet' | 'chest' | 'gloves' | 'boots' | 'ring' | 'amulet' | 'cloak'
  | 'potion_health' | 'potion_mana' | 'potion_stamina' | 'potion_buff' | 'elixir'
  | 'food_bread' | 'food_meat' | 'food_cheese' | 'food_apple'
  | 'mat_ore' | 'mat_ingot' | 'mat_leather' | 'mat_cloth' | 'mat_herb' | 'mat_bone' | 'mat_crystal' | 'mat_essence'
  | 'gold' | 'key' | 'scroll' | 'map' | 'gem' | 'quest' | 'skull' | 'rune' | 'torch_item' | 'bomb';

interface IconOpts {
  metal?: string;
  accent?: string;
  glow?: string | null;
}

function centered(draw: (p: Px) => void): Px {
  const p = new Px(ICON, ICON);
  draw(p);
  return p;
}

function armorPiece(kind: string, metal: string, accent: string, rng: RNG): Px {
  const dark = shade(metal, 0.6);
  const light = shade(metal, 1.35);
  return centered((p) => {
    switch (kind) {
      case 'helmet':
        p.ellipse(16, 15, 10, 9, metal);
        p.fill(6, 15, 20, 8, metal);
        p.ellipse(16, 13, 9, 7, light);
        p.ellipse(16, 14, 8, 6, metal);
        p.fill(6, 17, 20, 4, PAL.ink);
        p.fill(8, 18, 5, 2, accent);
        p.fill(19, 18, 5, 2, accent);
        p.fill(15, 6, 2, 18, light);
        p.fill(6, 22, 20, 3, dark);
        break;
      case 'chest':
        p.poly([[8, 6], [24, 6], [26, 12], [24, 26], [8, 26], [6, 12]], metal);
        p.poly([[8, 6], [16, 6], [16, 26], [8, 26], [6, 12]], light);
        p.fill(6, 10, 20, 2, dark);
        p.fill(14, 12, 4, 12, accent);
        p.fill(4, 7, 5, 6, metal);
        p.fill(23, 7, 5, 6, metal);
        p.fill(6, 24, 20, 2, dark);
        break;
      case 'gloves':
        for (const ox of [2, 15]) {
          p.fill(ox + 1, 12, 12, 12, metal);
          p.fill(ox + 1, 12, 12, 3, light);
          p.fill(ox + 2, 8, 3, 5, metal);
          p.fill(ox + 6, 7, 3, 6, metal);
          p.fill(ox + 10, 9, 3, 4, metal);
          p.fill(ox + 1, 21, 12, 3, accent);
        }
        break;
      case 'boots':
        for (const ox of [2, 16]) {
          p.fill(ox + 2, 7, 8, 14, metal);
          p.fill(ox + 2, 7, 8, 3, light);
          p.fill(ox, 19, 13, 6, dark);
          p.fill(ox, 23, 13, 2, PAL.ink);
          p.fill(ox + 2, 14, 8, 2, accent);
        }
        break;
      case 'cloak':
        p.poly([[16, 4], [26, 12], [24, 27], [8, 27], [6, 12]], metal);
        p.poly([[16, 4], [16, 27], [8, 27], [6, 12]], light);
        p.fill(10, 5, 12, 4, accent);
        p.circle(16, 7, 2, PAL.gold);
        for (let i = 0; i < 4; i++) p.line(9 + i * 4, 12, 9 + i * 4, 26, dark);
        break;
      case 'ring':
        p.circle(16, 17, 9, metal);
        p.circle(16, 17, 6, 'rgba(0,0,0,0)');
        p.g.save();
        p.g.globalCompositeOperation = 'destination-out';
        p.circle(16, 17, 6, '#fff');
        p.g.restore();
        p.circle(16, 17, 9, 'rgba(0,0,0,0)');
        p.g.save();
        p.g.globalCompositeOperation = 'destination-over';
        p.circle(16, 17, 9, metal);
        p.g.restore();
        p.poly([[16, 3], [21, 8], [16, 13], [11, 8]], accent);
        p.poly([[16, 3], [21, 8], [16, 8]], shade(accent, 1.4));
        break;
      case 'amulet':
        for (let i = 0; i < 14; i++) {
          const a = Math.PI + (i / 13) * Math.PI;
          p.set(16 + Math.cos(a) * 10, 14 + Math.sin(a) * 9, metal);
          p.set(16 + Math.cos(a) * 10, 15 + Math.sin(a) * 9, shade(metal, 0.7));
        }
        p.ellipse(16, 22, 6, 7, metal);
        p.ellipse(16, 22, 4, 5, accent);
        p.ellipse(15, 20, 2, 2, PAL.white);
        break;
      default:
        p.fill(8, 8, 16, 16, metal);
    }
    for (let i = 0; i < 6; i++) p.set(rng.int(6, 26), rng.int(6, 26), withAlpha(PAL.white, 0.15));
  });
}

function potion(main: string, glass = PAL.bone): Px {
  return centered((p) => {
    p.fill(13, 4, 6, 4, PAL.wood);
    p.fill(13, 4, 6, 1, PAL.plank);
    p.fill(14, 8, 4, 3, withAlpha(glass, 0.5));
    p.poly([[12, 11], [20, 11], [24, 19], [24, 26], [8, 26], [8, 19]], withAlpha(glass, 0.35));
    p.poly([[11, 15], [21, 15], [23, 20], [23, 25], [9, 25], [9, 20]], main);
    p.poly([[11, 15], [16, 15], [16, 25], [9, 25], [9, 20]], shade(main, 1.25));
    p.fill(11, 15, 10, 1, withAlpha(PAL.white, 0.65));
    p.fill(10, 18, 2, 6, withAlpha(PAL.white, 0.35));
    p.ellipse(16, 20, 9, 9, withAlpha(main, 0.12));
    p.outline(PAL.ink);
  });
}

const GEN: Record<string, (rng: RNG, o: IconOpts) => Px> = {
  helmet: (rng, o) => armorPiece('helmet', o.metal ?? PAL.iron, o.accent ?? PAL.gold, rng),
  chest: (rng, o) => armorPiece('chest', o.metal ?? PAL.iron, o.accent ?? PAL.gold, rng),
  gloves: (rng, o) => armorPiece('gloves', o.metal ?? PAL.iron, o.accent ?? PAL.gold, rng),
  boots: (rng, o) => armorPiece('boots', o.metal ?? PAL.iron, o.accent ?? PAL.gold, rng),
  cloak: (rng, o) => armorPiece('cloak', o.metal ?? PAL.blood, o.accent ?? PAL.gold, rng),
  ring: (rng, o) => armorPiece('ring', o.metal ?? PAL.gold, o.accent ?? PAL.frost, rng),
  amulet: (rng, o) => armorPiece('amulet', o.metal ?? PAL.gold, o.accent ?? PAL.arcaneLit, rng),

  potion_health: () => potion(PAL.blood),
  potion_mana: () => potion(PAL.arcane),
  potion_stamina: () => potion(PAL.toxic),
  potion_buff: () => potion(PAL.flame),
  elixir: () => {
    const p = potion(PAL.goldLit);
    p.circle(16, 20, 2, PAL.white);
    return p;
  },

  food_bread: (rng) => centered((p) => {
    p.ellipse(16, 18, 11, 7, PAL.clay);
    p.ellipse(16, 16, 10, 6, PAL.sandLit);
    p.ellipse(15, 15, 7, 3, mix(PAL.sandLit, PAL.white, 0.3));
    for (let i = 0; i < 3; i++) p.line(10 + i * 4, 12, 13 + i * 4, 20, PAL.clay);
    for (let i = 0; i < 6; i++) p.set(rng.int(8, 24), rng.int(13, 22), PAL.sandDark);
    p.outline(PAL.soil);
  }),
  food_meat: () => centered((p) => {
    p.ellipse(18, 16, 9, 8, PAL.blood);
    p.ellipse(17, 14, 7, 6, mix(PAL.blood, PAL.flame, 0.35));
    p.fill(6, 20, 10, 4, PAL.bone);
    p.ellipse(6, 22, 3, 3, PAL.cloth);
    p.outline(PAL.ink);
  }),
  food_cheese: () => centered((p) => {
    p.poly([[6, 22], [26, 22], [26, 12], [6, 18]], PAL.gold);
    p.poly([[6, 18], [26, 12], [26, 15], [6, 21]], PAL.goldLit);
    p.circle(12, 20, 2, shade(PAL.gold, 0.7));
    p.circle(20, 18, 2, shade(PAL.gold, 0.7));
    p.outline(PAL.soil);
  }),
  food_apple: () => centered((p) => {
    p.ellipse(16, 18, 8, 8, PAL.blood);
    p.ellipse(14, 16, 5, 5, PAL.ember);
    p.ellipse(13, 14, 2, 2, PAL.flameLit);
    p.fill(16, 8, 2, 4, PAL.wood);
    p.ellipse(20, 9, 4, 2, PAL.leaf);
    p.outline(PAL.ink);
  }),

  mat_ore: (rng, o) => centered((p) => {
    p.poly([[6, 24], [10, 12], [20, 8], [26, 18], [22, 25]], PAL.rock);
    p.poly([[10, 12], [20, 8], [18, 16], [11, 18]], PAL.rockLit);
    for (let i = 0; i < 7; i++) {
      const x = rng.int(9, 22); const y = rng.int(11, 22);
      p.fill(x, y, 2, 2, o.metal ?? PAL.gold);
      p.set(x, y, shade(o.metal ?? PAL.gold, 1.4));
    }
    p.outline(PAL.ink);
  }),
  mat_ingot: (rng, o) => centered((p) => {
    const m = o.metal ?? PAL.iron;
    p.poly([[6, 22], [10, 14], [22, 14], [26, 22]], m);
    p.fill(10, 12, 12, 3, shade(m, 1.35));
    p.poly([[6, 22], [10, 14], [16, 14], [14, 22]], shade(m, 1.15));
    p.fill(6, 22, 20, 3, shade(m, 0.7));
    p.outline(PAL.ink);
  }),
  mat_leather: () => centered((p) => {
    p.poly([[8, 8], [24, 10], [26, 22], [10, 24], [6, 16]], PAL.clay);
    p.poly([[8, 8], [16, 9], [17, 23], [10, 24], [6, 16]], mix(PAL.clay, PAL.sandLit, 0.3));
    for (let i = 0; i < 5; i++) p.set(10 + i * 3, 11 + i, PAL.soil);
    p.outline(PAL.soilDark);
  }),
  mat_cloth: () => centered((p) => {
    p.fill(6, 10, 20, 14, PAL.cloth);
    p.fill(6, 10, 20, 4, PAL.white);
    p.fill(6, 18, 20, 2, PAL.bone);
    p.poly([[6, 24], [26, 24], [22, 27], [10, 27]], PAL.bone);
    p.outline(PAL.stone);
  }),
  mat_herb: (rng) => centered((p) => {
    p.fill(15, 14, 2, 12, PAL.moss);
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      p.ellipse(16 + side * 5, 12 + i * 2, 5, 2.4, i % 3 === 0 ? PAL.leafLit : PAL.leaf);
    }
    p.ellipse(16, 8, 4, 4, PAL.arcaneLit);
    for (let i = 0; i < 4; i++) p.set(rng.int(12, 20), rng.int(6, 10), PAL.white);
    p.outline(PAL.mossDark);
  }),
  mat_bone: () => centered((p) => {
    p.fill(8, 14, 16, 4, PAL.cloth);
    p.circle(8, 13, 3, PAL.bone);
    p.circle(8, 19, 3, PAL.bone);
    p.circle(24, 13, 3, PAL.bone);
    p.circle(24, 19, 3, PAL.bone);
    p.fill(8, 14, 16, 2, PAL.white);
    p.outline(PAL.stone);
  }),
  mat_crystal: (rng, o) => centered((p) => {
    const c = o.metal ?? PAL.arcaneLit;
    p.poly([[16, 3], [24, 14], [20, 28], [12, 28], [8, 14]], c);
    p.poly([[16, 3], [16, 28], [12, 28], [8, 14]], shade(c, 1.35));
    p.poly([[16, 3], [24, 14], [18, 16]], shade(c, 0.7));
    p.ellipse(16, 16, 12, 14, withAlpha(c, 0.12));
    for (let i = 0; i < 4; i++) p.set(rng.int(12, 20), rng.int(8, 24), PAL.white);
    p.outline(PAL.ink);
  }),
  mat_essence: () => centered((p) => {
    p.ellipse(16, 16, 11, 11, withAlpha(PAL.arcane, 0.15));
    p.ellipse(16, 16, 7, 8, withAlpha(PAL.arcaneLit, 0.55));
    p.ellipse(15, 14, 4, 4, withAlpha(PAL.white, 0.85));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.set(16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, PAL.frost);
    }
  }),

  gold: (rng) => centered((p) => {
    for (const [x, y] of [[9, 20], [19, 21], [14, 14]] as Array<[number, number]>) {
      p.ellipse(x, y, 7, 5, PAL.gold);
      p.ellipse(x, y - 1, 6, 4, PAL.goldLit);
      p.ellipse(x, y - 1, 3, 2, mix(PAL.goldLit, PAL.white, 0.5));
    }
    for (let i = 0; i < 5; i++) p.set(rng.int(6, 26), rng.int(10, 24), PAL.white);
    p.outline(PAL.soil);
  }),
  key: () => centered((p) => {
    p.circle(10, 12, 6, PAL.gold);
    p.circle(10, 12, 3, 'rgba(0,0,0,0)');
    p.g.save(); p.g.globalCompositeOperation = 'destination-out'; p.circle(10, 12, 3, '#fff'); p.g.restore();
    p.fill(12, 16, 3, 12, PAL.gold);
    p.fill(15, 22, 4, 2, PAL.gold);
    p.fill(15, 26, 5, 2, PAL.gold);
    p.fill(12, 16, 1, 12, PAL.goldLit);
    p.outline(PAL.soil);
  }),
  scroll: (rng) => centered((p) => {
    p.fill(8, 6, 16, 20, PAL.cloth);
    p.fill(8, 6, 16, 3, PAL.white);
    for (let i = 0; i < 5; i++) p.fill(11, 11 + i * 3, rng.int(5, 11), 1, PAL.ash);
    p.ellipse(8, 16, 3, 11, PAL.bone);
    p.ellipse(24, 16, 3, 11, PAL.bone);
    p.fill(14, 22, 5, 5, withAlpha(PAL.blood, 0.8));
    p.outline(PAL.stone);
  }),
  map: () => centered((p) => {
    p.fill(5, 7, 22, 18, PAL.sandLit);
    p.fill(5, 7, 22, 3, PAL.cloth);
    p.line(8, 20, 14, 13, PAL.clay);
    p.line(14, 13, 22, 16, PAL.clay);
    p.ellipse(12, 11, 3, 2, PAL.leaf);
    p.fill(20, 19, 3, 3, PAL.blood);
    p.line(19, 18, 23, 22, PAL.blood);
    p.line(23, 18, 19, 22, PAL.blood);
    p.outline(PAL.soil);
  }),
  gem: (rng, o) => centered((p) => {
    const c = o.metal ?? PAL.blood;
    p.poly([[16, 5], [26, 13], [16, 27], [6, 13]], c);
    p.poly([[16, 5], [16, 27], [6, 13]], shade(c, 1.4));
    p.poly([[16, 5], [26, 13], [21, 13]], shade(c, 0.65));
    p.line(6, 13, 26, 13, withAlpha(PAL.white, 0.4));
    p.ellipse(16, 16, 13, 14, withAlpha(c, 0.12));
    for (let i = 0; i < 3; i++) p.set(rng.int(12, 20), rng.int(9, 20), PAL.white);
    p.outline(PAL.ink);
  }),
  quest: () => centered((p) => {
    p.fill(7, 5, 18, 22, PAL.cloth);
    p.fill(7, 5, 18, 3, PAL.white);
    p.fill(10, 10, 12, 2, PAL.ash);
    p.fill(10, 14, 12, 2, PAL.ash);
    p.fill(10, 18, 7, 2, PAL.ash);
    p.circle(22, 23, 4, PAL.blood);
    p.circle(22, 22, 2, shade(PAL.blood, 1.3));
    p.outline(PAL.stone);
  }),
  skull: () => centered((p) => {
    p.ellipse(16, 15, 9, 9, PAL.cloth);
    p.fill(10, 20, 12, 5, PAL.cloth);
    p.ellipse(12, 15, 3, 3, PAL.ink);
    p.ellipse(20, 15, 3, 3, PAL.ink);
    p.fill(15, 19, 2, 3, PAL.ink);
    for (let i = 0; i < 4; i++) p.fill(11 + i * 3, 22, 2, 3, PAL.bone);
    p.outline(PAL.stone);
  }),
  rune: () => centered((p) => {
    p.fill(7, 6, 18, 20, PAL.slate);
    p.fill(7, 6, 18, 2, PAL.stone);
    p.line(12, 10, 12, 22, PAL.arcaneLit);
    p.line(12, 14, 20, 10, PAL.arcaneLit);
    p.line(12, 18, 20, 22, PAL.arcaneLit);
    p.ellipse(16, 16, 12, 13, withAlpha(PAL.arcaneLit, 0.12));
    p.outline(PAL.ink);
  }),
  torch_item: () => centered((p) => {
    p.fill(14, 14, 4, 14, PAL.wood);
    p.fill(15, 14, 1, 14, PAL.woodLit);
    p.ellipse(16, 10, 5, 7, PAL.flame);
    p.ellipse(16, 11, 3, 4, PAL.flameLit);
    p.ellipse(16, 12, 11, 11, withAlpha(PAL.flame, 0.12));
    p.outline(PAL.ink);
  }),
  bomb: () => centered((p) => {
    p.circle(16, 19, 8, PAL.charcoal);
    p.circle(14, 17, 4, PAL.slate);
    p.fill(14, 9, 4, 3, PAL.iron);
    for (let i = 0; i < 6; i++) p.set(18 + i, 8 - i * 0.8, PAL.sand);
    p.set(24, 4, PAL.flameLit);
    p.outline(PAL.ink);
  }),
};

const cache = new Map<string, Canvas>();

/** Item icon at 32x32. Weapons reuse the in-hand art, rotated to a display angle. */
export function getIcon(kind: IconKind, opts: IconOpts = {}): Canvas {
  const key = `${kind}|${opts.metal ?? ''}|${opts.accent ?? ''}|${opts.glow ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let px: Px;
  const gen = GEN[kind];
  if (gen) {
    px = gen(new RNG(`icon:${key}`), opts);
  } else {
    const w = drawWeapon({ kind: kind as WeaponKind, metal: opts.metal ?? PAL.iron, grip: PAL.woodDark, glow: opts.glow ?? undefined });
    px = new Px(ICON, ICON);
    px.g.save();
    px.g.translate(ICON / 2, ICON / 2);
    px.g.rotate(-Math.PI / 4);
    px.g.translate(-w.w / 2, -w.h / 2);
    px.g.drawImage(w.canvas, 0, 0);
    px.g.restore();
    px.outline(PAL.ink);
  }
  if (opts.glow) {
    const g = px.clone();
    g.tint(opts.glow, 0.7);
    px.g.save();
    px.g.globalCompositeOperation = 'destination-over';
    px.g.globalAlpha = 0.5;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) px.g.drawImage(g.canvas, dx, dy);
    px.g.restore();
  }
  cache.set(key, px.canvas);
  return px.canvas;
}

/** Icons are drawn into React DOM via data URLs. */
const urlCache = new Map<string, string>();
export function getIconUrl(kind: IconKind, opts: IconOpts = {}): string {
  const key = `${kind}|${opts.metal ?? ''}|${opts.accent ?? ''}|${opts.glow ?? ''}`;
  let u = urlCache.get(key);
  if (!u) {
    u = getIcon(kind, opts).toDataURL();
    urlCache.set(key, u);
  }
  return u;
}
