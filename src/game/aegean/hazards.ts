import type { Game } from '../core/game';
import { AEGEAN_ISLANDS, AEGEAN_LOCATIONS, AEGEAN_PORTS } from '../../data/aegean/world';
import { AEGEAN_ISLAND_ECOLOGY, AEGEAN_MAINLAND_ECOLOGY, type AegeanEcology, type AegeanHazardKind } from '../../data/aegean/ecology';
import { applyStatus } from '../entities/entity';
import { boxHitsTerrain } from '../world/map';
import { TILE } from '../world/tiles';

export interface AegeanGroundHazard { id: string; x: number; y: number; kind: AegeanHazardKind; radius: number; phase: number; }
export const AEGEAN_HAZARD_CUES: Record<AegeanHazardKind, { label: string; color: string; damage: number }> = {
  roots: { label: 'ROOTS — leave the cracks', color: '#a1c473', damage: .09 },
  vent: { label: 'VENT — steam means move', color: '#ed915b', damage: .17 },
  rockfall: { label: 'ROCKFALL — leave the shadow', color: '#ddbd89', damage: .18 },
  gaze: { label: 'GAZE — leave the eye', color: '#bacc87', damage: .1 },
  lightning: { label: 'LIGHTNING — leave the sparks', color: '#c0dafe', damage: .19 },
  thorns: { label: 'THORNS — cross between blooms', color: '#e2ce70', damage: .12 },
  spears: { label: 'SPEARS — avoid the red slots', color: '#dc8a73', damage: .16 },
  tide: { label: 'SURGE — step outside the foam', color: '#86d6df', damage: .12 },
  song: { label: 'SONG — dodge the growing ring', color: '#bda4e6', damage: .13 },
};
export function aegeanEcologyAt(game: Pick<Game, 'map' | 'player'>): AegeanEcology | undefined {
  const { map, player } = game;
  if (map.id !== 'overworld' || player.x < 980 * TILE) return;
  const i = Math.floor(player.y / TILE) * map.w + Math.floor(player.x / TILE);
  const island = AEGEAN_ISLANDS.find(island => island.landmass === map.landmasses?.[i]);
  return island ? AEGEAN_ISLAND_ECOLOGY[island.id] : AEGEAN_MAINLAND_ECOLOGY[map.regions?.[i] ?? 22];
}
/** Stable, readable phases: an unmistakable warning always precedes damage. */
export function aegeanHazardPhase(now: number, phase: number): { warning: boolean; active: boolean; progress: number; cycle: number } {
  const time = now + phase, cycle = Math.floor(time / 6.8), t = time - cycle * 6.8;
  return { warning: t >= 3.5 && t < 5.4, active: t >= 5.4 && t < 6.45, progress: Math.max(0, (t - 3.5) / 1.9), cycle };
}
/** View-local simulation: dozens of ground marks, not thousands of persistent entities. */
export class AegeanHazards {
  private ground: AegeanGroundHazard[] = [];
  private hits = new Map<string, number>();
  private cell = '';
  private seaPulse = 0;
  private whirlpool?: { x: number; y: number; until: number };
  warning = '';
  constructor(public game: Game) {}
  reset(): void { this.ground = []; this.hits.clear(); this.cell = ''; this.whirlpool = undefined; this.warning = ''; this.seaPulse = 0; }
  get atmosphere(): AegeanEcology | undefined { return aegeanEcologyAt(this.game); }
  private safe(x: number, y: number): boolean {
    return AEGEAN_LOCATIONS.some(site => !site.surfaceMap && site.kind === 'village' && Math.hypot(site.tx * TILE - x, site.ty * TILE - y) < 29 * TILE) ||
      AEGEAN_PORTS.some(port => Math.hypot(port.land.x - x, port.land.y - y) < 8 * TILE) ||
      this.game.map.portals.some(portal => Math.hypot(portal.x - x, portal.y - y) < 110);
  }
  private refresh(): void {
    const g = this.game, p = g.player, cx = Math.floor(p.x / 320), cy = Math.floor(p.y / 320);
    const key = `${g.map.id}:${g.map.revision ?? ""}:${cx}:${cy}`;
    if (key === this.cell) return;
    this.cell = key; this.ground = [];
    if (this.hits.size > 180) for (const [id, cycle] of this.hits) if (cycle < Math.floor(this.game.now / 6.8) - 1) this.hits.delete(id);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = cx + dx, y = cy + dy, n = Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
      if (n < .37) continue;
      const px = x * 320 + 60 + n * 210, py = y * 320 + 70 + ((n * 7) % 1) * 190;
      if (px < 982 * TILE || this.safe(px, py) || boxHitsTerrain(g.map, px, py, 38, 30)) continue;
      const i = Math.floor(py / TILE) * g.map.w + Math.floor(px / TILE);
      const island = AEGEAN_ISLANDS.find(island => island.landmass === g.map.landmasses?.[i]);
      const ecology = island ? AEGEAN_ISLAND_ECOLOGY[island.id] : AEGEAN_MAINLAND_ECOLOGY[g.map.regions?.[i] ?? 0];
      if (!ecology) continue;
      this.ground.push({ id: `${x}:${y}`, x: px, y: py, kind: ecology.hazard, radius: ecology.hazard === 'song' ? 112 : 46 + n * 32, phase: n * 6.8 });
    }
  }
  update(dt: number): void {
    const g = this.game, p = g.player;
    this.warning = '';
    if (g.map.id !== 'overworld' || p.x < 980 * TILE) { this.cell = ''; this.ground = []; this.whirlpool = undefined; return; }
    this.refresh();
    if (g.naval.aboard) { this.updateSea(dt); return; }
    this.whirlpool = undefined;
    let nearest = Infinity;
    for (const h of this.ground) {
      const phase = aegeanHazardPhase(g.now, h.phase), d = Math.hypot(p.x - h.x, p.y - h.y), cue = AEGEAN_HAZARD_CUES[h.kind];
      if ((phase.warning || phase.active) && d < h.radius + 90 && d < nearest) { this.warning = cue.label; nearest = d; }
      const hit = h.kind === 'song' ? d > h.radius * .35 && d < h.radius : d < h.radius;
      if (!phase.active || !hit || this.hits.get(h.id) === phase.cycle) continue;
      this.hits.set(h.id, phase.cycle);
      const hp = p.hp, shield = p.shield, map = g.map, x = p.x, y = p.y;
      g.damagePlayer(p.maxHp * cue.damage, { trueDamage: true, label: cue.label.split(' — ')[0] });
      if (g.map !== map || p.dead || Math.hypot(p.x - x, p.y - y) > 150) return;
      const landed = p.hp < hp || p.shield < shield;
      if (landed && (h.kind === 'roots' || h.kind === 'gaze' || h.kind === 'tide')) applyStatus(p, 'chill', .48, 1.4, cue.color, g.now);
      if (landed && h.kind === 'song') { p.knockX += (p.x - h.x) / Math.max(1, d) * 130; p.knockY += (p.y - h.y) / Math.max(1, d) * 130; }
      g.fx.ring(h.x, h.y, h.radius, cue.color);
    }
  }
  private updateSea(dt: number): void {
    const g = this.game, p = g.player;
    if (g.naval.nearestPort(700)) { this.whirlpool = undefined; return; }
    if (this.whirlpool && g.now > this.whirlpool.until) this.whirlpool = undefined;
    if (!this.whirlpool && g.naval.danger > 0 && g.now > this.seaPulse) {
      this.seaPulse = g.now + 24 - g.naval.danger * 2;
      const angle = g.naval.state.heading + Math.sin(g.now) * .7;
      const x = p.x + Math.cos(angle) * 350, y = p.y + Math.sin(angle) * 350;
      if (!boxHitsTerrain(g.map, x, y, 120, 110, 'ship')) {
        this.whirlpool = { x, y, until: g.now + 15 };
        g.toast('Charybdis stirs', 'Whirlpool ahead — row across its pull. Brace in the core.', '#8acfd5');
      }
    }
    const h = this.whirlpool;
    if (!h) return;
    const dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy);
    if (d > 310) return;
    this.warning = 'WHIRLPOOL — row sideways out of the spiral';
    // A two-second swell gives the captain room to choose an escape heading.
    if (h.until - g.now > 13) return;
    const pull = (1 - d / 310) * 145, tangent = pull * .65;
    const nx = p.x + (dx * pull - dy * tangent) / Math.max(1, d) * dt;
    const ny = p.y + (dy * pull + dx * tangent) / Math.max(1, d) * dt;
    if (!boxHitsTerrain(g.map, nx, ny, 16, 12, 'ship')) { p.x = nx; p.y = ny; g.naval.state.shipX = nx; g.naval.state.shipY = ny; }
    if (d < 72) g.naval.damage((g.naval.definition?.hull ?? 1000) * .13 * dt);
  }
  /** World coordinates; draw beneath entities and above terrain. */
  draw(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    if (g.map.id !== 'overworld' || g.player.x < 980 * TILE) return;
    ctx.save();
    if (!g.naval.aboard) for (const h of this.ground) {
      const phase = aegeanHazardPhase(g.now, h.phase), cue = AEGEAN_HAZARD_CUES[h.kind];
      ctx.strokeStyle = cue.color; ctx.fillStyle = cue.color;
      ctx.globalAlpha = phase.active ? .65 : phase.warning ? .36 + Math.sin(g.now * 15) * .1 : .12;
      ctx.lineWidth = phase.active ? 4 : 2;
      if (h.kind === 'spears') {
        for (let i = -2; i <= 2; i++) { ctx.fillRect(h.x + i * 20 - 3, h.y - h.radius * .6, 6, h.radius * 1.2); }
      } else if (h.kind === 'roots' || h.kind === 'thorns') {
        for (let n = 0; n < 7; n++) { const a = n * .9 + h.phase; ctx.beginPath(); ctx.moveTo(h.x + Math.cos(a) * 8, h.y + Math.sin(a) * 8); ctx.lineTo(h.x + Math.cos(a + .2) * h.radius * .5, h.y + Math.sin(a + .2) * h.radius * .5); ctx.lineTo(h.x + Math.cos(a) * h.radius, h.y + Math.sin(a) * h.radius); ctx.stroke(); }
      } else {
        ctx.beginPath(); ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2); ctx.stroke();
        if (phase.active) ctx.fill();
      }
      // The outer ring always matches the collision radius exactly, including
      // root/spear artwork. Song's inner circle is a visibly safe centre.
      ctx.beginPath(); ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2); ctx.stroke();
      if (h.kind === 'song') { ctx.strokeStyle = '#b5e4a2'; ctx.beginPath(); ctx.arc(h.x, h.y, h.radius * .35, 0, Math.PI * 2); ctx.stroke(); }
      if (phase.warning) { ctx.beginPath(); ctx.arc(h.x, h.y, h.radius * Math.min(1, phase.progress), 0, Math.PI * 2); ctx.stroke(); }
      if (phase.active && (h.kind === 'lightning' || h.kind === 'vent' || h.kind === 'rockfall')) {
        ctx.beginPath(); ctx.moveTo(h.x - 12, h.y - 85); ctx.lineTo(h.x + 10, h.y - 45); ctx.lineTo(h.x - 9, h.y - 34); ctx.lineTo(h.x, h.y); ctx.stroke();
      }
    }
    const h = this.whirlpool;
    if (g.naval.aboard && h) {
      ctx.strokeStyle = '#81cbd5'; ctx.globalAlpha = .4; ctx.lineWidth = 2;
      ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.arc(h.x, h.y, 310, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#e69d82'; ctx.beginPath(); ctx.arc(h.x, h.y, 72, 0, Math.PI * 2); ctx.stroke();
      for (let arm = 0; arm < 4; arm++) {
        ctx.strokeStyle = arm % 2 ? '#81cbd5' : '#193e63'; ctx.globalAlpha = .6; ctx.lineWidth = arm % 2 ? 3 : 12;
        ctx.beginPath();
        for (let n = 0; n < 55; n++) {
          const r = 12 + n * 4.3, a = arm * Math.PI / 2 + n * .13 - g.now * .85;
          const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r * .73;
          if (!n) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#10283c'; ctx.globalAlpha = .75; ctx.beginPath(); ctx.ellipse(h.x, h.y, 42, 30, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  /** Screen coordinates; bounded particles, no extra canvas or weather entities. */
  drawWeather(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const e = this.atmosphere;
    if (!e || e.weather === 'clear') return;
    const t = this.game.now;
    ctx.save(); ctx.strokeStyle = e.color; ctx.fillStyle = e.color;
    if (e.weather === 'sea-mist') { ctx.globalAlpha = .055; for (let n = 0; n < 4; n++) ctx.fillRect(0, ((n * 179 + t * 9) % (height + 160)) - 80, width, 60); }
    ctx.globalAlpha = e.weather === 'rain' ? .34 : .38;
    for (let n = 0; n < 32; n++) {
      const x = (n * 157.7 + t * (e.weather === 'rain' ? -72 : 13) + width * 99) % width;
      const y = (n * 97.3 + t * (e.weather === 'rain' ? 370 : e.weather === 'embers' ? -23 : 18) + height * 999) % height;
      if (e.weather === 'rain') { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14); ctx.stroke(); }
      else ctx.fillRect(x + Math.sin(t + n) * 8, y, e.weather === 'dust' ? 2 : 3, e.weather === 'golden-leaves' ? 5 : 2);
    }
    ctx.restore();
  }
}
