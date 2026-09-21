import type { Game } from '../game/core/game';
import { STAKES } from '../game/casino/casino';
import {
  POKER_LABEL, POKER_PAYOUT, RANK_LABEL, SUIT_GLYPH, suitIsRed,
  type Card, type HandRank,
} from '../game/casino/games';

/** The pay table, best first, so the player can read the ladder while playing. */
const LADDER: HandRank[] = [
  'royal', 'straight_flush', 'quads', 'full_house', 'flush',
  'straight', 'trips', 'two_pair', 'jacks',
];

function PlayingCard({ card, held, faceDown, onClick }: {
  card: Card | null;
  held: boolean;
  faceDown: boolean;
  onClick?: () => void;
}) {
  if (faceDown || !card) {
    return <div className="cas-card back" aria-hidden />;
  }
  return (
    <button
      type="button"
      className={`cas-card${held ? ' held' : ''}${onClick ? ' pickable' : ''}`}
      onClick={onClick}
      disabled={!onClick}
      style={{ color: suitIsRed(card.suit) ? '#c2453f' : '#16131f' }}
    >
      <span className="cas-card-rank">{RANK_LABEL[card.rank]}</span>
      <span className="cas-card-suit">{SUIT_GLYPH[card.suit]}</span>
      {held ? <span className="cas-held">HELD</span> : null}
    </button>
  );
}

export default function PokerPanel({ game }: { game: Game }) {
  const p = game.casino.poker;
  if (!p) return null;
  const gold = game.player.gold;
  const dealt = p.hand.length === 5;

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel cas-panel" style={{ width: 'min(760px, 96vw)' }}>
        <div className="panel-title">
          <span>Draw Poker</span>
          <span className="sub">
            Jacks or better pays &middot; the house deals one draw
          </span>
          <button className="close-x" onClick={() => game.closeAll()}>&times;</button>
        </div>

        <div className="cas-body">
          <div className="cas-table">
            <div className="cas-hand">
              {[0, 1, 2, 3, 4].map((i) => (
                <PlayingCard
                  key={i}
                  card={dealt ? p.hand[i] : null}
                  held={p.held[i]}
                  faceDown={!dealt}
                  onClick={p.phase === 'draw' ? () => game.casino.toggleHold(i) : undefined}
                />
              ))}
            </div>

            <div className="cas-status">
              {p.phase === 'ante' ? (
                <span className="cas-hint">Pick a stake and deal.</span>
              ) : p.phase === 'draw' ? (
                <span className="cas-hint">Click the cards you keep, then draw.</span>
              ) : p.result && POKER_PAYOUT[p.result] > 0 ? (
                <span className="cas-win">{POKER_LABEL[p.result]} &mdash; {p.won} gold</span>
              ) : (
                <span className="cas-lose">No pay.</span>
              )}
            </div>

            <div className="cas-controls">
              <div className="cas-stakes">
                {STAKES.map((s) => (
                  <button
                    key={s}
                    className={`btn small${p.stake === s ? ' primary' : ''}`}
                    disabled={p.phase === 'draw' || gold < s}
                    onClick={() => game.casino.setPokerStake(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {p.phase === 'draw' ? (
                <button className="btn primary" onClick={() => game.casino.draw()}>Draw</button>
              ) : p.phase === 'done' ? (
                <button className="btn primary" onClick={() => game.casino.nextHand()}>Next hand</button>
              ) : (
                <button className="btn primary" disabled={gold < p.stake} onClick={() => game.casino.deal()}>
                  Deal ({p.stake})
                </button>
              )}
            </div>
          </div>

          <div className="cas-side">
            <div className="cas-side-head">Pay table</div>
            <div className="cas-ladder">
              {LADDER.map((r) => (
                <div key={r} className={`cas-rung${p.result === r ? ' hit' : ''}`}>
                  <span>{POKER_LABEL[r]}</span>
                  <span className="cas-mult">&times;{POKER_PAYOUT[r]}</span>
                </div>
              ))}
            </div>
            <div className="cas-purse">
              <div><span>Your gold</span><span style={{ color: 'var(--gold)' }}>{gold}</span></div>
              <div>
                <span>This sitting</span>
                <span style={{ color: p.session >= 0 ? 'var(--sp)' : 'var(--danger)' }}>
                  {p.session >= 0 ? '+' : ''}{p.session}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
