import { audio } from '../../game/audio/audio';

/**
 * Sound hooks for the interface.
 *
 * Every piece of UI that should make a noise calls `uiSound(cue)`; which
 * synthesised sound (if any) answers is decided here, in one table. A cue
 * mapped to `null` is wired but silent — the place to plug a sound in once it
 * exists, without touching a single component.
 */
export type UiCue =
  | 'hover'   // pointer enters a button or slot
  | 'click'   // a button is pressed
  | 'open'    // a panel opens
  | 'close'   // a panel closes
  | 'tab'     // a tab or filter changes
  | 'coin'    // money changes hands
  | 'deny'    // an action is refused (disabled button, can't afford)
  | 'confirm' // a destructive action is confirmed
  | 'banner'  // a place name or level-up banner appears
  | 'toast';  // a toast slides in

const CUES: Record<UiCue, { sound: string; volume: number } | null> = {
  hover: null,
  click: { sound: 'ui', volume: 0.35 },
  open: { sound: 'ui_big', volume: 0.35 },
  close: null,
  tab: { sound: 'ui', volume: 0.22 },
  coin: { sound: 'gold', volume: 0.5 },
  deny: null,
  confirm: { sound: 'ui_big', volume: 0.5 },
  banner: null,
  toast: null,
};

let lastAt = 0;
let lastCue: UiCue | null = null;

/** Play the sound for a UI cue, if one is assigned. */
export function uiSound(cue: UiCue): void {
  const entry = CUES[cue];
  if (!entry) return;
  // one press can close a panel and open another: within a frame or two,
  // only the first sound plays (money and banners always get through)
  const now = performance.now();
  if (now - lastAt < 50 && (cue === lastCue || (cue !== 'coin' && cue !== 'banner'))) return;
  lastAt = now;
  lastCue = cue;
  audio.play(entry.sound, entry.volume);
}
