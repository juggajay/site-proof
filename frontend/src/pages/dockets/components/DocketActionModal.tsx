import { useRef, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import type { Docket } from '../docketApprovalsData';
import {
  type DocketActionType,
  HOURS_INPUT_ERROR,
  buildDocketActionPath,
  buildDocketActionPayload,
  hasHoursChanged,
  parseHoursInput,
  resolveDocketActionEndpoint,
  statusColors,
  statusLabels,
  useDocketDetailEntriesQuery,
  validateHours,
} from '../docketActionData';

interface DocketActionModalProps {
  docket: Docket;
  initialActionType: DocketActionType;
  canApprove: boolean;
  // Cancel / close the modal without acting (mirrors the old X + Cancel buttons,
  // which only flipped actionModalOpen and left selectedDocket in place).
  onClose: () => void;
  // Run after a successful approve/reject/query (the page closes the modal,
  // clears the selected docket, and refetches the list).
  onActionComplete: () => Promise<void> | void;
}

export function DocketActionModal({
  docket,
  initialActionType,
  canApprove,
  onClose,
  onActionComplete,
}: DocketActionModalProps) {
  const [actionType, setActionType] = useState<DocketActionType>(initialActionType);
  const [actionNotes, setActionNotes] = useState('');
  // Adjusted values initialise from the submitted hours, exactly as the old
  // openActionModal did each time it opened.
  const [adjustedLabourHours, setAdjustedLabourHours] = useState(String(docket.labourHours || 0));
  const [adjustedPlantHours, setAdjustedPlantHours] = useState(String(docket.plantHours || 0));
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);
  const actionInProgressRef = useRef(false);

  const detailQuery = useDocketDetailEntriesQuery(docket.id);
  const detailLoading = detailQuery.isLoading;
  const labourEntries = detailQuery.data?.labourEntries ?? [];
  const plantEntries = detailQuery.data?.plantEntries ?? [];

  const adjustedLabourValidation = validateHours(adjustedLabourHours);
  const adjustedPlantValidation = validateHours(adjustedPlantHours);

  // Handle approve or reject action
  const handleAction = async () => {
    if (actionInProgressRef.current) return;

    let adjustedLabourHoursValue: number | undefined;
    let adjustedPlantHoursValue: number | undefined;
    if (actionType === 'approve') {
      const parsedAdjustedLabourHours = parseHoursInput(adjustedLabourHours);
      const parsedAdjustedPlantHours = parseHoursInput(adjustedPlantHours);
      if (parsedAdjustedLabourHours === null || parsedAdjustedPlantHours === null) {
        toast({ variant: 'warning', description: HOURS_INPUT_ERROR });
        return;
      }
      adjustedLabourHoursValue = parsedAdjustedLabourHours;
      adjustedPlantHoursValue = parsedAdjustedPlantHours;
    }

    if (actionType === 'query' && !actionNotes.trim()) {
      toast({ variant: 'warning', description: 'Please enter the query details.' });
      return;
    }

    actionInProgressRef.current = true;
    setActionInProgress(true);
    const endpoint = resolveDocketActionEndpoint(actionType);

    try {
      await apiFetch(buildDocketActionPath(docket.id, endpoint), {
        method: 'POST',
        body: JSON.stringify(
          buildDocketActionPayload(actionType, {
            actionNotes,
            adjustedLabourHours: adjustedLabourHoursValue,
            adjustedPlantHours: adjustedPlantHoursValue,
            adjustmentReason,
          }),
        ),
      });

      const actionPastTense =
        actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : 'queried';
      toast({
        variant: 'success',
        description: `Docket ${actionPastTense} successfully`,
      });
      await onActionComplete();
    } catch (error) {
      logError(`Error ${actionType}ing docket:`, error);
      toast({
        variant: 'error',
        description: extractErrorMessage(error, `Failed to ${actionType} docket`),
      });
    } finally {
      actionInProgressRef.current = false;
      setActionInProgress(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="docket-action-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="docket-action-title" className="text-xl font-semibold">
            {actionType === 'approve'
              ? 'Approve Docket'
              : actionType === 'reject'
                ? 'Reject Docket'
                : actionType === 'query'
                  ? 'Query Docket'
                  : 'Docket Details'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close docket modal">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-sm">
              <strong>Docket:</strong> {docket.docketNumber}
            </p>
            <p className="text-sm">
              <strong>Subcontractor:</strong> {docket.subcontractor}
            </p>
            <p className="text-sm">
              <strong>Date:</strong> {docket.date}
            </p>
            <p className="text-sm">
              <strong>Status:</strong>{' '}
              <span
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  statusColors[docket.status] || 'bg-muted text-foreground',
                )}
              >
                {statusLabels[docket.status] || docket.status}
              </span>
            </p>
            <p className="text-sm">
              <strong>Labour Hours:</strong> {docket.labourHours}h
              {docket.totalLabourApproved > 0 &&
                docket.totalLabourApproved !== docket.labourHours && (
                  <span className="text-muted-foreground">
                    {' '}
                    (approved: {docket.totalLabourApproved}h)
                  </span>
                )}
            </p>
            <p className="text-sm">
              <strong>Plant Hours:</strong> {docket.plantHours}h
              {docket.totalPlantApproved > 0 && docket.totalPlantApproved !== docket.plantHours && (
                <span className="text-muted-foreground">
                  {' '}
                  (approved: {docket.totalPlantApproved}h)
                </span>
              )}
            </p>
            {docket.notes && (
              <p className="text-sm">
                <strong>Notes:</strong> {docket.notes}
              </p>
            )}
            {docket.foremanNotes && (
              <p className="text-sm">
                <strong>Foreman Notes:</strong> {docket.foremanNotes}
              </p>
            )}
            {docket.submittedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Submitted: {new Date(docket.submittedAt).toLocaleString('en-AU')}
              </p>
            )}
            {docket.approvedAt && (
              <p className="text-xs text-muted-foreground">
                Approved: {new Date(docket.approvedAt).toLocaleString('en-AU')}
              </p>
            )}
          </div>

          {/* Labour & Plant entry details */}
          {detailLoading ? (
            <p className="text-sm text-muted-foreground text-center py-3">Loading entries...</p>
          ) : (
            <>
              {labourEntries.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Labour Entries</h3>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Name</th>
                          <th className="text-left px-3 py-2 font-medium">Role</th>
                          <th className="text-right px-3 py-2 font-medium">Hours</th>
                          <th className="text-right px-3 py-2 font-medium">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {labourEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-3 py-2">{entry.employee.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {entry.employee.role}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {entry.approvedHours > 0 &&
                              entry.approvedHours !== entry.submittedHours ? (
                                <span>
                                  <span className="font-medium">{entry.approvedHours}h</span>
                                  <span className="text-muted-foreground line-through ml-1 text-xs">
                                    {entry.submittedHours}h
                                  </span>
                                </span>
                              ) : (
                                <>{entry.submittedHours}h</>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {entry.approvedCost > 0 &&
                              entry.approvedCost !== entry.submittedCost ? (
                                <span>
                                  <span className="font-medium">
                                    ${entry.approvedCost.toFixed(2)}
                                  </span>
                                  <span className="text-muted-foreground line-through ml-1 text-xs">
                                    ${entry.submittedCost.toFixed(2)}
                                  </span>
                                </span>
                              ) : (
                                <>${entry.submittedCost.toFixed(2)}</>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {plantEntries.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Plant Entries</h3>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Plant</th>
                          <th className="text-left px-3 py-2 font-medium">Type</th>
                          <th className="text-right px-3 py-2 font-medium">Hours</th>
                          <th className="text-right px-3 py-2 font-medium">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {plantEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-3 py-2">
                              {entry.plant.description}
                              {entry.plant.idRego ? ` (${entry.plant.idRego})` : ''}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground capitalize">
                              {entry.wetOrDry}
                            </td>
                            <td className="px-3 py-2 text-right">{entry.hoursOperated}h</td>
                            <td className="px-3 py-2 text-right">
                              {entry.approvedCost > 0 &&
                              entry.approvedCost !== entry.submittedCost ? (
                                <span>
                                  <span className="font-medium">
                                    ${entry.approvedCost.toFixed(2)}
                                  </span>
                                  <span className="text-muted-foreground line-through ml-1 text-xs">
                                    ${entry.submittedCost.toFixed(2)}
                                  </span>
                                </span>
                              ) : (
                                <>${entry.submittedCost.toFixed(2)}</>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {labourEntries.length === 0 && plantEntries.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">No entries found</p>
              )}
            </>
          )}

          {/* View mode: show approve/reject buttons if docket is pending */}
          {actionType === 'view' && docket.status === 'pending_approval' && canApprove && (
            <div className="flex gap-2">
              <Button variant="success" className="flex-1" onClick={() => setActionType('approve')}>
                Approve
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-amber-500 text-amber-700 hover:bg-amber-50"
                onClick={() => setActionType('query')}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Query
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setActionType('reject')}
              >
                Reject
              </Button>
            </div>
          )}

          {actionType === 'approve' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="adjusted-labour-hours" className="block text-sm font-medium mb-1">
                    Adjusted Labour Hours
                  </label>
                  <input
                    id="adjusted-labour-hours"
                    type="number"
                    value={adjustedLabourHours}
                    onChange={(e) => setAdjustedLabourHours(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                      adjustedLabourValidation.warning ? 'border-amber-500' : ''
                    }`}
                    min="0"
                    step="0.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted: {docket.labourHours || 0}h
                  </p>
                  {adjustedLabourValidation.warning && (
                    <p className="mt-1 text-sm text-amber-600 flex items-center gap-1">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      {adjustedLabourValidation.warning}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="adjusted-plant-hours" className="block text-sm font-medium mb-1">
                    Adjusted Plant Hours
                  </label>
                  <input
                    id="adjusted-plant-hours"
                    type="number"
                    value={adjustedPlantHours}
                    onChange={(e) => setAdjustedPlantHours(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                      adjustedPlantValidation.warning ? 'border-amber-500' : ''
                    }`}
                    min="0"
                    step="0.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted: {docket.plantHours || 0}h
                  </p>
                  {adjustedPlantValidation.warning && (
                    <p className="mt-1 text-sm text-amber-600 flex items-center gap-1">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      {adjustedPlantValidation.warning}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="adjustment-reason" className="block text-sm font-medium mb-1">
                  Adjustment Reason{' '}
                  {(hasHoursChanged(adjustedLabourHours, docket.labourHours || 0) ||
                    hasHoursChanged(adjustedPlantHours, docket.plantHours || 0)) &&
                    '*'}
                </label>
                <input
                  id="adjustment-reason"
                  type="text"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Reason for adjustment (if hours changed)"
                />
              </div>
            </>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="docket-action-notes" className="block text-sm font-medium">
                {actionType === 'approve'
                  ? 'Approval Notes'
                  : actionType === 'query'
                    ? 'Query Details'
                    : 'Rejection Reason'}
                {(actionType === 'reject' || actionType === 'query') && ' *'}
              </label>
              {/* Feature #289: Voice-to-text for approval/rejection notes */}
              <VoiceInputButton
                onTranscript={(text) => setActionNotes((prev) => (prev ? prev + ' ' + text : text))}
                appendMode={true}
              />
            </div>
            <textarea
              id="docket-action-notes"
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder={
                actionType === 'approve'
                  ? 'Add any notes (optional)...'
                  : actionType === 'query'
                    ? 'Ask what needs to be clarified before approval...'
                    : 'Please provide a reason for rejection...'
              }
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>
            {actionType === 'view' ? 'Close' : 'Cancel'}
          </Button>
          {actionType !== 'view' && (
            <Button
              variant={
                actionType === 'approve'
                  ? 'success'
                  : actionType === 'reject'
                    ? 'destructive'
                    : 'default'
              }
              onClick={handleAction}
              disabled={
                actionInProgress ||
                ((actionType === 'reject' || actionType === 'query') && !actionNotes.trim())
              }
            >
              {actionInProgress
                ? actionType === 'approve'
                  ? 'Approving...'
                  : actionType === 'reject'
                    ? 'Rejecting...'
                    : 'Querying...'
                : actionType === 'approve'
                  ? 'Approve'
                  : actionType === 'reject'
                    ? 'Reject'
                    : 'Send Query'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
