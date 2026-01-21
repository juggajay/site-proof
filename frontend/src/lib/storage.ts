/**
 * Centralized localStorage helper with namespacing
 * All SiteProof localStorage keys are prefixed to avoid conflicts
 */

const PREFIX = 'siteproof_'

/**
 * Storage helper for SiteProof app data
 */
export const storage = {
  /**
   * Get a value from localStorage
   * @param key - The key (without prefix)
   * @returns Parsed value or null if not found
   */
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(PREFIX + key)
      if (item === null) return null
      return JSON.parse(item) as T
    } catch {
      return null
    }
  },

  /**
   * Set a value in localStorage
   * @param key - The key (without prefix)
   * @param value - The value to store (will be JSON stringified)
   */
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  },

  /**
   * Remove a value from localStorage
   * @param key - The key (without prefix)
   */
  remove(key: string): void {
    localStorage.removeItem(PREFIX + key)
  },

  /**
   * Check if a key exists in localStorage
   * @param key - The key (without prefix)
   */
  has(key: string): boolean {
    return localStorage.getItem(PREFIX + key) !== null
  },

  /**
   * Clear all SiteProof storage (preserves other apps' data)
   */
  clear(): void {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  },

  /**
   * Get all SiteProof keys (without prefix)
   */
  keys(): string[] {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) {
        keys.push(key.substring(PREFIX.length))
      }
    }
    return keys
  },
}

/**
 * Specific storage keys used by the app
 * Use these constants to avoid typos
 */
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  RECENT_PROJECTS: 'recent_projects',
  GRID_PREFERENCES: 'grid_preferences',
  NOTIFICATION_SETTINGS: 'notification_settings',
  TOUR_COMPLETED: 'tour_completed',
  LAST_PROJECT_ID: 'last_project_id',
} as const

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]
