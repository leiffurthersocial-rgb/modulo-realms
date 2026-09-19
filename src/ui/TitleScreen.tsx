import type { Game } from '../game/core/game';
import { savePreview } from '../game/save/save';
import TitleArt from './TitleArt';

interface Props {
  game: Game;
  hasSave: boolean;
  loadError?: string;
  onNew: () => void;
  onContinue: () => void;
  onSettings: () => void;
}

export default function TitleScreen({ hasSave, loadError, onNew, onContinue, onSettings }: Props) {
  const preview = hasSave ? savePreview() : null;
  return (
    <div className="title-screen">
      <TitleArt />
      <div className="title-scrim" />

      <div className="title-body">
        <div className="title-main">
          <div className="title-kicker">The valley remembers</div>
          <h1>Modulo</h1>
          <div className="title-rule">
            <span className="tr-line" />
            <span className="tr-gem" />
            <span className="tr-line" />
          </div>
          <h2>Realms of Ash</h2>
          <div className="title-tag">
            An open-world fantasy RPG in the Ashvale valley.
          </div>
        </div>

        <div className="title-menu">
          {hasSave ? (
            <>
              <button className="btn primary" onClick={onContinue}>
                Continue
              </button>
              {preview ? <div className="save-note">
                {preview.name} &middot; Level {preview.level} {preview.cls} &middot; saved {timeAgo(preview.savedAt)}
              </div> : null}
            </>
          ) : null}
          {loadError ? <div className="save-note" role="alert" style={{ color: '#ef9b83', maxWidth: 330 }}>{loadError}</div> : null}
          <button className="btn" onClick={onNew}>New Game</button>
          <button className="btn" onClick={onSettings}>Settings</button>
        </div>
      </div>

      <div className="title-foot">
        WASD move &middot; Mouse aim &middot; Click attack &middot; E interact &middot; I bag &middot; M map &middot; ESC menu
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
