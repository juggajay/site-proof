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
 *   /p/lots/:lotId           → SubbieLotHubScreen      — per-lot hub (Inspection / NCRs / Documents)
 *   /p/lots/:lotId/itp       → SubbieItpRunScreen      (PR C — real)
 *   /p/ncrs                  → NCRs (real)             — ncrs module (default OFF); ?lotId= scope
 *
 * Holds & Tests is REMOVED from the subbie shell (no /p/quality): subbies never
 * act on hold points — the HC releases them. Classic portal holdpoints/tests
 * pages are untouched here (they retire in slice 1c).
 *   /p/docs                  → Documents (real)        — documents module
 *   /p/company               → My Company (real)       — crew/plant roster
 *   *                        → /p
 *
 * Back model: each screen's `parent` prop is the explicit return path (see
 * ShellScreen). Every surface is now a real screen — the SubbieStubScreen
 * placeholders from the staged build are gone.
 */
import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HomeScreen } from './screens/HomeScreen';
import { DocsScreen } from './screens/DocsScreen';
import { NcrsScreen } from './screens/NcrsScreen';
import { CompanyScreen } from './screens/CompanyScreen';
import { WorkScreen } from './screens/WorkScreen';
import { ItpsScreen } from './screens/ItpsScreen';
import { SubbieLotHubScreen } from './screens/SubbieLotHubScreen';
import { SubbieItpRunScreen } from './screens/SubbieItpRunScreen';
import { DocketScreen } from './screens/dockets/DocketScreen';
import { DocketsListScreen } from './screens/dockets/DocketsListScreen';
import { useSubbieShellData } from './subbieShellData';
import { SubbieShellContext } from './subbieShellContext';
import { ShellScreen } from '../components/ShellScreen';

function SubbieBootstrapError({ message }: { message: string }) {
  return (
    <ShellScreen variant="home" roleLabel="SUBCONTRACTOR" projectLabel="Portal access">
      <div className="rounded-2xl border border-destructive/35 bg-destructive/10 p-4" role="alert">
        <div className="text-[15px] font-semibold text-destructive">Cannot open portal</div>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{message}</p>
      </div>
    </ShellScreen>
  );
}

function SubbieShellProvider({ children }: { children: React.ReactNode }) {
  const data = useSubbieShellData();
  const value = useMemo(() => data, [data]);
  return (
    <SubbieShellContext.Provider value={value}>
      {data.loadError ? <SubbieBootstrapError message={data.loadError} /> : children}
    </SubbieShellContext.Provider>
  );
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
        {/* Per-lot hub — behind My Work; the ITP run lives one level deeper */}
        <Route path="lots/:lotId" element={<SubbieLotHubScreen />} />
        <Route path="lots/:lotId/itp" element={<SubbieItpRunScreen />} />

        {/* NCRs — module-conditional (ncrs defaults OFF); optional ?lotId= scope */}
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
