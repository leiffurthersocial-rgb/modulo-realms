/**
 * Story cards: the words the game stops for. The prologue plays once, before
 * a new character's training; each main chapter gets a card when it opens
 * (built from its `detail` in `mainquest.ts`), and an act gets its own card
 * in front of its first chapter.
 */

export interface StoryPage {
  /** Small line above the title: "Prologue", "Act II · The Wood Grows Inward". */
  kicker?: string;
  title: string;
  lines: string[];
  /** What to do now, under a rule. */
  goal?: string;
  /** Where, when the goal needs directions. */
  hint?: string;
  /** Pages sharing a group are skipped together ("Skip prologue"). */
  group?: string;
}

export const PROLOGUE: StoryPage[] = [
  {
    kicker: 'Prologue',
    group: 'prologue',
    title: 'The Modulo',
    lines: [
      'Everything in this world is divided by the Modulo.',
      'Day from night, root from stone, the living from the dead. It shares the world out evenly, as it always has.',
    ],
  },
  {
    kicker: 'Prologue',
    group: 'prologue',
    title: 'What Is Left Over',
    lines: [
      'Lately the sums have stopped coming out even.',
      'Wells drip the wrong way. Stones weigh the same from every side. Miners dig into walls that are numbered.',
      'What will not divide is left over. The old folk call it the Remainder, and it is growing.',
    ],
  },
  {
    kicker: 'Prologue',
    group: 'prologue',
    title: 'Ashvale',
    lines: [
      'You came to Ashvale with a weapon and not much else to lose.',
      'Elder Hanne has kept this valley for forty years. She says something under it is counting, and she needs someone who will go and look.',
      'First, learn to fight. Nobody in Ashvale goes out the gate without that.',
    ],
  },
  {
    kicker: 'Your road',
    group: 'prologue',
    title: 'Find the Remainder',
    lines: [
      'Follow the story from Ashvale to the bottom of the world, six acts, and close what is leaking.',
      'Between chapters the world is yours: bounties, dungeons, the forge, the tables at the Gilded Spade. Every level counts.',
      'The strongest names stand on the leaderboard.',
    ],
  },
];
