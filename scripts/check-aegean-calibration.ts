/** Transparent encounter calibration, not a claim of human playtesting.
 * Uses real class stats, legal 120-point builds, reforged level-100 Olympian
 * weapons and the three guaranteed pre-Leonidas Primordial sanctuary rewards.
 * Prints both a repeatable basic-attack baseline and an explicit approximate
 * ability rotation. No post-Leonidas weapon, random affix or enchant is assumed. */
import assert from "node:assert/strict";
import { CLASSES } from "../src/data/classes";
import { damageTaken, MAGIC_SHOT } from "../src/data/balance";
import { Enemy } from "../src/game/entities/enemy";
import { Player } from "../src/game/player/player";
import { makeItem } from "../src/game/items/loot";

const weapons: Record<string, string> = {
  warrior: "labyrinth_labrys",
  ranger: "artemis_bow",
  mage: "delphic_staff",
  rogue: "hydra_fang",
  paladin: "geryon_pick",
  necromancer: "delphic_staff",
};
const branches: Record<string, string[]> = {
  warrior: ["Power", "Berserker"],
  ranger: ["Bow", "Traps"],
  mage: ["Fire", "Arcane"],
  rogue: ["Critical", "Poison"],
  paladin: ["Faith", "Retribution"],
  necromancer: ["Death", "Blight"],
};
const boss = new Enemy("aegean_leonidas", 0, 0, 100);
console.log(
  `Leonidas HP ${boss.maxHp.toFixed(0)}, defense ${boss.defense.toFixed(0)}, basic damage ${boss.damage.toFixed(0)}; phase health shares 18/18/22/24/13/5%.`,
);
console.log(
  "Assumptions: two complete offensive branches +36 universal talents (120 total); 55% attack uptime; .88 average formation effectiveness; +55 seconds for transitions/guards. Ranger fan counts use actual73px collision at300px; ground effects use authored duration and50% retention. Rotation shares finite regeneration; fixed item powers, on-hit DOTs and summons are excluded, so this remains a conservative diagnostic, not proof of a play win.",
);

for (const cls of CLASSES) {
  const p = new Player({
    name: cls.name,
    race: "human",
    cls: cls.id,
    hairIndex: 0,
    skinIndex: 0,
    hairStyle: "short",
    beard: "none",
  });
  p.level = 100;
  p.equipment.mainHand = makeItem(`aegean_${weapons[cls.id]}`, {
    level: 100,
    plain: true,
  });
  for (const [slot, id, source] of [
    ["offHand", "last_dawn_mirror", "sanctuary_aegis"],
    ["armor", "oathforged_panoply", "sanctuary_forge"],
    ["accessory", "first_oath_ember", "sanctuary_names"],
  ] as const)
    p.equipment[slot] = makeItem(`aegean_${id}`, {
      plain: true,
      provenance: {
        source: "reward",
        id: `aegean_${source}`,
        region: "aegean_asterion",
      },
    });

  const primary = p.primaryStat();
  for (const node of cls.skills.filter(
    (n) => branches[cls.id].includes(n.branch) || n.branch === "Mastery",
  ))
    p.skills[node.id] = node.max;
  assert.equal(
    Object.values(p.skills).reduce((sum, n) => sum + n, 0),
    120,
    `${cls.id}: the prepared build respects the original talent pool`,
  );
  for (const id of [
    "vigor",
    "hunter",
    "edge",
    "mercy",
    primary === "intelligence" ? "ascendant" : "hero",
  ])
    p.flags.add(`aegean:mastery:${id}`);
  const stats = p.stats(),
    expectedCrit =
      1 + ((Math.min(100, stats.critChance) / 100) * stats.critDamage) / 100;
  const armor = 100 / (100 + boss.defense);
  const basicDps =
    (p.attackPower() / p.attackInterval()) *
    expectedCrit *
    armor *
    (MAGIC_SHOT[p.weaponKind()]?.damage ?? 1);
  const damaging = p.abilities.filter(
    (a) =>
      a.power > 0 && !["buff", "heal", "shield", "summon"].includes(a.shape),
  );
  const manaPerSecond =
    damaging.reduce((v, a) => v + a.mana / p.cooldownFor(a), 0) +
    (p.isMagicWeapon() ? (4 / p.attackInterval()) * 0.55 : 0);
  const staminaPerSecond = damaging.reduce(
    (v, a) => v + a.stamina / p.cooldownFor(a),
    0,
  );
  const sustain = Math.min(
    1,
    stats.manaRegen / Math.max(1, manaPerSecond * 0.55),
    (stats.staminaRegen * 0.9) / Math.max(1, staminaPerSecond * 0.55),
  );
  const abilityDps =
    damaging.reduce((v, a) => {
      let count = 1,
        crit =
          a.id === "assassinate" ? 1 + stats.critDamage / 100 : expectedCrit;
      if (a.shape === "multishot" && a.id !== "fanofknives") {
        count = Array.from(
          { length: a.count ?? 5 },
          (_, i) => (i / Math.max(1, (a.count ?? 5) - 1) - 0.5) * 0.75,
        ).filter(
          (angle) => Math.abs(Math.sin(angle) * 300) <= boss.radius + 22,
        ).length;
      }
      if (a.shape === "ground") {
        crit = 1;
        count = a.id === "meteor" || a.id === "rain" ? 1 : 1.2 * 0.5;
      }
      return (
        v +
        (p.attackPower() *
          a.power *
          (1 + stats.abilityPower / 100) *
          crit *
          count *
          armor) /
          p.cooldownFor(a)
      );
    }, 0) * sustain;
  const basicMinutes = (boss.maxHp / (basicDps * 0.55 * 0.88) + 55) / 60;
  const rotationMinutes =
    (boss.maxHp / ((basicDps + abilityDps) * 0.55 * 0.88) + 55) / 60;
  const sweepShare =
    (boss.damage * 2.4 * 1.2 * damageTaken(stats.defense, 100)) /
    stats.maxHealth;
  assert.ok(
    Number.isFinite(rotationMinutes) && rotationMinutes > 0,
    `${cls.id}: reachable numeric damage baseline`,
  );
  assert.ok(
    rotationMinutes >= 3 && rotationMinutes <= 18,
    `${cls.id}: learned offensive build stays within the published3–18 minute diagnostic band; this does not assert that every build or player wins`,
  );
  assert.ok(
    sweepShare >= 0.35 && sweepShare <= 0.8,
    `${cls.id}: a late unblocked sweep threatens35–80% of this offensive build's health without a guaranteed full-health one-shot`,
  );
  console.log(
    `${cls.id.padEnd(12)} HP ${stats.maxHealth.toFixed(0).padStart(5)} / defense ${stats.defense.toFixed(0).padStart(4)} / basic DPS ${basicDps.toFixed(0).padStart(6)} / conservative ability DPS ${abilityDps.toFixed(0).padStart(5)} / stationary attacks-only ${basicMinutes.toFixed(1)} min / rotation ${rotationMinutes.toFixed(1)} min / late sweep ${(sweepShare * 100).toFixed(0)}% HP`,
  );
}
