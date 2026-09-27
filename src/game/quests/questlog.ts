import { QUEST_BY_ID, type Objective, type QuestDef } from '../../data/quests';
import type { Player } from '../player/player';
import { REGION_BY_ID, type RegionId } from '../../data/locations';

export interface ActiveQuest {
  id: string;
  /** Counter per objective; collect objectives are recomputed from the inventory. */
  progress: number[];
  turnedIn: boolean;
}

export class QuestLog {
  active: ActiveQuest[] = [];
  completed: string[] = [];

  get(id: string): ActiveQuest | undefined {
    return this.active.find((q) => q.id === id);
  }

  isActive(id: string): boolean {
    return this.active.some((q) => q.id === id);
  }

  isCompleted(id: string): boolean {
    return this.completed.includes(id);
  }

  canAccept(def: QuestDef, player: Player): boolean {
    if (this.isActive(def.id) || this.isCompleted(def.id)) return false;
    if (def.fieldAdventure?.requires.some(id => !player.flags.has(id.includes(':') ? id : `aegean:complete:${id}`))) return false;
    const pre = def.prereq;
    if (!pre) return true;
    if (pre.quest && !this.isCompleted(pre.quest)) return false;
    if (pre.level && player.level < pre.level) return false;
    if (pre.classes && !pre.classes.includes(player.cls)) return false;
    if (pre.races && !pre.races.includes(player.race)) return false;
    if (pre.flag && !player.flags.has(pre.flag)) return false;
    return true;
  }

  accept(id: string): ActiveQuest | null {
    const def = QUEST_BY_ID[id];
    if (!def || this.isActive(id) || this.isCompleted(id)) return null;
    const q: ActiveQuest = { id, progress: def.objectives.map(() => 0), turnedIn: false };
    this.active.push(q);
    return q;
  }

  objectiveCount(def: QuestDef, q: ActiveQuest, index: number, player: Player): number {
    const obj = def.objectives[index];
    if (obj.type === 'collect') {
      let n = 0;
      for (const it of player.inventory) if (it.defId === obj.item) n += it.qty;
      return Math.min(n, obj.count);
    }
    return q.progress[index];
  }

  objectiveTarget(obj: Objective): number {
    return obj.type === 'kill' || obj.type === 'collect' || obj.type === 'hunt' ? obj.count : obj.type === 'interact' ? obj.count ?? 1 : 1;
  }

  /**
   * Credit what the player already did before this quest was theirs.
   *
   * Bosses and dungeon floors stay dead, and a place stays found. A main
   * story step that asks for one of those after a bounty already took it
   * would otherwise be impossible to finish. Kill counts cover the named
   * elites that are not bosses. `hunt` and repeatable kills are only
   * credited on the load-time catch-up — otherwise they are the part you are
   * meant to go and do.
   */
  precredit(id: string, player: Player, catchUp = false): boolean {
    const q = this.get(id);
    const def = QUEST_BY_ID[id];
    if (!q || !def) return false;
    let any = false;
    def.objectives.forEach((o, i) => {
      const done =
        (o.type === 'boss' && (player.bossesKilled.has(o.enemy) || (player.killCounts[o.enemy] ?? 0) > 0)) ||
        (o.type === 'clear' && player.clearedDungeons.has(o.map)) ||
        (o.type === 'explore' && player.discovered.has(o.location));
      if (done && q.progress[i] < 1) {
        q.progress[i] = 1;
        any = true;
      }
    });
    // A save walking forward through chapters it earned before the story
    // existed: if the thing the cull was clearing the way to is already dead,
    // the cull is not sent back to be done at level 80 against wolves.
    if (catchUp && def.objectives.every((o, i) => o.type === 'hunt' || this.isObjectiveDone(def, q, i, player))) {
      def.objectives.forEach((o, i) => {
        const outgrown = player.level > (REGION_BY_ID[o.type === 'hunt' ? o.region as RegionId : 'central']?.level[1] ?? Infinity);
        if (o.type === 'hunt' && outgrown && q.progress[i] < o.count) { q.progress[i] = o.count; any = true; }
      });
    }
    return any;
  }

  isObjectiveDone(def: QuestDef, q: ActiveQuest, i: number, player: Player): boolean {
    return this.objectiveCount(def, q, i, player) >= this.objectiveTarget(def.objectives[i]);
  }

  isComplete(id: string, player: Player): boolean {
    const q = this.get(id);
    const def = QUEST_BY_ID[id];
    if (!q || !def) return false;
    return def.objectives.every((_, i) => this.isObjectiveDone(def, q, i, player));
  }

  /** Returns quest ids that had progress, so the UI can flash them. */
  private bump(match: (o: Objective) => boolean, amount = 1): string[] {
    const touched: string[] = [];
    for (const q of this.active) {
      const def = QUEST_BY_ID[q.id];
      if (!def) continue;
      def.objectives.forEach((o, i) => {
        if (!match(o)) return;
        const target = this.objectiveTarget(o);
        if (q.progress[i] >= target) return;
        q.progress[i] = Math.min(target, q.progress[i] + amount);
        touched.push(q.id);
      });
    }
    return touched;
  }

  onKill(enemyId: string, region?: string): string[] {
    return this.bump((o) =>
      (o.type === 'kill' && o.enemy === enemyId) ||
      (o.type === 'boss' && o.enemy === enemyId) ||
      (o.type === 'hunt' && !!region && o.region === region));
  }

  onTalk(npcId: string): string[] {
    return this.bump((o) => o.type === 'talk' && o.npc === npcId);
  }

  onExplore(locationId: string): string[] {
    return this.bump((o) => o.type === 'explore' && o.location === locationId);
  }

  onClear(mapId: string): string[] {
    return this.bump((o) => o.type === 'clear' && o.map === mapId);
  }

  onInteract(target: string): string[] {
    return this.bump((o) => o.type === 'interact' && o.target === target);
  }

  complete(id: string): void {
    const i = this.active.findIndex((q) => q.id === id);
    if (i >= 0) this.active.splice(i, 1);
    if (!this.completed.includes(id)) this.completed.push(id);
  }

  /**
   * Whether the map may point at this quest's marker. A `guide: 'discovered'`
   * quest only gets its arrow once the player has found the place; before
   * that, its `hint` is all they get.
   */
  markerVisible(def: QuestDef, player: Player): boolean {
    if (!def.marker) return false;
    return def.guide !== 'discovered' || player.discovered.has(def.marker);
  }

  /** Quest ids currently trackable on the map, with their marker location. */
  markers(player: Player): Array<{ quest: QuestDef; location: string }> {
    const out: Array<{ quest: QuestDef; location: string }> = [];
    for (const q of this.active) {
      const def = QUEST_BY_ID[q.id];
      if (def?.marker && this.markerVisible(def, player)) out.push({ quest: def, location: def.marker });
    }
    return out;
  }

  serialize() {
    return { active: this.active, completed: this.completed };
  }

  static deserialize(data: { active: ActiveQuest[]; completed: string[] }): QuestLog {
    const log = new QuestLog();
    log.active = data.active ?? [];
    log.completed = data.completed ?? [];
    return log;
  }
}
