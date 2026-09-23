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

## Phase 2 — HUD, hotbar, minimap, prompts

| Piece | Where | What changed |
| --- | --- | --- |
| Vitals | `src/ui/hud/Vitals.tsx` | Portrait, name, class, HP/MP/SP and XP on one riveted iron plate. Segmented bars with a pale **damage ghost** that drains after a hit. At 25% health the fill and the portrait frame blink ember. Numbers only on hover, or always with the new `showNumbers` setting. |
| Purse | same | Gold is a coin glyph and a number that **rolls** to its new value. Unspent skill points and heroic talents are ember badges that hop until clicked; "pack full" is a bag badge. Buffs are small labelled tags. |
| Hotbar | `src/ui/hud/Hotbar.tsx` | Iron sockets (brass for the weapon and its power), key caps from the actual key bindings, a **cooldown sweep** in 16 ticks, locked abilities show a lock and their unlock level instead of "Lv 8", empty sockets are just empty instead of "off"/"art", potion stack count, a mana/stamina sill when an ability can't be paid for, one bright frame when a cooldown ends. |
| Minimap | `src/ui/hud/Minimap.tsx`, `drawMinimapInto` in `renderer.ts` | Moved off the world canvas into its own canvas in the HUD (drawn at device resolution), iron frame, brass plaque with **region** name and time. Markers are hard pixel squares; the player is a cross. Coordinates only for a debug character or with F3. |
| Prompts | `src/game/art/uiCanvas.ts` | "[E] Enter your home" is a key cap and pixel text on an ash plate. Nameplates over shops, quest "!"/"?", the compass label and the kill-streak counter use the pixel font on whole pixels, drawn in screen space at the UI scale (not at the camera's zoom). |
| Controls text | `Hud.tsx` `FirstSteps` | The permanent key list in the corner is gone. A new character sees a small key-cap card for its first three minutes; after that the prompts and How to Play do the job. |
| Performance | `useGameValue` in `src/ui/hooks.ts` | The HUD no longer re-renders the whole tree 15 times a second. Each piece polls on its own clock and only re-renders when its rounded values change, so an idle HUD does no React work. |

## Phase 3 — menus

| Screen | Where | What changed |
| --- | --- | --- |
| Pause | `src/ui/PausePanel.tsx` | A wooden board with the game's crest (generated in `uiArt.ts`) and who/where you are on the left, the menu on the right, and **"Leave the valley"** set apart underneath in ember. Abandoning the run is a two-press `ConfirmButton` instead of a browser dialog. The debug-menu button only exists in dev builds (`import.meta.env.DEV`), and there only for a character named "debug". Coordinates are gone from the pause screen. |
| Atlas | `src/ui/MapPanel.tsx`, `src/game/art/mapArt.ts` | The world re-inked onto parchment. Unknown land is paper with a hatch and an ink edge, revealed in 8-tile blocks around discovered places. Region names (and level bands) are lettered on the map where the region lies, only once you have found a place in it — no more 26-line legend. Places are pixel icons by kind; attuned waystones glow and are clickable. Four whole-number zoom steps with iron −/+ buttons and pips, drag to pan, "Find me". |
| Dungeon map | same | A plan instead of flat rectangles: pale floor with a dot grid, walls inked on the floor edge, hatched rock, at the largest whole number of pixels per tile that fits. Exit, doors, unopened chests, the boss and the player are icons; the exit is labelled. |
| Journal | `src/ui/QuestPanel.tsx` | The selected quest is a parchment page (all colours swap to inks inside `.frame-parchment`); tags are badges. |
| Skills | `src/ui/SkillPanel.tsx` | Ability cards on ash plates with their key cap. |
| Settings | `src/ui/SettingsPanel.tsx` | Pixel sliders and lever toggles, key caps for bindings, new "Vital numbers" switch. |
| Waystone travel | `src/ui/TravelPanel.tsx` | Waystone icon per gate. |

## Phase 4 — making it move

| Piece | Where | What changed |
| --- | --- | --- |
| Panels | `.modal` in `global.css` | Open with a three-frame drop (`steps()` timing, no easing), the scrim dithers in over two frames. Buttons drop onto their lip when pressed. |
| Gold | `Ticker` in `ui/kit` | Counts to its new value, brighter going up, ember going down. |
| Level-up | `src/ui/hud/Banners.tsx` | A big LEVEL UP banner in 4× lettering with the new level under it. |
| Place names | same | Walking into a settlement, a region or through a door letters its name across the top ("The Gilded Spade", "Crag Reach · Level 22–36"); each place announces itself at most once every two minutes. The travel fade names the destination in the pixel font. |
| Floating numbers | `drawText` in `src/game/combat/fx.ts` | Damage, heals and words in the pixel font with a one-pixel outline, drawn in screen space at the UI scale; crits and big numbers at double size; they fade in three hard steps. |
| Pickup toasts | `Toasts` in `Hud.tsx` | Slide in from the left over three frames with the item's icon; dim for their last second. |
| Sound hooks | `src/ui/kit/sfx.ts`, `App.tsx` | Every button press plays the `click` cue and every hover the `hover` cue, delegated from the overlay (tabs, toggles, hotbar, touch pad and casino are left to their own sounds). `open`, `tab`, `coin` (money coming in outside the casino), `confirm`, `deny`, `banner`, `toast` and `close` are wired; `hover`, `close`, `deny`, `banner` and `toast` are silent until a sound is assigned in the one table. |
| Reduced motion | `global.css`, Settings | Honours `prefers-reduced-motion`, and a new **Reduce motion** setting does the same in-game (animations cut to a single frame). |

## Testing

Checked at 1280×720, 1920×1080 and 2560×1440 (`phase2/` has the HUD at all
three). `npm run typecheck`, `npm run build` and `npm run check:aegean` (now
26 groups, including `check-ui-style`) pass. Nothing in the simulation,
balance or save format changed; the only additions to stored data are two
optional fields in the *settings* entry (`showNumbers`, `reduceMotion`).

Known limits:

- A browser zoom or OS scale that is not a whole multiple (125%, 150%)
  still gets whole *device* pixels for the UI; the world canvas is drawn at
  CSS resolution as before, so there the world itself is scaled by the
  browser.
- The world camera's zoom animates between whole numbers when boarding a
  ship or entering an arena, and is only pixel-exact once it lands.
- The debug menu is now only reachable in a development build.
