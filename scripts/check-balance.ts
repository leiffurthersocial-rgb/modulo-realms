/**
 * Prints how far every weapon, suit of armour and enemy in the game sits from
 * the shared curves in src/data/balance.ts. Run it after adding content:
 *
 *   npx tsx scripts/check-balance.ts
 *
 * Weapons and armour should read 1.00 for their class and shape — they are
 * generated from the curve, so anything else is a bug. Enemies are authored
 * by hand and are expected to wander; the report flags anything past 1.35x or
 * under 0.7x of its role's budget, which is where a fight stops feeling like
 * the rest of its region.
 */
import { ALL_ENEMIES } from '../src/data/enemies';
import { ARMOR, WEAPONS } from '../src/data/items';
import {
  armorDefenseAt, enemyDamageAt, enemyHealthAt, enemyXpAt,
  weaponDps, type EnemyRole,
} from '../src/data/balance';

let problems = 0;
const flag = (ratio: number, lo = 0.7, hi = 1.35) => {
  if (ratio < lo || ratio > hi) { problems++; return '  <== OUT OF BAND'; }
  return '';
};

console.log('\n=== weapons (dps / budget) ===');
for (const w of WEAPONS) {
  const dps = (w.stats.damage ?? 0) * (w.stats.attackSpeed ?? 1);
  const r = dps / weaponDps(w.weaponKind!, w.level, w.rarity);
  console.log(`${w.id.padEnd(22)} lv${String(w.level).padStart(2)} ${(w.weaponKind ?? '').padEnd(10)} dps=${dps.toFixed(1).padStart(6)}  x${r.toFixed(2)}${flag(r, 0.9, 1.12)}`);
}

console.log('\n=== armour (defense / curve) ===');
for (const a of ARMOR) {
  const r = (a.stats.defense ?? 0) / armorDefenseAt(a.level, a.rarity);
  console.log(`${a.id.padEnd(22)} lv${String(a.level).padStart(2)} def=${String(a.stats.defense).padStart(3)}  x${r.toFixed(2)}${flag(r, 0.55, 1.5)}`);
}

/** Best guess at what an enemy is for, from the shape of its own numbers. */
const roleOf = (hp: number, level: number): EnemyRole => {
  const base = enemyHealthAt(level, 'standard');
  const r = hp / base;
  return r > 5 ? 'boss' : r > 2.4 ? 'elite' : r > 1.32 ? 'brute' : r < 0.8 ? 'skirmisher' : 'standard';
};

console.log('\n=== enemies (vs role budget) ===');
for (const e of [...ALL_ENEMIES].sort((a, b) => a.level - b.level)) {
  const role = e.boss ? 'boss' : e.elite ? 'elite' : roleOf(e.health, e.level);
  const hp = e.health / enemyHealthAt(e.level, role);
  const dmg = e.damage / enemyDamageAt(e.level, role);
  const xp = e.xp / enemyXpAt(e.level, role);
  // The first two levels are deliberately under budget: the slime and the bat
  // are what the game hands you before you know what a dodge roll is.
  const lo = e.level <= 2 ? 0.55 : 0.7;
  console.log(
    `${e.id.padEnd(24)} lv${String(e.level).padStart(2)} ${role.padEnd(10)}` +
    ` hp x${hp.toFixed(2)} dmg x${dmg.toFixed(2)} xp x${xp.toFixed(2)}` +
    flag(hp, lo) + flag(dmg, lo) + flag(xp, lo),
  );
}

console.log(`\n${problems ? `${problems} value(s) out of band.` : 'Everything sits on its curve.'}`);
