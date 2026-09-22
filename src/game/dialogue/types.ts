import type { ClassId } from '../../data/classes';
import type { FactionId, RaceId } from '../../data/races';

export type DialogueAction =
  | { type: 'end' }
  | { type: 'goto'; node: string }
  | { type: 'shop' }
  | { type: 'train' }
  | { type: 'inn' }
  | { type: 'heal' }
  | { type: 'storage' }
  | { type: 'royal' }
  | { type: 'quest_offer'; quest: string }
  | { type: 'quest_accept'; quest: string }
  | { type: 'quest_turnin'; quest: string }
  | { type: 'rep'; faction: FactionId; amount: number }
  | { type: 'flag'; flag: string; value?: boolean }
  | { type: 'give'; item: string; qty?: number }
  | { type: 'take'; item: string; qty?: number }
  | { type: 'gold'; amount: number }
  | { type: 'remake' }
  | { type: 'crown' }
  | { type: 'attack' };

export interface DialogueCond {
  classes?: ClassId[];
  races?: RaceId[];
  /** Minimum reputation with a faction. */
  repMin?: { faction: FactionId; value: number };
  repMax?: { faction: FactionId; value: number };
  flag?: string;
  notFlag?: string;
  minLevel?: number;
  hasItem?: { item: string; qty?: number };
  minGold?: number;
  questActive?: string;
  questDone?: string;
  questNotDone?: string;
}

export interface DialogueChoice {
  text: string;
  /** Rendered as a tag in front of the line, e.g. [Mage]. */
  tag?: string;
  /**
   * Draws the line in the house's gold instead of the default grey. Reserved
   * for the one option on an NPC that starts something, so a player scanning
   * a list of six pleasantries can see which one is the door.
   */
  accent?: 'gold';
  cond?: DialogueCond;
  actions?: DialogueAction[];
  /** Node to move to; omit to close the conversation. */
  to?: string;
}

export interface DialogueNode {
  id: string;
  /** Lines are shown one at a time; the player advances through them. */
  text: string[];
  /**
   * Frames the whole dialogue box in gold while this node is showing. The
   * node is not a topic among topics — it is the room telling you something —
   * and the border is what says so without a word of extra text.
   */
  frame?: 'gold';
  choices?: DialogueChoice[];
  /** Runs when the node is first shown. */
  onEnter?: DialogueAction[];
}
