import { useEffect, useRef } from 'react';
import { ANIM, ROW, getCharacterSheet, type Look } from '../game/art/characters';

interface Props {
  look: Look;
  scale?: number;
  dir?: 'down' | 'left' | 'right' | 'up';
  anim?: 'idle' | 'walk';
  className?: string;
}

/** Small animated character portrait used in creation, HUD and dialogue. */
export default function SpritePreview({ look, scale = 4, dir = 'down', anim = 'idle', className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const sheet = getCharacterSheet(look);
    canvas.width = sheet.fw * scale;
    canvas.height = sheet.fh * scale;
    const g = canvas.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    let raf = 0;
    const start = performance.now();
    const draw = (t: number) => {
      const elapsed = (t - start) / 1000;
      const a = ANIM[anim];
      const frame = a.from + (Math.floor(elapsed * a.fps) % a.frames);
      g.clearRect(0, 0, canvas.width, canvas.height);
      const row = ROW[dir] ?? 0;
      g.save();
      if (dir === 'left') {
        g.translate(canvas.width, 0);
        g.scale(-1, 1);
      }
      g.drawImage(sheet.canvas, frame * sheet.fw, row * sheet.fh, sheet.fw, sheet.fh, 0, 0, canvas.width, canvas.height);
      g.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [look, scale, dir, anim]);

  return <canvas ref={ref} className={className} />;
}
