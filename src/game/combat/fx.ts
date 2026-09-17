import { withAlpha } from '../art/palette';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export interface FloatText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  size: number;
}

export interface Telegraph {
  x: number;
  y: number;
  r: number;
  t: number;
  duration: number;
  color: string;
  shape: 'circle' | 'ring' | 'cone' | 'line';
  angle: number;
}

export interface Ring {
  x: number;
  y: number;
  r: number;
  max: number;
  life: number;
  color: string;
}

export class FxSystem {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  telegraphs: Telegraph[] = [];
  rings: Ring[] = [];
  /**
   * Scales every particle burst. Battery saver turns this down rather than
   * switching effects off, so a hit still reads the same — there is simply
   * less of it to simulate and draw.
   */
  budget = 1;

  spawn(x: number, y: number, count: number, color: string, o: { speed?: number; life?: number; size?: number; gravity?: number; spread?: number; angle?: number } = {}): void {
    const speed = o.speed ?? 90;
    const life = o.life ?? 0.55;
    const size = o.size ?? 3;
    const spread = o.spread ?? Math.PI * 2;
    const base = o.angle ?? 0;
    count = Math.max(1, Math.round(count * this.budget));
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 900) break;
      const a = base + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.9);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        gravity: o.gravity ?? 160,
      });
    }
  }

  text(x: number, y: number, text: string, color: string, size = 13): void {
    if (this.texts.length > 70) this.texts.shift();
    this.texts.push({ x: x + (Math.random() - 0.5) * 10, y, vy: -42, text, color, life: 0.95, size });
  }

  telegraph(x: number, y: number, r: number, duration: number, color: string, shape: Telegraph['shape'] = 'circle', angle = 0): void {
    this.telegraphs.push({ x, y, r, t: 0, duration, color, shape, angle });
  }

  ring(x: number, y: number, r: number, color: string): void {
    this.rings.push({ x, y, r: 6, max: r, life: 0.42, color });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - 2.2 * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { this.texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.vy += 52 * dt;
    }
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.telegraphs[i];
      tg.t += dt;
      if (tg.t >= tg.duration) this.telegraphs.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) { this.rings.splice(i, 1); continue; }
      r.r += (r.max - r.r) * Math.min(1, dt * 9);
    }
  }

  clear(): void {
    this.particles.length = 0;
    this.texts.length = 0;
    this.telegraphs.length = 0;
    this.rings.length = 0;
  }

  draw(g: CanvasRenderingContext2D): void {
    for (const tg of this.telegraphs) {
      const p = Math.min(1, tg.t / tg.duration);
      g.save();
      g.globalAlpha = 0.28 + p * 0.3;
      g.strokeStyle = tg.color;
      g.fillStyle = withAlpha(tg.color, 0.14 + p * 0.2);
      g.lineWidth = 2;
      g.beginPath();
      if (tg.shape === 'cone') {
        g.moveTo(tg.x, tg.y);
        g.arc(tg.x, tg.y, tg.r, tg.angle - 0.55, tg.angle + 0.55);
        g.closePath();
      } else if (tg.shape === 'line') {
        const w = 26;
        g.translate(tg.x, tg.y);
        g.rotate(tg.angle);
        g.rect(0, -w / 2, tg.r, w);
      } else {
        g.arc(tg.x, tg.y, tg.r, 0, Math.PI * 2);
      }
      g.fill();
      g.stroke();
      // sweeping fill shows how close the hit is
      if (tg.shape === 'circle' || tg.shape === 'ring') {
        g.globalAlpha = 0.3;
        g.beginPath();
        g.arc(tg.x, tg.y, tg.r * p, 0, Math.PI * 2);
        g.fillStyle = withAlpha(tg.color, 0.3);
        g.fill();
      }
      g.restore();
    }

    for (const r of this.rings) {
      g.save();
      g.globalAlpha = Math.max(0, r.life / 0.42) * 0.8;
      g.strokeStyle = r.color;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }

    for (const p of this.particles) {
      g.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      g.fillStyle = p.color;
      const s = Math.max(1, p.size * (p.life / p.maxLife));
      g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.round(s), Math.round(s));
    }
    g.globalAlpha = 1;
  }

  drawText(g: CanvasRenderingContext2D): void {
    g.textAlign = 'center';
    for (const t of this.texts) {
      const a = Math.max(0, Math.min(1, t.life / 0.6));
      g.globalAlpha = a;
      g.font = `bold ${t.size}px "Trebuchet MS", system-ui, sans-serif`;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(8,6,12,0.9)';
      g.strokeText(t.text, t.x, t.y);
      g.fillStyle = t.color;
      g.fillText(t.text, t.x, t.y);
    }
    g.globalAlpha = 1;
    g.textAlign = 'left';
  }
}
