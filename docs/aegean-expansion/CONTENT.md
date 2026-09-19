# The Aegean Oath — launch content ledger

> Historical first-draft specification. The owner’s subsequent direction removes the level-75 border, Chronicle and global completion checklists. [REBUILD.md](REBUILD.md) records the current game-first design and takes precedence over those superseded details.

**Authored content ledger; see [RELEASE.md](RELEASE.md) for the implemented behavior and verification.** This ledger supplements [DESIGN.md](DESIGN.md). Counts below refer to distinct authored identities, not random stat variants. Item names, acquisition, and tactical purpose are specified here; numeric stats come from the shared balance model and runtime testing.

## 1. Thirty-six equipment identities

Eighteen weapons, eight off-hands, five armour sets, and five artifacts. Existing classes can use all appropriate slots. Legendary introductions provide new identities immediately; Olympian equipment carries most expansion progression; Primordial remains strictly island-sourced.

| ID | Name | Kind / tier | Source | Defining behaviour |
| --- | --- | --- | --- | --- |
| W01 | Dory of the Dawn | Spear / Legendary | Thyra veteran commission | Correct spacing primes the next thrust. |
| W02 | Kopis of the Nemean Hunt | Sword / Olympian | Nemean Lion recipe | A narrowly avoided lunge primes a flank cut. |
| W03 | Hydra's Last Fang | Dagger / Olympian | Hydra first-clear choice/recipe | Bounded venom stacks intensify during a real exposure. |
| W04 | Artemis's Silver Bow | Bow / Olympian | Hind sanctuary recipe | Deliberate mark and follow-up; movement remains possible. |
| W05 | Thunder Javelins | New javelin family / Olympian | Olympian storm-altar trial | Throw/recover rhythm; limited ready charges regenerate without ammunition grinding. |
| W06 | Hephaestus's Measure | Hammer / Olympian | Divine-forge commission | Stagger triggers a short shockwave with a cooldown. |
| W07 | Staff of the Delphic Breath | Staff / Olympian | Python | Small oracle field rewards repositioning and limited mana recovery. |
| W08 | Chains of Prometheus | New chain-blade family / Olympian | Titan Chain recipe | Alternate close pressure and retreat; resistant targets cannot be pulled forever. |
| W09 | Labrys of the Labyrinth | Greataxe / Olympian | Minotaur | Sever a marked hazard tether; heavy recovery creates commitment. |
| W10 | Geryon's Threefold Pick | War pick / Olympian | Geryon | Three distinct successful target openings build one controlled armour break. |
| W11 | Quarry's Answer | Great hammer / Legendary | Cyclops quarry | Crushing cover or a construct weak point briefly empowers the next swing. Use the existing heavy-hammer kind. |
| W12 | Stymphalian Recurve | Bow / Olympian | Bronze Sky mastery recipe | Marked targets can receive a bounded ricochet; competitive single-target alternative. |
| W13 | King's Dory | Spear / Primordial | Leonidas catalyst, island forge | Complete a clean defence to earn a precise royal counter sequence. |
| W14 | Last Dawn Kopis | Sword / Primordial | Leonidas catalyst, island forge | An interruption grants a short choice between pursuit and guarded retreat. |
| W15 | Bow of the Storm-Cleared Sky | Bow / Primordial | Leonidas catalyst, island forge | A marked exposed target receives a focused storm shot; no automatic screen wipe. |
| W16 | Sceptre of the First Flame | Staff / Primordial | Leonidas catalyst, island forge | Cycle a small number of controlled flame patterns; spell costs remain meaningful. |
| W17 | Twin Oathblades | Chain blades / Primordial | Leonidas catalyst, island forge | Alternating successful close and ranged chain strikes builds a bounded finisher. |
| W18 | The Unbroken Standard | Halberd / Primordial | Leonidas catalyst, island forge | Well-timed planted stance aids the player and nearby allies without permanent area invulnerability. |
| O01 | Aspis of Sparta | Shield / Legendary | Sparta armourer | Clear baseline for shield-facing and resource-efficient blocking. |
| O02 | Lyre of the Drowned | Tome-style off-hand / Olympian | Drowned Theatre side story | Timed pulse weakens a volley; does not mind-control bosses. |
| O03 | Aegis of the Clear Mind | Shield / Olympian | Medusa | Correct facing defence helps clear petrification pressure. |
| O04 | Tablets of the Crossroads | Tome / Olympian | Hermes route commission | Reposition owned spirits through a short marked passage with collision checks. |
| O05 | Lantern of the Returning Soul | Brand / Olympian | Asphodel named-shade story | A small field rewards leaving and re-entering danger; limited restoration. |
| O06 | Heart of Talos | Brand / Olympian | Talos | Store one correctly defended impact, then release a limited heat pulse. Separate from the optional ship fitting. |
| O07 | Mirror of the Last Dawn | Shield / Primordial | Athena sanctuary on Asterion | Timed reflection opens a personal attack opportunity. |
| O08 | Aspis of the Last Companion | Shield / Primordial | Athena sanctuary rematch recipe, island forge | Protecting a nearby ally or surviving a solo timed brace stores one counter charge. Both solo and summon builds qualify. |
| A01 | Nemean Mantle | Armour / Olympian | Nemean Lion recipe | Improves earned Brace recovery; does not grant ordinary-damage immunity. |
| A02 | Erymanthian Hide | Armour / Olympian | Boar | Cold and knockback resistance with lower offensive bonus. |
| A03 | Girdle of the Amazon Queen | Armour / Olympian | Hippolyta | Mobility and discipline; bonus still functions without summons. |
| A04 | Stygian Raiment | Armour / Olympian | Cerberus / Underworld commission | Fear recovery and brief protection after escaping a marked hazard. |
| A05 | Oathforged Panoply | Armour / Primordial | Forge Without Fire on Asterion | Correct defence stores a limited guard charge; strongest passive defence does not eliminate execution mechanics. |
| R01 | Thread of Ariadne | Artifact / Olympian | Minotaur | One short-range return to a valid marked position. Cannot cross gates, water, or instance boundaries. |
| R02 | Atlas's Last Star | Artifact / Olympian | Hesperides | Spend accumulated movement discipline on a brief shield or resource relief. |
| R03 | Orphic Seal | Artifact / Olympian | Underworld restoration story | Temporarily gather owned summons; provides a personal benefit when no summons exist. |
| R04 | Crown of the Returning Tide | Artifact / Olympian | Scylla–Charybdis | A short defensive wave pushes minor threats; boss resistance is explicit. |
| R05 | Ember of the First Oath | Artifact / Primordial | Well of Unspent Names on Asterion | Earned interrupts/staggers prime a brief selected offensive or defensive effect. |

Any minor reward called a tool, seal, charter, fitting, trophy, or recipe in the main design is not an additional equipment slot. Artemis's Trail, for example, is a learned utility; the Hind's equipment reward is W04. Future equipment additions must maintain the top-tier source rules rather than diluting these identities.

## 2. Ship construction and fittings

Mandatory Stormbreaker components:

| Component | Guaranteed acquisition | Prerequisite verification |
| --- | --- | --- |
| Bronze storm ribs | **A Hull That Holds**, a forge commission unlocked by Augean and Boar seals | Uses fixed rewarded material allowances plus known gold cost; never depends on optional Talos or a rare drop. |
| Hesperid star-sail | First completion of the Apples Labour | Permanent component claim independent of inventory capacity. |
| Underworld keel-binding | Cerberus Labour, then a free ritual at Ember Quay | Cannot be consumed by an accidental failed voyage. |

Six elective fittings: bullhorn ram (Bull); bronze-heart stabilizer (Talos, optional); Stymphalian signal gong (Birds); Nemean boarding screen (Lion); Gorgon lookout lens (Medusa); Ariadne recovery line (Minotaur). These occupy ship fitting slots; the three mandatory structural components do not. Install, replace, and inspect at a shipyard. Replacing a fitting returns it to ship storage, not to the sea.

Three crew members can fill one active role each: Naus as pilot (clearer current cues); Thaleia's rescued apprentice as shipwright (cheaper repairs); and the memorial quest's lookout (earlier monster warnings). Baseline steering, repair, and warnings remain sufficient without an optional recruit.

## 3. Asterion's six champions

These are original oathbound characters, separate from the already-defeated army. Each unlocks a permanent island shortcut and a guaranteed Oathsteel bundle. Their proofs, together with the three sanctuaries, open the temple.

| Champion / place | Distinct test | Teaches Leonidas counterplay |
| --- | --- | --- |
| **Aster, Keeper of Distance / Broken Oars** | A compact duel with a long thrust and delayed return; observe a committed direction. | Royal Measure spacing. |
| **Damar, the Unbroken / Cypress Vale** | Shield rotates only at announced beats; attacking the correct flank breaks its link. | Frontal protection and meaningful flanks. |
| **Pyrra, the Red Pursuit / Red Ravine** | Pursuit through three safe courts; bait a charge into an extinguishable fireline. | Escape lanes and environmental openings. |
| **Myron, Voice of Arrows / Necropolis gallery** | Volley lanes and moving cover, with a reachable target-lock weak point. | Read several attacks without requiring mouse aim. |
| **Ionea, the Loyal / Oath barracks** | Protecting guards and a visible chant; choose an interrupt over random damage. | No Man Abandoned. |
| **Kreon, the Storm-Bearer / Sky-Split Stair** | Redirect lightning through conductors while preserving a central safe route. | Debt to the Sky. |

Names and appearances are fictional. Aster's loyalty remains intact: he offers a warning and an honourable trial, not secret betrayal. Defeated champions become memorials, resting guards, or oath echoes appropriate to their story; they do not respawn as random roadside enemies.

## 4. Eight campaign chapters, four major objectives each

These 32 objectives orchestrate existing adventures; they do not add32 extra fetch quests. Each objective may reference several flexible-order seals while remaining one comprehensible Chronicle goal.

| Chapter | Four objectives |
| --- | --- |
| **Beyond the Last Storm** | Earn Veteran Writ; cross a mountain pass; reach Thyra; learn formation defence in its veteran trial. |
| **A Shore Worth Saving** | Reach Aigialos; complete harbour training; restore the first coastal route; finish the first four Labours in flexible order. |
| **In the Footsteps of Heracles** | Defeat Python; complete the next four Labours; forge bronze storm ribs; earn an Olympian equipment recipe and craft/claim a usable reward. |
| **What the Sea Keeps** | Chart the outer routes; defeat Medusa and the Minotaur; complete Hippolyta and Geryon; retrieve the Hesperid star-sail. |
| **The Kingdom Below** | Establish the Taenarum route; reach Hades' court; complete Cerberus and keel rite; contain the Titan Chain breach. |
| **Bronze Against the Dawn** | Reconcile the Old World's Testament; muster at the Last Shore; defeat all 300; commission the certified Stormbreaker. |
| **The Island That Refused Death** | Cross the oath storm; establish the beach camp; restore all three sanctuaries; overcome six island champions. |
| **The Last Oath** | Enter the temple and reach its antechamber; defeat Leonidas; claim a chosen Primordial weapon; witness the restored realm and record the memorial. |

If a player completes an objective before its chapter is active, the Chronicle recognizes the permanent feat immediately. It must not force a second kill, second ship purchase, or a new voyage solely because the journal had not yet displayed that row.

## 5. Twenty-four discovery entries

Two authored discoveries per geographic region give the initial atlas a measurable density of memorable small places. They are separate from the major adventure entrances. Each has a short inspection text, an obvious visual identity, and a small reward or route.

| Region | Discovery1 | Discovery2 |
| --- | --- | --- |
| Marble Threshold | Aqueduct of Nine Echoes: acoustic shortcut clue | The Veteran's Last Mile: safe camp and old-world vista |
| Arcadia | The Helmet Olive: small recipe cache and shepherd story | The Dryad's Unmoving Spring: concealed refuge |
| Olympian Escarpment | Observatory of the Split Star: storm-route clue | The Wind Stair: controlled traverse and lookout |
| Two Rivers | The Wheel That Turns Backward: reversible machinery puzzle | Bridge of Supplicants: rescued caravan and trade shortcut |
| Delphic Heights | The Ninth Inscription: oath-history reveal | Laurel of the Silent Oracle: sanctuary challenge |
| Bronze Coast | The False Lighthouse: side-story entrance | The Hanging Ship: salvage accessed through a cliff passage |
| Lacedaemon | The Empty Place: frieze investigation | The Mother's Shield: memorial and recipe |
| Lerna | The Feather Causeway: safe route discovered by flock behaviour | The Drowned Granary: poison-route cache |
| Ashen Peninsula | The Cooling Steps: timed geothermal crossing | The Last Sunbeam: boundary marker above Taenarum |
| Shattered Cyclades | Icarian Fall: damaged instrument | Cyclops' Table: footprint-scale ruin and compact cave |
| Pelagic Deep | The Bell Beneath the Fleet: charted wreck encounter | The Drowned Lyre: navigation/sound clue |
| Asterion | The Field of Unraised Shields: loyal soldiers' memorial | The First Crack of Dawn: post-victory overlook |

These anchors do not excuse empty space between them: secondary camps, coast events, terrain variation, and natural rest areas connect the major routes. Conversely, every ten tiles need not contain an icon; the sea and mountains must retain scale.

## 6. Authoring completion rules

Every quest/adventure entry must have stable ID, location, prerequisite expression, recognized prior-feat behaviour, objective transitions, failure/reset policy, first-clear reward, repeat reward, save fields, interaction prompts, and reachability checks. Every equipment entry requires kind/slot, template version, source rule, stat budget, effect ownership, proc limits, art, text, and full-inventory claim behaviour.

An authored identity is complete only when it exists in playable code and can be obtained through its intended route. Placeholders, debug-only grants, empty map markers, and names in a data table do not count toward launch totals.

## 7. Frozen original-world Testament

The audited release contains 25 dungeon/cave definitions,16 `boss_` identities,8 named `mini_` identities, and Tusya's duel. These are the proposed original-game challenge requirements. One victory can satisfy both its boss and dungeon entry. Reused miniboss identities need one lifetime victory, while each distinct dungeon still needs its own clear. Region discovery happens through visiting these destinations; every random chest and scenery marker is not required.

| Dungeon / cave | Stable map ID | Principal boss, if any |
| --- | --- | --- |
| The Ruined Fortress | `dungeon_fortress` | `boss_stone_warden` |
| The Barrow Crypt | `dungeon_crypt` | `boss_hollow_king` |
| The Thornhollow Grove | `dungeon_grove` | `boss_matriarch` |
| The Sunken Tomb | `dungeon_tomb` | `boss_sand_tyrant` |
| The Ashen Spire | `dungeon_spire` | `boss_rime_lich` |
| Ironroot Mine | `dungeon_mine` | Named miniboss / clear |
| Whisperwell Cave | `dungeon_whisper` | Clear |
| The Deepwood | `dungeon_deepwood` | `boss_gloam_mother` |
| The Thorn Warren | `dungeon_thorn` | Named miniboss / clear |
| The Drowned Court | `dungeon_drowned` | `boss_tide_king` |
| The Salt Works | `dungeon_saltworks` | Named miniboss / clear |
| The Caldera | `dungeon_caldera` | `boss_cinder_maw` |
| Ashfall Barrow | `dungeon_ashfall` | Named miniboss / clear |
| Frostmarch Hold | `dungeon_frostmarch` | `boss_march_warden` |
| The Glass Hollow | `dungeon_glass` | Named miniboss / clear |
| The Riven Cathedral | `dungeon_riven` | `boss_riven_choir` |
| The Long Barrow | `dungeon_barrow` | `boss_jotun_king` |
| Under the Gate | `dungeon_remainder` | `boss_remainder` |
| The Last Gate | `dungeon_lastgate` | `boss_winter_jarl` |
| The Sunken Hall | `dungeon_sunkenhall` | `boss_drowned_court` |
| The Blackreed Warren | `dungeon_blackreed` | Named miniboss / clear |
| The Standing Rod | `dungeon_standingrod` | `boss_storm_throne` |
| The Glass Run | `dungeon_glassrun` | Named miniboss / clear |
| The Underfloor | `dungeon_underfloor` | `boss_emberdeep` |
| The Slagworks | `dungeon_slagworks` | Named miniboss / clear |

Named minibosses: Cutter Captain Vosk (`mini_captain`), The Brood Mother (`mini_broodmother`), Rime Warden (`mini_frostwarden`), The Wintercaller (`mini_wintercaller`), Glacier Maw (`mini_glacier_maw`), The Fen Mother (`mini_fenmother`), The Storm Herald (`mini_stormherald`), and Emberjaw (`mini_emberjaw`). The duel uses enemy `duelist_tusya` and permanent flag `beat_tusya`.

Evidence: `src/data/locations.ts` dungeon definitions; `src/data/enemies.ts` named identities; `src/data/npcs.ts:585` duel. Migration must use the old clear semantics and all reliable retained evidence as detailed in [IMPLEMENTATION.md](IMPLEMENTATION.md), especially `mapState.cleared`. New content added after this frozen release cannot silently enlarge a returning player's requirement list.
