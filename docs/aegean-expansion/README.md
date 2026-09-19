# The Aegean Oath

The Ancient Greek endgame expansion for **Modulo: Realms of Ash**, implemented on top of development commit `d39d75af0723a6b13f4683c50ded7701404e9674`.

The eastern addition is exactly **960×1088 tiles**, making the continuous overworld **1920×1088**. It contains twelve Greek regions, eight settlements, sixteen smaller islands, Asterion, twenty harbours, and thirty-six encounter maps and twenty-four usable town interiors. The original western world retains its coordinates and generated identities outside the former eastern boundary, which now blends naturally into Achaea.

- [Release guide and verification](RELEASE.md): implemented systems, controls, compatibility, regression commands, and remaining validation limits.
- [Full design](DESIGN.md): the original creative specification and initial tuning targets.
- [Content ledger](CONTENT.md): the equipment, champions, objectives, discoveries, and old-world completion manifest.
- [Implementation plan](IMPLEMENTATION.md): the pre-implementation source audit and engineering acceptance criteria.

The rebuild is kept off production while it is reviewed. Walk east at any level; enemies, weather and expedition costs supply the difficulty. Use the original **Journal**, **Skills**, **Anvil**, doors and dialogue. There is no Chronicle dashboard. The original pause menu is retained without expansion shortcuts or automatic tab-switch pausing.

The Three Hundred must fall before the storm voyage to Leonidas. Labours, myths, ship improvements and island trials provide preparation. They are encountered through the world rather than a global completion checklist.

- [Rebuild decisions and verification](REBUILD.md): the response to the first release's regressions and visual shortcomings.

```sh
npm install
npm run check:aegean
npm run build
npm run dev
```

All geography and characters are fictional adaptations inspired by Ancient Greece and Greek mythology. Balance estimates in the original design are targets; the release guide reports the actual checks.
