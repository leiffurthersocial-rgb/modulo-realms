import { AEGEAN_ADVENTURE_BY_ID, AEGEAN_PORTS } from "../../data/aegean/world";
import type { Game } from "../core/game";
import type { StatKey } from "../items/types";
import {
  boxHitsTerrain,
  buildPropGrid,
  propsInRect,
  type GameMap,
  type PropInstance,
} from "../world/map";
import { TILE } from "../world/tiles";

interface ServicePoint {
  map: string;
  tx: number;
  ty: number;
}
export interface AegeanService extends ServicePoint {
  id: string;
  name: string;
  flag: string;
  kind: "route" | "refuge" | "training";
  description: string;
  to?: ServicePoint;
  cost?: number;
  /** Ferries only retrace voyages the player has personally completed. */
  ports?: readonly [string, string];
  visit?: string;
  island?: boolean;
  bloom?: boolean;
}
const surface = (tx: number, ty: number): ServicePoint => ({
  map: "overworld",
  tx,
  ty,
});
const underworld = (map: string, tx: number, ty: number): ServicePoint => ({
  map: `aegean_${map}`,
  tx,
  ty,
});

function routePair(
  id: string,
  name: string,
  flag: string,
  a: ServicePoint,
  b: ServicePoint,
  description: string,
  extra: Partial<AegeanService> = {},
): AegeanService[] {
  return [
    {
      ...a,
      id: `${id}_out`,
      name,
      flag,
      kind: "route",
      description,
      to: b,
      ...extra,
    },
    {
      ...b,
      id: `${id}_back`,
      name: `${name} — return`,
      flag,
      kind: "route",
      description,
      to: a,
      ...extra,
    },
  ];
}

function ferryPair(
  id: string,
  aId: string,
  bId: string,
  cost: number,
): AegeanService[] {
  const a = AEGEAN_PORTS.find((p) => p.id === aId)!,
    b = AEGEAN_PORTS.find((p) => p.id === bId)!;
  const marker = (p: typeof a) =>
    surface(Math.floor(p.land.x / TILE) - 2, p.ty + 6);
  const routes = routePair(
    id,
    id === "lighthouse" ? "True-Light Coastal Ferry" : "The Quiet-Song Ferry",
    `aegean:route:${id}`,
    marker(a),
    marker(b),
    `Return passage between ${a.name} and ${b.name}. Both harbours must first be reached and docked at by your own ship. Fare: ${cost.toLocaleString()} gold.`,
    { cost, ports: [a.id, b.id] },
  );
  // Passenger arrival is the established safe landing, never open water.
  routes[0].to = surface(
    Math.floor(b.land.x / TILE),
    Math.floor(b.land.y / TILE),
  );
  routes[1].to = surface(
    Math.floor(a.land.x / TILE),
    Math.floor(a.land.y / TILE),
  );
  return routes;
}

const championRoads = [
  ["spear", "broken_oars", "Broken Oars", -4, -4],
  ["shield", "cypress_vale", "Cypress Vale", 0, -4],
  ["hunt", "red_ravine", "Red Ravine", 4, -4],
  ["volley", "necropolis", "The Necropolis", -4, 4],
  ["guard", "barracks", "The Royal Barracks", 0, 4],
  ["storm", "sky_stair", "The Sky Stair", 4, 4],
] as const;

/** Small, explicit whitelist. No service enters an encounter or crosses the Oath Storm. */
export const AEGEAN_SERVICES: AegeanService[] = [
  ...ferryPair("lighthouse", "aegean_aigialos", "aegean_ember_quay", 2500),
  ...ferryPair("theatre", "aegean_kymene", "aegean_drowned_lyre", 4500),
  ...routePair(
    "charon",
    "Charon's Reconciled Passage",
    "aegean:route:charon",
    underworld("acheron", 23, 72),
    underworld("hades", 86, 82),
    "Free return passage between Acheron and the House of Hades after you have walked to the House yourself.",
    { visit: "aegean_hades" },
  ),
  ...routePair(
    "asphodel",
    "The Named Soldier's Road",
    "aegean:shortcut:asphodel",
    underworld("asphodel", 18, 80),
    underworld("persephone", 18, 80),
    "A direct return road between the Asphodel Fields and the garden, unlocked after first reaching the garden.",
    { visit: "aegean_persephone" },
  ),
  ...routePair(
    "satyr",
    "The Honest Festival Trail",
    "aegean:guide:satyr",
    surface(1118, 228),
    surface(1090, 350),
    "The satyrs guide you between their festival grove and Nemean Hearth. This road stays on the mainland.",
  ),
  {
    ...surface(1142, 353),
    id: "olive_refuge",
    name: "The Living Olive Refuge",
    flag: "aegean:refuge:olive",
    kind: "refuge",
    description:
      "Rest, cleanse afflictions, record a checkpoint, and gain +2 stamina regeneration for five minutes.",
  },
  {
    ...underworld("persephone", 30, 78),
    id: "persephone_refuge",
    name: "Persephone's First Bloom",
    flag: "aegean:refuge:persephone",
    kind: "refuge",
    bloom: true,
    description:
      "Rest, cleanse afflictions, record a checkpoint, and gain +3 mana and stamina regeneration for ten minutes.",
  },
  {
    ...surface(1190, 268),
    id: "centaur_training",
    name: "The Centaur's Archery Lesson",
    flag: "aegean:training:archery",
    kind: "training",
    description:
      "Your permanent lesson grants +3 percentage points of critical chance and +16 range while holding a bow, crossbow, or javelin.",
  },
  ...championRoads.flatMap(([champion, road, name, dx, dy]) => {
    const place = AEGEAN_ADVENTURE_BY_ID[`aegean_champion_${champion}`];
    return routePair(
      road,
      `Cleared road: ${name}`,
      `aegean:shortcut:${road}`,
      surface(1748 + dx, 476 + dy),
      surface(place.tx + 5, place.ty + 5),
      `Return between the beach camp and ${name} after defeating its champion. Both ends remain on Asterion.`,
      { island: true },
    );
  }),
];
const BY_ID = new Map(AEGEAN_SERVICES.map((service) => [service.id, service]));
const TRAINING_BUFFS = ["aegean_centaur_crit", "aegean_centaur_range"];

/** Unlock receipts remain in Player.flags; derived training needs no new save field. */
export class AegeanServices {
  private tick = 0;
  constructor(public game: Game) {}
  reset(): void {
    this.tick = 0;
  }

  install(map: GameMap): void {
    // Discovery receipts historically included nested locations visible from
    // the surface. Only an actual setMap call can witness a shortcut's far end.
    if (
      map.id.startsWith("aegean_") &&
      this.game.map === map &&
      this.game.player
    ) {
      this.game.player.flags.add(`aegean:service:visited:${map.id}`);
    }
    let changed = false;
    for (const service of AEGEAN_SERVICES) {
      if (
        service.map !== map.id ||
        map.props.some((p) => p.data?.service === service.id)
      )
        continue;
      const point = this.standingPoint(
        map,
        service.tx * TILE + 16,
        service.ty * TILE + 16,
        true,
      );
      if (!point)
        throw new Error(
          `No safe service position for ${service.id} on ${map.id}`,
        );
      // Turn the existing expedition charter into its promised ferry service.
      const charter =
        service.id === "charon_out"
          ? map.props.find((p) => p.data?.action === "charter")
          : undefined;
      const prop: PropInstance = charter ?? {
        art:
          service.kind === "refuge"
            ? "aegean_fountain"
            : service.kind === "training"
              ? "aegean_standard"
              : service.ports
                ? "aegean_mooring"
                : "aegean_stele",
        ...point,
      };
      if (charter) {
        prop.x = point.x;
        prop.y = point.y;
      }
      prop.interact = "aegean";
      prop.label = service.name;
      prop.nameplate = service.island
        ? service.name.replace("Cleared road: ", "")
        : service.name;
      prop.nameplateColor = service.island ? "#d3a674" : "#9ed6c7";
      prop.data = { action: "service", service: service.id };
      if (!charter) map.props.push(prop);
      changed = true;
    }
    if (changed) buildPropGrid(map);
  }

  interact(prop: PropInstance): boolean {
    if (prop.data?.action !== "service") return false;
    const service = BY_ID.get(String(prop.data.service));
    if (!service) return true;
    const g = this.game,
      p = g.player;
    // A stale UI reference cannot invoke a remote service.
    if (
      g.map.id !== service.map ||
      !g.map.props.includes(prop) ||
      Math.hypot(p.x - prop.x, p.y - prop.y) > 150
    )
      return true;
    if (!p.flags.has(service.flag)) {
      g.toast(
        service.name,
        `Complete its associated story or champion first. ${service.description}`,
        "#d3a674",
      );
      return true;
    }
    if (service.kind === "training") {
      this.applyTraining();
      g.toast("The lesson stays with you", service.description, "#9ed6c7");
      g.touch();
      return true;
    }
    const reason = this.unavailable(service);
    if (reason) {
      g.toast(service.name, reason, "#d3a674");
      return true;
    }
    if (service.kind === "refuge") {
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      p.sp = p.maxSp;
      p.statuses = [];
      g.campaign.setCheckpoint();
      const duration = service.bloom ? 600 : 300,
        amount = service.bloom ? 3 : 2;
      // The two refuges replace the same stamina boon; they never stack.
      this.buff(
        "aegean_refuge_stamina",
        service.name,
        "staminaRegen",
        amount,
        duration,
      );
      if (service.bloom)
        this.buff("aegean_refuge_mana", service.name, "manaRegen", 3, duration);
      g.fx.ring(p.x, p.y, 80, "#9ed6c7");
      g.toast("A living refuge", service.description, "#9ed6c7");
      g.autosave();
      g.touch();
      return true;
    }
    const to = service.to!;
    const destination = g.getMap(to.map);
    const point = this.standingPoint(
      destination,
      to.tx * TILE + 16,
      to.ty * TILE + 16,
    );
    if (
      !point ||
      (service.island &&
        destination.landmasses?.[
          Math.floor(point.y / TILE) * destination.w +
            Math.floor(point.x / TILE)
        ] !== 18)
    ) {
      g.toast(
        service.name,
        "The landing is obstructed. The passage has not been charged.",
        "#d3a674",
      );
      return true;
    }
    g.travel(to.map, point.x, point.y, service.name);
    if (!g.fade.pending) return true;
    p.gold -= service.cost ?? 0;
    if (service.ports) {
      const portId = service.id.endsWith("_out")
        ? service.ports[1]
        : service.ports[0];
      const port = AEGEAN_PORTS.find((port) => port.id === portId)!;
      g.naval.state.lastPort = port.id;
      g.naval.state.shipX = port.launch.x;
      g.naval.state.shipY = port.launch.y;
    }
    g.closeAll();
    g.touch(); // doTravel saves only after the destination is reached.
    return true;
  }

  private unavailable(service: AegeanService): string | null {
    const g = this.game,
      p = g.player;
    if (p.dead || g.fade.pending)
      return "Wait until the current passage has finished.";
    if (g.naval.aboard || g.naval.state.deck)
      return "Return to a harbour and disembark first.";
    if (g.encounters.active)
      return "Finish or leave the current encounter before using this service.";
    const run =
      g.activities.active && g.activities.state.runs[g.activities.active.id];
    if (run?.started)
      return "Finish the current escort or defence before using this service.";
    if (
      g.travelLockoutRemaining() > 0 ||
      g.enemies.some(
        (e) => !e.dead && !e.friendly && Math.hypot(e.x - p.x, e.y - p.y) < 420,
      )
    ) {
      return "Clear nearby threats and recover from combat before using this service.";
    }
    if (
      service.island &&
      (!g.campaign.has("aegean_army") ||
        !p.flags.has("aegean:landed") ||
        g.map.landmasses?.[
          Math.floor(p.y / TILE) * g.map.w + Math.floor(p.x / TILE)
        ] !== 18)
    ) {
      return "These roads open only after defeating the Three Hundred and landing on Asterion by ship.";
    }
    if (
      service.ports &&
      service.ports.some((id) => !g.naval.state.visitedPorts.includes(id))
    ) {
      return "First sail to and dock at both named harbours yourself. The ferry only provides return passage.";
    }
    if (
      service.visit &&
      !p.flags.has(`aegean:service:visited:${service.visit}`)
    ) {
      return "Reach the far end on foot first. This service then becomes a return shortcut.";
    }
    if (service.to) {
      const denied = g.campaign.access(service.to.map);
      if (denied) return denied;
    }
    if (p.gold < (service.cost ?? 0))
      return `This passage costs ${(service.cost ?? 0).toLocaleString()} gold.`;
    return null;
  }

  private buff(
    id: string,
    name: string,
    stat: StatKey,
    amount: number,
    duration: number,
  ): void {
    const g = this.game;
    g.player.buffs = g.player.buffs.filter((buff) => buff.id !== id);
    g.player.buffs.push({
      id,
      name,
      stat,
      amount,
      until: g.now + duration,
      color: "#9ed6c7",
    });
  }

  private applyTraining(): void {
    const p = this.game.player;
    p.buffs = p.buffs.filter((buff) => !TRAINING_BUFFS.includes(buff.id));
    if (
      !p.flags.has("aegean:training:archery") ||
      !["bow", "crossbow", "javelin"].includes(p.weaponKind())
    )
      return;
    this.buff(TRAINING_BUFFS[0], "The Centaur's Lesson", "critChance", 3, 2);
    this.buff(TRAINING_BUFFS[1], "The Centaur's Lesson", "range", 16, 2);
  }

  update(dt: number): void {
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 0.5;
    this.applyTraining();
  }

  /** Local placement considers real terrain and prop boxes without carving a route. */
  private standingPoint(
    map: GameMap,
    x: number,
    y: number,
    marker = false,
  ): { x: number; y: number } | null {
    const near: number[] = [];
    const sourceMass =
      map.landmasses?.[Math.floor(y / TILE) * map.w + Math.floor(x / TILE)];
    // install() adds a bounded batch before rebuilding the grid. Include its
    // newly added service markers when keeping interactions apart.
    const newMarkers = marker ? map.props.filter((p) => p.data?.service) : [];
    const free = (px: number, py: number): boolean => {
      if (boxHitsTerrain(map, px, py, 10, 7)) return false;
      if (
        map.id === "overworld" &&
        (!sourceMass ||
          map.landmasses?.[
            Math.floor(py / TILE) * map.w + Math.floor(px / TILE)
          ] !== sourceMass)
      )
        return false;
      if (newMarkers.some((p) => Math.hypot(p.x - px, p.y - py) < 90))
        return false;
      propsInRect(map, px - 128, py - 160, px + 128, py + 128, near);
      for (const index of near) {
        const p = map.props[index];
        if (marker && p.interact && Math.hypot(p.x - px, p.y - py) < 90)
          return false;
        if (
          p.cw &&
          p.ch &&
          px + 10 > p.x - p.cw / 2 &&
          px - 10 < p.x + p.cw / 2 &&
          py + 7 > p.y - p.ch &&
          py - 7 < p.y
        )
          return false;
      }
      return true;
    };
    if (free(x, y)) return { x, y };
    for (let radius = 1; radius <= 8; radius++)
      for (let n = 0; n < 16; n++) {
        const a = (n * Math.PI) / 8;
        const px =
          Math.floor((x + Math.cos(a) * radius * 24) / TILE) * TILE + 16;
        const py =
          Math.floor((y + Math.sin(a) * radius * 24) / TILE) * TILE + 16;
        if (free(px, py)) return { x: px, y: py };
      }
    return null;
  }
}
