// The built-in starter set (made from CLAUDE-task1.md): written on first
// launch and refreshed when a new app version ships a new set. The learner's
// version always wins: an entry they edited is never overwritten, one they
// deleted stays hidden, and examples they imported onto a starter entry stay.
import * as store from './store.js';

export async function ensureStarterSet() {
  const { CORE_VERSION, CORE_ENTRIES } = await import('./core-pack.js');
  if (store.settings().coreVersion === CORE_VERSION) return;
  const existing = new Map((await store.getAllEntries({ includeHidden: true })).map((e) => [e.id, e]));
  const now = Date.now();
  const writes = [];
  for (const entry of CORE_ENTRIES) {
    const had = existing.get(entry.id);
    if (had && (had.edited || had.hidden)) continue;
    const imported = had ? had.examples.filter((x) => x.packId && x.packId !== 'core') : [];
    writes.push({
      ...entry,
      examples: [...entry.examples.map((x, i) => ({ ...x, id: `${entry.id}-x${i}`, packId: 'core' })), ...imported],
      source: 'Starter set (CLAUDE-task1.md)',
      packId: 'core',
      origin: 'core',
      createdAt: had?.createdAt || now,
      updatedAt: now,
    });
  }
  await store.saveEntries(writes);
  const current = new Set(CORE_ENTRIES.map((e) => e.id));
  for (const e of existing.values()) {
    if (e.origin === 'core' && !current.has(e.id) && !e.edited && !e.hidden) await store.deleteEntry(e);
  }
  await store.setSetting('coreVersion', CORE_VERSION);
}
