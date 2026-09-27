import type { Game } from './game';
import type { Enemy } from '../entities/enemy';
import { PAL } from '../art/palette';
import { audio } from '../audio/audio';

/**
 * The first two minutes of a new character: walk, fight, dodge.
 *
 * It happens where the character stands — the lane outside home in Ashvale —
 * and nothing about it is a menu. Each stage asks for one thing, checks for
 * it in the world, and moves on the moment it sees it:
 *
 * 1. `move`   — walk a few houses' worth with the movement keys.
 * 2. `attack` — a wolf wanders in; kill it.
 * 3. `dodge`  — a Cutter lookout with a slow, ringed swing; dash through the
 *               swing three times. A dodge is a dash made during the wind-up
 *               of a swing that then lands on nothing.
 * 4. `finish` — put him down.
 *
 * The trainers hit for a single point, so nobody dies learning. Killing the
 * lookout before three dodges sends another one out. When it is over the
 * Somewhere to Start quest is handed over, exactly as it used to be at the
 * first frame.
 *
 * Only the fact that it is finished is saved (the `training:done` flag): a
 * save made halfway starts it again, which is two minutes, not a lost run.
 */
export type TrainingStage = 'move' | 'attack' | 'dodge' | 'finish';

export const TRAINING_DONE = 'training:done';
/** Dodges the third stage asks for. */
export const TRAINING_DODGES = 3;
/** Pixels of walking the first stage asks for. */
export const TRAINING_WALK = 240;
/** How much slower the lookout winds up than an ordinary Cutter. */
const LOOKOUT_WINDUP = 2.4;

export class Training {
  stage: TrainingStage = 'move';
  walked = 0;
  dodges = 0;
  private lastX: number;
  private lastY: number;
  private trainer: Enemy | null = null;
  /** When the current swing started winding up; -1 when none is. */
  private swingFrom = -1;
  private flash = 0;

  constructor(private game: Game) {
    this.lastX = game.player.x;
    this.lastY = game.player.y;
  }

  /** Progress in the current stage, for the HUD card. */
  get progress(): { value: number; max: number } {
    if (this.stage === 'move') return { value: Math.min(TRAINING_WALK, this.walked), max: TRAINING_WALK };
    if (this.stage === 'dodge') return { value: this.dodges, max: TRAINING_DODGES };
    return { value: 0, max: 1 };
  }

  /** Seconds since the last stage change or dodge, for a brief glow on the card. */
  get recent(): boolean {
    return this.game.now - this.flash < 0.6;
  }

  update(): void {
    const g = this.game;
    const p = g.player;
    if (g.map.id !== 'overworld') return;
    switch (this.stage) {
      case 'move': {
        const step = Math.hypot(p.x - this.lastX, p.y - this.lastY);
        // a waystone or a door is not walking
        if (step < 64) this.walked += step;
        if (this.walked >= TRAINING_WALK) this.advance('attack');
        break;
      }
      case 'attack':
        if (!this.trainer) this.trainer = this.spawn('wolf', false);
        else if (this.trainer.dead || !g.enemies.includes(this.trainer)) {
          this.trainer = null;
          this.advance('dodge');
        }
        break;
      case 'dodge':
      case 'finish':
        this.watchLookout();
        break;
    }
    this.lastX = p.x;
    this.lastY = p.y;
  }

  private watchLookout(): void {
    const g = this.game;
    const t = this.trainer;
    if (!t || t.dead || !g.enemies.includes(t)) {
      this.trainer = null;
      this.swingFrom = -1;
      if (this.stage === 'finish') { this.complete(); return; }
      // killed early: another one comes out of the hedge
      this.trainer = this.spawn('bandit', true);
      return;
    }
    if (t.windupTime > 0 && this.swingFrom < 0) this.swingFrom = g.now;
    if (t.windupTime <= 0 && this.swingFrom >= 0) {
      // the swing has landed this frame — on the player, or on air
      const dashed = g.lastDashAt >= this.swingFrom;
      const hit = g.lastDamageTaken >= this.swingFrom;
      this.swingFrom = -1;
      if (this.stage === 'dodge' && dashed && !hit) {
        this.dodges++;
        this.flash = g.now;
        g.floatText(g.player.x, g.player.y - 40, 'Dodged!', PAL.goldLit, 14);
        audio.play('ui_big', 0.5);
        if (this.dodges >= TRAINING_DODGES) this.advance('finish');
      }
    }
  }

  /** A trainer a little way off the player, harmless and, for the lookout, slow. */
  private spawn(id: string, lookout: boolean): Enemy {
    const g = this.game;
    const p = g.player;
    const a = Math.atan2(p.y - this.lastY, p.x - this.lastX) || 0;
    g.summon(id, p.x + Math.cos(a) * 190, p.y + Math.sin(a) * 190, 1);
    const e = g.enemies[g.enemies.length - 1];
    e.damage = 1;
    e.state = 'chase';
    // a trainer is there to be fought, not chased across the valley
    e.fleeAt = 0;
    if (lookout) {
      e.windupMul = LOOKOUT_WINDUP;
      e.showTelegraph = true;
    }
    g.fx.spawn(e.x, e.y, 14, PAL.fog, { speed: 70, life: 0.5, size: 2 });
    return e;
  }

  private advance(stage: TrainingStage): void {
    this.stage = stage;
    this.flash = this.game.now;
    audio.play('quest', 0.5);
    this.game.touch();
  }

  /** Done, by playing it or by skipping it: hand the first quest over. */
  complete(skipped = false): void {
    const g = this.game;
    if (this.trainer && !this.trainer.dead) {
      this.trainer.dead = true;
      g.fx.spawn(this.trainer.x, this.trainer.y, 14, PAL.fog, { speed: 70, life: 0.5, size: 2 });
    }
    this.trainer = null;
    g.finishTraining(skipped);
  }
}
