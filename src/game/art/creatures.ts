import { PAL, mix, shade, withAlpha } from './palette';
import { Px, sheetGrid, type Canvas } from './pixel';
import { CH_W, CH_H, CH_FEET, SHEET_COLS, type CharacterSheet } from './characters';

export type CreatureKind =
  | 'wolf' | 'spider' | 'bat' | 'slime' | 'wisp' | 'golem' | 'treant'
  | 'scorpion' | 'wraith' | 'crawler' | 'boar' | 'serpent';

export interface CreatureStyle {
  kind: CreatureKind;
  primary: string;
  secondary: string;
  accent: string;
  eye: string;
  /** Integer upscale — 2 makes a boss-sized version of the same creature. */
  scale?: number;
  glow?: string | null;
}

interface CPose {
  /** 0..1 progress used for idle/walk cycles. */
  t: number;
  walk: boolean;
  /** -1..1 attack lunge. */
  lunge: number;
  hurt: boolean;
  bob: number;
}

const F = CH_FEET;

/* ------------------------------------------------------------------ */

function quadruped(
  p: Px,
  s: CreatureStyle,
  dir: string,
  pose: CPose,
  cfg: { bodyW: number; bodyH: number; legH: number; headR: number; maned: boolean; tusks?: boolean; tail: 'bushy' | 'thin' | 'none' },
) {
  const cx = CH_W / 2;
  const { primary, secondary, accent } = s;
  const swing = pose.walk ? Math.sin(pose.t * Math.PI * 2) * 2.2 : 0;
  const bodyY = F - cfg.legH - cfg.bodyH + pose.bob;

  p.ellipse(cx, F + 1, cfg.bodyW * 0.55, 3, 'rgba(10,8,16,0.3)');

  if (dir === 'right') {
    // legs
    for (const [ox, fwd] of [[-5, -1], [5, 1], [-3, 1], [7, -1]] as Array<[number, number]>) {
      p.fill(cx + ox, F - cfg.legH, 3, cfg.legH, shade(primary, fwd > 0 ? 1 : 0.75));
      p.fill(cx + ox + Math.round(swing * fwd), F - 3, 4, 3, secondary);
    }
    // body
    p.ellipse(cx, bodyY + cfg.bodyH / 2, cfg.bodyW / 2, cfg.bodyH / 2, primary);
    p.ellipse(cx - 1, bodyY + cfg.bodyH / 2 - 1, cfg.bodyW / 2 - 2, cfg.bodyH / 2 - 2, shade(primary, 1.12));
    if (cfg.maned) {
      p.ellipse(cx + cfg.bodyW * 0.28, bodyY + cfg.bodyH / 2, cfg.headR + 2, cfg.bodyH / 2 + 1, secondary);
    }
    // head
    const hx = cx + cfg.bodyW * 0.42 + pose.lunge * 3;
    const hy = bodyY + 1;
    p.ellipse(hx, hy, cfg.headR, cfg.headR * 0.85, primary);
    p.poly([[hx, hy - 1], [hx + cfg.headR + 4, hy + 1], [hx, hy + cfg.headR * 0.8]], primary);
    p.fill(hx + cfg.headR + 1, hy, 2, 2, PAL.ink);
    p.fill(hx + 1, hy - 2, 2, 2, s.eye);
    // ears
    p.poly([[hx - 2, hy - 3], [hx - 1, hy - 8], [hx + 3, hy - 3]], secondary);
    p.poly([[hx + 3, hy - 3], [hx + 5, hy - 8], [hx + 7, hy - 3]], secondary);
    if (pose.lunge > 0.4) {
      p.fill(hx + cfg.headR, hy + 2, 5, 3, PAL.ink);
      for (let i = 0; i < 3; i++) p.set(hx + cfg.headR + i * 2, hy + 2, PAL.white);
    }
    if (cfg.tusks) {
      p.fill(hx + cfg.headR, hy + 1, 2, 1, PAL.cloth);
      p.poly([[hx + cfg.headR - 1, hy + 2], [hx + cfg.headR + 2, hy - 3], [hx + cfg.headR + 1, hy + 2]], PAL.cloth);
    }
    // tail
    if (cfg.tail === 'bushy') {
      const tx = cx - cfg.bodyW * 0.5;
      p.ellipse(tx - 3, bodyY + 2 + swing * 0.6, 5, 3.5, secondary);
      p.ellipse(tx - 5, bodyY + 1 + swing * 0.8, 3, 2.5, accent);
    } else if (cfg.tail === 'thin') {
      for (let i = 0; i < 8; i++) p.set(cx - cfg.bodyW * 0.5 - i, bodyY + 3 + Math.sin(i * 0.5 + pose.t * 6) * 2, secondary);
    }
  } else {
    const front = dir === 'down';
    for (const ox of [-6, -2, 2, 6]) {
      p.fill(cx + ox, F - cfg.legH, 3, cfg.legH, shade(primary, ox < 0 ? 0.8 : 1));
    }
    p.ellipse(cx, bodyY + cfg.bodyH / 2, cfg.bodyW * 0.38, cfg.bodyH / 2, primary);
    if (cfg.maned) p.ellipse(cx, bodyY + 2, cfg.headR + 3, cfg.headR, secondary);
    const hy = bodyY - (front ? 1 : 0);
    p.ellipse(cx, hy, cfg.headR, cfg.headR * 0.9, primary);
    p.poly([[cx - cfg.headR, hy - 2], [cx - cfg.headR + 1, hy - 8], [cx - cfg.headR + 5, hy - 2]], secondary);
    p.poly([[cx + cfg.headR, hy - 2], [cx + cfg.headR - 1, hy - 8], [cx + cfg.headR - 5, hy - 2]], secondary);
    if (front) {
      p.fill(cx - 4, hy - 1, 2, 2, s.eye);
      p.fill(cx + 2, hy - 1, 2, 2, s.eye);
      p.fill(cx - 1, hy + 2, 3, 2, PAL.ink);
      if (pose.lunge > 0.4) {
        p.fill(cx - 3, hy + 3, 7, 3, PAL.ink);
        for (let i = 0; i < 4; i++) p.set(cx - 3 + i * 2, hy + 3, PAL.white);
      }
    }
  }
}

function drawCreature(s: CreatureStyle, dir: 'down' | 'up' | 'right', pose: CPose): Px {
  const p = new Px(CH_W, CH_H);
  const cx = CH_W / 2;
  const { primary, secondary, accent, eye } = s;

  switch (s.kind) {
    case 'wolf':
      quadruped(p, s, dir, pose, { bodyW: 22, bodyH: 11, legH: 8, headR: 5, maned: true, tail: 'bushy' });
      break;
    case 'boar':
      quadruped(p, s, dir, pose, { bodyW: 24, bodyH: 13, legH: 6, headR: 6, maned: true, tusks: true, tail: 'thin' });
      break;
    case 'crawler':
      quadruped(p, s, dir, pose, { bodyW: 20, bodyH: 9, legH: 10, headR: 4, maned: false, tail: 'thin' });
      break;
    case 'spider': {
      const bodyY = F - 12 + pose.bob;
      p.ellipse(cx, F + 1, 12, 4, 'rgba(10,8,16,0.3)');
      for (let i = 0; i < 4; i++) {
        for (const side of [-1, 1]) {
          const ph = pose.walk ? Math.sin(pose.t * Math.PI * 2 + i * 1.1 + (side > 0 ? 1.6 : 0)) * 2 : 0;
          const kx = cx + side * (5 + i * 1.5);
          const ky = bodyY + 2 + i;
          p.line(cx + side * 3, bodyY + 3, kx + side * 4, ky - 5 + ph, secondary);
          p.line(kx + side * 4, ky - 5 + ph, kx + side * 8, F - 1 + ph, secondary);
          p.set(kx + side * 8, F - 1 + ph, PAL.ink);
        }
      }
      p.ellipse(cx, bodyY + 4, 8, 7, primary);
      p.ellipse(cx - 1, bodyY + 3, 6, 5, shade(primary, 1.15));
      p.ellipse(cx, bodyY + 5, 4, 3, accent);
      p.ellipse(cx, bodyY - 4, 5, 4, shade(primary, 0.85));
      for (const [ex, ey] of [[-3, -5], [-1, -6], [1, -6], [3, -5], [-2, -3], [2, -3]] as Array<[number, number]>) {
        p.set(cx + ex, bodyY + ey, eye);
      }
      if (pose.lunge > 0.4) {
        p.poly([[cx - 4, bodyY - 2], [cx - 6, bodyY + 3], [cx - 2, bodyY - 1]], PAL.cloth);
        p.poly([[cx + 4, bodyY - 2], [cx + 6, bodyY + 3], [cx + 2, bodyY - 1]], PAL.cloth);
      }
      break;
    }
    case 'bat': {
      const y = F - 18 + Math.round(Math.sin(pose.t * Math.PI * 2) * 3) + pose.bob;
      p.ellipse(cx, F + 1, 6, 2.5, 'rgba(10,8,16,0.25)');
      const flap = Math.sin(pose.t * Math.PI * 2);
      for (const side of [-1, 1]) {
        const tip = 13 * (0.55 + 0.45 * Math.abs(flap));
        p.poly([
          [cx + side * 2, y],
          [cx + side * tip, y - 6 * flap - 2],
          [cx + side * tip * 0.8, y + 4],
          [cx + side * 3, y + 4],
        ], secondary);
        p.line(cx + side * 2, y, cx + side * tip, y - 6 * flap - 2, shade(secondary, 0.7));
      }
      p.ellipse(cx, y + 1, 4, 5, primary);
      p.ellipse(cx, y - 3, 3.5, 3, primary);
      p.poly([[cx - 3, y - 5], [cx - 4, y - 9], [cx - 1, y - 5]], primary);
      p.poly([[cx + 3, y - 5], [cx + 4, y - 9], [cx + 1, y - 5]], primary);
      p.set(cx - 2, y - 3, eye);
      p.set(cx + 1, y - 3, eye);
      if (pose.lunge > 0.4) { p.set(cx - 1, y - 1, PAL.white); p.set(cx + 1, y - 1, PAL.white); }
      break;
    }
    case 'slime': {
      const squash = pose.walk ? Math.sin(pose.t * Math.PI * 2) * 2 : Math.sin(pose.t * Math.PI * 2) * 0.8;
      const h = 11 - squash;
      const w = 12 + squash;
      const top = F - h;
      p.ellipse(cx, F + 1, w * 0.8, 3, 'rgba(10,8,16,0.3)');
      p.ellipse(cx, top + h / 2, w, h / 2 + 2, withAlpha(primary, 0.85));
      p.ellipse(cx, top + h / 2 + 2, w - 2, h / 2, withAlpha(secondary, 0.7));
      p.ellipse(cx - w * 0.35, top + h * 0.35, w * 0.22, h * 0.2, withAlpha(PAL.white, 0.6));
      p.fill(cx - 4, top + 4, 2, 3, eye);
      p.fill(cx + 3, top + 4, 2, 3, eye);
      if (pose.lunge > 0.4) p.fill(cx - 2, top + 9, 5, 2, PAL.ink);
      for (let i = 0; i < 3; i++) p.set(cx + Math.sin(pose.t * 6 + i) * 6, top + 3 + i * 3, accent);
      break;
    }
    case 'wisp': {
      const y = F - 20 + Math.round(Math.sin(pose.t * Math.PI * 2) * 3);
      const r = 6 + pose.lunge * 2;
      p.ellipse(cx, y, r + 7, r + 7, withAlpha(accent, 0.12));
      p.ellipse(cx, y, r + 3, r + 3, withAlpha(primary, 0.35));
      p.circle(cx, y, r, withAlpha(primary, 0.9));
      p.circle(cx - 1, y - 1, r * 0.6, secondary);
      p.circle(cx - 1, y - 1, r * 0.3, PAL.white);
      for (let i = 0; i < 6; i++) {
        const a = pose.t * Math.PI * 2 + (i / 6) * Math.PI * 2;
        p.set(cx + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4), accent);
      }
      p.fill(cx - 3, y - 1, 2, 2, eye);
      p.fill(cx + 2, y - 1, 2, 2, eye);
      break;
    }
    case 'golem': {
      const bob = pose.bob + (pose.walk ? Math.round(Math.sin(pose.t * Math.PI * 2) * 1) : 0);
      const top = F - 30 + bob;
      p.ellipse(cx, F + 1, 13, 4, 'rgba(10,8,16,0.35)');
      // legs
      p.fill(cx - 8, F - 10, 6, 10, shade(primary, 0.8));
      p.fill(cx + 2, F - 10, 6, 10, primary);
      p.fill(cx - 9, F - 3, 8, 3, secondary);
      p.fill(cx + 1, F - 3, 8, 3, secondary);
      // torso
      p.fill(cx - 10, top + 8, 20, 14, primary);
      p.fill(cx - 10, top + 8, 20, 3, shade(primary, 1.2));
      p.fill(cx + 7, top + 8, 3, 14, shade(primary, 0.7));
      for (let i = 0; i < 4; i++) p.fill(cx - 9 + i * 5, top + 12, 4, 4, shade(primary, 1.08));
      // core
      p.ellipse(cx, top + 16, 4, 4, withAlpha(accent, 0.9));
      p.ellipse(cx, top + 16, 7, 7, withAlpha(accent, 0.18));
      // arms
      const sw = pose.lunge * 6;
      p.fill(cx - 15, top + 9 + sw, 5, 14, shade(primary, 0.85));
      p.fill(cx + 10, top + 9 - sw, 5, 14, primary);
      p.fill(cx - 16, top + 21 + sw, 7, 6, secondary);
      p.fill(cx + 9, top + 21 - sw, 7, 6, secondary);
      // head
      p.fill(cx - 6, top, 12, 9, primary);
      p.fill(cx - 6, top, 12, 2, shade(primary, 1.25));
      p.fill(cx - 4, top + 3, 3, 2, eye);
      p.fill(cx + 1, top + 3, 3, 2, eye);
      p.fill(cx - 7, top + 1, 1, 6, secondary);
      p.fill(cx + 6, top + 1, 1, 6, secondary);
      break;
    }
    case 'treant': {
      const sway = Math.round(Math.sin(pose.t * Math.PI * 2) * 1.5);
      const top = F - 34 + pose.bob;
      p.ellipse(cx, F + 1, 14, 4, 'rgba(10,8,16,0.35)');
      p.fill(cx - 9, F - 12, 7, 12, shade(primary, 0.8));
      p.fill(cx + 2, F - 12, 7, 12, primary);
      p.fill(cx - 11, F - 2, 10, 2, secondary);
      p.fill(cx + 1, F - 2, 10, 2, secondary);
      p.fill(cx - 8, top + 8, 16, 18, primary);
      for (let i = 0; i < 5; i++) p.fill(cx - 7 + i * 3, top + 9, 1, 16, shade(primary, 0.75));
      p.fill(cx - 8, top + 8, 4, 18, shade(primary, 1.15));
      // face in the bark
      p.fill(cx - 5, top + 12, 3, 3, eye);
      p.fill(cx + 2, top + 12, 3, 3, eye);
      p.fill(cx - 3, top + 18, 6, 2, PAL.ink);
      // arms / branches
      const sw = pose.lunge * 5;
      p.line(cx - 8, top + 12, cx - 16 - sw, top + 4 - sw, primary);
      p.line(cx - 9, top + 13, cx - 16 - sw, top + 6 - sw, primary);
      p.line(cx + 8, top + 12, cx + 16 + sw, top + 4 + sw, primary);
      p.line(cx + 9, top + 13, cx + 16 + sw, top + 6 + sw, primary);
      // canopy
      p.ellipse(cx + sway, top + 2, 15, 9, shade(accent, 0.7));
      p.ellipse(cx - 6 + sway, top, 8, 6, accent);
      p.ellipse(cx + 6 + sway, top + 2, 7, 5, accent);
      p.ellipse(cx + sway, top - 3, 7, 5, shade(accent, 1.2));
      p.ellipse(cx - 15 - sw, top + 3 - sw, 5, 4, accent);
      p.ellipse(cx + 15 + sw, top + 3 + sw, 5, 4, accent);
      break;
    }
    case 'scorpion': {
      const bodyY = F - 10 + pose.bob;
      p.ellipse(cx, F + 1, 13, 4, 'rgba(10,8,16,0.3)');
      for (let i = 0; i < 3; i++) {
        for (const side of [-1, 1]) {
          const ph = pose.walk ? Math.sin(pose.t * Math.PI * 2 + i) * 2 : 0;
          p.line(cx + side * 3, bodyY + 2 + i * 2, cx + side * (9 + i), F - 1 + ph, secondary);
        }
      }
      p.ellipse(cx, bodyY + 3, 9, 6, primary);
      p.ellipse(cx - 1, bodyY + 2, 7, 4, shade(primary, 1.15));
      // claws
      const cl = pose.lunge * 3;
      for (const side of [-1, 1]) {
        p.ellipse(cx + side * (10 + cl), bodyY - 2, 4, 3, primary);
        p.poly([[cx + side * (12 + cl), bodyY - 4], [cx + side * (16 + cl), bodyY - 6], [cx + side * (13 + cl), bodyY - 1]], secondary);
      }
      // tail arcing over the back
      for (let i = 0; i < 7; i++) {
        const a = -0.4 - i * 0.28;
        p.ellipse(cx - 6 - i * 0.4 + Math.cos(a) * i * 1.6, bodyY - 1 + Math.sin(a) * i * 1.6, 2.4 - i * 0.12, 2.4 - i * 0.12, primary);
      }
      p.poly([[cx - 2, bodyY - 14], [cx + 3, bodyY - 18], [cx + 1, bodyY - 12]], accent);
      p.set(cx - 3, bodyY + 1, eye);
      p.set(cx + 2, bodyY + 1, eye);
      break;
    }
    case 'serpent': {
      const bodyY = F - 8 + pose.bob;
      p.ellipse(cx, F + 1, 12, 3, 'rgba(10,8,16,0.3)');
      for (let i = 0; i < 12; i++) {
        const x = cx - 12 + i * 2.2;
        const y = bodyY + Math.sin(pose.t * Math.PI * 2 + i * 0.6) * 3;
        p.ellipse(x, y, 3.2 - i * 0.1, 2.6 - i * 0.08, i % 2 ? primary : shade(primary, 1.12));
      }
      const hx = cx + 13 + pose.lunge * 3;
      const hy = bodyY + Math.sin(pose.t * Math.PI * 2 + 7) * 3 - 4;
      p.ellipse(hx, hy, 5, 3.5, primary);
      p.poly([[hx + 3, hy - 2], [hx + 8, hy], [hx + 3, hy + 2]], secondary);
      p.set(hx + 1, hy - 1, eye);
      if (pose.lunge > 0.4) { p.line(hx + 6, hy + 1, hx + 10, hy + 3, accent); }
      break;
    }
    case 'wraith': {
      const y = F - 26 + Math.round(Math.sin(pose.t * Math.PI * 2) * 2);
      p.ellipse(cx, F, 9, 3, 'rgba(10,8,16,0.2)');
      for (let i = 0; i < 16; i++) {
        const t = i / 16;
        const ww = 12 * (1 - t * 0.55) + Math.sin(pose.t * 6 + i) * 1.5;
        p.fill(cx - ww / 2, y + 6 + i, ww, 1, withAlpha(primary, 0.85 - t * 0.7));
      }
      p.ellipse(cx, y + 4, 8, 10, withAlpha(primary, 0.9));
      p.ellipse(cx, y + 2, 6, 6, secondary);
      p.fill(cx - 4, y + 1, 3, 2, eye);
      p.fill(cx + 2, y + 1, 3, 2, eye);
      p.ellipse(cx, y + 2, 11, 12, withAlpha(accent, 0.1));
      const sw = pose.lunge * 5;
      p.line(cx - 7, y + 6, cx - 12 - sw, y + 1 - sw, withAlpha(primary, 0.9));
      p.line(cx + 7, y + 6, cx + 12 + sw, y + 1 + sw, withAlpha(primary, 0.9));
      break;
    }
  }

  p.outline('rgba(12,9,18,0.8)');
  if (s.glow) {
    const g = p.clone();
    g.tint(s.glow, 0.6);
    p.g.save();
    p.g.globalCompositeOperation = 'destination-over';
    p.g.globalAlpha = 0.4;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p.g.drawImage(g.canvas, dx, dy);
    p.g.restore();
  }
  return p;
}

function poseFor(col: number): CPose {
  if (col < 2) return { t: col / 2, walk: false, lunge: 0, hurt: false, bob: col === 1 ? -1 : 0 };
  if (col < 8) return { t: (col - 2) / 6, walk: true, lunge: 0, hurt: false, bob: 0 };
  if (col < 12) {
    const k = col - 8;
    return { t: k / 4, walk: false, lunge: [-0.5, 0.3, 1, 0.4][k], hurt: false, bob: k === 2 ? -1 : 0 };
  }
  if (col === 12) return { t: 0, walk: false, lunge: 0, hurt: true, bob: 1 };
  const k = col - 13;
  return { t: k / 3, walk: false, lunge: 0.2 + k * 0.3, hurt: false, bob: 0 };
}

const cache = new Map<string, CharacterSheet>();

export function getCreatureSheet(style: CreatureStyle): CharacterSheet {
  const key = JSON.stringify(style);
  const hit = cache.get(key);
  if (hit) return hit;
  const scale = style.scale ?? 1;
  const rows: Px[][] = (['down', 'up', 'right'] as const).map((dir) =>
    Array.from({ length: SHEET_COLS }, (_, c) => {
      const base = drawCreature(style, dir, poseFor(c));
      if (scale === 1) return base;
      const up = new Px(CH_W * scale, CH_H * scale);
      up.g.imageSmoothingEnabled = false;
      up.g.drawImage(base.canvas, 0, 0, up.w, up.h);
      return up;
    }),
  );
  const sheet: CharacterSheet = {
    canvas: sheetGrid(rows) as Canvas,
    fw: CH_W * scale,
    fh: CH_H * scale,
    feet: CH_FEET * scale,
  };
  if (cache.size > 80) cache.clear();
  cache.set(key, sheet);
  return sheet;
}

export const CREATURE_PALETTES: Record<string, Pick<CreatureStyle, 'primary' | 'secondary' | 'accent' | 'eye'>> = {
  wolf: { primary: '#6b6a74', secondary: '#4a4955', accent: '#8f8e99', eye: PAL.flameLit },
  direwolf: { primary: '#3e3a48', secondary: '#282430', accent: '#5a5568', eye: PAL.ember },
  frostwolf: { primary: '#a9c2d4', secondary: '#7d95ab', accent: PAL.white, eye: PAL.frost },
  spider: { primary: '#37313f', secondary: '#241f2b', accent: PAL.blood, eye: PAL.ember },
  venomspider: { primary: '#3f4a28', secondary: '#293118', accent: PAL.toxic, eye: PAL.toxic },
  bat: { primary: '#4a3a4e', secondary: '#2e2434', accent: PAL.arcane, eye: PAL.flame },
  slime: { primary: '#5fae74', secondary: '#3c7a52', accent: PAL.grassPale, eye: PAL.ink },
  slimeToxic: { primary: PAL.toxic, secondary: PAL.rot, accent: PAL.white, eye: PAL.ink },
  wisp: { primary: PAL.arcaneLit, secondary: PAL.frost, accent: PAL.white, eye: PAL.ink },
  emberwisp: { primary: PAL.flame, secondary: PAL.flameLit, accent: PAL.white, eye: PAL.ink },
  golem: { primary: '#6d6878', secondary: '#4a4655', accent: PAL.arcaneLit, eye: PAL.frost },
  sandgolem: { primary: PAL.sandDark, secondary: PAL.clay, accent: PAL.gold, eye: PAL.flameLit },
  treant: { primary: '#5a3f28', secondary: '#3a2718', accent: PAL.leaf, eye: PAL.toxic },
  scorpion: { primary: '#9a6a34', secondary: '#6d4720', accent: PAL.toxic, eye: PAL.ink },
  wraith: { primary: '#6f7f96', secondary: '#3a4658', accent: PAL.frost, eye: PAL.frost },
  boar: { primary: '#6a4f3a', secondary: '#4a3526', accent: PAL.cloth, eye: PAL.ember },
  crawler: { primary: '#7d8a6a', secondary: '#4f5a41', accent: PAL.rot, eye: PAL.toxic },
  serpent: { primary: '#4a7a4e', secondary: '#2f5233', accent: PAL.toxic, eye: PAL.flameLit },

  /* --- the Jotunreach --- */
  rimewolf: { primary: '#e2ecf4', secondary: '#b3c6d6', accent: PAL.white, eye: '#4f9ce8' },
  glacierwyrm: { primary: '#6fa8c4', secondary: '#3f6f8c', accent: PAL.ice, eye: PAL.white },
  wintershade: { primary: '#cfe0ec', secondary: '#7f96ab', accent: PAL.white, eye: PAL.frost },
  icegolem: { primary: '#9fc4d8', secondary: '#5f8ba4', accent: PAL.white, eye: PAL.frost },
  bonewrought: { primary: PAL.bone, secondary: '#8e8778', accent: PAL.frost, eye: PAL.frost },
  glaciermaw: { primary: '#bcd8e8', secondary: '#6f9ab4', accent: PAL.blood, eye: PAL.blood },

  /* --- the outer marches --- */
  gloamwolf: { primary: '#1f2a1e', secondary: '#0f160f', accent: PAL.leafLit, eye: PAL.toxic },
  gloamspider: { primary: '#22301f', secondary: '#121a11', accent: PAL.toxic, eye: PAL.flameLit },
  hollowtreant: { primary: '#2a2118', secondary: '#16110c', accent: PAL.toxic, eye: PAL.arcaneLit },
  saltwraith: { primary: '#9fc0c8', secondary: '#4a7a8c', accent: PAL.foam, eye: PAL.foam },
  brinecrawler: { primary: '#5f8a8c', secondary: '#33585c', accent: PAL.foam, eye: PAL.ink },
  saltgolem: { primary: '#cfd8d4', secondary: '#8a9a96', accent: PAL.foam, eye: PAL.water },
  cinderwisp: { primary: PAL.ember, secondary: PAL.emberDark, accent: PAL.flameLit, eye: PAL.white },
  ashscorpion: { primary: '#6a3a2a', secondary: '#3a1d14', accent: PAL.flame, eye: PAL.flameLit },
  magmagolem: { primary: '#5a2418', secondary: '#2e120b', accent: PAL.flame, eye: PAL.flameLit },
  ashserpent: { primary: '#7a3a2a', secondary: '#45201a', accent: PAL.flameLit, eye: PAL.ember },
};

export function creatureStyle(kind: CreatureKind, paletteKey: string, scale = 1, glow?: string | null): CreatureStyle {
  const pal = CREATURE_PALETTES[paletteKey] ?? CREATURE_PALETTES.wolf;
  return { kind, ...pal, scale, glow: glow ?? null };
}

export const mixColors = mix;
