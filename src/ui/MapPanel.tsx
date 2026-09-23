import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Game } from '../game/core/game';
import { LOCATIONS, REGION_BY_INDEX, type LocationKind } from '../data/locations';
import { TILE } from '../game/world/tiles';
import { atlasFog, dungeonSheet, parchmentAtlas, regionLabelPoints } from '../game/art/mapArt';
import type { UiIcon } from '../game/art/uiArt';
import { Badge, Icon, Modal, useUiMetrics, uiSound } from './kit';

export default function MapPanel({ game }: { game: Game }) {
  // Inside a dungeon the panel used to draw the overworld, which is no use to
  // anybody standing in a corridor: the one thing you actually want from a map
  // down there is which way is out. Every interior draws its own floor now.
  if (game.map.id !== 'overworld') return <DungeonMap game={game} />;
  return <WorldMap game={game} />;
}

const KIND_ICON: Record<LocationKind, UiIcon> = {
  town: 'town', village: 'town', dungeon: 'dungeon', cave: 'dungeon',
  camp: 'camp', shrine: 'shrine', landmark: 'landmark', ruin: 'ruin',
};

/**
 * The floor you are standing on, with the way out marked.
 *
 * It draws the whole layout rather than only the rooms you have walked, which
 * is a deliberate choice: the dungeons are procedural, a player has no memory
 * of them to fall back on, and hunting for an exit you have already found once
 * is not tension, it is an errand.
 *
 * Drawn as a plan — pale floor, inked walls — at a whole number of pixels per
 * tile, with the exit, doors, chests and the boss as icons on top.
 */
function DungeonMap({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ui = useUiMetrics();
  const map = game.map;
  // the largest whole number of UI pixels per tile that fits the panel
  const s = Math.max(2, Math.min(6, Math.floor(Math.min((ui.w - 60) / map.w, (ui.h - 80) / map.h))));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const sheet = dungeonSheet(map, s);
    canvas.width = sheet.width;
    canvas.height = sheet.height;
    const g = canvas.getContext('2d')!;
    g.drawImage(sheet, 0, 0);
  }, [map, s, game.uiVersion]);

  const exit = map.portals.find((p) => p.kind === 'stairs');
  const doors = map.portals.filter((p) => p !== exit);
  const pos = (px: number, py: number) => ({ left: Math.round((px / TILE) * s), top: Math.round((py / TILE) * s) });
  const st = game.mapState(map.id);
  const spawnBoss = map.spawns.find((sp) => sp.boss);
  const boss = spawnBoss ?? game.bossTarget ?? (map.encounterNodes?.boss?.[0] ? { ...map.encounterNodes.boss[0], id: map.id } : undefined);
  const bossDown = st.cleared || (spawnBoss ? st.everKilled.has(spawnBoss.id) : false);
  const objectives = map.props.filter((p) => p.interact === 'aegean' && p.data?.action === 'objective');

  return (
    <Modal
      title={map.name}
      sub={`${map.w}×${map.h} · ${st.cleared ? 'cleared' : boss ? (bossDown ? 'boss down' : 'boss alive') : 'no boss here'}`}
      size="xl"
      onClose={() => game.closeAll()}
    >
      <div className="map-panel">
        <div className="map-canvas-wrap">
          <div className="dm-sheet frame-parchment">
            <div style={{ position: 'relative', width: map.w * s, height: map.h * s }}>
              <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: map.w * s, height: map.h * s }} />
              {doors.map((d, i) => (
                <Marker key={`d${i}`} icon="door" at={pos(d.x + d.w / 2, d.y + d.h / 2)} title={d.label || 'Door'} />
              ))}
              {map.chests.filter((c) => !st.opened.has(c.id)).map((c) => (
                <Marker key={c.id} icon="chest" at={pos(c.x, c.y)} title="Unopened chest" />
              ))}
              {objectives.map((o, i) => (
                <span key={`o${i}`} className="map-marker" style={pos(o.x, o.y)} title={o.label}>
                  <Badge tone={o.data?.complete ? 'iron' : 'brass'}>{i + 1}</Badge>
                </span>
              ))}
              {boss ? (
                <Marker icon="boss" at={pos(boss.x, boss.y)} title={bossDown ? 'Already felled' : 'The boss room'} className={bossDown ? 'spent' : 'blink'} />
              ) : null}
              {exit ? <Marker icon="exit" at={pos(exit.x + exit.w / 2, exit.y + exit.h / 2)} title="The way out" className="exit" label="Exit" /> : null}
              <Marker icon="you" at={pos(game.player.x, game.player.y)} title="You" className="you" />
            </div>
          </div>
        </div>
        <div className="map-legend">
          <span><Icon name="exit" />The way out</span>
          <span><Icon name="door" />Door</span>
          <span><Icon name="boss" />Boss room</span>
          <span><Icon name="chest" />Unopened chest</span>
          {objectives.length ? <span><Badge>1</Badge>Encounter mechanism</span> : null}
          <span><Icon name="you" />You</span>
        </div>
      </div>
    </Modal>
  );
}

function Marker({
  icon, at, title, className, label, onClick,
}: { icon: UiIcon; at: { left: number | string; top: number | string }; title: string; className?: string; label?: string; onClick?: () => void }) {
  return (
    <span
      className={`map-marker${className ? ` ${className}` : ''}${onClick ? ' clickable' : ''}`}
      style={at}
      title={title}
      onClick={onClick}
    >
      <Icon name={icon} />
      {label ? <span className="map-marker-label">{label}</span> : null}
    </span>
  );
}

/** Atlas zoom levels: tiles per source pixel, and UI pixels per source pixel. */
const ZOOMS = [
  { step: 4, mul: 1 },
  { step: 2, mul: 1 },
  { step: 1, mul: 1 },
  { step: 1, mul: 2 },
];

/**
 * The atlas: the whole world on one sheet of parchment.
 *
 * Unknown country is hatched over and opens up in blocks as places are
 * found. Region names are lettered onto the map where they lie (only for
 * regions you have set foot in), places are pixel icons, and attuned
 * waystones glow and can be clicked to travel. Zoom is in whole steps.
 */
function WorldMap({ game }: { game: Game }) {
  const world = game.maps.get('overworld')!;
  const [zoom, setZoom] = useState(1);
  const z = ZOOMS[zoom];
  const w = Math.ceil(world.w / z.step) * z.mul;
  const h = Math.ceil(world.h / z.step) * z.mul;
  const mapRef = useRef<HTMLCanvasElement>(null);
  const fogRef = useRef<HTMLCanvasElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const discovered = game.player.discovered;

  useEffect(() => {
    const m = mapRef.current;
    const f = fogRef.current;
    if (!m || !f) return;
    const sheet = parchmentAtlas(world, z.step);
    m.width = sheet.width;
    m.height = sheet.height;
    m.getContext('2d')!.drawImage(sheet, 0, 0);
    const fog = atlasFog(world, z.step, discovered);
    f.width = fog.width;
    f.height = fog.height;
    f.getContext('2d')!.drawImage(fog, 0, 0);
  }, [world, z.step, discovered, discovered.size]);

  const centerOn = (tx: number, ty: number) => {
    const el = scroll.current;
    if (!el) return;
    el.scrollLeft = (tx / world.w) * w - el.clientWidth / 2;
    el.scrollTop = (ty / world.h) * h - el.clientHeight / 2;
  };
  // Keep the same spot under the middle of the view when zooming, and start
  // centred on the player.
  const focus = useRef<{ tx: number; ty: number }>({ tx: game.player.x / TILE, ty: game.player.y / TILE });
  useLayoutEffect(() => { centerOn(focus.current.tx, focus.current.ty); }, [zoom]);
  const rememberCentre = () => {
    const el = scroll.current;
    if (!el) return;
    focus.current = {
      tx: ((el.scrollLeft + el.clientWidth / 2) / w) * world.w,
      ty: ((el.scrollTop + el.clientHeight / 2) / h) * world.h,
    };
  };
  const changeZoom = (d: number) => {
    const next = Math.max(0, Math.min(ZOOMS.length - 1, zoom + d));
    if (next === zoom) return;
    rememberCentre();
    uiSound('tab');
    setZoom(next);
  };

  // drag to pan
  const drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null);

  const toPos = (tx: number, ty: number) => ({ left: Math.round((tx / world.w) * w), top: Math.round((ty / world.h) * h) });
  const markers = game.quests.markers();
  const trackedMarker = game.trackedQuest ? markers.find((m) => m.quest.id === game.trackedQuest) : undefined;
  const knownRegions = useMemo(() => {
    const set = new Set<string>();
    for (const l of LOCATIONS) if (discovered.has(l.id)) set.add(l.region);
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discovered.size]);
  const labels = regionLabelPoints(world);
  const c = game.worldCoords();

  return (
    <Modal
      title="Ashvale & the Aegean"
      sub={`${discovered.size} / ${LOCATIONS.length} places found · ${game.timeLabel}${game.isDebug || game.debug ? ` · ${c.x}, ${c.y}` : ''}`}
      size="xl"
      tall
      onClose={() => game.closeAll()}
      actions={
        <span className="atlas-zoom" role="group" aria-label="Atlas zoom">
          <button className="btn small iron" onClick={() => changeZoom(-1)} disabled={zoom === 0} aria-label="Zoom out">−</button>
          <span className="az-pips">{ZOOMS.map((_, i) => <i key={i} className={i <= zoom ? 'on' : ''} />)}</span>
          <button className="btn small iron" onClick={() => changeZoom(1)} disabled={zoom === ZOOMS.length - 1} aria-label="Zoom in">+</button>
          <button className="btn small" onClick={() => { focus.current = { tx: game.player.x / TILE, ty: game.player.y / TILE }; centerOn(focus.current.tx, focus.current.ty); }}>Find me</button>
        </span>
      }
    >
      <div className="map-panel">
        <div
          ref={scroll}
          className="atlas-scroll frame-parchment scroll"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('.clickable')) return;
            const el = scroll.current!;
            drag.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
            el.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            const el = scroll.current;
            if (!d || !el) return;
            const r = el.getBoundingClientRect();
            const k = el.clientWidth / r.width; // screen pixels to UI pixels
            el.scrollLeft = d.l - (e.clientX - d.x) * k;
            el.scrollTop = d.t - (e.clientY - d.y) * k;
          }}
          onPointerUp={() => { drag.current = null; rememberCentre(); }}
          onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); changeZoom(e.deltaY < 0 ? 1 : -1); } }}
        >
          <div className="atlas-sheet" style={{ width: w, height: h }}>
            <canvas ref={mapRef} style={{ width: w, height: h }} />
            <canvas ref={fogRef} style={{ width: w, height: h }} />
            {labels.filter((l) => knownRegions.has(REGION_BY_INDEX[l.index]?.id)).map((l) => {
              const r = REGION_BY_INDEX[l.index];
              return (
                <span key={r.id} className="atlas-region" style={toPos(l.x, l.y)} title={r.blurb}>
                  <span className="ar-name">{r.name}</span>
                  <span className="ar-level">Lv {r.level[0]}–{r.level[1]}</span>
                </span>
              );
            })}
            {LOCATIONS.filter((l) => !l.surfaceMap && discovered.has(l.id)).map((l) => {
              const attuned = game.player.waystones.has(l.id);
              const quest = markers.some((m) => m.location === l.id);
              const tracked = trackedMarker?.location === l.id;
              return (
                <Marker
                  key={l.id}
                  icon={attuned ? 'waystone' : KIND_ICON[l.kind]}
                  at={toPos(l.tx, l.ty)}
                  title={`${l.name} — ${l.desc}${attuned ? ' (waystone: click to travel)' : ''}`}
                  className={`${attuned ? 'waystone' : ''}${quest ? ' quest' : ''}${tracked ? ' tracked' : ''}${zoom >= 2 ? ' named' : ''}`}
                  label={l.name}
                  onClick={attuned ? () => game.travelToWaystone(l.id) : undefined}
                />
              );
            })}
            {trackedMarker ? (() => {
              const loc = LOCATIONS.find((l) => l.id === trackedMarker.location);
              return loc ? <Marker icon="quest" at={toPos(loc.tx, loc.ty - 6)} title={`Tracking: ${trackedMarker.quest.name}`} className="tracked-flag blink" /> : null;
            })() : null}
            <Marker icon="you" at={toPos(game.player.x / TILE, game.player.y / TILE)} title="You" className="you" />
          </div>
        </div>
        <div className="map-legend">
          <span><Icon name="town" />Settlement</span>
          <span><Icon name="dungeon" />Dungeon</span>
          <span><Icon name="camp" />Enemy camp</span>
          <span><Icon name="landmark" />Landmark</span>
          <span><Icon name="waystone" />Waystone — click to travel</span>
          {trackedMarker ? <span className="tracking"><Icon name="quest" />{trackedMarker.quest.name}</span> : null}
          <span className="muted">Drag to pan · Ctrl+wheel to zoom</span>
        </div>
      </div>
    </Modal>
  );
}
