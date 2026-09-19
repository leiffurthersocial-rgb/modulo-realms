import { AEGEAN_RECIPES, type AegeanRecipe } from './content';
import { AEGEAN_ADVENTURE_BY_ID } from './world';

export interface ShipbuildingSource {
  steps: Array<{ text: string; proof?: string }>;
  recipe?: AegeanRecipe;
}

const adventure = (id: string) => AEGEAN_ADVENTURE_BY_ID[id].name;

/** Directions from the shipwright, using the actual reward and recipe paths.
 * Learning where a component lies never awards it or unlocks fast travel. */
export const AEGEAN_SHIPBUILDING_SOURCES: Record<string, ShipbuildingSource> = {
  aegean_bull: {
    steps: [{ text: `Sail to Crete of the Broken Palace, land at its eastern pier, and complete ${adventure('aegean_bull')} in the north of the island.`, proof: 'aegean_bull' }],
  },
  aegean_army: {
    steps: [{ text: `Defeat all Three Hundred at ${adventure('aegean_army')}, on the mainland east of Delphi. This also opens the Released Harbour and the storm route.`, proof: 'aegean_army' }],
  },
  'aegean:component:ribs': {
    steps: [
      { text: `Complete ${adventure('aegean_boar')}, the Erymanthian Boar's hunt in the Olympian Escarpment, far north of Delphi.`, proof: 'aegean_boar' },
      { text: `Complete ${adventure('aegean_augeas')} at the river estate north-east of Potamoi.`, proof: 'aegean_augeas' },
      { text: 'Then use any Greek anvil and choose A Hull That Holds. The two labours award bronze; Greek trading posts also sell it.' },
    ],
    recipe: AEGEAN_RECIPES.find((r) => r.flag === 'aegean:component:ribs'),
  },
  'aegean:component:sail': {
    steps: [
      { text: 'Sail to the Hesperid Veil, the garden island in the far south-east. Circle to its eastern landing and press E beside the pier to come ashore.' },
      { text: `Complete ${adventure('aegean_hesperides')} by carrying the celestial burden between its three anchors. The star-sail is awarded when the trial ends.`, proof: 'aegean_hesperides' },
    ],
  },
  'aegean:component:keel': {
    steps: [
      { text: "Enter Acheron's Landing at Taenarum, south of Ember Quay on the Ashen Peninsula. Continue through the Asphodel Fields and Persephone's Garden into the House of Hades." },
      { text: `Take the Cerberus trial door in the House of Hades and complete ${adventure('aegean_cerberus')}. Evade the three heads and place restraints during their recovery; completing the trial awards the keel-binding.`, proof: 'aegean_cerberus' },
    ],
  },
};
