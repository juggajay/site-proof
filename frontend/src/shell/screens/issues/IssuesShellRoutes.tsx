/**
 * IssuesShellRoutes — the /m/issues/* sub-tree (NCRs & defects).
 *
 * Nested under ShellRoutes' /m/issues route. Provides a shared NCR-register
 * context (one /api/ncrs fetch) so the list and detail screens read the same set
 * without each mounting their own query — mirroring the
 * DocketsShellRoutes / LotsShellRoutes / DiaryShellRoutes pattern.
 *
 * Route map:
 *   /m/issues            → IssuesListScreen   (open-first NCR cards, raise-issue)
 *   /m/issues/:ncrId     → IssueDetailScreen  (read-focused; add-photo; respond*)
 *
 * (* respond is conditional — only when the foreman is the NCR's responsibleUserId.)
 */
import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { IssuesListScreen } from './IssuesListScreen';
import { IssueDetailScreen } from './IssueDetailScreen';
import { useIssuesShellData } from './useIssuesShellData';
import { IssuesShellContext } from './issuesShellContext';

function IssuesShellProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useEffectiveProjectId();
  const data = useIssuesShellData(projectId);
  const value = useMemo(() => data, [data]);
  return <IssuesShellContext.Provider value={value}>{children}</IssuesShellContext.Provider>;
}

export function IssuesShellRoutes() {
  return (
    <IssuesShellProvider>
      <Routes>
        <Route index element={<IssuesListScreen />} />
        <Route path=":ncrId" element={<IssueDetailScreen />} />
        <Route path="*" element={<Navigate to="/m/issues" replace />} />
      </Routes>
    </IssuesShellProvider>
  );
}
