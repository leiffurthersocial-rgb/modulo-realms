import { PAL } from '../../game/art/palette';
import { RARITY_COLOR } from '../../game/items/types';

/**
 * UI design tokens — the one place the interface takes its colours and its
 * pixel grid from.
 *
 * Every colour is lifted out of `PAL`, the palette every sprite and tile is
 * drawn in, so a frame, a button and a health bar are the same wood, iron and
 * ember as the tavern door next to them. No colour here exists only in the UI.
 *
 * `installTokens` writes them onto `:root` as `--c-*` custom properties; the
 * stylesheet only ever reads those.
 */
export const UI = {
  // ash — backgrounds, from darkest to lightest
  void: PAL.void,
  ink: PAL.ink,
  charcoal: PAL.charcoal,
  slate: PAL.slate,
  stone: PAL.stone,
  ash: PAL.ash,
  fog: PAL.fog,
  // bone — text
  bone: PAL.bone,
  cloth: PAL.cloth,
  white: PAL.white,
  snow: PAL.snow,
  // wood — frames and buttons
  woodDark: PAL.woodDark,
  wood: PAL.wood,
  woodLit: PAL.woodLit,
  plank: PAL.plank,
  // iron — slots, sockets, HUD
  ironDark: PAL.ironDark,
  iron: PAL.iron,
  ironLit: PAL.ironLit,
  // brass — titles, highlights, money
  gold: PAL.gold,
  goldLit: PAL.goldLit,
  copper: PAL.copper,
  // ember — the accent, and danger
  emberDark: PAL.emberDark,
  ember: PAL.ember,
  flame: PAL.flame,
  flameLit: PAL.flameLit,
  blood: PAL.blood,
  // parchment — maps and the journal
  parchDark: PAL.sandDark,
  parch: PAL.sand,
  parchLit: PAL.sandLit,
  // vitals
  hp: PAL.ember,
  hpDark: PAL.blood,
  mp: PAL.waterLit,
  mpLit: PAL.frost,
  sp: PAL.grassLit,
  spLit: PAL.toxic,
  xp: PAL.holy,
  frost: PAL.frost,
  good: PAL.toxic,
} as const;

export type UiColor = keyof typeof UI;

/** Fonts are drawn on a 10px em: 1 glyph pixel = 1 UI pixel at 10px. */
export const TEXT = 10;
export const TEXT_BIG = 20;

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Write every token onto the root element as `--c-<name>`. */
export function installTokens(root: HTMLElement = document.documentElement): void {
  for (const [k, v] of Object.entries(UI)) root.style.setProperty(`--c-${kebab(k)}`, v);
  // item rarities are game data, not UI colours, but the stylesheet needs them
  for (const [k, v] of Object.entries(RARITY_COLOR)) root.style.setProperty(`--r-${kebab(k)}`, v);
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

export { worldZoom } from '../../game/core/zoom';
