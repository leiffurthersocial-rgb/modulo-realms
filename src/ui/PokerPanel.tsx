import { useState } from 'react';
import type { Game } from '../game/core/game';
import { STAKES } from '../game/casino/casino';
import { HOLDEM_LABEL, RANK_LABEL, type Card } from '../game/casino/games';
import type { Seat } from '../game/casino/holdem';
import { cardBackUrl, cardFaceUrl, chipBreakdown, chipUrl } from '../game/art/casino';

function PlayingCard({ card, faceDown, className = '' }: {
  card?: Card; faceDown?: boolean; className?: string;
}) {
  const src = faceDown || !card ? cardBackUrl() : cardFaceUrl(card, RANK_LABEL[card.rank]);
  return <img src={src} alt="" className={`hold-card ${className}`} draggable={false} />;
}

/** A little stack of chips standing for an amount. */
function ChipStack({ amount, className = '' }: { amount: number; className?: string }) {
  if (amount <= 0) return null;
  const tiers = chipBreakdown(amount);
  return (
    <span className={`hold-chips ${className}`}>
      <span className="hold-chip-stack">
        {tiers.map((t, i) => (
          <img key={i} src={chipUrl(t)} alt="" style={{ bottom: i * 3 }} draggable={false} />
        ))}
      </span>
      <span className="hold-chip-n">{amount}</span>
    </span>
  );
}

function SeatView({ seat, active, winner, collecting }: {
  seat: Seat; active: boolean; winner: boolean; collecting: boolean;
}) {
  return (
    <div className={`hold-seat${seat.folded ? ' folded' : ''}${active ? ' active' : ''}${winner ? ' winner' : ''}`}>
      <div className="hold-seat-cards">
        {seat.hole.length === 0
          ? null
          : seat.hole.map((c, i) => (
            <PlayingCard key={i} card={c} faceDown={!seat.revealed} className={seat.folded ? 'mucked' : ''} />
          ))}
      </div>
      <div className="hold-seat-plate">
        <span className="hold-seat-name">{seat.name}</span>
        <span className="hold-seat-chips">{seat.chips}</span>
      </div>
      {seat.shown ? <div className="hold-seat-hand">{HOLDEM_LABEL[seat.shown.rank]}</div> : null}
      {seat.bubble > 0 && seat.lastAction ? (
        <div className="hold-bubble">{seat.lastAction}</div>
      ) : null}
      <ChipStack amount={seat.committed} className={collecting ? 'collecting' : ''} />
    </div>
  );
}

export default function PokerPanel({ game }: { game: Game }) {
  const t = game.casino.table;
  const gold = game.player.gold;
  const [raise, setRaise] = useState(0);

  // Not seated yet: pick a stake and buy in.
  if (!t) {
    return (
      <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
        <div className="modal panel" style={{ width: 'min(520px, 94vw)' }}>
          <div className="panel-title">
            <span>Texas Hold&rsquo;em</span>
            <span className="sub">Dario deals &middot; two to four others at the table</span>
            <button className="close-x" onClick={() => game.closeAll()}>&times;</button>
          </div>
          <div className="hold-buyin">
            <p>Pick your blind. You buy in for twenty big blinds, and cash out whatever is left in front of you.</p>
            <div className="cas-stakes">
              {STAKES.map((v) => (
                <button
                  key={v}
                  className="btn"
                  disabled={gold < v * 2}
                  onClick={() => game.casino.sitDown(v)}
                >
                  {v} / {v * 20}
                </button>
              ))}
            </div>
            <div className="hold-buyin-note">
              <span>Your gold</span><span style={{ color: 'var(--gold)' }}>{gold}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hero = t.hero;
  const owed = Math.max(0, t.toCall - hero.committed);
  const canRaise = hero.chips > owed;
  const minTotal = Math.min(t.minRaiseTotal, t.allInTotal);
  const maxTotal = t.allInTotal;
  const raiseTotal = Math.max(minTotal, Math.min(maxTotal, raise || minTotal));

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel hold-panel" style={{ width: 'min(720px, 97vw)' }}>
        <div className="panel-title">
          <span>Texas Hold&rsquo;em</span>
          <span className="sub">
            blinds {Math.max(1, Math.round(t.stake / 2))}/{t.stake} &middot; {t.seats.length - 1} opponents
          </span>
          <button className="close-x" onClick={() => game.casino.close()}>&times;</button>
        </div>

        <div className="hold-body">
          {/* opponents around the far rail */}
          <div className="hold-opponents">
            {t.seats.slice(1).map((s) => (
              <SeatView
                key={s.id}
                seat={s}
                active={t.turn === s.id}
                winner={t.winners.includes(s.id)}
                collecting={t.collecting}
              />
            ))}
          </div>

          {/* the felt */}
          <div className="hold-felt">
            <div className="hold-pot">
              <ChipStack amount={t.pot} />
              <span className="hold-pot-label">POT</span>
            </div>
            <div className="hold-board">
              {[0, 1, 2, 3, 4].map((i) => (
                i < t.boardShown
                  ? <PlayingCard key={i} card={t.board[i]} className="dealt" />
                  : <div key={i} className="hold-slot" />
              ))}
            </div>
            {t.message ? <div className="hold-message">{t.message}</div> : null}
          </div>

          {/* the hero */}
          <div className="hold-hero">
            <SeatView
              seat={hero}
              active={t.turn === 0}
              winner={t.winners.includes(0)}
              collecting={t.collecting}
            />
          </div>

          {/* actions */}
          <div className="hold-actions">
            {t.handOver ? (
              <>
                <button className="btn primary" onClick={() => game.casino.nextHand()}>Next hand</button>
                <button className="btn" onClick={() => game.casino.close()}>Cash out ({hero.chips})</button>
              </>
            ) : t.awaitingHero ? (
              <>
                <button className="btn danger" onClick={() => game.casino.fold()}>Fold</button>
                <button className="btn primary" onClick={() => game.casino.callOrCheck()}>
                  {owed > 0 ? `Call ${owed}` : 'Check'}
                </button>
                {canRaise ? (
                  <span className="hold-raise">
                    <input
                      type="range"
                      min={minTotal}
                      max={maxTotal}
                      step={Math.max(1, Math.round(t.stake / 2))}
                      value={raiseTotal}
                      onChange={(e) => setRaise(Number(e.target.value))}
                    />
                    <button className="btn" onClick={() => { game.casino.raiseTo(raiseTotal); setRaise(0); }}>
                      {t.toCall > 0 ? 'Raise to' : 'Bet'} {raiseTotal}
                    </button>
                  </span>
                ) : null}
              </>
            ) : (
              <span className="hold-waiting">
                {t.turn > 0 ? `${t.seats[t.turn].name} is thinking…` : '…'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
