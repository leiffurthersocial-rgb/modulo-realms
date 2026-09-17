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
 * Candidates are scaled to the player's level first, because that is what the
 * game does with a drop — ranking by the template's printed numbers made a
 * level-74 weapon always look better than a level-58 one even when the player
 * was 60 and could only up-scale the latter.
 *
 * A weapon is then ranked by the damage it actually produces IN THIS
 * CHARACTER'S HANDS, by equipping it and asking. Ranking by the weapon's own
 * numbers handed mages and necromancers daggers: a dagger has a higher raw
 * dps than a staff, and then scales off dexterity, which for a caster is the
 * dump stat. That made the measurement say casters were half as strong as they
 * are, which is the kind of wrong number that gets the whole game retuned
 * around it.
 */
function bestWeapon(p: Player, pool: ItemTemplate[], level: number, ok: (t: ItemTemplate) => boolean): Item | undefined {
  const usable = pool.filter((t) => t.level <= level && ok(t));
  if (!usable.length) return undefined;
  let best: Item | undefined;
  let bestDps = -1;
  for (const t of usable) {
    const it = makeItem(t.id, { plain: true, level });
    p.equipment.mainHand = it;
    const d = p.attackPower() / p.attackInterval();
    if (d > bestDps) { bestDps = d; best = it; }
  }
  p.equipment.mainHand = null;
  return best;
}

/** Armour and artifacts have no such subtlety: more is more. */
function bestFor(pool: ItemTemplate[], level: number, ok: (t: ItemTemplate) => boolean): Item | undefined {
  const usable = pool.filter((t) => t.level <= level && ok(t));
  if (!usable.length) return undefined;
  const rolled = usable.map((t) => makeItem(t.id, { plain: true, level }));
  return rolled.sort((a, b) => {
    const worth = (i: Item) => (i.stats.defense ?? 0) * 2 + (i.stats.maxHealth ?? 0) * 0.1;
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

  const a = bestFor(ARMOR, level, () => true);
  const acc = bestFor(ARTIFACTS, level, () => true);
  if (a) p.equipment.armor = a;
  const w = bestWeapon(p, [...WEAPONS, ...UNIQUES], level, (t) => !!t.weaponKind && c.weapons.includes(t.weaponKind));
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

/**
 * How much of a perfect, resource-limited rotation an ordinary player gets.
 *
 * Fitting to a full rotation over-prices every enemy in the game, because
 * nobody plays a flawless rotation while also dodging; fitting to auto-attacks
 * alone under-prices them and badly misreads the casters. Half is the honest
 * middle, and it is stated here rather than buried so the next person tuning
 * this knows exactly what assumption they are arguing with.
 */
const FIT_UPTIME = 0.5;

const score = (n: { bonus: Record<string, number | undefined> }, prim: string): number =>
  (n.bonus[prim] ?? 0) * 3 + (n.bonus.critChance ?? 0) * 1.5 + (n.bonus.critDamage ?? 0) * 0.6
  + (n.bonus.attackSpeed ?? 0) * 2 + (n.bonus.abilityPower ?? 0) * 0.5;

/**
 * Sustained single-target damage per second: auto-attacks with criticals, plus
 * every damaging ability on cooldown, bounded by what the mana and stamina
 * bars can actually pay for.
 *
 * Both halves matter and leaving either out produces a badly wrong number.
 * Measuring auto-attacks alone says a level-73 mage deals a sixth of what a
 * rogue does, when in play it deals more — abilities are not a bonus for a
 * caster, they are the job. But counting abilities on cooldown with no regard
 * for their cost is just as wrong in the other direction: Emberbolt has a
 * 1.6-second cooldown that cooldown reduction takes under a second, and reads
 * as five thousand damage per second on paper against a mana bar that cannot
 * come close to paying for it.
 */
function dps(p: Player, abilityUptime = FIT_UPTIME): number {
  const s = p.stats();
  const crit = Math.min(100, s.critChance) / 100;
  const auto = p.attackPower() * (1 + crit * (s.critDamage / 100)) / p.attackInterval();

  let manaDrain = 0;
  let stamDrain = 0;
  for (const a of p.abilities) {
    if (!a.power) continue;
    const cd = p.cooldownFor(a);
    manaDrain += a.mana / cd;
    stamDrain += a.stamina / cd;
  }
  const manaShare = manaDrain > 0 ? Math.min(1, s.manaRegen / manaDrain) : 1;
  const stamShare = stamDrain > 0 ? Math.min(1, s.staminaRegen / stamDrain) : 1;

  let abil = 0;
  for (const a of p.abilities) {
    if (!a.power) continue;
    const per = p.attackPower() * a.power * (1 + s.abilityPower / 100);
    const hits = a.shape === 'multishot' ? (a.count ?? 1) * 0.55 : 1;
    const share = Math.min(a.mana > 0 ? manaShare : 1, a.stamina > 0 ? stamShare : 1);
    abil += (per * hits * share) / p.cooldownFor(a);
  }
  return auto + abil * abilityUptime;
}

const levels = [1, 3, 5, 8, 12, 17, 22, 28, 34, 40, 48, 56, 64, 70, 75];
console.log('       auto-only          realistic          full rotation      curve   fit');
console.log('level   greedy  typical    greedy  typical    greedy  typical');
for (const lv of levels) {
  const builds = CLASSES.map((c) => ({ g: build(c.id, lv, true), t: build(c.id, lv, false) }));
  const at = (up: number, key: 'g' | 't') => {
    const vals = builds.map((b) => dps(b[key], up));
    return key === 'g' ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const curve = playerDpsAt(lv);
  const fitted = at(FIT_UPTIME, 't');
  console.log(
    String(lv).padStart(5),
    at(0, 'g').toFixed(0).padStart(8), at(0, 't').toFixed(0).padStart(8),
    at(FIT_UPTIME, 'g').toFixed(0).padStart(10), fitted.toFixed(0).padStart(8),
    at(1, 'g').toFixed(0).padStart(10), at(1, 't').toFixed(0).padStart(8),
    curve.toFixed(0).padStart(8),
    (fitted / curve).toFixed(2).padStart(6),
  );
}
console.log(
  `\nplayerDpsAt is fitted to the "realistic typical" column — abilities at ${FIT_UPTIME * 100}% of`
  + '\nwhat the bars could sustain, which is what an ordinary player actually manages.'
  + '\nThe last column should sit near 1.00 from the early twenties up, and below it before.',
);
