import type { Game } from '../game/core/game';
import { deleteSave, saveGame } from '../game/save/save';
import { PAL } from '../game/art/palette';
import { uiSpriteUrl } from '../game/art/uiArt';
import { ConfirmButton, Modal } from './kit';

/**
 * The pause board: the crest and who you are on the left, where to go on the
 * right, and the two ways out of the game set apart underneath — the
 * destructive one needs a second press.
 *
 * The debug menu is a development tool: its button only exists in a dev build
 * (and still only for a character called "debug").
 */
export default function PausePanel({ game, onSettings }: { game: Game; onSettings: () => void }) {
  const p = game.player;
  const showDebug = import.meta.env.DEV && game.isDebug;
  return (
    <Modal title="Paused" size="m" onClose={() => game.closeAll()} className="pause-board">
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
    </Modal>
  );
}
