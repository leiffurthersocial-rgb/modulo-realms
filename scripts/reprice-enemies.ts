/**
 * Rewrites every enemy's health, damage and xp in src/data/enemies.ts from
 * its declared level and role, using the curves in balance.ts.
 *
 * Those three numbers are literals in the data file — they have to be, because
 * the bestiary is read by eye as often as by code — but they are DERIVED
 * literals, and the moment a curve moves they are all quietly wrong. Rather
 * than hand-editing sixty lines and getting two of them subtly off, run:
 *
 *   npx tsx scripts/reprice-enemies.ts && npx tsx scripts/check-balance.ts
 *
 * It rewrites the file in place and prints what changed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { enemyDamageAt, enemyGoldAt, enemyHealthAt, enemyXpAt, type EnemyRole } from '../src/data/balance';

const path = new URL('../src/data/enemies.ts', import.meta.url);
let src = readFileSync(path, 'utf8');

// Each entry declares role on its own line and the three numbers on another.
const entry = /role: '(skirmisher|standard|brute|elite|boss)',([\s\S]{0,400}?)level: (\d+), health: (\d+), damage: (\d+), defense: (\d+), speed: (\d+), xp: (\d+), gold: \[(\d+), (\d+)\]/g;

let changed = 0;
src = src.replace(entry, (whole, role: string, between: string, lvS: string, hpS: string, dmgS: string, defS: string, spdS: string, xpS: string, g0S: string, g1S: string) => {
  const level = Number(lvS);
  const r = role as EnemyRole;
  const hp = enemyHealthAt(level, r);
  const dmg = enemyDamageAt(level, r);
  const xp = enemyXpAt(level, r);
  const [g0, g1] = enemyGoldAt(level, r);
  if (String(hp) === hpS && String(dmg) === dmgS && String(xp) === xpS
    && String(g0) === g0S && String(g1) === g1S) return whole;
  changed++;
  console.log(`  lv${level} ${role}: hp ${hpS}->${hp}  dmg ${dmgS}->${dmg}  xp ${xpS}->${xp}  gold ${g0S}-${g1S}->${g0}-${g1}`);
  return `role: '${role}',${between}level: ${level}, health: ${hp}, damage: ${dmg}, defense: ${defS}, speed: ${spdS}, xp: ${xp}, gold: [${g0}, ${g1}]`;
});

writeFileSync(path, src);
console.log(changed ? `\n${changed} enemies repriced.` : '\nNothing to reprice.');
