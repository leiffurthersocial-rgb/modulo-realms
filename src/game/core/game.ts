import { CLASS_BY_ID, type AbilityDef, type ClassId } from '../../data/classes';
import { ENEMY_BY_ID } from '../../data/enemies';
import { TRASH_DROP_RATE, damageTaken } from '../../data/balance';
import { TEMPLATE_BY_ID } from '../../data/items';
import { LOCATIONS, LOCATION_BY_ID, REGION_BY_ID, REGION_BY_INDEX, VILLAGE_TX, VILLAGE_TY, WAYSTONE_SITES, WORLD_W, type LocationDef, type RegionId } from '../../data/locations';
import { NPCS, NPC_BY_ID, type NpcDef } from '../../data/npcs';
import { QUESTS, QUEST_BY_ID, type QuestDef } from '../../data/quests';
import { FACTION_BY_ID } from '../../data/races';
import { PAL } from '../art/palette';
import { audio, type MusicTrack } from '../audio/audio';
import { FxSystem } from '../combat/fx';
import { makeProjectile, type Projectile } from '../combat/projectiles';
import { Enemy } from '../entities/enemy';
import { NpcEntity } from '../entities/npcEntity';
import { applyStatus, resetEntityIds, type Entity } from '../entities/entity';
import { MAX_SLOTS, addItem, addTemplate, countItem, equip, removeByDefId, removeItem, unequip } from '../items/inventory';
import { makeItem, rollEnchants, rollLoot, sellValue, buyValue } from '../items/loot';
import { EFFECT_BY_ID } from '../items/effects';
import { enchantValue } from '../items/enchants';
import { EQUIP_SLOT_ORDER, RARITY_COLOR, RARITY_ENCHANT_SLOTS, RARITY_LABEL, type EquipSlot, type Item, type Rarity } from '../items/types';
import { DEFAULT_SWING_ARC, Player, SWING_ARC, type PlayerInit } from '../player/player';
import { QuestLog } from '../quests/questlog';
import { generateDungeon, dungeonEntry } from '../world/dungeons';
import { buildInterior, interiorEntry } from '../world/interiors';
import { boxHitsTerrain, findOpenNear, propsInRect, type GameMap, type PropInstance } from '../world/map';
import { T, TILE, TILES, blocksProjectiles } from '../world/tiles';
import { generateOverworld } from '../world/worldgen';
import { Input } from './input';
import { angleBetween, angleTo, clamp, damp, dirFromAngle, dist, dist2 } from './math';
import { RNG } from './rng';
import type { DamageOpts, ProjectileSpec, WorldCtx } from './world';
import type { DialogueChoice } from '../dialogue/types';
import { condMet, greetingFor, rootOptions } from '../dialogue/runtime';

export type UiPanel = 'inventory' | 'character' | 'map' | 'quests' | 'skills' | 'pause' | 'shop' | 'storage' | 'settings' | 'travel' | 'forge' | 'help' | 'loot' | null;
export type GameScreen = 'title' | 'creation' | 'playing' | 'dead';

export interface Pickup {
  id: number;
  x: number;
  y: number;
  z: number;
  vz: number;
  vx: number;
  vy: number;
  item: Item | null;
  gold: number;
  life: number;
  /**
   * Set on anything the player put down by hand. While it is set the item is
   * inert — no magnet, no collecting — and it clears the first time the player
   * is properly clear of it. Without this the pickup magnet sucks a dropped
   * item straight back in and dropping does nothing at all. A timer would not
   * do: the bag pauses the world but not the clock, so it would expire while
   * the player is still standing in the menu.
   */
  needsRelease?: boolean;
}

export interface ChestEntity {
  id: string;
  x: number;
  y: number;
  level: number;
  tier: 'small' | 'large' | 'boss';
  opened: boolean;
  fixed?: string[];
  gold?: number;
}

/** A container the player has opened and is taking things out of by hand. */
export interface LootSession {
  title: string;
  sub?: string;
  x: number;
  y: number;
  gold: number;
  items: Item[];
}

export interface Toast {
  id: number;
  title: string;
  sub?: string;
  color: string;
  icon?: string;
  t: number;
}

export interface DialogueState {
  npcId: string;
  name: string;
  title: string;
  attitude: { label: string; color: string };
  lines: string[];
  lineIndex: number;
  choices: DialogueChoice[];
  /** Quest currently being offered, for the accept/decline panel. */
  offer?: QuestDef;
}

export interface ShopState {
  npcId: string;
  shopId: string;
  name: string;
  priceMod: number;
  stock: Item[];
  gold: number;
}

export interface InteractTarget {
  label: string;
  key: string;
  x: number;
  y: number;
  run: () => void;
}

interface MapState {
  opened: Set<string>;
  respawn: Record<string, number>;
  /** Spawns that are gone for good: bosses, minibosses, named encounters. */
  killedSpawns: Set<string>;
  /**
   * Every spawn that has been put down at least once, whether or not it has
   * since come back. The "dungeon cleared" line reads this rather than
   * `killedSpawns`, so ordinary enemies repopulating a dungeon does not
   * un-clear it, and does not fire the toast again on the second visit.
   */
  everKilled: Set<string>;
  /** Game time each chest is allowed to restock at. */
  chestRestock: Record<string, number>;
  /** How many times each chest has restocked, so the re-roll is not a repeat. */
  chestRolls: Record<string, number>;
  cleared: boolean;
}

/**
 * How long the world takes to fill back in, in seconds of game time. Nothing
 * is finite: walk away from a cleared wing, come back later and there is
 * something in it again. Bosses are the exception — they stay dead.
 */
const CHEST_RESTOCK = 900;

/** Seconds of invulnerability after taking a hit. See `damagePlayer`. */
const PLAYER_IFRAMES = 0.28;

const ACTIVATE_DIST = 860;
const DESPAWN_DIST = 1500;
const DAY_SECONDS = 16 * 60;

export class Game implements WorldCtx {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  input = new Input();

  seed = 1337;
  screen: GameScreen = 'title';
  panel: UiPanel = null;
  dialogue: DialogueState | null = null;
  shop: ShopState | null = null;
  toasts: Toast[] = [];
  interact: InteractTarget | null = null;

  maps = new Map<string, GameMap>();
  mapStates = new Map<string, MapState>();
  map!: GameMap;
  player!: Player;
  quests = new QuestLog();

  enemies: Enemy[] = [];
  npcs: NpcEntity[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  chests: ChestEntity[] = [];
  /** Non-null while a chest's contents are on screen waiting to be taken. */
  loot: LootSession | null = null;
  /** The id of the NPC currently fighting you, if a duel is under way. */
  duelling: string | null = null;
  fx = new FxSystem();
  shopStock = new Map<string, Item[]>();

  camera = { x: 0, y: 0, shake: 0, zoom: 2 };
  now = 0;
  dt = 0;
  /** Elapsed in-game seconds; drives the clock and NPC schedules. */
  clock = DAY_SECONDS * (8 / 24);
  day = 1;
  paused = false;
  showMinimap = true;
  debug = false;
  godMode = false;
  lastAutosave = 0;
  bossTarget: Enemy | null = null;
  /** Black screen wipe used for doors, stairs and fast travel. */
  fade = { alpha: 0, target: 0, speed: 3.2, pending: null as null | (() => void), label: '' };
  /** Quest the player asked to be guided to. */
  trackedQuest: string | null = null;
  /** Waystone the player is currently standing at, if any. */
  currentWaystone: string | null = null;
  /** Game-clock time the player last took damage, for the fast-travel lockout. */
  lastDamageTaken = -Infinity;
  /** Seconds after taking damage before a waystone can be used again. */
  readonly travelLockoutAfterDamage = 3;
  activeSpawns = new Map<string, Enemy[]>();
  /**
   * Kill streak. Chain kills inside the window and the rewards escalate — the
   * pitch climbs, the XP multiplies, and the screen tells you about it. This
   * is the loop that makes clearing a room feel worth doing twice.
   */
  streak = 0;
  streakUntil = 0;
  /** Full-screen colour pop, drained by the renderer each frame. */
  screenFlash = { alpha: 0, color: '#ffffff' };
  uiVersion = 0;
  private listeners = new Set<() => void>();
  private toastId = 1;
  private pickupId = 1;
  private stepTimer = 0;
  private hitStop = 0;
  private lastMapMusic: MusicTrack | null = null;
  /**
   * `batterySaver` halves the frame rate and strips the per-frame work that
   * costs the most on a tablet: the light buffer drops to half resolution and
   * only the player and placed lights are drawn into it, particle counts are
   * cut, and ambient weather stops. The world, the rules and the art are
   * unchanged — it only spends less to show them.
   */
  /**
   * `touchControls` starts on wherever the primary input is a finger, so a
   * phone or a tablet is playable the moment it loads rather than after a trip
   * to the settings panel. It is a plain toggle after that, either way.
   */
  settings = {
    master: 0.8,
    music: 0.4,
    sfx: 0.65,
    uiScale: 1,
    showDamage: true,
    batterySaver: false,
    touchControls: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d', { alpha: false })!;
    this.g.imageSmoothingEnabled = false;
    this.input.attach(canvas);
  }

  /* ---------------- UI plumbing ---------------- */

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = (): number => this.uiVersion;

  touch(): void {
    this.uiVersion++;
    for (const cb of this.listeners) cb();
  }

  toast(title: string, sub?: string, color: string = PAL.cloth, icon?: string): void {
    this.toasts.push({ id: this.toastId++, title, sub, color, icon, t: 0 });
    if (this.toasts.length > 5) this.toasts.shift();
    this.touch();
  }

  get uiOpen(): boolean {
    return this.panel !== null || this.dialogue !== null || this.shop !== null || this.screen !== 'playing';
  }

  setPanel(p: UiPanel): void {
    // Leaving the loot menu by any route settles what is still in it, so a
    // chest's contents can never be stranded by opening the pack over them.
    if (p !== 'loot' && this.loot) this.abandonLoot();
    this.panel = p;
    this.dialogue = null;
    if (p !== 'shop') this.shop = null;
    audio.play('ui', 0.6);
    this.touch();
  }

  togglePanel(p: UiPanel): void {
    if (this.dialogue || this.shop) {
      this.closeAll();
      return;
    }
    this.setPanel(this.panel === p ? null : p);
  }

  closeAll(): void {
    if (this.loot) this.abandonLoot();
    this.panel = null;
    this.royalOpen = false;
    this.dialogue = null;
    this.shop = null;
    const npc = this.npcs.find((n) => n.talking);
    if (npc) npc.talking = false;
    this.touch();
  }

  /* ---------------- lifecycle ---------------- */

  newGame(init: PlayerInit, seed = Math.floor(Math.random() * 1e9)): void {
    resetEntityIds();
    this.seed = seed;
    this.maps.clear();
    this.mapStates.clear();
    this.shopStock.clear();
    this.quests = new QuestLog();
    this.player = new Player(init);

    const world = generateOverworld(seed);
    this.maps.set('overworld', world);
    this.buildInteriorsFor(world);

    const cls = this.player.classDef;
    for (const id of [cls.startWeapon, ...cls.startArmor]) {
      const it = makeItem(id, { plain: true });
      equip(this.player, it);
    }
    addTemplate(this.player.inventory, 'potion_health_s', 3);
    addTemplate(this.player.inventory, 'food_bread', 2);
    addTemplate(this.player.inventory, 'potion_mana_s', 2);
    this.player.gold = 90;

    this.setMap('overworld');
    const home = world.portals.find((p) => p.to === 'int_home');
    this.player.x = home ? home.x + home.w / 2 : VILLAGE_TX * TILE;
    this.player.y = home ? home.y + home.h + 26 : VILLAGE_TY * TILE;
    const open = this.findStandingSpot(this.player.x, this.player.y);
    this.player.x = open.x;
    this.player.y = open.y;

    this.player.discovered.add('ashvale');
    this.player.waystones.add('ashvale');
    this.quests.accept('tutorial');
    this.trackedQuest = 'tutorial';
    this.clock = DAY_SECONDS * (8 / 24);
    this.day = 1;
    this.screen = 'playing';
    this.panel = null;
    this.toast('Ashvale', 'Your story begins at the edge of the valley.', PAL.goldLit);
    this.toast('New quest: Somewhere to Start', 'Head east and find Whisperwell Cave.', '#6fbf5a');
    this.touch();
  }

  private buildInteriorsFor(world: GameMap): void {
    for (const p of world.portals) {
      if (p.kind !== 'door' || this.maps.has(p.to)) continue;
      const interior = buildInterior(p.to, p.label.replace('Enter ', ''), p.x + p.w / 2, p.y + p.h + 22);
      this.maps.set(p.to, interior);
    }
  }

  getMap(id: string): GameMap {
    let m = this.maps.get(id);
    if (!m) {
      const loc = LOCATIONS.find((l) => l.dungeon?.mapId === id);
      if (loc) {
        m = generateDungeon(loc, this.seed);
        this.maps.set(id, m);
      } else {
        m = this.maps.get('overworld')!;
      }
    }
    return m;
  }

  mapState(id: string): MapState {
    let s = this.mapStates.get(id);
    if (!s) {
      s = { opened: new Set(), respawn: {}, killedSpawns: new Set(), everKilled: new Set(), chestRestock: {}, chestRolls: {}, cleared: false };
      this.mapStates.set(id, s);
    }
    return s;
  }

  setMap(id: string): void {
    this.map = this.getMap(id);
    const st = this.mapState(id);
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.activeSpawns.clear();
    this.fx.clear();
    this.bossTarget = null;

    this.chests = this.map.chests.map((c) => ({
      id: c.id, x: c.x, y: c.y, level: c.level, tier: c.tier,
      opened: st.opened.has(c.id), fixed: c.fixed, gold: c.gold,
    }));

    // A duel does not survive leaving the map — the duellist goes back to
    // being someone sitting on a wall, and will take the rematch.
    this.duelling = null;
    this.npcs = NPCS.filter((n) => n.map === id).map((n) => new NpcEntity(n));
    for (const n of this.npcs) n.updateSchedule(this.hour);
    this.updateMusic(true);
  }

  /** Fade to black, swap the map, fade back in. */
  travel(mapId: string, x: number, y: number, label?: string): void {
    if (this.fade.pending) return;
    this.fade.target = 1;
    this.fade.label = label ?? '';
    audio.play('door', 0.7);
    this.fade.pending = () => this.doTravel(mapId, x, y);
  }

  private doTravel(mapId: string, x: number, y: number): void {
    this.setMap(mapId);
    const open = this.findStandingSpot(x, y);
    this.player.x = open.x;
    this.player.y = open.y;
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.player.invuln = Math.max(this.player.invuln, 0.8);
    this.toast(this.map.name, undefined, PAL.cloth);
    this.autosave();
    this.touch();
  }

  get hour(): number {
    return ((this.clock / DAY_SECONDS) * 24) % 24;
  }

  get timeLabel(): string {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  /** 0 at noon, 1 at midnight. */
  get nightFactor(): number {
    if (!this.map?.outdoor) return 0;
    const h = this.hour;
    if (h >= 21 || h < 5) return 1;
    if (h >= 19) return (h - 19) / 2;
    if (h < 7) return 1 - (h - 5) / 2;
    return 0;
  }

  updateMusic(force = false): void {
    let track: MusicTrack = 'world';
    if (this.screen === 'title' || this.screen === 'creation') track = 'title';
    else if (this.bossTarget && !this.bossTarget.dead) track = 'boss';
    else if (this.map.kind === 'interior') track = 'village';
    else if (this.map.kind === 'dungeon' || this.map.kind === 'cave') track = 'dungeon';
    else {
      const near = this.nearestLocation(340);
      if (near && (near.kind === 'town' || near.kind === 'village')) track = 'village';
      else if (this.map.regions) {
        const tx = Math.floor(this.player.x / TILE);
        const ty = Math.floor(this.player.y / TILE);
        const reg = this.map.regions[ty * this.map.w + tx] ?? 0;
        track = (REGION_BY_INDEX[reg]?.music ?? 'world') as MusicTrack;
      }
    }
    if (force || track !== this.lastMapMusic) {
      this.lastMapMusic = track;
      audio.playMusic(track);
    }
  }

  /** Region id under the player, used for region-locked loot. */
  /** Region id at an overworld tile, for loot and shop rolls. */
  regionIdAt(tx: number, ty: number): string | undefined {
    const world = this.getMap('overworld');
    const idx = world.regions?.[ty * world.w + tx];
    return idx === undefined ? undefined : REGION_BY_INDEX[idx]?.id;
  }

  regionAtPlayer(): string | undefined {
    if (this.map.id !== 'overworld' || !this.map.regions) {
      // inside a dungeon, inherit the region of its overworld entrance
      const loc = LOCATIONS.find((l) => l.dungeon?.mapId === this.map.id);
      return loc?.region;
    }
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);
    const idx = this.map.regions[ty * this.map.w + tx] ?? 0;
    return REGION_BY_INDEX[idx]?.id;
  }

  /**
   * World-tile coordinates to show in the HUD: the player's own position
   * outdoors, or the position of the door that leads back outside when
   * indoors (a building, dungeon or cave), since the player's position inside
   * an interior map doesn't correspond to anywhere on the world map.
   */
  worldCoords(): { x: number; y: number; isDoor: boolean } {
    if (this.map.outdoor) {
      return { x: Math.floor(this.player.x / TILE), y: Math.floor(this.player.y / TILE), isDoor: false };
    }
    const exit = this.map.portals.find((p) => p.to === 'overworld') ?? this.map.portals[0];
    if (exit) {
      return { x: Math.floor(exit.tx / TILE), y: Math.floor(exit.ty / TILE), isDoor: true };
    }
    return { x: Math.floor(this.player.x / TILE), y: Math.floor(this.player.y / TILE), isDoor: false };
  }

  nearestLocation(maxPx: number): LocationDef | null {
    if (this.map.id !== 'overworld') return null;
    let best: LocationDef | null = null;
    let bestD = maxPx;
    for (const l of LOCATIONS) {
      const d = dist(this.player.x, this.player.y, l.tx * TILE, l.ty * TILE);
      if (d < bestD) { bestD = d; best = l; }
    }
    return best;
  }

  /* ---------------- WorldCtx implementation ---------------- */

  particles(x: number, y: number, count: number, color: string, opts?: Parameters<FxSystem['spawn']>[4]): void {
    this.fx.spawn(x, y, count, color, opts);
  }

  floatText(x: number, y: number, text: string, color: string, size = 13): void {
    if (!this.settings.showDamage && /^\d/.test(text)) return;
    this.fx.text(x, y, text, color, size);
  }

  shake(amount: number): void {
    this.camera.shake = Math.min(26, this.camera.shake + amount);
  }

  /** Wash the screen in a colour for a few frames. Used sparingly, for payoffs. */
  flashScreen(color: string, alpha = 0.3): void {
    this.screenFlash.color = color;
    this.screenFlash.alpha = Math.max(this.screenFlash.alpha, alpha);
  }

  /** Freeze the world briefly so a big hit lands with weight. */
  freeze(seconds: number): void {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  playSound(name: string, volume = 1): void {
    audio.play(name, volume);
  }

  telegraph(x: number, y: number, r: number, duration: number, color: string, shape: 'circle' | 'ring' | 'cone' | 'line' = 'circle', angle = 0): void {
    this.fx.telegraph(x, y, r, duration, color, shape, angle);
  }

  ringAt(x: number, y: number, r: number, color: string): void {
    this.fx.ring(x, y, r, color);
  }

  spawnProjectile(spec: ProjectileSpec): void {
    if (this.projectiles.length > 260) this.projectiles.shift();
    this.projectiles.push(makeProjectile(spec));
  }

  summon(enemyId: string, x: number, y: number, level: number, lifetime = Infinity, friendly = false, power = 1): void {
    const open = findOpenNear(this.map, x, y, 12, 8);
    const e = new Enemy(enemyId, open.x, open.y, Math.max(1, level), { friendly });
    e.lifetime = lifetime;
    // A summoned ally is an extension of the caster, so the caster's ability
    // power is what it hits with. Without this a thrall was whatever the
    // bestiary said and nothing the player did ever improved it.
    if (power !== 1) {
      e.damage *= power;
      e.maxHp = Math.round(e.maxHp * Math.min(2.5, power));
      e.hp = e.maxHp;
    }
    this.enemies.push(e);
    this.fx.spawn(open.x, open.y, 18, friendly ? PAL.frost : PAL.arcaneLit, { speed: 120, life: 0.6, size: 3, gravity: -40 });
  }

  /**
   * What answers when the Necromancer calls. The dead you can raise get
   * better as you do — a level-70 necromancer pulling up the same two village
   * skeletons as a level-4 one is the single clearest way an ability can stop
   * mattering without ever being nerfed.
   */
  private thrallFor(level: number, legion: boolean): string {
    const ladder: Array<[number, string]> = [
      [1, 'skeleton'],
      [10, 'skeleton_archer'],
      [18, 'revenant_knight'],
      [28, 'ice_revenant'],
      [38, 'bone_colossus'],
      [52, 'jotun_thrall'],
    ];
    let pick = ladder[0][1];
    for (const [need, id] of ladder) if (level >= need) pick = id;
    // The Standing Legion reaches one rung further than Raise Thrall does.
    if (legion) {
      const idx = ladder.findIndex(([, id]) => id === pick);
      pick = ladder[Math.min(ladder.length - 1, idx + 1)][1];
    }
    return pick;
  }

  /* ---------------- aiming ---------------- */

  /** Last direction the player faced, in radians. */
  aim = 0;
  /** The enemy combat is currently locked onto, for the HUD reticle. */
  lockTarget: Enemy | null = null;

  /**
   * Everything auto-aims. Attacks and abilities snap to the best nearby enemy
   * with no pointing required; facing is only a fallback when nothing is in
   * range. Keeping this in one place means every weapon and every ability
   * behaves identically.
   */
  /**
   * How far the current weapon can actually reach. Melee gets the swing arc's
   * reach; ranged gets the distance its shot travels before expiring. Lock-on
   * is clamped to this, because pointing the reticle at something the weapon
   * cannot possibly hit is what makes a bow feel broken.
   */
  weaponReach(): number {
    const p = this.player;
    return p.isRangedWeapon() ? p.attackRange() : p.attackRange() + 18;
  }

  bestTarget(range = 0): Enemy | null {
    const p = this.player;
    // a little headroom under the true reach, so a locked target that drifts
    // outward is still inside the shot when it lands
    const lockRange = range || Math.max(p.isRangedWeapon() ? 0 : 420, this.weaponReach() * 0.92);
    let best: Enemy | null = null;
    let bestScore = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.friendly) continue;
      // Distance to the thing's EDGE, not its centre — the same measure the
      // swing itself uses. Centre-to-centre made the lock impossible on
      // anything large: a boss drawn at three times a person's height has a
      // radius of 150px, so its middle is always further away than a sword's
      // lock range and the auto-aim quietly gave up on precisely the fights
      // the game promises you never have to aim in.
      const d = Math.max(0, dist(p.x, p.y, e.x, e.y) - e.radius);
      if (d > lockRange) continue;
      // strongly prefer whatever is closest; facing is only a light tiebreak
      const off = angleBetween(this.aim, angleTo(p.x, p.y, e.x, e.y));
      const score = d * (1 + off * 0.25);
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  aimAngle(): number {
    const p = this.player;
    const target = this.bestTarget();
    if (target) {
      this.lockTarget = target;
      return angleTo(p.x, p.y, target.x, target.y);
    }
    this.lockTarget = null;
    if (this.input.hasMouse && this.input.mouseIdle < 1.2) {
      return angleTo(p.x, p.y, this.input.world.x, this.input.world.y);
    }
    return this.aim;
  }

  /** Point the ground-targeted abilities land on — the thickest nearby cluster. */
  aimPoint(range = 260): { x: number; y: number } {
    const p = this.player;
    let best: Enemy | null = null;
    let bestScore = -1;
    for (const e of this.enemies) {
      if (e.dead || e.friendly) continue;
      if (dist(p.x, p.y, e.x, e.y) > range) continue;
      // score by how many other enemies stand near this one
      let cluster = 1;
      for (const o of this.enemies) {
        if (o === e || o.dead || o.friendly) continue;
        if (dist(o.x, o.y, e.x, e.y) < 110) cluster++;
      }
      const score = cluster * 100 - dist(p.x, p.y, e.x, e.y);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (best) return { x: best.x, y: best.y };
    const a = this.aimAngle();
    return { x: p.x + Math.cos(a) * range * 0.55, y: p.y + Math.sin(a) * range * 0.55 };
  }

  /* ---------------- combat ---------------- */

  damageEnemy(target: Entity, amount: number, opts: DamageOpts = {}): void {
    const e = target as Enemy;
    if (e.dead) return;
    // An immune phase is absolute: nothing lands, no matter what is swinging.
    // Saying so on the boss rather than silently eating the hit is the whole
    // point — a player who cannot tell the difference between "warded" and
    // "my weapon is broken" will just keep hitting it.
    if (e.warded) {
      if (!opts.noProc && this.now - e.wardShown > 1.1) {
        e.wardShown = this.now;
        this.floatText(e.x, e.y - e.radius * 1.6, e.immuneLabel || 'Immune', '#8fd0f0', 13);
        this.fx.ring(e.x, e.y, e.radius * 2.2, '#8fd0f0');
        audio.play('ui', 0.3);
      }
      return;
    }
    const def = e.defense;
    let dmg = amount * (100 / (100 + Math.max(0, def)));
    // undead take extra holy damage, plants burn, constructs resist poison
    const tags = e.def.tags ?? [];
    if (opts.element === 'holy' && tags.includes('undead')) dmg *= 1.5;
    if (opts.element === 'fire' && tags.includes('plant')) dmg *= 1.4;
    if (opts.element === 'poison' && (tags.includes('construct') || tags.includes('undead'))) dmg *= 0.4;
    if (opts.element === 'frost' && tags.includes('ooze')) dmg *= 1.3;
    // Nothing born on the glacier is impressed by cold. The whole Jotunreach
    // drops frost gear, and the whole Jotunreach shrugs it off — which is the
    // one place in the game where the loot you just found is the wrong answer.
    if (tags.includes('giant')) {
      if (opts.element === 'frost') dmg *= 0.55;
      if (opts.element === 'fire') dmg *= 1.45;
    }
    dmg = Math.max(1, dmg);

    // Some fights are not allowed to be deleted. A boss with a hit cap takes
    // at most this share of its health from any single blow, so no build,
    // however absurd, can skip past the parts of the fight that make it one.
    // Everything else about the player's damage still matters: the cap is on
    // the blow, not on the swing rate, the crits or the abilities.
    const cap = e.def.boss?.hitCap;
    if (cap) {
      const ceiling = e.maxHp * cap;
      if (dmg > ceiling) {
        dmg = ceiling;
        // Say it often enough to be understood, rarely enough not to be a
        // wall of text over a fifty-second fight.
        if (!opts.noProc && this.now - e.wardShown > 2.5) {
          e.wardShown = this.now;
          this.floatText(e.x, e.y - e.radius * 1.4, 'Warded', PAL.frost, 11);
        }
      }
    }

    e.hp -= dmg;
    e.flash = 1;
    e.hurtTime = 0.18;
    if (e.state === 'idle' || e.state === 'patrol') {
      e.state = 'chase';
      e.alertTime = 5;
    }
    if (opts.knockback && opts.fromX !== undefined && opts.fromY !== undefined) {
      e.takeKnockback(opts.fromX, opts.fromY, opts.knockback);
    }

    const color = opts.crit ? '#f6bf5d' : PAL.white;
    this.floatText(e.x, e.y - e.radius * 1.6, `${Math.round(dmg)}${opts.crit ? '!' : ''}`, color, opts.crit ? 17 : 13);
    this.fx.spawn(e.x, e.y - e.radius * 0.6, opts.crit ? 10 : 5, opts.crit ? '#f6bf5d' : PAL.blood, { speed: 110, life: 0.35, size: opts.crit ? 3 : 2 });

    if (!opts.noProc) {
      audio.play(opts.crit ? 'crit' : 'hit', 0.5);
      if (opts.crit) this.hitStop = Math.max(this.hitStop, 0.045);
    }

    if (e.hp <= 0) this.killEnemy(e, opts);
  }

  private killEnemy(e: Enemy, opts: DamageOpts): void {
    e.dead = true;
    const p = this.player;
    this.fx.spawn(e.x, e.y - e.radius * 0.5, 22, PAL.blood, { speed: 140, life: 0.6, size: 3 });
    audio.play('die', 0.45);
    if (e.friendly) return;

    // kill streak — chain kills inside the window and everything escalates
    this.streak = this.now < this.streakUntil ? this.streak + 1 : 1;
    this.streakUntil = this.now + 4;
    const tier = this.streak >= 20 ? 4 : this.streak >= 12 ? 3 : this.streak >= 7 ? 2 : this.streak >= 4 ? 1 : 0;
    const STREAK_COLOR = ['#cfc7e0', '#6fd0e8', '#6fbf5a', '#9578e8', '#f0c93c'];
    const bonus = 1 + tier * 0.15;
    if (this.streak >= 3) {
      this.floatText(e.x, e.y - e.radius * 2.8, `${this.streak}x`, STREAK_COLOR[tier], 13 + tier * 3);
      audio.play('crit', Math.min(0.85, 0.35 + tier * 0.15));
    }
    if (this.streak === 4 || this.streak === 7 || this.streak === 12 || this.streak === 20) {
      this.fx.ring(p.x, p.y, 90 + tier * 30, STREAK_COLOR[tier]);
      this.fx.spawn(p.x, p.y, 16 + tier * 8, STREAK_COLOR[tier], { speed: 180, life: 0.7, size: 3, gravity: -50 });
      this.shake(3 + tier * 2);
      this.flashScreen(STREAK_COLOR[tier], 0.1 + tier * 0.03);
      this.toast(`${this.streak} kill streak`, `+${Math.round((bonus - 1) * 100)}% experience while it holds`, STREAK_COLOR[tier]);
    }

    // xp and level ups
    const xp = Math.round(e.xp * bonus);
    const levels = p.addXp(xp);
    this.floatText(e.x, e.y - e.radius * 2, `+${xp} XP`, tier > 0 ? STREAK_COLOR[tier] : '#9578e8', 12 + tier);
    if (levels > 0) {
      audio.play('levelup', 0.8);
      this.fx.ring(p.x, p.y, 120, PAL.goldLit);
      this.fx.ring(p.x, p.y, 200, PAL.goldLit);
      this.fx.spawn(p.x, p.y, 64, PAL.goldLit, { speed: 190, life: 1.1, size: 3, gravity: -60 });
      this.flashScreen(PAL.goldLit, 0.32);
      this.freeze(0.12);
      this.shake(9);
      this.floatText(p.x, p.y - 58, `LEVEL ${p.level}`, PAL.goldLit, 22);
      this.toast(`Level ${p.level}`, `+1 skill point${p.skillPoints > 1 ? ` (${p.skillPoints} unspent)` : ''}`, PAL.goldLit);
    }

    // loot
    const rng = new RNG(Math.floor(Math.random() * 1e9));
    const mf = p.stats().magicFind + (p.hasEffect('goldtouch') ? 10 : 0);
    const looting = p.enchantPower('looting') / 100;
    let gold = rng.int(e.def.gold[0], e.def.gold[1]) * (e.elite ? 3 : 1);
    gold = Math.round(gold * (1 + looting));
    if (p.hasEffect('goldtouch')) gold = Math.round(gold * 1.4);
    if (gold > 0) this.dropPickup(e.x, e.y, null, gold);
    // Ordinary enemies drop a fraction of what their definition lists.
    // Elites and bosses pay it in full — see TRASH_DROP_RATE.
    const trash = !e.elite && !e.def.boss;
    for (const d of e.def.drops) {
      const quest = TEMPLATE_BY_ID[d.item]?.type === 'quest';
      const chance = trash && !quest ? d.chance * TRASH_DROP_RATE.material : d.chance;
      if (rng.bool(chance)) {
        const qty = d.min !== undefined ? rng.int(d.min, d.max ?? d.min) : 1;
        if (qty > 0) this.dropPickup(e.x, e.y, makeItem(d.item, { qty, plain: true }), 0);
      }
    }
    // Magic find is added after the cut rather than multiplied by it, so
    // investing in it still visibly changes what a field kill pays.
    const gearChance = e.def.lootChance * (trash ? TRASH_DROP_RATE.gear : 1);
    if (rng.bool(gearChance * (1 + looting) + mf / 300)) {
      this.dropPickup(e.x, e.y, rollLoot(Math.max(1, e.level), rng, mf, e.def.lootBias ?? 0, this.regionAtPlayer()), 0);
    }
    if (e.def.boss) {
      // A duel won is a person beaten, not a dungeon cleared: they leave the
      // board, their weapon is on the ground, and they have something to say
      // about it the next time you pass.
      if (this.duelling) {
        const npc = NPC_BY_ID[this.duelling];
        if (npc?.duel?.enemy === e.def.id) {
          p.flags.add(npc.duel.wonFlag);
          this.duelling = null;
        }
      }
      const unique = makeItem(e.def.boss.uniqueDrop, { level: e.level, rng });
      this.dropPickup(e.x, e.y, unique, 0);
      p.bossesKilled.add(e.def.id);
      this.toast(`${e.def.name} defeated`, e.def.boss.title, PAL.goldLit);
      this.bossTarget = null;
      this.updateMusic(true);
      this.shake(16);
      // clearing the boss clears the dungeon — but a duel in a field does not
      // clear the overworld
      if (this.map.kind === 'dungeon' || this.map.kind === 'cave') {
        const st = this.mapState(this.map.id);
        st.cleared = true;
        for (const qid of this.quests.onClear(this.map.id)) this.questProgressToast(qid);
      }
    }

    // on-kill enchantments
    const leech = p.enchantPower('leeching');
    if (leech > 0) {
      const heal = p.maxHp * (leech / 100);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.floatText(p.x, p.y - 44, `+${Math.round(heal)}`, '#5dbf5a', 12);
    }
    const refresh = p.enchantPower('refreshment');
    if (refresh > 0) p.mp = Math.min(p.maxMp, p.mp + refresh);
    const swift = p.enchantPower('swiftfooted');
    if (swift > 0) {
      p.buffs = p.buffs.filter((b) => b.id !== 'ench_swift');
      p.buffs.push({ id: 'ench_swift', name: 'Swiftfooted', stat: 'moveSpeed', amount: p.stats().moveSpeed * (swift / 100), until: this.now + 4, color: PAL.grassPale });
    }

    // on-kill effects
    for (const id of p.effectIds()) {
      const eff = EFFECT_BY_ID[id];
      if (!eff || eff.trigger !== 'onKill') continue;
      if (!rng.bool(eff.chance)) continue;
      if (id === 'spiritcall') this.summon('wisp', e.x, e.y, Math.max(1, p.level - 2), 15, true);
      if (id === 'flowstate') {
        for (const k of Object.keys(p.cooldowns)) p.cooldowns[k] = Math.max(0, p.cooldowns[k] - 1);
      }
      if (id === 'swiftstep') {
        p.buffs = p.buffs.filter((b) => b.id !== 'swiftstep');
        p.buffs.push({ id: 'swiftstep', name: 'Swiftstep', stat: 'moveSpeed', amount: 26, until: this.now + 4, color: PAL.grassPale });
      }
    }

    // bookkeeping
    p.killCounts[e.def.id] = (p.killCounts[e.def.id] ?? 0) + 1;
    for (const qid of this.quests.onKill(e.def.id)) this.questProgressToast(qid);
    if (e.spawnId) {
      const st = this.mapState(this.map.id);
      const sp = this.map.spawns.find((s) => s.id === e.spawnId);
      if (sp) {
        st.everKilled.add(sp.id);
        if (sp.respawn === Infinity) st.killedSpawns.add(sp.id);
        else st.respawn[sp.id] = this.now + sp.respawn;
      }
      const arr = this.activeSpawns.get(e.spawnId);
      if (arr) {
        const i = arr.indexOf(e);
        if (i >= 0) arr.splice(i, 1);
      }
    }
    void opts;
    this.checkDungeonCleared();
    this.touch();
  }

  /**
   * Accepting a challenge. The person you were talking to stops being an NPC
   * and becomes the fight, standing exactly where they were standing, and the
   * boss bar comes up because that is what this is.
   *
   * Nothing is lost by losing: the duellist is rebuilt from the NPC table the
   * next time the map loads, so walking away and coming back offers the
   * rematch. Winning sets their `wonFlag`, which takes them off the board for
   * good and switches their greeting to the one they wrote for afterwards.
   */
  startDuel(npc: NpcDef | undefined): void {
    const duel = npc?.duel;
    if (!npc || !duel) return;
    const ent = this.npcs.find((n) => n.def.id === npc.id);
    const x = ent?.x ?? npc.tx * TILE;
    const y = ent?.y ?? npc.ty * TILE;
    this.npcs = this.npcs.filter((n) => n.def.id !== npc.id);
    this.dialogue = null;
    this.panel = null;

    const def = ENEMY_BY_ID[duel.enemy];
    const e = new Enemy(duel.enemy, x, y, def?.level ?? this.player.level, { boss: true });
    e.state = 'chase';
    e.alertTime = 999;
    this.enemies.push(e);
    this.bossTarget = e;
    this.duelling = npc.id;

    this.fx.ring(x, y, 120, PAL.goldLit);
    this.flashScreen(PAL.goldLit, 0.25);
    this.shake(8);
    audio.play('boss_windup', 0.7);
    this.toast(def?.name ?? npc.name, def?.boss?.title ?? 'A duel', '#f45b5b');
    this.updateMusic(true);
    this.touch();
  }

  private checkDungeonCleared(): void {
    if (this.map.kind !== 'dungeon' && this.map.kind !== 'cave') return;
    const st = this.mapState(this.map.id);
    if (st.cleared) return;
    const remaining = this.map.spawns.filter((s) => !st.everKilled.has(s.id));
    if (remaining.length === 0) {
      st.cleared = true;
      this.player.clearedDungeons.add(this.map.id);
      this.toast(`${this.map.name} cleared`, 'Nothing else moves down here.', PAL.goldLit);
      for (const qid of this.quests.onClear(this.map.id)) this.questProgressToast(qid);
    }
  }

  damagePlayer(amount: number, opts: DamageOpts = {}): void {
    const p = this.player;
    if (p.dead || this.godMode) return;
    if (p.invuln > 0) return;

    const stats = p.stats();
    // dodge
    let dodge = p.hasEffect('windward') ? 0.12 : 0;
    dodge += p.enchantPower('deflect') / 100;
    dodge += Math.min(0.15, stats.dexterity * 0.0035);
    if (Math.random() < dodge) {
      this.floatText(p.x, p.y - 30, 'Dodge', PAL.foam, 12);
      return;
    }
    if (p.hasEffect('soulbind') && Math.random() < 0.14) {
      this.floatText(p.x, p.y - 30, 'Warded', PAL.arcaneLit, 12);
      this.fx.ring(p.x, p.y, 44, PAL.arcaneLit);
      return;
    }

    let dmg = amount * damageTaken(stats.defense, p.level);
    const lastStand = p.enchantPower('final_shout');
    if (lastStand > 0 && p.hp / p.maxHp < 0.25) dmg *= 1 - lastStand / 100;
    if (p.blocking && p.equipment.offHand?.weaponKind === 'shield' && p.sp > 0) {
      dmg *= 0.35;
      p.sp = Math.max(0, p.sp - 12);
      this.fx.ring(p.x, p.y, 34, PAL.steel);
      audio.play('ui_big', 0.4);
    }
    dmg = Math.max(1, dmg);

    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed;
      dmg -= absorbed;
      this.floatText(p.x, p.y - 34, `-${Math.round(absorbed)}`, PAL.arcaneLit, 12);
    }

    if (dmg > 0) {
      p.hp -= dmg;
      p.flash = 1;
      this.floatText(p.x, p.y - 30, `-${Math.round(dmg)}`, '#f45b5b', 14);
      this.shake(Math.min(10, 2 + dmg * 0.12));
      audio.play('hurt', 0.5);
      this.lastDamageTaken = this.now;
    }
    // Invulnerability after a hit is what stops a single overlapping attack
    // from chain-killing you. At 0.45s it was also a hard cap of about two
    // hits a second no matter how many things were on you, which is why a
    // pack of six was no more dangerous than one. Short enough now that being
    // surrounded is genuinely worse than being in a duel, long enough that
    // one hit still cannot become three.
    p.invuln = PLAYER_IFRAMES;

    // thorns, from either a unique effect or the enchantment
    const thorns = (p.hasEffect('thorns') ? 25 : 0) + p.enchantPower('thorns');
    if (thorns > 0 && opts.fromX !== undefined) {
      const src = this.enemies.find((e) => !e.dead && dist(e.x, e.y, opts.fromX!, opts.fromY!) < 28);
      if (src) this.damageEnemy(src, dmg * (thorns / 100), { element: 'physical', noProc: true });
    }

    if (p.hp <= 0) this.playerDied();
    this.touch();
  }

  private playerDied(): void {
    const p = this.player;
    if (p.raceDef.perkId === 'deathless' && !p.reviveUsed) {
      p.reviveUsed = true;
      p.hp = p.maxHp * 0.35;
      p.invuln = 2.2;
      this.fx.ring(p.x, p.y, 160, PAL.frost);
      this.fx.spawn(p.x, p.y, 40, PAL.frost, { speed: 160, life: 1, size: 3, gravity: -40 });
      this.toast('Deathless', 'The grave declines to keep you.', PAL.frost);
      audio.play('levelup', 0.7);
      return;
    }
    p.dead = true;
    p.hp = 0;
    p.deaths++;
    this.screen = 'dead';
    this.shake(18);
    audio.play('die', 0.8);
    this.touch();
  }

  respawnPlayer(): void {
    const p = this.player;
    p.dead = false;
    p.reviveUsed = false;
    p.statuses = [];
    p.hp = p.maxHp * 0.6;
    p.mp = p.maxMp * 0.5;
    p.sp = p.maxSp;
    const lost = Math.floor(p.gold * 0.1);
    p.gold -= lost;
    this.screen = 'playing';
    this.setMap('overworld');
    const home = this.map.portals.find((pt) => pt.to === 'int_home');
    this.player.x = home ? home.x + home.w / 2 : VILLAGE_TX * TILE;
    this.player.y = home ? home.y + home.h + 30 : VILLAGE_TY * TILE;
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.toast('You wake in Ashvale', lost > 0 ? `Someone took ${lost} gold for the trouble.` : 'Someone carried you home.', '#9578e8');
    this.autosave();
    this.touch();
  }

  /* ---------------- pickups ---------------- */

  /** How far the player must get from a dropped item before it can be retrieved. */
  readonly dropReleaseDist = 96;

  dropPickup(x: number, y: number, item: Item | null, gold: number, byHand = false): void {
    if (!item && gold <= 0) return;
    // A good drop announces itself the instant it hits the ground, not when
    // you happen to walk over it.
    if (item && item.rarity !== 'common' && item.rarity !== 'rare') {
      const c = RARITY_COLOR[item.rarity];
      const top = item.rarity === 'legendary' || item.rarity === 'mythic';
      this.fx.ring(x, y, top ? 180 : 110, c);
      this.fx.spawn(x, y, top ? 46 : 24, c, { speed: 150, life: 1.1, size: 3, gravity: -70 });
      audio.play('quest', top ? 0.9 : 0.6);
      if (top || item.rarity === 'epic') {
        const mythic = item.rarity === 'mythic';
        this.flashScreen(c, mythic ? 0.55 : top ? 0.4 : 0.22);
        this.freeze(mythic ? 0.22 : top ? 0.16 : 0.07);
        this.shake(mythic ? 20 : top ? 14 : 7);
        this.floatText(x, y - 54, RARITY_LABEL[item.rarity].toUpperCase(), c, mythic ? 26 : top ? 22 : 17);
        if (mythic) this.fx.ring(x, y, 260, c);
      }
    }
    const a = Math.random() * Math.PI * 2;
    this.pickups.push({
      id: this.pickupId++,
      x, y,
      z: 12,
      vz: 70 + Math.random() * 40,
      vx: Math.cos(a) * 40,
      vy: Math.sin(a) * 40,
      item, gold,
      life: 180,
      needsRelease: byHand || undefined,
    });
  }

  /* ---------------- player actions ---------------- */

  basicAttack(power = false): void {
    const p = this.player;
    if (p.attackTimer > 0) return;
    const stats = p.stats();
    const staminaCost = power ? 16 : 0;
    if (power && p.sp < staminaCost) return;

    // Resources are checked before anything is committed, so a dry caster
    // doesn't burn the swing animation and its cooldown on a shot it can't
    // afford — and doesn't reprint "no mana" on every frame of a held key.
    const ranged = p.isRangedWeapon();
    const magic = ranged && p.isMagicWeapon();
    const manaCost = magic ? 4 : 0;
    if (p.mp < manaCost) {
      p.attackTimer = 0.4;
      this.floatText(p.x, p.y - 40, 'Out of mana', PAL.arcaneLit, 12);
      return;
    }
    p.sp -= staminaCost;

    const aim = this.aimAngle();
    this.aim = aim;
    p.dir = dirFromAngle(aim);
    p.anim = 'attack';
    p.animTime = 0;
    p.attackTimer = this.player.attackInterval() * (power ? 1.6 : 1);

    const mult = power ? 1.85 : 1;
    const enchMul = 1 + (ranged ? p.enchantPower('power') : p.enchantPower('sharpness')) / 100;
    const base = p.attackPower() * mult * enchMul;

    if (ranged) {
      p.mp -= manaCost;
      const pierce = enchantValue('piercing', p.enchant('piercing'));
      const multishot = p.enchantPower('multishot');
      const shots = multishot > 0 && Math.random() * 100 < multishot ? 3 : 1;
      const chainReaction = p.enchantPower('chain_reaction');
      for (let i = 0; i < shots; i++) {
        const spread = shots === 1 ? 0 : (i - 1) * 0.16;
        const roll = this.rollDamage(base * (shots > 1 ? 0.75 : 1));
        this.spawnProjectile({
          x: p.x, y: p.y - 14,
          angle: aim + spread,
          speed: magic ? 360 : 520,
          damage: roll.dmg,
          radius: magic ? 26 : 18,
          range: p.attackRange(),
          element: magic ? (p.cls === 'necromancer' ? 'shadow' : 'arcane') : 'physical',
          color: magic ? (p.cls === 'necromancer' ? PAL.toxic : PAL.arcaneLit) : PAL.cloth,
          friendly: true,
          crit: roll.crit,
          pierce,
          sprite: magic ? 'bolt' : 'arrow',
          onHitEffects: p.effectIds(),
          splash: magic ? 24 : (chainReaction > 0 && Math.random() * 100 < chainReaction ? 70 : 0),
        });
      }
      const roll = { dmg: base, crit: false };
      audio.play(magic ? 'cast' : 'shoot', 0.45);
      if (p.hasEffect('echo') && Math.random() < 0.2) {
        window.setTimeout(() => {
          if (this.screen !== 'playing') return;
          this.spawnProjectile({
            x: p.x, y: p.y - 14, angle: aim + (Math.random() - 0.5) * 0.2,
            speed: 420, damage: roll.dmg * 0.6, radius: 20, range: p.attackRange(),
            element: 'arcane', color: PAL.arcaneLit, friendly: true, sprite: 'bolt',
          });
        }, 120);
      }
    } else {
      const swirl = p.enchantPower('swirling') / 100;
      const reach = (p.attackRange() + 18) * (1 + swirl);
      const baseArc = SWING_ARC[p.weaponKind()] ?? DEFAULT_SWING_ARC;
      // a heavy attack commits to a wider cut than a quick one
      const arc = baseArc * (power ? 1.3 : 1) * (1 + swirl * 0.6);
      const committed = p.enchantPower('committed') / 100;
      this.fx.telegraph(p.x, p.y, reach, 0.14, withTint(p), 'cone', aim);
      audio.play('swing', 0.4);
      let hits = 0;
      for (const e of this.enemies) {
        if (e.dead || e.friendly) continue;
        const d = dist(p.x, p.y, e.x, e.y);
        if (d > reach + e.radius) continue;
        if (angleBetween(aim, angleTo(p.x, p.y, e.x, e.y)) > arc / 2) continue;
        const wounded = committed > 0 && e.hp / e.maxHp < 0.5 ? 1 + committed : 1;
        const roll = this.rollDamage(base * wounded);
        this.damageEnemy(e, roll.dmg, { element: 'physical', crit: roll.crit, knockback: power ? 220 : 110, fromX: p.x, fromY: p.y });
        this.applyHitEffects(e, roll.dmg, roll.crit);
        hits++;
      }
      if (hits > 0) {
        this.hitStop = Math.max(this.hitStop, power ? 0.06 : 0.03);
        this.shake(power ? 5 : 2);
      }
      if (power) this.fx.spawn(p.x + Math.cos(aim) * 30, p.y + Math.sin(aim) * 30, 10, PAL.cloth, { speed: 140, life: 0.3, size: 2, angle: aim, spread: 1.4 });
    }
    void stats;
  }

  rollDamage(base: number): { dmg: number; crit: boolean } {
    const s = this.player.stats();
    const crit = Math.random() * 100 < s.critChance;
    const dmg = base * (crit ? 1 + s.critDamage / 100 : 1) * (0.92 + Math.random() * 0.16);
    return { dmg, crit };
  }

  applyHitEffects(target: Enemy, dmg: number, crit: boolean): void {
    const p = this.player;
    const stats = p.stats();

    // rolled enchantments
    const fire = p.enchantPower('fire_aspect') + p.enchantPower('ember_focus');
    if (fire > 0 && Math.random() * 100 < fire) {
      target.applyStatusFrom('burn', dmg * 0.4, 4, PAL.flame, this.now);
      this.fx.spawn(target.x, target.y - target.radius, 5, PAL.flame, { speed: 55, life: 0.4, size: 2, gravity: -60 });
    }
    const frost = p.enchantPower('freezing') + p.enchantPower('frost_focus');
    if (frost > 0 && Math.random() * 100 < frost) {
      target.applyStatusFrom('chill', 0.5, 3.5, PAL.frost, this.now);
      this.fx.spawn(target.x, target.y - target.radius, 5, PAL.frost, { speed: 55, life: 0.4, size: 2, gravity: -30 });
    }
    const venom = p.enchantPower('venomous');
    if (venom > 0 && Math.random() * 100 < venom) {
      target.applyStatusFrom('poison', dmg * 0.3, 6, PAL.toxic, this.now);
    }
    const shock = p.enchantPower('shockwave');
    if (shock > 0 && Math.random() * 100 < shock) {
      this.fx.ring(target.x, target.y, 110, PAL.clay);
      this.shake(5);
      for (const o of this.enemies) {
        if (o.dead || o.friendly || dist(o.x, o.y, target.x, target.y) > 110) continue;
        this.damageEnemy(o, dmg * 0.5, { element: 'physical', noProc: true, knockback: 140, fromX: target.x, fromY: target.y });
        o.applyStatusFrom('stun', 1, 0.8, PAL.clay, this.now);
      }
    }
    const chains = p.enchantPower('chains');
    if (chains > 0 && Math.random() * 100 < chains) {
      for (const o of this.enemies) {
        if (o.dead || o.friendly || dist(o.x, o.y, target.x, target.y) > 130) continue;
        o.applyStatusFrom('stun', 1, 1.1, PAL.iron, this.now);
        this.fx.spawn(o.x, o.y, 4, PAL.iron, { speed: 40, life: 0.4, size: 2 });
      }
    }
    if (stats.lifesteal > 0) {
      const heal = dmg * (stats.lifesteal / 100);
      p.hp = Math.min(p.maxHp, p.hp + heal);
    }
    for (const id of p.effectIds()) {
      const eff = EFFECT_BY_ID[id];
      if (!eff) continue;
      if (eff.trigger === 'onHit' && Math.random() < eff.chance) {
        switch (id) {
          case 'burning_edge':
            target.applyStatusFrom('burn', dmg * eff.power, 4, PAL.flame, this.now);
            this.fx.spawn(target.x, target.y - target.radius, 6, PAL.flame, { speed: 60, life: 0.4, size: 2, gravity: -60 });
            break;
          case 'frostbite':
            target.applyStatusFrom('chill', 0.4, 3, PAL.frost, this.now);
            this.fx.spawn(target.x, target.y - target.radius, 6, PAL.frost, { speed: 60, life: 0.4, size: 2, gravity: -30 });
            break;
          case 'venomous':
            target.applyStatusFrom('poison', dmg * eff.power, 6, PAL.toxic, this.now);
            break;
          case 'stormcaller': {
            let chained = 0;
            for (const other of this.enemies) {
              if (other === target || other.dead || other.friendly || chained >= 3) continue;
              if (dist(other.x, other.y, target.x, target.y) > 190) continue;
              chained++;
              this.damageEnemy(other, dmg * eff.power, { element: 'arcane', noProc: true });
              this.fx.spawn(other.x, other.y, 8, '#8fd0f0', { speed: 100, life: 0.3, size: 2 });
            }
            break;
          }
          case 'emberburst':
            this.fx.ring(target.x, target.y, 60, PAL.ember);
            for (const other of this.enemies) {
              if (other.dead || other.friendly) continue;
              if (dist(other.x, other.y, target.x, target.y) < 60) {
                this.damageEnemy(other, dmg * eff.power * 0.6, { element: 'fire', noProc: true });
              }
            }
            break;
          default:
            break;
        }
      }
      if (crit && eff.trigger === 'onCrit' && Math.random() < eff.chance) {
        if (id === 'vampiric') {
          p.hp = Math.min(p.maxHp, p.hp + dmg * eff.power);
          this.floatText(p.x, p.y - 40, `+${Math.round(dmg * eff.power)}`, '#6fbf5a', 12);
        }
        if (id === 'sunflare') {
          this.fx.ring(target.x, target.y, 80, PAL.holy);
          for (const other of this.enemies) {
            if (other.dead || other.friendly) continue;
            if (dist(other.x, other.y, target.x, target.y) < 80) this.damageEnemy(other, dmg * eff.power, { element: 'holy', noProc: true });
          }
        }
        if (id === 'earthshaker') {
          this.fx.ring(target.x, target.y, 90, PAL.clay);
          this.shake(6);
          for (const other of this.enemies) {
            if (other.dead || other.friendly) continue;
            if (dist(other.x, other.y, target.x, target.y) < 90) {
              this.damageEnemy(other, dmg * eff.power * 0.5, { element: 'physical', noProc: true });
              other.applyStatusFrom('stun', 1, 0.7, PAL.clay, this.now);
            }
          }
        }
      }
    }
  }

  useAbility(index: number): void {
    const p = this.player;
    const ab = p.abilities[index];
    if (!ab) return;
    const cd = p.cooldowns[ab.id] ?? 0;
    if (cd > 0) {
      this.floatText(p.x, p.y - 44, 'Not ready', PAL.fog, 11);
      return;
    }
    if (p.mp < ab.mana) {
      this.floatText(p.x, p.y - 44, 'Not enough mana', '#6f9ce8', 11);
      return;
    }
    if (p.sp < ab.stamina) {
      this.floatText(p.x, p.y - 44, 'Not enough stamina', '#8fbf4a', 11);
      return;
    }
    p.mp -= ab.mana;
    p.sp -= ab.stamina;
    p.cooldowns[ab.id] = p.cooldownFor(ab);

    const stats = p.stats();
    const power = p.attackPower() * ab.power * (1 + stats.abilityPower / 100);
    const aim = this.aimAngle();
    this.aim = aim;
    p.dir = dirFromAngle(aim);
    p.anim = ab.shape === 'projectile' || ab.shape === 'ground' || ab.shape === 'buff' || ab.shape === 'heal' || ab.shape === 'shield' || ab.shape === 'summon' ? 'cast' : 'attack';
    p.animTime = 0;

    switch (ab.shape) {
      case 'melee_arc': {
        const r = ab.radius ?? 80;
        this.fx.telegraph(p.x, p.y, r, 0.18, ab.color, 'cone', aim);
        this.fx.spawn(p.x + Math.cos(aim) * 30, p.y + Math.sin(aim) * 30, 16, ab.color, { speed: 200, life: 0.35, size: 3, angle: aim, spread: 1.6 });
        for (const e of this.enemies) {
          if (e.dead || e.friendly) continue;
          const d = dist(p.x, p.y, e.x, e.y);
          if (d > r + e.radius) continue;
          if (ab.id !== 'assassinate' && angleBetween(aim, angleTo(p.x, p.y, e.x, e.y)) > 0.95) continue;
          const roll = ab.id === 'assassinate' ? { dmg: power * (1 + stats.critDamage / 100), crit: true } : this.rollDamage(power);
          this.damageEnemy(e, roll.dmg, { element: ab.element, crit: roll.crit, knockback: 180, fromX: p.x, fromY: p.y });
          this.applyHitEffects(e, roll.dmg, roll.crit);
        }
        this.shake(5);
        break;
      }
      case 'dash': {
        const range = ab.range ?? 200;
        p.dashVx = Math.cos(aim) * range * 3.2;
        p.dashVy = Math.sin(aim) * range * 3.2;
        p.dashTimer = 0.22;
        p.invuln = Math.max(p.invuln, 0.3);
        this.fx.spawn(p.x, p.y, 18, ab.color, { speed: 90, life: 0.4, size: 3 });
        if (ab.power > 0) {
          const hit = new Set<number>();
          const steps = 8;
          for (let i = 1; i <= steps; i++) {
            const hx = p.x + Math.cos(aim) * (range * i / steps);
            const hy = p.y + Math.sin(aim) * (range * i / steps);
            for (const e of this.enemies) {
              if (e.dead || e.friendly || hit.has(e.id)) continue;
              if (dist(hx, hy, e.x, e.y) < 46 + e.radius) {
                hit.add(e.id);
                const roll = this.rollDamage(power);
                this.damageEnemy(e, roll.dmg, { element: ab.element, crit: roll.crit, knockback: 240, fromX: p.x, fromY: p.y });
                this.applyHitEffects(e, roll.dmg, roll.crit);
              }
            }
          }
        }
        break;
      }
      case 'projectile': {
        const roll = this.rollDamage(power);
        this.spawnProjectile({
          x: p.x, y: p.y - 14, angle: aim, speed: 430, damage: roll.dmg,
          radius: ab.radius ?? 40, range: ab.range ?? 420, element: ab.element ?? 'arcane',
          color: ab.color, friendly: true, crit: roll.crit, splash: ab.radius ?? 40,
          pierce: ab.id === 'boltshadow' ? 2 : 0, sprite: 'bolt', onHitEffects: p.effectIds(),
        });
        break;
      }
      case 'multishot': {
        const count = ab.count ?? 5;
        const full = ab.id === 'fanofknives';
        for (let i = 0; i < count; i++) {
          const a = full ? (i / count) * Math.PI * 2 : aim + (i / Math.max(1, count - 1) - 0.5) * 0.75;
          const roll = this.rollDamage(power);
          this.spawnProjectile({
            x: p.x, y: p.y - 12, angle: a, speed: 480, damage: roll.dmg,
            radius: 22, range: ab.range ?? 380, element: ab.element ?? 'physical',
            color: ab.color, friendly: true, crit: roll.crit, sprite: full ? 'shard' : 'arrow',
            onHitEffects: p.effectIds(),
          });
        }
        break;
      }
      case 'nova': {
        const r = ab.radius ?? 130;
        this.fx.ring(p.x, p.y, r, ab.color);
        this.fx.spawn(p.x, p.y, 34, ab.color, { speed: 230, life: 0.55, size: 3 });
        this.shake(6);
        let healed = 0;
        for (const e of this.enemies) {
          if (e.dead || e.friendly) continue;
          if (dist(p.x, p.y, e.x, e.y) > r + e.radius) continue;
          const roll = this.rollDamage(power);
          this.damageEnemy(e, roll.dmg, { element: ab.element, crit: roll.crit, knockback: 150, fromX: p.x, fromY: p.y });
          this.applyHitEffects(e, roll.dmg, roll.crit);
          if (ab.element === 'frost') e.applyStatusFrom('chill', 0.45, ab.duration ?? 4, PAL.frost, this.now);
          if (ab.id === 'drain') healed += roll.dmg * 0.3;
        }
        if (healed > 0) {
          p.hp = Math.min(p.maxHp, p.hp + healed);
          this.floatText(p.x, p.y - 44, `+${Math.round(healed)}`, '#6fbf5a', 13);
        }
        break;
      }
      case 'ground': {
        const maxRange = 320;
        const pt = this.aimPoint(maxRange);
        const gx = pt.x;
        const gy = pt.y;
        const r = ab.radius ?? 110;
        const duration = ab.duration ?? 4;
        this.fx.telegraph(gx, gy, r, 0.65, ab.color, 'circle');
        this.groundZones.push({
          x: gx, y: gy, r, until: this.now + 0.65 + duration, next: this.now + 0.65,
          dps: power / Math.max(1, duration) * (ab.id === 'meteor' ? duration : 1.2),
          element: ab.element ?? 'physical', color: ab.color, burst: ab.id === 'meteor' || ab.id === 'rain',
          delay: 0.65,
        });
        break;
      }
      case 'buff': {
        const dur = ab.duration ?? 8;
        p.buffs = p.buffs.filter((b) => b.id !== ab.id);
        if (ab.id === 'warcry') {
          p.buffs.push({ id: ab.id, name: ab.name, stat: 'abilityPower', amount: 30, until: this.now + dur, color: ab.color });
          p.buffs.push({ id: `${ab.id}_def`, name: ab.name, stat: 'defense', amount: 25, until: this.now + dur, color: ab.color });
        } else if (ab.id === 'venom') {
          p.buffs.push({ id: ab.id, name: ab.name, stat: 'critChance', amount: 25, until: this.now + dur, color: ab.color });
          p.flags.add('venom_blades');
          window.setTimeout(() => p.flags.delete('venom_blades'), dur * 1000);
        }
        this.fx.ring(p.x, p.y, 70, ab.color);
        this.floatText(p.x, p.y - 44, ab.name, ab.color, 13);
        break;
      }
      case 'heal': {
        // A heal must be a share of the health bar, never a multiple of
        // attack power. Tied to damage it scaled with the weapon and the
        // primary stat and the talents all at once, which is how Mend ended
        // up restoring forty thousand health: more than any boss in the game
        // could remove, so the Paladin simply could not lose a fight.
        //
        // As a fraction it is worth exactly as much at level 3 as at level
        // 75 — which is the only way "scales with progression" can mean
        // anything for a heal. Ability power still improves it, and the cap
        // stops that from becoming the old problem in a new hat.
        const frac = Math.min(0.62, 0.3 * (1 + stats.abilityPower / 260));
        const heal = p.maxHp * frac;
        p.hp = Math.min(p.maxHp, p.hp + heal);
        this.floatText(p.x, p.y - 40, `+${Math.round(heal)}`, '#6fbf5a', 15);
        this.fx.spawn(p.x, p.y, 26, PAL.holy, { speed: 90, life: 0.8, size: 3, gravity: -110 });
        audio.play('heal', 0.6);
        break;
      }
      case 'shield': {
        // Same reasoning as the heal above: a share of the bar, not a
        // multiple of the weapon.
        p.shield = p.maxHp * Math.min(0.7, 0.34 * (1 + stats.abilityPower / 240));
        p.shieldUntil = this.now + (ab.duration ?? 10);
        this.fx.ring(p.x, p.y, 60, ab.color);
        this.floatText(p.x, p.y - 44, `Shield ${Math.round(p.shield)}`, ab.color, 13);
        break;
      }
      case 'summon': {
        // Two plain skeletons at the player's level was the whole of Raise
        // Thrall at every level of the game, which is why the Necromancer's
        // second ability felt like nothing next to a Paladin's. A thrall now
        // scales twice over: WHAT gets raised climbs with the caster, and how
        // hard it hits rides the caster's ability power like every other
        // ability in the game.
        const n = ab.count ?? 2;
        const id = this.thrallFor(p.level, ab.id === 'legion');
        const lv = Math.max(1, Math.round(p.level + (ab.id === 'legion' ? 2 : 0)));
        const boost = 1 + stats.abilityPower / 100;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.summon(id, p.x + Math.cos(a) * 54, p.y + Math.sin(a) * 54, lv, ab.duration ?? 20, true, boost * ab.power);
        }
        this.fx.ring(p.x, p.y, 80, ab.color);
        break;
      }
    }
    audio.play(ab.shape === 'heal' || ab.shape === 'shield' ? 'heal' : 'cast', 0.5);
    this.touch();
  }

  groundZones: Array<{ x: number; y: number; r: number; until: number; next: number; dps: number; element: AbilityDef['element']; color: string; burst: boolean; delay: number }> = [];

  /** Off-hand action: shields block (held), everything else has a quick use. */
  useOffhand(): void {
    const p = this.player;
    const off = p.equipment.offHand;
    if (!off) {
      this.useQuickItem();
      return;
    }
    if (p.offhandCooldown > 0) {
      this.floatText(p.x, p.y - 44, 'Not ready', PAL.fog, 11);
      return;
    }
    const aim = this.aimAngle();
    this.aim = aim;
    p.dir = dirFromAngle(aim);
    p.anim = 'cast';
    p.animTime = 0;

    if (off.weaponKind === 'tome') {
      if (p.mp < 12) {
        this.floatText(p.x, p.y - 44, 'Not enough mana', '#6f9ce8', 11);
        return;
      }
      p.mp -= 12;
      p.offhandCooldown = 1.4;
      const roll = this.rollDamage(p.attackPower() * 0.9);
      this.spawnProjectile({
        x: p.x, y: p.y - 14, angle: aim, speed: 380, damage: roll.dmg, radius: 30,
        range: 360, element: 'arcane', color: PAL.arcaneLit, friendly: true, crit: roll.crit,
        splash: 26, sprite: 'bolt', onHitEffects: p.effectIds(),
      });
      audio.play('cast', 0.5);
      return;
    }
    if (off.icon === 'torch_item') {
      p.offhandCooldown = 6;
      const pt = this.aimPoint(200);
      this.groundZones.push({
        x: pt.x, y: pt.y, r: 70, until: this.now + 4.4, next: this.now + 0.4,
        dps: p.attackPower() * 0.7, element: 'fire', color: PAL.flame, burst: false, delay: 0.4,
      });
      this.fx.ring(pt.x, pt.y, 70, PAL.flame);
      audio.play('cast', 0.5);
      return;
    }
    this.useQuickItem();
  }

  /** Artifact power, bound to R. */
  /**
   * The signature move of a weapon that has one. Two relics carry these, and
   * they are deliberately not class abilities: they belong to the object, so
   * picking the axe up changes how you fight rather than how hard you hit.
   */
  useWeaponPower(): void {
    const p = this.player;
    const item = p.equipment.mainHand;
    const power = item?.weaponPower;
    if (!power) {
      this.floatText(p.x, p.y - 44, 'This weapon has no art', PAL.fog, 11);
      return;
    }
    if (p.weaponPowerCooldown > 0) {
      this.floatText(p.x, p.y - 44, `${Math.ceil(p.weaponPowerCooldown)}s`, PAL.fog, 11);
      return;
    }
    const cdr = Math.min(60, p.stats().cooldownReduction);
    p.weaponPowerCooldown = power.cooldown * (1 - cdr / 100);
    const base = p.attackPower() * (1 + p.stats().abilityPower / 100);
    const aim = this.aimAngle();
    this.aim = aim;
    p.dir = dirFromAngle(aim);
    p.anim = 'attack';
    p.animTime = 0;
    this.floatText(p.x, p.y - 48, power.name, item!.glow ?? PAL.goldLit, 14);

    switch (power.id) {
      case 'leviathan_throw': {
        // Out along a line, and back along the same line. Everything in the
        // corridor is hit twice and left chilled, which is the whole reason
        // to throw an axe you could simply be swinging.
        const range = 520;
        const halfWidth = 46;
        const hit = (mul: number) => {
          for (const e of this.enemies) {
            if (e.dead || e.friendly) continue;
            const dx = e.x - p.x;
            const dy = e.y - p.y;
            const along = dx * Math.cos(aim) + dy * Math.sin(aim);
            const across = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
            if (along < -20 || along > range || across > halfWidth + e.radius) continue;
            const roll = this.rollDamage(base * mul);
            this.damageEnemy(e, roll.dmg, {
              element: 'frost', crit: roll.crit, knockback: 120, fromX: p.x, fromY: p.y,
            });
            applyStatus(e, 'chill', 0.5, 4, PAL.frost, this.now);
            this.applyHitEffects(e, roll.dmg, roll.crit);
          }
        };
        const tipX = p.x + Math.cos(aim) * range;
        const tipY = p.y + Math.sin(aim) * range;
        this.fx.telegraph(p.x, p.y, range, 0.12, PAL.frost, 'line', aim);
        this.fx.spawn(tipX, tipY, 26, PAL.frost, { speed: 180, life: 0.7, size: 3 });
        this.fx.ring(tipX, tipY, 90, PAL.ice);
        audio.play('swing', 0.7);
        this.shake(6);
        hit(1.25);
        // and the return, a beat later
        window.setTimeout(() => {
          if (this.screen !== 'playing') return;
          this.fx.telegraph(p.x, p.y, range, 0.12, PAL.ice, 'line', aim);
          this.fx.spawn(p.x, p.y, 20, PAL.frost, { speed: 150, life: 0.5, size: 3 });
          audio.play('hit', 0.6);
          hit(0.9);
          this.touch();
        }, 420);
        break;
      }
      case 'chaos_chains': {
        // Catch everything in a wide ring, drag it to your feet, and light the
        // floor. It is a gap-closer that closes the gap in the other
        // direction — which is exactly what the chains are for.
        const reach = 300;
        this.fx.ring(p.x, p.y, reach, PAL.ember);
        this.fx.ring(p.x, p.y, reach * 0.6, PAL.flame);
        this.fx.spawn(p.x, p.y, 40, PAL.flame, { speed: 260, life: 0.8, size: 4 });
        this.flashScreen(PAL.ember, 0.18);
        this.shake(9);
        audio.play('swing', 0.8);
        let caught = 0;
        for (const e of this.enemies) {
          if (e.dead || e.friendly) continue;
          const d = dist(p.x, p.y, e.x, e.y);
          if (d > reach + e.radius) continue;
          const roll = this.rollDamage(base * 1.25);
          this.damageEnemy(e, roll.dmg, { element: 'fire', crit: roll.crit, fromX: p.x, fromY: p.y });
          applyStatus(e, 'burn', base * 0.22, 6, PAL.flame, this.now);
          this.applyHitEffects(e, roll.dmg, roll.crit);
          // hauled in, but never through a wall and never right on top of you
          if (!e.isBoss && d > 70) {
            const a = angleTo(e.x, e.y, p.x, p.y);
            const tx = e.x + Math.cos(a) * (d - 64);
            const ty = e.y + Math.sin(a) * (d - 64);
            if (!boxHitsTerrain(this.map, tx, ty, e.radius * 0.7, e.radius * 0.5)) {
              e.x = tx;
              e.y = ty;
              this.fx.spawn(tx, ty, 10, PAL.ember, { speed: 90, life: 0.4, size: 2 });
            }
          }
          caught++;
        }
        if (caught) this.hitStop = Math.max(this.hitStop, 0.07);
        break;
      }
    }
    this.touch();
  }

  useArtifact(): void {
    const p = this.player;
    const item = p.equipment.accessory;
    if (!item?.artifact) {
      this.floatText(p.x, p.y - 44, 'No artifact equipped', PAL.fog, 11);
      return;
    }
    if (p.artifactCooldown > 0) {
      this.floatText(p.x, p.y - 44, `${Math.ceil(p.artifactCooldown)}s`, PAL.fog, 11);
      return;
    }
    const potency = 1 + p.enchantPower('potency') / 100;
    const cdr = Math.min(60, p.stats().cooldownReduction);
    p.artifactCooldown = item.artifact.cooldown * (1 - cdr / 100);
    const power = p.attackPower() * potency;
    const aim = this.aimAngle();
    p.anim = 'cast';
    p.animTime = 0;
    this.floatText(p.x, p.y - 48, item.artifact.name, PAL.goldLit, 13);
    audio.play('cast', 0.6);

    switch (item.artifact.id) {
      case 'heal_burst': {
        const heal = p.maxHp * 0.33 * potency;
        p.hp = Math.min(p.maxHp, p.hp + heal);
        this.floatText(p.x, p.y - 34, `+${Math.round(heal)}`, '#5dbf5a', 15);
        this.fx.spawn(p.x, p.y, 28, PAL.holy, { speed: 90, life: 0.9, size: 3, gravity: -110 });
        audio.play('heal', 0.7);
        break;
      }
      case 'fire_nova': {
        const r = 150;
        this.fx.ring(p.x, p.y, r, PAL.flame);
        this.fx.spawn(p.x, p.y, 40, PAL.flame, { speed: 250, life: 0.65, size: 4 });
        this.shake(8);
        for (const e of this.enemies) {
          if (e.dead || e.friendly || dist(p.x, p.y, e.x, e.y) > r + e.radius) continue;
          this.damageEnemy(e, power * 2.2, { element: 'fire', knockback: 170, fromX: p.x, fromY: p.y });
          e.applyStatusFrom('burn', power * 0.3, 4, PAL.flame, this.now);
        }
        break;
      }
      case 'speed_burst':
        p.buffs = p.buffs.filter((b) => b.id !== 'art_speed');
        p.buffs.push({ id: 'art_speed', name: 'Quickened', stat: 'moveSpeed', amount: 70 * potency, until: this.now + 6, color: PAL.grassPale });
        this.fx.ring(p.x, p.y, 60, PAL.grassPale);
        break;
      case 'summon_wolf':
        this.summon('direwolf', p.x + 40, p.y, Math.max(1, p.level), 24, true);
        break;
      case 'ward':
        p.shield = power * 4 * potency;
        p.shieldUntil = this.now + 12;
        this.fx.ring(p.x, p.y, 62, PAL.steel);
        break;
      case 'frenzy':
        p.buffs = p.buffs.filter((b) => b.id !== 'art_frenzy' && b.id !== 'art_frenzy_dmg');
        p.buffs.push({ id: 'art_frenzy', name: 'Frenzy', stat: 'attackSpeed', amount: 55 * potency, until: this.now + 8, color: PAL.toxic });
        p.buffs.push({ id: 'art_frenzy_dmg', name: 'Frenzy', stat: 'abilityPower', amount: 30 * potency, until: this.now + 8, color: PAL.toxic });
        this.fx.ring(p.x, p.y, 60, PAL.toxic);
        break;
      case 'blink': {
        const range = 260;
        const tx = p.x + Math.cos(aim) * range;
        const ty = p.y + Math.sin(aim) * range;
        this.fx.spawn(p.x, p.y, 24, PAL.frost, { speed: 130, life: 0.5, size: 3 });
        if (!boxHitsTerrain(this.map, tx, ty, p.radius * 0.7, p.radius * 0.5)) {
          p.x = tx;
          p.y = ty;
        }
        this.fx.ring(p.x, p.y, 90, PAL.frost);
        for (const e of this.enemies) {
          if (e.dead || e.friendly || dist(p.x, p.y, e.x, e.y) > 90) continue;
          this.damageEnemy(e, power * 1.2, { element: 'arcane', knockback: 150, fromX: p.x, fromY: p.y });
          e.applyStatusFrom('stun', 1, 1.2, PAL.frost, this.now);
        }
        p.invuln = Math.max(p.invuln, 0.4);
        break;
      }
      case 'beam': {
        const len = 420;
        for (let i = 1; i <= 14; i++) {
          const bx = p.x + Math.cos(aim) * (len * i / 14);
          const by = p.y + Math.sin(aim) * (len * i / 14);
          this.fx.spawn(bx, by, 3, PAL.arcaneLit, { speed: 40, life: 0.45, size: 3, gravity: 0 });
        }
        for (const e of this.enemies) {
          if (e.dead || e.friendly) continue;
          const d = dist(p.x, p.y, e.x, e.y);
          if (d > len) continue;
          if (angleBetween(aim, angleTo(p.x, p.y, e.x, e.y)) > 0.28) continue;
          this.damageEnemy(e, power * 2.6, { element: 'arcane', knockback: 60, fromX: p.x, fromY: p.y });
        }
        this.shake(7);
        break;
      }
      case 'soul_burst': {
        const r = 180;
        this.fx.ring(p.x, p.y, r, PAL.toxic);
        let healed = 0;
        for (const e of this.enemies) {
          if (e.dead || e.friendly || dist(p.x, p.y, e.x, e.y) > r + e.radius) continue;
          this.damageEnemy(e, power * 2 * potency, { element: 'shadow', knockback: 120, fromX: p.x, fromY: p.y });
          healed += power * 0.25;
        }
        p.hp = Math.min(p.maxHp, p.hp + healed);
        break;
      }
      case 'time_fold': {
        const r = 300;
        this.fx.ring(p.x, p.y, r, PAL.frost);
        this.shake(10);
        for (const e of this.enemies) {
          if (e.dead || e.friendly || dist(p.x, p.y, e.x, e.y) > r) continue;
          e.applyStatusFrom('stun', 1, 4 * potency, PAL.frost, this.now);
        }
        break;
      }
      case 'rally': {
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
        p.buffs = p.buffs.filter((b) => b.id !== 'art_rally');
        p.buffs.push({ id: 'art_rally', name: "King's Rally", stat: 'strength', amount: 16 * potency, until: this.now + 14, color: PAL.holy });
        this.fx.ring(p.x, p.y, 140, PAL.holy);
        this.fx.spawn(p.x, p.y, 36, PAL.holy, { speed: 140, life: 1, size: 3, gravity: -60 });
        audio.play('levelup', 0.6);
        break;
      }
      default:
        break;
    }
    this.touch();
  }

  useQuickItem(): void {
    const p = this.player;
    const target = p.inventory.find((i) => i.type === 'consumable' && (p.quickItem ? i.defId === p.quickItem : true))
      ?? p.inventory.find((i) => i.type === 'consumable');
    if (!target) {
      this.floatText(p.x, p.y - 44, 'No potions', PAL.fog, 11);
      return;
    }
    this.useItem(target.uid);
  }

  useItem(uid: string): void {
    const p = this.player;
    const item = p.inventory.find((i) => i.uid === uid);
    if (!item || !item.consume) return;
    const c = item.consume;
    if (c.health) p.hp = Math.min(p.maxHp, p.hp + c.health);
    if (c.healthPct) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * c.healthPct);
    if (c.mana) p.mp = Math.min(p.maxMp, p.mp + c.mana);
    if (c.stamina) p.sp = Math.min(p.maxSp, p.sp + c.stamina);
    if (c.cure) p.statuses = [];
    if (c.buff) {
      p.buffs = p.buffs.filter((b) => b.id !== `item_${item.defId}`);
      p.buffs.push({ id: `item_${item.defId}`, name: c.buff.name, stat: c.buff.stat, amount: c.buff.amount, until: this.now + c.buff.duration, color: PAL.flameLit });
    }
    removeItem(p.inventory, uid, 1);
    this.fx.spawn(p.x, p.y - 10, 12, '#6fbf5a', { speed: 70, life: 0.6, size: 2, gravity: -80 });
    audio.play('drink', 0.6);
    this.touch();
  }

  /* ---------------- items / shops ---------------- */

  giveItem(templateId: string, qty = 1, level?: number): void {
    const item = makeItem(templateId, { qty, level, plain: true });
    if (!addItem(this.player.inventory, item)) {
      this.toast('Bag full', 'Some loot was left behind.', '#e8763a');
      return;
    }
    this.toast(`+ ${item.name}${qty > 1 ? ` x${qty}` : ''}`, undefined, RARITY_COLOR[item.rarity], item.icon);
  }

  equipItem(uid: string): void {
    const item = this.player.inventory.find((i) => i.uid === uid);
    if (!item) return;
    const res = equip(this.player, item);
    if (!res.ok) this.toast('Cannot equip', res.reason, '#e8763a');
    else audio.play('ui_big', 0.5);
    this.touch();
  }

  unequipSlot(slot: EquipSlot): void {
    if (!unequip(this.player, slot)) this.toast('Bag full', 'Make room first.', '#e8763a');
    else audio.play('ui', 0.5);
    this.touch();
  }

  dropItem(uid: string): void {
    const item = removeItem(this.player.inventory, uid, 999);
    if (!item) return;
    // thrown clear of the player, and inert long enough to walk away from
    const a = this.aim + Math.PI * (0.75 + Math.random() * 0.5);
    this.dropPickup(this.player.x + Math.cos(a) * 34, this.player.y + 12 + Math.sin(a) * 18, item, 0, true);
    this.toast(`Dropped ${item.name}`, 'Step away and it will stay put.', PAL.fog, item.icon);
    audio.play('ui', 0.5);
    this.touch();
  }

  /**
   * What a merchant would pay, times this. Scrapping something in the field
   * is convenience, not commerce: you get roughly half what the same item is
   * worth over a counter, so clearing junk on the road is always an option
   * and hauling the good stuff back to a shop is always worth the walk.
   */
  readonly scrapRate = 0.5;

  /** True while the pack cannot take another item. Drives the HUD marker. */
  get bagFull(): boolean {
    return this.player.inventory.length >= MAX_SLOTS;
  }

  /** Gold a quick sell would pay for this item, whole stack included. */
  scrapValue(item: Item): number {
    return Math.max(1, Math.round(sellValue(item, 1) * this.scrapRate));
  }

  /** Sell straight out of the pack, no merchant required. */
  scrapItem(uid: string): boolean {
    const p = this.player;
    const held = p.inventory.find((i) => i.uid === uid);
    if (!held) return false;
    if (held.type === 'quest') {
      this.toast('Not for sale', 'Quest items stay in the pack.', '#d9553f');
      return false;
    }
    const paid = this.scrapValue(held);
    const item = removeItem(p.inventory, uid, 999);
    if (!item) return false;
    p.gold += paid;
    this.floatText(p.x, p.y - 40, `+${paid}g`, PAL.goldLit, 13);
    this.toast(`Sold ${item.name}`, `${paid} gold — half of what a merchant pays.`, PAL.gold, 'gold');
    audio.play('gold', 0.55);
    this.touch();
    return true;
  }

  /**
   * "Junk" is common and rare gear sitting in the pack. Anything SuperRare or
   * better, anything equipped, and every potion, material and quest item is
   * left alone — clearing the bag should never be the thing that loses you a
   * drop you meant to keep.
   */
  junkInPack(): Item[] {
    return this.player.inventory.filter(
      (i) => !i.important
        && (i.type === 'weapon' || i.type === 'armor' || i.type === 'accessory')
        && (i.rarity === 'common' || i.rarity === 'rare'),
    );
  }

  /**
   * Everything in the pack a bulk sell would take. Equipped gear is not in the
   * pack at all, so "not equipped" is simply everything here — minus quest
   * items, which are never sellable, and minus anything the player has marked
   * Important. That mark is the only protection, which is why it is one click
   * from the item card and has its own tab.
   */
  sellablePack(): Item[] {
    return this.player.inventory.filter((i) => !i.important && i.type !== 'quest');
  }

  /** Items the player has flagged to keep. */
  importantInPack(): Item[] {
    return this.player.inventory.filter((i) => i.important);
  }

  toggleImportant(uid: string): void {
    const it = this.player.inventory.find((i) => i.uid === uid);
    if (!it) return;
    it.important = !it.important;
    audio.play('ui', 0.4);
    this.touch();
  }

  /** Sell the whole pack except what is equipped, quest-bound or marked. */
  sellAllUnequipped(): { count: number; gold: number } {
    const list = this.sellablePack();
    if (!list.length) {
      this.toast('Nothing to sell', 'The pack is empty or everything in it is marked.', PAL.fog);
      return { count: 0, gold: 0 };
    }
    let gold = 0;
    for (const it of list) {
      gold += this.scrapValue(it);
      removeItem(this.player.inventory, it.uid, 999);
    }
    this.player.gold += gold;
    this.floatText(this.player.x, this.player.y - 40, `+${gold}g`, PAL.goldLit, 15);
    const kept = this.importantInPack().length;
    this.toast(
      `Sold ${list.length} items`,
      kept ? `${gold} gold. ${kept} marked item${kept > 1 ? 's' : ''} kept.` : `${gold} gold.`,
      PAL.gold, 'gold',
    );
    audio.play('gold', 0.7);
    this.touch();
    return { count: list.length, gold };
  }

  /** Sell every piece of junk at once. Returns what it cleared and earned. */
  scrapJunk(): { count: number; gold: number } {
    const junk = this.junkInPack();
    if (!junk.length) {
      this.toast('Nothing to sell', 'No common or rare gear in the pack.', PAL.fog);
      return { count: 0, gold: 0 };
    }
    let gold = 0;
    for (const it of junk) {
      gold += this.scrapValue(it);
      removeItem(this.player.inventory, it.uid, 999);
    }
    this.player.gold += gold;
    this.floatText(this.player.x, this.player.y - 40, `+${gold}g`, PAL.goldLit, 15);
    this.toast(`Sold ${junk.length} pieces`, `${gold} gold. SuperRare and better were kept.`, PAL.gold, 'gold');
    audio.play('gold', 0.7);
    this.touch();
    return { count: junk.length, gold };
  }

  moveToStorage(uid: string): void {
    const item = removeItem(this.player.inventory, uid, 999);
    if (!item) return;
    addItem(this.player.storage, item);
    this.touch();
  }

  takeFromStorage(uid: string): void {
    const item = removeItem(this.player.storage, uid, 999);
    if (!item) return;
    if (!addItem(this.player.inventory, item)) {
      addItem(this.player.storage, item);
      this.toast('Bag full', undefined, '#e8763a');
    }
    this.touch();
  }

  /**
   * How good a merchant's wares are. A cart parked at a level-16 dungeon mouth
   * sells level-16 gear at level-16 odds; the stall in the starting square
   * sells what a level-1 player can use. The further out and the deadlier the
   * ground, the better the stock — so walking somewhere frightening is how you
   * shop, not just how you fight.
   */
  private shopTier(npc: NpcDef): { level: number; magicFind: number; luck: number; band: number } {
    const region = REGION_BY_ID[(npc.map === 'overworld'
      ? REGION_BY_INDEX[this.getMap('overworld').regions?.[npc.ty * WORLD_W + npc.tx] ?? 0]?.id
      : 'central') as RegionId] ?? REGION_BY_ID.central;
    // distance from home town, in tiles, as a second difficulty axis
    const dist = Math.hypot(npc.tx - VILLAGE_TX, npc.ty - VILLAGE_TY);
    const far = Math.min(1, dist / 190);
    const base = npc.shop?.randomGear?.level ?? region.level[0];
    // A shop indoors inherits its own stated tier rather than the region's, so
    // the king's armoury is not priced like a village stall.
    const band = Math.max(base, region.level[1], Math.round(region.level[0] + (region.level[1] - region.level[0]) * far));
    // meet the player where they are, but never below what the region is worth
    const level = Math.max(base, band, Math.min(band + 4, this.player.level + 2));
    return { level, magicFind: 30 + band * 5 + far * 40, luck: 0.3 + far * 0.7, band };
  }

  openShop(npc: NpcDef): void {
    const shop = npc.shop!;
    const tier = this.shopTier(npc);
    // Stock is keyed to a level bucket as well as the shop, so a merchant
    // restocks with better goods once the player has meaningfully grown.
    const bucket = Math.floor(this.player.level / 3);
    const key = `${shop.id}:${bucket}`;
    let stock = this.shopStock.get(key);
    if (!stock) {
      const rng = new RNG(`${this.seed}:${key}`);
      stock = shop.stock.map((s) => makeItem(s.item, { qty: s.qty ?? 1, level: s.level, plain: true, rng }));
      if (shop.randomGear) {
        // one extra slot per four levels of regional danger
        const count = shop.randomGear.count + Math.floor(tier.band / 4);
        for (let i = 0; i < count; i++) {
          stock.push(rollLoot(tier.level + rng.int(-1, 2), rng, tier.magicFind, tier.luck, npc.map === 'overworld' ? this.regionIdAt(npc.tx, npc.ty) : undefined));
        }
      }
      this.shopStock.set(key, stock);
    }
    this.shop = {
      npcId: npc.id,
      shopId: shop.id,
      name: shop.name,
      priceMod: shop.priceMod * this.player.priceMod(npc.faction),
      stock,
      gold: shop.gold,
    };
    this.panel = 'shop';
    this.dialogue = null;
    audio.play('ui_big', 0.6);
    this.touch();
  }

  buyItem(uid: string): void {
    const s = this.shop;
    if (!s) return;
    const item = s.stock.find((i) => i.uid === uid);
    if (!item) return;
    const price = buyValue(item, s.priceMod);
    if (this.player.gold < price) {
      this.toast('Not enough gold', `${price} needed.`, '#e8763a');
      return;
    }
    const copy = { ...item, uid: `${item.uid}_${Date.now().toString(36)}`, qty: 1 };
    if (!addItem(this.player.inventory, copy)) {
      this.toast('Bag full', undefined, '#e8763a');
      return;
    }
    this.player.gold -= price;
    if (item.qty > 1) item.qty -= 1;
    else s.stock.splice(s.stock.indexOf(item), 1);
    audio.play('gold', 0.7);
    this.touch();
  }

  sellItem(uid: string): void {
    const s = this.shop;
    if (!s) return;
    const item = this.player.inventory.find((i) => i.uid === uid);
    if (!item) return;
    if (item.type === 'quest') {
      this.toast('Cannot sell', 'That is quest business.', '#e8763a');
      return;
    }
    const price = sellValue({ ...item, qty: 1 }, s.priceMod);
    removeItem(this.player.inventory, uid, 1);
    this.player.gold += price;
    const existing = s.stock.find((i) => i.defId === item.defId && i.rarity === item.rarity);
    if (existing && item.stackable) existing.qty += 1;
    else s.stock.push({ ...item, qty: 1, uid: `${item.uid}_s${Date.now().toString(36)}` });
    audio.play('gold', 0.6);
    this.touch();
  }

  /* ---------------- dialogue ---------------- */

  startDialogue(npcEnt: NpcEntity): void {
    const def = npcEnt.def;
    npcEnt.talking = true;
    for (const qid of this.quests.onTalk(def.id)) this.questProgressToast(qid);
    this.dialogue = {
      npcId: def.id,
      name: def.name,
      title: def.title,
      attitude: this.attitudeFor(def),
      lines: greetingFor(def, this.player, this.quests),
      lineIndex: 0,
      choices: [],
    };
    this.panel = null;
    this.shop = null;
    audio.play('ui', 0.5);
    this.refreshDialogueChoices();
    this.touch();
  }

  attitudeFor(def: NpcDef): { label: string; color: string } {
    const rep = this.player.rep(def.faction);
    const raceRep = this.player.raceDef.rep[def.faction] ?? 0;
    const score = rep + raceRep * 0.4;
    if (score >= 45) return { label: 'Warm', color: '#6fbf5a' };
    if (score >= 15) return { label: 'Friendly', color: '#8fbf4a' };
    if (score > -15) return { label: 'Neutral', color: '#b9b3a8' };
    if (score > -45) return { label: 'Guarded', color: '#e8763a' };
    return { label: 'Cold', color: '#b5462f' };
  }

  refreshDialogueChoices(): void {
    const d = this.dialogue;
    if (!d) return;
    const def = NPC_BY_ID[d.npcId];
    const opts = rootOptions(def, this.player, this.quests);
    const choices: DialogueChoice[] = [];

    for (const q of opts.turnIns) {
      choices.push({ text: `[Quest] "${q.name}" — it's done.`, actions: [{ type: 'quest_turnin', quest: q.id }] });
    }
    for (const q of opts.offers) {
      choices.push({ text: `[Quest] ${q.name}`, actions: [{ type: 'quest_offer', quest: q.id }] });
    }
    for (const q of opts.inProgress) {
      choices.push({ text: `About "${q.name}"...`, actions: [{ type: 'goto', node: `__quest_${q.id}` }] });
    }
    if (def.shop) choices.push({ text: 'Let me see your wares.', actions: [{ type: 'shop' }] });
    if (def.services?.includes('inn')) choices.push({ text: 'I need a room. (20 gold)', cond: { minGold: 20 }, actions: [{ type: 'inn' }] });
    if (def.services?.includes('heal')) choices.push({ text: 'Can you tend my wounds?', actions: [{ type: 'heal' }] });

    for (const topic of def.topics ?? []) {
      if (condMet(topic.cond, this.player, this.quests)) choices.push(topic);
    }
    choices.push({ text: 'Farewell.', actions: [{ type: 'end' }] });
    d.choices = choices;
  }

  advanceDialogue(): void {
    const d = this.dialogue;
    if (!d) return;
    if (d.lineIndex < d.lines.length - 1) {
      d.lineIndex++;
      this.touch();
    }
  }

  chooseDialogue(index: number): void {
    const d = this.dialogue;
    if (!d) return;
    const choice = d.choices[index];
    if (!choice) return;
    const npc = NPC_BY_ID[d.npcId];

    if (choice.actions) {
      for (const a of choice.actions) {
        switch (a.type) {
          case 'end':
            this.closeAll();
            return;
          case 'shop':
            this.openShop(npc);
            return;
          case 'royal':
            this.royalOpen = true;
            this.panel = 'forge';
            this.dialogue = null;
            audio.play('ui_big', 0.6);
            this.touch();
            return;
          case 'inn': {
            if (this.player.gold < 20) break;
            this.player.gold -= 20;
            this.sleep(true);
            this.closeAll();
            return;
          }
          case 'heal': {
            this.player.hp = this.player.maxHp;
            this.player.mp = this.player.maxMp;
            this.player.statuses = [];
            this.fx.spawn(this.player.x, this.player.y, 26, PAL.holy, { speed: 80, life: 0.9, size: 3, gravity: -90 });
            audio.play('heal', 0.7);
            this.toast('Restored', 'You feel considerably better.', PAL.holy);
            break;
          }
          case 'quest_offer': {
            const q = QUEST_BY_ID[a.quest];
            d.offer = q;
            d.lines = [q.detail];
            d.lineIndex = 0;
            d.choices = [
              { text: 'I will do it.', actions: [{ type: 'quest_accept', quest: q.id }] },
              { text: 'Not right now.', actions: [{ type: 'goto', node: '__root' }] },
            ];
            this.touch();
            return;
          }
          case 'quest_accept': {
            const q = QUEST_BY_ID[a.quest];
            this.quests.accept(q.id);
            this.toast(`New quest: ${q.name}`, q.summary, '#6fbf5a', 'quest');
            audio.play('quest', 0.6);
            d.offer = undefined;
            d.lines = ['"Good. Come back when it is done."'];
            d.lineIndex = 0;
            this.refreshDialogueChoices();
            this.touch();
            return;
          }
          case 'quest_turnin': {
            this.turnInQuest(a.quest);
            d.lines = [QUEST_BY_ID[a.quest]?.turnInText ?? '"Good work. The valley notices."'];
            d.lineIndex = 0;
            this.refreshDialogueChoices();
            this.touch();
            return;
          }
          case 'rep':
            this.player.addRep(a.faction, a.amount);
            this.toast(`${FACTION_BY_ID[a.faction].name} ${a.amount > 0 ? '+' : ''}${a.amount}`, undefined, FACTION_BY_ID[a.faction].color);
            break;
          case 'flag':
            if (a.value === false) this.player.flags.delete(a.flag);
            else this.player.flags.add(a.flag);
            break;
          case 'give':
            this.giveItem(a.item, a.qty ?? 1);
            break;
          case 'take':
            removeByDefId(this.player.inventory, a.item, a.qty ?? 1);
            break;
          case 'gold':
            this.player.gold = Math.max(0, this.player.gold + a.amount);
            this.toast(`${a.amount > 0 ? '+' : ''}${a.amount} gold`, undefined, PAL.gold, 'gold');
            audio.play('gold', 0.6);
            break;
          case 'attack':
            this.startDuel(npc);
            return;
          case 'goto':
            break;
          default:
            break;
        }
      }
    }

    const gotoAction = choice.actions?.find((a) => a.type === 'goto') as { type: 'goto'; node: string } | undefined;
    const nodeId = gotoAction?.node ?? choice.to;
    if (nodeId === '__root' || !nodeId) {
      if (choice.to === undefined && !gotoAction) {
        // plain informational choice with only side effects
        this.refreshDialogueChoices();
        this.touch();
        return;
      }
      d.lines = greetingFor(npc, this.player, this.quests);
      d.lineIndex = 0;
      d.offer = undefined;
      this.refreshDialogueChoices();
      this.touch();
      return;
    }

    if (nodeId.startsWith('__quest_')) {
      const q = QUEST_BY_ID[nodeId.slice(8)];
      d.lines = q ? [q.detail, '"Come back when it is finished."'] : ['...'];
      d.lineIndex = 0;
      this.refreshDialogueChoices();
      this.touch();
      return;
    }

    const node = npc.nodes?.find((n) => n.id === nodeId);
    if (node) {
      if (node.onEnter) {
        for (const a of node.onEnter) {
          if (a.type === 'heal') {
            this.player.hp = this.player.maxHp;
            this.player.mp = this.player.maxMp;
            this.player.statuses = [];
            audio.play('heal', 0.7);
          }
        }
      }
      d.lines = node.text;
      d.lineIndex = 0;
      if (node.choices?.length) {
        d.choices = node.choices.filter((c) => condMet(c.cond, this.player, this.quests));
        d.choices.push({ text: 'Let us talk of something else.', actions: [{ type: 'goto', node: '__root' }] });
      } else {
        this.refreshDialogueChoices();
      }
    }
    this.touch();
  }

  turnInQuest(id: string): void {
    const def = QUEST_BY_ID[id];
    const q = this.quests.get(id);
    if (!def || !q) return;
    const p = this.player;
    // consume collect objectives
    for (const o of def.objectives) {
      if (o.type === 'collect') removeByDefId(p.inventory, o.item, o.count);
    }
    p.gold += def.rewards.gold;
    const levels = p.addXp(def.rewards.xp);
    for (const it of def.rewards.items ?? []) this.giveItem(it);
    if (def.rewards.loot) {
      const rng = new RNG(`${this.seed}:${id}:reward`);
      const item = rollLoot(def.rewards.loot.level, rng, 0, 0);
      if (def.rewards.loot.rarity) {
        const better = makeItem(item.defId, { level: def.rewards.loot.level, rarity: def.rewards.loot.rarity as Rarity, rng });
        addItem(p.inventory, better);
        this.toast(`Reward: ${better.name}`, undefined, PAL.goldLit, better.icon);
      } else {
        addItem(p.inventory, item);
      }
    }
    for (const r of def.rewards.rep ?? []) p.addRep(r.faction, r.amount);
    this.quests.complete(id);
    // a finished quest must not keep the compass pointing at its marker
    if (this.trackedQuest === id) this.trackedQuest = null;
    if (def.next) {
      const nx = QUEST_BY_ID[def.next];
      if (nx && this.quests.canAccept(nx, p)) {
        // the follow-up becomes available from its giver; just hint at it
        this.toast('New lead', `Speak to ${NPC_BY_ID[nx.giver]?.name ?? 'someone in town'}.`, '#9578e8');
      }
    }
    this.toast(`Quest complete: ${def.name}`, `+${def.rewards.xp} XP, +${def.rewards.gold} gold`, PAL.goldLit, 'quest');
    audio.play('quest', 0.8);
    if (levels > 0) audio.play('levelup', 0.8);
    this.touch();
  }

  questGiverFor(questId: string): string | undefined {
    const def = QUEST_BY_ID[questId];
    return def ? def.turnIn ?? def.giver : undefined;
  }

  questProgressToast(id: string): void {
    const def = QUEST_BY_ID[id];
    if (!def) return;
    if (this.quests.isComplete(id, this.player)) {
      // Bounties pay on the spot — no walking back to a quest giver.
      if (def.auto) {
        this.turnInQuest(id);
        return;
      }
      const who = NPC_BY_ID[def.turnIn ?? def.giver];
      this.toast(`${def.name} — ready`, `Return to ${who?.name ?? 'the quest giver'}.`, PAL.goldLit, 'quest');
      audio.play('quest', 0.5);
    } else {
      audio.play('ui', 0.4);
      this.touch();
    }
  }

  /**
   * Offer every bounty tied to a place the moment the player finds it, and
   * hand the tutorial over at the very start. Nothing queues at an NPC.
   */
  private offerAutoQuests(location?: string, quiet = false): void {
    const p = this.player;
    for (const def of QUESTS) {
      if (!def.auto) continue;
      if (location && def.marker !== location) continue;
      if (!this.quests.canAccept(def, p)) continue;
      this.quests.accept(def.id);
      if (!quiet) {
        this.toast(`Bounty: ${def.name}`, def.summary, '#6fbf5a', 'quest');
        audio.play('quest', 0.55);
      }
      if (!this.trackedQuest) this.trackedQuest = def.id;
      // A bounty you already satisfied before finding the board pays at once.
      if (this.quests.isComplete(def.id, p)) this.turnInQuest(def.id);
    }
    this.touch();
  }

  /**
   * Hand over the bounties for places the player already knows about. Run on
   * load so a save made before a bounty existed still picks it up.
   */
  catchUpBounties(): void {
    for (const id of this.player.discovered) this.offerAutoQuests(id, true);
  }

  /** Gold it costs to retrain into another class. */
  readonly classChangeCost = 100;

  /**
   * Retrain into another class: swaps the stat block and ability set, refunds
   * every spent skill point, and hands over that class's starting kit.
   */
  changeClass(cls: ClassId): boolean {
    const p = this.player;
    if (p.cls === cls) return false;
    if (p.gold < this.classChangeCost) {
      this.toast('Not enough gold', `Retraining costs ${this.classChangeCost} gold.`, '#d9553f');
      return false;
    }
    p.gold -= this.classChangeCost;

    const spent = Object.values(p.skills).reduce((a, b) => a + b, 0);
    p.skills = {};
    p.skillPoints += spent;
    p.cooldowns = {};
    p.buffs = [];
    p.cls = cls;

    const def = CLASS_BY_ID[cls];
    for (const id of [def.startWeapon, ...def.startArmor]) {
      const item = makeItem(id, { plain: true });
      if (!addItem(p.inventory, item)) this.dropPickup(p.x, p.y, item, 0);
    }
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    p.sp = p.maxSp;

    this.fx.ring(p.x, p.y, 150, def.color);
    this.fx.spawn(p.x, p.y, 48, def.color, { speed: 170, life: 1.1, size: 3, gravity: -70 });
    audio.play('levelup', 0.9);
    this.toast(`You are now a ${def.name}`, `${spent} skill point${spent === 1 ? '' : 's'} refunded, starting kit issued.`, def.color);
    this.touch();
    return true;
  }

  /** Track a quest so the map, minimap and compass point at it. */
  trackQuest(id: string | null): void {
    this.trackedQuest = this.trackedQuest === id ? null : id;
    if (this.trackedQuest) {
      const def = QUEST_BY_ID[this.trackedQuest];
      const loc = def?.marker ? LOCATION_BY_ID[def.marker] : undefined;
      this.toast(`Tracking: ${def?.name ?? ''}`, loc ? `Marked ${loc.name} on your map.` : undefined, '#f0c93c', 'quest');
    }
    audio.play('ui', 0.6);
    this.touch();
  }

  /** Where the tracked quest wants the player to go, in world pixels. */
  trackedTarget(): { x: number; y: number; name: string } | null {
    if (!this.trackedQuest) return null;
    const def = QUEST_BY_ID[this.trackedQuest];
    if (!def?.marker) return null;
    const loc = LOCATION_BY_ID[def.marker];
    if (!loc) return null;
    return { x: loc.tx * TILE, y: loc.ty * TILE, name: loc.name };
  }

  /** Seconds left before a waystone can be used again, 0 if it's clear. */
  travelLockoutRemaining(): number {
    return Math.max(0, this.travelLockoutAfterDamage - (this.now - this.lastDamageTaken));
  }

  /** Fast travel between attuned waystones. */
  travelToWaystone(siteId: string): void {
    const loc = LOCATION_BY_ID[siteId];
    if (!loc || !this.player.waystones.has(siteId)) return;
    const lockout = this.travelLockoutRemaining();
    if (lockout > 0) {
      this.toast('Too dangerous to travel', `Wait ${lockout.toFixed(1)}s after taking damage.`, '#d9553f');
      audio.play('ui', 0.4);
      return;
    }
    this.closeAll();
    const wx = (loc.tx - 6) * TILE + TILE / 2;
    const wy = (loc.ty - 5) * TILE + TILE;
    this.travel('overworld', wx, wy + 40, loc.name);
    this.currentWaystone = siteId;
  }

  /* ---------------- world interaction ---------------- */

  sleep(atInn: boolean): void {
    const p = this.player;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    p.sp = p.maxSp;
    p.statuses = [];
    p.reviveUsed = false;
    // advance to 7am the next morning
    const target = DAY_SECONDS * (7 / 24);
    this.clock = this.clock >= target ? DAY_SECONDS + target : target;
    if (this.clock >= DAY_SECONDS) {
      this.clock -= DAY_SECONDS;
      this.day++;
    }
    this.toast(atInn ? 'You sleep at the inn' : 'You sleep in your own bed', `Day ${this.day} — fully rested.`, PAL.goldLit);
    this.restockShops();
    this.autosave();
    this.touch();
  }

  restockShops(): void {
    this.shopStock.clear();
  }

  /**
   * Chests hand their contents to a menu rather than flinging them on the
   * floor. A chest full of loot used to become a pile of pickups you had to
   * walk over one at a time, and with a full pack half of it simply stayed
   * on the ground behind you.
   */
  private openChest(c: ChestEntity): void {
    if (c.opened) return;
    const st = this.mapState(this.map.id);
    c.opened = true;
    st.opened.add(c.id);
    // A restocked chest must not pay out the same item twice, so the roll
    // number is part of the seed.
    const roll = st.chestRolls[c.id] ?? 0;
    st.chestRestock[c.id] = this.now + CHEST_RESTOCK;
    const rng = new RNG(`${this.seed}:${this.map.id}:${c.id}:${roll}`);
    const mf = this.player.stats().magicFind;
    const rolls = c.tier === 'boss' ? 4 : c.tier === 'large' ? 2 : 1;
    const bias = c.tier === 'boss' ? 1.2 : c.tier === 'large' ? 0.4 : 0;
    const gold = c.gold ?? rng.int(8, 30) * (c.tier === 'boss' ? 8 : c.tier === 'large' ? 3 : 1) + c.level * 4;

    const items: Item[] = [];
    for (let i = 0; i < rolls; i++) {
      const it = rollLoot(c.level, rng, mf, bias, this.regionAtPlayer());
      if (it) items.push(it);
    }
    for (const f of c.fixed ?? []) items.push(makeItem(f, { level: c.level, rng }));
    if (rng.bool(0.4)) {
      items.push(makeItem(rng.pick(['potion_health_s', 'potion_mana_s', 'food_bread', 'mat_herb', 'mat_iron_ore']), { qty: rng.int(1, 2), plain: true }));
    }
    // whisperwell hides the quest ring
    if (this.map.id === 'dungeon_whisper' && !this.player.flags.has('found_ring') && rng.bool(0.5)) {
      this.player.flags.add('found_ring');
      items.push(makeItem('q_missing_ring', { plain: true }));
    }

    this.fx.spawn(c.x, c.y - 10, 22, PAL.goldLit, { speed: 100, life: 0.8, size: 3, gravity: -40 });
    audio.play('loot', 0.7);
    this.loot = {
      title: c.tier === 'boss' ? 'Hoard' : c.tier === 'large' ? 'Strongbox' : 'Chest',
      sub: `Level ${c.level}`,
      x: c.x, y: c.y - 6, gold, items,
    };
    this.panel = 'loot';
    this.touch();
  }

  /** Take one thing out of the open container. Returns false if the pack is full. */
  takeLoot(uid: string): boolean {
    const l = this.loot;
    if (!l) return false;
    const i = l.items.findIndex((it) => it.uid === uid);
    if (i < 0) return false;
    if (!addItem(this.player.inventory, l.items[i])) {
      this.toast('Bag full', 'Make room, or leave it and come back.', '#e8763a');
      return false;
    }
    audio.play('loot', 0.5);
    l.items.splice(i, 1);
    this.touch();
    return true;
  }

  takeLootGold(): void {
    const l = this.loot;
    if (!l || l.gold <= 0) return;
    this.player.gold += l.gold;
    this.floatText(this.player.x, this.player.y - 40, `+${l.gold}g`, PAL.goldLit, 13);
    l.gold = 0;
    audio.play('gold', 0.7);
    this.touch();
  }

  /** Take everything that fits, in the order shown. */
  takeAllLoot(): void {
    const l = this.loot;
    if (!l) return;
    this.takeLootGold();
    for (const it of [...l.items]) {
      if (!this.takeLoot(it.uid)) break;
    }
    if (!l.items.length) this.closeLoot();
    else this.touch();
  }

  /**
   * Closing the menu with things still in it is not the same as throwing them
   * away: whatever is left lands at the chest's feet, where it always used to,
   * so nothing can be lost by pressing escape.
   */
  /** Put whatever is still in the open container back on the ground. */
  private abandonLoot(): void {
    const l = this.loot;
    this.loot = null;
    if (!l) return;
    if (l.gold > 0) this.dropPickup(l.x, l.y, null, l.gold);
    for (const it of l.items) this.dropPickup(l.x + (Math.random() - 0.5) * 22, l.y, it, 0);
  }

  closeLoot(): void {
    this.abandonLoot();
    if (this.panel === 'loot') this.panel = null;
    this.touch();
  }

  private useProp(prop: PropInstance): void {
    switch (prop.interact) {
      case 'bed':
        this.sleep(false);
        break;
      case 'inn_bed':
        if (this.player.gold >= 20) {
          this.player.gold -= 20;
          this.sleep(true);
        } else this.toast('Not enough gold', '20 gold for a room.', '#e8763a');
        break;
      case 'storage':
        this.panel = 'storage';
        audio.play('ui_big', 0.5);
        this.touch();
        break;
      case 'shrine': {
        const key = `shrine_${Math.round(prop.x)}_${Math.round(prop.y)}`;
        if (this.player.flags.has(key)) {
          this.toast('The shrine is quiet', 'You have already tended this one.', PAL.fog);
          break;
        }
        this.player.flags.add(key);
        this.player.shrinesTended++;
        this.player.hp = this.player.maxHp;
        this.player.mp = this.player.maxMp;
        this.fx.ring(prop.x, prop.y - 20, 120, PAL.holy);
        this.fx.spawn(prop.x, prop.y - 20, 34, PAL.holy, { speed: 110, life: 1.1, size: 3, gravity: -80 });
        audio.play('discover', 0.7);
        this.player.addXp(40 + this.player.level * 12);
        this.toast('Shrine tended', 'Warmth, and a little more strength.', PAL.holy);
        for (const qid of this.quests.onInteract('shrine')) this.questProgressToast(qid);
        break;
      }
      case 'well':
        this.player.sp = this.player.maxSp;
        this.fx.spawn(prop.x, prop.y - 16, 14, PAL.foam, { speed: 70, life: 0.6, size: 2, gravity: -40 });
        this.toast('Cold, clean water', 'Stamina restored.', PAL.foam);
        audio.play('drink', 0.5);
        break;
      case 'anvil':
        this.panel = 'forge';
        audio.play('ui_big', 0.5);
        this.touch();
        break;
      case 'waystone': {
        const site = String(prop.data?.site ?? 'ashvale');
        this.currentWaystone = site;
        if (!this.player.discovered.has(site)) this.player.discovered.add(site);
        if (!this.player.waystones.has(site)) {
          this.player.waystones.add(site);
          this.toast('Waystone attuned', `${LOCATION_BY_ID[site]?.name ?? 'This place'} is now a travel destination.`, '#4f9ce8');
          audio.play('discover', 0.7);
        }
        this.panel = 'travel';
        audio.play('ui_big', 0.6);
        this.touch();
        break;
      }
      case 'notice':
        this.panel = 'quests';
        this.touch();
        break;
      case 'sign':
        this.toast('Signpost', String(prop.data?.text ?? '...'), PAL.cloth);
        break;
      case 'exit_dungeon': {
        const portal = this.map.portals.find((p) => p.kind === 'stairs');
        if (portal) this.travel(portal.to, portal.tx, portal.ty);
        break;
      }
      default:
        break;
    }
  }

  /** Cost to push an item one level higher at the anvil. */
  reforgeCost(item: Item): { ingots: number; gold: number } {
    const discount = this.player.hasPerk('forgeborn') ? 0.8 : 1;
    return {
      ingots: 1 + Math.floor(item.level / 5),
      gold: Math.round((30 + item.level * 26) * discount),
    };
  }

  reforge(uid: string): void {
    const p = this.player;
    const item = this.findGear(uid);
    if (!item) return;
    const cost = this.reforgeCost(item);
    if (countItem(p.inventory, 'mat_iron_ingot') < cost.ingots || p.gold < cost.gold) {
      this.toast('Not enough materials', `${cost.ingots} iron ingots and ${cost.gold} gold.`, '#d9553f');
      return;
    }
    removeByDefId(p.inventory, 'mat_iron_ingot', cost.ingots);
    p.gold -= cost.gold;
    item.level += 1;
    for (const key of ['damage', 'defense', 'maxHealth', 'maxMana'] as const) {
      if (item.stats[key] !== undefined) item.stats[key] = Math.round(item.stats[key]! * 1.11 + 1);
    }
    item.value = Math.round(item.value * 1.15);
    this.fx.spawn(p.x, p.y - 10, 24, PAL.flameLit, { speed: 120, life: 0.7, size: 3, gravity: -30 });
    audio.play('levelup', 0.6);
    this.toast('Reforged', `${item.name} is now level ${item.level}.`, PAL.goldLit);
    this.touch();
  }

  /** Cost to wipe an item's rolled enchantments and draw new ones. */
  enchantCost(item: Item): { runes: number; gold: number } {
    return { runes: 1, gold: Math.round(60 + item.level * 40) };
  }

  /** Why the forge will not rebind this item's runes, or null if it will. */
  rerollBlocked(item: Item): string | null {
    if (item.noReroll) {
      return 'Its runes were bound by the hand that made it. They will not come loose.';
    }
    if (item.enchantSlots <= 0) return 'Nothing on it will hold a rune.';
    return null;
  }

  rerollEnchants(uid: string): void {
    const p = this.player;
    const item = this.findGear(uid);
    if (!item) return;
    const blocked = this.rerollBlocked(item);
    if (blocked) {
      this.toast('The runes will not move', blocked, '#d9553f');
      audio.play('ui', 0.4);
      return;
    }
    const cost = this.enchantCost(item);
    if (countItem(p.inventory, 'mat_rune') < cost.runes || p.gold < cost.gold) {
      this.toast('Not enough materials', `${cost.runes} binding rune and ${cost.gold} gold.`, '#d9553f');
      return;
    }
    removeByDefId(p.inventory, 'mat_rune', cost.runes);
    p.gold -= cost.gold;
    const template = TEMPLATE_BY_ID[item.defId];
    item.enchants = (template?.fixedEnchants ?? []).map((e) => ({ ...e }));
    rollEnchants(item, new RNG(Math.floor(Math.random() * 1e9)));
    this.fx.spawn(p.x, p.y - 10, 28, PAL.arcaneLit, { speed: 130, life: 0.8, size: 3, gravity: -40 });
    audio.play('quest', 0.5);
    this.toast('Runes rebound', `${item.name} draws new enchantments.`, '#7fd4ff');
    this.touch();
  }

  /* ---------------- the crown ---------------- */

  /** True while the anvil panel is open under King Jovan's warrant. */
  royalOpen = false;

  /**
   * Crown warrants. Jovan keeps a tally of everything you have put down and
   * owes you for each of it: one warrant per boss felled, and each warrant
   * buys one step up the rarity ladder for something you already carry. It is
   * the only way to reach Legendary on gear you chose rather than gear that
   * happened to drop.
   */
  warrantsAvailable(): number {
    return Math.max(0, this.player.bossesKilled.size - this.player.warrantsUsed);
  }

  /** Can this item still be raised, and is there a warrant to spend on it? */
  canElevate(item: Item): { ok: boolean; reason?: string; next?: Rarity } {
    // Deliberately not RARITY_ORDER: the crown can raise a thing to
    // Legendary and no further. Mythic is not in its gift.
    const order: Rarity[] = ['common', 'rare', 'superRare', 'epic', 'legendary'];
    const i = order.indexOf(item.rarity);
    if (i < 0 || i === order.length - 1) return { ok: false, reason: 'Already as fine as the crown can make it.' };
    if (this.warrantsAvailable() <= 0) return { ok: false, reason: 'No warrants. Fell a boss and the crown owes you one.' };
    return { ok: true, next: order[i + 1] };
  }

  /** Spend a warrant: one rarity tier up, an extra enchant slot, new rolls. */
  royalElevate(uid: string): boolean {
    const p = this.player;
    const item = this.findGear(uid);
    if (!item) return false;
    const check = this.canElevate(item);
    if (!check.ok || !check.next) {
      this.toast('The crown declines', check.reason, '#d9553f');
      return false;
    }
    p.warrantsUsed += 1;
    item.rarity = check.next;
    item.enchantSlots = Math.max(item.enchantSlots, RARITY_ENCHANT_SLOTS[check.next]);
    const scale = 1.18;
    for (const key of ['damage', 'defense', 'maxHealth', 'maxMana', 'abilityPower'] as const) {
      if (item.stats[key] !== undefined) item.stats[key] = Math.round(item.stats[key]! * scale + 1);
    }
    item.value = Math.round(item.value * 1.6);
    const template = TEMPLATE_BY_ID[item.defId];
    item.enchants = (template?.fixedEnchants ?? []).map((e) => ({ ...e }));
    rollEnchants(item, new RNG(Math.floor(Math.random() * 1e9)));
    const color = RARITY_COLOR[item.rarity];
    this.fx.ring(p.x, p.y, 150, color);
    this.fx.spawn(p.x, p.y - 10, 44, color, { speed: 170, life: 1.1, size: 3, gravity: -60 });
    this.flashScreen(color, 0.3);
    this.shake(8);
    audio.play('levelup', 0.9);
    this.toast(`${item.name} is elevated`, `Raised to ${RARITY_LABEL[item.rarity]} by royal warrant.`, color, item.icon);
    this.touch();
    return true;
  }

  /** Find an item across the pack and the equipped slots. */
  findGear(uid: string): Item | undefined {
    const inBag = this.player.inventory.find((i) => i.uid === uid);
    if (inBag) return inBag;
    for (const slot of EQUIP_SLOT_ORDER) {
      const it = this.player.equipment[slot];
      if (it?.uid === uid) return it;
    }
    return undefined;
  }

  private findInteractable(): InteractTarget | null {
    const p = this.player;
    const range = 56 * (p.hasPerk('keensight') ? 1.15 : 1);
    let best: InteractTarget | null = null;
    let bestD = range * range;

    for (const n of this.npcs) {
      const d = dist2(p.x, p.y, n.x, n.y);
      if (d < bestD) {
        bestD = d;
        best = { label: `Talk to ${n.def.name}`, key: `npc_${n.def.id}`, x: n.x, y: n.y - 46, run: () => this.startDialogue(n) };
      }
    }
    for (const c of this.chests) {
      if (c.opened) continue;
      const d = dist2(p.x, p.y, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = { label: 'Open chest', key: `chest_${c.id}`, x: c.x, y: c.y - 30, run: () => this.openChest(c) };
      }
    }
    const idx: number[] = [];
    propsInRect(this.map, p.x - 120, p.y - 120, p.x + 120, p.y + 120, idx);
    for (const i of idx) {
      const prop = this.map.props[i];
      if (!prop.interact) continue;
      const d = dist2(p.x, p.y, prop.x, prop.y);
      if (d < bestD) {
        bestD = d;
        best = { label: prop.label ?? 'Use', key: `prop_${i}`, x: prop.x, y: prop.y - 34, run: () => this.useProp(prop) };
      }
    }
    for (const portal of this.map.portals) {
      const cx = portal.x + portal.w / 2;
      const cy = portal.y + portal.h / 2;
      const d = dist2(p.x, p.y, cx, cy);
      if (d < bestD) {
        bestD = d;
        best = {
          label: portal.label, key: `portal_${portal.to}`, x: cx, y: cy - 20,
          run: () => {
            if (portal.to === 'overworld') this.travel('overworld', portal.tx, portal.ty);
            else {
              const target = this.getMap(portal.to);
              const entry = target.kind === 'interior' ? interiorEntry(target) : dungeonEntry(target);
              this.travel(portal.to, entry.x, entry.y);
            }
          },
        };
      }
    }
    return best;
  }

  /* ---------------- update ---------------- */

  update(dtRaw: number): void {
    const dt = Math.min(0.05, dtRaw);
    this.dt = dt;
    this.now += dt;
    this.fx.budget = this.settings.batterySaver ? 0.35 : 1;
    if (this.screenFlash.alpha > 0) this.screenFlash.alpha = Math.max(0, this.screenFlash.alpha - dt * 2.4);
    if (this.streak > 0 && this.now > this.streakUntil) this.streak = 0;

    if (this.screen !== 'playing') {
      this.fx.update(dt);
      this.input.endFrame();
      return;
    }

    this.input.tick(dt);
    this.updateFade(dt);
    this.handleHotkeys();

    if (this.uiOpen) {
      this.input.uiCapture = true;
      this.fx.update(dt * 0.2);
      this.updateCamera(dt);
      this.input.endFrame();
      return;
    }
    this.input.uiCapture = false;

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.fx.update(dt);
      this.updateCamera(dt);
      this.input.endFrame();
      return;
    }

    this.clock = (this.clock + dt) % DAY_SECONDS;
    if (this.clock < dt) this.day++;
    this.player.playTime += dt;

    this.updatePlayer(dt);
    this.updateSpawns();
    this.updateChests();
    for (const e of this.enemies) e.update(this);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.updateNpcs(dt);
    this.updateProjectiles(dt);
    this.updateGroundZones();
    this.updatePickups(dt);
    this.updateDiscovery();
    this.updateAmbience(dt);
    this.fx.update(dt);
    this.updateCamera(dt);
    this.updateMusic();

    this.interact = this.findInteractable();
    if (this.input.wasPressed('interact') && this.interact) this.interact.run();

    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].t += dt;
      if (this.toasts[i].t > 6) this.toasts.splice(i, 1);
    }

    if (this.now - this.lastAutosave > 60) this.autosave();
    this.input.endFrame();
  }

  private updateFade(dt: number): void {
    const f = this.fade;
    if (f.alpha === f.target && !f.pending) return;
    if (f.alpha < f.target) {
      f.alpha = Math.min(1, f.alpha + f.speed * dt);
      if (f.alpha >= 1 && f.pending) {
        const run = f.pending;
        f.pending = null;
        run();
        f.target = 0;
      }
    } else {
      f.alpha = Math.max(0, f.alpha - f.speed * dt);
      if (f.alpha <= 0) f.label = '';
    }
  }

  private handleHotkeys(): void {
    const i = this.input;
    if (i.wasPressed('pause', true)) {
      if (this.dialogue || this.shop || this.panel) this.closeAll();
      else this.setPanel('pause');
    }
    if (i.wasPressed('inventory', true)) this.togglePanel('inventory');
    if (i.wasPressed('map', true)) this.togglePanel('map');
    if (i.wasPressed('quests', true)) this.togglePanel('quests');
    if (i.wasPressed('character', true)) this.togglePanel('character');
    if (i.wasPressed('skills', true)) this.togglePanel('skills');
    if (i.wasPressed('debug', true)) { this.debug = !this.debug; this.touch(); }
    if (i.wasPressed('minimap', true)) { this.showMinimap = !this.showMinimap; this.touch(); }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    const stats = p.stats();

    p.flash = Math.max(0, p.flash - dt * 4);
    p.invuln = Math.max(0, p.invuln - dt);
    p.attackTimer = Math.max(0, p.attackTimer - dt);
    p.animTime += dt;
    for (const k of Object.keys(p.cooldowns)) p.cooldowns[k] = Math.max(0, p.cooldowns[k] - dt);
    p.buffs = p.buffs.filter((b) => b.until > this.now);
    if (p.shield > 0 && this.now > p.shieldUntil) p.shield = 0;

    // regen
    p.mp = Math.min(p.maxMp, p.mp + stats.manaRegen * dt);
    const moving = Math.abs(p.vx) + Math.abs(p.vy) > 5;
    p.sp = Math.min(p.maxSp, p.sp + stats.staminaRegen * (moving ? 0.5 : 1.3) * dt);
    if (p.hp < p.maxHp && !this.enemies.some((e) => !e.friendly && !e.dead && dist2(e.x, e.y, p.x, p.y) < 360 * 360)) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.012 * dt);
    }

    // statuses
    for (let i = p.statuses.length - 1; i >= 0; i--) {
      const s = p.statuses[i];
      if (this.now > s.until) { p.statuses.splice(i, 1); continue; }
      if (s.kind === 'burn' || s.kind === 'poison') {
        s.tick = (s.tick ?? 0) + dt;
        if (s.tick >= 0.5) {
          s.tick = 0;
          const before = p.invuln;
          p.invuln = 0;
          this.damagePlayer(s.power * 0.5, { element: s.kind === 'burn' ? 'fire' : 'poison' });
          p.invuln = before;
        }
      }
    }

    // input
    const mv = this.input.moveVector();
    const speedTile = TILES[this.mapTileAt(p.x, p.y)]?.speed ?? 1;
    const baseSpeed = stats.moveSpeed * speedTile * 1.15;
    const targetVx = mv.x * baseSpeed;
    const targetVy = mv.y * baseSpeed;
    p.vx = damp(p.vx, targetVx, 16, dt);
    p.vy = damp(p.vy, targetVy, 16, dt);

    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.dashVx;
      p.vy = p.dashVy;
      p.dashVx *= 1 - Math.min(1, 6 * dt);
      p.dashVy *= 1 - Math.min(1, 6 * dt);
      this.fx.spawn(p.x, p.y, 1, PAL.cloth, { speed: 10, life: 0.25, size: 2, gravity: 0 });
    }

    // sprint / dodge roll
    if (this.input.wasPressed('dash') && p.sp >= 18 && p.dashTimer <= 0) {
      const dir = mv.x !== 0 || mv.y !== 0 ? Math.atan2(mv.y, mv.x) : this.aim;
      const cost = p.hasPerk('pathfinder') ? 12 : 18;
      p.sp -= cost;
      p.dashVx = Math.cos(dir) * 620;
      p.dashVy = Math.sin(dir) * 620;
      p.dashTimer = 0.2;
      p.invuln = Math.max(p.invuln, 0.24);
      this.fx.spawn(p.x, p.y, 12, PAL.fog, { speed: 90, life: 0.3, size: 2 });
      audio.play('step', 0.4);
    }

    this.moveWithCollision(p, p.vx * dt, p.vy * dt);

    if (moving) {
      p.anim = p.attackTimer > p.animTime && p.anim === 'attack' ? 'attack' : 'walk';
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.32;
        audio.play('step', 0.18);
      }
      if (mv.x !== 0 || mv.y !== 0) p.dir = dirFromAngle(Math.atan2(mv.y, mv.x));
    } else if (p.anim !== 'attack' || p.animTime > 0.4) {
      p.anim = 'idle';
    }

    // aim in world space (mouse is optional; keyboard play uses facing + soft lock)
    this.input.world.x = this.camera.x + (this.input.mouse.x - this.canvas.width / 2) / this.camera.zoom;
    this.input.world.y = this.camera.y + (this.input.mouse.y - this.canvas.height / 2) / this.camera.zoom;
    if (mv.x !== 0 || mv.y !== 0) this.aim = Math.atan2(mv.y, mv.x);
    else if (this.input.hasMouse && this.input.mouseIdle < 1.6) this.aim = angleTo(p.x, p.y, this.input.world.x, this.input.world.y);

    // combat input
    const hasShield = p.equipment.offHand?.weaponKind === 'shield';
    p.blocking = hasShield && (this.input.isDown('offhand') || this.input.mouseDown[2]);
    if (this.input.isDown('attack') || this.input.mouseDown[0]) this.basicAttack(false);
    if (this.input.wasPressed('heavy') || this.input.mousePressed[2]) this.basicAttack(true);
    if (this.input.wasPressed('offhand') && !hasShield) this.useOffhand();
    if (this.input.wasPressed('artifact')) this.useArtifact();
    if (this.input.wasPressed('weaponPower')) this.useWeaponPower();
    if (this.input.wasPressed('potion')) this.useQuickItem();
    for (let i = 0; i < p.classDef.abilities.length; i++) {
      if (this.input.wasPressed(`slot${i + 1}` as 'slot1')) this.useAbility(i);
    }
    p.artifactCooldown = Math.max(0, p.artifactCooldown - dt);
    p.weaponPowerCooldown = Math.max(0, p.weaponPowerCooldown - dt);
    p.offhandCooldown = Math.max(0, p.offhandCooldown - dt);

    // traps
    const idx: number[] = [];
    propsInRect(this.map, p.x - 60, p.y - 60, p.x + 60, p.y + 60, idx);
    for (const i of idx) {
      const prop = this.map.props[i];
      if (!prop.data?.trap) continue;
      if (dist2(p.x, p.y, prop.x, prop.y - 10) < 22 * 22) {
        const phase = (this.now + (prop.phase ?? 0)) % 2;
        if (phase > 1.1 && p.invuln <= 0) {
          this.damagePlayer(Number(prop.data.damage ?? 10), { element: 'physical', fromX: prop.x, fromY: prop.y, label: 'Spikes' });
        }
      }
    }
  }

  mapTileAt(x: number, y: number): number {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return T.VOID;
    return this.map.tiles[ty * this.map.w + tx];
  }

  /** Terrain + prop collision with axis separation so the player slides along walls. */
  moveWithCollision(e: { x: number; y: number; radius: number }, dx: number, dy: number): void {
    const hw = e.radius * 0.72;
    const hh = e.radius * 0.5;
    const tryMove = (nx: number, ny: number): boolean => {
      if (boxHitsTerrain(this.map, nx, ny, hw, hh)) return false;
      return !this.propBlocks(nx, ny, hw, hh);
    };
    if (dx !== 0 && tryMove(e.x + dx, e.y)) e.x += dx;
    if (dy !== 0 && tryMove(e.x, e.y + dy)) e.y += dy;
    e.x = clamp(e.x, 8, this.map.w * TILE - 8);
    e.y = clamp(e.y, 8, this.map.h * TILE - 8);
  }

  /**
   * Nearest spot the player can actually stand, accounting for props as well
   * as terrain. `findOpenNear` only tests tiles, so on its own it will happily
   * drop you inside a shop sign or a barrel and wedge you there. Arrivals —
   * doors, stairs, waystones — all come through here.
   */
  findStandingSpot(x: number, y: number, hw = 10, hh = 7): { x: number; y: number } {
    const free = (nx: number, ny: number) =>
      !boxHitsTerrain(this.map, nx, ny, hw, hh) && !this.propBlocks(nx, ny, hw, hh);
    if (free(x, y)) return { x, y };
    // spiral outward, preferring straight down: a door's clear ground is the
    // street in front of it, not the wall it is set into
    for (let r = 1; r <= 26; r++) {
      const steps = r * 8;
      for (let i = 0; i < steps; i++) {
        // start the sweep pointing down and alternate sides
        const half = Math.ceil(i / 2) * (i % 2 === 0 ? 1 : -1);
        const a = Math.PI / 2 + (half / steps) * Math.PI * 2;
        const nx = x + Math.cos(a) * r * TILE * 0.55;
        const ny = y + Math.sin(a) * r * TILE * 0.55;
        if (free(nx, ny)) return { x: nx, y: ny };
      }
    }
    // nothing within range is clear; fall back to terrain-only so the player
    // at least never lands inside a wall
    return findOpenNear(this.map, x, y, hw, hh);
  }

  private propIdx: number[] = [];

  propBlocks(x: number, y: number, hw: number, hh: number): boolean {
    propsInRect(this.map, x - 140, y - 160, x + 140, y + 60, this.propIdx);
    for (const i of this.propIdx) {
      const p = this.map.props[i];
      if (!p.cw || !p.ch) continue;
      const left = p.x - p.cw / 2;
      const right = p.x + p.cw / 2;
      const top = p.y - p.ch;
      const bottom = p.y;
      if (x + hw > left && x - hw < right && y + hh > top && y - hh < bottom) return true;
    }
    return false;
  }

  /**
   * A cleared wing fills back in. Chests you emptied a while ago are shut
   * again with something new in them, so a dungeon is worth walking back
   * into rather than being a place you visit exactly once.
   */
  private updateChests(): void {
    const st = this.mapState(this.map.id);
    for (const c of this.chests) {
      if (!c.opened) continue;
      // The boss hoard is part of the boss kill, and the boss does not come
      // back, so neither does its chest.
      if (c.tier === 'boss') continue;
      const due = st.chestRestock[c.id];
      if (due === undefined || due > this.now) continue;
      // Not while the player is standing over it — a chest closing itself in
      // front of you reads as a bug.
      if (dist2(this.player.x, this.player.y, c.x, c.y) < 260 * 260) continue;
      c.opened = false;
      st.opened.delete(c.id);
      delete st.chestRestock[c.id];
      st.chestRolls[c.id] = (st.chestRolls[c.id] ?? 0) + 1;
    }
  }

  private updateSpawns(): void {
    const st = this.mapState(this.map.id);
    const p = this.player;
    for (const sp of this.map.spawns) {
      if (st.killedSpawns.has(sp.id)) continue;
      if (sp.boss && p.bossesKilled.has(sp.enemy)) continue;
      const d = dist(p.x, p.y, sp.x, sp.y);
      const active = this.activeSpawns.get(sp.id);
      if (d < ACTIVATE_DIST) {
        if ((active?.length ?? 0) > 0) continue;
        if ((st.respawn[sp.id] ?? 0) > this.now) continue;
        const group = sp.boss ? 1 : sp.group ?? 1;
        const list: Enemy[] = [];
        for (let i = 0; i < group; i++) {
          const ox = i === 0 ? 0 : (Math.random() - 0.5) * 90;
          const oy = i === 0 ? 0 : (Math.random() - 0.5) * 90;
          const pos = findOpenNear(this.map, sp.x + ox, sp.y + oy, 12, 8);
          const e = new Enemy(sp.enemy, pos.x, pos.y, sp.level, {
            elite: sp.elite, boss: sp.boss, spawnId: sp.id,
            region: sp.region ?? (this.map.id === 'overworld' ? this.regionIdAt(Math.floor(sp.x / TILE), Math.floor(sp.y / TILE)) : undefined),
          });
          list.push(e);
          this.enemies.push(e);
        }
        this.activeSpawns.set(sp.id, list);
        if (sp.boss) {
          const boss = list[0];
          this.bossTarget = boss;
          const def = ENEMY_BY_ID[sp.enemy];
          this.toast(def.name, def.boss?.title, '#f45b5b');
          this.updateMusic(true);
          this.touch();
        }
      } else if (d > DESPAWN_DIST && active && active.length) {
        for (const e of active) {
          if (!e.isBoss) e.dead = true;
        }
        if (!active.some((e) => e.isBoss)) this.activeSpawns.set(sp.id, []);
      }
    }
    if (this.bossTarget && this.bossTarget.dead) {
      this.bossTarget = null;
      this.updateMusic(true);
    }
  }

  private updateNpcs(dt: number): void {
    const hour = this.hour;
    for (const n of this.npcs) {
      if (Math.random() < 0.02) n.updateSchedule(hour);
      const d = dist2(n.x, n.y, this.player.x, this.player.y);
      // distant NPCs update at a reduced rate
      if (d > 900 * 900) {
        if (Math.random() < 0.15) n.update(dt * 6, this.map, this.player.x, this.player.y);
      } else {
        n.update(dt, this.map, this.player.x, this.player.y);
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      // Friendly shots correct slightly, so auto-aim stays true against a
      // target that steps aside. The window is deliberately short: over a
      // 500-pixel flight a wide homing radius turns every arrow into a guided
      // missile that curves across the field at whatever it passes.
      if (pr.friendly && (pr.homing ?? 1) > 0) {
        let best: Enemy | null = null;
        let bestD = 150;
        for (const e of this.enemies) {
          if (e.dead || e.friendly || pr.hits.has(e.id)) continue;
          const d = dist(pr.x, pr.y, e.x, e.y);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          const want = angleTo(pr.x, pr.y, best.x, best.y - best.radius * 0.3);
          let delta = ((want - pr.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          const turn = Math.min(Math.abs(delta), 3.2 * (pr.homing ?? 1) * dt) * Math.sign(delta);
          pr.angle += turn;
          pr.vx = Math.cos(pr.angle) * pr.speed;
          pr.vy = Math.sin(pr.angle) * pr.speed;
        }
      }
      // Sweep the frame's movement in short sub-steps. An arrow covers 520
      // px/s, which at a clamped 50ms frame is 26 pixels — far enough to skip
      // clean over an enemy and make a bow feel like it does nothing.
      const frameStep = pr.speed * dt;
      const subs = Math.max(1, Math.ceil(frameStep / 7));
      const sdt = dt / subs;
      for (let s = 0; s < subs && !pr.dead; s++) {
        pr.x += pr.vx * sdt;
        pr.y += pr.vy * sdt;
        pr.travelled += frameStep / subs;
        if (pr.travelled > pr.range) { pr.dead = true; break; }
        if (blocksProjectiles(this.mapTileAt(pr.x, pr.y))) {
          pr.dead = true;
          this.fx.spawn(pr.x, pr.y, 6, pr.color, { speed: 80, life: 0.3, size: 2 });
          break;
        }
        if (pr.friendly) {
          for (const e of this.enemies) {
            if (e.dead || e.friendly || pr.hits.has(e.id)) continue;
            if (dist2(pr.x, pr.y, e.x, e.y - e.radius * 0.3) > (e.radius + pr.radius * 0.35) ** 2) continue;
            pr.hits.add(e.id);
            this.damageEnemy(e, pr.damage, { element: pr.element, crit: pr.crit, knockback: 120, fromX: pr.x - pr.vx, fromY: pr.y - pr.vy });
            this.applyHitEffects(e, pr.damage, !!pr.crit);
            if (pr.splash && pr.splash > 0) {
              this.fx.ring(pr.x, pr.y, pr.splash, pr.color);
              for (const other of this.enemies) {
                if (other === e || other.dead || other.friendly) continue;
                if (dist2(pr.x, pr.y, other.x, other.y) < pr.splash * pr.splash) {
                  this.damageEnemy(other, pr.damage * 0.5, { element: pr.element, noProc: true });
                }
              }
            }
            if (pr.pierceLeft > 0) pr.pierceLeft--;
            else { pr.dead = true; }
            break;
          }
        } else {
          const p = this.player;
          if (dist2(pr.x, pr.y, p.x, p.y - 8) < (p.radius + pr.radius * 0.3) ** 2) {
            pr.dead = true;
            this.damagePlayer(pr.damage, { element: pr.element, fromX: pr.x, fromY: pr.y, knockback: 60 });
            if (pr.element === 'poison') applyStatus(p, 'poison', pr.damage * 0.25, 5, PAL.toxic, this.now);
            if (pr.element === 'fire') applyStatus(p, 'burn', pr.damage * 0.25, 4, PAL.flame, this.now);
            if (pr.element === 'frost') applyStatus(p, 'chill', 0.3, 3, PAL.frost, this.now);
            this.fx.spawn(pr.x, pr.y, 8, pr.color, { speed: 90, life: 0.35, size: 2 });
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  private updateGroundZones(): void {
    for (let i = this.groundZones.length - 1; i >= 0; i--) {
      const z = this.groundZones[i];
      if (this.now > z.until) { this.groundZones.splice(i, 1); continue; }
      if (this.now < z.next) continue;
      z.next = this.now + (z.burst ? 999 : 0.5);
      if (z.burst) {
        this.fx.ring(z.x, z.y, z.r, z.color);
        this.shake(8);
      }
      this.fx.spawn(z.x + (Math.random() - 0.5) * z.r, z.y + (Math.random() - 0.5) * z.r, 6, z.color, { speed: 60, life: 0.5, size: 2, gravity: -30 });
      for (const e of this.enemies) {
        if (e.dead || e.friendly) continue;
        if (dist2(e.x, e.y, z.x, z.y) > z.r * z.r) continue;
        const amount = z.burst ? z.dps : z.dps * 0.5;
        this.damageEnemy(e, amount, { element: z.element, noProc: true });
        if (z.element === 'poison') e.applyStatusFrom('poison', amount * 0.3, 3, PAL.toxic, this.now);
        if (z.element === 'fire') e.applyStatusFrom('burn', amount * 0.3, 3, PAL.flame, this.now);
      }
    }
  }

  private updatePickups(dt: number): void {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const it = this.pickups[i];
      it.life -= dt;
      if (it.life <= 0) { this.pickups.splice(i, 1); continue; }
      if (it.z > 0 || it.vz !== 0) {
        it.z += it.vz * dt;
        it.vz -= 320 * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.vx *= 1 - 2 * dt;
        it.vy *= 1 - 2 * dt;
        if (it.z <= 0) { it.z = 0; it.vz = 0; }
      }
      const d = dist(it.x, it.y, p.x, p.y);
      // an item you put down by hand neither magnetises nor collects until
      // you have actually walked away from it
      if (it.needsRelease) {
        if (d > this.dropReleaseDist) it.needsRelease = undefined;
        continue;
      }
      if (d < 78) {
        const pull = 260 * dt * (1 - d / 78 + 0.35);
        const a = angleTo(it.x, it.y, p.x, p.y);
        it.x += Math.cos(a) * pull;
        it.y += Math.sin(a) * pull;
      }
      if (d < 20) {
        if (it.gold > 0) {
          p.gold += it.gold;
          this.floatText(p.x, p.y - 36, `+${it.gold}g`, PAL.goldLit, 12);
          audio.play('gold', 0.4);
        } else if (it.item) {
          if (!addItem(p.inventory, it.item)) {
            // No toast here. The item stays under the magnet, so this fires
            // every frame — it used to flash a banner in the middle of the
            // screen continuously and allocate a toast per frame doing it.
            // The HUD carries a standing "pack full" marker instead.
            it.life = Math.max(it.life, 120);
            continue;
          }
          // Picking something up says what it is in its own colour. It used
          // to be the same gold for everything above Rare, which threw away
          // the one piece of information the player actually wanted.
          const colour = RARITY_COLOR[it.item.rarity];
          const rare = it.item.rarity !== 'common' && it.item.rarity !== 'rare';
          this.floatText(p.x, p.y - 40, it.item.name, colour, rare ? 14 : 12);
          audio.play('loot', rare ? 0.8 : 0.4);
          if (rare) {
            this.toast(it.item.name, `${RARITY_LABEL[it.item.rarity]} · Level ${it.item.level}`, colour, it.item.icon);
            this.fx.ring(p.x, p.y, it.item.rarity === 'mythic' ? 90 : 60, colour);
          }
          this.touch();
        }
        this.pickups.splice(i, 1);
      }
    }
  }

  private updateDiscovery(): void {
    if (this.map.id !== 'overworld') return;
    const p = this.player;
    const bonus = p.hasPerk('keensight') ? 1.15 : 1;
    for (const loc of LOCATIONS) {
      if (p.discovered.has(loc.id)) continue;
      const r = (loc.radius ?? 10) * TILE * bonus;
      if (dist2(p.x, p.y, loc.tx * TILE, loc.ty * TILE) < r * r) {
        p.discovered.add(loc.id);
        const xp = 25 + (loc.level ?? 1) * 10;
        p.addXp(xp);
        // Finding a place IS the work. Walking the last thirty metres to the
        // stone and pressing use was a second, sillier gate on top of it, and
        // the only thing it ever achieved was a long walk back to a landmark
        // somebody had already stood in.
        const gate = WAYSTONE_SITES.some((w) => w.id === loc.id) && !p.waystones.has(loc.id);
        if (gate) p.waystones.add(loc.id);
        this.toast(
          `Discovered: ${loc.name}`,
          `${loc.desc}  (+${xp} XP)${gate ? ' · gate open' : ''}`,
          '#6fd0e8',
        );
        audio.play('discover', 0.6);
        for (const qid of this.quests.onExplore(loc.id)) this.questProgressToast(qid);
        this.offerAutoQuests(loc.id);
        this.touch();
      }
    }
  }

  private ambientTimer = 0;

  /** Dust in daylight, drifting embers and fireflies after dark. */
  private updateAmbience(dt: number): void {
    // drifting dust, embers and fireflies are pure atmosphere, and the first
    // thing worth dropping when the goal is to spend less
    if (this.settings.batterySaver) return;
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 0.12;
    const p = this.player;
    const night = this.nightFactor;
    const indoors = !this.map.outdoor;
    const spread = 420;
    const x = p.x + (Math.random() - 0.5) * spread * 2;
    const y = p.y + (Math.random() - 0.5) * spread * 1.4;
    if (indoors) {
      this.fx.spawn(x, y, 1, PAL.flameLit, { speed: 6, life: 2.6, size: 1, gravity: -3 });
      return;
    }
    if (night > 0.5) {
      const region = this.regionAtPlayer();
      const color = region === 'east' ? PAL.toxic : region === 'north' ? PAL.frost : region === 'west' ? PAL.arcaneLit : PAL.flameLit;
      this.fx.spawn(x, y, 1, color, { speed: 9, life: 3.2, size: 1, gravity: -4 });
    } else if (Math.random() < 0.6) {
      this.fx.spawn(x, y, 1, PAL.bone, { speed: 7, life: 2.4, size: 1, gravity: -2 });
    }
  }

  private updateCamera(dt: number): void {
    const p = this.player;
    const halfW = this.canvas.width / 2 / this.camera.zoom;
    const halfH = this.canvas.height / 2 / this.camera.zoom;
    let tx = p.x;
    let ty = p.y - 10;
    const mapW = this.map.w * TILE;
    const mapH = this.map.h * TILE;
    if (mapW > halfW * 2) tx = clamp(tx, halfW, mapW - halfW);
    else tx = mapW / 2;
    if (mapH > halfH * 2) ty = clamp(ty, halfH, mapH - halfH);
    else ty = mapH / 2;
    this.camera.x = damp(this.camera.x, tx, 9, dt);
    this.camera.y = damp(this.camera.y, ty, 9, dt);
    this.camera.shake *= 1 - Math.min(1, 7 * dt);
    if (this.camera.shake < 0.15) this.camera.shake = 0;
  }

  /** Exposed so the smoke tests can sample the loot tables. */
  rollLootForTest(level: number): Item {
    return rollLoot(level, new RNG(Math.floor(Math.random() * 1e9)), this.player?.stats().magicFind ?? 0, 0, this.regionAtPlayer());
  }

  /* ---------------- persistence ---------------- */

  autosave(): void {
    this.lastAutosave = this.now;
    try {
      const { saveGame } = requireSave();
      saveGame(this);
    } catch {
      /* storage unavailable — keep playing */
    }
  }
}

/** Lazily required so save.ts can import Game types without a cycle at module init. */
function requireSave(): { saveGame: (g: Game) => void } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return saveHook;
}

export const saveHook: { saveGame: (g: Game) => void } = { saveGame: () => {} };

function withTint(p: Player): string {
  const kind = p.weaponKind();
  if (kind === 'staff' || kind === 'wand' || kind === 'tome') return PAL.arcaneLit;
  return PAL.cloth;
}
