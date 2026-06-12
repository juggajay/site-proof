/**
 * subbieShellContext.ts — shared context for the /p/* subbie shell sub-tree.
 *
 * Separated from SubbieShellRoutes.tsx so the hook export does not trip the
 * react-refresh/only-export-components lint rule (same split the foreman
 * per-domain shell uses: docketsShellContext, lotsShellContext, etc.).
 */
import { createContext, useContext } from 'react';
import type { SubbieShellData } from './subbieShellData';

export const SubbieShellContext = createContext<SubbieShellData | null>(null);

export function useSubbieShellContext(): SubbieShellData {
  const ctx = useContext(SubbieShellContext);
  if (!ctx) {
    throw new Error('useSubbieShellContext must be used inside SubbieShellRoutes');
  }
  return ctx;
}
