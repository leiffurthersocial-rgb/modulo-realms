# Living Myths gameplay revision

## Design contract

The Greek expansion must feel like a new game region: every island has a recognizable ecology, landmark, hazard and activity, with mythology driving play as well as names. Challenge comes from aggression, positioning, attack combinations and environmental decisions. Normal bosses have at most 30,000 HP; Leonidas may exceed that modestly. Increasing HP or hiding damage behind repetitive interactions is not difficulty.

Players should understand the next action while playing. Use short verbs, visible telegraphs, map destinations, directional markers and exact reward receipts. The journal is optional reference. Keep progression, exploration, secrets, crafting and build depth; remove friction and prose dependency. Ship components need a real chart and one actionable next destination. Mechanisms should change the fight, with clear feedback and no arbitrary repeated three-button sequence.

## Implementation workstreams

- Bestiary: Greek-only field/sea rosters, island exclusives, per-species attack decks, new attack geometries and bespoke boss silhouettes. Preserve the original world.
- Encounters: start on entry, active pursuit, short dangerous cycles, optional useful arena counterplay, compact staging. The Three Hundred is one simultaneous 300-soldier battle on earth, preserving earned save receipts.
- World: irregular routes and waterways, myth-specific island terrain, environmental hazards/weather, varied physical activities, working buildings and Asterion waystones.
- Guidance: shipwright component chart, persistent next-step tracking, real harbour/entrance navigation, concise HUD, explicit item/gold/XP/unlock receipts and storage overflow notices.
- Equipment/balance: distinct basic attacks and speed/reach identities for Greek weapons, existing activated powers retained; healing from offense uses actual damage and a shared bounded recovery rate so crowds cannot erase mistakes.

## Verification

Run the serial Aegean suite, targeted new behavior checks, legacy mechanics/art parity, typecheck and production build with one heavy job at a time. Inspect representative scenes and the ship chart in a browser when memory permits. Report simulation coverage separately from human playtesting. Save compatibility and original-world generation must survive the update.

## Implemented systems

- `ecology.ts` defines all 17 island rosters, mainland territories and five sea danger bands. The expansion has 54 native field species and 30 bespoke boss designs. Species have individual movement styles and ordered attack decks, including leaps, cross lanes, safe-centre shockwaves, delayed strikes, pulls and radial volleys.
- Nine environmental hazard families and seven weather effects give travel visible danger. Charybdis vortices warn before pulling ships; travelling squalls and nine native sea species punish careless crossings. Safe harbour/town/door areas remain clear.
- Bosses start automatically on entry. Ordinary arenas occupy roughly 60% of their previous dimensions, while attack counters are useful optional openings. Capture, rescue and traversal Labours retain their distinct completion rules with automatic proximity/impact handling and visible in-world cues. Normal boss HP is capped after scaling at 30,000; Leonidas at 40,000.
- The Three Hundred are all present on one earth battlefield from the start. Spatial steering and seven concurrent attack commitments bound simulation and warning noise; these are not reinforcement waves. Completed victories stay completed; unfinished old chapter saves restart the simultaneous battle.
- Thirty-one repeated ordered-button scenes use striking, timed traversal, holding ground or dodging instead. Escort/collection checkpoints advance from play. Failed escorts regroup before retrying, and a dead companion cannot count as delivered.
- Stormbreaker has a separate shipwright chart, numbered requirements, live prerequisite resolution and persistent guidance through departure harbours, real landings and Underworld doors. The journal is optional reference; quest text is generated from the actual adventure goals.
- Reward receipts name quantities, items, gold, XP and unlocks. The most recent receipt stays available from the HUD; full packs send important items to storage with an explicit message.
- Eighteen Greek weapons have distinct basic attack sequences, ranges and speeds while retaining their activated powers. Offense-driven healing uses actual damage and shares a 2%-of-max-HP-per-second recovery budget in Greek content; individual payouts are capped at 0.75%. Immune hits and overkill cannot inflate healing. Passive recovery pauses under boss pressure; mending is bounded during Greek combat.
- Asterion has functional harbour/sanctuary waystones after the first voyage. Seven formerly decorative town-centre buildings are inhabited refuge halls with services. Existing doors, legacy world identities, original art and equipment progression are preserved.

## Future expansion preferences

Give each region a recognisable silhouette, ecology, atmosphere, local danger and meaningful activity. Invent mechanics and anatomy that belong to the setting; renaming or recolouring an original enemy is insufficient. Make difficulty come from aggression, spatial decisions and combinations, with accurate warnings and fair dodges. Prefer short, intense bosses to health sponges. Keep arenas purposeful and routes natural while preserving real collision connectivity.

Communicate the next action through the world, map and short verb cues. Show where unfamiliar names are, what blocks a purchase, what the player earned and where overflow went. Preserve secrets, crafting, build depth and progression; reduce reading and friction. Do not repeat the same three-interaction puzzle throughout a new map. Audit buildings and waypoints as functional play spaces, and test old saves as well as new games.

## Verification evidence — 21 September 2026

- The full serial `npm run check:aegean` passes all 21 groups. Coverage includes every authored encounter mechanism, all 36 maps, 20 dock approaches, 62 waystone destinations, 32 inhabited interiors, both save versions, interrupted runs, retry/payout safety, all new field kits, all 18 weapon patterns, actual-damage recovery and original-game mechanics/art parity. Additional world reachability passed seed 42 as well as the default 1337.
- TypeScript and `npm run build` pass. Vite reports the existing single-bundle size advisory (about 1.27 MB before gzip, 405 KB gzip); the build succeeds.
- Browser inspection used an isolated local test character and the development-only runtime hook to reach representative scenes. Ship chart checked at 1280×633 and 844×390: four requirements, numbered locations, guide action, no horizontal overflow, and no app page errors. Guidance persisted its selected requirement and directed a mainland character toward the embarkation harbour.
- Lion and Hydra started on map entry. The lion traversed approximately 1,032 pixels toward the test character without an interaction. The battlefield contained 300 live soldiers immediately. A two-second battle sample advanced simulation by 1.95 seconds with six visible attack warnings; this is a short local diagnostic, not a sustained performance benchmark.
- Inspected custom lion/Hydra art, soil battlefield, Hesperides atmosphere/hazard cues and a live danger-level-three sea vortex. Actual attack/dodge key input dispatched in the army scene. Removing invulnerability from the intentionally under-equipped test character confirmed the army inflicted lethal damage; this is not a class-balance playthrough.
- Visual checks used invulnerability where useful for inspection. Automated mechanics and class damage checks, rather than a complete human campaign playthrough, establish the reported gameplay coverage. Subjective feel and optimal-build balance still benefit from playing the full update.
