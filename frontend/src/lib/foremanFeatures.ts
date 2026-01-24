// foremanFeatures.ts - Feature visibility for foreman mobile view
// Research-backed: Foreman should only see the 5 primary actions + essential secondary items
// Reference: docs/Foreman persona document (AU civil).md

/**
 * Features available to foreman on mobile
 *
 * Primary actions (5-tab nav):
 * - Capture: Photo/NCR/Note capture
 * - Today: Unified worklist (ITPs, Hold Points, Inspections)
 * - Approve: Dockets/Timesheets approval
 * - Diary: Daily diary with "Finish Diary" flow
 * - Lots: Progress by lot with evidence attachment
 */
export const FOREMAN_MOBILE_FEATURES = {
  // Primary (always visible in nav)
  capture: true,
  today: true,
  approve: true,
  diary: true,
  lots: true,

  // Secondary (in More menu if implemented)
  search: true,          // Global search across photos/issues/lots
  documents: true,       // View only - no heavy exports
  settings: true,        // Notifications, profile, etc.
  help: true,

  // Hidden from foreman mobile (desktop/other roles only)
  testResults: false,           // View only if linked from ITP
  itpTemplates: false,          // Only see "my items" not template library
  ncrPage: false,               // NCR is a capture type, not a standalone page
  reports: false,               // Heavy exports not for mobile
  analytics: false,             // Deep analytics not for field use
  projectSettings: false,       // Admin only
  subcontractorManagement: false, // PM/Admin only
  budgets: false,               // Commercial roles only
  claims: false,                // Commercial roles only
  costs: false,                 // Commercial roles only
  drawings: false,              // Better on tablet/desktop
  specLibrary: false,           // Link from checklist item instead
} as const

export type ForemanFeature = keyof typeof FOREMAN_MOBILE_FEATURES

/**
 * Check if a feature is enabled for foreman mobile
 */
export function isForemanFeatureEnabled(feature: ForemanFeature): boolean {
  return FOREMAN_MOBILE_FEATURES[feature] ?? false
}

/**
 * Get list of enabled primary features (for nav)
 */
export function getForemanPrimaryFeatures(): ForemanFeature[] {
  return ['capture', 'today', 'approve', 'diary', 'lots']
}

/**
 * Get list of enabled secondary features (for More menu)
 */
export function getForemanSecondaryFeatures(): ForemanFeature[] {
  return Object.entries(FOREMAN_MOBILE_FEATURES)
    .filter(([key, enabled]) => {
      // Exclude primary features
      const primaryFeatures = getForemanPrimaryFeatures()
      if (primaryFeatures.includes(key as ForemanFeature)) return false
      return enabled
    })
    .map(([key]) => key as ForemanFeature)
}

/**
 * Navigation items hidden from foreman mobile view
 * Use this to filter out items in sidebar/nav components
 */
export const FOREMAN_HIDDEN_NAV_ITEMS = [
  'ncr',                    // NCR is a capture type now
  'itp',                    // Only show "Today" items, not full ITP page
  'hold-points',            // Only show in Today worklist
  'tests',                  // Only view if linked from ITP
  'reports',                // Desktop only
  'analytics',              // Desktop only
  'subcontractors',         // Admin only
  'settings',               // Project settings - admin only
  'users',                  // Project users - admin only
  'areas',                  // Project areas - admin only
  'claims',                 // Commercial only
  'costs',                  // Commercial only
  'budgets',                // Commercial only
]

/**
 * Check if a nav item should be hidden for foreman mobile
 */
export function shouldHideForForemanMobile(navItemId: string): boolean {
  return FOREMAN_HIDDEN_NAV_ITEMS.includes(navItemId)
}

/**
 * Filter navigation items for foreman mobile view
 */
export function filterNavForForemanMobile<T extends { id: string }>(items: T[]): T[] {
  return items.filter(item => !shouldHideForForemanMobile(item.id))
}
