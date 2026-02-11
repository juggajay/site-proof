import React, { useState, useEffect, useRef, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { apiFetch } from '@/lib/api'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { VoiceInputButton } from '@/components/ui/VoiceInputButton'
import { WEATHER_CONDITIONS } from '../constants'
import type { DailyDiary, WeatherFormState } from '../types'

interface WeatherTabProps {
  diary: DailyDiary | null
  projectId: string
  selectedDate: string
  weatherForm: WeatherFormState
  setWeatherForm: React.Dispatch<React.SetStateAction<WeatherFormState>>
  saving: boolean
  onSave: () => Promise<void>
  fetchingWeather: boolean
  weatherSource: string | null
  onFetchWeather: (date: string) => Promise<void>
}

export const WeatherTab = React.memo(function WeatherTab({
  diary,
  projectId,
  selectedDate,
  weatherForm,
  setWeatherForm,
  saving,
  onSave,
  fetchingWeather,
  weatherSource,
  onFetchWeather,
}: WeatherTabProps) {
  // Auto-save state
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const previousWeatherFormRef = useRef<string>('')

  // Auto-save functionality
  const performAutoSave = useCallback(async () => {
    if (!diary || diary.status === 'submitted' || saving || autoSaving) return

    const currentFormJson = JSON.stringify(weatherForm)
    if (currentFormJson === previousWeatherFormRef.current) {
      setHasUnsavedChanges(false)
      return
    }

    setAutoSaving(true)
    try {
      await apiFetch<DailyDiary>('/api/diary', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          date: selectedDate,
          weatherConditions: weatherForm.weatherConditions || undefined,
          temperatureMin: weatherForm.temperatureMin ? parseFloat(weatherForm.temperatureMin) : undefined,
          temperatureMax: weatherForm.temperatureMax ? parseFloat(weatherForm.temperatureMax) : undefined,
          rainfallMm: weatherForm.rainfallMm ? parseFloat(weatherForm.rainfallMm) : undefined,
          weatherNotes: weatherForm.weatherNotes || undefined,
          generalNotes: weatherForm.generalNotes || undefined,
        }),
      })

      setLastAutoSaved(new Date())
      setHasUnsavedChanges(false)
      previousWeatherFormRef.current = currentFormJson
    } catch (err) {
      console.error('Auto-save failed:', err)
    } finally {
      setAutoSaving(false)
    }
  }, [diary, saving, autoSaving, weatherForm, projectId, selectedDate])

  // Track weather form changes for auto-save
  useEffect(() => {
    if (diary && diary.status !== 'submitted') {
      const currentFormJson = JSON.stringify(weatherForm)
      if (currentFormJson !== previousWeatherFormRef.current) {
        setHasUnsavedChanges(true)
      }
    }
  }, [weatherForm, diary])

  // Auto-save timer - save every 60 seconds if there are changes
  useEffect(() => {
    if (diary && diary.status !== 'submitted' && hasUnsavedChanges) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
      autoSaveTimerRef.current = setTimeout(() => {
        performAutoSave()
      }, 60000)
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [diary, hasUnsavedChanges, performAutoSave])

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && diary && diary.status !== 'submitted') {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges, diary])

  // Initialize previous form ref when diary loads
  useEffect(() => {
    if (diary) {
      previousWeatherFormRef.current = JSON.stringify({
        weatherConditions: diary.weatherConditions || '',
        temperatureMin: diary.temperatureMin?.toString() || '',
        temperatureMax: diary.temperatureMax?.toString() || '',
        rainfallMm: diary.rainfallMm?.toString() || '',
        weatherNotes: diary.weatherNotes || '',
        generalNotes: diary.generalNotes || '',
      })
    }
  }, [diary?.id])

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Weather & General Notes</h3>
          {/* Auto-save status */}
          {autoSaving && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              Auto-saving...
            </span>
          )}
          {!autoSaving && lastAutoSaved && (
            <span className="text-xs text-muted-foreground">
              Auto-saved {lastAutoSaved.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {!autoSaving && hasUnsavedChanges && !lastAutoSaved && (
            <span className="text-xs text-orange-500">
              &bull; Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {fetchingWeather && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Fetching weather...
            </span>
          )}
          {weatherSource && !fetchingWeather && (
            <span className="text-sm text-green-600">
              &#10003; {weatherSource}
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Weather Conditions</label>
          <select
            value={weatherForm.weatherConditions}
            onChange={(e) => setWeatherForm({ ...weatherForm, weatherConditions: e.target.value })}
            disabled={diary?.status === 'submitted'}
            className="w-full rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="">Select conditions...</option>
            {WEATHER_CONDITIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">Min Temp (&deg;C)</label>
            <input
              type="number"
              value={weatherForm.temperatureMin}
              onChange={(e) => setWeatherForm({ ...weatherForm, temperatureMin: e.target.value })}
              disabled={diary?.status === 'submitted'}
              placeholder="e.g. 15"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">Max Temp (&deg;C)</label>
            <input
              type="number"
              value={weatherForm.temperatureMax}
              onChange={(e) => setWeatherForm({ ...weatherForm, temperatureMax: e.target.value })}
              disabled={diary?.status === 'submitted'}
              placeholder="e.g. 28"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Rainfall (mm)</label>
          <input
            type="number"
            value={weatherForm.rainfallMm}
            onChange={(e) => setWeatherForm({ ...weatherForm, rainfallMm: e.target.value })}
            disabled={diary?.status === 'submitted'}
            placeholder="e.g. 5"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Weather Notes</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={weatherForm.weatherNotes}
              onChange={(e) => setWeatherForm({ ...weatherForm, weatherNotes: e.target.value })}
              disabled={diary?.status === 'submitted'}
              placeholder="Additional weather notes..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2"
            />
            {diary?.status !== 'submitted' && (
              <VoiceInputButton
                onTranscript={(text) => setWeatherForm({ ...weatherForm, weatherNotes: (weatherForm.weatherNotes ? weatherForm.weatherNotes + ' ' : '') + text })}
                appendMode={true}
              />
            )}
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium">General Notes</label>
            {diary?.status !== 'submitted' && (
              <VoiceInputButton
                onTranscript={(text) => {
                  const currentContent = weatherForm.generalNotes || ''
                  const newContent = currentContent
                    ? `${currentContent}<p>${text}</p>`
                    : `<p>${text}</p>`
                  setWeatherForm({ ...weatherForm, generalNotes: newContent })
                }}
                appendMode={true}
                className="flex-shrink-0"
              />
            )}
          </div>
          {diary?.status === 'submitted' ? (
            <div
              className="w-full rounded-md border border-input bg-muted/50 px-3 py-2 prose prose-sm max-w-none dark:prose-invert min-h-[100px]"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(weatherForm.generalNotes || '<span class="text-muted-foreground">No notes</span>') }}
            />
          ) : (
            <RichTextEditor
              value={weatherForm.generalNotes}
              onChange={(html) => setWeatherForm({ ...weatherForm, generalNotes: html })}
              placeholder="General site notes for the day... Use formatting toolbar for bold, italic, and lists."
              minHeight="100px"
            />
          )}
        </div>
      </div>
      {diary?.status !== 'submitted' && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : diary ? 'Update Weather Info' : 'Create Diary Entry'}
          </button>
          <button
            onClick={() => onFetchWeather(selectedDate)}
            disabled={fetchingWeather}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            title="Refresh weather from API"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {fetchingWeather ? 'Fetching...' : 'Refresh Weather'}
          </button>
        </div>
      )}
    </div>
  )
})
