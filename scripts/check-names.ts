/**
 * Name filter: slurs and profanity are blocked however they are disguised,
 * ordinary names (every NPC in the game, the creation name pool, common real
 * first names) still pass.
 */
import { checkName, isNameBlocked, canonicalName } from '../src/game/names/nameFilter';
import { NPCS } from '../src/data/npcs';
import { AEGEAN_NPCS } from '../src/data/aegean/npcs';

let failures = 0;
const fail = (msg: string) => { failures++; console.error(`  FAIL ${msg}`); };

const MUST_BLOCK = [
  // plain, case, plural
  'nigger', 'NIGGER', 'Niggers', 'nigga', 'faggot', 'Kanake', 'Neger', 'Zigeuner', 'Schwuchtel', 'Hurensohn', 'fotze',
  'Tschusch', 'kike', 'chink', 'spic', 'wetback', 'retard', 'tranny', 'Hitler', 'SiegHeil', 'Nazi', 'Auschwitz',
  // inside other words and run together
  'xXniggerXx', 'BigNigga99', 'KillAllJews', 'Heil Hitler', 'White Power', 'IamAFaggot', 'Judensau', 'fuck', 'MotherFucker',
  'Bitch', 'cunt', 'Whore', 'asshole', 'Bastard', 'pedo', 'Pedophile', 'Rapist', 'Kinderficker', 'Wichser',
  // leetspeak and look-alikes
  'n1gg3r', 'N1GGA', 'n!gger', 'nigg@', 'f4gg0t', 'fvck', 'f u c k', 'f.u.c.k', 'f_u_c_k', 'n-i-g-g-e-r',
  'niiiigggger', 'nіgger' /* Cyrillic і */, 'nіggеr', 'Fück', 'ńigger', 'h1tl3r', '1488', 'SS1488', 'niqqa', 'phaggot',
  // whole words from the soft lists
  'Ass', 'Ass69', 'Dick', 'penis', 'Arsch', 'Porno', 'admin', 'Moderator',
];

const COMMON_NAMES = [
  'Anna', 'Lukas', 'Leon', 'Noah', 'Mia', 'Emma', 'Lea', 'Elias', 'Jonas', 'Felix', 'Ben', 'Paul', 'Luca', 'Finn',
  'Sophie', 'Marie', 'Laura', 'Julia', 'Sarah', 'Nina', 'Lena', 'Hannah', 'Clara', 'Jana', 'Tim', 'Jan', 'Nico',
  'Rafael', 'Leif', 'Sebastian', 'Matthias', 'Andreas', 'Thomas', 'Michael', 'Daniel', 'Stefan', 'Patrick', 'Florian',
  'Dominik', 'Kevin', 'Marco', 'Fabio', 'Alessandro', 'Giulia', 'Chiara', 'Francesca', 'Lorenzo', 'Matteo',
  'Pierre', 'Louis', 'Camille', 'Chloe', 'Manon', 'Hugo', 'Jules', 'Carlos', 'Diego', 'Sofia', 'Lucia', 'Pablo',
  'Mohammed', 'Ahmed', 'Fatima', 'Aisha', 'Yusuf', 'Omar', 'Ali', 'Emre', 'Mehmet', 'Elif', 'Zeynep', 'Arjun',
  'Priya', 'Wei', 'Yuki', 'Hiroshi', 'Kenji', 'Mei', 'Jin', 'Olga', 'Ivan', 'Dmitri', 'Anastasia', 'Katarina',
  'Cassandra', 'Scunthorpe', 'Dickens', 'Hancock', 'Sussex', 'Essex', 'Raccoon', 'Cocoon', 'Tycoon', 'Grape',
  'Shiitake', 'Spice', 'Torpedo', 'Centipede', 'Mongoose', 'Crisis', 'Bass', 'Glass', 'Classic', 'Assassin',
  'Bassist', 'Passion', 'Hasselhoff', 'Shitake', 'Penistone', 'Analyst', 'Therapist', 'Grapes', 'Drape',
  'Nightblade', 'Shadowfang', 'Ashbringer', 'Ironheart', 'Stormcaller', 'Dragonslayer', 'Moonwhisper', 'Kingsley',
  'Player One', 'Hero_42', 'Dark-Knight', 'xX Ash Xx', 'Mr Bones', 'Lady Grey', 'Big Tom', 'Sir Reginald',
];

const POOL = ['Ashe', 'Torvin', 'Maela', 'Rurik', 'Sennah', 'Balen', 'Ysra', 'Corwin', 'Nira', 'Halvard', 'Eska', 'Dain', 'Vessa', 'Orin', 'Thal', 'Bryndis'];
const npcNames = [...NPCS, ...AEGEAN_NPCS].flatMap((n) => n.name.split(/[^A-Za-z]+/).filter((w) => w.length >= 3));

for (const name of MUST_BLOCK) if (!isNameBlocked(name)) fail(`not blocked: ${JSON.stringify(name)}`);

const mustPass = [...new Set([...COMMON_NAMES, ...POOL, ...npcNames])];
const wrongly = mustPass.filter((n) => isNameBlocked(n));
// The odd innocent word is the price of searching inside names; a real first name or an NPC never is.
for (const n of wrongly) fail(`innocent name blocked: ${JSON.stringify(n)}`);

// the rest of the rules
const expect = (raw: string, reason: string | null) => {
  const r = checkName(raw);
  const got = r.ok ? null : r.reason;
  if (got !== reason) fail(`checkName(${JSON.stringify(raw)}) gave ${got}, expected ${reason}`);
};
expect('Al', 'short');
expect('  Torvin   Ashe ', null);
expect('Seventeen chars xx', 'long');
expect('Zoë', 'chars');
expect('<script>', 'chars');
expect('123', 'chars');
expect('Torvin', null);
expect('n1gg3r', 'blocked');
if (canonicalName('N1gg3r') !== canonicalName('nigger')) fail('canonicalName does not merge spellings');

console.log(`  ${MUST_BLOCK.length} disguised slurs, ${mustPass.length} ordinary names`);
if (failures) { console.error(`check-names: ${failures} failure(s)`); process.exit(1); }
console.log('check-names: ok');
