import type { Enemy } from "../entities/enemy";
import type { WorldCtx } from "../core/world";
import { boxHitsTerrain, findOpenNear } from "../world/map";
import { TILE } from "../world/tiles";

type Point = { x: number; y: number };
type Route = { goal: Point; points: Point[]; until: number };

/** Small, bounded navigation for authored escorts and encounters. Open arenas
 * take the direct path; corridors use a cached flood search, at most two per
 * frame. Each search visits a dungeon tile only once. No overworld grid exists. */
export class AegeanNavigation {
  private routes = new Map<number, Route>();
  private frame = -1;
  private searches = 0;
  clear(): void {
    this.routes.clear();
  }

  move(e: Enemy, ctx: WorldCtx, target: Point, speed = 1): void {
    if (e.dead || e.windupTime > 0 || e.statuses.some((s) => s.kind === "stun"))
      return;
    const hw = e.radius * 0.7,
      hh = e.radius * 0.5;
    const clear = (a: Point, b: Point): boolean => {
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (TILE * 0.65));
      for (let i = 1; i <= steps; i++)
        if (
          boxHitsTerrain(
            ctx.map,
            a.x + ((b.x - a.x) * i) / steps,
            a.y + ((b.y - a.y) * i) / steps,
            hw,
            hh,
          )
        )
          return false;
      return true;
    };
    if (clear(e, target)) {
      e.driveTo(ctx, target.x, target.y, speed);
      return;
    }
    const frame = Math.floor(ctx.now * 60);
    if (frame !== this.frame) {
      this.frame = frame;
      this.searches = 0;
    }
    let route = this.routes.get(e.id);
    if (
      !route ||
      route.until < ctx.now ||
      Math.hypot(route.goal.x - target.x, route.goal.y - target.y) > TILE * 7
    ) {
      if (this.searches < 2) {
        this.searches++;
        const goal = findOpenNear(ctx.map, target.x, target.y, hw, hh);
        route = {
          goal: { ...target },
          points: this.path(e, goal, ctx, hw, hh),
          until: ctx.now + 2.5,
        };
        this.routes.set(e.id, route);
      }
    }
    if (route?.points.length) {
      while (
        route.points.length > 1 &&
        Math.hypot(route.points[0].x - e.x, route.points[0].y - e.y) <
          TILE * 1.15
      )
        route.points.shift();
      // Skip visible waypoints, while retaining a turn around every wall.
      for (let i = Math.min(12, route.points.length - 1); i > 0; i--) {
        if (clear(e, route.points[i])) {
          route.points.splice(0, i);
          break;
        }
      }
      e.driveTo(ctx, route.points[0].x, route.points[0].y, speed);
    } else e.driveTo(ctx, target.x, target.y, speed);
  }

  private path(
    from: Point,
    to: Point,
    ctx: WorldCtx,
    hw: number,
    hh: number,
  ): Point[] {
    const { w, h } = ctx.map;
    const start = Math.floor(from.y / TILE) * w + Math.floor(from.x / TILE);
    const end = Math.floor(to.y / TILE) * w + Math.floor(to.x / TILE);
    const parent = new Int32Array(w * h);
    parent.fill(-1);
    const queue = new Int32Array(w * h);
    let read = 0,
      write = 1;
    queue[0] = start;
    parent[start] = start;
    while (read < write && parent[end] === -1) {
      const n = queue[read++],
        x = n % w,
        y = Math.floor(n / w);
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        const tx = x + dx,
          ty = y + dy,
          next = ty * w + tx;
        if (tx < 0 || ty < 0 || tx >= w || ty >= h || parent[next] !== -1)
          continue;
        if (
          boxHitsTerrain(ctx.map, (tx + 0.5) * TILE, (ty + 0.5) * TILE, hw, hh)
        )
          continue;
        parent[next] = n;
        queue[write++] = next;
      }
    }
    if (parent[end] === -1) return [];
    const path: Point[] = [];
    for (let n = end; n !== start; n = parent[n])
      path.push({
        x: ((n % w) + 0.5) * TILE,
        y: (Math.floor(n / w) + 0.5) * TILE,
      });
    return path.reverse();
  }
}
