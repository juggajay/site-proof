/**
 * Storage Persistence API wrappers.
 *
 * On iOS/Safari, IndexedDB (and therefore the offline queue) can be evicted
 * by the OS under storage pressure. Requesting persistent storage opts the
 * origin into a "never evict" bucket, preventing silent offline data loss —
 * the #1 abandonment driver in field-app research.
 *
 * All functions are no-throw and return false/null when the Storage API is
 * unsupported (e.g. in tests, or in browsers that pre-date the spec), so
 * callers never need a try/catch.
 */

type StorageEstimate = {
  quota: number | undefined;
  usage: number | undefined;
};

/**
 * Request that the browser preserve this origin's storage persistently.
 * Returns true if the permission was granted, false if denied or unsupported.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) {
      return false;
    }
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Check whether persistent storage is already granted for this origin.
 * Returns false when unsupported or if the query throws.
 */
export async function isStoragePersisted(): Promise<boolean> {
  try {
    if (!navigator.storage?.persisted) {
      return false;
    }
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

/**
 * Return the storage quota/usage estimate for this origin.
 * Returns null when unsupported or if the query throws.
 */
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  try {
    if (!navigator.storage?.estimate) {
      return null;
    }
    const estimate = await navigator.storage.estimate();
    return {
      quota: estimate.quota,
      usage: estimate.usage,
    };
  } catch {
    return null;
  }
}
