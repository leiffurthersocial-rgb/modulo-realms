/**
 * World camera zoom levels, always whole numbers so every world pixel is the
 * same number of screen pixels (a fractional zoom makes some pixels one
 * screen pixel wider than their neighbours, and scrolling shimmers).
 *
 * The base zoom keeps roughly the same ~640x360 slice of the world in view at
 * every resolution: 2 at 720p, 3 at 1080p, 4 at 1440p.
 */
export function worldZoom(canvasW: number, canvasH: number): number {
  return Math.max(2, Math.floor(Math.min(canvasW / 640, canvasH / 360)));
}

/** At sea: about one and a half times as much water in view. */
export function navalZoom(base: number): number {
  return Math.max(1, Math.floor((base * 2) / 3));
}

/** Set-piece arenas that have to fit on one screen: at least twice the view. */
export function arenaZoom(base: number): number {
  return Math.max(1, Math.floor(base / 2));
}
