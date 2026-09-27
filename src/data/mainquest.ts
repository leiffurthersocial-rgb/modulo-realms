import type { QuestDef, QuestReward } from './quests';
import { enemyGoldAt, enemyXpAt } from './balance';

/**
 * The main story of the west: from Whisperwell to the thing under the Last
 * Gate.
 *
 * Three rules shape it, and they are what keep it from being a line of
 * arrows:
 *
 * 1. Every chapter waits on a LEVEL (`prereq.level`). Between chapters the
 *    world is yours — bounties, dungeons, the casino, the forge — and the
 *    tracker says exactly what level the story wants next and where people
 *    of your level go hunting. That gap is the grind, and it is on purpose.
 * 2. Directions, not a compass. `guide: 'discovered'` means the arrow, the
 *    minimap square and the atlas flag only appear once you have found the
 *    place yourself. Until then the tracker prints `hint`: which way from
 *    which town.
 * 3. Bosses the player already felled count. A step asks for a kill that
 *    stays dead, so the log credits a boss from `bossesKilled`, a dungeon
 *    from `clearedDungeons` and a place from `discovered` the moment the step
 *    is taken (`QuestLog.precredit`) — a bounty done early never blocks the
 *    story.
 *
 * Rewards come off the balance curves, not hand-written numbers: a chapter
 * pays about as much experience as thirty ordinary kills of its level and
 * gold like a couple of bosses, and act endings pay a guaranteed piece of
 * gear a rarity above the step before it.
 */

export interface MainAct {
  act: number;
  numeral: string;
  name: string;
  /** One line under the act name in the journal. */
  blurb: string;
}

export const MAIN_ACTS: MainAct[] = [
  { act: 1, numeral: 'I', name: 'Something Left Over', blurb: 'The valley is being divided, and it is not coming out even.' },
  { act: 2, numeral: 'II', name: 'The Wood Grows Inward', blurb: 'Thornhollow felt it first. The grove is growing back into itself.' },
  { act: 3, numeral: 'III', name: 'The Archivist', blurb: 'Somebody measured all of this once. He is still up there counting.' },
  { act: 4, numeral: 'IV', name: 'Four Leaks', blurb: 'Four places at the edges of the world where the remainder gets out.' },
  { act: 5, numeral: 'V', name: 'Deeper Than the Leaks', blurb: 'What the four leaks were lying on.' },
  { act: 6, numeral: 'VI', name: 'What Would Not Divide', blurb: 'Under the Last Gate, the part left over.' },
];

export const MAIN_ACT_BY_NUM: Record<number, MainAct> = Object.fromEntries(MAIN_ACTS.map((a) => [a.act, a]));

type Loot = NonNullable<QuestReward['loot']>['rarity'];

/** A chapter's pay, from the curves. `weight` 1 is an ordinary step, 2 an act's end. */
const pay = (level: number, weight: number, rarity?: Loot): QuestReward => {
  const [lo, hi] = enemyGoldAt(level, 'boss');
  return {
    xp: Math.round(enemyXpAt(level, 'standard') * 30 * weight),
    gold: Math.round(((lo + hi) / 2) * 1.5 * weight),
    loot: { level: level + 1, rarity },
  };
};

export const MAIN_QUESTS: QuestDef[] = [
  /* ------------------------- I. Something Left Over ------------------------- */
  {
    id: 'main_count', name: 'What the Cave Counted', giver: 'elder_hanne', turnIn: 'ivo_marrow',
    level: 2, main: true, act: 1, guide: 'discovered',
    summary: 'Clear Whisperwell Cave to the bottom, then tell Ivo at the Kettle & Crown what you saw.',
    detail: 'A runner from Hanne catches up with you at the cave mouth, out of breath. "She says: go all the way down — the drips here fall the wrong way. Then find Ivo at the inn and tell him. He will pretend not to be interested and then ask you forty questions."',
    hint: 'Whisperwell is south-west of Ashvale. The Kettle & Crown is the inn on the south-east corner of the town square.',
    objectives: [{ type: 'clear', map: 'dungeon_whisper', label: 'Clear Whisperwell Cave' }],
    rewards: { ...pay(3, 1, 'rare'), items: ['potion_health_m', 'potion_health_m'] },
    prereq: { quest: 'tutorial' }, marker: 'whisperwell',
    turnInText: 'Ivo listens to all of it without interrupting, which Bryn later tells you has never happened. "The stones down there weigh the same from every side. Nothing weighs the same from every side." He writes a number, crosses it out, writes it again. "Something is being divided, and it is not coming out even."',
  },
  {
    id: 'main_brood', name: 'Too Many Legs', giver: 'ivo_marrow', turnIn: 'ivo_marrow',
    level: 6, main: true, act: 1, guide: 'discovered',
    summary: 'Thin out the valley, then kill the Brood Mother at the bottom of Ironroot Mine.',
    detail: '"The miners at Ironroot dug into something that counts back. Twelve went down. What came up had too many legs." Ivo taps the table. "Kill whatever is at the bottom and look at the walls while you do it. I want to know if they are numbered."',
    hint: 'Ironroot Mine is north-east of Ashvale: take the east road to Kettle Bridge, then keep north-east past the far shore of the lake.',
    objectives: [
      { type: 'hunt', region: 'central', count: 20, label: 'Hunt in Ashvale Valley' },
      { type: 'boss', enemy: 'mini_broodmother', label: 'Kill the Brood Mother in Ironroot Mine' },
    ],
    rewards: pay(8, 2, 'superRare'),
    prereq: { quest: 'main_count', level: 6 }, marker: 'ironroot_mine',
    turnInText: '"Numbered," Ivo says, before you have finished. "Of course they were." He looks, for a moment, very old. "The Court will have felt this before we did. They feel everything first and tell nobody. Go west and make them tell you."',
  },

  /* ------------------------- II. The Wood Grows Inward ------------------------- */
  {
    id: 'main_court', name: 'Word to the Court', giver: 'ivo_marrow', turnIn: 'warden_ysolde',
    level: 9, main: true, act: 2, guide: 'discovered',
    summary: 'Travel to Thornhollow and speak with Warden Ysolde of the Forest Court.',
    detail: '"The Forest Court answers letters when it suits them. Go in person. Say my name if you want to be thrown out quickly, or do not if you want to be thrown out slowly."',
    hint: 'Thornhollow is due west of Ashvale, up in the old canopy. Ysolde keeps to the village square.',
    objectives: [{ type: 'explore', location: 'thornhollow', label: 'Reach Thornhollow' }],
    rewards: pay(9, 1),
    prereq: { quest: 'main_brood', level: 9 }, marker: 'thornhollow',
    turnInText: 'Ysolde hears Ivo\'s name and does not throw you out, which she seems to find as surprising as you do. "The grove is growing inward. Root into heart, heart into root. The Matriarch held it together for nine hundred years and now she is the thing pulling it apart."',
  },
  {
    id: 'main_matriarch', name: 'The Heart Grown Wrong', giver: 'warden_ysolde', turnIn: 'warden_ysolde',
    level: 12, main: true, act: 2, guide: 'discovered',
    summary: 'Cull the wrong growth around Thornhollow, then lay the Forest Matriarch to rest in the Grove.',
    detail: '"Whatever is wrong with her is getting out through everything she grew. Cut it back first, or you will be fighting the whole wood on the way in."',
    hint: 'The Thornhollow Grove is north-west of Thornhollow village.',
    objectives: [
      { type: 'hunt', region: 'west', count: 30, label: 'Cull Thornhollow' },
      { type: 'boss', enemy: 'boss_matriarch', label: 'Lay the Forest Matriarch to rest' },
    ],
    rewards: pay(13, 2, 'epic'),
    prereq: { quest: 'main_court', level: 12 }, marker: 'grove_temple',
    turnInText: 'Ysolde turns the seed you carried out between two fingers. "Nine hundred years, and at the end she was only holding the leftovers in." A pause. "The clans have a fortress that woke up on its own. That is not a coincidence. Go north and ask Greta."',
  },

  /* ------------------------- III. The Archivist ------------------------- */
  {
    id: 'main_warden', name: 'Stand Down', giver: 'warden_ysolde', turnIn: 'clanmother_greta',
    level: 16, main: true, act: 3, guide: 'discovered',
    summary: 'Go north to Northwatch, then destroy the Stone Warden in the Ruined Fortress.',
    detail: '"The fortress on the border never got the order to stand down. Something gave it a new order instead. Greta at Northwatch will know what it guards."',
    hint: 'Northwatch is far north of Ashvale, against the crag wall. The Ruined Fortress is east of Northwatch.',
    objectives: [
      { type: 'explore', location: 'northwatch', label: 'Reach Northwatch' },
      { type: 'boss', enemy: 'boss_stone_warden', label: 'Destroy the Stone Warden' },
    ],
    rewards: pay(18, 1, 'epic'),
    prereq: { quest: 'main_matriarch', level: 16 }, marker: 'ruined_fortress',
    turnInText: 'Greta spits into the fire. "It was not guarding the pass. It was guarding the road to the Spire." She points north-west without looking. "The archivist up there has been counting for three hundred years. Every winter the count gets louder."',
  },
  {
    id: 'main_spire', name: 'The Archivist', giver: 'clanmother_greta', turnIn: 'ivo_marrow',
    level: 25, main: true, act: 3, guide: 'discovered',
    summary: 'Break the patrols of Crag Reach, then climb the Ashen Spire and end Vareth, the Rimebound.',
    detail: '"The Spire keeps a road of its own. Things walk it. Clear them or they will walk in behind you." Greta hands you a clan knot for luck, then takes it back. "No. Luck is for people who come back."',
    hint: 'The Ashen Spire stands north-west of Northwatch, in the snow.',
    objectives: [
      { type: 'hunt', region: 'north', count: 40, label: 'Hunt in Crag Reach' },
      { type: 'boss', enemy: 'boss_rime_lich', label: 'Defeat Vareth, the Rimebound' },
    ],
    rewards: pay(29, 2, 'legendary'),
    prereq: { quest: 'main_warden', level: 25 }, marker: 'ashen_spire',
    turnInText: 'Ivo reads Vareth\'s ledger for a long time. "He did not cause it. He measured it." He turns the book so you can see four marks at the four edges of the map. "Everything is divided by the Modulo, and four places do not divide cleanly. That is where the remainder gets out. And this —" a fifth mark, under the Last Gate, gone over so many times the page is torn — "is where it all ends up."',
  },

  /* ------------------------- IV. Four Leaks ------------------------- */
  {
    id: 'main_leaks', name: 'Four Leaks', giver: 'ivo_marrow', turnIn: 'ivo_marrow',
    level: 36, main: true, act: 4,
    summary: 'Seal the four leaks Vareth marked at the edges of the world — in any order.',
    detail: '"Four of them. West, east, north, south. Each one has grown something around itself to keep it open. Kill what is holding the door and the leak closes." Ivo underlines the recommended levels in Vareth\'s hand. "He was very precise about how dangerous each one was. I suggest you believe him."',
    hint: 'West: the Deepwood, past Duskhold. East: the Drowned Court, north of Saltwatch. North: the Last Gate, up the White Stair above Vardhold. South: the Caldera, west of Cinderhold.',
    objectives: [
      { type: 'boss', enemy: 'boss_gloam_mother', label: 'West — the Gloaming Itself, in the Deepwood (Lv 39)' },
      { type: 'boss', enemy: 'boss_tide_king', label: 'East — the Tide That Was A King, in the Drowned Court (Lv 47)' },
      { type: 'boss', enemy: 'boss_winter_jarl', label: 'North — Aldrhrim, behind the Last Gate (Lv 56)' },
      { type: 'boss', enemy: 'boss_cinder_maw', label: 'South — Vulgrim, the Cinder Maw, in the Caldera (Lv 58)' },
    ],
    rewards: pay(58, 2, 'legendary'),
    prereq: { quest: 'main_spire', level: 36 },
    turnInText: '"Four sealed." Ivo does not look relieved. "Which means the pressure goes somewhere else. Down." He opens the ledger to its last pages, which are not in Vareth\'s hand. "The leaks were lying on something. Three somethings. He only got as far as naming them."',
  },

  /* ------------------------- V. Deeper Than the Leaks ------------------------- */
  {
    id: 'main_drowned', name: 'What the Water Kept', giver: 'ivo_marrow',
    level: 56, main: true, act: 5, guide: 'discovered',
    summary: 'Go down into the Sunken Hall and end She Who Waited For The Water.',
    detail: '"The Gloaming ran into the sea and the sea kept rising. Something at the bottom of it has been waiting for the water to reach her. It has."',
    hint: 'The Sunken Hall is in the Drowning Reach at the far south-west of the world, south of the raft-town Reedwatch.',
    objectives: [{ type: 'boss', enemy: 'boss_drowned_court', label: 'End She Who Waited For The Water' }],
    rewards: pay(60, 1, 'epic'),
    prereq: { quest: 'main_leaks', level: 56 }, marker: 'the_sunken_hall',
  },
  {
    id: 'main_storm', name: 'What Sits in the Weather', giver: 'ivo_marrow',
    level: 63, main: true, act: 5, guide: 'discovered',
    summary: 'Climb the Standing Rod in the Stormreach and pull down What Sits in the Weather.',
    detail: '"Past the salt, the sky stopped clearing three hundred years ago — the same winter Vareth started counting. I do not believe in coincidences any more. I am not sure I ever did."',
    hint: 'The Standing Rod is in the Stormreach, north-east past the Saltreach. Lastmast is the last town south of it.',
    objectives: [{ type: 'boss', enemy: 'boss_storm_throne', label: 'Pull down What Sits in the Weather' }],
    rewards: pay(67, 1, 'legendary'),
    prereq: { quest: 'main_drowned', level: 63 }, marker: 'the_standing_rod',
  },
  {
    id: 'main_floor', name: 'The Floor of the World', giver: 'ivo_marrow', turnIn: 'warden_sigrun',
    level: 70, main: true, act: 5, guide: 'discovered',
    summary: 'Descend into the Underfloor and break the Floor of the World, then tell Sigrun at Vardhold it is done.',
    detail: '"The last one is underneath everything. When it is gone, the only thing left holding the remainder in is a bar on a door in the ice. Sigrun keeps the bar. She will want to hear it from you."',
    hint: 'The Underfloor is at the very bottom of the world, west of the fire-town called the Banking. Vardhold is the last village in the far north.',
    objectives: [{ type: 'boss', enemy: 'boss_emberdeep', label: 'Break the Floor of the World' }],
    rewards: pay(74, 2, 'legendary'),
    prereq: { quest: 'main_storm', level: 70 }, marker: 'the_underfloor',
    turnInText: 'Sigrun listens with her hand on the bar. "Four hundred years my family has held this. Nobody told us what to do when the holding was over." She lifts it. It is lighter than it looks. "Go down, then. Whatever is at the bottom has been waiting for someone to count it properly."',
  },

  /* ------------------------- VI. What Would Not Divide ------------------------- */
  {
    id: 'main_remainder', name: 'What Would Not Divide', giver: 'warden_sigrun', turnIn: 'elder_hanne',
    level: 74, main: true, act: 6, guide: 'discovered',
    summary: 'Go Under the Gate and end the Remainder. Then go home.',
    detail: '"It talks," Sigrun says. "When it stops talking, it is not finished. It is deciding. Bring fire and more health than you think is silly."',
    hint: 'Under the Gate lies north-east of the Last Gate, at the very top of the world above Vardhold.',
    objectives: [{ type: 'boss', enemy: 'boss_remainder', label: 'End the Remainder' }],
    rewards: pay(75, 3, 'legendary'),
    prereq: { quest: 'main_floor', level: 74 }, marker: 'under_the_gate',
    turnInText: 'Hanne is outside the Moot Hall, where she always is, as though she never left it. "Ivo came by. He cried, which he will deny." She looks east, past the river, where the sky over the sea has started doing something new. "Everything divided evenly, for once. I expect it will not last. It never does. Sit down. Eat something. Then go and see what the storm wants."',
  },
];

/** Every main-story quest in order, the tutorial first. */
export const MAIN_ORDER: string[] = ['tutorial', ...MAIN_QUESTS.map((q) => q.id)];

/**
 * Where each person the story reports to can be found: the settlement the
 * compass may point at once it is known, and the words the tracker prints.
 */
export const MAIN_REPORT: Record<string, { location: string; where: string }> = {
  elder_hanne: { location: 'ashvale', where: 'outside the Moot Hall, Ashvale' },
  ivo_marrow: { location: 'ashvale', where: 'the Kettle & Crown inn, Ashvale' },
  warden_ysolde: { location: 'thornhollow', where: 'Thornhollow' },
  clanmother_greta: { location: 'northwatch', where: 'Northwatch' },
  warden_sigrun: { location: 'vardhold', where: 'Vardhold, in the far north' },
};
