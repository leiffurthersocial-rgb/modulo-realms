import { useEffect } from 'react';
import type { Game } from '../game/core/game';
import { NPC_BY_ID } from '../data/npcs';
import SpritePreview from './SpritePreview';
import { KeyCap } from './kit';

export default function DialoguePanel({ game }: { game: Game }) {
  const d = game.dialogue!;
  const npc = NPC_BY_ID[d.npcId];
  const moreLines = d.lineIndex < d.lines.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (moreLines) game.advanceDialogue();
        return;
      }
      const n = Number(e.key);
      if (!moreLines && n >= 1 && n <= d.choices.length) game.chooseDialogue(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, d, moreLines]);

  return (
    <div className="dialogue-wrap">
      <div className={`dialogue frame-wood${d.frame === 'gold' ? ' framed' : ''}`}>
        <div className="d-head">
          <div className="d-portrait">
            <SpritePreview look={npc.look} scale={1} />
          </div>
          <div>
            <div className="d-name">{d.name}</div>
            <div className="d-title">{npc.title} · {npc.race[0].toUpperCase() + npc.race.slice(1)}</div>
          </div>
          <div className="d-att" style={{ color: d.attitude.color }}>{d.attitude.label}</div>
        </div>

        <div className="d-text" onClick={() => moreLines && game.advanceDialogue()}>
          {d.lines[d.lineIndex]}
          {moreLines ? <span className="d-more"><KeyCap>SPC</KeyCap> more</span> : null}
        </div>

        {!moreLines ? (
          <div className="d-choices">
            {d.choices.map((c, i) => {
              const tagMatch = /^\[(.+?)\]\s*/.exec(c.text);
              const inlineTag = tagMatch ? tagMatch[1] : c.tag;
              const body = tagMatch ? c.text.slice(tagMatch[0].length) : c.text;
              const kind = c.accent === 'gold' ? 'gold'
                : inlineTag === 'Quest' ? 'quest'
                  : inlineTag && ['Mage', 'Warrior', 'Rogue', 'Ranger', 'Paladin', 'Necromancer'].includes(inlineTag) ? 'class'
                    : inlineTag ? 'race' : '';
              return (
                <button className={`d-choice${c.accent === 'gold' ? ' accent' : ''}`} key={i} onClick={() => game.chooseDialogue(i)}>
                  <KeyCap className="num">{i + 1}</KeyCap>
                  {inlineTag ? <span className={`tag ${kind}`}>{inlineTag}</span> : null}
                  <span>{body}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
