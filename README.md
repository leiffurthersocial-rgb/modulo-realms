# Modulo: Realms of Ash

A 2D open-world pixel-art fantasy RPG that runs entirely in the browser. Make a character,
walk out of Ashvale, and find out what the valley is being divided by.

Everything in the game — every tile, sprite, building, item icon, sound effect and music
track — is generated procedurally at runtime from code in this repository. There are no
binary art or audio assets, and nothing is copied from any existing game.

---

## Table of contents

- [Running it](#running-it)
- [Deploying to Vercel](#deploying-to-vercel)
- [Controls](#controls)
- [The game](#the-game)
- [Gear, rarity and enchantments](#gear-rarity-and-enchantments)
- [Architecture](#architecture)
- [Extending the game](#extending-the-game)

---

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
```

Production build and local preview:

```bash
npm run build    # typechecks, then builds to dist/
npm run preview
```

`npm run typecheck` runs TypeScript on its own.

Requirements: Node 18+ and any modern browser with Canvas 2D and Web Audio.

## Deploying to Vercel

The repository is already configured (`vercel.json`), so no dashboard changes are needed.

1. Push this repository to GitHub.
2. In Vercel, **Add New Project** and import the repository.
3. Accept the detected settings — framework **Vite**, build `npm run build`, output `dist`.
4. Deploy.

Or from the CLI:

```bash
npx vercel --prod
```

The game is a fully static SPA; `vercel.json` rewrites all routes to `/` so deep links work.
Saves live in the visitor's own `localStorage`, so there is no backend and no database.

---

## Controls

The game is built to be **fully playable with a keyboard alone** — no mouse required, which
also makes it comfortable on an iPad with a keyboard case. A mouse is supported but optional;
when you have not moved the mouse recently, attacks aim where you are facing and softly lock
onto the nearest enemy in front of you.

### Movement and combat

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` / arrow keys | Move |
| `Space` | Attack with your main-hand weapon |
| `G` | Heavy attack (slower, harder, costs stamina) |
| `F` | Off-hand: hold to block with a shield, or tap to use a tome/brand. With no off-hand it drinks a potion |
| `R` | Activate your artifact's power |
| `Q` | Drink the bound quick potion |
| `1` `2` `3` `4` | Class abilities |
| `Shift` | Dodge roll (brief invulnerability, costs stamina) |
| `E` | Interact: talk, open, enter, use a waystone |

### Menus

| Key | Panel |
| --- | --- |
| `I` / `Tab` | Pack (inventory and equipment) |
| `C` | Character sheet and reputation |
| `K` | Skills and abilities |
| `J` | Journal (quests) |
| `M` | World map |
| `N` | Toggle the minimap |
| `P` / `Esc` | Pause menu |
| `F3` | Debug overlay |

Mouse, if you want it: left click attacks, right click blocks or makes a heavy attack, and
moving the mouse takes over aiming for a moment or two.

---

## The game

**The world.** One continuous 384×384-tile overworld (roughly 12,000×12,000 pixels) split
into five regions — the central Ashvale Valley, the frozen Crag Reach to the north, the
Sunken Mire east, Duneholt Reach south, and Thornhollow in the west. Roads, rivers and
bridges connect five settlements, seven dungeons and a couple of dozen landmarks, camps and
shrines. Stronger regions sit further from home, so the world gates itself by difficulty
rather than by walls.

**Ashvale.** The handcrafted home town: your house with a bed and a storage chest, a forge,
a trading post, an apothecary, an inn, a moot hall, a chapel, a farm and a scatter of
cottages — each with an interior you can walk into. NPCs keep daily schedules and move
between work, the tavern and home as the clock runs.

**Combat.** Real-time, with dodge rolls, blocking, telegraphed enemy attacks, status effects
(burning, poison, chill, stun, bleed) and knockback. Bosses run multi-phase fights with
readable wind-ups, summons and arena-wide attacks.

**Progression.** Experience from combat, quests, exploration and dungeon clears; levels grant
stats and a skill point; each class has three talent branches and four abilities.

**Waystones.** Every settlement and every dungeon mouth has a stone gate with a blue vortex.
Touch one to attune it, and from then on any gate can carry you to any other — from the
travel panel or by clicking the marker on the world map.

**Wandering traders.** A family of dwarven smiths follows the waystone network; one of them
has a cart parked at every major point of interest, so there is always somewhere to sell loot
and buy something better.

**Saving.** The game autosaves on a timer and at transitions, and always on quitting to the
title screen. Continue from the title screen picks up where you left off.

---

## Gear, rarity and enchantments

### Slots

Four slots, kept deliberately simple:

| Slot | Holds |
| --- | --- |
| **Weapon** | The thing you swing, shoot or cast with |
| **Off Hand** | Shield (block), tome (bolt), brand (fire pool) |
| **Armour** | One piece covering the whole outfit — it changes how your character looks |
| **Artifact** | An activated power on `R`, in the Minecraft Dungeons sense |

Equipped weapons, off-hands and armour all show on the player sprite: the weapon is drawn in
hand and swings with the attack animation, and armour changes the body, helmet, cape and
colour of the character.

### Rarity

Rarity is readable from colour alone, everywhere it appears — item names, tooltip pills,
inventory slot borders and the drop glow:

| Rarity | Colour | Enchantment slots |
| --- | --- | --- |
| Common | White | 0 |
| Rare | Green | 1 |
| Super Rare | Blue | 1 |
| Epic | Purple | 2 |
| Legendary | Yellow / gold | 3 |

### Enchantments

Enchantments are the extensible layer on top of stats. They live in
[`src/game/items/enchants.ts`](src/game/items/enchants.ts) and are pure data — adding one is a
single entry in the `ENCHANTS` array.

Each definition declares:

```ts
{
  id: 'fire_aspect',
  name: 'Fire Aspect',
  desc: '{v}% chance to set the target burning.',
  host: ['melee', 'ranged'],  // which families of gear may host it
  group: 'element',           // exclusivity group
  maxLevel: 3,
  minRarity: 'rare',          // rarity gate
  weight: 11,
  color: PAL.flame,
  power: [18, 28, 40],        // value per level
  stat: { key: 'critChance', per: 5 },  // optional flat stat contribution
}
```

Three rules keep the rolls sensible:

1. **Host families.** Every item resolves to exactly one family — `melee`, `ranged`, `magic`,
   `armor` or `artifact` — from its type and weapon kind. A bow can roll Multishot and
   Piercing; a sword never will. An enchantment may also narrow further with `weapons`, which
   is how Shockwave is restricted to hammers, mauls, greataxes and greatswords.
2. **Exclusivity groups.** Only one enchantment from a group can sit on an item. `element`
   covers Fire Aspect, Freezing, Venomous, Ember Focus and Frost Focus, so a blade is *either*
   burning *or* freezing — never both. `shot` covers Multishot, Piercing and Chain Reaction.
3. **Rarity gates.** `minRarity` is the floor. Common gear has no slots at all, Rare and Super
   Rare have one, Epic two, Legendary three — and higher rarity also rolls higher levels, so
   the best enchantments only show up on the best drops.

Implemented enchantments include Sharpness, Fire Aspect, Freezing, Venomous, Leeching,
Looting, Critical Hit, Swirling, Shockwave, Chains, Committed, Multishot, Piercing, Chain
Reaction, Power, Growing, Arcane Surge, Soul Siphon, Ember Focus, Frost Focus, Void Strike,
Protection, Life Boost, Thorns, Swiftfooted, Cooling, Deflect, Final Shout, Potency and
Refreshment.

**Rebinding.** At any anvil you can spend a Binding Rune and gold to discard an item's rolled
enchantments and draw new ones from its pool, keeping any enchantments the item was designed
with. The same panel reforges gear a level higher for iron ingots.

**Where it goes next.** The data model already carries everything a full enchanting table
would need — `enchantSlots` is per item, `enchants` is an ordered list of `{ id, level }`, and
`candidateEnchants()` answers "what could legally go here?" for any item. A future table that
lets the player *choose* one of three offered enchantments per empty slot, Minecraft Dungeons
style, only needs UI: the rules, pools and gates are already enforced in one place.

### Relics

Some legendaries are region-locked. The **Leviathan Axe** and the **Blades of Chaos** are
found only in the frozen north; `rollLoot()` takes the region the roll happened in and will
only offer a relic inside its own region.

---

## Architecture

```
src/
  main.tsx            entry point
  App.tsx             canvas, game loop, screen routing, UI mounting
  game/
    core/
      game.ts         the Game class: state, update loop, combat, interactions, travel
      renderer.ts     canvas rendering: chunked terrain, y-sorted actors, lighting, minimap
      input.ts        key bindings, edge detection, mouse
      math.ts rng.ts  vectors, damping, seeded RNG, value noise, fbm
      world.ts        the interface entities use to talk to the game
    art/              every pixel in the game is drawn here, at runtime
      palette.ts      the shared 48-colour palette
      pixel.ts        the tiny pixel-drawing surface everything else is built on
      tileset.ts      terrain textures with blend masks and wall faces
      props.ts        trees, rocks, furniture, torches, waystones, chests
      buildings.ts    parameterised houses, forges, inns, towers
      characters.ts   the humanoid sprite generator (races, armour, weapons, animation)
      creatures.ts    non-humanoid enemies
      weaponart.ts    weapons, drawn in hand and as icons
      icons.ts        inventory icons
    world/
      tiles.ts        tile table (solidity, speed, blending, minimap colour)
      map.ts          GameMap, prop grid, collision helpers
      worldgen.ts     regions, terrain, rivers, roads, scatter, spawns, treasure
      village.ts      handcrafted Ashvale
      settlements.ts  the four outlying settlements
      interiors.ts    building interiors
      dungeons.ts     procedural dungeon layouts
    entities/         entity base, enemy AI and boss logic, NPC schedules
    combat/           projectiles, particles, floating text, telegraphs
    items/            item types, enchantments, effects, loot rolls, inventory rules
    player/player.ts  the player: derived stats, equipment, look, levelling
    quests/           quest log and objective tracking
    dialogue/         dialogue types and the conditional runtime
    save/save.ts      localStorage persistence
    audio/audio.ts    synthesised music and sound effects
  data/               pure content: races, classes, items, enemies, npcs, quests, locations
  ui/                 React panels (HUD, inventory, map, journal, shop, forge, travel, ...)
  styles/global.css   the UI design system
```

Two deliberate separations keep things fast and maintainable:

- **Simulation is not React.** The game loop mutates plain objects and draws to a canvas.
  React only renders UI, and subscribes through `useSyncExternalStore` on a version counter
  that the game bumps when something UI-visible changes. The HUD ticks on its own small
  interval rather than per frame.
- **Content is not logic.** Everything in `src/data/` is data. Adding a sword, an enemy, a
  quest or a village does not require touching the systems that consume them.

Performance notes: terrain is rendered into cached 16×16-tile chunk canvases with an LRU cap;
props live in a 256px spatial grid and are culled per frame; enemies spawn from spawn points
only within ~860px of the player and despawn past ~1500px; distant NPCs update at a reduced
rate; lighting is a single composited offscreen buffer.

---

## Extending the game

### Add an item

`src/data/items.ts`. Use the `W` (weapon), `A` (armour) or `ART` (artifact) helpers, or write
the object out for anything unusual:

```ts
W('sword_ember', 'Emberbrand', 'sword', 9, 24, 1.3, 52, {
  metal: PAL.flame,
  glow: PAL.ember,
  rarity: 'superRare',
  stats: { strength: 4, critChance: 4 },
  fixedEnchants: [{ id: 'fire_aspect', level: 1 }],
})
```

Anything not marked `noDrop` joins the random loot tables automatically; add `regions: ['north']`
to lock it to one region.

### Add an enchantment

One entry in `ENCHANTS` in `src/game/items/enchants.ts`. Pick a `host` family, a `group` if it
should be mutually exclusive with others, a `minRarity`, and `power` values per level. If it
maps cleanly onto a stat, add `stat` and it is applied automatically; if it needs behaviour,
read it in `Game.applyHitEffects`, `Game.killEnemy` or `Game.damagePlayer` with
`player.enchantPower('your_id')`.

### Add an enemy

`src/data/enemies.ts`. Humanoids reuse the character generator via `look`; everything else
picks a `creature` kind and palette. Bosses add a `boss` block with phases and telegraphed
attacks. Then reference the id from a region spawn table in `worldgen.ts` or a dungeon's
`enemies` list in `src/data/locations.ts`.

### Add an NPC

`src/data/npcs.ts`. Give them a map, tile coordinates, a `look`, greeting lines (with optional
race/class/reputation conditions), conversation `topics` and `nodes`, and optionally a `shop`,
a `schedule` and a list of `quests`. Quest offers, hand-ins, shops and services are injected
into the conversation automatically.

### Add a quest

`src/data/quests.ts`. Objectives can be `kill`, `collect`, `talk`, `explore`, `clear`, `boss`
or `interact`; rewards can include XP, gold, fixed items, a random loot roll at a given level
and rarity, and reputation. Set `giver` and `turnIn` to NPC ids and the dialogue system does
the rest. `marker` points the map, minimap and compass at a location when the player tracks it.

### Add a location or dungeon

`src/data/locations.ts`. A `dungeon` block gives it a generated interior — theme, room count,
enemy list, optional boss and miniboss — and `worldgen.ts` will place its entrance, braziers,
signpost and waystone automatically.

---

## Notes on assets and inspiration

The game takes high-level inspiration from open-world and action-RPG design — the sense of
place of a large explorable world, the loot-and-enchant loop of dungeon crawlers, and the
warmth of top-down life sims — but every asset here is original and generated by the code in
this repository. No sprites, textures, maps, music, dialogue or names were taken from any
existing game.
