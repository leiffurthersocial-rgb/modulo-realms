import { audio } from '../audio/audio';
import { PAL } from '../art/palette';
import type { Game } from '../core/game';
import {
  POKER_PAYOUT, POKER_LABEL, SLOT_TRIPLE, freshDeck, scoreHand, shuffle, spinSlots,
  type Card, type HandRank, type SlotResult,
} from './games';

/** Stakes a player can sit down for, smallest first. */
export const STAKES = [10, 25, 50, 100, 250] as const;

export interface PokerState {
  stake: number;
  /** The five cards in front of the player, or [] before the first deal. */
  hand: Card[];
  /** Which of those five the player is keeping through the draw. */
  held: boolean[];
  /** 'ante' waits for a deal, 'draw' waits for the discard, 'done' shows the result. */
  phase: 'ante' | 'draw' | 'done';
  result: HandRank | null;
  won: number;
  /** Running total for this sitting, so the player can see what the night cost. */
  session: number;
}

export interface SlotsState {
  stake: number;
  result: SlotResult | null;
  /** Counts down while the reels are still turning. */
  spinning: number;
  session: number;
}

/**
 * The house games, kept off `Game` itself.
 *
 * Every wager runs through `stake()` so there is exactly one place that can
 * take a player's gold, and it refuses rather than going negative. Nothing
 * here is persisted: a sitting lives as long as the panel is open, which is
 * why the running session total is shown while it is.
 */
export class Casino {
  poker: PokerState | null = null;
  slots: SlotsState | null = null;

  constructor(private game: Game) {}

  /**
   * The stake a table opens at: the smallest one, always. Opening at the
   * largest the player can cover puts a 250-gold bet under their cursor
   * before they have agreed to anything, which is a cheap trick rather than
   * a game.
   */
  private affordable(): number {
    return STAKES[0];
  }

  private take(amount: number): boolean {
    if (this.game.player.gold < amount) {
      this.game.toast('Not enough gold', `${amount} to play that hand.`, '#e8763a');
      return false;
    }
    this.game.player.gold -= amount;
    return true;
  }

  private pay(amount: number): void {
    if (amount <= 0) return;
    this.game.player.gold += amount;
    audio.play('gold', 0.6);
  }

  /* ---------------- poker ---------------- */

  openPoker(): void {
    this.poker = {
      stake: this.affordable(),
      hand: [], held: [false, false, false, false, false],
      phase: 'ante', result: null, won: 0, session: 0,
    };
    this.game.setPanel('poker');
  }

  setPokerStake(stake: number): void {
    if (!this.poker || this.poker.phase === 'draw') return;
    this.poker.stake = stake;
    this.game.touch();
  }

  /** Ante up and deal five. */
  deal(): void {
    const p = this.poker;
    if (!p || p.phase === 'draw') return;
    if (!this.take(p.stake)) return;
    p.session -= p.stake;
    const deck = shuffle(freshDeck());
    p.hand = deck.slice(0, 5);
    p.held = [false, false, false, false, false];
    p.phase = 'draw';
    p.result = null;
    p.won = 0;
    audio.play('ui', 0.5);
    this.game.touch();
  }

  toggleHold(i: number): void {
    const p = this.poker;
    if (!p || p.phase !== 'draw') return;
    p.held[i] = !p.held[i];
    audio.play('ui', 0.35);
    this.game.touch();
  }

  /**
   * Replace everything not held, score once, and pay. The replacement cards
   * are drawn from a deck with the kept cards removed, so a held king can
   * never be dealt to the player a second time.
   */
  draw(): void {
    const p = this.poker;
    if (!p || p.phase !== 'draw') return;

    const kept = p.hand.filter((_, i) => p.held[i]);
    const keptKey = new Set(kept.map((c) => `${c.rank}:${c.suit}`));
    const deck = shuffle(freshDeck().filter((c) => !keptKey.has(`${c.rank}:${c.suit}`)));

    let next = 0;
    p.hand = p.hand.map((card, i) => (p.held[i] ? card : deck[next++]));

    const rank = scoreHand(p.hand);
    const multiple = POKER_PAYOUT[rank];
    // A win returns the stake as well as the multiple on top of it.
    const back = multiple > 0 ? p.stake * (multiple + 1) : 0;
    p.result = rank;
    p.won = back;
    p.session += back;
    p.phase = 'done';
    this.pay(back);

    if (multiple >= 25) {
      this.game.flashScreen(PAL.goldLit, 0.35);
      this.game.shake(6);
      audio.play('levelup', 0.7);
      this.game.toast(POKER_LABEL[rank], `${back} gold.`, PAL.goldLit);
    } else if (multiple > 0) {
      audio.play('loot', 0.5);
    } else {
      audio.play('ui', 0.4);
    }
    this.game.touch();
  }

  /** Clear the table for another hand. */
  nextHand(): void {
    const p = this.poker;
    if (!p) return;
    p.phase = 'ante';
    p.result = null;
    p.won = 0;
    this.game.touch();
  }

  /* ---------------- slots ---------------- */

  openSlots(): void {
    this.slots = { stake: this.affordable(), result: null, spinning: 0, session: 0 };
    this.game.setPanel('slots');
  }

  setSlotStake(stake: number): void {
    if (!this.slots || this.slots.spinning > 0) return;
    this.slots.stake = stake;
    this.game.touch();
  }

  spin(): void {
    const s = this.slots;
    if (!s || s.spinning > 0) return;
    if (!this.take(s.stake)) return;
    s.session -= s.stake;
    s.result = null;
    // The reels turn for a beat before they settle; `update` resolves it.
    s.spinning = 0.9;
    audio.play('ui', 0.5);
    this.game.touch();
  }

  /**
   * Drives the reel spin-down. Called from the main update loop so the delay
   * is in game time and obeys pause like everything else, rather than running
   * off a timer of its own inside React.
   */
  update(dt: number): void {
    const s = this.slots;
    if (!s || s.spinning <= 0) return;
    s.spinning -= dt;
    if (s.spinning > 0) {
      this.game.touch();
      return;
    }
    s.spinning = 0;
    const result = spinSlots();
    s.result = result;
    const back = result.payout > 0 ? s.stake * (result.payout + 1) : 0;
    s.session += back;
    this.pay(back);

    if (result.payout >= SLOT_TRIPLE.crown) {
      this.game.flashScreen(PAL.goldLit, 0.4);
      this.game.shake(8);
      audio.play('levelup', 0.8);
      this.game.toast(result.label, `${back} gold.`, PAL.goldLit);
    } else if (result.payout > 0) {
      audio.play('loot', 0.5);
    }
    this.game.touch();
  }

  /** Leaving the table drops the sitting; nothing about it is saved. */
  close(): void {
    this.poker = null;
    this.slots = null;
  }
}
