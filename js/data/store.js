// App data API on top of IndexedDB: knowledge entries and the imports
// ("packs") they came from, spaced-repetition progress, tasks, writing
// attempts, settings, practice history, and backup export/import.
import * as db from './db.js';

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'system',
  voiceURI: '',
  speechRate: 0.9,
  autoSpeak: false, // read the sentence aloud after an answer is checked
  answerMode: 'type', // 'type' | 'choose' — how cloze drills are answered
  reviewLimit: 20,
  writeMinutes: 20,
  chartValues: false, // print values on charts (the exam never does)
  coreVersion: '', // version of the built-in starter set last applied
});

const APP_ID = 'task1-studio';
const BACKUP_VERSION = 1;

/* ---------- change events ---------- */

const listeners = new Set();

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(detail) {
  for (const fn of listeners) {
    try {
      fn(detail);
    } catch (err) {
      console.error(err);
    }
  }
}

/* ---------- knowledge entries ---------- */

// Entries are read by most screens, so they are cached and the cache is
// dropped on every write.
let entriesCache = null;

export async function getAllEntries({ includeHidden = false } = {}) {
  if (!entriesCache) entriesCache = await db.getAll('entries');
  return includeHidden ? entriesCache.slice() : entriesCache.filter((e) => !e.hidden);
}

export async function getEntry(id) {
  if (!id) return null;
  return (await db.get('entries', id)) || null;
}

export async function saveEntries(entries) {
  if (!entries.length) return;
  const now = Date.now();
  const values = entries.map((e) => ({ createdAt: now, ...e, updatedAt: e.updatedAt || now }));
  await db.putMany('entries', values);
  entriesCache = null;
  requestPersistence();
  emit({ store: 'entries' });
}

export async function saveEntry(entry) {
  await saveEntries([{ ...entry, updatedAt: Date.now() }]);
}

// Starter-set entries are hidden rather than deleted, so a later version of
// the starter set does not bring them back.
export async function deleteEntry(entry) {
  if (entry.origin === 'core') await db.put('entries', { ...entry, hidden: true, updatedAt: Date.now() });
  else await db.del('entries', entry.id);
  await db.del('progress', entry.id);
  entriesCache = null;
  emit({ store: 'entries', id: entry.id, deleted: true });
}

/* ---------- packs (one per import, so an import can be undone) ---------- */

export async function getPacks() {
  const packs = await db.getAll('packs');
  return packs.sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0));
}

// Writes an import in one transaction: the pack record plus every new or
// updated entry.
export async function commitImport(pack, entries) {
  await db.replaceAll({}, { packs: [pack], entries });
  entriesCache = null;
  requestPersistence();
  emit({ store: 'entries' });
  emit({ store: 'packs', id: pack.id });
}

// Undo an import: its new entries go, examples it added to other entries
// go, and the pack record goes.
export async function removePack(packId) {
  const pack = await db.get('packs', packId);
  if (!pack) return;
  const all = await db.getAll('entries');
  const byId = new Map(all.map((e) => [e.id, e]));
  const remove = new Set(pack.entryIds || []);
  const changed = new Map(); // one write per entry, even when the import added to it twice
  for (const { entryId, exampleIds, wrong = [] } of pack.added || []) {
    const e = changed.get(entryId) || byId.get(entryId);
    if (!e || remove.has(entryId)) continue;
    const drop = new Set(exampleIds);
    changed.set(entryId, { ...e, examples: e.examples.filter((x) => !drop.has(x.id)), wrong: (e.wrong || []).filter((w) => !wrong.includes(w)), updatedAt: Date.now() });
  }
  await db.putMany('entries', [...changed.values()]);
  for (const id of remove) {
    await db.del('entries', id);
    await db.del('progress', id);
  }
  await db.del('packs', packId);
  entriesCache = null;
  emit({ store: 'entries' });
  emit({ store: 'packs', id: packId, deleted: true });
}

/* ---------- progress ---------- */

export async function getProgress(itemIds) {
  const map = new Map();
  if (Array.isArray(itemIds)) {
    const values = await Promise.all(itemIds.map((id) => db.get('progress', id)));
    values.forEach((v) => v && map.set(v.itemId, v));
  } else {
    (await db.getAll('progress')).forEach((v) => map.set(v.itemId, v));
  }
  return map;
}

export async function saveProgress(progressArray) {
  if (!progressArray.length) return;
  await db.putMany('progress', progressArray);
  emit({ store: 'progress' });
}

/* ---------- tasks ---------- */

export async function getTasks() {
  const tasks = await db.getAll('tasks');
  return tasks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getTask(id) {
  if (!id) return null;
  return (await db.get('tasks', id)) || null;
}

export async function saveTask(task, { touch = true } = {}) {
  const now = Date.now();
  const value = { createdAt: now, ...task };
  if (touch || !value.updatedAt) value.updatedAt = now;
  await db.put('tasks', value);
  requestPersistence();
  emit({ store: 'tasks', id: value.id });
  return value;
}

export async function deleteTask(id) {
  await db.del('tasks', id);
  await db.delWhere('attempts', 'taskId', id);
  emit({ store: 'tasks', id, deleted: true });
}

/* ---------- writing attempts ---------- */

export async function getAttempts(taskId) {
  const rows = taskId ? await db.getAll('attempts', { index: 'taskId', query: taskId }) : await db.getAll('attempts');
  return rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function saveAttempt(attempt) {
  const value = { ...attempt, updatedAt: Date.now() };
  await db.put('attempts', value);
  emit({ store: 'attempts', id: value.id });
  return value;
}

export async function deleteAttempt(id) {
  await db.del('attempts', id);
  emit({ store: 'attempts', id, deleted: true });
}

/* ---------- settings ---------- */

let settingsCache = { ...DEFAULT_SETTINGS };

export async function loadSettings() {
  const rows = await db.getAll('settings');
  settingsCache = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (key in DEFAULT_SETTINGS) settingsCache[key] = value;
  }
  return { ...settingsCache };
}

// Synchronous read of the cached settings (valid after loadSettings()).
export function settings() {
  return settingsCache;
}

export async function setSetting(key, value) {
  settingsCache = { ...settingsCache, [key]: value };
  await db.put('settings', { key, value });
  emit({ store: 'settings', key, value });
}

/* ---------- history ---------- */

export async function addHistory(entry) {
  const value = { at: Date.now(), ...entry };
  delete value.id;
  await db.put('history', value);
  emit({ store: 'history' });
}

export async function getHistory({ limit = 400 } = {}) {
  const rows = await db.getAll('history');
  return rows.sort((a, b) => b.at - a.at).slice(0, limit);
}

/* ---------- backup ---------- */

export async function exportAll() {
  const [entries, packs, progress, tasks, attempts, settingsRows, history] = await Promise.all(
    ['entries', 'packs', 'progress', 'tasks', 'attempts', 'settings', 'history'].map((s) => db.getAll(s)),
  );
  return {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    entries,
    packs,
    progress,
    tasks,
    attempts,
    settings: Object.fromEntries(settingsRows.map((r) => [r.key, r.value])),
    history: history.map(({ id, ...rest }) => rest),
  };
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object' || data.app !== APP_ID) {
    throw new Error('This file is not a Task 1 Studio backup.');
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app.');
  }
  if (!Array.isArray(data.entries) || !Array.isArray(data.tasks)) throw new Error('The backup is incomplete.');
  return true;
}

const byKey = (rows, key) => rows.filter((r) => r && typeof r[key] === 'string');

// 'replace' wipes current data first (one transaction); 'merge' keeps the
// newer copy of each record and adds history entries that are not present.
export async function importAll(data, { mode = 'merge' } = {}) {
  validateBackup(data);
  const incoming = {
    entries: byKey(data.entries, 'id'),
    packs: byKey(data.packs || [], 'id'),
    progress: byKey(data.progress || [], 'itemId'),
    tasks: byKey(data.tasks, 'id'),
    attempts: byKey(data.attempts || [], 'id'),
    history: (data.history || []).filter((h) => h && typeof h.at === 'number').map(({ id, ...rest }) => rest),
  };
  if (mode === 'replace') {
    const settingsRows = Object.entries(data.settings || {})
      .filter(([key]) => key in DEFAULT_SETTINGS)
      .map(([key, value]) => ({ key, value }));
    await db.replaceAll(incoming, { settings: settingsRows });
    await loadSettings();
  } else {
    const newer = async (store, key, stamp) => {
      const existing = new Map((await db.getAll(store)).map((r) => [r[key], r]));
      return incoming[store].filter((r) => !existing.has(r[key]) || (r[stamp] || 0) > (existing.get(r[key])[stamp] || 0));
    };
    const seen = new Set((await db.getAll('history')).map((h) => `${h.at}|${h.kind}`));
    await db.replaceAll(
      {},
      {
        entries: await newer('entries', 'id', 'updatedAt'),
        packs: await newer('packs', 'id', 'importedAt'),
        progress: await newer('progress', 'itemId', 'last'),
        tasks: await newer('tasks', 'id', 'updatedAt'),
        attempts: await newer('attempts', 'id', 'updatedAt'),
        history: incoming.history.filter((h) => !seen.has(`${h.at}|${h.kind}`)),
      },
    );
  }
  entriesCache = null;
  emit({ store: 'all' });
  return { entries: incoming.entries.length, tasks: incoming.tasks.length };
}

/* ---------- storage durability ---------- */

let persistAsked = false;

export async function requestPersistence() {
  if (persistAsked) return;
  persistAsked = true;
  try {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}

export async function storageStatus() {
  const status = { persistent: false, usage: 0, quota: 0, durable: db.isPersistentStorage() };
  try {
    if (navigator.storage?.persisted) status.persistent = await navigator.storage.persisted();
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      status.usage = est.usage || 0;
      status.quota = est.quota || 0;
    }
  } catch {
    /* not supported */
  }
  return status;
}

export { open as openDatabase, isPersistentStorage } from './db.js';
