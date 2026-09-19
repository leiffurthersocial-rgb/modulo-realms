import { PAL, mix, shade, withAlpha } from './palette';
import { Px } from './pixel';

export type WeaponKind =
  | 'sword' | 'greatsword' | 'axe' | 'greataxe' | 'hammer' | 'mace' | 'dagger' | 'spear'
  | 'bow' | 'crossbow' | 'staff' | 'wand' | 'tome' | 'scythe' | 'claws' | 'shield'
  | 'flail' | 'halberd' | 'rapier' | 'warpick' | 'orb' | 'javelin' | 'chainblades' | 'none';

export interface WeaponStyle {
  kind: WeaponKind;
  /** Blade / head colour. */
  metal: string;
  /** Grip colour. */
  grip: string;
  /** Optional enchant glow. */
  glow?: string;
}

/**
 * Wraps a grip in leather binding — alternating bands with a lit top edge.
 * Used on every hafted and hilted weapon so handles stop reading as bare bars.
 */
function wrap(p: Px, x: number, y: number, len: number, h: number, grip: string, horizontal = true) {
  p.fill(x, y, horizontal ? len : h, horizontal ? h : len, grip);
  p.fill(x, y, horizontal ? len : h, 1, shade(grip, 1.32));
  for (let i = 1; i < len; i += 3) {
    if (horizontal) p.fill(x + i, y, 1, h, shade(grip, 0.66));
    else p.fill(x, y + i, h, 1, shade(grip, 0.66));
  }
}

/** A round pommel counterweight at the butt of a hilt. */
function pommel(p: Px, x: number, y: number, r: number, metal: string) {
  p.circle(x, y, r, metal);
  p.circle(x - r * 0.3, y - r * 0.3, Math.max(0.6, r * 0.45), shade(metal, 1.4));
}

/** Draws a weapon pointing right, with its grip at (0, h/2). Used in-hand and for icons. */
export function drawWeapon(w: WeaponStyle, scale = 1): Px {
  const metal = w.metal;
  const light = shade(metal, 1.35);
  const dark = shade(metal, 0.6);
  const edge = shade(metal, 1.6);
  const grip = w.grip;
  // Hilt furniture is aged brass, not bright gold. At sprite scale a gold
  // crossguard and pommel together out-shout the blade and read as one blob.
  const brass = shade(PAL.gold, 0.72);
  const brassLit = shade(PAL.gold, 0.95);
  let p: Px;

  switch (w.kind) {
    case 'javelin': {
      p = new Px(34, 12);
      wrap(p, 2, 5, 22, 2, grip);
      p.fill(2, 5, 22, 1, light);
      p.poly([[22, 3], [34, 6], [22, 9], [25, 6]], metal);
      p.poly([[23, 4], [32, 6], [25, 6]], edge);
      p.fill(8, 4, 1, 4, brass);
      p.fill(12, 4, 1, 4, brass);
      p.fill(3, 8, 5, 1, PAL.blood);
      break;
    }
    case 'chainblades': {
      p = new Px(35, 18);
      wrap(p, 0, 7, 7, 3, grip);
      for (let i = 0; i < 5; i++) {
        const x = 8 + i * 3;
        const y = 8 + (i % 2 ? 2 : 0);
        p.ellipse(x, y, 2.5, 1.5, dark);
        p.fill(x - 1, y - 1, 2, 1, light);
      }
      p.poly([[21, 8], [29, 2], [35, 3], [28, 9], [32, 15], [25, 13]], metal);
      p.poly([[24, 7], [30, 3], [33, 3], [27, 8]], edge);
      p.poly([[24, 11], [28, 12], [31, 15], [25, 13]], dark);
      break;
    }
    case 'sword': {
      p = new Px(26, 10);
      wrap(p, 1, 4, 5, 3, grip);
      pommel(p, 1, 5.5, 1.5, brass);
      // crossguard with flared quillons
      p.fill(5, 2, 2, 7, brass);
      p.fill(5, 2, 2, 1, brassLit);
      p.fill(4, 4, 1, 3, shade(brass, 0.7));
      // blade: lit upper bevel, a fuller down the spine, shaded lower bevel
      p.fill(7, 4, 15, 3, metal);
      p.fill(7, 4, 15, 1, edge);
      p.fill(7, 5, 14, 1, shade(metal, 0.86));
      p.fill(7, 6, 15, 1, dark);
      p.poly([[22, 3], [26, 5.5], [22, 8]], metal);
      p.poly([[22, 4], [25, 5.5], [22, 5]], edge);
      break;
    }
    case 'greatsword': {
      p = new Px(36, 14);
      wrap(p, 1, 6, 8, 3, grip);
      pommel(p, 1, 7.5, 2, brass);
      p.fill(8, 2, 3, 11, brass);
      p.fill(8, 2, 3, 1, brassLit);
      p.fill(7, 5, 1, 5, shade(brass, 0.7));
      p.fill(11, 4, 20, 6, metal);
      p.fill(11, 4, 20, 1, edge);
      p.fill(11, 5, 20, 1, light);
      p.fill(12, 6, 18, 2, shade(metal, 0.88));   // fuller
      p.fill(11, 9, 20, 1, dark);
      p.poly([[31, 3], [36, 7], [31, 11]], metal);
      p.poly([[31, 4], [35, 7], [31, 7]], light);
      break;
    }
    case 'dagger': {
      p = new Px(16, 8);
      wrap(p, 0, 3, 4, 3, grip);
      pommel(p, 0, 4.5, 1.5, PAL.copper);
      p.fill(4, 2, 2, 5, PAL.copper);
      p.fill(4, 2, 2, 1, shade(PAL.copper, 1.4));
      p.fill(6, 3, 7, 2, metal);
      p.fill(6, 3, 7, 1, edge);
      p.poly([[13, 2], [16, 4], [13, 6]], metal);
      p.poly([[13, 3], [15, 4], [13, 4]], edge);
      break;
    }
    case 'axe': {
      p = new Px(24, 16);
      wrap(p, 0, 7, 17, 3, grip);
      p.fill(0, 9, 17, 1, shade(grip, 0.6));
      // bearded head: bit, a lit cheek and a ground edge along the arc
      p.poly([[14, 8], [20, 1], [24, 5], [24, 11], [20, 15], [14, 9]], metal);
      p.poly([[16, 8], [20, 3], [22, 6], [17, 9]], light);
      p.poly([[22, 3], [24, 5], [24, 11], [22, 13]], edge);
      p.poly([[15, 8], [18, 5], [18, 11]], dark);
      p.fill(13, 5, 3, 7, PAL.ironDark);
      p.fill(13, 5, 3, 1, PAL.iron);
      break;
    }
    case 'greataxe': {
      p = new Px(30, 22);
      wrap(p, 0, 10, 21, 4, grip);
      p.fill(0, 13, 21, 1, shade(grip, 0.6));
      p.poly([[16, 11], [24, 0], [30, 6], [30, 16], [24, 22], [16, 13]], metal);
      p.poly([[18, 11], [24, 3], [27, 8], [20, 12]], light);
      p.poly([[27, 4], [30, 6], [30, 16], [27, 18]], edge);
      p.poly([[16, 11], [12, 6], [10, 10], [16, 13]], dark);
      p.poly([[13, 8], [15, 9], [15, 12]], shade(metal, 0.9));
      break;
    }
    case 'hammer': {
      p = new Px(26, 18);
      wrap(p, 0, 8, 17, 3, grip);
      p.fill(0, 10, 17, 1, shade(grip, 0.6));
      // banded head with a struck, worn face
      p.fill(15, 3, 10, 12, metal);
      p.fill(15, 3, 10, 2, light);
      p.fill(15, 5, 10, 1, edge);
      p.fill(15, 12, 10, 3, dark);
      p.fill(23, 3, 2, 12, shade(metal, 0.78));
      p.fill(17, 3, 1, 12, shade(metal, 1.15));
      p.fill(13, 5, 3, 8, PAL.ironDark);
      p.fill(13, 5, 3, 1, PAL.iron);
      break;
    }
    case 'mace': {
      p = new Px(24, 16);
      wrap(p, 0, 7, 14, 3, grip);
      p.circle(18, 8, 5, metal);
      p.circle(16.6, 6.6, 3, light);
      p.circle(16, 6, 1.4, edge);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const fx = 18 + Math.cos(a) * 5;
        const fy = 8 + Math.sin(a) * 5;
        p.fill(fx, fy, 2, 2, dark);
        p.set(fx, fy, shade(metal, 1.1));
      }
      p.fill(13, 6, 2, 5, PAL.ironDark);
      break;
    }
    case 'spear': {
      p = new Px(34, 10);
      wrap(p, 0, 4, 25, 2, grip);
      p.fill(21, 3, 4, 4, PAL.ironDark);   // socket ferrule
      p.fill(21, 3, 4, 1, PAL.iron);
      p.poly([[25, 1], [34, 5], [25, 9]], metal);
      p.poly([[26, 3], [31, 5], [26, 5]], light);
      p.poly([[25, 4], [33, 5], [25, 5]], edge);
      break;
    }
    case 'rapier': {
      // A duelling blade: swept bell guard, long thin blade, needle point.
      p = new Px(30, 12);
      wrap(p, 0, 5, 4, 3, grip);
      pommel(p, 0, 6.5, 1.6, brass);
      // swept guard — a bell of thin bars around the hand
      for (let i = 0; i < 7; i++) {
        const a = -1.1 + (i / 6) * 2.2;
        p.set(6 + Math.cos(a) * 3.4, 6.5 + Math.sin(a) * 4.4, brass);
        p.set(7 + Math.cos(a) * 2.2, 6.5 + Math.sin(a) * 3.4, brassLit);
      }
      p.fill(5, 4, 2, 6, brass);
      p.fill(5, 4, 2, 1, brassLit);
      // blade tapers to a needle
      p.fill(8, 6, 17, 2, metal);
      p.fill(8, 6, 17, 1, edge);
      p.fill(8, 7, 15, 1, shade(metal, 0.82));
      p.fill(24, 6, 4, 1, metal);
      p.fill(24, 6, 4, 1, edge);
      p.set(28, 6, edge);
      break;
    }
    case 'flail': {
      // Haft, a length of chain, and a spiked head hanging off the end.
      p = new Px(28, 20);
      wrap(p, 0, 9, 12, 3, grip);
      p.fill(0, 11, 12, 1, shade(grip, 0.6));
      p.fill(10, 7, 3, 6, PAL.ironDark);
      p.fill(10, 7, 3, 1, PAL.iron);
      // a proper length of chain, so this never reads as a mace
      for (let i = 0; i < 6; i++) {
        const lx = 12 + i * 1.7;
        const ly = 10 + i * 1.1;
        p.fill(lx, ly, 2, 2, i % 2 ? PAL.ironDark : PAL.iron);
        p.set(lx, ly, PAL.ironLit);
      }
      p.circle(24, 16, 3.6, metal);
      p.circle(22.9, 14.9, 2, light);
      p.set(22, 14, edge);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const sx = 24 + Math.cos(a) * 4;
        const sy = 16 + Math.sin(a) * 4;
        p.fill(sx, sy, 2, 2, dark);
        p.set(sx, sy, shade(metal, 1.15));
      }
      break;
    }
    case 'halberd': {
      // Long shaft, an axe bit one side, a beak the other, a spike on top.
      p = new Px(38, 20);
      wrap(p, 0, 9, 26, 3, grip);
      p.fill(0, 11, 26, 1, shade(grip, 0.6));
      p.fill(23, 6, 3, 9, PAL.ironDark);
      p.fill(23, 6, 3, 1, PAL.iron);
      // axe bit above the shaft
      p.poly([[25, 10], [30, 1], [34, 4], [31, 10]], metal);
      p.poly([[26, 9], [30, 3], [32, 5], [28, 10]], light);
      p.poly([[32, 2.5], [34, 4], [31, 10], [30, 9]], edge);
      // rear beak
      p.poly([[25, 10], [21, 4], [19, 6], [24, 12]], shade(metal, 0.86));
      // top spike
      p.poly([[30, 1], [38, 8], [33, 8]], metal);
      p.poly([[31, 2], [37, 8], [34, 8]], edge);
      break;
    }
    case 'warpick': {
      // A short haft and a single wicked beak, balanced by a blunt poll.
      p = new Px(24, 18);
      wrap(p, 0, 9, 15, 3, grip);
      p.fill(0, 11, 15, 1, shade(grip, 0.6));
      p.fill(13, 5, 4, 9, PAL.ironDark);
      p.fill(13, 5, 4, 1, PAL.iron);
      p.poly([[16, 8], [23, 1], [24, 4], [18, 11]], metal);
      p.poly([[17, 8], [22, 3], [23, 4], [19, 9]], light);
      p.poly([[22, 1.6], [24, 4], [21, 7], [20.4, 5]], edge);
      p.fill(10, 6, 4, 6, metal);            // poll
      p.fill(10, 6, 4, 1, light);
      p.fill(10, 11, 4, 1, dark);
      break;
    }
    case 'orb': {
      // A floating focus caged in three metal bands, lit from within.
      p = new Px(20, 20);
      const gl = w.glow ?? metal;
      p.ellipse(10, 10, 9, 9, withAlpha(gl, 0.18));
      p.circle(10, 10, 6.5, shade(gl, 0.6));
      p.circle(10, 10, 5.4, gl);
      p.circle(8.6, 8.6, 2.8, shade(gl, 1.4));
      p.circle(8, 8, 1.3, PAL.white);
      for (const ry of [5, 10, 15]) {
        for (let x = 3; x < 17; x++) {
          const dy = Math.round(Math.sin((x - 3) / 14 * Math.PI) * (ry === 10 ? 0 : (ry < 10 ? -1 : 1)));
          const yy = ry + dy;
          if (Math.hypot(x - 10, yy - 10) > 7) continue;
          p.set(x, yy, x < 10 ? PAL.ironLit : PAL.ironDark);
        }
      }
      p.fill(9, 1, 2, 3, PAL.ironDark);
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
      // wrapped riser with a lit face, and nocks at both limbs
      wrap(p, 7, 11, 7, 4, w.grip, false);
      p.fill(8, 1, 2, 2, PAL.iron);
      p.fill(8, 25, 2, 2, PAL.iron);
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
      p.fill(0, 8, 26, 1, PAL.woodDark);
      wrap(p, 6, 6, 8, 3, w.grip);
      // iron claw cradling the focus stone
      const gl = w.glow ?? PAL.arcaneLit;
      p.fill(22, 4, 3, 7, PAL.ironDark);
      p.fill(22, 4, 3, 1, PAL.iron);
      p.circle(27, 7, 4, gl);
      p.circle(27, 7, 2.6, shade(gl, 1.35));
      p.circle(26, 6, 1.3, PAL.white);
      p.ellipse(27, 7, 8, 8, withAlpha(gl, 0.16));
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
      // rim, then a recessed face, then vertical planking and a boss
      p.poly([[1, 1], [15, 1], [14, 12], [8, 19], [2, 12]], dark);
      p.poly([[2, 2], [14, 2], [13, 11.5], [8, 18], [3, 11.5]], metal);
      p.poly([[2, 2], [8, 2], [8, 18], [3, 11.5]], light);
      p.poly([[3, 3], [13, 3], [12, 11], [8, 16], [4, 11]], shade(metal, 0.82));
      for (const bx of [5, 8, 11]) p.fill(bx, 3, 1, 12, shade(metal, 0.66));
      p.fill(2, 2, 12, 1, edge);
      p.circle(8, 8, 2.6, PAL.gold);
      p.circle(7.4, 7.4, 1.2, PAL.goldLit);
      for (const [rx, ry] of [[3, 3], [13, 3], [8, 16]] as Array<[number, number]>) p.set(rx, ry, PAL.goldLit);
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
  olympian: '#d7c893',
  primordial: '#83abc3',
};
