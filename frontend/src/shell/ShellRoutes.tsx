/**
 * ShellRoutes — the /m/* subtree for the foreman mobile shell v2.
 *
 * Registered as a lazy import in App.tsx:
 *   const ShellRoutes = lazy(() => import('@/shell/ShellRoutes').then(m => ({ default: m.ShellRoutes })));
 *
 * Route map:
 *   /m            → HomeScreen
 *   /m/diary      → DiaryShellRoutes (full guided path, PR-2)
 *   /m/lots       → LotsShellRoutes (list, mini-hub, ITP run, details — PR-3)
 *   /m/dockets    → ComingSoonScreen
 *   /m/issues     → ComingSoonScreen
 *   /m/docs       → ComingSoonScreen
 *   /m/photos     → ComingSoonScreen (new photos surface, PR-2)
 *
 * Back model: each screen's `parent` prop is the explicit return path; see
 * ShellScreen.tsx for implementation.
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { HomeScreen } from './screens/HomeScreen';
import { ComingSoonScreen } from './screens/ComingSoonScreen';
import { DiaryShellRoutes } from './screens/diary/DiaryShellRoutes';
import { LotsShellRoutes } from './screens/lots/LotsShellRoutes';
import { DocketsShellRoutes } from './screens/dockets/DocketsShellRoutes';

export function ShellRoutes() {
  return (
    <Routes>
      {/* Home hub */}
      <Route index element={<HomeScreen />} />

      {/* Diary — full guided path (PR-2) */}
      <Route path="diary/*" element={<DiaryShellRoutes />} />

      {/* Lots — full sub-tree (PR-3): list, mini-hub, ITP run, details */}
      <Route path="lots/*" element={<LotsShellRoutes />} />

      {/* Dockets — full sub-tree (PR-4): list, detail, approve/adjust/query/reject */}
      <Route path="dockets/*" element={<DocketsShellRoutes />} />

      {/* Issues */}
      <Route
        path="issues"
        element={
          <ComingSoonScreen title="Issues" parent="/m" sub="NCRs &amp; defects — coming next" />
        }
      />

      {/* Drawings & Docs */}
      <Route
        path="docs"
        element={
          <ComingSoonScreen
            title="Drawings &amp; Docs"
            parent="/m"
            sub="Current revisions by lot — coming next"
          />
        }
      />

      {/* Photos surface (new in shell, research doc §photo pipeline) */}
      <Route
        path="photos"
        element={
          <ComingSoonScreen title="Photos" parent="/m" sub="Recent &amp; unfiled — coming next" />
        }
      />

      {/* Catch-all → home */}
      <Route path="*" element={<Navigate to="/m" replace />} />
    </Routes>
  );
}
