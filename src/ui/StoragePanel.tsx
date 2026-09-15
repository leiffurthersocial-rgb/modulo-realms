import { useState } from 'react';
import type { Game } from '../game/core/game';
import ItemCard from './ItemCard';
import { ItemCell } from './InventoryPanel';

export default function StoragePanel({ game }: { game: Game }) {
  const p = game.player;
  const [sel, setSel] = useState<{ uid: string; from: 'bag' | 'chest' } | null>(null);
  const selItem = sel
    ? (sel.from === 'bag' ? p.inventory : p.storage).find((i) => i.uid === sel.uid) ?? null
    : null;

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(960px, 95vw)', height: 'min(620px, 92vh)' }}>
        <div className="panel-title">
          <span>Home Storage</span>
          <span className="sub">Anything stored here is safe between adventures.</span>
          <button className="close-x" onClick={() => game.closeAll()}>×</button>
        </div>
        <div className="shop-layout">
          <div className="shop-col">
            <div className="shop-head"><span>Your pack ({p.inventory.length}/40)</span></div>
            <div className="item-grid scroll" style={{ padding: 12, overflowY: 'auto' }}>
              {p.inventory.map((it) => (
                <ItemCell
                  key={it.uid}
                  item={it}
                  selected={sel?.uid === it.uid}
                  onClick={() => setSel({ uid: it.uid, from: 'bag' })}
                />
              ))}
            </div>
          </div>
          <div className="shop-col">
            <div className="shop-head"><span>Storage chest ({p.storage.length})</span></div>
            <div className="item-grid scroll" style={{ padding: 12, overflowY: 'auto' }}>
              {p.storage.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 12, gridColumn: '1 / -1' }}>Empty.</div> : null}
              {p.storage.map((it) => (
                <ItemCell
                  key={it.uid}
                  item={it}
                  selected={sel?.uid === it.uid}
                  onClick={() => setSel({ uid: it.uid, from: 'chest' })}
                />
              ))}
            </div>
          </div>
        </div>
        {selItem ? (
          <div className="panel" style={{ position: 'absolute', right: 14, bottom: 14, width: 280, padding: 12, background: 'var(--panel-2)' }}>
            <ItemCard
              item={selItem}
              actions={
                sel!.from === 'bag' ? (
                  <button className="btn small primary" onClick={() => { game.moveToStorage(selItem.uid); setSel(null); }}>Store</button>
                ) : (
                  <button className="btn small primary" onClick={() => { game.takeFromStorage(selItem.uid); setSel(null); }}>Take</button>
                )
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
