import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game } from './game/core/game';
import { render } from './game/core/renderer';
import { audio } from './game/audio/audio';
import { hasSave, loadGame, loadSettings, saveGame, saveSettings } from './game/save/save';
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
import PausePanel from './ui/PausePanel';
import SettingsPanel from './ui/SettingsPanel';
import DeathScreen from './ui/DeathScreen';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = new Game(canvas);
    gameRef.current = g;

    const stored = loadSettings();
    if (stored) {
      g.settings = { ...g.settings, ...stored };
    }
    audio.setVolumes(g.settings.master, g.settings.music, g.settings.sfx);

    const resize = () => {
      const dpr = 1;
      canvas.width = Math.max(640, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(400, Math.floor(canvas.clientHeight * dpr));
      g.camera.zoom = canvas.width > 1700 ? 2.5 : canvas.width > 1100 ? 2 : 1.75;
      g.g.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      g.update(dt);
      if (g.screen === 'playing' || g.screen === 'dead') render(g);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const unlock = () => audio.resume();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    const beforeUnload = () => {
      if (g.screen === 'playing') saveGame(g);
    };
    window.addEventListener('beforeunload', beforeUnload);

    setGame(g);
    return () => {
      cancelAnimationFrame(raf);
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

function UiLayer({ game }: { game: Game }) {
  useSyncExternalStore(game.subscribe, game.getSnapshot);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    audio.setVolumes(game.settings.master, game.settings.music, game.settings.sfx);
  }, [game, game.settings.master, game.settings.music, game.settings.sfx]);

  if (game.screen === 'title') {
    return (
      <div className="overlay">
        <TitleScreen
          game={game}
          hasSave={hasSave()}
          onNew={() => { game.screen = 'creation'; audio.resume(); audio.playMusic('title'); game.touch(); }}
          onContinue={() => { audio.resume(); loadGame(game); }}
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
      <div className="overlay">
        <CharacterCreation
          onBack={() => { game.screen = 'title'; game.touch(); }}
          onStart={(init) => { audio.resume(); game.newGame(init); }}
        />
      </div>
    );
  }

  if (game.screen === 'dead') {
    return (
      <div className="overlay">
        <DeathScreen game={game} />
      </div>
    );
  }

  return (
    <div className="overlay">
      <Hud game={game} />
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
      {game.panel === 'pause' ? <PausePanel game={game} onSettings={() => setShowSettings(true)} /> : null}
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
