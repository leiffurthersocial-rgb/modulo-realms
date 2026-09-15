import { useState } from 'react';
import type { Game } from '../game/core/game';
import { NPC_BY_ID } from '../data/npcs';
import { buyValue, sellValue } from '../game/items/loot';
import type { Item } from '../game/items/types';
import { getIconUrl } from '../game/art/icons';
import ItemCard, { itemIcon, rarityColor } from './ItemCard';

export default function ShopPanel({ game }: { game: Game }) {
  const shop = game.shop!;
  const npc = NPC_BY_ID[shop.npcId];
  const p = game.player;
  const [hover, setHover] = useState<Item | null>(null);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');

  const sellable = p.inventory.filter((i) => i.type !== 'quest');

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(1020px, 96vw)', height: 'min(660px, 92vh)' }}>
        <div className="panel-title">
          <span>{shop.name}</span>
          <span className="sub">
            {npc.name} · prices {shop.priceMod < 0.98 ? 'favourable' : shop.priceMod > 1.06 ? 'steep' : 'fair'}
            {' '}({Math.round(shop.priceMod * 100)}%)
          </span>
          <button className="close-x" onClick={() => game.closeAll()}>×</button>
        </div>

        <div className="shop-layout">
          <div className="shop-col">
            <div className="shop-head">
              <span>Your pack</span>
              <span style={{ color: 'var(--gold)' }}>{p.gold} gold</span>
            </div>
            <div className="shop-list scroll">
              {sellable.length === 0 ? <div style={{ padding: 14, color: 'var(--muted)', fontSize: 12 }}>Nothing to sell.</div> : null}
              {sellable.map((it) => (
                <div
                  className="shop-row"
                  key={it.uid}
                  onMouseEnter={() => { setHover(it); setSide('sell'); }}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => game.sellItem(it.uid)}
                >
                  <img src={itemIcon(it)} alt="" />
                  <div className="sr-name" style={{ color: rarityColor(it.rarity) }}>
                    {it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}
                    <div className="sr-meta">Level {it.level} · {it.type}</div>
                  </div>
                  <span className="sr-price">+{sellValue({ ...it, qty: 1 }, shop.priceMod)}g</span>
                </div>
              ))}
            </div>
            <div className="shop-foot">
              <span style={{ color: 'var(--muted)' }}>Click an item to sell one.</span>
            </div>
          </div>

          <div className="shop-col">
            <div className="shop-head">
              <span>{npc.name}&apos;s stock</span>
              <span style={{ color: 'var(--muted)' }}>{shop.stock.length} items</span>
            </div>
            <div className="shop-list scroll">
              {shop.stock.map((it) => {
                const price = buyValue(it, shop.priceMod);
                const afford = p.gold >= price;
                return (
                  <div
                    className="shop-row"
                    key={it.uid}
                    style={{ opacity: afford ? 1 : 0.55 }}
                    onMouseEnter={() => { setHover(it); setSide('buy'); }}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => game.buyItem(it.uid)}
                  >
                    <img src={itemIcon(it)} alt="" />
                    <div className="sr-name" style={{ color: rarityColor(it.rarity) }}>
                      {it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}
                      <div className="sr-meta">Level {it.level} · {it.type}</div>
                    </div>
                    <span className="sr-price">{price}g</span>
                  </div>
                );
              })}
            </div>
            <div className="shop-foot">
              <span style={{ color: 'var(--muted)' }}>Click to buy.</span>
              <span className="gold-pill"><img src={getIconUrl('gold')} alt="" />{p.gold}</span>
            </div>
          </div>
        </div>

        {hover ? (
          <div className="panel" style={{ position: 'absolute', right: 14, bottom: 14, width: 280, padding: 12, background: 'var(--panel-2)' }}>
            <ItemCard
              item={hover}
              compare={hover.slot ? p.equipment[hover.slot] : null}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold)' }}>
              {side === 'buy'
                ? `Costs ${buyValue(hover, shop.priceMod)} gold — you would have ${Math.max(0, p.gold - buyValue(hover, shop.priceMod))}`
                : `Sells for ${sellValue({ ...hover, qty: 1 }, shop.priceMod)} gold — you would have ${p.gold + sellValue({ ...hover, qty: 1 }, shop.priceMod)}`}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
