import { PAL, shade } from './palette';
import { Px, type Canvas } from './pixel';
import { MODULO as GLYPHS } from '../../ui/kit/glyphs';

/**
 * The interface's own sprites: 9-slice frames, button plates, slots, key
 * caps, the scrim dither and a set of small glyph icons.
 *
 * Drawn at 1:1 like everything else in `art/` and handed to the stylesheet as
 * data URLs (`--img-*` custom properties, see `installUiArt`). A frame is a
 * small square whose corners are kept and whose edges and middle tile, which
 * is exactly what CSS `border-image` does — so a panel of any size is still
 * one piece of pixel art, not a box with a 1px line round it.
 */

type Draw = (p: Px) => void;

function px(w: number, h: number, draw: Draw): Px {
  const p = new Px(w, h);
  draw(p);
  return p;
}

/* ------------------------------------------------------------------ */
/* frames                                                              */
/* ------------------------------------------------------------------ */

/** A bevelled rectangle ring: outline, lit top-left, shaded bottom-right. */
function bevel(p: Px, x: number, y: number, w: number, h: number, lit: string, dark: string): void {
  p.fill(x, y, w - 1, 1, lit);
  p.fill(x, y, 1, h - 1, lit);
  p.fill(x + 1, y + h - 1, w - 1, 1, dark);
  p.fill(x + w - 1, y + 1, 1, h - 1, dark);
}

/** Knock the outermost corner pixels out, the pixel-art way of rounding. */
function notch(p: Px): void {
  for (const [x, y] of [[0, 0], [p.w - 1, 0], [0, p.h - 1], [p.w - 1, p.h - 1]]) p.g.clearRect(x, y, 1, 1);
}

function rivet(p: Px, x: number, y: number): void {
  p.set(x, y, PAL.ironLit).set(x + 1, y, PAL.iron).set(x, y + 1, PAL.iron).set(x + 1, y + 1, PAL.ironDark);
}

/**
 * Wood: the heavy frame for menus, the pause board and dialogue. A 6px plank
 * band with grain that repeats every 8px, iron brackets on the corners, and
 * an ash board inside. 24x24, slice 8.
 */
function frameWood(): Px {
  return px(24, 24, (p) => {
    p.fillAll(PAL.void);
    p.fill(1, 1, 22, 22, PAL.wood);
    // plank shading on the band: lit outer row, dark inner row
    bevel(p, 1, 1, 22, 22, PAL.plank, PAL.woodDark);
    bevel(p, 6, 6, 12, 12, PAL.woodDark, PAL.woodLit);
    // grain: short dark streaks, positioned so each 8px edge tile repeats
    for (const x of [9, 13]) { p.fill(x, 3, 2, 1, PAL.woodDark); p.fill(x + 1, 20, 2, 1, PAL.woodDark); }
    for (const y of [10, 14]) { p.fill(3, y, 1, 2, PAL.woodDark); p.fill(20, y + 1, 1, 2, PAL.woodDark); }
    p.fill(11, 4, 1, 1, PAL.woodLit); p.fill(4, 12, 1, 1, PAL.woodLit);
    // the board inside
    p.fill(7, 7, 10, 10, PAL.charcoal);
    p.fill(7, 7, 10, 1, PAL.ink);
    p.fill(7, 7, 1, 10, PAL.ink);
    // iron corner brackets
    for (const [cx, cy] of [[1, 1], [16, 1], [1, 16], [16, 16]]) {
      p.fill(cx, cy, 7, 7, PAL.ironDark);
      p.fill(cx + 1, cy + 1, 5, 5, PAL.iron);
      p.fill(cx + 1, cy + 1, 5, 1, PAL.ironLit);
      rivet(p, cx + 2, cy + 2);
    }
    notch(p);
  });
}

/** Ash: the plain dark plate for HUD pieces, tooltips and inner boxes. 12x12, slice 4. */
function frameAsh(): Px {
  return px(12, 12, (p) => {
    p.fillAll(PAL.void);
    p.fill(1, 1, 10, 10, PAL.charcoal);
    bevel(p, 1, 1, 10, 10, PAL.stone, PAL.slate);
    p.fill(2, 2, 8, 8, PAL.charcoal);
    notch(p);
  });
}

/** Inset: a sunken well inside a panel (lists, text boxes). 8x8, slice 3. */
function frameInset(): Px {
  return px(8, 8, (p) => {
    p.fillAll(PAL.ink);
    bevel(p, 0, 0, 8, 8, PAL.void, PAL.slate);
  });
}

/** Iron and brass: the same ring in two metals, for sockets and highlights. 12x12, slice 4. */
function frameMetal(lit: string, mid: string, dark: string, well: string): Px {
  return px(12, 12, (p) => {
    p.fillAll(PAL.void);
    p.fill(1, 1, 10, 10, mid);
    bevel(p, 1, 1, 10, 10, lit, dark);
    p.fill(3, 3, 6, 6, well);
    bevel(p, 3, 3, 6, 6, PAL.void, shadeOf(well));
    notch(p);
  });
}

const shadeOf = (well: string) => (well === PAL.ink ? PAL.slate : PAL.stone);

/**
 * Parchment: maps and the journal. A scorched edge round a pale sheet with a
 * little speckle that repeats every 6px. 18x18, slice 6.
 */
function frameParchment(): Px {
  return px(18, 18, (p) => {
    p.fillAll(PAL.sandLit);
    p.box(0, 0, 18, 18, PAL.woodDark);
    p.box(1, 1, 16, 16, PAL.copper);
    p.box(2, 2, 14, 14, PAL.sandDark);
    p.box(3, 3, 12, 12, PAL.sand);
    // burnt pits along the edge
    for (const [x, y] of [[8, 1], [1, 9], [16, 8], [9, 16], [10, 2], [2, 7]]) p.set(x, y, PAL.woodDark);
    // speckle in the middle tile (6..11)
    for (const [x, y] of [[7, 7], [10, 9], [8, 11], [11, 6]]) p.set(x, y, PAL.sand);
    notch(p);
  });
}

/* ------------------------------------------------------------------ */
/* buttons                                                             */
/* ------------------------------------------------------------------ */

interface Plate { face: string; lit: string; dark: string; lip: string }

const PLATES: Record<string, Plate> = {
  wood: { face: PAL.woodLit, lit: PAL.plank, dark: PAL.wood, lip: PAL.woodDark },
  woodHot: { face: PAL.plank, lit: PAL.plankLit, dark: PAL.woodLit, lip: PAL.woodDark },
  ember: { face: PAL.ember, lit: PAL.flame, dark: PAL.emberDark, lip: shade(PAL.emberDark, 0.55) },
  emberHot: { face: PAL.flame, lit: PAL.flameLit, dark: PAL.ember, lip: shade(PAL.emberDark, 0.55) },
  blood: { face: PAL.blood, lit: PAL.ember, dark: shade(PAL.blood, 0.65), lip: shade(PAL.blood, 0.35) },
  bloodHot: { face: PAL.ember, lit: PAL.flame, dark: PAL.blood, lip: shade(PAL.blood, 0.35) },
  dead: { face: PAL.slate, lit: PAL.stone, dark: PAL.charcoal, lip: PAL.ink },
  iron: { face: PAL.iron, lit: PAL.ironLit, dark: PAL.ironDark, lip: PAL.charcoal },
  ironHot: { face: PAL.ironLit, lit: PAL.steel, dark: PAL.iron, lip: PAL.charcoal },
};

/**
 * A raised button plate with a 2px lip under it. 12x14, slice 4 top/sides and
 * 6 bottom (the lip lives in the bottom slice). `pressed` drops the face onto
 * the lip, and the stylesheet moves the label down by the same 2px.
 */
function button(plate: Plate, pressed = false): Px {
  return px(12, 14, (p) => {
    const top = pressed ? 2 : 0;
    p.fill(0, top, 12, 14 - top, PAL.void);
    if (!pressed) p.fill(1, 11, 10, 2, plate.lip);
    const h = pressed ? 11 : 10;
    p.fill(1, top + 1, 10, h, plate.face);
    p.fill(1, top + 1, 10, 1, plate.lit);
    p.fill(1, top + 1, 1, h, plate.lit);
    p.fill(1, top + h, 10, 1, plate.dark);
    p.fill(10, top + 1, 1, h, plate.dark);
    notch(p);
    if (pressed) { p.g.clearRect(0, 0, 12, 2); p.g.clearRect(0, 2, 1, 1); p.g.clearRect(11, 2, 1, 1); }
  });
}

/** Tab: a plate open at the bottom. 12x10, slice 4 (bottom 1). */
function tab(active: boolean): Px {
  return px(12, 10, (p) => {
    p.fill(0, 0, 12, 10, PAL.void);
    const face = active ? PAL.charcoal : PAL.ink;
    p.fill(1, 1, 10, 9, active ? PAL.woodLit : PAL.wood);
    p.fill(1, 1, 10, 1, active ? PAL.plank : PAL.woodLit);
    p.fill(3, 3, 6, 7, face);
    p.fill(3, 3, 6, 1, active ? PAL.slate : PAL.void);
    if (active) p.fill(3, 9, 6, 1, PAL.charcoal);
    p.g.clearRect(0, 0, 1, 1); p.g.clearRect(11, 0, 1, 1);
  });
}

/** Key cap: bone face on a fog lip, for "E", "Space", "1". 9x10, slice 3 (bottom 4). */
function keycap(): Px {
  return px(9, 10, (p) => {
    p.fillAll(PAL.void);
    p.fill(1, 1, 7, 8, PAL.fog);
    p.fill(1, 1, 7, 6, PAL.bone);
    p.fill(1, 1, 7, 1, PAL.cloth);
    notch(p);
  });
}

/** Badge: a small brass plate for counts and levels. 8x8, slice 3. */
function badge(face: string, lit: string, dark: string): Px {
  return px(8, 8, (p) => {
    p.fillAll(PAL.void);
    p.fill(1, 1, 6, 6, face);
    bevel(p, 1, 1, 6, 6, lit, dark);
    notch(p);
  });
}

/* ------------------------------------------------------------------ */
/* bars                                                                */
/* ------------------------------------------------------------------ */

/** Bar socket: an iron channel the fill sits in. 6x7, slice 2. */
function barSocket(): Px {
  return px(6, 7, (p) => {
    p.fillAll(PAL.void);
    p.fill(1, 1, 4, 5, PAL.ink);
    p.fill(1, 1, 4, 1, PAL.void);
  });
}

/**
 * The texture laid over a bar's colour: a lit top row, a dark bottom row and
 * a notch every 6px, so the fill reads as segments rather than a smooth
 * gradient. 6x16 (only as many rows as the bar is tall are ever seen).
 */
function barSegments(): Px {
  return px(6, 16, (p) => {
    p.g.fillStyle = 'rgba(255,248,230,0.34)';
    p.g.fillRect(0, 0, 5, 1);
    p.g.fillStyle = 'rgba(0,0,0,0.30)';
    p.g.fillRect(0, 3, 5, 13);
    p.g.fillStyle = 'rgba(6,5,10,0.85)';
    p.g.fillRect(5, 0, 1, 16);
  });
}

/* ------------------------------------------------------------------ */
/* misc surfaces                                                       */
/* ------------------------------------------------------------------ */

/** 50% ordered dither for modal backdrops: dims without blurring or fading. */
function scrim(): Px {
  return px(2, 2, (p) => { p.set(0, 0, PAL.void).set(1, 1, PAL.void); });
}

/** Slider groove and knob. */
function sliderTrack(): Px {
  return px(8, 6, (p) => {
    p.fillAll(PAL.void);
    p.fill(1, 1, 6, 4, PAL.ink);
    p.fill(1, 4, 6, 1, PAL.slate);
  });
}
function sliderKnob(hot: boolean): Px {
  return px(8, 12, (p) => {
    p.fillAll(PAL.void);
    p.fill(1, 1, 6, 10, hot ? PAL.ironLit : PAL.iron);
    p.fill(1, 1, 6, 1, hot ? PAL.steel : PAL.ironLit);
    p.fill(1, 9, 6, 2, PAL.ironDark);
    p.fill(3, 3, 2, 5, hot ? PAL.goldLit : PAL.gold);
    notch(p);
  });
}
function sliderFill(): Px {
  return px(2, 6, (p) => {
    p.fill(0, 1, 2, 4, PAL.flame);
    p.fill(0, 1, 2, 1, PAL.flameLit);
    p.fill(0, 4, 2, 1, PAL.ember);
  });
}

/** Scrollbar thumb and track. */
function scrollThumb(): Px {
  return px(6, 8, (p) => {
    p.fillAll(PAL.void);
    p.fill(1, 1, 4, 6, PAL.woodLit);
    p.fill(1, 1, 4, 1, PAL.plank);
    p.fill(1, 6, 4, 1, PAL.wood);
  });
}

/**
 * A horizontal rule: a wood line with a brass stud on each end. 16x3; the
 * outer 7px on each side are the end caps, the middle two pixels repeat.
 */
function rule(): Px {
  return px(16, 3, (p) => {
    p.fill(2, 1, 12, 1, PAL.woodLit);
    p.fill(2, 2, 12, 1, PAL.void);
    for (const x of [0, 14]) {
      p.fill(x, 0, 2, 3, PAL.void);
      p.set(x, 0, PAL.goldLit).set(x + 1, 0, PAL.gold).set(x, 1, PAL.gold).set(x + 1, 1, PAL.copper);
    }
  });
}

/* ------------------------------------------------------------------ */
/* icons                                                               */
/* ------------------------------------------------------------------ */

type IconDraw = (p: Px) => void;

/** Glyph icons, 9x9 unless noted. Outlined in void so they read on anything. */
const ICONS: Record<string, [number, number, IconDraw]> = {
  coin: [9, 9, (p) => {
    p.circle(4.5, 4.5, 4, PAL.void);
    p.circle(4.5, 4.5, 3, PAL.gold);
    p.fill(3, 2, 3, 1, PAL.goldLit); p.fill(2, 3, 1, 3, PAL.goldLit);
    p.fill(4, 3, 1, 3, PAL.copper);
    p.fill(3, 7, 3, 1, PAL.copper);
  }],
  point: [9, 9, (p) => {
    // a four-pointed ember star: an unspent talent point
    p.poly([[4.5, 0], [6, 3], [9, 4.5], [6, 6], [4.5, 9], [3, 6], [0, 4.5], [3, 3]], PAL.void);
    p.fill(4, 1, 1, 7, PAL.flame); p.fill(1, 4, 7, 1, PAL.flame);
    p.fill(3, 3, 3, 3, PAL.flame);
    p.fill(4, 2, 1, 3, PAL.flameLit); p.fill(3, 4, 2, 1, PAL.holy);
  }],
  lock: [9, 9, (p) => {
    p.box(2, 0, 5, 5, PAL.void);
    p.box(3, 1, 3, 4, PAL.ironLit);
    p.fill(0, 4, 9, 5, PAL.void);
    p.fill(1, 5, 7, 3, PAL.iron);
    p.fill(1, 5, 7, 1, PAL.ironLit);
    p.fill(4, 6, 1, 2, PAL.void);
  }],
  close: [7, 7, (p) => {
    for (let i = 0; i < 7; i++) { p.set(i, i, PAL.bone); p.set(6 - i, i, PAL.bone); }
  }],
  check: [7, 7, (p) => {
    for (const [x, y] of [[0, 3], [1, 4], [2, 5], [3, 4], [4, 3], [5, 2], [6, 1]]) p.set(x, y, PAL.toxic);
  }],
  arrow: [5, 7, (p) => {
    for (let i = 0; i < 4; i++) p.fill(i, i, 1, 7 - i * 2, PAL.gold);
  }],
  // map markers, 9x9
  town: [9, 9, (p) => {
    p.poly([[0, 4.5], [4.5, 0], [9, 4.5]], PAL.void);
    p.fill(1, 4, 7, 5, PAL.void);
    p.poly([[1.5, 4.5], [4.5, 1.5], [7.5, 4.5]], PAL.ember);
    p.fill(2, 5, 5, 3, PAL.plank);
    p.fill(4, 6, 1, 2, PAL.woodDark);
  }],
  dungeon: [9, 9, (p) => {
    // a stone arch with a black mouth
    p.fill(0, 1, 9, 8, PAL.void);
    p.fill(1, 2, 7, 6, PAL.rockPale);
    p.fill(1, 2, 7, 1, PAL.snow);
    p.fill(3, 4, 3, 4, PAL.void);
    p.set(4, 3, PAL.void);
    p.g.clearRect(0, 1, 1, 1); p.g.clearRect(8, 1, 1, 1);
  }],
  camp: [9, 9, (p) => {
    // crossed blades
    for (let i = 0; i < 7; i++) { p.set(1 + i, 1 + i, PAL.steel); p.set(7 - i, 1 + i, PAL.steel); }
    p.outline(PAL.void);
    p.set(1, 7, PAL.woodLit); p.set(7, 7, PAL.woodLit);
  }],
  landmark: [9, 9, (p) => {
    // a standing stone
    p.fill(2, 0, 5, 9, PAL.void);
    p.fill(3, 1, 3, 7, PAL.rockLit);
    p.fill(3, 1, 1, 7, PAL.rockPale);
    p.fill(1, 8, 7, 1, PAL.void);
  }],
  waystone: [9, 11, (p) => {
    p.fill(2, 0, 5, 11, PAL.void);
    p.fill(1, 10, 7, 1, PAL.void);
    p.fill(3, 1, 3, 9, PAL.ironDark);
    p.fill(3, 3, 3, 4, PAL.frost);
    p.fill(4, 4, 1, 2, PAL.white);
    p.g.clearRect(2, 0, 1, 1); p.g.clearRect(6, 0, 1, 1);
  }],
  shrine: [9, 9, (p) => {
    p.fill(1, 2, 7, 7, PAL.void);
    p.fill(0, 1, 9, 2, PAL.void);
    p.fill(1, 1, 7, 1, PAL.bone);
    p.fill(2, 3, 1, 5, PAL.bone); p.fill(6, 3, 1, 5, PAL.bone);
    p.fill(4, 4, 1, 2, PAL.flameLit);
    p.fill(1, 8, 7, 1, PAL.fog);
  }],
  ruin: [9, 9, (p) => {
    p.fill(0, 2, 9, 7, PAL.void);
    p.fill(1, 3, 2, 5, PAL.fog); p.fill(6, 5, 2, 3, PAL.fog);
    p.fill(1, 3, 2, 1, PAL.bone);
    p.fill(1, 8, 7, 1, PAL.stone);
    p.g.clearRect(0, 2, 1, 1); p.g.clearRect(3, 2, 3, 3); p.g.clearRect(8, 2, 1, 3); p.g.clearRect(6, 2, 2, 3);
  }],
  chest: [9, 8, (p) => {
    p.fill(0, 0, 9, 8, PAL.void);
    p.fill(1, 1, 7, 6, PAL.woodLit);
    p.fill(1, 1, 7, 2, PAL.plank);
    p.fill(1, 3, 7, 1, PAL.gold);
    p.fill(4, 3, 1, 2, PAL.goldLit);
  }],
  door: [7, 9, (p) => {
    p.fill(0, 0, 7, 9, PAL.void);
    p.fill(1, 1, 5, 8, PAL.wood);
    p.fill(1, 1, 5, 1, PAL.woodLit);
    p.fill(3, 1, 1, 8, PAL.woodDark);
    p.set(4, 5, PAL.gold);
  }],
  exit: [9, 9, (p) => {
    // stairs going up and out
    p.fill(0, 0, 9, 9, PAL.void);
    p.fill(1, 6, 7, 2, PAL.frost);
    p.fill(3, 4, 5, 2, PAL.frost);
    p.fill(5, 2, 3, 2, PAL.frost);
    p.fill(7, 1, 1, 1, PAL.white);
    p.g.clearRect(0, 0, 4, 3); p.g.clearRect(0, 3, 2, 2);
  }],
  boss: [9, 9, (p) => {
    // a horned skull
    p.fill(1, 1, 7, 7, PAL.void);
    p.fill(0, 0, 2, 3, PAL.void); p.fill(7, 0, 2, 3, PAL.void);
    p.fill(2, 2, 5, 4, PAL.bone);
    p.fill(3, 6, 3, 1, PAL.bone);
    p.set(1, 1, PAL.flame); p.set(7, 1, PAL.flame);
    p.set(3, 3, PAL.ember); p.set(5, 3, PAL.ember);
  }],
  you: [7, 7, (p) => {
    p.fill(2, 0, 3, 7, PAL.void); p.fill(0, 2, 7, 3, PAL.void); p.fill(1, 1, 5, 5, PAL.void);
    p.fill(2, 2, 3, 3, PAL.white);
    p.set(3, 1, PAL.white); p.set(3, 5, PAL.white); p.set(1, 3, PAL.white); p.set(5, 3, PAL.white);
  }],
  quest: [5, 9, (p) => {
    p.fill(1, 0, 3, 6, PAL.void); p.fill(1, 7, 3, 2, PAL.void);
    p.fill(2, 1, 1, 4, PAL.goldLit); p.set(2, 8, PAL.goldLit);
  }],
  harbour: [9, 9, (p) => {
    // an anchor
    p.fill(4, 1, 1, 6, PAL.ironLit);
    p.fill(2, 2, 5, 1, PAL.ironLit);
    p.fill(1, 6, 1, 1, PAL.ironLit); p.fill(7, 6, 1, 1, PAL.ironLit);
    p.fill(2, 7, 5, 1, PAL.ironLit);
    p.set(4, 0, PAL.ironLit);
    p.outline(PAL.void);
  }],
  // HUD chips
  bag: [9, 9, (p) => {
    p.fill(1, 2, 7, 7, PAL.void);
    p.fill(2, 3, 5, 5, PAL.woodLit);
    p.fill(2, 3, 5, 1, PAL.plank);
    p.fill(3, 0, 3, 3, PAL.void); p.fill(4, 1, 1, 2, PAL.woodLit);
  }],
  skull: [9, 9, (p) => {
    p.fill(1, 0, 7, 8, PAL.void);
    p.fill(2, 1, 5, 4, PAL.bone);
    p.fill(3, 5, 3, 2, PAL.bone);
    p.set(3, 3, PAL.void); p.set(5, 3, PAL.void);
  }],
  flame: [7, 9, (p) => {
    p.poly([[3.5, 0], [7, 6], [5.5, 9], [1.5, 9], [0, 6]], PAL.void);
    p.poly([[3.5, 1.5], [6, 6], [5, 8], [2, 8], [1, 6]], PAL.flame);
    p.poly([[3.5, 4], [5, 7], [2, 7]], PAL.flameLit);
  }],
  potion: [7, 9, (p) => {
    p.fill(2, 0, 3, 3, PAL.void); p.fill(0, 3, 7, 6, PAL.void);
    p.fill(3, 1, 1, 2, PAL.woodLit);
    p.fill(1, 4, 5, 4, PAL.ember); p.fill(1, 4, 5, 1, PAL.flame);
    p.set(2, 5, PAL.white);
  }],
};

/**
 * The crest on the pause board: a heater shield in ash-iron with a single
 * ember flame and crossed blades behind it. 40x44.
 */
function crest(): Px {
  return px(40, 44, (p) => {
    // blades behind
    for (let i = 0; i < 34; i++) {
      p.fill(3 + i, 3 + i, 2, 2, PAL.void);
      p.fill(35 - i, 3 + i, 2, 2, PAL.void);
    }
    for (let i = 0; i < 32; i++) {
      p.set(4 + i, 4 + i, PAL.steel);
      p.set(35 - i, 4 + i, PAL.steel);
    }
    // shield
    p.poly([[7, 5], [33, 5], [33, 23], [20, 42], [7, 23]], PAL.void);
    p.poly([[9, 7], [31, 7], [31, 22], [20, 39], [9, 22]], PAL.ironDark);
    p.poly([[11, 9], [29, 9], [29, 21], [20, 36], [11, 21]], PAL.slate);
    p.fill(9, 7, 22, 1, PAL.iron);
    p.fill(9, 7, 1, 15, PAL.iron);
    // ember flame
    p.poly([[20, 12], [25, 22], [23, 30], [17, 30], [15, 22]], PAL.emberDark);
    p.poly([[20, 14], [24, 22], [22, 29], [18, 29], [16, 22]], PAL.flame);
    p.poly([[20, 19], [22, 25], [21, 28], [19, 28], [18, 25]], PAL.flameLit);
    p.set(20, 26, PAL.holy);
    // brass boss rivets
    for (const [x, y] of [[11, 9], [28, 9]]) { p.set(x, y, PAL.goldLit); p.set(x + 1, y, PAL.gold); }
  });
}


/**
 * The title word, cast in the UI font: every glyph pixel becomes a 4x4 block
 * banded like poured brass (a lit top edge, a body, a dark foot), outlined
 * in void and standing on a two-pixel ember shadow.
 */
function logo(word = 'MODULO', k = 4): Px {
  const glyphs = [...word].map((c) => GLYPHS[c] ?? GLYPHS[' ']);
  const widths = glyphs.map((g) => Math.max(...g.map((r) => r.length)));
  const gw = widths.reduce((a, w) => a + w + 1, -1);
  const pad = 2;
  const w = gw * k + pad * 2;
  const h = 7 * k + pad * 2 + 2;
  const mask = new Px(w, h);
  let gx = 0;
  glyphs.forEach((g, i) => {
    g.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] !== '#') continue;
        const x = pad + (gx + rx) * k;
        const y = pad + ry * k;
        const above = ry > 0 && g[ry - 1][rx] === '#';
        const below = ry < 6 && g[ry + 1]?.[rx] === '#';
        mask.fill(x, y, k, k, PAL.gold);
        if (!above) mask.fill(x, y, k, 1, PAL.holy);
        else mask.fill(x, y, k, 1, PAL.goldLit);
        if (!below) mask.fill(x, y + k - 1, k, 1, PAL.copper);
        if (ry >= 5) mask.fill(x, y + k - 2, k, 2, below ? PAL.gold : PAL.copper);
      }
    });
    gx += widths[i] + 1;
  });
  const out = new Px(w, h);
  // ember drop shadow, then the void outline, then the metal
  const shadow = mask.clone();
  shadow.tint(PAL.emberDark, 1);
  out.blit(shadow, 0, 2);
  mask.outline(PAL.void, true);
  out.blit(mask, 0, 0);
  return out;
}

/* ------------------------------------------------------------------ */
/* registry                                                            */
/* ------------------------------------------------------------------ */

const BUILDERS: Record<string, () => Px> = {
  'frame-wood': frameWood,
  'frame-ash': frameAsh,
  'frame-inset': frameInset,
  'frame-iron': () => frameMetal(PAL.ironLit, PAL.iron, PAL.ironDark, PAL.ink),
  'frame-brass': () => frameMetal(PAL.goldLit, PAL.gold, PAL.copper, PAL.ink),
  'frame-ember': () => frameMetal(PAL.flameLit, PAL.flame, PAL.ember, PAL.ink),
  'frame-frost': () => frameMetal(PAL.white, PAL.frost, PAL.waterLit, PAL.ink),
  'frame-parchment': frameParchment,
  'btn': () => button(PLATES.wood),
  'btn-hot': () => button(PLATES.woodHot),
  'btn-down': () => button(PLATES.wood, true),
  'btn-primary': () => button(PLATES.ember),
  'btn-primary-hot': () => button(PLATES.emberHot),
  'btn-primary-down': () => button(PLATES.ember, true),
  'btn-danger': () => button(PLATES.blood),
  'btn-danger-hot': () => button(PLATES.bloodHot),
  'btn-danger-down': () => button(PLATES.blood, true),
  'btn-iron': () => button(PLATES.iron),
  'btn-iron-hot': () => button(PLATES.ironHot),
  'btn-iron-down': () => button(PLATES.iron, true),
  'btn-off': () => button(PLATES.dead),
  'tab': () => tab(false),
  'tab-on': () => tab(true),
  'key': keycap,
  'badge': () => badge(PAL.gold, PAL.goldLit, PAL.copper),
  'badge-ember': () => badge(PAL.ember, PAL.flame, PAL.emberDark),
  'badge-iron': () => badge(PAL.iron, PAL.ironLit, PAL.ironDark),
  'bar-socket': barSocket,
  'bar-seg': barSegments,
  'scrim': scrim,
  'slider-track': sliderTrack,
  'slider-knob': () => sliderKnob(false),
  'slider-knob-hot': () => sliderKnob(true),
  'slider-fill': sliderFill,
  'scroll-thumb': scrollThumb,
  'rule': rule,
  'crest': crest,
  'logo': () => logo(),
};

const canvasCache = new Map<string, Canvas>();
const urlCache = new Map<string, string>();

/** A UI sprite as a canvas (for the renderer and other canvases). */
export function uiSprite(name: string): Canvas {
  let c = canvasCache.get(name);
  if (!c) {
    const icon = ICONS[name];
    if (icon) {
      const [w, h, draw] = icon;
      c = px(w, h, draw).canvas;
    } else {
      const build = BUILDERS[name];
      if (!build) throw new Error(`unknown UI sprite ${name}`);
      c = build().canvas;
    }
    canvasCache.set(name, c);
  }
  return c;
}

/** A UI sprite as a data URL (for `<img>` and CSS). */
export function uiSpriteUrl(name: string): string {
  let u = urlCache.get(name);
  if (!u) {
    u = uiSprite(name).toDataURL();
    urlCache.set(name, u);
  }
  return u;
}

export const UI_ICON_NAMES = Object.keys(ICONS);
export type UiIcon = keyof typeof ICONS;

/** Publish every frame and icon as `--img-<name>` on the root element. */
export function installUiArt(root: HTMLElement = document.documentElement): void {
  for (const name of [...Object.keys(BUILDERS), ...Object.keys(ICONS)]) {
    root.style.setProperty(`--img-${name}`, `url("${uiSpriteUrl(name)}")`);
  }
}
