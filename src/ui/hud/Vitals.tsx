import type { Game } from '../../game/core/game';
import { xpToNext } from '../../game/player/player';
import { MASTERIES } from '../../game/aegean/mastery';
import SpritePreview from '../SpritePreview';
import { useEffect, useRef } from 'react';
import { Badge, Icon, SegBar, Ticker, uiSound } from '../kit';
import { useGameValue } from '../hooks';

/**
 * The vitals plate: portrait, name, the three bars and experience, forged as
 * one piece in the top-left corner.
 *
 * Numbers on the bars are hidden until the pointer is over the plate (or the
 * "vital numbers" setting is on): a bar you read at a glance should not also
 * ask to be read as text.
 */
export function Vitals({ game }: { game: Game }) {
  const p = game.player;
  const v = useGameValue(() => ({
    hp: Math.ceil(p.hp),
    maxHp: Math.round(p.maxHp),
    shield: Math.ceil(p.shield ?? 0),
    mp: Math.ceil(p.mp),
    maxMp: Math.round(p.maxMp),
    sp: Math.ceil(p.sp),
    maxSp: Math.round(p.maxSp),
    xp: Math.floor(p.xp),
    level: p.level,
    hull: game.naval.aboard ? Math.ceil(game.naval.vessel?.hull ?? 0) : -1,
    maxHull: game.naval.definition?.hull ?? 1,
  }), 20);
  // gear changes are rare; the portrait does not need looking at twenty times a second
  const look = useGameValue(() => JSON.stringify(p.look()), 2);
  const next = xpToNext(v.level);
  const critical = v.hp <= v.maxHp * 0.25;

  return (
    <div className={`vitals frame-plate${critical ? ' critical' : ''}${game.settings.showNumbers ? ' show-numbers' : ''}`}>
      <div className="portrait">
        <SpritePreview look={JSON.parse(look)} scale={1} className="portrait-sprite" />
        <Badge className="lvl" title={`Level ${v.level}`}>{v.level}</Badge>
      </div>
      <div className="vitals-body">
        <div className="who">
          <span className="who-name">{p.name}</span>
          <span className="who-class" style={{ color: p.classDef.color }}>{p.classDef.name}</span>
        </div>
        <div className="bars">
          <SegBar kind="hp" value={v.hp} max={v.maxHp} shield={v.shield} critical={critical} label={`${v.hp}/${v.maxHp}`} title="Health" />
          <SegBar kind="mp" value={v.mp} max={v.maxMp} label={`${v.mp}/${v.maxMp}`} title="Mana" />
          <SegBar kind="sp" value={v.sp} max={v.maxSp} label={`${v.sp}/${v.maxSp}`} title="Stamina" />
          {v.hull >= 0 ? <SegBar kind="hull" value={v.hull} max={v.maxHull} label={`Hull ${v.hull}/${v.maxHull}`} title="Hull" /> : null}
        </div>
        <SegBar kind="xp" value={v.xp} max={next} title={`Experience ${v.xp} / ${next}`} />
      </div>
    </div>
  );
}

/**
 * Money and the things waiting to be spent. Gold is a coin and a number that
 * rolls; unspent points are an ember badge that nudges until it is pressed.
 */
export function Purse({ game }: { game: Game }) {
  const p = game.player;
  const v = useGameValue(() => ({
    gold: p.gold,
    points: p.skillPoints,
    heroic: [80, 85, 90, 95, 100].filter((level) => p.level >= level
      && !MASTERIES.some((m) => m.level === level && p.flags.has(`aegean:mastery:${m.id}`))).length,
    full: game.bagFull,
    effects: [
      ...p.buffs.map((b) => ({ id: `b${b.id}`, name: b.name, color: b.color, left: Math.max(0, Math.ceil(b.until - game.now)) })),
      ...p.statuses.map((s, i) => ({ id: `s${s.kind}${i}`, name: s.kind, color: s.color, left: -1 })),
    ],
  }), 8);
  // money coming in clinks — except at the casino tables, which ring their own
  const lastGold = useRef(v.gold);
  useEffect(() => {
    const casino = game.panel === 'poker' || game.panel === 'slots' || game.panel === 'roulette';
    if (v.gold > lastGold.current && !casino) uiSound('coin');
    lastGold.current = v.gold;
  }, [v.gold, game]);

  return (
    <div className="purse">
      <span className="hud-gold" title="Gold">
        <Icon name="coin" />
        <Ticker value={v.gold} />
      </span>
      {v.points > 0 ? (
        <button className="hud-cta" onClick={() => game.setPanel('skills')} title={`${v.points} unspent skill point${v.points > 1 ? 's' : ''} — open skills`}>
          <Icon name="point" />
          <span>{v.points}</span>
        </button>
      ) : null}
      {v.heroic > 0 ? (
        <button className="hud-cta" onClick={() => game.setPanel('skills')} title={`${v.heroic} heroic talent${v.heroic > 1 ? 's' : ''} to choose`}>
          <Icon name="flame" />
          <span>{v.heroic}</span>
        </button>
      ) : null}
      {v.full ? (
        <button
          className="hud-cta warn"
          title="Your pack is full — loot on the ground will stay there. Sell or drop something."
          onClick={() => game.setPanel('inventory')}
        >
          <Icon name="bag" />
          <span>Full</span>
        </button>
      ) : null}
      {v.effects.map((e) => (
        <span className="hud-effect" key={e.id} style={{ color: e.color }}>
          {e.name}{e.left >= 0 ? <em>{e.left}s</em> : null}
        </span>
      ))}
    </div>
  );
}
