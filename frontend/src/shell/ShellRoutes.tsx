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
 *   /m/dockets    → DocketsShellRoutes (list, detail, approve/adjust/query/reject — PR-4)
 *   /m/issues     → IssuesShellRoutes (NCRs & defects: list + detail — PR-5)
 *   /m/docs       → ComingSoonScreen
 *   /m/photos     → PhotosShellRoutes (recent/unfiled grid + file-to-lot — PR-6)
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
import { IssuesShellRoutes } from './screens/issues/IssuesShellRoutes';
import { PhotosShellRoutes } from './screens/photos/PhotosShellRoutes';

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

      {/* Issues — full sub-tree (PR-5): list + detail (NCRs & defects) */}
      <Route path="issues/*" element={<IssuesShellRoutes />} />

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

      {/* Photos — full sub-tree (PR-6): recent/unfiled grid + file-to-lot.
          The new shell surface (research doc §photo pipeline) — closes the
          unfiled-photos gap with existing endpoints only. */}
      <Route path="photos/*" element={<PhotosShellRoutes />} />

      {/* Catch-all → home */}
      <Route path="*" element={<Navigate to="/m" replace />} />
    </Routes>
  );
}
