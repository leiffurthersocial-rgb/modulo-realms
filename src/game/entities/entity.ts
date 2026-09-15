import type { Dir4 } from '../core/math';

export type StatusKind = 'burn' | 'poison' | 'chill' | 'stun' | 'bleed';

export interface StatusEffect {
  kind: StatusKind;
  /** Damage per second, or slow fraction for chill. */
  power: number;
  until: number;
  tick?: number;
  color: string;
}

export interface Entity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  dir: Dir4;
  hp: number;
  maxHp: number;
  dead: boolean;
  /** Seconds remaining of the hit flash. */
  flash: number;
  /** Animation state driver. */
  anim: string;
  animTime: number;
  statuses: StatusEffect[];
  knockX: number;
  knockY: number;
}

let nextId = 1;
export const newEntityId = (): number => nextId++;
export const resetEntityIds = (): void => { nextId = 1; };

export function applyStatus(e: Entity, kind: StatusKind, power: number, duration: number, color: string, now: number): void {
  const existing = e.statuses.find((s) => s.kind === kind);
  if (existing) {
    existing.power = Math.max(existing.power, power);
    existing.until = Math.max(existing.until, now + duration);
  } else {
    e.statuses.push({ kind, power, until: now + duration, tick: 0, color });
  }
}

export const hasStatus = (e: Entity, kind: StatusKind): boolean => e.statuses.some((s) => s.kind === kind);

export function statusSpeedMul(e: Entity): number {
  let mul = 1;
  for (const s of e.statuses) {
    if (s.kind === 'chill') mul *= 1 - s.power;
    if (s.kind === 'stun') mul = 0;
  }
  return mul;
}
