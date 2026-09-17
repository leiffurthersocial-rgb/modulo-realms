import type { Game } from '../game/core/game';
import { ENEMY_BY_ID } from '../data/enemies';
import { REGION_BY_ID } from '../data/locations';
import { getIconUrl } from '../game/art/icons';

/**
 * The crown's other ledger: places Jovan will have reopened, for a price.
 *
 * A boss stays dead and a cleared dungeon stops being a dungeon, which is
 * correct the first time and a dead end the twentieth — the fight worth
 * running again becomes the one thing in the game that cannot be. Rather than
 * respawning everything on a timer, which would make clearing a place mean
 * nothing at all, this asks for a specific one by name.
 */
export default function CrownPanel({ game }: { game: Game }) {
  const p = game.player;
  const rows = game.resettable();

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(880px, 96vw)', height: 'min(640px, 92vh)' }}>
        <div className="panel-title">
          <span>The Crown&apos;s Ledger</span>
          <span className="sub">{p.gold.toLocaleString()} gold</span>
          <button className="close-x" onClick={() => game.closeAll()}>&times;</button>
        </div>

        <div className="inv-col scroll" style={{ overflowY: 'auto', flex: 1, padding: '0 16px 12px' }}>
          <div className="crown-intro">
            &quot;Everything you have put down out there, somebody has to go and look at afterwards. If you want one of
            them standing again, I will send people. They will not enjoy it and neither will you, which I think is
            rather the point.&quot;
          </div>

          {rows.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.8, padding: '14px 2px' }}>
              You have not finished anything yet. Clear a dungeon or put down a boss and the crown will have
              something to offer you here.
            </div>
          ) : null}

          {rows.map(({ loc, cleared, bossDown, cost }) => {
            const d = loc.dungeon!;
            const bossName = d.boss ? ENEMY_BY_ID[d.boss]?.name : undefined;
            const bossCost = Math.round(cost * 0.6);
            const region = REGION_BY_ID[loc.region];
            return (
              <div key={loc.id} className="crown-row">
                <div className="cr-main">
                  <div className="cr-name">
                    {loc.name}
                    <span className="cr-meta"> · level {d.level} · {region?.name}</span>
                  </div>
                  <div className="cr-state">
                    {bossDown && bossName ? <span className="cr-tag down">{bossName} felled</span> : null}
                    {cleared ? <span className="cr-tag clear">Cleared out</span> : null}
                  </div>
                </div>
                <div className="cr-actions">
                  {bossDown && d.boss ? (
                    <button
                      className="btn small"
                      disabled={p.gold < bossCost}
                      title="Puts the boss back, and nothing else. Cheaper, and what you want if you are after one drop."
                      onClick={() => game.respawnBoss(d.boss!)}
                    >
                      <img src={getIconUrl('skull')} alt="" style={{ width: 14, height: 14, imageRendering: 'pixelated', verticalAlign: -2, marginRight: 5 }} />
                      Put it back &middot; {bossCost}g
                    </button>
                  ) : null}
                  <button
                    className="btn small primary"
                    disabled={p.gold < cost}
                    title="Reopens the whole place: the boss, every corridor, and the chests. Loot you already took stays taken."
                    onClick={() => game.resetDungeon(loc.id)}
                  >
                    Reopen it &middot; {cost}g
                  </button>
                </div>
              </div>
            );
          })}

          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 14, lineHeight: 1.8 }}>
            Reopening a place puts its boss back, lets every corridor fill in again and refills its chests. What you
            already carried out stays carried out — this reopens the dungeon, it does not undo the run. Putting a
            single boss back is cheaper and leaves the rest of the place as you left it.
          </div>
        </div>
      </div>
    </div>
  );
}
