# Modulo: Realms of Ash — The Aegean Oath

> Historical first-draft specification. The owner’s subsequent direction removes the level-75 border, Chronicle and global completion checklists. [REBUILD.md](REBUILD.md) records the current game-first design and takes precedence over those superseded details.

**Expansion design, 19 September 2026. Status: original specification; implementation and measured results are documented in [RELEASE.md](RELEASE.md).**

This is the original expansion specification. The release guide distinguishes delivered behavior from initial ambitions and tuning targets. The source audit uses repository commit `d39d75af0723a6b13f4683c50ded7701404e9674`. Numeric balance, prices, completion times, and performance budgets below are initial tuning targets, not measured outcomes. The companion [implementation plan](IMPLEMENTATION.md) separates existing capabilities from systems that must be built.

## 1. The promise

East of the Stormreach, a broken mountain road opens onto olive terraces, white cliffs, bronze roofs, and a sea so blue it seems impossible that anything terrible lives beneath it. Inland, ancient kingdoms keep their markets, games, quarrels, and gods. Beyond their harbours, drowned temples rise through clear water. Farther out, ships begin returning without crews. Farther still, they stop returning.

At the edge of the chart stands a black island encircled by a permanent storm. Its mountain has been cut into a temple. Leonidas waits inside, enormous, almost divine, surrounded by men who have chosen him over death itself.

To approach that island, the player must first overcome the Three Hundred: an army fought as an army, with moving shield walls, reserves, captains, coordinated assaults, and a battlefield that changes as the battle advances. To defeat Leonidas, the player must bring the experience of the original game and the entire Greek campaign. Equipment buys the chance to survive. Knowledge earns the victory.

The expansion adds **exactly the existing surface-map area to its right**, a new level-76–100 progression, twelve distinct Heraclean adventures, additional mythological dungeons, an explorable Underworld, ships and naval combat, two rarities beyond Mythic, and the two most ambitious encounters in the game.

### Design commitments

1. Greece feels inhabited and geographically varied. Beauty, silence, ordinary work, and danger all have space.
2. Greek myths determine what the player does: tracking, redirecting rivers, trapping immortal creatures, reading reflections, commanding formations, and navigating death.
3. The Three Hundred and Leonidas use new encounter systems. Increasing existing boss health is insufficient.
4. The sea is playable geography. Ships have different handling and purposes; islands are physically separate; offshore danger rises with distance from the mainland.
5. Leonidas is extraordinarily difficult but learnable. Warnings are truthful, counterplay exists, and defeat explains something useful.
6. All six current classes and all four equipment slots remain supported. No required boss mechanic assumes a mouse, a specific class, or a lucky drop.
7. The old world, its coordinates, and established achievements survive the update.

## 2. Myth, story, and tone

### The Broken Oath

This is a fictional Greek-inspired realm, **Achaea**, not a reconstruction of historical Greece. Leonidas and his Three Hundred are mythic counterparts: warriors transformed by a supernatural oath, not a claim that historical Spartans were giants or immortal. The place names draw on mythology, but their arrangement is invented to serve this game's eastern continent.

Long ago, Leonidas swore that no invading power would pass his gates while one of his men still stood. Ares gave the oath strength; Zeus witnessed it; the Moirai recorded its terms. When a Titan force rose beneath the sea, Leonidas expanded his promise from defending a city to holding the breach between the living world and Tartarus.

The oath succeeded too well. It bound king, army, temple, storm, and imprisoned creatures into one mechanism. Centuries later, the king still stands, the threat is returning, and the oath is draining the country it protects. Myths are repeating in damaged forms: the Hydra grows in poisoned rivers, the Stymphalian flock strips the fields, and the gates of death admit things they should contain.

The player restores twelve sanctuary seals through the Labours. These prove that another mortal can bear the defence of the realm. The Three Hundred then test that claim. Leonidas refuses to surrender his duty merely because an oracle predicts someone else can do it. His final fight is a judgement of capability as much as a struggle for survival.

His men remain loyal throughout. They do not betray him when persuaded. Their humanity appears through their discipline, memorials, letters, and care for the country. On defeat, their oath-bonds break; some die, some become shades, and some finally kneel. The army's in-game counter reads **standing**, so defeating all 300 does not require identical death animations.

### The gods

- **Athena** offers preparation, readable tactics, and the discipline to distinguish threats.
- **Poseidon** is a dangerous sovereign of the sea. His shrines provide knowledge and limited protection, never peaceful deep water.
- **Artemis** tests restraint and observation. Her sacred hind is protected from accidental auto-attacks.
- **Hephaestus** provides exceptional craft and the storm-going ship design.
- **Hermes** connects traders, routes, messages, and the boundary of the dead.
- **Hades and Persephone** rule a functioning realm with laws, seasons, obligations, and refugees. Hades is not a substitute for the devil.
- **Ares** embodies the oath's appetite for an enemy. He manifests in the army and temple without becoming a third, harder final boss.
- **Zeus** appears in storm, judgement, and disputed signs. No quest turns him into an ordinary creature to farm.

Heracles is felt through ruined paths, old tools, accounts that disagree, and one brief shade encounter after all twelve Labours. The player solves the present consequences of his legends rather than replaying a history lesson.

### Narrative delivery

Keep the existing world's self-directed spirit. Discoveries start adventures; meaningful actions complete them. Story scenes are short, skippable, replayable from the journal, and never hide instructions necessary for combat. Main chapters get a dedicated **Aegean Chronicle** page rather than overwhelming the current bounty list.

Eight campaign chapters: **Beyond the Last Storm; A Shore Worth Saving; In the Footsteps of Heracles; What the Sea Keeps; The Kingdom Below; Bronze Against the Dawn; The Island That Refused Death; The Last Oath.** Their exact objective graph is in section 12.

## 3. World dimensions and geographic design

### Exact footprint

| Surface | Tile coordinates | Dimensions | Tile area |
| --- | --- | --- | --- |
| Existing world | x 0–959; y 0–1087 | 960 × 1088 | 1,044,480 |
| New Greek half | x 960–1919; y 0–1087 | 960 × 1088 | 1,044,480 |
| Combined overworld | x 0–1919; y 0–1087 | 1920 × 1088 | 2,088,960 |

At the existing 32-pixel tile size, the combined world is **61,440 × 34,816 world pixels**. Ashvale remains at tile **(480,448)**. No existing settlement, NPC schedule, chest, or dungeon moves east to make room. Underworld floors and dungeon interiors are additional instances and do not count toward the promised surface-area doubling.

The new half targets approximately **43% connected mainland, 12% islands, and 45% sea**. These are art-direction targets, measured after coastline generation. Leonidas's island is roughly 180 × 248 tiles within its bounding box, with about 30,000 land tiles after coast carving: a substantial region with its own approach, valleys, fortress, sanctuary, and mountain, not a small boss platform.

The seam at x=960 is mostly a mountain divide. Two authored passes connect the continents around y=390 and y=690. The old eastern mountain rim changes only inside small, declared pass masks. The main road begins near Lastmast; the southern route is an optional dangerous approach. Both reach the same Greek campaign and enforce the same later prerequisites.

### Regional atlas

Coordinates are **global tile-space planning anchors**, not finalized door or spawn coordinates. Boundaries are irregular terrain masks; the listed anchors are not rectangular biome edges.

| Region | Anchor | Band | Geography, life, and defining play |
| --- | --- | --- | --- |
| **1. The Marble Threshold** | (1020,400) | 76–80 | Limestone pass, wild thyme, broken aqueduct, olive terraces. First view of the sea. Refugees and a fortified roadside inn. Teaches shield-facing, flank openings, and Greek threat signals. |
| **2. Arcadian Wilds** | (1110,280) | 78–85 | Oak and cedar forest, sinkholes, pasture plateaus, moonlit streams. Nemea, the hind sanctuary, satyr revels, centaur patrols, and shepherd camps. Trails wind around karst walls rather than forming straight corridors. |
| **3. The Olympian Escarpment** | (1290,145) | 87–94 | Snow above cloud, sheer gorges, hanging monasteries, wind-cut stairs, and thunder-scarred peaks. Boar hunt, harpy aeries, and the approach to the Titan observatory. Upper summits are seen before they can safely be reached. |
| **4. The Two Rivers** | (1090,560) | 80–87 | Wheat plains, two river valleys, water mills, terracotta estates, and a large delta. The Augean estate physically changes after cleansing; irrigation returns and local prices improve. |
| **5. Delphic Heights** | (1290,355) | 84–90 | Mountain sanctuary, laurel groves, split rock, mineral springs, and steam emerging from prophecy caves. Delphi is a quiet junction above the busiest roads. Python and the first complete explanation of the oath live below it. |
| **6. The Bronze Coast** | (1340,520) | 80–89 | White-cliff coves in the north, a working river-mouth harbour in the centre, pebble beaches and sea caves farther south. Whitewash, painted temple beams, drying nets, workshops, ferries, and crowded markets. Main port: Aigialos. |
| **7. Lacedaemon and the Eurotas** | (1320,760) | 88–95 | Fertile river valley enclosed by dry mountains, red earth, cypress, training fields, shrines, and the bronze-and-red city of Sparta. Civilian Sparta remains explorable; the oath army holds the eastern military road. |
| **8. Lerna and the Reed Kingdom** | (1130,790) | 84–92 | Warm marsh, reed islands, drowned causeways, poisonous pools, and bronze-feather wetlands. Hydra and Stymphalian adventures share a landscape but completely different rules. Cleansing changes local hazards without deleting exploration. |
| **9. The Ashen Peninsula** | (1260,985) | 92–97 | Black-sand beaches, fumaroles, pumice shelves, salt pans, and the sea cave at Taenarum. The route to the Underworld begins here. Night makes heat cracks visible through black rock. |
| **10. The Shattered Cyclades** | (1535,690) | 88–96 | Small limestone islands, flooded calderas, a palace island, a bronze giant's coast, fishing hamlets, wreck reefs, and impossible gardens. Navigation uses silhouettes and currents. Several islands contain safe landing coves but no long-range teleport. |
| **11. The Pelagic Deep** | (1630,225) | 94–100 | Open water, storm fronts, drowned fleets, underwater temple silhouettes, moving monster territories, and the Scylla–Charybdis passage. The last military harbour sits on its western edge. Routes cross, but none bypass the army's oath barrier. |
| **12. Asterion, the Oathbound Isle** | (1810,480) | 99–100 apex | A storm-ringed island with basalt teeth, a shingle landing, red cypress groves, a bronze necropolis, high ravines, and Leonidas's immense mountain temple. The storm can be seen from distant coasts. All Primordial gear originates here. |

**Spatial placement constraints:** keep Asterion's island polygon within approximately x=1720–1900, y=350–598. Maintain at least 96 uninterrupted water tiles between its western cliffs and any neighbouring island; the required landing is inside its storm band. Mainland capes and outlying islands cannot create a stepping-stone route around that band. The sea boundary remains a visible chart edge/current, never an invisible damaging wall in reachable water.

Where another island lies directly west of Asterion's x=1720 shore, its dry tiles must end at x=1623 or earlier, leaving water columns 1624–1719. The smaller-island layout is checked against the complete coast polygon, not only its named anchor.

### Eight settlements and their roles

| Settlement | Anchor | Services and character |
| --- | --- | --- |
| **Thyra, the Gate Market** | (1008,405) | First inn, bank/storage, supplies, Chronicle board; caravans arriving from Lastmast. |
| **Nemean Hearth** | (1090,330) | Pastoral village, hunter, outdoor forge, beast-material recipes. |
| **Potamoi** | (1080,590) | River town, sluice engineer, produce market, cleansing wells after the estate adventure. |
| **Delphi** | (1280,365) | Oracle, archive, mastery sanctuary, rare recipe exchange; no ordinary weapons bazaar inside the sacred precinct. |
| **Aigialos** | (1350,535) | Main shipyard, passenger routes, ship storage, market, naval training, harbour inn. |
| **Sparta** | (1310,765) | Veteran trainers, armourer, assembly court, monumental mess hall, civilian stories about the absent king. |
| **Ember Quay** | (1290,948) | Black-sand dock, Hephaestian forge, Underworld preparation and diving salvage brought ashore by NPCs. |
| **Kymene** | (1520,710) | Island refuge, chart-maker, repair dock, short island voyages, storm warnings. |

Two special refuges supplement these: Persephone's garden below the earth and the defeated army's captured staging harbour. Both provide recovery without behaving as unrestricted waystones. Asterion has a beach camp, not a normal town or global travel node.

### Coastlines and named islands

Coastline grammar must vary: white headlands and pocket coves; drowned river mouths; limestone arches; broad reed deltas; sheer storm cliffs; black volcanic beaches; tidal flats; reefs enclosing turquoise shallows; and wave-cut tombs. Coast noise alone is not sufficient. Each coast has deliberate beaches, inaccessible cliffs, hazards, mooring points, and navigable water widths.

The **sixteen named smaller islands/islets**, excluding Asterion, are: Kymene, Crete of the Broken Palace, Thalke of the Bronze Giant, Gorgon's Refuge, Erytheia of the Red Herd, the Hesperid Veil, Amazon Anchorage, the Siren Teeth, the Lamp of Delos, Icarian Fall, the Cyclops' Table, the Three Sisters (three individually charted islets), the Drowned Lyre, and the Ash Crown. Additional rock stacks are scenery, not falsely advertised islands.

Each named island gets a landing, recognizable silhouette, one principal discovery, a local story, and at least one meaningful reward or route. Six carry full adventures; the others carry shrines, wrecks, compact caves, fishing settlements, navigation tools, or optional champions. No two islands use the same coast mask with a different palette.

The six full-adventure islands are Crete (Bull and Minotaur), Thalke (Talos), Gorgon's Refuge (Medusa), Erytheia (Geryon), Hesperid Veil (Apples), and Amazon Anchorage (Hippolyta). The Cyclops' Quarry is on the mainland; the Cyclops' Table is a smaller island discovery about the same legend.

**Landmark examples:** the Aqueduct of Nine Echoes; the petrified grove; a ship hanging between cliffs; the Bridge of Supplicants; a half-submerged theatre; an olive tree growing through a bronze helmet; the Colossus's abandoned footprint; Atlas's reflection at sunset; an orchard of names in Asphodel; and a temple frieze that shows the Three Hundred with one empty position. These tell stories without requiring a journal entry for every object.

## 4. Progression: finish the old world, then become a Greek hero

### Entry and completion rules

The border itself is discoverable at any level. The first roadside refuge remains safe. Ordinary Greek enemies begin at 76; a character still progressing through the original game receives clear danger information and no expectation of succeeding there.

The campaign's **Veteran Writ** requires level 75 and permanent victory over The Floor of the World, What Sits in the Weather, and The Remainder. This unlocks Greek commissions, heroic recipes, and ship ownership. It is not a consumable fee or a random drop. The Chronicle lists the exact missing victories and routes back to them.

Before the **Three Hundred**, the player needs all twelve Labour seals, the four additional strategic victories specified below, and the **Old World's Testament**: every authored original dungeon cleared and every original named boss/miniboss victory recorded, including optional duels. This uses a frozen manifest from the pre-expansion release, not a filter that keeps absorbing future content. It excludes repeat kills, random elites, shop completion, perfect item rolls, racial/class permutations, and scenery collectibles. Thus “experience everything else” means completing the game's authored challenges, not an endless checklist.

The four strategic victories are **Python, Medusa, the Minotaur, and the Titan Chain breach in Tartarus**. Talos, Chimera, Cyclops, and the Scylla–Charybdis encounter remain substantial optional adventures; the Chronicle recommends them and their equipment, but no invisible check makes every optional shoreline activity mandatory.

Before the **storm crossing**, all 300 must have been defeated in the campaign encounter, the Stormbreaker ship must be built, and its three integral storm components must be installed. Before **Leonidas**, complete Asterion's three sanctuaries and its six champion trials. Level 100 and a prepared build are strongly expected; the final trial is tuned for them. No paid skip, ordinary ferry, summoned ally, or old portal can satisfy these conditions.

### Levels and build identity

Raise the level cap to **100**. The initial 25 new levels should come primarily from first clears, discoveries, and campaign milestones. Target 25–40 hours to complete the mainland, sea, and Underworld campaign for a prepared level-75 character, plus 6–12 hours for optional discoveries. Final encounter learning may add substantial time; these are test targets, not promises about individual players.

Keep the original class-talent budget at its level-75 total of **120 points**. Levels 76–100 continue controlled stat growth but do not let the player fill the original class tree. At levels 80, 85, 90, 95, and 100, award one **Heroic Mastery choice**. Each opens one of three alternatives; exactly one is active in each row. Choices can be changed at a Greek sanctuary for a modest gold fee. No class retraining erases them.

| Mastery row | Three choices | Purpose |
| --- | --- | --- |
| **80 — Composure** | Better recovery after a well-timed brace; resource return after a clean dodge; faster recovery after leaving a hazard | Choose how to survive pressure. |
| **85 — Exploitation** | Stronger rear attacks; stronger attacks against newly exposed armour; stronger damage after interrupting | Choose how to exploit earned openings. |
| **90 — Expedition** | Better ship repair efficiency; one extra utility-tool charge; reduced attrition from environmental statuses | Choose an expedition advantage, not access permission. |
| **95 — Resolve** | Better stagger resistance while stationary; improved guard-break recovery; resistance immediately after cleansing | Support tank, mobile, and caster approaches. |
| **100 — Legacy** | Extend a personal damage opening; extend a defensive opening; briefly improve allied discipline | Refine a build without granting permanent invulnerability. |

All mandatory encounter tools are granted by their adventures and use a contextual **heroic utility interaction**, not an equipment slot. A fire mage need not unequip their build to cauterize Hydra wounds; a warrior can operate a mirror; a necromancer can perform Cerberus's ward trial. Tool selection outside combat remains available for optional shortcuts.

**Control contract:** E/USE handles the single visibly labelled nearby objective, including picking up and applying an ember or operating a mirror. A brief hold is used only when its duration is shown. A new remappable B/BRACE action provides the universal defensive technique without replacing F/off-hand, Shift/dodge, V/weapon art, or a class skill. Cleanses stay on Q/potion or a chosen artifact; they do not compete with an ember on E. Captain interruption uses normal attacks or the explicitly shown objective interaction. Mandatory tools replenish at their encounter sources; the extra-charge mastery is never necessary to finish a mechanic.

A new remappable X/TARGET action cycles the small set of indicated priority targets (exposed head, captain, weak point), retaining a lock while it remains valid. Ordinary automatic targeting remains the default. The target indicator shows its name and why it matters; target cycling follows a stable order, not distance jitter. For gaze mechanics, defensive facing follows deliberate movement or held Brace direction, independently of the attack sprite's automatic aiming. Touch has equivalent labelled buttons; no tiny monster-head tapping is required.

### Difficulty ladder

| Tier | Expected preparation | Intended feeling |
| --- | --- | --- |
| Threshold / lower mainland, 76–84 | Original endgame equipment, sound fundamentals | Packs punish carelessness; individual ordinary enemies remain quick to defeat. |
| Upper mainland / early Labours, 84–90 | First Greek builds and utility tools | Distinct mechanics, elites, deliberate environment reading. |
| Islands / outer Labours, 90–96 | Reliable ship, several Olympian pieces | Route planning, naval pressure, longer boss sequences. |
| Underworld / late Labours, 94–98 | Twelve-tool vocabulary nearly complete | Resource discipline, route choices, rules of the dead. |
| Three Hundred, 99–100 | Testament, twelve seals, assembled build | Battlefield mastery far beyond any original boss. |
| Asterion and Leonidas, 100 | Completed Greek campaign and island preparations | The game's supreme test; one avoidable mistake is costly, a chain of mistakes is fatal. |

“Nearly impossible” is expressed through layered mastery and narrow but consistent openings, not hidden accuracy penalties or arbitrary immunities. A weak entrant should fail quickly for understandable reasons. A fully prepared expert must be able to demonstrate a clean victory on every class.

## 5. Ships, routes, and monsters at sea

### Four usable ship classes

Ship names below describe game roles, not strict historical reconstructions. All vessels remain solo-playable; hired crew perform their jobs automatically. Ships are owned assets stored at docks, not inventory items that can be carried onto a mountain.

| Vessel | Indicative price | Handling and role | Limitations |
| --- | --- | --- | --- |
| **Coastal Skiff** | 35,000 gold | Nimble, shallow draft, excellent for coves and salvage. One utility fitting. | Low hull, poor storm stability, no heavy ram. Safest in coastal water. |
| **Merchant Roundship** | 180,000 gold | Strong storage and provision capacity; two utility fittings; efficient established routes. | Slow turn and acceleration; vulnerable when surrounded. |
| **War Trireme** | 480,000 gold | Ram, stronger bracing, boarding defence, good battle speed; one combat and one utility fitting. | Deep draft excludes narrow shallows; repair costs higher. |
| **Stormbreaker** | 1,400,000 gold plus campaign components | Hephaestian warship with bronze storm ribs, a Hesperid star-sail, and a lawful Underworld keel-binding. Two combat and one utility fitting. | Required to survive the oath storm; still vulnerable to sea monsters and poor navigation. |

Prices are meaningful expenditure targets to calibrate against actual high-level earnings, not final economy values. First-time ship training loans a skiff in a contained harbour exercise. A guaranteed sequence of commissions funds the first owned vessel. The player cannot strand progression by spending all their gold: land contracts remain available, and established passenger routes remain affordable.

The Stormbreaker's three mandatory **integral components** are distinct from its elective fitting slots: bronze storm ribs from the guaranteed **A Hull That Holds** forge commission after the Augean and Boar Labours; the star-sail from the Hesperides Labour; and the keel-binding rite from Cerberus. The forge commission has fixed materials from those completions and a known gold cost. Talos's bronze-heart fitting is optional and improves performance; it is not a hidden fourth prerequisite.

### Sailing controls and combat

Movement steers; attack fires a crew volley at the current automatic target; heavy attack commits a ram when equipped; off-hand braces against a forecast impact; dodge becomes a short rowing surge with a cooldown; interact docks, boards, or uses a landmark. A ship-specific HUD clearly replaces land ability prompts. Class abilities return during deck encounters and boarding scenes. No control silently performs two conflicting actions.

Two combat formats share one voyage:

- **Hull combat:** steer around threats, turn into or across waves, expose weak points, ram, brace, and fire volleys. A monster's full body need not fit on screen; actionable limbs and impact paths must.
- **Deck encounter:** boarders or a grappling monster hold the ship. The camera moves to a bounded deck arena, the player uses their normal build, and severing anchors releases the vessel. Hull damage is suspended or explicitly forecast during this mode so the player cannot lose to an off-screen simulation.

Tides change optional shallows and wreck access, not mandatory quest availability for hours. Currents create readable route choices. Weather changes lighting, sound, visibility, and steering demands without hiding damage warnings. Sailing stays responsive rather than becoming a detailed wind simulator.

### Distance from mainland is the core sea danger

Sea threat uses a precomputed water-distance field measured from the **connected mainland coast**, not the nearest tiny island. Stopping beside an offshore rock does not turn abyssal water into a beginner region. Local dock safety exists only inside a small marked harbour.

| Water band | Initial distance target | Threat language | Examples |
| --- | --- | --- | --- |
| **Coastal** | 0–32 water tiles | Infrequent but real danger, clear escape to harbours | Reef serpents, predatory crabs, hostile skiffs. |
| **Outer shelf** | 33–96 | More frequent, coordinated attacks and rougher water | Hippocamp raiders, Siren flocks, bronze-beaked fish swarms. |
| **Open sea** | 97–160 | Large monster territories and active currents | Ketos, giant octopus, drowned triremes, storm mantas as an original myth-inspired creature. |
| **Abyssal / oath storm** | 161+ or explicit storm override | Apex encounters, very few safe stopping points | Ancient ketos, Scylla's hunting limbs, Charybdis currents, oathbound sea serpents. |

Distance increases encounter threat and available enemy families monotonically; it does not mean a monster every two seconds. Alternate anticipation, navigation, and combat. Target an encounter opportunity every 90–180 seconds on dangerous routes, with a cooldown after completion and no forced spawn directly beneath a docking player. Monsters are visible through wakes, shadows, sounds, surfacing patterns, or charted territories before engagement.

**Storm approach:** after the Three Hundred, the player sails from the released military harbour at approximately (1530,420), through a controlled route around the Siren Teeth and into Asterion's western landing near (1738,476). Survive three distinct sections: cross-wave timing; a ketos/deck assault; lightning corridors and reef navigation. No additional mandatory sea boss exceeds the army in difficulty.

On first arrival, establish a **beach anchor**. Death on Asterion returns here; death during Leonidas returns to the temple antechamber after it has been reached. A voluntary return to the mainland requires a ship, and the next outbound visit crosses the storm again. A cleared-route option compresses routine segments while retaining one meaningful storm encounter. There is never a mainland-to-temple teleport.

### Ship ownership, failure, and recovery

Hull, fittings, crew assignment, berth, cargo, and checkpoint persist in saves. Crew roles are pilot, shipwright, and lookout; the player recruits characters, not disposable stat cards. One active ship means one set of controls and bounded simulation.

Shipwreck returns the player to the last safe dock with their equipped gear and permanent quest cargo. The ship is recoverable through a known repair cost, never deleted. Ordinary trade cargo can suffer a capped loss disclosed before sailing. Quest seals, storm components, and unique loot cannot be lost at sea. Emergency harbour contracts and a basic loaner prevent a bankruptcy softlock. Costs apply once per wreck transaction, including after reload.

Ferries connect discovered ordinary ports after the first physical voyage. They do not serve Asterion or the sealed military harbour before the army is defeated. Fast travel and boats share one prerequisite system; discovering a name on the map never grants permission by itself.

Before the army victory, the storm boundary is visible from every bearing. Vessel movement, landing, scripted arrival, and recovery all enforce it; the pilot warns and turns the ship safely outward before crossing. An early-built Stormbreaker cannot slip through from another direction.

## 6. Twelve Labours, twelve different adventures

Every Labour has a guaranteed seal, a useful first-clear reward, optional mastery objectives, and repeatable materials. A seal is an achievement, not an item that can be sold. Full quest branches remember completed traversal and unlocked shortcuts. Boss attempts reset combat state without forcing the player to repeat a twenty-minute approach.

The order has three flexible groups: Nemea/Hind/Augeas/Stymphalus; then Boar/Hydra/Bull/Mares; then Hippolyta/Geryon/Hesperides/Cerberus. Unlock conditions form a readable graph rather than requiring the list's exact numerical order. At least two worthwhile adventures should usually be open at once.

### L01 — The Nemean Lion: Hunt the Hunter

**Region / target:** Arcadian Wilds, 79–82. **Verb:** lure. **Map:** outdoor ravines and a den with two entrances.

Find fresh tracks, recognize the territory where the lion circles, and bait its lunges into marked limestone pillars. Its golden hide strongly reduces damage; a collision exposes its underside for an ordinary damage opening. The den's second exit allows it to retreat and reposition until the player seals it using an obvious cave mechanism. The lion never has to be punched by a particular class.

Three iterations teach reading, baiting, then combining the two under pressure. Death resets the den, not discovered tracks. A missed pillar creates another opportunity after recovery; essential columns regenerate at reset. **Reward:** Nemean Mantle recipe and the universal Brace lesson. **Finale preparation:** survives a Spartan shield rush without assuming a shield build.

### L02 — The Lernaean Hydra: The Marsh That Regrows

**Region / target:** Lerna, 87–90. **Verb:** cauterize. **Map:** raised causeways around a flooded circular sanctuary.

Five active heads have separate silhouettes and tells: venom spit, low sweep, lunge, brood call, and constriction. Severing a head creates a wound with a visible 8-second cauterization opportunity. Anyone can take an ember from the arena braziers using the utility action. Failing adds a replacement threat, but the active-head cap is seven; missed mechanics cannot generate unlimited projectiles.

After sealing the mortal necks, lure the immortal central head under a suspended temple slab and imprison it. Visual poison never masks safe floor markings. The outer routes offer alternative crossings for slow and mobile builds. **Reward:** reusable antidote recipe, Hydra Venom infusion, seal. **Finale preparation:** prioritize a temporary objective while the principal enemy remains dangerous.

### L03 — The Ceryneian Hind: A Hunt Without Blood

**Region / target:** Arcadian uplands, 80–84. **Verb:** track. **Map:** three linked clearings and streams.

Follow hoofprints, bent reeds, and wind direction. Approaching too fast raises an alarm meter; moving through cover and approaching from downwind creates a safe path. The final clearing turns the hind's route into the sequence for activating sanctuary stones. Defend the sleeping animal from hostile oath-echoes after it has been safely enclosed.

The hind is not an attack target. Alarm returns it to the current clearing's entrance, never to a random location across the world. Clues remain visible in reduced-effects mode and do not depend on audio. **Reward:** Artemis's Trail, which reveals nearby hidden paths, and a mobility relic. **Finale preparation:** observe before committing and identify false or distracting targets.

### L04 — The Erymanthian Boar: Break the Avalanche

**Region / target:** Olympian Escarpment, 86–89. **Verb:** corral. **Map:** snowy switchbacks and three avalanche bowls.

Use horn posts and position to steer the boar through breakable snowbanks. It creates shortcuts and threats as it charges. Lead it into deep snow, survive the resulting avalanche lanes, and close three timber barriers. Killing other creatures makes room; damaging the boar alone never completes the capture.

A broken pen reopens its own section. Fall recovery uses the last stable ledge; the approach shortcut stays open. Mandatory lanes have readable snow cracks and adequate crossing time. **Reward:** reinforced hull strakes and cold-resistant equipment recipe. **Finale preparation:** manipulate a charge without being carried into a hazard.

### L05 — The Augean Stables: The River Remembers

**Region / target:** Two Rivers, 81–85. **Verb:** divert. **Map:** a massive estate with a readable water-flow diagram.

Inspect the two rivers, open sluices, remove blockages, and route water through corrupted courtyards. Each intervention changes which platforms are dry. Guardians protect mechanisms, but defeating all guardians does not substitute for cleaning the estate. The finale releases three reservoirs in sequence, requiring safe positioning before each flood.

Controls are reversible; water cannot permanently strand an objective. Completed sluice sections persist. Once restored, visible crops, NPC routines, and clean water replace parts of the corruption. **Reward:** settlement cleansing wells and a utility cleanse with a cooldown. **Finale preparation:** use an arena's machinery deliberately instead of treating it as decoration.

### L06 — The Stymphalian Birds: The Bronze Sky

**Region / target:** northern Lerna wetlands, 83–87. **Verb:** sound. **Map:** reedbeds, stone arches, and resonator islands.

Strike bronze resonators to lift selected parts of the flock out of cover. Airborne birds counterattack with feather lanes. Each resonator changes the safe route to the next, so the player alternates exposing enemies, attacking, and taking shelter. The finale combines three flock formations with distinct calls and shapes. It does not introduce a giant ordinary bird as a substitute mechanic.

Overusing a resonator creates a warned local barrage, not unavoidable damage everywhere. Flock damage is aggregated to prevent dozens of overlapping tiny hits. **Reward:** bronze-feather ammunition and a ship signal that scatters minor flying attackers. **Finale preparation:** interpret volley lanes and preserve useful cover.

### L07 — The Cretan Bull: The Palace in Its Path

**Region / target:** palace island, 89–92. **Verb:** redirect. **Map:** ruined palace, volcanic vineyards, and destructible courtyards.

Use the bull's locked charge to break marked walls, free passages, and expose binding pylons. Destruction order affects the final arena. Some walls are valuable cover, so indiscriminately demolishing everything creates a harder fight. The bull is secured by collapsing three pylons around it after their anchors have been exposed.

A reset shrine restores the arena before a retry; objective-dependent walls cannot create an impossible layout. **Reward:** ram fitting and Bullhorn weapon component. **Finale preparation:** bait a powerful enemy into destroying the right environmental object.

### L08 — The Mares of Diomedes: The Iron Paddocks

**Region / target:** northern military coast, 89–93. **Verb:** contain. **Map:** fortress paddocks, feed chutes, loading bridges, and an escape route.

The fortress entrance is on the ordinary coast with a mainland approach, outside the Three Hundred's sealed staging harbour. It is fully reachable before the army battle.

Four named mares behave differently: one pursues movement, one breaks gates, one rallies the herd, one guards a fixed territory. Rescue captives, separate the animals, and keep handlers from reopening enclosures. Secure all four in warded paddocks and defeat their commander; victory never requires sacrificing a captive.

Freed captives take shelter and operate gates on the escape route. They cannot die off-screen while the player is solving another paddock. Breaches cause local problems that can be repaired. **Reward:** a limited-use tether and cavalry-resistant gear. **Finale preparation:** contain secondary threats without trying to damage everything at once.

### L09 — Hippolyta's Girdle: The Queen's Measure

**Region / target:** Amazon Anchorage, 92–95. **Verb:** command. **Map:** a living Amazon port and ceremonial battle terraces.

Hippolyta awards her girdle for a formal trial: escort a standard, hold rotating objectives, and direct a small allied squad with advance, defend, and regroup orders. An oath-illusion introduces false standards and orders with consistent visual tells. A final nonlethal duel tests flanking and discipline.

Each round restarts independently. Ally pathfinding cannot fail the quest: stuck allies reform at a safe rally point. **Reward:** command relic and a captain-interruption utility upgrade. **Finale preparation:** understand why a formation is stronger than its individual soldiers.

### L10 — Geryon's Cattle: The Red Herd

**Region / target:** Erytheia, 93–96. **Verb:** convoy. **Map:** crimson cliffs, tidal flats, and three causeways.

Defeat Orthrus, gather the herd, and move it between refuge bells. Geryon's three linked bodies divide their attention between attacking the player, blocking the route, and scattering the herd. Expose and interrupt the correct body rather than tunnelling a single health bar. The final battle combines all three on a broad causeway.

Scattered cattle can be recovered. Failing a crossing returns the herd to its previous refuge; it does not erase the island expedition. **Reward:** greater ship provisions and a three-part relic crafting component. **Finale preparation:** track multiple coordinated threats while maintaining an objective.

### L11 — The Hesperides' Apples: The Weight of Heaven

**Region / target:** Hesperid Veil, 95–98. **Verb:** bear. **Map:** a twilight garden beneath a visible celestial vault.

Briefly bear Atlas's burden at anchor platforms. Holding the sky reveals constellations and opens star bridges while draining a clear endurance reserve. Relay celestial light between supports and use mirrored moonlight to divert Ladon, the garden's immense guardian. The climax combines route memory with short defensive fights, not a mandatory infinite-health dragon.

Exhaustion returns the player to the last anchor. Route clues remain; rare healing items are not needed to solve the puzzle. **Reward:** golden-apple restorative recipe and the Stormbreaker's star-sail component. **Finale preparation:** ration a resource while reading several future movements. No Primordial gear comes from this garden.

### L12 — Cerberus: Leave Death Its Guardian

**Region / target:** gates of Hades, 96–98. **Verb:** subdue. **Map:** a monumental gate court and a short ascent toward daylight.

Hades grants a lawful trial. Within the marked court, a taught ward-and-restraint action replaces the weapon attack; the HUD and touch controls explicitly change. Bait the three heads into exhausting their coordinated attacks and place three restraints during recovery. Escort the subdued guardian through shifting gates, then return him to his duty.

This is the sole temporary combat-rule change and includes an immediate practice round before the real trial. It does not inspect the player's weapon type. Death or agitation failure offers a gate-side retry without another ferry payment. **Reward:** final seal, fear-resistant relic, and the keel-binding rite for the Stormbreaker. **Finale preparation:** recognize an opening that is earned through defence rather than damage.

The trial court suspends offensive ability damage, autonomous summon attacks, damage-over-time, and weapon/enchantment procs consistently. Defensive movement and the taught ward/restraint actions remain available. Companions wait at the court boundary and cannot accidentally fail the trial. Exit, death, or cancellation restores the original action set and summon rules without losing the player's equipped build.

## 7. Additional mythological dungeons

These eight substantial adventures bring the expansion to **20 authored adventure sites**, in addition to the army battlefield, Asterion's temple complex, and compact island discoveries. Each uses its own victory rules.

| Site | Mechanic and layout | Failure/retry | First-clear value |
| --- | --- | --- | --- |
| **Python beneath Delphi** (86–90) | A spiral fissure where Python's body blocks routes. Vent oracle fumes, read its coil, and open safe attack platforms in sequence. | Vents reset for each boss attempt; unlocked descent remains open. | Oracle seal; campaign victory; reveals Labour groups. |
| **Medusa's House of Reflections** (92–95) | Petrified courtyards and rotating bronze mirrors. Gaze raises a visible petrification meter; facing away, cover, or reflected light clears pressure. Weapon auto-aim must not force facing into a gaze. | Full petrification is a warned lethal failure; restart at foyer. Mirror layout resets consistently. | Gorgon Lens; campaign victory; safer storm navigation sighting. |
| **The Living Labyrinth / Minotaur** (93–96) | A bounded maze with rotating gates; player lays Ariadne's thread at junctions. The Minotaur learns paths and breaks selected walls. The final arena is reached by manipulating pursuit. | A limited set of authored layouts guarantees connectivity; thread and found refuges persist on death. | Thread of Return; campaign victory; ship emergency recall upgrade. |
| **Chimera's Three Horizons** (92–96) | Switch between high ledges, middle terraces, and low channels via short ramps. Lion, goat, and serpent aspects threaten different bands. Bait breath to ignite the correct vents. | Arena reset restores vents and cover; no jump/platform precision required. | Chimera Furnace crafting station. |
| **The Cyclops' Quarry** (88–92) | A siege puzzle across block cranes and stone conveyors. Build cover, lure thrown boulders into counterweights, expose the Cyclops' eye after a missed attack. | Cranes return to solvable positions; no permanent resource spending to retry. | Quarry hammer and lower material-processing costs. |
| **Talos, the Walking Coast** (94–98) | A bronze giant patrols an island perimeter. Travel between three coastal stations, survive changing stomp/tide zones, and expose the ankle seal. Use its route as a moving dungeon. | Restart patrol segment at last station, not the harbour. | Bronze-heart fitting; powerful optional Olympian off-hand. |
| **Scylla and Charybdis** (96–100) | Ship encounter through a branching strait: limb attacks on one shore, a cyclical vortex on the other. Choose a line, brace, cut grapples, cross during the current reversal. | Return to sheltered inlet; hull repairs capped for this encounter. | Master navigator charter and deep-sea salvage access. |
| **The Broken Titan Chain** (97–100) | Tartarus containment emergency. Traverse chain bridges, repair three immense anchor seals, and fight escaping horrors while a distant Titan pulls the space apart. The Titan itself is not a farmable god-boss. | Each repaired anchor is a durable expedition checkpoint; final containment restarts locally. | Campaign victory, final forge catalyst, access to advanced Olympian recipes. |

All puzzle states support keyboard and touch. No essential clue is conveyed solely by colour, sound, a moving particle, or a small tooltip. Puzzle assistance can repeat the rule or highlight the next interactable after repeated failures; it does not lower combat difficulty invisibly.

## 8. The Underworld: the requested hell, in Greek form

The descent begins in Taenarum's sea cave on the Ashen Peninsula. Walk down past the last daylight, pay Charon once for the expedition charter, and arrive among reeds that move without wind. Beyond them are whole cities' worth of shades.

Five linked spaces form the Underworld campaign:

1. **Acheron's Landing:** ferry, first refuge, missing-name stories, and teaching for soul currents. The fee is a small repeatable gold expense only for optional new expeditions; mandatory retries do not re-charge it.
2. **The Asphodel Fields:** pale meadows, ruined civic spaces, drifting memories, and shades whose names determine which doors they can cross. Quiet exploration alternates with predatory Keres and oath-damaged dead.
3. **Persephone's Garden:** a functioning refuge with pomegranate trees, storage, recovery, and restrained colour. It offers context and choices, not a marketplace full of stronger versions of everything.
4. **The House of Hades:** ceremonial courts and the Cerberus trial. Rules are explained by judges and demonstrated in short safe examples. Completing a bargain permanently opens the route.
5. **Tartarus:** immense bronze gates, chains vanishing into darkness, Phlegethon's fire channels, crushing wind, and distant beings too large to fit in an arena. This is the expansion's hell: punitive, oppressive, and dangerous.

Tartarus has three compact optional challenges: **Sisyphus's Ascent**, using the returning boulder as moving cover; **The Empty Banquet**, resisting false restorative shrines while identifying a safe route; and **The Danaids' Cistern**, balancing leaking channels while defending the actual seal rather than mindlessly filling vessels. They add relic materials and stories, not additional required Labour seals.

Underworld pressure is **Lethe exposure**, accumulated in marked rivers and memory storms. It temporarily obscures optional map detail and increases recovery costs; it never deletes the player's real items, completed quests, control bindings, or knowledge of exits. Visible refuge stones clear it. There is no invisible timer forcing speed-running through dialogue.

Returning from the Underworld changes the surface: certain shades depart, memorials acquire names, an abandoned ferry begins running, and Sparta's archivist recognizes the player as someone the dead permitted to leave.

## 9. The Three Hundred — The Wall That Walks

### Encounter identity

This is the first of the two apex encounters: a **multi-stage solo battlefield**, dramatically larger than the original game's bosses. The army occupies the **Gates of the Last Shore**, a broad coastal fortification whose final harbour controls the safe route toward Asterion. Its oath standards also maintain the storm barrier; physically sailing around the fort does not open the island.

The player sees the army assembled before entering. Shields settle into place, captains take position, and distant ranks answer the command. Their size comes from supernatural transformation: ordinary warriors stand about 1.4 times player height, champions about twice it. Their silhouettes, reach, acceleration, and discipline distinguish them from reskinned bandits.

### Exactly 300

Ten companies of thirty, each with a persistent identity:

| Role per company | Count | Behaviour |
| --- | --- | --- |
| Oath hoplites | 20 | Link shields, thrust over front ranks, rotate wounded positions. |
| Red-cloak runners | 4 | Flank, punish prolonged stationary casting, retreat behind shields. |
| Javelin specialists | 3 | Telegraph volley lanes and reposition before firing again. |
| Great shieldbearers | 2 | Anchor a line, push cover, become vulnerable while turning. |
| Captain | 1 | Issues one visible formation order and has a distinct interruption opening. |
| **Total** | **30 × 10 = 300** | No infinite replacement soldiers. |

The company names are Bronze, Reed, Ash, Laurel, Wolf, Tide, Ember, Stone, Sun, and Crown. Defeating a captain disrupts his company but does not delete its remaining men. All 300 must actually be overcome. Shields, siege machines, illusions, and environmental objects never contribute to the soldier counter.

Show **300 standing**, current company integrity, and the immediate objective. Do not draw 300 health bars. Individual enemies remain valid targets; company integrity describes formation strength, not a substitute shared damage pool.

### Four battlefield chapters

| Chapter | Companies / soldiers | Battlefield and tactical problem |
| --- | --- | --- |
| **I. The Bronze Door** | Bronze + Reed = 60 | An approach courtyard. Learn to bait a shield push, break its flank, and interrupt a re-form command. Two broad side lanes prevent one compulsory build. |
| **II. The Red Terraces** | Ash + Laurel + Wolf = 90 | Advance through three terraces while avoiding coordinated javelin lanes. Move between durable cover and dismantle signal braziers. Their destruction changes volley patterns, not roster count. |
| **III. The Turning Wall** | Tide + Ember + Stone = 90 | A circular field where companies change facing and attempt encirclement. Capture temporary rally ground, split two formations, and control runners before attacking a captain. |
| **IV. The Last Sixty** | Sun + Crown = 60 | Descend to the harbour. Veteran companies combine the earlier tactics. The two final captains fight together while their remaining soldiers defend their retreat lines. |

Target a learned complete run of **16–24 minutes**, with chapters of roughly 4–6 minutes. Clear checkpoints exist only after whole chapters: 60, 150, 240, and 300 defeated. A chapter wipe restores that chapter's roster; it never resurrects earlier completed chapters. No campaign credit comes from repeatedly killing the first five men and dying.

Between chapters, a captured rally shrine refills resources and offers a save-and-exit. It is not reachable during the active chapter. Base completion can span sessions. An optional **Unbroken Standard** challenge requires all four chapters consecutively with no death; it awards a title and cosmetic, never an item required to face Leonidas.

### Formation rules and counters

- A linked frontal shield wall reduces incoming frontal damage heavily, initially targeting 70%. Flank and rear hits are fully effective; the player can see shield facing.
- Heavy attacks, spell pressure, and repeated ranged weak-point hits all build a shared **formation-break** meter. No class requires a borrowed melee weapon.
- Orders have a banner, sound, text cue, and about 1.2–1.6 seconds of warning. Interrupt the captain, leave the marked charge lane, or use prepared cover.
- A broken formation has a short, reliable damage opening before a warned regroup. The formation cannot instantly rotate to track every player movement.
- Runners prefer harassment; they do not all dash simultaneously. Javelin groups reserve attack lanes so unavoidable crossfire cannot fill every exit.
- The challenge comes from combinations and changing geometry. The final companies are smarter and faster within a tested limit, not ten times healthier.

At most **36 fully simulated hostile soldiers** are active near the player, plus a bounded number of friendly summons. Reserves exist as individual roster entries and distant low-cost rank visuals. They deploy through visible routes. Every roster member becomes a real defeatable combatant; distant decorative men neither take phantom damage nor attack unseen.

Completing the army releases the harbour, lowers the oath barrier, awards the **Seal of the Three Hundred**, and grants a choice of an Olympian formation relic or equivalent weapon recipe. It records one encounter victory and one normal boss-equivalent warrant, not 300 warrants or 300 boss loot explosions. Rematches pay a controlled encounter reward; first-clear rewards cannot duplicate.

## 10. Asterion and Leonidas — King of the Last Oath

### The island before the king

Asterion is itself the final expedition. The storm crossing reaches the **Harbour of Broken Oars**, then routes divide through the **Red Cypress Vale**, the **Necropolis of Shields**, and the **Sky-Split Stair**. All reconnect at the **Temple of the Last Oath**, visible high above the island from the moment of arrival.

Three sanctuaries teach the temple vocabulary and provide the only pre-Leonidas Primordial rewards:

- **Athena's Broken Aegis:** mirror and facing trial; guarantees the **Mirror of the Last Dawn**, a Primordial off-hand.
- **The Forge Without Fire:** a forge fed by oath-light, guarded by bronze wardens; guarantees **Oathforged Panoply**, Primordial armour.
- **The Well of Unspent Names:** a procession through the necropolis with a containment encounter; guarantees **Ember of the First Oath**, a Primordial artifact.

Six named island champions test spear spacing, shield-breaking, pursuit, volley reading, add control, and hazard routing. They grant guaranteed preparation materials and unlock temple route shortcuts. These trials are hard but shorter than the army. No mandatory weapon upgrade above Olympian is needed for the first Leonidas kill; Primordial weapons come from the king.

The island has separate **Royal Guard** soldiers, not resurrected members added back to the defeated Three Hundred. Their loyalty is shown through protection and sacrifice. All island rewards may be carried elsewhere after earning them, but no mainland shop, random loot roll, ordinary forge, royal warrant, or off-island salvage source can create a Primordial item.

### Arena and presence

Leonidas stands roughly three times the player's height, with a broad shield, a spear taller than a house door, a scarred bronze cuirass, and a cloak that drags across the temple floor. His silhouette must read clearly at ordinary camera zoom. Camera framing expands gently for the arena, never shrinking the player into an unreadable dot.

The temple consists of a monumental approach and a combat court of approximately **40 × 30 tiles**, with a throne dais, four oath braziers, eight major pillars, two side galleries, and visible trap channels in the floor. Its outside complex spans far more ground than the combat court. Scale comes from architecture, approach, sound, and set pieces as well as the boss sprite.

The combat court includes:

- **Spear channels:** floor lanes light, then erupt. Their route is fixed when warned.
- **Sun mirrors:** redirect one divine beam when faced correctly; every class can interact with them.
- **Storm conductors:** lightning first marks a conductor and its affected lane; move, ground it, or lure the king's attack into it.
- **Oath braziers:** empower a specific move, with a visible link. Extinguishing one temporarily changes the move and creates an opening; it does not permanently disable the whole fight.
- **Breakable columns:** cover against selected attacks. The encounter reserves enough usable cover or an alternate safe route in every state. Critical cover cannot be destroyed into an unwinnable configuration.

### Six phases, one continuous victory

Target a **10–14 minute learned clear**, with a soft escalation after approximately 15 minutes and a capped 18-minute failure sequence only if playtesting shows it improves the fight. There is no endlessly compounding speed/damage multiplier. The final values depend on measured full builds.

| Phase / health | Identity | Required mastery |
| --- | --- | --- |
| **I. The King Who Stands — 100–82%** | Precise spear combinations, shield checks, deliberate pauses. He establishes reach and punishes automatic attack spam. | Learn which combination ends in an opening; manage distance and stamina. |
| **II. Bronze Against Heaven — 82–64%** | The shield links to two braziers. Spear channels and mirror beams activate. | Break a link through an arena action, then exploit a short shield opening. |
| **III. No Man Abandoned — 64–42%** | Twelve Royal Guards enter in two groups of six. Some defend him, some pressure the player. He advances to cover an exposed standard-bearer. | Separate protection from damage threats; interrupt a visible oath chant. |
| **IV. The Storm Kneels — 42–18%** | The roof opens, storm conductors activate, and the arena loses selected outer cover. Leonidas hurls and recalls his spear. | Read the outbound and returning paths, manage lightning lanes, preserve the centre route. |
| **V. The King Alone — 18–5%** | The remaining guard withdraws or falls; shield damaged, king faster and exposed. Previously learned combos link into short sequences. | Use earned damage windows without being baited by false recovery poses, each consistently signalled. |
| **VI. The Last Oath — 5–0%** | A final, deterministic three-pattern sequence; temple sound recedes to footsteps and shield strikes. | Execute the full vocabulary under pressure. No surprise full-health second boss. |

Phase thresholds are processed once. A large burst may deal strong damage but cannot skip the introduction of a required phase; limited overkill carries into the next phase instead of silently vanishing. Phase protection lasts only for its short, explicit transition and ends on the defined event. Boss health never refills to full between phases.

In the last 5%, victory explicitly requires completing the three-pattern Last Oath sequence. The HUD shows that requirement. Damage remains credited in a bounded pending pool, but neither a proc nor a summon can resolve death before the sequence finishes. Afterward, pending damage applies, potentially ending the fight immediately. The sequence is identical across weapon types and cannot loop indefinitely.

### Signature moves

| Move | Warning target | Resolution and counter |
| --- | --- | --- |
| **Royal Measure** | 0.8-second spear line, then two distinctly paced follow-ups | Sidestep the thrust; dodge or block the follow-up; attack after the third strike. Initial target direction locks before impact. |
| **Bronze Verdict** | Shield plants and a broad cone marks over 1.2 seconds | Move behind or clear the cone. A well-timed Brace survives at a resource cost; ordinary blocking alone is insufficient. |
| **The Returning King** | Spear outbound lane plus delayed return indicator | Dodge each path; its return uses the actual spear route, not invisible homing onto the current player. |
| **Hold the Line** | Guard banner and 1.5-second voiced/text order | Interrupt the standard-bearer or leave the linked formation lane. Killing random guards is not the only answer. |
| **No Man Abandoned** | A visible oath link to a kneeling guard | Interrupt to prevent one capped 6% heal per guard wave; twelve finite guards, no infinite heal engine. Phase state never rolls backward after healing. |
| **Debt to the Sky** | Conductor hum, marked lightning lane over 1.8 seconds | Ground the marked conductor or lead the king through its strike zone. The latter earns a larger opening but is riskier. |
| **The Temple Remembers** | Braziers announce a learned earlier pattern | Recognize and solve it with the same rules. No brand-new mandatory mechanic appears after phase IV. |
| **Last Oath** | Three individually displayed patterns, with brief transitions | Complete the final sequence; failure deals severe damage and can kill, but never changes rules halfway through a tell. |

These timings are starting targets. Ordinary counterplay should be possible by movement, blocking, or a dodge within the existing control system; no mandatory input asks for an undocumented sub-100-millisecond reaction. High-damage hits target roughly 40–65% of a prepared character's health after relevant mitigation. Ordinary attacks target 15–30%. A few clearly announced executions can kill outright after a missed multi-step defence. Damage is tuned against archetypes, not automatically scaled to each player's maximum HP.

### AI and fairness

Leonidas chooses from a authored **attack grammar**: opener, branch, recovery, pressure response. He can respond to prolonged distance, healing, and repeated positioning, but commits to a visible move before impact. He does not read button presses, cancel a committed attack to punish the chosen dodge, or choose a counter after seeing the player's unavoidable movement.

There is always at least one reachable counter to combined boss/guard/trap actions for the reference slow build. A scheduler prevents incompatible hazards from occupying every safe route. Adds and traps have attack budgets. Lifesteal, damage-over-time, minions, multi-projectile weapons, crowd control, and attack speed are tested explicitly; a tiny per-hit damage cap must not arbitrarily favour many small hits over a heavy weapon.

Full victory has no mid-fight health checkpoint. The antechamber offers free **practice echoes** of reached phases, with no loot or progression credit. Real attempts restart at phase I with the normal consumable rules. Permanent island preparation stays done. Supply caches make the first learning attempts affordable, and temple supply crafts provide a controlled repeatable source; player investment should be in learning rather than repeated ocean crossings.

### Victory and aftermath

On defeat, Leonidas remains standing long enough to lower his spear. The oath transfers from one unending guardian to a restored realm capable of defending itself. The permanent storm breaks into ordinary severe weather, parts of the island become calmer, the coast gains returning ships, and Sparta lights its beacon.

Rewards: the **Oath of the Unbroken** title; an armour appearance; a temple memorial recording the character; a guaranteed choice among six Primordial weapon patterns; and a non-random king's catalyst for forging the chosen weapon at the island's forge. The reward is chosen after seeing full stats and abilities. Inventory-full handling uses a persistent reward claim, so the game's greatest prize cannot disappear on the floor.

Rematches are oath echoes at the temple. Their first-clear identity, story ending, and original-gate permissions stay permanent. Optional challenges grant appearance variants and alternate weapon choices. They never introduce a stronger hidden boss that makes Leonidas cease to be the game's summit.

## 11. Equipment, crafting, and the expensive endgame

### Two new rarities

The current game calls its highest tier **Mythic**. The full sequence becomes Common → Rare → Super Rare → Epic → Legendary → Mythic → **Olympian** → **Primordial**.

| Tier | Identity / presentation | Sources | Initial power and slots |
| --- | --- | --- | --- |
| **Olympian** | Ivory-gold text with a restrained blue divine accent; laurel rarity emblem | Authored Greek bosses, late Labours, earned divine-forge recipes | Weapon/armour rarity factor 1.52 versus current Mythic 1.38; 4 affixes; 4 enchant slots; one authored power |
| **Primordial** | Dark bronze/obsidian ground, pale starfire highlight; broken-circle emblem | Asterion's three sanctuaries and Leonidas only; relevant forging performed on Asterion | Initial factor 1.68; 4 affixes; 4 enchant slots; a stronger authored power or upgrade of it |

The factors are controlled increments, approximately 10% per tier at equal level, not enormous multiplicative leaps. Entire builds must be measured: a special power, extra enchantment, and base stat increases all consume the same practical power budget. Mythic, Olympian, and Primordial remain outside ordinary random rarity rolls. A generic upgrade service cannot promote an arbitrary sword into the top tiers.

Top-tier gear has **explicit acquisition provenance**. A Primordial template can only be instantiated by an allowed island reward or island forge recipe. A different drop colour on mainland gear is not a permitted shortcut. Debug creation is clearly marked as debug and excluded from normal progression verification.

### Weapons and build rewards

Preserve all current weapon families. Add two actual mechanics: **throwing javelins** (aim-assisted throw, limited ready charges with recovery) and **chain blades** (shorter pull/cleave rhythm, with bosses resisting forced displacement). Other Greek weapons use existing kinds with new art and authored weapon arts, avoiding a large set of mechanically identical types.

| Item | Tier / source | Play identity |
| --- | --- | --- |
| Dory of the Dawn | Legendary / early commissions | Long thrust; clean spacing grants a short next-strike bonus. |
| Kopis of the Nemean Hunt | Olympian / lion recipe | Curved sword; a successful baited dodge primes a flank cut. |
| Hydra's Last Fang | Olympian / Hydra | Dagger; venom intensifies against exposed targets, with bounded stack count. |
| Artemis's Silver Bow | Olympian / Hind | A fully prepared shot marks one target; disciplined follow-up outperforms indiscriminate spam. |
| Thunder Javelins | Olympian / mountain trial | Throw and recover; a recalled spear charges a short lightning line. |
| Hephaestus's Measure | Olympian / forge campaign | Hammer; staggered enemies release a bounded short shockwave. |
| Staff of the Delphic Breath | Olympian / Python | Alternate projectile and small oracle field; movement through the field restores limited mana. |
| Lyre of the Drowned | Olympian / island discovery | Tome-like off-hand; timed pulse weakens a volley rather than charming every boss. |
| Aegis of the Clear Mind | Olympian / Medusa | Shield; successful facing defence clears petrification pressure and offers a short opening. |
| Thread of Ariadne | Olympian / Minotaur artifact | Mark a safe nearby point; return within a brief duration, with range/collision checks. Cannot cross locked doors, seas, or encounter boundaries. |
| Chains of Prometheus | Olympian / Tartarus | Chain blades; reward alternating close strikes and short retreats. No permanent boss stun. |
| Girdle of the Amazon Queen | Olympian / Hippolyta armour | Movement and ally discipline; useful without forcing a summon build. |
| Mirror of the Last Dawn | Primordial / Asterion | Off-hand; well-timed reflection creates a personal opening. Other top-tier off-hand alternatives unlock on later island victories. |
| Oathforged Panoply | Primordial / Asterion | Armour; a correctly timed defence stores a limited guard charge. |
| Ember of the First Oath | Primordial / Asterion | Artifact; converts earned interruption/stagger into a brief chosen offensive or defensive effect. |

**Leonidas's six weapon choices:** King's Dory (spear and precision); Last Dawn Kopis (sword and counterattack); Bow of the Storm-Cleared Sky (ranged); Sceptre of the First Flame (magic); Twin Oathblades (dexterity/chain); and the Unbroken Standard (halberd and allied discipline). These are weapon archetypes, not class locks. First victory guarantees one; repeat earned catalysts unlock alternatives without gambling for the correct class.

The later Primordial off-hand alternative is a sanctuary-rematch recipe redeemed at Asterion's forge. Island champions grant materials and proofs, not unlisted top-tier drops. [CONTENT.md](CONTENT.md) enumerates all 36 launch equipment identities and their sources.

### Resources and craft

Four principal new materials keep the system understandable: **Aegean Bronze**, **Ambrosial Resin**, **Stygian Glass**, and **Oathsteel**. Labour trophies are unique recipe unlocks recorded in the Chronicle, not stacks competing with potions. Oathsteel comes only from Asterion and cannot be bought offshore.

Greek crafting has three services: a regular forge for level growth and Greek baselines; a divine forge for deterministic Olympian recipes after their proofs; and the island oath-forge for Primordial rewards. Recipes state the source of every ingredient. A missing ingredient links to its discovered region or encounter, never an unexplained database name.

Four new useful consumables: diluted ambrosia (recovery), moly draught (temporary curse resistance), hydra antitoxin (poison handling), and golden-apple preparation (strong recovery with a meaningful cooldown). They obey shared recovery constraints; stacking four potion categories must not create infinite sustain. Optional consumables make mistakes less costly, not replace mandatory tools.

### Economy rules

Indicative sinks: major ship purchases above; 25,000–90,000 gold for significant ship fittings; 80,000–180,000 for an Olympian consecration; 250,000–450,000 plus Oathsteel for an island weapon craft. A full prepared expansion run should spend several million gold across travel, craft, and shipbuilding. Whether these prices are correct depends on measured income from the actual game.

Balance against three players: modest savings on reaching 75, a wealthy completionist, and a returning save with excessive old income. The first can progress through guaranteed commissions; the second enjoys early convenience; the third cannot buy seals, the army victory, or island-exclusive provenance. Do not require hours of trivial old-world farming to pay for attempts.

Merchants specialize by place. The shipwright does not sell divine swords; Sparta sells martial baselines; Delphi offers recipes and lore; Hades' realm exchanges limited crafted offerings. Reputation unlocks information, appearances, sidegrades, and modest discounts, never the sole viable answer to a boss.

**Existing forge correction is a prerequisite:** repeated 11% stat multiplication per item level currently makes some reforged relics far stronger than the authored curve. The expansion must move to versioned, curve-based stat reconstruction and migrate those items transparently before its difficulty can be meaningfully tested. Keep the item, identity, level, enchant choices, and investment record; back up saves, show changed stats, and provide a documented compensation rule if migration removes paid excess. Do not silently assume all level-75 saves have comparable equipment.

## 12. Quest structure and people

### Campaign dependency graph

```text
Level 75 + three original apex victories
  -> Veteran Writ -> Thyra -> Aigialos and initial Labour group
  -> four early Labours + Python -> second Labour group / expanded sea charts
  -> ship progression + eight seals -> outer-island Labours / Underworld charter
  -> twelve seals + Medusa + Minotaur + Titan Chain
  -> Old World's Testament -> Gates of the Last Shore
  -> all 300 defeated -> released harbour + Stormbreaker commissioning
  -> storm crossing -> Asterion's 3 sanctuaries + 6 champions
  -> Leonidas -> realm restoration + optional oath rematches
```

Ship components are earned before the army; final commissioning can happen after it. If the player has the money and components early, they can construct the hull early, but the storm barrier remains. This avoids pretending that a missing ship model is the only thing preventing a geographic bypass.

The eight campaign chapter records contain roughly **32 meaningful objectives**; they reuse and explain the twelve Labours and four strategic victories rather than adding duplicate errands. The initial content commitment also includes **16 side stories**, **12 repeatable contract templates**, and **24 short discovery entries**. These are separate counts, not 84 identical kill quests.

### Sixteen side stories

| Story | Player action and lasting result |
| --- | --- |
| The Lighthouse That Lies | Compare beacon colours against wreck records, expose a false light, restore a safe ferry route. |
| A Ship for the Names | Recover crew identities from three nearby wrecks; their memorial unlocks a lookout recruit. |
| The Last Olive Tree | Defend an old grove by redirecting fire channels; restore a small refuge. |
| The Bronze Bell | Reassemble a harbour warning system during a contained monster assault; improve local storm warnings. |
| Wine for the Satyrs | Negotiate a safe festival route through a short misdirection puzzle; gain a satyr guide, not a collection quota. |
| The Centaur's Broken Bow | Choose a respectful duel or help defend a pass; unlock a ranged training ground. |
| A Seat at the Mess | Win three distinct Spartan trials and hear soldiers' families; acquire army lore and a cosmetic. |
| The Mother's Shield | Carry a named shield to a reachable memorial; a quiet story with a defensive recipe. |
| The Shipwright's Daughter | Free an engineer through a workshop hazard puzzle; unlock efficient repairs. |
| The Drowned Theatre | Restore three acoustic devices to reveal a hidden performance and remove a local Siren hazard. |
| Icarus Fell Here | Recover a sun-damaged navigation instrument from cliffs; improve chart reading without giving flight. |
| The Debt of Charon | Return a misplaced coin ledger; establish a permanent ferry entitlement. |
| The Unnamed Soldier | Find a shade's identity through evidence; put a name on Asphodel's road and open a shortcut. |
| Persephone's Winter | Carry living light between three garden beds while defending the channels; improve the refuge. |
| A Letter Never Sent | Deliver a dead sailor's account to the archive; a new dialogue changes the understanding of the oath. |
| The Empty Place | Investigate the missing figure in the army frieze; discover why the oath needs a successor and unlock a memorial appearance after victory. |

Twelve contract templates cover escorting a coastal supply boat; hunting a marked monster; clearing a reef passage; rescuing a stranded crew; recovering a dangerous cargo; defending a beacon; containing a shade breach; interrupting a raider formation; repairing a sabotaged aqueduct; transporting temple offerings; clearing a blocked mountain route; and a bounded arena trial. Templates vary placement and modifiers while paying controlled rewards. No real-time daily login is required.

### Named cast

**Ione**, the practical harbour-master, teaches ships; **Thaleia**, the engineer, explains rivers and repairs; **Meles**, a retired Spartan, teaches formation reading; **Kallianeira**, the archivist, tracks the Testament; **Damon**, the smith, works Greek baselines; **Pythia**, the oracle, interprets the oath without dictating every destination; **Naus**, a weathered pilot, charts dangerous routes; **Melantho**, a shade who remembers everyone's name but her own, guides Asphodel; and **Aster**, a royal guard captain on Asterion, offers the final warning without betraying his king.

Routine traders and citizens follow anchored schedules within their own settlements. Doors, service signs, inn/storage behaviour, and readable settlements retain the strengths of Ashvale's existing design. New coordinates must be settlement-relative, not copied absolute positions.

## 13. Enemy ecology, presentation, and accessibility

### Combat families

Target **30 new non-boss archetypes**, organized into ten families of three. Variants can share animation infrastructure, but each archetype must change decisions rather than just tint a sprite.

| Family | Three archetypes | Distinct decision |
| --- | --- | --- |
| Wild country | Nemean hound, sacred boar, oath-crazed stag | Pack positioning, charge control, feint recognition. |
| Satyrs | Revel skirmisher, reed piper, torch dancer | Interrupt support, distinguish decoy, leave fire path. |
| Centaurs | Spear outrider, bow sentinel, stone-hide elder | Spacing, moving volley, slow powerful zone control. |
| Harpies | Cliff snatcher, storm caller, bronze-feather harrier | Avoid drag lanes, interrupt weather, shelter from feathers. |
| Serpents | Drakon hatchling, marsh constrictor, temple viper | Tail exposure, escape a marked bind, priority targeting. |
| Bronze constructs | Talos shard, furnace guardian, temple automaton | Cooling opening, heat management, facing puzzle. |
| Cursed dead | Restless hoplite, oath shade, burial priest | Shield flank, false target, resurrection interruption. |
| Underworld horrors | Empousa, Keres reaper, Tartarean jailer | Recognize disguise, evade marked execution, break a chain anchor. |
| Coastal creatures | Reef serpent, giant shore crab, Siren | Hull/shore transition, armour weak side, avoid a lure zone. |
| Deep-sea creatures | Young ketos, abyssal octopus, oath sea serpent | Large weak points, sever grapples, read surfacing routes. |

Special army and Royal Guard roles are additional encounter actors; the count above excludes them, the 20 adventure principals, six island champions, and Leonidas. Friendly mythic beings and neutral animals are not automatically enemies. Basilisks, generic demons, and unrelated Norse monsters should not fill Greek content merely because they are easy to reuse.

### Art and sound

Keep the game's procedural pixel-art identity. Build original modular Greek columns, painted friezes, terracotta roofs, bronze statues, olive trees, cypress, reedbeds, amphorae, triremes, and differentiated shore tiles. Temples were colourful in this fictional world: use painted accents and bronze fittings rather than making every settlement a blank white ruin.

Distinct silhouettes are required for Hydra heads, Minotaur, Medusa, Cerberus, Talos, the ships, Spartan formations, and Leonidas. A stretched existing crawler sprite does not meet the quality bar for these bosses. God powers use recurring visual symbols learned before the finale.

Audio direction: plucked strings and reeds on the mainland; rowing and distant horns at sea; spare, echoing tones in Asphodel; bronze percussion and low pressure in Tartarus; disciplined marching rhythm for the Three Hundred; then shield strikes, breath, and thunder for Leonidas. Music can be evocative and original without claiming an authentic reconstruction of ancient performance.

Every damaging tell has a visible shape and readable timing. Colour is reinforced by symbols and motion. Options include reduced flashes/shake, steady rarity highlights, high-contrast danger outlines, adjustable UI scale, and the existing battery-saving mode. These affect presentation, not encounter timing or rewards. Pausing suspends combat, storms, projectiles, ship damage, and encounter deadlines consistently.

## 14. Scope, priorities, and completion criteria

The full release commitment is: one equal-area eastern surface addition; 12 geographic regions; 8 settlements plus special refuges; 16 named smaller islands and Asterion; 4 ships; 12 Labours; 8 additional major adventure sites; 5 linked Underworld spaces; the 300-soldier encounter; 3 island sanctuaries; 6 island champions; Leonidas; 2 rarities; 30 ordinary enemy archetypes; 8 campaign chapters; 16 side stories; 12 contract templates; and 36 authored equipment rewards/recipes across the existing four slots. [CONTENT.md](CONTENT.md) enumerates the equipment and original-world prerequisite manifest. The implementation registry must match these identities before content-complete sign-off.

For delivery, build one vertical slice first: the unchanged old world, eastern pass, Thyra, Aigialos, Nemean Lion, one ship, one small island, and a save-compatible return journey. This is an engineering milestone, **not a reduction of the requested expansion**. The full update is not complete when this slice works.

Non-goals for this expansion: multiplayer raids, naval fleet management, a new playable class, procedural dialogue generation, a live-service economy, or a fully simulated historical Mediterranean. They would dilute the agreed work and make the two finales harder to finish well.

The expansion is ready only when an existing save can finish the entire progression, the map addition has the exact area, all required adventures have distinct working mechanics, all 300 are accounted for, no travel/loot path bypasses the final prerequisites, and prepared builds from all six classes can demonstrably defeat Leonidas. Art, audio, controls, save recovery, and performance are part of completion.

## 15. Mythological source anchors

The encounter rules, map, transformed Spartans, rewards, and oath story are original designs. Mythological references use traditions with variations rather than claiming one unified canon. Pseudo-Apollodorus's *Library* 2.5 anchors the Labours and Cerberus/Taenarum; Homer's *Odyssey* 11 anchors the shades and punishments; Hesiod's *Theogony* anchors Tartarus and the vast imprisoned powers. No film or modern game's version is being treated as the ancient source.

- [Pseudo-Apollodorus, Library, Book 2](https://www.theoi.com/Text/Apollodorus2.html)
- [Homer, Odyssey, Book 11](https://www.theoi.com/Text/HomerOdyssey11.html)
- [Hesiod, Theogony](https://www.theoi.com/Text/HesiodTheogony.html)

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for the code audit, data architecture, migration, milestone order, and acceptance checks.
