# The Aegean Oath

The Ancient Greek endgame expansion for **Modulo: Realms of Ash**, implemented on top of development commit `d39d75af0723a6b13f4683c50ded7701404e9674`.

The eastern addition is exactly **960×1088 tiles**, making the continuous overworld **1920×1088**. It contains twelve Greek regions, eight settlements, sixteen smaller islands, Asterion, twenty harbours, and thirty-six authored interiors. The original western world retains its coordinates and generated identities outside two deliberate eastern passages.

- [Release guide and verification](RELEASE.md): implemented systems, controls, compatibility, regression commands, and remaining validation limits.
- [Full design](DESIGN.md): the original creative specification and initial tuning targets.
- [Content ledger](CONTENT.md): the equipment, champions, objectives, discoveries, and old-world completion manifest.
- [Implementation plan](IMPLEMENTATION.md): the pre-implementation source audit and engineering acceptance criteria.

Press **H** in the game to open the Chronicle. Reach level 75 and defeat Emberdeep, the Storm Throne, and the Remainder to enter Achaea. The Three Hundred additionally require the original-game Testament, twelve Labours, and four strategic myths. Their defeat unlocks the storm voyage; Asterion’s three sanctuaries and six champions precede Leonidas.

```sh
npm install
npm run check:aegean
npm run build
npm run dev
```

All geography and characters are fictional adaptations inspired by Ancient Greece and Greek mythology. Balance estimates in the original design are targets; the release guide reports the actual checks.
