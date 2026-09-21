import type { Game } from '../core/game';
import type { PhysicalAttackKind } from '../combat/physical';
import type { DamageElement } from '../../data/enemies';
import { GREEK_WEAPON_STYLES } from '../../data/aegean/weapons';
import { angleBetween, angleTo } from '../core/math';

type Strike = { weapon: string; kind: PhysicalAttackKind; at: number; map: string; x: number; y: number; aim: number; range: number; arc: number; inner: number; damage: number; color: string; element: DamageElement; pull?: boolean; poison?: boolean; stagger?: boolean };
export class AegeanWeaponCombat {
  private pending: Strike[] = [];
  private pendingShots: Array<{ at: number; map: string; weapon: string; fire: () => void }> = [];
  private combo = 0;
  private last = -100;
  private weapon = '';
  constructor(private game: Game) {}
  reset(): void { this.pending = []; this.pendingShots = []; this.combo = 0; this.last = -100; this.weapon = ''; }
  update(): void {
    const g = this.game;
    if (g.player.dead) { this.reset(); return; }
    const valid = (s: {map: string; weapon: string}) => s.map === g.map.id && s.weapon === g.player.equipment.mainHand?.uid;
    const ready = this.pending.filter(s => valid(s) && s.at <= g.now);
    this.pending = this.pending.filter(s => valid(s) && s.at > g.now);
    const shots = this.pendingShots.filter(s => valid(s) && s.at <= g.now);
    this.pendingShots = this.pendingShots.filter(s => valid(s) && s.at > g.now);
    for (const s of ready) this.strike(s);
    for (const s of shots) s.fire();
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
    const kind: PhysicalAttackKind = ['thrust', 'royal', 'standard', 'pick'].includes(profile.attack) ? 'spear'
      : ['chain', 'twins'].includes(profile.attack) ? 'chain'
      : profile.attack === 'quarry' ? 'boulder' : profile.attack === 'hammer' ? 'hammer'
      : ['breath', 'flame'].includes(profile.attack) ? 'spit' : 'blade';
    if (p.isMagicWeapon()) p.mp -= 4;
    const slash = (mult: number, range: number, arc = .75, delay = 0, extra: Partial<Strike> = {}) => {
      const s: Strike = { weapon: item.uid, kind, at: g.now + delay, map: g.map.id, x: p.x, y: p.y, aim, range, arc, inner: 0, damage: base * mult, color, element: 'physical', ...extra };
      if (delay > 0) {
        if (this.pending.length < 64) this.pending.push(s);
        g.physicalAttack({ source: p, followSource: true, x: s.x, y: s.y - 8, angle: s.aim, reach: s.range, duration: delay, color, kind: s.kind, phase: 'prepare', sweepAngle: s.arc, isActive: () => !p.dead && g.map.id === s.map && p.equipment.mainHand?.uid === s.weapon });
      } else this.strike(s);
    };
    const shot = (mult: number, speed: number, count = 1, spread = .14, pierce = 0, element: DamageElement = 'physical', splash = 0,
      options: { delay?: number; range?: number; radius?: number; sprite?: 'boulder' | 'spear' | 'ember' | 'arrow' | 'venom' } = {}) => {
      const fire = () => {
        for (let i = 0; i < count; i++) {
          const roll = g.rollDamage(base * mult / count);
          const sprite = options.sprite ?? (profile.attack === 'javelin' ? 'spear' : element === 'fire' ? 'ember' : profile.attack === 'breath' ? 'venom' : 'arrow');
          g.spawnProjectile({ x: p.x, y: p.y - 12, angle: aim + (i - (count - 1) / 2) * spread,
            speed, damage: roll.dmg, radius: options.radius ?? 13, range: options.range ?? reach, color, element, friendly: true,
            pierce: pierce + p.enchantPower('piercing'), splash, crit: roll.crit,
            homing: element === 'arcane' ? .6 : .12, sprite, onHitEffects: p.effectIds() });
        }
        g.playSound('shoot', .45);
      };
      if (options.delay) {
        if (this.pendingShots.length < 64) this.pendingShots.push({ at: g.now + options.delay, map: g.map.id, weapon: item.uid, fire });
      } else fire();
    };
    switch (profile.attack) {
      case 'thrust': slash(1, reach * (beat === 2 ? 1.18 : 1), .32); break;
      case 'pursuit': slash(beat === 2 ? 1.22 : .89, reach, beat === 2 ? 2.6 : .95); break;
      case 'fang': slash(.52, reach, .65); slash(.48, reach + 8, .65, .1, { poison: true }); break;
      case 'arrow': shot(1, 920, 1, 0, 2); break;
      case 'javelin': shot(1, 760, 1, 0, 1, 'arcane'); break;
      case 'hammer': slash(.7, reach, 1.4, 0, { stagger: true }); shot(.3, 280, 1, 0, 1, 'physical', 0, { delay: .32, range: 180, radius: 25, sprite: 'boulder' }); break;
      case 'breath': if (heavy) shot(1, 270, 5, .38, 0, 'arcane', 0, { delay: .25, range: 190, sprite: 'venom' }); else shot(1, 330, 3, .27, 0, 'arcane'); break;
      case 'chain': slash(1, reach, 2.8, 0, { pull: true }); break;
      case 'labrys': slash(heavy ? .65 : 1, reach, 3.2); if (heavy) slash(.35, reach + 20, 2.2, .26, { aim: aim + .7 }); break;
      case 'pick': for (let i = 0; i < 3; i++) slash(i === 2 ? .4 : .3, reach + i * 6, .36, i * .09, { stagger: i === 2 }); break;
      case 'quarry': for (let i = 0; i < 3; i++) shot(1 / 3, 285 + i * 40, 1, 0, 1, 'physical', 0, { delay: .18 + i * .16, range: 240 + i * 45, radius: 27, sprite: 'boulder' }); break;
      case 'recurve': shot(1, 610, 3, .24); break;
      case 'royal': slash(heavy ? .75 : 1, reach, .3); if (heavy) slash(.25, 100, 2.2, .18, { stagger: true, kind: 'shield' }); break;
      case 'dawn': slash(beat === 2 ? .6 : 1, reach, 1.6, 0, { aim: aim + (beat % 2 ? .3 : -.3) }); if (beat === 2) slash(.4, 85, 2.4, .16, { aim: aim + .55 }); break;
      case 'storm': shot(1, 1150, 1, 0, 3, 'arcane', 62); break;
      case 'flame': if (beat === 0) shot(1, 670, 1, 0, 2, 'fire'); else if (beat === 1) shot(1, 410, 5, .2, 0, 'fire'); else shot(1, 300, 8, Math.PI / 4, 0, 'fire', 0, { delay: .18, range: 200 }); break;
      case 'twins': slash(.45, reach * .48, 2.8); slash(.55, reach, 3.8, .16, { inner: reach * .35, pull: true }); break;
      case 'standard': slash(1, reach, beat % 2 || heavy ? Math.PI * 2 : .42, 0, { stagger: heavy }); break;
    }
    return true;
  }
  private strike(s: Strike): void {
    const g = this.game;
    s.x = g.player.x; s.y = g.player.y;
    g.physicalAttack({ source: g.player, followSource: true, x: s.x, y: s.y - 8, angle: s.aim, reach: s.range, duration: .18, color: s.color, kind: s.kind, phase: 'strike', sweepAngle: s.arc });
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
