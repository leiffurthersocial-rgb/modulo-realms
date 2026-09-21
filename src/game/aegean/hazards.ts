import type { Game } from '../core/game';
import { AEGEAN_ISLANDS, AEGEAN_LOCATIONS, AEGEAN_PORTS } from '../../data/aegean/world';
import { AEGEAN_ISLAND_ECOLOGY, AEGEAN_MAINLAND_ECOLOGY, type AegeanEcology, type AegeanHazardKind } from '../../data/aegean/ecology';
import { applyStatus } from '../entities/entity';
import { boxHitsTerrain } from '../world/map';
import { TILE } from '../world/tiles';

export interface AegeanGroundHazard { id: string; x: number; y: number; kind: AegeanHazardKind; radius: number; phase: number; }
export const AEGEAN_HAZARD_CUES: Record<AegeanHazardKind, { label: string; color: string; damage: number }> = {
  roots: { label: 'LIVING ROOTS — step between the branches', color: '#a1c473', damage: .09 },
  vent: { label: 'STEAM VENT — step off the fissure', color: '#ed915b', damage: .14 },
  rockfall: { label: 'LOOSE BOULDER — clear its downhill path', color: '#ddbd89', damage: .16 },
  gaze: { label: 'GORGON STATUE — leave the eye beam', color: '#bacc87', damage: .1 },
  lightning: { label: 'BRONZE ROD — stand clear of the sparks', color: '#c0dafe', damage: .16 },
  thorns: { label: 'THORN BUSH — avoid its reaching branches', color: '#e2ce70', damage: .1 },
  spears: { label: 'SPEAR GRATE — leave the metal slots', color: '#dc8a73', damage: .14 },
  tide: { label: 'BROKEN SPOUT — leave the water jet', color: '#86d6df', damage: .1 },
  song: { label: 'SWINGING BELL — clear the hanging weight', color: '#bda4e6', damage: .12 },
};
export const AEGEAN_TRAPS = { cellSize: 400, fraction: .28, cycle: 10.8, seenWarning: 1.2 } as const;
export const AEGEAN_VORTEX = { firstDelay: 110, minDelay: 100, maxDelay: 140, duration: 15, pullRadius: 270, coreRadius: 60, pull: 110, hullPerSecond: .085 } as const;
export function aegeanEcologyAt(game: Pick<Game, 'map' | 'player'>): AegeanEcology | undefined {
  const { map, player } = game;
  if (map.id !== 'overworld' || player.x < 980 * TILE) return;
  const i = Math.floor(player.y / TILE) * map.w + Math.floor(player.x / TILE);
  const island = AEGEAN_ISLANDS.find(island => island.landmass === map.landmasses?.[i]);
  return island ? AEGEAN_ISLAND_ECOLOGY[island.id] : AEGEAN_MAINLAND_ECOLOGY[map.regions?.[i] ?? 22];
}
export function aegeanHazardPhase(now: number, phase: number) {
  const time = now + phase, cycle = Math.floor(time / AEGEAN_TRAPS.cycle), t = time - cycle * AEGEAN_TRAPS.cycle;
  return { warning: t >= 3.5 && t < 5.4, active: t >= 5.4 && t < 6.45, progress: Math.max(0, (t - 3.5) / 1.9), activeProgress: Math.max(0, Math.min(1, (t - 5.4) / 1.05)), cycle };
}
interface ContactShape { x1: number; y1: number; x2: number; y2: number; radius: number; color: string; }
/** These are the actual visible limbs/objects, shared by rendering and contact. */
export function aegeanTrapContacts(h: AegeanGroundHazard, progress: number): ContactShape[] {
  const shapes: ContactShape[] = [], a = h.phase, reach = h.radius;
  const line = (x1: number, y1: number, x2: number, y2: number, radius: number, color: string) => shapes.push({ x1: h.x + x1, y1: h.y + y1, x2: h.x + x2, y2: h.y + y2, radius, color });
  const extension = Math.min(1, progress * 5);
  if (h.kind === 'roots' || h.kind === 'thorns') for (let n = 0; n < 5; n++) {
    const angle = a + n * Math.PI * 2 / 5;
    line(Math.cos(angle) * 13, Math.sin(angle) * 13, Math.cos(angle) * reach * extension, Math.sin(angle) * reach * extension, h.kind === 'roots' ? 5 : 4, h.kind === 'roots' ? '#795b37' : '#727a3b');
  } else if (h.kind === 'spears') for (let n = -2; n <= 2; n++) {
    line(n * 14, 12, n * 14, 12 - 46 * extension, 3, '#d6cba9');
  } else if (h.kind === 'vent') {
    for (let n = -1; n <= 1; n++) line(n * 17, 3, n * 17 + Math.sin(n + progress * 19) * 4, -32 * extension, 8, n ? '#ec933f' : '#f8d789');
  } else if (h.kind === 'rockfall') {
    const y = -28 + progress * 110, x = Math.sin(progress * 4) * 12;
    line(x, y, x, y, 17, '#887a65');
  } else if (h.kind === 'gaze' || h.kind === 'tide') {
    const length = (h.kind === 'gaze' ? 100 : 78) * extension;
    line(0, -9, Math.cos(a) * length, -9 + Math.sin(a) * length, h.kind === 'gaze' ? 4 : 12, h.kind === 'gaze' ? '#e8efaa' : '#a2dfde');
  } else if (h.kind === 'lightning') for (let n = 0; n < 3; n++) {
    const angle = a + n * Math.PI * 2 / 3;
    const mx = Math.cos(angle + .25) * 22, my = Math.sin(angle + .25) * 22;
    line(0, -5, mx, my, 3, '#d2e8ef');
    line(mx, my, Math.cos(angle) * 54 * extension, Math.sin(angle) * 54 * extension, 3, '#d2e8ef');
  } else {
    const angle = -.95 + progress * 1.9;
    const x = Math.sin(angle) * 58, y = -58 + Math.cos(angle) * 58;
    line(x, y, x, y, 16, '#be9559');
  }
  return shapes;
}
export function aegeanTrapTouches(h: AegeanGroundHazard, progress: number, x: number, y: number, bodyRadius = 9): boolean {
  return aegeanTrapContacts(h, progress).some(s => {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, length2 = dx * dx + dy * dy;
    const t = length2 ? Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / length2)) : 0;
    return Math.hypot(x - s.x1 - dx * t, y - s.y1 - dy * t) <= s.radius + bodyRadius;
  });
}
/** Sparse, visible mechanisms. Unseen warning time never arms a trap. */
export class AegeanHazards {
  private ground: AegeanGroundHazard[] = [];
  private hits = new Map<string, number>();
  private warned = new Map<string, { cycle: number; seconds: number }>();
  private cell = '';
  // Counts actual open-water sailing, not game age or embarking. Map changes
  // remove a current vortex but cannot create a fresh one on the next embark.
  private seaPulse: number = AEGEAN_VORTEX.firstDelay;
  private whirlpool?: { x: number; y: number; until: number };
  warning = '';
  constructor(public game: Game) {}
  reset(): void { this.ground = []; this.hits.clear(); this.warned.clear(); this.cell = ''; this.whirlpool = undefined; this.warning = ''; }
  get atmosphere(): AegeanEcology | undefined { return aegeanEcologyAt(this.game); }
  private safe(x: number, y: number): boolean {
    return AEGEAN_LOCATIONS.some(site => !site.surfaceMap && site.kind === 'village' && Math.hypot(site.tx * TILE - x, site.ty * TILE - y) < 29 * TILE) ||
      AEGEAN_PORTS.some(port => Math.hypot(port.land.x - x, port.land.y - y) < 8 * TILE) ||
      this.game.map.portals.some(portal => Math.hypot(portal.x - x, portal.y - y) < 130);
  }
  private visible(h: AegeanGroundHazard): boolean {
    const g = this.game, camera = g.camera, canvas = g.canvas;
    if (!camera || !canvas) return Math.hypot(g.player.x - h.x, g.player.y - h.y) < 220;
    return Math.abs(camera.x - h.x) < canvas.width / (2 * camera.zoom) - 24 && Math.abs(camera.y - h.y) < canvas.height / (2 * camera.zoom) - 36;
  }
  private refresh(): void {
    const g = this.game, p = g.player, size = AEGEAN_TRAPS.cellSize, cx = Math.floor(p.x / size), cy = Math.floor(p.y / size);
    const key = `${g.map.id}:${g.map.revision ?? ''}:${cx}:${cy}`;
    if (key === this.cell) return;
    this.cell = key; this.ground = [];
    if (this.hits.size > 180) for (const [id, cycle] of this.hits) if (cycle < Math.floor(g.now / AEGEAN_TRAPS.cycle) - 1) this.hits.delete(id);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = cx + dx, y = cy + dy, n = Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
      if (n < 1 - AEGEAN_TRAPS.fraction) continue;
      const px = x * size + 60 + n * 270, py = y * size + 70 + ((n * 7) % 1) * 240;
      if (px < 982 * TILE || this.safe(px, py) || boxHitsTerrain(g.map, px, py, 48, 40)) continue;
      const i = Math.floor(py / TILE) * g.map.w + Math.floor(px / TILE);
      const island = AEGEAN_ISLANDS.find(island => island.landmass === g.map.landmasses?.[i]);
      const ecology = island ? AEGEAN_ISLAND_ECOLOGY[island.id] : AEGEAN_MAINLAND_ECOLOGY[g.map.regions?.[i] ?? 0];
      if (!ecology) continue;
      this.ground.push({ id: `${x}:${y}`, x: px, y: py, kind: ecology.hazard, radius: 62, phase: n * AEGEAN_TRAPS.cycle });
    }
    const present = new Set(this.ground.map(h => h.id));
    for (const id of this.warned.keys()) if (!present.has(id)) this.warned.delete(id);
  }
  update(dt: number): void {
    const g = this.game, p = g.player;
    this.warning = '';
    if (g.map.id !== 'overworld' || p.x < 980 * TILE) { this.cell = ''; this.ground = []; this.warned.clear(); this.whirlpool = undefined; return; }
    this.refresh();
    if (g.naval.aboard) { this.warned.clear(); this.updateSea(dt); return; }
    this.whirlpool = undefined;
    let nearest = Infinity;
    for (const h of this.ground) {
      const phase = aegeanHazardPhase(g.now, h.phase), d = Math.hypot(p.x - h.x, p.y - h.y), cue = AEGEAN_HAZARD_CUES[h.kind];
      if (!this.visible(h) || d > 210) { this.warned.delete(h.id); continue; }
      let seen = this.warned.get(h.id);
      if (phase.warning) {
        if (!seen || seen.cycle !== phase.cycle) { seen = { cycle: phase.cycle, seconds: 0 }; this.warned.set(h.id, seen); }
        seen.seconds += Math.min(.1, Math.max(0, dt));
      }
      const armed = seen?.cycle === phase.cycle && seen.seconds >= AEGEAN_TRAPS.seenWarning;
      if ((phase.warning || phase.active && armed) && d < 155 && d < nearest) { this.warning = cue.label; nearest = d; }
      if (!phase.active || !armed || !aegeanTrapTouches(h, phase.activeProgress, p.x, p.y) || this.hits.get(h.id) === phase.cycle) continue;
      this.hits.set(h.id, phase.cycle);
      const hp = p.hp, shield = p.shield, map = g.map, x = p.x, y = p.y;
      g.damagePlayer(p.maxHp * cue.damage, { trueDamage: true, label: cue.label.split(' — ')[0] });
      if (g.map !== map || p.dead || Math.hypot(p.x - x, p.y - y) > 150) return;
      if ((p.hp < hp || p.shield < shield) && (h.kind === 'roots' || h.kind === 'gaze' || h.kind === 'tide')) applyStatus(p, 'chill', .48, 1.4, cue.color, g.now);
    }
  }
  private updateSea(dt: number): void {
    const g = this.game, p = g.player;
    if (g.naval.nearestPort(800)) { this.whirlpool = undefined; return; }
    if (this.whirlpool && g.now > this.whirlpool.until) this.whirlpool = undefined;
    if (g.naval.danger > 0) this.seaPulse -= Math.max(0, dt);
    if (!this.whirlpool && g.naval.danger > 0 && this.seaPulse <= 0) {
      this.seaPulse = AEGEAN_VORTEX.minDelay + (Math.abs(Math.sin(g.now * 1.371)) * (AEGEAN_VORTEX.maxDelay - AEGEAN_VORTEX.minDelay));
      const angle = g.naval.state.heading + Math.sin(g.now) * .9;
      const x = p.x + Math.cos(angle) * 430, y = p.y + Math.sin(angle) * 430;
      if (!boxHitsTerrain(g.map, x, y, 135, 135, 'ship')) {
        this.whirlpool = { x, y, until: g.now + AEGEAN_VORTEX.duration };
        g.toast('Charybdis stirs', 'Whirlpool ahead — row across its pull.', '#8acfd5');
      }
    }
    const h = this.whirlpool;
    if (!h) return;
    const dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy);
    if (d > AEGEAN_VORTEX.pullRadius) return;
    this.warning = 'WHIRLPOOL — row sideways out of the spiral';
    if (h.until - g.now > AEGEAN_VORTEX.duration - 2.5) return;
    const pull = (1 - d / AEGEAN_VORTEX.pullRadius) * AEGEAN_VORTEX.pull, tangent = pull * .5;
    const nx = p.x + (dx * pull - dy * tangent) / Math.max(1, d) * dt;
    const ny = p.y + (dy * pull + dx * tangent) / Math.max(1, d) * dt;
    if (!boxHitsTerrain(g.map, nx, ny, 16, 12, 'ship')) { p.x = nx; p.y = ny; g.naval.state.shipX = nx; g.naval.state.shipY = ny; }
    if (d < AEGEAN_VORTEX.coreRadius) g.naval.damage((g.naval.definition?.hull ?? 1000) * AEGEAN_VORTEX.hullPerSecond * dt);
  }
  /** Every trap has a persistent physical source, even between activations. */
  private drawSource(ctx: CanvasRenderingContext2D, h: AegeanGroundHazard, warning: boolean, active: boolean): void {
    const t = this.game.now, shake = warning ? Math.sin(t * 23) * 1.5 : 0;
    ctx.save(); ctx.translate(h.x + shake, h.y); ctx.lineWidth = 3; ctx.lineCap = 'round';
    const line = (x: number, y: number, ex: number, ey: number, color: string, width = 3) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke(); };
    if (h.kind === 'roots' || h.kind === 'thorns') {
      ctx.fillStyle = '#554831'; ctx.fillRect(-9, -16, 18, 25);
      for (let n = 0; n < 5; n++) { const a = n * Math.PI * 2 / 5 + h.phase; line(0, 2, Math.cos(a) * 24, Math.sin(a) * 22, '#756342', 5); line(Math.cos(a) * 16, Math.sin(a) * 14, Math.cos(a) * 20 + 6, Math.sin(a) * 18 - 8, '#a8a566', 2); }
      if (warning) for (let n = 0; n < 5; n++) { ctx.fillStyle = '#b4a481'; ctx.fillRect(Math.sin(n * 4 + t) * 30, 6 + n * 4, 3, 2); }
    } else if (h.kind === 'vent') {
      ctx.fillStyle = '#776557'; ctx.fillRect(-36, -5, 72, 17); ctx.fillStyle = '#282421'; ctx.fillRect(-29, 0, 57, 5);
      line(-31, 5, -19, 12, '#ba6746', 2); line(10, -1, 25, -10, '#b98660', 2);
      if (warning) for (let n = 0; n < 5; n++) { const rise = (t * 19 + n * 11) % 44; ctx.globalAlpha = .6 * (1 - rise / 55); ctx.fillStyle = '#dfd8c1'; ctx.fillRect(-25 + n * 12 + Math.sin(rise) * 2, -rise, 8, 8); } ctx.globalAlpha = 1;
    } else if (h.kind === 'rockfall') {
      ctx.fillStyle = '#696458'; ctx.beginPath(); ctx.moveTo(-27, -20); ctx.lineTo(-16, -60); ctx.lineTo(11, -74); ctx.lineTo(26, -34); ctx.lineTo(19, -14); ctx.closePath(); ctx.fill();
      line(-16, -57, 4, -47, '#a39a82', 3); line(4, -47, 1, -24, '#343b37', 3);
      if (warning) { ctx.fillStyle = '#bcb092'; for (let n = 0; n < 5; n++) ctx.fillRect(Math.sin(n * 3) * 12, -24 + ((t * 38 + n * 13) % 70), 4, 4); }
    } else if (h.kind === 'spears') {
      ctx.fillStyle = '#494b40'; ctx.fillRect(-40, -3, 80, 24); ctx.strokeStyle = '#ac9568'; ctx.lineWidth = 2; ctx.strokeRect(-40, -3, 80, 24);
      for (let n = -2; n <= 2; n++) { ctx.fillStyle = '#171f1d'; ctx.fillRect(n * 14 - 3, 4, 6, 12); if (warning) { ctx.fillStyle = '#dbd2ab'; ctx.fillRect(n * 14 - 1, 4, 2, 7); } }
    } else if (h.kind === 'gaze') {
      ctx.fillStyle = '#777e67'; ctx.fillRect(-19, 2, 38, 13); ctx.fillStyle = '#a7aa8a'; ctx.fillRect(-13, -29, 26, 32);
      line(-17, -22, -5, -36, '#6c765e', 5); line(3, -29, 15, -35, '#6c765e', 5);
      ctx.fillStyle = warning ? '#fff8ad' : '#3d4937'; ctx.fillRect(-8, -14, 6, 4); ctx.fillRect(4, -14, 6, 4);
      if (warning) { line(0, -9, Math.cos(h.phase) * 28, -9 + Math.sin(h.phase) * 28, '#eadb87', 2); }
    } else if (h.kind === 'lightning') {
      ctx.fillStyle = '#696653'; ctx.fillRect(-17, 2, 34, 12); line(0, 4, 0, -43, '#ba925a', 6); line(-10, -31, 11, -31, '#d3b572', 3);
      if (warning) { line(-10, -47, 4, -38, '#f2edc2', 2); line(4, -38, -5, -29, '#d8eefe', 2); }
    } else if (h.kind === 'tide') {
      ctx.fillStyle = '#657775'; ctx.fillRect(-24, -3, 48, 17); ctx.fillStyle = '#a68b67'; ctx.fillRect(-12, -24, 24, 27); ctx.fillStyle = '#243c42'; ctx.fillRect(-7, -17, 14, 14);
      if (warning) { ctx.fillStyle = '#b1dce0'; for (let n = 0; n < 4; n++) ctx.fillRect(Math.cos(h.phase) * (n * 6 + 5), -8 + Math.sin(h.phase) * (n * 6 + 5) + Math.sin(t * 9 + n) * 2, 4, 3); }
    } else {
      line(-28, 5, -28, -61, '#7d725f', 9); line(28, 5, 28, -61, '#7d725f', 9); line(-32, -62, 32, -62, '#b3a58b', 8);
      if (!active) {
      line(0, -58, 0, -11, '#5e5749', 3); ctx.fillStyle = '#bd9556'; ctx.beginPath(); ctx.moveTo(-10, -21); ctx.lineTo(10, -21); ctx.lineTo(17, 1); ctx.lineTo(-17, 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#665037'; ctx.fillRect(-17, 0, 34, 4); } if (warning) line(-12, -24, -19, -30, '#dbc493', 2);
    }
    ctx.restore();
  }
  /** Bark, forks and foliage follow the existing branch contact segment. */
  private drawLivingBranch(ctx: CanvasRenderingContext2D, h: AegeanGroundHazard, s: ContactShape): void {
    const length = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    if (length < 1) return;
    const thorn = h.kind === 'thorns';
    const variation = Math.sin(s.x2 * .13 + s.y2 * .071 + h.phase);
    const bend = variation * 2.2, width = s.radius + .8;
    ctx.save(); ctx.translate(s.x1, s.y1); ctx.rotate(Math.atan2(s.y2 - s.y1, s.x2 - s.x1));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // Uneven taper and small bends keep the wood inside its contact corridor.
    ctx.beginPath(); ctx.moveTo(-3, -width);
    ctx.lineTo(length * .22, -width * .82 + bend);
    ctx.lineTo(length * .49, -width * .61 - bend * .4);
    ctx.lineTo(length * .77, -width * .4 + bend * .7);
    ctx.lineTo(length + 2, -1);
    ctx.lineTo(length * .91, 1.8); ctx.lineTo(length * .63, width * .55 + bend);
    ctx.lineTo(length * .31, width * .78 - bend); ctx.lineTo(-2, width);
    ctx.closePath(); ctx.fillStyle = thorn ? '#696044' : '#765331'; ctx.fill();
    ctx.strokeStyle = '#3d3527'; ctx.lineWidth = 1.2; ctx.stroke();
    // Broken bark ridges and knots, rather than one flat green stroke.
    ctx.strokeStyle = thorn ? '#a69a60' : '#b48c57'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(2, -width * .45);
    ctx.lineTo(length * .23, -width * .35 + bend); ctx.lineTo(length * .43, -1.5);
    ctx.moveTo(length * .51, -.8); ctx.lineTo(length * .72, -width * .2 + bend * .7); ctx.lineTo(length * .91, -.3); ctx.stroke();
    ctx.strokeStyle = '#443622'; ctx.lineWidth = 1;
    for (let n = 0; n < 3; n++) {
      const x = length * (.19 + n * .23 + variation * .025), side = (n + (variation > 0 ? 1 : 0)) % 2 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(x - 2, side * width * .5); ctx.lineTo(x + 2, side * .8); ctx.lineTo(x + 5, side * 1.4); ctx.stroke();
    }
    // Asymmetric offshoots carry sharp pale thorns or fine woody root forks.
    for (let n = 0; n < (thorn ? 4 : 3); n++) {
      const x = length * (.22 + n * (thorn ? .18 : .24)) + variation * 2;
      const side = (n + (variation > .1 ? 1 : 0)) % 2 ? 1 : -1;
      const base = side * width * (1 - x / Math.max(1, length) * .65);
      const tip = side * (thorn ? 8 + ((n + 1) % 3) : 6 + (n % 2));
      ctx.beginPath(); ctx.moveTo(x - 3, base); ctx.lineTo(x + (thorn ? 1 : 5), tip); ctx.lineTo(x + 4, base * .6); ctx.closePath();
      ctx.fillStyle = thorn ? '#d3c28b' : '#8c6941'; ctx.fill();
      ctx.strokeStyle = thorn ? '#665234' : '#4a3927'; ctx.lineWidth = .8; ctx.stroke();
    }
    // A few leaves sit at different points and angles; no ring or halo.
    const leafX = length * (variation > 0 ? .72 : .88), side = variation > 0 ? 1 : -1;
    if (length > 22) {
      ctx.fillStyle = thorn ? '#92934e' : '#74823e';
      ctx.beginPath(); ctx.moveTo(leafX - 3, 0); ctx.lineTo(leafX + 1, side * 7); ctx.lineTo(leafX + 9, side * 9); ctx.lineTo(leafX + 6, side * 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#b6b775'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(leafX - 1, side); ctx.lineTo(leafX + 7, side * 7); ctx.stroke();
      ctx.strokeStyle = thorn ? '#a4a36b' : '#9c7846'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(length * .84, 0); ctx.lineTo(length * .96, -side * 3); ctx.lineTo(length + 3, -side * 5); ctx.stroke();
    }
    ctx.restore();
  }
  /** World coordinates; tangible art is also the collision footprint. */
  draw(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    if (g.map.id !== 'overworld' || g.player.x < 980 * TILE) return;
    ctx.save(); ctx.lineCap = 'round';
    if (!g.naval.aboard) for (const h of this.ground) {
      if (!this.visible(h)) continue;
      const phase = aegeanHazardPhase(g.now, h.phase), seen = this.warned.get(h.id);
      const active = phase.active && seen?.cycle === phase.cycle && seen.seconds >= AEGEAN_TRAPS.seenWarning;
      this.drawSource(ctx, h, phase.warning && Math.hypot(g.player.x - h.x, g.player.y - h.y) < 210, active);
      if (!active) continue;
      for (const s of aegeanTrapContacts(h, phase.activeProgress)) {
        if (h.kind === 'roots' || h.kind === 'thorns') { this.drawLivingBranch(ctx, h, s); continue; }
        ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.radius * 2;
        ctx.beginPath();
        if (s.x1 === s.x2 && s.y1 === s.y2) {
          if (h.kind === 'song') {
            ctx.moveTo(s.x1 - 9, s.y1 - 15); ctx.lineTo(s.x1 + 9, s.y1 - 15); ctx.lineTo(s.x1 + 16, s.y1 + 9); ctx.lineTo(s.x1 - 16, s.y1 + 9); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#5c4b37'; ctx.fillRect(s.x1 - 16, s.y1 + 9, 32, 4); ctx.fillStyle = '#e0c68a'; ctx.fillRect(s.x1 - 7, s.y1 - 11, 4, 14);
          } else { ctx.arc(s.x1, s.y1, s.radius, 0, Math.PI * 2); ctx.fill(); }
        }
        else { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); }
        if (h.kind === 'rockfall') { ctx.strokeStyle = '#c0b397'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x1 - 9, s.y1 - 4); ctx.lineTo(s.x1 + 2, s.y1 - 10); ctx.lineTo(s.x1 + 9, s.y1 - 4); ctx.stroke(); }
        if (h.kind === 'song') { ctx.strokeStyle = '#5e5749'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(h.x, h.y - 58); ctx.lineTo(s.x1, s.y1); ctx.stroke(); }
      }
    }
    const h = this.whirlpool;
    if (g.naval.aboard && h) {
      // The spiralling foam itself reaches the pull boundary. No abstract
      // danger circle: the entire disturbed water surface shows its reach.
      for (let arm = 0; arm < 7; arm++) {
        ctx.strokeStyle = arm % 2 ? '#abd9d7' : '#244b64'; ctx.globalAlpha = arm % 2 ? .58 : .72; ctx.lineWidth = arm % 2 ? 4 : 16;
        ctx.beginPath();
        for (let n = 0; n <= 60; n++) {
          const r = 12 + n * (AEGEAN_VORTEX.pullRadius - 12) / 60, a = arm * Math.PI * 2 / 7 + n * .11 - g.now * .65;
          const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
          if (!n) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#10283c'; ctx.globalAlpha = .8; ctx.beginPath(); ctx.arc(h.x, h.y, AEGEAN_VORTEX.coreRadius, 0, Math.PI * 2); ctx.fill();
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
