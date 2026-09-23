import { useState } from 'react';
import type { Game } from '../game/core/game';
import ItemCard from './ItemCard';
import { ItemCell } from './InventoryPanel';
import { Modal } from './kit';

export default function StoragePanel({ game }: { game: Game }) {
  const p = game.player;
  const [sel, setSel] = useState<{ uid: string; from: 'bag' | 'chest' } | null>(null);
  const selItem = sel
    ? (sel.from === 'bag' ? p.inventory : p.storage).find((i) => i.uid === sel.uid) ?? null
    : null;

  return (
    <Modal title="Home Storage" sub="Anything stored here is safe between adventures." size="xl" tall onClose={() => game.closeAll()}>
        <div className="shop-layout">
          <div className="shop-col">
            <div className="shop-head"><span>Your pack ({p.inventory.length}/40)</span></div>
            <div className="item-grid scroll" style={{ padding: 6, overflowY: 'auto' }}>
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
            <div className="item-grid scroll" style={{ padding: 6, overflowY: 'auto' }}>
              {p.storage.length === 0 ? <div style={{ color: 'var(--muted)', gridColumn: '1 / -1' }}>Empty.</div> : null}
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
          <div className="panel" style={{ position: 'absolute', right: 7, bottom: 7, width: 140, padding: 6, background: 'var(--panel-2)' }}>
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
    </Modal>
  );
}
