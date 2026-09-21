import { Px } from './pixel';
import type { CreatureStyle } from './creatures';

export type MythCreatureKind = `myth_${string}`;
type Pose = { t: number; walk: boolean; lunge: number; hurt: boolean; bob: number };

/** Greek-only silhouettes, authored independently of the original bestiary.
 * Boss frames have room for anatomy and equipment instead of enlarging trash. */
export function drawMythCreature(style: CreatureStyle, dir: 'down' | 'up' | 'right', pose: Pose): Px {
  const boss = style.kind.startsWith('myth_boss_');
  const slug = style.kind.replace(boss ? 'myth_boss_' : 'myth_', '');
  const p = new Px(boss ? 64 : 48, boss ? 64 : 56);
  const x = p.w / 2, floor = p.h - 4, body = floor - (boss ? 20 : 17), head = body - 15;
  let primary = style.primary, dark = style.secondary, bright = style.accent;
  const bone = '#ecdfb9', gold = '#f0c66b', red = '#9e323f', ink = '#222938';
  const eye = style.eye, bob = pose.bob, step = pose.walk ? Math.sin(pose.t * Math.PI * 2) * 3 : 0;
  const facing = dir === 'right' ? 1 : 0, thrust = pose.lunge * 4;
  const side = dir === 'up' ? -1 : 1;
  const line = (ax: number, ay: number, bx: number, by: number, color = bright) => p.line(ax, ay, bx, by, color);
  p.ellipse(x, floor + 1, boss ? 23 : 17, 3, 'rgba(9,14,24,.3)');
  const eyes = (cx: number, cy: number, count = 2) => {
    if (dir === 'up') return;
    if (count === 1) p.ellipse(cx, cy, 3, 2, eye);
    else { p.fill(cx - 4 + facing * 2, cy, 2, 2, eye); p.fill(cx + 2 + facing * 2, cy, 2, 2, eye); }
  };
  const horns = (cx: number, cy: number, antlers = false) => {
    for (const sign of [-1, 1]) {
      p.poly([[cx + sign * 5, cy], [cx + sign * 12, cy - 8], [cx + sign * 10, cy + 3]], bright);
      if (antlers) { line(cx + sign * 9, cy - 3, cx + sign * 16, cy - 8); line(cx + sign * 11, cy - 6, cx + sign * 8, cy - 13); }
    }
  };
  const wings = (cy: number, feathered = true, broad = boss) => {
    const span = broad ? 28 : 22, flap = Math.sin(pose.t * Math.PI * 2) * 4;
    for (const sign of [-1, 1]) {
      p.poly([[x + sign * 4, cy + 8], [x + sign * span, cy - 13 + flap], [x + sign * (span - 3), cy + 10], [x + sign * 7, cy + 17]], dark);
      for (let i = 0; i < (feathered ? 5 : 3); i++) line(x + sign * 6, cy + 8, x + sign * (span - i * 3), cy - 10 + flap + i * 5, i % 2 ? bright : primary);
    }
  };
  const human = (armor = true, skirt = false, width = 9) => {
    if (skirt) p.poly([[x - width, body + 4], [x + width, body + 4], [x + width + 4, floor - 3], [x - width - 4, floor - 3]], dark);
    else { p.fill(x - 8 - step, body + 9, 5, floor - body - 9, dark); p.fill(x + 3 + step, body + 9, 5, floor - body - 9, dark); }
    p.poly([[x - width, body - 5 + bob], [x + width, body - 5 + bob], [x + width - 2, body + 12], [x - width + 2, body + 12]], primary);
    if (armor) { p.fill(x - width, body - 4, width * 2, 4, bright); p.fill(x - width + 2, body + 7, width * 2 - 4, 3, gold); }
    p.ellipse(x + facing * 2, head + 5 + bob, 7, 8, armor ? primary : '#c79170');
    eyes(x + facing * 2, head + 5 + bob);
    line(x - width, body, x - width - 5, body + 9, primary); line(x + width, body, x + width + 5 + thrust, body + 9, primary);
  };
  const spear = (offset = 15, color = bright) => {
    const xx = x + offset + thrust;
    p.fill(xx, head - 4, 2, floor - head + 4, '#694933');
    p.poly([[xx - 3, head], [xx + 1, head - 11], [xx + 5, head]], color);
  };
  const shield = (radius = 8, color = bright) => {
    p.ellipse(x - 13, body + 5, radius, radius + 3, dark);
    p.ellipse(x - 13, body + 4, radius - 1, radius + 1, color);
    p.ellipse(x - 13, body + 4, radius - 4, radius - 2, primary);
    p.fill(x - 14, body, 2, 8, gold);
  };
  const bow = () => {
    for (let j = 0; j < 10; j++) { const a = -.9 + j * .2; p.fill(x + 13 + Math.cos(a) * 6, body + Math.sin(a) * 14, 2, 2, bright); }
    line(x + 17, body - 11, x + 17, body + 11, bone); line(x + 8, body + 1, x + 24 + thrust, body + 1, bone);
  };
  const crown = (cy = head - 4, color = gold) => {
    p.fill(x - 8, cy + 5, 16, 3, color);
    for (let i = 0; i < 5; i++) p.poly([[x - 8 + i * 4, cy + 5], [x - 7 + i * 4, cy - (i % 2 ? 1 : 3)], [x - 5 + i * 4, cy + 5]], color);
  };
  const horse = (cx = x, golden = false) => {
    p.ellipse(cx, floor - 12, boss ? 19 : 15, 9, primary);
    for (const [dx, rhythm] of [[-11, 1], [-6, -1], [7, -1], [12, 1]]) { p.fill(cx + dx + step * rhythm, floor - 10, 3, 10, dark); p.fill(cx + dx + step * rhythm, floor - 2, 4, 2, golden ? gold : bright); }
    p.poly([[cx + 7, floor - 14], [cx + 9, floor - 32], [cx + 17, floor - 31], [cx + 16, floor - 11]], primary);
    p.ellipse(cx + 13 + thrust, floor - 32, 7, 5, primary);
    p.poly([[cx + 9, floor - 32], [cx + 5, floor - 41], [cx + 13, floor - 35]], dark);
    p.poly([[cx + 12, floor - 35], [cx + 17, floor - 42], [cx + 17, floor - 31]], dark);
    eyes(cx + 14 + thrust, floor - 33);
    line(cx - 12, floor - 15, cx - 20, floor - 7, dark);
  };
  const lion = (mane = true, lean = false) => {
    p.ellipse(x, floor - 13, lean ? 14 : boss ? 22 : 17, lean ? 7 : 10, primary);
    for (const dx of [-13, -7, 7, 13]) { p.fill(x + dx + (dx < 0 ? step : -step), floor - 12, 4, 12, dark); p.fill(x + dx + (dx < 0 ? step : -step), floor - 2, 5, 2, bone); }
    if (mane) p.ellipse(x + 5, floor - 24 + bob, boss ? 16 : 11, boss ? 15 : 11, dark);
    p.ellipse(x + 6 + thrust, floor - 26 + bob, boss ? 10 : 8, boss ? 10 : 8, primary);
    eyes(x + 6 + thrust, floor - 28 + bob);
    p.fill(x + 2 + thrust, floor - 21 + bob, 8, 3, ink); p.fill(x + 3 + thrust, floor - 22 + bob, 2, 4, bone); p.fill(x + 8 + thrust, floor - 22 + bob, 2, 4, bone);
    for (let i = 0; i < 12; i++) p.fill(x - 12 - i, floor - 13 - Math.sin(i * .2 + pose.t * 6) * 6, 2, 2, dark);
  };
  const snake = (heads = 1, dog = false) => {
    for (let i = 0; i < 11; i++) p.ellipse(x - 16 + i * 3, floor - 4 + Math.sin(i + pose.t * 5) * 2, 6, 4, i % 2 ? primary : dark);
    for (let i = 0; i < heads; i++) {
      const dx = (i - (heads - 1) / 2) * (heads > 5 ? 7 : 9), hx = x + dx, hy = head + (i % 2) * 6 + Math.sin(pose.t * 6 + i) * 2;
      for (let thick = -2; thick <= 2; thick++) line(x + dx * .4 + thick, floor - 7, hx + thick, hy + 7, thick < 0 ? dark : primary);
      p.ellipse(hx, hy + 4, dog ? 6 : 5, dog ? 8 : 6, primary); eyes(hx, hy + 2);
      p.fill(hx - 3, hy + 7, 7, 3, ink); p.fill(hx - 2, hy + 7, 1, 4, bone); p.fill(hx + 2, hy + 7, 1, 4, bone);
      if (dog) { p.poly([[hx - 5, hy + 1], [hx - 6, hy - 6], [hx - 1, hy]], dark); p.poly([[hx + 5, hy + 1], [hx + 6, hy - 6], [hx + 1, hy]], dark); }
      else p.poly([[hx - 4, hy], [hx, hy - 7], [hx + 4, hy]], bright);
    }
  };
  const spectral = (ragged = true) => {
    for (let i = 0; i < 22; i++) p.fill(x - 11 + Math.sin(i * .4 + pose.t * 6) * 2, head + 9 + i, 22 - i * .65, 1, i % 3 ? primary : dark);
    p.ellipse(x, head + 7 + bob, 10, 11, dark); eyes(x, head + 5 + bob);
    if (ragged) for (const sign of [-1, 1]) line(x + sign * 7, body, x + sign * 19, body + 8 + step, bright);
  };
  const flame = (cx: number, cy: number, color = '#ee9949') => {
    p.poly([[cx - 5, cy], [cx - 3, cy - 10], [cx, cy - 5], [cx + 2, cy - 16 - Math.sin(pose.t * 6) * 2], [cx + 6, cy - 3]], color);
    p.poly([[cx - 2, cy], [cx + 1, cy - 9], [cx + 3, cy]], '#ffdf88');
  };
  const fins = () => { for (const sign of [-1, 1]) p.poly([[x + sign * 7, body + 4], [x + sign * 23, body - 4], [x + sign * 16, floor - 4], [x + sign * 4, floor - 7]], bright); };
  const chain = (cx: number, cy: number, length = 4) => { for (let i = 0; i < length; i++) p.ellipse(cx + Math.sin(i + pose.t * 4) * 2, cy + i * 5, 3, 4, i % 2 ? bright : dark).ellipse(cx + Math.sin(i + pose.t * 4) * 2, cy + i * 5, 1, 2, ink); };

  if (boss) {
    switch (slug) {
      case 'nemea':
        primary = '#d7ad56'; dark = '#77502e'; lion();
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; line(x + 5 + Math.cos(a) * 12, floor - 25 + Math.sin(a) * 12, x + 5 + Math.cos(a) * 18, floor - 25 + Math.sin(a) * 18, gold); }
        p.line(x - 2, floor - 33, x + 7, floor - 20, bone); break;
      case 'hydra': primary = '#608353'; dark = '#304f43'; snake(7); for (let i = 0; i < 5; i++) p.circle(x - 18 + i * 9, floor - 2, 2, '#b0d864'); break;
      case 'hind': primary = '#e3cf91'; dark = '#98824c'; horse(x - 3, true); horns(x + 9, floor - 36, true); p.circle(x - 11, floor - 18, 3, gold); break;
      case 'boar': primary = '#b7c2c6'; dark = '#526577'; lion(false); horns(x + 7, floor - 19); for (let i = 0; i < 7; i++) p.poly([[x - 19 + i * 5, floor - 22], [x - 17 + i * 5, floor - 33], [x - 14 + i * 5, floor - 20]], dark); break;
      case 'augeas': primary = '#68867a'; dark = '#37483f'; human(true, false, 17); p.ellipse(x, body + 3, 15, 12, '#746653'); for (let i = -1; i <= 1; i++) p.fill(x + i * 7 - 2, body - 1, 4, 13, '#a2b992'); spear(-24, '#96cad0'); p.ellipse(x + 23, body, 7, 10, '#7cc3c7'); break;
      case 'birds': primary = '#b8a267'; dark = '#575c65'; wings(head + 9); p.ellipse(x, body, 10, 16, primary); p.poly([[x - 4, head + 8], [x + 2, head - 5], [x + 13, head + 10]], gold); eyes(x + 2, head + 5, 1); for (const d of [-8, 8]) line(x + d, body + 10, x + d * 2, floor, bright); crown(head - 11); break;
      case 'bull': primary = '#e7ddd0'; dark = '#365d74'; lion(false); horns(x + 7, floor - 33); p.fill(x - 16, floor - 19, 24, 4, '#81c1d0'); flame(x + 13, floor - 19, '#81cbd5'); break;
      case 'mares': primary = '#863945'; dark = '#ded1b3'; horse(x - 3); p.fill(x - 11, body - 16, 18, 20, red); p.circle(x - 3, head - 6, 7, gold); eyes(x - 3, head - 6); spear(-22); chain(x + 21, head, 5); break;
      case 'hippolyta': primary = '#688b92'; dark = '#6b314f'; p.poly([[x - 12, head + 10], [x + 11, head + 10], [x + 23, floor - 1], [x - 21, floor - 3]], dark); human(true, true); crown(); bow(); shield(9, '#dcb17a'); break;
      case 'geryon': primary = '#a96649'; dark = '#503d43'; for (const dx of [-17, 0, 17]) { p.fill(x + dx - 5, body - 8, 10, 26, primary); p.circle(x + dx, head + 4, 7, primary); eyes(x + dx, head + 4); p.fill(x + dx - 3, floor - 8, 5, 8, dark); } spear(26); shield(10); line(x - 22, body, x + 24, body + 7, bone); break;
      case 'hesperides': primary = '#508a63'; dark = '#263e58'; wings(head + 13, false); snake(5); for (const dx of [-17, 0, 17]) p.circle(x + dx, floor - 6, 4, gold); crown(head - 8); break;
      case 'cerberus': primary = '#645774'; dark = '#302637'; lion(); for (const dx of [-15, 1, 17]) { p.ellipse(x + dx, head + 9, 8, 11, primary); eyes(x + dx, head + 8); p.poly([[x + dx - 7, head + 3], [x + dx - 6, head - 7], [x + dx, head + 3]], dark); flame(x + dx, body + 3, '#9085c4'); } chain(x - 20, body, 4); break;
      case 'python': primary = '#9c84b5'; dark = '#4b315e'; snake(); for (let i = 0; i < 5; i++) p.ellipse(x + Math.sin(i + pose.t * 4) * 10, floor - 8 - i * 7, 15 - i * 2, 5, i % 2 ? primary : dark); p.circle(x, head + 2, 6, primary); eyes(x, head + 1); p.fill(x - 14, floor - 4, 28, 2, gold); break;
      case 'medusa': primary = '#5c9a78'; dark = '#294645'; snake(); human(false, true); for (let i = 0; i < 8; i++) { const dx = (i - 3.5) * 4; line(x, head + 1, x + dx, head - 5 - (i % 3) * 3, primary); p.circle(x + dx, head - 5 - (i % 3) * 3, 3, primary); p.set(x + dx, head - 6 - (i % 3) * 3, eye); } bow(); p.ellipse(x - 17, body + 7, 8, 12, '#a3b9b0'); break;
      case 'minotaur': primary = '#815948'; dark = '#462f37'; human(false, false, 16); p.ellipse(x, head + 3, 11, 10, primary); horns(x, head); eyes(x, head + 1); spear(22, '#cfbca0'); p.poly([[x + 21, head - 1], [x + 31, head - 6], [x + 29, head + 8], [x + 21, head + 4]], '#bcb7ad'); p.fill(x - 18, body + 8, 30, 5, '#816d53'); break;
      case 'chimera': primary = '#ae794d'; dark = '#653f46'; lion(); p.ellipse(x - 12, head + 8, 7, 9, '#adaba0'); horns(x - 12, head + 1); eyes(x - 12, head + 7); line(x - 18, floor - 12, x - 24, head, '#60875c'); p.ellipse(x - 24, head, 5, 7, '#60875c'); eyes(x - 24, head); flame(x + 18, floor - 16); break;
      case 'cyclops': primary = '#a57e64'; dark = '#5c4d48'; human(false, false, 17); p.ellipse(x, head + 4, 12, 12, primary); eyes(x, head + 4, 1); p.ellipse(x - 22, body + 3, 9, 12, '#b0a795'); p.fill(x + 21, head + 9, 6, 29, '#746451'); p.ellipse(x + 24, head + 8, 7, 9, '#ad9f87'); break;
      case 'talos': primary = '#be8c4d'; dark = '#4f5149'; human(true, false, 18); crown(head - 5, '#73d3ce'); p.ellipse(x, body + 2, 10, 11, dark).ellipse(x, body + 2, 6, 7, '#faab57'); for (const sign of [-1, 1]) { p.fill(x + sign * 22 - 4, body - 9, 8, 24, primary); flame(x + sign * 22, body + 9); } chain(x + 8, floor - 12, 2); break;
      case 'scylla': primary = '#528396'; dark = '#38495b'; fins(); snake(6, true); p.ellipse(x, body + 7, 13, 13, '#625c81'); p.circle(x, head + 15, 7, '#b1bbc0'); eyes(x, head + 15); break;
      case 'titan': primary = '#8b91a4'; dark = '#404965'; human(false, false, 19); for (const sign of [-1, 1]) { p.fill(x + sign * 20 - 5, body - 10, 10, 26, primary); chain(x + sign * 24, body - 11, 7); } p.poly([[x - 7, head + 2], [x + 2, head - 9], [x, head], [x + 9, head - 3], [x + 2, head + 12]], '#b3e2ef'); break;
      case 'sanctuary_aegis': primary = '#ddd9bb'; dark = '#4c7b89'; human(true); shield(15, '#d7bd78'); spear(22); wings(head + 4, false, false); crown(head - 5); break;
      case 'sanctuary_forge': primary = '#746c66'; dark = '#332e3e'; human(true, false, 17); p.ellipse(x, head + 4, 8, 10, '#bd8a4d'); p.fill(x - 3, head, 6, 8, '#a8d9ed'); spear(-22); p.fill(x - 29, head - 7, 17, 12, '#aca6a2'); for (const dx of [-9, 9]) p.fill(x + dx - 2, body - 2, 4, 16, '#70a5b6'); break;
      case 'sanctuary_names': primary = '#a6c6c1'; dark = '#31454f'; spectral(); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + pose.t * 2; const xx = x + Math.cos(a) * 22, yy = body + Math.sin(a) * 20; p.fill(xx - 3, yy - 5, 6, 10, bone); p.line(xx - 1, yy - 3, xx + 1, yy + 2, dark); } crown(head - 5, '#a0d4d5'); break;
      case 'leonidas': primary = '#c38d47'; dark = '#79303d'; p.poly([[x - 16, head + 8], [x + 13, head + 9], [x + 25, floor], [x - 25, floor]], red); human(true, false, 13); p.fill(x - 9, head - 4, 18, 5, gold); p.poly([[x - 11, head - 4], [x - 4, head - 15], [x + 8, head - 15], [x + 12, head - 4]], red); p.fill(x - 1, head + 1, 3, 13, gold); p.poly([[x - 5, head + 10], [x, head + 17], [x + 6, head + 10]], '#493323'); shield(12, gold); spear(24, '#e8e5cf'); p.poly([[x - 18, body + 9], [x - 13, body - 2], [x - 8, body + 9], [x - 10, body + 9], [x - 13, body + 3], [x - 16, body + 9]], red); break;
      default: {
        // Six champions: each has a silhouette-defining weapon and crest.
        const palette: Record<string, [string, string]> = { champion_spear: ['#be9e63', '#8c3c3e'], champion_shield: ['#8caaa4', '#414e57'], champion_hunt: ['#b16d57', '#4d3743'], champion_volley: ['#7d9c81', '#31454b'], champion_guard: ['#dacba9', '#6d6591'], champion_storm: ['#7aabd1', '#44416f'] };
        [primary, dark] = palette[slug] ?? [primary, dark];
        human(true, slug === 'champion_volley', slug === 'champion_shield' ? 16 : 10);
        if (slug === 'champion_spear') { spear(17); spear(-17); p.fill(x - 9, head - 7, 18, 4, red); }
        else if (slug === 'champion_shield') { shield(16, primary); p.fill(x + 13, head + 8, 8, 27, bright); crown(); }
        else if (slug === 'champion_hunt') { wings(head + 12, false, false); for (const sign of [-1, 1]) p.poly([[x + sign * 13, body], [x + sign * 23, body - 12], [x + sign * 17, body + 7]], bone); horns(x, head, false); }
        else if (slug === 'champion_volley') { bow(); for (const dx of [-11, -7, -3]) line(x + dx, body - 6, x + dx - 3, head - 9, bone); p.poly([[x - 7, head], [x, head - 10], [x + 8, head]], dark); }
        else if (slug === 'champion_guard') { shield(11, '#dadacb'); spear(20); p.poly([[x - 12, head], [x, head - 11], [x + 12, head]], bright); }
        else { crown(head - 8, '#a4e4f1'); spear(17, '#a4e4f1'); for (const dx of [-21, 22]) p.poly([[x + dx, head], [x + dx - 4, body], [x + dx + 3, body - 3], [x + dx, floor]], '#a4d4ed'); }
      }
    }
  } else {
    switch (slug) {
      case 'hound': primary = '#6c725d'; dark = '#343c36'; lion(false, true); p.fill(x - 3, floor - 29, 18, 3, '#d1a66f'); break;
      case 'sacred_boar': primary = '#987258'; dark = '#573d38'; lion(false); horns(x + 7, floor - 20); p.fill(x - 12, floor - 25, 19, 3, '#a8a199'); break;
      case 'stag': primary = '#937a56'; horse(x - 2); horns(x + 10, floor - 35, true); break;
      case 'satyr': case 'piper': case 'torch_dancer':
        human(false); horns(x, head + 1); p.fill(x - 9, floor - 8, 6, 8, dark); p.fill(x + 4, floor - 8, 6, 8, dark);
        if (slug === 'piper') { for (let i = 0; i < 5; i++) p.fill(x - 6 + i * 3, head + 13, 2, 8 + i * 2, gold); }
        else if (slug === 'torch_dancer') { flame(x - 18, body + 4); flame(x + 18, body + 4); }
        else { line(x + 15, body + 9, x + 19, body - 4, bone); p.ellipse(x - 15, body + 4, 5, 7, '#864748'); } break;
      case 'centaur': case 'centaur_bow': case 'centaur_elder':
        horse(x - 3); p.fill(x - 5, body - 12, 13, 18, primary); p.circle(x + 1, head - 6, 6, '#bc9679'); eyes(x + 1, head - 6);
        if (slug === 'centaur_bow') bow(); else if (slug === 'centaur_elder') { p.ellipse(x - 16, body + 4, 7, 10, '#abb2aa'); p.fill(x - 4, head - 3, 9, 9, bone); } else spear(17); break;
      case 'harpy': case 'storm_harpy': case 'bronze_harpy': case 'gryphon': case 'erinys': case 'kere':
        wings(head + 11);
        if (slug === 'gryphon') { lion(false); p.poly([[x + 10, floor - 29], [x + 22, floor - 24], [x + 11, floor - 21]], gold); }
        else { human(slug === 'bronze_harpy', true, 6); for (const sign of [-1, 1]) line(x + sign * 6, floor - 9, x + sign * 12, floor, bone); }
        if (slug === 'storm_harpy') { crown(head - 6, '#aedcef'); p.fill(x - 2, body, 4, 13, '#d7eaf7'); }
        if (slug === 'bronze_harpy') for (const sign of [-1, 1]) for (let i = 0; i < 3; i++) p.poly([[x + sign * 12, body - 6 + i * 4], [x + sign * 23, body - 13 + i * 4], [x + sign * 17, body + i * 4]], gold);
        if (slug === 'erinys') { chain(x - 17, body - 3, 4); p.poly([[x + 14, body - 8], [x + 22, body - 8], [x + 18, body + 7]], bone); }
        if (slug === 'kere') { p.fill(x + 14, head, 2, 37, dark); p.poly([[x + 14, head], [x + 22, head + 3], [x + 17, head + 10]], bone); } break;
      case 'drakon': case 'constrictor': case 'viper': case 'serpent': case 'sea_serpent': case 'hydra_head': case 'scylla_head':
        if (slug === 'drakon') { wings(body - 4, false); snake(2); }
        else snake(slug === 'sea_serpent' ? 3 : 1, slug === 'scylla_head');
        if (slug === 'constrictor') for (let i = 0; i < 3; i++) p.ellipse(x, floor - 5 - i * 5, 17 - i * 3, 5, i % 2 ? dark : primary);
        if (slug === 'viper') p.poly([[x - 8, head + 5], [x, head - 4], [x + 8, head + 5]], '#b4a353');
        if (slug === 'serpent') fins();
        if (slug === 'hydra_head') p.fill(x - 7, floor - 5, 14, 5, '#ad594e'); break;
      case 'talos_shard': case 'automaton': case 'furnace_guardian': case 'bronze_bull':
        if (slug === 'bronze_bull') { lion(false); horns(x + 5, floor - 32); flame(x - 8, floor - 14); }
        else { human(true, false, slug === 'furnace_guardian' ? 13 : 9); p.ellipse(x, body + 3, 5, 6, '#263847'); p.circle(x, body + 3, 3, '#96dce2'); if (slug === 'automaton') { shield(); spear(); } else if (slug === 'furnace_guardian') { flame(x - 16, body + 9); flame(x + 16, body + 9); } else { p.poly([[x - 8, head], [x - 5, head - 8], [x + 4, head]], gold); p.fill(x + 14, body - 3, 7, 15, primary); } } break;
      case 'hoplite': case 'spartoi': case 'myrmidon': case 'maenad': case 'amazon_archer':
        if (slug === 'spartoi') { primary = bone; dark = '#666459'; }
        if (slug === 'myrmidon') { primary = '#5d554a'; dark = '#2a303b'; }
        if (slug === 'maenad') { primary = '#a7596c'; dark = '#53324c'; }
        if (slug === 'amazon_archer') { primary = '#8ba58b'; dark = '#463d54'; }
        human(slug !== 'maenad' && slug !== 'amazon_archer', slug === 'maenad');
        if (slug === 'amazon_archer') { bow(); p.poly([[x - 9, head], [x + 6, head - 3], [x + 14, head + 4]], dark); }
        else if (slug === 'maenad') { for (const sign of [-1, 1]) p.poly([[x + sign * 13, body + 4], [x + sign * 20, body - 6], [x + sign * 16, body + 10]], bone); crown(head - 2, '#708259'); }
        else { spear(); if (slug !== 'spartoi') shield(); }
        if (slug === 'spartoi') for (let i = 0; i < 4; i++) p.fill(x - 5, body - 1 + i * 3, 10, 1, dark);
        if (slug === 'myrmidon') { for (const sign of [-1, 1]) { line(x + sign * 4, head, x + sign * 8, head - 9, dark); line(x + sign * 5, body + 5, x + sign * 15, body + 13, primary); } } break;
      case 'oath_shade': case 'burial_priest': case 'eidolon': case 'anemoi':
        spectral();
        if (slug === 'oath_shade') { spear(); p.fill(x - 8, head - 1, 16, 3, gold); }
        if (slug === 'burial_priest') { p.poly([[x - 10, head + 4], [x, head - 10], [x + 10, head + 4]], bone); p.fill(x - 18, body, 9, 12, bone); }
        if (slug === 'eidolon') { p.poly([[x - 13, head + 7], [x, head - 8], [x + 13, head + 7], [x, body + 6]], '#83adb8'); eyes(x, head + 6); for (const sign of [-1, 1]) line(x + sign * 16, body - 4, x + sign * 12, floor - 4, '#d4e9e0'); }
        if (slug === 'anemoi') for (let i = 0; i < 5; i++) p.ellipse(x + Math.sin(pose.t * 6 + i) * 3, body - 3 + i * 4, 18 - i * 2, 2, i % 2 ? '#d4e6dd' : '#7aaebe'); break;
      case 'empousa': human(false, true); p.fill(x - 8, floor - 12, 5, 12, gold); p.fill(x + 4, floor - 10, 5, 10, '#61535b'); flame(x, head + 2, '#bb6ea0'); eyes(x, head + 5); break;
      case 'jailer': human(true, false, 13); p.fill(x - 9, head - 1, 18, 3, ink); chain(x - 18, body - 7, 6); p.fill(x + 14, body - 7, 7, 18, bright); break;
      case 'crab':
        for (const sign of [-1, 1]) { for (let i = 0; i < 4; i++) line(x + sign * 8, floor - 11, x + sign * (20 - i * 2), floor - i * 3, dark); p.ellipse(x + sign * 17, body + 1, 6, 8, primary); p.poly([[x + sign * 15, body], [x + sign * 19, body - 11], [x + sign * 22, body - 2]], bright); }
        p.ellipse(x, floor - 11, 14, 10, primary); eyes(x, floor - 17); break;
      case 'siren': case 'nereid': case 'lamia':
        primary = slug === 'lamia' ? '#789a79' : '#83b8bd'; dark = slug === 'siren' ? '#4d698b' : '#356963';
        snake(); human(false, true, 6);
        if (slug === 'siren') { wings(head + 10, true, false); p.ellipse(x - 14, body, 5, 8, gold); line(x - 17, body - 6, x - 17, body + 5, bone); }
        if (slug === 'nereid') { crown(head - 2, '#dde6c1'); fins(); spear(17, '#c3dce2'); }
        if (slug === 'lamia') { p.poly([[x - 8, head + 2], [x - 2, head - 9], [x + 8, head + 2]], '#a28366'); eyes(x, head + 4); } break;
      case 'ketos': p.ellipse(x, floor - 15, 21, 14, primary); fins(); p.poly([[x - 4, floor - 26], [x + 4, head - 5], [x + 11, floor - 23]], bright); p.fill(x + 3, floor - 14, 17, 5, ink); for (let i = 0; i < 5; i++) p.fill(x + 3 + i * 3, floor - 14, 1, 4, bone); eyes(x + 5, floor - 25); break;
      case 'octopus': case 'charybdis_spawn':
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const xx = x + Math.cos(a) * 20, yy = body + 7 + Math.sin(a + pose.t * 5) * 12; line(x, body + 7, xx, yy, dark); line(x + 1, body + 7, xx + 1, yy, bright); p.circle(xx, yy, 3, primary); }
        if (slug === 'octopus') { p.ellipse(x, body - 2, 11, 15, primary); eyes(x, body + 3); }
        else { p.ellipse(x, body + 5, 17, 15, primary).ellipse(x, body + 5, 12, 11, ink); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; p.poly([[x + Math.cos(a) * 13, body + 5 + Math.sin(a) * 11], [x + Math.cos(a) * 7, body + 5 + Math.sin(a) * 6], [x + Math.cos(a + .35) * 13, body + 5 + Math.sin(a + .35) * 11]], bone); } } break;
      case 'dryad': primary = '#798455'; dark = '#414e3c'; human(false, true, 7); for (const sign of [-1, 1]) { line(x + sign * 5, head, x + sign * 15, head - 7, dark); p.ellipse(x + sign * 13, head - 7, 7, 4, '#94aa69'); line(x + sign * 6, floor - 9, x + sign * 18, floor, dark); } crown(head - 6, '#869954'); break;
      case 'telchine': primary = '#70939b'; dark = '#374e5c'; human(true, false, 8); fins(); p.ellipse(x, head + 6, 8, 6, primary); p.fill(x + 14, body - 8, 3, 24, '#765e46'); p.fill(x + 9, body - 9, 13, 7, gold); break;
      case 'hippocampus': case 'ichthyocentaur':
        primary = '#72a6b1'; dark = '#356374'; horse(x - 2); fins();
        if (slug === 'ichthyocentaur') { p.fill(x - 6, body - 14, 13, 20, primary); p.circle(x, head - 5, 6, '#c0cfc2'); spear(17, '#c3dce2'); line(x + 12, head - 4, x + 12, head - 11, bright); line(x + 21, head - 4, x + 21, head - 11, bright); }
        else p.fill(x + 10, head - 7, 3, 8, bone); break;
      case 'graeae': primary = '#b5b19c'; dark = '#625767'; spectral(false); for (const dx of [-10, 0, 10]) { p.circle(x + dx, head + 6 + Math.abs(dx) / 2, 5, primary); if (dx === 0) p.circle(x + dx, head + 6, 2, '#d9f0ea'); } p.fill(x - 19, body - 5, 2, 26, dark); p.circle(x - 18, body - 8, 4, gold); break;
      case 'arachne':
        for (let i = 0; i < 4; i++) for (const sign of [-1, 1]) { line(x + sign * 5, body + 9, x + sign * 18, body + i * 3, dark); line(x + sign * 18, body + i * 3, x + sign * 22, floor - i * 2, bright); }
        p.ellipse(x, floor - 10, 13, 10, '#745d7a'); p.fill(x - 5, body - 8, 10, 17, '#aaa192'); p.circle(x, head + 7, 6, '#bdb4a6'); eyes(x, head + 7); p.fill(x - 2, floor - 14, 4, 9, '#d5c6aa'); break;
      case 'sphinx': primary = '#c9b084'; dark = '#496e8d'; wings(head + 15); lion(false); p.ellipse(x + 4, head + 7, 8, 10, '#d4af7d'); eyes(x + 4, head + 7); p.fill(x - 6, head - 2, 19, 4, gold); for (const sign of [-1, 1]) p.fill(x + sign * 10, head + 2, 3, 21, dark); break;
      case 'manticore': primary = '#ab6754'; dark = '#633548'; lion(); for (let i = 0; i < 7; i++) p.circle(x - 18 + Math.sin(i * .6) * 7, floor - 15 - i * 4, 3, dark); p.poly([[x - 24, head - 2], [x - 15, head + 3], [x - 21, head + 7]], bone); eyes(x + 6, floor - 27); break;
      case 'laestrygonian': primary = '#a79176'; dark = '#695950'; human(false, false, 14); p.ellipse(x - 16, body + 4, 8, 11, '#879285'); p.ellipse(x + 1, head + 5, 9, 9, primary); eyes(x + 1, head + 4); p.fill(x - 5, head + 12, 12, 4, ink); break;
      case 'man_eating_mare': primary = '#c4c0aa'; dark = '#5f3f46'; horse(); for (let i = 0; i < 4; i++) line(x - 8 + i * 4, floor - 18, x - 8 + i * 4, floor - 10, dark); p.fill(x + 11, floor - 30, 10, 4, red); p.fill(x + 13, floor - 30, 2, 5, bone); break;
      default: human(); spear(); shield();
    }
  }
  if (dir === 'up') p.fill(x - 2, body - 5, 4, 9, dark);
  if (pose.hurt) p.fill(x - 2, head + 5, 4, 2, '#fff4d6');
  // Directional feet and asymmetric weapons make facing readable in every row.
  p.fill(x + side * 4 + facing * 7, floor - 1, 3, 1, bright);
  p.outline('rgba(12,9,18,.82)');
  return p;
}
