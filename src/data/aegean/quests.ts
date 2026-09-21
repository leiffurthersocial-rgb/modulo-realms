import type { QuestDef } from '../quests';
import { AEGEAN_ACTIVITIES } from './progression';
import { AEGEAN_ADVENTURES, AEGEAN_LOCATIONS } from './world';
import { AEGEAN_REWARDS } from './content';

/** Greek adventures use the same journal as the valley. They are learned in
 * the world, and their encounter pays the reward at the moment it is earned. */
export const AEGEAN_QUESTS: QuestDef[] = [
  ...AEGEAN_ACTIVITIES.map((a): QuestDef => ({
    id: a.id,
    name: a.name,
    giver: 'notice',
    level: a.level,
    summary: a.summary,
    detail: a.summary,
    objectives: a.steps.map(s => ({ type: 'interact', target: s.id, count: s.count, label: s.label })),
    rewards: a.reward,
    prereq: { flag: `aegean:known:${a.id}` },
    fieldAdventure: { kind: 'activity', id: a.id, requires: a.requires },
    marker: AEGEAN_LOCATIONS.filter(l => l.region === a.region).sort((l, r) =>
      Math.hypot(l.tx-a.tx,l.ty-a.ty)-Math.hypot(r.tx-a.tx,r.ty-a.ty))[0]?.id,
  })),
  ...AEGEAN_ADVENTURES.map((a): QuestDef => ({
    id: a.mapId,
    name: a.name,
    giver: 'notice',
    level: a.level,
    summary: a.goal,
    detail: a.tip,
    objectives: [{ type: 'interact', target: a.mapId, label: a.goal }],
    rewards: AEGEAN_REWARDS[a.mapId] ?? { xp: 0, gold: 0 },
    prereq: { flag: `aegean:known:${a.mapId}` },
    fieldAdventure: { kind: 'encounter', id: a.mapId, requires: [] },
    marker: a.id,
  })),
];
