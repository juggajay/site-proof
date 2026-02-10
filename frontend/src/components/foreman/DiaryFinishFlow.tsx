// DiaryFinishFlow - End-of-day diary completion in under 60 seconds
// Research-backed: Foremen finalise diary at end-of-day with quick review of auto-filled data
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Check,
  Cloud,
  Users,
  Truck,
  FileText,
  AlertTriangle,
  Edit2,
  X,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch, ApiError } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface DiaryDraft {
  id: string
  date: string
  weather: {
    conditions: string
    tempMin: number
    tempMax: number
    rainfall: number
  } | null
  personnel: Array<{ name: string; hours: number; trade: string }>
  plant: Array<{ description: string; hours: number }>
  activities: string[]
  delays: Array<{ reason: string; hours: number }>
  isComplete: boolean
}

interface DiaryFinishFlowProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: () => void
}

export function DiaryFinishFlow({ isOpen, onClose, onSubmit }: DiaryFinishFlowProps) {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [diary, setDiary] = useState<DiaryDraft | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch today's diary draft with auto-filled data
  const fetchDiary = useCallback(async () => {
    if (!projectId) {
      setLoading(false)
      return
    }

    setError(null)
    try {
      const today = new Date().toISOString().split('T')[0]
      const data = await apiFetch<DiaryDraft>(
        `/api/projects/${projectId}/diary/draft?date=${today}`
      )
      setDiary(data)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // No diary for today - that's ok
        setDiary(null)
      } else {
        console.error('Error fetching diary:', err)
        setError('Unable to load diary')
      }
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      fetchDiary()
    }
  }, [isOpen, fetchDiary])

  const handleSubmit = async () => {
    if (!diary || !projectId) return

    setSubmitting(true)
    try {
      await apiFetch(
        `/api/projects/${projectId}/diary/${diary.id}/submit`,
        { method: 'POST' }
      )

      toast({ description: 'Diary submitted', variant: 'success' })
      onSubmit?.()
      onClose()
    } catch (err) {
      console.error('Submit error:', err)
      toast({ description: 'Failed to submit diary', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSection = (section: string) => {
    navigate(`/projects/${projectId}/diary?section=${section}`)
    onClose()
  }

  if (!isOpen) return null

  // Get today's date for display
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div
        className="w-full bg-background rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ animation: 'slideUp 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">Finish Diary</h2>
            <p className="text-sm text-muted-foreground">{today}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground touch-manipulation min-h-[44px] min-w-[44px]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <p className="text-muted-foreground">{error}</p>
              <button
                onClick={() => { setLoading(true); fetchDiary() }}
                className="mt-4 px-4 py-2 text-primary underline"
              >
                Try again
              </button>
            </div>
          ) : diary ? (
            <div className="p-4 space-y-4 pb-32">
              {/* Weather (auto-filled) */}
              <SectionCard
                icon={Cloud}
                title="Weather"
                status={diary.weather ? 'auto' : 'missing'}
                onEdit={() => handleEditSection('weather')}
              >
                {diary.weather ? (
                  <p className="text-sm">
                    {diary.weather.conditions} • {diary.weather.tempMin}°-{diary.weather.tempMax}°C
                    {diary.weather.rainfall > 0 && ` • ${diary.weather.rainfall}mm rain`}
                  </p>
                ) : (
                  <p className="text-sm text-amber-600">Weather not recorded</p>
                )}
              </SectionCard>

              {/* Personnel */}
              <SectionCard
                icon={Users}
                title="Personnel"
                status={diary.personnel.length > 0 ? 'complete' : 'missing'}
                onEdit={() => handleEditSection('personnel')}
              >
                {diary.personnel.length > 0 ? (
                  <p className="text-sm">
                    {diary.personnel.length} worker{diary.personnel.length !== 1 ? 's' : ''} •{' '}
                    {diary.personnel.reduce((sum, p) => sum + p.hours, 0)} total hours
                  </p>
                ) : (
                  <p className="text-sm text-amber-600">No personnel recorded</p>
                )}
              </SectionCard>

              {/* Plant */}
              <SectionCard
                icon={Truck}
                title="Plant & Equipment"
                status={diary.plant.length > 0 ? 'complete' : 'optional'}
                onEdit={() => handleEditSection('plant')}
              >
                {diary.plant.length > 0 ? (
                  <p className="text-sm">
                    {diary.plant.length} item{diary.plant.length !== 1 ? 's' : ''} •{' '}
                    {diary.plant.reduce((sum, p) => sum + p.hours, 0)} total hours
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">None recorded</p>
                )}
              </SectionCard>

              {/* Activities */}
              <SectionCard
                icon={FileText}
                title="Activities"
                status={diary.activities.length > 0 ? 'complete' : 'missing'}
                onEdit={() => handleEditSection('activities')}
              >
                {diary.activities.length > 0 ? (
                  <ul className="text-sm space-y-1">
                    {diary.activities.slice(0, 3).map((act, i) => (
                      <li key={i} className="truncate">• {act}</li>
                    ))}
                    {diary.activities.length > 3 && (
                      <li className="text-muted-foreground">
                        +{diary.activities.length - 3} more
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-amber-600">No activities recorded</p>
                )}
              </SectionCard>

              {/* Delays */}
              {diary.delays.length > 0 && (
                <SectionCard
                  icon={AlertTriangle}
                  title="Delays"
                  status="complete"
                  onEdit={() => handleEditSection('delays')}
                >
                  <p className="text-sm text-amber-600">
                    {diary.delays.length} delay{diary.delays.length !== 1 ? 's' : ''} •{' '}
                    {diary.delays.reduce((sum, d) => sum + d.hours, 0)} hours lost
                  </p>
                </SectionCard>
              )}
            </div>
          ) : (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No diary entry for today</p>
              <button
                onClick={() => {
                  navigate(`/projects/${projectId}/diary`)
                  onClose()
                }}
                className="px-6 py-3 bg-primary text-white rounded-lg font-medium touch-manipulation min-h-[48px]"
              >
                Start Diary
              </button>
            </div>
          )}
        </div>

        {/* Submit Button (fixed at bottom) */}
        {diary && !loading && !error && (
          <div className="sticky bottom-0 p-4 bg-background border-t flex-shrink-0">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={cn(
                'w-full py-4 rounded-lg font-semibold text-white',
                'bg-green-600 active:bg-green-700',
                'touch-manipulation min-h-[56px]',
                'flex items-center justify-center gap-2',
                submitting && 'opacity-50'
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Submit Diary
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

interface SectionCardProps {
  icon: typeof Cloud
  title: string
  status: 'auto' | 'complete' | 'missing' | 'optional'
  onEdit: () => void
  children: React.ReactNode
}

function SectionCard({ icon: Icon, title, status, onEdit, children }: SectionCardProps) {
  const statusConfig = {
    auto: { color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', label: 'Auto-filled' },
    complete: { color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', label: 'Complete' },
    missing: { color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Missing' },
    optional: { color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800', label: 'Optional' },
  }

  const config = statusConfig[status]

  return (
    <div className={cn(
      'rounded-lg border p-4',
      status === 'missing' && 'border-amber-300 dark:border-amber-700'
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', config.color)} />
          <h3 className="font-medium">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs px-2 py-0.5 rounded-full', config.bg, config.color)}>
            {config.label}
          </span>
          <button
            onClick={onEdit}
            className="p-1.5 text-muted-foreground hover:text-foreground touch-manipulation min-h-[32px] min-w-[32px]"
            aria-label={`Edit ${title}`}
          >
            <Edit2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

export default DiaryFinishFlow
