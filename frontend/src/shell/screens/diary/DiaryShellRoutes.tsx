/**
 * DiaryShellRoutes — the /m/diary/* sub-tree.
 *
 * Nested under ShellRoutes' /m/diary route. Provides a shared data context
 * so all diary screens share one useDiaryShellData call rather than each
 * mounting their own independent queries.
 *
 * Route map:
 *   /m/diary           → PathScreen  (4-node guided path)
 *   /m/diary/weather   → WeatherScreen
 *   /m/diary/crew      → CrewScreen
 *   /m/diary/work      → WorkScreen  (2×2 grid + entries)
 *   /m/diary/work/activity  → ActivityFormScreen
 *   /m/diary/work/delay     → DelayFormScreen
 *   /m/diary/work/delivery  → DeliveryFormScreen
 *   /m/diary/work/event     → EventFormScreen
 *   /m/diary/review    → ReviewScreen (slide-to-submit)
 *   /m/diary/done      → DoneScreen   (ceremony)
 */

import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PathScreen } from './PathScreen';
import { WeatherScreen } from './WeatherScreen';
import { CrewScreen } from './CrewScreen';
import { WorkScreen } from './WorkScreen';
import { ActivityFormScreen } from './ActivityFormScreen';
import { DelayFormScreen } from './DelayFormScreen';
import { DeliveryFormScreen } from './DeliveryFormScreen';
import { EventFormScreen } from './EventFormScreen';
import { ReviewScreen } from './ReviewScreen';
import { DoneScreen } from './DoneScreen';
import { useDiaryShellData } from './useDiaryShellData';
import { DiaryShellContext } from './diaryShellContext';

// ── Route provider ────────────────────────────────────────────────────────────

function DiaryShellProvider({ children }: { children: React.ReactNode }) {
  const data = useDiaryShellData();
  // Memoize so children don't re-render on every keystroke unless data changes.
  const value = useMemo(() => data, [data]);
  return <DiaryShellContext.Provider value={value}>{children}</DiaryShellContext.Provider>;
}

// ── DiaryShellRoutes ──────────────────────────────────────────────────────────

export function DiaryShellRoutes() {
  return (
    <DiaryShellProvider>
      <Routes>
        {/* Path */}
        <Route index element={<PathScreen />} />

        {/* Step screens */}
        <Route path="weather" element={<WeatherScreen />} />
        <Route path="crew" element={<CrewScreen />} />

        {/* Work + sub-forms */}
        <Route path="work" element={<WorkScreen />} />
        <Route path="work/activity" element={<ActivityFormScreen />} />
        <Route path="work/delay" element={<DelayFormScreen />} />
        <Route path="work/delivery" element={<DeliveryFormScreen />} />
        <Route path="work/event" element={<EventFormScreen />} />

        {/* Review & submit */}
        <Route path="review" element={<ReviewScreen />} />

        {/* Ceremony */}
        <Route path="done" element={<DoneScreen />} />

        {/* Catch-all → path */}
        <Route path="*" element={<Navigate to="/m/diary" replace />} />
      </Routes>
    </DiaryShellProvider>
  );
}
