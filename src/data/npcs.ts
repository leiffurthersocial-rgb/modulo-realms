import { PAL } from '../game/art/palette';
import type { Look } from '../game/art/characters';
import type { DialogueChoice, DialogueNode } from '../game/dialogue/types';
import type { FactionId, RaceId } from './races';

export interface ShopDef {
  id: string;
  name: string;
  /** Multiplier applied to buy prices before reputation and race modifiers. */
  priceMod: number;
  /** Item template ids restocked on a timer. */
  stock: Array<{ item: string; qty?: number; level?: number }>;
  /** Extra random gear rolled into the stock. */
  randomGear?: { count: number; level: number };
  buys: Array<'weapon' | 'armor' | 'accessory' | 'consumable' | 'material' | 'misc'>;
  gold: number;
}

export interface ScheduleEntry {
  /** Hour of the in-game day (0-24) this leg starts. */
  at: number;
  /** Tile coordinates on the NPC's map. */
  tx: number;
  ty: number;
  label: string;
}

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  race: RaceId;
  faction: FactionId;
  personality: string;
  map: string;
  tx: number;
  ty: number;
  look: Look;
  shop?: ShopDef;
  quests?: string[];
  schedule?: ScheduleEntry[];
  /** Idle wander radius in pixels. */
  wander?: number;
  /** Greeting lines, first match wins. */
  greeting: Array<{ cond?: DialogueChoice['cond']; lines: string[] }>;
  topics?: DialogueChoice[];
  nodes?: DialogueNode[];
  services?: Array<'inn' | 'heal' | 'train' | 'storage'>;
  /** Hostile to some races, but never refuses essential services. */
  dislikes?: RaceId[];
}

const look = (o: Partial<Look>): Look => ({
  skin: PAL.skin2, hair: '#4a3324', hairStyle: 'short', beard: 'none',
  shirt: '#5a6f86', pants: '#3b3346', boots: '#4a3324', belt: '#33231a',
  armor: 'none', ears: 'human', height: 1, bulk: 1, ...o,
});

const dayJob = (workTx: number, workTy: number, homeTx: number, homeTy: number, socialTx: number, socialTy: number): ScheduleEntry[] => [
  { at: 7, tx: workTx, ty: workTy, label: 'working' },
  { at: 18, tx: socialTx, ty: socialTy, label: 'at the tavern' },
  { at: 22, tx: homeTx, ty: homeTy, label: 'at home' },
];


/* ------------------------------------------------------------------ */
/* The wandering forge-kin                                             */
/* ------------------------------------------------------------------ */

interface TraderSpec {
  id: string;
  name: string;
  title: string;
  personality: string;
  tx: number;
  ty: number;
  where: string;
  level: number;
  hair: string;
  coat: string;
  line: string;
  stock: string[];
}

/**
 * A family of dwarven smiths who follow the waystone network. One sets up at
 * every major point of interest, so there is always somewhere to spend loot.
 */
const TRADER_SPECS: TraderSpec[] = [
  { id: 'trader_dvalin', name: 'Dvalin Hearthspark', title: 'Wandering Smith', personality: 'Loud, delighted by his own work, impossible to insult.',
    tx: 197, ty: 186, where: 'Ashvale', level: 4, hair: '#b5462f', coat: '#6a4436',
    line: '"You came to the right cart. My brother will tell you otherwise. My brother is wrong about most things."',
    stock: ['sword_steel', 'axe_iron', 'bow_yew', 'armor_leather', 'shield_iron', 'potion_health_m', 'mat_iron_ingot'] },
  { id: 'trader_regin', name: 'Regin Coalbraid', title: 'Wandering Smith', personality: 'Dry, precise, keeps a running tally of his brother\'s errors.',
    tx: 193, ty: 90, where: 'Northwatch', level: 11, hair: '#4a3324', coat: '#3f4a6a',
    line: '"Whatever Dvalin sold you, I can fix it. That is the arrangement we have with each other and with the world."',
    stock: ['greatsword_crag', 'hammer_stone', 'armor_frostguard', 'shield_tower', 'art_iron_hide', 'potion_health_l', 'mat_steel_ingot'] },
  { id: 'trader_volund', name: 'Volund Deepvein', title: 'Wandering Smith', personality: 'Soft-spoken, deeply superstitious about the water.',
    tx: 303, ty: 201, where: 'Mirefall', level: 8, hair: '#8a6a3a', coat: '#4a5a3a',
    line: '"Do not put anything I sell you in the water. I mean that as a smith and as a man who has seen things."',
    stock: ['scythe_grave', 'dagger_shadow', 'armor_wolfhide', 'tome_off', 'art_death_cap', 'antidote', 'mat_essence'] },
  { id: 'trader_fafnar', name: 'Fafnar Saltgrin', title: 'Wandering Smith', personality: 'Relentlessly cheerful about extremely bad odds.',
    tx: 201, ty: 297, where: 'Duneholt', level: 10, hair: '#d8cfc4', coat: '#a3823f',
    line: '"Cutters took my last cart. I built a better one. That is how it goes, and I have very good carts now."',
    stock: ['spear_pike', 'crossbow_iron', 'armor_scout', 'art_swift_boots', 'art_ember_totem', 'potion_might', 'mat_gem_ruby'] },
  { id: 'trader_otrys', name: 'Otrys Greenanvil', title: 'Wandering Smith', personality: 'Patient, elvish-trained, mildly embarrassed about it.',
    tx: 87, ty: 191, where: 'Thornhollow', level: 9, hair: '#5b9247', coat: '#2d4a2f',
    line: '"The Court let me build a forge in their wood. They watch it the way you would watch a fire in a library."',
    stock: ['bow_court', 'staff_ember', 'armor_hunter', 'armor_acolyte', 'art_wolf_fang', 'potion_focus', 'mat_crystal'] },
  { id: 'trader_brynja', name: 'Brynja Ashgrid', title: 'Wandering Smith', personality: 'Terse. Sets up wherever the digging is worst.',
    tx: 267, ty: 161, where: 'Ironroot Mine', level: 7, hair: '#2a2029', coat: '#5a5060',
    line: '"Mine mouth is a good pitch. People come out needing everything and carrying money they did not have going in."',
    stock: ['crossbow_heavy', 'mace_iron', 'armor_mail', 'torch_off', 'art_healing_sigil', 'potion_health_m', 'mat_rune'] },
  { id: 'trader_orin', name: 'Orin Gravehand', title: 'Wandering Smith', personality: 'Unbothered by the crypt. Slightly bothered by his family.',
    tx: 121, ty: 271, where: 'the Barrow Crypt', level: 13, hair: '#d8cfc4', coat: '#2f3346',
    line: '"Somebody has to sell torches to people who walk into tombs. It may as well be the one who is not afraid of them."',
    stock: ['greatsword_grave', 'sword_frost', 'armor_barrow', 'shield_barrow', 'art_harvester', 'elixir_grand', 'mat_rune'] },
];

const WANDERING_TRADERS: NpcDef[] = TRADER_SPECS.map((t) => ({
  id: t.id,
  name: t.name,
  title: t.title,
  race: 'dwarf' as const,
  faction: 'guild' as const,
  personality: t.personality,
  map: 'overworld',
  tx: t.tx,
  ty: t.ty,
  look: look({
    skin: PAL.skin3, hair: t.hair, hairStyle: 'braid', beard: 'long',
    height: 0.86, bulk: 1.2, shirt: t.coat, pants: '#3a2f28',
    armor: 'light', armorColor: t.coat, armorTrim: PAL.copper,
    weapon: { kind: 'hammer', metal: PAL.iron, grip: '#2a1c14' },
  }),
  wander: 18,
  shop: {
    id: `shop_${t.id}`,
    name: `${t.name}'s Cart`,
    priceMod: 1.04,
    stock: t.stock.map((item) => ({ item })),
    randomGear: { count: 5, level: t.level },
    buys: ['weapon', 'armor', 'accessory', 'material', 'consumable'],
    gold: 600 + t.level * 120,
  },
  greeting: [
    { cond: { races: ['dwarf'] }, lines: [`"Deepstone! Sit down, do not sit down, buy something either way."`, t.line] },
    { lines: [`The cart is parked beside the ${t.where} waystone, forge still warm.`, t.line] },
  ],
  topics: [
    { text: 'Why set up out here?', to: 'why' },
    { text: 'Tell me about your family.', to: 'family' },
  ],
  nodes: [
    { id: 'why', text: ['"The gates move us faster than any road. Where the gate goes, the cart goes."', '"And people who have just walked out of somewhere terrible buy generously."'] },
    { id: 'family', text: ['"Seven of us. One forge between the lot, split seven ways across the valley."', '"We argue by letter. It is the only way any of us stays civil."'] },
  ],
}));

export const NPCS: NpcDef[] = [
  /* ------------------------------ Ashvale ------------------------------ */
  {
    id: 'elder_hanne', name: 'Elder Hanne', title: 'Elder of Ashvale', race: 'human', faction: 'alliance',
    personality: 'Dry, unhurried, has already thought of the thing you are about to say.',
    map: 'overworld', tx: 194, ty: 186,
    look: look({ hair: '#d8cfc4', hairStyle: 'braid', shirt: '#4a5a7a', pants: '#3b3346', armor: 'robe', armorColor: '#4a5a7a', armorTrim: PAL.gold }),
    quests: ['tutorial'],
    schedule: dayJob(194, 186, 192, 178, 205, 184),
    wander: 40,
    greeting: [
      { cond: { races: ['revenant'] }, lines: ['Hanne looks at you a moment longer than is polite.', '"You are cold, and you are standing in my square. Welcome to Ashvale, all the same."'] },
      { cond: { races: ['orc'] }, lines: ['"Ashborn. Good. The wolves will think twice."', '"Some in town will not. Ignore them, they pay their taxes late anyway."'] },
      { lines: ['"You look like someone who walked a long way to find a small town."', '"Ashvale will take you. It takes everyone. That is the whole trouble with it."'] },
    ],
    topics: [
      { text: 'What is this place?', to: 'about_town' },
      { text: 'What happened here?', to: 'about_trouble' },
      { tag: 'Mage', text: 'The valley is thick with loose magic. Something is leaking.', cond: { classes: ['mage', 'necromancer'] }, to: 'about_magic' },
      { tag: 'Warrior', text: 'Point me at whatever needs killing.', cond: { classes: ['warrior', 'paladin'] }, to: 'about_trouble' },
      { tag: 'Elf', text: 'The Forest Court sends no word to you?', cond: { races: ['elf'] }, to: 'about_court' },
    ],
    nodes: [
      { id: 'about_town', text: ['"Ashvale. Four hundred people, one forge, one inn, and a river that floods every third spring."', '"We are the last town between the valley and everything that wants into it."'] },
      { id: 'about_trouble', text: ['"Wolves first. Then bandits with money they did not earn. Then the fortress in the north woke up."', '"Things come in waves here, and the waves are getting closer together."'] },
      { id: 'about_magic', text: ['"You feel it too. Good — I was starting to think I was old rather than right."', '"Ivo calls it the Modulo. A thing the world divides itself by. He talks like that when he is frightened."'] },
      { id: 'about_court', text: ['"Thornhollow answers letters when it suits them, which is never in spring."', '"If you carry word west, they may listen to one of their own."'] },
    ],
  },
  {
    id: 'smith_corin', name: 'Corin Emberhand', title: 'Blacksmith', race: 'dwarf', faction: 'guild',
    personality: 'Blunt, fair, secretly proud of every blade he sells.',
    map: 'overworld', tx: 204, ty: 206,
    look: look({ skin: PAL.skin3, hair: '#b5462f', hairStyle: 'short', beard: 'long', height: 0.86, bulk: 1.18, shirt: '#6a4436', pants: '#3a2f28', armor: 'light', armorColor: '#5a4436', weapon: { kind: 'hammer', metal: PAL.iron, grip: PAL.woodDark } }),
    schedule: dayJob(204, 206, 208, 200, 205, 184),
    wander: 26,
    shop: {
      id: 'shop_corin', name: "Emberhand's Forge", priceMod: 1,
      stock: [
        { item: 'sword_iron' }, { item: 'axe_iron' }, { item: 'mace_iron' }, { item: 'dagger_iron' },
        { item: 'spear_hunt' }, { item: 'greatsword_iron' }, { item: 'shield_wood' }, { item: 'shield_iron' },
        { item: 'armor_leather' }, { item: 'armor_leather' }, { item: 'armor_traveller' }, { item: 'armor_leather' },
        { item: 'armor_mail' }, { item: 'armor_mail' }, { item: 'mat_iron_ingot', qty: 5 },
      ],
      randomGear: { count: 4, level: 5 },
      buys: ['weapon', 'armor', 'accessory', 'material'], gold: 900,
    },
    services: ['train'],
    greeting: [
      { cond: { races: ['dwarf'] }, lines: ['"Deepstone? Ha. Sit, do not sit, whatever you like — you will get Guild prices either way."'] },
      { cond: { races: ['orc'] }, lines: ['"Ashborn hands break Ashvale hafts. I will sell you the heavy stock."'] },
      { lines: ['"Mind the sparks. Everything on the rack is honest; everything off it is negotiable."'] },
    ],
    topics: [
      { text: 'Tell me about your work.', to: 'about_work' },
      { tag: 'Dwarf', text: 'Ironroot temper, or valley steel?', cond: { races: ['dwarf'] }, to: 'about_steel' },
      { tag: 'Rogue', text: 'And if I wanted something the guards never see?', cond: { classes: ['rogue'] }, to: 'about_quiet' },
    ],
    nodes: [
      { id: 'about_work', text: ['"Forty years at this anvil. I have shod horses, sealed coffins and once mended a chapel bell."', '"Bring me iron and I will keep you alive longer than any prayer."'] },
      { id: 'about_steel', text: ['"Ironroot temper, and do not let Brigga tell you otherwise. She folds too many times and calls it craft."'] },
      { id: 'about_quiet', text: ['Corin does not look up from the anvil.', '"Rook drinks behind the inn. I did not say that, and you did not hear it over the hammer."'], choices: [{ text: 'Understood.', actions: [{ type: 'flag', flag: 'knows_rook' }] }] },
    ],
  },
  {
    id: 'merchant_pell', name: 'Pell', title: 'General Merchant', race: 'human', faction: 'alliance',
    personality: 'Cheerful, exhausting, would sell you your own boots.',
    map: 'overworld', tx: 187, ty: 189,
    look: look({ hair: '#8a6a3a', hairStyle: 'ponytail', shirt: '#7a5a3a', pants: '#4a3a2a', armor: 'light', armorColor: '#8a6a4a' }),
    schedule: dayJob(187, 189, 199, 212, 205, 184),
    wander: 20,
    shop: {
      id: 'shop_pell', name: "Pell's Stall", priceMod: 1.05,
      stock: [
        { item: 'potion_health_s', qty: 8 }, { item: 'potion_mana_s', qty: 6 }, { item: 'potion_stamina', qty: 5 },
        { item: 'food_bread', qty: 8 }, { item: 'food_cheese', qty: 6 }, { item: 'food_apple', qty: 8 }, { item: 'food_meat', qty: 4 },
        { item: 'torch_off' }, { item: 'art_swift_boots' }, { item: 'mat_cloth', qty: 4 }, { item: 'mat_leather', qty: 4 },
        { item: 'antidote', qty: 3 },
      ],
      randomGear: { count: 2, level: 3 },
      buys: ['weapon', 'armor', 'accessory', 'consumable', 'material', 'misc'], gold: 700,
    },
    greeting: [
      { cond: { races: ['beastfolk'] }, lines: ['"Beastfolk! Marvellous. You lot always need boots. Always."'] },
      { lines: ['"Everything on the board, half of it useful, all of it cheaper than Duneholt."'] },
    ],
    topics: [
      { text: 'Heard any news?', to: 'news' },
      { tag: 'Human', text: 'Valley prices for valley folk?', cond: { races: ['human'] }, to: 'discount' },
    ],
    nodes: [
      { id: 'news', text: ['"Caravans out of Duneholt stopped last month. Cutters, they say."', '"Also Maren lost a ring, and Bram lost an argument. Slow week."'] },
      { id: 'discount', text: ['"For you? A knockdown. A steal. A price I will regret."', 'It is, in fact, the same price.'] },
    ],
  },
  {
    id: 'innkeeper_bryn', name: 'Bryn Tallow', title: 'Innkeeper', race: 'beastfolk', faction: 'alliance',
    personality: 'Warm, nosy, remembers every name that comes through the door.',
    map: 'int_inn', tx: 20, ty: 4,
    look: look({ skin: PAL.skinBeast, hair: '#6b4b34', hairStyle: 'wild', ears: 'beast', eyes: PAL.gold, shirt: '#8a6a4a', pants: '#4a3a2a', armor: 'light', armorColor: '#9a7046' }),
    wander: 12,
    services: ['inn'],
    shop: {
      id: 'shop_bryn', name: 'The Kettle & Crown', priceMod: 1,
      stock: [{ item: 'food_bread', qty: 10 }, { item: 'food_meat', qty: 6 }, { item: 'food_cheese', qty: 6 }, { item: 'potion_health_s', qty: 4 }, { item: 'potion_stamina', qty: 4 }],
      buys: ['consumable', 'material'], gold: 400,
    },
    greeting: [
      { cond: { races: ['beastfolk'] }, lines: ['"Ha! Ears like mine. Sit anywhere, the fire is yours."'] },
      { cond: { races: ['revenant'] }, lines: ['"You will not want the stew, I suppose. Bed is twenty either way."'] },
      { lines: ['"Bed upstairs, stew in the pot, and whatever you overhear stays in the room."'] },
    ],
    topics: [
      { text: 'Who drinks here?', to: 'patrons' },
      { tag: 'Paladin', text: 'Has the chapel been kept?', cond: { classes: ['paladin'] }, to: 'chapel' },
    ],
    nodes: [
      { id: 'patrons', text: ['"Guards, mostly. Corin when his hands ache. Ivo when he wants an audience."', '"And Rook, who does not drink so much as wait."'], choices: [{ text: 'Rook?', actions: [{ type: 'flag', flag: 'knows_rook' }], to: 'rook' }, { text: 'I see.' }] },
      { id: 'rook', text: ['"Sits out back. Buys things that have no owner. Do not tell Dara I told you."'] },
      { id: 'chapel', text: ['"Father Alun keeps it lit. Not many go, but he keeps it lit."'] },
    ],
  },
  {
    id: 'alchemist_sable', name: 'Sable Quill', title: 'Apothecary', race: 'elf', faction: 'arcane',
    personality: 'Precise, faintly amused by everyone, including herself.',
    map: 'overworld', tx: 168, ty: 196,
    look: look({ skin: PAL.skinElf, hair: '#9578e8', hairStyle: 'long', ears: 'elf', eyes: '#2f6f93', shirt: '#4a3a6a', pants: '#2b1f4d', armor: 'robe', armorColor: '#4a3a6a', armorTrim: PAL.frost }),
    schedule: dayJob(168, 196, 170, 190, 205, 184),
    wander: 22,
    shop: {
      id: 'shop_sable', name: "Sable's Apothecary", priceMod: 1.08,
      stock: [
        { item: 'potion_health_s', qty: 6 }, { item: 'potion_health_m', qty: 4 }, { item: 'potion_mana_s', qty: 6 },
        { item: 'potion_mana_m', qty: 4 }, { item: 'potion_might', qty: 2 }, { item: 'potion_swift', qty: 2 },
        { item: 'potion_focus', qty: 2 }, { item: 'antidote', qty: 5 }, { item: 'mat_herb', qty: 6 }, { item: 'mat_crystal', qty: 3 },
        { item: 'art_ember_totem' },
      ],
      buys: ['consumable', 'material', 'accessory'], gold: 800,
    },
    services: ['heal'],
    greeting: [
      { cond: { classes: ['mage', 'necromancer'] }, lines: ['"Oh good. Someone who will not ask whether the green one is poison."', '"It is. That is the point of it."'] },
      { cond: { races: ['orc'] }, lines: ['"Big hands, small bottles. Try not to."'] },
      { lines: ['"Everything here either heals you or teaches you something. Occasionally both."'] },
    ],
    topics: [
      { text: 'What are you working on?', to: 'work' },
      { tag: 'Necromancer', text: 'You keep bone dust behind the counter.', cond: { classes: ['necromancer'] }, to: 'bone' },
      { tag: 'Elf', text: 'You are far from the Court.', cond: { races: ['elf'] }, to: 'court' },
    ],
    nodes: [
      { id: 'work', text: ['"A tonic that stops frostbite. It works perfectly, twice out of three."', '"I do not sell the third."'] },
      { id: 'bone', text: ['"I do. It is an excellent binder and a terrible conversation."', '"Take it. Do not tell Alun."'], choices: [{ text: 'Thank you.', actions: [{ type: 'give', item: 'mat_bone', qty: 3 }, { type: 'rep', faction: 'arcane', amount: 3 }] }] },
      { id: 'court', text: ['"The Court asks that we tend the wood. I asked what the wood had done for me."', '"So: Ashvale."'] },
    ],
  },
  {
    id: 'priest_alun', name: 'Father Alun', title: 'Keeper of the Chapel', race: 'human', faction: 'alliance',
    personality: 'Gentle, stubborn, has buried more people than he will mention.',
    map: 'int_chapel', tx: 8, ty: 7,
    look: look({ hair: '#d8cfc4', hairStyle: 'bald', beard: 'full', shirt: '#c9c0a8', pants: '#8a8070', armor: 'robe', armorColor: '#c9c0a8', armorTrim: PAL.gold }),
    services: ['heal'],
    wander: 10,
    greeting: [
      { cond: { classes: ['paladin'] }, lines: ['"An oathbearer. The valley has been short of those."', '"Rest here as long as you need. The light does not charge rent."'] },
      { cond: { races: ['revenant'] }, lines: ['"Sit if you like. I have never been sure the light minds, and I have asked."'] },
      { lines: ['"You are welcome here, whoever you are and whatever you have done on the road."'] },
    ],
    topics: [
      { text: 'Will you tend my wounds?', to: 'heal_node' },
      { tag: 'Necromancer', text: 'Your light and my work are not so different.', cond: { classes: ['necromancer'] }, to: 'argue' },
    ],
    nodes: [
      { id: 'heal_node', text: ['"Hold still."', 'Warmth spreads through you.'], onEnter: [{ type: 'heal' }] },
      { id: 'argue', text: ['"They are entirely different, and you know it, and I will still heal you in the morning."', 'He does not sound angry. That is somehow worse.'] },
    ],
  },
  {
    id: 'hunter_kesh', name: 'Kesh', title: 'Hunter', race: 'beastfolk', faction: 'forest',
    personality: 'Quiet, watchful, more comfortable outside town than in it.',
    map: 'overworld', tx: 180, ty: 197,
    look: look({ skin: PAL.skinBeast, hair: '#a3823f', hairStyle: 'ponytail', ears: 'beast', eyes: PAL.gold, shirt: '#3f6a4a', pants: '#4a3324', armor: 'light', armorColor: '#4a5a3a', helmet: 'hood', weapon: { kind: 'bow', metal: PAL.wood, grip: PAL.woodDark } }),
    schedule: dayJob(180, 197, 187, 216, 205, 184),
    wander: 30,
    shop: {
      id: 'shop_kesh', name: "Kesh's Kit", priceMod: 0.98,
      stock: [{ item: 'bow_hunting' }, { item: 'bow_yew' }, { item: 'crossbow_iron' }, { item: 'armor_traveller' }, { item: 'armor_leather' }, { item: 'art_wolf_fang' }, { item: 'food_meat', qty: 5 }],
      randomGear: { count: 3, level: 6 },
      buys: ['weapon', 'armor', 'material'], gold: 600,
    },
    greeting: [
      { cond: { classes: ['ranger'] }, lines: ['"You hold a bow like someone who has waited in the cold for one."', '"We will get along."'] },
      { lines: ['"The wood is loud this year. That is not a good sign, whatever Pell says."'] },
    ],
    topics: [{ text: 'Loud how?', to: 'loud' }],
    nodes: [{ id: 'loud', text: ['"Birds where birds should not be. Deer running at noon."', '"Something in Thornhollow is moving them. I would like to know what before it reaches the fences."'] }],
  },
  {
    id: 'fence_rook', name: 'Rook', title: 'Dealer in Lost Property', race: 'human', faction: 'bandits',
    personality: 'Soft-spoken, entirely transactional.',
    map: 'overworld', tx: 212, ty: 186,
    look: look({ hair: '#2a2029', hairStyle: 'short', shirt: '#3b3346', pants: '#241d2e', armor: 'light', armorColor: '#33304a', helmet: 'hood', weapon: { kind: 'dagger', metal: PAL.iron, grip: PAL.woodDark } }),
    wander: 8,
    shop: {
      id: 'shop_rook', name: 'Rook (no sign)', priceMod: 1.2,
      stock: [{ item: 'dagger_shadow' }, { item: 'art_death_cap' }, { item: 'potion_health_m', qty: 3 }, { item: 'art_swift_boots' }, { item: 'mat_gem_ruby' }],
      randomGear: { count: 5, level: 9 },
      buys: ['weapon', 'armor', 'accessory', 'material', 'misc'], gold: 1500,
    },
    greeting: [
      { cond: { classes: ['rogue'] }, lines: ['"You found the back of the inn without asking. That is the interview."'] },
      { cond: { repMin: { faction: 'bandits', value: 20 } }, lines: ['"The Cutters speak well of you. That is rarely a compliment, but it is useful."'] },
      { lines: ['"I buy what has stopped belonging to anyone. Do not make it complicated."'] },
    ],
    topics: [
      { text: 'Who do you work for?', to: 'who' },
      { tag: 'Rogue', text: 'How much not to tell the guards you are here?', cond: { classes: ['rogue'] }, to: 'blackmail' },
    ],
    nodes: [
      { id: 'who', text: ['"Myself, mostly. The Cutters when the roads are bad and they always are."'] },
      { id: 'blackmail', text: ['Rook laughs once, quietly.', '"Fifty. Not because you frighten me — because I like an honest opening."'], choices: [{ text: 'Take the fifty.', actions: [{ type: 'gold', amount: 50 }, { type: 'rep', faction: 'alliance', amount: -3 }, { type: 'rep', faction: 'bandits', amount: 5 }] }, { text: 'Keep it. I would rather be owed.', actions: [{ type: 'rep', faction: 'bandits', amount: 8 }] }] },
    ],
  },

  /* ------------------------------ Northwatch ------------------------------ */
  {
    id: 'clanmother_greta', name: 'Clanmother Greta', title: 'Clanmother of Northwatch', race: 'orc', faction: 'northern',
    personality: 'Imposing, fair, measures people by what they finish.',
    map: 'overworld', tx: 190, ty: 88,
    look: look({ skin: PAL.skinOrc, hair: '#d8cfc4', hairStyle: 'braid', tusks: true, height: 1.12, bulk: 1.25, eyes: PAL.ember, armor: 'heavy', armorColor: '#5a5060', armorTrim: PAL.copper, cape: '#8fc4dc', weapon: { kind: 'greataxe', metal: PAL.ironLit, grip: PAL.woodDark } }),
    wander: 20,
    greeting: [
      { cond: { races: ['orc'] }, lines: ['"Ashborn walks into a hold that is not hers and does not lower her eyes. Good."'] },
      { cond: { races: ['elf'] }, lines: ['Greta studies you.', '"Court blood in my hall. Do not touch the fire and we will have no quarrel."'] },
      { lines: ['"Valley-folk. You came a long way up a cold road. Say why, and say it once."'] },
    ],
    topics: [
      { text: 'What happened to your clan?', to: 'clan' },
      { tag: 'Warrior', text: 'Your raiders picked a fight they will lose.', cond: { classes: ['warrior', 'paladin'] }, to: 'fight' },
    ],
    nodes: [
      { id: 'clan', text: ['"Half went to the war camp with my brother. Half stayed with the roofs and the children."', '"I kept the roofs. It is not the story the songs want."'] },
      { id: 'fight', text: ['"They picked it with me, not with you."', '"But if you thin them, I will not pretend to mourn."'] },
    ],
  },
  {
    id: 'smith_haldor', name: 'Haldor Stonefist', title: 'Clan Smith', race: 'dwarf', faction: 'northern',
    personality: 'Terse. Exceptionally good at exactly one thing.',
    map: 'overworld', tx: 186, ty: 92,
    look: look({ skin: PAL.skin3, hair: '#4a3324', beard: 'full', height: 0.86, bulk: 1.2, shirt: '#4a5a6a', pants: '#3a2f28', armor: 'light', armorColor: '#5a5060', weapon: { kind: 'hammer', metal: PAL.steel, grip: PAL.woodDark } }),
    wander: 14,
    shop: {
      id: 'shop_haldor', name: 'Northwatch Forge', priceMod: 1.02,
      stock: [{ item: 'greataxe_clan' }, { item: 'hammer_iron' }, { item: 'greatsword_crag' }, { item: 'armor_guard' }, { item: 'armor_guard' }, { item: 'armor_guard' }, { item: 'armor_guard' }, { item: 'shield_tower' }, { item: 'mat_steel_ingot', qty: 4 }],
      randomGear: { count: 4, level: 11 },
      buys: ['weapon', 'armor', 'material'], gold: 1400,
    },
    greeting: [{ lines: ['"Cold steel for cold country. Take your time, do not touch the quench."'] }],
  },

  /* ------------------------------ Mirefall ------------------------------ */
  {
    id: 'trader_yss', name: 'Yss', title: 'Mire Trader', race: 'beastfolk', faction: 'alliance',
    personality: 'Careful, superstitious, counts everything twice.',
    map: 'overworld', tx: 300, ty: 206,
    look: look({ skin: '#8a6a4a', hair: '#2a2029', hairStyle: 'wild', ears: 'beast', eyes: PAL.toxic, shirt: '#4a5a3a', pants: '#3a3a2a', armor: 'light', armorColor: '#5a6a4a', helmet: 'hood' }),
    wander: 16,
    shop: {
      id: 'shop_yss', name: 'Mirefall Exchange', priceMod: 1.12,
      stock: [{ item: 'antidote', qty: 6 }, { item: 'potion_health_m', qty: 4 }, { item: 'scythe_grave' }, { item: 'armor_hunter' }, { item: 'armor_scout' }, { item: 'mat_essence', qty: 2 }],
      randomGear: { count: 4, level: 9 },
      buys: ['weapon', 'armor', 'accessory', 'consumable', 'material'], gold: 900,
    },
    greeting: [
      { lines: ['"Sell fast, leave faster. The water listens after dark."'] },
    ],
    topics: [{ text: 'Listens?', to: 'listens' }],
    nodes: [{ id: 'listens', text: ['"Say a name twice at the waterline and something answers in your own voice."', '"I have done it once. I will not do it again."'] }],
  },
  {
    id: 'witch_nel', name: 'Nel of the Reeds', title: 'Bog Witch', race: 'human', faction: 'arcane',
    personality: 'Cryptic on purpose, warm underneath it.',
    map: 'overworld', tx: 304, ty: 209,
    look: look({ skin: PAL.skin3, hair: '#5f7a3a', hairStyle: 'long', shirt: '#3a4a2a', pants: '#2b361f', armor: 'robe', armorColor: '#3a4a2a', helmet: 'hood', eyes: PAL.toxic, weapon: { kind: 'staff', metal: PAL.wood, grip: PAL.woodDark, glow: PAL.toxic } }),
    wander: 12,
    services: ['heal'],
    greeting: [
      { cond: { classes: ['necromancer', 'mage'] }, lines: ['"You have been reading things that read back. I can smell it."'] },
      { lines: ['"Everyone who comes here is looking for something they lost on purpose."'] },
    ],
    topics: [{ text: 'What is under the mire?', to: 'under' }],
    nodes: [{ id: 'under', text: ['"A town. Older than Ashvale, ruder than Duneholt."', '"It went under in one night, and the shrine above it still takes offerings."'] }],
  },

  /* ------------------------------ Thornhollow ------------------------------ */
  {
    id: 'warden_ysolde', name: 'Warden Ysolde', title: 'Warden of the Forest Court', race: 'elf', faction: 'forest',
    personality: 'Formal, grieving, holds the Court to a standard it no longer meets.',
    map: 'overworld', tx: 84, ty: 190,
    look: look({ skin: PAL.skinElf, hair: '#e8c27a', hairStyle: 'long', ears: 'elf', eyes: '#2f6f93', shirt: '#2d4a2f', pants: '#1e3324', armor: 'light', armorColor: '#3c6b39', armorTrim: PAL.leafLit, cape: '#25412a', helmet: 'circlet', weapon: { kind: 'bow', metal: PAL.leafLit, grip: PAL.woodDark } }),
    wander: 18,
    greeting: [
      { cond: { races: ['elf'] }, lines: ['"You return to the wood and the wood notices. Be careful what it decides that means."'] },
      { cond: { races: ['orc'] }, lines: ['Ysolde\'s hand does not leave her bow, but she inclines her head.', '"Ashborn. The Court remembers the crag wars. I was not there. Speak."'] },
      { lines: ['"Outsider. The canopy will allow it, since I do."'] },
    ],
    topics: [
      { text: 'What is happening in the grove?', to: 'grove' },
      { tag: 'Ranger', text: 'I have tracked what comes out of it. It is spreading.', cond: { classes: ['ranger'] }, to: 'track' },
    ],
    nodes: [
      { id: 'grove', text: ['"The Matriarch was the root that held Thornhollow. Something split her from the wood."', '"Now she grows the wrong way, and the wood grows with her."'] },
      { id: 'track', text: ['"You have. I have read your trail-sign on the old road."', '"Then you already know the Court cannot fix this with ceremony."'], choices: [{ text: 'Let me end it.', actions: [{ type: 'rep', faction: 'forest', amount: 6 }], to: 'grove' }] },
    ],
  },
  {
    id: 'quartermaster_lirien', name: 'Lirien', title: 'Court Quartermaster', race: 'elf', faction: 'forest',
    personality: 'Efficient, bone-dry, keeps a ledger of favours.',
    map: 'overworld', tx: 88, ty: 186,
    look: look({ skin: PAL.skinElf, hair: '#d8cfc4', hairStyle: 'ponytail', ears: 'elf', shirt: '#3c6b39', pants: '#25412a', armor: 'light', armorColor: '#4a7a42' }),
    wander: 14,
    shop: {
      id: 'shop_lirien', name: 'Court Stores', priceMod: 1.05,
      stock: [{ item: 'bow_court' }, { item: 'bow_yew' }, { item: 'armor_hunter' }, { item: 'armor_scout' }, { item: 'armor_concord' }, { item: 'staff_ember' }, { item: 'potion_mana_m', qty: 4 }, { item: 'art_ember_totem' }],
      randomGear: { count: 4, level: 10 },
      buys: ['weapon', 'armor', 'accessory', 'material'], gold: 1200,
    },
    greeting: [
      { cond: { repMin: { faction: 'forest', value: 30 } }, lines: ['"Court prices. You have earned them; do not mention it in front of others."'] },
      { lines: ['"Stock is stock. Haggling is noise."'] },
    ],
  },

  /* ------------------------------ Duneholt ------------------------------ */
  {
    id: 'dwarf_brigga', name: 'Brigga Ashvein', title: 'Guild Factor', race: 'dwarf', faction: 'guild',
    personality: 'Sharp, funny, ruthless about margins.',
    map: 'overworld', tx: 198, ty: 302,
    look: look({ skin: PAL.skin2, hair: '#b5462f', hairStyle: 'braid', beard: 'none', height: 0.86, bulk: 1.15, shirt: '#8a6a3a', pants: '#4a3a2a', armor: 'light', armorColor: '#a3823f', armorTrim: PAL.gold }),
    wander: 16,
    shop: {
      id: 'shop_brigga', name: 'Guild Factorage', priceMod: 1.15,
      stock: [{ item: 'armor_ironroot' }, { item: 'sword_valley' }, { item: 'spear_pike' }, { item: 'art_iron_hide' }, { item: 'art_iron_hide' }, { item: 'potion_health_l', qty: 3 }, { item: 'mat_gem_sapphire' }],
      randomGear: { count: 5, level: 12 },
      buys: ['weapon', 'armor', 'accessory', 'material'], gold: 2000,
    },
    greeting: [
      { cond: { races: ['dwarf'] }, lines: ['"Deepstone rates, then. Which are the same rates, but I say them warmly."'] },
      { lines: ['"Duneholt pays the Cutters not to burn it, and you are paying me. Everyone is paying someone."'] },
    ],
    topics: [{ text: 'Why fund an expedition now?', to: 'why' }],
    nodes: [{ id: 'why', text: ['"Because the tomb opened by itself, and things that open by themselves are cheaper to loot than to explain."'] }],
  },

  /* ------------------------------ the crown ------------------------------ */
  {
    id: 'king_jovan', name: 'King Jovan', title: 'Glorious King of the Ashvale Crown', race: 'human', faction: 'alliance',
    personality: 'Generous to a fault, genuinely warm, and quietly terrified of how little time is left.',
    map: 'int_hall', tx: 11, ty: 5,
    look: look({
      skin: PAL.skin2, hair: '#4a3324', hairStyle: 'long', beard: 'full', eyes: '#5a3f28',
      height: 1.12, bulk: 1.06,
      shirt: '#3d2f5a', pants: '#2a2038',
      armor: 'heavy', armorColor: '#c9b07a', armorTrim: PAL.goldLit,
      helmet: 'crown', cape: '#6a2436',
      weapon: { kind: 'sword', metal: PAL.goldLit, grip: '#3a2418', glow: PAL.holy },
    }),
    wander: 10,
    greeting: [
      { cond: { races: ['revenant'] }, lines: [
        'The king looks up, and does not flinch, which is more than most manage.',
        '"They tell me you are cold to the touch. They tell me a great many things about my subjects."',
        '"You are welcome in my hall regardless. Sit. Eat something."',
      ] },
      { cond: { races: ['orc'] }, lines: [
        '"Ashborn. My grandfather fought yours in the crags and neither of them enjoyed it."',
        '"I would rather we skipped that part. Tell me what the valley needs."',
      ] },
      { lines: [
        'The king is tall, broad-shouldered, and has the brown eyes of somebody who sleeps badly.',
        '"You are the one from Ashvale. Good. Nobody in this hall will tell me anything true."',
      ] },
    ],
    topics: [
      { text: 'Why are you here, and not in the capital?', to: 'why_here' },
      { text: 'What do you know about the Modulo?', to: 'modulo' },
      { tag: 'Paladin', text: 'My oath is to the last lit shrine, not to a crown.', cond: { classes: ['paladin'] }, to: 'oath' },
      { tag: 'Rogue', text: 'Your hall has very poor locks.', cond: { classes: ['rogue'] }, to: 'locks' },
      { tag: 'Elf', text: 'The Forest Court does not recognise your crown.', cond: { races: ['elf'] }, to: 'court' },
    ],
    nodes: [
      { id: 'why_here', text: [
        '"Because the valley is where it starts, and a king who waits in a capital is a king who arrives late."',
        '"My council disagrees. My council has never seen a fortress wake up."',
      ] },
      { id: 'modulo', text: [
        '"That everything is divided by it, and that something is left over, and that the leftovers are getting larger."',
        '"Ivo explains it better and enjoys it more. I only know what it costs."',
      ] },
      { id: 'oath', text: [
        '"Good. A crown that needs swearing at is a crown worth less than the metal."',
        '"Keep the shrine lit. I will keep the roads open. That is a fair division of labour."',
      ], choices: [{ text: 'Agreed.', actions: [{ type: 'rep', faction: 'alliance', amount: 6 }] }] },
      { id: 'locks', text: [
        'Jovan laughs, once, genuinely.',
        '"They are. I had the good ones melted for coin after the last bad winter."',
        '"Take this before you take something else."',
      ], choices: [{ text: 'Generous of you.', actions: [{ type: 'gold', amount: 120 }, { type: 'rep', faction: 'alliance', amount: 3 }] }] },
      { id: 'court', text: [
        '"It does not. It never has, and I have stopped writing letters about it."',
        '"If Thornhollow will hold the west, they may call themselves whatever they like."',
      ] },
    ],
  },
  ...WANDERING_TRADERS,
];

export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));
