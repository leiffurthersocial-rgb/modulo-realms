# The Aegean Oath — release guide

Implemented 19 September 2026. This guide describes the delivered code; the accompanying design and implementation plan preserve the original specification and its initial estimates.

## Entering Achaea

The world is now 1920×1088 tiles at 32 pixels per tile. A full 960×1088 eastern area adds olive country, mountain passes, river estates, Sparta, varied coastlines, volcanic ground, open sea, sixteen small islands, and Asterion. Twenty docks connect the navigable sea. Five linked Underworld areas lead through Acheron, Asphodel, Persephone’s garden, the House of Hades, and Tartarus.

The Veteran Writ requires level 75 and the three original endgame bosses: Emberdeep, the Storm Throne, and the Remainder. Permanent accomplishment flags are independent of dungeon reset state. The Chronicle gives explicit checklists for the old-world Testament and every expansion milestone.

The level cap is 100. The ordinary talent budget remains 120 points at level 75. At levels 80, 85, 90, 95, and 100, choose one of three heroic masteries. All six existing classes remain playable, and equipment stays unrestricted by class.

## Campaign and encounters

Eight campaign chapters connect sixteen stories, twelve repeatable contracts, twenty-four discoveries, and five commissions. Their runtime includes distinct station visits, ordered mechanisms, defended courts, escorted companions, and recorded accomplishments. Defence and escort failures reset the current step, including owned enemies. Repeatable work has a five-minute cooldown and pays once per completed run.

The twelve Labours use different encounter rules: pillar baiting for the Lion; five timed Hydra wounds; calm escort for the Hind; charge pens for the Boar; ordered river sluices; exposed bird flocks; Bull anchors; Mare paddocks; allied standards; cattle refuges and Geryon; carrying the sky; and restraining Cerberus without attacking him. The other myths include Python, Medusa, the Minotaur, Chimera, Cyclops, Talos, Scylla’s strait, and the Titan chain breach.

The Three Hundred are a fixed roster of 300 individually identified soldiers in ten companies. Four battlefield chapters account for 60/90/90/60 soldiers. Only whole chapters save as checkpoints; partial kills cannot duplicate progression. At most 36 soldiers run full combat AI at once, with unengaged reserves rendered separately. Shield links, captains, rotating formations, and pincer pressure give the army its own encounter rules. It awards campaign rewards as one encounter instead of 300 boss payouts.

Leonidas has six phases, an enormous temple, committed attack patterns, oath braziers, conductors, trap warnings, and twelve finite royal guards in two waves. Phase transitions occur at 82%, 64%, 42%, 18%, and 5% health. The final five percent stays protected until three final patterns resolve. Damage floors prevent skipping mandatory mechanics. Real attempts have no health checkpoints. Practice echoes unlock only reached phases and restore inventory, resources, cooldowns, status timers, powers, gold, and deaths when leaving; practice grants no rewards and cannot be saved as a real attempt.

## Ships, services, and rewards

The Coastal Skiff, Merchant Roundship, War Trireme, and Stormbreaker have different price, hull, handling, speed, fitting, and ram capabilities. Ships steer with momentum, fire volleys, brace, and burst-row. Nearby threats can board a separate deck where normal class combat works. Sea monsters use explicit water movement; flying sirens can cross water. Distance from the mainland determines sea danger, so a small island does not reset the deep-water threat. Storm impacts warn before landing.

Asterion requires the completed army, the Stormbreaker, forged bronze ribs, the Hesperid sail, and Cerberus’s keel-binding. Its landing repeats those checks. Shipwreck preserves gear and campaign progress, returns the crew to its last port with free emergency hull repairs, and leaves a bounded, recoverable gold loss. The recovery-line fitting prevents that loss.

Twenty-five services make story rewards functional: return ferries between previously visited docks, earned Underworld return passages, a satyr trail, two refuges, centaur training, and six pairs of champion roads within Asterion. They enforce combat, first-visit, army, and island restrictions. Ferries cannot replace a first voyage or cross the oath storm. Town keepers provide local dialogue, supplies, healing, and storage.

Thirty-six named equipment identities have authored powers and acquisition sources. Olympian and Primordial sit above Mythic; both support four enchantments and remain absent from random loot and Crown promotion. Primordial equipment, Oathsteel, royal catalysts, and royal crafting require island provenance. The three sanctuaries provide pre-Leonidas Primordial preparation; his first victory offers one of six royal weapons, with further weapons earned through rematches and island crafting. Rewards that do not fit in the pack go to storage.

The forge uses a stable level curve and retains affix rolls. Old equipment is migrated once, with before/after records in the Chronicle. Greek materials, recovery draughts, status resistance, six optional ship fittings, and permanent ship components support expedition preparation.

## Controls and presentation

- **H:** Chronicle, stories, mastery, forge, fleet, and migration records.
- **B:** brace while keeping a chosen facing; **X:** cycle a target.
- **V / F / R:** weapon, off-hand, and artifact powers.
- At sea: **WASD** steer, **Space** volley, **G** ram where fitted, **B/F** brace, **Shift** burst-row, **E** dock, **R** board the combat deck.
- **M:** zoomable world atlas or the current dungeon plan. Touch controls expose the new actions.

Greek terrain, props, monsters, equipment, and ships are drawn from original procedural art. Six additional synthesized music arrangements cover Achaea, its towns, storm voyages, the Underworld, the army, and the royal temple. Simulation runs at fixed 60Hz, including when the battery-saving renderer runs at 30Hz. Map chunks, minimaps, active enemies, navigation searches, and activity lookup are bounded or spatially cached.

## Saves and reproducible verification

The existing save key remains compatible. Version 1 saves load into version 2, and the original raw save is copied to `modulo-realms-save-pre-aegean` before its first successful overwrite. A recovery write is read back before the main save changes. Campaign receipts, army chapters, reached practice phases, ships, activity state, item migration records, mastery, powers, and consumable cooldowns persist. A failed browser-storage write is shown to the player.

Run `npm run check:aegean`. It bundles and runs eight checks sequentially, removes its own temporary files, and starts no server or browser:

| Check | Evidence |
| --- | --- |
| Content references | Shops, enemies, summons, regions, drops, and location IDs resolve. |
| Ashvale schedules | All five original scheduled residents stay in town through a full work/tavern/home cycle. |
| Aegean content | 36 identities, source restrictions, recipes, new tiers, item migration, bounded powers, reload and practice resources. |
| World geometry | Exact dimensions; six frozen legacy datasets match actual base Git code; 20 usable connected docks; isolated Asterion; 36 reachable interiors; unique reachable activity centres. |
| Encounter runtime | All Labours and myths; 300 unique soldiers and checkpoint resumes; six royal phases; twelve guards; final oath; practice restoration; committed hit geometry; escort and sea movement. |
| Class calibration | Actual level-100 equipment, legal 120-point offensive builds, finite regeneration, collision-based projectile counts, and bounded damage estimates for all six classes. |
| Services | All 25 actual map placements and destinations, landmass preservation, first-voyage/visit/combat restrictions, fares, refuge and training behavior. |
| Game integration | Actual Game and save APIs: v1/v2 roundtrips, one-time backup/migration, campaign gates, fleet/deck/wreck, activity failure/retry/reward, and service unlocks. |

All eight passed. `npm run build` passes. Browser checks exercised the production title, Chronicle, shipyard, sailing input, army activation, temple activation, and their rendered UI without reported page errors. The final review verified numbered temple-map objectives, the widened royal camera, and the Chronicle at a 390px mobile viewport. The largest individual geometry check used about 304MB peak RSS in the measured run; checks run serially for the shared 8GB Mac.

The geometry fixture uses seed 1337 and compares against code and dependencies extracted from Git commit `d39d75a`, rather than comparing two copies of the new generator. `scripts/record-aegean-legacy-baseline.mjs` reproduces that baseline.

## Balance evidence and limits

Leonidas currently has 1,705,050 health and 255 defense. The diagnostic uses 55% attack uptime, 88% formation effectiveness, finite mana/stamina regeneration, 50% ground-effect retention, and 55 seconds for transitions and guards. Estimated prepared offensive-build rotations are warrior 12.4, ranger 12.9, mage 4.7, rogue 9.5, paladin 12.7, and necromancer 12.1 minutes. The fastest mage build is also fragile: a late unblocked sweep is about 69% of its health. Fixed item powers, summons, and on-hit damage are excluded from these estimates. No hidden per-class boss scaling is used.

These checks establish executable mechanics and compatibility, not a human completion of the entire campaign. The original design’s 10–14 minute target is not a universal measured clear time. Long-session economy pacing, all-seed exploration, and human difficulty across builds still benefit from playtesting. Story and discovery activities share a reusable four-station framework; boarding uses an authored deck encounter; trade cargo is represented by fitting storage and escort contracts. The creative design contains additional presentation and simulation ambitions beyond those concrete runtime systems.
