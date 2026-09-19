import { ENEMY_BY_ID } from "../data/enemies";
import { LOCATION_BY_ID } from "../data/locations";
import { AEGEAN_ACTIVITIES, AEGEAN_CHAPTERS } from "../data/aegean/progression";
import { useState } from "react";
import type { Game } from "../game/core/game";
import {
  MASTERIES,
  LABOURS,
  STRATEGIC,
  ISLAND_TRIALS,
} from "../game/aegean/campaign";
import { AEGEAN_ADVENTURES } from "../data/aegean/world";
import {
  AEGEAN_RECIPES,
  AEGEAN_REWARDS,
  AEGEAN_SHIPS,
} from "../data/aegean/content";
import { TEMPLATE_BY_ID } from "../data/items";
import { countItem } from "../game/items/inventory";
import { FITTINGS } from "../game/aegean/naval";
import { RARITY_COLOR } from "../game/items/types";

const title = (id: string): string => {
  const key = id
    .replace(/^feat:(enemy|dungeon):/, "")
    .replace(/^aegean:complete:/, "");
  const named =
    AEGEAN_ADVENTURES.find((a) => a.id === key)?.name ??
    AEGEAN_ACTIVITIES.find((a) => a.id === key)?.name ??
    TEMPLATE_BY_ID[key]?.name ??
    ENEMY_BY_ID[key]?.name ??
    LOCATION_BY_ID[key]?.name;
  if (named) return named;
  const terms: Record<string, string> = {
    "aegean:veteran": "Veteran Writ",
    "aegean:testament": "Old World’s Testament",
    "aegean:landed": "Land on Asterion",
    "aegean:component:ribs": "Bronze Storm Ribs",
    "aegean:component:sail": "Hesperid Star-Sail",
    "aegean:component:keel": "Underworld Keel-Binding",
    "aegean:gear:olympian": "Earn Olympian equipment",
    "aegean:reward:royal": "Claim a royal weapon",
  };
  if (terms[key]) return terms[key];
  const words = key
    .replace(/^aegean[:_]/, "")
    .replaceAll("_", " ")
    .replaceAll(":", ": ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};
export default function AegeanPanel({ game }: { game: Game }) {
  const [tab, setTab] = useState(game.panel === "shipyard" ? "fleet" : "oath");
  const c = game.campaign,
    p = game.player;
  const groups = [
    { name: "The Twelve Labours", ids: LABOURS },
    { name: "Strategic proofs", ids: STRATEGIC },
    { name: "The Three Hundred", ids: ["aegean_army"] },
    { name: "Asterion’s nine proofs", ids: ISLAND_TRIALS },
    { name: "The Last Oath", ids: ["aegean_leonidas"] },
  ];
  return (
    <div
      className="modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) game.closeAll();
      }}
    >
      <section
        className="modal panel aegean-panel"
        role="dialog"
        aria-modal="true"
        aria-label="The Aegean Chronicle"
      >
        <div className="panel-title">
          <span>The Aegean Oath</span>
          <span className="sub">A chronicle of mortal defiance</span>
          <button
            className="close-x"
            aria-label="Close Chronicle"
            onClick={() => game.closeAll()}
          >
            ×
          </button>
        </div>
        <nav className="aegean-tabs" aria-label="Chronicle sections">
          {[
            ["oath", "Chronicle"],
            ["stories", "Stories & Discoveries"],
            ["mastery", "Heroic Mastery"],
            ["forge", "Divine Forge"],
            ["fleet", "Ships & Sea"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "selected" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="aegean-scroll">
          {tab === "oath" ? (
            <>
              <div className="aegean-hero">
                <span>BEYOND THE LAST STORM</span>
                <h2>A world twice as wide. An oath that will not break.</h2>
                <p>
                  Follow the eastern passes into Achaea. Hunt impossible beasts,
                  sail beyond the shelf, descend into the kingdom of the dead,
                  and earn the right to face Leonidas.
                </p>
                <p>
                  <kbd>H</kbd> Chronicle · <kbd>B</kbd> Brace · <kbd>X</kbd>{" "}
                  Choose target · <kbd>E</kbd> Context tool
                </p>
              </div>
              {game.itemMigrationReport.length ? (
                <article className="aegean-card">
                  <h3>Equipment migration record</h3>
                  <p>
                    {game.itemMigrationReport.length} legacy items were brought
                    onto the stable forge curve. Old saves did not retain exact
                    affix rolls; bounded estimates preserve their bonuses.
                  </p>
                  <details>
                    <summary>Review the before and after values</summary>
                    {game.itemMigrationReport.map((r) => (
                      <p key={r.uid}>
                        {p.inventory
                          .concat(
                            p.storage,
                            ...Object.values(p.equipment).filter(
                              (i): i is NonNullable<typeof i> => !!i,
                            ),
                          )
                          .find((i) => i.uid === r.uid)?.name ?? r.uid}
                        <br />
                        Before: {JSON.stringify(r.previousStats)}
                        <br />
                        After: {JSON.stringify(r.currentStats)}
                      </p>
                    ))}
                  </details>
                </article>
              ) : null}
              <article className="aegean-card">
                <h3>
                  Veteran’s Writ{" "}
                  {c.veteranMissing().length ? "— unearned" : "— earned"}
                </h3>
                <p>
                  {c.veteranMissing().length
                    ? c.veteranMissing().map(title).join(" · ")
                    : "The eastern passes recognize your deeds."}
                </p>
              </article>
              <article className="aegean-card">
                <h3>Old World’s Testament</h3>
                <p>
                  {c.testamentMissing().length
                    ? `${c.testamentMissing().length} proofs remain before the army will face you.`
                    : "Every original dungeon, boss, named champion and Tusya’s duel is recorded."}
                </p>
                <details>
                  <summary>View remaining proofs</summary>
                  <p>
                    {c.testamentMissing().map(title).join(" · ") || "Complete"}
                  </p>
                </details>
              </article>
              {c.state.pendingChoices.map((source) => (
                <article className="aegean-card reward" key={source}>
                  <h3>Your earned royal commission</h3>
                  <p>
                    Choose one weapon while on Asterion. A full pack sends it
                    safely to storage.
                  </p>
                  <div className="aegean-grid">
                    {AEGEAN_REWARDS[source]?.choice?.map((id) => (
                      <button
                        key={id}
                        disabled={!c.onIsland()}
                        onClick={() => c.chooseReward(source, id)}
                      >
                        {title(id)}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
              {AEGEAN_CHAPTERS.map((ch) => (
                <article className="aegean-card" key={ch.id}>
                  <h3>{ch.name}</h3>
                  <p>{ch.summary}</p>
                  {ch.steps.map((step) => (
                    <p key={step.id}>
                      {c.requirements(step.requires ?? []).length ? "◇" : "✓"}{" "}
                      {step.label}
                    </p>
                  ))}
                </article>
              ))}
              {groups.map((group) => (
                <article className="aegean-card" key={group.name}>
                  <h3>
                    {group.name}{" "}
                    <small>
                      {group.ids.filter((id) => c.has(id)).length}/
                      {group.ids.length}
                    </small>
                  </h3>
                  <div className="aegean-checks">
                    {group.ids.map((id) => {
                      const a = AEGEAN_ADVENTURES.find((a) => a.id === id);
                      return (
                        <div key={id} className={c.has(id) ? "done" : ""}>
                          <span>{c.has(id) ? "✓" : "◇"}</span>
                          <div>
                            <strong>{title(id)}</strong>
                            {a ? (
                              <p>
                                Level {a.level} · {a.objectives.join(" → ")}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </>
          ) : null}
          {tab === "stories" ? (
            <>
              <p>
                Track a story to mark its central court. At the court, E
                explains its current step. Stations 1–3 provide the tools,
                routes and signal choices.
              </p>
              <div className="aegean-grid">
                {AEGEAN_ACTIVITIES.map((a) => (
                  <article className="aegean-card" key={a.id}>
                    <h3>
                      {c.has(a.id) ? "✓ " : ""}
                      {a.name}
                    </h3>
                    <p>{a.summary}</p>
                    <p>
                      Level {a.level} · {a.map ?? a.region} · ({a.tx}, {a.ty})
                    </p>
                    <p>
                      {game.activities.state.runs[a.id]
                        ? a.steps[game.activities.state.runs[a.id].step]?.label
                        : `${a.steps.length} steps · ${a.reward.gold.toLocaleString()} gold`}
                    </p>
                    <button
                      disabled={
                        c.requirements(a.requires).length > 0 ||
                        (c.has(a.id) && !a.repeatable)
                      }
                      onClick={() => {
                        game.activities.start(a.id);
                        game.closeAll();
                      }}
                    >
                      Track {a.repeatable ? "contract" : "story"}
                    </button>
                  </article>
                ))}
              </div>
            </>
          ) : null}
          {tab === "mastery" ? (
            <>
              <p>
                Choose one discipline at each milestone. Ordinary skill points
                stop at 75; heroic mastery begins at 80.
              </p>
              {[80, 85, 90, 95, 100].map((level) => (
                <article className="aegean-card" key={level}>
                  <h3>Level {level}</h3>
                  <div className="aegean-grid">
                    {MASTERIES.filter((m) => m.level === level).map((m) => {
                      const chosen = p.flags.has(`aegean:mastery:${m.id}`),
                        spent = MASTERIES.some(
                          (other) =>
                            other.level === level &&
                            p.flags.has(`aegean:mastery:${other.id}`),
                        );
                      return (
                        <button
                          key={m.id}
                          disabled={p.level < level || spent}
                          className={chosen ? "selected" : ""}
                          onClick={() => c.selectMastery(m.id)}
                        >
                          <strong>
                            {chosen ? "✓ " : ""}
                            {m.name}
                          </strong>
                          <p>{m.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </>
          ) : null}
          {tab === "forge" ? (
            <>
              <p>
                {p.gold.toLocaleString()} gold · Craft beside an Aegean forge.
                Primordial work requires Asterion. Recipes recognize earlier
                victories automatically.
              </p>
              <div className="aegean-grid">
                {AEGEAN_RECIPES.map((r) => {
                  const missing = c.requirements(r.requires),
                    t = TEMPLATE_BY_ID[r.item];
                  const blocked =
                    missing.length > 0 ||
                    p.gold < r.gold ||
                    r.materials.some(
                      (m) => countItem(p.inventory, m.id) < m.count,
                    ) ||
                    !c.nearService("forge") ||
                    (r.islandOnly && !c.onIsland());
                  return (
                    <article className="aegean-card" key={r.id}>
                      <h3
                        style={{
                          color: t
                            ? RARITY_COLOR[t.rarity ?? "common"]
                            : undefined,
                        }}
                      >
                        {r.name}
                      </h3>
                      <p>{t?.desc}</p>
                      <p>
                        {r.gold.toLocaleString()} gold ·{" "}
                        {r.materials
                          .map(
                            (m) =>
                              `${countItem(p.inventory, m.id)}/${m.count} ${title(m.id)}`,
                          )
                          .join(" · ")}
                      </p>
                      {missing.length ? (
                        <p className="aegean-muted">
                          Requires {missing.map(title).join(", ")}
                        </p>
                      ) : null}
                      {r.islandOnly ? <p>Only on Asterion</p> : null}
                      <button disabled={blocked} onClick={() => c.craft(r.id)}>
                        Forge
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          ) : null}
          {tab === "fleet" ? (
            <>
              <div className="aegean-hero">
                <span>THE SEA REMEMBERS</span>
                <h2>
                  {game.naval.aboard ? game.naval.dangerLabel : "Your fleet"}
                </h2>
                <p>
                  WASD steer · Space volley · G ram · B/F brace · Shift rowing
                  burst · E dock · R fight boarders on deck. Deeper water holds
                  stronger monsters. Only the Stormbreaker can cross the oath
                  storm.
                </p>
              </div>
              <p>
                {game.naval.nearestPort()?.name ??
                  "Visit a harbour to purchase, fit, repair or embark."}{" "}
                · {p.gold.toLocaleString()} gold
              </p>
              <div className="aegean-grid">
                {AEGEAN_SHIPS.map((s) => {
                  const owned = game.naval.state.fleet.find(
                      (v) => v.id === s.id,
                    ),
                    missing = c.requirements(s.requirements);
                  return (
                    <article className="aegean-card" key={s.id}>
                      <h3>
                        {s.name}
                        {game.naval.state.selected === s.id ? " ✓" : ""}
                      </h3>
                      <p>{s.description}</p>
                      <p>
                        Hull {owned ? Math.ceil(owned.hull) : s.hull}/{s.hull} ·
                        Speed {s.speed} · {s.slots.combat + s.slots.utility}{" "}
                        fittings
                      </p>
                      <p>
                        {owned ? "Owned" : `${s.cost.toLocaleString()} gold`}
                      </p>
                      {missing.length ? (
                        <p className="aegean-muted">
                          Requires {missing.map(title).join(", ")}
                        </p>
                      ) : null}
                      <button
                        disabled={
                          !game.naval.nearestPort() ||
                          game.naval.aboard ||
                          (!owned && (p.gold < s.cost || missing.length > 0))
                        }
                        onClick={() => game.naval.buy(s.id)}
                      >
                        {owned ? "Select ship" : "Commission ship"}
                      </button>
                    </article>
                  );
                })}
              </div>
              {game.naval.vessel ? (
                <article className="aegean-card">
                  <h3>{game.naval.definition?.name} fittings</h3>
                  <div className="aegean-grid">
                    {FITTINGS.map((f) => (
                      <button
                        key={f.id}
                        disabled={
                          !game.naval.nearestPort() ||
                          game.naval.aboard ||
                          !c.has(f.requires)
                        }
                        onClick={() => game.naval.fit(f.id)}
                      >
                        <strong>
                          {game.naval.vessel?.fittings.includes(f.id)
                            ? "✓ "
                            : ""}
                          {f.name}
                        </strong>
                        <p>
                          {f.description} · {f.cost.toLocaleString()} gold
                        </p>
                      </button>
                    ))}
                  </div>
                  <div className="aegean-actions">
                    <button
                      disabled={!game.naval.nearestPort() || game.naval.aboard}
                      onClick={() => game.naval.repair()}
                    >
                      Repair hull ({game.naval.repairPrice} gold)
                    </button>
                    <button
                      disabled={!game.naval.nearestPort() || game.naval.aboard}
                      onClick={() => game.naval.embark()}
                    >
                      Embark
                    </button>
                  </div>
                </article>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
