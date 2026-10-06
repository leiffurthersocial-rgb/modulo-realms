#!/usr/bin/env node
/*
 * Profile picture and banner from the game's own UI art (crest, logo), drawn
 * pixel-exact with nearest-neighbour. Needs the dev server.
 *
 *   node marketing/brand.mjs <dir>   → <dir>/avatar.png (1080²), <dir>/banner.png (2560x1440, YouTube-safe centre)
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => !!window.game, null, { timeout: 30000 });
const out = await page.evaluate(async () => {
  const { uiSpriteUrl } = await import('/src/game/art/uiArt.ts');
  const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  const crest = await load(uiSpriteUrl('crest'));
  const logo = await load(uiSpriteUrl('logo'));
  const BG = '#0d0b12';
  const draw = (w, h, paint) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = BG; g.fillRect(0, 0, w, h);
    paint(g);
    return c.toDataURL('image/png');
  };
  const fit = (img, maxW, maxH) => Math.max(1, Math.floor(Math.min(maxW / img.width, maxH / img.height)));
  const avatar = draw(1080, 1080, (g) => {
    const k = fit(crest, 760, 760);
    g.drawImage(crest, (1080 - crest.width * k) / 2, (1080 - crest.height * k) / 2, crest.width * k, crest.height * k);
  });
  const banner = draw(2560, 1440, (g) => {
    // YouTube shows the middle 1546x423 everywhere
    const k = fit(logo, 1300, 300);
    g.drawImage(logo, (2560 - logo.width * k) / 2, (1440 - logo.height * k) / 2, logo.width * k, logo.height * k);
  });
  return { avatar, banner, sizes: [crest.width, crest.height, logo.width, logo.height] };
});
for (const k of ['avatar', 'banner']) writeFileSync(join(dir, `${k}.png`), Buffer.from(out[k].split(',')[1], 'base64'));
console.log('brand →', dir, out.sizes);
await browser.close();
