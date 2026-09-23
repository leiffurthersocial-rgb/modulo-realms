import { useEffect, useRef, useState } from 'react';
import type { Game } from '../../game/core/game';
import { LOCATIONS, LOCATION_BY_ID, REGION_BY_ID } from '../../data/locations';
import { TILE } from '../../game/world/tiles';
import { uiSound } from '../kit';
import { useGameValue } from '../hooks';

interface Banner {
  id: number;
  kind: 'place' | 'level';
  title: string;
  sub: string;
}

const regionName = (id?: string) => (id ? (REGION_BY_ID as Record<string, { name: string; level: [number, number] } | undefined>)[id] : undefined);

/** Where the player is, as a banner would name it. */
function placeOf(game: Game): { title: string; sub: string } {
  const map = game.map;
  if (map.id !== 'overworld') {
    const parent = map.parent ? LOCATION_BY_ID[map.parent]?.name : undefined;
    const loc = LOCATIONS.find((l) => l.dungeon?.mapId === map.id);
    return { title: map.name, sub: parent ?? (loc ? `Level ${loc.dungeon!.level}` : '') };
  }
  // inside a place's own radius, the place; otherwise the region
  const p = game.player;
  for (const l of LOCATIONS) {
    if (l.surfaceMap) continue;
    const r = (l.radius ?? 8) * TILE;
    if (Math.abs(p.x - l.tx * TILE) > r || Math.abs(p.y - l.ty * TILE) > r) continue;
    if (Math.hypot(p.x - l.tx * TILE, p.y - l.ty * TILE) <= r) return { title: l.name, sub: regionName(l.region)?.name ?? '' };
  }
  const region = regionName(game.regionAtPlayer());
  return region ? { title: region.name, sub: `Level ${region.level[0]}–${region.level[1]}` } : { title: map.name, sub: '' };
}

/**
 * The banners across the top of the screen: the name of a place as you walk
 * into it ("The Gilded Spade"), and LEVEL UP when you gain one. A place only
 * announces itself once every couple of minutes, so walking along a border
 * does not strobe.
 */
export default function Banners({ game }: { game: Game }) {
  const place = useGameValue(() => (game.fade.alpha > 0.5 ? null : placeOf(game)), 2);
  const level = useGameValue(() => game.player.level, 4);
  const [banner, setBanner] = useState<Banner | null>(null);
  const seen = useRef(new Map<string, number>());
  const last = useRef<{ title: string | null; level: number }>({ title: null, level });
  const nextId = useRef(1);

  useEffect(() => {
    if (!place) return;
    const prev = last.current.title;
    last.current.title = place.title;
    // the first place after loading is where you already are
    if (prev === null || prev === place.title) return;
    const now = performance.now();
    if (now - (seen.current.get(place.title) ?? -1e9) < 120000) return;
    seen.current.set(place.title, now);
    setBanner({ id: nextId.current++, kind: 'place', title: place.title, sub: place.sub });
    uiSound('banner');
  }, [place?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const prev = last.current.level;
    last.current.level = level;
    if (level <= prev) return;
    setBanner({ id: nextId.current++, kind: 'level', title: 'Level up', sub: `Level ${level}` });
    uiSound('banner');
  }, [level]);

  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner((b) => (b?.id === banner.id ? null : b)), banner.kind === 'level' ? 2600 : 3200);
    return () => window.clearTimeout(id);
  }, [banner]);

  if (!banner) return null;
  return (
    <div className={`banner frame-ash ${banner.kind}`} key={banner.id} role="status">
      <div className="bn-title">{banner.title}</div>
      <div className="rule" />
      {banner.sub ? <div className="bn-sub">{banner.sub}</div> : null}
    </div>
  );
}
