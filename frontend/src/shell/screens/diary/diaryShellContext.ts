/**
 * diaryShellContext.ts — Shared context for the /m/diary sub-tree.
 *
 * Separated from DiaryShellRoutes.tsx so the hook export does not
 * trigger the react-refresh/only-export-components lint rule.
 */

import { createContext, useContext } from 'react';
import type { DiaryShellData } from './useDiaryShellData';

export const DiaryShellContext = createContext<DiaryShellData | null>(null);

export function useDiaryShellContext(): DiaryShellData {
  const ctx = useContext(DiaryShellContext);
  if (!ctx) {
    throw new Error('useDiaryShellContext must be used inside DiaryShellRoutes');
  }
  return ctx;
}
