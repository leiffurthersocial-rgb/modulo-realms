import { useEffect, useMemo, useRef } from 'react';
import { ANIM, CH_FEET, CH_H, CH_W, ROW, getCharacterSheet, type Look } from '../game/art/characters';

interface Props {
  look: Look;
  scale?: number;
  dir?: 'down' | 'left' | 'right' | 'up';
  anim?: 'idle' | 'walk';
  className?: string;
}

/**
 * Small animated character portrait used in creation, HUD and dialogue. `scale` is a whole number of UI pixels.
 * Always shows the body's 36x44 box: an armed sheet is wider so the blade is
 * not cut in the world, but the panels here are laid out around the body.
 */
export default function SpritePreview({ look, scale = 4, dir = 'down', anim = 'idle', className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // `look` is rebuilt on every render, so key the effect on its contents instead
  // of its identity — otherwise the animation restarts and can end up blank.
  const lookKey = useMemo(() => JSON.stringify(look), [look]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const sheet = getCharacterSheet(JSON.parse(lookKey) as Look);
    // drawn at 1:1 and blown up by the stylesheet, a whole number of times
    const sx = (sheet.fw - CH_W) / 2;
    const sy = sheet.feet - CH_FEET;
    canvas.width = CH_W;
    canvas.height = CH_H;
    canvas.style.width = `${CH_W * scale}px`;
    canvas.style.height = `${CH_H * scale}px`;
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
      g.drawImage(sheet.canvas, frame * sheet.fw + sx, row * sheet.fh + sy, CH_W, CH_H, 0, 0, CH_W, CH_H);
      g.restore();
      raf = requestAnimationFrame(draw);
    };
    draw(start);
    return () => cancelAnimationFrame(raf);
  }, [lookKey, scale, dir, anim]);

  return <canvas ref={ref} className={className} />;
}
