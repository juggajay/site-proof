import { useState, lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { DiaryMobileView } from '@/components/foreman/DiaryMobileView'
import type { DiaryTab } from './types'
import { useDiaryData } from './hooks/useDiaryData'
import { useDiaryMobileHandlers } from './hooks/useDiaryMobileHandlers'
import { DiaryDateSelector } from './components/DiaryDateSelector'
import { DiaryMobileSheets } from './components/DiaryMobileSheets'
import { DiarySubmitSection } from './components/DiarySubmitSection'
import { DiaryDesktopHeader } from './components/DiaryDesktopHeader'
import { DiaryTabNav } from './components/DiaryTabNav'
import { DiaryEmptyState } from './components/DiaryEmptyState'

// Lazy-loaded tab components
const WeatherTab = lazy(() => import('./components/WeatherTab').then(m => ({ default: m.WeatherTab })))
const PersonnelTab = lazy(() => import('./components/PersonnelTab').then(m => ({ default: m.PersonnelTab })))
const PlantTab = lazy(() => import('./components/PlantTab').then(m => ({ default: m.PlantTab })))
const ActivitiesTab = lazy(() => import('./components/ActivitiesTab').then(m => ({ default: m.ActivitiesTab })))
const DelaysTab = lazy(() => import('./components/DelaysTab').then(m => ({ default: m.DelaysTab })))

export function DailyDiaryPage() {
  const { projectId } = useParams()
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState<DiaryTab>('weather')

  // Data hook (state, fetching, effects)
  const data = useDiaryData({ projectId, isMobile })

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
    setWeatherForm: data.setWeatherForm,
  })

  // Derive weather display data for mobile view
  const mobileWeather = data.diary ? {
    conditions: data.diary.weatherConditions || '',
    temperatureMin: data.diary.temperatureMin?.toString() || '',
    temperatureMax: data.diary.temperatureMax?.toString() || '',
    rainfallMm: data.diary.rainfallMm?.toString() || '',
  } : data.weatherForm.weatherConditions ? {
    conditions: data.weatherForm.weatherConditions,
    temperatureMin: data.weatherForm.temperatureMin,
    temperatureMax: data.weatherForm.temperatureMax,
    rainfallMm: data.weatherForm.rainfallMm,
  } : null

  const handleNewEntry = () => {
    data.setShowNewEntry(true)
    setActiveTab('weather')
  }

  // --- Mobile Layout ---
  if (isMobile) {
    return (
      <>
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
          onDeleteEntry={mobile.handleDeleteEntry}
        />
        <DiaryMobileSheets
          activeSheet={mobile.activeSheet}
          onCloseSheet={() => { mobile.setActiveSheet(null); mobile.setEditingEntry(null) }}
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
          onDeleteEntry={mobile.handleDeleteEntry}
          onSavePersonnel={mobile.handleSavePersonnel}
          onSavePlant={mobile.handleSavePlant}
          onSaveWeather={mobile.handleSaveWeather}
        />
      </>
    )
  }

  // --- Desktop Layout ---
  const tabFallback = (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="space-y-6">
      <DiaryDesktopHeader projectId={projectId!} onNewEntry={handleNewEntry} />

      {data.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{data.error}</div>
      )}

      <DiaryDateSelector
        projectId={projectId!}
        selectedDate={data.selectedDate}
        onDateChange={data.setSelectedDate}
        diaries={data.diaries}
        diary={data.diary}
      />

      {data.loading ? (
        tabFallback
      ) : data.showNewEntry || data.diary ? (
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
  )
}
