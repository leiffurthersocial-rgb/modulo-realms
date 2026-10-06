import { useCallback, useEffect, useState } from 'react';
import type { Player } from '../game/player/player';
import { CLASSES } from '../data/classes';
import { RACES } from '../data/races';
import {
  fetchBoard, isOptedOut, myEntryId, onlineEnabled, optIn, optOut, refusedReason, report, type Board,
} from '../game/online/leaderboard';
import { Button, ConfirmButton, Modal } from './kit';

const CLASS_NAME: Record<string, string> = Object.fromEntries(CLASSES.map((c) => [c.id, c.name]));
const RACE_NAME: Record<string, string> = Object.fromEntries(RACES.map((r) => [r.id, r.name]));

const REFUSED: Record<string, string> = {
  name: 'This name is not allowed on the board.',
  banned: 'This character was removed from the board.',
  auth: 'Another browser owns this character on the board.',
};

/**
 * The global leaderboard: top fifty by level, your own place, a report
 * button on every other row, and a way off the board. Opened from the title
 * screen (no character) and the pause menu.
 */
export default function LeaderboardPanel({ player, onClose }: { player?: Player | null; onClose: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(isOptedOut());
  const mine = myEntryId(player);
  const refused = refusedReason(player);

  const load = useCallback(() => {
    if (!onlineEnabled()) { setError('The leaderboard is online only, not in a development build.'); return; }
    setError('');
    fetchBoard(player).then(setBoard).catch(() => setError('The leaderboard cannot be reached right now.'));
  }, [player]);
  useEffect(load, [load]);

  const me = board?.me;
  const sub = board ? `${board.total} ${board.total === 1 ? 'hero' : 'heroes'} on the board` : 'Highest level first';

  return (
    <Modal title="Leaderboard" sub={sub} size="m" onClose={onClose}>
      {player ? (
        <div className="lb-me">
          <span>{player.name} · Level {player.level}</span>
          <span className="muted">
            {hidden ? 'Not on the board'
              : refused ? REFUSED[refused] ?? 'Not on the board'
              : me?.hidden ? 'Hidden after reports, waiting for review'
              : me?.rank ? `Rank ${me.rank}` : 'Joins the board at the next autosave'}
          </span>
        </div>
      ) : null}

      <div className="lb-list scroll">
        {error ? <p className="muted">{error}</p> : null}
        {!error && !board ? <p className="muted">Loading...</p> : null}
        {board && !board.top.length ? <p className="muted">No one yet. The first name here could be yours.</p> : null}
        {board?.top.map((row) => (
          <div key={row.id} className={`lb-row${row.id === mine ? ' mine' : ''}`}>
            <span className="lb-rank">{row.rank}</span>
            <span className="lb-name">{row.name}</span>
            <span className="lb-cls muted">{RACE_NAME[row.race] ?? row.race} {CLASS_NAME[row.cls] ?? row.cls}</span>
            <span className="lb-level">{row.level}</span>
            {row.id === mine ? <span className="lb-act" /> : (
              <button
                className="lb-act btn small"
                disabled={reported.has(row.id)}
                title="Report an offensive name"
                onClick={() => { void report(row.id); setReported(new Set(reported).add(row.id)); }}
              >
                {reported.has(row.id) ? 'Sent' : 'Report'}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="lb-foot">
        <Button small onClick={load}>Refresh</Button>
        {hidden ? (
          <Button small onClick={() => { optIn(player); setHidden(false); }}>Show me on the board</Button>
        ) : (
          <ConfirmButton small confirm="Remove for good? Press again" onConfirm={() => { void optOut().then(load); setHidden(true); }}>
            Take me off the board
          </ConfirmButton>
        )}
      </div>
    </Modal>
  );
}
