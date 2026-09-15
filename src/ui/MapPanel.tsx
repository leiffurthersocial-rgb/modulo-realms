import { useEffect, useRef, useState } from 'react';
import type { Game } from '../game/core/game';
import { LOCATIONS, REGIONS } from '../data/locations';
import { getMinimap } from '../game/core/renderer';
import { TILE } from '../game/world/tiles';

const KIND_COLOR: Record<string, string> = {
  town: '#f6bf5d', village: '#f6bf5d', dungeon: '#f45b5b', cave: '#e8763a',
  camp: '#b5462f', shrine: '#ffe9a8', landmark: '#8fd0f0', ruin: '#a978e8',
};

export default function MapPanel({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(560);
  const world = game.maps.get('overworld')!;
  const inWorld = game.map.id === 'overworld';

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const src = getMinimap(world, 1);
    const s = Math.min(window.innerHeight - 260, window.innerWidth - 420, 620);
    setSize(s);
    canvas.width = s;
    canvas.height = s;
    const g = canvas.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#07060b';
    g.fillRect(0, 0, s, s);
    g.drawImage(src, 0, 0, s, s);
    // fog over undiscovered ground
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(8,7,14,0.55)';
    g.fillRect(0, 0, s, s);
    g.restore();
    for (const loc of LOCATIONS) {
      if (!game.player.discovered.has(loc.id)) continue;
      const x = (loc.tx / world.w) * s;
      const y = (loc.ty / world.h) * s;
      const r = ((loc.radius ?? 12) / world.w) * s * 3.4;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,240,210,0.22)');
      grad.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }, [world, game.player.discovered.size, game.uiVersion]);

  const toPct = (tx: number, ty: number) => ({ left: `${(tx / world.w) * 100}%`, top: `${(ty / world.h) * 100}%` });
  const mapCoords = game.worldCoords();
  const markers = game.quests.markers();
  const trackedMarker = game.trackedQuest ? game.quests.markers().find((m) => m.quest.id === game.trackedQuest)?.location : undefined;

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(1000px, 96vw)' }}>
        <div className="panel-title">
          <span>Ashvale Valley</span>
          <span className="sub">
            {game.player.discovered.size} / {LOCATIONS.length} places found · {game.timeLabel} ·{' '}
            {mapCoords.isDoor ? 'Door ' : ''}{mapCoords.x}, {mapCoords.y}
          </span>
          <button className="close-x" onClick={() => game.closeAll()}>×</button>
        </div>
        <div className="map-panel">
          <div className="map-canvas-wrap" style={{ padding: 16 }}>
            <div style={{ position: 'relative', width: size, height: size }}>
              <canvas ref={ref} style={{ position: 'absolute', inset: 0, border: '1px solid var(--edge)' }} />
              {LOCATIONS.filter((l) => game.player.discovered.has(l.id)).map((l) => {
                const pos = toPct(l.tx, l.ty);
                const isQuest = markers.some((m) => m.location === l.id);
                const tracked = trackedMarker === l.id;
                const attuned = game.player.waystones.has(l.id);
                return (
                  <div key={l.id} style={{ position: 'absolute', ...pos, transform: 'translate(-50%,-50%)' }}>
                    <div
                      title={`${l.name} — ${l.desc}${attuned ? ' (waystone attuned)' : ''}`}
                      onClick={() => attuned && game.travelToWaystone(l.id)}
                      style={{
                        width: tracked ? 13 : isQuest ? 11 : 9,
                        height: tracked ? 13 : isQuest ? 11 : 9,
                        background: KIND_COLOR[l.kind] ?? '#fff',
                        border: `1px solid ${tracked ? '#fff' : 'rgba(0,0,0,0.7)'}`,
                        transform: 'rotate(45deg)',
                        cursor: attuned ? 'pointer' : 'default',
                        boxShadow: tracked
                          ? '0 0 14px rgba(240,201,60,0.95)'
                          : isQuest ? '0 0 8px rgba(255,220,120,0.7)' : 'none',
                      }}
                    />
                    {attuned ? <span className="waystone-ring" /> : null}
                    <span className="map-marker-label" style={tracked ? { color: '#f0c93c' } : undefined}>{l.name}</span>
                  </div>
                );
              })}
              {inWorld ? (
                <div
                  style={{
                    position: 'absolute',
                    ...toPct(game.player.x / TILE, game.player.y / TILE),
                    transform: 'translate(-50%,-50%)',
                    width: 10, height: 10, borderRadius: '50%',
                    background: '#fdf8ef', boxShadow: '0 0 10px rgba(255,255,255,0.8)',
                    border: '2px solid #1a1422',
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className="map-legend">
            {REGIONS.map((r) => (
              <span key={r.id}><i style={{ background: r.color }} />{r.name} (lv {r.level[0]}–{r.level[1]})</span>
            ))}
          </div>
          <div className="map-legend" style={{ borderTop: 'none', paddingTop: 0 }}>
            <span><i style={{ background: KIND_COLOR.town, transform: 'rotate(45deg)' }} />Settlement</span>
            <span><i style={{ background: KIND_COLOR.dungeon, transform: 'rotate(45deg)' }} />Dungeon</span>
            <span><i style={{ background: KIND_COLOR.camp, transform: 'rotate(45deg)' }} />Enemy camp</span>
            <span><i style={{ background: KIND_COLOR.landmark, transform: 'rotate(45deg)' }} />Landmark</span>
            <span><i style={{ background: '#4f9ce8', borderRadius: '50%' }} />Waystone (click to travel)</span>
            {trackedMarker ? <span style={{ color: '#f0c93c' }}>Tracking: {game.quests.markers().find((m) => m.quest.id === game.trackedQuest)?.quest.name}</span> : null}
            {!inWorld ? <span style={{ color: 'var(--gold)' }}>You are inside {game.map.name}.</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
