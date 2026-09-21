import type { Game } from '../core/game';
import type { DamageElement } from '../../data/enemies';
import { GREEK_WEAPON_STYLES } from '../../data/aegean/weapons';
import { angleBetween, angleTo } from '../core/math';

type Strike = { at: number; map: string; x: number; y: number; aim: number; range: number; arc: number; inner: number; damage: number; color: string; element: DamageElement; pull?: boolean; poison?: boolean; stagger?: boolean };
export class AegeanWeaponCombat {
  private pending: Strike[] = [];
  private combo = 0;
  private last = -100;
  private weapon = '';
  constructor(private game: Game) {}
  reset(): void { this.pending = []; this.combo = 0; this.last = -100; this.weapon = ''; }
  update(): void {
    const g = this.game;
    const ready = this.pending.filter(s => s.map === g.map.id && s.at <= g.now);
    this.pending = this.pending.filter(s => s.map === g.map.id && s.at > g.now);
    if (g.player.dead) { this.reset(); return; }
    for (const s of ready) this.strike(s);
  }
  attack(base: number, aim: number, heavy: boolean): boolean {
    const g = this.game, p = g.player, item = p.equipment.mainHand;
    const profile = item && GREEK_WEAPON_STYLES[item.defId];
    if (!profile) return false;
    if (item.uid !== this.weapon || g.now - this.last > 2.5) this.combo = 0;
    this.weapon = item.uid; this.last = g.now;
    const beat = this.combo++ % 3;
    const reach = p.attackRange();
    const color = item.glow ?? '#e1b966';
    if (p.isMagicWeapon()) p.mp -= 4;
    const slash = (mult: number, range: number, arc = .75, delay = 0, extra: Partial<Strike> = {}) => {
      const s: Strike = { at: g.now + delay, map: g.map.id, x: p.x, y: p.y, aim, range, arc, inner: 0, damage: base * mult, color, element: 'physical', ...extra };
      if (delay > 0) {
        if (this.pending.length < 64) this.pending.push(s);
        g.telegraph(s.x, s.y, range, delay, color, arc >= Math.PI * 2 ? 'circle' : 'cone', s.aim, 13, s.arc / 2);
      } else this.strike(s);
    };
    const shot = (mult: number, speed: number, count = 1, spread = .14, pierce = 0, element: DamageElement = 'physical', splash = 0) => {
      for (let i = 0; i < count; i++) {
        const roll = g.rollDamage(base * mult / count);
        g.spawnProjectile({ x: p.x, y: p.y - 12, angle: aim + (i - (count - 1) / 2) * spread,
          speed, damage: roll.dmg, radius: 13, range: reach, color, element, friendly: true,
          pierce: pierce + p.enchantPower('piercing'), splash, crit: roll.crit,
          homing: element === 'arcane' ? .6 : .12, sprite: element === 'physical' ? 'arrow' : 'shard', onHitEffects: p.effectIds() });
      }
      g.playSound('shoot', .45);
    };
    switch (profile.attack) {
      case 'thrust': slash(1, reach * (beat === 2 ? 1.18 : 1), .32); break;
      case 'pursuit': slash(beat === 2 ? 1.22 : .89, reach, beat === 2 ? 2.6 : .95); break;
      case 'fang': slash(.52, reach, .65); slash(.48, reach + 8, .65, .1, { poison: true }); break;
      case 'arrow': shot(1, 920, 1, 0, 2); break;
      case 'javelin': shot(1, 760, 1, 0, 1, 'arcane'); break;
      case 'hammer': slash(.7, reach, 1.4, 0, { stagger: true }); slash(.3, 68, Math.PI * 2, .32, { x: p.x + Math.cos(aim) * reach * .8, y: p.y + Math.sin(aim) * reach * .8 }); break;
      case 'breath': if (heavy) slash(1, 150, 2.5, .25, { element: 'arcane' }); else shot(1, 330, 3, .27, 0, 'arcane'); break;
      case 'chain': slash(1, reach, 2.8, 0, { pull: true }); break;
      case 'labrys': slash(heavy ? .65 : 1, reach, 3.2); if (heavy) slash(.35, reach + 20, 2.2, .26, { aim: aim + .7 }); break;
      case 'pick': for (let i = 0; i < 3; i++) slash(i === 2 ? .4 : .3, reach + i * 6, .36, i * .09, { stagger: i === 2 }); break;
      case 'quarry': for (let i = 0; i < 3; i++) slash(1 / 3, 52, Math.PI * 2, .18 + i * .16, { x: p.x + Math.cos(aim) * (45 + i * 52), y: p.y + Math.sin(aim) * (45 + i * 52), stagger: i === 2 }); break;
      case 'recurve': shot(1, 610, 3, .24); break;
      case 'royal': slash(heavy ? .75 : 1, reach, .3); if (heavy) slash(.25, 100, Math.PI * 2, .18, { stagger: true }); break;
      case 'dawn': slash(beat === 2 ? .6 : 1, reach, 1.6, 0, { aim: aim + (beat % 2 ? .3 : -.3) }); if (beat === 2) slash(.4, 65, Math.PI * 2, .16, { x: p.x + Math.cos(aim) * 82, y: p.y + Math.sin(aim) * 82 }); break;
      case 'storm': shot(1, 1150, 1, 0, 3, 'arcane', 62); break;
      case 'flame': if (beat === 0) shot(1, 670, 1, 0, 2, 'fire'); else if (beat === 1) shot(1, 410, 5, .2, 0, 'fire'); else slash(1, 155, Math.PI * 2, .18, { element: 'fire' }); break;
      case 'twins': slash(.45, reach * .48, 2.8); slash(.55, reach, 3.8, .16, { inner: reach * .35, pull: true }); break;
      case 'standard': slash(1, reach, beat % 2 || heavy ? Math.PI * 2 : .42, 0, { stagger: heavy }); break;
    }
    return true;
  }
  private strike(s: Strike): void {
    const g = this.game;
    g.telegraph(s.x, s.y, s.range, .13, s.color, s.arc >= Math.PI * 2 ? 'circle' : 'cone', s.aim, 13, s.arc / 2);
    let hit = false;
    for (const e of g.enemies) {
      if (e.dead || e.friendly) continue;
      const distance = Math.hypot(e.x - s.x, e.y - s.y);
      if (distance > s.range + e.radius || distance + e.radius < s.inner || angleBetween(s.aim, angleTo(s.x, s.y, e.x, e.y)) > s.arc / 2) continue;
      const roll = g.rollDamage(s.damage);
      const dealt = g.damageEnemy(e, roll.dmg, { crit: roll.crit, element: s.element, knockback: s.pull ? 0 : s.stagger ? 180 : 65, fromX: s.x, fromY: s.y });
      if (dealt <= 0) continue;
      hit = true; g.applyHitEffects(e, roll.dmg, roll.crit);
      if (s.pull && !e.isBoss) e.takeKnockback(s.x, s.y, -120);
      if (s.poison) e.applyStatusFrom('poison', dealt * .12, 2, '#9ec86b', g.now);
      if (s.stagger && !e.isBoss) e.applyStatusFrom('stun', 1, .35, s.color, g.now);
    }
    g.playSound('swing', .35);
    if (hit) g.shake(s.stagger ? 4 : 1);
  }
}
