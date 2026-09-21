/** Actual Player stats and weapon/power runtimes, without a browser or renderer. */
import assert from 'node:assert/strict';
import { CLASSES, type ClassId } from '../src/data/classes';
import { TEMPLATE_BY_ID } from '../src/data/items';
import { AEGEAN_GEAR } from '../src/data/aegean/content';
import { weaponClass } from '../src/data/balance';
import { Player } from '../src/game/player/player';
import { makeItem, refreshFromTemplate } from '../src/game/items/loot';
import { RNG } from '../src/game/core/rng';
import { AegeanWeaponCombat } from '../src/game/aegean/weapons';
import { AegeanPowers } from '../src/game/aegean/powers';
import { AEGEAN_POWERS } from '../src/game/items/effects';
import { createMap } from '../src/game/world/map';
import { T } from '../src/game/world/tiles';
import type { Item } from '../src/game/items/types';
import type { Enemy } from '../src/game/entities/enemy';
import type { Game } from '../src/game/core/game';
import type { ProjectileSpec, DamageOpts } from '../src/game/core/world';

const primordial = AEGEAN_GEAR.filter(item => item.rarity === 'primordial');
const branches: Record<ClassId, string[]> = {
  warrior: ['Power', 'Berserker'], ranger: ['Bow', 'Traps'], mage: ['Fire', 'Arcane'],
  rogue: ['Critical', 'Poison'], paladin: ['Faith', 'Retribution'], necromancer: ['Death', 'Blight'],
};
function player(cls: ClassId): Player {
  const p = new Player({ name: 'Primordial check', race: 'human', cls, hairIndex: 0, skinIndex: 0, hairStyle: 'short', beard: 'none' });
  p.level = 100;
  for (const n of p.classDef.skills.filter(n => branches[cls].includes(n.branch) || n.branch === 'Mastery')) p.skills[n.id] = n.max;
  assert.equal(Object.values(p.skills).reduce((sum, n) => sum + n, 0), 120);
  p.equipment = { mainHand: null, offHand: null, armor: null, accessory: null };
  return p;
}
const make = (id: string, plain = true) => makeItem(id, {
  plain, level: id.startsWith('aegean_') ? 100 : 115,
  rng: new RNG(id), provenance: { source: 'debug', id: 'primordial-regression' },
  rarity: ['common', 'rare', 'superRare', 'epic'].includes(TEMPLATE_BY_ID[id].rarity) ? 'legendary' : undefined,
});
function dps(p: Player, item: Item): number {
  p.equipment.mainHand = item;
  const s = p.stats();
  const enchant = p.enchantPower(p.isRangedWeapon() ? 'power' : 'sharpness');
  const execute = p.isRangedWeapon() ? 1 : 1 + p.enchantPower('committed') / 200;
  return p.attackPower() / p.attackInterval() * (1 + Math.min(100, s.critChance) / 100 * s.critDamage / 100) * (1 + enchant / 100) * execute;
}

// Give every competitor its legal Legendary elevation and the valley's +15
// over-level allowance. Match maximum combat enchantments for both sides.
for (const [id, cls] of [
  ['aegean_kings_dory', 'warrior'], ['aegean_last_dawn_kopis', 'rogue'],
  ['aegean_storm_cleared_bow', 'ranger'], ['aegean_first_flame_sceptre', 'mage'],
  ['aegean_first_flame_sceptre', 'necromancer'], ['aegean_twin_oathblades', 'rogue'],
  ['aegean_unbroken_standard', 'paladin'],
] as const) {
  const p = player(cls), capstone = make(id), kind = weaponClass(capstone.weaponKind!);
  const runes = kind === 'melee' ? ['sharpness', 'critical_hit', 'committed'] : kind === 'ranged' ? ['power', 'critical_hit', 'piercing'] : ['arcane_surge', 'soul_siphon', 'ember_focus'];
  const candidates = Object.values(TEMPLATE_BY_ID).filter(t => t.slot === 'mainHand' && t.rarity !== 'primordial' && t.weaponKind && weaponClass(t.weaponKind) === kind);
  const equipRunes = (item: Item) => { item.enchants = runes.map(id => ({ id, level: 3 })); return item; };
  const ranked = candidates.map(t => ({ id: t.id, dps: dps(p, equipRunes(make(t.id))) })).sort((a, b) => b.dps - a.dps);
  const output = dps(p, equipRunes(capstone)), best = ranked[0];
  assert(output > best.dps * 1.25, `${id}/${cls}: ${output.toFixed(0)} must beat ${best.id} ${best.dps.toFixed(0)} by 25%, before signature arts`);
  console.log(`${id}/${cls}: ${(output / best.dps).toFixed(2)}x ${best.id} sustained stat/enchant DPS`);
}

// Support rewards must improve actual survivability and damage for all six
// classes, rather than hiding a low base behind their rarity label.
for (const cls of CLASSES) {
  const p = player(cls.id);
  const weapon = make(cls.id === 'mage' || cls.id === 'necromancer' ? 'aegean_first_flame_sceptre'
    : cls.id === 'ranger' ? 'aegean_storm_cleared_bow' : cls.id === 'rogue' ? 'aegean_twin_oathblades' : 'aegean_kings_dory');
  p.equipment.mainHand = weapon;
  for (const slot of ['offHand', 'armor', 'accessory'] as const) {
    const alternatives = Object.values(TEMPLATE_BY_ID).filter(t => t.slot === slot && t.rarity !== 'primordial');
    const assess = (item: Item) => {
      p.equipment[slot] = item;
      const s = p.stats();
      const crit = 1 + Math.min(100, s.critChance) / 100 * s.critDamage / 100;
      return { health: s.maxHealth * (1 + s.defense / 100),
        basic: dps(p, weapon),
        ability: p.attackPower() * crit * (1 + s.abilityPower / 100) / (1 - Math.min(60, s.cooldownReduction) / 100) };
    };
    const lower = alternatives.map(t => assess(make(t.id)));
    for (const t of primordial.filter(t => t.slot === slot)) {
      const current = assess(make(t.id));
      assert(current.health > Math.max(...lower.map(v => v.health)), `${t.id}/${cls.id} must beat every older slot's effective health`);
      assert(current.basic > Math.max(...lower.map(v => v.basic)), `${t.id}/${cls.id} must improve actual basic DPS over every older item in the slot`);
      assert(current.ability > Math.max(...lower.map(v => v.ability)), `${t.id}/${cls.id} must improve actual ability damage/cooldown throughput over every older item in the slot`);
    }
    p.equipment[slot] = null;
  }
}

// Reload upgrades owned items without rerolling their earned random state.
for (const t of primordial) {
  const item = make(t.id, false);
  // Existing saves carried four runes. Opening extra slots must retain them.
  item.enchants = item.enchants.slice(0, 4);
  const original = structuredClone(item);
  item.stats.damage = item.slot === 'mainHand' ? 1 : item.stats.damage;
  if (item.stats.defense) item.stats.defense = 1;
  item.enchantSlots = 4;
  item.desc = 'Old description';
  refreshFromTemplate(item);
  assert.equal(item.enchantSlots, 6);
  assert.deepEqual(item.stats, original.stats);
  assert.deepEqual(item.curve, original.curve);
  assert.deepEqual(item.enchants, original.enchants);
  assert.deepEqual(item.provenance, original.provenance);
  assert.equal(item.uid, original.uid);
  const once = JSON.stringify(item);
  refreshFromTemplate(item);
  assert.equal(JSON.stringify(item), once, `${t.id}: repeated loading must not compound the upgrade`);
}

function runtime(item: Item) {
  const p = player(item.weaponKind === 'staff' ? 'mage' : 'warrior');
  p.x = 400; p.y = 400; p.equipment[item.slot!] = item;
  p.hp = p.maxHp; p.mp = p.maxMp; p.sp = p.maxSp;
  const map = createMap({ id: 'aegean_asterion', name: 'Primordial regression', w: 64, h: 64 });
  map.tiles.fill(T.MARBLE);
  const enemy = { id: 1, x: 460, y: 400, radius: 20, hp: 1e8, maxHp: 1e8, friendly: false, dead: false, warded: false, isBoss: true, statuses: [], takeKnockback() {}, applyStatusFrom() {} } as unknown as Enemy;
  const shots: ProjectileSpec[] = [], hits: number[] = [];
  const noop = () => {};
  const g = {
    now: 100, player: p, enemies: [enemy], projectiles: [], map, naval: { aboard: false },
    encounters: { active: false, exposureActive: false, suppressOffense: false, cleansePressure: noop },
    aimAngle: () => 0, bestTarget: () => enemy, floatText: noop, ringAt: noop, telegraph: noop, touch: noop,
    playSound: noop, shake: noop, physicalAttack: noop, applyHitEffects: noop,
    rollDamage: (dmg: number) => ({ dmg, crit: false }), spawnProjectile: (shot: ProjectileSpec) => shots.push(shot),
    damageEnemy: (target: Enemy, amount: number, _opts?: DamageOpts) => {
      if (target.warded) return 0;
      target.hp -= amount; hits.push(amount); return amount;
    },
  } as unknown as Game;
  const combat = new AegeanWeaponCombat(g), powers = new AegeanPowers(g);
  powers.update(0);
  return { g, p, enemy, shots, hits, combat, powers };
}

// Flame fan/ring must retain an aimed full hit. Oathblades must not lose the
// return slash simply because the target is in melee range.
{
  const r = runtime(make('aegean_first_flame_sceptre'));
  for (let beat = 0; beat < 3; beat++) {
    r.shots.length = 0;
    assert(r.combat.attack(100, 0, false));
    assert(r.shots.some(s => s.angle === 0 && s.damage >= 120), `flame beat ${beat} loses its aimed damage`);
    r.g.now += .2; r.combat.update();
  }
  assert(r.p.mp >= 0);
}
{
  const r = runtime(make('aegean_twin_oathblades'));
  assert(r.combat.attack(100, 0, false));
  r.g.now += .2; r.combat.update();
  assert.equal(r.hits.reduce((a, b) => a + b, 0), 135);
}

// Every active Primordial power works before earning a specific event; real
// openings empower them, but cooldowns, wards and true executions still hold.
for (const t of primordial) {
  const r = runtime(make(t.id)), item = r.p.equipment[t.slot!]!;
  const def = AEGEAN_POWERS[t.aegeanPower!];
  if (def.trigger !== 'active') continue;
  assert(r.powers.activate(item), `${t.id} should work on demand`);
  assert(!r.powers.activate(item), `${t.id} should obey cooldown`);
  assert.equal(r.powers.onHurt(100, { trueDamage: true }), 100);
  r.g.now += 100; r.powers.update(0);
  r.enemy.warded = true; const hp = r.enemy.hp;
  assert(r.powers.activate(item));
  assert.equal(r.enemy.hp, hp, `${t.id} cannot bypass encounter wards`);
}
{
  const normal = runtime(make('aegean_kings_dory')), skilled = runtime(make('aegean_kings_dory'));
  skilled.powers.onBrace();
  assert(normal.powers.activate(normal.p.equipment.mainHand!));
  assert(skilled.powers.activate(skilled.p.equipment.mainHand!));
  assert(Math.abs(skilled.hits[0] - normal.hits[0] * 1.5) < 1e-8, 'A timed brace empowers the real Royal Counter');
}

// The custom Greek path must retain combat enchantments when upgrading.
{
  const r = runtime(make('aegean_kings_dory'));
  r.p.equipment.mainHand!.enchants = [{ id: 'committed', level: 3 }, { id: 'swirling', level: 3 }];
  r.enemy.hp = r.enemy.maxHp * .4;
  r.enemy.x = r.p.x + r.p.attackRange() * 1.2;
  assert(r.combat.attack(100, 0, false));
  assert.equal(r.hits[0], 180, 'Swirling extends reach and Committed strengthens a wounded-target hit');
}
{
  const r = runtime(make('aegean_storm_cleared_bow'));
  r.p.equipment.mainHand!.enchants = [{ id: 'multishot', level: 3 }];
  const random = Math.random;
  try { Math.random = () => 0; r.combat.attack(100, 0, false); }
  finally { Math.random = random; }
  assert.equal(r.shots.length, 3, 'The Primordial bow retains Multishot');
}
console.log('Primordial supremacy, signature combat, enchantment compatibility and save upgrades passed.');
