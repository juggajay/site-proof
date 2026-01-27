import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getAuthToken } from '../../lib/auth'
import { RichTextEditor } from '../../components/ui/RichTextEditor'
import { VoiceInputButton } from '../../components/ui/VoiceInputButton'
import { generateDailyDiaryPDF, DailyDiaryPDFData } from '../../lib/pdfGenerator'
import { toast } from '../../components/ui/toaster'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { DiaryMobileView } from '@/components/foreman/DiaryMobileView'
import type { QuickAddType } from '@/components/foreman/DiaryQuickAddBar'
import { AddActivitySheet } from '@/components/foreman/sheets/AddActivitySheet'
import { AddDelaySheet } from '@/components/foreman/sheets/AddDelaySheet'
import { AddDeliverySheet } from '@/components/foreman/sheets/AddDeliverySheet'
import { AddEventSheet } from '@/components/foreman/sheets/AddEventSheet'
import { AddManualLabourPlantSheet } from '@/components/foreman/sheets/AddManualLabourPlantSheet'
import { AddWeatherSheet } from '@/components/foreman/sheets/AddWeatherSheet'

interface Personnel {
  id: string
  name: string
  company?: string
  role?: string
  startTime?: string
  finishTime?: string
  hours?: number
  createdAt: string
}

interface Plant {
  id: string
  description: string
  idRego?: string
  company?: string
  hoursOperated?: number
  notes?: string
  createdAt: string
}

interface Activity {
  id: string
  description: string
  lotId?: string
  lot?: { id: string; lotNumber: string }
  quantity?: number
  unit?: string
  notes?: string
  createdAt: string
}

interface Delay {
  id: string
  delayType: string
  startTime?: string
  endTime?: string
  durationHours?: number
  description: string
  impact?: string
  createdAt: string
}

interface Delivery {
  id: string
  description: string
  supplier?: string
  docketNumber?: string
  quantity?: number
  unit?: string
  lotId?: string
  lot?: { id: string; lotNumber: string }
  notes?: string
  createdAt: string
}

interface DiaryEvent {
  id: string
  eventType: string
  description: string
  notes?: string
  lotId?: string
  lot?: { id: string; lotNumber: string }
  createdAt: string
}

interface Addendum {
  id: string
  content: string
  addedBy: { id: string; fullName: string; email: string }
  addedAt: string
}

interface DailyDiary {
  id: string
  projectId: string
  date: string
  status: 'draft' | 'submitted'
  weatherConditions?: string
  temperatureMin?: number
  temperatureMax?: number
  rainfallMm?: number
  weatherNotes?: string
  generalNotes?: string
  personnel: Personnel[]
  plant: Plant[]
  activities: Activity[]
  delays: Delay[]
  deliveries: Delivery[]
  events: DiaryEvent[]
  submittedBy?: { id: string; fullName: string; email: string }
  submittedAt?: string
  isLate?: boolean
  createdAt: string
  updatedAt: string
}

interface Lot {
  id: string
  lotNumber: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3031'

const WEATHER_CONDITIONS = ['Fine', 'Partly Cloudy', 'Cloudy', 'Rain', 'Heavy Rain', 'Storm', 'Wind', 'Fog']
const DELAY_TYPES = ['Weather', 'Client Instruction', 'Design Change', 'Material Delay', 'Plant Breakdown', 'Labor Shortage', 'Safety Incident', 'Other']

export function DailyDiaryPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [diary, setDiary] = useState<DailyDiary | null>(null)
  const [diaries, setDiaries] = useState<DailyDiary[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [activeTab, setActiveTab] = useState<'weather' | 'personnel' | 'plant' | 'activities' | 'delays'>('weather')
  const [error, setError] = useState<string | null>(null)
  const [fetchingWeather, setFetchingWeather] = useState(false)
  const [weatherSource, setWeatherSource] = useState<string | null>(null)

  // Feature #234: Auto-save state
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const previousWeatherFormRef = useRef<string>('')

  // Feature #240: Search diaries state
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredDiaries, setFilteredDiaries] = useState<DailyDiary[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Addendum state
  const [addendums, setAddendums] = useState<Addendum[]>([])
  const [addendumContent, setAddendumContent] = useState('')
  const [addingAddendum, setAddingAddendum] = useState(false)

  // Mobile diary view state
  const [activeLotId, setActiveLotId] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [docketSummary, setDocketSummary] = useState<any>(null)
  const [docketSummaryLoading, setDocketSummaryLoading] = useState(false)
  const [activeSheet, setActiveSheet] = useState<QuickAddType | 'weather' | null>(null)
  const [editingEntry, setEditingEntry] = useState<any>(null)

  // Form states
  const [weatherForm, setWeatherForm] = useState({
    weatherConditions: '',
    temperatureMin: '',
    temperatureMax: '',
    rainfallMm: '',
    weatherNotes: '',
    generalNotes: '',
  })

  const [personnelForm, setPersonnelForm] = useState({
    name: '',
    company: '',
    role: '',
    startTime: '',
    finishTime: '',
    hours: '',
  })

  // Calculate hours from start and finish time
  const calculateHours = (startTime: string, finishTime: string): number | null => {
    if (!startTime || !finishTime) return null
    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = finishTime.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    const diffMinutes = endMinutes - startMinutes
    if (diffMinutes <= 0) return null
    return Math.round((diffMinutes / 60) * 10) / 10 // Round to 1 decimal
  }

  // Handle start time change with auto-calculation
  const handlePersonnelStartTimeChange = (value: string) => {
    const hours = calculateHours(value, personnelForm.finishTime)
    setPersonnelForm({
      ...personnelForm,
      startTime: value,
      hours: hours !== null ? hours.toString() : '',
    })
  }

  // Handle finish time change with auto-calculation
  const handlePersonnelFinishTimeChange = (value: string) => {
    const hours = calculateHours(personnelForm.startTime, value)
    setPersonnelForm({
      ...personnelForm,
      finishTime: value,
      hours: hours !== null ? hours.toString() : '',
    })
  }

  // Calculate personnel subtotals by company
  const getPersonnelSubtotalsByCompany = () => {
    if (!diary) return []
    const companyTotals: Record<string, { count: number; hours: number }> = {}

    for (const p of diary.personnel) {
      const company = p.company || 'Unspecified'
      if (!companyTotals[company]) {
        companyTotals[company] = { count: 0, hours: 0 }
      }
      companyTotals[company].count++
      // Ensure hours is a number (might come as string from API)
      const hours = typeof p.hours === 'number' ? p.hours : (parseFloat(String(p.hours)) || 0)
      companyTotals[company].hours += hours
    }

    return Object.entries(companyTotals).map(([company, data]) => ({
      company,
      count: data.count,
      hours: data.hours,
    }))
  }

  const [plantForm, setPlantForm] = useState({
    description: '',
    idRego: '',
    company: '',
    hoursOperated: '',
    notes: '',
  })

  const [activityForm, setActivityForm] = useState({
    description: '',
    lotId: '',
    quantity: '',
    unit: '',
    notes: '',
  })

  const [delayForm, setDelayForm] = useState({
    delayType: '',
    startTime: '',
    endTime: '',
    durationHours: '',
    description: '',
    impact: '',
  })

  // Submit confirmation state
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([])

  // Hours validation helper - warn if hours > 24
  const validateHours = (hours: string): { isValid: boolean; warning: string | null } => {
    const numHours = parseFloat(hours)
    if (isNaN(numHours) || hours === '') {
      return { isValid: true, warning: null }
    }
    if (numHours < 0) {
      return { isValid: false, warning: 'Hours cannot be negative' }
    }
    if (numHours > 24) {
      return { isValid: true, warning: 'Warning: Hours exceed 24 - please verify this is correct' }
    }
    return { isValid: true, warning: null }
  }

  // Validation state for hours inputs
  const plantHoursValidation = validateHours(plantForm.hoursOperated)
  const delayHoursValidation = validateHours(delayForm.durationHours)

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  // Helper function to get diary status for a date
  const getDiaryStatusForDate = (date: Date): 'submitted' | 'draft' | 'missing' | 'future' => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)

    // Future dates - no status
    if (checkDate > today) return 'future'

    // Check if we have a diary for this date
    const dateStr = date.toISOString().split('T')[0]
    const diary = diaries.find(d => d.date.split('T')[0] === dateStr)

    if (diary) {
      return diary.status
    }

    return 'missing'
  }

  // Generate calendar days for current month
  const getCalendarDays = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay() // 0 = Sunday

    const days: Array<{ date: Date | null; status?: 'submitted' | 'draft' | 'missing' | 'future' }> = []

    // Add empty cells for days before the 1st
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: null })
    }

    // Add all days in the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      days.push({
        date,
        status: getDiaryStatusForDate(date)
      })
    }

    return days
  }

  // Navigate calendar months
  const previousMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
  }

  // Handle clicking a calendar day
  const handleCalendarDayClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    setSelectedDate(dateStr)
    setShowCalendar(false)
  }

  // Fetch diaries list
  useEffect(() => {
    if (projectId) {
      fetchDiaries()
      fetchLots()
    }
  }, [projectId])

  // Fetch diary for selected date
  useEffect(() => {
    if (projectId && selectedDate) {
      fetchDiaryForDate(selectedDate)
    }
  }, [projectId, selectedDate])

  // Fetch addendums when diary loads and is submitted
  useEffect(() => {
    if (diary && diary.status === 'submitted') {
      fetchAddendums(diary.id)
    } else {
      setAddendums([])
    }
  }, [diary?.id, diary?.status])

  // Mobile: fetch timeline when diary changes
  useEffect(() => {
    if (diary && isMobile) {
      fetchTimeline()
    }
  }, [diary?.id, isMobile])

  // Mobile: fetch docket summary
  useEffect(() => {
    if (isMobile && projectId && selectedDate) {
      fetchDocketSummary()
    }
  }, [isMobile, projectId, selectedDate])

  // Feature #234: Auto-save functionality
  const performAutoSave = useCallback(async () => {
    if (!diary || diary.status === 'submitted' || saving || autoSaving) return

    const currentFormJson = JSON.stringify(weatherForm)
    if (currentFormJson === previousWeatherFormRef.current) {
      // No changes to save
      setHasUnsavedChanges(false)
      return
    }

    setAutoSaving(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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

      if (res.ok) {
        const data = await res.json()
        setDiary(data)
        setLastAutoSaved(new Date())
        setHasUnsavedChanges(false)
        previousWeatherFormRef.current = currentFormJson
      }
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
      // Clear any existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }

      // Set new timer for 60 seconds
      autoSaveTimerRef.current = setTimeout(() => {
        performAutoSave()
      }, 60000)
    }

    // Cleanup on unmount
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

  const fetchDiaries = async () => {
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setDiaries(data)
      }
    } catch (err) {
      console.error('Error fetching diaries:', err)
    }
  }

  const fetchLots = async () => {
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/lots?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setLots(data.lots || [])
      }
    } catch (err) {
      console.error('Error fetching lots:', err)
    }
  }

  // Mobile: fetch timeline entries
  // Accept optional diaryId to avoid stale closure when diary was just created
  const fetchTimeline = async (diaryId?: string) => {
    const id = diaryId || diary?.id
    if (!id) return
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${id}/timeline`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setTimeline(data.timeline)
      }
    } catch (err) {
      console.error('Error fetching timeline:', err)
    }
  }

  // Mobile: fetch docket summary
  const fetchDocketSummary = async () => {
    if (!projectId || !selectedDate) return
    setDocketSummaryLoading(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/project/${projectId}/docket-summary/${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setDocketSummary(data)
      }
    } catch (err) {
      console.error('Error fetching docket summary:', err)
    } finally {
      setDocketSummaryLoading(false)
    }
  }

  // Mobile: pull-to-refresh handler
  const handleRefresh = async () => {
    await Promise.all([
      fetchDiaryForDate(selectedDate),
      fetchDocketSummary(),
    ])
  }

  // Mobile: ensure diary exists before adding entries
  const ensureDiaryExists = async (): Promise<DailyDiary | null> => {
    if (diary) return diary
    const token = getAuthToken()
    const res = await fetch(`${API_URL}/api/diary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId, date: selectedDate }),
    })
    if (res.ok) {
      const newDiary = await res.json()
      setDiary(newDiary)
      return newDiary
    }
    return null
  }

  // Mobile: add activity from sheet
  const addActivityFromSheet = async (data: { description: string; lotId?: string; quantity?: number; unit?: string; notes?: string }) => {
    let currentDiary = diary
    if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
    const token = getAuthToken()
    const res = await fetch(`${API_URL}/api/diary/${currentDiary.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
    if (res.ok) { await fetchTimeline(currentDiary.id); await fetchDiaryForDate(selectedDate) }
    else throw new Error('Failed to add activity')
  }

  // Mobile: add delay from sheet
  const addDelayFromSheet = async (data: { delayType: string; description: string; durationHours?: number; impact?: string; lotId?: string }) => {
    let currentDiary = diary
    if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
    const token = getAuthToken()
    const res = await fetch(`${API_URL}/api/diary/${currentDiary.id}/delays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
    if (res.ok) { await fetchTimeline(currentDiary.id); await fetchDiaryForDate(selectedDate) }
    else throw new Error('Failed to add delay')
  }

  // Mobile: add delivery from sheet
  const addDeliveryFromSheet = async (data: { description: string; supplier?: string; docketNumber?: string; quantity?: number; unit?: string; lotId?: string; notes?: string }) => {
    let currentDiary = diary
    if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
    const token = getAuthToken()
    const res = await fetch(`${API_URL}/api/diary/${currentDiary.id}/deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
    if (res.ok) { await fetchTimeline(currentDiary.id); await fetchDiaryForDate(selectedDate) }
    else throw new Error('Failed to add delivery')
  }

  // Mobile: delete entry from timeline
  const handleDeleteEntry = async (entry: { id: string; type: string }) => {
    if (!diary) return
    const typeToEndpoint: Record<string, string> = {
      activity: 'activities',
      delay: 'delays',
      delivery: 'deliveries',
      event: 'events',
      personnel: 'personnel',
      plant: 'plant',
    }
    const endpoint = typeToEndpoint[entry.type]
    if (!endpoint) return
    const token = getAuthToken()
    const res = await fetch(`${API_URL}/api/diary/${diary.id}/${endpoint}/${entry.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      await fetchTimeline(diary.id)
      await fetchDiaryForDate(selectedDate)
    }
  }

  // Mobile: edit entry — open appropriate sheet pre-filled
  const handleEditEntry = (entry: any) => {
    setEditingEntry(entry)
    setActiveSheet(entry.type === 'personnel' || entry.type === 'plant' ? 'manual' : entry.type)
  }

  // Mobile: add event from sheet
  const addEventFromSheet = async (data: { eventType: string; description: string; notes?: string; lotId?: string }) => {
    let currentDiary = diary
    if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
    const token = getAuthToken()
    const res = await fetch(`${API_URL}/api/diary/${currentDiary.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
    if (res.ok) { await fetchTimeline(currentDiary.id); await fetchDiaryForDate(selectedDate) }
    else throw new Error('Failed to add event')
  }

  // Feature #240: Search diaries by content
  const searchDiaries = async (query: string) => {
    if (!query.trim()) {
      setFilteredDiaries([])
      return
    }
    setSearching(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${projectId}?search=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setFilteredDiaries(data)
      }
    } catch (err) {
      console.error('Error searching diaries:', err)
    } finally {
      setSearching(false)
    }
  }

  // Debounced search - wait 500ms after typing stops
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }
    if (searchQuery.trim()) {
      searchTimerRef.current = setTimeout(() => {
        searchDiaries(searchQuery)
      }, 500)
    } else {
      setFilteredDiaries([])
    }
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    }
  }, [searchQuery])

  // Feature #226: Fetch weather from API and auto-populate
  const fetchWeatherForDate = async (date: string) => {
    if (!projectId) return
    setFetchingWeather(true)
    setWeatherSource(null)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${projectId}/weather/${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
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
      }
    } catch (err) {
      console.error('Error fetching weather:', err)
      // Silently fail - weather is optional
    } finally {
      setFetchingWeather(false)
    }
  }

  const fetchDiaryForDate = async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${projectId}/${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
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
      } else if (res.status === 404) {
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
        // Feature #226: Auto-fetch weather when no diary exists for the date
        fetchWeatherForDate(date)
      }
    } catch (err) {
      console.error('Error fetching diary:', err)
      setError('Failed to fetch diary')
    } finally {
      setLoading(false)
    }
  }

  const createOrUpdateDiary = async () => {
    // Prevent concurrent submissions (double-click protection)
    if (saving) return

    setSaving(true)
    setError(null)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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

      if (res.ok) {
        const data = await res.json()
        setDiary(data)
        setShowNewEntry(true)
        fetchDiaries()
        // Feature #234: Reset auto-save state after manual save
        setHasUnsavedChanges(false)
        setLastAutoSaved(new Date())
        previousWeatherFormRef.current = JSON.stringify(weatherForm)
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to save diary')
      }
    } catch (err) {
      console.error('Error saving diary:', err)
      setError('Failed to save diary')
    } finally {
      setSaving(false)
    }
  }

  const addPersonnel = async () => {
    if (!diary || !personnelForm.name) return
    setSaving(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diary.id}/personnel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: personnelForm.name,
          company: personnelForm.company || undefined,
          role: personnelForm.role || undefined,
          startTime: personnelForm.startTime || undefined,
          finishTime: personnelForm.finishTime || undefined,
          hours: personnelForm.hours ? parseFloat(personnelForm.hours) : undefined,
        }),
      })

      if (res.ok) {
        const personnel = await res.json()
        setDiary({ ...diary, personnel: [...diary.personnel, personnel] })
        setPersonnelForm({ name: '', company: '', role: '', startTime: '', finishTime: '', hours: '' })
      }
    } catch (err) {
      console.error('Error adding personnel:', err)
    } finally {
      setSaving(false)
    }
  }

  const removePersonnel = async (personnelId: string) => {
    if (!diary) return
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diary.id}/personnel/${personnelId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        setDiary({ ...diary, personnel: diary.personnel.filter(p => p.id !== personnelId) })
      }
    } catch (err) {
      console.error('Error removing personnel:', err)
    }
  }

  const copyPersonnelFromPreviousDay = async () => {
    if (!diary || !projectId) return
    setSaving(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${projectId}/${selectedDate}/previous-personnel`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        if (data.personnel && data.personnel.length > 0) {
          // Add each personnel from previous day to current diary
          let addedCount = 0
          for (const person of data.personnel) {
            // Filter out null/undefined values to avoid validation errors
            const cleanPerson: Record<string, unknown> = { name: person.name }
            if (person.company) cleanPerson.company = person.company
            if (person.role) cleanPerson.role = person.role
            if (person.startTime) cleanPerson.startTime = person.startTime
            if (person.finishTime) cleanPerson.finishTime = person.finishTime
            if (person.hours !== null && person.hours !== undefined) cleanPerson.hours = person.hours

            const addRes = await fetch(`${API_URL}/api/diary/${diary.id}/personnel`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(cleanPerson),
            })
            if (addRes.ok) {
              const newPerson = await addRes.json()
              setDiary(prev => prev ? { ...prev, personnel: [...prev.personnel, newPerson] } : null)
              addedCount++
            }
          }
          alert(`Copied ${addedCount} personnel from previous day`)
        } else {
          alert('No personnel found from previous day')
        }
      } else {
        alert('Failed to fetch previous day personnel')
      }
    } catch (err) {
      console.error('Error copying personnel:', err)
      alert('Error copying personnel from previous day')
    } finally {
      setSaving(false)
    }
  }

  const addPlant = async () => {
    if (!diary || !plantForm.description) return
    setSaving(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diary.id}/plant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: plantForm.description,
          idRego: plantForm.idRego || undefined,
          company: plantForm.company || undefined,
          hoursOperated: plantForm.hoursOperated ? parseFloat(plantForm.hoursOperated) : undefined,
          notes: plantForm.notes || undefined,
        }),
      })

      if (res.ok) {
        const plant = await res.json()
        setDiary({ ...diary, plant: [...diary.plant, plant] })
        setPlantForm({ description: '', idRego: '', company: '', hoursOperated: '', notes: '' })
      }
    } catch (err) {
      console.error('Error adding plant:', err)
    } finally {
      setSaving(false)
    }
  }

  const removePlant = async (plantId: string) => {
    if (!diary) return
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diary.id}/plant/${plantId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        setDiary({ ...diary, plant: diary.plant.filter(p => p.id !== plantId) })
      }
    } catch (err) {
      console.error('Error removing plant:', err)
    }
  }

  const addActivity = async () => {
    if (!diary || !activityForm.description) return
    setSaving(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diary.id}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: activityForm.description,
          lotId: activityForm.lotId || undefined,
          quantity: activityForm.quantity ? parseFloat(activityForm.quantity) : undefined,
          unit: activityForm.unit || undefined,
          notes: activityForm.notes || undefined,
        }),
      })

      if (res.ok) {
        const activity = await res.json()
        setDiary({ ...diary, activities: [...diary.activities, activity] })
        setActivityForm({ description: '', lotId: '', quantity: '', unit: '', notes: '' })
      }
    } catch (err) {
      console.error('Error adding activity:', err)
    } finally {
      setSaving(false)
    }
  }

  const removeActivity = async (activityId: string) => {
    if (!diary) return
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diary.id}/activities/${activityId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        setDiary({ ...diary, activities: diary.activities.filter(a => a.id !== activityId) })
      }
    } catch (err) {
      console.error('Error removing activity:', err)
    }
  }

  const addDelay = async () => {
    if (!diary || !delayForm.delayType || !delayForm.description) return
    setSaving(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diary.id}/delays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          delayType: delayForm.delayType,
          startTime: delayForm.startTime || undefined,
          endTime: delayForm.endTime || undefined,
          durationHours: delayForm.durationHours ? parseFloat(delayForm.durationHours) : undefined,
          description: delayForm.description,
          impact: delayForm.impact || undefined,
        }),
      })

      if (res.ok) {
        const delay = await res.json()
        setDiary({ ...diary, delays: [...diary.delays, delay] })
        setDelayForm({ delayType: '', startTime: '', endTime: '', durationHours: '', description: '', impact: '' })
      }
    } catch (err) {
      console.error('Error adding delay:', err)
    } finally {
      setSaving(false)
    }
  }

  const removeDelay = async (delayId: string) => {
    if (!diary) return
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diary.id}/delays/${delayId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        setDiary({ ...diary, delays: diary.delays.filter(d => d.id !== delayId) })
      }
    } catch (err) {
      console.error('Error removing delay:', err)
    }
  }

  // Check for empty sections and generate warnings
  const getSubmitWarnings = (): string[] => {
    if (!diary) return []
    const warnings: string[] = []

    if (!diary.weatherConditions) {
      warnings.push('Weather conditions not recorded')
    }
    if (diary.personnel.length === 0) {
      warnings.push('No personnel recorded')
    }
    if (diary.activities.length === 0) {
      warnings.push('No activities recorded')
    }
    if (!diary.generalNotes && diary.delays.length === 0 && diary.plant.length === 0) {
      warnings.push('No general notes, plant, or delays recorded')
    }

    return warnings
  }

  // Handle submit button click - show warnings if any
  const handleSubmitClick = () => {
    const warnings = getSubmitWarnings()
    setSubmitWarnings(warnings)
    setShowSubmitConfirm(true)
  }

  // Confirm and actually submit the diary
  const confirmSubmitDiary = async () => {
    if (!diary) return

    // Prevent concurrent submissions (double-click protection)
    if (saving) return

    setSaving(true)
    setShowSubmitConfirm(false)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diary.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ acknowledgeWarnings: true }),
      })

      if (res.ok) {
        const data = await res.json()
        setDiary(data)
        fetchDiaries()
      }
    } catch (err) {
      console.error('Error submitting diary:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitDiary = async () => {
    if (!diary) return
    setSaving(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diary.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ acknowledgeWarnings: true }),
      })

      if (res.ok) {
        const data = await res.json()
        setDiary(data)
        fetchDiaries()
      }
    } catch (err) {
      console.error('Error submitting diary:', err)
    } finally {
      setSaving(false)
    }
  }
  // Export for potential use
  void handleSubmitDiary

  // Fetch addendums when diary changes
  const fetchAddendums = async (diaryId: string) => {
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diaryId}/addendums`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setAddendums(data)
      }
    } catch (err) {
      console.error('Error fetching addendums:', err)
    }
  }

  // Add addendum to submitted diary
  const addAddendum = async () => {
    if (!diary || !addendumContent.trim()) return
    setAddingAddendum(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diary.id}/addendum`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: addendumContent.trim() }),
      })

      if (res.ok) {
        const newAddendum = await res.json()
        setAddendums([...addendums, newAddendum])
        setAddendumContent('')
      }
    } catch (err) {
      console.error('Error adding addendum:', err)
    } finally {
      setAddingAddendum(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  // Mobile: derive manual entries from timeline for docket summary display
  const manualEntries = {
    personnel: timeline
      .filter((e: any) => e.type === 'personnel')
      .map((e: any) => ({ id: e.id, name: e.description, hours: e.data?.hours })),
    plant: timeline
      .filter((e: any) => e.type === 'plant')
      .map((e: any) => ({ id: e.id, description: e.description, hoursOperated: e.data?.hoursOperated })),
  }

  // Mobile layout shell
  if (isMobile) {
    return (
      <>
        <DiaryMobileView
          selectedDate={selectedDate}
          lots={lots}
          activeLotId={activeLotId}
          onLotChange={setActiveLotId}
          weather={diary ? {
            conditions: diary.weatherConditions || '',
            temperatureMin: diary.temperatureMin?.toString() || '',
            temperatureMax: diary.temperatureMax?.toString() || '',
            rainfallMm: diary.rainfallMm?.toString() || '',
          } : weatherForm.weatherConditions ? {
            conditions: weatherForm.weatherConditions,
            temperatureMin: weatherForm.temperatureMin,
            temperatureMax: weatherForm.temperatureMax,
            rainfallMm: weatherForm.rainfallMm,
          } : null}
          weatherSource={weatherSource}
          fetchingWeather={fetchingWeather}
          onEditWeather={() => setActiveSheet('weather')}
          diary={diary}
          loading={loading}
          docketSummary={docketSummary}
          docketSummaryLoading={docketSummaryLoading}
          manualEntries={manualEntries}
          onTapPending={(_docketId: string) => {
            // Navigate to the approve tab in the foreman shell
            navigate(`/projects/${projectId}/foreman?tab=approve`)
          }}
          onAddManual={() => setActiveSheet('manual')}
          timeline={timeline}
          onQuickAdd={(type) => setActiveSheet(type === 'plant' ? 'manual' : type)}
          onRefresh={handleRefresh}
          onEditEntry={handleEditEntry}
          onDeleteEntry={handleDeleteEntry}
        />
        {activeSheet === 'activity' && (
          <AddActivitySheet
            isOpen
            onClose={() => { setActiveSheet(null); setEditingEntry(null) }}
            onSave={async (data) => {
              if (editingEntry) { await handleDeleteEntry(editingEntry); setEditingEntry(null) }
              await addActivityFromSheet({ ...data, lotId: data.lotId || activeLotId || undefined })
            }}
            defaultLotId={activeLotId}
            lots={lots}
            initialData={editingEntry?.type === 'activity' ? {
              description: editingEntry.description,
              quantity: editingEntry.data?.quantity,
              unit: editingEntry.data?.unit,
              notes: editingEntry.data?.notes,
              lotId: editingEntry.data?.lotId,
            } : undefined}
          />
        )}
        {activeSheet === 'delay' && (
          <AddDelaySheet
            isOpen
            onClose={() => { setActiveSheet(null); setEditingEntry(null) }}
            onSave={async (data) => {
              if (editingEntry) { await handleDeleteEntry(editingEntry); setEditingEntry(null) }
              await addDelayFromSheet({ ...data, lotId: data.lotId || activeLotId || undefined })
            }}
            defaultLotId={activeLotId}
            lots={lots}
            initialData={editingEntry?.type === 'delay' ? {
              delayType: editingEntry.data?.delayType,
              description: editingEntry.description,
              durationHours: editingEntry.data?.durationHours,
              impact: editingEntry.data?.impact,
              lotId: editingEntry.data?.lotId,
            } : undefined}
          />
        )}
        {activeSheet === 'delivery' && (
          <AddDeliverySheet
            isOpen
            onClose={() => { setActiveSheet(null); setEditingEntry(null) }}
            onSave={async (data) => {
              if (editingEntry) { await handleDeleteEntry(editingEntry); setEditingEntry(null) }
              await addDeliveryFromSheet({ ...data, lotId: data.lotId || activeLotId || undefined })
            }}
            defaultLotId={activeLotId}
            lots={lots}
            initialData={editingEntry?.type === 'delivery' ? {
              description: editingEntry.description,
              supplier: editingEntry.data?.supplier,
              docketNumber: editingEntry.data?.docketNumber,
              quantity: editingEntry.data?.quantity,
              unit: editingEntry.data?.unit,
              lotId: editingEntry.data?.lotId,
              notes: editingEntry.data?.notes,
            } : undefined}
          />
        )}
        {activeSheet === 'event' && (
          <AddEventSheet
            isOpen
            onClose={() => { setActiveSheet(null); setEditingEntry(null) }}
            onSave={async (data) => {
              if (editingEntry) { await handleDeleteEntry(editingEntry); setEditingEntry(null) }
              await addEventFromSheet({ ...data, lotId: data.lotId || activeLotId || undefined })
            }}
            defaultLotId={activeLotId}
            lots={lots}
            initialData={editingEntry?.type === 'event' ? {
              eventType: editingEntry.data?.eventType,
              description: editingEntry.description,
              notes: editingEntry.data?.notes,
              lotId: editingEntry.data?.lotId,
            } : undefined}
          />
        )}
        {activeSheet === 'manual' && (
          <AddManualLabourPlantSheet
            isOpen
            onClose={() => { setActiveSheet(null); setEditingEntry(null) }}
            onSavePersonnel={async (data) => {
              if (editingEntry?.type === 'personnel') { await handleDeleteEntry(editingEntry); setEditingEntry(null) }
              let currentDiary = diary
              if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
              const token = getAuthToken()
              await fetch(`${API_URL}/api/diary/${currentDiary.id}/personnel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...data, source: 'manual', lotId: data.lotId || activeLotId || undefined }),
              })
              await fetchTimeline(currentDiary.id)
              await fetchDiaryForDate(selectedDate)
            }}
            onSavePlant={async (data) => {
              if (editingEntry?.type === 'plant') { await handleDeleteEntry(editingEntry); setEditingEntry(null) }
              let currentDiary = diary
              if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
              const token = getAuthToken()
              await fetch(`${API_URL}/api/diary/${currentDiary.id}/plant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...data, source: 'manual', lotId: data.lotId || activeLotId || undefined }),
              })
              await fetchTimeline(currentDiary.id)
              await fetchDiaryForDate(selectedDate)
            }}
            defaultLotId={activeLotId}
            lots={lots}
          />
        )}
        {activeSheet === 'weather' && (
          <AddWeatherSheet
            isOpen
            onClose={() => { setActiveSheet(null); setEditingEntry(null) }}
            onSave={async (data) => {
              const currentDiary = await ensureDiaryExists()
              if (!currentDiary) return
              const token = getAuthToken()
              const res = await fetch(`${API_URL}/api/diary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  projectId,
                  date: selectedDate,
                  weatherConditions: data.conditions || undefined,
                  temperatureMin: data.temperatureMin ? parseFloat(data.temperatureMin) : undefined,
                  temperatureMax: data.temperatureMax ? parseFloat(data.temperatureMax) : undefined,
                  rainfallMm: data.rainfallMm ? parseFloat(data.rainfallMm) : undefined,
                }),
              })
              if (res.ok) {
                const updated = await res.json()
                setDiary(updated)
                setWeatherForm({
                  weatherConditions: updated.weatherConditions || '',
                  temperatureMin: updated.temperatureMin?.toString() || '',
                  temperatureMax: updated.temperatureMax?.toString() || '',
                  rainfallMm: updated.rainfallMm?.toString() || '',
                  weatherNotes: updated.weatherNotes || '',
                  generalNotes: updated.generalNotes || '',
                })
              }
            }}
            initialData={diary ? {
              conditions: diary.weatherConditions || '',
              temperatureMin: diary.temperatureMin?.toString() || '',
              temperatureMax: diary.temperatureMax?.toString() || '',
              rainfallMm: diary.rainfallMm?.toString() || '',
            } : weatherForm.weatherConditions ? {
              conditions: weatherForm.weatherConditions,
              temperatureMin: weatherForm.temperatureMin,
              temperatureMax: weatherForm.temperatureMax,
              rainfallMm: weatherForm.rainfallMm,
            } : null}
          />
        )}
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Daily Diary</h1>
          <p className="text-muted-foreground">
            Record daily site activities, personnel, plant, and weather.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/projects/${projectId}/delays`}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
          >
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Delay Register
          </Link>
          <button
            onClick={() => {
              setShowNewEntry(true)
              setActiveTab('weather')
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Diary Entry
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Date Selector */}
      <div className="flex items-center gap-4">
        <label htmlFor="diary-date" className="font-medium">Select Date:</label>
        <input
          id="diary-date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="rounded-md border border-input bg-background px-3 py-2"
        />
        {diary && (
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${
            diary.status === 'submitted'
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {diary.status === 'submitted' ? 'Submitted' : 'Draft'}
          </span>
        )}
        {diary?.isLate && (
          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
            Late Entry
          </span>
        )}
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="ml-4 rounded-md bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80"
        >
          {showCalendar ? 'Hide Calendar' : 'View Calendar'}
        </button>
      </div>

      {/* Calendar View */}
      {showCalendar && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={previousMonth}
              className="rounded-md bg-muted px-3 py-1 text-sm hover:bg-muted/80"
            >
              ← Previous
            </button>
            <h3 className="text-lg font-semibold">
              {calendarMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={nextMonth}
              className="rounded-md bg-muted px-3 py-1 text-sm hover:bg-muted/80"
            >
              Next →
            </button>
          </div>

          {/* Calendar Legend */}
          <div className="mb-4 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <span className="h-4 w-4 rounded bg-green-500"></span>
              Submitted
            </span>
            <span className="flex items-center gap-1">
              <span className="h-4 w-4 rounded bg-yellow-500"></span>
              Draft
            </span>
            <span className="flex items-center gap-1">
              <span className="h-4 w-4 rounded bg-red-500"></span>
              Missing
            </span>
          </div>

          {/* Day Headers */}
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-sm font-medium text-muted-foreground">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {getCalendarDays().map((day, index) => (
              <div key={index} className="aspect-square">
                {day.date ? (
                  <button
                    onClick={() => day.status !== 'future' && handleCalendarDayClick(day.date!)}
                    disabled={day.status === 'future'}
                    className={`flex h-full w-full items-center justify-center rounded-md text-sm font-medium transition-colors ${
                      day.status === 'submitted'
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : day.status === 'draft'
                        ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                        : day.status === 'missing'
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    } ${
                      day.date.toISOString().split('T')[0] === selectedDate
                        ? 'ring-2 ring-primary ring-offset-2'
                        : ''
                    }`}
                  >
                    {day.date.getDate()}
                  </button>
                ) : (
                  <div className="h-full w-full"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : showNewEntry || diary ? (
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="border-b">
            <nav className="flex gap-4">
              {(['weather', 'personnel', 'plant', 'activities', 'delays'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                  {diary && tab === 'personnel' && diary.personnel.length > 0 && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                      {diary.personnel.length}
                    </span>
                  )}
                  {diary && tab === 'plant' && diary.plant.length > 0 && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                      {diary.plant.length}
                    </span>
                  )}
                  {diary && tab === 'activities' && diary.activities.length > 0 && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                      {diary.activities.length}
                    </span>
                  )}
                  {diary && tab === 'delays' && diary.delays.length > 0 && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                      {diary.delays.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Weather Tab */}
          {activeTab === 'weather' && (
            <div className="rounded-lg border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold">Weather & General Notes</h3>
                  {/* Feature #234: Auto-save status */}
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
                      • Unsaved changes
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
                      ✓ {weatherSource}
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
                    <label className="mb-1 block text-sm font-medium">Min Temp (°C)</label>
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
                    <label className="mb-1 block text-sm font-medium">Max Temp (°C)</label>
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
                    {/* Feature #288: Voice-to-text for weather notes */}
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
                    {/* Feature #288: Voice-to-text for general notes */}
                    {diary?.status !== 'submitted' && (
                      <VoiceInputButton
                        onTranscript={(text) => {
                          // Append transcribed text to existing HTML content
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
                      dangerouslySetInnerHTML={{ __html: weatherForm.generalNotes || '<span class="text-muted-foreground">No notes</span>' }}
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
                    onClick={createOrUpdateDiary}
                    disabled={saving}
                    className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : diary ? 'Update Weather Info' : 'Create Diary Entry'}
                  </button>
                  <button
                    onClick={() => fetchWeatherForDate(selectedDate)}
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
          )}

          {/* Personnel Tab */}
          {activeTab === 'personnel' && diary && (
            <div className="rounded-lg border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Personnel on Site</h3>
                {diary.status !== 'submitted' && (
                  <button
                    onClick={copyPersonnelFromPreviousDay}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy from Previous Day
                  </button>
                )}
              </div>

              {/* Personnel List */}
              {diary.personnel.length > 0 && (
                <div className="mb-6">
                  {isMobile ? (
                    /* Mobile Card View */
                    <div className="space-y-3">
                      {diary.personnel.map((p) => (
                        <div key={p.id} className="rounded-xl border bg-card p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold">{p.name}</p>
                              <p className="text-sm text-muted-foreground">{p.company || 'No company'} • {p.role || 'No role'}</p>
                            </div>
                            {diary.status !== 'submitted' && (
                              <button
                                onClick={() => removePersonnel(p.id)}
                                className="p-2 text-red-600 hover:text-red-700 touch-manipulation"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <div className="mt-2 flex gap-4 text-sm">
                            <span>{p.startTime || '-'} - {p.finishTime || '-'}</span>
                            <span className="font-medium">{p.hours || 0} hrs</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Desktop Table View */
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b text-left text-sm text-muted-foreground">
                            <th className="pb-2">Name</th>
                            <th className="pb-2">Company</th>
                            <th className="pb-2">Role</th>
                            <th className="pb-2">Start</th>
                            <th className="pb-2">Finish</th>
                            <th className="pb-2">Hours</th>
                            {diary.status !== 'submitted' && <th className="pb-2"></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {diary.personnel.map((p) => (
                            <tr key={p.id} className="border-b">
                              <td className="py-2 font-medium">{p.name}</td>
                              <td className="py-2">{p.company || '-'}</td>
                              <td className="py-2">{p.role || '-'}</td>
                              <td className="py-2">{p.startTime || '-'}</td>
                              <td className="py-2">{p.finishTime || '-'}</td>
                              <td className="py-2">{p.hours || '-'}</td>
                              {diary.status !== 'submitted' && (
                                <td className="py-2">
                                  <button
                                    onClick={() => removePersonnel(p.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Subtotals by Company */}
              {diary.personnel.length > 0 && (
                <div className="mb-6 rounded-lg border bg-muted/30 p-4">
                  <h4 className="mb-3 font-medium">Subtotals by Company</h4>
                  <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {getPersonnelSubtotalsByCompany().map((item) => (
                      <div key={item.company} className="rounded-lg border bg-background p-3">
                        <div className="font-medium">{item.company}</div>
                        <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                          <span>{item.count} {item.count === 1 ? 'person' : 'people'}</span>
                          <span className="font-medium text-foreground">{item.hours.toFixed(1)} hrs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end border-t pt-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total: </span>
                      <span className="font-semibold">{diary.personnel.length} people, </span>
                      <span className="font-semibold">
                        {diary.personnel.reduce((sum, p) => {
                          const hours = typeof p.hours === 'number' ? p.hours : (parseFloat(String(p.hours)) || 0)
                          return sum + hours
                        }, 0).toFixed(1)} hrs
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Personnel Form */}
              {diary.status !== 'submitted' && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h4 className="mb-3 font-medium">Add Personnel</h4>
                  <div className="grid gap-3 md:grid-cols-6">
                    <input
                      type="text"
                      value={personnelForm.name}
                      onChange={(e) => setPersonnelForm({ ...personnelForm, name: e.target.value })}
                      placeholder="Name *"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <input
                      type="text"
                      value={personnelForm.company}
                      onChange={(e) => setPersonnelForm({ ...personnelForm, company: e.target.value })}
                      placeholder="Company"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <input
                      type="text"
                      value={personnelForm.role}
                      onChange={(e) => setPersonnelForm({ ...personnelForm, role: e.target.value })}
                      placeholder="Role"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <input
                      type="time"
                      value={personnelForm.startTime}
                      onChange={(e) => handlePersonnelStartTimeChange(e.target.value)}
                      placeholder="Start"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <input
                      type="time"
                      value={personnelForm.finishTime}
                      onChange={(e) => handlePersonnelFinishTimeChange(e.target.value)}
                      placeholder="Finish"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={personnelForm.hours ? `${personnelForm.hours}h` : ''}
                        readOnly
                        placeholder="Hours"
                        className="w-16 rounded-md border border-input bg-muted px-3 py-2 text-center text-sm"
                      />
                      <button
                        onClick={addPersonnel}
                        disabled={!personnelForm.name || saving}
                        className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Plant Tab */}
          {activeTab === 'plant' && diary && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 text-lg font-semibold">Plant & Equipment</h3>

              {/* Plant List */}
              {diary.plant.length > 0 && (
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-2">Description</th>
                        <th className="pb-2">ID/Rego</th>
                        <th className="pb-2">Company</th>
                        <th className="pb-2">Hours</th>
                        <th className="pb-2">Notes</th>
                        {diary.status !== 'submitted' && <th className="pb-2"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {diary.plant.map((p) => (
                        <tr key={p.id} className="border-b">
                          <td className="py-2 font-medium">{p.description}</td>
                          <td className="py-2">{p.idRego || '-'}</td>
                          <td className="py-2">{p.company || '-'}</td>
                          <td className="py-2">{p.hoursOperated || '-'}</td>
                          <td className="py-2">{p.notes || '-'}</td>
                          {diary.status !== 'submitted' && (
                            <td className="py-2">
                              <button
                                onClick={() => removePlant(p.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Plant Form */}
              {diary.status !== 'submitted' && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h4 className="mb-3 font-medium">Add Plant</h4>
                  <div className="grid gap-3 md:grid-cols-5">
                    <input
                      type="text"
                      value={plantForm.description}
                      onChange={(e) => setPlantForm({ ...plantForm, description: e.target.value })}
                      placeholder="Description *"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <input
                      type="text"
                      value={plantForm.idRego}
                      onChange={(e) => setPlantForm({ ...plantForm, idRego: e.target.value })}
                      placeholder="ID/Rego"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <input
                      type="text"
                      value={plantForm.company}
                      onChange={(e) => setPlantForm({ ...plantForm, company: e.target.value })}
                      placeholder="Company"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <div className="flex flex-col">
                      <input
                        type="number"
                        value={plantForm.hoursOperated}
                        onChange={(e) => setPlantForm({ ...plantForm, hoursOperated: e.target.value })}
                        placeholder="Hours"
                        className={`rounded-md border bg-background px-3 py-2 ${
                          plantHoursValidation.warning ? 'border-amber-500' : 'border-input'
                        }`}
                      />
                      {plantHoursValidation.warning && (
                        <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {plantHoursValidation.warning}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={addPlant}
                      disabled={!plantForm.description || saving}
                      className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activities Tab */}
          {activeTab === 'activities' && diary && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 text-lg font-semibold">Activities</h3>

              {/* Activities List */}
              {diary.activities.length > 0 && (
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-2">Description</th>
                        <th className="pb-2">Lot</th>
                        <th className="pb-2">Quantity</th>
                        <th className="pb-2">Unit</th>
                        <th className="pb-2">Notes</th>
                        {diary.status !== 'submitted' && <th className="pb-2"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {diary.activities.map((a) => (
                        <tr key={a.id} className="border-b">
                          <td className="py-2 font-medium">{a.description}</td>
                          <td className="py-2">
                            {a.lot ? (
                              <Link
                                to={`/projects/${projectId}/lots/${a.lot.id}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                              >
                                {a.lot.lotNumber}
                              </Link>
                            ) : '-'}
                          </td>
                          <td className="py-2">{a.quantity || '-'}</td>
                          <td className="py-2">{a.unit || '-'}</td>
                          <td className="py-2">{a.notes || '-'}</td>
                          {diary.status !== 'submitted' && (
                            <td className="py-2">
                              <button
                                onClick={() => removeActivity(a.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Activity Form */}
              {diary.status !== 'submitted' && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h4 className="mb-3 font-medium">Add Activity</h4>
                  <div className="grid gap-3 md:grid-cols-5">
                    <input
                      type="text"
                      value={activityForm.description}
                      onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                      placeholder="Description *"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <select
                      value={activityForm.lotId}
                      onChange={(e) => setActivityForm({ ...activityForm, lotId: e.target.value })}
                      className="rounded-md border border-input bg-background px-3 py-2"
                    >
                      <option value="">Select Lot...</option>
                      {lots.map((lot) => (
                        <option key={lot.id} value={lot.id}>{lot.lotNumber}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={activityForm.quantity}
                      onChange={(e) => setActivityForm({ ...activityForm, quantity: e.target.value })}
                      placeholder="Quantity"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <input
                      type="text"
                      value={activityForm.unit}
                      onChange={(e) => setActivityForm({ ...activityForm, unit: e.target.value })}
                      placeholder="Unit (m³, m², etc.)"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <button
                      onClick={addActivity}
                      disabled={!activityForm.description || saving}
                      className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delays Tab */}
          {activeTab === 'delays' && diary && (
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 text-lg font-semibold">Delays</h3>

              {/* Delays List */}
              {diary.delays.length > 0 && (
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Description</th>
                        <th className="pb-2">Start</th>
                        <th className="pb-2">End</th>
                        <th className="pb-2">Duration</th>
                        <th className="pb-2">Impact</th>
                        {diary.status !== 'submitted' && <th className="pb-2"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {diary.delays.map((d) => (
                        <tr key={d.id} className="border-b">
                          <td className="py-2">
                            <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                              {d.delayType}
                            </span>
                          </td>
                          <td className="py-2 font-medium">{d.description}</td>
                          <td className="py-2">{d.startTime || '-'}</td>
                          <td className="py-2">{d.endTime || '-'}</td>
                          <td className="py-2">{d.durationHours ? `${d.durationHours}h` : '-'}</td>
                          <td className="py-2">{d.impact || '-'}</td>
                          {diary.status !== 'submitted' && (
                            <td className="py-2">
                              <button
                                onClick={() => removeDelay(d.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Delay Form */}
              {diary.status !== 'submitted' && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h4 className="mb-3 font-medium">Add Delay</h4>
                  <div className="grid gap-3 md:grid-cols-3">
                    <select
                      value={delayForm.delayType}
                      onChange={(e) => setDelayForm({ ...delayForm, delayType: e.target.value })}
                      className="rounded-md border border-input bg-background px-3 py-2"
                    >
                      <option value="">Delay Type *</option>
                      {DELAY_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={delayForm.description}
                      onChange={(e) => setDelayForm({ ...delayForm, description: e.target.value })}
                      placeholder="Description *"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <div className="flex flex-col">
                      <input
                        type="number"
                        value={delayForm.durationHours}
                        onChange={(e) => setDelayForm({ ...delayForm, durationHours: e.target.value })}
                        placeholder="Duration (hours)"
                        className={`rounded-md border bg-background px-3 py-2 ${
                          delayHoursValidation.warning ? 'border-amber-500' : 'border-input'
                        }`}
                      />
                      {delayHoursValidation.warning && (
                        <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {delayHoursValidation.warning}
                        </p>
                      )}
                    </div>
                    <input
                      type="time"
                      value={delayForm.startTime}
                      onChange={(e) => setDelayForm({ ...delayForm, startTime: e.target.value })}
                      placeholder="Start Time"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <input
                      type="time"
                      value={delayForm.endTime}
                      onChange={(e) => setDelayForm({ ...delayForm, endTime: e.target.value })}
                      placeholder="End Time"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
                    <button
                      onClick={addDelay}
                      disabled={!delayForm.delayType || !delayForm.description || saving}
                      className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Button & Print Button */}
          {diary && (
            <div className="flex justify-end gap-4">
              {/* Print Button - Always show if diary exists */}
              <button
                onClick={async () => {
                  try {
                    // Fetch project info for PDF
                    const token = getAuthToken()
                    const projectRes = await fetch(`${API_URL}/api/projects/${projectId}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    })
                    const project = projectRes.ok ? await projectRes.json() : { name: 'Unknown Project', projectNumber: '' }

                    // Build PDF data
                    const pdfData: DailyDiaryPDFData = {
                      diary: {
                        id: diary.id,
                        date: diary.date,
                        status: diary.status,
                        weatherConditions: diary.weatherConditions,
                        temperatureMin: diary.temperatureMin,
                        temperatureMax: diary.temperatureMax,
                        rainfallMm: diary.rainfallMm,
                        weatherNotes: diary.weatherNotes,
                        generalNotes: diary.generalNotes,
                        isLate: diary.isLate,
                        submittedBy: diary.submittedBy,
                        submittedAt: diary.submittedAt,
                        createdAt: diary.createdAt,
                        updatedAt: diary.updatedAt
                      },
                      project: {
                        name: project.name || 'Unknown Project',
                        projectNumber: project.projectNumber || null
                      },
                      personnel: diary.personnel.map(p => ({
                        id: p.id,
                        name: p.name,
                        company: p.company,
                        role: p.role,
                        startTime: p.startTime,
                        finishTime: p.finishTime,
                        hours: p.hours
                      })),
                      plant: diary.plant.map(p => ({
                        id: p.id,
                        description: p.description,
                        idRego: p.idRego,
                        company: p.company,
                        hoursOperated: p.hoursOperated,
                        notes: p.notes
                      })),
                      activities: diary.activities.map(a => ({
                        id: a.id,
                        description: a.description,
                        lot: a.lot ? { lotNumber: a.lot.lotNumber } : null,
                        quantity: a.quantity,
                        unit: a.unit,
                        notes: a.notes
                      })),
                      delays: diary.delays.map(d => ({
                        id: d.id,
                        delayType: d.delayType,
                        description: d.description,
                        startTime: d.startTime,
                        endTime: d.endTime,
                        durationHours: d.durationHours,
                        impact: d.impact
                      })),
                      addendums: addendums.map(a => ({
                        id: a.id,
                        content: a.content,
                        addedBy: a.addedBy,
                        addedAt: a.addedAt
                      }))
                    }

                    generateDailyDiaryPDF(pdfData)
                    toast({ title: 'Daily diary PDF downloaded', variant: 'success' })
                  } catch (err) {
                    console.error('Error generating diary PDF:', err)
                    toast({ title: 'Failed to generate PDF', variant: 'error' })
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
                title="Print daily diary"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>

              {/* Submit Button - Only for draft */}
              {diary.status === 'draft' && (
                <button
                  onClick={handleSubmitClick}
                  disabled={saving}
                  className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Submitting...' : 'Submit Diary'}
                </button>
              )}
            </div>
          )}

          {/* Submit Confirmation Modal */}
          {showSubmitConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <h3 className="text-lg font-semibold mb-4">Submit Daily Diary?</h3>

                {submitWarnings.length > 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="font-medium text-yellow-800 mb-2">⚠️ Warnings:</p>
                    <ul className="list-disc pl-5 text-sm text-yellow-700 space-y-1">
                      {submitWarnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-muted-foreground mb-4">
                  {submitWarnings.length > 0
                    ? 'Do you want to submit the diary with the above warnings?'
                    : 'Once submitted, this diary entry cannot be edited.'}
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    className="px-4 py-2 rounded-lg border hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmSubmitDiary}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                  >
                    Confirm Submit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Submitted Info */}
          {diary && diary.status === 'submitted' && diary.submittedBy && (
            <div className="rounded-lg border bg-green-50 p-4 text-green-800">
              <p>
                <strong>Submitted</strong> by {diary.submittedBy.fullName} on{' '}
                {diary.submittedAt && new Date(diary.submittedAt).toLocaleString('en-AU')}
                {diary.isLate && <span className="ml-2 text-orange-600">(Late Entry)</span>}
              </p>
            </div>
          )}

          {/* Addendums Section - Only for submitted diaries */}
          {diary && diary.status === 'submitted' && (
            <div className="rounded-lg border bg-card p-6 mt-4">
              <h3 className="text-lg font-semibold mb-4">Addendums</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Addendums allow you to add notes to a submitted diary without modifying the original record.
              </p>

              {/* Existing Addendums */}
              {addendums.length > 0 && (
                <div className="space-y-3 mb-6">
                  {addendums.map((addendum) => (
                    <div key={addendum.id} className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm whitespace-pre-wrap">{addendum.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Added by {addendum.addedBy.fullName} on{' '}
                        {new Date(addendum.addedAt).toLocaleString('en-AU')}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {addendums.length === 0 && (
                <p className="text-sm text-muted-foreground mb-4">No addendums added yet.</p>
              )}

              {/* Add Addendum Form */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Add Addendum</label>
                <textarea
                  value={addendumContent}
                  onChange={(e) => setAddendumContent(e.target.value)}
                  placeholder="Enter addendum notes..."
                  className="w-full rounded-lg border bg-background px-4 py-2 text-sm min-h-[100px]"
                />
                <button
                  onClick={addAddendum}
                  disabled={!addendumContent.trim() || addingAddendum}
                  className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {addingAddendum ? 'Adding...' : 'Add Addendum'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium">No diary entry for {formatDate(selectedDate)}</h3>
          <p className="mt-2 text-muted-foreground">
            Click "New Diary Entry" to create one, or select a different date.
          </p>
          <button
            onClick={() => {
              setShowNewEntry(true)
              setActiveTab('weather')
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Diary Entry
          </button>
        </div>
      )}

      {/* Recent Diaries List */}
      {diaries.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Diary Entries</h3>
            {/* Feature #240: Search input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search diaries..."
                className="w-64 rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
              />
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searching && (
                <div className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
            </div>
          </div>

          {/* Search Results */}
          {searchQuery.trim() && filteredDiaries.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">
                Found {filteredDiaries.length} diary {filteredDiaries.length === 1 ? 'entry' : 'entries'} matching "{searchQuery}"
              </p>
              <div className="space-y-2 border-l-2 border-primary pl-4">
                {filteredDiaries.slice(0, 10).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSelectedDate(d.date.split('T')[0])
                      setSearchQuery('')
                      setFilteredDiaries([])
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                      d.date.split('T')[0] === selectedDate ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div>
                      <span className="font-medium">{formatDate(d.date)}</span>
                      {d.weatherConditions && (
                        <span className="ml-2 text-muted-foreground">- {d.weatherConditions}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        d.status === 'submitted'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {d.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchQuery.trim() && filteredDiaries.length === 0 && !searching && (
            <div className="mb-4 text-sm text-muted-foreground">
              No diaries found matching "{searchQuery}"
            </div>
          )}

          {/* Recent Diaries */}
          {!searchQuery.trim() && (
            <div className="space-y-2">
              {diaries.slice(0, 10).map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDate(d.date.split('T')[0])}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                  d.date.split('T')[0] === selectedDate ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <div>
                  <span className="font-medium">{formatDate(d.date)}</span>
                  {d.weatherConditions && (
                    <span className="ml-2 text-muted-foreground">- {d.weatherConditions}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    d.status === 'submitted'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {d.status}
                  </span>
                  {d.personnel.length > 0 && (
                    <span className="text-xs text-muted-foreground">{d.personnel.length} personnel</span>
                  )}
                </div>
              </button>
            ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
