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
    case 'boulder': {
      g.rotate(t * 3 + p.id);
      g.fillStyle = '#817565'; g.beginPath();
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, rr = r * (i % 2 ? 1.08 : 1.35); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (!i) g.moveTo(x, y); else g.lineTo(x, y); }
      g.closePath(); g.fill(); g.strokeStyle = '#c5b9a0'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-r * .7, -r * .2); g.lineTo(-r * .15, -r * .75); g.lineTo(r * .55, -r * .5); g.stroke();
      break;
    }
    case 'spear':
      g.fillStyle = '#795238'; g.fillRect(-23, -2, 35, 4);
      g.fillStyle = '#ded9c5'; g.beginPath(); g.moveTo(23, 0); g.lineTo(9, -5); g.lineTo(12, 0); g.lineTo(9, 5); g.closePath(); g.fill();
      g.fillStyle = p.color; g.fillRect(-12, -3, 3, 6); break;
    case 'fang':
      g.fillStyle = p.color; g.beginPath(); g.moveTo(13, 0); g.lineTo(-9, -5); g.lineTo(-4, 0); g.lineTo(-9, 5); g.closePath(); g.fill();
      g.fillStyle = '#efe9c7'; g.beginPath(); g.moveTo(13, 0); g.lineTo(-6, -3); g.lineTo(-2, 0); g.closePath(); g.fill(); break;
    case 'feather':
      g.strokeStyle = '#ded5ae'; g.lineWidth = 2; g.beginPath(); g.moveTo(-15, 0); g.lineTo(15, 0); g.stroke();
      g.strokeStyle = p.color; g.lineWidth = 3;
      for (let i = -10; i < 10; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - 5, -5); g.moveTo(i, 0); g.lineTo(i - 5, 5); g.stroke(); } break;
    case 'net':
      g.strokeStyle = p.color; g.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-13, i * 5); g.lineTo(13, i * 5 + 3); g.moveTo(i * 5, -13); g.lineTo(i * 5 + 3, 13); g.stroke(); }
      g.fillStyle = '#776755'; for (const y of [-13, 13]) for (const x of [-13, 13]) g.fillRect(x - 2, y - 2, 4, 4); break;
    case 'chain':
      g.strokeStyle = '#b4b4a9'; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(-18 + i * 8, Math.sin(t * 9 + i) * 2, 6, 3, i % 2 ? .35 : -.35, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#e4d5a7'; g.beginPath(); g.moveTo(8, -6); g.lineTo(20, 0); g.lineTo(8, 6); g.lineTo(12, 0); g.closePath(); g.fill(); break;
    case 'note':
      g.fillStyle = p.color; g.fillRect(2, -13, 3, 21); g.fillRect(4, -13, 8, 3); g.beginPath(); g.ellipse(-2, 7, 6, 4, -.3, 0, Math.PI * 2); g.fill(); break;
    case 'ember':
      g.fillStyle = '#ce642d'; g.beginPath(); g.moveTo(12, 0); g.lineTo(-8, -7); g.lineTo(-4, -1); g.lineTo(-17, 0); g.lineTo(-6, 4); g.lineTo(-10, 8); g.closePath(); g.fill();
      g.fillStyle = '#f6cd73'; g.beginPath(); g.moveTo(9, 0); g.lineTo(-7, -3); g.lineTo(-4, 4); g.closePath(); g.fill(); break;
    case 'shield':
      g.rotate(t * 8); g.fillStyle = '#a67439'; g.beginPath(); g.ellipse(0, 0, r * 1.3, r, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#e2c379'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#6d3036'; g.fillRect(-3, -r * .6, 6, r * 1.2); g.fillStyle = '#e2c379'; g.fillRect(-3, -3, 6, 6); break;
    case 'venom':
      g.fillStyle = p.color; g.beginPath(); g.ellipse(3, 0, r * 1.1, r * .8, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(-5 - i * 6, (i % 2 ? 1 : -1) * 4, Math.max(2, r * .35 - i), 2, 0, 0, Math.PI * 2); g.fill(); } break;
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
