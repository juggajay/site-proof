import { DiaryLotSelector } from './DiaryLotSelector'
import { DiaryWeatherBar } from './DiaryWeatherBar'
import { DiaryQuickAddBar, QuickAddType } from './DiaryQuickAddBar'
import { DiaryTimelineEntry } from './DiaryTimelineEntry'
import { DiaryDocketSummary } from './DiaryDocketSummary'
import { usePullToRefresh, PullToRefreshIndicator } from '@/hooks/usePullToRefresh'

interface DiaryMobileViewProps {
  // Date & lot
  selectedDate: string
  lots: Array<{ id: string; lotNumber: string }>
  activeLotId: string | null
  onLotChange: (lotId: string | null) => void
  // Weather
  weather: { conditions: string; temperatureMin: string; temperatureMax: string; rainfallMm: string } | null
  weatherSource: string | null
  fetchingWeather: boolean
  onEditWeather: () => void
  // Diary state
  diary: any | null
  loading: boolean
  // Docket summary
  docketSummary: any | null
  docketSummaryLoading: boolean
  manualEntries?: { personnel: Array<{ id: string; name: string; hours?: number }>; plant: Array<{ id: string; description: string; hoursOperated?: number }> }
  onTapPending?: (docketId: string) => void
  onAddManual?: () => void
  // Timeline
  timeline: any[]
  // Actions
  onQuickAdd: (type: QuickAddType) => void
  onRefresh: () => Promise<void>
  onEditEntry: (entry: any) => void
  onDeleteEntry: (entry: any) => void
}

export function DiaryMobileView(props: DiaryMobileViewProps) {
  const {
    selectedDate, lots, activeLotId, onLotChange,
    weather, weatherSource, fetchingWeather, onEditWeather,
    diary, loading,
    docketSummary, docketSummaryLoading,
    manualEntries, onTapPending, onAddManual,
    timeline,
    onQuickAdd, onRefresh, onEditEntry, onDeleteEntry,
  } = props

  const { containerRef, pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh,
  })

  const todayStr = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === todayStr
  const isSubmitted = diary?.status === 'submitted'

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header: date + lot selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background sticky top-0 z-20">
        <div>
          <h1 className="text-lg font-bold">{dateLabel}</h1>
          {!isToday && <p className="text-xs text-muted-foreground">Not today</p>}
          {isSubmitted && <p className="text-xs text-green-600 font-medium">Submitted</p>}
        </div>
        <DiaryLotSelector lots={lots} activeLotId={activeLotId} onLotChange={onLotChange} />
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

          {/* Timeline entries - Task 5 will wire these */}
          {timeline.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">No entries yet</p>
              <p className="text-muted-foreground text-xs mt-1">Tap a chip below to add your first entry</p>
            </div>
          )}

          {timeline.map(entry => (
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
      <DiaryQuickAddBar
        onChipTap={onQuickAdd}
        diaryExists={!!diary}
        isSubmitted={isSubmitted}
      />
    </div>
  )
}
