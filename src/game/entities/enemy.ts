import { ENEMY_THREAT } from '../../data/balance';
import { ENEMY_BY_ID, type BossAttack, type EnemyDef } from '../../data/enemies';
import { angleTo, dirFromVector, dist, type Dir4, angleBetween } from '../core/math';
import type { WorldCtx } from '../core/world';
import { boxHitsTerrain } from '../world/map';
import { applyStatus, newEntityId, statusSpeedMul, type Entity, type StatusEffect } from './entity';

export type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'return' | 'dead';

export class Enemy implements Entity {
  id = newEntityId();
  def: EnemyDef;
  level: number;
  spawnId?: string;

  x: number;
  y: number;
  vx = 0;
  vy = 0;
  radius: number;
  dir: Dir4 = 'down';
  hp: number;
  maxHp: number;
  dead = false;
  flash = 0;
  anim = 'idle';
  animTime = 0;
  statuses: StatusEffect[] = [];
  knockX = 0;
  knockY = 0;

  state: AIState = 'idle';
  homeX: number;
  homeY: number;
  targetX = 0;
  targetY = 0;
  stateTime = 0;
  attackCd: number;
  windupTime = 0;
  windupAttack: BossAttack | null = null;
  elite: boolean;
  isBoss: boolean;
  phase = 0;
  alertTime = 0;
  wanderAngle = Math.random() * Math.PI * 2;
  damage: number;
  defense: number;
  xp: number;
  /** Summoned allies expire. */
  lifetime = Infinity;
  friendly = false;
  bossCooldowns: Record<string, number> = {};
  hurtTime = 0;
  stuckTimer = 0;

  constructor(defId: string, x: number, y: number, level: number, opts: { elite?: boolean; boss?: boolean; spawnId?: string; friendly?: boolean } = {}) {
    const def = ENEMY_BY_ID[defId] ?? ENEMY_BY_ID.wolf;
    this.def = def;
    this.level = Math.max(1, level);
    this.spawnId = opts.spawnId;
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
    this.radius = def.radius * (def.scale ?? 1);
    this.elite = !!opts.elite;
    this.isBoss = !!opts.boss || !!def.boss;
    this.friendly = !!opts.friendly;

    const lvScale = 1 + Math.max(0, this.level - def.level) * 0.17;
    const eliteMul = this.elite && !this.isBoss ? 2.1 : 1;
    const threat = ENEMY_THREAT;
    this.maxHp = Math.round(def.health * lvScale * eliteMul * threat.health);
    this.hp = this.maxHp;
    this.damage = def.damage * lvScale * (this.elite && !this.isBoss ? 1.3 : 1) * threat.damage;
    this.defense = def.defense * (1 + Math.max(0, this.level - def.level) * 0.1) * threat.defense;
    this.xp = Math.round(def.xp * lvScale * (this.elite ? 2.2 : 1) * threat.xp);
    this.attackCd = 0.4 + Math.random() * 0.6;
  }

  get displayName(): string {
    if (this.isBoss) return this.def.name;
    return this.elite ? `Elite ${this.def.name}` : this.def.name;
  }

  get speed(): number {
    const phaseMul = this.isBoss && this.def.boss ? this.def.boss.phases[this.phase].speed : 1;
    return this.def.speed * phaseMul * statusSpeedMul(this);
  }

  takeKnockback(fromX: number, fromY: number, force: number): void {
    if (this.isBoss) force *= 0.18;
    else if (this.elite) force *= 0.5;
    const a = angleTo(fromX, fromY, this.x, this.y);
    this.knockX += Math.cos(a) * force;
    this.knockY += Math.sin(a) * force;
  }

  private moveBy(ctx: WorldCtx, dx: number, dy: number): void {
    const map = ctx.map;
    const hw = this.radius * 0.7;
    const hh = this.radius * 0.5;
    if (!boxHitsTerrain(map, this.x + dx, this.y, hw, hh)) this.x += dx;
    else this.stuckTimer += ctx.dt;
    if (!boxHitsTerrain(map, this.x, this.y + dy, hw, hh)) this.y += dy;
    else this.stuckTimer += ctx.dt;
  }

  /** Steer toward a point, sliding around obstacles when a direct line is blocked. */
  private steer(ctx: WorldCtx, tx: number, ty: number, speedMul = 1): void {
    const a = angleTo(this.x, this.y, tx, ty);
    let dx = Math.cos(a);
    let dy = Math.sin(a);

    // separation from neighbours keeps packs readable
    let sx = 0;
    let sy = 0;
    for (const other of ctx.enemies as Enemy[]) {
      if (other === this || other.dead) continue;
      const d = dist(this.x, this.y, other.x, other.y);
      const min = this.radius + other.radius + 2;
      if (d < min && d > 0.01) {
        sx += (this.x - other.x) / d;
        sy += (this.y - other.y) / d;
      }
    }
    dx += sx * 0.55;
    dy += sy * 0.55;

    if (this.stuckTimer > 0.25) {
      // sidestep when we have been scraping a wall
      const perp = this.stuckTimer > 0.8 ? -1 : 1;
      dx += -Math.sin(a) * perp * 1.4;
      dy += Math.cos(a) * perp * 1.4;
      if (this.stuckTimer > 1.6) this.stuckTimer = 0;
    }

    const len = Math.hypot(dx, dy) || 1;
    const sp = this.speed * speedMul * ctx.dt;
    this.moveBy(ctx, (dx / len) * sp, (dy / len) * sp);
    this.dir = dirFromVector(dx, dy, this.dir);
    this.anim = 'walk';
  }

  private canSeePlayer(ctx: WorldCtx): boolean {
    const d = dist(this.x, this.y, ctx.player.x, ctx.player.y);
    const sight = this.def.sight * (this.alertTime > 0 ? 1.7 : 1);
    return d < sight;
  }

  private startAttack(ctx: WorldCtx): void {
    this.state = 'attack';
    this.stateTime = 0;
    this.anim = 'attack';
    this.animTime = 0;
    this.windupTime = this.def.windup;
    if (this.elite || this.isBoss) {
      const range = this.def.ranged ? 0 : this.def.attackRange + 26;
      if (range > 0) ctx.telegraph(this.x, this.y, range, this.def.windup, '#e8763a', 'circle');
    }
  }

  private landAttack(ctx: WorldCtx): void {
    const p = ctx.player;
    if (this.def.ranged) {
      const count = this.def.ranged.count ?? 1;
      const arc = this.def.ranged.arc ?? 0;
      const base = angleTo(this.x, this.y, p.x, p.y);
      for (let i = 0; i < count; i++) {
        const off = count === 1 ? 0 : (i / (count - 1) - 0.5) * arc;
        ctx.spawnProjectile({
          x: this.x, y: this.y - this.radius * 0.5,
          angle: base + off,
          speed: this.def.ranged.speed,
          damage: this.damage,
          radius: this.def.ranged.radius,
          range: this.def.attackRange * 1.4,
          element: this.def.ranged.element,
          color: this.def.ranged.color,
          friendly: false,
          sprite: this.def.ranged.element === 'physical' ? 'arrow' : 'bolt',
        });
      }
      ctx.playSound('shoot', 0.4);
    } else {
      const d = dist(this.x, this.y, p.x, p.y);
      if (d < this.def.attackRange + p.radius + this.radius * 0.4) {
        ctx.damagePlayer(this.damage, { element: this.def.element ?? 'physical', fromX: this.x, fromY: this.y, knockback: 90, label: this.displayName });
      }
      ctx.particles(this.x + (p.x - this.x) * 0.4, this.y + (p.y - this.y) * 0.4, 5, '#e8763a', { speed: 70, life: 0.25, size: 2 });
      ctx.playSound('swing', 0.35);
    }
  }

  /* ---------------- boss behaviour ---------------- */

  private updateBoss(ctx: WorldCtx): void {
    const boss = this.def.boss!;
    const frac = this.hp / this.maxHp;
    while (this.phase < boss.phases.length - 1 && frac <= boss.phases[this.phase + 1].at) {
      this.phase++;
      const ph = boss.phases[this.phase];
      if (ph.line) ctx.floatText(this.x, this.y - this.radius * 2.4, ph.line, '#f6bf5d', 15);
      ctx.shake(9);
      ctx.ringAt(this.x, this.y, 260, '#f6bf5d');
      ctx.particles(this.x, this.y, 46, '#f6bf5d', { speed: 210, life: 0.8, size: 4 });
      ctx.playSound('boss_phase', 0.6);
    }

    for (const k of Object.keys(this.bossCooldowns)) this.bossCooldowns[k] -= ctx.dt;

    if (this.windupAttack) return;

    const p = ctx.player;
    const d = dist(this.x, this.y, p.x, p.y);
    const usable = boss.attacks.filter((a) => (a.phase ?? 0) <= this.phase && (this.bossCooldowns[a.id] ?? 0) <= 0);
    if (usable.length && this.attackCd <= 0) {
      const inRange = usable.filter((a) => {
        if (a.shape === 'circle' || a.shape === 'cone') return d < (a.radius ?? 120) + 40;
        return true;
      });
      const pick = (inRange.length ? inRange : usable)[Math.floor(Math.random() * (inRange.length ? inRange.length : usable.length))];
      this.windupAttack = pick;
      this.windupTime = pick.windup;
      this.anim = pick.shape === 'summon' ? 'cast' : 'attack';
      this.animTime = 0;
      const dmgMul = boss.phases[this.phase].damage;
      void dmgMul;
      switch (pick.shape) {
        case 'circle':
          ctx.telegraph(this.x, this.y, pick.radius ?? 120, pick.windup, pick.color, 'circle');
          break;
        case 'ring':
          ctx.telegraph(this.x, this.y, pick.radius ?? 200, pick.windup, pick.color, 'circle');
          break;
        case 'cone':
          ctx.telegraph(this.x, this.y, pick.radius ?? 130, pick.windup, pick.color, 'cone', angleTo(this.x, this.y, p.x, p.y));
          break;
        case 'dash':
          ctx.telegraph(this.x, this.y, pick.range ?? 300, pick.windup, pick.color, 'line', angleTo(this.x, this.y, p.x, p.y));
          break;
        case 'rain':
          for (let i = 0; i < (pick.count ?? 4); i++) {
            const rx = p.x + (Math.random() - 0.5) * 260;
            const ry = p.y + (Math.random() - 0.5) * 260;
            ctx.telegraph(rx, ry, pick.radius ?? 70, pick.windup + i * 0.12, pick.color, 'circle');
          }
          break;
        default:
          break;
      }
      ctx.playSound('boss_windup', 0.4);
    }

    // movement between attacks
    if (d > this.def.attackRange * 1.2) this.steer(ctx, p.x, p.y, 0.9);
    else {
      this.anim = 'idle';
      this.dir = dirFromVector(p.x - this.x, p.y - this.y, this.dir);
    }
  }

  private resolveBossAttack(ctx: WorldCtx): void {
    const a = this.windupAttack!;
    const boss = this.def.boss!;
    const p = ctx.player;
    const dmg = this.damage * a.power * boss.phases[this.phase].damage;
    const angle = angleTo(this.x, this.y, p.x, p.y);

    switch (a.shape) {
      case 'circle':
      case 'ring': {
        const r = a.radius ?? 140;
        ctx.ringAt(this.x, this.y, r, a.color);
        ctx.shake(a.shape === 'ring' ? 12 : 7);
        ctx.particles(this.x, this.y, 34, a.color, { speed: 240, life: 0.6, size: 4 });
        if (dist(this.x, this.y, p.x, p.y) < r + p.radius) {
          ctx.damagePlayer(dmg, { element: a.element, fromX: this.x, fromY: this.y, knockback: 220, label: a.name });
        }
        break;
      }
      case 'cone': {
        const r = a.radius ?? 130;
        const d = dist(this.x, this.y, p.x, p.y);
        if (d < r + p.radius && angleBetween(angle, angleTo(this.x, this.y, p.x, p.y)) < 0.65) {
          ctx.damagePlayer(dmg, { element: a.element, fromX: this.x, fromY: this.y, knockback: 160, label: a.name });
        }
        ctx.particles(this.x + Math.cos(angle) * r * 0.5, this.y + Math.sin(angle) * r * 0.5, 22, a.color, { speed: 200, life: 0.45, size: 3, angle, spread: 1.2 });
        ctx.shake(5);
        break;
      }
      case 'projectile': {
        const count = a.count ?? 5;
        for (let i = 0; i < count; i++) {
          const off = (i / Math.max(1, count - 1) - 0.5) * 0.9;
          ctx.spawnProjectile({
            x: this.x, y: this.y - this.radius * 0.6,
            angle: angle + off,
            speed: 260,
            damage: dmg,
            radius: 26,
            range: a.range ?? 500,
            element: a.element,
            color: a.color,
            friendly: false,
            sprite: a.element === 'physical' ? 'shard' : 'bolt',
          });
        }
        break;
      }
      case 'dash': {
        const range = a.range ?? 300;
        const tx = this.x + Math.cos(angle) * range;
        const ty = this.y + Math.sin(angle) * range;
        if (!boxHitsTerrain(ctx.map, tx, ty, this.radius, this.radius * 0.6)) {
          ctx.particles(this.x, this.y, 24, a.color, { speed: 150, life: 0.5, size: 4 });
          this.x = tx;
          this.y = ty;
          ctx.particles(this.x, this.y, 24, a.color, { speed: 150, life: 0.5, size: 4 });
        }
        if (dist(this.x, this.y, p.x, p.y) < 70) {
          ctx.damagePlayer(dmg, { element: a.element, fromX: this.x, fromY: this.y, knockback: 200, label: a.name });
        }
        ctx.shake(6);
        break;
      }
      case 'rain': {
        for (let i = 0; i < (a.count ?? 4); i++) {
          const rx = p.x + (Math.random() - 0.5) * 220;
          const ry = p.y + (Math.random() - 0.5) * 220;
          ctx.ringAt(rx, ry, a.radius ?? 70, a.color);
          ctx.particles(rx, ry, 16, a.color, { speed: 170, life: 0.5, size: 3 });
          if (dist(rx, ry, p.x, p.y) < (a.radius ?? 70) + p.radius) {
            ctx.damagePlayer(dmg * 0.7, { element: a.element, fromX: rx, fromY: ry, knockback: 90, label: a.name });
          }
        }
        ctx.shake(7);
        break;
      }
      case 'summon': {
        const n = a.count ?? 2;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2;
          ctx.summon(a.summon ?? 'skeleton', this.x + Math.cos(ang) * 90, this.y + Math.sin(ang) * 90, this.level - 2);
        }
        ctx.floatText(this.x, this.y - this.radius * 2, a.name, a.color, 13);
        break;
      }
    }

    this.bossCooldowns[a.id] = a.cooldown;
    this.attackCd = 1.1;
    this.windupAttack = null;
    ctx.playSound('boss_hit', 0.5);
  }

  /* ---------------- main update ---------------- */

  update(ctx: WorldCtx): void {
    const dt = ctx.dt;
    if (this.dead) return;

    this.flash = Math.max(0, this.flash - dt * 4);
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.attackCd -= dt;
    this.alertTime = Math.max(0, this.alertTime - dt);
    this.animTime += dt;
    this.stuckTimer = Math.max(0, this.stuckTimer - dt * 0.35);
    if (this.lifetime !== Infinity) {
      this.lifetime -= dt;
      if (this.lifetime <= 0) {
        this.dead = true;
        ctx.particles(this.x, this.y, 18, '#9578e8', { speed: 90, life: 0.6, size: 3 });
        return;
      }
    }

    // status damage
    for (let i = this.statuses.length - 1; i >= 0; i--) {
      const s = this.statuses[i];
      if (ctx.now > s.until) { this.statuses.splice(i, 1); continue; }
      if (s.kind === 'burn' || s.kind === 'poison' || s.kind === 'bleed') {
        s.tick = (s.tick ?? 0) + dt;
        if (s.tick >= 0.5) {
          s.tick = 0;
          ctx.damageEnemy(this, s.power * 0.5, { element: s.kind === 'burn' ? 'fire' : 'poison', noProc: true });
          ctx.particles(this.x, this.y - this.radius, 2, s.color, { speed: 30, life: 0.4, size: 2, gravity: -40 });
        }
      }
    }
    if (this.dead) return;

    // knockback
    if (Math.abs(this.knockX) > 1 || Math.abs(this.knockY) > 1) {
      this.moveBy(ctx, this.knockX * dt, this.knockY * dt);
      this.knockX *= 1 - Math.min(1, 9 * dt);
      this.knockY *= 1 - Math.min(1, 9 * dt);
    }

    if (this.statuses.some((s) => s.kind === 'stun')) {
      this.anim = 'hurt';
      return;
    }

    // windup resolution
    if (this.windupTime > 0) {
      this.windupTime -= dt;
      this.anim = this.windupAttack?.shape === 'summon' ? 'cast' : 'attack';
      if (this.windupTime <= 0) {
        if (this.windupAttack) this.resolveBossAttack(ctx);
        else {
          this.landAttack(ctx);
          this.attackCd = this.def.attackCooldown * (0.85 + Math.random() * 0.3);
          this.state = 'chase';
        }
      }
      return;
    }

    if (this.friendly) {
      this.updateFriendly(ctx);
      return;
    }

    if (this.isBoss && this.def.boss) {
      this.updateBoss(ctx);
      return;
    }

    const p = ctx.player;
    const d = dist(this.x, this.y, p.x, p.y);
    const sees = !p.dead && this.canSeePlayer(ctx);

    if (this.def.flee && this.hp / this.maxHp < this.def.flee && this.state !== 'flee') {
      this.state = 'flee';
      this.stateTime = 0;
      ctx.floatText(this.x, this.y - this.radius * 2, 'Fleeing!', '#f6bf5d', 11);
    }

    this.stateTime += dt;
    switch (this.state) {
      case 'idle':
      case 'patrol': {
        this.anim = 'idle';
        if (sees) {
          this.state = 'chase';
          this.alertTime = 4;
          ctx.floatText(this.x, this.y - this.radius * 2, '!', '#f45b5b', 14);
          if (this.def.pack) {
            for (const o of ctx.enemies as Enemy[]) {
              if (o !== this && !o.dead && o.def.id === this.def.id && dist(o.x, o.y, this.x, this.y) < 240 && o.state === 'idle') {
                o.state = 'chase';
                o.alertTime = 4;
              }
            }
          }
          break;
        }
        if (this.stateTime > 2.2) {
          this.stateTime = 0;
          this.wanderAngle += (Math.random() - 0.5) * 2.4;
          this.state = Math.random() < 0.55 ? 'patrol' : 'idle';
        }
        if (this.state === 'patrol') {
          const tx = this.x + Math.cos(this.wanderAngle) * 40;
          const ty = this.y + Math.sin(this.wanderAngle) * 40;
          if (dist(this.homeX, this.homeY, tx, ty) < 170) this.steer(ctx, tx, ty, 0.35);
          else this.wanderAngle += Math.PI;
        }
        break;
      }
      case 'chase': {
        if (!sees && this.alertTime <= 0) {
          this.state = 'return';
          this.stateTime = 0;
          break;
        }
        if (dist(this.homeX, this.homeY, this.x, this.y) > 800 && !this.isBoss) {
          this.state = 'return';
          break;
        }
        const wantRange = this.def.ranged ? this.def.attackRange * 0.72 : this.def.attackRange * 0.8;
        if (d > wantRange) this.steer(ctx, p.x, p.y);
        else if (this.def.ranged && d < this.def.attackRange * 0.42) {
          this.steer(ctx, this.x * 2 - p.x, this.y * 2 - p.y, 0.8);
        } else {
          this.anim = 'idle';
          this.dir = dirFromVector(p.x - this.x, p.y - this.y, this.dir);
        }
        if (d < this.def.attackRange && this.attackCd <= 0) this.startAttack(ctx);
        break;
      }
      case 'flee': {
        this.steer(ctx, this.x * 2 - p.x, this.y * 2 - p.y, 1.15);
        if (this.stateTime > 3.5 || d > this.def.sight * 1.4) {
          this.state = 'return';
          this.stateTime = 0;
          this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.15);
        }
        break;
      }
      case 'return': {
        if (sees && this.hp / this.maxHp > (this.def.flee ?? 0)) { this.state = 'chase'; break; }
        if (dist(this.x, this.y, this.homeX, this.homeY) < 24) {
          this.state = 'idle';
          this.stateTime = 0;
          this.anim = 'idle';
        } else this.steer(ctx, this.homeX, this.homeY, 0.6);
        break;
      }
      default:
        break;
    }
  }

  /** Summoned allies hunt the nearest enemy instead of the player. */
  private updateFriendly(ctx: WorldCtx): void {
    let best: Enemy | null = null;
    let bestD = 420;
    for (const e of ctx.enemies as Enemy[]) {
      if (e === this || e.dead || e.friendly) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) {
      const p = ctx.player;
      if (dist(this.x, this.y, p.x, p.y) > 70) this.steer(ctx, p.x, p.y, 0.9);
      else this.anim = 'idle';
      return;
    }
    if (bestD > this.def.attackRange * 0.8) this.steer(ctx, best.x, best.y);
    else {
      this.anim = 'idle';
      this.dir = dirFromVector(best.x - this.x, best.y - this.y, this.dir);
      if (this.attackCd <= 0) {
        this.attackCd = this.def.attackCooldown;
        this.anim = 'attack';
        this.animTime = 0;
        ctx.damageEnemy(best, this.damage, { element: this.def.element ?? 'physical', fromX: this.x, fromY: this.y, knockback: 60, noProc: true });
      }
    }
  }

  applyStatusFrom(kind: 'burn' | 'poison' | 'chill' | 'stun' | 'bleed', power: number, duration: number, color: string, now: number): void {
    if (this.isBoss && kind === 'stun') return;
    applyStatus(this, kind, power, duration, color, now);
  }
}
