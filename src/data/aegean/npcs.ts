import type { NpcDef } from "../npcs";
import type { Look } from "../../game/art/characters";
import { AEGEAN_LOCATIONS } from "./world";
const names = [
  [
    "Eudora",
    "Keeper of the Veteran Rolls",
    "The gods remember victories. I remember the people who came home from them. Your Chronicle will need both.",
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
    "Beyond the shelf, the monsters grow bolder. Brace before impact, row out of a warning, and keep enough hull to get home. A wreck is a setback, never the end of your Chronicle.",
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
export const AEGEAN_NPCS: NpcDef[] = settlements.map((loc, i) => ({
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
  topics: [
    { text: "What should I know before going farther?", to: "counsel" },
    { text: "Open my Aegean Chronicle.", actions: [{ type: "chronicle" }] },
  ],
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
