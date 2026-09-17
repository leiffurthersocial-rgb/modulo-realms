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
also makes it comfortable on an iPad with a keyboard case.

**Aiming is automatic.** You never point at anything. Attacks, spells and abilities lock onto
the nearest enemy, projectiles you fire curve toward whatever they are closest to, and
ground-targeted abilities land on the thickest cluster of enemies near you. A yellow reticle
shows what you are locked onto. A mouse still works if you want it, but nothing needs it.

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

Mouse, if you want it: left click attacks, right click blocks or makes a heavy attack.
Auto-aim stays on regardless; the mouse only takes over when there is nothing in range.

**How to play.** The pause menu carries a full in-game manual — the basics, fighting, loot and
gear, the valley, and getting stronger — with the key names read live from your actual bindings.
Nothing in the game is explained only once and then lost.

**Battery saver.** A toggle in Settings. It runs the whole loop at 30 frames a second instead of
60 — skipping the frame outright, which is what actually saves power — and drops the per-frame
work that costs the most on a tablet: the light buffer falls to half resolution and carries only
the player and placed lights, particle bursts are cut to a third, and ambient weather stops. The
world, the rules and the art are unchanged; it simply costs less to show them.

---

## The game

**The world.** One continuous 512×512-tile overworld (roughly 16,000×16,000 pixels) split
into five regions — the central Ashvale Valley, the frozen Crag Reach to the north, the
Sunken Mire east, Duneholt Reach south, and Thornhollow in the west. Roads, rivers and
bridges connect five settlements, seven dungeons and a couple of dozen landmarks, camps and
shrines. Stronger regions sit further from home, so the world gates itself by difficulty
rather than by walls.

**Ashvale.** The handcrafted home town, laid out as a ring rather than a sprawl. Every
building you can use — the forge, the trading post, the apothecary, the inn, the chapel and the
moot hall — faces the square within a few steps of the waystone, each with its own roofline, its
own trade sign, and a **lit name plate over the door** that you can read from the middle of
town. Stand by the waystone and you can see where everything is without trying a single handle.
Your house, the farm and the gatehouse sit just off the square; NPCs keep daily schedules and
move between work, the tavern and home as the clock runs.

**Doors that open, and doors that don't.** Every building with something inside it looks like
itself — the forge looks like a forge, the chapel like a chapel. Everything else is the same
**shuttered townhouse**: grey timber, boarded door, closed shutters, one silhouette repeated
across the valley. Check one, and you never have to check another. Every settlement also has a
**lodge** in its regional style, with a bed and the same storage chest as your home, so the
outposts are real forward bases.

**Lighting.** Building interiors are at full brightness. Darkness is reserved for dungeons,
crypts, caves and towers, where it means something.

**Quests, or the lack of them.** There is exactly one tutorial quest — *Somewhere to Start*,
which asks you to find a cave — and after that the world is yours. Everything else is a
**bounty**: it offers itself the moment you discover the place it concerns and pays out the
instant you finish it. Nothing queues at an NPC, nobody asks you to fetch nine boar hides, and
no quest log ever fills up with errands. Talk to the people who sell things, ignore the rest,
go where you like.

**Combat.** Real-time, with dodge rolls, blocking, telegraphed enemy attacks, status effects
(burning, poison, chill, stun, bleed) and knockback. Bosses run multi-phase fights with
readable wind-ups, summons and arena-wide attacks.

**Progression.** Experience from combat, quests, exploration and dungeon clears; levels grant
stats and a skill point; each class has three talent branches and four abilities.

**Retraining.** Any class can become any other class for **100 gold**, from the skills panel.
Retraining swaps your stat block and ability set, hands you that class's level-one kit, and
**refunds every skill point you have ever spent** so you can rebuild from scratch. There is no
penalty and no cooldown — trying a build should be cheap.

**No gear restrictions.** Every class can equip every weapon, and there are no level
requirements on anything. If you found it, you can swing it.

**Kill streaks.** Chain kills within four seconds and the streak climbs. Each tier pays more
experience (up to +60%), flashes the screen, rings out around you and escalates the sound. The
timer drains on screen, so there is always a reason to push for one more kill instead of
backing off.

**Loot that announces itself.** Anything above Rare detonates where it drops — a ring, a burst
of its rarity colour, and a beam of light standing over it that you can see across a room.
Epic and Legendary drops also freeze the frame, shake the screen and flash it in their colour.

**Waystones.** Every settlement and every dungeon mouth has a stone gate with a blue vortex.
Touch one to attune it, and from then on any gate can carry you to any other — from the
travel panel or by clicking the marker on the world map. A gate will not answer within **three
seconds of taking damage**, so fast travel is a way to cross the valley, not a way out of a
fight you are losing. The travel panel shows the countdown.

**Wandering traders.** A family of dwarven smiths follows the waystone network; one of them
has a cart parked at every major point of interest, so there is always somewhere to sell loot
and buy something better.

**Merchants scale with the ground they stand on.** What a shop stocks is set by the danger of
its region and its distance from home, not by a fixed list. The stall in Ashvale sells
level-5 commons; the cart parked at the mouth of the Barrow Crypt sells level-15 epics, and
carries more slots besides. Stock also re-rolls as you level, so a merchant you outgrew is
worth visiting again. If you want better gear to buy, walk somewhere worse.

**King Jovan.** The king keeps court in the Ashvale moot hall, and he is worth the walk twice
over. He runs **the Royal Armoury** — the best-stocked shop in the valley, sold at a loss
because his answer to every problem is to hand it money and a sword. And he keeps a tally of
everything you have put down: one **crown warrant** per boss felled. Spend a warrant on
anything you carry and he has it remade **one rarity grade finer**, with an extra enchantment
slot and fresh rolls. It is the only way to push gear you chose up to Legendary instead of
waiting for the drop you wanted.

**Selling and dropping.** Anything in the pack can be sold on the spot for **half what a merchant
would pay** — convenience, not commerce, so clearing junk on the road is always an option and
hauling the good pieces back to a shop is always worth the walk. **Sell junk** clears every common
and rare piece of gear in one press and never touches anything SuperRare or better, or your
potions, materials and quest items. Dropping throws an item clear of you and leaves it inert until
you have walked away from it, so the pickup magnet cannot suck it straight back in.

**Saving.** The game autosaves on a timer and at transitions, and always on quitting to the
title screen. Continue from the title screen picks up where you left off.

---

## Gear, rarity and enchantments

### Weapon families

Twenty weapon kinds, each with its own silhouette, in-hand art and icon: swords and
greatswords, axes and greataxes, hammers, maces, daggers, spears, **rapiers** (fast, crit-led),
**flails** (a chained head that comes round late and hits hard), **halberds** (reach and sweep),
**war picks** (armour-breakers that pay out on a crit), bows, crossbows, staves, wands, tomes,
**orbs** (caged focus stones that hover and strike at range), scythes and claws. Every class can
use every one of them.

Each kind carries its own reach, swing rate and **swing arc**: a greatsword, greataxe, halberd or
scythe cuts a wide sweep through a rank, while a dagger or a rapier is a thrust that only touches
what it is pointed at. Bows, crossbows and casting weapons fire a projectile whose flight is
exactly the weapon's listed range — auto-aim never locks onto something further than the shot can
actually reach, and a shot crosses the whole visible screen.

**Every weapon is priced off one DPS budget**, so no kind is quietly the right answer. A weapon's
damage is solved from its own attack speed against a target set by its level and rarity, which is
why a maul hits for three times a rapier's swing and lands a third as often. Melee is the yardstick
at 1.0; a **sweeping** kind takes 0.92 of it and gets the rank it cuts through instead; a **thrust**
takes 1.05 for being single-target. **Ranged pays for its reach at 0.70**, and **magic sits at
0.78** because its bolts splash. Standing in danger is what you get paid for.

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
inventory slot borders, the drop glow, and the name that floats up when you collect something:

| Rarity | Colour | Enchantment slots | Rolls from loot? |
| --- | --- | --- | --- |
| Common | White | 0 | yes |
| Rare | Green | 1 | yes |
| Super Rare | Blue | 1 | yes |
| Epic | Purple | 2 | yes |
| Legendary | Yellow / gold | 3 | yes |
| Mythic | Crimson, animated | 3 | **no** |

`Mythic` is placed by hand and nothing else can reach it: its weight in `RARITY_WEIGHTS` is
zero, `rollRarity` draws from `ROLLABLE_RARITIES` which excludes it, and `canElevate` stops the
crown's warrant at Legendary. Two weapons in the game carry it — the Leviathan Axe and the
Blades of Chaos — and its name is drawn with an animated gradient rather than a flat colour, so
it does not read as "a slightly different legendary".

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

### The balance curves — read this first

`src/data/balance.ts` is the single source of truth for how strong anything is, and almost all
of the extension points below are wired into it. It holds:

| Export | What it decides |
| --- | --- |
| `meleeDpsAt(level)` | The damage-per-second every **weapon** is priced against — what keeps weapons honest against each other |
| `playerDpsAt(level)` | The damage-per-second the player **actually deals**, which is what every **enemy** is priced against |
| `TIME_TO_KILL` | How many seconds a fight of each role should last. This is the difficulty dial |
| `CLASS_POWER` / `SHAPE_POWER` | What ranged and magic pay for reach, and what a sweeping weapon pays for its arc |
| `weaponDamage(kind, level, rarity, speed)` | Damage per swing, solved from the above |
| `armorDefenseAt(level, rarity)` | The armour curve |
| `enemyHealthAt/DamageAt/DefenseAt/XpAt(level, role)` | The bestiary curves, by role |
| `ENEMY_THREAT` | The only things not solved by a curve: how hard a hit lands, and what a kill pays |
| `LEVEL_BANDS` | Which region is built for which levels |
| `ENDGAME_LEVEL` | The level the game is built to be finished at |

This is what makes adding content safe rather than a guess. You never write a damage number,
so you cannot accidentally author a level-13 rapier worth twice a level-13 maul. To check a
change, run:

```bash
npx tsx scripts/check-balance.ts
```

It prints every weapon, suit of armour and enemy as a multiple of its budget — and, for each
enemy, how many seconds the fight it implies actually takes. Everything should read `x1.00`.

**Two DPS curves, and they are not interchangeable.** `meleeDpsAt` is what a weapon's own
damage number is priced against, so that sixty weapons stay comparable to each other.
`playerDpsAt` is what the player really puts out, and it is a different shape: `attackPower()`
is `weaponDamage * (1 + primaryStat * 0.022)`, and both of those grow with level, so real
damage grows quadratically. Measured against a dummy, the real number is 1.6x the weapon curve
at level 5, 6.7x at 17 and 37x at 34. Enemy health priced against the weapon curve is therefore
correct at low level and meaningless at high level — which is exactly how a five-phase boss once
ended up dying in three and a half seconds. Enemies are priced against `playerDpsAt` and
`TIME_TO_KILL`; weapons are priced against `meleeDpsAt`. Do not mix them up.

### Add an item

`src/data/items.ts`. Use the `W` (weapon), `A` (armour) or `ART` (artifact) helpers, or write
the object out for anything unusual:

```ts
// id, name, kind, LEVEL, attacks per second, reach in pixels
W('sword_ember', 'Emberbrand', 'sword', 9, 1.3, 52, {
  metal: PAL.flame,
  glow: PAL.ember,
  rarity: 'superRare',
  stats: { strength: 4, critChance: 4 },
  fixedEnchants: [{ id: 'fire_aspect', level: 1 }],
})
```

There is deliberately no damage argument — it is solved from the level, the rarity and the
swing speed. Armour works the same way: `A(id, name, level, weight, look, extra)`, where
`weight` is one of `ROBE`, `LIGHT`, `MAIL` or `PLATE`.

One trap worth knowing: in both helpers `...extra` is spread **before** `stats`. Spread after,
an `extra.stats` object replaces the whole merged block and silently strips the speed, reach
and damage off the item.

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
picks a `creature` kind and palette. Decide its level and its **role** — `skirmisher`,
`standard`, `brute`, `elite` or `boss` — and take its health, damage, defense and xp from the
curves rather than inventing them:

```ts
// a level-24 brute
health: enemyHealthAt(24, 'brute'),   // 1317
damage: enemyDamageAt(24, 'brute'),   // 78
defense: enemyDefenseAt(24, 'brute'), // 58
xp: enemyXpAt(24, 'brute'),           // 562
```

Then reference the id from a region spawn table in `worldgen.ts` or a dungeon's `enemies` list
in `src/data/locations.ts`, and run `check-balance.ts`.

Bosses add a `boss` block: `phases` (each with the health fraction that triggers it, a speed
and damage multiplier, a shout and an optional arena hazard) and `attacks` (each with a
`shape` — `circle`, `cone`, `line`, `ring`, `projectile`, `summon`, `dash` or `rain` — a
telegraph `windup`, a `cooldown`, a `power` multiplier, and an optional `phase` it unlocks at).
Everything about a boss fight is data; `src/game/entities/enemy.ts` reads it and does not need
touching. Aldrhrim at the Last Gate is five phases and eleven attacks and is still only a data
entry.

Three optional fields make a boss one that never becomes easy, and they exist because the
player's real damage grows *quadratically* (see below) while any fixed pool of health does not:

| Field | What it does |
| --- | --- |
| `boss.hitCap` | The most a single blow may remove, as a share of the boss's health. `0.0125` means at least 80 connecting hits, at any level, with any weapon. Capped hits float **Warded**. |
| `attack.lifeTax` | A share of the player's *maximum* health, dealt on top of the hit and ignoring armour. Stacking defense never makes this attack safe; a dodge roll still avoids it. |
| `boss.enrageAfter` / `enrageRate` | After N seconds its damage climbs by that fraction per second, without limit. Outlasting it is not a strategy. |

Use them sparingly — on the handful of fights that are supposed to stay frightening forever.

### Add an NPC

`src/data/npcs.ts`. Give them a map, tile coordinates, a `look`, greeting lines (with optional
race/class/reputation conditions), conversation `topics` and `nodes`, and optionally a `shop`,
a `schedule` and a list of `quests`. Quest offers, hand-ins, shops and services are injected
into the conversation automatically.

### Add a quest

`src/data/quests.ts`. Objectives can be `kill`, `collect`, `talk`, `explore`, `clear`, `boss`
or `interact`; rewards can include XP, gold, fixed items, a random loot roll at a given level
and rarity, and reputation. `marker` points the map, minimap and compass at a location when the
player tracks it.

Set `auto: true` and the quest becomes a **bounty**: it accepts itself the moment the player
discovers its `marker` location and turns itself in the instant its objectives complete, with
no NPC involved. Prefer this. Only use `giver` / `turnIn` for something that genuinely needs a
conversation — the design goal is an open world, not a queue of errands.

### Add a decorative building

`src/game/world/village.ts` (`ASHVALE_TOWNHOUSES`) or the `filler` list in
`src/game/world/settlements.ts`. Add a tile coordinate and you get another shuttered
townhouse with no interior. Always use the `townhouse` art for these — the uniform silhouette
is the contract that tells the player which doors are worth trying.

### Add a location or dungeon

`src/data/locations.ts`. A `dungeon` block gives it a generated interior — theme, room count,
enemy list, optional boss and miniboss — and `worldgen.ts` will place its entrance, braziers,
signpost and waystone automatically. Add a road to it in `generateOverworld`'s `road(...)` list
so it joins the network, and `ensureConnectivity` guarantees the player can physically walk
there whatever the noise generated.

New dungeon themes are one line in `THEMES` in `src/game/world/dungeons.ts`: floor tile, wall
tile, prop list, light source and darkness.

### Add a region

Six steps, all data:

1. `src/data/balance.ts` — add the region and its level band to `LEVEL_BANDS`, and raise
   `ENDGAME_LEVEL` if it extends the game.
2. `src/data/locations.ts` — add it to `RegionId` and to `REGIONS` with the next free `index`.
   The `index` must match the `REGION_*` constant you add in step 3.
3. `src/game/world/worldgen.ts` — add `export const REGION_YOURS = <index>`, return it from
   `regionAt` for the ground it owns, give it a `case` in `baseTerrain` (its biome), in
   `scatterProps` (its scenery) and in `regionGround` (what water is filled in with), and add
   a `REGION_SPAWNS` entry.
4. `src/data/locations.ts` again — place its settlements, dungeons, camps and landmarks.
5. `src/game/world/worldgen.ts` — one `road(...)` line in, and a few onward.
6. `src/data/npcs.ts` — somebody who lives there, and somebody further south who hints at it.

The Jotunreach (`deepnorth`) was added exactly this way and is worth reading as a worked
example. Note that the world is 512 tiles wide and 704 tall — it grew northward rather than
outward, so it is not square, and anything that draws the whole map reads `map.w`/`map.h`
rather than assuming one number.

---

## Notes on assets and inspiration

The game takes high-level inspiration from open-world and action-RPG design — the sense of
place of a large explorable world, the loot-and-enchant loop of dungeon crawlers, and the
warmth of top-down life sims — but every asset here is original and generated by the code in
this repository. No sprites, textures, maps, music, dialogue or names were taken from any
existing game.
