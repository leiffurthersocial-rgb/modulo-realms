import {
  ENEMY_THREAT, REGION_BOSS_DIFFICULTY, REGION_DIFFICULTY,
  enemyDamageAt, enemyHealthAt, enemyXpAt,
} from '../../data/balance';
import { ENEMY_BY_ID, type BossAttack, type BossPhase, type EnemyDef } from '../../data/enemies';
import { aegeanBossHealthCap, aegeanMinimumHit } from '../../data/aegean/damage';
import { angleTo, dirFromVector, dist, type Dir4, angleBetween } from '../core/math';
import type { WorldCtx } from '../core/world';
import { physicalOrigin, physicalPose, type PhysicalAttackCue } from '../combat/physical';
import { boxHitsTerrain, findOpenNear, type MovementProfile } from '../world/map';
import { applyStatus, newEntityId, statusSpeedMul, type Entity, type StatusEffect } from './entity';

type PhysicalMotion = { attack: BossAttack; cue: PhysicalAttackCue; travel: boolean; elapsed: number; duration: number; distance: number; travelled: number; startX: number; startY: number; hitPasses: Set<number>; anyHit: boolean };

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
  /** Seconds this boss has been in combat, for the enrage clock. */
  fightTime = 0;
  /** When the hit-cap notice last printed, so it explains rather than spams. */
  wardShown = -99;
  windupTime = 0;
  windupAttack: BossAttack | null = null;
  /** Committed aim/path; Greek attacks retain it while their body or object travels. */
  attackGeometry: { x: number; y: number; angle: number; range: number; points: Array<{ x: number; y: number }> } | null = null;
  private physicalMotion: PhysicalMotion | null = null;
  lastImpact: { id: string; x: number; y: number; at: number; angle: number } | null = null;
  /** Authored encounters own tactics; status ticks and committed attacks still run. */
  scripted = false;
  tacticTime = 2;
  tacticUses = 0;
  guardUntil = 0;
  /** Explicit spawn context chooses navigation; land variants remain on foot. */
  movementProfile: MovementProfile = 'foot';
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
  /** The danger multiplier of the region it was spawned in. */
  regionMul = 1;
  /** The same, softened, for what it hits for. See the constructor. */
  regionDmgMul = 1;
  /**
   * Immune-phase state. `immuneUntil` is the hard ceiling; when a phase warded
   * itself behind adds, `immuneAdds` holds them and the ward drops the moment
   * they are all down, whichever comes first.
   */
  immuneUntil = 0;
  immuneAdds: Entity[] = [];
  immuneLabel = '';
  hurtTime = 0;
  stuckTimer = 0;
  /**
   * Local avoidance. A creature that meets water or a wall picks a side to go
   * round and keeps it for a moment instead of re-deciding every frame, which
   * is what used to leave wolves shivering against a riverbank.
   */
  private detourSide = 0;
  private detourUntil = 0;
  /** Progress watchdog: where it was when the window opened, and how many windows it has wasted. */
  private progressX = NaN;
  private progressY = NaN;
  private progressTime = 0;
  private stalls = 0;
  private unstuckChecked = false;

  constructor(defId: string, x: number, y: number, level: number, opts: { elite?: boolean; boss?: boolean; spawnId?: string; friendly?: boolean; region?: string } = {}) {
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

    // Where it stands is part of what it is. A bog crawler and a Cinderwastes
    // crawler are the same creature on paper and not the same fight, and
    // bosses take their own multiplier so that a starter region can still
    // keep something frightening at the bottom of it.
    const regionKey = opts.region ?? def.region ?? 'central';
    this.regionMul = this.isBoss
      ? (REGION_BOSS_DIFFICULTY[regionKey] ?? 1)
      : (REGION_DIFFICULTY[regionKey] ?? 1);
    /**
     * A region's danger applies in full to how long a thing takes to kill, and
     * only partly to how hard it hits.
     *
     * Applied whole to both, the Emberdeep's 2.8 put an ordinary blow at 77%
     * of a well-armoured character's health — every trash mob a one-shot, and
     * a fight you lose to the first thing you did not see rather than to the
     * fight. Health is the honest place to spend difficulty: it makes an
     * encounter long and demanding without making it random. Damage still
     * climbs, just at a rate that leaves room to make one mistake.
     */
    this.regionDmgMul = 1 + (this.regionMul - 1) * 0.6;

    /**
     * Spawning an enemy above its authored level used to multiply its numbers
     * by `1 + 0.17 per level`, a flat share of what the bestiary wrote down.
     * The health curve is nothing like flat — it is quadratic in level,
     * because the player's damage is — so a level-6 bandit put on a level-24
     * road came out at four times its book value when it needed eight, and
     * every re-used enemy got quietly weaker the further from home it was
     * placed.
     *
     * Scaling by the RATIO OF THE CURVE at the two levels makes the bestiary's
     * numbers a shape and the level the dial: any enemy can now be spawned at
     * any level and be worth exactly what an enemy authored for that level is
     * worth. That is what lets one bestiary cover a seventy-five level game.
     */
    const role = def.role;
    const from = Math.max(1, def.level);
    const hpScale = enemyHealthAt(this.level, role) / enemyHealthAt(from, role);
    const dmgScale = enemyDamageAt(this.level, role) / enemyDamageAt(from, role);
    const xpScale = enemyXpAt(this.level, role) / enemyXpAt(from, role);
    // An enemy the data already calls elite is priced as one. Only an
    // ordinary enemy promoted to elite by a spawn roll gets the multiplier —
    // applying it to a named miniboss counted its eliteness twice and gave it
    // a boss's health bar.
    const promoted = this.elite && !this.isBoss && !def.elite;
    const threat = ENEMY_THREAT;
    this.maxHp = Math.round(def.health * hpScale * this.regionMul * (promoted ? 2.6 : 1));
    if (this.isBoss && def.id.startsWith('aegean_')) this.maxHp = Math.min(aegeanBossHealthCap(def.id), this.maxHp);
    this.hp = this.maxHp;
    this.damage = def.damage * dmgScale * this.regionDmgMul * (promoted ? 1.3 : 1) * threat.damage;
    this.defense = def.defense * (this.level / from);
    this.xp = Math.round(def.xp * xpScale * (promoted ? 2.2 : 1) * threat.xp);
    this.attackCd = 0.4 + Math.random() * 0.6;
  }

  get displayName(): string {
    if (this.isBoss) return this.def.name;
    return this.elite ? `Elite ${this.def.name}` : this.def.name;
  }

  get speed(): number {
    const phaseMul = this.isBoss && this.def.boss ? (this.def.boss.phases[this.phase]?.speed ?? 1) : 1;
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
    if (!boxHitsTerrain(map, this.x + dx, this.y, hw, hh, this.movementProfile)) this.x += dx;
    else this.stuckTimer += ctx.dt;
    if (!boxHitsTerrain(map, this.x, this.y + dy, hw, hh, this.movementProfile)) this.y += dy;
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

    // Feel ahead. If the way is shut, swing the heading round in widening
    // steps to the side already chosen (or the freer side, the first time),
    // and hold that side for a while so it walks round the obstacle rather
    // than twitching against it.
    const hw = this.radius * 0.7;
    const hh = this.radius * 0.5;
    const look = this.radius + 12;
    const heading = Math.atan2(dy, dx);
    const blocked = (ang: number) => boxHitsTerrain(ctx.map, this.x + Math.cos(ang) * look, this.y + Math.sin(ang) * look, hw, hh, this.movementProfile);
    if (blocked(heading)) {
      if (ctx.now > this.detourUntil || this.detourSide === 0) {
        const left = [0.5, 1, 1.5].filter((o) => !blocked(heading - o)).length;
        const right = [0.5, 1, 1.5].filter((o) => !blocked(heading + o)).length;
        this.detourSide = right > left ? 1 : right < left ? -1 : (this.id % 2 ? 1 : -1);
      }
      this.detourUntil = ctx.now + 0.9;
      let chosen = heading;
      for (const o of [0.45, 0.9, 1.35, 1.8, 2.3, 2.8]) {
        const cand = heading + o * this.detourSide;
        if (!blocked(cand)) { chosen = cand; break; }
        const other = heading - o * this.detourSide;
        if (o >= 1.8 && !blocked(other)) { chosen = other; this.detourSide = -this.detourSide; break; }
      }
      dx = Math.cos(chosen);
      dy = Math.sin(chosen);
    } else if (ctx.now < this.detourUntil && this.detourSide !== 0) {
      // still rounding the corner: bias a little to the chosen side
      const bias = heading + 0.35 * this.detourSide;
      if (!blocked(bias)) { dx = Math.cos(bias); dy = Math.sin(bias); }
    }

    if (this.stuckTimer > 0.6) {
      // scraping a wall regardless: slide along it
      dx += -Math.sin(a) * (this.detourSide || 1) * 1.2;
      dy += Math.cos(a) * (this.detourSide || 1) * 1.2;
      if (this.stuckTimer > 1.6) this.stuckTimer = 0;
    }

    const len = Math.hypot(dx, dy) || 1;
    const sp = this.speed * speedMul * ctx.dt;
    this.moveBy(ctx, (dx / len) * sp, (dy / len) * sp);
    this.dir = dirFromVector(dx, dy, this.dir);
    this.anim = 'walk';
  }

  /**
   * Every 1.2 s of trying to walk, check it actually went somewhere. Two
   * wasted windows flip the detour side; a creature that cannot get home
   * makes wherever it is its home instead of walking into the bank forever.
   */
  private watchProgress(ctx: WorldCtx): void {
    const moving = this.anim === 'walk' && (this.state === 'chase' || this.state === 'return' || this.state === 'patrol' || this.state === 'flee');
    if (!moving) { this.progressX = NaN; this.stalls = 0; return; }
    if (Number.isNaN(this.progressX)) { this.progressX = this.x; this.progressY = this.y; this.progressTime = ctx.now; return; }
    if (ctx.now - this.progressTime < 1.2) return;
    const moved = dist(this.x, this.y, this.progressX, this.progressY);
    this.progressX = this.x; this.progressY = this.y; this.progressTime = ctx.now;
    if (moved > this.speed * 0.25) { this.stalls = 0; return; }
    this.stalls++;
    this.detourSide = this.detourSide ? -this.detourSide : 1;
    this.detourUntil = ctx.now + 1.4;
    if (this.state === 'patrol') { this.wanderAngle += Math.PI; this.state = 'idle'; this.stateTime = 0; }
    if (this.state === 'return' && this.stalls >= 2) {
      this.homeX = this.x; this.homeY = this.y;
      this.state = 'idle'; this.stateTime = 0; this.anim = 'idle';
    }
  }

  driveTo(ctx: WorldCtx, x: number, y: number, speed = 1): void {
    this.steer(ctx, x, y, speed);
  }

  private updateTactic(ctx: WorldCtx): void {
    const tactic = this.def.tactic;
    if (!tactic || this.scripted || this.friendly || this.dead) return;
    this.tacticTime -= ctx.dt;
    if (this.tacticTime > 0 || this.windupAttack || dist(this.x, this.y, ctx.player.x, ctx.player.y) > 510) return;
    const kit = this.def.combat;
    if (kit) {
      const attack = kit.attacks[this.tacticUses % kit.attacks.length];
      if (attack.shape === 'summon' && this.tacticUses >= kit.attacks.length * 2) {
        this.tacticUses++; this.tacticTime = .25; return;
      }
      if (this.queueAttack(ctx, attack)) {
        this.tacticUses++;
        this.tacticTime = kit.cadence + (this.id % 3) * .12;
        if (this.def.tactic === 'guard') this.guardUntil = ctx.now + attack.windup;
      }
      return;
    }
    this.tacticTime = 6 + (this.id % 4);
    this.tacticUses++;
    const a: BossAttack = { id: `tactic_${tactic}`, name: this.def.name, shape: 'circle', windup: 1.15, cooldown: 7, power: 1.2, radius: 90, element: 'physical', color: '#d5bc7c' };
    switch (tactic) {
      case 'charge': a.shape = 'dash'; a.range = 245; a.windup = 1.2; break;
      case 'feint':
        if (this.tacticUses % 2) { this.driveTo(ctx, this.x + Math.cos(this.id) * 130, this.y + Math.sin(this.id) * 130, 2); this.tacticTime = 1.5; return; }
        a.shape = 'cone'; a.radius = 110; a.windup = 0.9; break;
      case 'piper':
        for (const e of ctx.enemies as Enemy[]) if (!e.dead && !e.friendly && dist(this.x, this.y, e.x, e.y) < 180) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.06); }
        ctx.floatText(this.x, this.y - 45, 'Piper restores the pack', '#b5d98b', 11);
        a.shape = 'projectile'; a.count = 1; a.range = 340; a.element = 'arcane'; break;
      case 'firetrail': a.shape = 'rain'; a.count = 3; a.radius = 43; a.element = 'fire'; a.color = '#e08d43'; break;
      case 'volley': a.shape = 'projectile'; a.count = 5; a.range = 430; a.windup = 1.3; break;
      case 'zone': a.shape = 'rain'; a.count = 2; a.radius = 68; a.element = 'arcane'; a.color = '#9db5ee'; a.windup = 1.7; break;
      case 'snatch': a.shape = 'line'; a.range = 360; a.radius = 18; a.power = 1.8; break;
      case 'bind': a.shape = 'ring'; a.radius = 135; a.windup = 1.6; a.element = 'shadow'; break;
      case 'guard': this.guardUntil = ctx.now + 3; a.shape = 'cone'; a.radius = 120; a.windup = 1.6; break;
      case 'revive':
        if (this.tacticUses <= 2) { ctx.summon('aegean_oath_shade', this.x + 40, this.y, this.level - 2, 20); ctx.floatText(this.x, this.y - 44, 'A name is called', '#a2d5d4', 11); }
        a.shape = 'projectile'; a.count = 2; a.element = 'shadow'; a.range = 350; break;
      case 'lure': a.shape = 'rain'; a.count = 1; a.radius = 110; a.windup = 2; a.element = 'shadow'; break;
      case 'surface': a.shape = 'line'; a.range = 340; a.radius = 40; a.windup = 1.5; this.guardUntil = ctx.now + 1.5; break;
    }
    this.queueAttack(ctx, a);
  }

  /** Used by both the ordinary boss AI and the authored encounter director. */
  queueAttack(ctx: WorldCtx, attack: BossAttack, target?: { x: number; y: number }): boolean {
    if (this.dead || this.windupAttack || this.windupTime > 0 || this.attackCd > 0) return false;
    if (this.def.id.startsWith('aegean_')) return this.queueGreekAttack(ctx, attack, target);
    this.windupAttack = attack;
    this.windupTime = attack.windup;
    this.anim = attack.shape === 'summon' ? 'cast' : 'attack';
    this.animTime = 0;
    const angle = angleTo(this.x, this.y, ctx.player.x, ctx.player.y);
    // A Greek rain attack must threaten a motionless player. Commit its first
    // impact to the position shown at windup; moving out of that warning avoids
    // it. All remaining impacts scatter, and original bosses keep their scatter.
    const points = attack.shape === 'leap' || attack.shape === 'echo' || attack.shape === 'cross' ? [{ x: ctx.player.x, y: ctx.player.y }] : attack.shape === 'rain' ? Array.from({ length: attack.count ?? 4 }, (_, i) =>
      i === 0 && this.def.id.startsWith('aegean_') ? { x: ctx.player.x, y: ctx.player.y } : ({
        x: ctx.player.x + (Math.random() - 0.5) * 260,
        y: ctx.player.y + (Math.random() - 0.5) * 260,
      })) : [];
    // Greek charges commit to their full lane. Existing bosses retain their
    // gap-closing dash distance; its warning now stores that same endpoint.
    const fullRange = attack.range ?? (attack.shape === 'line' ? 400 : 300);
    const range = attack.shape === 'dash' && !this.def.id.startsWith('aegean_')
      ? Math.min(fullRange, Math.max(70, dist(this.x, this.y, ctx.player.x, ctx.player.y))) : fullRange;
    this.attackGeometry = { x: this.x, y: this.y, angle, range, points };
    if (attack.shape === 'cross') {
      const pt = points[0], length = attack.range ?? 340;
      for (const offset of [0, Math.PI / 2]) {
        const direction = angle + offset;
        ctx.telegraph(pt.x - Math.cos(direction) * length / 2, pt.y - Math.sin(direction) * length / 2,
          length, attack.windup, attack.color, 'line', direction, attack.radius ?? 24);
      }
    } else if (attack.shape === 'leap' || attack.shape === 'echo') {
      ctx.telegraph(points[0].x, points[0].y, attack.radius ?? 80, attack.windup, attack.color, 'circle');
    } else if (attack.shape === 'donut') {
      ctx.telegraph(this.x, this.y, attack.radius ?? 180, attack.windup, attack.color, 'ring');
      ctx.telegraph(this.x, this.y, attack.innerRadius ?? 70, attack.windup, '#98e6c0', 'circle');
    } else if (attack.shape === 'nova' || attack.shape === 'projectile' && this.def.id.startsWith('aegean_')) {
      const count = attack.count ?? 5;
      for (let i = 0; i < count; i++) {
        const direction = attack.shape === 'nova' ? angle + i / count * Math.PI * 2 : angle + (i / Math.max(1, count - 1) - .5) * (attack.spread ?? .9);
        ctx.telegraph(this.x, this.y, range, attack.windup, attack.color, 'line', direction, attack.radius ?? 10);
      }
    } else if (attack.shape === 'pull') {
      ctx.telegraph(this.x, this.y, attack.radius ?? 200, attack.windup, attack.color, 'circle');
    } else if (attack.shape === 'rain') {
      for (const pt of points) ctx.telegraph(pt.x, pt.y, attack.radius ?? 70, attack.windup, attack.color, 'circle');
    } else if (attack.shape === 'cone') {
      ctx.telegraph(this.x, this.y, attack.radius ?? 130, attack.windup, attack.color, 'cone', angle);
    } else if (attack.shape === 'dash' || attack.shape === 'line') {
      ctx.telegraph(this.x, this.y, range, attack.windup, attack.color, 'line', angle,
        attack.shape === 'dash' ? this.radius + 10 : attack.radius ?? 24);
    } else if (attack.shape === 'circle' || attack.shape === 'ring') {
      ctx.telegraph(this.x, this.y, attack.radius ?? 140, attack.windup, attack.color, 'circle');
    }
    if (this.def.id.startsWith('aegean_') && (this.isBoss || (!this.def.id.startsWith('aegean_army_') && this.tacticUses < 2)))
      ctx.floatText(this.x, this.y - this.radius * 2.1, attack.name, attack.color, this.isBoss ? 13 : 10);
    ctx.playSound('boss_windup', 0.4);
    return true;
  }

  private canSeePlayer(ctx: WorldCtx): boolean {
    const d = dist(this.x, this.y, ctx.player.x, ctx.player.y);
    const sight = this.def.sight * (this.alertTime > 0 ? 1.7 : 1);
    return d < sight;
  }

  private startAttack(ctx: WorldCtx): void {
    if (this.def.id.startsWith('aegean_')) {
      const ranged = this.def.ranged;
      this.queueAttack(ctx, { id: 'basic', name: this.displayName, shape: ranged ? 'projectile' : 'cone',
        windup: Math.max(.48, this.def.windup), cooldown: this.def.attackCooldown, power: 1, radius: ranged ? Math.min(16, ranged.radius) : this.def.attackRange + this.radius * .35,
        range: ranged ? this.def.attackRange * 1.4 : this.def.attackRange, count: ranged ? Math.min(2, ranged.count ?? 1) : undefined,
        spread: ranged?.arc, projectileSpeed: ranged ? Math.min(340, ranged.speed) : undefined,
        element: ranged?.element ?? this.def.element ?? 'physical', color: ranged?.color ?? '#d6b886' });
      return;
    }
    this.state = 'attack';
    this.stateTime = 0;
    this.anim = 'attack';
    this.animTime = 0;
    this.windupTime = this.def.windup;
    if (this.elite || this.isBoss || this.def.id.startsWith('aegean_')) {
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
          minHealthDamage: aegeanMinimumHit(this.def),
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
        const before = p.hp + Math.max(0, p.shield);
        ctx.damagePlayer(this.damage, { minHealthDamage: aegeanMinimumHit(this.def), element: this.def.element ?? 'physical', fromX: this.x, fromY: this.y, knockback: 90, label: this.displayName });
        if (p.hp + Math.max(0, p.shield) < before && !p.dead) {
          if (['aegean_oath_shade', 'aegean_burial_priest', 'aegean_jailer'].includes(this.def.id)) applyStatus(p, 'curse', .2, 8, '#ae83c8', ctx.now);
          if (this.def.id === 'aegean_kere') applyStatus(p, 'fear', .25, 4, '#a6a0bb', ctx.now);
        }
      }
      ctx.particles(this.x + (p.x - this.x) * 0.4, this.y + (p.y - this.y) * 0.4, 5, '#e8763a', { speed: 70, life: 0.25, size: 2 });
      ctx.playSound('swing', 0.35);
    }
  }

  /* ---------------- boss behaviour ---------------- */

  private updateBoss(ctx: WorldCtx): void {
    const boss = this.def.boss!;
    this.updateWard(ctx);
    const frac = this.hp / this.maxHp;
    while (this.phase < boss.phases.length - 1 && frac <= boss.phases[this.phase + 1].at) {
      this.phase++;
      const ph = boss.phases[this.phase];
      if (ph.line) ctx.floatText(this.x, this.y - this.radius * 2.4, ph.line, '#f6bf5d', 15);
      ctx.shake(9);
      ctx.ringAt(this.x, this.y, 260, '#f6bf5d');
      ctx.particles(this.x, this.y, 46, '#f6bf5d', { speed: 210, life: 0.8, size: 4 });
      ctx.playSound('boss_phase', 0.6);
      if (ph.immune) this.beginWard(ctx, ph.immune);
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
      this.queueAttack(ctx, pick);
    }

    // movement between attacks
    if (d > this.def.attackRange * (this.def.id.startsWith('aegean_') ? .65 : 1.2)) this.steer(ctx, p.x, p.y, this.def.id.startsWith('aegean_') ? 1.1 : .9);
    else {
      this.anim = 'idle';
      this.dir = dirFromVector(p.x - this.x, p.y - this.y, this.dir);
    }
  }

  /**
   * Put the ward up. With adds, the things it calls are remembered so the
   * ward can watch them; the timer is then only a ceiling, because an add
   * that wanders into a corner must not be able to stall the fight forever.
   */
  private beginWard(ctx: WorldCtx, spec: NonNullable<BossPhase['immune']>): void {
    this.immuneUntil = ctx.now + spec.seconds;
    this.immuneLabel = spec.label ?? (spec.summon ? 'Warded — kill the adds' : 'Warded');
    this.immuneAdds = [];
    if (spec.summon) {
      const n = spec.count ?? 3;
      const before = ctx.enemies.length;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ctx.summon(spec.summon, this.x + Math.cos(a) * 110, this.y + Math.sin(a) * 110, this.level);
      }
      this.immuneAdds = ctx.enemies.slice(before);
    }
    ctx.ringAt(this.x, this.y, 200, '#8fd0f0');
    ctx.particles(this.x, this.y, 40, '#8fd0f0', { speed: 170, life: 0.9, size: 3 });
    ctx.floatText(this.x, this.y - this.radius * 2.8, this.immuneLabel, '#8fd0f0', 14);
    ctx.playSound('boss_windup', 0.55);
  }

  /** True while nothing can hurt it. */
  get warded(): boolean {
    return this.immuneUntil > 0;
  }

  private updateWard(ctx: WorldCtx): void {
    if (this.immuneUntil <= 0) return;
    const addsLeft = this.immuneAdds.filter((a) => !a.dead).length;
    const timedOut = ctx.now >= this.immuneUntil;
    if (this.immuneAdds.length ? (addsLeft === 0 || timedOut) : timedOut) {
      this.immuneUntil = 0;
      this.immuneAdds = [];
      this.immuneLabel = '';
      ctx.ringAt(this.x, this.y, 240, '#f6bf5d');
      ctx.particles(this.x, this.y, 36, '#f6bf5d', { speed: 200, life: 0.7, size: 3 });
      ctx.floatText(this.x, this.y - this.radius * 2.6, 'The ward breaks', '#f6bf5d', 14);
      ctx.playSound('boss_phase', 0.5);
      return;
    }
    // a steady shimmer, so it reads as protected rather than as broken
    if (Math.random() < 0.28) {
      const a = Math.random() * Math.PI * 2;
      ctx.particles(this.x + Math.cos(a) * this.radius * 1.5, this.y + Math.sin(a) * this.radius * 1.5, 1, '#8fd0f0', { speed: 30, life: 0.5, size: 2 });
    }
  }

  /** How much harder it is hitting than when the fight started. */
  get enrageMul(): number {
    const boss = this.def.boss;
    if (!boss?.enrageAfter) return 1;
    const over = this.fightTime - boss.enrageAfter;
    return over <= 0 ? 1 : 1 + over * (boss.enrageRate ?? 0.02);
  }

  private resolveLegacyBossAttack(ctx: WorldCtx): void {
    const a = this.windupAttack!;
    const boss = this.def.boss!;
    const p = ctx.player;
    const dmg = this.damage * a.power * boss.phases[this.phase].damage * this.enrageMul;
    const angle = angleTo(this.x, this.y, p.x, p.y);
    // Armour-ignoring bite, applied wherever the attack connects. A dodge
    // roll still avoids it; nothing you wear reduces it.
    const tax = a.lifeTax ? ctx.player.maxHp * a.lifeTax * this.enrageMul : 0;

    switch (a.shape) {
      case 'circle':
      case 'ring': {
        const r = a.radius ?? 140;
        ctx.ringAt(this.x, this.y, r, a.color);
        ctx.shake(a.shape === 'ring' ? 12 : 7);
        ctx.particles(this.x, this.y, 34, a.color, { speed: 240, life: 0.6, size: 4 });
        if (dist(this.x, this.y, p.x, p.y) < r + p.radius) {
          ctx.damagePlayer(dmg + tax, { element: a.element, fromX: this.x, fromY: this.y, knockback: 220, label: a.name });
        }
        break;
      }
      case 'cone': {
        const r = a.radius ?? 130;
        const d = dist(this.x, this.y, p.x, p.y);
        if (d < r + p.radius && angleBetween(angle, angleTo(this.x, this.y, p.x, p.y)) < 0.65) {
          ctx.damagePlayer(dmg + tax, { element: a.element, fromX: this.x, fromY: this.y, knockback: 160, label: a.name });
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
            damage: dmg + tax,
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
        // A dash closes the gap; it does not jump over it. `a.range` is how
        // far it CAN travel, not how far it always travels — unclamped, a
        // boss standing next to you with a 620px dash lands 400px behind you
        // and spends the next four seconds walking back, which makes it
        // untouchable in melee rather than dangerous.
        const reach = Math.max(this.radius + p.radius + 18, dist(this.x, this.y, p.x, p.y) - p.radius * 0.5);
        const range = Math.min(a.range ?? 300, reach);
        const tx = this.x + Math.cos(angle) * range;
        const ty = this.y + Math.sin(angle) * range;
        if (!boxHitsTerrain(ctx.map, tx, ty, this.radius, this.radius * 0.6)) {
          ctx.particles(this.x, this.y, 24, a.color, { speed: 150, life: 0.5, size: 4 });
          this.x = tx;
          this.y = ty;
          ctx.particles(this.x, this.y, 24, a.color, { speed: 150, life: 0.5, size: 4 });
        }
        if (dist(this.x, this.y, p.x, p.y) < 70) {
          ctx.damagePlayer(dmg + tax, { element: a.element, fromX: this.x, fromY: this.y, knockback: 200, label: a.name });
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
            ctx.damagePlayer(dmg * 0.7 + tax, { element: a.element, fromX: rx, fromY: ry, knockback: 90, label: a.name });
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

  /** Convert older authored attack records at the boundary; no Greek area hit
   * survives merely because a director still uses an old shape/key. */
  private physicalPattern(attack: BossAttack): BossAttack {
    const a = { ...attack };
    const creature = this.def.id;
    const natural = /hound|lion|nemea|cerberus|mare|sphinx|gryphon/.test(creature) ? 'claw'
      : /serpent|hydra|scylla|viper|drakon|python|boar|bull/.test(creature) ? 'fang'
        : /harpy|birds/.test(creature) ? 'wing'
          : /cyclops|titan|talos|forge|jailer/.test(creature) ? 'hammer' : 'spear';
    if (['rain', 'nova', 'cross'].includes(a.shape)) {
      const oldShape = a.shape;
      // The previous rain resolver used 70% power per landed impact. Preserve
      // that budget when adapting an older director record into a thrown object.
      if (oldShape === 'rain') a.power *= .7;
      a.shape = 'projectile';
      a.projectileSprite ??= a.element === 'fire' ? 'ember' : a.element === 'poison' ? 'venom' : oldShape === 'rain' && a.element === 'physical' ? 'boulder' : 'spear';
      a.physical ??= a.projectileSprite === 'boulder' ? 'boulder' : a.projectileSprite === 'venom' || a.projectileSprite === 'ember' ? 'spit' : 'spear';
      a.radius = Math.min(a.radius ?? 14, a.projectileSprite === 'boulder' ? 30 : 18);
      a.count = Math.min(3, a.count ?? 2); a.spread ??= .65;
    } else if (a.shape === 'pull') {
      a.shape = 'line'; a.physical = 'tendril'; a.range = Math.min(155, a.range ?? 155); a.pull = 165;
    } else if (['circle', 'ring', 'donut', 'echo'].includes(a.shape)) {
      a.swings = a.shape === 'echo' ? 2 : 1;
      a.shape = 'cone'; a.physical ??= natural; a.radius = Math.min(125, a.radius ?? 100);
    } else if (a.shape === 'line' && !a.physical && (a.range ?? 0) > 200) {
      a.shape = 'projectile'; a.physical = 'spear'; a.projectileSprite = 'spear'; a.radius = 13; a.count = Math.min(3, a.count ?? 1);
    }
    a.physical ??= natural;
    if (a.shape === 'projectile') {
      if (a.projectileSprite === 'spit') a.projectileSprite = 'venom';
      a.count = Math.min(4, a.count ?? 1);
      a.projectileSpeed ??= a.projectileSprite === 'boulder' ? 235 : 300;
      a.projectileSprite ??= a.element === 'fire' ? 'ember' : a.element === 'poison' ? 'venom' : a.element === 'shadow' ? 'net' : 'spear';
    }
    return a;
  }

  private physicalSourceVisible(ctx: WorldCtx): boolean {
    if (ctx.player.dead || dist(this.x, this.y, ctx.player.x, ctx.player.y) > 820) return false;
    const { camera, canvas } = ctx;
    if (!camera || !canvas || canvas.width <= 0 || canvas.height <= 0) return true;
    const halfW = canvas.width / (2 * Math.max(.1, camera.zoom)), halfH = canvas.height / (2 * Math.max(.1, camera.zoom));
    return Math.abs(this.x - camera.x) <= halfW && Math.abs(this.y - camera.y) <= halfH;
  }

  private queueGreekAttack(ctx: WorldCtx, authored: BossAttack, target?: { x: number; y: number }): boolean {
    if (!this.physicalSourceVisible(ctx)) return false;
    if (!this.isBoss && !this.def.id.startsWith('aegean_army_')) {
      let nearbyAttacks = 0;
      for (const other of ctx.enemies as Enemy[]) if (other !== this && !other.dead && other.windupAttack && dist(other.x, other.y, ctx.player.x, ctx.player.y) < 650) nearbyAttacks++;
      if (nearbyAttacks >= (this.def.id === 'aegean_royal_guard' ? 3 : 2)) return false;
    }
    const a = this.physicalPattern(authored), origin = physicalOrigin(this);
    const aim = target ?? { x: ctx.player.x, y: ctx.player.y - 8 };
    const travel = a.shape === 'dash' || a.shape === 'leap';
    const angle = travel ? angleTo(this.x, this.y, aim.x, target ? aim.y : ctx.player.y) : angleTo(origin.x, origin.y, aim.x, aim.y);
    const authoredRange = a.range ?? 300;
    const range = target && a.shape === 'projectile' ? Math.min(authoredRange, dist(origin.x, origin.y, aim.x, aim.y)) : authoredRange;
    this.windupAttack = a; this.windupTime = Math.max(.45, a.windup);
    this.anim = a.shape === 'summon' ? 'cast' : 'attack'; this.animTime = 0;
    this.dir = dirFromVector(Math.cos(angle), Math.sin(angle), this.dir);
    this.attackGeometry = { x: this.x, y: this.y, angle, range, points: [{ x: aim.x, y: target ? aim.y : ctx.player.y }] };
    ctx.physicalAttack?.({ source: this, followSource: true, ...origin, angle, reach: a.shape === 'line' ? Math.min(range, 150) : a.radius ?? 80,
      duration: this.windupTime, kind: a.physical!, phase: 'prepare', color: a.color,
      isActive: () => !this.dead && this.windupAttack === a && this.windupTime > 0 });
    ctx.playSound(a.shape === 'projectile' ? 'shoot' : 'swing', .2);
    return true;
  }

  private finishPhysicalAttack(ctx: WorldCtx, reason: 'hit' | 'wall' | 'range' = 'range'): void {
    const a = this.windupAttack;
    if (a) {
      this.bossCooldowns[a.id] = a.cooldown;
      this.lastImpact = { id: a.id, x: this.x, y: this.y, at: ctx.now, angle: this.attackGeometry?.angle ?? 0 };
      if (a.shape !== 'projectile') a.onImpact?.({ x: this.x, y: this.y }, reason);
    }
    this.physicalMotion = null; this.windupAttack = null; this.attackGeometry = null; this.windupTime = 0;
    this.attackCd = this.isBoss ? .82 : .7; this.state = 'chase';
  }

  /** Interrupt both the windup and a moving held weapon/body attack. */
  cancelAttack(): void {
    this.physicalMotion = null; this.windupAttack = null; this.attackGeometry = null; this.windupTime = 0;
    this.attackCd = Math.max(this.attackCd, .9); this.state = 'chase';
  }

  private physicalHit(ctx: WorldCtx, a: BossAttack, fromX: number, fromY: number): boolean {
    const p = ctx.player, phase = this.def.boss?.phases[this.phase]?.damage ?? 1;
    const power = a.power * phase * this.enrageMul / Math.sqrt(a.swings ?? 1);
    const before = p.hp + Math.max(0, p.shield);
    ctx.damagePlayer(this.damage * power, { trueDamageAmount: a.lifeTax ? p.maxHp * a.lifeTax : 0,
      minHealthDamage: aegeanMinimumHit(this.def, power), element: a.element, fromX, fromY,
      knockback: a.pull ? 0 : a.physical === 'shield' ? 130 : 65, label: a.name });
    const connected = p.hp + Math.max(0, p.shield) < before;
    if (connected && !p.dead) {
      if (a.status) applyStatus(p, a.status.kind, a.status.power, a.status.duration, a.color, ctx.now);
      if (a.pull) { const d = Math.max(1, dist(p.x, p.y, this.x, this.y)); p.knockX += (this.x - p.x) / d * a.pull; p.knockY += (this.y - p.y) / d * a.pull; }
    }
    return connected;
  }

  private physicalContactClear(ctx: WorldCtx, fromX: number, fromY: number): boolean {
    const dx = ctx.player.x - fromX, dy = ctx.player.y - 8 - fromY;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    for (let i = 1; i <= steps; i++) {
      if (boxHitsTerrain(ctx.map, fromX + dx * i / steps, fromY + dy * i / steps, 2, 2, this.movementProfile)) return false;
    }
    return true;
  }

  private resolveBossAttack(ctx: WorldCtx): void {
    if (!this.def.id.startsWith('aegean_')) { this.resolveLegacyBossAttack(ctx); return; }
    if (!this.windupAttack || !this.physicalSourceVisible(ctx)) { this.cancelAttack(); return; }
    const a = this.windupAttack, origin = physicalOrigin(this);
    const geometry = this.attackGeometry!;
    if (a.shape === 'projectile') {
      const phase = this.def.boss?.phases[this.phase]?.damage ?? 1, power = a.power * phase * this.enrageMul;
      const count = a.count ?? 1;
      let reported = false;
      for (let i = 0; i < count; i++) {
        const off = count === 1 ? 0 : (i / (count - 1) - .5) * (a.spread ?? .65);
        ctx.spawnProjectile({ x: origin.x, y: origin.y, angle: geometry.angle + off, speed: a.projectileSpeed ?? 300,
          damage: this.damage * power, trueDamageAmount: a.lifeTax ? ctx.player.maxHp * a.lifeTax : 0,
          minHealthDamage: aegeanMinimumHit(this.def, power), radius: a.radius ?? 13, range: geometry.range,
          element: a.element, color: a.color, friendly: false, sourceId: this.id, sprite: a.projectileSprite,
          status: a.status, onImpact: a.onImpact ? (point, reason) => { if (!reported && !this.dead) { reported = true; a.onImpact?.(point, reason); } } : undefined });
      }
      ctx.physicalAttack?.({ source: this, followSource: true, ...origin, angle: geometry.angle, reach: 36, duration: .24,
        kind: a.physical!, phase: 'strike', color: a.color });
      ctx.playSound('shoot', .35); this.finishPhysicalAttack(ctx); return;
    }
    if (a.shape === 'summon') {
      for (let i = 0; i < Math.min(3, a.count ?? 2); i++) {
        const angle = geometry.angle + (i - ((a.count ?? 2) - 1) / 2) * .7;
        const x = this.x + Math.cos(angle) * 85, y = this.y + Math.sin(angle) * 85;
        if (!boxHitsTerrain(ctx.map, x, y, 14, 10)) ctx.summon(a.summon ?? 'aegean_spartoi', x, y, this.level - 2, this.isBoss ? 24 : 18);
      }
      this.finishPhysicalAttack(ctx); return;
    }
    const travel = a.shape === 'dash' || a.shape === 'leap';
    const target = geometry.points[0];
    const travelRange = a.shape === 'leap' ? Math.min(geometry.range, dist(this.x, this.y, target.x, target.y)) : geometry.range;
    const duration = travel ? Math.max(.2, travelRange / (a.shape === 'leap' ? 490 : 420)) : (a.physical === 'spear' || a.physical === 'gaze' ? .36 : .42) * (a.swings ?? 1);
    const reach = travel ? this.radius + 8 : a.shape === 'line' ? Math.min(geometry.range, a.physical === 'gaze' ? 265 : 175) : Math.min(a.radius ?? 90, 145);
    const cue: PhysicalAttackCue = { source: this, followSource: true, ...origin, angle: geometry.angle, reach, duration,
      kind: a.physical!, phase: 'strike', color: a.color, swings: a.swings,
      sweepAngle: a.shape === 'line' ? .2 : 1.5 };
    const motion: PhysicalMotion = { attack: a, cue, travel, elapsed: 0, duration, travelled: 0,
      distance: travelRange, startX: this.x, startY: this.y, hitPasses: new Set(), anyHit: false };
    this.physicalMotion = motion;
    ctx.physicalAttack?.({ ...cue, isActive: () => !this.dead && this.physicalMotion === motion && this.windupAttack === a });
    ctx.playSound('swing', .35);
  }

  private updatePhysicalMotion(ctx: WorldCtx): void {
    const motion = this.physicalMotion;
    if (!motion) return;
    if (this.windupAttack !== motion.attack || this.dead || !this.physicalSourceVisible(ctx)) { this.cancelAttack(); return; }
    const previous = motion.elapsed;
    motion.elapsed = Math.min(motion.duration, motion.elapsed + ctx.dt);
    const p = ctx.player;
    if (motion.travel) {
      const angle = motion.cue.angle, distance = motion.distance * motion.elapsed / motion.duration;
      let blocked = false;
      while (motion.travelled < distance) {
        motion.travelled = Math.min(distance, motion.travelled + 6);
        const x = motion.startX + Math.cos(angle) * motion.travelled, y = motion.startY + Math.sin(angle) * motion.travelled;
        if (boxHitsTerrain(ctx.map, x, y, this.radius * .7, this.radius * .5, this.movementProfile)) { blocked = true; break; }
        this.x = x; this.y = y;
        if (!motion.hitPasses.has(0) && dist(this.x, this.y, p.x, p.y) < this.radius + p.radius + 5) {
          motion.hitPasses.add(0); motion.anyHit = this.physicalHit(ctx, motion.attack, this.x, this.y) || motion.anyHit;
        }
      }
      this.anim = 'attack'; this.dir = dirFromVector(Math.cos(angle), Math.sin(angle), this.dir);
      if (blocked) { this.finishPhysicalAttack(ctx, 'wall'); return; }
    } else {
      // Small temporal substeps keep an actual passing blade from tunnelling
      // across a player during a slow frame; each visible swing contacts once.
      const steps = Math.max(1, Math.ceil((motion.elapsed - previous) / .015));
      for (let i = 1; i <= steps; i++) {
        const pose = physicalPose(motion.cue, previous + (motion.elapsed - previous) * i / steps);
        if (pose.progress < .15 || pose.progress > .87 || motion.hitPasses.has(pose.pass)) continue;
        const o = physicalOrigin(this), dx = p.x - o.x, dy = p.y - 8 - o.y;
        const along = dx * Math.cos(pose.angle) + dy * Math.sin(pose.angle);
        const across = Math.abs(-dx * Math.sin(pose.angle) + dy * Math.cos(pose.angle));
        const width = motion.attack.physical === 'hammer' || motion.attack.physical === 'hoof' ? 12 : motion.attack.physical === 'gaze' ? 5 : 8;
        if (along >= -p.radius && along <= pose.reach + p.radius && across < width + p.radius && this.physicalContactClear(ctx, o.x, o.y)) {
          motion.hitPasses.add(pose.pass); motion.anyHit = this.physicalHit(ctx, motion.attack, o.x, o.y) || motion.anyHit;
        }
      }
    }
    if (motion.elapsed >= motion.duration) this.finishPhysicalAttack(ctx, motion.anyHit ? 'hit' : 'range');
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
    // The enrage clock only runs once the fight has actually started.
    if (this.isBoss && this.state !== 'idle' && this.state !== 'patrol') this.fightTime += dt;
    this.stuckTimer = Math.max(0, this.stuckTimer - dt * 0.35);
    if (!this.unstuckChecked) {
      // Spawned half inside a bank or a wall: step out once, onto open ground.
      this.unstuckChecked = true;
      if (boxHitsTerrain(ctx.map, this.x, this.y, this.radius * 0.7, this.radius * 0.5, this.movementProfile)) {
        const open = findOpenNear(ctx.map, this.x, this.y, this.radius * 0.7, this.radius * 0.5, 12, this.movementProfile);
        this.x = open.x; this.y = open.y;
        if (dist(this.homeX, this.homeY, this.x, this.y) < 200) { this.homeX = this.x; this.homeY = this.y; }
      }
    }
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
      if (this.def.id.startsWith('aegean_')) this.cancelAttack();
      this.anim = 'hurt';
      return;
    }

    if (this.def.id.startsWith('aegean_') && this.windupAttack && (!this.physicalSourceVisible(ctx) || !ctx.enemies.includes(this))) {
      this.cancelAttack(); return;
    }
    if (this.physicalMotion) { this.updatePhysicalMotion(ctx); return; }

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

    if (this.scripted) return;

    this.updateTactic(ctx);
    if (this.windupAttack) return;

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
          this.stateTime = 0;
          break;
        }
        const wantRange = this.def.ranged ? this.def.attackRange * 0.72 : this.def.attackRange * 0.8;
        const motion = this.def.combat?.movement;
        if ((motion === 'flank' || motion === 'orbit') && d > 85 && d < 340) {
          const side = this.id % 2 ? 1 : -1, bearing = angleTo(p.x, p.y, this.x, this.y) + side * .52;
          const wanted = motion === 'orbit' ? Math.max(130, wantRange) : Math.max(55, d - 80);
          this.steer(ctx, p.x + Math.cos(bearing) * wanted, p.y + Math.sin(bearing) * wanted, 1.05);
        } else if (motion === 'anchor' && d < 250) {
          this.anim = 'idle'; this.dir = dirFromVector(p.x - this.x, p.y - this.y, this.dir);
        } else if (d > wantRange) this.steer(ctx, p.x, p.y, motion === 'stalk' && d < 200 ? .7 : motion === 'rush' ? 1.08 : 1);
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
        if (dist(this.x, this.y, this.homeX, this.homeY) < 24 || this.stateTime > 30) {
          if (this.stateTime > 30) { this.homeX = this.x; this.homeY = this.y; }
          this.state = 'idle';
          this.stateTime = 0;
          this.anim = 'idle';
        } else this.steer(ctx, this.homeX, this.homeY, 0.6);
        break;
      }
      default:
        break;
    }
    this.watchProgress(ctx);
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
