import type { Game } from '../game/core/game';
import { deleteSave, saveGame } from '../game/save/save';
import { ConfirmButton, Modal } from './kit';

export default function PausePanel({ game, onSettings }: { game: Game; onSettings: () => void }) {
  const coords = game.worldCoords();
  return (
    <Modal title="Paused" size="s" onClose={() => game.closeAll()}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div className="note">
            {game.player.name} · Level {game.player.level} {game.player.classDef.name}<br />
            {game.map.name} · {game.timeLabel} · {coords.isDoor ? 'Door ' : ''}{coords.x}, {coords.y}
          </div>
          <button className="btn primary" onClick={() => game.closeAll()}>Resume</button>
          {game.isDebug ? (
            <button
              className="btn"
              onClick={() => game.setPanel('debug')}
            >
              Open debug menu
            </button>
          ) : null}
          <button className="btn" onClick={() => { if(saveGame(game)) game.toast('Game saved', undefined, '#6fbf5a'); }}>Save game</button>
          <button className="btn" onClick={() => game.setPanel('character')}>Character</button>
          <button className="btn" onClick={() => game.setPanel('quests')}>Journal</button>
          <button className="btn" onClick={() => game.setPanel('help')}>How to play</button>
          <button className="btn" onClick={onSettings}>Settings</button>
          <button
            className="btn danger"
            onClick={() => {
              if(!saveGame(game)) return;
              game.screen = 'title';
              game.closeAll();
            }}
          >
            Save &amp; quit to title
          </button>
          <ConfirmButton
            confirm="Delete save for good?"
            onConfirm={() => {
              deleteSave();
              game.screen = 'title';
              game.closeAll();
            }}
          >
            Abandon run (delete save)
          </ConfirmButton>
        </div>
    </Modal>
  );
}
