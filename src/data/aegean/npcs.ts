import type { NpcDef, ScheduleEntry } from "../npcs";
import type { Look } from "../../game/art/characters";
import { AEGEAN_LOCATIONS, AEGEAN_TOWN_LAYOUTS } from "./world";
const names = [
  [
    "Eudora",
    "Keeper of the Eastern Road",
    "The road is open. Stay near the terraces if you are just passing through. The hills belong to things our soldiers will not hunt.",
    "You will find no beginner’s road here. The lion does not care how loudly you announce yourself; bring it to the limestone and let its own strength betray it.",
  ],
  [
    "Melia",
    "Warden of the Living Grove",
    "An olive tree can outlive a war. That makes protecting it a more serious occupation than starting one.",
    "Heracles did not solve every Labour with a sword. The hind belongs to Artemis. Bring patience, and leave its blood where it belongs.",
  ],
  [
    "Iason",
    "Master of the Two Rivers",
    "A river never agreed to become a moat. Open a gate and it remembers where it wanted to go.",
    "Augeas built his estate across two waters. The sluices have a memory: first, third, second. Keep the guardians away from the wheels.",
  ],
  [
    "Thyone",
    "Listener beneath Delphi",
    "The oracle stopped speaking when Python found that silence could be mistaken for wisdom.",
    "Watch where the vapour gathers. A closed vent protects the serpent; an open one gives you only a short chance. Use it deliberately.",
  ],
  [
    "Naus",
    "Pilot of Aigialos",
    "A coastline is a promise you can see. Out there you have only the stars and the strength of your hull.",
    "Use the harbour mooring to commission a ship. The shallows are forgiving. Far from the mainland, even an island at your shoulder will not make the sea safe.",
  ],
  [
    "Damaris",
    "Keeper of the Empty Place",
    "Three hundred places remain set at our tables. We do not call loyalty foolish merely because it has become terrible.",
    "An army has a rhythm: shield, spear, breath, advance. Break a company’s rhythm and you can fight its men. Ignore it and you are fighting a wall.",
  ],
  [
    "Thaleia",
    "Smith of the Last Sunbeam",
    "Bronze remembers heat. Oathsteel remembers the hand that refused to let it cool.",
    "The storm ribs require the boar’s proof and the river’s proof. Forge them here, then seek the star-sail and the keel-binding. No one component makes a ship.",
  ],
  [
    "Phaidros",
    "Harbour Keeper of Kymene",
    "We mend sails, count returning boats, and never pretend the second occupation is easier.",
    "Beyond the shelf, the monsters grow bolder. Brace before impact, row out of a warning, and keep enough hull to get home. If you wreck, we will bring you back to the last harbour.",
  ],
];
const look = (i: number): Look => ({
  skin: ["#d6a173", "#bc835b", "#e2b38b"][i % 3],
  hair: "#3b2b25",
  hairStyle: i % 2 ? "long" : "short",
  beard: i % 3 ? "none" : "stubble",
  shirt: i % 2 ? "#ebddaf" : "#9a4638",
  pants: "#655e50",
  boots: "#59412f",
  belt: "#a88845",
  armor: i === 5 ? "heavy" : "none",
  armorColor: "#a5804c",
  armorTrim: "#e4ce93",
  ears: "human",
  height: 1,
  bulk: 1,
});
const settlements = AEGEAN_LOCATIONS.filter((l) => l.kind === "village");
// These thresholds match the individual houses in the town generator. The
// coordinates stay relative to each settlement, just like Ashvale's residents.
const homes = settlements.map((loc) =>
  AEGEAN_TOWN_LAYOUTS[loc.id].slice(0, 3).map(([x, y]) => [x, y + 2]),
);
const schedule = (
  town: number,
  work: number[],
  home: number[],
  social: number[],
  job: string,
): ScheduleEntry[] => {
  const loc = settlements[town];
  return [
    { at: 7, tx: loc.tx + work[0], ty: loc.ty + work[1], label: job },
    {
      at: 18,
      tx: loc.tx + social[0],
      ty: loc.ty + social[1],
      label: "at the evening table",
    },
    { at: 22, tx: loc.tx + home[0], ty: loc.ty + home[1], label: "at home" },
  ];
};
const keepers: NpcDef[] = settlements.map((loc, i) => ({
  id: `${loc.id}_keeper`,
  name: names[i][0],
  title: names[i][1],
  race: "human",
  faction: "guild",
  personality: "Patient, practical, and proud of the people of Achaea.",
  map: "overworld",
  tx: loc.tx + 4,
  ty: loc.ty + 6,
  look: look(i),
  wander: 14,
  schedule: schedule(i, [4, 6], homes[i][0], [3, 8], "tending the town"),
  greeting: [
    {
      cond: { flag: "aegean:realm:restored" },
      lines: [
        "The storm has opened. The oath has ended. Now we must decide what a peaceful coast can become.",
        names[i][2],
      ],
    },
    { lines: [names[i][2]] },
  ],
  topics: [{ text: "What should I know before going farther?", to: "counsel" }],
  nodes: [{ id: "counsel", text: [names[i][3]] }],
  services: ["storage", "heal"],
  shop: {
    id: `${loc.id}_supplies`,
    name: `${loc.name} Expedition Supplies`,
    priceMod: 1.2,
    stock: [
      { item: "aegean_bronze", qty: 30 },
      { item: "aegean_resin", qty: 20 },
      { item: "aegean_ambrosia", qty: 12 },
      { item: "aegean_antitoxin", qty: 8 },
      { item: "potion_mana_m", qty: 10 },
    ],
    buys: ["weapon", "armor", "accessory", "consumable", "material", "misc"],
    gold: 500000,
  },
}));

interface Resident {
  id: string;
  name: string;
  title: string;
  manner: string;
  greeting: string;
  question: string;
  answer: string[];
  rumour: string[];
  job: string;
  stock?: string[];
  race?: NpcDef["race"];
}

// Each row is a household with a livelihood, a reason to be here and something
// useful to say. Dialogue, shops, healing and lodging use the original systems.
const residents: Resident[][] = [
  [
    {
      id: "manto",
      name: "Manto",
      title: "Keeper of the Split Amphora",
      manner: "Warm to strangers, exacting about muddy boots.",
      job: "preparing the guest table",
      greeting:
        '"Boots by the threshold. The stew has been waiting longer than you have, and it has better manners."',
      question: "Who stays at the Split Amphora?",
      answer: [
        '"Carters from the west. Pilgrims going east. Once, a man who insisted he was Hermes in disguise. Hermes paid his bill, I notice."',
        '"There is always a bowl for someone coming back on foot. That road takes enough from people."',
      ],
      rumour: [
        '"Follow the worn road through the terraces. The white stones uphill look like another road until they stand up. I lost two good plates to a giant last spring."',
      ],
    },
    {
      id: "damon",
      name: "Damon",
      title: "Potter of Thyra",
      manner: "Talks to his clay and distrusts polished armour.",
      job: "selling fired clay",
      greeting:
        '"If it rings when you tap it, it is sound. If it rings back, leave it here. I have a priest coming."',
      question: "Why so many jars?",
      answer: [
        '"Olive oil east, grain west. People remember the sword that won a war. Nobody remembers the jar that kept its owner fed."',
        '"Mine have three cuts under the handle. Find one in a ruin and I will tell you whose cart lost it."',
      ],
      rumour: [
        '"The lion hunters buy enormous wine jars. They say it is for courage. Judging by the jars that come back, courage leaks."',
      ],
      stock: ["aegean_resin", "mat_cloth", "food_apple", "potion_health_l"],
    },
    {
      id: "sosthenes",
      name: "Sosthenes",
      title: "Retired Road Warden",
      manner: "Dry humour, a stiff knee and no interest in rank.",
      job: "watching the eastern road",
      greeting:
        '"You are allowed to go east. Sensible is a different matter. Nobody ever listens to that half."',
      question: "What happened to your knee?",
      answer: [
        '"A goat. Twenty years guarding caravans, six battles, one goat. Put that in a heroic song."',
        '"Keep a waystone behind you and a clear road back. Retreat is a skill. Practice it before you need it."',
      ],
      rumour: [
        '"Sparta has been paying for bronze in full, without haggling. That frightens me more than the monsters."',
      ],
    },
  ],
  [
    {
      id: "myrine",
      name: "Myrine",
      title: "Mistress of the Cedar Hearth",
      manner: "Quietly fierce about feeding other people.",
      job: "stoking the cedar hearth",
      greeting:
        '"Sit. If you mean to tell me you are not hungry, at least eat while you do it."',
      question: "Is the village afraid of the lion?",
      answer: [
        '"Of course. We bring the flocks in before dusk and mend the fences in pairs. Fear is useful if it gets the chores done."',
        '"The hunters leave a place by the fire for whoever is last back. I will not let them stop."',
      ],
      rumour: [
        '"Do not waste good steel on the Nemean hide. The old quarry has columns. Something that charges that hard can break its own shelter."',
      ],
    },
    {
      id: "dorion",
      name: "Dorion",
      title: "Cedar Bowyer",
      manner: "Patient hands, impatient with needless killing.",
      job: "bending bow staves",
      greeting:
        '"A bow is a bent promise. Pull it too far and it becomes two sticks."',
      question: "Why use cedar?",
      answer: [
        '"I use it for the cases. The bows are yew. Everyone who asks that question has been looking at the wrong end of my stall."',
        '"There are old trees beyond the stream I will not cut. The grove has lent us enough."',
      ],
      rumour: [
        '"The golden hind will watch you before it runs. Put your weapon away. Artemis does not reward the quickest arrow."',
      ],
      stock: ["mat_leather", "mat_cloth", "aegean_resin", "aegean_antitoxin"],
    },
    {
      id: "lykos",
      name: "Lykos",
      title: "Grove Shepherd",
      race: "beastfolk",
      manner: "Amused by human hurry, protective of the flock.",
      job: "counting the returning flock",
      greeting:
        '"Twenty-three. No, twenty-four. You look enough like a lost sheep from here."',
      question: "Does Pan really walk these woods?",
      answer: [
        '"Someone plays the reed pipes when nobody is there. The goats follow. I follow the goats. I have stopped needing to know who starts it."',
        '"Leave the spring clean and close the gate. Those are the oldest prayers I know."',
      ],
      rumour: [
        '"The boar does not stop at a fence. Give it room to charge, then be somewhere else when it reaches the trees."',
      ],
    },
  ],
  [
    {
      id: "anthe",
      name: "Anthe",
      title: "Keeper of the River Table",
      manner: "Gregarious, remembers debts and birthdays equally well.",
      job: "serving the mill workers",
      greeting:
        '"Upstream or downstream? It matters. One lot wants breakfast; the other lot insists it is still yesterday."',
      question: "Why build between two rivers?",
      answer: [
        '"The grain comes down one, the barges take it away on the other. In between, I persuade the bargemen to pay for lunch."',
        '"When both rivers flood, we move the tables upstairs. My grandmother said that was a foolish plan. She built the stairs."',
      ],
      rumour: [
        '"Augeas has stopped sending grain. His servants say the yard itself is moving. Take boots you can afford to lose."',
      ],
    },
    {
      id: "kleon",
      name: "Kleon",
      title: "Millwright of Potamoi",
      manner: "Blunt, methodical, constantly listening for a bad bearing.",
      job: "checking the mill gearing",
      greeting:
        '"Hear that knock? Neither do I. That is what a whole morning of work sounds like."',
      question: "Can the rivers clean the old estate?",
      answer: [
        '"Water does not care who owns the wall in its way. Give both streams a channel and they will do what a hundred shovels cannot."',
        '"But a wheel is not a shield. Deal with whatever is reaching for your back before you work the sluice."',
      ],
      rumour: [
        '"The sequence carved on the sluices is not a prayer. First, third, second. Whoever wrote it expected tired workers, not scholars."',
      ],
      stock: [
        "aegean_bronze",
        "mat_iron_ingot",
        "aegean_resin",
        "potion_mana_m",
      ],
    },
    {
      id: "chloe",
      name: "Chloe",
      title: "Reed Weaver",
      manner: "Wry and observant; knows every family on the river.",
      job: "weaving baskets",
      greeting:
        '"Step around the reeds, please. Unless you are volunteering to sort them again."',
      question: "What do the river people believe?",
      answer: [
        '"That a river has a name, and you should learn it before you ask it for anything."',
        '"I leave the first basket of spring on the bank. Sometimes it is gone by morning. Sometimes the fishermen are very grateful."',
      ],
      rumour: [
        '"Lerna smells wrong before you see it. If the reeds stop moving but you still hear splashing, get onto dry ground."',
      ],
    },
  ],
  [
    {
      id: "phile",
      name: "Phile",
      title: "Keeper of the Laurel Rooms",
      manner: "Unimpressed by grand titles, kind to exhausted pilgrims.",
      job: "preparing pilgrims rooms",
      greeting:
        '"An answer, a bed, or a bath? I can reliably offer two of those."',
      question: "Do people still visit the oracle?",
      answer: [
        '"More than ever. Silence means nobody has been told they are wrong yet."',
        '"I ask what they hope to hear. By the second cup they usually know more than they came with."',
      ],
      rumour: [
        '"The steam below the sanctuary used to smell of laurel. Now it stings the eyes. Do not stand over a vent waiting for wisdom."',
      ],
    },
    {
      id: "theon",
      name: "Theon",
      title: "Bronze Lamp Maker",
      manner: "Precise, curious and fond of inconvenient questions.",
      job: "trimming temple lamps",
      greeting:
        '"The lamp is twelve drachmas. The prediction that it will get dark is free."',
      question: "Are these temple lamps?",
      answer: [
        '"Some are. The others are for stairwells. Both keep people from falling into places they meant to contemplate from a distance."',
        '"I hammer the spouts by hand. A badly made flame smokes. The priests have enough of that already."',
      ],
      rumour: [
        '"Python keeps the vents closed for a reason. Opening one changes what the fumes can reach. Watch the serpent, then choose your moment."',
      ],
      stock: [
        "aegean_bronze",
        "aegean_moly",
        "potion_mana_m",
        "aegean_antitoxin",
      ],
    },
    {
      id: "kleio",
      name: "Kleio",
      title: "Inscription Reader",
      manner:
        "Restless curiosity; refuses to improve a story by inventing facts.",
      job: "copying old inscriptions",
      greeting:
        '"Hold the corner, please. This inscription has survived five centuries and is losing an argument with the wind."',
      question: "What does the inscription say?",
      answer: [
        '"Mostly which family paid for the steps. The grander ones explain why their enemies should not be allowed to use the steps."',
        '"This little line names the mason. I copy that one first. He did the work."',
      ],
      rumour: [
        '"The old stories disagree about every hero. They agree about this: if a god gives you an easy answer, read the next line."',
      ],
    },
  ],
  [
    {
      id: "simo",
      name: "Simo",
      title: "Keeper of the Three Oars",
      manner: "Loud enough for the quay; discreet when it matters.",
      job: "feeding the morning crews",
      greeting: '"Your ship is late? Good. Your supper is not."',
      question: "Why is the inn called the Three Oars?",
      answer: [
        '"My first boat had four. The sea kept one. A practical person would have bought another oar; I bought this place."',
        '"Crews leave messages under the blue bowl. If somebody is missing, ask me before you ask the sea."',
      ],
      rumour: [
        '"A small boat will teach you the coast. It will not teach the deep water to be kind. Buy a hull for the voyage you mean to make."',
      ],
    },
    {
      id: "nikon",
      name: "Nikon",
      title: "Rope Maker",
      manner: "Cheerful and relentlessly careful about knots.",
      job: "laying out new rope",
      greeting:
        '"Do not call it string where the sailors can hear you. They become emotional."',
      question: "How can I tell a good rope?",
      answer: [
        '"Even strands. No dark patches. A knot that tightens without biting through itself. People are harder to judge."',
        '"Keep a dry coil aboard. The moment you need it is always the moment everything else is wet."',
      ],
      rumour: [
        '"Row before a monster hits, brace when you cannot get clear, and turn back while you still have a hull. There is no prize for sinking with provisions left."',
      ],
      stock: ["aegean_resin", "mat_cloth", "mat_leather", "potion_health_xl"],
    },
    {
      id: "peitho",
      name: "Peitho",
      title: "Fish Seller",
      manner: "Sharp bargaining, generous directions.",
      job: "sorting the nights catch",
      greeting: '"Fresh this morning. The fish, not me."',
      question: "What are the boats bringing in?",
      answer: [
        '"Mackerel, broken nets, stories. The stories get larger the farther out the boats went."',
        '"One crew brought a bronze hand. I asked where the rest of it was. They became very interested in leaving."',
      ],
      rumour: [
        '"Do not let a little island fool you. A deep-water creature can circle both sides of it while you are still congratulating yourself on finding land."',
      ],
    },
  ],
  [
    {
      id: "gorgo",
      name: "Gorgo",
      title: "Keeper of the Red Table",
      manner: "Commands a kitchen with the calm of a veteran officer.",
      job: "preparing the common meal",
      greeting:
        '"Put the spear down before you sit. Everyone tries to look formidable until the soup arrives."',
      question: "Are you waiting for the army too?",
      answer: [
        '"Every household is. We mend cloaks. We keep the names. We argue about ordinary things because we intend to have ordinary days again."',
        '"A soldier can give an oath. His mother did not agree to become part of it."',
      ],
      rumour: [
        '"You will not meet three hundred tired men. You will meet a promise that has forgotten how to end. Watch the captains; the others still listen."',
      ],
    },
    {
      id: "brasidas",
      name: "Brasidas",
      title: "Shield Fitter",
      manner: "Gruff, patient with learners and intolerant of boasting.",
      job: "fitting bronze shield rims",
      greeting:
        '"Hold it higher. No, with your arm. Looking stern will not stop the spear."',
      question: "What makes their shields so difficult?",
      answer: [
        '"The man to your left. A shield protects more than its owner; the line learns to move as one body."',
        '"Break the timing. Draw out the captain. A gap is worth more than a hundred blows into bronze."',
      ],
      rumour: [
        '"Leonidas was formidable before the island. Whatever is sitting in that temple has had far too long to practice."',
      ],
      stock: [
        "aegean_bronze",
        "mat_leather",
        "potion_health_xl",
        "aegean_ambrosia",
      ],
    },
    {
      id: "timarete",
      name: "Timarete",
      title: "Cloak Weaver",
      manner: "Direct, loyal to people rather than slogans.",
      job: "repairing red cloaks",
      greeting:
        '"Red hides a great many stains. It does not mend the cloth for you."',
      question: "Do you make every cloak yourself?",
      answer: [
        '"There are six looms in this street. The soldiers call themselves brothers. Half their clothes were made by sisters."',
        '"My brother left his winter cloak here. I have repaired the same seam three times. It gives my hands something sensible to do."',
      ],
      rumour: [
        '"The storm did not begin as weather. Ask what the king is protecting before you ask how to kill him."',
      ],
    },
  ],
  [
    {
      id: "iaphe",
      name: "Iaphe",
      title: "Keeper of the Ash Lantern",
      manner: "Matter-of-fact about frightening things; makes excellent bread.",
      job: "keeping the lantern lit",
      greeting:
        '"Wipe the ash off before you come in. I can feed you, but I refuse to feed the floor."',
      question: "Why stay so close to the descent?",
      answer: [
        '"Because people come back hungry. Because some of them need someone to say their name before they remember it."',
        '"And because this was my father\'s house. The Underworld arrived later."',
      ],
      rumour: [
        '"Take your way home seriously. The dead do not keep the same hours we do, and their ferryman has never offered credit."',
      ],
    },
    {
      id: "pyrros",
      name: "Pyrros",
      title: "Furnace Tender",
      manner: "Few words, keen ear, treats metal as a stubborn colleague.",
      job: "tending the forge fire",
      greeting:
        '"Stand back from the ash. The grey part is not necessarily the cold part."',
      question: "What is different about this forge?",
      answer: [
        '"The draught comes up from below. We open the shutters, we do not ask whose breath it is."',
        '"Thaleia does the difficult work. I keep the heat steady. That is harder than it sounds."',
      ],
      rumour: [
        '"Storm ribs, sail, keel. Three different problems. A stronger hull will not persuade a cursed wind to let go."',
      ],
      stock: ["aegean_bronze", "aegean_resin", "aegean_moly", "potion_mana_m"],
    },
    {
      id: "ione",
      name: "Ione",
      title: "Keeper of the Names",
      manner: "Gentle, practical and unwilling to hurry grief.",
      job: "tending the memorial stones",
      greeting:
        '"If you are looking for a name, tell me. If you are looking for silence, there is room beside me."',
      question: "Who are these stones for?",
      answer: [
        '"Those who crossed, and those who never got a crossing. The sea is not particular about the difference."',
        '"I carve the names people bring me. I leave space when they say someone may still return."',
      ],
      rumour: [
        '"You cannot fight every sorrow on the other bank. Persephone still grows things there. Remember that when all you can see is stone."',
      ],
    },
  ],
  [
    {
      id: "eukleia",
      name: "Eukleia",
      title: "Keeper of the Last Anchorage",
      manner: "Brisk hospitality, notices the empty seats first.",
      job: "preparing the harbour kitchen",
      greeting:
        '"A room, clean water, and a place to dry your cloak. Start with those. Heroics keep until morning."',
      question: "Does everyone stop here?",
      answer: [
        '"The sensible ones do. The others become a conversation between the sensible ones."',
        '"I keep a spare blanket by the door. Shipwrecked people never remember to bring one."',
      ],
      rumour: [
        '"There are quiet coves on the smaller islands. Quiet water is not the same as an empty shore. Look before you beach the hull."',
      ],
    },
    {
      id: "arkas",
      name: "Arkas",
      title: "Sail Mender",
      manner: "Patient enough for tiny stitches; impatient with cheap thread.",
      job: "patching island sails",
      greeting:
        '"I can mend a sail, not a captain\'s judgement. People often bring me both."',
      question: "Can ordinary canvas cross the storm?",
      answer: [
        '"Ordinary canvas can cross the harbour. After that the answer depends on the sky, and that sky has an opinion about you."',
        '"The Hesperid weave is something else. If you find it, do not cut a sample off to show me. Bring the whole sail."',
      ],
      rumour: [
        '"The giant on Thalke has a weakness, but bronze does not advertise its cracks. Watch the joints after it moves."',
      ],
      stock: [
        "mat_cloth",
        "aegean_resin",
        "aegean_antitoxin",
        "potion_health_xl",
      ],
    },
    {
      id: "nereis",
      name: "Nereis",
      title: "Pearl Diver",
      manner: "Quiet wit; never turns her back on the water.",
      job: "sorting shells and pearls",
      greeting:
        '"This one is a pearl. That one is an eye. I am still deciding what the third one is."',
      question: "What do you see under the islands?",
      answer: [
        '"Steps. Roofs. A road nobody has walked in longer than this harbour has had a name."',
        '"Once I saw a lamp burning. I came up slowly. You should never tell the deep that it has frightened you."',
      ],
      rumour: [
        '"A gorgon\'s face is not something you overcome by being brave. Find an angle it cannot see. Courage needs somewhere to stand."',
      ],
    },
  ],
];

const WORK = [
  [-4, 6],
  [3, 2],
  [-3, -2],
];
const SOCIAL = [
  [-3, 8],
  [0, 5],
  [4, -2],
];
const SHIRTS = [
  "#b17652",
  "#5f7990",
  "#7b8b63",
  "#a6798c",
  "#c4ae73",
  "#925044",
  "#647f80",
  "#9b7954",
];
const townsfolk: NpcDef[] = residents.flatMap((people, town) =>
  people.map((person, role): NpcDef => {
    const loc = settlements[town];
    const appearance = look(town * 3 + role);
    const skin = ["#e2b38b", "#bc835b", "#b58f70", "#d6a173"][
      (town + role) % 4
    ];
    return {
      id: `${loc.id}_${person.id}`,
      name: person.name,
      title: person.title,
      race: person.race ?? "human",
      faction: town === 5 ? "alliance" : "guild",
      personality: person.manner,
      map: "overworld",
      tx: loc.tx + WORK[role][0],
      ty: loc.ty + WORK[role][1],
      look: {
        ...appearance,
        skin,
        shirt: SHIRTS[town],
        armor: role === 1 ? "light" : "none",
        armorColor: SHIRTS[town],
        ears: person.race === "beastfolk" ? "beast" : "human",
        hair:
          role === 2 && town % 2 === 0
            ? "#bfb7a5"
            : ["#302825", "#5b3c2c", "#8c633c"][(town + role) % 3],
        height: 0.92 + ((town + role) % 4) * 0.05,
        bulk: role === 1 ? 1.1 : 0.97,
        beard: role === 1 ? "stubble" : "none",
      },
      wander: role === 2 ? 18 : 10,
      schedule: schedule(
        town,
        WORK[role],
        homes[town][role],
        SOCIAL[role],
        person.job,
      ),
      services: role === 0 ? ["inn"] : undefined,
      greeting: [
        {
          cond: { flag: "aegean:realm:restored" },
          lines: [
            person.greeting,
            town === 5
              ? '"There were voices at the empty table last night. Ordinary voices. I had forgotten how much noise a peaceful meal makes."'
              : '"The boats have started keeping their schedules again. It is a small thing. We are learning to enjoy small things."',
          ],
        },
        { lines: [person.greeting] },
      ],
      topics: [
        { text: person.question, to: "work" },
        { text: "Heard anything I should know?", to: "rumour" },
      ],
      nodes: [
        { id: "work", text: person.answer },
        { id: "rumour", text: person.rumour },
      ],
      shop:
        role === 0
          ? {
              id: `${loc.id}_${person.id}_kitchen`,
              name: person.title
                .replace("Keeper of ", "")
                .replace("Mistress of ", ""),
              priceMod: 1.08,
              stock: [
                "food_bread",
                "food_meat",
                "food_cheese",
                "food_apple",
              ].map((item) => ({ item, qty: 12 })),
              buys: ["consumable"],
              gold: 2500,
            }
          : person.stock
            ? {
                id: `${loc.id}_${person.id}_stall`,
                name: `${person.name}'s Stall`,
                priceMod: 1.16,
                stock: person.stock.map((item) => ({ item, qty: 12 })),
                buys: ["material", "consumable", "misc"],
                gold: 18000,
              }
            : undefined,
    };
  }),
);

const INDOOR_PEOPLE = [
  [
    [
      "Adaia",
      "House Steward",
      '"Manto handles the market. I handle the people who arrive after it closes. You can guess which of us hears stranger stories."',
      '"There is water by the beds. The shutters stick; lift before you pull. Breakfast waits for nobody, but I can keep a heel of bread aside."',
    ],
    [
      "Menon",
      "Caravan Smith",
      '"Hinges, shoes, spearheads. Something always breaks on the road, and it is rarely the thing you packed a spare for."',
      '"A good edge is worth keeping. The anvil will rework an old favourite; you need not abandon a weapon because you crossed a border."',
    ],
  ],
  [
    [
      "Oenone",
      "Hearth Cook",
      '"Myrine says you need feeding. Myrine usually says that. She is usually right."',
      '"The cedar smoke keeps the gnats outside. If you hear pipes in the night, close the shutters before you decide to follow them."',
    ],
    [
      "Agathon",
      "Hunting Smith",
      '"No lion trophies above this forge. The hunters need a place where they can talk about something else."',
      '"Bring what you have used, not what looks most expensive. A handle polished by your hand tells me how to fit the next one."',
    ],
  ],
  [
    [
      "Niko",
      "River Table Cook",
      '"Lunch in the front room, flour in the back. Please do not improvise a third arrangement."',
      '"We keep the spare bedding upstairs when the river rises. If you wake to somebody moving your boots, let them finish."',
    ],
    [
      "Aeson",
      "Mill Smith",
      '"The mill wants a pin, the ferry wants a nail, and a hero wants something impressive. Guess which two will keep the town alive."',
      '"There is enough heat for your blade too. Give a forge its time. Metal remembers a hurried job longer than the smith does."',
    ],
  ],
  [
    [
      "Praxilla",
      "Pilgrim Host",
      '"Leave your question with the oracle. Leave your cloak with me. I can promise to give one of them back dry."',
      '"Quiet rooms to the left. People who have received answers sometimes need them more than people who have not."',
    ],
    [
      "Euphranor",
      "Sanctuary Smith",
      '"A bell, a hinge, a sword. They all begin as something that will not listen until you heat it."',
      '"The altar lamps are my work. So are the stair rails. The priests only bless one of those, but I know which saves more lives."',
    ],
  ],
  [
    [
      "Timo",
      "Night Porter",
      '"Simo has gone to argue with the fish sellers. Rooms are still twenty, and arguing with me does not lower it."',
      '"Leave a note if your crew comes looking. I will not tell them which room unless you want me to. Harbours ought to have that much privacy."',
    ],
    [
      "Dexion",
      "Harbour Smith",
      '"Salt finds every joint. Oil the blade, dry the straps, and never tell me the sea looked calm."',
      '"The shipyard handles hulls. I handle the metal that makes a hull worth trusting. Different fires, same argument with the water."',
    ],
  ],
  [
    [
      "Alkippa",
      "Common-House Cook",
      '"Hands washed. Shields outside. Gorgo can make exceptions; I do not."',
      '"There are no officers at this table. There are people who have eaten and people I am about to feed. Sit with the second lot."',
    ],
    [
      "Polydoros",
      "Bronze Smith",
      '"A shield rim should sound clean when you strike it. A false note means a crack; a boast means I test it twice."',
      '"Brasidas fits them outside. I shape them here. He blames my work when the straps pinch. I blame his measurements. We have done good work together for thirty years."',
    ],
  ],
  [
    [
      "Meles",
      "Lantern Steward",
      '"Iaphe says no ash on the floor. I say no ghosts on the stairs. Between us the house runs quite well."',
      '"There is a lamp by every bed. Leave it burning if the dark is following you. We have oil enough."',
    ],
    [
      "Hegetor",
      "Quay Smith",
      '"Pyrros keeps the furnace breathing. I keep the tools out of it. We consider this an equal partnership."',
      '"Do not quench strange metal in the drinking water. That rule was written after an incident, and the incident is still in the well."',
    ],
  ],
  [
    [
      "Sappho",
      "Anchorage Cook",
      '"Eukleia has already counted your crew. Sit down before she counts your bruises."',
      '"The beds nearest the wall are quietest. The ones nearest the window are for people who cannot sleep without seeing the sea."',
    ],
    [
      "Lysandros",
      "Island Smith",
      '"What broke? Take your time. On this island that is sometimes a long answer."',
      '"I keep spare nails for shipwrecks and a sound hammer for everyone else. A blade can be made fine again. First we make it safe."',
    ],
  ],
];
const indoor: NpcDef[] = settlements.flatMap((loc, town) =>
  INDOOR_PEOPLE[town].map(
    ([name, title, greeting, counsel], role): NpcDef => ({
      id: `${loc.id}_${role === 0 ? "inn_host" : "indoor_smith"}`,
      name,
      title,
      race: "human",
      faction: town === 5 ? "alliance" : "guild",
      personality:
        role === 0
          ? "Calm hospitality and a sharp memory for faces."
          : "Patient hands; proud of useful, well-made things.",
      map: `int_${loc.id}_${role === 0 ? "inn" : "smithy"}`,
      tx: role === 0 ? 6 : 8,
      ty: role === 0 ? 6 : 5,
      look: {
        ...look(town + role + 2),
        shirt: SHIRTS[(town + role + 2) % SHIRTS.length],
        armor: role === 1 ? "light" : "none",
        beard: role === 1 && town % 2 ? "full" : "none",
        armorColor: "#78654e",
        hair: town % 3 ? "#493128" : "#c4b7a1",
        bulk: role === 1 ? 1.12 : 1,
      },
      wander: 8,
      services: role === 0 ? ["inn", "storage"] : undefined,
      greeting: [{ lines: [greeting] }],
      topics: [
        {
          text:
            role === 0
              ? "Anything I should know about the house?"
              : "Tell me about your work.",
          to: "work",
        },
      ],
      nodes: [{ id: "work", text: [counsel] }],
      shop:
        role === 1
          ? {
              id: `${loc.id}_indoor_forge`,
              name: `${name}'s Forge`,
              priceMod: 1.12,
              stock: [
                "aegean_bronze",
                "aegean_resin",
                "mat_leather",
                "mat_greater_rune",
                "potion_health_l",
              ].map((item) => ({ item, qty: 12 })),
              randomGear: { count: 5, level: loc.level ?? 76 },
              buys: ["weapon", "armor", "accessory", "material"],
              gold: 120000,
            }
          : undefined,
    }),
  ),
);

export const AEGEAN_NPCS: NpcDef[] = [...keepers, ...townsfolk, ...indoor];
