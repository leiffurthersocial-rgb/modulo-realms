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

/**
 * How many device pixels one UI pixel is.
 *
 * The UI is laid out in UI pixels and the whole overlay is zoomed by an
 * integer number of *device* pixels, so a frame's one-pixel border is always
 * a whole number of real pixels wide and a glyph never lands between two.
 * Chosen from the CSS size of the window (which tracks physical size) and
 * then snapped to the device grid.
 */
export function uiScale(cssW: number, cssH: number, dpr: number): { device: number; zoom: number } {
  const want = cssH < 600 ? 1 : Math.max(2, Math.floor(cssH / 480));
  let device = Math.max(1, Math.round(want * dpr));
  // never leave less than a 560x320 UI canvas to lay out in
  while (device > 1 && ((cssW * dpr) / device < 560 || (cssH * dpr) / device < 320)) device--;
  return { device, zoom: device / dpr };
}

/** The UI scale in canvas pixels (the world canvas is drawn at CSS resolution). */
export function canvasUiScale(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(1, Math.round(uiScale(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1).zoom));
}
