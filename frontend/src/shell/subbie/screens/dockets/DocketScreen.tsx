/**
 * DocketScreen — /p/docket (today) and /p/docket/:docketId — the subbie's
 * primary money workflow on the mobile shell.
 *
 * Design spec: docs/design-subbie-shell-mock-v1.html #docket / #submitted /
 * #queried. State machine + every payload come from the CLASSIC DocketEditPage:
 * this screen is a re-skin over the same logic, NOT a reimplementation.
 *
 *   - Bootstrap queries: useMyCompanyQuery / useAssignedLotsQuery /
 *     useDocketEditQuery / useExistingDocketsQuery (classic docketEditData hooks,
 *     same query keys → shared cache with the classic portal).
 *   - Today-detection: findTodayDocket + formatDateKey (imported, never reimplemented).
 *   - Money helpers: calculateHours / parseDailyHoursInput / isEditableDocketStatus
 *     (imported). Running totals come from each mutation's runningTotal.cost.
 *   - Submit / respond: useDocketSubmitActions (parameterized with /p redirect +
 *     onSubmitted callback so submit shows the in-shell confirmation state).
 *
 * Lazy creation: NO docket POST until the first entry is added (ensureDocket),
 * then history.replace to /p/docket/:id — exactly as classic.
 *
 * Online-only (classic has no offline docket queue — we keep it that way).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertTriangle, Loader2, Send, Check, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { handleApiError } from '@/lib/errorHandling';
import { cn } from '@/lib/utils';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { DictationMicButton } from '@/components/ui/DictationMicButton';
import {
  getDocketDisplayLabourEntryCost,
  getDocketDisplayLabourEntryHours,
  getDocketDisplayLabourCost,
  getDocketDisplayPlantEntryCost,
  getDocketDisplayPlantCost,
  getDocketDisplayTotalCost,
  hasDocketLabourEntryAdjustment,
  hasDocketPlantEntryCostAdjustment,
} from '@/pages/subcontractor-portal/docketEditData';
import {
  parseDailyHoursInput,
  PLANT_HOURS_INPUT_ERROR,
} from '@/pages/subcontractor-portal/docketEditHelpers';
import { useDocketEditorController } from '@/pages/subcontractor-portal/useDocketEditorController';
import { useDocketEntrySheetState } from '@/pages/subcontractor-portal/useDocketEntrySheetState';
import { useDocketSubmitActions } from '@/pages/subcontractor-portal/useDocketSubmitActions';
import { formatCurrency } from '@/pages/subcontractor-portal/subcontractorDashboardHelpers';
import { LOTS_MODULE_DISABLED_DOCKET_MESSAGE } from '@/pages/subcontractor-portal/subcontractorDashboardHelpers';
import { buildPortalCompanyQuery } from '@/pages/subcontractor-portal/portalCompanyScope';
import { LabourSheet, PlantSheet } from './DocketEntrySheets';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: 'DRAFT', cls: 'shell-badge-draft' },
  pending_approval: { label: 'PENDING', cls: 'shell-badge-pend' },
  approved: { label: 'APPROVED', cls: 'shell-badge-ok' },
  queried: { label: 'QUERIED', cls: 'shell-badge-pend' },
  rejected: { label: 'REJECTED', cls: 'shell-badge-bad' },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  return <span className={cn('shell-badge', meta.cls)}>{meta.label}</span>;
}

// Time range like "7:00 – 15:00" for a labour entry row.
function formatTimeRange(start: string, finish: string): string {
  const trim = (t: string) => t.replace(/^0/, '');
  return `${trim(start)} – ${trim(finish)}`;
}

export function DocketScreen() {
  const navigate = useNavigate();
  const [queryResponse, setQueryResponse] = useState('');
  // After a successful submit we show the mock #submitted confirmation in-shell.
  const [submittedConfirm, setSubmittedConfirm] = useState<{
    total: number;
    entryCount: number;
    date: string;
  } | null>(null);

  // Shell route: /p/docket/:id (stays inside the mobile shell).
  const buildDocketPath = useCallback(
    (
      docketId: string,
      scope: { projectId?: string | null; subcontractorCompanyId?: string | null },
    ) => `/p/docket/${encodeURIComponent(docketId)}${buildPortalCompanyQuery(scope)}`,
    [],
  );

  const {
    isNewDocket,
    today,
    requestedProjectId,
    requestedSubcontractorCompanyId,
    company,
    assignedLots,
    lotsModuleDisabled,
    loading,
    error,
    docket,
    notes,
    setNotes,
    saving,
    saveDocketNotes,
    handleNotesBlur,
    postLabourEntry,
    postPlantEntry,
    removeLabourEntry,
    removePlantEntry,
    isOnline,
    canEdit,
    canWrite,
    canSubmit,
  } = useDocketEditorController({ buildDocketPath });

  // ── Entry-sheet state (classic hook — money preview + validation) ───────────
  const {
    sheetOpen,
    sheetType,
    selectedEmployee,
    selectedPlant,
    startTime,
    finishTime,
    hoursOperated,
    wetOrDry,
    selectedLotId,
    labourHoursError,
    plantHoursError,
    previewHours,
    previewCost,
    setStartTime,
    setFinishTime,
    setHoursOperated,
    setWetOrDry,
    setSelectedLotId,
    setSelectedEmployee,
    setSelectedPlant,
    resetSheetState,
    openAddLabour,
    openAddPlant,
    closeSheet,
  } = useDocketEntrySheetState(assignedLots);

  // ── Add labour ──────────────────────────────────────────────────────────────
  // keepOpen backs "Save & add another": the sheet stays open with the times and
  // lot retained, only the person cleared, so a foreman logging a whole crew on
  // the same shift doesn't reopen and re-set the times for every worker.
  const addLabourEntry = async (keepOpen = false) => {
    if (!selectedEmployee || !selectedLotId) {
      toast({
        title: 'Missing information',
        description: 'Please select an employee and a lot',
        variant: 'error',
      });
      return;
    }
    try {
      await postLabourEntry({
        employeeId: selectedEmployee.id,
        startTime,
        finishTime,
        lotId: selectedLotId,
      });
      if (keepOpen) {
        setSelectedEmployee(null);
      } else {
        closeSheet();
        resetSheetState();
      }
      toast({ title: 'Labour entry added', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to add labour entry');
    }
  };

  // ── Add plant ─────────────────────────────────────────────────────────────────
  // keepOpen backs "Save & add another": retains hours + wet/dry + lot, clears
  // only the machine (see addLabourEntry).
  const addPlantEntry = async (keepOpen = false) => {
    if (!selectedPlant) {
      toast({
        title: 'Missing information',
        description: 'Please select plant/equipment',
        variant: 'error',
      });
      return;
    }
    if (assignedLots.length > 0 && !selectedLotId) {
      toast({
        title: 'Missing information',
        description: 'Please select a lot',
        variant: 'error',
      });
      return;
    }
    const parsedHoursOperated = parseDailyHoursInput(hoursOperated);
    if (parsedHoursOperated === null) {
      toast({
        title: 'Invalid hours operated',
        description: PLANT_HOURS_INPUT_ERROR,
        variant: 'warning',
      });
      return;
    }
    try {
      await postPlantEntry({
        plantId: selectedPlant.id,
        hoursOperated: parsedHoursOperated,
        wetOrDry,
        lotId: selectedLotId,
      });
      if (keepOpen) {
        setSelectedPlant(null);
      } else {
        closeSheet();
        resetSheetState();
      }
      toast({ title: 'Plant entry added', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to add plant entry');
    }
  };

  // ── Delete entries (two-tap confirm) ────────────────────────────────────────
  // The readiness guardrail forbids blocking dialogs (window.confirm). First tap
  // arms the row's delete button ("Remove?"), a second tap within 4s deletes;
  // anything else (timeout) disarms.
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    [],
  );
  const confirmArmed = (key: string): boolean => {
    if (armedDelete === key) {
      if (armTimer.current) clearTimeout(armTimer.current);
      setArmedDelete(null);
      return true;
    }
    if (armTimer.current) clearTimeout(armTimer.current);
    setArmedDelete(key);
    armTimer.current = setTimeout(() => setArmedDelete(null), 4000);
    return false;
  };

  const deleteLabourEntry = async (entryId: string) => {
    if (!docket) return;
    if (!confirmArmed(`labour-${entryId}`)) return;
    try {
      await removeLabourEntry(entryId);
      toast({ title: 'Entry deleted', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to delete entry');
    }
  };

  const deletePlantEntry = async (entryId: string) => {
    if (!docket) return;
    if (!confirmArmed(`plant-${entryId}`)) return;
    try {
      await removePlantEntry(entryId);
      toast({ title: 'Entry deleted', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to delete entry');
    }
  };

  const backPath = `/p${buildPortalCompanyQuery({
    projectId: company?.projectId ?? requestedProjectId,
    subcontractorCompanyId: company?.id ?? requestedSubcontractorCompanyId,
  })}`;

  // ── Submit / respond (classic hook, /p redirect + in-shell confirmation) ─────
  const { submitting, respondingToQuery, submitDocket, respondToQuery } = useDocketSubmitActions({
    docket,
    queryResponse,
    saveDocketNotes,
    navigate,
    redirectTo: backPath,
    onSubmitted: () => {
      if (!docket) return;
      setSubmittedConfirm({
        total: getDocketDisplayTotalCost(docket),
        entryCount: docket.labourEntries.length + docket.plantEntries.length,
        date: docket.date,
      });
    },
    // respond resubmits then returns to /p (mock #queried "Send answer & resubmit" → home).
  });

  // ── Derived state ───────────────────────────────────────────────────────────
  // INTENDED design (Jay, 2026-07-13): pass the FULL roster — DocketEntrySheets
  // renders non-approved employees/plant as locked rows ("Rate pending HC
  // approval") so subbies can see who exists but can only select approved.
  // The classic DocketEditPage hides non-approved instead; do not "fix" either
  // way without a fresh product call.
  const rosterEmployees = company?.employees ?? [];
  const rosterPlant = company?.plant ?? [];
  const totalLabour = docket ? getDocketDisplayLabourCost(docket) : 0;
  const totalPlant = docket ? getDocketDisplayPlantCost(docket) : 0;
  const totalCost = docket ? getDocketDisplayTotalCost(docket) : 0;
  const labourEntries = docket?.labourEntries ?? [];
  const plantEntries = docket?.plantEntries ?? [];

  const isQueried = docket?.status === 'queried';
  const isRejected = docket?.status === 'rejected';

  // ── Loading / error guards ──────────────────────────────────────────────────
  if (loading) {
    return (
      <ShellScreen
        variant="inner"
        title="Today's Docket"
        parent={backPath}
        sub={<span>Loading…</span>}
      >
        <div className="h-[72px] animate-pulse rounded-2xl bg-muted" />
        <div className="h-[72px] animate-pulse rounded-2xl bg-muted" />
      </ShellScreen>
    );
  }

  if (error) {
    return (
      <ShellScreen variant="inner" title="Docket" parent={backPath} sub={<span>Error</span>}>
        <div className="shell-notice shell-notice-bad">
          <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0" />
          <span>{error}</span>
        </div>
      </ShellScreen>
    );
  }

  // ── Submitted confirmation (mock #submitted) ────────────────────────────────
  if (submittedConfirm) {
    const dateLabel = new Intl.DateTimeFormat('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
      .format(new Date(submittedConfirm.date))
      .toUpperCase();
    return (
      <ShellScreen
        variant="inner"
        title="Docket sent"
        parent={backPath}
        bottom={
          <div className="shell-primary">
            <button
              type="button"
              className="shell-primary-btn"
              onClick={() => navigate(backPath)}
              aria-label="Done"
            >
              Done
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
          <div className="shell-bigtick">
            <Check size={52} strokeWidth={2.4} aria-hidden="true" />
          </div>
          <div className="shell-display-title">Sent for approval</div>
          <div className="shell-mono text-[12.5px] text-muted-foreground">
            {dateLabel} — {formatCurrency(submittedConfirm.total)} — {submittedConfirm.entryCount}{' '}
            {submittedConfirm.entryCount === 1 ? 'ENTRY' : 'ENTRIES'}
          </div>
          <p className="max-w-[280px] text-[14px] text-muted-foreground">
            The foreman gets it straight away. You'll be notified when it's approved.
          </p>
        </div>
      </ShellScreen>
    );
  }

  // ── Header sub-line ─────────────────────────────────────────────────────────
  const headerDateLabel = new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(docket?.date || today))
    .toUpperCase();

  const sub = (
    <span className="flex items-center gap-2">
      <span className="shell-mono">{headerDateLabel}</span>
      {canEdit ? (
        <span>
          {isOnline
            ? 'Saved automatically — submit at knock-off'
            : 'Offline — reconnect to edit this docket'}
        </span>
      ) : (
        <span>
          {labourEntries.length + plantEntries.length} entries · {formatCurrency(totalCost)}
        </span>
      )}
    </span>
  );

  // ── Bottom action bar ───────────────────────────────────────────────────────
  let bottom: React.ReactNode = undefined;
  if (isQueried) {
    bottom = (
      <div className="shell-primary">
        <button
          type="button"
          className={cn(
            'shell-primary-btn',
            (!isOnline || !queryResponse.trim() || respondingToQuery) && 'opacity-50',
          )}
          disabled={!isOnline || !queryResponse.trim() || respondingToQuery}
          onClick={respondToQuery}
          aria-label="Send answer and resubmit"
        >
          {respondingToQuery ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            <>
              <Send size={18} aria-hidden="true" />
              Send answer &amp; resubmit
            </>
          )}
        </button>
      </div>
    );
  } else if (canEdit && (docket?.status === 'draft' || docket?.status === 'rejected' || !docket)) {
    bottom = (
      <div className="shell-primary">
        <button
          type="button"
          className={cn('shell-primary-btn', (!canSubmit || submitting) && 'opacity-50')}
          disabled={!canSubmit || submitting}
          onClick={submitDocket}
          aria-label={isRejected ? 'Resubmit for approval' : 'Submit for approval'}
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Submitting…
            </>
          ) : (
            <>
              {isRejected ? 'Resubmit for approval' : 'Submit for approval'}
              {totalCost > 0 && (
                <span className="shell-hero-money text-[18px]">{formatCurrency(totalCost)}</span>
              )}
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <ShellScreen
      variant="inner"
      title={
        isNewDocket || !docket?.docketNumber
          ? "Today's Docket"
          : docket.date === today
            ? "Today's Docket"
            : `Docket ${docket.docketNumber}`
      }
      parent={backPath}
      sub={sub}
      headerExtra={
        docket ? (
          <div className="mt-2">
            <StatusBadge status={docket.status} />
          </div>
        ) : undefined
      }
      bottom={bottom}
    >
      {/* Queried — foreman query quoted + answer textarea (mock #queried) */}
      {isQueried && (
        <>
          <div className="shell-notice shell-notice-warn">
            <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0 text-warning" />
            <div className="min-w-0">
              <b className="block">Foreman asked:</b>
              <div className="shell-quote">
                “{docket?.foremanNotes || 'Please review this docket'}”
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rejected — reason in a red notice, editable below (mock) */}
      {isRejected && (
        <div className="shell-notice shell-notice-bad">
          <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0" />
          <div className="min-w-0">
            <b className="block">Sent back:</b>
            <span className="block">{docket?.foremanNotes || 'No reason provided'}</span>
            <span className="mt-1 block text-[12.5px]">Fix the entries below and resubmit.</span>
          </div>
        </div>
      )}

      {docket?.status === 'approved' && docket.adjustmentReason?.trim() && (
        <div className="shell-notice shell-notice-warn">
          <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0 text-warning" />
          <div className="min-w-0">
            <b className="block">Approved with adjustment:</b>
            <span className="block">{docket.adjustmentReason.trim()}</span>
          </div>
        </div>
      )}

      {canEdit && !isOnline && (
        <div className="shell-notice shell-notice-warn" role="status">
          <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0 text-warning" />
          <span>
            Dockets need a connection. Reconnect before adding hours, editing notes, or submitting.
          </span>
        </div>
      )}

      {/* Lots-module-off / no-lots notices (classic copy) */}
      {canEdit &&
        (lotsModuleDisabled ? (
          <div className="shell-notice shell-notice-warn">
            <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0 text-warning" />
            <span>{LOTS_MODULE_DISABLED_DOCKET_MESSAGE}</span>
          </div>
        ) : (
          assignedLots.length === 0 && (
            <div className="shell-notice shell-notice-warn">
              <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0 text-warning" />
              <span>
                No lots have been assigned to you yet. Contact your project manager to get lot
                assignments.
              </span>
            </div>
          )
        ))}

      {/* CREW */}
      <div className="shell-sect">
        <span className="t">CREW</span>
        <span className="n">{labourEntries.length} on site</span>
      </div>
      {labourEntries.map((entry) => {
        const displayHours = docket ? getDocketDisplayLabourEntryHours(docket, entry) : 0;
        const displayCost = docket ? getDocketDisplayLabourEntryCost(docket, entry) : 0;
        const adjusted = docket ? hasDocketLabourEntryAdjustment(docket, entry) : false;

        return (
          <div key={entry.id} className="shell-entry">
            <div className="grow">
              <div className="t">{entry.employee.name}</div>
              <div className="d">
                <span className="shell-mono">
                  {formatTimeRange(entry.startTime, entry.finishTime)}
                </span>
                {entry.lotAllocations[0]?.lotNumber && (
                  <span className="shell-lotchip">{entry.lotAllocations[0].lotNumber}</span>
                )}
              </div>
            </div>
            <div>
              <span className="cost">{formatCurrency(displayCost)}</span>
              <span className="hrs">{displayHours} h</span>
              {adjusted && (
                <span className="hrs line-through">
                  was {entry.submittedHours} h / {formatCurrency(entry.submittedCost)}
                </span>
              )}
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={() => deleteLabourEntry(entry.id)}
                aria-label={`Remove ${entry.employee.name}`}
                className={cn(
                  '-mr-1 flex h-9 items-center justify-center rounded-lg active:bg-secondary',
                  armedDelete === `labour-${entry.id}`
                    ? 'px-2 text-[12px] font-semibold text-destructive'
                    : 'w-9 text-muted-foreground',
                )}
              >
                {armedDelete === `labour-${entry.id}` ? (
                  'Remove?'
                ) : (
                  <Trash2 size={17} aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        );
      })}
      {canWrite && (
        <button
          type="button"
          className="shell-addline"
          onClick={() => openAddLabour()}
          aria-label="Add crew hours"
        >
          <Plus size={19} aria-hidden="true" />
          Add crew hours
        </button>
      )}

      {/* PLANT */}
      <div className="shell-sect" style={{ marginTop: 6 }}>
        <span className="t">PLANT</span>
        <span className="n">
          {plantEntries.length} {plantEntries.length === 1 ? 'machine' : 'machines'}
        </span>
      </div>
      {plantEntries.map((entry) => {
        const displayCost = docket ? getDocketDisplayPlantEntryCost(docket, entry) : 0;
        const adjusted = docket ? hasDocketPlantEntryCostAdjustment(docket, entry) : false;

        return (
          <div key={entry.id} className="shell-entry">
            <div className="grow">
              <div className="t">
                {entry.plant.type}
                {entry.plant.description ? ` — ${entry.plant.description}` : ''}
              </div>
              <div className="d">
                <span className="shell-mono">{entry.hoursOperated} h</span>
                {entry.lotAllocations?.[0]?.lotNumber && (
                  <span className="shell-lotchip">{entry.lotAllocations[0].lotNumber}</span>
                )}
                <span className="shell-lotchip">{entry.wetOrDry === 'wet' ? 'WET' : 'DRY'}</span>
              </div>
            </div>
            <div>
              <span className="cost">{formatCurrency(displayCost)}</span>
              <span className="hrs">@ ${entry.hourlyRate}/h</span>
              {adjusted && (
                <span className="hrs line-through">was {formatCurrency(entry.submittedCost)}</span>
              )}
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={() => deletePlantEntry(entry.id)}
                aria-label={`Remove ${entry.plant.type}`}
                className={cn(
                  '-mr-1 flex h-9 items-center justify-center rounded-lg active:bg-secondary',
                  armedDelete === `plant-${entry.id}`
                    ? 'px-2 text-[12px] font-semibold text-destructive'
                    : 'w-9 text-muted-foreground',
                )}
              >
                {armedDelete === `plant-${entry.id}` ? (
                  'Remove?'
                ) : (
                  <Trash2 size={17} aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        );
      })}
      {canWrite && (
        <button
          type="button"
          className="shell-addline"
          onClick={() => openAddPlant()}
          aria-label="Add plant hours"
        >
          <Plus size={19} aria-hidden="true" />
          Add plant hours
        </button>
      )}

      {/* NOTES — editable statuses auto-save on blur; queried shows the answer box */}
      {isQueried ? (
        <>
          <div className="shell-sect" style={{ marginTop: 6 }}>
            <span className="t">YOUR ANSWER</span>
          </div>
          <textarea
            className="shell-notes"
            value={queryResponse}
            onChange={(e) => setQueryResponse(e.target.value)}
            disabled={!isOnline}
            placeholder={isOnline ? 'Reply to the foreman…' : 'Reconnect to reply…'}
            aria-label="Your answer to the foreman"
          />
        </>
      ) : (
        <>
          <div className="shell-sect" style={{ marginTop: 6 }}>
            <span className="t">NOTES</span>
            {canWrite && (
              <DictationMicButton
                className="self-center"
                onTranscript={(text) => setNotes((prev) => (prev ? prev + ' ' + text : text))}
              />
            )}
          </div>
          {canWrite ? (
            <textarea
              className="shell-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Anything the foreman should know — delays, extra work, conditions…"
              aria-label="Docket notes"
            />
          ) : (
            <div className="shell-card text-[14px] text-muted-foreground">
              {notes.trim() ? notes : 'No notes.'}
            </div>
          )}
        </>
      )}

      {/* Totals card */}
      {(labourEntries.length > 0 || plantEntries.length > 0) && (
        <div className="shell-totals" style={{ marginTop: 6 }}>
          <div className="ln">
            <span>
              Labour ({labourEntries.length} {labourEntries.length === 1 ? 'entry' : 'entries'})
            </span>
            <span className="shell-mono">{formatCurrency(totalLabour)}</span>
          </div>
          <div className="ln">
            <span>
              Plant ({plantEntries.length} {plantEntries.length === 1 ? 'entry' : 'entries'})
            </span>
            <span className="shell-mono">{formatCurrency(totalPlant)}</span>
          </div>
          <div className="grand">
            <span>Today's total</span>
            <span className="shell-mono">{formatCurrency(totalCost)}</span>
          </div>
        </div>
      )}

      {/* Read-only status line for pending/approved (no edit affordances above) */}
      {!canEdit && (docket?.status === 'pending_approval' || docket?.status === 'approved') && (
        <div className="shell-notice shell-notice-warn" role="status">
          <Check size={19} aria-hidden="true" className="mt-px shrink-0" />
          <span>
            {docket.status === 'approved'
              ? 'This docket is approved.'
              : 'Sent — waiting on the foreman to approve.'}
          </span>
        </div>
      )}

      {/* Entry sheets — only mount the relevant one when open */}
      {sheetOpen && sheetType === 'labour' && (
        <LabourSheet
          open={sheetOpen}
          employees={rosterEmployees}
          selectedEmployee={selectedEmployee}
          startTime={startTime}
          finishTime={finishTime}
          selectedLotId={selectedLotId}
          assignedLots={assignedLots}
          labourHoursError={labourHoursError}
          previewHours={previewHours}
          previewCost={previewCost}
          saving={saving}
          onSelectEmployee={setSelectedEmployee}
          onStartTimeChange={setStartTime}
          onFinishTimeChange={setFinishTime}
          onSelectedLotIdChange={setSelectedLotId}
          onClose={closeSheet}
          onAdd={() => addLabourEntry(false)}
          onAddAnother={() => addLabourEntry(true)}
        />
      )}
      {sheetOpen && sheetType === 'plant' && (
        <PlantSheet
          open={sheetOpen}
          plant={rosterPlant}
          selectedPlant={selectedPlant}
          hoursOperated={hoursOperated}
          wetOrDry={wetOrDry}
          selectedLotId={selectedLotId}
          assignedLots={assignedLots}
          plantHoursError={plantHoursError}
          previewHours={previewHours}
          previewCost={previewCost}
          saving={saving}
          onSelectPlant={setSelectedPlant}
          onHoursOperatedChange={setHoursOperated}
          onWetOrDryChange={setWetOrDry}
          onSelectedLotIdChange={setSelectedLotId}
          onClose={closeSheet}
          onAdd={() => addPlantEntry(false)}
          onAddAnother={() => addPlantEntry(true)}
        />
      )}
    </ShellScreen>
  );
}
