import { useEffect, useRef } from 'react';
import type { Game } from '../game/core/game';
import { savePreview } from '../game/save/save';
import { PAL } from '../game/art/palette';
import { RNG } from '../game/core/rng';

interface Props {
  game: Game;
  hasSave: boolean;
  onNew: () => void;
  onContinue: () => void;
  onSettings: () => void;
}

/** Procedural parallax vista behind the title. */
function TitleArt() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext('2d')!;
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth / 3);
      canvas.height = Math.floor(window.innerHeight / 3);
    };
    resize();
    window.addEventListener('resize', resize);

    const rng = new RNG('title-art');
    const stars = Array.from({ length: 160 }, () => ({ x: rng.next(), y: rng.next() * 0.55, s: rng.range(0.4, 1.4) }));
    const embers = Array.from({ length: 60 }, () => ({ x: rng.next(), y: rng.next(), v: rng.range(0.02, 0.09), w: rng.range(0, 6) }));

    const ridgeLayer = (seedBase: number, baseY: number, amp: number, color: string, t: number, speed: number) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, canvas.height);
      for (let x = 0; x <= canvas.width; x += 3) {
        const n = Math.sin((x + t * speed) * 0.011 + seedBase) * amp
          + Math.sin((x + t * speed) * 0.031 + seedBase * 2) * amp * 0.4
          + Math.sin((x + t * speed) * 0.007 + seedBase * 3) * amp * 0.7;
        g.lineTo(x, baseY + n);
      }
      g.lineTo(canvas.width, canvas.height);
      g.closePath();
      g.fill();
    };

    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const w = canvas.width;
      const h = canvas.height;
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#0a0817');
      sky.addColorStop(0.45, '#1d1533');
      sky.addColorStop(0.72, '#4a2a3e');
      sky.addColorStop(1, '#8a4630');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);

      for (const s of stars) {
        g.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(t * 0.6 + s.x * 30));
        g.fillStyle = '#e8e2ff';
        g.fillRect(Math.floor(s.x * w), Math.floor(s.y * h), s.s, s.s);
      }
      g.globalAlpha = 1;

      // moon
      g.fillStyle = 'rgba(240,230,210,0.9)';
      g.beginPath();
      g.arc(w * 0.78, h * 0.2, 16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(200,190,175,0.5)';
      g.beginPath();
      g.arc(w * 0.775, h * 0.195, 4, 0, Math.PI * 2);
      g.arc(w * 0.79, h * 0.21, 3, 0, Math.PI * 2);
      g.fill();

      ridgeLayer(1.2, h * 0.62, 12, '#2a2140', t, 2);
      ridgeLayer(3.4, h * 0.72, 16, '#1d1730', t, 4);
      ridgeLayer(5.8, h * 0.84, 10, '#141024', t, 7);

      // distant town lights
      g.fillStyle = PAL.flameLit;
      for (let i = 0; i < 26; i++) {
        const x = (i * 97) % w;
        const y = h * 0.86 + (i % 4) * 3;
        g.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * 2 + i));
        g.fillRect(x, y, 1, 1);
      }
      g.globalAlpha = 1;

      for (const e of embers) {
        e.y -= e.v * 0.01;
        if (e.y < 0) { e.y = 1; e.x = Math.random(); }
        g.globalAlpha = 0.5 * (e.y * 0.8 + 0.2);
        g.fillStyle = e.w > 3 ? PAL.flame : PAL.flameLit;
        g.fillRect(Math.floor(e.x * w + Math.sin(t + e.w) * 6), Math.floor(e.y * h), 1, 1);
      }
      g.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="title-art" style={{ width: '100%', height: '100%' }} />;
}

export default function TitleScreen({ hasSave, onNew, onContinue, onSettings }: Props) {
  const preview = hasSave ? savePreview() : null;
  return (
    <div className="title-screen">
      <TitleArt />
      <div className="title-main">
        <h1>Modulo</h1>
        <h2>Realms of Ash</h2>
        <div className="title-tag">An open-world fantasy RPG in the Ashvale valley.</div>
      </div>
      <div className="title-menu">
        {preview ? (
          <>
            <button className="btn primary" onClick={onContinue}>Continue</button>
            <div className="save-note">
              {preview.name} · Level {preview.level} {preview.cls} · saved {timeAgo(preview.savedAt)}
            </div>
          </>
        ) : null}
        <button className="btn" onClick={onNew}>New Game</button>
        <button className="btn" onClick={onSettings}>Settings</button>
      </div>
      <div className="title-foot">
        WASD to move · Mouse to aim · Left click attack · E interact · I inventory · M map · ESC menu
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
