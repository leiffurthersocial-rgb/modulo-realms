import { OLD_WORLD_TESTAMENT } from "../../data/aegean/progression";
import type { Game } from "../core/game";
import {
  AEGEAN_REWARDS,
  AEGEAN_REPEAT_REWARDS,
  AEGEAN_RECIPES,
} from "../../data/aegean/content";
import { TEMPLATE_BY_ID } from "../../data/items";
import { addItem, countItem, removeByDefId } from "../items/inventory";
import { makeItem } from "../items/loot";
import { MASTERIES } from "./mastery";
export { MASTERIES } from "./mastery";

export const LABOURS = [
  "nemea",
  "hydra",
  "hind",
  "boar",
  "augeas",
  "birds",
  "bull",
  "mares",
  "hippolyta",
  "geryon",
  "hesperides",
  "cerberus",
].map((s) => `aegean_${s}`);
export const STRATEGIC = ["python", "medusa", "minotaur", "titan"].map(
  (s) => `aegean_${s}`,
);
export const ISLAND_TRIALS = [
  "sanctuary_aegis",
  "sanctuary_forge",
  "sanctuary_names",
  "champion_spear",
  "champion_shield",
  "champion_hunt",
  "champion_volley",
  "champion_guard",
  "champion_storm",
].map((s) => `aegean_${s}`);
export const OLD_DUNGEONS = [
  "fortress",
  "crypt",
  "grove",
  "tomb",
  "spire",
  "mine",
  "whisper",
  "deepwood",
  "thorn",
  "drowned",
  "saltworks",
  "caldera",
  "ashfall",
  "frostmarch",
  "glass",
  "riven",
  "barrow",
  "remainder",
  "lastgate",
  "sunkenhall",
  "blackreed",
  "standingrod",
  "glassrun",
  "underfloor",
  "slagworks",
].map((s) => `dungeon_${s}`);
export const OLD_MINIS = [
  "captain",
  "broodmother",
  "frostwarden",
  "wintercaller",
  "glacier_maw",
  "fenmother",
  "stormherald",
  "emberjaw",
].map((s) => `mini_${s}`);
export interface CampaignSnapshot {
  checkpoint?: { map: string; x: number; y: number };
  pendingChoices: string[];
  claimed: string[];
  visits: string[];
  counters: Record<string, number>;
}

/** Persistent campaign receipts live independently of resettable dungeon state. */
export class AegeanCampaign {
  state: CampaignSnapshot = {
    pendingChoices: [],
    claimed: [],
    visits: [],
    counters: {},
  };
  private tick = 0;
  constructor(public game: Game) {}
  reset(): void {
    this.state = { pendingChoices: [], claimed: [], visits: [], counters: {} };
    this.tick = 0;
  }
  snapshot(): CampaignSnapshot {
    return structuredClone(this.state);
  }
  restore(data?: Partial<CampaignSnapshot>): void {
    this.reset();
    if (data) this.state = { ...this.state, ...data };
    this.recordLegacy();
  }
  has(id: string): boolean {
    return this.game.player.flags.has(
      id.startsWith("aegean:") || id.startsWith("feat:")
        ? id
        : `aegean:complete:${id}`,
    );
  }
  recordLegacy(): void {
    const p = this.game.player;
    for (const id of p.bossesKilled) p.flags.add(`feat:enemy:${id}`);
    for (const [id, n] of Object.entries(p.killCounts))
      if (n > 0) p.flags.add(`feat:enemy:${id}`);
    for (const id of p.clearedDungeons) p.flags.add(`feat:dungeon:${id}`);
    for (const [id, st] of this.game.mapStates)
      if (st.cleared && id.startsWith("dungeon_")) {
        p.flags.add(`feat:dungeon:${id}`);
        p.clearedDungeons.add(id);
      }
    if (p.flags.has("beat_tusya")) p.flags.add("feat:duel:tusya");
  }
  veteranMissing(): string[] {
    const p = this.game.player;
    return [
      ...(p.level < 75 ? ["Level 75"] : []),
      ...["boss_emberdeep", "boss_storm_throne", "boss_remainder"].filter(
        (id) => !p.flags.has(`feat:enemy:${id}`),
      ),
    ];
  }
  testamentMissing(): string[] {
    const p = this.game.player;
    // The original sixteen bosses are a frozen manifest, not a growing count.
    const bosses = OLD_WORLD_TESTAMENT.bosses;
    return [
      ...OLD_DUNGEONS.filter((id) => !p.flags.has(`feat:dungeon:${id}`)),
      ...bosses.filter((id) => !p.flags.has(`feat:enemy:${id}`)),
      ...OLD_MINIS.filter((id) => !p.flags.has(`feat:enemy:${id}`)),
      ...(!p.flags.has("feat:duel:tusya") ? ["Tusya’s duel"] : []),
    ];
  }
  requirements(ids: readonly string[]): string[] {
    return ids.filter((id) => !this.has(id));
  }
  access(id: string): string | null {
    if (!id.startsWith("aegean_")) return null;
    const veteran = this.veteranMissing();
    if (veteran.length) return `Veteran Writ required: ${veteran.join(", ")}.`;
    if (id === "aegean_army") {
      const missing = [
        ...this.requirements([...LABOURS, ...STRATEGIC]),
        ...this.testamentMissing(),
      ];
      return missing.length
        ? `The Three Hundred await a proven hero. Still needed: ${missing.join(", ")}.`
        : null;
    }
    if (id === "aegean_leonidas") {
      const missing = this.requirements(["aegean_army", ...ISLAND_TRIALS]);
      return missing.length
        ? `The temple is sealed: ${missing.join(", ")}.`
        : null;
    }
    if (ISLAND_TRIALS.includes(id) && !this.has("aegean:landed"))
      return "Reach Asterion through the storm by ship first.";
    return null;
  }
  grant(
    id: string,
    qty = 1,
    source = "aegean_veteran_trial",
    crafted = false,
  ): void {
    if (!TEMPLATE_BY_ID[id]) return;
    const item = makeItem(id, {
      qty,
      plain: !TEMPLATE_BY_ID[id].slot,
      provenance: {
        source: crafted ? "craft" : "reward",
        id: source,
        region: this.onIsland() ? "aegean_asterion" : undefined,
      },
    });
    if (item.rarity === "olympian")
      this.game.player.flags.add("aegean:gear:olympian");
    // Important rewards never disappear because the forty-slot pack was full.
    if (!addItem(this.game.player.inventory, item))
      this.game.player.storage.push(item);
  }
  complete(id: string, repeat = false): void {
    const already = this.has(id);
    if (already && !repeat) return;
    const g = this.game,
      p = g.player,
      reward = already ? AEGEAN_REPEAT_REWARDS[id] : AEGEAN_REWARDS[id];
    p.flags.add(`aegean:complete:${id}`);
    p.clearedDungeons.add(id);
    g.mapState(id).cleared = true;
    if (reward) {
      p.addXp(reward.xp);
      p.gold += reward.gold;
      for (const item of reward.items ?? []) this.grant(item, 1, id);
      for (const flag of reward.flags ?? []) p.flags.add(flag);
      if (reward.choice?.length) this.state.pendingChoices.push(id);
    }
    if (id === "aegean_hesperides") p.flags.add("aegean:component:sail");
    if (id === "aegean_cerberus") p.flags.add("aegean:component:keel");
    g.toast(
      "A deed written into the Chronicle",
      `${id.replace("aegean_", "").replaceAll("_", " ")} — your first-clear reward is secured.`,
      "#e7c778",
    );
    g.autosave();
    g.touch();
  }
  chooseReward(source: string, item: string): boolean {
    if (!this.onIsland()) return false;
    if (
      !this.state.pendingChoices.includes(source) ||
      !AEGEAN_REWARDS[source]?.choice?.includes(item)
    )
      return false;
    this.grant(item, 1, source);
    this.game.player.flags.add("aegean:reward:royal");
    this.state.pendingChoices = this.state.pendingChoices.filter(
      (s) => s !== source,
    );
    this.game.autosave();
    this.game.touch();
    return true;
  }
  selectMastery(id: string): boolean {
    const m = MASTERIES.find((m) => m.id === id),
      p = this.game.player;
    if (
      !m ||
      p.level < m.level ||
      MASTERIES.some(
        (other) =>
          other.level === m.level && p.flags.has(`aegean:mastery:${other.id}`),
      )
    )
      return false;
    p.flags.add(`aegean:mastery:${id}`);
    this.game.autosave();
    this.game.touch();
    return true;
  }
  craft(id: string): boolean {
    const r = AEGEAN_RECIPES.find((r) => r.id === id),
      p = this.game.player;
    if (!r || this.requirements(r.requires).length || p.gold < r.gold)
      return false;
    if (r.islandOnly && !this.onIsland()) return false;
    if (r.materials.some((m) => countItem(p.inventory, m.id) < m.count))
      return false;
    if (!this.nearService("forge")) return false;
    p.gold -= r.gold;
    for (const m of r.materials) removeByDefId(p.inventory, m.id, m.count);
    this.grant(r.item, 1, r.id, true);
    if (r.flag) p.flags.add(r.flag);
    this.game.toast("Forged", r.name, "#dfb65c");
    this.game.autosave();
    this.game.touch();
    return true;
  }
  onIsland(): boolean {
    const g = this.game,
      p = g.player;
    return (
      g.map.id.startsWith("aegean_sanctuary") ||
      g.map.id.startsWith("aegean_champion") ||
      g.map.id === "aegean_leonidas" ||
      (g.map.id === "overworld" &&
        p.x / 32 >= 1720 &&
        p.y / 32 >= 350 &&
        p.y / 32 <= 598)
    );
  }
  nearService(action: string): boolean {
    const g = this.game,
      p = g.player;
    return g.map.props.some(
      (prop) =>
        prop.interact === "aegean" &&
        prop.data?.action === action &&
        Math.hypot(prop.x - p.x, prop.y - p.y) < 130,
    );
  }
  setCheckpoint(): void {
    const g = this.game;
    this.state.checkpoint = { map: g.map.id, x: g.player.x, y: g.player.y };
  }
  update(dt: number): void {
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 1;
    this.recordLegacy();
    const g = this.game,
      p = g.player;
    if (!this.veteranMissing().length) {
      p.flags.add("aegean:veteran");
      p.flags.add("aegean:complete:aegean_veteran_writ");
    }
    const region = g.regionAtPlayer();
    if (region?.startsWith("aegean_"))
      p.flags.add(`aegean:visit:${region.slice(7)}`);
    for (const id of p.discovered)
      if (id.startsWith("aegean_")) p.flags.add(`aegean:visit:${id.slice(7)}`);
    if (g.map.id.startsWith("aegean_"))
      p.flags.add(`aegean:visit:${g.map.id.slice(7)}`);
    if (g.map.id === "aegean_leonidas") p.flags.add("aegean:visit:temple");
    if (g.map.id === "overworld" && p.x > 960 * 32)
      p.flags.add("aegean:visit:threshold");
    if (g.map.id === "aegean_acheron") p.flags.add("aegean:visit:taenarum");
    if (!this.testamentMissing().length) p.flags.add("aegean:testament");
    if (
      g.map.id === "overworld" &&
      p.x >= 960 * 32 &&
      !p.flags.has("aegean:veteran")
    ) {
      p.x = 959 * 32;
      g.toast(
        "Beyond the Veteran’s Threshold",
        "Reach level 75 and defeat Emberdeep, the Storm Throne and the Remainder.",
        "#e7c778",
      );
    }
  }
}
