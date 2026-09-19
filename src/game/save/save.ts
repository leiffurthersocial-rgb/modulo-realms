import { readExpansionSave } from './rejoinRollback';
import type { AegeanPowersSave } from '../aegean/powers';
import type { ActivitiesSave } from '../aegean/activities';
import type { CampaignSnapshot } from '../aegean/campaign';
import type { NavalSave } from '../aegean/naval';
import { invalidateChunks } from '../core/renderer';
import type { ClassId } from '../../data/classes';
import type { FactionId, RaceId } from '../../data/races';
import type { Look } from '../art/characters';
import { saveHook, type Game } from '../core/game';
import { buildInterior } from '../world/interiors';
import { generateOverworld } from '../world/worldgen';
import { Player } from '../player/player';
import { QuestLog, type ActiveQuest } from '../quests/questlog';
import { refreshFromTemplate, normalizeItemCurve, restoreLegacyItemMigration, type ItemCurveMigration } from '../items/loot';
import type { EquipSlot, Item } from '../items/types';

const KEY = 'modulo-realms-save-v1';
const BACKUP_KEY = 'modulo-realms-save-pre-aegean';
const RECOVERY_KEY = 'modulo-realms-save-recovery';
const SETTINGS_KEY = 'modulo-realms-settings-v1';
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
  version: 1 | 2;
  now?: number;
  itemMigrations?: ItemCurveMigration[];
  campaign?: CampaignSnapshot;
  activities?: ActivitiesSave;
  naval?: NavalSave;
  powers?: AegeanPowersSave;
  encounters?: ReturnType<Game['encounters']['snapshot']>;
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
    cooldowns?:Record<string,number>;
    resistances?:Player['resistances'];
    statuses?:Player['statuses'];
    buffs?:Player['buffs'];
    reviveUsed?:boolean;
    regen?:Player['regen'];
    shield?:number;
    shieldUntil?:number;
    artifactCooldown?:number;
    weaponPowerCooldown?:number;
    offhandCooldown?:number;
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
    const loaded = readExpansionSave(localStorage);
    if (!loaded) return null;
    const data = loaded.data;
    return { name: data.player.name, level: data.player.level, cls: data.player.cls, race: data.player.race, savedAt: data.savedAt, map: data.mapId };
  } catch {
    return null;
  }
}

export function saveGame(game: Game): boolean {
  if (game.screen !== 'playing' || !game.player || game.encounters.isPractice) return false;
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
    version: 2,
    now: game.now,
    itemMigrations: game.itemMigrationReport,
    campaign: game.campaign.snapshot(),
    activities: game.activities.snapshot(),
    naval: game.naval.snapshot(),
    encounters: game.encounters.snapshot(),
    powers:game.powers.snapshot(),
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
      reviveUsed:p.reviveUsed,regen:p.regen,cooldowns:p.cooldowns,resistances:p.resistances,statuses:p.statuses,buffs:p.buffs,shield:p.shield,shieldUntil:p.shieldUntil,
      artifactCooldown:p.artifactCooldown,weaponPowerCooldown:p.weaponPowerCooldown,offhandCooldown:p.offhandCooldown,
    },
    quests: game.quests.serialize(),
    trackedQuest: game.trackedQuest,
    mapStates,
  };
  try {
    const serialized=JSON.stringify(data);
    const previous=localStorage.getItem(KEY);
    let legacy=false;try{legacy=!!previous&&JSON.parse(previous).version===1;}catch{/* A damaged previous entry must not prevent a fresh save. */}
    if(legacy && previous && !localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY,previous);
    localStorage.setItem(RECOVERY_KEY,serialized);
    if(localStorage.getItem(RECOVERY_KEY)!==serialized) throw new Error('Save verification failed');
    localStorage.setItem(KEY,serialized);
    if(localStorage.getItem(KEY)!==serialized) throw new Error('Save verification failed');
    localStorage.removeItem(RECOVERY_KEY);
    return true;
  } catch {
    game.toast('Your game could not be saved', 'Browser storage is full or unavailable. Keep this tab open and free some storage.', '#d9553f');
    return false;
  }
}

export function loadGame(game: Game): boolean {
  loadError = '';
  try { return loadGameChecked(game); }
  catch (error) {
    loadError = error instanceof Error ? error.message : 'The game could not be loaded. Your saved copies have not been changed.';
    game.screen = 'title';
    game.touch();
    return false;
  }
}

function loadGameChecked(game: Game): boolean {
  let data: SaveData;
  const loaded = readExpansionSave(localStorage);
  if (!loaded) throw new Error('There is no saved game in this browser.');
  data = loaded.data;
  if (!data || (data.version !== 1 && data.version !== 2) || !data.player || !Number.isFinite(data.seed)) return false;
  invalidateChunks();
  game.encounters.restore(undefined);
  game.naval.reset();
  game.campaign.reset();
  game.activities.reset();
  game.services.reset();

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
  game.itemMigrationReport=data.itemMigrations??[];
  const restoreItem=(item:Item):Item=>{restoreLegacyItemMigration(item,game.itemMigrationReport);const report=normalizeItemCurve(item);if(report?.legacyRollsEstimated&&!game.itemMigrationReport.some(r=>r.uid===item.uid))game.itemMigrationReport.push(report);return refreshFromTemplate(item);};
  player.inventory = (sp.inventory ?? []).map(restoreItem);
  player.storage = (sp.storage ?? []).map(restoreItem);
  player.equipment = sp.equipment ?? player.equipment;
  for (const slot of Object.keys(player.equipment) as EquipSlot[]) {
    const it = player.equipment[slot];
    if (it) player.equipment[slot] = restoreItem(it);
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
  player.reviveUsed=sp.reviveUsed??false;player.regen=sp.regen??null;
  player.cooldowns=sp.cooldowns??{};player.resistances=sp.resistances??{};player.statuses=sp.statuses??[];player.buffs=sp.buffs??[];
  player.shield=sp.shield??0;player.shieldUntil=sp.shieldUntil??0;
  player.artifactCooldown=sp.artifactCooldown??0;player.weaponPowerCooldown=sp.weaponPowerCooldown??0;player.offhandCooldown=sp.offhandCooldown??0;
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
      // An older save has no `everKilled`; seeding it from `killedSpawns`
      // keeps a dungeon that was already cleared reading as cleared.
      everKilled: new Set(st.everKilled ?? st.killedSpawns),
      chestRestock: st.chestRestock ?? {},
      chestRolls: st.chestRolls ?? {},
      cleared: st.cleared,
    });
  }

  game.now = Math.max(0,data.now ?? 0);
  game.lastAutosave=game.now;
  game.campaign.restore(data.campaign);
  game.activities.restore(data.activities);
  game.naval.restore(data.naval);
  game.naval.buildDeck();
  game.clock = data.clock;
  game.day = data.day;
  game.screen = 'playing';
  game.panel = null;
  game.setMap(data.mapId);
  if (game.recoverSavedPosition(sp.x, sp.y))
    game.toast('Safe ground', 'The landscape has changed. Your gear and progress are intact.', '#6fd0e8');
  game.encounters.restore(data.encounters);
  game.encounters.onMapEntered();
  game.powers.restore(data.powers);
  if(player.equipment.mainHand?.aegeanPower)player.weaponPowerCooldown=game.powers.cooldown(player.equipment.mainHand);
  if(player.equipment.offHand?.aegeanPower)player.offhandCooldown=game.powers.cooldown(player.equipment.offHand);
  if(player.equipment.accessory?.aegeanPower)player.artifactCooldown=game.powers.cooldown(player.equipment.accessory);
  game.naval.populateDeck();
  game.catchUpBounties();
  if(loaded.rejoined) game.toast('Your adventure is restored', 'Your latest progress and stored Greek equipment are together again.', '#6fd0e8');
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
