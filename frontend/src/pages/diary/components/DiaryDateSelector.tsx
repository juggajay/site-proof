import React, { useState, useEffect, useRef, useMemo } from 'react'
import { apiFetch } from '@/lib/api'
import { formatDate } from '../constants'
import type { DailyDiary } from '../types'

interface DiaryDateSelectorProps {
  projectId: string
  selectedDate: string
  onDateChange: (date: string) => void
  diaries: DailyDiary[]
  diary: DailyDiary | null
}

export const DiaryDateSelector = React.memo(function DiaryDateSelector({
  projectId,
  selectedDate,
  onDateChange,
  diaries,
  diary,
}: DiaryDateSelectorProps) {
  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredDiaries, setFilteredDiaries] = useState<DailyDiary[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function to get diary status for a date
  const getDiaryStatusForDate = (date: Date): 'submitted' | 'draft' | 'missing' | 'future' => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)

    if (checkDate > today) return 'future'

    const dateStr = date.toISOString().split('T')[0]
    const d = diaries.find(d => d.date.split('T')[0] === dateStr)
    if (d) return d.status
    return 'missing'
  }

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: Array<{ date: Date | null; status?: 'submitted' | 'draft' | 'missing' | 'future' }> = []

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: null })
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      days.push({
        date,
        status: getDiaryStatusForDate(date)
      })
    }

    return days
  }, [calendarMonth, diaries])

  const previousMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
  }

  const handleCalendarDayClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    onDateChange(dateStr)
    setShowCalendar(false)
  }

  // Search diaries by content
  const searchDiaries = async (query: string) => {
    if (!query.trim()) {
      setFilteredDiaries([])
      return
    }
    setSearching(true)
    try {
      const data = await apiFetch<DailyDiary[]>(`/api/diary/${projectId}?search=${encodeURIComponent(query)}`)
      setFilteredDiaries(data)
    } catch (err) {
      console.error('Error searching diaries:', err)
    } finally {
      setSearching(false)
    }
  }

  // Debounced search
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

  return (
    <>
      {/* Date Selector */}
      <div className="flex items-center gap-4">
        <label htmlFor="diary-date" className="font-medium">Select Date:</label>
        <input
          id="diary-date"
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
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
              &larr; Previous
            </button>
            <h3 className="text-lg font-semibold">
              {calendarMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={nextMonth}
              className="rounded-md bg-muted px-3 py-1 text-sm hover:bg-muted/80"
            >
              Next &rarr;
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
            {calendarDays.map((day, index) => (
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

      {/* Recent Diaries List */}
      {diaries.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Diary Entries</h3>
            {/* Search input */}
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
                      onDateChange(d.date.split('T')[0])
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
                onClick={() => onDateChange(d.date.split('T')[0])}
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
    </>
  )
})
