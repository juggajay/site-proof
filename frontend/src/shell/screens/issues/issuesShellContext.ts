/**
 * issuesShellContext.ts — Shared context for the /m/issues sub-tree.
 *
 * Separated from IssuesShellRoutes.tsx so the hook export does not trigger the
 * react-refresh/only-export-components lint rule (same split as
 * docketsShellContext, lotsShellContext, and diaryShellContext).
 */
import { createContext, useContext } from 'react';
import type { IssuesShellData } from './useIssuesShellData';

export const IssuesShellContext = createContext<IssuesShellData | null>(null);

export function useIssuesShellContext(): IssuesShellData {
  const ctx = useContext(IssuesShellContext);
  if (!ctx) {
    throw new Error('useIssuesShellContext must be used inside IssuesShellRoutes');
  }
  return ctx;
}
