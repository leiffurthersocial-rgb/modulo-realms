import { RNG } from '../core/rng';
import { buildPropGrid, createMap, fillRect, setTile, type GameMap, type PropInstance } from './map';
import { T, TILE } from './tiles';

const TOWN_NAMES: Record<string, [string, string, string]> = {
  thyra: ['The Split Amphora', 'The Roadside Forge', 'Eudora’s Caravan Store'],
  nemean_hearth: ['The Cedar Hearth', 'The Grove Smithy', 'Melia’s Herb Store'],
  potamoi: ['The River Table', 'The Waterwheel Forge', 'The Mill Granary'],
  delphi: ['The Laurel Rooms', 'The Pilgrims’ Smithy', 'The Oracle’s Scriptorium'],
  aigialos: ['The Three Oars', 'The Anchor Forge', 'The Ropewalk Warehouse'],
  sparta: ['The Red Table', 'The Lacedaemonian Armoury', 'The Quartermaster’s Store'],
  ember_quay: ['The Ash Lantern', 'The Cinder Forge', 'The Ferryman’s Supplies'],
  kymene: ['The Last Anchorage', 'The Islanders’ Forge', 'The Net House'],
};

/** Small, usable rooms follow the valley's doors, inns, anvils and shared stash. */
export function buildAegeanInterior(id: string, returnX: number, returnY: number): GameMap | undefined {
  const match = /^int_aegean_(.+)_(inn|smithy|store)$/.exec(id);
  if (!match || !TOWN_NAMES[match[1]]) return;
  const [, town, kind] = match;
  const index = kind === 'inn' ? 0 : kind === 'smithy' ? 1 : 2;
  const w = [23,21,19][index], h = [17,15,15][index];
  const warm = town === 'sparta' || town === 'ember_quay';
  const coastal = ['aigialos','kymene','ember_quay'].includes(town);
  const floor = kind === 'inn' ? T.FLOOR_WOOD : kind === 'smithy' ? T.FLOOR_STONE : warm ? T.SAND_FLOOR : T.MARBLE;
  const map = createMap({id,name:TOWN_NAMES[town][index],kind:'interior',w,h,outdoor:false,darkness:0,music:'village',parent:`aegean_${town}`});
  const rng = new RNG(id);
  const put = (x:number,y:number,art:string,extra:Partial<PropInstance>={}) => map.props.push({art,x:x*TILE+16,y:y*TILE+32,...extra});
  fillRect(map,0,0,w,h,T.MARBLE_WALL);
  fillRect(map,1,1,w-2,h-2,floor);
  // A worn perimeter mosaic, rather than one featureless stone rectangle.
  for(let x=2;x<w-2;x++) {setTile(map,x,2,T.BRONZE_FLOOR);setTile(map,x,h-3,T.BRONZE_FLOOR);}
  const ex=Math.floor(w/2);
  setTile(map,ex,h-1,floor);setTile(map,ex,h-2,floor);
  put(2,2,'forge',{cw:30,ch:14,light:180,lightColor:'#e5ad68'});
  put(w-3,2,'aegean_amphora',{cw:13,ch:8});
  put(w-4,h-4,'chest',{cw:24,ch:14,interact:'storage',label:'Open your storage chest'});
  put(ex,h-3,'rug',{flat:true});
  for (const x of [3,w-4]) put(x,1,'torch',{light:150,lightColor:'#eec681',cw:6,ch:4});
  if(kind==='inn') {
    for(const [x,y] of [[5,8],[11,7],[17,8],[5,11],[11,11],[17,11]]) {
      put(x,y,'table',{cw:40,ch:14});
      put(x-1,y+1,'chair',{cw:16,ch:10});put(x+2,y+1,'chair',{cw:16,ch:10});
    }
    for(const x of [4,9,14]) put(x,3,'bed',{cw:30,ch:40,interact:'inn_bed',label:'Rent a room (20 gold)'});
    put(3,13,'barrel',{cw:18,ch:10});put(2,12,'sack');
    put(19,4,'bookshelf',{cw:32,ch:12});
    put(17,12,coastal?'aegean_fishing_net':'aegean_basket');
    if(town==='sparta') {put(2,6,'weapon_rack',{cw:25,ch:12});put(20,11,'aegean_standard');}
    if(town==='delphi') put(18,12,'aegean_lyre');
  } else if(kind==='smithy') {
    put(5,5,'aegean_anvil',{cw:26,ch:12,interact:'aegean',label:'Use the anvil',data:{action:'forge'}});
    put(5,8,'grindstone',{cw:26,ch:12});
    put(14,4,'weapon_rack',{cw:30,ch:12});put(17,4,'weapon_rack',{cw:30,ch:12});
    put(14,8,'table',{cw:40,ch:14});
    for(const x of [3,6,9]) put(x,11,'crate',{cw:18,ch:12});
    put(17,10,'barrel',{cw:18,ch:10});
    put(3,5,'aegean_amphora');
    if(town==='potamoi') put(2,9,'aegean_sluice');
    if(town==='ember_quay') put(17,7,'aegean_brazier',{light:130,lightColor:'#ed885b'});
  } else {
    for(const [x,y] of [[3,4],[7,4],[12,4],[15,4],[4,8],[14,8]])
      put(x,y,town==='delphi'?'bookshelf':rng.bool(.5)?'barrel':'crate',{cw:22,ch:12});
    put(9,8,'table',{cw:40,ch:14});
    put(3,11,'sack');put(5,11,coastal?'aegean_fishing_net':'aegean_amphora');
    if(town==='nemean_hearth') put(14,11,'alchemy_table',{cw:32,ch:12});
    if(town==='potamoi') {put(13,6,'hay');put(2,9,'hay');}
  }
  // Context on a small sign follows the original one-interaction object grammar.
  put(w-2,6,'signpost',{interact:'sign',label:'Read the house sign',data:{text:map.name}});
  map.portals.push({x:ex*TILE-12,y:(h-1)*TILE-4,w:32,h:36,to:'overworld',tx:returnX,ty:returnY,label:'Step outside',kind:'door'});
  buildPropGrid(map);
  return map;
}
