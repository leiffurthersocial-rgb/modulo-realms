# The Aegean Oath — implementation and verification plan

**Original engineering plan. See [RELEASE.md](RELEASE.md) for delivered behavior and executed checks. Audited base: `d39d75af0723a6b13f4683c50ded7701404e9674`, 19 September 2026.**

The [design](DESIGN.md) is the product specification. This document preserves the pre-implementation audit, engineering approach, and acceptance criteria. Baseline findings and proposed paths describe the code before the expansion; the release guide is the current implementation record.

## 1. Verified baseline and blockers

The README is useful context but is not authoritative for current counts, item availability, or progression. These findings were checked against source on the current remote development branch.

| Verified fact | Evidence in this checkout | Required response |
| --- | --- | --- |
| World is 960×1088, Ashvale at (480,448), tile size 32 px. | `src/data/locations.ts:78–81`; `src/game/world/tiles.ts:169` | Append exactly 960 columns east. Preserve old coordinates. |
| World generation changes border mountains using world width and consumes shared random draws across tile scenery, towns, spawns, and chests. | `src/game/world/worldgen.ts:111–114,356–365,1034,1135–1157` | Freeze legacy bounds, inputs, and RNG order. Widening a constant alone is unsafe. |
| Old spawn and chest IDs are ordinal. | `worldgen.ts:729–765,808–825` | Keep their identities unchanged; give new content namespaced stable IDs. |
| Roads connect every settlement to Ashvale; connectivity repairs bridge water to disconnected pockets and named locations. | `worldgen.ts:873–1014,1055–1059` | Separate landmass reachability from sea routes. Never bridge Greek islands automatically. |
| All ordinary towns/villages/dungeons/caves become waystone sites and discovery auto-attunes them. | `src/data/locations.ts:269–271`; `src/game/core/game.ts:4331–4332` | Explicit travel policies for every Greek location. |
| Portal data has a lock field, but the portal interaction does not enforce it. | `src/game/world/map.ts:45`; `game.ts:3755–3760` | Central access checks at every transition, including load recovery. |
| Water is solid to current land movement; spawning uses ground placement. | `src/game/world/tiles.ts:98–99`; `game.ts:4013–4024,4111` | Add movement and spawn profiles for ships and sea creatures. |
| Generic dungeon generator uses a common rooms/corridors scheme, maximum 84×84. | `src/game/world/dungeons.ts:59–143` | Add custom generators and encounter controllers. Themes alone cannot deliver the Labours. |
| Six classes, four equipment slots, no level or class equipment restrictions; cap75. | `src/data/classes.ts:4`; `src/game/items/types.ts:57–58`; `src/game/items/inventory.ts:57–64`; `src/game/player/player.ts:49–50` | Preserve build freedom; enforce progression through access and earned proofs. |
| Original talent budget is approximately120 at 75 against162 tree capacity. | `classes.ts:74–95`; `player.ts:78–87` | Stop ordinary points at 75; implement the separate five-choice mastery system. |
| Reforging multiplies important stats by1.11 repeatedly; its cap is player level+15. | `game.ts:3379–3398,3466–3486` | Correct versioned releveling before balancing level 100. |
| Mythic is beyond generic loot rolls; Crown promotion stops at Legendary. | `src/game/items/types.ts:16–21`; `src/game/items/loot.ts:80–84,108–111`; `game.ts:3661–3668` | Preserve that boundary; add authored Olympian/Primordial sources explicitly. |
| Boss preview/impact geometry can disagree; line attacks lack a resolver; lifeTax currently passes through ordinary armour reduction. | `src/game/entities/enemy.ts:306–310,390–480`; `src/data/enemies.ts:16,35–42`; `game.ts:993` | Fix attack intents and explicit damage channels before creating a precision apex fight. |
| A hit cap applies separately to each damage event. | `game.ts:736–748` | Validate multi-hit/proc builds; do not use small hit caps as the main difficulty mechanism. |
| Dungeon resets delete boss/clear sets and per-map everKilled state. | `game.ts:3586–3600,3626–3640` | Add immutable lifetime feats; reconstruct only what old saves can prove. |
| All spawns are scanned each update and enemy separation scans all enemies. | `game.ts:4095–4134`; `enemy.ts:177–188` | Spatial indices and an army director before large battles. |
| Saves are v1, regenerate maps from seed, and silently ignore write failure. | `src/game/save/save.ts:26–29,128–152` | Versioned migration, retained backup, explicit save result, durable reward claims. |

Two current boss references show why scale alone is insufficient: The Remainder already has six phases (`enemies.ts:1416–1457`), and The Floor of the World already has five phases, a hit cap, and enrage (`1522–1546`). The new distinction must be naval travel, environment objectives, formations, and deliberate attack sequencing.

## 2. Architecture decisions

### World generation

Keep a legacy generator with fixed 960×1088 bounds and a frozen legacy location/region collection. Generate that territory with the same calls in the same order. Allocate the 1920×1088 surface, copy each legacy row into its new stride, then append Greek data. Discard large temporary arrays between passes where possible.

Greek generation uses authored mainland/island masks, river and mountain paths, dock approaches, and bounded seeded variation. Its random streams are independent: `seed/aegean/terrain/v1`, `seed/aegean/island/<id>`, `seed/aegean/encounter/<id>`. Do not interleave new random draws into the legacy generator.

Preserve all old spawn/chest/portal IDs and coordinates. New IDs encode content identity, for example `aegean:nemea:lion:boss`, `aegean:army:crown:hoplite:07`. Greek additions never renumber old `s42` or `wchest17` objects.

Connectivity groups: legacy land, Greek mainland, each island separately, and each dungeon floor. Validate foot routes within a group and sailing routes between dock nodes. The only old-tile modifications are the declared eastern pass masks; tests compare every other old tile. Asterion's ocean moat and storm route are authored constraints that procedural noise cannot erase.

Proposed modules: `src/game/world/legacyWorldgen.ts`, `aegeanWorldgen.ts`, `coastGeometry.ts`, `navigation.ts`; data under `src/data/aegean/regions.ts`, `locations.ts`, `islands.ts`.

### Movement, ships, and travel

Introduce `MovementProfile = foot | ship | swimmer | flying`, plus collision footprint and draft for vessels. Reuse spatial queries, not the assumption that every entity wants dry ground. A ship has its own position/velocity/heading; a dock transition atomically moves player and vessel state. Boarding deck maps are linked to the voyage encounter and return safely to the same sea position.

Precompute a compact offshore-distance field from connected mainland coast. Use explicit storm overrides and sheltered harbour masks. Save deterministic voyage seed/time segment; loading cannot reroll the mandatory storm into calm water. Spawn sea monsters from water-valid cells in nearby buckets, not from all ocean tiles every frame.

Centralize `canAccess(destination, transitionMode, playerState)` with structured failure reasons. Call it from waystones, world-map clicks, portals, ferries, docking, scripted travel, respawn, and save loading. Access types include ordinary waystone, port, local checkpoint, ritual gate, and encounter-only. Asterion never receives an ordinary waystone. Movement powers, projectiles, knockback, and summons cannot transfer the player across an access boundary.

Apply the same policy to vessel movement across the authored storm boundary from every direction. Departure-port checks alone are insufficient. The pre-victory boundary has an early visible warning and a safe outward turn; crossing cannot strand or repeatedly damage an ineligible player. The Mares' fortress and every required ship component remain outside this restricted area.

Proposed modules: `src/game/naval/ships.ts`, `voyage.ts`, `seaEncounters.ts`, `src/game/travel/access.ts` and dock definitions in `src/data/aegean/routes.ts`.

### Encounter runtime

Create an `EncounterController` with explicit states: dormant, introduction, active chapter/phase, checkpoint, failed, victory pending, completed. Controller owns its roster, bounded hazards, objectives, combat locks, entry/exit placement, and reward transaction. Each adventure supplies rules and layout; generic combat still supplies movement, damage, statuses, and input.

An `AttackIntent` stores chosen geometry at windup: origin, facing, target snapshot, radius/segments, impact positions/times, collision mask, damage components, and source identity. Both preview and impact consume that same intent. If an attack tracks before locking, the tracking indicator must visibly move and the lock moment must be clear. Implement line resolution and explicit direct/percentage/true-damage behaviour; avoid silently changing old attacks' lethality while correcting documentation.

Leonidas uses a tested sequence grammar with legal transitions and capped response choices. Scheduler rejects combinations with no reachable safe response for the reference slow build. Army controller persists all 300 roster identities and deploys at most36 hostile full-AI actors. Reserve visualizations have no independent damaging collision. Nearby separation and target selection use spatial buckets.

Labours expose their own completion rules. Defeating every creature cannot complete a river puzzle or capture trial. Environmental interactions are idempotent, available to all classes, and independent of having a particular item equipped. Scripted allies recover from pathfinding stalls without granting undeserved objective progress.

Proposed modules: `src/game/encounters/controller.ts`, `attackIntent.ts`, `hazardDirector.ts`, `army.ts`, `leonidas.ts`; bespoke builders/controllers grouped under `src/game/encounters/labours/` and `src/game/encounters/myths/`. Avoid growing `game.ts` into the sole home for every rule.

### Progression and equipment

Add permanent `earnedFeats`, distinct from current alive/dead world state. Freeze `legacyCompletionManifest` from the release immediately before the expansion. Use unique boss/enemy identities and authored dungeon IDs; do not demand multiple victories over a reused miniboss template unless they are distinct authored encounters. Show the actual checklist to the player.

Old saves can contain `killCounts`, completed bounties, retained unique rewards, and present boss/map state as evidence. Backfill feats only from reliable evidence. A previously reopened dungeon may have erased its clear history; do not claim perfect historical reconstruction. The migration screen identifies unverifiable entries. Provide a documented legacy reconciliation path using retained completion evidence; genuinely unprovable challenges may require a new clear. Future resets never remove earned feats.

Specifically, current boss victory sets `mapState.cleared=true` (`game.ts:864–867`), while `checkDungeonCleared` then returns before adding the dungeon to `player.clearedDungeons` (`960–967`). A legitimate old completion can therefore be absent from that player set. Backfill from map clearance and boss-victory semantics as well as permanent enemy kill counts and duel won-flags; fix the clear-recording path for future victories. Do not make the Testament depend on this incomplete set alone. Retained relics that have alternative sources are not sufficient evidence by themselves.

Add new rarities to every exhaustive table, style, sort/filter, icon, loot presentation, save validator, and debug selector. Add `acquisitionSource` and an allowlist for high-tier templates. Generic rarity rolling remains capped at Legendary; rare authored relic selection has explicit region/achievement restrictions. Island-exclusive materials, recipes, transformations, merchant stock, reward claims, and debug exemptions all require source validation.

Fix forging with canonical per-stat level/rarity curves and recorded affix rolls, avoiding repeated multiplication. New ordinary Greek item levels cap at 100; progression caps for new Greek recipes follow unlocked acts (85/90/95/100), regardless of a rich player's available gold. Do not reinterpret every existing +15-reach item as illegal: preserve legacy authored level metadata in migration and separately rebudget its effective stats. Document any compensation and show a preview of affected items. Exact old spending cannot be inferred when no transaction history exists; never promise an exact refund without evidence.

Ordinary skills remain 120 total at 75+. Add five independent mastery-choice rows and their save fields. Recalculate experience/rewards for76–100 using actual expected first clears, not a blind extrapolation of the old cubic DPS fit. Update shops, forge caps, stat displays, training dummies, debugging, and quest rewards together.

## 3. Save migration and recovery

Keep schema, world-generation, item-stat, and encounter-state versions separate. They solve different problems. Read the v1 save without mutating it, validate it, copy the raw data to a retained backup, then construct and validate v2. Only switch the active slot after a successful write and readback. Storage quota failure leaves the original intact and shows a useful message; offer export/import so a player can preserve a long campaign independently of browser storage.

V2 preserves identity, appearance, levels, skills, gold, inventory/storage/equipment UIDs, enchant selections, quests, flags, discoveries, old map states, and coordinates. Add lifetime feats; Greek chapter/seal progress; ship ownership and berth/hull/cargo; voyage checkpoint; island permissions; encounter chapter/roster version; durable unique reward claims; and migration diagnostics. Store compact gameplay state, not tile grids or screenshots.

Validate spawn position according to movement profile and access entitlement. If an old coordinate falls inside an intentionally opened pass or an invalid new state, recover at the nearest valid point in the same permitted area, with a clear message. Never recover an ineligible save directly into the temple.

Combat reload policy: active army chapters restart at their beginning with the committed prior chapter state; completed 300 remains completed. Active Leonidas attempts restart at the antechamber; practice phases retain only practice unlocks. Safe ship position and voyage state resume when valid; invalid hazard state recovers to the last permitted dock/checkpoint. Neither restoring a save nor map eviction generates a new reward.

Resource state, encounter milestone, and reward claim are committed as one coherent snapshot. Consumables already spent are not refunded by a reload reset. First-clear rewards use stable claim IDs and remain redeemable with a full inventory. Gold/XP/repeat rewards cannot be multiplied by duplicate victory callbacks or restarting a partially completed army chapter.

Use saved monotonic game time or remaining durations for new timers. Existing respawn timestamps use `game.now`, which is not itself currently saved; audit that mismatch as part of compatibility, rather than copying it into voyage storms and checkpoint timers.

## 4. Performance and the 8 GB Mac

No builds, renderers, or runtime performance measurements were run during the planning audit. The following are budgets to measure.

The doubled terrain and region arrays are only about 4 MiB combined. More important costs are full-map generation scratch arrays, retained maps, caches, and active entity work. The current renderer allows 90 512×512 canvases, about 90 MiB in raw RGBA pixels before browser overhead. Its cache keys use map IDs without generation/revision identity; mutable dungeons require reliable invalidation.

Planned constraints:

- One heavy local job at a time; inspect memory pressure and high-RSS processes before builds, browsers, or profiling. Use one test worker and reuse an existing browser/server where safe.
- Generate legacy and Greek territories sequentially; release scratch data promptly. Yield between large generation stages so loading remains responsive.
- Index spawn points, enemies, and dynamic hazards spatially. Do not scan the doubled world's complete spawn list every frame.
- Simulate at a fixed 60 Hz with bounded catch-up, or an explicitly validated 30 Hz mode; render budgets and dropped frames must not alter dodge durations or attack geometry. Cap catch-up work after tab suspension and resume paused rather than instantly applying missed lethal attacks.
- Initial active limits:36 army hostiles,12 friendly summons,64 gameplay projectiles,24 damaging hazard groups. If more effects would be created, coalesce only equivalent effects or defer a spawn; never silently delete a required attack. Tune caps against real builds.
- Bound terrain cache by bytes (initial 64 MiB normal/32 MiB battery saver), retain only a few recent interior maps, and regenerate evicted maps from seed plus persistent state. Cache identity includes generation instance and revision.
- Storm particles, distant soldiers, and lighting detail degrade first. Telegraphs, safe lanes, and enemies never disappear to save performance.
- Initial targets: steady 60 fps on ordinary exploration; stable 30 fps minimum for large encounters in battery saver; active gameplay memory below 500 MiB in a measured browser process where attributable. These are targets, not a guarantee that all browsers report identical memory.

Record cold generation time, warm/cold transition time, frame-time percentiles, entity count, cache bytes, and repeated-visit memory growth. Test storm+monster combat, army chapterIII, and Leonidas phaseIV. Do not raise a JavaScript heap ceiling to severalGB as a substitute for fixing retention.

## 5. Ordered delivery milestones

| Milestone | Concrete output | Exit evidence |
| --- | --- | --- |
| **M0 — Baseline and manifests** | Freeze source snapshot, old-world completion list, worldgen invariants, content registry, migration fixtures. | Source reference checks; representative clean and reopened saves; approved design internally consistent. |
| **M1 — Foundations** | Save v2, immutable feats, access checks, reliable attack intents, curve-based forge migration, spatial queries. | Legacy saves load; old attacks hit where shown; resets preserve feats; no new content required to verify. |
| **M2 — World and playable slice** | Exact doubled surface, preserved legacy half, two passes, Thyra/Aigialos, Nemea, one ship and island. | Round trip from old save; no unintended bridge; foot and ship reachability; safe save/reload. |
| **M3 — Mainland campaign** | Remaining mainland regions/services, first eight Labours, Python, Cyclops, core Greek equipment/mastery. | Each adventure completed with at least a slow melee and ranged build; objectives teach distinct rules. |
| **M4 — Sea and outer myths** | All ships, 16 smaller islands, four sea danger bands, remaining outer Labours, Medusa, Minotaur, Talos, Chimera, Scylla/Charybdis. | Routes and monster placement validate; small islands do not reset offshore risk; no ferry/access bypass. |
| **M5 — Underworld** | Five linked spaces, Cerberus, Titan Chain, side challenges, full seal graph and craft prerequisites. | No recipe/dependency cycle; gate-side retries; full surface→Underworld→surface save round trip. |
| **M6 — The Three Hundred** | Formation AI, exact 300 roster, four chapters, reserve visuals, checkpoints, harbour opening. | 300 unique defeats; all six classes tested; no count/XP/reward farming; measured performance. |
| **M7 — Asterion and Leonidas** | Storm approach, island, three sanctuaries, six champions, temple, six-phase boss, ending, Primordial rewards. | Earned route through entire campaign; all six classes can win; attack/safe-route tests; no top-tier offshore source. |
| **M8 — Content completion and release verification** | Side stories, contracts, final art/audio/UI, balancing, accessibility, regression and migration polish. | Full acceptance matrix below passes; complete playthrough on a migrated save and a new character path. |

Each milestone is independently reviewable. No remote deployment, merge, or gameplay changes are part of this planning deliverable. During implementation, use owned branches/worktrees, stage named files only, and do not mix another session's unfinished edits into a build or release.

No calendar estimate is asserted before M2 demonstrates the bespoke encounter, generation, and naval foundations. This is a substantial expansion with new engine systems, not a small data update.

## 6. Acceptance matrix

### Automated correctness

1. **Area/preservation:**1920×1088 total;1,044,480 new tiles; exact old tile/object identities outside declared seam masks across a bounded set of representative seeds.
2. **Topology:** every required foot destination reachable in its own landmass; every required dock reachable by its allowed hull; no walkable mainland→Asterion route.
3. **Progression:** graph validation proves an acyclic path from Veteran Writ to Leonidas; every mandatory component is obtainable before use; no exclusive branch blocks an essential reward.
4. **Access:** test waystone, map click, portal, dock, ferry, teleport ability, knockback, death recovery, and save-load entry before/after each required feat.
5. **Rarity provenance:** enumerate every loot/shop/craft/elevation/reward path; no Primordial result outside allowed island sources. Luck and generic rarity overrides cannot bypass it.
6. **Army:** ten companies×30; four chapter totals 60/90/90/60; exact IDs through deployment, death, retreat, checkpoint, reload, and rematch. No duplicated roster member or false victory on despawn.
7. **Attack geometry:** preview and impact share origin/facing/points; moving player does not rotate a locked cone; rain resolves its announced spots; line collision works.
8. **Encounter integrity:** finite guard count, one heal per guard wave, monotonic phase progression, no unbeatable cover layout, no infinite add/proc chain, no rewarded practice victory.
9. **Save integrity:** v1 backup retained; v2 migration idempotent; full inventories preserve unique rewards; failed writes do not claim success; invalid positions recover safely.
10. **Stats/economy:** forged and directly authored equal-level items follow intended curves; no exponential reforge value exploit; sufficient guaranteed income for required ships/components; retries cannot bankrupt access permanently.

Existing scripts remain useful starting points: `check-content.ts`, `check-regions.ts`, `check-balance.ts`, `check-economy.ts`, `measure-dps.ts`, and `check-npc-schedules.ts`. They are not proof of the new mechanics by themselves. Add targeted checks for the actual runtime state machines, topology, source provenance, and migration; avoid tests that merely repeat content constants without exercising behaviour.

### Play and presentation evidence

- Test warrior, ranger, mage, rogue, paladin, and necromancer with representative earned loadouts, including defensive, summon, heavy-weapon, and multi-hit builds.
- Verify keyboard-only and touch play, automatic targeting during protected-animal/gaze/formation mechanics, and accessible contextual tool prompts.
- Compare learnable difficulty against The Remainder and The Floor of the World. Both new apex encounters must demand substantially more mastery; successful play must remain explainable.
- Test reduced effects, colour-vision readability, UI scaling, battery saver, pause/tab suspension, and low frame-rate behaviour. Warnings must remain legible in storms and crowded combat.
- Verify each named region's silhouette, coast type, landmark density, settlement services, and recovery routes. A full-area ocean painted without routes, encounters, and discoveries fails the geography requirement.
- Measure rather than assume performance, gold income, DPS, healing, time-to-clear, and preparation burden. Use anonymized local test fixtures, not private player data uploads.

Final sign-off requires all requested systems, content, and the end-to-end progression. A generated map with placeholders, a boss with a bigger health bar, or an untested roster counter is not a completed Greek update.
