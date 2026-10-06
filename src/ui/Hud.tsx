import { AEGEAN_SHIPS } from '../data/aegean/content';
import { nextShipStep, shipGuidanceTarget } from '../game/aegean/guidance';
import { aegeanName } from './aegeanNames';
import type { Game, MainStoryState } from '../game/core/game';
import { MAIN_REPORT } from '../data/mainquest';
import { NPC_BY_ID } from '../data/npcs';
import { xpToNext } from '../game/player/player';
import { getIconUrl } from '../game/art/icons';
import { QUEST_BY_ID, type Objective } from '../data/quests';
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
      <TrainingCard game={game} />
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
  // In the west the main story has its own block at the top; the list under
  // it is what you do in the meantime.
  // During the training the card at the top is the only instruction.
  if (game.training) return null;
  const story = !game.inAegean ? game.mainStoryState() : null;
  // A bounty that asks for exactly what the current chapter asks for (clear
  // Whisperwell twice over) is the same job: it still pays, it just is not
  // printed a second time.
  const chapter = story && story.kind !== 'done' && story.kind !== 'level' ? story.def : undefined;
  const covered = (id: string) => {
    const def = QUEST_BY_ID[id];
    return !!chapter && !!def && def.objectives.every((o) => chapter.objectives.some((c) => objectiveKey(c) === objectiveKey(o)));
  };
  const side = story ? game.quests.active.filter(q => !QUEST_BY_ID[q.id]?.main && !covered(q.id)) : game.quests.active;
  const tracked = fieldQuest
    ? [fieldQuest, ...side.filter(q => q.id !== fieldQuest.id)].slice(0, 3)
    : side.slice(0, game.inAegean ? 1 : story && story.kind !== 'done' ? 2 : 3);
  const showStory = !!story && story.kind !== 'done' && !game.encounters.active && !component && !game.naval.aboard;

  if (!(tracked.length || showStory || component || game.encounters.active || game.naval.aboard)) return null;
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
      {showStory && story ? <MainStoryBlock game={game} story={story} /> : null}
      {tracked.length && !game.encounters.active && !component ? <h4>{showStory ? 'Meanwhile' : 'Next adventure'}</h4> : null}
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

/** What an objective asks for, without its wording. */
function objectiveKey(o: Objective): string {
  switch (o.type) {
    case 'kill': case 'boss': return `kill:${o.enemy}`;
    case 'collect': return `collect:${o.item}`;
    case 'talk': return `talk:${o.npc}`;
    case 'explore': return `explore:${o.location}`;
    case 'clear': return `clear:${o.map}`;
    case 'interact': return `interact:${o.target}`;
    case 'hunt': return `hunt:${o.region}`;
  }
}

/**
 * The main story, always on top: what to do, and nothing that does it for
 * you. An unfound place gets directions instead of a distance; a chapter
 * that waits on a level says which level and where people of yours go.
 */
function MainStoryBlock({ game, story }: { game: Game; story: MainStoryState }) {
  const p = game.player;
  if (story.kind === 'done') return null;
  const head = <h4>Act {story.act.numeral} · {story.act.name}</h4>;
  if (story.kind === 'level') {
    return (
      <div className="qt-block main-story">
        {head}
        <div className="qname">{story.def.name}</div>
        <div className="obj"><span>Reach level {story.needLevel}</span><span>{p.level}/{story.needLevel}</span></div>
        <SegBar kind="xp" value={p.xp} max={xpToNext(p.level)} />
        <LevelGateHelp game={game} needLevel={story.needLevel!} huntRegion={story.huntRegion} />
      </div>
    );
  }
  const def = story.def;
  const aq = game.quests.get(def.id);
  if (!aq) return null;
  const report = story.kind === 'report' && story.reportTo ? MAIN_REPORT[story.reportTo] : undefined;
  // Targets are overworld points; from inside a room or a dungeon the
  // distance to one means nothing.
  const target = game.trackedQuest === def.id && game.map.id === 'overworld' ? game.trackedTarget() : null;
  return (
    <div className="qt-block main-story">
      {head}
      <div className="qname">{def.name}</div>
      {report ? (
        <div className="obj"><span><i className="obj-dot on" />Report to {NPC_BY_ID[story.reportTo!]?.name ?? 'them'} — {report.where}</span></div>
      ) : def.objectives.map((o, i) => {
        const cur = game.quests.objectiveCount(def, aq, i, p);
        const need = game.quests.objectiveTarget(o);
        const done = cur >= need;
        return (
          <div className={`obj ${done ? 'done' : ''}`} key={i}>
            <span><i className={`obj-dot ${done ? 'on' : ''}`} />{o.label}</span>
            <span>{need > 1 ? `${cur}/${need}` : ''}</span>
          </div>
        );
      })}
      {target ? <small>→ {target.name} · {Math.round(Math.hypot(target.x - p.x, target.y - p.y) / 32)}m</small>
        : !report && game.onlyHuntLeft(def) ? <small>Anything that lives there counts. No need to go back.</small>
        : !report && def.hint && !story.guided ? <small>{def.hint}</small> : null}
    </div>
  );
}

/** While the story waits on a level: how far, and one concrete thing to go and do. */
function LevelGateHelp({ game, needLevel, huntRegion }: { game: Game; needLevel: number; huntRegion?: string }) {
  const help = game.levelGateHelp(needLevel);
  return (
    <>
      <small>{help.xpToGo.toLocaleString('en-US')} XP to go.</small>
      {help.bounty ? <small>{help.bounty.name} (Lv {help.bounty.level}) · {help.bounty.where}</small> : null}
      {huntRegion ? <small>{help.bounty ? 'Or hunt' : 'Hunt'} anywhere in {huntRegion}.</small> : null}
    </>
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
 * The training, one instruction at a time. It replaces the old corner block
 * of key hints: the controls are learned by doing them here, and are listed
 * afterwards under Controls in the pause menu.
 */
function TrainingCard({ game }: { game: Game }) {
  const t = useGameValue(() => {
    const tr = game.training;
    if (!tr || game.uiOpen) return null;
    return { stage: tr.stage, ...tr.progress, recent: tr.recent, touch: game.input.touchMode };
  }, 8);
  if (!t) return null;
  const k = (a: Parameters<typeof game.input.keyLabel>[0]) => {
    if (t.touch) return a === 'attack' ? 'ATK' : a === 'dash' ? 'DODGE' : a === 'heavy' ? 'HVY' : 'USE';
    const l = game.input.keyLabel(a);
    return l === 'Space' ? 'SPC' : l;
  };
  const step = { move: 1, attack: 2, dodge: 3, finish: 4 }[t.stage];
  return (
    <div className={`training-card frame-ash${t.recent ? ' lit' : ''}`} role="status">
      <div className="tc-head"><span>Training {step}/4</span>
        <button className="tc-skip" onClick={() => game.training?.complete(true)}>Skip</button>
      </div>
      {t.stage === 'move' ? <>
        <div className="tc-line">{t.touch ? 'Walk with the stick' : <><span className="tc-keys"><KeyCap>W</KeyCap><KeyCap>A</KeyCap><KeyCap>S</KeyCap><KeyCap>D</KeyCap></span> walk</>}</div>
        <SegBar kind="xp" value={t.value} max={t.max} />
      </> : null}
      {t.stage === 'attack' ? <>
        <div className="tc-line">A wolf. <KeyCap>{k('attack')}</KeyCap> attack</div>
        <div className="tc-sub"><KeyCap>{k('heavy')}</KeyCap> is a slower, heavier blow.</div>
      </> : null}
      {t.stage === 'dodge' ? <>
        <div className="tc-line">Ring on the ground? <KeyCap>{k('dash')}</KeyCap> dash</div>
        <div className="tc-sub">Dash while he winds up, and the swing hits air.</div>
        <div className="tc-count">{Array.from({ length: t.max }).map((_, i) => <i key={i} className={i < t.value ? 'on' : ''} />)}</div>
      </> : null}
      {t.stage === 'finish' ? <div className="tc-line">Good. Now put him down.</div> : null}
    </div>
  );
}
