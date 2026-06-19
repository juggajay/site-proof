import { Link } from 'react-router-dom';
import { MessageSquare, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { statusColors, statusLabels } from '../docketActionData';
import {
  formatDocketCurrency,
  getDocketDisplayTotalCost,
  getDocketSubmittedTotalCost,
  hasDocketCostAdjustment,
  type Docket,
} from '../docketApprovalsData';

// Extracted from DocketApprovalsPage: the desktop dockets table, including the
// loading row, both empty states, and the per-row print/submit/approve/query/
// reject actions. All queries, mutations, filtering state, and the action
// modal trigger stay on the page; this component is prop-driven and
// presentation-only, mirroring DocketApprovalsMobileView's callback API.
export function DocketApprovalsTable({
  loading,
  filteredDockets,
  submittedDockets,
  statusFilter,
  subcontractorSetupHref,
  canApprove,
  isSubcontractor,
  printingDocketId,
  onTapDocket,
  onPrintDocket,
  onSubmitDocket,
  onApprove,
  onQuery,
  onReject,
}: {
  loading: boolean;
  filteredDockets: Docket[];
  submittedDockets: Docket[];
  statusFilter: string;
  subcontractorSetupHref: string;
  canApprove: boolean;
  isSubcontractor: boolean;
  printingDocketId: string | null;
  onTapDocket: (docket: Docket) => void;
  onPrintDocket: (docket: Docket) => Promise<void>;
  onSubmitDocket: (docket: Docket) => void;
  onApprove: (docket: Docket) => void;
  onQuery: (docket: Docket) => void;
  onReject: (docket: Docket) => void;
}) {
  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Docket #</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Subcontractor</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Labour Hrs</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Plant Hrs</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Cost</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2">Loading dockets...</span>
                </div>
              </td>
            </tr>
          ) : filteredDockets.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                {submittedDockets.length === 0 ? (
                  <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                    <div>
                      <p className="font-medium text-foreground">No subcontractor dockets yet</p>
                      <p className="mt-1 text-sm">
                        Subcontractors submit dockets from their portal. Invite a subcontractor and
                        assign lots to start receiving dockets.
                      </p>
                    </div>
                    <Button asChild variant="outline">
                      <Link to={subcontractorSetupHref}>Invite a subcontractor</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {statusFilter === 'pending_approval'
                          ? 'All caught up'
                          : `No ${statusLabels[statusFilter]?.toLowerCase() || 'matching'} dockets`}
                      </p>
                      <p className="mt-1 text-sm">
                        {statusFilter === 'pending_approval'
                          ? 'No dockets are waiting for review. Use All Dockets to view approved and rejected history.'
                          : 'Try a different filter to view the rest of the docket history.'}
                      </p>
                    </div>
                  </div>
                )}
              </td>
            </tr>
          ) : (
            filteredDockets.map((docket) => (
              <tr
                key={docket.id}
                className="hover:bg-muted/30 cursor-pointer"
                onClick={() => onTapDocket(docket)}
              >
                <td className="px-4 py-3 text-sm font-medium">{docket.docketNumber}</td>
                <td className="px-4 py-3 text-sm">{docket.subcontractor}</td>
                <td className="px-4 py-3 text-sm">{docket.date}</td>
                <td className="px-4 py-3 text-sm max-w-xs truncate" title={docket.notes || ''}>
                  {docket.notes || '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {docket.status === 'approved' &&
                  docket.totalLabourApproved !== docket.labourHours ? (
                    <span>
                      <span className="font-medium">{docket.totalLabourApproved}h</span>
                      <span className="text-muted-foreground line-through ml-1 text-xs">
                        {docket.labourHours}h
                      </span>
                    </span>
                  ) : (
                    <>{docket.labourHours}h</>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {docket.status === 'approved' &&
                  docket.totalPlantApproved !== docket.plantHours ? (
                    <span>
                      <span className="font-medium">{docket.totalPlantApproved}h</span>
                      <span className="text-muted-foreground line-through ml-1 text-xs">
                        {docket.plantHours}h
                      </span>
                    </span>
                  ) : (
                    <>{docket.plantHours}h</>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {hasDocketCostAdjustment(docket) ? (
                    <span>
                      <span className="font-medium">
                        {formatDocketCurrency(getDocketDisplayTotalCost(docket))}
                      </span>
                      <span className="text-muted-foreground line-through ml-1 text-xs">
                        {formatDocketCurrency(getDocketSubmittedTotalCost(docket))}
                      </span>
                    </span>
                  ) : (
                    <>{formatDocketCurrency(getDocketDisplayTotalCost(docket))}</>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${statusColors[docket.status] || 'bg-muted'}`}
                  >
                    {statusLabels[docket.status] || docket.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2">
                    {/* Print button - always visible */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => void onPrintDocket(docket)}
                      disabled={printingDocketId === docket.id}
                      title="Print docket"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    {/* Submit button for draft dockets (subcontractor only) */}
                    {docket.status === 'draft' && isSubcontractor && (
                      <Button size="sm" onClick={() => onSubmitDocket(docket)}>
                        Submit
                      </Button>
                    )}
                    {/* Approve/Reject buttons for pending dockets (approvers only) */}
                    {docket.status === 'pending_approval' && canApprove && (
                      <>
                        <Button variant="success" size="sm" onClick={() => onApprove(docket)}>
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-warning text-warning hover:bg-warning/10"
                          onClick={() => onQuery(docket)}
                        >
                          <MessageSquare className="mr-1 h-4 w-4" />
                          Query
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => onReject(docket)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
