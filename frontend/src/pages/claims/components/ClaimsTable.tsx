import React from 'react'
import { FileText, DollarSign, CheckCircle, Clock, AlertCircle, Download, Send, Package, Loader2, Brain, Plus } from 'lucide-react'
import type { Claim } from '../types'
import { formatCurrency, getCertificationDueStatus, getPaymentDueStatus } from '../utils'

interface ClaimsTableProps {
  claims: Claim[]
  loadingCompleteness: boolean
  showCompletenessModal: string | null
  generatingEvidence: string | null
  onCreateClaim: () => void
  onSubmitClaim: (claimId: string) => void
  onDisputeClaim: (claimId: string) => void
  onCompletenessCheck: (claimId: string) => void
  onEvidencePackage: (claimId: string) => void
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'draft':
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"><Clock className="h-3 w-3" /> Draft</span>
    case 'submitted':
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><FileText className="h-3 w-3" /> Submitted</span>
    case 'certified':
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><CheckCircle className="h-3 w-3" /> Certified</span>
    case 'paid':
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><DollarSign className="h-3 w-3" /> Paid</span>
    case 'disputed':
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertCircle className="h-3 w-3" /> Disputed</span>
    default:
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>
  }
}

export const ClaimsTable = React.memo(function ClaimsTable({
  claims,
  loadingCompleteness,
  showCompletenessModal,
  generatingEvidence,
  onCreateClaim,
  onSubmitClaim,
  onDisputeClaim,
  onCompletenessCheck,
  onEvidencePackage,
}: ClaimsTableProps) {
  if (claims.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 font-semibold">No claims yet</h3>
        <p className="text-muted-foreground mt-1">Create your first progress claim to get started</p>
        <button
          onClick={onCreateClaim}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Claim
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-4 font-medium">Claim #</th>
            <th className="text-left p-4 font-medium">Period</th>
            <th className="text-left p-4 font-medium">Status</th>
            <th className="text-left p-4 font-medium">Certification Due</th>
            <th className="text-left p-4 font-medium">Payment Due (SOPA)</th>
            <th className="text-right p-4 font-medium">Lots</th>
            <th className="text-right p-4 font-medium">Claimed</th>
            <th className="text-right p-4 font-medium">Certified</th>
            <th className="text-right p-4 font-medium">Paid</th>
            <th className="text-right p-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => {
            const certStatus = getCertificationDueStatus(claim)
            const isOverdue = certStatus?.isOverdue || false
            return (
            <tr key={claim.id} className={`border-t hover:bg-muted/30 ${isOverdue ? 'bg-red-50' : ''}`}>
              <td className="p-4 font-medium">Claim {claim.claimNumber}</td>
              <td className="p-4">
                {new Date(claim.periodStart).toLocaleDateString()} - {new Date(claim.periodEnd).toLocaleDateString()}
              </td>
              <td className="p-4">{getStatusBadge(claim.status)}</td>
              <td className="p-4">
                {certStatus ? (
                  <span className={`text-sm ${certStatus.className}`}>{certStatus.text}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="p-4">
                {(() => {
                  const dueStatus = getPaymentDueStatus(claim)
                  if (!dueStatus) return <span className="text-muted-foreground">-</span>
                  return <span className={`text-sm ${dueStatus.className}`}>{dueStatus.text}</span>
                })()}
              </td>
              <td className="p-4 text-right">{claim.lotCount}</td>
              <td className="p-4 text-right font-semibold">{formatCurrency(claim.totalClaimedAmount)}</td>
              <td className="p-4 text-right">{formatCurrency(claim.certifiedAmount)}</td>
              <td className="p-4 text-right text-green-600">{formatCurrency(claim.paidAmount)}</td>
              <td className="p-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  {claim.status === 'draft' && (
                    <button
                      onClick={() => onSubmitClaim(claim.id)}
                      className="p-2 hover:bg-primary/10 rounded-lg text-primary"
                      title="Submit Claim"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                  {(claim.status === 'submitted' || claim.status === 'certified') && (
                    <button
                      onClick={() => onDisputeClaim(claim.id)}
                      className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                      title="Mark as Disputed"
                    >
                      <AlertCircle className="h-4 w-4" />
                    </button>
                  )}
                  <button
                      onClick={() => onCompletenessCheck(claim.id)}
                      disabled={loadingCompleteness && showCompletenessModal === claim.id}
                      className="p-2 hover:bg-purple-100 rounded-lg text-purple-600 disabled:opacity-50"
                      title="AI Completeness Check"
                    >
                      {loadingCompleteness && showCompletenessModal === claim.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="h-4 w-4" />
                      )}
                    </button>
                  <button
                      onClick={() => onEvidencePackage(claim.id)}
                      disabled={generatingEvidence === claim.id}
                      className="p-2 hover:bg-green-100 rounded-lg text-green-600 disabled:opacity-50"
                      title="Generate Evidence Package"
                    >
                      {generatingEvidence === claim.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Package className="h-4 w-4" />
                      )}
                    </button>
                  <button className="p-2 hover:bg-muted rounded-lg" title="Download CSV">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})
