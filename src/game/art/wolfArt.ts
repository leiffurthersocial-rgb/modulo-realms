import { PAL, mix, shade, withAlpha } from './palette';
import { Px } from './pixel';
import { CH_FEET, CH_H } from './characters';
import type { CPose, CreatureStyle } from './creatures';

/**
 * The wolf, drawn from a hand-made reference rather than from ellipses: a
 * low slate body under a shaggy crest, a head turned three-quarters so both
 * eyes show, pale shins and a pale tail tip, all inside a hard ink line.
 *
 * The art is kept as character grids and only the palette is computed, so
 * every wolf in the bestiary (grey, dire, frost, gloam, drowned, glass …)
 * is the same animal in its own coat:
 *
 *   #  outline        o  coat          +  lit coat      d  coat in shadow
 *   l  pale points    L  palest        W  eyes          T  teeth    n  nose
 *
 * The walk is not drawn frame by frame — the shins and paws of the standing
 * pose are stepped along in diagonal pairs, the way a trotting dog moves.
 */

/** Standing, facing right: shaggy crest, two eyes of a head turned three-quarters, pale shins. */
const SIDE_STAND = [
  '....................####..............',
  '....................#ooo##............',
  '.....................##o++##..........',
  '..................###++oo++###..##....',
  '.................#oo++++++#+#+##+#....',
  '.................###ooo++#+l#+#+l#....',
  '................##oo##oo++ll##+ll#....',
  '..............##ooooo###o+++oooo+##...',
  '............##ooooo##++++++++++++#o##.',
  '..........##oooooo#oooo+++oo#o+++o#oo#',
  '........##oooooooo####oooooo#WoooW####',
  '......##oooooooooooooo#oooooooo++++#..',
  '.....#o#ooooooooooooo#ooo##llloo+lLL#.',
  '....#o#oooooooooooooo####++###ll++ll#.',
  '...#oo#oooooooooooooooo+++++#.##LLL#..',
  '..#ooo#oooooo#ooooo#oo++++++#...###...',
  '..#oooo#ooo+########oo++###+#.........',
  '.#ooooo#oo++##ooo#.#o++#.#o+#.........',
  '.#looo##o++#.#oo#..#o+#..#o+#.........',
  '#lloo##lo++##loo#..#++#..#o+#.........',
  '#Lll#.#ll##.#ll#...#l+#..#ol#.........',
  '#Ll#..#ll#..#ll#...#ll#..#ll#.........',
  '###...#lLL#.#lLL#..#lLL#.#lLL#........',
  '.......####..####..#####.#####........',
];

/** The same with the eyes shut — the idle blink and the flinch. */
const SIDE_BLINK = [
  '....................####..............',
  '....................#ooo##............',
  '.....................##o++##..........',
  '..................###++oo++###..##....',
  '.................#oo++++++#+#+##+#....',
  '.................###ooo++#+l#+#+l#....',
  '................##oo##oo++ll##+ll#....',
  '..............##ooooo###o+++oooo+##...',
  '............##ooooo##++++++++++++#o##.',
  '..........##oooooo#oooo+++oooo+++o#oo#',
  '........##oooooooo####oooooo##ooo#####',
  '......##oooooooooooooo#oooooooo++++#..',
  '.....#o#ooooooooooooo#ooo##llloo+lLL#.',
  '....#o#oooooooooooooo####++###ll++ll#.',
  '...#oo#oooooooooooooooo+++++#.##LLL#..',
  '..#ooo#oooooo#ooooo#oo++++++#...###...',
  '..#oooo#ooo+########oo++###+#.........',
  '.#ooooo#oo++##ooo#.#o++#.#o+#.........',
  '.#looo##o++#.#oo#..#o+#..#o+#.........',
  '#lloo##lo++##loo#..#++#..#o+#.........',
  '#Lll#.#ll##.#ll#...#l+#..#ol#.........',
  '#Ll#..#ll#..#ll#...#ll#..#ll#.........',
  '###...#lLL#.#lLL#..#lLL#.#lLL#........',
  '.......####..####..#####.#####........',
];

/** Airborne: forelegs reaching, hind legs thrown back. */
const SIDE_LEAP = [
  '....................####..............',
  '....................#ooo##............',
  '.....................##o++##..........',
  '..................###++oo++###..##....',
  '.................#oo++++++#+#+##+#....',
  '...............#####ooo++#+l#+#+l#....',
  '.............##ooooo##oo++ll##+ll#....',
  '...........##oooooooo###o+++oooo+##...',
  '.........##oooooooo##++++++++++++#o##.',
  '.......##ooooooooo#oooo+++oo#o+++o#oo#',
  '......#ooooooooooo####oooooo#WoooW####',
  '.....##ooooooooooooooo#oooooooo++++#..',
  '....##ooooooooooooooo#ooo##llloo+lLL#.',
  '...#o#ooooooooooooooo####++###ll++ll#.',
  '..#oo#oooooo#oooooo#oo++++#+++##LLL#..',
  '..#ooo##oo++########oo++##.#+++####...',
  '.#o####oo++#o#.....#o++#....#o+#......',
  '.##llllo+++#o#.....#o+#......#ol#.....',
  '#l#Llooo++#o#......#++#.......#ll#....',
  '#L#L######o#.......#l+#.......#lLL#...',
  '#L##...#L##........#ll#........####...',
  '###....##..........#ll#...............',
  '...................#lLL#..............',
  '...................#####..............',
];

/** Head down, jaws open over the teeth. */
const SIDE_BITE = [
  '....................####..............',
  '....................#ooo##............',
  '.....................##o++##..........',
  '..................###++oo++###..##....',
  '.................#oo++++++#+#+##+#....',
  '..............###o##ooo++#+l#+#+l#....',
  '............##oooooo##oo++ll##+ll#....',
  '..........##ooooooooo###o+++oooo+##...',
  '........##ooooooooo##++++++++++++#o##.',
  '......##oooooooooo#oooo+++oo#o+++o#oo#',
  '.....#o#oooooooooo####oooooo#WoooW####',
  '....#o#ooooooooooooooo#oooooooo++++#..',
  '...#oo#oooooooooooooo#oooooTTToo+lLL#.',
  '..#ooo#oooooo#ooooooo######lllTT++ll#.',
  '..#ooo#ooo+####ooo#ooo+++++###llTTT#..',
  '.#oooo#oo++##oo####ooo++++++#.##LLL#..',
  '.#looo#o++#.#oo#..#oo+####o+#...###...',
  '#llo##lo++#.#oo#..#++#....#o+#........',
  '#Lll##ll##..#ll#..#l+#....#ol#........',
  '#Ll#.#ll#...#ll#..#ll#....#ll#........',
  '###..#lLL#..#LL#..#lLL#...#lLL#.......',
  '......####..####..#####...#####.......',
];

/** Coming at the camera: back and crest behind, head in front, forelegs under the chin, hind paws outside. */
const FRONT = [
  '........................',
  '......#..........#......',
  '......##........##......',
  '.....#l+#......#+l#.....',
  '.....#ll+#.##.#+ll#.....',
  '....##ll+##oo##+ll##....',
  '...#o#o+++o++o+++o#o#...',
  '...#oo#o++++++++o#oo#...',
  '...#o#oo+++oo+++oo#o#...',
  '..#oo#o###++++###o#oo#..',
  '..#o#oo#W#++++#W#oo#o#..',
  '...#oooo#llllll#oooo#...',
  '..#o#oooo#llll#oooo#o#..',
  '..#oo#ooo#lLLl#ooo#oo#..',
  '...#o#ooo#L##L#ooo#o#...',
  '...#oo#oo##nn##oo#oo#...',
  '....#o#oo+####+oo#o#....',
  '....#o#o#++++++#o#o#....',
  '....#o#o#++++++#o#o#....',
  '...#oo#o#+l++l+#o#oo#...',
  '...##d#o#+l++l+#o#d##...',
  '..#dd#o#+#l++l#+#o#dd#..',
  '..#dd#o#o#l##l#o#o#dd#..',
  '..#ld##ol#.##.#lo##dl#..',
  '..####.#ol#..#lo#.####..',
  '.......#lL#..#Ll#.......',
  '.......####..####.......',
];

/** Going away: crest and ears far, dark haunches, a tail hanging off-centre between the hocks. */
const BACK = [
  '.........#....#.........',
  '......#..#o##o#..#......',
  '......##.#o++o#.##......',
  '.....#o+##o++o##+o#.....',
  '.....#oo#oooooo#oo#.....',
  '....#o#oooooooooo#o#....',
  '....#oo#oo+oo+oo#oo#....',
  '...#oo#oooo++oooo#oo#...',
  '...#o#ooooo++ooooo#o#...',
  '...#oo#oooo++oooo#oo#...',
  '...#o#ooooo++ooooo#o#...',
  '...#oo#oooo++oooo#oo#...',
  '...#o#ooooo++ooooo#o#...',
  '..#oo#ooooo++ooooo#oo#..',
  '..#dd#oooooooooooo#dd#..',
  '.#ddd#oooooooooooo#ddd#.',
  '.#dddd#oooooooooo#dddd#.',
  '.#dddd#oo##oooooo#dddd#.',
  '..#ddd#o#+o##oooo#ddd#..',
  '..#ddd#o#+o#.##oo#ddd#..',
  '...#dd###+d#..####dd#...',
  '...#dd#.#+d#.....#dd#...',
  '...#dd#.#od#.....#dd#...',
  '...#dd#.#lL#.....#dd#...',
  '...#ld#.#Ll#.....#dl#...',
  '...#lL#..##......#Ll#...',
  '...####..........####...',
];

/** Wolves get a wider frame than people: the reference animal is 38 px nose to tail. */
export const WOLF_FRAME_W = 44;
const F = CH_FEET;

/** Perceived brightness of a #rrggbb colour, 0..1. */
function luma(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

type Grid = string[];

interface Band { x0: number; x1: number; dx: number; lift: number }

/**
 * Step legs: every band is cleared below `fromRow` first and then pasted
 * back shifted, so one leg moving never erases its neighbour. Rows from
 * `kneeRow` down take the full swing, the thigh rows above take half.
 */
function stepLegs(grid: Grid, bands: Band[], fromRow: number, kneeRow = fromRow): Grid {
  const out = grid.map((r) => r.split(''));
  const h = grid.length, w = grid[0].length;
  for (const b of bands) for (let y = fromRow; y < h; y++) for (let x = b.x0; x < b.x1; x++) out[y][x] = '.';
  for (const b of bands) {
    for (let y = fromRow; y < h; y++) {
      const dx = y >= kneeRow ? b.dx : Math.round(b.dx / 2);
      for (let x = b.x0; x < b.x1; x++) {
        const c = grid[y][x];
        if (c === '.') continue;
        const nx = x + dx, ny = y - b.lift;
        if (nx < 0 || nx >= w || ny < 0) continue;
        out[ny][nx] = c;
      }
    }
  }
  return out.map((r) => r.join(''));
}

function replaceChar(grid: Grid, from: string, to: string): Grid {
  return grid.map((r) => r.split(from).join(to));
}

/** Leg bands of the side pose: [x0, x1) — hind near, hind far, fore near, fore far. */
const SIDE_LEGS: Array<[number, number]> = [[5, 11], [11, 18], [18, 24], [24, 31]];
/** Front: fore left, fore right, hind left, hind right. Back: hind left, hind right. */
const FRONT_LEGS: Array<[number, number]> = [[7, 11], [13, 17], [2, 6], [18, 22]];
const BACK_LEGS: Array<[number, number]> = [[3, 7], [17, 21]];

/** Trot phase: swing of the first diagonal pair, which pair is lifted, and the body's hop. */
function trot(t: number): { swing: number; liftA: number; liftB: number; bob: number } {
  const k = Math.round(t * 6) % 6;
  return {
    swing: [0, 2, 2, 0, -2, -2][k],
    liftA: k === 1 || k === 2 ? 1 : 0,
    liftB: k === 4 || k === 5 ? 1 : 0,
    bob: k === 1 || k === 4 ? -1 : 0,
  };
}

function sideWalk(t: number): { grid: Grid; bob: number } {
  const { swing, liftA, liftB, bob } = trot(t);
  const band = (i: number, dx: number, lift: number): Band => ({ x0: SIDE_LEGS[i][0], x1: SIDE_LEGS[i][1], dx, lift });
  // hind-near with fore-far, hind-far with fore-near
  const grid = stepLegs(SIDE_STAND, [band(0, swing, liftA), band(3, swing, liftA), band(1, -swing, liftB), band(2, -swing, liftB)], 17, 20);
  return { grid, bob };
}

function frontWalk(base: Grid, t: number): Grid {
  const { liftA, liftB } = trot(t);
  const b = (i: number, lift: number): Band => ({ x0: FRONT_LEGS[i][0], x1: FRONT_LEGS[i][1], dx: 0, lift });
  return stepLegs(base, [b(0, liftA), b(3, liftA), b(1, liftB), b(2, liftB)], 21);
}

function backWalk(base: Grid, t: number): Grid {
  const { liftA, liftB } = trot(t);
  return stepLegs(base, [{ x0: BACK_LEGS[0][0], x1: BACK_LEGS[0][1], dx: 0, lift: liftA }, { x0: BACK_LEGS[1][0], x1: BACK_LEGS[1][1], dx: 0, lift: liftB }], 22);
}

/** Front view with the jaws open: the nose lifts, teeth show under it. */
function frontBite(): Grid {
  const g = FRONT.map((r) => r.split(''));
  // the nose sits on row 15 over columns 11..12; the jaw drops below it
  const rows: Array<[number, string]> = [[16, '#TmmT#'], [17, '#mmmm#'], [18, '#TmmT#'], [19, '.####.']];
  for (const [y, s] of rows) for (let i = 0; i < s.length; i++) if (s[i] !== '.') g[y][9 + i] = s[i];
  return g.map((r) => r.join(''));
}

interface Placed { grid: Grid; dx: number; dy: number }

function sideFrame(pose: CPose): Placed {
  const strike = pose.lunge;
  if (pose.hurt) return { grid: SIDE_BLINK, dx: -2, dy: 0 };
  if (strike < 0) return { grid: SIDE_BITE, dx: -1, dy: 0 };
  if (strike >= 0.95) return { grid: SIDE_BITE, dx: 3, dy: 0 };
  if (strike > 0) return { grid: SIDE_LEAP, dx: Math.round(strike * 3), dy: -1 };
  if (pose.walk) { const w = sideWalk(pose.t); return { grid: w.grid, dx: 0, dy: w.bob }; }
  return { grid: pose.bob < 0 ? SIDE_BLINK : SIDE_STAND, dx: 0, dy: 0 };
}

function frontFrame(pose: CPose): Placed {
  const strike = pose.lunge;
  if (pose.hurt) return { grid: replaceChar(FRONT, 'W', 'd'), dx: 0, dy: -1 };
  if (strike < 0) return { grid: frontBite(), dx: 0, dy: 1 };
  if (strike > 0) return { grid: frontBite(), dx: 0, dy: Math.round(strike * 3) };
  if (pose.walk) return { grid: frontWalk(FRONT, pose.t), dx: 0, dy: trot(pose.t).bob };
  return { grid: pose.bob < 0 ? replaceChar(FRONT, 'W', 'd') : FRONT, dx: 0, dy: 0 };
}

function backFrame(pose: CPose): Placed {
  const strike = pose.lunge;
  if (pose.hurt) return { grid: BACK, dx: 0, dy: 1 };
  if (strike > 0) return { grid: BACK, dx: 0, dy: -Math.round(strike * 3) };
  if (strike < 0) return { grid: BACK, dx: 0, dy: 1 };
  if (pose.walk) return { grid: backWalk(BACK, pose.t), dx: 0, dy: trot(pose.t).bob };
  return { grid: BACK, dx: 0, dy: 0 };
}

export function drawWolfFrame(s: CreatureStyle, dir: 'down' | 'up' | 'right', pose: CPose, tier: number): Px {
  const p = new Px(WOLF_FRAME_W, CH_H);
  const coat = s.primary;
  const pale = s.accent;
  const ink = mix('#2f2f2e', shade(s.secondary, 0.6), 0.25);
  const bone = mix(pale, PAL.bone, 0.6);
  const glow = s.glow ?? s.eye;
  const eye = tier >= 3 ? mix(s.eye, PAL.white, 0.35) : s.eye;
  // a pale coat (frost, rime) would swallow its pale points: darken them instead
  const lowContrast = Math.abs(luma(pale) - luma(coat)) < 0.22;
  const point = lowContrast ? shade(s.secondary, 0.8) : pale;
  const colour: Record<string, string> = {
    '#': ink,
    o: coat,
    // a near-black coat needs a stronger lit tone or its ruff and haunches vanish
    '+': mix(coat, pale, luma(coat) < 0.2 ? 0.5 : 0.3),
    d: shade(coat, 0.72),
    l: point,
    L: lowContrast ? s.secondary : mix(pale, PAL.white, 0.5),
    W: eye,
    T: PAL.white,
    n: PAL.ink,
    m: '#3a0f14',
  };

  const { grid, dx, dy } = dir === 'right' ? sideFrame(pose) : dir === 'down' ? frontFrame(pose) : backFrame(pose);
  const w = grid[0].length, h = grid.length;
  // side: the body's middle sits on the frame's middle; front and back are symmetric
  const x0 = (dir === 'right' ? 2 : Math.round((WOLF_FRAME_W - w) / 2)) + dx;
  const y0 = F - h + 1 + dy;

  p.ellipse(WOLF_FRAME_W / 2, F + 1, dir === 'right' ? 15 : 10, 2.5, 'rgba(10,8,16,0.32)');
  for (let y = 0; y < h; y++) {
    const row = grid[y];
    for (let x = 0; x < w; x++) {
      const c = row[x];
      if (c === '.') continue;
      let col = colour[c];
      if (!col) continue;
      // later wolves: the tips of the crest turn to bone
      if (tier >= 2 && dir === 'right' && y < 7 && c === '+' && (y === 0 || grid[y - 1][x] === '.' || grid[y - 1][x] === '#')) col = bone;
      p.set(x0 + x, y0 + y, col);
    }
  }
  if (tier >= 2 && dir === 'right') {
    // bone spurs standing out of the crest line
    for (let x = 18; x < 34; x += 3) {
      let top = -1;
      for (let y = 0; y < 7; y++) if (grid[y][x] !== '.') { top = y; break; }
      if (top < 1) continue;
      p.set(x0 + x, y0 + top - 1, bone);
      if (x % 2 === 0) p.set(x0 + x, y0 + top - 2, shade(bone, 1.12));
    }
  }
  // an old scar: pale on a dark coat, dark on a pale one
  const scar = luma(coat) > 0.5 ? shade(coat, 0.7) : pale;
  if (dir === 'right' && !pose.hurt) {
    if (tier >= 1) {
      p.set(x0 + 9, y0 + 12, scar); p.set(x0 + 10, y0 + 13, scar); p.set(x0 + 11, y0 + 14, scar);
    }
    if (tier >= 3) {
      const v = withAlpha(glow, 0.9);
      for (const [vx, vy] of [[7, 15], [8, 16], [9, 15], [13, 14], [14, 15], [15, 14]]) p.set(x0 + vx, y0 + vy, v);
    }
  }
  if (dir === 'down' && tier >= 1 && !pose.hurt) {
    p.set(x0 + 6, y0 + 12, scar); p.set(x0 + 7, y0 + 13, scar);
    if (tier >= 3) for (const [vx, vy] of [[5, 12], [5, 13], [18, 12], [18, 13]]) p.set(x0 + vx, y0 + vy, withAlpha(glow, 0.9));
  }
  if (dir === 'up' && tier >= 3) for (let i = 0; i < 4; i++) p.set(x0 + 11 + (i % 2), y0 + 7 + i * 2, withAlpha(glow, 0.9));
  return p;
}
