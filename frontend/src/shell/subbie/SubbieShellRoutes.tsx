/**
 * SubbieShellRoutes — the /p/* subtree for the subbie portal mobile shell.
 *
 * Mounted as a lazy import in App.tsx (mirroring the foreman /m/* mount), wrapped
 * in RoleProtectedRoute with SUBCONTRACTOR_ROLES. Provides a shared my-company
 * bootstrap context (subbieShellData) so every screen reads the same company /
 * portalAccess / selected-project without re-fetching — the foreman per-domain
 * context pattern (DocketsShellRoutes, LotsShellRoutes).
 *
 * Route map (this PR — only Home is real; the rest are rebuild stubs):
 *   /p                       → HomeScreen
 *   /p/docket                → "Today's docket" stub  → /subcontractor-portal/docket/new
 *   /p/docket/:docketId      → docket detail stub      → /subcontractor-portal/docket/:id
 *   /p/dockets               → My Dockets stub         → /subcontractor-portal/dockets
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
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { HomeScreen } from './screens/HomeScreen';
import { QualityScreen } from './screens/QualityScreen';
import { DocsScreen } from './screens/DocsScreen';
import { NcrsScreen } from './screens/NcrsScreen';
import { CompanyScreen } from './screens/CompanyScreen';
import { SubbieStubScreen } from './screens/SubbieStubScreen';
import { WorkScreen } from './screens/WorkScreen';
import { ItpsScreen } from './screens/ItpsScreen';
import { SubbieItpRunScreen } from './screens/SubbieItpRunScreen';
import { useSubbieShellData } from './subbieShellData';
import { SubbieShellContext } from './subbieShellContext';

function SubbieShellProvider({ children }: { children: React.ReactNode }) {
  const data = useSubbieShellData();
  const value = useMemo(() => data, [data]);
  return <SubbieShellContext.Provider value={value}>{children}</SubbieShellContext.Provider>;
}

// :docketId detail stub — links to the matching classic docket editor.
function DocketDetailStub() {
  const { docketId } = useParams();
  return (
    <SubbieStubScreen
      title="Docket"
      classicHref={`/subcontractor-portal/docket/${docketId ?? ''}`}
      classicLabel="Open classic docket"
    />
  );
}

export function SubbieShellRoutes() {
  return (
    <SubbieShellProvider>
      <Routes>
        {/* Home hub — the only real screen in this PR */}
        <Route index element={<HomeScreen />} />

        {/* Today's docket */}
        <Route
          path="docket"
          element={
            <SubbieStubScreen
              title="Today's Docket"
              classicHref="/subcontractor-portal/docket/new"
              classicLabel="Open classic docket"
            />
          }
        />
        <Route path="docket/:docketId" element={<DocketDetailStub />} />

        {/* My Dockets */}
        <Route
          path="dockets"
          element={
            <SubbieStubScreen
              title="My Dockets"
              classicHref="/subcontractor-portal/dockets"
              classicLabel="Open classic dockets"
            />
          }
        />

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
