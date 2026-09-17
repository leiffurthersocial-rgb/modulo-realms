/**
 * Measures what a REAL build puts out, level by level, by constructing an
 * actual Player, equipping the best gear its level can reasonably have and
 * spending its skill points into damage.
 *
 * This exists because `playerDpsAt` in balance.ts is the number the entire
 * bestiary is priced against, and it is a FIT, not a derivation — the only
 * honest way to keep it correct after touching weapons, stats or talents is
 * to measure again. Run it after any change to either side:
 *
 *   npx tsx scripts/measure-dps.ts
 */
import { CLASSES } from '../src/data/classes';
import { WEAPONS, ARMOR, ARTIFACTS, UNIQUES } from '../src/data/items';
import { playerDpsAt } from '../src/data/balance';
import { Player } from '../src/game/player/player';
import { makeItem } from '../src/game/items/loot';
import { skillPointsFor } from '../src/game/player/player';
import type { ItemTemplate } from '../src/data/items';
import type { Item } from '../src/game/items/types';

/**
 * The best thing of a kind this class could plausibly be holding at `level`.
 *
 * It ranks candidates by what they are worth AFTER being scaled to the
 * player's level, not by the numbers written on the template. Ranking by the
 * template made the measurement jump around: an item's printed damage is for
 * its own level, so a level-74 weapon always looked better than a level-58 one
 * even when the player was 60 and could only up-scale the latter. Scaling
 * first is what the game actually does with a drop.
 */
function bestFor(pool: ItemTemplate[], level: number, ok: (t: ItemTemplate) => boolean): Item | undefined {
  const usable = pool.filter((t) => t.level <= level && ok(t));
  if (!usable.length) return undefined;
  const rolled = usable.map((t) => makeItem(t.id, { plain: true, level }));
  return rolled.sort((a, b) => {
    const worth = (i: Item) => (i.stats.damage ?? 0) * (i.stats.attackSpeed ?? 1) + (i.stats.defense ?? 0) * 2;
    return worth(b) - worth(a);
  })[0];
}

function build(clsId: string, level: number, greedy: boolean): Player {
  const c = CLASSES.find((x) => x.id === clsId)!;
  const p = new Player({
    name: 'sim', race: 'human', cls: c.id,
    hairIndex: 0, skinIndex: 0, hairStyle: 'short', beard: 'none',
  });
  p.level = level;
  for (let l = 2; l <= level; l++) p.skillPoints += skillPointsFor(l);

  const w = bestFor([...WEAPONS, ...UNIQUES], level, (t) => !!t.weaponKind && c.weapons.includes(t.weaponKind));
  const a = bestFor(ARMOR, level, () => true);
  const acc = bestFor(ARTIFACTS, level, () => true);
  if (w) p.equipment.mainHand = w;
  if (a) p.equipment.armor = a;
  if (acc) p.equipment.accessory = acc;

  // Spend everything on whatever raises damage most, which is the build the
  // curve has to survive — not the average one.
  const prim = p.primaryStat();
  const order = greedy
    ? c.skills.slice().sort((x, y) => score(y, prim) - score(x, prim))
    : c.skills.slice();
  let guard = 0;
  while (p.skillPoints > 0 && guard++ < 4000) {
    let spent = false;
    for (const node of order) {
      if (p.skillPoints <= 0) break;
      const cur = p.skills[node.id] ?? 0;
      if (cur >= node.max) continue;
      const prev = c.skills
        .filter((n) => n.branch === node.branch && n.tier < node.tier)
        .reduce((s, n) => s + (p.skills[n.id] ?? 0), 0);
      if (node.tier > 1 && prev < (node.tier - 1) * 3) continue;
      p.skills[node.id] = cur + 1;
      p.skillPoints--;
      spent = true;
    }
    if (!spent) break;
  }
  return p;
}

const score = (n: { bonus: Record<string, number | undefined> }, prim: string): number =>
  (n.bonus[prim] ?? 0) * 3 + (n.bonus.critChance ?? 0) * 1.5 + (n.bonus.critDamage ?? 0) * 0.6
  + (n.bonus.attackSpeed ?? 0) * 2 + (n.bonus.abilityPower ?? 0) * 0.5;

/** Sustained single-target damage per second, criticals included. */
function dps(p: Player): number {
  const s = p.stats();
  const crit = Math.min(100, s.critChance) / 100;
  const perHit = p.attackPower() * (1 + crit * (s.critDamage / 100));
  return perHit / p.attackInterval();
}

const levels = [1, 3, 5, 8, 12, 17, 22, 28, 34, 40, 48, 56, 64, 70, 75];
console.log('level   greedy    typical   curve    greedy/curve');
for (const lv of levels) {
  const g = Math.max(...CLASSES.map((c) => dps(build(c.id, lv, true))));
  const t = CLASSES.map((c) => dps(build(c.id, lv, false))).reduce((a, b) => a + b, 0) / CLASSES.length;
  const curve = playerDpsAt(lv);
  console.log(
    String(lv).padStart(5),
    g.toFixed(0).padStart(9),
    t.toFixed(0).padStart(10),
    curve.toFixed(0).padStart(8),
    (g / curve).toFixed(2).padStart(13),
  );
}
