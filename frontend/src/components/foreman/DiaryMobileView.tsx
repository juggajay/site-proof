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
import type { DailyDiary } from '@/pages/diary/types';
import { formatDateKey } from '@/lib/localDate';

interface DiaryMobileViewProps {
  // Date & lot
  selectedDate: string;
  lots: Array<{ id: string; lotNumber: string }>;
  activeLotId: string | null;
  onLotChange: (lotId: string | null) => void;
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
}

export function DiaryMobileView(props: DiaryMobileViewProps) {
  const {
    selectedDate,
    lots,
    activeLotId,
    onLotChange,
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
          <DiaryLotSelector lots={lots} activeLotId={activeLotId} onLotChange={onLotChange} />
        </div>
        {canReviewSubmit && (
          <div className="px-4 pb-3">
            <Button type="button" variant="success" className="w-full" onClick={onReviewSubmit}>
              Review &amp; submit
            </Button>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div ref={containerRef as React.RefObject<HTMLDivElement>} className="flex-1 overflow-y-auto">
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          progress={progress}
        />

        <div className="p-4 space-y-3 pb-36">
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
        </div>
      </div>

      {/* Quick-add chip bar */}
      <DiaryQuickAddBar onChipTap={onQuickAdd} diaryExists={!!diary} isSubmitted={isSubmitted} />
    </div>
  );
}
