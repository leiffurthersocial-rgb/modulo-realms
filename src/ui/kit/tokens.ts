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

export { uiScale, worldZoom } from '../../game/core/zoom';
