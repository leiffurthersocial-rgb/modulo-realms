import { useEffect, useRef, useState } from 'react';
import type { Game } from '../../game/core/game';
import { LOCATIONS, LOCATION_BY_ID, REGION_BY_ID } from '../../data/locations';
import { TILE } from '../../game/world/tiles';
import { uiSound } from '../kit';
import { useGameValue } from '../hooks';

interface Banner {
  id: number;
  /** `place` is the full banner for a first visit; `quiet` just names it again. */
  kind: 'place' | 'quiet' | 'level';
  title: string;
  sub: string;
}

/** Player flag prefix: a place whose framed banner has already been shown. */
const VISITED_FLAG = 'ui:visited:';
/** How long each kind stays up; matches the animations in the stylesheet. */
const BANNER_MS: Record<Banner['kind'], number> = { place: 3200, quiet: 2200, level: 2600 };

const regionName = (id?: string) => (id ? (REGION_BY_ID as Record<string, { name: string; level: [number, number] } | undefined>)[id] : undefined);

/** Where the player is, as a banner would name it; `key` is stable across saves. */
function placeOf(game: Game): { key: string; title: string; sub: string } {
  const map = game.map;
  if (map.id !== 'overworld') {
    const parent = map.parent ? LOCATION_BY_ID[map.parent]?.name : undefined;
    const loc = LOCATIONS.find((l) => l.dungeon?.mapId === map.id);
    const sub = parent && parent !== map.name ? parent : loc ? `Level ${loc.dungeon!.level}` : '';
    return { key: `map:${map.id}`, title: map.name, sub };
  }
  // inside a place's own radius, the place; otherwise the region
  const p = game.player;
  for (const l of LOCATIONS) {
    if (l.surfaceMap) continue;
    const r = (l.radius ?? 8) * TILE;
    if (Math.abs(p.x - l.tx * TILE) > r || Math.abs(p.y - l.ty * TILE) > r) continue;
    if (Math.hypot(p.x - l.tx * TILE, p.y - l.ty * TILE) <= r) return { key: `loc:${l.id}`, title: l.name, sub: regionName(l.region)?.name ?? '' };
  }
  const id = game.regionAtPlayer();
  const region = regionName(id);
  return region
    ? { key: `region:${id}`, title: region.name, sub: `Level ${region.level[0]}–${region.level[1]}` }
    : { key: `map:${map.id}`, title: map.name, sub: '' };
}

/**
 * The banners across the top of the screen: the name of a place as you walk
 * into it ("The Gilded Spade"), and LEVEL UP when you gain one. The framed
 * banner with its sound is for the first time you ever enter a place (kept
 * as a player flag, so it survives reloads); after that the name is only
 * lettered quietly. A place only announces itself once every couple of
 * minutes, so walking along a border does not strobe.
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
    const flag = `${VISITED_FLAG}${place.key}`;
    const first = !game.player.flags.has(flag);
    if (first) {
      game.player.flags.add(flag);
      uiSound('banner');
    }
    setBanner({ id: nextId.current++, kind: first ? 'place' : 'quiet', title: place.title, sub: first ? place.sub : '' });
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
    const id = window.setTimeout(() => setBanner((b) => (b?.id === banner.id ? null : b)), BANNER_MS[banner.kind]);
    return () => window.clearTimeout(id);
  }, [banner]);

  if (!banner) return null;
  if (banner.kind === 'quiet') {
    return <div className="banner quiet" key={banner.id} role="status"><div className="bn-title">{banner.title}</div></div>;
  }
  return (
    <div className={`banner frame-ash ${banner.kind}`} key={banner.id} role="status">
      <div className="bn-title">{banner.title}</div>
      <div className="rule" />
      {banner.sub ? <div className="bn-sub">{banner.sub}</div> : null}
    </div>
  );
}
