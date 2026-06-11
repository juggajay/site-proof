/**
 * DocsShellRoutes — the /m/docs/* sub-tree (Drawings & Docs).
 *
 * Nested under ShellRoutes' /m/docs route. Provides a shared docs context (one
 * drawing-register fetch) so the list reads the register via the pure helpers in
 * docsShellState — mirroring the PhotosShellRoutes / IssuesShellRoutes pattern.
 *
 * Route map:
 *   /m/docs              → DocsListScreen (register list; ?lotId= scopes to a lot)
 *
 * VIEWER DECISION (PR-7 rule 1): opening a drawing FILE reuses the EXISTING
 * signed-URL idiom (openDocumentAccessUrl) the desktop Drawing Register already
 * uses — it opens the file full-screen in the phone's native PDF/image viewer
 * (zoom/pan for free). There is no DocumentViewerModal in the codebase to reuse,
 * so this is the strongest existing path. Because the file opens in a new tab,
 * there is NO /m/docs/:drawingId detail route — the list invokes the opener
 * directly (see DocsListScreen + useDocFileOpen). VIEW only (research 14): no
 * upload / new revision / supersede / delete affordances anywhere.
 *
 * Specs live in the same drawing register, so they appear here too; the separate
 * project Documents table is intentionally NOT merged in (scope: register only).
 */
import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { DocsListScreen } from './DocsListScreen';
import { useDocsShellData } from './useDocsShellData';
import { DocsShellContext } from './docsShellContext';

function DocsShellProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useEffectiveProjectId();
  const data = useDocsShellData(projectId);
  const value = useMemo(() => data, [data]);
  return <DocsShellContext.Provider value={value}>{children}</DocsShellContext.Provider>;
}

export function DocsShellRoutes() {
  return (
    <DocsShellProvider>
      <Routes>
        <Route index element={<DocsListScreen />} />
        <Route path="*" element={<Navigate to="/m/docs" replace />} />
      </Routes>
    </DocsShellProvider>
  );
}
