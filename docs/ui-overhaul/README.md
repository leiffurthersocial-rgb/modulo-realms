# UI overhaul — Modulo: Realms of Ash

The interface used to look like a web dashboard laid over a pixel-art game:
dark modals with 1px borders, blur, gradient bars, a serif/sans/pixel font mix,
a purple accent and a default range slider. The roulette table ("The
Whirligig") was the one piece that looked like it belonged to the world. This
overhaul brings everything else to that standard.

Screenshots: `before/` (the old UI at 1280×720) and one folder per phase.

## Phase 1 — the design system

Everything is generated in code, like the rest of the game's art. There are
still no font, image or sound files in `src/` or `public/`.

| Piece | Where | What it is |
| --- | --- | --- |
| Tokens | `src/ui/kit/tokens.ts` | 40-odd colours, every one taken from `PAL` (the sprite palette): ash, bone, wood, iron, brass, ember, parchment, vitals. Written to `:root` as `--c-*`. Rarity colours as `--r-*`. |
| UI zoom | `uiScale()` in `tokens.ts`, `install.ts` | The whole overlay is zoomed by a whole number of **device** pixels (2 at 720p and 1080p, 3 at 1440p, 1 on phones). The stylesheet is written in UI pixels. |
| World zoom | `src/game/core/zoom.ts` | The camera zooms by whole numbers too: 2 / 3 / 4 at 720p / 1080p / 1440p (the same ~640×360 view everywhere). At sea and in set-piece arenas it drops to a smaller whole number. The old 1.75 / 2.5 zooms made pixels uneven. |
| Fonts | `src/ui/kit/glyphs.ts`, `font.ts` | **Modulo**: a 5×7 pixel face with lowercase, descenders and every special character the game prints, plus a bold cut. **Modulo Small**: the slot cabinet's 3×5 alphabet, used for labels, key caps and badges. Both are turned into TrueType files in memory at boot and registered with `FontFace`, so DOM text and canvas text use the same letters. 1 glyph pixel = 1 UI pixel at `font-size: 10px`; the only sizes used are 10, 20 and 40px. |
| Surfaces | `src/game/art/uiArt.ts` | 9-slice pixel art for `border-image`: wood frame (menus), ash plate (HUD, cards), iron / brass / ember / frost sockets (slots, highlights), parchment (maps), inset well, button plates in normal / hover / pressed / disabled and primary / danger / iron, tabs, key caps, badges, bar socket and segment texture, slider groove and knob, a 2×2 dither for modal backdrops, the rule under panel titles, the pause crest and the title logo. Published as `--img-*`. |
| Components | `src/ui/kit/index.tsx` | `Modal`, `Button`, `ConfirmButton` (two presses, replaces `window.confirm`), `Slider`, `Toggle`, `Tabs`, `KeyCap`, `Badge`, `SegBar` (segmented, with a damage ghost), `Ticker` (rolling number), `Icon`, `useIntegerFit` (casino canvases). |
| Sound hooks | `src/ui/kit/sfx.ts` | `uiSound(cue)` for hover / click / open / close / tab / coin / deny / confirm / banner / toast. One table decides which synthesised sound answers each cue; `null` means wired but silent. |
| Rules, checked | `scripts/check-ui-style.ts` | Fails on border-radius, blur, gradients, soft shadows, fractional pixels, stray font sizes or families, raw hex colours in the stylesheet, `window.confirm`, and any character the UI can print that has no glyph. Part of `npm run check:aegean`. |

### Palette ("Ash & Ember")

Backgrounds `void → ink → charcoal → slate → stone`, text `bone / cloth`, muted
`fog / ash`, frames `wood` with `plank` highlights, sockets `iron`, titles and
money `gold / goldLit`, the one accent `flame` (ember), danger `blood`. There is
no purple in the UI any more. Purple only appears where the game data uses it:
the Epic rarity and faction colours.

### Decisions

- **Text on an even line box** (12, 14, 16 or 24px) so a baseline never lands
  between two pixels.
- **Modal backdrop is a checkerboard dither**, not a translucent blur.
- **Item icons are shown at their native 32px** (never 16px: halving pixel art
  drops every other pixel). Money uses a 9×9 coin glyph instead of the 32px
  gold item icon.
- **The three casino machines stay their own pixel art**, now scaled by the
  largest whole number that fits (they used to stretch to `82vh`).
