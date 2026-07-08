import React from 'react';
import {
  FileText,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Send,
  Package,
  Loader2,
  ClipboardCheck,
  Plus,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';
import type { Claim } from '../types';
import {
  calculatePaymentDueDate,
  formatCurrency,
  getCertificationDueStatus,
  getPaymentDueStatus,
} from '../utils';
import { downloadCsv } from '@/lib/csv';
import { openDocumentAccessUrl } from '@/lib/documentAccess';
import { logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';

interface ClaimsTableProps {
  claims: Claim[];
  loadingCompleteness: boolean;
  showCompletenessModal: string | null;
  generatingEvidence: string | null;
  onCreateClaim: () => void;
  onSubmitClaim: (claimId: string) => void;
  onDeleteDraftClaim: (claimId: string) => void;
  onDisputeClaim: (claimId: string) => void;
  onCertifyClaim: (claimId: string) => void;
  onRecordPayment: (claimId: string) => void;
  onCompletenessCheck: (claimId: string) => void;
  onEvidencePackage: (claimId: string) => void;
  onExportXero?: (claim: Claim) => void;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'draft':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
          <Clock className="h-3 w-3" /> Draft
        </span>
      );
    case 'submitted':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
          <FileText className="h-3 w-3" /> Submitted
        </span>
      );
    case 'certified':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
          <CheckCircle className="h-3 w-3" /> Certified
        </span>
      );
    case 'paid':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
          <DollarSign className="h-3 w-3" /> Paid
        </span>
      );
    case 'partially_paid':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
          <DollarSign className="h-3 w-3" /> Partially Paid
        </span>
      );
    case 'disputed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
          <AlertCircle className="h-3 w-3" /> Disputed
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
          {status}
        </span>
      );
  }
}

/**
 * Read-back of the external certificate recorded against a claim: who recorded
 * it, an optional notes snippet, and a link to the attached certificate. Shown
 * as a muted secondary line under the certified status badge.
 */
function CertificationReadBack({ claim }: { claim: Claim }) {
  const certification = claim.certification;
  if (!certification) return null;

  const { certifiedByName, variationNotes, certificationDocumentId } = certification;
  if (!certifiedByName && !variationNotes && !certificationDocumentId) return null;

  const notesSnippet =
    variationNotes && variationNotes.length > 80
      ? `${variationNotes.slice(0, 80)}…`
      : variationNotes;

  return (
    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {certifiedByName && <div>Certified by {certifiedByName}</div>}
      {notesSnippet && <div title={variationNotes ?? undefined}>{notesSnippet}</div>}
      {certificationDocumentId && (
        <button
          type="button"
          onClick={() => {
            void openDocumentAccessUrl(certificationDocumentId, null, {
              disposition: 'inline',
            }).catch((error) => {
              logError('Failed to open certification document', error);
              toast({
                title: 'Certificate unavailable',
                description: 'The certificate link could not be opened. Please try again.',
                variant: 'error',
              });
            });
          }}
          className="text-primary underline hover:no-underline"
        >
          View certificate
        </button>
      )}
    </div>
  );
}

function DisputeReadBack({ claim }: { claim: Claim }) {
  const { disputeNotes, disputedAt } = claim;
  if (!disputeNotes) return null;

  const notesSnippet = disputeNotes.length > 80 ? `${disputeNotes.slice(0, 80)}…` : disputeNotes;
  const disputedDate = disputedAt ? new Date(disputedAt).toLocaleDateString('en-AU') : null;

  return (
    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      <div>{disputedDate ? `Disputed ${disputedDate}` : 'Disputed'}</div>
      <div title={disputeNotes}>{notesSnippet}</div>
    </div>
  );
}

function downloadClaimCsv(claim: Claim) {
  const paymentDue =
    claim.paymentDueDate ??
    (claim.submittedAt
      ? calculatePaymentDueDate(claim.submittedAt, claim.projectState ?? undefined)
      : null);

  downloadCsv(`claim-${claim.claimNumber}.csv`, [
    [
      'Claim #',
      'Period Start',
      'Period End',
      'Status',
      'Lots',
      'Claimed Amount',
      'Certified Amount',
      'Paid Amount',
      'Submitted At',
      'Payment Due Date',
    ],
    [
      `Claim ${claim.claimNumber}`,
      new Date(claim.periodStart).toLocaleDateString('en-AU'),
      new Date(claim.periodEnd).toLocaleDateString('en-AU'),
      claim.status,
      claim.lotCount,
      claim.totalClaimedAmount,
      claim.certifiedAmount ?? '-',
      claim.paidAmount ?? '-',
      claim.submittedAt ? new Date(claim.submittedAt).toLocaleDateString('en-AU') : '-',
      paymentDue ? new Date(paymentDue).toLocaleDateString('en-AU') : '-',
    ],
  ]);
}

export const ClaimsTable = React.memo(function ClaimsTable({
  claims,
  loadingCompleteness,
  showCompletenessModal,
  generatingEvidence,
  onCreateClaim,
  onSubmitClaim,
  onDeleteDraftClaim,
  onDisputeClaim,
  onCertifyClaim,
  onRecordPayment,
  onCompletenessCheck,
  onEvidencePackage,
  onExportXero,
}: ClaimsTableProps) {
  if (claims.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 font-semibold">No claims yet</h3>
        <p className="text-muted-foreground mt-1 mx-auto max-w-md">
          Claims are built from conformed lots — lots whose quality checks are complete and signed
          off. Once a lot is conformed, create a claim to bill that work.
        </p>
        <button
          onClick={onCreateClaim}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Claim
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Claim #</th>
              <th className="text-left p-4 font-medium">Period</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Indicative Payment Schedule Due</th>
              <th className="text-left p-4 font-medium">Indicative Payment Due</th>
              <th className="text-right p-4 font-medium">Lots</th>
              <th className="text-right p-4 font-medium">Claimed</th>
              <th className="text-right p-4 font-medium">Certified</th>
              <th className="text-right p-4 font-medium">Paid</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => {
              const certStatus = getCertificationDueStatus(claim);
              const isOverdue = certStatus?.isOverdue || false;
              const outstandingAmount = Math.max(
                0,
                (claim.certifiedAmount ?? 0) - (claim.paidAmount ?? 0),
              );
              const canRecordPayment =
                (claim.status === 'certified' || claim.status === 'partially_paid') &&
                outstandingAmount > 0;
              const canCertifyClaim = claim.status === 'submitted' || claim.status === 'disputed';
              const canDisputeClaim =
                claim.status === 'submitted' ||
                claim.status === 'certified' ||
                claim.status === 'partially_paid';
              return (
                <tr
                  key={claim.id}
                  className={`border-t hover:bg-muted/30 ${isOverdue ? 'bg-destructive/10' : ''}`}
                >
                  <td className="p-4 font-medium">Claim {claim.claimNumber}</td>
                  <td className="p-4">
                    {new Date(claim.periodStart).toLocaleDateString('en-AU')} -{' '}
                    {new Date(claim.periodEnd).toLocaleDateString('en-AU')}
                  </td>
                  <td className="p-4">
                    {getStatusBadge(claim.status)}
                    <CertificationReadBack claim={claim} />
                    <DisputeReadBack claim={claim} />
                  </td>
                  <td className="p-4">
                    {certStatus ? (
                      <span className={`text-sm ${certStatus.className}`}>{certStatus.text}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    {(() => {
                      const dueStatus = getPaymentDueStatus(claim);
                      if (!dueStatus) return <span className="text-muted-foreground">-</span>;
                      return (
                        <span className={`text-sm ${dueStatus.className}`}>{dueStatus.text}</span>
                      );
                    })()}
                  </td>
                  <td className="p-4 text-right">
                    {claim.variationCount && claim.variationCount > 0 ? (
                      <div className="space-y-0.5">
                        <div>{claim.lotCount} lots</div>
                        <div className="text-xs text-muted-foreground">
                          + {claim.variationCount} var
                        </div>
                      </div>
                    ) : (
                      claim.lotCount
                    )}
                  </td>
                  <td className="p-4 text-right font-semibold">
                    {formatCurrency(claim.totalClaimedAmount)}
                  </td>
                  <td className="p-4 text-right">{formatCurrency(claim.certifiedAmount)}</td>
                  <td className="p-4 text-right">{formatCurrency(claim.paidAmount)}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {claim.status === 'draft' && (
                        <>
                          <button
                            onClick={() => onSubmitClaim(claim.id)}
                            className="p-2 hover:bg-primary/10 rounded-lg text-primary"
                            aria-label="Submit Claim"
                            title="Submit Claim"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDeleteDraftClaim(claim.id)}
                            className="p-2 hover:bg-destructive/10 rounded-lg text-destructive"
                            aria-label="Delete Draft Claim"
                            title="Delete Draft Claim"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {canDisputeClaim && (
                        <button
                          onClick={() => onDisputeClaim(claim.id)}
                          className="p-2 hover:bg-destructive/10 rounded-lg text-destructive"
                          aria-label="Mark as Disputed"
                          title="Mark as Disputed"
                        >
                          <AlertCircle className="h-4 w-4" />
                        </button>
                      )}
                      {canCertifyClaim && (
                        <button
                          onClick={() => onCertifyClaim(claim.id)}
                          className="p-2 hover:bg-muted rounded-lg text-foreground"
                          aria-label="Record Payment Schedule"
                          title="Record Payment Schedule"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {canRecordPayment && (
                        <button
                          onClick={() => onRecordPayment(claim.id)}
                          className="p-2 hover:bg-muted rounded-lg text-foreground"
                          aria-label="Record Payment"
                          title="Record Payment"
                        >
                          <DollarSign className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onCompletenessCheck(claim.id)}
                        disabled={loadingCompleteness && showCompletenessModal === claim.id}
                        className="p-2 hover:bg-primary/10 rounded-lg text-primary disabled:opacity-50"
                        aria-label="Claim Evidence Review"
                        title="Claim Evidence Review"
                      >
                        {loadingCompleteness && showCompletenessModal === claim.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ClipboardCheck className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => onEvidencePackage(claim.id)}
                        disabled={generatingEvidence === claim.id}
                        className="p-2 hover:bg-muted rounded-lg text-foreground disabled:opacity-50"
                        aria-label="Generate Evidence Package"
                        title="Generate Evidence Package"
                      >
                        {generatingEvidence === claim.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Package className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => downloadClaimCsv(claim)}
                        className="p-2 hover:bg-muted rounded-lg"
                        aria-label="Download CSV"
                        title="Download CSV"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {onExportXero && (
                        <button
                          onClick={() => onExportXero(claim)}
                          className="p-2 hover:bg-muted rounded-lg"
                          aria-label="Export to Xero"
                          title="Export to Xero (draft invoice CSV)"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
