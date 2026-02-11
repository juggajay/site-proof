import { useState, useEffect, useCallback } from 'react'
import { apiFetch, ApiError } from '@/lib/api'
import type { DailyDiary, Lot, Addendum, WeatherFormState } from '../types'

interface UseDiaryDataParams {
  projectId: string | undefined
  isMobile: boolean
}

export function useDiaryData({ projectId, isMobile }: UseDiaryDataParams) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [diary, setDiary] = useState<DailyDiary | null>(null)
  const [diaries, setDiaries] = useState<DailyDiary[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [fetchingWeather, setFetchingWeather] = useState(false)
  const [weatherSource, setWeatherSource] = useState<string | null>(null)
  const [addendums, setAddendums] = useState<Addendum[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [docketSummary, setDocketSummary] = useState<any>(null)
  const [docketSummaryLoading, setDocketSummaryLoading] = useState(false)

  const [saving, setSaving] = useState(false)

  const [weatherForm, setWeatherForm] = useState<WeatherFormState>({
    weatherConditions: '',
    temperatureMin: '',
    temperatureMax: '',
    rainfallMm: '',
    weatherNotes: '',
    generalNotes: '',
  })

  // --- Fetch functions ---

  const fetchDiaries = async () => {
    try {
      const data = await apiFetch<DailyDiary[]>(`/api/diary/${projectId}`)
      setDiaries(data)
    } catch (err) {
      console.error('Error fetching diaries:', err)
    }
  }

  const fetchLots = async () => {
    try {
      const data = await apiFetch<{ lots: Lot[] }>(`/api/lots?projectId=${projectId}`)
      setLots(data.lots || [])
    } catch (err) {
      console.error('Error fetching lots:', err)
    }
  }

  const fetchTimeline = async (diaryId?: string) => {
    const id = diaryId || diary?.id
    if (!id) return
    try {
      const data = await apiFetch<{ timeline: any[] }>(`/api/diary/${id}/timeline`)
      setTimeline(data.timeline)
    } catch (err) {
      console.error('Error fetching timeline:', err)
    }
  }

  const fetchDocketSummary = async () => {
    if (!projectId || !selectedDate) return
    setDocketSummaryLoading(true)
    try {
      const data = await apiFetch<any>(`/api/diary/project/${projectId}/docket-summary/${selectedDate}`)
      setDocketSummary(data)
    } catch (err) {
      console.error('Error fetching docket summary:', err)
    } finally {
      setDocketSummaryLoading(false)
    }
  }

  const fetchWeatherForDate = useCallback(async (date: string) => {
    if (!projectId) return
    setFetchingWeather(true)
    setWeatherSource(null)
    try {
      const data = await apiFetch<any>(`/api/diary/${projectId}/weather/${date}`)
      setWeatherForm(prev => ({
        ...prev,
        weatherConditions: data.weatherConditions || prev.weatherConditions,
        temperatureMin: data.temperatureMin?.toString() || prev.temperatureMin,
        temperatureMax: data.temperatureMax?.toString() || prev.temperatureMax,
        rainfallMm: data.rainfallMm?.toString() || prev.rainfallMm,
      }))
      setWeatherSource(data.location?.fromProjectState
        ? `Weather auto-populated from ${data.source} (state capital)`
        : `Weather auto-populated from ${data.source}`)
    } catch (err) {
      console.error('Error fetching weather:', err)
    } finally {
      setFetchingWeather(false)
    }
  }, [projectId])

  const fetchDiaryForDate = async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<DailyDiary>(`/api/diary/${projectId}/${date}`)
      setDiary(data)
      setWeatherForm({
        weatherConditions: data.weatherConditions || '',
        temperatureMin: data.temperatureMin?.toString() || '',
        temperatureMax: data.temperatureMax?.toString() || '',
        rainfallMm: data.rainfallMm?.toString() || '',
        weatherNotes: data.weatherNotes || '',
        generalNotes: data.generalNotes || '',
      })
      setShowNewEntry(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDiary(null)
        setWeatherForm({
          weatherConditions: '',
          temperatureMin: '',
          temperatureMax: '',
          rainfallMm: '',
          weatherNotes: '',
          generalNotes: '',
        })
        setWeatherSource(null)
        setShowNewEntry(false)
        fetchWeatherForDate(date)
      } else {
        console.error('Error fetching diary:', err)
        setError('Failed to fetch diary')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchAddendums = async (diaryId: string) => {
    try {
      const data = await apiFetch<Addendum[]>(`/api/diary/${diaryId}/addendums`)
      setAddendums(data)
    } catch (err) {
      console.error('Error fetching addendums:', err)
    }
  }

  // --- Core Handlers ---

  const createOrUpdateDiary = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const data = await apiFetch<DailyDiary>('/api/diary', {
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
      setDiary(data)
      setShowNewEntry(true)
      fetchDiaries()
    } catch (err) {
      console.error('Error saving diary:', err)
      setError('Failed to save diary')
    } finally {
      setSaving(false)
    }
  }, [saving, projectId, selectedDate, weatherForm])

  const ensureDiaryExists = async (): Promise<DailyDiary | null> => {
    if (diary) return diary
    try {
      const newDiary = await apiFetch<DailyDiary>('/api/diary', {
        method: 'POST',
        body: JSON.stringify({ projectId, date: selectedDate }),
      })
      setDiary(newDiary)
      return newDiary
    } catch {
      return null
    }
  }

  // --- Effects ---

  useEffect(() => {
    if (projectId) {
      fetchDiaries()
      fetchLots()
    }
  }, [projectId])

  useEffect(() => {
    if (projectId && selectedDate) {
      fetchDiaryForDate(selectedDate)
    }
  }, [projectId, selectedDate])

  useEffect(() => {
    if (diary && diary.status === 'submitted') {
      fetchAddendums(diary.id)
    } else {
      setAddendums([])
    }
  }, [diary?.id, diary?.status])

  useEffect(() => {
    if (diary && isMobile) {
      fetchTimeline()
    }
  }, [diary?.id, isMobile])

  useEffect(() => {
    if (isMobile && projectId && selectedDate) {
      fetchDocketSummary()
    }
  }, [isMobile, projectId, selectedDate])

  return {
    selectedDate, setSelectedDate,
    diary, setDiary,
    diaries,
    lots,
    loading,
    saving, setSaving,
    error, setError,
    showNewEntry, setShowNewEntry,
    fetchingWeather,
    weatherSource,
    addendums, setAddendums,
    timeline,
    docketSummary,
    docketSummaryLoading,
    weatherForm, setWeatherForm,
    fetchDiaries,
    fetchDiaryForDate,
    fetchTimeline,
    fetchDocketSummary,
    fetchWeatherForDate,
    createOrUpdateDiary,
    ensureDiaryExists,
  }
}
