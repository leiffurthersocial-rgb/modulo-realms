import { useState } from 'react';
import type { Game } from '../game/core/game';
import { QUEST_BY_ID, QUESTS } from '../data/quests';
import { NPC_BY_ID } from '../data/npcs';
import { LOCATION_BY_ID } from '../data/locations';
import { FACTION_BY_ID } from '../data/races';
import { getIconUrl } from '../game/art/icons';
import { TEMPLATE_BY_ID } from '../data/items';
import { Badge, Icon, Modal } from './kit';

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
    <Modal title={<>Adventures &amp; rewards</>} sub={<>{active.length} active · {done.length} completed</>} size="l" tall onClose={() => game.closeAll()}>
        {game.inAegean && game.campaign.state.receipts?.length ? <details className="reward-history"><summary>Recent rewards · see exactly what you earned</summary>
          {game.campaign.state.receipts.map((receipt, i) => <div key={i}><strong>{receipt.title}</strong>{receipt.lines.map((line, n) => <div key={n}>{line}</div>)}</div>)}
        </details> : null}
        <div className="tabs">
          <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => { setTab('active'); setSel(null); }}>Active</button>
          <button className={`tab ${tab === 'done' ? 'active' : ''}`} onClick={() => { setTab('done'); setSel(null); }}>Completed</button>
          <button className={`tab ${tab === 'rumours' ? 'active' : ''}`} onClick={() => { setTab('rumours'); setSel(null); }}>Available</button>
        </div>

        <div className="quest-layout">
          <div className="scroll" style={{ borderRight: '1px solid var(--edge)', overflowY: 'auto' }}>
            {list.length === 0 ? (
              <div style={{ padding: 9, color: 'var(--muted)' }}>
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
                    {q.main ? <Badge className="main-tag">Main</Badge> : null}
                    {complete ? <Badge className="main-tag" tone="ember">Ready</Badge> : null}
                  </div>
                  <div className="qi-meta">
                    Level {q.level} · {q.fieldAdventure ? 'Found in the world' : NPC_BY_ID[q.giver]?.name ?? 'Unknown'}
                    {game.trackedQuest === q.id ? <Badge className="tracking-tag" tone="iron">Tracked</Badge> : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="inv-col scroll" style={{ overflowY: 'auto' }}>
            {sel ? (
              <>
                <div style={{ color: 'var(--gold)' }}>{sel.name}</div>
                <div style={{ color: 'var(--muted)', marginTop: 2 }}>
                  Level {sel.level} · {sel.fieldAdventure ? 'Found in the world' : `Given by ${NPC_BY_ID[sel.giver]?.name ?? '—'}`}
                  {sel.marker && LOCATION_BY_ID[sel.marker] ? ` · ${LOCATION_BY_ID[sel.marker].name}` : ''}
                </div>
                {game.quests.isActive(sel.id) ? (
                  <button
                    className={`btn small ${game.trackedQuest === sel.id ? 'primary' : ''}`}
                    style={{ marginTop: 5 }}
                    onClick={() => game.trackQuest(sel.id)}
                  >
                    {game.trackedQuest === sel.id ? 'Tracking — click to stop' : 'Track this quest'}
                  </button>
                ) : null}
                <p style={{ color: 'var(--text-hi)', marginTop: 6 }}>{sel.summary}</p>
                {sel.detail !== sel.summary ? <details><summary>Story &amp; hints</summary><div style={{ color: 'var(--muted)' }}>{sel.detail}</div></details> : null}

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
                  <span className="reward-pill"><Icon name="coin" />{sel.rewards.gold}</span>
                  {/* A quest can list the same item twice — two health draughts is a
                      perfectly ordinary reward — so the index is the key, not the id. */}
                  {(sel.rewards.items ?? []).map((id, i) => {
                    const t = TEMPLATE_BY_ID[id];
                    return t ? (
                      <span className="reward-pill" key={`${id}:${i}`}>
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
                  <div style={{ marginTop: 8, color: 'var(--muted)' }}>
                    {sel.fieldAdventure ? 'Explore this place to begin. Rewards are paid when the work is done.' : <>Speak to {NPC_BY_ID[sel.giver]?.name ?? 'the giver'} to take this on.</>}
                  </div>
                ) : null}
              </>
            ) : (
              <div style={{ color: 'var(--muted)' }}>Select a quest.</div>
            )}
          </div>
        </div>
    </Modal>
  );
}
