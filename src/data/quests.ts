import type { ClassId } from './classes';
import type { FactionId, RaceId } from './races';

export type Objective =
  | { type: 'kill'; enemy: string; count: number; label: string }
  | { type: 'collect'; item: string; count: number; label: string }
  | { type: 'talk'; npc: string; label: string }
  | { type: 'explore'; location: string; label: string }
  | { type: 'clear'; map: string; label: string }
  | { type: 'boss'; enemy: string; label: string }
  | { type: 'interact'; target: string; count?: number; label: string };

export interface QuestReward {
  xp: number;
  gold: number;
  items?: string[];
  rep?: Array<{ faction: FactionId; amount: number }>;
  loot?: { level: number; rarity?: 'rare' | 'superRare' | 'epic' | 'legendary' };
}

export interface QuestDef {
  id: string;
  name: string;
  giver: string;
  turnIn?: string;
  level: number;
  main?: boolean;
  summary: string;
  detail: string;
  objectives: Objective[];
  rewards: QuestReward;
  prereq?: { quest?: string; level?: number; classes?: ClassId[]; races?: RaceId[]; flag?: string };
  next?: string;
  /** Location id used for the map marker. */
  marker?: string;
  turnInText?: string;
  /**
   * Bounties take themselves. They are offered the moment you find the place
   * they concern and pay out the instant you finish them, so the world never
   * turns into a queue of errands waiting at an NPC.
   */
  auto?: boolean;
}

export const QUESTS: QuestDef[] = [
  /* ---------------- the one tutorial ---------------- */
  {
    id: 'tutorial', name: 'Somewhere to Start', giver: 'elder_hanne', turnIn: 'elder_hanne', level: 1, main: true, auto: true,
    summary: 'Walk south-west out of Ashvale and find Whisperwell Cave.',
    detail: 'Every road out of town leads somewhere worse. Whisperwell is the closest and the shallowest. Start there.',
    objectives: [{ type: 'explore', location: 'whisperwell', label: 'Find Whisperwell Cave' }],
    rewards: { xp: 180, gold: 150, items: ['potion_health_m', 'potion_health_m'], loot: { level: 4, rarity: 'rare' } },
    marker: 'whisperwell',
  },

  /* ---------------- self-serve bounties ---------------- */
  {
    id: 'bounty_whisperwell', name: 'Bounty: Whisperwell', giver: 'notice', level: 4, auto: true,
    summary: 'Clear out whatever has moved into Whisperwell Cave.',
    detail: 'Nothing down there is worth a song, but the valley sleeps better when it is empty.',
    objectives: [{ type: 'clear', map: 'dungeon_whisper', label: 'Clear Whisperwell Cave' }],
    rewards: { xp: 420, gold: 260, loot: { level: 6, rarity: 'rare' } },
    prereq: { quest: 'tutorial' }, marker: 'whisperwell',
  },
  {
    id: 'bounty_mine', name: 'Bounty: The Brood Mother', giver: 'notice', level: 7, auto: true,
    summary: 'Something with too many legs has taken the Ironroot dig.',
    detail: 'Twelve miners went down. The web came back up.',
    objectives: [{ type: 'kill', enemy: 'mini_broodmother', count: 1, label: 'Kill the Brood Mother' }],
    rewards: { xp: 900, gold: 500, loot: { level: 9, rarity: 'superRare' }, rep: [{ faction: 'guild', amount: 20 }] },
    marker: 'ironroot_mine',
  },
  {
    id: 'bounty_fortress', name: 'Bounty: The Stone Warden', giver: 'notice', level: 10, auto: true,
    summary: 'The fortress gate woke up, and it is still holding.',
    detail: 'A border keep the clans walked away from. Something in it never got the order to stand down.',
    objectives: [{ type: 'boss', enemy: 'boss_stone_warden', label: 'Destroy the Stone Warden' }],
    rewards: { xp: 1800, gold: 900, loot: { level: 11, rarity: 'epic' }, rep: [{ faction: 'alliance', amount: 20 }] },
    marker: 'ruined_fortress',
  },
  {
    id: 'bounty_grove', name: 'Bounty: The Forest Matriarch', giver: 'notice', level: 12, auto: true,
    summary: 'The grove is growing the wrong way, out from its own heart.',
    detail: 'She was the root that held Thornhollow. She is a wound now.',
    objectives: [{ type: 'boss', enemy: 'boss_matriarch', label: 'Lay the Forest Matriarch to rest' }],
    rewards: { xp: 2200, gold: 1100, loot: { level: 13, rarity: 'epic' }, rep: [{ faction: 'forest', amount: 25 }] },
    marker: 'grove_temple',
  },
  {
    id: 'bounty_tomb', name: 'Bounty: The Sand Tyrant', giver: 'notice', level: 12, auto: true,
    summary: 'The tomb under the dunes opened by itself.',
    detail: 'Things that open by themselves are cheaper to loot than to explain.',
    objectives: [{ type: 'boss', enemy: 'boss_sand_tyrant', label: 'Kill the Sand Tyrant' }],
    rewards: { xp: 2200, gold: 1100, loot: { level: 13, rarity: 'epic' }, rep: [{ faction: 'guild', amount: 20 }] },
    marker: 'sunken_tomb',
  },
  {
    id: 'bounty_crypt', name: 'Bounty: The Hollow King', giver: 'notice', level: 15, auto: true,
    summary: 'The barrow line ended with a king who refused to.',
    detail: 'He has been collecting down there for a very long time. Take the crown off him.',
    objectives: [{ type: 'boss', enemy: 'boss_hollow_king', label: 'Defeat the Hollow King' }],
    rewards: { xp: 3200, gold: 1600, loot: { level: 15, rarity: 'epic' }, rep: [{ faction: 'arcane', amount: 20 }] },
    marker: 'barrow_crypt',
  },
  {
    id: 'bounty_spire', name: 'Bounty: Vareth, the Rimebound', giver: 'notice', level: 17, auto: true,
    summary: 'The archivist in the Ashen Spire never stopped counting.',
    detail: 'Vareth divided the world to see what was left over. The valley is the remainder. End the sum.',
    objectives: [{ type: 'boss', enemy: 'boss_rime_lich', label: 'Defeat Vareth, the Rimebound' }],
    rewards: { xp: 5200, gold: 2600, loot: { level: 18, rarity: 'legendary' }, rep: [{ faction: 'arcane', amount: 25 }, { faction: 'alliance', amount: 25 }] },
    marker: 'ashen_spire',
  },
  {
    id: 'bounty_north', name: 'Bounty: The Rime Warden', giver: 'notice', level: 12, auto: true,
    summary: 'Something frozen walks the pass above Northwatch.',
    detail: 'It was a Concord machine once. Now it is weather with arms.',
    objectives: [{ type: 'kill', enemy: 'mini_frostwarden', count: 1, label: 'Destroy the Rime Warden' }],
    rewards: { xp: 1600, gold: 800, loot: { level: 13, rarity: 'epic' }, rep: [{ faction: 'northern', amount: 25 }] },
    marker: 'ashen_spire',
  },
  {
    id: 'bounty_cutters', name: 'Bounty: Captain Vosk', giver: 'notice', level: 8, auto: true,
    summary: 'The Ash Cutters have a captain, and the roads have a problem.',
    detail: 'They stopped robbing carts and started escorting something. Nobody liked the change.',
    objectives: [{ type: 'kill', enemy: 'mini_captain', count: 1, label: 'Defeat Captain Vosk' }],
    rewards: { xp: 950, gold: 550, loot: { level: 9, rarity: 'superRare' }, rep: [{ faction: 'alliance', amount: 15 }, { faction: 'bandits', amount: -15 }] },
    marker: 'cutter_camp',
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
