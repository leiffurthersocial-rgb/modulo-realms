import { createShipDeck } from "./deck";
import type { Game } from "../core/game";
import { AEGEAN_SHIPS, AEGEAN_FITTINGS } from "../../data/aegean/content";
import { AEGEAN_PORTS, type AegeanPort } from "../../data/aegean/world";
import { boxHitsTerrain } from "../world/map";
import { Enemy } from "../entities/enemy";
import { ENEMY_BY_ID } from "../../data/enemies";
import { angleDelta, dirFromAngle } from "../core/math";

export interface Vessel {
  id: string;
  hull: number;
  fittings: string[];
  cargo: string[];
}
export interface NavalSave {
  deck?: { x: number; y: number; enemies: string[] };
  fleet: Vessel[];
  selected: string;
  aboard: boolean;
  heading: number;
  lastPort: string;
  visitedPorts: string[];
  shipX: number;
  shipY: number;
  wreck?: { x: number; y: number; gold: number };
}
const FITTING_TEXT = [
  {
    id: "ram",
    name: "Bullhorn Ram",
    requires: "aegean_bull",
    description: "Ram damage +40%.",
    cost: 24000,
  },
  {
    id: "stabilizer",
    name: "Bronze-heart Stabilizer",
    requires: "aegean_talos",
    description: "Storm hull damage -35%.",
    cost: 36000,
  },
  {
    id: "gong",
    name: "Stymphalian Signal Gong",
    requires: "aegean_birds",
    description: "Volley reload -25%.",
    cost: 22000,
  },
  {
    id: "screen",
    name: "Nemean Boarding Screen",
    requires: "aegean_nemea",
    description: "Monster damage -20%.",
    cost: 28000,
  },
  {
    id: "lens",
    name: "Gorgon Lookout Lens",
    requires: "aegean_medusa",
    description: "Extended targeting and earlier monster warnings.",
    cost: 24000,
  },
  {
    id: "line",
    name: "Ariadne Recovery Line",
    requires: "aegean_minotaur",
    description: "Preserves all voyage gold on shipwreck.",
    cost: 30000,
  },
];
export const FITTINGS = FITTING_TEXT.map((f, i) => ({
  ...f,
  cost: AEGEAN_FITTINGS[i].cost,
  slot: AEGEAN_FITTINGS[i].slot,
}));
export class NavalSystem {
  state: NavalSave = {
    fleet: [],
    selected: "",
    aboard: false,
    heading: 0,
    lastPort: "aegean_aigialos",
    visitedPorts: [],
    shipX: 0,
    shipY: 0,
  };
  private volley = 0;
  private ram = 0;
  private spawn = 8;
  private storm = 0;
  private strikes: { x: number; y: number; at: number }[] = [];
  speed = 0;
  constructor(public game: Game) {}
  get vessel(): Vessel | undefined {
    return this.state.fleet.find((s) => s.id === this.state.selected);
  }
  get definition() {
    return AEGEAN_SHIPS.find((s) => s.id === this.state.selected);
  }
  get aboard(): boolean {
    return this.state.aboard;
  }
  get danger(): number {
    const g = this.game,
      p = g.player;
    const i = Math.floor(p.y / 32) * g.map.w + Math.floor(p.x / 32);
    const d = g.map.offshore?.[i] ?? 0;
    return p.x > 1632 * 32 && p.y > 320 * 32 && p.y < 640 * 32
      ? 4
      : d > 160
        ? 3
        : d > 96
          ? 2
          : d > 32
            ? 1
            : 0;
  }
  get dangerLabel(): string {
    return [
      "Coastal waters",
      "Outer shelf",
      "Monster waters",
      "Pelagic deep",
      "The Oath Storm",
    ][this.danger];
  }
  reset(): void {
    this.state = {
      fleet: [],
      selected: "",
      aboard: false,
      heading: 0,
      lastPort: "aegean_aigialos",
      visitedPorts: [],
      shipX: 0,
      shipY: 0,
    };
    this.speed = 0;
    this.strikes = [];
    this.volley = 0;
    this.ram = 0;
    this.spawn = 8;
    this.storm = 0;
  }
  snapshot(): NavalSave {
    return structuredClone(this.state);
  }
  restore(data?: Partial<NavalSave>): void {
    this.reset();
    if (data) this.state = { ...this.state, ...data };
    if (!this.vessel) this.state.aboard = false;
  }
  nearestPort(range = 130): AegeanPort | undefined {
    const g = this.game,
      p = g.player;
    if (g.map.id !== "overworld") return;
    return AEGEAN_PORTS.find(
      (pt) =>
        Math.hypot(
          (this.aboard ? pt.launch.x : pt.land.x) - p.x,
          (this.aboard ? pt.launch.y : pt.land.y) - p.y,
        ) < range,
    );
  }
  canStorm(): string | null {
    const c = this.game.campaign;
    if (!c.has("aegean_army"))
      return "Defeat all Three Hundred to release the storm route.";
    if (!this.state.selected.includes("stormbreaker"))
      return "Only the Stormbreaker can cross the Oath Storm.";
    const missing = ["ribs", "sail", "keel"].filter(
      (s) => !c.has(`aegean:component:${s}`),
    );
    return missing.length
      ? `Missing structural components: ${missing.join(", ")}.`
      : null;
  }
  buy(id: string): boolean {
    const d = AEGEAN_SHIPS.find((s) => s.id === id),
      g = this.game,
      p = g.player;
    if (!d || !this.nearestPort() || this.aboard) return false;
    if (this.state.fleet.some((s) => s.id === id)) {
      this.state.selected = id;
      g.touch();
      return true;
    }
    if (p.gold < d.cost || g.campaign.requirements(d.requirements).length)
      return false;
    p.gold -= d.cost;
    p.flags.add(`aegean:ship:${id.slice(7)}`);
    this.state.fleet.push({ id, hull: d.hull, fittings: [], cargo: [] });
    this.state.selected = id;
    g.toast("Your ship is ready", d.name, "#66cdd6");
    g.autosave();
    g.touch();
    return true;
  }
  fit(id: string): boolean {
    const f = FITTINGS.find((f) => f.id === id),
      v = this.vessel,
      d = this.definition,
      g = this.game;
    if (
      !f ||
      !v ||
      !d ||
      this.aboard ||
      !this.nearestPort() ||
      !g.campaign.has(f.requires)
    )
      return false;
    if (v.fittings.includes(id)) {
      v.fittings = v.fittings.filter((x) => x !== id);
      v.cargo.push(id);
    } else {
      if (
        v.fittings.filter(
          (id) => FITTINGS.find((f) => f.id === id)?.slot === f.slot,
        ).length >= d.slots[f.slot]
      )
        return false;
      const stored = v.cargo.indexOf(id);
      if (stored >= 0) v.cargo.splice(stored, 1);
      else {
        if (g.player.gold < f.cost) return false;
        g.player.gold -= f.cost;
      }
      v.fittings.push(id);
    }
    g.autosave();
    g.touch();
    return true;
  }
  get repairPrice(): number {
    return Math.max(
      0,
      Math.ceil(
        ((this.definition?.hull ?? 0) - (this.vessel?.hull ?? 0)) *
          0.7 *
          (this.game.player.flags.has("aegean:crew:shipwright") ? 0.75 : 1),
      ),
    );
  }
  repair(): boolean {
    const v = this.vessel,
      d = this.definition,
      g = this.game;
    if (!v || !d || !this.nearestPort() || this.aboard) return false;
    const price = this.repairPrice;
    if (g.player.gold < price) return false;
    g.player.gold -= price;
    v.hull = d.hull;
    g.autosave();
    g.touch();
    return true;
  }
  embark(): boolean {
    const g = this.game,
      pt = this.nearestPort();
    if (!pt || !this.vessel || this.vessel.hull <= 0 || this.aboard)
      return false;
    if (pt.gate === "army" && !g.campaign.has("aegean_army")) return false;
    if (boxHitsTerrain(g.map, pt.launch.x, pt.launch.y, 16, 12, "ship")) {
      g.toast("Launch obstructed", "Use another harbour.", "#d9553f");
      return false;
    }
    this.state.lastPort = pt.id;
    this.state.aboard = true;
    this.state.shipX = pt.launch.x;
    this.state.shipY = pt.launch.y;
    this.state.heading = pt.id === "aegean_asterion" ? Math.PI : 0;
    g.player.x = pt.launch.x;
    g.player.y = pt.launch.y;
    g.player.invuln = 2;
    g.closeAll();
    g.autosave();
    g.touch();
    return true;
  }
  dock(): boolean {
    const g = this.game,
      pt = this.nearestPort(170);
    if (!pt || !this.aboard) return false;
    const reason =
      pt.id === "aegean_asterion"
        ? this.canStorm()
        : pt.gate === "army" && !g.campaign.has("aegean_army")
          ? "The military harbour is still held."
          : null;
    if (reason) {
      g.toast("Landing refused", reason, "#d9553f");
      return false;
    }
    this.state.aboard = false;
    this.state.lastPort = pt.id;
    this.speed = 0;
    g.player.x = pt.land.x;
    g.player.y = pt.land.y;
    g.player.vx = g.player.vy = 0;
    if (!this.state.visitedPorts.includes(pt.id))
      this.state.visitedPorts.push(pt.id);
    g.player.discovered.add(pt.id);
    if (pt.id === "aegean_asterion") {
      g.player.flags.add("aegean:landed");
      g.player.flags.add("aegean:complete:aegean_storm_crossing");
    }
    g.campaign.setCheckpoint();
    g.toast(pt.name, "Your ship is secured at the landing.", "#66cdd6");
    g.autosave();
    g.touch();
    return true;
  }
  damage(amount: number): void {
    if (!this.aboard || !this.vessel) return;
    const g = this.game;
    const brace = g.input.isDown("offhand") || g.input.isDown("brace");
    this.vessel.hull = Math.max(
      0,
      this.vessel.hull -
        amount *
          (brace ? 0.45 : 1) *
          (this.vessel.fittings.includes("screen") ? 0.8 : 1),
    );
    g.shake(3);
    if (this.vessel.hull <= 0) this.wreck();
  }
  wreck(): void {
    const g = this.game,
      p = g.player,
      v = this.vessel!;
    const gold = v.fittings.includes("line")
      ? 0
      : Math.min(25000, Math.floor(p.gold * 0.02));
    p.gold -= gold;
    this.state.wreck = { x: p.x, y: p.y, gold };
    this.state.aboard = false;
    delete this.state.deck;
    if (g.map.id !== "overworld") g.setMap("overworld");
    const pt =
      AEGEAN_PORTS.find((pt) => pt.id === this.state.lastPort) ??
      AEGEAN_PORTS[0];
    p.x = pt.land.x;
    p.y = pt.land.y;
    v.hull = Math.max(1, Math.round((this.definition?.hull ?? 1000) * 0.4));
    p.hp = Math.max(1, p.maxHp * 0.5);
    p.invuln = 5;
    this.speed = 0;
    g.enemies = g.enemies.filter((e) => !e.spawnId?.startsWith("sea:"));
    g.toast(
      "The crew brings you ashore",
      "Emergency repairs are free. Lost voyage gold remains at the wreck.",
      "#66cdd6",
    );
    g.autosave();
    g.touch();
  }
  buildDeck(): void {
    if (this.state.deck)
      this.game.maps.set("aegean_ship_deck", createShipDeck());
  }
  enterDeck(): boolean {
    const g = this.game,
      p = g.player;
    if (!this.aboard) return false;
    const threats = g.enemies.filter(
      (e) => !e.friendly && !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 650,
    );
    if (!threats.length) {
      g.toast(
        "The deck is clear",
        "A sea threat must be close enough to board.",
        "#66cdd6",
      );
      return false;
    }
    this.state.deck = {
      x: p.x,
      y: p.y,
      enemies: threats
        .slice(0, 4)
        .map((e) =>
          e.def.id === "aegean_siren" ? "aegean_siren" : "aegean_crab",
        ),
    };
    this.state.aboard = false;
    this.buildDeck();
    g.setMap("aegean_ship_deck");
    p.x = 9 * 32;
    p.y = 13 * 32;
    p.invuln = 2;
    this.populateDeck();
    g.toast(
      "Boarders over the rail",
      "Your class abilities work on deck. Clear the attack, then use the helm.",
      "#66cdd6",
    );
    g.touch();
    return true;
  }
  populateDeck(): void {
    const g = this.game;
    if (!this.state.deck || g.map.id !== "aegean_ship_deck") return;
    for (const [i, id] of this.state.deck.enemies.entries())
      g.enemies.push(
        new Enemy(
          id,
          (24 + (i % 2) * 4) * 32,
          (9 + Math.floor(i / 2) * 5) * 32,
          90 + this.danger * 2,
          { spawnId: `deck:${i}`, region: "aegean_pelagic" },
        ),
      );
  }
  returnHelm(): boolean {
    const g = this.game,
      deck = this.state.deck;
    if (!deck) return false;
    if (g.enemies.some((e) => !e.dead && !e.friendly)) {
      g.toast(
        "The helm is under attack",
        "Clear the boarding party first.",
        "#66cdd6",
      );
      return false;
    }
    delete this.state.deck;
    g.setMap("overworld");
    g.player.x = deck.x;
    g.player.y = deck.y;
    g.player.invuln = 3;
    this.state.aboard = true;
    this.spawn = 15;
    g.autosave();
    g.touch();
    return true;
  }
  update(dt: number): void {
    if (!this.aboard) return;
    const g = this.game,
      p = g.player,
      d = this.definition;
    if (!d) return;
    if (g.input.wasPressed("artifact") && this.enterDeck()) return;
    const mv = g.input.moveVector(),
      moving = Math.hypot(mv.x, mv.y) > 0.05;
    if (moving) {
      const target = Math.atan2(mv.y, mv.x);
      this.state.heading += Math.max(
        -d.turn * dt,
        Math.min(d.turn * dt, angleDelta(this.state.heading, target)),
      );
    }
    const row = g.input.isDown("dash") && p.sp > 5;
    if (row) p.sp = Math.max(0, p.sp - 12 * dt);
    const brace = g.input.isDown("brace") || g.input.isDown("offhand");
    const target = moving ? d.speed * (row ? 1.45 : 1) * (brace ? 0.55 : 1) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 1.8);
    const nx = p.x + Math.cos(this.state.heading) * this.speed * dt,
      ny = p.y + Math.sin(this.state.heading) * this.speed * dt;
    const forbidden =
      nx > 1632 * 32 && ny > 320 * 32 && ny < 640 * 32 && this.canStorm();
    if (forbidden) {
      this.speed = 0;
      if (this.storm <= 0) {
        g.toast("The storm turns you back", String(forbidden), "#e7c778");
        this.storm = 3;
      }
    } else if (!boxHitsTerrain(g.map, nx, ny, 16, 12, "ship")) {
      p.x = nx;
      p.y = ny;
    } else this.speed *= 0.4;
    p.dir = dirFromAngle(this.state.heading);
    p.vx = Math.cos(this.state.heading) * this.speed;
    p.vy = Math.sin(this.state.heading) * this.speed;
    this.state.shipX = p.x;
    this.state.shipY = p.y;
    this.volley -= dt;
    this.ram -= dt;
    this.spawn -= dt;
    this.storm -= dt;
    if (
      (g.input.isDown("attack") || g.input.mouseDown[0]) &&
      this.volley <= 0
    ) {
      this.volley = this.vessel?.fittings.includes("gong") ? 1.2 : 1.6;
      const range = this.vessel?.fittings.includes("lens") ? 620 : 500;
      const targets = g.enemies
        .filter(
          (e) =>
            !e.dead && !e.friendly && Math.hypot(e.x - p.x, e.y - p.y) < range,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
        );
      const a = targets[0]
        ? Math.atan2(targets[0].y - p.y, targets[0].x - p.x)
        : this.state.heading;
      for (let i = -1; i <= 1; i++)
        g.spawnProjectile({
          x: p.x,
          y: p.y,
          angle: a + i * 0.1,
          speed: 460,
          damage: p.attackPower() * 1.6,
          radius: 5,
          range,
          element: "physical",
          color: "#e9c780",
          friendly: true,
          sprite: "arrow",
        });
    }
    if (d.ram && g.input.wasPressed("heavy") && this.ram <= 0) {
      this.ram = 5;
      g.fx.ring(p.x, p.y, 100, "#dfb65c");
      for (const e of g.enemies)
        if (!e.friendly && Math.hypot(e.x - p.x, e.y - p.y) < 115)
          g.damageEnemy(
            e,
            p.attackPower() * (this.vessel?.fittings.includes("ram") ? 9 : 6),
            { knockback: 160, fromX: p.x, fromY: p.y },
          );
    }
    if (this.danger === 4 && this.storm <= 0) {
      this.storm = 4;
      g.telegraph(
        p.x + Math.cos(g.now) * 90,
        p.y + Math.sin(g.now) * 90,
        58,
        1.2,
        "#b0dfff",
      );
      this.strikes.push({
        x: p.x + Math.cos(g.now) * 90,
        y: p.y + Math.sin(g.now) * 90,
        at: g.now + 1.2,
      });
    }
    for (const strike of this.strikes)
      if (strike.at <= g.now) {
        if (Math.hypot(p.x - strike.x, p.y - strike.y) < 74)
          this.damage(
            d.hull *
              0.08 *
              (this.vessel?.fittings.includes("stabilizer") ? 0.65 : 1),
          );
        g.fx.ring(strike.x, strike.y, 58, "#b0dfff");
      }
    this.strikes = this.strikes.filter((strike) => strike.at > g.now);
    if (this.spawn <= 0) {
      this.spawn = Math.max(6, 24 - this.danger * 4);
      this.spawnMonster();
    }
    if (g.input.wasPressed("interact") && this.nearestPort(170)) this.dock();
    const wreck = this.state.wreck;
    if (wreck && Math.hypot(p.x - wreck.x, p.y - wreck.y) < 90) {
      p.gold += wreck.gold;
      delete this.state.wreck;
      g.toast(
        "Wreck recovered",
        "The crew salvaged your voyage gold.",
        "#e7c778",
      );
    }
    g.enemies = g.enemies.filter(
      (e) =>
        !e.spawnId?.startsWith("sea:") ||
        Math.hypot(e.x - p.x, e.y - p.y) < 1200,
    );
  }
  private spawnMonster(): void {
    const g = this.game,
      p = g.player;
    if (
      this.nearestPort(800) ||
      (this.danger === 0 && Math.sin(g.now * 12.3) < 0.75) ||
      g.enemies.filter((e) => e.spawnId?.startsWith("sea:") && !e.dead)
        .length >=
        2 + this.danger
    )
      return;
    const ids = [
      "aegean_serpent",
      "aegean_siren",
      "aegean_ketos",
      "aegean_sea_serpent",
    ];
    const id = ids[Math.max(0, Math.min(ids.length - 1, this.danger - 1))];
    if (!ENEMY_BY_ID[id]) return;
    const a = g.now * 2.39,
      x = p.x + Math.cos(a) * 470,
      y = p.y + Math.sin(a) * 470;
    if (boxHitsTerrain(g.map, x, y, 24, 20, "swimmer")) return;
    const e = new Enemy(id, x, y, 80 + this.danger * 5, {
      region: "aegean_pelagic",
    });
    e.spawnId = `sea:${g.now}`;
    e.movementProfile = id === "aegean_siren" ? "flying" : "swimmer";
    e.def = { ...e.def, sight: 900 };
    e.state = "chase";
    g.enemies.push(e);
    if (
      g.player.flags.has("aegean:crew:lookout") ||
      this.vessel?.fittings.includes("lens")
    )
      g.toast("Something moves beneath the waves", e.def.name, "#66cdd6");
  }
  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.aboard) return;
    const p = this.game.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(this.state.heading);
    const skiff = this.state.selected.includes("skiff"),
      round = this.state.selected.includes("roundship"),
      storm = this.state.selected.includes("stormbreaker");
    ctx.scale(
      skiff ? 0.66 : round ? 0.85 : storm ? 1.18 : 1,
      round ? 1.22 : skiff ? 0.8 : 1,
    );
    if (storm) {
      ctx.strokeStyle = "#91c9e0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 56, 25, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#081a2abb";
    ctx.beginPath();
    ctx.ellipse(0, 7, 51, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = storm ? "#3c3736" : round ? "#8d613c" : "#704731";
    ctx.strokeStyle = "#dbb467";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(49, 0);
    ctx.lineTo(16, -20);
    ctx.lineTo(-35, -16);
    ctx.lineTo(-46, 0);
    ctx.lineTo(-35, 16);
    ctx.lineTo(16, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#d3ad69";
    ctx.lineWidth = 2;
    for (let i = -28; i < 24; i += skiff ? 24 : 10) {
      ctx.beginPath();
      ctx.moveTo(i, -14);
      ctx.lineTo(i + Math.sin(this.game.now * 5) * 5, -32);
      ctx.moveTo(i, 14);
      ctx.lineTo(i + Math.sin(this.game.now * 5) * 5, 32);
      ctx.stroke();
    }
    ctx.strokeStyle = "#452d22";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(0, 24);
    ctx.stroke();
    ctx.fillStyle = storm ? "#a92d39" : round ? "#8bc0be" : "#eee1b8";
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.quadraticCurveTo(32, 0, 0, 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d8b45f";
    ctx.fillRect(7, -6, 5, 12);
    ctx.restore();
  }
}
