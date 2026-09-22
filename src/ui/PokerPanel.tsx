import { useEffect, useRef } from 'react';
import type { Game } from '../game/core/game';
import {
  TABLE_H, TABLE_W, buyInAt, drawTable, onBoard, onHeroCards, onLine, onPlate, rackAt,
  type SeatView, type TableView,
} from '../game/art/pokerFelt';
import { HOLDEM_LABEL, STAKES } from '../game/casino/games';
import type { HoldemTable, Seat } from '../game/casino/holdem';

/**
 * Sitting at the hold'em table.
 *
 * Like the slot machine and the wheel, this is the table rather than a panel
 * about the table: one canvas, drawn at 1:1 and blown up, and the player acts
 * on the furniture — chips off the rack, cards into the muck, the line pushed
 * in. React draws and listens, nothing more; the hand lives in
 * `casino/holdem.ts` and the chips in the air in `casino/pokerShow.ts`.
 */

const seatView = (s: Seat, t: HoldemTable): SeatView => ({
  id: s.id,
  name: s.name,
  chips: s.chips,
  hole: s.hole,
  revealed: s.revealed,
  folded: s.folded,
  allIn: s.allIn,
  committed: s.committed,
  active: t.turn === s.id && !t.handOver,
  winner: t.winners.includes(s.id),
  button: t.dealer === s.id,
  bubble: s.bubble > 0 ? s.lastAction : '',
  shown: s.shown ? HOLDEM_LABEL[s.shown.rank] : null,
});

/** What pushing the line would do, printed on the felt so nobody has to guess. */
function lineLabel(t: HoldemTable | null, pending: number): string {
  if (!t) return '';
  if (t.handOver) return 'PUSH THE LINE FOR THE NEXT HAND';
  if (!t.awaitingHero) return '';
  const owed = Math.max(0, t.toCall - t.hero.committed);
  const want = t.hero.committed + pending;
  if (pending > owed && want >= t.minRaiseTotal) {
    return `${t.toCall > 0 ? 'RAISE TO' : 'BET'} ${Math.min(want, t.allInTotal)}`;
  }
  if (owed > 0) return `CALL ${owed}`;
  return 'CHECK';
}

export default function PokerPanel({ game }: { game: Game }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      const c = game.casino;
      const t = c.table;
      const show = c.pokerShow;
      const view: TableView = {
        t: show.t,
        seated: !!t,
        stake: t?.stake ?? 0,
        gold: game.player.gold,
        seats: t ? t.seats.slice(1).map((s) => seatView(s, t)) : [],
        hero: t ? seatView(t.hero, t) : null,
        board: t?.board ?? [],
        boardShown: t?.boardShown ?? 0,
        pot: t?.pot ?? 0,
        message: t?.message ?? '',
        seatStacks: show.seatStacks,
        potStack: show.potStack,
        heroStack: show.heroStack,
        pending: show.pending,
        pendingAmount: show.pendingAmount,
        flights: show.inAir,
        lineLabel: lineLabel(t, show.pendingAmount),
        owed: t ? Math.max(0, t.toCall - t.hero.committed) : 0,
        // The action is the hero's for as long as the turn is on them, not
        // only in the gaps between queued beats — `awaitingHero` goes false
        // while the table is mid-animation, and a rack that dims and lights
        // three times a second reads as broken.
        heroTurn: !!t && t.turn === 0 && !t.handOver && !t.hero.folded && !t.hero.allIn,
        handOver: !!t?.handOver,
        chip: 0,
        hover: show.hover,
        muck: show.muck,
      };
      drawTable(ctx, view);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  const at = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * TABLE_W,
      y: ((e.clientY - r.top) / r.height) * TABLE_H,
    };
  };

  /** What the pointer is over, as the key the renderer highlights. */
  const hitKey = (x: number, y: number): string | null => {
    const t = game.casino.table;
    if (!t) {
      const buy = buyInAt(x, y);
      return buy >= 0 ? `buy${buy}` : null;
    }
    const rack = rackAt(x, y);
    if (rack >= 0) return `rack${rack}`;
    if (onHeroCards(x, y)) return 'cards';
    if (onLine(x, y) || (t.handOver && onBoard(x, y))) return 'line';
    if (onPlate(x, y)) return 'plate';
    return null;
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const show = game.casino.pokerShow;
    const { x, y } = at(e);
    const key = hitKey(x, y);
    if (show.hover !== key) {
      show.hover = key;
      game.touch();
    }
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = game.casino;
    const { x, y } = at(e);
    const t = c.table;

    if (!t) {
      const buy = buyInAt(x, y);
      if (buy >= 0) c.sitDown(STAKES[buy]);
      return;
    }
    const rack = rackAt(x, y);
    if (rack >= 0) {
      if (e.button === 2 || e.shiftKey) c.pokerShow.takeBack();
      else c.pokerShow.throwChip(rack);
      return;
    }
    if (onHeroCards(x, y)) { c.pokerShow.fold(); return; }
    if (onLine(x, y) || (t.handOver && onBoard(x, y))) {
      if (e.button === 2 || e.shiftKey) c.pokerShow.takeBack();
      else c.pokerShow.pushLine();
      return;
    }
    if (onPlate(x, y)) { c.close(); game.closeAll(); }
  };

  return (
    <div
      className="poker-room"
      onPointerDown={(e) => { if (e.target === e.currentTarget) { game.casino.close(); game.closeAll(); } }}
    >
      <canvas
        ref={canvasRef}
        className="poker-table"
        width={TABLE_W}
        height={TABLE_H}
        onPointerDown={down}
        onPointerMove={move}
        onPointerLeave={() => { game.casino.pokerShow.hover = null; game.touch(); }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="poker-leave">
        Chips off the rack onto the line &middot; push the line to act &middot; throw your cards to fold &middot; Esc to leave
      </div>
    </div>
  );
}
