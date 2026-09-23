import { AEGEAN_SHIPS } from '../data/aegean/content';
import { nextShipStep, shipGuidanceTarget } from '../game/aegean/guidance';
import { aegeanName } from './aegeanNames';
import type { Game } from '../game/core/game';
import { getIconUrl } from '../game/art/icons';
import { QUEST_BY_ID } from '../data/quests';
import { Icon, KeyCap, SegBar } from './kit';
import { useGameValue, useTicker } from './hooks';
import { Purse, Vitals } from './hud/Vitals';
import Hotbar from './hud/Hotbar';
import Minimap from './hud/Minimap';
import Banners from './hud/Banners';

/**
 * The heads-up display. Each piece polls the game on its own clock and only
 * re-renders when what it shows has changed (see `useGameValue`), so an idle
 * HUD costs no React work and a fight only touches the bars that moved.
 */
export default function Hud({ game }: { game: Game }) {
  if (!game.player) return null;
  return (
    <div className="hud">
      <div className="hud-left">
        <Vitals game={game} />
        <Purse game={game} />
        <Toasts game={game} />
      </div>
      <DangerCue game={game} />
      <BossBar game={game} />
      <div className="hud-right">
        <Minimap game={game} />
        <Tracker game={game} />
      </div>
      <RecentReward game={game} />
      <Hotbar game={game} />
      <FirstSteps game={game} />
      <Banners game={game} />
    </div>
  );
}

function DangerCue({ game }: { game: Game }) {
  const warning = useGameValue(() => game.aegeanHazards.warning ?? '', 6);
  if (!warning) return null;
  return <div className="aegean-danger-cue" role="status">⚠ {warning}</div>;
}

function BossBar({ game }: { game: Game }) {
  const b = useGameValue(() => {
    const t = game.bossTarget;
    if (!t || t.dead) return null;
    return {
      name: t.def.name,
      title: t.def.boss?.title ?? '',
      hp: Math.ceil(t.hp),
      max: t.maxHp,
      warded: !!t.warded,
      ward: t.immuneLabel || 'Immune',
      phase: t.phase,
      phases: t.def.boss?.phases.length ?? 0,
    };
  }, 15);
  if (!b) return null;
  return (
    <div className={`boss-bar${b.warded ? ' warded' : ''}`}>
      <div className="bname">{b.name}</div>
      {b.title ? <div className="btitle">{b.title}</div> : null}
      <SegBar kind="boss" value={b.hp} max={b.max} label={`${b.hp}/${b.max}`} className="show-label" />
      {b.warded ? <div className="boss-ward">{b.ward}</div> : null}
      <div className="boss-phases">
        {Array.from({ length: b.phases }).map((_, i) => <span key={i} className={i <= b.phase ? 'on' : ''} />)}
      </div>
    </div>
  );
}

function Tracker({ game }: { game: Game }) {
  // The tracker reads a lot of campaign state; four refreshes a second is
  // plenty for words that change when you finish a step.
  useTicker(4);
  const p = game.player;
  const component = game.campaign.state.trackedComponent;
  const shipStep = component ? nextShipStep(game, component) : null;
  const nextPart = component && !shipStep ? AEGEAN_SHIPS.find(s => s.id === 'aegean_stormbreaker')?.requirements.find(id => !game.campaign.has(id)) : undefined;
  const shipTarget = component ? shipGuidanceTarget(game) : null;
  const landing = game.naval.landingGuide();
  const useKey = game.input.touchMode ? 'USE' : game.input.keyLabel('interact');
  const fieldQuest = game.trackedQuest && QUEST_BY_ID[game.trackedQuest]?.fieldAdventure
    ? game.quests.get(game.trackedQuest) : undefined;
  const tracked = fieldQuest
    ? [fieldQuest, ...game.quests.active.filter(q => q.id !== fieldQuest.id)].slice(0, 3)
    : game.quests.active.slice(0, game.inAegean ? 1 : 3);

  if (!(tracked.length || component || game.encounters.active || game.naval.aboard)) return null;
  return (
    <div className="quest-tracker frame-ash">
      {component ? <div className="next-action-card">
        <strong>{aegeanName(component)}</strong>
        <div>{shipStep?.action ?? (nextPart ? '✓ Part ready' : '✓ All parts ready — return to the shipwright')}</div>
        {nextPart ? <button className="next-part" onClick={() => game.campaign.trackComponent(nextPart)}>Guide next part →</button> : null}
        {shipTarget ? <small>→ {shipTarget.name} · {Math.round(Math.hypot(shipTarget.x - p.x, shipTarget.y - p.y) / 32)}m</small> : null}
        <button className="nac-close" aria-label="Stop component guidance" onClick={() => game.campaign.trackComponent()}><Icon name="close" /></button>
      </div> : null}
      {game.naval.aboard ? (
        <div className="qt-block">
          <h4>{game.naval.definition?.name}</h4>
          <div className="qname">{game.naval.dangerLabel}</div>
          {landing ? <div className="obj">{landing.inRange
            ? landing.reason ?? `${useKey} — Land at ${landing.port.name}`
            : `${landing.port.name} · ${landing.direction} · ${Math.round(landing.distance / 32)}m`}</div> : null}
          <div className="obj"><span><KeyCap>R</KeyCap> fight boarders on deck</span></div>
        </div>
      ) : null}
      {game.encounters.active ? (
        <div className="qt-block">
          <div className="qname">{game.encounters.objective}</div>
          <div className="obj">{game.encounters.status}</div>
        </div>
      ) : null}
      {tracked.length && !game.encounters.active && !component ? <h4>Next adventure</h4> : null}
      {(!game.encounters.active && !component ? tracked : []).map((aq) => {
        const def = QUEST_BY_ID[aq.id];
        if (!def) return null;
        return (
          <div key={aq.id} className="qt-block">
            <div className="qname">{def.name}</div>
            {def.objectives.map((o, i) => {
              const cur = game.quests.objectiveCount(def, aq, i, p);
              const target = game.quests.objectiveTarget(o);
              const done = cur >= target;
              return (
                <div className={`obj ${done ? 'done' : ''}`} key={i}>
                  <span><i className={`obj-dot ${done ? 'on' : ''}`} />{o.label}</span>
                  <span>{target > 1 ? `${cur}/${target}` : ''}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function RecentReward({ game }: { game: Game }) {
  const r = useGameValue(() => {
    const receipt = game.inAegean ? game.campaign.state.receipts?.[0] : undefined;
    return receipt ? { line: receipt.lines[1] ?? receipt.lines[0], all: receipt.lines.join(' · ') } : null;
  }, 2);
  if (!r) return null;
  return (
    <button className="recent-reward" onClick={() => game.setPanel('quests')} title={r.all}>
      Earned · {r.line} ›
    </button>
  );
}

function Toasts({ game }: { game: Game }) {
  const toasts = useGameValue(() => game.toasts.map((t) => ({
    id: t.id, title: t.title, sub: t.sub ?? '', color: t.color, icon: t.icon ?? '', fading: t.t > 5,
  })), 8);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div className={`toast frame-ash${t.fading ? ' fading' : ''}`} key={t.id} style={{ ['--toast' as string]: t.color }}>
          {t.icon ? <img src={getIconUrl(t.icon as 'gold')} alt="" /> : null}
          <div>
            <div className="t-title" style={{ color: t.color }}>{t.title}</div>
            {t.sub ? <div className="t-sub">{t.sub}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The controls, shown only while a character is brand new. The old HUD kept
 * a block of key hints in the corner for good; after the first few minutes
 * the prompts over doors and people and the How to Play page do that job.
 */
function FirstSteps({ game }: { game: Game }) {
  const show = useGameValue(() => game.player.playTime < 180 && !game.input.touchMode && !game.uiOpen, 1);
  if (!show) return null;
  const k = (a: Parameters<typeof game.input.keyLabel>[0]) => {
    const l = game.input.keyLabel(a);
    return l === 'Space' ? 'SPC' : l;
  };
  return (
    <div className="first-steps frame-ash" role="note">
      <div><span><KeyCap>W</KeyCap><KeyCap>A</KeyCap><KeyCap>S</KeyCap><KeyCap>D</KeyCap></span> move</div>
      <div><KeyCap>{k('attack')}</KeyCap> attack · <KeyCap>{k('heavy')}</KeyCap> heavy</div>
      <div><KeyCap>{k('dash')}</KeyCap> dodge · <KeyCap>{k('interact')}</KeyCap> use</div>
      <div><KeyCap>{k('inventory')}</KeyCap> pack · <KeyCap>{k('map')}</KeyCap> map</div>
      <div><KeyCap>ESC</KeyCap> menu &amp; how to play</div>
    </div>
  );
}
