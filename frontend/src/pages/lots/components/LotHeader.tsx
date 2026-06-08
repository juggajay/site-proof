import { Link2, Check, RefreshCw, Users, Printer } from 'lucide-react';
import { LotQRCode } from '@/components/lots/LotQRCode';
import type { Lot, LotSubcontractorAssignment } from '../types';
import { lotStatusColors as statusColors } from '../constants';
import { SubcontractorAssignmentsSection } from './SubcontractorAssignmentsSection';
import { LotSummaryCards } from './LotSummaryCards';
import { formatStatusLabel } from '@/lib/statusLabels';

export interface LotHeaderProps {
  lot: Lot;
  projectId: string;
  lotId: string;
  // Permissions
  // canManageLot gates lot setup/configuration actions (Edit Lot, Assign
  // Subcontractor) — it mirrors the MANAGEMENT_ROLES route guard, so a foreman
  // (field execution only) never sees a button that leads to Access Denied.
  canConformLots: boolean;
  canManageLot: boolean;
  isEditable: boolean;
  // State
  linkCopied: boolean;
  assignments: LotSubcontractorAssignment[];
  removeAssignmentPending: boolean;
  // Handlers
  onCopyLink: () => void;
  onPrint: () => void;
  onEdit: () => void;
  onAssignSubcontractorLegacy: () => void;
  onOverrideStatus: () => void;
  onAddSubcontractor: () => void;
  onEditAssignment: (assignment: LotSubcontractorAssignment) => void;
  onRemoveAssignment: (assignmentId: string) => void;
}

export function LotHeader({
  lot,
  projectId,
  lotId,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          {/* QR Code */}
          <LotQRCode lotId={lotId} lotNumber={lot.lotNumber} projectId={projectId} size="medium" />
          <div>
            <h1 className="text-2xl font-bold">{lot.lotNumber}</h1>
            <p className="text-sm text-muted-foreground">{lot.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={onCopyLink}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
            title="Copy link to this lot"
          >
            {linkCopied ? (
              <>
                <Check className="h-4 w-4 text-success" />
                <span className="text-success">Copied!</span>
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
          {canManageLot && isEditable && (
            <button
              onClick={onEdit}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
            >
              Edit Lot
            </button>
          )}
          {/* Assign Subcontractor Button - only for PMs and above, not claimed lots */}
          {canManageLot && lot.status !== 'claimed' && (
            <button
              onClick={onAssignSubcontractorLegacy}
              className="flex items-center gap-1.5 rounded-lg border border-primary px-3 py-2 text-sm text-primary hover:bg-primary/5"
              title={
                lot.assignedSubcontractor
                  ? `Assigned to ${lot.assignedSubcontractor.companyName}`
                  : 'Assign to subcontractor'
              }
            >
              <Users className="h-4 w-4" />
              <span>
                {lot.assignedSubcontractor
                  ? lot.assignedSubcontractor.companyName
                  : 'Assign Subcontractor'}
              </span>
            </button>
          )}
          {/* Override Workflow Status Button - only for quality managers and above */}
          {canConformLots && lot.status !== 'claimed' && (
            <button
              onClick={onOverrideStatus}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
              title="Manually override lot workflow status"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Override Workflow Status</span>
            </button>
          )}
          <span
            className={`px-3 py-1 rounded text-sm font-medium ${statusColors[lot.status] || 'bg-muted text-muted-foreground'}`}
          >
            {formatStatusLabel(lot.status)}
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
  );
}
