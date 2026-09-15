import { useMemo, useState } from 'react';
import { CLASSES, type ClassId } from '../data/classes';
import { RACES, type RaceId } from '../data/races';
import type { Look } from '../game/art/characters';
import type { PlayerInit } from '../game/player/player';
import { PAL } from '../game/art/palette';
import SpritePreview from './SpritePreview';

const HAIR_STYLES: Array<Look['hairStyle']> = ['short', 'long', 'ponytail', 'braid', 'mohawk', 'wild', 'bald'];
const BEARDS: Array<NonNullable<Look['beard']>> = ['none', 'stubble', 'full', 'long'];

const NAME_POOL = [
  'Ashe', 'Torvin', 'Maela', 'Rurik', 'Sennah', 'Balen', 'Ysra', 'Corwin',
  'Nira', 'Halvard', 'Eska', 'Dain', 'Vessa', 'Orin', 'Thal', 'Bryndis',
];

interface Props {
  onStart: (init: PlayerInit) => void;
  onBack: () => void;
}

export default function CharacterCreation({ onStart, onBack }: Props) {
  const [name, setName] = useState('');
  const [race, setRace] = useState<RaceId>('human');
  const [cls, setCls] = useState<ClassId>('warrior');
  const [skinIndex, setSkin] = useState(0);
  const [hairIndex, setHair] = useState(0);
  const [hairStyle, setHairStyle] = useState<Look['hairStyle']>('short');
  const [beard, setBeard] = useState<NonNullable<Look['beard']>>('none');

  const raceDef = RACES.find((r) => r.id === race)!;
  const classDef = CLASSES.find((c) => c.id === cls)!;

  const look: Look = useMemo(() => ({
    skin: raceDef.look.skins[skinIndex % raceDef.look.skins.length],
    hair: raceDef.look.hairs[hairIndex % raceDef.look.hairs.length],
    hairStyle,
    beard,
    shirt: classDef.look.shirt,
    pants: classDef.look.pants,
    boots: '#4a3324',
    belt: '#33231a',
    cape: classDef.look.cape ?? null,
    armor: classDef.look.armor,
    armorColor: classDef.look.armor === 'heavy' ? PAL.iron : classDef.look.armor === 'light' ? PAL.wood : classDef.look.shirt,
    armorTrim: PAL.gold,
    helmet: classDef.look.helmet,
    ears: raceDef.look.ears,
    tusks: raceDef.look.tusks,
    height: raceDef.look.height,
    bulk: raceDef.look.bulk,
    eyes: raceDef.look.eyes,
    weapon: { kind: classDef.weapons[0], metal: PAL.iron, grip: '#33231a' },
    offhand: classDef.look.offhand ?? 'none',
  }), [raceDef, classDef, skinIndex, hairIndex, hairStyle, beard]);

  const finalName = name.trim() || NAME_POOL[(hairIndex + skinIndex) % NAME_POOL.length];

  const totals = useMemo(() => {
    const b = classDef.base;
    const r = raceDef.stats;
    return [
      ['Health', Math.round(b.health + (r.vitality ?? 0) * 5)],
      ['Mana', Math.round(b.mana + (r.intelligence ?? 0) * 3)],
      ['Strength', b.strength + (r.strength ?? 0)],
      ['Dexterity', b.dexterity + (r.dexterity ?? 0)],
      ['Intelligence', b.intelligence + (r.intelligence ?? 0)],
      ['Defense', b.defense + (r.defense ?? 0)],
      ['Crit Chance', `${b.critChance + (r.critChance ?? 0)}%`],
      ['Move Speed', b.moveSpeed + (r.moveSpeed ?? 0)],
    ] as Array<[string, string | number]>;
  }, [classDef, raceDef]);

  return (
    <div className="creation">
      <div className="creation-preview">
        <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.18em', color: 'var(--gold)', fontSize: 13, textTransform: 'uppercase', marginBottom: 18 }}>
          Your Character
        </div>
        <SpritePreview look={look} scale={5} />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 21 }}>{finalName}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 3 }}>
            {raceDef.name} · {classDef.name}
          </div>
        </div>
        <div style={{ width: '100%', marginTop: 20 }}>
          {totals.map(([k, v]) => (
            <div className="kv" key={k}><span className="k">{k}</span><span>{v}</span></div>
          ))}
        </div>
        <div className="perk" style={{ marginTop: 16, textAlign: 'center' }}>{raceDef.perk}</div>
      </div>

      <div className="creation-body">
        <div className="creation-scroll scroll">
          <div className="field-label">Name</div>
          <input
            className="name-input"
            value={name}
            maxLength={18}
            placeholder={NAME_POOL[(hairIndex + skinIndex) % NAME_POOL.length]}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="field-label">Race</div>
          <div className="card-grid">
            {RACES.map((r) => (
              <button
                key={r.id}
                className={`pick-card ${r.id === race ? 'active' : ''}`}
                onClick={() => { setRace(r.id); setSkin(0); setHair(0); }}
              >
                <span className="pc-name">{r.name}</span>
                <span className="pc-stats">
                  {Object.entries(r.stats).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k.slice(0, 3).toUpperCase()}`).join('  ')}
                </span>
              </button>
            ))}
          </div>
          <p className="blurb">{raceDef.blurb}</p>

          <div className="field-label">Class</div>
          <div className="card-grid">
            {CLASSES.map((c) => (
              <button key={c.id} className={`pick-card ${c.id === cls ? 'active' : ''}`} onClick={() => setCls(c.id)}>
                <span className="pc-name" style={{ color: c.id === cls ? c.color : undefined }}>{c.name}</span>
                <span className="pc-sub">{c.playstyle}</span>
              </button>
            ))}
          </div>
          <p className="blurb">{classDef.blurb}</p>
          <p className="perk">
            Starting abilities: {classDef.abilities.map((a) => a.name).join(' · ')}
          </p>

          <div className="field-label">Appearance</div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 7 }}>Skin</div>
              <div className="swatch-row">
                {raceDef.look.skins.map((c, i) => (
                  <button key={c} className={`swatch ${i === skinIndex ? 'active' : ''}`} style={{ background: c }} onClick={() => setSkin(i)} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 7 }}>Hair colour</div>
              <div className="swatch-row">
                {raceDef.look.hairs.map((c, i) => (
                  <button key={c} className={`swatch ${i === hairIndex ? 'active' : ''}`} style={{ background: c }} onClick={() => setHair(i)} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 7 }}>Hair style</div>
            <div className="chip-row">
              {HAIR_STYLES.map((h) => (
                <button key={h} className={`chip ${h === hairStyle ? 'active' : ''}`} onClick={() => setHairStyle(h)}>{h}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 14, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 7 }}>Facial hair</div>
            <div className="chip-row">
              {BEARDS.map((b) => (
                <button key={b} className={`chip ${b === beard ? 'active' : ''}`} onClick={() => setBeard(b)}>{b}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="creation-foot">
          <button className="btn" onClick={onBack}>Back</button>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>
            Your race and class change dialogue, prices and which quests open to you.
          </div>
          <button
            className="btn primary"
            onClick={() => onStart({ name: finalName, race, cls, hairIndex, skinIndex, hairStyle, beard })}
          >
            Begin the journey
          </button>
        </div>
      </div>
    </div>
  );
}
