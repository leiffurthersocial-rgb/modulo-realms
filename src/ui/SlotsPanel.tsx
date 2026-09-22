import { useEffect, useRef } from 'react';
import type { Game } from '../game/core/game';
import {
  CAB_H, CAB_W, LEVER_KNOB, drawCabinet, leverKnob, leverValueAt, slotAt,
} from '../game/art/slotCabinet';

/**
 * Standing at the slot machine.
 *
 * There is no panel here in the usual sense: no title bar, no buttons, no
 * pay-table list. The screen is one cabinet, drawn at 1:1 into a canvas and
 * blown up with nearest neighbour like every other sprite in the game, and
 * everything the player can do is done to the machine itself — coins into the
 * slots along the front, hand on the handle.
 *
 * React owns none of the motion. The reels, the handle, the coins and the
 * lights all live on `game.casino.slots` and tick in game time from the main
 * loop; this component is a render target and a pointer surface, and its
 * animation frame only ever reads.
 */
export default function SlotsPanel({ game }: { game: Game }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      const m = game.casino.slots;
      if (m) {
        drawCabinet(ctx, {
          t: m.t,
          pos: m.pos,
          speed: m.speed,
          lever: m.lever,
          leverHot: m.hot || m.held,
          stake: m.stake,
          credit: Math.round(m.credit),
          win: m.win,
          hit: m.hits(),
          celebrate: m.celebrate,
          bell: m.bell,
          anticipation: m.anticipation,
          coins: m.coins,
          tray: m.tray,
          insert: m.insert,
          attract: m.attract,
          message: m.message,
          jackpot: m.jackpot,
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  /** Pointer position in cabinet pixels. */
  const at = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * CAB_W,
      y: ((e.clientY - r.top) / r.height) * CAB_H,
    };
  };

  const onKnob = (x: number, y: number): boolean => {
    const m = game.casino.slots;
    if (!m) return false;
    const k = leverKnob(m.lever);
    return Math.hypot(x - k.x, y - k.y) <= LEVER_KNOB + 6;
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const m = game.casino.slots;
    if (!m) return;
    const { x, y } = at(e);
    const slot = slotAt(x, y);
    if (slot >= 0) {
      m.insertCoin(slot);
      return;
    }
    if (onKnob(x, y)) {
      dragged.current = false;
      m.grab();
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const m = game.casino.slots;
    if (!m) return;
    const { x, y } = at(e);
    if (m.held) {
      const v = leverValueAt(x, y);
      if (v > 0.06) dragged.current = true;
      m.drag(v);
    } else {
      m.hover(onKnob(x, y));
    }
  };

  const up = () => {
    const m = game.casino.slots;
    if (!m || !m.held) return;
    // A click on the knob without a drag is still a pull: not everybody is
    // going to work out that the handle is draggable, and a machine that
    // refuses a click on its own handle is a machine that looks broken.
    if (!dragged.current) m.yank();
    else m.release();
  };

  return (
    <div
      className="slot-room"
      onPointerDown={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}
    >
      <canvas
        ref={canvasRef}
        className="slot-cab"
        width={CAB_W}
        height={CAB_H}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={() => game.casino.slots?.hover(false)}
      />
      <div className="slot-leave">Esc &mdash; step away from the machine</div>
    </div>
  );
}
