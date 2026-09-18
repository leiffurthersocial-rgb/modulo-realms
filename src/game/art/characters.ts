import { PAL, mix, shade, withAlpha } from './palette';
import { Px, sheetGrid, type Canvas } from './pixel';
import { drawWeapon, type WeaponKind, type WeaponStyle } from './weaponart';

export const CH_W = 36;
export const CH_H = 44;
/** Feet line inside a frame. */
export const CH_FEET = 40;

export type AnimName = 'idle' | 'walk' | 'attack' | 'hurt' | 'cast';

/** Column ranges within the generated sheet. */
export const ANIM: Record<AnimName, { from: number; frames: number; fps: number; loop: boolean }> = {
  idle: { from: 0, frames: 2, fps: 2.6, loop: true },
  walk: { from: 2, frames: 6, fps: 10, loop: true },
  attack: { from: 8, frames: 4, fps: 14, loop: false },
  hurt: { from: 12, frames: 1, fps: 6, loop: false },
  cast: { from: 13, frames: 3, fps: 9, loop: false },
};
export const SHEET_COLS = 16;
/** Row index per facing. 'left' reuses 'right' mirrored at draw time. */
export const ROW: Record<string, number> = { down: 0, up: 1, right: 2, left: 2 };

export interface Look {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'ponytail' | 'braid' | 'mohawk' | 'bald' | 'wild';
  beard?: 'none' | 'stubble' | 'full' | 'long';
  shirt: string;
  pants: string;
  boots: string;
  belt?: string;
  cape?: string | null;
  armor?: 'none' | 'light' | 'heavy' | 'robe';
  armorColor?: string;
  armorTrim?: string;
  helmet?: 'none' | 'cap' | 'hood' | 'horned' | 'full' | 'crown' | 'circlet' | 'wizard';
  ears?: 'human' | 'elf' | 'beast';
  tusks?: boolean;
  /** 0.8 = dwarf-ish, 1.12 = orc-ish. */
  height?: number;
  bulk?: number;
  weapon?: WeaponStyle | null;
  offhand?: 'none' | 'shield' | 'torch' | 'tome' | 'orb' | 'lantern';
  offhandColor?: string;
  glow?: string | null;
  eyes?: string;
}

export const DEFAULT_LOOK: Look = {
  skin: PAL.skin1,
  hair: '#4a3324',
  hairStyle: 'short',
  beard: 'none',
  shirt: '#5a6f86',
  pants: '#3b3346',
  boots: '#4a3324',
  belt: '#33231a',
  cape: null,
  armor: 'none',
  ears: 'human',
  height: 1,
  bulk: 1,
  weapon: null,
  offhand: 'none',
};

interface Pose {
  bob: number;
  legA: number;
  legB: number;
  armA: number;
  armB: number;
  /** -1..1 swing used for the attack arc. */
  swing: number;
  squash: number;
  weaponAngle: number | null;
  cast: number;
}

const SKIN_SHADE = 0.74;

function drawCape(p: Px, look: Look, cx: number, top: number, bodyH: number, dir: string, pose: Pose) {
  if (!look.cape) return;
  const sway = Math.round(pose.bob * 1.5 + pose.swing * 2);
  const w = dir === 'right' ? 7 : 13;
  const x = dir === 'right' ? cx - 6 : cx - 6;
  p.fill(x - (dir === 'right' ? 1 : 0), top + 1, w, bodyH + 7, shade(look.cape, 0.85));
  p.fill(x, top + 1, Math.max(2, w - 3), bodyH + 6 + sway, look.cape);
  p.fill(x, top + 1, 2, bodyH + 4, shade(look.cape, 1.2));
}

/**
 * Everything is lit from the upper left, the way Stardew and Terraria sprites
 * are, so highlights go on the left edge and occlusion on the right and under.
 */
const LIT = 1.22;
const DIM = 0.72;
const DEEP = 0.55;

/** `toe` is which way the foot points: -1 left, +1 right, 0 straight down. */
function drawLeg(p: Px, look: Look, x: number, y: number, w: number, legH: number, off: number, front: boolean, toe: number) {
  const pants = front ? look.pants : shade(look.pants, 0.78);
  const boots = front ? look.boots : shade(look.boots, 0.78);
  const h = legH - Math.abs(off);
  const top = y + off;
  const thighH = Math.max(1, h - 4);

  // thigh full width, shin a pixel narrower on the outside — that step is the knee
  p.fill(x, top, w, thighH, pants);
  p.fill(x, top, 1, thighH, shade(pants, LIT));
  p.fill(x + w - 1, top, 1, thighH, shade(pants, DIM));
  p.fill(x, top + thighH - 2, w - 1, 1, shade(pants, 0.84));

  // boot: a lighter cuff, the shaft, then a sole that overhangs the way the foot points
  p.fill(x, top + h - 4, w, 1, shade(boots, LIT));
  p.fill(x, top + h - 3, w, 3, boots);
  p.fill(x + w - 1, top + h - 3, 1, 3, shade(boots, DIM));
  p.fill(x + Math.min(0, toe), top + h - 1, w + Math.abs(toe), 1, shade(boots, DEEP));
}

function drawLegs(p: Px, look: Look, cx: number, hipY: number, pose: Pose, dir: string) {
  const legH = 9;
  const bulk = look.bulk ?? 1;
  // Hips are as wide as the waist and no wider. Facing the camera the legs
  // stand a single pixel apart; in profile they nearly overlap, because that
  // is what a body actually looks like from the side.
  const legW = Math.max(3, Math.round(4 * bulk));
  const side = dir === 'right';
  const span = side ? legW + 2 : legW * 2 + 1;
  const originX = cx - Math.floor(span / 2);
  const backX = originX;
  const frontX = side ? originX + 2 : originX + legW + 1;
  const a = Math.round(pose.legA);
  const b = Math.round(pose.legB);

  drawLeg(p, look, backX, hipY, legW, legH, b, false, side ? 1 : -1);
  drawLeg(p, look, frontX, hipY, legW, legH, a, true, side ? 1 : 1);
  if (look.armor === 'heavy') {
    const ac = look.armorColor ?? PAL.iron;
    for (const [lx, off] of [[backX, b], [frontX, a]] as Array<[number, number]>) {
      p.fill(lx, hipY + legH - 6 + off, legW, 2, ac);
      p.fill(lx, hipY + legH - 6 + off, legW, 1, shade(ac, LIT));
    }
  }
}

function drawTorso(p: Px, look: Look, cx: number, top: number, bodyH: number, bulk: number, dir: string) {
  const w = Math.round(9 * bulk);
  const x = cx - Math.floor(w / 2);
  const shirtDark = shade(look.shirt, 0.72);

  if (look.armor === 'robe') {
    // flowing robe widens toward the hem
    for (let i = 0; i < bodyH + 6; i++) {
      const ww = w + Math.round((i / (bodyH + 6)) * 6);
      p.fill(cx - Math.floor(ww / 2), top + i, ww, 1, i % 5 === 4 ? shirtDark : look.shirt);
    }
    p.fill(cx - 1, top + 2, 2, bodyH + 2, look.armorTrim ?? PAL.gold);
  } else {
    // shoulders sit a pixel wide of the waist, so the torso tapers
    p.fill(x, top, w, bodyH, look.shirt);
    p.fill(x - 1, top + 1, w + 2, 3, look.shirt);
    p.fill(x - 1, top + 1, w + 2, 1, shade(look.shirt, 1.18));
    p.fill(x, top, w, 1, shade(look.shirt, LIT));
    p.fill(x, top, 1, bodyH, shade(look.shirt, 1.1));
    p.fill(x + w - 2, top, 2, bodyH, shirtDark);
    // collar and two cloth folds so the chest is not a flat slab
    if (dir !== 'up') p.fill(cx - 2, top, 4, 2, shade(look.shirt, 0.82));
    p.fill(x + 1, top + Math.round(bodyH * 0.5), w - 3, 1, shade(look.shirt, 0.88));
    p.fill(x + 2, top + Math.round(bodyH * 0.72), w - 5, 1, shade(look.shirt, 0.88));
  }

  if (look.armor === 'light') {
    // A jerkin, not a slab: a leather body that leaves the shirt showing at
    // the shoulders, two shoulder straps, and a laced seam down the front.
    const ac = look.armorColor ?? PAL.wood;
    const trim = look.armorTrim ?? shade(ac, 0.6);
    const bodyTop = top + 2;
    const bodyBot = top + bodyH - 2;
    p.fill(x, bodyTop, w, bodyBot - bodyTop, ac);
    p.fill(x, bodyTop, w, 1, shade(ac, 1.3));
    p.fill(x, bodyTop, 1, bodyBot - bodyTop, shade(ac, 1.12));
    p.fill(x + w - 2, bodyTop, 2, bodyBot - bodyTop, shade(ac, 0.68));
    p.fill(x, bodyBot - 1, w, 1, shade(ac, 0.5));
    if (dir !== 'up') {
      // straps over each shoulder, meeting the chest
      p.fill(x + 1, top, 2, 4, shade(ac, 0.8));
      p.fill(x + w - 3, top, 2, 4, shade(ac, 0.66));
      p.fill(x + 1, top, 2, 1, shade(ac, 1.1));
      // lacing: crossed stitches down the centre seam
      p.fill(cx - 1, bodyTop + 1, 1, bodyBot - bodyTop - 3, shade(ac, 0.58));
      for (let i = 1; i < bodyBot - bodyTop - 2; i += 2) {
        p.set(cx - 2, bodyTop + i, trim);
        p.set(cx, bodyTop + i + 1, trim);
      }
      // studs along the hem
      for (let sx = x + 1; sx < x + w - 2; sx += 3) p.set(sx, bodyBot - 2, shade(ac, 1.45));
    }
  } else if (look.armor === 'heavy') {
    // Plate: a fluted breastplate, layered pauldrons and a ridged fauld.
    const ac = look.armorColor ?? PAL.iron;
    const trim = look.armorTrim ?? PAL.gold;
    p.fill(x - 1, top, w + 2, bodyH - 1, ac);
    p.fill(x - 1, top, w + 2, 2, shade(ac, 1.3));
    p.fill(x - 1, top + 2, 1, bodyH - 3, shade(ac, 1.15));
    p.fill(x + w, top, 1, bodyH - 1, shade(ac, 0.6));
    p.fill(x + w - 1, top, 1, bodyH - 1, shade(ac, 0.78));
    // pauldrons, two lames each
    for (const [px, lit] of [[x - 2, true], [x + w - 1, false]] as Array<[number, boolean]>) {
      p.fill(px, top, 3, 3, shade(ac, lit ? 1.25 : 1.05));
      p.fill(px, top, 3, 1, shade(ac, lit ? 1.5 : 1.2));
      p.fill(px, top + 3, 3, 2, shade(ac, lit ? 1.05 : 0.85));
      p.fill(px, top + 4, 3, 1, shade(ac, 0.6));
    }
    if (dir !== 'up') {
      // gorget, central flute, and a heraldic boss
      p.fill(cx - 2, top, 4, 1, shade(ac, 1.55));
      p.fill(cx, top + 1, 1, bodyH - 4, shade(ac, 1.22));
      p.fill(cx + 1, top + 1, 1, bodyH - 4, shade(ac, 0.8));
      p.fill(cx - 2, top + 3, 4, 4, trim);
      p.fill(cx - 2, top + 3, 4, 1, shade(trim, 1.35));
      p.set(cx - 1, top + 4, shade(trim, 1.5));
      // fauld ridges above the belt
      p.fill(x, top + bodyH - 4, w, 1, shade(ac, 0.62));
    }
  }

  if (look.belt && look.armor !== 'robe') {
    // belt with a lit top edge and a buckle that catches the light
    p.fill(x, top + bodyH - 2, w, 2, look.belt);
    p.fill(x, top + bodyH - 2, w, 1, shade(look.belt, 1.3));
    p.fill(x, top + bodyH, w, 1, shade(look.belt, 0.55));
    if (dir !== 'up') {
      p.fill(cx - 1, top + bodyH - 2, 2, 2, PAL.gold);
      p.set(cx - 1, top + bodyH - 2, PAL.goldLit);
    }
  }
}

function drawArm(p: Px, look: Look, x: number, y: number, len: number, front: boolean) {
  const sleeve = look.armor === 'heavy' ? (look.armorColor ?? PAL.iron) : look.armor === 'light' ? (look.armorColor ?? PAL.wood) : look.shirt;
  const c = front ? sleeve : shade(sleeve, 0.78);
  const skin = front ? look.skin : shade(look.skin, SKIN_SHADE);
  p.fill(x, y, 3, len, c);
  p.fill(x, y, 1, len, shade(c, front ? LIT : 1.1));
  p.fill(x + 2, y, 1, len, shade(c, DIM));
  // cuff, then a hand that narrows to a fist
  p.fill(x, y + len - 1, 3, 1, shade(c, DEEP));
  p.fill(x, y + len, 3, 3, skin);
  p.fill(x, y + len, 1, 3, shade(skin, 1.12));
  p.fill(x + 2, y + len + 1, 1, 2, shade(skin, SKIN_SHADE));
}

function drawHead(p: Px, look: Look, cx: number, y: number, dir: string, pose: Pose) {
  const skin = look.skin;
  const skinDark = shade(skin, SKIN_SHADE);
  const headW = 11;
  const hx = cx - Math.floor(headW / 2);

  // neck
  p.fill(cx - 2, y + 10, 4, 3, skinDark);

  // ears
  if (look.ears === 'elf') {
    p.poly([[hx - 1, y + 5], [hx - 4, y + 1], [hx + 1, y + 7]], skin);
    p.poly([[hx + headW + 1, y + 5], [hx + headW + 4, y + 1], [hx + headW - 1, y + 7]], skinDark);
  } else if (look.ears === 'beast') {
    p.poly([[hx + 1, y + 2], [hx - 1, y - 4], [hx + 5, y + 1]], look.hair);
    p.poly([[hx + headW - 1, y + 2], [hx + headW + 1, y - 4], [hx + headW - 5, y + 1]], shade(look.hair, 0.8));
  } else {
    p.fill(hx - 1, y + 5, 1, 3, skinDark);
    p.fill(hx + headW, y + 5, 1, 3, skinDark);
  }

  // skull — corners knocked off so it reads round rather than as a block
  p.fill(hx, y + 1, headW, 10, skin);
  p.fill(hx + 1, y, headW - 2, 1, skin);
  p.fill(hx, y + 1, 1, 1, skinDark);
  p.fill(hx + headW - 1, y + 1, 1, 1, skinDark);
  p.fill(hx + 1, y + 1, headW - 3, 1, shade(skin, 1.12));   // forehead catch-light
  p.fill(hx, y + 2, 1, 6, shade(skin, 1.06));               // lit cheek
  p.fill(hx + headW - 2, y + 1, 2, 10, skinDark);           // shadowed cheek
  p.fill(hx, y + 10, headW, 1, skinDark);                   // jaw underside
  p.fill(hx + 1, y + 11, headW - 2, 1, shade(skin, 0.62));  // chin contact shadow

  // face
  const eye = look.eyes ?? PAL.ink;
  const white = mix(PAL.white, skin, 0.18);
  const brow = shade(look.hair, 0.8);
  if (dir === 'down') {
    // sclera, iris, and a single specular pixel — the thing that makes a
    // pixel face read as alive instead of as two dots
    p.fill(hx + 2, y + 5, 3, 2, white);
    p.fill(hx + headW - 5, y + 5, 3, 2, white);
    p.fill(hx + 3, y + 5, 2, 2, eye);
    p.fill(hx + headW - 4, y + 5, 2, 2, eye);
    p.set(hx + 3, y + 5, mix(eye, PAL.white, 0.62));
    p.set(hx + headW - 4, y + 5, mix(eye, PAL.white, 0.62));
    p.fill(hx + 2, y + 4, 3, 1, brow);
    p.fill(hx + headW - 5, y + 4, 3, 1, brow);
    p.fill(hx + 5, y + 6, 1, 2, shade(skin, 0.78));         // nose
    p.fill(hx + 4, y + 9, 3, 1, shade(skin, 0.6));          // mouth
    p.set(hx + 1, y + 7, mix(skin, PAL.blood, 0.22));       // cheek blush
    p.set(hx + headW - 2, y + 7, mix(skinDark, PAL.blood, 0.22));
    if (look.tusks) {
      p.fill(hx + 3, y + 8, 1, 2, PAL.cloth);
      p.fill(hx + headW - 4, y + 8, 1, 2, PAL.cloth);
    }
  } else if (dir === 'right') {
    p.fill(hx + headW - 6, y + 5, 3, 2, white);
    p.fill(hx + headW - 5, y + 5, 2, 2, eye);
    p.set(hx + headW - 5, y + 5, mix(eye, PAL.white, 0.62));
    p.fill(hx + headW - 6, y + 4, 3, 1, brow);
    p.fill(hx + headW - 1, y + 6, 1, 2, skin);              // nose in profile
    p.fill(hx + headW - 4, y + 9, 2, 1, shade(skin, 0.6));
    if (look.tusks) p.fill(hx + headW - 3, y + 8, 1, 2, PAL.cloth);
  } else {
    p.fill(hx + 1, y + 2, headW - 2, 2, shade(skin, 0.88));  // back of the skull
  }

  // beard
  if (look.beard && look.beard !== 'none' && dir !== 'up') {
    const bc = look.hair;
    const len = look.beard === 'stubble' ? 1 : look.beard === 'full' ? 4 : 7;
    p.fill(hx + 1, y + 8, headW - 2, len, bc);
    p.fill(hx + 1, y + 8, headW - 2, 1, shade(bc, 1.2));
    if (look.beard === 'long') p.fill(hx + 3, y + 8 + len, headW - 6, 3, bc);
  }

  // hair
  const hair = look.hair;
  const hairLit = shade(hair, 1.25);
  const hairDark = shade(hair, 0.72);
  switch (look.hairStyle) {
    case 'bald':
      p.fill(hx + 1, y, headW - 2, 1, shade(skin, 1.08));
      break;
    case 'short':
      p.fill(hx, y, headW, 4, hair);
      p.fill(hx + 1, y - 1, headW - 2, 1, hair);
      p.fill(hx + 1, y, 4, 1, hairLit);
      p.fill(hx + 5, y + 1, 3, 1, shade(hair, 1.12));
      p.fill(hx + headW - 3, y, 3, 4, hairDark);
      p.fill(hx - 1, y + 2, 1, 4, hair);
      p.fill(hx + headW, y + 2, 1, 4, hairDark);
      p.fill(hx + 1, y + 3, headW - 2, 1, hairDark);       // hairline against the brow
      break;
    case 'long':
      p.fill(hx, y, headW, 4, hair);
      p.fill(hx + 1, y - 1, headW - 2, 1, hair);
      p.fill(hx - 2, y + 1, 2, 11, hair);
      p.fill(hx + headW, y + 1, 2, 11, hairDark);
      p.fill(hx + 1, y, 4, 1, hairLit);
      p.fill(hx - 2, y + 2, 1, 7, shade(hair, 1.14));      // sheen down the lit fall
      p.fill(hx - 2, y + 11, 3, 1, hairDark);
      p.fill(hx + headW, y + 11, 2, 1, shade(hair, 0.66));
      p.fill(hx + 1, y + 3, headW - 2, 1, hairDark);
      break;
    case 'ponytail':
      p.fill(hx, y, headW, 4, hair);
      p.fill(hx + 1, y - 1, headW - 2, 1, hair);
      p.fill(dir === 'right' ? hx - 3 : hx + headW, y + 2, 3, 9, hair);
      p.fill(dir === 'right' ? hx - 3 : hx + headW, y + 2, 1, 8, shade(hair, 1.14));
      p.fill(dir === 'right' ? hx - 3 : hx + headW, y + 10, 3, 1, hairDark);
      p.fill(hx + 1, y, 4, 1, hairLit);
      p.fill(hx + 1, y + 3, headW - 2, 1, hairDark);
      break;
    case 'braid':
      p.fill(hx, y, headW, 4, hair);
      p.fill(hx + 1, y, 4, 1, hairLit);
      p.fill(hx - 2, y + 2, 2, 6, hair);
      p.fill(hx + headW, y + 2, 2, 6, hairDark);
      // the plait: alternating light and dark bands
      for (let i = 0; i < 3; i++) {
        p.fill(hx - 2, y + 2 + i * 2, 2, 1, i % 2 ? shade(hair, 1.14) : hairDark);
        p.fill(hx + headW, y + 2 + i * 2, 2, 1, i % 2 ? hair : shade(hair, 0.66));
      }
      p.fill(hx - 2, y + 8, 2, 2, hairDark);
      p.fill(hx + headW, y + 8, 2, 2, shade(hair, 0.66));
      p.fill(hx + 1, y + 3, headW - 2, 1, hairDark);
      break;
    case 'mohawk':
      p.fill(cx - 2, y - 3, 4, 6, hair);
      p.fill(cx - 1, y - 4, 2, 2, hairLit);
      p.fill(hx, y + 1, headW, 2, shade(hair, 0.7));
      break;
    case 'wild':
      p.fill(hx - 1, y - 1, headW + 2, 5, hair);
      for (let i = 0; i < 6; i++) p.fill(hx - 2 + i * 2, y - 3 + (i % 2), 2, 3, hair);
      p.fill(hx - 2, y + 2, 2, 7, hair);
      p.fill(hx + headW, y + 2, 2, 7, shade(hair, 0.8));
      break;
  }

  // helmet on top of hair
  const h = look.helmet ?? 'none';
  const ac = look.armorColor ?? PAL.iron;
  const trim = look.armorTrim ?? PAL.gold;
  if (h === 'cap') {
    p.fill(hx - 1, y - 1, headW + 2, 4, ac);
    p.fill(hx - 1, y - 1, headW + 2, 1, shade(ac, 1.3));
    p.fill(hx - 1, y + 3, headW + 2, 1, shade(ac, 0.7));
  } else if (h === 'full') {
    p.fill(hx - 1, y - 2, headW + 2, 11, ac);
    p.fill(hx - 1, y - 2, headW + 2, 2, shade(ac, 1.35));
    p.fill(hx + headW, y - 1, 1, 10, shade(ac, 0.65));
    if (dir === 'down') {
      p.fill(hx + 1, y + 4, headW - 2, 3, PAL.ink);
      p.fill(hx + 2, y + 5, 2, 1, PAL.flame);
      p.fill(hx + headW - 4, y + 5, 2, 1, PAL.flame);
      p.fill(cx, y + 2, 1, 7, trim);
    } else if (dir === 'right') {
      p.fill(hx + headW - 5, y + 4, 5, 3, PAL.ink);
    }
  } else if (h === 'horned') {
    p.fill(hx - 1, y - 1, headW + 2, 6, ac);
    p.fill(hx - 1, y - 1, headW + 2, 1, shade(ac, 1.3));
    p.poly([[hx - 1, y + 1], [hx - 6, y - 5], [hx - 2, y - 1]], PAL.bone);
    p.poly([[hx + headW + 1, y + 1], [hx + headW + 6, y - 5], [hx + headW + 2, y - 1]], PAL.cloth);
    if (dir === 'down') p.fill(hx + 1, y + 3, headW - 2, 2, PAL.ink);
  } else if (h === 'hood') {
    const hc = look.armorColor ?? shade(look.shirt, 0.8);
    p.fill(hx - 2, y - 2, headW + 4, 7, hc);
    p.fill(hx - 2, y - 2, headW + 4, 2, shade(hc, 1.2));
    p.fill(hx - 3, y + 2, 2, 9, hc);
    p.fill(hx + headW + 1, y + 2, 2, 9, shade(hc, 0.75));
    if (dir !== 'up') p.fill(hx, y + 3, headW, 2, withAlpha(PAL.ink, 0.55));
  } else if (h === 'wizard') {
    const hc = look.armorColor ?? look.shirt;
    p.fill(hx - 3, y + 1, headW + 6, 3, hc);
    for (let i = 0; i < 12; i++) {
      const ww = Math.max(1, 9 - i * 0.8);
      p.fill(cx - ww / 2 + Math.sin(i * 0.4) * 2, y - i, ww, 1, i % 4 === 0 ? shade(hc, 1.25) : hc);
    }
    p.set(cx + 2, y - 11, PAL.frost);
  } else if (h === 'crown') {
    p.fill(hx, y - 2, headW, 3, PAL.gold);
    for (let i = 0; i < 4; i++) p.fill(hx + i * 3, y - 4, 2, 2, PAL.goldLit);
    p.set(cx, y - 1, PAL.blood);
  } else if (h === 'circlet') {
    p.fill(hx - 1, y + 1, headW + 2, 1, trim);
    p.set(cx, y, mix(trim, PAL.white, 0.5));
  }
}

function drawOffhand(p: Px, look: Look, x: number, y: number) {
  const c = look.offhandColor ?? PAL.iron;
  if (look.offhand === 'shield') {
    p.poly([[x, y], [x + 8, y], [x + 7, y + 8], [x + 4, y + 12], [x + 1, y + 8]], c);
    p.poly([[x, y], [x + 4, y], [x + 4, y + 12], [x + 1, y + 8]], shade(c, 1.3));
    p.circle(x + 4, y + 5, 1.5, PAL.gold);
    p.outline(shade(c, 0.5));
  } else if (look.offhand === 'torch') {
    p.fill(x + 2, y, 2, 9, PAL.wood);
    p.ellipse(x + 3, y - 2, 3, 4, PAL.flame);
    p.ellipse(x + 3, y - 3, 2, 2, PAL.flameLit);
    p.ellipse(x + 3, y - 1, 8, 8, withAlpha(PAL.flame, 0.1));
  } else if (look.offhand === 'tome') {
    p.fill(x, y + 2, 8, 7, PAL.blood);
    p.fill(x + 3, y + 2, 2, 7, PAL.gold);
  } else if (look.offhand === 'orb') {
    // A lens held in the palm, lit from inside rather than reflecting.
    p.ellipse(x + 4, y + 5, 7, 7, shade(c, 0.55));
    p.ellipse(x + 4, y + 5, 5, 5, c);
    p.ellipse(x + 3, y + 4, 2, 2, PAL.white);
    p.ellipse(x + 4, y + 5, 11, 11, withAlpha(c, 0.12));
  } else if (look.offhand === 'lantern') {
    // A cage with a flame in it, hanging from a ring.
    p.fill(x + 3, y - 2, 2, 2, PAL.ironDark);
    p.fill(x + 1, y, 6, 1, PAL.ironDark);
    p.box(x + 1, y + 1, 6, 8, PAL.ironDark);
    p.fill(x + 2, y + 2, 4, 6, withAlpha(PAL.goldLit, 0.85));
    p.ellipse(x + 4, y + 5, 2, 3, PAL.flameLit);
    p.fill(x + 1, y + 9, 6, 1, PAL.ironDark);
    p.ellipse(x + 4, y + 5, 12, 12, withAlpha(PAL.goldLit, 0.12));
  }
}

function buildFrame(look: Look, dir: 'down' | 'up' | 'right', pose: Pose): Px {
  const p = new Px(CH_W, CH_H);
  const cx = Math.round(CH_W / 2);
  const scale = look.height ?? 1;
  const bulk = look.bulk ?? 1;
  const bodyH = Math.round(11 * scale);
  const legTop = Math.round(CH_FEET - 9 * scale);
  const torsoTop = legTop - bodyH;
  const headTop = torsoTop - Math.round(11 * scale) + 1 + pose.bob;

  // soft ground shadow
  p.ellipse(cx, CH_FEET + 1, 8 * bulk, 3, 'rgba(10,8,16,0.3)');

  drawCape(p, look, cx, torsoTop + pose.bob, bodyH, dir, pose);

  // back arm (drawn before torso)
  const armTop = torsoTop + 1 + pose.bob;
  if (dir !== 'up') drawArm(p, look, cx - Math.round(5 * bulk), armTop + Math.round(pose.armB), 5, false);

  drawLegs(p, look, cx, legTop, pose, dir);
  drawTorso(p, look, cx, torsoTop + pose.bob, bodyH, bulk, dir);
  drawHead(p, look, cx, headTop, dir, pose);

  // front arm + weapon
  const fx = cx + Math.round(2 * bulk);
  const fy = armTop + Math.round(pose.armA);
  if (dir === 'up') {
    drawArm(p, look, cx - Math.round(5 * bulk), armTop + Math.round(pose.armB), 5, false);
    drawArm(p, look, fx, fy, 5, false);
  } else {
    drawArm(p, look, fx, fy, 5, true);
  }

  if (look.weapon && look.weapon.kind !== 'none') {
    const wp = drawWeapon(look.weapon);
    const handX = fx + 3;
    const handY = fy + 6;
    let angle = pose.weaponAngle;
    if (angle === null) angle = dir === 'up' ? -1.9 : -0.55;
    p.g.save();
    p.g.translate(handX, handY);
    if (dir === 'up') p.g.globalAlpha = 0.95;
    p.g.rotate(angle);
    p.g.drawImage(wp.canvas, -3, -Math.round(wp.h / 2));
    p.g.restore();
  }
  if (look.offhand && look.offhand !== 'none' && dir !== 'up') {
    drawOffhand(p, look, cx - Math.round(8 * bulk), armTop + Math.round(pose.armB) + 2);
  }

  if (pose.cast > 0) {
    const gx = dir === 'up' ? cx : cx + 8;
    const gy = dir === 'up' ? torsoTop - 6 : torsoTop + 2;
    const c = look.glow ?? PAL.arcaneLit;
    p.ellipse(gx, gy, 3 + pose.cast * 4, 3 + pose.cast * 4, withAlpha(c, 0.35));
    p.circle(gx, gy, 1 + pose.cast * 2, withAlpha(PAL.white, 0.9));
  }

  p.outline('rgba(12,9,18,0.85)');
  if (look.glow) {
    const g = new Px(CH_W, CH_H);
    g.blit(p, 0, 0);
    g.tint(look.glow, 0.5);
    p.g.save();
    p.g.globalCompositeOperation = 'destination-over';
    p.g.globalAlpha = 0.35;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p.g.drawImage(g.canvas, dx, dy);
    p.g.restore();
  }
  return p;
}

function poseFor(col: number, dir: 'down' | 'up' | 'right'): Pose {
  const base: Pose = { bob: 0, legA: 0, legB: 0, armA: 0, armB: 0, swing: 0, squash: 0, weaponAngle: null, cast: 0 };
  if (col < 2) {
    // idle breathing
    base.bob = col === 0 ? 0 : -1;
    base.armA = col;
    base.armB = col;
    return base;
  }
  if (col < 8) {
    const t = ((col - 2) / 6) * Math.PI * 2;
    base.legA = Math.round(Math.sin(t) * 2.6);
    base.legB = Math.round(-Math.sin(t) * 2.6);
    base.armA = Math.round(-Math.sin(t) * 2);
    base.armB = Math.round(Math.sin(t) * 2);
    base.bob = Math.abs(Math.sin(t)) > 0.75 ? -1 : 0;
    return base;
  }
  if (col < 12) {
    const k = col - 8;
    // wind-up, strike, follow-through, recover
    const swings = [-0.9, 0.35, 1, 0.5];
    const s = swings[k];
    base.swing = s;
    base.armA = Math.round(-s * 3);
    base.armB = Math.round(s * 1.2);
    base.bob = k === 1 ? -1 : 0;
    base.legA = k >= 1 ? 1 : 0;
    const wa = dir === 'up' ? -2.4 : -1.6;
    base.weaponAngle = wa + s * 2.1;
    return base;
  }
  if (col === 12) {
    base.bob = 1;
    base.armA = 2;
    base.armB = 2;
    base.legA = -1;
    base.weaponAngle = dir === 'up' ? -1.4 : 0.4;
    return base;
  }
  const k = col - 13;
  base.cast = [0.3, 0.8, 1][k] ?? 0;
  base.armA = -3;
  base.bob = k === 2 ? -1 : 0;
  base.weaponAngle = -2.2;
  return base;
}

export interface CharacterSheet {
  canvas: Canvas;
  fw: number;
  fh: number;
  feet: number;
}

const cache = new Map<string, CharacterSheet>();

export function lookKey(look: Look): string {
  return JSON.stringify(look);
}

export function getCharacterSheet(look: Look): CharacterSheet {
  const key = lookKey(look);
  const hit = cache.get(key);
  if (hit) return hit;
  const rows: Px[][] = (['down', 'up', 'right'] as const).map((dir) => {
    const cols: Px[] = [];
    for (let c = 0; c < SHEET_COLS; c++) cols.push(buildFrame(look, dir, poseFor(c, dir)));
    return cols;
  });
  const sheet: CharacterSheet = { canvas: sheetGrid(rows), fw: CH_W, fh: CH_H, feet: CH_FEET };
  if (cache.size > 120) cache.clear();
  cache.set(key, sheet);
  return sheet;
}

export function weaponStyle(kind: WeaponKind, metal: string, grip = PAL.woodDark, glow?: string): WeaponStyle {
  return { kind, metal, grip, glow };
}
