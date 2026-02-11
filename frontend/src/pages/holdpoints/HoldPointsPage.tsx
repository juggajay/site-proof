import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { extractErrorMessage, extractErrorDetails, extractErrorCode, handleApiError } from '@/lib/errorHandling'
import { generateHPEvidencePackagePDF, HPEvidencePackageData } from '@/lib/pdfGenerator'
import { LazyHoldPointsChart } from '@/components/charts/LazyCharts'

// Types
import type { HoldPoint, HoldPointDetails, RequestError, StatusFilter } from './types'

// Extracted components
import { HoldPointStatusFilter, HoldPointSummaryCards } from './components/HoldPointStatusFilter'
import { HoldPointsTable, isOverdue, getStatusLabel } from './components/HoldPointsTable'
import { RequestReleaseModal } from './components/RequestReleaseModal'
import { RecordReleaseModal } from './components/RecordReleaseModal'

export function HoldPointsPage() {
  const { projectId } = useParams()
  const [holdPoints, setHoldPoints] = useState<HoldPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [selectedHoldPoint, setSelectedHoldPoint] = useState<HoldPoint | null>(null)
  const [holdPointDetails, setHoldPointDetails] = useState<HoldPointDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState<RequestError | null>(null)
  const [copiedHpId, setCopiedHpId] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)
  const [chasingHpId, setChasingHpId] = useState<string | null>(null)
  const [showRecordReleaseModal, setShowRecordReleaseModal] = useState(false)
  const [recordingRelease, setRecordingRelease] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // --- Data fetching ---

  useEffect(() => {
    async function fetchHoldPoints() {
      if (!projectId) return
      try {
        const data = await apiFetch<any>(`/api/holdpoints/project/${projectId}`)
        setHoldPoints(data.holdPoints || [])
      } catch (err) {
        console.error('Failed to fetch hold points:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchHoldPoints()
  }, [projectId])

  const refreshHoldPoints = useCallback(async () => {
    try {
      const data = await apiFetch<any>(`/api/holdpoints/project/${projectId}`)
      setHoldPoints(data.holdPoints || [])
    } catch { /* ignore refresh failure */ }
  }, [projectId])

  const fetchHoldPointDetails = useCallback(async (hp: HoldPoint) => {
    setLoadingDetails(true)
    setRequestError(null)
    try {
      const data = await apiFetch<HoldPointDetails>(
        `/api/holdpoints/lot/${hp.lotId}/item/${hp.itpChecklistItemId}`
      )
      setHoldPointDetails(data)
    } catch (err) {
      console.error('Failed to fetch hold point details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }, [])

  // --- Derived data ---

  const filteredHoldPoints = useMemo(
    () => statusFilter === 'all' ? holdPoints : holdPoints.filter(hp => hp.status === statusFilter),
    [holdPoints, statusFilter]
  )

  const stats = useMemo(() => ({
    total: holdPoints.length,
    pending: holdPoints.filter(hp => hp.status === 'pending').length,
    notified: holdPoints.filter(hp => hp.status === 'notified').length,
    releasedThisWeek: holdPoints.filter(hp => {
      if (hp.status !== 'released' || !hp.releasedAt) return false
      const releasedDate = new Date(hp.releasedAt)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return releasedDate >= weekAgo
    }).length,
    overdue: holdPoints.filter(hp => isOverdue(hp)).length,
  }), [holdPoints])

  const chartData = useMemo(() => {
    const releasesOverTime: { date: string; releases: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(23, 59, 59, 999)
      const releases = holdPoints.filter(hp => {
        if (!hp.releasedAt) return false
        const releasedDate = new Date(hp.releasedAt)
        return releasedDate >= dayStart && releasedDate <= dayEnd
      }).length
      releasesOverTime.push({ date: dateStr, releases })
    }
    const releasedHPs = holdPoints.filter(hp => hp.status === 'released' && hp.notificationSentAt && hp.releasedAt)
    let avgTimeToRelease = 0
    if (releasedHPs.length > 0) {
      const totalHours = releasedHPs.reduce((sum, hp) => {
        const notified = new Date(hp.notificationSentAt!).getTime()
        const released = new Date(hp.releasedAt!).getTime()
        return sum + (released - notified) / (1000 * 60 * 60)
      }, 0)
      avgTimeToRelease = Math.round(totalHours / releasedHPs.length)
    }
    return { releasesOverTime, avgTimeToRelease }
  }, [holdPoints])

  // --- Handlers ---

  const handleGenerateEvidencePackage = useCallback(async (hp: HoldPoint) => {
    if (hp.id.startsWith('virtual-')) return
    setGeneratingPdf(hp.id)
    try {
      const data = await apiFetch<any>(`/api/holdpoints/${hp.id}/evidence-package`)
      generateHPEvidencePackagePDF(data.evidencePackage as HPEvidencePackageData)
      toast({ title: 'Evidence Package Generated', description: `PDF downloaded for ${hp.lotNumber}` })
    } catch (err) {
      handleApiError(err, 'Failed to generate evidence package PDF')
    } finally {
      setGeneratingPdf(null)
    }
  }, [])

  const handleCopyHpLink = useCallback(async (hpId: string, lotNumber: string, _description: string) => {
    const url = `${window.location.origin}/projects/${projectId}/holdpoints?hp=${hpId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedHpId(hpId)
      toast({ title: 'Link copied!', description: `Link to HP for ${lotNumber} has been copied.` })
      setTimeout(() => setCopiedHpId(null), 2000)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedHpId(hpId)
      toast({ title: 'Link copied!', description: `Link to HP for ${lotNumber} has been copied.` })
      setTimeout(() => setCopiedHpId(null), 2000)
    }
  }, [projectId])

  const handleRequestRelease = useCallback((hp: HoldPoint) => {
    setSelectedHoldPoint(hp)
    setShowRequestModal(true)
    fetchHoldPointDetails(hp)
  }, [fetchHoldPointDetails])

  const handleRecordRelease = useCallback((hp: HoldPoint) => {
    setSelectedHoldPoint(hp)
    setShowRecordReleaseModal(true)
  }, [])

  const handleChaseHoldPoint = useCallback(async (hp: HoldPoint) => {
    if (hp.id.startsWith('virtual-')) return
    setChasingHpId(hp.id)
    try {
      const data = await apiFetch<any>(`/api/holdpoints/${hp.id}/chase`, { method: 'POST' })
      await refreshHoldPoints()
      toast({
        title: 'Chase sent',
        description: `Follow-up notification sent for ${hp.lotNumber}. Chase count: ${(data.holdPoint?.chaseCount || 1)}`,
      })
    } catch (err) {
      handleApiError(err, 'Failed to send chase notification')
    } finally {
      setChasingHpId(null)
    }
  }, [refreshHoldPoints])

  const handleSubmitRequest = useCallback(async (
    scheduledDate: string,
    scheduledTime: string,
    notificationSentTo: string,
    overrideNoticePeriod?: boolean,
    overrideReason?: string
  ) => {
    if (!selectedHoldPoint) return
    setRequesting(true)
    setRequestError(null)
    try {
      await apiFetch(`/api/holdpoints/request-release`, {
        method: 'POST',
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
      await refreshHoldPoints()
      setShowRequestModal(false)
      setSelectedHoldPoint(null)
      setHoldPointDetails(null)
    } catch (err) {
      const details = extractErrorDetails(err)
      const code = extractErrorCode(err)
      if (details?.incompleteItems) {
        setRequestError({ message: extractErrorMessage(err, 'Failed to request release'), incompleteItems: details.incompleteItems })
      } else if (code === 'NOTICE_PERIOD_WARNING') {
        setRequestError({ message: extractErrorMessage(err, 'Failed to request release'), code, details: details || undefined })
      } else {
        setRequestError({ message: extractErrorMessage(err, 'Failed to request release') })
      }
    } finally {
      setRequesting(false)
    }
  }, [selectedHoldPoint, refreshHoldPoints])

  const handleSubmitRecordRelease = useCallback(async (
    releasedByName: string,
    releasedByOrg: string,
    _releaseDate: string,
    _releaseTime: string,
    releaseNotes: string,
    releaseMethod: string = 'digital',
    signatureDataUrl: string | null = null
  ) => {
    if (!selectedHoldPoint || selectedHoldPoint.id.startsWith('virtual-')) return
    setRecordingRelease(true)
    try {
      await apiFetch(`/api/holdpoints/${selectedHoldPoint.id}/release`, {
        method: 'POST',
        body: JSON.stringify({
          releasedByName,
          releasedByOrg,
          releaseMethod,
          releaseNotes: releaseNotes || null,
          signatureDataUrl: signatureDataUrl || null,
        }),
      })
      await refreshHoldPoints()
      toast({
        title: 'Release Recorded',
        description: `Hold point for ${selectedHoldPoint.lotNumber} has been released`,
      })
      setShowRecordReleaseModal(false)
      setSelectedHoldPoint(null)
    } catch (err) {
      handleApiError(err, 'Failed to record hold point release')
    } finally {
      setRecordingRelease(false)
    }
  }, [selectedHoldPoint, refreshHoldPoints])

  const handleExportCSV = useCallback(() => {
    const headers = ['Lot', 'Description', 'Point Type', 'Status', 'Scheduled Date', 'Released At', 'Released By', 'Release Notes']
    const rows = holdPoints.map(hp => [
      hp.lotNumber,
      `"${hp.description.replace(/"/g, '""')}"`,
      hp.pointType || '-',
      getStatusLabel(hp.status),
      hp.scheduledDate ? new Date(hp.scheduledDate).toLocaleDateString() : '-',
      hp.releasedAt ? new Date(hp.releasedAt).toLocaleDateString() : '-',
      hp.releasedByName || '-',
      hp.releaseNotes ? `"${hp.releaseNotes.replace(/"/g, '""')}"` : '-',
    ])
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `hold-points-${projectId}-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [holdPoints, projectId])

  const handleCloseRequestModal = useCallback(() => {
    setShowRequestModal(false)
    setSelectedHoldPoint(null)
    setHoldPointDetails(null)
    setRequestError(null)
  }, [])

  const handleCloseRecordModal = useCallback(() => {
    setShowRecordReleaseModal(false)
    setSelectedHoldPoint(null)
  }, [])

  const handleClearFilter = useCallback(() => setStatusFilter('all'), [])

  // --- Render ---

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
          <HoldPointStatusFilter
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onExportCSV={handleExportCSV}
          />
        )}
      </div>

      {!loading && holdPoints.length > 0 && (
        <HoldPointSummaryCards stats={stats} />
      )}

      {!loading && holdPoints.length > 0 && (
        <LazyHoldPointsChart
          releasesOverTime={chartData.releasesOverTime}
          avgTimeToRelease={chartData.avgTimeToRelease}
          releasedCount={holdPoints.filter(hp => hp.status === 'released').length}
        />
      )}

      <HoldPointsTable
        holdPoints={holdPoints}
        filteredHoldPoints={filteredHoldPoints}
        loading={loading}
        statusFilter={statusFilter}
        copiedHpId={copiedHpId}
        generatingPdf={generatingPdf}
        chasingHpId={chasingHpId}
        onCopyLink={handleCopyHpLink}
        onRequestRelease={handleRequestRelease}
        onRecordRelease={handleRecordRelease}
        onChase={handleChaseHoldPoint}
        onGenerateEvidence={handleGenerateEvidencePackage}
        onClearFilter={handleClearFilter}
      />

      {showRequestModal && selectedHoldPoint && (
        <RequestReleaseModal
          holdPoint={selectedHoldPoint}
          details={holdPointDetails}
          loading={loadingDetails}
          requesting={requesting}
          error={requestError}
          onClose={handleCloseRequestModal}
          onSubmit={handleSubmitRequest}
        />
      )}

      {showRecordReleaseModal && selectedHoldPoint && (
        <RecordReleaseModal
          holdPoint={selectedHoldPoint}
          recording={recordingRelease}
          approvalRequirement={holdPointDetails?.approvalRequirement}
          onClose={handleCloseRecordModal}
          onSubmit={handleSubmitRecordRelease}
        />
      )}
    </div>
  )
}
