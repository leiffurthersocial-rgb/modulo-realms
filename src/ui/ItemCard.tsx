import { GREEK_WEAPON_STYLES } from '../data/aegean/weapons';
import type { ReactNode } from 'react';
import { getIconUrl } from '../game/art/icons';
import { AEGEAN_POWERS, EFFECT_BY_ID } from '../game/items/effects';
import { ENCHANT_BY_ID, enchantDescription } from '../game/items/enchants';
import {
  PERCENT_STATS, RARITY_COLOR, RARITY_LABEL, SLOT_LABEL, STAT_LABEL,
  type Item, type StatKey,
} from '../game/items/types';

export const rarityColor = (r: Item['rarity']): string => RARITY_COLOR[r];

export function itemIcon(item: Item): string {
  return getIconUrl(item.icon, { metal: item.iconMetal, accent: item.iconAccent, glow: item.glow });
}

function formatStat(key: StatKey, value: number): string {
  const pct = PERCENT_STATS.has(key);
  if (key === 'attackSpeed') return `${value.toFixed(2)}/s`;
  if (key === 'range') return `${Math.round(value)}`;
  if (pct) return `${value > 0 ? '+' : ''}${value.toFixed(0)}%`;
  return `${value > 0 ? '+' : ''}${Math.round(value)}`;
}

interface Props {
  item: Item;
  compare?: Item | null;
  actions?: ReactNode;
  showValue?: boolean;
}

/** The item panel used in tooltips, inventory detail and shop hovers. */
export default function ItemCard({ item, compare, actions, showValue }: Props) {
  const color = rarityColor(item.rarity);
  const keys = Object.keys(item.stats) as StatKey[];
  const emptySlots = Math.max(0, item.enchantSlots - item.enchants.length);
  const signature = item.aegeanPower ? AEGEAN_POWERS[item.aegeanPower] : undefined;
  const radiant = item.rarity === 'mythic' || item.rarity === 'primordial';
  const powerTrigger = signature?.trigger === 'active'
    ? item.slot === 'mainHand' ? 'Weapon power · V' : item.slot === 'offHand' ? 'Off-hand power · F' : 'Artifact power · R'
    : signature?.trigger === 'brace' ? 'Triggers after a timed brace'
      : signature?.trigger === 'dodge' ? 'Triggers after dodging an attack'
        : signature?.trigger === 'hazardExit' ? 'Triggers when leaving a hazard'
          : signature ? `Triggers on ${signature.trigger}` : '';

  return (
    <div className={`item-card${item.rarity === 'primordial' ? ' primordial' : ''}`}>
      <div className="ic-head">
        <span className="ic-icon" style={{ borderColor: color, boxShadow: `0 0 12px ${color}33, inset 0 0 10px #0009` }}>
          <img src={itemIcon(item)} alt="" />
        </span>
        <div>
          <div
            className={`ic-name${radiant ? ` ${item.rarity}` : ''}`}
            style={radiant ? undefined : { color, textShadow: item.rarity === 'common' ? 'none' : `0 0 14px ${color}55` }}
          >
            {item.name}
          </div>
          <div className="ic-meta">
            <span
              className={`rarity-pill${radiant ? ` ${item.rarity}` : ''}`}
              style={{ color, borderColor: `${color}66`, background: `${color}14` }}
            >
              {RARITY_LABEL[item.rarity]}
            </span>
            <span>Level {item.level}</span>
            <span>
              {item.slot ? SLOT_LABEL[item.slot]
                : item.type === 'consumable' ? 'Consumable'
                  : item.type === 'material' ? 'Material'
                    : item.type === 'quest' ? 'Quest item' : ''}
            </span>
          </div>
        </div>
      </div>

      {GREEK_WEAPON_STYLES[item.defId] ? <div className="greek-weapon-style"><strong>{GREEK_WEAPON_STYLES[item.defId].label}</strong><span>{GREEK_WEAPON_STYLES[item.defId].rhythm}</span></div> : null}
      {signature ? (
        <div className="ic-signature" style={{ borderColor: `${color}66` }}>
          <strong style={{ color }}>{signature.name}</strong>
          <span>{powerTrigger} · {signature.cooldown}s cooldown</span>
          {item.desc ? <p>{item.desc}</p> : null}
        </div>
      ) : null}
      {keys.length ? (
        <>
          <div className="divider" />
          <div className="ic-stats">
            {keys.map((k) => {
              const v = item.stats[k]!;
              const cv = compare?.stats[k] ?? 0;
              const diff = compare ? v - cv : 0;
              const cls = !compare || Math.abs(diff) < 0.05 ? '' : diff > 0 ? 'up' : 'down';
              return (
                <div className="ic-stat" key={k}>
                  <span style={{ color: 'var(--muted)' }}>{STAT_LABEL[k]}</span>
                  <span className={`v ${cls}`}>
                    {formatStat(k, v)}
                    {compare && Math.abs(diff) >= 0.05 ? (
                      <span style={{ marginLeft: 6, fontSize: 11 }}>
                        ({diff > 0 ? '+' : '-'}{formatStat(k, Math.abs(diff)).replace('+', '')})
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {item.enchantSlots > 0 ? (
        <>
          <div className="divider" />
          <div className="ench-head">
            Enchantments <span>{item.enchants.length} / {item.enchantSlots}</span>
          </div>
          {item.enchants.map((e) => {
            const def = ENCHANT_BY_ID[e.id];
            if (!def) return null;
            return (
              <div className="ench-row" key={e.id}>
                <span className="ench-dot" style={{ background: def.color }} />
                <span>
                  <strong style={{ color: def.color }}>
                    {def.name}{def.maxLevel > 1 ? ` ${'I'.repeat(Math.min(3, e.level))}` : ''}
                  </strong>
                  <span className="ench-desc"> {enchantDescription(def, e.level)}</span>
                </span>
              </div>
            );
          })}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div className="ench-row empty" key={`slot${i}`}>
              <span className="ench-dot" />
              <span className="ench-desc">Empty enchantment slot</span>
            </div>
          ))}
        </>
      ) : null}

      {item.artifact && !signature ? (
        <>
          <div className="divider" />
          <div className="ic-effect" style={{ borderLeftColor: 'var(--gold)' }}>
            <strong style={{ color: 'var(--gold)' }}>{item.artifact.name}</strong>
            {' '}({item.slot === 'offHand' ? 'F' : 'R'}, {item.artifact.cooldown}s) — {item.artifact.desc}
          </div>
        </>
      ) : null}

      {item.effects.length ? (
        <>
          <div className="divider" />
          {item.effects.map((id) => {
            const e = EFFECT_BY_ID[id];
            if (!e) return null;
            return (
              <div className="ic-effect" key={id} style={{ borderLeftColor: e.color }}>
                <strong style={{ color: e.color }}>{e.name}</strong> — {e.desc}
              </div>
            );
          })}
        </>
      ) : null}

      {item.consume ? (
        <div className="ic-effect" style={{ borderLeftColor: '#5dbf5a' }}>{item.desc ?? 'Restorative.'}</div>
      ) : null}

      {item.classes ? (
        <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>
          Requires: {item.classes.map((c) => c[0].toUpperCase() + c.slice(1)).join(' / ')}
        </div>
      ) : null}

      {item.desc && !item.consume && !signature ? <div className="ic-flavour">{item.desc}</div> : null}

      {showValue ? <div className="ic-meta" style={{ color: 'var(--gold)' }}>Value: {item.value} gold</div> : null}

      {actions ? <div className="ic-actions">{actions}</div> : null}
    </div>
  );
}
