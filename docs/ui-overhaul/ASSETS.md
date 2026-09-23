# UI pixel assets

Every UI sprite is drawn in code in `src/game/art/uiArt.ts` (and the map
sheets in `src/game/art/mapArt.ts`). There are no image files; to redraw one,
edit its function there — the palette is `PAL` in `src/game/art/palette.ts`.
Sizes are in art pixels, which are UI pixels (1 art px = 1 UI px, zoomed by a
whole number on screen).

## Generated and in use

| Sprite (`--img-*` / `uiSprite()`) | Size | Slice | Used for |
| --- | --- | --- | --- |
| `frame-wood` | 24×24 | 8 | every menu panel, dialogue box |
| `frame-ash` | 12×12 | 4 | cards, toasts, tracker, tooltips, prompts |
| `frame-plate` | 12×12 | 4 | the HUD vitals plate (iron rim, brass rivets) |
| `frame-iron` / `-brass` / `-ember` / `-frost` | 12×12 | 4 | slots and sockets; selected, danger, primordial |
| `frame-parchment` | 18×18 | 6 | atlas, dungeon plan, journal page, harbour chart |
| `frame-inset` | 8×8 | 3 | text inputs, wells, reward pills |
| `btn`, `-hot`, `-down`, `-off` (+ `primary`, `danger`, `iron`) | 12×14 | 3/3/5 | buttons: normal, hover, pressed, disabled |
| `tab`, `tab-on` | 12×10 | 3 (open bottom) | tabs |
| `key` | 9×10 | 2/2/3 | key caps |
| `badge`, `badge-ember`, `badge-iron` | 8×8 | 3 | badges, filter chips, HUD call-to-action |
| `bar-socket`, `bar-seg` | 6×7, 6×16 | 2 | segmented vitals bars |
| `slider-track`, `slider-knob(-hot)`, `slider-fill` | 8×6, 8×12, 2×6 | 2 | slider and toggle |
| `scrim` | 2×2 | – | the dithered modal backdrop |
| `rule` | 16×3 | 7 | rule under panel titles, section dividers |
| `crest` | 40×44 | – | pause board |
| `logo` | ~140×32 | – | title screen (cast from the Modulo font) |
| icons: `coin point lock close check arrow town dungeon camp landmark waystone shrine ruin chest door exit boss you quest harbour bag skull flame potion` | 5–9 × 7–11 | – | HUD, map markers, legends |

## Placeholders worth a hand-drawn pass

These work, but were drawn procedurally and would benefit from a pixel
artist. Keep the sizes and they drop straight in.

| What | Size | Where | Now |
| --- | --- | --- | --- |
| Title logo "MODULO" | ~140×32 (free) | `logo()` | the UI font's glyphs blown up 4× with brass banding |
| Pause crest | 40×44 | `crest()` | a shield, an ember flame, crossed blades |
| Minimap ornament | 88×88 frame, 8px border | `frame-iron` on `.mm-frame` | the plain iron socket; a compass rose or corner filigree would lift it |
| Vitals plate ornament | 12×12 9-slice, or a fixed 160×52 piece | `framePlate()` | iron rim with four brass rivets |
| Atlas region cartouches | ~64×12 9-slice | `.atlas-region` | text with a parchment halo, no banner shape |
| Class emblems for the vitals plate | 9×9 each (6 classes) | – | the class name in small caps |
| Buff / status icons | 7×7 each | `.hud-effect` | text tags |
| Pointer cursor | 12×12 | – | the browser's own cursor |
