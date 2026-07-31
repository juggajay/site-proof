/**
 * The lot workspace's five top-level tabs.
 *
 * Built on the shared Radix Tabs primitive, which owns the tablist role, the
 * trigger/panel aria pairing, roving tabIndex and arrow/Home/End keys — the
 * hand-rolled `role="tab"` buttons this replaced had none of that. The page
 * renders this inside the `<Tabs>` root that also wraps `LotDetailTabPanel`.
 *
 * At 390px all five share a 5-column grid so none can hide off-canvas; from
 * `sm` up it is the familiar left-aligned strip, still horizontally scrollable.
 * Triggers are 48px tall in both layouts, and the whole label is the target.
 */

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LotWorkspaceTab, WorkspaceTabConfig } from '../lotWorkspaceTabs';

export interface TabCounts {
  tests: number | null;
  ncrs: number | null;
}

export interface LotTabNavigationProps {
  tabs: WorkspaceTabConfig[];
  currentTab: LotWorkspaceTab;
  counts?: TabCounts;
  /** Narrow screens get the 5-column grid and the short labels. */
  isMobile?: boolean;
}

export function LotTabNavigation({
  tabs,
  currentTab,
  counts = { tests: null, ncrs: null },
  isMobile = false,
}: LotTabNavigationProps) {
  return (
    <div className="border-b overflow-x-auto">
      <TabsList
        aria-label="Lot detail tabs"
        className={`h-auto rounded-none bg-transparent p-0 text-muted-foreground ${
          isMobile ? 'grid w-full grid-cols-5' : 'flex justify-start gap-4'
        }`}
      >
        {tabs.map((tab) => {
          const count = tab.id === 'tests' ? counts.tests : tab.id === 'ncrs' ? counts.ncrs : null;

          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={`flex min-h-[48px] flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-2 py-2 font-medium shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none ${
                isMobile ? 'text-xs' : 'px-4 text-sm'
              }`}
            >
              {isMobile ? tab.shortLabel : tab.label}
              {count !== null && count > 0 && (
                <span
                  className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-xs font-semibold ${
                    currentTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  data-testid={`${tab.id}-count-badge`}
                >
                  {count}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}
