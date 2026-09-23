import { memo, useCallback, useRef } from 'react';
import type { Game } from '../../game/core/game';
import type { ActionName } from '../../game/core/input';
import { getIconUrl } from '../../game/art/icons';
import { AEGEAN_POWERS } from '../../game/items/effects';
import { Badge, Icon, KeyCap } from '../kit';
import { useGameValue } from '../hooks';

interface SlotView {
  id: string;
  key: string;
  icon: string | null;
  title: string;
  /** seconds left, 0 when ready */
  cd: number;
  /** 0..1 of the cooldown still to run, stepped so the sweep ticks */
  frac: number;
  locked?: number;
  starved?: 'mana' | 'stamina';
  qty?: number;
  tone?: 'brass';
  held?: boolean;
  empty?: boolean;
}

/** Stepped fraction: a clock face in sixteen ticks, not a smooth wipe. */
const STEPS = 16;
const step = (f: number) => Math.ceil(Math.max(0, Math.min(1, f)) * STEPS) / STEPS;
const seconds = (cd: number) => (cd <= 0 ? 0 : cd < 1 ? Math.ceil(cd * 10) / 10 : Math.ceil(cd));

/**
 * The ability bar. Each slot is an iron socket with the key it answers to on
 * a key cap, a stepped cooldown sweep, a lock and the unlock level on
 * abilities not yet learned, and a count on the potion.
 */
export default function Hotbar({ game }: { game: Game }) {
  const p = game.player;
  // Longest cooldown seen for each slot, so the sweep knows what 100% is
  // without the simulation having to publish it.
  const longest = useRef(new Map<string, number>());
  const sweep = (id: string, cd: number) => {
    const seen = longest.current.get(id) ?? 0;
    if (cd <= 0) { longest.current.delete(id); return 0; }
    if (cd > seen) longest.current.set(id, cd);
    return step(cd / Math.max(cd, seen));
  };
  const key = (a: ActionName) => (game.input.touchMode ? '' : game.input.keyLabel(a));

  const slots = useGameValue((): SlotView[] => {
    const out: SlotView[] = [];
    const mh = p.equipment.mainHand;
    out.push({
      id: 'attack', key: key('attack') === 'Space' ? 'SPC' : key('attack'), cd: 0, frac: 0, tone: 'brass',
      icon: mh ? getIconUrl(mh.icon, { metal: mh.iconMetal, glow: mh.glow }) : null,
      title: mh ? `Attack with ${mh.name}` : 'Attack (fists)',
    });
    p.classDef.abilities.forEach((a, i) => {
      const locked = p.level < a.level ? a.level : undefined;
      const cd = p.cooldowns[a.id] ?? 0;
      out.push({
        id: a.id, key: key(`slot${i + 1}` as ActionName) || String(i + 1),
        icon: getIconUrl(a.icon as 'sword'), cd: seconds(cd), frac: sweep(a.id, cd), locked,
        starved: locked ? undefined : p.mp < a.mana ? 'mana' : p.sp < a.stamina ? 'stamina' : undefined,
        title: locked ? `${a.name} — unlocks at level ${a.level}` : `${a.name}: ${a.desc}`,
      });
    });
    const off = p.equipment.offHand;
    const shield = off?.weaponKind === 'shield' && !off.aegeanPower;
    const offCd = shield ? 0 : p.offhandCooldown;
    out.push({
      id: 'offhand', key: key('offhand'), cd: seconds(offCd), frac: sweep('offhand', offCd),
      icon: off ? getIconUrl(off.icon, { metal: off.iconMetal, glow: off.glow }) : null, empty: !off,
      held: p.blocking, title: off ? `${off.name} (hold to block)` : 'No off-hand — F drinks a potion',
    });
    const weapon = p.equipment.mainHand;
    const art = weapon?.aegeanPower ? AEGEAN_POWERS[weapon.aegeanPower] : weapon?.weaponPower;
    if (weapon && art) {
      out.push({
        id: 'power', key: key('weaponPower'), cd: seconds(p.weaponPowerCooldown), frac: sweep('power', p.weaponPowerCooldown),
        icon: getIconUrl(weapon.icon, { metal: weapon.iconMetal, glow: weapon.glow }), tone: 'brass',
        title: `${art.name} — ${weapon.aegeanPower ? weapon.desc ?? '' : weapon.weaponPower?.desc ?? ''}`,
      });
    }
    const artifact = p.equipment.accessory;
    const artifactArt = artifact?.aegeanPower ? AEGEAN_POWERS[artifact.aegeanPower] : artifact?.artifact;
    out.push({
      id: 'artifact', key: key('artifact'), cd: seconds(p.artifactCooldown), frac: sweep('artifact', p.artifactCooldown),
      icon: artifact ? getIconUrl(artifact.icon, { metal: artifact.iconMetal, glow: artifact.glow }) : null,
      empty: !game.naval.aboard && !artifactArt,
      title: game.naval.aboard ? 'Fight boarders on deck' : artifactArt ? `${artifactArt.name} — ${artifact?.aegeanPower ? artifact.desc ?? '' : artifact?.artifact?.desc ?? ''}` : 'No artifact equipped',
    });
    const quick = p.inventory.find((i) => i.type === 'consumable' && (p.quickItem ? i.defId === p.quickItem : true))
      ?? p.inventory.find((i) => i.type === 'consumable');
    const recoveryApplies = quick?.consume?.cooldownGroup === 'recovery' ||
      (game.regionAtPlayer() === 'aegean_asterion' && !!(quick?.consume?.health || quick?.consume?.healthPct));
    const recovery = recoveryApplies ? p.cooldowns['consume:recovery'] ?? 0 : 0;
    out.push({
      id: 'potion', key: key('potion'), cd: seconds(recovery), frac: sweep('potion', recovery),
      icon: quick ? getIconUrl(quick.icon, { metal: quick.iconMetal }) : null, qty: quick?.qty, empty: !quick,
      title: quick ? `${quick.name}${recovery > 0 ? ` — recovering, ${Math.ceil(recovery)}s` : ''}` : 'No potion to drink',
    });
    return out;
  }, 12);

  const use = useRef<Record<string, () => void>>({});
  use.current = {
    attack: () => game.basicAttack(false),
    offhand: () => game.useOffhand(),
    power: () => game.useWeaponPower(),
    artifact: () => (game.naval.aboard ? game.naval.enterDeck() : game.useArtifact()),
    potion: () => game.useQuickItem(),
  };
  p.classDef.abilities.forEach((a, i) => { use.current[a.id] = () => { if (p.level >= a.level) game.useAbility(i); }; });
  const fire = useCallback((id: string) => use.current[id]?.(), []);

  return (
    <div className="hud-abilities" role="toolbar" aria-label="Abilities">
      {slots.map((s) => <Slot key={s.id} view={s} fire={fire} />)}
    </div>
  );
}

const Slot = memo(function Slot({ view: s, fire }: { view: SlotView; fire: (id: string) => void }) {
  const ready = s.cd <= 0 && !s.locked && !s.empty;
  return (
    <button
      className={`slot${s.tone ? ` ${s.tone}` : ''}${s.locked ? ' locked' : ''}${s.empty ? ' empty' : ''}${s.cd > 0 ? ' cooling' : ''}${s.held ? ' held' : ''}${s.starved ? ` starved ${s.starved}` : ''}${ready ? ' ready' : ''}`}
      title={s.title}
      onClick={() => fire(s.id)}
    >
      {s.icon ? <img src={s.icon} alt="" draggable={false} /> : null}
      {s.cd > 0 ? (
        <>
          <span className="sweep" style={{ clipPath: sweepPath(s.frac) }} />
          <span className="cd">{s.cd}</span>
        </>
      ) : null}
      {s.locked ? (
        <span className="lock">
          <Icon name="lock" />
          <Badge tone="iron">{s.locked}</Badge>
        </span>
      ) : null}
      {s.qty && s.qty > 1 ? <span className="qty">{s.qty}</span> : null}
      {s.key ? <KeyCap className="key">{s.key}</KeyCap> : null}
    </button>
  );
});

/**
 * The part of the socket still cooling, as a polygon: from twelve o'clock,
 * clockwise, round to the fraction left. Drawn over the icon as a dither.
 */
function sweepPath(frac: number): string {
  if (frac >= 1) return 'none';
  const a = (1 - frac) * Math.PI * 2; // where the cleared part ends
  const pts: string[] = ['50% 50%'];
  const at = (t: number) => {
    const x = 50 + Math.sin(t) * 71;
    const y = 50 - Math.cos(t) * 71;
    return `${Math.max(0, Math.min(100, x)).toFixed(1)}% ${Math.max(0, Math.min(100, y)).toFixed(1)}%`;
  };
  pts.push(at(a));
  // walk the remaining corners clockwise back to twelve o'clock
  const corners: Array<[number, string]> = [[Math.PI * 0.25, '100% 0%'], [Math.PI * 0.75, '100% 100%'], [Math.PI * 1.25, '0% 100%'], [Math.PI * 1.75, '0% 0%']];
  for (const [t, c] of corners) if (t > a) pts.push(c);
  pts.push('50% 0%');
  return `polygon(${pts.join(', ')})`;
}
