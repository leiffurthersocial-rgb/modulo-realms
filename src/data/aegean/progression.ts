import { AEGEAN_REWARDS, type AegeanReward } from "./content";

export const AEGEAN_LABOUR_IDS = [
  "aegean_nemea",
  "aegean_hydra",
  "aegean_hind",
  "aegean_boar",
  "aegean_augeas",
  "aegean_birds",
  "aegean_bull",
  "aegean_mares",
  "aegean_hippolyta",
  "aegean_geryon",
  "aegean_hesperides",
  "aegean_cerberus",
] as const;
export const AEGEAN_STRATEGIC_IDS = [
  "aegean_python",
  "aegean_medusa",
  "aegean_minotaur",
  "aegean_titan",
] as const;
export const AEGEAN_SANCTUARY_IDS = [
  "aegean_sanctuary_aegis",
  "aegean_sanctuary_forge",
  "aegean_sanctuary_names",
] as const;
export const AEGEAN_CHAMPION_IDS = [
  "aegean_champion_spear",
  "aegean_champion_shield",
  "aegean_champion_hunt",
  "aegean_champion_volley",
  "aegean_champion_guard",
  "aegean_champion_storm",
] as const;
export const AEGEAN_COMPONENT_FLAGS = [
  "aegean:component:ribs",
  "aegean:component:sail",
  "aegean:component:keel",
] as const;
export const AEGEAN_ENTRY_BOSSES = [
  "boss_emberdeep",
  "boss_storm_throne",
  "boss_remainder",
] as const;

/** Frozen at the pre-expansion release: future content cannot enlarge this requirement. */
export const OLD_WORLD_TESTAMENT = {
  version: 1,
  dungeons: [
    "dungeon_fortress",
    "dungeon_crypt",
    "dungeon_grove",
    "dungeon_tomb",
    "dungeon_spire",
    "dungeon_mine",
    "dungeon_whisper",
    "dungeon_deepwood",
    "dungeon_thorn",
    "dungeon_drowned",
    "dungeon_saltworks",
    "dungeon_caldera",
    "dungeon_ashfall",
    "dungeon_frostmarch",
    "dungeon_glass",
    "dungeon_riven",
    "dungeon_barrow",
    "dungeon_remainder",
    "dungeon_lastgate",
    "dungeon_sunkenhall",
    "dungeon_blackreed",
    "dungeon_standingrod",
    "dungeon_glassrun",
    "dungeon_underfloor",
    "dungeon_slagworks",
  ],
  bosses: [
    "boss_stone_warden",
    "boss_hollow_king",
    "boss_matriarch",
    "boss_sand_tyrant",
    "boss_rime_lich",
    "boss_gloam_mother",
    "boss_tide_king",
    "boss_cinder_maw",
    "boss_march_warden",
    "boss_riven_choir",
    "boss_jotun_king",
    "boss_remainder",
    "boss_winter_jarl",
    "boss_drowned_court",
    "boss_storm_throne",
    "boss_emberdeep",
  ],
  minibosses: [
    "mini_captain",
    "mini_broodmother",
    "mini_frostwarden",
    "mini_wintercaller",
    "mini_glacier_maw",
    "mini_fenmother",
    "mini_stormherald",
    "mini_emberjaw",
  ],
  duel: { enemy: "duelist_tusya", flag: "beat_tusya" },
} as const;

export type AegeanStepType =
  | "interact"
  | "visit"
  | "defend"
  | "escort"
  | "puzzle"
  | "feat";
export interface AegeanStep {
  id: string;
  type: AegeanStepType;
  /** Stable interaction/landmark identity; display prose never determines behaviour. */
  target: string;
  label: string;
  count: number;
  duration?: number;
  sequence?: number[];
  /** All requirements; aegean_ IDs mean permanent completions, colon IDs are literal flags. */
  requires?: string[];
}
export interface AegeanActivity {
  id: string;
  name: string;
  summary: string;
  level: number;
  region: string;
  tx: number;
  ty: number;
  map?: string;
  requires: string[];
  steps: AegeanStep[];
  reward: AegeanReward;
  repeatable: boolean;
  /** Local failure only; permanent earlier feats are always recognized. */
  reset: "current-step" | "current-run";
}
export interface AegeanChapter {
  id: string;
  name: string;
  summary: string;
  requires: string[];
  steps: AegeanStep[];
}
const step = (
  id: string,
  type: AegeanStepType,
  label: string,
  count = 1,
  extra: Partial<AegeanStep> = {},
): AegeanStep => ({ id, type, target: id, label, count, ...extra });
const feat = (id: string, label: string, requires: string[]): AegeanStep =>
  step(id, "feat", label, requires.length, { target: requires[0], requires });
const early = ["aegean_nemea", "aegean_hind", "aegean_augeas", "aegean_boar"];
const middle = ["aegean_hydra", "aegean_birds", "aegean_bull", "aegean_mares"];

export const AEGEAN_CHAPTERS: AegeanChapter[] = [
  {
    id: "aegean_chapter_threshold",
    name: "Beyond the Last Storm",
    summary: "A veteran’s road into Achaea.",
    requires: [],
    steps: [
      feat("writ", "Earn the Veteran Writ", ["aegean_veteran_writ"]),
      feat("pass", "Cross the eastern mountain pass", [
        "aegean:visit:threshold",
      ]),
      feat("thyra", "Reach Thyra", ["aegean:visit:thyra"]),
      feat("trial", "Complete the veteran formation trial", [
        "aegean_veteran_trial",
      ]),
    ],
  },
  {
    id: "aegean_chapter_shore",
    name: "A Shore Worth Saving",
    summary: "Restore the coast and begin the Labours.",
    requires: ["aegean_veteran_writ"],
    steps: [
      feat("port", "Reach Aigialos", ["aegean:visit:aigialos"]),
      feat("training", "Finish harbour training", ["aegean_harbour_training"]),
      feat("route", "Restore the lighthouse route", [
        "aegean_story_lighthouse",
      ]),
      feat("early", "Complete the four early Labours", early),
    ],
  },
  {
    id: "aegean_chapter_heracles",
    name: "In the Footsteps of Heracles",
    summary: "Break the repeating myths and prepare the storm hull.",
    requires: early,
    steps: [
      feat("python", "Defeat Python", ["aegean_python"]),
      feat("middle", "Complete the next four Labours", middle),
      feat("ribs", "Forge the bronze storm ribs", ["aegean:component:ribs"]),
      feat("olympian", "Claim or craft an Olympian reward", [
        "aegean:gear:olympian",
      ]),
    ],
  },
  {
    id: "aegean_chapter_sea",
    name: "What the Sea Keeps",
    summary: "An island is a promise and a warning.",
    requires: ["aegean_python"],
    steps: [
      feat("charts", "Chart the outer routes", [
        "aegean:visit:cyclades",
        "aegean:visit:pelagic",
      ]),
      feat("monsters", "Defeat Medusa and the Minotaur", [
        "aegean_medusa",
        "aegean_minotaur",
      ]),
      feat("outer", "Complete the Amazon and Red Herd trials", [
        "aegean_hippolyta",
        "aegean_geryon",
      ]),
      feat("sail", "Earn the Hesperid star-sail", ["aegean:component:sail"]),
    ],
  },
  {
    id: "aegean_chapter_underworld",
    name: "The Kingdom Below",
    summary: "Enter a realm with laws of its own.",
    requires: [...early, ...middle],
    steps: [
      feat("taenarum", "Find the descent at Taenarum", [
        "aegean:visit:taenarum",
      ]),
      feat("court", "Reach Hades’ court", ["aegean:visit:hades"]),
      feat("keel", "Complete Cerberus and the keel-binding rite", [
        "aegean_cerberus",
        "aegean:component:keel",
      ]),
      feat("chain", "Contain the Titan Chain breach", ["aegean_titan"]),
    ],
  },
  {
    id: "aegean_chapter_bronze",
    name: "Bronze Against the Dawn",
    summary: "An army must be fought as an army.",
    requires: [...AEGEAN_LABOUR_IDS, ...AEGEAN_STRATEGIC_IDS],
    steps: [
      feat("testament", "Reconcile the Old World’s Testament", [
        "aegean:testament",
      ]),
      feat("muster", "Muster at the Last Shore", ["aegean:visit:last_shore"]),
      feat("army", "Defeat all Three Hundred", ["aegean_army"]),
      feat("ship", "Commission the certified Stormbreaker", [
        "aegean:ship:stormbreaker",
      ]),
    ],
  },
  {
    id: "aegean_chapter_island",
    name: "The Island That Refused Death",
    summary: "The king’s companions remain loyal.",
    requires: ["aegean_army"],
    steps: [
      feat("crossing", "Cross the oath storm", ["aegean_storm_crossing"]),
      feat("camp", "Establish the beach camp", ["aegean:visit:asterion"]),
      feat("sanctuaries", "Restore all three sanctuaries", [
        ...AEGEAN_SANCTUARY_IDS,
      ]),
      feat("champions", "Overcome all six champions", [...AEGEAN_CHAMPION_IDS]),
    ],
  },
  {
    id: "aegean_chapter_oath",
    name: "The Last Oath",
    summary: "Preparation buys the chance. Knowledge earns the victory.",
    requires: [...AEGEAN_SANCTUARY_IDS, ...AEGEAN_CHAMPION_IDS],
    steps: [
      feat("temple", "Reach the king’s antechamber", ["aegean:visit:temple"]),
      feat("king", "Defeat Leonidas", ["aegean_leonidas"]),
      feat("claim", "Claim a chosen royal weapon", ["aegean:reward:royal"]),
      feat("memorial", "Witness the restored realm", ["aegean:realm:restored"]),
    ],
  },
];

function activity(
  id: string,
  name: string,
  summary: string,
  region: string,
  tx: number,
  ty: number,
  level: number,
  steps: AegeanStep[],
  extra: Partial<AegeanActivity> = {},
): AegeanActivity {
  return {
    id,
    name,
    summary,
    region: `aegean_${region}`,
    tx,
    ty,
    level,
    requires: ["aegean_veteran_writ"],
    steps,
    reward: { xp: level * level * 2, gold: level * 320 },
    repeatable: false,
    reset: "current-step",
    ...extra,
  };
}

export const AEGEAN_STORIES: AegeanActivity[] = [
  activity(
    "aegean_story_lighthouse",
    "The Lighthouse That Lies",
    "Compare the wreck records with the beacon, then restore a true harbour light.",
    "coast",
    1370,
    505,
    81,
    [
      step(
        "aegean_lighthouse_ledger",
        "interact",
        "Read the three wreck records",
        3,
      ),
      step(
        "aegean_lighthouse_lenses",
        "puzzle",
        "Match the harbour’s signal sequence",
        3,
        { sequence: [2, 1, 3] },
      ),
      step(
        "aegean_lighthouse_beacon",
        "defend",
        "Keep the corrected beacon alight",
        1,
        { duration: 25 },
      ),
    ],
    { reward: { xp: 16000, gold: 35000, flags: ["aegean:route:lighthouse"] } },
  ),
  activity(
    "aegean_story_names",
    "A Ship for the Names",
    "Return the names of three wrecked sailors to their memorial.",
    "coast",
    1322,
    585,
    83,
    [
      step("aegean_names_wrecks", "visit", "Inspect three wreck memorials", 3),
      step(
        "aegean_names_tokens",
        "puzzle",
        "Match tokens to the recovered names",
        3,
        { sequence: [1, 3, 2] },
      ),
      step("aegean_names_memorial", "interact", "Carve the memorial"),
    ],
    { reward: { xp: 15000, gold: 30000, flags: ["aegean:crew:lookout"] } },
  ),
  activity(
    "aegean_story_olive",
    "The Last Olive Tree",
    "Turn the burning channels away from a grove older than the city.",
    "arcadia",
    1142,
    345,
    82,
    [
      step("aegean_olive_channels", "puzzle", "Redirect the fire channels", 3, {
        sequence: [3, 1, 2],
      }),
      step("aegean_olive_roots", "defend", "Protect the living roots", 1, {
        duration: 30,
      }),
      step("aegean_olive_well", "interact", "Reopen the grove’s well"),
    ],
    {
      reward: {
        xp: 15000,
        gold: 25000,
        items: ["aegean_resin", "aegean_resin", "aegean_resin"],
        flags: ["aegean:refuge:olive"],
      },
    },
  ),
  activity(
    "aegean_story_bell",
    "The Bronze Bell",
    "Make the harbour’s warning carry across the reefs again.",
    "coast",
    1342,
    557,
    84,
    [
      step(
        "aegean_bell_pieces",
        "interact",
        "Recover the three bell fittings",
        3,
      ),
      step("aegean_bell_tone", "puzzle", "Tune the warning sequence", 3, {
        sequence: [1, 2, 1],
      }),
      step("aegean_bell_watch", "defend", "Defend the bell crew", 1, {
        duration: 25,
      }),
    ],
    { reward: { xp: 17000, gold: 35000, flags: ["aegean:harbour:warning"] } },
  ),
  activity(
    "aegean_story_satyrs",
    "Wine for the Satyrs",
    "Find the true festival path among the pipers’ false signs.",
    "arcadia",
    1080,
    240,
    82,
    [
      step("aegean_satyr_signs", "puzzle", "Follow the three honest signs", 3, {
        sequence: [2, 3, 1],
      }),
      step(
        "aegean_satyr_procession",
        "escort",
        "Guide the festival procession",
        3,
      ),
      step("aegean_satyr_pact", "interact", "Accept the guide’s pact"),
    ],
    { reward: { xp: 14000, gold: 22000, flags: ["aegean:guide:satyr"] } },
  ),
  activity(
    "aegean_story_centaur",
    "The Centaur's Broken Bow",
    "Defend a mountain pass and earn an archer’s respect.",
    "arcadia",
    1190,
    260,
    85,
    [
      step("aegean_centaur_arrow", "interact", "Return the broken arrowhead"),
      step(
        "aegean_centaur_pass",
        "defend",
        "Stand with the centaur at the pass",
        1,
        { duration: 35 },
      ),
      step(
        "aegean_centaur_range",
        "puzzle",
        "Read the moving-target sequence",
        3,
        { sequence: [3, 2, 1] },
      ),
    ],
    { reward: { xp: 19000, gold: 35000, flags: ["aegean:training:archery"] } },
  ),
  activity(
    "aegean_story_mess",
    "A Seat at the Mess",
    "Share three trials and hear why Sparta waits for its king.",
    "sparta",
    1290,
    747,
    90,
    [
      step("aegean_mess_shield", "defend", "Hold the shield court", 1, {
        duration: 20,
      }),
      step(
        "aegean_mess_standard",
        "escort",
        "Carry the standard between courts",
        3,
      ),
      step("aegean_mess_hall", "interact", "Take the empty place at the table"),
    ],
    {
      reward: {
        xp: 23000,
        gold: 38000,
        flags: ["aegean:appearance:mess_cloak"],
      },
    },
  ),
  activity(
    "aegean_story_shield",
    "The Mother's Shield",
    "Carry a named shield to the memorial overlooking the Eurotas.",
    "sparta",
    1340,
    795,
    90,
    [
      step("aegean_shield_name", "interact", "Read the soldier’s name"),
      step(
        "aegean_shield_road",
        "escort",
        "Carry the shield through the old road",
        3,
      ),
      step(
        "aegean_shield_memorial",
        "interact",
        "Place the shield at the memorial",
      ),
    ],
    { reward: { xp: 20000, gold: 35000, items: ["aegean_aspis_sparta"] } },
  ),
  activity(
    "aegean_story_shipwright",
    "The Shipwright's Daughter",
    "Free an engineer trapped inside a flooded workshop.",
    "coast",
    1304,
    609,
    86,
    [
      step(
        "aegean_workshop_sluice",
        "puzzle",
        "Drain the three workshop bays",
        3,
        { sequence: [2, 3, 1] },
      ),
      step(
        "aegean_workshop_escape",
        "escort",
        "Escort the engineer to dry ground",
        3,
      ),
      step("aegean_workshop_dock", "interact", "Reopen the repair dock"),
    ],
    { reward: { xp: 20000, gold: 40000, flags: ["aegean:crew:shipwright"] } },
  ),
  activity(
    "aegean_story_theatre",
    "The Drowned Theatre",
    "Restore the submerged acoustic devices and silence a false song.",
    "cyclades",
    1490,
    735,
    90,
    [
      step(
        "aegean_theatre_voices",
        "puzzle",
        "Restore three acoustic devices",
        3,
        { sequence: [1, 3, 2] },
      ),
      step("aegean_theatre_stage", "defend", "Keep the stage resonating", 1, {
        duration: 30,
      }),
      step("aegean_theatre_song", "interact", "Hear the final performance"),
    ],
    {
      reward: {
        xp: 26000,
        gold: 45000,
        items: ["aegean_drowned_lyre"],
        flags: ["aegean:route:theatre"],
      },
    },
  ),
  activity(
    "aegean_story_icarus",
    "Icarus Fell Here",
    "Recover a scorched instrument from the cliff paths.",
    "cyclades",
    1515,
    910,
    93,
    [
      step(
        "aegean_icarus_cliffs",
        "visit",
        "Find the three fallen instrument pieces",
        3,
      ),
      step("aegean_icarus_lens", "puzzle", "Align the surviving lens", 3, {
        sequence: [3, 1, 3],
      }),
      step("aegean_icarus_chart", "interact", "Copy the horizon bearing"),
    ],
    { reward: { xp: 26000, gold: 50000, flags: ["aegean:chart:icarian"] } },
  ),
  activity(
    "aegean_story_charon",
    "The Debt of Charon",
    "Balance a ledger of passage without taking a shade’s last coin.",
    "ash",
    1260,
    990,
    94,
    [
      step(
        "aegean_charon_names",
        "interact",
        "Inspect the disputed crossings",
        3,
      ),
      step("aegean_charon_ledger", "puzzle", "Reconcile the ferry ledger", 3, {
        sequence: [2, 1, 2],
      }),
      step("aegean_charon_passage", "interact", "Return the completed ledger"),
    ],
    { reward: { xp: 28000, gold: 40000, flags: ["aegean:route:charon"] } },
  ),
  activity(
    "aegean_story_soldier",
    "The Unnamed Soldier",
    "A shade remembers the battle but has forgotten his own name.",
    "ash",
    1238,
    962,
    95,
    [
      step(
        "aegean_soldier_evidence",
        "interact",
        "Gather three fragments of the soldier’s life",
        3,
      ),
      step("aegean_soldier_name", "puzzle", "Arrange the remembered names", 3, {
        sequence: [1, 2, 3],
      }),
      step("aegean_soldier_rest", "interact", "Give his road a name"),
    ],
    {
      reward: {
        xp: 28000,
        gold: 45000,
        items: ["aegean_returning_lantern"],
        flags: ["aegean:shortcut:asphodel"],
      },
    },
  ),
  activity(
    "aegean_story_winter",
    "Persephone's Winter",
    "Carry living light between gardens on the edge of Tartarus.",
    "ash",
    1290,
    958,
    97,
    [
      step(
        "aegean_winter_light",
        "escort",
        "Carry the light to three garden beds",
        3,
      ),
      step("aegean_winter_roots", "defend", "Protect the living channels", 1, {
        duration: 35,
      }),
      step(
        "aegean_winter_bloom",
        "interact",
        "Restore the refuge’s first bloom",
      ),
    ],
    {
      reward: {
        xp: 32000,
        gold: 55000,
        items: ["aegean_orphic_seal"],
        flags: ["aegean:refuge:persephone"],
      },
    },
  ),
  activity(
    "aegean_story_letter",
    "A Letter Never Sent",
    "A dead sailor’s testimony reveals what the oath was meant to protect.",
    "ash",
    1276,
    930,
    96,
    [
      step(
        "aegean_letter_wreck",
        "interact",
        "Recover the sealed sailor’s account",
      ),
      step(
        "aegean_letter_archive",
        "visit",
        "Find the matching entry in the archive",
      ),
      step(
        "aegean_letter_witness",
        "interact",
        "Record the sailor’s testimony",
      ),
    ],
    {
      reward: { xp: 26000, gold: 40000, flags: ["aegean:lore:original_oath"] },
    },
  ),
  activity(
    "aegean_story_empty",
    "The Empty Place",
    "Find who is missing from the frieze of the Three Hundred.",
    "sparta",
    1308,
    779,
    95,
    [
      step(
        "aegean_empty_frieze",
        "interact",
        "Inspect the frieze’s three damaged panels",
        3,
      ),
      step(
        "aegean_empty_oath",
        "puzzle",
        "Reconstruct the wording of the oath",
        3,
        { sequence: [3, 2, 3] },
      ),
      feat("aegean_empty_successor", "Find a successor to the last oath", [
        "aegean_leonidas",
      ]),
    ],
    {
      reward: { xp: 30000, gold: 50000, flags: ["aegean:appearance:memorial"] },
    },
  ),
];

const contract = (
  slug: string,
  name: string,
  summary: string,
  region: string,
  tx: number,
  ty: number,
  level: number,
  steps: AegeanStep[],
): AegeanActivity =>
  activity(
    `aegean_contract_${slug}`,
    name,
    summary,
    region,
    tx,
    ty,
    level,
    steps,
    {
      repeatable: true,
      reset: "current-run",
      reward: {
        xp: 5500,
        gold: 22000 + (level - 80) * 650,
        items: ["aegean_bronze", "aegean_resin"],
      },
    },
  );
export const AEGEAN_CONTRACTS: AegeanActivity[] = [
  contract(
    "supply",
    "Supply Through the Surf",
    "Bring a coastal provision boat to its beacon.",
    "coast",
    1340,
    550,
    84,
    [
      step("aegean_supply_load", "interact", "Check the sealed supplies"),
      step(
        "aegean_supply_route",
        "escort",
        "Follow the three marked coastal buoys",
        3,
      ),
      step("aegean_supply_unload", "interact", "Unload at the safe buoy"),
    ],
  ),
  contract(
    "hunt",
    "The Marked Beast",
    "Follow a fresh territorial trail and contain its owner.",
    "arcadia",
    1090,
    330,
    82,
    [
      step("aegean_hunt_tracks", "visit", "Find three fresh tracks", 3),
      step("aegean_hunt_clearing", "defend", "Hold the marked clearing", 1, {
        duration: 30,
      }),
    ],
  ),
  contract(
    "reef",
    "A Passage Through Teeth",
    "Restore a buoy line through a dangerous reef.",
    "cyclades",
    1520,
    710,
    91,
    [
      step("aegean_reef_buoys", "puzzle", "Mark the safe passage", 3, {
        sequence: [1, 3, 1],
      }),
      step("aegean_reef_watch", "defend", "Protect the workboat", 1, {
        duration: 25,
      }),
    ],
  ),
  contract(
    "rescue",
    "Crew on the Rocks",
    "Bring a stranded crew to the next sheltered cove.",
    "coast",
    1370,
    574,
    87,
    [
      step("aegean_rescue_signal", "interact", "Answer the distress signal"),
      step(
        "aegean_rescue_crew",
        "escort",
        "Bring the crew to three safe points",
        3,
      ),
    ],
  ),
  contract(
    "cargo",
    "The Cargo That Whispers",
    "Contain an oath-tainted cargo before delivering it.",
    "coast",
    1335,
    528,
    89,
    [
      step("aegean_cargo_seals", "puzzle", "Restore the cargo seals", 3, {
        sequence: [2, 3, 2],
      }),
      step(
        "aegean_cargo_delivery",
        "escort",
        "Carry the crate between ward posts",
        3,
      ),
    ],
  ),
  contract(
    "beacon",
    "Keep the Fire",
    "Keep a storm beacon burning through a local assault.",
    "pelagic",
    1508,
    408,
    96,
    [
      step("aegean_beacon_fuel", "interact", "Prime the beacon"),
      step(
        "aegean_beacon_stand",
        "defend",
        "Hold until the pilot sees the light",
        1,
        { duration: 40 },
      ),
    ],
  ),
  contract(
    "shade",
    "The Unclosed Door",
    "Seal a shade breach near the descent.",
    "ash",
    1268,
    976,
    95,
    [
      step("aegean_shade_wards", "puzzle", "Close the three ward circuits", 3, {
        sequence: [3, 1, 2],
      }),
      step("aegean_shade_seal", "defend", "Keep the breach contained", 1, {
        duration: 30,
      }),
    ],
  ),
  contract(
    "raiders",
    "Break Their Rhythm",
    "Interrupt raider signals before the column reforms.",
    "sparta",
    1360,
    738,
    92,
    [
      step(
        "aegean_raider_signals",
        "puzzle",
        "Cut the captains’ signal sequence",
        3,
        { sequence: [2, 1, 3] },
      ),
      step("aegean_raider_column", "defend", "Break the remaining assault", 1, {
        duration: 30,
      }),
    ],
  ),
  contract(
    "aqueduct",
    "Water Above the Road",
    "Repair a sabotaged section of the old aqueduct.",
    "rivers",
    1100,
    577,
    85,
    [
      step("aegean_aqueduct_valves", "puzzle", "Balance the three sluices", 3, {
        sequence: [1, 2, 3],
      }),
      step(
        "aegean_aqueduct_test",
        "defend",
        "Protect the engineer’s pressure test",
        1,
        { duration: 25 },
      ),
    ],
  ),
  contract(
    "offerings",
    "A Quiet Offering",
    "Carry temple offerings through a hostile hillside.",
    "delphi",
    1280,
    365,
    88,
    [
      step("aegean_offering_bowl", "interact", "Accept the sealed offering"),
      step("aegean_offering_path", "escort", "Reach three sanctuary stones", 3),
      step("aegean_offering_altar", "interact", "Leave the offering intact"),
    ],
  ),
  contract(
    "pass",
    "Open the Wind Stair",
    "Restore the mountain route after a rockfall.",
    "olympus",
    1290,
    170,
    93,
    [
      step("aegean_pass_routes", "visit", "Find the three stable footholds", 3),
      step("aegean_pass_braces", "puzzle", "Secure the broken stair", 3, {
        sequence: [3, 2, 1],
      }),
    ],
  ),
  contract(
    "arena",
    "Bronze Measures",
    "A bounded arena trial with three different safe lanes.",
    "sparta",
    1280,
    752,
    95,
    [
      step("aegean_arena_lanes", "puzzle", "Read the announced lane order", 3, {
        sequence: [1, 3, 2],
      }),
      step("aegean_arena_stand", "defend", "Finish the measured assault", 1, {
        duration: 40,
      }),
    ],
  ),
];

const discovery = (
  slug: string,
  name: string,
  summary: string,
  region: string,
  tx: number,
  ty: number,
  level: number,
  type: AegeanStepType = "interact",
  extra: Partial<AegeanActivity> = {},
): AegeanActivity =>
  activity(
    `aegean_discovery_${slug}`,
    name,
    summary,
    region,
    tx,
    ty,
    level,
    [
      step(
        `aegean_discovery_${slug}_inspect`,
        type,
        summary,
        type === "puzzle" ? 3 : 1,
        type === "puzzle" ? { sequence: [1, 3, 2] } : {},
      ),
    ],
    {
      reward: { xp: 4500, gold: 6000, flags: [`aegean:discovery:${slug}`] },
      ...extra,
    },
  );
export const AEGEAN_DISCOVERIES: AegeanActivity[] = [
  discovery(
    "nine_echoes",
    "Aqueduct of Nine Echoes",
    "Listen for the echo that reveals the old maintenance passage.",
    "threshold",
    1035,
    382,
    76,
    "puzzle",
  ),
  discovery(
    "last_mile",
    "The Veteran's Last Mile",
    "Read the mile marker and establish a sheltered camp.",
    "threshold",
    989,
    420,
    76,
  ),
  discovery(
    "helmet_olive",
    "The Helmet Olive",
    "Open the bronze helmet beneath the olive roots.",
    "arcadia",
    1118,
    308,
    80,
  ),
  discovery(
    "dryad_spring",
    "The Dryad's Unmoving Spring",
    "Follow the unmoving reflection into a hidden refuge.",
    "arcadia",
    1070,
    274,
    81,
    "puzzle",
  ),
  discovery(
    "split_star",
    "Observatory of the Split Star",
    "Align the broken observatory with the storm horizon.",
    "olympus",
    1298,
    125,
    93,
    "puzzle",
  ),
  discovery(
    "wind_stair",
    "The Wind Stair",
    "Find the sheltered step and reach the lookout.",
    "olympus",
    1248,
    187,
    92,
    "visit",
  ),
  discovery(
    "backward_wheel",
    "The Wheel That Turns Backward",
    "Reverse the bypass gates without stopping the mill.",
    "rivers",
    1076,
    548,
    83,
    "puzzle",
  ),
  discovery(
    "supplicants",
    "Bridge of Supplicants",
    "Escort a stranded caravan across the reopened bridge.",
    "rivers",
    1150,
    593,
    84,
    "escort",
  ),
  discovery(
    "ninth_inscription",
    "The Ninth Inscription",
    "Read the concealed clause in the oath inscription.",
    "delphi",
    1262,
    349,
    86,
  ),
  discovery(
    "silent_laurel",
    "Laurel of the Silent Oracle",
    "Match the sanctuary bells to the silent oracle’s signs.",
    "delphi",
    1310,
    370,
    88,
    "puzzle",
  ),
  discovery(
    "false_lighthouse",
    "The False Lighthouse",
    "Compare its light with the markings on the wreck below.",
    "coast",
    1380,
    484,
    83,
  ),
  discovery(
    "hanging_ship",
    "The Hanging Ship",
    "Reach a stranded ship through the cliff passage.",
    "coast",
    1325,
    608,
    87,
    "visit",
  ),
  discovery(
    "empty_frieze",
    "The Empty Place",
    "Inspect the missing warrior in the Spartan frieze.",
    "sparta",
    1303,
    779,
    92,
  ),
  discovery(
    "mothers_shield",
    "The Mother's Shield",
    "Read the name inside the abandoned shield.",
    "sparta",
    1331,
    802,
    90,
  ),
  discovery(
    "feather_causeway",
    "The Feather Causeway",
    "Follow the flock’s landing pattern across the reeds.",
    "lerna",
    1152,
    772,
    89,
    "puzzle",
  ),
  discovery(
    "drowned_granary",
    "The Drowned Granary",
    "Inspect the raised granary above the poison pools.",
    "lerna",
    1108,
    830,
    90,
    "visit",
  ),
  discovery(
    "cooling_steps",
    "The Cooling Steps",
    "Cross the geothermal vents in their safe order.",
    "ash",
    1280,
    940,
    94,
    "puzzle",
  ),
  discovery(
    "last_sunbeam",
    "The Last Sunbeam",
    "Mark the last point where daylight reaches Taenarum.",
    "ash",
    1245,
    991,
    95,
  ),
  discovery(
    "icarian_fall",
    "Icarian Fall",
    "Inspect the instrument fused into the cliff rock.",
    "cyclades",
    1518,
    904,
    93,
  ),
  discovery(
    "cyclops_table",
    "Cyclops' Table",
    "Explore the chamber beneath the giant footprint.",
    "cyclades",
    1590,
    816,
    94,
    "visit",
  ),
  discovery(
    "fleet_bell",
    "The Bell Beneath the Fleet",
    "Sound the wreck bell and survive its answer.",
    "pelagic",
    1580,
    260,
    97,
    "defend",
  ),
  discovery(
    "drowned_lyre",
    "The Drowned Lyre",
    "Read the sound channels among the drowned masts.",
    "pelagic",
    1580,
    540,
    96,
    "puzzle",
  ),
  discovery(
    "unraised_shields",
    "The Field of Unraised Shields",
    "Record the names of guards who held without raising a weapon.",
    "asterion",
    1784,
    515,
    100,
    "interact",
    { requires: ["aegean_army"] },
  ),
  discovery(
    "first_dawn",
    "The First Crack of Dawn",
    "Watch daylight cross the island after the oath breaks.",
    "asterion",
    1855,
    535,
    100,
    "visit",
    { requires: ["aegean_leonidas"] },
  ),
];

/** Essential commissions are explicit activities rather than unexplained recipe flags. */
export const AEGEAN_COMMISSIONS: AegeanActivity[] = [
  activity(
    "aegean_veteran_trial",
    "A Veteran’s Measure",
    "Read the veteran’s signals and hold the safe court.",
    "threshold",
    1015,
    425,
    76,
    [
      step("aegean_veteran_signal", "puzzle", "Read three shield signals", 3, {
        sequence: [1, 2, 3],
      }),
      step(
        "aegean_veteran_hold",
        "defend",
        "Complete the measured defence",
        1,
        { duration: 20 },
      ),
    ],
    { reward: AEGEAN_REWARDS.aegean_veteran_trial },
  ),
  activity(
    "aegean_harbour_training",
    "The First Oar",
    "Learn a sheltered route before risking a full voyage.",
    "coast",
    1350,
    535,
    80,
    [
      step(
        "aegean_training_buoys",
        "escort",
        "Follow the three training buoys",
        3,
      ),
      step("aegean_training_dock", "interact", "Return the loaner to the dock"),
    ],
    { reward: { xp: 15000, gold: 35000, flags: ["aegean:training:ship"] } },
  ),
  activity(
    "aegean_storm_altar",
    "The Three Thunderheads",
    "Ground the storm altar’s three conductors.",
    "olympus",
    1316,
    166,
    92,
    [
      step(
        "aegean_storm_conductors",
        "puzzle",
        "Ground the conductors in order",
        3,
        { sequence: [3, 1, 2] },
      ),
      step("aegean_storm_hold", "defend", "Endure the grounded storm", 1, {
        duration: 30,
      }),
    ],
    { requires: ["aegean_boar"], reward: AEGEAN_REWARDS.aegean_storm_altar },
  ),
  activity(
    "aegean_forge_measure",
    "The Smith’s Measure",
    "Prove that the forge’s cooling cycle can contain divine heat.",
    "ash",
    1288,
    949,
    91,
    [
      step("aegean_forge_valves", "puzzle", "Balance the cooling valves", 3, {
        sequence: [2, 3, 1],
      }),
      step("aegean_forge_heat", "defend", "Guard the final cooling cycle", 1, {
        duration: 25,
      }),
    ],
    {
      requires: ["aegean_augeas"],
      reward: AEGEAN_REWARDS.aegean_forge_measure,
    },
  ),
  activity(
    "aegean_crossroads",
    "The Roads Remember",
    "Reconnect three route stones used by Hermes’ messengers.",
    "delphi",
    1265,
    389,
    91,
    [
      step(
        "aegean_crossroads_stones",
        "visit",
        "Find all three route stones",
        3,
      ),
      step(
        "aegean_crossroads_order",
        "puzzle",
        "Restore their direction sequence",
        3,
        { sequence: [1, 3, 2] },
      ),
    ],
    { requires: ["aegean_python"], reward: AEGEAN_REWARDS.aegean_crossroads },
  ),
];

const underworldStories: Record<
  string,
  { map: string; tx: number; ty: number }
> = {
  aegean_story_charon: { map: "aegean_acheron", tx: 22, ty: 72 },
  aegean_story_soldier: { map: "aegean_asphodel", tx: 28, ty: 76 },
  aegean_story_winter: { map: "aegean_persephone", tx: 30, ty: 70 },
  aegean_story_letter: { map: "aegean_asphodel", tx: 44, ty: 76 },
};
for (const story of AEGEAN_STORIES)
  if (underworldStories[story.id])
    Object.assign(story, underworldStories[story.id]);
const surfaceCorrections: Record<string, { tx: number; ty: number }> = {
  aegean_story_theatre: { tx: 1826, ty: 183 },
  aegean_story_icarus: { tx: 1560, ty: 104 },
  aegean_story_satyrs: { tx: 1118, ty: 220 },
  aegean_discovery_icarian_fall: { tx: 1570, ty: 104 },
  aegean_discovery_cyclops_table: { tx: 1508, ty: 312 },
  aegean_discovery_drowned_lyre: { tx: 1836, ty: 183 },
  aegean_discovery_drowned_granary: { tx: 1136, ty: 840 },
};
for (const activity of [...AEGEAN_STORIES, ...AEGEAN_DISCOVERIES])
  if (surfaceCorrections[activity.id])
    Object.assign(activity, surfaceCorrections[activity.id]);
export const AEGEAN_ACTIVITIES = [
  ...AEGEAN_STORIES,
  ...AEGEAN_CONTRACTS,
  ...AEGEAN_DISCOVERIES,
  ...AEGEAN_COMMISSIONS,
];
export const AEGEAN_ACTIVITY_BY_ID = Object.fromEntries(
  AEGEAN_ACTIVITIES.map((activity) => [activity.id, activity]),
);
/** One reward lookup for the campaign; loading progression registers its authored activity payouts. */
for (const activity of AEGEAN_ACTIVITIES)
  AEGEAN_REWARDS[activity.id] = activity.reward;

export interface AegeanAdventureContent {
  id: string;
  name: string;
  verb: string;
  tool: string;
  completion: string;
  reset: string;
}
export const AEGEAN_CONTENT: AegeanAdventureContent[] = [
  {
    id: "aegean_nemea",
    name: "Hunt the Hunter",
    verb: "lure",
    tool: "Pillars expose the hide",
    completion:
      "Bait the lion’s leap into a pillar, then defeat it during real openings.",
    reset: "Current den; tracks remain found.",
  },
  {
    id: "aegean_hydra",
    name: "The Marsh That Regrows",
    verb: "cauterize",
    tool: "Renewable brazier embers",
    completion: "Seal the mortal necks and pin the immortal head.",
    reset: "Boss resets; revealed causeways remain.",
  },
  {
    id: "aegean_hind",
    name: "A Hunt Without Blood",
    verb: "track",
    tool: "Wind, tracks and sanctuary stones",
    completion: "Enclose the protected hind and defend its rest.",
    reset: "Last clearing; the hind cannot be accidentally auto-attacked.",
  },
  {
    id: "aegean_boar",
    name: "Break the Avalanche",
    verb: "corral",
    tool: "Horn posts and snow gates",
    completion: "Guide the boar into deep snow and close the pen.",
    reset: "Current mountain pen.",
  },
  {
    id: "aegean_augeas",
    name: "The River Remembers",
    verb: "divert",
    tool: "Reversible sluice controls",
    completion: "Route both rivers through the corrupted estate.",
    reset: "Current reservoir; earlier sluices stay solved.",
  },
  {
    id: "aegean_birds",
    name: "The Bronze Sky",
    verb: "sound",
    tool: "Three bronze resonators",
    completion: "Lift and break the flock formations while using safe cover.",
    reset: "Current flock formation.",
  },
  {
    id: "aegean_bull",
    name: "The Palace in Its Path",
    verb: "redirect",
    tool: "Charge lanes and marked anchors",
    completion: "Use the bull’s charges to break the binding pylons.",
    reset: "Arena layout resets at the shrine.",
  },
  {
    id: "aegean_mares",
    name: "The Iron Paddocks",
    verb: "contain",
    tool: "Warded gates and herd signals",
    completion: "Separate four mares, free captives, and defeat the handlers.",
    reset: "Current paddock; rescued captives shelter.",
  },
  {
    id: "aegean_hippolyta",
    name: "The Queen’s Measure",
    verb: "command",
    tool: "Advance, defend, regroup",
    completion: "Win the formal formation trial and nonlethal duel.",
    reset: "Current trial round.",
  },
  {
    id: "aegean_geryon",
    name: "The Red Herd",
    verb: "convoy",
    tool: "Gathering bells and safe causeways",
    completion: "Escort the herd and expose Geryon’s three fronts.",
    reset: "Current crossing; scattered cattle are recoverable.",
  },
  {
    id: "aegean_hesperides",
    name: "The Weight of Heaven",
    verb: "bear",
    tool: "Celestial support anchors",
    completion:
      "Read the star bridges and retrieve the apple without losing the sky.",
    reset: "Last support anchor.",
  },
  {
    id: "aegean_cerberus",
    name: "Leave Death Its Guardian",
    verb: "subdue",
    tool: "Universal ward and three restraints",
    completion:
      "Subdue the guardian, complete the lawful passage, and return him.",
    reset: "Hades’ gate; no repeat entry fee.",
  },
];
