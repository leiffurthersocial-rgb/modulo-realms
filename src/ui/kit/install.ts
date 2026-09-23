import { installFonts } from './font';
import { installTokens, uiScale } from './tokens';
import { installUiArt } from '../../game/art/uiArt';

/**
 * Boot the UI kit: tokens, generated frames and icons, the pixel fonts, and
 * the integer UI zoom. Runs once before React mounts.
 */

export interface UiMetrics {
  /** Device pixels per UI pixel (a whole number). */
  device: number;
  /** CSS zoom applied to the overlay (device / devicePixelRatio). */
  zoom: number;
  /** Size of the overlay in UI pixels. */
  w: number;
  h: number;
}

let metrics: UiMetrics = { device: 2, zoom: 2, w: 640, h: 360 };
const listeners = new Set<() => void>();

function measure(): void {
  const dpr = window.devicePixelRatio || 1;
  const { device, zoom } = uiScale(window.innerWidth, window.innerHeight, dpr);
  const next = { device, zoom, w: Math.floor(window.innerWidth / zoom), h: Math.floor(window.innerHeight / zoom) };
  if (next.zoom === metrics.zoom && next.w === metrics.w && next.h === metrics.h) return;
  metrics = next;
  const root = document.documentElement.style;
  root.setProperty('--ui-zoom', String(zoom));
  root.setProperty('--ui-device', String(device));
  root.setProperty('--ui-w', `${next.w}px`);
  root.setProperty('--ui-h', `${next.h}px`);
  listeners.forEach((l) => l());
}

export const uiMetrics = {
  get: (): UiMetrics => metrics,
  subscribe: (l: () => void): (() => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export async function installUiKit(): Promise<void> {
  installTokens();
  installUiArt();
  metrics = { device: 0, zoom: 0, w: 0, h: 0 };
  measure();
  window.addEventListener('resize', measure);
  // devicePixelRatio changes (browser zoom, moving to another monitor) do not
  // fire resize everywhere
  const watchDpr = () => {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', () => { measure(); watchDpr(); }, { once: true });
  };
  watchDpr();
  await installFonts();
}
