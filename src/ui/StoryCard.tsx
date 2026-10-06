import { useEffect } from 'react';
import type { Game } from '../game/core/game';
import { Button, Modal } from './kit';

/**
 * One story card: the prologue, a new act, a new chapter. Parchment, so it
 * reads as the story talking rather than a menu. Continue with the button,
 * Enter, Space or the interact key; the world waits underneath.
 */
export default function StoryCard({ game }: { game: Game }) {
  const page = game.storyCards[0];
  const more = game.storyCards.length - 1;
  const skippable = !!page?.group && game.storyCards[1]?.group === page.group;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault();
        game.nextStoryCard();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);

  if (!page) return null;
  return (
    <Modal
      title={page.title}
      sub={page.kicker}
      size="m"
      frame="parchment"
      className="story-card"
      onClose={() => game.nextStoryCard()}
    >
      <div className="sc-body">
        {page.lines.map((l, i) => <p key={i}>{l}</p>)}
        {page.goal ? <div className="sc-goal"><span className="section-h">Now</span><p>{page.goal}</p></div> : null}
        {page.hint ? <p className="sc-hint">{page.hint}</p> : null}
      </div>
      <div className="sc-foot">
        {skippable ? <Button small onClick={() => game.nextStoryCard(true)}>Skip prologue</Button> : <span />}
        <Button variant="primary" onClick={() => game.nextStoryCard()}>{more > 0 ? 'Next' : 'Continue'}</Button>
      </div>
    </Modal>
  );
}
