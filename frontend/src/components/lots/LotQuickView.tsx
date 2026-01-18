import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuthToken } from '@/lib/auth'
import {
  MapPin,
  Layers,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Image,
  ExternalLink,
  Clock
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface LotQuickViewProps {
  lotId: string
  projectId: string
  onClose: () => void
  position: { x: number; y: number }
}

interface LotDetails {
  id: string
  lotNumber: string
  description: string | null
  status: string
  activityType: string | null
  chainageStart: number | null
  chainageEnd: number | null
  layer: string | null
  areaZone: string | null
  createdAt: string
  updatedAt: string
  itpInstance?: { id: string } | null
  _count?: {
    testResults: number
    ncrLots: number
    documents: number
  }
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  conformed: 'bg-green-200 text-green-900',
  on_hold: 'bg-red-100 text-red-800',
  claimed: 'bg-purple-100 text-purple-800',
}

export function LotQuickView({ lotId, projectId, onClose, position }: LotQuickViewProps) {
  const navigate = useNavigate()
  const [lot, setLot] = useState<LotDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchLotDetails() {
      try {
        const token = getAuthToken()
        const response = await fetch(`${API_URL}/api/lots/${lotId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (cancelled) return

        if (response.ok) {
          const data = await response.json()
          setLot(data.lot)
        } else {
          setError('Failed to load lot details')
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching lot details:', err)
          setError('Failed to load lot details')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchLotDetails()

    return () => {
      cancelled = true
    }
  }, [lotId])

  const handleViewDetails = () => {
    navigate(`/projects/${projectId}/lots/${lotId}`)
    onClose()
  }

  // Calculate position to keep popup in viewport
  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 320),
    top: Math.min(position.y + 10, window.innerHeight - 320),
    zIndex: 50,
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatChainage = (start: number | null, end: number | null) => {
    if (start === null && end === null) return '—'
    if (start !== null && end !== null) {
      return `${start.toFixed(3)} - ${end.toFixed(3)}`
    }
    return start !== null ? start.toFixed(3) : end?.toFixed(3) || '—'
  }

  return (
    <div
      className="w-80 bg-card border rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-200"
      style={popupStyle}
      onMouseLeave={onClose}
    >
      {loading ? (
        <div className="p-4 flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div className="p-4 text-sm text-red-600">{error}</div>
      ) : lot ? (
        <>
          {/* Header */}
          <div className="p-3 border-b bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-sm">{lot.lotNumber}</h4>
                {lot.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {lot.description}
                  </p>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[lot.status] || 'bg-gray-100'}`}>
                {lot.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="p-3 space-y-2">
            {/* Activity & Location */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {lot.activityType && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" />
                  <span className="capitalize">{lot.activityType}</span>
                </div>
              )}
              {(lot.chainageStart || lot.chainageEnd) && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{formatChainage(lot.chainageStart, lot.chainageEnd)}</span>
                </div>
              )}
              {lot.layer && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Layer: {lot.layer}</span>
                </div>
              )}
              {lot.areaZone && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{lot.areaZone}</span>
                </div>
              )}
            </div>

            {/* Counts */}
            {(lot._count || lot.itpInstance) && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <div className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded">
                  <CheckCircle2 className={`h-3 w-3 ${lot.itpInstance ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <span>{lot.itpInstance ? '1 ITP' : 'No ITP'}</span>
                </div>
                {lot._count && (
                  <>
                    <div className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded">
                      <FileText className="h-3 w-3 text-blue-600" />
                      <span>{lot._count.testResults} Tests</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded">
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                      <span>{lot._count.ncrLots} NCRs</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded">
                      <Image className="h-3 w-3 text-purple-600" />
                      <span>{lot._count.documents} Docs</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Dates */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Created: {formatDate(lot.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Updated: {formatDate(lot.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-2 border-t bg-muted/20">
            <button
              onClick={handleViewDetails}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Full Details
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
