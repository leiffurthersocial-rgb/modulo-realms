# Greek expansion rebuild

Status: offline review branch. Production has the original game plus a narrowly scoped Continue repair. The expansion must not be deployed as part of this rebuild without the owner's further instruction.

## Original game comes first

The Chronicle, migration dashboard and expansion shortcuts have been removed. The original title, Journal, Skills, Anvil and pause menu remain. Switching tabs saves but no longer inserts an automatic pause screen. Field objectives are learned by exploration and tracked through the ordinary Journal. Recipes belong at anvils, ships at harbours, and practice at statues in the temple.

The mainland and the Three Hundred have no level lock. Difficulty comes from enemies and the expedition itself. The army still must be defeated to reach Leonidas, as requested. No global old-world checklist blocks the border.

Original equipment generation, forging, Crown upgrades, Life Siphon, Arrow Rain and original boss attack resolution are compared directly with pre-expansion source. New Greek rules are scoped to new content. The rebuilt loader can safely rejoin progress made while production was rolled back.

## Geography and settlement direction

The eastern half remains exactly the area of the old world. Terrain uses the original layered noise, ridges, moisture variation and scatter grammar. Only the old eastern rim changes in the west, opening a broad natural transition. Coasts have a northern fjord, a hooked military cape, a deep southern gulf, beaches, cliffs, river mouths and volcanic shores. Six curving rivers, braided delta channels, farms and groves shape routes.

Every named island has a distinct outline and a local composition: vineyards and palace ruins, bronze giant footprints, a petrified orchard, livestock pens, ruined wings, siren stacks, a flooded theatre, a caldera, a giant's table or sister-island histories. Asterion uses connected island routes and a terraced ascent to a monumental temple.

Eight settlements have compact lanes, working stalls, house thresholds, gardens, storage, inns, forges and trade interiors. Forty-eight Greek residents have local dialogue, supplies and services; outdoor workers follow routes between their actual homes, work and evening gathering places. Furniture and paths must remain reachable using the real collision rules.

## Art, sound and discovery

Greek textures and architecture are drawn through the existing pixel-art renderer: weathered stone, roof shingles, bronze, watermills, warehouses, porticoes, fishing gear, baskets, vines and household details. New art keys are checked for missing renderer cases. Light sources use the original day/night lighting.

Ten Greek music arrangements use the original synthesized soundtrack system. Original music definitions are unchanged. Sailing, thunderstorms, resonators, army chapters and royal phase transitions have finite sound cues. Region changes reuse the same scheduler.

The royal antechamber has a usable Oathsteel Anvil, storage and forge fire. Recipes and earned royal choices use the ordinary Anvil panel. On narrow phones, Journal, Anvil and Shipwright keep the original styling and stack their independently scrollable list and details so actions remain reachable.

The 57 field activities use individually authored scenes. Small discoveries have a single relevant object; puzzles expose their actual mechanisms. Evidence, routes and encounters use the terrain and local story rather than identical rows of quest stones. Rewards and persistence still use the existing tested activity machinery.

The five Underworld areas also have their own environmental stories: cargo and customs ruins at Charon's quay; personal memorial plots in Asphodel; cultivated beds and a winter quarter in Persephone's garden; judgment desks and sealed tribute at Hades' court; boulders, an empty banquet and leaking-vessel imagery for the punishments in Tartarus. Existing lights, plants, furniture, stone and bronze props supply the detail while keeping the routes open.

## Verification record

Validated locally on 19 September 2026, using one build/test process at a time on the 8 GB Mac:

| Check | Result |
| --- | --- |
| `npm run check:aegean` | All twelve serial groups passed: references, original NPCs, content, recovery-save reconciliation, Greek residents/audio, world geometry, activity scenes, encounters, class diagnostics, services, real-Game integration and original-mechanics parity. |
| World geometry, seeds 1337 and 42 | Passed: exact map doubling; frozen original world outside the former eastern rim; twenty usable docks; no foot route to Asterion; connected entrances, objectives, activities and island anvil. |
| Original-mechanics comparison against Git `d39d75a` | 615 loot cases, four forging/Crown/load sequences, Life Siphon, Arrow Rain and every original boss attack passed. |
| Activity scenes and residents | All 57 scenes, 176 interaction objects, 48 residents, actual outdoor paths and indoor furniture passed. Journal tracking resumes existing unfinished stories without erasing evidence or paying rewards. |
| Production build | TypeScript and Vite passed. |
| Built browser, desktop | Actual door entry, refresh → Continue, dock purchase → embark, earned recipe display, island royal weapon selection, heroic talent selection and original Pause actions checked. No browser errors reported. |
| Built browser, 390 × 844 | Journal, Shipwright and Anvil inspected; lists/details scroll within the panel and no longer clip off the screen. |
| Save roundtrip | Reload and actual Continue click restored the same inn, character, position, gold and royal item. Automated scenarios also cover original saves, rollback progress, held Greek items and positions stranded by a rebuilt coast. |

Browser review used a separate local test character, controlled travel, invulnerability and explicit earned-reward fixtures to reach the relevant interfaces. These are interaction and rendering checks, not a human victory over Leonidas. Audio checks cover arrangements, scheduler lifetime and finite cues; they do not constitute an independent listening review. Long-session pacing and difficulty across human playstyles still need playtesting.

The live site remains on the original game plus Continue repair (`976cb01`, script `index-BFDKpKYF.js`). This branch must not be merged or promoted as part of the rebuild delivery.

## Actual generated world and browser captures

The atlas below is rendered from seed 1337's actual tile data using the game's map palette. It is not a concept image. Browser captures use the built local game; the temple uses a taller viewport to show the full facade.

![Rebuilt world atlas](review/atlas.png)

| Place or interface | Capture |
| --- | --- |
| Thyra square and an actual house entrance | [Town](review/thyra.png), [door](review/house.png) |
| Furnished Split Amphora inn | [Inn](review/inn.png) |
| Shipwright and sailing | [Harbour](review/shipwright.png), [ship](review/sailing.png) |
| Temple of the Last Oath | [Temple](review/temple.png) |
| Tartarus and Persephone's cultivated beds | [Underworld](review/tartarus.png), [garden](review/persephone.png) |
| Original Journal and Anvil with Greek content | [Journal](review/journal.png), [Anvil](review/anvil.png) |
| Phone layouts | [Journal](review/journal-mobile.png), [Anvil](review/anvil-mobile.png), [Shipwright](review/shipwright-mobile.png) |
