import { Link2, Check, RefreshCw, Users, Printer } from 'lucide-react'
import { LotQRCode } from '@/components/lots/LotQRCode'
import type { Lot, LotSubcontractorAssignment } from '../types'
import { lotStatusColors as statusColors } from '../constants'
import { SubcontractorAssignmentsSection } from './SubcontractorAssignmentsSection'
import { LotSummaryCards } from './LotSummaryCards'

export interface LotHeaderProps {
  lot: Lot
  projectId: string
  lotId: string
  // Permissions
  canEdit: boolean
  canConformLots: boolean
  canManageLot: boolean
  isEditable: boolean
  // State
  linkCopied: boolean
  assignments: LotSubcontractorAssignment[]
  removeAssignmentPending: boolean
  // Handlers
  onCopyLink: () => void
  onPrint: () => void
  onEdit: () => void
  onAssignSubcontractorLegacy: () => void
  onOverrideStatus: () => void
  onAddSubcontractor: () => void
  onEditAssignment: (assignment: LotSubcontractorAssignment) => void
  onRemoveAssignment: (assignmentId: string) => void
}

export function LotHeader({
  lot,
  projectId,
  lotId,
  canEdit,
  canConformLots,
  canManageLot,
  isEditable,
  linkCopied,
  assignments,
  removeAssignmentPending,
  onCopyLink,
  onPrint,
  onEdit,
  onAssignSubcontractorLegacy,
  onOverrideStatus,
  onAddSubcontractor,
  onEditAssignment,
  onRemoveAssignment,
}: LotHeaderProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-4">
          {/* QR Code */}
          <LotQRCode
            lotId={lotId}
            lotNumber={lot.lotNumber}
            projectId={projectId}
            size="medium"
          />
          <div>
            <h1 className="text-2xl font-bold">{lot.lotNumber}</h1>
            <p className="text-sm text-muted-foreground">{lot.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCopyLink}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
            title="Copy link to this lot"
          >
            {linkCopied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>
          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors print:hidden"
            title="Print lot details"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>
          {canEdit && isEditable && (
            <button
              onClick={onEdit}
              className="rounded-lg border border-amber-500 px-4 py-2 text-sm text-amber-600 hover:bg-amber-50"
            >
              Edit Lot
            </button>
          )}
          {/* Assign Subcontractor Button - only for PMs and above, not claimed lots */}
          {canEdit && lot.status !== 'claimed' && (
            <button
              onClick={onAssignSubcontractorLegacy}
              className="flex items-center gap-1.5 rounded-lg border border-blue-500 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
              title={lot.assignedSubcontractor ? `Assigned to ${lot.assignedSubcontractor.companyName}` : 'Assign to subcontractor'}
            >
              <Users className="h-4 w-4" />
              <span>{lot.assignedSubcontractor ? lot.assignedSubcontractor.companyName : 'Assign Subcontractor'}</span>
            </button>
          )}
          {/* Override Status Button - only for quality managers and above */}
          {canConformLots && lot.status !== 'claimed' && (
            <button
              onClick={onOverrideStatus}
              className="flex items-center gap-1.5 rounded-lg border border-purple-500 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50"
              title="Manually override lot status"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Override Status</span>
            </button>
          )}
          <span className={`px-3 py-1 rounded text-sm font-medium ${statusColors[lot.status] || 'bg-gray-100'}`}>
            {lot.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Lot Summary Cards */}
      <LotSummaryCards lot={lot} />

      {/* Timestamps */}
      <div className="flex flex-wrap gap-6 text-sm text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">Created:</span>
          <time dateTime={lot.createdAt} title={new Date(lot.createdAt).toISOString()}>
            {new Date(lot.createdAt).toLocaleString('en-AU', {
              dateStyle: 'medium',
              timeStyle: 'medium',
            })}
          </time>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Last Updated:</span>
          <time dateTime={lot.updatedAt} title={new Date(lot.updatedAt).toISOString()}>
            {new Date(lot.updatedAt).toLocaleString('en-AU', {
              dateStyle: 'medium',
              timeStyle: 'medium',
            })}
          </time>
        </div>
      </div>

      {/* Subcontractor Assignments Section */}
      <SubcontractorAssignmentsSection
        lot={lot}
        assignments={assignments}
        canManageLot={canManageLot}
        removeAssignmentPending={removeAssignmentPending}
        onAddSubcontractor={onAddSubcontractor}
        onEditAssignment={onEditAssignment}
        onRemoveAssignment={onRemoveAssignment}
      />
    </>
  )
}
