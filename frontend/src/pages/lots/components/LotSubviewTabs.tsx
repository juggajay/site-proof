/**
 * The subview switcher inside a merged workspace tab (Evidence: Photos /
 * Documents; Activity: Comments / Changes).
 *
 * Same Radix primitive as the top-level strip, so the switcher is a real
 * tablist with arrow-key support rather than a row of buttons. Only the
 * selected subview's body is rendered — the two halves are separately
 * paginated and are never merged into one list.
 */

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LotTab, TabConfig } from '../types';

export interface LotSubviewTabsProps {
  /** Accessible name for the switcher, e.g. "Evidence views". */
  label: string;
  views: TabConfig[];
  currentView: LotTab;
  onViewChange: (view: LotTab) => void;
  children: ReactNode;
}

export function LotSubviewTabs({
  label,
  views,
  currentView,
  onViewChange,
  children,
}: LotSubviewTabsProps) {
  return (
    <Tabs
      value={currentView}
      onValueChange={(value) => onViewChange(value as LotTab)}
      className="animate-in fade-in duration-200"
    >
      <TabsList aria-label={label} className="h-auto w-full justify-start sm:w-auto">
        {views.map((view) => (
          <TabsTrigger
            key={view.id}
            value={view.id}
            className="min-h-[48px] flex-1 text-sm sm:flex-none"
          >
            {view.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={currentView} className="mt-4 space-y-4">
        {children}
      </TabsContent>
    </Tabs>
  );
}
