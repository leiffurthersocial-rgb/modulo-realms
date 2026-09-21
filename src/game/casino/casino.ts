import { audio } from '../audio/audio';
import { PAL } from '../art/palette';
import type { Game } from '../core/game';
import { HoldemTable } from './holdem';
import { SLOT_TRIPLE, spinSlots, type SlotResult, type SlotSymbol, SLOT_REEL } from './games';

/** Stakes a player can sit down for, smallest first. */
export const STAKES = [10, 25, 50, 100, 250] as const;

/** A buy-in is this many big blinds, so a sitting lasts more than two hands. */
const BUY_IN_BLINDS = 20;

export interface SlotsState {
  stake: number;
  result: SlotResult | null;
  /** Seconds since the lever was pulled; drives the reel stops. */
  elapsed: number;
  spinning: boolean;
  /** When each reel comes to rest, so they stop left to right. */
  stops: [number, number, number];
  /** What each reel is showing right now, settled or not. */
  faces: [SlotSymbol, SlotSymbol, SlotSymbol];
  /** How many reels have locked in. */
  locked: number;
  /** Counts down while the win banner is up. */
  celebrate: number;
  session: number;
  /** Pulled-down lever, for the handle animation. */
  lever: number;
}

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
  slots: SlotsState | null = null;
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

  openSlots(): void {
    this.slots = {
      stake: STAKES[0], result: null, elapsed: 0, spinning: false,
      stops: [0, 0, 0], faces: ['cherry', 'bell', 'seven'], locked: 0,
      celebrate: 0, session: 0, lever: 0,
    };
    this.game.setPanel('slots');
  }

  setSlotStake(stake: number): void {
    if (!this.slots || this.slots.spinning) return;
    this.slots.stake = stake;
    this.game.touch();
  }

  spin(): void {
    const s = this.slots;
    if (!s || s.spinning) return;
    if (!this.take(s.stake)) return;
    s.session -= s.stake;
    // Decide the outcome up front, then let the reels catch up to it. Stopping
    // left to right with a beat between each is the whole feel of a slot
    // machine; a single simultaneous reveal has no tension in it.
    s.result = spinSlots();
    s.elapsed = 0;
    s.spinning = true;
    s.locked = 0;
    s.celebrate = 0;
    s.lever = 1;
    s.stops = [0.85, 1.35, 1.95];
    audio.play('ui', 0.5);
    this.game.touch();
  }

  /**
   * Drives the reels and the win banner. Called from the main update loop so
   * the timing is in game time and obeys pause, rather than running off a
   * timer of its own inside React.
   */
  update(dt: number): void {
    if (this.table) {
      if (this.table.update(dt)) this.game.touch();
    }
    const s = this.slots;
    if (!s) return;

    if (s.lever > 0) {
      s.lever = Math.max(0, s.lever - dt * 2.2);
      this.game.touch();
    }
    if (s.celebrate > 0) {
      s.celebrate = Math.max(0, s.celebrate - dt);
      this.game.touch();
    }
    if (!s.spinning) return;

    s.elapsed += dt;
    // Reels that have not stopped yet keep tumbling through the strip.
    for (let i = 0; i < 3; i++) {
      if (s.elapsed >= s.stops[i]) {
        if (s.locked <= i) {
          s.locked = i + 1;
          s.faces[i] = s.result!.reels[i];
          audio.play('ui', 0.4);
        }
      } else {
        s.faces[i] = SLOT_REEL[Math.floor((s.elapsed * 22 + i * 7) % SLOT_REEL.length)];
      }
    }
    this.game.touch();

    if (s.locked < 3) return;
    s.spinning = false;
    const result = s.result!;
    const back = result.payout > 0 ? s.stake * (result.payout + 1) : 0;
    s.session += back;
    if (back > 0) {
      this.game.player.gold += back;
      s.celebrate = 2.6;
      audio.play('gold', 0.6);
    }
    if (result.payout >= SLOT_TRIPLE.crown) {
      this.game.flashScreen(PAL.goldLit, 0.4);
      this.game.shake(8);
      audio.play('levelup', 0.8);
      this.game.toast(result.label, `${back} gold.`, PAL.goldLit);
    } else if (result.payout > 0) {
      audio.play('loot', 0.5);
    }
  }

  /** Leaving the machine or the table settles anything still on the felt. */
  close(): void {
    if (this.table) this.cashOut();
    this.slots = null;
  }
}
