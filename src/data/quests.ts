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
  /** Random loot roll at this level. */
  loot?: { level: number; rarity?: 'uncommon' | 'rare' | 'epic' | 'legendary' };
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
}

export const QUESTS: QuestDef[] = [
  /* ---------------- main line ---------------- */
  {
    id: 'main_1', name: 'A Quiet Morning', giver: 'elder_hanne', turnIn: 'elder_hanne', level: 1, main: true,
    summary: 'Elder Hanne wants you to get your bearings in Ashvale before anything else goes wrong.',
    detail: '"Walk the town. Meet Corin at the forge and Pell at the stall. Then come back and tell me the sky has not fallen."',
    objectives: [
      { type: 'talk', npc: 'smith_corin', label: 'Speak with Corin the smith' },
      { type: 'talk', npc: 'merchant_pell', label: 'Speak with Pell at the market stall' },
    ],
    rewards: { xp: 60, gold: 40, items: ['potion_health_s', 'potion_health_s'], rep: [{ faction: 'alliance', amount: 5 }] },
    next: 'main_2', marker: 'ashvale',
    turnInText: '"Good. Now the part I did not want to say first."',
  },
  {
    id: 'main_2', name: 'Wolves at the Fence', giver: 'elder_hanne', turnIn: 'elder_hanne', level: 2, main: true,
    summary: 'Wolf packs have pushed into the valley pasture. Thin them out.',
    detail: '"Six wolves, and bring back a pelt so the farmers believe me. Stay on the roads until you are stronger."',
    objectives: [
      { type: 'kill', enemy: 'wolf', count: 6, label: 'Cull wolves in the valley' },
      { type: 'collect', item: 'q_wolf_pelt', count: 2, label: 'Collect thick wolf pelts' },
    ],
    rewards: { xp: 150, gold: 90, loot: { level: 3, rarity: 'uncommon' }, rep: [{ faction: 'alliance', amount: 8 }] },
    prereq: { quest: 'main_1' }, next: 'main_3', marker: 'ashvale',
  },
  {
    id: 'main_3', name: 'What the Cutters Carry', giver: 'captain_dara', turnIn: 'captain_dara', level: 6, main: true,
    summary: 'The Ash Cutters are moving something north. Captain Dara wants their marching orders.',
    detail: '"They are not robbing carts any more. They are escorting something. Find their camp south of the river and take the orders off whoever is holding them."',
    objectives: [
      { type: 'explore', location: 'cutter_camp', label: 'Find the Cutter Camp' },
      { type: 'kill', enemy: 'mini_captain', count: 1, label: 'Defeat Captain Vosk' },
      { type: 'collect', item: 'q_bandit_orders', count: 1, label: 'Recover the marching orders' },
    ],
    rewards: { xp: 480, gold: 260, loot: { level: 8, rarity: 'rare' }, rep: [{ faction: 'alliance', amount: 12 }, { faction: 'bandits', amount: -15 }] },
    prereq: { quest: 'main_2', level: 4 }, next: 'main_4', marker: 'cutter_camp',
  },
  {
    id: 'main_4', name: "The Warden's Gate", giver: 'captain_dara', turnIn: 'scholar_ivo', level: 10, main: true,
    summary: 'The orders point at the ruined fortress in the north. Something there is still awake.',
    detail: '"The Cutters were paid to carry shards into the fortress. Whatever they were feeding, put it down."',
    objectives: [
      { type: 'explore', location: 'ruined_fortress', label: 'Reach the Ruined Fortress' },
      { type: 'boss', enemy: 'boss_stone_warden', label: 'Destroy the Stone Warden' },
      { type: 'collect', item: 'q_relic_shard', count: 2, label: 'Gather Modulo shards' },
    ],
    rewards: { xp: 1200, gold: 600, loot: { level: 11, rarity: 'epic' }, rep: [{ faction: 'alliance', amount: 15 }, { faction: 'arcane', amount: 10 }] },
    prereq: { quest: 'main_3', level: 7 }, next: 'main_5', marker: 'ruined_fortress',
  },
  {
    id: 'main_5', name: 'The King Below', giver: 'scholar_ivo', turnIn: 'scholar_ivo', level: 14, main: true,
    summary: 'The shards are being gathered by something in the Barrow Crypt.',
    detail: '"The crypt line ends with a king who refused to end. He has been collecting. Take the crown off him."',
    objectives: [
      { type: 'explore', location: 'barrow_crypt', label: 'Enter the Barrow Crypt' },
      { type: 'boss', enemy: 'boss_hollow_king', label: 'Defeat the Hollow King' },
    ],
    rewards: { xp: 2200, gold: 900, loot: { level: 15, rarity: 'epic' }, rep: [{ faction: 'arcane', amount: 15 }, { faction: 'alliance', amount: 10 }] },
    prereq: { quest: 'main_4', level: 11 }, next: 'main_6', marker: 'barrow_crypt',
  },
  {
    id: 'main_6', name: 'The Remainder', giver: 'scholar_ivo', turnIn: 'scholar_ivo', level: 17, main: true,
    summary: 'Every shard leads to the Ashen Spire, and to the archivist who never stopped counting.',
    detail: '"Vareth divided the world to see what was left over. The valley is the remainder. End the sum."',
    objectives: [
      { type: 'explore', location: 'ashen_spire', label: 'Climb to the Ashen Spire' },
      { type: 'boss', enemy: 'boss_rime_lich', label: 'Defeat Vareth, the Rimebound' },
    ],
    rewards: { xp: 4000, gold: 2000, loot: { level: 18, rarity: 'legendary' }, rep: [{ faction: 'arcane', amount: 20 }, { faction: 'alliance', amount: 20 }] },
    prereq: { quest: 'main_5', level: 14 }, marker: 'ashen_spire',
  },

  {
    id: 'main_7', name: "The King's Commission", giver: 'king_jovan', turnIn: 'king_jovan', level: 6, main: true,
    summary: 'King Jovan wants the valley\'s factions speaking to each other before the next thing wakes up.',
    detail: '"Carry my letter west to Warden Ysolde and north to Clanmother Greta. Neither will thank you. Both will read it."',
    objectives: [
      { type: 'talk', npc: 'warden_ysolde', label: 'Bring the letter to Warden Ysolde' },
      { type: 'talk', npc: 'clanmother_greta', label: 'Bring the letter to Clanmother Greta' },
      { type: 'explore', location: 'ashvale', label: 'Return to the Moot Hall' },
    ],
    rewards: {
      xp: 700, gold: 400, items: ['art_kings_seal'],
      rep: [{ faction: 'alliance', amount: 15 }, { faction: 'forest', amount: 8 }, { faction: 'northern', amount: 8 }],
    },
    prereq: { quest: 'main_2', level: 5 }, marker: 'thornhollow',
    turnInText: '"Both of them read it. Neither signed it. That is further than my father ever got."',
  },

  /* ---------------- side quests ---------------- */
  {
    id: 'side_ore', name: 'Iron for the Forge', giver: 'smith_corin', turnIn: 'smith_corin', level: 3,
    summary: 'Corin needs ore and has no time to dig it out himself.',
    detail: '"Eight lumps of iron ore. I do not care where from. Goblins carry it, rocks have it, thieves sell it."',
    objectives: [{ type: 'collect', item: 'mat_iron_ore', count: 8, label: 'Gather iron ore' }],
    rewards: { xp: 180, gold: 120, loot: { level: 5, rarity: 'uncommon' }, rep: [{ faction: 'guild', amount: 8 }] },
    marker: 'ashvale',
  },
  {
    id: 'side_herbs', name: 'Emberleaf and Bad Ideas', giver: 'alchemist_sable', turnIn: 'alchemist_sable', level: 3,
    summary: 'Sable needs emberleaf, which grows where sensible people do not go.',
    detail: '"Six stems. Unburnt. If it smells like a struck match, that is the right one."',
    objectives: [{ type: 'collect', item: 'mat_herb', count: 6, label: 'Gather emberleaf' }],
    rewards: { xp: 160, gold: 80, items: ['potion_health_m', 'potion_mana_m'], rep: [{ faction: 'alliance', amount: 5 }] },
    marker: 'ashvale',
  },
  {
    id: 'side_boars', name: 'The Fallow Field', giver: 'farmer_ulla', turnIn: 'farmer_ulla', level: 3,
    summary: 'Boars have torn up Ulla\'s south field twice this week.',
    detail: '"Five of them. Big ones. I would do it myself but I have a harvest and one working knee."',
    objectives: [{ type: 'kill', enemy: 'boar', count: 5, label: 'Drive off the boars' }],
    rewards: { xp: 190, gold: 110, items: ['food_meat', 'food_cheese', 'food_bread'], rep: [{ faction: 'alliance', amount: 6 }] },
    marker: 'ashvale',
  },
  {
    id: 'side_ring', name: "Maren's Ring", giver: 'innkeeper_bryn', turnIn: 'innkeeper_bryn', level: 4,
    summary: 'A wedding ring went into Whisperwell Cave on a dare. It did not come out.',
    detail: '"Maren\'s boy took it to show his friends. Now he will not say which tunnel. Find it before she finds out."',
    objectives: [
      { type: 'explore', location: 'whisperwell', label: 'Search Whisperwell Cave' },
      { type: 'collect', item: 'q_missing_ring', count: 1, label: 'Recover the wedding ring' },
    ],
    rewards: { xp: 260, gold: 150, loot: { level: 6, rarity: 'uncommon' }, rep: [{ faction: 'alliance', amount: 8 }] },
    marker: 'whisperwell',
  },
  {
    id: 'side_mine', name: 'What the Guild Hit', giver: 'miner_dorn', turnIn: 'miner_dorn', level: 6,
    summary: 'The Ironroot dig went quiet three weeks ago.',
    detail: '"Twelve of mine went down there. None came up. Whatever is nesting in my mine, unnest it."',
    objectives: [
      { type: 'explore', location: 'ironroot_mine', label: 'Enter Ironroot Mine' },
      { type: 'kill', enemy: 'mini_broodmother', count: 1, label: 'Kill the Brood Mother' },
    ],
    rewards: { xp: 600, gold: 380, loot: { level: 8, rarity: 'rare' }, rep: [{ faction: 'guild', amount: 20 }] },
    prereq: { level: 5 }, marker: 'ironroot_mine',
  },
  {
    id: 'side_shrines', name: 'The Last Lit Shrines', giver: 'priest_alun', turnIn: 'priest_alun', level: 5,
    summary: 'Three shrines still stand in the valley. Father Alun wants them tended.',
    detail: '"Light them, say nothing clever, and come back. The valley notices these things even if you do not."',
    objectives: [{ type: 'interact', target: 'shrine', count: 3, label: 'Tend wayside shrines' }],
    rewards: { xp: 320, gold: 160, items: ['potion_health_m'], loot: { level: 7, rarity: 'uncommon' }, rep: [{ faction: 'alliance', amount: 10 }] },
    marker: 'standing_stones',
  },
  {
    id: 'side_delivery', name: 'The Mirefall Parcel', giver: 'merchant_pell', turnIn: 'trader_yss', level: 5,
    summary: 'Pell will pay well for a parcel carried east to Mirefall.',
    detail: '"Do not open it. Do not shake it. Yss knows what it is and I would rather you did not."',
    objectives: [
      { type: 'explore', location: 'mirefall', label: 'Travel to Mirefall' },
      { type: 'talk', npc: 'trader_yss', label: 'Deliver the parcel to Yss' },
    ],
    rewards: { xp: 380, gold: 260, loot: { level: 7, rarity: 'uncommon' }, rep: [{ faction: 'alliance', amount: 6 }] },
    marker: 'mirefall',
  },
  {
    id: 'side_direwolf', name: 'The Grey Between Trees', giver: 'hunter_kesh', turnIn: 'hunter_kesh', level: 7,
    summary: 'Kesh has been tracking a dire wolf pack through Thornhollow.',
    detail: '"Four of them, maybe five. They hunt the road at dusk. I am one bow short of a good idea."',
    objectives: [{ type: 'kill', enemy: 'direwolf', count: 5, label: 'Hunt dire wolves in the west' }],
    rewards: { xp: 520, gold: 300, loot: { level: 9, rarity: 'rare' }, rep: [{ faction: 'forest', amount: 10 }] },
    prereq: { level: 5 }, marker: 'thornhollow',
  },
  {
    id: 'side_grove', name: 'What the Grove Keeps', giver: 'warden_ysolde', turnIn: 'warden_ysolde', level: 12,
    summary: 'The Forest Court wants the grove temple quiet again — and its heartseed returned.',
    detail: '"She was our grandmother once. She is a wound now. Close it, and bring the seed back to the roots."',
    objectives: [
      { type: 'boss', enemy: 'boss_matriarch', label: 'Lay the Forest Matriarch to rest' },
      { type: 'collect', item: 'q_heartseed', count: 1, label: 'Recover the heartseed' },
    ],
    rewards: { xp: 1600, gold: 700, loot: { level: 13, rarity: 'epic' }, rep: [{ faction: 'forest', amount: 25 }] },
    prereq: { level: 10 }, marker: 'grove_temple',
  },
  {
    id: 'side_tomb', name: 'Gems of the Sunken Tomb', giver: 'dwarf_brigga', turnIn: 'dwarf_brigga', level: 12,
    summary: 'Brigga will fund an expedition if someone else takes the risk.',
    detail: '"Two cut rubies and the tyrant\'s head. In that order of importance, and I mean it."',
    objectives: [
      { type: 'boss', enemy: 'boss_sand_tyrant', label: 'Kill the Sand Tyrant' },
      { type: 'collect', item: 'mat_gem_ruby', count: 2, label: 'Recover cut rubies' },
    ],
    rewards: { xp: 1500, gold: 850, loot: { level: 13, rarity: 'epic' }, rep: [{ faction: 'guild', amount: 25 }] },
    prereq: { level: 10 }, marker: 'sunken_tomb',
  },
  {
    id: 'side_shards', name: 'A Count of Shards', giver: 'scholar_ivo', turnIn: 'scholar_ivo', level: 9,
    summary: 'Ivo pays by the shard and asks very few questions.',
    detail: '"Five. Apostates carry them. So do things that used to be apostates."',
    objectives: [{ type: 'collect', item: 'q_relic_shard', count: 5, label: 'Collect Modulo shards' }],
    rewards: { xp: 700, gold: 450, loot: { level: 11, rarity: 'rare' }, rep: [{ faction: 'arcane', amount: 15 }] },
    prereq: { level: 7 }, marker: 'ashvale',
  },
  {
    id: 'side_frost', name: 'The Rime Warden', giver: 'clanmother_greta', turnIn: 'clanmother_greta', level: 12,
    summary: 'Something frozen walks the pass above Northwatch.',
    detail: '"It was a Concord machine once. Now it is weather with arms. Break it and bring me the core."',
    objectives: [
      { type: 'kill', enemy: 'mini_frostwarden', count: 1, label: 'Destroy the Rime Warden' },
      { type: 'collect', item: 'q_ice_core', count: 1, label: 'Recover the frozen core' },
    ],
    rewards: { xp: 1300, gold: 650, loot: { level: 13, rarity: 'epic' }, rep: [{ faction: 'northern', amount: 25 }] },
    prereq: { level: 10 }, marker: 'ashen_spire',
  },
  {
    id: 'side_guard', name: 'Walk the Long Road', giver: 'guard_temar', turnIn: 'guard_temar', level: 4,
    summary: 'Temar cannot leave the gate, but someone should check the valley landmarks.',
    detail: '"Kettle Bridge, the falls, the stones. If they are still standing, I will sleep better."',
    objectives: [
      { type: 'explore', location: 'old_bridge', label: 'Check Kettle Bridge' },
      { type: 'explore', location: 'ember_falls', label: 'Check Emberfall' },
      { type: 'explore', location: 'standing_stones', label: 'Check the Counting Stones' },
    ],
    rewards: { xp: 300, gold: 180, loot: { level: 6, rarity: 'uncommon' }, rep: [{ faction: 'alliance', amount: 10 }] },
    marker: 'old_bridge',
  },
  {
    id: 'side_thief', name: 'A Quiet Arrangement', giver: 'fence_rook', turnIn: 'fence_rook', level: 6,
    summary: 'Rook has work that the Alliance would not approve of.',
    detail: '"Goblins in the warren took a ledger page that belongs to nobody. Get it back before it belongs to the Guild."',
    objectives: [
      { type: 'kill', enemy: 'goblin', count: 8, label: 'Clear goblins from the warren' },
      { type: 'collect', item: 'q_ledger', count: 1, label: 'Recover the ledger page' },
    ],
    rewards: { xp: 480, gold: 420, loot: { level: 8, rarity: 'rare' }, rep: [{ faction: 'bandits', amount: 15 }, { faction: 'guild', amount: -10 }] },
    prereq: { level: 5 }, marker: 'goblin_warren',
  },
  {
    id: 'side_clan', name: 'Blood and Salt', giver: 'clanmother_greta', turnIn: 'clanmother_greta', level: 10,
    summary: 'Greta will only speak plainly to someone who has fought the raiders of her own clan.',
    detail: '"Six raiders. Mine, once. They chose the war camp over the hold. Choose for them."',
    objectives: [{ type: 'kill', enemy: 'orc_raider', count: 6, label: 'Defeat Crag raiders' }],
    rewards: { xp: 900, gold: 480, loot: { level: 11, rarity: 'rare' }, rep: [{ faction: 'northern', amount: 20 }] },
    prereq: { level: 8 }, marker: 'crag_camp',
  },
  {
    id: 'side_cave', name: 'The Whisperwell Dare', giver: 'child_tam', turnIn: 'child_tam', level: 3,
    summary: 'Tam swears there is something at the bottom of Whisperwell Cave.',
    detail: '"Everyone says it is just bats. Everyone has not been down there."',
    objectives: [{ type: 'clear', map: 'dungeon_whisper', label: 'Clear Whisperwell Cave' }],
    rewards: { xp: 240, gold: 60, items: ['food_apple'], loot: { level: 5, rarity: 'uncommon' }, rep: [{ faction: 'alliance', amount: 5 }] },
    marker: 'whisperwell',
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
