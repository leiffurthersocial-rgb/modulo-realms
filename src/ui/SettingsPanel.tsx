import type { ReactNode } from 'react';
import type { Game } from '../game/core/game';
import { audio } from '../game/audio/audio';
import { DEFAULT_BINDINGS } from '../game/core/input';
import { KeyCap, Modal, Slider, Toggle, keyLabel } from './kit';

export default function SettingsPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const s = game.settings;
  const set = (patch: Partial<typeof s>) => {
    Object.assign(game.settings, patch);
    audio.setVolumes(game.settings.master, game.settings.music, game.settings.sfx);
    game.touch();
  };

  return (
    <Modal title="Settings" size="m" tall onClose={onClose}>
      <div className="scroll" style={{ flex: 1, paddingRight: 2 }}>
        <div className="section-h">Audio</div>
        <Volume label="Master" value={s.master} onChange={(v) => set({ master: v })} />
        <Volume label="Music" value={s.music} onChange={(v) => set({ music: v })} />
        <Volume label="Effects" value={s.sfx} onChange={(v) => set({ sfx: v })} />

        <div className="section-h">Display</div>
        <Switch label="Damage numbers" checked={s.showDamage} onChange={(v) => set({ showDamage: v })} />
        <Switch label="Vital numbers" checked={s.showNumbers} onChange={(v) => set({ showNumbers: v })}>
          Always show the numbers on the health, mana and stamina bars, not only when you point at them.
        </Switch>
        <Switch
          label="Minimap"
          checked={game.showMinimap}
          onChange={(v) => { game.showMinimap = v; game.touch(); }}
        />

        <div className="section-h">Power</div>
        <Switch label="Battery saver" checked={s.batterySaver} onChange={(v) => set({ batterySaver: v })}>
          Runs at 30 frames a second instead of 60 and spends less on lighting, sparks and weather.
          Nothing about the game changes — it just costs a tablet far less to play.
        </Switch>

        <div className="section-h">Controls</div>
        <Switch label="On-screen controls" checked={s.touchControls} onChange={(v) => set({ touchControls: v })}>
          A thumbstick and buttons for playing by touch. The stick is analog — a light push walks, a full
          push runs — and it recentres wherever your thumb lands. Keyboard and mouse keep working either way.
        </Switch>

        <div className="settings-keys" style={{ marginTop: 4 }}>
          {(Object.keys(DEFAULT_BINDINGS) as Array<keyof typeof DEFAULT_BINDINGS>).map((k) => (
            <div key={k}>
              <span style={{ textTransform: 'capitalize' }}>{k}</span>
              <span style={{ display: 'inline-flex', gap: 1 }}>
                {DEFAULT_BINDINGS[k].map((c) => <KeyCap key={c}>{keyLabel(c)}</KeyCap>)}
              </span>
            </div>
          ))}
          <div><span>Attack</span><KeyCap>L-click</KeyCap></div>
          <div><span>Heavy / block</span><KeyCap>R-click</KeyCap></div>
        </div>
      </div>
    </Modal>
  );
}

function Volume({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="setting-row">
      <span className="sr-k">{label}</span>
      <Slider label={`${label} volume`} value={value} onChange={onChange} width={140} />
      <span className="val">{Math.round(value * 100)}%</span>
    </div>
  );
}

function Switch({ label, checked, onChange, children }: { label: string; checked: boolean; onChange: (v: boolean) => void; children?: ReactNode }) {
  return (
    <>
      <div className="setting-row">
        <span className="sr-k">{label}</span>
        <Toggle label={label} checked={checked} onChange={onChange} />
      </div>
      {children ? <p className="note" style={{ margin: '0 0 4px 104px' }}>{children}</p> : null}
    </>
  );
}
