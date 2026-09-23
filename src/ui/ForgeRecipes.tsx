import { useMemo } from 'react';
import type { Game } from '../game/core/game';
import { AEGEAN_RECIPES, AEGEAN_REWARDS, type AegeanRecipe } from '../data/aegean/content';
import { TEMPLATE_BY_ID } from '../data/items';
import { countItem } from '../game/items/inventory';
import { makeItem } from '../game/items/loot';
import { RNG } from '../game/core/rng';
import { getIconUrl } from '../game/art/icons';
import ItemCard from './ItemCard';
import { aegeanName } from './aegeanNames';
import { Icon } from './kit';

export interface ForgeWork {
  id: string;
  item: string;
  name: string;
  recipe?: AegeanRecipe;
  reward?: string;
}

/** Show only work this smith can do with the deeds the player has actually done. */
export function localForgeWork(game: Game): ForgeWork[] {
  if (!game.campaign.nearService('forge')) return [];
  const work: ForgeWork[] = [];
  if (game.campaign.onIsland()) {
    for (const source of game.campaign.state.pendingChoices) {
      for (const item of AEGEAN_REWARDS[source]?.choice ?? []) {
        work.push({ id: `reward:${source}:${item}`, item, name: aegeanName(item), reward: source });
      }
    }
  }
  for (const recipe of AEGEAN_RECIPES) {
    if (recipe.islandOnly && !game.campaign.onIsland()) continue;
    if (game.campaign.requirements(recipe.requires).length) continue;
    // The storm ribs are a permanent hull upgrade, not a repeat purchase.
    if (recipe.flag && game.campaign.has(recipe.flag)) continue;
    work.push({ id: recipe.id, item: recipe.item, name: recipe.name, recipe });
  }
  return work;
}

export default function ForgeRecipeDetails({ game, work, onMade }: { game: Game; work: ForgeWork; onMade: () => void }) {
  const recipe = work.recipe;
  const template = TEMPLATE_BY_ID[work.item];
  // A deterministic base-stat preview never grants an item or consumes the loot RNG.
  const preview = useMemo(() => makeItem(work.item, {
    plain: true,
    rng: new RNG(1),
    provenance: { source: work.reward ? 'reward' : 'craft', id: work.reward ?? work.id, region: 'aegean_asterion' },
  }), [work.item, work.id, work.reward]);
  const canMake = !!recipe && game.player.gold >= recipe.gold && recipe.materials.every((m) => countItem(game.player.inventory, m.id) >= m.count);

  return (
    <>
      <ItemCard item={preview} compare={template.slot ? game.player.equipment[template.slot] : null} />
      <div className="divider" style={{ margin: '7px 0' }} />
      {recipe ? (
        <>
          <div className="section-h">Materials</div>
          <div className="obj-list">
            {recipe.materials.map((m) => {
              const have = countItem(game.player.inventory, m.id);
              const mat = TEMPLATE_BY_ID[m.id];
              return (
                <div className={`obj-item ${have >= m.count ? 'done' : ''}`} key={m.id}>
                  <span>{mat ? <img src={getIconUrl(mat.icon, { metal: mat.metal })} alt="" style={{ width: 10, height: 10, verticalAlign: 'middle', marginRight: 3 }} /> : null}{aegeanName(m.id)}</span>
                  <span>{have}/{m.count}</span>
                </div>
              );
            })}
          </div>
          <div className="forge-action">
            <div>
              <div className="fa-title">Forge {work.name}</div>
              <div className="fa-cost"><Icon name="coin" />{recipe.gold.toLocaleString()}</div>
            </div>
            <button className="btn primary" disabled={!canMake} onClick={() => { if (game.campaign.craft(recipe.id)) onMade(); }}>Forge</button>
          </div>
        </>
      ) : (
        <div className="forge-action">
          <div>
            <div className="fa-title">The king&apos;s armoury</div>
            <div className="fa-desc">Choose one weapon from the king&apos;s armoury. The smith will send it to storage if your pack is full.</div>
          </div>
          <button className="btn primary" onClick={() => { if (work.reward && game.campaign.chooseReward(work.reward, work.item)) onMade(); }}>Choose weapon</button>
        </div>
      )}
      {template.slot ? <p className="help-p">Base stats shown. The finished piece may carry further bonuses.</p> : null}
    </>
  );
}
