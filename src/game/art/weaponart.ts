import { PAL, mix, shade, withAlpha } from './palette';
import { Px } from './pixel';

export type WeaponKind =
  | 'sword' | 'greatsword' | 'axe' | 'greataxe' | 'hammer' | 'mace' | 'dagger' | 'spear'
  | 'bow' | 'crossbow' | 'staff' | 'wand' | 'tome' | 'scythe' | 'claws' | 'shield' | 'none';

export interface WeaponStyle {
  kind: WeaponKind;
  /** Blade / head colour. */
  metal: string;
  /** Grip colour. */
  grip: string;
  /** Optional enchant glow. */
  glow?: string;
}

/** Draws a weapon pointing right, with its grip at (0, h/2). Used in-hand and for icons. */
export function drawWeapon(w: WeaponStyle, scale = 1): Px {
  const metal = w.metal;
  const light = shade(metal, 1.35);
  const dark = shade(metal, 0.6);
  const grip = w.grip;
  let p: Px;

  switch (w.kind) {
    case 'sword': {
      p = new Px(26, 10);
      p.fill(0, 4, 6, 3, grip);
      p.fill(5, 2, 2, 7, PAL.gold);
      p.fill(7, 4, 15, 3, metal);
      p.fill(7, 4, 15, 1, light);
      p.fill(7, 6, 15, 1, dark);
      p.poly([[22, 3], [26, 5.5], [22, 8]], metal);
      p.set(1, 3, PAL.goldLit);
      break;
    }
    case 'greatsword': {
      p = new Px(36, 14);
      p.fill(0, 6, 9, 3, grip);
      p.fill(8, 2, 3, 11, PAL.gold);
      p.fill(11, 4, 20, 6, metal);
      p.fill(11, 4, 20, 2, light);
      p.fill(11, 8, 20, 2, dark);
      p.poly([[31, 3], [36, 7], [31, 11]], metal);
      break;
    }
    case 'dagger': {
      p = new Px(16, 8);
      p.fill(0, 3, 5, 3, grip);
      p.fill(4, 2, 2, 5, PAL.copper);
      p.fill(6, 3, 7, 2, metal);
      p.fill(6, 3, 7, 1, light);
      p.poly([[13, 2], [16, 4], [13, 6]], metal);
      break;
    }
    case 'axe': {
      p = new Px(24, 16);
      p.fill(0, 7, 18, 3, grip);
      p.fill(0, 7, 18, 1, shade(grip, 1.3));
      p.poly([[14, 8], [20, 1], [24, 5], [24, 11], [20, 15], [14, 9]], metal);
      p.poly([[16, 8], [20, 3], [22, 6], [17, 9]], light);
      p.fill(13, 5, 3, 7, PAL.ironDark);
      break;
    }
    case 'greataxe': {
      p = new Px(30, 22);
      p.fill(0, 10, 22, 4, grip);
      p.poly([[16, 11], [24, 0], [30, 6], [30, 16], [24, 22], [16, 13]], metal);
      p.poly([[18, 11], [24, 3], [27, 8], [20, 12]], light);
      p.poly([[16, 11], [12, 6], [10, 10], [16, 13]], dark);
      break;
    }
    case 'hammer': {
      p = new Px(26, 18);
      p.fill(0, 8, 18, 3, grip);
      p.fill(15, 3, 10, 12, metal);
      p.fill(15, 3, 10, 3, light);
      p.fill(15, 12, 10, 3, dark);
      p.fill(13, 5, 3, 8, PAL.ironDark);
      break;
    }
    case 'mace': {
      p = new Px(24, 16);
      p.fill(0, 7, 15, 3, grip);
      p.circle(18, 8, 5, metal);
      p.circle(17, 7, 3, light);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        p.fill(18 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, 2, 2, dark);
      }
      break;
    }
    case 'spear': {
      p = new Px(34, 10);
      p.fill(0, 4, 26, 2, grip);
      p.fill(0, 4, 26, 1, shade(grip, 1.3));
      p.poly([[25, 1], [34, 5], [25, 9]], metal);
      p.poly([[26, 3], [31, 5], [26, 5]], light);
      break;
    }
    case 'scythe': {
      p = new Px(30, 24);
      p.fill(2, 10, 24, 3, grip);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * 1.5;
        p.set(24 - Math.sin(a) * 18, 10 - Math.cos(a) * 0 - i * 0.6, metal);
        p.set(24 - Math.sin(a) * 18, 9 - i * 0.6, light);
      }
      p.poly([[24, 10], [6, 2], [8, 6], [22, 12]], metal);
      p.poly([[23, 9], [8, 3], [9, 5], [22, 10]], light);
      break;
    }
    case 'bow': {
      p = new Px(14, 28);
      for (let y = 2; y < 26; y++) {
        const t = (y - 14) / 12;
        p.set(9 - t * t * 7, y, PAL.wood);
        p.set(10 - t * t * 7, y, PAL.woodLit);
      }
      p.line(9, 2, 9, 26, PAL.cloth);
      p.fill(8, 12, 4, 5, PAL.woodDark);
      break;
    }
    case 'crossbow': {
      p = new Px(22, 18);
      p.fill(2, 8, 18, 3, PAL.wood);
      p.fill(8, 2, 3, 14, PAL.woodDark);
      for (let y = 2; y < 16; y++) p.set(11 + Math.abs(y - 9) * 0.3, y, PAL.iron);
      p.line(11, 3, 11, 15, PAL.cloth);
      break;
    }
    case 'staff': {
      p = new Px(32, 14);
      p.fill(0, 6, 26, 3, PAL.wood);
      p.fill(0, 6, 26, 1, PAL.woodLit);
      p.circle(27, 7, 4, w.glow ?? PAL.arcaneLit);
      p.circle(26, 6, 2, PAL.white);
      p.ellipse(27, 7, 7, 7, withAlpha(w.glow ?? PAL.arcaneLit, 0.15));
      break;
    }
    case 'wand': {
      p = new Px(18, 10);
      p.fill(0, 4, 12, 2, PAL.woodDark);
      p.circle(14, 5, 3, w.glow ?? PAL.frost);
      p.set(13, 4, PAL.white);
      break;
    }
    case 'tome': {
      p = new Px(18, 16);
      p.fill(1, 2, 16, 13, PAL.blood);
      p.fill(1, 2, 16, 2, shade(PAL.blood, 1.3));
      p.fill(8, 2, 2, 13, PAL.gold);
      p.fill(2, 4, 5, 9, PAL.cloth);
      p.fill(11, 4, 5, 9, PAL.cloth);
      p.circle(13, 8, 2, w.glow ?? PAL.arcaneLit);
      break;
    }
    case 'claws': {
      p = new Px(16, 14);
      p.fill(0, 5, 6, 4, grip);
      for (let i = 0; i < 3; i++) {
        p.poly([[6, 3 + i * 3], [15, 1 + i * 4], [7, 6 + i * 3]], metal);
      }
      break;
    }
    case 'shield': {
      p = new Px(16, 20);
      p.poly([[1, 1], [15, 1], [14, 12], [8, 19], [2, 12]], metal);
      p.poly([[1, 1], [8, 1], [8, 19], [2, 12]], light);
      p.poly([[3, 3], [13, 3], [12, 11], [8, 16], [4, 11]], dark);
      p.circle(8, 8, 2, PAL.gold);
      break;
    }
    default: {
      p = new Px(4, 4);
      break;
    }
  }

  if (w.glow && w.kind !== 'staff' && w.kind !== 'wand' && w.kind !== 'tome') {
    p.g.save();
    p.g.globalCompositeOperation = 'source-atop';
    p.g.fillStyle = withAlpha(w.glow, 0.28);
    p.g.fillRect(0, 0, p.w, p.h);
    p.g.restore();
  }

  if (scale !== 1) {
    const out = new Px(Math.round(p.w * scale), Math.round(p.h * scale));
    out.g.imageSmoothingEnabled = false;
    out.g.drawImage(p.canvas, 0, 0, out.w, out.h);
    return out;
  }
  return p;
}

export const METAL_BY_TIER: Record<string, string> = {
  common: PAL.iron,
  uncommon: PAL.steel,
  rare: mix(PAL.steel, PAL.frost, 0.4),
  epic: mix(PAL.steel, PAL.arcaneLit, 0.45),
  legendary: PAL.gold,
  mythic: mix(PAL.gold, PAL.ember, 0.45),
};
