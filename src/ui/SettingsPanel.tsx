import type { Game } from '../game/core/game';
import { audio } from '../game/audio/audio';
import { DEFAULT_BINDINGS } from '../game/core/input';

export default function SettingsPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const s = game.settings;
  const set = (patch: Partial<typeof s>) => {
    Object.assign(game.settings, patch);
    audio.setVolumes(game.settings.master, game.settings.music, game.settings.sfx);
    game.touch();
  };

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal panel" style={{ width: 520 }}>
        <div className="panel-title">
          <span>Settings</span>
          <button className="close-x" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="section-h">Audio</div>
          <Slider label="Master volume" value={s.master} onChange={(v) => set({ master: v })} />
          <Slider label="Music volume" value={s.music} onChange={(v) => set({ music: v })} />
          <Slider label="Effects volume" value={s.sfx} onChange={(v) => set({ sfx: v })} />

          <div className="section-h">Display</div>
          <div className="setting-row">
            <label htmlFor="dmg">Damage numbers</label>
            <input
              id="dmg"
              type="checkbox"
              checked={s.showDamage}
              onChange={(e) => set({ showDamage: e.target.checked })}
              style={{ accentColor: 'var(--gold)', width: 18, height: 18 }}
            />
          </div>
          <div className="setting-row">
            <label htmlFor="mini">Minimap</label>
            <input
              id="mini"
              type="checkbox"
              checked={game.showMinimap}
              onChange={(e) => { game.showMinimap = e.target.checked; game.touch(); }}
              style={{ accentColor: 'var(--gold)', width: 18, height: 18 }}
            />
          </div>

          <div className="section-h">Power</div>
          <div className="setting-row">
            <label htmlFor="battery">Battery saver</label>
            <input
              id="battery"
              type="checkbox"
              checked={s.batterySaver}
              onChange={(e) => set({ batterySaver: e.target.checked })}
              style={{ accentColor: 'var(--gold)', width: 18, height: 18 }}
            />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6, marginTop: -4 }}>
            Runs at 30 frames a second instead of 60 and spends less on lighting, sparks and weather.
            Nothing about the game changes — it just costs a tablet far less to play. Worth leaving on
            away from a charger.
          </div>

          <div className="section-h">Controls</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.85, columns: 2 }}>
            {(Object.keys(DEFAULT_BINDINGS) as Array<keyof typeof DEFAULT_BINDINGS>).map((k) => (
              <div key={k}>
                <span style={{ textTransform: 'capitalize' }}>{k}</span>
                {': '}
                <kbd style={{ color: 'var(--parchment)' }}>
                  {DEFAULT_BINDINGS[k].map((c) => c.replace('Key', '').replace('Digit', '').replace('Arrow', '')).join(' / ')}
                </kbd>
              </div>
            ))}
            <div>Attack: <kbd style={{ color: 'var(--parchment)' }}>Left click</kbd></div>
            <div>Heavy/Block: <kbd style={{ color: 'var(--parchment)' }}>Right click</kbd></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="setting-row">
      <label>{label}</label>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="val">{Math.round(value * 100)}%</span>
    </div>
  );
}
