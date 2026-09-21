import type { Game } from '../game/core/game';
import { STAKES } from '../game/casino/casino';
import { SLOT_TRIPLE, SLOT_TWO_CHERRY, type SlotSymbol } from '../game/casino/games';
import { coinUrl, slotBlurUrl, slotSymbolUrl } from '../game/art/casino';

/** Best paying first, which is also rarest first on the reel strip. */
const LADDER: SlotSymbol[] = ['cherry', 'crown', 'seven', 'bell'];

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

function Reel({ symbol, spinning }: { symbol: SlotSymbol; spinning: boolean }) {
  return (
    <div className={`slot-reel${spinning ? ' spinning' : ''}`}>
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
  const lit = Math.floor((s.elapsed + s.celebrate) * 8);

  const status = s.spinning ? 'Spinning…'
    : won > 0 ? `You win ${won} gold!`
      : s.result ? 'No win. Try again!'
        : 'Pick a stake and pull.';

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel slot-panel" style={{ width: 'min(560px, 96vw)' }}>
        <div className="panel-title">
          <span className="slot-crown" aria-hidden />
          <span>Slot Machine</span>
          <button className="close-x" onClick={() => game.closeAll()}>&times;</button>
        </div>

        <div className="slot-body">
          {/* the cabinet */}
          <div className={`slot-cabinet${s.celebrate > 0 ? ' celebrating' : ''}`}>
            <div className="slot-head">
              <Bulbs count={7} lit={lit} />
              <div className={`slot-badge${jackpot && s.celebrate > 0 ? ' jackpot' : ''}`}>
                {jackpot && s.celebrate > 0 ? 'JACKPOT!' : <span className="slot-badge-crown" aria-hidden />}
              </div>
              <Bulbs count={7} lit={lit + 1} />
            </div>

            <div className="slot-window">
              {s.celebrate > 0 && won > 0 ? <div className="slot-rays" aria-hidden /> : null}
              <div className="slot-reels">
                {[0, 1, 2].map((i) => (
                  <Reel key={i} symbol={s.faces[i]} spinning={s.spinning && s.locked <= i} />
                ))}
              </div>
              {/* the lever, pulled on a spin */}
              <div className="slot-lever" style={{ ['--pull' as string]: s.lever.toFixed(2) }}>
                <span className="slot-lever-rod" />
                <span className="slot-lever-knob" />
              </div>
            </div>

            <div className={`slot-status${won > 0 ? ' win' : ''}`}>{status}</div>

            {s.celebrate > 0 && won > 0 ? (
              <div className="slot-coins" aria-hidden>
                {Array.from({ length: 10 }, (_, i) => (
                  <img key={i} src={coinUrl()} alt="" className={`slot-coin c${i}`} draggable={false} />
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
              <div className="cas-rung">
                <span className="slot-pay-row">
                  <img src={slotSymbolUrl('cherry')} alt="" draggable={false} />
                  <span className="slot-pay-note">Two cherries</span>
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
