import type { ClassId } from '../../data/classes';
import type { FactionId, RaceId } from '../../data/races';
import type { Look } from '../art/characters';
import { saveHook, type Game } from '../core/game';
import { buildInterior } from '../world/interiors';
import { generateOverworld } from '../world/worldgen';
import { Player } from '../player/player';
import { QuestLog, type ActiveQuest } from '../quests/questlog';
import type { EquipSlot, Item } from '../items/types';

const KEY = 'modulo-realms-save-v1';
const SETTINGS_KEY = 'modulo-realms-settings-v1';

interface SavedMapState {
  opened: string[];
  respawn: Record<string, number>;
  killedSpawns: string[];
  cleared: boolean;
}

export interface SaveData {
  version: 1;
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
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
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
      cleared: st.cleared,
    };
  }
  const data: SaveData = {
    version: 1,
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
      killCounts: p.killCounts, bossesKilled: [...p.bossesKilled], clearedDungeons: [...p.clearedDungeons],
      shrinesTended: p.shrinesTended, quickItem: p.quickItem, playTime: p.playTime, deaths: p.deaths,
    },
    quests: game.quests.serialize(),
    trackedQuest: game.trackedQuest,
    mapStates,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota or private mode — ignore */
  }
}

export function loadGame(game: Game): boolean {
  let data: SaveData;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    data = JSON.parse(raw) as SaveData;
  } catch {
    return false;
  }
  if (!data || data.version !== 1) return false;

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
  player.inventory = sp.inventory ?? [];
  player.storage = sp.storage ?? [];
  player.equipment = sp.equipment ?? player.equipment;
  player.reputation = { ...player.reputation, ...sp.reputation };
  player.flags = new Set(sp.flags ?? []);
  player.discovered = new Set(sp.discovered ?? []);
  player.waystones = new Set(sp.waystones ?? ['ashvale']);
  player.killCounts = sp.killCounts ?? {};
  player.bossesKilled = new Set(sp.bossesKilled ?? []);
  player.clearedDungeons = new Set(sp.clearedDungeons ?? []);
  player.shrinesTended = sp.shrinesTended ?? 0;
  player.quickItem = sp.quickItem ?? null;
  player.playTime = sp.playTime ?? 0;
  player.deaths = sp.deaths ?? 0;
  player.hp = Math.min(sp.hp, player.maxHp);
  player.mp = Math.min(sp.mp, player.maxMp);
  player.sp = Math.min(sp.sp, player.maxSp);
  game.player = player;

  game.quests = QuestLog.deserialize(data.quests ?? { active: [], completed: [] });
  game.trackedQuest = data.trackedQuest ?? null;
  for (const [id, st] of Object.entries(data.mapStates ?? {})) {
    game.mapStates.set(id, {
      opened: new Set(st.opened),
      respawn: st.respawn ?? {},
      killedSpawns: new Set(st.killedSpawns),
      cleared: st.cleared,
    });
  }

  game.clock = data.clock;
  game.day = data.day;
  game.screen = 'playing';
  game.panel = null;
  game.setMap(data.mapId);
  player.x = sp.x;
  player.y = sp.y;
  game.camera.x = sp.x;
  game.camera.y = sp.y;
  game.toast('Game loaded', `${player.name}, level ${player.level}`, '#6fd0e8');
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
