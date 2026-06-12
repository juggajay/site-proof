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
 *   /p/work                  → My Work stub            → /subcontractor-portal/work
 *   /p/itps                  → Inspections stub        → /subcontractor-portal/itps
 *   /p/lots/:lotId/itp       → ITP run stub            → /subcontractor-portal/lots/:id/itp
 *   /p/quality               → Holds & Tests stub      → /subcontractor-portal/holdpoints
 *   /p/docs                  → Documents stub          → /subcontractor-portal/documents
 *   /p/company               → My Company stub         → /my-company
 *   *                        → /p
 *
 * Back model: each screen's `parent` prop is the explicit return path (see
 * ShellScreen). All stubs declare /p as parent.
 */
import { useMemo } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { HomeScreen } from './screens/HomeScreen';
import { SubbieStubScreen } from './screens/SubbieStubScreen';
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

// :lotId ITP run stub — links to the matching classic lot ITP page.
function LotItpStub() {
  const { lotId } = useParams();
  return (
    <SubbieStubScreen
      title="Inspection"
      classicHref={`/subcontractor-portal/lots/${lotId ?? ''}/itp`}
      classicLabel="Open classic ITP"
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
        <Route
          path="work"
          element={
            <SubbieStubScreen
              title="My Work"
              classicHref="/subcontractor-portal/work"
              classicLabel="Open classic work list"
            />
          }
        />

        {/* Inspections (ITPs) */}
        <Route
          path="itps"
          element={
            <SubbieStubScreen
              title="Inspections"
              classicHref="/subcontractor-portal/itps"
              classicLabel="Open classic inspections"
            />
          }
        />
        <Route path="lots/:lotId/itp" element={<LotItpStub />} />

        {/* Holds & Tests */}
        <Route
          path="quality"
          element={
            <SubbieStubScreen
              title="Holds &amp; Tests"
              classicHref="/subcontractor-portal/holdpoints"
              classicLabel="Open classic hold points"
            />
          }
        />

        {/* Documents */}
        <Route
          path="docs"
          element={
            <SubbieStubScreen
              title="Documents"
              classicHref="/subcontractor-portal/documents"
              classicLabel="Open classic documents"
            />
          }
        />

        {/* My Company */}
        <Route
          path="company"
          element={
            <SubbieStubScreen
              title="My Company"
              classicHref="/my-company"
              classicLabel="Open classic My Company"
            />
          }
        />

        {/* Catch-all → home */}
        <Route path="*" element={<Navigate to="/p" replace />} />
      </Routes>
    </SubbieShellProvider>
  );
}
