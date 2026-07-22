import { useState } from 'react';
import { Link2, Check, RefreshCw, Printer, MoreVertical } from 'lucide-react';
import { LotQRCode } from '@/components/lots/LotQRCode';
import { AskClancyButton } from '@/components/copilot/AskClancy';
import type { Lot, LotSubcontractorAssignment } from '../types';
import { getLotStatusBadgeClass } from '@/lib/lotStatusOverview';
import { SubcontractorAssignmentsSection } from './SubcontractorAssignmentsSection';
import { LotSummaryCards } from './LotSummaryCards';
import { formatStatusLabel } from '@/lib/statusLabels';
import { BottomSheet } from '@/components/foreman/sheets/BottomSheet';
import { useIsMobile } from '@/hooks/useMediaQuery';

export interface LotHeaderProps {
  lot: Lot;
  projectId: string;
  lotId: string;
  // Permissions
  // canManageLot gates subcontractor assignment. canEditLot gates the edit
  // route separately because the backend intentionally lets site managers
  // assign subcontractors but not edit lot detail fields.
  canConformLots: boolean;
  canManageLot: boolean;
  canEditLot?: boolean;
  isEditable: boolean;
  // State
  linkCopied: boolean;
  assignments: LotSubcontractorAssignment[];
  removeAssignmentPending: boolean;
  // Handlers
  onCopyLink: () => void;
  onPrint: () => void;
  onEdit: () => void;
  onOverrideStatus: () => void;
  onAddSubcontractor: () => void;
  onEditAssignment: (assignment: LotSubcontractorAssignment) => void;
  onRemoveAssignment: (assignmentId: string) => void;
}

/**
 * Mobile overflow sheet action row — full-width ≥48px touch target with icon.
 */
function OverflowActionRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 active:bg-muted/70 transition-colors rounded-lg min-h-[48px]"
    >
      <span className="flex-shrink-0 text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function LotHeader({
  lot,
  projectId,
  lotId,
  canConformLots,
  canManageLot,
  canEditLot = canManageLot,
  isEditable,
  linkCopied,
  assignments,
  removeAssignmentPending,
  onCopyLink,
  onPrint,
  onEdit,
  onOverrideStatus,
  onAddSubcontractor,
  onEditAssignment,
  onRemoveAssignment,
}: LotHeaderProps) {
  const isMobile = useIsMobile();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  const statusBadge = (
    <span className={`px-3 py-1 rounded text-sm font-medium ${getLotStatusBadgeClass(lot.status)}`}>
      {formatStatusLabel(lot.status)}
    </span>
  );

  if (isMobile) {
    // Determine primary action: Edit Lot when the user can edit, else null
    // (Copy Link is always in the overflow sheet on mobile to keep it uncluttered).
    const hasPrimary = canEditLot && isEditable;

    // Build overflow actions list (respects same permission gating as desktop).
    // Copy Link and Print always appear; management actions are gated.
    const overflowActions: {
      key: string;
      icon: React.ReactNode;
      label: string;
      handler: () => void;
    }[] = [
      {
        key: 'copy-link',
        icon: linkCopied ? (
          <Check className="h-5 w-5 text-success" />
        ) : (
          <Link2 className="h-5 w-5" />
        ),
        label: linkCopied ? 'Copied!' : 'Copy Link',
        handler: () => {
          onCopyLink();
          setMoreSheetOpen(false);
        },
      },
      {
        key: 'print',
        icon: <Printer className="h-5 w-5" />,
        label: 'Print',
        handler: () => {
          onPrint();
          setMoreSheetOpen(false);
        },
      },
    ];

    if (canConformLots && lot.status !== 'claimed') {
      overflowActions.push({
        key: 'override-status',
        icon: <RefreshCw className="h-5 w-5" />,
        label: 'Override Workflow Status',
        handler: () => {
          onOverrideStatus();
          setMoreSheetOpen(false);
        },
      });
    }

    return (
      <>
        {/* Mobile header */}
        <div className="flex flex-col gap-3">
          {/* Title row: QR + lot info + status badge */}
          <div className="flex items-start gap-3">
            <LotQRCode
              lotId={lotId}
              lotNumber={lot.lotNumber}
              projectId={projectId}
              size="medium"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{lot.lotNumber}</h1>
                {statusBadge}
              </div>
              <p className="text-sm text-muted-foreground">{lot.description || 'No description'}</p>
            </div>
          </div>

          {/* Action row: primary + overflow More button */}
          <div className="flex items-center gap-2">
            {hasPrimary && (
              <button
                type="button"
                onClick={onEdit}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors min-h-[44px]"
              >
                Edit Lot
              </button>
            )}
            <button
              type="button"
              onClick={() => setMoreSheetOpen(true)}
              className="rounded-lg border border-border p-2.5 hover:bg-muted/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="More actions"
              data-testid="lot-header-more-button"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
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

        {/* Overflow actions bottom sheet */}
        <BottomSheet
          isOpen={moreSheetOpen}
          onClose={() => setMoreSheetOpen(false)}
          title="More actions"
        >
          <div className="space-y-1">
            {overflowActions.map((action) => (
              <OverflowActionRow
                key={action.key}
                icon={action.icon}
                label={action.label}
                onClick={action.handler}
              />
            ))}
          </div>
        </BottomSheet>
      </>
    );
  }

  // ── Desktop layout (unchanged) ──────────────────────────────────────────────
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
          <AskClancyButton
            question={`What is the status of lot ${lot.lotNumber}?`}
            label="Ask Clancy"
          />
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
          {canEditLot && isEditable && (
            <button
              onClick={onEdit}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
            >
              Edit Lot
            </button>
          )}
          {/* Subcontractor assignment lives in the Subcontractor Assignments
              section below (per-lot permissions, many companies). The legacy
              single-assignment header button is retired. */}
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
          {statusBadge}
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
