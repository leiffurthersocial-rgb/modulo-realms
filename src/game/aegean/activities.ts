import { prepareAegeanActivityGround } from "../world/aegean";
import type { Game } from "../core/game";
import {
  AEGEAN_ACTIVITIES,
  AEGEAN_ACTIVITY_BY_ID,
  type AegeanActivity,
  type AegeanStep,
} from "../../data/aegean/progression";
import {
  buildPropGrid,
  boxHitsTerrain,
  findOpenNear,
  type GameMap,
  type PropInstance,
} from "../world/map";
import { Enemy } from "../entities/enemy";

export interface ActivityRun {
  id: string;
  step: number;
  progress: number;
  visited: number[];
  timer: number;
  started: boolean;
  wave: number;
  escort?: { x: number; y: number; hp: number };
  sequence: number[];
}
export interface ActivitiesSave {
  runs: Record<string, ActivityRun>;
  active: string | null;
  cooldowns: Record<string, number>;
}
/** Small authored stories share verbs, but retain their own locations, sequences and receipts. */
export class AegeanActivities {
  state: ActivitiesSave = { runs: {}, active: null, cooldowns: {} };
  private props = new WeakMap<GameMap, Map<string, PropInstance[]>>();
  constructor(public game: Game) {}
  private stations(id: string): PropInstance[] {
    let cached = this.props.get(this.game.map);
    if (!cached) {
      cached = new Map();
      for (const p of this.game.map.props) {
        const id = p.data?.activity;
        if (typeof id === "string") {
          const list = cached.get(id) ?? [];
          list.push(p);
          cached.set(id, list);
        }
      }
      this.props.set(this.game.map, cached);
    }
    return cached.get(id) ?? [];
  }
  private clearActors(id: string): void {
    this.game.enemies = this.game.enemies.filter(
      (e) => !e.spawnId?.startsWith(`activity:${id}:`),
    );
  }
  private leaveActive(): void {
    const id = this.state.active;
    if (!id) return;
    this.clearActors(id);
    const r = this.state.runs[id],
      s = this.current;
    if (r && (s?.type === "defend" || s?.type === "escort")) {
      r.started = false;
      r.timer = 0;
      r.wave = 0;
      r.escort = undefined;
      r.progress = 0;
      r.visited = [];
    }
  }
  reset(): void {
    this.state = { runs: {}, active: null, cooldowns: {} };
  }
  snapshot(): ActivitiesSave {
    return structuredClone(this.state);
  }
  restore(data?: ActivitiesSave): void {
    this.reset();
    if (data) this.state = data;
    for (const run of Object.values(this.state.runs)) {
      run.started = false;
      run.timer = 0;
      run.wave = 0;
    }
  }
  get active(): AegeanActivity | undefined {
    return this.state.active
      ? AEGEAN_ACTIVITY_BY_ID[this.state.active]
      : undefined;
  }
  get current(): AegeanStep | undefined {
    const a = this.active;
    return a ? a.steps[this.state.runs[a.id]?.step ?? 0] : undefined;
  }
  get objective(): string {
    const a = this.active,
      s = this.current;
    if (!a || !s) return "";
    const r = this.state.runs[a.id];
    return `${a.name}: ${s.label}${s.type === "defend" && r?.started ? ` (${Math.ceil(Math.max(0, (s.duration ?? 25) - r.timer))}s)` : ""}`;
  }
  onMapEntered(): void {
    for (const [id, r] of Object.entries(this.state.runs)) {
      const step = AEGEAN_ACTIVITY_BY_ID[id]?.steps[r.step];
      if (step?.type === "defend" || step?.type === "escort") {
        r.started = false;
        r.timer = 0;
        r.wave = 0;
        r.escort = undefined;
        r.progress = 0;
        r.visited = [];
      }
    }
  }
  install(map: GameMap): void {
    if (map.props.some((p) => p.data?.activity)) return;
    prepareAegeanActivityGround(map, AEGEAN_ACTIVITIES);
    for (const a of AEGEAN_ACTIVITIES) {
      if ((a.map ?? "overworld") !== map.id) continue;
      const anchor = findOpenNear(
        map,
        a.tx * 32 + 16,
        a.ty * 32 + 16,
        12,
        10,
        36,
      );
      // Sea discoveries remain buoy interactions and can be reached aboard a ship.
      const wet = boxHitsTerrain(map, anchor.x, anchor.y, 10, 8);
      for (let n = 0; n < 4; n++) {
        const raw =
          n === 0
            ? anchor
            : {
                x: anchor.x + Math.cos((n * Math.PI * 2) / 3) * 110,
                y: anchor.y + Math.sin((n * Math.PI * 2) / 3) * 110,
              };
        const pt = wet ? raw : findOpenNear(map, raw.x, raw.y, 10, 8, 16);
        map.props.push({
          art: n === 0 ? "aegean_stele" : "aegean_brazier",
          x: pt.x,
          y: pt.y,
          interact: "aegean",
          label: n === 0 ? a.name : `${a.name}: station ${n}`,
          nameplate: n === 0 ? a.name : undefined,
          nameplateColor: "#8bcacb",
          data: { action: "activity", activity: a.id, index: n },
        });
      }
    }
    this.props.delete(map);
    buildPropGrid(map);
  }
  start(id: string): boolean {
    const a = AEGEAN_ACTIVITY_BY_ID[id],
      g = this.game;
    if (!a || g.campaign.requirements(a.requires).length) return false;
    if (g.campaign.has(id) && !a.repeatable) return false;
    if ((this.state.cooldowns[id] ?? 0) > g.now) return false;
    if (!this.state.runs[id])
      this.state.runs[id] = {
        id,
        step: 0,
        progress: 0,
        visited: [],
        timer: 0,
        started: false,
        wave: 0,
        sequence: [],
      };
    if (this.state.active !== id) this.leaveActive();
    this.state.active = id;
    g.toast(a.name, a.summary, "#8bcacb");
    g.touch();
    return true;
  }
  interact(prop: PropInstance): boolean {
    const id = String(prop.data?.activity ?? "");
    if (!id) return false;
    const a = AEGEAN_ACTIVITY_BY_ID[id],
      g = this.game;
    if (!a) return true;
    if (!this.state.runs[id] && !this.start(id)) {
      g.toast(
        a.name,
        g.campaign.has(id)
          ? "This story is already recorded."
          : `Requires ${g.campaign.requirements(a.requires).join(", ")}`,
        "#8bcacb",
      );
      return true;
    }
    if (this.state.active !== id) this.leaveActive();
    this.state.active = id;
    const r = this.state.runs[id],
      step = a.steps[r.step];
    if (!step) return true;
    const idx = Number(prop.data?.index ?? 0);
    if (step.requires?.some((req) => !g.campaign.has(req))) {
      g.toast(step.label, "The required deed is not yet complete.", "#8bcacb");
      return true;
    }
    if (idx === 0) {
      g.toast(
        a.name,
        `${step.label}${step.sequence ? ` — signal order: ${step.sequence.join(" → ")}` : step.type === "defend" ? " — defend this court; stay within its bounds." : " — follow the numbered stations."}`,
        "#8bcacb",
      );
      if (step.type === "defend") this.beginDefence(a, r);
      else if (step.count === 1 && step.type === "interact") this.advance(a, r);
      return true;
    }
    if (step.type === "puzzle") {
      if (idx !== step.sequence?.[r.progress]) {
        r.progress = 0;
        g.toast(
          "The mechanism resets",
          `Read the signal: ${step.sequence?.join(" → ")}`,
          "#d4a465",
        );
        g.damagePlayer(g.player.maxHp * 0.08, {
          trueDamage: true,
          label: "Ancient mechanism",
        });
      } else {
        r.progress++;
        g.fx.ring(prop.x, prop.y, 45, "#8bcacb");
        if (r.progress >= step.count) this.advance(a, r);
      }
    } else if (step.type === "interact" || step.type === "visit") {
      if (!r.visited.includes(idx)) {
        r.visited.push(idx);
        r.progress++;
        g.toast(step.label, `${r.progress}/${step.count}`, "#8bcacb");
        if (r.progress >= step.count) this.advance(a, r);
      }
    } else if (step.type === "escort") {
      if (!r.escort) {
        r.escort = { x: g.player.x, y: g.player.y, hp: 100 };
        r.started = true;
        this.spawnWave(a, r);
        g.toast(
          "The companion follows",
          "Keep the light beside you and visit stations in order.",
          "#8bcacb",
        );
      }
      if (
        idx === r.progress + 1 &&
        Math.hypot(r.escort.x - prop.x, r.escort.y - prop.y) < 90
      ) {
        r.progress++;
        this.spawnWave(a, r);
        if (r.progress >= step.count) this.advance(a, r);
      }
    }
    g.touch();
    return true;
  }
  private beginDefence(a: AegeanActivity, r: ActivityRun): void {
    if (r.started) return;
    r.started = true;
    r.timer = 0;
    r.wave = 0;
    this.spawnWave(a, r);
  }
  private spawnWave(a: AegeanActivity, r: ActivityRun): void {
    const g = this.game,
      p = g.player;
    const marine = boxHitsTerrain(g.map, p.x, p.y, 10, 8);
    const profile = marine ? "swimmer" : "foot";
    const id = marine
      ? "aegean_serpent"
      : a.region.includes("ash")
        ? "aegean_oath_shade"
        : a.region.includes("lerna")
          ? "aegean_serpent"
          : "aegean_harpy";
    for (let n = 0; n < 3; n++) {
      const angle = n * 2.1 + r.wave;
      const pt = findOpenNear(
        g.map,
        p.x + Math.cos(angle) * 210,
        p.y + Math.sin(angle) * 210,
        14,
        12,
        8,
        profile,
      );
      if (boxHitsTerrain(g.map, pt.x, pt.y, 14, 12, profile)) continue;
      const e = new Enemy(id, pt.x, pt.y, a.level, {
        spawnId: `activity:${a.id}:${r.wave}:${n}`,
        region: a.region,
      });
      e.movementProfile = profile;
      g.enemies.push(e);
    }
    r.wave++;
  }
  private advance(a: AegeanActivity, r: ActivityRun): void {
    this.clearActors(a.id);
    r.step++;
    r.progress = 0;
    r.visited = [];
    r.timer = 0;
    r.started = false;
    r.escort = undefined;
    r.sequence = [];
    r.wave = 0;
    const g = this.game;
    if (r.step >= a.steps.length) {
      const already = g.campaign.has(a.id);
      if (already && a.repeatable) {
        g.player.addXp(a.reward.xp);
        g.player.gold += a.reward.gold;
        for (const id of a.reward.items ?? []) g.campaign.grant(id, 1, a.id);
      } else g.completeAegean(a.id);
      this.state.cooldowns[a.id] = g.now + 300;
      delete this.state.runs[a.id];
      this.state.active = null;
      g.toast(a.name, "Deed complete. Your reward is secured.", "#e7c778");
      g.autosave();
    } else g.toast(a.name, a.steps[r.step].label, "#8bcacb");
    g.touch();
  }
  update(dt: number): void {
    const g = this.game,
      a = this.active;
    if (!a || g.map.id !== (a.map ?? "overworld")) return;
    const r = this.state.runs[a.id],
      step = a.steps[r?.step ?? 0];
    if (!r || !step) return;
    if (
      step.type === "feat" &&
      g.campaign.requirements(step.requires ?? [step.target]).length === 0
    ) {
      this.advance(a, r);
      return;
    }
    const stations = this.stations(a.id);
    const anchor = stations.find((p) => p.data?.index === 0);
    if (!anchor) return;
    if (step.type === "visit") {
      for (const prop of stations)
        if (
          Number(prop.data?.index) > 0 &&
          Math.hypot(prop.x - g.player.x, prop.y - g.player.y) < 38
        )
          this.interact(prop);
      return;
    }
    if (step.type === "defend" && r.started) {
      if (Math.hypot(g.player.x - anchor.x, g.player.y - anchor.y) > 300) {
        this.clearActors(a.id);
        r.timer = 0;
        r.started = false;
        r.wave = 0;
        g.toast(
          "The defence breaks",
          "Return to the central marker and begin this step again.",
          "#d4a465",
        );
        return;
      }
      r.timer += dt;
      if (r.wave < 3 && r.timer > (r.wave * (step.duration ?? 25)) / 3)
        this.spawnWave(a, r);
      if (
        r.timer >= (step.duration ?? 25) &&
        !g.enemies.some(
          (e) => !e.dead && e.spawnId?.startsWith(`activity:${a.id}:`),
        )
      )
        this.advance(a, r);
    }
    if (step.type === "escort" && r.escort) {
      const e = r.escort,
        p = g.player,
        d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d > 35 && d < 340) {
        const nx = e.x + ((p.x - e.x) / d) * 95 * dt,
          ny = e.y + ((p.y - e.y) / d) * 95 * dt;
        const marine = boxHitsTerrain(g.map, anchor.x, anchor.y, 10, 8);
        if (!boxHitsTerrain(g.map, nx, ny, 9, 8, marine ? "swimmer" : "foot")) {
          e.x = nx;
          e.y = ny;
        }
      }
      if (
        g.enemies.some(
          (enemy) =>
            !enemy.dead &&
            !enemy.friendly &&
            Math.hypot(enemy.x - e.x, enemy.y - e.y) < 60,
        )
      )
        e.hp -= dt * 5;
      if (e.hp <= 0) {
        this.clearActors(a.id);
        r.escort = undefined;
        r.progress = 0;
        r.started = false;
        g.toast(
          "Your companion retreats",
          "Regroup at a station. This step can be retried.",
          "#d4a465",
        );
      }
    }
  }
  draw(ctx: CanvasRenderingContext2D): void {
    const a = this.active;
    if (!a) return;
    const r = this.state.runs[a.id];
    if (!r?.escort) return;
    const e = r.escort;
    ctx.save();
    ctx.fillStyle = "#9edecb";
    ctx.beginPath();
    ctx.arc(e.x, e.y - 12, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#243635";
    ctx.fillRect(e.x - 16, e.y - 30, 32, 3);
    ctx.fillStyle = "#9edecb";
    ctx.fillRect(e.x - 16, e.y - 30, (32 * e.hp) / 100, 3);
    ctx.restore();
  }
}
