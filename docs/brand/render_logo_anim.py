"""Animated Modulo logo (GIF) in the game's pixel style.
Loop: hold+shine -> crumbles to ash -> clock digits summon the mold -> molten
pour -> quench & cool -> brass (== frame 0, so non-animating clients show the logo)."""
import re, math, random, sys
from PIL import Image

SRC = 'src'
pal_txt = open(f'{SRC}/game/art/palette.ts').read()
PAL = {k: v for k, v in re.findall(r"^\s*(\w+): '(#[0-9a-f]{6})'", pal_txt, re.M)}
gtxt = open(f'{SRC}/ui/kit/glyphs.ts').read()
def glyphmap(name):
    body = gtxt.split(f'export const {name}')[1].split('\n};')[0]
    return {k: re.findall(r"'([.#]+)'", v) for k, v in re.findall(r"^\s*'?(.)'?: \[(.*?)\]", body, re.M)}
BIG, SMALL = glyphmap('MODULO'), glyphmap('SMALL')
C = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in PAL.items()}

N, DELAY = 100, 60

def logo_layers(word, k=4):
    """Port of uiArt.ts logo(): returns metal{(x,y):color}, outline set, shadow set, w, h."""
    gl = [BIG[c] for c in word]; ws = [max(len(r) for r in g) for g in gl]
    gw = sum(w + 1 for w in ws) - 1; pad = 2
    W, H = gw * k + pad * 2, 7 * k + pad * 2 + 2
    metal = {}
    def fill(x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w): metal[(xx, yy)] = c
    gx = 0
    for i, g in enumerate(gl):
        for ry, row in enumerate(g):
            for rx, ch in enumerate(row):
                if ch != '#': continue
                x, y = pad + (gx + rx) * k, pad + ry * k
                above = ry > 0 and rx < len(g[ry - 1]) and g[ry - 1][rx] == '#'
                below = ry < 6 and rx < len(g[ry + 1]) and g[ry + 1][rx] == '#'
                fill(x, y, k, k, 'gold')
                fill(x, y, k, 1, 'goldLit' if above else 'holy')
                if not below: fill(x, y + k - 1, k, 1, 'copper')
                if ry >= 5: fill(x, y + k - 2, k, 2, 'gold' if below else 'copper')
        gx += ws[i] + 1
    outline = {(x + dx, y + dy) for (x, y) in metal for dx in (-1, 0, 1) for dy in (-1, 0, 1)
               if (x + dx, y + dy) not in metal and 0 <= x + dx < W and 0 <= y + dy < H}
    shadow = {(x, y + 2) for (x, y) in metal if (x, y + 2) not in metal and (x, y + 2) not in outline and y + 2 < H}
    return metal, outline, shadow, W, H

CLASS = {'copper': 0, 'gold': 1, 'goldLit': 2, 'holy': 3}
HEAT = [  # per heat level: colour for brass class copper,gold,goldLit,holy
    ['copper', 'gold', 'goldLit', 'holy'],
    ['ember', 'gold', 'goldLit', 'holy'],
    ['ember', 'copper', 'flame', 'flameLit'],
    ['emberDark', 'ember', 'flame', 'flameLit'],
    ['ember', 'flame', 'flameLit', 'holy'],
]
ASHC = ['stone', 'ash', 'fog', 'fog']

def h01(*a):
    """Deterministic hash -> [0,1)."""
    x = 0
    for v in a: x = (x * 1000003 ^ (int(v) * 2654435761)) & 0xffffffff
    x ^= x >> 13; x = (x * 0x5bd1e995) & 0xffffffff; x ^= x >> 15
    return (x & 0xffffff) / 0x1000000

def small_text_cells(text):
    """Cells of a 3x5 string; returns list of (index, [(x,y)...]) per char, total width."""
    out, x, idx = [], 0, 0
    for ch in text:
        if ch == ' ': x += 3; continue
        g = SMALL[ch]; cells = [(x + cx, cy) for cy, row in enumerate(g) for cx, c in enumerate(row) if c == '#']
        out.append((idx, cells)); idx += 1; x += len(g[0]) + 1
    return out, x - 1

RUNE_WARM = ['', 'stone', 'copper', 'gold', 'goldLit', 'holy']
RUNE_ARCANE = ['', 'arcaneDark', 'arcane', 'arcaneLit', 'arcaneLit', 'white']

def render(word, CW, CH, ox, oy, runes, halo, scale, path, hsweep, scheme=RUNE_WARM, ring=None):
    metal, outline, shadow, LW, LH = logo_layers(word)
    xs = [x for x, _ in metal]; ys = [y for _, y in metal]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    nr = len(runes)
    # pour order: bottom-up with a horizontal sweep
    A, B = 1 - hsweep, hsweep
    tf = {p: (A * (y1 - p[1]) / (y1 - y0) + B * (p[0] - x0) / (x1 - x0)) for p in metal}
    # crumble order: top first, ragged
    tcr = {p: 0.62 * (p[1] - y0 + 2) / (y1 - y0 + 4) + 0.3 * h01(p[0], p[1], 7) for p in set(metal) | outline | shadow}
    rng = random.Random(1337)
    embers = [(rng.uniform(2, CW - 3), rng.random(), rng.choice((1, 1, 2)), rng.random()) for _ in range(max(10, CW // 5))]
    top = sorted(metal, key=lambda p: (p[1], p[0]))
    sparks = []
    for _ in range(30 if CW > 80 else 24):
        sx, sy = rng.choice([p for p in metal if p[1] < y0 + 6])
        ang = rng.uniform(-math.pi * 0.95, -math.pi * 0.05); sp = rng.uniform(0.9, 2.3)
        sparks.append((sx, sy, math.cos(ang) * sp, math.sin(ang) * sp, rng.randint(7, 13)))
    steam = [(rng.choice([p for p in metal if p[1] < y0 + 8]), 84 + rng.randint(0, 8), rng.randint(10, 14)) for _ in range(7 if CW < 80 else 12)]
    glint_at = min(metal, key=lambda p: (p[1], p[0])) if CW < 80 else min(metal, key=lambda p: (p[1], -p[0]))

    frames = []
    for f in range(N):
        img = Image.new('RGB', (CW, CH), C['ink']); px = img.load()
        def put(x, y, c):
            x, y = int(round(x)), int(round(y))
            if 0 <= x < CW and 0 <= y < CH: px[x, y] = C[c]
        # --- halo intensity (stepped flat ovals, no gradients)
        flick = 1 if h01(f // 3, 99) > 0.55 else 0
        if f < 30: hi = 2 + flick
        elif f < 50: hi = 2 if f < 40 else (1 if f < 46 else 0)
        elif f < 58: hi = 0
        elif f < 66: hi = 1
        elif f < 72: hi = 2
        elif f < 92: hi = 3
        else: hi = 2 + flick
        cx, cy, rads = halo
        for lvl, (rx, ry), col in zip((1, 2, 3), rads, ('charcoal', 'soilDark', 'emberDark')):
            if hi < lvl: continue
            if lvl == 3 and not (66 <= f < 94): continue  # red core only while metal is molten
            j = 1 if (lvl == 3 and flick) else 0
            rx += j; ry += j
            for y in range(int(cy - ry), int(cy + ry) + 1):
                for x in range(int(cx - rx), int(cx + rx) + 1):
                    if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: put(x, y, col)
        # --- ambient embers rising from below
        for (ex, ph, cyc, wob) in embers:
            t = (f / N * cyc + ph) % 1
            y = CH + 1 - t * (CH + 6); x = ex + round(1.6 * math.sin(2 * math.pi * (t * 2 + wob)))
            col = 'flameLit' if t < .2 else 'flame' if t < .45 else 'ember' if t < .75 else 'emberDark'
            put(x, y, col)
        # --- magic circle: dashed ring turning once per loop, drawn in during the summon
        if ring:
            rcx, rcy, rr = ring
            seg = 2 * math.pi / 20
            rot = 2 * math.pi * f / N
            spot = (2 * math.pi * f / N * 3) % (2 * math.pi)
            for y in range(int(rcy - rr - 1), int(rcy + rr + 2)):
                for x in range(int(rcx - rr - 1), int(rcx + rr + 2)):
                    if abs(math.hypot(x + .5 - rcx, y + .5 - rcy) - rr) >= .5: continue
                    th = math.atan2(x + .5 - rcx, -(y + .5 - rcy)) % (2 * math.pi)
                    if ((th - rot) % seg) > seg * 0.62: continue
                    if f < 30 or f >= 84 or 62 <= f < 84: lvl = 2
                    elif f < 50: lvl = 2 if f < 38 else 1 if f < 46 else 0
                    elif f < 54: lvl = 0
                    else:  # 54..61: the circle is traced clockwise from the top
                        sweep = (f - 54 + 1) / 8 * 2 * math.pi
                        lvl = 0 if th > sweep else 5 if sweep - th < 0.5 else 3 if sweep - th < 1.1 else 2
                    if lvl == 2 and min(abs(th - spot), 2 * math.pi - abs(th - spot)) < 0.35: lvl = 3
                    if f in (94, 95, 96, 97) and lvl: lvl = 3
                    if lvl: put(x, y, scheme[lvl])
        # --- runes (clock digits / subtitle)
        for idx, cells, rx0, ry0 in runes:
            b = 2  # 0 off,1 stone,2 copper,3 gold,4 goldLit,5 holy
            if f < 30:
                k = f // 2
                b = 5 if k == idx else 4 if k - 1 == idx else 3 if k - 2 == idx else 2
            elif f < 50:
                t0 = 32 + (nr - 1 - idx) * (14 / max(1, nr - 1))
                b = 2 if f < t0 else 1 if f < t0 + 2 else 0
            elif f < 54: b = 0
            elif f < 84:
                t0 = 54 + idx * (10 / max(1, nr - 1))
                b = 0 if f < t0 else 5 if f < t0 + 1 else 3 if f < t0 + 3 else 2
            else:
                b = 5 if f in (95, 96) else 4 if f in (94, 97) else 3 if f == 98 else 2
            if b:
                col = scheme[b]
                for (x, y) in cells: put(rx0 + x, ry0 + y, col)
        # --- the logo
        def P(x, y, c): put(ox + x, oy + y, c)
        if f < 30 or f >= 98 or (84 <= f):
            heat = {}
            if 84 <= f < 98:
                for p in metal: heat[p] = max(0, min(4, 4 - int((f - 84 + 2.2 * h01(p[0], p[1], 3)) // 3)))
            hot = max(heat.values()) if heat else 0
            if hot <= 3:
                for p in shadow: P(*p, 'emberDark')
            for p in outline: P(*p, 'void' if hot <= 1 else 'stone')
            for p, col in metal.items(): P(*p, HEAT[heat.get(p, 0)][CLASS[col]])
            if f < 30:  # shine sweep + glint
                if 6 <= f <= 18:
                    smin, smax = x0 + y0 - 4, x1 + y1 + 4
                    bp = smin + (smax - smin) * (f - 6) / 12
                    for p, col in metal.items():
                        d = abs(p[0] + p[1] - bp)
                        if d <= 1.2: P(*p, 'holy')
                        elif d <= 2.6 and CLASS[col] < 2: P(*p, 'goldLit')
                gs = {20: 1, 21: 2, 22: 3, 23: 3, 24: 2, 25: 1}.get(f, 0)
                if gs:
                    gx, gy = glint_at
                    for r in range(1, gs + 1):
                        c = 'holy' if r < gs else 'goldLit'
                        for dx, dy in ((r, 0), (-r, 0), (0, r), (0, -r)): P(gx + dx, gy + dy, c)
                    if gs >= 3:
                        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)): P(gx + dx, gy + dy, 'goldLit')
                    P(gx, gy, 'white')
        elif f < 50:  # crumble to ash
            p_ = (f - 30) / 17
            parts = []
            for p in shadow | outline:
                if p_ < tcr[p]: P(*p, 'emberDark' if p in shadow else 'void')
            for p, col in metal.items():
                t = tcr[p]
                if p_ < t - 0.14: P(*p, col)
                elif p_ < t - 0.06: P(*p, HEAT[2][CLASS[col]])
                elif p_ < t: P(*p, HEAT[4][CLASS[col]] if h01(p[0], p[1], f) > .3 else 'flame')
                else: parts.append((p, col, (p_ - t) * 17))
            for (x, y), col, age in parts:
                spark = h01(x, y, 11) < 0.22
                life = 9 if spark else 12
                if age > life: continue
                dx = math.sin(age * 0.5 + h01(x, y, 5) * 6.28) * (1 + age * 0.15) + (h01(x, y, 2) - .5) * age * 0.5
                dy = -age * (0.8 + h01(x, y, 4) * 0.9) - age * age * 0.03
                if spark: c = 'flameLit' if age < 2 else 'flame' if age < 5 else 'ember'
                else: c = 'fog' if age < 3 else 'ash' if age < 7 else 'stone'
                # thin out the cloud so it reads as flakes, not a sheet
                if spark or h01(x, y, 9) < 0.45: P(x + dx, y + dy, c)
        elif f >= 58:  # mold appears, then the pour
            mi = 0 if f < 60 else 1
            for p in outline: P(*p, 'slate' if mi == 0 else 'stone')
            for p in metal: P(*p, 'void')
            if f >= 64:
                pp = (f - 64) / 19 * 1.04
                filled = [p for p in metal if tf[p] <= pp]
                for p in filled:
                    fresh = pp - tf[p] < 0.07
                    col = metal[p]
                    P(*p, 'holy' if fresh and h01(p[0], p[1], f) > .35 else HEAT[4 if pp - tf[p] < 0.4 else 3][CLASS[col]])
                front = [p for p in metal if abs(tf[p] - pp) < 0.05]
                if front and pp < 1.0:
                    ax = sum(x for x, _ in front) / len(front)
                    tx, ty = min(front, key=lambda p: (abs(p[0] - ax), p[1]))
                    for y in range(-oy, ty):
                        w = round(math.sin(y * 0.7 + f * 1.3) * 0.6)
                        P(tx + w, y, 'flameLit'); P(tx + w + 1, y, 'flame')
                        if h01(y, f, 1) < .12: P(tx + w, y, 'holy')
                    for i in range(4):
                        a = h01(i, f, 21) * math.pi; r = 1 + h01(i, f, 22) * 3
                        P(tx + math.cos(a) * r * 1.4, ty - math.sin(a) * r, 'flameLit' if i % 2 else 'holy')
        # --- quench: sparks + steam
        if 84 <= f < 98:
            for (sx, sy, vx, vy, life) in sparks:
                a = f - 84
                if a > life: continue
                x, y = sx + vx * a, sy + vy * a + 0.12 * a * a
                fr = a / life
                c = 'holy' if fr < .2 else 'flameLit' if fr < .45 else 'flame' if fr < .75 else 'ember'
                P(x, y, c)
                if fr < .35: P(x - vx * .6, y - vy * .6, 'flame')
            for ((sx, sy), t0, life) in steam:
                a = f - t0
                if a < 0 or a > life: continue
                x, y = sx + math.sin(a * .4 + sx) * 1.2, sy - 1 - a * 0.7
                c = 'fog' if a < life * .4 else 'ash' if a < life * .75 else 'stone'
                r = 0 if a < 3 else 1
                for dx in range(-r, r + 1):
                    for dy in range(-r, r + 1):
                        if abs(dx) + abs(dy) <= r: P(x + dx, y + dy, c)
        frames.append(img)
    # exact palette quantisation
    used = sorted({c for im in frames for _, c in im.getcolors(1 << 16)})
    palimg = Image.new('P', (1, 1)); flat = [v for c in used for v in c]; palimg.putpalette(flat + [0] * (768 - len(flat)))
    out = []
    for im in frames:
        q = im.quantize(palette=palimg, dither=Image.Dither.NONE)
        out.append(q.resize((CW * scale, CH * scale), Image.NEAREST))
    out[0].save(path, save_all=True, append_images=out[1:], duration=DELAY, loop=0, optimize=False, disposal=1)
    frames[0].resize((CW * scale, CH * scale), Image.NEAREST).save(path.replace('.gif', '-f0.png'))
    return path

if __name__ == '__main__':
    # avatar: M inside a magic circle, ringed by twelve runes
    RUNES = [
        ['#.#', '##.', '#.#', '#..', '#..'],  # fehu
        ['##.', '#.#', '#.#', '#.#', '#.#'],  # uruz
        ['#..', '##.', '#.#', '##.', '#..'],  # thurisaz
        ['..#', '.#.', '#..', '.#.', '..#'],  # kenaz
        ['#.#', '#.#', '.#.', '#.#', '#.#'],  # gebo
        ['#.#', '###', '#.#', '###', '#.#'],  # hagalaz
        ['.#.', '.#.', '.#.', '.#.', '.#.'],  # isa
        ['.##', '.#.', '.#.', '.#.', '##.'],  # eihwaz
        ['#.#', '###', '.#.', '.#.', '.#.'],  # algiz
        ['..#', '.#.', '###', '.#.', '#..'],  # sowilo
        ['.#.', '###', '#.#', '.#.', '.#.'],  # tiwaz
        ['#.#', '###', '.#.', '###', '#.#'],  # dagaz
    ]
    CW = CH = 64; c = 32
    runes = []
    for i, g in enumerate(RUNES):
        cells = [(cx, cy) for cy, row in enumerate(g) for cx, cc in enumerate(row) if cc == '#']
        a = i / 12 * 2 * math.pi
        runes.append((i, cells, round(c + 26.5 * math.sin(a) - 1.5), round(c - 26.5 * math.cos(a) - 2.5)))
    for sc in (8, 4):
        render('M', CW, CH, 20, 15, runes, (32, 33, [(23, 25), (17, 20), (11, 14)]), sc,
               f'docs/brand/modulo-avatar-anim-{CW*sc}.gif', 0.5, RUNE_ARCANE, (32, 31.5, 21.5))
    # header: MODULO + subtitle
    CW, CH = 160, 52
    cells, w = small_text_cells('REALMS OF ASH')
    sx = (CW - w) // 2
    runes = [(i, cl, sx, 43) for i, cl in cells]
    render('MODULO', CW, CH, 10, 4, runes, (80, 22, [(78, 24), (64, 18), (50, 13)]), 4,
           'docs/brand/modulo-header-anim.gif', 0.7)
    print('ok')
