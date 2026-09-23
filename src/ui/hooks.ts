import { useEffect, useRef, useState } from 'react';

/** Cheap ticker so a panel can show a live countdown without re-rendering the whole tree every frame. */
export function useTicker(hz = 10): number {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((v) => v + 1), 1000 / hz);
    return () => window.clearInterval(id);
  }, [hz]);
  return 0;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const va = (a as Record<string, unknown>)[k];
    const vb = (b as Record<string, unknown>)[k];
    if (Object.is(va, vb)) continue;
    // one level deeper, for arrays of plain rows
    if (Array.isArray(va) && Array.isArray(vb) && va.length === vb.length && va.every((x, i) => shallowEqual(x, vb[i]))) continue;
    return false;
  }
  return true;
}

/**
 * Read a value off the running game and re-render only when it changes.
 *
 * The simulation is plain objects mutated sixty times a second, so a HUD
 * piece has to poll — but polling is not the same as re-rendering. `read` is
 * called `hz` times a second and its result compared (shallowly) with the
 * last one; the component only renders again when something the player can
 * see is different. Round inside `read` (whole hit points, tenths of a
 * second) and an idle HUD does no React work at all.
 */
export function useGameValue<T>(read: () => T, hz = 15): T {
  const [value, setValue] = useState(read);
  const readRef = useRef(read);
  readRef.current = read;
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = readRef.current();
      setValue((prev) => (shallowEqual(prev, next) ? prev : next));
    }, 1000 / hz);
    return () => window.clearInterval(id);
  }, [hz]);
  return value;
}
