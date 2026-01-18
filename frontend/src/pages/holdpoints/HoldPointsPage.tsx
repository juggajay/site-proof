import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getAuthToken } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'
import { Link2, Check, FileText, Download, Eye, X, RefreshCw } from 'lucide-react'
import { generateHPEvidencePackagePDF, HPEvidencePackageData } from '@/lib/pdfGenerator'

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
  const [requestError, setRequestError] = useState<{
    message: string;
    incompleteItems?: PrerequisiteItem[];
    code?: string;
    details?: {
      scheduledDate?: string;
      workingDaysNotice?: number;
      minimumNoticeDays?: number;
      requiresOverride?: boolean;
    };
  } | null>(null)
  const [noticePeriodOverride, setNoticePeriodOverride] = useState(false)
  const [noticePeriodOverrideReason, setNoticePeriodOverrideReason] = useState('')
  const [copiedHpId, setCopiedHpId] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)
  const [chasingHpId, setChasingHpId] = useState<string | null>(null)

  // Generate Evidence Package PDF handler
  const handleGenerateEvidencePackage = async (hp: HoldPoint) => {
    if (!hp.id.startsWith('virtual-')) {
      setGeneratingPdf(hp.id)
      try {
        const response = await fetch(`${apiUrl}/api/holdpoints/${hp.id}/evidence-package`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch evidence package data')
        }

        const data = await response.json()
        const evidencePackage = data.evidencePackage as HPEvidencePackageData

        // Generate the PDF
        generateHPEvidencePackagePDF(evidencePackage)

        toast({
          title: 'Evidence Package Generated',
          description: `PDF downloaded for ${hp.lotNumber}`,
        })
      } catch (err) {
        console.error('Failed to generate evidence package:', err)
        toast({
          title: 'Error',
          description: 'Failed to generate evidence package PDF',
          variant: 'destructive',
        })
      } finally {
        setGeneratingPdf(null)
      }
    }
  }

  // Copy HP link handler
  const handleCopyHpLink = async (hpId: string, lotNumber: string, description: string) => {
    const url = `${window.location.origin}/projects/${projectId}/holdpoints?hp=${hpId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedHpId(hpId)
      toast({
        title: 'Link copied!',
        description: `Link to HP for ${lotNumber} has been copied.`,
      })
      setTimeout(() => setCopiedHpId(null), 2000)
    } catch (err) {
      // Fallback
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedHpId(hpId)
      toast({
        title: 'Link copied!',
        description: `Link to HP for ${lotNumber} has been copied.`,
      })
      setTimeout(() => setCopiedHpId(null), 2000)
    }
  }

  // Chase hold point handler (Feature #183)
  const handleChaseHoldPoint = async (hp: HoldPoint) => {
    if (hp.id.startsWith('virtual-') || !token) return

    setChasingHpId(hp.id)
    try {
      const response = await fetch(`${apiUrl}/api/holdpoints/${hp.id}/chase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to chase hold point')
      }

      // Refresh hold points list
      const refreshResponse = await fetch(`${apiUrl}/api/holdpoints/project/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        setHoldPoints(refreshData.holdPoints || [])
      }

      toast({
        title: 'Chase sent',
        description: `Follow-up notification sent for ${hp.lotNumber}. Chase count: ${(data.holdPoint?.chaseCount || 1)}`,
      })
    } catch (err) {
      console.error('Failed to chase hold point:', err)
      toast({
        title: 'Error',
        description: 'Failed to send chase notification',
        variant: 'destructive',
      })
    } finally {
      setChasingHpId(null)
    }
  }

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

  const handleSubmitRequest = async (
    scheduledDate: string,
    scheduledTime: string,
    notificationSentTo: string,
    overrideNoticePeriod?: boolean,
    overrideReason?: string
  ) => {
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
          noticePeriodOverride: overrideNoticePeriod || false,
          noticePeriodOverrideReason: overrideReason || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.incompleteItems) {
          setRequestError({
            message: data.message,
            incompleteItems: data.incompleteItems
          })
        } else if (data.code === 'NOTICE_PERIOD_WARNING') {
          // Handle notice period warning - allow user to override
          setRequestError({
            message: data.message,
            code: data.code,
            details: data.details
          })
        } else {
          setRequestError({ message: data.error || 'Failed to request release' })
        }
        return
      }

      // Reset override state on success
      setNoticePeriodOverride(false)
      setNoticePeriodOverrideReason('')

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

  // Export hold points to CSV
  const handleExportCSV = () => {
    const headers = ['Lot', 'Description', 'Point Type', 'Status', 'Scheduled Date', 'Released At', 'Released By', 'Release Notes']
    const rows = holdPoints.map(hp => [
      hp.lotNumber,
      `"${hp.description.replace(/"/g, '""')}"`,
      hp.pointType || '-',
      getStatusLabel(hp.status),
      hp.scheduledDate ? new Date(hp.scheduledDate).toLocaleDateString() : '-',
      hp.releasedAt ? new Date(hp.releasedAt).toLocaleDateString() : '-',
      hp.releasedByName || '-',
      hp.releaseNotes ? `"${hp.releaseNotes.replace(/"/g, '""')}"` : '-'
    ])

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `hold-points-${projectId}-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
        {holdPoints.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
        )}
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyHpLink(hp.id, hp.lotNumber, hp.description)}
                        className="p-1.5 border rounded hover:bg-muted/50 transition-colors"
                        title="Copy link to this hold point"
                      >
                        {copiedHpId === hp.id ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {hp.status === 'pending' && (
                        <button
                          onClick={() => handleRequestRelease(hp)}
                          className="text-sm text-primary hover:underline"
                        >
                          Request Release
                        </button>
                      )}
                      {hp.status === 'notified' && (
                        <>
                          <span className="text-sm text-amber-600">Awaiting...</span>
                          {!hp.id.startsWith('virtual-') && (
                            <button
                              onClick={() => handleChaseHoldPoint(hp)}
                              disabled={chasingHpId === hp.id}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Send follow-up notification"
                            >
                              {chasingHpId === hp.id ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                  <span>Chasing...</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-3 w-3" />
                                  <span>Chase</span>
                                </>
                              )}
                            </button>
                          )}
                        </>
                      )}
                      {hp.status === 'released' && (
                        <>
                          <span className="text-sm text-green-600">✓ Released</span>
                          {!hp.id.startsWith('virtual-') && (
                            <button
                              onClick={() => handleGenerateEvidencePackage(hp)}
                              disabled={generatingPdf === hp.id}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Generate Evidence Package PDF"
                            >
                              {generatingPdf === hp.id ? (
                                <>
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
                                  <span>Generating...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="h-3 w-3" />
                                  <span>Evidence PDF</span>
                                </>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
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
  error: {
    message: string;
    incompleteItems?: PrerequisiteItem[];
    code?: string;
    details?: {
      scheduledDate?: string;
      workingDaysNotice?: number;
      minimumNoticeDays?: number;
      requiresOverride?: boolean;
    };
  } | null
  onClose: () => void
  onSubmit: (scheduledDate: string, scheduledTime: string, notificationSentTo: string, overrideNoticePeriod?: boolean, overrideReason?: string) => void
}) {
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [notificationSentTo, setNotificationSentTo] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<HPEvidencePackageData | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  const token = getAuthToken()
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  // Check if we have a notice period warning that needs override
  const hasNoticePeriodWarning = error?.code === 'NOTICE_PERIOD_WARNING'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(scheduledDate, scheduledTime, notificationSentTo)
  }

  const handleOverrideSubmit = () => {
    if (!overrideReason.trim()) {
      toast({
        title: 'Override reason required',
        description: 'Please provide a reason for overriding the notice period',
        variant: 'destructive',
      })
      return
    }
    onSubmit(scheduledDate, scheduledTime, notificationSentTo, true, overrideReason)
  }

  const handlePreviewPackage = async () => {
    setLoadingPreview(true)
    try {
      const response = await fetch(`${apiUrl}/api/holdpoints/preview-evidence-package`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lotId: holdPoint.lotId,
          itpChecklistItemId: holdPoint.itpChecklistItemId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch preview data')
      }

      const data = await response.json()
      setPreviewData(data.evidencePackage)
      setShowPreview(true)
    } catch (err) {
      console.error('Failed to fetch preview:', err)
      toast({
        title: 'Error',
        description: 'Failed to load evidence package preview',
        variant: 'destructive',
      })
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleDownloadPreviewPDF = () => {
    if (previewData) {
      generateHPEvidencePackagePDF(previewData)
      toast({
        title: 'PDF Downloaded',
        description: 'Evidence package preview PDF has been downloaded',
      })
    }
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
            {error && !hasNoticePeriodWarning && (
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

            {/* Notice Period Warning - Allow Override (Feature #180) */}
            {hasNoticePeriodWarning && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 text-xl">⚠️</span>
                  <div className="flex-1">
                    <div className="font-medium text-amber-800">{error.message}</div>
                    {error.details && (
                      <div className="mt-2 text-sm text-amber-700">
                        <p>Scheduled date provides only {error.details.workingDaysNotice} working day{error.details.workingDaysNotice !== 1 ? 's' : ''} notice.</p>
                        <p>Minimum required: {error.details.minimumNoticeDays} working day{error.details.minimumNoticeDays !== 1 ? 's' : ''}.</p>
                      </div>
                    )}
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-amber-800 mb-1">
                          Override Reason (required)
                        </label>
                        <textarea
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm"
                          placeholder="Explain why this short notice is necessary..."
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleOverrideSubmit}
                          disabled={requesting || !overrideReason.trim()}
                          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm"
                        >
                          {requesting ? 'Requesting...' : 'Override & Submit'}
                        </button>
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-4 py-2 border border-amber-300 rounded-lg hover:bg-amber-100 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
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

                <div className="flex justify-between items-center pt-4 border-t">
                  <button
                    type="button"
                    onClick={handlePreviewPackage}
                    disabled={loadingPreview}
                    className="flex items-center gap-2 px-4 py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    {loadingPreview ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        <span>Preview Package</span>
                      </>
                    )}
                  </button>
                  <div className="flex gap-2">
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

      {/* Evidence Package Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-background rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b bg-blue-50">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">Evidence Package Preview</h3>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">PREVIEW</span>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 hover:bg-blue-100 rounded"
              >
                <X className="h-5 w-5 text-blue-600" />
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Hold Point Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">Hold Point</div>
                  <div className="font-medium">{previewData.holdPoint.description}</div>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">Lot</div>
                  <div className="font-medium">{previewData.lot.lotNumber}</div>
                  {previewData.lot.activityType && (
                    <div className="text-sm text-muted-foreground">{previewData.lot.activityType}</div>
                  )}
                </div>
              </div>

              {/* Project & ITP Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">Project</div>
                  <div className="font-medium">{previewData.project.name}</div>
                  <div className="text-sm text-muted-foreground">{previewData.project.projectNumber}</div>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">ITP Template</div>
                  <div className="font-medium">{previewData.itpTemplate.name}</div>
                </div>
              </div>

              {/* Checklist Items */}
              <div>
                <h4 className="font-medium mb-3">Checklist Items ({previewData.summary.completedItems}/{previewData.summary.totalChecklistItems} completed)</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Completed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {previewData.checklist.map((item: any) => (
                        <tr key={item.sequenceNumber} className={item.isCompleted ? 'bg-green-50/50' : 'bg-red-50/50'}>
                          <td className="px-3 py-2">{item.sequenceNumber}</td>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2">
                            {item.pointType === 'hold' && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">HP</span>}
                            {item.pointType === 'witness' && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">WP</span>}
                            {item.pointType === 'standard' && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">Std</span>}
                          </td>
                          <td className="px-3 py-2">
                            {item.isCompleted ? (
                              <span className="text-green-600">✓ Completed</span>
                            ) : (
                              <span className="text-red-600">✗ Incomplete</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{item.completedBy || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Test Results */}
              {previewData.testResults.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Test Results ({previewData.summary.passingTests}/{previewData.summary.totalTestResults} passing)</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left">Test Type</th>
                          <th className="px-3 py-2 text-left">Lab</th>
                          <th className="px-3 py-2 text-left">Result</th>
                          <th className="px-3 py-2 text-left">Pass/Fail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {previewData.testResults.map((test: any) => (
                          <tr key={test.id}>
                            <td className="px-3 py-2">{test.testType}</td>
                            <td className="px-3 py-2">{test.laboratoryName || '-'}</td>
                            <td className="px-3 py-2">{test.resultValue} {test.resultUnit}</td>
                            <td className="px-3 py-2">
                              {test.passFail === 'pass' ? (
                                <span className="text-green-600">✓ Pass</span>
                              ) : (
                                <span className="text-red-600">✗ Fail</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Evidence Summary</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-blue-700">Checklist Items</div>
                    <div className="font-semibold text-blue-900">{previewData.summary.completedItems}/{previewData.summary.totalChecklistItems}</div>
                  </div>
                  <div>
                    <div className="text-blue-700">Verified Items</div>
                    <div className="font-semibold text-blue-900">{previewData.summary.verifiedItems}</div>
                  </div>
                  <div>
                    <div className="text-blue-700">Test Results</div>
                    <div className="font-semibold text-blue-900">{previewData.summary.passingTests}/{previewData.summary.totalTestResults}</div>
                  </div>
                  <div>
                    <div className="text-blue-700">Photos/Attachments</div>
                    <div className="font-semibold text-blue-900">{previewData.summary.totalPhotos + previewData.summary.totalAttachments}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Footer */}
            <div className="flex items-center justify-between p-4 border-t bg-muted/30">
              <p className="text-sm text-muted-foreground">
                This is a preview of the evidence package that will be generated.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadPreviewPDF}
                  className="flex items-center gap-2 px-4 py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Continue to Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
