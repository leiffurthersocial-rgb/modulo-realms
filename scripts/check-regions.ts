/**
 * Prints what a fight in each region actually costs, which is the only way to
 * check a claim like "the south should be brutal and the west should not".
 *
 * A region's level band says WHEN you are meant to be there. Its difficulty
 * multiplier says what it feels like once you are, and the two are different
 * claims — so this reports seconds-to-kill for a typical build of the right
 * level, after the region multiplier, for a rank-and-file enemy and a boss.
 *
 *   npx tsx scripts/check-regions.ts
 */
import {
  LEVEL_BANDS, REGION_BOSS_DIFFICULTY, REGION_DIFFICULTY,
  TIME_TO_KILL, playerDpsAt, enemyHealthAt, enemyDefenseAt, enemyDamageAt, ENEMY_THREAT,
  damageTaken,
} from '../src/data/balance';

console.log('region        band     standard   boss      a hit costs');
for (const b of LEVEL_BANDS) {
  const lv = Math.round((b.from + b.to) / 2);
  const mul = REGION_DIFFICULTY[b.region] ?? 1;
  const bossMul = REGION_BOSS_DIFFICULTY[b.region] ?? 1;
  const dps = playerDpsAt(lv);

  const secs = (role: 'standard' | 'boss', m: number) =>
    (enemyHealthAt(lv, role) * m) / (dps * (100 / (100 + enemyDefenseAt(lv, role))));

  // What one ordinary blow takes off a reasonably armoured character. Armour
  // at level L lands near 12*L for someone wearing their era's gear.
  // Matches Enemy's split: health takes the region multiplier whole, damage
  // takes it softened.
  const dmgMul = 1 + (mul - 1) * 0.6;
  const hit = enemyDamageAt(lv, 'standard') * ENEMY_THREAT.damage * dmgMul * damageTaken(12 * lv, lv);
  // Health for the same character, from the class curves plus vitality.
  const hp = 110 + 13 * lv + 5 * (12 + lv * 0.8);
  console.log(
    b.region.padEnd(12),
    `${b.from}-${b.to}`.padEnd(8),
    `${secs('standard', mul).toFixed(0)}s`.padStart(8),
    `${secs('boss', bossMul).toFixed(0)}s`.padStart(8),
    `${((hit / hp) * 100).toFixed(0)}% of health`.padStart(16),
    `  (x${mul} / boss x${bossMul})`,
  );
}
