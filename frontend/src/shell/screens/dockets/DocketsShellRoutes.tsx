/**
 * DocketsShellRoutes — the /m/dockets/* sub-tree.
 *
 * Nested under ShellRoutes' /m/dockets route. Provides a shared dockets-data
 * context (one approvals fetch, status='all') so the list, detail, and reason
 * screens read the same docket set without each mounting their own query —
 * mirroring the LotsShellRoutes / DiaryShellRoutes pattern.
 *
 * Route map:
 *   /m/dockets                    → DocketsListScreen
 *   /m/dockets/:docketId          → DocketDetailScreen
 *   /m/dockets/:docketId/adjust   → AdjustHoursScreen   (approve w/ adjustment)
 *   /m/dockets/:docketId/query    → QueryFormScreen
 *   /m/dockets/:docketId/reject   → RejectFormScreen
 */
import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { DocketsListScreen } from './DocketsListScreen';
import { DocketDetailScreen } from './DocketDetailScreen';
import { AdjustHoursScreen } from './AdjustHoursScreen';
import { QueryFormScreen } from './QueryFormScreen';
import { RejectFormScreen } from './RejectFormScreen';
import { useDocketsShellData } from './useDocketsShellData';
import { DocketsShellContext } from './docketsShellContext';

function DocketsShellProvider({ children }: { children: React.ReactNode }) {
  const { projectId, isResolving, hasNoProject } = useEffectiveProjectId();
  const data = useDocketsShellData(projectId, { isResolvingProject: isResolving, hasNoProject });
  const value = useMemo(() => data, [data]);
  return <DocketsShellContext.Provider value={value}>{children}</DocketsShellContext.Provider>;
}

export function DocketsShellRoutes() {
  return (
    <DocketsShellProvider>
      <Routes>
        <Route index element={<DocketsListScreen />} />
        <Route path=":docketId" element={<DocketDetailScreen />} />
        <Route path=":docketId/adjust" element={<AdjustHoursScreen />} />
        <Route path=":docketId/query" element={<QueryFormScreen />} />
        <Route path=":docketId/reject" element={<RejectFormScreen />} />
        <Route path="*" element={<Navigate to="/m/dockets" replace />} />
      </Routes>
    </DocketsShellProvider>
  );
}
