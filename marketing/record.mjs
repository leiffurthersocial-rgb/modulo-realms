#!/usr/bin/env node
/*
 * Records a gameplay clip for social media: the world canvas only (no HUD),
 * portrait, with the game's own sound, driven by a scene script and an
 * autopilot that fights. Needs the dev server (`npm run dev`), because the
 * scenes use the DEV-only hooks on `window.game`.
 *
 *   node marketing/record.mjs <scene> <out.webm> [seconds] [--url http://localhost:5173] [--still]
 *   (--still writes a PNG of the set-up scene instead, for framing)
 *
 * Scenes live in marketing/scenes.mjs. Output is VP9 + Opus WebM at the
 * canvas's own resolution (540x960); marketing/edit.mjs scales it 2x with
 * nearest-neighbour to 1080x1920 and adds the captions.
 */
import { chromium } from 'playwright';
import { openSync, writeSync, closeSync } from 'node:fs';
import { SCENES } from './scenes.mjs';

const [sceneName, out, secondsArg] = process.argv.slice(2);
const urlFlag = process.argv.indexOf('--url');
const url = urlFlag > 0 ? process.argv[urlFlag + 1] : 'http://localhost:5173/';
const scene = SCENES[sceneName];
if (!scene || !out) {
  console.error(`usage: node marketing/record.mjs <${Object.keys(SCENES).join('|')}> <out.webm> [seconds]`);
  process.exit(1);
}
const seconds = Number(secondsArg) || scene.seconds || 20;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
});
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const fd = openSync(out, 'w');
await page.exposeFunction('__saveChunk', (b64) => { writeSync(fd, Buffer.from(b64, 'base64')); });

await page.goto(url);
await page.waitForFunction(() => !!window.game, null, { timeout: 30000 });
await page.waitForTimeout(1500);
// A new character, past the prologue and the training.
await page.getByText('New Game').click();
await page.waitForTimeout(500);
if (scene.name) await page.locator('.name-input').fill(scene.name);
await page.getByText('Begin the journey').click();
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.game;
  g.storyCards.length = 0;
  g.training?.complete(true);
  g.storyCards.length = 0;
  g.toasts.length = 0;
  g.closeAll();
});

await page.evaluate(scene.setup, scene.args ?? {});
// Close on the hero, and nothing pointing anywhere: this is a clip, not a quest.
await page.evaluate((zoom) => {
  const g = window.game;
  g.camera.zoom = zoom;
  g.trackedQuest = null;
  g.toasts.length = 0;
}, scene.zoom ?? 3);
await page.waitForTimeout(scene.settle ?? 1500);
if (process.argv.includes('--still')) {
  await page.evaluate(() => { for (const el of document.querySelectorAll('.overlay')) el.style.display = 'none'; });
  await page.locator('canvas').first().screenshot({ path: out });
  await browser.close();
  console.log(`still ${sceneName} → ${out}`);
  process.exit(0);
}

// Autopilot and recorder, both inside the page.
await page.evaluate(async ({ seconds, pilot }) => {
  const g = window.game;
  const { audio } = await import('/src/game/audio/audio.ts');
  audio.resume?.();
  const canvas = document.querySelector('canvas');
  const tracks = [...canvas.captureStream(30).getVideoTracks()];
  if (audio.ctx && audio.master) {
    const dest = audio.ctx.createMediaStreamDestination();
    audio.master.connect(dest);
    tracks.push(...dest.stream.getAudioTracks());
  }
  const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 14_000_000 });
  rec.ondataavailable = async (e) => {
    if (!e.data.size) return;
    const buf = new Uint8Array(await e.data.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    await window.__saveChunk(btoa(s));
  };

  let tick = 0;
  const auto = pilot ? setInterval(() => {
    const p = g.player;
    tick++;
    let best = null, bd = Infinity;
    for (const e of g.enemies) {
      if (e.dead || e.friendly) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best || bd > 700) { g.input.stick = pilot.wander ? { x: Math.cos(tick / 25), y: Math.sin(tick / 40) * 0.6 } : null; g.input.setVirtual('attack', false); return; }
    const dx = best.x - p.x, dy = best.y - p.y, d = Math.hypot(dx, dy) || 1;
    const reach = pilot.reach ?? 46;
    // close in, then keep facing and swinging; step out now and then so it reads as a fight
    const away = tick % 40 > 34;
    const k = d > reach ? 1 : away ? -0.8 : 0.25;
    g.input.stick = { x: (dx / d) * k, y: (dy / d) * k };
    g.input.setVirtual('attack', d < reach + 20 && !away);
    if (tick % 23 === 0) { g.input.setVirtual('slot1', true); setTimeout(() => g.input.setVirtual('slot1', false), 60); }
    if (tick % 37 === 0) { g.input.setVirtual('slot2', true); setTimeout(() => g.input.setVirtual('slot2', false), 60); }
    if (tick % 31 === 0 && pilot.dash) { g.input.setVirtual('dash', true); setTimeout(() => g.input.setVirtual('dash', false), 60); }
  }, 50) : null;

  rec.start(1000);
  await new Promise((r) => setTimeout(r, seconds * 1000));
  if (auto) clearInterval(auto);
  await new Promise((r) => { rec.onstop = r; rec.stop(); });
  await new Promise((r) => setTimeout(r, 500));
}, { seconds, pilot: scene.pilot ?? null });

closeSync(fd);
await browser.close();
if (errors.length) console.error('page errors:', errors.slice(0, 5));
console.log(`recorded ${sceneName} → ${out}`);
