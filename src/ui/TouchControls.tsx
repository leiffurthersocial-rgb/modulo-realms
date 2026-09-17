import { useEffect, useRef, useState } from 'react';
import type { Game } from '../game/core/game';
import type { ActionName } from '../game/core/input';
import { getIconUrl } from '../game/art/icons';

/**
 * On-screen controls for playing with thumbs.
 *
 * Everything here is pointer-event based and tracks its own pointer id, so the
 * stick and a button are genuinely independent: you can be running, holding
 * attack and tapping a potion at the same time, which is the whole reason a
 * virtual pad either works or does not. Nothing here synthesises key events —
 * the buttons write straight into `Input`, so a held button is held for as
 * long as the finger is down even if the finger slides off it.
 */

const STICK_RADIUS = 58;
const DEAD_ZONE = 0.14;

function Stick({ game }: { game: Game }) {
  const ref = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  // If the component goes away mid-drag, the player must not keep walking.
  useEffect(() => () => { game.input.clearVirtual(); }, [game]);

  const set = (clientX: number, clientY: number) => {
    const dx = clientX - origin.current.x;
    const dy = clientY - origin.current.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(1, len / STICK_RADIUS);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;
    setKnob({ x: nx * clamped * STICK_RADIUS, y: ny * clamped * STICK_RADIUS });
    game.input.stick = clamped < DEAD_ZONE ? null : { x: nx * clamped, y: ny * clamped };
  };

  const release = () => {
    pointerId.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    game.input.stick = null;
  };

  return (
    <div
      ref={ref}
      className={`touch-stick ${active ? 'active' : ''}`}
      onPointerDown={(e) => {
        if (pointerId.current !== null) return;
        pointerId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        const r = e.currentTarget.getBoundingClientRect();
        // The stick recentres under the thumb that grabbed it, so you never
        // have to look down to find the middle of it.
        origin.current = { x: e.clientX, y: e.clientY };
        void r;
        setActive(true);
        set(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointerId.current !== e.pointerId) return;
        set(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => { if (pointerId.current === e.pointerId) release(); }}
      onPointerCancel={(e) => { if (pointerId.current === e.pointerId) release(); }}
      onLostPointerCapture={(e) => { if (pointerId.current === e.pointerId) release(); }}
    >
      <span className="touch-stick-ring" />
      <span className="touch-stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

/** One button. Holds its action down for exactly as long as the finger is. */
function Btn({
  game, action, label, icon, className = '', cooldown, disabled, onTap,
}: {
  game: Game;
  action?: ActionName;
  label?: string;
  icon?: string | null;
  className?: string;
  cooldown?: number;
  disabled?: boolean;
  onTap?: () => void;
}) {
  const pointerId = useRef<number | null>(null);
  const [held, setHeld] = useState(false);

  const up = () => {
    pointerId.current = null;
    setHeld(false);
    if (action) game.input.setVirtual(action, false);
  };
  // A button unmounted mid-press must not leave its action stuck on.
  useEffect(() => () => { if (action) game.input.setVirtual(action, false); }, [game, action]);

  return (
    <button
      className={`touch-btn ${className} ${held ? 'held' : ''} ${disabled ? 'off' : ''}`}
      onPointerDown={(e) => {
        if (disabled || pointerId.current !== null) return;
        pointerId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        setHeld(true);
        if (action) game.input.setVirtual(action, true);
        onTap?.();
      }}
      onPointerUp={(e) => { if (pointerId.current === e.pointerId) up(); }}
      onPointerCancel={(e) => { if (pointerId.current === e.pointerId) up(); }}
      onLostPointerCapture={(e) => { if (pointerId.current === e.pointerId) up(); }}
      // The click handler is deliberately absent: everything happens on
      // pointerdown, so there is no tap delay and no double fire.
      onContextMenu={(e) => e.preventDefault()}
    >
      {icon ? <img src={icon} alt="" /> : null}
      {label ? <span className="touch-btn-label">{label}</span> : null}
      {cooldown !== undefined && cooldown > 0
        ? <span className="touch-cd">{cooldown.toFixed(cooldown < 1 ? 1 : 0)}</span>
        : null}
    </button>
  );
}

export default function TouchControls({ game }: { game: Game }) {
  const p = game.player;
  // Cheap ticker: cooldowns on the face of the buttons have to move.
  const [, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((v) => v + 1), 1000 / 12);
    return () => window.clearInterval(id);
  }, []);
  // While a panel is open the controls are hidden, so release everything.
  useEffect(() => {
    if (game.uiOpen) game.input.clearVirtual();
  }, [game, game.uiOpen, game.uiVersion]);

  if (!p || game.screen !== 'playing' || game.uiOpen) return null;

  const abilities = p.classDef.abilities;
  const quick = p.inventory.find((i) => i.type === 'consumable' && (p.quickItem ? i.defId === p.quickItem : true))
    ?? p.inventory.find((i) => i.type === 'consumable');
  const mh = p.equipment.mainHand;

  return (
    <div className="touch-layer">
      <div className="touch-left">
        <Stick game={game} />
      </div>

      <div className="touch-menus">
        <Btn game={game} label="BAG" onTap={() => game.togglePanel('inventory')} className="tiny" />
        <Btn game={game} label="MAP" onTap={() => game.togglePanel('map')} className="tiny" />
        <Btn game={game} label="II" onTap={() => game.togglePanel('pause')} className="tiny" />
      </div>

      <div className="touch-right">
        <div className="touch-row">
          {abilities.map((a, i) => {
            const locked = p.level < a.level;
            const cd = p.cooldowns[a.id] ?? 0;
            return (
              <Btn
                key={a.id}
                game={game}
                className="small"
                icon={getIconUrl(a.icon as 'sword')}
                disabled={locked}
                cooldown={cd}
                label={locked ? `L${a.level}` : undefined}
                onTap={() => !locked && game.useAbility(i)}
              />
            );
          })}
        </div>
        <div className="touch-row">
          {mh?.weaponPower ? (
            <Btn
              game={game}
              className="small relic"
              icon={getIconUrl(mh.icon, { metal: mh.iconMetal, glow: mh.glow })}
              cooldown={p.weaponPowerCooldown}
              onTap={() => game.useWeaponPower()}
            />
          ) : null}
          <Btn
            game={game}
            className="small"
            icon={p.equipment.accessory ? getIconUrl(p.equipment.accessory.icon, { metal: p.equipment.accessory.iconMetal }) : null}
            label={p.equipment.accessory ? undefined : 'ART'}
            disabled={!p.equipment.accessory?.artifact}
            cooldown={p.artifactCooldown}
            onTap={() => game.useArtifact()}
          />
          <Btn
            game={game}
            className="small"
            icon={quick ? getIconUrl(quick.icon, { metal: quick.iconMetal }) : null}
            label={quick ? undefined : 'POT'}
            onTap={() => game.useQuickItem()}
          />
          <Btn
            game={game}
            className="small"
            icon={p.equipment.offHand ? getIconUrl(p.equipment.offHand.icon, { metal: p.equipment.offHand.iconMetal }) : null}
            label={p.equipment.offHand ? undefined : 'OFF'}
            action="offhand"
          />
        </div>
        <div className="touch-row main">
          <Btn game={game} className="wide" label="USE" action="interact" />
          <Btn game={game} className="med" label="ROLL" action="dash" />
          <Btn game={game} className="med" label="HEAVY" action="heavy" />
          <Btn game={game} className="big" label="ATTACK" action="attack" />
        </div>
      </div>
    </div>
  );
}
