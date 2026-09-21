import type { Game } from '../game/core/game';
import { STAKES } from '../game/casino/casino';
import { SLOT_TRIPLE, SLOT_TWO_CHERRY, type SlotSymbol } from '../game/casino/games';
import { coinUrl, slotBlurUrl, slotSymbolUrl } from '../game/art/casino';

/**
 * The pay table, derived from the payouts rather than written out by hand.
 *
 * It used to be a hand-kept list, and it had drifted: it was in no particular
 * order and it left out three spades entirely, so a player could hit a x14 and
 * never have been told it existed. Sorting the real table means the panel
 * cannot fall out of step with `games.ts` again.
 */
const LADDER: SlotSymbol[] = (Object.keys(SLOT_TRIPLE) as SlotSymbol[])
  .sort((a, b) => SLOT_TRIPLE[b] - SLOT_TRIPLE[a]);

/** The bulbs chase around the cabinet head; index decides the phase. */
function Bulbs({ count, lit }: { count: number; lit: number }) {
  return (
    <div className="slot-bulbs">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`slot-bulb${(i + lit) % 3 === 0 ? ' on' : ''}`} />
      ))}
    </div>
  );
}

function Reel({ symbol, spinning, hit }: { symbol: SlotSymbol; spinning: boolean; hit: boolean }) {
  return (
    <div className={`slot-reel${spinning ? ' spinning' : ''}${hit ? ' hit' : ''}`}>
      <img
        src={spinning ? slotBlurUrl(symbol) : slotSymbolUrl(symbol)}
        alt=""
        draggable={false}
      />
    </div>
  );
}

export default function SlotsPanel({ game }: { game: Game }) {
  const s = game.casino.slots;
  if (!s) return null;
  const gold = game.player.gold;
  const won = !s.spinning && s.result && s.result.payout > 0 ? s.stake * (s.result.payout + 1) : 0;
  const jackpot = !s.spinning && s.result?.label === 'JACKPOT';
  const celebrating = s.celebrate > 0 && won > 0;
  const lit = Math.floor((s.elapsed + s.celebrate) * 8);
  // Which reels are part of the winning line, so they can be lit on their own.
  const winning = (i: number): boolean => {
    if (s.spinning || won <= 0 || !s.result) return false;
    const r = s.result.reels;
    if (r[0] === r[1] && r[1] === r[2]) return true;
    return r[i] === 'cherry';
  };

  const status = s.spinning ? 'Spinning…'
    : won > 0 ? `You win ${won} gold!`
      : s.result ? 'No win. Try again!'
        : 'Pick a stake and pull.';

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel slot-panel" style={{ width: 'min(580px, 96vw)' }}>
        <div className="panel-title">
          <span className="slot-crown" aria-hidden />
          <span>Slot Machine</span>
          <button className="close-x" onClick={() => game.closeAll()}>&times;</button>
        </div>

        <div className="slot-body">
          {/* the cabinet */}
          <div className={`slot-cabinet${celebrating ? ' celebrating' : ''}`}>
            {/* candle sconces, one bolted to each shoulder of the cabinet */}
            <span className="slot-candle left" aria-hidden><i /></span>
            <span className="slot-candle right" aria-hidden><i /></span>

            <div className="slot-head">
              <Bulbs count={6} lit={lit} />
              <div className={`slot-badge${jackpot && s.celebrate > 0 ? ' jackpot' : ''}`}>
                {jackpot && s.celebrate > 0 ? 'JACKPOT!' : <span className="slot-badge-crown" aria-hidden />}
              </div>
              <Bulbs count={6} lit={lit + 1} />
            </div>

            <div className="slot-stage">
              <span className="slot-arrow left" aria-hidden />
              <div className="slot-window">
                {celebrating ? <div className="slot-rays" aria-hidden /> : null}
                <div className="slot-reels">
                  {[0, 1, 2].map((i) => (
                    <Reel
                      key={i}
                      symbol={s.faces[i]}
                      spinning={s.spinning && s.locked <= i}
                      hit={winning(i)}
                    />
                  ))}
                  <span className="slot-payline" aria-hidden />
                </div>
              </div>
              <span className="slot-arrow right" aria-hidden />
              {/* the handle, pulled on a spin */}
              <div className="slot-lever" style={{ ['--pull' as string]: s.lever.toFixed(2) }}>
                <span className="slot-lever-rod" />
                <span className="slot-lever-knob" />
              </div>
            </div>

            <div className={`slot-status${won > 0 ? ' win' : ''}`}>{status}</div>

            {/* the coin tray, and what has just fallen into it */}
            <div className="slot-tray" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => <span key={i} className="slot-tray-coin" />)}
            </div>

            {celebrating ? (
              <div className="slot-coins" aria-hidden>
                {Array.from({ length: 12 }, (_, i) => (
                  <img key={i} src={coinUrl()} alt="" className={`slot-coin c${i % 10}`} draggable={false} />
                ))}
              </div>
            ) : null}
          </div>

          <div className="slot-controls">
            <div className="cas-stakes">
              {STAKES.map((v) => (
                <button
                  key={v}
                  className={`btn small${s.stake === v ? ' primary' : ''}`}
                  disabled={s.spinning || gold < v}
                  onClick={() => game.casino.setSlotStake(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              className="btn primary slot-spin"
              disabled={s.spinning || gold < s.stake}
              onClick={() => game.casino.spin()}
            >
              {s.spinning ? 'SPIN…' : 'SPIN'}
            </button>
          </div>

          <div className="slot-foot">
            <div className="slot-pay">
              <div className="cas-side-head">Pay table</div>
              {LADDER.map((sym) => (
                <div
                  key={sym}
                  className={`cas-rung${!s.spinning && won > 0 && s.result!.reels.every((r) => r === sym) ? ' hit' : ''}`}
                >
                  <span className="slot-pay-row">
                    <img src={slotSymbolUrl(sym)} alt="" draggable={false} />
                    <img src={slotSymbolUrl(sym)} alt="" draggable={false} />
                    <img src={slotSymbolUrl(sym)} alt="" draggable={false} />
                  </span>
                  <span className="cas-mult">&times;{SLOT_TRIPLE[sym]}</span>
                </div>
              ))}
              <div className={`cas-rung${!s.spinning && s.result?.label === 'Two cherries' ? ' hit' : ''}`}>
                <span className="slot-pay-row">
                  <img src={slotSymbolUrl('cherry')} alt="" draggable={false} />
                  <img src={slotSymbolUrl('cherry')} alt="" draggable={false} />
                  <span className="slot-pay-note">anywhere</span>
                </span>
                <span className="cas-mult">&times;{SLOT_TWO_CHERRY}</span>
              </div>
            </div>

            <div className="slot-purse">
              <div><span>Your gold</span><span style={{ color: 'var(--gold)' }}>{gold}</span></div>
              <div><span>This bet</span><span style={{ color: 'var(--danger)' }}>&minus;{s.stake}</span></div>
              <div>
                <span>This sitting</span>
                <span style={{ color: s.session >= 0 ? 'var(--sp)' : 'var(--danger)' }}>
                  {s.session >= 0 ? '+' : ''}{s.session}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
