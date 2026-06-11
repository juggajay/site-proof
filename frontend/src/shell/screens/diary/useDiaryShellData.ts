/**
 * useDiaryShellData — shared data layer for the diary path screens.
 *
 * IMPORTANT: This is NEW PRESENTATION over EXISTING LOGIC.
 * It reuses useDiaryData and useDiaryMobileHandlers from their canonical homes
 * (frontend/src/pages/diary/hooks/) without duplicating any logic.
 *
 * The hook is the single place all diary shell screens get their state from,
 * keeping the data layer shared across the path, weather, crew, work, and
 * review screens via React context.
 */

import { useMemo } from 'react';
import { formatDateKey } from '@/lib/localDate';
import { useDiaryData } from '@/pages/diary/hooks/useDiaryData';
import { useDiaryMobileHandlers } from '@/pages/diary/hooks/useDiaryMobileHandlers';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';

export function useDiaryShellData() {
  const { projectId: rawProjectId } = useEffectiveProjectId();
  // useDiaryData and useDiaryMobileHandlers expect string | undefined, not null
  const projectId = rawProjectId ?? undefined;
  const todayKey = useMemo(() => formatDateKey(), []);

  // Reuse the full diary data hook — isMobile=true so timeline + docket
  // summary side-effects run (matching how DailyDiaryPage uses it on mobile).
  const data = useDiaryData({ projectId, isMobile: true });

  // Reuse the mobile handlers — same mutation functions with offline fallback.
  const handlers = useDiaryMobileHandlers({
    projectId,
    selectedDate: data.selectedDate,
    diary: data.diary,
    timeline: data.timeline,
    ensureDiaryExists: data.ensureDiaryExists,
    fetchTimeline: data.fetchTimeline,
    fetchDiaryForDate: data.fetchDiaryForDate,
    fetchDocketSummary: data.fetchDocketSummary,
    setDiary: data.setDiary,
    setError: data.setError,
    setWeatherForm: data.setWeatherForm,
  });

  return {
    projectId: rawProjectId, // string | null — matches useEffectiveProjectId
    todayKey,
    // From useDiaryData
    diary: data.diary,
    loading: data.loading,
    saving: data.saving,
    error: data.error,
    weatherForm: data.weatherForm,
    fetchingWeather: data.fetchingWeather,
    weatherSource: data.weatherSource,
    timeline: data.timeline,
    lots: data.lots,
    docketSummary: data.docketSummary,
    // From useDiaryMobileHandlers
    handlers,
  };
}

export type DiaryShellData = ReturnType<typeof useDiaryShellData>;
