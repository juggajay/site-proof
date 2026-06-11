/**
 * photosShellContext.ts — Shared context for the /m/photos sub-tree.
 *
 * Separated from PhotosShellRoutes.tsx so the hook export does not trigger the
 * react-refresh/only-export-components lint rule (same split as
 * issuesShellContext, docketsShellContext, lotsShellContext).
 */
import { createContext, useContext } from 'react';
import type { PhotosShellData } from './usePhotosShellData';

export const PhotosShellContext = createContext<PhotosShellData | null>(null);

export function usePhotosShellContext(): PhotosShellData {
  const ctx = useContext(PhotosShellContext);
  if (!ctx) {
    throw new Error('usePhotosShellContext must be used inside PhotosShellRoutes');
  }
  return ctx;
}
