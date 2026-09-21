import { TEMPLATE_BY_ID } from "../../data/items";
import { AEGEAN_ISLANDS } from "../../data/aegean/world";
import { AEGEAN_ISLAND_ECOLOGY, AEGEAN_MAINLAND_ECOLOGY } from "../../data/aegean/ecology";
import { prepareAegeanActivityGround } from "../world/aegean";
import type { Game } from "../core/game";
import {
  AEGEAN_ACTIVITIES,
  AEGEAN_ACTIVITY_BY_ID,
  type AegeanActivity,
  type AegeanStep,
} from "../../data/aegean/progression";
import { AEGEAN_ACTIVITY_SCENES, type ActivitySceneObject } from "../../data/aegean/activityScenes";
import {
  buildPropGrid,
  boxHitsTerrain,
  findOpenNear,
  propsInRect,
  type GameMap,
  type MovementProfile,
  type PropInstance,
} from "../world/map";
import { TILE } from "../world/tiles";
import { Enemy } from "../entities/enemy";
import { ANIM, ROW, DEFAULT_LOOK, getCharacterSheet } from "../art/characters";

/** Snap an authored scene onto one connected patch of terrain. Searching the
 * shore as a pedestrian used to move sea discoveries hundreds of pixels inland.
 * The local flood keeps sea scenes afloat and follows boardwalks in the marsh. */
export function layoutActivityScene(map: GameMap, a: AegeanActivity, installed: readonly PropInstance[] = []): PropInstance[] {
  const scene = AEGEAN_ACTIVITY_SCENES[a.id];
  if (!scene) return [];
  const origin = { x: a.tx * TILE + TILE / 2, y: a.ty * TILE + TILE / 2 };
  const profile: MovementProfile = boxHitsTerrain(map, origin.x, origin.y, 12, 10) &&
    !boxHitsTerrain(map, origin.x, origin.y, 16, 12, "ship") ? "ship" : "foot";
  const hw = profile === "ship" ? 16 : 12, hh = profile === "ship" ? 12 : 10;
  const radius = 12, span = radius * 2 + 1;
  const nearby = propsInRect(map, origin.x - 16 * TILE, origin.y - 16 * TILE,
    origin.x + 16 * TILE, origin.y + 16 * TILE, []).map(i => map.props[i]);
  nearby.push(...installed.filter(p => Math.abs(p.x - origin.x) < 16 * TILE && Math.abs(p.y - origin.y) < 16 * TILE));
  const solid = nearby.filter(p => p.cw && p.ch);
  const blocked = (x: number, y: number) => boxHitsTerrain(map, x, y, hw, hh, profile) || solid.some(p =>
    x + hw > p.x - p.cw! / 2 && x - hw < p.x + p.cw! / 2 &&
    y + hh > p.y - p.ch! && y - hh < p.y);
  const points = Array.from({ length: span * span }, (_, i) => ({
    x: origin.x + (i % span - radius) * TILE,
    y: origin.y + (Math.floor(i / span) - radius) * TILE,
  }));
  const open = points.map(p => !blocked(p.x, p.y));
  let start = -1, distance = Infinity;
  for (let i = 0; i < points.length; i++) {
    if (!open[i]) continue;
    const d = (points[i].x - origin.x) ** 2 + (points[i].y - origin.y) ** 2;
    if (d < distance) { distance = d; start = i; }
  }
  if (start < 0) return [];
  const reachable: number[] = [start], seen = new Set(reachable);
  for (let head = 0; head < reachable.length; head++) {
    const i = reachable[head], x = i % span, y = Math.floor(i / span);
    for (const next of [x > 0 ? i - 1 : -1, x < span - 1 ? i + 1 : -1,
      y > 0 ? i - span : -1, y < span - 1 ? i + span : -1]) {
      if (next < 0 || seen.has(next) || !open[next]) continue;
      if (blocked((points[i].x + points[next].x) / 2, (points[i].y + points[next].y) / 2)) continue;
      seen.add(next);
      reachable.push(next);
    }
  }
  const anchor = points[start], used = nearby.filter(p => p.interact).map(p => ({ x: p.x, y: p.y }));
  const place = (def: ActivitySceneObject, index?: number): PropInstance | null => {
    const desired = { x: anchor.x + def.dx * TILE, y: anchor.y + def.dy * TILE };
    let chosen = -1, score = Infinity;
    for (const i of reachable) {
      const p = points[i];
      if (used.some(other => Math.hypot(other.x - p.x, other.y - p.y) < TILE)) continue;
      const d = (p.x - desired.x) ** 2 + (p.y - desired.y) ** 2;
      if (d < score) { score = d; chosen = i; }
    }
    if (chosen < 0) return null;
    const p = points[chosen];
    used.push(p);
    return {
      art: def.art, x: p.x, y: p.y,
      ...(index === undefined ? { data: { activityScenery: a.id } } : {
        interact: "aegean", label: def.name,
        nameplate: index === 0 && !a.id.includes("_discovery_") ? a.name : undefined,
        nameplateColor: "#c8b786",
        data: { action: "activity", activity: a.id, index, movement: profile },
      }),
    };
  };
  const props: PropInstance[] = [];
  [scene.anchor, ...scene.objects].forEach((def, index) => {
    const p = place(def, index);
    if (p) props.push(p);
  });
  for (const def of scene.scenery ?? []) {
    const p = place(def);
    if (p) props.push(p);
  }
  return props;
}

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
  charge?: number;
  pulse?: number;
  hitAt?: number;
  chargingIndex?: number;
  /** Failure waits for a deliberate regroup, never an unattended spawn loop. */
  retry?: { x: number; y: number; left: boolean };
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
  private trails = new Map<string, Array<{ x: number; y: number }>>();
  private previousAttack = 0;
  private autoCheck = 0;
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
    this.trails.delete(id);
  }
  private leaveActive(): void {
    const id = this.state.active;
    if (!id) return;
    this.clearActors(id);
    const r = this.state.runs[id],
      s = this.current;
    if (r && (s?.type === "defend" || s?.type === "escort" || this.actionStep(s))) {
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
    this.trails.clear();
    this.previousAttack = 0; this.autoCheck = 0;
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
      run.charge = 0; run.pulse = 0; run.hitAt = undefined; run.retry = undefined;
      if (this.actionStep(AEGEAN_ACTIVITY_BY_ID[run.id]?.steps[run.step])) { run.progress = 0; run.visited = []; }
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
    const target = this.target;
    if (r.retry) return `REGROUP · return to ${target?.name ?? a.name}`;
    if (this.actionStep(s)) return `${s.type === "strike" ? "STRIKE" : s.type === "race" ? "RUN" : s.type === "dodge" ? "REACH SHELTER" : "HOLD"} · ${r.progress}/${s.count}${s.type === "race" && r.started ? ` · ${Math.ceil(Math.max(0, (s.duration ?? 18) - r.timer))}s` : ""} · ${target?.name ?? a.name}`;
    return `${a.name}: ${s.label}${s.type === "defend" && r?.started ? ` (${Math.ceil(Math.max(0, (s.duration ?? 25) - r.timer))}s)` : target ? ` — ${target.name}` : ""}`;
  }
  /** The existing compass and journal follow the real next object. */
  get target(): { x: number; y: number; name: string } | null {
    const a = this.active, step = this.current;
    if (!a || !step || this.game.map.id !== (a.map ?? "overworld")) return null;
    const r = this.state.runs[a.id], stations = this.stations(a.id);
    if (!r) return null;
    let index = 0;
    if (r.retry) index = 0;
    else if (step.type === "puzzle") index = step.sequence?.[r.progress] ?? 0;
    else if (step.type === "escort") index = r.started ? r.progress + 1 : 0;
    else if (this.actionStep(step)) index = Number(stations.find(p => Number(p.data?.index) > 0 && !r.visited.includes(Number(p.data?.index)))?.data?.index ?? 0);
    else if ((step.type === "interact" && step.count > 1) || step.type === "visit") {
      index = Number(stations.find(p => Number(p.data?.index) > 0 &&
        Number(p.data?.index) <= step.count && !r.visited.includes(Number(p.data?.index)))?.data?.index ?? 0);
    }
    const prop = stations.find(p => p.data?.index === index);
    return prop ? { x: prop.x, y: prop.y, name: prop.label ?? a.name } : null;
  }
  private actionStep(step?: AegeanStep): boolean { return !!step && ["channel", "strike", "race", "dodge"].includes(step.type); }
  private signal(a: AegeanActivity, step: AegeanStep): string {
    const objects = AEGEAN_ACTIVITY_SCENES[a.id]?.objects ?? [];
    return (step.sequence ?? []).map(index => objects[index - 1]?.name ?? "the mechanism").join(" → ");
  }
  private instruction(a: AegeanActivity, step: AegeanStep): string {
    if (this.actionStep(step)) return `${step.label}. Follow the marked objects.`;
    if (step.type === "puzzle") return `${step.label}: ${this.signal(a, step)}.`;
    if (step.type === "defend") return `${step.label}. Keep close to ${AEGEAN_ACTIVITY_SCENES[a.id].anchor.name.toLowerCase()}.`;
    if (step.type === "escort") return `${step.label}. Keep your companion close; the compass points to the next stop.`;
    return `${step.label}.${this.target ? ` Look for ${this.target.name.toLowerCase()}.` : ""}`;
  }
  onMapEntered(): void {
    this.trails.clear();
    for (const [id, r] of Object.entries(this.state.runs)) {
      const step = AEGEAN_ACTIVITY_BY_ID[id]?.steps[r.step];
      if (step?.type === "defend" || step?.type === "escort" || this.actionStep(step)) {
        r.started = false;
        r.timer = 0;
        r.wave = 0;
        r.escort = undefined;
        r.progress = 0;
        r.visited = []; r.hitAt = undefined; r.charge = 0; r.pulse = 0; r.retry = undefined;
      }
    }
  }
  install(map: GameMap): void {
    if (map.props.some((p) => p.data?.activity)) return;
    prepareAegeanActivityGround(map, AEGEAN_ACTIVITIES);
    const installed: PropInstance[] = [];
    for (const a of AEGEAN_ACTIVITIES) {
      if ((a.map ?? "overworld") !== map.id) continue;
      installed.push(...layoutActivityScene(map, a, installed));
    }
    map.props.push(...installed);
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
    g.player.flags.add(`aegean:known:${id}`);
    if (a.repeatable) g.quests.completed = g.quests.completed.filter(q => q !== id);
    g.quests.accept(id);
    g.trackedQuest = id;
    this.syncJournal(a);
    g.toast(a.name, this.instruction(a, a.steps[this.state.runs[id].step]), "#8bcacb");
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
          ? "This work is finished."
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
    if (this.actionStep(step)) {
      this.beginAction(a, r);
      g.toast(a.name, this.instruction(a, step), "#8bcacb");
      return true;
    }
    if (idx === 0) {
      g.toast(
        a.name,
        this.instruction(a, step),
        "#8bcacb",
      );
      if (step.type === "defend") this.beginDefence(a, r);
      else if (step.type === "escort") this.beginEscort(a, r);
      else if (step.count === 1 && step.type === "interact") this.advance(a, r);
      else if (step.type === "visit" && !AEGEAN_ACTIVITY_SCENES[a.id].objects.length) this.advance(a, r);
      g.touch();
      return true;
    }
    if (step.type === "puzzle") {
      if (idx !== step.sequence?.[r.progress]) {
        r.progress = 0;
        g.toast(
          "The mechanism resets",
          `Try this order: ${this.signal(a, step)}.`,
          "#d4a465",
        );
        // A mistake wakes a visible local defender; the mechanism never deals
        // unexplained, instant damage to the player.
        this.spawnWave(a, r, 1);
      } else {
        r.progress++;
        g.fx.ring(prop.x, prop.y, 45, "#8bcacb");
        if (r.progress >= step.count) this.advance(a, r);
      }
    } else if (step.type === "interact" && step.count === 1) {
      g.toast(a.name, `Return to ${AEGEAN_ACTIVITY_SCENES[a.id].anchor.name.toLowerCase()}.`, "#8bcacb");
    } else if ((step.type === "interact" || step.type === "visit") && idx <= step.count) {
      if (!r.visited.includes(idx)) {
        r.visited.push(idx);
        r.progress++;
        g.toast(prop.label ?? step.label, `${r.progress} of ${step.count} found.`, "#8bcacb");
        if (r.progress >= step.count) this.advance(a, r);
      }
    } else if (step.type === "escort") {
      this.beginEscort(a, r);
      if (
        idx === r.progress + 1 &&
        r.escort && Math.hypot(r.escort.x - prop.x, r.escort.y - prop.y) < 90
      ) {
        r.progress++;
        this.spawnWave(a, r);
        if (r.progress >= step.count) this.advance(a, r);
        else g.toast(prop.label ?? a.name, `Continue to ${this.target?.name.toLowerCase() ?? "the next shelter"}.`, "#8bcacb");
      } else {
        g.toast(a.name, idx === r.progress + 1 ? "Wait for your companion to reach you." :
          `Head for ${this.target?.name.toLowerCase() ?? "the next shelter"}.`, "#8bcacb");
      }
    }
    g.touch();
    return true;
  }
  private beginEscort(a: AegeanActivity, r: ActivityRun): void {
    if (r.escort) return;
    const g = this.game;
    r.escort = { x: g.player.x, y: g.player.y, hp: 100 };
    r.retry = undefined;
    r.started = true;
    this.trails.set(a.id, []);
    this.spawnWave(a, r);
    g.toast(AEGEAN_ACTIVITY_SCENES[a.id].companion?.name ?? "Your companion follows",
      `Keep close together. Head for ${this.target?.name.toLowerCase() ?? "the next shelter"}.`, "#8bcacb");
  }
  private beginDefence(a: AegeanActivity, r: ActivityRun): void {
    if (r.started) return;
    r.started = true;
    r.timer = 0;
    r.wave = 0;
    this.spawnWave(a, r);
  }
  private spawnWave(a: AegeanActivity, r: ActivityRun, count = 2): void {
    const g = this.game,
      p = g.player;
    const marine = boxHitsTerrain(g.map, p.x, p.y, 10, 8);
    const profile = marine ? "swimmer" : "foot";
    const index = Math.floor(p.y / TILE) * g.map.w + Math.floor(p.x / TILE);
    const island = AEGEAN_ISLANDS.find(i => i.landmass === g.map.landmasses?.[index]);
    const ecology = island ? AEGEAN_ISLAND_ECOLOGY[island.id] : AEGEAN_MAINLAND_ECOLOGY[g.map.regions?.[index] ?? 20];
    const roster = marine ? ["aegean_telchine", "aegean_nereid", "aegean_ichthyocentaur"] : ecology?.enemies ?? ["aegean_erinys", "aegean_spartoi", "aegean_eidolon"];
    const standing = g.enemies.filter(e => !e.dead && e.spawnId?.startsWith(`activity:${a.id}:`)).length;
    for (let n = 0; n < Math.min(count, Math.max(0, 3 - standing)); n++) {
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
      const e = new Enemy(roster[(r.wave + n) % roster.length], pt.x, pt.y, a.level, {
        spawnId: `activity:${a.id}:${r.wave}:${n}`,
        region: a.region,
      });
      e.movementProfile = marine ? "swimmer" : e.movementProfile;
      e.state = "chase";
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
    r.charge = 0; r.pulse = 0; r.hitAt = undefined; r.retry = undefined;
    const g = this.game;
    if (r.step >= a.steps.length) {
      const already = g.campaign.has(a.id);
      if (already && a.repeatable) {
        g.player.addXp(a.reward.xp);
        g.player.gold += a.reward.gold;
        for (const id of a.reward.items ?? []) g.campaign.grant(id, 1, a.id);
      } else g.completeAegean(a.id);
      this.state.cooldowns[a.id] = g.now + 300;
      g.quests.complete(a.id);
      if (g.trackedQuest === a.id) g.trackedQuest = null;
      delete this.state.runs[a.id];
      this.state.active = null;
      const items = new Map<string, number>();
      for (const id of a.reward.items ?? []) items.set(id, (items.get(id) ?? 0) + 1);
      const receipt = [`+${a.reward.gold.toLocaleString()} gold`, `+${a.reward.xp.toLocaleString()} XP`, ...[...items].map(([id, count]) => `${count}× ${TEMPLATE_BY_ID[id]?.name ?? id}`)];
      if (already && a.repeatable) g.campaign.recordReward(a.name, receipt);
      g.autosave();
    } else g.toast(a.name, a.steps[r.step].label, "#8bcacb");
    g.touch();
  }
  private beginAction(a: AegeanActivity, r: ActivityRun): void {
    if (r.started) return;
    r.started = true; r.timer = 0; r.charge = 0; r.pulse = 0;
    if (a.steps[r.step].type === "strike" || a.steps[r.step].type === "channel") this.spawnWave(a, r);
    else if (a.steps[r.step].type === "dodge") this.spawnWave(a, r, 1);
  }
  private updateAction(a: AegeanActivity, r: ActivityRun, step: AegeanStep, dt: number, stations: PropInstance[]): void {
    const g = this.game, p = g.player;
    this.beginAction(a, r);
    r.timer += dt;
    const fired = p.attackTimer > this.previousAttack + .01;
    this.previousAttack = p.attackTimer;
    if (step.type === "race" && r.timer > (step.duration ?? 18)) {
      r.timer = 0; r.progress = 0; r.visited = []; r.charge = 0;
      g.toast("The trail faded", "Run past the marked objects — no interaction needed.", "#d4a465");
      return;
    }
    const targets = stations.filter(prop => Number(prop.data?.index) > 0 && !r.visited.includes(Number(prop.data?.index)));
    const target = step.type === "dodge" ? targets[0] : targets.find(prop => Math.hypot(prop.x - p.x, prop.y - p.y) < (step.type === "strike" ? 105 : 48));
    if (target && Math.hypot(target.x - p.x, target.y - p.y) < (step.type === "strike" ? 105 : 48)) {
      if (r.chargingIndex !== Number(target.data?.index)) { r.charge = 0; r.chargingIndex = Number(target.data?.index); }
      if (step.type === "strike" && fired) { r.charge = (r.charge ?? 0) + 1; g.fx.ring(target.x, target.y, 35, "#efbb70"); }
      else if (step.type === "race") r.charge = 3;
      else if (step.type !== "strike") r.charge = (r.charge ?? 0) + dt;
      const needed = step.type === "strike" ? 2 : step.type === "race" ? 1 : step.type === "dodge" ? 2.4 : 2;
      if ((r.charge ?? 0) >= needed) {
        r.visited.push(Number(target.data?.index)); r.progress++; r.charge = 0;
        g.floatText(target.x, target.y - 28, `${r.progress}/${step.count}`, "#a9e0a2", 16);
        g.fx.ring(target.x, target.y, 52, "#a9e0a2");
        if (r.progress >= step.count) { this.advance(a, r); return; }
      }
    } else r.charge = Math.max(0, (r.charge ?? 0) - dt * 1.5);
    // Pressure comes from the visible defenders created once at the start.
    // Killing them earns breathing room; no player-targeted phantom blast or
    // endlessly respawning patrol replaces them while this step is active.
    r.hitAt = undefined;
  }
  private syncJournal(a: AegeanActivity): void {
    const g = this.game, r = this.state.runs[a.id];
    if (!r) return;
    const q = g.quests.get(a.id) ?? g.quests.accept(a.id);
    if (q) q.progress = a.steps.map((s, i) => i < r.step ? s.count : i === r.step ? Math.min(s.count, r.progress) : 0);
  }
  update(dt: number): void {
    const g = this.game;
    this.autoCheck -= dt;
    if (!this.active && this.autoCheck <= 0) {
      this.autoCheck = .45;
      const candidate = AEGEAN_ACTIVITIES.find(a => (a.map ?? "overworld") === g.map.id &&
        !g.campaign.has(a.id) && !g.campaign.requirements(a.requires).length &&
        Math.hypot((a.tx + .5) * TILE - g.player.x, (a.ty + .5) * TILE - g.player.y) < 75);
      if (candidate) this.start(candidate.id);
    }
    const a = this.active;
    if (!a || g.map.id !== (a.map ?? "overworld")) return;
    this.syncJournal(a);
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
    if (this.actionStep(step)) {
      if (Math.hypot(g.player.x - anchor.x, g.player.y - anchor.y) > 470) { if (r.started) this.clearActors(a.id); r.started = false; r.charge = 0; r.hitAt = undefined; return; }
      this.updateAction(a, r, step, dt, stations);
      return;
    }
    if (r.retry) {
      if (Math.hypot(g.player.x - r.retry.x, g.player.y - r.retry.y) >= 96) r.retry.left = true;
      if (r.retry.left && Math.hypot(g.player.x - anchor.x, g.player.y - anchor.y) < 96) r.retry = undefined;
    }
    if ((step.type === "defend" || step.type === "escort") && !r.started && !r.retry && Math.hypot(g.player.x - anchor.x, g.player.y - anchor.y) < 180) {
      if (step.type === "defend") this.beginDefence(a, r); else this.beginEscort(a, r);
    }
    if (step.type === "interact" && step.count > 1) {
      for (const prop of stations) if (Number(prop.data?.index) > 0 && Math.hypot(prop.x - g.player.x, prop.y - g.player.y) < 38) {
        this.interact(prop); if (this.state.active !== a.id || a.steps[r.step] !== step) break;
      }
    }
    if (step.type === "visit") {
      for (const prop of stations)
        if (
          (Number(prop.data?.index) > 0 || !AEGEAN_ACTIVITY_SCENES[a.id].objects.length) &&
          Math.hypot(prop.x - g.player.x, prop.y - g.player.y) < 38
        ) {
          this.interact(prop);
          // The last visited object may have changed or completed this step.
          if (this.state.active !== a.id || a.steps[r.step] !== step) break;
        }
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
          `Return to ${anchor.label?.toLowerCase() ?? "the refuge"} and try again.`,
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
      const trail = this.trails.get(a.id) ?? [];
      this.trails.set(a.id, trail);
      const last = trail[trail.length - 1] ?? e;
      // Sample tightly enough to retain a player's turn on a narrow boardwalk.
      // Coarse samples let followers cut across the water inside a corner.
      if (d < 340 && Math.hypot(p.x - last.x, p.y - last.y) >= 3 && trail.length < 256)
        trail.push({ x: p.x, y: p.y });
      while (trail.length && Math.hypot(trail[0].x - e.x, trail[0].y - e.y) < 2) trail.shift();
      if (d > 35 && d < 340) {
        const next = trail[0] ?? p, distance = Math.hypot(next.x - e.x, next.y - e.y);
        const stride = Math.min(distance, 95 * dt), divisor = Math.max(1, distance);
        const nx = e.x + ((next.x - e.x) / divisor) * stride,
          ny = e.y + ((next.y - e.y) / divisor) * stride;
        const marine = anchor.data?.movement === "ship";
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
        // Resolve failure before touching the final checkpoint: a companion
        // lost on the arrival frame cannot deliver the reward.
        this.clearActors(a.id);
        r.escort = undefined;
        r.progress = 0; r.visited = []; r.timer = 0; r.wave = 0;
        r.started = false;
        r.retry = { x: p.x, y: p.y, left: false };
        g.toast(
          "Your companion retreats",
          `Return to ${anchor.label?.toLowerCase() ?? "the refuge"} to regroup.`,
          "#d4a465",
        );
        return;
      }
      const stop = stations.find(prop => Number(prop.data?.index) === r.progress + 1);
      if (stop && Math.hypot(stop.x - p.x, stop.y - p.y) < 55 && Math.hypot(stop.x - e.x, stop.y - e.y) < 90) this.interact(stop);
    }
  }
  draw(ctx: CanvasRenderingContext2D): void {
    const a = this.active;
    if (!a) return;
    const r = this.state.runs[a.id];
    if (!r) return;
    const step = this.current;
    if (step && this.game.map.id === (a.map ?? "overworld")) {
      ctx.save();
      const stations = this.stations(a.id), target = this.target;
      for (const prop of stations) {
        const index = Number(prop.data?.index ?? 0);
        if (r.visited.includes(index) || (!index && this.actionStep(step))) continue;
        const next = target?.x === prop.x && target?.y === prop.y;
        if (!next && !this.actionStep(step)) continue;
        ctx.strokeStyle = next ? "#b5e4a2" : "#d3b775"; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = next ? 3 : 1;
        ctx.globalAlpha = next ? .8 : .38;
        ctx.beginPath(); ctx.moveTo(prop.x - 10, prop.y - 22); ctx.lineTo(prop.x, prop.y - 14); ctx.lineTo(prop.x + 10, prop.y - 22); ctx.stroke();
        ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
        ctx.fillText(step.type === "strike" ? "HIT ×2" : step.type === "race" ? "RUN" : step.type === "channel" ? "HOLD" : step.type === "dodge" ? next ? "SHELTER" : "NEXT" : "HERE", prop.x, prop.y - 36);
        if (next && r.charge) { ctx.fillRect(prop.x - 20, prop.y - 30, Math.min(40, r.charge / 2.4 * 40), 3); }
      }
      ctx.restore();
    }
    if (!r.escort) return;
    const e = r.escort, companion = AEGEAN_ACTIVITY_SCENES[a.id].companion;
    const color = companion?.color ?? "#9edecb";
    ctx.save();
    ctx.fillStyle = "#182420";
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (companion?.kind === "light") {
      const bob = Math.sin(this.game.now * 3) * 2;
      ctx.fillStyle = color;
      ctx.fillRect(e.x - 3, e.y - 21 + bob, 6, 14);
      ctx.fillRect(e.x - 6, e.y - 18 + bob, 12, 8);
      ctx.fillStyle = "#edf6ce";
      ctx.fillRect(e.x - 2, e.y - 18 + bob, 4, 8);
    } else {
      const dx = this.game.player.x - e.x, dy = this.game.player.y - e.y;
      const moving = Math.hypot(dx, dy) > 35;
      const facing = Math.abs(dx) > Math.abs(dy) ? "right" : dy < 0 ? "up" : "down";
      const anim = ANIM[moving ? "walk" : "idle"];
      const frame = anim.from + Math.floor(this.game.now * anim.fps) % anim.frames;
      const sheet = getCharacterSheet({ ...DEFAULT_LOOK, shirt: color, armor: "robe",
        armorColor: color, armorTrim: "#bca274", hair: "#4a352c", hairStyle: "short",
        cape: companion?.kind === "standard" ? color : null });
      if (boxHitsTerrain(this.game.map, e.x, e.y, 9, 8)) {
        ctx.fillStyle = "#3c3029";
        ctx.fillRect(e.x - 20, e.y - 3, 40, 7);
        ctx.fillStyle = "#92673e";
        ctx.fillRect(e.x - 16, e.y - 5, 32, 7);
        ctx.fillStyle = "#c09b68";
        ctx.fillRect(e.x - 14, e.y - 4, 28, 2);
      }
      ctx.save();
      ctx.translate(Math.round(e.x), Math.round(e.y) + 6);
      if (facing === "right" && dx < 0) ctx.scale(-1, 1);
      if (companion?.kind === "shade") ctx.globalAlpha = 0.65;
      ctx.drawImage(sheet.canvas, frame * sheet.fw, ROW[facing] * sheet.fh, sheet.fw, sheet.fh,
        -sheet.fw / 2, -sheet.feet, sheet.fw, sheet.fh);
      ctx.restore();
      if (companion?.kind === "standard") {
        ctx.fillStyle = "#b7945d";
        ctx.fillRect(e.x + 10, e.y - 47, 2, 44);
        ctx.fillStyle = color;
        ctx.fillRect(e.x + 12, e.y - 45, 15, 17);
        ctx.fillStyle = "#d3b977";
        ctx.fillRect(e.x + 17, e.y - 41, 4, 9);
      } else if (companion?.kind === "cargo") {
        ctx.fillStyle = "#604630";
        ctx.fillRect(e.x + 5, e.y - 20, 13, 13);
        ctx.fillStyle = "#ad8558";
        ctx.fillRect(e.x + 6, e.y - 19, 11, 10);
        ctx.fillStyle = "#594a35";
        ctx.fillRect(e.x + 10, e.y - 19, 2, 10);
      }
    }
    ctx.fillStyle = "#243635";
    ctx.fillRect(e.x - 16, e.y - 48, 32, 3);
    ctx.fillStyle = color;
    ctx.fillRect(e.x - 16, e.y - 48, (32 * e.hp) / 100, 3);
    ctx.restore();
  }
}
