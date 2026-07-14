/**
 * LotsShellRoutes — the /m/lots/* sub-tree.
 *
 * Nested under ShellRoutes' /m/lots route. Provides a shared lots-data context
 * (one register + worklist fetch) so the list, hub, and details screens read the
 * same lot data without each mounting their own register query — mirroring the
 * DiaryShellRoutes pattern.
 *
 * Route map:
 *   /m/lots                    → LotsListScreen
 *   /m/lots/map                → LotMapScreen (satellite lot map)
 *   /m/lots/:lotId             → LotHubScreen
 *   /m/lots/:lotId/itp         → ItpRunScreen
 *   /m/lots/:lotId/details     → LotDetailsScreen
 */
import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { LotsListScreen } from './LotsListScreen';
import { LotMapScreen } from './LotMapScreen';
import { LotHubScreen } from './LotHubScreen';
import { ItpRunScreen } from './ItpRunScreen';
import { LotDetailsScreen } from './LotDetailsScreen';
import { useLotsShellData } from './useLotsShellData';
import { LotsShellContext } from './lotsShellContext';

function LotsShellProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useEffectiveProjectId();
  const data = useLotsShellData(projectId);
  const value = useMemo(() => data, [data]);
  return <LotsShellContext.Provider value={value}>{children}</LotsShellContext.Provider>;
}

export function LotsShellRoutes() {
  return (
    <LotsShellProvider>
      <Routes>
        <Route index element={<LotsListScreen />} />
        {/* Static `map` before the dynamic `:lotId` so it never parses as a lot id. */}
        <Route path="map" element={<LotMapScreen />} />
        <Route path=":lotId" element={<LotHubScreen />} />
        <Route path=":lotId/itp" element={<ItpRunScreen />} />
        <Route path=":lotId/details" element={<LotDetailsScreen />} />
        <Route path="*" element={<Navigate to="/m/lots" replace />} />
      </Routes>
    </LotsShellProvider>
  );
}
