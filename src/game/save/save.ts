import type { ClassId } from '../../data/classes';
import type { FactionId, RaceId } from '../../data/races';
import type { Look } from '../art/characters';
import { saveHook, type Game } from '../core/game';
import { buildInterior } from '../world/interiors';
import { generateOverworld } from '../world/worldgen';
import { Player } from '../player/player';
import { QuestLog, type ActiveQuest } from '../quests/questlog';
import { refreshFromTemplate } from '../items/loot';
import type { EquipSlot, Item } from '../items/types';
import { VILLAGE_TX, VILLAGE_TY } from '../../data/locations';
import { TILE } from '../world/tiles';
import { boxHitsTerrain } from '../world/map';
import { SAVE_KEY as KEY, preserveExpansionSave, readPlayableSave, writePlayableSave, type RecoverySource } from './rollbackRecovery';

const SETTINGS_KEY = 'modulo-realms-settings-v1';
const recoverySessions = new WeakMap<Game, { player: Player; source: RecoverySource }>();
let loadError = '';

export const getLoadError = (): string => loadError;

interface SavedMapState {
  opened: string[];
  respawn: Record<string, number>;
  killedSpawns: string[];
  /** Absent in saves written before chests and enemies started coming back. */
  everKilled?: string[];
  chestRestock?: Record<string, number>;
  chestRolls?: Record<string, number>;
  cleared: boolean;
}

export interface SaveData {
  version: 1;
  now?: number;
  savedAt: number;
  seed: number;
  mapId: string;
  clock: number;
  day: number;
  player: {
    name: string;
    race: RaceId;
    cls: ClassId;
    hairIndex: number;
    skinIndex: number;
    hairStyle: Look['hairStyle'];
    beard: Look['beard'];
    x: number;
    y: number;
    level: number;
    xp: number;
    hp: number;
    mp: number;
    sp: number;
    gold: number;
    skillPoints: number;
    skills: Record<string, number>;
    inventory: Item[];
    storage: Item[];
    equipment: Record<EquipSlot, Item | null>;
    reputation: Record<FactionId, number>;
    flags: string[];
    discovered: string[];
    waystones: string[];
    killCounts: Record<string, number>;
    bossesKilled: string[];
    warrantsUsed?: number;
    clearedDungeons: string[];
    shrinesTended: number;
    quickItem: string | null;
    playTime: number;
    deaths: number;
  };
  quests: { active: ActiveQuest[]; completed: string[] };
  trackedQuest: string | null;
  mapStates: Record<string, SavedMapState>;
}

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function savePreview(): { name: string; level: number; cls: ClassId; race: RaceId; savedAt: number; map: string } | null {
  try {
    const { data } = readPlayableSave(localStorage);
    return { name: data.player.name, level: data.player.level, cls: data.player.cls, race: data.player.race, savedAt: data.savedAt, map: data.mapId };
  } catch {
    return null;
  }
}

export function saveGame(game: Game): void {
  if (game.screen !== 'playing' || !game.player) return;
  const p = game.player;
  const mapStates: Record<string, SavedMapState> = {};
  for (const [id, st] of game.mapStates) {
    mapStates[id] = {
      opened: [...st.opened],
      respawn: st.respawn,
      killedSpawns: [...st.killedSpawns],
      everKilled: [...st.everKilled],
      chestRestock: st.chestRestock,
      chestRolls: st.chestRolls,
      cleared: st.cleared,
    };
  }
  const data: SaveData = {
    version: 1,
    now: game.now,
    savedAt: Date.now(),
    seed: game.seed,
    mapId: game.map.id,
    clock: game.clock,
    day: game.day,
    player: {
      name: p.name, race: p.race, cls: p.cls,
      hairIndex: p.hairIndex, skinIndex: p.skinIndex, hairStyle: p.hairStyle, beard: p.beard,
      x: p.x, y: p.y, level: p.level, xp: p.xp, hp: p.hp, mp: p.mp, sp: p.sp, gold: p.gold,
      skillPoints: p.skillPoints, skills: p.skills,
      inventory: p.inventory, storage: p.storage, equipment: p.equipment,
      reputation: p.reputation,
      flags: [...p.flags], discovered: [...p.discovered], waystones: [...p.waystones],
      killCounts: p.killCounts, bossesKilled: [...p.bossesKilled], warrantsUsed: p.warrantsUsed, clearedDungeons: [...p.clearedDungeons],
      shrinesTended: p.shrinesTended, quickItem: p.quickItem, playTime: p.playTime, deaths: p.deaths,
    },
    quests: game.quests.serialize(),
    trackedQuest: game.trackedQuest,
    mapStates,
  };
  try {
    const session = recoverySessions.get(game);
    writePlayableSave(localStorage, data, session?.player === p ? session.source : undefined);
  } catch (error) {
    game.toast('Your game could not be saved', error instanceof Error ? error.message : 'Browser storage is unavailable. Keep this tab open.', '#d9553f');
  }
}

export function loadGame(game: Game): boolean {
  loadError = '';
  try {
    return loadGameChecked(game);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'This saved game could not be loaded. Your saved data has not been changed.';
    game.screen = 'title';
    game.touch();
    return false;
  }
}

function loadGameChecked(game: Game): boolean {
  let data: SaveData;
  let source: RecoverySource | undefined;
  let heldItems = 0;
  try {
    ({ data, source, heldItems } = readPlayableSave(localStorage));
    if (source) preserveExpansionSave(localStorage, source);
  } catch (error) {
    if (error instanceof DOMException) throw new Error('Browser storage is full or unavailable. The original save is untouched; free some storage and try Continue again.');
    throw error;
  }

  const sp = data.player;
  game.seed = data.seed;
  game.maps.clear();
  game.mapStates.clear();
  game.shopStock.clear();

  const world = generateOverworld(data.seed);
  game.maps.set('overworld', world);
  for (const portal of world.portals) {
    if (portal.kind !== 'door' || game.maps.has(portal.to)) continue;
    game.maps.set(portal.to, buildInterior(portal.to, portal.label.replace('Enter ', ''), portal.x + portal.w / 2, portal.y + portal.h + 22));
  }

  const player = new Player({
    name: sp.name, race: sp.race, cls: sp.cls,
    hairIndex: sp.hairIndex, skinIndex: sp.skinIndex, hairStyle: sp.hairStyle, beard: sp.beard,
  });
  player.level = sp.level;
  player.xp = sp.xp;
  player.gold = sp.gold;
  player.skillPoints = sp.skillPoints;
  player.skills = sp.skills ?? {};
  // Gear in a save is a snapshot of the templates as they were on the day it
  // dropped. Re-reading it against them is what lets a balance pass, or a new
  // signature move, reach the axe already in the player's hands rather than
  // only the next one they find.
  player.inventory = (sp.inventory ?? []).map(refreshFromTemplate);
  player.storage = (sp.storage ?? []).map(refreshFromTemplate);
  player.equipment = sp.equipment ?? player.equipment;
  for (const slot of Object.keys(player.equipment) as EquipSlot[]) {
    const it = player.equipment[slot];
    if (it) player.equipment[slot] = refreshFromTemplate(it);
  }
  player.reputation = { ...player.reputation, ...sp.reputation };
  player.flags = new Set(sp.flags ?? []);
  player.discovered = new Set(sp.discovered ?? []);
  player.waystones = new Set(sp.waystones ?? ['ashvale']);
  player.killCounts = sp.killCounts ?? {};
  player.bossesKilled = new Set(sp.bossesKilled ?? []);
  player.warrantsUsed = sp.warrantsUsed ?? 0;
  player.clearedDungeons = new Set(sp.clearedDungeons ?? []);
  player.shrinesTended = sp.shrinesTended ?? 0;
  player.quickItem = sp.quickItem ?? null;
  player.playTime = sp.playTime ?? 0;
  player.deaths = sp.deaths ?? 0;
  player.hp = Math.min(sp.hp, player.maxHp);
  player.mp = Math.min(sp.mp, player.maxMp);
  player.sp = Math.min(sp.sp, player.maxSp);
  game.player = player;
  if (source) recoverySessions.set(game, { player, source });
  else recoverySessions.delete(game);

  game.quests = QuestLog.deserialize(data.quests ?? { active: [], completed: [] });
  game.trackedQuest = data.trackedQuest ?? null;
  for (const [id, st] of Object.entries(data.mapStates ?? {})) {
    game.mapStates.set(id, {
      opened: new Set(st.opened),
      respawn: st.respawn ?? {},
      killedSpawns: new Set(st.killedSpawns),
      // An older save has no `everKilled`; seeding it from `killedSpawns`
      // keeps a dungeon that was already cleared reading as cleared.
      everKilled: new Set(st.everKilled ?? st.killedSpawns),
      chestRestock: st.chestRestock ?? {},
      chestRolls: st.chestRolls ?? {},
      cleared: st.cleared,
    });
  }

  game.clock = Number.isFinite(data.clock) ? data.clock : 0;
  game.day = Number.isFinite(data.day) ? data.day : 1;
  game.now = data.now ?? 0;
  game.panel = null;
  const savedMap = game.getMap(data.mapId);
  let returnedHome = savedMap.id !== data.mapId || !Number.isFinite(sp.x) || !Number.isFinite(sp.y)
    || sp.x < 0 || sp.y < 0 || sp.x >= savedMap.w * TILE || sp.y >= savedMap.h * TILE;
  game.setMap(returnedHome ? 'overworld' : data.mapId);
  let position = returnedHome ? { x: 0, y: 0 } : game.findStandingSpot(sp.x, sp.y);
  if (returnedHome || boxHitsTerrain(game.map, position.x, position.y, 10, 7)) {
    returnedHome = true;
    game.setMap('overworld');
    const home = world.portals.find((p) => p.to === 'int_home');
    position = game.findStandingSpot(home ? home.x + home.w / 2 : VILLAGE_TX * TILE,
      home ? home.y + home.h + 26 : VILLAGE_TY * TILE);
  }
  player.x = position.x;
  player.y = position.y;
  game.camera.x = player.x;
  game.camera.y = player.y;
  game.screen = 'playing';
  game.catchUpBounties();
  game.toast('Game loaded', `${player.name}, level ${player.level}`, '#6fd0e8');
  if (source) game.toast('Your character is safe', `${returnedHome ? 'You are back in Ashvale. ' : ''}Greek progress${heldItems ? ` and ${heldItems} Greek item${heldItems === 1 ? '' : 's'}` : ''} stays backed up. This version saves your continued adventure separately.`, '#6fd0e8');
  game.touch();
  return true;
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export interface StoredSettings {
  master: number;
  music: number;
  sfx: number;
  uiScale: number;
  showDamage: boolean;
  batterySaver?: boolean;
  touchControls?: boolean;
}

export function loadSettings(): StoredSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as StoredSettings) : null;
  } catch {
    return null;
  }
}

export function saveSettings(s: StoredSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

saveHook.saveGame = saveGame;
