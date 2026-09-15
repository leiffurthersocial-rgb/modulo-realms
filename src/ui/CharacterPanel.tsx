import type { Game } from '../game/core/game';
import { FACTIONS, repTier } from '../data/races';
import { xpToNext } from '../game/player/player';
import { EFFECT_BY_ID } from '../game/items/effects';
import SpritePreview from './SpritePreview';

export default function CharacterPanel({ game }: { game: Game }) {
  const p = game.player;
  const s = p.stats();
  const effects = [...new Set(p.effectIds())];

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(880px, 94vw)', height: 'min(640px, 92vh)' }}>
        <div className="panel-title">
          <span>{p.name}</span>
          <span className="sub">{p.raceDef.name} {p.classDef.name} · Level {p.level}</span>
          <button className="close-x" onClick={() => game.closeAll()}>×</button>
        </div>
        <div className="char-layout">
          <div className="inv-col" style={{ alignItems: 'center', borderRight: '1px solid var(--edge)' }}>
            <SpritePreview look={p.look()} scale={4} />
            <div style={{ marginTop: 14, width: '100%' }}>
              <div className="kv"><span className="k">Experience</span><span>{Math.floor(p.xp)} / {xpToNext(p.level)}</span></div>
              <div className="kv"><span className="k">Play time</span><span>{formatTime(p.playTime)}</span></div>
              <div className="kv"><span className="k">Deaths</span><span>{p.deaths}</span></div>
              <div className="kv"><span className="k">Bosses felled</span><span>{p.bossesKilled.size}</span></div>
              <div className="kv"><span className="k">Places found</span><span>{p.discovered.size}</span></div>
              <div className="kv"><span className="k">Quests done</span><span>{game.quests.completed.length}</span></div>
            </div>
            <div className="perk" style={{ marginTop: 14, textAlign: 'center' }}>{p.raceDef.perk}</div>
          </div>

          <div className="inv-col scroll" style={{ overflowY: 'auto' }}>
            <div className="section-h">Attributes</div>
            <div className="stat-list">
              <Row k="Health" v={`${Math.ceil(p.hp)} / ${Math.round(s.maxHealth)}`} />
              <Row k="Mana" v={`${Math.ceil(p.mp)} / ${Math.round(s.maxMana)}`} />
              <Row k="Stamina" v={`${Math.ceil(p.sp)} / ${Math.round(s.maxStamina)}`} />
              <Row k="Strength" v={s.strength} />
              <Row k="Dexterity" v={s.dexterity} />
              <Row k="Intelligence" v={s.intelligence} />
              <Row k="Vitality" v={s.vitality} />
              <Row k="Defense" v={s.defense} />
              <Row k="Critical chance" v={`${s.critChance.toFixed(1)}%`} />
              <Row k="Critical damage" v={`+${s.critDamage.toFixed(0)}%`} />
              <Row k="Ability power" v={`+${s.abilityPower.toFixed(0)}%`} />
              <Row k="Cooldown reduction" v={`${s.cooldownReduction.toFixed(0)}%`} />
              <Row k="Life steal" v={`${s.lifesteal.toFixed(1)}%`} />
              <Row k="Magic find" v={`+${s.magicFind.toFixed(0)}%`} />
              <Row k="Move speed" v={Math.round(s.moveSpeed)} />
            </div>

            {effects.length ? (
              <>
                <div className="section-h">Equipment effects</div>
                {effects.map((id) => {
                  const e = EFFECT_BY_ID[id];
                  if (!e) return null;
                  return (
                    <div className="ic-effect" key={id} style={{ borderLeftColor: e.color, marginBottom: 7 }}>
                      <strong style={{ color: e.color }}>{e.name}</strong> — {e.desc}
                    </div>
                  );
                })}
              </>
            ) : null}

            <div className="section-h">Reputation</div>
            {FACTIONS.map((f) => {
              const v = p.rep(f.id);
              const tier = repTier(v);
              return (
                <div className="rep-row" key={f.id}>
                  <span className="rname" style={{ color: f.color }}>{f.name}</span>
                  <span className="rep-bar">
                    <span
                      className="rfill"
                      style={{
                        background: tier.color,
                        left: v >= 0 ? '50%' : `${50 + v / 2}%`,
                        width: `${Math.abs(v) / 2}%`,
                      }}
                    />
                  </span>
                  <span className="rlabel" style={{ color: tier.color }}>{tier.label}</span>
                </div>
              );
            })}
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>
              Reputation shifts shop prices, unlocks dialogue, and decides who will hand you work.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return <div className="stat-row"><span>{k}</span><span className="v">{v}</span></div>;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
