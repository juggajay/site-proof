import { Building2, DollarSign, Plus, Users } from 'lucide-react';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';

interface SubcontractorsPageHeaderProps {
  showRemoved: boolean;
  removedCount: number;
  onShowRemovedChange: (showRemoved: boolean) => void;
  onInviteSubcontractor: () => void;
}

export function SubcontractorsPageHeader({
  showRemoved,
  removedCount,
  onShowRemovedChange,
  onInviteSubcontractor,
}: SubcontractorsPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Subcontractors</h1>
          <ContextHelp
            title={HELP_CONTENT.subcontractors.title}
            content={HELP_CONTENT.subcontractors.content}
          />
        </div>
        <p className="text-muted-foreground mt-1">
          Manage subcontractor companies, employees, and rates
        </p>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <button
            type="button"
            role="switch"
            aria-checked={showRemoved}
            aria-label="Show removed subcontractors"
            onClick={() => onShowRemovedChange(!showRemoved)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showRemoved ? 'bg-destructive' : 'bg-muted-foreground/30'}`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${showRemoved ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
            />
          </button>
          <span className="text-muted-foreground">
            Show removed{removedCount > 0 && showRemoved ? ` (${removedCount})` : ''}
          </span>
        </label>
        <button
          type="button"
          onClick={onInviteSubcontractor}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Invite Subcontractor
        </button>
      </div>
    </div>
  );
}

interface SubcontractorsLoadErrorAlertProps {
  loadError: string | null;
  onRetry: () => void;
}

export function SubcontractorsLoadErrorAlert({
  loadError,
  onRetry,
}: SubcontractorsLoadErrorAlertProps) {
  if (!loadError) return null;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
    >
      <span>{loadError}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-destructive/30 bg-card px-3 py-1 font-medium text-destructive hover:bg-destructive/10"
      >
        Try again
      </button>
    </div>
  );
}

interface PendingApprovalsAlertProps {
  summary: string;
  onReviewPendingApprovals: () => void;
}

export function PendingApprovalsAlert({
  summary,
  onReviewPendingApprovals,
}: PendingApprovalsAlertProps) {
  if (!summary) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-semibold text-warning">Pending Approvals</h3>
        <p className="text-sm text-warning mt-1">{summary}</p>
      </div>
      <button
        type="button"
        onClick={onReviewPendingApprovals}
        className="self-start rounded-md border border-warning/30 bg-card px-3 py-2 text-sm font-medium text-warning hover:bg-warning/10 sm:self-auto"
      >
        Review pending approvals
      </button>
    </div>
  );
}

interface SubcontractorSummaryCardsProps {
  subcontractorCount: number;
  totalEmployees: number;
  totalCostLabel: string;
}

export function SubcontractorSummaryCards({
  subcontractorCount,
  totalEmployees,
  totalCostLabel,
}: SubcontractorSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span className="text-sm">Total Subcontractors</span>
        </div>
        <p className="text-2xl font-bold mt-2">{subcontractorCount}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span className="text-sm">Total Employees</span>
        </div>
        <p className="text-2xl font-bold mt-2">{totalEmployees}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          <span className="text-sm">Total Cost to Date</span>
        </div>
        <p className="text-2xl font-bold mt-2">{totalCostLabel}</p>
      </div>
    </div>
  );
}
