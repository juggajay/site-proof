import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '@/lib/api'
import type { QuickAddType } from '@/components/foreman/DiaryQuickAddBar'
import type { DailyDiary, WeatherFormState } from '../types'

interface UseDiaryMobileHandlersParams {
  projectId: string | undefined
  selectedDate: string
  diary: DailyDiary | null
  timeline: any[]
  ensureDiaryExists: () => Promise<DailyDiary | null>
  fetchTimeline: (diaryId?: string) => Promise<void>
  fetchDiaryForDate: (date: string) => Promise<void>
  fetchDocketSummary: () => Promise<void>
  setDiary: (diary: DailyDiary | null) => void
  setWeatherForm: React.Dispatch<React.SetStateAction<WeatherFormState>>
}

export function useDiaryMobileHandlers({
  projectId,
  selectedDate,
  diary,
  timeline,
  ensureDiaryExists,
  fetchTimeline,
  fetchDiaryForDate,
  fetchDocketSummary,
  setDiary,
  setWeatherForm,
}: UseDiaryMobileHandlersParams) {
  const navigate = useNavigate()
  const [activeLotId, setActiveLotId] = useState<string | null>(null)
  const [activeSheet, setActiveSheet] = useState<QuickAddType | 'weather' | null>(null)
  const [editingEntry, setEditingEntry] = useState<any>(null)

  // Derive manual entries from timeline
  const manualEntries = {
    personnel: timeline.filter((e: any) => e.type === 'personnel').map((e: any) => ({ id: e.id, name: e.description, hours: e.data?.hours })),
    plant: timeline.filter((e: any) => e.type === 'plant').map((e: any) => ({ id: e.id, description: e.description, hoursOperated: e.data?.hoursOperated })),
  }

  const handleDeleteEntry = async (entry: { id: string; type: string }) => {
    if (!diary) return
    const typeToEndpoint: Record<string, string> = {
      activity: 'activities', delay: 'delays', delivery: 'deliveries',
      event: 'events', personnel: 'personnel', plant: 'plant',
    }
    const endpoint = typeToEndpoint[entry.type]
    if (!endpoint) return
    try {
      await apiFetch(`/api/diary/${diary.id}/${endpoint}/${entry.id}`, { method: 'DELETE' })
      await fetchTimeline(diary.id)
      await fetchDiaryForDate(selectedDate)
    } catch { /* ignore */ }
  }

  const handleRefresh = async () => {
    await Promise.all([
      fetchDiaryForDate(selectedDate),
      fetchDocketSummary(),
    ])
  }

  const addActivityFromSheet = async (data: { description: string; lotId?: string; quantity?: number; unit?: string; notes?: string }) => {
    let currentDiary = diary
    if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
    await apiFetch(`/api/diary/${currentDiary.id}/activities`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await fetchTimeline(currentDiary.id); await fetchDiaryForDate(selectedDate)
  }

  const addDelayFromSheet = async (data: { delayType: string; description: string; durationHours?: number; impact?: string; lotId?: string }) => {
    let currentDiary = diary
    if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
    await apiFetch(`/api/diary/${currentDiary.id}/delays`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await fetchTimeline(currentDiary.id); await fetchDiaryForDate(selectedDate)
  }

  const addDeliveryFromSheet = async (data: { description: string; supplier?: string; docketNumber?: string; quantity?: number; unit?: string; lotId?: string; notes?: string }) => {
    let currentDiary = diary
    if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
    await apiFetch(`/api/diary/${currentDiary.id}/deliveries`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await fetchTimeline(currentDiary.id); await fetchDiaryForDate(selectedDate)
  }

  const addEventFromSheet = async (data: { eventType: string; description: string; notes?: string; lotId?: string }) => {
    let currentDiary = diary
    if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
    await apiFetch(`/api/diary/${currentDiary.id}/events`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await fetchTimeline(currentDiary.id); await fetchDiaryForDate(selectedDate)
  }

  const handleEditEntry = (entry: any) => {
    setEditingEntry(entry)
    setActiveSheet(entry.type === 'personnel' || entry.type === 'plant' ? 'manual' : entry.type)
  }

  const handleTapPending = (_docketId: string) => {
    navigate(`/projects/${projectId}/foreman?tab=approve`)
  }

  const handleSavePersonnel = async (data: any) => {
    if (editingEntry?.type === 'personnel') { await handleDeleteEntry(editingEntry); setEditingEntry(null) }
    let currentDiary = diary
    if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
    await apiFetch(`/api/diary/${currentDiary.id}/personnel`, {
      method: 'POST',
      body: JSON.stringify({ ...data, source: 'manual', lotId: data.lotId || activeLotId || undefined }),
    })
    await fetchTimeline(currentDiary.id)
    await fetchDiaryForDate(selectedDate)
  }

  const handleSavePlant = async (data: any) => {
    if (editingEntry?.type === 'plant') { await handleDeleteEntry(editingEntry); setEditingEntry(null) }
    let currentDiary = diary
    if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
    await apiFetch(`/api/diary/${currentDiary.id}/plant`, {
      method: 'POST',
      body: JSON.stringify({ ...data, source: 'manual', lotId: data.lotId || activeLotId || undefined }),
    })
    await fetchTimeline(currentDiary.id)
    await fetchDiaryForDate(selectedDate)
  }

  const handleSaveWeather = async (data: { conditions: string; temperatureMin: string; temperatureMax: string; rainfallMm: string }) => {
    const currentDiary = await ensureDiaryExists()
    if (!currentDiary) return
    try {
      const updated = await apiFetch<DailyDiary>('/api/diary', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          date: selectedDate,
          weatherConditions: data.conditions || undefined,
          temperatureMin: data.temperatureMin ? parseFloat(data.temperatureMin) : undefined,
          temperatureMax: data.temperatureMax ? parseFloat(data.temperatureMax) : undefined,
          rainfallMm: data.rainfallMm ? parseFloat(data.rainfallMm) : undefined,
        }),
      })
      setDiary(updated)
      setWeatherForm(() => ({
        weatherConditions: updated.weatherConditions || '',
        temperatureMin: updated.temperatureMin?.toString() || '',
        temperatureMax: updated.temperatureMax?.toString() || '',
        rainfallMm: updated.rainfallMm?.toString() || '',
        weatherNotes: updated.weatherNotes || '',
        generalNotes: updated.generalNotes || '',
      }))
    } catch {
      // ignore weather save errors
    }
  }

  return {
    activeLotId, setActiveLotId,
    activeSheet, setActiveSheet,
    editingEntry, setEditingEntry,
    manualEntries,
    handleRefresh,
    handleDeleteEntry,
    addActivityFromSheet,
    addDelayFromSheet,
    addDeliveryFromSheet,
    addEventFromSheet,
    handleEditEntry,
    handleTapPending,
    handleSavePersonnel,
    handleSavePlant,
    handleSaveWeather,
  }
}
