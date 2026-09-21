import type { Game } from '../game/core/game';
import { STAKES } from '../game/casino/casino';
import {
  SLOT_COLOR, SLOT_GLYPH, SLOT_REEL, SLOT_TRIPLE, SLOT_TWO_CHERRY,
  type SlotSymbol,
} from '../game/casino/games';

/** Best paying first, which is also rarest first on the reel strip. */
const LADDER: SlotSymbol[] = ['seven', 'crown', 'spade', 'bell', 'cherry'];

function Reel({ symbol, spinning, offset }: { symbol: SlotSymbol | null; spinning: boolean; offset: number }) {
  // While the reels are turning there is no result yet, so the face shown is
  // picked off the strip by the clock — it reads as motion without needing a
  // second animation system.
  const shown = spinning
    ? SLOT_REEL[(Math.floor(performance.now() / 70) + offset) % SLOT_REEL.length]
    : symbol;
  return (
    <div className={`cas-reel${spinning ? ' spinning' : ''}`}>
      <span style={{ color: shown ? SLOT_COLOR[shown] : 'var(--muted)' }}>
        {shown ? SLOT_GLYPH[shown] : '–'}
      </span>
    </div>
  );
}

export default function SlotsPanel({ game }: { game: Game }) {
  const s = game.casino.slots;
  if (!s) return null;
  const gold = game.player.gold;
  const spinning = s.spinning > 0;

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel cas-panel" style={{ width: 'min(680px, 96vw)' }}>
        <div className="panel-title">
          <span>Slot Machine</span>
          <span className="sub">Three of a kind pays &middot; two cherries returns the stake</span>
          <button className="close-x" onClick={() => game.closeAll()}>&times;</button>
        </div>

        <div className="cas-body">
          <div className="cas-table">
            <div className="cas-reels">
              {[0, 1, 2].map((i) => (
                <Reel
                  key={i}
                  symbol={s.result ? s.result.reels[i] : null}
                  spinning={spinning}
                  offset={i * 5}
                />
              ))}
            </div>

            <div className="cas-status">
              {spinning ? (
                <span className="cas-hint">Reels turning&hellip;</span>
              ) : s.result && s.result.payout > 0 ? (
                <span className="cas-win">
                  {s.result.label} &mdash; {s.stake * (s.result.payout + 1)} gold
                </span>
              ) : s.result ? (
                <span className="cas-lose">No pay.</span>
              ) : (
                <span className="cas-hint">Pick a stake and pull.</span>
              )}
            </div>

            <div className="cas-controls">
              <div className="cas-stakes">
                {STAKES.map((v) => (
                  <button
                    key={v}
                    className={`btn small${s.stake === v ? ' primary' : ''}`}
                    disabled={spinning || gold < v}
                    onClick={() => game.casino.setSlotStake(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <button
                className="btn primary"
                disabled={spinning || gold < s.stake}
                onClick={() => game.casino.spin()}
              >
                Pull ({s.stake})
              </button>
            </div>
          </div>

          <div className="cas-side">
            <div className="cas-side-head">Pay table</div>
            <div className="cas-ladder">
              {LADDER.map((sym) => (
                <div
                  key={sym}
                  className={`cas-rung${s.result && s.result.payout > 0 && s.result.reels[0] === sym && s.result.reels[1] === sym ? ' hit' : ''}`}
                >
                  <span style={{ color: SLOT_COLOR[sym], letterSpacing: 2 }}>
                    {SLOT_GLYPH[sym]}{SLOT_GLYPH[sym]}{SLOT_GLYPH[sym]}
                  </span>
                  <span className="cas-mult">&times;{SLOT_TRIPLE[sym]}</span>
                </div>
              ))}
              <div className="cas-rung">
                <span style={{ color: SLOT_COLOR.cherry }}>Two cherries</span>
                <span className="cas-mult">&times;{SLOT_TWO_CHERRY}</span>
              </div>
            </div>
            <div className="cas-purse">
              <div><span>Your gold</span><span style={{ color: 'var(--gold)' }}>{gold}</span></div>
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
