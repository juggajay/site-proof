import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { dateKeyToUtcDayNumber, formatDateKey } from '@/lib/localDate';
import { DiaryMobileView } from '@/components/foreman/DiaryMobileView';
import { DiaryFinishFlow } from '@/components/foreman/DiaryFinishFlow';
import type { TimelineEntry } from '@/components/foreman/DiaryTimelineEntry';
import type { DiaryTab } from './types';
import { useDiaryData } from './hooks/useDiaryData';
import { useDiaryMobileHandlers } from './hooks/useDiaryMobileHandlers';
import { DiaryDateSelector } from './components/DiaryDateSelector';
import { DiaryMobileSheets } from './components/DiaryMobileSheets';
import { DiarySubmitSection } from './components/DiarySubmitSection';
import { DiaryDesktopHeader } from './components/DiaryDesktopHeader';
import { DiaryTabNav } from './components/DiaryTabNav';
import { DiaryEmptyState } from './components/DiaryEmptyState';
import { DiaryNoDayCard } from './components/DiaryNoDayCard';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// Lazy-loaded tab components
const WeatherTab = lazy(() =>
  import('./components/WeatherTab').then((m) => ({ default: m.WeatherTab })),
);
const PersonnelTab = lazy(() =>
  import('./components/PersonnelTab').then((m) => ({ default: m.PersonnelTab })),
);
const PlantTab = lazy(() => import('./components/PlantTab').then((m) => ({ default: m.PlantTab })));
const ActivitiesTab = lazy(() =>
  import('./components/ActivitiesTab').then((m) => ({ default: m.ActivitiesTab })),
);
const DelaysTab = lazy(() =>
  import('./components/DelaysTab').then((m) => ({ default: m.DelaysTab })),
);

function getValidDiaryDateParam(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.trim();
  const candidateDay = dateKeyToUtcDayNumber(candidate);
  const todayDay = dateKeyToUtcDayNumber(formatDateKey());
  if (candidateDay === null || todayDay === null || candidateDay > todayDay) {
    return null;
  }
  return candidate;
}

export function DailyDiaryPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<DiaryTab>('weather');
  const [entryPendingDelete, setEntryPendingDelete] = useState<TimelineEntry | null>(null);
  const [showFinishFlow, setShowFinishFlow] = useState(false);
  const initialSelectedDate = getValidDiaryDateParam(searchParams.get('date')) || formatDateKey();

  // Data hook (state, fetching, effects)
  const data = useDiaryData({ projectId, isMobile, initialDate: initialSelectedDate });
  const { selectedDate, setSelectedDate } = data;

  useEffect(() => {
    const rawDate = searchParams.get('date');
    const urlDate = getValidDiaryDateParam(rawDate);
    if (rawDate && !urlDate) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('date');
      setSearchParams(nextParams, { replace: true });
      return;
    }
    if (urlDate && urlDate !== selectedDate) {
      setSelectedDate(urlDate);
    }
  }, [searchParams, setSearchParams, selectedDate, setSelectedDate]);

  const handleDateChange = useCallback(
    (date: string) => {
      const nextDate = getValidDiaryDateParam(date) || formatDateKey();
      setSelectedDate(nextDate);

      const nextParams = new URLSearchParams(searchParams);
      if (nextDate === formatDateKey()) {
        nextParams.delete('date');
      } else {
        nextParams.set('date', nextDate);
      }
      setSearchParams(nextParams, { replace: true });
    },
    [setSelectedDate, searchParams, setSearchParams],
  );

  // Mobile handlers hook
  const mobile = useDiaryMobileHandlers({
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
    onDiaryUpdate: data.setDiary,
  });

  // Derive weather display data for mobile view
  const mobileWeather = data.diary
    ? {
        conditions: data.diary.weatherConditions || '',
        temperatureMin: data.diary.temperatureMin?.toString() || '',
        temperatureMax: data.diary.temperatureMax?.toString() || '',
        rainfallMm: data.diary.rainfallMm?.toString() || '',
      }
    : data.weatherForm.weatherConditions
      ? {
          conditions: data.weatherForm.weatherConditions,
          temperatureMin: data.weatherForm.temperatureMin,
          temperatureMax: data.weatherForm.temperatureMax,
          rainfallMm: data.weatherForm.rainfallMm,
        }
      : null;

  const handleNewEntry = () => {
    data.setShowNewEntry(true);
    setActiveTab('weather');
  };

  // --- Mobile Layout ---
  if (isMobile) {
    return (
      <>
        {data.error ? (
          // Honest failure state: a failed diary fetch must not fall through to
          // the "Start your day" empty state — the foreman could write into (or
          // duplicate) a day they cannot see. Mirrors the desktop error banner.
          <div className="p-4">
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
              role="alert"
            >
              <p className="text-sm font-medium">{data.error}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full touch-target"
                onClick={() => void data.fetchDiaryForDate(data.selectedDate)}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <DiaryMobileView
            selectedDate={data.selectedDate}
            lots={data.lots}
            activeLotId={mobile.activeLotId}
            onLotChange={mobile.setActiveLotId}
            weather={mobileWeather}
            weatherSource={data.weatherSource}
            fetchingWeather={data.fetchingWeather}
            onEditWeather={() => mobile.setActiveSheet('weather')}
            diary={data.diary}
            loading={data.loading}
            docketSummary={data.docketSummary}
            docketSummaryLoading={data.docketSummaryLoading}
            manualEntries={mobile.manualEntries}
            onTapPending={mobile.handleTapPending}
            onAddManual={() => mobile.setActiveSheet('manual')}
            timeline={data.timeline}
            onQuickAdd={(type) => mobile.setActiveSheet(type === 'plant' ? 'manual' : type)}
            onRefresh={mobile.handleRefresh}
            onEditEntry={mobile.handleEditEntry}
            onDeleteEntry={(entry) => setEntryPendingDelete(entry)}
            onReviewSubmit={() => setShowFinishFlow(true)}
            onCopyPersonnelFromYesterday={
              mobile.canCopyFromYesterday ? mobile.copyPersonnelFromYesterday : undefined
            }
            copyingPersonnel={mobile.copyingPersonnel}
            onCopyPlantFromYesterday={
              mobile.canCopyFromYesterday ? mobile.copyPlantFromYesterday : undefined
            }
            copyingPlant={mobile.copyingPlant}
          />
        )}
        <DiaryFinishFlow
          isOpen={showFinishFlow}
          date={data.selectedDate}
          onClose={() => setShowFinishFlow(false)}
          onSubmit={() => {
            // Reflect the submitted status without a second submit path: the finish
            // flow owns the POST; we just refresh the page's diary + list afterwards.
            void data.fetchDiaryForDate(data.selectedDate);
            void data.fetchDiaries();
          }}
        />
        <DiaryMobileSheets
          activeSheet={mobile.activeSheet}
          projectId={projectId}
          selectedDate={data.selectedDate}
          onCloseSheet={() => {
            mobile.setActiveSheet(null);
            mobile.setEditingEntry(null);
          }}
          editingEntry={mobile.editingEntry}
          setEditingEntry={mobile.setEditingEntry}
          activeLotId={mobile.activeLotId}
          lots={data.lots}
          diary={data.diary}
          weatherForm={data.weatherForm}
          onAddActivity={mobile.addActivityFromSheet}
          onAddDelay={mobile.addDelayFromSheet}
          onAddDelivery={mobile.addDeliveryFromSheet}
          onAddEvent={mobile.addEventFromSheet}
          onSavePersonnel={mobile.handleSavePersonnel}
          onSavePlant={mobile.handleSavePlant}
          onSaveWeather={mobile.handleSaveWeather}
        />
        <ConfirmDialog
          open={Boolean(entryPendingDelete)}
          title="Delete Diary Entry"
          description={
            <>
              <p>Delete this diary entry? This removes it from the daily diary timeline.</p>
              {entryPendingDelete && (
                <p className="font-medium text-foreground">{entryPendingDelete.description}</p>
              )}
            </>
          }
          confirmLabel="Delete"
          variant="destructive"
          onCancel={() => setEntryPendingDelete(null)}
          onConfirm={() => {
            if (entryPendingDelete) {
              void mobile.handleDeleteEntry(entryPendingDelete);
            }
            setEntryPendingDelete(null);
          }}
        />
      </>
    );
  }

  // --- Desktop Layout ---
  const tabFallback = (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-6">
      <DiaryDesktopHeader projectId={projectId!} onNewEntry={handleNewEntry} />

      {data.error && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
          role="alert"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">{data.error}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void data.fetchDiaryForDate(data.selectedDate)}
            >
              Try again
            </Button>
          </div>
        </div>
      )}

      <DiaryDateSelector
        projectId={projectId!}
        selectedDate={data.selectedDate}
        onDateChange={handleDateChange}
        diaries={data.diaries}
        diary={data.diary}
      />

      {data.loading ? (
        tabFallback
      ) : data.error ? null : data.showNewEntry || data.diary ? (
        <div className="space-y-6">
          <DiaryTabNav activeTab={activeTab} onTabChange={setActiveTab} diary={data.diary} />

          <Suspense fallback={tabFallback}>
            {activeTab === 'weather' && (
              <WeatherTab
                diary={data.diary}
                projectId={projectId!}
                selectedDate={data.selectedDate}
                weatherForm={data.weatherForm}
                setWeatherForm={data.setWeatherForm}
                saving={data.saving}
                onSave={data.createOrUpdateDiary}
                fetchingWeather={data.fetchingWeather}
                weatherSource={data.weatherSource}
                onFetchWeather={data.fetchWeatherForDate}
              />
            )}
            {/*
              The four entry tabs need diary.id, so they stay gated on
              data.diary. Before the day's diary exists (saving Weather creates
              it), show one shared guided card instead of a blank panel. Loading
              and error states never reach here — the branch above already
              renders the spinner or nothing alongside the error banner.
            */}
            {activeTab !== 'weather' && !data.diary && (
              <DiaryNoDayCard onGoToWeather={() => setActiveTab('weather')} />
            )}
            {activeTab === 'personnel' && data.diary && (
              <PersonnelTab
                diary={data.diary}
                projectId={projectId!}
                selectedDate={data.selectedDate}
                saving={data.saving}
                setSaving={data.setSaving}
                onDiaryUpdate={data.setDiary}
              />
            )}
            {activeTab === 'plant' && data.diary && (
              <PlantTab
                diary={data.diary}
                projectId={projectId!}
                selectedDate={data.selectedDate}
                saving={data.saving}
                setSaving={data.setSaving}
                onDiaryUpdate={data.setDiary}
              />
            )}
            {activeTab === 'activities' && data.diary && (
              <ActivitiesTab
                diary={data.diary}
                projectId={projectId!}
                lots={data.lots}
                saving={data.saving}
                setSaving={data.setSaving}
                onDiaryUpdate={data.setDiary}
              />
            )}
            {activeTab === 'delays' && data.diary && (
              <DelaysTab
                diary={data.diary}
                saving={data.saving}
                setSaving={data.setSaving}
                onDiaryUpdate={data.setDiary}
              />
            )}
          </Suspense>

          {data.diary && (
            <DiarySubmitSection
              diary={data.diary}
              projectId={projectId!}
              addendums={data.addendums}
              saving={data.saving}
              setSaving={data.setSaving}
              onDiaryUpdate={data.setDiary}
              onRefreshDiaries={data.fetchDiaries}
              onAddendumsChange={data.setAddendums}
            />
          )}
        </div>
      ) : (
        <DiaryEmptyState selectedDate={data.selectedDate} onCreateEntry={handleNewEntry} />
      )}
    </div>
  );
}
