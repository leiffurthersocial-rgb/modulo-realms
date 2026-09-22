import { PAL, withAlpha } from '../art/palette';
import { audio } from '../audio/audio';
import type { Game } from '../core/game';
import type { PropInstance } from '../world/map';

/**
 * The Whirligig: the Gilded Spade's roulette wheel, its theft, its repair and
 * the show it puts on afterwards.
 *
 * The wheel is the one fixture in the casino that is not a game the player
 * sits down at. It starts the game with its head unbolted and carried into
 * Whisperwell Cave, and the only thing the player can do at it is find out
 * that it is broken. Fitting the head back on is a staged sequence rather
 * than a menu click, because the payoff for a fetch this small has to be
 * something you watch rather than something you read in a toast.
 *
 * Nothing in here owns state that has to survive a save: the wheel's
 * condition is one player flag, and `Game.applyStoryProps` rebuilds the prop
 * from it every time the room is entered.
 */

/** The flag that says the head is back on the spindle. */
export const WHEEL_FIXED = 'casino_wheel_fixed';
/** The flag Dario's gold-framed conversation sets. */
export const WHEEL_LEAD = 'casino_wheel_lead';
/** The flag that says the head has been picked up out of the cave. */
export const WHEEL_HEAD_TAKEN = 'casino_wheel_head_taken';

/** One beat of the repair: when it fires, and what it does. */
interface Cue {
  at: number;
  run: (s: RouletteShow) => void;
}

/**
 * The repair, beat by beat.
 *
 * Every entry is one small piece of motion, and they are deliberately close
 * together: the sequence runs about seven seconds and never goes more than
 * half of one without something happening, because a camera that has zoomed
 * in and then sits still reads as a freeze rather than as a moment.
 */
const REPAIR: Cue[] = [
  // 1. the room leans in and the player kneels to the wheel
  {
    at: 0, run: (s) => {
      s.game.player.anim = 'cast';
      s.game.player.animTime = 0;
      s.game.player.facing = Math.atan2(s.y - s.game.player.y, s.x - s.game.player.x);
      audio.play('ui_big', 0.55);
    },
  },
  // 2. the head comes out of the pack, named, in its own gold
  {
    at: 0.45, run: (s) => {
      s.game.floatText(s.game.player.x, s.game.player.y - 52, "The Whirligig's Head", PAL.goldLit, 14);
      s.game.particles(s.game.player.x, s.game.player.y - 20, 14, PAL.goldLit, { speed: 60, life: 0.7, size: 2, gravity: -30 });
      audio.play('loot', 0.6);
    },
  },
  // 3. it travels: a line of brass sparks from the player's hands to the bowl
  {
    at: 0.8, run: (s) => {
      const p = s.game.player;
      for (let i = 0; i <= 8; i++) {
        const k = i / 8;
        s.game.particles(p.x + (s.x - p.x) * k, p.y - 20 + (s.y - 12 - (p.y - 20)) * k, 2, PAL.gold, { speed: 14, life: 0.5, size: 2, gravity: -8 });
      }
      audio.play('swing', 0.4);
    },
  },
  // 4. the bowl is swept out — a year of dust off a thing nobody touched
  {
    at: 1.2, run: (s) => {
      s.game.particles(s.x, s.y - 14, 20, '#c9b184', { speed: 70, life: 0.9, size: 2, gravity: 26, spread: Math.PI * 2 });
      audio.play('wheel_dust', 0.5);
    },
  },
  // 5-8. four bolts, one at a time, each with its own spark and its own tick
  { at: 1.7, run: (s) => s.bolt(0) },
  { at: 2.05, run: (s) => s.bolt(1) },
  { at: 2.4, run: (s) => s.bolt(2) },
  { at: 2.75, run: (s) => s.bolt(3) },
  // 9. the head seats: the prop becomes the working wheel, and the lamp over
  //    it comes back up from the dim brass of a dead fixture
  {
    at: 3.1, run: (s) => {
      s.fitHead();
      s.game.fx.ring(s.x, s.y - 14, 70, PAL.goldLit);
      s.game.particles(s.x, s.y - 14, 18, PAL.goldLit, { speed: 90, life: 0.6, size: 2, gravity: -20, spread: Math.PI * 2 });
      audio.play('wheel_lock', 0.7);
      s.game.shake(4);
    },
  },
  // 10. the test spin, winding up
  {
    at: 3.6, run: (s) => {
      audio.play('wheel_spin', 0.6);
      s.game.fx.ring(s.x, s.y - 14, 44, withAlpha(PAL.gold, 0.7));
    },
  },
  // 11. the ball goes in and bounces its way down into the pockets
  { at: 4.15, run: (s) => s.ballBounce(0) },
  { at: 4.42, run: (s) => s.ballBounce(1) },
  { at: 4.66, run: (s) => s.ballBounce(2) },
  { at: 4.86, run: (s) => s.ballBounce(3) },
  // 12. it drops into a pocket, and the room notices
  {
    at: 5.1, run: (s) => {
      s.game.flashScreen('#f6bf5d', 0.32);
      s.game.freeze(0.12);
      s.game.shake(9);
      s.game.fx.ring(s.x, s.y - 14, 170, PAL.goldLit);
      s.game.particles(s.x, s.y - 14, 54, PAL.goldLit, { speed: 150, life: 1.2, size: 3, gravity: -42, spread: Math.PI * 2 });
      s.game.floatText(s.x, s.y - 54, 'SEVENTEEN BLACK', PAL.goldLit, 17);
      audio.play('discover', 0.8);
    },
  },
  // 13. the house pays: coins arcing off the rim and onto the carpet
  {
    at: 5.5, run: (s) => {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI * 0.85 + (i / 4) * Math.PI * 0.7;
        s.game.particles(s.x + Math.cos(a) * 10, s.y - 18, 5, PAL.gold, { speed: 130, life: 1.1, size: 2, gravity: 190, angle: a, spread: 0.4 });
      }
      audio.play('gold', 0.7);
    },
  },
  // 14. the floor reacts — the nearest patrons look up and say so
  {
    at: 5.8, run: (s) => {
      s.cheer();
      audio.play('crowd_cheer', 0.55);
    },
  },
  // 15. Dario, from wherever he is standing, gets the last word
  {
    at: 6.2, run: (s) => {
      s.dario('"Let it roll."', '#f6bf5d');
      s.game.particles(s.x, s.y - 30, 10, PAL.white, { speed: 40, life: 0.8, size: 1, gravity: -26 });
    },
  },
  // 16. the camera lets go and the job books itself in
  { at: 6.9, run: (s) => s.finish() },
];

/** How often the repaired wheel puts on its idle show, in seconds. */
const AMBIENT_EVERY = 11;

export class RouletteShow {
  readonly game: Game;
  /** True while the repair sequence owns the camera and the player. */
  showing = false;
  private t = 0;
  private cue = 0;
  /** Wheel position in map pixels, captured when the sequence starts. */
  x = 0;
  y = 0;
  private ambient = AMBIENT_EVERY * 0.5;
  private ambientStep = -1;

  constructor(game: Game) {
    this.game = game;
  }

  /** The wheel prop in the room the player is standing in, if any. */
  prop(): PropInstance | undefined {
    return this.game.map.props.find((p) => p.data?.station === 'roulette');
  }

  /** Is the wheel whole? */
  get fixed(): boolean {
    return this.game.player.flags.has(WHEEL_FIXED);
  }

  /** Does the player have the head in their pack? */
  get carryingHead(): boolean {
    return this.game.player.inventory.some((i) => i.defId === 'q_wheel_head');
  }

  /**
   * Walking up to the wheel and pressing E.
   *
   * Three different things, depending on what the player is carrying: a
   * description of the damage, the repair, or — once it runs — a spin to
   * watch. None of them is a menu.
   */
  use(): void {
    const g = this.game;
    if (this.showing) return;
    if (this.fixed) {
      g.toast('The Whirligig', 'Turning, ticking, and taking money off three people at once. As intended.', '#f6bf5d');
      this.burst();
      audio.play('wheel_spin', 0.45);
      return;
    }
    if (this.carryingHead) {
      this.start();
      return;
    }
    g.toast(
      'DAMAGED',
      g.player.flags.has(WHEEL_LEAD)
        ? 'Four bolt holes, a bare spindle and a snapped handle on the cloth. The head is in Whisperwell Cave, south-west of town, and it is not going to walk back on its own.'
        : 'The head is gone. Four bolt holes, a bare spindle and a snapped handle lying on the cloth — somebody unbolted it and carried it out of the building. Dario, behind the cards, has not looked at it once.',
      '#d9553f',
    );
    audio.play('wheel_dust', 0.4);
    this.game.particles(this.propX(), this.propY() - 14, 8, '#c9b184', { speed: 40, life: 0.8, size: 1, gravity: 30, spread: Math.PI * 2 });
  }

  private propX(): number {
    return this.prop()?.x ?? this.game.player.x;
  }

  private propY(): number {
    return this.prop()?.y ?? this.game.player.y;
  }

  /** Begin the repair. The player does not get to walk away from it. */
  start(): void {
    const pr = this.prop();
    if (!pr || this.showing) return;
    this.x = pr.x;
    this.y = pr.y;
    this.showing = true;
    this.t = 0;
    this.cue = 0;
    // The camera holds itself: `hold` is longer than the sequence, and the
    // sequence releases it, so a dropped frame cannot cut the shot short.
    this.game.cameraFocus = { x: this.x, y: this.y - 16, zoom: 3.6, hold: 99, then: null };
    this.game.touch();
  }

  /** One of the four hold-down bolts going back in. */
  bolt(i: number): void {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const bx = this.x + Math.cos(a) * 11;
    const by = this.y - 14 + Math.sin(a) * 5;
    this.game.particles(bx, by, 7, PAL.goldLit, { speed: 70, life: 0.4, size: 1, gravity: 40, spread: Math.PI * 2 });
    this.game.particles(bx, by, 3, PAL.white, { speed: 110, life: 0.25, size: 1, gravity: 0, spread: Math.PI * 2 });
    this.game.shake(2);
    audio.play('wheel_clack', 0.45 + i * 0.06);
  }

  /** The ball hopping around the rim before it settles. */
  ballBounce(i: number): void {
    const a = 1.2 - i * 1.5;
    const bx = this.x + Math.cos(a) * (15 - i * 2);
    const by = this.y - 14 + Math.sin(a) * (7 - i);
    this.game.particles(bx, by, 4 - i, PAL.white, { speed: 46, life: 0.3, size: 1, gravity: 60, spread: Math.PI * 2 });
    audio.play('wheel_ball', 0.5 - i * 0.08);
  }

  /**
   * Swap the broken fixture for the working one.
   *
   * The prop carries its own identity in `data.station`, so this finds the
   * wheel without caring where the room layout put it, and the same call is
   * what `Game.applyStoryProps` uses to restore the repaired wheel on a
   * later visit.
   */
  fitHead(): void {
    const pr = this.prop();
    if (!pr) return;
    pr.art = 'casino_roulette';
    pr.light = 70;
    pr.lightColor = '#f6bf5d';
    pr.label = 'Watch the wheel';
    pr.nameplate = undefined;
    pr.nameplateColor = undefined;
    this.game.touch();
  }

  /** Put the broken wheel back, for a room entered before the repair. */
  breakAgain(): void {
    const pr = this.prop();
    if (!pr) return;
    pr.art = 'casino_roulette_broken';
    pr.light = 30;
    pr.lightColor = '#8a6a2c';
    pr.label = 'Inspect the damaged wheel';
    pr.nameplate = 'DAMAGED';
    pr.nameplateColor = '#d9553f';
  }

  /** The nearest seated patrons look up and say something. */
  cheer(): void {
    const said = ['"Ha!"', '"About time."', '"Put me down for red."'];
    const seats = this.game.map.props
      .filter((p) => p.art.startsWith('casino_sit_'))
      .sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))
      .slice(0, 3);
    seats.forEach((p, i) => {
      this.game.floatText(p.x, p.y - 46, said[i % said.length], '#efe6d6', 12);
      this.game.particles(p.x, p.y - 40, 4, '#efe6d6', { speed: 30, life: 0.6, size: 1, gravity: -20 });
    });
  }

  /** Give Dario a line over his head, wherever he happens to be standing. */
  dario(line: string, color = '#efe6d6'): void {
    const npc = this.game.npcs.find((n) => n.def.id === 'dealer_dario');
    if (!npc) return;
    this.game.floatText(npc.x, npc.y - 54, line, color, 14);
  }

  /** A handful of brass sparks off the rim. */
  private burst(): void {
    this.game.particles(this.propX(), this.propY() - 16, 12, PAL.goldLit, { speed: 80, life: 0.7, size: 2, gravity: -30, spread: Math.PI * 2 });
  }

  /**
   * The end of the sequence: camera back, flag set, bounty closed out.
   *
   * The wheel head is *not* removed here. The bounty carries a collect
   * objective for it, and `Game.turnInQuest` consumes collect objectives when
   * it pays out — taking the item first would leave the objective unmet and
   * the quest permanently open.
   */
  finish(): void {
    const g = this.game;
    this.showing = false;
    g.cameraFocus = null;
    g.player.flags.add(WHEEL_FIXED);
    g.player.anim = 'idle';
    g.toast('The Whirligig turns again', 'The Gilded Spade has a roulette wheel for the first time in a month.', '#f6bf5d', 'quest');
    for (const qid of g.quests.onInteract('roulette_repair')) g.questProgressToast(qid);
    // The house notices. This is the reputation that moves Dario's attitude
    // from Neutral, and it is deliberately larger than the bounty's own.
    g.player.addRep('guild', 25);
    g.stationDarioAtWheel();
    g.autosave();
    g.touch();
  }

  /**
   * Per-frame. Drives the repair while it runs, and the wheel's idle show
   * once it is fixed.
   */
  update(dt: number): void {
    if (this.showing) {
      this.t += dt;
      while (this.cue < REPAIR.length && this.t >= REPAIR[this.cue].at) {
        REPAIR[this.cue++].run(this);
      }
      return;
    }
    if (!this.fixed || this.game.map.id !== 'int_casino') return;

    // The idle show. Dario stands at the wheel from here on, and every few
    // seconds he works it: the spin, the ball, the call. It is the same beats
    // as the repair at a tenth of the volume, which is what makes the fixed
    // wheel feel like a station in the room rather than a finished quest.
    this.ambient -= dt;
    if (this.ambient > 0) return;
    const pr = this.prop();
    if (!pr) return;
    this.ambientStep = (this.ambientStep + 1) % 4;
    switch (this.ambientStep) {
      case 0:
        this.dario('"Place them, then."');
        audio.play('wheel_spin', 0.3);
        this.game.fx.ring(pr.x, pr.y - 14, 34, withAlpha(PAL.gold, 0.5));
        this.ambient = 1.5;
        break;
      case 1:
        this.game.particles(pr.x, pr.y - 16, 6, PAL.white, { speed: 50, life: 0.4, size: 1, gravity: 40, spread: Math.PI * 2 });
        audio.play('wheel_ball', 0.35);
        this.ambient = 1.4;
        break;
      case 2:
        this.dario('"Let it roll."', '#f6bf5d');
        audio.play('wheel_clack', 0.3);
        this.game.particles(pr.x, pr.y - 14, 10, PAL.goldLit, { speed: 60, life: 0.7, size: 2, gravity: -24, spread: Math.PI * 2 });
        this.ambient = 2.2;
        break;
      default:
        this.cheer();
        audio.play('gold', 0.35);
        this.ambient = AMBIENT_EVERY;
        break;
    }
  }
}
