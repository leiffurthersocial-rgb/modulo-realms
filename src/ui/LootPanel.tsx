import type { Game } from '../game/core/game';
import { RARITY_LABEL } from '../game/items/types';
import { itemIcon, rarityColor } from './ItemCard';
import { Icon, Modal } from './kit';

/**
 * What is inside a chest, listed rather than thrown on the floor. Nothing here
 * can be lost: closing the panel drops whatever is left at the chest's feet,
 * so a full pack is a reason to come back rather than a reason to lose a drop.
 */
export default function LootPanel({ game }: { game: Game }) {
  const loot = game.loot;
  if (!loot) return null;
  const empty = !loot.items.length && loot.gold <= 0;
  const full = game.bagFull;

  return (
    <Modal title={<>{loot.title}</>} sub={<>{loot.sub}
            {full ? ' · your pack is full' : ''}</>} actions={<><button
              className="btn small primary"
              disabled={empty}
              onClick={() => game.takeAllLoot()}
            >
              Take all
            </button></>} size="m" onClose={() => game.closeLoot()}>

        <div className="scroll" style={{ padding: 7, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {loot.gold > 0 ? (
            <button className="loot-gold" onClick={() => game.takeLootGold()}>
              <Icon name="coin" />
              {loot.gold.toLocaleString()} gold
              <span className="lr-take" style={{ marginLeft: 'auto' }}>TAKE</span>
            </button>
          ) : null}

          <div className="loot-grid">
            {loot.items.map((it) => (
              <button key={it.uid} className="loot-row" onClick={() => game.takeLoot(it.uid)}>
                <img src={itemIcon(it)} alt="" />
                <span>
                  <span className="lr-name" style={{ color: rarityColor(it.rarity) }}>
                    {it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}
                  </span>
                  <span className="lr-meta">
                    {RARITY_LABEL[it.rarity]} · level {it.level}
                    {it.enchants.length ? ` · ${it.enchants.length} enchant${it.enchants.length > 1 ? 's' : ''}` : ''}
                  </span>
                </span>
                <span className="lr-take">TAKE</span>
              </button>
            ))}
          </div>

          {empty ? <div className="loot-empty">Empty. Something else will have filled it by the time you come back.</div> : null}
          {!empty ? (
            <div className="loot-empty">
              Anything you leave here stays on the ground by the chest.
            </div>
          ) : null}
        </div>
    </Modal>
  );
}
