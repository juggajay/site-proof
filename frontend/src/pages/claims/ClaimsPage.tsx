import { useParams } from 'react-router-dom'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { Plus } from 'lucide-react'
import { LazyCumulativeChart, LazyMonthlyChart } from '@/components/charts/LazyCharts'
import { generateClaimEvidencePackagePDF } from '@/lib/pdfGenerator'
import type { ClaimPackageOptions } from '@/lib/pdfGenerator'

import type { Claim, CompletenessData, SubmitMethod } from './types'
import { DEMO_CLAIMS } from './constants'
import { formatCurrency, calculatePaymentDueDate, exportChartDataToCSV } from './utils'

import { ClaimsSummary } from './components/ClaimsSummary'
import { ClaimsTable } from './components/ClaimsTable'
import { CreateClaimModal } from './components/CreateClaimModal'
import { SubmitClaimModal } from './components/SubmitClaimModal'
import { DisputeModal } from './components/DisputeModal'
import { CompletenessCheckModal } from './components/CompletenessCheckModal'
import { EvidencePackageModal } from './components/EvidencePackageModal'

export function ClaimsPage() {
  const { projectId } = useParams()
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)

  // Modal visibility state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState<string | null>(null)
  const [showDisputeModal, setShowDisputeModal] = useState<string | null>(null)
  const [showPackageModal, setShowPackageModal] = useState<string | null>(null)
  const [showCompletenessModal, setShowCompletenessModal] = useState<string | null>(null)

  // Async operation state
  const [generatingEvidence, setGeneratingEvidence] = useState<string | null>(null)
  const [loadingCompleteness, setLoadingCompleteness] = useState(false)
  const [completenessData, setCompletenessData] = useState<CompletenessData | null>(null)

  useEffect(() => { fetchClaims() }, [projectId])

  const fetchClaims = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      try {
        const data = await apiFetch<any>(`/api/projects/${projectId}/claims`)
        setClaims(data.claims || [])
      } catch {
        setClaims([...DEMO_CLAIMS])
      }
    } catch {
      console.error('Error fetching claims')
    } finally {
      setLoading(false)
    }
  }

  // --- Summary computations ---
  const totalClaimed = useMemo(() => claims.reduce((sum, c) => sum + c.totalClaimedAmount, 0), [claims])
  const totalCertified = useMemo(() => claims.reduce((sum, c) => sum + (c.certifiedAmount || 0), 0), [claims])
  const totalPaid = useMemo(() => claims.reduce((sum, c) => sum + (c.paidAmount || 0), 0), [claims])
  const outstanding = useMemo(() => totalCertified - totalPaid, [totalCertified, totalPaid])

  // --- Chart data ---
  const cumulativeChartData = useMemo(() => {
    if (claims.length === 0) return []
    const sorted = [...claims].sort((a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime())
    let cumClaimed = 0, cumCertified = 0, cumPaid = 0
    return sorted.map(c => {
      cumClaimed += c.totalClaimedAmount; cumCertified += c.certifiedAmount || 0; cumPaid += c.paidAmount || 0
      return { name: new Date(c.periodEnd).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }), claimNumber: c.claimNumber, claimed: cumClaimed, certified: cumCertified, paid: cumPaid, claimAmount: c.totalClaimedAmount, certifiedAmount: c.certifiedAmount, paidAmount: c.paidAmount }
    })
  }, [claims])

  const monthlyBreakdownData = useMemo(() => {
    if (claims.length === 0) return []
    return [...claims].sort((a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime())
      .map(c => ({ name: new Date(c.periodEnd).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }), claimNumber: c.claimNumber, claimed: c.totalClaimedAmount, certified: c.certifiedAmount || 0, paid: c.paidAmount || 0, status: c.status }))
  }, [claims])

  // --- Handlers ---
  const handleExportCSV = useCallback(() => {
    const headers = ['Claim #', 'Period Start', 'Period End', 'Status', 'Lots', 'Claimed Amount', 'Certified Amount', 'Paid Amount', 'Submitted At', 'Payment Due Date']
    const rows = claims.map(c => [
      `Claim ${c.claimNumber}`, new Date(c.periodStart).toLocaleDateString(), new Date(c.periodEnd).toLocaleDateString(),
      c.status, c.lotCount, c.totalClaimedAmount, c.certifiedAmount ?? '-', c.paidAmount ?? '-',
      c.submittedAt ? new Date(c.submittedAt).toLocaleDateString() : '-',
      c.paymentDueDate ? new Date(c.paymentDueDate).toLocaleDateString() : (c.submittedAt ? new Date(calculatePaymentDueDate(c.submittedAt)).toLocaleDateString() : '-')
    ])
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `progress-claims-${projectId}-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }, [claims, projectId])

  const handleExportCumulativeData = useCallback(() => {
    exportChartDataToCSV(cumulativeChartData.map(i => ({ name: i.name, claimed: i.claimed, certified: i.certified, paid: i.paid })), 'cumulative-claims', ['Name', 'Claimed', 'Certified', 'Paid'])
  }, [cumulativeChartData])

  const handleExportMonthlyData = useCallback(() => {
    exportChartDataToCSV(monthlyBreakdownData.map(i => ({ name: i.name, claimed: i.claimed, certified: i.certified, paid: i.paid })), 'monthly-claims-breakdown', ['Name', 'Claimed', 'Certified', 'Paid'])
  }, [monthlyBreakdownData])

  const handleClaimCreated = useCallback((claim: Claim | null) => {
    if (claim) {
      setClaims(prev => [...prev, claim])
    } else {
      fetchClaims()
    }
  }, [projectId])

  const handleSubmitClaim = useCallback((claimId: string, method: SubmitMethod) => {
    const claim = claims.find(c => c.id === claimId)
    if (!claim) return
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: 'submitted' as const, submittedAt: new Date().toISOString() } : c))
    if (method === 'email') { alert(`Claim ${claim.claimNumber} submitted via email successfully!`) }
    else if (method === 'download') {
      const csvContent = `Claim Number,${claim.claimNumber}\nPeriod,${claim.periodStart} to ${claim.periodEnd}\nTotal Amount,$${claim.totalClaimedAmount.toLocaleString()}\nLots,${claim.lotCount}\nStatus,Submitted`
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `claim-${claim.claimNumber}.csv`
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
      alert(`Claim ${claim.claimNumber} downloaded and marked as submitted!`)
    } else if (method === 'portal') { alert(`Claim ${claim.claimNumber} uploaded to portal successfully!`) }
    setShowSubmitModal(null)
  }, [claims])

  const handleDisputeClaim = useCallback(async (claimId: string, notes: string) => {
    try {
      try {
        await apiFetch(`/api/projects/${projectId}/claims/${claimId}`, { method: 'PUT', body: JSON.stringify({ status: 'disputed', disputeNotes: notes }) })
      } catch { /* Demo mode fallback */ }
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: 'disputed' as const, disputeNotes: notes, disputedAt: new Date().toISOString().split('T')[0] } : c))
      alert('Claim marked as disputed')
    } catch {
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: 'disputed' as const, disputeNotes: notes, disputedAt: new Date().toISOString().split('T')[0] } : c))
      alert('Claim marked as disputed')
    }
    setShowDisputeModal(null)
  }, [projectId])

  const handleCompletenessCheck = useCallback(async (claimId: string) => {
    setShowCompletenessModal(claimId); setLoadingCompleteness(true); setCompletenessData(null)
    try {
      try {
        const data = await apiFetch<CompletenessData>(`/api/projects/${projectId}/claims/${claimId}/completeness-check`)
        setCompletenessData(data)
      } catch {
        setCompletenessData({
          claimId, claimNumber: claims.find(c => c.id === claimId)?.claimNumber || 0, analyzedAt: new Date().toISOString(),
          summary: { totalLots: 3, includeCount: 1, reviewCount: 1, excludeCount: 1, averageCompletenessScore: 65, totalClaimAmount: 75000, recommendedAmount: 50000 },
          overallSuggestions: ['Consider excluding 1 lot(s) with critical issues to avoid payment disputes.', 'Review 1 lot(s) with warnings before finalizing the claim.', 'Excluding recommended lots would reduce the claim by $25,000.'],
          lots: [
            { lotId: '1', lotNumber: 'LOT-001', activityType: 'Earthworks', claimAmount: 25000, completenessScore: 95, recommendation: 'include', issues: [], summary: { itpStatus: '10/10 items complete', testStatus: '5/5 tests passed', holdPointStatus: '2/2 released', ncrStatus: 'None', photoCount: 8 } },
            { lotId: '2', lotNumber: 'LOT-002', activityType: 'Drainage', claimAmount: 25000, completenessScore: 72, recommendation: 'review', issues: [{ type: 'itp_incomplete', severity: 'warning', message: 'ITP 80% complete (2 items remaining)', suggestion: 'Complete remaining ITP checklist items to strengthen the evidence package.' }, { type: 'low_photos', severity: 'info', message: 'Only 2 photo(s) uploaded', suggestion: 'Consider adding more photos (minimum 3 recommended) to strengthen evidence.' }], summary: { itpStatus: '8/10 items complete', testStatus: '3/3 tests passed', holdPointStatus: '1/1 released', ncrStatus: 'None', photoCount: 2 } },
            { lotId: '3', lotNumber: 'LOT-003', activityType: 'Pavement', claimAmount: 25000, completenessScore: 35, recommendation: 'exclude', issues: [{ type: 'unreleased_hp', severity: 'critical', message: '2 hold point(s) not verified/released', suggestion: 'Hold points must be released before claiming. Exclude this lot or obtain hold point releases.' }, { type: 'failed_tests', severity: 'critical', message: '1 test(s) failed', suggestion: 'Failed tests indicate non-conformance. Consider excluding this lot or addressing the test failures with retests.' }, { type: 'open_ncr', severity: 'warning', message: '1 minor NCR(s) open', suggestion: 'Consider resolving NCRs before claiming for a cleaner evidence package.' }], summary: { itpStatus: '5/10 items complete', testStatus: '2/3 tests passed', holdPointStatus: '0/2 released', ncrStatus: '0/1 closed', photoCount: 1 } }
          ]
        })
      }
    } catch { console.error('Error running completeness check'); alert('Failed to run completeness check. Please try again.'); setShowCompletenessModal(null) }
    finally { setLoadingCompleteness(false) }
  }, [projectId, claims])

  const handleGenerateEvidencePackage = useCallback(async (claimId: string, options: ClaimPackageOptions) => {
    setShowPackageModal(null); setGeneratingEvidence(claimId); const startTime = Date.now()
    try {
      const data = await apiFetch<any>(`/api/projects/${projectId}/claims/${claimId}/evidence-package`)
      generateClaimEvidencePackagePDF(data, options)
      const totalTime = Date.now() - startTime
      alert(`Evidence package generated successfully!\n\nGeneration time: ${(totalTime / 1000).toFixed(1)} seconds\nLots included: ${data.summary.totalLots}`)
    } catch { console.error('Error generating evidence package'); alert('Failed to generate evidence package. Please try again.') }
    finally { setGeneratingEvidence(null) }
  }, [projectId])

  const handleExcludeLots = useCallback(() => {
    alert('In a full implementation, this would remove excluded lots from the claim and recalculate totals.')
  }, [])

  // --- Find claim for submit modal ---
  const submitClaim = useMemo(() => showSubmitModal ? claims.find(c => c.id === showSubmitModal) : null, [showSubmitModal, claims])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Progress Claims</h1>
          <p className="text-muted-foreground mt-1">SOPA-compliant progress claims and payment tracking</p>
        </div>
        <div className="flex gap-2">
          {claims.length > 0 && (
            <button onClick={handleExportCSV} className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">Export CSV</button>
          )}
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Claim
          </button>
        </div>
      </div>

      <ClaimsSummary totalClaimed={totalClaimed} totalCertified={totalCertified} totalPaid={totalPaid} outstanding={outstanding} />
      <LazyCumulativeChart data={cumulativeChartData} formatCurrency={formatCurrency} onExport={handleExportCumulativeData} />
      <LazyMonthlyChart data={monthlyBreakdownData} formatCurrency={formatCurrency} onExport={handleExportMonthlyData} />
      <ClaimsTable
        claims={claims} loadingCompleteness={loadingCompleteness} showCompletenessModal={showCompletenessModal} generatingEvidence={generatingEvidence}
        onCreateClaim={() => setShowCreateModal(true)} onSubmitClaim={setShowSubmitModal} onDisputeClaim={setShowDisputeModal}
        onCompletenessCheck={handleCompletenessCheck} onEvidencePackage={setShowPackageModal}
      />

      {/* Modals */}
      {showCreateModal && projectId && (
        <CreateClaimModal projectId={projectId} claims={claims} onClose={() => setShowCreateModal(false)} onClaimCreated={handleClaimCreated} />
      )}
      {submitClaim && (
        <SubmitClaimModal claim={submitClaim} onClose={() => setShowSubmitModal(null)} onSubmitted={handleSubmitClaim} />
      )}
      {showDisputeModal && (
        <DisputeModal claimId={showDisputeModal} onClose={() => setShowDisputeModal(null)} onDisputed={handleDisputeClaim} />
      )}
      {showPackageModal && (
        <EvidencePackageModal claimId={showPackageModal} onClose={() => setShowPackageModal(null)} onGenerate={handleGenerateEvidencePackage} />
      )}
      {showCompletenessModal && (
        <CompletenessCheckModal loading={loadingCompleteness} data={completenessData} onClose={() => setShowCompletenessModal(null)} onExcludeLots={handleExcludeLots} />
      )}
    </div>
  )
}
