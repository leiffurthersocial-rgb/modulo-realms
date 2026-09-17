/**
 * Prints what gear costs against what the ground pays for it, which is the
 * only way to say whether a price is "expensive" — a number on its own means
 * nothing. For each level band: the buy price of a typical piece from a
 * merchant, what the same piece sells back for, and how many ordinary kills
 * or boss kills it takes to afford one.
 *
 *   npx tsx scripts/check-economy.ts
 */
import { ALL_ENEMIES } from '../src/data/enemies';
import { LEVEL_BANDS, REGION_DIFFICULTY } from '../src/data/balance';
import { makeItem, buyValue, sellValue } from '../src/game/items/loot';
import { WEAPONS, ARMOR } from '../src/data/items';

/** Average gold a rank-and-file kill pays at this level. */
function goldPerKill(level: number): number {
  const near = ALL_ENEMIES
    .filter((e) => e.role !== 'boss' && e.role !== 'elite')
    .sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level))
    .slice(0, 5);
  const avg = near.reduce((s, e) => s + (e.gold[0] + e.gold[1]) / 2, 0) / Math.max(1, near.length);
  // scaled to the level actually being fought
  return avg * (level / Math.max(1, near[0]?.level ?? level));
}

function bossGold(level: number): number {
  const near = ALL_ENEMIES
    .filter((e) => e.role === 'boss')
    .sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level))[0];
  if (!near) return 0;
  return ((near.gold[0] + near.gold[1]) / 2) * (level / Math.max(1, near.level));
}

console.log('band            lv   a good weapon      armour     sells back   kills   bosses');
for (const b of LEVEL_BANDS) {
  const lv = Math.round((b.from + b.to) / 2);
  const wt = [...WEAPONS].filter((t) => t.level <= lv).sort((a, c) => c.level - a.level)[0];
  const at = [...ARMOR].filter((t) => t.level <= lv).sort((a, c) => c.level - a.level)[0];
  const w = makeItem(wt.id, { plain: true, level: lv, rarity: 'epic' });
  const a = makeItem(at.id, { plain: true, level: lv, rarity: 'epic' });
  const wBuy = buyValue(w);
  const aBuy = buyValue(a);
  const back = sellValue(w);
  const perKill = goldPerKill(lv) * (REGION_DIFFICULTY[b.region] ?? 1);
  const perBoss = bossGold(lv);
  console.log(
    b.region.padEnd(12),
    String(lv).padStart(4),
    `${wBuy.toLocaleString()}g`.padStart(15),
    `${aBuy.toLocaleString()}g`.padStart(12),
    `${back.toLocaleString()}g`.padStart(13),
    String(Math.round(wBuy / Math.max(1, perKill))).padStart(7),
    String((wBuy / Math.max(1, perBoss)).toFixed(1)).padStart(8),
  );
}
