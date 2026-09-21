import type { Game } from "../core/game";
import type { DamageOpts } from "../core/world";
import type { Enemy } from "../entities/enemy";
import { applyStatus } from "../entities/entity";
import {
  AEGEAN_POWERS,
  type AegeanPowerAction,
  type AegeanPowerDef,
  type AegeanPowerEvent,
} from "../items/effects";
import type { Item } from "../items/types";
import { boxHitsTerrain, getTile } from "../world/map";
import { blocksProjectiles, TILE } from "../world/tiles";

interface Mark {
  until: number;
  bonus: number;
}
interface Ward {
  until: number;
  reduction: number;
  reflect: boolean;
}
interface Field {
  x: number;
  y: number;
  radius: number;
  until: number;
  inside: boolean;
  paid: boolean;
  mana: number;
  health: number;
  reduction: number;
  nextRing: number;
}
interface ReturnPoint {
  x: number;
  y: number;
  map: string;
  until: number;
  range: number;
  uid: string;
}

/** Remaining times deliberately pause during reloads and practice echoes. */
export interface AegeanPowersSave {
  version: 1;
  cooldowns: Record<string, number>;
  javelins: number;
  javelinRecovery: number;
  flamePattern: number;
}

/**
 * Finite, event-driven powers shared by all six classes. No item ever bypasses
 * encounter wards, displacement immunity, terrain, or a campaign gate.
 */
export class AegeanPowers {
  private cooldowns = new Map<string, number>();
  private events = new Map<AegeanPowerEvent, number>();
  private marks = new Map<number, Mark>();
  private venom = new Map<number, { stacks: number; until: number }>();
  private wards: Ward[] = [];
  private fields: Field[] = [];
  private returnPoint: ReturnPoint | null = null;
  private projectileWard = { until: 0, multiplier: 1 };
  private weakenedProjectiles = new Set<number>();
  private flamePattern = 0;
  private javelins = 3;
  private javelinClock = 0;
  private alternating = 0;
  private lastRange: "close" | "far" | null = null;
  private openingKeys = new Set<string>();
  private exposureEpoch = 0;
  private wasExposed = false;
  private braceStarted = -100;
  private wasBracing = false;
  private lastMap = "";
  private lastOpeningHit = -100;
  private busy = false;

  constructor(public game: Game) {}
  reset(): void {
    this.cooldowns.clear();
    this.events.clear();
    this.clearSpatial();
    this.javelins = 3;
    this.javelinClock = 0;
    this.flamePattern = 0;
    this.alternating = 0;
    this.lastRange = null;
    this.braceStarted = -100;
    this.wasBracing = false;
    this.lastMap = this.game.map.id;
    this.busy = false;
    this.exposureEpoch = 0;
    this.lastOpeningHit = -100;
  }
  snapshot(): AegeanPowersSave {
    const cooldowns: Record<string, number> = {};
    for (const [id, until] of this.cooldowns) {
      const remaining = until - this.game.now;
      if (remaining > 0 && Number.isFinite(remaining))
        cooldowns[id] = remaining;
    }
    return {
      version: 1,
      cooldowns,
      javelins: this.javelins,
      javelinRecovery: this.javelins < 3 ? this.javelinClock : 0,
      flamePattern: this.flamePattern % 3,
    };
  }
  /**
   * Restore after the map and player. Encounter-bound marks, combo openings,
   * fields and return points expire: regenerated actors cannot retain their IDs.
   * HP/mana/stamina belong to the player snapshot, not this equipment snapshot.
   */
  restore(data?: Partial<AegeanPowersSave> | null): void {
    this.reset();
    if (!data || data.version !== 1) return;
    const bounded = (
      value: unknown,
      fallback: number,
      maximum: number,
    ): number =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.min(maximum, value))
        : fallback;
    if (data.cooldowns && typeof data.cooldowns === "object") {
      for (const [id, remaining] of Object.entries(data.cooldowns)) {
        const def = Object.hasOwn(AEGEAN_POWERS, id)
          ? AEGEAN_POWERS[id]
          : undefined;
        if (!def) continue;
        const duration = bounded(remaining, 0, def.cooldown);
        if (duration > 0) this.cooldowns.set(id, this.game.now + duration);
      }
    }
    this.javelins = Math.floor(bounded(data.javelins, 3, 3));
    this.javelinClock =
      this.javelins < 3 ? bounded(data.javelinRecovery, 0, 1.3) : 0;
    this.flamePattern = Math.floor(bounded(data.flamePattern, 0, 2));
  }
  private clearSpatial(): void {
    this.marks.clear();
    this.venom.clear();
    this.wards = [];
    this.fields = [];
    this.returnPoint = null;
    this.projectileWard.until = 0;
    this.weakenedProjectiles.clear();
    this.openingKeys.clear();
    this.wasExposed = false;
    this.events.clear();
    this.alternating = 0;
    this.lastRange = null;
  }
  get javelinCharges(): number {
    return this.javelins;
  }
  get knockbackMultiplier(): number {
    return this.equipped("aegean_boar_resolve") ? 0.7 : 1;
  }
  cooldown(item: Item): number {
    return Math.max(
      0,
      (this.cooldowns.get(item.aegeanPower ?? "") ?? 0) - this.game.now,
    );
  }
  private equipped(power: string): boolean {
    return Object.values(this.game.player.equipment).some(
      (item) => item?.aegeanPower === power,
    );
  }

  /** Call once after the ordinary attack has a target and before spending its resources. */
  consumeAttack(item: Item | null | undefined): boolean {
    if (item?.weaponKind !== "javelin") return true;
    if (this.javelins <= 0) {
      this.game.floatText(
        this.game.player.x,
        this.game.player.y - 42,
        "Javelins returning",
        "#b9dcff",
        11,
      );
      return false;
    }
    this.javelins--;
    return true;
  }

  update(dt: number): void {
    const g = this.game,
      p = g.player,
      now = g.now;
    if (this.lastMap !== g.map.id) {
      this.clearSpatial();
      this.lastMap = g.map.id;
    }
    if (p.dead) {
      this.clearSpatial();
      return;
    }
    if (this.javelins < 3) {
      this.javelinClock += dt;
      while (this.javelinClock >= 1.3 && this.javelins < 3) {
        this.javelins++;
        this.javelinClock -= 1.3;
      }
    } else this.javelinClock = 0;
    const bracing = p.bracing || p.blocking;
    if (bracing && !this.wasBracing) this.braceStarted = now;
    this.wasBracing = bracing;
    const exposed = g.encounters.exposureActive;
    if (exposed && !this.wasExposed) this.exposureEpoch++;
    this.wasExposed = exposed;
    for (const [key, until] of this.cooldowns)
      if (until <= now) this.cooldowns.delete(key);
    for (const [id, mark] of this.marks)
      if (mark.until <= now) this.marks.delete(id);
    for (const [id, venom] of this.venom)
      if (venom.until <= now) this.venom.delete(id);
    this.wards = this.wards.filter((ward) => ward.until > now);
    this.fields = this.fields.filter((field) => field.until > now);
    if (
      this.returnPoint &&
      (this.returnPoint.until < now ||
        p.equipment.accessory?.uid !== this.returnPoint.uid)
    )
      this.returnPoint = null;
    for (const field of this.fields) {
      const inside = Math.hypot(p.x - field.x, p.y - field.y) < field.radius;
      if (inside && !field.inside && !field.paid) {
        p.mp = Math.min(p.maxMp, p.mp + field.mana);
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * field.health);
        field.paid = true;
        g.floatText(p.x, p.y - 42, "Returning light", "#efe0a3", 11);
      }
      field.inside = inside;
      if (now >= field.nextRing) {
        g.ringAt(field.x, field.y, field.radius, "#9cbbcc");
        field.nextRing = now + 0.7;
      }
    }
    if (this.projectileWard.until > now) {
      for (const projectile of g.projectiles) {
        if (
          projectile.dead ||
          projectile.friendly ||
          this.weakenedProjectiles.has(projectile.id)
        )
          continue;
        if (Math.hypot(projectile.x - p.x, projectile.y - p.y) > 170) continue;
        projectile.damage *= this.projectileWard.multiplier;
        if (projectile.minHealthDamage !== undefined)
          projectile.minHealthDamage *= this.projectileWard.multiplier;
        this.weakenedProjectiles.add(projectile.id);
        g.ringAt(projectile.x, projectile.y, 14, "#9cbbcc");
      }
    } else this.weakenedProjectiles.clear();
  }

  /** Called only for a positive, allowed hit; return the modified amount. */
  onHit(enemy: Enemy, amount: number, opts: DamageOpts = {}): number {
    if (
      opts.noProc ||
      this.busy ||
      enemy.friendly ||
      enemy.warded ||
      amount <= 0
    )
      return amount;
    const g = this.game,
      p = g.player,
      now = g.now;
    const item = p.equipment.mainHand;
    const mark = this.marks.get(enemy.id);
    if (mark && mark.until > now) amount *= 1 + mark.bonus;
    if (item?.aegeanPower === "aegean_storm_shot")
      this.marks.set(enemy.id, { until: now + 8, bonus: Math.max(.3, mark?.bonus ?? 0) });
    const distance = Math.max(
      0,
      Math.hypot(enemy.x - p.x, enemy.y - p.y) - enemy.radius,
    );
    if (item?.weaponKind === "chainblades") {
      const range = distance < 72 ? "close" : "far";
      if (this.lastRange && this.lastRange !== range)
        this.alternating = Math.min(3, this.alternating + 1);
      this.lastRange = range;
    }
    if (
      g.encounters.exposureActive ||
      (!enemy.windupAttack &&
        enemy.lastImpact &&
        now - enemy.lastImpact.at < 1.5)
    ) {
      const key = `${enemy.id}:${g.encounters.active ? this.exposureEpoch : enemy.lastImpact?.at}`;
      if (this.openingKeys.size < 3 && !this.openingKeys.has(key))
        this.openingKeys.add(key);
      if (
        item?.aegeanPower === "aegean_hydra_venom" &&
        now - this.lastOpeningHit > 0.4
      ) {
        const stacks = Math.min(3, (this.venom.get(enemy.id)?.stacks ?? 0) + 1);
        this.venom.set(enemy.id, { stacks, until: now + 5 });
        applyStatus(
          enemy,
          "poison",
          p.attackPower() * 0.1 * stacks,
          5,
          "#7fb966",
          now,
        );
        this.lastOpeningHit = now;
      }
    }
    this.trigger("hit");
    return amount;
  }

  /** Called after ordinary mitigation, before shields/HP. True executions remain true. */
  onHurt(amount: number, opts: DamageOpts = {}, retaliationScale = 1): number {
    const g = this.game,
      p = g.player;
    if (amount <= 0) return amount;
    if (opts.trueDamage || opts.trueDamageAmount) return amount;
    if (opts.element === "frost" && this.equipped("aegean_boar_resolve"))
      amount *= 0.85;
    const dx = (opts.fromX ?? p.x) - p.x,
      dy = (opts.fromY ?? p.y) - p.y;
    const direction = Math.atan2(dy, dx);
    const facing =
      Math.abs(
        Math.atan2(
          Math.sin(direction - p.facing),
          Math.cos(direction - p.facing),
        ),
      ) < 1.15;
    if (
      (p.bracing || p.blocking) &&
      g.now - this.braceStarted < 0.6 &&
      facing &&
      opts.fromX !== undefined
    )
      this.trigger("brace");
    let reduction = this.wards.reduce(
      (highest, ward) => Math.max(highest, ward.reduction),
      0,
    );
    for (const field of this.fields)
      if (Math.hypot(p.x - field.x, p.y - field.y) < field.radius)
        reduction = Math.max(reduction, field.reduction);
    if (
      this.wards.some((ward) => ward.reflect) &&
      opts.fromX !== undefined &&
      !opts.noProc
    ) {
      const source = g.enemies.find(
        (enemy) =>
          !enemy.dead &&
          !enemy.friendly &&
          Math.hypot(enemy.x - opts.fromX!, enemy.y - opts.fromY!) < 80,
      );
      if (source)
        g.damageEnemy(source, Math.min(amount * 0.5 * retaliationScale, p.attackPower()), {
          element: "holy",
          noProc: true,
          fromX: p.x,
          fromY: p.y,
        });
    }
    return amount * (1 - Math.min(0.4, reduction));
  }

  onDodge(): void {
    const p = this.game.player;
    // Spamming dodge in an empty field cannot earn an attack opening.
    if (
      this.game.encounters.active ||
      this.game.enemies.some(
        (e) => !e.dead && !e.friendly && Math.hypot(e.x - p.x, e.y - p.y) < 350,
      )
    )
      this.trigger("dodge");
  }
  onInterrupt(_enemy?: Enemy): void {
    this.trigger("interrupt");
  }
  onStagger(_enemy?: Enemy): void {
    this.trigger("stagger");
  }
  onHazardExit(): void {
    this.trigger("hazardExit");
  }
  onBrace(): void {
    this.trigger("brace");
  }

  private trigger(event: AegeanPowerEvent): void {
    if (this.busy) return;
    this.events.set(event, this.game.now);
    for (const item of Object.values(this.game.player.equipment)) {
      const def = item?.aegeanPower
        ? AEGEAN_POWERS[item.aegeanPower]
        : undefined;
      if (!item || !def || def.trigger !== event || this.cooldown(item) > 0)
        continue;
      this.execute(item, def);
    }
  }

  /** False means the caller must leave its ordinary cooldown/resources untouched. */
  activate(item: Item): boolean {
    const def = item.aegeanPower ? AEGEAN_POWERS[item.aegeanPower] : undefined;
    if (
      !def ||
      def.trigger !== "active" ||
      this.game.player.dead ||
      this.game.naval.aboard
    )
      return false;
    if (
      !Object.values(this.game.player.equipment).some(
        (equipped) => equipped?.uid === item.uid,
      )
    )
      return false;
    if (this.game.encounters.suppressOffense && item.slot === "mainHand")
      return this.refuse("This trial uses wards, not weapons.");
    if (
      def.id === "aegean_ariadne_return" &&
      this.returnPoint?.uid === item.uid
    )
      return this.returnToMark();
    if (this.cooldown(item) > 0)
      return this.refuse(`${Math.ceil(this.cooldown(item))}s`);
    if (
      def.requiresEvent &&
      this.game.now - (this.events.get(def.requiresEvent) ?? -100) >
        (def.window ?? 5)
    )
      return this.refuse(
        `Earn a ${def.requiresEvent === "brace" ? "timed brace" : def.requiresEvent} opening first.`,
      );
    const target = this.game.bestTarget(520);
    const distance = target
      ? Math.max(
          0,
          Math.hypot(
            target.x - this.game.player.x,
            target.y - this.game.player.y,
          ) - target.radius,
        )
      : 0;
    if (def.condition === "marked" && (!target || !this.marks.has(target.id)))
      return this.refuse("Mark a target with an ordinary hit first.");
    if (
      def.condition === "exposed" &&
      !this.game.encounters.exposureActive &&
      (!target?.lastImpact || this.game.now - target.lastImpact.at > 1.5)
    )
      return this.refuse("Wait for a real exposure.");
    if (
      def.condition === "alternatingRange" &&
      this.alternating < (def.charges ?? 1)
    )
      return this.refuse("Alternate close and long chain strikes.");
    if (def.condition === "threeOpenings" && this.openingKeys.size < 3)
      return this.refuse(
        `${this.openingKeys.size}/3 distinct openings earned.`,
      );
    if (
      def.condition === "reach" &&
      (!target || distance < this.game.player.attackRange() * 0.55)
    )
      return this.refuse("Use the outer half of your spear’s reach.");
    const cycle = def.actions.find((action) => action.type === "cycle");
    if (cycle?.type === "cycle" && this.game.player.mp < cycle.manaCost)
      return this.refuse(`Needs ${cycle.manaCost} mana.`);
    this.execute(item, def);
    if (def.requiresEvent) this.events.delete(def.requiresEvent);
    if (def.condition === "alternatingRange") this.alternating = 0;
    if (def.condition === "threeOpenings") this.openingKeys.clear();
    if (def.id === "aegean_javelin_recall") {
      this.javelins = 3;
      this.javelinClock = 0;
    }
    return true;
  }

  private refuse(message: string): false {
    const p = this.game.player;
    this.game.floatText(p.x, p.y - 42, message, "#dfcfaa", 11);
    return false;
  }
  private execute(item: Item, def: AegeanPowerDef): void {
    const g = this.game,
      p = g.player;
    const cdr = Math.min(0.35, p.stats().cooldownReduction / 100);
    this.cooldowns.set(def.id, g.now + def.cooldown * (1 - cdr));
    const eventEmpowered = !!def.empowerEvent &&
      g.now - (this.events.get(def.empowerEvent) ?? -100) <= (def.window ?? 6);
    const comboEmpowered = def.empowerCondition === 'alternatingRange' && this.alternating >= (def.charges ?? 3);
    const empowered = eventEmpowered || comboEmpowered;
    const multiplier = empowered ? (def.empowerMultiplier ?? 1.5) : 1;
    if (eventEmpowered) this.events.delete(def.empowerEvent!);
    if (comboEmpowered) this.alternating = 0;
    this.busy = true;
    try {
      for (const action of def.actions) this.apply(
        action.type === 'damage' ? { ...action, multiplier: action.multiplier * multiplier } : action,
        item, def,
      );
    } finally {
      this.busy = false;
    }
    g.floatText(
      p.x,
      p.y - 46,
      empowered ? `${def.name} — Empowered` : def.name,
      item.rarity === "primordial" ? "#b9dcff" : "#efe0a3",
      12,
    );
    g.ringAt(p.x, p.y, 48, "#c7b47b");
    g.touch();
  }

  private apply(
    action: AegeanPowerAction,
    item: Item,
    def: AegeanPowerDef,
  ): void {
    const g = this.game,
      p = g.player,
      now = g.now;
    switch (action.type) {
      case "damage":
        this.strike(action);
        break;
      case "restore": {
        const total =
          action.amount +
          (action.percent ?? 0) *
            (action.resource === "health"
              ? p.maxHp
              : action.resource === "mana"
                ? p.maxMp
                : p.maxSp);
        if (action.resource === "health")
          p.hp = Math.min(p.maxHp, p.hp + total);
        else if (action.resource === "mana")
          p.mp = Math.min(p.maxMp, p.mp + total);
        else p.sp = Math.min(p.maxSp, p.sp + total);
        break;
      }
      case "buff": {
        const id = `${def.id}:${action.stat}`;
        p.buffs = p.buffs.filter((buff) => buff.id !== id);
        p.buffs.push({
          id,
          name: def.name,
          stat: action.stat,
          amount: action.amount,
          until: now + action.duration,
          color: "#efe0a3",
        });
        break;
      }
      case "ward":
        this.wards.push({
          until: now + action.duration,
          reduction: action.reduction,
          reflect: !!action.reflect,
        });
        break;
      case "mark": {
        const target = g.bestTarget(520);
        if (target) {
          this.marks.set(target.id, {
            until: now + action.duration,
            bonus: action.bonus,
          });
          g.ringAt(target.x, target.y, target.radius + 12, "#efe0a3");
        }
        break;
      }
      case "cleanse": {
        if (
          action.status === "petrify" ||
          action.status === "fear" ||
          action.status === "curse"
        )
          g.encounters.cleansePressure(action.status);
        if (action.status === "poison")
          p.statuses = p.statuses.filter((status) => status.kind !== "poison");
        if (action.status === "slow" || action.status === "petrify")
          p.statuses = p.statuses.filter(
            (status) => status.kind !== "chill" && status.kind !== "stun",
          );
        break;
      }
      case "displace": {
        for (const enemy of this.nearEnemies(action.range)) {
          if (enemy.isBoss && action.bossScale === 0) continue;
          const amount =
            action.distance * (enemy.isBoss ? action.bossScale : 1);
          const angle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
          const x = enemy.x + Math.cos(angle) * amount,
            y = enemy.y + Math.sin(angle) * amount;
          if (this.clearPath(enemy.x, enemy.y, x, y, enemy.radius)) {
            enemy.x = x;
            enemy.y = y;
          }
        }
        break;
      }
      case "projectileWard":
        this.projectileWard = {
          until: now + action.duration,
          multiplier: action.multiplier,
        };
        this.weakenedProjectiles.clear();
        break;
      case "field":
        this.fields.push({
          x: p.x,
          y: p.y,
          radius: action.radius,
          until: now + action.duration,
          inside: true,
          paid: false,
          mana: action.mana ?? 0,
          health: action.health ?? 0,
          reduction: action.damageReduction ?? 0,
          nextRing: now,
        });
        this.fields = this.fields.slice(-3);
        break;
      case "move": {
        if (action.mode === "markReturn") {
          this.returnPoint = {
            x: p.x,
            y: p.y,
            map: g.map.id,
            until: now + action.duration,
            range: action.range,
            uid: item.uid,
          };
          g.floatText(p.x, p.y - 60, "Use again to return", "#efe0a3", 11);
        } else if (action.mode === "retreat") {
          const angle = g.aimAngle();
          const x = p.x - Math.cos(angle) * action.range,
            y = p.y - Math.sin(angle) * action.range;
          if (this.clearPath(p.x, p.y, x, y, p.radius)) {
            p.x = x;
            p.y = y;
          }
        } else {
          const allies = g.enemies.filter(
            (enemy) =>
              enemy.friendly &&
              !enemy.scripted &&
              !enemy.dead &&
              Number.isFinite(enemy.lifetime) &&
              Math.hypot(enemy.x - p.x, enemy.y - p.y) <= action.range,
          );
          allies.forEach((ally, index) => {
            const angle = index * 2.4,
              x = p.x + Math.cos(angle) * 52,
              y = p.y + Math.sin(angle) * 52;
            if (this.clearPath(ally.x, ally.y, x, y, ally.radius)) {
              ally.x = x;
              ally.y = y;
            }
          });
        }
        break;
      }
      case "cycle": {
        p.mp -= action.manaCost;
        const pattern =
          action.patterns[this.flamePattern++ % action.patterns.length];
        this.strike({
          type: "damage",
          ...pattern,
          status: "burn",
          duration: 3,
        });
        break;
      }
    }
  }

  private nearEnemies(range: number): Enemy[] {
    const p = this.game.player;
    return this.game.enemies
      .filter(
        (enemy) =>
          !enemy.dead &&
          !enemy.friendly &&
          Math.hypot(enemy.x - p.x, enemy.y - p.y) <= range + enemy.radius,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
      );
  }
  private strike(action: Extract<AegeanPowerAction, { type: "damage" }>): void {
    const g = this.game,
      p = g.player,
      aim = g.aimAngle();
    let targets = this.nearEnemies(action.range).filter((enemy) => {
      const dx = enemy.x - p.x,
        dy = enemy.y - p.y,
        along = dx * Math.cos(aim) + dy * Math.sin(aim);
      const across = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
      if (
        action.shape === "line" &&
        (along < -enemy.radius || across > enemy.radius + 22)
      )
        return false;
      if (
        action.shape === "arc" &&
        Math.abs(
          Math.atan2(
            Math.sin(Math.atan2(dy, dx) - aim),
            Math.cos(Math.atan2(dy, dx) - aim),
          ),
        ) > 1.05
      )
        return false;
      return this.shotPath(p.x, p.y, enemy.x, enemy.y);
    });
    if (action.shape === "chain") {
      const marked = targets.find((enemy) => this.marks.has(enemy.id));
      if (marked)
        targets = [
          marked,
          ...targets.filter(
            (enemy) =>
              enemy !== marked &&
              Math.hypot(enemy.x - marked.x, enemy.y - marked.y) < 150,
          ),
        ];
    }
    targets = targets.slice(
      0,
      action.targets ?? (action.shape === "line" ? 3 : 8),
    );
    for (const enemy of targets) {
      const health = enemy.hp;
      const marked = this.marks.get(enemy.id);
      g.damageEnemy(
        enemy,
        p.attackPower() * action.multiplier * (1 + (marked?.bonus ?? 0)),
        {
          element:
            action.status === "burn"
              ? "fire"
              : action.status === "poison"
                ? "poison"
                : "physical",
          noProc: true,
          fromX: p.x,
          fromY: p.y,
          knockback: enemy.isBoss ? 0 : 70,
        },
      );
      if (action.status && enemy.hp < health && !enemy.dead) {
        const status = action.status === "slow" ? "chill" : action.status;
        applyStatus(
          enemy,
          status,
          status === "chill"
            ? 0.25
            : p.attackPower() * 0.12 * Math.min(3, action.stacks ?? 1),
          action.duration ?? 3,
          status === "poison" ? "#7fb966" : "#df9957",
          g.now,
        );
      }
      g.ringAt(enemy.x, enemy.y, enemy.radius + 8, "#efe0a3");
    }
    g.telegraph(
      p.x,
      p.y,
      action.range,
      0.3,
      "#c4b681",
      action.shape === "line"
        ? "line"
        : action.shape === "arc"
          ? "cone"
          : "ring",
      aim,
    );
  }

  private returnToMark(): boolean {
    const point = this.returnPoint,
      g = this.game,
      p = g.player;
    if (
      !point ||
      point.until < g.now ||
      point.map !== g.map.id ||
      Math.hypot(p.x - point.x, p.y - point.y) > point.range ||
      !this.clearPath(p.x, p.y, point.x, point.y, p.radius)
    )
      return this.refuse("The thread cannot cross this boundary.");
    p.x = point.x;
    p.y = point.y;
    this.returnPoint = null;
    g.ringAt(p.x, p.y, 60, "#efe0a3");
    return true;
  }
  private clearPath(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    radius: number,
  ): boolean {
    const length = Math.hypot(toX - fromX, toY - fromY),
      steps = Math.max(1, Math.ceil(length / 8));
    for (let n = 0; n <= steps; n++)
      if (
        boxHitsTerrain(
          this.game.map,
          fromX + ((toX - fromX) * n) / steps,
          fromY + ((toY - fromY) * n) / steps,
          radius * 0.75,
          radius * 0.6,
        )
      )
        return false;
    return true;
  }
  private shotPath(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): boolean {
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(toX - fromX, toY - fromY) / 12),
    );
    for (let n = 1; n < steps; n++)
      if (
        blocksProjectiles(
          getTile(
            this.game.map,
            Math.floor((fromX + ((toX - fromX) * n) / steps) / TILE),
            Math.floor((fromY + ((toY - fromY) * n) / steps) / TILE),
          ),
        )
      )
        return false;
    return true;
  }
}
