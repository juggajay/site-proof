import { DiaryLotSelector } from './DiaryLotSelector';
import { DiaryWeatherBar } from './DiaryWeatherBar';
import { DiaryQuickAddBar, QuickAddType } from './DiaryQuickAddBar';
import { DiaryTimelineEntry } from './DiaryTimelineEntry';
import type { TimelineEntry } from './DiaryTimelineEntry';
import { DiaryDocketSummary } from './DiaryDocketSummary';
import type { DocketSummaryData, ManualEntries } from './DiaryDocketSummary';
import { usePullToRefresh, PullToRefreshIndicator } from '@/hooks/usePullToRefresh';
import { DiaryTimelineEntrySkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { DailyDiary } from '@/pages/diary/types';
import { formatDateKey } from '@/lib/localDate';
import { shouldShowCopyFromYesterday } from './diaryCopyAffordance';
import { DiaryPhotosSection } from '@/pages/diary/components/DiaryPhotosSection';

interface DiaryMobileViewProps {
  // Date & lot
  projectId?: string;
  selectedDate: string;
  lots: Array<{ id: string; lotNumber: string }>;
  activeLotId: string | null;
  onLotChange: (lotId: string | null) => void;
  /** GPS pre-selected the active lot — show a "change if wrong" hint. */
  lotAutoDetected?: boolean;
  // Weather
  weather: {
    conditions: string;
    temperatureMin: string;
    temperatureMax: string;
    rainfallMm: string;
  } | null;
  weatherSource: string | null;
  fetchingWeather: boolean;
  onEditWeather: () => void;
  // Diary state
  diary: Pick<DailyDiary, 'status'> | null;
  loading: boolean;
  // Docket summary
  docketSummary: DocketSummaryData | null;
  docketSummaryLoading: boolean;
  manualEntries?: ManualEntries;
  onTapPending?: (docketId: string) => void;
  onAddManual?: () => void;
  // Timeline
  timeline: TimelineEntry[];
  // Actions
  onQuickAdd: (type: QuickAddType) => void;
  onRefresh: () => Promise<void>;
  onEditEntry: (entry: TimelineEntry) => void;
  onDeleteEntry: (entry: TimelineEntry) => void;
  // Opens the end-of-day finish/submit flow. Shown as a persistent button while
  // the selected date's diary is still a draft so submit is one tap, not buried
  // in the timeline (including a forgotten past-day draft).
  onReviewSubmit?: () => void;
  // Copy from yesterday — personnel
  onCopyPersonnelFromYesterday?: () => Promise<void>;
  copyingPersonnel?: boolean;
  // Copy from yesterday — plant
  onCopyPlantFromYesterday?: () => Promise<void>;
  copyingPlant?: boolean;
}

export function DiaryMobileView(props: DiaryMobileViewProps) {
  const {
    projectId,
    selectedDate,
    lots,
    activeLotId,
    onLotChange,
    lotAutoDetected = false,
    weather,
    weatherSource,
    fetchingWeather,
    onEditWeather,
    diary,
    loading,
    docketSummary,
    docketSummaryLoading,
    manualEntries,
    onTapPending,
    onAddManual,
    timeline,
    onQuickAdd,
    onRefresh,
    onEditEntry,
    onDeleteEntry,
    onReviewSubmit,
    onCopyPersonnelFromYesterday,
    copyingPersonnel = false,
    onCopyPlantFromYesterday,
    copyingPlant = false,
  } = props;

  const { containerRef, pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh,
  });

  const todayStr = formatDateKey();
  const isToday = selectedDate === todayStr;
  const isSubmitted = diary?.status === 'submitted';
  // Offer one-tap submit for ANY draft, regardless of date. DiaryFinishFlow now
  // finalises the selected date's diary, so a forgotten past-day draft can be
  // submitted from a phone instead of being stuck until the foreman finds a desktop.
  const canReviewSubmit = Boolean(onReviewSubmit) && diary?.status === 'draft';

  // M33: show copy-from-yesterday when the diary exists and there is no MANUAL
  // crew/plant yet. Docket-sourced rows (which appear in the timeline but are
  // synced automatically) must not suppress the affordance, so the gate is based
  // on manualEntries — mirroring the H11 backend filter that only copies manual
  // rows forward.
  const showCopyAffordance = shouldShowCopyFromYesterday({
    isSubmitted,
    hasDiary: diary !== null,
    loading,
    manualPersonnelCount: manualEntries?.personnel.length ?? 0,
    manualPlantCount: manualEntries?.plant.length ?? 0,
    hasCopyHandler: Boolean(onCopyPersonnelFromYesterday) || Boolean(onCopyPlantFromYesterday),
  });

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header: date + lot selector, with a persistent submit action for a draft */}
      <div className="border-b bg-background sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">{dateLabel}</h1>
            {!isToday && <p className="text-xs text-muted-foreground">Not today</p>}
            {isSubmitted && <p className="text-xs text-muted-foreground font-medium">Submitted</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <DiaryLotSelector lots={lots} activeLotId={activeLotId} onLotChange={onLotChange} />
            {lotAutoDetected && activeLotId && (
              <p className="text-xs text-muted-foreground text-right">
                Auto-detected from your location — change if wrong
              </p>
            )}
          </div>
        </div>
        {canReviewSubmit && (
          <div className="px-4 pb-3">
            <Button type="button" variant="success" className="w-full" onClick={onReviewSubmit}>
              Review &amp; submit
            </Button>
          </div>
        )}
      </div>

      {/* Scrollable content — bottom padding clears the docked quick-add bar
          (--quick-add-bar-height) + bottom nav (--bottom-nav-height) with a
          comfortable thumb-zone buffer. Falls back to a generous fixed value
          so content is never hidden under the bars even before paint. */}
      <div ref={containerRef as React.RefObject<HTMLDivElement>} className="flex-1 overflow-y-auto">
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          progress={progress}
        />

        <div
          data-testid="diary-timeline-content"
          className="p-4 space-y-3"
          style={{
            paddingBottom:
              'calc(var(--quick-add-bar-height, 68px) + var(--bottom-nav-height, 72px) + 1rem)',
          }}
        >
          {/* Weather bar */}
          <DiaryWeatherBar
            weather={weather}
            weatherSource={weatherSource}
            loading={fetchingWeather}
            onTapEdit={onEditWeather}
          />

          {/* Docket summary card */}
          <DiaryDocketSummary
            summary={docketSummary}
            manualEntries={manualEntries || { personnel: [], plant: [] }}
            loading={docketSummaryLoading}
            onTapPending={onTapPending || (() => {})}
            onAddManual={onAddManual || (() => {})}
          />

          {/* Copy from yesterday — shown when diary started but no crew/plant yet */}
          {showCopyAffordance && (
            <div
              data-testid="copy-from-yesterday-affordance"
              className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 flex items-center justify-between gap-3"
            >
              <p className="text-sm text-muted-foreground">
                Carry yesterday&#39;s crew &amp; plant forward?
              </p>
              <div className="flex gap-2 shrink-0">
                {onCopyPersonnelFromYesterday && (
                  <button
                    onClick={() => void onCopyPersonnelFromYesterday()}
                    disabled={copyingPersonnel || copyingPlant}
                    data-testid="copy-personnel-btn"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground touch-manipulation min-h-[36px] disabled:opacity-50"
                  >
                    {copyingPersonnel ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Crew
                  </button>
                )}
                {onCopyPlantFromYesterday && (
                  <button
                    onClick={() => void onCopyPlantFromYesterday()}
                    disabled={copyingPersonnel || copyingPlant}
                    data-testid="copy-plant-btn"
                    className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground touch-manipulation min-h-[36px] disabled:opacity-50"
                  >
                    {copyingPlant ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Plant
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Timeline entries — initial-load skeleton (isLoading with no cached data).
              Three cards mirror a typical morning diary; layout-matched to DiaryTimelineEntry
              so content landing causes no layout shift. */}
          {loading && (
            <div data-testid="diary-timeline-skeleton">
              <DiaryTimelineEntrySkeleton />
              <DiaryTimelineEntrySkeleton />
              <DiaryTimelineEntrySkeleton />
            </div>
          )}

          {!loading && timeline.length === 0 && (
            <div className="text-center py-12">
              {!diary && isToday && (
                <>
                  <p className="text-muted-foreground text-sm font-medium">Start your day</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Tap a chip below to add your first entry
                  </p>
                </>
              )}
              {!diary && !isToday && (
                <>
                  <p className="text-muted-foreground text-sm font-medium">
                    No diary for this date
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Switch to today to start recording
                  </p>
                </>
              )}
              {diary && (
                <>
                  <p className="text-muted-foreground text-sm font-medium">No entries yet</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Tap a chip below to add your first entry
                  </p>
                </>
              )}
            </div>
          )}

          {timeline.map((entry) => (
            <DiaryTimelineEntry
              key={`${entry.type}-${entry.id}`}
              entry={entry}
              onEdit={onEditEntry}
              onDelete={onDeleteEntry}
              isSubmitted={isSubmitted}
            />
          ))}

          {/* Today's photos — the day's field captures, no extra effort. */}
          {!loading && projectId && (
            <section className="pt-2">
              <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Photos</h2>
              <DiaryPhotosSection projectId={projectId} selectedDate={selectedDate} />
            </section>
          )}
        </div>
      </div>

      {/* Quick-add chip bar */}
      <DiaryQuickAddBar onChipTap={onQuickAdd} diaryExists={!!diary} isSubmitted={isSubmitted} />
    </div>
  );
}
