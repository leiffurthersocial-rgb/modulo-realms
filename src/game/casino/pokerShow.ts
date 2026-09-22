import { audio } from '../audio/audio';
import {
  HERO_BET_X, HERO_BET_Y, POT_X, POT_Y, RACK_Y, SEAT_BET_Y, SEAT_Y,
  chipsFor, rackX, seatX,
} from '../art/pokerFelt';
import type { Game } from '../core/game';
import { STAKES } from './games';
import type { HoldemTable } from './holdem';

/**
 * Everything the hold'em table does that is not the hand itself.
 *
 * `holdem.ts` deals and scores and knows nothing about pixels. This watches
 * it, and turns the numbers changing into chips going through the air: a bet
 * is a handful of chips thrown one after another from whoever bet it to the
 * line in front of them, the collect is every one of those stacks flying to
 * the middle, and a win is the pot coming back the other way.
 *
 * It also owns the hero's side of the bargain — the chips on the line that
 * have not been pushed in yet — because that is a thing the player is doing
 * with their hands rather than a state the rules have any opinion about
 * until the moment it is committed.
 */

/** A chip in the air. */
interface Flight {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Height of the arc, in pixels. */
  lift: number;
  t: number;
  dur: number;
  delay: number;
  tier: number;
  spin: number;
  /** Where the chip is added when it lands. */
  land: { kind: 'seat'; index: number } | { kind: 'pot' } | { kind: 'hero' } | { kind: 'pending' } | { kind: 'gone' };
}

/** How long one chip spends in the air. */
const FLIGHT = 0.34;
/** Gap between two chips of the same throw, so they arrive separately. */
const STAGGER = 0.075;

export class PokerShow {
  t = 0;
  /** Chips lying at each opponent's place, as tier numbers. */
  seatStacks: number[][] = [];
  potStack: number[] = [];
  heroStack: number[] = [];
  /** Chips the hero has thrown on the line but not pushed in. */
  pending: number[] = [];
  pendingAmount = 0;
  flights: Flight[] = [];
  hover: string | null = null;
  /** Runs 0..1 while the hero's cards are sailing into the muck. */
  muck = 0;

  private lastCommitted: number[] = [];
  private wasCollecting = false;
  private settled = false;

  constructor(private game: Game) {}

  /** Start of a hand: nothing is on the baize. */
  reset(table: HoldemTable | null): void {
    this.seatStacks = (table?.seats.length ?? 1) > 1
      ? new Array(table!.seats.length - 1).fill(null).map(() => [])
      : [];
    this.potStack = [];
    this.heroStack = [];
    this.pending = [];
    this.pendingAmount = 0;
    this.flights = [];
    this.muck = 0;
    this.settled = false;
    this.wasCollecting = false;
    this.lastCommitted = table?.seats.map((s) => s.committed) ?? [];
  }

  /* ---------------- the hero's hands ---------------- */

  /** Throw one chip from the rack onto the line. */
  throwChip(index: number): void {
    const t = this.game.casino.table;
    const value = STAKES[index];
    if (!t || value === undefined) return;
    if (t.turn !== 0 || t.handOver || t.hero.folded) return;
    const hero = t.hero;
    if (this.pendingAmount + value > hero.chips) {
      audio.play('ui', 0.3);
      return;
    }
    this.pendingAmount += value;
    this.fly(rackX(index), RACK_Y, HERO_BET_X + 30, HERO_BET_Y - this.pending.length * 2,
      tierFor(value), 0, { kind: 'pending' });
    this.game.touch();
  }

  /** Take the unpushed chips back off the line. */
  takeBack(): void {
    if (!this.pendingAmount) return;
    this.pendingAmount = 0;
    this.pending = [];
    audio.play('ui', 0.35);
    this.game.touch();
  }

  /**
   * Push the line in.
   *
   * What that means depends on what is standing on it: nothing and nothing
   * owed is a check, anything up to what is owed is a call, and more than
   * what is owed is a raise to that total. It is the same gesture either
   * way, which is exactly how it works at a real table.
   */
  pushLine(): void {
    const c = this.game.casino;
    const t = c.table;
    if (!t) return;
    if (t.handOver) { c.nextHand(); return; }
    if (!t.awaitingHero) return;

    const hero = t.hero;
    const owed = Math.max(0, t.toCall - hero.committed);
    const want = hero.committed + this.pendingAmount;

    if (this.pendingAmount > owed && want >= t.minRaiseTotal) {
      this.absorbPending();
      c.raiseTo(Math.min(want, t.allInTotal));
    } else {
      this.absorbPending();
      c.callOrCheck();
    }
    audio.play('slot_coin_in', 0.45);
  }

  /** Throw the hole cards away. */
  fold(): void {
    const c = this.game.casino;
    const t = c.table;
    if (!t || !t.awaitingHero) return;
    this.muck = 0.001;
    this.takeBack();
    audio.play('swing', 0.35);
    c.fold();
  }

  /** The chips already on the line count toward whatever was committed. */
  private absorbPending(): void {
    for (const tier of this.pending) this.heroStack.push(tier);
    this.pending = [];
    this.pendingAmount = 0;
  }

  /* ---------------- watching the hand ---------------- */

  update(dt: number): void {
    this.t += dt;
    const t = this.game.casino.table;
    if (this.muck > 0) this.muck = Math.min(1, this.muck + dt * 2.2);

    if (t) {
      if (this.lastCommitted.length !== t.seats.length) this.reset(t);
      this.watchBets(t);
      this.watchCollect(t);
      this.watchWin(t);
    }
    this.updateFlights(dt);
    if (this.flights.length || this.muck > 0) this.game.touch();
  }

  /** Anyone whose committed total went up just threw chips. */
  private watchBets(t: HoldemTable): void {
    t.seats.forEach((s, i) => {
      const before = this.lastCommitted[i] ?? 0;
      if (s.committed <= before) {
        this.lastCommitted[i] = s.committed;
        return;
      }
      const delta = s.committed - before;
      this.lastCommitted[i] = s.committed;
      if (i === 0) {
        // The hero's own chips are usually already on the line — only the
        // difference between what was thrown and what the action cost gets
        // pitched in from the rack.
        const owedChips = chipsFor(delta, 5);
        const already = this.heroStack.length;
        const extra = Math.max(0, owedChips.length - already);
        for (let k = 0; k < extra; k++) {
          this.fly(300, RACK_Y - 6, HERO_BET_X, HERO_BET_Y - (already + k) * 2,
            owedChips[k] ?? 0, k * STAGGER, { kind: 'hero' });
        }
        if (extra === 0 && already === 0) {
          this.fly(300, RACK_Y - 6, HERO_BET_X, HERO_BET_Y, tierFor(delta), 0, { kind: 'hero' });
        }
        return;
      }
      const index = i - 1;
      const tiers = chipsFor(delta, 5);
      tiers.forEach((tier, k) => {
        this.fly(seatX(index, t.seats.length - 1), SEAT_Y + 18,
          seatX(index, t.seats.length - 1), SEAT_BET_Y - ((this.seatStacks[index]?.length ?? 0) + k) * 2,
          tier, k * STAGGER, { kind: 'seat', index });
      });
    });
  }

  /** The dealer sweeping the round's bets into the middle. */
  private watchCollect(t: HoldemTable): void {
    if (t.collecting === this.wasCollecting) return;
    this.wasCollecting = t.collecting;
    if (!t.collecting) return;

    const sweep = (tiers: number[], fromX: number, fromY: number) => {
      tiers.forEach((tier, k) => {
        this.fly(fromX, fromY - k * 2, POT_X, POT_Y - (this.potStack.length + k) * 2,
          tier, k * STAGGER * 0.7, { kind: 'pot' });
      });
    };
    this.seatStacks.forEach((tiers, i) => {
      sweep(tiers, seatX(i, this.seatStacks.length), SEAT_BET_Y);
      this.seatStacks[i] = [];
    });
    sweep(this.heroStack, HERO_BET_X, HERO_BET_Y);
    this.heroStack = [];
    audio.play('slot_coin_in', 0.4);
  }

  /** The pot going to whoever won it. */
  private watchWin(t: HoldemTable): void {
    if (!t.handOver) { this.settled = false; return; }
    if (this.settled) return;
    this.settled = true;
    const winner = t.winners[0] ?? 0;
    const to = winner === 0
      ? { x: HERO_BET_X, y: RACK_Y - 10 }
      : { x: seatX(winner - 1, t.seats.length - 1), y: SEAT_Y + 18 };
    this.potStack.forEach((tier, k) => {
      this.fly(POT_X + ((Math.floor(k / 5) - 1) * 11), POT_Y - (k % 5) * 2, to.x, to.y,
        tier, k * STAGGER * 0.5, { kind: 'gone' });
    });
    this.potStack = [];
    audio.play('gold', 0.55);
  }

  /* ---------------- flights ---------------- */

  private fly(x0: number, y0: number, x1: number, y1: number, tier: number, delay: number,
    land: Flight['land']): void {
    this.flights.push({
      x0, y0, x1, y1,
      lift: 14 + Math.random() * 10,
      t: 0, dur: FLIGHT + Math.random() * 0.06, delay,
      tier, spin: Math.random() * Math.PI,
      land,
    });
  }

  private updateFlights(dt: number): void {
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      if (f.delay > 0) { f.delay -= dt; continue; }
      f.t += dt;
      if (f.t < f.dur) continue;
      this.flights.splice(i, 1);
      switch (f.land.kind) {
        case 'seat': (this.seatStacks[f.land.index] ??= []).push(f.tier); break;
        case 'pot': this.potStack.push(f.tier); break;
        case 'hero': this.heroStack.push(f.tier); break;
        case 'pending': this.pending.push(f.tier); break;
        default: break;
      }
      audio.play('slot_reel_stop', 0.16);
    }
  }

  /** Chips currently in the air, positioned for the renderer. */
  get inAir(): Array<{ x: number; y: number; tier: number; spin: number }> {
    const out: Array<{ x: number; y: number; tier: number; spin: number }> = [];
    for (const f of this.flights) {
      if (f.delay > 0) continue;
      const k = Math.min(1, f.t / f.dur);
      out.push({
        x: f.x0 + (f.x1 - f.x0) * k,
        // a parabola, so the chip is thrown rather than slid
        y: f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * f.lift,
        tier: f.tier,
        spin: f.spin + k * 9,
      });
    }
    return out;
  }
}

const tierFor = (amount: number): number =>
  amount >= 500 ? 4 : amount >= 100 ? 3 : amount >= 25 ? 2 : amount >= 5 ? 1 : 0;
