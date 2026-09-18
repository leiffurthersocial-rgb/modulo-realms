import { useState } from 'react';
import type { Game } from '../game/core/game';
import { countItem } from '../game/items/inventory';
import { LOOT_LEVEL_REACH } from '../data/balance';
import { EQUIP_SLOT_ORDER, type Item } from '../game/items/types';
import { getIconUrl } from '../game/art/icons';
import ItemCard, { itemIcon, rarityColor } from './ItemCard';

/**
 * The anvil: push gear a level higher, or rebind its enchantments with a rune.
 * Opened under King Jovan's warrant it also offers the royal commission, which
 * raises an item's rarity outright — the one way to promote gear you chose
 * rather than waiting for the drop you wanted.
 */
export default function ForgePanel({ game }: { game: Game }) {
  const p = game.player;
  const equipped = EQUIP_SLOT_ORDER.map((s) => p.equipment[s]).filter((i): i is Item => !!i);
  const bagged = p.inventory.filter((i) => i.type === 'weapon' || i.type === 'armor' || i.type === 'accessory');
  const all = [...equipped, ...bagged];
  const [sel, setSel] = useState<string | null>(all[0]?.uid ?? null);
  const item = sel ? game.findGear(sel) : undefined;

  const runes = countItem(p.inventory, 'mat_rune');
  const ingots = game.ingotsHeld();
  const ore = countItem(p.inventory, 'mat_iron_ore');
  const smelt = game.smeltCost();
  const cap = game.reforgeCap();
  const maxed = item ? item.level >= cap : false;
  const reforge = item ? game.reforgeCost(item) : null;
  const rebind = item ? game.enchantCost(item) : null;
  const blocked = item ? game.rerollBlocked(item) : null;
  const royal = game.royalOpen;
  const warrants = game.warrantsAvailable();
  const elevate = item ? game.canElevate(item) : null;

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(880px, 95vw)', height: 'min(620px, 92vh)' }}>
        <div className="panel-title">
          <span>{royal ? 'Crown Commission' : 'The Anvil'}</span>
          <span className="sub">
            {royal ? <>{warrants} warrant{warrants === 1 ? '' : 's'} &middot; </> : null}
            {ingots} ingots (iron equivalent) &middot; {ore} ore &middot; {runes} binding runes &middot; {p.gold} gold
          </span>
          <button className="close-x" onClick={() => game.closeAll()}>&times;</button>
        </div>

        <div className="quest-layout">
          <div className="scroll" style={{ borderRight: '1px solid var(--edge)', overflowY: 'auto', padding: 10 }}>
            {all.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: 10 }}>You carry nothing worth working.</div>
            ) : null}
            {all.map((it) => {
              const isEquipped = equipped.includes(it);
              return (
                <button
                  key={it.uid}
                  className={`shop-row ${sel === it.uid ? 'sel' : ''}`}
                  style={{ width: '100%', background: sel === it.uid ? 'rgba(216,176,106,0.1)' : 'none', border: '1px solid transparent' }}
                  onClick={() => setSel(it.uid)}
                >
                  <img src={itemIcon(it)} alt="" />
                  <span className="sr-name" style={{ color: rarityColor(it.rarity) }}>
                    {it.name}
                    <span className="sr-meta">
                      Level {it.level}{isEquipped ? ' · equipped' : ''} · {it.enchants.length}/{it.enchantSlots} enchants
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="inv-col scroll" style={{ overflowY: 'auto' }}>
            {item ? (
              <>
                <ItemCard item={item} />
                <div className="divider" style={{ margin: '14px 0' }} />
                <div className="forge-action">
                  <div>
                    <div className="fa-title">Reforge</div>
                    <div className="fa-desc">
                      {maxed
                        ? `Level ${item.level} is as far as this anvil will take anything for you. Reach level ${item.level - LOOT_LEVEL_REACH + 1} and come back.`
                        : `Raise the item one level and strengthen its core stats. This anvil works up to level ${cap} for you.`}
                    </div>
                    <div className="fa-cost">
                      <img src={getIconUrl('mat_ingot')} alt="" />{reforge!.ingots}
                      <img src={getIconUrl('gold')} alt="" />{reforge!.gold}
                    </div>
                  </div>
                  <button
                    className="btn primary"
                    disabled={maxed || ingots < reforge!.ingots || p.gold < reforge!.gold}
                    onClick={() => game.reforge(item.uid)}
                  >
                    {maxed ? 'At your limit' : 'Reforge'}
                  </button>
                </div>

                <div className="forge-action">
                  <div>
                    <div className="fa-title">Smelt ore</div>
                    <div className="fa-desc">
                      {smelt.ore} iron ore into one ingot, and it will run every batch you can pay for at once.
                      Steel counts as three ingots at this anvil, Jotunsteel as eight.
                    </div>
                    <div className="fa-cost">
                      <img src={getIconUrl('mat_ore')} alt="" />{smelt.ore}
                      <img src={getIconUrl('gold')} alt="" />{smelt.gold}
                    </div>
                  </div>
                  <button
                    className="btn"
                    disabled={ore < smelt.ore || p.gold < smelt.gold}
                    onClick={() => game.smelt()}
                  >
                    Smelt {ore >= smelt.ore ? `${Math.min(Math.floor(ore / smelt.ore), Math.floor(p.gold / smelt.gold))}` : ''}
                  </button>
                </div>

                {royal ? (
                  <div className="forge-action royal">
                    <div>
                      <div className="fa-title">Royal commission</div>
                      <div className="fa-desc">
                        {elevate?.ok
                          ? <>Jovan has this remade one grade finer — <b>{item.rarity}</b> becomes <b>{elevate.next}</b> — with an extra enchantment slot and fresh rolls.</>
                          : elevate?.reason}
                      </div>
                      <div className="fa-cost">
                        <span className="warrant-pip" />
                        1 crown warrant &middot; {warrants} held
                      </div>
                    </div>
                    <button
                      className="btn primary"
                      disabled={!elevate?.ok}
                      onClick={() => game.royalElevate(item.uid)}
                    >
                      Commission
                    </button>
                  </div>
                ) : null}

                <div className="forge-action">
                  <div>
                    <div className="fa-title">Rebind runes</div>
                    <div className="fa-desc">
                      {blocked ?? 'Discard the rolled enchantments and draw new ones from this item’s pool.'}
                    </div>
                    {blocked ? null : (
                      <div className="fa-cost">
                        <img src={getIconUrl('rune')} alt="" />{rebind!.runes}
                        <img src={getIconUrl('gold')} alt="" />{rebind!.gold}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn primary"
                    disabled={!!blocked || runes < rebind!.runes || p.gold < rebind!.gold}
                    onClick={() => game.rerollEnchants(item.uid)}
                  >
                    {item.noReroll ? 'Bound' : 'Rebind'}
                  </button>
                </div>

                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 14, lineHeight: 1.7 }}>
                  {royal ? 'The crown owes you one warrant for every boss you have felled, and spends one per grade. ' : ''}
                  An item can only take enchantments from its own family — a blade will never roll Multishot — and
                  never two from the same school, so Fire Aspect and Freezing can never sit on the same weapon.
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Select a piece of gear.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
