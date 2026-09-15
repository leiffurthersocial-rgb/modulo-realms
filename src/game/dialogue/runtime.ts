import { QUEST_BY_ID, type QuestDef } from '../../data/quests';
import type { NpcDef } from '../../data/npcs';
import { RACE_BY_ID } from '../../data/races';
import type { Player } from '../player/player';
import type { QuestLog } from '../quests/questlog';
import type { DialogueChoice, DialogueCond, DialogueNode } from './types';

export interface DialogueView {
  npc: NpcDef;
  title: string;
  lines: string[];
  lineIndex: number;
  choices: DialogueChoice[];
  nodeId: string;
}

export function condMet(cond: DialogueCond | undefined, player: Player, quests: QuestLog): boolean {
  if (!cond) return true;
  if (cond.classes && !cond.classes.includes(player.cls)) return false;
  if (cond.races && !cond.races.includes(player.race)) return false;
  if (cond.repMin && player.rep(cond.repMin.faction) < cond.repMin.value) return false;
  if (cond.repMax && player.rep(cond.repMax.faction) > cond.repMax.value) return false;
  if (cond.flag && !player.flags.has(cond.flag)) return false;
  if (cond.notFlag && player.flags.has(cond.notFlag)) return false;
  if (cond.minLevel && player.level < cond.minLevel) return false;
  if (cond.minGold && player.gold < cond.minGold) return false;
  if (cond.hasItem) {
    let n = 0;
    for (const it of player.inventory) if (it.defId === cond.hasItem.item) n += it.qty;
    if (n < (cond.hasItem.qty ?? 1)) return false;
  }
  if (cond.questActive && !quests.isActive(cond.questActive)) return false;
  if (cond.questDone && !quests.isCompleted(cond.questDone)) return false;
  if (cond.questNotDone && quests.isCompleted(cond.questNotDone)) return false;
  return true;
}

/** Greeting lines for the first match in the NPC's greeting table. */
export function greetingFor(npc: NpcDef, player: Player, quests: QuestLog): string[] {
  for (const g of npc.greeting) {
    if (condMet(g.cond, player, quests)) return g.lines;
  }
  return ['...'];
}

/** Attitude drives the tone tag shown next to the NPC's name. */
export function attitude(npc: NpcDef, player: Player): { label: string; color: string } {
  let score = player.rep(npc.faction);
  const race = RACE_BY_ID[player.race];
  score += (race.rep[npc.faction] ?? 0) * 0.35;
  if (npc.dislikes?.includes(player.race)) score -= 30;
  if (score >= 45) return { label: 'Warm', color: '#6fbf5a' };
  if (score >= 15) return { label: 'Friendly', color: '#8fbf4a' };
  if (score > -15) return { label: 'Neutral', color: '#b9b3a8' };
  if (score > -45) return { label: 'Guarded', color: '#e8763a' };
  return { label: 'Cold', color: '#b5462f' };
}

export interface RootOptions {
  /** Quests this NPC can offer right now. */
  offers: QuestDef[];
  /** Quests ready to hand in to this NPC. */
  turnIns: QuestDef[];
  /** Quests in progress that this NPC gave. */
  inProgress: QuestDef[];
}

export function rootOptions(npc: NpcDef, player: Player, quests: QuestLog): RootOptions {
  const offers: QuestDef[] = [];
  const turnIns: QuestDef[] = [];
  const inProgress: QuestDef[] = [];
  for (const qid of npc.quests ?? []) {
    const def = QUEST_BY_ID[qid];
    if (!def) continue;
    if (quests.canAccept(def, player)) offers.push(def);
  }
  for (const aq of quests.active) {
    const def = QUEST_BY_ID[aq.id];
    if (!def) continue;
    const handIn = def.turnIn ?? def.giver;
    if (handIn !== npc.id) continue;
    if (quests.isComplete(def.id, player)) turnIns.push(def);
    else inProgress.push(def);
  }
  return { offers, turnIns, inProgress };
}

export function findNode(npc: NpcDef, id: string): DialogueNode | undefined {
  return npc.nodes?.find((n) => n.id === id);
}
