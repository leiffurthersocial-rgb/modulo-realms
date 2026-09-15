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
  offhand?: 'none' | 'shield' | 'torch' | 'tome';
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

function drawLegs(p: Px, look: Look, cx: number, hipY: number, pose: Pose, dir: string) {
  const legH = 9;
  const legW = 3;
  const gap = dir === 'right' ? 1 : 3;
  const a = Math.round(pose.legA);
  const b = Math.round(pose.legB);
  const pantsDark = shade(look.pants, 0.75);

  // back leg
  p.fill(cx - gap - legW + (dir === 'right' ? 1 : 0), hipY + b, legW, legH - Math.abs(b), pantsDark);
  p.fill(cx - gap - legW + (dir === 'right' ? 1 : 0), hipY + legH - 3 + b, legW, 3, shade(look.boots, 0.8));
  // front leg
  p.fill(cx + gap - (dir === 'right' ? 1 : 0), hipY + a, legW, legH - Math.abs(a), look.pants);
  p.fill(cx + gap - (dir === 'right' ? 1 : 0), hipY + legH - 3 + a, legW, 3, look.boots);
  if (look.armor === 'heavy') {
    p.fill(cx - gap - legW, hipY + legH - 5 + b, legW, 2, look.armorColor ?? PAL.iron);
    p.fill(cx + gap, hipY + legH - 5 + a, legW, 2, look.armorColor ?? PAL.iron);
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
    p.fill(x, top, w, bodyH, look.shirt);
    p.fill(x, top, w, 2, shade(look.shirt, 1.15));
    p.fill(x + w - 2, top, 2, bodyH, shirtDark);
  }

  if (look.armor === 'light') {
    const ac = look.armorColor ?? PAL.wood;
    p.fill(x, top + 1, w, bodyH - 3, ac);
    p.fill(x, top + 1, w, 1, shade(ac, 1.25));
    p.fill(x + w - 2, top + 1, 2, bodyH - 3, shade(ac, 0.7));
    p.fill(x, top + 4, w, 1, shade(ac, 0.75));
    p.fill(x, top + 7, w, 1, shade(ac, 0.75));
  } else if (look.armor === 'heavy') {
    const ac = look.armorColor ?? PAL.iron;
    p.fill(x - 1, top, w + 2, bodyH - 1, ac);
    p.fill(x - 1, top, w + 2, 2, shade(ac, 1.3));
    p.fill(x + w, top, 1, bodyH - 1, shade(ac, 0.65));
    // pauldrons
    p.fill(x - 2, top, 3, 4, shade(ac, 1.15));
    p.fill(x + w - 1, top, 3, 4, shade(ac, 1.15));
    if (dir !== 'up') {
      p.fill(cx - 2, top + 3, 4, 4, look.armorTrim ?? PAL.gold);
      p.set(cx, top + 4, shade(look.armorTrim ?? PAL.gold, 1.3));
    }
  }

  if (look.belt && look.armor !== 'robe') {
    p.fill(x, top + bodyH - 2, w, 2, look.belt);
    if (dir !== 'up') p.fill(cx - 1, top + bodyH - 2, 2, 2, PAL.gold);
  }
}

function drawArm(p: Px, look: Look, x: number, y: number, len: number, front: boolean) {
  const sleeve = look.armor === 'heavy' ? (look.armorColor ?? PAL.iron) : look.armor === 'light' ? (look.armorColor ?? PAL.wood) : look.shirt;
  const c = front ? sleeve : shade(sleeve, 0.78);
  p.fill(x, y, 3, len, c);
  p.fill(x, y + len, 3, 3, front ? look.skin : shade(look.skin, SKIN_SHADE));
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

  // skull
  p.fill(hx, y + 1, headW, 10, skin);
  p.fill(hx + 1, y, headW - 2, 1, skin);
  p.fill(hx + headW - 2, y + 1, 2, 10, skinDark);
  p.fill(hx, y + 10, headW, 1, skinDark);

  // face
  const eye = look.eyes ?? PAL.ink;
  if (dir === 'down') {
    p.fill(hx + 2, y + 5, 2, 2, eye);
    p.fill(hx + headW - 4, y + 5, 2, 2, eye);
    p.set(hx + 2, y + 5, mix(eye, PAL.white, 0.5));
    p.set(hx + headW - 4, y + 5, mix(eye, PAL.white, 0.5));
    p.fill(hx + 4, y + 8, 3, 1, shade(skin, 0.6));
    if (look.tusks) {
      p.fill(hx + 3, y + 8, 1, 2, PAL.cloth);
      p.fill(hx + headW - 4, y + 8, 1, 2, PAL.cloth);
    }
  } else if (dir === 'right') {
    p.fill(hx + headW - 5, y + 5, 2, 2, eye);
    p.fill(hx + headW - 1, y + 6, 1, 2, skin);
    p.fill(hx + headW - 4, y + 8, 2, 1, shade(skin, 0.6));
    if (look.tusks) p.fill(hx + headW - 3, y + 8, 1, 2, PAL.cloth);
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
  switch (look.hairStyle) {
    case 'bald':
      p.fill(hx + 1, y, headW - 2, 1, shade(skin, 1.08));
      break;
    case 'short':
      p.fill(hx, y, headW, 4, hair);
      p.fill(hx + 1, y - 1, headW - 2, 1, hair);
      p.fill(hx + 1, y, 4, 1, hairLit);
      p.fill(hx - 1, y + 2, 1, 4, hair);
      p.fill(hx + headW, y + 2, 1, 4, hair);
      break;
    case 'long':
      p.fill(hx, y, headW, 4, hair);
      p.fill(hx + 1, y - 1, headW - 2, 1, hair);
      p.fill(hx - 2, y + 1, 2, 11, hair);
      p.fill(hx + headW, y + 1, 2, 11, shade(hair, 0.8));
      p.fill(hx + 1, y, 4, 1, hairLit);
      break;
    case 'ponytail':
      p.fill(hx, y, headW, 4, hair);
      p.fill(hx + 1, y - 1, headW - 2, 1, hair);
      p.fill(dir === 'right' ? hx - 3 : hx + headW, y + 2, 3, 9, hair);
      p.fill(hx + 1, y, 4, 1, hairLit);
      break;
    case 'braid':
      p.fill(hx, y, headW, 4, hair);
      p.fill(hx - 2, y + 2, 2, 6, hair);
      p.fill(hx + headW, y + 2, 2, 6, shade(hair, 0.8));
      p.fill(hx - 2, y + 8, 2, 2, shade(hair, 0.8));
      p.fill(hx + headW, y + 8, 2, 2, shade(hair, 0.7));
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
