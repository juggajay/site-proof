import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getAuthToken } from '@/lib/auth'

interface HoldPoint {
  id: string
  lotId: string
  lotNumber: string
  itpChecklistItemId: string
  description: string
  pointType: string
  status: string
  notificationSentAt: string | null
  scheduledDate: string | null
  releasedAt: string | null
  releasedByName: string | null
  releaseNotes: string | null
  sequenceNumber: number
  isCompleted: boolean
  isVerified: boolean
  createdAt: string
}

interface PrerequisiteItem {
  id: string
  description: string
  sequenceNumber: number
  isHoldPoint: boolean
  isCompleted: boolean
  isVerified: boolean
  completedAt: string | null
}

interface HoldPointDetails {
  holdPoint: HoldPoint
  prerequisites: PrerequisiteItem[]
  incompletePrerequisites: PrerequisiteItem[]
  canRequestRelease: boolean
}

export function HoldPointsPage() {
  const { projectId } = useParams()
  const [holdPoints, setHoldPoints] = useState<HoldPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [selectedHoldPoint, setSelectedHoldPoint] = useState<HoldPoint | null>(null)
  const [holdPointDetails, setHoldPointDetails] = useState<HoldPointDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState<{message: string, incompleteItems?: PrerequisiteItem[]} | null>(null)

  const token = getAuthToken()
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    async function fetchHoldPoints() {
      if (!projectId || !token) return

      try {
        const response = await fetch(`${apiUrl}/api/holdpoints/project/${projectId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setHoldPoints(data.holdPoints || [])
        }
      } catch (err) {
        console.error('Failed to fetch hold points:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchHoldPoints()
  }, [projectId, token, apiUrl])

  const fetchHoldPointDetails = async (hp: HoldPoint) => {
    setLoadingDetails(true)
    setRequestError(null)
    try {
      const response = await fetch(
        `${apiUrl}/api/holdpoints/lot/${hp.lotId}/item/${hp.itpChecklistItemId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setHoldPointDetails(data)
      }
    } catch (err) {
      console.error('Failed to fetch hold point details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleRequestRelease = (hp: HoldPoint) => {
    setSelectedHoldPoint(hp)
    setShowRequestModal(true)
    fetchHoldPointDetails(hp)
  }

  const handleSubmitRequest = async (scheduledDate: string, scheduledTime: string, notificationSentTo: string) => {
    if (!selectedHoldPoint || !token) return

    setRequesting(true)
    setRequestError(null)

    try {
      const response = await fetch(`${apiUrl}/api/holdpoints/request-release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lotId: selectedHoldPoint.lotId,
          itpChecklistItemId: selectedHoldPoint.itpChecklistItemId,
          scheduledDate: scheduledDate || null,
          scheduledTime: scheduledTime || null,
          notificationSentTo: notificationSentTo || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.incompleteItems) {
          setRequestError({
            message: data.message,
            incompleteItems: data.incompleteItems
          })
        } else {
          setRequestError({ message: data.error || 'Failed to request release' })
        }
        return
      }

      // Success - refresh hold points
      const refreshResponse = await fetch(`${apiUrl}/api/holdpoints/project/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        setHoldPoints(refreshData.holdPoints || [])
      }

      setShowRequestModal(false)
      setSelectedHoldPoint(null)
      setHoldPointDetails(null)
    } catch (err) {
      console.error('Failed to request release:', err)
      setRequestError({ message: 'Network error. Please try again.' })
    } finally {
      setRequesting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800',
      notified: 'bg-amber-100 text-amber-800',
      released: 'bg-green-100 text-green-800',
    }
    return styles[status] || styles.pending
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pending',
      notified: 'Awaiting Release',
      released: 'Released',
    }
    return labels[status] || status
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hold Points</h1>
          <p className="text-muted-foreground mt-1">
            Track and release hold points requiring third-party inspection
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : holdPoints.length === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h3 className="text-lg font-semibold mb-2">No Hold Points</h3>
          <p className="text-muted-foreground mb-4">
            Hold points are created when ITPs with hold point items are assigned to lots.
            Create an ITP template with hold point items and assign it to a lot to see hold points here.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Lot</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Scheduled</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Released</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {holdPoints.map((hp) => (
                <tr key={hp.id} className="hover:bg-muted/25">
                  <td className="px-4 py-3 font-medium">{hp.lotNumber}</td>
                  <td className="px-4 py-3">
                    <div className="max-w-md truncate">{hp.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(hp.status)}`}>
                      {getStatusLabel(hp.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {hp.scheduledDate
                      ? new Date(hp.scheduledDate).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {hp.releasedAt ? (
                      <div>
                        <div>{new Date(hp.releasedAt).toLocaleDateString()}</div>
                        {hp.releasedByName && (
                          <div className="text-xs text-muted-foreground">{hp.releasedByName}</div>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {hp.status === 'pending' && (
                      <button
                        onClick={() => handleRequestRelease(hp)}
                        className="text-sm text-primary hover:underline"
                      >
                        Request Release
                      </button>
                    )}
                    {hp.status === 'notified' && (
                      <span className="text-sm text-amber-600">Awaiting...</span>
                    )}
                    {hp.status === 'released' && (
                      <span className="text-sm text-green-600">✓ Released</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Request Release Modal */}
      {showRequestModal && selectedHoldPoint && (
        <RequestReleaseModal
          holdPoint={selectedHoldPoint}
          details={holdPointDetails}
          loading={loadingDetails}
          requesting={requesting}
          error={requestError}
          onClose={() => {
            setShowRequestModal(false)
            setSelectedHoldPoint(null)
            setHoldPointDetails(null)
            setRequestError(null)
          }}
          onSubmit={handleSubmitRequest}
        />
      )}
    </div>
  )
}

function RequestReleaseModal({
  holdPoint,
  details,
  loading,
  requesting,
  error,
  onClose,
  onSubmit,
}: {
  holdPoint: HoldPoint
  details: HoldPointDetails | null
  loading: boolean
  requesting: boolean
  error: { message: string; incompleteItems?: PrerequisiteItem[] } | null
  onClose: () => void
  onSubmit: (scheduledDate: string, scheduledTime: string, notificationSentTo: string) => void
}) {
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [notificationSentTo, setNotificationSentTo] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(scheduledDate, scheduledTime, notificationSentTo)
  }

  const canSubmit = details?.canRequestRelease && !requesting

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Request Hold Point Release</h2>

        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">Lot</div>
          <div className="font-medium">{holdPoint.lotNumber}</div>
          <div className="text-sm text-muted-foreground mt-2">Hold Point</div>
          <div className="font-medium">{holdPoint.description}</div>
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Prerequisites Section */}
            {details && details.prerequisites.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Prerequisites</h3>
                <div className="space-y-2">
                  {details.prerequisites.map((prereq) => (
                    <div
                      key={prereq.id}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        prereq.isCompleted
                          ? 'bg-green-50 text-green-800'
                          : 'bg-red-50 text-red-800'
                      }`}
                    >
                      <span className="text-lg">
                        {prereq.isCompleted ? '✓' : '✗'}
                      </span>
                      <span className="flex-1">
                        {prereq.sequenceNumber}. {prereq.description}
                        {prereq.isHoldPoint && (
                          <span className="ml-2 text-xs px-1 bg-amber-200 rounded">HP</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error / Block Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-xl">⚠️</span>
                  <div>
                    <div className="font-medium text-red-800">{error.message}</div>
                    {error.incompleteItems && error.incompleteItems.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm text-red-700 mb-1">Missing prerequisites:</div>
                        <ul className="text-sm text-red-600 list-disc list-inside">
                          {error.incompleteItems.map((item) => (
                            <li key={item.id}>
                              {item.sequenceNumber}. {item.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Can Request - Show Form */}
            {details?.canRequestRelease && !error && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                  <div className="flex items-center gap-2 text-green-800">
                    <span className="text-lg">✓</span>
                    <span className="font-medium">All prerequisites completed</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    You can now request release for this hold point.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Scheduled Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notify (Email)</label>
                  <input
                    type="email"
                    value={notificationSentTo}
                    onChange={(e) => setNotificationSentTo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="inspector@example.com"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border rounded-lg hover:bg-muted"
                    disabled={requesting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    disabled={!canSubmit}
                  >
                    {requesting ? 'Requesting...' : 'Request Release'}
                  </button>
                </div>
              </form>
            )}

            {/* Cannot Request - Show Block */}
            {details && !details.canRequestRelease && !error && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 text-xl">⚠️</span>
                    <div>
                      <div className="font-medium text-amber-800">
                        Cannot request release yet
                      </div>
                      <p className="text-sm text-amber-700 mt-1">
                        Complete all preceding checklist items before requesting hold point release.
                      </p>
                    </div>
                  </div>
                </div>

                {details.incompletePrerequisites.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Items to complete:</div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {details.incompletePrerequisites.map((item) => (
                        <li key={item.id} className="flex items-center gap-2">
                          <span className="text-red-500">✗</span>
                          {item.sequenceNumber}. {item.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 border rounded-lg hover:bg-muted"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
