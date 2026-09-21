# The Aegean Oath — release guide

Rebuilt 19 September 2026; expansion remains offline for review. This guide describes the current code; the accompanying design and implementation plan preserve the original specification and its initial estimates.

## Entering Achaea

The world is now 1920×1088 tiles at 32 pixels per tile. A full 960×1088 eastern area adds olive country, mountain passes, river estates, Sparta, varied coastlines, volcanic ground, open sea, sixteen small islands, and Asterion. Twenty docks connect the navigable sea. Five linked Underworld areas lead through Acheron, Asphodel, Persephone’s garden, the House of Hades, and Tartarus.

Achaea has no level requirement or invisible border. Every character can walk into it and attempt its mainland encounters, including the Three Hundred. Greek enemies keep their authored endgame strength. The army still protects the route to Leonidas, and island trials require actually landing on Asterion. Existing accomplishment receipts remain compatible with saves, but do not block entry. New adventures are learned in the world and appear in the original Journal.

The level cap is 100. The ordinary talent budget remains 120 points at level 75. At levels 80, 85, 90, 95, and 100, choose one of three heroic masteries. All six existing classes remain playable, and equipment stays unrestricted by class.

## Campaign and encounters

Sixteen stories, twelve repeatable contracts, twenty-four discoveries, and five commissions use individually placed world scenes. Their runtime includes distinct station visits, ordered mechanisms, defended courts, escorted companions, and recorded accomplishments. Defence and escort failures reset the current step, including owned enemies. Repeatable work has a five-minute cooldown and pays once per completed run.

The twelve Labours use different encounter rules: pillar baiting for the Lion; five timed Hydra wounds; calm escort for the Hind; charge pens for the Boar; ordered river sluices; exposed bird flocks; Bull anchors; Mare paddocks; allied standards; cattle refuges and Geryon; carrying the sky; and restraining Cerberus without attacking him. The other myths include Python, Medusa, the Minotaur, Chimera, Cyclops, Talos, Scylla’s strait, and the Titan chain breach.

The Three Hundred are a fixed roster of 300 individually identified soldiers in ten companies. Four battlefield chapters account for 60/90/90/60 soldiers. Only whole chapters save as checkpoints; partial kills cannot duplicate progression. At most 36 soldiers run full combat AI at once, with unengaged reserves rendered separately. Shield links, captains, rotating formations, and pincer pressure give the army its own encounter rules. It awards campaign rewards as one encounter instead of 300 boss payouts.

Leonidas has six phases, an enormous temple, committed attack patterns, oath braziers, conductors, trap warnings, and four royal guards who must all be defeated. Phase transitions occur at 82%, 64%, 42%, 18%, and 5% health. The final five percent stays protected until three final patterns resolve. Damage floors prevent skipping mandatory mechanics. Real attempts have no health checkpoints. Practice echoes unlock only reached phases and restore inventory, resources, cooldowns, status timers, powers, gold, and deaths when leaving; practice grants no rewards and cannot be saved as a real attempt.

## Ships, services, and rewards

The Coastal Skiff, Merchant Roundship, War Trireme, and Stormbreaker have different price, hull, handling, speed, fitting, and ram capabilities. Ships steer with momentum, fire volleys, brace, and burst-row. Nearby threats can board a separate deck where normal class combat works. Sea monsters use explicit water movement; flying sirens can cross water. Distance from the mainland determines sea danger, so a small island does not reset the deep-water threat. Storm impacts warn before landing.

Asterion requires the completed army, the Stormbreaker, forged bronze ribs, the Hesperid sail, and Cerberus’s keel-binding. Its landing repeats those checks. Shipwreck preserves gear and campaign progress, returns the crew to its last port with free emergency hull repairs, and leaves a bounded, recoverable gold loss. The recovery-line fitting prevents that loss.

Twenty-five services make story rewards functional: return ferries between previously visited docks, earned Underworld return passages, a satyr trail, two refuges, centaur training, and six pairs of champion roads within Asterion. They enforce combat, first-visit, army, and island restrictions. Ferries cannot replace a first voyage or cross the oath storm. Town keepers provide local dialogue, supplies, healing, and storage.

Thirty-six named equipment identities have authored powers and acquisition sources. Olympian and Primordial sit above Mythic; Olympian supports four enchantments and Primordial six and remain absent from random loot and Crown promotion. Primordial equipment, Oathsteel, royal catalysts, and royal crafting require island provenance. The three sanctuaries provide pre-Leonidas Primordial preparation; his first victory offers one of six royal weapons, with further weapons earned through rematches and island crafting. Rewards that do not fit in the pack go to storage.

Greek equipment uses its own stable level curve and retains affix rolls. Original equipment retains its original statistics, value and Crown behavior. Forging through level 75 is unchanged; upgrades beyond 75 now use the same template curve as the existing loader, preventing temporary exponential power that disappears on reload. A saved migration receipt repairs an untouched item affected by the first expansion without undoing later upgrades. Earned recipes appear at the ordinary Anvil; royal weapon choices appear at the island forge. Greek materials, recovery draughts, status resistance, six optional ship fittings, and permanent ship components support expedition preparation.

## Controls and presentation

- The original **Journal**, **Skills**, **Anvil** and **Pause** menus keep their existing roles. Heroic mastery appears in Skills once available; the shipwright opens only at a harbour. Practice is accessed at statues in the royal antechamber.
- **B:** brace while keeping a chosen facing; **X:** cycle a target.
- **V / F / R:** weapon, off-hand, and artifact powers.
- At sea: **WASD** steer, **Space** volley, **G** ram where fitted, **B/F** brace, **Shift** burst-row, **E** dock, **R** board the combat deck.
- **M:** zoomable world atlas or the current dungeon plan. Touch controls expose the new actions.

Greek terrain, props, monsters, equipment, and ships are drawn from original procedural art. Ten additional synthesized arrangements distinguish Greek countryside, groves, oracle country, towns, Sparta, seafaring, storms, the Underworld, the army and the royal temple. Finite oar, docking, ram, thunder, bronze, horn and oath cues use the original sound engine. The original eight music definitions are unchanged. Forty-eight Greek residents include local workers with daily routes and innkeepers and smiths inside twenty-four furnished town interiors. Simulation runs at fixed 60Hz, including when the battery-saving renderer runs at 30Hz. Map chunks, minimaps, active enemies, navigation searches, and activity lookup are bounded or spatially cached.

## Saves and reproducible verification

The existing save key remains compatible. Version 1 saves load into version 2, and the original raw save is copied to `modulo-realms-save-pre-aegean` before its first successful overwrite. A recovery write is read back before the main save changes. Campaign receipts, army chapters, reached practice phases, ships, activity state, item migration records, mastery, powers, and consumable cooldowns persist. A failed browser-storage write is shown to the player.

Run `npm run check:aegean` for serial content, original NPC, Greek life/audio, save reconciliation, world geometry, encounter, class calibration, service, integration and original-mechanics checks. The runner starts no browser or server. `scripts/check-aegean-life.ts --world` additionally simulates residents against actual generated terrain and furniture. `AEGEAN_TEST_SEED=42` with the bundled world check provides a second geography seed.

The geometry fixture compares the western world against code and dependencies extracted from Git commit `d39d75a`, allowing only the documented former eastern rim to change. `scripts/record-aegean-legacy-baseline.mjs` reproduces the baseline. The original-mechanics check compares generated loot, forging, Crown upgrades, Life Siphon, Arrow Rain and original boss attack resolution against that same Git source.

Production currently carries only the rollback Continue repair. That repair preserves the raw expansion save and writes subsequent original-world play to a separate verified recovery save. The rebuilt loader reconciles that play with the preserved expansion state without resurrecting sold original items or losing Greek items held aside during rollback. See [REBUILD.md](REBUILD.md) for the current validation record.

## Balance evidence and limits

Leonidas now has 110,000 health; the current island and Primordial overhaul is documented in [LIVING-MYTHS.md](LIVING-MYTHS.md#leonidas-and-primordial-overhaul--21-september-2026). Calibration uses actual level-100 equipment and legal original talent budgets, finite regeneration, bounded projectile counts and estimated attack uptime. It does not apply hidden per-class boss scaling. Restoring original combat and equipment invalidates the first release's quoted class timings; current diagnostics must be read from the rebuilt regression run.

These checks establish executable mechanics and compatibility, not a human completion of the entire campaign. The original design’s 10–14 minute target is not a universal measured clear time. Long-session economy pacing, all-seed exploration, and human difficulty across builds still benefit from playtesting. Stories and discoveries use authored scenes with only the controls their actual objectives require; boarding uses an authored deck encounter; trade cargo is represented by fitting storage and escort contracts. The creative design contains additional presentation and simulation ambitions beyond those concrete runtime systems.
