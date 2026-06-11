/**
 * docsShellContext.ts — Shared context for the /m/docs sub-tree.
 *
 * Separated from DocsShellRoutes.tsx so the hook export does not trigger the
 * react-refresh/only-export-components lint rule (same split as
 * photosShellContext, issuesShellContext, docketsShellContext, lotsShellContext).
 */
import { createContext, useContext } from 'react';
import type { DocsShellData } from './useDocsShellData';

export const DocsShellContext = createContext<DocsShellData | null>(null);

export function useDocsShellContext(): DocsShellData {
  const ctx = useContext(DocsShellContext);
  if (!ctx) {
    throw new Error('useDocsShellContext must be used inside DocsShellRoutes');
  }
  return ctx;
}
