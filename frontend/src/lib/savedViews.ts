import {
  parseJsonPreference,
  readLocalStorageItem,
  writeLocalStorageItem,
} from './storagePreferences';

// Named, per-register register-filter presets stored as raw querystrings in
// localStorage (per-browser, per-device). We only ever persist the filter
// querystring — never record data — so a saved view carries nothing sensitive.
// The register's URL-searchParams idiom is the source of truth; a view is just a
// remembered querystring to navigate back to.

export interface SavedView {
  id: string;
  name: string;
  /** Filter querystring without a leading '?', e.g. `status=open&search=weld`. */
  query: string;
}

const STORAGE_PREFIX = 'siteproof_saved_views.';

function storageKey(registerKey: string): string {
  return `${STORAGE_PREFIX}${registerKey}`;
}

function isSavedView(value: unknown): value is SavedView {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SavedView).id === 'string' &&
    typeof (value as SavedView).name === 'string' &&
    typeof (value as SavedView).query === 'string'
  );
}

function parseSavedViews(value: unknown): SavedView[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(isSavedView);
}

/** Strip a leading '?' so callers can pass either `?a=b` or `a=b`. */
function normalizeQuery(query: string): string {
  return query.startsWith('?') ? query.slice(1) : query;
}

export function listViews(registerKey: string): SavedView[] {
  return parseJsonPreference(readLocalStorageItem(storageKey(registerKey)), [], parseSavedViews);
}

/**
 * Persist the current querystring under `name` for `registerKey` and return the
 * updated list. A blank name or empty query is a no-op (returns the current
 * list) — there is nothing meaningful to save.
 */
export function saveView(registerKey: string, name: string, query: string): SavedView[] {
  const trimmedName = name.trim();
  const normalizedQuery = normalizeQuery(query.trim());
  if (!trimmedName || !normalizedQuery) return listViews(registerKey);

  const next = [
    ...listViews(registerKey),
    { id: crypto.randomUUID(), name: trimmedName, query: normalizedQuery },
  ];
  writeLocalStorageItem(storageKey(registerKey), JSON.stringify(next));
  return next;
}

export function deleteView(registerKey: string, id: string): SavedView[] {
  const next = listViews(registerKey).filter((view) => view.id !== id);
  writeLocalStorageItem(storageKey(registerKey), JSON.stringify(next));
  return next;
}
