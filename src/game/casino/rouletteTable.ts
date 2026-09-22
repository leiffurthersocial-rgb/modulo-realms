import { PAL } from '../art/palette';
import { audio } from '../audio/audio';
import type { Game } from '../core/game';
import { STAKES } from './games';

/**
 * The Whirligig, once it turns again: a playable single-zero wheel.
 *
 * Rules and session in one file, the way `games.ts` keeps the deck and the
 * reel strip together — the odds are the interesting part and they should be
 * readable in one screen. The drawing is `art/rouletteFelt.ts`; the repair
 * that gets the wheel working in the first place is `casino/roulette.ts`.
 *
 * The house edge is the single zero and nothing else. Every bet on the cloth
 * pays its true odds against 36 numbers while the wheel has 37 pockets, which
 * is 2.7% to the house — the same deal the rest of the Gilded Spade offers,
 * and the reason Dario is always perfectly happy to see you.
 */

/** Pocket order around a single-zero wheel, clockwise from the zero. */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type PocketColour = 'green' | 'red' | 'black';

export const colourOf = (n: number): PocketColour =>
  n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';

/** Every bet the cloth accepts. */
export type Bet =
  | { type: 'straight'; n: number }
  | { type: 'dozen'; d: 0 | 1 | 2 }
  | { type: 'red' | 'black' | 'even' | 'odd' | 'low' | 'high' };

/** A stable key, so a stack of chips on a field can be looked up. */
export function betKey(b: Bet): string {
  if (b.type === 'straight') return `n${b.n}`;
  if (b.type === 'dozen') return `d${b.d}`;
  return b.type;
}

export function betFromKey(key: string): Bet {
  if (key[0] === 'n') return { type: 'straight', n: Number(key.slice(1)) };
  if (key[0] === 'd') return { type: 'dozen', d: Number(key.slice(1)) as 0 | 1 | 2 };
  return { type: key as 'red' };
}

/** What a winning bet pays, on top of returning the stake. */
export function betPayout(b: Bet): number {
  if (b.type === 'straight') return 35;
  if (b.type === 'dozen') return 2;
  return 1;
}

/** Zero loses every outside bet. That is the whole house edge. */
export function betWins(b: Bet, n: number): boolean {
  if (b.type === 'straight') return b.n === n;
  if (n === 0) return false;
  switch (b.type) {
    case 'dozen': return Math.floor((n - 1) / 12) === b.d;
    case 'red': return colourOf(n) === 'red';
    case 'black': return colourOf(n) === 'black';
    case 'even': return n % 2 === 0;
    case 'odd': return n % 2 === 1;
    case 'low': return n <= 18;
    case 'high': return n >= 19;
    default: return false;
  }
}

export const betLabel = (b: Bet): string => {
  if (b.type === 'straight') return String(b.n);
  if (b.type === 'dozen') return ['1ST 12', '2ND 12', '3RD 12'][b.d];
  return b.type.toUpperCase();
};

/* ------------------------------------------------------------------ */
/* The table                                                           */
/* ------------------------------------------------------------------ */

type Phase = 'betting' | 'spinning' | 'dropping' | 'resting';

/** Seconds the ball runs the rim before it starts coming down. */
const RIM_TIME = 2.8;
/** Seconds the drop takes, from leaving the rim to sitting in a pocket. */
const DROP_TIME = 1.7;

export class RouletteTable {
  /** Chips on each field, by bet key. */
  bets = new Map<string, number>();
  /** Which chip the player is holding. */
  chip: number = STAKES[0];
  phase: Phase = 'betting';

  /** Wheel head angle, and the ball's angle and radius as fractions. */
  wheel = 0;
  private wheelVel = 1.1;
  ball = 0;
  private ballVel = 0;
  /** 1 out on the rim, 0 down in the pockets. */
  ballOut = 1;
  /** Extra hop while the ball is coming down. */
  ballHop = 0;

  t = 0;
  result: number | null = null;
  /** What the last spin paid back, including returned stakes. */
  won = 0;
  /** Recent results, newest first. */
  history: number[] = [];
  /** Counts down while the win is being celebrated. */
  celebrate = 0;
  /** Which field the pointer is over, for highlighting. */
  hover: string | null = null;
  /** Net gold across this sitting. */
  session = 0;
  message = 'PLACE YOUR BETS';

  private lockOffset = 0;
  private tickAt = 0;
  private paid = false;

  constructor(private game: Game, private take: (amount: number) => boolean) {}

  /* ---------------- betting ---------------- */

  get staked(): number {
    let n = 0;
    for (const v of this.bets.values()) n += v;
    return n;
  }

  /** Put one chip of the held denomination on a field. */
  place(key: string): void {
    if (this.phase !== 'betting') return;
    const next = (this.bets.get(key) ?? 0) + this.chip;
    if (this.staked + this.chip > this.game.player.gold) {
      this.message = 'NOT ENOUGH GOLD';
      audio.play('ui', 0.3);
      this.game.touch();
      return;
    }
    this.bets.set(key, next);
    this.message = 'PLACE YOUR BETS';
    audio.play('slot_coin_in', 0.4);
    this.game.touch();
  }

  /** Take one chip back off a field. */
  lift(key: string): void {
    if (this.phase !== 'betting') return;
    const have = this.bets.get(key);
    if (!have) return;
    const next = have - this.chip;
    if (next > 0) this.bets.set(key, next);
    else this.bets.delete(key);
    audio.play('ui', 0.35);
    this.game.touch();
  }

  clear(): void {
    if (this.phase !== 'betting' || !this.bets.size) return;
    this.bets.clear();
    audio.play('ui', 0.4);
    this.game.touch();
  }

  setChip(value: number): void {
    this.chip = value;
    audio.play('ui', 0.35);
    this.game.touch();
  }

  /* ---------------- the spin ---------------- */

  /**
   * Push the wheel.
   *
   * The number is drawn here, before the ball has done anything, and the drop
   * is then aimed at it — exactly as the slot machine decides a pull before
   * the reels move. Everything between this line and the ball settling is
   * theatre over an answer that already exists.
   */
  spin(): void {
    if (this.phase !== 'betting') return;
    const total = this.staked;
    if (total <= 0) {
      this.message = 'PLACE A BET FIRST';
      audio.play('ui', 0.3);
      this.game.touch();
      return;
    }
    if (!this.take(total)) {
      this.message = 'NOT ENOUGH GOLD';
      return;
    }
    this.session -= total;
    this.result = WHEEL_ORDER[Math.floor(Math.random() * WHEEL_ORDER.length)];
    this.phase = 'spinning';
    this.t = 0;
    this.won = 0;
    this.paid = false;
    this.celebrate = 0;
    this.wheelVel = 2.5;
    this.ballVel = -8.5;
    this.ballOut = 1;
    this.message = 'NO MORE BETS';
    audio.play('wheel_spin', 0.8);
    this.game.touch();
  }

  /** Where the winning pocket sits on the head, in radians from its zero. */
  private pocketAngle(n: number): number {
    const i = WHEEL_ORDER.indexOf(n);
    return (i / WHEEL_ORDER.length) * Math.PI * 2;
  }

  update(dt: number): void {
    const g = this.game;
    this.t += dt;
    if (this.celebrate > 0) this.celebrate = Math.max(0, this.celebrate - dt);

    // the head never quite stops: a wheel standing still reads as furniture
    this.wheelVel += (1.1 - this.wheelVel) * Math.min(1, dt * 0.7);
    this.wheel += this.wheelVel * dt;

    if (this.phase === 'betting' || this.phase === 'resting') {
      // the ball rests in its pocket and rides round with the head
      if (this.result !== null && this.phase === 'resting') {
        this.ball = this.wheel + this.lockOffset;
      }
      g.touch();
      return;
    }

    if (this.phase === 'spinning') {
      this.ballVel += (-2.6 - this.ballVel) * Math.min(1, dt * 0.55);
      this.ball += this.ballVel * dt;
      // one tick per pocket the ball passes, while it is still going fast
      this.tickAt += Math.abs(this.ballVel) * dt;
      if (this.tickAt > 0.4) {
        this.tickAt = 0;
        audio.play('wheel_ball', 0.2);
      }
      if (this.t >= RIM_TIME) {
        this.phase = 'dropping';
        this.t = 0;
        // aim the drop: after DROP_TIME the head will have turned this far,
        // and the ball has to be sitting on the winning pocket when it does
        const wheelThen = this.wheel + this.wheelVel * DROP_TIME;
        this.lockOffset = this.pocketAngle(this.result!);
        const target = wheelThen + this.lockOffset;
        // land on whichever revolution is just ahead of where the ball is
        let t = target;
        while (t > this.ball) t -= Math.PI * 2;
        this.dropFrom = this.ball;
        this.dropTo = t - Math.PI * 2 * 2;
        audio.play('wheel_dust', 0.35);
      }
      g.touch();
      return;
    }

    // dropping: the ball comes off the rim, bounces across the frets and
    // settles into the pocket the wheel already knows about
    const k = Math.min(1, this.t / DROP_TIME);
    const ease = 1 - Math.pow(1 - k, 2.4);
    this.ball = this.dropFrom + (this.dropTo - this.dropFrom) * ease;
    this.ballOut = 1 - ease;
    // three hops, dying away
    const hop = Math.max(0, Math.sin(k * Math.PI * 3.2)) * (1 - k) * (1 - k);
    if (hop > 0.5 && this.ballHop <= 0.5) audio.play('wheel_clack', 0.4);
    this.ballHop = hop;

    if (k >= 1) {
      this.phase = 'resting';
      this.ballOut = 0;
      this.ballHop = 0;
      this.settle();
    }
    g.touch();
  }

  private dropFrom = 0;
  private dropTo = 0;

  /* ---------------- paying out ---------------- */

  private settle(): void {
    if (this.paid) return;
    this.paid = true;
    const g = this.game;
    const n = this.result!;
    this.history.unshift(n);
    if (this.history.length > 8) this.history.pop();

    let back = 0;
    for (const [key, amount] of this.bets) {
      const bet = betFromKey(key);
      if (betWins(bet, n)) back += amount * (betPayout(bet) + 1);
    }
    this.won = back;
    this.session += back;

    if (back > 0) {
      g.player.gold += back;
      this.celebrate = 2.6;
      this.message = `${n} ${colourOf(n).toUpperCase()} PAYS ${back}`;
      audio.play('gold', 0.7);
      if (back >= this.staked * 12) {
        g.flashScreen(PAL.goldLit, 0.3);
        g.shake(6);
        audio.play('slot_bell', 0.7);
        g.toast('The Whirligig pays', `${back} gold on ${n} ${colourOf(n)}.`, PAL.goldLit);
      }
    } else {
      this.message = `${n} ${colourOf(n).toUpperCase()} — NO PAY`;
      audio.play('ui', 0.4);
    }
    g.touch();
  }

  /** Clear the cloth and let the player bet again. */
  ready(): void {
    if (this.phase !== 'resting') return;
    this.bets.clear();
    this.phase = 'betting';
    this.won = 0;
    this.message = 'PLACE YOUR BETS';
    this.game.touch();
  }

  /** True once the ball has settled and the table is waiting to be reset. */
  get done(): boolean {
    return this.phase === 'resting';
  }
}
