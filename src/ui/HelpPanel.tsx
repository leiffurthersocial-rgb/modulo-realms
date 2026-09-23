import { useState } from 'react';
import type { Game } from '../game/core/game';
import { DEFAULT_BINDINGS } from '../game/core/input';
import { RARITY_LABEL, RARITY_ORDER } from '../game/items/types';
import { rarityColor } from './ItemCard';
import { Modal } from './kit';

type SectionId = 'basics' | 'combat' | 'gear' | 'world' | 'progress';

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: 'basics', label: 'The basics' },
  { id: 'combat', label: 'Fighting' },
  { id: 'gear', label: 'Loot and gear' },
  { id: 'world', label: 'The valley' },
  { id: 'progress', label: 'Getting stronger' },
];

/** The first bound key for an action, in a form worth printing. */
const key = (k: keyof typeof DEFAULT_BINDINGS): string => {
  const raw = DEFAULT_BINDINGS[k][0] ?? '';
  return raw.replace('Key', '').replace('Digit', '').replace('Arrow', '').replace('Left', '').replace('Right', '') || '?';
};

/** A short, readable manual. Reachable from the pause menu at any time. */
export default function HelpPanel({ game }: { game: Game }) {
  const [tab, setTab] = useState<SectionId>('basics');

  return (
    <Modal title="How to Play" sub="Everything the game will not stop to explain" size="l" tall onClose={() => game.closeAll()}>

        <div className="help-layout">
          <div className="help-nav">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`help-tab ${tab === s.id ? 'active' : ''}`}
                onClick={() => setTab(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="help-body scroll">
            {tab === 'basics' ? (
              <>
                <H>Moving and looking around</H>
                <P>
                  <K>{key('up')}</K> <K>{key('left')}</K> <K>{key('down')}</K> <K>{key('right')}</K> walk, and the
                  arrow keys do the same. <K>{key('interact')}</K> is the one key that does everything else: it opens
                  doors, talks to people, opens chests, uses waystones and reads notice boards. If something can be
                  interacted with, a prompt appears over it when you are close enough.
                </P>
                <P>
                  Everything in this game can be played from the keyboard alone, which is what makes it comfortable on
                  a tablet with a keyboard case. A mouse works if you have one, but nothing needs it.
                </P>
                <P>
                  It also plays by touch. On a phone or a tablet the on-screen controls come up by themselves — a
                  thumbstick on the left and the buttons on the right — and you can turn them on or off at any time
                  under <b>Settings &rarr; Controls</b>. The stick is analog, so a light push walks and a full push
                  runs, and it recentres wherever your thumb lands rather than making you find the middle of it. You
                  can hold the stick and hammer a button at the same time; they are separate fingers and the game
                  treats them as separate.
                </P>

                <H>Staying alive</H>
                <P>
                  The three bars top-left are health, mana and stamina. Health regenerates slowly, but only when no
                  enemy is near, so breaking away from a fight is how you heal for free. Mana pays for spells and
                  casting weapons. Stamina pays for dodges and heavy attacks. <K>{key('potion')}</K> drinks the potion
                  bound to your quick slot — bind one from the pack and you will not have to open a menu mid-fight.
                </P>
                <P>
                  <K>{key('dash')}</K> is a dodge roll, and you are briefly invulnerable in the middle of it. Rolling
                  through an attack is almost always better than trying to out-heal it.
                </P>

                <H>The menus</H>
                <Keys rows={[
                  [key('inventory'), 'Pack — your items, your equipment, your totals'],
                  [key('character'), 'Character sheet and standing with each faction'],
                  [key('skills'), 'Skills, abilities, and changing class'],
                  [key('quests'), 'Journal — what you have taken on'],
                  [key('map'), 'World map — travel between attuned waystones'],
                  [key('minimap'), 'Show or hide the minimap'],
                  [key('pause'), 'Pause, settings, and this page'],
                ]} />
              </>
            ) : null}

            {tab === 'combat' ? (
              <>
                <H>You never have to aim</H>
                <P>
                  Attacks, spells and abilities all lock onto the nearest enemy by themselves. A yellow reticle shows
                  what you are locked onto. Arrows and bolts curve slightly to follow a target that steps aside, and
                  ground-targeted spells land on the thickest cluster of enemies near you. Point yourself in roughly
                  the right direction and the game does the rest.
                </P>

                <H>Attacking</H>
                <Keys rows={[
                  [key('attack'), 'Attack with your main hand. Hold it down to keep swinging'],
                  [key('heavy'), 'Heavy attack — slower, much harder, and it costs stamina'],
                  [key('offhand'), 'Off-hand: hold to block with a shield; tap for a tome bolt, an orb\u2019s frost ring, a thrown brand or a lantern flare. Empty hand drinks a potion'],
                  [key('artifact'), "Your artifact's power, if you have one equipped"],
                  ['1 2 3 4 5', 'Your five class abilities, unlocked as you level — the last at 22'],
                  ['V', "A weapon's own signature move, if the one you are holding has one"],
                ]} />

                <H>Melee and ranged are a real choice</H>
                <P>
                  A melee weapon hits harder than a ranged one of the same level and rarity — about 40% harder — and
                  sweeps an arc, so a greatsword or a halberd can catch a whole rank at once. What you pay for that is
                  standing where things can reach you. A bow or a staff does less per hit but reaches right across the
                  screen. Neither is the right answer; they are different jobs.
                </P>
                <P>
                  Within melee, a sweeping weapon trades a little single-target damage for the arc it cuts, and a
                  thrusting one like a dagger or a rapier gets that damage back for only ever hitting one thing.
                </P>

                <H>A few weapons fight back</H>
                <P>
                  One or two relics carry a move of their own, on <K>V</K>, separate from your class abilities. It
                  belongs to the object rather than to you, so picking one up changes how you fight and putting it down
                  takes that away again. The <b>Leviathan Axe</b> is thrown and comes back through everything twice,
                  freezing the corridor it cuts. The <b>Blades of Chaos</b> whip out in a burning circle and haul
                  whatever they catch to your feet.
                </P>

                <H>Kill streaks</H>
                <P>
                  Kills inside four seconds of each other chain. Each tier of the streak pays more experience, up to
                  60% extra, and the timer draining on screen is your reason to push for one more kill rather than
                  backing off.
                </P>

                <H>Bosses that stay bosses</H>
                <P>
                  A few fights cannot be deleted by a good build. They cap how much any single blow can take off, so
                  the fight always runs long enough for them to use everything they have — when you see <b>Warded</b>
                  float off one, that is the cap, not a miss. Your swing rate, your crits and your abilities all still
                  matter; only the size of one hit is held down.
                </P>
                <P>
                  The same fights bite through armour. Their biggest attacks take a share of your <i>maximum</i> health
                  no matter what you are wearing, and a dodge roll is the only thing that avoids them. And they do not
                  wait you out: stay too long and they start hitting harder every second, without limit. Attrition is
                  not a plan.
                </P>
                <P>
                  Most of them also have phases you <b>cannot hurt them in at all</b>. The health bar goes cold and
                  says why — usually because it has called something, and the ward holds until what it called is
                  dead. Standing there hitting it does nothing. Turn around and deal with the adds.
                </P>

                <H>Dying</H>
                <P>
                  You keep your gear. Fast travel will not work for three seconds after you take damage, so a waystone
                  is a way to cross the valley, not a way out of a fight you are losing.
                </P>
              </>
            ) : null}

            {tab === 'gear' ? (
              <>
                <H>Rarity, at a glance</H>
                <P>You never need to read a tooltip to know if something is good. The name colour tells you:</P>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, margin: '2px 0 7px' }}>
                  {RARITY_ORDER.map((r) => (
                    <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <i style={{ width: 5, height: 5, background: rarityColor(r) }} />
                      <span style={{ color: rarityColor(r) }}>{RARITY_LABEL[r]}</span>
                    </span>
                  ))}
                </div>
                <P>
                  Anything above Rare bursts where it lands and stands under a beam of its own colour, so you can spot
                  a good drop from across a room — and the name that floats up when you collect it is in that same
                  colour, so you never have to open the pack to know what you just picked up. Rarer gear also carries
                  more enchantment slots: none, one, one, two, three.
                </P>
                <P>
                  <b style={{ color: 'var(--r-mythic)' }}>Mythic</b> is not a tier loot can roll into, and not something the
                  crown&apos;s warrant can raise a thing to. A handful of weapons in the whole world wear it. You will
                  know. Above Mythic, Olympian relics come from the monsters and ruins of Achaea and hold four enchantments. Primordial is the strongest equipment tier, earned and forged only on Asterion, beyond the Three Hundred and the storm. It brings six enchantment slots, exceptional stats and signature arts that work on demand; skilled counters and interrupts empower them further. Neither tier appears in random loot. On Asterion, healing potions, elixirs and food share an 18-second recovery timer.
                </P>
                <P>
                  The top tiers are <b>gated behind your level</b>. A legendary is effectively unavailable below level
                  12 and does not reach its full drop weight until the mid forties, with Epic and Super Rare fading in
                  the same way earlier. A legendary in your first hours would end the loot game before it started —
                  nothing found for twenty levels could beat it. Magic Find still multiplies whatever the gate leaves,
                  so a lucky character gets there sooner; it just cannot get there at level 3.
                </P>
                <P>
                  A named relic&apos;s enchantments were chosen rather than rolled, so <b>the forge will not rebind
                  them</b>. It says so instead of taking the rune.
                </P>

                <H>Who drops what</H>
                <P>
                  Ordinary enemies drop a fraction of what elites and bosses do — roughly half the materials and well
                  under half the gear. Forty kills on the road should not fill your pack; the things with names should.
                  Magic Find is added on top of that rather than scaled by it, so investing in it still changes what a
                  field kill pays.
                </P>

                <H>Four slots, and that is all</H>
                <P>
                  One weapon, one off-hand, one suit of armour, one artifact. There are no helmet, glove and boot slots
                  to manage — a suit of armour is a whole outfit, and it shows on your character. Every class can wear
                  and wield everything, and nothing has a level requirement. If you found it, you can use it.
                </P>

                <H>Enchantments</H>
                <P>
                  Enchantments only come from a pool that suits the item — a blade will never roll Multishot — and
                  never two from the same school, so Fire Aspect and Freezing can never sit on the same weapon. The
                  anvil in Ashvale will rebind an item&apos;s enchantments for a rune, or reforge it a level higher.
                </P>

                <H>Selling and dropping</H>
                <P>
                  Anything in your pack can be sold on the spot for half what a merchant would pay — handy on the road,
                  but the good pieces are still worth carrying to a shop. Dropping throws an item clear and leaves it
                  on the ground until you walk away from it.
                </P>
                <P>
                  Two buttons clear the pack in one press. <b>Sell junk</b> takes only common and rare gear and never
                  touches anything SuperRare or better, your potions, your materials or quest items. <b>Sell all</b>
                  takes everything in the pack — equipped gear is not in the pack, so it is safe — and asks you to
                  click twice before it does.
                </P>
                <P>
                  The one thing that survives both is anything you have marked. Select an item and press
                  <b> ☆ Mark</b> and it gets a star, its own <b>★ Important</b> tab, and immunity from every bulk sell.
                  Nothing marks itself: it means you decided, not that the game guessed.
                </P>

                <H>Chests</H>
                <P>
                  Opening a chest lists what is inside rather than throwing it on the floor. Take things one at a time
                  or take the lot; anything you leave behind lands at the chest&apos;s feet, so a full pack costs you
                  nothing but a second trip.
                </P>
                <P>
                  Ordinary chests refill after a while and the enemies in a cleared dungeon come back, so somewhere
                  worth farming stays worth farming. Bosses do not come back on their own: kill one and it is done.
                </P>
                <P>
                  If you want one back, ask King Jovan. He keeps a ledger of everything you have put down and will
                  send people to reopen it for a fee — either the whole dungeon, boss and corridors and chests, or
                  just the boss on its own, which is cheaper and leaves the rest of the place as you left it. What you
                  already carried out stays carried out.
                </P>
              </>
            ) : null}

            {tab === 'world' ? (
              <>
                <H>Go where you like</H>
                <P>
                  There is one tutorial quest, and after that nothing is waiting for you to do it. Everything else is a
                  bounty: it offers itself the moment you find the place it concerns, and pays out the instant you
                  finish. No one will ask you to fetch nine boar hides.
                </P>

                <H>Difficulty is distance</H>
                <P>
                  The valley gets harder the further you go from Ashvale. The Sunken Mire east and Thornhollow west are
                  the next step; Duneholt south and the Crag Reach north are for much later. Nothing stops you walking
                  into any of it — the world gates itself by what lives there, not by walls.
                </P>
                <P>
                  North of the Crag Reach the map keeps going. Past the Frostmarch the ground turns to glacier and the
                  Jotunreach begins: one inhabited hold, four ways underground, and a level band that starts where
                  everything else in the world ends. Ask the clanmother in Northwatch what the door at the top of the
                  world is for. She will tell you, eventually.
                </P>
                <P>
                  Nothing born on the glacier cares about cold. Frost weapons are most of what drops up there and they
                  are the wrong answer against the giants — bring fire north.
                </P>
                <P>
                  Merchants follow the same rule. A cart parked at the mouth of a deadly dungeon sells far better gear
                  than the stall in your home square, and more of it. If you want something better to buy, walk
                  somewhere worse.
                </P>
                <P>
                  Every shop draws a new window every few days, and the header tells you how long you have to wait.
                  Part of the stock is fixed to what that merchant&apos;s own ground produces and part of it is rolled
                  fresh, so the same counter is worth checking again and a visit can be lucky or unlucky.
                </P>
                <P>
                  <b>Prices climb steeply with the tier of the goods.</b> A merchant&apos;s markup grows along with
                  what is on the counter — an iron sword in Ashvale is eighty gold and a breastplate in the Emberdeep
                  is the better part of eighty thousand. Coin from kills grows with it, so the ratio stays sane, but
                  late gear is meant to be something you save for rather than something you pick up in passing.
                </P>

                <H>The eastern sea</H>
                <P>
                  The harbours of Achaea sell ships. Speak to a shipwright to buy, repair or fit one. Your ship waits
                  beside the wooden pier. Choose <b>Board ship</b>, or walk to the pier&apos;s end and press <K>E</K> to
                  step aboard and start sailing. Steer with <K>WASD</K>, fire with <K>Space</K>, ram with <K>G</K> and brace with <K>B</K>.
                  Hold <K>Shift</K> for a rowing burst, or <K>R</K> to fight boarders on deck.
                  The further you sail from the mainland, the worse the monsters get.
                </P>
                <P>
                  <b>Islands can only be entered through a port.</b> Follow the harbour direction in the sailing display,
                  circle the island to its wooden pier and approach until <b>Land at the harbour</b> appears. Press <K>E</K>
                  to leave the ship and step onto the island. You cannot get off on a beach or against a cliff.
                  Your first landing also lets you attune that island&apos;s waystones.
                </P>
                <P>
                  Greek bounties appear in your journal as you find their places, just like the valley&apos;s.
                  Bring trophies back to a local anvil to see what the smith can make from them.
                  Select the <b>Stormbreaker</b> at a shipwright to see where each missing component comes from,
                  which labours you have completed, and what it costs to forge the storm ribs.
                </P>

                <H>Doors worth opening</H>
                <P>
                  In every settlement, buildings you can use have their own rooflines, a trade sign and a lit name plate
                  over the door. Everything else is the same shuttered house with boarded windows — check one, and you
                  never need to check another.
                </P>

                <H>Waystones</H>
                <P>
                  Every settlement and every dungeon mouth has a ring of standing stones with a carving cut into the
                  middle one. <b>Finding the place opens its gate</b> — you do not have to walk to the stones as well.
                  From then on any gate carries you to any other, from the travel panel or by clicking a marker on the
                  world map.
                </P>
              </>
            ) : null}

            {tab === 'progress' ? (
              <>
                <H>Levels and skill points</H>
                <P>
                  Experience comes from fighting, finding places, and finishing bounties. The cap is <b>level 100</b>,
                  and getting there is meant to take a long time: a level costs roughly sixteen kills in the opening
                  hour and settles at about eighty-five from the early twenties onward. Elites pay three times what
                  ordinary enemies do and bosses seven and a half, so clearing a dungeon is worth a real slice of a
                  level and grinding field trash is the slowest way to do anything.
                </P>
                <P>
                  Up to level 75, every level pays a skill point, every third level pays two, and every tenth pays five. That is 120
                  points by level 75, against trees that hold 162 — so <b>no build ever finishes one</b>. Each class has
                  three talent branches seven tiers deep plus a shared Mastery branch, and five abilities that unlock
                  as you go, the last at level 22.
                </P>
                <P>
                  The world is laid out as a ladder: Ashvale to level 6, Thornhollow to 14, the Mire to 24, the Crag
                  Reach to 36, Duneholt to 42, then the outer marches, the Jotunreach and the Cinderwastes, and finally
                  the three deep marches — the Drowning Reach, the Stormreach and the Emberdeep, which runs to 75.
                </P>
                <P>
                  A region&apos;s level band says when you are meant to be there. How dangerous it feels is a separate
                  dial, and it is a seasoning rather than a second curve — about sixty percent across the whole world.
                  <b>Thornhollow is gentle on purpose</b>, because it is where you learn to dodge, but its bosses take
                  their own and much larger multiplier and are among the hardest fights in the game. Rank-and-file
                  enemies are meant to be texture: two or three hits for a weak one, a few seconds for an ordinary one.
                  Bosses are where the difficulty lives.
                </P>

                <P>
                  Beyond the eastern hills lies Achaea. Anyone can walk there, but its beasts are stronger than anything
                  in the valley. At levels 80, 85, 90, 95 and 100, the skills panel offers a choice of heroic talents.
                </P>

                <H>Changing your mind</H>
                <P>
                  For 1,000 gold you can become any other class, from the skills panel. Your stats and abilities
                  change, you are handed that class&apos;s starting kit, and <b>every skill point you have ever spent
                  is refunded</b>. There is no cooldown and nothing is lost but the gold.
                </P>
                <P>
                  What you were <i>born</i> as is a bigger question and costs accordingly. Orsolya kneels at a pool in
                  the west wood, out past Thornhollow near the hermit&apos;s place, and for 10,000 gold will change
                  your race and your face. You keep your level, your talents, your gear and everything anyone owes
                  you. Nel in Mirefall will tell you how to find her.
                </P>

                <H>King Jovan</H>
                <P>
                  The king keeps court in the Ashvale moot hall and is worth the walk twice over. He runs the best
                  stocked shop in the valley and sells at a loss. He also keeps a tally of everything you have put
                  down: one <b>crown warrant</b> for every boss you fell. Spend a warrant and he has anything you carry
                  remade one rarity grade finer, with an extra enchantment slot and fresh rolls. It is the only way to
                  push gear you chose up to Legendary instead of waiting for the drop you wanted.
                </P>

                <H>Somewhere to put things</H>
                <P>
                  Your house has a storage chest, and every settlement lodge has the same one. Sleeping in a bed
                  restores you fully and moves the clock to morning.
                </P>
              </>
            ) : null}
          </div>
        </div>
    </Modal>
  );
}

const H = ({ children }: { children: React.ReactNode }) => <div className="help-h">{children}</div>;
const P = ({ children }: { children: React.ReactNode }) => <p className="help-p">{children}</p>;
const K = ({ children }: { children: React.ReactNode }) => <kbd className="help-key">{children}</kbd>;

function Keys({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="help-keys">
      {rows.map(([k, what]) => (
        <div key={k + what}>
          <kbd className="help-key">{k}</kbd>
          <span>{what}</span>
        </div>
      ))}
    </div>
  );
}
