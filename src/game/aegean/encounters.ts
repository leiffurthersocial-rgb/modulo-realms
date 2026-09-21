import type { Game } from "../core/game";
import type { DamageOpts, ProjectileSpec } from "../core/world";
import { angleBetween, angleTo, dist, dirFromVector } from "../core/math";
import { Enemy } from "../entities/enemy";
import { boxHitsTerrain, findOpenNear, type PropInstance } from "../world/map";
import { TILE } from "../world/tiles";
import { AEGEAN_ATTACKS } from "../../data/aegean/enemies";
import { aegeanMinimumHit } from "../../data/aegean/damage";
import { ENEMY_BY_ID, type BossAttack } from "../../data/enemies";
import { AegeanNavigation } from "./navigation";
import type { AegeanPowersSave } from "./powers";

type Point = { x: number; y: number };
type RecordState = {
  steps: number[];
  chapter: number;
  bestPhase: number;
  completed: boolean;
};
export interface AegeanEncounterSave {
  version: 1;
  records: Record<string, RecordState>;
}
type Actor = { enemy: Enemy; role: string; index: number; roster?: number };
/** A real actor's pending throw/rally, never a detached damage footprint. */
type Warning = Point & {
  at: number;
  damage: number;
  label: string;
  source: Enemy;
  attackId: string;
  after?: (point: Point, reason: "hit" | "wall" | "range") => void;
};
type PracticePlayer = Pick<
  Game["player"],
  | "hp"
  | "mp"
  | "sp"
  | "gold"
  | "deaths"
  | "cooldowns"
  | "statuses"
  | "resistances"
  | "buffs"
  | "inventory"
  | "equipment"
  | "artifactCooldown"
  | "weaponPowerCooldown"
  | "offhandCooldown"
  | "reviveUsed"
  | "shield"
  | "shieldUntil"
  | "regen"
>;

export const ARMY_COMPANIES = [
  "Bronze",
  "Reed",
  "Ash",
  "Laurel",
  "Wolf",
  "Tide",
  "Ember",
  "Stone",
  "Sun",
  "Crown",
] as const;
// Retained only to read victories/checkpoints from pre-overhaul saves.
export const ARMY_CHAPTER_ENDS = [60, 150, 240, 300] as const;
export const ARMY_ROSTER = ARMY_COMPANIES.flatMap((company, c) =>
  Array.from({ length: 30 }, (_, i) => ({
    id: `aegean_army_${c}_${i}`,
    number: c * 30 + i,
    company,
    role:
      i < 20
        ? "hoplite"
        : i < 24
          ? "runner"
          : i < 27
            ? "javelin"
            : i < 29
              ? "shield"
              : "captain",
  })),
);
const PUZZLE_ONLY = new Set([
  "hind",
  "boar",
  "augeas",
  "bull",
  "hesperides",
  "cerberus",
  "titan",
]);
const COUNTS: Record<string, number> = {
  hydra: 5,
  mares: 4,
  leonidas: 8,
  army: 4,
};
const LABELS: Record<string, string> = {
  nemea: "Dodge the pounce. Bait a charge into a gold pillar to crack its hide.",
  hydra: "Cut the five heads. Step into each glowing wound to burn it shut.",
  hind: "Walk beside the hind with Brace. Protect it when it reaches sanctuary.",
  boar: "Bait the boar through the three snow pens. Dodge sideways as it charges.",
  augeas: "Stand on a sluice to open it. Fight through the flood while it turns.",
  birds: "Kill the bronze flock. Resonators stun birds when you stand beside them.",
  bull: "Break the three bull anchors with its own charge. Dodge sideways.",
  mares: "Lead each red-eyed mare through its matching paddock. Defeat Diomedes.",
  hippolyta: "Duel the Amazon queen. Hold a banner to call your allies' covering strike.",
  geryon: "Defeat all three bodies. Lead the cattle into shelters for safe ground.",
  hesperides: "Step into starlight. Carry the sky between glowing anchors before it falls.",
  cerberus: "Dodge the three heads. Approach during REST to fasten a restraint.",
  python: "Dodge the hunting coils. Stand by a vent to clear venom and stun Python.",
  medusa: "LOOK AWAY during the gaze. A mirror reflects it and breaks her stance.",
  minotaur: "Dodge the pursuit. Bait a charge into a labyrinth gate for a long opening.",
  chimera: "Dodge three different heads. Bait flame across a vent to stun the beast.",
  cyclops: "Keep moving under boulders. Land one on a crane weight to blind the eye.",
  talos: "Dodge Talos’s hammer and thrown cinders. Bait him onto a drain to spill his heat.",
  scylla: "Slay six hunting heads. Their beacon flames bind Charybdis; finish Scylla.",
  titan: "Clear chain horrors. Stand inside an anchor to repair it; dodge chain falls.",
  sanctuary_aegis: "Flank the sentinel. Stand at a mirror to turn its barrage back.",
  sanctuary_forge: "Dodge the furnace pulses. Stand at an anvil to vent the heat.",
  sanctuary_names: "Fight the keeper. Shelter at a grave to silence its echo strikes.",
};

const MECHANISM_CUES: Record<string, string> = {
  nemea: "BAIT CHARGE → STUN", hydra: "CUT HEAD → STEP IN FLAME",
  hind: "GUIDE HIND HERE", boar: "BAIT CHARGE → CAPTURE",
  augeas: "HOLD → DIVERT FLOOD", birds: "STAND → GROUND FLOCK",
  bull: "BAIT CHARGE → BREAK ANCHOR", mares: "LURE MARE HERE",
  hippolyta: "HOLD → ALLIED STRIKE", geryon: "HERD → SHELTER",
  hesperides: "CARRY SKY HERE", cerberus: "APPROACH RESTING HEADS",
  python: "STAND → CLEAR VENOM", medusa: "STAND → REFLECT GAZE",
  minotaur: "BAIT CHARGE → STUN", chimera: "BAIT FIRE → STUN",
  cyclops: "BAIT BOULDER → BLIND", talos: "LURE TALOS → DRAIN HEAT",
  scylla: "SLAY BOTH HEADS → LIGHT", titan: "CLEAR + HOLD → REPAIR",
  sanctuary_aegis: "STAND → REFLECT BARRAGE", sanctuary_forge: "STAND → COOL FORGE",
  sanctuary_names: "STAND → SILENCE ECHO",
};

/**
 * Owns encounter objectives and their actors. No objective is a kill-count skin:
 * each handler below changes damage windows, navigation, escorts, or controls.
 * Only complete army victories and explicit expedition checkpoints persist. Combat
 * actors and pending impacts are rebuilt on retry so reloading cannot duplicate
 * a reward, manufacture an army death, or leave an unreachable summoned enemy.
 */
export class AegeanEncounterDirector {
  objective = "";
  status = "";
  private records: Record<string, RecordState> = {};
  private id = "";
  private slug = "";
  private actors: Actor[] = [];
  private warnings: Warning[] = [];
  private props: PropInstance[] = [];
  private started = false;
  private waiting = false;
  private deadLastFrame = false;
  private clock = 0;
  private next = 0;
  private cycle = 0;
  private exposedUntil = 0;
  private holding = -1;
  private holdTime = 0;
  private wounds: Record<number, number> = {};
  private woundSites: Record<number, Point> = {};
  private sealed = new Set<number>();
  private armyDefeated = new Set<number>();
  private armyNext = 0;
  private autoHold = 0;
  private autoIndex = -1;
  private arenaPulse = 4.5;
  private lastCounterImpact = -1;
  private formationBreak: Record<number, number> = {};
  private brokenUntil: Record<number, number> = {};
  private phase = 0;
  private phaseIntroUntil = 0;
  private phaseObjective = 0;
  private guardWaves = 0;
  private guardHealUsed = new Set<number>();
  private finalSequence = 0;
  private carryDamage = 0;
  private practice = false;
  private practicePlayer: {
    player: PracticePlayer;
    powers?: AegeanPowersSave;
    at: number;
  } | null = null;
  private navigation = new AegeanNavigation();
  private guardNext = 0;
  private mechanismCooldowns: Record<number, number> = {};
  private groundedUntil: Record<number, number> = {};
  private gaze = 0;
  private endurance = 100;
  private carrying = false;
  private lastPlayer: Point = { x: 0, y: 0 };
  private lastHP = 0;
  private carryIndex = 0;

  constructor(private game: Game) {}

  get active(): boolean {
    return !!this.id;
  }
  get running(): boolean {
    return this.started && !this.waiting && (!this.record.completed || this.practice);
  }
  get isPractice(): boolean {
    return this.practice;
  }
  get exposureActive(): boolean {
    return this.exposedUntil > this.now;
  }
  cleansePressure(_kind: "petrify" | "fear" | "curse"): void {
    this.gaze = 0;
  }
  get suppressOffense(): boolean {
    return this.slug === "cerberus" && this.started && !this.record.completed;
  }
  get targetableObjectives(): Enemy[] {
    return this.actors
      .filter((a) => !a.enemy.dead && !a.enemy.friendly)
      .map((a) => a.enemy);
  }
  get armyStanding(): number {
    return 300 - this.armyDefeated.size;
  }
  get practicePhase(): number {
    return this.record.bestPhase;
  }

  /** Short, world-space instructions put each tool beside its actual effect. */
  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.id) return;
    const p = this.game.player;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 13px monospace";
    for (const [i, original] of this.props.entries()) {
      const prop = this.slug === "hydra" && this.woundSites[i] ? {...original, ...this.woundSites[i]} : original;
      if (this.distance(p, prop) > 1300) continue;
      const complete =
        this.done(i) ||
        this.record.completed ||
        (this.slug === "leonidas" && i < 4 && this.sealed.has(i));
      const live =
        this.slug === "hydra"
          ? (this.wounds[i] ?? 0) > this.now
          : this.slug === "leonidas"
            ? (this.phase === 1 && i < 4 && !this.sealed.has(i)) ||
              (this.phase >= 3 && i >= 4)
            : this.slug === "hesperides"
              ? i === (this.carrying ? (this.carryIndex + 1) % 3 : 0)
              : this.slug === "hind" ? i === this.record.steps.length : this.holding === i;
      const color = complete ? "#8fceb0" : live ? "#fff0b1" : "#d2b778";
      ctx.strokeStyle = color;
      ctx.fillStyle = "#18292be6";
      ctx.lineWidth = live ? 3 : 1.5;
      ctx.setLineDash(complete ? [] : [6, 5]);
      ctx.beginPath();
      ctx.ellipse(
        prop.x,
        prop.y + 7,
        39 + (live ? Math.sin(this.now * 3) * 3 : 0),
        19,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillRect(prop.x - 15, prop.y - 58, 30, 23);
      ctx.strokeRect(prop.x - 15, prop.y - 58, 30, 23);
      ctx.fillStyle = color;
      ctx.fillText(complete ? "✓" : String(i + 1), prop.x, prop.y - 46);
      if (!complete && this.distance(p, prop) < 470) {
        const cue = this.slug === "leonidas"
          ? (i < 4 ? "STAND → BREAK OATH / CHANT" : "STAND → DEFLECT WEAPONS")
          : (MECHANISM_CUES[this.slug] ?? "STAND → COUNTERSTRIKE");
        ctx.font = "bold 11px monospace";
        ctx.fillText(cue, prop.x, prop.y - 76);
        ctx.font = "bold 13px monospace";
      }
      if (this.slug === "hydra" && live) {
        ctx.fillStyle = "#ffe3ac";
        ctx.fillText(
          `${Math.max(0, Math.ceil(this.wounds[i] - this.now))}s`,
          prop.x,
          prop.y - 74,
        );
      }
      if (this.holding === i) {
        ctx.fillStyle = "#111c23";
        ctx.fillRect(prop.x - 36, prop.y + 32, 72, 6);
        ctx.fillStyle = "#a8dec2";
        ctx.fillRect(
          prop.x - 36,
          prop.y + 32,
          72 * Math.min(1, this.holdTime / 3),
          6,
        );
      }
    }
    // Required traversal mechanics get a nearby arrow and a lit target; the
    // player never has to decode an island name or consult a journal mid-fight.
    if (this.running) {
      let target: Point | undefined;
      if (this.slug === "hesperides") target = this.at(this.carrying ? (this.carryIndex + 1) % 3 : 0);
      else if (this.slug === "hind" && !this.allSteps()) target = this.at(this.record.steps.length);
      else if (this.slug === "hydra") target = Object.keys(this.wounds).map(Number)
        .filter((i) => !this.sealed.has(i)).map((i) => this.at(i)).sort((a,b) => this.distance(p,a)-this.distance(p,b))[0];
      else if (["boar","bull","augeas","titan"].includes(this.slug))
        target = this.props.filter((_prop,i) => !this.done(i)).sort((a,b) => this.distance(p,a)-this.distance(p,b))[0];
      if (target && this.distance(p,target)>150) {
        const angle=angleTo(p.x,p.y,target.x,target.y), x=p.x+Math.cos(angle)*78, y=p.y+Math.sin(angle)*78;
        ctx.save();ctx.translate(x,y);ctx.rotate(angle);
        ctx.fillStyle="#ffe7a1";ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-8,-8);ctx.lineTo(-3,0);ctx.lineTo(-8,8);ctx.closePath();ctx.fill();ctx.restore();
      }
      if (this.slug === "mares") for (const a of this.actors.filter((actor) => actor.role === "mare" && !actor.enemy.friendly)) {
        if (this.distance(p,a.enemy)>500) continue;
        ctx.fillStyle="#ffcf9d";ctx.fillText(`MARE ${a.index+1} → PEN ${a.index+1}`,a.enemy.x,a.enemy.y-a.enemy.radius*2-20);
      }
    }
    if (this.boss && this.running) {
      const b = this.boss;
      if (this.slug === "medusa" && this.gaze > 1 && this.sourceVisible(b) && this.clearSight(b, p)) {
        // Her eyes and the connected gaze are the attack; there is no remote
        // ground marker to mistake for an unseen caster or a random trap.
        ctx.strokeStyle = `rgba(163,217,125,${Math.min(.75, .2 + this.gaze / 140)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(b.x - 5, b.y - b.radius * 1.5); ctx.lineTo(p.x, p.y - 16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(b.x + 5, b.y - b.radius * 1.5); ctx.lineTo(p.x, p.y - 16); ctx.stroke();
      }
      const cue = this.slug === "medusa" && Math.floor(this.clock / 3.6) % 2 === 0 && !this.exposureActive
        ? "LOOK AWAY!" : this.slug === "cerberus" && this.exposureActive
          ? "REST · APPROACH TO RESTRAIN" : this.exposureActive ? "STAGGERED · STRIKE!" : "";
      if (cue) { ctx.fillStyle = "#ffddb0"; ctx.fillText(cue,b.x,b.y-b.radius*2-32); }
    }
    if (this.slug === "army" && !this.record.completed) {
      for (const a of this.living) {
        if (a.role !== "captain" || this.distance(p, a.enemy) > 1000) continue;
        ctx.fillStyle = "#f5d186";
        ctx.fillText(a.enemy.windupAttack ? "BREAK THE ORDER!" : "CAPTAIN · BREAK SHIELDS",
          a.enemy.x, a.enemy.y - a.enemy.radius * 2 - 22);
      }
    }
    if (this.slug === "leonidas") {
      const point = this.node("safe");
      ctx.strokeStyle = "#a2d3c3";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(point.x - 100, point.y - 35, 200, 70);
      ctx.setLineDash([]);
      ctx.fillStyle = "#a2d3c3";
      ctx.font = "11px monospace";
      ctx.fillText("RETREAT LANE", point.x, point.y + 50);
      if (this.practice) {
        ctx.fillStyle = "#ceceef";
        ctx.fillText("PRACTICE ECHO · NO REWARDS", p.x, p.y - 88);
      }
    }
    ctx.restore();
  }

  private get record(): RecordState {
    return (
      this.records[this.id] ??
      (this.records[this.id] = {
        steps: [],
        chapter: 0,
        bestPhase: 0,
        completed: false,
      })
    );
  }
  private get boss(): Enemy | undefined {
    return this.actors.find((a) => a.role === "boss" && !a.enemy.dead)?.enemy;
  }
  private get living(): Actor[] {
    return this.actors.filter((a) => !a.enemy.dead && !a.enemy.friendly);
  }
  private get now(): number {
    return this.game.now;
  }
  private node(name: string, index = 0): Point {
    const map = this.game.map as typeof this.game.map & {
      encounterNodes?: Record<string, Point[]>;
    };
    const list = map.encounterNodes?.[name];
    if (list?.length) return list[index % list.length];
    return { x: map.w * TILE * 0.5, y: map.h * TILE * 0.5 };
  }
  private at(index: number): Point {
    return (this.slug === "hydra" ? this.woundSites[index] : undefined) ?? this.props[index] ?? this.node("enemy", index);
  }
  private distance(a: Point, b: Point): number {
    return dist(a.x, a.y, b.x, b.y);
  }
  private say(message: string): void {
    this.game.floatText(
      this.game.player.x,
      this.game.player.y - 52,
      message,
      "#e2d19b",
      13,
    );
  }
  private powerEvent(
    event: "onInterrupt" | "onStagger" | "onHazardExit",
    enemy?: Enemy,
  ): void {
    const powers = (
      this.game as Game & {
        powers?: Partial<
          Record<
            "onInterrupt" | "onStagger" | "onHazardExit",
            (enemy?: Enemy) => void
          >
        >;
      }
    ).powers;
    powers?.[event]?.(enemy);
  }
  private move(enemy: Enemy, point: Point, speed = 1): void {
    this.navigation.move(enemy, this.game, point, speed);
  }
  private done(index: number): boolean {
    return this.record.steps.includes(index);
  }
  private mark(index: number, label = "Objective secured"): void {
    if (this.done(index)) return;
    this.record.steps.push(index);
    const prop = this.props[index];
    if (prop) {
      prop.data = { ...prop.data, complete: true };
      prop.lightColor = "#a6d8bb";
      prop.light = 75;
    }
    this.game.ringAt(this.at(index).x, this.at(index).y, 92, "#a6d8bb");
    if (
      ["nemea", "minotaur", "chimera", "cyclops", "talos", "medusa"].includes(
        this.slug,
      )
    )
      this.powerEvent("onStagger", this.boss);
    this.say(label);
  }
  private count(): number {
    return COUNTS[this.slug] ?? 3;
  }
  private allSteps(): boolean {
    return this.record.steps.length >= this.count();
  }

  snapshot(): AegeanEncounterSave {
    return {
      version: 1,
      records: Object.fromEntries(
        Object.entries(this.records).map(([id, r]) => [
          id,
          { ...r, steps: [...r.steps] },
        ]),
      ),
    };
  }
  restore(data: unknown): void {
    this.records = {};
    if (!data || typeof data !== "object") {
      this.records = {};
      this.practicePlayer = null;
      return;
    }
    const value = data as Partial<AegeanEncounterSave>;
    if (
      value.version !== 1 ||
      !value.records ||
      typeof value.records !== "object"
    )
      return;
    for (const [id, r] of Object.entries(value.records)) {
      if (!id.startsWith("aegean_") || !r || typeof r !== "object") continue;
      this.records[id] = {
        steps: Array.isArray(r.steps)
          ? [
              ...new Set(
                r.steps.filter((n) => Number.isInteger(n) && n >= 0 && n < 12),
              ),
            ]
          : [],
        chapter: Math.max(0, Math.min(4, Math.floor(Number(r.chapter) || 0))),
        bestPhase: Math.max(
          0,
          Math.min(5, Math.floor(Number(r.bestPhase) || 0)),
        ),
        completed: r.completed === true,
      };
    }
  }

  onMapEntered(): void {
    this.restorePracticePlayer();
    this.clearActors();
    const id = this.game.map.id;
    this.id =
      (id.startsWith("aegean_") && ENEMY_BY_ID[id]) || id === "aegean_army"
        ? id
        : "";
    this.slug = this.id.replace(/^aegean_/, "");
    this.objective = "";
    this.status = "";
    this.props = this.game.map.props
      .filter((p) => p.interact === "aegean" && p.data?.action === "objective")
      .sort(
        (a, b) =>
          Number(a.data?.index ?? a.data?.order ?? 0) -
          Number(b.data?.index ?? b.data?.order ?? 0),
      );
    this.started = false;
    this.waiting = false;
    this.deadLastFrame = false;
    this.practice = false;
    if (!this.id) return;
    if (this.game.aegeanHas(this.id)) this.record.completed = true;
    if (this.slug === "army") {
      // Old partial chapters do not become phantom kills in the new single battle.
      this.record.chapter = this.record.completed ? 4 : 0;
      this.armyDefeated = new Set(this.record.completed ? ARMY_ROSTER.map((s) => s.number) : []);
    }
    this.objective = this.record.completed
      ? "This oath is complete. Use the shrine for an optional rematch."
      : (LABELS[this.slug] ??
        "Read the champion’s pattern; use the three training stations to make openings.");
    this.status = this.record.completed
      ? "Completed"
      : "The encounter is live.";
    if (!this.record.completed) this.begin();
  }

  private clearActors(): void {
    for (const a of this.actors) a.enemy.dead = true;
    this.actors = [];
    this.warnings = [];
    this.navigation.clear();
  }
  private resetRuntime(): void {
    this.clearActors();
    this.clock = 0;
    this.next = 0.85;
    this.cycle = 0;
    this.exposedUntil = 0;
    this.holding = -1;
    this.holdTime = 0;
    this.wounds = {};
    this.woundSites = {};
    this.sealed.clear();
    this.phaseObjective = 0;
    this.guardWaves = 0;
    this.guardHealUsed.clear();
    this.finalSequence = 0;
    this.carryDamage = 0;
    this.phaseIntroUntil = 0;
    this.gaze = 0;
    this.endurance = 100;
    this.carrying = false;
    this.carryIndex = 0;
    this.guardNext = 3;
    this.mechanismCooldowns = {};
    this.groundedUntil = {};
    this.lastPlayer = { x: this.game.player.x, y: this.game.player.y };
    this.lastHP = this.game.player.hp;
    this.formationBreak = {};
    this.brokenUntil = {};
    this.autoHold = 0;
    this.autoIndex = -1;
    this.arenaPulse = 4.5;
    this.lastCounterImpact = -1;
  }
  private begin(): void {
    this.resetRuntime();
    this.started = true;
    this.waiting = false;
    // Temporary combat progress is reset; expedition valve/anchor work is durable.
    if (!["augeas", "titan"].includes(this.slug)) this.record.steps = [];
    if (this.slug === "army") {
      this.record.chapter = 0;
      this.armyDefeated.clear();
      this.armyNext = 0;
      this.deployArmy();
      this.objective = "300 soldiers. One battlefield. Kill captains to break their companies' shields.";
      return;
    }
    const initial = ["hind", "boar", "bull"].includes(this.slug)
      ? this.at(0)
      : this.node("boss", 0);
    const principal = this.spawn(this.id, "boss", 0, initial);
    principal.scripted = true;
    principal.friendly = PUZZLE_ONLY.has(this.slug) || this.slug === "hydra";
    if (this.slug === "scylla") principal.friendly = true;
    this.game.bossTarget = principal;
    if (this.slug === "leonidas") {
      this.phase = this.practice ? this.phase : 0;
      principal.phase = this.phase;
      principal.hp =
        principal.maxHp * [1, 0.82, 0.64, 0.42, 0.18, 0.05][this.phase];
      this.enterLeonidasPhase();
    } else if (this.slug === "hydra") {
      for (let i = 0; i < 5; i++) this.spawnHydraHead(i);
    } else if (this.slug === "mares") {
      for (let i = 0; i < 4; i++) {
        const a = this.spawn(
          "aegean_man_eating_mare",
          "mare",
          i,
          this.node("arena"),
        );
        a.scripted = true;
        a.def = { ...a.def, name: `Mare ${i + 1} of Diomedes` };
      }
    } else if (this.slug === "hippolyta") {
      principal.friendly = false;
      for (let i = 0; i < 2; i++) {
        const a = this.spawn("aegean_hoplite", "ally", i, this.node("entry"));
        a.friendly = true;
        a.scripted = true;
      }
    } else if (this.slug === "geryon") {
      for (let i = 0; i < 2; i++) {
        const a = this.spawn("aegean_stag", "herd", i, this.node("entry"));
        a.friendly = true;
        a.scripted = true;
        a.def = { ...a.def, name: "Cattle of the Red Herd" };
      }
      for (let i = 0; i < 2; i++) {
        const body = this.spawn("aegean_centaur_elder", "body", i, this.node("enemy", i + 1));
        body.scripted = true;
        body.def = {...body.def, name: i ? "Geryon's arrow-body" : "Geryon's spear-body", creature: principal.def.creature, kind: principal.def.kind, scale: 1.15};
        body.radius = body.def.radius * 1.15;
        body.maxHp = body.hp = 3600;
        body.damage = principal.damage * .65;
      }
    } else if (this.slug === "scylla") {
      for (let i = 0; i < 3; i++) this.spawnStraitHeads(i);
    }
    this.objective =
      LABELS[this.slug] ??
      "Defeat the champion. Nearby tools buy counterattack openings.";
  }
  private spawn(
    id: string,
    role: string,
    index: number,
    point: Point,
    roster?: number,
  ): Enemy {
    const def = ENEMY_BY_ID[id];
    const pos = findOpenNear(this.game.map, point.x, point.y, 16, 12);
    const e = new Enemy(id, pos.x, pos.y, def?.level ?? 98, {
      boss: !!def?.boss,
    });
    e.state = "chase";
    e.attackCd = 0.55 + (index % 5) * 0.12;
    if (def?.boss) {
      e.maxHp = Math.min(e.maxHp, id === "aegean_leonidas" ? 40000 : 30000);
      e.hp = e.maxHp;
    }
    if (roster !== undefined) e.spawnId = ARMY_ROSTER[roster].id;
    this.actors.push({ enemy: e, role, index, roster });
    this.game.enemies.push(e);
    return e;
  }
  private adds(
    count: number,
    id = "aegean_oath_shade",
    point: Point = this.game.player,
  ): void {
    const existing = this.actors.filter(
      (a) => a.role === "add" && !a.enemy.dead,
    ).length;
    for (let i = 0; i < Math.min(count, 4 - existing); i++) {
      const angle = (i / Math.max(1, count)) * Math.PI * 2;
      this.spawn(id, "add", i, {
        x: point.x + Math.cos(angle) * 155,
        y: point.y + Math.sin(angle) * 155,
      });
    }
  }
  private addCount(): number {
    return this.actors.filter((a) => a.role === "add" && !a.enemy.dead).length;
  }
  private sourceVisible(source: Enemy): boolean {
    if (source.dead || !this.game.enemies.includes(source) || this.distance(source, this.game.player) > 560) return false;
    const camera = this.game.camera, canvas = this.game.canvas;
    // Runtime checks the actual viewport. Headless fixtures use the same
    // conservative local distance instead of inventing a browser viewport.
    if (!camera || !canvas) return true;
    return Math.abs(source.x - camera.x) < canvas.width / (2 * camera.zoom) + source.radius &&
      Math.abs(source.y - camera.y) < canvas.height / (2 * camera.zoom) + source.radius;
  }
  private clearSight(from: Point, to: Point): boolean {
    const steps = Math.max(1, Math.ceil(this.distance(from, to) / (TILE / 2)));
    for (let i = 1; i < steps; i++)
      if (boxHitsTerrain(this.game.map, from.x + (to.x - from.x) * i / steps,
        from.y + (to.y - from.y) * i / steps, 2, 2)) return false;
    return true;
  }
  private warn(
    point: Point,
    radius: number,
    delay: number,
    damage: number,
    label: string,
    color = "#ddb778",
    after?: Warning["after"],
    source = this.boss,
    sprite?: ProjectileSpec["sprite"],
  ): void {
    if (!source || !this.sourceVisible(source) || (damage > 0 && source.windupAttack)) return;
    const attackId = `encounter:${label}:${this.now}`;
    const pending: Warning = {...point, at: this.now + (damage > 0 ? delay + 5 : delay), damage, label, source, attackId, after};
    if (damage <= 0) {
      this.game.floatText(source.x, source.y - source.radius * 2, "RALLY — interrupt", color, 14);
      this.warnings.push(pending);
      return;
    }
    const kind = sprite ?? (/CHAIN|chain/.test(label) ? "chain" : /VENOM|FLOOD|surge/i.test(label) ? "spit" :
      /cinder|molten/i.test(label) ? "ember" : /spear|king|oath/i.test(label) ? "spear" : "boulder");
    // The projectile leaves the raised hand/mouth, up to 28px above the feet.
    // Let queueAttack clamp from that true origin so southward throws do not
    // expire just short of the target because of a feet-to-feet range budget.
    const range = Math.min(640, Math.max(85, this.distance(source, point) + 32));
    source.attackCd = 0;
    const queued = source.queueAttack(this.game, {
      id: attackId, name: label, shape: "projectile", windup: Math.max(.85, delay), cooldown: 2.2,
      power: damage / Math.max(1, source.damage), count: 1, range,
      radius: Math.max(9, Math.min(18, radius * .2)), projectileSpeed: kind === "spear" ? 290 : 225,
      projectileSprite: kind, physical: kind === "spear" ? "spear" : kind === "shield" ? "shield" : kind === "arrow" ? "bow" :
        kind === "feather" ? "wing" : kind === "chain" ? "tendril" : kind === "spit" || kind === "ember" ? "spit" : "boulder",
      element: /VENOM/i.test(label) ? "poison" : /cinder|molten/i.test(label) ? "fire" : "physical", color,
      onImpact: (impact, reason) => {
        if (!this.warnings.includes(pending)) return;
        this.warnings = this.warnings.filter(w => w !== pending);
        if (!this.running || !this.sourceVisible(source)) return;
        if (reason === "range") this.powerEvent("onHazardExit");
        after?.(impact, reason);
      },
    }, point);
    if (queued) this.warnings.push(pending);
  }
  private line(
    point: Point,
    angle: number,
    length: number,
    delay: number,
    damage: number,
    label: string,
    after?: Warning["after"],
  ): void {
    // A spear travels from its visible owner. The old full-lane rectangle no
    // longer damages everything in the lane in a single frame.
    this.warn({x: point.x + Math.cos(angle) * length, y: point.y + Math.sin(angle) * length},
      50, delay, damage, label, "#d5bf87", after, this.boss, "spear");
  }
  private resolveWarnings(): void {
    const pending = this.warnings;
    this.warnings = [];
    for (const w of pending) {
      if (!this.sourceVisible(w.source)) {
        if (w.source.windupAttack?.id === w.attackId) {
          w.source.cancelAttack();
        }
        continue;
      }
      if (w.at > this.now) this.warnings.push(w);
      else if (w.damage <= 0) w.after?.(w.source, "range");
      // Damage is delivered only by the actual flying projectile; this timer
      // merely discards stale bookkeeping if a throw was interrupted.
    }
  }

  update(dt: number): void {
    if (!this.id) return;
    if (this.game.player.dead) {
      this.deadLastFrame = true;
      return;
    }
    if (this.deadLastFrame) {
      this.deadLastFrame = false;
      this.started = false;
      this.resetRuntime();
      return;
    }
    if (!this.started) {
      if (!this.waiting && !this.record.completed) this.begin();
      return;
    }
    if (this.waiting || (this.record.completed && !this.practice)) return;
    this.clock += dt;
    this.next -= dt;
    this.resolveWarnings();
    if (this.slug === "army") {
      this.updateArmy(dt);
      return;
    }
    if (this.slug === "leonidas") {
      this.updateLeonidas(dt);
      if (this.started) this.updateArenaTools(dt);
      return;
    }
    this.updateAdventure(dt);
    if (this.started) this.updateArenaTools(dt);
    this.lastPlayer = { x: this.game.player.x, y: this.game.player.y };
    this.lastHP = this.game.player.hp;
  }

  private attack(
    e: Enemy | undefined,
    key: string,
    extra: Partial<BossAttack> = {},
  ): boolean {
    if (!e || !this.sourceVisible(e)) return false;
    const pattern = e.def.boss?.attacks.find((a) => a.id === key) ?? AEGEAN_ATTACKS[key];
    if (!pattern) return false;
    return e.queueAttack(this.game, { ...pattern, ...extra });
  }
  private updateAdventure(dt: number): void {
    const p = this.game.player,
      boss = this.boss;
    if (this.slug === "scylla") {
      this.updateStrait(dt);
      return;
    }
    this.status = PUZZLE_ONLY.has(this.slug)
      ? `${this.record.steps.length}/${this.count()} secured`
      : this.exposedUntil > this.now ? "OPENING · +35% DAMAGE" : "DODGE · FLANK · COUNTER";
    if (
      boss &&
      !boss.windupAttack &&
      !["hind", "hesperides", "titan", "scylla", "talos"].includes(this.slug)
    ) {
      const distance = this.distance(boss, p);
      if (this.slug === "champion_volley" && distance < 210) {
        const angle = angleTo(p.x,p.y,boss.x,boss.y);
        this.move(boss,{x:boss.x+Math.cos(angle)*160,y:boss.y+Math.sin(angle)*160},1.15);
      } else if (distance > (this.slug === "champion_volley" ? 290 : 100))
        this.move(boss,p,this.slug === "medusa" ? .9 : 1.25);
    }
    if (this.slug === "hydra") {
      this.updateHydra();
      return;
    }
    if (this.slug === "hind") {
      this.updateHind(dt);
      return;
    }
    if (this.slug === "hesperides") {
      this.updateSky(dt);
      return;
    }
    if (this.slug === "cerberus") {
      this.updateCerberus(dt);
      return;
    }
    if (this.slug === "hippolyta") this.updateStandard(dt);
    if (this.slug === "geryon") {
      for (const a of this.living.filter((a) => a.role === "body")) {
        const e=a.enemy;
        if (!e.windupAttack && this.distance(e,p) > (a.index ? 280 : 100)) this.move(e,p,1.15);
        if (!e.windupAttack && e.attackCd <= 0 && this.sourceVisible(e) &&
          this.living.filter(actor => !!actor.enemy.windupAttack).length < 2) {
          const pattern=ENEMY_BY_ID.aegean_geryon.boss!.attacks[a.index ? 2 : 1];
          e.queueAttack(this.game,{...pattern,windup:.85,power:1.05});
        }
      }
      for (const a of this.actors.filter((a) => a.role === "herd")) {
        if (this.distance(a.enemy, p) < 460 && this.distance(a.enemy, p) > 55)
          this.move(a.enemy, { x: p.x - 35 - a.index * 25, y: p.y + 40 }, 1.1);
      }
      if (
        !boss &&
        !this.living.some((a) => a.role === "body")
      )
        this.finish();
    }
    if (this.slug === "medusa" && boss) {
      // Attacks turn the rendered body via dir; facing is only the last movement
      // heading. Looking away once must not permit firing at her indefinitely.
      const facing = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[p.dir];
      const gazing =
        Math.floor(this.clock / 3.6) % 2 === 0 &&
        this.sourceVisible(boss) && this.clearSight(boss, p) &&
        this.exposedUntil <= this.now;
      const looking =
        angleBetween(facing, angleTo(p.x, p.y, boss.x, boss.y)) < Math.PI / 3;
      this.gaze = Math.max(
        0,
        Math.min(100, this.gaze + dt * (gazing && looking ? 32 : -40)),
      );
      this.status += ` · Petrification ${Math.round(this.gaze)}%${gazing ? " — LOOK AWAY" : ""}`;
      if (this.gaze >= 100) {
        this.gaze = 0;
        this.game.damagePlayer(boss.damage * 2.4, {
          minHealthDamage: 0.18, element: "arcane", label: "Petrifying gaze",
          fromX: boss.x, fromY: boss.y,
        });
        this.say("PETRIFIED — break line of sight or use a mirror!");
      }
    }
    if (this.slug === "talos" && boss) {
      const station = this.at(this.record.steps.length % 3);
      if (!boss.windupAttack && this.distance(boss, station) > 80)
        this.move(boss, this.distance(p, boss) > 440 ? p : station, 1.1);
      this.status +=
        this.distance(boss, station) < 170
          ? " · Ankle seal in reach"
          : " · Talos approaches the next station";
    }
    if (this.holding >= 0 && this.slug === "titan") {
      if (
        this.distance(p, this.at(this.holding)) < 100 &&
        this.addCount() === 0
      ) {
        this.holdTime += dt;
        this.status += ` · Repair ${Math.floor(this.holdTime)}/3s`;
        if (this.holdTime >= 3) {
          this.mark(this.holding);
          this.holding = -1;
          this.holdTime = 0;
          if (this.allSteps()) this.finish();
        }
      } else this.holdTime = 0;
    }
    if (this.slug === "augeas" && this.allSteps() && this.addCount() === 0)
      this.finish();
    if (
      this.slug === "birds" &&
      this.allSteps() &&
      this.addCount() === 0 &&
      !boss
    )
      this.finish();
    if (this.slug === "mares")
      for (const a of this.actors.filter(
        (a) => a.role === "mare" && !a.enemy.friendly,
      )) {
        if (this.distance(a.enemy, p) > 85) this.move(a.enemy, p, 0.95);
        if (
          !a.enemy.windupAttack &&
          a.enemy.attackCd <= 0 &&
          this.actors.filter(actor => actor.role === "mare" && !!actor.enemy.windupAttack).length < 1 &&
          this.distance(a.enemy, p) < 220
        )
          this.attack(a.enemy, ["thrust", "charge", "sweep", "thrust"][a.index], {
            name: ["MARE'S BITE — sidestep", "TRAMPLE — sidestep", "HOOF SWEEP — get behind", "RAVENOUS BITE — sidestep"][a.index],
            element: "physical", color: "#d29a7d", power: 0.95, windup: 0.6,
          });
      }
    if (!this.started) return;
    this.updateArenaPressure(dt, boss);
    if (this.next > 0 || !boss || boss.windupAttack) return;
    this.cycle++;
    this.next = this.slug === "cyclops" || this.slug === "talos" ? 3 : 2.2;
    boss.attackCd = 0;
    if (this.slug === "cyclops" && this.cycle % 2 === 1) {
      const target = { x: p.x, y: p.y };
      this.warn(target, 78, 0.95, boss.damage * 1.8, "BOULDER — keep moving", "#c9b992", (impact) => {
        const i = this.props.findIndex((prop, index) => this.distance(prop, impact) < 155 && !this.done(index));
        if (i >= 0) {
          this.wounds[i] = this.now + 7;
          this.mark(i, "CRANE STRIKE — Cyclops blinded!");
          this.openCounter(boss, 3);
        }
      });
      return;
    }
    if (["augeas", "titan"].includes(this.slug)) {
      this.warn({ x: p.x, y: p.y }, this.slug === "titan" ? 100 : 76, 0.95,
        boss.damage * 1.35, this.slug === "titan" ? "CHAIN THROW — sidestep" : "SLUDGE SPIT — sidestep",
        this.slug === "titan" ? "#d78c65" : "#76bccc");
      return;
    }
    // Each enemy definition owns its physical attack deck: committed charges,
    // weapon combinations, thrown objects and aimed spits.
    const patterns = boss.def.boss?.attacks ?? [];
    if (patterns.length) {
      const pattern = patterns[(this.cycle - 1) % patterns.length];
      boss.queueAttack(this.game, pattern);
    }
    if (this.slug === "champion_guard" && this.cycle % 4 === 0)
      this.adds(1, "aegean_royal_guard");
  }

  /** Occasional extra moves belong to the visible monster. They never create
   * a second, sourceless attack field while its regular attack is winding up. */
  private updateArenaPressure(dt: number, boss?: Enemy): void {
    if (!boss) return;
    this.arenaPulse -= dt;
    if (this.arenaPulse > 0) return;
    this.arenaPulse = 7.5;
    if (!this.sourceVisible(boss) || boss.windupAttack || this.warnings.length) return;
    const p = this.game.player;
    const anchor = this.props.findIndex(prop => this.distance(prop, p) < 140);
    if (anchor >= 0 && (this.groundedUntil[anchor] ?? 0) > this.now) return;
    if (this.slug === "python") {
      this.warn(p, 52, 1.1, boss.damage * .8, "PYTHON'S VENOM SPIT", "#a7bc64", undefined, boss, "spit");
    } else if (this.slug === "minotaur") {
      this.attack(boss, "charge", {name: "MINOTAUR CHARGE", windup: 1.05, power: .95});
    } else if (this.slug === "chimera") {
      const venom = this.cycle % 2 === 0;
      this.warn(p, 68, 1.15, boss.damage * .85, venom ? "SERPENT'S VENOM" : "GOAT'S CINDER",
        venom ? "#a8bf65" : "#ef9565", undefined, boss, venom ? "spit" : "ember");
    } else if (this.slug === "birds" || this.slug === "champion_volley") {
      this.warn(p, 60, 1.1, boss.damage * .85, this.slug === "birds" ? "BRONZE FEATHER" : "CHAMPION'S ARROW",
        "#d5bc7c", undefined, boss, this.slug === "birds" ? "feather" : "arrow");
    } else if (this.slug === "sanctuary_forge" || this.slug === "talos") {
      this.warn(p, 75, 1.2, boss.damage * .9, "FURNACE CINDER", "#ee9463", undefined, boss, "ember");
    } else if (this.slug === "sanctuary_names") {
      this.warn(p, 60, 1.2, boss.damage * .85, "KEEPER'S THROWN CHAIN", "#b9b1de", undefined, boss, "chain");
    }
  }

  private openCounter(boss: Enemy, seconds = 2): void {
    boss.cancelAttack();
    this.warnings = this.warnings.filter(w => w.source !== boss);
    // Deflection shatters actual incoming objects, with sparks at each object.
    // This replaces the old invisible deletion of a promised damage circle.
    for (const shot of this.game.projectiles ?? []) {
      if (shot.dead || shot.sourceId !== boss.id) continue;
      shot.dead = true;
      this.game.particles(shot.x, shot.y, 5, shot.color, {speed: 45, life: .3});
    }
    boss.attackCd = Math.max(boss.attackCd, seconds);
    this.next = Math.max(this.next, seconds);
    this.exposedUntil = this.now + seconds + 2;
    this.powerEvent("onStagger", boss);
  }

  /** No hidden order and no repeated E taps: lures, proximity and holding
   * ground perform the tool's visible action. E remains an optional shortcut. */
  private updateArenaTools(dt: number): void {
    const p = this.game.player, boss = this.boss;
    const near = this.props.findIndex((_prop, i) => this.distance(this.at(i), p) < 82 &&
      (!this.done(i) || this.slug === "leonidas" || this.slug === "hesperides"));
    if (near !== this.autoIndex) { this.autoIndex = near; this.autoHold = 0; }
    if (near >= 0) this.autoHold += dt;
    else this.autoHold = 0;
    if (["nemea", "boar", "bull", "minotaur"].includes(this.slug) && boss?.lastImpact?.id === "charge" &&
        boss.lastImpact.at !== this.lastCounterImpact && this.now - boss.lastImpact.at < 1.2) {
      const index = this.props.findIndex((prop, i) => !this.done(i) && this.distance(prop, boss) < 225);
      if (index >= 0) { this.lastCounterImpact = boss.lastImpact.at; this.useObjective(index); }
    }
    if (this.slug === "chimera" && (boss?.lastImpact?.id === "flame" || boss?.lastImpact?.id === "chimera_furnace") && boss.lastImpact.at !== this.lastCounterImpact) {
      const index = this.props.findIndex((prop, i) => !this.done(i) && this.distance(prop, boss.lastImpact!) < 330 &&
        (boss.lastImpact!.id === "chimera_furnace" || angleBetween(boss.lastImpact!.angle, angleTo(boss.lastImpact!.x, boss.lastImpact!.y, prop.x, prop.y)) < 0.55));
      if (index >= 0) { this.lastCounterImpact = boss.lastImpact.at; this.useObjective(index); }
    }
    if (this.slug === "mares") {
      for (const a of this.actors.filter((a) => a.role === "mare" && !a.enemy.friendly))
        if (this.distance(a.enemy, this.at(a.index)) < 105) this.useObjective(a.index);
      if (this.allSteps() && !boss) this.finish();
    }
    if (this.slug === "cerberus" && boss && this.exposureActive && this.distance(p, boss) < 155) {
      this.mark(this.record.steps.length, "RESTRAINT FASTENED");
      this.exposedUntil = 0;
      this.next = 0.9;
      if (this.allSteps()) this.finish();
      return;
    }
    if (near < 0 || this.autoHold < 0.7) return;
    const usable = this.slug === "hydra" ? (this.wounds[near] ?? 0) > this.now
      : this.slug === "hind" ? !!boss && this.distance(boss, this.at(near)) < 130 && this.gaze < 40 && near === this.record.steps.length
      : this.slug === "talos" ? !!boss && this.distance(boss, this.at(near)) < 210 && !boss.windupAttack
      : ["birds", "augeas", "python", "medusa", "hesperides", "hippolyta", "geryon", "titan", "leonidas", "sanctuary_aegis", "sanctuary_forge", "sanctuary_names"].includes(this.slug)
        || this.slug.startsWith("champion_");
    if (usable && (this.mechanismCooldowns[near] ?? 0) <= this.now) {
      this.useObjective(near);
      this.autoHold = 0;
      this.mechanismCooldowns[near] = Math.max(this.mechanismCooldowns[near] ?? 0, this.now + 2);
    }
  }

  /** All six heads hunt immediately. Their paired deaths light the associated
   * beacon automatically, so fighting the monster is the actual objective. */
  private spawnStraitHeads(index: number): void {
    const boss = this.boss;
    if (!boss) return;
    const point = this.at(index);
    for (let head = 0; head < 2; head++) {
      const number = index * 2 + head;
      const enemy = this.spawn("aegean_scylla_head", "strait_head", number,
        {x: point.x + (head ? 110 : -110), y: point.y - 45});
      enemy.scripted = true;
      enemy.def = {...enemy.def, name: `Scylla’s hunting head ${number + 1}`};
      enemy.maxHp = Math.min(1900, boss.maxHp * 0.07);
      enemy.hp = enemy.maxHp;
      enemy.damage = boss.damage * 0.7;
    }
  }
  private useStraitBeacon(index: number): void {
    if (this.done(index)) return;
    if (![index * 2, index * 2 + 1].every((head) => this.sealed.has(head))) {
      this.say("SLAY BOTH HEADS — their deaths light this beacon.");
      return;
    }
    this.mark(index, "BEACON LIT — whirlpool weakened");
    if (this.allSteps() && this.boss) {
      this.warnings = this.warnings.filter((w) => !w.label.startsWith("Charybdis"));
      this.boss.friendly = false;
      this.exposedUntil = this.now + 4;
      this.next = 0.8;
      this.objective = "CHARYBDIS BOUND · Finish Scylla!";
      this.game.playSound("boss_phase", 0.7);
      this.say("SCYLLA EXPOSED — finish the sea beast!");
    }
  }
  private updateStrait(dt: number): void {
    const boss = this.boss;
    if (!boss) return;
    const p = this.game.player;
    const heads = this.living.filter((a) => a.role === "strait_head");
    this.status = `${this.sealed.size}/6 heads slain · ${this.record.steps.length}/3 flames`;
    if (this.allSteps()) {
      this.status = "WHIRLPOOL BOUND · SCYLLA HUNTS";
      if (!boss.windupAttack && this.distance(boss, p) > 100) this.move(boss, p, 1.3);
      if (this.next <= 0 && !boss.windupAttack) {
        const patterns = boss.def.boss?.attacks ?? [];
        if (patterns.length) { boss.attackCd = 0; boss.queueAttack(this.game, patterns[this.cycle++ % patterns.length]); }
        this.next = 2.25;
      }
      return;
    }
    for (const {enemy} of heads)
      if (!enemy.windupAttack && this.distance(enemy, p) > 95) this.move(enemy, p, 1.2);
    if (this.next <= 0 && heads.length) {
      const head = heads[this.cycle++ % heads.length];
      if (!head.enemy.windupAttack) {
        this.next = 1.4;
        head.enemy.attackCd = 0;
        this.attack(head.enemy, ["thrust", "poison", "charge"][head.index % 3], {
          name: ["SCYLLA'S BITE", "SCYLLA'S VENOM", "SCYLLA'S LUNGE"][head.index % 3],
          element: head.index % 3 === 1 ? "poison" : "physical",
          color: head.index % 3 === 1 ? "#84bd58" : "#73c9df",
          windup: 0.65, power: 1.15,
        });
      }
    }
    this.guardNext -= dt;
    if (this.guardNext <= 0) {
      this.guardNext = 6.5;
      const spitter = heads.find(a => !a.enemy.windupAttack && this.sourceVisible(a.enemy));
      if (spitter && !heads.some(a => !!a.enemy.windupAttack))
        this.warn(p, 65, 1.2, spitter.enemy.damage, "SCYLLA'S BRINE SPIT", "#73c9df", undefined, spitter.enemy, "spit");
    }
  }

  private spawnHydraHead(index: number): void {
    const head = this.spawn("aegean_hydra_head", "head", index, this.at(index));
    head.scripted = true;
    head.maxHp = 2200;
    head.hp = head.maxHp;
    head.def = {
      ...head.def,
      name: ["Venom", "Sweep", "Lunge", "Brood", "Coil"][index] + " Head",
      scale: 1.65,
    };
  }
  private updateHydra(): void {
    this.status = `${this.sealed.size}/5 necks sealed · ${Object.keys(this.wounds).length} open wounds`;
    for (const [key, deadline] of Object.entries(this.wounds)) {
      const i = Number(key);
      if (this.now > deadline && !this.sealed.has(i)) {
        delete this.wounds[i];
        this.spawnHydraHead(i);
        this.say(`Head ${i + 1} regrows`);
      }
    }
    const p = this.game.player;
    for (const a of this.living.filter((a) => a.role === "head"))
      if (!a.enemy.windupAttack && this.distance(a.enemy, p) > 175) this.move(a.enemy, p, 1.12);
    if (this.next <= 0) {
      this.next = 1.4;
      this.cycle++;
      const heads = this.actors.filter(
        (a) => a.role === "head" && !a.enemy.dead,
      );
      const head = heads[this.cycle % Math.max(1, heads.length)];
      if (head) {
        head.enemy.attackCd = 0;
        this.attack(
          head.enemy,
          ["poison", "sweep", "charge", "volley", "ring"][head.index],
          {
            name: [
              "HYDRA VENOM — leave the pools",
              "NECK SWEEP — get behind",
              "HYDRA LUNGE — sidestep",
              "BROOD VENOM FAN — dodge the gaps",
              "CRUSHING COIL — get clear",
            ][head.index],
            element: head.index === 0 || head.index === 3 ? "poison" : "physical",
            color: head.index === 0 || head.index === 3 ? "#84bd58" : "#b2a46f",
            windup: 0.7, power: 1.2,
          },
        );
      }
    }
    if (this.sealed.size === 5) this.finish();
  }
  private updateHind(dt: number): void {
    const hind = this.boss;
    if (!hind) return;
    if (this.allSteps()) {
      if (this.cycle === 0) {
        this.cycle = 1;
        this.adds(2);
      }
      if (this.addCount() === 0) this.finish();
      this.objective = "Defend the sleeping hind from oath echoes.";
      return;
    }
    const movement =
      this.distance(this.game.player, this.lastPlayer) / Math.max(0.01, dt);
    const close = this.distance(hind, this.game.player) < 145;
    this.gaze = Math.max(
      0,
      Math.min(100, this.gaze + dt * (close && movement > 125 ? 26 : -18)),
    );
    const point = this.at(this.record.steps.length);
    if (this.gaze >= 100) {
      const pos = this.node("safe", this.record.steps.length);
      hind.x = pos.x;
      hind.y = pos.y;
      this.gaze = 25;
      this.say("The hind retreats to this clearing’s refuge");
    }
    if (close && movement < 125 && this.gaze < 40) this.move(hind, point, 0.8);
    this.status = `Alarm ${Math.round(this.gaze)}% · ${this.record.steps.length}/3 clearings`;
  }
  private updateSky(dt: number): void {
    if (!this.carrying) {
      this.endurance = Math.min(100, this.endurance + dt * 18);
    } else {
      this.endurance -= dt * 5;
      if (this.next <= 0) {
        this.next = 4.5;
        this.warn(
          { x: this.game.player.x, y: this.game.player.y },
          75,
          0.9,
          (this.boss?.damage ?? 300) * 1.3,
          "ATLAS THROWS A STAR STONE",
          "#b6c5ee",
        );
      }
      if (this.endurance <= 0) {
        this.carrying = false;
        this.endurance = 50;
        const safe = this.at(this.carryIndex);
        const pos = findOpenNear(this.game.map, safe.x, safe.y, 12, 8);
        this.game.player.x = pos.x;
        this.game.player.y = pos.y;
        this.say("The sky settles at the last anchor. Try the route again.");
      }
    }
    this.status = `Sky endurance ${Math.ceil(this.endurance)}% · ${this.carrying ? "Carry to the next numbered anchor" : "Take the sky at a marked anchor"}`;
  }
  private updateCerberus(dt: number): void {
    const boss = this.boss;
    if (!boss) return;
    if (this.allSteps()) { this.finish(); return; }
    this.status =
      this.exposedUntil > this.now
        ? "RESTING — place the next restraint"
        : `Read the three heads · ${this.record.steps.length}/3 restraints`;
    if (this.next <= 0 && !boss.windupAttack) {
      this.cycle++;
      if (this.cycle % 4 === 0) {
        this.exposedUntil = this.now + 4.5;
        this.next = 4.5;
        this.say("All three heads are resting");
      } else {
        this.next = 1.65;
        boss.attackCd = 0;
        const head = (this.cycle - 1) % 3;
        this.attack(boss, ["thrust", "sweep", "ring"][head], {
          name: ["CERBERUS BITE — sidestep", "CERBERUS CLAWS — get behind", "UNDERWORLD HOWL — get clear"][head],
          element: head === 2 ? "arcane" : "physical",
          color: head === 2 ? "#bb91db" : "#da796b",
          windup: 0.65, power: 1.45,
        });
      }
    }
    if (this.game.player.hp < this.lastHP) this.gaze += 22;
    this.gaze = Math.max(0, this.gaze - dt * 3);
    if (this.gaze > 100) {
      this.gaze = 45;
      this.say("CERBERUS ENRAGED — dodge, then approach during REST!");
      this.next = 0.3;
    }
  }
  private updateStandard(dt: number): void {
    if (this.holding < 0 || this.allSteps()) return;
    const point = this.at(this.holding);
    const allies = this.actors.filter((a) => a.role === "ally");
    for (const a of allies)
      this.move(
        a.enemy,
        { x: point.x + (a.index ? 35 : -35), y: point.y + 25 },
        1.2,
      );
    if (
      this.distance(this.game.player, point) < 120 &&
      this.addCount() === 0 &&
      allies.every((a) => this.distance(a.enemy, point) < 140)
    ) {
      this.holdTime += dt;
      this.status = `Rally ${Math.floor(this.holdTime)}/3s`;
      if (this.holdTime >= 3) {
        this.mark(this.holding, "ALLIED VOLLEY — the queen is staggered!");
        this.holding = -1;
        this.holdTime = 0;
        if (this.boss) this.openCounter(this.boss, 3);
      }
    } else this.holdTime = 0;
  }

  interact(prop: PropInstance): boolean {
    if (prop.interact !== "aegean") return false;
    if (!this.id) return false;
    if (prop.data?.action === "checkpoint") {
      if (this.slug === "army" && this.waiting) {
        this.begin();
        return true;
      }
      if (this.slug === "leonidas" && this.started) {
        this.say("Leave the active attempt before starting a practice echo.");
        return true;
      }
      if (this.record.completed) {
        this.record.completed = false;
        this.record.steps = [];
        if (this.slug === "army") this.record.chapter = 0;
      }
      this.begin();
      this.say("The encounter is restored. Permanent rewards remain claimed.");
      return true;
    }
    if (prop.data?.action === "withdraw" && this.slug === "leonidas") {
      this.returnToAntechamber();
      return true;
    }
    if (prop.data?.action === "practice") {
      if (!this.startPractice(Number(prop.data.phase ?? this.record.bestPhase)))
        this.say(this.started ? "Withdraw at the antechamber stone before sparring." : "Face this part of the king’s oath once before practising it.");
      return true;
    }
    if (prop.data?.action !== "objective") return false;
    if (this.record.completed && !this.practice) {
      this.say("This oath is already complete.");
      return true;
    }
    if (!this.started) this.begin();
    const index = Math.max(
      0,
      Math.floor(
        Number(
          prop.data.index ?? prop.data.order ?? this.props.indexOf(prop),
        ) || 0,
      ),
    );
    this.useObjective(index);
    return true;
  }
  /** Root binds the single utility action to the nearby authored mechanism. */
  useUtility(): boolean {
    if (!this.id || !this.started) return false;
    let index = -1,
      distance = 130;
    this.props.forEach((_p, i) => {
      const d = this.distance(this.at(i), this.game.player);
      if (d < distance) {
        distance = d;
        index = i;
      }
    });
    if (index >= 0) {
      this.useObjective(index);
      return true;
    }
    if (
      this.slug === "cerberus" &&
      this.boss &&
      this.exposedUntil > this.now &&
      this.distance(this.game.player, this.boss) < 160
    ) {
      this.mark(this.record.steps.length, "Restraint placed");
      this.exposedUntil = 0;
      return true;
    }
    this.say("Approach the highlighted mechanism to use its tool.");
    return true;
  }
  private useObjective(index: number): void {
    if (
      this.done(index) &&
      !["leonidas", "hesperides"].includes(this.slug) &&
      !(this.slug === "hydra" && this.sealed.size === 5)
    ) {
      this.say("This objective is secured.");
      return;
    }
    const boss = this.boss;
    const nearBoss = !!boss && this.distance(boss, this.at(index)) < 210;
    const recovery = !!boss?.lastImpact && this.now - boss.lastImpact.at < 4.5;
    switch (this.slug) {
      case "army":
        if (this.waiting) this.begin();
        else
          this.say("300 soldiers share this battlefield. Break their captains!");
        return;
      case "leonidas":
        this.leonidasMechanism(index);
        return;
      case "hydra":
        if (this.sealed.size === 5 && index === 0) {
          this.finish();
          return;
        }
        if ((this.wounds[index] ?? 0) >= this.now) {
          this.sealed.add(index);
          delete this.wounds[index];
          this.mark(index, `Neck ${index + 1} cauterized`);
        } else
          this.say(`Sever head ${index + 1} before cauterizing its wound.`);
        return;
      case "hind":
        if (
          index !== this.record.steps.length ||
          !boss ||
          this.distance(boss, this.at(index)) > 130 ||
          this.gaze > 40
        ) {
          this.say("Guide the calm hind to this clearing first.");
          return;
        }
        this.mark(index, "Sanctuary stone sings");
        return;
      case "nemea":
      case "boar":
      case "bull":
      case "minotaur":
        if (
          !boss ||
          !nearBoss ||
          boss.lastImpact?.id !== "charge" ||
          !recovery
        ) {
          this.say(
            "Bait its committed charge through this marked structure first.",
          );
          return;
        }
        this.mark(
          index,
          this.slug === "nemea"
            ? "Pillar broken — golden hide exposed"
            : "The charge opens the mechanism",
        );
        this.openCounter(boss, 3);
        if (this.allSteps() && ["boar", "bull"].includes(this.slug))
          this.finish();
        return;
      case "augeas":
      case "sanctuary_names": {
        if (this.addCount()) { this.say("CLEAR GUARDIANS — then hold the marked ground."); return; }
        this.mark(index, this.slug === "augeas" ? "SLUICE OPEN — flood diverted" : "NAME RESTORED — echoes silenced");
        this.groundedUntil[index] = this.now + 12;
        this.warnings = this.warnings.filter((w) => this.distance(w, this.at(index)) > 260);
        if (boss) this.openCounter(boss, 2.5);
        if (this.slug === "augeas") this.adds(1, "aegean_talos_shard", this.at(index));
        return;
      }
      case "birds":
        if (this.addCount()) {
          this.say(
            "Defeat the exposed flock before sounding another resonator.",
          );
          return;
        }
        this.mark(index, "Bronze resonator sounds");
        this.game.playSound("bronze_gate", 0.7);
        if (boss) this.openCounter(boss, 3);
        return;
      case "mares": {
        const mare = this.actors.find(
          (a) => a.role === "mare" && a.index === index && !a.enemy.dead,
        );
        if (!mare || this.distance(mare.enemy, this.at(index)) > 165) {
          this.say(`Bring mare ${index + 1} back to this gate.`);
          return;
        }
        mare.enemy.friendly = true;
        mare.enemy.scripted = true;
        this.mark(index, "Paddock secured");
        this.exposedUntil = this.now + 10;
        return;
      }
      case "hippolyta":
        if (this.holding === index) return;
        this.holding = index;
        this.holdTime = 0;
        this.say("HOLD BANNER · allies need 3 seconds to line up their shot.");
        return;
      case "geryon": {
        const herd = this.actors.filter((a) => a.role === "herd");
        if (
          herd.some((a) => this.distance(a.enemy, this.at(index)) > 190)
        ) {
          this.say("GUIDE BOTH CATTLE HERE → sheltered ground");
          return;
        }
        this.mark(index, "The herd reaches shelter");
        this.exposedUntil = this.now + 12;
        if (
          !boss &&
          this.allSteps() &&
          !this.living.some((a) => a.role === "body")
        )
          this.finish();
        return;
      }
      case "hesperides":
        if (!this.carrying) {
          this.carrying = true;
          this.carryIndex = index;
          this.endurance = 100;
          this.say(`Bear the sky to anchor ${((index + 1) % 3) + 1}.`);
          return;
        }
        if (index !== (this.carryIndex + 1) % 3) {
          this.say("Follow the star bridge to the next numbered anchor.");
          return;
        }
        this.mark(this.carryIndex, "Celestial burden relayed");
        this.carryIndex = index;
        this.endurance = 100;
        if (this.allSteps()) this.finish();
        return;
      case "cerberus":
        if (this.exposedUntil <= this.now) {
          this.say("Wait until all three heads have exhausted their patterns.");
          return;
        }
        this.mark(index, "Restraint placed");
        this.exposedUntil = 0;
        return;
      case "python":
        this.mark(index, "Oracle fumes vented");
        this.exposedUntil = this.now + 9;
        this.groundedUntil[index] = this.now + 12;
        this.warnings = this.warnings.filter((w) => !w.label.includes("VENOM"));
        if (boss) this.openCounter(boss, 2.5);
        return;
      case "medusa":
        this.mark(index, "Mirror aligned — reflected gaze");
        this.gaze = 0;
        if (boss) this.openCounter(boss, 2.5);
        return;
      case "chimera":
        if (
          !boss || !boss.lastImpact ||
          !["flame", "chimera_furnace"].includes(boss.lastImpact?.id ?? "") ||
          !recovery ||
          this.distance(boss.lastImpact, this.at(index)) > 330 ||
          angleBetween(
            boss.lastImpact.angle,
            angleTo(
              boss.lastImpact.x,
              boss.lastImpact.y,
              this.at(index).x,
              this.at(index).y,
            ),
          ) > 0.55 && boss.lastImpact.id !== "chimera_furnace"
        ) {
          this.say(
            "Bait the Chimera’s furnace breath onto this vent, then open it.",
          );
          return;
        }
        this.mark(index, "VENT EXPLODES — Chimera staggered!");
        this.openCounter(boss, 3);
        return;
      case "cyclops":
        if ((this.wounds[index] ?? 0) < this.now) {
          this.say("Lure a quarry boulder onto this counterweight first.");
          return;
        }
        this.mark(index, "Crane turns — the eye is exposed");
        this.exposedUntil = this.now + 11;
        return;
      case "talos":
        if (!nearBoss || boss?.windupAttack) {
          this.say("Wait for Talos to pass this station between stomps.");
          return;
        }
        this.mark(index, "Ankle seal loosened");
        if (boss) this.openCounter(boss, 3);
        return;
      case "scylla":
        this.useStraitBeacon(index);
        return;
      case "titan":
        if (this.holding === index) return;
        this.holding = index;
        this.holdTime = 0;
        this.adds(1, "aegean_jailer", this.at(index));
        this.say("CLEAR HORRORS → HOLD ANCHOR 3s");
        return;
      default:
        if (!boss) {
          this.say("No guardian remains.");
          return;
        }
        this.mark(index, "COUNTERSTRIKE — guardian staggered!");
        this.groundedUntil[index] = this.now + 10;
        this.warnings = this.warnings.filter((w) => this.distance(w, this.at(index)) > 260);
        this.openCounter(boss, 2.5);
        return;
    }
  }

  /** Pure preflight: prevents a forbidden hit from triggering item powers. The
   * numerical cap is applied once, after all power bonuses, in modifyDamage. */
  isDamageAllowed(enemy: Enemy): boolean {
    if (!this.id || !this.started) return true;
    const actor = this.actors.find((a) => a.enemy === enemy);
    if (!actor) return true;
    if (
      ["herd", "ally", "mare"].includes(actor.role) ||
      this.slug === "cerberus"
    )
      return false;
    if (actor.role !== "boss") return true;
    if (PUZZLE_ONLY.has(this.slug) || this.slug === "hydra") return false;
    if (this.slug === "scylla" && !this.allSteps()) return false;
    if (this.slug === "leonidas" && this.now < this.phaseIntroUntil)
      return false;
    return true;
  }

  modifyDamage(enemy: Enemy, amount: number, opts: DamageOpts): number {
    if (!this.isDamageAllowed(enemy)) return 0;
    if (
      enemy.guardUntil > this.now &&
      opts.fromX !== undefined &&
      opts.fromY !== undefined
    ) {
      const facing = {
        up: -Math.PI / 2,
        down: Math.PI / 2,
        left: Math.PI,
        right: 0,
      }[enemy.dir];
      if (
        angleBetween(
          facing,
          angleTo(enemy.x, enemy.y, opts.fromX, opts.fromY),
        ) < 1
      )
        amount *= 0.35;
    }
    if (!this.id || !this.started) return amount;
    const actor = this.actors.find((a) => a.enemy === enemy);
    if (!actor) return amount;
    if (this.slug === "army") return this.armyDamage(actor, amount, opts);
    if (this.slug === "leonidas") return this.leonidasDamage(actor, amount);
    if (
      actor.role === "herd" ||
      actor.role === "ally" ||
      actor.role === "mare" ||
      this.slug === "cerberus"
    )
      return 0;
    if (actor.role !== "boss") return amount;
    if (PUZZLE_ONLY.has(this.slug) || this.slug === "hydra") return 0;
    // Tools buy a real stagger and a short bonus; ordinary attacks always work.
    // A few nonlethal labors and Scylla's physical heads retain their clear rule.
    return this.exposedUntil > this.now ? amount * 1.35 : amount;
  }
  onEnemyKilled(enemy: Enemy): boolean {
    const actor = this.actors.find((a) => a.enemy === enemy);
    if (!actor) return false;
    if (this.slug === "army") {
      if (actor.roster !== undefined) this.armyDefeated.add(actor.roster);
      if (actor.role === "captain")
        this.brokenUntil[Math.floor((actor.roster ?? 0) / 30)] = this.now + 30;
      // Item healing is handled by the ordinary combat rules; this director
      // adds no separate chapter refill or artificial heal on each army kill.
      return true;
    }
    if (actor.role === "head") {
      this.woundSites[actor.index] = {x: enemy.x, y: enemy.y};
      this.wounds[actor.index] = this.now + 8;
      this.game.ringAt(enemy.x, enemy.y, 82, "#ffb76b");
      this.say(`HEAD ${actor.index + 1} CUT — step into its glowing wound!`);
      return true;
    }
    if (actor.role === "strait_head") {
      this.sealed.add(actor.index);
      this.say(`HEAD ${actor.index + 1} SLAIN · ${this.sealed.size}/6`);
      const beacon = Math.floor(actor.index / 2);
      if ([beacon * 2, beacon * 2 + 1].every((n) => this.sealed.has(n))) this.useStraitBeacon(beacon);
      return true;
    }
    if (actor.role === "boss") {
      if (this.slug === "leonidas") {
        if (this.finalSequence >= 3) this.finish();
      } else if (
        (this.slug !== "mares" || this.allSteps()) &&
        (this.slug !== "geryon" || !this.living.some((a) => a.role === "body"))
      )
        this.finish();
      return true;
    }
    if (
      this.slug === "geryon" &&
      actor.role === "body" &&
      !this.boss &&
      !this.living.some((a) => a.role === "body")
    )
      this.finish();
    return actor.role === "guard" || actor.role === "add";
  }

  private finish(): void {
    if (this.slug === "scylla" && (!this.allSteps() || this.sealed.size !== 6 || this.boss)) return;
    if (this.practice) {
      this.say("Practice echo completed. No rewards or progression granted.");
      this.returnToAntechamber();
      return;
    }
    if (this.record.completed) return;
    this.record.completed = true;
    this.started = false;
    this.game.completeAegean(this.id, this.game.aegeanHas(this.id));
    this.objective =
      "VICTORY · Open your reward card for the exact spoils.";
    this.status = "Completed";
    this.game.bossTarget = null;
    this.clearActors();
  }

  private deployArmy(): void {
    if (this.armyNext >= ARMY_ROSTER.length) return;
    this.game.playSound("phalanx_horn", 0.65);
    const center = this.node("arena");
    // Every roster member is a real, vulnerable actor from the first frame.
    // Ten distinct 6x5 companies spread across one open soil battlefield.
    while (this.armyNext < ARMY_ROSTER.length) {
      const n = this.armyNext++, r = ARMY_ROSTER[n], company = Math.floor(n / 30), slot = n % 30;
      const anchor = this.game.map.encounterNodes?.[`company_${company}`]?.[0] ?? {
        x: center.x + ((company % 5) - 2) * 280,
        y: center.y + (Math.floor(company / 5) - 0.5) * 370,
      };
      const e = this.spawn(`aegean_army_${r.role}`, r.role, slot,
        {x:anchor.x + ((slot % 6) - 2.5) * 36, y:anchor.y + (Math.floor(slot / 6) - 2) * 36}, n);
      e.scripted = true;
      e.def = {...e.def, name: `${r.company} ${e.def.name}`};
    }
    this.status = "300 STANDING · ALL COMPANIES ENGAGED";
  }
  private armyDamage(actor: Actor, amount: number, opts: DamageOpts): number {
    const company = Math.floor((actor.roster ?? 0) / 30);
    if ((this.brokenUntil[company] ?? 0) > this.now) return amount;
    const e = actor.enemy;
    if (
      actor.role === "captain" &&
      e.windupAttack &&
      amount >= e.maxHp * 0.012
    ) {
      e.cancelAttack();
      e.attackCd = 3;
      this.brokenUntil[company] = this.now + 7;
      this.powerEvent("onInterrupt", e);
      this.say(
        `${ARMY_COMPANIES[company]} captain interrupted — shield order broken`,
      );
      return amount;
    }
    const source =
      opts.fromX !== undefined && opts.fromY !== undefined
        ? { x: opts.fromX, y: opts.fromY }
        : this.game.player;
    const facing = {
      up: -Math.PI / 2,
      down: Math.PI / 2,
      left: Math.PI,
      right: 0,
    }[e.dir];
    const frontal =
      angleBetween(facing, angleTo(e.x, e.y, source.x, source.y)) < 1.1;
    this.formationBreak[company] =
      (this.formationBreak[company] ?? 0) +
      (amount / Math.max(1, e.maxHp)) * (actor.role === "captain" ? 2.2 : 1);
    if (this.formationBreak[company] >= 1.2) {
      this.formationBreak[company] = 0;
      this.brokenUntil[company] = this.now + 7;
      this.powerEvent("onStagger", e);
      this.say(`${ARMY_COMPANIES[company]} formation broken — seven seconds!`);
    }
    return frontal && ["hoplite", "shield", "captain"].includes(actor.role)
      ? amount * 0.3
      : amount;
  }
  private updateArmy(dt: number): void {
    const soldiers = this.living;
    this.status = `${soldiers.length}/300 STANDING · ONE BATTLEFIELD`;
    this.objective = "Flank shields. Kill captains to break each company's formation.";
    if (!soldiers.length && this.armyDefeated.size === 300) {
      this.record.chapter = 4;
      this.finish();
      return;
    }
    const p = this.game.player;
    const bins = new Map<string, Enemy[]>();
    for (const a of soldiers) {
      const key = `${Math.floor(a.enemy.x / 96)},${Math.floor(a.enemy.y / 96)}`;
      const bucket = bins.get(key);
      if (bucket) bucket.push(a.enemy); else bins.set(key, [a.enemy]);
    }
    for (const a of soldiers) {
      const e = a.enemy;
      if (e.windupAttack || e.statuses.some((s) => s.kind === "stun")) continue;
      const desired = a.role === "javelin" ? 330 : a.role === "runner" ? 65 : 85;
      if (this.distance(e, p) <= desired) continue;
      const company = Math.floor((a.roster ?? 0) / 30);
      const flank = a.role === "runner" ? (a.index % 2 ? 135 : -135) : ((a.index % 6) - 2.5) * 24;
      const target = {x:p.x + flank, y:p.y + (company % 2 ? 34 : -34)};
      // Open-field steering uses small local separation buckets rather than
      // 300 flood searches or a 300-by-300 neighbour scan every frame.
      let dx = target.x - e.x, dy = target.y - e.y;
      const length = Math.hypot(dx,dy) || 1;
      dx /= length; dy /= length;
      const cx = Math.floor(e.x/96), cy = Math.floor(e.y/96);
      for (let by=cy-1;by<=cy+1;by++) for (let bx=cx-1;bx<=cx+1;bx++)
        for (const other of bins.get(`${bx},${by}`) ?? []) {
          if (other === e) continue;
          const ox=e.x-other.x, oy=e.y-other.y, squared=ox*ox+oy*oy;
          const spacing=e.radius+other.radius+3;
          if (squared > .01 && squared < spacing*spacing) {
            const d=Math.sqrt(squared);
            dx += ox/d*.55; dy += oy/d*.55;
          }
        }
      const scale=e.speed*(a.role === "shield" ? .85 : 1.15)*dt/(Math.hypot(dx,dy)||1);
      const nx=e.x+dx*scale, ny=e.y+dy*scale;
      if (!boxHitsTerrain(this.game.map,nx,e.y,e.radius*.7,e.radius*.5)) e.x=nx;
      if (!boxHitsTerrain(this.game.map,e.x,ny,e.radius*.7,e.radius*.5)) e.y=ny;
      e.dir=dirFromVector(dx,dy,e.dir);
      e.anim="walk";
    }
    if (this.next <= 0) {
      this.next = 0.7;
      this.cycle++;
      const engaged = soldiers.filter((a) => this.distance(a.enemy, p) < 570 && !a.enemy.windupAttack &&
        a.enemy.attackCd <= 0 && !a.enemy.statuses.some((s) => s.kind === "stun"));
      // Several simultaneous threats, bounded to keep tells legible. This is
      // scheduling of attacks only: no soldiers are hidden, invulnerable or held in reserve.
      const committing = soldiers.filter((a) => !!a.enemy.windupAttack).length;
      const count = Math.min(2, Math.max(0, 4 - committing), engaged.length);
      for (let k = 0; k < count; k++) {
        const a = engaged[(this.cycle * 3 + k) % engaged.length];
        this.attack(a.enemy, a.role === "javelin" ? "volley" : a.role === "runner" ? "charge" : a.role === "captain" ? "sweep" : "thrust", {
          name: a.role === "captain" ? "CAPTAIN'S ORDER — interrupt!" : a.role === "javelin" ? "JAVELIN LANE" : "PHALANX STRIKE",
          windup: a.role === "captain" ? 0.9 : 0.65,
          range: a.role === "runner" ? 235 : a.role === "javelin" ? 570 : 200,
          radius: a.role === "javelin" ? 24 : 35,
          power: a.role === "captain" ? 1.65 : 0.85,
          count: 1,
        });
      }
    }
    for (const key of Object.keys(this.formationBreak))
      this.formationBreak[Number(key)] = Math.max(0, this.formationBreak[Number(key)] - dt * 0.014);
  }

  startPractice(phase: number): boolean {
    if (
      this.slug !== "leonidas" ||
      !Number.isInteger(phase) ||
      phase < 0 ||
      phase > this.record.bestPhase ||
      this.started
    )
      return false;
    const p = this.game.player;
    this.practicePlayer = {
      at: this.now,
      powers: this.game.powers?.snapshot(),
      player: structuredClone({
        hp: p.hp,
        mp: p.mp,
        sp: p.sp,
        gold: p.gold,
        deaths: p.deaths,
        cooldowns: p.cooldowns,
        statuses: p.statuses,
        resistances: p.resistances,
        buffs: p.buffs,
        inventory: p.inventory,
        equipment: p.equipment,
        artifactCooldown: p.artifactCooldown,
        weaponPowerCooldown: p.weaponPowerCooldown,
        offhandCooldown: p.offhandCooldown,
        reviveUsed: p.reviveUsed,
        shield: p.shield,
        shieldUntil: p.shieldUntil,
        regen: p.regen,
      }),
    };
    this.practice = true;
    this.phase = Math.floor(phase);
    this.begin();
    this.practice = true;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    p.sp = p.maxSp;
    p.cooldowns = {};
    p.statuses = [];
    p.resistances = {};
    p.buffs = [];
    p.shield = 0;
    p.regen = null;
    p.reviveUsed = false;
    p.artifactCooldown = 0;
    p.weaponPowerCooldown = 0;
    p.offhandCooldown = 0;
    this.game.powers?.reset();
    this.say(`Practice echo: phase ${this.phase + 1}. No rewards.`);
    return true;
  }
  private restorePracticePlayer(): void {
    if (!this.practicePlayer) return;
    const { player, powers, at } = this.practicePlayer,
      elapsed = this.now - at;
    for (const s of player.statuses) s.until += elapsed;
    for (const r of Object.values(player.resistances)) r.until += elapsed;
    for (const b of player.buffs) b.until += elapsed;
    if (player.regen) player.regen.until += elapsed;
    player.shieldUntil += elapsed;
    Object.assign(this.game.player, player);
    this.game.powers?.restore(powers);
    this.game.player.dead = false;
    this.game.player.dashTimer = 0;
    this.game.player.attackTimer = 0;
    this.game.player.invuln = 1;
    this.practicePlayer = null;
  }
  returnToAntechamber(): void {
    this.restorePracticePlayer();
    this.clearActors();
    this.started = false;
    this.waiting = true;
    this.practice = false;
    const pos = findOpenNear(
      this.game.map,
      this.node("entry").x,
      this.node("entry").y,
      12,
      8,
    );
    this.game.player.x = pos.x;
    this.game.player.y = pos.y;
    this.game.bossTarget = null;
    this.objective =
      "Use the checkpoint to begin a real attempt, or select a reached practice phase.";
    this.status = "At the antechamber";
  }
  private enterLeonidasPhase(): void {
    const boss = this.boss;
    if (!boss) return;
    boss.phase = this.phase;
    this.record.bestPhase = Math.max(this.record.bestPhase, this.phase);
    this.phaseIntroUntil = this.now + 0.65;
    this.phaseObjective = 0;
    this.cycle = 0;
    this.next = 0.8;
    boss.cancelAttack();
    this.warnings = [];
    const ph = boss.def.boss!.phases[this.phase];
    this.game.toast(ph.name, ph.line, "#e3c47b");
    this.game.playSound("oath_bell", 0.65);
    if (this.phase === 2 && this.guardWaves === 0) this.deployGuards();
    if (this.phase >= 4)
      for (const a of this.actors.filter((a) => a.role === "guard"))
        a.enemy.dead = true;
    if (this.phase === 5) this.finalSequence = 0;
  }
  private deployGuards(): void {
    if (this.guardWaves >= 1) return;
    const wave = this.guardWaves++;
    for (let i = 0; i < 4; i++) {
      const e = this.spawn(
        "aegean_royal_guard",
        "guard",
        wave * 4 + i,
        this.node("guard", i),
      );
      e.scripted = true;
    }
    this.say(`ROYAL GUARD — four spears join the king`);
  }
  private leonidasDamage(actor: Actor, amount: number): number {
    if (actor.role !== "boss") return amount;
    const boss = actor.enemy;
    if (this.now < this.phaseIntroUntil) return 0;
    if (
      this.phase === 1 &&
      this.phaseObjective < 2 &&
      this.exposedUntil <= this.now
    )
      amount *= 0.75;
    if (
      this.phase === 2 &&
      this.living.some((a) => a.role === "guard") &&
      this.exposedUntil <= this.now
    )
      amount *= 0.85;
    const thresholds = [0.82, 0.64, 0.42, 0.18, 0.05, 0];
    const floor = boss.maxHp * thresholds[this.phase];
    const gate = this.phase !== 5 || this.finalSequence >= 3;
    if (!gate)
      return Math.min(
        amount,
        Math.max(0, boss.hp - floor - (this.phase === 5 ? 1 : 0)),
      );
    if (this.phase < 5 && amount >= boss.hp - floor) {
      this.carryDamage = Math.min(
        boss.maxHp * 0.12,
        Math.max(0, amount - (boss.hp - floor)),
      );
      return Math.max(0, boss.hp - floor);
    }
    return amount;
  }
  private leonidasMechanism(index: number): void {
    const boss = this.boss;
    if (!boss) return;
    if ((this.mechanismCooldowns[index] ?? 0) > this.now) {
      this.say("This mechanism is still recovering.");
      return;
    }
    if (this.phase === 1 && index < 4) {
      if (this.sealed.has(index)) {
        this.say("This oath link has already been broken.");
        return;
      }
      this.sealed.add(index);
      this.phaseObjective++;
      this.openCounter(boss, 2.5);
      this.exposedUntil = this.now + 7;
      this.say("Oath link extinguished — the shield opens");
    } else if (this.phase === 2 && index < 4) {
      if (!this.warnings.some((w) => w.label === "Oath chant")) {
        this.say("The standard can interrupt the king while he chants.");
        return;
      }
      this.exposedUntil = this.now + 7;
      this.openCounter(boss, 2.5);
      this.phaseObjective++;
      this.mechanismCooldowns[index] = this.now + 9;
      for (const a of this.living.filter((a) => a.role === "guard"))
        a.enemy.attackCd = Math.max(a.enemy.attackCd, 2.5);
      this.powerEvent("onInterrupt", boss);
      this.say(
        "The standard falls silent — the king cannot complete his chant",
      );
    } else if (this.phase >= 3 && index >= 4) {
      this.exposedUntil = this.now + 7;
      this.phaseObjective++;
      this.mechanismCooldowns[index] = this.now + 12;
      this.groundedUntil[index] = this.now + 10;
      const pending = this.warnings.length;
      this.warnings = this.warnings.filter(
        (w) => this.distance(w, this.at(index)) > 200,
      );
      if (this.warnings.length < pending) this.powerEvent("onInterrupt", boss);
      this.openCounter(boss, 2.5);
      this.say("Conductor discharges — incoming weapons deflected");
    } else {
      this.say("This mechanism belongs to another part of the king’s oath.");
    }
  }
  private updateLeonidas(dt: number): void {
    const boss = this.boss;
    if (!boss) return;
    const p = this.game.player;
    this.status = `Phase ${this.phase + 1}/6 · ${boss.def.boss!.phases[this.phase].name}${this.practice ? " · PRACTICE" : ""}`;
    this.objective = [
      "DODGE THE COMBO · punish the third strike.",
      "FLANK THE SHIELD · braziers break his stance when you hold them.",
      "KING + FOUR GUARDS · hold a standard to interrupt his rally.",
      "RETURNING SPEAR · step aside twice; conductors deflect his weapons.",
      "LAST DUEL · no shield, faster attacks. Keep moving.",
      `The Last Oath: survive the three patterns (${this.finalSequence}/3).`,
    ][this.phase];
    if (this.now < this.phaseIntroUntil) return;
    const guards = this.living.filter((a) => a.role === "guard");
    for (const a of guards)
      if (!a.enemy.windupAttack && this.distance(a.enemy, p) > 120)
        this.move(a.enemy, p, 1.15);
    this.guardNext -= dt;
    const committedGuards = guards.filter((a) => a.enemy.windupAttack).length;
    if (
      guards.length &&
      this.guardNext <= 0 &&
      committedGuards < 1 &&
      this.warnings.filter((w) => w.damage > 0).length +
        (boss.windupAttack ? 1 : 0) <
        2
    ) {
      const guard = guards.find(
        (a) =>
          this.distance(a.enemy, p) < 380 &&
          a.enemy.attackCd <= 0 &&
          !a.enemy.statuses.some((s) => s.kind === "stun"),
      );
      if (guard) {
        this.attack(guard.enemy, "thrust", { windup: 0.65, power: 1.15 });
        this.guardNext = 2.2;
      }
    }
    const threshold = [0.82, 0.64, 0.42, 0.18, 0.05][this.phase];
    if (this.phase < 5 && boss.hp <= boss.maxHp * threshold + 0.01) {
      {
        if (this.practice) {
          this.finish();
          return;
        }
        this.phase++;
        this.enterLeonidasPhase();
        boss.hp = Math.max(
          boss.maxHp * [0.82, 0.64, 0.42, 0.18, 0.05, 0][this.phase] + 1,
          boss.hp - this.carryDamage,
        );
        this.carryDamage = 0;
        return;
      }
    }
    if (
      this.phase === 2 &&
      !this.living.some((a) => a.role === "guard") &&
      this.guardWaves < 1
    )
      this.deployGuards();
    if (!boss.windupAttack && this.distance(boss, p) > (this.phase === 5 ? 280 : 100))
      this.move(boss, p, this.phase >= 4 ? 1.3 : 1.15);
    if (this.phase === 5 && this.finalSequence < 3) {
      if (this.next <= 0 && !boss.windupAttack && !this.warnings.length) {
        const step = this.finalSequence;
        this.next = 2.2;
        const point = { x: p.x, y: p.y };
        if (step === 0)
          this.line(
            boss,
            angleTo(boss.x, boss.y, p.x, p.y),
            560,
            0.85,
            boss.damage * 2,
            "Last Oath — the spear",
            () => {
              this.finalSequence = Math.max(this.finalSequence, 1);
            },
          );
        else if (step === 1)
          this.warn(
            point,
            100,
            0.9,
            boss.damage * 2.1,
            "Last Oath — the thrown stone",
            "#d0e7fa",
            () => {
              this.finalSequence = Math.max(this.finalSequence, 2);
            },
            boss,
            "boulder",
          );
        else
          this.warn(
            point,
            95,
            1.1,
            boss.damage * 2.3,
            "Last Oath — the flying shield",
            "#e2c88e",
            () => {
              this.finalSequence = 3;
              this.exposedUntil = this.now + 12;
              this.say("The oath is open. Finish the duel.");
            },
            boss,
            "shield",
          );
      }
      return;
    }
    if (this.next > 0 || boss.windupAttack) return;
    if (
      this.warnings.filter((w) => w.damage > 0).length +
        guards.filter((a) => a.enemy.windupAttack).length >=
      2
    ) {
      this.next = 0.3;
      return;
    }
    this.next = this.phase >= 4 ? 1.6 : 2.2;
    this.cycle++;
    boss.attackCd = 0;
    const grammar =
      this.phase === 0
        ? ["thrust", "thrust", "sweep"]
        : this.phase === 1
          ? ["thrust", "sweep", "return"]
          : this.phase === 2
            ? ["sweep", "thrust", "charge"]
            : ["return", "thrust", "sweep", "storm"];
    const key = grammar[(this.cycle - 1) % grammar.length];
    if (key === "return") {
      const origin = { x: boss.x, y: boss.y },
        angle = angleTo(origin.x, origin.y, p.x, p.y),
        length = 510;
      this.line(
        origin,
        angle,
        length,
        0.75,
        boss.damage * 1.7,
        "The Returning King — outbound",
        (impact, reason) => {
          // A spear lodged in stone cannot turn around. Otherwise the same
          // visible missile returns from its actual impact toward the king.
          if (reason === "wall" || !this.sourceVisible(boss)) return;
          const returnDistance = this.distance(impact, boss);
          const returning: Warning = {...impact, source: boss, at: this.now + returnDistance / 260 + 1,
            damage: boss.damage * 1.4, label: "The Returning King — return", attackId: "royal_return"};
          this.warnings.push(returning);
          this.game.spawnProjectile({x: impact.x, y: impact.y,
            angle: angleTo(impact.x, impact.y, boss.x, boss.y), range: returnDistance,
            speed: 260, radius: 10, damage: returning.damage,
            minHealthDamage: aegeanMinimumHit(boss.def, 1.4), element: "physical",
            friendly: false, color: "#d5bf87", sprite: "spear", sourceId: boss.id,
            onImpact: () => { this.warnings = this.warnings.filter(w => w !== returning); },
          });
        },
      );
    } else {
      const royal = boss.def.boss?.attacks ?? [];
      if (this.cycle % 2 === 0 && royal.length)
        boss.queueAttack(this.game, royal[(this.cycle / 2 - 1) % royal.length]);
      else this.attack(boss, key, {windup: this.phase >= 4 ? 0.8 : .95, power: this.phase >= 4 ? 1.85 : 1.5});
    }
    if (
      this.phase === 2 &&
      this.living.some((a) => a.role === "guard") &&
      this.cycle % 4 === 0 &&
      !this.guardHealUsed.has(this.guardWaves)
    ) {
      const interruption = this.phaseObjective;
      this.guardHealUsed.add(this.guardWaves);
      this.say("No man abandoned — interrupt his linked standard!");
      this.warn(
        { x: boss.x, y: boss.y },
        60,
        2.8,
        0,
        "Oath chant",
        "#98cbbc",
        () => {
          if (
            this.phase === 2 &&
            this.phaseObjective === interruption &&
            !boss.dead
          )
            for (const a of this.living.filter((a) => a.role === "guard")) {
              a.enemy.attackCd = 0;
              a.enemy.guardUntil = this.now + 3;
            }
        },
      );
    }

  }
}
