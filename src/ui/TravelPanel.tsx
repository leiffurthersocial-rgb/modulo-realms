import type { Game } from '../game/core/game';
import { REGION_BY_ID, WAYSTONE_SITES } from '../data/locations';
import { useTicker } from './hooks';

/** The waystone network: stone gates keyed to every place you have attuned. */
export default function TravelPanel({ game }: { game: Game }) {
  useTicker(10);
  const p = game.player;
  const known = WAYSTONE_SITES.filter((l) => p.waystones.has(l.id));
  const undiscovered = WAYSTONE_SITES.filter((l) => !p.waystones.has(l.id) && p.discovered.has(l.id));
  const lockout = game.travelLockoutRemaining();

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(620px, 94vw)', maxHeight: 'min(640px, 92vh)' }}>
        <div className="panel-title">
          <span>Waystone</span>
          <span className="sub">
            {known.length} of {WAYSTONE_SITES.length} gates attuned
            {lockout > 0 ? ` · wounded, ${lockout.toFixed(1)}s until the gate will answer` : ''}
          </span>
          <button className="close-x" onClick={() => game.closeAll()}>&times;</button>
        </div>
        <div className="scroll" style={{ padding: 14, overflowY: 'auto' }}>
          {known.map((l) => {
            const here = game.currentWaystone === l.id && game.map.id === 'overworld';
            const region = REGION_BY_ID[l.region];
            return (
              <button
                key={l.id}
                className={`travel-row ${here ? 'here' : ''}`}
                disabled={here || lockout > 0}
                onClick={() => game.travelToWaystone(l.id)}
              >
                <span className="tr-glyph" style={{ borderColor: region.color }} />
                <span className="tr-body">
                  <span className="tr-name">{l.name}</span>
                  <span className="tr-meta">{region.name}{l.level ? ` · level ${l.level}` : ''}</span>
                  <span className="tr-desc">{l.desc}</span>
                </span>
                <span className="tr-go">
                  {here ? 'You are here' : lockout > 0 ? `${lockout.toFixed(1)}s` : 'Travel'}
                </span>
              </button>
            );
          })}

          {undiscovered.length ? (
            <>
              <div className="section-h" style={{ marginTop: 16 }}>Not yet attuned</div>
              {undiscovered.map((l) => (
                <div key={l.id} className="travel-row locked">
                  <span className="tr-glyph" />
                  <span className="tr-body">
                    <span className="tr-name">{l.name}</span>
                    <span className="tr-meta">Touch its waystone to open the gate.</span>
                  </span>
                </div>
              ))}
            </>
          ) : null}

          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 16, lineHeight: 1.7 }}>
            Every settlement and every dungeon mouth has a waystone. Touch one to bind it, and the network will carry
            you back there from any other gate.
          </div>
        </div>
      </div>
    </div>
  );
}
