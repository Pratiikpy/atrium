import runbooksData from '@/lib/generated/runbooks.json';

/**
 * Typed accessor over the build-time generated runbooks JSON
 * (scripts/build-runbooks.mjs). One place to type the generated shape so
 * the index page and the [slug] page agree.
 */
export interface Runbook {
  slug: string;
  title: string;
  summary: string;
  category: string;
  markdown: string;
}

interface RunbooksFile {
  runbooks: Runbook[];
  count: number;
  source: 'runbooks' | 'pending';
  generatedAt: string;
}

const data = runbooksData as RunbooksFile;

export function getRunbooks(): Runbook[] {
  return data.runbooks;
}

export function getRunbook(slug: string): Runbook | undefined {
  return data.runbooks.find((r) => r.slug === slug);
}

/** Runbooks grouped by category, preserving a sensible ordering. */
export function getRunbooksByCategory(): { category: string; items: Runbook[] }[] {
  const ORDER = [
    'Incident response',
    'Deploy & launch',
    'Keys & security',
    'Monitoring & on-call',
    'Setup & accounts',
  ];
  const groups = new Map<string, Runbook[]>();
  for (const r of data.runbooks) {
    const list = groups.get(r.category) ?? [];
    list.push(r);
    groups.set(r.category, list);
  }
  return [...groups.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => {
      const ia = ORDER.indexOf(a.category);
      const ib = ORDER.indexOf(b.category);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
}
