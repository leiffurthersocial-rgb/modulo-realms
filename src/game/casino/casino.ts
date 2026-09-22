import { audio } from '../audio/audio';
import { PAL } from '../art/palette';
import type { Game } from '../core/game';
import { HoldemTable } from './holdem';
import { SlotMachine } from './slotMachine';

export { STAKES } from './games';

/** A buy-in is this many big blinds, so a sitting lasts more than two hands. */
const BUY_IN_BLINDS = 20;

/**
 * The house games, kept off `Game` itself.
 *
 * Every wager runs through `take()` so there is exactly one place that can
 * spend a player's gold, and it refuses rather than going negative. The poker
 * table works in chips: the hero buys in on sitting down and cashes out on
 * leaving, which is what keeps a half-played hand from ever touching the
 * purse mid-street.
 */
export class Casino {
  table: HoldemTable | null = null;
  slots: SlotMachine | null = null;
  /** What the hero bought in for, so leaving can settle the difference. */
  private buyIn = 0;
  /** Chip total at the start of the current hand, for the result line. */
  handStart = 0;

  constructor(private game: Game) {}

  private take(amount: number): boolean {
    if (this.game.player.gold < amount) {
      this.game.toast('Not enough gold', `You need ${amount}.`, '#e8763a');
      return false;
    }
    this.game.player.gold -= amount;
    return true;
  }

  /* ---------------- hold'em ---------------- */

  /** Open the table panel. The hero has not bought in yet. */
  openPoker(): void {
    this.table = null;
    this.buyIn = 0;
    this.game.setPanel('poker');
  }

  /** Buy chips and deal the first hand. */
  sitDown(stake: number): void {
    const want = stake * BUY_IN_BLINDS;
    const buy = Math.min(want, this.game.player.gold);
    if (buy < stake * 2) {
      this.game.toast('Not enough gold', `A ${stake} table needs at least ${stake * 2}.`, '#e8763a');
      return;
    }
    if (!this.take(buy)) return;
    this.buyIn = buy;
    this.table = new HoldemTable({ stake, heroChips: buy });
    this.handStart = buy;
    this.table.startHand();
    audio.play('ui_big', 0.5);
    this.game.touch();
  }

  /** Deal the next hand at the same table. */
  nextHand(): void {
    const t = this.table;
    if (!t || !t.handOver) return;
    if (t.hero.chips < t.stake) {
      this.game.toast('Out of chips', 'Cash out, or buy in again.', '#e8763a');
      return;
    }
    this.handStart = t.hero.chips;
    t.startHand();
    audio.play('ui', 0.5);
    this.game.touch();
  }

  /** Cash the chips back into gold and leave. */
  cashOut(): void {
    const t = this.table;
    if (!t) return;
    const chips = t.hero.chips;
    this.game.player.gold += chips;
    const delta = chips - this.buyIn;
    if (delta > 0) {
      audio.play('gold', 0.7);
      this.game.toast('Cashed out', `Up ${delta} on the night.`, PAL.goldLit);
    } else if (delta < 0) {
      this.game.toast('Cashed out', `Down ${-delta} on the night.`, PAL.fog);
    }
    this.table = null;
    this.buyIn = 0;
    this.game.touch();
  }

  fold(): void { this.table?.fold(); this.afterHeroAction(); }
  callOrCheck(): void { this.table?.callOrCheck(); this.afterHeroAction(); }
  raiseTo(total: number): void { this.table?.raiseTo(total); this.afterHeroAction(); }

  private afterHeroAction(): void {
    audio.play('ui', 0.45);
    this.game.touch();
  }

  /* ---------------- slots ---------------- */

  /**
   * Walk up to a machine.
   *
   * There is no session to open and nothing to buy in for: a slot machine
   * takes one coin at a time out of the purse, which is what `take` below
   * does on every pull.
   */
  openSlots(): void {
    this.slots = new SlotMachine(this.game, (amount) => this.take(amount));
    this.game.setPanel('slots');
  }

  /**
   * Drives the table and the machine. Called from the main update loop so the
   * timing is in game time and obeys pause, rather than running off a timer
   * of its own inside React.
   */
  update(dt: number): void {
    if (this.table) {
      if (this.table.update(dt)) this.game.touch();
    }
    this.slots?.update(dt);
  }

  /** Leaving the machine or the table settles anything still on the felt. */
  close(): void {
    if (this.table) this.cashOut();
    this.slots = null;
  }
}
