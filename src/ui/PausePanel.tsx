import type { Game } from '../game/core/game';
import { deleteSave, saveGame } from '../game/save/save';

export default function PausePanel({ game, onSettings }: { game: Game; onSettings: () => void }) {
  const coords = game.worldCoords();
  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 380 }}>
        <div className="panel-title">
          <span>Paused</span>
          <button className="close-x" onClick={() => game.closeAll()}>×</button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 6, lineHeight: 1.6 }}>
            {game.player.name} · Level {game.player.level} {game.player.classDef.name}<br />
            {game.map.name} · {game.timeLabel} · {coords.isDoor ? 'Door ' : ''}{coords.x}, {coords.y}
          </div>
          <button className="btn primary" onClick={() => game.closeAll()}>Resume</button>
          {game.isDebug ? (
            <button
              className="btn"
              style={{ borderColor: '#9578e8', color: '#c9b6ff' }}
              onClick={() => game.setPanel('debug')}
            >
              Open debug menu
            </button>
          ) : null}
          <button className="btn" onClick={() => { saveGame(game); game.toast('Game saved', undefined, '#6fbf5a'); }}>Save game</button>
          <button className="btn" onClick={() => game.setPanel('character')}>Character</button>
          <button className="btn" onClick={() => game.setPanel('quests')}>Journal</button>
          <button className="btn" onClick={() => game.setPanel('help')}>How to play</button>
          <button className="btn" onClick={onSettings}>Settings</button>
          <button
            className="btn danger"
            onClick={() => {
              saveGame(game);
              game.screen = 'title';
              game.closeAll();
            }}
          >
            Save &amp; quit to title
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (!window.confirm('Delete your save and return to the title screen? This cannot be undone.')) return;
              deleteSave();
              game.screen = 'title';
              game.closeAll();
            }}
          >
            Abandon run (delete save)
          </button>
        </div>
      </div>
    </div>
  );
}
