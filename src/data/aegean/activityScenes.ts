/** Local scenes, in tiles from the story's landmark. Indices 1–3 are saved
 * interaction identities: their positions and appearance may change, never IDs. */
export interface ActivitySceneObject {
  art: string;
  name: string;
  dx: number;
  dy: number;
}
export interface ActivityScene {
  anchor: ActivitySceneObject;
  objects: ActivitySceneObject[];
  scenery?: ActivitySceneObject[];
  companion?: { name: string; kind: "person" | "shade" | "light" | "cargo" | "standard"; color: string };
}
const object = (art: string, name: string, dx = 0, dy = 0): ActivitySceneObject => ({ art, name, dx, dy });
const scene = (art: string, name: string, objects: ActivitySceneObject[] = [], scenery: ActivitySceneObject[] = [], companion?: ActivityScene["companion"]): ActivityScene => ({ anchor: object(art, name), objects, scenery, companion });

/** These are deliberately authored individually. A harbour workshop, a shade's
 * archive and a shepherd's trail should not look like the same puzzle room. */
export const AEGEAN_ACTIVITY_SCENES: Record<string, ActivityScene> = {
  aegean_story_lighthouse: scene("aegean_beacon", "The false harbour light", [
    object("aegean_mirror", "Sun mirror · the merchant's wreck", -4, 2),
    object("aegean_bell", "Bell signal · the fisher's wreck", -1, 4),
    object("aegean_horn", "Horn signal · the pilgrim's wreck", 4, 1),
  ], [object("aegean_driftwood", "", -5, 3), object("aegean_fishing_net", "", 2, 4)]),
  aegean_story_names: scene("aegean_shield_grave", "The sailors' unfinished memorial", [
    object("aegean_amphora", "Damon's wine cup", -5, -2),
    object("aegean_fishing_net", "Myrine's knotted net", -2, 3),
    object("aegean_shore_bones", "Philon's broken oar", 4, 4),
  ], [object("aegean_driftwood", "", -4, 0), object("aegean_thyme", "", 2, -1)]),
  aegean_story_olive: scene("aegean_olive", "The last living olive", [
    object("aegean_sluice", "Root channel", -4, -1),
    object("aegean_sluice", "Grove channel", 2, 4),
    object("aegean_sluice", "Ash channel", 4, -3),
  ], [object("well", "", -1, 2), object("tree_dead", "", -4, -4), object("aegean_thyme", "", 2, 1)]),
  aegean_story_bell: scene("aegean_bell", "The harbour's broken bronze bell", [
    object("aegean_basket", "The bell's clapper", -3, 2),
    object("aegean_cart", "The bell's crown", -5, -1),
    object("aegean_crane", "The bell's suspension rope", 3, -2),
  ], [object("aegean_amphora", "", -4, 3), object("aegean_low_wall", "", 1, -3)]),
  aegean_story_satyrs: scene("aegean_amphora", "The satyrs' festival wine", [
    object("aegean_vines", "The grape sign", 3, 1),
    object("aegean_thyme", "The thyme sign", 5, -2),
    object("aegean_horn", "The piper's sign", 2, -5),
  ], [object("aegean_olive", "", -2, -3), object("aegean_basket", "", 2, 3)], { name: "Festival piper", kind: "person", color: "#9b7299" }),
  aegean_story_centaur: scene("weapon_rack", "The centaur's broken bow", [
    object("aegean_shield_wall", "The low shield target", -5, -2),
    object("aegean_shield_wall", "The split shield target", -1, -4),
    object("aegean_shield_wall", "The high shield target", 4, -3),
  ], [object("aegean_horn", "", 2, 1), object("log", "", -3, 2)]),
  aegean_story_mess: scene("table", "The empty place at the mess", [
    object("aegean_shield_wall", "The shield court", -4, 2),
    object("aegean_horn", "The spear court", -4, -3),
    object("aegean_low_wall", "The common court", 2, -4),
  ], [object("aegean_amphora", "", 2, 1), object("bench", "", 0, 2), object("aegean_basket", "", -2, 0)], { name: "The mess standard", kind: "standard", color: "#a4493f" }),
  aegean_story_shield: scene("aegean_shield_grave", "The mother's named shield", [
    object("aegean_olive", "The roadside olive", -3, 2),
    object("aegean_column", "The old road's broken arch", -5, -1),
    object("aegean_shield_grave", "The Eurotas memorial", -3, -5),
  ], [object("aegean_thyme", "", -2, -5), object("aegean_low_wall", "", 1, 2)], { name: "The shield bearer", kind: "person", color: "#a98670" }),
  aegean_story_shipwright: scene("aegean_crane", "The flooded repair dock", [
    object("aegean_sluice", "Keel bay", 3, 2),
    object("aegean_sluice", "Rib bay", 3, -2),
    object("aegean_sluice", "Sail loft steps", -2, -4),
  ], [object("aegean_cart", "", -3, 2), object("aegean_driftwood", "", 5, 0), object("aegean_clothesline", "", -1, -5)], { name: "The shipwright's daughter", kind: "person", color: "#558b98" }),
  aegean_story_theatre: scene("aegean_resonator", "The drowned orchestra", [
    object("aegean_resonator", "The singer's resonator", -4, 1),
    object("aegean_bell", "The chorus bell", -2, -3),
    object("aegean_horn", "The sea-facing horn", 3, -3),
  ], [object("aegean_column", "", 4, 1), object("aegean_pillar_cracked", "", -5, -2)]),
  aegean_story_icarus: scene("aegean_scroll", "Daedalus' scorched chart", [
    object("aegean_mirror", "The sun lens", -3, 2),
    object("aegean_driftwood", "The broken wing spar", -5, -2),
    object("aegean_mirror", "The horizon lens", -1, -5),
  ], [object("aegean_shore_bones", "", 2, 1), object("aegean_thyme", "", -3, -4)]),
  aegean_story_charon: scene("aegean_scroll", "Charon's ferry ledger", [
    object("aegean_amphora", "The widow's fare", 3, -1),
    object("aegean_basket", "The child's empty purse", 5, 2),
    object("aegean_shield_grave", "The soldier's unpaid passage", 2, 4),
  ], [object("lantern", "", -2, 1), object("aegean_driftwood", "", 4, 4)]),
  aegean_story_soldier: scene("aegean_shield_grave", "The nameless soldier's resting place", [
    object("aegean_shield_wall", "The remembered shield", -3, -2),
    object("aegean_basket", "The household keepsake", -5, 1),
    object("aegean_scroll", "The muster roll", -2, 4),
  ], [object("aegean_thyme", "", 1, -2), object("aegean_pillar_cracked", "", -4, 3)]),
  aegean_story_winter: scene("aegean_fountain", "Persephone's frozen spring", [
    object("aegean_thyme", "The thyme bed", 3, -2),
    object("aegean_wheat", "The grain bed", 5, 1),
    object("aegean_vines", "The pomegranate bed", 2, 4),
  ], [object("aegean_sluice", "", 1, -3), object("tree_dead", "", -3, 1)], { name: "Persephone's living light", kind: "light", color: "#a4df9b" }),
  aegean_story_letter: scene("aegean_scroll", "The sailor's sealed letter", [
    object("bookshelf", "The archive of unreturned sailors", 3, -2),
  ], [object("table", "", 0, -1), object("lantern", "", 2, -3)]),
  aegean_story_empty: scene("aegean_statue", "The frieze's empty place", [
    object("aegean_shield_wall", "The oath to the city", 0, -3),
    object("aegean_shield_grave", "The oath to the fallen", 3, -3),
    object("aegean_stele", "The oath to the living", 5, 0),
  ], [object("aegean_column", "", 5, -4), object("aegean_thyme", "", -2, 1)]),

  aegean_contract_supply: scene("aegean_cart", "The stranded supply cart", [
    object("aegean_fishing_net", "The fishing steps", -2, 2),
    object("aegean_low_wall", "The sea wall shelter", -5, 2),
    object("aegean_basket", "The harbour store", -5, -2),
  ], [object("sack", "", 1, 0), object("aegean_amphora", "", 0, 2)], { name: "Supply bearer", kind: "cargo", color: "#b59b69" }),
  aegean_contract_hunt: scene("bone_pile", "The marked beast's clearing", [
    object("aegean_shore_bones", "Splintered deer bones", 2, 3),
    object("log", "The clawed fallen trunk", -2, 5),
    object("aegean_thyme", "Blood in the thyme", -5, 2),
  ], [object("bush", "", 3, -2), object("tree_dead", "", -3, -2)]),
  aegean_contract_reef: scene("aegean_crane", "The reef workers' hoist", [
    object("aegean_bell", "The shoal bell", -2, -4),
    object("aegean_beacon", "The channel beacon", 2, -5),
    object("aegean_horn", "The reef horn", 4, -1),
  ], [object("aegean_fishing_net", "", -2, 2)]),
  aegean_contract_rescue: scene("aegean_driftwood", "The stranded crew's wreck", [
    object("aegean_fishing_net", "The landing ropes", -2, -2),
    object("aegean_low_wall", "The sheltered landing", -5, -1),
    object("campfire", "The rescue fire", -5, 3),
  ], [object("aegean_amphora", "", 2, 1), object("aegean_shore_bones", "", 1, -2)], { name: "Stranded sailor", kind: "person", color: "#6a91a0" }),
  aegean_contract_cargo: scene("crate", "The whispering cargo", [
    object("aegean_scroll", "The red wax seal", -3, 1),
    object("aegean_amphora", "The salt seal", -5, -2),
    object("aegean_bell", "The bronze ward", -2, -5),
  ], [object("barrel", "", 2, -1), object("aegean_cart", "", 0, 2)], { name: "The warded cargo", kind: "cargo", color: "#a78763" }),
  aegean_contract_beacon: scene("aegean_beacon", "The outer sea watchfire", [], [
    object("aegean_driftwood", "", -2, 2), object("aegean_bell", "", 2, -1),
  ]),
  aegean_contract_shade: scene("ruin_arch", "The unclosed door", [
    object("aegean_bell", "The mourning ward", -3, 2),
    object("aegean_shield_grave", "The burial ward", 3, 3),
    object("aegean_fountain", "The still-water ward", 4, -2),
  ], [object("aegean_pillar_cracked", "", -3, -2), object("aegean_shore_bones", "", 1, 2)]),
  aegean_contract_raiders: scene("aegean_shield_wall", "The raiders' rally ground", [
    object("aegean_horn", "The spear horn", -5, 0),
    object("aegean_bell", "The shield bell", -2, -3),
    object("aegean_beacon", "The charge signal", 3, -2),
  ], [object("weapon_rack", "", 3, 2), object("aegean_cart", "", -2, 3)]),
  aegean_contract_aqueduct: scene("aegean_fountain", "The aqueduct's dry basin", [
    object("aegean_sluice", "The low sluice", -2, -2),
    object("aegean_sluice", "The middle sluice", -1, -5),
    object("aegean_sluice", "The high sluice", 3, -6),
  ], [object("aegean_column", "", 1, -3), object("aegean_pillar_cracked", "", -4, -4)]),
  aegean_contract_offerings: scene("aegean_basket", "The pilgrims' offering", [
    object("aegean_fountain", "The washing basin", 3, 0),
    object("aegean_cypress", "The laurel walk", 4, -3),
    object("altar", "The quiet altar", 1, -5),
  ], [object("aegean_amphora", "", -2, 1), object("aegean_thyme", "", 2, -3)], { name: "The offering bearer", kind: "person", color: "#d3c79c" }),
  aegean_contract_pass: scene("aegean_horn", "The wind stair's warning horn", [
    object("aegean_low_wall", "The lower stair brace", -3, -1),
    object("aegean_pillar_cracked", "The hanging landing brace", -4, -4),
    object("aegean_column", "The upper stair brace", -1, -6),
  ], [object("aegean_thyme", "", 2, -2), object("rock_small", "", -5, -2)]),
  aegean_contract_arena: scene("aegean_horn", "The bronze measuring court", [
    object("aegean_shield_wall", "The shield lane", -4, -2),
    object("weapon_rack", "The spear lane", 0, -4),
    object("aegean_pen_gate", "The runner's lane", 4, -2),
  ], [object("bench", "", -3, 2), object("aegean_amphora", "", 3, 2)]),

  aegean_discovery_nine_echoes: scene("aegean_fountain", "The basin of nine echoes", [
    object("aegean_sluice", "The first arch's sluice", -4, -1),
    object("aegean_bell", "The fifth arch's bell", 0, -3),
    object("aegean_resonator", "The ninth arch's echo jar", 4, -1),
  ], [object("aegean_column", "", -2, -3), object("aegean_pillar_cracked", "", 2, -3)]),
  aegean_discovery_last_mile: scene("aegean_shield_grave", "The veteran's roadside shield"),
  aegean_discovery_helmet_olive: scene("aegean_olive", "The helmet caught in the olive's roots", [], [object("aegean_shield_grave", "", 1, 0)]),
  aegean_discovery_dryad_spring: scene("aegean_fountain", "The dryad's still spring", [
    object("aegean_sluice", "The root-bound spring", -3, 1),
    object("aegean_sluice", "The fern-covered spring", -1, -4),
    object("aegean_sluice", "The thyme-covered spring", 3, -2),
  ], [object("fern", "", -2, -4), object("aegean_thyme", "", 4, -2)]),
  aegean_discovery_split_star: scene("aegean_mirror", "The split-star observatory", [
    object("aegean_mirror", "The dawn reflector", -4, -2),
    object("aegean_mirror", "The zenith reflector", 0, -5),
    object("aegean_mirror", "The dusk reflector", 4, -2),
  ], [object("aegean_scroll", "", 2, 1), object("aegean_pillar_cracked", "", -2, 1)]),
  aegean_discovery_wind_stair: scene("aegean_horn", "The wind stair's last landing"),
  aegean_discovery_backward_wheel: scene("aegean_watermill", "The backward-turning mill wheel", [
    object("aegean_sluice", "The millrace inlet", -3, -3),
    object("aegean_sluice", "The spill channel", 2, -3),
    object("aegean_sluice", "The river outlet", 4, 1),
  ], [object("aegean_wheat", "", -2, 2), object("sack", "", 1, 2)]),
  aegean_discovery_supplicants: scene("aegean_basket", "The waiting supplicant", [
    object("aegean_column", "The far end of the bridge", 5, -1),
  ], [], { name: "The old supplicant", kind: "person", color: "#afae91" }),
  aegean_discovery_ninth_inscription: scene("aegean_pillar_cracked", "The ninth inscription"),
  aegean_discovery_silent_laurel: scene("aegean_cypress", "The silent oracle's laurel", [
    object("aegean_bell", "The listening bell", -4, 0),
    object("aegean_amphora", "The sealed voice jar", -2, -3),
    object("aegean_resonator", "The whispering stone", 2, -4),
  ], [object("aegean_thyme", "", 2, 1)]),
  aegean_discovery_false_lighthouse: scene("aegean_beacon", "The lighthouse that points inland"),
  aegean_discovery_hanging_ship: scene("aegean_crane", "The ship suspended above the old tide", [], [object("aegean_driftwood", "", 1, 0)]),
  aegean_discovery_empty_frieze: scene("aegean_statue", "The uncarved space in the frieze"),
  aegean_discovery_mothers_shield: scene("aegean_shield_grave", "The shield with a mother's inscription"),
  aegean_discovery_feather_causeway: scene("aegean_fishing_net", "The feather-strewn causeway", [
    object("aegean_bell", "The reed bell", -3, 0),
    object("aegean_horn", "The bronze-beaked horn", 0, 3),
    object("aegean_resonator", "The feather jar", 3, 0),
  ], [object("reeds", "", 2, 2)]),
  aegean_discovery_drowned_granary: scene("aegean_wheat", "Grain growing through the drowned roof", [], [object("aegean_basket", "", -1, 0)]),
  aegean_discovery_cooling_steps: scene("aegean_sluice", "The cooling steps", [
    object("aegean_sluice", "The first cooling pool", -3, 0),
    object("aegean_sluice", "The middle cooling pool", 0, -3),
    object("aegean_sluice", "The last cooling pool", 3, -4),
  ], [object("aegean_pillar_cracked", "", -1, -2)]),
  aegean_discovery_last_sunbeam: scene("aegean_mirror", "The last sunbeam at the descent"),
  aegean_discovery_icarian_fall: scene("aegean_driftwood", "Wax still clinging to a fallen wing"),
  aegean_discovery_cyclops_table: scene("aegean_cyclops_table", "The Cyclops' stone table", [], [object("aegean_shore_bones", "", 1, 1), object("aegean_amphora", "", -1, 0)]),
  aegean_discovery_fleet_bell: scene("aegean_bell", "The bell beneath the lost fleet", [], [object("aegean_driftwood", "", -2, 1), object("aegean_fishing_net", "", 2, -1)]),
  aegean_discovery_drowned_lyre: scene("aegean_lyre", "The drowned lyre's answering stone", [
    object("aegean_amphora", "The low singing jar", -3, 1),
    object("aegean_bell", "The middle singing bell", -4, -3),
    object("aegean_horn", "The high singing horn", 1, -4),
  ], [object("aegean_pillar_cracked", "", 2, 2)]),
  aegean_discovery_unraised_shields: scene("aegean_shield_grave", "The shields no one raised"),
  aegean_discovery_first_dawn: scene("aegean_mirror", "The first light through Asterion's broken crown"),

  aegean_veteran_trial: scene("aegean_horn", "The old drillmaster's horn", [
    object("aegean_shield_wall", "Shield of the left rank", -3, -2),
    object("aegean_shield_wall", "Shield of the centre rank", 0, -3),
    object("aegean_shield_wall", "Shield of the right rank", 3, -2),
  ], [object("weapon_rack", "", -3, 1), object("aegean_basket", "", 2, 2)]),
  aegean_harbour_training: scene("aegean_fishing_net", "The first-oar training dock", [
    object("aegean_bell", "The inner harbour bell", 2, 2),
    object("aegean_horn", "The turning-post horn", 5, 1),
    object("aegean_beacon", "The return light", 3, -2),
  ], [object("aegean_amphora", "", -2, 1)], { name: "Harbour instructor", kind: "person", color: "#6297a6" }),
  aegean_storm_altar: scene("altar", "The altar beneath three thunderheads", [
    object("aegean_column", "The rain conductor", -4, 2),
    object("aegean_pillar_cracked", "The thunder conductor", -2, -4),
    object("aegean_statue", "The lightning conductor", 4, -1),
  ], [object("aegean_mirror", "", 2, 3)]),
  aegean_forge_measure: scene("anvil", "The ash smith's measuring anvil", [
    object("aegean_sluice", "The oil quench", -4, 1),
    object("aegean_sluice", "The water quench", -2, -3),
    object("aegean_sluice", "The brine quench", 3, -3),
  ], [object("forge", "", 3, 1), object("aegean_cart", "", -2, 3)]),
  aegean_crossroads: scene("signpost", "The roads that remember", [
    object("aegean_stele", "The coast road's stone", 4, 2),
    object("aegean_pillar_cracked", "The mountain road's stone", 1, -5),
    object("aegean_shield_grave", "The old city's road stone", -5, 1),
  ], [object("aegean_thyme", "", -2, -2), object("aegean_olive", "", 2, 3)]),
};
