import type { Game } from '../game/core/game';
import { SKILL_BRANCHES } from '../data/classes';
import { getIconUrl } from '../game/art/icons';

export default function SkillPanel({ game }: { game: Game }) {
  const p = game.player;
  const c = p.classDef;
  const branches = SKILL_BRANCHES(c);

  const spend = (id: string) => {
    const node = c.skills.find((n) => n.id === id)!;
    const cur = p.skills[id] ?? 0;
    if (p.skillPoints <= 0 || cur >= node.max) return;
    // tiers unlock in order
    const prevTierPoints = c.skills
      .filter((n) => n.branch === node.branch && n.tier < node.tier)
      .reduce((sum, n) => sum + (p.skills[n.id] ?? 0), 0);
    if (node.tier > 1 && prevTierPoints < (node.tier - 1) * 2) return;
    p.skills[id] = cur + 1;
    p.skillPoints--;
    game.playSound('levelup', 0.5);
    game.touch();
  };

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(960px, 95vw)', height: 'min(660px, 92vh)' }}>
        <div className="panel-title">
          <span>Skills — {c.name}</span>
          <span className="sub">{p.skillPoints} point{p.skillPoints === 1 ? '' : 's'} available</span>
          <button className="close-x" onClick={() => game.closeAll()}>×</button>
        </div>

        <div className="inv-col scroll" style={{ overflowY: 'auto', flex: 1 }}>
          <div className="section-h">Abilities</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            {c.abilities.map((a, i) => {
              const locked = p.level < a.level;
              return (
                <div
                  key={a.id}
                  className="panel"
                  style={{ padding: 11, width: 218, opacity: locked ? 0.55 : 1, background: 'var(--panel-2)' }}
                >
                  <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                    <img src={getIconUrl(a.icon as 'sword')} alt="" style={{ width: 30, height: 30, imageRendering: 'pixelated' }} />
                    <div>
                      <div style={{ fontSize: 12.5, color: a.color }}>{a.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                        Key {i + 1} · {locked ? `Level ${a.level}` : `${a.cooldown}s cd`}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 7, lineHeight: 1.5 }}>{a.desc}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--gold-dim)', marginTop: 5 }}>
                    {a.mana > 0 ? `${a.mana} mana ` : ''}{a.stamina > 0 ? `${a.stamina} stamina` : ''}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="section-h">Talent branches</div>
          <div className="skill-branches">
            {branches.map((branch) => (
              <div key={branch}>
                <div className="branch-title">{branch}</div>
                {c.skills.filter((n) => n.branch === branch).sort((a, b) => a.tier - b.tier).map((node) => {
                  const cur = p.skills[node.id] ?? 0;
                  const prevTierPoints = c.skills
                    .filter((n) => n.branch === node.branch && n.tier < node.tier)
                    .reduce((sum, n) => sum + (p.skills[n.id] ?? 0), 0);
                  const unlocked = node.tier === 1 || prevTierPoints >= (node.tier - 1) * 2;
                  const maxed = cur >= node.max;
                  const canBuy = unlocked && !maxed && p.skillPoints > 0;
                  return (
                    <div className={`skill-node ${maxed ? 'maxed' : canBuy ? 'available' : ''}`} key={node.id} style={{ opacity: unlocked ? 1 : 0.5 }}>
                      <div className="sn-head">
                        <span className="sn-name">{node.name}</span>
                        <span className="sn-pts">{cur}/{node.max}</span>
                      </div>
                      <div className="skill-pips">
                        {Array.from({ length: node.max }).map((_, i) => <i key={i} className={i < cur ? 'on' : ''} />)}
                      </div>
                      <div className="sn-desc">{node.desc}</div>
                      {!unlocked ? (
                        <div className="sn-desc" style={{ color: 'var(--danger)' }}>
                          Requires {(node.tier - 1) * 2} points in earlier {branch} talents.
                        </div>
                      ) : null}
                      <button className="btn small sn-buy" disabled={!canBuy} onClick={() => spend(node.id)}>
                        {maxed ? 'Mastered' : 'Spend point'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
