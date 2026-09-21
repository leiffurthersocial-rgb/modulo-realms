export type GreekAttack = 'thrust' | 'pursuit' | 'fang' | 'arrow' | 'javelin' | 'hammer' | 'breath' | 'chain' | 'labrys' | 'pick' | 'quarry' | 'recurve' | 'royal' | 'dawn' | 'storm' | 'flame' | 'twins' | 'standard';
export interface GreekWeaponStyle { attack: GreekAttack; speed: number; range: number; label: string; rhythm: string; }
const style = (attack: GreekAttack, speed: number, range: number, label: string, rhythm: string): GreekWeaponStyle => ({ attack, speed, range, label, rhythm });
/** Basic attacks are an identity of the weapon; active arts remain additional choices. */
export const GREEK_WEAPON_STYLES: Record<string, GreekWeaponStyle> = {
  aegean_dory_dawn: style('thrust', 1.25, 128, 'Long thrust', 'Narrow reach · every third thrust pierces deeper'),
  aegean_kopis_nemea: style('pursuit', 1.7, 65, 'Hunting cuts', 'Quick cut, quick cut, broad finisher'),
  aegean_hydra_fang: style('fang', 2.35, 48, 'Twin fang', 'Two rapid stabs · close reach · venom on the second'),
  aegean_artemis_bow: style('arrow', .85, 540, 'Silver lance', 'Fast arrow · pierces a line of enemies'),
  aegean_thunder_javelins: style('javelin', 1.55, 365, 'Thunder throw', 'Three piercing javelins · recover between throws'),
  aegean_hephaestus_measure: style('hammer', .58, 95, 'Forging blow', 'Slow impact · delayed forward shockwave'),
  aegean_delphic_staff: style('breath', 1.05, 350, 'Oracle breath', 'Curved three-bolt fan · close-range burst on heavy'),
  aegean_prometheus_chains: style('chain', 1.05, 155, 'Chain hook', 'Outer sweep pulls ordinary enemies into reach'),
  aegean_labyrinth_labrys: style('labrys', .7, 104, 'Labyrinth cleave', 'Broad cut · cross-cut follows a heavy attack'),
  aegean_geryon_pick: style('pick', 1.2, 74, 'Threefold drill', 'Three pinpoint impacts · third strike staggers'),
  aegean_quarry_answer: style('quarry', .48, 110, 'Fault line', 'Three delayed eruptions travel along the ground'),
  aegean_stymphalian_recurve: style('recurve', 1.75, 360, 'Bronze flock', 'Three spread arrows · fast close-range volleys'),
  aegean_kings_dory: style('royal', 1.0, 160, 'Royal reach', 'Long piercing thrust · heavy adds a shield-breaking ring'),
  aegean_last_dawn_kopis: style('dawn', 2.05, 70, 'Dawn pursuit', 'Alternating cuts · a third cut echoes behind the target'),
  aegean_storm_cleared_bow: style('storm', .62, 620, 'Storm rail', 'Slow draw · lightning-fast piercing arrow with impact burst'),
  aegean_first_flame_sceptre: style('flame', 1.12, 405, 'First flames', 'Every basic attack cycles lance, fan, then fire ring'),
  aegean_twin_oathblades: style('twins', 1.85, 150, 'Twin orbit', 'Near slash then distant returning chain · rewards spacing'),
  aegean_unbroken_standard: style('standard', .82, 135, 'Rallying sweep', 'Alternate long thrust and circular sweep · heavy holds ground'),
};
