import type { Game } from '../game/core/game';
import { getIconUrl } from '../game/art/icons';
import { RARITY_LABEL } from '../game/items/types';
import { itemIcon, rarityColor } from './ItemCard';

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
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeLoot(); }}>
      <div className="modal panel" style={{ width: 'min(620px, 94vw)', maxHeight: 'min(600px, 90vh)' }}>
        <div className="panel-title">
          <span>{loot.title}</span>
          <span className="sub">
            {loot.sub}
            {full ? ' · your pack is full' : ''}
          </span>
          <span className="title-actions">
            <button
              className="btn small primary"
              disabled={empty}
              onClick={() => game.takeAllLoot()}
            >
              Take all
            </button>
            <button className="close-x" onClick={() => game.closeLoot()}>&times;</button>
          </span>
        </div>

        <div className="scroll" style={{ padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loot.gold > 0 ? (
            <button className="loot-gold" onClick={() => game.takeLootGold()}>
              <img src={getIconUrl('gold')} alt="" />
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
      </div>
    </div>
  );
}
