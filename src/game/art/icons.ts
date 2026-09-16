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
  | 'gold' | 'key' | 'scroll' | 'map' | 'gem' | 'quest' | 'skull' | 'rune' | 'torch_item' | 'bomb'
  | 'lantern' | 'horn' | 'chalice' | 'hourglass' | 'mask' | 'weathervane' | 'drum';

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
        // skull, brow ridge, a visor slit with eye glints, comb and cheek plates
        p.ellipse(16, 15, 10, 9, metal);
        p.fill(6, 15, 20, 8, metal);
        p.ellipse(16, 12, 9, 6, light);
        p.ellipse(16, 11, 6, 3, shade(metal, 1.55));
        p.ellipse(16, 14, 8, 6, metal);
        p.fill(6, 15, 20, 1, dark);                 // brow ridge
        p.fill(6, 17, 20, 4, PAL.ink);              // visor slit
        p.fill(6, 16, 20, 1, shade(metal, 1.45));
        p.fill(8, 18, 5, 2, accent);
        p.fill(19, 18, 5, 2, accent);
        p.fill(15, 5, 2, 12, light);                // comb
        p.fill(15, 5, 1, 12, shade(metal, 1.6));
        p.fill(6, 21, 5, 4, metal);                 // cheek plates
        p.fill(21, 21, 5, 4, shade(metal, 0.84));
        p.fill(6, 22, 20, 3, dark);
        for (const rx of [8, 16, 24]) p.set(rx, 22, shade(metal, 1.5));
        break;
      case 'chest': {
        // A cuirass, not a box: pauldrons, a waisted torso, a neck opening, a
        // fluted breastplate and a skirt of tassets at the hem.
        p.poly([[9, 8], [23, 8], [25, 13], [23, 19], [24, 26], [8, 26], [9, 19], [7, 13]], metal);
        p.poly([[9, 8], [16, 8], [16, 26], [8, 26], [9, 19], [7, 13]], light);
        // pauldrons, layered in two lames each
        for (const [px, lit] of [[3, true], [22, false]] as Array<[number, boolean]>) {
          p.poly([[px, 9], [px + 7, 6], [px + 8, 11], [px + 1, 13]], lit ? light : metal);
          p.fill(px, 12, 8, 3, lit ? metal : shade(metal, 0.82));
          p.fill(px, 12, 8, 1, lit ? shade(light, 1.15) : light);
          p.fill(px, 14, 8, 1, dark);
        }
        // neck opening and collar
        p.poly([[12, 7], [20, 7], [19, 11], [13, 11]], PAL.ink);
        p.poly([[12, 7], [20, 7], [20, 8], [12, 8]], shade(metal, 1.5));
        // central flute and rivets
        p.fill(15, 12, 2, 10, accent);
        p.fill(15, 12, 1, 10, shade(accent, 1.4));
        for (const ry of [13, 17, 21]) {
          p.set(11, ry, shade(metal, 1.5));
          p.set(21, ry, dark);
        }
        // tassets
        p.fill(8, 22, 16, 1, dark);
        for (const tx of [9, 14, 19]) {
          p.fill(tx, 23, 4, 4, metal);
          p.fill(tx, 23, 4, 1, light);
          p.fill(tx, 26, 4, 1, dark);
        }
        break;
      }
      case 'gloves':
        for (const ox of [2, 15]) {
          const lit = ox === 2;
          // cuff, back-of-hand plate, then four articulated finger lames
          p.fill(ox, 19, 14, 5, lit ? metal : shade(metal, 0.86));
          p.fill(ox, 19, 14, 1, light);
          p.fill(ox, 23, 14, 1, dark);
          p.fill(ox + 1, 12, 12, 8, lit ? metal : shade(metal, 0.86));
          p.fill(ox + 1, 12, 12, 1, light);
          p.fill(ox + 12, 12, 1, 8, dark);
          for (let f = 0; f < 4; f++) {
            const fx = ox + 1 + f * 3;
            p.fill(fx, 7, 2, 6, metal);
            p.fill(fx, 7, 2, 1, light);
            p.fill(fx, 9, 2, 1, dark);
            p.fill(fx, 11, 2, 1, dark);
          }
          p.fill(ox + 1, 17, 12, 2, accent);
          p.set(ox + 2, 15, shade(metal, 1.5));
        }
        break;
      case 'boots':
        for (const ox of [2, 16]) {
          const lit = ox === 2;
          const body = lit ? metal : shade(metal, 0.86);
          // shaft with a turned-down cuff, an ankle plate, then a sole and heel
          p.fill(ox + 2, 5, 9, 3, shade(body, 1.2));
          p.fill(ox + 2, 5, 9, 1, shade(metal, 1.5));
          p.fill(ox + 2, 8, 9, 11, body);
          p.fill(ox + 2, 8, 1, 11, light);
          p.fill(ox + 10, 8, 1, 11, dark);
          p.fill(ox + 2, 13, 9, 2, accent);
          p.fill(ox + 2, 13, 9, 1, shade(accent, 1.35));
          // foot swells forward of the shaft
          p.fill(ox, 19, 13, 4, body);
          p.fill(ox, 19, 13, 1, shade(body, 1.18));
          p.fill(ox, 23, 13, 2, PAL.ink);
          p.fill(ox + 9, 23, 4, 3, PAL.ink);   // heel
          for (const ry of [10, 17]) p.set(ox + 3, ry, shade(metal, 1.5));
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
    // Two stacked bars seen at an angle: a lit top face, a shaded front face,
    // a chamfered edge between them and a cast stamp on top.
    const m = o.metal ?? PAL.iron;
    const top = shade(m, 1.38);
    const front = shade(m, 0.86);
    const side = shade(m, 0.6);
    // lower bar
    p.poly([[5, 24], [9, 18], [23, 18], [27, 24]], front);
    p.poly([[23, 18], [27, 24], [27, 26], [23, 20]], side);
    p.fill(5, 24, 22, 2, side);
    // upper bar, offset back
    p.poly([[8, 18], [12, 12], [24, 12], [28, 18]], front);
    p.poly([[12, 10], [24, 10], [28, 16], [8, 16]], top);
    p.poly([[12, 10], [18, 10], [16, 16], [8, 16]], shade(top, 1.12));
    p.fill(8, 16, 20, 1, shade(m, 1.1));   // chamfer catches the light
    p.poly([[24, 10], [28, 16], [28, 18], [24, 12]], side);
    // foundry stamp and a couple of casting pits
    p.fill(16, 12, 4, 1, shade(m, 0.72));
    p.fill(17, 13, 2, 1, shade(m, 0.72));
    for (let i = 0; i < 5; i++) p.set(rng.int(10, 26), rng.int(11, 23), rng.bool() ? shade(m, 1.5) : side);
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
  /**
   * Shields get their own icon rather than a rotated in-hand sprite: a shield
   * held at 45 degrees reads as a lump, and this is the slot the player looks
   * at most after their weapon.
   */
  shield: (rng, o) => centered((p) => {
    const m = o.metal ?? PAL.iron;
    const accent = o.accent ?? PAL.gold;
    const light = shade(m, 1.35);
    const dark = shade(m, 0.55);
    const rim = mix(m, PAL.ironDark, 0.4);
    const face: Array<[number, number]> = [[5, 3], [27, 3], [26, 18], [16, 29], [6, 18]];
    // rim, recessed face, then vertical planking
    p.poly([[3, 1], [29, 1], [28, 19], [16, 31], [4, 19]], rim);
    p.poly([[3, 1], [16, 1], [16, 31], [4, 19]], shade(rim, 1.25));
    p.poly(face, m);
    p.poly([[5, 3], [16, 3], [16, 29], [6, 18]], light);
    for (const bx of [10, 16, 22]) p.fill(bx, 4, 1, 22, shade(m, 0.72));
    p.fill(5, 3, 22, 1, shade(m, 1.6));
    p.fill(4, 17, 24, 1, dark);
    // boss, straps and rivets around the rim
    p.circle(16, 13, 5, accent);
    p.circle(16, 13, 3.2, shade(accent, 1.35));
    p.circle(14.8, 11.8, 1.4, PAL.white);
    p.fill(8, 12, 16, 2, withAlpha(PAL.ink, 0.35));
    for (const [rx, ry] of [[6, 4], [26, 4], [6, 16], [26, 16], [16, 27]] as Array<[number, number]>) {
      p.set(rx, ry, shade(m, 1.7));
      p.set(rx, ry + 1, dark);
    }
    for (let i = 0; i < 5; i++) p.set(rng.int(7, 25), rng.int(5, 25), withAlpha(PAL.white, 0.18));
    p.outline(PAL.ink);
  }),

  crossbow: (rng, o) => centered((p) => {
    const m = o.metal ?? PAL.iron;
    // stock and tiller running down-right, prod across the top, string drawn
    p.poly([[4, 6], [10, 6], [24, 24], [20, 28], [4, 12]], PAL.wood);
    p.poly([[4, 6], [8, 6], [22, 26], [20, 28], [4, 12]], PAL.woodLit);
    p.fill(6, 8, 14, 1, PAL.woodDark);
    // prod
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      const x = 6 + t * 22;
      const y = 4 + Math.sin(t * Math.PI) * 4;
      p.fill(x, y, 2, 2, m);
      p.set(x, y, shade(m, 1.4));
    }
    p.line(6, 5, 28, 5, PAL.cloth);
    // lock, trigger and bolt
    p.fill(12, 10, 5, 4, PAL.ironDark);
    p.fill(12, 10, 5, 1, m);
    p.fill(15, 14, 2, 4, PAL.ironDark);
    p.fill(10, 6, 12, 1, PAL.bone);
    p.poly([[21, 4], [26, 6], [21, 8]], m);
    for (let i = 0; i < 4; i++) p.set(rng.int(6, 24), rng.int(8, 24), withAlpha(PAL.white, 0.2));
    p.outline(PAL.ink);
  }),

  /* --- artifacts and off-hands that earn their own silhouette --- */

  lantern: (rng, o) => centered((p) => {
    const m = o.metal ?? PAL.iron;
    const fire = o.glow ?? PAL.goldLit;
    // ring handle, capped top, four-pane glass body, vented base
    for (let i = 0; i < 10; i++) {
      const a = Math.PI + (i / 9) * Math.PI;
      p.set(16 + Math.cos(a) * 4, 5 + Math.sin(a) * 4, m);
    }
    p.poly([[9, 8], [23, 8], [21, 11], [11, 11]], m);
    p.fill(9, 8, 14, 1, shade(m, 1.5));
    p.fill(11, 11, 10, 12, withAlpha(fire, 0.34));
    p.fill(12, 14, 8, 8, withAlpha(fire, 0.6));
    p.ellipse(16, 19, 3, 4, fire);
    p.ellipse(15, 18, 1.6, 2, PAL.white);
    // corner posts and a cross brace
    for (const px of [10, 21]) p.fill(px, 11, 1, 12, shade(m, px === 10 ? 1.35 : 0.65));
    p.fill(11, 16, 10, 1, shade(m, 0.8));
    p.poly([[9, 23], [23, 23], [21, 26], [11, 26]], m);
    p.fill(9, 23, 14, 1, shade(m, 1.4));
    p.ellipse(16, 20, 13, 13, withAlpha(fire, 0.1));
    for (let i = 0; i < 4; i++) p.set(rng.int(11, 21), rng.int(12, 22), withAlpha(PAL.white, 0.4));
    p.outline(PAL.ink);
  }),

  horn: (rng, o) => centered((p) => {
    const body = o.metal ?? PAL.bone;
    const band = o.accent ?? PAL.copper;
    // A war horn read as a crescent: wide bell at the upper left, tapering
    // down and round to a tip, with two brass bands and a carrying cord.
    const path: Array<[number, number, number]> = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const a = -2.5 + t * 2.5;              // sweeps from upper-left round to the right
      path.push([16 + Math.cos(a) * 12, 17 + Math.sin(a) * 12, 6.5 - t * 5.4]);
    }
    for (const [cx, cy, r] of path) {
      p.circle(cx, cy, r, body);
      p.circle(cx - r * 0.35, cy - r * 0.35, Math.max(0.6, r * 0.42), shade(body, 1.22));
      p.circle(cx + r * 0.45, cy + r * 0.45, Math.max(0.5, r * 0.3), shade(body, 0.76));
    }
    // the bell, hollowed out so you can see down the throat
    const [bx, by] = path[0];
    p.ellipse(bx, by, 7, 6, shade(body, 1.28));
    p.ellipse(bx, by, 5, 4.2, shade(body, 0.5));
    p.ellipse(bx - 1, by - 1, 2.6, 2, shade(body, 0.34));
    // brass bands at two points along the taper
    for (const idx of [7, 18]) {
      const [cx, cy, r] = path[idx];
      p.circle(cx, cy, r + 0.6, band);
      p.circle(cx - r * 0.3, cy - r * 0.3, Math.max(0.7, r * 0.5), shade(band, 1.4));
    }
    // carrying cord between the bands
    p.line(path[7][0] - 2, path[7][1] + 5, path[18][0] - 6, path[18][1] + 4, PAL.sandDark);
    for (let i = 0; i < 5; i++) p.set(rng.int(9, 24), rng.int(8, 26), withAlpha(PAL.white, 0.22));
    p.outline(PAL.ink);
  }),

  chalice: (rng, o) => centered((p) => {
    const m = o.metal ?? PAL.gold;
    const wine = o.accent ?? PAL.blood;
    // bowl, stem, knop and foot
    p.poly([[7, 5], [25, 5], [23, 15], [16, 20], [9, 15]], m);
    p.poly([[7, 5], [16, 5], [16, 20], [9, 15]], shade(m, 1.3));
    p.poly([[9, 7], [23, 7], [21.4, 14], [16, 18], [10.6, 14]], wine);
    p.ellipse(16, 7.5, 7, 2, shade(wine, 1.35));
    p.ellipse(13, 7, 2.4, 1, PAL.white);
    p.fill(14, 20, 4, 5, m);
    p.fill(14, 20, 1, 5, shade(m, 1.35));
    p.circle(16, 22, 2.6, m);
    p.circle(15, 21, 1.2, shade(m, 1.45));
    p.poly([[10, 25], [22, 25], [24, 28], [8, 28]], m);
    p.fill(8, 25, 16, 1, shade(m, 1.4));
    p.fill(8, 28, 16, 1, shade(m, 0.6));
    for (let i = 0; i < 4; i++) p.set(rng.int(9, 23), rng.int(6, 16), withAlpha(PAL.white, 0.35));
    p.outline(PAL.ink);
  }),

  hourglass: (rng, o) => centered((p) => {
    const frame = o.metal ?? PAL.sandLit;
    const sand = o.accent ?? PAL.gold;
    // two end caps joined by three posts, with the glass between them
    for (const cy of [4, 25]) {
      p.fill(6, cy, 20, 3, frame);
      p.fill(6, cy, 20, 1, shade(frame, 1.35));
      p.fill(6, cy + 2, 20, 1, shade(frame, 0.62));
    }
    for (const px of [6, 25]) p.fill(px, 7, 1, 18, shade(frame, px === 6 ? 1.3 : 0.7));
    // glass: upper bulb draining, lower bulb filling
    p.poly([[9, 7], [23, 7], [17, 16], [15, 16]], withAlpha(PAL.frost, 0.28));
    p.poly([[15, 16], [17, 16], [23, 25], [9, 25]], withAlpha(PAL.frost, 0.28));
    p.poly([[11, 9], [21, 9], [16.6, 15], [15.4, 15]], sand);
    p.poly([[11, 25], [21, 25], [18, 20], [14, 20]], sand);
    p.fill(16, 15, 1, 6, shade(sand, 1.3));
    p.fill(10, 9, 1, 3, withAlpha(PAL.white, 0.5));
    // a crack across the upper bulb
    for (let i = 0; i < 5; i++) p.set(12 + i, 10 + (i % 2), withAlpha(PAL.white, 0.6));
    for (let i = 0; i < 3; i++) p.set(rng.int(11, 21), rng.int(21, 24), shade(sand, 1.4));
    p.outline(PAL.ink);
  }),

  mask: (rng, o) => centered((p) => {
    const body = o.metal ?? PAL.bone;
    const lens = o.accent ?? PAL.toxic;
    // plague mask: domed brow, glass lenses, a long beak, buckled straps
    p.ellipse(16, 12, 10, 9, body);
    p.ellipse(16, 10, 9, 6, shade(body, 1.18));
    p.fill(6, 11, 20, 1, shade(body, 0.7));
    p.circle(11, 12, 3.4, PAL.ink);
    p.circle(21, 12, 3.4, PAL.ink);
    p.circle(11, 12, 2.4, lens);
    p.circle(21, 12, 2.4, lens);
    p.set(10, 11, PAL.white);
    p.set(20, 11, PAL.white);
    p.poly([[12, 16], [20, 16], [18, 24], [16, 29], [14, 24]], body);
    p.poly([[12, 16], [16, 16], [16, 29], [14, 24]], shade(body, 1.2));
    p.fill(14, 21, 4, 1, shade(body, 0.6));
    p.set(15, 26, PAL.ink);
    p.set(17, 26, PAL.ink);
    for (const sx of [4, 26]) {
      p.fill(sx, 8, 2, 7, PAL.woodDark);
      p.set(sx, 11, o.accent ?? PAL.copper);
    }
    for (let i = 0; i < 5; i++) p.set(rng.int(8, 24), rng.int(6, 16), withAlpha(PAL.white, 0.2));
    p.outline(PAL.ink);
  }),

  weathervane: (rng, o) => centered((p) => {
    const m = o.metal ?? PAL.iron;
    const spark = o.glow ?? '#8fd0f0';
    // a spindle with compass arms and a cut-iron arrow that catches the storm
    p.fill(15, 6, 2, 22, m);
    p.fill(15, 6, 1, 22, shade(m, 1.35));
    p.fill(4, 20, 24, 1, shade(m, 0.8));
    p.fill(4, 20, 24, 1, m);
    p.fill(15, 9, 2, 1, shade(m, 1.5));
    for (const [ax, ay] of [[4, 20], [27, 20]] as Array<[number, number]>) {
      p.fill(ax, ay - 2, 2, 5, m);
      p.set(ax, ay - 2, shade(m, 1.4));
    }
    // arrow head and flight
    p.poly([[17, 4], [28, 10], [17, 12]], m);
    p.poly([[17, 5], [26, 10], [17, 10]], shade(m, 1.3));
    p.poly([[15, 4], [6, 8], [15, 12]], shade(m, 0.82));
    // storm arcing off the tip
    for (let i = 0; i < 7; i++) p.set(26 - i, 3 + ((i * 5) % 4), withAlpha(spark, 0.85));
    p.ellipse(27, 8, 7, 7, withAlpha(spark, 0.14));
    p.poly([[11, 26], [21, 26], [24, 29], [8, 29]], m);
    for (let i = 0; i < 4; i++) p.set(rng.int(8, 24), rng.int(6, 26), withAlpha(PAL.white, 0.25));
    p.outline(PAL.ink);
  }),

  drum: (rng, o) => centered((p) => {
    const shell = o.metal ?? PAL.wood;
    const rim = o.accent ?? PAL.ember;
    // a war drum seen slightly from above: skin head, staved shell, rope lacing
    p.fill(5, 10, 22, 14, shell);
    for (let i = 0; i < 6; i++) p.fill(6 + i * 4, 10, 1, 14, shade(shell, 0.78));
    p.fill(5, 10, 1, 14, shade(shell, 1.25));
    p.fill(26, 10, 1, 14, shade(shell, 0.62));
    p.ellipse(16, 10, 11, 4.5, shade(PAL.bone, 1.05));
    p.ellipse(16, 10, 9, 3.2, PAL.cloth);
    p.ellipse(13, 9, 3, 1.2, withAlpha(PAL.white, 0.5));
    p.ellipse(16, 24, 11, 4, shade(shell, 0.62));
    // rope lacing zig-zagging between the hoops
    for (let i = 0; i < 6; i++) {
      const x0 = 6 + i * 4;
      p.line(x0, 12, x0 + 3, 22, PAL.sandDark);
      p.line(x0 + 3, 12, x0, 22, PAL.sandDark);
    }
    p.fill(5, 12, 22, 2, rim);
    p.fill(5, 12, 22, 1, shade(rim, 1.35));
    p.fill(5, 21, 22, 2, rim);
    // beaters resting across it
    p.fill(2, 6, 12, 2, PAL.woodDark);
    p.circle(14, 7, 2.4, PAL.bone);
    for (let i = 0; i < 4; i++) p.set(rng.int(7, 25), rng.int(14, 21), withAlpha(PAL.white, 0.2));
    p.outline(PAL.ink);
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
