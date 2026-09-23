import { useCallback } from 'react';
import type { Game } from '../../game/core/game';
import { REGION_BY_ID } from '../../data/locations';
import { MINIMAP_SIZE } from '../../game/core/renderer';
import { useUiMetrics } from '../kit';
import { useGameValue } from '../hooks';

/**
 * The minimap in an iron frame, with a brass plaque under it naming where
 * you are. The map itself is drawn by the renderer into
 * this component's canvas every frame; React only owns the frame and the
 * plaque, which changes when you cross a border.
 *
 * Coordinates are a debugging aid and only show for a debug character or
 * with the F3 overlay on.
 */
export default function Minimap({ game }: { game: Game }) {
  const ui = useUiMetrics();
  // a callback ref, so a minimap hidden and shown again re-registers its new canvas
  const ref = useCallback((c: HTMLCanvasElement | null) => { game.minimapCanvas = c; }, [game]);

  const info = useGameValue(() => {
    const region = game.map.id === 'overworld' ? (REGION_BY_ID as Record<string, { name: string } | undefined>)[game.regionAtPlayer() ?? '']?.name : undefined;
    const c = game.isDebug || game.debug ? game.worldCoords() : null;
    return {
      place: region ?? game.map.name,
      coords: c ? `${c.isDoor ? 'Door ' : ''}${c.x}, ${c.y}` : '',
      shown: game.showMinimap,
    };
  }, 4);

  if (!info.shown) return null;
  // one canvas pixel per device pixel, so the map is as sharp as the screen
  const px = MINIMAP_SIZE * ui.device;
  return (
    <div className="minimap">
      <div className="mm-frame frame-iron">
        <canvas ref={ref} width={px} height={px} style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }} />
      </div>
      <div className="mm-plaque" title={info.place}>
        <span className="mm-place">{info.place}</span>
      </div>
      {info.coords ? <div className="mm-coords">{info.coords}</div> : null}
    </div>
  );
}
