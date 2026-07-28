import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Check, RefreshCw, Printer, MoreVertical, Pencil } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { LotQRCode } from '@/components/lots/LotQRCode';
import { AskClancyButton } from '@/components/copilot/AskClancy';
import { Button } from '@/components/ui/button';
import type { Lot, LotSubcontractorAssignment, LotTab } from '../types';
import type { LotEvidenceReadiness } from '@/types/evidenceReadiness';
import { pickPrimaryReadinessAction } from '../lib/readinessActions';
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
  // Evidence readiness for this lot. Its top-ranked actionable item earns the
  // header's single solid primary button (A4 spec §7); everything else in the
  // cluster collapses behind the overflow.
  readiness?: LotEvidenceReadiness | null;
  onReadinessAction?: (tab: LotTab, actionCode?: string) => void;
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
  readiness,
  onReadinessAction,
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
  // `actualRole` — the RoleSwitcher-aware role — gates the primary action's
  // destination. `user.role` would be wrong under a role switch.
  const { actualRole } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Desktop overflow is a plain anchored popover (the LotContextMenu pattern),
  // so it closes on any outside click.
  useEffect(() => {
    if (!moreOpen || isMobile) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreOpen, isMobile]);

  const statusBadge = (
    <span className={`px-3 py-1 rounded text-sm font-medium ${getLotStatusBadgeClass(lot.status)}`}>
      {formatStatusLabel(lot.status)}
    </span>
  );

  // The one action that earns the solid primary slot. A tab action needs a
  // handler to run through; without one there is no primary — we never
  // fabricate an action to fill the slot.
  const topAction = pickPrimaryReadinessAction(readiness, actualRole);
  const primary = topAction && (topAction.href || onReadinessAction) ? topAction : null;
  const canEdit = Boolean(canEditLot && isEditable);
  // Edit Lot only holds the slot when nothing outranked it.
  const editIsFallback = !primary && canEdit;

  const primaryButton = (className: string) => {
    if (primary) {
      return primary.href ? (
        // A router Link, not <a href> — the destination is an in-app route, and
        // a full document reload here threw away the whole lot page's cache.
        <Button asChild className={className}>
          <Link to={primary.href}>{primary.label}</Link>
        </Button>
      ) : (
        <Button
          className={className}
          onClick={() => {
            if (primary.tab) onReadinessAction?.(primary.tab, primary.code);
          }}
        >
          {primary.label}
        </Button>
      );
    }
    if (editIsFallback) {
      return (
        <Button variant="outline" className={className} onClick={onEdit}>
          Edit Lot
        </Button>
      );
    }
    return null;
  };

  // Everything the primary slot displaced, in one list shared by the mobile
  // sheet and the desktop popover. Permission gating is unchanged.
  const overflowActions: {
    key: string;
    icon: React.ReactNode;
    label: string;
    handler: () => void;
  }[] = [
    {
      key: 'copy-link',
      icon: linkCopied ? <Check className="h-5 w-5 text-success" /> : <Link2 className="h-5 w-5" />,
      label: linkCopied ? 'Copied!' : 'Copy Link',
      handler: () => {
        onCopyLink();
        setMoreOpen(false);
      },
    },
    {
      key: 'print',
      icon: <Printer className="h-5 w-5" />,
      label: 'Print',
      handler: () => {
        onPrint();
        setMoreOpen(false);
      },
    },
  ];

  if (canEdit && !editIsFallback) {
    overflowActions.push({
      key: 'edit-lot',
      icon: <Pencil className="h-5 w-5" />,
      label: 'Edit Lot',
      handler: () => {
        onEdit();
        setMoreOpen(false);
      },
    });
  }

  if (canConformLots && lot.status !== 'claimed') {
    overflowActions.push({
      key: 'override-status',
      icon: <RefreshCw className="h-5 w-5" />,
      label: 'Override Workflow Status',
      handler: () => {
        onOverrideStatus();
        setMoreOpen(false);
      },
    });
  }

  if (isMobile) {
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
            {primaryButton('flex-1 min-h-[44px]')}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
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
        <BottomSheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} title="More actions">
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
        {/* One primary action, the status chip, then everything else behind the
            overflow (A4 spec §7). Subcontractor assignment lives in the
            Subcontractor Assignments section below; the legacy single-assignment
            header button is retired. */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {primaryButton('')}
          {statusBadge}
          <div className="relative print:hidden" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              className="flex items-center justify-center rounded-lg border border-border p-2 hover:bg-muted/50 transition-colors"
              aria-label="More actions"
              aria-expanded={moreOpen}
              data-testid="lot-header-more-button"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {moreOpen && (
              <div className="absolute right-0 z-50 mt-2 min-w-[240px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
                <AskClancyButton
                  question={`What is the status of lot ${lot.lotNumber}?`}
                  label="Ask Clancy"
                  className="w-full justify-start gap-3 px-4 py-3"
                />
                {overflowActions.map((action) => (
                  <OverflowActionRow
                    key={action.key}
                    icon={action.icon}
                    label={action.label}
                    onClick={action.handler}
                  />
                ))}
              </div>
            )}
          </div>
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
