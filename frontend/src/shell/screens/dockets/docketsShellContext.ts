/**
 * docketsShellContext.ts — Shared context for the /m/dockets sub-tree.
 *
 * Separated from DocketsShellRoutes.tsx so the hook export does not trigger the
 * react-refresh/only-export-components lint rule (same split as lotsShellContext
 * and diaryShellContext).
 */
import { createContext, useContext } from 'react';
import type { DocketsShellData } from './useDocketsShellData';

export const DocketsShellContext = createContext<DocketsShellData | null>(null);

export function useDocketsShellContext(): DocketsShellData {
  const ctx = useContext(DocketsShellContext);
  if (!ctx) {
    throw new Error('useDocketsShellContext must be used inside DocketsShellRoutes');
  }
  return ctx;
}
