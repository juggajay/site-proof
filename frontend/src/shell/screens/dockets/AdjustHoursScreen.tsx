/**
 * AdjustHoursScreen — /m/dockets/:docketId/adjust
 *
 * Full-screen form preserving the DocketActionModal's approve-with-adjustment
 * capability: the foreman edits the approved labour/plant hours, optionally adds
 * an adjustment reason, and approves. This is the shell idiom (a full screen)
 * instead of cramming an inline editor under the one-tap Approve.
 *
 * PARITY with the modal's approve path:
 *   - hours validated with the shared parseHoursInput / validateHours
 *     (non-negative decimals; a soft >24 warning, exactly like the modal);
 *   - the adjustment reason is marked required (*) once either field differs from
 *     the submitted hours — matching the modal's `*` cue (which, like the modal,
 *     is an honest prompt, not a hard backend gate);
 *   - the payload is the modal's approve payload via buildDocketActionPayload:
 *     { foremanNotes, adjustedLabourHours, adjustedPlantHours, adjustmentReason }.
 *
 * Offline: approval is online-only; the submit disables offline with an honest
 * note.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { useDocketsShellContext } from './docketsShellContext';
import { useShellDocketParam } from './useShellDocketParam';
import { useDocketAction } from './useDocketAction';
import {
  HOURS_INPUT_ERROR,
  hasHoursChanged,
  parseHoursInput,
  validateHours,
} from '@/pages/dockets/docketActionData';
import { toast } from '@/components/ui/toaster';

export function AdjustHoursScreen() {
  const navigate = useNavigate();
  const { isOnline } = useOfflineStatus();
  const docketId = useShellDocketParam();
  const { projectId, dockets, refetch } = useDocketsShellContext();
  const { submitting, runAction } = useDocketAction(projectId);

  const docket = useMemo(() => dockets.find((d) => d.id === docketId) ?? null, [dockets, docketId]);

  const [labour, setLabour] = useState(String(docket?.labourHours ?? 0));
  const [plant, setPlant] = useState(String(docket?.plantHours ?? 0));
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const detailPath = projectId
    ? `/m/dockets/${docketId}?projectId=${projectId}`
    : `/m/dockets/${docketId}`;
  const listPath = projectId ? `/m/dockets?projectId=${projectId}` : '/m/dockets';

  const labourValidation = validateHours(labour);
  const plantValidation = validateHours(plant);
  const submittedLabour = docket?.labourHours ?? 0;
  const submittedPlant = docket?.plantHours ?? 0;
  const hoursChanged =
    hasHoursChanged(labour, submittedLabour) || hasHoursChanged(plant, submittedPlant);

  const handleSubmit = () => {
    if (!docket) return;
    const parsedLabour = parseHoursInput(labour);
    const parsedPlant = parseHoursInput(plant);
    if (parsedLabour === null || parsedPlant === null) {
      toast({ variant: 'warning', description: HOURS_INPUT_ERROR });
      return;
    }
    void runAction({
      docketId: docket.id,
      actionType: 'approve',
      actionNotes: notes,
      adjustedLabourHours: parsedLabour,
      adjustedPlantHours: parsedPlant,
      adjustmentReason: reason,
    }).then((ok) => {
      if (ok) {
        void refetch();
        navigate(listPath);
      }
    });
  };

  const parseOk = parseHoursInput(labour) !== null && parseHoursInput(plant) !== null;
  const canSubmit = parseOk && isOnline && Boolean(docket);

  if (!docket) {
    return (
      <ShellScreen
        variant="inner"
        title="Adjust Hours"
        parent={listPath}
        sub={<span>Not found</span>}
      >
        <div className="py-16 text-center text-[14px] text-muted-foreground">
          This docket isn’t here anymore.
        </div>
      </ShellScreen>
    );
  }

  return (
    <ShellScreen
      variant="inner"
      title="Adjust Hours"
      parent={detailPath}
      sub={
        <span className="text-muted-foreground">
          {docket.docketNumber} · {docket.subcontractor}
        </span>
      }
      bottom={
        <div className="shell-cambar flex flex-col gap-2">
          {!isOnline && (
            <p className="px-1 text-center text-[12.5px] font-semibold text-warning" role="status">
              Approvals need signal — reconnect to approve.
            </p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className={cn('shell-cambar-btn', (!canSubmit || submitting) && 'opacity-50')}
            aria-label="Approve with adjusted hours"
          >
            {submitting ? (
              <>
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                Approving…
              </>
            ) : (
              'Approve adjusted hours'
            )}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="adjust-labour"
            className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
          >
            Labour hours
          </label>
          <input
            id="adjust-labour"
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={labour}
            onChange={(e) => setLabour(e.target.value)}
            className={cn(
              'w-full min-h-[52px] rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground touch-manipulation',
              labourValidation.warning && 'border-warning',
            )}
          />
          <p className="mt-1 text-[12px] text-muted-foreground">Submitted: {submittedLabour}h</p>
          {labourValidation.warning && (
            <p className="mt-1 text-[13px] text-warning" role="alert">
              {labourValidation.warning}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="adjust-plant"
            className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
          >
            Plant hours
          </label>
          <input
            id="adjust-plant"
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={plant}
            onChange={(e) => setPlant(e.target.value)}
            className={cn(
              'w-full min-h-[52px] rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground touch-manipulation',
              plantValidation.warning && 'border-warning',
            )}
          />
          <p className="mt-1 text-[12px] text-muted-foreground">Submitted: {submittedPlant}h</p>
          {plantValidation.warning && (
            <p className="mt-1 text-[13px] text-warning" role="alert">
              {plantValidation.warning}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="adjust-reason"
          className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
        >
          Adjustment reason {hoursChanged && '*'}
        </label>
        <input
          id="adjust-reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for adjustment (if hours changed)"
          autoCapitalize="sentences"
          className="w-full min-h-[52px] rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground touch-manipulation"
        />
      </div>

      <div>
        <label
          htmlFor="adjust-notes"
          className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
        >
          Approval notes
        </label>
        <textarea
          id="adjust-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes (optional)…"
          rows={3}
          autoCapitalize="sentences"
          className="w-full min-h-[88px] resize-none rounded-xl border border-border bg-card px-3 py-3 text-[15px] leading-[1.5] text-foreground touch-manipulation"
        />
      </div>
    </ShellScreen>
  );
}
