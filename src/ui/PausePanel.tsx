import type { Game } from '../game/core/game';
import { deleteSave, saveGame } from '../game/save/save';
import { PAL } from '../game/art/palette';
import { uiSpriteUrl } from '../game/art/uiArt';
import { ConfirmButton, KeyCap, Modal } from './kit';
import { useState } from 'react';
import type { ActionName } from '../game/core/input';

/** Every binding, grouped the way you reach for them. */
const CONTROL_GROUPS: Array<{ title: string; rows: Array<[string, ActionName[]]> }> = [
  { title: 'Moving', rows: [['Walk', ['up', 'left', 'down', 'right']], ['Dodge / dash', ['dash']], ['Use, talk, open', ['interact']]] },
  { title: 'Fighting', rows: [
    ['Attack', ['attack']], ['Heavy blow', ['heavy']], ['Off-hand (hold: block)', ['offhand']], ['Brace', ['brace']],
    ['Abilities', ['slot1', 'slot2', 'slot3', 'slot4']], ['Weapon power', ['weaponPower']], ['Artifact', ['artifact']],
    ['Potion', ['potion']], ['Cycle target', ['target']],
  ] },
  { title: 'Menus', rows: [
    ['Pack', ['inventory']], ['Character', ['character']], ['Talents', ['skills']], ['Journal', ['quests']],
    ['Map', ['map']], ['Minimap', ['minimap']], ['Travel', ['travel']], ['Pause', ['pause']],
  ] },
];

/** The controls, as a tab of the pause board — the one place they are listed. */
function Controls({ game }: { game: Game }) {
  const label = (a: ActionName) => {
    const l = game.input.keyLabel(a);
    return l === 'Space' ? 'SPC' : l;
  };
  return (
    <div className="pause-controls">
      {CONTROL_GROUPS.map((g) => (
        <div key={g.title} className="pc-group">
          <div className="section-h">{g.title}</div>
          {g.rows.map(([what, keys]) => (
            <div key={what} className="pc-row">
              <span className="pc-keys">{keys.map((k) => <KeyCap key={k}>{label(k)}</KeyCap>)}</span>
              <span>{what}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="pc-group">
        <div className="section-h">At sea</div>
        <div className="pc-row"><span className="pc-keys"><KeyCap>W</KeyCap><KeyCap>A</KeyCap><KeyCap>S</KeyCap><KeyCap>D</KeyCap></span><span>Steer</span></div>
        <div className="pc-row"><span className="pc-keys"><KeyCap>SPC</KeyCap></span><span>Broadside</span></div>
        <div className="pc-row"><span className="pc-keys"><KeyCap>G</KeyCap></span><span>Ram</span></div>
        <div className="pc-row"><span className="pc-keys"><KeyCap>SHIFT</KeyCap></span><span>Burst row</span></div>
        <div className="pc-row"><span className="pc-keys"><KeyCap>E</KeyCap></span><span>Dock</span></div>
        <div className="pc-row"><span className="pc-keys"><KeyCap>R</KeyCap></span><span>Fight on deck</span></div>
      </div>
    </div>
  );
}

/**
 * The pause board: the crest and who you are on the left, where to go on the
 * right, and the two ways out of the game set apart underneath — the
 * destructive one needs a second press.
 *
 * The debug menu button appears for a character called "debug", in any build.
 */
export default function PausePanel({ game, onSettings }: { game: Game; onSettings: () => void }) {
  const p = game.player;
  const showDebug = game.isDebug;
  const [tab, setTab] = useState<'menu' | 'controls'>('menu');
  return (
    <Modal title="Paused" size="m" onClose={() => game.closeAll()} className="pause-board">
      <div className="tabs">
        <button className={`tab ${tab === 'menu' ? 'active' : ''}`} onClick={() => setTab('menu')}>Menu</button>
        <button className={`tab ${tab === 'controls' ? 'active' : ''}`} onClick={() => setTab('controls')}>Controls</button>
      </div>
      {tab === 'controls' ? <Controls game={game} /> : <>
      <div className="pause-layout">
        <div className="pause-crest">
          <img src={uiSpriteUrl('crest')} alt="" draggable={false} />
          <div className="pc-name">{p.name}</div>
          <div className="pc-line">Level {p.level} {p.classDef.name}</div>
          <div className="pc-line muted">{game.map.name}</div>
          <div className="pc-line muted">{game.timeLabel} · day {game.day}</div>
        </div>
        <div className="pause-menu">
          <button className="btn primary block" onClick={() => game.closeAll()}>Resume</button>
          <button className="btn block" onClick={() => { if (saveGame(game)) game.toast('Game saved', undefined, PAL.toxic); }}>Save game</button>
          <button className="btn block" onClick={() => game.setPanel('character')}>Character</button>
          <button className="btn block" onClick={() => game.setPanel('quests')}>Journal</button>
          <button className="btn block" onClick={() => game.setPanel('help')}>How to play</button>
          <button className="btn block" onClick={onSettings}>Settings</button>
          {showDebug ? <button className="btn iron block" onClick={() => game.setPanel('debug')}>Debug menu</button> : null}
        </div>
      </div>
      <div className="pause-leave">
        <div className="section-h">Leave the valley</div>
        <div className="pl-row">
          <button
            className="btn"
            onClick={() => {
              if (!saveGame(game)) return;
              game.screen = 'title';
              game.closeAll();
            }}
          >
            Save &amp; quit to title
          </button>
          <ConfirmButton
            confirm="Delete for good? Press again"
            onConfirm={() => {
              deleteSave();
              game.screen = 'title';
              game.closeAll();
            }}
          >
            Abandon run
          </ConfirmButton>
        </div>
      </div>
      </>}
    </Modal>
  );
}
