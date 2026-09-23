import ShipyardPanel from './ui/ShipyardPanel';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game } from './game/core/game';
import { render } from './game/core/renderer';
import { audio } from './game/audio/audio';
import { TILES } from './game/world/tiles';
import { ALL_TEMPLATES } from './data/items';
import { LOCATIONS } from './data/locations';
import { worldZoom } from './ui/kit/tokens';
import { getLoadError, hasSave, loadGame, loadSettings, saveGame, saveSettings } from './game/save/save';
import TitleScreen from './ui/TitleScreen';
import CharacterCreation from './ui/CharacterCreation';
import Hud from './ui/Hud';
import DialoguePanel from './ui/DialoguePanel';
import InventoryPanel from './ui/InventoryPanel';
import CharacterPanel from './ui/CharacterPanel';
import SkillPanel from './ui/SkillPanel';
import QuestPanel from './ui/QuestPanel';
import MapPanel from './ui/MapPanel';
import ShopPanel from './ui/ShopPanel';
import StoragePanel from './ui/StoragePanel';
import TravelPanel from './ui/TravelPanel';
import ForgePanel from './ui/ForgePanel';
import RemakePanel from './ui/RemakePanel';
import CrownPanel from './ui/CrownPanel';
import PokerPanel from './ui/PokerPanel';
import RoulettePanel from './ui/RoulettePanel';
import SlotsPanel from './ui/SlotsPanel';
import DebugPanel from './ui/DebugPanel';
import PausePanel from './ui/PausePanel';
import HelpPanel from './ui/HelpPanel';
import LootPanel from './ui/LootPanel';
import TouchControls from './ui/TouchControls';
import SettingsPanel from './ui/SettingsPanel';
import DeathScreen from './ui/DeathScreen';
import { uiSound } from './ui/kit/sfx';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = new Game(canvas);
    gameRef.current = g;
    // A handle on the running game, for poking at it from the console and for
    // driving it from a browser test. Vite strips this from a production
    // build, so it never ships.
    if (import.meta.env.DEV) (window as unknown as { game: Game }).game = g;

    const stored = loadSettings();
    if (stored) {
      g.settings = { ...g.settings, ...stored };
    }
    audio.setVolumes(g.settings.master, g.settings.music, g.settings.sfx);

    const resize = () => {
      const dpr = 1;
      canvas.width = Math.max(640, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(400, Math.floor(canvas.clientHeight * dpr));
      // a whole number, so every world pixel is the same size on screen
      g.camera.zoom = worldZoom(canvas.width, canvas.height);
      g.g.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    const visibility = () => {
      last = performance.now();
      accumulator = 0;
      if (document.hidden && g.screen === 'playing') {
        saveGame(g);
        g.input.clearVirtual();
      }
    };
    document.addEventListener('visibilitychange',visibility);
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      // Battery saver renders at 30fps while fixed 60Hz simulation keeps
      // the same committed attacks and movement on both render settings.
      const elapsed = (t - last) / 1000;
      if (g.settings.batterySaver && elapsed < 1 / 32) return;
      const dt = Math.min(0.1, elapsed);
      last = t;
      if(document.hidden) return;
      accumulator=Math.min(accumulator+dt,1/15);
      while(accumulator>=1/60){g.update(1/60);accumulator-=1/60;}
      if (g.screen === 'playing' || g.screen === 'dead') render(g);
    };
    raf = requestAnimationFrame(loop);

    const unlock = () => audio.resume();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    const beforeUnload = () => {
      if (g.screen === 'playing') saveGame(g);
    };
    window.addEventListener('beforeunload', beforeUnload);

    // exposed for the F3 debug overlay and for automated smoke tests
    (window as unknown as { modulo: Game }).modulo = g;
    // the tile table too, so a smoke test can walk the map without guessing ids
    (window as unknown as { moduloTiles: typeof TILES }).moduloTiles = TILES;
    (window as unknown as { moduloTemplates: typeof ALL_TEMPLATES }).moduloTemplates = ALL_TEMPLATES;
    // and the location table, so a test can assert every named place is reachable
    (window as unknown as { moduloLocations: typeof LOCATIONS }).moduloLocations = LOCATIONS;

    setGame(g);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange',visibility);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('beforeunload', beforeUnload);
      g.input.detach();
      audio.stopMusic();
    };
  }, []);

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="world" />
      {game ? <UiLayer game={game} /> : null}
    </div>
  );
}

/**
 * UI sound hooks for every button, in one place: a press is a click and
 * entering a button is a hover (silent until a sound is assigned in
 * `ui/kit/sfx.ts`). Pieces that make their own noise — tabs and toggles,
 * the hotbar, the touch pad, the casino machines — are left alone.
 */
const QUIET = '.tab, .px-toggle, .slot, .touch-btn, canvas, .clickable';
const uiSounds = {
  onPointerDownCapture: (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    const b = t.closest('button');
    if (!b || t.closest(QUIET)) return;
    uiSound((b as HTMLButtonElement).disabled ? 'deny' : 'click');
  },
  onPointerOverCapture: (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    const b = t.closest('button');
    if (!b || t.closest(QUIET)) return;
    const from = (e.relatedTarget as HTMLElement | null)?.closest?.('button');
    if (from !== b) uiSound('hover');
  },
};

function UiLayer({ game }: { game: Game }) {
  useSyncExternalStore(game.subscribe, game.getSnapshot);
  const [showSettings, setShowSettings] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    audio.setVolumes(game.settings.master, game.settings.music, game.settings.sfx);
  }, [game, game.settings.master, game.settings.music, game.settings.sfx]);

  // the in-game reduced-motion switch, on top of the OS preference
  useEffect(() => {
    document.documentElement.dataset.motion = game.settings.reduceMotion ? 'reduced' : '';
  }, [game.settings.reduceMotion]);

  if (game.screen === 'title') {
    return (
      <div className="overlay" {...uiSounds}>
        <TitleScreen
          game={game}
          hasSave={hasSave()}
          loadError={loadError}
          onNew={() => { game.screen = 'creation'; audio.resume(); audio.playMusic('title'); game.touch(); }}
          onContinue={() => { audio.resume(); setLoadError(loadGame(game) ? '' : getLoadError()); }}
          onSettings={() => setShowSettings(true)}
        />
        {showSettings ? (
          <SettingsPanel
            game={game}
            onClose={() => {
              saveSettings(game.settings);
              setShowSettings(false);
            }}
          />
        ) : null}
      </div>
    );
  }

  if (game.screen === 'creation') {
    return (
      <div className="overlay" {...uiSounds}>
        <CharacterCreation
          onBack={() => { game.screen = 'title'; game.touch(); }}
          onStart={(init) => { audio.resume(); game.newGame(init); }}
        />
      </div>
    );
  }

  if (game.screen === 'dead') {
    return (
      <div className="overlay" {...uiSounds}>
        <DeathScreen game={game} />
      </div>
    );
  }

  // `touchMode` on the input stops a tap on the scenery also swinging the
  // weapon, and the class hides the keyboard hint and the desktop ability bar.
  game.input.touchMode = game.settings.touchControls;

  return (
    <div className={`overlay${game.settings.touchControls ? ' touch-on' : ''}`} {...uiSounds}>
      <Hud game={game} />
      {game.settings.touchControls ? <TouchControls game={game} /> : null}
      {game.dialogue ? <DialoguePanel game={game} /> : null}
      {game.panel === 'inventory' ? <InventoryPanel game={game} /> : null}
      {game.panel === 'character' ? <CharacterPanel game={game} /> : null}
      {game.panel === 'skills' ? <SkillPanel game={game} /> : null}
      {game.panel === 'quests' ? <QuestPanel game={game} /> : null}
      {game.panel === 'map' ? <MapPanel game={game} /> : null}
      {game.panel === 'shop' && game.shop ? <ShopPanel game={game} /> : null}
      {game.panel === 'storage' ? <StoragePanel game={game} /> : null}
      {game.panel === 'travel' ? <TravelPanel game={game} /> : null}
      {game.panel === 'forge' ? <ForgePanel game={game} /> : null}
      {game.panel === 'remake' ? <RemakePanel game={game} /> : null}
      {game.panel === 'crown' ? <CrownPanel game={game} /> : null}
      {game.panel === 'shipyard' ? <ShipyardPanel game={game} /> : null}
      {game.panel === 'poker' ? <PokerPanel game={game} /> : null}
      {game.panel === 'slots' ? <SlotsPanel game={game} /> : null}
      {game.panel === 'roulette' ? <RoulettePanel game={game} /> : null}
      {game.panel === 'debug' ? <DebugPanel game={game} /> : null}
      {game.panel === 'pause' ? <PausePanel game={game} onSettings={() => setShowSettings(true)} /> : null}
      {game.panel === 'help' ? <HelpPanel game={game} /> : null}
      {game.panel === 'loot' ? <LootPanel game={game} /> : null}
      {showSettings ? (
        <SettingsPanel
          game={game}
          onClose={() => {
            saveSettings(game.settings);
            setShowSettings(false);
          }}
        />
      ) : null}
    </div>
  );
}
