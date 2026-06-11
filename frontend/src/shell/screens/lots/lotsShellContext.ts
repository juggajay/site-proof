/**
 * lotsShellContext.ts — Shared context for the /m/lots sub-tree.
 *
 * Separated from LotsShellRoutes.tsx so the hook export does not trigger the
 * react-refresh/only-export-components lint rule (same split as diaryShellContext).
 */
import { createContext, useContext } from 'react';
import type { LotsShellData } from './useLotsShellData';

export const LotsShellContext = createContext<LotsShellData | null>(null);

export function useLotsShellContext(): LotsShellData {
  const ctx = useContext(LotsShellContext);
  if (!ctx) {
    throw new Error('useLotsShellContext must be used inside LotsShellRoutes');
  }
  return ctx;
}
