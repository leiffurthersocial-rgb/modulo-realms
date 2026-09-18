import { useMemo, useState } from 'react';
import type { Game } from '../game/core/game';
import { ALL_TEMPLATES, type ItemTemplate } from '../data/items';
import { LOCATIONS } from '../data/locations';
import { MAX_LEVEL } from '../game/player/player';
import { RARITY_LABEL, type Rarity } from '../game/items/types';
import { rarityColor } from './ItemCard';
import { getIconUrl } from '../game/art/icons';

/**
 * The debug menu, reachable only by a character named "debug".
 *
 * It exists to answer the questions that are otherwise a two-hour play
 * session each: what does this weapon feel like at level 60, does that
 * off-hand work, is this boss beatable in the gear you would actually have.
 * So the bar for every control here is that it takes one click and does not
 * need a reload.
 */

const TABS = ['Items', 'Character', 'World'] as const;
type Tab = typeof TABS[number];

const TYPES: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Everything' },
  { id: 'weapon', label: 'Weapons' },
  { id: 'armor', label: 'Armour' },
  { id: 'accessory', label: 'Trinkets' },
  { id: 'consumable', label: 'Consumables' },
  { id: 'material', label: 'Materials' },
  { id: 'quest', label: 'Quest' },
];

const RARITIES: Array<Rarity | 'template'> = ['template', 'common', 'rare', 'superRare', 'epic', 'legendary', 'mythic'];

export default function DebugPanel({ game }: { game: Game }) {
  const p = game.player;
  const [tab, setTab] = useState<Tab>('Items');

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(1040px, 97vw)', height: 'min(720px, 94vh)' }}>
        <div className="panel-title">
          <span>Debug</span>
          <span className="sub">
            {p.name} &middot; level {p.level} {p.classDef.name} &middot; {p.gold.toLocaleString()} gold
            {game.godMode ? ' · GOD MODE' : ''}
          </span>
          <button className="close-x" onClick={() => game.closeAll()}>&times;</button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '10px 14px 0' }}>
          {TABS.map((t) => (
            <button key={t} className={`filter-chip ${t === tab ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        {tab === 'Items' ? <ItemsTab game={game} /> : null}
        {tab === 'Character' ? <CharacterTab game={game} /> : null}
        {tab === 'World' ? <WorldTab game={game} /> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

function ItemsTab({ game }: { game: Game }) {
  const p = game.player;
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [level, setLevel] = useState(p.level);
  const [rarity, setRarity] = useState<Rarity | 'template'>('template');
  const [qty, setQty] = useState(1);

  const rolled = rarity === 'template' ? undefined : rarity;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ALL_TEMPLATES.filter((t) => {
      if (type !== 'all' && t.type !== type) return false;
      if (!needle) return true;
      return t.name.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle);
    });
  }, [q, type]);

  const give = (t: ItemTemplate) => game.debugGive(t.id, { level, rarity: rolled, qty });

  return (
    <div className="inv-col" style={{ flex: 1, minHeight: 0, gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="name-input"
          style={{ flex: 1, minWidth: 180, margin: 0 }}
          placeholder="Search every item by name or id..."
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
        />
        <Num label="Level" value={level} min={1} max={MAX_LEVEL} onChange={setLevel} />
        <button className="btn small" onClick={() => setLevel(p.level)} title="Match the character's level">Mine</button>
        <button className="btn small" onClick={() => setLevel(MAX_LEVEL)}>Max</button>
        <Num label="Qty" value={qty} min={1} max={99} onChange={setQty} />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TYPES.map((t) => (
          <button key={t.id} className={`filter-chip ${t.id === type ? 'active' : ''}`} onClick={() => setType(t.id)}>{t.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 2 }}>Rarity</span>
        {RARITIES.map((r) => (
          <button
            key={r}
            className={`filter-chip ${r === rarity ? 'active' : ''}`}
            style={{ color: r === 'template' ? undefined : rarityColor(r as Rarity) }}
            onClick={() => setRarity(r)}
            title={r === 'template' ? "The item's own rarity, as written" : undefined}
          >
            {r === 'template' ? 'As written' : RARITY_LABEL[r as Rarity]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{shown.length} shown</span>
        <button
          className="btn small"
          onClick={() => game.debugGiveAll((t) => shown.some((s) => s.id === t.id), level, rolled)}
        >
          Give all shown
        </button>
        <button className="btn small" onClick={() => game.debugGiveAll((t) => t.type === 'weapon', level, rolled)}>
          Give every weapon
        </button>
        <button className="btn small" onClick={() => game.debugGiveAll((t) => t.slot === 'offHand', level, rolled)}>
          Give every off-hand
        </button>
      </div>

      <div className="shop-list scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {shown.map((t) => (
          <div className="shop-row" key={t.id}>
            <img src={getIconUrl(t.icon, { metal: t.metal, glow: t.glow })} alt="" />
            <div className="sr-name" style={{ color: rarityColor(rolled ?? t.rarity) }}>
              {t.name}
              <div className="sr-meta">
                {t.id} &middot; {t.type}{t.slot ? ` · ${t.slot}` : ''} &middot; written at level {t.level}
              </div>
            </div>
            <span style={{ display: 'flex', gap: 6 }}>
              {t.slot ? (
                <button className="btn small" onClick={() => game.debugEquip(t.id, { level, rarity: rolled })}>Equip</button>
              ) : null}
              <button className="btn small primary" onClick={() => give(t)}>Add</button>
            </span>
          </div>
        ))}
        {shown.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12.5 }}>Nothing matches that.</div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Character                                                           */
/* ------------------------------------------------------------------ */

function CharacterTab({ game }: { game: Game }) {
  const p = game.player;
  // The level slider is the one control with its own pending value, because
  // dragging it should not re-level the character on every frame. Gold and
  // points write straight through: a box that holds a stale copy of a number
  // the rest of the menu is busy changing is how you wipe your own points.
  const [level, setLevel] = useState(p.level);
  const spent = Object.values(p.skills).reduce((n, v) => n + v, 0);
  const jump = (n: number) => { setLevel(n); game.debugSetLevel(n); };

  return (
    <div className="inv-col scroll" style={{ flex: 1, overflowY: 'auto', gap: 4 }}>
      <div className="section-h">Level &mdash; currently {p.level}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="range"
          min={1}
          max={MAX_LEVEL}
          value={level}
          style={{ flex: 1, minWidth: 220 }}
          onChange={(e) => setLevel(Number(e.target.value))}
        />
        <Num label="" value={level} min={1} max={MAX_LEVEL} onChange={setLevel} />
        <button className="btn small primary" onClick={() => game.debugSetLevel(level)}>Set level</button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {[1, 5, 10, 20, 30, 40, 50, 60, 75].map((n) => (
          <button key={n} className="filter-chip" onClick={() => jump(n)}>{n}</button>
        ))}
        <button className="filter-chip" onClick={() => jump(Math.min(MAX_LEVEL, p.level + 1))}>+1</button>
        <button className="filter-chip" onClick={() => jump(Math.min(MAX_LEVEL, p.level + 10))}>+10</button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.7 }}>
        Skill points are re-derived from the level, so going down and back up does not leave spares behind.
        Points already spent stay spent &mdash; {spent} so far.
      </div>

      <div className="section-h">Purse and points</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Num
          label="Gold"
          value={p.gold}
          min={0}
          max={99999999}
          step={1000}
          onChange={(n) => { p.gold = Math.max(0, Math.round(n)); game.touch(); }}
        />
        {[1000, 10000, 100000, 1000000].map((n) => (
          <button key={n} className="filter-chip" onClick={() => { p.gold += n; game.touch(); }}>+{n.toLocaleString()}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <Num
          label="Skill points"
          value={p.skillPoints}
          min={0}
          max={999}
          onChange={(n) => { p.skillPoints = Math.max(0, Math.round(n)); game.touch(); }}
        />
        <button
          className="btn small"
          onClick={() => { p.skillPoints += spent; p.skills = {}; game.touch(); }}
          title="Unspend every point, keeping the total"
        >
          Refund every point ({spent})
        </button>
      </div>

      <div className="section-h">In the fight</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className={`btn small ${game.godMode ? 'primary' : ''}`}
          onClick={() => { game.godMode = !game.godMode; game.toast('Debug', `God mode ${game.godMode ? 'on' : 'off'}.`, '#9578e8'); game.touch(); }}
        >
          God mode: {game.godMode ? 'on' : 'off'}
        </button>
        <button className="btn small" onClick={() => game.debugRestore()}>Full restore</button>
        <button className="btn small" onClick={() => game.debugKillNearby()}>Kill everything nearby</button>
        <button
          className={`btn small ${game.debug ? 'primary' : ''}`}
          onClick={() => { game.debug = !game.debug; game.touch(); }}
        >
          Overlay: {game.debug ? 'on' : 'off'}
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.7 }}>
        Full restore also clears every cooldown and stands you back up if you are dead.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* World                                                               */
/* ------------------------------------------------------------------ */

function WorldTab({ game }: { game: Game }) {
  const p = game.player;
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const places = LOCATIONS.filter((l) => !needle || l.name.toLowerCase().includes(needle));

  return (
    <div className="inv-col" style={{ flex: 1, minHeight: 0, gap: 4 }}>
      <div className="section-h">Time</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Day {game.day} &middot; {game.timeLabel}</span>
        <button className="filter-chip" onClick={() => game.debugSetHour(6)}>Dawn</button>
        <button className="filter-chip" onClick={() => game.debugSetHour(12)}>Noon</button>
        <button className="filter-chip" onClick={() => game.debugSetHour(19)}>Dusk</button>
        <button className="filter-chip" onClick={() => game.debugSetHour(0)}>Midnight</button>
        <button className="filter-chip" onClick={() => { game.day += 1; game.restockShops(); game.touch(); }}>+1 day (restocks)</button>
      </div>

      <div className="section-h">The map</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn small" onClick={() => game.debugRevealWorld()}>Attune every waystone</button>
        <button className="btn small" onClick={() => game.setPanel('travel')}>Open travel</button>
        <span style={{ fontSize: 11.5, color: 'var(--muted)', alignSelf: 'center' }}>
          {p.waystones.size} attuned &middot; {p.discovered.size} found &middot; {p.bossesKilled.size} bosses down
        </span>
      </div>

      <div className="section-h">Go somewhere</div>
      <input
        className="name-input"
        style={{ margin: 0 }}
        placeholder="Filter places..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="shop-list scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginTop: 8 }}>
        {places.map((l) => (
          <div className="shop-row" key={l.id}>
            <div className="sr-name">
              {l.name}
              <div className="sr-meta">
                {l.region}{l.dungeon ? ` · dungeon, level ${l.dungeon.level}` : ''} &middot; {l.tx}, {l.ty}
              </div>
            </div>
            <button
              className="btn small primary"
              onClick={() => {
                p.discovered.add(l.id);
                game.closeAll();
                game.travel('overworld', l.tx * 32, l.ty * 32, l.name);
              }}
            >
              Go
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Num({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)' }}>
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        style={{
          width: 84, padding: '5px 7px', fontSize: 12, fontFamily: 'inherit',
          background: 'var(--panel-3)', color: 'var(--parchment)',
          border: '1px solid var(--edge)', borderRadius: 2,
        }}
      />
    </label>
  );
}
