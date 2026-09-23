import type { Game } from '../game/core/game';

export default function DeathScreen({ game }: { game: Game }) {
  const p = game.player;
  return (
    <div className="death-screen">
      <div style={{ textAlign: 'center' }}>
        <h1>You Fell</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 220, margin: '0 auto 11px' }}>
          {p.name} went down in {game.map.name}. Someone from Ashvale will find you — they always do — but it will cost
          you a tenth of your purse.
        </p>
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
          <button className="btn primary" onClick={() => game.respawnPlayer()}>Wake in Ashvale</button>
          <button
            className="btn"
            onClick={() => { game.screen = 'title'; game.closeAll(); }}
          >
            Return to title
          </button>
        </div>
      </div>
    </div>
  );
}
