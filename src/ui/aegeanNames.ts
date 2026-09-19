import { AEGEAN_ADVENTURES } from '../data/aegean/world';
import { AEGEAN_ACTIVITIES } from '../data/aegean/progression';
import { TEMPLATE_BY_ID } from '../data/items';

/** Names for the few trophies a local smith or shipwright asks to see. */
export function aegeanName(id: string): string {
  const names: Record<string, string> = {
    'aegean:component:ribs': 'Bronze Storm Ribs',
    'aegean:component:sail': 'Hesperid Star-Sail',
    'aegean:component:keel': 'Underworld Keel-Binding',
    aegean_veteran_writ: 'The Eastern Road',
  };
  return names[id]
    ?? TEMPLATE_BY_ID[id]?.name
    ?? AEGEAN_ADVENTURES.find((a) => a.id === id)?.name
    ?? AEGEAN_ACTIVITIES.find((a) => a.id === id)?.name
    ?? id.replace(/^aegean[:_]/, '').replaceAll('_', ' ');
}
