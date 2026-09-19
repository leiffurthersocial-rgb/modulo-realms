import { isWall, isWater, T } from '../world/tiles';

/** Water blocks walking, but has no vertical wall face or shadow above a beach. */
export function drawTerrainRelief(
  g: CanvasRenderingContext2D, faces: CanvasImageSource,
  id: number, below: number, above: number,
  dx: number, dy: number, variant: number, tile: number,
): void {
  const raised = (value: number) => isWall(value) && !isWater(value);
  if (raised(id)) {
    if (!raised(below)) g.drawImage(faces, variant * tile, id * tile, tile, tile, dx, dy + tile - 14, tile, 14);
  } else if (above !== T.VOID && raised(above)) {
    const grad = g.createLinearGradient(0, dy, 0, dy + 10);
    grad.addColorStop(0, 'rgba(8,6,12,0.45)');
    grad.addColorStop(1, 'rgba(8,6,12,0)');
    g.fillStyle = grad;
    g.fillRect(dx, dy, tile, 10);
  }
}
