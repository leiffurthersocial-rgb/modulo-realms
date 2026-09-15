import { useState } from 'react';
import type { Game } from '../game/core/game';
import { QUEST_BY_ID, QUESTS } from '../data/quests';
import { NPC_BY_ID } from '../data/npcs';
import { LOCATION_BY_ID } from '../data/locations';
import { FACTION_BY_ID } from '../data/races';
import { getIconUrl } from '../game/art/icons';
import { TEMPLATE_BY_ID } from '../data/items';

export default function QuestPanel({ game }: { game: Game }) {
  const p = game.player;
  const [tab, setTab] = useState<'active' | 'done' | 'rumours'>('active');
  const active = game.quests.active.map((a) => QUEST_BY_ID[a.id]).filter(Boolean);
  const done = game.quests.completed.map((id) => QUEST_BY_ID[id]).filter(Boolean);
  const rumours = QUESTS.filter((q) => game.quests.canAccept(q, p) && !active.includes(q));
  const list = tab === 'active' ? active : tab === 'done' ? done : rumours;
  const [selId, setSel] = useState<string | null>(null);
  const sel = QUEST_BY_ID[selId ?? ''] ?? list[0];

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(920px, 95vw)', height: 'min(640px, 92vh)' }}>
        <div className="panel-title">
          <span>Journal</span>
          <span className="sub">{active.length} active · {done.length} completed</span>
          <button className="close-x" onClick={() => game.closeAll()}>×</button>
        </div>
        <div className="tabs">
          <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => { setTab('active'); setSel(null); }}>Active</button>
          <button className={`tab ${tab === 'done' ? 'active' : ''}`} onClick={() => { setTab('done'); setSel(null); }}>Completed</button>
          <button className={`tab ${tab === 'rumours' ? 'active' : ''}`} onClick={() => { setTab('rumours'); setSel(null); }}>Available</button>
        </div>

        <div className="quest-layout">
          <div className="scroll" style={{ borderRight: '1px solid var(--edge)', overflowY: 'auto' }}>
            {list.length === 0 ? (
              <div style={{ padding: 18, color: 'var(--muted)', fontSize: 12.5 }}>
                {tab === 'active' ? 'No active quests. Ask around Ashvale.' : tab === 'done' ? 'Nothing finished yet.' : 'No new work available at your level.'}
              </div>
            ) : null}
            {list.map((q) => {
              const aq = game.quests.get(q.id);
              const complete = aq ? game.quests.isComplete(q.id, p) : false;
              return (
                <button
                  key={q.id}
                  className={`quest-item ${sel?.id === q.id ? 'active' : ''} ${tab === 'done' ? 'done' : ''}`}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid rgba(74,59,82,0.5)', cursor: 'pointer' }}
                  onClick={() => setSel(q.id)}
                >
                  <div className="qi-name">
                    {q.name}
                    {q.main ? <span className="main-tag">MAIN</span> : null}
                    {complete ? <span className="main-tag" style={{ background: 'var(--uncommon)' }}>READY</span> : null}
                  </div>
                  <div className="qi-meta">
                    Level {q.level} · {NPC_BY_ID[q.giver]?.name ?? 'Unknown'}
                    {game.trackedQuest === q.id ? <span className="tracking-tag">TRACKED</span> : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="inv-col scroll" style={{ overflowY: 'auto' }}>
            {sel ? (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--gold)' }}>{sel.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                  Level {sel.level} · Given by {NPC_BY_ID[sel.giver]?.name ?? '—'}
                  {sel.marker && LOCATION_BY_ID[sel.marker] ? ` · ${LOCATION_BY_ID[sel.marker].name}` : ''}
                </div>
                {game.quests.isActive(sel.id) ? (
                  <button
                    className={`btn small ${game.trackedQuest === sel.id ? 'primary' : ''}`}
                    style={{ marginTop: 10 }}
                    onClick={() => game.trackQuest(sel.id)}
                  >
                    {game.trackedQuest === sel.id ? 'Tracking — click to stop' : 'Track this quest'}
                  </button>
                ) : null}
                <p style={{ fontSize: 13, lineHeight: 1.65, color: '#ded5ca', marginTop: 12 }}>{sel.summary}</p>
                <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--muted)', fontStyle: 'italic' }}>{sel.detail}</div>

                <div className="section-h">Objectives</div>
                <div className="obj-list">
                  {sel.objectives.map((o, i) => {
                    const aq = game.quests.get(sel.id);
                    const cur = aq ? game.quests.objectiveCount(sel, aq, i, p) : 0;
                    const target = game.quests.objectiveTarget(o);
                    const isDone = game.quests.isCompleted(sel.id) || cur >= target;
                    return (
                      <div className={`obj-item ${isDone ? 'done' : ''}`} key={i}>
                        <span><i className={`obj-dot ${isDone ? 'on' : ''}`} />{o.label}</span>
                        <span>{target > 1 ? `${cur}/${target}` : ''}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="section-h">Rewards</div>
                <div className="reward-row">
                  <span className="reward-pill">{sel.rewards.xp} XP</span>
                  <span className="reward-pill"><img src={getIconUrl('gold')} alt="" />{sel.rewards.gold}</span>
                  {(sel.rewards.items ?? []).map((id) => {
                    const t = TEMPLATE_BY_ID[id];
                    return t ? (
                      <span className="reward-pill" key={id}>
                        <img src={getIconUrl(t.icon, { metal: t.metal })} alt="" />{t.name}
                      </span>
                    ) : null;
                  })}
                  {sel.rewards.loot ? (
                    <span className="reward-pill" style={{ color: 'var(--legendary)' }}>
                      {sel.rewards.loot.rarity ?? 'random'} gear (lvl {sel.rewards.loot.level})
                    </span>
                  ) : null}
                  {(sel.rewards.rep ?? []).map((r) => (
                    <span className="reward-pill" key={r.faction} style={{ color: FACTION_BY_ID[r.faction].color }}>
                      {r.amount > 0 ? '+' : ''}{r.amount} {FACTION_BY_ID[r.faction].name}
                    </span>
                  ))}
                </div>

                {tab === 'rumours' ? (
                  <div style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
                    Speak to {NPC_BY_ID[sel.giver]?.name ?? 'the giver'} to take this on.
                  </div>
                ) : null}
              </>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Select a quest.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
