import type { NpcDef } from '../../data/npcs';
import { dirFromVector, dist, type Dir4 } from '../core/math';
import { TILE } from '../world/tiles';
import { boxHitsTerrain, type GameMap } from '../world/map';
import { newEntityId, type Entity, type StatusEffect } from './entity';

export class NpcEntity implements Entity {
  id = newEntityId();
  def: NpcDef;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  radius = 11;
  dir: Dir4 = 'down';
  hp = 100;
  maxHp = 100;
  dead = false;
  flash = 0;
  anim = 'idle';
  animTime = 0;
  statuses: StatusEffect[] = [];
  knockX = 0;
  knockY = 0;

  /** Where this NPC currently wants to be. */
  destX: number;
  destY: number;
  anchorX: number;
  anchorY: number;
  scheduleLabel = '';
  idleTimer = 0;
  speed = 42;
  talking = false;

  constructor(def: NpcDef) {
    this.def = def;
    this.x = def.tx * TILE + TILE / 2;
    this.y = def.ty * TILE + TILE / 2;
    this.anchorX = this.x;
    this.anchorY = this.y;
    this.destX = this.x;
    this.destY = this.y;
  }

  /** Move the anchor point according to the NPC's daily schedule. */
  updateSchedule(hour: number): void {
    const sched = this.def.schedule;
    if (!sched || sched.length === 0) return;
    let current = sched[sched.length - 1];
    for (const leg of sched) {
      if (hour >= leg.at) current = leg;
    }
    // before the first leg of the day, use the last leg of the previous day
    if (hour < sched[0].at) current = sched[sched.length - 1];
    this.anchorX = current.tx * TILE + TILE / 2;
    this.anchorY = current.ty * TILE + TILE / 2;
    this.scheduleLabel = current.label;
  }

  update(dt: number, map: GameMap, playerX: number, playerY: number): void {
    this.animTime += dt;
    if (this.talking) {
      this.anim = 'idle';
      this.dir = dirFromVector(playerX - this.x, playerY - this.y, this.dir);
      return;
    }

    const wander = this.def.wander ?? 0;
    const toAnchor = dist(this.x, this.y, this.anchorX, this.anchorY);

    if (toAnchor > Math.max(40, wander)) {
      this.walkTo(dt, map, this.anchorX, this.anchorY, 1);
      return;
    }

    this.idleTimer -= dt;
    if (this.idleTimer <= 0) {
      this.idleTimer = 2 + Math.random() * 4;
      if (wander > 0 && Math.random() < 0.7) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * wander;
        this.destX = this.anchorX + Math.cos(a) * r;
        this.destY = this.anchorY + Math.sin(a) * r;
      } else {
        this.destX = this.x;
        this.destY = this.y;
      }
    }

    if (dist(this.x, this.y, this.destX, this.destY) > 5) this.walkTo(dt, map, this.destX, this.destY, 0.75);
    else this.anim = 'idle';
  }

  private walkTo(dt: number, map: GameMap, tx: number, ty: number, mul: number): void {
    const a = Math.atan2(ty - this.y, tx - this.x);
    const sp = this.speed * mul * dt;
    const dx = Math.cos(a) * sp;
    const dy = Math.sin(a) * sp;
    let moved = false;
    if (!boxHitsTerrain(map, this.x + dx, this.y, 8, 5)) { this.x += dx; moved = true; }
    if (!boxHitsTerrain(map, this.x, this.y + dy, 8, 5)) { this.y += dy; moved = true; }
    if (!moved) {
      this.destX = this.x;
      this.destY = this.y;
      this.idleTimer = 1.2;
    }
    this.dir = dirFromVector(dx, dy, this.dir);
    this.anim = moved ? 'walk' : 'idle';
  }
}
