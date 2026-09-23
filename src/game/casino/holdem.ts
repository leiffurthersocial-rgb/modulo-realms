import {
  bestHand, compareHands, estimateEquity, freshDeck, shuffle,
  type Card, type ScoredHand,
} from './games';

/**
 * A no-limit hold'em table with two to four other players at it.
 *
 * The table is a small state machine driven from the game loop rather than
 * from React: `update(dt)` walks a queue of timed steps, and the panel only
 * ever draws whatever the current state happens to be. That is what makes the
 * cards deal one at a time and the chips slide into the pot instead of every
 * hand resolving in a single frame.
 */

export type Street = 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'over';
export type ActionKind = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'blind' | 'win';

export interface Seat {
  id: number;
  name: string;
  /** Chips in front of them. The hero's stack is mirrored to real gold. */
  chips: number;
  hole: Card[];
  /** Chips pushed in during the current betting round. */
  committed: number;
  folded: boolean;
  allIn: boolean;
  /** The hero is seat 0; everyone else is run by the table. */
  hero: boolean;
  /** Last thing they did, for the bubble over their seat. */
  lastAction: string;
  /** Set at showdown so the panel can name what they held. */
  shown: ScoredHand | null;
  /** True once their cards are face up. */
  revealed: boolean;
  /** Counts down while their action bubble is fresh. */
  bubble: number;
}

/** One queued beat of the hand, played out in game time. */
interface Step {
  after: number;
  run: () => void;
}

const NAMES = [
  'Tam', 'Wilda', 'Orrin', 'Bec', 'Hask', 'Mira', 'Dunn', 'Sela',
  'Corvin', 'Prue', 'Ghent', 'Alda', 'Roke', 'Nessa',
];

/**
 * How one opponent plays. Everyone at the table runs the same sound strategy
 * — equity against a read range, priced against the pot — and the profile
 * only leans it: a little tighter or looser, more or less willing to put
 * chips in without the goods. That keeps them competent without making them
 * identical.
 */
interface Style {
  /** Added to their equity before every decision; negative plays tighter. */
  looseness: number;
  /** Multiplies how often they bet and raise rather than check and call. */
  aggression: number;
  /** Chance per spot to bet or raise with nothing when heads-up. */
  bluff: number;
  /** Spread of the error on their read of their own hand. */
  misread: number;
}

/**
 * Hands evaluated per decision, split across the runs: enough to be sound,
 * few enough that a four-way pot does not cost the game loop a frame. The
 * sampling error on a crowded table is part of why they are not perfect.
 */
const EQUITY_BUDGET = 320;

export interface HoldemOptions {
  /** The big blind; every other amount is derived from it. */
  stake: number;
  /** How much gold the hero brought to the table. */
  heroChips: number;
  random?: () => number;
}

export class HoldemTable {
  seats: Seat[] = [];
  board: Card[] = [];
  /** How many board cards are face up — the rest are still down. */
  boardShown = 0;
  pot = 0;
  street: Street = 'idle';
  /** Seat index whose turn it is, or -1 while the table is busy. */
  turn = -1;
  /** Highest amount committed this round; a caller has to match it. */
  toCall = 0;
  /** Smallest legal raise on top of `toCall`. */
  minRaise = 0;
  dealer = 0;
  message = '';
  /** Chips flying to the pot, for the panel to animate. */
  collecting = false;
  /** Set when the hand is finished and settled. */
  winners: number[] = [];
  handOver = false;

  private styles: Style[] = [];
  /** Bets and raises each seat has made this hand, for reading their range. */
  private aggr: number[] = [];
  /** Whether each seat has put chips in voluntarily this hand. */
  private vpip: boolean[] = [];
  /** Who made the last bet or raise this hand, -1 for nobody. */
  private aggressor = -1;
  /** How the hero has played across the sitting, so the table can adjust. */
  private heroActions = 0;
  private heroRaises = 0;
  private queue: Step[] = [];
  private timer = 0;
  private deck: Card[] = [];
  private random: () => number;
  readonly stake: number;

  constructor(opts: HoldemOptions) {
    this.stake = opts.stake;
    this.random = opts.random ?? Math.random;

    const others = 2 + Math.floor(this.random() * 3); // two to four opponents
    const pool = NAMES.slice();
    this.seats.push(this.makeSeat(0, 'You', opts.heroChips, true));
    for (let i = 0; i < others; i++) {
      const name = pool.splice(Math.floor(this.random() * pool.length), 1)[0];
      // Opponents are staked in the same order of magnitude as the hero, so
      // nobody at the table is untouchable or trivially bust.
      const chips = Math.round(opts.stake * (14 + this.random() * 22));
      this.seats.push(this.makeSeat(i + 1, name, chips, false));
    }
    this.dealer = Math.floor(this.random() * this.seats.length);
    this.styles = this.seats.map(() => ({
      looseness: (this.random() - 0.5) * 0.07,
      aggression: 0.8 + this.random() * 0.45,
      bluff: 0.05 + this.random() * 0.07,
      misread: 0.02 + this.random() * 0.03,
    }));
  }

  private makeSeat(id: number, name: string, chips: number, hero: boolean): Seat {
    return {
      id, name, chips, hero, hole: [], committed: 0, folded: false, allIn: false,
      lastAction: '', shown: null, revealed: false, bubble: 0,
    };
  }

  get hero(): Seat { return this.seats[0]; }
  private live(): Seat[] { return this.seats.filter((s) => !s.folded); }
  private canAct(): Seat[] { return this.seats.filter((s) => !s.folded && !s.allIn); }

  /** True when the panel should offer the hero buttons. */
  get awaitingHero(): boolean {
    return this.turn === 0 && !this.hero.folded && !this.hero.allIn && this.queue.length === 0;
  }

  private queueStep(after: number, run: () => void): void {
    this.queue.push({ after, run });
  }

  /** Drives the queued beats. Returns true if anything changed. */
  update(dt: number): boolean {
    let changed = false;
    for (const s of this.seats) {
      if (s.bubble > 0) { s.bubble = Math.max(0, s.bubble - dt); changed = true; }
    }
    if (this.queue.length === 0) return changed;
    this.timer += dt;
    while (this.queue.length && this.timer >= this.queue[0].after) {
      this.timer -= this.queue[0].after;
      const step = this.queue.shift()!;
      step.run();
      changed = true;
    }
    return changed || this.queue.length > 0;
  }

  /* ---------------- dealing ---------------- */

  /** Post blinds, deal two cards each, and pass the action. */
  startHand(): void {
    this.deck = shuffle(freshDeck(), this.random);
    this.board = [];
    this.boardShown = 0;
    this.pot = 0;
    this.toCall = 0;
    this.minRaise = this.stake;
    this.winners = [];
    this.handOver = false;
    this.street = 'preflop';
    this.message = '';
    this.collecting = false;
    for (const s of this.seats) {
      s.hole = [];
      s.committed = 0;
      s.folded = s.chips <= 0;
      s.allIn = false;
      s.lastAction = s.folded ? 'sitting out' : '';
      s.shown = null;
      s.revealed = false;
      s.bubble = 0;
    }
    this.dealer = this.nextOccupied(this.dealer);
    this.aggr = this.seats.map(() => 0);
    this.vpip = this.seats.map(() => false);
    this.aggressor = -1;

    const small = this.nextOccupied(this.dealer);
    const big = this.nextOccupied(small);
    this.queueStep(0.15, () => this.postBlind(small, Math.max(1, Math.round(this.stake / 2)), 'small blind'));
    this.queueStep(0.3, () => this.postBlind(big, this.stake, 'big blind'));

    // two cards each, one at a time, round the table
    for (let round = 0; round < 2; round++) {
      for (const s of this.seats) {
        if (s.folded) continue;
        this.queueStep(0.11, () => { s.hole.push(this.deck.pop()!); });
      }
    }
    this.queueStep(0.25, () => {
      this.hero.revealed = true;
      this.turn = this.nextToAct(big);
      this.runAuto();
    });
  }

  private nextOccupied(from: number): number {
    for (let i = 1; i <= this.seats.length; i++) {
      const idx = (from + i) % this.seats.length;
      if (!this.seats[idx].folded) return idx;
    }
    return from;
  }

  private nextToAct(from: number): number {
    for (let i = 1; i <= this.seats.length; i++) {
      const idx = (from + i) % this.seats.length;
      const s = this.seats[idx];
      if (!s.folded && !s.allIn) return idx;
    }
    return -1;
  }

  private postBlind(idx: number, amount: number, label: string): void {
    const s = this.seats[idx];
    const put = Math.min(amount, s.chips);
    s.chips -= put;
    s.committed += put;
    if (s.chips === 0) s.allIn = true;
    s.lastAction = label;
    s.bubble = 1.6;
    this.toCall = Math.max(this.toCall, s.committed);
  }

  /* ---------------- hero actions ---------------- */

  fold(): void {
    if (!this.awaitingHero) return;
    this.act(0, 'fold', 0);
  }

  /** Check when nothing is owed, otherwise call what is owed. */
  callOrCheck(): void {
    if (!this.awaitingHero) return;
    const owed = this.toCall - this.hero.committed;
    this.act(0, owed > 0 ? 'call' : 'check', owed);
  }

  raiseTo(total: number): void {
    if (!this.awaitingHero) return;
    const owed = Math.min(total, this.hero.chips + this.hero.committed) - this.hero.committed;
    this.act(0, this.toCall > 0 ? 'raise' : 'bet', owed);
  }

  /** What a raise must at least come to, in total committed chips. */
  get minRaiseTotal(): number {
    return this.toCall + this.minRaise;
  }

  /** Everything the hero has, as a total commitment. */
  get allInTotal(): number {
    return this.hero.chips + this.hero.committed;
  }

  private act(idx: number, kind: ActionKind, amount: number): void {
    const s = this.seats[idx];
    if (kind === 'bet' || kind === 'raise' || kind === 'call') this.vpip[idx] = true;
    if (kind === 'bet' || kind === 'raise') {
      this.aggr[idx]++;
      this.aggressor = idx;
    }
    if (s.hero && kind !== 'blind') {
      this.heroActions++;
      if (kind === 'bet' || kind === 'raise') this.heroRaises++;
    }
    if (kind === 'fold') {
      s.folded = true;
      s.lastAction = 'fold';
    } else {
      const put = Math.max(0, Math.min(amount, s.chips));
      s.chips -= put;
      s.committed += put;
      if (s.chips === 0 && put > 0) s.allIn = true;
      if (s.committed > this.toCall) {
        this.minRaise = Math.max(this.minRaise, s.committed - this.toCall);
        this.toCall = s.committed;
      }
      s.lastAction = kind === 'check' ? 'check'
        : s.allIn ? `all in ${put}`
          : kind === 'call' ? `call ${put}` : `${kind} ${s.committed}`;
    }
    s.bubble = 1.7;
    this.advance(idx);
  }

  /* ---------------- table flow ---------------- */

  private advance(from: number): void {
    if (this.live().length <= 1) {
      this.queueStep(0.5, () => this.endHandEarly());
      return;
    }
    const next = this.nextToAct(from);
    // The round closes when everyone still in has matched the bet and has had
    // a turn. A big blind who was only ever called still gets their option.
    const settled = this.canAct().every((s) => s.committed === this.toCall && s.lastAction !== '');
    if (settled || next === -1) {
      this.queueStep(0.45, () => this.nextStreet());
      return;
    }
    this.turn = next;
    this.runAuto();
  }

  /** If it is an opponent's turn, think for a beat and then act. */
  private runAuto(): void {
    if (this.turn < 0) return;
    const s = this.seats[this.turn];
    if (s.hero) return;
    this.queueStep(0.55 + this.random() * 0.5, () => {
      const decision = this.decide(s);
      this.act(s.id, decision.kind, decision.amount);
    });
  }

  /**
   * Opponent policy: a solid, readable player, not a solver.
   *
   * Each seat works out its showdown equity against everyone still in, with
   * each opponent's range narrowed by how they have bet this hand, and prices
   * that against the pot. Strong hands bet and raise for value, draws and
   * middling hands call when the price is right, weak hands give up, and a
   * heads-up pot gets the occasional bluff.
   *
   * The imperfections are deliberate and exploitable: they misjudge their own
   * hand by a few percent, their bet size tracks their hand strength (a big
   * bet is usually the truth), they never slowplay, and they read an
   * aggressive hero as loose and call down lighter — which a patient player
   * with a real hand can punish.
   */
  private decide(s: Seat): { kind: ActionKind; amount: number } {
    const style = this.styles[s.id];
    const board = this.board.slice(0, this.boardShown);
    const owed = Math.min(this.toCall - s.committed, s.chips);
    const pot = this.pot + this.sumCommitted();
    const rivals = this.live().filter((o) => o.id !== s.id);
    const heroLoose = this.heroActions >= 6 && this.heroRaises / this.heroActions > 0.4;

    // what each rival can plausibly hold, from what they have done this hand
    const floors = rivals.map((o) => {
      const a = this.aggr[o.id];
      let floor = a >= 3 ? 0.55 : a === 2 ? 0.47 : a === 1 ? 0.36 : this.vpip[o.id] ? 0.22 : 0;
      if (o.hero && heroLoose) floor *= 0.6;
      return floor;
    });
    const raw = estimateEquity(s.hole, board, floors, Math.round(EQUITY_BUDGET / (rivals.length + 1)), this.random);
    const noise = (this.random() + this.random() - 1) * style.misread * 2;
    const eq = Math.max(0, Math.min(1, raw + noise + style.looseness));

    // equity an average hand would have here — the bar everything is measured from
    const fair = 1 / (rivals.length + 1);
    const headsUp = rivals.length === 1;
    const river = this.street === 'river';
    const preflop = board.length === 0;
    const edge = eq - fair;

    const sized = (fraction: number): number => Math.max(this.stake, Math.round(pot * fraction));

    if (owed <= 0) {
      // nobody has bet: lead for value, bluff now and then, otherwise check
      if (preflop) {
        // the big blind's option after limps
        if (edge > 0.14 && this.random() < 0.8 * style.aggression) {
          return { kind: 'bet', amount: Math.min(s.chips, Math.max(this.minRaise, sized(0.8))) };
        }
        return { kind: 'check', amount: 0 };
      }
      if (edge > 0.2 && this.random() < 0.85 * style.aggression) {
        // the tell: the better the hand, the bigger the bet
        return { kind: 'bet', amount: Math.min(s.chips, sized(0.45 + Math.min(0.45, edge))) };
      }
      const barrel = this.aggressor === s.id ? 1.8 : 1; // follow up on their own raise
      if (headsUp && this.random() < style.bluff * barrel * style.aggression) {
        return { kind: 'bet', amount: Math.min(s.chips, sized(0.55)) };
      }
      // draws with plenty to come sometimes bet themselves
      if (!river && edge > 0.02 && this.random() < 0.25 * style.aggression) {
        return { kind: 'bet', amount: Math.min(s.chips, sized(0.5)) };
      }
      return { kind: 'check', amount: 0 };
    }

    // facing a bet: price it
    const potOdds = owed / (pot + owed);
    // cards still to come are worth something beyond the raw price
    const implied = river ? 0 : preflop ? 0.05 : 0.03;
    let margin = 0.01 - implied;
    if (heroLoose && this.aggressor === 0) margin -= 0.04;
    // a short stack committed past halfway does not fold for the rest
    if (s.committed > (s.chips + s.committed) * 0.5) margin -= 0.08;

    const canRaise = s.chips > owed + this.minRaise;
    if (canRaise && edge > (preflop ? 0.16 : 0.24) && this.random() < 0.7 * style.aggression) {
      const extra = Math.max(this.minRaise, preflop
        ? Math.round((this.toCall + this.stake) * (1.4 + this.random() * 0.6))
        : sized(0.55 + Math.min(0.4, edge)));
      return { kind: 'raise', amount: Math.min(s.chips, owed + extra) };
    }
    if (eq > potOdds + margin) return { kind: 'call', amount: owed };
    // a rare heads-up bluff-raise when the price to try it is small
    if (canRaise && headsUp && !preflop && potOdds < 0.3 && this.random() < style.bluff * 0.5) {
      return { kind: 'raise', amount: Math.min(s.chips, owed + Math.max(this.minRaise, sized(0.7))) };
    }
    return { kind: 'fold', amount: 0 };
  }

  private sumCommitted(): number {
    return this.seats.reduce((n, s) => n + s.committed, 0);
  }

  /** Sweep the round's chips into the pot, then turn the next card. */
  private nextStreet(): void {
    this.collecting = true;
    this.queueStep(0.35, () => {
      this.pot += this.sumCommitted();
      for (const s of this.seats) { s.committed = 0; s.lastAction = ''; }
      this.collecting = false;
      this.toCall = 0;
      this.minRaise = this.stake;

      if (this.street === 'preflop') {
        this.street = 'flop';
        this.board = [this.deck.pop()!, this.deck.pop()!, this.deck.pop()!];
        for (let i = 0; i < 3; i++) this.queueStep(0.22, () => { this.boardShown++; });
      } else if (this.street === 'flop') {
        this.street = 'turn';
        this.board.push(this.deck.pop()!);
        this.queueStep(0.28, () => { this.boardShown++; });
      } else if (this.street === 'turn') {
        this.street = 'river';
        this.board.push(this.deck.pop()!);
        this.queueStep(0.28, () => { this.boardShown++; });
      } else {
        this.queueStep(0.2, () => this.showdown());
        return;
      }
      this.queueStep(0.3, () => {
        if (this.canAct().length <= 1) {
          // everyone is all in — run the rest of the board out
          this.queueStep(0.4, () => this.nextStreet());
          return;
        }
        this.turn = this.nextToAct(this.dealer);
        this.runAuto();
      });
    });
  }

  /** Everyone but one folded: no cards get shown. */
  private endHandEarly(): void {
    this.pot += this.sumCommitted();
    for (const s of this.seats) s.committed = 0;
    const winner = this.live()[0];
    this.winners = [winner.id];
    winner.chips += this.pot;
    this.message = winner.hero
      ? `You take ${this.pot} — everyone folded.`
      : `${winner.name} takes ${this.pot}.`;
    this.street = 'over';
    this.handOver = true;
    this.turn = -1;
  }

  private showdown(): void {
    this.street = 'showdown';
    this.turn = -1;
    const contenders = this.live();
    // Turn them face up one at a time, left to right, then settle.
    for (const s of contenders) {
      this.queueStep(0.3, () => {
        s.revealed = true;
        s.shown = bestHand(s.hole, this.board);
      });
    }
    this.queueStep(0.6, () => {
      let best: ScoredHand | null = null;
      for (const s of contenders) {
        if (!s.shown) s.shown = bestHand(s.hole, this.board);
        if (!best || compareHands(s.shown, best) > 0) best = s.shown;
      }
      const won = contenders.filter((s) => compareHands(s.shown!, best!) === 0);
      this.winners = won.map((s) => s.id);
      const share = Math.floor(this.pot / won.length);
      for (const s of won) s.chips += share;
      const heroWon = won.some((s) => s.hero);
      this.message = won.length > 1
        ? `Split pot — ${share} each.`
        : heroWon
          ? `You win ${this.pot}.`
          : `${won[0].name} wins ${this.pot}.`;
      this.street = 'over';
      this.handOver = true;
    });
  }

  /** How much the hand has cost or paid the hero, for settling real gold. */
  heroDelta(startingChips: number): number {
    return this.hero.chips - startingChips;
  }
}
