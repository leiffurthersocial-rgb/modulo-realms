import type { Game } from '../game/core/game';
import { REGION_BY_ID, WAYSTONE_SITES } from '../data/locations';
import { useTicker } from './hooks';
import { Icon, Modal } from './kit';

/** The waystone network: stone gates keyed to every place you have attuned. */
export default function TravelPanel({ game }: { game: Game }) {
  useTicker(10);
  const p = game.player;
  const known = WAYSTONE_SITES.filter((l) => p.waystones.has(l.id));
  const undiscovered = WAYSTONE_SITES.filter((l) => !p.waystones.has(l.id) && p.discovered.has(l.id));
  const lockout = game.travelLockoutRemaining();

  return (
    <Modal title="Waystone" sub={<>{known.length} of {WAYSTONE_SITES.length} gates attuned
            {lockout > 0 ? ` · wounded, ${lockout.toFixed(1)}s until the gate will answer` : ''}</>} size="m" label="Waystone travel" onClose={() => game.closeAll()}>
        <div className="scroll" style={{ padding: 7, overflowY: 'auto' }}>
          {known.map((l) => {
            const destination = game.waystoneDestination(l.id)!;
            const here = game.map.id === destination.mapId &&
              Math.hypot(p.x - destination.x, p.y - destination.y) < 100;
            const reason = game.waystoneAccessReason(l.id);
            const region = REGION_BY_ID[l.region];
            return (
              <button
                key={l.id}
                className={`travel-row ${here ? 'here' : ''}`}
                disabled={here || lockout > 0 || !!reason}
                title={reason ?? undefined}
                onClick={() => game.travelToWaystone(l.id)}
              >
                <Icon name="waystone" scale={2} className="tr-glyph" />
                <span className="tr-body">
                  <span className="tr-name">{l.name}</span>
                  <span className="tr-meta">{region.name}{l.level ? ` · level ${l.level}` : ''}</span>
                  <span className="tr-desc">{l.desc}</span>
                </span>
                <span className="tr-go">
                  {here ? 'You are here' : reason ? 'Unavailable' : lockout > 0 ? `${lockout.toFixed(1)}s` : 'Travel'}
                </span>
              </button>
            );
          })}

          {undiscovered.length ? (
            <>
              <div className="section-h" style={{ marginTop: 8 }}>Not yet attuned</div>
              {undiscovered.map((l) => (
                <div key={l.id} className="travel-row locked">
                  <Icon name="waystone" scale={2} className="tr-glyph" />
                  <span className="tr-body">
                    <span className="tr-name">{l.name}</span>
                    <span className="tr-meta">{game.waystoneAccessReason(l.id) ?? 'Explore the entrance and approach its waystone.'}</span>
                  </span>
                </div>
              ))}
            </>
          ) : null}

          <div style={{ color: 'var(--muted)', marginTop: 8 }}>
            Discover waystones in towns, at dungeon entrances and beside harbours to return to them.
            Sail to each island once, then use its discovered waystones. Asterion has harbour and sanctuary waystones too.
          </div>
        </div>
    </Modal>
  );
}
