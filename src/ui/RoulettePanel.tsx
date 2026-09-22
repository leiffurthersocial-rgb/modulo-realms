import { useEffect, useRef } from 'react';
import type { Game } from '../game/core/game';
import {
  CLEAR_BOX, FELT_H, FELT_W, drawFelt, fieldAt, onWheel, rackAt,
} from '../game/art/rouletteFelt';
import { STAKES } from '../game/casino/games';

/**
 * Standing at the roulette table.
 *
 * The same idea as the slot machine: no dialog, no buttons, no list. The
 * screen is the table — you pick a chip out of the rack, put it on a field,
 * and push the wheel. React draws and listens; everything that moves lives
 * on `game.casino.roulette` and ticks in game time.
 */
export default function RoulettePanel({ game }: { game: Game }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      const t = game.casino.roulette;
      if (t) {
        drawFelt(ctx, {
          t: t.t,
          wheel: t.wheel,
          ball: t.ball,
          ballOut: t.ballOut,
          ballHop: t.ballHop,
          bets: t.bets,
          chip: t.chip,
          hover: t.hover,
          result: t.result,
          history: t.history,
          celebrate: t.celebrate,
          won: t.won,
          gold: game.player.gold,
          staked: t.staked,
          message: t.message,
          phase: t.phase,
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  const at = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * FELT_W,
      y: ((e.clientY - r.top) / r.height) * FELT_H,
    };
  };

  const inClear = (x: number, y: number) =>
    x >= CLEAR_BOX.x && x <= CLEAR_BOX.x + CLEAR_BOX.w && y >= CLEAR_BOX.y && y <= CLEAR_BOX.y + CLEAR_BOX.h;

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const t = game.casino.roulette;
    if (!t) return;
    const { x, y } = at(e);
    const key = inClear(x, y) ? 'clear' : (fieldAt(x, y)?.key ?? null);
    if (t.hover !== key) {
      t.hover = key;
      game.touch();
    }
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const t = game.casino.roulette;
    if (!t) return;
    const { x, y } = at(e);

    // The wheel is the spin button, and once the ball has landed it is also
    // how the cloth gets swept for the next round.
    if (onWheel(x, y)) {
      if (t.done) t.ready();
      else t.spin();
      return;
    }
    const rack = rackAt(x, y);
    if (rack >= 0) {
      t.setChip(STAKES[rack]);
      return;
    }
    if (inClear(x, y)) {
      t.clear();
      return;
    }
    const f = fieldAt(x, y);
    if (!f) return;
    // Left hand puts a chip down, right hand takes one back.
    if (e.button === 2 || e.shiftKey) t.lift(f.key);
    else t.place(f.key);
  };

  return (
    <div
      className="felt-room"
      onPointerDown={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}
    >
      <canvas
        ref={canvasRef}
        className="felt-table"
        width={FELT_W}
        height={FELT_H}
        onPointerDown={down}
        onPointerMove={move}
        onPointerLeave={() => { const t = game.casino.roulette; if (t) { t.hover = null; game.touch(); } }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="felt-leave">
        Click a chip, then a field &middot; right-click to take one back &middot; push the wheel to spin &middot; Esc to leave
      </div>
    </div>
  );
}
