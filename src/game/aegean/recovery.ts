/** Shared recovery budget for damage-driven healing, independent of hit count.
 * A 300-target cleave must not refill the bar 300 times. Potions and deliberate
 * healing abilities keep their own costs/cooldowns and do not use this bucket. */
export class AegeanRecovery {
  private last = -Infinity;
  private credit = 0;
  reset(): void { this.last = -Infinity; this.credit = 0; }
  take(requested: number, maxHp: number, now: number): number {
    if (!(requested > 0) || !(maxHp > 0) || !Number.isFinite(requested)) return 0;
    const capacity = maxHp * .02;
    if (!Number.isFinite(this.last) || now < this.last) this.credit = capacity;
    else this.credit = Math.min(capacity, this.credit + Math.max(0, now - this.last) * maxHp * .02);
    this.last = now;
    const result = Math.min(requested, maxHp * .0075, this.credit);
    this.credit -= result;
    return result;
  }
}
