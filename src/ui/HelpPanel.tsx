import { useState } from 'react';
import type { Game } from '../game/core/game';
import { DEFAULT_BINDINGS } from '../game/core/input';
import { RARITY_LABEL, RARITY_ORDER } from '../game/items/types';
import { rarityColor } from './ItemCard';

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
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) game.closeAll(); }}>
      <div className="modal panel" style={{ width: 'min(820px, 95vw)', height: 'min(640px, 92vh)' }}>
        <div className="panel-title">
          <span>How to Play</span>
          <span className="sub">Everything the game will not stop to explain</span>
          <button className="close-x" onClick={() => game.closeAll()}>&times;</button>
        </div>

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
                  [key('offhand'), 'Off-hand: hold to block with a shield, tap to use a tome or brand. With nothing in that hand it drinks a potion'],
                  [key('artifact'), "Your artifact's power, if you have one equipped"],
                  ['1 2 3 4 5', 'Your five class abilities, unlocked as you level — the last at 22'],
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, margin: '4px 0 14px' }}>
                  {RARITY_ORDER.map((r) => (
                    <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
                      <i style={{ width: 10, height: 10, borderRadius: 2, background: rarityColor(r) }} />
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
                  <b style={{ color: '#ff4f6e' }}>Mythic</b> is not a tier loot can roll into, and not something the
                  crown&apos;s warrant can raise a thing to. Two weapons in the whole world wear it. You will know.
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
                  worth farming stays worth farming. Bosses and their hoards do not: kill it once and it is done.
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

                <H>Doors worth opening</H>
                <P>
                  In every settlement, buildings you can use have their own rooflines, a trade sign and a lit name plate
                  over the door. Everything else is the same shuttered house with boarded windows — check one, and you
                  never need to check another.
                </P>

                <H>Waystones</H>
                <P>
                  Every settlement and every dungeon mouth has a stone gate with a blue centre. Touch one to attune it,
                  and from then on any gate carries you to any other, from the travel panel or by clicking a marker on
                  the world map.
                </P>
              </>
            ) : null}

            {tab === 'progress' ? (
              <>
                <H>Levels and skill points</H>
                <P>
                  Experience comes from fighting, finding places, and finishing bounties. Every level gives stats and a
                  skill point. Each class has three talent branches and five abilities that unlock as you go — the last
                  one at level 22, and it is worth waiting for.
                </P>
                <P>
                  The game is built to be finished somewhere around level 34, at the Last Gate. There is content past
                  it to level 40 — the stair under the gate keeps going down, and what is at the bottom is not
                  level-appropriate for anybody. Each talent branch runs four tiers deep, which is more points than you
                  will have, so a build is a choice about what to leave out.
                </P>

                <H>Changing your mind</H>
                <P>
                  For 100 gold you can become any other class, from the skills panel. Your stats and abilities change,
                  you are handed that class&apos;s starting kit, and <b>every skill point you have ever spent is
                  refunded</b>. There is no penalty and no cooldown — trying a build should be cheap.
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
      </div>
    </div>
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
