import { useEffect, useRef } from 'react';
import { PAL, withAlpha } from '../game/art/palette';
import { getProp, type PropArt } from '../game/art/props';
import { ANIM, ROW, getCharacterSheet, weaponStyle, type Look } from '../game/art/characters';
import { RNG } from '../game/core/rng';
import { useUiMetrics } from './kit';

/**
 * The title vista: a pixel diorama of the valley, drawn from the game's own
 * art rather than from shapes invented for the menu.
 *
 * The old version was three sine-wave ridges and a circle for a moon, which
 * is a perfectly good placeholder and looks like nothing else in the game.
 * Everything standing on the ridge here — the shrine, the waystone, the dead
 * ash trees, the figure looking down at it — is the same generator the world
 * uses, so the first screen is made of the thing it is advertising.
 *
 * The scene is the fiction in one frame: the last lit shrine, a waystone
 * still humming, the Modulo torn open over the mountains, and ash coming
 * down on all of it.
 */

/** Firelight flicker, shared by the shrine's glow and the lit lip of its ledge. */
const pulseFire = (t: number) => 0.72 + 0.16 * Math.sin(t * 2.1) + 0.06 * Math.sin(t * 5.7);

/** Render width. The whole scene is drawn at this, then scaled up, so it stays pixel art. */
const VW = 480;
const VH = 270;

type Silhouette = { canvas: HTMLCanvasElement; w: number; h: number; anchorY: number };

/**
 * A prop flattened to one colour. Trees on a far ridge read as shape only,
 * and tinting per frame with a canvas filter is far too slow for sixty of
 * them, so each one is baked once and then stamped.
 */
function silhouette(art: PropArt, color: string, alpha: number): Silhouette {
  const c = document.createElement('canvas');
  c.width = art.fw;
  c.height = art.fh;
  const g = c.getContext('2d')!;
  g.drawImage(art.canvas, 0, 0, art.fw, art.fh, 0, 0, art.fw, art.fh);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, art.fw, art.fh);
  g.globalCompositeOperation = 'source-over';
  const out = document.createElement('canvas');
  out.width = art.fw;
  out.height = art.fh;
  const og = out.getContext('2d')!;
  og.globalAlpha = alpha;
  og.drawImage(c, 0, 0);
  return { canvas: out, w: art.fw, h: art.fh, anchorY: art.anchorY };
}

/** The figure on the ridge: a lone traveller, hooded, sword at their side. */
const WANDERER: Look = {
  skin: PAL.skin3,
  hair: '#3a2a1e',
  hairStyle: 'short',
  beard: 'stubble',
  shirt: '#4a3a58',
  pants: '#2e2536',
  boots: '#3a2a1e',
  belt: '#2a1c14',
  cape: '#6a2f2a',
  armor: 'light',
  armorColor: '#5a4a3a',
  armorTrim: PAL.gold,
  helmet: 'hood',
  height: 1,
  bulk: 1,
  weapon: weaponStyle('sword', PAL.steel),
  offhand: 'none',
};

export default function TitleArt() {
  const ref = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  // Cover the window by a whole number of device pixels per scene pixel and
  // crop the overflow from the middle; a fractional stretch would make some
  // pixels one screen pixel fatter than their neighbours.
  const ui = useUiMetrics();
  const k = Math.max(1, Math.ceil(Math.max((ui.w * ui.device) / VW, (ui.h * ui.device) / VH)));
  const size = { width: (VW * k) / ui.device, height: (VH * k) / ui.device };

  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext('2d')!;
    canvas.width = VW;
    canvas.height = VH;
    g.imageSmoothingEnabled = false;

    const rng = new RNG('title-vista');

    const stars = Array.from({ length: 220 }, () => ({
      x: rng.next(),
      y: rng.next() * 0.62,
      s: rng.next() < 0.14 ? 2 : 1,
      tw: rng.range(0, 6.28),
      sp: rng.range(0.4, 1.7),
    }));

    // Ash on the way down, embers on the way up. The two together are most
    // of what sells the valley as a place that has recently been on fire.
    const ash = Array.from({ length: 150 }, () => ({
      x: rng.next() * VW,
      y: rng.next() * VH,
      v: rng.range(3, 11),
      drift: rng.range(0.3, 1.5),
      ph: rng.range(0, 6.28),
      s: rng.next() < 0.2 ? 2 : 1,
      a: rng.range(0.18, 0.6),
    }));
    const embers = Array.from({ length: 34 }, () => ({
      x: rng.range(0, VW),
      y: rng.range(VH * 0.6, VH),
      v: rng.range(5, 14),
      ph: rng.range(0, 6.28),
      hot: rng.next() < 0.45,
    }));

    // Pine ranks for the mid-ground treeline, and the dead ash wood nearer in.
    const pineArt = getProp('tree_pine');
    const deadArt = getProp('tree_dead');
    const ashTreeArt = getProp('tree_ash');
    const farPine = silhouette(pineArt, '#171226', 1);
    const midPine = silhouette(pineArt, '#100d1e', 1);
    const nearDead = silhouette(deadArt, '#0a0813', 1);
    const nearAsh = silhouette(ashTreeArt, '#0c0a16', 1);

    const farTrees = Array.from({ length: 46 }, () => ({
      x: rng.range(-20, VW + 20),
      s: rng.range(0.4, 0.62),
      art: farPine,
    }));
    const midTrees = Array.from({ length: 34 }, () => ({
      x: rng.range(-24, VW + 24),
      s: rng.range(0.6, 0.95),
      art: rng.next() < 0.78 ? midPine : nearAsh,
    }));
    const nearTrees = [
      { x: 26, s: 1.25, art: nearDead },
      { x: 70, s: 0.95, art: nearAsh },
      { x: VW - 40, s: 1.35, art: nearDead },
      { x: VW - 96, s: 1.05, art: nearAsh },
    ];

    // Everything on the shrine ledge is real world art, drawn at full colour.
    const shrine = getProp('shrine');
    const waystone = getProp('waystone');
    const brazier = getProp('brazier');
    const grave = getProp('gravestone');
    const sheet = getCharacterSheet(WANDERER);

    const townLights = Array.from({ length: 34 }, () => ({
      x: rng.range(VW * 0.08, VW * 0.92),
      y: rng.range(0, 5),
      ph: rng.range(0, 6.28),
      warm: rng.next() < 0.7,
    }));

    /** A ridge line, cached per layer so the silhouette is stable frame to frame. */
    const ridge = (seed: number, baseY: number, amp: number, color: string, shift: number) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(-8, VH);
      for (let x = -8; x <= VW + 8; x += 2) {
        const n =
          Math.sin((x + shift) * 0.013 + seed) * amp +
          Math.sin((x + shift) * 0.034 + seed * 2.3) * amp * 0.34 +
          Math.sin((x + shift) * 0.006 + seed * 3.7) * amp * 0.7;
        g.lineTo(x, baseY + n);
      }
      g.lineTo(VW + 8, VH);
      g.closePath();
      g.fill();
    };

    const ridgeY = (seed: number, baseY: number, amp: number, shift: number, x: number) =>
      baseY +
      Math.sin((x + shift) * 0.013 + seed) * amp +
      Math.sin((x + shift) * 0.034 + seed * 2.3) * amp * 0.34 +
      Math.sin((x + shift) * 0.006 + seed * 3.7) * amp * 0.7;

    const stamp = (s: Silhouette, x: number, y: number, scale: number) => {
      const w = s.w * scale;
      const h = s.h * scale;
      g.drawImage(s.canvas, 0, 0, s.w, s.h, Math.round(x - w / 2), Math.round(y - s.anchorY * scale), w, h);
    };

    const prop = (a: PropArt, x: number, y: number, scale: number, t: number) => {
      const frame = a.frames > 1 ? Math.floor(t * a.fps) % a.frames : 0;
      const w = a.fw * scale;
      const h = a.fh * scale;
      g.drawImage(
        a.canvas,
        frame * a.fw, 0, a.fw, a.fh,
        Math.round(x - w / 2), Math.round(y - a.anchorY * scale), w, h,
      );
    };

    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      // Parallax leans toward the cursor, a couple of pixels at the back and
      // rather more at the front, which is enough to give the scene depth
      // without ever looking like the layers are sliding apart.
      const px = mouse.current.x;
      const py = mouse.current.y;

      /* --- sky --- */
      // The warm end of this has to land ABOVE the first ridge line or it is
      // simply never seen: the ridges paint from their crest all the way to
      // the bottom of the frame. The band from 0.52 to 0.70 is the part that
      // shows through, so that is where the fire in the sky goes.
      const sky = g.createLinearGradient(0, 0, 0, VH);
      sky.addColorStop(0, '#05040d');
      sky.addColorStop(0.26, '#0e0a20');
      sky.addColorStop(0.44, '#2a1c46');
      sky.addColorStop(0.54, '#6d3552');
      sky.addColorStop(0.61, '#b0603a');
      sky.addColorStop(0.67, '#e09a4e');
      sky.addColorStop(0.73, '#f0c070');
      sky.addColorStop(1, '#f0c070');
      g.fillStyle = sky;
      g.fillRect(0, 0, VW, VH);

      /* --- stars --- */
      for (const s of stars) {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * s.sp + s.tw));
        const y = s.y * VH - py * 1.5;
        if (y < -2) continue;
        g.globalAlpha = tw * (1 - s.y * 0.9);
        g.fillStyle = '#e9e4ff';
        g.fillRect(Math.round(s.x * VW - px * 1.5), Math.round(y), s.s, s.s);
      }
      g.globalAlpha = 1;

      /* --- the Modulo, torn open over the range --- */
      // A slow arcane aurora. It is the one thing in the sky that is not
      // weather, and it is why the valley is the way it is.
      for (let band = 0; band < 3; band++) {
        const amp = 9 + band * 5;
        const yBase = VH * (0.17 + band * 0.055) - py * 2;
        g.beginPath();
        for (let x = 0; x <= VW; x += 4) {
          const y =
            yBase +
            Math.sin(x * 0.014 + t * 0.32 + band * 1.6) * amp +
            Math.sin(x * 0.005 - t * 0.19 + band) * amp * 0.6;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        const grad = g.createLinearGradient(0, yBase - 24, 0, yBase + 30);
        grad.addColorStop(0, withAlpha(PAL.arcaneLit, 0));
        grad.addColorStop(0.5, withAlpha(band === 1 ? PAL.frost : PAL.arcaneLit, 0.3 - band * 0.07));
        grad.addColorStop(1, withAlpha(PAL.arcane, 0));
        g.strokeStyle = grad;
        g.lineWidth = 10 - band * 2;
        g.globalAlpha = 0.55;
        g.stroke();
      }
      g.globalAlpha = 1;

      /* --- moon --- */
      const mx = VW * 0.79 - px * 2;
      const my = VH * 0.19 - py * 2;
      const halo = g.createRadialGradient(mx, my, 2, mx, my, 40);
      halo.addColorStop(0, 'rgba(255,246,224,0.34)');
      halo.addColorStop(1, 'rgba(255,246,224,0)');
      g.fillStyle = halo;
      g.fillRect(mx - 40, my - 40, 80, 80);
      g.fillStyle = '#f6efd8';
      g.beginPath();
      g.arc(mx, my, 13, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(196,186,164,0.55)';
      for (const c of [[-4, -3, 3], [3, 2, 2.2], [-1, 5, 1.6], [6, -4, 1.3]]) {
        g.beginPath();
        g.arc(mx + c[0], my + c[1], c[2], 0, Math.PI * 2);
        g.fill();
      }

      /* --- mountains, far to near --- */
      // Each range is darker than the one behind it, so depth reads even
      // where the silhouettes overlap.
      const farY = VH * 0.635 - py * 1.2;
      ridge(1.2, farY, 14, '#3b2d52', -px * 2);
      // Snow on the crests, catching what is left of the sun.
      g.save();
      g.beginPath();
      g.moveTo(-8, VH);
      for (let x = -8; x <= VW + 8; x += 2) g.lineTo(x, ridgeY(1.2, farY, 14, -px * 2, x));
      g.lineTo(VW + 8, VH);
      g.closePath();
      g.clip();
      for (let x = -8; x <= VW + 8; x += 2) {
        const y = ridgeY(1.2, farY, 14, -px * 2, x);
        g.fillStyle = 'rgba(244,206,178,0.5)';
        g.fillRect(x, y, 2, 2);
        g.fillStyle = 'rgba(212,170,168,0.22)';
        g.fillRect(x, y + 2, 2, 4);
      }
      g.restore();

      ridge(3.4, VH * 0.705 - py * 2.2, 15, '#241b3c', -px * 4);
      ridge(5.8, VH * 0.765 - py * 3.4, 10, '#171129', -px * 7);

      /* --- Ashvale, down in the valley --- */
      const townY = VH * 0.783 - py * 3.4;
      for (const l of townLights) {
        g.globalAlpha = 0.45 + 0.5 * Math.abs(Math.sin(t * 1.6 + l.ph));
        g.fillStyle = l.warm ? PAL.flameLit : PAL.goldLit;
        g.fillRect(Math.round(l.x - px * 7), Math.round(townY + l.y), 1, 1);
      }
      g.globalAlpha = 1;

      /* --- treelines --- */
      const farBase = VH * 0.805 - py * 5;
      for (const tr of farTrees) stamp(tr.art, tr.x - px * 5, farBase, tr.s);
      ridge(8.1, VH * 0.822 - py * 6, 6, '#120d22', -px * 10);

      const midBase = VH * 0.845 - py * 8;
      for (const tr of midTrees) stamp(tr.art, tr.x - px * 8, midBase, tr.s);

      /* --- the shrine ledge --- */
      const ledgeY = VH * 0.855 - py * 11;
      const groundAt = (x: number) =>
        ledgeY + Math.sin((x - px * 12) * 0.02 + 9.3) * 3 + Math.sin((x - px * 12) * 0.05) * 1.5;

      g.fillStyle = '#0c0917';
      g.beginPath();
      g.moveTo(-8, VH);
      for (let x = -8; x <= VW + 8; x += 3) g.lineTo(x, groundAt(x));
      g.lineTo(VW + 8, VH);
      g.closePath();
      g.fill();

      // A lit lip along the crest. Without it the ledge and the treeline
      // behind it are the same black and the props read as floating.
      for (let x = -8; x <= VW + 8; x += 2) {
        const y = groundAt(x);
        const nearFire = Math.max(
          0,
          1 - Math.abs(x - (VW * 0.6 - px * 12)) / 130,
          1 - Math.abs(x - (VW * 0.3 - px * 12)) / 70,
        );
        g.fillStyle = withAlpha(PAL.ember, 0.1 + 0.5 * nearFire * pulseFire(t));
        g.fillRect(x, Math.round(y), 2, 1);
        g.fillStyle = 'rgba(120,96,120,0.16)';
        g.fillRect(x, Math.round(y) + 1, 2, 2);
      }

      /* --- what is standing on it --- */
      // Scales are set against each other rather than left at 1: a waystone
      // is authored at 72x88 and a shrine at 40x48, so at equal scale the
      // stone swallows the whole ledge.
      const ox = -px * 12;
      const shrineX = VW * 0.6 + ox;
      const shrineY = groundAt(shrineX) + 2;

      // The shrine's own light, thrown on the ground around it. This is the
      // brightest thing below the horizon and the reason the scene reads as
      // "one fire still lit" rather than "a dark hillside".
      const pulse = pulseFire(t);
      const glow = g.createRadialGradient(shrineX, shrineY - 16, 2, shrineX, shrineY - 16, 76);
      glow.addColorStop(0, withAlpha(PAL.flameLit, 0.6 * pulse));
      glow.addColorStop(0.3, withAlpha(PAL.flame, 0.3 * pulse));
      glow.addColorStop(0.65, withAlpha(PAL.ember, 0.12 * pulse));
      glow.addColorStop(1, withAlpha(PAL.ember, 0));
      g.fillStyle = glow;
      g.fillRect(shrineX - 78, shrineY - 92, 156, 156);

      const waystoneX = VW * 0.81 + ox;
      const waystoneY = groundAt(waystoneX) + 2;
      const wpulse = 0.5 + 0.22 * Math.sin(t * 1.15);
      const wglow = g.createRadialGradient(waystoneX, waystoneY - 18, 2, waystoneX, waystoneY - 18, 52);
      wglow.addColorStop(0, withAlpha(PAL.arcaneLit, 0.42 * wpulse));
      wglow.addColorStop(0.5, withAlpha(PAL.arcane, 0.16 * wpulse));
      wglow.addColorStop(1, withAlpha(PAL.arcane, 0));
      g.fillStyle = wglow;
      g.fillRect(waystoneX - 54, waystoneY - 68, 108, 108);

      g.save();
      g.globalCompositeOperation = 'lighter';
      const pool = g.createRadialGradient(shrineX, shrineY, 2, shrineX, shrineY, 68);
      pool.addColorStop(0, withAlpha(PAL.flame, 0.3 * pulse));
      pool.addColorStop(1, withAlpha(PAL.flame, 0));
      g.fillStyle = pool;
      g.fillRect(shrineX - 70, shrineY - 16, 140, 34);
      g.restore();

      prop(grave, VW * 0.2 + ox, groundAt(VW * 0.2 + ox) + 2, 0.6, t);
      prop(waystone, waystoneX, waystoneY, 0.5, t);
      prop(shrine, shrineX, shrineY, 0.8, t);
      prop(brazier, VW * 0.3 + ox, groundAt(VW * 0.3 + ox) + 2, 0.62, t);

      // The traveller, looking down the valley at all of it.
      const heroX = VW * 0.7 + ox;
      const heroY = groundAt(heroX) + 2;
      const a = ANIM.idle;
      const col = a.from + (Math.floor(t * a.fps) % a.frames);
      const row = ROW.right;
      const hs = 0.95;
      g.drawImage(
        sheet.canvas,
        col * sheet.fw, row * sheet.fh, sheet.fw, sheet.fh,
        Math.round(heroX - (sheet.fw * hs) / 2),
        Math.round(heroY - sheet.feet * hs),
        sheet.fw * hs, sheet.fh * hs,
      );

      /* --- foreground trees, almost black --- */
      for (const tr of nearTrees) stamp(tr.art, tr.x - px * 18, VH + 6 - py * 16, tr.s);

      /* --- embers off the fires --- */
      for (const e of embers) {
        e.y -= e.v * 0.016;
        if (e.y < VH * 0.5) {
          e.y = VH * 0.9;
          e.x = rng.next() < 0.6 ? shrineX + rng.range(-10, 10) : VW * 0.3 + ox + rng.range(-7, 7);
        }
        const fade = Math.max(0, (e.y - VH * 0.5) / (VH * 0.42));
        g.globalAlpha = 0.75 * fade;
        g.fillStyle = e.hot ? PAL.flameLit : PAL.ember;
        g.fillRect(Math.round(e.x + Math.sin(t * 1.6 + e.ph) * 4), Math.round(e.y), 1, 1);
      }
      g.globalAlpha = 1;

      /* --- ash, coming down on everything --- */
      for (const f of ash) {
        f.y += f.v * 0.016;
        if (f.y > VH) {
          f.y = -2;
          f.x = rng.range(0, VW);
        }
        g.globalAlpha = f.a;
        g.fillStyle = f.s > 1 ? PAL.bone : PAL.fog;
        g.fillRect(Math.round(f.x + Math.sin(t * f.drift + f.ph) * 7), Math.round(f.y), f.s, f.s);
      }
      g.globalAlpha = 1;

      /* --- vignette, so the menu text always has something to sit on --- */
      const vig = g.createRadialGradient(VW / 2, VH * 0.46, VH * 0.3, VW / 2, VH * 0.5, VH * 0.95);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.44)');
      g.fillStyle = vig;
      g.fillRect(0, 0, VW, VH);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMove);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return <canvas ref={ref} className="title-art" style={size} />;
}
