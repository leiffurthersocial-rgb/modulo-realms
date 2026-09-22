/**
 * The two house games at the Gilded Spade.
 *
 * This file is rules only — deal a hand, score it, spin three reels — with no
 * React, no canvas and no reference to the running game. That keeps the odds
 * in one readable place where they can be reasoned about and checked by a
 * script, the same way `src/data/balance.ts` keeps every damage number
 * together instead of scattering them through the systems that use them.
 *
 * Both games are deliberately house-favoured but not punishing: a player who
 * sits down with a hundred gold should be able to play for a while, feel the
 * swings, and walk out having lost a little more often than they won.
 */

/** Stakes a player can sit down for, smallest first. One coin slot each. */
export const STAKES = [10, 25, 50, 100, 250] as const;

export type Suit = 'spade' | 'heart' | 'club' | 'diamond';

export interface Card {
  /** 2-14, where 11-14 are J, Q, K, A. */
  rank: number;
  suit: Suit;
}

const SUITS: Suit[] = ['spade', 'heart', 'club', 'diamond'];

export const RANK_LABEL: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export const SUIT_GLYPH: Record<Suit, string> = {
  spade: '♠', heart: '♥', club: '♣', diamond: '♦',
};

export const suitIsRed = (s: Suit): boolean => s === 'heart' || s === 'diamond';

/* ------------------------------------------------------------------ */
/* Draw poker — jacks or better                                        */
/* ------------------------------------------------------------------ */

export type HandRank =
  | 'nothing' | 'jacks' | 'two_pair' | 'trips' | 'straight'
  | 'flush' | 'full_house' | 'quads' | 'straight_flush' | 'royal';

/**
 * Payout is a multiple of the ante, paid on top of returning the ante — so
 * `jacks` at x1 hands the stake back plus the same again.
 *
 * The ladder is a shortened Jacks-or-Better table. Its return sits a little
 * under break-even, which is the point of a casino, but the bottom rung pays
 * often enough that a session is a run of small wins inside a slow loss
 * rather than a wall of nothing.
 */
export const POKER_PAYOUT: Record<HandRank, number> = {
  nothing: 0,
  jacks: 1,
  two_pair: 2,
  trips: 3,
  straight: 4,
  flush: 6,
  full_house: 9,
  quads: 25,
  straight_flush: 50,
  royal: 250,
};

export const POKER_LABEL: Record<HandRank, string> = {
  nothing: 'No pay',
  jacks: 'Jacks or better',
  two_pair: 'Two pair',
  trips: 'Three of a kind',
  straight: 'Straight',
  flush: 'Flush',
  full_house: 'Full house',
  quads: 'Four of a kind',
  straight_flush: 'Straight flush',
  royal: 'Royal flush',
};

/** Fresh 52-card deck, unshuffled. */
export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  return deck;
}

/**
 * Fisher-Yates, drawing from the caller's random source. The games use real
 * randomness rather than the world's seeded RNG: a seeded shuffle would deal
 * the same hand to every player on every save, which is a very short-lived
 * casino.
 */
export function shuffle(deck: Card[], random: () => number = Math.random): Card[] {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Score a five-card hand. Ace plays high, and low only in A-2-3-4-5. */
export function scoreHand(hand: Card[]): HandRank {
  if (hand.length !== 5) return 'nothing';

  const counts = new Map<number, number>();
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);

  const flush = hand.every((c) => c.suit === hand[0].suit);

  const ranks = [...new Set(hand.map((c) => c.rank))].sort((a, b) => a - b);
  let straight = false;
  let straightHigh = 0;
  if (ranks.length === 5) {
    if (ranks[4] - ranks[0] === 4) {
      straight = true;
      straightHigh = ranks[4];
    } else if (ranks[4] === 14 && ranks[0] === 2 && ranks[3] === 5) {
      // the wheel: A-2-3-4-5, where the ace counts low
      straight = true;
      straightHigh = 5;
    }
  }

  if (straight && flush) return straightHigh === 14 ? 'royal' : 'straight_flush';
  if (groups[0] === 4) return 'quads';
  if (groups[0] === 3 && groups[1] === 2) return 'full_house';
  if (flush) return 'flush';
  if (straight) return 'straight';
  if (groups[0] === 3) return 'trips';
  if (groups[0] === 2 && groups[1] === 2) return 'two_pair';
  if (groups[0] === 2) {
    // a bare pair only pays from jacks up
    for (const [rank, n] of counts) if (n === 2 && rank >= 11) return 'jacks';
  }
  return 'nothing';
}

/* ------------------------------------------------------------------ */
/* Slots                                                               */
/* ------------------------------------------------------------------ */

export type SlotSymbol = 'cherry' | 'bell' | 'crown' | 'spade' | 'seven';

/**
 * The reel strip. Weighting lives in how often a symbol appears rather than in
 * a separate table, so the odds can be read straight off the array: cherries
 * are common and pay little, sevens are rare and pay the jackpot.
 */
export const SLOT_REEL: SlotSymbol[] = [
  'cherry', 'cherry', 'cherry', 'cherry', 'cherry', 'cherry',
  'bell', 'bell', 'bell', 'bell',
  'spade', 'spade', 'spade',
  'crown', 'crown',
  'seven',
];

export const SLOT_GLYPH: Record<SlotSymbol, string> = {
  cherry: '●', bell: '⌂', crown: '♛', spade: '♠', seven: '7',
};

export const SLOT_COLOR: Record<SlotSymbol, string> = {
  cherry: '#8e2131', bell: '#d9a441', crown: '#f2cb60', spade: '#efe6d6', seven: '#6fd0e8',
};

/** Payout for three of a kind, as a multiple of the stake. */
export const SLOT_TRIPLE: Record<SlotSymbol, number> = {
  cherry: 4, bell: 8, spade: 14, crown: 30, seven: 120,
};

/** Payout for exactly two cherries anywhere — the consolation rung. */
export const SLOT_TWO_CHERRY = 1;

export interface SlotResult {
  reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  /** Multiple of the stake won; 0 is a loss. */
  payout: number;
  label: string;
}

export function spinSlots(random: () => number = Math.random): SlotResult {
  const pick = (): SlotSymbol => SLOT_REEL[Math.floor(random() * SLOT_REEL.length)];
  const reels: [SlotSymbol, SlotSymbol, SlotSymbol] = [pick(), pick(), pick()];

  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    const sym = reels[0];
    return {
      reels,
      payout: SLOT_TRIPLE[sym],
      label: sym === 'seven' ? 'JACKPOT' : `Three ${sym}s`,
    };
  }
  const cherries = reels.filter((r) => r === 'cherry').length;
  if (cherries === 2) return { reels, payout: SLOT_TWO_CHERRY, label: 'Two cherries' };
  return { reels, payout: 0, label: 'No pay' };
}

/* ------------------------------------------------------------------ */
/* Texas hold'em                                                       */
/* ------------------------------------------------------------------ */

/**
 * A scored hand: its category, plus the tiebreak ranks in descending
 * significance. Two hands compare by category first, then rank by rank, which
 * is what lets a table settle "both have two pair" without special cases.
 */
export interface ScoredHand {
  rank: HandRank;
  /** Category strength, 0 (nothing) to 9 (royal). */
  tier: number;
  /** Tiebreak ranks, most significant first. */
  kickers: number[];
  /** The five cards that actually make the hand. */
  best: Card[];
}

const TIER: Record<HandRank, number> = {
  nothing: 0, jacks: 1, two_pair: 2, trips: 3, straight: 4,
  flush: 5, full_house: 6, quads: 7, straight_flush: 8, royal: 9,
};

/** Hold'em names a bare pair "one pair", not "jacks or better". */
export const HOLDEM_LABEL: Record<HandRank, string> = {
  ...POKER_LABEL,
  nothing: 'High card',
  jacks: 'One pair',
};

/** Score exactly five cards, with the tiebreakers hold'em needs. */
function scoreFive(hand: Card[]): ScoredHand {
  const counts = new Map<number, number>();
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  // Group ranks by how many of them there are, then by rank — that ordering is
  // exactly the tiebreak order for pairs, trips and full houses.
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const flush = hand.every((c) => c.suit === hand[0].suit);
  const ranks = [...new Set(hand.map((c) => c.rank))].sort((a, b) => a - b);
  let straightHigh = 0;
  if (ranks.length === 5) {
    if (ranks[4] - ranks[0] === 4) straightHigh = ranks[4];
    else if (ranks[4] === 14 && ranks[0] === 2 && ranks[3] === 5) straightHigh = 5; // the wheel
  }

  const make = (rank: HandRank, kickers: number[]): ScoredHand =>
    ({ rank, tier: TIER[rank], kickers, best: hand.slice() });

  if (straightHigh && flush) {
    return make(straightHigh === 14 ? 'royal' : 'straight_flush', [straightHigh]);
  }
  if (groups[0][1] === 4) return make('quads', [groups[0][0], groups[1][0]]);
  if (groups[0][1] === 3 && groups[1][1] === 2) return make('full_house', [groups[0][0], groups[1][0]]);
  if (flush) return make('flush', hand.map((c) => c.rank).sort((a, b) => b - a));
  if (straightHigh) return make('straight', [straightHigh]);
  if (groups[0][1] === 3) return make('trips', groups.map((g) => g[0]));
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const [hi, lo] = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    return make('two_pair', [hi, lo, groups[2][0]]);
  }
  if (groups[0][1] === 2) return make('jacks', groups.map((g) => g[0]));
  return make('nothing', hand.map((c) => c.rank).sort((a, b) => b - a));
}

/** Every 5-card subset of n cards, as index lists. */
function combinations(n: number, k: number): number[][] {
  const out: number[][] = [];
  const pick: number[] = [];
  const walk = (start: number): void => {
    if (pick.length === k) { out.push(pick.slice()); return; }
    for (let i = start; i < n; i++) { pick.push(i); walk(i + 1); pick.pop(); }
  };
  walk(0);
  return out;
}

const FIVE_OF_SEVEN = combinations(7, 5);
const FIVE_OF_SIX = combinations(6, 5);

/** Compare two scored hands. Positive means `a` wins. */
export function compareHands(a: ScoredHand, b: ScoredHand): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const d = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Best five-card hand out of hole cards plus board. Hold'em lets a player use
 * any five of the seven, including both, one, or neither hole card, so this
 * has to try every subset rather than assume the hole cards play.
 */
export function bestHand(hole: Card[], board: Card[]): ScoredHand {
  const all = [...hole, ...board];
  if (all.length < 5) return scoreFive([...all, ...all].slice(0, 5));
  const sets = all.length === 7 ? FIVE_OF_SEVEN : all.length === 6 ? FIVE_OF_SIX : combinations(all.length, 5);
  let best: ScoredHand | null = null;
  for (const idx of sets) {
    const scored = scoreFive(idx.map((i) => all[i]));
    if (!best || compareHands(scored, best) > 0) best = scored;
  }
  return best!;
}

/**
 * A rough hand strength in [0,1], used only by the table's opponents to decide
 * whether to put money in. It is deliberately simple — these are villagers
 * playing cards, not a solver — but it does read the board, so a player who
 * bets into a paired board is treated with the suspicion it deserves.
 */
export function handStrength(hole: Card[], board: Card[]): number {
  if (board.length === 0) {
    const [a, b] = [hole[0].rank, hole[1].rank].sort((x, y) => y - x);
    const pair = a === b;
    const suited = hole[0].suit === hole[1].suit;
    const gap = a - b;
    let s = (a - 2) / 12 * 0.38 + (b - 2) / 12 * 0.2;
    if (pair) s += 0.34;
    if (suited) s += 0.07;
    if (!pair && gap <= 2) s += 0.05;
    return Math.max(0, Math.min(1, s));
  }
  const scored = bestHand(hole, board);
  // Tier alone is too coarse: two players on the same board usually share a
  // tier, so the top kicker breaks the tie in the estimate as well.
  const base = scored.tier / 9;
  const kicker = ((scored.kickers[0] ?? 2) - 2) / 12;
  return Math.max(0, Math.min(1, base * 0.82 + kicker * 0.18));
}
