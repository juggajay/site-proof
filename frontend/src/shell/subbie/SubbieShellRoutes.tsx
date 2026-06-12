/**
 * SubbieShellRoutes — the /p/* subtree for the subbie portal mobile shell.
 *
 * Mounted as a lazy import in App.tsx (mirroring the foreman /m/* mount), wrapped
 * in RoleProtectedRoute with SUBCONTRACTOR_ROLES. Provides a shared my-company
 * bootstrap context (subbieShellData) so every screen reads the same company /
 * portalAccess / selected-project without re-fetching — the foreman per-domain
 * context pattern (DocketsShellRoutes, LotsShellRoutes).
 *
 * Route map:
 *   /p                       → HomeScreen              (PR A — real)
 *   /p/docket                → DocketScreen            (PR B — real, today)
 *   /p/docket/:docketId      → DocketScreen            (PR B — real, by id)
 *   /p/dockets               → DocketsListScreen       (PR B — real)
 *   /p/work                  → WorkScreen              (PR C — real)
 *   /p/itps                  → ItpsScreen              (PR C — real)
 *   /p/lots/:lotId/itp       → SubbieItpRunScreen      (PR C — real)
 *   /p/quality               → Holds & Tests (real)    — holdPoints + testResults
 *   /p/ncrs                  → NCRs (real)             — ncrs module (default OFF)
 *   /p/docs                  → Documents (real)        — documents module
 *   /p/company               → My Company (real)       — crew/plant roster
 *   *                        → /p
 *
 * Back model: each screen's `parent` prop is the explicit return path (see
 * ShellScreen). All stubs declare /p as parent.
 */
import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HomeScreen } from './screens/HomeScreen';
import { QualityScreen } from './screens/QualityScreen';
import { DocsScreen } from './screens/DocsScreen';
import { NcrsScreen } from './screens/NcrsScreen';
import { CompanyScreen } from './screens/CompanyScreen';
import { SubbieStubScreen } from './screens/SubbieStubScreen';
import { WorkScreen } from './screens/WorkScreen';
import { ItpsScreen } from './screens/ItpsScreen';
import { SubbieItpRunScreen } from './screens/SubbieItpRunScreen';
import { DocketScreen } from './screens/dockets/DocketScreen';
import { DocketsListScreen } from './screens/dockets/DocketsListScreen';
import { useSubbieShellData } from './subbieShellData';
import { SubbieShellContext } from './subbieShellContext';

function SubbieShellProvider({ children }: { children: React.ReactNode }) {
  const data = useSubbieShellData();
  const value = useMemo(() => data, [data]);
  return <SubbieShellContext.Provider value={value}>{children}</SubbieShellContext.Provider>;
}

export function SubbieShellRoutes() {
  return (
    <SubbieShellProvider>
      <Routes>
        {/* Home hub — the only real screen in this PR */}
        <Route index element={<HomeScreen />} />

        {/* Today's docket — one status-driven screen for both today + :id */}
        <Route path="docket" element={<DocketScreen />} />
        <Route path="docket/:docketId" element={<DocketScreen />} />

        {/* My Dockets — history / payment trail */}
        <Route path="dockets" element={<DocketsListScreen />} />

        {/* My Work (lots) */}
        <Route path="work" element={<WorkScreen />} />

        {/* Inspections (ITPs) */}
        <Route path="itps" element={<ItpsScreen />} />
        <Route path="lots/:lotId/itp" element={<SubbieItpRunScreen />} />

        {/* Holds & Tests — read-only QA visibility (holdPoints + testResults) */}
        <Route path="quality" element={<QualityScreen />} />

        {/* NCRs — module-conditional (ncrs defaults OFF) */}
        <Route path="ncrs" element={<NcrsScreen />} />

        {/* Documents — view-only (documents module) */}
        <Route path="docs" element={<DocsScreen />} />

        {/* My Company — crew/plant roster (admin write gate) */}
        <Route path="company" element={<CompanyScreen />} />

        {/* Catch-all → home */}
        <Route path="*" element={<Navigate to="/p" replace />} />
      </Routes>
    </SubbieShellProvider>
  );
}
