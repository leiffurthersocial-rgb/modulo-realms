import ShipComponentChart from './ShipComponentChart';
import { useState } from 'react';
import type { Game } from '../game/core/game';
import { AEGEAN_SHIPS } from '../data/aegean/content';
import { AEGEAN_SHIPBUILDING_SOURCES } from '../data/aegean/shipbuilding';
import { FITTINGS } from '../game/aegean/naval';
import { countItem } from '../game/items/inventory';
import { aegeanName } from './aegeanNames';

/** The harbour counter uses the same list-and-detail layout as the anvil. */
export default function ShipyardPanel({ game }: { game: Game }) {
  const n = game.naval;
  const [selected, setSelected] = useState(n.state.selected || AEGEAN_SHIPS[0].id);
  const ship = AEGEAN_SHIPS.find((s) => s.id === selected) ?? AEGEAN_SHIPS[0];
  const owned = n.state.fleet.find((v) => v.id === ship.id);
  const current = n.state.selected === ship.id;
  const port = n.nearestPort();
  const ready = current && n.mooredPort?.id === port?.id;
  const missing = game.campaign.requirements(ship.requirements);
  const atDock = !!port && !n.aboard;
  const repairPrice = owned ? Math.ceil((ship.hull - owned.hull) * 0.7 * (game.player.flags.has('aegean:crew:shipwright') ? 0.75 : 1)) : 0;
  const selectShip = () => n.buy(ship.id);

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" role="dialog" aria-modal="true" aria-label="Shipwright" style={{ width: 'min(1000px, 96vw)', height: 'min(760px, 94vh)' }}>
        <div className="panel-title">
          <span>Shipwright</span>
          <span className="sub">{port?.name ?? 'Harbour'} · {game.player.gold.toLocaleString()} gold</span>
          <button className="close-x" aria-label="Close shipwright" onClick={() => game.closeAll()}>×</button>
        </div>
        <div className="quest-layout shipyard-layout">
          <div className="scroll" style={{ borderRight: '1px solid var(--edge)', overflowY: 'auto' }}>
            {AEGEAN_SHIPS.map((s) => {
              const vessel = n.state.fleet.find((v) => v.id === s.id);
              return (
                <button
                  key={s.id}
                  className={`quest-item ${s.id === ship.id ? 'active' : ''}`}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--edge)' }}
                  onClick={() => setSelected(s.id)}
                >
                  <div className="qi-name">{s.name}</div>
                  <div className="qi-meta">{vessel ? n.state.selected === s.id && n.mooredPort?.id === port?.id ? 'Moored at this pier' : 'Owned' : `${s.cost.toLocaleString()} gold`}</div>
                </button>
              );
            })}
          </div>
          <div className="inv-col scroll" style={{ overflowY: 'auto', minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--gold)' }}>{ship.name}</div>
            <p className="help-p">{ship.description}</p>
            {!owned && ship.requirements.length ? <ShipComponentChart game={game} requirements={ship.requirements} /> : null}
            <div className="obj-list">
              <div className="obj-item"><span>Hull</span><span>{Math.ceil(owned?.hull ?? ship.hull)} / {ship.hull}</span></div>
              <div className="obj-item"><span>Speed</span><span>{ship.speed}</span></div>
              <div className="obj-item"><span>Fittings</span><span>{ship.slots.combat} combat · {ship.slots.utility} utility</span></div>
              <div className="obj-item"><span>Ram</span><span>{ship.ram ? 'Bronze ram' : 'None'}</span></div>
            </div>
            {ship.requirements.length ? (
              <>
                <details className="ship-route-details"><summary>Route details &amp; forging costs</summary>
                {ship.requirements.map((id) => {
                  const obtained = game.campaign.has(id);
                  const source = AEGEAN_SHIPBUILDING_SOURCES[id];
                  return (
                    <div key={id} style={{ marginBottom: 12 }}>
                      <div className={`obj-item ${obtained ? 'done' : ''}`}>
                        <span>{aegeanName(id)}</span><span>{obtained ? 'Obtained' : 'Missing'}</span>
                      </div>
                      {!obtained ? source?.steps.map((step, i) => (
                        <p className="help-p" key={i} style={{ margin: '5px 0', color: step.proof && game.campaign.has(step.proof) ? 'var(--muted)' : undefined }}>
                          {step.proof && game.campaign.has(step.proof) ? 'Done — ' : ''}{step.text}
                        </p>
                      )) : null}
                      {!obtained && source?.recipe ? (
                        <p className="help-p" style={{ margin: '5px 0' }}>
                          Forging cost: {source.recipe.gold.toLocaleString()} gold and {source.recipe.materials.map((m) => `${m.count} ${aegeanName(m.id)} (${countItem(game.player.inventory, m.id)}/${m.count} held)`).join(', ')}.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
                </details>
              </>
            ) : null}
            {!owned && missing.length ? <div className="ship-blocker">{missing.length} part{missing.length > 1 ? 's' : ''} missing — choose a gold marker above.</div> : null}
            {!owned && game.player.gold < ship.cost ? <div className="ship-blocker">Need {(ship.cost - game.player.gold).toLocaleString()} more gold.</div> : null}
            {owned ? <p className="help-p">{ready ? `Your ${ship.name} is waiting beside the wooden pier.` : 'Bring this ship to the pier to see it beside the landing.'} Choose <b>Board ship</b> to step aboard and start sailing. You can also walk to the end of the pier and press <b>E</b>.</p> : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {!ready || !owned ? (
                <button className="btn primary" disabled={!atDock || (!owned && (missing.length > 0 || game.player.gold < ship.cost))} onClick={selectShip}>
                  {owned ? 'Bring to dock' : `Buy (${ship.cost.toLocaleString()}g)`}
                </button>
              ) : null}
              {owned ? (
                <>
                  <button className="btn" disabled={!atDock || repairPrice <= 0 || game.player.gold < repairPrice} onClick={() => { if (selectShip()) n.repair(); }}>
                    {repairPrice > 0 ? `Repair (${repairPrice.toLocaleString()}g)` : 'Hull sound'}
                  </button>
                  <button className="btn primary" disabled={!atDock || owned.hull <= 0} onClick={() => { if (selectShip()) n.embark(); }}>Board ship</button>
                </>
              ) : null}
            </div>
            {owned ? (
              <>
                <div className="section-h">Fittings</div>
                {FITTINGS.filter((f) => game.campaign.has(f.requires) || owned.fittings.includes(f.id) || owned.cargo.includes(f.id)).map((f) => {
                  const fitted = owned.fittings.includes(f.id);
                  const stored = owned.cargo.includes(f.id);
                  const full = owned.fittings.filter((id) => FITTINGS.find((other) => other.id === id)?.slot === f.slot).length >= ship.slots[f.slot];
                  return (
                    <div className="forge-action" key={f.id} style={{ flexWrap: 'wrap' }}>
                      <div>
                        <div className="fa-title">{f.name}</div>
                        <div className="fa-desc">{f.description} {f.slot === 'combat' ? 'Combat' : 'Utility'} fitting.</div>
                        {!fitted && full ? <div className="fa-desc">No free {f.slot} slot.</div> : null}
                      </div>
                      <button className="btn small" disabled={!atDock || (!fitted && (full || (!stored && game.player.gold < f.cost)))} onClick={() => { if (selectShip()) n.fit(f.id); }}>
                        {fitted ? 'Remove' : stored ? 'Fit' : `Fit (${f.cost.toLocaleString()}g)`}
                      </button>
                    </div>
                  );
                })}
                {!FITTINGS.some((f) => game.campaign.has(f.requires)) ? <p className="help-p">Bring back trophies from Achaea&apos;s beasts and the shipwright can make fittings from them.</p> : null}
              </>
            ) : null}
            <p className="help-p" style={{ marginTop: 16 }}>Steer with WASD / movement stick. Follow the harbour arrow; <b>E / USE</b> lands at the pier.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
