import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Docket } from '../docketEditData';
import { formatCurrency, formatDate } from '../docketEditDisplay';
import { LOTS_MODULE_DISABLED_DOCKET_MESSAGE } from '../subcontractorDashboardHelpers';

export function DocketEditLoading() {
  return (
    <div className="container max-w-2xl mx-auto p-4 flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

interface DocketEditErrorProps {
  message: string;
}

export function DocketEditError({ message }: DocketEditErrorProps) {
  return (
    <div className="container max-w-2xl mx-auto p-4">
      <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <p>{message}</p>
      </div>
      <Link
        to="/subcontractor-portal"
        className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-border rounded-lg hover:bg-muted/50 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Portal
      </Link>
    </div>
  );
}

interface DocketEditHeaderProps {
  docket: Docket | null;
  isNewDocket: boolean;
  projectName?: string;
  today: string;
}

export function DocketEditHeader({
  docket,
  isNewDocket,
  projectName,
  today,
}: DocketEditHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Link to="/subcontractor-portal" className="p-2 rounded-lg hover:bg-muted transition-colors">
        <ArrowLeft className="h-5 w-5 text-muted-foreground" />
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {isNewDocket ? "Today's Docket" : `Docket ${docket?.docketNumber || ''}`}
        </h1>
        <p className="text-sm text-muted-foreground">{formatDate(docket?.date || today)}</p>
        {projectName && <p className="text-xs text-muted-foreground">Project: {projectName}</p>}
      </div>
      {docket && (
        <span
          className={cn(
            'ml-auto px-2.5 py-1 text-xs font-medium rounded-full',
            docket.status === 'approved' && 'bg-success/10 text-success',
            docket.status === 'pending_approval' && 'bg-warning/10 text-warning',
            docket.status === 'queried' && 'bg-warning/10 text-warning',
            docket.status === 'rejected' && 'bg-destructive/10 text-destructive',
            docket.status === 'draft' && 'bg-muted text-foreground',
          )}
        >
          {docket.status === 'draft'
            ? 'Draft'
            : docket.status === 'pending_approval'
              ? 'Pending'
              : docket.status === 'queried'
                ? 'Queried'
                : docket.status === 'rejected'
                  ? 'Rejected'
                  : docket.status === 'approved'
                    ? 'Approved'
                    : docket.status}
        </span>
      )}
    </div>
  );
}

interface DocketEditNoticesProps {
  docket: Docket | null;
  queryResponse: string;
  respondingToQuery: boolean;
  assignedLotCount: number;
  // True when the assigned-lots fetch 403'd because the HC disabled the subbie's
  // "Assigned Work" (lots) portal module. Distinguishes "module off" (HC must
  // enable lot access) from "module on, but no lots assigned yet".
  lotsModuleDisabled: boolean;
  onQueryResponseChange: (value: string) => void;
  onRespondToQuery: () => void;
}

export function DocketEditNotices({
  docket,
  queryResponse,
  respondingToQuery,
  assignedLotCount,
  lotsModuleDisabled,
  onQueryResponseChange,
  onRespondToQuery,
}: DocketEditNoticesProps) {
  return (
    <>
      {docket?.status === 'queried' && (
        <div className="mb-4 border border-warning/30 rounded-lg bg-warning/10 overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-warning">
              <strong>Query from foreman:</strong>{' '}
              {docket.foremanNotes || 'Please review this docket'}
            </div>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <Textarea
              value={queryResponse}
              onChange={(e) => onQueryResponseChange(e.target.value)}
              placeholder="Type your response to the query..."
              rows={3}
              className="border-warning/40 focus-visible:ring-warning"
            />
            <Button
              onClick={onRespondToQuery}
              disabled={!queryResponse.trim() || respondingToQuery}
              className={cn(
                'w-full',
                queryResponse.trim() && !respondingToQuery
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : '',
              )}
            >
              {respondingToQuery ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Respond &amp; Resubmit
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {docket?.status === 'rejected' && (
        <div className="flex items-start gap-3 p-4 mb-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-destructive">
            <strong>Rejection reason:</strong> {docket.foremanNotes || 'No reason provided'}
            <p className="text-sm mt-2 text-destructive/90">
              You can edit the entries below and resubmit using the button at the bottom.
            </p>
          </div>
        </div>
      )}

      {lotsModuleDisabled ? (
        <div className="flex items-start gap-3 p-4 mb-4 bg-primary/5 border border-primary/30 rounded-lg">
          <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-primary">{LOTS_MODULE_DISABLED_DOCKET_MESSAGE}</p>
        </div>
      ) : (
        assignedLotCount === 0 && (
          <div className="flex items-start gap-3 p-4 mb-4 bg-primary/5 border border-primary/30 rounded-lg">
            <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-primary">
              No lots have been assigned to you yet. Contact your project manager to get lot
              assignments.
            </p>
          </div>
        )
      )}
    </>
  );
}

interface DocketEditActionBarProps {
  canEdit: boolean;
  canSubmit: boolean;
  docketStatus?: Docket['status'];
  submitting: boolean;
  totalCost: number;
  onSubmit: () => void;
}

export function DocketEditActionBar({
  canEdit,
  canSubmit,
  docketStatus,
  submitting,
  totalCost,
  onSubmit,
}: DocketEditActionBarProps) {
  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 p-4 bg-background border-t border-border md:relative md:border-0 md:bg-transparent md:p-0 md:mt-6 md:z-auto">
      <div className="container max-w-2xl mx-auto flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(totalCost)}</p>
        </div>
        {canEdit && docketStatus !== 'queried' && (
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || submitting}
            className={cn(
              'px-6 py-3 h-auto',
              canSubmit && !submitting
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                : '',
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {docketStatus === 'rejected' ? 'Resubmit for Approval' : 'Submit for Approval'}
              </>
            )}
          </Button>
        )}
        {canEdit && docketStatus === 'queried' && (
          <p className="text-sm text-warning text-right">Respond to the query above to resubmit.</p>
        )}
        {!canEdit && docketStatus === 'pending_approval' && (
          <span className="px-4 py-2 text-base bg-muted text-muted-foreground rounded-lg">
            Awaiting Approval
          </span>
        )}
        {!canEdit && docketStatus === 'approved' && (
          <span className="px-4 py-2 text-base bg-success/10 text-success rounded-lg">
            Approved
          </span>
        )}
      </div>
    </div>
  );
}
