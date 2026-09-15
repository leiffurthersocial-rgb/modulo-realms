import { useState } from 'react';
import type { Game } from '../game/core/game';
import { sortInventory } from '../game/items/inventory';
import {
  EQUIP_SLOT_ORDER, RARITY_LABEL, RARITY_ORDER, SLOT_LABEL,
  type EquipSlot, type Item, type ItemType,
} from '../game/items/types';
import ItemCard, { itemIcon, rarityColor } from './ItemCard';

const FILTERS: Array<{ id: ItemType | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'weapon', label: 'Weapons' },
  { id: 'armor', label: 'Armour' },
  { id: 'accessory', label: 'Artifacts' },
  { id: 'consumable', label: 'Potions' },
  { id: 'material', label: 'Materials' },
  { id: 'quest', label: 'Quest' },
];

export default function InventoryPanel({ game }: { game: Game }) {
  const p = game.player;
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<ItemType | 'all'>('all');
  const stats = p.stats();

  const items = p.inventory.filter((i) => filter === 'all' || i.type === filter);
  const sel = p.inventory.find((i) => i.uid === selected) ?? null;
  const compare = sel?.slot ? p.equipment[sel.slot] : null;

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(1060px, 96vw)', height: 'min(690px, 92vh)' }}>
        <div className="panel-title">
          <span>Pack</span>
          <span className="sub">{p.inventory.length}/40 slots &middot; {p.gold} gold</span>
          <button className="close-x" onClick={() => game.closeAll()}>&times;</button>
        </div>

        <div className="inv-layout">
          <div className="inv-col">
            <div className="section-h">Equipped</div>
            <div className="equip-grid">
              {EQUIP_SLOT_ORDER.map((slot) => (
                <EquipCell
                  key={slot}
                  slot={slot}
                  item={p.equipment[slot]}
                  onClick={() => p.equipment[slot] && game.unequipSlot(slot)}
                />
              ))}
            </div>
            <div className="section-h">Totals</div>
            <div className="stat-list">
              <Row k="Attack Power" v={Math.round(p.attackPower())} />
              <Row k="Attack Speed" v={`${(1 / p.attackInterval()).toFixed(2)}/s`} />
              <Row k="Armour" v={Math.round(stats.defense)} />
              <Row k="Health" v={Math.round(stats.maxHealth)} />
              <Row k="Crit Chance" v={`${stats.critChance.toFixed(0)}%`} />
              <Row k="Crit Damage" v={`+${stats.critDamage.toFixed(0)}%`} />
              <Row k="Move Speed" v={Math.round(stats.moveSpeed)} />
              {stats.magicFind > 0 ? <Row k="Magic Find" v={`+${stats.magicFind.toFixed(0)}%`} /> : null}
              {stats.lifesteal > 0 ? <Row k="Life Steal" v={`${stats.lifesteal.toFixed(0)}%`} /> : null}
            </div>
          </div>

          <div className="inv-col">
            <div className="inv-toolbar">
              {FILTERS.map((f) => (
                <button key={f.id} className={`filter-chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
              <button className="btn small" style={{ marginLeft: 'auto' }} onClick={() => { sortInventory(p.inventory); game.touch(); }}>
                Sort
              </button>
            </div>
            <div className="item-grid scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
              {items.map((it) => (
                <ItemCell key={it.uid} item={it} selected={selected === it.uid} onClick={() => setSelected(it.uid)} />
              ))}
              {Array.from({ length: Math.max(0, 40 - p.inventory.length) }).map((_, i) => (
                <div className="item-cell empty" key={`empty${i}`} />
              ))}
            </div>
          </div>

          <div className="inv-col">
            {sel ? (
              <ItemCard
                item={sel}
                compare={compare}
                showValue
                actions={
                  <>
                    {sel.slot ? (
                      <button className="btn small primary" onClick={() => { game.equipItem(sel.uid); setSelected(null); }}>Equip</button>
                    ) : null}
                    {sel.consume ? (
                      <button className="btn small primary" onClick={() => { game.useItem(sel.uid); setSelected(null); }}>Use</button>
                    ) : null}
                    {sel.consume ? (
                      <button className="btn small" onClick={() => { p.quickItem = sel.defId; game.touch(); }}>Bind to Q</button>
                    ) : null}
                    {sel.type !== 'quest' ? (
                      <button className="btn small danger" onClick={() => { game.dropItem(sel.uid); setSelected(null); }}>Drop</button>
                    ) : null}
                  </>
                }
              />
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.7 }}>
                <div className="section-h">Details</div>
                Select an item to inspect it. Equipped gear is compared automatically, so a drop&apos;s upgrades and
                downgrades are visible at a glance.
                <div className="section-h" style={{ marginTop: 18 }}>Rarity</div>
                {RARITY_ORDER.map((r) => (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: rarityColor(r), display: 'inline-block' }} />
                    <span style={{ color: rarityColor(r), fontSize: 12 }}>{RARITY_LABEL[r]}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, fontSize: 11.5 }}>
                  Rarer gear carries more enchantment slots: none, one, one, two, three.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return <div className="stat-row"><span>{k}</span><span className="v">{v}</span></div>;
}

export function ItemCell({ item, selected, onClick, equipped }: { item: Item; selected?: boolean; onClick?: () => void; equipped?: boolean }) {
  const color = rarityColor(item.rarity);
  return (
    <button
      className={`item-cell ${selected ? 'selected' : ''} ${equipped ? 'equipped' : ''}`}
      onClick={onClick}
      title={item.name}
      style={item.rarity === 'common' ? undefined : { borderColor: color, boxShadow: `inset 0 0 12px ${color}22` }}
    >
      <img src={itemIcon(item)} alt="" />
      {item.qty > 1 ? <span className="qty">{item.qty}</span> : null}
      {item.enchants.length ? <span className="ench-mark" /> : null}
    </button>
  );
}

function EquipCell({ slot, item, onClick }: { slot: EquipSlot; item: Item | null; onClick: () => void }) {
  const color = item ? rarityColor(item.rarity) : undefined;
  return (
    <button
      className="equip-slot"
      onClick={onClick}
      title={item ? `${item.name} — click to unequip` : SLOT_LABEL[slot]}
      style={item && item.rarity !== 'common' ? { borderColor: color, boxShadow: `inset 0 0 14px ${color}22` } : undefined}
    >
      <span className="slot-name">{SLOT_LABEL[slot]}</span>
      {item ? <img src={itemIcon(item)} alt="" /> : null}
    </button>
  );
}
