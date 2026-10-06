/*
 * Scenes for marketing/record.mjs. `setup` runs in the page with the game
 * on `window.game` (dev build) and must be self-contained (it is
 * serialised): place the hero, set the hour, gear up, spawn what the clip is
 * about. `pilot` turns the fighting autopilot on; `zoom` is the world zoom.
 */

/** Shared opening for every scene, inlined by each setup because setups are serialised. */
const PLACE = `
  const g = window.game;
  const at = (tx, ty) => {
    const spot = g.findStandingSpot(tx * 32 + 16, ty * 32 + 16);
    g.player.x = spot.x; g.player.y = spot.y;
    g.enemies.length = 0;
  };
`;
const scene = (body) => new Function('args', PLACE + body);

export const SCENES = {
  /** A wolf pack at dusk on the edge of the Thornhollow wood. */
  wolfpack: {
    seconds: 18,
    name: 'Torvin',
    pilot: { reach: 46, dash: true },
    setup: scene(`
      g.godMode = true;
      g.debugSetLevel(20);
      at(352, 458);
      g.debugSetHour(19);
      g.debugSpawn('wolf', { level: 18, count: 5 });
    `),
  },
  /** The Forest Matriarch, at night, against a paladin. */
  matriarch: {
    seconds: 22,
    name: 'Maela',
    pilot: { reach: 60, dash: true },
    setup: scene(`
      g.godMode = true;
      g.debugSetClass('paladin');
      g.debugSetLevel(16);
      at(326, 430);
      g.debugSetHour(22);
      g.debugSpawn('boss_matriarch', { level: 13 });
    `),
  },
  /** Snow on the crag road below Northwatch; a warden of the frost and its pack. */
  frost: {
    seconds: 20,
    name: 'Rurik',
    pilot: { reach: 50, dash: true },
    setup: scene(`
      g.godMode = true;
      g.debugSetClass('ranger');
      g.debugSetLevel(26);
      at(470, 322);
      g.debugSetHour(15);
      g.debugSpawn('mini_frostwarden', { level: 24 });
      g.debugSpawn('wolf', { level: 22, count: 3 });
    `),
  },
  /** A mage against the Cinder Maw in the ash of the far south. */
  ember: {
    seconds: 22,
    name: 'Ysra',
    pilot: { reach: 150, dash: false },
    setup: scene(`
      g.godMode = true;
      g.freeCasting = true;
      g.debugSetClass('mage');
      g.debugSetLevel(60);
      at(520, 792);
      g.debugSetHour(20);
      g.debugSpawn('boss_cinder_maw', { level: 58 });
    `),
  },
  /** Ashvale at night: torches, smoke, the town going to bed. No fighting. */
  ashvale: {
    seconds: 16,
    name: 'Ashe',
    pilot: { wander: true },
    zoom: 3,
    setup: scene(`
      g.godMode = true;
      at(480, 452);
      g.debugSetHour(21.5);
    `),
  },
};
