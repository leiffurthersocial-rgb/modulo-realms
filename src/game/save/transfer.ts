/*
 * Moving a game to another browser: everything the game keeps in
 * localStorage under "modulo-realms-" (the save, its recovery and rollback
 * copies, settings, the leaderboard identity) goes into one JSON file, and
 * comes back out of it. The save format itself is untouched — this only
 * copies the stored strings — so rejoinRollback and every migration run on
 * import exactly as they would on a normal load.
 *
 * An import is checked on a copy first: the file has to hold a save the
 * loader can read, or nothing in this browser changes.
 */
import { readExpansionSave } from './rejoinRollback';

const PREFIX = 'modulo-realms-';
const FORMAT = 'modulo-realms-export';

export interface SaveExport { format: typeof FORMAT; version: 1; exportedAt: number; keys: Record<string, string> }

export function exportSave(storage: Storage = localStorage): SaveExport {
  const keys: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(PREFIX)) keys[k] = storage.getItem(k) ?? '';
  }
  return { format: FORMAT, version: 1, exportedAt: Date.now(), keys };
}

/** A file name players can tell apart: modulo-Torvin-lv12-2026-10-07.json */
export function exportFileName(data: SaveExport): string {
  let who = 'save';
  try {
    const loaded = readExpansionSave({ getItem: (k) => data.keys[k] ?? null });
    if (loaded) who = `${loaded.data.player.name.replace(/[^A-Za-z0-9_-]+/g, '_')}-lv${loaded.data.player.level}`;
  } catch { /* keep "save" */ }
  return `modulo-${who}-${new Date(data.exportedAt).toISOString().slice(0, 10)}.json`;
}

export type ImportResult = { ok: true; name: string; level: number } | { ok: false; error: string };

/** Validates on a copy, then replaces this browser's game data with the file's. */
export function importSave(text: string, storage: Storage = localStorage): ImportResult {
  let data: SaveExport;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'That file is not a Modulo save.' }; }
  if (!data || data.format !== FORMAT || typeof data.keys !== 'object' || !data.keys) return { ok: false, error: 'That file is not a Modulo save.' };
  const keys = Object.fromEntries(Object.entries(data.keys).filter(([k, v]) => k.startsWith(PREFIX) && typeof v === 'string'));
  let loaded;
  try { loaded = readExpansionSave({ getItem: (k) => keys[k] ?? null }); } catch { loaded = null; }
  if (!loaded) return { ok: false, error: 'The save in that file cannot be read.' };

  const before = exportSave(storage).keys;
  try {
    for (const k of Object.keys(before)) storage.removeItem(k);
    for (const [k, v] of Object.entries(keys)) storage.setItem(k, v);
  } catch {
    // storage full or blocked: put back what was there
    try {
      for (const k of Object.keys(keys)) storage.removeItem(k);
      for (const [k, v] of Object.entries(before)) storage.setItem(k, v);
    } catch { /* nothing more to do */ }
    return { ok: false, error: 'This browser would not store the save.' };
  }
  return { ok: true, name: loaded.data.player.name, level: loaded.data.player.level };
}
