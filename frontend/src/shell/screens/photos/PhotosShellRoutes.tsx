/**
 * PhotosShellRoutes — the /m/photos/* sub-tree (the new Photos surface).
 *
 * Nested under ShellRoutes' /m/photos route. Provides a shared photos context
 * (one documents-photo fetch + one offline-pending read) so the grid and detail
 * screens read the same merged set without each mounting their own query —
 * mirroring the IssuesShellRoutes / DocketsShellRoutes / LotsShellRoutes pattern.
 *
 * Route map:
 *   /m/photos               → PhotosListScreen   (recent-first grid; All/Unfiled)
 *   /m/photos/:documentId   → PhotoDetailScreen  (full photo; file-to-lot when unfiled)
 *
 * Why this surface exists: photos captured without a lot link land as documents
 * with lotId=null, visible only on the desktop Documents page. There was no
 * unfiled-photos view and no UI to re-file to a lot, although the backend fully
 * supports it. This surface closes that gap with existing endpoints only.
 */
import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { PhotosListScreen } from './PhotosListScreen';
import { PhotoDetailScreen } from './PhotoDetailScreen';
import { usePhotosShellData } from './usePhotosShellData';
import { PhotosShellContext } from './photosShellContext';

function PhotosShellProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useEffectiveProjectId();
  const data = usePhotosShellData(projectId);
  const value = useMemo(() => data, [data]);
  return <PhotosShellContext.Provider value={value}>{children}</PhotosShellContext.Provider>;
}

export function PhotosShellRoutes() {
  return (
    <PhotosShellProvider>
      <Routes>
        <Route index element={<PhotosListScreen />} />
        <Route path=":documentId" element={<PhotoDetailScreen />} />
        <Route path="*" element={<Navigate to="/m/photos" replace />} />
      </Routes>
    </PhotosShellProvider>
  );
}
