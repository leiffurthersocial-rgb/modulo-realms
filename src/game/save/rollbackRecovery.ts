import { CLASS_BY_ID } from '../../data/classes';
import { RACE_BY_ID } from '../../data/races';
import { TEMPLATE_BY_ID } from '../../data/items';
import { QUEST_BY_ID } from '../../data/quests';
import { RARITY_ORDER, type Item } from '../items/types';
import type { SaveData } from './save';

export const SAVE_KEY = 'modulo-realms-save-v1';
export const ROLLBACK_KEY = 'modulo-realms-save-rollback-v1';
export const PRE_AEGEAN_KEY = 'modulo-realms-save-pre-aegean';

export interface RecoverySource { id: string; raw: string; heldItemIds?: string[]; heldQuestIds?: string[] }
export interface ReadSave {
  data: SaveData;
  source?: RecoverySource;
  heldItems: number;
}

interface RollbackSave {
  version: 1;
  source: string;
  heldItemIds?: string[];
  heldQuestIds?: string[];
  data: SaveData;
}

/** A separate namespace keeps the expansion save intact across every autosave. */
export function recoveryId(raw: string): string {
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < raw.length; i++) {
    a = Math.imul(a ^ raw.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ raw.charCodeAt(i);
  }
  return `${raw.length}-${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`;
}

export const backupKey = (source: RecoverySource): string => `modulo-realms-save-aegean-backup-${source.id}`;

function parseSave(raw: string): Omit<SaveData, 'version'> & { version: 1 | 2 } {
  let data;
  try { data = JSON.parse(raw); } catch {
    throw new Error('This saved game could not be read. It has not been changed.');
  }
  if (data?.version !== 1 && data?.version !== 2) {
    throw new Error('This save belongs to an unsupported game version. It has not been changed.');
  }
  const p = data.player;
  if (!p || typeof p.name !== 'string' || !CLASS_BY_ID[p.cls as keyof typeof CLASS_BY_ID]
    || !RACE_BY_ID[p.race as keyof typeof RACE_BY_ID] || !Number.isFinite(data.seed)
    || !Number.isFinite(p.level) || p.level < 1 || typeof data.mapId !== 'string') {
    throw new Error('This saved character is incomplete. The original save has not been changed.');
  }
  return data;
}

/** Read-back is mandatory before any action that could replace a newer save. */
export function preserveExpansionSave(storage: Storage, source: RecoverySource): void {
  const key = backupKey(source);
  const previous = storage.getItem(key);
  if (previous && previous !== source.raw) throw new Error('The save backup could not be verified. Your original save has not been changed.');
  if (!previous) storage.setItem(key, source.raw);
  if (storage.getItem(key) !== source.raw) throw new Error('The save backup could not be verified. Your original save has not been changed.');
}

function available(item: Item): boolean {
  return !!item && !!TEMPLATE_BY_ID[item.defId] && RARITY_ORDER.includes(item.rarity);
}

export function readPlayableSave(storage: Storage): ReadSave {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) throw new Error('There is no saved game in this browser.');
  const original = parseSave(raw);
  if (original.version === 1) return { data: { ...original, version: 1 }, heldItems: 0 };
  const p = original.player;
  const allItems = [...(p.inventory ?? []), ...(p.storage ?? []), ...Object.values(p.equipment ?? {}).filter((it): it is Item => !!it)];
  const heldItemIds = allItems.filter((it) => !available(it)).map((it) => it.uid);
  const heldItems = heldItemIds.length;
  const heldQuestIds = (original.quests?.active ?? []).filter((q) => !QUEST_BY_ID[q.id]).map((q) => q.id);
  const source: RecoverySource = { id: recoveryId(raw), raw, heldItemIds, heldQuestIds };
  const savedRollback = storage.getItem(ROLLBACK_KEY);
  if (savedRollback) {
    let resumed: RollbackSave;
    try { resumed = JSON.parse(savedRollback); } catch {
      throw new Error('The resumed game could not be read. Both saved copies are untouched.');
    }
    if (resumed.source === source.id) {
      const data = parseSave(JSON.stringify(resumed.data));
      if (data.version !== 1) throw new Error('The resumed save belongs to a different version. Both saved copies are untouched.');
      return { data: { ...data, version: 1 }, source, heldItems };
    }
  }

  // Work on a parsed copy only. The complete Greek character, items, ship,
  // campaign and position remain byte-for-byte intact in the original save.
  const data: SaveData = { ...original, version: 1 };
  p.inventory = (p.inventory ?? []).filter(available);
  p.storage = (p.storage ?? []).filter(available);
  for (const slot of Object.keys(p.equipment ?? {}) as Array<keyof typeof p.equipment>) {
    const item = p.equipment[slot];
    if (item && !available(item)) p.equipment[slot] = null;
  }
  const active = data.quests?.active ?? [];
  data.quests = { active: active.filter((q) => !!QUEST_BY_ID[q.id]), completed: data.quests?.completed ?? [] };
  if (data.trackedQuest && !QUEST_BY_ID[data.trackedQuest]) data.trackedQuest = null;
  if (p.quickItem && !p.inventory.some((it) => it.defId === p.quickItem)) p.quickItem = null;
  return { data, source, heldItems };
}

export function writePlayableSave(storage: Storage, data: SaveData, source?: RecoverySource): void {
  if (source) {
    // A newer tab may have resumed the expansion. Never overwrite its data or
    // attach legacy progress to the wrong character.
    if (storage.getItem(SAVE_KEY) !== source.raw) {
      throw new Error('Another tab changed this save. Keep this tab open and reload the other game before saving again.');
    }
    preserveExpansionSave(storage, source);
    const serialized = JSON.stringify({ version: 1, source: source.id, heldItemIds: source.heldItemIds ?? [], heldQuestIds: source.heldQuestIds ?? [], data } satisfies RollbackSave);
    storage.setItem(ROLLBACK_KEY, serialized);
    if (storage.getItem(ROLLBACK_KEY) !== serialized) throw new Error('The resumed save could not be verified.');
    return;
  }
  const previous = storage.getItem(SAVE_KEY);
  // Starting a new character is allowed, but must never silently destroy the
  // player's expansion save. The old pre-Aegean backup is never overwritten.
  if (previous) {
    let version;
    try { version = JSON.parse(previous).version; } catch { /* Existing behaviour allows replacing an unreadable save. */ }
    if (version === 2) preserveExpansionSave(storage, { id: recoveryId(previous), raw: previous });
  }
  storage.setItem(SAVE_KEY, JSON.stringify(data));
}
