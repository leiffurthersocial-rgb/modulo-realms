import { AEGEAN_SHIPS } from '../data/aegean/content';
import { nextShipStep, shipGuidanceTarget } from '../game/aegean/guidance';
import { aegeanName } from './aegeanNames';
import { useEffect, useState } from 'react';
import type { Game } from '../game/core/game';
import { getIconUrl } from '../game/art/icons';
import { QUEST_BY_ID } from '../data/quests';
import { xpToNext } from '../game/player/player';
import SpritePreview from './SpritePreview';
import { MASTERIES } from '../game/aegean/mastery';

/** Cheap ticker so the HUD refreshes without re-rendering the whole tree every frame. */
function useTicker(hz = 15): number {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((v) => v + 1), 1000 / hz);
    return () => window.clearInterval(id);
  }, [hz]);
  return 0;
}

export default function Hud({ game }: { game: Game }) {
  useTicker(15);
  const p = game.player;
  if (!p) return null;
  const stats = p.stats();
  const component = game.campaign.state.trackedComponent;
  const shipStep = component ? nextShipStep(game, component) : null;
  const nextPart = component && !shipStep ? AEGEAN_SHIPS.find(s => s.id === 'aegean_stormbreaker')?.requirements.find(id => !game.campaign.has(id)) : undefined;
  const shipTarget = component ? shipGuidanceTarget(game) : null;
  const landing = game.naval.landingGuide();
  const useKey = game.input.touchMode ? 'USE' : game.input.keyLabel('interact');
  const abilities = p.classDef.abilities;
  const quick = p.inventory.find((i) => i.type === 'consumable' && (p.quickItem ? i.defId === p.quickItem : true))
    ?? p.inventory.find((i) => i.type === 'consumable');

  const fieldQuest = game.trackedQuest && QUEST_BY_ID[game.trackedQuest]?.fieldAdventure
    ? game.quests.get(game.trackedQuest) : undefined;
  const tracked = fieldQuest
    ? [fieldQuest, ...game.quests.active.filter(q => q.id !== fieldQuest.id)].slice(0, 3)
    : game.quests.active.slice(0, game.inAegean ? 1 : 3);
  const heroicChoices = [80, 85, 90, 95, 100].filter((level) => p.level >= level && !MASTERIES.some((m) => m.level === level && p.flags.has(`aegean:mastery:${m.id}`))).length;

  return (
    <div className="hud">
      <div className="hud-left">
        <div className="vitals">
          <div className="portrait">
            <SpritePreview look={p.look()} scale={1.5} />
            <span className="lvl">{p.level}</span>
          </div>
          <div className="vitals-body">
            <div className="who">
              <span className="who-name">{p.name}</span>
              <span className="who-class" style={{ color: p.classDef.color }}>{p.classDef.name}</span>
            </div>
            <div className="bars">
              <Bar cls="hp" value={p.hp} max={p.maxHp} label={`${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`} shield={p.shield} />
              <Bar cls="mp" value={p.mp} max={p.maxMp} label={`${Math.ceil(p.mp)} / ${Math.round(p.maxMp)}`} />
              <Bar cls="sp" value={p.sp} max={p.maxSp} label={`${Math.ceil(p.sp)} / ${Math.round(p.maxSp)}`} />
              {game.naval.aboard ? <Bar cls="hp" value={game.naval.vessel?.hull ?? 0} max={game.naval.definition?.hull ?? 1} label={`Hull ${Math.ceil(game.naval.vessel?.hull ?? 0)} / ${game.naval.definition?.hull ?? 0}`} /> : null}
            </div>
            <div className="xp-row">
              <Bar cls="xp" value={p.xp} max={xpToNext(p.level)} label="" />
              <span className="xp-text">{Math.round((p.xp / Math.max(1, xpToNext(p.level))) * 100)}%</span>
            </div>
          </div>
        </div>
        <div className="chip-row">
          <div className="chip gold">
            <img src={getIconUrl('gold')} alt="" />
            {p.gold.toLocaleString()}
          </div>
          {heroicChoices > 0 ? (
            <button className="chip action" onClick={() => game.setPanel('skills')}><span className="chip-dot" />{heroicChoices} heroic talent{heroicChoices > 1 ? 's' : ''}</button>
          ) : null}
          {p.skillPoints > 0 ? (
            <button className="chip action" onClick={() => game.setPanel('skills')}>
              <span className="chip-dot" />
              {p.skillPoints} skill point{p.skillPoints > 1 ? 's' : ''}
            </button>
          ) : null}
          {game.bagFull ? (
            <button
              className="chip warn"
              title="Your pack is full — loot on the ground will stay there. Sell or drop something."
              onClick={() => game.setPanel('inventory')}
            >
              <span className="chip-dot" />
              Pack full
            </button>
          ) : null}
          {p.buffs.map((b) => (
            <span className="chip effect" key={b.id} style={{ color: b.color, borderColor: `${b.color}66` }}>
              {b.name} <em>{Math.max(0, Math.ceil(b.until - game.now))}s</em>
            </span>
          ))}
          {p.statuses.map((s, i) => (
            <span className="chip effect" key={`${s.kind}${i}`} style={{ color: s.color, borderColor: `${s.color}66` }}>
              {s.kind}
            </span>
          ))}
        </div>
      </div>

      {game.aegeanHazards.warning ? <div className="aegean-danger-cue" role="status">⚠ {game.aegeanHazards.warning}</div> : null}
      {game.bossTarget && !game.bossTarget.dead ? (
        <div className={`boss-bar${game.bossTarget.warded ? ' warded' : ''}`}>
          <div className="bname">{game.bossTarget.def.name}</div>
          <div className="btitle">{game.bossTarget.def.boss?.title}</div>
          <div className="bar">
            <div className="fill" style={{ width: `${Math.max(0, (game.bossTarget.hp / game.bossTarget.maxHp) * 100)}%` }} />
            <span className="label">{Math.ceil(game.bossTarget.hp)} / {game.bossTarget.maxHp}</span>
          </div>
          {game.bossTarget.warded ? (
            <div className="boss-ward">{game.bossTarget.immuneLabel || 'Immune'}</div>
          ) : null}
          <div className="boss-phases">
            {game.bossTarget.def.boss?.phases.map((_, i) => (
              <span key={i} className={i <= game.bossTarget!.phase ? 'on' : ''} />
            ))}
          </div>
        </div>
      ) : null}

      {tracked.length || component || game.encounters.active || game.naval.aboard ? (
        <div className="quest-tracker">
          {component ? <div className="next-action-card">
            <strong>{aegeanName(component)}</strong>
            <div>{shipStep?.action ?? (nextPart ? '✓ Part ready' : '✓ All parts ready — return to the shipwright')}</div>
            {nextPart ? <button className="next-part" onClick={() => game.campaign.trackComponent(nextPart)}>Guide next part →</button> : null}
            {shipTarget ? <small>→ {shipTarget.name} · {Math.round(Math.hypot(shipTarget.x - p.x, shipTarget.y - p.y) / 32)}m</small> : null}
            <button aria-label="Stop component guidance" onClick={() => game.campaign.trackComponent()}>×</button>
          </div> : null}
          {game.naval.aboard ? (
            <div style={{ marginBottom: 8 }}>
              <h4>{game.naval.definition?.name}</h4>
              <div className="qname">{game.naval.dangerLabel}</div>

              {landing ? <div className="obj">{landing.inRange
                ? landing.reason ?? `${useKey} — Land at ${landing.port.name}`
                : `${landing.port.name} · ${landing.direction} · ${Math.round(landing.distance / 32)}m`}</div> : null}
              <div className="obj">R — Fight boarders on deck</div>
            </div>
          ) : null}
          {game.encounters.active ? (
            <div style={{ marginBottom: 8 }}>
              <div className="qname">{game.encounters.objective}</div>
              <div className="obj">{game.encounters.status}</div>
            </div>
          ) : null}
          {tracked.length && !game.encounters.active && !component ? <h4>Next adventure</h4> : null}
          {(!game.encounters.active && !component ? tracked : []).map((aq) => {
            const def = QUEST_BY_ID[aq.id];
            if (!def) return null;
            return (
              <div key={aq.id} style={{ marginBottom: 8 }}>
                <div className="qname">{def.name}</div>
                {def.objectives.map((o, i) => {
                  const cur = game.quests.objectiveCount(def, aq, i, p);
                  const target = game.quests.objectiveTarget(o);
                  const done = cur >= target;
                  return (
                    <div className={`obj ${done ? 'done' : ''}`} key={i}>
                      <span>{o.label}</span>
                      <span>{target > 1 ? `${cur}/${target}` : done ? 'done' : ''}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}

      {game.inAegean && game.campaign.state.receipts?.[0] ? <button className="recent-reward" onClick={() => game.setPanel('quests')} title={game.campaign.state.receipts[0].lines.join(' · ')}>Earned · {game.campaign.state.receipts[0].lines[1] ?? game.campaign.state.receipts[0].lines[0]} ›</button> : null}
      <div className="toasts">
        {game.toasts.map((t) => (
          <div className="toast" key={t.id} style={{ borderLeftColor: t.color, opacity: t.t > 5 ? 0.3 : 1 }}>
            {t.icon ? <img src={getIconUrl(t.icon as 'gold')} alt="" /> : null}
            <div>
              <div className="t-title" style={{ color: t.color }}>{t.title}</div>
              {t.sub ? <div className="t-sub">{t.sub}</div> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="hud-abilities">
        <button className="slot weapon" title="Attack (Space)" onClick={() => game.basicAttack(false)}>
          <span className="key">SPC</span>
          {p.equipment.mainHand ? (
            <img src={getIconUrl(p.equipment.mainHand.icon, { metal: p.equipment.mainHand.iconMetal, glow: p.equipment.mainHand.glow })} alt="" />
          ) : <span style={{ fontSize: 10, color: 'var(--muted)' }}>fists</span>}
        </button>
        {abilities.map((a, i) => {
          const locked = p.level < a.level;
          const cd = p.cooldowns[a.id] ?? 0;
          return (
            <button
              key={a.id}
              className={`slot ${locked ? 'locked' : cd <= 0 ? 'ready' : ''}`}
              title={locked ? `${a.name} — unlocks at level ${a.level}` : `${a.name}: ${a.desc}`}
              onClick={() => !locked && game.useAbility(i)}
            >
              <span className="key">{i + 1}</span>
              <img src={getIconUrl(a.icon as 'sword')} alt="" style={{ filter: locked ? 'grayscale(1)' : `drop-shadow(0 0 4px ${a.color}66)` }} />
              {cd > 0 ? <span className="cd">{cd.toFixed(cd < 1 ? 1 : 0)}</span> : null}
              {locked ? <span className="cd" style={{ fontSize: 10 }}>Lv {a.level}</span> : null}
            </button>
          );
        })}
        {(() => {
          // A shield never uses offhandCooldown at all — it is held to block,
          // not triggered — so a countdown left over from whatever was in
          // this slot before must not bleed onto it after a swap.
          const isShield = p.equipment.offHand?.weaponKind === 'shield';
          const cd = isShield&&!p.equipment.offHand?.aegeanPower ? 0 : p.offhandCooldown;
          return (
            <button
              className={`slot ${p.equipment.offHand ? (cd <= 0 ? 'ready' : '') : 'locked'}`}
              title={p.equipment.offHand ? `${p.equipment.offHand.name} (F)` : 'No off-hand (F uses a potion)'}
              onClick={() => game.useOffhand()}
            >
              <span className="key">F</span>
              {p.equipment.offHand ? (
                <img src={getIconUrl(p.equipment.offHand.icon, { metal: p.equipment.offHand.iconMetal, glow: p.equipment.offHand.glow })} alt="" />
              ) : <span style={{ fontSize: 10, color: 'var(--muted)' }}>off</span>}
              {p.blocking
                ? <span className="cd" style={{ fontSize: 10 }}>BLOCK</span>
                : cd > 0
                ? <span className="cd">{cd.toFixed(cd < 1 ? 1 : 0)}</span>
                : null}
            </button>
          );
        })()}
        {p.equipment.mainHand?.weaponPower ? (
          <button
            className={`slot ${p.weaponPowerCooldown > 0 ? '' : 'ready'}`}
            title={`${p.equipment.mainHand.weaponPower.name} (V) — ${p.equipment.mainHand.weaponPower.desc}`}
            onClick={() => game.useWeaponPower()}
          >
            <span className="key">V</span>
            <img
              src={getIconUrl(p.equipment.mainHand.icon, { metal: p.equipment.mainHand.iconMetal, glow: p.equipment.mainHand.glow })}
              alt=""
              style={{ filter: `drop-shadow(0 0 5px ${p.equipment.mainHand.glow ?? '#fff'}aa)` }}
            />
            {p.weaponPowerCooldown > 0
              ? <span className="cd">{p.weaponPowerCooldown.toFixed(p.weaponPowerCooldown < 1 ? 1 : 0)}</span>
              : null}
          </button>
        ) : null}
        <button
          className={`slot ${(game.naval.aboard||p.equipment.accessory?.artifact) ? 'ready' : 'locked'}`}
          title={game.naval.aboard?'Fight boarders on deck (R)':p.equipment.accessory?.artifact ? `${p.equipment.accessory.artifact.name} (R) — ${p.equipment.accessory.artifact.desc}` : 'No artifact equipped'}
          onClick={() => game.naval.aboard?game.naval.enterDeck():game.useArtifact()}
        >
          <span className="key">R</span>
          {p.equipment.accessory ? (
            <img src={getIconUrl(p.equipment.accessory.icon, { metal: p.equipment.accessory.iconMetal, glow: p.equipment.accessory.glow })} alt="" />
          ) : <span style={{ fontSize: 10, color: 'var(--muted)' }}>art</span>}
          {p.artifactCooldown > 0 ? <span className="cd">{p.artifactCooldown.toFixed(p.artifactCooldown < 1 ? 1 : 0)}</span> : null}
        </button>
        <button className="slot ready" title="Quick potion (Q)" onClick={() => game.useQuickItem()}>
          <span className="key">Q</span>
          {quick ? (
            <>
              <img src={getIconUrl(quick.icon, { metal: quick.iconMetal })} alt="" />
              <span className="qty">{quick.qty}</span>
            </>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>empty</span>
          )}
        </button>
      </div>

      <div className="hud-hint">
        <div><kbd>WASD</kbd> move · <kbd>Space</kbd> attack · <kbd>G</kbd> heavy · <kbd>Shift</kbd> dodge</div>
        <div><kbd>E</kbd> interact · <kbd>I</kbd> bag · <kbd>M</kbd> map · <kbd>J</kbd> journal · <kbd>P</kbd> pause</div>
        <div style={{ color: '#6d6478' }}>{game.map.name} · {game.timeLabel} · Armour {Math.round(stats.defense)}</div>
      </div>
    </div>
  );
}

function Bar({ cls, value, max, label, shield }: { cls: string; value: number; max: number; label: string; shield?: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const shieldPct = shield ? Math.min(100 - pct, (shield / Math.max(1, max)) * 100) : 0;
  // A health bar under a quarter reads as an emergency, so it says so.
  const critical = cls === 'hp' && pct <= 25;
  return (
    <div className={`bar ${cls}${critical ? ' critical' : ''}`}>
      <div className="fill" style={{ width: `${pct}%` }} />
      {shieldPct > 0 ? <div className="shield" style={{ left: `${pct}%`, width: `${shieldPct}%` }} /> : null}
      <span className="ticks" />
      {label ? <span className="label">{label}</span> : null}
    </div>
  );
}
