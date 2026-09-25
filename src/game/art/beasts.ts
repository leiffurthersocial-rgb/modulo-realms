import { PAL, mix, shade, withAlpha } from './palette';
import type { Px } from './pixel';
import { CH_FEET } from './characters';
import type { CPose, CreatureStyle } from './creatures';

/**
 * The two creatures a player meets most — the wolf and the golem — drawn as
 * anatomy instead of as a stack of ellipses, plus the "menace" tiers every
 * later creature wears.
 *
 * Menace is read off the bestiary level, never off a spawn roll, so one
 * species always looks the same and a sheet is built once. Tier 0 is the
 * valley; each tier after that adds something a player learns to read from
 * across a field before the health bar tells them: scars and bristling
 * hackles, then bone spikes, then light leaking out through the cracks.
 */
export function menaceTier(level: number): number {
  return level >= 55 ? 3 : level >= 30 ? 2 : level >= 16 ? 1 : 0;
}

const F = CH_FEET;
const MAW = '#3a0f14';

/** A thick jointed limb through a chain of points. */
function limb(p: Px, pts: Array<[number, number]>, w: number, color: string): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    for (let o = 0; o < w; o++) p.line(x0 + o, y0, x1 + o, y1, color);
  }
}

function spike(p: Px, x: number, y: number, h: number, lean: number, color: string, hi?: string): void {
  p.poly([[x - 1.5, y], [x + lean, y - h], [x + 1.5, y]], color);
  if (hi) p.line(x - 0.5, y - 1, x + lean * 0.8, y - h + 1, hi);
}

/* ------------------------------------------------------------------ */
/* Wolf                                                                */
/* ------------------------------------------------------------------ */

/** A tapered horn of bone: dark at the root, pale along the shaft, a white tip. */
function boneSpike(p: Px, x: number, y: number, h: number, lean: number, root: string, bone: string): void {
  for (let j = 0; j < h; j++) {
    const k = j / Math.max(1, h - 1);
    const w = k < 0.45 ? 2 : 1;
    const c = k < 0.3 ? root : k < 0.85 ? bone : shade(bone, 1.12);
    p.fill(x + lean * k * h * 0.5 - (w === 2 ? 0 : 0), y - j, w, 1, c);
  }
}

/** Quadratic bezier through a bushy tail, thick in the middle and dark at the tip. */
function bushyTail(p: Px, x0: number, y0: number, cxp: number, cyp: number, x1: number, y1: number, fur: string, dark: string, deep: string): void {
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * cxp + k * k * x1;
    const y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * cyp + k * k * y1;
    const r = 1.1 + Math.sin(Math.min(1, k * 1.25) * Math.PI) * 1.5;
    p.ellipse(x, y, r, r, k > 0.8 ? deep : fur);
    if (k > 0.15 && k < 0.8) p.set(x, y - r + 0.5, dark);
  }
}

/**
 * A wolf reads as a wolf from three things: a long low snout, ears that
 * pin back when it commits, and a tail that says what it is about to do.
 * The side view trots on diagonal pairs, drops its head while it runs and
 * stretches out over a full body length on the bite; the front view is a
 * wedge of a head over a narrow chest, with the back running away above it.
 */
export function drawWolf(p: Px, s: CreatureStyle, dir: 'down' | 'up' | 'right', pose: CPose, tier: number): void {
  const cx = 18;
  const fur = s.primary;
  const dark = s.secondary;
  const light = s.accent;
  const belly = mix(fur, light, 0.5);
  const deep = shade(dark, 0.72);
  const glow = s.glow ?? s.eye;
  const vein = tier >= 3 ? mix(glow, s.eye, 0.5) : glow;
  const ph = pose.t * Math.PI * 2;
  const strike = Math.max(0, pose.lunge);
  const crouch = Math.max(0, -pose.lunge) * 2;
  const hurt = pose.hurt;
  const runBob = pose.walk ? -Math.round(Math.abs(Math.sin(ph)) * 1.4) : 0;
  const open = strike > 0.35 ? Math.max(1, Math.round(strike * 3)) : hurt ? 1 : 0;
  const bone = mix(light, PAL.bone, 0.5);
  const pinned = strike > 0 || crouch > 0 || hurt;

  p.ellipse(cx, F + 1, dir === 'right' ? 12 : 9, 2.6, 'rgba(10,8,16,0.32)');

  if (dir === 'right') {
    const sx = Math.round(strike * 3 - crouch * 2 - (hurt ? 2 : 0));
    const bx = cx - 4 + sx;
    const by = F - 17 + pose.bob + runBob + Math.round(crouch * 2) + (hurt ? 1 : 0) - (strike > 0.9 ? 1 : 0);

    const leg = (hipX: number, hipY: number, front: boolean, off: number, near: boolean) => {
      let sw = 0;
      let lift = 0;
      if (pose.walk) { sw = Math.sin(ph + off) * 3; lift = Math.max(0, Math.cos(ph + off)) * 2.2; }
      if (strike > 0) { sw += (front ? 3 : -3) * strike; lift += strike > 0.9 ? 2 : 0; }
      if (crouch > 0) sw += front ? 1 : -1;
      const c = near ? fur : deep;
      const footX = hipX + (front ? 1 : -1) + sw;
      const footY = F - lift;
      if (front) {
        limb(p, [[hipX, hipY], [hipX + sw * 0.3, hipY + (footY - hipY) * 0.5], [footX, footY - 1]], 2, c);
      } else {
        limb(p, [[hipX, hipY], [hipX + 2 + sw * 0.3, hipY + (footY - hipY) * 0.35],
          [hipX - 1 + sw * 0.6, hipY + (footY - hipY) * 0.72], [footX, footY - 1]], 2, c);
      }
      p.fill(footX - 1 + (front ? 1 : 0), footY - 1, 3, 1, near ? dark : shade(deep, 0.85));
    };

    // far legs first, darker, so the four read as a pair of pairs
    leg(bx - 6, by + 4, false, 0, false);
    leg(bx + 6, by + 4, true, Math.PI, false);

    // tail: hangs when idle, streams when running, lifts stiff when it commits
    const wag = Math.sin(ph + 1) * (pose.walk ? 1.2 : 0.8);
    const tx0 = bx - 10;
    const ty0 = by + 2;
    if (strike > 0) bushyTail(p, tx0, ty0, tx0 - 4, ty0 - 2, tx0 - 8, ty0 - 4 + wag, fur, dark, deep);
    else if (crouch > 0) bushyTail(p, tx0, ty0, tx0 - 3, ty0 + 3, tx0 - 4, ty0 + 10, fur, dark, deep);
    else if (pose.walk) bushyTail(p, tx0, ty0, tx0 - 5, ty0, tx0 - 9, ty0 + 4 + wag, fur, dark, deep);
    else bushyTail(p, tx0, ty0, tx0 - 5, ty0 + 1, tx0 - 6 + wag * 0.5, ty0 + 9, fur, dark, deep);

    // haunch, barrel, deep chest, dark saddle, pale belly
    p.ellipse(bx - 7, by + 5, 4.5, 4.5, fur);
    p.ellipse(bx - 1, by + 4, 8.5, 4.2, fur);
    p.ellipse(bx + 5, by + 4.5, 5, 5, fur);
    p.ellipse(bx - 2, by + 1.8, 8, 2, dark);
    p.fill(bx - 9, by + 3, 3, 1, shade(fur, 1.14));
    p.fill(bx + 3, by + 2, 3, 1, shade(fur, 1.1));
    p.fill(bx - 5, by + 8, 9, 1, belly);
    p.fill(bx - 5, by + 9, 5, 1, shade(fur, 0.78));
    p.ellipse(bx + 7, by + 6.5, 2.5, 3, belly);
    for (const [fx, fy] of [[-6, 4], [-3, 5], [0, 4], [2, 6], [-8, 6]]) p.set(bx + fx, by + fy, shade(fur, 0.84));

    // hackles stand up when it is about to go, and on anything past the valley
    const hk = (tier >= 1 ? 1 : 0) + (strike > 0 || crouch > 0 ? 1 : 0);
    for (let i = 0; i < 5; i++) {
      const x = bx - 3 + i * 2.2;
      p.poly([[x - 1, by + 1.5], [x - 1.8, by + 0.4 - 2 - hk - (i === 2 ? 1 : 0)], [x + 1.4, by + 1.5]], dark);
    }
    if (tier >= 2) for (let i = 0; i < 4; i++) boneSpike(p, bx - 6 + i * 3.2, by + 1, 3 + [0, 2, 3, 1][i], -1.2, deep, bone);
    if (tier >= 1) p.line(bx - 4, by + 3, bx - 2, by + 6, mix(fur, light, 0.6));
    if (tier >= 3) {
      p.line(bx - 9, by + 4, bx - 6, by + 6, vein); p.line(bx - 6, by + 6, bx - 3, by + 4, vein);
      p.line(bx - 3, by + 4, bx + 1, by + 6, vein); p.line(bx + 3, by + 3, bx + 5, by + 6, vein);
      p.set(bx - 6, by + 6, PAL.white); p.set(bx + 1, by + 6, PAL.white);
    }

    leg(bx - 7, by + 6, false, Math.PI, true);
    leg(bx + 5, by + 6, true, 0, true);

    // neck, mane crest and throat ruff
    const hx = bx + 11 + Math.round(strike * 2);
    const hy = by - 2 + (pose.walk ? 1 : 0) + Math.round(crouch * 3) - (hurt ? 3 : 0) + (strike > 0.9 ? 1 : 0);
    p.poly([[bx + 2, by + 1], [hx - 2, hy - 3], [hx + 1, hy + 2], [bx + 7, by + 8]], fur);
    p.poly([[bx + 2, by + 0.5], [hx - 2, hy - 3.5], [hx - 1, hy - 1], [bx + 4, by + 2.5]], dark);
    p.poly([[hx - 2, hy + 2], [bx + 8, by + 8], [bx + 6, by + 4]], belly);
    p.poly([[hx - 3, hy + 1], [hx - 5, hy + 5], [hx - 1, hy + 3]], fur);

    // skull, stop and long snout
    p.ellipse(hx, hy, 4, 3.3, fur);
    p.fill(hx - 2, hy - 3, 4, 1, dark);
    p.poly([[hx + 1, hy - 2.5], [hx + 8, hy - 0.5], [hx + 8, hy + 1], [hx + 1, hy + 2]], fur);
    p.line(hx + 2, hy - 2, hx + 6, hy - 1, shade(fur, 1.15));
    p.fill(hx + 2, hy + 1, 6, 1, belly);
    p.fill(hx + 7, hy - 1, 2, 2, PAL.ink);
    if (open) {
      p.poly([[hx + 1, hy + 1.5], [hx + 8, hy + 1], [hx + 7, hy + 1.5 + open], [hx + 1, hy + 2 + open * 0.6]], MAW);
      p.poly([[hx, hy + 2], [hx + 7, hy + 1.5 + open], [hx + 7, hy + 2.5 + open], [hx, hy + 3]], shade(fur, 0.88));
      p.set(hx + 3, hy + 2, PAL.white); p.set(hx + 6, hy + 2, PAL.white);
      p.set(hx + 5, hy + 1 + open, PAL.white);
    } else {
      p.fill(hx + 1, hy + 2, 6, 1, shade(fur, 0.8));
      if (tier >= 2) p.set(hx + 5, hy + 2, PAL.white);
    }
    // ears: up and forward, pinned flat once it commits
    if (pinned) {
      p.poly([[hx - 1, hy - 2], [hx - 6, hy - 5], [hx + 0.5, hy - 3.5]], fur);
      p.line(hx - 4, hy - 4, hx - 1, hy - 3, deep);
    } else {
      const tw = pose.bob < 0 ? 1 : 0;
      p.poly([[hx - 2.5, hy - 2], [hx - 1 - tw, hy - 8], [hx + 1.5, hy - 2.5]], fur);
      p.line(hx - 1 - tw, hy - 6, hx - 1, hy - 3, deep);
      if (tier >= 2) p.g.clearRect(Math.round(hx - 1 - tw), Math.round(hy - 6), 1, 1);
    }
    // a heavy brow over a lit eye
    p.fill(hx - 1, hy - 2, 3, 1, deep);
    p.fill(hx, hy - 1, 2, 1, hurt ? deep : s.eye);
    if (tier >= 1 && !hurt) p.set(hx - 1, hy - 1, withAlpha(s.eye, 0.5));
    if (tier >= 3 && !hurt) { p.set(hx - 2, hy - 1, withAlpha(vein, 0.4)); p.set(hx - 3, hy - 1, withAlpha(vein, 0.2)); }
    if (tier >= 2) p.line(hx - 1, hy - 3, hx + 2, hy + 1, mix(fur, light, 0.7));
    return;
  }

  const by = F - 17 + pose.bob + runBob + Math.round(crouch * 2) + (hurt ? 1 : 0);

  if (dir === 'down') {
    // Facing the camera a wolf is a wedge: wide cheeks and tall ears
    // narrowing to a pale muzzle and a black nose, over two forelegs with a
    // dark gap between them. The back shows only as a hump above the head.
    const hx = cx;
    const hy = by + 2 + Math.round(crouch * 2 + strike * 2) - (hurt ? 2 : 0);
    p.ellipse(cx, by + 1, 4, 2.5, dark);
    const wag = pose.walk ? Math.round(Math.sin(ph)) : 0;
    p.fill(cx + 4 + wag, by - 1, 2, 3, fur);
    p.set(cx + 5 + wag, by - 2, deep);
    if (crouch > 0 || strike > 0) p.ellipse(cx, hy - 4, 6, 2.5, dark);
    p.ellipse(cx, by + 8, 6, 3.5, fur);
    p.fill(cx - 2, by + 11, 4, F - by - 12, deep);
    const spread = strike > 0 ? 1 : 0;
    for (const side of [-1, 1]) {
      const lift = pose.walk ? Math.max(0, Math.sin(ph + (side < 0 ? 0 : Math.PI))) * 2.2 : 0;
      const x = side < 0 ? cx - 4 - spread : cx + 2 + spread;
      p.fill(x, by + 9, 2, F - by - 9 - lift, fur);
      p.fill(side < 0 ? x : x + 1, by + 10, 1, F - by - 11 - lift, shade(fur, side < 0 ? 1.12 : 0.8));
      p.fill(x - (side < 0 ? 1 : 0), F - 1 - lift, 3, 1, dark);
      p.set(x - (side < 0 ? 1 : 0), F - 1 - lift, deep);
    }
    p.poly([[cx - 3, by + 7], [cx, by + 13], [cx + 3, by + 7]], belly);
    if (tier >= 2) for (const side of [-1, 1]) boneSpike(p, cx + side * 5 - (side > 0 ? 1 : 0), by + 7, 5, side * 1.2, deep, bone);
    if (tier >= 3) { p.line(cx - 5, by + 7, cx - 3, by + 10, vein); p.line(cx + 5, by + 7, cx + 3, by + 10, vein); }
    // ears
    for (const side of [-1, 1]) {
      if (pinned) {
        p.poly([[hx + side * 4, hy - 2], [hx + side * 9, hy - 4], [hx + side * 4, hy]], fur);
        p.line(hx + side * 5, hy - 2, hx + side * 8, hy - 3, deep);
      } else {
        p.poly([[hx + side * 6, hy - 2], [hx + side * 5, hy - 9], [hx + side * 1.5, hy - 3]], fur);
        p.line(hx + side * 4.5, hy - 7, hx + side * 4, hy - 3, deep);
      }
    }
    // the wedge
    p.poly([[hx - 6.5, hy - 2.5], [hx + 6.5, hy - 2.5], [hx + 2.5, hy + 6], [hx - 2.5, hy + 6]], fur);
    p.poly([[hx - 7, hy], [hx - 4, hy - 1], [hx - 4, hy + 3]], fur);
    p.poly([[hx + 7, hy], [hx + 4, hy - 1], [hx + 4, hy + 3]], fur);
    p.fill(hx - 1, hy - 3, 2, 4, dark);
    p.poly([[hx - 2, hy + 1], [hx + 2, hy + 1], [hx + 1.5, hy + 6], [hx - 1.5, hy + 6]], belly);
    p.fill(hx - 1, hy + 5, 2, 2, PAL.ink);
    p.poly([[hx - 3, hy + 6], [hx + 3, hy + 6], [hx, hy + 9]], belly);
    // slanted eyes under a V of a brow
    const eyeC = hurt ? deep : s.eye;
    p.set(hx - 4, hy - 1, eyeC); p.set(hx - 3, hy, eyeC);
    p.set(hx + 3, hy - 1, eyeC); p.set(hx + 2, hy, eyeC);
    p.set(hx - 3, hy - 1, deep); p.set(hx + 2, hy - 1, deep);
    p.set(hx - 2, hy, deep); p.set(hx + 1, hy, deep);
    if (tier >= 1 && !hurt) { p.set(hx - 5, hy - 1, withAlpha(s.eye, 0.55)); p.set(hx + 4, hy - 1, withAlpha(s.eye, 0.55)); }
    if (tier >= 3 && !hurt) { p.set(hx - 6, hy - 2, vein); p.set(hx + 5, hy - 2, vein); }
    if (tier >= 2) p.line(hx + 2, hy - 3, hx + 4, hy + 1, mix(fur, light, 0.7));
    if (open) {
      p.fill(hx - 2, hy + 6, 4, open + 1, MAW);
      p.set(hx - 2, hy + 6, PAL.white); p.set(hx + 1, hy + 6, PAL.white);
      p.set(hx - 1, hy + 6 + open, PAL.white); p.set(hx, hy + 6 + open, PAL.white);
    } else if (tier >= 2) {
      p.set(hx - 2, hy + 6, PAL.white); p.set(hx + 1, hy + 6, PAL.white);
    }
    return;
  }

  // up: head furthest away, a long back, the rump nearest, tail between the hocks
  for (const side of [-1, 1]) {
    const lift = pose.walk ? Math.max(0, Math.sin(ph + (side < 0 ? Math.PI : 0))) * 1.5 : 0;
    p.fill(cx + side * 3 - 1, by + 5 - lift, 2, F - by - 6, deep);
  }
  const hy = by - 1 - (hurt ? 1 : 0) + Math.round(crouch * 2);
  for (const side of [-1, 1]) {
    p.poly([[cx + side, hy - 1], pinned ? [cx + side * 6, hy - 3] : [cx + side * 4, hy - 5], [cx + side * 4, hy + 1]], fur);
    p.line(cx + side * 2, hy - 1, cx + side * 3, hy - 4, deep);
  }
  p.ellipse(cx, hy, 3.4, 2.8, fur);
  p.ellipse(cx, hy + 3, 4, 2.2, dark);
  p.ellipse(cx, by + 5, 4.5, 3.5, fur);
  p.ellipse(cx, by + 9, 5.5, 4, fur);
  p.ellipse(cx, by + 5, 3, 3, dark);
  p.fill(cx - 4, by + 8, 2, 1, shade(fur, 1.12));
  if (tier >= 2) for (let i = 0; i < 3; i++) boneSpike(p, cx - 1 + (i % 2), by + 3 + i * 3, 4 - i, 0, deep, bone);
  if (tier >= 3) p.line(cx - 3, by + 7, cx + 3, by + 10, vein);
  for (const side of [-1, 1]) {
    const lift = pose.walk ? Math.max(0, Math.sin(ph + (side < 0 ? 0 : Math.PI))) * 2.2 : 0;
    const x = cx + side * 4 - 1;
    p.ellipse(x + 1, by + 10, 2, 3, shade(fur, 0.92));
    limb(p, [[x, by + 11], [x + side * 1.5, by + 14], [x, F - 1 - lift]], 2, shade(fur, 0.88));
    p.fill(x - 0.5, F - 1 - lift, 3, 1, dark);
  }
  const wag = Math.sin(ph) * (pose.walk ? 1.5 : 1);
  if (strike > 0) bushyTail(p, cx, by + 10, cx + wag, by + 6, cx + wag * 2, by + 2, fur, dark, deep);
  else bushyTail(p, cx, by + 10, cx + wag, by + 14, cx + wag * 1.5, F - 3, fur, dark, deep);
}

/* ------------------------------------------------------------------ */
/* Golem                                                               */
/* ------------------------------------------------------------------ */

/**
 * A golem is a pile of quarried stone that someone taught to stand up. Its
 * weight is the whole read: a small sunk head under a brow ridge, boulder
 * pauldrons, fists bigger than the head, and a chest that is cracked open
 * around whatever keeps it moving. It stomps — the body drops on every
 * footfall — and its attack is a two-fisted slam from overhead.
 */
export function drawGolem(p: Px, s: CreatureStyle, dir: 'down' | 'up' | 'right', pose: CPose, tier: number): void {
  const cx = 18;
  const st = s.primary;
  const dk = s.secondary;
  const lt = shade(st, 1.22);
  const sh = shade(st, 0.78);
  const core = s.accent;
  const ph = pose.t * Math.PI * 2;
  const strike = Math.max(0, pose.lunge);
  const crouch = Math.max(0, -pose.lunge) * 2;
  const hurt = pose.hurt;
  const stepA = pose.walk ? Math.max(0, Math.sin(ph)) : 0;
  const stepB = pose.walk ? Math.max(0, Math.sin(ph + Math.PI)) : 0;
  const drop = pose.walk && Math.abs(Math.cos(ph)) > 0.8 ? 1 : 0;
  const hx = hurt ? -1 : 0;
  const top = F - 31 + pose.bob + drop + Math.round(crouch) + (strike > 0.9 ? 2 : 0);
  const pulse = 0.55 + 0.45 * Math.sin(ph * (pose.walk ? 1 : 2)) + strike * 0.4;
  const moss = mix(st, '#5a6b46', 0.7);
  const crystal = core;
  const crystalLit = mix(core, PAL.white, 0.3);
  const vein = (x0: number, y0: number, x1: number, y1: number) => { p.line(x0 - 1, y0, x1 - 1, y1, shade(core, 0.7)); p.line(x0, y0, x1, y1, mix(core, PAL.white, 0.5)); };

  p.ellipse(cx, F + 1, 14, 3.4, 'rgba(10,8,16,0.38)');

  const fist = (x: number, y: number, r: number, color: string) => {
    p.ellipse(x, y, r, r * 0.9, color);
    p.ellipse(x - 1, y - 1.2, r * 0.55, r * 0.35, shade(color, 1.18));
    p.line(x - r + 1, y + 1, x + r - 1, y + 1, dk);
  };

  if (dir === 'right') {
    const bx = cx - 2 + hx + Math.round(strike * 2);
    // far leg and far arm, darker
    const legAt = (x: number, lift: number, color: string) => {
      p.fill(x, F - 11 - lift, 6, 6, color);
      p.fill(x - 1, F - 6 - lift, 8, 5, shade(color, 1.05));
      p.fill(x - 1, F - 6 - lift, 8, 1, dk);
      p.fill(x - 2, F - 2 - lift, 10, 2, dk);
    };
    legAt(bx - 1, stepB * 2.5, sh);
    const shoulder: [number, number] = [bx + 3, top + 10];
    const fistRest: [number, number] = [bx + 8, top + 24];
    const fistUp: [number, number] = [bx + 4, top - 2];
    const fistDown: [number, number] = [bx + 13, F - 3];
    const at = (k: number, a: [number, number], b: [number, number]): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    const armSwing = pose.walk ? Math.sin(ph) * 2 : 0;
    const f: [number, number] = strike > 0 ? at(strike, fistUp, fistDown) : crouch > 0 ? at(crouch, fistRest, fistUp) : [fistRest[0] + armSwing, fistRest[1]];
    limb(p, [[shoulder[0] - 5, shoulder[1]], [f[0] - 6, f[1]]], 3, shade(sh, 0.9));
    fist(f[0] - 5, f[1], 4, sh);
    // hunched torso with a back plate
    p.poly([[bx - 8, top + 10], [bx - 3, top + 5], [bx + 5, top + 6], [bx + 9, top + 11], [bx + 7, top + 22], [bx - 7, top + 22]], st);
    p.poly([[bx - 8, top + 10], [bx - 3, top + 5], [bx + 1, top + 5], [bx - 3, top + 13], [bx - 8, top + 14]], lt);
    p.poly([[bx + 5, top + 6], [bx + 9, top + 11], [bx + 7, top + 22], [bx + 4, top + 15]], sh);
    p.line(bx - 6, top + 16, bx - 2, top + 19, dk);
    p.line(bx + 1, top + 9, bx + 2, top + 13, dk);
    p.fill(bx - 7, top + 20, 14, 3, dk);
    // the core, seen from the side as a split in the flank
    p.line(bx + 4, top + 12, bx + 6, top + 16, shade(core, 0.7));
    p.line(bx + 5, top + 12, bx + 7, top + 16, core);
    p.set(bx + 6, top + 14, mix(core, PAL.white, 0.55));
    // a dark notch where the leg meets the torso
    p.fill(bx - 6, top + 22, 12, 1, shade(dk, 0.6));
    legAt(bx - 4 + Math.round(stepA * 2), stepA * 2.5, st);
    // head: forward, low, all brow
    const hdX = bx + 7 + Math.round(strike * 2);
    const hdY = top + 5 + Math.round(crouch) - (hurt ? 1 : 0);
    p.poly([[hdX - 4, hdY - 3], [hdX + 3, hdY - 3], [hdX + 5, hdY + 1], [hdX + 3, hdY + 4], [hdX - 4, hdY + 4]], shade(st, 0.95));
    p.fill(hdX - 3, hdY - 2, 9, 2, dk);
    p.fill(hdX + 1, hdY, 4, 1, hurt ? dk : s.eye);
    // pauldron over it all
    p.ellipse(bx + 1, top + 8, 5.5, 4.5, st);
    p.ellipse(bx, top + 6.5, 3.5, 1.8, lt);
    const nearFist: [number, number] = [f[0] + 1, f[1] + 1];
    limb(p, [[bx + 1, top + 11], [nearFist[0] - 1, nearFist[1] - 3]], 4, st);
    fist(nearFist[0], nearFist[1], 5, st);
    if (tier === 0) { p.set(bx - 1, top + 4, moss); p.set(bx + 1, top + 4, moss); p.set(bx, top + 5, moss); p.set(bx - 5, top + 9, moss); }
    if (tier >= 1) { p.set(bx - 1, top + 8, withAlpha(core, 0.7)); p.set(bx + 2, top + 8, withAlpha(core, 0.7)); }
    if (tier >= 2) {
      spike(p, bx - 2, top + 5, 6, -1.5, shade(crystal, 0.75), crystalLit);
      spike(p, bx - 6, top + 8, 5, -2, shade(crystal, 0.75), crystalLit);
      spike(p, bx + 2, top + 5, 4, 0.5, crystal);
    }
    if (tier >= 3) {
      vein(bx - 6, top + 12, bx - 3, top + 16); vein(bx - 3, top + 16, bx - 5, top + 20);
      vein(bx - 1, F - 9, bx + 1, F - 5);
      for (let i = 0; i < 3; i++) {
        const a = ph + i * 2.1;
        const ox = Math.round(hdX + Math.cos(a) * 8);
        const oy = Math.round(hdY - 7 + Math.sin(a) * 2.5);
        p.fill(ox, oy, 2, 3, crystal);
        p.set(ox, oy, crystalLit);
      }
    }
    if (strike > 0.9) {
      for (const [dx, dy] of [[-2, 0], [2, -1], [5, 0], [-4, -1]]) p.set(fistDown[0] + dx, F + dy, lt);
      p.line(fistDown[0] - 5, F, fistDown[0] + 5, F, dk);
    }
    return;
  }

  // front and back share the frame: legs, pelvis, torso, pauldrons, arms
  for (const side of [-1, 1]) {
    const lift = (side < 0 ? stepA : stepB) * 2.5;
    const x = cx + side * 5 - 3 + hx;
    const c = side < 0 ? sh : st;
    p.fill(x, F - 11 - lift, 6, 5, c);
    p.fill(x - 1, F - 6 - lift, 8, 5, shade(c, 1.05));
    p.fill(x - 1, F - 6 - lift, 8, 1, dk);
    p.fill(x - 2, F - 2 - lift, 10, 2, dk);
    if (tier >= 3) { p.line(x + 1, F - 10 - lift, x + 2, F - 4 - lift, shade(core, 0.7)); p.line(x + 2, F - 10 - lift, x + 3, F - 4 - lift, mix(core, PAL.white, 0.5)); }
  }
  const tx = cx + hx;
  p.fill(tx - 7, top + 20, 14, 4, dk);
  p.poly([[tx - 10, top + 9], [tx - 6, top + 6], [tx + 6, top + 6], [tx + 10, top + 9], [tx + 9, top + 21], [tx + 4, top + 23], [tx - 4, top + 23], [tx - 9, top + 21]], st);
  p.poly([[tx - 10, top + 9], [tx - 6, top + 6], [tx, top + 6], [tx - 2, top + 12], [tx - 9, top + 13]], lt);
  p.poly([[tx + 6, top + 6], [tx + 10, top + 9], [tx + 9, top + 21], [tx + 6, top + 17]], sh);
  p.line(tx - 3, top + 8, tx - 1, top + 11, dk);
  p.line(tx + 4, top + 16, tx + 7, top + 20, dk);
  p.line(tx - 8, top + 17, tx - 5, top + 19, dk);

  if (dir === 'down') {
    // the cracked-open chest and the thing inside it, in three hard rings
    const hot = mix(core, PAL.white, 0.55);
    p.poly([[tx, top + 9], [tx + 4, top + 14], [tx, top + 19], [tx - 4, top + 14]], shade(dk, 0.7));
    p.poly([[tx, top + 10], [tx + 3, top + 14], [tx, top + 18], [tx - 3, top + 14]], shade(core, 0.6));
    p.poly([[tx, top + 11], [tx + 2, top + 14], [tx, top + 17], [tx - 2, top + 14]], core);
    p.fill(tx - 1, top + 13, 2, 2 + (pulse > 0.8 ? 1 : 0), hot);
    const cr = pulse > 0.6 ? core : shade(core, 0.75);
    p.line(tx - 4, top + 14, tx - 7, top + 12, cr);
    p.line(tx + 4, top + 15, tx + 7, top + 17, cr);
    p.line(tx - 1, top + 19, tx - 2, top + 22, cr);
    p.set(tx - 7, top + 12, hot); p.set(tx + 7, top + 17, hot);
  } else {
    // a back plate and a spine of fitted stones
    for (let i = 0; i < 4; i++) p.ellipse(tx, top + 8 + i * 3.6, 2.2, 1.6, i % 2 ? lt : sh);
    p.fill(tx - 6, top + 11, 1, 8, dk);
    p.fill(tx + 5, top + 11, 1, 8, dk);
  }

  // arms: hanging to the knee, up over the head, then down into the ground
  for (const side of [-1, 1]) {
    const sX = tx + side * 11;
    const sY = top + 10;
    const rest: [number, number] = [tx + side * 14, top + 24];
    const up: [number, number] = [tx + side * 8, top - 2];
    const down: [number, number] = [tx + side * 8, F - 3];
    const swing = pose.walk ? Math.sin(ph) * 1.6 * side : 0;
    const lerp = (k: number, a: [number, number], b: [number, number]): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    const f: [number, number] = strike > 0 ? lerp(strike, up, down) : crouch > 0 ? lerp(crouch, rest, up) : [rest[0], rest[1] + swing];
    const c = side < 0 ? shade(st, 0.9) : st;
    limb(p, [[sX - 1, sY + 2], [(sX + f[0]) / 2 + side, (sY + f[1]) / 2], [f[0] - 1, f[1] - 2]], 4, c);
    fist(f[0], f[1], 5, c);
    // boulder pauldron
    p.ellipse(sX, sY, 5, 4.5, st);
    p.ellipse(sX - 1, sY - 1.5, 3, 1.5, lt);
    p.fill(sX - 4, sY + 3, 8, 1, dk);
    if (tier === 0) for (const [mx, my] of [[-2, -3], [0, -4], [1, -3], [-3, -2]]) p.set(sX + mx * side, sY + my, moss);
    if (tier >= 1) { p.set(sX - 2, sY, withAlpha(core, 0.75)); p.set(sX + 1, sY + 1, withAlpha(core, 0.75)); p.set(sX, sY - 1, withAlpha(core, 0.5)); }
    if (tier >= 2) {
      spike(p, sX - side, sY - 3, 7, side * 1.5, shade(crystal, 0.75), crystalLit);
      spike(p, sX + side * 3, sY - 2, 4, side * 2.2, crystal);
    }
  }
  if (strike > 0.9) {
    for (const side of [-1, 1]) {
      const x = tx + side * 8;
      p.line(x - 4, F, x + 4, F, dk);
      p.set(x - 5, F - 2, lt); p.set(x + 5, F - 3, lt); p.set(x + side * 7, F - 1, lt);
    }
  }

  // head: sunk between the shoulders, a brow ridge and one lit slit
  const hdY = top + Math.round(crouch) - (hurt ? 1 : 0);
  p.poly([[tx - 4, hdY + 1], [tx + 4, hdY + 1], [tx + 5, hdY + 5], [tx + 3, hdY + 8], [tx - 3, hdY + 8], [tx - 5, hdY + 5]], shade(st, 0.95));
  if (dir === 'down') {
    p.fill(tx - 5, hdY + 3, 10, 2, dk);
    if (!hurt) { p.set(tx - 4, hdY + 5, shade(s.eye, 0.6)); p.set(tx + 3, hdY + 5, shade(s.eye, 0.6)); }
    p.fill(tx - 3, hdY + 5, 6, 1, hurt ? dk : s.eye);
    if (!hurt) p.set(tx, hdY + 5, mix(s.eye, PAL.white, 0.6));
  } else {
    p.fill(tx - 4, hdY + 2, 8, 1, lt);
    if (tier === 0) { p.set(tx - 1, hdY + 1, moss); p.set(tx + 1, hdY + 2, moss); }
  }
  if (tier >= 2) {
    spike(p, tx - 3, hdY + 1, 4, -1, shade(crystal, 0.75), crystalLit);
    spike(p, tx + 3, hdY + 1, 4, 1, crystal);
    spike(p, tx, hdY + 1, 5, 0, shade(crystal, 0.75), crystalLit);
  }
  if (tier >= 3) {
    vein(tx - 8, top + 10, tx - 5, top + 15);
    vein(tx + 7, top + 9, tx + 5, top + 13);
    vein(tx - 3, top + 18, tx - 6, top + 22);
    // a crown of molten drips off the fists
    for (const side of [-1, 1]) { p.fill(tx + side * 14, top + 29, 1, 2 + (Math.floor(pose.t * 4) % 2), core); }
    for (let i = 0; i < 3; i++) {
      const a = ph + i * 2.1;
      const ox = Math.round(tx + Math.cos(a) * 11);
      const oy = Math.round(hdY - 4 + Math.sin(a) * 3);
      // angular shards with a one-pixel trail
      p.fill(ox, oy, 2, 3, crystal);
      p.set(ox, oy, crystalLit);
      p.set(ox - Math.round(Math.sin(a) * 2), oy + Math.round(Math.cos(a)), shade(crystal, 0.6));
    }
  }
  if (hurt) {
    for (const [dx, dy] of [[-13, -2], [12, 1], [-9, 6], [14, -6]]) p.set(tx + dx, top + 8 + dy, lt);
  }
}

/** Where a scorpion's tail ends, so the stinger sits on it and not in the air. */
export function scorpionStinger(cx: number, bodyY: number): [number, number] {
  const i = 6;
  const a = -0.4 - i * 0.28;
  return [cx - 6 - i * 0.4 + Math.cos(a) * i * 1.6, bodyY - 1 + Math.sin(a) * i * 1.6];
}

/* ------------------------------------------------------------------ */
/* Menace trim for the rest of the bestiary                            */
/* ------------------------------------------------------------------ */

/**
 * Additions drawn over a creature's own body by tier. Each species gets the
 * one thing that makes it read as worse than the valley version of itself:
 * a spider's spines and red mark, a scorpion's serrated claws, a serpent's
 * frill, thorns and a hollow glow on a treant, chains on a wraith.
 */
export function drawMenaceTrim(p: Px, s: CreatureStyle, dir: 'down' | 'up' | 'right', pose: CPose, tier: number): void {
  if (tier <= 0) return;
  const cx = 18;
  const glow = s.glow ?? s.eye;
  const bone = mix(s.accent, PAL.bone, 0.55);
  const ph = pose.t * Math.PI * 2;
  switch (s.kind) {
    case 'spider': {
      const bodyY = F - 12 + pose.bob;
      if (tier >= 1) for (let i = 0; i < 5; i++) p.set(cx - 4 + i * 2, bodyY + 1 + (i % 2), shade(s.secondary, 0.7));
      if (tier >= 2) {
        p.poly([[cx - 1.5, bodyY + 3], [cx + 1.5, bodyY + 3], [cx, bodyY + 5]], PAL.blood);
        p.poly([[cx - 1.5, bodyY + 7], [cx + 1.5, bodyY + 7], [cx, bodyY + 5]], PAL.blood);
        for (const side of [-1, 1]) spike(p, cx + side * 4, bodyY + 1, 4, side * 1.2, bone);
      }
      if (tier >= 3) {
        for (const [ex, ey] of [[-3, -5], [-1, -6], [1, -6], [3, -5]]) p.set(cx + ex, bodyY + ey, mix(glow, PAL.white, 0.4));
        p.line(cx - 5, bodyY + 4, cx - 2, bodyY + 8, withAlpha(glow, 0.9));
        p.line(cx + 5, bodyY + 4, cx + 2, bodyY + 8, withAlpha(glow, 0.9));
      }
      break;
    }
    case 'scorpion': {
      const bodyY = F - 10 + pose.bob;
      const cl = pose.lunge * 3;
      if (tier >= 1) for (const side of [-1, 1]) for (let i = 0; i < 3; i++) p.set(cx + side * (11 + cl + i), bodyY - 4 - i, bone);
      if (tier >= 2) {
        for (let i = 0; i < 4; i++) spike(p, cx - 6 + i * 3.5, bodyY - 1, 3, -0.5, shade(s.secondary, 0.8));
        const [sx, sy] = scorpionStinger(cx, bodyY);
        p.fill(sx + 2, sy - 1, 2, 2, glow);
        p.set(sx + 3, sy + 2 + (Math.sin(ph) > 0 ? 1 : 0), glow);
      }
      if (tier >= 3) {
        const v = withAlpha(glow, 0.9);
        for (let i = 0; i < 3; i++) p.fill(cx - 5 + i * 4, bodyY + 2, 2, 1, v);
      }
      break;
    }
    case 'serpent': {
      const bodyY = F - 8 + pose.bob;
      if (tier >= 1) for (let i = 1; i < 11; i += 2) {
        const x = cx - 12 + i * 2.2;
        const y = bodyY + Math.sin(ph + i * 0.6) * 3;
        p.set(x, y - 2, shade(s.secondary, 0.75));
      }
      if (tier >= 2) {
        const hx = cx + 13 + pose.lunge * 3;
        const hy = bodyY + Math.sin(ph + 7) * 3 - 4;
        p.poly([[hx - 4, hy], [hx - 7, hy - 6], [hx - 1, hy - 2]], s.accent);
        p.poly([[hx - 2, hy - 1], [hx - 3, hy - 7], [hx + 1, hy - 2]], shade(s.accent, 0.8));
        for (let i = 2; i < 11; i += 3) {
          const x = cx - 12 + i * 2.2;
          spike(p, x, bodyY + Math.sin(ph + i * 0.6) * 3 - 1, 3, -0.8, bone);
        }
      }
      if (tier >= 3) for (let i = 0; i < 12; i += 2) {
        const x = cx - 12 + i * 2.2;
        p.set(x, bodyY + Math.sin(ph + i * 0.6) * 3 + 1, withAlpha(glow, 0.95));
      }
      break;
    }
    case 'treant': {
      const top = F - 34 + pose.bob;
      if (tier >= 1) for (const [x, y] of [[-9, 14], [8, 18], [-8, 21], [9, 11]]) spike(p, cx + x, top + y, 3, x < 0 ? -2 : 2, shade(s.primary, 0.7));
      if (tier >= 2) {
        p.ellipse(cx, top + 19, 3, 3, PAL.ink);
        p.ellipse(cx, top + 19, 2, 2, withAlpha(glow, 0.8));
        p.fill(cx - 5, top + 12, 3, 3, glow); p.fill(cx + 2, top + 12, 3, 3, glow);
      }
      if (tier >= 3) {
        const v = withAlpha(glow, 0.85);
        p.line(cx - 6, top + 22, cx - 3, top + 26, v); p.line(cx + 5, top + 21, cx + 3, top + 25, v);
        for (let i = 0; i < 4; i++) p.set(cx - 12 + i * 8, top - 2 + (i % 2) * 3, mix(glow, PAL.white, 0.3));
      }
      break;
    }
    case 'wraith': {
      const y = F - 26 + Math.round(Math.sin(ph) * 2);
      if (tier >= 1) for (const side of [-1, 1]) p.poly([[cx + side * 4, y - 3], [cx + side * 7, y - 8], [cx + side * 6, y - 1]], shade(s.secondary, 0.8));
      if (tier >= 2) {
        const chain = shade(PAL.iron, 1.1);
        for (let i = 0; i < 6; i++) {
          p.set(cx - 7 + i * 0.6, y + 10 + i * 2, i % 2 ? chain : PAL.ironDark);
          p.set(cx + 7 - i * 0.6, y + 10 + i * 2, i % 2 ? PAL.ironDark : chain);
        }
      }
      if (tier >= 3 && dir !== 'up') {
        // a hollow mask: the face is gone, two slits of light remain
        p.fill(cx - 4, y + 1, 8, 3, PAL.ink);
        p.fill(cx - 3, y + 2, 2, 1, glow); p.fill(cx + 1, y + 2, 2, 1, glow);
        p.fill(cx - 1, y + 4, 2, 2, PAL.ink);
      }
      break;
    }
    case 'crawler': {
      if (tier >= 2) {
        const bodyY = F - 10 - 9 + pose.bob;
        for (let i = 0; i < 4; i++) spike(p, cx - 6 + i * 3.5, bodyY + 1, 4 + (i % 2), -1, bone, PAL.white);
      }
      if (tier >= 3) {
        const bodyY = F - 10 - 9 + pose.bob;
        p.line(cx - 6, bodyY + 4, cx + 4, bodyY + 6, withAlpha(glow, 0.9));
      }
      break;
    }
    case 'wisp': {
      const y = F - 20 + Math.round(Math.sin(ph) * 3);
      if (tier >= 2) {
        p.fill(cx - 3, y - 1, 2, 2, PAL.ink); p.fill(cx + 2, y - 1, 2, 2, PAL.ink);
        p.fill(cx - 1, y + 2, 3, 1, PAL.ink);
      }
      if (tier >= 3) for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.45;
        p.line(cx + Math.cos(a) * 7, y + Math.sin(a) * 7, cx + Math.cos(a) * (11 + (i % 2) * 2), y + Math.sin(a) * (11 + (i % 2) * 2) - Math.sin(ph + i) , withAlpha(s.accent, 0.8));
      }
      break;
    }
    default:
      break;
  }
}
