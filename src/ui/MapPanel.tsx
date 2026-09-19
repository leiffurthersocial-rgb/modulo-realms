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
  // Inside a dungeon the panel used to draw the overworld, which is no use to
  // anybody standing in a corridor: the one thing you actually want from a map
  // down there is which way is out. Every interior draws its own floor now.
  if (game.map.id !== 'overworld') return <DungeonMap game={game} />;
  return <WorldMap game={game} />;
}

/**
 * The floor you are standing on, with the way out marked.
 *
 * It draws the whole layout rather than only the rooms you have walked, which
 * is a deliberate choice: the dungeons are procedural, a player has no memory
 * of them to fall back on, and hunting for an exit you have already found once
 * is not tension, it is an errand.
 */
function DungeonMap({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const map = game.map;
  const [size, setSize] = useState({ w: 440, h: 440 });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const src = getMinimap(map, 1);
    const aspect = map.w / map.h;
    const h = Math.min(Math.min(window.innerHeight - 280, 620), Math.min(window.innerWidth - 380, 620) / aspect);
    const w = h * aspect;
    setSize({ w, h });
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#07060b';
    g.fillRect(0, 0, w, h);
    g.drawImage(src, 0, 0, w, h);
  }, [map, game.uiVersion]);

  const exit = map.portals.find((p) => p.kind === 'stairs');
  const pos = (px: number, py: number) => ({
    left: `${(px / (map.w * TILE)) * 100}%`,
    top: `${(py / (map.h * TILE)) * 100}%`,
  });
  const st = game.mapState(map.id);
  const boss = map.spawns.find((sp) => sp.boss);
  const bossDown = boss ? st.everKilled.has(boss.id) : false;

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(860px, 96vw)' }}>
        <div className="panel-title">
          <span>{map.name}</span>
          <span className="sub">
            {map.w}×{map.h} · {st.cleared ? 'cleared' : boss ? (bossDown ? 'boss down' : 'boss alive') : 'no boss here'}
          </span>
          <button className="close-x" onClick={() => game.closeAll()}>×</button>
        </div>
        <div className="map-panel">
          <div className="map-canvas-wrap" style={{ padding: 16 }}>
            <div style={{ position: 'relative', width: size.w, height: size.h }}>
              <canvas ref={ref} style={{ position: 'absolute', inset: 0, border: '1px solid var(--edge)' }} />
              {exit ? (
                <div
                  title="The way out"
                  style={{
                    position: 'absolute', ...pos(exit.x + exit.w / 2, exit.y + exit.h / 2),
                    transform: 'translate(-50%,-50%)',
                  }}
                >
                  <span className="dm-exit" />
                  <span className="map-marker-label" style={{ color: '#6fd0e8' }}>Exit</span>
                </div>
              ) : null}
              {boss ? (
                <div
                  title={bossDown ? 'Already felled' : 'The boss room'}
                  style={{ position: 'absolute', ...pos(boss.x, boss.y), transform: 'translate(-50%,-50%)' }}
                >
                  <span className="dm-boss" style={bossDown ? { opacity: 0.35 } : undefined} />
                </div>
              ) : null}
              {map.chests.filter((c) => !st.opened.has(c.id)).map((c) => (
                <div key={c.id} style={{ position: 'absolute', ...pos(c.x, c.y), transform: 'translate(-50%,-50%)' }}>
                  <span className="dm-chest" />
                </div>
              ))}
              <div
                style={{
                  position: 'absolute', ...pos(game.player.x, game.player.y),
                  transform: 'translate(-50%,-50%)',
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#fdf8ef', boxShadow: '0 0 10px rgba(255,255,255,0.85)',
                  border: '2px solid #1a1422',
                }}
              />
            </div>
          </div>
          <div className="map-legend">
            <span><i className="dm-exit" />The way out</span>
            <span><i className="dm-boss" />Boss room</span>
            <span><i className="dm-chest" />Unopened chest</span>
            <span><i style={{ background: '#fdf8ef', borderRadius: '50%' }} />You</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorldMap({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const world = game.maps.get('overworld')!;
  // The world is taller than it is wide, so the sheet is drawn to the map's
  // own aspect rather than to a square. Everything below positions in
  // percentages of this box, so it follows whatever shape the world takes.
  const [size, setSize] = useState({ w: 440, h: 605 });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const src = getMinimap(world, 1);
    const aspect = world.w / world.h;
    const maxH = Math.min(window.innerHeight - 260, 660);
    const maxW = Math.min(window.innerWidth - 420, 660);
    const h = Math.min(maxH, maxW / aspect);
    const w = h * aspect;
    setSize({ w, h });
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#07060b';
    g.fillRect(0, 0, w, h);
    g.drawImage(src, 0, 0, w, h);
    // fog over undiscovered ground
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(8,7,14,0.55)';
    g.fillRect(0, 0, w, h);
    g.restore();
    for (const loc of LOCATIONS) {
      if (!game.player.discovered.has(loc.id)) continue;
      const x = (loc.tx / world.w) * w;
      const y = (loc.ty / world.h) * h;
      const r = ((loc.radius ?? 12) / world.w) * w * 3.4;
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
            <div style={{ position: 'relative', width: size.w, height: size.h }}>
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
              {game.map.id === 'overworld' ? (
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
          </div>
        </div>
      </div>
    </div>
  );
}
