import type { SaveData } from "./save";
import type { EquipSlot, Item } from "../items/types";

const SAVE_KEY = "modulo-realms-save-v1";
const ROLLBACK_KEY = "modulo-realms-save-rollback-v1";

interface RollbackSave {
  version: 1;
  source: string;
  heldItemIds: string[];
  heldQuestIds: string[];
  data: SaveData;
}

export interface RejoinedSave {
  data: SaveData;
  rejoined: boolean;
  restoredItems: number;
}

/** Must stay identical to the production rollback's recoveryId function. */
export function recoveryId(raw: string): string {
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < raw.length; i++) {
    a = Math.imul(a ^ raw.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ raw.charCodeAt(i);
  }
  return `${raw.length}-${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`;
}

function parse(raw: string): SaveData {
  let data: SaveData;
  try {
    data = JSON.parse(raw) as SaveData;
  } catch {
    throw new Error(
      "This saved game could not be read. Your saved copies have not been changed.",
    );
  }
  if (
    !data ||
    (data.version !== 1 && data.version !== 2) ||
    !data.player ||
    !Number.isFinite(data.seed)
  ) {
    throw new Error(
      "This saved game is incomplete or belongs to an unsupported version. Your saved copies have not been changed.",
    );
  }
  return data;
}

/**
 * The rollback played a separate v1 projection while keeping the entire v2
 * character untouched. Join those branches without replaying rewards: mutable
 * possessions, gold, quests and location come from the latest played save;
 * expansion receipts, ships and held objects come from the frozen v2 source.
 *
 * Read-only. Leave both recovery entries in browser storage. After the caller
 * verifies its next normal v2 save, the main raw fingerprint changes and the
 * old projection no longer matches. Repeated loads before that save are
 * deterministic, and held items are reconciled by UID rather than appended
 * blindly. A failed save cannot make the resumed progress disappear.
 */
export function readExpansionSave(
  storage: Pick<Storage, "getItem">,
): RejoinedSave | null {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  const original = parse(raw);
  const untouched = { data: original, rejoined: false, restoredItems: 0 };
  if (original.version !== 2) return untouched;
  const shadowRaw = storage.getItem(ROLLBACK_KEY);
  if (!shadowRaw) return untouched;
  let shadow: RollbackSave;
  try {
    shadow = JSON.parse(shadowRaw) as RollbackSave;
  } catch {
    throw new Error(
      "Your resumed adventure could not be read. Both saved copies are still safe; no older progress has been loaded.",
    );
  }
  if (shadow.source !== recoveryId(raw)) return untouched;
  if (
    shadow.version !== 1 ||
    !Array.isArray(shadow.heldItemIds) ||
    !Array.isArray(shadow.heldQuestIds)
  ) {
    throw new Error(
      "Your resumed adventure is missing its recovery information. Both saved copies are unchanged.",
    );
  }
  const latest = parse(JSON.stringify(shadow.data));
  if (latest.version !== 1 || latest.seed !== original.seed) {
    throw new Error(
      "The saved recovery belongs to a different adventure. Both saved copies are unchanged.",
    );
  }

  const data: SaveData = {
    ...original,
    version: 2,
    savedAt: latest.savedAt,
    now: latest.now ?? original.now,
    mapId: latest.mapId,
    clock: latest.clock,
    day: latest.day,
    player: {
      ...original.player,
      ...latest.player,
      inventory: [...(latest.player.inventory ?? [])],
      storage: [...(latest.player.storage ?? [])],
      equipment: { ...latest.player.equipment },
      // The old engine did not persist temporary effects. Do not resurrect
      // a battle's poisons, wards or healing ticks in a different location.
      statuses: latest.player.statuses ?? [],
      buffs: latest.player.buffs ?? [],
      resistances: latest.player.resistances ?? {},
      regen: latest.player.regen ?? null,
      shield: latest.player.shield ?? 0,
      shieldUntil: latest.player.shieldUntil ?? 0,
      cooldowns: latest.player.cooldowns ?? {},
      artifactCooldown: latest.player.artifactCooldown ?? 0,
      weaponPowerCooldown: latest.player.weaponPowerCooldown ?? 0,
      offhandCooldown: latest.player.offhandCooldown ?? 0,
    },
    quests: {
      active: [...(latest.quests?.active ?? [])],
      completed: [...(latest.quests?.completed ?? [])],
    },
    trackedQuest: latest.trackedQuest,
    mapStates: { ...original.mapStates, ...latest.mapStates },
  };

  const present = new Set(
    [
      ...data.player.inventory,
      ...data.player.storage,
      ...Object.values(data.player.equipment).filter((it): it is Item => !!it),
    ].map((item) => item.uid),
  );
  const held = new Set(shadow.heldItemIds);
  let restoredItems = 0;
  const restore = (item: Item, slot?: EquipSlot): void => {
    if (!held.has(item.uid) || present.has(item.uid)) return;
    // Newly earned/equipped old-world gear wins its slot. Held gear goes to
    // storage, which has no bag limit, so no item is lost or forced over it.
    if (slot && !data.player.equipment[slot])
      data.player.equipment[slot] = item;
    else data.player.storage.push(item);
    present.add(item.uid);
    restoredItems++;
  };
  for (const [slot, item] of Object.entries(original.player.equipment ?? {})) {
    if (item) restore(item, slot as EquipSlot);
  }
  for (const item of [
    ...(original.player.inventory ?? []),
    ...(original.player.storage ?? []),
  ])
    restore(item);

  const heldQuests = new Set(shadow.heldQuestIds);
  const knownQuests = new Set([
    ...data.quests.completed,
    ...data.quests.active.map((q) => q.id),
  ]);
  for (const quest of original.quests?.active ?? []) {
    if (heldQuests.has(quest.id) && !knownQuests.has(quest.id)) {
      data.quests.active.push(quest);
      knownQuests.add(quest.id);
    }
  }
  // The resumed character is on foot in the old world. Keep ships, fittings,
  // hull, discovered ports and wreck recovery, but never spawn their old deck
  // over Ashvale or replace the character's current position with a voyage.
  if (data.naval)
    data.naval = { ...data.naval, aboard: false, deck: undefined };
  return { data, rejoined: true, restoredItems };
}
