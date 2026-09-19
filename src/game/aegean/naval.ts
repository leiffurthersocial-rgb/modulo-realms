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
  /** The selected hull's berth, separate from the crew's last safe harbour. */
  mooredAt?: string;
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
  private landedAt = -Infinity;
  /** Four small hull sprites and one oar, generated once; no gameplay state. */
  private hullArt = new Map<string, HTMLCanvasElement>();
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
    this.landedAt = -Infinity;
  }
  snapshot(): NavalSave {
    const saved = structuredClone(this.state);
    const port = this.mooredPort;
    if (port && !saved.mooredAt) {
      const berth = this.mooringPoint(port);
      saved.mooredAt = port.id;
      saved.lastPort = port.id;
      saved.shipX = berth.x;
      saved.shipY = berth.y;
    }
    return saved;
  }
  restore(data?: Partial<NavalSave>): void {
    this.reset();
    if (data) this.state = { ...this.state, ...data };
    if (!this.vessel) this.state.aboard = false;
  }
  /** Old saves did not record purchases' berths. Recover at the player's
   * current harbour when possible; the first voyage then persists the berth. */
  get mooredPort(): AegeanPort | undefined {
    if (this.aboard || this.state.deck || !this.vessel) return;
    return AEGEAN_PORTS.find((pt) => pt.id === this.state.mooredAt) ??
      (!this.state.mooredAt ? this.nearestPort(400) : undefined) ??
      AEGEAN_PORTS.find((pt) => pt.id === this.state.lastPort);
  }
  boardingPoint(pt: AegeanPort): { x: number; y: number } {
    const direction = pt.launch.x < pt.tx * 32 ? -1 : 1;
    return { x: (pt.tx + direction * 4) * 32 + 16, y: pt.ty * 32 + 16 };
  }
  /** The old launch is a safe offshore waypoint, far outside the counter's
   * camera. Berth beside the actual pier instead, without moving the pier. */
  mooringPoint(pt: AegeanPort): { x: number; y: number } {
    const map = this.game.map;
    if (map.id !== 'overworld') return pt.launch;
    const direction = pt.launch.x < pt.tx * 32 ? -1 : 1;
    for (let offset = 6; offset <= Math.abs(pt.launch.x / 32 - pt.tx); offset++) {
      const point = { x: (pt.tx + direction * offset) * 32 + 16, y: pt.launch.y };
      if (!boxHitsTerrain(map, point.x, point.y, 16, 12, 'ship')) return point;
    }
    return pt.launch;
  }
  boardingPort(range = 80): AegeanPort | undefined {
    if (this.game.map.id !== 'overworld' || this.game.now - this.landedAt < .3 ||
      !this.vessel || this.vessel.hull <= 0) return;
    const pt = this.mooredPort;
    if (!pt || (pt.gate === 'army' && !this.game.campaign.has('aegean_army'))) return;
    const point = this.boardingPoint(pt), p = this.game.player;
    return Math.hypot(point.x - p.x, point.y - p.y) < range ? pt : undefined;
  }
  /** Called after a purchase, landing or a ferry carrying the player's hull. */
  moorAt(pt: AegeanPort): void {
    const point = this.mooringPoint(pt);
    this.state.lastPort = pt.id;
    this.state.mooredAt = pt.id;
    this.state.shipX = point.x;
    this.state.shipY = point.y;
    this.state.heading = pt.launch.x < pt.tx * 32 ? Math.PI : 0;
    this.speed = 0;
  }
  get drawPosition(): { x: number; y: number } | undefined {
    if (this.game.map.id !== 'overworld' || !this.vessel) return;
    if (this.aboard) return this.game.player;
    const pt = this.mooredPort;
    return pt ? this.mooringPoint(pt) : undefined;
  }
  nearestPort(range = 130): AegeanPort | undefined {
    const g = this.game,
      p = g.player;
    if (g.map.id !== "overworld") return;
    return AEGEAN_PORTS.find((pt) => {
      const point = this.aboard ? this.mooringPoint(pt) : pt.land;
      return Math.hypot(point.x - p.x, point.y - p.y) < range ||
        (this.aboard && Math.hypot(pt.launch.x - p.x, pt.launch.y - p.y) < range);
    });
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
    const pt = this.nearestPort();
    if (!d || !pt || this.aboard) return false;
    if (this.state.fleet.some((s) => s.id === id)) {
      this.state.selected = id;
      this.moorAt(pt);
      g.autosave();
      g.touch();
      return true;
    }
    if (p.gold < d.cost || g.campaign.requirements(d.requirements).length)
      return false;
    p.gold -= d.cost;
    p.flags.add(`aegean:ship:${id.slice(7)}`);
    this.state.fleet.push({ id, hull: d.hull, fittings: [], cargo: [] });
    this.state.selected = id;
    this.moorAt(pt);
    g.toast(`${d.name} is moored at the pier`, 'Choose Board ship, or walk to the end of the wooden pier and press E.', "#66cdd6");
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
      pt = this.boardingPort() ?? this.nearestPort();
    if (!pt || !this.vessel || this.vessel.hull <= 0 || this.aboard)
      return false;
    if (pt.gate === "army" && !g.campaign.has("aegean_army")) return false;
    const berth = this.mooringPoint(pt);
    if (boxHitsTerrain(g.map, berth.x, berth.y, 16, 12, "ship")) {
      g.toast("Launch obstructed", "Use another harbour.", "#d9553f");
      return false;
    }
    this.moorAt(pt);
    this.state.aboard = true;
    g.player.x = berth.x;
    g.player.y = berth.y;
    g.player.vx = g.player.vy = 0;
    g.player.invuln = 2;
    g.playSound('ship_dock', 0.6);
    g.closeAll();
    g.toast('At the helm', 'Steer with WASD or arrows. E near a harbour brings you ashore.', '#66cdd6');
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
    this.moorAt(pt);
    this.landedAt = g.now;
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
    g.playSound('ship_dock', 0.7);
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
    this.moorAt(pt);
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
    g.recoverSavedPosition(deck.x, deck.y);
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
    if (row && moving && g.input.wasPressed('dash')) g.playSound('ship_oar', 0.7);
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
      g.playSound('shoot', 0.55);
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
      g.playSound('ship_ram', 0.65);
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
        g.playSound('storm_thunder', 0.65);
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
    const p = this.drawPosition;
    if (!p) return;
    const skiff = this.state.selected.includes("skiff"),
      round = this.state.selected.includes("roundship"),
      storm = this.state.selected.includes("stormbreaker");
    const kind = skiff ? 'skiff' : round ? 'roundship' : storm ? 'stormbreaker' : 'trireme';
    const half = skiff ? 16 : round ? 24 : storm ? 22 : 19;
    let sprite = this.hullArt.get(kind);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = 144;
      sprite.height = 112;
      const g = sprite.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      const ink = '#172127',
        wood = storm ? '#625345' : round ? '#a27147' : skiff ? '#a98653' : '#805738',
        plank = storm ? '#796450' : round ? '#b88655' : skiff ? '#c09c65' : '#a17649',
        seam = storm ? '#403d36' : '#533f2e',
        trim = storm ? '#b5b9a3' : '#c49d55',
        bright = storm ? '#dae1cc' : '#e4c481';
      const rect = (x:number,y:number,w:number,h:number,color:string) => {
        g.fillStyle = color;
        g.fillRect(72 + Math.round(x),56 + Math.round(y),w,h);
      };
      const line = (ax:number,ay:number,bx:number,by:number,color:string) => {
        let x=Math.round(ax),y=Math.round(ay);
        const x1=Math.round(bx),y1=Math.round(by),dx=Math.abs(x1-x),sx=x<x1?1:-1,dy=-Math.abs(y1-y),sy=y<y1?1:-1;
        let error=dx+dy;
        for (;;) {
          rect(x,y,1,1,color);
          if(x===x1&&y===y1)break;
          const twice=2*error;
          if(twice>=dy){error+=dy;x+=sx;}
          if(twice<=dx){error+=dx;y+=sy;}
        }
      };
      // Different waterlines give the round merchant its cargo belly and the
      // fighting ships their long, low bows. Every contour is stepped pixels.
      const span = (y:number): [number,number] => {
        const t=Math.min(1,Math.abs(y)/half);
        return round ? [-43+Math.round(t*t*24),42-Math.round(t*t*27)]
          : skiff ? [-44+Math.round(t*t*12),45-Math.round(t*30)]
          : storm ? [-48+Math.round(t*t*13),53-Math.round(t*28)]
          : [-49+Math.round(t*t*14),52-Math.round(t*31)];
      };
      for(let y=-half;y<=half;y+=2) {
        const [left,right]=span(y);
        rect(left-3,y+6,right-left+8,2,'#0a202c8c');
      }
      for(let y=-half;y<=half;y++) {
        const [left,right]=span(y);
        rect(left,y,right-left+1,1,ink);
        if(Math.abs(y)<half-1) {
          rect(left+2,y,right-left-3,1,Math.floor((y+half)/4)%2 ? wood : plank);
          rect(left+1,y,1,1,y<0 ? trim : seam);
          rect(right-1,y,1,1,y<0 ? bright : trim);
          if((y+half)%4===0) rect(left+3,y,right-left-6,1,seam);
          if((y+half)%4===2) {
            for(let x=left+8;x<right-4;x+=15) {
              const offset=(Math.floor((y+half)/4)%3)*3;
              rect(x+offset,y,3,1,wood);
              if(x+offset+5<right-3)rect(x+offset+5,y-1,1,2,seam);
            }
          }
        }
      }
      // Exposed ribs, bench ends, iron pegs and a darker keel below the deck.
      for(const x of [-34,-22,-10,2,14,26]) {
        if(skiff&&x!==-22&&x!==14)continue;
        const ribHalf=half-(x>14?7:5);
        rect(x-1,-ribHalf,4,ribHalf*2+1,seam);
        rect(x,-ribHalf,2,ribHalf*2,wood);
        rect(x,-ribHalf,2,2,bright);
        rect(x,ribHalf-2,2,2,ink);
      }
      rect(-37,-1,73,3,seam);
      rect(-36,-1,70,1,plank);
      for(const sign of [-1,1]) {
        for(let x=-31;x<23;x+=9) {
          rect(x,sign*(half-5),4,3,ink);
          rect(x+1,sign*(half-5),2,1,trim);
        }
      }
      // Curled sternpost, steering sweep and a bronze prow rather than a
      // generic outline. The ram is visible only on ships that carry one.
      line(-41,-10,-47,-25,ink);line(-42,-10,-48,-25,trim);
      line(-48,-25,-44,-29,trim);rect(-45,-30,4,2,bright);
      line(-42,10,-57,24,ink);line(-42,11,-56,25,wood);
      rect(-59,22,5,8,seam);rect(-58,23,2,6,plank);
      if(!skiff&&!round) {
        rect(43,-4,14,8,ink);rect(44,-3,13,6,trim);
        rect(51,-2,11,4,bright);rect(58,-1,7,2,trim);
        rect(46,2,9,1,seam);
      } else {
        line(35,-7,46,0,trim);line(35,7,46,0,trim);
        rect(43,-1,4,2,bright);
      }
      // Painted watching eyes on the bow, an old shipwright's superstition.
      for(const y of [-8,7]) {
        rect(27,y,8,3,ink);rect(28,y,6,2,'#ded0a1');rect(30,y,2,2,ink);
      }
      const barrel = (x:number,y:number) => {
        rect(x+1,y,9,10,ink);rect(x,y+2,11,6,ink);
        rect(x+2,y+1,7,8,'#88623f');rect(x+3,y+1,2,8,'#af8754');
        rect(x+1,y+2,9,1,'#393f3c');rect(x+1,y+7,9,1,'#393f3c');
        rect(x+4,y+1,3,1,'#cfaa6d');
      };
      const coil = (x:number,y:number) => {
        rect(x+1,y,9,1,'#d3bc82');rect(x,y+1,1,6,'#ac925e');
        rect(x+10,y+1,1,6,'#ac925e');rect(x+1,y+7,9,1,'#ac925e');
        rect(x+3,y+2,5,1,'#d3bc82');rect(x+2,y+3,1,3,'#ac925e');
        rect(x+8,y+3,1,3,'#ac925e');rect(x+3,y+5,5,1,'#d3bc82');
        line(x+8,y+6,x+15,y+10,'#b69d66');
      };
      if(round) {
        barrel(-33,-13);barrel(-22,5);coil(-34,8);
        rect(-17,-14,11,9,ink);rect(-16,-13,9,7,'#b89864');
        rect(-16,-10,9,1,'#725938');line(-15,-13,-8,-7,'#ddc795');
      } else if(skiff) {
        coil(-33,3);rect(-31,-10,12,6,seam);rect(-30,-9,10,3,'#c0a477');
      } else {
        // Bronze-rimmed shields line the fighting decks. Stormbreaker has
        // dark hull bands and pale star-metal bosses, not a glowing ellipse.
        for(const sign of [-1,1]) for(const x of [-31,-20,-9,2,13]) {
          const y=sign*(half-3)-3;
          rect(x+1,y,5,7,ink);rect(x,y+1,7,5,trim);
          rect(x+1,y+1,5,5,storm?'#374c57':'#853a32');
          rect(x+3,y+2,1,3,bright);rect(x+2,y+3,3,1,bright);
        }
        coil(-33,3);
        if(storm) {
          rect(-33,-12,13,7,ink);rect(-32,-11,11,5,'#71838a');
          rect(-29,-10,5,3,'#b6d5dc');rect(-27,-11,1,5,'#e0e6d3');
        }
      }
      // Rigging goes under the sail; seams and reef ties remain readable at
      // the game's normal zoom. The deck is not hidden by a flat triangle.
      line(-37,-half+5,0,-27,'#514d3c');line(-36,-half+5,1,-27,'#c5b386');
      line(-36,half-5,0,27,'#c5b386');line(33,0,0,-27,'#8c805f');
      rect(-2,-29,5,59,ink);rect(-1,-28,2,57,'#ae8958');rect(1,-27,1,55,'#745037');
      const sailHeight=skiff?21:round?27:25;
      const sailWidth=(y:number)=>Math.round(5+Math.sin((y+sailHeight)/(sailHeight*2)*Math.PI)*(round?25:skiff?18:24));
      const cloth=storm?'#9d3f43':round?'#92b4a5':'#ddd2aa';
      const shade=storm?'#702f39':round?'#627f79':'#afa17e';
      const light=storm?'#bd6860':round?'#b8cbbb':'#eee5c5';
      for(let y=-sailHeight;y<=sailHeight;y++) {
        const w=sailWidth(y);
        rect(3,y,w,1,shade);rect(4,y,Math.max(1,w-3),1,cloth);
        if(w>12)rect(6,y,Math.floor(w/3),1,light);
        rect(w+1,y,1,1,shade);
      }
      for(let y=-sailHeight+5;y<sailHeight;y+=9) {
        const width=sailWidth(y);
        rect(4,y,width-3,1,shade);
        for(let x=5;x<width;x+=4)rect(x,y+1,2,1,light);
      }
      for(let y=-sailHeight+2;y<sailHeight;y+=4) {
        rect(2,y,3,1,'#c0a16e');
        if(sailWidth(y)>20)rect(20,y,1,2,shade);
      }
      line(0,-sailHeight-2,9,-sailHeight-2,wood);
      line(0,sailHeight+2,9,sailHeight+2,wood);
      if(storm) {
        line(14,-9,21,0,'#ece0ac');line(21,0,14,9,'#ece0ac');
        line(14,9,7,0,'#ece0ac');line(7,0,14,-9,'#ece0ac');
        rect(13,-6,2,13,'#d7c790');rect(10,-1,8,2,'#d7c790');
      } else if(!skiff&&!round) {
        line(12,-8,6,7,'#974a3b');line(13,-8,7,7,'#974a3b');
        line(13,-8,20,7,'#974a3b');line(14,-8,21,7,'#974a3b');
      } else if(round) {
        rect(13,-6,4,2,'#d4d6ac');rect(12,-4,6,8,'#d4d6ac');rect(13,4,4,2,'#d4d6ac');
        rect(11,-2,1,4,'#d4d6ac');rect(18,-2,1,4,'#d4d6ac');
      }
      this.hullArt.set(kind,sprite);
    }
    let oar = this.hullArt.get('oar');
    if(!oar) {
      oar=document.createElement('canvas');oar.width=35;oar.height=9;
      const g=oar.getContext('2d')!;
      g.fillStyle='#24302e';g.fillRect(0,3,30,3);g.fillRect(25,1,9,7);
      g.fillStyle='#a8824e';g.fillRect(0,3,29,1);g.fillRect(26,2,7,5);
      g.fillStyle='#d3b477';g.fillRect(1,3,27,1);g.fillRect(27,2,6,1);
      g.fillStyle='#65523c';g.fillRect(28,5,5,1);this.hullArt.set('oar',oar);
    }
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.translate(Math.round(p.x), Math.round(p.y));
    const port = this.mooredPort;
    const heading = port ? (port.launch.x < port.tx * 32 ? Math.PI : 0) : this.state.heading;
    ctx.rotate(heading);
    ctx.scale(
      skiff ? 0.66 : round ? 0.85 : storm ? 1.18 : 1,
      round ? 1.22 : skiff ? 0.8 : 1,
    );
    const motion=this.aboard ? Math.min(1,Math.abs(this.speed)/(this.definition?.speed??220)) : 0;
    // Low, broken foam follows the stern, leaving the monster silhouettes
    // readable beneath the surface. A moored hull does not row by itself.
    if(motion>.03) {
      ctx.globalAlpha=.16+motion*.25;ctx.fillStyle='#c8e0d5';
      const travel=Math.floor(this.game.now*12)%8;
      for(let i=0;i<5;i++) {
        const x=-50-i*8-travel;
        const spread=11+i*3;
        ctx.fillRect(x,-spread,7-i,1);ctx.fillRect(x-3,spread,6-i,1);
        if(i<3)ctx.fillRect(x-4,-2+(i%2)*5,5,1);
      }
      ctx.globalAlpha=1;
    }
    const rowCount=skiff?2:round?3:storm?8:7;
    const stroke=Math.sin(this.game.now*(this.game.input.isDown('dash')?6:3.7))*.26*motion;
    for(let i=0;i<rowCount;i++)for(const side of [-1,1]) {
      const x=-30+i*(skiff?36:round?22:9);
      ctx.save();ctx.translate(x,side*(half-5));
      ctx.rotate(side*(Math.PI/2+.26)+stroke);
      ctx.drawImage(oar,0,-4);ctx.restore();
    }
    ctx.drawImage(sprite,-72,-56);
    const hull=(this.vessel?.hull??1)/(this.definition?.hull??1);
    if(hull<.65) {
      ctx.fillStyle='#2e322d';ctx.fillRect(-31,-8,9,2);ctx.fillRect(-26,-6,7,1);ctx.fillRect(-23,-5,2,3);
      ctx.fillStyle='#c6a66e';ctx.fillRect(-31,-9,5,1);ctx.fillRect(-19,-5,2,2);
    }
    if(hull<.3) {
      ctx.fillStyle='#152a31';ctx.fillRect(-33,half-5,13,3);ctx.fillRect(-29,half-7,5,3);
      ctx.fillStyle='#43565b';ctx.fillRect(-32,half-4,8,1);
      ctx.fillStyle='#795346';ctx.fillRect(22,12,5,2);ctx.fillRect(21,14,3,2);
      ctx.fillStyle='#b49a76';ctx.fillRect(20,12,2,1);
    }
    ctx.restore();
  }
}
