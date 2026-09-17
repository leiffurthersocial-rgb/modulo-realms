import { useMemo, useState } from 'react';
import type { Game } from '../game/core/game';
import { RACES, type RaceId } from '../data/races';
import type { Look } from '../game/art/characters';
import { repTier } from '../data/races';
import SpritePreview from './SpritePreview';

const HAIR_STYLES: Array<Look['hairStyle']> = ['short', 'long', 'ponytail', 'braid', 'mohawk', 'wild', 'bald'];
const BEARDS: Array<NonNullable<Look['beard']>> = ['none', 'stubble', 'full', 'long'];

/**
 * Orsolya's mirror: pick what you come back out of the water as.
 *
 * It shows the character as they are now beside the character they would
 * become, because the whole decision is a comparison and asking somebody to
 * hold their current racial bonuses in their head while reading a new set is
 * how you get buyer's remorse at ten thousand gold.
 */
export default function RemakePanel({ game }: { game: Game }) {
  const p = game.player;
  const current = p.raceDef;
  const [race, setRace] = useState<RaceId>(p.race);
  const [skinIndex, setSkin] = useState(p.skinIndex);
  const [hairIndex, setHair] = useState(p.hairIndex);
  const [hairStyle, setHairStyle] = useState<Look['hairStyle']>(p.hairStyle);
  const [beard, setBeard] = useState<NonNullable<Look['beard']>>(p.beard ?? 'none');

  const raceDef = RACES.find((r) => r.id === race)!;
  const afford = p.gold >= game.remakeCost;
  const unchanged = race === p.race && skinIndex === p.skinIndex && hairIndex === p.hairIndex
    && hairStyle === p.hairStyle && (p.beard ?? 'none') === beard;

  // The character as they would be: their own gear and class, the new body.
  const preview: Look = useMemo(() => ({
    ...p.look(),
    skin: raceDef.look.skins[skinIndex % raceDef.look.skins.length],
    hair: raceDef.look.hairs[hairIndex % raceDef.look.hairs.length],
    hairStyle,
    beard,
    ears: raceDef.look.ears,
    tusks: raceDef.look.tusks,
    height: raceDef.look.height,
    bulk: raceDef.look.bulk,
    eyes: raceDef.look.eyes,
  }), [p, raceDef, skinIndex, hairIndex, hairStyle, beard]);

  const statLine = (r: typeof raceDef) => {
    const s = r.stats;
    const parts: string[] = [];
    const add = (k: string, v?: number) => { if (v) parts.push(`${v > 0 ? '+' : ''}${v} ${k}`); };
    add('Vitality', s.vitality);
    add('Strength', s.strength);
    add('Dexterity', s.dexterity);
    add('Intelligence', s.intelligence);
    add('Defense', s.defense);
    add('Move Speed', s.moveSpeed);
    add('Crit', s.critChance);
    return parts.join(' · ') || 'No bonuses';
  };

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(1000px, 96vw)', height: 'min(700px, 93vh)' }}>
        <div className="panel-title">
          <span>The Standing Water</span>
          <span className="sub">{game.remakeCost.toLocaleString()} gold · you have {p.gold.toLocaleString()}</span>
          <button className="close-x" onClick={() => game.closeAll()}>&times;</button>
        </div>

        <div className="remake-layout">
          <div className="remake-mirror">
            <div className="remake-side">
              <div className="rm-label">Now</div>
              <SpritePreview look={p.look()} scale={4} />
              <div className="rm-race">{current.name}</div>
              <div className="rm-stats">{statLine(current)}</div>
            </div>
            <div className="rm-arrow">&rarr;</div>
            <div className="remake-side">
              <div className="rm-label" style={{ color: '#6fd0e8' }}>After</div>
              <SpritePreview look={preview} scale={4} />
              <div className="rm-race" style={{ color: '#6fd0e8' }}>{raceDef.name}</div>
              <div className="rm-stats">{statLine(raceDef)}</div>
            </div>
          </div>

          <div className="inv-col scroll" style={{ overflowY: 'auto', flex: 1 }}>
            <div className="section-h">What you would be</div>
            <div className="retrain-grid">
              {RACES.map((r) => (
                <button
                  key={r.id}
                  className={`pick-card ${r.id === race ? 'active' : ''}`}
                  onClick={() => { setRace(r.id); setSkin(0); setHair(0); }}
                >
                  <span className="pc-name">{r.name}{r.id === p.race ? ' (as you are)' : ''}</span>
                  <span className="pc-sub">{statLine(r)}</span>
                  <span className="pc-stats">{r.perk}</span>
                </button>
              ))}
            </div>

            <div className="section-h">The face</div>
            <div className="remake-rows">
              <Row label="Skin">
                {raceDef.look.skins.map((c, i) => (
                  <button
                    key={c + i}
                    className={`swatch ${i === skinIndex % raceDef.look.skins.length ? 'on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setSkin(i)}
                    title={`Skin ${i + 1}`}
                  />
                ))}
              </Row>
              <Row label="Hair">
                {raceDef.look.hairs.map((c, i) => (
                  <button
                    key={c + i}
                    className={`swatch ${i === hairIndex % raceDef.look.hairs.length ? 'on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setHair(i)}
                    title={`Hair ${i + 1}`}
                  />
                ))}
              </Row>
              <Row label="Style">
                {HAIR_STYLES.map((h) => (
                  <button key={h} className={`filter-chip ${h === hairStyle ? 'active' : ''}`} onClick={() => setHairStyle(h)}>{h}</button>
                ))}
              </Row>
              <Row label="Beard">
                {BEARDS.map((b) => (
                  <button key={b} className={`filter-chip ${b === beard ? 'active' : ''}`} onClick={() => setBeard(b)}>{b}</button>
                ))}
              </Row>
            </div>

            <div className="remake-note">
              You keep your level, your talents, your gear, your gold and everything anyone owes you. The
              {' '}
              {RACES.find((r) => r.id === race)!.name} bonuses replace the {current.name} ones, and your standing with
              the six factions is unchanged — though the people in them may look at you differently.
              {p.reputation ? (
                <div style={{ marginTop: 8, color: 'var(--muted)' }}>
                  Your reputation stays where it is: {repTier(p.rep('alliance')).label} with the Valley Alliance,
                  {' '}{repTier(p.rep('arcane')).label} with the Concord.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="inv-detail-actions" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={() => game.closeAll()}>Not today</button>
          <button
            className="btn primary"
            disabled={!afford || unchanged}
            title={!afford ? 'You cannot pay for this' : unchanged ? 'That is what you already are' : undefined}
            onClick={() => game.remakeCharacter(race, { skinIndex, hairIndex, hairStyle, beard })}
          >
            {unchanged ? 'Nothing would change' : `Go under · ${game.remakeCost.toLocaleString()}g`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="remake-row">
      <span className="rr-label">{label}</span>
      <span className="rr-items">{children}</span>
    </div>
  );
}
