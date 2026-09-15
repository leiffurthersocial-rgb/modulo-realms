import { PAL, withAlpha } from '../art/palette';
import type { ProjectileSpec } from '../core/world';

export interface Projectile extends ProjectileSpec {
  id: number;
  vx: number;
  vy: number;
  travelled: number;
  dead: boolean;
  hits: Set<number>;
  pierceLeft: number;
  spin: number;
  trail: number;
}

let pid = 1;

export function makeProjectile(spec: ProjectileSpec): Projectile {
  return {
    ...spec,
    id: pid++,
    vx: Math.cos(spec.angle) * spec.speed,
    vy: Math.sin(spec.angle) * spec.speed,
    travelled: 0,
    dead: false,
    hits: new Set<number>(),
    pierceLeft: spec.pierce ?? 0,
    spin: 0,
    trail: 0,
  };
}

export function drawProjectile(g: CanvasRenderingContext2D, p: Projectile, t: number): void {
  const kind = p.sprite ?? 'bolt';
  g.save();
  g.translate(p.x, p.y);
  g.rotate(p.angle);
  const r = Math.max(3, p.radius * 0.42);
  switch (kind) {
    case 'arrow': {
      g.fillStyle = PAL.woodDark;
      g.fillRect(-10, -1, 18, 2);
      g.fillStyle = p.color;
      g.beginPath();
      g.moveTo(12, 0); g.lineTo(5, -3); g.lineTo(5, 3); g.closePath(); g.fill();
      g.fillStyle = PAL.cloth;
      g.fillRect(-10, -3, 4, 2);
      g.fillRect(-10, 1, 4, 2);
      break;
    }
    case 'shard': {
      g.fillStyle = withAlpha(p.color, 0.35);
      g.beginPath(); g.ellipse(0, 0, r * 2.4, r * 1.4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = p.color;
      g.beginPath();
      g.moveTo(r * 1.9, 0); g.lineTo(0, -r * 0.8); g.lineTo(-r * 1.4, 0); g.lineTo(0, r * 0.8);
      g.closePath(); g.fill();
      g.fillStyle = PAL.white;
      g.fillRect(-1, -1, 3, 2);
      break;
    }
    case 'orb':
    case 'bolt':
    default: {
      const pulse = 1 + Math.sin(t * 18 + p.id) * 0.12;
      g.fillStyle = withAlpha(p.color, 0.22);
      g.beginPath(); g.arc(0, 0, r * 2.6 * pulse, 0, Math.PI * 2); g.fill();
      g.fillStyle = withAlpha(p.color, 0.55);
      g.beginPath(); g.arc(0, 0, r * 1.7 * pulse, 0, Math.PI * 2); g.fill();
      g.fillStyle = p.color;
      g.beginPath(); g.arc(0, 0, r * pulse, 0, Math.PI * 2); g.fill();
      g.fillStyle = withAlpha(PAL.white, 0.85);
      g.beginPath(); g.arc(-r * 0.25, -r * 0.25, r * 0.45, 0, Math.PI * 2); g.fill();
      break;
    }
  }
  g.restore();
}
