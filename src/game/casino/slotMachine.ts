import { PAL } from '../art/palette';
import { audio } from '../audio/audio';
import type { Game } from '../core/game';
import { SLOT_REEL, SLOT_TRIPLE, STAKES, spinSlots, type SlotResult, type SlotSymbol } from './games';

/**
 * The three-reel machine on the west wall of the Gilded Spade.
 *
 * This is the machine's *mechanism* — reels, brakes, the handle, the coin
 * chute — and it ticks in game time from `Casino.update`, not from a timer
 * inside React. The cabinet that draws it lives in `art/slotCabinet.ts` and
 * only ever reads.
 *
 * The rules it plays by are still `games.ts`: the outcome of a pull is
 * decided the instant the handle goes over, and everything below is the
 * reels catching up to an answer that already exists. That is how a real
 * machine works, and it is also the only way the stops can be staged — a
 * reel cannot be held back for effect if nobody knows yet whether holding it
 * back means anything.
 */

/** Cells per second a reel turns at full speed. */
const FREE_SPEED = 26;
/** How long a reel takes to brake onto its stop. */
const BRAKE_TIME = 0.52;
/** Seconds of being left alone before the machine starts touting. */
const ATTRACT_AFTER = 6;
/** How far the handle has to travel before letting go fires a spin. */
const LEVER_THRESHOLD = 0.72;

interface Brake {
  from: number;
  to: number;
  k: number;
}

interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rv: number;
}

const stripAt = (i: number): SlotSymbol =>
  SLOT_REEL[((i % SLOT_REEL.length) + SLOT_REEL.length) % SLOT_REEL.length];

/** Overshoot and settle — a reel that stops dead has no weight in it. */
function easeOutBack(k: number): number {
  const c1 = 1.9;
  const c3 = c1 + 1;
  const x = k - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

export class SlotMachine {
  stake: number = STAKES[0];
  result: SlotResult | null = null;
  spinning = false;
  /** Seconds the machine has been open, for light chases and glare. */
  t = 0;
  /** Seconds since the player last touched anything. */
  idle = 0;

  /* ---- the handle ---- */
  /** Where the arm actually is, 0 at rest and 1 fully down. */
  lever = 0;
  /** True while a pointer is dragging the knob. */
  held = false;
  /** True while a pointer is over the knob. */
  hot = false;
  private armed = false;

  /* ---- the reels ---- */
  pos: [number, number, number] = [0, 7, 13];
  speed: [number, number, number] = [0, 0, 0];
  private brake: Array<Brake | null> = [null, null, null];
  private stopAt: [number, number, number] = [0, 0, 0];
  private prev: [number, number, number] = [0, 7, 13];
  locked = 0;
  elapsed = 0;

  /* ---- the show ---- */
  celebrate = 0;
  bell = 0;
  anticipation = 0;
  win = 0;
  credit = 0;
  session = 0;
  tray = 0;
  coins: Coin[] = [];
  insert = [0, 0, 0, 0, 0];
  message = 'INSERT A COIN';
  private tickPos = 0;
  private drain = 0;
  private teased = false;

  constructor(private game: Game, private take: (amount: number) => boolean) {
    this.credit = game.player.gold;
  }

  /* ---------------- what the player does to it ---------------- */

  /** Drop a coin in one of the five slots. That is how a stake is chosen. */
  insertCoin(index: number): void {
    const value = STAKES[index];
    if (this.spinning || value === undefined) return;
    this.idle = 0;
    if (this.game.player.gold < value) {
      this.message = 'NOT ENOUGH GOLD';
      audio.play('ui', 0.3);
      return;
    }
    this.stake = value;
    this.insert[index] = 1;
    this.message = 'PULL THE HANDLE';
    audio.play('slot_coin_in', 0.6);
    this.game.touch();
  }

  /** The pointer moved over or off the knob. */
  hover(on: boolean): void {
    if (this.hot === on) return;
    this.hot = on;
    this.game.touch();
  }

  /** Grab the knob. */
  grab(): void {
    if (this.spinning) return;
    this.held = true;
    this.idle = 0;
    this.armed = false;
  }

  /** Drag it down. `v` is 0 at rest, 1 at the bottom of the travel. */
  drag(v: number): void {
    if (!this.held || this.spinning) return;
    this.lever = Math.max(0, Math.min(1, v));
    if (this.lever >= LEVER_THRESHOLD) this.armed = true;
    this.idle = 0;
    this.game.touch();
  }

  /**
   * Let go. Pulled far enough and the machine goes; short of that the handle
   * springs back and nothing has happened, which is the whole reason it is a
   * handle and not a button.
   */
  release(): void {
    if (!this.held) return;
    this.held = false;
    if (this.armed && !this.spinning) this.pull();
    else if (this.lever > 0.05) audio.play('slot_lever', 0.25);
    this.armed = false;
  }

  /** A click rather than a drag: yank it all the way and let go. */
  yank(): void {
    if (this.spinning) return;
    this.lever = 1;
    this.held = false;
    this.armed = false;
    this.pull();
  }

  /* ---------------- the pull ---------------- */

  private pull(): void {
    if (this.spinning) return;
    if (!this.take(this.stake)) {
      this.message = 'NOT ENOUGH GOLD';
      this.lever = 0;
      return;
    }
    this.session -= this.stake;
    this.idle = 0;
    this.teased = false;
    this.win = 0;
    this.celebrate = 0;
    this.bell = 0;
    this.anticipation = 0;
    this.locked = 0;
    this.elapsed = 0;
    this.message = 'GOOD LUCK';

    // The answer first, the theatre second.
    this.result = spinSlots();
    for (let i = 0; i < 3; i++) {
      this.speed[i] = FREE_SPEED + i * 1.6;
      this.brake[i] = null;
    }
    this.stopAt = [0.75, 1.25, 1.8];
    this.spinning = true;
    audio.play('slot_lever', 0.7);
    this.game.touch();
  }

  /** The first strip index at or after `from` that shows `sym`. */
  private findStop(from: number, sym: SlotSymbol): number {
    const start = Math.ceil(from);
    for (let k = 0; k <= SLOT_REEL.length; k++) {
      if (stripAt(start + k) === sym) return start + k;
    }
    return start;
  }

  /* ---------------- per-frame ---------------- */

  update(dt: number): void {
    const g = this.game;
    this.t += dt;
    this.idle += dt;

    // the handle springs back on its own once nobody is holding it
    if (!this.held && this.lever > 0) {
      this.lever = Math.max(0, this.lever - dt * 3.4);
      g.touch();
    }
    for (let i = 0; i < this.insert.length; i++) {
      if (this.insert[i] > 0) this.insert[i] = Math.max(0, this.insert[i] - dt * 2.6);
    }
    if (this.celebrate > 0) this.celebrate = Math.max(0, this.celebrate - dt);
    if (this.bell > 0) this.bell = Math.max(0, this.bell - dt);
    if (this.anticipation > 0 && !this.spinning) this.anticipation = Math.max(0, this.anticipation - dt * 3);

    // the credit lamp counts, rather than jumping
    const gold = g.player.gold;
    if (Math.abs(this.credit - gold) > 0.5) {
      const step = Math.max(2, Math.abs(gold - this.credit) * 3.4) * dt * 60 / 60;
      this.credit += Math.sign(gold - this.credit) * Math.min(Math.abs(gold - this.credit), step * 6);
      g.touch();
    } else this.credit = gold;

    this.updateCoins(dt);
    if (this.spinning) this.updateReels(dt);
    else if (this.idle > ATTRACT_AFTER && this.lever === 0) {
      // Attract mode. The message alternates so the cabinet is never a still
      // photograph of itself, which is exactly what an idle machine on a
      // real floor does.
      this.message = Math.floor(this.t / 2.4) % 2 === 0 ? 'PULL THE HANDLE' : 'THE HOUSE COUNTS TWICE';
    }

    // the tray gives its coins back to the room once the fuss is over
    if (this.tray > 0 && this.celebrate <= 0 && !this.spinning) {
      this.drain += dt;
      if (this.drain > 0.35) {
        this.drain = 0;
        this.tray--;
        g.touch();
      }
    }
  }

  /** How far into attract mode the machine is, 0..1. */
  get attract(): number {
    if (this.spinning || this.celebrate > 0) return 0;
    return Math.max(0, Math.min(1, (this.idle - ATTRACT_AFTER) / 1.2));
  }

  private updateReels(dt: number): void {
    const g = this.game;
    this.elapsed += dt;
    const res = this.result!;

    for (let i = 0; i < 3; i++) {
      const br = this.brake[i];
      if (br) {
        br.k = Math.min(1, br.k + dt / BRAKE_TIME);
        this.pos[i] = br.from + (br.to - br.from) * easeOutBack(br.k);
        if (br.k >= 1) {
          this.pos[i] = br.to;
          this.brake[i] = null;
          if (this.locked <= i) {
            this.locked = i + 1;
            audio.play('slot_reel_stop', 0.5);
            this.onReelLocked(i);
          }
        }
      } else if (this.locked <= i) {
        this.pos[i] += this.speed[i] * dt;
        if (this.elapsed >= this.stopAt[i]) {
          this.brake[i] = { from: this.pos[i], to: this.findStop(this.pos[i] + 3, res.reels[i]), k: 0 };
        }
      }
      this.speed[i] = (this.pos[i] - this.prev[i]) / Math.max(dt, 1e-4);
      this.prev[i] = this.pos[i];
    }

    // one tick per cell that goes past, so the reels are audible
    const travelled = Math.floor(this.pos[0] + this.pos[1] + this.pos[2]);
    if (travelled !== this.tickPos) {
      this.tickPos = travelled;
      if (this.elapsed > 0.06) audio.play('slot_reel_tick', 0.16);
    }

    g.touch();
    if (this.locked >= 3) this.settle();
  }

  /**
   * A reel coming to rest. When the first two agree, the third is held back
   * and slowed to a crawl: the machine is doing nothing it did not already
   * know the answer to, but the two seconds it spends not telling you are
   * most of what a slot machine is for.
   */
  private onReelLocked(i: number): void {
    if (i !== 1 || this.teased) return;
    const res = this.result!;
    if (res.reels[0] !== res.reels[1]) return;
    this.teased = true;
    this.anticipation = 1;
    this.stopAt[2] = this.elapsed + 1.9;
    this.speed[2] = 7;
    audio.play('slot_tease', 0.5);
  }

  private settle(): void {
    const g = this.game;
    this.spinning = false;
    this.anticipation = 0;
    const res = this.result!;
    const back = res.payout > 0 ? this.stake * (res.payout + 1) : 0;
    this.win = back;
    this.session += back;

    if (back <= 0) {
      this.message = 'NO PAY';
      this.idle = 0;
      g.touch();
      return;
    }

    g.player.gold += back;
    this.celebrate = 2.8;
    this.message = res.label.toUpperCase();
    this.idle = 0;
    // coins out of the chute, one per multiple won, capped so a jackpot does
    // not bury the tray in three hundred sprites
    const n = Math.min(16, Math.max(3, Math.round(res.payout)));
    for (let k = 0; k < n; k++) {
      this.coins.push({
        x: 76 + (Math.random() - 0.5) * 6,
        y: 266,
        vx: (Math.random() - 0.5) * 26,
        vy: -60 - Math.random() * 40,
        r: Math.random() * Math.PI,
        rv: 6 + Math.random() * 6,
      });
    }
    audio.play('gold', 0.6);

    if (res.payout >= SLOT_TRIPLE.crown) {
      this.bell = res.payout >= SLOT_TRIPLE.seven ? 2.4 : 1.2;
      audio.play('slot_bell', 0.8);
      g.flashScreen(PAL.goldLit, res.payout >= SLOT_TRIPLE.seven ? 0.45 : 0.28);
      g.shake(res.payout >= SLOT_TRIPLE.seven ? 12 : 6);
      g.toast(res.label, `${back} gold.`, PAL.goldLit);
    } else {
      audio.play('loot', 0.5);
    }
    g.touch();
  }

  private updateCoins(dt: number): void {
    if (!this.coins.length) return;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.vy += 420 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.r += c.rv * dt;
      if (c.y > 288) {
        this.coins.splice(i, 1);
        this.tray = Math.min(26, this.tray + 1);
        audio.play('slot_coin_in', 0.22);
      }
    }
    this.game.touch();
  }

  /** Which reels are lit as part of the paying line. */
  hits(): [boolean, boolean, boolean] {
    const res = this.result;
    if (this.spinning || !res || res.payout <= 0) return [false, false, false];
    if (res.reels[0] === res.reels[1] && res.reels[1] === res.reels[2]) return [true, true, true];
    return [res.reels[0] === 'cherry', res.reels[1] === 'cherry', res.reels[2] === 'cherry'];
  }

  get jackpot(): boolean {
    return this.result?.label === 'JACKPOT';
  }
}
