import type { DamageElement } from '../../data/enemies';
import type { GameMap } from '../world/map';
import type { Player } from '../player/player';
import type { Entity } from '../entities/entity';

export interface DamageOpts {
  element?: DamageElement;
  trueDamage?: boolean;
  trueDamageAmount?: number;
  /** Greek hit floor as a share of max HP, after armour but before guards,
   * wards and shields. Omitted by original enemies and player attacks. */
  minHealthDamage?: number;
  crit?: boolean;
  knockback?: number;
  /** Source position, used for knockback direction. */
  fromX?: number;
  fromY?: number;
  /** Suppresses on-hit effect procs (prevents recursion). */
  noProc?: boolean;
  label?: string;
}

export interface ProjectileSpec {
  trueDamageAmount?: number;
  /** Greek hit floor as a share of max HP, after armour but before guards,
   * wards and shields. Omitted by original enemies and player attacks. */
  minHealthDamage?: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  radius: number;
  range: number;
  element: DamageElement;
  color: string;
  friendly: boolean;
  pierce?: number;
  /** Explode on impact with this radius. */
  splash?: number;
  homing?: number;
  sprite?: 'bolt' | 'arrow' | 'orb' | 'shard' | 'spit';
  crit?: boolean;
  onHitEffects?: string[];
}

/** Everything an entity needs from the running game. */
export interface WorldCtx {
  map: GameMap;
  player: Player;
  /** Seconds since the session started (not wall clock). */
  now: number;
  dt: number;
  enemies: Entity[];
  damageEnemy(target: Entity, amount: number, opts?: DamageOpts): void;
  damagePlayer(amount: number, opts?: DamageOpts): void;
  spawnProjectile(spec: ProjectileSpec): void;
  particles(x: number, y: number, count: number, color: string, opts?: { speed?: number; life?: number; size?: number; gravity?: number; spread?: number; angle?: number }): void;
  floatText(x: number, y: number, text: string, color: string, size?: number): void;
  shake(amount: number): void;
  playSound(name: string, volume?: number): void;
  telegraph(x: number, y: number, r: number, duration: number, color: string, shape?: 'circle' | 'ring' | 'cone' | 'line', angle?: number, halfWidth?: number, coneHalfAngle?: number): void;
  summon(enemyId: string, x: number, y: number, level: number, lifetime?: number, friendly?: boolean): void;
  ringAt(x: number, y: number, r: number, color: string): void;
}
