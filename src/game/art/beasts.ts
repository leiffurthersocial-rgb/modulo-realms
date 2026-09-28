import { PAL, mix, shade, withAlpha } from './palette';
import type { Px } from './pixel';
import { CH_FEET } from './characters';
import type { CPose, CreatureStyle } from './creatures';

/**
 * The golem, drawn as anatomy instead of as a stack of ellipses, plus the
 * "menace" tiers every later creature wears. The wolf lives in `wolfArt.ts`.
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

function spike(p: Px, x: number, y: number, h: number, lean: number, color: string, hi?: string): void {
  p.poly([[x - 1.5, y], [x + lean, y - h], [x + 1.5, y]], color);
  if (hi) p.line(x - 0.5, y - 1, x + lean * 0.8, y - h + 1, hi);
}

/* ------------------------------------------------------------------ */
/* Golem                                                               */
/* ------------------------------------------------------------------ */

/**
 * A golem is quarried stone that someone taught to stand up, and it is
 * built like it: every part is a cut block — a chest block, a sunk head
 * block, boulder shoulders, arms of two stacked stones and fists that are
 * square, knuckled blocks bigger than the head. At rest it stands like an
 * ape, knuckles on the ground either side of its feet. It winds up by lifting
 * both fists together over its head and slams them down in front.
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
  const top = F - 30 + pose.bob + drop + Math.round(crouch * 0.5) + (strike > 0.9 ? 3 : 0) + (hurt ? 1 : 0);
  const pulse = 0.55 + 0.45 * Math.sin(ph * (pose.walk ? 1 : 2)) + strike * 0.4;
  const moss = mix(st, '#5a6b46', 0.7);
  const crystal = core;
  const crystalLit = mix(core, PAL.white, 0.3);
  const hot = mix(core, PAL.white, 0.55);
  /** A vein of light along a seam, kinked once, dark-edged with a bright core pixel. */
  const vein = (x0: number, y0: number, x1: number, y1: number) => {
    const mx = Math.round((x0 + x1) / 2) + 1, my = Math.round((y0 + y1) / 2);
    for (const [a, b, c, d] of [[x0, y0, mx, my], [mx, my, x1, y1]]) { p.line(a - 1, b, c - 1, d, shade(core, 0.6)); p.line(a, b, c, d, core); }
    p.set(mx, my, mix(core, PAL.holy, 0.6));
  };
  /** An orbiting chunk of rock with one ember in it: irregular, outlined, clear of the body. */
  const shard = (x: number, y: number, i: number) => {
    const ox = Math.round(x), oy = Math.round(y);
    const shapes: Array<Array<[number, number]>> = [[[0, 0], [1, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [0, 1], [1, 1], [0, 2], [1, 3]], [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]];
    const cells = shapes[i % 3];
    for (const [dx, dy] of cells) p.set(ox + dx, oy + dy + 1, shade(dk, 0.7));
    for (const [dx, dy] of cells) p.set(ox + dx, oy + dy, shade(st, 1.35));
    p.set(ox + cells[1][0], oy + cells[1][1], core);
  };
  const lerp = (k: number, a: [number, number], b: [number, number]): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

  /** A cut stone: lit top, dark underside, shaded right face, clipped corners. */
  const stone = (x: number, y: number, w: number, h: number, c: string) => {
    x = Math.round(x); y = Math.round(y);
    p.fill(x + 1, y, w - 2, h, c);
    p.fill(x, y + 1, w, h - 2, c);
    p.fill(x + 1, y, w - 2, 1, shade(c, 1.2));
    p.fill(x + 1, y + h - 1, w - 2, 1, shade(c, 0.62));
    p.fill(x + w - 1, y + 1, 1, h - 2, shade(c, 0.78));
  };
  /** A fist: a square block with three knuckles across its front. */
  const fist = (fx: number, fy: number, c: string, facing: 'front' | 'side') => {
    const w = facing === 'front' ? 9 : 8, h = 7;
    const x = Math.round(fx - w / 2), y = Math.round(fy - h);
    const lit = shade(c, 1.12);
    stone(x, y, w, h, lit);
    // a pale top face, then knuckle ridges down the front
    p.fill(x + 1, y, w - 2, 2, shade(c, 1.35));
    for (let i = 1; i < 3; i++) p.fill(x + Math.round((w * i) / 3), y + 3, 1, h - 4, shade(c, 0.6));
    p.fill(x + 1, y + 2, w - 2, 1, shade(c, 0.8));
    if (tier >= 2) p.fill(x + 2, y, w - 4, 1, shade(core, 0.9));
  };
  /** An arm from a shoulder to a fist: two stacked stones along the way. */
  const arm = (sx: number, sy: number, fx: number, fy: number, c: string, facing: 'front' | 'side') => {
    const [ux, uy] = lerp(0.36, [sx, sy], [fx, fy - 6]);
    const [lx, ly] = lerp(0.72, [sx, sy], [fx, fy - 6]);
    stone(ux - 3, uy - 3, 6, 7, c);
    stone(lx - 3, ly - 3, 7, 7, shade(c, 0.94));
    p.fill(Math.round(ux) - 2, Math.round(uy) + 3, 5, 1, dk);
    fist(fx, fy, c, facing);
  };
  const debris = (x: number) => {
    // a crack in the ground, chips thrown out, separate puffs of dust — or
    // of embers, on anything that burns inside
    const puff = tier >= 3 ? PAL.flame : mix(PAL.sand, PAL.fog, 0.4);
    p.line(x - 7, F + 1, x + 7, F + 1, dk);
    p.line(x - 7, F + 1, x - 9, F - 1, dk); p.line(x + 7, F + 1, x + 9, F + 2, dk);
    for (const [dx, dy, r] of [[-9, -1, 2], [-4, -3, 1.5], [4, -3, 1.5], [9, -1, 2]]) p.ellipse(x + dx, F + dy, r, r * 0.8, withAlpha(puff, 0.8));
    for (const [dx, dy] of [[-8, -5], [7, -6], [-3, -8], [10, -3], [2, -9]]) p.fill(x + dx, F + dy, 2, 1, lt);
  };

  p.ellipse(cx, F + 1, 14, 3.4, 'rgba(10,8,16,0.38)');

  if (dir === 'right') {
    const bx = cx - 3 + Math.round(strike * 2) - (hurt ? 1 : 0) - (crouch > 0 ? 1 : 0);
    // far leg and far arm first, in shade
    const leg = (x: number, lift: number, c: string) => {
      stone(x, top + 21 - lift, 7, F - top - 23, c);
      stone(x - 1, F - 3 - lift, 9, 3, shade(c, 0.9));
    };
    leg(bx - 5, stepB * 2.5, sh);
    const farRest: [number, number] = [bx + 4, F - 1];
    const farF = strike > 0 ? lerp(strike, [bx - 7, top + 3], [bx + 9, F - 1]) : crouch > 0 ? lerp(Math.min(1, crouch), farRest, [bx - 7, top + 3]) : [farRest[0] - (pose.walk ? Math.sin(ph) * 2 : 0), farRest[1]] as [number, number];
    arm(bx - 1, top + 8, farF[0], farF[1], sh, 'side');
    // the hunched body: a back block high at the rear, the chest block
    // forward and lower, a belly stone under both
    stone(bx - 9, top + 5, 12, 11, st);
    stone(bx - 2, top + 8, 11, 12, st);
    stone(bx - 7, top + 15, 12, 7, sh);
    p.fill(bx - 8, top + 6, 1, 9, lt);
    p.line(bx - 6, top + 11, bx - 2, top + 13, dk);
    // the core, seen as a split in the flank
    p.line(bx + 3, top + 11, bx + 5, top + 16, shade(core, 0.7));
    p.line(bx + 4, top + 11, bx + 6, top + 16, core);
    p.set(bx + 5, top + 13, hot);
    leg(bx - 1 + Math.round(stepA * 2), stepA * 2.5, st);
    // head: forward, low, a block under a brow
    const hdX = bx + 9 + Math.round(strike * 2);
    const hdY = top + 6 + Math.round(crouch * 0.5) - (hurt ? 1 : 0);
    stone(hdX - 4, hdY - 3, 8, 7, shade(st, 1.05));
    p.fill(hdX - 5, hdY - 3, 1, 7, shade(dk, 0.7));
    p.fill(hdX - 4, hdY - 2, 8, 2, dk);
    p.fill(hdX, hdY, 3, 1, hurt ? dk : s.eye);
    if (!hurt) p.set(hdX + 2, hdY, hot);
    // boulder shoulder, as massive as it is from the front, and the near arm
    stone(bx - 3, top + 1, 11, 9, st);
    p.fill(bx - 2, top + 1, 8, 1, lt);
    const nearRest: [number, number] = [bx + 13, F - 3];
    const nearF = strike > 0 ? lerp(strike, [bx - 5, top + 2], [bx + 12, F - 1]) : crouch > 0 ? lerp(Math.min(1, crouch), nearRest, [bx - 5, top + 2]) : [nearRest[0] + (pose.walk ? Math.sin(ph) * 2 : 0), nearRest[1]] as [number, number];
    if (crouch > 0 || (strike > 0 && strike < 0.9)) {
      // swept back: a forearm block from the shoulder to the raised fist
      const [ex, ey] = lerp(0.5, [bx + 1, top + 4], [nearF[0], nearF[1] - 4]);
      stone(ex - 2, ey - 3, 5, 7, shade(st, 0.94));
      fist(nearF[0], nearF[1], st, 'side');
    } else arm(bx + 3, top + 7, nearF[0], nearF[1], st, 'side');
    if (tier === 0) { p.set(bx, top + 3, moss); p.set(bx + 2, top + 3, moss); p.set(bx - 6, top + 5, moss); p.set(bx - 5, top + 5, moss); }
    if (tier >= 1) { p.set(bx + 1, top + 6, withAlpha(core, 0.7)); p.set(bx + 4, top + 7, withAlpha(core, 0.7)); }
    if (tier >= 2) {
      spike(p, bx + 1, top + 3, 6, -1.5, shade(crystal, 0.75), crystalLit);
      spike(p, bx - 6, top + 5, 5, -2, shade(crystal, 0.75), crystalLit);
      spike(p, bx + 5, top + 3, 4, 0.5, crystal);
    }
    if (tier >= 3) {
      vein(bx - 6, top + 9, bx - 4, top + 12); vein(bx - 4, top + 12, bx - 5, top + 16);
      for (let i = 0; i < 3; i++) shard(hdX - 4 + Math.cos(ph + i * 2.1) * 9, hdY - 9 + Math.sin(ph + i * 2.1) * 2.5, i);
    }
    if (strike > 0.9) debris(bx + 12);
    return;
  }

  // front and back share the frame: legs, pelvis, torso, shoulders, arms, head
  const tx = cx + (hurt ? -1 : 0);
  for (const side of [-1, 1]) {
    const lift = (side < 0 ? stepA : stepB) * 2.5;
    const x = tx + side * 5 - 3;
    const c = side < 0 ? sh : shade(sh, 0.9);
    stone(x, top + 20 - lift, 7, F - top - 22, c);
    stone(x, F - 3 - lift, 7, 3, shade(c, 0.8));
    if (tier >= 3) vein(x + 3, top + 22 - lift, x + 4, F - 5 - lift);
  }
  stone(tx - 7, top + 18, 14, 4, dk);
  // chest block over the belly block: wide at the shoulders, narrower below
  p.poly([[tx - 10, top + 7], [tx + 10, top + 7], [tx + 9, top + 14], [tx - 9, top + 14]], st);
  p.poly([[tx - 8, top + 14], [tx + 8, top + 14], [tx + 7, top + 20], [tx - 7, top + 20]], shade(st, 0.92));
  p.fill(tx - 10, top + 7, 20, 1, lt);
  p.fill(tx - 9, top + 14, 18, 1, dk);
  p.poly([[tx + 6, top + 8], [tx + 10, top + 7], [tx + 9, top + 14], [tx + 6, top + 14]], sh);
  p.line(tx - 7, top + 9, tx - 4, top + 12, dk);
  p.line(tx + 3, top + 16, tx + 5, top + 19, dk);

  if (dir === 'down') {
    // the chest is split open around whatever keeps it moving
    p.poly([[tx, top + 8], [tx + 4, top + 12], [tx, top + 17], [tx - 4, top + 12]], shade(dk, 0.6));
    p.poly([[tx, top + 9], [tx + 3, top + 12], [tx, top + 16], [tx - 3, top + 12]], shade(core, 0.6));
    p.poly([[tx, top + 10], [tx + 2, top + 12], [tx, top + 15], [tx - 2, top + 12]], core);
    p.fill(tx - 1, top + 11, 2, 2 + (pulse > 0.8 ? 1 : 0), hot);
    const cr = pulse > 0.6 ? core : shade(core, 0.75);
    p.line(tx - 4, top + 12, tx - 7, top + 10, cr);
    p.line(tx + 4, top + 13, tx + 7, top + 16, cr);
    p.line(tx, top + 16, tx - 1, top + 19, cr);
  } else {
    // a spine of fitted stones down the back, moss in the joints
    for (let i = 0; i < 4; i++) stone(tx - 2, top + 7 + i * 3, 4, 3, i % 2 ? lt : sh);
    if (tier === 0) { p.set(tx - 3, top + 10, moss); p.set(tx + 2, top + 13, moss); p.set(tx - 3, top + 16, moss); }
  }

  // arms: knuckles on the ground at rest, both fists up over the head in the
  // wind-up, and down together in front on the slam
  for (const side of [-1, 1]) {
    const sX = tx + side * 11;
    const sY = top + 9;
    const rest: [number, number] = [tx + side * 13, F - 2];
    const up: [number, number] = [tx + side * 6, top + 2];
    const down: [number, number] = [tx + side * 6, F - 1];
    const swing = pose.walk ? Math.round(Math.sin(ph) * 1.5 * side) : 0;
    const f: [number, number] = strike > 0 ? lerp(strike, up, down) : crouch > 0 ? lerp(Math.min(1, crouch), rest, up) : [rest[0], rest[1] - Math.max(0, swing)];
    const c = side < 0 ? st : shade(st, 0.9);
    if (strike > 0 || crouch > 0) {
      // raised: an upper arm from the shoulder up and in, then the fist
      const [ex, ey] = lerp(0.5, [sX + side * 2, sY - 2], [f[0], f[1] - 4]);
      stone(sX - 3 + side * 2, sY - 7, 6, 8, c);
      stone(ex - 3, ey - 3, 6, 7, shade(c, 0.94));
      if (strike > 0 && strike < 0.9) {
        // coming down at the camera: the fists pass in front of the chest,
        // a shade brighter so they stay readable against it
        p.fill(Math.round(f[0] - 5.5), Math.round(f[1] - 7), 11, 9, PAL.ink);
        fist(f[0], f[1] + 1, shade(c, 1.18), 'front');
      } else fist(f[0], f[1], c, 'front');
    } else arm(sX, sY, f[0], f[1], c, 'front');
    // boulder shoulder
    stone(sX - 5, sY - 5, 10, 8, st);
    p.fill(sX - 4, sY - 5, 6, 1, lt);
    if (tier === 0) for (const [mx, my] of [[-2, -5], [0, -5], [1, -4], [-3, -4]]) p.set(sX + mx * side, sY + my, moss);
    if (tier >= 1) { p.set(sX - 2, sY - 1, withAlpha(core, 0.75)); p.set(sX + 1, sY, withAlpha(core, 0.75)); }
    if (tier >= 2) {
      spike(p, sX - side, sY - 5, 7, side * 1.5, shade(crystal, 0.75), crystalLit);
      if (tier === 2) spike(p, sX + side * 3, sY - 4, 4, side * 2.2, crystal);
    }
  }
  if (strike > 0.9) { debris(tx - 6); debris(tx + 6); }

  // head: sunk between the shoulders, a brow ridge and one lit slit
  const hdY = top + Math.round(crouch * 0.5) - (hurt ? 1 : 0) + (dir === 'up' ? 2 : 0);
  stone(tx - 4, hdY, 8, 8, shade(st, 0.95));
  if (dir === 'down') {
    p.fill(tx - 4, hdY + 2, 8, 2, dk);
    p.fill(tx - 3, hdY + 5, 6, 1, hurt ? dk : s.eye);
    if (!hurt) p.set(tx, hdY + 5, hot);
  } else {
    p.fill(tx - 3, hdY + 1, 6, 1, lt);
    if (tier === 0) { p.set(tx - 1, hdY + 1, moss); p.set(tx + 1, hdY + 2, moss); }
  }
  if (tier === 2) {
    spike(p, tx - 3, hdY + 1, 4, -1, shade(crystal, 0.75), crystalLit);
    spike(p, tx + 3, hdY + 1, 4, 1, crystal);
  } else if (tier >= 3) spike(p, tx, hdY, 5, 0, shade(crystal, 0.75), crystalLit);
  if (tier >= 3) {
    // veins along the seams between the blocks, not across them
    vein(tx - 8, top + 14, tx - 2, top + 14);
    vein(tx + 3, top + 7, tx + 3, top + 12);
    for (let i = 0; i < 3; i++) shard(tx + Math.cos(ph + i * 2.1) * 16, top - 1 + Math.sin(ph + i * 2.1) * 3, i);
  }
  if (hurt) for (const [dx, dy] of [[-13, -2], [12, 1], [-9, 6], [14, -6]]) p.set(tx + dx, top + 8 + dy, lt);
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
      if (tier >= 2) {
        // drowned and hollowed: moss hanging in ropes off the canopy
        for (const [mx, len] of [[-12, 9], [-7, 13], [-2, 7], [4, 11], [9, 8], [13, 12]]) {
          for (let k = 0; k < len; k++) p.set(cx + mx + Math.round(Math.sin(k * 0.6 + ph) * 0.8), top + 4 + k, k % 3 === 0 ? shade(s.accent, 0.6) : shade(s.accent, 0.8));
        }
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
