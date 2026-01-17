import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAuthToken } from '../../lib/auth'

interface Personnel {
  id: string
  name: string
  company?: string
  role?: string
  startTime?: string
  finishTime?: string
  hours?: number
}

interface Plant {
  id: string
  description: string
  idRego?: string
  company?: string
  hoursOperated?: number
  notes?: string
}

interface Activity {
  id: string
  description: string
  lotId?: string
  lot?: { id: string; lotNumber: string }
  quantity?: number
  unit?: string
  notes?: string
}

interface Delay {
  id: string
  delayType: string
  startTime?: string
  endTime?: string
  durationHours?: number
  description: string
  impact?: string
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
  submittedBy?: { id: string; name: string; email: string }
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
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [diary, setDiary] = useState<DailyDiary | null>(null)
  const [diaries, setDiaries] = useState<DailyDiary[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [activeTab, setActiveTab] = useState<'weather' | 'personnel' | 'plant' | 'activities' | 'delays'>('weather')
  const [error, setError] = useState<string | null>(null)

  // Addendum state
  const [addendums, setAddendums] = useState<Addendum[]>([])
  const [addendumContent, setAddendumContent] = useState('')
  const [addingAddendum, setAddingAddendum] = useState(false)

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
        setShowNewEntry(false)
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
        headers: { Authorization: `Bearer ${token}` },
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

  const submitDiary = async () => {
    if (!diary) return
    setSaving(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_URL}/api/diary/${diary.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Daily Diary</h1>
          <p className="text-muted-foreground">
            Record daily site activities, personnel, plant, and weather.
          </p>
        </div>
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
      </div>

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
              <h3 className="mb-4 text-lg font-semibold">Weather & General Notes</h3>
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
                  <input
                    type="text"
                    value={weatherForm.weatherNotes}
                    onChange={(e) => setWeatherForm({ ...weatherForm, weatherNotes: e.target.value })}
                    disabled={diary?.status === 'submitted'}
                    placeholder="Additional weather notes..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">General Notes</label>
                  <textarea
                    value={weatherForm.generalNotes}
                    onChange={(e) => setWeatherForm({ ...weatherForm, generalNotes: e.target.value })}
                    disabled={diary?.status === 'submitted'}
                    placeholder="General site notes for the day..."
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  />
                </div>
              </div>
              {diary?.status !== 'submitted' && (
                <div className="mt-4">
                  <button
                    onClick={createOrUpdateDiary}
                    disabled={saving}
                    className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : diary ? 'Update Weather Info' : 'Create Diary Entry'}
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
                <div className="mb-6 overflow-x-auto">
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
                    <input
                      type="number"
                      value={plantForm.hoursOperated}
                      onChange={(e) => setPlantForm({ ...plantForm, hoursOperated: e.target.value })}
                      placeholder="Hours"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
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
                    <input
                      type="number"
                      value={delayForm.durationHours}
                      onChange={(e) => setDelayForm({ ...delayForm, durationHours: e.target.value })}
                      placeholder="Duration (hours)"
                      className="rounded-md border border-input bg-background px-3 py-2"
                    />
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

          {/* Submit Button */}
          {diary && diary.status === 'draft' && (
            <div className="flex justify-end gap-4">
              <button
                onClick={handleSubmitClick}
                disabled={saving}
                className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Submitting...' : 'Submit Diary'}
              </button>
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
                <strong>Submitted</strong> by {diary.submittedBy.name} on{' '}
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
          <h3 className="mb-4 text-lg font-semibold">Recent Diary Entries</h3>
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
        </div>
      )}
    </div>
  )
}
