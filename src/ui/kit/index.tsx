import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties } from 'react';
import { uiSprite, uiSpriteUrl, type UiIcon } from '../../game/art/uiArt';
import { uiMetrics } from './install';
import { uiSound } from './sfx';

/**
 * The UI kit's React pieces. Each is a thin wrapper round a class in
 * `styles/global.css`; the look lives there and in the generated frames
 * (`art/uiArt.ts`), the behaviour lives here.
 */

export { uiSound } from './sfx';

/** Current UI zoom and the overlay's size in UI pixels. */
export function useUiMetrics() {
  return useSyncExternalStore(uiMetrics.subscribe, uiMetrics.get);
}

/**
 * CSS size for a canvas of `w` x `h` art pixels, blown up by the largest whole
 * number of device pixels that still fits the given share of the window.
 */
export function useIntegerFit(w: number, h: number, shareW = 0.94, shareH = 0.9): { width: number; height: number } {
  const ui = useUiMetrics();
  const k = Math.max(1, Math.floor(Math.min((ui.w * ui.device * shareW) / w, (ui.h * ui.device * shareH) / h)));
  return { width: (w * k) / ui.device, height: (h * k) / ui.device };
}

/* ------------------------------------------------------------------ */
/* Icon                                                                */
/* ------------------------------------------------------------------ */

/** A generated UI glyph at its native pixel size (or a whole multiple). */
export function Icon({ name, scale = 1, className, title }: { name: UiIcon; scale?: number; className?: string; title?: string }) {
  const src = uiSpriteUrl(name);
  const [w, h] = iconSize(name);
  return (
    <img
      className={`px-icon${className ? ` ${className}` : ''}`}
      src={src}
      width={w * scale}
      height={h * scale}
      alt={title ?? ''}
      title={title}
      draggable={false}
    />
  );
}

function iconSize(name: string): [number, number] {
  const c = uiSprite(name);
  return [c.width, c.height];
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export type ModalSize = 's' | 'm' | 'l' | 'xl';
export type Frame = 'wood' | 'ash' | 'parchment' | 'iron';

/**
 * A framed panel over a dithered scrim. Clicking the scrim closes it.
 *
 * `size` sets the width in UI pixels (s 240, m 360, l 520, xl the whole
 * screen); `tall` lets the body fill the screen's height and scroll inside.
 */
export function Modal({
  title, sub, actions, size = 'l', frame = 'wood', tall, onClose, children, className, style, label,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  size?: ModalSize;
  frame?: Frame;
  tall?: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  useEffect(() => {
    uiSound('open');
    return () => uiSound('close');
  }, []);
  return (
    <div className="modal-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className={`modal panel frame-${frame} size-${size}${tall ? ' tall' : ''}${className ? ` ${className}` : ''}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (typeof title === 'string' ? title : undefined)}
      >
        <div className="panel-title">
          <span className="pt-main">{title}</span>
          {sub ? <span className="sub">{sub}</span> : null}
          <span className="title-actions">
            {actions}
            <CloseX onClick={onClose} />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CloseX({ onClick }: { onClick: () => void }) {
  return (
    <button className="close-x" onClick={onClick} aria-label="Close" title="Close (Esc)">
      <Icon name="close" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

export function Button({
  variant, small, children, onClick, disabled, title, className, style, type,
}: {
  variant?: 'primary' | 'danger' | 'iron';
  small?: boolean;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type ?? 'button'}
      className={`btn${variant ? ` ${variant}` : ''}${small ? ' small' : ''}${className ? ` ${className}` : ''}`}
      disabled={disabled}
      title={title}
      style={style}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Confirm                                                             */
/* ------------------------------------------------------------------ */

/**
 * A two-step button for anything that cannot be undone: the first press arms
 * it and swaps the label for the question, the second press within four
 * seconds does it. No browser `confirm()` popping out of the game.
 */
export function ConfirmButton({
  children, confirm, onConfirm, small, className,
}: { children: ReactNode; confirm: ReactNode; onConfirm: () => void; small?: boolean; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(id);
  }, [armed]);
  return (
    <button
      type="button"
      className={`btn danger${armed ? ' armed' : ''}${small ? ' small' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => {
        if (armed) { uiSound('confirm'); onConfirm(); }
        else setArmed(true);
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirm : children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */

/**
 * A pixel slider: an iron knob in a groove, the filled part glowing ember.
 * Drag, click anywhere on the groove, or use the arrow keys.
 */
export function Slider({
  value, min = 0, max = 1, step = 0.01, onChange, label, width = 120,
}: { value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; label: string; width?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const t = (value - min) / (max - min || 1);
  const knobW = 8;
  const travel = width - knobW;
  const left = Math.round(Math.max(0, Math.min(1, t)) * travel);
  const snap = (v: number) => {
    const s = Math.round((v - min) / step) * step + min;
    return Math.max(min, Math.min(max, Number(s.toFixed(6))));
  };
  const fromPointer = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const frac = (clientX - r.left - (knobW / 2) * (r.width / width)) / (r.width * (travel / width));
    onChange(snap(min + Math.max(0, Math.min(1, frac)) * (max - min)));
  };
  return (
    <div
      ref={ref}
      className="px-slider"
      style={{ width }}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        fromPointer(e.clientX);
      }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX); }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { onChange(snap(value - step)); e.preventDefault(); e.stopPropagation(); }
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { onChange(snap(value + step)); e.preventDefault(); e.stopPropagation(); }
      }}
    >
      <span className="ps-fill" style={{ width: left + knobW / 2 }} />
      <span className="ps-knob" style={{ left }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle                                                              */
/* ------------------------------------------------------------------ */

/** A lever switch for on/off settings. */
export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`px-toggle${checked ? ' on' : ''}`}
      onClick={() => { uiSound('tab'); onChange(!checked); }}
    >
      <span className="pt-knob" />
      <span className="pt-label">{checked ? 'ON' : 'OFF'}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

export function Tabs<T extends string>({
  tabs, value, onChange, className,
}: { tabs: Array<{ id: T; label: ReactNode; badge?: ReactNode }>; value: T; onChange: (id: T) => void; className?: string }) {
  return (
    <div className={`tabs${className ? ` ${className}` : ''}`} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          className={`tab${t.id === value ? ' active' : ''}`}
          onClick={() => { if (t.id !== value) { uiSound('tab'); onChange(t.id); } }}
        >
          {t.label}
          {t.badge ? <span className="tab-badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KeyCap / Badge                                                      */
/* ------------------------------------------------------------------ */

const KEY_NAMES: Record<string, string> = {
  Space: 'SPC', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', Escape: 'ESC', Tab: 'TAB',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'ENTER',
};

/** A key as printed on a key cap: `KeyE` → `E`, `Space` → `SPC`. */
export function keyLabel(code: string): string {
  return KEY_NAMES[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '');
}

export function KeyCap({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={`keycap${className ? ` ${className}` : ''}`}>{children}</kbd>;
}

export function Badge({ children, tone = 'brass', className, title }: { children: ReactNode; tone?: 'brass' | 'ember' | 'iron'; className?: string; title?: string }) {
  return <span className={`badge ${tone}${className ? ` ${className}` : ''}`} title={title}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Segmented bar with a damage ghost                                    */
/* ------------------------------------------------------------------ */

/**
 * A vitals bar in segments. When the value drops, a pale ghost of the old
 * value stays behind for a moment and then drains after it, so a hit reads
 * as a chunk taken out rather than a number that changed.
 *
 * The ghost is pure CSS (a delayed width transition on a second fill), so
 * the bar only re-renders when its value does.
 */
export function SegBar({
  kind, value, max, label, shield, critical, className, title,
}: { kind: string; value: number; max: number; label?: ReactNode; shield?: number; critical?: boolean; className?: string; title?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const shieldPct = shield ? Math.min(100 - pct, (shield / Math.max(1, max)) * 100) : 0;
  const prev = useRef(pct);
  const [healing, setHealing] = useState(false);
  useEffect(() => {
    setHealing(pct > prev.current);
    prev.current = pct;
  }, [pct]);
  return (
    <div className={`segbar ${kind}${critical ? ' critical' : ''}${healing ? ' healing' : ''}${className ? ` ${className}` : ''}`} title={title}>
      <span className="sb-ghost" style={{ width: `${pct}%` }} />
      <span className="sb-fill" style={{ width: `${pct}%` }} />
      {shieldPct > 0 ? <span className="sb-shield" style={{ left: `${pct}%`, width: `${shieldPct}%` }} /> : null}
      {label != null ? <span className="sb-label">{label}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rolling number                                                      */
/* ------------------------------------------------------------------ */

/**
 * A number that counts to its new value instead of jumping — gold ticking up
 * into the purse. Honours reduced motion by jumping straight there.
 */
export function Ticker({ value, format = (n: number) => n.toLocaleString('en-US') }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const [dir, setDir] = useState<'' | 'up' | 'down'>('');
  useEffect(() => {
    if (value === shown) return;
    if (reducedMotion()) { setShown(value); return; }
    from.current = shown;
    setDir(value > shown ? 'up' : 'down');
    const start = performance.now();
    const dur = Math.min(700, 180 + Math.abs(value - shown) * 4);
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setShown(Math.round(from.current + (value - from.current) * (1 - (1 - k) * (1 - k))));
      if (k < 1) raf = requestAnimationFrame(step);
      else setDir('');
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className={`ticker${dir ? ` ${dir}` : ''}`}>{format(shown)}</span>;
}

/** The player's reduced-motion choice: the OS setting, or the in-game one. */
export function reducedMotion(): boolean {
  if (document.documentElement.dataset.motion === 'reduced') return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
