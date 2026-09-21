import type { Entity } from '../entities/entity';

export type PhysicalAttackKind = 'claw' | 'spear' | 'hammer' | 'fang' | 'shield' | 'tendril' | 'boulder' | 'bow' | 'spit' | 'wing' | 'hoof' | 'gaze' | 'blade' | 'chain';
export type PhysicalProjectileKind = 'boulder' | 'spear' | 'fang' | 'feather' | 'net' | 'chain' | 'note' | 'ember' | 'shield' | 'venom';
export interface PhysicalAttackCue {
  source?: Entity;
  /** Explicit follow for held enemy weapons; committed player strike positions stay fixed. */
  followSource?: boolean;
  isActive?: () => boolean;
  x: number;
  y: number;
  angle: number;
  reach: number;
  duration: number;
  kind: PhysicalAttackKind;
  phase: 'prepare' | 'strike';
  color: string;
  sweepAngle?: number;
  /** Repeated visible swings are separate contacts, never remote echoes. */
  swings?: number;
}
export interface LivePhysicalCue extends PhysicalAttackCue { elapsed: number; }
export function physicalOrigin(source: Pick<Entity, 'x' | 'y' | 'radius'>): { x: number; y: number } {
  return { x: source.x, y: source.y - Math.min(28, source.radius * .5) };
}
/** Shared by rendering and enemy collision so the visible moving weapon owns its hit. */
export function physicalPose(cue: PhysicalAttackCue, elapsed: number): { angle: number; reach: number; progress: number; pass: number } {
  const cycles = cue.swings ?? 1;
  const total = Math.min(.999999, Math.max(0, elapsed / Math.max(.01, cue.duration))) * cycles;
  const pass = Math.floor(total), progress = total - pass;
  const directed = cue.kind === 'gaze' || cue.kind === 'spit' || cue.kind === 'bow';
  const thrust = directed || (['spear', 'fang', 'shield', 'tendril'].includes(cue.kind) && (cue.sweepAngle ?? 0) <= .6);
  const angle = cue.angle + (thrust ? 0 : (progress - .5) * (cue.sweepAngle ?? 1.35) * (pass % 2 ? -1 : 1));
  const reach = cue.reach * (thrust ? .18 + .82 * Math.sin(progress * Math.PI) : .84 + .16 * Math.sin(progress * Math.PI));
  return { angle, reach, progress, pass };
}

/** Tangible held weapons, jaws and limbs. No danger discs, rectangles or filled sectors. */
export function drawPhysicalAttack(g: CanvasRenderingContext2D, cue: LivePhysicalCue): void {
  if (cue.source?.dead || cue.isActive?.() === false) return;
  const origin = cue.source && cue.followSource ? physicalOrigin(cue.source) : cue;
  const t = Math.min(1, cue.elapsed / Math.max(.01, cue.duration));
  const pose = physicalPose(cue, cue.elapsed);
  const preparing = cue.phase === 'prepare';
  const angle = preparing ? cue.angle - (cue.kind === 'hammer' ? .8 : .12 * (1 - t)) : pose.angle;
  const reach = preparing ? Math.min(cue.reach, 25 + t * 13) : pose.reach;
  g.save(); g.translate(origin.x, origin.y); g.rotate(angle);
  g.globalAlpha = preparing ? .8 + t * .2 : Math.min(1, (1 - t) * 5);
  const outline = '#27262d', bone = '#eee1b9', wood = '#795336';
  g.lineCap = 'round'; g.lineJoin = 'round';
  const stroke = (points: number[][], color: string, width: number) => {
    g.strokeStyle = color; g.lineWidth = width; g.beginPath();
    points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  };
  const poly = (points: number[][], color: string) => {
    g.fillStyle = color; g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
  };
  if (cue.kind === 'blade') {
    stroke([[0, 0], [15, 0]], wood, 5);
    poly([[12, -4], [reach - 9, -5], [reach + 5, 0], [reach - 9, 5], [12, 4]], '#dbd5c6');
    stroke([[12, -9], [12, 9]], '#c5a365', 3);
    stroke([[18, -2], [reach - 7, -2]], '#fff0c6', 1);
  } else if (cue.kind === 'chain') {
    stroke([[0, 0], [reach, 0]], outline, 3);
    for (let link = 5; link < reach; link += 8) { g.strokeStyle = '#b3aaa0'; g.lineWidth = 2; g.beginPath(); g.ellipse(link, Math.sin(link * .05 + t * 4) * 3, 5, 3, 0, 0, Math.PI * 2); g.stroke(); }
    poly([[reach - 5, -6], [reach + 13, 0], [reach - 5, 6]], bone);
  } else if (cue.kind === 'spear') {
    stroke([[-12, 0], [reach - 12, 0]], outline, 6); stroke([[-12, 0], [reach - 12, 0]], wood, 3);
    poly([[reach + 5, 0], [reach - 14, -5], [reach - 10, 0], [reach - 14, 5]], bone);
  } else if (cue.kind === 'bow') {
    stroke([[5, -17], [14, -10], [18, 0], [14, 10], [5, 17]], wood, 4);
    stroke([[5, -17], [preparing ? -5 - t * 8 : 5, 0], [5, 17]], bone, 1);
    stroke([[-14, 0], [30, 0]], wood, 2); poly([[34, 0], [26, -3], [26, 3]], bone);
  } else if (cue.kind === 'hammer' || cue.kind === 'hoof') {
    stroke([[0, 0], [reach - 5, 0]], outline, 8); stroke([[0, 0], [reach - 5, 0]], wood, 5);
    poly([[reach - 16, -13], [reach + 7, -11], [reach + 9, 10], [reach - 13, 13]], cue.kind === 'hoof' ? '#775f50' : '#a5a6a0');
    stroke([[reach - 12, -10], [reach + 4, -9]], bone, 2);
  } else if (cue.kind === 'shield') {
    stroke([[0, 0], [reach - 8, 0]], '#a78159', 8);
    poly([[reach - 10, -18], [reach + 3, -12], [reach + 5, 12], [reach - 10, 19], [reach - 17, 5], [reach - 17, -9]], '#c99852');
    stroke([[reach - 11, -10], [reach - 4, 0], [reach - 11, 10]], bone, 3);
  } else if (cue.kind === 'boulder') {
    const r = preparing ? 14 + t * 3 : 16;
    poly([[reach - r, -8], [reach - r * .4, -r], [reach + r * .7, -r * .8], [reach + r, 4], [reach + 5, r], [reach - r, 9]], '#887967');
    stroke([[reach - 8, -7], [reach + 2, -10], [reach + 8, -3]], '#c4b8a0', 3);
  } else if (cue.kind === 'tendril') {
    const sway = preparing ? 8 : Math.sin(pose.progress * Math.PI) * 7;
    stroke([[0, 0], [reach * .35, sway], [reach * .7, -sway], [reach, 0]], outline, 9);
    stroke([[0, 0], [reach * .35, sway], [reach * .7, -sway], [reach, 0]], cue.color, 6);
    for (let n = 1; n < 5; n++) { g.fillStyle = bone; g.fillRect(reach * n / 5, -2, 3, 3); }
  } else if (cue.kind === 'gaze') {
    stroke([[0, -4], [reach * .45, -2], [reach, 0]], '#dfdba7', preparing ? 2 : 5);
    stroke([[0, 4], [reach * .45, 2], [reach, 0]], '#f5f0cd', 2);
  } else if (cue.kind === 'wing') {
    poly([[0, 0], [reach * .45, -19], [reach, -12], [reach * .74, -4], [reach * .91, 2], [reach * .61, 4], [reach * .68, 13], [reach * .25, 11]], cue.color);
    stroke([[2, 0], [reach * .53, -5], [reach * .9, -10]], bone, 2);
  } else if (cue.kind === 'spit') {
    for (const [dx, dy, r] of [[0, 0, 7], [10, -4, 4], [12, 5, 3]]) { g.fillStyle = cue.color; g.beginPath(); g.ellipse(reach + dx, dy, r, r * .65, 0, 0, Math.PI * 2); g.fill(); }
  } else {
    stroke([[0, 0], [reach - 13, 0]], cue.color, cue.kind === 'fang' ? 8 : 6);
    for (const offset of [-8, 0, 8]) poly([[reach - 15, offset - 3], [reach + 8, offset], [reach - 10, offset + 4]], bone);
  }
  g.restore();
}
