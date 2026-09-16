import type { Player } from '../player/player';
import { EQUIP_SLOTS } from '../player/player';
import { makeItem } from './loot';
import { isEquippable, type EquipSlot, type Item } from './types';

export const MAX_SLOTS = 40;

export function countItem(list: Item[], defId: string): number {
  let n = 0;
  for (const it of list) if (it.defId === defId) n += it.qty;
  return n;
}

/** Adds an item, stacking where possible. Returns false when the bag is full. */
export function addItem(list: Item[], item: Item): boolean {
  if (item.stackable) {
    const existing = list.find((i) => i.defId === item.defId && i.rarity === item.rarity);
    if (existing) {
      existing.qty += item.qty;
      return true;
    }
  }
  if (list.length >= MAX_SLOTS) return false;
  list.push(item);
  return true;
}

export function addTemplate(list: Item[], templateId: string, qty = 1, level?: number): boolean {
  return addItem(list, makeItem(templateId, { qty, level, plain: true }));
}

export function removeItem(list: Item[], uid: string, qty = 1): Item | null {
  const i = list.findIndex((it) => it.uid === uid);
  if (i < 0) return null;
  const item = list[i];
  if (item.qty > qty) {
    item.qty -= qty;
    return { ...item, qty };
  }
  list.splice(i, 1);
  return item;
}

export function removeByDefId(list: Item[], defId: string, qty = 1): number {
  let remaining = qty;
  for (let i = list.length - 1; i >= 0 && remaining > 0; i--) {
    const it = list[i];
    if (it.defId !== defId) continue;
    const take = Math.min(remaining, it.qty);
    it.qty -= take;
    remaining -= take;
    if (it.qty <= 0) list.splice(i, 1);
  }
  return qty - remaining;
}

/**
 * Anything equippable can be equipped. No class locks, no weapon proficiency,
 * no level gates — if you found it, you can swing it.
 */
export function canEquip(player: Player, item: Item): { ok: boolean; reason?: string } {
  void player;
  if (!isEquippable(item)) return { ok: false, reason: 'This cannot be equipped.' };
  return { ok: true };
}

/** Swaps the item into its slot, returning whatever came off. */
export function equip(player: Player, item: Item): { ok: boolean; reason?: string } {
  const check = canEquip(player, item);
  if (!check.ok) return check;
  const slot = item.slot as EquipSlot;
  const idx = player.inventory.findIndex((i) => i.uid === item.uid);
  if (idx >= 0) player.inventory.splice(idx, 1);
  const prev = player.equipment[slot];
  player.equipment[slot] = item;
  if (prev) player.inventory.push(prev);
  clampVitals(player);
  return { ok: true };
}

export function unequip(player: Player, slot: EquipSlot): boolean {
  const item = player.equipment[slot];
  if (!item) return false;
  if (player.inventory.length >= MAX_SLOTS) return false;
  player.equipment[slot] = null;
  player.inventory.push(item);
  clampVitals(player);
  return true;
}

export function clampVitals(player: Player): void {
  player.hp = Math.min(player.hp, player.maxHp);
  player.mp = Math.min(player.mp, player.maxMp);
  player.sp = Math.min(player.sp, player.maxSp);
}

/** Highest-value comparable item currently equipped, for tooltips. */
export function equippedComparison(player: Player, item: Item): Item | null {
  if (!isEquippable(item) || !item.slot) return null;
  return player.equipment[item.slot];
}

export function sortInventory(list: Item[]): void {
  const order: Record<string, number> = { weapon: 0, armor: 1, accessory: 2, consumable: 3, material: 4, quest: 5, misc: 6 };
  const rarityOrder: Record<string, number> = { legendary: 0, epic: 1, superRare: 2, rare: 3, common: 4 };
  list.sort((a, b) =>
    (order[a.type] - order[b.type]) ||
    (rarityOrder[a.rarity] - rarityOrder[b.rarity]) ||
    (b.level - a.level) ||
    a.name.localeCompare(b.name));
}

export function totalDefense(player: Player): number {
  let d = 0;
  for (const slot of EQUIP_SLOTS) d += player.equipment[slot]?.stats.defense ?? 0;
  return d;
}
