# CLAUDE.md — Modulo: Realms of Ash

Arbeitsgedächtnis für Claude. Stand 21.09.2026, verifiziert gegen Commit `c07021a`
(Base `52c759f` = PR #9 eingemergt).
Sprache mit dem User: **Deutsch**, kurz, stichwortartig, Probleme direkt benennen.

## Projekt

Browser-RPG (2D Open World, Pixel Art). React 18 + TypeScript 5.6 + Vite 5, Canvas 2D +
Web Audio. Deploy auf Vercel (`vercel.json` fertig). Node 18+. `~47.900` Zeilen in `src/`.

**Das Spiel hat keine Binär-Assets.** Jede Tile, jeder Sprite, jedes Icon, jeder Ton und
seit dem UI-Overhaul auch jede **Schrift** und jeder **UI-Rahmen** wird zur Laufzeit aus Code
generiert (`src/game/art/`, `src/game/audio/audio.ts`, `src/ui/kit/`). Kein Bild-, Audio- oder
Fontfile unter `src/` oder `public/` einchecken — das ist die zentrale Projektregel.
Ausnahme (seit 23.09.): **Doku-Screenshots** (PNG/WebM) unter `docs/` sind erlaubt,
sie werden nie ausgeliefert.

## Git

- **Default-Branch ist `claude/modulo-2d-rpg-game-xrfjyd`. Es gibt kein `main`/`master`.**
  PR-Base und Vercel-Production hängen daran.
- Feature-Branches historisch `codex/*`. PR #1–#9 gemerged; #10 (diese CLAUDE.md) offen.
- Keine CI, kein `.github/`. Alle Checks laufen manuell lokal.

## Kommandos

```bash
npm install
npm run dev            # http://localhost:5173
npm run typecheck      # tsc --noEmit
npm run build          # typecheck + vite build
npm run check:aegean   # 29 serielle Regressionsgruppen — DER große Lauf
npm run build:api      # api/leaderboard.js aus src/server neu bündeln
```

**Vor jedem Push:** `npm run typecheck && npm run build && npm run check:aegean`.

Letzter verifizierter Stand (selbst ausgeführt): typecheck 0 Fehler, Build OK
(Haupt-Chunk 1,39 MB / 455 KB gzip + `react`-Chunk 141 KB + 11 Lazy-Panels; die
Chunk-Warnung für den Haupt-Chunk ist bekannt und akzeptiert),
check:aegean alle 27 Gruppen grün (27.09., mit Hauptquest). Keine TODO/FIXME/HACK im Code.

⚠️ `tsx` ist **nicht in `package.json` deklariert** (`esbuild` seit 06.10. schon, gepinnt auf Vites Version).

## Die zwei Architekturregeln — nicht brechen

1. **Simulation ist nicht React.** Die Game-Loop mutiert plain Objects und zeichnet auf
   Canvas. React rendert *nur* UI und abonniert `useSyncExternalStore` auf einen
   Versionszähler. Nach jeder UI-sichtbaren Zustandsänderung `game.touch()` aufrufen.
   Kein React-State für Spielzustand.
2. **Content ist nicht Logik.** Alles in `src/data/` ist reine Daten. Item, Gegner, Quest,
   NPC oder Dorf hinzufügen darf **kein** System anfassen.

**Code-Splitting (28.09.):** Selten geöffnete Panels (Storage, Travel, Forge, Remake, Crown,
Shipyard, Poker, Slots, Roulette, Debug, Help) sind `React.lazy` in `App.tsx` und werden nach
Spielstart im Leerlauf vorgeladen (`prefetchPanels`). React/ReactDOM liegen per `manualChunks`
in eigenem Chunk. Ein neues selten genutztes Panel → in `loaders` eintragen, nicht statisch
importieren. Spiel-Kern (Game, Art, Data, Aegean) bleibt bewusst ein Chunk — zirkuläre Imports.

Loop (`src/App.tsx`): fixed timestep, Simulation **immer 60 Hz** (`accumulator`,
`g.update(1/60)`). Battery Saver rendert 30 fps, simuliert weiter 60 Hz.
Dev-Hooks auf `window`: `game`, `modulo`, `moduloTiles`, `moduloTemplates`,
`moduloLocations`, `moduloAmbience`, `moduloTownLife` — nur im DEV-Build.

## `src/data/balance.ts` — vor jeder Zahl lesen

Single Source of Truth für alle Stärkewerte. **Nie eine Schadenszahl von Hand schreiben.**

| Export | Wofür |
| --- | --- |
| `meleeDpsAt(level)` | Kurve, gegen die **Waffen** bepreist werden |
| `playerDpsAt(level)` | Kurve, gegen die **Gegner** bepreist werden |
| `TIME_TO_KILL` | Kampfdauer je Rolle — der eigentliche Schwierigkeitsregler |
| `weaponDamage(kind, level, rarity, speed)` | Schaden pro Schlag, gelöst aus dem Obigen |
| `armorDefenseAt` / `enemyHealthAt` / `enemyDamageAt` / `enemyDefenseAt` / `enemyXpAt` | Kurven |
| `CLASS_POWER` / `SHAPE_POWER` | Aufpreis für Reichweite bzw. Sweep-Bogen |
| `ENEMY_THREAT` | die einzigen nicht kurvengelösten Werte |
| `LEVEL_BANDS` / `REGION_DIFFICULTY` / `REGION_BOSS_DIFFICULTY` | Regionen; Bosse eigener Multiplikator |
| `ENDGAME_LEVEL` 68 · `MAX_CONTENT_LEVEL` 100 · `LOOT_LEVEL_REACH` 15 · `MAX_DAMAGE_REDUCTION` 0.74 | |

**Drei Fallen, die schon echte Bugs waren:**
1. `meleeDpsAt` ≠ `playerDpsAt`. Echter Schaden = Waffenschaden × Primärstat ×
   Angriffstempo × Crit; alle vier wachsen mit Level → steiler als quadratisch.
   Gegner gegen `meleeDpsAt` bepreist ⇒ 5-Phasen-Boss starb in 3,5 s.
   **Gegner gegen `playerDpsAt` + `TIME_TO_KILL`, Waffen gegen `meleeDpsAt`.**
2. Hoch-/Runterskalieren **immer per Kurven-Verhältnis**, nie per flat Prozent.
   Flat-% ergab: Level-1-Schwert auf 75 = 10,6× Budget; Level-6-Bandit auf Level-24-Straße
   = halbe Stärke.
3. `playerDpsAt` ist ein **Fit, keine Herleitung**. Nach Änderungen an Waffen, Attributen
   oder Talenten `npx tsx scripts/measure-dps.ts` laufen lassen und neu fitten.

## Verzeichnisse

```
src/
  App.tsx                Canvas, Loop, Screen-Routing, UI-Mounting (216 Z.)
  game/core/game.ts      die Game-Klasse — 4798 Z., State + Update + Combat + Interaktion
  game/core/renderer.ts  Chunked Terrain, Y-Sortierung, Lighting, Minimap (1011 Z.)
  game/core/world.ts     WorldCtx — Interface zwischen Entities und Game
  game/core/input.ts     Keybinds, Edge-Detection, Maus, Virtual-Input (Touch)
  game/art/              palette, pixel, tileset, props, buildings, characters,
                         creatures, weaponart, icons, aegean*
  game/world/            tiles, map, worldgen, village (Ashvale), settlements,
                         interiors, dungeons, aegeanGeography, aegeanDungeons
  game/entities/         Entity-Basis, Enemy-AI + Boss-Logik, NPC-Schedules
  game/combat/           projectiles, fx, physical, Telegraphs
  game/items/            types, enchants, loot, inventory
  game/player/player.ts  abgeleitete Stats, Equipment, Look, Leveling
  game/save/             save.ts + rejoinRollback.ts
  game/aegean/           13 Module: campaign, encounters (2325 Z.), naval, powers,
                         activities, services, hazards, weapons, deck, mastery,
                         navigation, waypoints, guidance
  game/casino/           games.ts (reine Regeln: Deck, Handwertung, Walzen, STAKES) +
                         casino.ts (Sitzung, Einsatz, Auszahlung) + holdem.ts — Gilded Spade
                         + roulette.ts (Das Rad: Schaden, Reparatur-Sequenz, Idle-Show)
                         + slotMachine.ts (Walzenmechanik, Hebel, Münzen)
                         + rouletteTable.ts (Kessel-Regeln + spielbarer Tisch)
                         + pokerShow.ts (Chipflüge, Hero-Chips auf der Linie)
  game/art/casinoRoom.ts Inventar des Spielsaals: sitzende Gäste (4 Blickrichtungen,
                         6 Stammgäste), Croupier, Barkeeper, Roulette (heil/kaputt),
                         loser Radkopf, Kassenkäfig, Cocktailtische, Teppich, Porträt,
                         Kordeln, Rauch, Münzglanz.
                         `getProp` greift hier zuerst zu, wie bei `aegean.ts`.
                         **Alle Personen dort sind auf Spielergröße gezeichnet**:
                         `HEAD_W/HEAD_H/TORSO_W/TORSO_H` sind die Maße aus
                         `characters.ts`. Nicht wieder verkleinern — ein 7-px-Kopf
                         neben Dario liest sich als Kinderzimmer.
  data/                  races, classes, items, enemies, npcs, quests, locations,
                         balance.ts, aegean/*
  data/mainquest.ts      Hauptquest West: MAIN_ACTS, MAIN_QUESTS, MAIN_ORDER, MAIN_REPORT
  game/quests/questlog.ts  QuestLog: Fortschritt, `hunt`, `precredit`, `markerVisible`
  game/core/training.ts  Steuerungs-Training neuer Charaktere (laufen/kämpfen/Dash-Dodge)
  game/art/caveProps.ts  Höhlen-Deko (Pfützen, Leuchtpilze, Kristalle, Netze, Geröll,
                         Stützbalken, Schienen, Lore) — `getProp` fragt hier vor GEN
  game/core/caveLife.ts  Höhlen-Animation, nie gespeichert: Tropfen, Sporen, Funkeln,
                         Staub im Fackellicht, Fledermäuse, Ratten (nur `map.kind === 'cave'`)
  ui/                    28 React-Panels + hooks.ts, aegeanNames.ts
  ui/kit/                UI-Designsystem in Code: tokens.ts (Palette aus PAL, UI-Zoom),
                         glyphs.ts + font.ts (Pixel-Fonts als TTF zur Laufzeit gebaut),
                         index.tsx (Modal, Button, ConfirmButton, Slider, Toggle, Tabs,
                         KeyCap, Badge, SegBar, Ticker, Icon), sfx.ts (UI-Sound-Hooks),
                         install.ts (Boot vor dem ersten React-Render)
  game/art/uiArt.ts      9-Slice-Rahmen, Buttons, Slots, Icons, Wappen, Logo als Pixel-Art
  game/core/zoom.ts      ganzzahliger Welt-Zoom (Basis/See/Arena)
  game/core/ambience.ts  reine Deko, nie gespeichert: Kaminrauch, springende Fische,
                         Blätter/Vögel/Schmetterlinge/Glühwürmchen, Wolkenschatten,
                         Fußspuren, Atemwolken, Wetter (Sandsturm+Steppenläufer+
                         Staubteufel+Geier in `south`, Schnee+Blizzard in `north`/
                         `deepnorth`, Asche in `farsouth`/`emberdeep`). Läuft auf
                         `game.now`, Dev-Hook `window.moduloAmbience`.
  game/art/beasts.ts     Golem-Anatomie + `menaceTier(level)` (0..3 aus dem
                         Bestiarium-Level) und Menace-Trims für späte Kreaturen. Golem aus
                         Steinblöcken mit Ober-/Unterarm und Fäusten, die am Boden ruhen
  game/art/wolfArt.ts    Der Wolf **nach User-Referenzbild** (28.09.): Seitenposen (Stand,
                         Blinzeln, Sprung, Biss) sind die Referenz 1:1 als Zeichen-Grids,
                         Front/Rück im selben Stil von Hand; nur die Palette wird pro
                         Variante berechnet. Eigener Frame 44 px breit (`WOLF_FRAME_W`),
                         eigene Outline (kein generischer `outline()`-Pass). Walk = Schienbein-
                         Reihen diagonal versetzt (`stepLegs`). Nicht durch Ellipsen ersetzen.
  game/art/interiorProps.ts  Möbel der Ashvale-Innenräume (Wandflächen, Kamin, Theke,
                         Fässer, Esse, Blasebalg, Bänke, Altar, Thron, Regale …) —
                         `getProp` fragt hier nach casino/cave, vor GEN
  game/core/townLife.ts  25 Stadt-Details in Ashvale, nie gespeichert: Hühner, Hahn,
                         Katze, Hund, zwei Botengänger, Kinder am Brunnen, Wäsche, Wimpel,
                         Markisenfransen, Amboss-/Schleifsteinfunken, Krähen/Spatzen, Bienen,
                         Blüten, Aushänge, Küchendampf, Brunnentropfen, Heu, Apfel, Motten,
                         Essenglut, Kapellenglocke (6/12/18 Uhr), Teppichklopfen.
                         Anker = vorhandene Props (liest nur), Dev-Hook `window.moduloTownLife`
  styles/global.css      UI-Stylesheet, nur UI-Pixel + --c-*/--img-* Variablen
```

Größte Dateien: `game/core/game.ts` 4798 · `game/aegean/encounters.ts` 2325 ·
`data/enemies.ts` 1575 · `styles/global.css` 1531 · `data/aegean/progression.ts` 1485 ·
`game/art/props.ts` 1443 · `game/art/aegean.ts` 1427.

`game.ts` ist der Refactoring-Kandidat *und* das größte Risiko — dort hängt alles dran.
Nicht ungefragt aufteilen.

## UI-Designsystem — die Regeln (seit 23.09.)

Doku: `docs/ui-overhaul/README.md`. Geprüft von `scripts/check-ui-style.ts` (Teil von
`check:aegean`).

- **Ganzzahliger Zoom überall.** Das Overlay (`.overlay`) hat `zoom: var(--ui-zoom)` =
  ganze Device-Pixel pro UI-Pixel (`uiScale()` in `ui/kit/tokens.ts`: 2 bei 720p/1080p,
  3 bei 1440p, 1 auf Phones). CSS-Längen sind **UI-Pixel**, nie `vw`/`vh`. Die Welt-Kamera
  zoomt ebenfalls nur ganzzahlig (`game/core/zoom.ts`).
- **Eine Schrift:** `Modulo` (5×7, Bitmap in `ui/kit/glyphs.ts`) in 10px oder 20px, dazu
  `Modulo Small` (das 3×5-Alphabet des Slot-Automaten) für Labels/Tasten/Badges. Neue
  Sonderzeichen brauchen eine Glyphe — der Check findet fehlende.
- **Farben nur als `--c-*`-Token** (Teilmenge von `PAL`), Flächen nur als generierte
  `--img-*`-Sprites per `border-image`. Kein border-radius, kein Blur, keine Gradients,
  keine weichen Schatten (Schatten = 1 harter Pixel).
- Destruktive Aktionen über `ConfirmButton` (zweimal klicken), nie `window.confirm`.
- Panels über `<Modal>`; neue UI-Sounds nur über `uiSound(cue)` (`ui/kit/sfx.ts`).

## Welt

Eine durchgehende Overworld **1920×1088 Tiles** à 32 px. `LEGACY_WORLD_W = 960`,
`WORLD_W = 960*2` (`src/data/locations.ts`).

- **Westhälfte (Original):** 12 Regionen als Leiter von Ashvale nach außen, Level 1→75.
  9 Siedlungen, 19 Dungeons, ~36 Landmarks.
- **Osthälfte (Aegean Oath / Achaea):** 960×1088, 12 griechische Regionen, 8 Siedlungen,
  16 Inseln, Asterion, 20 Häfen, 36 Encounter-Maps, 24 Interiors, 5 Unterwelt-Areale.
  54 Feld-Arten, 30 Boss-Designs, 9 Hazard-Familien, 7 Wetter (`data/aegean/ecology.ts`).

Default-Seed **1337**; `AEGEAN_TEST_SEED=42` gibt eine zweite Geographie.

## Bewusste Design-Entscheidungen — nicht "korrigieren"

- **Eine Hauptquest, sonst Bounties.** Nebenbei bleibt alles Bounty: bietet sich beim
  Entdecken selbst an, zahlt sofort aus. Die Hauptquest (siehe eigener Abschnitt) ist die
  einzige Kette mit Rückmeldung an NPCs.
- **Türen:** nutzbare Gebäude sehen aus wie ihre Funktion, alles andere ist dasselbe
  verrammelte Stadthaus. Eine Silhouette, einmal prüfen reicht.
- **Licht:** Interiors hell, Dunkelheit nur in Dungeons/Krypten/Höhlen/Türmen.
  **Eine Ausnahme:** das Kasino (`dark: 0.34`). Fensterlos, nur von eigenem Messing
  beleuchtet — ohne etwas Umgebungsschatten sind Wandleuchter, Automatenköpfe und
  Kassenkäfig bloß Aufkleber statt Lichtinseln.
- **Der Spielsaal ist eigenes Material.** `CASINO_CARPET` / `CASINO_PARQUET` /
  `CASINO_MARBLE` (Tiles 78–80) statt `FLOOR_CARPET`: Letzteres zeichnet in *jede* Kachel
  eine Goldumrandung, was den Raum zu Millimeterpapier macht. Die neuen Tiles leiten alles
  Strukturelle aus `x % 16` / `y % 8` ab, laufen also über die Kachelgrenze durch; nur das
  Rauschen variiert. Der Goldrand kommt vom Teppich-Prop, einem einzeln gezeichneten
  184×136-Bild — eine gekachelte Borte kann nicht auf Gehrung stoßen.
- **Alle drei Hausspiele sind keine Dialoge.** Slot, Roulette und Hold'em werden als
  *Gerät bzw. Tisch* gezeichnet (`art/slotCabinet.ts`, `art/rouletteFelt.ts`,
  `art/pokerFelt.ts`): ein Canvas auf 1:1-Pixel, per Nearest-Neighbour hochskaliert,
  kein Titelbalken, kein SPIN-Button, keine Paytable-Liste, keine Fold/Call/Raise-
  Buttons. Bedient wird das Möbel: Slot-Paytable steht auf dem Bauchglas, Einsatz sind
  fünf Münzschlitze, gespint wird am **Hebel** (senkrechte Führung, ziehen; zu kurz
  gezogen = nichts passiert — kein Drehgelenk mehr, das las sich als Kreisen).
  Roulette: Chip aus dem Rack auf ein Feld, Kessel anschieben. Poker: Chips vom Rack
  auf die Linie werfen, Linie reinschieben (= Check/Call/Raise, je nachdem was
  draufliegt), eigene Karten wegwerfen = Fold, aufs Namensschild klicken = auscashen.
  Alle Legenden sind auf den Filz gedruckt. `slotCabinet.ts` bringt das
  3×5-Pixelalphabet und die Siebensegment-Lampen mit, die beiden anderen borgen sie.
  **Nicht wieder in React-Panels zurückbauen.** Mechanik läuft in Spielzeit aus
  `Casino.update`, die Panels nur zeichnen und lesen.
- **Kasino-Quoten sind festgelegt (23.09.):** Slot = Virtual Reel — `spinSlots` würfelt
  den Rang zuerst aus `SLOT_ODDS` (Summe exakt 50 % Treffer, RTP 94,5 %), die Walzen
  bremsen danach auf passende Symbole; `SLOT_REEL` ist nur noch Optik. Paytable-Werte
  sind **Gesamtrückzahlung** pro Einsatz (`*1.5` = Einsatz + halber Einsatz), nicht
  Nettogewinn. Roulette: echte Single-Zero-Quoten. Der Ballfall wird **relativ zum
  Kessel** gerechnet und startet mit der aktuellen Ballgeschwindigkeit (früher: 5×
  Beschleunigung beim Fallen + Snap ins Fach). Poker-Gegner: Monte-Carlo-Equity
  (`estimateEquity`) gegen gelesene Ranges vs. Pot-Odds, Persönlichkeit je Sitz;
  bewusste Lecks (Bet-Size = Handstärke, kein Slowplay, callen gegen aggressiven
  Hero leichter). Nicht "perfektionieren".
- **Sprites werden gecacht, nicht pro Frame gebaut** (`art/casino.ts` `keep()`,
  `patronBust`). Der Pokertisch zeichnet bis zu 15 Karten und ein Dutzend Chips pro
  Frame; frisch gebaut wären das ~30 Offscreen-Canvases je Frame für Bilder, die sich
  nie ändern.
- **Chips fliegen einzeln.** `pokerShow.ts` diffed `seat.committed` gegen den letzten
  Stand und wirft pro Erhöhung eine Handvoll Chips mit 75 ms Versatz auf einer Parabel,
  die beim Landen aufeinander stapeln; `collecting` fegt alle Stapel in den Pot, das
  Handende wirft den Pot zum Gewinner. `holdem.ts` weiß davon nichts und soll das
  auch nicht.
- **Das Roulette startet kaputt.** Der Kopf ist abgeschraubt und liegt in Whisperwell
  Cave (`casino_wheel_head`-Prop, Item `q_wheel_head`). Dario gibt den Hinweis in seinem
  **goldgerahmten** Dialogknoten (`frame: 'gold'` + `accent: 'gold'` auf der Zeile — ersetzt
  die alte Warrior-Zeile), das schaltet `bounty_roulette` frei. Die Reparatur am Rad ist
  eine 16-Takt-Sequenz (`game/casino/roulette.ts`, `REPAIR`), kein Menü. Danach: Flag
  `casino_wheel_fixed`, +25 Gildenruf, Dario zieht ans Rad und spielt dort die Idle-Show.
  Zustand lebt ausschließlich in Player-Flags; `Game.applyStoryProps` baut Prop und
  Dario-Anker bei jedem `setMap` daraus neu auf — Maps werden aus dem Seed regeneriert
  und können nichts davon speichern. **Repariert ist es spielbar**: Einzelnull-Kessel
  (37 Fächer), Straight 35:1, Dutzend 2:1, einfache Chancen 1:1, Hausvorteil = allein
  die Null (2,7 %).
- **Keine Gear-Restriktionen**, keine Level-Anforderungen auf Items.
- Level-Cap 100, heroische Masteries ab 80, normale Talentpunkte stoppen bei 75.
- **Kein Level-Lock nach Achaea.** Schwierigkeit kommt aus Gegnern, Wetter, Expeditionskosten.
- **Boss-HP sind gedeckelt** (`aegeanBossHealthCap` in `data/aegean/damage.ts`):
  normale Bosse 30.000, Asterion-Champions 58.000, Leonidas 110.000.
  Regel: "HP erhöhen ist keine Schwierigkeit." Nicht mit HP balancen.
- **Primordial ist bewusst dominant**, nicht "aus Versehen zu stark":
  `RARITY_POWER.primordial` = 3.2 (Olympian 1.52, Mythic 1.38), 6 Enchant-Slots
  gegen 4 bei Olympian. Capstone der Endgame-Insel — nicht "eingenordet".
- **Lifesteal ist volle Stärke** (der 2 %/s-Cap wurde am 21.09. nach Feedback entfernt).
  Nicht wieder cappen.
- Händler skalieren mit der Region, auf der sie stehen — nicht mit fester Liste.
- **Keine Laternenpfähle** (lasen sich elektrisch). Nur offenes Feuer: Fackeln,
  Kohlebecken, Hängelaternen am Holzpfosten. `lamp_post`/`casino_lamp` werden in
  `buildAshvale` noch *gesetzt* (sonst verschiebt sich der Scatter) und am Ende entfernt.
- **Späte Monster sehen gefährlicher aus, weil ihr Level es sagt:** `menaceTier`
  (≥16/30/55) → Narben/Nackenhaare, Knochenstacheln, glühende Adern + Boden-Ring.
  Später = dunklerer Körper, hellere Akzente. Nicht per Spawn-Level, sonst Sheet-Explosion.
- **Häuser:** Fenster sind tagsüber dunkles Glas; das Leuchten kommt nachts vom
  Renderer (`BuildingArt.windows`). `BuildingArt.h` ist die Layout-Höhe, das Canvas
  hat `padTop` Kopffreiheit für Firstspitzen — `h` nie auf Canvas-Höhe ändern, sonst
  verschiebt `placeBuilding` Props der eingefrorenen Westwelt.
- **Schnee lebt in der Welt, nicht auf dem Glas** (`Ambience.stepSnow`/`drawSnow`):
  Flocken in Weltkoordinaten mit Parallaxe, pendeln langsam, bleiben liegen. Keine
  bildschirmfesten Punkte und keine Streifen — das las sich als Röhrenfernseher.
- Wind: Bäume/Büsche mit `swayRow` verschieben die Krone um ganze Pixel, Stamm bleibt;
  jede zweite Instanz wird per Positions-Hash gespiegelt.

## Hauptquest West — „Der Rest“ (seit 27.09.)

Daten in `src/data/mainquest.ts`, Logik in `Game.offerMainQuests` / `mainStoryState` /
`mainStorySeal` + `QuestLog`. Geprüft von `scripts/check-mainquest.ts` (Teil von `check:aegean`).

Story: Das Modulo teilt die Welt, der **Rest** wird größer. Tutorial → Whisperwell →
Ivo → Ironroot → Thornhollow/Matriarch → Northwatch/Stone Warden → Vareth → vier Lecks
(Gloam Mother, Tide King, Aldrhrim, Cinder Maw — freie Reihenfolge) → Drowned Court →
Storm Throne → Floor of the World → **The Remainder** (Level 75, Finale). 6 Akte, 12 Kapitel.
Die drei `AEGEAN_ENTRY_BOSSES` liegen alle auf dem Weg — Hauptquest-Ende = Tür nach Achaea.

Regeln — nicht aufweichen, das ist der Sucht-/Grind-Kern:
- **Level-Gates** (`prereq.level`): das nächste Kapitel kommt erst mit dem Level. Tracker
  zeigt „Reach level N“ + XP-Balken + Region zum Leveln. Die Lücke ist gewollt (Bounties,
  Dungeons, Kasino). Gates nicht entfernen, nur verschieben.
- **Kein Dauerpfeil:** `guide: 'discovered'` → Kompass, Minimap und Atlas-Flagge erst,
  wenn der Spieler den Ort selbst entdeckt hat. Vorher nur `hint` (Richtung ab welcher
  Stadt). Jeder unguided Schritt braucht einen `hint` (Check erzwingt).
- **`hunt`-Ziel** `{ region, count }`: jeder echte Spawn-Kill in der Region; Beschwörungen
  zählen nicht. Grind im Kapitel. Ist nur noch die Jagd offen (`Game.onlyHuntLeft`), zeigen
  Kompass und Story-„?“ **nicht** mehr auf den Kapitel-Ort (las sich als „dort fehlt noch
  was“, z. B. Mine nach toter Brood Mother); der Tracker sagt „No need to go back“.
- **Vorher erledigt zählt** (`QuestLog.precredit`): Boss (`bossesKilled`/`killCounts`),
  Dungeon (`clearedDungeons`), Ort (`discovered`). Hunts nie — außer beim Laden, wenn der
  Spieler die Region überlevelt hat (`catchUp`). Alte Saves laufen beim Laden in einem
  Rutsch durch alle verdienten Kapitel (ein Toast).
- Kapitel werden **automatisch angenommen** (Hand-in, jedes Level-up, Laden), nie per
  NPC-Angebot. Kapitel ohne `turnIn` zahlen sofort; mit `turnIn` → Rückmeldung (Tracker
  sagt wo, `MAIN_REPORT`).
- Belohnungen kommen aus den Kurven (`pay()` = `enemyXpAt`/`enemyGoldAt`), nie per Hand.
- **Ivo Marrow** (`ivo_marrow`, Kettle & Crown, `int_inn` 13/9) ist der Story-Hub. Neuer
  NPC im Interior — Westwelt-Baseline unberührt.
- **Der Remainder** steht per `DungeonSpec.bossLevel: 75` am Ende von „Under the Gate“
  (Trash bleibt 59). Der Abstieg (`dungeon_remainder`) ist **versiegelt**, bis
  `main_remainder` aktiv ist oder er schon tot ist (`mainStorySeal`).
- Nicht gebaut (Vorschlag, offen): Kopfgeld-Brett mit täglichen Aufträgen, Marken-Währung,
  Boss-Rematch-Stufen, Jagdbuch.

## Marketing / Social Media (seit 06.10.)

`marketing/` — README (Ablauf + Upload-Stufen), `content-plan.md`, `posts.md` (fertige Captions),
`record.mjs` (Szene headless aufnehmen, Autopilot kämpft, nur Welt-Canvas + Spielton; braucht `npm run dev`),
`scenes.mjs`, `edit.mjs` (1080x1920, Pixel-Schrift, Endkarte, −14 LUFS), `brand.mjs` (Avatar/Banner aus
Wappen + Logo), `youtube.mjs` (Device-Flow-Login, Upload, Stats; Env `YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN`),
`stats.mjs` (Besuche/Spielstarts pro `utm_source` und Tag — Server-Aktion `track`, nur Tagessummen,
Client `game/online/attribution.ts`; Lesen nur mit `LEADERBOARD_ADMIN_TOKEN`). Vercel Web Analytics ist
**nicht** aktiv (braucht interaktive Bestätigung des Users im Dashboard).
Videos nie ins Repo. Konten (TikTok/Instagram/YouTube, @modulorealms, modulorealms@gmail.com) legt der
**User** an — Bot-Kontoerstellung verbieten TikTok/Instagram. Stand 06.10.: 4 Shorts geschnitten
(wolfpack, ashvale, frost, ember) und dem User geschickt; Matriarch-Szene liest sich schlecht (Boss = Baum).

## Story erzählen (seit 06.10.)

- **Story-Karten** (`data/story.ts`, `Game.storyCards`, `ui/StoryCard.tsx`, Panel `'story'` pausiert die Welt):
  Prolog (4 Seiten, „Skip prologue“) vor dem Training jedes neuen Charakters; jedes in Spielzeit geöffnete
  Hauptkapitel bekommt eine Karte (aus `detail`/`summary`/`hint`), das erste Kapitel eines Akts zusätzlich
  eine Akt-Karte. **Ersetzt den alten Kapitel-Toast.** Catch-up beim Laden zeigt keine Karten. Die UI öffnet
  das Panel erst, wenn nichts anderes offen ist (Hand-in-Dialog läuft zuerst). Nie gespeichert.
- **Level-Gate „Was jetzt?“** (`Game.levelGateHelp`): Tracker zeigt XP bis zum Level, die nächstgelegene
  offene Bounty (≤ Level+3, Westwelt) mit Richtung + Distanz ab Spieler, und die Jagdregion.
- Titel-Slogan: „The world is divided by the Modulo. What is left over is growing.“

## Einstieg & Höhlen (seit 27.09.)

- **Training statt Tasten-Ecke:** Neuer Charakter startet `Training` (`core/training.ts`):
  1 laufen (240 px) → 2 Wolf töten → 3 drei Schläge per Dash ausweichen (Cutter mit
  `windupMul` 2.4 + Boden-Ring, Trainer treffen für 1) → 4 Trainer besiegen. Erst danach
  kommt „Somewhere to Start“ (`Game.finishTraining`). „Skip“ auf der Karte. Gespeichert
  wird nur das Flag `training:done`; alte Saves (Level > 1 oder Tutorial-Quest da) werden
  beim Laden still markiert. Während des Trainings: kein Tracker, keine Hauptquest.
- **Keine Tastenhilfe mehr im HUD.** Die Steuerung steht nur noch im Pausemenü, Tab
  „Controls“ (`PausePanel`), über `input.keyLabel` → zeigt umbelegte Tasten richtig.
- **Doppelte Quests:** Eine Bounty mit denselben Zielen wie das aktuelle Hauptkapitel wird im
  Tracker nicht nochmal gezeigt (zahlt trotzdem).
- **Höhlen-Deko** (`theme: 'mine'`): `decorateCave` in `world/dungeons.ts` läuft **zuletzt,
  mit eigenem RNG** (`${seed}:${mapId}:cavelife`) und hängt nur Props an — Räume, Spawns,
  Chests, Fallen bleiben exakt, wo sie waren. Nicht in die Haupt-RNG-Kette ziehen, sonst
  verschiebt sich jeder Mine-Dungeon. Stützbalken stehen quer in Nord-Süd-Gängen (die
  Rückwände sind von Fackeln belegt). Leucht-Halos sind gestufte flache Ovale, keine
  Gradients (UI-/Pixel-Regel).

## Ashvale-Überarbeitung (seit 27.09.)

- **Innenräume** (`world/interiors.ts`): kleiner (Haus 10×8 … Kapelle 11×11), eigene Böden
  `ROOM_PLANK` 81 / `ROOM_FLAG` 82, zwei Wandreihen mit Wandflächen-Prop (`face`), voll
  möbliert per `dress()`. Interiors sind nicht Teil der eingefrorenen Westwelt.
- **NPC-Standorte passen zum Text:** Pell (Laden) und Sable (Apotheke) stehen drinnen, Corin
  tagsüber am Amboss (Funken kommen von `townLife`),
  Ivo „am Tisch beim Feuer“, Rook am Brunnenplatz, neuer Lehrling **Wyn** (`smith_wyn`,
  Esse, Rohstoffe). `check-npc-schedules` erwartet 3 Außenbewohner (Hanne, Corin, Kesh).
- **Starter-NPCs sind nützlich** über drei Dialog-Aktionen (`dialogue/types.ts`):
  `guide` (story/rumour/hunt → Richtung ab Ashvale), `bless` (Alun, 10 min Rüstung),
  `sharpen` (Corin, Gold → 10 min +10 % Waffenschaden). Hanne/Sable schenken einmalig
  Tränke (Flag `gift:*`).
- **Story-„?“** auf Atlas und Minimap aus `Game.storyTargets()`: nur Ziele, die die
  Hauptquest ohnehin zeigen darf (Regel „kein Dauerpfeil“ gilt weiter).
- **Außen-Props neu gezeichnet** (Amboss, Schleifstein, Esse, Waffenständer, Brunnen …);
  Ladenschilder bekommen ihr Symbol per Renderer-Overlay (`SIGN_DEVICE`) — Prop-Liste
  der Westwelt bleibt unverändert.
- Design-Kritik-Loops (eigener Kritiker-Agent, max. 3 Runden, Ziel ≥ 9/10): Interiors
  5 → 7, Wolf (alt) 5 → 6 → ersetzt durch Referenz-Wolf (`wolfArt.ts`, 5 → 7 → 8), Golem 6 → 7, Außen-Props 5,5 → 7, Stadt-Details 5 → 6,5 → 7.
  **Keiner hat 9/10 erreicht** — nicht als „fertig poliert“ weitergeben.

## Die eingefrorene Westwelt — vor jeder Ortsänderung lesen

`scripts/check-aegean-world.ts` friert die komplette Westhälfte (960×1088) gegen
Git `d39d75a` ein — Tiles, Regionen, Props, Portale, Spawns, Chests. Zweck: beweisen,
dass die Aegean-Arbeit nie ins alte Tal zurückgegriffen hat. **Jede** Änderung an
Ashvale oder einer anderen Weststadt bricht diesen Check, auch eine beabsichtigte.

Ablauf für eine gewollte Änderung:
1. Änderung bauen.
2. `node scripts/record-aegean-legacy-baseline.mjs` — schreibt `documentedChanges.sha256After`.
3. In `scripts/aegean-legacy-baseline.json` unter `documentedChanges.changes` einen
   Eintrag ergänzen (`id`, `what`, `fields` und was genau sich ändert).

`sha256` bleibt dabei für immer der Vor-Aegean-Anker und wird nie neu aufgenommen.
**`regions`, `spawns` und `chests` dürfen nie in `fields` stehen** — der Check
erzwingt das selbst. Eine undokumentierte Änderung (schon ein um ein Tile
verschobener Karren) schlägt weiterhin fehl; das ist getestet.

## Save-System — Minenfeld

localStorage: `modulo-realms-save-v1` (Haupt), `modulo-realms-save-pre-aegean` (Roh-Backup),
`modulo-realms-save-recovery`, `modulo-realms-save-rollback-v1`, `modulo-realms-settings-v1`.
`SaveData.version: 1 | 2`, v1 lädt in v2.

Hintergrund: Die Aegean-Expansion wurde einmal aus Production zurückgerollt (`98cfa3c`) und
neu gebaut. `rejoinRollback.ts` gleicht Fortschritt aus der Rollback-Zeit mit dem
aufbewahrten Expansion-Stand ab, ohne verkaufte Original-Items wiederzubeleben oder
beiseitegelegte Greek-Items zu verlieren. `itemMigrations` / `restoreLegacyItemMigration`
repariert von der ersten Expansion beschädigte Items ohne spätere Upgrades zu verwerfen.

**Am Save-Format nichts ändern ohne `scripts/check-save-rejoin.ts` zu verstehen.**

**Export/Import (seit 06.10.)** `game/save/transfer.ts`: kopiert alle localStorage-Strings mit Präfix
`modulo-realms-` (Save, Recovery, Rollback, Settings, Leaderboard-Identität) in eine JSON-Datei und zurück —
Format unberührt, Migrationen laufen beim normalen Laden. Import wird zuerst auf einer Kopie mit
`readExpansionSave` geprüft. Pausemenü „Export save“, Titel „Import save“ (ConfirmButton, wenn ein Save da ist).

Forging bis Level 75 ist unverändert; Upgrades **jenseits 75** nutzen dieselbe
Template-Kurve wie der Loader — sonst entsteht temporäre Exponentialkraft, die beim
Reload verschwindet. Abgedeckt von `scripts/check-endgame-reforge.ts`.

## Check-Skripte (`scripts/`, 33 Stück, kein Test-Framework)

`npx tsx scripts/<name>.ts`:
- `check-balance` — jede Waffe/Rüstung/jeder Gegner gegen Budget. Alles soll `x1.00` lesen,
  außer benannten Relics (erlaubte 1,12×-Prämie).
- `check-content` — nicht auflösbare Referenzen zwischen Datendateien
- `check-mainquest` — Hauptquest-Kette, Referenzen, Level-Gates, Führung ohne Pfeil,
  Hunts, Pre-Credit, Siegel am Remainder, Catch-up alter Saves (echte `Game`-Instanz)
- `check-regions` — was ein Kampf pro Region kostet
- `measure-dps` — baut echten `Player` pro Level, rüstet aus, misst Output
- `reprice-enemies` — schreibt abgeleitete Bestiarium-Literale neu, wenn eine Kurve wandert
- `check-npc-schedules` — Ashvale-Bewohner bleiben in der Stadt, auch über Mitternacht
- `check-casino` — Gilded-Spade-Innenraum: Bodenmaterial, Erreichbarkeit jeder Station per
  Flood-Fill mit Prop-Kollision, keine sich überlappenden Kollisionsboxen, Animationsphasen
  nie im Gleichtakt, Slot-Paytable vollständig und nach Auszahlung sortiert
- `check-legacy-mechanics.mjs` / `check-legacy-art.mjs` — **Parität gegen Git `d39d75a`**
  (Vor-Expansion): Loot, Forging, Crown-Upgrades, Life Siphon, Arrow Rain, Original-Boss-
  Angriffe, 196 Tile-Varianten + 48 Wall-Faces + 8 Masken.
- `check-primordial` / `check-island-integration` / `check-endgame-reforge` — der
  Endgame-Block aus PR #9 (Primordial-Vorsprung, Asterion, Reforge jenseits Level 75)
- `check-aegean-world` — Weltgeometrie **und** die eingefrorene Westwelt (siehe oben)
- 15 × `check-aegean-*`

`scripts/check-aegean.mjs` bündelt jedes Check-Skript mit esbuild und startet es seriell als
eigenen Node-Prozess (60 s Timeout, ein schwerer Job zur Zeit — für einen 8-GB-Mac ausgelegt).

## Performance — bewusst so

Terrain in gecachten 16×16-Tile-Chunk-Canvases mit LRU-Cap. Props in 256-px-Spatial-Grid,
pro Frame gecullt. Gegner spawnen nur innerhalb ~860 px (`ACTIVATE_DIST`), despawnen ab
~1500 px (`DESPAWN_DIST`). Entfernte NPCs updaten reduziert. Lighting ist ein einziger
komponierter Offscreen-Buffer. Surf: 48-Chunk-Geometrie-Cache, kein Full-World-Canvas,
keine Per-Frame-Readbacks. Chest-Restock 900 s, Player-I-Frames 0,28 s,
Tag = 16 Spielminuten (`DAY_SECONDS`).

## Steuerung / Debug

`WASD` Bewegen · `Space` Angriff · `G` schwer · `F` Off-Hand (halten = blocken) · `R` Artefakt ·
`Q` Trank · `1`–`4` Fähigkeiten · `Shift` Dodge · `E` Interagieren · `B` Brace · `X` Ziel ·
`V` Waffenkraft. Menüs: `I`/`Tab` `C` `K` `J` `M` `N` `P`/`Esc` `F3`.
Zur See: `WASD` steuern · `Space` Salve · `G` Rammen · `Shift` Burst-Row · `E` Anlegen · `R` Deck.

**Debug-Menü: Charakter „debug" nennen** — **nur im DEV-Build** (seit 06.10., wegen Leaderboard; `Game.isDebug`
prüft `import.meta.env.DEV`), Button im Pause-Menü (`src/ui/DebugPanel.tsx` — Build, Spawning,
Weltkontrolle, Godmode, Timescale, Free Casting, One-Shot).

## Online: Leaderboard & Namensfilter (seit 06.10.)

- **Namensfilter** `src/game/names/nameFilter.ts` (`checkName`, `isNameBlocked`, `canonicalName`): 3–16 Zeichen,
  nur `A-Z 0-9 Leerzeichen _ -`. Daten `src/data/nameBlocklist.ts` sind **generiert** von
  `scripts/build-name-blocklist.mjs` (LDNOOBW 7 Sprachen + dsojevic + eigene DE/CH/Extremismus-Liste im Skript).
  HARD = Teilstring nach Normalisierung (Leetspeak, Homoglyphen, Trenner, gedehnte Buchstaben) mit Ausnahmen;
  SOFT = nur ganzes Wort. Begriffe/Ausnahmen im Skript ändern, nicht im Datenfile. Fehltreffer bewusst
  in Kauf genommen (User: „better safe than sorry“); `check-names` hält NPC-Namen + echte Vornamen frei.
- **Leaderboard-Server** `src/server/leaderboard.ts` (Logik, testbar) + `leaderboardRoute.ts` (Upstash REST).
  Deployt wird **`api/leaderboard.js` — generiert und eingecheckt** (`npm run build:api`), damit Vercel kein
  TS kompilieren muss. Nach jeder Änderung an `src/server/` oder dem Filter neu bauen; `check-leaderboard`
  schlägt sonst fehl. Env: `KV_REST_API_URL`/`KV_REST_API_TOKEN` (Upstash-Integration),
  `LEADERBOARD_ADMIN_TOKEN` (Admin: `reports`/`ban`/`ban-name`/`restore` per Header `x-admin-token`).
- **Speicher:** Upstash-REST (`KV_REST_API_*`) **oder** `REDIS_URL` (Vercel-Redis-Integration, normales
  Redis-Protokoll) — dafür `src/server/resp.ts`, ein Mini-RESP-Client (TCP/TLS, eine Pipeline je Request);
  `node-shim.d.ts` ersetzt `@types/node` (absichtlich nicht installiert).
- **Zweites Deployment (User, seit 06.10.):** Vercel-Team `ruben-f2c0`, Projekt `modulo-realms`,
  **https://modulo-realms-one.vercel.app** — dort läuft das Leaderboard (Redis `redis-cerulean-field`).
  **Nicht mit Git verbunden** (Repo gehört dem Kollegen) → Deploy per CLI aus dem Arbeitsbaum:
  `npx vercel deploy --prod --yes --token "$VERCEL_TOKEN" --scope ruben-f2c0`. Das Kollegen-Vercel
  deployt weiter automatisch den Default-Branch, hat aber keine DB (Leaderboard dort „offline“).
- **Client** `src/game/online/leaderboard.ts`: nur im PROD-Build, sendet aus `Game.autosave` nur bei neuem
  Level/Namen. Identität (UUID + Token) pro Charakter in localStorage `modulo-realms-online-v1` —
  **nicht im Save** (Save-Format unangetastet). Panel `LeaderboardPanel` (lazy) im Titel und Pausemenü.
- Anti-Cheat ist nur Erschwernis: Spielzeit-Mindestkurve `minPlaySeconds`, Spielzeit ≤ Wanduhr, Token,
  Rate-Limits, 3 Meldungen → versteckt. Der Spielstand liegt im Browser; fälschungssicher geht nicht.
- **Impressum/Datenschutz** `public/legal.html` (Link unten rechts im Titel). Betreiber = „Entwicklerteam“,
  Kontakt `modulorealms@gmail.com`. **Kein Name, keine Adresse** (User-Wunsch, ggf. später).

## Doku im Repo — Autoritätsreihenfolge

`README.md` (35 KB, aktuell, enthält "Extending the game" mit Rezepten für Item /
Enchantment / Gegner / NPC / Quest / Gebäude / Location / Region) ist die Einstiegslektüre.

`docs/aegean-expansion/` ist mehrschichtig und teils überholt. Gültigkeit in dieser
Reihenfolge: **`LIVING-MYTHS.md` > `REBUILD.md` > `RELEASE.md` > `CONTENT.md` / `DESIGN.md`.**
`CONTENT.md` und `DESIGN.md` sind ausdrücklich als historische Erstfassung markiert.
`review/` enthält 20 PNGs + ein WebM aus dem laufenden Spiel.

Die Verifikation der Expansion ist laut Doku ausdrücklich Mechanik- und
Kompatibilitätsprüfung, **kein Playthrough** — Langzeit-Pacing und Build-Balance über
Klassen hinweg sind ungetestet. Entsprechende Behauptungen nicht als belegt weitergeben.
