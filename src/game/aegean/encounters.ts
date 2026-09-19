import type { Game } from "../core/game";
import type { DamageOpts } from "../core/world";
import { angleBetween, angleTo, dist } from "../core/math";
import { Enemy } from "../entities/enemy";
import { findOpenNear, type PropInstance } from "../world/map";
import { TILE } from "../world/tiles";
import { AEGEAN_ATTACKS } from "../../data/aegean/enemies";
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
type Warning = Point & {
  radius: number;
  at: number;
  damage: number;
  color: string;
  label: string;
  threatened: boolean;
  line?: { angle: number; length: number };
  after?: () => void;
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
  "scylla",
  "titan",
]);
const COUNTS: Record<string, number> = {
  hydra: 5,
  mares: 4,
  leonidas: 8,
  army: 4,
};
const LABELS: Record<string, string> = {
  nemea: "Lure the lion into a pillar; seal it during recovery.",
  hydra: "Sever a head, then cauterize its numbered wound within 8 seconds.",
  hind: "Hold Brace to walk calmly beside the hind; guide it through the sanctuary stones.",
  boar: "Bait a charge into a marked pen, then close its horn gate.",
  augeas:
    "Open the river sluices in order: I, III, II. Clear each guardian group.",
  birds: "Sound a resonator, defeat its exposed flock, then advance.",
  bull: "Lure a charge through each pylon and secure its exposed anchor.",
  mares: "Draw each mare to its paddock gate and close the gate.",
  hippolyta: "Rally the allied squad at each standard and hold the ground.",
  geryon: "Gather the cattle at each refuge bell; overcome Geryon.",
  hesperides:
    "Take the sky at an anchor and relay it before endurance runs out.",
  cerberus: "Evade three head patterns; place a restraint during recovery.",
  python: "Vent the oracle fumes to expose the next coil.",
  medusa: "Face away from the gaze; turn the mirrors to expose Medusa.",
  minotaur: "Lure the Minotaur through the three marked gate mechanisms.",
  chimera: "Bait the breath at the active vent, then open its sluice.",
  cyclops: "Bait a boulder onto a crane counterweight, then operate the crane.",
  talos: "Wait at a coastal station; open Talos’s ankle seal as he passes.",
  scylla: "Cross between warning cycles and secure three strait beacons.",
  titan:
    "Defeat the chain horrors, then hold each anchor while it is repaired.",
  sanctuary_aegis: "Turn three mirrors during the sentinel’s recovery.",
  sanctuary_forge: "Work the forge after its cooling pulse; defeat the warden.",
  sanctuary_names:
    "Return the unspent names in order: II, I, III; contain their keeper.",
};

/**
 * Owns encounter objectives and their actors. No objective is a kill-count skin:
 * each handler below changes damage windows, navigation, escorts, or controls.
 * Only whole army chapters and explicit expedition checkpoints persist. Combat
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
  private sealed = new Set<number>();
  private armyDefeated = new Set<number>();
  private armyNext = 0;
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

  /** Called in world coordinates after terrain. Reserves have roster identities
   * but no collision, AI, health bars or attacks until deployArmy activates them. */
  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.id) return;
    const p = this.game.player;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 13px monospace";
    for (const [i, prop] of this.props.entries()) {
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
            : this.holding === i;
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
          72 * Math.min(1, this.holdTime / (this.slug === "hippolyta" ? 8 : 6)),
          6,
        );
      }
    }
    if (this.slug === "army" && !this.record.completed) {
      const active = new Set(this.living.map((a) => a.roster));
      for (const soldier of ARMY_ROSTER) {
        if (this.armyDefeated.has(soldier.number) || active.has(soldier.number))
          continue;
        const chapter = ARMY_CHAPTER_ENDS.findIndex(
          (end) => soldier.number < end,
        );
        const chapterStart = chapter === 0 ? 0 : ARMY_CHAPTER_ENDS[chapter - 1];
        const ordinal = soldier.number - chapterStart,
          anchor = this.node(`reserve_${chapter}`, ordinal % 6);
        const x = anchor.x + ((Math.floor(ordinal / 6) % 3) - 1) * 24,
          y = anchor.y - Math.floor(ordinal / 18) * 35;
        if (dist(p.x, p.y, x, y) > 1350) continue;
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = "#452d2b";
        ctx.fillRect(x - 6, y - 28, 12, 25);
        ctx.fillStyle = soldier.role === "captain" ? "#ebd192" : "#b39560";
        ctx.fillRect(x - 7, y - 35, 14, 11);
        ctx.fillStyle = "#743f38";
        ctx.fillRect(x - 8, y - 40, 16, 5);
        ctx.strokeStyle = "#d8c69c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 1);
        ctx.lineTo(x + 10, y - 44);
        ctx.stroke();
        ctx.fillStyle = "#9e7951";
        ctx.beginPath();
        ctx.ellipse(x - 7, y - 12, 9, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#f0d6a0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 12, y - 8);
        ctx.lineTo(x - 7, y - 18);
        ctx.lineTo(x - 2, y - 8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (let chapter = 0; chapter < 4; chapter++) {
        const point = this.node(`chapter_${chapter}`);
        if (this.distance(p, point) > 1300) continue;
        const from = chapter === 0 ? 0 : ARMY_CHAPTER_ENDS[chapter - 1],
          to = ARMY_CHAPTER_ENDS[chapter];
        const standing = ARMY_ROSTER.slice(from, to).filter(
          (s) => !this.armyDefeated.has(s.number),
        ).length;
        ctx.fillStyle = "#101d25dc";
        ctx.fillRect(point.x - 155, point.y - 340, 310, 29);
        ctx.fillStyle = "#e8d6ac";
        ctx.fillText(
          `CHAPTER ${chapter + 1} · ${standing}/${to - from} STANDING`,
          point.x,
          point.y - 325,
        );
      }
      for (const a of this.living) {
        if (a.role !== "captain" || this.distance(p, a.enemy) > 1000) continue;
        ctx.fillStyle = "#f5d186";
        ctx.fillText(
          a.enemy.windupAttack ? "INTERRUPT ORDER" : "CAPTAIN",
          a.enemy.x,
          a.enemy.y - a.enemy.radius * 2 - 22,
        );
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
      ctx.fillText("OPEN COURT · NO FIXED TRAPS", point.x, point.y + 50);
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
    return this.props[index] ?? this.node("enemy", index);
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
      const cleared =
        this.record.chapter === 0
          ? 0
          : ARMY_CHAPTER_ENDS[this.record.chapter - 1];
      this.armyDefeated = new Set(Array.from({ length: cleared }, (_, n) => n));
    }
    this.objective = this.record.completed
      ? "This oath is complete. Use the shrine for an optional rematch."
      : (LABELS[this.slug] ??
        "Read the champion’s pattern; use the three training stations to make openings.");
    this.status = this.record.completed
      ? "Completed"
      : "Approach the arena or activate a marked objective.";
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
    this.next = 2;
    this.cycle = 0;
    this.exposedUntil = 0;
    this.holding = -1;
    this.holdTime = 0;
    this.wounds = {};
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
  }
  private begin(): void {
    this.resetRuntime();
    this.started = true;
    this.waiting = false;
    // Temporary combat progress is reset; expedition valve/anchor work is durable.
    if (!["augeas", "titan"].includes(this.slug)) this.record.steps = [];
    if (this.slug === "army") {
      const from =
        this.record.chapter === 0
          ? 0
          : ARMY_CHAPTER_ENDS[this.record.chapter - 1];
      this.armyDefeated = new Set(Array.from({ length: from }, (_, n) => n));
      this.armyNext = from;
      if (
        this.record.chapter < 4 &&
        this.distance(
          this.game.player,
          this.node(`chapter_${this.record.chapter}`),
        ) > 750
      ) {
        const safe = this.node("safe", this.record.chapter),
          point = findOpenNear(this.game.map, safe.x, safe.y, 12, 8);
        this.game.player.x = point.x;
        this.game.player.y = point.y;
      }
      this.deployArmy();
      return;
    }
    const initial = ["hind", "boar", "bull"].includes(this.slug)
      ? this.at(0)
      : this.node("boss", 0);
    const principal = this.spawn(this.id, "boss", 0, initial);
    principal.scripted = true;
    principal.friendly = PUZZLE_ONLY.has(this.slug) || this.slug === "hydra";
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
          "aegean_sacred_boar",
          "mare",
          i,
          this.node("arena"),
        );
        a.scripted = true;
        a.def = { ...a.def, name: `Mare ${i + 1} of Diomedes` };
      }
    } else if (this.slug === "hippolyta") {
      principal.friendly = true;
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
      for (let i = 0; i < 2; i++)
        this.spawn(
          "aegean_centaur_elder",
          "body",
          i,
          this.node("enemy", i + 1),
        );
    }
    this.objective =
      LABELS[this.slug] ??
      "Complete the training stations, then defeat the champion.";
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
    e.attackCd = 1.5 + index * 0.16;
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
    for (let i = 0; i < Math.min(count, 8 - existing); i++) {
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
  private warn(
    point: Point,
    radius: number,
    delay: number,
    damage: number,
    label: string,
    color = "#ddb778",
    after?: () => void,
  ): void {
    this.game.telegraph(point.x, point.y, radius, delay, color, "circle");
    this.warnings.push({
      ...point,
      radius,
      at: this.now + delay,
      damage,
      color,
      label,
      after,
      threatened:
        this.distance(this.game.player, point) <
        radius + this.game.player.radius,
    });
  }
  private line(
    point: Point,
    angle: number,
    length: number,
    delay: number,
    damage: number,
    label: string,
    after?: () => void,
  ): void {
    this.game.telegraph(
      point.x,
      point.y,
      length,
      delay,
      "#a8c5e6",
      "line",
      angle,
      28,
    );
    const dx = this.game.player.x - point.x,
      dy = this.game.player.y - point.y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    const across = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    this.warnings.push({
      ...point,
      radius: 28,
      at: this.now + delay,
      damage,
      color: "#a8c5e6",
      label,
      line: { angle, length },
      after,
      threatened:
        along >= 0 && along <= length && across < 28 + this.game.player.radius,
    });
  }
  private resolveWarnings(): void {
    const p = this.game.player;
    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i];
      if (w.at > this.now) continue;
      this.warnings.splice(i, 1);
      let hit = this.distance(p, w) < w.radius + p.radius;
      if (w.line) {
        const dx = p.x - w.x,
          dy = p.y - w.y;
        const along = dx * Math.cos(w.line.angle) + dy * Math.sin(w.line.angle);
        const across = Math.abs(
          -dx * Math.sin(w.line.angle) + dy * Math.cos(w.line.angle),
        );
        hit =
          along >= -p.radius &&
          along <= w.line.length + p.radius &&
          across < w.radius + p.radius;
      }
      this.game.ringAt(w.x, w.y, w.radius, w.color);
      if (hit && w.damage > 0)
        this.game.damagePlayer(w.damage, {
          element: "physical",
          label: w.label,
          fromX: w.x,
          fromY: w.y,
        });
      if (!hit && w.damage > 0 && w.threatened) this.powerEvent("onHazardExit");
      w.after?.();
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
      if (
        !this.waiting &&
        !this.record.completed &&
        this.distance(this.game.player, this.node("arena")) < 480
      )
        this.begin();
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
      return;
    }
    this.updateAdventure(dt);
    this.lastPlayer = { x: this.game.player.x, y: this.game.player.y };
    this.lastHP = this.game.player.hp;
  }

  private attack(
    e: Enemy | undefined,
    key: string,
    extra: Partial<BossAttack> = {},
  ): boolean {
    if (!e || e.dead) return false;
    return e.queueAttack(this.game, { ...AEGEAN_ATTACKS[key], ...extra });
  }
  private updateAdventure(dt: number): void {
    const p = this.game.player,
      boss = this.boss;
    this.status = `${this.record.steps.length}/${this.count()} objectives${this.exposedUntil > this.now ? " · EXPOSED" : ""}`;
    if (
      boss &&
      !boss.windupAttack &&
      !["hind", "hesperides", "titan", "scylla", "talos"].includes(this.slug)
    ) {
      if (this.distance(boss, p) > 170) this.move(boss, p, 0.68);
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
      for (const a of this.actors.filter((a) => a.role === "herd")) {
        if (this.distance(a.enemy, p) < 460 && this.distance(a.enemy, p) > 55)
          this.move(a.enemy, { x: p.x - 35 - a.index * 25, y: p.y + 40 }, 1.1);
      }
      if (
        !boss &&
        this.allSteps() &&
        !this.living.some((a) => a.role === "body")
      )
        this.finish();
    }
    if (this.slug === "medusa" && boss) {
      const facing =
        (p as typeof p & { facing?: number }).facing ??
        { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[p.dir];
      const gazing =
        this.cycle % 3 === 1 &&
        this.distance(p, boss) < 520 &&
        this.exposedUntil <= this.now;
      const looking =
        angleBetween(facing, angleTo(p.x, p.y, boss.x, boss.y)) < 0.65;
      this.gaze = Math.max(
        0,
        Math.min(100, this.gaze + dt * (gazing && looking ? 27 : -35)),
      );
      this.status += ` · Petrification ${Math.round(this.gaze)}%${gazing ? " — LOOK AWAY" : ""}`;
      if (this.gaze >= 100) {
        this.gaze = 0;
        this.game.damagePlayer(p.maxHp * 5, {
          trueDamage: true,
          element: "arcane",
          label: "Petrification",
        });
      }
    }
    if (this.slug === "talos" && boss) {
      const station = this.at(this.record.steps.length % 3);
      if (!boss.windupAttack && this.distance(boss, station) > 80)
        this.move(boss, station, 0.7);
      this.status +=
        this.distance(boss, station) < 170
          ? " · Ankle seal in reach"
          : " · Talos approaches the next station";
    }
    if (this.holding >= 0 && ["titan", "scylla"].includes(this.slug)) {
      if (
        this.distance(p, this.at(this.holding)) < 100 &&
        this.addCount() === 0
      ) {
        this.holdTime += dt;
        this.status += ` · Hold ${Math.floor(this.holdTime)}/6s`;
        if (this.holdTime >= 6) {
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
          this.distance(a.enemy, p) < 150 &&
          this.cycle % 4 === a.index
        )
          this.attack(a.enemy, "thrust", { power: 0.55, windup: 1.25 });
      }
    if (this.next > 0 || !boss || boss.windupAttack) return;
    this.cycle++;
    this.next = 4.6;
    switch (this.slug) {
      case "nemea":
      case "boar":
      case "bull":
      case "minotaur":
        this.attack(boss, this.cycle % 3 ? "charge" : "sweep");
        break;
      case "augeas":
        this.warn(
          { x: p.x, y: p.y },
          90,
          1.8,
          boss.damage * 1.1,
          "Reservoir flood",
          "#76bccc",
        );
        break;
      case "birds":
        this.attack(boss, "volley");
        break;
      case "mares":
        this.attack(boss, this.cycle % 2 ? "volley" : "thrust");
        break;
      case "hippolyta":
        if (this.allSteps())
          this.attack(boss, this.cycle % 2 ? "thrust" : "sweep");
        break;
      case "geryon":
        this.attack(boss, ["thrust", "volley", "sweep"][this.cycle % 3]);
        break;
      case "python":
        this.attack(boss, this.cycle % 2 ? "poison" : "charge");
        break;
      case "medusa":
        this.attack(boss, this.cycle % 3 === 1 ? "thrust" : "poison");
        break;
      case "chimera":
        this.attack(boss, ["flame", "poison", "charge"][this.cycle % 3]);
        break;
      case "cyclops": {
        const target = { x: p.x, y: p.y };
        this.warn(
          target,
          82,
          1.8,
          boss.damage * 2,
          "Quarry boulder",
          "#c9b992",
          () => {
            const i = this.props.findIndex(
              (prop) =>
                this.distance(prop, target) < 145 &&
                !this.done(this.props.indexOf(prop)),
            );
            if (i >= 0) {
              this.wounds[i] = this.now + 9;
              this.say(`Counterweight ${i + 1} exposed`);
            }
          },
        );
        break;
      }
      case "talos":
        this.attack(boss, this.cycle % 2 ? "ring" : "flame");
        break;
      case "scylla":
        this.line(
          this.at(this.cycle % 3),
          this.cycle % 2 ? 0 : Math.PI / 2,
          600,
          1.8,
          boss.damage * 1.3,
          "Scylla’s hunting limb",
        );
        break;
      case "titan":
        this.warn(
          { x: p.x, y: p.y },
          100,
          2,
          boss.damage * 1.5,
          "The Titan pulls the chain",
          "#d78c65",
        );
        break;
      case "sanctuary_aegis":
        this.attack(boss, "volley");
        break;
      case "sanctuary_forge":
        this.attack(boss, this.cycle % 2 ? "flame" : "ring");
        break;
      case "sanctuary_names":
        this.attack(boss, "storm");
        break;
      default: {
        const patterns = boss.def.boss?.attacks ?? [];
        if (patterns.length)
          this.attack(boss, patterns[this.cycle % patterns.length].id);
        if (this.slug === "champion_guard" && this.cycle % 3 === 0)
          this.adds(2, "aegean_royal_guard");
      }
    }
  }

  private spawnHydraHead(index: number): void {
    const head = this.spawn("aegean_viper", "head", index, this.at(index));
    head.scripted = true;
    head.maxHp *= 5;
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
    if (this.next <= 0) {
      this.next = 2.3;
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
        );
      }
    }
    if (this.sealed.size === 5)
      this.objective =
        "All mortal necks are sealed. Return to the first brazier to drop the temple slab.";
  }
  private updateHind(dt: number): void {
    const hind = this.boss;
    if (!hind) return;
    if (this.allSteps()) {
      if (this.cycle === 0) {
        this.cycle = 1;
        this.adds(4);
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
        this.next = 4;
        this.warn(
          { x: this.game.player.x, y: this.game.player.y },
          75,
          1.7,
          (this.boss?.damage ?? 300) * 1.3,
          "Falling starlight",
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
    if (this.allSteps()) {
      const entry = this.node("entry");
      if (this.distance(boss, this.game.player) < 300)
        this.move(boss, entry, 0.8);
      this.objective =
        "Escort the subdued guardian to the entry arch; then return him to his duty.";
      if (this.distance(boss, entry) < 135) this.finish();
      return;
    }
    this.status =
      this.exposedUntil > this.now
        ? "RESTING — place the next restraint"
        : `Read the three heads · ${this.record.steps.length}/3 restraints`;
    if (this.next <= 0 && !boss.windupAttack) {
      this.cycle++;
      if (this.cycle % 4 === 0) {
        this.exposedUntil = this.now + 6;
        this.next = 6;
        this.say("All three heads are resting");
      } else {
        this.next = 2.5;
        boss.attackCd = 0;
        this.attack(boss, ["thrust", "sweep", "ring"][(this.cycle - 1) % 3]);
      }
    }
    if (this.game.player.hp < this.lastHP) this.gaze += 22;
    this.gaze = Math.max(0, this.gaze - dt * 3);
    if (this.gaze > 100) {
      this.say("The guardian is agitated. The judges restore the trial.");
      this.begin();
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
      this.status = `Standard held ${Math.floor(this.holdTime)}/8s`;
      if (this.holdTime >= 8) {
        this.mark(this.holding);
        this.holding = -1;
        this.holdTime = 0;
        if (this.allSteps() && this.boss) {
          this.boss.friendly = false;
          this.objective = "Win the queen’s nonlethal duel.";
        }
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
    if (prop.data?.action === "practice") {
      this.startPractice(Number(prop.data.phase ?? this.record.bestPhase));
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
    this.props.forEach((p, i) => {
      const d = this.distance(p, this.game.player);
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
          this.say("Defeat this chapter’s remaining soldiers before resting.");
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
        this.exposedUntil = this.now + 9;
        if (this.allSteps() && ["boar", "bull"].includes(this.slug))
          this.finish();
        return;
      case "augeas":
      case "sanctuary_names": {
        const sequence = this.slug === "augeas" ? [0, 2, 1] : [1, 0, 2];
        if (this.addCount()) {
          this.say("Clear the guardians from the mechanism.");
          return;
        }
        if (index !== sequence[this.record.steps.length]) {
          this.say(
            this.slug === "augeas"
              ? "Read the river diagram: I → III → II."
              : "The procession names its order: II → I → III.",
          );
          return;
        }
        this.mark(
          index,
          this.slug === "augeas" ? "River diverted" : "A name returns",
        );
        this.exposedUntil = this.now + 10;
        this.adds(
          2,
          this.slug === "augeas" ? "aegean_talos_shard" : "aegean_oath_shade",
          this.at(index),
        );
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
        this.adds(3, "aegean_bronze_harpy", this.at(index));
        this.exposedUntil = this.now + 12;
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
        this.holding = index;
        this.holdTime = 0;
        this.adds(3, "aegean_satyr", this.at(index));
        this.say("The squad rallies. Clear the ground and hold for 8 seconds.");
        return;
      case "geryon": {
        const herd = this.actors.filter((a) => a.role === "herd");
        if (
          index !== this.record.steps.length ||
          herd.some((a) => this.distance(a.enemy, this.at(index)) > 190)
        ) {
          this.say("Gather the cattle here in the refuge-bell order.");
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
        this.adds(2, "aegean_viper", this.at(index));
        return;
      case "medusa":
        this.mark(index, "Mirror aligned — reflected gaze");
        this.gaze = 0;
        this.exposedUntil = this.now + 10;
        return;
      case "chimera":
        if (
          !boss ||
          boss.lastImpact?.id !== "flame" ||
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
          ) > 0.55
        ) {
          this.say(
            "Bait the Chimera’s furnace breath onto this vent, then open it.",
          );
          return;
        }
        this.mark(index, "Vent ignited");
        this.exposedUntil = this.now + 10;
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
        this.exposedUntil = this.now + 14;
        return;
      case "scylla":
      case "titan":
        if (this.holding === index) return;
        this.holding = index;
        this.holdTime = 0;
        if (this.slug === "titan")
          this.adds(2, "aegean_jailer", this.at(index));
        this.say(
          this.slug === "titan"
            ? "Clear the anchor, then hold it for 6 seconds."
            : "Hold the beacon through the current reversal for 6 seconds.",
        );
        return;
      default:
        if (!boss || boss.windupAttack || !recovery) {
          this.say("Use the station during the guardian’s recovery.");
          return;
        }
        this.mark(index, "Trial station attuned");
        this.exposedUntil = this.now + 10;
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
    if (this.slug === "hippolyta" && !this.allSteps()) return false;
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
    if (this.slug === "hippolyta" && !this.allSteps()) return 0;
    const windowed = !["mares", "geryon"].includes(this.slug);
    if (windowed && this.exposedUntil <= this.now) amount *= 0.08;
    if (!this.allSteps())
      amount = Math.min(amount, Math.max(0, enemy.hp - enemy.maxHp * 0.12));
    return amount;
  }
  onEnemyKilled(enemy: Enemy): boolean {
    const actor = this.actors.find((a) => a.enemy === enemy);
    if (!actor) return false;
    if (this.slug === "army") {
      if (actor.roster !== undefined) this.armyDefeated.add(actor.roster);
      if (actor.role === "captain")
        this.brokenUntil[Math.floor((actor.roster ?? 0) / 30)] = this.now + 30;
      // Preserve the class's on-kill sustain without issuing 300 boss rewards.
      const leech = this.game.player.enchantPower("leeching");
      if (leech > 0)
        this.game.player.hp = Math.min(
          this.game.player.maxHp,
          this.game.player.hp + (this.game.player.maxHp * leech) / 100,
        );
      return true;
    }
    if (actor.role === "head") {
      this.wounds[actor.index] = this.now + 8;
      this.say(`Head ${actor.index + 1} severed — cauterize its wound!`);
      return true;
    }
    if (actor.role === "boss") {
      if (this.slug === "leonidas") {
        if (this.finalSequence >= 3) this.finish();
      } else if (
        this.allSteps() &&
        (this.slug !== "birds" || this.addCount() === 0) &&
        (this.slug !== "geryon" || !this.living.some((a) => a.role === "body"))
      )
        this.finish();
      return true;
    }
    if (
      this.slug === "geryon" &&
      actor.role === "body" &&
      this.allSteps() &&
      !this.boss &&
      !this.living.some((a) => a.role === "body")
    )
      this.finish();
    return actor.role === "guard" || actor.role === "add";
  }

  private finish(): void {
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
      "Oath complete. Your victory and rewards are permanently recorded.";
    this.status = "Completed";
    this.game.bossTarget = null;
    this.clearActors();
  }

  private deployArmy(): void {
    const end = ARMY_CHAPTER_ENDS[this.record.chapter];
    if (end === undefined) {
      this.finish();
      return;
    }
    let active = this.living.length;
    while (active < 36 && this.armyNext < end) {
      const n = this.armyNext++,
        r = ARMY_ROSTER[n],
        anchor = this.node(`chapter_${this.record.chapter}`);
      const slot = n % 30;
      const e = this.spawn(
        `aegean_army_${r.role}`,
        r.role,
        slot,
        {
          x: anchor.x + ((slot % 6) - 2.5) * 47,
          y: anchor.y + Math.floor(slot / 6) * 46,
        },
        n,
      );
      e.scripted = true;
      e.def = { ...e.def, name: `${r.company} ${e.def.name}` };
      active++;
    }
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
      e.windupAttack = null;
      e.windupTime = 0;
      e.attackGeometry = null;
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
    this.deployArmy();
    const end = ARMY_CHAPTER_ENDS[this.record.chapter];
    this.status = `${this.armyStanding} standing · Chapter ${this.record.chapter + 1}/4 · ${this.living.length} engaged`;
    this.objective =
      [
        "Break the Bronze Door. Flank the linked shields.",
        "Clear the Red Terraces. Use cover between javelin lanes.",
        "Split the Turning Wall. Interrupt the visible captain’s order.",
        "Overcome the Last Sixty. Both captains must fall.",
      ][this.record.chapter] ?? "";
    if (this.armyNext >= end && !this.living.length) {
      this.record.chapter++;
      if (this.record.chapter === 4) {
        this.finish();
        return;
      }
      this.waiting = true;
      this.warnings = [];
      this.game.player.hp = this.game.player.maxHp;
      this.game.player.mp = this.game.player.maxMp;
      this.game.player.sp = this.game.player.maxSp;
      this.status = `Checkpoint: ${end}/300 defeated. Activate a rally shrine to continue.`;
      this.objective = this.status;
      return;
    }
    const p = this.game.player;
    for (const a of this.living) {
      const e = a.enemy;
      if (e.windupAttack || e.statuses.some((s) => s.kind === "stun")) continue;
      const desired =
        a.role === "javelin" ? 270 : a.role === "runner" ? 70 : 95;
      if (this.distance(e, p) > desired) {
        const flank =
          a.role === "runner"
            ? a.index % 2
              ? 100
              : -100
            : ((a.index % 6) - 2.5) * 17;
        const angle = this.clock * 0.09 + a.index * 0.21;
        const target =
          this.record.chapter === 2 && ["hoplite", "shield"].includes(a.role)
            ? { x: p.x + Math.cos(angle) * 120, y: p.y + Math.sin(angle) * 120 }
            : {
                x: p.x + flank * (this.record.chapter === 1 ? 1.4 : 1),
                y: p.y + (a.role === "runner" ? 45 : 0),
              };
        this.move(
          e,
          target,
          a.role === "shield"
            ? 0.65
            : this.record.chapter === 3 && a.role === "runner"
              ? 1.05
              : 0.9,
        );
      }
    }
    if (this.next <= 0) {
      this.next = 1.2;
      this.cycle++;
      // One locally relevant formation attack at a time. Distant reserves never hit.
      const candidates = this.living.filter(
        (a) =>
          this.distance(a.enemy, p) < 430 &&
          !a.enemy.windupAttack &&
          !a.enemy.statuses.some((s) => s.kind === "stun"),
      );
      const priority =
        this.cycle % 5 === 0
          ? candidates.find((a) => a.role === "captain")
          : this.record.chapter === 1 && this.cycle % 3 === 0
            ? candidates.find((a) => a.role === "javelin")
            : undefined;
      const a =
        priority ?? candidates[this.cycle % Math.max(1, candidates.length)];
      if (a) {
        a.enemy.attackCd = 0;
        const attack =
          a.role === "javelin"
            ? "volley"
            : a.role === "runner"
              ? "charge"
              : a.role === "captain"
                ? "sweep"
                : "thrust";
        this.attack(a.enemy, attack, {
          windup: a.role === "captain" ? 1.6 : 1.2,
          range: a.role === "runner" ? 190 : 320,
          power: a.role === "captain" ? 1.8 : 1.1,
          count: 3,
        });
      }
    }
    for (const key of Object.keys(this.formationBreak))
      this.formationBreak[Number(key)] = Math.max(
        0,
        this.formationBreak[Number(key)] - dt * 0.014,
      );
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
    this.phaseIntroUntil = this.now + 2.4;
    this.phaseObjective = 0;
    this.cycle = 0;
    this.next = 2.5;
    boss.windupAttack = null;
    boss.windupTime = 0;
    boss.attackGeometry = null;
    this.warnings = [];
    const ph = boss.def.boss!.phases[this.phase];
    this.game.toast(ph.name, ph.line, "#e3c47b");
    if (this.phase === 2 && this.guardWaves === 0) this.deployGuards();
    if (this.phase >= 4)
      for (const a of this.actors.filter((a) => a.role === "guard"))
        a.enemy.dead = true;
    if (this.phase === 5) this.finalSequence = 0;
  }
  private deployGuards(): void {
    if (this.guardWaves >= 2) return;
    const wave = this.guardWaves++;
    for (let i = 0; i < 6; i++) {
      const e = this.spawn(
        "aegean_royal_guard",
        "guard",
        wave * 6 + i,
        this.node("guard", i),
      );
      e.scripted = true;
    }
    this.say(`Royal Guard ${wave + 1}/2 — six loyal companions enter`);
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
      amount *= 0.15;
    if (
      this.phase === 2 &&
      this.living.some((a) => a.role === "guard") &&
      this.exposedUntil <= this.now
    )
      amount *= 0.45;
    const thresholds = [0.82, 0.64, 0.42, 0.18, 0.05, 0];
    const floor = boss.maxHp * thresholds[this.phase];
    const gate =
      this.phase === 1
        ? this.phaseObjective >= 2
        : this.phase === 2
          ? this.guardWaves === 2 &&
            !this.living.some((a) => a.role === "guard")
          : this.phase === 5
            ? this.finalSequence >= 3
            : true;
    if (!gate)
      return Math.min(
        amount,
        Math.max(0, boss.hp - floor - (this.phase === 5 ? 1 : 0)),
      );
    if (this.phase < 5 && amount >= boss.hp - floor) {
      this.carryDamage = Math.min(
        boss.maxHp * 0.015,
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
      this.exposedUntil = this.now + 9;
      this.powerEvent("onStagger", boss);
      this.say("Oath link extinguished — the shield opens");
    } else if (this.phase === 2 && index < 4) {
      if (!this.warnings.some((w) => w.label === "Oath chant")) {
        this.say("The standard can interrupt the king while he chants.");
        return;
      }
      this.exposedUntil = this.now + 7;
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
      this.say("Conductor grounded — a safe lane opens");
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
      "Learn the committed combinations. Strike after the third blow.",
      "Break two distinct brazier links; exploit the shield openings.",
      "Defeat twelve finite guards. Interrupt the oath chant at a standard.",
      "Ground conductors and avoid both journeys of the spear.",
      "The king stands alone. Read his recovery before committing.",
      `The Last Oath: survive the three patterns (${this.finalSequence}/3).`,
    ][this.phase];
    if (this.now < this.phaseIntroUntil) return;
    const guards = this.living.filter((a) => a.role === "guard");
    for (const a of guards)
      if (!a.enemy.windupAttack && this.distance(a.enemy, p) > 120)
        this.move(a.enemy, p, 0.7);
    this.guardNext -= dt;
    const committedGuards = guards.filter((a) => a.enemy.windupAttack).length;
    if (
      guards.length &&
      this.guardNext <= 0 &&
      committedGuards === 0 &&
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
        this.attack(guard.enemy, "thrust", { windup: 1.5, power: 1.05 });
        this.guardNext = 3.4;
      }
    }
    const threshold = [0.82, 0.64, 0.42, 0.18, 0.05][this.phase];
    if (this.phase < 5 && boss.hp <= boss.maxHp * threshold + 0.01) {
      const gate =
        this.phase === 1
          ? this.phaseObjective >= 2
          : this.phase === 2
            ? this.guardWaves === 2 &&
              !this.living.some((a) => a.role === "guard")
            : true;
      if (gate) {
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
      this.guardWaves < 2
    )
      this.deployGuards();
    if (this.phase === 5 && this.finalSequence < 3) {
      if (this.next <= 0 && !boss.windupAttack && !this.warnings.length) {
        const step = this.finalSequence;
        this.next = 4.8;
        const point = { x: p.x, y: p.y };
        if (step === 0)
          this.line(
            boss,
            angleTo(boss.x, boss.y, p.x, p.y),
            560,
            1.3,
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
            1.7,
            boss.damage * 2.1,
            "Last Oath — the sky",
            "#d0e7fa",
            () => {
              this.finalSequence = Math.max(this.finalSequence, 2);
            },
          );
        else
          this.warn(
            { x: boss.x, y: boss.y },
            240,
            2,
            boss.damage * 2.3,
            "Last Oath — the king",
            "#e2c88e",
            () => {
              this.finalSequence = 3;
              this.exposedUntil = this.now + 12;
              this.say("The oath is open. Finish the duel.");
            },
          );
      }
      return;
    }
    if (!boss.windupAttack && this.distance(boss, p) > 170)
      this.move(boss, p, this.phase >= 4 ? 0.95 : 0.7);
    if (this.next > 0 || boss.windupAttack) return;
    if (
      this.warnings.filter((w) => w.damage > 0).length +
        guards.filter((a) => a.enemy.windupAttack).length >=
      2
    ) {
      this.next = 0.3;
      return;
    }
    this.next = this.phase >= 4 ? 2.2 : 3.2;
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
        1.15,
        boss.damage * 1.7,
        "The Returning King — outbound",
        () => {
          this.line(
            {
              x: origin.x + Math.cos(angle) * length,
              y: origin.y + Math.sin(angle) * length,
            },
            angle + Math.PI,
            length,
            1.3,
            boss.damage * 1.7,
            "The Returning King — return",
          );
        },
      );
    } else this.attack(boss, key);
    // Only one extra scheduled temple hazard; always preserve the opposite lane.
    if (
      this.phase >= 1 &&
      this.cycle % 3 === 0 &&
      this.warnings.filter((w) => w.damage > 0).length +
        (boss.windupAttack ? 1 : 0) +
        guards.filter((a) => a.enemy.windupAttack).length <
        2
    ) {
      const index = this.phase >= 3 ? 4 + (this.cycle % 4) : this.cycle % 4,
        node = this.at(index);
      if ((this.groundedUntil[index] ?? 0) <= this.now)
        this.warn(
          node,
          100,
          1.8,
          boss.damage * 1.4,
          this.phase >= 3 ? "Storm conductor" : "Spear channel",
        );
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
            boss.hp = Math.min(boss.maxHp * 0.64, boss.hp + boss.maxHp * 0.06);
        },
      );
    }
    // Capped endurance pressure; never an infinitely accelerating boss.
    if (this.clock > 900) this.next = Math.max(1.8, this.next - 0.35);
  }
}
