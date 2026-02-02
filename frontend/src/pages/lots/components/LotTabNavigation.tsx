/**
 * Tab navigation component for LotDetailPage.
 * Extracted from LotDetailPage.tsx to reduce file size.
 */

import type { LotTab, TabConfig } from '../types'

export interface TabCounts {
  tests: number | null
  ncrs: number | null
}

export interface LotTabNavigationProps {
  tabs: TabConfig[]
  currentTab: LotTab
  onTabChange: (tabId: LotTab) => void
  counts?: TabCounts
}

export function LotTabNavigation({
  tabs,
  currentTab,
  onTabChange,
  counts = { tests: null, ncrs: null },
}: LotTabNavigationProps) {
  return (
    <div className="border-b">
      <nav className="flex gap-4" aria-label="Lot detail tabs">
        {tabs.map((tab) => {
          // Get count for tabs that have badges
          const count = tab.id === 'tests' ? counts.tests : tab.id === 'ncrs' ? counts.ncrs : null

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                currentTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
              }`}
              aria-selected={currentTab === tab.id}
              role="tab"
            >
              {tab.label}
              {count !== null && count > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-semibold rounded-full ${
                    currentTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  data-testid={`${tab.id}-count-badge`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
